'use client';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, CircleHelp, Flame, Play, RotateCcw, Trophy, X } from 'lucide-react';
import { api } from '@/lib/online/client';
import { useSession } from '@/lib/online/use-session';
import {
  formatValue,
  leaderboardGame,
  leaderboardGames,
  STARTING_RATING,
  unitLabel,
  type ActiveRatedGame,
  type LeaderboardEntry,
  type LeaderboardGameId,
  type LeaderboardResponse,
  type LeaderboardView,
  type PersonalEntry,
} from '@/lib/games/leaderboards';
import { boxCover, wideCover } from '@/lib/games/box-covers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArtworkImage } from '../game/artwork';
import { Rules, RuleSection } from '../game/rules';
import { ThemeButton } from '../game/theme-control';
import { JoinSheet } from './join-sheet';
import { PlayerMark } from './player-mark';
import '../game/library.css';
import './account-forms.css';
import './leaderboards.css';

/** Where a board's Play button opens that game's setup. */
export function playHref(gameId: LeaderboardGameId) {
  return gameId === 'folio' ? '/folio' : gameId === 'relic' ? '/relic' : `/?play=${gameId}`;
}

function initialGame(): LeaderboardGameId {
  if (typeof window === 'undefined') return 'undertow';
  const id = new URLSearchParams(window.location.search).get('game');
  return leaderboardGame(id ?? '')?.id ?? 'undertow';
}
function initialView() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('view') ?? '';
}

export default function LeaderboardsPage() {
  const session = useSession();
  const [game, setGame] = useState<LeaderboardGameId>(initialGame);
  const [view, setView] = useState(initialView);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [active, setActive] = useState<ActiveRatedGame[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [joining, setJoining] = useState(false);
  const [rules, setRules] = useState(false);

  const refresh = useCallback(() => setRetry((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  useEffect(() => {
    let live = true;
    void api<ActiveRatedGame[]>('/api/solo/ranked').then(
      (runs) => live && setActive(runs),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [retry, session.user?.id]);
  useEffect(() => {
    let live = true;
    const query = `game=${encodeURIComponent(game)}${view ? `&view=${encodeURIComponent(view)}` : ''}`;
    void api<LeaderboardResponse>(`/api/leaderboards?${query}`)
      .then((result) => {
        if (!live) return;
        setBoard(result);
        setError('');
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    history.replaceState(null, '', `/leaderboards?${query}`);
    return () => {
      live = false;
    };
  }, [game, view, retry, session.user?.id]);

  const shown = board && board.game?.id === game && Array.isArray(board.views) ? board : null;
  const current = shown?.views.find((v) => v.key === shown.selectedView);
  const run = active.find((r) => r.gameId === game);
  const meta = leaderboardGame(game)!;

  function pick(next: LeaderboardGameId) {
    if (next === game) return;
    setLoading(true);
    setError('');
    setGame(next);
    setView('');
  }

  return (
    <div className="app">
      <div className="night-library lb-page">
        <header className="lib-bar lb-bar">
          <a className="lib-sound" href="/" aria-label="Back to games">
            <ArrowLeft aria-hidden="true" />
          </a>
          <h1>Leaderboards</h1>
          <div className="lib-actions">
            <button type="button" className="lib-sound" aria-label="How rankings work" onClick={() => setRules(true)}>
              <CircleHelp aria-hidden="true" />
            </button>
            <ThemeButton className="lib-sound lib-wide-only" />
            <AccountChip
              user={session.user}
              loaded={session.loaded}
              onJoin={() => setJoining(true)}
            />
          </div>
        </header>
        <main className="lb-main">
          <nav className="lb-games" aria-label="Game">
            {leaderboardGames.map((g) => (
              <button
                key={g.id}
                type="button"
                className="lb-game"
                aria-pressed={g.id === game}
                aria-label={g.name}
                onClick={() => pick(g.id)}
              >
                <ArtworkImage src={boxCover(g.id)} width={512} height={512} sizes="120px" alt="" draggable={false} />
              </button>
            ))}
          </nav>
          <div className="lb-layout">
            <aside className="lb-side">
              <YouCard
                game={meta.id}
                name={meta.name}
                how={meta.how}
                view={current}
                personal={shown?.personal ?? null}
                total={shown?.total ?? 0}
                loading={loading && !shown}
                signedIn={!!session.user}
                run={run}
                onJoin={() => setJoining(true)}
                onEnded={refresh}
              />
            </aside>
            <section className="lb-board" aria-busy={loading} aria-label={`${meta.name} leaderboard`}>
              <div className="lb-banner">
                <ArtworkImage
                  key={game}
                  src={wideCover(game) ?? boxCover(game)}
                  width={1536}
                  height={512}
                  sizes="(max-width: 900px) 100vw, 620px"
                  alt=""
                  draggable={false}
                />
              </div>
              {shown && shown.views.length > 1 && (
                <ViewTabs
                  views={shown.views}
                  selected={shown.selectedView}
                  onSelect={(key) => {
                    setLoading(true);
                    setView(key);
                  }}
                />
              )}
              {error && !shown ? (
                <div className="lb-empty">
                  <p role="alert">{error}</p>
                  <button type="button" className="acct-ghost" onClick={() => { setLoading(true); refresh(); }}>
                    <RotateCcw aria-hidden="true" /> Try again
                  </button>
                </div>
              ) : !shown ? (
                <BoardSkeleton />
              ) : (
                <Standings
                  board={shown}
                  view={current}
                  playLink={playHref(game)}
                  gameName={meta.name}
                />
              )}
            </section>
          </div>
        </main>
      </div>
      <JoinSheet
        open={joining}
        onOpenChange={setJoining}
        context={joinContext(shown?.personal ?? null, current, meta.name)}
        onJoined={(user) => {
          session.setUser(user);
          refresh();
        }}
      />
      <RankingRules open={rules} onOpenChange={setRules} />
    </div>
  );
}

function joinContext(personal: PersonalEntry | null, view: LeaderboardView | undefined, name: string) {
  if (!personal || personal.public || !view) return undefined;
  return (
    <>
      Your <b>{formatValue(personal.value)}</b> in {name} takes place <b>#{personal.rank}</b>.
    </>
  );
}

/** Signed in: your initial, to your account. A guest: a Join pill. */
export function AccountChip({
  user,
  loaded,
  onJoin,
}: {
  user: { id: string; name: string } | null;
  loaded: boolean;
  onJoin: () => void;
}) {
  if (!loaded) return <span className="lb-chip-slot" aria-hidden="true" />;
  return user ? (
    <a className="lb-chip" href="/account" aria-label={`Your account, ${user.name}`} title={user.name}>
      <PlayerMark id={user.id} name={user.name} size={32} />
    </a>
  ) : (
    <button type="button" className="lb-join-pill" onClick={onJoin}>
      <Trophy aria-hidden="true" />
      Join
    </button>
  );
}

function ViewTabs({
  views,
  selected,
  onSelect,
}: {
  views: LeaderboardView[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="lb-views" role="tablist" aria-label="Board">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={v.key === selected}
          onClick={() => v.key !== selected && onSelect(v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function metricOf(view: LeaderboardView | undefined) {
  return view?.metric ?? 'rating';
}

function Standings({
  board,
  view,
  playLink,
  gameName,
}: {
  board: LeaderboardResponse;
  view: LeaderboardView | undefined;
  playLink: string;
  gameName: string;
}) {
  const metric = metricOf(view);
  const you = board.personal;
  const podium = board.entries.slice(0, 3);
  const rest = board.entries.slice(3);
  const youShown = !!you?.public && board.entries.some((e) => e.userId === you.userId);
  if (!board.entries.length)
    return (
      <div className="lb-podium-wrap is-empty">
        <Podium entries={[]} metric={metric} you={you?.userId} />
        <div className="lb-empty">
          <h2>The first place is open</h2>
          <a className="acct-primary" href={playLink} data-starts-game>
            <Play aria-hidden="true" /> Play {gameName}
          </a>
        </div>
      </div>
    );
  return (
    <>
      <div className="lb-podium-wrap">
        <Podium entries={podium} metric={metric} you={you?.userId} />
      </div>
      {rest.length > 0 && (
        <ol className="lb-list" start={4}>
          {rest.map((entry) => (
            <Row key={entry.userId} entry={entry} metric={metric} you={entry.userId === you?.userId} />
          ))}
        </ol>
      )}
      {you && !youShown && (
        <div className={`lb-you-pinned ${you.public ? '' : 'is-private'}`}>
          <Row entry={you} metric={metric} you pinned privateRank={!you.public} />
        </div>
      )}
      <p className="lb-count">
        {board.total} {board.total === 1 ? 'player' : 'players'}
      </p>
    </>
  );
}

const medals = ['gold', 'silver', 'bronze'] as const;

function Podium({
  entries,
  metric,
  you,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardView['metric'];
  you?: string;
}) {
  // Second, first, third: the winner stands in the middle.
  const order = [1, 0, 2];
  return (
    <ol className="lb-podium" aria-label="Top three">
      {order.map((i) => {
        const entry = entries[i];
        return (
          <li
            key={i}
            className={`lb-step is-${medals[i]} ${entry && entry.userId === you ? 'is-you' : ''}`}
            style={{ '--step': i } as CSSProperties}
            aria-label={entry ? `Place ${entry.rank}: ${entry.name}, ${formatValue(entry.value)} ${unitLabel(metric, entry.value)}` : `Place ${i + 1}: open`}
          >
            <div className="lb-step-player" aria-hidden="true">
              <span className="lb-medal">
                {entry ? <PlayerMark id={entry.userId} name={entry.name} size={i === 0 ? 58 : 48} /> : <span className="lb-medal-open" />}
                {i === 0 && entry && <Trophy className="lb-crown" />}
              </span>
              <b className="lb-step-name">{entry ? entry.name : 'Open'}</b>
              {entry && (
                <span className="lb-step-value">
                  {formatValue(entry.value)}
                  {entry.streak >= 2 && (
                    <span className="lb-flame" title={`${entry.streak} wins in a row`}>
                      <Flame />
                      {entry.streak}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="lb-plinth" aria-hidden="true">
              <span>{entry?.rank ?? i + 1}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Row({
  entry,
  metric,
  you,
  pinned = false,
  privateRank = false,
}: {
  entry: LeaderboardEntry;
  metric: LeaderboardView['metric'];
  you: boolean;
  pinned?: boolean;
  privateRank?: boolean;
}) {
  const Tag = pinned ? 'div' : 'li';
  return (
    <Tag className={`lb-row ${you ? 'is-you' : ''}`}>
      <span className="lb-rank">{entry.rank}</span>
      <PlayerMark id={entry.userId} name={entry.name} size={34} />
      <span className="lb-who">
        <b>{entry.name}</b>
        {you && <small className="lb-you-tag">{privateRank ? 'You · not public yet' : 'You'}</small>}
      </span>
      {entry.streak >= 2 && (
        <span className="lb-flame" aria-label={`${entry.streak} wins in a row`}>
          <Flame aria-hidden="true" />
          {entry.streak}
        </span>
      )}
      <span className="lb-value">
        {formatValue(entry.value)}
        <small>{metric === 'rating' ? '' : unitLabel(metric, entry.value)}</small>
      </span>
    </Tag>
  );
}

function BoardSkeleton() {
  return (
    <div className="lb-skeleton" aria-hidden="true">
      <div className="lb-skeleton-podium">
        <i />
        <i />
        <i />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div className="lb-skeleton-row" key={i} />
      ))}
    </div>
  );
}

/** Your line for the chosen game: rating, place, streak and what to do next. */
function YouCard({
  game,
  name,
  how,
  view,
  personal,
  total,
  loading,
  signedIn,
  run,
  onJoin,
  onEnded,
}: {
  game: LeaderboardGameId;
  name: string;
  how: string;
  view: LeaderboardView | undefined;
  personal: PersonalEntry | null;
  total: number;
  loading: boolean;
  signedIn: boolean;
  run?: ActiveRatedGame;
  onJoin: () => void;
  onEnded: () => void;
}) {
  const metric = metricOf(view);
  const [ending, setEnding] = useState<'ask' | 'busy' | null>(null);
  const [endError, setEndError] = useState('');
  async function end() {
    if (!run) return;
    setEnding('busy');
    setEndError('');
    try {
      await api('/api/solo/ranked/abandon', { url: run.url });
      setEnding(null);
      onEnded();
    } catch (e) {
      setEnding('ask');
      setEndError(e instanceof Error ? e.message : 'This game could not be ended.');
    }
  }
  const label = metric === 'rating' ? 'Your rating' : metric === 'score' ? 'Your best score' : metric === 'puzzles' ? 'Your best run' : 'Your best desk';
  const stats = useMemo(() => {
    if (!personal) return [];
    const list = [{ k: 'Games', v: personal.games }];
    if (metric === 'rating') {
      list.push({ k: 'Wins', v: personal.wins }, { k: 'Best streak', v: personal.bestStreak });
    }
    return list;
  }, [personal, metric]);
  return (
    <section className={`lb-you ${personal && !personal.public ? 'is-guest' : ''}`} aria-label={`You in ${name}`}>
      {loading ? (
        <div className="lb-you-loading" aria-hidden="true" />
      ) : personal ? (
        <>
          <div className="lb-you-head">
            <span className="lb-you-label">{label}</span>
            <span className="lb-you-place">
              {personal.public ? `#${personal.rank} of ${total}` : `#${personal.rank} when you join`}
            </span>
          </div>
          <div className="lb-you-figure">
            <strong className="lb-you-value">
              {formatValue(personal.value)}
              {metric !== 'rating' && <small>{unitLabel(metric, personal.value)}</small>}
            </strong>
            {personal.streak >= 2 && (
              <span className="lb-you-streak">
                <Flame aria-hidden="true" /> {personal.streak} in a row
              </span>
            )}
          </div>
          {stats.length > 0 && (
            <dl className="lb-you-stats">
              {stats.map((s) => (
                <div key={s.k}>
                  <dt>{s.k}</dt>
                  <dd>{formatValue(s.v)}</dd>
                </div>
              ))}
            </dl>
          )}
          {!personal.public && !signedIn && (
            <button type="button" className="acct-primary lb-you-join" onClick={onJoin}>
              <Trophy aria-hidden="true" /> Put my name on the board
            </button>
          )}
        </>
      ) : (
        <div className="lb-you-new">
          <span className="lb-you-label">{name}</span>
          <strong className="lb-you-value is-muted">
            {metric === 'rating' ? formatValue(STARTING_RATING) : '—'}
          </strong>
          <p>{how}</p>
        </div>
      )}
      {run ? (
        <div className="lb-you-run">
          <a className="acct-primary" href={run.url}>
            <Play aria-hidden="true" />
            <span>
              Continue
              <small>
                Round {run.round} of {run.rounds} · {run.label}
              </small>
            </span>
          </a>
          {ending ? (
            <fieldset className="lb-end-ask" aria-label="End this game">
              <span>Ends as a loss</span>
              <button type="button" className="acct-ghost" disabled={ending === 'busy'} onClick={() => void end()}>
                End it
              </button>
              <button type="button" className="acct-ghost" disabled={ending === 'busy'} onClick={() => { setEnding(null); setEndError(''); }}>
                Keep
              </button>
              {endError && <p role="alert">{endError}</p>}
            </fieldset>
          ) : (
            <button type="button" className="lb-end" aria-label="End this game" onClick={() => setEnding('ask')}>
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <a className={personal ? 'acct-ghost lb-you-play' : 'acct-primary lb-you-play'} href={playHref(game)} data-starts-game>
          <Play aria-hidden="true" /> Play {name}
        </a>
      )}
    </section>
  );
}

/** How rankings work, in the shared rules pieces. */
export function RankingRules({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal lb-rules-modal">
        <DialogTitle>How rankings work</DialogTitle>
        <DialogDescription className="sr-only">What counts and how your rating moves.</DialogDescription>
        <Rules>
          <RuleSection title="Hard counts">
            <p>
              Every solo game of Nox, Mora, Yata or Rota against <b>Hard</b> bots counts on its own.
              Easy and Medium are for practice.
            </p>
          </RuleSection>
          <RuleSection title="Your rating" note="A rated game you leave stays saved. Starting a new one of the same game ends it as a loss.">
            <p>
              You start at <b>{formatValue(STARTING_RATING)}</b>. Finish above a bot and you gain; finish below it and you
              lose. <b>More bots</b> means more to win.
            </p>
          </RuleSection>
          <RuleSection title="Best results" note="Rota's extension bonus points don't count toward a map's best score.">
            <p>
              Rota alone keeps your <b>best score</b> on each map. Puzzles keeps your <b>best run</b> for each starting
              level. Lucky keeps your <b>best solo desk</b>.
            </p>
          </RuleSection>
          <RuleSection title="Your name">
            <p>
              Results count from your first game, even before you join. <b>Join</b> to show your name. Your email stays
              private.
            </p>
          </RuleSection>
        </Rules>
      </DialogContent>
    </Dialog>
  );
}
