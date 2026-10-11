import type { SoundBook } from '../cues.ts';
import { BRASS_BELL, reeds } from '../kit.ts';
import { NOTE } from '../synth.ts';

/** Nox: cards on a ship's timber table, a brass bell, a concertina. */
export const nox: SoundBook = {
  id: 'nox',
  name: 'Nox',
  material: 'Cards, ship’s timber & brass',
  space: 'room',
  wet: 0.14,
  cues: {
    pickup: {
      label: 'Lift a card',
      loud: -35,
      play(s) {
        s.noise(0, 0.07, {
          gain: 0.25,
          attack: 0.004,
          filter: { type: 'bandpass', freq: 2400, to: 5200, q: 1.1 },
        });
        s.noise(0.012, 0.035, {
          gain: 0.1,
          filter: { type: 'highpass', freq: 6000 },
        });
      },
    },
    place: {
      label: 'Play a card',
      loud: -33,
      play(s) {
        s.noise(0, 0.09, {
          gain: 0.35,
          attack: 0.002,
          filter: { type: 'bandpass', freq: 1800, to: 500, q: 0.9 },
        });
        s.thump(118, 0, 0.16, { gain: 0.3, from: 1.8 });
        s.tone(236, 0.004, 0.08, { type: 'triangle', gain: 0.06 });
      },
    },
    drop: {
      label: 'Tuck a card in your hand',
      loud: -36,
      play(s) {
        s.noise(0, 0.05, {
          gain: 0.18,
          filter: { type: 'bandpass', freq: 3200, to: 1800, q: 1 },
        });
        s.click(0.02, { gain: 0.05, freq: 4000 });
      },
    },
    shuffle: {
      label: 'Riffle the deck',
      loud: -32,
      play(s) {
        let t = 0.02;
        for (let i = 0; i < 18; i++) {
          s.noise(t, 0.022, {
            gain: 0.1 + Math.random() * 0.08,
            pan: -0.35 + (i / 17) * 0.7,
            filter: {
              type: 'bandpass',
              freq: 2600 + Math.random() * 1800,
              q: 1.4,
            },
          });
          t += 0.026 - i * 0.0006;
        }
        s.noise(t + 0.02, 0.2, {
          gain: 0.12,
          attack: 0.05,
          filter: { type: 'bandpass', freq: 2200, to: 3800, q: 0.8 },
        });
        s.thump(130, t + 0.3, 0.1, { gain: 0.2 });
        s.thump(130, t + 0.42, 0.1, { gain: 0.15 });
      },
    },
    scores: {
      label: 'Ship’s bell and a shanty close',
      loud: -30,
      play(s) {
        s.bell(NOTE(78), 0, 1.6, { gain: 0.16, partials: BRASS_BELL });
        s.bell(NOTE(78), 0.3, 1.9, { gain: 0.13, partials: BRASS_BELL });
        reeds(s, [55, 59, 62], 0.62, 0.42);
        reeds(s, [50, 57, 62, 66], 1.02, 1.25);
        s.tone(NOTE(38), 1.02, 1.2, {
          type: 'triangle',
          gain: 0.12,
          attack: 0.04,
        });
      },
    },
  },
};
