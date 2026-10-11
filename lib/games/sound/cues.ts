import { roomImpulse, Synth } from './synth.ts';
import levels from './levels.json' with { type: 'json' };

/** How much room a game's sounds ring in. */
export type Space = 'dry' | 'room' | 'hall';
export type CueOptions = { rare?: boolean; variant?: number };
export type Cue = {
  label: string;
  /** Loudness at full volume, in dBFS over the loudest 50 ms. `levels.json`
   *  holds the gain that brings the drawn sound there; refresh it with
   *  `node scripts/sound-levels.mjs` after changing a cue. */
  loud: number;
  play: (s: Synth, o: CueOptions) => void;
};
/** One game's sounds. Cues named `sub:kind` belong to one game of a set
 *  (Dial inside Know Me, Years inside Quiz) and win over the plain `kind`. */
export type SoundBook = {
  id: string;
  name: string;
  /** What it is made of, for the Sound Lab. */
  material: string;
  space: Space;
  /** How much of each cue is sent into the room. */
  wet: number;
  cues: Record<string, Cue>;
  /** Kinds this game keeps silent even when another kind would stand in. */
  silent?: string[];
};

/** Each cue's measured gain, and a fingerprint of the code it was measured
 *  from (`fingerprint.ts`), so a changed cue shows up as unmeasured. */
const gains = levels as Record<string, { gain: number; hash: string }>;
export const cueLevel = (book: string, cue: string) =>
  gains[`${book}:${cue}`]?.gain ?? 1;

type Bus = { master: GainNode };
const buses = new WeakMap<BaseAudioContext, Bus>();

/** One output per audio context, behind a gentle limiter. */
export function soundBus(ctx: BaseAudioContext) {
  let bus = buses.get(ctx);
  if (!bus) {
    const master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(ctx.destination);
    bus = { master };
    buses.set(ctx, bus);
  }
  return bus;
}

type Room = Exclude<Space, 'dry'>;
const impulses = new WeakMap<
  BaseAudioContext,
  Partial<Record<Room, AudioBuffer>>
>();
const rooms = new WeakMap<AudioNode, Partial<Record<Room, ConvolverNode>>>();

/** Build a room ahead of its first cue (the impulse takes a few ms). */
export function prepareRoom(
  ctx: BaseAudioContext,
  space: Space,
  dest?: AudioNode,
) {
  if (space !== 'dry') room(ctx, space, dest ?? soundBus(ctx).master);
}

/** Each output has its own rooms, so fading or muting that output silences
 *  the tails ringing in them too. The impulses are shared. */
function room(ctx: BaseAudioContext, space: Room, dest: AudioNode) {
  let built = rooms.get(dest);
  if (!built) rooms.set(dest, (built = {}));
  let node = built[space];
  if (!node) {
    let shapes = impulses.get(ctx);
    if (!shapes) impulses.set(ctx, (shapes = {}));
    node = ctx.createConvolver();
    node.buffer = shapes[space] ??=
      space === 'hall'
        ? roomImpulse(ctx, 2.6, 0.5)
        : roomImpulse(ctx, 0.7, 0.7);
    node.connect(dest);
    built[space] = node;
  }
  return node;
}

export type Render = {
  /** Its own gain, so it can be faded out on its own. */
  out: GainNode;
  /** When it has rung out, room included. */
  end: number;
  /** When its own voices stop (before the room's tail). */
  dry: number;
};

/** Draw one cue into the context, starting now (or `at`). */
export function renderCue(
  ctx: BaseAudioContext,
  book: SoundBook,
  name: string,
  o: {
    volume: number;
    at?: number;
    pan?: number;
    pitch?: number;
    rare?: boolean;
    variant?: number;
    /** The output the cue and its room ring into (a game's own bus);
     *  the shared output by default. */
    dest?: AudioNode;
  },
): Render | null {
  const cue = book.cues[name];
  if (!cue) return null;
  const at = o.at ?? ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = Math.max(0, o.volume) * cueLevel(book.id, name);
  const dest = o.dest ?? soundBus(ctx).master;
  if (o.pan) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, o.pan));
    out.connect(panner).connect(dest);
  } else out.connect(dest);
  let tail = 0;
  if (book.space !== 'dry' && book.wet > 0) {
    const send = ctx.createGain();
    send.gain.value = book.wet;
    out.connect(send).connect(room(ctx, book.space, dest));
    tail = book.space === 'hall' ? 2.6 : 0.7;
  }
  const synth = new Synth(ctx, out, at, o.pitch ?? 1);
  cue.play(synth, { rare: o.rare, variant: o.variant });
  return { out, end: synth.end + tail, dry: synth.end };
}

/** Peak and loudest 50 ms of a cue drawn offline at full volume, in dBFS. */
export async function measureCue(
  book: SoundBook,
  name: string,
  levelled = false,
) {
  const rate = 48000;
  const seconds = 5;
  const ctx = new OfflineAudioContext(2, rate * seconds, rate);
  const render = renderCue(ctx, book, name, {
    volume: levelled ? 1 : 1 / cueLevel(book.id, name),
    at: 0.02,
  });
  if (!render) return null;
  const buffer = await ctx.startRendering();
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const window = Math.round(rate * 0.05);
  let peak = 0,
    sum = 0,
    loudest = 0,
    last = 0;
  for (let i = 0; i < left.length; i++) {
    const v = (left[i] + right[i]) / 2;
    const a = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (a > peak) peak = a;
    if (a > 1e-4) last = i;
    sum += v * v;
    if (i >= window) sum -= ((left[i - window] + right[i - window]) / 2) ** 2;
    if (i >= window - 1) loudest = Math.max(loudest, sum / window);
  }
  const db = (x: number) =>
    Math.round(20 * Math.log10(Math.max(x, 1e-9)) * 10) / 10;
  return {
    peak: db(peak),
    loud: db(Math.sqrt(loudest)),
    seconds: Math.round((last / rate) * 100) / 100,
  };
}
