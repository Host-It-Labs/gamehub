import type { SoundBook } from '../cues.ts';
import { brass, clank, coin, epiano } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** Know Me: a warm retro studio set. Console buttons, an electric piano,
 *  a brass band for the big moments. Dial turns a real dial; Ten Coins
 *  handles coins. */
export const knowMe: SoundBook = {
  id: 'know-me',
  name: 'Know Me',
  material: 'Studio buttons, electric piano & brass',
  space: 'room',
  wet: 0.18,
  cues: {
    select: {
      label: 'Studio button',
      loud: -35,
      play(s) {
        epiano(s, 84, 0, 0.22, 0.16);
        s.click(0, { gain: 0.04, freq: 2000 });
      },
    },
    move: {
      label: 'Lock it in',
      loud: -33,
      play(s) {
        s.thump(150, 0, 0.09, { gain: 0.3 });
        s.click(0, { gain: 0.08, freq: 1500 });
        epiano(s, 72, 0.03, 0.25, 0.12);
        epiano(s, 79, 0.1, 0.34, 0.12);
      },
    },
    reveal: {
      label: 'The reveal',
      loud: -31,
      play(s) {
        s.noise(0, 0.42, {
          gain: 0.05,
          attack: 0.3,
          filter: { type: 'highpass', freq: 7000 },
        });
        [72, 76, 79, 84].forEach((n, i) =>
          epiano(s, n, i * 0.055, 0.4, 0.1, (i - 1.5) * 0.15),
        );
        brass(s, [72, 76, 79], 0.24, 0.45, 0.04);
      },
    },
    scores: {
      label: 'Game-show fanfare',
      loud: -30,
      play(s) {
        brass(s, [60, 64, 67], 0, 0.17, 0.045);
        brass(s, [60, 64, 67], 0.2, 0.17, 0.045);
        brass(s, [65, 69, 72], 0.4, 0.2, 0.045);
        brass(s, [67, 71, 74], 0.62, 0.22, 0.045);
        brass(s, [72, 76, 79, 84], 0.86, 1.05, 0.04, 3200);
        s.noise(0.86, 1.2, {
          gain: 0.08,
          attack: 0.004,
          filter: { type: 'highpass', freq: 5000 },
        });
        [84, 88, 91, 96].forEach((n, i) =>
          epiano(s, n, 1.0 + i * 0.07, 0.5, 0.06),
        );
      },
    },
    'dial:select': {
      label: 'Dial · turn the dial',
      loud: -36,
      play(s) {
        for (let i = 0; i < 4; i++)
          s.click(i * 0.028, { gain: 0.1, freq: 2600 - i * 150 });
        s.tone(900, 0, 0.05, { type: 'triangle', gain: 0.05 });
      },
    },
    'dial:move': {
      label: 'Dial · set the dial',
      loud: -33,
      play(s) {
        s.thump(140, 0, 0.1, { gain: 0.3 });
        clank(s, 620, 0, 0.12, 0.05);
        s.bell(NOTE(88), 0.06, 0.6, { gain: 0.08 });
      },
    },
    'coins:select': {
      label: 'Ten Coins · pick up a coin',
      loud: -35,
      play(s) {
        coin(s, 0, 2400, 0.1);
      },
    },
    'coins:move': {
      label: 'Ten Coins · drop the coins in',
      loud: -33,
      play(s) {
        for (let i = 0; i < 3; i++)
          coin(
            s,
            i * 0.05,
            2100 + i * 260 + Math.random() * 80,
            0.08,
            (i - 1) * 0.25,
          );
        s.thump(220, 0.12, 0.08, { gain: 0.1 });
      },
    },
  },
};
