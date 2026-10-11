import type { SoundBook } from '../cues.ts';
import { MARIMBA, woodblock, XYLOPHONE } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** Quiz: a measuring desk. Steel rulers, enamel stamps, a tape measure and
 *  a xylophone. Sizes slides a ruler, Years turns calendar pages, Order
 *  slides wooden tiles. */
export const quiz: SoundBook = {
  id: 'quiz',
  name: 'Quiz',
  material: 'Rulers, enamel & xylophone',
  space: 'room',
  wet: 0.12,
  cues: {
    select: {
      label: 'Ruler tick',
      loud: -36,
      play(s) {
        s.tone(3200, 0, 0.045, { type: 'triangle', gain: 0.08 });
        s.noise(0, 0.025, {
          gain: 0.1,
          filter: { type: 'bandpass', freq: 5200, q: 2 },
        });
      },
    },
    move: {
      label: 'Enamel stamp',
      loud: -33,
      play(s) {
        s.thump(180, 0, 0.1, { gain: 0.28 });
        s.noise(0, 0.05, {
          gain: 0.14,
          filter: { type: 'bandpass', freq: 1400, q: 1 },
        });
        s.fm(1900, 0.01, 0.2, {
          ratio: 1.41,
          index: 2,
          indexTo: 0.1,
          gain: 0.04,
        });
      },
    },
    reveal: {
      label: 'Tape measure and a ding',
      loud: -31,
      play(s) {
        s.noise(0, 0.32, {
          gain: 0.12,
          attack: 0.02,
          filter: { type: 'bandpass', freq: 1500, to: 4200, q: 2 },
          tremolo: [38, 0.45],
        });
        s.bell(NOTE(84), 0.34, 0.7, { gain: 0.18, partials: MARIMBA });
      },
    },
    scores: {
      label: 'Xylophone run',
      loud: -30,
      play(s) {
        [72, 74, 76, 79, 81, 84, 86, 88].forEach((n, i) =>
          s.bell(NOTE(n), i * 0.06, 0.5, {
            gain: 0.12,
            partials: XYLOPHONE,
            pan: (i - 3.5) * 0.08,
          }),
        );
        [84, 88, 91, 96].forEach((n, i) =>
          s.bell(NOTE(n), 0.56 + i * 0.012, 1.4, {
            gain: 0.09,
            partials: MARIMBA,
          }),
        );
      },
    },
    'miro:select': {
      label: 'Atlas · push in a map pin',
      loud: -36,
      play(s) {
        s.noise(0, 0.05, {
          color: 'pink',
          gain: 0.18,
          filter: { type: 'lowpass', freq: 900 },
        });
        s.tone(3600, 0.005, 0.035, { type: 'triangle', gain: 0.05 });
      },
    },
    'size:select': {
      label: 'Sizes · slide the ruler',
      loud: -36,
      play(s) {
        s.noise(0, 0.12, {
          gain: 0.12,
          attack: 0.03,
          filter: { type: 'bandpass', freq: 2600, to: 3600, q: 3 },
        });
        s.tone(3400, 0.1, 0.04, { type: 'triangle', gain: 0.06 });
      },
    },
    'year:select': {
      label: 'Years · turn a calendar page',
      loud: -36,
      play(s) {
        s.noise(0, 0.15, {
          gain: 0.16,
          attack: 0.03,
          filter: { type: 'bandpass', freq: 1800, to: 4200, q: 0.9 },
        });
        s.click(0.13, { gain: 0.04, freq: 3000 });
      },
    },
    'order:select': {
      label: 'Order · slide a tile',
      loud: -36,
      play(s) {
        s.noise(0, 0.08, {
          gain: 0.08,
          filter: { type: 'lowpass', freq: 1600 },
        });
        woodblock(s, 820, 0.05, 0.15);
      },
    },
  },
};
