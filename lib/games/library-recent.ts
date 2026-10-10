/**
 * The library puts the games this browser played most recently first: the
 * showcase, its row of covers and every shelf. A game counts as played when
 * it is opened from the library; the time is kept per browser. Games never
 * played keep their documented order after the played ones. Storage that is
 * blocked or broken reads as nothing played, so the library still renders in
 * its default order.
 */
const KEY = 'gamehub.last-played.v1';

/** When each game was last opened from the library, in ms since the epoch. */
export type LastPlayed = Readonly<Record<string, number>>;

/** Keeps only sane timestamps from whatever the storage holds. */
export function parseLastPlayed(raw: string | null | undefined): LastPlayed {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [id, at] of Object.entries(value))
      if (typeof at === 'number' && Number.isFinite(at) && at > 0) out[id] = at;
    return out;
  } catch {
    return {};
  }
}

export function readLastPlayed(): LastPlayed {
  try {
    return parseLastPlayed(localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

export function recordLastPlayed(id: string, now = Date.now()) {
  try {
    const played = { ...readLastPlayed(), [id]: now };
    localStorage.setItem(KEY, JSON.stringify(played));
  } catch {
    /* The order simply stays the default when storage is blocked. */
  }
}

/**
 * `ids` with the played ones first, most recent first, then the rest in the
 * order given. Stable, and never adds or drops an id.
 */
export function byRecent(ids: readonly string[], played: LastPlayed): string[] {
  const at = (id: string) => played[id] ?? 0;
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => at(b.id) - at(a.id) || a.i - b.i)
    .map(({ id }) => id);
}
