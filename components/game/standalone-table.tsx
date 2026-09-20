'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Menu,
  Users,
  LockKeyhole,
  Check,
  Sparkles,
  Volume2,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import {
  standaloneGames,
  botMove,
  observe,
  type AnyGame,
  type AnyMove,
} from '@/lib/games/standalone/registry';
import { SortableRanking } from './ranking-handle';
import { topics } from '@/lib/games/party/catalog';
import { facts } from '@/lib/games/party/facts';
import {
  tiers,
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
  const result = g.over ? entry.outcome(g) : null;
  function begin() {
    if (online) onBegin?.();
    else onChange?.(entry.create(g.seats.length, seed(), g.difficulty, g.mode));
  }
  function lesson(step: number) {
    if (online) onLesson?.(step);
    else
      onChange?.(practice(g.kind, g.seats.length, g.difficulty, step, g.mode));
  }
  return (
    <div className={`party-table party-${g.kind}`}>
      <nav className="party-nav" aria-label="Game navigation">
        <button onClick={() => setPanel('menu')}>
          <Menu size={18} />
          <span>Menu</span>
        </button>
        <button onClick={() => setPanel('others')}>
          <Users size={18} />
          <span>Others</span>
        </button>
      </nav>
      <header className="party-players">
        {g.seats.map((name, s) => (
          <div
            key={s}
            className={`party-player ${s === viewerSeat ? 'is-you' : ''} ${entry.actingSeats(view).includes(s) ? 'is-active' : ''}`}
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
                {`${groupName(g, g.teams[s])} · ${g.scores[g.teams[s]]} pts`}
              </small>
            </span>
            {!entry.actingSeats(view).includes(s) && g.phase === 'rank' && (
              <LockKeyhole size={12} />
            )}
          </div>
        ))}
      </header>
      <main className="party-main">
        <div className="party-title">
          <p>
            {entry.progress(g).label} <span>•</span>{' '}
            {g.kind === 'miro'
              ? 'ONE WORLD · THE SAME CHALLENGE FOR EVERYONE'
              : g.kind === 'vela'
                ? 'ONE OF THESE IS A FOX'
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
              <button
                onClick={() =>
                  online
                    ? onAdvance?.()
                    : onChange?.(advancePractice(g, viewerSeat))
                }
              >
                Advance time
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
                  ? 'Everyone receives the same cities and instructions. Every guess locks before the globe reveals the route.'
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
                    {entry.actingSeats(view).includes(s)
                      ? 'Choosing'
                      : 'Waiting'}
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
  const [decoyText, setDecoyText] = useState('');
  const catalog = g.kind === 'vela' ? facts : topics;
  const owner = g.phase === 'rank' ? viewer : g.target,
    ballot = g.ballots[owner],
    card = ballot ? catalog[ballot.topic] : null;
  const topic = card
    ? {
        ...card,
        answers:
          g.kind === 'vela'
            ? (ballot?.answers ?? [
                ...card.answers,
                ballot?.decoy ?? 'Your decoy',
              ])
            : card.answers,
      }
    : null;
  const team = g.teams[viewer],
    isOwner = g.target === viewer,
    canGuess =
      g.phase === 'guess' && !isOwner && guessingTeams(g).includes(team);
  const guess = g.guesses[team];
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
          : [];
  const editable =
    !disabled &&
    !locked &&
    ((g.phase === 'rank' && g.kind === 'orin') || canGuess);
  const labels = g.kind === 'vela' ? ['1', '2', '3', '4', '5', 'Fox'] : tiers;
  const cap = canGuess ? captain(g, team) : -1;
  return (
    <section className="ranking-stage">
      {g.phase === 'rank' && (
        <>
          <div className="ranking-intro">
            <span className="party-eyebrow">
              <LockKeyhole size={14} /> YOUR PRIVATE LIST
            </span>
            <h2>
              {topic
                ? g.kind === 'vela'
                  ? 'Plant a convincing fox.'
                  : 'Make it your order.'
                : g.kind === 'vela'
                  ? 'Pick one of two factual lists.'
                  : 'Pick your conversation starter.'}
            </h2>
            <p>
              {g.kind === 'vela'
                ? 'Choose a factual top five, then type one plausible answer that does not belong. Everyone prepares at once.'
                : 'One answer per tier. Your favourite at the top, your least favourite at the bottom.'}
            </p>
          </div>
          <div className={`topic-choices ${topic ? 'compact' : ''}`}>
            {g.offers[viewer]?.map((id) => (
              <button
                key={id}
                className={`topic-card ${topic?.id === id ? 'chosen' : ''}`}
                disabled={disabled || locked}
                onClick={() => {
                  setDecoyText('');
                  commit({ type: 'topic', target: id });
                }}
              >
                <span>{catalog[id].category}</span>
                <strong>{catalog[id].title}</strong>
                {!topic && (
                  <small>
                    {catalog[id].answers.slice(0, count(g)).join(' · ')}
                  </small>
                )}
                <b>{topic?.id === id ? '✓ Chosen' : 'Choose this list ↗'}</b>
              </button>
            ))}
          </div>
          {!topic && (
            <p className="catalog-note">
              {catalog.length}{' '}
              {g.kind === 'vela'
                ? 'sourced factual lists · choose one of two'
                : 'original topics · fresh choices every round'}
            </p>
          )}
        </>
      )}
      {g.kind === 'vela' && g.phase === 'rank' && topic && (
        <div className="fox-decoy-editor">
          <label htmlFor="fox-decoy">Your sixth, incorrect answer</label>
          <input
            id="fox-decoy"
            key={`${g.round}-${topic.id}`}
            maxLength={80}
            disabled={disabled || locked}
            value={decoyText}
            onChange={(event) => setDecoyText(event.target.value)}
            placeholder="A plausible answer outside this top five"
          />
          <button
            disabled={
              disabled ||
              locked ||
              !decoyText.trim() ||
              facts[ballot!.topic].answers
                .some(
                  (a) =>
                    a.toLocaleLowerCase() ===
                    decoyText.trim().toLocaleLowerCase(),
                )
            }
            onClick={() => commit({ type: 'decoy', text: decoyText })}
          >
            Use this decoy
          </button>
          {ballot?.decoy && (
            <p>
              Saved decoy: <strong>{ballot.decoy}</strong>
            </p>
          )}
        </div>
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
              ? g.kind === 'vela'
                ? 'The facts — and the fox!'
                : `${g.seats[g.target]}'s real ranking`
              : isOwner
                ? 'Keep your poker face.'
                : g.kind === 'vela'
                  ? 'Find the fox. Put the facts in order.'
                  : `Think like ${g.seats[g.target]}.`}
          </h2>
          <p>
            {g.phase === 'reveal'
              ? 'Compare your guesses, then continue together.'
              : isOwner
                ? 'Your ranking is locked. Let the other players discuss it without hints.'
                : !canGuess
                  ? 'Your opponents are guessing this list.'
                  : g.mode === 'teams'
                    ? `Your ${groupName(g, team)} shares this guess. ${g.seats[cap]} is the captain.`
                    : 'Make your own private guess. Everyone locks before the reveal.'}
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
                    ? `${groupName(g, team)}’s guess`
                    : 'The possible answers'}
            </span>
          </div>
          {order && order.length > 0 ? (
            <SortableRanking
              order={order}
              disabled={!editable}
              label={(id) => topic.answers[id]}
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
          {g.kind === 'vela' &&
            (g.phase === 'rank' || g.phase === 'reveal') &&
            ballot && (
              <aside className="fact-source">
                <p>{facts[ballot.topic].scope}</p>
                <p>
                  Values ({facts[ballot.topic].unit}):{' '}
                  {facts[ballot.topic].values
                    .map((v) =>
                      v.toLocaleString('en', { maximumFractionDigits: 6 }),
                    )
                    .join(' · ')}
                </p>
                <a
                  href={facts[ballot.topic].source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source: World Bank · {facts[ballot.topic].year}
                </a>
              </aside>
            )}
          {g.phase === 'reveal' &&
            g.result &&
            g.kind === 'vela' &&
            g.result.bluff.some(Boolean) && (
              <p className="bluff-reward">
                The Fox fooled an opponent: {groupName(g, g.teams[g.target])}{' '}
                earns {g.result.bluff[g.teams[g.target]]} bluff points.
              </p>
            )}
          {g.phase === 'reveal' && g.result && (
            <div className="guess-comparison">
              {guessingTeams(g).map((t) => (
                <div key={t}>
                  <h4>
                    {groupName(g, t)}{' '}
                    <b>+{g.result!.gains[t] + g.result!.bluff[t]}</b>
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
                    {g.result!.gains[t]} guessing points
                    {g.result!.bluff[t]
                      ? ` + ${g.result!.bluff[t]} bluff points`
                      : ''}
                  </small>
                </div>
              ))}
            </div>
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
                  Change my ranking
                </button>
              </>
            ) : (
              <>
                <span>Only you can see this order.</span>
                <button
                  className="party-primary"
                  disabled={disabled || (g.kind === 'vela' && !ballot.decoy)}
                  onClick={() => commit({ type: 'lock' })}
                >
                  <LockKeyhole size={17} />
                  {g.kind === 'vela'
                    ? 'Lock my list and decoy'
                    : 'Lock my ranking'}
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
                  ? g.mode === 'teams'
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
