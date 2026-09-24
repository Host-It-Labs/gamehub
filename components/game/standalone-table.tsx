'use client';
import { useEffect, useRef, useState } from 'react';
import {
  LockKeyhole,
  LoaderCircle,
  Check,
  Volume2,
  RotateCcw,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import {
  standaloneGames,
  botMove,
  tick,
  deadline,
  observe,
  type AnyGame,
  type AnyMove,
} from '@/lib/games/standalone/registry';
import { GameNavigation } from './game-navigation';
import { useBadgeFit } from './use-fit';
import { SortableRanking } from './ranking-handle';
import { topics } from '@/lib/games/party/catalog';
import {
  tiers,
  guessSlot,
  guessName,
  captain,
  guessingTeams,
  count,
  groupName,
  type RankingGame,
} from '@/lib/games/party/ranking';
import { GeographyTable } from './geography-table';
import { DialTable } from './dial-table';
import { SizeTable } from './size-table';
import { PartyFinale } from './party-finale';
import { RankingReveal } from './ranking-reveal';
import { RoundVotePanel } from './table-vote';
import { TribuVote } from './tribu-vote';
import { seatTotals } from '@/lib/games/party/tribu';
import { setOf } from '@/lib/games/party/vote';
import './tribu.css';
import './sabi.css';
import { NextGameVote } from './next-game-vote';
import type { StandaloneId } from '@/lib/games/standalone/types';
import {
  adventureLessons,
  advancePractice,
  practice,
} from '@/lib/games/adventures/lessons';
import { adventureCue } from '@/lib/games/adventures/sound';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { RuleExplanation } from './extension-rules';
import { FullscreenControl } from './fullscreen-control';
import './party-table.css';
type Props = {
  g: AnyGame;
  onChange?: (g: AnyGame) => void;
  onHome: () => void;
  onNew?: () => void;
  onSound?: () => void;
  volume: number;
  viewerSeat?: number;
  online?: boolean;
  disabled?: boolean;
  onMove?: (m: AnyMove) => void;
  onLesson?: (step: number) => void;
  onAdvance?: () => void;
  onBegin?: () => void;
  canTeach?: boolean;
  /** Only the table host moves reveals on; local play always can. */
  canAdvance?: boolean;
  hostName?: string;
  /** Online, after a party match: the ten-second vote for the next game. */
  nextVote?: { endsAt: number; ballots: Record<string, StandaloneId> } | null;
  viewerId?: string;
  onNextGame?: (id: StandaloneId) => void;
};
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
function awaitingAction(g: AnyGame, seat: number) {
  if (g.over) return false;
  if (g.phase === 'reveal') return false;
  if (g.phase === 'vote') return !g.vote?.choices[seat];
  if (g.kind === 'dial')
    return g.phase === 'clue'
      ? seat === g.target
      : seat !== g.target && !g.guesses[seat]?.locked;
  if (g.kind === 'size') return g.phase === 'guess' && !g.guesses[seat].locked;
  if (g.kind === 'miro')
    return g.phase === 'guess'
      ? !g.guesses[seat].locked
      : !g.choices[g.teams[seat]].locked;
  if (g.phase === 'rank') return !g.ballots[seat]?.locked;
  return (
    seat !== g.target &&
    guessingTeams(g).includes(guessSlot(g, seat)) &&
    !g.guesses[guessSlot(g, seat)]?.locked
  );
}
export function StandaloneTable({
  g,
  onChange,
  onHome,
  onNew,
  onSound,
  volume,
  viewerSeat = 0,
  online = false,
  disabled = false,
  onMove,
  onLesson,
  onAdvance,
  onBegin,
  canTeach = true,
  canAdvance = true,
  hostName,
  nextVote,
  viewerId,
  onNextGame,
}: Props) {
  const [panel, setPanel] = useState<'menu' | 'rules' | null>(null);
  const badges = useRef<HTMLElement>(null);
  useBadgeFit(badges);
  const entry = standaloneGames[g.kind],
    view = online ? g : observe(g, viewerSeat);
  const oldPhase = useRef(g.phase);
  useEffect(() => {
    if (oldPhase.current !== g.phase)
      adventureCue(g.kind, g.phase === 'reveal' ? 'win' : 'move', volume);
    oldPhase.current = g.phase;
  }, [g.kind, g.phase, volume]);
  function commit(m: AnyMove) {
    if (disabled) return;
    if (online) onMove?.(m);
    else {
      const next = entry.play(g, m, viewerSeat);
      if (next !== g) onChange?.(next);
    }
  }
  useEffect(() => {
    if (online || g.tutorial || g.over) return;
    const s = entry.actingSeats(g).find((s) => s !== viewerSeat);
    if (s === undefined || panel) return;
    const timer = setTimeout(() => {
      const m = botMove(g, s);
      if (m) onChange?.(entry.play(g, m, s));
    }, 800);
    return () => clearTimeout(timer);
  }, [g, online, panel, entry, viewerSeat, onChange]);
  useEffect(() => {
    const due = deadline(g);
    if (online || due === null) return;
    const timer = setTimeout(
      () => {
        const next = tick(g);
        if (next !== g) onChange?.(next);
      },
      Math.max(0, due - Date.now()) + 25,
    );
    return () => clearTimeout(timer);
  }, [g, online, onChange]);
  const result = g.over ? entry.outcome(g) : null;
  const tribu = g.tribu ? seatTotals(g) : null;
  function begin() {
    if (online) onBegin?.();
    else
      onChange?.(
        entry.create(
          g.seats.length,
          seed(),
          g.difficulty,
          g.tribu ? g.tribu.mode : g.mode,
          undefined,
          g.tribu ? g.tribu.teams : g.teams,
        ),
      );
  }
  function lesson(step: number) {
    if (online) onLesson?.(step);
    else
      onChange?.(
        practice(g.kind, g.seats.length, g.difficulty, step),
      );
  }
  return (
    <div
      className={`party-table party-${g.kind} mode-${g.mode} ${setOf(g.kind) === 'orin' ? 'is-tribu' : 'is-sabi'} ${g.tutorial ? 'is-practice' : ''} ${view.kind === 'dial' || (view.kind === 'orin' && (view.phase !== 'rank' || view.ballots[viewerSeat])) ? 'has-list' : ''}`}
    >
      <GameNavigation
        name={entry.name}
        onBack={onHome}
        onMenu={() => setPanel('menu')}
        onAdvance={
          g.tutorial && canTeach
            ? () =>
                online
                  ? onAdvance?.()
                  : onChange?.(advancePractice(g, viewerSeat))
            : undefined
        }
      />
      <header className="party-players" ref={badges}>
        {g.seats.map((name, s) => (
          <div
            key={s}
            className={`party-player ${s === viewerSeat ? 'is-you' : ''} ${awaitingAction(view, s) ? 'is-active' : ''}`}
          >
            <span className={`party-avatar team-${g.teams[s]} seat-${s}`}>
              {name.slice(0, 1)}
            </span>
            <span>
              <b>
                {name}
                {s === viewerSeat ? ' · you' : ''}
              </b>
              <small>
                {tribu
                  ? `${(g.kind === 'orin' || g.kind === 'miro') && g.mode === 'teams' ? `${groupName(g, g.teams[s])} · ` : ''}${Number(tribu[s].toFixed(2))} pts`
                  : `${groupName(g, g.teams[s])} · ${Number(g.scores[g.teams[s]].toFixed(2))} pts`}
              </small>
            </span>
            <output
              className="party-action-status"
              aria-label={awaitingAction(view, s) ? 'Choosing' : 'Ready'}
            >
              {awaitingAction(view, s) ? (
                <LoaderCircle className="party-action-spinner" size={16} />
              ) : (
                <Check size={16} />
              )}
            </output>
          </div>
        ))}
      </header>
      <main className="party-main">
        {result ? (
          <PartyFinale result={result}>
            {nextVote && viewerId && onNextGame ? (
              <NextGameVote
                vote={nextVote}
                viewerId={viewerId}
                seats={g.seats.length}
                disabled={disabled}
                onVote={onNextGame}
              />
            ) : (
              <>
                <button className="party-primary" onClick={onNew ?? onHome}>
                  Play again
                </button>
                <button onClick={onHome}>Back to library</button>
              </>
            )}
          </PartyFinale>
        ) : view.phase === 'vote' && view.vote && view.vote.options ? (
          <TribuVote
            vote={view.vote}
            current={view.vote.opening ? null : view.kind}
            viewer={viewerSeat}
            disabled={disabled}
            onVote={(choice) => commit({ type: 'vote', choice })}
          />
        ) : view.phase === 'vote' && view.vote ? (
          <RoundVotePanel
            vote={view.vote}
            round={view.round}
            viewer={viewerSeat}
            seats={view.seats}
            disabled={disabled}
            onVote={(choice) => commit({ type: 'vote', choice })}
          />
        ) : view.kind === 'dial' ? (
          <DialTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
            canAdvance={canAdvance}
            hostName={hostName}
          />
        ) : view.kind === 'size' ? (
          <SizeTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
            canAdvance={canAdvance}
            hostName={hostName}
          />
        ) : view.kind === 'miro' ? (
          <GeographyTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
            canAdvance={canAdvance}
            hostName={hostName}
          />
        ) : (
          <RankingTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
            canAdvance={canAdvance}
            hostName={hostName}
          />
        )}
      </main>
      {g.tutorial && (
        <aside className="party-practice">
          <b>Practice · {g.lesson + 1}/4</b>
          <details>
            <summary>{adventureLessons[g.kind][g.lesson].title}</summary>
            <p>{adventureLessons[g.kind][g.lesson].text}</p>
          </details>
          {canTeach && (
            <div>
              <button
                disabled={g.lesson === 0}
                onClick={() => lesson(g.lesson - 1)}
              >
                Back
              </button>
              {g.lesson < 3 && (
                <button onClick={() => lesson(g.lesson + 1)}>Next</button>
              )}
              <button className="party-primary" onClick={begin}>
                Start real game
              </button>
            </div>
          )}
        </aside>
      )}
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="party-dialog">
          <DialogTitle>
            {panel === 'menu' ? entry.name : 'How to play'}
          </DialogTitle>
          <DialogDescription>
            {entry.progress(g).detail}
          </DialogDescription>
          {panel === 'menu' && (
            <div className="party-menu">
              <button onClick={() => setPanel('rules')}>
                <BookOpen />
                Rules
              </button>
              <button
                onClick={() => {
                  setPanel(null);
                  onSound?.();
                }}
              >
                <Volume2 />
                Sound
              </button>
              <FullscreenControl />
              <button onClick={onHome}>Library</button>
              {onNew && (
                <button onClick={onNew}>
                  <RotateCcw />
                  New game
                </button>
              )}
            </div>
          )}
          {panel === 'rules' && (
            <RuleExplanation
              outcome={adventureLessons[g.kind][0].title}
              note={
                g.kind === 'miro'
                  ? 'Everyone freezes all three private pins before discussion. Each team chooses all three in one turn before switching teams. Both teams confirm before any place is revealed.'
                  : g.kind === 'size'
                    ? 'Sizes are typical adult or standard figures. Country outlines come from Natural Earth, each drawn at true relative scale.'
                    : g.kind === 'dial'
                      ? 'The clue-giver stays quiet while everyone turns their dial.'
                      : 'Discuss with your team outside the app. The list owner must stay silent while teams guess.'
              }
            >
              {adventureLessons[g.kind].map((l) => (
                <p key={l.title}>
                  <b>{l.title}. </b>
                  {l.text}
                </p>
              ))}
            </RuleExplanation>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function RankingTable({
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
  const catalog = topics;
  const owner = g.phase === 'rank' ? viewer : g.target,
    ballot = g.ballots[owner],
    card = ballot ? catalog[ballot.topic] : null;
  const topic = card
    ? {
        ...card,
        answers: card.answers,
      }
    : null;
  const isOwner = g.target === viewer,
    canGuess =
      g.phase === 'guess' &&
      !isOwner &&
      guessingTeams(g).includes(guessSlot(g, viewer));
  const guess = g.guesses[guessSlot(g, viewer)];
  const locked = g.phase === 'rank' ? !!ballot?.locked : !!guess?.locked;
  const order =
    g.phase === 'rank'
      ? ballot?.order
      : g.phase === 'reveal'
        ? g.result?.order
        : canGuess
          ? guess?.order.length
            ? guess.order
            : Array.from({ length: count(g) }, (_, i) => i)
          : isOwner
            ? ballot?.order
            : [];
  const editable =
    !disabled &&
    !locked &&
    ((g.phase === 'rank' && g.kind === 'orin') || canGuess);
  const labels = tiers;
  const cap = canGuess ? captain(g, guessSlot(g, viewer)) : -1;
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
            >
              <button
                className={`topic-card ${topic?.id === id ? 'chosen' : ''}`}
                disabled={disabled || locked}
                aria-pressed={topic?.id === id}
                onClick={() => commit({ type: 'topic', target: id })}
              >
                <strong>{catalog[id].title}</strong>
                {!topic && (
                  <span className="topic-answer-chips">
                    {catalog[id].answers.slice(0, 5).map((answer) => (
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

      {g.phase !== 'rank' && (
        <div className="ranking-author">
          <span
            className={`party-avatar team-${g.teams[g.target]} seat-${g.target}`}
          >
            {g.seats[g.target].slice(0, 1)}
          </span>
          <b>{isOwner ? 'You' : g.seats[g.target]}</b>
          <span
            className="ranking-count"
            aria-label={`List ${g.target + 1} of ${g.seats.length}`}
          >
            {g.seats.map((_, s) => (
              <i
                key={s}
                className={
                  s < g.target ? 'is-done' : s === g.target ? 'is-now' : ''
                }
              />
            ))}
          </span>
        </div>
      )}
      {topic && (
        <div className="tier-paper">
          <div className="tier-paper-heading">
            <h3>{topic.title}</h3>
            {canGuess && g.mode === 'teams' && guessSlot(g, viewer) < 2 && (
              <span className="tier-paper-team">
                {guessName(g, guessSlot(g, viewer))}
              </span>
            )}
          </div>

          {g.phase === 'reveal' && g.result ? (
            <RankingReveal g={g} viewer={viewer} topic={topic} />
          ) : order && order.length > 0 ? (
            <SortableRanking
              key={`${g.round}-${g.phase}-${owner}-${topic.id}`}
              order={order}
              disabled={!editable}
              label={(id) => topic.answers[id]}
              onPreview={
                canGuess && g.mode === 'teams' && guessSlot(g, viewer) < 2
                  ? (next) => commit({ type: 'arrange', order: next })
                  : undefined
              }
              onReorder={(next) => commit({ type: 'arrange', order: next })}
              render={(answer, i) => (
                <>
                  <span className="tier-label">{labels[i]}</span>
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
      <div className="party-dock" aria-live="polite">
        {((g.phase === 'rank' && ballot) || (canGuess && cap === viewer)) &&
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
        {canGuess && cap !== viewer && (
          <span className="party-waiting">
            <LoaderCircle
              className="party-action-spinner"
              size={16}
              aria-hidden="true"
            />
            {g.seats[cap]}
          </span>
        )}
        {g.phase === 'guess' && isOwner && (
          <span
            className="party-lock-count"
            aria-label={`${guessingTeams(g).filter((t) => g.guesses[t]?.locked).length} of ${guessingTeams(g).length} guesses locked`}
          >
            {guessingTeams(g).map((t) => (
              <i key={t} className={g.guesses[t]?.locked ? 'is-locked' : ''} />
            ))}
          </span>
        )}
        {g.phase === 'reveal' &&
          (canAdvance ? (
            <button
              className="party-primary"
              disabled={disabled}
              onClick={() => commit({ type: 'next' })}
            >
              {g.target === g.seats.length - 1 ? 'End of round' : 'Next'}
              <Check size={18} />
            </button>
          ) : (
            <span className="party-waiting">
              {hostName ?? 'The host'} moves on
            </span>
          ))}
      </div>
    </section>
  );
}
