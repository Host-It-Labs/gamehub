'use client';
import { useState } from 'react';
import {
  SCISSORS,
  TRACK,
  teamNames,
  type MeadowGame,
} from '@/lib/games/worlds/vela';
import type { BoardProps } from './world-table';

const W = 1360,
  H = 400;

/** One formula for the whole meadow. The segments, the spars, the gusts and the
 * kites are all read off this curve, so nothing can drift out of register. */
function pointAt(t: number) {
  const x = 66 + t * (W - 132);
  const y = H / 2 + Math.sin(t * Math.PI * 3) * 84;
  return { x, y };
}
const ribbonPath = () => {
  const steps = 160;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const { x, y } = pointAt(i / steps);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
};
const RIBBON = ribbonPath();
const seg = (i: number) => pointAt(i / (TRACK - 1));

/** A brush swirl whose size is the wind it carries. No numerals anywhere. */
function Swirl({ value }: { value: number }) {
  const turns = Math.max(1, value);
  const path = Array.from({ length: 44 }, (_, i) => {
    const a = (i / 43) * turns * Math.PI * 2;
    const r = 3 + (i / 43) * (3.4 + value * 2.6);
    return `${i ? 'L' : 'M'}${(22 + Math.cos(a) * r).toFixed(1)} ${(22 + Math.sin(a) * r * 0.82).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 44 44" className="vela-swirl" aria-hidden="true">
      <path d={path} strokeWidth={1.1 + value * 0.28} />
    </svg>
  );
}

function Shears() {
  return (
    <svg
      viewBox="0 0 44 44"
      className="vela-swirl vela-shears"
      aria-hidden="true"
    >
      <path d="M13 9 L30 31 M31 9 L14 31" />
      <circle cx="12" cy="34" r="4.4" />
      <circle cx="32" cy="34" r="4.4" />
    </svg>
  );
}

function Kite({ team, at }: { team: number; at: number }) {
  const { x, y } = seg(at);
  // The tail streams back along the ribbon the kite has already crossed.
  const tail = Array.from({ length: 5 }, (_, i) =>
    seg(Math.max(0, at - i - 1)),
  );
  return (
    <g className={`vela-kite team-${team}`} aria-hidden="true">
      <path
        className="vela-tail"
        d={`M${x} ${y} ` + tail.map((p) => `L${p.x} ${p.y}`).join(' ')}
      />
      {team === 0 ? (
        <path
          className="vela-sail"
          d={`M${x} ${y - 20} L${x + 15} ${y} L${x} ${y + 20} L${x - 15} ${y} Z`}
        />
      ) : (
        <path
          className="vela-sail"
          d={`M${x - 17} ${y + 4} q 9 -20 17 -12 q 8 -8 17 12 q -17 8 -34 0 Z`}
        />
      )}
      <circle className="vela-spar-dot" cx={x} cy={y} r="2.6" />
    </g>
  );
}

export function VelaBoard({ g: game, viewer, disabled, commit }: BoardProps) {
  const g = game as MeadowGame;
  // The host remounts this board on every new round and phase, so a card
  // chosen for the last turn can never be carried into the next one.
  const [slot, setSlot] = useState<number | null>(null);

  const hand = g.hands[viewer] ?? [];
  const team = g.teams[viewer];
  const committed = g.commits[viewer] >= 0;
  const revealing = g.phase === 'reveal';
  const ready = g.ready[viewer];

  return (
    <div className="vela-stage">
      <output className="vela-status">
        {[0, 1].map((t) => (
          <span key={t} className={`vela-side team-${t}`}>
            <i aria-hidden="true" />
            <b>{teamNames[t]}</b>
            <small>
              segment {g.at[t] + 1} of {TRACK}
              {t === team ? ' · your kite' : ''}
            </small>
          </span>
        ))}
      </output>

      <div className="vela-meadow">
        <div className="vela-scroll">
          <svg viewBox={`0 0 ${W} ${H}`} className="vela-sky">
            <title>The wind track, seen from above</title>
            <defs>
              {/* Ink-brush wind, laid over generous white air. */}
              <linearGradient id="vela-air" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f7fbfd" />
                <stop offset="0.55" stopColor="#eaf3f7" />
                <stop offset="1" stopColor="#e6f0e4" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="url(#vela-air)" />
            {Array.from({ length: 5 }, (_, i) => (
              <path
                key={i}
                className="vela-wind"
                d={`M${-40 + i * 40} ${46 + i * 66} q 210 ${i % 2 ? 34 : -34} 430 0 t 430 0 t 430 0`}
              />
            ))}
            {/* The ribbon itself, then the same path dashed as the bamboo spars. */}
            <path className="vela-ribbon" d={RIBBON} />
            <path className="vela-ribbon-silk" d={RIBBON} />
            <path
              className="vela-spars"
              d={RIBBON}
              pathLength={TRACK - 1}
              strokeDasharray="0.06 0.94"
            />
            {g.gusts.map((on, i) =>
              on ? (
                <g
                  key={i}
                  className="vela-gust"
                  transform={`translate(${seg(i).x} ${seg(i).y})`}
                >
                  <path d="M-13 0 q 7 -9 13 0 q 6 9 13 0" />
                  <path d="M-9 7 q 5 -6 9 0 q 4 6 9 0" />
                </g>
              ) : null,
            )}
            <circle
              className="vela-bank"
              cx={seg(TRACK - 1).x}
              cy={seg(TRACK - 1).y}
              r="17"
            />
            {[0, 1].map((t) => (
              <Kite key={t} team={t} at={g.at[t]} />
            ))}
          </svg>
        </div>
      </div>

      {revealing && g.last ? (
        <div className="vela-reveal">
          <h2>Everything turns over</h2>
          <div className="vela-played">
            {g.seats.map((name, s) => (
              <div key={s} className={`vela-played-card team-${g.teams[s]}`}>
                {g.last!.cards[s] === SCISSORS ? (
                  <Shears />
                ) : (
                  <Swirl value={g.last!.cards[s]} />
                )}
                <b>{name}</b>
                <small>
                  {g.last!.cards[s] === SCISSORS ? 'scissors' : 'wind'}
                </small>
              </div>
            ))}
          </div>
          <div className="vela-gains">
            {[0, 1].map((t) => (
              <p key={t} className={`team-${t}`}>
                <b>{teamNames[t]}</b> moves {g.last!.gains[t]}
                {g.last!.cut[t] ? ` · cut ${g.last!.cut[t]}` : ''}
                {g.last!.lifted[t] ? ' · caught a gust' : ''}
              </p>
            ))}
          </div>
          <button
            type="button"
            className="vela-confirm"
            disabled={disabled || ready}
            onClick={() => commit({ type: 'ready' })}
          >
            {ready ? 'Waiting for the others' : 'Let it fly'}
          </button>
        </div>
      ) : (
        <div className="vela-dock">
          <fieldset className="vela-hand">
            <legend className="sr-only">Your wind cards</legend>
            {hand.map((c, i) => (
              <button
                key={i}
                type="button"
                className={`vela-card ${slot === i ? 'is-lifted' : ''} ${c === SCISSORS ? 'is-shears' : ''}`}
                disabled={disabled || committed || c < 0}
                aria-pressed={slot === i}
                onClick={() => setSlot(slot === i ? null : i)}
              >
                {c === SCISSORS ? <Shears /> : <Swirl value={c} />}
                <span className="vela-bamboo" aria-hidden="true" />
              </button>
            ))}
          </fieldset>
          <div className="vela-actions">
            <p className="vela-instruction">
              {committed
                ? 'Face down on the grass. Everyone turns over together.'
                : slot === null
                  ? 'Choose one card. Nobody sees it, teammates included.'
                  : hand[slot] === SCISSORS
                    ? 'Scissors take the other team’s strongest gust this round.'
                    : 'A wider swirl is a stronger pull on the ribbon.'}
            </p>
            {committed ? (
              <button
                type="button"
                className="vela-confirm is-quiet"
                disabled={disabled}
                onClick={() => commit({ type: 'withdraw' })}
              >
                Take it back
              </button>
            ) : (
              <button
                type="button"
                className="vela-confirm"
                disabled={disabled || slot === null}
                onClick={() =>
                  slot !== null && commit({ type: 'commit', slot })
                }
              >
                CONFIRM
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
