import {
  DIRS,
  MACHINES,
  intakes,
  outlets,
  type Dir,
  type FactoryState,
  type Machine,
  type MachineKind,
} from '@/lib/games/relic/factory';
import type { PackId } from '@/lib/games/relic/scratch';

/**
 * The factory editor's pure rules: where a new machine faces, how a drawn
 * belt runs, how a group moves and turns, what a copy looks like where it
 * lands, and the edit that undoes an edit. The component only wires these
 * to pointers and keys; tests cover them without a browser.
 */

export type Cell = { x: number; y: number };
export type Piece = Cell & { kind: MachineKind; dir: Dir; book?: PackId };
export type Move = Cell & { to: Cell; dir: Dir };
/** One atomic `factory-edit`: removed first, then moved, then built. */
export type Edit = { remove?: Cell[]; arrange?: Move[]; build?: Piece[] };
/** Copied machines, relative to the top-left corner of their box. */
export type Clip = { pieces: Piece[]; w: number; h: number };
export type Floor = { width: number; height: number };

/** Everything the floor draws over the machines while editing. */
export type Overlay = {
  mode: 'select' | 'erase' | 'build' | 'paste';
  hover: Cell | null;
  selected: Cell[];
  erasing: Cell[];
  /** Machines about to be built (or just built, `solid`, until the server
   * confirms); `bad` where they cannot go; `lift` over a belt being turned. */
  ghosts: (Piece & { bad?: boolean; lift?: boolean; solid?: boolean })[];
  /** Machines being dragged: drawn at their new cells. */
  lifted: { from: Cell[]; to: Cell[]; ok: boolean; dirs?: Dir[] } | null;
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  /** The cells a held or selected booster reaches. */
  reach: Cell[];
  /** The outlet of the one selected machine: drag it to pull out a belt. */
  handle: (Cell & { dir: Dir }) | null;
};

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
export const same = (a: Cell | null | undefined, b: Cell | null | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y;
export const includes = (list: readonly Cell[], c: Cell) =>
  list.some((s) => same(s, c));
const turn = (d: number, by: number) => ((((d + by) % 4) + 4) % 4) as Dir;
const step = (c: Cell, d: number): Cell => ({
  x: c.x + DIRS[d][0],
  y: c.y + DIRS[d][1],
});
export const inside = (c: Cell, floor: Floor) =>
  c.x >= 0 && c.y >= 0 && c.x < floor.width && c.y < floor.height;

export function machineMap(f: FactoryState) {
  return new Map(f.machines.map((m) => [cellKey(m), m]));
}

/** Whether `m` sends tickets into the neighbouring cell `c`. */
export function feeds(m: Machine, c: Cell) {
  return outlets(m.kind, m.dir).some((d) => same(step(m, d), c));
}
/** Whether `m` takes tickets from the neighbouring cell `c`. */
export function takes(m: Machine, c: Cell) {
  return intakes(m.kind, m.dir).some((d) => same(step(m, d), c));
}

/**
 * Which way a new machine at `at` should face so it joins the flow: away
 * from a neighbour that feeds this cell, else toward a neighbour that takes
 * from it, else `fallback`. Straight through is preferred to a corner.
 */
export function autoDir(
  f: FactoryState,
  kind: MachineKind,
  at: Cell,
  fallback: Dir,
  map = machineMap(f),
): Dir {
  if (!MACHINES[kind].turns) return 0;
  const near = ([0, 1, 2, 3] as Dir[]).map((d) => ({
    d,
    m: map.get(cellKey(step(at, d))),
  }));
  const takesIn = intakes(kind, 0).length > 0;
  const feeder = takesIn ? near.find((n) => n.m && feeds(n.m, at)) : undefined;
  const sends = outlets(kind, 0).length > 0;
  const takers = sends
    ? near
        .filter((n) => n.m && n.d !== feeder?.d && takes(n.m, at))
        .map((n) => n.d)
    : [];
  if (feeder) {
    const across = turn(feeder.d, 2);
    if (takers.includes(across) || !takers.length) return across;
    return takers[0];
  }
  if (takers.includes(fallback)) return fallback;
  return takers[0] ?? fallback;
}

/** The cells from `from` to `to`, one step at a time along x then y, each
 * with the direction it was entered from. */
export function walk(from: Cell, to: Cell): (Cell & { dir: Dir })[] {
  const out: (Cell & { dir: Dir })[] = [];
  let { x, y } = from;
  while (x !== to.x || y !== to.y) {
    const d: Dir = x !== to.x ? (to.x > x ? 0 : 2) : to.y > y ? 1 : 3;
    x += DIRS[d][0];
    y += DIRS[d][1];
    out.push({ x, y, dir: d });
  }
  return out;
}

/** A belt being drawn: new belts for empty cells, existing belts turned to
 * follow the path, other machines passed over. */
export type BeltPath = {
  /** The cells walked, in order, with the direction each belt points. */
  cells: (Cell & { dir: Dir })[];
  /** Where the next step starts from. */
  last: Cell;
};
export function startPath(at: Cell, dir: Dir): BeltPath {
  return { cells: [{ ...at, dir }], last: at };
}
export function extendPath(path: BeltPath, to: Cell): BeltPath {
  if (same(path.last, to)) return path;
  const cells = path.cells.map((c) => ({ ...c }));
  for (const s of walk(path.last, to)) {
    // Walking back onto the trail takes it back to that cell, like a pen.
    const back = cells.findIndex((c) => same(c, s));
    if (back >= 0) {
      cells.length = back + 1;
      continue;
    }
    const prev = cells.at(-1);
    if (prev && Math.abs(prev.x - s.x) + Math.abs(prev.y - s.y) === 1)
      prev.dir = s.dir;
    cells.push({ ...s });
  }
  return { cells, last: to };
}
/** What drawing `path` changes: belts on empty floor, turns for belts already
 * there (machines in the way are left alone). */
export function pathEdit(
  f: FactoryState,
  path: BeltPath,
  floor: Floor,
  map = machineMap(f),
): { build: Piece[]; arrange: Move[] } {
  const build: Piece[] = [],
    arrange: Move[] = [];
  for (const c of path.cells) {
    if (!inside(c, floor)) continue;
    const m = map.get(cellKey(c));
    if (!m) build.push({ kind: 'belt', x: c.x, y: c.y, dir: c.dir });
    else if (m.kind === 'belt' && m.dir !== c.dir)
      arrange.push({ x: c.x, y: c.y, to: { x: c.x, y: c.y }, dir: c.dir });
  }
  return { build, arrange };
}

/** Moves for machines shifted by the same offset. */
export function shiftMoves(
  machines: Machine[],
  dx: number,
  dy: number,
): Move[] {
  return machines.map((m) => ({
    x: m.x,
    y: m.y,
    to: { x: m.x + dx, y: m.y + dy },
    dir: m.dir,
  }));
}
/** A quarter turn clockwise of a whole group around its middle; a single
 * machine turns where it stands. The group is nudged back onto the floor. */
export function turnMoves(
  machines: Machine[],
  floor: Floor,
  pivot?: Cell,
): Move[] {
  if (!machines.length) return [];
  const { x: px, y: py } = pivot ?? turnPivot(machines);
  const moves = machines.map((m) => ({
    x: m.x,
    y: m.y,
    to: { x: px - (m.y - py), y: py + (m.x - px) },
    dir: MACHINES[m.kind].turns ? turn(m.dir, 1) : m.dir,
  }));
  const tx = moves.map((m) => m.to.x),
    ty = moves.map((m) => m.to.y);
  const dx =
      Math.max(0, -Math.min(...tx)) -
      Math.max(0, Math.max(...tx) - floor.width + 1),
    dy =
      Math.max(0, -Math.min(...ty)) -
      Math.max(0, Math.max(...ty) - floor.height + 1);
  for (const m of moves) m.to = { x: m.to.x + dx, y: m.to.y + dy };
  return moves;
}
/** The middle a group turns about. Four quarter turns about one point bring
 * a group back exactly, so the editor keeps it while the same group turns. */
export function turnPivot(machines: Cell[]): Cell {
  const xs = machines.map((m) => m.x),
    ys = machines.map((m) => m.y);
  return {
    x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2),
  };
}
/** Whether every move lands inside the floor, on its own cell, and not on a
 * machine that stays where it is. */
export function movesFit(
  f: FactoryState,
  moves: Move[],
  floor: Floor,
  map = machineMap(f),
) {
  const from = new Set(moves.map(cellKey)),
    to = new Set<string>();
  for (const m of moves) {
    const k = cellKey(m.to);
    if (!inside(m.to, floor) || to.has(k)) return false;
    to.add(k);
    if (map.has(k) && !from.has(k)) return false;
  }
  return true;
}
/** Drops moves that change nothing. */
export function realMoves(f: FactoryState, moves: Move[], map = machineMap(f)) {
  return moves.filter(
    (m) => !same(m, m.to) || map.get(cellKey(m))?.dir !== m.dir,
  );
}

// ——— Copy and paste ———

export function copyOf(machines: Machine[]): Clip | null {
  if (!machines.length) return null;
  const x0 = Math.min(...machines.map((m) => m.x)),
    y0 = Math.min(...machines.map((m) => m.y));
  const pieces = machines.map((m) => ({
    kind: m.kind,
    x: m.x - x0,
    y: m.y - y0,
    dir: m.dir,
    ...(m.kind === 'printer' && m.book ? { book: m.book } : {}),
  }));
  return {
    pieces,
    w: Math.max(...pieces.map((p) => p.x)) + 1,
    h: Math.max(...pieces.map((p) => p.y)) + 1,
  };
}
/** The copy turned a quarter clockwise. */
export function turnClip(clip: Clip): Clip {
  return {
    w: clip.h,
    h: clip.w,
    pieces: clip.pieces.map((p) => ({
      ...p,
      x: clip.h - 1 - p.y,
      y: p.x,
      dir: MACHINES[p.kind].turns ? turn(p.dir, 1) : p.dir,
    })),
  };
}
/** The copy's top-left corner when its middle sits on `at`. */
export function clipCorner(clip: Clip, at: Cell): Cell {
  return {
    x: at.x - Math.floor((clip.w - 1) / 2),
    y: at.y - Math.floor((clip.h - 1) / 2),
  };
}
export function placeClip(clip: Clip, corner: Cell): Piece[] {
  return clip.pieces.map((p) => ({
    ...p,
    x: p.x + corner.x,
    y: p.y + corner.y,
  }));
}
/** For each piece, whether its cell is free and on the floor. */
export function piecesFit(
  f: FactoryState,
  pieces: Piece[],
  floor: Floor,
  map = machineMap(f),
) {
  return pieces.map((p) => inside(p, floor) && !map.has(cellKey(p)));
}
/** The free corner nearest `near` where the whole copy fits, if any. */
export function freeCorner(
  f: FactoryState,
  clip: Clip,
  near: Cell,
  floor: Floor,
  map = machineMap(f),
): Cell | null {
  let best: Cell | null = null,
    bestD = Infinity;
  for (let y = 0; y + clip.h <= floor.height; y++)
    for (let x = 0; x + clip.w <= floor.width; x++) {
      const d = Math.abs(x - near.x) + Math.abs(y - near.y);
      if (d >= bestD) continue;
      if (piecesFit(f, placeClip(clip, { x, y }), floor, map).every(Boolean)) {
        best = { x, y };
        bestD = d;
      }
    }
  return best;
}

// ——— Undo ———

/** The edit that puts the factory back as it was before `edit` ran on `f`. */
export function inverseEdit(f: FactoryState, edit: Edit): Edit {
  const map = machineMap(f);
  const removed = (edit.remove ?? [])
    .map((c) => map.get(cellKey(c)))
    .filter((m): m is Machine => !!m);
  const inverse: Edit = {};
  if (edit.build?.length)
    inverse.remove = edit.build.map((p) => ({ x: p.x, y: p.y }));
  if (edit.arrange?.length)
    inverse.arrange = edit.arrange.map((m) => ({
      x: m.to.x,
      y: m.to.y,
      to: { x: m.x, y: m.y },
      dir: map.get(cellKey(m))?.dir ?? m.dir,
    }));
  if (removed.length)
    inverse.build = removed.map((m) => ({
      kind: m.kind,
      x: m.x,
      y: m.y,
      dir: m.dir,
      ...(m.kind === 'printer' && m.book ? { book: m.book } : {}),
    }));
  return inverse;
}
/** A machine an undo or redo expects to find, and the cells it expects empty. */
export type Expect = {
  machines: (Cell & { kind: MachineKind })[];
  empty: Cell[];
};
/** What `edit` needs to find before it runs on `f`: the machines it removes
 * and moves where they are, and free cells where it builds (unless an earlier
 * step of the same edit clears them). */
export function expectBefore(f: FactoryState, edit: Edit): Expect {
  const map = machineMap(f);
  const machines = [...(edit.remove ?? []), ...(edit.arrange ?? [])].flatMap(
    (c) => {
      const m = map.get(cellKey(c));
      return m ? [{ x: m.x, y: m.y, kind: m.kind }] : [];
    },
  );
  const leaving = new Set(
    [...(edit.remove ?? []), ...(edit.arrange ?? [])].map(cellKey),
  );
  const empty = (edit.build ?? [])
    .filter((p) => !leaving.has(cellKey(p)))
    .map((p) => ({ x: p.x, y: p.y }));
  return { machines, empty };
}
/** What `edit` leaves behind on `f`: what its inverse needs to find. */
export function expectAfter(f: FactoryState, edit: Edit): Expect {
  const map = machineMap(f);
  const machines = [
    ...(edit.build ?? []).map((p) => ({ x: p.x, y: p.y, kind: p.kind })),
    ...(edit.arrange ?? []).flatMap((m) => {
      const was = map.get(cellKey(m));
      return was ? [{ ...m.to, kind: was.kind }] : [];
    }),
  ];
  const taken = new Set(machines.map(cellKey));
  const empty = (edit.remove ?? []).filter((c) => !taken.has(cellKey(c)));
  return { machines, empty };
}
/** Whether the factory still looks the way an undo or redo expects. */
export function meets(f: FactoryState, expect: Expect) {
  const map = machineMap(f);
  return (
    expect.machines.every((c) => map.get(cellKey(c))?.kind === c.kind) &&
    expect.empty.every((c) => !map.has(cellKey(c)))
  );
}
export function emptyEdit(edit: Edit) {
  return !edit.remove?.length && !edit.arrange?.length && !edit.build?.length;
}
