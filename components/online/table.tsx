'use client';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import { useBoardLeave } from '../game/use-board-leave';
import { AdventureMatch } from './adventure-match';
import { onlineCatalog } from '@/lib/online/catalog';
import { decisionKey } from '@/lib/games/trio/engine';
import { gameByLibraryId } from '@/lib/games/library-fixtures';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  ArrowLeft,
  Bot,
  Crown,
  EllipsisVertical,
  Flag,
  Link2,
  LogOut,
  Moon,
  Play,
  Settings2,
  Trees,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import {
  api,
  ApiError,
  rememberedName,
  rememberName,
  requestId,
  joinTable,
  withDevSession,
} from '@/lib/online/client';
import {
  type Command,
  type Member,
  type Table,
  type TableCommand,
} from '@/lib/online/types';
import { OnlineMatch } from './match';
import { setTheme, useTheme } from '@/lib/theme';
import { LobbyGames, SharedLesson, type Launch } from './lobby-games';
import { GameBox } from '../game/game-box';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import '../game/library.css';
import './table-lobby.css';

/** A removed or closed table leads back to the home page. */
function goHome() {
  window.location.replace('/');
}
/** Folio and Relic link back to the table that sent the players there. */
function followHandoff(invite: string, url: string, at?: number) {
  try {
    sessionStorage.setItem(`gamehub.return-table.${url}`, `/table/${invite}`);
    if (at) sessionStorage.setItem(`gamehub.handoff.${url}`, String(at));
  } catch {
    /* The room still opens without the way back. */
  }
  window.location.assign(url);
}
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export function SharedTable({ invite }: { invite: string }) {
  const [leaving, setLeaving] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  function requestLeave() {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setLeaving(true);
  }
  const [table, setTable] = useState<Table | null>(null),
    [needsName, setNeedsName] = useState(false),
    [name, setName] = useState(rememberedName),
    [error, setError] = useState(''),
    [fatal, setFatal] = useState(false),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false),
    [copied, setCopied] = useState(false);
  const allowLeave = useBoardLeave(
    !!(table?.game || table?.adventure),
    requestLeave,
  );
  const pending = useRef<Command | null>(null),
    current = useRef<Table | null>(null),
    sending = useRef(false);
  function accept(t: Table) {
    if (!current.current || t.revision >= current.current.revision) {
      current.current = t;
      setTable(t);
    }
  }
  useEffect(() => {
    let active = true;
    const stored = rememberedName();
    void joinTable<Table>(invite, stored)
      .then((t) => {
        if (active) {
          current.current = t;
          setTable(t);
        }
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && [404, 410].includes(e.status)) goHome();
        else if (e instanceof ApiError && e.status === 400 && !stored)
          setNeedsName(true);
        else {
          setError(e.message);
          setFatal(e instanceof ApiError && e.status === 409);
        }
      });
    return () => {
      active = false;
    };
  }, [invite]);
  const joined = !!table;
  useEffect(() => {
    if (!joined) return;
    const events = new EventSource(
      withDevSession(`/api/tables/${invite}/events`),
    );
    events.onmessage = (event) => {
      const t = JSON.parse(event.data) as Table;
      accept(t);
      setConnected(true);
      if (t.status === 'closed') events.close();
    };
    events.onerror = () => {
      setConnected(false);
      void api<Table>(`/api/tables/${invite}`)
        .then(accept)
        .catch((error) => {
          if (!(error instanceof ApiError)) return;
          if ([404, 410].includes(error.status)) {
            events.close();
            goHome();
          } else if ([401, 403].includes(error.status)) {
            events.close();
            setFatal(true);
            setError(error.message);
          }
        });
    };
    events.addEventListener('gone', () => {
      events.close();
      goHome();
    });
    events.addEventListener('revoked', () => {
      events.close();
      setConnected(false);
      setError('Your seat has changed. Reopen the invite to join.');
      setFatal(true);
    });
    return () => {
      events.close();
    };
  }, [invite, joined]);
  useEffect(() => {
    if (table?.status === 'closed') goHome();
  }, [table?.status]);
  // Everyone follows the host into Folio or Relic once; latecomers get a card.
  const handoff = table?.handoff;
  useEffect(() => {
    if (!handoff || Date.now() - handoff.at > 60_000) return;
    try {
      if (sessionStorage.getItem(`gamehub.handoff.${handoff.url}`) === String(handoff.at)) return;
    } catch {
      return;
    }
    followHandoff(invite, handoff.url, handoff.at);
  }, [invite, handoff]);
  async function join(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const t = await api<Table>(`/api/tables/${invite}/join`, { name });
      rememberName(name.trim());
      accept(t);
      setNeedsName(false);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && [404, 410].includes(e.status)) goHome();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openTestPlayer() {
    // Open synchronously so the popup blocker sees the click, then point it at the seat.
    const tab = window.open('about:blank', '_blank');
    // A blocked popup would otherwise leave a disconnected seat that stalls the start.
    if (!tab) {
      setError('Allow popups for this site to open a test player tab.');
      return;
    }
    try {
      const { session } = await api<{ session: string }>(
        `/api/tables/${invite}/dev-player`,
        {},
      );
      tab.location.href = `/table/${invite}#dev-session=${session}`;
    } catch (e) {
      tab.close();
      setError((e as Error).message);
    }
  }
  async function dispatch(action?: TableCommand): Promise<boolean> {
    if (sending.current || !current.current || (!action && !pending.current))
      return false;
    sending.current = true;
    const drafting =
      action?.type === 'adventure-move' && action.move.type === 'arrange';
    if (!drafting) setBusy(true);
    setError('');
    if (!pending.current && action)
      pending.current = {
        requestId: requestId(),
        revision: current.current.revision,
        matchId: current.current.matchId,
        action,
      };
    try {
      const result = await api<Table | { left: true }>(
        `/api/tables/${invite}/commands`,
        pending.current,
      );
      pending.current = null;
      setRetry(false);
      if ('left' in result) window.location.assign('/');
      else accept(result);
      return true;
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) {
        pending.current = null;
        setRetry(false);
        try {
          accept(await api<Table>(`/api/tables/${invite}`));
        } catch {
          /* Show original action error. */
        }
      } else {
        setRetry(true);
        setError('Connection lost. Retry to check your last action.');
      }
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function launch(choice: Launch) {
    setError('');
    try {
      const { url, at } = await api<{ url: string; at: number }>(
        `/api/tables/${invite}/launch`,
        choice,
      );
      followHandoff(invite, url, at);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/table/${invite}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy the link from the address bar.');
    }
  }
  const disabled = busy || retry || !connected || fatal;
  const notice = error && (
    <div className="online-notice" role="alert">
      {error}
      {retry && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void dispatch()}
        >
          Retry
        </button>
      )}
      {!table && !needsName && !fatal && (
        <button className="secondary" onClick={() => window.location.reload()}>
          Reconnect
        </button>
      )}
    </div>
  );
  if (!table || table.status === 'closed')
    return (
      <div className="app">
        <div className="night-library table-room">
          <header className="lib-bar">
            <a className="room-back" href="/" aria-label="Home">
              <ArrowLeft aria-hidden="true" />
            </a>
          </header>
          {notice}
          <main className="room-join">
            {needsName ? (
              <form onSubmit={join}>
                <h1>Take a seat</h1>
                <input
                  aria-label="Your name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  maxLength={30}
                />
                <button className="lib-friends" disabled={busy}>
                  Join
                </button>
              </form>
            ) : (
              <output className="room-joining" aria-busy={!error} />
            )}
          </main>
        </div>
      </div>
    );
  const owner = table.members.find((m) => m.owner);
  const title = owner ? `${owner.name}’s table` : 'Table';
  const me = table.members.find((m) => m.id === table.viewerId && !m.bot);
  const home = table.isHost ? '/tables' : '/';
  const menu = (
    <RoomMenu
      table={table}
      me={me}
      disabled={disabled}
      dispatch={dispatch}
      onTestPlayer={openTestPlayer}
    />
  );
  return (
    <div
      className={`app ${table.game || table.adventure ? `at-table ${table.gameId}` : ''}`}
    >
      {table.status === 'lobby' ? (
        <div className="night-library table-room">
          <header className="lib-bar">
            <a className="room-back" href={home} aria-label="Back">
              <ArrowLeft aria-hidden="true" />
            </a>
            <h1 className="room-title">{title}</h1>
            <div className="lib-actions">
              <output
                className={`room-live ${connected ? 'is-connected' : ''}`}
                aria-label={connected ? 'Connected' : 'Reconnecting'}
              />
              <button className="lib-friends" onClick={copy}>
                <Link2 aria-hidden="true" />
                <span>{copied ? 'Copied' : 'Invite'}</span>
              </button>
              {menu}
            </div>
          </header>
          {notice}
          <main className="lib-main room-main">
            <Seats table={table} disabled={disabled} dispatch={dispatch} />
            {table.handoff && (
              <Handoff
                url={table.handoff.url}
                kind={table.handoff.kind}
                onJoin={() => followHandoff(invite, table.handoff!.url)}
              />
            )}
            <LobbyGames
              error={error}
              table={table}
              disabled={disabled}
              dispatch={dispatch}
              onLaunch={launch}
            />
          </main>
        </div>
      ) : (
        <>
          {notice}
          {table.isHost && (
            <details
              className="online-session table-session playing-session host-session"
              key={table.status}
            >
              <summary>
                <span className="playing-session-trigger">
                  <Settings2 size={16} aria-hidden="true" />
                  Table
                  <span
                    className={`table-connection-dot ${connected ? 'is-connected' : ''}`}
                    aria-label={connected ? 'Connected' : 'Reconnecting'}
                  />
                </span>
              </summary>
              <section className="online-card table-lobby">
                <ul className="member-list">
                  {table.members.map((m) => (
                    <li key={`${m.id}-${m.bot}`}>
                      <span
                        className={`presence ${m.connected ? 'present' : ''}`}
                      />
                      <span>
                        {m.name}
                        {m.host && !m.bot && <small>Leads</small>}
                      </span>
                      {!m.host &&
                        !m.bot &&
                        !m.connected &&
                        m.seat !== null &&
                        table.status === 'playing' &&
                        !requiresHumanPlayers(table.gameId) && (
                          <button
                            className="secondary"
                            disabled={disabled}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Replace ${m.name} with a bot for this match?`,
                                )
                              )
                                void dispatch({
                                  type: 'replace',
                                  memberId: m.id,
                                });
                            }}
                          >
                            <Bot size={15} aria-hidden="true" /> Bot
                          </button>
                        )}
                    </li>
                  ))}
                </ul>
                <div className="online-actions">
                  <button
                    className="primary"
                    disabled={disabled}
                    onClick={() => {
                      if (
                        table.status === 'finished' ||
                        window.confirm('End this match for everyone?')
                      )
                        void dispatch({ type: 'abandon' });
                    }}
                  >
                    Back to lobby
                  </button>
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() => {
                      if (window.confirm('Close this table for everyone?'))
                        void dispatch({ type: 'close' });
                    }}
                  >
                    Close table
                  </button>
                </div>
              </section>
            </details>
          )}
          {table.botError && (
            <p className="online-notice" role="alert">
              A bot paused.
              {table.isHost && (
                <button
                  className="secondary"
                  disabled={disabled}
                  onClick={() => void dispatch({ type: 'retry-bot' })}
                >
                  Retry
                </button>
              )}
            </p>
          )}
          {table.game?.tutorial && (
            <SharedLesson
              table={table}
              disabled={disabled}
              dispatch={dispatch}
            />
          )}
          {table.adventure && table.viewerSeat !== null && (
            <AdventureMatch
              key={table.matchId}
              table={table}
              disabled={disabled}
              dispatch={dispatch}
              onHome={requestLeave}
            />
          )}
          {table.game && table.viewerSeat !== null ? (
            <OnlineMatch
              onHome={requestLeave}
              key={table.matchId}
              connectionStatus={
                fatal
                  ? 'Connection unavailable'
                  : !connected
                    ? 'Reconnecting…'
                    : retry
                      ? 'Move unconfirmed · retry to check'
                      : busy
                        ? 'Saving your move…'
                        : undefined
              }
              ambienceEnabled={table.ambienceEnabled}
              g={table.game}
              viewer={table.viewerSeat}
              disabled={disabled}
              send={(move) =>
                dispatch({
                  type: 'move',
                  move,
                  decision: decisionKey(table.game!),
                })
              }
            />
          ) : (
            !table.adventure && (
              <div className="night-library table-room">
                <header className="lib-bar">
                  <a className="room-back" href={home} aria-label="Back">
                    <ArrowLeft aria-hidden="true" />
                  </a>
                  <h1 className="room-title">{title}</h1>
                  <div className="lib-actions">{menu}</div>
                </header>
                <main className="room-join">
                  <Waiting gameId={table.gameId} />
                </main>
              </div>
            )
          )}
        </>
      )}
      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent className="modal help-modal" finalFocus={returnFocus}>
          <DialogTitle>Leave the match?</DialogTitle>
          <DialogDescription>Your seat stays yours.</DialogDescription>
          <button className="primary" onClick={() => setLeaving(false)}>
            Stay
          </button>
          <button
            className="secondary"
            onClick={() => {
              allowLeave();
              window.location.href = home;
            }}
          >
            Leave
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The people at the table, as seats; empty seats all look alike, whether a
 *  bot or a friend will fill them. */
function Seats({
  table,
  disabled,
  dispatch,
}: {
  table: Table;
  disabled: boolean;
  dispatch: (action: TableCommand) => Promise<boolean>;
}) {
  const people = table.members.filter((m) => !m.bot);
  const empty = Math.max(0, table.capacity - people.length);
  const bots = !requiresHumanPlayers(table.gameId);
  return (
    <ul className="room-seats" aria-label="Players">
      {people.map((m) => (
        <Seat
          key={m.id}
          member={m}
          you={m.id === table.viewerId}
          manage={table.isHost && !m.owner}
          disabled={disabled}
          dispatch={dispatch}
        />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <li
          key={`empty-${i}`}
          className="room-seat is-empty"
          aria-label={bots ? 'Bot seat' : 'Open seat'}
        >
          <span className="room-avatar" aria-hidden="true">
            <UserPlus />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Seat({
  member: m,
  you,
  manage,
  disabled,
  dispatch,
}: {
  member: Member;
  you: boolean;
  manage: boolean;
  disabled: boolean;
  dispatch: (action: TableCommand) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const face = (
    <>
      <span className="room-avatar" aria-hidden="true">
        {initial(m.name)}
        {m.owner && (
          <i className="room-mark is-host">
            <Crown />
          </i>
        )}
        {m.nextHost && (
          <i className="room-mark is-leader">
            <Flag />
          </i>
        )}
      </span>
      <b>{m.name}</b>
    </>
  );
  const label = `${m.name}${you ? ' (you)' : ''}${m.owner ? ', host' : ''}${m.nextHost ? ', leads the next game' : ''}${m.connected ? '' : ', offline'}`;
  const className = `room-seat ${m.connected ? '' : 'is-away'} ${you ? 'is-you' : ''}`;
  if (!manage)
    return (
      <li className={className} aria-label={label}>
        {face}
      </li>
    );
  function act(action: TableCommand) {
    setOpen(false);
    void dispatch(action);
  }
  return (
    <li className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="room-seat-button"
          aria-label={label}
          disabled={disabled}
        >
          {face}
        </PopoverTrigger>
        <PopoverContent className="room-menu" align="center">
          <button
            onClick={() => act({ type: 'host', memberId: m.id })}
            aria-pressed={!!m.nextHost}
          >
            <Flag aria-hidden="true" />
            {m.nextHost ? 'Don’t lead' : 'Lead next game'}
          </button>
          <button
            className="is-danger"
            onClick={() => act({ type: 'remove', memberId: m.id })}
          >
            <UserX aria-hidden="true" />
            Remove
          </button>
        </PopoverContent>
      </Popover>
    </li>
  );
}

/** Name, sounds and leaving live in one menu instead of on the page. */
function RoomMenu({
  table,
  me,
  disabled,
  dispatch,
  onTestPlayer,
}: {
  table: Table;
  me: Member | undefined;
  disabled: boolean;
  dispatch: (action: TableCommand) => Promise<boolean>;
  onTestPlayer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dark = useTheme() === 'dark';
  async function rename(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('name') as string;
    if (await dispatch({ type: 'rename', name: value })) {
      rememberName(value.trim());
      setOpen(false);
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="lib-sound" aria-label="Table menu">
        <EllipsisVertical aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="room-menu" align="end">
        <form onSubmit={rename} className="room-rename">
          <input
            key={table.viewerId}
            name="name"
            aria-label="Your name"
            defaultValue={me?.name}
            maxLength={30}
            required
          />
          <button className="secondary" disabled={disabled}>
            Save
          </button>
        </form>
        {table.isHost && (
          <label className="room-toggle">
            <Trees aria-hidden="true" />
            Ambient sound
            <input
              type="checkbox"
              checked={table.ambienceEnabled === true}
              disabled={disabled}
              onChange={(event) =>
                void dispatch({
                  type: 'ambience',
                  enabled: event.target.checked,
                })
              }
            />
          </label>
        )}
        <label className="room-toggle">
          <Moon aria-hidden="true" />
          Dark mode
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) =>
              setTheme(event.target.checked ? 'dark' : 'light')
            }
          />
        </label>
        {process.env.NODE_ENV === 'development' &&
          table.isHost &&
          table.status === 'lobby' && (
            <button
              disabled={disabled || table.members.length >= table.capacity}
              onClick={() => {
                setOpen(false);
                onTestPlayer();
              }}
            >
              <UserPlus aria-hidden="true" />
              Test player
            </button>
          )}
        {table.isHost ? (
          <button
            className="is-danger"
            disabled={disabled}
            onClick={() => {
              if (window.confirm('Close this table for everyone?'))
                void dispatch({ type: 'close' });
            }}
          >
            <X aria-hidden="true" />
            Close table
          </button>
        ) : (
          table.status === 'lobby' && (
            <button
              className="is-danger"
              disabled={disabled}
              onClick={() => void dispatch({ type: 'leave' })}
            >
              <LogOut aria-hidden="true" />
              Leave table
            </button>
          )
        )}
      </PopoverContent>
    </Popover>
  );
}

/** The table went on to Folio or Relic; anyone arriving later can follow. */
function Handoff({
  url,
  kind,
  onJoin,
}: {
  url: string;
  kind: 'folio' | 'relic';
  onJoin: () => void;
}) {
  const box = gameByLibraryId(kind);
  if (!box) return null;
  return (
    <a
      className="room-handoff"
      href={url}
      onClick={(event) => {
        event.preventDefault();
        onJoin();
      }}
    >
      <GameBox game={box} width={64} sizes="80px" />
      <b>{box.name}</b>
      <span className="lib-friends">
        <Play aria-hidden="true" />
        Join
      </span>
    </a>
  );
}

/** Joined mid-match: the seat opens when the table returns to the lobby. */
function Waiting({ gameId }: { gameId: string }) {
  const box =
    gameByLibraryId(gameId) ??
    gameByLibraryId(onlineCatalog.find((c) => c.id === gameId)?.id ?? '');
  return (
    <output className="room-waiting" aria-label="Match in progress">
      {box && <GameBox game={box} width={150} sizes="200px" />}
      <span className="room-waiting-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </output>
  );
}
