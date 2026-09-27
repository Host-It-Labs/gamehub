import manifest from '@/lib/games/arena/audio.json';
import type { TroopId } from '@/lib/games/arena/cards';
import type { ArenaEvent, Match, Side } from '@/lib/games/arena/engine';
import { audioBuffer, audioContext } from '@/lib/games/audio-context';

/**
 * Arena's own sound: a looping battle theme (more urgent in the last minute
 * and in overtime), a whoosh and thump when a card lands, a cue as each
 * troop arrives, its attack, its fall, the towers' shots and collapse, the
 * Meteor, and a sting at the end. Generated with ElevenLabs; the list and
 * levels are in lib/games/arena/audio.json (prompts in
 * assets/arena/audio/README.md).
 *
 * Effects are panned by where they happen across the screen and vary a
 * little in pitch so a crowd never sounds like one clip on repeat; each
 * sound has a few voices at most, and a busy battle drops the quietest
 * extras rather than stacking into noise.
 */
type Entry = { srcs: string[]; duration: number; gain: number; loop?: boolean };
const sounds = manifest as Record<string, Entry>;

/** How many copies of one sound may play at once, and how soon it may
 *  start again (seconds). */
const VOICES = 3;
const GAP = 0.06;
const TOTAL = 14;
const FOREGROUND = new Set([
  'battle-start',
  'overtime',
  'tower-fall',
  'crown',
  'meteor-crash',
  'sting-win',
  'sting-lose',
  'sting-draw',
]);
type Music = {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  started: boolean;
};

export class ArenaSound {
  private context: AudioContext | null = null;
  private effects: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private output: DynamicsCompressorNode | null = null;
  private music: Music | null = null;
  private loops = new Set<Music>();
  private active = new Set<AudioBufferSourceNode>();
  private timers = new Set<number>();
  private paused = false;
  private epoch = 0;
  private duckUntil = 0;
  private musicTarget = -1;
  private playing = new Map<string, number>();
  private last = new Map<string, number>();
  private live = 0;
  private volume = 0.5;
  private musicLevel = 0.6;
  private disposed = false;
  private lastSecond = -1;

  /** Preload every clip so the first card already has its sound. */
  constructor() {
    try {
      this.context = audioContext();
      this.output = this.context.createDynamicsCompressor();
      this.output.threshold.value = -8;
      this.output.knee.value = 6;
      this.output.ratio.value = 8;
      this.output.attack.value = 0.003;
      this.output.release.value = 0.18;
      this.output.connect(this.context.destination);
      this.effects = this.context.createGain();
      this.effects.connect(this.output);
      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.output);
      for (const entry of Object.values(sounds))
        for (const src of entry.srcs)
          void audioBuffer(this.context, src).catch(() => {});
    } catch {
      /* Sound is optional. */
    }
    this.levels(this.volume, this.musicLevel);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
  }

  private unlock = () => {
    if (this.context?.state === 'suspended')
      void this.context.resume().catch(() => {});
  };

  private visibility = () => {
    if (document.hidden) this.silence();
    this.levels(this.volume, this.musicLevel);
  };

  pause(paused: boolean) {
    this.paused = paused;
    if (paused) this.silence();
    this.levels(this.volume, this.musicLevel);
  }

  private silence() {
    this.epoch++;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    for (const source of this.active) source.stop();
    this.last.clear();
  }

  private later(action: () => void, ms: number) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed && !this.paused && !document.hidden) action();
    }, ms);
    this.timers.add(timer);
  }

  /** Effects volume (0 mutes) and the music's level (the Ambient switch). */
  levels(volume: number, music: number) {
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0;
    this.musicLevel = Number.isFinite(music)
      ? Math.max(0, Math.min(1, music))
      : 0;
    if (!this.volume) this.silence();
    const c = this.context;
    if (!c || !this.effects || !this.musicGain) return;
    const quiet = document.hidden || this.paused;
    // About 10 dB below the original effects mix; music keeps its own level.
    this.effects.gain.setTargetAtTime(
      quiet ? 0 : this.volume * 0.35,
      c.currentTime,
      0.015,
    );
    this.mixMusic();
  }

  private mixMusic() {
    const c = this.context;
    if (!c || !this.musicGain) return;
    const quiet = document.hidden || this.paused || this.musicLevel === 0;
    const ducked = c.currentTime < this.duckUntil;
    const target = quiet ? 0 : this.musicLevel * 0.55 * (ducked ? 0.38 : 1);
    if (target === this.musicTarget) return;
    this.musicTarget = target;
    this.musicGain.gain.setTargetAtTime(
      target,
      c.currentTime,
      quiet ? 0.015 : ducked ? 0.025 : 0.35,
    );
  }

  /** Play a sound; `pan` runs -1 (left) to 1 (right). */
  play(id: string, pan = 0, level = 1) {
    const entry = sounds[id];
    const c = this.context;
    if (!entry || !c || !this.effects || this.disposed || this.volume <= 0)
      return;
    if (document.hidden || this.paused) return;
    const now = c.currentTime;
    if (now - (this.last.get(id) ?? -1) < GAP) return;
    const voices = this.playing.get(id) ?? 0;
    const priority = FOREGROUND.has(id);
    if (voices >= VOICES || this.live >= (priority ? TOTAL : TOTAL - 3)) return;
    this.last.set(id, now);
    const epoch = this.epoch;
    const src = entry.srcs[Math.floor(Math.random() * entry.srcs.length)];
    void audioBuffer(c, src)
      .then((buffer) => {
        if (
          this.disposed ||
          c.state !== 'running' ||
          epoch !== this.epoch ||
          this.volume <= 0 ||
          document.hidden ||
          this.paused
        )
          return;
        if (
          (this.playing.get(id) ?? 0) >= VOICES ||
          this.live >= (priority ? TOTAL : TOTAL - 3)
        )
          return;
        // Late decodes (the first play) are dropped rather than heard late.
        if (c.currentTime - now > 0.25) return;
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.94 + Math.random() * 0.12;
        const gain = c.createGain();
        gain.gain.value = entry.gain * level;
        const panner = c.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan)) * 0.6;
        source.connect(gain).connect(panner).connect(this.effects!);
        this.playing.set(id, (this.playing.get(id) ?? 0) + 1);
        this.live++;
        this.active.add(source);
        source.onended = () => {
          this.active.delete(source);
          this.playing.set(id, (this.playing.get(id) ?? 1) - 1);
          this.live--;
          source.disconnect();
          gain.disconnect();
          panner.disconnect();
        };
        source.start();
        if (priority) {
          this.duckUntil = Math.max(
            this.duckUntil,
            c.currentTime + Math.min(buffer.duration, 2),
          );
          this.mixMusic();
        }
      })
      .catch(() => {});
  }

  /** Start a music loop, crossfading from the one playing; null fades out. */
  setMusic(id: string | null) {
    const c = this.context;
    if (!c || !this.musicGain || this.disposed) return;
    if ((this.music?.id ?? null) === id) return;
    const old = this.music;
    if (old) {
      if (old.started) {
        old.gain.gain.setTargetAtTime(0, c.currentTime, 0.2);
        old.source.stop(c.currentTime + 1);
      } else {
        old.source.disconnect();
        old.gain.disconnect();
        this.loops.delete(old);
      }
    }
    this.music = null;
    const entry = id ? sounds[id] : undefined;
    if (!id || !entry) return;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(this.musicGain);
    const source = c.createBufferSource();
    source.loop = true;
    source.connect(gain);
    const music = { id, source, gain, started: false };
    this.music = music;
    this.loops.add(music);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.loops.delete(music);
    };
    void audioBuffer(c, entry.srcs[0])
      .then((buffer) => {
        if (this.music?.source !== source || this.disposed) return;
        source.buffer = buffer;
        source.start();
        music.started = true;
        gain.gain.setTargetAtTime(entry.gain, c.currentTime, 0.5);
      })
      .catch(() => {
        source.disconnect();
        gain.disconnect();
        this.loops.delete(music);
      });
  }

  /** Sounds for what just happened in the battle. `pan` places a field
   *  point across the screen; `viewer` is the side watching. */
  events(
    m: Match,
    events: ArenaEvent[],
    viewer: Side,
    pan: (x: number, y: number) => number,
  ) {
    for (const e of events) {
      switch (e.type) {
        case 'deploy': {
          const p = pan(e.x, e.y);
          if (e.card === 'meteor') {
            this.play('meteor-fall', p);
            break;
          }
          this.play('card-drop', p, e.side === viewer ? 1 : 0.7);
          const card = e.card as TroopId;
          // The troop's own cue as it lands.
          this.later(() => this.play(`${card}-deploy`, p), 260);
          break;
        }
        case 'shot': {
          const tower = m.towers.find((t) => t.id === e.id);
          const unit = tower ? undefined : m.units.find((u) => u.id === e.id);
          const at = tower ?? unit;
          const p = at ? pan(at.x, at.y) : 0;
          if (tower)
            this.play(
              e.kind === 'cannon' ? 'cannon-shot' : 'arrow-shot',
              p,
              0.8,
            );
          else if (unit) this.play(`${unit.card}-attack`, p);
          break;
        }
        case 'swing': {
          const u = m.units.find((x) => x.id === e.id);
          if (!u) break;
          const p = pan(u.x, u.y);
          this.play(`${u.card}-attack`, p);
          this.play('hit-melee', p, 0.6);
          break;
        }
        case 'hit': {
          if (m.towers.some((t) => t.id === e.id))
            this.play('tower-hit', pan(e.x, e.y), 0.6);
          break;
        }
        case 'impact': {
          const p = pan(e.x, e.y);
          if (e.kind === 'meteor') this.play('meteor-crash', p);
          else if (e.kind === 'bomb') this.play('bomb-blast', p, 0.8);
          else if (e.kind === 'fire') this.play('fire-blast', p, 0.8);
          break;
        }
        case 'death':
          this.play(`${e.card}-death`, pan(e.x, e.y), 0.85);
          break;
        case 'tower': {
          const t = m.towers.find((x) => x.id === e.id);
          this.play('tower-fall', t ? pan(t.x, t.y) : 0);
          if (e.side !== viewer) this.later(() => this.play('crown'), 450);
          break;
        }
        case 'king-wakes':
          this.play('king-wake');
          break;
        case 'phase':
          if (e.phase === 'battle') this.play('battle-start');
          else if (e.phase === 'overtime') this.play('overtime');
          else if (e.phase === 'over') {
            this.setMusic(null);
            this.play(
              m.winner === 'draw' || m.winner === null
                ? 'sting-draw'
                : m.winner === viewer
                  ? 'sting-win'
                  : 'sting-lose',
            );
          }
          break;
      }
    }
  }

  /** Once a frame: the music for this moment of the battle, and the clock
   *  ticking through the last ten seconds. `left` is the time left. */
  frame(m: Match, left: number, urgent: boolean) {
    this.mixMusic();
    if (m.phase === 'over') {
      this.setMusic(null);
      return;
    }
    if (this.paused || document.hidden) return;
    this.setMusic(
      m.phase === 'ready'
        ? 'music-battle'
        : urgent
          ? 'music-final'
          : 'music-battle',
    );
    const second = Math.ceil(left);
    if (
      m.phase !== 'ready' &&
      left > 0 &&
      left <= 10 &&
      second !== this.lastSecond
    )
      this.play('countdown-tick', 0, 0.7);
    this.lastSecond = second;
  }

  dispose() {
    this.disposed = true;
    this.silence();
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    for (const loop of this.loops) {
      if (loop.started) loop.source.stop();
      loop.source.disconnect();
      loop.gain.disconnect();
    }
    this.loops.clear();
    this.music = null;
    this.effects?.disconnect();
    this.musicGain?.disconnect();
    this.output?.disconnect();
  }
}
