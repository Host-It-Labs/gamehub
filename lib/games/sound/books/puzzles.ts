import type { SoundBook } from '../cues.ts';
import { CELESTA } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** Puzzles: pages, a pencil, a rubber stamp and a celesta. Typing, cell
 *  edits and selection stay silent. */
export const puzzles: SoundBook = {
  id: 'puzzles',
  name: 'Puzzles',
  material: 'Pages, pencil, stamp & celesta',
  space: 'room',
  wet: 0.14,
  silent: ['tap', 'pickup', 'select', 'move'],
  cues: {
    submit: {
      label: 'Pencil check mark',
      loud: -33,
      play(s) {
        s.noise(0, 0.045, {
          gain: 0.15,
          filter: { type: 'bandpass', freq: 2600, to: 3400, q: 2.5 },
        });
        s.noise(0.06, 0.09, {
          gain: 0.17,
          attack: 0.01,
          filter: { type: 'bandpass', freq: 2400, to: 4200, q: 2.5 },
        });
      },
    },
    reward: {
      label: 'Stamp of approval',
      loud: -30,
      play(s) {
        s.thump(110, 0, 0.15, { gain: 0.35, from: 2 });
        s.noise(0, 0.06, {
          color: 'pink',
          gain: 0.25,
          filter: { type: 'lowpass', freq: 1200 },
        });
        [84, 88, 91].forEach((n, i) =>
          s.bell(NOTE(n), 0.12 + i * 0.08, 0.9, {
            gain: 0.12,
            partials: CELESTA,
          }),
        );
      },
    },
    invalid: {
      label: 'Not this time',
      loud: -33,
      play(s) {
        s.tone(330, 0, 0.14, { type: 'triangle', gain: 0.15, to: 300 });
        s.tone(247, 0.13, 0.26, { type: 'triangle', gain: 0.15, to: 220 });
      },
    },
    scores: {
      label: 'Pages and a celesta',
      loud: -30,
      play(s) {
        for (let i = 0; i < 3; i++)
          s.noise(i * 0.09, 0.12, {
            color: 'pink',
            gain: 0.16,
            attack: 0.03,
            pan: (i - 1) * 0.25,
            filter: { type: 'bandpass', freq: 1000, to: 3200, q: 0.8 },
          });
        [84, 88, 91, 96].forEach((n, i) =>
          s.bell(NOTE(n), 0.3 + i * 0.11, 0.8, {
            gain: 0.11,
            partials: CELESTA,
          }),
        );
        [79, 84, 88].forEach((n) =>
          s.bell(NOTE(n), 0.78, 1.5, { gain: 0.08, partials: CELESTA }),
        );
      },
    },
  },
};
