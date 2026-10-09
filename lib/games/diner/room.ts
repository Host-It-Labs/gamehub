import { HATS, type Look } from './content.ts';
import type {
  DinerConfig,
  DinerEvent,
  Guest,
  GuestState,
  Input,
  Match,
  Player,
} from './engine.ts';

/**
 * The shapes an online Diner room sends. A table launches a room with its
 * people as waiters (one to four, no bots). The server runs the one true
 * shift thirty steps a second; each device sends its own stick and button
 * presses and draws everyone else from the server's snapshots. Routes (see
 * server/diner.ts):
 *
 * - `GET  /api/diner/<token>`          → DinerJoin (joining, resyncing)
 * - `GET  /api/diner/<token>/events`   → event stream:
 *     `event: room` DinerRoomView when seats or status change,
 *     `event: snap` DinerSnapshot about twelve times a second,
 *     `event: gone` when the room is removed.
 * - `POST /api/diner/<token>/input`    { round, frames } → { ok: true }: your
 *     recent input steps (repeated until acknowledged, so a lost request
 *     loses nothing).
 * - `POST /api/diner/<token>/again`    { level? } → the host starts the next
 *     shift once one is over (the same level, or another).
 */
export type DinerSeatView = { name: string; connected: boolean };

export type DinerRoomView = {
  token: string;
  /** The free-play level the room plays (lib/games/diner/levels.ts). */
  level: number;
  seats: DinerSeatView[];
  /** The viewer's waiter. */
  you: number;
  /** The viewer starts the next shift. */
  host: boolean;
  status: 'waiting' | 'playing' | 'over';
  /** Counts shifts in this room; inputs name the one they are for. */
  round: number;
  /** The table that launched the room, to go back to. */
  table: string | null;
};

/** One input step: [seq, stick x in sixteenths, stick z in sixteenths, flags (1 use, 2 out, 4 dash)]. */
export type Frame = [number, number, number, number];

export type DinerSnapshot = {
  /** Server step count (keeps running before the doors open). */
  n: number;
  round: number;
  /** Per waiter: the last input step the server applied. */
  a: number[];
  /** The match, packed (`packMatch`); `unpackMatch` reads it. */
  m: unknown;
  /** Events since the previous snapshot. */
  e: DinerEvent[];
};

export type DinerJoin = { room: DinerRoomView; snap: DinerSnapshot };

/** How long a new shift waits for everyone's stream before opening anyway. */
export const JOIN_MS = 15_000;

export function encodeFrame(seq: number, input: Input): Frame {
  return [
    seq,
    Math.round(Math.max(-1, Math.min(1, input.mx)) * 16),
    Math.round(Math.max(-1, Math.min(1, input.mz)) * 16),
    (input.use ? 1 : 0) | (input.out ? 2 : 0) | (input.dash ? 4 : 0),
  ];
}

export function decodeFrame(f: Frame): Input {
  return {
    mx: f[1] / 16,
    mz: f[2] / 16,
    use: (f[3] & 1) === 1,
    out: (f[3] & 2) === 2,
    dash: (f[3] & 4) === 4,
  };
}

export function validFrame(f: unknown): f is Frame {
  return (
    Array.isArray(f) &&
    f.length === 4 &&
    Number.isInteger(f[0]) &&
    f[0] >= 0 &&
    Number.isInteger(f[1]) &&
    Math.abs(f[1]) <= 16 &&
    Number.isInteger(f[2]) &&
    Math.abs(f[2]) <= 16 &&
    Number.isInteger(f[3]) &&
    f[3] >= 0 &&
    f[3] <= 7
  );
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;
const STATES: GuestState[] = ['walk', 'wait', 'follow', 'sit', 'goo', 'gone'];
const lookCode = (l: Look) =>
  `${l.skin}${l.hair}${HATS.indexOf(l.hat)}${l.shirt}${l.stripes ? 1 : 0}${l.glasses ? 1 : 0}`;
const lookOf = (c: string): Look => ({
  skin: Number(c[0]),
  hair: Number(c[1]),
  hat: HATS[Number(c[2])] ?? 'none',
  shirt: Number(c[3]),
  stripes: c[4] === '1',
  glasses: c[5] === '1',
});

type PackedGuest = [
  number,
  number,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string | null,
  number,
];
type PackedPlayer = [
  string,
  number,
  number,
  number,
  number,
  number,
  Player['hands'],
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * A match as sent over the wire, about a tenth of its plain JSON: guests
 * and waiters as short rows, trails and paths left on the server,
 * positions rounded to millimetres. The level's rules stay behind too:
 * every device builds them from the room's level number.
 */
export function packMatch(m: Match): string {
  const { guests, players, events: _events, config: _config, ...rest } = m;
  void _events;
  void _config;
  return JSON.stringify({
    ...rest,
    G: guests.map(
      (x): PackedGuest => [
        x.id,
        x.group,
        lookCode(x.look),
        x.mimic ? 1 : 0,
        r3(x.x),
        r3(x.z),
        r2(x.fx),
        r2(x.fz),
        STATES.indexOf(x.state),
        x.seat,
        x.dish,
        x.served ? 1 : 0,
      ],
    ),
    P: players.map(
      (p): PackedPlayer => [
        p.name,
        r3(p.x),
        r3(p.z),
        r2(p.fx),
        r2(p.fz),
        p.moving ? 1 : 0,
        p.hands,
        p.lead,
        p.mop,
        p.mopping,
        p.seq,
        p.dash,
        p.dashCool,
      ],
    ),
  });
}

/** The other end of `packMatch`: a match the rules and the view can use. */
export function unpackMatch(raw: unknown, config?: DinerConfig): Match {
  const o = raw as Omit<Match, 'guests' | 'players' | 'events' | 'config'> & {
    G: PackedGuest[];
    P: PackedPlayer[];
  };
  const { G, P, ...rest } = o;
  return {
    ...rest,
    ...(config ? { config } : {}),
    events: [],
    guests: G.map((g) => ({
      id: g[0],
      group: g[1],
      look: lookOf(g[2]),
      mimic: g[3] === 1,
      x: g[4],
      z: g[5],
      px: g[4],
      pz: g[5],
      fx: g[6],
      fz: g[7],
      state: STATES[g[8]] ?? 'wait',
      path: [],
      speed: 0,
      seat: g[9],
      dish: g[10] as Guest['dish'],
      served: g[11] === 1,
    })),
    players: P.map((p) => ({
      name: p[0],
      x: p[1],
      z: p[2],
      px: p[1],
      pz: p[2],
      fx: p[3],
      fz: p[4],
      moving: p[5] === 1,
      hands: p[6],
      lead: p[7],
      mop: p[8],
      mopping: p[9],
      trail: [],
      seq: p[10],
      dash: p[11],
      dashCool: p[12],
    })),
  };
}
