'use client';
import { useState } from 'react';
import {
  GALE,
  SURVIVE,
  STATIONS,
  TURNS,
  WATCHES,
  litCount,
  toolHelp,
  toolNames,
  type CoastGame,
  type Tool,
} from '@/lib/games/worlds/orin';
import { validMove } from '@/lib/games/worlds/registry';
import type { BoardProps } from './world-table';

/** Plan view, exactly from above: the chart is a flat rectangle and nothing in
 * it converges. The rock band undulates but never recedes. */
const W = 1400,
  H = 430;
const stationX = (i: number) => 110 + i * ((W - 220) / (STATIONS - 1));
const BAND = 232;

/** Embossed tin pictograms, one per tool. Deliberately flat and stencil-like:
 * these are pressed into a plate, not drawn on paper. */
function ToolMark({ tool }: { tool: Tool }) {
  return (
    <svg viewBox="0 0 40 40" className="orin-mark" aria-hidden="true">
      {tool === 0 && (
        <>
          <path d="M20 7v20" />
          <path d="M14 27h12l-2 7H16z" />
          <path d="M20 7c3 3 3 6 0 8-3-2-3-5 0-8z" />
        </>
      )}
      {tool === 1 && (
        <>
          <path d="M12 14h16l-2 18H14z" />
          <path d="M16 14V9h8v5" />
          <circle cx="20" cy="23" r="4" />
        </>
      )}
      {tool === 2 && (
        <>
          <rect x="9" y="10" width="22" height="21" rx="2" />
          <path d="M9 16h22M9 21h22M9 26h22" />
        </>
      )}
      {tool === 3 && (
        <>
          <path d="M9 12c6 0 6 8 11 8s5-8 11-8" />
          <path d="M9 22c6 0 6 8 11 8s5-8 11-8" />
        </>
      )}
    </svg>
  );
}

function Lighthouse({
  i,
  g,
  state,
  onPick,
  pickable,
  chosen,
}: {
  i: number;
  g: CoastGame;
  state: {
    lit: boolean;
    fogged: boolean;
    shuttered: boolean;
    anchored: boolean;
  };
  onPick: () => void;
  pickable: boolean;
  chosen: boolean;
}) {
  const x = stationX(i);
  const rung = g.signals.includes(i);
  return (
    <g
      className={`orin-station ${state.lit ? 'is-lit' : 'is-dark'} ${state.fogged ? 'is-fogged' : ''} ${pickable ? 'is-pickable' : ''} ${chosen ? 'is-chosen' : ''}`}
      transform={`translate(${x} ${BAND})`}
      onClick={pickable ? onPick : undefined}
      role={pickable ? 'button' : undefined}
      tabIndex={pickable ? 0 : undefined}
      onKeyDown={
        pickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick();
              }
            }
          : undefined
      }
      aria-label={`Station ${i + 1}, ${state.lit ? 'burning' : 'dark'}${state.fogged ? ', in the fog' : ''}${state.shuttered ? ', shuttered' : ''}${state.anchored ? ', roped' : ''}`}
    >
      {state.lit && <circle className="orin-pool" r="62" />}
      <circle className="orin-disc" r="42" />
      <circle className="orin-disc-inner" r="34" />
      {/* Rivets: four, and the rust blooms under them. */}
      {[0, 90, 180, 270].map((a) => (
        <circle
          key={a}
          className="orin-rivet"
          r="3"
          cx={Math.cos((a * Math.PI) / 180) * 38}
          cy={Math.sin((a * Math.PI) / 180) * 38}
        />
      ))}
      <path className="orin-tower" d="M-9 16 L-6 -14 H6 L9 16 Z" />
      <rect
        className="orin-lantern"
        x="-8"
        y="-24"
        width="16"
        height="11"
        rx="2"
      />
      <path className="orin-cap" d="M-10 -24 L0 -33 L10 -24 Z" />
      {state.lit && <circle className="orin-flame" cy="-18" r="3.4" />}
      {state.shuttered && (
        <path
          className="orin-shutter"
          d="M-13 -24 h26 M-13 -19 h26 M-13 -14 h26"
        />
      )}
      {state.anchored && (
        <path
          className="orin-rope"
          d="M-22 26 c8 -6 14 6 22 0 c8 -6 14 6 22 0"
        />
      )}
      {rung && (
        <path
          className="orin-bell"
          d="M-6 40 a6 6 0 0 1 12 0 v4 h-12z M0 46 v3"
        />
      )}
      <text className="orin-number" y="62">
        {i + 1}
      </text>
    </g>
  );
}

export function OrinBoard({ g: game, viewer, disabled, commit }: BoardProps) {
  const g = game as CoastGame;
  const [slot, setSlot] = useState<number | null>(null);
  const [station, setStation] = useState<number | null>(null);
  // The host remounts this board on every new turn, so the plate is always
  // clear and nothing can be confirmed by accident from the turn before.
  const yours = g.actor === viewer;

  const hand = g.hands[viewer] ?? [];
  const tool = slot === null ? null : hand[slot];
  const legal = (i: number) =>
    slot !== null && validMove(g, { type: 'tool', slot, station: i }, viewer);
  const ready =
    slot !== null &&
    station !== null &&
    validMove(g, { type: 'tool', slot, station }, viewer);

  const fogWidth = (g.fog / STATIONS) * W;
  const burning = litCount(g);

  return (
    <div className="orin-stage">
      <output className="orin-status">
        <span>
          <b>{burning}</b> lamps burning
          <small>{SURVIVE} must survive the night</small>
        </span>
        <span>
          <b>
            {g.watch}/{WATCHES}
          </b>{' '}
          watch
          <small>
            {g.turns} of {TURNS} turns left
          </small>
        </span>
        <span>
          <b>{g.seats[g.actor]}</b> on duty
          <small>{yours ? 'your turn at the lamps' : 'standing by'}</small>
        </span>
      </output>

      <div className="orin-plate">
        <div className="orin-scroll">
          <svg viewBox={`0 0 ${W} ${H}`} className="orin-chart">
            <title>The coast chart, seen from above</title>
            <defs>
              <linearGradient id="orin-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0d2f4c" />
                <stop offset="1" stopColor="#16456b" />
              </linearGradient>
              <radialGradient id="orin-lamp">
                <stop offset="0" stopColor="#ffd08a" stopOpacity="0.85" />
                <stop offset="0.55" stopColor="#f0a23c" stopOpacity="0.32" />
                <stop offset="1" stopColor="#f0a23c" stopOpacity="0" />
              </radialGradient>
              {/* The weather stays inside the plate; nothing spills off the chart. */}
              <clipPath id="orin-edge">
                <rect width={W} height={H} />
              </clipPath>
            </defs>
            <rect width={W} height={H} fill="url(#orin-water)" />
            {/* Open water above and below, ruled like an enamelled chart. */}
            {Array.from({ length: 14 }, (_, i) => (
              <path
                key={i}
                className="orin-swell"
                d={`M0 ${20 + i * 30} q ${W / 4} ${i % 2 ? 9 : -9} ${W / 2} 0 t ${W / 2} 0`}
              />
            ))}
            {/* The rock band the stations stand on. */}
            <path
              className="orin-rock"
              d={`M0 ${BAND - 46} q 180 -26 350 4 t 350 -2 t 350 6 t 350 -8 L${W} ${BAND + 52} q -350 22 -700 -2 t -700 6 Z`}
            />
            <path
              className="orin-rock-edge"
              d={`M0 ${BAND - 46} q 180 -26 350 4 t 350 -2 t 350 6 t 350 -8`}
            />
            {g.fog > 0 && (
              <g className="orin-fog" clipPath="url(#orin-edge)">
                <rect width={fogWidth} height={H} />
                {Array.from({ length: 9 }, (_, i) => (
                  <ellipse
                    key={i}
                    cx={(fogWidth / 9) * (i + 0.5)}
                    cy={40 + ((i * 53) % (H - 80))}
                    rx={90 + (i % 3) * 26}
                    ry={38 + (i % 4) * 11}
                  />
                ))}
              </g>
            )}
            {g.lit.map((lit, i) => (
              <Lighthouse
                key={i}
                i={i}
                g={g}
                state={{
                  lit,
                  fogged: i < g.fog && !g.anchored[i],
                  shuttered: g.shuttered[i],
                  anchored: g.anchored[i],
                }}
                pickable={!disabled && yours && legal(i)}
                chosen={station === i}
                onPick={() => setStation(i)}
              />
            ))}
            {g.fog > 0 && (
              <rect
                className="orin-veil"
                width={fogWidth}
                height={H}
                clipPath="url(#orin-edge)"
              />
            )}
          </svg>
        </div>
      </div>

      <div className="orin-dock">
        <fieldset className="orin-hand">
          <legend className="sr-only">Your tools</legend>
          {hand.map((t, i) => (
            <button
              key={i}
              type="button"
              className={`orin-card ${slot === i ? 'is-lifted' : ''}`}
              disabled={disabled || !yours || t < 0}
              aria-pressed={slot === i}
              onClick={() => {
                setSlot(slot === i ? null : i);
                setStation(null);
              }}
            >
              <ToolMark tool={t} />
              <b>{toolNames[t] ?? '—'}</b>
            </button>
          ))}
        </fieldset>
        <div className="orin-actions">
          <p className="orin-instruction">
            {!yours
              ? `Waiting for ${g.seats[g.actor]}.`
              : tool === null
                ? 'Take a tool from the rack.'
                : station === null
                  ? toolHelp[tool]
                  : `${toolNames[tool]} on station ${station + 1}.`}
          </p>
          <button
            type="button"
            className="orin-confirm"
            disabled={disabled || !ready}
            onClick={() => {
              if (slot !== null && station !== null)
                commit({ type: 'tool', slot, station });
            }}
          >
            CONFIRM
          </button>
          <div className="orin-minor">
            <button
              type="button"
              disabled={
                disabled || !yours || g.bells[viewer] || station === null
              }
              onClick={() =>
                station !== null && commit({ type: 'bell', station })
              }
              title="One bell each, all night. It marks a station and means nothing more."
            >
              Ring the bell
            </button>
            <button
              type="button"
              disabled={disabled || !yours}
              onClick={() => commit({ type: 'stand' })}
            >
              Stand the watch
            </button>
          </div>
        </div>
      </div>
      <p className="orin-footnote">
        At the end of every watch the gale takes the {GALE} westernmost
        unshuttered lamps, then the fog comes one station further in.
      </p>
    </div>
  );
}
