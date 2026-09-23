'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { GroupsBar, GroupsView } from '@/lib/games/folio/kinds/groups';
import { Panel, useToast, type KindProps } from './shared';
import './groups.css';

const HOP_STEP = 110;
const HOP_MS = 340;
const FLIP_MS = 420;
const SHAKE_MS = 520;
const setKey = (ws: string[]) => [...ws].sort().join('|');
const calm = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
const VERDICTS = ['Perfect!', 'Great!', 'Solid!', 'Phew!'];
const clock = () => Date.now();

/** Timers that all die with the component (and only then). */
function useLater() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);
  return (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };
}

function Bar({
  bar,
  className,
  style,
}: {
  bar: GroupsBar;
  className: string;
  style?: CSSProperties;
}) {
  const line = bar.words.join(', ');
  return (
    <div
      className={`fk-groups-bar ${className}`}
      data-level={bar.level}
      style={
        {
          ...style,
          '--name': bar.name.length,
          '--chars': line.length,
        } as CSSProperties
      }
    >
      <h3>{bar.name}</h3>
      <p>{line}</p>
    </div>
  );
}

/** A different puzzle under the same slot starts over with fresh local state. */
export default function Groups(props: KindProps<GroupsView>) {
  return <Board key={setKey(props.view.words)} {...props} />;
}

function Board({ p, view, busy, done, move }: KindProps<GroupsView>) {
  const [toast, say] = useToast();
  const later = useLater();
  const [order, setOrder] = useState(view.words);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPendingState] = useState<string[] | null>(null);
  const [hop, setHop] = useState(false);
  const [shake, setShake] = useState<string[]>([]);
  const [shown, setShown] = useState(view.solved.length);
  const [dots, setDots] = useState(p.remaining);
  const [cheer, setCheer] = useState(false);
  const [firstShown] = useState(view.solved.length);
  const celebrated = useRef(view.solved.length >= 4);
  const hopEnd = useRef(0);
  const pendingRef = useRef<string[] | null>(null);
  const setPending = (words: string[] | null) => {
    pendingRef.current = words;
    setPendingState(words);
  };
  const tiles = useRef(new Map<string, HTMLElement>());
  const before = useRef<Map<string, DOMRect> | null>(null);
  const seenTries = useRef(view.tries.length);

  const onBoard = new Set(
    view.words.filter((w) => !view.solved.some((b) => b.words.includes(w))),
  );
  // Selection is keyed by word: anything a teammate just solved drops out.
  const sel = selected.filter((w) => onBoard.has(w));
  const bars = view.solved.slice(0, Math.min(shown, view.solved.length));
  const barWords = new Set(bars.flatMap((b) => b.words));
  const shownTiles = order.filter((w) => !barWords.has(w));
  const waitHop = () => Math.max(0, hopEnd.current - clock());

  const snap = () => {
    const m = new Map<string, DOMRect>();
    tiles.current.forEach((el, w) => m.set(w, el.getBoundingClientRect()));
    before.current = m;
  };
  // FLIP: tiles glide from where they were to where the new order puts them.
  useLayoutEffect(() => {
    const prev = before.current;
    if (!prev) return;
    before.current = null;
    if (calm()) return;
    tiles.current.forEach((el, w) => {
      const a = prev.get(w);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left,
        dy = a.top - b.top;
      if (dx || dy)
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          {
            duration: FLIP_MS,
            easing: 'cubic-bezier(.3,.7,.25,1)',
          },
        );
    });
  });

  // Newly solved (or revealed) groups: gather the four tiles on the next row, then merge them into a bar.
  const solvedKey = view.solved.map((b) => b.name).join('|');
  useEffect(() => {
    if (shown >= view.solved.length) return;
    const bar = view.solved[shown];
    const quiet = calm();
    const firstReveal = bar.revealed && !view.solved[shown - 1]?.revealed;
    const wait = quiet
      ? 0
      : waitHop() + (bar.revealed ? (firstReveal ? SHAKE_MS + 350 : 250) : 40);
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t1 = setTimeout(() => {
      snap();
      setOrder((o) => [
        ...o.filter((w) => bar.words.includes(w)),
        ...o.filter((w) => !bar.words.includes(w)),
      ]);
      t2 = setTimeout(
        () => {
          setShown((s) => s + 1);
          if (
            pendingRef.current &&
            setKey(pendingRef.current) === setKey(bar.words)
          )
            setPending(null);
        },
        quiet ? 0 : FLIP_MS + 40,
      );
    }, wait);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [shown, solvedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrong guesses (ours or a teammate's): shake after the hop, say "One away...".
  useEffect(() => {
    const n = view.tries.length;
    if (n <= seenTries.current) {
      seenTries.current = n;
      return;
    }
    seenTries.current = n;
    const last = view.tries[n - 1];
    if (last.verdict === 2) return;
    const mine =
      pendingRef.current && setKey(pendingRef.current) === setKey(last.words);
    later(() => {
      setShake(last.words);
      later(() => setShake([]), SHAKE_MS);
      if (last.verdict === 1) say('One away...');
      if (mine) setPending(null);
    }, waitHop());
  }, [view.tries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mistake dots drop away in time with the shake.
  useEffect(() => {
    if (p.remaining < dots) later(() => setDots(p.remaining), waitHop());
  }, [p.remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const dotsShown = Math.max(p.remaining, Math.min(dots, p.allowance));
  // The end: a verdict toast and, on a win, a cascade across the bars.
  const allShown = shown >= 4 && view.solved.length >= 4;
  const won = done && view.solved.every((b) => !b.revealed);
  useEffect(() => {
    if (!done || !allShown || celebrated.current) return;
    celebrated.current = true;
    if (won) {
      later(() => setCheer(true), calm() ? 0 : 420);
      say(VERDICTS[Math.min(3, p.allowance - p.remaining)] ?? 'Phew!', 2200);
    } else say('Next Time!', 2200);
  }, [done, allShown]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = done || busy || !!pending;
  function toggle(w: string) {
    if (locked || !onBoard.has(w)) return;
    setSelected(
      sel.includes(w)
        ? sel.filter((x) => x !== w)
        : sel.length < 4
          ? [...sel, w]
          : sel,
    );
  }
  function shuffleTiles() {
    const loose = order.filter((w) => onBoard.has(w));
    const fixed = order.filter((w) => !onBoard.has(w));
    for (let i = loose.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [loose[i], loose[j]] = [loose[j], loose[i]];
    }
    snap();
    setOrder([...fixed, ...loose]);
  }
  async function submit() {
    if (locked || sel.length !== 4) return;
    if (view.tries.some((t) => setKey(t.words) === setKey(sel))) {
      say('Already guessed!');
      return;
    }
    const words = order.filter((w) => sel.includes(w));
    const ms = calm() ? 0 : HOP_STEP * 3 + HOP_MS;
    hopEnd.current = clock() + ms;
    setPending(words);
    setHop(true);
    later(() => setHop(false), ms);
    const error = await move({ words });
    if (error)
      later(() => {
        say(error);
        setPending(null);
      }, waitHop());
  }

  const hopIndex = (w: string) => (pending && hop ? pending.indexOf(w) : -1);
  return (
    <Panel className="fk-groups">
      {toast}
      <p className="fk-groups-prompt">Create four groups of four!</p>
      <div className="fk-groups-board" aria-label="Board">
        {bars.map((bar, i) => (
          <Bar
            key={bar.name}
            bar={bar}
            className={cheer ? 'cheer' : i >= firstShown ? 'fresh' : ''}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
        {shownTiles.map((w) => {
          const on = sel.includes(w) || !!pending?.includes(w);
          const h = hopIndex(w);
          const longest = Math.max(...w.split(' ').map((s) => s.length));
          return (
            <button
              type="button"
              key={w}
              ref={(el) => {
                if (el) tiles.current.set(w, el);
                else tiles.current.delete(w);
              }}
              className={`fk-groups-tile ${on ? 'on' : ''} ${h >= 0 ? 'hop' : ''} ${shake.includes(w) ? 'shake' : ''}`}
              style={
                {
                  '--i': Math.max(0, h),
                  '--len': Math.max(4, longest),
                } as CSSProperties
              }
              aria-pressed={on}
              aria-disabled={locked || !onBoard.has(w)}
              onClick={() => toggle(w)}
            >
              <span>{w}</span>
            </button>
          );
        })}
      </div>
      <div
        className="fk-groups-mistakes"
        aria-label={`Mistakes remaining: ${dotsShown}`}
      >
        Mistakes remaining:
        <span className="fk-groups-dots" aria-hidden="true">
          {Array.from({ length: p.allowance }, (_, i) => (
            <i key={i} className={i < dotsShown ? '' : 'gone'} />
          ))}
        </span>
      </div>
      <div className="fk-groups-actions">
        <button
          type="button"
          onClick={shuffleTiles}
          disabled={done || !!pending}
        >
          Shuffle
        </button>
        <button
          type="button"
          onClick={() => setSelected([])}
          disabled={locked || !sel.length}
        >
          Deselect All
        </button>
        <button
          type="button"
          className="fk-groups-submit"
          onClick={() => void submit()}
          disabled={locked || sel.length !== 4}
        >
          Submit
        </button>
      </div>
    </Panel>
  );
}
