'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { Flag, Shovel } from 'lucide-react';
import type { MinesView } from '@/lib/games/folio/kinds/mines';
import { Panel, usePulse, useToast, type KindProps } from './shared';
import './mines.css';

const MINE = 9;
const LONG_PRESS = 380;

function around(i: number, size: number) {
  const x = i % size,
    y = (i - x) / size,
    out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx,
        ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < size && ny < size)
        out.push(ny * size + nx);
    }
  return out;
}
const reach = (a: number, b: number, size: number) =>
  Math.max(
    Math.abs((a % size) - (b % size)),
    Math.abs(Math.floor(a / size) - Math.floor(b / size)),
  );

function MineGlyph() {
  return (
    <svg className="fk-mines-mine" viewBox="0 0 20 20" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M10 2.2v15.6M2.2 10h15.6M4.5 4.5l11 11M15.5 4.5l-11 11" />
      </g>
      <circle cx="10" cy="10" r="5.6" fill="currentColor" />
      <circle cx="8.1" cy="8.1" r="1.5" fill="#fffaf0" opacity="0.85" />
    </svg>
  );
}
function FlagGlyph({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`fk-mines-flag ${className}`}
      style={style}
      viewBox="2 1.5 15 16"
      aria-hidden="true"
    >
      <path
        d="M5.5 16.3h10"
        style={{ stroke: 'var(--folio-ink)' }}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11.6 16V3"
        style={{ stroke: 'var(--folio-ink)' }}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M12 2.4 3.2 7.2l8.8 4.8z" style={{ fill: 'var(--folio-red)' }} />
    </svg>
  );
}

export default function Mines({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<MinesView>) {
  const { size, cells, flags } = view;
  const total = size * size;
  const [mode, setMode] = useState<'dig' | 'flag'>('dig');
  const [focus, setFocus] = useState(-1);
  const [pressed, setPressed] = useState<number[]>([]);
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse(500);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const press = useRef<{
    timer?: ReturnType<typeof setTimeout>;
    fired: boolean;
    touch: boolean;
  }>({
    fired: false,
    touch: false,
  });
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(press.current.timer);
      clearTimeout(pressTimer.current);
    },
    [],
  );

  // Squares opened by the latest move pop open in a ripple from where it began.
  // Cells only change on opens and chords, which always bump the turn.
  const [anim, setAnim] = useState({
    turn: view.turn,
    cells,
    delays: new Map<number, number>(),
  });
  let current = anim;
  if (anim.turn !== view.turn) {
    const before = anim.cells;
    const fresh = cells.flatMap((c, i) =>
      c >= 0 && before[i] !== c ? [i] : [],
    );
    const far = Math.max(1, ...fresh.map((i) => reach(i, view.last, size)));
    const step = Math.min(45, 520 / far);
    current = {
      turn: view.turn,
      cells,
      delays: new Map(
        fresh.map((i) => [i, Math.round(reach(i, view.last, size) * step)]),
      ),
    };
    setAnim(current);
  }
  const delays = current.delays;
  // Flags already planted when the board mounted do not replay their wobble.
  const [settled, setSettled] = useState(
    () => new Set(flags.flatMap((f, i) => (f ? [i] : []))),
  );
  if ([...settled].some((i) => !flags[i]))
    setSettled(new Set([...settled].filter((i) => flags[i])));

  const won = p.status === 'won';
  const lost = done && !won;
  const mineSet = new Set(view.mines ?? []);
  const flagCount = flags.filter((f, i) => f && cells[i] === -1).length;
  const blown = cells.filter((c) => c === MINE).length;
  const left = view.count - flagCount - blown;
  // On a loss the other mines surface one by one, nearest the blast first;
  // on a win every flag blooms outward from the final square.
  const origin = view.last >= 0 ? view.last : 0;
  const revealOrder = new Map<number, number>();
  let late = 0;
  if (lost && view.mines) {
    const hidden = view.mines
      .filter((m) => cells[m] === -1 && !flags[m])
      .sort((a, b) => reach(a, origin, size) - reach(b, origin, size));
    const step = Math.min(70, 1400 / Math.max(1, hidden.length));
    hidden.forEach((m, k) => revealOrder.set(m, 420 + k * step));
    late = 420 + hidden.length * step + 120;
  }
  async function send(m: Record<string, unknown>) {
    const error = await move(m);
    if (error) {
      say(error);
      fireShake();
    }
  }
  function flash(list: number[]) {
    clearTimeout(pressTimer.current);
    setPressed(list);
    pressTimer.current = setTimeout(() => setPressed([]), 180);
  }
  function act(i: number, how: 'dig' | 'flag') {
    if (done || busy) return;
    const c = cells[i];
    if (c === -1) {
      if (how === 'flag') void send({ flag: i });
      else if (!flags[i]) void send({ open: i });
      return;
    }
    if (c > 0 && c < MINE) {
      const ring = around(i, size);
      const marked = ring.filter((k) => flags[k] || cells[k] === MINE).length;
      const targets = ring.filter((k) => cells[k] === -1 && !flags[k]);
      if (marked === c && targets.length) void send({ chord: i });
      else flash(targets);
    }
  }
  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const at = focus < 0 ? 0 : focus;
    const moves: Record<string, number> = {
      ArrowLeft: at % size ? -1 : 0,
      ArrowRight: at % size < size - 1 ? 1 : 0,
      ArrowUp: at >= size ? -size : 0,
      ArrowDown: at < total - size ? size : 0,
    };
    if (e.key in moves) {
      e.preventDefault();
      const next = at + moves[e.key];
      setFocus(next);
      buttons.current[next]?.focus();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      act(at, 'flag');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act(at, mode);
    }
  }

  function label(i: number) {
    const where = `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`;
    const c = cells[i];
    if (c === MINE) return `${where}, mine`;
    if (c === 0) return `${where}, empty`;
    if (c > 0) return `${where}, ${c}`;
    if (done && mineSet.has(i))
      return `${where}, ${flags[i] ? 'flagged mine' : 'mine'}`;
    if (flags[i]) return `${where}, flagged${lost ? ', no mine' : ''}`;
    return `${where}, hidden`;
  }

  const pressedSet = new Set(pressed);
  return (
    <Panel
      className={`fk-mines fk-mines-s${size} ${won ? 'won' : ''} ${lost ? 'lost' : ''}`}
    >
      {toast}
      <div className="fk-mines-bar">
        <span className="fk-mines-count" aria-label={`${left} mines left`}>
          <MineGlyph />
          <b>
            {left < 0
              ? `-${String(-left).padStart(2, '0')}`
              : String(left).padStart(3, '0')}
          </b>
        </span>
        <div className="fk-mines-mode">
          <button
            type="button"
            aria-pressed={mode === 'dig'}
            onClick={() => setMode('dig')}
            disabled={done}
          >
            <Shovel size={15} aria-hidden="true" /> Dig
          </button>
          <button
            type="button"
            aria-pressed={mode === 'flag'}
            onClick={() => setMode('flag')}
            disabled={done}
          >
            <Flag size={15} aria-hidden="true" /> Flag
          </button>
        </div>
      </div>
      <div
        className={`fk-mines-board ${shake ? 'shake' : ''}`}
        style={{ '--n': size, '--late': `${late}ms` } as CSSProperties}
        aria-label={`Minefield, ${size} by ${size}`}
      >
        {cells.map((c, i) => {
          const x = i % size,
            y = Math.floor(i / size);
          const open = c >= 0;
          const flagged = !open && flags[i];
          const isMine = mineSet.has(i);
          const delay = delays.get(i);
          const shown = revealOrder.get(i);
          const cls = [
            'fk-mines-cell',
            open ? 'open' : 'hid',
            c === MINE ? 'boom' : '',
            delay !== undefined ? 'fresh' : '',
            pressedSet.has(i) ? 'press' : '',
            shown !== undefined ? 'shown' : '',
            lost && flagged && !isMine && view.mines ? 'wrong' : '',
          ].join(' ');
          return (
            <button
              key={i}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              className={cls}
              data-n={open && c < MINE ? c : undefined}
              tabIndex={i === (focus < 0 ? 0 : focus) ? 0 : -1}
              aria-label={label(i)}
              aria-disabled={done || (open && c === 0) || undefined}
              style={
                {
                  '--d': `${delay ?? shown ?? (won ? 300 + reach(i, origin, size) * 50 : 0)}ms`,
                  '--w': x + y,
                } as CSSProperties
              }
              onFocus={() => setFocus(i)}
              onKeyDown={onKey}
              onPointerDown={(e) => {
                press.current.touch = e.pointerType !== 'mouse';
                press.current.fired = false;
                clearTimeout(press.current.timer);
                if (!press.current.touch || done) return;
                press.current.timer = setTimeout(() => {
                  press.current.fired = true;
                  if (cells[i] === -1) {
                    navigator.vibrate?.(12);
                    act(i, 'flag');
                  }
                }, LONG_PRESS);
              }}
              onPointerUp={() => clearTimeout(press.current.timer)}
              onPointerLeave={() => clearTimeout(press.current.timer)}
              onPointerCancel={() => clearTimeout(press.current.timer)}
              onClick={() => {
                if (press.current.fired) {
                  press.current.fired = false;
                  return;
                }
                act(i, mode);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!press.current.touch) act(i, 'flag');
              }}
            >
              {open && c > 0 && c < MINE && (
                <span className="fk-mines-num">{c}</span>
              )}
              {c === MINE && <MineGlyph />}
              {!open && shown !== undefined && <MineGlyph />}
              {flagged && (
                <FlagGlyph
                  className={
                    won ? 'bloom' : settled.has(i) && flags[i] ? '' : 'plant'
                  }
                />
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
