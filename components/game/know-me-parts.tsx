'use client';
import { useState, type ReactNode } from 'react';
import { Check, ChevronRight, Flag } from 'lucide-react';
import { CountUp, stagger } from './reveal-motion';
import './know-me.css';

/** Pieces every Know Me game shares now that everyone guesses everyone at
 * once: the other players as tabs, the host's Next that names what comes
 * next, and the score chips of a reveal. */

/** Which player's answer the viewer is guessing, and which they have seen.
 * The pick survives refreshes within the phase and resets with it. */
export function useAuthorTabs(seats: string[], viewer: number, key: string) {
  const authors = seats.flatMap((_, s) => (s === viewer ? [] : [s]));
  const [state, setState] = useState({
    key,
    current: authors[0] ?? 0,
    seen: [authors[0] ?? 0],
  });
  const live =
    state.key === key
      ? state
      : { key, current: authors[0] ?? 0, seen: [authors[0] ?? 0] };
  const select = (author: number) =>
    setState({
      key,
      current: author,
      seen: live.seen.includes(author) ? live.seen : [...live.seen, author],
    });
  /** The first player not yet looked at after the current one, if any. */
  const unseen =
    authors.find(
      (a, i) => i > authors.indexOf(live.current) && !live.seen.includes(a),
    ) ?? authors.find((a) => !live.seen.includes(a));
  return { authors, current: live.current, select, unseen, seen: live.seen };
}

export function AuthorTabs({
  seats,
  authors,
  current,
  done,
  onSelect,
}: {
  seats: string[];
  authors: number[];
  current: number;
  done: (author: number) => boolean;
  onSelect: (author: number) => void;
}) {
  return (
    <div className="author-tabs" role="tablist" aria-label="Players">
      {authors.map((a) => (
        <button
          key={a}
          type="button"
          role="tab"
          aria-selected={a === current}
          className={`author-tab ${a === current ? 'is-current' : ''} ${done(a) ? 'is-done' : ''}`}
          onClick={() => onSelect(a)}
        >
          <span className={`party-avatar seat-${a}`} aria-hidden="true">
            {seats[a].slice(0, 1)}
          </span>
          <b>{seats[a]}</b>
          {done(a) && (
            <Check
              className="author-tab-done"
              size={14}
              strokeWidth={3}
              aria-label="Done"
            />
          )}
        </button>
      ))}
    </div>
  );
}

/** The host's Next, naming what it opens: a player, a place, or the end of
 * the round. Everyone else sees who moves the table on. */
export function NextStep({
  next,
  canAdvance,
  disabled,
  hostName,
  onNext,
  className = 'party-primary',
}: {
  /** Null when Next closes the round. */
  next: {
    label: string;
    seat?: number;
    initial?: string;
    art?: ReactNode;
  } | null;
  canAdvance: boolean;
  disabled: boolean;
  hostName?: string;
  onNext: () => void;
  className?: string;
}) {
  const label = next ? next.label : 'End of round';
  if (!canAdvance)
    return (
      <span className="party-waiting">{hostName ?? 'The host'} moves on</span>
    );
  return (
    <button
      type="button"
      className={`${className} next-step`}
      disabled={disabled}
      aria-label={next ? `Next: ${label}` : label}
      onClick={onNext}
    >
      {next?.seat !== undefined ? (
        <span className={`party-avatar seat-${next.seat}`} aria-hidden="true">
          {(next.initial ?? label).slice(0, 1)}
        </span>
      ) : next?.art ? (
        <span className="next-step-art" aria-hidden="true">
          {next.art}
        </span>
      ) : !next ? (
        <Flag size={16} aria-hidden="true" />
      ) : null}
      <span className="next-step-label">{label}</span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

/** Dial-style chips after a reveal: avatar, name, the points counting up. */
export function ScoreChips({
  seats,
  viewer,
  gains,
  skip,
  best,
  start = 400,
}: {
  seats: string[];
  viewer: number;
  gains: number[];
  /** The author, who scores nothing on their own answer. */
  skip?: number;
  /** A perfect score earns the burst. */
  best: number;
  start?: number;
}) {
  return (
    <div className="dial-scores">
      {seats.flatMap((name, s) => {
        if (s === skip) return [];
        const gain = gains[s],
          at = start + s * 90,
          perfect = gain >= best;
        return [
          <span
            key={s}
            className={`seat-${s} ${s === viewer ? 'is-mine' : ''} ${perfect ? 'is-bullseye reveal-burst' : ''} reveal-pop`}
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
                  Number.isInteger(gain) ? String(Math.round(v)) : v.toFixed(2)
                }
              />
            </strong>
          </span>,
        ];
      })}
    </div>
  );
}

/** Whose answer is on screen at a reveal, with the round's progress dots. */
export function RevealAuthor({
  seats,
  target,
  viewer,
}: {
  seats: string[];
  target: number;
  viewer: number;
}) {
  return (
    <div className="ranking-author">
      <span className={`party-avatar seat-${target}`}>
        {seats[target].slice(0, 1)}
      </span>
      <b>{target === viewer ? 'You' : seats[target]}</b>
      <span
        className="ranking-count"
        aria-label={`${target + 1} of ${seats.length}`}
      >
        {seats.map((_, s) => (
          <i
            key={s}
            className={s < target ? 'is-done' : s === target ? 'is-now' : ''}
          />
        ))}
      </span>
    </div>
  );
}
/** The next player a reveal opens, for the host's Next. */
export function nextAuthor(seats: string[], target: number, viewer: number) {
  return target < seats.length - 1
    ? {
        label: target + 1 === viewer ? 'You' : seats[target + 1],
        seat: target + 1,
        initial: seats[target + 1],
      }
    : null;
}
/** Every guesser's lock, as dots, for the player waiting on the others. */
export function LockDots({
  locked,
  label,
}: {
  locked: boolean[];
  label: string;
}) {
  return (
    <span
      className="party-lock-count"
      aria-label={`${locked.filter(Boolean).length} of ${locked.length} ${label} locked`}
    >
      {locked.map((l, i) => (
        <i key={i} className={l ? 'is-locked' : ''} />
      ))}
    </span>
  );
}
