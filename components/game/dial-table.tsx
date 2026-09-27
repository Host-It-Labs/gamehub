'use client';
import { useId, useRef, useState, type PointerEvent } from 'react';
import { Check, LockKeyhole, Send } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import { bands, clueLimit, type DialGame } from '@/lib/games/party/dial';
import { spectrums } from '@/lib/games/party/spectrums';
import { CountUp, stagger } from './reveal-motion';
import './dial-table.css';

const CX = 200,
  CY = 200,
  R = 176,
  /** The coloured band runs between these radii. */
  IN = 118,
  OUT = 176;
/** 0 sits at the left end of the arc, 100 at the right. */
function at(value: number, radius = R) {
  const a = Math.PI * (1 - value / 100);
  return [CX + radius * Math.cos(a), CY - radius * Math.sin(a)] as const;
}
/** An annular slice of the band between two values. */
function slice(from: number, to: number, inner = IN, outer = OUT) {
  const lo = Math.max(0, from),
    hi = Math.min(100, to);
  const [a1, b1] = at(lo, outer),
    [a2, b2] = at(hi, outer),
    [c1, d1] = at(hi, inner),
    [c2, d2] = at(lo, inner);
  return `M${a1} ${b1} A${outer} ${outer} 0 0 1 ${a2} ${b2} L${c1} ${d1} A${inner} ${inner} 0 0 0 ${c2} ${d2} Z`;
}
const bandPoints = [4, 3, 2];
const angle = (v: number) => -180 + v * 1.8;

function Dial({
  left,
  right,
  point,
  needle,
  needles = [],
  onTurn,
  onSettle,
  disabled,
  waiting,
}: {
  left: string | null;
  right: string | null;
  /** Shown only to the clue-giver and at the reveal. */
  point: number | null;
  needle: number | null;
  needles?: { value: number; seat: number; initial: string; you: boolean }[];
  onTurn?: (value: number) => void;
  onSettle?: (value: number) => void;
  disabled?: boolean;
  /** Nobody but the clue-giver knows the spectrum yet. */
  waiting?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null),
    dragging = useRef<number | null>(null),
    id = useId().replace(/:/g, '');
  function valueAt(e: PointerEvent<SVGSVGElement>) {
    const matrix = svg.current!.getScreenCTM();
    if (!matrix) return null;
    const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    // Blank space below the hub is never part of the dial, even on release.
    if (y > CY + 16) return null;
    const a = Math.atan2(Math.max(0, CY - y), x - CX);
    return Math.round(Math.min(100, Math.max(0, 100 * (1 - a / Math.PI))));
  }
  const live = !!onTurn && !disabled;
  // Close guesses stack their markers outwards instead of overlapping.
  const levels = needles.map(() => 0);
  [...needles.keys()]
    .sort((a, b) => needles[a].value - needles[b].value)
    .forEach((k, j, sorted) => {
      const prev = sorted[j - 1];
      if (prev !== undefined && needles[k].value - needles[prev].value < 7)
        levels[k] = Math.min(2, levels[prev] + 1);
    });
  return (
    <div className={`dial-face ${waiting ? 'is-waiting' : ''}`}>
      <svg
        ref={svg}
        viewBox="-14 -40 428 260"
        className={live ? 'is-live' : ''}
        // The slider and the score chips carry the same information accessibly.
        aria-hidden="true"
        onPointerDown={(e) => {
          if (!live || dragging.current !== null || e.button !== 0) return;
          const value = valueAt(e);
          if (value === null) return;
          dragging.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          onTurn!(value);
        }}
        onPointerMove={(e) => {
          if (!live || dragging.current !== e.pointerId) return;
          const value = valueAt(e);
          if (value !== null) onTurn!(value);
        }}
        onPointerUp={(e) => {
          if (dragging.current !== e.pointerId) return;
          dragging.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          const value = valueAt(e);
          if (live && value !== null) onSettle?.(value);
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
        onLostPointerCapture={() => {
          dragging.current = null;
        }}
      >
        <defs>
          <linearGradient
            id={`${id}-band`}
            gradientUnits="userSpaceOnUse"
            x1={CX - OUT}
            x2={CX + OUT}
            y1="0"
            y2="0"
          >
            <stop offset="0" stopColor="#1f9e94" />
            <stop offset=".45" stopColor="#f2b531" />
            <stop offset=".72" stopColor="#f07a2a" />
            <stop offset="1" stopColor="#e5482e" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="50%" cy="100%" r="75%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter
            id={`${id}-soft`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <path
          className="dial-halo"
          d={slice(0, 100, IN - 6, OUT + 6)}
          fill={`url(#${id}-band)`}
          filter={`url(#${id}-soft)`}
        />
        <path
          className="dial-band-base"
          d={slice(0, 100)}
          fill={`url(#${id}-band)`}
        />
        <path
          className="dial-well"
          d={slice(0, 100, 0, IN)}
          fill={`url(#${id}-glow)`}
        />
        <path className="dial-rim" d={slice(0, 100, OUT, OUT + 14)} />
        {Array.from({ length: 25 }, (_, i) => {
          const [x, y] = at(i * (100 / 24), OUT + 7);
          return (
            <circle
              key={i}
              className="dial-bulb"
              cx={x}
              cy={y}
              r={3.4}
              style={{ animationDelay: `${(i % 2) * 0.6}s` }}
            />
          );
        })}
        {Array.from({ length: 11 }, (_, i) => {
          const [x1, y1] = at(i * 10, IN - 8),
            [x2, y2] = at(i * 10, IN - (i % 5 ? 16 : 24));
          return (
            <line
              key={i}
              className="dial-tick"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          );
        })}
        {point !== null && (
          <g className="dial-target" key={point}>
            {[...bands].reverse().map((b, i) => (
              <path
                key={b}
                className={`dial-zone zone-${bandPoints[bands.length - 1 - i]}`}
                d={slice(point - b, point + b, IN - 4, OUT + 4)}
                style={stagger(bands.length - 1 - i, 0, 120)}
              />
            ))}
            <text
              className="dial-zone-label"
              x={at(point, (IN + OUT) / 2)[0]}
              y={at(point, (IN + OUT) / 2)[1]}
            >
              4
            </text>
          </g>
        )}
        {needles.map((n, i) => {
          const [x, y] = at(n.value, IN - 10),
            [lx, ly] = at(n.value, OUT + 26 + levels[i] * 20);
          return (
            <g
              key={i}
              className={`dial-guess seat-${n.seat} ${n.you ? 'is-you' : ''}`}
              style={stagger(i, 420, 130)}
            >
              <line x1={CX} y1={CY} x2={x} y2={y} />
              <line
                className="dial-guess-tick"
                x1={at(n.value, IN - 4)[0]}
                y1={at(n.value, IN - 4)[1]}
                x2={at(n.value, OUT + 6)[0]}
                y2={at(n.value, OUT + 6)[1]}
              />
              <circle cx={lx} cy={ly} r={11} />
              <text x={lx} y={ly}>
                {n.initial}
              </text>
            </g>
          );
        })}
        {needle !== null && (
          <g
            className="dial-needle"
            style={{ transform: `rotate(${angle(needle)}deg)` }}
          >
            <polygon
              points={`${CX},${CY - 7} ${CX + OUT + 4},${CY - 1.5} ${CX + OUT + 4},${CY + 1.5} ${CX},${CY + 7}`}
            />
          </g>
        )}
        <circle className="dial-hub" cx={CX} cy={CY} r={16} />
        <circle className="dial-hub-core" cx={CX} cy={CY} r={6} />
      </svg>
      <div className="dial-ends">
        <span className="end-left">{left ?? ''}</span>
        <span className="end-right">{right ?? ''}</span>
      </div>
    </div>
  );
}

export function DialTable({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: DialGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  const writing = g.phase === 'clue',
    own = g.cards[viewer],
    // While everyone writes, you see your own spectrum; then the one being read.
    shown = writing ? own : g.cards[g.target],
    author = writing ? viewer : g.target,
    giver = author === viewer,
    card = shown && shown.card >= 0 ? spectrums[shown.card] : null,
    mine = g.guesses[viewer],
    written = writing && !!own?.locked,
    locked = writing ? written : !!mine?.locked;
  const [draft, setDraft] = useState({ key: '', text: '' }),
    [turning, setTurning] = useState<{ key: string; value: number } | null>(
      null,
    );
  const key = `${g.round}:${g.target}`,
    value = turning?.key === key ? turning.value : (mine?.value ?? 50),
    // The draft survives switching spectrums and unlocking, not the next round.
    clue = draft.key === `${g.round}` ? draft.text : (own?.clue ?? '');
  const name = g.seats[author];
  function settle(v: number) {
    setTurning({ key, value: v });
    commit({ type: 'dial', value: v });
  }
  const others = g.seats.length - 1,
    lockedCount = g.guesses.filter(
      (b, s) => s !== g.target && b?.locked,
    ).length,
    writtenCount = g.cards.filter((c) => c.locked).length;
  return (
    <section
      className={`dial-stage phase-${g.phase} ${giver ? 'is-giver' : ''}`}
    >
      <div
        className="dial-top"
        data-game-motion="change"
        data-game-motion-key={`${shown?.card}:${g.phase}:${g.target}`}
      >
        {writing && !written && own && own.offers.length > 1 && (
          <fieldset className="dial-switch" aria-label="Spectrum">
            {own.offers.map((id) => (
              <button
                key={id}
                type="button"
                className={own.card === id ? 'chosen' : ''}
                aria-pressed={own.card === id}
                disabled={disabled}
                onClick={() => commit({ type: 'card', target: id })}
              >
                <span>{spectrums[id].left}</span>
                <i aria-hidden="true" />
                <span>{spectrums[id].right}</span>
              </button>
            ))}
          </fieldset>
        )}
        {(!writing || written) && shown?.clue && (
          <p className="dial-clue" aria-live="polite">
            <span className={`party-avatar seat-${author}`} aria-hidden="true">
              {name.slice(0, 1)}
            </span>
            <q aria-label={`${name}’s clue: ${shown.clue}`}>{shown.clue}</q>
          </p>
        )}
      </div>
      <Dial
        left={card?.left ?? null}
        right={card?.right ?? null}
        waiting={!card}
        point={shown && shown.point >= 0 ? shown.point : null}
        needle={g.phase === 'guess' && !giver ? value : null}
        needles={
          g.phase === 'reveal' && g.result
            ? g.seats.flatMap((name, s) =>
                s === g.target || g.result!.guesses[s] < 0
                  ? []
                  : [
                      {
                        value: g.result!.guesses[s],
                        seat: s,
                        initial: name.slice(0, 1),
                        you: s === viewer,
                      },
                    ],
              )
            : []
        }
        disabled={disabled || locked}
        onTurn={
          g.phase === 'guess' && !giver
            ? (v) => setTurning({ key, value: v })
            : undefined
        }
        onSettle={settle}
      />
      {g.phase === 'guess' && !giver && (
        <input
          className="dial-slider"
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={disabled || locked}
          aria-label={
            card
              ? `Your dial between ${card.left} and ${card.right}`
              : 'Your dial'
          }
          onChange={(e) => setTurning({ key, value: Number(e.target.value) })}
          onPointerUp={(e) => settle(Number(e.currentTarget.value))}
          onKeyUp={(e) => settle(Number(e.currentTarget.value))}
        />
      )}
      {g.phase === 'reveal' && g.result && (
        <div className="dial-scores">
          {g.seats.map((name, s) => {
            const gain = g.result!.gains[s],
              at = 420 + (g.seats.length - 1) * 130 + 200 + s * 90,
              bullseye = s !== g.target && gain === 4;
            return (
              <span
                key={s}
                className={`seat-${s} ${s === viewer ? 'is-mine' : ''} ${bullseye ? 'is-bullseye reveal-burst' : ''} reveal-pop`}
                style={stagger(0, at)}
              >
                <i className={`party-avatar seat-${s}`} aria-hidden="true">
                  {name.slice(0, 1)}
                </i>
                <b>{s === viewer ? 'You' : name}</b>
                <strong>
                  +
                  <CountUp
                    value={gain}
                    duration={450}
                    delay={at}
                    format={(v) =>
                      Number.isInteger(gain)
                        ? String(Math.round(v))
                        : v.toFixed(2)
                    }
                  />
                </strong>
              </span>
            );
          })}
        </div>
      )}
      <div
        className="party-dock"
        aria-live="polite"
        data-game-motion="change"
        data-game-motion-key={`${g.phase}:${locked}`}
      >
        {writing && !written && (
          <form
            className="dial-clue-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (clue.trim()) commit({ type: 'clue', text: clue });
            }}
          >
            <input
              value={clue}
              maxLength={clueLimit}
              disabled={disabled || !card}
              placeholder="Your clue"
              aria-label="Your clue"
              onChange={(e) =>
                setDraft({ key: `${g.round}`, text: e.target.value })
              }
            />
            <button
              className="party-primary"
              disabled={disabled || !card || !clue.trim()}
              aria-label="Lock your clue"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        )}
        {((writing && written) || (g.phase === 'guess' && !giver)) &&
          (locked ? (
            <button
              className="party-locked"
              disabled={disabled}
              onClick={() => commit({ type: 'unlock' })}
            >
              <LockKeyhole size={17} aria-hidden="true" />
              Unlock
            </button>
          ) : (
            <button
              className="party-primary"
              disabled={disabled}
              onClick={() => commit({ type: 'lock', value })}
            >
              <LockKeyhole size={17} aria-hidden="true" />
              Lock
            </button>
          ))}
        {writing && (
          <span
            className="party-lock-count"
            aria-label={`${writtenCount} of ${g.seats.length} clues locked`}
          >
            {g.cards.map((c, s) => (
              <i key={s} className={c.locked ? 'is-locked' : ''} />
            ))}
          </span>
        )}
        {g.phase === 'guess' && giver && (
          <span
            className="party-lock-count"
            aria-label={`${lockedCount} of ${others} dials locked`}
          >
            {g.seats.flatMap((_, s) =>
              s === g.target
                ? []
                : [
                    <i
                      key={s}
                      className={g.guesses[s]?.locked ? 'is-locked' : ''}
                    />,
                  ],
            )}
          </span>
        )}
        {g.phase === 'reveal' &&
          (canAdvance ? (
            <button
              className="party-primary"
              disabled={disabled}
              onClick={() => commit({ type: 'next' })}
            >
              {g.target === g.seats.length - 1 ? 'End of round' : 'Next'}
              <Check size={18} />
            </button>
          ) : (
            <span className="party-waiting">
              {hostName ?? 'The host'} moves on
            </span>
          ))}
      </div>
    </section>
  );
}
