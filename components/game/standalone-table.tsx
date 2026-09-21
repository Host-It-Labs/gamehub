'use client';
import { useEffect, useRef, useState } from 'react';
import {
  LockKeyhole,
  LoaderCircle,
  Check,
  Sparkles,
  Volume2,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import {
  standaloneGames,
  botMove,
  tick,
  observe,
  type AnyGame,
  type AnyMove,
} from '@/lib/games/standalone/registry';
import { GameNavigation } from './game-navigation';
import { SortableRanking } from './ranking-handle';
import { topics } from '@/lib/games/party/catalog';
import {
  tiers,
  guessSlot,
  guessName,
  guessPoints,
  captain,
  guessingTeams,
  count,
  groupName,
  type RankingGame,
} from '@/lib/games/party/ranking';
import { GeographyTable } from './geography-table';
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
};
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
function awaitingAction(g: AnyGame, seat: number) {
  if (g.over) return false;
  if (g.phase === 'reveal') return !g.ready[seat];
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
}: Props) {
  const [panel, setPanel] = useState<'menu' | 'rules' | 'others' | null>(null);
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
    if (
      online ||
      g.tutorial ||
      g.over ||
      g.kind !== 'miro' ||
      g.discussionEndsAt === null
    )
      return;
    const timer = setTimeout(
      () => {
        const next = tick(g);
        if (next !== g) onChange?.(next);
      },
      Math.max(0, g.discussionEndsAt - Date.now()) + 25,
    );
    return () => clearTimeout(timer);
  }, [g, online, onChange]);
  const result = g.over ? entry.outcome(g) : null;
  function begin() {
    if (online) onBegin?.();
    else
      onChange?.(
        entry.create(
          g.seats.length,
          seed(),
          g.difficulty,
          g.mode,
          undefined,
          g.teams,
        ),
      );
  }
  function lesson(step: number) {
    if (online) onLesson?.(step);
    else
      onChange?.(
        practice(g.kind, g.seats.length, g.difficulty, step, g.mode, g.teams),
      );
  }
  return (
    <div
      className={`party-table party-${g.kind} ${g.tutorial ? 'is-practice' : ''} ${view.kind !== 'miro' && (view.phase !== 'rank' || view.ballots[viewerSeat]) ? 'has-list' : ''}`}
    >
      <GameNavigation
        name={entry.name}
        round={{ current: g.round, total: 2 }}
        onBack={onHome}
        onMenu={() => setPanel('menu')}
        onOthers={() => setPanel('others')}
        onAdvance={
          g.tutorial && canTeach
            ? () =>
                online
                  ? onAdvance?.()
                  : onChange?.(advancePractice(g, viewerSeat))
            : undefined
        }
      />
      <header className="party-players">
        {g.seats.map((name, s) => (
          <div
            key={s}
            className={`party-player ${s === viewerSeat ? 'is-you' : ''} ${awaitingAction(view, s) ? 'is-active' : ''}`}
          >
            <span className={`party-avatar team-${g.teams[s]}`}>
              {name.slice(0, 1)}
            </span>
            <span>
              <b>
                {name}
                {s === viewerSeat ? ' · you' : ''}
              </b>
              <small>
                {`${groupName(g, g.teams[s])} · ${Number(g.scores[g.teams[s]].toFixed(2))} pts`}
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
        <div className="party-title">
          <p>
            {g.kind === 'miro'
              ? 'SIX DESTINATIONS · TRUST YOUR TEAM'
              : 'HOW WELL DO YOU KNOW THEM?'}
          </p>
          <h1>{entry.name}</h1>
        </div>
        {result ? (
          <section className="party-finale">
            <Sparkles size={48} />
            <h2>{result.title}</h2>
            <p>{result.detail}</p>
            <div className="party-scores">
              {result.rows?.map((r) => (
                <div key={r.name}>
                  <b>{r.name}</b>
                  <strong>{r.value}</strong>
                </div>
              ))}
            </div>
            <button className="party-primary" onClick={onNew ?? onHome}>
              Play again
            </button>
            <button onClick={onHome}>Back to library</button>
          </section>
        ) : view.kind === 'miro' ? (
          <GeographyTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
          />
        ) : (
          <RankingTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
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
            {panel === 'menu'
              ? entry.name
              : panel === 'rules'
                ? 'How to play'
                : 'Around the table'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'others'
              ? 'Public scores and activity. Private choices stay private.'
              : entry.progress(g).detail}
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
                  ? 'Everyone freezes all three private pins before discussion. Each team chooses all three in one turn before switching teams. Both teams confirm before any destination is revealed.'
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
          {panel === 'others' && (
            <>
              <div className="party-score-list">
                {g.seats.map((name, s) => (
                  <p key={s}>
                    <b>{name}</b> · {groupName(g, g.teams[s])} ·{' '}
                    {awaitingAction(view, s) ? 'Choosing' : 'Waiting'}
                  </p>
                ))}
              </div>
              <ol>
                {g.log.slice(-12).map((l) => (
                  <li key={l.id}>{l.text}</li>
                ))}
              </ol>
            </>
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
}: {
  g: RankingGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
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
  const team = g.teams[viewer],
    isOwner = g.target === viewer,
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
        <>
          <div className="ranking-intro">
            <span className="party-eyebrow">
              <LockKeyhole size={14} /> YOUR PRIVATE LIST
            </span>
            <h2>
              {topic
                ? 'Make it your order.'
                : 'Pick your conversation starter.'}
            </h2>
            <p>
              {
                'Rank from 1st to 5th. Your favourite at the top, your least favourite at the bottom.'
              }
            </p>
          </div>
          <div className={`topic-choices ${topic ? 'compact' : ''}`}>
            {g.offers[viewer]?.map((id) => (
              <button
                key={id}
                className={`topic-card ${topic?.id === id ? 'chosen' : ''}`}
                disabled={disabled || locked}
                aria-pressed={topic?.id === id}
                onClick={() => {
                  commit({ type: 'topic', target: id });
                }}
              >
                {!topic && <span>{catalog[id].category}</span>}
                <strong>{catalog[id].title}</strong>
                <span className="topic-answer-chips">
                  {catalog[id].answers.slice(0, 5).map((answer) => (
                    <span key={answer}>{answer}</span>
                  ))}
                </span>
                {!topic && <b>Choose this list ↗</b>}
              </button>
            ))}
          </div>
          {g.kind === 'orin' && (
            <button
              className="topic-refresh"
              disabled={disabled || locked || (g.refreshes?.[viewer] ?? 0) >= 2}
              onClick={() => commit({ type: 'refresh' })}
            >
              Refresh choices · {2 - (g.refreshes?.[viewer] ?? 0)} left
            </button>
          )}
          {!topic && (
            <p className="catalog-note">
              {catalog.length} {'original topics · fresh choices every round'}
            </p>
          )}
        </>
      )}

      {g.phase !== 'rank' && (
        <div className="ranking-intro">
          <span className="party-eyebrow">
            {g.phase === 'reveal'
              ? 'THE REVEAL'
              : `${g.target + 1} OF ${g.seats.length} LISTS`}
          </span>
          <h2>
            {g.phase === 'reveal'
              ? `${g.seats[g.target]}'s real ranking`
              : isOwner
                ? 'Keep your poker face.'
                : `Think like ${g.seats[g.target]}.`}
          </h2>
          <p>
            {g.phase === 'reveal'
              ? 'Compare your guesses, then continue together.'
              : isOwner
                ? 'Your ranking is locked. Let the other players discuss it without hints.'
                : !canGuess
                  ? 'Your opponents are guessing this list.'
                  : g.mode === 'teams' && guessSlot(g, viewer) < 2
                    ? `Your ${groupName(g, team)} shares this guess. ${g.seats[cap]} is the captain.`
                    : 'Guess silently on your own. The author must stay silent too. Everyone locks before the reveal.'}
          </p>
        </div>
      )}
      {topic && (
        <div className="tier-paper">
          <div className="tier-paper-heading">
            <span>{topic.category}</span>
            <h3>{topic.title}</h3>
            <span>
              {g.phase === 'rank'
                ? 'Your order'
                : g.phase === 'reveal'
                  ? 'True order'
                  : canGuess
                    ? `${guessName(g, guessSlot(g, viewer))}’s guess`
                    : isOwner
                      ? 'Your locked order'
                      : 'The possible answers'}
            </span>
          </div>

          {order && order.length > 0 ? (
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

          {g.phase === 'reveal' && g.result && (
            <>
              <section
                className="revealed-guesses"
                aria-label="Everyone’s guesses"
              >
                <h3>Everyone’s guesses</h3>
                {g.mode === 'teams' && g.kind === 'orin' && (
                  <p className="guess-team-summary">
                    {g.result.gains
                      .map(
                        (gain, team) =>
                          `${groupName(g, team)} +${Number(gain.toFixed(2))}${team === g.teams[g.target] ? ' (silent guesses averaged)' : ' (shared guess)'}`,
                      )
                      .join(' · ')}
                  </p>
                )}
                <div className="guess-comparison">
                  {guessingTeams(g).map((t) => (
                    <div key={t}>
                      <h4>
                        {guessName(g, t)}{' '}
                        <b>
                          +
                          {guessPoints(
                            g.result!.guesses[t]!.order,
                            g.result!.order,
                            g.kind,
                          )}
                        </b>
                      </h4>
                      <ol>
                        {g.result!.guesses[t]!.order.map((v, i) => (
                          <li
                            key={i}
                            className={
                              v === g.result!.order[i] ? 'correct' : 'incorrect'
                            }
                          >
                            <span>{labels[i]}</span>
                            {topic.answers[v]}{' '}
                            {v === g.result!.order[i] ? '✓' : '×'}
                          </li>
                        ))}
                      </ol>
                      <small>
                        {guessPoints(
                          g.result!.guesses[t]!.order,
                          g.result!.order,
                          g.kind,
                        )}{' '}
                        guessing points
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
      <div className="party-dock" aria-live="polite">
        {g.phase === 'rank' && ballot && (
          <>
            {locked ? (
              <>
                <p>
                  <LockKeyhole size={16} />
                  Locked · waiting for the other players
                </p>
                <button
                  disabled={disabled}
                  onClick={() => commit({ type: 'unlock' })}
                >
                  {'Change my ranking'}
                </button>
              </>
            ) : (
              <>
                <span>{'Only you can see this order.'}</span>
                <button
                  className="party-primary"
                  disabled={disabled}
                  onClick={() => commit({ type: 'lock' })}
                >
                  <LockKeyhole size={17} />
                  {'Lock my ranking'}
                </button>
              </>
            )}
          </>
        )}
        {canGuess &&
          (locked ? (
            <>
              <span>Guess locked. Waiting for the other players.</span>
              {cap === viewer && (
                <button
                  disabled={disabled}
                  onClick={() => commit({ type: 'unlock' })}
                >
                  Unlock
                </button>
              )}
            </>
          ) : (
            <>
              <span>
                {cap === viewer
                  ? g.mode === 'teams' && guessSlot(g, viewer) < 2
                    ? 'Discuss it, then lock your team’s guess.'
                    : 'Lock your private guess when ready.'
                  : `${g.seats[cap]} locks your shared guess.`}
              </span>
              {cap === viewer && (
                <button
                  className="party-primary"
                  disabled={disabled}
                  onClick={() => commit({ type: 'lock' })}
                >
                  Lock guess
                </button>
              )}
            </>
          ))}
        {g.phase === 'guess' && isOwner && (
          <p>
            <LockKeyhole size={16} />
            All guesses must lock before the reveal.
          </p>
        )}
        {g.phase === 'reveal' && (
          <button
            className="party-primary"
            disabled={disabled || g.ready[viewer]}
            onClick={() => commit({ type: 'ready' })}
          >
            {g.ready[viewer] ? 'Waiting for everyone…' : 'Continue'}
            <Check size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
