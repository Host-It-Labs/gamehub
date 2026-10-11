import type { SoundBook } from '../cues.ts';
import { NOTE } from '../synth.ts';

/** Impostor: an evidence wall at night. A pencil, pins in cork, vibraphone
 *  and an upright bass, a muted trumpet when the case closes. */
const VIBES: [number, number, number][] = [
  [1, 1, 1],
  [4, 0.12, 0.3],
];

export const impostor: SoundBook = {
  id: 'impostor',
  name: 'Impostor',
  material: 'Pencil, cork & late-night jazz',
  space: 'room',
  wet: 0.26,
  cues: {
    select: {
      label: 'Pencil stroke',
      loud: -36,
      play(s) {
        s.noise(0, 0.06, {
          gain: 0.14,
          attack: 0.01,
          filter: { type: 'bandpass', freq: 3200, to: 2400, q: 2.2 },
        });
      },
    },
    move: {
      label: 'Pin it to the wall',
      loud: -33,
      play(s) {
        s.noise(0, 0.07, {
          color: 'pink',
          gain: 0.25,
          filter: { type: 'lowpass', freq: 700 },
        });
        s.thump(200, 0, 0.07, { gain: 0.12 });
        s.tone(4200, 0, 0.03, { gain: 0.03 });
      },
    },
    reveal: {
      label: 'Vibraphone and bass',
      loud: -31,
      play(s) {
        s.pluck(NOTE(38), 0, 1.1, { gain: 0.45, bright: 0.3 });
        [62, 65, 69, 72, 76].forEach((n, i) =>
          s.bell(NOTE(n), 0.02 + i * 0.03, 1.5, {
            gain: 0.07,
            partials: VIBES,
            pan: (i - 2) * 0.12,
          }),
        );
        s.tone(NOTE(76), 0.14, 1.3, { gain: 0.02, tremolo: [5.5, 0.4] });
      },
    },
    scores: {
      label: 'The case closes',
      loud: -30,
      play(s) {
        [38, 41, 45, 50].forEach((n, i) =>
          s.pluck(NOTE(n), i * 0.22, 0.7, { gain: 0.4, bright: 0.3 }),
        );
        [69, 65, 74].forEach((n, i) =>
          s.tone(NOTE(n), 0.1 + i * 0.3, i === 2 ? 0.95 : 0.32, {
            type: 'sawtooth',
            gain: 0.05,
            attack: 0.03,
            hold: 0.12,
            vibrato: [5, 10],
            filter: { type: 'bandpass', freq: 900, to: 1900, q: 3 },
          }),
        );
        [62, 65, 69, 72, 76].forEach((n, i) =>
          s.bell(NOTE(n), 0.9 + i * 0.03, 1.6, { gain: 0.06, partials: VIBES }),
        );
      },
    },
  },
};
