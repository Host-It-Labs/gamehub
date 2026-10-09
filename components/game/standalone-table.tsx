'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LoaderCircle, Check, RotateCcw, Map, Blocks, Bug } from 'lucide-react';
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
import { groupName } from '@/lib/games/party/groups';
import { GeographyTable } from './geography-table';
import { DialTable } from './dial-table';
import { SizeTable } from './size-table';
import { TopFiveTable } from './top-five-table';
import { CoinsTable } from './coins-table';
import { YearTable } from './year-table';
import { OrderTable } from './order-table';
import { ImpostorTable } from './impostor-table';
import { PartyFinale } from './party-finale';
import { RoundVotePanel } from './table-vote';
import { TribuVote } from './tribu-vote';
import { GameIntro, useGameIntro } from './game-intro';
import { QuizPick } from './quiz-pick';
import { QuizIntro } from './quiz-intro';
import { seatTotals } from '@/lib/games/party/tribu';
import {
  campReady,
  triviaModeOf,
  triviaGameRoundLimit,
  triviaOf,
} from '@/lib/games/party/trivia';
import {
  TriviaBoard,
  TriviaCamp,
  TriviaScore,
  TriviaFinalScore,
} from './trivia-modes';
import { setOf, type SetGame } from '@/lib/games/party/vote';
import './tribu.css';
import './sabi.css';
import { NextGameVote } from './next-game-vote';
import type { StandaloneId } from '@/lib/games/standalone/types';
import type { NextGameVote as NextVoteState } from '@/lib/online/types';
import {
  adventureLessons,
  advancePractice,
  practice,
} from '@/lib/games/adventures/lessons';
import { gameSound } from '@/lib/games/game-sound';
import { useGameMotion } from './game-motion';
import { useGameSound } from './use-game-sound';
import { useResultsFeedback } from './results-feedback';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { PartyRules } from './party-rules';
import './party-table.css';
type Props = {
  g: AnyGame;
  onChange?: (g: AnyGame) => void;
  onHome: () => void;
  onNew?: () => void;
  /** Development review bench; never sends debug actions to a live table. */
  onDebug?: () => void;
  /** The development bench can animate its completed 3D worlds. */
  animateTriviaResults?: boolean;
  /** Sound switches, shown inline in the menu. */
  sound?: ReactNode;
  volume: number;
  viewerSeat?: number | null;
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
  /** The seat that picks what comes next when the table does not vote. */
  hostSeat?: number | null;
  /** The table's admin, who picks the next game when the table does not vote. */
  canPickNext?: boolean;
  /** Online, after a party match: the pick (or the vote) for the next game. */
  nextVote?: NextVoteState | null;
  viewerId?: string;
  onNextGame?: (id: StandaloneId) => void;
};
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
/** Whether a seat still owes the table a decision: a lock of its own, or
 * the host's pick of what comes next. */
function awaitingAction(g: AnyGame, seat: number, hostSeat: number | null) {
  if (g.over) return false;
  const trivia = triviaOf(g);
  if (
    trivia?.stage === 'camp' &&
    trivia.mode === 'expedition' &&
    !(
      trivia.rules === 2 &&
      campReady(g) &&
      trivia.completed === triviaGameRoundLimit(g)
    )
  )
    return !trivia.ready[seat] || (campReady(g) && seat === hostSeat);
  if (g.phase === 'reveal') return false;
  if (g.phase === 'vote')
    return g.vote?.host ? seat === hostSeat : !g.vote?.choices[seat];
  switch (g.kind) {
    case 'impostor':
      return !(
        g.phase === 'draw'
          ? g.sketches
          : g.phase === 'clue'
            ? g.clues
            : g.accusations
      )[seat].locked;
    case 'dial':
      return g.phase === 'clue'
        ? !g.cards[seat].locked
        : !g.guesses[seat].locked;
    case 'coins':
      return g.phase === 'answer'
        ? !g.cards[seat].locked
        : !g.guesses[seat].locked;
    case 'size':
    case 'year':
    case 'order':
      return g.phase === 'guess' && !g.guesses[seat].locked;
    case 'miro':
      return g.phase === 'guess'
        ? !g.guesses[seat].locked
        : !g.choices[g.teams[seat]].locked;
    default:
      return g.phase === 'rank'
        ? !g.ballots[seat]?.locked
        : !g.guesses[seat].locked;
  }
}
/** Only observed choices can trigger feedback: hidden opponents' answers never
 * enter this signature, and unchanged polling snapshots stay silent. */
function choiceKey(g: AnyGame, seat: number) {
  if (triviaOf(g)?.stage === 'camp')
    return JSON.stringify(triviaOf(g)?.plans[seat]);
  if (g.phase === 'vote') return JSON.stringify(g.vote?.choices);
  if (g.kind === 'orin')
    return JSON.stringify([g.ballots[seat]?.topic, g.offers[seat]]);
  if (g.kind === 'dial') return JSON.stringify(g.cards[seat]?.card);
  if (g.kind === 'coins') return JSON.stringify(g.cards[seat]?.prompt);
  if (g.kind === 'impostor') return JSON.stringify(g.accusations[seat]?.target);
  return '';
}
function moveKey(g: AnyGame, seat: number) {
  if (g.phase === 'vote') return '';
  switch (g.kind) {
    case 'orin':
      return JSON.stringify([g.ballots[seat], g.guesses[seat]]);
    case 'dial':
      return JSON.stringify([g.cards[seat]?.locked, g.guesses[seat]]);
    case 'coins':
      return JSON.stringify([g.cards[seat], g.guesses[seat]]);
    case 'miro':
      return JSON.stringify([g.guesses[seat], g.choices[g.teams[seat]]]);
    case 'impostor':
      // Strokes are drawn locally; only locks are moves worth a sound.
      return JSON.stringify([
        g.sketches[seat]?.locked,
        g.clues[seat]?.locked,
        g.accusations[seat]?.locked,
      ]);
    default:
      return JSON.stringify(g.guesses[seat]);
  }
}
/** What a table's motion and sound key on: the step being played. */
function stepKey(g: AnyGame) {
  return g.kind === 'miro'
    ? `${g.challenge}:${g.turn}`
    : 'step' in g
      ? g.step
      : g.target;
}
export function StandaloneTable({
  g,
  onChange,
  onHome,
  onNew,
  onDebug,
  animateTriviaResults,
  sound,
  volume,
  viewerSeat: providedViewerSeat = 0,
  online = false,
  disabled = false,
  onMove,
  onLesson,
  onAdvance,
  onBegin,
  canTeach = true,
  canAdvance = true,
  hostName,
  hostSeat: providedHostSeat = null,
  canPickNext = true,
  nextVote,
  viewerId,
  onNextGame,
}: Props) {
  const viewerSeat = providedViewerSeat ?? 0;
  // Locally, whoever holds the device hosts.
  const hostSeat = online ? providedHostSeat : viewerSeat;
  const [panel, setPanel] = useState<'rules' | 'progress' | null>(null);
  const badges = useRef<HTMLElement>(null);
  useBadgeFit(badges);
  const entry = standaloneGames[g.kind],
    view = online ? g : observe(g, viewerSeat);
  const trivia = triviaOf(view);
  const mode = triviaModeOf(view);
  const modeRounds = mode === 'quick' ? null : triviaGameRoundLimit(view);
  const root = useRef<HTMLDivElement>(null);
  const phase = `${g.kind}:${g.round}:${g.phase}:${g.over}:${stepKey(g)}`;
  useGameMotion(root, phase);
  useGameSound(g.kind, volume);
  const choice = choiceKey(view, viewerSeat);
  const move = moveKey(view, viewerSeat);
  const actionable =
    providedViewerSeat !== null &&
    !disabled &&
    entry.actingSeats(view).includes(viewerSeat);
  const feedback = useRef({ phase, choice, move, actionable });
  useEffect(() => {
    const previous = feedback.current;
    feedback.current = { phase, choice, move, actionable };
    // Final scores own their cue. Only a real local decision earns a turn alert.
    if (g.over || providedViewerSeat === null) return;
    if (actionable && (!previous.actionable || previous.phase !== phase))
      gameSound(g.kind, 'turn', volume);
    else if (previous.phase !== phase)
      gameSound(g.kind, g.phase === 'reveal' ? 'reveal' : 'move', volume);
    else if (previous.choice !== choice) gameSound(g.kind, 'select', volume);
    else if (previous.move !== move) gameSound(g.kind, 'move', volume);
  }, [
    choice,
    move,
    phase,
    actionable,
    providedViewerSeat,
    g.kind,
    g.phase,
    g.over,
    volume,
  ]);
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
  const intro = useGameIntro(
    view.kind as SetGame,
    view.phase,
    !!view.tribu && !view.over,
  );
  const quiz = setOf(g.kind) !== 'orin',
    SetPick = quiz ? QuizPick : TribuVote,
    SetIntro = quiz ? QuizIntro : GameIntro;
  useResultsFeedback(g.kind, g.over, !!result, volume);
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
          g.tribu?.votes ?? false,
          mode,
        ),
      );
  }
  function lesson(step: number) {
    if (online) onLesson?.(step);
    else onChange?.(practice(g.kind, g.seats.length, g.difficulty, step));
  }
  return (
    <div
      ref={root}
      className={`party-table party-${g.kind} mode-${g.mode} ${g.kind === 'impostor' ? 'is-impostor' : setOf(g.kind) === 'orin' ? 'is-tribu' : 'is-sabi'} ${trivia && mode !== 'quick' ? 'is-trivia-fixed' : ''} ${g.tutorial ? 'is-practice' : ''} ${view.kind === 'dial' || (view.kind === 'orin' && (view.phase !== 'rank' || view.ballots[viewerSeat])) ? 'has-list' : ''}`}
    >
      <GameNavigation
        name={entry.name}
        round={
          modeRounds && !g.tutorial
            ? `${Math.min(g.round, modeRounds)} / ${modeRounds}`
            : undefined
        }
        onBack={onHome}
        menu={{
          theme: 'party',
          onRules: () => setPanel('rules'),
          items: [
            ...(trivia && mode !== 'quick'
              ? [
                  {
                    label: mode === 'tower' ? 'Tower' : 'Expedition',
                    icon: mode === 'tower' ? Blocks : Map,
                    onSelect: () => setPanel('progress'),
                  },
                ]
              : []),
            ...(onNew
              ? [{ label: 'New game', icon: RotateCcw, onSelect: onNew }]
              : []),
            ...(process.env.NODE_ENV === 'development' &&
            trivia &&
            mode !== 'quick'
              ? [
                  {
                    label: 'Debug',
                    icon: Bug,
                    onSelect:
                      onDebug ??
                      (() => {
                        window.open(
                          `/trivia/lab?mode=${mode}&players=${g.seats.length}&completed=0&debug`,
                          '_blank',
                          'noopener',
                        );
                      }),
                  },
                ]
              : []),
          ],
          sound,
          onLeave: onHome,
        }}
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
            className={`party-player ${s === viewerSeat ? 'is-you' : ''} ${awaitingAction(view, s, hostSeat) ? 'is-active' : ''}`}
          >
            <span className={`party-avatar team-${g.teams[s]} seat-${s}`}>
              {name.slice(0, 1)}
            </span>
            <span>
              <b>
                {name}
                {s === viewerSeat ? ' · you' : ''}
              </b>
              <small
                data-game-motion="change"
                data-game-motion-key={tribu ? tribu[s] : g.scores[g.teams[s]]}
              >
                {trivia && mode !== 'quick' ? (
                  <TriviaScore g={view} seat={s} />
                ) : tribu && quiz && g.mode !== 'teams' ? (
                  <>
                    {Number(tribu[s].toFixed(2))}
                    <span className="party-pts"> pts</span>
                  </>
                ) : tribu ? (
                  `${(g.kind === 'orin' || g.kind === 'miro') && g.mode === 'teams' ? `${groupName(g, g.teams[s])} · ` : ''}${Number(tribu[s].toFixed(2))} pts`
                ) : g.kind === 'impostor' ? (
                  <>
                    {g.scores[s]}
                    <span className="party-pts"> pts</span>
                  </>
                ) : (
                  `${groupName(g, g.teams[s])} · ${Number(g.scores[g.teams[s]].toFixed(2))} pts`
                )}
              </small>
            </span>
            <output
              className="party-action-status"
              data-game-motion="change"
              data-game-motion-key={
                awaitingAction(view, s, hostSeat) ? 'choosing' : 'ready'
              }
              aria-label={
                awaitingAction(view, s, hostSeat) ? 'Choosing' : 'Ready'
              }
            >
              {awaitingAction(view, s, hostSeat) ? (
                <LoaderCircle className="party-action-spinner" size={16} />
              ) : (
                <Check size={16} />
              )}
            </output>
          </div>
        ))}
      </header>
      <main className="party-main" data-game-motion="stage">
        {result ? (
          <div
            className={
              trivia && mode !== 'quick' ? 'trivia-finish' : 'party-finale-wrap'
            }
          >
            {trivia && mode !== 'quick' && (
              <TriviaBoard
                g={view}
                ledger={false}
                animate={
                  process.env.NODE_ENV === 'development' && animateTriviaResults
                    ? true
                    : undefined
                }
              />
            )}
            <PartyFinale
              result={
                trivia && result.winners.length > 1
                  ? { ...result, title: 'Shared victory' }
                  : result
              }
              viewerSeat={providedViewerSeat}
              renderScore={
                trivia && mode !== 'quick'
                  ? (seat, delay) => (
                      <TriviaFinalScore g={view} seat={seat} delay={delay} />
                    )
                  : undefined
              }
            >
              {nextVote && viewerId && onNextGame ? (
                <>
                  <NextGameVote
                    vote={nextVote}
                    viewerId={viewerId}
                    seats={g.seats.length}
                    disabled={disabled || (!!nextVote.host && !canPickNext)}
                    hostName={hostName}
                    showHostWait={!trivia || mode === 'quick'}
                    onVote={onNextGame}
                  />
                  {nextVote.host && (
                    <button onClick={onHome}>Back to library</button>
                  )}
                </>
              ) : (
                <>
                  <button className="party-primary" onClick={onNew ?? onHome}>
                    Play again
                  </button>
                  <button onClick={onHome}>Back to library</button>
                </>
              )}
            </PartyFinale>
          </div>
        ) : trivia && view.phase === 'vote' && mode !== 'quick' ? (
          <TriviaCamp
            key={`${g.round}:${trivia.completed}:${mode}`}
            g={view}
            viewer={providedViewerSeat}
            disabled={disabled || providedViewerSeat === null}
            canAdvance={canAdvance}
            hostName={hostName}
            commit={commit}
          />
        ) : view.kind === 'impostor' ? (
          // Impostor keeps its reveal up while the host picks what next.
          <ImpostorTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
            canAdvance={canAdvance}
            hostName={hostName}
          />
        ) : view.phase === 'vote' && view.vote && view.vote.options ? (
          <SetPick
            vote={view.vote}
            current={view.vote.opening ? null : (view.kind as SetGame)}
            viewer={viewerSeat}
            disabled={disabled || (!!view.vote.host && !canAdvance)}
            hostName={hostName}
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
        ) : (
          <PartTable
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
            canAdvance={canAdvance}
            hostName={hostName}
          />
        )}
      </main>
      {intro && <SetIntro key={intro.key} game={intro.game} />}
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
        <DialogContent
          className={`party-dialog${panel === 'progress' ? ' trivia-progress-dialog' : ''}`}
        >
          <DialogTitle>
            {panel === 'progress'
              ? mode === 'tower'
                ? 'Tower'
                : 'Expedition'
              : 'How to play'}
          </DialogTitle>
          <DialogDescription>{entry.name}</DialogDescription>
          {panel === 'rules' && (
            <PartyRules
              kind={g.kind}
              triviaMode={mode}
              legacyTrivia={trivia?.rules !== 2}
            />
          )}
          {panel === 'progress' && (
            <div className="trivia-board-dialog">
              <TriviaBoard g={view} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The table of whichever game of the set is being played. */
function PartTable({
  g,
  ...props
}: {
  g: AnyGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  switch (g.kind) {
    case 'dial':
      return <DialTable g={g} {...props} />;
    case 'coins':
      return <CoinsTable g={g} {...props} />;
    case 'size':
      return <SizeTable g={g} {...props} />;
    case 'year':
      return <YearTable g={g} {...props} />;
    case 'order':
      return <OrderTable g={g} {...props} />;
    case 'miro':
      return <GeographyTable g={g} {...props} />;
    case 'impostor':
      return <ImpostorTable g={g} {...props} />;
    default:
      return <TopFiveTable g={g} {...props} />;
  }
}
