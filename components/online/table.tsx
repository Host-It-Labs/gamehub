'use client';
import { AdventureMatch } from './adventure-match';
import { onlineCatalog } from '@/lib/online/catalog';
import { isStandaloneId, standaloneGames } from '@/lib/games/standalone/registry';
import {
  GameExtensionChoices,
  ContentChoice,
} from '@/components/game/expansions';
import { decisionKey } from '@/lib/games/trio/engine';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Settings2 } from 'lucide-react';
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
import { type Difficulty } from '@/lib/games/trio/engine';
import { OnlineHeader } from './account';
import { OnlineMatch } from './match';
import { LobbyGames, SharedLesson } from './lobby-games';

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
    <div className={`app ${(table?.game || table?.adventure) ? `at-table ${table.gameId}` : ''}`}>
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
              <p>Enter your name to join. You do not need an account.</p>
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
          <details
            className={`online-session table-session ${table.status === 'lobby' ? 'lobby-session' : 'playing-session'} ${table.isHost ? 'host-session' : 'guest-session'}`}
            key={`${table.status}-${table.isHost}`}
            open={table.status === 'lobby' && table.isHost}
          >
            <summary>
              {table.status === 'lobby' ? (
                <>
                  <span>
                    {`${onlineCatalog.find((c) => c.id === table.gameId)?.name} · Up next`}
                    <small>
                      {table.members.length} players ·{' '}
                      {table.isHost ? 'You’re hosting' : 'Waiting for the host'}
                    </small>
                  </span>
                  <span
                    className={`lobby-connection ${connected ? 'is-connected' : ''}`}
                  >
                    {connected ? 'Connected' : 'Reconnecting…'}
                  </span>
                </>
              ) : (
                <span className="playing-session-trigger">
                  <Settings2 size={16} aria-hidden="true" />
                  Table
                  <span
                    className={`table-connection-dot ${connected ? 'is-connected' : ''}`}
                    aria-label={connected ? 'Connected' : 'Reconnecting'}
                  />
                </span>
              )}
            </summary>
            <section className="online-card table-lobby">
              <div className="online-row">
                <div>
                  <span className="lobby-eyebrow">
                    {table.status === 'lobby'
                      ? 'Gather your players'
                      : 'Your table'}
                  </span>
                  <h1>
                    {table.status === 'lobby'
                      ? 'Around the table'
                      : onlineCatalog.find((c) => c.id === table.gameId)?.name}
                  </h1>
                </div>
                <button className="secondary" onClick={copy}>
                  {copied ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>
              <output>
                {connected
                  ? table.status === 'lobby'
                    ? table.isHost
                      ? 'Share the invite. Choose a game below. Start when you’re ready.'
                      : 'You’re in. Suggest a game below while everyone joins.'
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
                  <p className="lobby-seat-note">
                    {table.members.length} of {table.capacity} seats taken
                    {table.capacity > table.members.length
                      ? ` · ${table.capacity - table.members.length} bots will fill the remaining seats`
                      : ' · Everyone is here'}
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
              <div className="lobby-utilities">
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
          {table.status === 'lobby' && (
            <LobbyGames table={table} disabled={disabled} dispatch={dispatch} />
          )}
          {table.game?.tutorial && (
            <SharedLesson
              table={table}
              disabled={disabled}
              dispatch={dispatch}
            />
          )}
          {table.adventure && table.viewerSeat !== null && <AdventureMatch key={table.matchId} table={table} disabled={disabled} dispatch={dispatch} onHome={() => { window.location.href='/'; }} />}
          {table.game && table.viewerSeat !== null ? (
            <OnlineMatch
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
            !table.adventure && table.status !== 'lobby' && (
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
  const [learning, setLearning] = useState(false);
  return (
    <div className="lobby-settings">
      <div className="lobby-settings-title">
        <span className="lobby-eyebrow">Ready to play</span>
        <h2>{onlineCatalog.find((game) => game.id === table.gameId)?.name}</h2>
      </div>
      <label>
        Total seats
        <select
          value={table.capacity}
          disabled={disabled}
          onChange={(e) =>
            void dispatch({
              type: 'configure',
              shields: table.shields ?? false,
              fastMode: table.fastMode ?? false,
              gameId: table.gameId,
              difficulty: table.difficulty,
              capacity: Number(e.target.value),
            })
          }
        >
          {(isStandaloneId(table.gameId)?standaloneGames[table.gameId].seatChoices:[2, 3, 4, 5, 6]).map((n) => (
            <option key={n} value={n} disabled={n < table.members.length}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {isStandaloneId(table.gameId) && <label>Play mode
        <select value={table.partyMode ?? 'individual'} disabled={disabled} onChange={event => void dispatch({type: 'configure', gameId: table.gameId, difficulty: table.difficulty, capacity: table.capacity, partyMode: event.target.value as 'teams' | 'individual'})}>
          <option value="individual">Everyone for themselves</option>
          <option value="teams" disabled={![4,6].includes(table.capacity)}>Two teams (4 or 6 players)</option>
        </select>
      </label>}
      <label>
        Bot difficulty
        <select
          value={table.difficulty}
          disabled={disabled}
          onChange={(e) =>
            void dispatch({
              type: 'configure',
              shields: table.shields ?? false,
              fastMode: table.fastMode ?? false,
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
      {table.gameId === 'undertow' && (
        <>
          <label className="tide-fast-mode" aria-label="Fast mode">
            <input
              type="checkbox"
              checked={table.fastMode ?? false}
              disabled={disabled}
              onChange={(e) =>
                void dispatch({
                  type: 'configure',
                  gameId: table.gameId,
                  difficulty: table.difficulty,
                  capacity: table.capacity,
                  shields: table.shields ?? false,
                  fastMode: e.target.checked,
                })
              }
            />
            <span>
              <b>Fast mode</b>
              <small>Cards 1–5 · the 4 matching the die is +8</small>
            </span>
          </label>
        </>
      )}
      {!isStandaloneId(table.gameId) && <ContentChoice
        id={table.gameId}
        options={{
          contentSet: table.contentSet,
          roamEnabled: table.roamEnabled,
          turningTide: table.turningTide,
          migration: table.migration,
          salvage: table.salvage,
          specialtyStalls: table.specialtyStalls,
          marketSeasons: table.marketSeasons,
        }}
        disabled={disabled}
        onChange={(options) =>
          void dispatch({
            type: 'configure',
            gameId: table.gameId,
            difficulty: table.difficulty,
            capacity: table.capacity,
            ...options,
          })
        }
      />}
      {!isStandaloneId(table.gameId) && <GameExtensionChoices
        id={table.gameId}
        options={{
          contentSet: table.contentSet,
          roamEnabled: table.roamEnabled,
          turningTide: table.turningTide,
          migration: table.migration,
          salvage: table.salvage,
          specialtyStalls: table.specialtyStalls,
          marketSeasons: table.marketSeasons,
        }}
        shields={table.shields ?? false}
        customerOrders={table.customerOrders ?? false}
        sanctuaryGoalsEnabled={table.sanctuaryGoalsEnabled ?? false}
        disabled={disabled}
        onChange={(options) =>
          void dispatch({
            type: 'configure',
            gameId: table.gameId,
            difficulty: table.difficulty,
            capacity: table.capacity,
            ...options,
          })
        }
      />}
      <label
        className="lobby-learning-choice"
        aria-label="Learn together first"
      >
        <input
          type="checkbox"
          checked={learning}
          disabled={disabled}
          onChange={(event) => setLearning(event.target.checked)}
        />
        <span>
          <b>Learn together first</b>
          <small>Interactive practice, with lessons led by you.</small>
        </span>
      </label>
      <button
        className="primary lobby-start"
        disabled={disabled || table.members.length > table.capacity}
        onClick={() => void dispatch({ type: 'start', learning })}
      >
        {learning ? 'Start learning together' : 'Start match'}
      </button>
    </div>
  );
}
