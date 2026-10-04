import { audioContext } from '@/lib/games/audio-context';
import type { NightId } from '@/lib/games/diner/content';
import type { DinerEvent } from '@/lib/games/diner/engine';

/**
 * Diner's sound, synthesised so it costs no downloads: a counter bell, a
 * sizzle, the blender's buzz, coins, soap, a gooey pop when a mimic is
 * caught. The jukebox plays a soft doo-wop loop at the Ambient level, in a
 * different key each night. Effects follow the Sound effects switch; pause,
 * hiding the page and leaving silence it all.
 */
type Voice = OscillatorType;
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class DinerSound {
  private ctx: AudioContext | null = null;
  private fx: GainNode | null = null;
  private music: GainNode | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.5;
  private ambience = 0.6;
  private paused = false;
  private beat = 0;
  private nextAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private night: NightId = 1;
  private lastTick = -1;
  private recent = new Map<string, number>();

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended')
        void this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    try {
      const ctx = audioContext();
      this.ctx = ctx;
      this.bus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.bus.connect(comp);
      comp.connect(ctx.destination);
      this.fx = ctx.createGain();
      this.music = ctx.createGain();
      this.fx.connect(this.bus);
      this.music.connect(this.bus);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.apply();
      return ctx;
    } catch {
      return null;
    }
  }

  private apply() {
    if (!this.ctx || !this.fx || !this.music) return;
    const now = this.ctx.currentTime;
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.fx.gain.setTargetAtTime(hidden ? 0 : this.volume * 0.55, now, 0.03);
    this.music.gain.setTargetAtTime(
      this.paused || hidden ? 0 : this.ambience * 0.16,
      now,
      0.25,
    );
  }

  levels(volume: number, ambience: number) {
    this.volume = volume;
    this.ambience = ambience;
    this.apply();
  }
  pause(on: boolean) {
    this.paused = on;
    this.apply();
  }

  // ------------------------------------------------------------ building blocks

  private tone(
    freq: number,
    at: number,
    len: number,
    o: {
      type?: Voice;
      gain?: number;
      to?: number;
      attack?: number;
      dest?: AudioNode;
      detune?: number;
    } = {},
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + len);
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(g);
    g.connect(o.dest ?? this.fx!);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
  private hiss(
    at: number,
    len: number,
    o: {
      freq?: number;
      q?: number;
      gain?: number;
      type?: BiquadFilterType;
      to?: number;
      dest?: AudioNode;
    } = {},
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 3000, at);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + len);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest ?? this.fx!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + len + 0.05);
  }

  /** Plays a named cue now (if sound is on and the same cue is not ringing). */
  play(cue: string, pan = 0) {
    if (
      this.volume <= 0 ||
      (typeof document !== 'undefined' && document.hidden)
    )
      return;
    const ctx = this.ensure();
    if (!ctx || !this.fx) return;
    const last = this.recent.get(cue) ?? -1;
    if (ctx.currentTime - last < 0.06) return;
    this.recent.set(cue, ctx.currentTime);
    const t = ctx.currentTime + 0.005;
    void pan;
    switch (cue) {
      case 'bell':
        this.tone(1318.5, t, 1.1, { gain: 0.22, type: 'sine' });
        this.tone(2637, t, 0.6, { gain: 0.08, type: 'sine' });
        this.tone(3950, t, 0.25, { gain: 0.04, type: 'sine' });
        break;
      case 'ready':
        this.tone(1046.5, t, 0.25, { gain: 0.16, type: 'triangle' });
        this.tone(1568, t + 0.09, 0.35, { gain: 0.14, type: 'triangle' });
        break;
      case 'sizzle':
        this.hiss(t, 0.9, { freq: 5200, q: 0.6, gain: 0.12, type: 'highpass' });
        for (let i = 0; i < 6; i++)
          this.hiss(t + Math.random() * 0.7, 0.03, {
            freq: 2500,
            q: 2,
            gain: 0.08,
          });
        break;
      case 'blend':
        this.tone(140, t, 0.7, { type: 'sawtooth', gain: 0.05, to: 190 });
        this.hiss(t, 0.6, { freq: 900, q: 3, gain: 0.05 });
        break;
      case 'take':
        this.tone(660, t, 0.08, { gain: 0.14, type: 'triangle', to: 880 });
        break;
      case 'serve':
        this.tone(880, t, 0.09, { gain: 0.14, type: 'triangle' });
        this.tone(1320, t + 0.06, 0.16, { gain: 0.12, type: 'triangle' });
        this.hiss(t, 0.05, { freq: 6000, gain: 0.05 });
        break;
      case 'seat':
        this.tone(523, t, 0.1, { gain: 0.13, type: 'triangle' });
        this.tone(659, t + 0.07, 0.1, { gain: 0.12, type: 'triangle' });
        this.tone(784, t + 0.14, 0.18, { gain: 0.12, type: 'triangle' });
        break;
      case 'pop':
        this.tone(620, t, 0.09, { gain: 0.16, to: 280 });
        break;
      case 'coin':
        this.tone(988, t, 0.08, { gain: 0.1, type: 'square' });
        this.tone(1319, t + 0.07, 0.22, { gain: 0.1, type: 'square' });
        break;
      case 'coins':
        for (let i = 0; i < 4; i++) {
          this.tone(1319 + i * 120, t + i * 0.06, 0.12, {
            gain: 0.07,
            type: 'square',
          });
        }
        this.tone(2093, t + 0.26, 0.3, { gain: 0.06, type: 'triangle' });
        break;
      case 'wash':
        for (let i = 0; i < 7; i++)
          this.tone(500 + Math.random() * 700, t + i * 0.045, 0.06, {
            gain: 0.06,
            to: 900 + Math.random() * 600,
          });
        this.hiss(t, 0.4, { freq: 1200, q: 0.7, gain: 0.07 });
        break;
      case 'bin':
        this.tone(180, t, 0.18, { gain: 0.16, type: 'triangle', to: 90 });
        this.hiss(t, 0.12, { freq: 700, gain: 0.08 });
        break;
      case 'deny':
        this.tone(170, t, 0.09, { gain: 0.1, type: 'square', to: 140 });
        break;
      case 'goo':
        this.tone(420, t, 0.35, { gain: 0.2, to: 70, type: 'sine' });
        this.tone(260, t + 0.05, 0.3, { gain: 0.12, to: 520, type: 'sine' });
        this.hiss(t, 0.25, { freq: 500, q: 4, gain: 0.12, to: 150 });
        this.tone(1760, t + 0.22, 0.18, { gain: 0.06, type: 'triangle' });
        break;
      case 'burst':
        this.tone(300, t, 0.5, { gain: 0.24, to: 50, type: 'sawtooth' });
        this.hiss(t, 0.45, { freq: 400, q: 1.5, gain: 0.2, to: 120 });
        break;
      case 'storm':
        this.tone(330, t, 0.25, { gain: 0.12, type: 'sawtooth', to: 220 });
        this.tone(220, t + 0.2, 0.4, { gain: 0.12, type: 'sawtooth', to: 140 });
        break;
      case 'star':
        for (let i = 0; i < 3; i++)
          this.tone(NOTE(76 - i * 4), t + i * 0.1, 0.22, {
            gain: 0.1,
            type: 'triangle',
          });
        break;
      case 'mop':
        this.tone(1300, t, 0.12, { gain: 0.05, to: 1900, type: 'sine' });
        this.tone(1250, t + 0.25, 0.12, { gain: 0.05, to: 1850, type: 'sine' });
        this.tone(1300, t + 0.5, 0.12, { gain: 0.05, to: 1900, type: 'sine' });
        break;
      case 'door':
        this.tone(2093, t, 0.5, { gain: 0.05 });
        this.tone(2637, t + 0.08, 0.45, { gain: 0.04 });
        break;
      case 'tick':
        this.tone(1800, t, 0.03, { gain: 0.05, type: 'square' });
        break;
      case 'open':
        this.tone(1318.5, t, 1.0, { gain: 0.18 });
        this.tone(NOTE(72), t + 0.15, 0.2, { gain: 0.1, type: 'triangle' });
        this.tone(NOTE(76), t + 0.27, 0.2, { gain: 0.1, type: 'triangle' });
        this.tone(NOTE(79), t + 0.39, 0.35, { gain: 0.1, type: 'triangle' });
        break;
      case 'end':
        [72, 76, 79, 84].forEach((n, i) =>
          this.tone(NOTE(n), t + i * 0.12, 0.4, {
            gain: 0.12,
            type: 'triangle',
          }),
        );
        this.tone(1318.5, t + 0.5, 1.0, { gain: 0.12 });
        break;
      case 'tap':
        this.tone(900, t, 0.04, { gain: 0.05, type: 'triangle' });
        break;
    }
  }

  /** The cues for a batch of events. */
  events(events: DinerEvent[], you: number) {
    for (const e of events) {
      switch (e.type) {
        case 'bell':
          this.play('bell');
          break;
        case 'ready':
          this.play('ready');
          break;
        case 'cook':
          this.play(e.station === 'shake' ? 'blend' : 'sizzle');
          break;
        case 'take':
          this.play(e.burnt ? 'deny' : 'take');
          break;
        case 'serve':
          this.play('serve');
          break;
        case 'seat':
          this.play('seat');
          break;
        case 'lead':
        case 'return':
        case 'order':
          this.play('pop');
          break;
        case 'pay':
          this.play('coin');
          break;
        case 'clear':
          this.play('coins');
          break;
        case 'wash':
          this.play('wash');
          break;
        case 'bin':
          this.play('bin');
          break;
        case 'deny':
          if (e.player === you) this.play('deny');
          break;
        case 'reveal':
          this.play('goo');
          break;
        case 'burst':
          this.play('burst');
          break;
        case 'storm':
          this.play('storm');
          break;
        case 'star':
          this.play('star');
          break;
        case 'mop':
          this.play('mop');
          break;
        case 'arrive':
          this.play('door');
          break;
        case 'open':
          this.play('open');
          break;
        case 'end':
          this.play('end');
          break;
      }
    }
  }

  /** The last ten seconds tick. */
  clock(seconds: number) {
    const s = Math.ceil(seconds);
    if (s !== this.lastTick && s <= 10 && s > 0) this.play('tick');
    this.lastTick = s;
  }

  // ------------------------------------------------------------ the jukebox

  /** Starts the jukebox for a night (after a tap, so audio may play). */
  startMusic(night: NightId) {
    this.night = night;
    const ctx = this.ensure();
    if (!ctx || this.timer) return;
    this.nextAt = ctx.currentTime + 0.1;
    this.beat = 0;
    this.timer = setInterval(() => this.schedule(), 90);
  }
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    if (this.ambience <= 0 || this.paused || document.hidden) {
      this.nextAt = Math.max(this.nextAt, ctx.currentTime + 0.1);
      return;
    }
    // A slow 12/8 doo-wop: I vi IV V (Night 3 leans on the minor).
    const bpm = this.night === 3 ? 76 : 72;
    const beatLen = 60 / bpm / 3;
    const root = { 1: 48, 2: 53, 3: 45 }[this.night];
    const prog = this.night === 3 ? [0, -4, 3, 5] : [0, 9, 5, 7];
    const minor =
      this.night === 3
        ? [true, false, false, false]
        : [false, true, false, false];
    while (this.nextAt < ctx.currentTime + 0.4) {
      const t = this.nextAt;
      const bar = Math.floor(this.beat / 12) % 4;
      const pos = this.beat % 12;
      const chordRoot = root + prog[bar];
      const third = minor[bar] ? 3 : 4;
      // Piano triplets.
      const notes = [chordRoot + 12, chordRoot + 12 + third, chordRoot + 19];
      const n = notes[pos % 3] + (pos >= 6 && pos % 3 === 2 ? 12 : 0);
      this.tone(NOTE(n), t, beatLen * 2.2, {
        gain: pos % 3 === 0 ? 0.11 : 0.07,
        type: 'triangle',
        dest: this.music,
        attack: 0.01,
      });
      // Bass on the beats.
      if (pos % 3 === 0) {
        const walk = [0, 7, 12, 7][pos / 3];
        this.tone(NOTE(chordRoot - 12 + walk), t, beatLen * 2.6, {
          gain: 0.2,
          type: 'sine',
          dest: this.music,
          attack: 0.01,
        });
      }
      // Brushes on two and four.
      if (pos === 3 || pos === 9)
        this.hiss(t, 0.12, {
          freq: 6000,
          type: 'highpass',
          gain: 0.07,
          dest: this.music,
        });
      if (pos % 3 === 2)
        this.hiss(t, 0.04, {
          freq: 8000,
          type: 'highpass',
          gain: 0.025,
          dest: this.music,
        });
      this.beat++;
      this.nextAt += beatLen;
    }
  }

  dispose() {
    this.stopMusic();
    try {
      this.fx?.disconnect();
      this.music?.disconnect();
      this.bus?.disconnect();
    } catch {
      /* Already gone. */
    }
    this.ctx = null;
  }
}
