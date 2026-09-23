'use client';
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { WaffleView } from '@/lib/games/folio/kinds/waffle';
import { Panel, usePulse, useToast, type KindProps } from './shared';
import './waffle.css';

type Mark = number | 'r';
type Drag = {
  from: number;
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  on: boolean;
};
const isHole = (i: number, n: number) =>
  Math.floor(i / n) % 2 === 1 && (i % n) % 2 === 1;
const calm = () =>
  typeof window === 'undefined' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PRAISE = ['Phew!', 'Nice', 'Good', 'Great', 'Superb', 'Perfect'];

export default function Waffle({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<WaffleView>) {
  const n = view.size;
  const [chosen, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse(500);
  const [shaking, setShaking] = useState<number[]>([]);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const board = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const drop = useRef<{
    from: number;
    dx: number;
    dy: number;
  } | null>(null);

  const won = view.marks.every((m) => m === 2 || m === -1);
  const lost = done && !won && !!view.solution;
  const letters = lost ? view.solution! : view.letters;
  const marks: Mark[] = lost
    ? letters.map((c, i) => (!c ? -1 : view.letters[i] === c ? 2 : 'r'))
    : view.marks;
  const locked = (i: number) => done || marks[i] === 2 || marks[i] === -1;
  // Another player's swap (or the reveal) can lock the selected tile: drop it.
  const selected = chosen !== null && !locked(chosen) ? chosen : null;

  // Animate whatever changed since the last paint: letters glide from their
  // old cell (or from where a drag dropped them), then changed colours flip.
  const key = `${letters.join('')}|${marks.join('')}`;
  const shown = useRef<{
    letters: string[];
    marks: Mark[];
    key: string;
  } | null>(null);
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { letters: [...letters], marks: [...marks], key };
    const dropped = drop.current;
    drop.current = null;
    if (!before || before.key === key || calm() || !board.current) return;
    const css = getComputedStyle(board.current);
    const colour = (m: Mark | 'ink' | 'text') =>
      css.getPropertyValue(`--fk-waffle-c${m}`).trim();
    const changed = letters
      .map((_, i) => i)
      .filter((i) => letters[i] !== before.letters[i]);
    const used = new Set<number>();
    const landed = new Map<number, number>();
    const glide = lost ? 560 : 380;
    changed.forEach((i, k) => {
      const from = changed.filter(
        (j) => !used.has(j) && before.letters[j] === letters[i],
      );
      const j = from.find((f) => letters[f] === before.letters[i]) ?? from[0];
      const el = tiles.current[i],
        src = j === undefined ? null : tiles.current[j];
      if (j === undefined || !el || !src) return;
      used.add(j);
      let dx = src.offsetLeft - el.offsetLeft,
        dy = src.offsetTop - el.offsetTop;
      const fromDrop = dropped?.from === j;
      if (fromDrop) {
        dx += dropped.dx;
        dy += dropped.dy;
      }
      // One tile rides over the other so they visibly pass each other.
      const over = dropped ? fromDrop : i > j;
      const mid = over ? 1.14 : 0.9;
      const delay = lost ? 250 + k * 55 : 0;
      el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${fromDrop ? 1.1 : 1})`,
            zIndex: over ? 3 : 2,
          },
          {
            transform: `translate(${dx / 2}px, ${dy / 2}px) scale(${mid})`,
            zIndex: over ? 3 : 2,
            offset: 0.5,
          },
          { transform: 'translate(0, 0) scale(1)', zIndex: over ? 3 : 2 },
        ],
        {
          duration: glide,
          delay,
          easing: 'cubic-bezier(.35,.1,.25,1)',
          fill: 'backwards',
        },
      );
      landed.set(i, delay + glide);
    });
    let stagger = 0;
    marks.forEach((m, i) => {
      if (m === -1 || m === before.marks[i]) return;
      const face = tiles.current[i]?.firstElementChild as HTMLElement | null;
      if (!face) return;
      const now = getComputedStyle(face);
      const to = {
        backgroundColor: now.backgroundColor,
        borderColor: now.borderColor,
        color: now.color,
      };
      const was = {
        backgroundColor: colour(before.marks[i]),
        borderColor: colour(before.marks[i]),
        color: before.marks[i] === 0 ? colour('ink') : colour('text'),
      };
      const delay = landed.get(i) ?? (lost ? 250 : glide + stagger++ * 40);
      face.animate(
        [
          { ...was, transform: 'rotateX(0deg)' },
          { ...was, transform: 'rotateX(90deg)', offset: 0.5 },
          { ...to, transform: 'rotateX(90deg)', offset: 0.5 },
          { ...to, transform: 'rotateX(0deg)' },
        ],
        { duration: 420, delay, easing: 'ease-in-out', fill: 'backwards' },
      );
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function swap(
    a: number,
    b: number,
    dropAt?: { dx: number; dy: number },
  ) {
    setSelected(null);
    if (letters[a] === letters[b]) {
      reject([a, b], 'Those letters are the same');
      return;
    }
    drop.current = dropAt ? { from: a, ...dropAt } : null;
    const error = await move({ a, b });
    if (error) {
      drop.current = null;
      reject([a, b], error);
    }
  }
  function reject(cells: number[], text: string) {
    say(text);
    setShaking(cells);
    fireShake();
  }
  function tap(i: number) {
    if (busy || locked(i)) return;
    if (selected === null) setSelected(i);
    else if (selected === i) setSelected(null);
    else void swap(selected, i);
  }

  function down(e: ReactPointerEvent<HTMLButtonElement>, i: number) {
    if (busy || locked(i) || (e.pointerType === 'mouse' && e.button !== 0))
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const d = {
      from: i,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      on: false,
    };
    dragRef.current = d;
  }
  function moveDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!d.on && Math.hypot(dx, dy) < 7) return;
    const next = { ...d, dx, dy, on: true };
    dragRef.current = next;
    setDrag(next);
    if (selected !== null) setSelected(null);
  }
  function up(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.on) {
      tap(d.from);
      return;
    }
    const target = tiles.current.findIndex((el, i) => {
      if (!el || i === d.from || locked(i)) return false;
      const r = el.getBoundingClientRect();
      return (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      );
    });
    if (target >= 0) void swap(d.from, target, { dx: d.dx, dy: d.dy });
    else if (!calm())
      tiles.current[d.from]?.animate(
        [
          { transform: `translate(${d.dx}px, ${d.dy}px) scale(1.1)` },
          { transform: 'none' },
        ],
        { duration: 240, easing: 'cubic-bezier(.3,1.4,.5,1)' },
      );
  }
  function cancel() {
    dragRef.current = null;
    setDrag(null);
  }

  const stars = Math.max(0, Math.min(5, p.remaining));
  return (
    <Panel className={`fk-waffle ${view.deluxe ? 'fk-waffle-deluxe' : ''}`}>
      {toast}
      <div
        ref={board}
        className={`fk-waffle-board ${won && done ? 'fk-waffle-won' : ''} ${lost ? 'fk-waffle-lost' : ''}`}
        style={{ '--n': n } as CSSProperties}
        aria-label={`Waffle, ${view.deluxe ? 'eight' : 'six'} words`}
      >
        {letters.map((c, i) => {
          if (isHole(i, n))
            return (
              <span key={i} className="fk-waffle-hole" aria-hidden="true" />
            );
          const m = marks[i];
          const dragging = drag?.on && drag.from === i;
          const r = Math.floor(i / n),
            col = i % n;
          return (
            <button
              key={i}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              type="button"
              className={[
                'fk-waffle-tile',
                selected === i ? 'fk-waffle-picked' : '',
                dragging ? 'fk-waffle-dragging' : '',
                shake && shaking.includes(i) ? 'fk-waffle-shake' : '',
                locked(i) ? 'fk-waffle-locked' : '',
              ].join(' ')}
              style={
                {
                  '--d': r + col,
                  ...(dragging
                    ? {
                        transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.1)`,
                      }
                    : {}),
                } as CSSProperties
              }
              aria-label={`${c}, row ${r + 1} column ${col + 1}, ${
                m === 2
                  ? 'correct'
                  : m === 1
                    ? 'in this word elsewhere'
                    : m === 'r'
                      ? 'answer'
                      : 'not in this word'
              }${selected === i ? ', selected' : ''}`}
              aria-pressed={selected === i}
              disabled={done}
              onPointerDown={(e) => down(e, i)}
              onPointerMove={moveDrag}
              onPointerUp={up}
              onPointerCancel={cancel}
              onClick={(e) => {
                // Pointer taps are handled on pointerup; this is Enter/Space.
                if (e.detail === 0) tap(i);
              }}
            >
              <span className="fk-waffle-face" data-grade={m}>
                {c}
              </span>
            </button>
          );
        })}
      </div>
      {done && won ? (
        <output className="fk-waffle-result">
          <span className="fk-waffle-stars" aria-label={`${stars} of 5 stars`}>
            {Array.from({ length: 5 }, (_, k) => (
              <span
                key={k}
                className={k < stars ? 'on' : ''}
                style={{ '--k': k } as CSSProperties}
                aria-hidden="true"
              >
                ★
              </span>
            ))}
          </span>
          <span className="fk-waffle-praise">
            {PRAISE[stars]} · {p.remaining}{' '}
            {p.remaining === 1 ? 'swap' : 'swaps'} to spare
          </span>
        </output>
      ) : (
        <output className="fk-waffle-count">
          {done && !won ? (
            <>Out of swaps</>
          ) : (
            <>
              <b>{p.remaining}</b> {p.remaining === 1 ? 'swap' : 'swaps'}{' '}
              remaining
            </>
          )}
        </output>
      )}
    </Panel>
  );
}
