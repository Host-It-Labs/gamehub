import { grade, int, requireThat, rng, type KindModule } from '../kind.ts';
import { DELUXE, WAFFLES } from '../waffle-data.ts';

/**
 * Waffle (wafflegame.net): a 5×5 grid with four holes holds six crossing
 * words; the letters start scrambled and every swap costs one of 15. The
 * Deluxe boss is the 7×7 variant with eight seven-letter words and 25 swaps.
 * Cells are indexed row * size + column; holes sit at odd row and odd column.
 */
export type WaffleView = {
  size: number;
  /** size * size letters, '' at holes. */
  letters: string[];
  /** 2 green, 1 yellow, 0 grey, -1 hole. */
  marks: number[];
  /** The fewest swaps that solve the starting board (10, or 20 for Deluxe). */
  par: number;
  deluxe: boolean;
  swaps: number;
  /** Filled in by reveal. */
  solution?: string[];
};
type WaffleSecret = { solution: string[] };

export const isHole = (i: number, size: number) =>
  Math.floor(i / size) % 2 === 1 && (i % size) % 2 === 1;
const cells = (size: number) =>
  Array.from({ length: size * size }, (_, i) => i).filter(
    (i) => !isHole(i, size),
  );
const unpack = (text: string) =>
  text.split('').map((c) => (c === '.' ? '' : c));

/**
 * Waffle's own colouring: green is the right letter; otherwise the tile is
 * graded Wordle-style inside its across word (if its row is a word) and then
 * its down word (if its column is a word), and is yellow if either says so.
 */
export function waffleMarks(
  letters: string[],
  solution: string[],
  size: number,
) {
  const grades = new Map<string, number[]>();
  const word = (key: string, at: number[]) => {
    if (!grades.has(key))
      grades.set(
        key,
        grade(
          at.map((i) => letters[i]).join(''),
          at.map((i) => solution[i]).join(''),
        ),
      );
    return grades.get(key)!;
  };
  const line = (r: number) =>
    Array.from({ length: size }, (_, c) => r * size + c);
  const column = (c: number) =>
    Array.from({ length: size }, (_, r) => r * size + c);
  return letters.map((letter, i) => {
    if (isHole(i, size)) return -1;
    if (letter === solution[i]) return 2;
    const r = Math.floor(i / size),
      c = i % size;
    if (r % 2 === 0 && word(`r${r}`, line(r))[c] === 1) return 1;
    if (c % 2 === 0 && word(`c${c}`, column(c))[r] === 1) return 1;
    return 0;
  });
}

/**
 * Exact fewest swaps with repeated letters. Each misplaced tile is an edge
 * from the letter it shows to the letter it needs; a board of m misplaced
 * tiles decomposed into k letter cycles takes m - k swaps, so the answer is
 * m minus the largest cycle decomposition of that multigraph.
 */
function letterGraph(letters: string[], solution: string[]) {
  const names: string[] = [];
  const id = (c: string) => {
    let n = names.indexOf(c);
    if (n < 0) n = names.push(c) - 1;
    return n;
  };
  const edges: [number, number, number][] = [];
  letters.forEach((c, i) => {
    if (c && c !== solution[i]) edges.push([id(c), id(solution[i]), i]);
  });
  const k = names.length;
  const counts = Array.from({ length: k * k }, () => 0);
  for (const [a, b] of edges) counts[a * k + b]++;
  return { k, counts, edges };
}
function cyclesFrom(counts: number[], k: number) {
  let v = -1;
  for (let i = 0; i < counts.length && v < 0; i++)
    if (counts[i]) v = Math.floor(i / k);
  const found: number[][] = [];
  if (v < 0) return found;
  const path = [v],
    seen = new Set([v]);
  const walk = (u: number) => {
    for (let w = 0; w < k; w++) {
      if (!counts[u * k + w]) continue;
      if (w === v) found.push([...path]);
      else if (!seen.has(w)) {
        seen.add(w);
        path.push(w);
        walk(w);
        path.pop();
        seen.delete(w);
      }
    }
  };
  walk(v);
  // Short cycles first: they are usually optimal, which helps callers that stop early.
  return found.sort((a, b) => a.length - b.length);
}
const toggle = (counts: number[], k: number, cycle: number[], d: number) =>
  cycle.forEach((u, j) => (counts[u * k + cycle[(j + 1) % cycle.length]] += d));
function mostCycles(
  counts: number[],
  k: number,
  memo: Map<string, number>,
): number {
  const key = counts.join(',');
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = 0;
  for (const cycle of cyclesFrom(counts, k)) {
    toggle(counts, k, cycle, -1);
    best = Math.max(best, 1 + mostCycles(counts, k, memo));
    toggle(counts, k, cycle, 1);
  }
  memo.set(key, best);
  return best;
}
export function minSwaps(letters: string[], solution: string[]) {
  const { k, counts, edges } = letterGraph(letters, solution);
  return edges.length - mostCycles(counts, k, new Map());
}
/** A swap on some shortest route to the solution: it always makes a tile green. */
export function bestSwap(
  letters: string[],
  solution: string[],
): [number, number] {
  const { k, counts, edges } = letterGraph(letters, solution);
  const memo = new Map<string, number>();
  const target = mostCycles(counts, k, memo);
  for (const cycle of cyclesFrom(counts, k)) {
    toggle(counts, k, cycle, -1);
    const rest = mostCycles(counts, k, memo);
    toggle(counts, k, cycle, 1);
    if (rest + 1 !== target) continue;
    const [a, b] = cycle,
      c = cycle[2 % cycle.length];
    const p = edges.find((e) => e[0] === a && e[1] === b)!;
    const q = edges.find((e) => e[0] === b && e[1] === c && e[2] !== p[2])!;
    return [p[2], q[2]];
  }
  throw new Error('Already solved');
}

export const waffle: KindModule<WaffleView, WaffleSecret> = {
  make({ seed, level, boss }) {
    const random = rng(seed);
    const bank = boss ? DELUXE : WAFFLES;
    const entry = bank[Math.floor(random() * bank.length)];
    const size = boss ? 7 : 5;
    const solution = unpack(entry[0]);
    const letters = unpack(boss ? entry[1] : entry[Math.min(3, level)]);
    return {
      view: {
        size,
        letters,
        marks: waffleMarks(letters, solution, size),
        par: boss ? 20 : 10,
        deluxe: boss,
        swaps: 0,
      },
      secret: { solution },
      allowance: boss ? 25 : 15,
      budget: 'swaps',
    };
  },
  move(view, secret, move) {
    const n = view.size * view.size;
    const { a, b } = move;
    requireThat(int(a, 0, n - 1) && int(b, 0, n - 1), 'Pick two letters');
    const i = a as number,
      j = b as number;
    requireThat(
      i !== j && !isHole(i, view.size) && !isHole(j, view.size),
      'Pick two letters',
    );
    requireThat(
      view.marks[i] !== 2 && view.marks[j] !== 2,
      'Green letters are locked',
    );
    requireThat(
      view.letters[i] !== view.letters[j],
      'Those letters are the same',
    );
    [view.letters[i], view.letters[j]] = [view.letters[j], view.letters[i]];
    view.marks = waffleMarks(view.letters, secret.solution, view.size);
    view.swaps++;
    return { cost: 1, solved: view.marks.every((m) => m !== 0 && m !== 1) };
  },
  reveal(view, secret) {
    view.solution = [...secret.solution];
    const words: string[] = [];
    const { size } = view;
    for (let r = 0; r < size; r += 2)
      words.push(secret.solution.slice(r * size, r * size + size).join(''));
    for (let c = 0; c < size; c += 2)
      words.push(
        Array.from(
          { length: size },
          (_, r) => secret.solution[r * size + c],
        ).join(''),
      );
    return words.join(' · ');
  },
  win(view, secret) {
    const [a, b] = bestSwap(view.letters, secret.solution);
    return { a, b };
  },
  lose(view, secret) {
    // Swap two loose tiles that stay wrong afterwards (possibly swapping back).
    const loose = cells(view.size).filter((i) => view.marks[i] !== 2);
    const s = secret.solution,
      l = view.letters;
    for (const i of loose)
      for (const j of loose)
        if (i < j && l[i] !== l[j] && l[i] !== s[j] && l[j] !== s[i])
          return { a: i, b: j };
    for (const i of loose)
      for (const j of loose)
        if (i < j && l[i] !== l[j] && loose.length > 2) return { a: i, b: j };
    return { a: loose[0], b: loose[1] };
  },
};
