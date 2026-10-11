/**
 * The building blocks of every game's sound, synthesised in the browser the
 * way Diner's always was: oscillators, filtered noise, FM bells, plucked
 * strings and a small room. Nothing is downloaded.
 *
 * A `Synth` writes one cue. Times are offsets in seconds from the cue's start;
 * `pitch` scales every frequency so a crowd of repeats never sounds like one
 * sample. The latest scheduled stop is kept in `end`, which callers use to
 * count live voices and to know when a cue has rung out.
 */

export type Wave = OscillatorType;
export type FilterShape = {
  type?: BiquadFilterType;
  freq: number;
  /** Sweep the cutoff to this frequency over the voice's length. */
  to?: number;
  q?: number;
};
type Shape = {
  gain?: number;
  /** Seconds to reach the peak (default 5 ms). */
  attack?: number;
  /** Seconds held at the peak before the decay. */
  hold?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
  filter?: FilterShape;
};
export type ToneShape = Shape & {
  type?: Wave;
  /** Glide the pitch to this frequency. */
  to?: number;
  /** Seconds the glide takes (the whole voice by default). */
  glide?: number;
  detune?: number;
  /** [rate in Hz, depth in cents]. */
  vibrato?: [number, number];
  /** Soft saturation: 0 is clean, 4 is a growl. */
  drive?: number;
  /** [rate in Hz, depth 0–0.5]: amplitude flutter. */
  tremolo?: [number, number];
};
export type NoiseShape = Shape & {
  color?: 'white' | 'pink' | 'brown';
  tremolo?: [number, number];
};
export type FmShape = Shape & {
  /** Modulator frequency as a multiple of the carrier's. */
  ratio?: number;
  /** Modulation depth at the start, as a multiple of the modulator. */
  index?: number;
  /** Depth at the end; a falling index is a struck, darkening tone. */
  indexTo?: number;
  type?: Wave;
  to?: number;
};
/** [frequency ratio, relative gain, relative decay]. */
export type Partial = [number, number, number];
export type BellShape = Shape & { partials?: Partial[]; type?: Wave };
export type PluckShape = Shape & {
  /** 0 dull to 1 bright: how much of the excitation's top end survives. */
  bright?: number;
};

export const NOTE = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const QUIET = 0.0001;

type Shared = {
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  curves: Map<number, Float32Array<ArrayBuffer>>;
  plucks: Map<string, AudioBuffer>;
};
const shared = new WeakMap<BaseAudioContext, Shared>();

function noiseBuffers(ctx: BaseAudioContext): Shared {
  let s = shared.get(ctx);
  if (s) return s;
  const length = ctx.sampleRate * 2;
  const make = (fill: (data: Float32Array) => void) => {
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    fill(buffer.getChannelData(0));
    return buffer;
  };
  s = {
    white: make((d) => {
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }),
    // Paul Kellet's economical pink filter.
    pink: make((d) => {
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }),
    brown: make((d) => {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
    }),
    curves: new Map(),
    plucks: new Map(),
  };
  shared.set(ctx, s);
  return s;
}

function driveCurve(s: Shared, drive: number) {
  const k = Math.round(drive * 10) / 10;
  let curve = s.curves.get(k);
  if (!curve) {
    curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    s.curves.set(k, curve);
  }
  return curve;
}

/** Karplus–Strong: a burst of noise fed round a delay the length of one
 *  period, softened on every pass. Cached per pitch, so repeats are free. */
function pluckBuffer(
  ctx: BaseAudioContext,
  s: Shared,
  freq: number,
  len: number,
  bright: number,
) {
  const key = `${Math.round(freq * 2) / 2}:${len.toFixed(2)}:${bright.toFixed(2)}`;
  let buffer = s.plucks.get(key);
  if (buffer) return buffer;
  const rate = ctx.sampleRate;
  const period = Math.max(2, Math.round(rate / freq));
  const total = Math.ceil(len * rate);
  buffer = ctx.createBuffer(1, total, rate);
  const d = buffer.getChannelData(0);
  const ring = new Float32Array(period);
  let smooth = 0;
  for (let i = 0; i < period; i++) {
    smooth += (Math.random() * 2 - 1 - smooth) * (0.25 + bright * 0.75);
    ring[i] = smooth;
  }
  // Longer notes keep more of each pass; low strings ring longer anyway.
  const keep = Math.min(0.9995, 0.996 + 0.0035 * Math.min(1, len / 2));
  let index = 0;
  for (let i = 0; i < total; i++) {
    const next = (index + 1) % period;
    const value = ring[index];
    d[i] = value;
    ring[index] = keep * 0.5 * (value + ring[next]);
    index = next;
  }
  if (s.plucks.size > 96) s.plucks.delete(s.plucks.keys().next().value!);
  s.plucks.set(key, buffer);
  return buffer;
}

export class Synth {
  readonly ctx: BaseAudioContext;
  /** Where every voice of the cue goes. */
  readonly out: AudioNode;
  /** The cue's start, in context time. */
  readonly t: number;
  readonly pitch: number;
  /** The latest moment anything in this cue is still sounding. */
  end: number;
  private readonly shared: Shared;
  private readonly nyquist: number;

  constructor(ctx: BaseAudioContext, out: AudioNode, t: number, pitch = 1) {
    this.ctx = ctx;
    this.out = out;
    this.t = t;
    this.pitch = pitch;
    this.end = t;
    this.shared = noiseBuffers(ctx);
    this.nyquist = ctx.sampleRate / 2 - 200;
  }

  private hz(freq: number) {
    return Math.max(20, Math.min(this.nyquist, freq * this.pitch));
  }

  /** gain → (pan) → out, with an attack, an optional hold, and a decay. */
  private amp(start: number, len: number, o: Shape) {
    const g = this.ctx.createGain();
    const peak = o.gain ?? 0.3;
    const attack = Math.min(o.attack ?? 0.005, len * 0.9);
    const hold = Math.min(o.hold ?? 0, Math.max(0, len - attack - 0.01));
    // Silent until it starts: a gain's default is 1.
    g.gain.value = 0;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    if (hold) g.gain.setValueAtTime(peak, start + attack + hold);
    g.gain.exponentialRampToValueAtTime(QUIET, start + len);
    if (o.pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p).connect(this.out);
    } else g.connect(this.out);
    this.end = Math.max(this.end, start + len + 0.05);
    return g;
  }

  private filtered(
    input: AudioNode,
    start: number,
    len: number,
    f?: FilterShape,
  ) {
    if (!f) return input;
    const node = this.ctx.createBiquadFilter();
    node.type = f.type ?? 'lowpass';
    // Start from the cutoff rather than jumping to it from the default 350 Hz:
    // a high-pass that jumps mid-block can spike to full scale.
    node.frequency.value = this.hz(f.freq);
    node.frequency.setValueAtTime(this.hz(f.freq), start);
    if (f.to)
      node.frequency.exponentialRampToValueAtTime(this.hz(f.to), start + len);
    node.Q.value = f.q ?? 0.7;
    input.connect(node);
    return node;
  }

  private flutter(
    input: AudioNode,
    start: number,
    len: number,
    tremolo?: [number, number],
  ) {
    if (!tremolo) return input;
    const [rate, depth] = tremolo;
    const trem = this.ctx.createGain();
    trem.gain.value = 1 - depth;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rate;
    const amount = this.ctx.createGain();
    amount.gain.value = depth;
    lfo.connect(amount).connect(trem.gain);
    lfo.start(start);
    lfo.stop(start + len + 0.05);
    input.connect(trem);
    return trem;
  }

  /** One oscillator voice. */
  tone(freq: number, at: number, len: number, o: ToneShape = {}) {
    const start = this.t + at;
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(this.hz(freq), start);
    if (o.to)
      osc.frequency.exponentialRampToValueAtTime(
        this.hz(o.to),
        start + (o.glide ?? len),
      );
    if (o.detune) osc.detune.value = o.detune;
    if (o.vibrato) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = o.vibrato[0];
      const depth = this.ctx.createGain();
      depth.gain.value = o.vibrato[1];
      lfo.connect(depth).connect(osc.detune);
      lfo.start(start);
      lfo.stop(start + len + 0.05);
    }
    let node: AudioNode = osc;
    if (o.drive) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = driveCurve(this.shared, o.drive);
      node.connect(shaper);
      node = shaper;
    }
    node = this.filtered(node, start, len, o.filter);
    node = this.flutter(node, start, len, o.tremolo);
    node.connect(this.amp(start, len, o));
    osc.start(start);
    osc.stop(start + len + 0.05);
  }

  /** Filtered noise: rustles, hisses, whooshes, thuds. */
  noise(at: number, len: number, o: NoiseShape = {}) {
    const start = this.t + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.shared[o.color ?? 'white'];
    src.loop = true;
    let node: AudioNode = this.filtered(
      src,
      start,
      len,
      o.filter ?? { type: 'bandpass', freq: 3000, q: 0.8 },
    );
    node = this.flutter(node, start, len, o.tremolo);
    node.connect(this.amp(start, len, o));
    src.start(start, Math.random() * 1.5);
    src.stop(start + len + 0.05);
  }

  /** Two-operator FM: bells, metal, electric pianos, lasers. */
  fm(freq: number, at: number, len: number, o: FmShape = {}) {
    const start = this.t + at;
    const carrier = this.ctx.createOscillator();
    carrier.type = o.type ?? 'sine';
    const mod = this.ctx.createOscillator();
    const ratio = o.ratio ?? 2;
    const f = this.hz(freq);
    carrier.frequency.setValueAtTime(f, start);
    mod.frequency.setValueAtTime(Math.min(this.nyquist, f * ratio), start);
    if (o.to) {
      const to = this.hz(o.to);
      carrier.frequency.exponentialRampToValueAtTime(to, start + len);
      mod.frequency.exponentialRampToValueAtTime(
        Math.min(this.nyquist, to * ratio),
        start + len,
      );
    }
    const depth = this.ctx.createGain();
    const from = Math.max(QUIET, (o.index ?? 2) * f * ratio);
    depth.gain.setValueAtTime(from, start);
    depth.gain.exponentialRampToValueAtTime(
      Math.max(QUIET, (o.indexTo ?? 0.05) * f * ratio),
      start + len,
    );
    mod.connect(depth).connect(carrier.frequency);
    this.filtered(carrier, start, len, o.filter).connect(
      this.amp(start, len, o),
    );
    mod.start(start);
    carrier.start(start);
    mod.stop(start + len + 0.05);
    carrier.stop(start + len + 0.05);
  }

  /** A struck bar or bell: partials that each fade at their own pace. */
  bell(freq: number, at: number, len: number, o: BellShape = {}) {
    const partials = o.partials ?? [
      [1, 1, 1],
      [2.76, 0.4, 0.55],
      [5.4, 0.18, 0.3],
      [8.93, 0.08, 0.18],
    ];
    const gain = o.gain ?? 0.2;
    for (const [ratio, level, decay] of partials) {
      if (freq * ratio * this.pitch >= this.nyquist) continue;
      this.tone(freq * ratio, at, Math.max(0.03, len * decay), {
        type: o.type ?? 'sine',
        gain: gain * level,
        attack: o.attack ?? 0.002,
        pan: o.pan,
      });
    }
  }

  /** A plucked string. */
  pluck(freq: number, at: number, len: number, o: PluckShape = {}) {
    const start = this.t + at;
    const src = this.ctx.createBufferSource();
    src.buffer = pluckBuffer(
      this.ctx,
      this.shared,
      this.hz(freq),
      len,
      o.bright ?? 0.6,
    );
    this.filtered(src, start, len, o.filter).connect(
      this.amp(start, len, { ...o, attack: o.attack ?? 0.001 }),
    );
    src.start(start);
    src.stop(start + len + 0.05);
  }

  /** A drum-like knock: a sine dropping fast from `from`×freq to freq. */
  thump(
    freq: number,
    at: number,
    len: number,
    o: Shape & { from?: number; type?: Wave } = {},
  ) {
    this.tone(freq * (o.from ?? 2.5), at, len, {
      ...o,
      to: freq,
      glide: Math.min(len, 0.06),
      attack: o.attack ?? 0.002,
    });
  }

  /** A short, bright transient. */
  click(at: number, o: Shape & { freq?: number } = {}) {
    this.noise(at, 0.018, {
      gain: o.gain ?? 0.2,
      attack: 0.001,
      pan: o.pan,
      filter: { type: 'highpass', freq: o.freq ?? 3000, q: 0.7 },
    });
  }
}

/** A stereo room: decaying noise, darker as it fades, with a few early
 *  reflections. `seconds` sets its size. */
export function roomImpulse(
  ctx: BaseAudioContext,
  seconds: number,
  darkness = 0.6,
) {
  const rate = ctx.sampleRate;
  const length = Math.ceil(seconds * rate);
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const env = Math.exp((-6.9 * t) / seconds);
      const coeff = 0.9 - darkness * 0.8 * Math.min(1, t / seconds);
      low += (Math.random() * 2 - 1 - low) * coeff;
      d[i] = low * env * 0.5;
    }
    for (const [ms, level] of [
      [7 + ch * 3, 0.5],
      [13 + ch * 2, 0.35],
      [23 - ch * 4, 0.25],
    ])
      d[Math.round((ms / 1000) * rate)] += level;
  }
  return ir;
}
