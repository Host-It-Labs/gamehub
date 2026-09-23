import { grade, requireThat, rng, type KindModule } from '../kind.ts';

/**
 * Mathler: find the hidden calculation (6 characters, 8 for Hard Mathler)
 * that equals the target. Every guess must itself equal the target; tiles are
 * graded like Wordle over the characters, and a guess that is the answer with
 * its sums or products reordered counts as the answer.
 */
export type EquationView = {
  target: number;
  length: number;
  hard: boolean;
  guesses: { word: string; marks: number[] }[];
  answer?: string;
};
type EquationSecret = { answer: string; alts: string[] };

/** One additive term: its sign, first number, then * and / in written order. */
type Term = { sign: 1 | -1; first: number; ops: ['*' | '/', number][] };
export type Parsed = {
  terms: Term[];
  num: number;
  den: number;
  /** Every division divides its running product exactly. */
  exact: boolean;
};

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** Tokenize and evaluate a calculation with exact fractions (no eval). */
export function parse(text: string): Parsed | null {
  const tokens = text.match(/\d+|[+\-*/]/g);
  if (!tokens || tokens.join('') !== text || tokens.length % 2 === 0)
    return null;
  const terms: Term[] = [];
  let op = '+';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i % 2 === 1) {
      if (!/^[+\-*/]$/.test(t)) return null;
      op = t;
      continue;
    }
    // No unary minus (the regex already splits it) and no leading zeros.
    if (!/^\d+$/.test(t) || (t.length > 1 && t[0] === '0')) return null;
    const n = Number(t);
    if (op === '+' || op === '-')
      terms.push({ sign: op === '+' ? 1 : -1, first: n, ops: [] });
    else terms[terms.length - 1].ops.push([op as '*' | '/', n]);
  }
  let num = 0;
  let den = 1;
  let exact = true;
  for (const t of terms) {
    let tn = t.first;
    let td = 1;
    for (const [o, f] of t.ops) {
      if (o === '*') tn *= f;
      else {
        if (f === 0) return null;
        if (td !== 1 || tn % f !== 0) exact = false;
        td *= f;
      }
      const g = gcd(tn, td) || 1;
      tn /= g;
      td /= g;
    }
    const nn = num * td + t.sign * tn * den;
    const nd = den * td;
    const g = gcd(nn, nd) || 1;
    num = nn / g;
    den = nd / g;
  }
  return { terms, num, den, exact };
}
/**
 * Commutative fingerprint: the multiset of signed terms, each with its
 * multiplied and divided factors sorted. a-b+c and c+a-b match; a-b and b-a
 * do not; a*b/c and b/c*a match.
 */
export function canon(p: Parsed) {
  return p.terms
    .map((t) => {
      const mul = [
        t.first,
        ...t.ops.filter((o) => o[0] === '*').map((o) => o[1]),
      ];
      const div = t.ops.filter((o) => o[0] === '/').map((o) => o[1]);
      const s = (a: number[]) => a.sort((x, y) => x - y).join('*');
      return `${t.sign < 0 ? '-' : '+'}${s(mul)}/${s(div)}`;
    })
    .sort()
    .join(' ');
}
/** Integer value of a calculation, or null when malformed or fractional. */
export function evaluate(text: string) {
  const p = parse(text);
  return p && p.den === 1 ? p.num : null;
}

const MULT = /[*/]/;
const ADD = /[+-]/;
function number(len: number, random: () => number) {
  let s = String(1 + Math.floor(random() * 9));
  for (let i = 1; i < len; i++) s += Math.floor(random() * 10);
  return s;
}
const opOf = (set: string, random: () => number) =>
  set[Math.floor(random() * set.length)];

/** A random well-formed calculation of exactly `len` characters. */
function randomExpr(len: number, random: () => number, maxDigits = 3) {
  let s = '';
  let left = len;
  for (;;) {
    const choices = [];
    for (let k = 1; k <= Math.min(maxDigits, left); k++)
      if (left - k !== 1) choices.push(k);
    const k = choices[Math.floor(random() * choices.length)];
    s += number(k, random);
    left -= k;
    if (left === 0) return s;
    s += opOf('+-*/', random);
    left--;
  }
}
/** Clean content: no zero operands, no ×1 or ÷1, exact divisions. */
function clean(p: Parsed) {
  if (!p.exact || p.den !== 1) return false;
  for (const t of p.terms) {
    if (t.first === 0) return false;
    for (const [, f] of t.ops) if (f === 0 || f === 1) return false;
    if (t.first === 1 && t.ops.length) return false;
  }
  return true;
}
/** Level-shaped hidden calculation. */
function candidate(level: number, boss: boolean, random: () => number) {
  if (boss) {
    // Three or four numbers in eight characters.
    if (random() < 0.55) {
      const lens = [1, 1, 1, 1];
      lens[Math.floor(random() * 4)] = 2;
      return build(lens, random);
    }
    return build(
      pickOne(
        [
          [2, 2, 2],
          [3, 2, 1],
          [3, 1, 2],
          [2, 3, 1],
          [1, 3, 2],
          [2, 1, 3],
          [1, 2, 3],
        ],
        random,
      ),
      random,
    );
  }
  const lens = pickOne(
    [
      [2, 1, 1],
      [1, 2, 1],
      [1, 1, 2],
    ],
    random,
  );
  if (level === 1) {
    const ops =
      random() < 0.5
        ? [opOf('+-', random), opOf('*/', random)]
        : [opOf('*/', random), opOf('+-', random)];
    return lens
      .map((l) => number(l, random))
      .reduce((s, n, i) => s + ops[i - 1] + n);
  }
  return build(lens, random);
}
function pickOne<T>(a: T[], random: () => number) {
  return a[Math.floor(random() * a.length)];
}
function build(lens: number[], random: () => number) {
  return lens
    .map((l) => number(l, random))
    .reduce((s, n) => s + opOf('+-*/', random) + n);
}
function fits(text: string, level: number, boss: boolean) {
  const p = parse(text);
  if (!p || !clean(p) || p.num <= 0) return false;
  // No self-cancelling quotients such as 8/8*50.
  for (const t of p.terms) {
    let v = t.first;
    for (const [o, f] of t.ops) {
      v = o === '*' ? v * f : v / f;
      if (v === 1) return false;
    }
  }
  const ops = text.replace(/\d/g, '');
  const mult = ops.split('').filter((o) => MULT.test(o)).length;
  const distinct = new Set(ops).size;
  if (boss)
    return (
      p.num >= 10 && p.num <= 999 && mult >= 1 && distinct >= 2 && ADD.test(ops)
    );
  if (p.num < 2 || p.num > 200 || mult < 1) return false;
  if (level === 1) return p.num >= 5 && p.num <= 120;
  if (level === 2) return distinct === 2;
  // Very hard: a quotient chained with another product or quotient.
  if (level === 4) return ops.includes('/') && mult === 2;
  // Hard: division, or two products/quotients chained.
  return ops.includes('/') || mult === 2;
}
/** Other calculations of the same length that equal the target. */
function alternatives(answer: string, target: number, random: () => number) {
  const len = answer.length;
  const seen = new Set([canon(parse(answer)!)]);
  const alts: string[] = [];
  for (let tries = 0; tries < 3000 && alts.length < 10; tries++) {
    // R+A and R-A always evaluate to v±A, so solve A for the target.
    const a = 1 + Math.floor(random() * Math.min(3, len - 2));
    const rLen = len - 1 - a;
    const r = randomExpr(rLen, random);
    const rp = parse(r);
    if (!rp || !clean(rp)) continue;
    const plus = random() < 0.6;
    const need = plus ? target - rp.num : rp.num - target;
    if (need <= 0 || String(need).length !== a) continue;
    const text =
      random() < 0.5 && plus
        ? `${need}+${r}`
        : `${r}${plus ? '+' : '-'}${need}`;
    const p = parse(text);
    if (
      !p ||
      !clean(p) ||
      p.num !== target ||
      p.den !== 1 ||
      text.length !== len
    )
      continue;
    const c = canon(p);
    if (seen.has(c)) continue;
    seen.add(c);
    alts.push(text);
  }
  return alts;
}
const ALTS_NEEDED = 9;

export const equation: KindModule<EquationView, EquationSecret> = {
  make({ seed, level, boss }) {
    const random = rng(seed * 7919 + level * 31 + (boss ? 5 : 0));
    const length = boss ? 8 : 6;
    for (;;) {
      const answer = candidate(level, boss, random);
      if (answer.length !== length || !fits(answer, level, boss)) continue;
      const target = evaluate(answer)!;
      const alts = alternatives(answer, target, random);
      if (alts.length < ALTS_NEEDED) continue;
      return {
        view: { target, length, hard: boss, guesses: [] },
        secret: { answer, alts },
        allowance: 6,
        budget: 'guesses',
      };
    }
  },
  move(view, secret, move) {
    requireThat(typeof move.guess === 'string', 'Not a valid calculation');
    const guess = (move.guess as string)
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');
    requireThat(/^[0-9+\-*/]*$/.test(guess), 'Not a valid calculation');
    requireThat(guess.length === view.length, 'Not enough characters');
    const p = parse(guess);
    requireThat(p, 'Not a valid calculation');
    requireThat(
      p.den === 1 && p.num === view.target,
      `Every guess must equal ${view.target}`,
    );
    const solved = canon(p) === canon(parse(secret.answer)!);
    // A commutative match is shown as the answer itself, all green.
    const word = solved ? secret.answer : guess;
    view.guesses.push({ word, marks: grade(word, secret.answer) });
    return { cost: 1, solved };
  },
  reveal(view, secret) {
    view.answer = secret.answer;
    return `${secret.answer.replace(/\*/g, '×').replace(/\//g, '÷')} = ${view.target}`;
  },
  win: (_view, secret) => ({ guess: secret.answer }),
  lose(view, secret) {
    const used = new Set(view.guesses.map((g) => g.word));
    return { guess: secret.alts.find((a) => !used.has(a)) ?? secret.alts[0] };
  },
};
