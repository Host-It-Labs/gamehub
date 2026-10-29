import type { SoundBook } from '../cues.ts';
import { NOTE } from '../synth.ts';

/** Metro: a tiled station hall. Glazed tiles tapped and turned over, a
 *  brush of paint, the two-tone station chime, a train going through. */
export const metro: SoundBook = {
  id: 'metro',
  name: 'Metro',
  material: 'Glazed tiles, station chimes & passing trains',
  space: 'hall',
  wet: 0.22,
  cues: {
    select: {
      label: 'Tap a tile',
      loud: -35,
      play(s) {
        s.bell(NOTE(91), 0, 0.12, {
          gain: 0.07,
          partials: [
            [1, 1, 0.12],
            [2.76, 0.4, 0.06],
          ],
        });
        s.click(0, { gain: 0.07, freq: 3200 });
      },
    },
    place: {
      label: 'Paint a section',
      loud: -33,
      play(s) {
        s.noise(0, 0.22, {
          gain: 0.16,
          attack: 0.03,
          filter: { type: 'bandpass', freq: 1800, to: 3600, q: 1.2 },
        });
        s.bell(NOTE(67), 0.16, 0.3, {
          gain: 0.1,
          partials: [
            [1, 1, 0.3],
            [2.4, 0.3, 0.12],
          ],
        });
        s.thump(160, 0.16, 0.08, { gain: 0.12 });
      },
    },
    flip: {
      label: 'The next card',
      loud: -32,
      play(s) {
        s.noise(0, 0.12, {
          gain: 0.08,
          attack: 0.04,
          filter: { type: 'highpass', freq: 2500 },
        });
        s.click(0.13, { gain: 0.14, freq: 1900 });
        s.thump(210, 0.13, 0.07, { gain: 0.16 });
        s.bell(NOTE(84), 0.13, 0.18, {
          gain: 0.045,
          partials: [
            [1, 1, 0.18],
            [3.1, 0.25, 0.07],
          ],
        });
      },
    },
    invalid: {
      label: 'No way through',
      loud: -34,
      play(s) {
        s.tone(220, 0, 0.11, {
          type: 'triangle',
          gain: 0.1,
          filter: { type: 'lowpass', freq: 900 },
        });
        s.tone(185, 0.1, 0.18, {
          type: 'triangle',
          gain: 0.1,
          filter: { type: 'lowpass', freq: 800 },
        });
      },
    },
    join: {
      label: 'Station chime',
      loud: -30,
      play(s) {
        s.bell(NOTE(79), 0, 1.1, { gain: 0.14 });
        s.bell(NOTE(74), 0.42, 1.4, { gain: 0.14 });
      },
    },
    round: {
      label: 'A train goes through',
      loud: -31,
      play(s) {
        s.noise(0, 1.6, {
          gain: 0.16,
          attack: 0.55,
          hold: 0.3,
          filter: { type: 'lowpass', freq: 500, to: 2400, q: 0.8 },
        });
        [0.32, 0.46, 0.78, 0.92, 1.24, 1.38].forEach((at, i) =>
          s.thump(i % 2 ? 120 : 140, at, 0.06, { gain: 0.22 - Math.abs(i - 2.5) * 0.04 }),
        );
      },
    },
    scores: {
      label: 'Last train',
      loud: -30,
      play(s) {
        [72, 76, 79, 84].forEach((n, i) => s.bell(NOTE(n), i * 0.26, 1.6, { gain: 0.12 }));
      },
    },
  },
};
