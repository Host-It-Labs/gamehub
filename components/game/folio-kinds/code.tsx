'use client';
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { CodeView } from '@/lib/games/folio/kinds/code';
import {
  Panel,
  useFresh,
  useKeys,
  usePulse,
  useToast,
  type KindProps,
} from './shared';
import './code.css';

/** Code peg colours (index = colour id); names match the server's reveal text. */
export const PEGS = [
  { name: 'Red', fill: '#d4462b', ink: 'light' },
  { name: 'Blue', fill: '#2a5bc0', ink: 'light' },
  { name: 'Yellow', fill: '#f1c137', ink: 'dark' },
  { name: 'Green', fill: '#3d8b4c', ink: 'light' },
  { name: 'Purple', fill: '#7a4a9f', ink: 'light' },
  { name: 'Sky', fill: '#62b8dc', ink: 'dark' },
  { name: 'Pink', fill: '#ec97b3', ink: 'dark' },
  { name: 'Brown', fill: '#85572f', ink: 'light' },
] as const;

/** A small printed symbol on every peg so colours never have to be told apart by hue alone. */
function Glyph({ c }: { c: number }) {
  const d = [
    <path key="t" d="M12 4.5 20 18.5H4z" />,
    <rect key="s" x="5.5" y="5.5" width="13" height="13" />,
    <circle key="c" cx="12" cy="12" r="6.8" />,
    <path key="d" d="M12 3.5 20.5 12 12 20.5 3.5 12z" />,
    <path
      key="st"
      d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20.1l1.4-6.3L3 9.5l6.4-.6z"
    />,
    <path key="p" d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z" />,
    <path
      key="h"
      d="M12 20s-7.5-4.7-7.5-10A4 4 0 0 1 12 7.6 4 4 0 0 1 19.5 10c0 5.3-7.5 10-7.5 10z"
    />,
    <path
      key="r"
      fillRule="evenodd"
      d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 4.2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z"
    />,
  ][c];
  return (
    <svg className="fk-code-glyph" viewBox="0 0 24 24" aria-hidden="true">
      {d}
    </svg>
  );
}
function Peg({ c, style }: { c: number; style?: CSSProperties }) {
  const peg = PEGS[c];
  return (
    <span
      className="fk-code-peg"
      data-ink={peg.ink}
      style={{ '--peg': peg.fill, ...style } as CSSProperties}
    >
      <Glyph c={c} />
    </span>
  );
}
const empty = (n: number) => Array<number | null>(n).fill(null);
const names = (code: (number | null)[]) =>
  code.map((c) => (c === null ? 'empty' : PEGS[c].name)).join(', ');

export default function Code({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<CodeView>) {
  const { pegs, colours } = view;
  const [stored, setDraft] = useState(() => empty(pegs));
  // A different board (new puzzle) means a fresh draft.
  const fit = (d: (number | null)[]) => (d.length === pegs ? d : empty(pegs));
  const draft = fit(stored);
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse();
  const [drag, setDrag] = useState<{
    c: number;
    x: number;
    y: number;
    hole: number | null;
  } | null>(null);
  const dragStart = useRef<{
    c: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fresh = useFresh(view.guesses.length, 3200);
  const played = view.guesses.length;
  const won = view.guesses.at(-1)?.black === pegs;
  const total = Math.max(view.rows, p.allowance, played);
  const active = done ? -1 : played;
  const full = draft.every((c) => c !== null);
  const idle = done || busy;

  function place(c: number, hole?: number) {
    if (idle || c < 0 || c >= colours) return;
    setDraft((stale) => {
      const d = fit(stale);
      const at = hole ?? d.indexOf(null);
      if (at < 0) return d;
      const next = [...d];
      next[at] = c;
      return next;
    });
  }
  function clear(hole: number) {
    if (idle) return;
    setDraft((d) => fit(d).map((c, i) => (i === hole ? null : c)));
  }
  async function check() {
    if (idle) return;
    if (!full) {
      say(`Fill all ${pegs} holes`);
      fireShake();
      return;
    }
    const error = await move({ guess: draft });
    if (error) {
      say(error);
      fireShake();
    } else setDraft(empty(pegs));
  }
  function key(k: string) {
    if (k === 'ENTER') void check();
    else if (k === 'BACK') {
      const last = draft.findLastIndex((c) => c !== null);
      if (last >= 0) clear(last);
    } else if (/^[1-9]$/.test(k)) place(Number(k) - 1);
  }
  useKeys(key, !done);

  // Drag a peg from the tray into a hole; a press without movement is a tap.
  const holeAt = (x: number, y: number) => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-fk-code-hole]');
    return el ? Number(el.dataset.fkCodeHole) : null;
  };
  function down(e: ReactPointerEvent, c: number) {
    if (idle || e.button !== 0) return;
    dragStart.current = { c, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function over(e: ReactPointerEvent) {
    const s = dragStart.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
    s.moved = true;
    setDrag({
      c: s.c,
      x: e.clientX - (wrapRef.current?.getBoundingClientRect().left ?? 0),
      y: e.clientY - (wrapRef.current?.getBoundingClientRect().top ?? 0),
      hole: holeAt(e.clientX, e.clientY),
    });
  }
  function up(e: ReactPointerEvent) {
    const s = dragStart.current;
    dragStart.current = null;
    setDrag(null);
    if (!s) return;
    if (!s.moved) place(s.c);
    else {
      const hole = holeAt(e.clientX, e.clientY);
      if (hole !== null) place(s.c, hole);
    }
  }

  const rows = Array.from({ length: total }, (_, r) => {
    const g = view.guesses[r];
    const isActive = r === active;
    const code: (number | null)[] = g ? g.code : isActive ? draft : empty(pegs);
    const keys = g
      ? [...Array(g.black).fill('b'), ...Array(g.white).fill('w')]
      : [];
    const animate = g && r >= fresh;
    return (
      <fieldset
        key={r}
        className={`fk-code-row ${isActive ? 'active' : ''} ${isActive && shake ? 'shake' : ''} ${g ? 'played' : ''}`}
        aria-label={
          g
            ? `Row ${r + 1}: ${names(g.code)}. ${g.black} black, ${g.white} white`
            : isActive
              ? `Row ${r + 1}, your guess`
              : `Row ${r + 1}, empty`
        }
      >
        <span className="fk-code-num" aria-hidden="true">
          {r + 1}
        </span>
        <span className="fk-code-holes">
          {code.map((c, i) =>
            isActive ? (
              <button
                key={i}
                type="button"
                className={`fk-code-hole ${drag?.hole === i ? 'target' : ''}`}
                data-fk-code-hole={i}
                disabled={idle}
                onClick={() => c !== null && clear(i)}
                aria-label={`Hole ${i + 1}, ${c === null ? 'empty' : `${PEGS[c].name}, tap to clear`}`}
              >
                {c !== null && <Peg key={c} c={c} />}
              </button>
            ) : (
              <span key={i} className="fk-code-hole">
                {c !== null && <Peg c={c} />}
              </span>
            ),
          )}
        </span>
        <span
          className={`fk-code-keys ${pegs === 5 ? 'five' : ''}`}
          aria-hidden="true"
        >
          {Array.from({ length: pegs }, (_, i) => (
            <i key={i} className="fk-code-khole">
              {keys[i] && (
                <b
                  className={`fk-code-key ${keys[i] === 'b' ? 'black' : 'white'} ${animate ? 'drop' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                />
              )}
            </i>
          ))}
        </span>
      </fieldset>
    );
  });

  return (
    <Panel className="fk-code">
      {toast}
      <div
        ref={wrapRef}
        className="fk-code-wrap"
        style={
          {
            '--rows': total,
            '--pegs': pegs,
            '--colours': colours,
          } as CSSProperties
        }
      >
        <div className={`fk-code-board ${done ? (won ? 'won' : 'lost') : ''}`}>
          <fieldset
            className="fk-code-secret"
            aria-label={
              view.answer
                ? `Hidden code: ${names(view.answer)}`
                : 'Hidden code, covered by the shield'
            }
          >
            <span className="fk-code-num" aria-hidden="true" />
            <span className="fk-code-holes">
              {Array.from({ length: pegs }, (_, i) => (
                <span key={i} className="fk-code-hole">
                  {view.answer && (
                    <Peg
                      c={view.answer[i]}
                      style={{ '--i': i } as CSSProperties}
                    />
                  )}
                </span>
              ))}
            </span>
            <span
              className={`fk-code-keys fk-code-keys-spacer ${pegs === 5 ? 'five' : ''}`}
            >
              {Array.from({ length: pegs }, (_, i) => (
                <i key={i} className="fk-code-khole" />
              ))}
            </span>
            <span
              className={`fk-code-shield ${view.answer ? 'open' : ''}`}
              aria-hidden="true"
            >
              <span>Codebreaker</span>
            </span>
          </fieldset>
          <div className="fk-code-rows">{rows}</div>
        </div>
        {drag && (
          <span
            className="fk-code-ghost"
            style={{ left: drag.x, top: drag.y }}
            aria-hidden="true"
          >
            <Peg c={drag.c} />
          </span>
        )}
        <div className="fk-code-tray" aria-label="Colours">
          {Array.from({ length: colours }, (_, c) => (
            <button
              key={c}
              type="button"
              className="fk-code-pick"
              disabled={idle}
              aria-label={`${PEGS[c].name} (${c + 1})`}
              onPointerDown={(e) => down(e, c)}
              onPointerMove={over}
              onPointerUp={up}
              onPointerCancel={() => {
                dragStart.current = null;
                setDrag(null);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  place(c);
                }
              }}
            >
              <Peg c={c} />
              <small aria-hidden="true">{c + 1}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="fk-code-bar">
        {done ? (
          <p className="fk-answer fk-code-result">
            {won
              ? `Cracked in ${played} ${played === 1 ? 'row' : 'rows'}`
              : 'Out of rows'}
          </p>
        ) : (
          <button
            type="button"
            className="fk-code-check"
            disabled={idle || !full}
            onClick={() => void check()}
          >
            Check
          </button>
        )}
      </div>
    </Panel>
  );
}
