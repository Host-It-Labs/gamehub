import {
  LOCKED,
  upgradeQuest,
  validQuest,
  type QuestState,
} from '@/lib/games/arena/quest';
import type { CardId } from '@/lib/games/arena/cards';

/**
 * A Quest run on this device and the cards earlier runs unlocked. Both live
 * in local storage; a private window without it simply starts fresh.
 */
const RUN = 'gamehub.arena.quest.v1';
const UNLOCKED = 'gamehub.arena.unlocked.v1';

export function loadRun(): QuestState | null {
  try {
    const raw = localStorage.getItem(RUN);
    if (!raw) return null;
    const q: unknown = JSON.parse(raw);
    // A run saved on the old charm pick starts its draft instead.
    return validQuest(q) ? upgradeQuest(q) : null;
  } catch {
    return null;
  }
}

export function saveRun(q: QuestState | null) {
  try {
    if (q && q.screen.kind !== 'won' && q.screen.kind !== 'lost')
      localStorage.setItem(RUN, JSON.stringify(q));
    else localStorage.removeItem(RUN);
  } catch {
    // Keeping the run is a convenience; the quest plays on without it.
  }
}

export function loadUnlocked(): CardId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(UNLOCKED) ?? '[]');
    return Array.isArray(raw) ? LOCKED.filter((c) => raw.includes(c)) : [];
  } catch {
    return [];
  }
}

export function addUnlocked(cards: CardId[]) {
  if (!cards.length) return;
  try {
    const all = [...new Set([...loadUnlocked(), ...cards])];
    localStorage.setItem(UNLOCKED, JSON.stringify(all));
  } catch {
    // As above.
  }
}
