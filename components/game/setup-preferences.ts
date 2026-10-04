import { contentSetsFor, type Difficulty, type GameId, type GameOptions } from '../../lib/games/trio/engine.ts';

type SetupPreferences = {
  options: GameOptions;
  players: number;
  difficulty: Difficulty;
  fastMode: boolean;
  customerOrders: boolean;
  sanctuaryGoalsEnabled: boolean;
};
const defaults: SetupPreferences = {
  options: {},
  players: 3,
  difficulty: 'medium',
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
        contentSet: contentSetsFor(id).includes(saved.options?.contentSet)
          ? saved.options.contentSet
          : 'beginner',
        roamEnabled:
          (saved.options?.roamEnabled ?? saved.options?.trailcraft) === true,
        gold: saved.options?.gold === true,
        census: saved.options?.census === true,
        anchor: saved.options?.anchor === true,
        dawn: saved.options?.dawn === true,
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
