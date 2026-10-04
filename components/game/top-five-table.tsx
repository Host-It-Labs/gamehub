'use client';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import { topics } from '@/lib/games/party/catalog';
import {
  tiers,
  count,
  guessOrder,
  type RankingGame,
} from '@/lib/games/party/ranking';
import { SortableRanking } from './ranking-handle';
import { RankingReveal } from './ranking-reveal';
import {
  AuthorTabs,
  LockDots,
  NextStep,
  RevealAuthor,
  nextAuthor,
  useAuthorTabs,
} from './know-me-parts';

/** Top Five: rank your own list, then everyone guesses every other list at
 * once, one tab per player; the lists are then revealed one by one. */
export function TopFiveTable({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: RankingGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  const tabs = useAuthorTabs(g.seats, viewer, `${g.round}:${g.phase}`);
  const guessing = g.phase === 'guess',
    owner = g.phase === 'rank' ? viewer : guessing ? tabs.current : g.target,
    ballot = g.ballots[owner],
    topic = ballot && ballot.topic >= 0 ? topics[ballot.topic] : null,
    own = g.ballots[viewer],
    guess = g.guesses[viewer],
    locked = g.phase === 'rank' ? !!own?.locked : !!guess?.locked;
  const order =
    g.phase === 'rank'
      ? own?.order
      : guessing
        ? guessOrder(g, viewer, owner)
        : g.result?.order;
  const editable = !disabled && !locked && (g.phase === 'rank' || guessing);
  return (
    <section
      className={`ranking-stage ${topic ? 'has-topic' : ''} phase-${g.phase}`}
    >
      {g.phase === 'rank' && (
        <div className={`topic-choices ${topic ? 'compact' : ''}`}>
          {g.offers[viewer]?.map((id) => (
            <div
              key={id}
              className={`topic-option ${topic?.id === id ? 'chosen' : ''}`}
              data-game-motion="piece"
            >
              <button
                className={`topic-card ${topic?.id === id ? 'chosen' : ''}`}
                disabled={disabled || locked}
                aria-pressed={topic?.id === id}
                onClick={() => commit({ type: 'topic', target: id })}
              >
                <strong>{topics[id].title}</strong>
                {!topic && (
                  <span className="topic-answer-chips">
                    {topics[id].answers.slice(0, 5).map((answer) => (
                      <span key={answer}>{answer}</span>
                    ))}
                  </span>
                )}
              </button>
            </div>
          ))}
          <button
            className="topic-refresh"
            disabled={disabled || locked || (g.refreshes?.[viewer] ?? 0) >= 2}
            aria-label={`New choices, ${2 - (g.refreshes?.[viewer] ?? 0)} left`}
            title="New choices"
            onClick={() => commit({ type: 'refresh' })}
          >
            <RefreshCw size={18} aria-hidden="true" />
            <b aria-hidden="true">{2 - (g.refreshes?.[viewer] ?? 0)}</b>
          </button>
        </div>
      )}
      {guessing && (
        <AuthorTabs
          seats={g.seats}
          authors={tabs.authors}
          current={tabs.current}
          done={(a) => locked || tabs.seen.includes(a)}
          onSelect={tabs.select}
        />
      )}
      {(g.phase === 'reveal' || g.phase === 'vote') && (
        <RevealAuthor seats={g.seats} target={g.target} viewer={viewer} />
      )}
      {topic && (
        <div
          className="tier-paper"
          data-game-motion="piece"
          data-game-motion-key={`${owner}:${topic.id}`}
        >
          <div className="tier-paper-heading">
            <h3>{topic.title}</h3>
          </div>
          {g.phase === 'reveal' && g.result ? (
            <RankingReveal g={g} viewer={viewer} topic={topic} />
          ) : order && order.length > 0 ? (
            <SortableRanking
              key={`${g.round}-${g.phase}-${owner}-${topic.id}`}
              order={order}
              disabled={!editable}
              label={(id) => topic.answers[id]}
              onReorder={(next) =>
                commit(
                  guessing
                    ? { type: 'arrange', author: owner, order: next }
                    : { type: 'arrange', order: next },
                )
              }
              render={(answer, i) => (
                <>
                  <span className="tier-label">{tiers[i]}</span>
                  <strong>{topic.answers[answer]}</strong>
                </>
              )}
            />
          ) : (
            <div className="answer-cloud">
              {topic.answers.slice(0, count(g)).map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className="party-dock"
        aria-live="polite"
        data-game-motion="change"
        data-game-motion-key={`${g.phase}:${locked}`}
      >
        {g.phase === 'rank' &&
          own &&
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
              onClick={() => commit({ type: 'lock' })}
            >
              <LockKeyhole size={17} aria-hidden="true" />
              Lock
            </button>
          ))}
        {guessing && (
          <GuessDock
            seats={g.seats}
            locked={locked}
            unseen={tabs.unseen}
            disabled={disabled}
            onSelect={tabs.select}
            commit={commit}
          />
        )}
        {g.phase === 'rank' && (
          <LockDots locked={g.ballots.map((b) => !!b?.locked)} label="lists" />
        )}
        {guessing && (
          <LockDots locked={g.guesses.map((b) => b.locked)} label="guesses" />
        )}
        {g.phase === 'reveal' && (
          <NextStep
            next={nextAuthor(g.seats, g.target, viewer)}
            canAdvance={canAdvance}
            disabled={disabled}
            hostName={hostName}
            onNext={() => commit({ type: 'next' })}
          />
        )}
      </div>
    </section>
  );
}

/** While everyone guesses everyone: Next walks to a player not yet looked
 * at; once every player has been seen, one Lock settles them all. */
export function GuessDock({
  seats,
  locked,
  unseen,
  disabled,
  onSelect,
  commit,
  lock = { type: 'lock' },
  ready = true,
}: {
  seats: string[];
  locked: boolean;
  unseen: number | undefined;
  disabled: boolean;
  onSelect: (author: number) => void;
  commit: (m: AnyMove) => void;
  /** The lock may carry the last change, so both land as one move. */
  lock?: AnyMove;
  /** Every guess is in; Ten Coins needs all ten coins placed for everyone. */
  ready?: boolean;
}) {
  if (locked)
    return (
      <button
        className="party-locked"
        disabled={disabled}
        onClick={() => commit({ type: 'unlock' })}
      >
        <LockKeyhole size={17} aria-hidden="true" />
        Unlock
      </button>
    );
  if (unseen !== undefined)
    return (
      <NextStep
        next={{ label: seats[unseen], seat: unseen, initial: seats[unseen] }}
        canAdvance
        disabled={disabled}
        onNext={() => onSelect(unseen)}
      />
    );
  return (
    <button
      className="party-primary"
      disabled={disabled || !ready}
      onClick={() => commit(lock)}
    >
      <LockKeyhole size={17} aria-hidden="true" />
      Lock
    </button>
  );
}
