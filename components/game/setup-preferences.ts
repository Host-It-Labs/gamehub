import type { Difficulty, GameId, GameOptions } from '@/lib/games/trio/engine';

type SetupPreferences = {
  options: GameOptions;
  players: number;
  difficulty: Difficulty;
  shields: boolean;
  fastMode: boolean;
  customerOrders: boolean;
  sanctuaryGoalsEnabled: boolean;
};
const defaults: SetupPreferences = {
  options: {},
  players: 3,
  difficulty: 'medium',
  shields: false,
  fastMode: false,
  customerOrders: false,
  sanctuaryGoalsEnabled: false,
};
const key = (id: GameId) => `gamehub.setup.${id}.v1`;
export function readSetup(id: GameId): SetupPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key(id)) ?? '{}');
    return {
      options: {
        contentSet:
          saved.options?.contentSet === 'intermediate'
            ? 'intermediate'
            : 'beginner',
        roamEnabled:
          (saved.options?.roamEnabled ?? saved.options?.trailcraft) === true,
        turningTide: saved.options?.turningTide === true,
        migration: saved.options?.migration === true,
        salvage: saved.options?.salvage === true,
        specialtyStalls:
          (saved.options?.specialtyStalls ?? saved.nightMarket) === true,
        marketSeasons: saved.options?.marketSeasons === true,
      },
      players:
        Number.isInteger(saved.players) &&
        saved.players >= 2 &&
        saved.players <= 6
          ? saved.players
          : defaults.players,
      difficulty: ['easy', 'medium', 'hard'].includes(saved.difficulty)
        ? saved.difficulty
        : defaults.difficulty,
      shields: (saved.shields ?? saved.starter) === true,
      fastMode: saved.fastMode === true,
      customerOrders: (saved.customerOrders ?? saved.nightMarket) === true,
      sanctuaryGoalsEnabled:
        (saved.sanctuaryGoalsEnabled ?? saved.wildTrails) === true,
    };
  } catch {
    return { ...defaults };
  }
}
export function saveSetup(id: GameId, preferences: SetupPreferences) {
  try {
    localStorage.setItem(key(id), JSON.stringify(preferences));
  } catch {
    /* Storage may be unavailable. */
  }
}
