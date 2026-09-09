'use client';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  api,
  ApiError,
  rememberedName,
  rememberName,
  requestId,
  joinTable,
} from '@/lib/online/client';
import {
  type Command,
  type Table,
  type TableCommand,
} from '@/lib/online/types';
import { catalog, type GameId, type Difficulty } from '@/lib/games/trio/engine';
import { OnlineHeader } from './account';
import { OnlineMatch } from './match';

export function SharedTable({ invite }: { invite: string }) {
  const [table, setTable] = useState<Table | null>(null),
    [needsName, setNeedsName] = useState(false),
    [name, setName] = useState(rememberedName),
    [error, setError] = useState(''),
    [fatal, setFatal] = useState(false),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false),
    [copied, setCopied] = useState(false);
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
        if (e instanceof ApiError && e.status === 400 && !stored)
          setNeedsName(true);
        else {
          setError(e.message);
          setFatal(e instanceof ApiError && [404, 410, 409].includes(e.status));
        }
      });
    return () => {
      active = false;
    };
  }, [invite]);
  const joined = !!table;
  useEffect(() => {
    if (!joined) return;
    const events = new EventSource(`/api/tables/${invite}/events`);
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
          if ([401, 403, 404, 410].includes(error.status)) {
            events.close();
            setFatal(true);
            setError(error.message);
            if (error.status === 410 && current.current)
              accept({ ...current.current, status: 'closed', game: null });
          }
        });
    };
    events.addEventListener('revoked', () => {
      events.close();
      setConnected(false);
      setError('Your session or seat has changed. Reopen the invite to join.');
      setFatal(true);
    });
    return () => {
      events.close();
    };
  }, [invite, joined]);
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dispatch(action?: TableCommand): Promise<boolean> {
    if (sending.current || !current.current || (!action && !pending.current))
      return false;
    sending.current = true;
    setBusy(true);
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
        setError(
          'The connection was interrupted. Retry the same action to safely check whether it was saved.',
        );
      }
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setError('Copy the invite link from the address bar.');
    }
  }
  async function rename(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('name') as string;
    if (await dispatch({ type: 'rename', name: value }))
      rememberName(value.trim());
  }
  const disabled = busy || retry || !connected || fatal;
  return (
    <div className={`app ${table?.game ? `at-table ${table.gameId}` : ''}`}>
      <OnlineHeader />
      {error && (
        <div className="online-notice" role="alert">
          {error}
          {retry && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void dispatch()}
            >
              Retry last action
            </button>
          )}
          {!table && !needsName && !fatal && (
            <button
              className="secondary"
              onClick={() => window.location.reload()}
            >
              Reconnect
            </button>
          )}
        </div>
      )}
      {!table ? (
        <main className="online-card">
          {needsName ? (
            <>
              <h1>Take a seat</h1>
              <p>Just your name. No account needed.</p>
              <form onSubmit={join}>
                <label>
                  Your name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    maxLength={30}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Join table
                </button>
                <small>We’ll remember you in this browser.</small>
              </form>
            </>
          ) : (
            <p>
              {fatal
                ? 'This invitation is unavailable.'
                : error
                  ? 'Unable to join the table.'
                  : 'Joining table…'}
            </p>
          )}
        </main>
      ) : table.status === 'closed' ? (
        <main className="online-card">
          <h1>This table is closed</h1>
          <a href="/tables">Back to my tables</a>
        </main>
      ) : (
        <>
          <details className="online-session" open={table.status === 'lobby'}>
            <summary>
              Table · {connected ? 'Connected' : 'Reconnecting…'} · Manage
              players & invite
            </summary>
            <section className="online-card table-lobby">
              <div className="online-row">
                <h1>{catalog.find((c) => c.id === table.gameId)?.name}</h1>
                <button className="secondary" onClick={copy}>
                  {copied ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>
              <output>
                {connected
                  ? table.status === 'lobby'
                    ? 'Invite your friends, then start when everyone is here.'
                    : 'Table connected'
                  : 'Reconnecting… Your seat is saved.'}
              </output>
              <ul className="member-list">
                {table.members.map((m) => (
                  <li key={`${m.id}-${m.bot}`}>
                    <span
                      className={`presence ${m.connected ? 'present' : ''}`}
                    />
                    <span>
                      {m.name}
                      {m.id === table.viewerId && !m.bot ? ' (you)' : ''}
                      <small>
                        {m.host
                          ? 'Host'
                          : m.bot
                            ? 'Bot'
                            : m.seat === null
                              ? 'Waiting for next match'
                              : m.connected
                                ? 'Connected'
                                : 'Disconnected'}
                      </small>
                    </span>
                    {table.isHost &&
                      !m.host &&
                      !m.bot &&
                      table.status === 'lobby' && (
                        <button
                          className="text-button"
                          disabled={disabled}
                          onClick={() =>
                            void dispatch({ type: 'remove', memberId: m.id })
                          }
                        >
                          Remove
                        </button>
                      )}
                    {table.isHost &&
                      !m.host &&
                      !m.bot &&
                      !m.connected &&
                      m.seat !== null &&
                      table.status === 'playing' && (
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
                          Replace with bot
                        </button>
                      )}
                  </li>
                ))}
              </ul>
              {table.status === 'lobby' && (
                <>
                  <p>
                    {Math.max(0, table.capacity - table.members.length)} empty
                    seats will be filled by bots.
                  </p>
                  {table.isHost && (
                    <LobbySettings
                      table={table}
                      disabled={disabled}
                      dispatch={dispatch}
                    />
                  )}
                </>
              )}
              <details>
                <summary>Change your name</summary>
                <form onSubmit={rename} className="online-row">
                  <label>
                    Your name
                    <input
                      key={table.viewerId}
                      name="name"
                      defaultValue={
                        table.members.find(
                          (m) => m.id === table.viewerId && !m.bot,
                        )?.name
                      }
                      maxLength={30}
                      required
                    />
                  </label>
                  <button className="secondary" disabled={disabled}>
                    Save name
                  </button>
                </form>
              </details>
              <div className="online-actions">
                {table.isHost && table.status !== 'lobby' && (
                  <button
                    className="primary"
                    disabled={disabled}
                    onClick={() => {
                      if (
                        table.status === 'finished' ||
                        window.confirm(
                          'End this match and return everyone to the lobby?',
                        )
                      )
                        void dispatch({ type: 'abandon' });
                    }}
                  >
                    Return to lobby
                  </button>
                )}
                {table.isHost && (
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Close this table and disable its invite link?',
                        )
                      )
                        void dispatch({ type: 'close' });
                    }}
                  >
                    Close table
                  </button>
                )}
                {!table.isHost && table.status === 'lobby' && (
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() => void dispatch({ type: 'leave' })}
                  >
                    Leave table
                  </button>
                )}
              </div>
              {table.botError && (
                <p role="alert">
                  A bot has paused.{' '}
                  {table.isHost ? (
                    <button
                      className="secondary"
                      disabled={disabled}
                      onClick={() => void dispatch({ type: 'retry-bot' })}
                    >
                      Retry bot
                    </button>
                  ) : (
                    'The host can retry it.'
                  )}
                </p>
              )}
            </section>
          </details>
          {table.game && table.viewerSeat !== null ? (
            <OnlineMatch
              key={table.matchId}
              g={table.game}
              viewer={table.viewerSeat}
              disabled={disabled}
              send={(move) => dispatch({ type: 'move', move })}
            />
          ) : (
            table.status !== 'lobby' && (
              <div className="online-card">
                <h2>Waiting for the next match</h2>
                <p>
                  The current seats are reserved. You can play when the host
                  returns to the lobby.
                </p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
function LobbySettings({
  table,
  disabled,
  dispatch,
}: {
  table: Table;
  disabled: boolean;
  dispatch: (action: TableCommand) => Promise<boolean>;
}) {
  return (
    <div className="lobby-settings">
      <label>
        Game
        <select
          value={table.gameId}
          disabled={disabled}
          onChange={(e) =>
            void dispatch({
              type: 'configure',
              gameId: e.target.value as GameId,
              difficulty: table.difficulty,
              capacity: table.capacity,
            })
          }
        >
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Total seats
        <select
          value={table.capacity}
          disabled={disabled}
          onChange={(e) =>
            void dispatch({
              type: 'configure',
              gameId: table.gameId,
              difficulty: table.difficulty,
              capacity: Number(e.target.value),
            })
          }
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n} disabled={n < table.members.length}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bot difficulty
        <select
          value={table.difficulty}
          disabled={disabled}
          onChange={(e) =>
            void dispatch({
              type: 'configure',
              gameId: table.gameId,
              difficulty: e.target.value as Difficulty,
              capacity: table.capacity,
            })
          }
        >
          {['easy', 'medium', 'hard'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primary"
        disabled={disabled || table.members.length > table.capacity}
        onClick={() => void dispatch({ type: 'start' })}
      >
        Start match
      </button>
    </div>
  );
}
