import type { SoundBook } from '../cues.ts';
import { NOTE } from '../synth.ts';

/** Alto: a ship's console in space. Soft blips, docking clamps, a sonar
 *  ping, a synth pad as the years end. */
export const alto: SoundBook = {
  id: 'alto',
  name: 'Alto',
  material: 'Console blips, docking clamps & synth pads',
  space: 'hall',
  wet: 0.3,
  cues: {
    select: {
      label: 'Console blip',
      loud: -35,
      play(s) {
        s.tone(880, 0, 0.08, { gain: 0.14, to: 1320, glide: 0.03 });
        s.fm(1760, 0.02, 0.1, { ratio: 2.5, index: 0.8, gain: 0.04 });
      },
    },
    place: {
      label: 'Dock a module',
      loud: -33,
      play(s) {
        s.thump(90, 0, 0.2, { gain: 0.3 });
        s.tone(180, 0.02, 0.25, {
          type: 'sawtooth',
          gain: 0.05,
          to: 420,
          filter: { type: 'lowpass', freq: 800, to: 1600 },
        });
        s.click(0.22, { gain: 0.06, freq: 2000 });
      },
    },
    move: {
      label: 'Sonar ping',
      loud: -31,
      play(s) {
        s.fm(NOTE(86), 0, 1.0, {
          ratio: 1,
          index: 0.4,
          indexTo: 0.02,
          gain: 0.12,
          to: NOTE(85),
        });
        s.tone(NOTE(98), 0, 0.3, { gain: 0.02 });
      },
    },
    scores: {
      label: 'Into orbit',
      loud: -30,
      play(s) {
        for (const n of [57, 64, 69, 72, 76])
          for (const detune of [-9, 9])
            s.tone(NOTE(n), 0, 2.1, {
              type: 'sawtooth',
              gain: 0.022,
              detune,
              attack: 0.4,
              hold: 0.7,
              filter: { type: 'lowpass', freq: 400, to: 2400 },
            });
        [81, 84, 88, 93].forEach((n, i) =>
          s.tone(NOTE(n), 0.3 + i * 0.15, 0.6, {
            gain: 0.06,
            pan: (i - 1.5) * 0.3,
          }),
        );
        s.noise(0.2, 1.4, {
          gain: 0.02,
          attack: 0.6,
          filter: { type: 'highpass', freq: 7000 },
        });
      },
    },
  },
};
