import type { SoundBook } from '../cues.ts';
import { NOTE } from '../synth.ts';

/** Rota: a model railway mill town. Switch levers, wooden sleepers and
 *  steel rails, a steam whistle. */
export const rota: SoundBook = {
  id: 'rota',
  name: 'Rota',
  material: 'Sleepers, rails & steam',
  space: 'room',
  wet: 0.1,
  cues: {
    select: {
      label: 'Switch lever',
      loud: -35,
      play(s) {
        s.fm(620, 0, 0.13, { ratio: 1.41, index: 3, indexTo: 0.2, gain: 0.1 });
        s.click(0, { gain: 0.08, freq: 2500 });
        s.thump(180, 0.01, 0.06, { gain: 0.1 });
      },
    },
    place: {
      label: 'Lay a piece of track',
      loud: -33,
      play(s) {
        s.thump(105, 0, 0.18, { gain: 0.35 });
        s.noise(0, 0.05, {
          gain: 0.1,
          filter: { type: 'bandpass', freq: 900, q: 1 },
        });
        s.fm(1350, 0.012, 0.24, {
          ratio: 2.76,
          index: 2.5,
          indexTo: 0.1,
          gain: 0.07,
        });
      },
    },
    invalid: {
      label: 'Blocked',
      loud: -34,
      play(s) {
        s.tone(196, 0, 0.12, {
          type: 'square',
          gain: 0.06,
          filter: { type: 'lowpass', freq: 700 },
        });
        s.tone(165, 0.11, 0.2, {
          type: 'square',
          gain: 0.06,
          filter: { type: 'lowpass', freq: 600 },
        });
      },
    },
    scores: {
      label: 'Steam whistle',
      loud: -30,
      play(s) {
        for (const n of [74, 77, 81])
          s.tone(NOTE(n), 0, 1.15, {
            gain: 0.07,
            attack: 0.08,
            hold: 0.7,
            vibrato: [5, 8],
          });
        s.noise(0, 1.1, {
          gain: 0.05,
          attack: 0.08,
          hold: 0.6,
          filter: { type: 'bandpass', freq: 1300, q: 1.5 },
        });
        [1.15, 1.38, 1.58, 1.76].forEach((at, i) =>
          s.noise(at, 0.16, {
            gain: 0.22 - i * 0.04,
            attack: 0.01,
            filter: { type: 'lowpass', freq: 1500 },
          }),
        );
      },
    },
  },
};
