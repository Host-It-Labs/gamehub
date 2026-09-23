'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { NonogramView } from '@/lib/games/folio/kinds/nonogram';
import { Panel, useToast, type KindProps } from './shared';
import './nonogram.css';

type Mode = 'fill' | 'cross';
type Drag = {
  start: number;
  end: number;
  axis: 'row' | 'col' | null;
  pointer: number;
};
type Fx = {
  stamp: Map<number, number>;
  wrong: Set<number>;
  rows: number[];
  cols: number[];
};

const lineOf = (n: number, i: number, row: boolean) =>
  Array.from({ length: n }, (_, k) => (row ? i * n + k : k * n + i));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/**
 * Which clue numbers are settled, as Nonogram.com greys them: runs closed off
 * from either edge by crosses, or every number once the line is complete.
 */
function settled(clue: number[], marks: number[]) {
  const done = clue.map(() => false);
  const filled = marks.filter((m) => m === 1).length;
  if (filled === sum(clue)) return clue.map(() => true);
  const scan = (order: number[], clueOrder: number[]) => {
    let j = 0,
      p = 0;
    while (p < order.length && j < clueOrder.length) {
      const m = marks[order[p]];
      if (m === 2) p++;
      else if (m === 1) {
        let e = p;
        while (e < order.length && marks[order[e]] === 1) e++;
        if (e < order.length && marks[order[e]] !== 2) return;
        if (e - p !== clue[clueOrder[j]]) return;
        done[clueOrder[j]] = true;
        j++;
        p = e;
      } else return;
    }
  };
  const idx = marks.map((_, i) => i);
  const ci = clue.map((_, i) => i);
  scan(idx, ci);
  scan([...idx].reverse(), [...ci].reverse());
  return done;
}

function Cross() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2.4 2.4 7.6 7.6M7.6 2.4 2.4 7.6" />
    </svg>
  );
}
function Heart({ lost, fresh }: { lost: boolean; fresh: boolean }) {
  return (
    <svg
      viewBox="0 0 24 22"
      className={`fk-nonogram-heart ${lost ? 'lost' : ''} ${fresh ? 'fresh' : ''}`}
      aria-hidden="true"
    >
      <path d="M12 20.5 2.8 11.6A5.4 5.4 0 0 1 12 4.3a5.4 5.4 0 0 1 9.2 7.3Z" />
    </svg>
  );
}

export default function Nonogram({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<NonogramView>) {
  const n = view.size;
  const [mode, setMode] = useState<Mode>('fill');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [toast, say] = useToast();
  const [fx, setFx] = useState<Fx | null>(null);
  const [shake, setShake] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const won = done && p.status === 'won';
  const lost = done && p.status === 'lost';
  const complete = (i: number, row: boolean) =>
    lineOf(n, i, row).filter((c) => view.cells[c] === 1).length ===
    sum((row ? view.rows : view.cols)[i]);

  // Animate what changed since the last view: stamps, mistakes, finished
  // lines, a breaking heart. Tracked in state and adjusted during render.
  const lostNow = p.allowance - p.remaining;
  const key = `${view.cells.join('')}|${lostNow}`;
  const [seen, setSeen] = useState({
    key,
    cells: view.cells as number[],
    wrong: view.wrong.length,
    lost: lostNow,
  });
  const [freshHeart, setFreshHeart] = useState(-1);
  if (seen.key !== key) {
    setSeen({
      key,
      cells: [...view.cells],
      wrong: view.wrong.length,
      lost: lostNow,
    });
    if (lostNow > seen.lost) setFreshHeart(lostNow - 1);
    const stamp = new Map<number, number>();
    view.cells.forEach((m, i) => {
      if (m && !seen.cells[i]) stamp.set(i, stamp.size);
    });
    const wrong = new Set(view.wrong.slice(seen.wrong));
    const was = (i: number, row: boolean) =>
      lineOf(n, i, row).filter((c) => seen.cells[c] === 1).length ===
      sum((row ? view.rows : view.cols)[i]);
    const rows: number[] = [],
      cols: number[] = [];
    for (let i = 0; i < n; i++) {
      if (complete(i, true) && !was(i, true)) rows.push(i);
      if (complete(i, false) && !was(i, false)) cols.push(i);
    }
    if (stamp.size || wrong.size) {
      if (wrong.size) setShake((v) => v + 1);
      setFx({ stamp, wrong, rows, cols });
    }
  }
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), 1100);
    return () => clearTimeout(t);
  }, [fx]);
  useEffect(() => {
    if (freshHeart < 0) return;
    const t = setTimeout(() => setFreshHeart(-1), 900);
    return () => clearTimeout(t);
  }, [freshHeart]);

  // The straight run a drag covers, locked to the first cell's row or column.
  const path = (d: Drag) => {
    const r0 = Math.floor(d.start / n),
      c0 = d.start % n,
      r1 = Math.floor(d.end / n),
      c1 = d.end % n;
    if (!d.axis) return [d.start];
    const out: number[] = [];
    if (d.axis === 'row') {
      const s = c1 >= c0 ? 1 : -1;
      for (let c = c0; c !== c1 + s; c += s) out.push(r0 * n + c);
    } else {
      const s = r1 >= r0 ? 1 : -1;
      for (let r = r0; r !== r1 + s; r += s) out.push(r * n + c0);
    }
    return out;
  };
  const pending = new Set(
    drag ? path(drag).filter((c) => view.cells[c] === 0) : [],
  );

  const cellAt = (e: PointerEvent) => {
    const box = gridRef.current!.getBoundingClientRect();
    const c = Math.floor(((e.clientX - box.left) / box.width) * n);
    const r = Math.floor(((e.clientY - box.top) / box.height) * n);
    return {
      r: Math.max(0, Math.min(n - 1, r)),
      c: Math.max(0, Math.min(n - 1, c)),
      inside: c >= 0 && c < n && r >= 0 && r < n,
    };
  };
  async function send(cells: number[]) {
    if (!cells.some((c) => view.cells[c] === 0)) return;
    const error = await move({ cells, mark: mode });
    if (error) say(error);
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (done || busy || e.button > 0) return;
    const { r, c, inside } = cellAt(e);
    if (!inside) return;
    e.preventDefault();
    gridRef.current!.setPointerCapture(e.pointerId);
    setDrag({
      start: r * n + c,
      end: r * n + c,
      axis: null,
      pointer: e.pointerId,
    });
    setFocus(r * n + c);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const { r, c, inside } = cellAt(e);
    if (!drag) {
      setHover(inside ? r * n + c : null);
      return;
    }
    if (e.pointerId !== drag.pointer) return;
    const r0 = Math.floor(drag.start / n),
      c0 = drag.start % n;
    let axis = drag.axis;
    if (!axis && (r !== r0 || c !== c0))
      axis = Math.abs(c - c0) >= Math.abs(r - r0) ? 'row' : 'col';
    const end =
      axis === 'row' ? r0 * n + c : axis === 'col' ? r * n + c0 : drag.start;
    setHover(end);
    if (end !== drag.end || axis !== drag.axis) setDrag({ ...drag, end, axis });
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const cells = path(drag);
    setDrag(null);
    void send(cells);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const r = Math.floor(focus / n),
      c = focus % n;
    const to: Record<string, number> = {
      ArrowUp: Math.max(0, r - 1) * n + c,
      ArrowDown: Math.min(n - 1, r + 1) * n + c,
      ArrowLeft: r * n + Math.max(0, c - 1),
      ArrowRight: r * n + Math.min(n - 1, c + 1),
    };
    if (e.key in to) {
      e.preventDefault();
      setFocus(to[e.key]);
      setHover(to[e.key]);
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-i="${to[e.key]}"]`)
        ?.focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && !done && !busy) {
      e.preventDefault();
      void send([focus]);
    } else if (e.key.toLowerCase() === 'x' && !done)
      setMode((m) => (m === 'fill' ? 'cross' : 'fill'));
  };

  const hr = hover === null ? -1 : Math.floor(hover / n),
    hc = hover === null ? -1 : hover % n;
  const wrong = new Set(view.wrong);
  const sol = view.solution;
  const maxR = Math.max(1, ...view.rows.map((r) => r.length));
  const maxC = Math.max(1, ...view.cols.map((c) => c.length));
  const style = {
    '--n': n,
    '--rw': maxR,
    '--ch': maxC,
    '--c': `min(calc((100cqw - 10px) / (${n} + ${maxR} * 0.62 + 0.4)), calc((100cqh - 108px) / (${n} + ${maxC} * 0.66 + 0.4)), 40px)`,
  } as CSSProperties;
  const name = view.name ? view.name.replace(/^./, (c) => c.toUpperCase()) : '';

  const clue = (i: number, row: boolean) => {
    const nums = (row ? view.rows : view.cols)[i];
    const marks = lineOf(n, i, row).map((c) => view.cells[c]);
    const grey = settled(nums, marks);
    const full = complete(i, row);
    const sweep = fx && (row ? fx.rows : fx.cols).includes(i);
    return (
      <div
        key={i}
        className={`fk-nonogram-clue ${row ? 'row' : 'col'} ${full ? 'full' : ''} ${(row ? hr : hc) === i ? 'hot' : ''} ${sweep ? 'sweep' : ''}`}
        aria-label={`${row ? 'Row' : 'Column'} ${i + 1}: ${nums.length ? nums.join(' ') : '0'}${full ? ', complete' : ''}`}
      >
        {(nums.length ? nums : [0]).map((v, k) => (
          <span key={k} className={grey[k] || full ? 'done' : ''}>
            {v}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Panel
      className={`fk-nonogram ${won ? 'won' : ''} ${lost ? 'lost' : ''} ${view.big ? 'big' : ''}`}
    >
      {toast}
      <div className="fk-nonogram-top">
        <div
          className="fk-nonogram-hearts"
          aria-label={`${p.remaining} of ${p.allowance} lives left`}
        >
          {Array.from({ length: p.allowance }, (_, k) => (
            <Heart
              key={k}
              lost={k >= p.remaining}
              fresh={p.allowance - 1 - k === freshHeart}
            />
          ))}
        </div>
      </div>
      <div className="fk-nonogram-board" style={style}>
        <div className="fk-nonogram-corner" aria-hidden="true" />
        <div className="fk-nonogram-cols">
          {Array.from({ length: n }, (_, i) => clue(i, false))}
        </div>
        <div className="fk-nonogram-rows">
          {Array.from({ length: n }, (_, i) => clue(i, true))}
        </div>
        <div
          ref={gridRef}
          className={`fk-nonogram-grid ${fx?.wrong.size ? `shake${shake % 2}` : ''}`}
          role="grid"
          tabIndex={-1}
          aria-label={`${n} by ${n} picture grid`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag(null)}
          onPointerLeave={() => !drag && setHover(null)}
          onKeyDown={onKey}
        >
          {view.cells.map((m, i) => {
            const r = Math.floor(i / n),
              c = i % n;
            const answer = sol ? sol[r][c] === '#' : false;
            const bad = wrong.has(i);
            const state = m === 1 ? 'fill' : m === 2 ? 'cross' : 'empty';
            const st = fx?.stamp.get(i);
            const sweep = fx && (fx.rows.includes(r) || fx.cols.includes(c));
            return (
              <button
                type="button"
                key={i}
                data-i={i}
                tabIndex={i === focus ? 0 : -1}
                disabled={done}
                className={[
                  'fk-nonogram-cell',
                  state,
                  bad ? 'bad' : '',
                  c % 5 === 0 ? 'l5' : '',
                  r % 5 === 0 ? 't5' : '',
                  r === hr || c === hc ? 'hot' : '',
                  pending.has(i) ? `pending ${mode}` : '',
                  st !== undefined ? 'stamp' : '',
                  fx?.wrong.has(i) ? 'oops' : '',
                  sweep ? 'sweep' : '',
                  sol && answer && m !== 1 ? 'missed' : '',
                ].join(' ')}
                style={
                  {
                    '--k': st ?? 0,
                    '--s': fx?.rows.includes(r) ? c : r,
                    '--d': r + c,
                  } as CSSProperties
                }
                aria-label={`Row ${r + 1}, column ${c + 1}: ${state === 'empty' ? 'empty' : state === 'fill' ? 'filled' : 'crossed'}${bad ? ', mistake' : ''}`}
                onClick={(e) => {
                  // Keyboard activation only; pointer marks go through the drag.
                  if (e.detail === 0 && !done && !busy) void send([i]);
                }}
                onFocus={() => setFocus(i)}
              >
                <i className="ink" />
                {m === 2 && <Cross />}
              </button>
            );
          })}
        </div>
      </div>
      {done && name ? (
        <p className={`fk-nonogram-name ${won ? 'won' : ''}`}>
          <span className="orn" aria-hidden="true">
            ❦
          </span>
          {won ? name : <>It was {view.name}</>}
          <span className="orn flip" aria-hidden="true">
            ❦
          </span>
        </p>
      ) : (
        <div className="fk-nonogram-modes">
          <button
            type="button"
            aria-pressed={mode === 'fill'}
            className={mode === 'fill' ? 'on' : ''}
            onClick={() => setMode('fill')}
            disabled={done}
            aria-label="Fill"
          >
            <i className="fk-nonogram-swatch" />
          </button>
          <button
            type="button"
            aria-pressed={mode === 'cross'}
            className={mode === 'cross' ? 'on' : ''}
            onClick={() => setMode('cross')}
            disabled={done}
            aria-label="Cross"
          >
            <Cross />
          </button>
        </div>
      )}
    </Panel>
  );
}
