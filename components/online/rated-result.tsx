'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUp, Flame, Sparkles, Trophy } from 'lucide-react';
import { api, ApiError } from '@/lib/online/client';
import { useSession } from '@/lib/online/use-session';
import {
  formatDelta,
  formatValue,
  leaderboardGame,
  unitLabel,
  type RatedResult,
} from '@/lib/games/leaderboards';
import { CountUp } from '../game/reveal-motion';
import { JoinSheet } from './join-sheet';
import './account-forms.css';
import './rated-result.css';

/** Waits for the server's record of the game that just ended. It is written
 *  with the final move, so a retry or two covers a slow write. */
export function useRatedResult(url: string, finished: boolean) {
  const [result, setResult] = useState<RatedResult | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!finished) return;
    let live = true;
    let tries = 0;
    let timer = 0;
    const load = () =>
      api<RatedResult>(`/api/leaderboards/result?url=${encodeURIComponent(url)}`).then(
        (r) => live && setResult(r),
        (e) => {
          // 404: not a rated room. Anything else: try a few more times.
          if (!live || (e instanceof ApiError && e.status === 404) || ++tries > 4) return;
          timer = window.setTimeout(load, 600 * tries);
        },
      );
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [url, finished, tick]);
  return { result, reload: () => setTick((n) => n + 1) };
}

/**
 * What the game just did to your place: rating (or best) counting to its new
 * value, the change, your place and streak. A guest sees the place their
 * result would take, and one button to put their name there.
 */
export function RatedResultCard({
  url,
  finished,
  className = '',
}: {
  url: string;
  finished: boolean;
  className?: string;
}) {
  const { result, reload } = useRatedResult(url, finished);
  const session = useSession();
  const [joining, setJoining] = useState(false);
  if (!result || !result.counted) return null;
  const game = leaderboardGame(result.gameId);
  const rating = result.metric === 'rating';
  const climbed =
    result.previousRank !== null && result.rank < result.previousRank
      ? result.previousRank - result.rank
      : 0;
  const guest = !result.public && session.loaded && !session.user;
  const board = `/leaderboards?game=${result.gameId}&view=${encodeURIComponent(result.view)}`;
  return (
    <section
      className={`rated-card ${result.delta > 0 ? 'is-up' : result.delta < 0 ? 'is-down' : ''} ${guest ? 'is-guest' : ''} ${className}`}
      aria-label={`${game?.name ?? 'Game'} ${rating ? 'rating' : 'record'}`}
    >
      <div className="rated-top">
        <span className="rated-label">
          <Trophy aria-hidden="true" />
          {game?.name} {rating ? 'rating' : 'best'}
        </span>
        {result.newBest && !rating && (
          <span className="rated-best">
            <Sparkles aria-hidden="true" /> New best
          </span>
        )}
      </div>
      <div className="rated-main">
        <strong className="rated-value">
          <CountUp
            value={result.after}
            from={result.before ?? result.after}
            duration={result.before === null ? 0 : 1100}
            delay={350}
            format={formatValue}
          />
          {!rating && <small>{unitLabel(result.metric, result.after)}</small>}
        </strong>
        {rating && result.before !== null && (
          <span className="rated-delta">{formatDelta(result.delta)}</span>
        )}
      </div>
      <div className="rated-facts">
        <span className="rated-place">
          {guest ? (
            <>
              <b>#{result.rank}</b> when you join
            </>
          ) : (
            <>
              <b>#{result.rank}</b> of {result.total}
              {climbed > 0 && (
                <span className="rated-climb" aria-label={`Up ${climbed}`}>
                  <ArrowUp aria-hidden="true" />
                  {climbed}
                </span>
              )}
            </>
          )}
        </span>
        {rating && result.streak >= 2 && (
          <span className="rated-streak">
            <Flame aria-hidden="true" /> {result.streak} in a row
          </span>
        )}
      </div>
      {guest ? (
        <button type="button" className="acct-primary rated-join" onClick={() => setJoining(true)}>
          Put my name on the board
        </button>
      ) : (
        <a className="rated-link" href={board}>
          Leaderboard <ArrowRight aria-hidden="true" />
        </a>
      )}
      <JoinSheet
        open={joining}
        onOpenChange={setJoining}
        context={
          <>
            Keep your <b>{formatValue(result.after)}</b> and take place <b>#{result.rank}</b>.
          </>
        }
        onJoined={(user) => {
          session.setUser(user);
          reload();
        }}
      />
    </section>
  );
}
