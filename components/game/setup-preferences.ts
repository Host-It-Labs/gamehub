import type { Difficulty, GameId } from '@/lib/games/trio/engine';

type SetupPreferences = {
  players: number;
  difficulty: Difficulty;
  starter: boolean;
  fastMode: boolean;
  nightMarket: boolean;
};
const defaults: SetupPreferences = {
  players: 3, difficulty: 'medium', starter: false, fastMode: false, nightMarket: false,
};
const key = (id: GameId) => `gamehub.setup.${id}.v1`;
export function readSetup(id: GameId): SetupPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key(id)) ?? '{}');
    return {
      players: Number.isInteger(saved.players) && saved.players >= 2 && saved.players <= 6 ? saved.players : defaults.players,
      difficulty: ['easy', 'medium', 'hard'].includes(saved.difficulty) ? saved.difficulty : defaults.difficulty,
      starter: saved.starter === true,
      fastMode: saved.fastMode === true,
      nightMarket: saved.nightMarket === true,
    };
  } catch {
    return { ...defaults };
  }
}
export function saveSetup(id: GameId, preferences: SetupPreferences) {
  try { localStorage.setItem(key(id), JSON.stringify(preferences)); } catch { /* Storage may be unavailable. */ }
}
