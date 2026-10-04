import { isNight, NIGHTS, type NightId } from '@/lib/games/diner/content';

/** Medals and best takings per night, kept on this device. */
export const DINER_SAVE = 'gamehub.diner.v1';

export type DinerRecord = {
  medals: Record<NightId, number>;
  best: Record<NightId, number>;
  /** The night picked last. */
  night: NightId;
};

const empty = (): DinerRecord => ({
  medals: { 1: 0, 2: 0, 3: 0 },
  best: { 1: 0, 2: 0, 3: 0 },
  night: 1,
});

export function readDiner(): DinerRecord {
  const r = empty();
  try {
    const raw = JSON.parse(localStorage.getItem(DINER_SAVE) ?? 'null');
    if (!raw || typeof raw !== 'object') return r;
    for (const n of NIGHTS) {
      const m = Number(raw.medals?.[n]);
      const b = Number(raw.best?.[n]);
      if (Number.isInteger(m) && m >= 0 && m <= 3) r.medals[n] = m;
      if (Number.isFinite(b) && b >= 0) r.best[n] = Math.round(b);
    }
    if (isNight(raw.night)) r.night = raw.night;
  } catch {
    // Blocked or broken storage: start fresh.
  }
  return r;
}

function write(r: DinerRecord) {
  try {
    localStorage.setItem(DINER_SAVE, JSON.stringify(r));
  } catch {
    // Medals are a keepsake; play goes on without them.
  }
}

/** Keeps the best medals and takings for a night. Returns the new record. */
export function recordShift(night: NightId, medals: number, coins: number) {
  const r = readDiner();
  r.medals[night] = Math.max(r.medals[night], medals);
  r.best[night] = Math.max(r.best[night], coins);
  write(r);
  return r;
}

export function rememberNight(night: NightId) {
  const r = readDiner();
  r.night = night;
  write(r);
}
