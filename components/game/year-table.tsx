'use client';
import { useRef, useState, type PointerEvent } from 'react';
import { LockKeyhole, Unlock, ArrowRight } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import { yearEvents, timeline } from '@/lib/games/party/year-events';
import { eventsPerRound, type YearGame } from '@/lib/games/party/year';
import { SabiSteps } from './sabi-steps';
import { NextStep } from './know-me-parts';
import { CountUp, stagger } from './reveal-motion';
import './year-table.css';

const first: number = timeline[0],
  last: number = timeline[1];
const span = last - first;
const at = (y: number, lo = first, hi = last) =>
  `${((y - lo) / (hi - lo)) * 100}%`;
const clampYear = (y: number) => Math.max(first, Math.min(last, Math.round(y)));
/** Where a fresh marker starts: the middle of the timeline. */
const startYear = 1600;
/** The step tabs carry each event's year so far: the viewer's marker while
 * placing, the answer once revealed, a ? until then. */
const yearTabs = (years: (number | null)[]) =>
  years.map((y) => (y === null ? '?' : String(y)));

/** Years: place three events in time on the mat, lock once, then the host
 * reveals them one by one. */
export function YearTable(props: {
  g: YearGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  return props.g.phase === 'guess' ? (
    <Placing key={props.g.round} {...props} />
  ) : (
    <Reveal key={`${props.g.round}:${props.g.step}`} {...props} />
  );
}

function Placing({
  g,
  viewer,
  disabled,
  commit,
}: {
  g: YearGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
}) {
  const spectator = viewer < 0 || viewer >= g.seats.length,
    mine = spectator ? null : g.guesses[viewer],
    locked = !!mine?.locked;
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<(number | null)[]>(() =>
    Array(eventsPerRound).fill(null),
  );
  const placed = (i: number) => drafts[i] ?? mine?.values[i] ?? null;
  const value = placed(step) ?? startYear;
  const live = !spectator && !disabled && !locked;
  const e = yearEvents[g.events[step]];
  function draft(v: number) {
    setDrafts((d) => d.map((x, j) => (j === step ? clampYear(v) : x)));
  }
  function send(v: number) {
    draft(v);
    commit({ type: 'guess', step, value: clampYear(v) });
  }
  const others = [...Array(eventsPerRound).keys()].filter((i) => i !== step);
  const canLock = others.every((i) => placed(i) !== null);
  const marks = others.flatMap((i) => {
    const y = placed(i);
    return y === null ? [] : [{ i, y }];
  });
  return (
    <section className="sabi-stage year-stage" data-game-motion="change">
      <div className="sabi-board year-board">
        <output
          className={`year-readout ${placed(step) === null ? 'is-unset' : ''}`}
          aria-live="polite"
        >
          {value}
        </output>
        <div className="year-zoom">
          <Timeline
            value={value}
            step={step}
            marks={marks}
            live={live}
            onDraft={draft}
            onSet={send}
            onPick={setStep}
          />
          <Loupe value={value} />
          <Vernier value={value} live={live} onDraft={draft} onSet={send} />
        </div>
      </div>
      <aside className="sabi-card year-card">
        <SabiSteps
          steps={yearTabs([...Array(eventsPerRound).keys()].map(placed))}
          current={step}
          label="Your years"
          // The tab keeps its number, the one on its marker; the year says it is placed.
          done={() => false}
          onSelect={setStep}
        />
        <h3 className="year-event reveal-rise" key={e.id}>
          {e.text}
        </h3>
        {!spectator && (
          <div
            className="sabi-actions"
            data-game-motion="change"
            data-game-motion-key={locked ? 'locked' : canLock ? 'lock' : 'next'}
          >
            {locked ? (
              <button
                type="button"
                className="party-locked"
                disabled={disabled}
                onClick={() => commit({ type: 'unlock' })}
              >
                <Unlock size={16} />
                Locked
              </button>
            ) : canLock ? (
              <button
                type="button"
                className="party-primary"
                disabled={!live}
                onClick={() =>
                  commit({
                    type: 'lock',
                    values: [...Array(eventsPerRound).keys()].map((i) =>
                      i === step ? value : (placed(i) as number),
                    ),
                  })
                }
              >
                <LockKeyhole size={16} />
                Lock
              </button>
            ) : (
              <button
                type="button"
                className="party-primary"
                disabled={!live}
                onClick={() => {
                  if (placed(step) === null || value !== mine?.values[step])
                    send(value);
                  const next = others.find((i) => placed(i) === null);
                  if (next !== undefined) setStep(next);
                }}
              >
                <ArrowRight size={16} />
                Next
              </button>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}

/** The whole timeline, a century a tick: tap or drag to jump. The other
 * events' markers stay on it, numbered, so the three read in order; tapping
 * one's head picks that event. */
function Timeline({
  value,
  step,
  marks,
  live,
  onDraft,
  onSet,
  onPick,
}: {
  value: number;
  step: number;
  marks: { i: number; y: number }[];
  live: boolean;
  onDraft: (v: number) => void;
  onSet: (v: number) => void;
  onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    held = useRef<number | null>(null),
    // Grabbing the pin's head keeps the year under it instead of jumping.
    grip = useRef(0);
  const [dragging, setDragging] = useState(false);
  const yearAt = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return clampYear(
      first + ((e.clientX - r.left) / r.width) * span + grip.current,
    );
  };
  return (
    <div
      ref={ref}
      className={`year-line ${live ? 'is-live' : ''} ${dragging ? 'is-held' : ''}`}
      onPointerDown={(e) => {
        if (!live || e.button !== 0) return;
        held.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        grip.current = 0;
        if ((e.target as Element).closest('.year-pin'))
          grip.current = value - yearAt(e);
        onDraft(yearAt(e));
      }}
      onPointerMove={(e) => held.current === e.pointerId && onDraft(yearAt(e))}
      onPointerUp={(e) => {
        if (held.current !== e.pointerId) return;
        held.current = null;
        setDragging(false);
        onSet(yearAt(e));
      }}
      onPointerCancel={() => {
        held.current = null;
        setDragging(false);
      }}
    >
      {/* The keyboard and screen readers use a plain range under the ruler. */}
      <input
        type="range"
        className="year-range"
        min={first}
        max={last}
        step={1}
        value={value}
        disabled={!live}
        aria-label="Year"
        onChange={(e) => onDraft(Number(e.target.value))}
        onKeyUp={(e) => onSet(Number(e.currentTarget.value))}
        onPointerDown={(e) => e.preventDefault()}
      />
      {Array.from({ length: 11 }, (_, i) => {
        const y = first + i * 100;
        return (
          <span
            key={y}
            className={`year-tick ${i === 0 ? 'is-first' : i === 10 ? 'is-last' : ''} ${i % 2 ? 'is-odd' : ''}`}
            style={{ left: at(y) }}
          >
            <small>{y}</small>
          </span>
        );
      })}
      {marks.map(({ i, y }) => (
        <button
          key={i}
          type="button"
          className="year-mark"
          style={{ left: at(y) }}
          aria-label={`Event ${i + 1}, ${y}`}
          disabled={!live}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onPick(i)}
        >
          {i + 1}
        </button>
      ))}
      <span
        className="year-pin"
        key={step}
        style={{ left: at(value) }}
        data-step={step + 1}
      />
    </div>
  );
}

/** The funnel from the century around the marker down to the close-up
 * ruler, so the second ruler reads as a magnifying glass. */
function Loupe({ value }: { value: number }) {
  const x = (y: number) =>
    ((Math.max(first, Math.min(last, y)) - first) / span) * 100;
  return (
    <svg
      className="year-loupe"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={`${x(value - 50)},0 ${x(value + 50)},0 100,10 0,10`} />
    </svg>
  );
}

/** A close-up ruler under the timeline: a century either side of the
 * marker, a decade a tick. Drag it sideways to fine-tune the year. */
function Vernier({
  value,
  live,
  onDraft,
  onSet,
}: {
  value: number;
  live: boolean;
  onDraft: (v: number) => void;
  onSet: (v: number) => void;
}) {
  const drag = useRef<{
    id: number;
    x: number;
    from: number;
    px: number;
  } | null>(null);
  const lo = value - 50,
    hi = value + 50;
  const decades = [];
  for (let y = Math.ceil(lo / 10) * 10; y <= hi; y += 10) decades.push(y);
  const yearsAt = (e: PointerEvent) => {
    const d = drag.current!;
    return clampYear(d.from - (e.clientX - d.x) / d.px);
  };
  return (
    <div
      className={`year-vernier ${live ? 'is-live' : ''}`}
      aria-hidden="true"
      onPointerDown={(e) => {
        if (!live || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          from: value,
          px: e.currentTarget.getBoundingClientRect().width / 100,
        };
      }}
      onPointerMove={(e) =>
        drag.current?.id === e.pointerId && onDraft(yearsAt(e))
      }
      onPointerUp={(e) => {
        if (drag.current?.id !== e.pointerId) return;
        const v = yearsAt(e);
        drag.current = null;
        onSet(v);
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      {decades.map((y) => (
        <span
          key={y}
          className={`vernier-tick ${y % 50 === 0 ? 'is-major' : ''} ${y % 20 ? 'is-odd' : ''} ${y < first || y > last ? 'is-out' : ''}`}
          style={{ left: at(y, lo, hi) }}
        >
          {Math.abs(y - value) < 46 && y >= first && y <= last && (
            <small>{y}</small>
          )}
        </span>
      ))}
      <span className="vernier-needle" />
    </div>
  );
}

function Reveal({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: YearGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  const step = g.step,
    e = yearEvents[g.events[step]],
    spectator = viewer < 0 || viewer >= g.seats.length,
    gains = g.gains[step] ?? g.seats.map(() => 0);
  const rows = g.seats
    .map((seat, s) => ({
      s,
      seat: s === viewer ? 'You' : seat,
      value: g.guesses[s].values[step],
      gain: gains[s],
    }))
    .sort((a, b) => b.gain - a.gain || a.s - b.s);
  const years = [
      e.year,
      ...rows.flatMap((r) => (r.value === null ? [] : [r.value])),
    ],
    pad = Math.max(8, (Math.max(...years) - Math.min(...years)) * 0.12),
    lo = Math.max(first, Math.floor(Math.min(...years) - pad)),
    hi = Math.min(last, Math.ceil(Math.max(...years) + pad)),
    tick = hi - lo > 400 ? 100 : hi - lo > 160 ? 50 : hi - lo > 60 ? 10 : 5;
  const ticks = [];
  for (let y = Math.ceil(lo / tick) * tick; y <= hi; y += tick) ticks.push(y);
  const my = spectator ? null : g.guesses[viewer].values[step],
    myPoints = spectator ? 0 : gains[viewer];
  const upcoming =
    step < eventsPerRound - 1 ? yearEvents[g.events[step + 1]] : null;
  return (
    <section className="sabi-stage year-stage is-revealed">
      <div className="sabi-board year-board">
        {!spectator && (
          <div className="size-score" aria-live="polite">
            <p
              className={`size-points reveal-pop ${myPoints >= 90 ? 'reveal-burst' : ''}`}
            >
              <CountUp value={myPoints} duration={1100} delay={300} />
              <small>/100</small>
            </p>
            {my !== null && (
              <dl className="reveal-rise" style={stagger(0, 1400)}>
                <div>
                  <dt>Off</dt>
                  <dd>
                    {Math.abs(my - e.year)} year
                    {Math.abs(my - e.year) === 1 ? '' : 's'}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        )}
        <output
          className="year-readout is-answer reveal-pop"
          style={stagger(0, 150)}
        >
          <CountUp
            value={e.year}
            duration={900}
            delay={150}
            format={(v) => String(Math.round(v))}
          />
        </output>
        <div className="year-line is-reveal">
          {ticks.map((y) => (
            <span
              key={y}
              className={`year-tick ${(y - lo) / (hi - lo) < 0.04 ? 'is-first' : (y - lo) / (hi - lo) > 0.96 ? 'is-last' : ''}`}
              style={{ left: at(y, lo, hi) }}
            >
              <small>{y}</small>
            </span>
          ))}
          <span
            className="year-truth reveal-rise"
            style={{ left: at(e.year, lo, hi), ...stagger(0, 200) }}
          />
          {rows.map((r, i) =>
            r.value === null ? null : (
              <span
                key={r.s}
                className={`year-guess seat-${r.s} ${r.s === viewer ? 'is-you' : ''} reveal-drop`}
                style={{ left: at(r.value, lo, hi), ...stagger(i, 500, 130) }}
                title={`${r.seat}: ${r.value}`}
              >
                <i className={`party-avatar seat-${r.s}`}>
                  {g.seats[r.s].slice(0, 1)}
                </i>
              </span>
            ),
          )}
        </div>
      </div>
      <aside className="sabi-card year-card">
        <SabiSteps
          steps={yearTabs(
            g.events.map((id, i) => (i <= step ? yearEvents[id].year : null)),
          )}
          current={step}
          done={(i) => i <= step}
        />
        <h3 className="year-event">{e.text}</h3>
        <p className="size-fact reveal-rise" style={stagger(0, 600)}>
          {e.fact}
        </p>
        <ol className="sabi-results">
          {rows.map((r, i) => (
            <li
              key={r.s}
              className={`reveal-rise ${r.gain >= 90 ? 'is-perfect' : ''} ${r.s === viewer ? 'is-you' : ''}`}
              style={stagger(i, 700, 140)}
            >
              <i
                className={`seat-${r.s}`}
                style={{ background: 'var(--seat)' }}
                aria-hidden="true"
              />
              <b>{r.seat}</b>
              <span>{r.value ?? '—'}</span>
              <strong className="reveal-pop" style={stagger(i, 1100, 140)}>
                +{r.gain}
              </strong>
            </li>
          ))}
        </ol>
        {!spectator &&
          (canAdvance ? (
            <div className="sabi-actions">
              <NextStep
                next={upcoming ? { label: upcoming.text } : null}
                canAdvance
                disabled={disabled}
                onNext={() => commit({ type: 'next' })}
              />
            </div>
          ) : (
            <p className="party-host-wait">{hostName ?? 'The host'} moves on</p>
          ))}
      </aside>
    </section>
  );
}
