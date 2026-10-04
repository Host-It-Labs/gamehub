'use client';
import { useState } from 'react';
import { LockKeyhole, Minus, Plus } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import { coinPrompts } from '@/lib/games/party/coin-prompts';
import {
  guessedAll,
  perfectRead,
  spent,
  totalCoins,
  type CoinsGame,
} from '@/lib/games/party/coins';
import {
  AuthorTabs,
  LockDots,
  NextStep,
  RevealAuthor,
  ScoreChips,
  nextAuthor,
  useAuthorTabs,
} from './know-me-parts';
import { GuessDock } from './top-five-table';
import { stagger } from './reveal-motion';

/** One option's pile as a row of ten coin slots. Tapping a slot sets the
 * pile to that many; tapping the top coin takes it back off. */
function CoinTrack({
  label,
  value,
  free,
  disabled,
  onSet,
  reveal,
}: {
  label: string;
  value: number;
  /** Coins still in the purse. */
  free: number;
  disabled: boolean;
  onSet?: (value: number) => void;
  /** At a reveal, coins pop in one after another from this delay. */
  reveal?: number;
}) {
  const set = (v: number) => onSet?.(Math.max(0, Math.min(value + free, v)));
  return (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- The graphical coin row groups controls without fieldset browser styling.
    <div className="coin-track" role="group" aria-label={`${label}: ${value}`}>
      {onSet && (
        <button
          type="button"
          className="coin-step"
          aria-label={`One less on ${label}`}
          disabled={disabled || value === 0}
          onClick={() => set(value - 1)}
        >
          <Minus size={16} strokeWidth={3} aria-hidden="true" />
        </button>
      )}
      <span className="coin-slots">
        {Array.from({ length: totalCoins }, (_, i) => {
          const filled = i < value,
            reachable = i < value + free;
          return onSet ? (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={`coin ${filled ? 'is-filled' : ''} ${reachable ? '' : 'is-out'}`}
              disabled={disabled || !reachable}
              onClick={() => set(i + 1 === value ? i : i + 1)}
            />
          ) : (
            <i
              key={i}
              className={`coin ${filled ? 'is-filled reveal-pop' : ''}`}
              style={
                filled && reveal !== undefined
                  ? stagger(i, reveal, 45)
                  : undefined
              }
            />
          );
        })}
      </span>
      {onSet && (
        <button
          type="button"
          className="coin-step"
          aria-label={`One more on ${label}`}
          disabled={disabled || free === 0}
          onClick={() => set(value + 1)}
        >
          <Plus size={16} strokeWidth={3} aria-hidden="true" />
        </button>
      )}
      <b className="coin-count" aria-hidden="true">
        {value}
      </b>
    </div>
  );
}

/** Ten Coins: split ten coins over your own prompt's four options, then
 * guess every other player's split at once, one tab per player; each split
 * is revealed in turn. */
export function CoinsTable({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: CoinsGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  const tabs = useAuthorTabs(g.seats, viewer, `${g.round}:${g.phase}`);
  // Taps land at once on screen; the table catches up a moment later.
  const [pending, setPending] = useState<{
    key: string;
    coins: number[];
  } | null>(null);
  const answering = g.phase === 'answer',
    guessing = g.phase === 'guess',
    revealing = (g.phase === 'reveal' || g.phase === 'vote') && !!g.result,
    author = answering ? viewer : guessing ? tabs.current : g.target,
    own = g.cards[viewer],
    card = g.cards[author],
    prompt = card && card.prompt >= 0 ? coinPrompts[card.prompt] : null,
    locked = answering ? own.locked : g.guesses[viewer].locked,
    key = `${g.round}:${g.phase}:${author}:${card?.prompt}`,
    saved = answering
      ? own.coins
      : guessing
        ? g.guesses[viewer].coins[author]
        : (g.result?.coins ?? []),
    coins = pending?.key === key ? pending.coins : saved,
    free = totalCoins - spent(coins),
    editable = !disabled && !locked && (answering || guessing);
  function put(option: number, value: number) {
    const next = coins.map((v, i) => (i === option ? value : v));
    setPending({ key, coins: next });
    commit(
      guessing
        ? { type: 'coins', option, value, author }
        : { type: 'coins', option, value },
    );
  }
  const done = (a: number) => spent(g.guesses[viewer].coins[a]) === totalCoins;
  return (
    <section className={`coins-stage phase-${g.phase}`}>
      {guessing && (
        <AuthorTabs
          seats={g.seats}
          authors={tabs.authors}
          current={tabs.current}
          done={done}
          onSelect={tabs.select}
        />
      )}
      {revealing && (
        <RevealAuthor seats={g.seats} target={g.target} viewer={viewer} />
      )}
      {answering && !locked && own.offers.length > 1 ? (
        <fieldset className="coins-switch" aria-label="Prompt">
          {own.offers.map((id) => (
            <button
              key={id}
              type="button"
              className={own.prompt === id ? 'chosen' : ''}
              aria-pressed={own.prompt === id}
              disabled={disabled}
              onClick={() => commit({ type: 'prompt', target: id })}
            >
              {coinPrompts[id].text}
            </button>
          ))}
        </fieldset>
      ) : (
        <h2
          className="coins-prompt"
          data-game-motion="change"
          data-game-motion-key={key}
        >
          {guessing && (
            <span className={`party-avatar seat-${author}`} aria-hidden="true">
              {g.seats[author].slice(0, 1)}
            </span>
          )}
          {prompt?.text}
        </h2>
      )}
      <div
        className="coins-board"
        data-game-motion="piece"
        data-game-motion-key={key}
      >
        {!revealing && (
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS coin shapes form a single labelled illustration.
          <div className="coins-purse" aria-label={`${free} of ${totalCoins} coins left`} role="img">
            {Array.from({ length: totalCoins }, (_, i) => (
              <i key={i} className={i < free ? 'is-left' : ''} />
            ))}
          </div>
        )}
        <ol className="coins-rows">
          {prompt?.options.map((label, i) => {
            const guesses = revealing
              ? g.seats.flatMap((_, s) =>
                  g.result!.guesses[s] ? [[s, g.result!.guesses[s]![i]]] : [],
                )
              : [];
            return (
              <li
                key={label}
                className={`coins-row row-${i} ${revealing && coins[i] === Math.max(...coins) && coins[i] > 0 ? 'is-top' : ''}`}
              >
                <strong>{label}</strong>
                <CoinTrack
                  label={label}
                  value={coins[i] ?? 0}
                  free={free}
                  disabled={!editable}
                  onSet={revealing ? undefined : (v) => put(i, v)}
                  reveal={revealing ? i * 220 : undefined}
                />
                {guesses.length > 0 && (
                  <span className="coins-guesses">
                    {guesses.map(([s, v], j) => (
                      <i
                        key={s}
                        className={`seat-${s} ${v === coins[i] ? 'is-right' : ''} ${s === viewer ? 'is-mine' : ''} reveal-drop`}
                        style={stagger(j, i * 220 + 500, 50)}
                        title={s === viewer ? 'You' : g.seats[s]}
                      >
                        <span className={`party-avatar seat-${s}`}>
                          {g.seats[s].slice(0, 1)}
                        </span>
                        {v}
                      </i>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {g.phase === 'reveal' && g.result && (
        <ScoreChips
          seats={g.seats}
          viewer={viewer}
          gains={g.result.gains}
          skip={g.target}
          best={perfectRead}
          start={4 * 220 + 600}
        />
      )}
      <div
        className="party-dock"
        aria-live="polite"
        data-game-motion="change"
        data-game-motion-key={`${g.phase}:${locked}`}
      >
        {answering && (
          <button
            className={locked ? 'party-locked' : 'party-primary'}
            disabled={disabled || (!locked && spent(own.coins) !== totalCoins)}
            onClick={() => commit({ type: locked ? 'unlock' : 'lock' })}
          >
            <LockKeyhole size={17} aria-hidden="true" />
            {locked ? 'Unlock' : 'Lock'}
          </button>
        )}
        {guessing && (
          <GuessDock
            seats={g.seats}
            locked={locked}
            unseen={tabs.authors.find((a) => a !== tabs.current && !done(a))}
            ready={guessedAll(g, viewer)}
            disabled={disabled}
            onSelect={tabs.select}
            commit={commit}
          />
        )}
        {answering && (
          <LockDots locked={g.cards.map((c) => c.locked)} label="players" />
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
