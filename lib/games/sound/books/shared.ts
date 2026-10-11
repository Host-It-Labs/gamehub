import type { SoundBook } from '../cues.ts';
import { GLASS } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** The one sound every game shares: it's your turn. Three rising glass
 *  chimes over a breath of air, the same everywhere so it is learnt once. */
export const shared: SoundBook = {
  id: 'shared',
  name: 'Every game',
  material: 'Glass chimes',
  space: 'room',
  wet: 0.22,
  cues: {
    turn: {
      label: 'Your turn',
      loud: -30,
      play(s) {
        s.noise(0, 0.32, {
          gain: 0.025,
          attack: 0.12,
          filter: { type: 'highpass', freq: 6500 },
        });
        s.bell(NOTE(79), 0, 0.9, { gain: 0.16, partials: GLASS, pan: -0.15 });
        s.bell(NOTE(84), 0.085, 0.95, { gain: 0.15, partials: GLASS });
        s.bell(NOTE(88), 0.17, 1.25, {
          gain: 0.16,
          partials: GLASS,
          pan: 0.15,
        });
        s.fm(NOTE(100), 0.17, 0.7, {
          ratio: 3.5,
          index: 0.8,
          indexTo: 0.02,
          gain: 0.015,
        });
      },
    },
  },
};
