import { isLevelId, LEVEL_COUNT } from '../../../lib/games/diner/levels.ts';
import {
  buyGear,
  buyUpgrade,
  checkpointRun,
  createProfile,
  driveTo,
  endRun,
  isCampaignProfile,
  isCampaignRun,
  keepDriving,
  leaveStop,
  motelRest,
  motelTune,
  patchUp,
  pickGear,
  rerollOffers,
  runActive,
  settleShift,
  startRun,
  type CampaignProfile,
  type CampaignRun,
  type GearId,
  type UpgradeId,
} from '../../../lib/games/diner/campaign.ts';
import type { Match } from '../../../lib/games/diner/engine.ts';

/**
 * Free play's levels on this device: the best medals and takings per level
 * and the level picked last. Level 1 is always open; finishing a level (any
 * medal) opens the next. Diner never shipped its three nights, so the old
 * record is simply left behind.
 */
export const DINER_LEVELS_SAVE = 'gamehub.diner.levels.v1';

export type LevelRecord = {
  /** Index = level number − 1. */
  medals: number[];
  best: number[];
  /** The level picked last. */
  last: number;
};

const emptyLevels = (): LevelRecord => ({
  medals: Array(LEVEL_COUNT).fill(0),
  best: Array(LEVEL_COUNT).fill(0),
  last: 1,
});

export function readLevels(): LevelRecord {
  const r = emptyLevels();
  try {
    const raw = JSON.parse(localStorage.getItem(DINER_LEVELS_SAVE) ?? 'null');
    if (!raw || typeof raw !== 'object') return r;
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const m = Number(raw.medals?.[i]);
      const b = Number(raw.best?.[i]);
      if (Number.isInteger(m) && m >= 0 && m <= 3) r.medals[i] = m;
      if (Number.isFinite(b) && b >= 0) r.best[i] = Math.round(b);
    }
    if (isLevelId(raw.last)) r.last = raw.last;
  } catch {
    // Blocked or broken storage: start fresh.
  }
  return r;
}

function writeLevels(r: LevelRecord) {
  try {
    localStorage.setItem(DINER_LEVELS_SAVE, JSON.stringify(r));
  } catch {
    // Medals are a keepsake; play goes on without them.
  }
}

/** Level 1 is open; every other opens once the one before has a medal. */
export const levelOpen = (r: LevelRecord, id: number) =>
  isLevelId(id) && (id === 1 || (r.medals[id - 2] ?? 0) > 0);
/** Levels with at least one medal. */
export const levelsFinished = (r: LevelRecord) =>
  r.medals.filter((m) => m > 0).length;
/** The first open level still without a medal, or the last open one. */
export function nextLevel(r: LevelRecord) {
  for (let id = 1; id <= LEVEL_COUNT; id++)
    if (levelOpen(r, id) && !r.medals[id - 1]) return id;
  return LEVEL_COUNT;
}

/**
 * Keeps the best medals and takings for a level. Says whether the takings
 * are a new best and which level this shift opened, if any.
 */
export function recordLevel(id: number, medals: number, coins: number) {
  const r = readLevels();
  if (!isLevelId(id))
    return { record: r, best: false, opened: null as number | null };
  const was = r.medals[id - 1];
  const best = coins > 0 && coins > r.best[id - 1];
  r.medals[id - 1] = Math.max(was, medals);
  r.best[id - 1] = Math.max(r.best[id - 1], coins);
  writeLevels(r);
  const opened = !was && medals > 0 && id < LEVEL_COUNT ? id + 1 : null;
  return { record: r, best, opened };
}

export function rememberLevel(id: number) {
  if (!isLevelId(id)) return;
  const r = readLevels();
  r.last = id;
  writeLevels(r);
}

/**
 * One envelope keeps the Workshop's tokens and the run together. Every change
 * reads the newest copy first and applies to it, so a second tab cannot roll
 * the other one back. (The 4 October campaign never shipped: no migration.)
 */
export const DINER_CAMPAIGN_SAVE = 'gamehub.diner.campaign.v3';
export type CampaignSave = {
  v: 3;
  revision: number;
  profile: CampaignProfile;
  run: CampaignRun | null;
  /** False means this session is playable but storage has not kept this state. */
  persisted: boolean;
};
let memorySave: CampaignSave | null = null;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const freshCampaign = (persisted = true): CampaignSave => ({
  v: 3,
  revision: 0,
  profile: createProfile(),
  run: null,
  persisted,
});

export function readCampaign(): CampaignSave {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DINER_CAMPAIGN_SAVE);
  } catch {
    return memorySave ? copy(memorySave) : freshCampaign(false);
  }
  try {
    const parsed = (
      raw === null ? null : JSON.parse(raw)
    ) as CampaignSave | null;
    if (
      !parsed ||
      parsed.v !== 3 ||
      !Number.isSafeInteger(parsed.revision) ||
      !isCampaignProfile(parsed.profile)
    )
      return memorySave && !memorySave.persisted
        ? copy(memorySave)
        : freshCampaign();
    if (
      memorySave &&
      !memorySave.persisted &&
      memorySave.revision > parsed.revision
    )
      return copy(memorySave);
    // A broken run must not cost the Workshop's tokens (validation never throws).
    const run =
      parsed.run === null || isCampaignRun(parsed.run) ? parsed.run : null;
    memorySave = {
      v: 3,
      revision: parsed.revision,
      profile: parsed.profile,
      run,
      persisted: true,
    };
    return copy(memorySave);
  } catch {
    return memorySave && !memorySave.persisted
      ? copy(memorySave)
      : freshCampaign();
  }
}

function writeCampaign(next: CampaignSave): CampaignSave {
  try {
    const { persisted: _persisted, ...envelope } = next;
    void _persisted;
    localStorage.setItem(DINER_CAMPAIGN_SAVE, JSON.stringify(envelope));
    memorySave = { ...next, persisted: true };
  } catch {
    memorySave = { ...next, persisted: false };
  }
  return copy(memorySave);
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function transact(
  change: (state: CampaignSave) => {
    profile: CampaignProfile;
    run: CampaignRun | null;
  },
): CampaignSave {
  const current = readCampaign();
  const next = change(current);
  if (same(next.profile, current.profile) && same(next.run, current.run))
    return current;
  if (
    !isCampaignProfile(next.profile) ||
    (next.run && !isCampaignRun(next.run))
  )
    throw new Error('Could not save your run.');
  return writeCampaign({
    ...current,
    revision: current.revision + 1,
    profile: next.profile,
    run: next.run,
  });
}
const onRun = (change: (run: CampaignRun) => CampaignRun) =>
  transact((s) => (s.run ? { profile: s.profile, run: change(s.run) } : s));

export const beginCampaign = (seed: number) =>
  transact((s) => (runActive(s.run) ? s : startRun(s.profile, seed)));
/** Drops the run under way, if any (its banked tokens stay), and starts a new one. */
export const restartCampaign = (seed: number) =>
  transact((s) => startRun(s.profile, seed));
export const driveCampaign = (id: string, names?: string[]) =>
  onRun((run) => driveTo(run, id, names));
export const checkpointCampaignMatch = (match: Match) =>
  onRun((run) => checkpointRun(run, match));
export const settleCampaignMatch = (match: Match) =>
  transact((s) => (s.run ? settleShift(s.profile, s.run, match) : s));
export const pickCampaignGear = (id: GearId) =>
  onRun((run) => pickGear(run, id));
export const rerollCampaignGear = () => onRun(rerollOffers);
export const buyCampaignGear = (id: GearId) => onRun((run) => buyGear(run, id));
export const patchCampaignCar = () => onRun(patchUp);
export const leaveCampaignStop = () => onRun(leaveStop);
export const restAtMotel = () => onRun(motelRest);
export const tuneAtMotel = () => onRun(motelTune);
export const keepDrivingCampaign = () => onRun(keepDriving);
export const endCampaignRun = () => onRun(endRun);
/**
 * The Workshop sells between runs, and at the start line of a new run until
 * the truck drives to its first stop: an upgrade bought there joins that run.
 */
export const workshopOpen = (run: CampaignRun | null) =>
  !runActive(run) || (run!.status === 'route' && run!.visited.length === 0);
export const buyDinerUpgrade = (id: UpgradeId) =>
  transact((s) => {
    if (!workshopOpen(s.run)) return s;
    const profile = buyUpgrade(s.profile, id);
    if (profile === s.profile || !runActive(s.run))
      return { profile, run: s.run };
    // Start the same run again on the upgraded car (same road, same id).
    const again = startRun(profile, s.run!.seed);
    return { profile, run: { ...again.run, id: s.run!.id } };
  });
