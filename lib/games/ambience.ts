import type { ContentSet, GameId as TrioGameId } from './trio/engine';
type GameId =
  | TrioGameId
  | 'orin'
  | 'miro'
  | 'dial'
  | 'size'
  | 'coins'
  | 'year'
  | 'order'
  | 'impostor';

/**
 * Each world's background is one real field recording, played quietly
 * behind the table: the player crossfades random windows of it (`bedPass`),
 * so it never loops audibly. Files live under /audio/ambience/ and are
 * fetched only once that world's table is open; their sources and licences
 * are in public/audio/ambience/CREDITS.md. Generated and assembled
 * soundscapes were retired on 12 October 2026: real recordings only.
 */
export type AmbienceBed = {
  src: string;
  /** Linear gain relative to the world's master level. */
  gain: number;
  label?: string;
};
export type AmbienceEvent = {
  src: string;
  gain: number;
  label?: string;
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
  /** Overall environmental level; action effects sit below the background. */
  level: number;
  beds: AmbienceBed[];
  /** Seconds of silence between one-shots, drawn uniformly. */
  gap: [number, number];
  events: AmbienceEvent[];
};

const recording = (id: GameId, world: string, file: string, label: string): Ambience => ({
  id,
  world,
  level: 0.75,
  beds: [{ src: `/audio/ambience/${file}.m4a`, gain: 0.85, label }],
  gap: [30, 60],
  events: [],
});

/** The worlds with a recording; any other game plays no ambience. Each file
 *  is a calm stretch of the recording, levelled to about -21 LUFS with its
 *  rare peaks softened. */
export const ambiences: Ambience[] = [
  recording('undertow', 'ship', 'nox-ship', 'Below deck on the Lovis, a sailing ship at sea'),
  recording('wildgrove', 'forest', 'mora-forest', 'A forest by a small river'),
  recording('midnight', 'street', 'yata-street', 'A night snack stall by a street in Guilin'),
];

export function ambienceFor(id: GameId | null | undefined, _contentSet?: ContentSet) {
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
