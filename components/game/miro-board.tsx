'use client';
import { useState } from 'react';
import {
  TARGET,
  cleanRuns,
  crewSize,
  spoilTarget,
  spoiledRuns,
  type CanalGame,
} from '@/lib/games/worlds/miro';
import type { BoardProps } from './world-table';

const W = 1320,
  H = 300;

/** The canal is leaded glass, not water: flat saturated cells held in dark came.
 * The scatter is computed once from a fixed seed, so the window is the same
 * window on every render and between reloads. */
const cells = (() => {
  let s = 0x5eed;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: { x: number; y: number; w: number; h: number; tone: number }[] =
    [];
  for (let row = 0; row < 7; row++) {
    let x = -20;
    while (x < W) {
      const w = 34 + Math.floor(next() * 78);
      out.push({
        x,
        y: row * (H / 7),
        w,
        h: H / 7,
        tone: Math.floor(next() * 5),
      });
      x += w;
    }
  }
  return out;
})();

/** One pane of the quay window per run: unlit, lit clean, or gone out. */
function Pane({ state, index }: { state: number; index: number }) {
  return (
    <div
      className={`miro-pane ${state === 0 ? 'is-clean' : state === 1 ? 'is-spoiled' : 'is-waiting'}`}
    >
      <svg viewBox="0 0 60 78" aria-hidden="true">
        <path className="miro-came" d="M4 4 H56 V74 H4 Z" />
        <path className="miro-glass" d="M7 7 H53 V71 H7 Z" />
        <path className="miro-leading" d="M7 28 H53 M7 50 H53 M30 7 V71" />
      </svg>
      <b>Run {index + 1}</b>
    </div>
  );
}

export function MiroBoard({ g: game, viewer, disabled, commit }: BoardProps) {
  const g = game as CanalGame;
  // The host remounts this board whenever the run, the phase or the tiller
  // changes, so a pilot always starts from a crew of themselves alone.
  const [picked, setPicked] = useState<number[]>(() =>
    g.phase === 'crew' && g.pilot === viewer ? [viewer] : [],
  );
  const [accused, setAccused] = useState<number | null>(null);

  const youAreSmuggler = g.smuggler === viewer;
  const want = crewSize(g, g.run);
  const aboard = g.crew.includes(viewer);
  const isPilot = g.pilot === viewer;
  const acting =
    (g.phase === 'crew' && isPilot) ||
    (g.phase === 'approve' && g.votes[viewer] < 0) ||
    (g.phase === 'load' && aboard && g.loads[viewer] < 0) ||
    (g.phase === 'reveal' && !g.ready[viewer]) ||
    (g.phase === 'accuse' && g.accusations[viewer] < 0);

  const toggle = (s: number) => {
    if (s === g.pilot) return; // The pilot never stays ashore.
    setPicked((p) =>
      p.includes(s)
        ? p.filter((x) => x !== s)
        : p.length < want
          ? [...p, s]
          : p,
    );
  };

  return (
    <div className="miro-stage">
      <output className="miro-status">
        <span>
          <b>
            {cleanRuns(g)}/{TARGET}
          </b>
          clean
        </span>
        <span>
          <b>
            {spoiledRuns(g)}/{spoilTarget(g.seats.length)}
          </b>
          spoiled
        </span>
        <span className={`miro-role ${youAreSmuggler ? 'is-smuggler' : ''}`}>
          <b>
            {youAreSmuggler ? 'You are the smuggler' : 'You are a merchant'}
          </b>
          <small>
            {youAreSmuggler
              ? 'Rot the cargo, and do not be named'
              : 'Deliver clean, and name the smuggler'}
          </small>
        </span>
      </output>

      <div className="miro-window">
        <div className="miro-scroll">
          <svg viewBox={`0 0 ${W} ${H}`} className="miro-canal">
            <title>The canal, seen from above</title>
            {cells.map((c, i) => (
              <rect
                key={i}
                className={`miro-cell tone-${c.tone}`}
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
              />
            ))}
            {/* The barge, in plan view, its hold divided into compartments. */}
            <g
              className="miro-barge"
              transform={`translate(${W / 2 - 300} ${H / 2 - 66})`}
            >
              <path
                className="miro-hull"
                d="M-34 66 L24 0 H576 L634 66 L576 132 H24 Z"
              />
              <path className="miro-hold" d="M34 14 H566 V118 H34 Z" />
              {Array.from({ length: want }, (_, i) => {
                const seat = g.crew[i];
                const load = seat === undefined ? -1 : g.loads[seat];
                const opened = g.phase === 'reveal' && seat !== undefined;
                const state = !opened
                  ? load === -1
                    ? 'is-empty'
                    : 'is-sealed'
                  : load === 1
                    ? 'is-rot'
                    : 'is-clean';
                const w = 532 / want;
                return (
                  <g key={i} transform={`translate(${34 + i * w} 14)`}>
                    <rect
                      className={`miro-compartment ${state}`}
                      x="6"
                      y="6"
                      width={w - 12}
                      height="92"
                    />
                    {seat !== undefined && (
                      <text className="miro-crew-name" x={w / 2} y="58">
                        {g.seats[seat]}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <div className="miro-record" aria-label="The season so far">
          {g.record.map((r, i) => (
            <Pane key={i} state={r} index={i} />
          ))}
        </div>
      </div>

      <div className="miro-dock">
        {g.phase === 'crew' && (
          <div className="miro-panel">
            <p className="miro-instruction">
              {isPilot
                ? `Pick ${want} traders for run ${g.run}. You sail your own run, so you are already aboard.`
                : `${g.seats[g.pilot]} is choosing the crew for run ${g.run}.`}
            </p>
            {isPilot && (
              <>
                <div className="miro-seats">
                  {g.seats.map((name, s) => (
                    <button
                      key={s}
                      type="button"
                      className={`miro-seat ${picked.includes(s) ? 'is-picked' : ''} ${s === g.pilot ? 'is-pilot' : ''}`}
                      disabled={disabled || s === g.pilot}
                      aria-pressed={picked.includes(s)}
                      onClick={() => toggle(s)}
                    >
                      <i aria-hidden="true">{name.slice(0, 1)}</i>
                      <b>{name}</b>
                      {s === g.pilot && <small>pilot</small>}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="miro-confirm"
                  disabled={disabled || picked.length !== want}
                  onClick={() => commit({ type: 'crew', seats: picked })}
                >
                  SEND THE RUN
                </button>
              </>
            )}
          </div>
        )}

        {g.phase === 'approve' && (
          <div className="miro-panel">
            <p className="miro-instruction">
              {g.seats[g.pilot]} sends{' '}
              <b>{g.crew.map((s) => g.seats[s]).join(', ')}</b>.
              {g.refusals >= 2
                ? ' The quay is out of refusals — this crew sails whatever it shows.'
                : ` The quay may turn ${2 - g.refusals} more crew${g.refusals === 1 ? '' : 's'} away.`}
            </p>
            {g.votes[viewer] < 0 ? (
              <div className="miro-vote">
                <button
                  type="button"
                  className="miro-confirm"
                  disabled={disabled}
                  onClick={() => commit({ type: 'vote', yes: true })}
                >
                  SEND IT
                </button>
                <button
                  type="button"
                  className="miro-confirm is-quiet"
                  disabled={disabled}
                  onClick={() => commit({ type: 'vote', yes: false })}
                >
                  TURN IT AWAY
                </button>
              </div>
            ) : (
              <p className="miro-waiting">
                Your hand is up. Waiting for the rest of the quay.
              </p>
            )}
          </div>
        )}

        {g.phase === 'load' && (
          <div className="miro-panel">
            <p className="miro-instruction">
              {aboard
                ? g.loads[viewer] >= 0
                  ? 'Your hold is sealed. Waiting for the rest of the crew.'
                  : 'Load your hold. Nobody sees it until the run opens.'
                : `You are ashore this run. ${g.crew.map((s) => g.seats[s]).join(', ')} are loading.`}
            </p>
            {aboard && g.loads[viewer] < 0 && (
              <div className="miro-cargo">
                <button
                  type="button"
                  className="miro-confirm"
                  disabled={disabled}
                  onClick={() => commit({ type: 'load', rot: false })}
                >
                  LOAD CLEAN
                </button>
                {youAreSmuggler && (
                  <button
                    type="button"
                    className="miro-confirm is-rot"
                    disabled={disabled}
                    onClick={() => commit({ type: 'load', rot: true })}
                  >
                    LOAD ROT
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {g.phase === 'reveal' && g.last && (
          <div className="miro-panel">
            <p className="miro-instruction">
              {g.last.spoiled > 0
                ? 'The hold opens rotten. A pane goes out on the quay.'
                : 'The hold opens clean. Another pane lights.'}
            </p>
            <button
              type="button"
              className="miro-confirm"
              disabled={disabled || g.ready[viewer]}
              onClick={() => commit({ type: 'ready' })}
            >
              {g.ready[viewer] ? 'Waiting for the quay' : 'MOOR UP'}
            </button>
          </div>
        )}

        {g.phase === 'accuse' && (
          <div className="miro-panel">
            <p className="miro-instruction">
              Three runs came in clean. Now name the smuggler — a quay that
              cannot agree names nobody, and they finish the season.
            </p>
            {g.accusations[viewer] < 0 ? (
              <>
                <div className="miro-seats">
                  {g.seats.map((name, s) =>
                    s === viewer ? null : (
                      <button
                        key={s}
                        type="button"
                        className={`miro-seat ${accused === s ? 'is-picked' : ''}`}
                        disabled={disabled}
                        aria-pressed={accused === s}
                        onClick={() => setAccused(s)}
                      >
                        <i aria-hidden="true">{name.slice(0, 1)}</i>
                        <b>{name}</b>
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="miro-confirm"
                  disabled={disabled || accused === null}
                  onClick={() =>
                    accused !== null &&
                    commit({ type: 'accuse', target: accused })
                  }
                >
                  NAME THEM
                </button>
              </>
            ) : (
              <p className="miro-waiting">
                You have named someone. Waiting for the rest of the quay.
              </p>
            )}
          </div>
        )}

        {!acting && g.phase !== 'crew' && (
          <p className="miro-footnote">
            {g.seats.map((n, s) => ({ n, s })).filter(({ s }) => s !== viewer)
              .length > 0 && 'The canal waits.'}
          </p>
        )}
      </div>
    </div>
  );
}
