import { otherEnd } from './map.ts';
import {
  BANK_CARDS,
  cardSide,
  legalDraws,
  lineState,
  liveLine,
  mapOf,
  play,
  unseen,
  type Card,
  type Draw,
  type MetroGame,
  type MetroMove,
} from './engine.ts';
import { goalProgress, interchanges, GOAL_POINTS } from './score.ts';

/**
 * Metro's bots draw from what they may see: the cards flipped so far, never
 * the pile's order. Each candidate turn is priced by the line's score as it
 * stands, stations shared with earlier lines, how freely the line can still
 * grow, the chance of joining both starts before the round ends, and the
 * goals. Easy picks loosely, Medium greedily, Hard also looks one card ahead.
 */

/** About how many more turns this round has, from the cards flipped. */
function turnsLeft(g: MetroGame) {
  const moon = g.shown.filter((c) => cardSide(c) === 'moon').length;
  const sun = g.shown.filter((c) => cardSide(c) === 'sun').length;
  if (g.last) return 0;
  // Bank cards left before either bank reaches five, a little under half
  // flipping each way.
  return Math.min(BANK_CARDS - moon, BANK_CARDS - sun) * 1.6;
}

/** Fewest free hops from one half of the line to the other. */
function gap(g: MetroGame, seat: number, from: Set<number>, to: Set<number>) {
  const m = mapOf(g);
  const own = g.seats[seat].sections;
  const used = new Set(own.map((s) => s.e));
  const blocked = new Set(own.flatMap((s) => m.crosses[s.e]));
  const dist = new Map<number, number>();
  let frontier = [...from];
  for (const s of frontier) dist.set(s, 0);
  for (let d = 1; d <= 9 && frontier.length; d++) {
    const next: number[] = [];
    for (const u of frontier)
      for (const e of m.adj[u]) {
        if (used.has(e) || blocked.has(e)) continue;
        const v = otherEnd(m, e, u);
        if (to.has(v)) return d;
        if (dist.has(v)) continue;
        dist.set(v, d);
        next.push(v);
      }
    frontier = next;
  }
  return 10;
}

/** Free hops leading on from the ends of each half. */
function room(g: MetroGame, seat: number) {
  const m = mapOf(g);
  const ls = lineState(g, seat);
  const own = g.seats[seat].sections;
  const used = new Set(own.map((s) => s.e));
  const blocked = new Set(own.flatMap((s) => m.crosses[s.e]));
  let n = 0;
  for (const half of ls.halves)
    for (const st of half) {
      if ((ls.degree.get(st) ?? 0) > 1) continue;
      let k = 0;
      for (const e of m.adj[st])
        if (!used.has(e) && !blocked.has(e) && !half.has(otherEnd(m, e, st)))
          k++;
      n += Math.min(k, 3);
    }
  return n;
}

/** What a seat's map is worth, counting what the round may still bring. */
export function value(g: MetroGame, seat: number, lean = 0) {
  const m = mapOf(g);
  const s = g.seats[seat];
  const left = turnsLeft(g);
  const line = liveLine(g, seat);
  let v = line.total + interchanges(m, s.sections, s.boxed).points;
  const ls = lineState(g, seat);
  if (!ls.joined && ls.halves.length === 2) {
    const d = gap(g, seat, ls.halves[0], ls.halves[1]);
    // Each hop takes a card that fits; about half of them do.
    const chance = Math.max(0, Math.min(1, 1 - (d - 1) / (left * 0.55 + 0.01)));
    v += 10 * chance * (0.8 + lean * 0.1);
  }
  v += room(g, seat) * Math.min(1.2, left * 0.25) * (1 + lean * 0.2);
  for (const id of g.goals) {
    const p = goalProgress(m, id, s.sections, s.boxed);
    v += p.have >= p.need ? GOAL_POINTS : (GOAL_POINTS * 0.5 * p.have) / p.need;
  }
  return v;
}

const apply = (g: MetroGame, seat: number, draws: Draw[]) => {
  let next = g;
  for (const d of draws)
    next = play(next, { type: 'draw', from: d.from, to: d.to }, seat);
  return next;
};

/** Every way to use this turn: nothing, one section, or two on a switch. */
function options(g: MetroGame, seat: number): Draw[][] {
  const out: Draw[][] = [[]];
  for (const d of legalDraws(g, seat)) {
    out.push([d]);
    if (g.cards[0] !== 'sw') continue;
    const after = apply(g, seat, [d]);
    for (const d2 of legalDraws(after, seat)) out.push([d, d2]);
  }
  return out;
}

/** The best a seat can do with one more card, averaged over the cards
 *  that may still flip. */
function lookahead(g: MetroGame, seat: number, lean: number) {
  if (g.last) return value(g, seat, lean);
  const cards = unseen(g).filter((c): c is Exclude<Card, 'sw'> => c !== 'sw');
  if (!cards.length) return value(g, seat, lean);
  let sum = 0;
  for (const c of cards) {
    const next: MetroGame = { ...g, cards: [c], turn: g.turn + 1 };
    next.shown = [...g.shown, c];
    let best = value(next, seat, lean);
    for (const d of legalDraws(next, seat))
      best = Math.max(best, value(apply(next, seat, [d]), seat, lean));
    sum += best;
  }
  return sum / cards.length;
}

/** A small, steady difference between seats so bots don't all agree. */
const leanOf = (g: MetroGame, seat: number) =>
  (((seat * 7919 + g.round * 104729) % 1000) / 1000 - 0.5) * 2;

/** The draws a bot makes this turn, then Done. */
export function botTurn(g: MetroGame, seat: number): MetroMove[] {
  if (g.over || g.seats[seat].locked) return [];
  // An away player's sections this turn stay; the bot adds to them.
  const lean = leanOf(g, seat);
  const opts = options(g, seat);
  let pickd: Draw[] = [];
  if (opts.length > 1) {
    const deep = g.difficulty === 'hard' && opts.length <= 40;
    const scored = opts.map((o) => {
      const after = apply(g, seat, o);
      return { o, v: deep ? lookahead(after, seat, lean) : value(after, seat, lean) };
    });
    scored.sort((a, b) => b.v - a.v);
    if (g.difficulty === 'easy') {
      // Easy takes one of its better ideas, not always the best.
      const pool = scored.slice(0, Math.min(4, scored.length));
      const i = (g.turn * 31 + seat * 17 + g.round * 7) % pool.length;
      pickd = pool[i].o;
    } else pickd = scored[0].o;
  }
  return [
    ...pickd.map((d): MetroMove => ({ type: 'draw', from: d.from, to: d.to })),
    { type: 'done' },
  ];
}
