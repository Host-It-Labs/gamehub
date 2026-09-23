import {
  hash,
  pick,
  requireThat,
  rng,
  shuffle,
  type KindModule,
} from '../kind.ts';
import {
  GENTLE,
  PURPLE_WEEK,
  TOUGH,
  TRICKY,
  type GroupDef,
  type GroupsPuzzle,
} from '../groups-data.ts';

/** A group on the board's solved stack; `revealed` marks one shown after a loss. */
export type GroupsBar = {
  level: 1 | 2 | 3 | 4;
  name: string;
  words: string[];
  revealed?: boolean;
};
export type GroupsView = {
  /** All sixteen words in the puzzle's starting order. */
  words: string[];
  solved: GroupsBar[];
  /** Every submitted set, sorted; verdict 2 correct, 1 one away, 0 wrong. */
  tries: { words: string[]; verdict: 0 | 1 | 2 }[];
  boss: boolean;
};
type GroupsSecret = { groups: GroupDef[] };

export const POOLS: Record<'1' | '2' | '3' | 'boss', GroupsPuzzle[]> = {
  '1': GENTLE,
  '2': TRICKY,
  '3': TOUGH,
  boss: PURPLE_WEEK,
};
const key = (words: string[]) => [...words].sort().join('|');
const remaining = (view: GroupsView) => {
  const gone = new Set(view.solved.flatMap((b) => b.words));
  return view.words.filter((w) => !gone.has(w));
};

export const groups: KindModule<GroupsView, GroupsSecret> = {
  make({ seed, level, boss }) {
    const random = rng(hash(`groups:${seed}`));
    // Very hard draws the red-herring sets but keeps the usual four mistakes.
    const puzzle = pick(
      POOLS[boss || level === 4 ? 'boss' : (String(level) as '1')],
      random,
    );
    const secret = {
      groups: puzzle.map((d) => ({ ...d, words: [...d.words] })),
    };
    return {
      view: {
        words: shuffle(
          puzzle.flatMap((d) => d.words),
          random,
        ),
        solved: [],
        tries: [],
        boss,
      },
      secret,
      allowance: boss ? 3 : 4,
      budget: 'mistakes',
    };
  },
  move(view, secret, move) {
    const words = move.words;
    requireThat(
      Array.isArray(words) &&
        words.length === 4 &&
        words.every((w) => typeof w === 'string'),
      'Select four items',
    );
    const set = words as string[];
    requireThat(new Set(set).size === 4, 'Select four different items');
    const left = new Set(remaining(view));
    requireThat(
      set.every((w) => left.has(w)),
      'Those items are no longer on the board',
    );
    const k = key(set);
    requireThat(
      !view.tries.some((t) => key(t.words) === k),
      'Already guessed!',
    );
    const best = secret.groups
      .map((grp) => ({
        grp,
        n: grp.words.filter((w) => set.includes(w)).length,
      }))
      .sort((a, b) => b.n - a.n)[0];
    const verdict = best.n === 4 ? 2 : best.n === 3 ? 1 : 0;
    view.tries.push({ words: [...set].sort(), verdict });
    if (verdict === 2) {
      const { level, name, words: ws } = best.grp;
      view.solved.push({ level, name, words: [...ws] });
    }
    return {
      cost: verdict === 2 ? 0 : 1,
      solved: view.solved.length === secret.groups.length,
    };
  },
  reveal(view, secret) {
    const done = new Set(view.solved.map((b) => b.name));
    for (const grp of [...secret.groups].sort((a, b) => a.level - b.level))
      if (!done.has(grp.name))
        view.solved.push({
          level: grp.level,
          name: grp.name,
          words: [...grp.words],
          revealed: true,
        });
    return view.solved.map((b) => b.name).join(' · ');
  },
  win(view, secret) {
    const done = new Set(view.solved.map((b) => b.name));
    const next = secret.groups.find((grp) => !done.has(grp.name))!;
    return { words: [...next.words] };
  },
  lose(view, secret) {
    const left = remaining(view);
    const groupKeys = new Set(secret.groups.map((grp) => key(grp.words)));
    const tried = new Set(view.tries.map((t) => key(t.words)));
    const n = left.length;
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++)
        for (let c = b + 1; c < n; c++)
          for (let d = c + 1; d < n; d++) {
            const set = [left[a], left[b], left[c], left[d]];
            const k = key(set);
            if (!groupKeys.has(k) && !tried.has(k)) return { words: set };
          }
    // Only the last group is left: nothing wrong can be submitted.
    return { words: left.slice(0, 4) };
  },
};
