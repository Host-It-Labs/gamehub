'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Headphones, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import { audioAssets } from '@/lib/games/audio-catalog';
import type { Ambience } from '@/lib/games/ambience';
import { labAmbiences as ambiences } from '@/lib/games/lab-ambiences';
import { defaultMix, mixedAmbience, readAmbienceMix, saveAmbienceMix, type AmbienceMix } from '@/lib/games/ambience-mix';
import { pauseAmbienceWhenHidden, previewAmbience, stopAmbience } from '@/lib/games/ambience-player';
import { audioContext } from '@/lib/games/audio-context';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { auditionCue, setAuditionVolume, stopGameSounds } from '@/lib/games/game-sound';
import { soundBooks } from '@/lib/games/sound';
import type { SoundBook } from '@/lib/games/sound/cues';
import { signalTurn } from '@/lib/games/turn-signal';
import { boxCover } from '@/lib/games/box-covers';
import { troopCards } from '@/lib/games/arena/cards';
import arenaAudio from '@/lib/games/arena/audio.json';
import { arenaMusicOptions } from '@/lib/games/arena/music';
import { DinerSound } from './diner/sound';
import './sound-lab.css';

const humanName = (src: string) => src.split('/').at(-1)!.replace(/\.(m4a|mp3)$/, '').replaceAll('-', ' ');

/** The library id behind each book: its cover and, for three, its world. */
const gameIds: Record<string, string> = {
  nox: 'undertow', mora: 'wildgrove', yata: 'midnight', 'know-me': 'orin', quiz: 'miro', impostor: 'impostor',
  puzzles: 'folio', lucky: 'relic', rota: 'rota', alto: 'alto', arena: 'arena', diner: 'diner',
};
const moments: Record<string, string> = {
  pickup: 'Lifting', place: 'Playing', drop: 'Reordering', shuffle: 'A new match', scores: 'Final scores',
  select: 'Choosing', move: 'Locking in', reveal: 'The reveal', submit: 'Submitting', reward: 'Solved',
  invalid: 'Missed', star: 'A rare symbol', prize: 'A win', paper: 'A loss', upgrade: 'An upgrade',
};
type Group = { title?: string; cues: { name: string; label: string; moment?: string }[] };

/** Diner synthesises its own sound (components/game/diner/sound.ts). */
const DINER = {
  id: 'diner', name: 'Diner', material: 'Counter bell, grill & jukebox',
  cues: [
    ['bell', 'Counter bell'], ['ready', 'Order up'], ['sizzle', 'Grill sizzle'], ['blend', 'Blender'], ['pour', 'Pour coffee'],
    ['take', 'Take a plate'], ['serve', 'Serve'], ['seat', 'Seat a guest'], ['door', 'Door chime'], ['pop', 'An order'],
    ['coin', 'A tip'], ['coins', 'Clear a table'], ['wash', 'Wash up'], ['bin', 'Bin it'], ['clink', 'Cups and pots'],
    ['deny', 'Not now'], ['goo', 'A mimic caught'], ['burst', 'A mimic bursts'], ['storm', 'A storm'], ['star', 'A star'],
    ['mop', 'Mop'], ['dash', 'Dash'], ['jam', 'A machine jams'], ['repair', 'Repair'], ['rush', 'Rush hour'],
    ['power', 'Power cut'], ['juke', 'Jukebox'], ['tick', 'Last ten seconds'], ['open', 'Opening'], ['end', 'Closing time'],
  ] as const,
};

function groupsOf(book: SoundBook): Group[] {
  const all = Object.entries(book.cues).map(([name, c]) => ({ name, label: c.label, moment: moments[name] }));
  if (book.id !== 'arena') return [{ cues: all }];
  const quest = all.filter((c) => c.name.startsWith('quest-'));
  return [{ title: 'Battle', cues: all.filter((c) => !quest.includes(c)) }, { title: 'Quest', cues: quest }];
}

/** Arena's troops keep their recordings: each troop's own clips, and the
 *  shots and blasts that are theirs. The newer troops borrow from these. */
const TROOP_EXTRAS: Record<string, string> = {
  'medic-heal': 'medic', 'shield-break': 'gladiator', 'miner-dig': 'miner', 'miner-emerge': 'miner', 'pirate-leap': 'pirate',
  'viking-rage': 'viking', 'bomb-blast': 'drake', 'fire-blast': 'mage', 'zap-chain': 'inventor', stun: 'inventor',
  'shell-shot': 'gunner', 'shell-blast': 'gunner', 'drop-blast': 'balloon', 'balloon-crash': 'balloon',
};
const ACTIONS: Record<string, string> = { deploy: 'Arrives', attack: 'Attacks', death: 'Falls' };
const recordings = Object.entries(arenaAudio as Record<string, { srcs: string[]; gain: number }>).filter(([id]) => !id.startsWith('music-'));
const troopRecordings = [
  ...Object.values(troopCards).map((t) => ({
    title: t.name,
    clips: recordings.filter(([id]) => id.startsWith(`${t.id}-`) || TROOP_EXTRAS[id] === t.id)
      .map(([id, entry]) => ({ id, src: entry.srcs[0], gain: entry.gain * 0.35, label: ACTIONS[id.slice(t.id.length + 1)] ?? humanName(id) })),
  })),
  { title: 'Every blow', clips: recordings.filter(([id]) => id === 'hit-melee').map(([id, entry]) => ({ id, src: entry.srcs[0], gain: entry.gain * 0.35, label: 'A blow lands' })) },
].filter((g) => g.clips.length);

const books = soundBooks.filter((b) => b.id !== 'shared');
const turnBook = soundBooks.find((b) => b.id === 'shared')!;

export default function SoundLab() {
  const [game, setGame] = useState('nox');
  const [world, setWorld] = useState('ship');
  const gameId = gameIds[game];
  const book = books.find((b) => b.id === game);
  const entry = book ?? DINER;
  const ambience = ambiences.find((a) => a.id === gameId && a.world === world) ?? ambiences.find((a) => a.id === gameId);
  const [mix, setMix] = useState<AmbienceMix>(() => readAmbienceMix(ambiences.find((a) => a.world === 'ship')!));
  const [volume, setVolume] = useState(() => process.env.NODE_ENV === 'development' ? readAudioLevel('gamehub.sound-lab.volume', 0.45) : 0.45);
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [jukebox, setJukebox] = useState<1 | 2 | 3 | null>(null);
  const [status, setStatus] = useState('');
  const live = useRef<{ player: HTMLAudioElement | null; request: number; gain: number; timer: number }>({ player: null, request: 0, gain: 0.45, timer: 0 });
  // Builds nothing until it first plays.
  const [diner] = useState(() => new DinerSound());
  const alternatives = audioAssets.filter((a) => a.game === gameId && a.kind === 'bed' && (ambience?.world === 'coast' ? a.id.includes('coast') : !a.id.includes('coast')));
  const selectedBed = alternatives.find((a) => a.src === mix.bed) ?? alternatives.find((a) => a.category === 'base');
  const beds = selectedBed ? [{ src: selectedBed.src, label: selectedBed.label, gain: 0.85 }] : ambience?.beds ?? [];

  function stopClip() {
    live.current.request++;
    live.current.player?.pause();
    live.current.player = null;
    window.clearTimeout(live.current.timer);
    stopGameSounds('lab');
    setClip(null);
  }
  function stopJukebox() {
    diner.stopMusic();
    setJukebox(null);
  }
  function stop() {
    stopClip();
    stopJukebox();
    setPlaying(false);
    stopAmbience();
  }
  useEffect(() => {
    const media = live.current;
    const release = pauseAmbienceWhenHidden(false);
    const hidden = () => {
      if (document.hidden) { media.player?.pause(); stopGameSounds('lab'); diner.stopMusic(); setJukebox(null); setClip(null); setPlaying(false); }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      media.request++;
      media.player?.pause();
      window.clearTimeout(media.timer);
      stopGameSounds('lab');
      diner.dispose();
      release();
      stopAmbience();
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [diner]);
  useEffect(() => {
    if (!playing || !ambience) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewAmbience(mixedAmbience(ambience, mix), volume).then((loaded) => {
        if (!cancelled && !loaded) { setPlaying(false); setStatus('This mix could not load. Try again.'); }
      });
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); stopAmbience(); };
  }, [playing, ambience, mix, volume]);
  useEffect(() => {
    if (live.current.player) live.current.player.volume = volume * live.current.gain;
    setAuditionVolume(volume);
    diner.levels(volume, jukebox ? volume : 0);
  }, [volume, jukebox, diner]);

  function choose(id: string, nextWorld?: string) {
    stop();
    const next = ambiences.find((a) => a.id === gameIds[id] && (!nextWorld || a.world === nextWorld));
    setGame(id);
    setWorld(next?.world ?? '');
    setMix(next ? readAmbienceMix(next) : defaultMix());
    setStatus('');
  }

  /** Play a synthesised cue; its button stays lit while it rings. */
  function cue(key: string, play: () => number) {
    if (clip === key) { stopClip(); return; }
    stopClip();
    // Unlock in the click itself, including browsers with strict gesture requirements.
    try { audioContext(); } catch { setStatus('Audio is unavailable in this browser.'); return; }
    const seconds = play();
    if (!seconds) return;
    setClip(key);
    setStatus('');
    live.current.timer = window.setTimeout(() => setClip((c) => (c === key ? null : c)), seconds * 1000);
  }
  function dinerSound() {
    diner.levels(volume, jukebox ? volume : 0);
    return diner;
  }
  function toggleJukebox(night: 1 | 2 | 3) {
    if (jukebox === night) { stopJukebox(); return; }
    const d = dinerSound();
    d.stopMusic();
    setJukebox(night);
    d.levels(volume, volume);
    d.startMusic(night);
  }

  /** Play a recording (an ambience layer or Arena's music). */
  async function audition(src: string, gain: number) {
    if (clip === src) { stopClip(); return; }
    stopClip();
    const version = live.current.request;
    const audio = new Audio(src);
    live.current.player = audio;
    live.current.gain = gain;
    audio.volume = volume * gain;
    audio.onended = () => { if (live.current.player === audio) { setClip(null); live.current.player = null; } };
    setClip(src);
    setStatus('');
    try {
      await audio.play();
      if (live.current.request !== version) audio.pause();
    } catch {
      if (live.current.request === version) { setClip(null); setStatus('This sound could not load. Try again.'); }
    }
  }
  function level(src: string, value: number) {
    setMix((previous) => ({ ...previous, levels: { ...previous.levels, [src]: value } }));
    setStatus('');
  }
  function layer(a: { src: string; label?: string; gain: number }, i: number) {
    const label = a.label ?? humanName(a.src);
    return (
      <li className="sound-lab-layer" key={a.src}>
        <button type="button" className="sound-lab-play" aria-label={`${clip === a.src ? 'Stop' : 'Preview'} ${label}`} aria-pressed={clip === a.src} onClick={() => void audition(a.src, 0.52 * (ambience?.level ?? 0.55) * a.gain * (mix.levels[a.src] ?? 1))}>
          {clip === a.src ? <Square size={16} /> : <Play size={16} />}
        </button>
        <label htmlFor={`layer-${i}`}><span>{label}</span><small>{Math.round((mix.levels[a.src] ?? 1) * 100)}%</small></label>
        <input id={`layer-${i}`} aria-label={`${label} level`} type="range" min="0" max="1" step="0.05" value={mix.levels[a.src] ?? 1} onChange={(e) => level(a.src, Number(e.target.value))} />
      </li>
    );
  }
  function save(a: Ambience) {
    setStatus(saveAmbienceMix(a, mix) ? 'Preview saved on this device. Game ambience is unchanged.' : 'Storage is unavailable; you can still preview this mix.');
  }
  function toggleMix() {
    if (playing) { stop(); return; }
    try { audioContext(); } catch { setStatus('Audio is unavailable in this browser.'); return; }
    stop();
    setStatus('');
    setPlaying(true);
  }
  const button = (key: string, label: string, play: () => number, moment?: string) => (
    <button type="button" key={key} aria-pressed={clip === key} onClick={() => cue(key, play)}>
      {clip === key ? <Square size={18} /> : <Play size={18} />}
      <span>{label}</span>
      {moment && <small>{moment}</small>}
    </button>
  );
  return (
    <main className="sound-lab">
      <header className="sound-lab-header">
        <a href="/" className="sound-lab-back"><ArrowLeft size={19} /> Library</a>
        <h1><Headphones size={23} /> Sound Lab</h1>
        <label className="sound-lab-volume"><Volume2 size={18} /><span className="sr-only">Preview volume</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => {
          const level = Number(e.target.value);
          setVolume(level);
          if (process.env.NODE_ENV === 'development') saveAudioLevel(level, 'gamehub.sound-lab.volume');
        }} /><output>{Math.round(volume * 100)}%</output></label>
      </header>
      <section className="sound-lab-panel sound-lab-shared" aria-labelledby="turn-heading">
        <div className="sound-lab-turn">
          <div>
            <h2 id="turn-heading">Your turn</h2>
            <p className="sound-lab-note">The one sound every game shares, with a soft glow round the screen. The glow shows with sound off too.</p>
          </div>
          {button('shared:turn', 'Your turn', () => { signalTurn(); return auditionCue(turnBook, 'turn', volume) || 1.6; })}
        </div>
      </section>
      <nav className="sound-lab-games" aria-label="Choose a game">
        {[...books, DINER].map((g) => <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => choose(g.id)}>{g.name}</button>)}
      </nav>
      <div className="sound-lab-workspace">
        <aside className="sound-lab-cover">
          <img src={boxCover(gameId)} alt={`${entry.name} cover`} />
          <p>{entry.material}</p>
          <span>Synthesised in your browser</span>
        </aside>
        <div className="sound-lab-desk">
          <section className="sound-lab-panel" aria-labelledby="effects-heading">
            <h2 id="effects-heading">{entry.name} sounds</h2>
            {book ? groupsOf(book).map((g, i) => (
              <section className="sound-lab-group" key={g.title ?? i} aria-label={g.title}>
                {g.title && <h3>{g.title}</h3>}
                <div className="sound-lab-effects">{g.cues.map((c) => button(`${book.id}:${c.name}`, c.label, () => auditionCue(book, c.name, volume), c.moment))}</div>
              </section>
            )) : <>
              <div className="sound-lab-effects">{DINER.cues.map(([name, label]) => button(`diner:${name}`, label, () => { dinerSound().play(name); return 0.8; }))}</div>
              <section className="sound-lab-group" aria-labelledby="jukebox-heading">
                <h3 id="jukebox-heading">Jukebox</h3>
                <div className="sound-lab-options">{([1, 2, 3] as const).map((night) => <button type="button" key={night} aria-pressed={jukebox === night} onClick={() => toggleJukebox(night)}>Night {night}</button>)}</div>
              </section>
            </>}
          </section>
          {game === 'arena' && <section className="sound-lab-panel" aria-labelledby="arena-troops-heading">
            <h2 id="arena-troops-heading">Troops</h2>
            <p className="sound-lab-note">Recorded. The newer troops borrow the nearest of these.</p>
            {troopRecordings.map((g) => (
              <section className="sound-lab-group" key={g.title} aria-label={g.title}>
                <h3>{g.title}</h3>
                <div className="sound-lab-effects">{g.clips.map((c) => (
                  <button type="button" key={c.id} aria-label={`${g.title}: ${c.label}`} aria-pressed={clip === c.src} onClick={() => { stopAmbience(); setPlaying(false); void audition(c.src, c.gain); }}>
                    {clip === c.src ? <Square size={18} /> : <Play size={18} />}
                    <span>{c.label}</span>
                  </button>
                ))}</div>
              </section>
            ))}
          </section>}
          {game === 'arena' && <section className="sound-lab-panel" aria-labelledby="arena-music-heading">
            <h2 id="arena-music-heading">Arena music</h2>
            <p className="sound-lab-note">Two alternate original takes. Each final minute keeps the same music with fuller bass and a gentle 8% tempo lift. Previewing leaves the selected game music unchanged.</p>
            {arenaMusicOptions.map((option) => (
              <section className="sound-lab-comparison" key={option.id} aria-labelledby={`arena-music-${option.id}`}>
                <h3 id={`arena-music-${option.id}`}>{option.label}</h3>
                <div className="sound-lab-effects sound-lab-candidates">
                  {([['Battle', option.battle], ['Final minute', option.final]] as const).map(([label, id]) => {
                    const recording = arenaAudio[id];
                    return <button type="button" key={id} aria-label={`${option.label}: ${label}`} aria-pressed={clip === recording.srcs[0]} onClick={() => { stopAmbience(); setPlaying(false); void audition(recording.srcs[0], recording.gain); }}>
                      {clip === recording.srcs[0] ? <Square size={18} /> : <Play size={18} />}
                      <span>{label}</span><small>{recording.duration.toFixed(1)} s</small>
                    </button>;
                  })}
                </div>
              </section>
            ))}
          </section>}
          {ambience && <section className="sound-lab-panel" aria-labelledby="ambience-heading">
            <div className="sound-lab-section-heading"><h2 id="ambience-heading">The world around you</h2>
              <button type="button" className="sound-lab-primary" onClick={toggleMix} aria-pressed={playing}>{playing ? <Square size={17} /> : <Play size={17} />}{playing ? 'Stop mix' : 'Play mix'}</button>
            </div>
            {game === 'mora' && <div className="sound-lab-options" aria-label="Mora world">{[['forest', 'Observatory'], ['coast', 'Floodline']].map(([id, label]) => <button type="button" key={id} aria-pressed={ambience.world === id} onClick={() => choose(game, id)}>{label}</button>)}</div>}
            {alternatives.length > 0 && <div className="sound-lab-options" aria-label="Background recording">{alternatives.map((a) => <button type="button" key={a.id} aria-pressed={selectedBed?.id === a.id} onClick={() => { setMix((m) => ({ ...m, bed: a.src })); setStatus(''); }}>{a.label}</button>)}</div>}
            <p className="sound-lab-note">Choose a background, then blend the details. Use each play button to hear a layer on its own. These previews do not change game ambience.</p>
            <ul className="sound-lab-layers">{[...beds, ...ambience.events].map(layer)}</ul>
            <label className="sound-lab-spacing">Time between details <input type="range" min="0.75" max="2.5" step="0.25" value={mix.spacing} onChange={(e) => { setMix((m) => ({ ...m, spacing: Number(e.target.value) })); setStatus(''); }} /><output>{Math.round(ambience.gap[0] * mix.spacing)}–{Math.round(ambience.gap[1] * mix.spacing)} s</output></label>
            <footer className="sound-lab-save"><button type="button" onClick={() => save(ambience)}><Check size={17} /> Save preview</button><button type="button" onClick={() => { setMix(defaultMix()); setStatus('Default mix restored. Choose Save preview to save.'); }}><RotateCcw size={16} /> Reset</button></footer>
          </section>}
          <output className="sound-lab-status">{status}</output>
        </div>
      </div>
    </main>
  );
}
