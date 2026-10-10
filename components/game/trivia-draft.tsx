'use client';
import { useId, type CSSProperties } from 'react';
import { Hand } from 'lucide-react';
import type { AnyGame, AnyMove } from '@/lib/games/standalone/registry';
import {
  collectionScore,
  currentDraft,
  draftPicker,
  findCounts,
  findGain,
  triviaFinds,
  triviaOf,
  type TriviaFindKind,
} from '@/lib/games/party/trivia';
import { CountUp } from './reveal-motion';
import './trivia-draft.css';

/** A point on a logarithmic spiral, for the fossil's coil. */
function spiral(turns: number, from: number, to: number) {
  const points: string[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * turns * Math.PI * 2;
    const r = from * Math.pow(to / from, i / steps);
    points.push(
      `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`,
    );
  }
  return `M${points.join('L')}`;
}
const coil = spiral(2.6, 2.5, 29);
const ribs = Array.from({ length: 26 }, (_, i) => {
  const t = i / 26,
    a = t * 2.6 * Math.PI * 2 + 2.6 * Math.PI * 2 * 0.62,
    r = 29 * Math.pow(0.4, 1 - t);
  const inner = r * 0.66;
  return `M${(50 + Math.cos(a) * inner).toFixed(1)} ${(50 + Math.sin(a) * inner).toFixed(1)}L${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
}).join('');
const fronds = Array.from({ length: 9 }, (_, i) => {
  const y = 22 + i * 7.2,
    len = 22 - i * 1.9,
    lean = 6 + i * 0.6;
  return [
    `M50 ${y}q${-len * 0.55} ${-lean} ${-len} ${-lean * 0.35}q${len * 0.5} ${lean * 0.9} ${len} ${lean * 0.35}z`,
    `M50 ${y}q${len * 0.55} ${-lean} ${len} ${-lean * 0.35}q${-len * 0.5} ${lean * 0.9} ${-len} ${lean * 0.35}z`,
  ];
}).flat();

/** One find as an enamel specimen: a faceted crystal, a coiled fossil, a
 * gold nugget or a pressed fern, lit from the lamp at the upper left. */
export function FindMark({
  kind,
  className,
}: {
  kind: TriviaFindKind;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 100 100"
      className={`find-mark find-${kind} ${className ?? ''}`}
      aria-hidden="true"
    >
      {kind === 'crystal' ? (
        <>
          <defs>
            <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a9c2ff" />
              <stop offset=".45" stopColor="#3569ff" />
              <stop offset="1" stopColor="#1b3496" />
            </linearGradient>
          </defs>
          <g transform="rotate(-24 34 72)">
            <path d="M34 34l8 10v30l-8 6-8-6V44z" fill={`url(#${id}c)`} />
            <path d="M34 34l8 10-8 4-8-4z" fill="#d7e3ff" opacity=".8" />
            <path d="M34 48v32l-8-6V44z" fill="#1d3fb0" opacity=".55" />
          </g>
          <g transform="rotate(20 68 74)">
            <path d="M68 40l7 9v26l-7 5-7-5V49z" fill={`url(#${id}c)`} />
            <path d="M68 40l7 9-7 4-7-4z" fill="#d7e3ff" opacity=".75" />
            <path d="M68 53v27l-7-5V49z" fill="#1d3fb0" opacity=".5" />
          </g>
          <path d="M50 10l13 16v50l-13 12-13-12V26z" fill={`url(#${id}c)`} />
          <path d="M50 10l13 16-13 7-13-7z" fill="#e9efff" />
          <path d="M50 33v55l-13-12V26z" fill="#1b3496" opacity=".5" />
          <path d="M50 33v55l13-12V26z" fill="#6f95ff" opacity=".35" />
          <path
            d="M43 31v38"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".7"
          />
          <path
            d="M50 10l13 16v50l-13 12-13-12V26z"
            fill="none"
            stroke="#132a78"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="58" cy="22" r="2.4" fill="#fff" />
        </>
      ) : kind === 'fossil' ? (
        <>
          <defs>
            <radialGradient id={`${id}f`} cx=".38" cy=".32" r=".75">
              <stop offset="0" stopColor="#ffc1a8" />
              <stop offset=".5" stopColor="#ff6a48" />
              <stop offset="1" stopColor="#a8301a" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="33" fill={`url(#${id}f)`} />
          <path
            d={ribs}
            stroke="#8e2814"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity=".55"
          />
          <path
            d={coil}
            fill="none"
            stroke="#7a2210"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={coil}
            fill="none"
            stroke="#ffd2c2"
            strokeWidth="1"
            strokeLinecap="round"
            opacity=".7"
            transform="translate(-1 -1.2)"
          />
          <circle
            cx="50"
            cy="50"
            r="33"
            fill="none"
            stroke="#7a2210"
            strokeWidth="1.8"
          />
          <ellipse
            cx="37"
            cy="30"
            rx="10"
            ry="5"
            fill="#fff"
            opacity=".45"
            transform="rotate(-32 37 30)"
          />
        </>
      ) : kind === 'gold' ? (
        <>
          <defs>
            <radialGradient id={`${id}g`} cx=".36" cy=".3" r=".8">
              <stop offset="0" stopColor="#fff6c2" />
              <stop offset=".35" stopColor="#ffd23f" />
              <stop offset=".8" stopColor="#d39b14" />
              <stop offset="1" stopColor="#8f6208" />
            </radialGradient>
          </defs>
          <path
            d="M24 58c-4-11 3-25 15-29 6-9 20-12 29-5 11 2 18 13 15 24 4 9-1 21-12 24-8 6-22 6-30 1-10 0-17-6-17-15z"
            fill={`url(#${id}g)`}
            stroke="#7a5306"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M39 29c4 6 12 9 20 7M68 24c-3 8-1 15 5 20M30 60c8-1 14 3 16 10M58 52c6 2 10 8 9 15"
            fill="none"
            stroke="#a8780c"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity=".7"
          />
          <path
            d="M36 37c4-5 10-7 15-5"
            fill="none"
            stroke="#fff"
            strokeWidth="3.4"
            strokeLinecap="round"
            opacity=".85"
          />
          <circle cx="63" cy="40" r="2.2" fill="#fff" opacity=".9" />
          <circle cx="45" cy="62" r="1.6" fill="#fff6c2" />
          <circle cx="70" cy="62" r="1.4" fill="#fff6c2" />
        </>
      ) : (
        <>
          <defs>
            <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8ff0b4" />
              <stop offset=".5" stopColor="#12a870" />
              <stop offset="1" stopColor="#0a6040" />
            </linearGradient>
          </defs>
          <g transform="rotate(-14 50 54)">
            <g fill={`url(#${id}l)`} stroke="#07462e" strokeWidth="1.1">
              {fronds.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <path
              d="M50 90C49 66 50 34 51 12"
              fill="none"
              stroke="#07462e"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M48.5 80C48 62 48.6 38 49.4 18"
              fill="none"
              stroke="#b6f5cf"
              strokeWidth="1"
              strokeLinecap="round"
              opacity=".8"
            />
          </g>
        </>
      )}
    </svg>
  );
}

const findName = (kind: TriviaFindKind) =>
  triviaFinds.find((f) => f.id === kind)!.name;

/** The camp after a round: the offer on the mat, the pick order above it
 * and every collection beside it. Only the player whose turn it is can pick;
 * the host's pick of the next game follows once every find is taken. */
export function DraftCamp({
  g,
  viewer,
  disabled,
  canAdvance = false,
  awaySeats = [],
  children,
  commit,
}: {
  g: AnyGame;
  viewer: number | null;
  disabled: boolean;
  /** The host (or a seated fallback) may pick for an away picker. */
  canAdvance?: boolean;
  awaySeats?: number[];
  /** The host's pick, shown once the draft is done. */
  children?: React.ReactNode;
  commit: (move: AnyMove) => void;
}) {
  const t = triviaOf(g)!;
  const d = currentDraft(g);
  const picker = draftPicker(g);
  const live = viewer !== null && picker === viewer && !disabled;
  const scores = t.rounds.at(-1)?.scores ?? [];
  const mine = viewer === null ? [] : (t.players[viewer]?.finds ?? []);
  const pickFor =
    picker !== null &&
    picker !== viewer &&
    canAdvance &&
    !disabled &&
    awaySeats.includes(picker);
  return (
    <section
      className={`trivia-draft ${picker === null ? 'is-done' : ''} ${live ? 'is-live' : ''}`}
      aria-label="Camp"
    >
      <div className="trivia-draft-mat">
        {d && (
          <ol className="trivia-draft-order" aria-label="Pick order">
            {d.order.map((seat, k) => {
              const taken = k < d.picks.length ? d.offer[d.picks[k]] : null;
              return (
                <li
                  key={seat}
                  className={`${taken ? 'is-done' : k === d.picks.length ? 'is-now' : ''} ${seat === viewer ? 'is-you' : ''}`}
                  style={{ '--i': k } as CSSProperties}
                  aria-label={`${k + 1}. ${g.seats[seat]}, ${scores[seat] ?? 0} points${taken ? `, took ${taken.size === 2 ? 'a big ' : ''}${findName(taken.kind)}` : ''}`}
                >
                  <b className="draft-place">{k + 1}</b>
                  <span className={`party-avatar seat-${seat}`}>
                    {g.seats[seat].slice(0, 1)}
                  </span>
                  <small>{scores[seat] ?? 0}</small>
                  {taken && (
                    <span
                      className={`draft-took ${taken.size === 2 ? 'is-big' : ''}`}
                    >
                      <FindMark kind={taken.kind} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {!d && (
          // Before the first camp: the four kinds of finds on display.
          <div
            className="trivia-draft-offer is-preview"
            style={{ '--n': 4, '--half': 2 } as CSSProperties}
            aria-hidden="true"
          >
            {triviaFinds.map((f, i) => (
              <span
                key={f.id}
                className={`draft-find kind-${f.id}`}
                style={{ '--i': i } as CSSProperties}
              >
                <span className="draft-tray">
                  <FindMark kind={f.id} />
                </span>
              </span>
            ))}
          </div>
        )}
        {d && (
          <div
            className="trivia-draft-offer"
            style={
              {
                '--n': d.offer.length,
                '--half': Math.ceil(d.offer.length / 2),
              } as CSSProperties
            }
          >
            {d.offer.map((find, i) => {
              const k = d.picks.indexOf(i);
              const taker = k >= 0 ? d.order[k] : null;
              const lost = taker === null && picker === null;
              const gain = findGain(mine, find);
              return (
                <button
                  key={i}
                  type="button"
                  className={`draft-find kind-${find.kind} ${find.size === 2 ? 'is-big' : ''} ${taker !== null ? 'is-taken' : ''} ${lost ? 'is-lost' : ''} ${k === d.picks.length - 1 ? 'is-just-taken' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  disabled={!live || taker !== null}
                  aria-label={`${find.size === 2 ? 'Big ' : ''}${findName(find.kind)}${taker !== null ? `, taken by ${g.seats[taker]}` : lost ? ', left behind' : viewer !== null ? `, +${gain}` : ''}`}
                  onClick={() => commit({ type: 'trivia-pick', find: i })}
                >
                  <span className="draft-tray">
                    <FindMark kind={find.kind} />
                    {find.size === 2 && (
                      <i className="draft-big" aria-hidden="true">
                        2
                      </i>
                    )}
                  </span>
                  {taker !== null ? (
                    <span
                      className={`draft-taker party-avatar seat-${taker}`}
                      aria-hidden="true"
                    >
                      {g.seats[taker].slice(0, 1)}
                    </span>
                  ) : (
                    live && (
                      <span className="draft-gain" aria-hidden="true">
                        +{gain}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        )}
        {pickFor && (
          <button
            type="button"
            className="party-primary draft-pick-for"
            onClick={() => commit({ type: 'trivia-pick-for' })}
          >
            <Hand size={18} aria-hidden="true" />
            Pick for {g.seats[picker!]}
          </button>
        )}
      </div>
      <div className="trivia-draft-dock">
        <Collections g={g} viewer={viewer} picker={picker} />
        {picker === null && children}
      </div>
    </section>
  );
}

/** Every player's specimen case: four compartments and the score. */
export function Collections({
  g,
  viewer,
  picker = null,
  large = false,
}: {
  g: AnyGame;
  viewer: number | null;
  picker?: number | null;
  large?: boolean;
}) {
  const t = triviaOf(g);
  if (!t) return null;
  return (
    <ol
      className={`trivia-cases ${large ? 'is-large' : ''}`}
      aria-label="Collections"
      style={{ '--players': g.seats.length } as CSSProperties}
    >
      {t.players.map((p, seat) => {
        const counts = findCounts(p.finds),
          score = collectionScore(p.finds);
        return (
          <li
            key={seat}
            className={`trivia-case ${seat === viewer ? 'is-you' : ''} ${seat === picker ? 'is-picking' : ''}`}
            aria-label={`${g.seats[seat]}: ${score} points, ${triviaFinds.map((f, i) => `${counts[i]} ${f.name}`).join(', ')}`}
          >
            <span
              className={`party-avatar seat-${seat}`}
              aria-hidden="true"
            >
              {g.seats[seat].slice(0, 1)}
            </span>
            <b className="trivia-case-name" aria-hidden="true">
              {g.seats[seat]}
            </b>
            <span className="trivia-case-slots" aria-hidden="true">
              {triviaFinds.map((f, i) => (
                <span
                  key={f.id}
                  className={`trivia-case-slot kind-${f.id} ${counts[i] ? '' : 'is-empty'}`}
                  data-game-motion="change"
                  data-game-motion-key={counts[i]}
                >
                  {large ? (
                    // The final display: a fanned pile, one per find.
                    <span
                      className="trivia-case-pile"
                      style={{ '--count': Math.min(counts[i], 8) } as CSSProperties}
                    >
                      {Array.from(
                        { length: Math.max(1, Math.min(counts[i], 8)) },
                        (_, k) => (
                          <FindMark
                            key={k}
                            kind={f.id}
                            className="pile-mark"
                          />
                        ),
                      )}
                    </span>
                  ) : (
                    <FindMark kind={f.id} />
                  )}
                  <b>{counts[i]}</b>
                </span>
              ))}
            </span>
            <strong className="trivia-case-score" aria-hidden="true">
              <CountUp value={score} duration={600} />
            </strong>
          </li>
        );
      })}
    </ol>
  );
}
