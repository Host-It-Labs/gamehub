'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Crown,
  Flag,
  Heart,
  Lock,
  Mountain,
  User,
  Users,
  Wand2,
} from 'lucide-react';
import {
  api,
  ApiError,
  rememberedName,
  rememberName,
  requestId,
} from '@/lib/online/client';
import {
  KINDS,
  type Action,
  type Difficulty,
  type Edit,
  type FolioSummary,
  type FolioView,
  type Kind,
  type MapNode,
} from '@/lib/games/folio/types';
import {
  ACTS,
  BOSS_EVERY,
  DIFFICULTY_NOTES,
  LEVEL_NAMES,
  PUZZLES,
  ROUNDS,
  START_LIVES,
} from '@/lib/games/folio/catalog';
import { GameNavigation } from './game-navigation';
import { RuleExplanation } from './extension-rules';
import { useBoardLeave } from './use-board-leave';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { currentAct, FolioMap, nodeTitle } from './folio-map';
import { KIND_VIEWS } from './folio-kinds/index';
import { KindIcon } from './folio-icons';
import './folio.css';

type Panel = 'menu' | 'crew' | 'help' | 'leave' | 'give-up' | null;
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Could not reach the run. Please try again.';
const inviteUrl = (token: string) =>
  `${typeof location === 'undefined' ? '' : location.origin}/folio/${token}`;
/** The generated paper-mountain plate, with a quiet wash for legibility. */
/** One line describing an edit offered after a boss. */
function editText(e: Edit, g: { map: MapNode[] }) {
  const game = PUZZLES[e.kind].name;
  if (e.type === 'strike') {
    const n = e.changes.length;
    return {
      title: `Strike ${game}`,
      detail: `${game} leaves the trail: ${n} ${n === 1 ? 'stop changes' : 'stops change'} to other games.`,
    };
  }
  const c = e.changes[0],
    node = g.map.find((m) => m.id === c.node);
  return {
    title: `Swap a stop`,
    detail: `Round ${(node?.row ?? 0) + 1}: ${game} becomes ${PUZZLES[c.to].name}.`,
  };
}
function Backdrop() {
  return <div className="folio-backdrop" aria-hidden="true" />;
}
function Lives({ lives, max }: { lives: number; max: number }) {
  return (
    <span
      className="folio-lives"
      aria-label={`${lives} of ${max} shared lives`}
    >
      {Array.from({ length: max }, (_, i) => (
        <Heart
          key={i}
          size={18}
          data-full={i < lives}
          fill={i < lives ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}
function Seats({
  seats,
  members,
}: {
  seats: number;
  members: FolioView['members'];
}) {
  return (
    <ul className="folio-seats" aria-label="Seats at this table">
      {Array.from({ length: seats }, (_, i) => {
        const m = members[i];
        return (
          <li key={i} data-taken={!!m}>
            <span className="folio-seat-chair">
              {m ? m.name.slice(0, 1).toUpperCase() : <User size={18} />}
            </span>
            <b>{m ? m.name : 'Open seat'}</b>
            <small>
              {m ? (i === 0 ? 'Host' : m.online ? 'Here' : 'Away') : 'Waiting…'}
            </small>
          </li>
        );
      })}
    </ul>
  );
}
function Run({ initial }: { initial: FolioView }) {
  const [view, setView] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [offline, setOffline] = useState(false),
    [panel, setPanel] = useState<Panel>(null),
    [picked, setPicked] = useState<MapNode | null>(null),
    [copied, setCopied] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const g = view.game,
    p = g.puzzle,
    pending = useRef(false),
    alive = useRef(true);
  const unresolved = useRef<{
    revision: number;
    requestId: string;
    action: Action;
  } | null>(null);
  const allowLeave = useBoardLeave(
    g.phase !== 'over' && g.phase !== 'lobby',
    () => setPanel('leave'),
  );
  const apply = (next: FolioView) =>
    setView((old) => (next.game.revision >= old.game.revision ? next : old));
  useEffect(() => {
    alive.current = true;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<FolioView>(`/api/folio/${initial.token}`);
        if (!cancelled) {
          apply(next);
          setOffline(false);
        }
      } catch {
        if (!cancelled) setOffline(true);
      } finally {
        if (!cancelled) timer = setTimeout(() => void poll(), 1500);
      }
    }
    void poll();
    return () => {
      cancelled = true;
      alive.current = false;
      clearTimeout(timer);
    };
  }, [initial.token]);
  /** Returns null on success, else the reason the action was refused. */
  async function send(action: Action): Promise<string | null> {
    if (pending.current) return 'One moment…';
    if (unresolved.current && action !== unresolved.current.action) {
      setError('Retry the uncertain action first. Your run is saved.');
      return 'Retry the last action first.';
    }
    pending.current = true;
    setBusy(true);
    setError('');
    const command = unresolved.current ?? {
      revision: view.game.revision,
      requestId: requestId(),
      action,
    };
    try {
      const next = await api<FolioView>(
        `/api/folio/${view.token}/commands`,
        command,
      );
      if (alive.current) {
        apply(next);
        setOffline(false);
      }
      unresolved.current = null;
      setUncertain(false);
      return null;
    } catch (e) {
      if (e instanceof ApiError) {
        unresolved.current = null;
        setUncertain(false);
        if (e.status === 409) {
          try {
            apply(await api<FolioView>(`/api/folio/${view.token}`));
          } catch {
            setOffline(true);
          }
        }
        // Puzzle moves show their own refusal on the board, like the originals.
        if (alive.current && action.type !== 'move') setError(errorText(e));
        return errorText(e);
      }
      unresolved.current = command;
      setUncertain(true);
      if (alive.current) setError(errorText(e));
      return errorText(e);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const leave = () => {
    allowLeave();
    window.location.assign('/');
  };
  const open =
    g.phase === 'map'
      ? g.at
        ? (g.map.find((n) => n.id === g.at)?.next ?? [])
        : g.map.filter((n) => n.row === 0).map((n) => n.id)
      : [];
  // A teammate may have moved the crew on; a stale path choice just lapses.
  const pick = picked && open.includes(picked.id) ? picked : null;
  const here = g.map.find((n) => n.id === g.at);
  const row = here ? here.row + 1 : 0;
  const View = p ? KIND_VIEWS[p.kind] : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(view.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Select and copy the invitation link.');
    }
  };
  const act = currentAct(g, open);
  const progress = g.practice
    ? 'Practice'
    : g.phase === 'lobby'
      ? 'Lobby'
      : `Act ${act + 1} · Round ${Math.min(ROUNDS, Math.max(1, g.phase === 'map' ? row + 1 : row))} / ${ROUNDS}`;
  const showSheet =
    !!p && !!View && ['puzzle', 'result', 'over'].includes(g.phase);
  const solvedCount = g.path.filter((s) => s.won).length;
  return (
    <main className="folio-world" data-phase={g.phase}>
      <Backdrop />
      <GameNavigation
        name="Folio"
        round={g.practice || g.phase === 'lobby' ? undefined : progress}
        progress={g.practice ? progress : undefined}
        onBack={() =>
          g.phase === 'over' || g.phase === 'lobby'
            ? leave()
            : setPanel('leave')
        }
        onMenu={() => setPanel('menu')}
        onOthers={() => setPanel('crew')}
      />
      <div className="folio-hud" aria-label="Crew and shared supplies">
        <span className="folio-crew">
          {view.members.map((m) => (
            <span
              key={m.id}
              title={`${m.name} · ${m.online ? 'here' : 'away'}`}
            >
              <i data-online={m.online} />
              {m.name}
            </span>
          ))}
        </span>
        {!g.practice && <Lives lives={g.lives} max={g.maxLives} />}
      </div>
      <div
        className="folio-stage"
        data-over-summary={(g.phase === 'over' && !g.practice) || undefined}
      >
        {g.phase === 'lobby' && (
          <section className="folio-card folio-lobby">
            <span className="folio-eyebrow">
              Table for {g.seats} · {view.members.length} seated
            </span>
            <h1>Gathering the crew</h1>
            <p>
              The run starts when every seat is taken. Then the table locks:
              only these players can play it.
            </p>
            <Seats seats={g.seats} members={view.members} />
            <div className="folio-invite-row">
              <input
                readOnly
                aria-label="Invitation link"
                value={inviteUrl(view.token)}
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => void copy()}>
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            {view.members.length < g.seats && (
              <button
                className="folio-text-button"
                disabled={busy}
                onClick={() => void send({ type: 'start' })}
              >
                Start now with {view.members.length}{' '}
                {view.members.length === 1 ? 'player' : 'players'} and lock the
                table
              </button>
            )}
            <div className="folio-lobby-map">
              <span className="folio-eyebrow">Your route</span>
              <FolioMap g={g} open={[]} act={0} />
            </div>
          </section>
        )}
        {g.phase === 'map' && (
          <section className="folio-route">
            <header className="folio-route-head">
              <span className="folio-eyebrow">
                Act {act + 1} of {ACTS} ·{' '}
                {LEVEL_NAMES[Math.min(4, g.difficulty + act)]}
              </span>
              <h1>
                {row === 0
                  ? 'Choose your first path'
                  : row % BOSS_EVERY === 0
                    ? 'A new act begins'
                    : 'Which way next?'}
              </h1>
            </header>
            <FolioMap
              g={g}
              open={open}
              picked={pick?.id}
              onPick={(n) => setPicked(n)}
              act={act}
            />
            {pick && (
              <div
                className="folio-pick"
                data-dock={pick.row % BOSS_EVERY < 2 ? 'top' : 'bottom'}
                aria-live="polite"
              >
                <span className="folio-eyebrow">
                  Round {pick.row + 1} · {LEVEL_NAMES[pick.level]}
                </span>
                <strong>
                  {pick.type === 'boss' && <Crown size={17} />}
                  {nodeTitle(pick)}
                </strong>
                <p>
                  {pick.type === 'boss'
                    ? PUZZLES[pick.kind].boss.rules
                    : `${PUZZLES[pick.kind].description}. Inspired by ${PUZZLES[pick.kind].source}.`}
                </p>
                <div className="folio-inline">
                  <button onClick={() => setPicked(null)}>Back</button>
                  <button
                    className="folio-primary"
                    disabled={busy}
                    onClick={() => void send({ type: 'node', id: pick.id })}
                  >
                    Take this path <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {showSheet && p && View && (
          <section className="folio-play-sheet" data-boss={p.boss || undefined}>
            <header className="folio-play-head">
              <div>
                <span className="folio-eyebrow">
                  {p.boss
                    ? `Boss · ${PUZZLES[p.kind].boss.name}`
                    : `${g.practice ? 'Practice' : LEVEL_NAMES[p.level]}`}
                </span>
                <h1>{PUZZLES[p.kind].name}</h1>
              </div>
              <div className="folio-play-tools">
                <button
                  className="folio-icon"
                  onClick={() => setPanel('help')}
                  aria-label={`How to play ${PUZZLES[p.kind].name}`}
                >
                  <BookOpen size={18} />
                </button>
                {p.status === 'playing' && (
                  <button
                    className="folio-icon"
                    disabled={busy || uncertain}
                    onClick={() => setPanel('give-up')}
                    aria-label="Give up this puzzle"
                    title="Give up"
                  >
                    <Flag size={17} />
                  </button>
                )}
                {process.env.NODE_ENV === 'development' &&
                  p.status === 'playing' && (
                    <button
                      className="folio-icon"
                      disabled={busy || uncertain}
                      onClick={() => void send({ type: 'dev-win' })}
                      aria-label="Development: win this puzzle"
                      title="Dev: auto-win"
                    >
                      <Wand2 size={17} />
                    </button>
                  )}
              </div>
            </header>
            <div className="folio-play-area">
              <View
                key={`${g.at ?? 'practice'}-${p.kind}`}
                p={p}
                view={p.view as never}
                busy={busy || uncertain}
                done={p.status !== 'playing'}
                move={(move) => send({ type: 'move', move })}
              />
            </div>
            {g.result && (
              <output className="folio-verdict" data-won={g.result.won}>
                <span className="folio-stamp">{g.result.won ? '✓' : '×'}</span>
                <div className="folio-verdict-copy">
                  <strong>
                    {g.result.won
                      ? p.boss
                        ? 'Boss beaten!'
                        : 'Solved!'
                      : 'Not this time'}
                  </strong>
                  <span>{g.result.message}</span>
                  {!g.result.won && g.result.answer && (
                    <span>
                      Answer: <b>{g.result.answer}</b>
                    </span>
                  )}
                </div>
                {g.phase === 'result' &&
                  (g.edits.length ? (
                    <div className="folio-rewards">
                      <span className="folio-eyebrow">
                        Change one thing on the trail ahead
                      </span>
                      {g.edits.map((e, index) => {
                        const text = editText(e, g);
                        return (
                          <button
                            key={index}
                            disabled={busy}
                            onClick={() => void send({ type: 'edit', index })}
                          >
                            <span className="folio-reward-mark">
                              <KindIcon
                                kind={
                                  e.type === 'swap' ? e.changes[0].to : e.kind
                                }
                                size={18}
                              />
                            </span>
                            <span>
                              <b>{text.title}</b>
                              <small>{text.detail}</small>
                            </span>
                          </button>
                        );
                      })}
                      <button
                        className="folio-text-button"
                        disabled={busy}
                        onClick={() => void send({ type: 'continue' })}
                      >
                        Leave the trail as it is
                      </button>
                    </div>
                  ) : (
                    <button
                      className="folio-primary"
                      disabled={busy}
                      onClick={() => void send({ type: 'continue' })}
                    >
                      Back to the map <ArrowRight size={17} />
                    </button>
                  ))}
                {g.phase === 'over' && (
                  <button
                    className="folio-primary"
                    onClick={() =>
                      g.practice
                        ? leave()
                        : document
                            .querySelector('.folio-summary')
                            ?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    {g.practice ? 'Back to Folio' : 'See the run'}{' '}
                    <ArrowRight size={17} />
                  </button>
                )}
              </output>
            )}
          </section>
        )}
        {g.phase === 'over' && !g.practice && (
          <section className="folio-card folio-summary">
            <span className="folio-stamp big">
              {g.victory ? <Flag size={40} /> : <Mountain size={40} />}
            </span>
            <span className="folio-eyebrow">
              {view.members.map((m) => m.name).join(', ')}
            </span>
            <h1>
              {g.victory ? 'You reached the summit!' : 'The trail ends here'}
            </h1>
            <p>
              {solvedCount} {solvedCount === 1 ? 'puzzle' : 'puzzles'} solved
              over {g.path.length} rounds
              {g.victory
                ? ` with ${g.lives} ${g.lives === 1 ? 'life' : 'lives'} to spare.`
                : '.'}
            </p>
            <div className="folio-summary-map">
              <FolioMap g={g} open={[]} act={act} />
            </div>
            <button className="folio-primary" onClick={leave}>
              Back to Folio <ArrowRight size={17} />
            </button>
          </section>
        )}
      </div>
      {(error || offline) && (
        <div className="folio-error" role="alert">
          {error || 'Connection lost. Reconnecting to your saved run…'}
          {uncertain && (
            <button
              disabled={busy}
              onClick={() => void send(unresolved.current!.action)}
            >
              Retry last action
            </button>
          )}
        </div>
      )}
      <Dialog
        open={panel !== null}
        onOpenChange={(o) => {
          if (!o) setPanel(null);
        }}
      >
        <DialogContent className="folio-dialog">
          <DialogTitle>
            {panel === 'crew'
              ? 'Your crew'
              : panel === 'help' && p
                ? PUZZLES[p.kind].name
                : panel === 'leave'
                  ? 'Leave the trail?'
                  : panel === 'give-up'
                    ? 'Give up this puzzle?'
                    : 'Folio'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'crew'
              ? g.phase === 'lobby'
                ? 'Share the link to fill the open seats.'
                : `This table is locked to ${view.members.length} ${view.members.length === 1 ? 'player' : 'players'}.`
              : panel === 'leave'
                ? 'Your run is saved. You can come back to it from Folio.'
                : panel === 'give-up'
                  ? g.lives > 1
                    ? 'This costs one of your two lives. After that, one more loss ends the run.'
                    : 'This is your last life: giving up ends the run.'
                  : panel === 'help' && p
                    ? `Inspired by ${PUZZLES[p.kind].source}.`
                    : 'A puzzle roguelike on one winding trail.'}
          </DialogDescription>
          {panel === 'crew' && (
            <>
              <Seats seats={g.seats} members={view.members} />
              {g.phase === 'lobby' ? (
                <div className="folio-invite-row">
                  <input
                    readOnly
                    aria-label="Invitation link"
                    value={inviteUrl(view.token)}
                    onFocus={(e) => e.target.select()}
                  />
                  <button onClick={() => void copy()}>
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              ) : (
                <p className="folio-locked">
                  <Lock size={15} /> Everyone plays the same board. Any of you
                  can make a move or pick the path, so talk it through.
                </p>
              )}
            </>
          )}
          {panel === 'help' && p && (
            <RuleExplanation
              outcome={`${p.allowance} ${p.budget}. Run out and the puzzle is lost.`}
              note={
                g.practice
                  ? 'Practice puzzles do not affect any run.'
                  : `Losing a puzzle costs a shared life. The crew has ${START_LIVES} and nothing restores them.`
              }
            >
              <p>{PUZZLES[p.kind].rules}</p>
              {p.boss && (
                <p>
                  <b>Boss · {PUZZLES[p.kind].boss.name}.</b>{' '}
                  {PUZZLES[p.kind].boss.rules}
                </p>
              )}
            </RuleExplanation>
          )}
          {panel === 'menu' && (
            <>
              <RuleExplanation
                outcome={`Beat all ${ACTS} bosses before losing ${START_LIVES} puzzles.`}
                note="The crew shares two lives: one mistake is allowed. Nothing restores a life."
              >
                <p>
                  <b>Choose.</b> Each act is three rounds and a boss. Pick the
                  next stop among the paths leading on; the tabs show the acts
                  ahead.
                </p>
                <p>
                  <b>Play.</b> Each game keeps its original rules and its own
                  limit: six guesses, four mistakes, one mine… Run out and the
                  crew loses a life.
                </p>
                <p>
                  <b>Climb.</b> This run started at{' '}
                  {LEVEL_NAMES[g.difficulty].toLowerCase()}. Every boss beaten
                  makes the next act one level harder, up to very hard. After a
                  boss, you may change one thing on the trail ahead.
                </p>
              </RuleExplanation>
              {g.struck.length > 0 && (
                <>
                  <h3>Struck from the trail</h3>
                  <p>{g.struck.map((k) => PUZZLES[k].name).join(', ')}</p>
                </>
              )}
              <button onClick={() => setPanel('leave')}>Save & leave</button>
            </>
          )}
          {panel === 'leave' && (
            <div className="folio-inline">
              <button onClick={() => setPanel(null)}>Stay</button>
              <button className="folio-primary" onClick={leave}>
                Save & leave
              </button>
            </div>
          )}
          {panel === 'give-up' && (
            <div className="folio-inline">
              <button onClick={() => setPanel(null)}>Keep playing</button>
              <button
                disabled={busy}
                className="folio-primary"
                onClick={() =>
                  void send({ type: 'give-up' }).then((e) => {
                    if (!e) setPanel(null);
                  })
                }
              >
                Give up
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
function runLabel(s: FolioSummary) {
  if (s.practice)
    return `Practice · ${PUZZLES[s.practice.kind].name}${s.practice.boss ? ' boss' : ''}`;
  if (s.phase === 'lobby')
    return `Waiting for ${s.seats - s.members.length} more`;
  if (s.phase === 'over')
    return s.victory ? 'Summit reached' : `Ended in round ${s.round}`;
  return `${LEVEL_NAMES[s.difficulty]} · Round ${Math.max(1, s.round)} of ${ROUNDS}`;
}
function Hub({ invite }: { invite?: string }) {
  const [name, setName] = useState(rememberedName),
    [seats, setSeats] = useState(1),
    [difficulty, setDifficulty] = useState<Difficulty>(1),
    [preview, setPreview] = useState<FolioView | null>(null),
    [runs, setRuns] = useState<FolioSummary[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [practice, setPractice] = useState(false),
    [showDone, setShowDone] = useState(false),
    [joined, setJoined] = useState<FolioView | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (invite) {
          const v = await api<FolioView>(`/api/folio/${invite}`);
          if (cancelled) return;
          if (v.joined) setJoined(v);
          else setPreview(v);
        } else {
          const rows = await api<FolioSummary[]>('/api/folio');
          if (!cancelled) setRuns(rows);
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [invite]);
  const trimmed = name.trim();
  async function enter(body: Record<string, unknown>) {
    if (busy) return;
    if (!trimmed) {
      setError('Enter your name first.');
      document.getElementById('folio-name')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const v = await api<FolioView>(
        invite ? `/api/folio/${invite}/join` : '/api/folio',
        { ...body, name: trimmed },
      );
      rememberName(trimmed);
      if (invite) setJoined(v);
      else window.location.assign(`/folio/${v.token}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (joined) return <Run initial={joined} />;
  const active = runs.filter((r) => r.phase !== 'over' && !r.practice);
  const done = runs.filter((r) => r.phase === 'over' || r.practice);
  const host = preview?.members[0]?.name;
  const full =
    !!preview &&
    (preview.game.phase !== 'lobby' ||
      preview.members.length >= preview.game.seats);
  const nameField = (
    <label className="folio-field">
      <span>Your name</span>
      <input
        id="folio-name"
        maxLength={30}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        placeholder="How the crew will see you"
      />
    </label>
  );
  return (
    <main className="folio-hub">
      <Backdrop />
      <a href="/" className="folio-home">
        ← Gamehub
      </a>
      <div className="folio-hub-inner">
        <div className="folio-cover">
          <img
            src="/art/optimized/box-folio-blind-v2-640.webp"
            alt="Folio — a winding paper trail into the mountains"
          />
        </div>
        <section className="folio-card folio-welcome">
          {invite ? (
            <>
              <span className="folio-eyebrow">You’re invited</span>
              <h1>
                {preview
                  ? host
                    ? `Join ${host}’s table`
                    : 'Join this table'
                  : loading
                    ? 'Opening the table…'
                    : 'Table not found'}
              </h1>
              {preview && (
                <>
                  <p>
                    A Folio run for {preview.game.seats}. Once every seat is
                    taken the table locks and the trail begins.
                  </p>
                  <Seats seats={preview.game.seats} members={preview.members} />
                  {full ? (
                    <p className="folio-locked">
                      <Lock size={15} /> This table is locked. Ask for a new
                      invitation or start your own run.
                    </p>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void enter({});
                      }}
                    >
                      {nameField}
                      <button className="folio-primary" disabled={busy}>
                        Take a seat <ArrowRight size={18} />
                      </button>
                    </form>
                  )}
                </>
              )}
              <a className="folio-text-button" href="/folio">
                Start your own run instead
              </a>
            </>
          ) : (
            <>
              <span className="folio-eyebrow">
                A puzzle roguelike · 1–3 players
              </span>
              <h1>Ten famous puzzles. One winding trail.</h1>
              <p>
                Wordle, Connections, Sudoku, Minesweeper and more, each with its
                own rules. Plan your route through four acts, beat the boss at
                the end of each, and reach the summit. You can lose only once.
              </p>
              <form
                className="folio-new"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enter({ seats, difficulty });
                }}
              >
                {nameField}
                <fieldset className="folio-seat-picker">
                  <legend>Players at this table</legend>
                  {[1, 2, 3].map((n) => (
                    <label key={n} data-on={seats === n}>
                      <input
                        type="radio"
                        name="seats"
                        checked={seats === n}
                        onChange={() => setSeats(n)}
                      />
                      <span className="folio-seat-icons" aria-hidden="true">
                        {Array.from({ length: n }, (_, i) => (
                          <User key={i} size={16} />
                        ))}
                      </span>
                      <b>{n === 1 ? 'Solo' : `${n} players`}</b>
                    </label>
                  ))}
                </fieldset>
                <label className="folio-difficulty">
                  <span>
                    Difficulty <b>{LEVEL_NAMES[difficulty]}</b>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={1}
                    value={difficulty}
                    aria-valuetext={LEVEL_NAMES[difficulty]}
                    onChange={(e) =>
                      setDifficulty(Number(e.target.value) as Difficulty)
                    }
                  />
                  <span className="folio-difficulty-ends" aria-hidden="true">
                    <i>Easy</i>
                    <i>Medium</i>
                    <i>Hard</i>
                  </span>
                  <small>{DIFFICULTY_NOTES[difficulty]}</small>
                </label>
                <button className="folio-primary" disabled={busy}>
                  {seats === 1 ? 'Start a run' : `Open a table for ${seats}`}
                  <ArrowRight size={19} />
                </button>
                {seats > 1 && (
                  <small className="folio-small">
                    You’ll get a link for the others. The run begins when all{' '}
                    {seats} seats are filled.
                  </small>
                )}
              </form>
              {active.length > 0 && (
                <div className="folio-runs">
                  <span className="folio-eyebrow">Your runs</span>
                  {active.map((s) => (
                    <a
                      key={s.token}
                      className="folio-saved"
                      href={`/folio/${s.token}`}
                    >
                      <span className="folio-saved-seats" aria-hidden="true">
                        {s.seats === 1 ? (
                          <User size={16} />
                        ) : (
                          <Users size={16} />
                        )}
                      </span>
                      <span>
                        <strong>{s.members.join(', ')}</strong>
                        <small>
                          {runLabel(s)}
                          {s.phase !== 'lobby' && ` · ${s.lives} ♥`}
                        </small>
                      </span>
                      <ArrowRight size={18} />
                    </a>
                  ))}
                </div>
              )}
              <div className="folio-hub-links">
                <button
                  className="folio-text-button"
                  onClick={() => setPractice(true)}
                >
                  Practise one game
                </button>
                {done.length > 0 && (
                  <button
                    className="folio-text-button"
                    onClick={() => setShowDone((v) => !v)}
                  >
                    {showDone ? 'Hide' : 'Show'} finished ({done.length})
                  </button>
                )}
              </div>
              {showDone &&
                done.slice(0, 8).map((s) => (
                  <a
                    key={s.token}
                    className="folio-saved done"
                    href={`/folio/${s.token}`}
                  >
                    <span>
                      <strong>{s.members.join(', ')}</strong>
                      <small>{runLabel(s)}</small>
                    </span>
                    <ArrowRight size={16} />
                  </a>
                ))}
            </>
          )}
          {error && (
            <p role="alert" className="folio-hub-error">
              {error}
            </p>
          )}
        </section>
      </div>
      <Dialog open={practice} onOpenChange={setPractice}>
        <DialogContent className="folio-dialog folio-practice-dialog">
          <DialogTitle>Practise one game</DialogTitle>
          <DialogDescription>
            A single puzzle with the same rules, outside any run. Try a boss
            variant too.
          </DialogDescription>
          {nameField}
          <div className="folio-practice-list">
            {KINDS.map((kind: Kind) => (
              <div key={kind} className="folio-practice-item">
                <span className="folio-practice-mark">
                  <KindIcon kind={kind} />
                </span>
                <span>
                  <b>{PUZZLES[kind].name}</b>
                  <small>Inspired by {PUZZLES[kind].source}</small>
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void enter({ practice: { kind, boss: false } })
                  }
                >
                  Play
                </button>
                <button
                  disabled={busy}
                  title={PUZZLES[kind].boss.rules}
                  onClick={() => void enter({ practice: { kind, boss: true } })}
                  aria-label={`${PUZZLES[kind].name} boss: ${PUZZLES[kind].boss.name}`}
                >
                  <Crown size={15} /> Boss
                </button>
              </div>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
export default function Folio({ invite }: { invite?: string }) {
  return <Hub invite={invite} />;
}
