'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CornerDownLeft, Delete } from 'lucide-react';
import type { Puzzle } from '@/lib/games/folio/types';
import './shared.css';

/**
 * Props every Folio game UI receives. `move` resolves to null when the server
 * accepted the move, or to the player-facing reason it was rejected (nothing
 * was spent). When `done` is true the view holds the revealed final state.
 */
export type KindProps<V> = {
  p: Puzzle;
  view: V;
  busy: boolean;
  done: boolean;
  move: (move: Record<string, unknown>) => Promise<string | null>;
};

/** A short message that floats over the board, like Wordle's "Not in word list". */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, ms = 1600) => {
    clearTimeout(timer.current);
    setToast({ text, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast ? (
    <output className="fk-toast" key={toast.id}>
      {toast.text}
    </output>
  ) : null;
  return [node, show] as const;
}
/** Toggle a class for one animation run, e.g. a shake on a rejected row. */
export function usePulse(ms = 600) {
  const [on, setOn] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const fire = useCallback(() => {
    clearTimeout(timer.current);
    setOn((n) => n + 1);
    timer.current = setTimeout(() => setOn(0), ms);
  }, [ms]);
  return [on > 0, fire] as const;
}
/**
 * Physical keyboard input for letter games. Ignored while typing in a text
 * field or while a dialog is open.
 */
export function useKeys(onKey: (key: string) => void, enabled = true) {
  const latest = useRef(onKey);
  useEffect(() => {
    latest.current = onKey;
  });
  useEffect(() => {
    if (!enabled) return;
    const handle = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [role="dialog"]') ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const key =
        e.key === 'Enter'
          ? 'ENTER'
          : e.key === 'Backspace'
            ? 'BACK'
            : e.key.length === 1
              ? e.key.toUpperCase()
              : '';
      if (!key) return;
      if (key === 'ENTER' || key === 'BACK' || /^[A-Z0-9+\-*/=]$/.test(key)) {
        e.preventDefault();
        latest.current(key);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [enabled]);
}
export const QWERTY = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
/**
 * On-screen keyboard. `state(key)` returns a grade (2 hit, 1 near, 0 miss,
 * -1 unknown) or, for split keys such as Quordle's, one grade per quarter.
 */
export function Keyboard({
  rows = QWERTY,
  state,
  onKey,
  disabled,
  enterLabel = 'Enter',
}: {
  rows?: string[];
  state: (key: string) => number | number[];
  onKey: (key: string) => void;
  disabled?: boolean;
  enterLabel?: string;
}) {
  return (
    <div className="fk-keyboard" aria-label="Keyboard">
      {rows.map((row, r) => (
        <div key={row} className="fk-key-row">
          {r === rows.length - 1 && (
            <button
              type="button"
              className="fk-key wide"
              disabled={disabled}
              onClick={() => onKey('ENTER')}
            >
              <span>{enterLabel}</span>
              <CornerDownLeft size={15} aria-hidden="true" />
            </button>
          )}
          {row.split('').map((key) => {
            const s = state(key);
            return (
              <button
                type="button"
                key={key}
                className="fk-key"
                disabled={disabled}
                data-grade={Array.isArray(s) ? undefined : s}
                onClick={() => onKey(key)}
                aria-label={key}
              >
                {Array.isArray(s) && (
                  <span className="fk-key-split" aria-hidden="true">
                    {s.map((g, i) => (
                      <i key={i} data-grade={g} />
                    ))}
                  </span>
                )}
                <span className="fk-key-label">{key}</span>
              </button>
            );
          })}
          {r === rows.length - 1 && (
            <button
              type="button"
              className="fk-key wide"
              disabled={disabled}
              onClick={() => onKey('BACK')}
              aria-label="Delete"
            >
              <Delete size={18} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
/** Best known grade per key across graded guesses. */
export function keyGrades(guesses: { word: string; marks: number[] }[]) {
  const best: Record<string, number> = {};
  for (const g of guesses)
    g.word.split('').forEach((c, i) => {
      best[c] = Math.max(best[c] ?? -1, g.marks[i]);
    });
  return (key: string) => best[key] ?? -1;
}
/**
 * One row of letter tiles. `reveal` flips tiles in with a stagger (a freshly
 * graded row); `pop` bounces the last typed tile.
 */
export function TileRow({
  letters,
  length,
  marks,
  reveal,
  shake,
  win,
  small,
}: {
  letters: string;
  length: number;
  marks?: number[];
  reveal?: boolean;
  shake?: boolean;
  win?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`fk-row ${shake ? 'shake' : ''} ${win ? 'win' : ''} ${small ? 'small' : ''}`}
      style={{ gridTemplateColumns: `repeat(${length}, 1fr)` }}
    >
      {Array.from({ length }, (_, i) => {
        const c = letters[i]?.trim() ?? '';
        const m = marks?.[i];
        return (
          <span
            key={i}
            className={`fk-tile ${reveal ? 'reveal' : ''} ${c ? 'filled' : ''}`}
            data-grade={m ?? -1}
            style={{ '--i': i } as React.CSSProperties}
            aria-label={
              c
                ? `${c}${m === 2 ? ', correct' : m === 1 ? ', elsewhere' : m === 0 ? ', absent' : ''}`
                : undefined
            }
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}
/**
 * Index of the first row that should still animate. Rows already on screen at
 * mount never animate; a newly added row keeps animating for `ms` even if the
 * component re-renders from polling in the meantime.
 */
export function useFresh(count: number, ms = 2200) {
  const [from, setFrom] = useState(count);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) {
      setFrom(prev.current);
      prev.current = count;
      const t = setTimeout(() => setFrom(count), ms);
      return () => clearTimeout(t);
    }
    prev.current = count;
    setFrom(count);
  }, [count, ms]);
  return Math.min(from, count);
}
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`fk-panel ${className}`}>{children}</div>;
}
