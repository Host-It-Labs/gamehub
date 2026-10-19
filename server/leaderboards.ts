import type { DatabaseSync } from 'node:sqlite';
import { check } from './auth.ts';
import type { StoredTable } from './tables.ts';
import type { RotaRoomState } from './rota.ts';
import type { FolioGame } from '../lib/games/folio/types.ts';
import { scores, type Game } from '../lib/games/trio/engine.ts';
import { maps, MAP_IDS, type MapId } from '../lib/games/rota/maps.ts';
import type { Breakdown } from '../lib/games/rota/score.ts';
import { bookLevel, scratchFor } from '../lib/games/relic/scratch.ts';
import type { RelicGame } from '../lib/games/relic/engine.ts';
import {
  leaderboardGame,
  STARTING_RATING,
  type LeaderboardEntry,
  type LeaderboardGameId,
  type LeaderboardMetric,
  type LeaderboardResponse,
  type LeaderboardSummary,
  type LeaderboardView,
  type PersonalEntry,
  type RatedResult,
} from '../lib/games/leaderboards.ts';

/**
 * Rankings that just happen (19 October 2026). Every result is written here
 * by a server game lifecycle; there is no score submission. Results belong
 * to a player id (a guest's or an account's) and are public once that id has
 * an account. Ratings, stats and best results are always rebuilt from the
 * run history, so moving a guest's runs to an account and rebuilding is the
 * whole merge.
 */

/** Rating change per game, before the seat-count normalisation. */
export const RATING_K = 32;
/** Every Hard bot counts as an opponent of the starting rating. */
const BOT_RATING = STARTING_RATING;

const rating: LeaderboardView = { key: 'rating', label: 'Rating', metric: 'rating', unit: 'rating' };
const levels = ['easy', 'medium', 'hard'] as const;
const VIEWS: Record<LeaderboardGameId, LeaderboardView[]> = {
  undertow: [rating],
  wildgrove: [rating],
  midnight: [rating],
  rota: [
    rating,
    ...MAP_IDS.map((id) => ({ key: id, label: maps[id].name, metric: 'score' as const, unit: 'points' })),
  ],
  folio: levels.map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    metric: 'puzzles' as const,
    unit: 'solved',
  })),
  relic: [{ key: 'desk', label: 'Best desk', metric: 'progress', unit: 'levels' }],
};
export function leaderboardViews(gameId: LeaderboardGameId) {
  return VIEWS[gameId];
}
const boardKey = (gameId: LeaderboardGameId, view: string) => `${gameId}:${view}`;
function boardOf(key: string) {
  const [gameId, view] = key.split(':') as [LeaderboardGameId, string];
  const found = VIEWS[gameId]?.find((v) => v.key === view);
  return found ? { gameId, view: found } : null;
}

/** The expected score against one Hard bot. */
export function expectedScore(value: number) {
  return 1 / (1 + 10 ** ((BOT_RATING - value) / 400));
}
/**
 * One game's rating change from its placing against every bot: 1 for each
 * bot finished above, ½ for a tie, 0 below. Dividing K by √(bots) keeps a
 * six-seat game worth more than a duel without making it a lottery.
 */
export function ratingDelta(value: number, outcome: readonly number[]) {
  if (!outcome.length) return 0;
  const e = expectedScore(value);
  return Math.round((RATING_K / Math.sqrt(outcome.length)) * outcome.reduce((t, s) => t + s - e, 0));
}
/** Placing against each bot in a finished Nox, Mora or Yata game. Nox is low-score-wins. */
export function trioOutcome(g: Game, seat: number) {
  const points = scores(g);
  const low = g.id === 'undertow';
  return points.flatMap((p, i) =>
    i === seat ? [] : [points[seat] === p ? 0.5 : (low ? points[seat] < p : points[seat] > p) ? 1 : 0],
  );
}
/** Placing against each bot in Rota: the engine's order, fewer loose ends breaking ties. */
export function rotaOutcome(finals: readonly Breakdown[], seat: number) {
  const key = (b: Breakdown) => b.total * 1000 + b.errors;
  return finals.flatMap((b, i) =>
    i === seat ? [] : [key(finals[seat]) === key(b) ? 0.5 : key(finals[seat]) > key(b) ? 1 : 0],
  );
}
/** A map's best score leaves out the extensions' direct bonus points, so one
 *  board per map stays fair whichever extensions were on. */
export function rotaCoreScore(b: Breakdown) {
  return b.exits + b.road + b.rail + b.centre + b.errors + b.tunnels;
}

const trioExtensions = {
  undertow: [
    ['gold', 'Gold'],
    ['anchor', 'Anchor'],
    ['dawn', 'Dawn'],
  ],
  wildgrove: [
    ['sanctuaryGoalsEnabled', 'Goals'],
    ['roamEnabled', 'Roam'],
    ['census', 'Census'],
  ],
  midnight: [
    ['customerOrders', 'Orders'],
    ['specialtyStalls', 'Stalls'],
    ['marketSeasons', 'Seasons'],
  ],
} as const;
const worlds: Record<string, string> = {
  beginner: 'Observatory',
  intermediate: 'Floodline Station',
  desert: 'Sunset Motel',
  alpine: 'Glacier Dam',
};
const menus: Record<string, string> = {
  beginner: 'Tokyo',
  intermediate: 'Bangkok',
  plaza: 'Mexico',
  fiesta: 'Puebla',
};
/** How a rated game was set up, for its Continue button. */
export function trioLabel(g: Game) {
  const content =
    g.id === 'undertow'
      ? g.fastMode
        ? 'Fast deck'
        : 'Full deck'
      : g.id === 'wildgrove'
        ? worlds[g.contentSet ?? 'beginner']
        : menus[g.contentSet ?? 'beginner'];
  const ext = trioExtensions[g.id].filter(([key]) => g[key] === true).map(([, label]) => label);
  return [`${g.players.length} players`, content, ...ext].filter(Boolean).join(' · ');
}
export function rotaLabel(game: RotaRoomState['game']) {
  const ext = (['rivers', 'plans', 'towns', 'rockfall'] as const)
    .filter((key) => game.ext[key])
    .map((e) => e[0].toUpperCase() + e.slice(1));
  return [maps[game.map].name, game.seats.length === 1 ? 'Solo' : `${game.seats.length} players`, ...ext].join(' · ');
}

type Kind = LeaderboardMetric;
type Run = {
  id: string;
  actor_id: string;
  game_id: LeaderboardGameId;
  board_key: string;
  kind: Kind;
  room: string;
  label: string;
  opponents: number;
  status: 'active' | 'finished' | 'forfeit' | 'abandoned' | 'disqualified';
  value: number | null;
  won: number;
  outcome: string | null;
  rating_before: number | null;
  rating_after: number | null;
  started_at: number;
  updated_at: number;
  finished_at: number | null;
};
type Standing = {
  board_key: string;
  actor_id: string;
  value: number;
  games: number;
  wins: number;
  streak: number;
  best_streak: number;
  updated_at: number;
};
type StartRun = {
  id: string;
  actor: string;
  gameId: LeaderboardGameId;
  view: string;
  room: string;
  label: string;
  opponents?: number;
  now?: number;
};
/** Kinds limited to one unfinished run per game (Rota's rated games and
 *  towns alone share the limit): leaving one unfinished must never dodge a
 *  loss, and setup offers one Continue per game. */
const limited = (kind: Kind) => kind === 'rating' || kind === 'score';

export class Leaderboards {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  private atomic<T>(work: () => T): T {
    this.db.exec('SAVEPOINT leaderboard_write');
    try {
      const result = work();
      this.db.exec('RELEASE leaderboard_write');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK TO leaderboard_write; RELEASE leaderboard_write');
      throw error;
    }
  }

  private run(id: string) {
    return this.db.prepare('SELECT * FROM leaderboard_runs WHERE id=?').get(id) as Run | undefined;
  }

  private isPublic(actor: string) {
    return !!this.db.prepare('SELECT 1 FROM users WHERE id=?').get(actor);
  }

  /** Enrols a new run. A rated game replaces the player's unfinished one of
   *  the same game, which counts as a loss; Rota alone just drops its old town. */
  start({ id, actor, gameId, view, room, label, opponents = 0, now = Date.now() }: StartRun) {
    if (this.run(id)) return;
    const found = VIEWS[gameId].find((v) => v.key === view);
    if (!found) return;
    const kind = found.metric;
    this.atomic(() => {
      if (limited(kind)) {
        const active = this.db
          .prepare("SELECT * FROM leaderboard_runs WHERE actor_id=? AND game_id=? AND kind IN ('rating','score') AND status='active'")
          .all(actor, gameId) as Run[];
        for (const run of active) this.settle(run, now);
      }
      this.db
        .prepare(
          `INSERT INTO leaderboard_runs (id,actor_id,game_id,board_key,kind,room,label,opponents,status,started_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,'active',?,?)`,
        )
        .run(id, actor, gameId, boardKey(gameId, view), kind, room, label, opponents, now, now);
    });
  }

  /** An unfinished run ends without a result: a rated game as last place
   *  against every bot, anything else simply without counting. */
  private settle(run: Run, now: number) {
    if (run.kind === 'rating')
      this.db
        .prepare(
          "UPDATE leaderboard_runs SET status='forfeit',won=0,outcome=?,finished_at=?,updated_at=? WHERE id=? AND status='active'",
        )
        .run(JSON.stringify(Array(run.opponents).fill(0)), now, now, run.id);
    else
      this.db
        .prepare("UPDATE leaderboard_runs SET status='abandoned',finished_at=?,updated_at=? WHERE id=? AND status='active'")
        .run(now, now, run.id);
    this.rebuild(run.actor_id, run.game_id, now);
  }

  private finish(id: string, result: { value: number; won: boolean; outcome?: number[] }, now = Date.now()) {
    const run = this.run(id);
    if (!run || run.status !== 'active' || !Number.isSafeInteger(result.value)) return;
    this.atomic(() => {
      const changed = this.db
        .prepare(
          "UPDATE leaderboard_runs SET status='finished',value=?,won=?,outcome=?,finished_at=?,updated_at=? WHERE id=? AND status='active'",
        )
        .run(result.value, Number(result.won), result.outcome ? JSON.stringify(result.outcome) : null, now, now, id);
      if (changed.changes) this.rebuild(run.actor_id, run.game_id, now);
    });
  }

  /** Leaving for good: a rated game is lost, other runs just stop counting. */
  forfeit(id: string, now = Date.now()) {
    const run = this.run(id);
    if (!run || run.status !== 'active') return;
    this.atomic(() => this.settle(run, now));
  }

  /** A server bot failure, a shared desk or developer help: the run never
   *  counted, and anything it added comes off again. */
  disqualify(id: string, now = Date.now()) {
    const run = this.run(id);
    if (!run || run.status !== 'active') return;
    this.atomic(() => {
      this.db
        .prepare("UPDATE leaderboard_runs SET status='disqualified',finished_at=?,updated_at=? WHERE id=? AND status='active'")
        .run(now, now, id);
      this.rebuild(run.actor_id, run.game_id, now);
    });
  }

  /** Recomputes a player's standings in one game from their runs, in play order. */
  rebuild(actor: string, gameId: LeaderboardGameId, now = Date.now()) {
    this.db.prepare('DELETE FROM leaderboard_standings WHERE actor_id=? AND board_key LIKE ?').run(actor, `${gameId}:%`);
    const insert = this.db.prepare('INSERT INTO leaderboard_standings VALUES (?,?,?,?,?,?,?,?)');
    const rated = this.db
      .prepare(
        "SELECT * FROM leaderboard_runs WHERE actor_id=? AND game_id=? AND kind='rating' AND status IN ('finished','forfeit') ORDER BY finished_at, id",
      )
      .all(actor, gameId) as Run[];
    if (rated.length) {
      const snapshot = this.db.prepare('UPDATE leaderboard_runs SET rating_before=?,rating_after=? WHERE id=?');
      let value = STARTING_RATING,
        wins = 0,
        streak = 0,
        best = 0,
        last = 0;
      for (const run of rated) {
        const outcome = JSON.parse(run.outcome ?? '[]') as number[];
        const after = value + ratingDelta(value, outcome);
        if (run.rating_before !== value || run.rating_after !== after) snapshot.run(value, after, run.id);
        value = after;
        if (run.won) {
          wins++;
          streak++;
        } else streak = 0;
        best = Math.max(best, streak);
        last = run.finished_at ?? now;
      }
      insert.run(boardKey(gameId, 'rating'), actor, value, rated.length, wins, streak, best, last);
    }
    const counted = this.db
      .prepare(
        `SELECT * FROM leaderboard_runs WHERE actor_id=? AND game_id=? AND (
          (kind IN ('score','puzzles') AND status='finished') OR
          (kind='progress' AND status IN ('active','finished') AND value>0)
        ) ORDER BY COALESCE(finished_at, updated_at), id`,
      )
      .all(actor, gameId) as Run[];
    const boards = new Map<string, Run[]>();
    for (const run of counted) boards.set(run.board_key, [...(boards.get(run.board_key) ?? []), run]);
    for (const [key, runs] of boards) {
      let best = -Infinity,
        bestAt = 0,
        wins = 0,
        streak = 0,
        bestStreak = 0;
      for (const run of runs) {
        const value = run.value ?? 0;
        // Ties keep the first time the record was reached.
        if (value > best) {
          best = value;
          bestAt = run.kind === 'progress' ? run.updated_at : (run.finished_at ?? run.updated_at);
        }
        if (run.kind === 'puzzles') {
          if (run.won) {
            wins++;
            streak++;
          } else streak = 0;
          bestStreak = Math.max(bestStreak, streak);
        }
      }
      insert.run(key, actor, best, runs.length, wins, streak, bestStreak, bestAt);
    }
  }

  private rankOf(key: string, value: number, actor: string) {
    const above = this.db
      .prepare(
        'SELECT COUNT(*) AS n FROM leaderboard_standings s JOIN users u ON u.id=s.actor_id WHERE s.board_key=? AND s.value>? AND s.actor_id<>?',
      )
      .get(key, value, actor) as { n: number };
    return above.n + 1;
  }
  private totalOf(key: string) {
    return (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM leaderboard_standings s JOIN users u ON u.id=s.actor_id WHERE s.board_key=?')
        .get(key) as { n: number }
    ).n;
  }
  private standing(key: string, actor: string) {
    return this.db.prepare('SELECT * FROM leaderboard_standings WHERE board_key=? AND actor_id=?').get(key, actor) as
      | Standing
      | undefined;
  }
  private nameOf(actor: string) {
    const row = this.db
      .prepare('SELECT COALESCE((SELECT name FROM users WHERE id=?),(SELECT name FROM guests WHERE id=?)) AS name')
      .get(actor, actor) as { name: string | null };
    return row.name ?? 'You';
  }

  board(gameId: string, view?: string | null, viewer?: string | null): LeaderboardResponse {
    const game = leaderboardGame(gameId);
    check(game, 400, 'Choose a game with a leaderboard.');
    const views = VIEWS[game.id];
    // A stale or unknown view falls back to the game's first board.
    const selected = views.find((v) => v.key === view) ?? views[0];
    const key = boardKey(game.id, selected.key);
    const entries = (
      this.db
        .prepare(
          `SELECT RANK() OVER (ORDER BY s.value DESC) AS rank, s.actor_id AS userId, u.name, s.value, s.games,
            s.wins, s.streak, s.best_streak AS bestStreak, s.updated_at AS updatedAt
          FROM leaderboard_standings s JOIN users u ON u.id=s.actor_id WHERE s.board_key=?
          ORDER BY s.value DESC, s.updated_at, s.actor_id LIMIT 50`,
        )
        .all(key) as LeaderboardEntry[]
    ).map((e) => ({ ...e }));
    let personal: PersonalEntry | null = null;
    const mine = viewer ? this.standing(key, viewer) : undefined;
    if (viewer && mine)
      personal = {
        rank: this.rankOf(key, mine.value, viewer),
        userId: viewer,
        name: this.nameOf(viewer),
        value: mine.value,
        games: mine.games,
        wins: mine.wins,
        streak: mine.streak,
        bestStreak: mine.best_streak,
        updatedAt: mine.updated_at,
        public: this.isPublic(viewer),
      };
    return { game, views, selectedView: selected.key, entries, personal, total: this.totalOf(key) };
  }

  /** The viewer's line on every board they have a result on. */
  me(viewer: string | null | undefined): LeaderboardSummary[] {
    if (!viewer) return [];
    const isPublic = this.isPublic(viewer);
    return (
      this.db.prepare('SELECT * FROM leaderboard_standings WHERE actor_id=? ORDER BY updated_at DESC').all(viewer) as Standing[]
    ).flatMap((s) => {
      const board = boardOf(s.board_key);
      if (!board) return [];
      return [
        {
          gameId: board.gameId,
          view: board.view.key,
          label: board.view.label,
          metric: board.view.metric,
          unit: board.view.unit,
          value: s.value,
          rank: this.rankOf(s.board_key, s.value, viewer),
          total: this.totalOf(s.board_key),
          games: s.games,
          wins: s.wins,
          streak: s.streak,
          bestStreak: s.best_streak,
          public: isPublic,
        },
      ];
    });
  }

  /** What the viewer's latest game in a room did to their standing. */
  result(room: string, viewer: string | null | undefined): RatedResult {
    check(viewer, 404, 'This game is not rated.');
    const run = this.db
      .prepare('SELECT * FROM leaderboard_runs WHERE room=? AND actor_id=? ORDER BY started_at DESC, rowid DESC LIMIT 1')
      .get(room, viewer) as Run | undefined;
    check(run, 404, 'This game is not rated.');
    check(run.status !== 'active', 409, 'This game is still on.');
    const board = boardOf(run.board_key);
    check(board, 404, 'This game is not rated.');
    const mine = this.standing(run.board_key, viewer);
    const counted = run.status === 'finished' || run.status === 'forfeit';
    const isRating = run.kind === 'rating';
    let before: number | null, after: number, newBest: boolean;
    if (isRating) {
      before = run.rating_before ?? STARTING_RATING;
      after = run.rating_after ?? before;
      newBest = false;
    } else {
      const earlier = this.db
        .prepare(
          `SELECT MAX(value) AS best FROM leaderboard_runs WHERE actor_id=? AND board_key=? AND id<>? AND (
            (kind IN ('score','puzzles') AND status='finished') OR (kind='progress' AND status IN ('active','finished') AND value>0)
          ) AND COALESCE(finished_at, updated_at) <= ?`,
        )
        .get(viewer, run.board_key, run.id, run.finished_at ?? run.updated_at) as { best: number | null };
      before = earlier.best;
      after = mine?.value ?? run.value ?? 0;
      newBest = counted && (run.value ?? 0) > (before ?? -Infinity);
    }
    const firstGame = isRating
      ? !this.db
          .prepare(
            "SELECT 1 FROM leaderboard_runs WHERE actor_id=? AND board_key=? AND status IN ('finished','forfeit') AND id<>? AND (finished_at<? OR (finished_at=? AND id<?))",
          )
          .get(viewer, run.board_key, run.id, run.finished_at, run.finished_at, run.id)
      : before === null;
    return {
      gameId: board.gameId,
      view: board.view.key,
      metric: board.view.metric,
      unit: board.view.unit,
      before,
      after,
      delta: after - (before ?? 0),
      runValue: run.value ?? 0,
      rank: mine ? this.rankOf(run.board_key, mine.value, viewer) : 0,
      previousRank: firstGame || before === null ? null : this.rankOf(run.board_key, before, viewer),
      total: this.totalOf(run.board_key),
      public: this.isPublic(viewer),
      streak: mine?.streak ?? 0,
      bestStreak: mine?.best_streak ?? 0,
      newBest,
      counted: counted && !!mine,
      ...(counted
        ? {}
        : { reason: run.status === 'disqualified' ? 'A bot failed, so this game does not count.' : 'This game was left unfinished.' }),
    };
  }

  /** The viewer's unfinished rated games (Nox, Mora, Yata and Rota rooms). */
  active(viewer: string | null | undefined) {
    if (!viewer) return [];
    return this.db
      .prepare(
        "SELECT id, game_id AS gameId, kind, room, label, started_at AS startedAt FROM leaderboard_runs WHERE actor_id=? AND status='active' AND kind IN ('rating','score') ORDER BY started_at DESC",
      )
      .all(viewer) as { id: string; gameId: LeaderboardGameId; kind: 'rating' | 'score'; room: string; label: string; startedAt: number }[];
  }

  /** A guest logged in to an existing account: their results join the
   *  account's, replayed in play order. Where both have an unfinished rated
   *  game of the same game, the account's stays and the guest's is settled.
   *  Returns the rooms of the runs it settled, which nobody should reopen. */
  merge(guest: string, account: string, now = Date.now()): string[] {
    if (guest === account) return [];
    return this.atomic(() => {
      const games = new Set(
        (this.db.prepare('SELECT DISTINCT game_id FROM leaderboard_runs WHERE actor_id=?').all(guest) as { game_id: LeaderboardGameId }[]).map(
          (r) => r.game_id,
        ),
      );
      const theirs = this.db
        .prepare("SELECT * FROM leaderboard_runs WHERE actor_id=? AND status='active' AND kind IN ('rating','score')")
        .all(guest) as Run[];
      const clash = this.db.prepare(
        "SELECT 1 FROM leaderboard_runs WHERE actor_id=? AND game_id=? AND kind IN ('rating','score') AND status='active'",
      );
      const settled: string[] = [];
      for (const run of theirs)
        if (clash.get(account, run.game_id)) {
          this.settle(run, now);
          settled.push(run.room);
        }
      this.db.prepare('UPDATE leaderboard_runs SET actor_id=? WHERE actor_id=?').run(account, guest);
      this.db.prepare('DELETE FROM leaderboard_standings WHERE actor_id=?').run(guest);
      // A launch retried after logging in still finds its game, unless that
      // game was just settled.
      for (const room of settled) this.db.prepare('DELETE FROM leaderboard_launches WHERE actor_id=? AND url=?').run(guest, room);
      this.db.prepare('UPDATE OR IGNORE leaderboard_launches SET actor_id=? WHERE actor_id=?').run(account, guest);
      this.db.prepare('DELETE FROM leaderboard_launches WHERE actor_id=?').run(guest);
      for (const game of games) this.rebuild(account, game, now);
      return settled;
    });
  }

  /** Account deletion: every run, standing and launch receipt goes. */
  forget(actor: string) {
    for (const table of ['leaderboard_runs', 'leaderboard_standings', 'leaderboard_launches'])
      this.db.prepare(`DELETE FROM ${table} WHERE actor_id=?`).run(actor);
  }

  /** A rated launch already answered for this request id, if any. */
  launch(actor: string, requestId: string) {
    return this.db
      .prepare('SELECT payload, url FROM leaderboard_launches WHERE actor_id=? AND request_id=?')
      .get(actor, requestId) as { payload: string; url: string } | undefined;
  }
  /** Keeps a launch's answer so a lost response can be retried; old ones go. */
  recordLaunch(actor: string, requestId: string, payload: string, url: string, now = Date.now()) {
    this.db.prepare('INSERT OR REPLACE INTO leaderboard_launches VALUES (?,?,?,?,?)').run(actor, requestId, payload, url, now);
    this.db.prepare('DELETE FROM leaderboard_launches WHERE created_at<?').run(now - 30 * 24 * 60 * 60_000);
    this.db
      .prepare(
        'DELETE FROM leaderboard_launches WHERE actor_id=? AND request_id NOT IN (SELECT request_id FROM leaderboard_launches WHERE actor_id=? ORDER BY created_at DESC LIMIT 100)',
      )
      .run(actor, actor);
  }

  observeTable(t: StoredTable, previous?: StoredTable) {
    const oldId = previous?.matchId ? `table:${previous.matchId}` : null;
    if (
      oldId &&
      (previous!.matchId !== t.matchId || !t.game || t.status === 'closed' || t.status === 'lobby')
    )
      this.forfeit(oldId);
    const g = t.game;
    if (!t.rankedSolo || !g || !t.matchId) return;
    const id = `table:${t.matchId}`;
    const humans = t.seats.filter((s) => !s.bot);
    if (
      g.tutorial ||
      g.difficulty !== 'hard' ||
      t.difficulty !== 'hard' ||
      humans.length !== 1 ||
      t.members.length !== 1 ||
      humans[0].id !== t.owner ||
      t.seats.length !== g.players.length
    ) {
      this.forfeit(id);
      return;
    }
    if (previous?.matchId !== t.matchId && g.phase !== 'over')
      this.start({
        id,
        actor: humans[0].id,
        gameId: g.id,
        view: 'rating',
        room: `/table/${t.token}`,
        label: trioLabel(g),
        opponents: g.players.length - 1,
      });
    if (g.phase === 'over') {
      const seat = t.seats.findIndex((s) => !s.bot);
      const outcome = trioOutcome(g, seat);
      this.finish(id, { value: scores(g)[seat], won: outcome.every((s) => s === 1), outcome });
    }
  }

  observeRota(r: RotaRoomState, previous?: RotaRoomState) {
    if (previous?.matchId && previous.matchId !== r.matchId) this.forfeit(`rota:${previous.matchId}`);
    if (!r.rankedSolo || !r.matchId) return;
    const id = `rota:${r.matchId}`;
    const humans = r.seats.filter((seat): seat is string => !!seat);
    const together = r.game.seats.length > 1;
    if (
      humans.length !== 1 ||
      humans[0] !== r.owner ||
      r.members.length !== 1 ||
      (together && r.game.difficulty !== 'hard') ||
      (!together && !MAP_IDS.includes(r.game.map as MapId))
    ) {
      this.forfeit(id);
      return;
    }
    if (previous?.matchId !== r.matchId && !r.game.over)
      this.start({
        id,
        actor: humans[0],
        gameId: 'rota',
        view: together ? 'rating' : r.game.map,
        room: `/rota/${r.token}`,
        label: rotaLabel(r.game),
        opponents: r.game.seats.length - 1,
      });
    if (r.game.over && r.game.final) {
      const seat = r.seats.indexOf(humans[0]);
      if (together) {
        const outcome = rotaOutcome(r.game.final, seat);
        this.finish(id, { value: r.game.final[seat].total, won: outcome.every((s) => s === 1), outcome });
      } else this.finish(id, { value: rotaCoreScore(r.game.final[seat]), won: false });
    }
  }

  startFolio(invite: string, game: FolioGame, actor: string) {
    if (game.seats === 1 && !game.practice)
      this.start({
        id: `folio:${invite}`,
        actor,
        gameId: 'folio',
        view: levels[game.difficulty - 1] ?? 'easy',
        room: `/folio/${invite}`,
        label: (levels[game.difficulty - 1] ?? 'easy').replace(/^./, (c) => c.toUpperCase()),
        now: game.startedAt,
      });
  }
  observeFolio(invite: string, game: FolioGame, members: string[]) {
    const id = `folio:${invite}`;
    if (game.practice || game.seats !== 1 || members.length !== 1) return this.forfeit(id);
    if (game.phase === 'over')
      this.finish(id, { value: game.path.filter((step) => step.won).length, won: game.victory }, game.updatedAt);
  }

  startLucky(invite: string, game: RelicGame, actor: string) {
    const scratch = scratchFor(game);
    if (!game.devUnlimited && scratch.completed === 0 && !Object.values(scratch.xp).some((xp) => xp > 0))
      this.start({
        id: `relic:${invite}`,
        actor,
        gameId: 'relic',
        view: 'desk',
        room: `/expedition/${invite}`,
        label: 'Solo desk',
      });
  }
  observeLucky(invite: string, game: RelicGame, members: string[], now = Date.now()) {
    const id = `relic:${invite}`,
      run = this.run(id);
    if (!run || run.status !== 'active') return;
    if (game.devUnlimited || members.length !== 1 || members[0] !== run.actor_id) return this.disqualify(id, now);
    const scratch = scratchFor(game);
    const value = scratch.unlocked.reduce((total, book) => total + Math.max(0, bookLevel(scratch, book) - 1), 0);
    if (!Number.isSafeInteger(value) || value === run.value) return;
    this.atomic(() => {
      this.db.prepare("UPDATE leaderboard_runs SET value=?,updated_at=? WHERE id=? AND status='active'").run(value, now, id);
      this.rebuild(run.actor_id, 'relic', now);
    });
  }
  /** Deleting an eligible solo desk keeps the progress already earned there. */
  finishLucky(invite: string, now = Date.now()) {
    this.db
      .prepare("UPDATE leaderboard_runs SET status='finished',finished_at=?,updated_at=updated_at WHERE id=? AND status='active'")
      .run(now, `relic:${invite}`);
  }
}
