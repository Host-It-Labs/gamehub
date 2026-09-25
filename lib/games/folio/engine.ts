import {
  KINDS,
  type Action,
  type Difficulty,
  type Edit,
  type FolioGame,
  type Kind,
  type Level,
  type MapNode,
  type PublicGame,
} from './types.ts';
import { BOSS_EVERY, LANES, START_LIVES } from './catalog.ts';
import { hash, requireThat, rng, shuffle } from './kind.ts';
import { KIND_MODULES } from './kinds/index.ts';

export const isBossRow = (row: number) => (row + 1) % BOSS_EVERY === 0;
export const actOf = (row: number) => Math.floor(row / BOSS_EVERY);
/** Every act is one level harder than the last, up to very hard. */
export const levelFor = (row: number, difficulty: Difficulty) =>
  Math.min(4, difficulty + actOf(row)) as Level;
const parentsOf = (map: MapNode[], n: MapNode) =>
  map.filter((p) => p.next.includes(n.id));
/** Games a node may take without repeating its row or a linked stop. */
function allowedKinds(map: MapNode[], n: MapNode, struck: Kind[]) {
  const avoid = new Set<Kind>([
    ...struck,
    ...map.filter((m) => m.row === n.row && m.id !== n.id).map((m) => m.kind),
    ...parentsOf(map, n).map((m) => m.kind),
    ...map.filter((m) => n.next.includes(m.id)).map((m) => m.kind),
  ]);
  return KINDS.filter((k) => !avoid.has(k));
}
/** Acts on the map at the start: the first, and the one after it. */
const OPENING_ACTS = 2;
/** A strike is only offered while this many games stay on the trail. */
const MIN_KINDS = 6;
/** Bosses avoid repeating any of the last few bosses. */
const BOSS_MEMORY = 3;
/**
 * Append the next act to a Slay-the-Spire style trail: three puzzle rounds,
 * then a boss every lane converges on. Every pair of neighbouring lanes is
 * linked by one diagonal, so paths never cross and no stop hangs off a single
 * lane. The previous boss leads to every stop of the new act's first round.
 */
export function extendMap(
  map: MapNode[],
  seed: number,
  difficulty: Difficulty,
  struck: Kind[] = [],
) {
  const act = map.length ? actOf(Math.max(...map.map((n) => n.row))) + 1 : 0;
  const random = rng(hash(`map:${seed}:${act}`));
  const first = act * BOSS_EVERY;
  const rows: MapNode[][] = [];
  for (let row = first; row < first + BOSS_EVERY; row++) {
    const boss = isBossRow(row);
    rows.push(
      Array.from({ length: boss ? 1 : LANES }, (_, lane) => ({
        id: `r${row}l${boss ? 1 : lane}`,
        row,
        lane: boss ? 1 : lane,
        type: boss ? 'boss' : 'puzzle',
        kind: KINDS[0],
        level: levelFor(row, difficulty),
        next: [],
      })),
    );
  }
  const before = map.filter((n) => n.row === first - 1);
  for (const n of before) n.next = rows[0].map((b) => b.id);
  for (let i = 0; i < rows.length - 1; i++) {
    const here = rows[i],
      there = rows[i + 1];
    if (here.length === 1 || there.length === 1) {
      for (const a of here) a.next = there.map((b) => b.id);
      continue;
    }
    for (let lane = 0; lane < LANES; lane++) here[lane].next = [there[lane].id];
    for (let lane = 0; lane < LANES - 1; lane++) {
      if (random() < 0.5) here[lane].next.push(there[lane + 1].id);
      else here[lane + 1].next.push(there[lane].id);
    }
  }
  map.push(...rows.flat());
  // Give every node a game that differs from its row and its parents.
  const pastBosses = map
    .filter((n) => n.type === 'boss' && n.row < first)
    .sort((a, b) => b.row - a.row)
    .slice(0, BOSS_MEMORY)
    .map((n) => n.kind);
  const bossKind = shuffle(
    KINDS.filter((k) => !struck.includes(k)),
    random,
  ).find((k) => !pastBosses.includes(k));
  for (const row of rows) {
    const used = new Set<Kind>();
    for (const node of row) {
      const avoid = new Set([
        ...struck,
        ...used,
        ...parentsOf(map, node).map((p) => p.kind),
      ]);
      const wanted = node.type === 'boss' ? bossKind : null;
      node.kind =
        wanted && !avoid.has(wanted)
          ? wanted
          : (shuffle(KINDS, random).find((k) => !avoid.has(k)) ??
            shuffle(KINDS, random).find((k) => !used.has(k))!);
      used.add(node.kind);
    }
  }
  return map;
}
/** The opening trail: the first act and the one after it. */
export function makeMap(seed: number, difficulty: Difficulty = 1): MapNode[] {
  const map: MapNode[] = [];
  for (let a = 0; a < OPENING_ACTS; a++) extendMap(map, seed, difficulty);
  return map;
}
/**
 * After a boss, three small edits to the trail ahead: strike one of two games
 * from every later stop, or swap one stop of the next act. Replacements are
 * worked out now, so the crew sees exactly what each edit does.
 */
export function makeEdits(g: FolioGame, bossRow: number): Edit[] {
  const random = rng(hash(`edit:${g.seed}:${bossRow}`));
  const ahead = g.map.filter((n) => n.row > bossRow);
  const edits: Edit[] = [];
  const present = shuffle([...new Set(ahead.map((n) => n.kind))], random);
  for (const kind of present) {
    if (edits.length === 2 || KINDS.length - g.struck.length <= MIN_KINDS)
      break;
    const map = structuredClone(g.map);
    const struck = [...g.struck, kind];
    const changes: { node: string; to: Kind }[] = [];
    for (const n of map.filter((m) => m.row > bossRow && m.kind === kind)) {
      const to = shuffle(allowedKinds(map, n, struck), random)[0];
      if (!to) break;
      n.kind = to;
      changes.push({ node: n.id, to });
    }
    if (changes.length === ahead.filter((n) => n.kind === kind).length)
      edits.push({ type: 'strike', kind, changes });
  }
  const next = shuffle(
    ahead.filter(
      (n) => n.type === 'puzzle' && actOf(n.row) === actOf(bossRow) + 1,
    ),
    random,
  );
  for (const n of next) {
    const to = shuffle(
      allowedKinds(g.map, n, [...g.struck, n.kind]),
      random,
    )[0];
    if (!to) continue;
    edits.push({ type: 'swap', kind: n.kind, changes: [{ node: n.id, to }] });
    break;
  }
  return edits;
}
export function choices(g: FolioGame): string[] {
  if (g.phase !== 'map') return [];
  const at = g.map.find((n) => n.id === g.at);
  return at ? at.next : g.map.filter((n) => n.row === 0).map((n) => n.id);
}
export function round(g: FolioGame) {
  const at = g.map.find((n) => n.id === g.at);
  return at ? at.row + 1 : 0;
}
export function createFolio(
  seed: number,
  seats: number,
  now = Date.now(),
  practice?: { kind: Kind; boss: boolean },
  difficulty: Difficulty = 1,
): FolioGame {
  requireThat(
    Number.isInteger(seats) && seats >= 1 && seats <= 3,
    'Choose one to three seats.',
  );
  requireThat([1, 2, 3].includes(difficulty), 'Choose a difficulty.');
  const g: FolioGame = {
    version: 3,
    revision: 0,
    seed,
    seats: practice ? 1 : seats,
    difficulty,
    phase: seats > 1 && !practice ? 'lobby' : 'map',
    lives: START_LIVES,
    maxLives: START_LIVES,
    map: practice ? [] : makeMap(seed, difficulty),
    struck: [],
    path: [],
    edits: [],
    victory: false,
    startedAt: now,
    updatedAt: now,
  };
  if (practice) {
    g.practice = practice;
    open(g, practice.kind, practice.boss ? 3 : 1, practice.boss, seed);
  }
  return g;
}
/** Lock the table: whoever has joined is the crew, and play begins. */
export function startFolio(g: FolioGame, players: number, now = Date.now()) {
  requireThat(g.phase === 'lobby', 'This run has already started.');
  requireThat(players >= 1 && players <= 3, 'Someone needs to be seated.');
  g.seats = players;
  g.phase = 'map';
  g.revision++;
  g.updatedAt = now;
}
export function observeFolio(g: FolioGame): PublicGame {
  const { secret: _secret, seed: _seed, ...visible } = g;
  return structuredClone(visible);
}
function open(
  g: FolioGame,
  kind: Kind,
  level: Level,
  boss: boolean,
  seed: number,
) {
  const made = KIND_MODULES[kind].make({ level, boss, seed });
  g.puzzle = {
    kind,
    boss,
    level,
    remaining: made.allowance,
    allowance: made.allowance,
    budget: made.budget,
    status: 'playing',
    view: made.view,
  };
  g.secret = made.secret;
  g.phase = 'puzzle';
}
function finish(g: FolioGame, won: boolean) {
  const p = g.puzzle!;
  p.status = won ? 'won' : 'lost';
  const answer = KIND_MODULES[p.kind].reveal(p.view, g.secret, won);
  if (!won) g.lives--;
  if (g.at) g.path.push({ id: g.at, won });
  const here = g.map.find((n) => n.id === g.at);
  g.result = {
    won,
    answer,
    message: won
      ? p.boss && here
        ? levelFor(here.row + 1, g.difficulty) > p.level
          ? 'The next act is one level harder.'
          : 'Another act at very hard.'
        : 'Solved.'
      : g.lives > 0
        ? 'Lost. One life left: no more mistakes.'
        : 'Lost.',
  };
  if (g.practice || !g.lives) {
    g.phase = 'over';
    g.victory = !!g.practice && won;
    return;
  }
  g.phase = 'result';
  // Keep one act ahead on the map, so the crew can always look forward.
  if (won && p.boss && here) {
    while (actOf(Math.max(...g.map.map((n) => n.row))) <= actOf(here.row) + 1)
      extendMap(g.map, g.seed, g.difficulty, g.struck);
  }
  g.edits = won && p.boss && here ? makeEdits(g, here.row) : [];
}
function toMap(g: FolioGame) {
  g.phase = 'map';
  delete g.puzzle;
  delete g.secret;
  delete g.result;
  g.edits = [];
}
export function actFolio(g: FolioGame, action: Action, now = Date.now()) {
  requireThat(action && typeof action === 'object', 'Choose an action.');
  requireThat(g.phase !== 'over', 'This run has ended.');
  requireThat(g.phase !== 'lobby', 'Waiting for the table to fill.');
  if (action.type === 'node') {
    requireThat(choices(g).includes(action.id), 'That path is not open.');
    const node = g.map.find((n) => n.id === action.id)!;
    g.at = node.id;
    open(
      g,
      node.kind,
      node.level,
      node.type === 'boss',
      hash(`${g.seed}:${node.id}`),
    );
  } else if (action.type === 'edit') {
    requireThat(
      g.phase === 'result' &&
        Number.isInteger(action.index) &&
        !!g.edits[action.index],
      'Choose one of the offered changes.',
    );
    const edit = g.edits[action.index];
    for (const c of edit.changes)
      g.map.find((n) => n.id === c.node)!.kind = c.to;
    if (edit.type === 'strike') g.struck.push(edit.kind);
    toMap(g);
  } else if (action.type === 'continue') {
    requireThat(g.phase === 'result', 'Finish the puzzle first.');
    toMap(g);
  } else if (
    action.type === 'give-up' ||
    action.type === 'dev-win' ||
    action.type === 'move'
  ) {
    requireThat(
      g.phase === 'puzzle' && g.puzzle && g.puzzle.status === 'playing',
      'Open a puzzle first.',
    );
    if (action.type === 'give-up') finish(g, false);
    else if (action.type === 'dev-win') finish(g, true);
    else if (action.type === 'move') {
      requireThat(
        action.move &&
          typeof action.move === 'object' &&
          !Array.isArray(action.move),
        'Use the puzzle controls.',
      );
      const p = g.puzzle;
      const { cost, solved } = KIND_MODULES[p.kind].move(
        p.view,
        g.secret,
        action.move,
      );
      p.remaining = Math.max(0, p.remaining - cost);
      if (solved) finish(g, true);
      else if (p.remaining <= 0) finish(g, false);
    }
  } else throw new Error('That action is not supported.');
  g.revision++;
  g.updatedAt = now;
}
