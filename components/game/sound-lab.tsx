'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Headphones, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import { audioAssets, sharedAudioAssets, soundGames, type SoundGame } from '@/lib/games/audio-catalog';
import type { Ambience } from '@/lib/games/ambience';
import { labAmbiences as ambiences } from '@/lib/games/lab-ambiences';
import { defaultMix, mixedAmbience, readAmbienceMix, saveAmbienceMix, type AmbienceMix } from '@/lib/games/ambience-mix';
import { pauseAmbienceWhenHidden, previewAmbience, stopAmbience } from '@/lib/games/ambience-player';
import { audioContext } from '@/lib/games/audio-context';
import { effectLevel } from '@/lib/games/game-sound';
import { audioOptions, earlierAudioOptions, sharedSoundActions } from '@/lib/games/audio-options';
import { boxCover } from '@/lib/games/box-covers';
import './sound-lab.css';

const humanName = (src: string) => src.split('/').at(-1)!.replace(/\.(m4a|mp3)$/, '').replaceAll('-', ' ');

export default function SoundLab() {
  const [game, setGame] = useState<SoundGame>('undertow');
  const [world, setWorld] = useState('ship');
  const ambience = ambiences.find((a) => a.id === game && a.world === world) ?? ambiences.find((a) => a.id === game);
  const [mix, setMix] = useState<AmbienceMix>(() => readAmbienceMix(ambiences.find((a) => a.world === 'ship')!));
  const [volume, setVolume] = useState(0.45);
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const live = useRef<{ player: HTMLAudioElement | null; request: number; gain: number }>({ player: null, request: 0, gain: 0.45 });
  const entry = soundGames.find((g) => g.id === game)!;
  const effects = audioAssets.filter((a) => a.game === game && a.kind === 'effect');
  const alternatives = ambience?.world === 'coast' ? [] : audioAssets.filter((a) => a.game === game && a.kind === 'bed');
  const selectedBed = alternatives.find((a) => a.src === mix.bed) ?? alternatives.find((a) => a.category === 'base');
  const beds = selectedBed ? [{ src: selectedBed.src, label: selectedBed.label, gain: 0.85 }] : ambience?.beds ?? [];

  function stop() {
    live.current.request++;
    live.current.player?.pause();
    live.current.player = null;
    setClip(null);
    setPlaying(false);
    stopAmbience();
  }
  useEffect(() => {
    const media = live.current;
    const release = pauseAmbienceWhenHidden(false);
    const hidden = () => {
      if (document.hidden) { media.player?.pause(); setClip(null); setPlaying(false); }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      media.request++;
      media.player?.pause();
      release();
      stopAmbience();
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
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
  }, [volume]);

  function choose(id: SoundGame, nextWorld?: string) {
    stop();
    const next = ambiences.find((a) => a.id === id && (!nextWorld || a.world === nextWorld));
    setGame(id);
    setWorld(next?.world ?? '');
    setMix(next ? readAmbienceMix(next) : defaultMix());
    setStatus('');
  }

  async function audition(src: string, gain = 0.45) {
    if (clip === src) { stop(); return; }
    stop();
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
  function layer(a: { src: string; label?: string }, i: number) {
    const label = a.label ?? humanName(a.src);
    return (
      <li className="sound-lab-layer" key={a.src}>
        <button type="button" className="sound-lab-play" aria-label={`${clip === a.src ? 'Stop' : 'Preview'} ${label}`} aria-pressed={clip === a.src} onClick={() => void audition(a.src)}>
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
    // Unlock in the click itself, including browsers with strict gesture requirements.
    try { audioContext(); } catch { setStatus('Audio is unavailable in this browser.'); return; }
    stop();
    setStatus('');
    setPlaying(true);
  }
  return (
    <main className="sound-lab">
      <header className="sound-lab-header">
        <a href="/" className="sound-lab-back"><ArrowLeft size={19} /> Library</a>
        <h1><Headphones size={23} /> Sound Lab</h1>
        <label className="sound-lab-volume"><Volume2 size={18} /><span className="sr-only">Preview volume</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /><output>{Math.round(volume * 100)}%</output></label>
      </header>
      <section className="sound-lab-panel sound-lab-shared" aria-labelledby="shared-effects-heading">
        <h2 id="shared-effects-heading">Shared game sounds</h2>
        <p className="sound-lab-note">Selected for every game: pickup B, place F, your turn C and Marimba flourish for final scores. Other sounds remain available to preview.</p>
        {sharedSoundActions.map(({ category, label }) => (
          <section className="sound-lab-comparison" aria-labelledby={`action-${category}`} key={category}>
            <h3 id={`action-${category}`}>{label}</h3>
            <div className="sound-lab-effects sound-lab-candidates">
              {audioOptions.filter((a) => a.category === category).map((a) => (
                <button type="button" key={a.id} data-preferred={a.preferred || undefined} aria-label={`${label}: ${a.option.toUpperCase()} · ${a.label}${a.preferred ? ' · Your pick' : ''}`} aria-pressed={clip === a.src} onClick={() => void audition(a.src, effectLevel(1, a.gain))}>
                  {clip === a.src ? <Square size={18} /> : <Play size={18} />}
                  <span>{a.option.toUpperCase()} · {a.label}</span>
                  <small>{a.preferred && 'Your pick · '}{a.duration.toFixed(1)} s</small>
                </button>
              ))}
            </div>
          </section>
        ))}
        <details className="sound-lab-archive sound-lab-current">
          <summary>Earlier options</summary>
          {sharedSoundActions.map(({ category, label }) => (
            <section className="sound-lab-comparison" aria-label={`Earlier ${label.toLowerCase()} options`} key={category}>
              <h3>{label}</h3>
              <div className="sound-lab-effects sound-lab-candidates">{earlierAudioOptions.filter((a) => a.category === category).map((a) => <button type="button" key={a.id} aria-label={`Earlier ${label}: ${a.option.toUpperCase()} · ${a.label}`} aria-pressed={clip === a.src} onClick={() => void audition(a.src, effectLevel(1, a.gain))}>{clip === a.src ? <Square size={18} /> : <Play size={18} />}<span>{a.option.toUpperCase()} · {a.label}</span><small>{a.duration.toFixed(1)} s</small></button>)}</div>
            </section>
          ))}
        </details>
        <details className="sound-lab-archive sound-lab-current">
          <summary>Selected game sounds</summary>
          <div className="sound-lab-effects">{sharedAudioAssets.map((a) => <button type="button" key={a.id} aria-pressed={clip === a.src} onClick={() => void audition(a.src, effectLevel(1, a.gain))}>{clip === a.src ? <Square size={18} /> : <Play size={18} />}<span>{sharedSoundActions.find((action) => action.category === a.category)?.label}</span><small>{a.duration.toFixed(1)} s</small></button>)}</div>
        </details>
      </section>
      <nav className="sound-lab-games" aria-label="Choose a game">
        {soundGames.map((g) => <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => choose(g.id)}>{g.name}</button>)}
      </nav>
      <div className="sound-lab-workspace">
        <aside className="sound-lab-cover">
          <img src={boxCover(game)} alt={`${entry.name} cover`} />
          <p>{entry.material}</p>
          <span>Original ElevenLabs foley</span>
        </aside>
        <div className="sound-lab-desk">
          {ambience && <section className="sound-lab-panel" aria-labelledby="ambience-heading">
            <div className="sound-lab-section-heading"><h2 id="ambience-heading">The world around you</h2>
              <button type="button" className="sound-lab-primary" onClick={toggleMix} aria-pressed={playing}>{playing ? <Square size={17} /> : <Play size={17} />}{playing ? 'Stop mix' : 'Play mix'}</button>
            </div>
            {game === 'wildgrove' && <div className="sound-lab-options" aria-label="Mora world">{[['forest', 'Observatory'], ['coast', 'Floodline']].map(([id, label]) => <button type="button" key={id} aria-pressed={ambience.world === id} onClick={() => choose(game, id)}>{label}</button>)}</div>}
            {alternatives.length > 0 && <div className="sound-lab-options" aria-label="Background recording">{alternatives.map((a) => <button type="button" key={a.id} aria-pressed={selectedBed?.id === a.id} onClick={() => { setMix((m) => ({ ...m, bed: a.src })); setStatus(''); }}>{a.label}</button>)}</div>}
            <p className="sound-lab-note">Choose a background, then blend the details. Use each play button to hear a layer on its own. These previews do not change game ambience.</p>
            <ul className="sound-lab-layers">{[...beds, ...ambience.events].map(layer)}</ul>
            <label className="sound-lab-spacing">Time between details <input type="range" min="0.75" max="2.5" step="0.25" value={mix.spacing} onChange={(e) => { setMix((m) => ({ ...m, spacing: Number(e.target.value) })); setStatus(''); }} /><output>{Math.round(ambience.gap[0] * mix.spacing)}–{Math.round(ambience.gap[1] * mix.spacing)} s</output></label>
            <footer className="sound-lab-save"><button type="button" onClick={() => save(ambience)}><Check size={17} /> Save preview</button><button type="button" onClick={() => { setMix(defaultMix()); setStatus('Default mix restored. Choose Save preview to save.'); }}><RotateCcw size={16} /> Reset</button></footer>
          </section>}
          <details className="sound-lab-panel sound-lab-archive">
            <summary>Earlier {entry.name} sounds</summary>
            <p className="sound-lab-note">Previous recordings, kept here for comparison.</p>
            <div className="sound-lab-effects">{effects.map((a) => <button type="button" key={a.id} aria-pressed={clip === a.src} onClick={() => void audition(a.src)}>{clip === a.src ? <Square size={18} /> : <Play size={18} />}<span>{a.category === 'select' ? 'Pick up' : a.category === 'move' ? 'Place & lock' : a.category === 'reveal' ? 'Reveal' : 'Reward'}</span><small>{a.duration.toFixed(1)} s</small></button>)}</div>
          </details>
          <output className="sound-lab-status">{status}</output>
        </div>
      </div>
    </main>
  );
}
