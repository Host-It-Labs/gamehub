'use client';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Eraser, Pencil } from 'lucide-react';
import type { SudokuView } from '@/lib/games/folio/kinds/sudoku';
import { Panel, useToast, type KindProps } from './shared';
import './sudoku.css';

const TIER_NAME = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
} as const;
const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;
const boxOf = (i: number) =>
  Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const UNITS: number[][] = [];
for (let k = 0; k < 9; k++) {
  UNITS.push(Array.from({ length: 9 }, (_, j) => k * 9 + j));
  UNITS.push(Array.from({ length: 9 }, (_, j) => j * 9 + k));
  UNITS.push(
    Array.from(
      { length: 9 },
      (_, j) =>
        (Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3),
    ),
  );
}
const peers = (a: number, b: number) =>
  a !== b &&
  (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));
/** DOM order: nine boxes, each holding its nine cells, so box lines can be real gaps. */
const BOX_CELLS = Array.from({ length: 9 }, (_, b) => UNITS[b * 3 + 2]);

type Anim = {
  id: number;
  pop: Set<number>;
  shake: Set<number>;
  /** Cell → distance from the placed number, for the completion sweep. */
  sweep: Map<number, number>;
};

export default function Sudoku({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<SudokuView>) {
  const [sel, setSel] = useState<number | null>(null);
  const [noting, setNoting] = useState(false);
  const [notes, setNotes] = useState<number[]>(() => Array(81).fill(0));
  const [anim, setAnim] = useState<Anim | null>(null);
  const [toast, say] = useToast();
  const gridRef = useRef<HTMLFieldSetElement>(null);
  // One move in flight at a time, even when keys are pressed faster than the server answers.
  const pending = useRef(false);
  async function send(m: Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    try {
      const error = await move(m);
      if (error) say(error);
    } finally {
      pending.current = false;
    }
  }
  // Keep keyboard focus on the selected square once a square has focus.
  useEffect(() => {
    const g = gridRef.current;
    if (!g || sel === null || !g.contains(document.activeElement)) return;
    g.querySelector<HTMLElement>(`[data-cell="${sel}"]`)?.focus();
  }, [sel]);

  // Diff each new view against the last one seen (during render, React's
  // "adjust state when props change" pattern) to drive notes and animations.
  const signature = view.given.join('');
  const [seen, setSeen] = useState({
    signature,
    grid: view.grid,
    wrong: view.wrong,
  });
  if (
    seen.grid !== view.grid ||
    seen.wrong !== view.wrong ||
    seen.signature !== signature
  ) {
    setSeen({ signature, grid: view.grid, wrong: view.wrong });
    if (seen.signature !== signature) {
      // Fresh puzzle: private notes and selection start over.
      setNotes(Array(81).fill(0));
      setSel(null);
      setAnim(null);
    } else {
      const placed: number[] = [];
      const missed: number[] = [];
      for (let i = 0; i < 81; i++) {
        if (view.grid[i] && !seen.grid[i]) placed.push(i);
        if (view.wrong[i] && view.wrong[i] !== seen.wrong[i]) missed.push(i);
      }
      if (placed.length || missed.length) {
        // A correct number clears itself from the notes of every peer.
        if (placed.length)
          setNotes((n) =>
            n.map((mask, i) => {
              if (placed.includes(i)) return 0;
              let m = mask;
              for (const c of placed)
                if (peers(c, i)) m &= ~(1 << (view.grid[c] - 1));
              return m;
            }),
          );
        // Completed rows, columns and boxes sweep outward from the new number.
        const sweep = new Map<number, number>();
        if (placed.length < 6)
          for (const c of placed)
            for (const u of UNITS)
              if (u.includes(c) && u.every((x) => view.grid[x]))
                for (const x of u) {
                  const d =
                    Math.abs(rowOf(x) - rowOf(c)) +
                    Math.abs(colOf(x) - colOf(c));
                  sweep.set(x, Math.min(sweep.get(x) ?? 99, d));
                }
        setAnim({
          id: (anim?.id ?? 0) + 1,
          pop: new Set(placed),
          shake: new Set(missed),
          sweep,
        });
      }
    }
  }
  useEffect(() => {
    if (!anim) return;
    const t = setTimeout(() => setAnim((a) => (a === anim ? null : a)), 1100);
    return () => clearTimeout(t);
  }, [anim]);

  const won = done && view.grid.every(Boolean);
  const lost = done && !won;
  const mistakes = p.allowance - p.remaining;
  const shown = (i: number) =>
    view.grid[i] || (lost && view.solution ? view.solution[i] : 0);
  const counts = useMemo(() => {
    const c = Array(10).fill(0);
    for (const d of view.grid) c[d]++;
    return c;
  }, [view.grid]);

  const focus = done ? null : sel;
  const selDigit =
    focus === null ? 0 : view.grid[focus] || view.wrong[focus] || 0;
  // Sudoku.com marks peers that already hold the same number as a wrong entry.
  const clash = useMemo(() => {
    const out = new Set<number>();
    view.wrong.forEach((d, i) => {
      if (!d) return;
      for (let j = 0; j < 81; j++)
        if (view.grid[j] === d && peers(i, j)) out.add(j);
    });
    return out;
  }, [view.grid, view.wrong]);

  async function enter(digit: number) {
    if (done || sel === null || view.grid[sel]) return;
    if (noting) {
      if (view.wrong[sel]) return;
      setNotes((n) =>
        n.map((m, i) => (i === sel ? m ^ (1 << (digit - 1)) : m)),
      );
      return;
    }
    if (busy || view.wrong[sel] === digit) return;
    await send({ cell: sel, digit });
  }
  async function erase() {
    if (done || sel === null || view.grid[sel]) return;
    if (view.wrong[sel]) {
      if (busy) return;
      await send({ cell: sel, erase: true });
    } else setNotes((n) => n.map((m, i) => (i === sel ? 0 : m)));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('input, textarea, select, [role="dialog"]') ||
      document.querySelector('[role="dialog"]')
    )
      return;
    const step = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[
      e.key
    ];
    if (step) {
      e.preventDefault();
      setSel((s) => {
        if (s === null) return 40;
        const r = rowOf(s),
          c = colOf(s);
        if (step === -1) return r * 9 + ((c + 8) % 9);
        if (step === 1) return r * 9 + ((c + 1) % 9);
        return ((r + (step > 0 ? 1 : 8)) % 9) * 9 + c;
      });
    } else if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      void enter(Number(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      void erase();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      setNoting((v) => !v);
    }
  });
  useEffect(() => {
    if (done) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  const cell = (i: number) => {
    const r = rowOf(i),
      c = colOf(i);
    const d = shown(i);
    const wrong = !view.grid[i] && !lost ? view.wrong[i] : 0;
    const revealed = lost && !view.grid[i];
    const s = focus;
    const zone =
      s !== null &&
      s !== i &&
      (rowOf(s) === r || colOf(s) === c || boxOf(s) === boxOf(i));
    const same = !!selDigit && s !== i && view.grid[i] === selDigit;
    const flash = anim?.sweep.get(i);
    const cls = [
      'fk-sudoku-cell',
      view.given[i] ? 'given' : d && !revealed ? 'placed' : '',
      wrong ? 'wrong' : '',
      revealed ? 'revealed' : '',
      s === i ? 'sel' : '',
      zone ? 'zone' : '',
      same ? 'same' : '',
      !lost && clash.has(i) ? 'clash' : '',
      anim?.pop.has(i) ? 'pop' : '',
      anim?.shake.has(i) ? 'shake' : '',
      flash !== undefined ? 'sweep' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const mask = !d && !wrong ? notes[i] : 0;
    const label = `Row ${r + 1}, column ${c + 1}: ${
      d
        ? `${d}${view.given[i] ? ', given' : revealed ? ', revealed' : ''}`
        : wrong
          ? `${wrong}, wrong`
          : 'empty'
    }${mask ? `, notes ${[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => mask & (1 << (n - 1))).join(' ')}` : ''}`;
    return (
      <button
        type="button"
        key={i}
        className={cls}
        aria-label={label}
        aria-pressed={s === i}
        disabled={done}
        data-cell={i}
        data-beat={anim?.shake.has(i) ? anim.id % 2 : undefined}
        onClick={() => setSel(i)}
        onFocus={() => setSel(i)}
        style={
          {
            '--d': flash ?? 0,
            '--w': r + c,
            '--k': revealed ? (i * 37) % 23 : 0,
          } as CSSProperties
        }
      >
        {d || wrong ? (
          <span className="fk-sudoku-digit">{d || wrong}</span>
        ) : mask ? (
          <span className="fk-sudoku-notes" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <i key={n} className={selDigit === n ? 'hit' : ''}>
                {mask & (1 << (n - 1)) ? n : ''}
              </i>
            ))}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <Panel className={`fk-sudoku ${won ? 'won' : ''} ${lost ? 'lost' : ''}`}>
      {toast}
      <div className="fk-sudoku-bar">
        {view.tier === 'expert' ? (
          <span className="fk-badge">Expert</span>
        ) : (
          <span className="fk-sudoku-tier">{TIER_NAME[view.tier]}</span>
        )}
        <span className="fk-sudoku-mistakes" aria-live="polite">
          Mistakes: <b className={mistakes ? 'on' : ''}>{mistakes}</b>/
          {p.allowance}
        </span>
      </div>
      <fieldset
        className="fk-sudoku-grid"
        aria-label="Sudoku grid"
        ref={gridRef}
      >
        {BOX_CELLS.map((cells, b) => (
          <div className="fk-sudoku-box" key={b}>
            {cells.map(cell)}
          </div>
        ))}
      </fieldset>
      <div className="fk-sudoku-tools">
        <button
          type="button"
          className="fk-sudoku-tool"
          onClick={() => void erase()}
          disabled={done}
          aria-label="Erase"
        >
          <Eraser size={20} aria-hidden="true" />
          <span>Erase</span>
        </button>
        <button
          type="button"
          className={`fk-sudoku-tool ${noting ? 'on' : ''}`}
          onClick={() => setNoting((v) => !v)}
          disabled={done}
          aria-pressed={noting}
          aria-label="Notes"
        >
          <Pencil size={20} aria-hidden="true" />
          <span>Notes</span>
          <em>{noting ? 'On' : 'Off'}</em>
        </button>
      </div>
      <div
        className={`fk-sudoku-pad ${noting ? 'noting' : ''}`}
        aria-label="Numbers"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            type="button"
            key={n}
            className={`fk-sudoku-num ${counts[n] >= 9 ? 'spent' : ''}`}
            disabled={done || counts[n] >= 9}
            onClick={() => void enter(n)}
            aria-label={`${n}${noting ? ' note' : ''}`}
          >
            {n}
          </button>
        ))}
      </div>
    </Panel>
  );
}
