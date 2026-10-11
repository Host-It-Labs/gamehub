import type { SoundBook } from '../cues.ts';
import { GLASS, PORCELAIN, woodblock } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** Yata: bamboo tags, porcelain on a counter, a koto and a wind chime. */
export const yata: SoundBook = {
  id: 'yata',
  name: 'Yata',
  material: 'Bamboo, porcelain & koto',
  space: 'room',
  wet: 0.16,
  cues: {
    pickup: {
      label: 'Lift a bamboo tag',
      loud: -35,
      play(s) {
        woodblock(s, 1180, 0, 0.18);
      },
    },
    place: {
      label: 'Set a dish on the counter',
      loud: -33,
      play(s) {
        s.bell(1720, 0, 0.34, { gain: 0.12, partials: PORCELAIN });
        s.noise(0, 0.03, {
          gain: 0.1,
          filter: { type: 'bandpass', freq: 4000, q: 1.5 },
        });
        s.thump(160, 0, 0.1, { gain: 0.15 });
      },
    },
    drop: {
      label: 'Chopstick tap',
      loud: -37,
      play(s) {
        woodblock(s, 1650, 0, 0.14);
      },
    },
    shuffle: {
      label: 'Menu slips and the noren',
      loud: -32,
      play(s) {
        for (let i = 0; i < 3; i++)
          s.noise(i * 0.11, 0.1, {
            gain: 0.14,
            pan: (i - 1) * 0.3,
            filter: {
              type: 'bandpass',
              freq: 2000 + i * 600,
              to: 3600 + i * 400,
              q: 1,
            },
          });
        woodblock(s, 1180, 0.38, 0.14);
        woodblock(s, 1320, 0.45, 0.12);
      },
    },
    scores: {
      label: 'Koto and a wind chime',
      loud: -30,
      play(s) {
        // Miyako-bushi on E: E F A B C.
        const phrase: [number, number, number][] = [
          [76, 0, 0.5],
          [72, 0.15, 0.5],
          [71, 0.3, 0.5],
          [69, 0.45, 0.6],
          [71, 0.62, 0.6],
          [64, 0.8, 1.6],
          [71, 0.82, 1.4],
          [76, 0.84, 1.3],
        ];
        for (const [n, at, len] of phrase)
          s.pluck(NOTE(n), at, len, {
            gain: 0.3,
            bright: 0.75,
            filter: { type: 'lowpass', freq: 3800 },
          });
        s.bell(2637, 1.2, 1.4, { gain: 0.04, partials: GLASS, pan: 0.4 });
        s.bell(3136, 1.36, 1.2, { gain: 0.03, partials: GLASS, pan: 0.3 });
      },
    },
  },
};
