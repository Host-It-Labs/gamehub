'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Crown,
  Dices,
  Flag,
  Heart,
  Lock,
  Mountain,
  Trash2,
  User,
  Users,
  Wand2,
  Volume2,
} from 'lucide-react';
import {
  api,
  returnPath,
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
  BOSS_EVERY,
  DIFFICULTY_NOTES,
  LEVEL_NAMES,
  PUZZLES,
  REROLL_AFTER,
} from '@/lib/games/folio/catalog';
import { useRoomTable } from '../online/room-table';
import { TableManager } from './table-manager';
import { FolioSuggestions } from './folio-suggestions';
import { useBadgeFit } from './use-fit';
import { LeaveDialog, useLeaveDialog } from './leave-dialog';
import { GameNavigation } from './game-navigation';
import { useGameMotion } from './game-motion';
import { useGameSound } from './use-game-sound';
import { useResultsFeedback, WinnerCelebration } from './results-feedback';
import { RatedResultCard } from '@/components/online/rated-result';
import { SoundToggle } from './sound-settings';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { gameSound } from '@/lib/games/game-sound';
import { boxCover } from '@/lib/games/box-covers';
import { FolioPuzzleRules, FolioRunRules } from './folio-rules';
import { useBoardLeave } from './use-board-leave';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  actOfRow,
  currentAct,
  FolioMap,
  nodeTitle,
  VoteChips,
  type Reroll,
  type Voter,
} from './folio-map';
import { KIND_VIEWS } from './folio-kinds/index';
import { KindIcon } from './folio-icons';
import { DeleteRunDialog, type SavedRun } from './setup-box';
import './folio.css';
import './party-table.css';

type Panel = 'rules' | 'crew' | 'help' | 'give-up' | null;
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Could not reach the run. Please try again.';
const inviteUrl = (token: string) =>
  `${typeof location === 'undefined' ? '' : location.origin}/folio/${token}`;
/** Each seat's colour on the map: cobalt, vermilion and leaf green. */
const CREW_COLOURS = ['#193d79', '#c5472c', '#4f8a45'];
/** Where a long name may break on a narrow tile, with a hyphen. */
const SOFT_NAMES: Partial<Record<Kind, string>> = {
  groups: 'Connec\u00adtions',
  country: 'Country out\u00adline',
  equation: 'Hidden equa\u00adtion',
  mines: 'Mine\u00adsweeper',
  nonogram: 'Nono\u00adgram',
  code: 'Code\u00adbreaker',
};
/** What striking a game does to the trail ahead, in one line. */
function strikeText(e: Edit) {
  const n = e.changes.length;
  if (!n) return 'Not on the trail ahead. It stays out of every new act.';
  const to = [...new Set(e.changes.map((c) => PUZZLES[c.to].name))];
  return `${n} ${n === 1 ? 'stop becomes' : 'stops become'} ${to.join(', ')}.`;
}
function Backdrop() {
  return <div className="folio-backdrop" aria-hidden="true" />;
}
function Lives({ lives, max }: { lives: number; max: number }) {
  return (
    <span
      className="folio-lives"
      data-game-motion="change"
      data-game-motion-key={lives}
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
  hostId,
}: {
  seats: number;
  members: FolioView['members'];
  hostId: string;
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
              {m
                ? m.id === hostId
                  ? 'Host'
                  : m.online
                    ? 'Here'
                    : 'Away'
                : 'Waiting…'}
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
    // Both belong to the stop they were made at, so they lapse when it changes.
    [rerollAt, setRerollAt] = useState<string | null>(null),
    [strikeAt, setStrikeAt] = useState<{ at: string; index: number } | null>(
      null,
    ),
    [copied, setCopied] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const g = view.game,
    p = g.puzzle,
    pending = useRef(false),
    alive = useRef(true);
  const root = useRef<HTMLElement>(null);
  const badges = useRef<HTMLSpanElement>(null);
  useBadgeFit(badges);
  useGameMotion(root, `${g.phase}:${g.at ?? 'practice'}:${p?.kind ?? ''}`);
  const [volume, setVolume] = useState(() => readAudioLevel('gamehub.folio.volume'));
  useGameSound('folio', volume);
  const isMember =
    view.joined && view.members.some((member) => member.id === view.viewerId);
  // The host plays the board, picks the path and moves the crew on; the
  // others' moves are suggestions and their picks votes, open to everyone.
  // A host who stays away hands the run to the next player still here.
  const lead = view.canLead,
    shared = view.members.length > 1;
  const hostName =
    view.members.find((m) => m.id === view.hostId)?.name ?? 'The host';
  const voterOf = (id: string): Voter | null => {
    const i = view.members.findIndex((m) => m.id === id);
    if (i < 0) return null;
    const m = view.members[i];
    return {
      id,
      name: m.name,
      initial: m.name.slice(0, 1).toUpperCase(),
      colour: CREW_COLOURS[i % CREW_COLOURS.length],
    };
  };
  const votes: Record<string, Voter[]> = {};
  if (shared)
    for (const [id, target] of Object.entries(g.votes ?? {})) {
      const voter = voterOf(id);
      if (voter) (votes[target] ??= []).push(voter);
    }
  const finalResults = g.phase === 'over' && !g.practice;
  useResultsFeedback('folio', finalResults, finalResults, volume);
  // Server snapshots are authoritative; neither a retry nor an unchanged poll
  // replays feedback. Only reveals and stage changes sound; draft edits stay silent.
  const soundKey = JSON.stringify([g.phase, g.at, p?.status, g.edits]);
  const feedback = useRef({ key: soundKey, phase: g.phase, status: p?.status });
  useEffect(() => {
    const previous = feedback.current;
    feedback.current = { key: soundKey, phase: g.phase, status: p?.status };
    if (previous.key === soundKey || finalResults) return;
    const cue =
      p?.status !== previous.status && p?.status === 'won'
        ? 'reward'
        : p?.status !== previous.status && p?.status === 'lost'
          ? 'invalid'
          : isMember &&
              g.phase !== previous.phase &&
              (g.phase === 'map' || g.phase === 'puzzle')
            ? 'turn'
            : null;
    if (cue) gameSound('folio', cue, volume);
  }, [soundKey, g.phase, p?.status, volume, finalResults, isMember]);
  const voted = useRef(0);
  /** Show this player's pick to the crew at once; best effort. */
  function vote(target: string | null) {
    if (!shared || !isMember) return;
    voted.current++;
    setView((old) => {
      const next = { ...old.game.votes };
      if (target === null) delete next[old.viewerId];
      else next[old.viewerId] = target;
      return { ...old, game: { ...old.game, votes: next } };
    });
    void api<FolioView>(`/api/folio/${view.token}/commands`, {
      revision: view.game.revision,
      requestId: requestId(),
      action: { type: 'vote', target },
    })
      .then((next) => {
        if (alive.current) apply(next);
      })
      .catch(() => {
        /* The next poll shows the crew's real picks. */
      });
  }
  const unresolved = useRef<{
    revision: number;
    requestId: string;
    action: Action;
  } | null>(null);
  // Leaving a run in progress asks once, says it is saved, and waits for a
  // move still on its way.
  const leaving = useLeaveDialog(
    () =>
      new Promise<void>((resolve) => {
        const started = Date.now();
        const check = () =>
          !pending.current || Date.now() - started > 4000
            ? resolve()
            : setTimeout(check, 60);
        check();
      }),
  );
  const allowLeave = useBoardLeave(
    g.phase !== 'over' && g.phase !== 'lobby',
    (allow) =>
      leaving.ask(() => {
        allow();
        window.location.assign(returnPath());
      }, true),
  );
  const apply = (next: FolioView) =>
    setView((old) => (next.game.revision >= old.game.revision ? next : old));
  useEffect(() => {
    alive.current = true;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const asked = voted.current;
        const next = await api<FolioView>(`/api/folio/${initial.token}`);
        if (!cancelled) {
          // A snapshot asked for before this player's last vote may not
          // have it yet; the vote's own reply shows it instead.
          if (asked === voted.current) apply(next);
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
        if (
          (action.type === 'move' || action.type === 'suggest') &&
          ('guess' in action.move || 'words' in action.move) &&
          next.game.revision > view.game.revision &&
          next.game.puzzle?.status === view.game.puzzle?.status
        )
          gameSound('folio', 'submit', volume);
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
        if (alive.current && action.type !== 'move' && action.type !== 'suggest')
          setError(errorText(e));
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
    window.location.assign(returnPath());
  };
  const exit = () =>
    g.phase === 'over' || g.phase === 'lobby'
      ? leave()
      : leaving.ask(leave, true);
  const open =
    g.phase === 'map'
      ? g.at
        ? (g.map.find((n) => n.id === g.at)?.next ?? [])
        : g.map.filter((n) => n.row === 0).map((n) => n.id)
      : [];
  // A teammate may have moved the crew on; a stale path choice just lapses.
  const pick = picked && open.includes(picked.id) ? picked : null;
  const actBoss = g.map.find(
    (n) => n.type === 'boss' && actOfRow(n.row) === currentAct(g, open),
  );
  const playedInAct = g.path.filter((s) => {
    const node = g.map.find((n) => n.id === s.id);
    return !!node && actOfRow(node.row) === currentAct(g, open);
  }).length;
  const rerollState: Reroll['state'] | null =
    g.phase !== 'map' || g.practice || !actBoss
      ? null
      : g.rerolled?.includes(actOfRow(actBoss.row))
        ? 'used'
        : view.reroll === actBoss.id
          ? 'ready'
          : playedInAct < REROLL_AFTER
            ? 'soon'
            : null;
  const canReroll = rerollState === 'ready' && lead;
  const stop = `${g.at ?? ''}:${g.phase}`;
  const rerolling = rerollAt === stop;
  const setRerolling = (on: boolean) => setRerollAt(on ? stop : null);
  const showReroll = rerolling && canReroll && !!actBoss;
  const edits = g.phase === 'result' ? g.edits : [];
  const chosen =
    strikeAt?.at === stop && edits[strikeAt.index] ? strikeAt.index : null;
  const setStrike = (index: number | null) =>
    setStrikeAt(index === null ? null : { at: stop, index });
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
  const room = useRoomTable((path) => {
    allowLeave();
    window.location.assign(path);
  });
  const act = currentAct(g, open);
  const progress = g.practice
    ? 'Practice'
    : g.phase === 'lobby'
      ? 'Lobby'
      : `${LEVEL_NAMES[Math.min(4, g.difficulty + act)]} · Round ${Math.max(1, g.phase === 'map' ? row + 1 : row)}`;
  const showSheet =
    !!p && !!View && ['puzzle', 'result', 'over'].includes(g.phase);
  const solvedCount = g.path.filter((s) => s.won).length;
  return (
    <main className="folio-world" data-phase={g.phase} ref={root}>
      <Backdrop />
      <GameNavigation
        name="Puzzles"
        round={g.practice || g.phase === 'lobby' ? undefined : progress}
        progress={g.practice ? progress : undefined}
        onBack={exit}
        menu={{
          theme: 'folio',
          onRules: () => setPanel('rules'),
          items:
            !room.table && !g.practice
              ? [
                  {
                    label: 'Players',
                    icon: Users,
                    onSelect: () => setPanel('crew'),
                  },
                ]
              : [],
          sound: (
            <SoundToggle
              Icon={Volume2}
              label="Sound effects"
              on={volume > 0}
              onChange={(on) => {
                const next = on ? 0.5 : 0;
                setVolume(next);
                saveAudioLevel(next, 'gamehub.folio.volume');
              }}
            />
          ),
          onLeave: exit,
          leaveLabel:
            g.phase === 'over' || g.phase === 'lobby'
              ? 'Leave'
              : 'Save and leave',
        }}
      />
      {room.table && (
        <TableManager
          table={room.table}
          connected={!room.error}
          disabled={room.busy || room.retry}
          theme="folio"
          dispatch={room.dispatch}
          error={room.error}
        />
      )}
      <LeaveDialog
        state={leaving}
        title="Leave the trail?"
        saved="Your run is saved. Pick it up from Puzzles."
        theme="folio"
      />
      <div className="folio-hud" aria-label="Crew and shared supplies">
        <span className="folio-crew" ref={badges}>
          {view.members.map((m) => (
            <span
              key={m.id}
              title={`${m.name} · ${m.online ? 'here' : 'away'}`}
            >
              <i data-online={m.online} />
              {shared && m.id === view.hostId && (
                <Crown
                  size={13}
                  className="folio-host-crown"
                  aria-label="Host"
                />
              )}
              <b className="folio-member-name">{m.name}</b>
              <b className="folio-member-initial" aria-label={m.name}>
                {m.name.slice(0, 1).toUpperCase()}
              </b>
            </span>
          ))}
        </span>
        {!g.practice && <Lives lives={g.lives} max={g.maxLives} />}
      </div>
      <div
        className="folio-stage"
        data-game-motion="stage"
        data-over-summary={(g.phase === 'over' && !g.practice) || undefined}
      >
        {g.phase === 'lobby' && (
          <section className="folio-card folio-lobby">
            <div className="folio-lobby-main">
              <span className="folio-eyebrow">
                Table for {g.seats} · {view.members.length} seated
              </span>
              <h1>Gathering the crew</h1>
              <p>
                The run starts when every seat is taken. Then the table locks:
                only these players can play it.
              </p>
              <Seats seats={g.seats} members={view.members} hostId={view.hostId} />
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
              {view.members.length < g.seats && lead && (
                <button
                  className="folio-text-button"
                  disabled={busy}
                  onClick={() => void send({ type: 'start' })}
                >
                  Start now with {view.members.length}{' '}
                  {view.members.length === 1 ? 'player' : 'players'} and lock
                  the table
                </button>
              )}
            </div>
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
                {LEVEL_NAMES[Math.min(4, g.difficulty + act)]}
              </span>
              <h1>
                {row === 0
                  ? 'Choose your first path'
                  : row % BOSS_EVERY === 0
                    ? 'Choose your path'
                    : 'Which way next?'}
              </h1>
            </header>
            <FolioMap
              g={g}
              open={open}
              picked={pick?.id}
              onPick={(n) => {
                setRerolling(false);
                setPicked(n);
                vote(n.id);
              }}
              act={act}
              votes={votes}
              reroll={
                rerollState
                  ? {
                      state: rerollState,
                      picked: showReroll,
                      onReroll: canReroll
                        ? () => {
                            setPicked(null);
                            setRerolling(true);
                          }
                        : undefined,
                    }
                  : undefined
              }
            />
            {showReroll && actBoss && (
              <div
                className="folio-pick"
                data-game-motion="change"
                data-game-motion-key="reroll"
                data-dock="bottom"
                aria-live="polite"
              >
                <span className="folio-eyebrow">
                  Boss · {PUZZLES[actBoss.kind].boss.name}
                </span>
                <strong>
                  <Dices size={18} /> Reroll the boss
                </strong>
                <p>
                  {PUZZLES[actBoss.kind].name} becomes another game. Once per
                  act.
                </p>
                <div className="folio-inline">
                  <button onClick={() => setRerolling(false)}>Back</button>
                  <button
                    className="folio-primary"
                    disabled={busy}
                    onClick={() =>
                      void send({ type: 'reroll' }).then((e) => {
                        if (!e) setRerolling(false);
                      })
                    }
                  >
                    Reroll <Dices size={17} />
                  </button>
                </div>
              </div>
            )}
            {pick && !showReroll && (
              <div
                className="folio-pick"
                data-game-motion="change"
                data-game-motion-key={pick.id}
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
                  <button
                    onClick={() => {
                      setPicked(null);
                      vote(null);
                    }}
                  >
                    Back
                  </button>
                  {lead ? (
                    <button
                      className="folio-primary"
                      disabled={busy}
                      onClick={() => void send({ type: 'node', id: pick.id })}
                    >
                      Take this path <ArrowRight size={17} />
                    </button>
                  ) : (
                    <span className="folio-host-wait">
                      <Crown size={15} aria-hidden="true" /> {hostName} picks
                    </span>
                  )}
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
                {p.status === 'playing' && lead && (
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
                  p.status === 'playing' &&
                  lead && (
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
                // Only the host plays; everyone else's move is a suggestion.
                move={(move) =>
                  send(
                    lead || !shared
                      ? { type: 'move', move }
                      : { type: 'suggest', move },
                  )
                }
              />
            </div>
            {shared && p.status === 'playing' && (
              <FolioSuggestions
                p={p}
                suggestions={g.suggestions ?? []}
                voterOf={voterOf}
                viewerId={view.viewerId}
                lead={lead}
                busy={busy || uncertain}
                onAccept={(id) => void send({ type: 'accept', id })}
                onDismiss={(id) => void send({ type: 'dismiss', id })}
              />
            )}
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
                  (edits.length ? (
                    <div className="folio-rewards">
                      <span className="folio-eyebrow">Remove a game</span>
                      <div className="folio-strikes">
                        {KINDS.map((kind) => {
                          const index = edits.findIndex(
                            (e) => e.type === 'strike' && e.kind === kind,
                          );
                          const out = g.struck.includes(kind);
                          return (
                            <button
                              key={kind}
                              type="button"
                              disabled={busy || index < 0}
                              data-struck={out || undefined}
                              aria-pressed={chosen === index && index >= 0}
                              aria-label={`${out ? 'Already removed: ' : index < 0 ? 'Cannot be removed now: ' : 'Remove '}${PUZZLES[kind].name}`}
                              onClick={() => {
                                const next = chosen === index ? null : index;
                                setStrike(next);
                                vote(next === null ? null : `edit:${next}`);
                              }}
                            >
                              <VoteChips
                                voters={
                                  index >= 0
                                    ? (votes[`edit:${index}`] ?? [])
                                    : []
                                }
                              />
                              <KindIcon kind={kind} size={20} />
                              <small>
                                {SOFT_NAMES[kind] ?? PUZZLES[kind].name}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                      {chosen !== null && (
                        <small className="folio-strike-note">
                          {strikeText(edits[chosen])}
                        </small>
                      )}
                      <div className="folio-inline">
                        {lead ? (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => void send({ type: 'continue' })}
                            >
                              <VoteChips voters={votes.keep ?? []} />
                              Keep all
                            </button>
                            <button
                              className="folio-primary"
                              disabled={busy || chosen === null}
                              onClick={() =>
                                chosen !== null &&
                                void send({ type: 'edit', index: chosen })
                              }
                            >
                              Remove
                              {chosen !== null &&
                                ` ${PUZZLES[edits[chosen].kind].name}`}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-pressed={g.votes?.[view.viewerId] === 'keep'}
                              onClick={() => {
                                const keep =
                                  g.votes?.[view.viewerId] !== 'keep';
                                setStrike(null);
                                vote(keep ? 'keep' : null);
                              }}
                            >
                              <VoteChips voters={votes.keep ?? []} />
                              Keep all
                            </button>
                            <span className="folio-host-wait">
                              <Crown size={15} aria-hidden="true" /> {hostName}{' '}
                              picks
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : lead ? (
                    <button
                      className="folio-primary"
                      disabled={busy}
                      onClick={() => void send({ type: 'continue' })}
                    >
                      Back to the map <ArrowRight size={17} />
                    </button>
                  ) : (
                    <span className="folio-host-wait folio-verdict-wait">
                      <Crown size={15} aria-hidden="true" /> {hostName} moves on
                    </span>
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
                    {g.practice ? 'Back to Puzzles' : 'See the run'}{' '}
                    <ArrowRight size={17} />
                  </button>
                )}
              </output>
            )}
          </section>
        )}
        {g.phase === 'over' && !g.practice && (
          <section className="folio-card folio-summary results-surface">
            <WinnerCelebration won={isMember && g.victory} />
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
              {!g.victory && `, up to act ${act + 1}`}
              {g.victory
                ? ` with ${g.lives} ${g.lives === 1 ? 'life' : 'lives'} to spare.`
                : '.'}
            </p>
            <div className="folio-summary-map">
              <FolioMap g={g} open={[]} act={act} />
            </div>
            {g.seats === 1 && <RatedResultCard url={`/folio/${view.token}`} finished />}
            <button className="folio-primary" onClick={leave}>
              Back to Puzzles <ArrowRight size={17} />
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
              ? 'Players'
              : panel === 'help' && p
                ? PUZZLES[p.kind].name
                : panel === 'give-up'
                  ? 'Give up this puzzle?'
                  : 'How to play'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'crew'
              ? g.phase === 'lobby'
                ? 'Share the link to fill the open seats.'
                : `This table is locked to ${view.members.length} ${view.members.length === 1 ? 'player' : 'players'}.`
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
              <Seats seats={g.seats} members={view.members} hostId={view.hostId} />
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
                  <Lock size={15} /> {hostName} plays the shared board and
                  picks the path. Your moves go to them as suggestions; tap a
                  stop to vote.
                </p>
              )}
            </>
          )}
          {panel === 'help' && p && (
            <FolioPuzzleRules puzzle={p} practice={!!g.practice} />
          )}
          {panel === 'rules' && (
            <FolioRunRules difficulty={g.difficulty} struck={g.struck} />
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
  return `${LEVEL_NAMES[s.difficulty]} · Round ${Math.max(1, s.round)}`;
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
    [doomed, setDoomed] = useState<SavedRun | null>(null),
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
            src={boxCover('folio')?.replace('.webp', '-640.webp')}
            alt="Puzzles"
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
                    A Puzzles run for {preview.game.seats}. Once every seat is
                    taken the table locks and the trail begins.
                  </p>
                  <Seats
                    seats={preview.game.seats}
                    members={preview.members}
                    hostId={preview.hostId}
                  />
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
                own rules. Plan your route, beat the boss at the end of each
                act, and climb as far as you can. You can lose only once.
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
                    <div key={s.token} className="folio-saved-row">
                      <a className="folio-saved" href={`/folio/${s.token}`}>
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
                      <button
                        type="button"
                        className="folio-saved-delete"
                        aria-label={`Delete run: ${s.members.join(', ')}, ${runLabel(s)}`}
                        onClick={() =>
                          setDoomed({
                            key: s.token,
                            href: `/folio/${s.token}`,
                            label: runLabel(s),
                            title: s.members.join(', '),
                            detail: runLabel(s),
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <DeleteRunDialog
                run={doomed}
                noun="run"
                onClose={() => setDoomed(null)}
                onDelete={async (token) => {
                  await api(`/api/folio/${token}/delete`, {});
                  setRuns((rows) => rows.filter((r) => r.token !== token));
                }}
              />
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
