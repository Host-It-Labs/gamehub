'use client';
import { useState } from 'react';
import { ArrowRight, LockKeyhole, Unlock } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import { orderSets } from '@/lib/games/party/order-sets';
import { orderAt, setsPerRound, type OrderGame } from '@/lib/games/party/order';
import { SortableRanking } from './ranking-handle';
import { SabiSteps } from './sabi-steps';
import { NextStep } from './know-me-parts';
import { CountUp, stagger } from './reveal-motion';
import './order-table.css';

const stepNames = (g: OrderGame) => g.sets.map((id) => orderSets[id].title);

/** Order: sort three sets of five on the mat, lock once, then the host
 * reveals them one by one. */
export function OrderTable(props: {
  g: OrderGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  return props.g.phase === 'guess' ? (
    <Sorting key={props.g.round} {...props} />
  ) : (
    <Reveal key={`${props.g.round}:${props.g.step}`} {...props} />
  );
}

function Sorting({
  g,
  viewer,
  disabled,
  commit,
}: {
  g: OrderGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
}) {
  const spectator = viewer < 0 || viewer >= g.seats.length,
    mine = spectator ? null : g.guesses[viewer],
    locked = !!mine?.locked,
    live = !spectator && !disabled && !locked;
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState<number[]>([0]);
  const set = orderSets[g.sets[step]],
    order = spectator ? g.dealt[step] : orderAt(g, viewer, step);
  const select = (i: number) => {
    setStep(i);
    setSeen((s) => (s.includes(i) ? s : [...s, i]));
  };
  const unseen = [...Array(setsPerRound).keys()].find((i) => !seen.includes(i));
  return (
    <section className="sabi-stage order-stage" data-game-motion="change">
      <div className="sabi-board order-board">
        <div className="order-list" key={step}>
          <ol className="order-places" aria-hidden="true">
            {order.map((_, i) => (
              <li key={i}>{i + 1}</li>
            ))}
          </ol>
          <SortableRanking
            key={`${g.round}:${step}`}
            order={order}
            disabled={!live}
            label={(id) => set.items[id].name}
            onReorder={(next) => commit({ type: 'arrange', step, order: next })}
            render={(id) => <strong>{set.items[id].name}</strong>}
          />
        </div>
      </div>
      <aside className="sabi-card order-card">
        <SabiSteps
          steps={stepNames(g)}
          current={step}
          label="Your orders"
          done={(i) => !!mine?.orders[i] || (i !== step && seen.includes(i))}
          onSelect={select}
        />
        <h3 className="order-title">{set.title}</h3>
        {!spectator && (
          <div
            className="sabi-actions"
            data-game-motion="change"
            data-game-motion-key={
              locked ? 'locked' : unseen === undefined ? 'lock' : 'next'
            }
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
            ) : unseen === undefined ? (
              <button
                type="button"
                className="party-primary"
                disabled={!live}
                onClick={() => commit({ type: 'lock' })}
              >
                <LockKeyhole size={16} />
                Lock
              </button>
            ) : (
              <button
                type="button"
                className="party-primary"
                disabled={!live}
                onClick={() => select(unseen)}
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

function Reveal({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: OrderGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  const step = g.step,
    set = orderSets[g.sets[step]],
    spectator = viewer < 0 || viewer >= g.seats.length,
    gains = g.gains[step] ?? g.seats.map(() => 0),
    mine = spectator ? null : orderAt(g, viewer, step),
    myPoints = spectator ? 0 : gains[viewer];
  const rows = g.seats
    .map((seat, s) => ({
      s,
      seat: s === viewer ? 'You' : seat,
      gain: gains[s],
    }))
    .sort((a, b) => b.gain - a.gain || a.s - b.s);
  const upcoming = step < setsPerRound - 1 ? orderSets[g.sets[step + 1]] : null;
  return (
    <section className="sabi-stage order-stage is-revealed">
      <div className="sabi-board order-board">
        {!spectator && (
          <div className="size-score" aria-live="polite">
            <p
              className={`size-points reveal-pop ${myPoints >= 90 ? 'reveal-burst' : ''}`}
            >
              <CountUp value={myPoints} duration={1100} delay={300} />
              <small>/100</small>
            </p>
          </div>
        )}
        <ol className="order-truth">
          {set.items.map((item, i) => {
            const placed = mine ? mine.indexOf(i) : -1,
              off = placed < 0 ? null : Math.abs(placed - i),
              right = g.seats.flatMap((_, s) =>
                orderAt(g, s, step).indexOf(i) === i ? [s] : [],
              );
            return (
              <li
                key={i}
                className={`reveal-flip ${off === 0 ? 'is-spot' : off === 1 ? 'is-near' : ''}`}
                style={stagger(i, 0, 170)}
              >
                <span className="order-place">{i + 1}</span>
                <strong>{item.name}</strong>
                <em>{item.value}</em>
                {off !== null && (
                  <span className="order-mine" title="Your place">
                    {placed + 1}
                  </span>
                )}
                <span className="order-right">
                  {right.map((s, j) => (
                    <i
                      key={s}
                      className={`party-avatar seat-${s} reveal-drop`}
                      style={stagger(j, i * 170 + 200, 45)}
                      title={s === viewer ? 'You' : g.seats[s]}
                    >
                      {g.seats[s].slice(0, 1)}
                    </i>
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <aside className="sabi-card order-card">
        <SabiSteps
          steps={stepNames(g)}
          current={step}
          done={(i) => i <= step}
        />
        <h3 className="order-title">{set.title}</h3>
        <p className="size-fact reveal-rise" style={stagger(0, 600)}>
          {set.fact}
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
              <span />
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
                next={upcoming ? { label: upcoming.title } : null}
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
