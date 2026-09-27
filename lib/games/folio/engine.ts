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
import {
  BOSS_EVERY,
  LANES,
  REROLL_AFTER,
  START_LIVES,
  SUGGESTION_LIMIT,
} from './catalog.ts';
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
 * After a boss the crew may take one game out of the run: any of the ten not
 * struck yet, while more than `MIN_KINDS` stay on the trail. Every later stop
 * of that game is replaced now, so the crew sees exactly what the strike does.
 */
export function makeEdits(g: FolioGame, bossRow: number): Edit[] {
  if (KINDS.length - g.struck.length <= MIN_KINDS) return [];
  const random = rng(hash(`edit:${g.seed}:${bossRow}`));
  const edits: Edit[] = [];
  for (const kind of KINDS) {
    if (g.struck.includes(kind)) continue;
    const map = structuredClone(g.map);
    const struck = [...g.struck, kind];
    const doomed = map.filter((m) => m.row > bossRow && m.kind === kind);
    const changes: { node: string; to: Kind }[] = [];
    for (const n of doomed) {
      const to = shuffle(allowedKinds(map, n, struck), random)[0];
      if (!to) break;
      n.kind = to;
      changes.push({ node: n.id, to });
    }
    if (changes.length === doomed.length)
      edits.push({ type: 'strike', kind, changes });
  }
  return edits;
}
/** Games a rerolled boss may become: none of its linked stops, preferably not
 * one of the last few bosses either. */
function rerollKinds(g: FolioGame, boss: MapNode) {
  const recent = g.map
    .filter((n) => n.type === 'boss' && n.row < boss.row)
    .sort((a, b) => b.row - a.row)
    .slice(0, BOSS_MEMORY)
    .map((n) => n.kind);
  const allowed = allowedKinds(g.map, boss, g.struck).filter(
    (k) => k !== boss.kind,
  );
  const fresh = allowed.filter((k) => !recent.includes(k));
  return fresh.length ? fresh : allowed;
}
/**
 * The boss the crew may reroll now: the boss of the act they are in, once
 * `REROLL_AFTER` of its rounds are played, and only once per act.
 */
export function rerollTarget(g: FolioGame): MapNode | undefined {
  if (g.phase !== 'map' || g.practice) return;
  const at = g.map.find((n) => n.id === g.at);
  if (!at || at.type === 'boss' || (at.row % BOSS_EVERY) + 1 < REROLL_AFTER)
    return;
  const act = actOf(at.row);
  if (g.rerolled?.includes(act)) return;
  const boss = g.map.find((n) => n.type === 'boss' && actOf(n.row) === act);
  return boss && rerollKinds(g, boss).length ? boss : undefined;
}
/** What a member may vote for: an open path, or a change after a boss. */
export function voteTargets(g: FolioGame): string[] {
  if (g.phase === 'map') return choices(g);
  if (g.phase === 'result' && g.edits.length)
    return [...g.edits.map((_, i) => `edit:${i}`), 'keep'];
  return [];
}
/**
 * A member's pick, shown to the whole crew; `null` takes it back. Only the
 * host's own choice moves the crew. A vote does not bump the revision, so it
 * never makes the host's move stale.
 */
export function voteFolio(
  g: FolioGame,
  member: string,
  target: string | null,
  now = Date.now(),
) {
  requireThat(
    g.phase === 'map' || g.phase === 'result',
    'Nothing to pick now.',
  );
  requireThat(
    target === null ||
      (typeof target === 'string' && voteTargets(g).includes(target)),
    'That choice is not open.',
  );
  const votes = { ...g.votes };
  if (target === null) delete votes[member];
  else votes[member] = target;
  g.votes = votes;
  g.updatedAt = now;
}
const moveKey = (move: Record<string, unknown>) =>
  JSON.stringify(Object.keys(move).sort().map((k) => [k, move[k]]));
/** Plays a move on a copy of the puzzle; throws the original game's refusal
 * if it could not be played. Nothing is spent or shown. */
function tryMove(g: FolioGame, move: Record<string, unknown>) {
  const p = g.puzzle!;
  KIND_MODULES[p.kind].move(
    structuredClone(p.view),
    structuredClone(g.secret),
    move,
  );
}
/** After the board changes, drop the move just played and any suggestion
 * that no longer fits the board. */
function pruneSuggestions(g: FolioGame, played?: Record<string, unknown>) {
  if (g.phase !== 'puzzle' || g.puzzle?.status !== 'playing') {
    delete g.suggestions;
    return;
  }
  const key = played && moveKey(played);
  g.suggestions = (g.suggestions ?? []).filter((s) => {
    if (moveKey(s.move) === key) return false;
    try {
      tryMove(g, s.move);
      return true;
    } catch {
      return false;
    }
  });
}
/**
 * A teammate offers a move to the host. It is checked the way the original
 * checks it (a word not in the list is refused at once) but not played. Like
 * a vote it leaves the revision alone, so the host's own move is never stale.
 */
export function suggestFolio(
  g: FolioGame,
  member: string,
  move: Record<string, unknown>,
  now = Date.now(),
) {
  requireThat(
    g.phase === 'puzzle' && g.puzzle?.status === 'playing',
    'Open a puzzle first.',
  );
  requireThat(
    move && typeof move === 'object' && !Array.isArray(move),
    'Use the puzzle controls.',
  );
  tryMove(g, move);
  const list = g.suggestions ?? [];
  const same = list.find((s) => moveKey(s.move) === moveKey(move));
  if (same) {
    if (!same.by.includes(member)) same.by.push(member);
  } else {
    requireThat(
      list.filter((s) => s.by.includes(member)).length < SUGGESTION_LIMIT,
      'Wait for the host to answer your suggestions.',
    );
    g.suggested = (g.suggested ?? 0) + 1;
    list.push({ id: `s${g.suggested}`, by: [member], move, at: now });
  }
  g.suggestions = list;
  g.updatedAt = now;
}
/** The host plays a suggestion as their own move. */
export function acceptSuggestion(g: FolioGame, id: string, now = Date.now()) {
  const s = g.suggestions?.find((x) => x.id === id);
  requireThat(s, 'That suggestion was already answered.');
  actFolio(g, { type: 'move', move: s.move }, now);
}
/** The host turns a suggestion down; anyone else takes their name off it. */
export function dismissSuggestion(
  g: FolioGame,
  member: string,
  id: string,
  host: boolean,
  now = Date.now(),
) {
  const s = g.suggestions?.find((x) => x.id === id);
  requireThat(s, 'That suggestion was already answered.');
  requireThat(host || s.by.includes(member), 'Only the host answers suggestions.');
  s.by = host ? [] : s.by.filter((m) => m !== member);
  g.suggestions = g.suggestions!.filter((x) => x.by.length);
  g.updatedAt = now;
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
  delete g.suggestions;
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
  delete g.votes;
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
    delete g.votes;
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
  } else if (action.type === 'reroll') {
    const boss = rerollTarget(g);
    requireThat(boss, 'The boss can be rerolled once per act, after round 2.');
    const random = rng(hash(`reroll:${g.seed}:${boss.id}`));
    boss.kind = shuffle(rerollKinds(g, boss), random)[0];
    g.rerolled = [...(g.rerolled ?? []), actOf(boss.row)];
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
    pruneSuggestions(g, action.type === 'move' ? action.move : undefined);
  } else throw new Error('That action is not supported.');
  g.revision++;
  g.updatedAt = now;
}
