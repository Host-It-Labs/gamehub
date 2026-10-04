import {
  canPlaceAnywhere,
  looseEnds,
  neighbour,
  networks,
  longest,
  placements,
  quickLongest,
  withCells,
  type Placed,
  type Sheet,
} from './board.ts';
import {
  mandatory,
  openDice,
  sheetOf,
  specialsLeft,
  type RotaGame,
  type RotaMove,
} from './engine.ts';
import { RAIL, RIVER, ROAD, SPECIALS_PER_MATCH, opposite, orient, type PieceId } from './pieces.ts';
import {
  OUTLET_POINTS,
  RIVER_POINTS,
  townPoints,
  TUNNEL_POINTS,
  exitPoints,
  plans as planDefs,
} from './score.ts';

/**
 * Rota's bots see only what a player sees: the dice, the map and their own
 * sheet. They place a round greedily against a heuristic that values what
 * the sheet scores now and what it can still become: loose ends pointing at
 * open ground cost less early in the match than ends that can never close.
 */
type Ctx = {
  g: RotaGame;
  seat: number;
  /** 0 on the first round, 1 on the last. */
  late: number;
  noise: number;
  rand: () => number;
  /** This seat's own leanings, so bots at one level still differ. */
  w: typeof weights;
};

function seeded(seed: number) {
  let s = seed >>> 0 || 7;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Tuning weights, kept together so simulations can compare them. */
export const weights = {
  growth: 1.6,
  lonely: 1.2,
  blockedExit: 2,
  loose: 0.6,
  clash: 0.8,
};

/** Each seat leans a little differently: some chase exits, some tidy up. */
function personality(seat: number): typeof weights {
  const lean = [
    [1, 1, 1],
    [1.25, 0.9, 1],
    [0.8, 1.15, 1.1],
    [1.1, 1.1, 0.85],
    [0.9, 0.85, 1.2],
    [1.2, 1.2, 1],
  ][seat % 6];
  return {
    ...weights,
    growth: weights.growth * lean[0],
    loose: Math.min(0.95, weights.loose * lean[1]),
    clash: Math.min(1, weights.clash * lean[2]),
  };
}

/** A heuristic value for one sheet. */
function evaluate(s: Sheet, c: Ctx): number {
  const { g, late } = c;
  const W = c.w;
  const nets = networks(s);
  const total = s.map.exits.length;
  const netOf = new Map<number, number>();
  nets.forEach((n, i) => n.cells.forEach((x) => netOf.set(x, i)));
  const growth = nets.map(() => 0);
  for (const e of looseEnds(s)) {
    const n = neighbour(s.map, e.cell, e.dir);
    if (n >= 0 && !s.blocked[n] && !s.cells[n]) {
      const k = netOf.get(e.cell);
      if (k !== undefined) growth[k]++;
    }
  }
  let v = 0;
  nets.forEach((n, i) => {
    v += exitPoints(n.exits.length, total);
    // A network still growing may reach another exit.
    if (n.exits.length && growth[i])
      v += W.growth * Math.min(2, growth[i]) * (1 - late) * Math.min(3, n.exits.length) / 2;
    else if (n.exits.length === 1) v += W.lonely * (1 - late);
  });
  // An exit whose square holds a piece that turns its back on it is lost.
  s.map.exits.forEach((ex) => {
    const t = s.cells[ex.cell];
    if (t && orient(t.p, t.o).edges[ex.dir] !== ex.route) v -= W.blockedExit * (1 - late * 0.5);
  });
  v += quickLongest(s, ROAD) * 0.9;
  v += quickLongest(s, RAIL) * 0.9;
  v += s.map.centre.filter((i) => s.cells[i]).length;
  v += s.map.peaks.filter((i) => s.cells[i]).length * TUNNEL_POINTS;
  // Loose ends: open ground may still close them; the rest never will.
  for (const e of looseEnds(s)) {
    const n = neighbour(s.map, e.cell, e.dir);
    const open = n >= 0 && !s.blocked[n] && !s.cells[n];
    if (!open) {
      v -= 1;
      continue;
    }
    // A square wanted by a road and a rail at once can take neither easily.
    const wants = new Set<number>();
    for (let d = 0; d < 4; d++) {
      const m = neighbour(s.map, n, d);
      const exit = s.exits[n * 4 + d];
      if (exit) wants.add(exit);
      if (m < 0 || !s.cells[m]) continue;
      const t = s.cells[m]!;
      const f = orient(t.p, t.o).edges[opposite(d)];
      if (f === ROAD || f === RAIL) wants.add(f);
    }
    v -= wants.size > 1 ? W.clash + (1 - W.clash) * late : W.loose + (1 - W.loose) * late;
  }
  if (g.ext.rivers) {
    const r = longest(s, RIVER, 400);
    v += r.length * RIVER_POINTS + (r.outlet ? OUTLET_POINTS : 0);
    // One long river beats scattered ones; an open end may still run on.
    let rivers = 0;
    for (const x of s.cells) if (x && orient(x.p, x.o).edges.includes(RIVER)) rivers++;
    v -= (rivers - r.length) * 1.2;
    if (!r.outlet && r.length) {
      const tail = r.cells[r.cells.length - 1];
      const t = s.cells[tail]!;
      const edges = orient(t.p, t.o).edges;
      for (let d = 0; d < 4; d++) {
        if (edges[d] !== RIVER) continue;
        const m = neighbour(s.map, tail, d);
        if (m >= 0 && !s.blocked[m] && !s.cells[m]) {
          v += 2 * (1 - late);
          break;
        }
      }
    }
  }
  if (g.ext.towns && g.towns.length) {
    for (const t of g.towns) {
      const k = nets.findIndex((n) => n.cells.includes(t));
      v += townPoints(nets, t);
      // A town on a network still growing may link more exits later.
      if (k >= 0 && growth[k]) v += 0.8 * (1 - late);
    }
  }
  if (g.ext.plans) {
    g.plans.forEach((id, k) => {
      if (g.seats[c.seat].plans[k]) return;
      const p = planDefs[id].progress(s);
      if (p.have >= p.of) v += planDefs[id].first;
      else v += planDefs[id].first * 0.35 * (p.have / p.of) ** 2 * (1 - late * 0.7);
    });
  }
  // Rockfall aims at its square for this round: filling it saves the space.
  const strike = g.strikes[g.round - 1] ?? -1;
  if (strike >= 0 && s.cells[strike]) v += 0.6;
  return v;
}

type Node = {
  cells: (Placed | null)[];
  moves: RotaMove[];
  dice: number[];
  special: boolean;
  value: number;
};

/**
 * A beam search over the round: each step places one open die (or a
 * special, or lets the river go) and keeps the best `width` sheets. Dice
 * that must go down are placed whenever they can be.
 */
function search(g: RotaGame, seat: number, c: Ctx, width: number, specialBar: number) {
  const base = sheetOf(g, seat);
  const specials = c.g.difficulty === 'easy' ? [] : specialsLeft(g, seat);
  let beam: Node[] = [
    {
      cells: [...base.cells],
      moves: [],
      dice: openDice(g, seat),
      special: !specials.length,
      value: evaluate(base, c),
    },
  ];
  const done: Node[] = [];
  for (let depth = 0; depth < 7 && beam.length; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const sh = withCells(base, node.cells);
      const owed = node.dice.filter((i) => mandatory(g, i) && canPlaceAnywhere(sh, g.dice[i]));
      const optional = node.dice.filter((i) => !mandatory(g, i) && canPlaceAnywhere(sh, g.dice[i]));
      // Finished once nothing is owed: the river and a special stay optional.
      if (!owed.length) done.push(node);
      const expand = (die: number, p: PieceId, bonus: number) => {
        for (const spot of placements(sh, p)) {
          const cells = [...node.cells];
          cells[spot.cell] = { p, o: spot.o, r: g.round };
          const value =
            evaluate(withCells(base, cells), c) +
            bonus +
            (c.noise ? c.rand() * c.noise : 0);
          next.push({
            cells,
            value,
            dice: die < 0 ? node.dice : node.dice.filter((i) => i !== die),
            special: node.special || die < 0,
            moves: [
              ...node.moves,
              die < 0
                ? { type: 'special', p, cell: spot.cell, o: spot.o }
                : { type: 'place', die, cell: spot.cell, o: spot.o },
            ],
          });
        }
      };
      for (const i of [...owed, ...optional]) expand(i, g.dice[i], 0);
      if (!node.special) for (const p of specials) expand(-1, p, -specialBar);
    }
    next.sort((a, b) => b.value - a.value);
    // Keep distinct sheets only.
    const seen = new Set<string>();
    beam = [];
    for (const n of next) {
      const key = n.cells.map((x) => (x ? `${x.p}${x.o}` : '')).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      beam.push(n);
      if (beam.length >= width) break;
    }
  }
  done.push(...beam.filter((n) => {
    const sh = withCells(base, n.cells);
    return !n.dice.some((i) => mandatory(g, i) && canPlaceAnywhere(sh, g.dice[i]));
  }));
  done.sort((a, b) => b.value - a.value);
  return done[0]?.moves ?? [];
}

/** Every move of a bot's round, ending with Done. */
export function botRound(g: RotaGame, seat: number): RotaMove[] {
  const s0 = g.seats[seat];
  if (g.over || s0.locked) return [];
  const level = g.difficulty;
  const c: Ctx = {
    g,
    seat,
    late: g.rounds > 1 ? (g.round - 1) / (g.rounds - 1) : 1,
    noise: level === 'easy' ? 1.6 : level === 'medium' ? 0.7 : 0.25,
    w: personality(seat),
    rand: seeded(g.revision * 31 + seat * 977 + g.round * 13 + 1),
  };
  // A special must lift the sheet this much to be spent now; the bar drops
  // as the match runs out so none are wasted.
  const left = SPECIALS_PER_MATCH - s0.specials.length;
  const roundsLeft = g.rounds - g.round + 1;
  const specialBar = left >= roundsLeft ? 0 : Math.max(0, 2.5 * (1 - c.late) + 0.5);
  const width = level === 'easy' ? 2 : level === 'medium' ? 3 : 8;
  return [...search(g, seat, c, width, specialBar), { type: 'done' }];
}

export function botMove(g: RotaGame, seat: number): RotaMove | null {
  return botRound(g, seat)[0] ?? null;
}

