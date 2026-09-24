'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  voteTally,
  type RoundChoice,
  type RoundVote,
} from '@/lib/games/party/vote';

/** Seconds left on a server-owned deadline, ticking on this device's clock. */
export function useSecondsLeft(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [endsAt]);
  return endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function VoteClock({
  endsAt,
  total = 10,
}: {
  endsAt: number | null;
  total?: number;
}) {
  const left = useSecondsLeft(endsAt);
  if (left === null) return null;
  return (
    <span
      className="vote-clock"
      role="timer"
      aria-label={`${left} seconds left`}
    >
      <i style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      <b>{left}s</b>
    </span>
  );
}

/** The ten-second table vote at the end of each round. */
export function RoundVotePanel({
  vote,
  round,
  viewer,
  seats,
  disabled,
  onVote,
  children,
}: {
  vote: RoundVote;
  round: number;
  viewer: number;
  seats: string[];
  disabled: boolean;
  onVote: (choice: RoundChoice) => void;
  children?: ReactNode;
}) {
  const mine = vote.choices[viewer] ?? null,
    { more, finish } = voteTally(vote);
  const option = (
    choice: RoundChoice,
    label: string,
    detail: string,
    count: number,
  ) => (
    <button
      type="button"
      className={`vote-option ${mine === choice ? 'is-mine' : ''}`}
      aria-pressed={mine === choice}
      disabled={disabled}
      onClick={() => mine !== choice && onVote(choice)}
    >
      <strong>{label}</strong>
      <small>{detail}</small>
      <span className="vote-count" aria-label={`${count} votes`}>
        {Array.from({ length: count }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      {mine === choice && (
        <Check className="vote-check" size={18} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <section className="table-vote" aria-labelledby="round-vote-title">
      <span className="party-eyebrow">ROUND {round} COMPLETE</span>
      <h2 id="round-vote-title">Another round?</h2>
      <VoteClock endsAt={vote.endsAt} />
      <div className="vote-options">
        {option(
          'more',
          'Keep playing',
          `Round ${round + 1}, fresh prompts`,
          more,
        )}
        {option('finish', 'Finish here', 'See the final scores', finish)}
      </div>
      <p className="vote-note">
        {mine
          ? `You voted. ${vote.choices.filter((c) => c === null).length} of ${seats.length} still deciding.`
          : 'Most votes wins. Silent players don’t count; a tie keeps playing.'}
      </p>
      {children}
    </section>
  );
}
