import type { Cue, SoundBook } from '../cues.ts';
import {
  blast,
  brass,
  chirp,
  coin,
  GLASS,
  MARIMBA,
  whoosh,
  woodblock,
} from '../kit.ts';
import { NOTE, type Synth } from '../synth.ts';

/**
 * Arena: a cartoon battlefield. The cards, the towers, the clock, the Meteor,
 * the closing stings and the Quest screens are synthesised here; the troops
 * and everything they do keep their recordings (lib/games/arena/audio.json).
 * `components/game/arena/sound.ts` pans and pitches both and keeps a busy
 * battle from stacking into noise.
 */

const cue = (label: string, loud: number, play: (s: Synth) => void): Cue => ({
  label,
  loud,
  play,
});

const battle: Record<string, Cue> = {
  'card-pick': cue('Pick a card', -31, (s) => {
    s.noise(0, 0.09, {
      gain: 0.18,
      attack: 0.01,
      filter: { type: 'bandpass', freq: 1500, to: 3600, q: 1.1 },
    });
    s.click(0.07, { gain: 0.05, freq: 3000 });
  }),
  'card-drop': cue('A card lands', -21, (s) => {
    whoosh(s, 0, 0.18, 3000, 600, 0.25);
    s.thump(140, 0.15, 0.15, { gain: 0.35 });
  }),
  'no-elixir': cue('Not enough elixir', -28, (s) => {
    s.tone(330, 0, 0.1, {
      type: 'square',
      gain: 0.05,
      filter: { type: 'lowpass', freq: 900 },
    });
    s.tone(262, 0.11, 0.16, {
      type: 'square',
      gain: 0.05,
      filter: { type: 'lowpass', freq: 800 },
    });
  }),
  'battle-start': cue('The battle begins', -20, (s) => {
    brass(s, [67], 0, 0.12, 0.05);
    brass(s, [67], 0.14, 0.12, 0.05);
    brass(s, [67, 72], 0.28, 0.12, 0.05);
    brass(s, [67, 72, 76, 79], 0.44, 0.75, 0.045, 3200);
    for (let i = 0; i < 6; i++)
      s.noise(i * 0.045, 0.05, {
        gain: 0.06 + i * 0.01,
        filter: { type: 'bandpass', freq: 2200, q: 0.9 },
      });
    s.noise(0.44, 0.9, {
      gain: 0.08,
      filter: { type: 'highpass', freq: 5000 },
    });
    s.thump(70, 0.44, 0.3, { gain: 0.4 });
  }),
  overtime: cue('Overtime', -20, (s) => {
    brass(s, [69, 72], 0, 0.3, 0.05);
    brass(s, [70, 73], 0.36, 0.6, 0.05);
    for (let i = 0; i < 10; i++)
      s.thump(65, 0.36 + i * 0.05, 0.12, { gain: 0.1 + i * 0.02 });
  }),
  'countdown-tick': cue('Last ten seconds', -30, (s) =>
    woodblock(s, 1400, 0, 0.16),
  ),
  crown: cue('A crown', -22, (s) => {
    [84, 88, 91].forEach((n, i) =>
      s.bell(NOTE(n), i * 0.07, 0.9, { gain: 0.12, partials: GLASS }),
    );
    s.noise(0.15, 0.5, {
      gain: 0.04,
      attack: 0.15,
      filter: { type: 'highpass', freq: 7500 },
    });
  }),
  'king-wake': cue('The king wakes', -20, (s) => {
    s.fm(110, 0, 2, { ratio: 1.4, index: 4, indexTo: 0.2, gain: 0.2 });
    brass(s, [45, 52], 0.15, 1.1, 0.06, 1400);
  }),
  'tower-hit': cue('A tower is hit', -23, (s) => {
    s.thump(120, 0, 0.14, { gain: 0.35 });
    s.noise(0, 0.12, {
      gain: 0.2,
      attack: 0.001,
      filter: { type: 'lowpass', freq: 1200 },
    });
  }),
  'tower-fall': cue('A tower falls', -17, (s) => {
    s.noise(0, 2, {
      color: 'brown',
      gain: 0.5,
      attack: 0.02,
      filter: { type: 'lowpass', freq: 900, to: 180 },
    });
    for (let i = 0; i < 6; i++)
      s.thump(60 + Math.random() * 40, i * 0.22 + Math.random() * 0.1, 0.3, {
        gain: 0.35 - i * 0.04,
      });
    for (let i = 0; i < 8; i++)
      s.noise(Math.random() * 1.2, 0.04, {
        gain: 0.08,
        filter: { type: 'bandpass', freq: 1000 + Math.random() * 2000, q: 1.5 },
      });
  }),
  'arrow-shot': cue('Tower · arrow', -28, (s) => {
    s.pluck(196, 0, 0.28, { gain: 0.3, bright: 0.9 });
    whoosh(s, 0.02, 0.12, 3000, 1500, 0.12);
  }),
  'cannon-shot': cue('Tower · cannon', -25, (s) => {
    s.thump(60, 0, 0.4, { gain: 0.5, from: 3 });
    s.noise(0, 0.3, {
      gain: 0.3,
      attack: 0.002,
      filter: { type: 'lowpass', freq: 900 },
    });
    s.click(0, { gain: 0.15, freq: 1500 });
  }),
  'meteor-fall': cue('Meteor falls', -26, (s) => {
    s.tone(2000, 0, 1, { gain: 0.06, to: 300, attack: 0.05, vibrato: [7, 6] });
    s.noise(0, 1, {
      color: 'brown',
      gain: 0.25,
      attack: 0.9,
      filter: { type: 'lowpass', freq: 300, to: 900 },
    });
  }),
  'meteor-crash': cue('Meteor crashes', -17, (s) => {
    blast(s, 0, 1.6);
    s.thump(38, 0, 0.8, { gain: 0.5, from: 2 });
  }),
  'sting-win': cue('Victory', -22, (s) => {
    brass(s, [60, 64, 67], 0, 0.16, 0.045);
    brass(s, [64, 67, 72], 0.18, 0.16, 0.045);
    brass(s, [67, 72, 76], 0.36, 0.16, 0.045);
    brass(s, [72, 76, 79, 84], 0.56, 1.5, 0.04, 3400);
    s.noise(0.56, 1.6, {
      gain: 0.08,
      attack: 0.004,
      filter: { type: 'highpass', freq: 5000 },
    });
    s.thump(60, 0.56, 0.4, { gain: 0.4 });
    [84, 88, 91, 96].forEach((n, i) =>
      s.bell(NOTE(n), 0.7 + i * 0.08, 0.8, { gain: 0.06, partials: GLASS }),
    );
  }),
  'sting-lose': cue('Defeat', -22, (s) => {
    [67, 66, 65].forEach((n, i) =>
      s.tone(NOTE(n), i * 0.36, 0.34, {
        type: 'sawtooth',
        gain: 0.07,
        attack: 0.03,
        hold: 0.2,
        filter: { type: 'lowpass', freq: 1300 },
      }),
    );
    s.tone(NOTE(64), 1.08, 1.3, {
      type: 'sawtooth',
      gain: 0.07,
      attack: 0.03,
      hold: 0.7,
      vibrato: [5, 40],
      filter: { type: 'lowpass', freq: 1400, to: 500 },
    });
  }),
  'sting-draw': cue('A draw', -22, (s) => {
    brass(s, [60, 65, 67], 0, 0.5, 0.04, 2000);
    brass(s, [60, 67, 72], 0.55, 1.2, 0.04, 2000);
  }),
};

const quest: Record<string, Cue> = {
  'quest-step': cue('Quest · a step on the map', -28, (s) => {
    woodblock(s, 700, 0, 0.14);
    s.noise(0.02, 0.08, {
      gain: 0.06,
      filter: { type: 'bandpass', freq: 2500, q: 1 },
    });
  }),
  'quest-reward': cue('Quest · a chest opens', -26, (s) => {
    s.fm(140, 0, 0.35, { ratio: 1.01, index: 3, gain: 0.05, to: 180 });
    [76, 79, 84, 88].forEach((n, i) =>
      s.bell(NOTE(n), 0.25 + i * 0.06, 0.7, { gain: 0.08, partials: GLASS }),
    );
  }),
  'quest-coin': cue('Quest · gold', -26, (s) => {
    coin(s, 0, 2300, 0.09);
    coin(s, 0.08, 2750, 0.08);
  }),
  'quest-upgrade': cue('Quest · a card levels up', -25, (s) => {
    brass(s, [67, 72], 0, 0.15, 0.04);
    brass(s, [72, 76, 79], 0.16, 0.5, 0.04, 3000);
    s.bell(NOTE(96), 0.2, 0.6, { gain: 0.05, partials: GLASS });
  }),
  'quest-heart-lost': cue('Quest · a heart lost', -24, (s) => {
    s.thump(70, 0, 0.18, { gain: 0.45 });
    s.thump(62, 0.2, 0.22, { gain: 0.35 });
    s.tone(NOTE(64), 0.35, 0.6, { type: 'triangle', gain: 0.08, to: NOTE(60) });
  }),
  'quest-victory': cue('Quest · victory', -24, (s) => {
    [60, 64, 67, 72].forEach((n, i) =>
      s.bell(NOTE(n + 12), i * 0.09, 0.6, { gain: 0.1, partials: MARIMBA }),
    );
    brass(s, [72, 76, 79, 84], 0.4, 1.2, 0.04, 3200);
    chirp(s, 0.5, 2800, 4200, 0.02);
  }),
};

export const arena: SoundBook = {
  id: 'arena',
  name: 'Arena',
  material: 'A cartoon battlefield',
  space: 'room',
  wet: 0.1,
  cues: { ...battle, ...quest },
};
