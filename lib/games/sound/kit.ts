import { NOTE, type Partial, type Synth } from './synth.ts';

/** Small instrument gestures several books draw with. Each game still
 *  chooses its own notes, timbres and rooms. */

export const GLASS: Partial[] = [
  [1, 1, 1],
  [2.01, 0.3, 0.5],
  [3.02, 0.1, 0.3],
];
export const MARIMBA: Partial[] = [
  [1, 1, 1],
  [3.93, 0.3, 0.3],
  [10.6, 0.06, 0.1],
];
export const XYLOPHONE: Partial[] = [
  [1, 1, 1],
  [3, 0.35, 0.22],
  [6, 0.1, 0.1],
];
export const CELESTA: Partial[] = [
  [1, 1, 1],
  [2, 0.35, 0.45],
  [4, 0.1, 0.2],
];
/** A brass ship's or hand bell: a minor third above the hum. */
export const BRASS_BELL: Partial[] = [
  [0.5, 0.35, 1],
  [1, 1, 0.9],
  [1.19, 0.45, 0.6],
  [1.5, 0.3, 0.5],
  [2, 0.35, 0.45],
  [2.74, 0.12, 0.3],
  [4.1, 0.06, 0.2],
];
export const PORCELAIN: Partial[] = [
  [1, 1, 1],
  [1.58, 0.55, 0.7],
  [2.72, 0.35, 0.45],
  [4.1, 0.18, 0.25],
];
export const COIN: Partial[] = [
  [1, 1, 1],
  [2.32, 0.6, 0.6],
  [3.86, 0.35, 0.4],
  [5.1, 0.15, 0.25],
];

/** A swept band of noise: air moving past. */
export function whoosh(
  s: Synth,
  at: number,
  len: number,
  from: number,
  to: number,
  gain = 0.2,
  pan = 0,
) {
  s.noise(at, len, {
    gain,
    attack: len * 0.45,
    pan,
    filter: { type: 'bandpass', freq: from, to, q: 1.1 },
  });
}

/** A soft cartoon puff of dust. */
export function poof(s: Synth, at: number, gain = 0.22) {
  s.noise(at, 0.3, {
    color: 'pink',
    gain,
    attack: 0.008,
    filter: { type: 'lowpass', freq: 2400, to: 260 },
  });
}

/** A brass section chord: two detuned saws per note through a filter that
 *  opens on the attack. */
export function brass(
  s: Synth,
  notes: number[],
  at: number,
  len: number,
  gain = 0.06,
  bright = 2600,
) {
  for (const n of notes)
    for (const detune of [-7, 7])
      s.tone(NOTE(n), at, len, {
        type: 'sawtooth',
        gain,
        detune,
        attack: 0.025,
        hold: len * 0.45,
        filter: { type: 'lowpass', freq: bright, to: bright * 0.35, q: 0.9 },
      });
}

/** A reed chord (accordion, concertina): beating saws with bellows swell. */
export function reeds(
  s: Synth,
  notes: number[],
  at: number,
  len: number,
  gain = 0.045,
) {
  for (const n of notes)
    for (const detune of [-11, 9])
      s.tone(NOTE(n), at, len, {
        type: 'sawtooth',
        gain,
        detune,
        attack: 0.07,
        hold: len * 0.55,
        tremolo: [5.5, 0.12],
        filter: { type: 'lowpass', freq: 1700, q: 0.6 },
      });
}

/** A breathy wooden flute note. */
export function flute(
  s: Synth,
  n: number,
  at: number,
  len: number,
  gain = 0.14,
) {
  s.tone(NOTE(n), at, len, {
    gain,
    attack: 0.045,
    hold: len * 0.45,
    vibrato: [5.2, 11],
  });
  s.tone(NOTE(n) * 2, at, len * 0.8, { gain: gain * 0.12, attack: 0.06 });
  s.noise(at, len * 0.55, {
    gain: gain * 0.2,
    attack: 0.03,
    filter: { type: 'bandpass', freq: NOTE(n) * 2, q: 4 },
  });
}

/** An electric piano note (a tine struck by a hammer). */
export function epiano(
  s: Synth,
  n: number,
  at: number,
  len: number,
  gain = 0.12,
  pan = 0,
) {
  s.fm(NOTE(n), at, len, { ratio: 1, index: 1.5, indexTo: 0.08, gain, pan });
  s.fm(NOTE(n), at, len * 0.25, {
    ratio: 14,
    index: 0.4,
    indexTo: 0.01,
    gain: gain * 0.25,
    pan,
  });
}

/** A bird's quick upward chirp. */
export function chirp(
  s: Synth,
  at: number,
  from: number,
  to: number,
  gain = 0.04,
  pan = 0,
) {
  s.tone(from, at, 0.06, { gain, to, attack: 0.008, pan });
}

/** A short, dry wooden knock. */
export function woodblock(
  s: Synth,
  freq: number,
  at: number,
  gain = 0.16,
  pan = 0,
) {
  s.tone(freq, at, 0.06, { type: 'triangle', gain, pan, attack: 0.001 });
  s.tone(freq * 2.48, at, 0.025, { gain: gain * 0.3, pan, attack: 0.001 });
  s.click(at, { gain: gain * 0.35, freq: freq * 2, pan });
}

/** A metal strike: FM with an inharmonic ratio. */
export function clank(
  s: Synth,
  freq: number,
  at: number,
  len: number,
  gain = 0.08,
  pan = 0,
) {
  s.fm(freq, at, len, { ratio: 1.41, index: 3.5, indexTo: 0.2, gain, pan });
  s.click(at, { gain: gain * 0.8, freq: 2500, pan });
}

/** An explosion: a falling thump, a burst of rumbling noise and debris. */
export function blast(s: Synth, at: number, size = 1) {
  s.thump(48, at, 0.45 * size, { gain: 0.5, from: 3 });
  s.noise(at, 0.7 * size, {
    color: 'brown',
    gain: 0.5,
    attack: 0.004,
    filter: { type: 'lowpass', freq: 2600, to: 220 },
  });
  s.noise(at, 0.18, {
    gain: 0.22,
    attack: 0.002,
    filter: { type: 'bandpass', freq: 1800, to: 500, q: 0.7 },
  });
  for (let i = 0; i < 5 * size; i++)
    s.noise(at + 0.08 + Math.random() * 0.45 * size, 0.03, {
      gain: 0.05 + Math.random() * 0.05,
      pan: Math.random() * 0.8 - 0.4,
      filter: { type: 'bandpass', freq: 1500 + Math.random() * 2500, q: 1.5 },
    });
}

/** A coin's ring, at a slightly different pitch each time. */
export function coin(s: Synth, at: number, freq = 2300, gain = 0.09, pan = 0) {
  s.bell(freq, at, 0.3, { gain, partials: COIN, pan });
}
