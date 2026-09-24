import type { GameId as TrioGameId } from './trio/engine';
type GameId = TrioGameId | 'orin' | 'miro' | 'dial' | 'size';

/**
 * Ambient soundscapes are assembled at play time from small pieces, so a
 * ten-minute match never repeats a sequence: a few looping beds are played
 * from random offsets and crossfaded, and a scheduler drops randomised
 * one-shots on top. Files live under /audio/ambience/<world>/ as mono or
 * stereo AAC and are fetched only once that world's table is open.
 */
export type AmbienceBed = {
  src: string;
  /** Linear gain relative to the world's master level. */
  gain: number;
};
export type AmbienceEvent = {
  src: string;
  gain: number;
  /** Relative pick probability; 1 is common, 0.25 is rare. */
  weight: number;
  /** Random stereo placement range; omit for centre. */
  pan?: [number, number];
  /** Random detune in cents applied symmetrically. */
  detune?: number;
};
export type Ambience = {
  id: GameId;
  world: string;
  /** Overall level ceiling; the environment sits well under the cues. */
  level: number;
  beds: AmbienceBed[];
  /** Seconds of silence between one-shots, drawn uniformly. */
  gap: [number, number];
  events: AmbienceEvent[];
};

const base = '/audio/ambience';
const world = (
  id: GameId,
  world: string,
  level: number,
  beds: [string, number][],
  gap: [number, number],
  events: [string, number, number, ([number, number] | undefined)?, number?][],
): Ambience => ({
  id,
  world,
  level,
  beds: beds.map(([name, gain]) => ({ src: `${base}/${world}/${name}.m4a`, gain })),
  gap,
  events: events.map(([name, gain, weight, pan, detune]) => ({
    src: `${base}/${world}/${name}.m4a`,
    gain,
    weight,
    pan,
    detune,
  })),
});

export const ambiences: Ambience[] = [
  // Mora: a paper forest garden in daylight. Breeze in the leaves, birds and insects far off.
  world(
    'wildgrove' as GameId,
    'forest',
    0.55,
    [
      ['breeze', 0.9],
      ['birds-far', 0.45],
    ],
    [12, 28],
    [
      ['thrush-1', 0.5, 1, [-0.8, 0.8], 60],
      ['thrush-2', 0.5, 1, [-0.8, 0.8], 60],
      ['thrush-3', 0.5, 1, [-0.8, 0.8], 60],
      ['jay', 0.35, 0.6, [-0.9, 0.9], 40],
      ['woodpecker-1', 0.4, 0.7, [-0.9, 0.9], 30],
      ['woodpecker-2', 0.4, 0.5, [-0.9, 0.9], 30],
      ['crow-1', 0.3, 0.5, [-1, 1], 40],
      ['crow-2', 0.3, 0.4, [-1, 1], 40],
      ['owl', 0.3, 0.2, [-0.6, 0.6], 30],
      ['branch-1', 0.45, 0.5, [-0.7, 0.7], 80],
      ['branch-2', 0.45, 0.4, [-0.7, 0.7], 80],
      ['leaves', 0.4, 0.6, [-0.5, 0.5], 40],
      ['frog', 0.35, 0.4, [-0.9, 0.9], 60],
    ],
  ),
  // Nox: the hold of a ship. Water against the hull, timbers working, the deck far above.
  world(
    'undertow' as GameId,
    'ship',
    0.55,
    [
      ['hull', 0.9],
      ['swell', 0.5],
    ],
    [13, 30],
    [
      ['crew-murmur-1', 0.18, 0.3, [-0.5, 0.5], 15],
      ['crew-murmur-2', 0.16, 0.3, [-0.6, 0.6], 15],
      ['creak-1', 0.55, 1, [-0.8, 0.8], 80],
      ['creak-2', 0.55, 1, [-0.8, 0.8], 80],
      ['creak-3', 0.55, 0.8, [-0.8, 0.8], 80],
      ['creak-short-1', 0.5, 0.8, [-0.9, 0.9], 120],
      ['creak-short-2', 0.5, 0.8, [-0.9, 0.9], 120],
      ['bell-single', 0.25, 0.3, [-0.3, 0.3], 10],
      ['bell-double', 0.22, 0.15, [-0.3, 0.3], 10],
      ['gull-1', 0.22, 0.5, [-1, 1], 50],
      ['gull-2', 0.22, 0.5, [-1, 1], 50],
      ['sail', 0.3, 0.5, [-0.5, 0.5], 40],
      ['oar', 0.3, 0.4, [-0.8, 0.8], 40],
      ['wash', 0.4, 0.7, [-0.6, 0.6], 20],
    ],
  ),
  // Yata: a small street counter at dusk. People eating nearby, the road a little further.
  world(
    'midnight' as GameId,
    'street',
    0.5,
    [
      ['market', 0.9],
      ['bazaar', 0.3],
      ['sizzle', 0.22],
    ],
    [11, 26],
    [
      ['plate', 0.4, 1, [-0.7, 0.7], 60],
      ['dishes-1', 0.35, 0.8, [-0.7, 0.7], 60],
      ['dishes-2', 0.35, 0.8, [-0.7, 0.7], 60],
      ['chopsticks', 0.35, 0.7, [-0.5, 0.5], 40],
      ['wok-1', 0.3, 0.6, [-0.6, 0.6], 20],
      ['wok-2', 0.3, 0.6, [-0.6, 0.6], 20],
      ['bike-bell-1', 0.3, 0.5, [-1, 1], 60],
      ['bike-bell-2', 0.3, 0.4, [-1, 1], 60],
      ['scooter', 0.25, 0.4, [-1, 1], 30],
      ['laughter', 0.3, 0.5, [-0.8, 0.8], 30],
      ['flute', 0.15, 0.15, [-0.4, 0.4], 0],
    ],
  ),
];

const coast = world('wildgrove' as GameId, 'coast', 0.58,
  [['surf', 0.95], ['shore', 0.35]], [14, 32], [
    ['gulls-near', 0.32, 1, [-0.8, 0.8], 25],
    ['gulls-far', 0.23, 1, [-1, 1], 30],
    ['wash', 0.3, 0.7, [-0.6, 0.6], 15],
  ]);
ambiences.push(coast);
export function ambienceFor(id: GameId | null | undefined, contentSet?: 'beginner' | 'intermediate') {
  if (id === 'wildgrove' && contentSet === 'intermediate') return coast;
  return ambiences.find((a) => a.id === id);
}

/** Uniform draw in [min, max]; `random` is injectable for tests. */
export function between(range: readonly [number, number], random = Math.random) {
  return range[0] + (range[1] - range[0]) * random();
}

/** Weighted pick excluding recent events whenever the pool has a fresh choice. */
export function pickEvent<T extends { weight: number }>(
  events: readonly T[],
  previous: T | readonly T[] | undefined,
  random = Math.random,
): T {
  const recent: readonly T[] = Array.isArray(previous) ? previous : previous ? [previous as T] : [];
  const eligible = events.filter((event) => !recent.includes(event));
  const pool = eligible.length ? eligible : events.filter((event) => event !== recent.at(-1));
  if (!pool.length) return events[0];
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = random() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

/**
 * A bed pass plays a random window of the recording and hands over to the
 * next pass under a crossfade, so a one-minute file never loops audibly.
 */
export function bedPass(duration: number, random = Math.random) {
  const fade = Math.min(7, duration / 4);
  const length = between([Math.min(45, duration * 0.7), Math.min(75, duration * 0.95)], random);
  const start = between([0, Math.max(0, duration - length)], random);
  return { start, length, fade };
}
