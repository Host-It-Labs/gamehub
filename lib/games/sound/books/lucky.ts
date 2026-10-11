import type { SoundBook } from '../cues.ts';
import { BRASS_BELL, coin, GLASS, MARIMBA } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** Lucky: glass, coins, a marimba and an arcade cabinet, all tones with no
 *  hiss. The scratching itself follows the finger (`relic-scratch-audio.ts`). */
export const lucky: SoundBook = {
  id: 'lucky',
  name: 'Lucky',
  material: 'Foil, coins & marimba',
  space: 'room',
  wet: 0.12,
  cues: {
    reveal: {
      label: 'A symbol shows',
      loud: -34,
      play(s) {
        s.bell(2637, 0, 0.32, { gain: 0.12, partials: GLASS });
      },
    },
    star: {
      label: 'A star shows',
      loud: -31,
      play(s) {
        [88, 92, 95, 100].forEach((n, i) =>
          s.bell(NOTE(n), i * 0.05, 0.6, {
            gain: 0.1,
            partials: GLASS,
            pan: (i - 1.5) * 0.2,
          }),
        );
      },
    },
    prize: {
      label: 'The ticket pays',
      loud: -30,
      play(s) {
        for (let i = 0; i < 10; i++)
          coin(
            s,
            i * 0.045 + Math.random() * 0.02,
            1800 + Math.random() * 1200,
            0.07,
            Math.random() * 0.8 - 0.4,
          );
        s.bell(NOTE(91), 0.32, 0.9, { gain: 0.1, partials: BRASS_BELL });
        s.bell(NOTE(96), 0.4, 1.1, { gain: 0.1, partials: BRASS_BELL });
      },
    },
    buy: {
      label: 'A coin in the slot',
      loud: -33,
      play(s) {
        coin(s, 0, 2350, 0.09);
        s.thump(170, 0.1, 0.12, { gain: 0.22 });
        s.bell(NOTE(88), 0.16, 0.45, { gain: 0.07, partials: MARIMBA });
        s.bell(NOTE(93), 0.23, 0.55, { gain: 0.07, partials: MARIMBA });
      },
    },
    build: {
      label: 'Set a machine down',
      loud: -35,
      play(s) {
        s.bell(NOTE(79), 0, 0.26, { gain: 0.12, partials: MARIMBA });
        s.bell(NOTE(86), 0.06, 0.32, { gain: 0.09, partials: MARIMBA });
        s.thump(150, 0, 0.08, { gain: 0.12 });
      },
    },
    paper: {
      label: 'No luck this time',
      loud: -34,
      play(s) {
        s.bell(NOTE(76), 0, 0.4, { gain: 0.1, partials: MARIMBA });
        s.bell(NOTE(72), 0.14, 0.6, { gain: 0.1, partials: MARIMBA });
      },
    },
    upgrade: {
      label: 'Power up',
      loud: -31,
      play(s) {
        [72, 76, 79, 84, 88].forEach((n, i) =>
          s.tone(NOTE(n), i * 0.045, 0.13, {
            type: 'square',
            gain: 0.05,
            filter: { type: 'lowpass', freq: 3200 },
          }),
        );
        s.bell(NOTE(96), 0.23, 0.6, { gain: 0.08, partials: GLASS });
      },
    },
  },
};
