import type { SoundBook } from '../cues.ts';
import { chirp, flute } from '../kit.ts';

/** Mora: paper creatures, moss and leaves, a wooden flute and birdsong. */
export const mora: SoundBook = {
  id: 'mora',
  name: 'Mora',
  material: 'Paper, moss & woodland',
  space: 'room',
  wet: 0.1,
  cues: {
    pickup: {
      label: 'Lift a paper creature',
      loud: -36,
      play(s) {
        s.noise(0, 0.07, {
          gain: 0.2,
          filter: { type: 'bandpass', freq: 3800, to: 6500, q: 1.6 },
          tremolo: [60, 0.4],
        });
        s.noise(0.02, 0.04, {
          gain: 0.07,
          filter: { type: 'highpass', freq: 7000 },
        });
      },
    },
    place: {
      label: 'Set it down on moss',
      loud: -33,
      play(s) {
        s.noise(0, 0.11, {
          color: 'pink',
          gain: 0.32,
          filter: { type: 'lowpass', freq: 900, to: 280 },
        });
        s.tone(540, 0.004, 0.1, { gain: 0.12, to: 470 });
        s.tone(1620, 0.004, 0.03, { gain: 0.025 });
      },
    },
    drop: {
      label: 'Tidy your hand',
      loud: -37,
      play(s) {
        s.noise(0, 0.045, {
          gain: 0.15,
          filter: { type: 'bandpass', freq: 5200, q: 2 },
        });
      },
    },
    shuffle: {
      label: 'A breeze through the leaves',
      loud: -32,
      play(s) {
        s.noise(0, 0.75, {
          color: 'pink',
          gain: 0.25,
          attack: 0.28,
          filter: { type: 'bandpass', freq: 700, to: 2600, q: 0.6 },
          tremolo: [11, 0.35],
        });
        chirp(s, 0.5, 2900, 4100, 0.05, 0.3);
        chirp(s, 0.6, 3100, 4300, 0.04, 0.35);
      },
    },
    scores: {
      label: 'Wooden flute and birdsong',
      loud: -30,
      play(s) {
        const phrase: [number, number, number][] = [
          [74, 0, 0.2],
          [76, 0.18, 0.2],
          [79, 0.36, 0.32],
          [83, 0.66, 0.22],
          [81, 0.86, 0.22],
          [79, 1.06, 0.8],
        ];
        for (const [n, at, len] of phrase) flute(s, n, at, len);
        chirp(s, 1.42, 3400, 4600, 0.035, 0.45);
        chirp(s, 1.52, 3600, 4800, 0.03, 0.45);
        for (let i = 0; i < 5; i++)
          chirp(s, 1.7 + i * 0.05, 4200, 4700, 0.022, -0.4);
      },
    },
  },
};
