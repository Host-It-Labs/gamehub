'use client';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import { useBoardLeave } from '../game/use-board-leave';
import { TableAmbienceControl } from './table-ambience-control';
import { AdventureMatch } from './adventure-match';
import { onlineCatalog } from '@/lib/online/catalog';
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
import { OnlineHeader } from './account';
import { OnlineMatch } from './match';
import { LobbyGames, SharedLesson } from './lobby-games';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
  const allowLeave = useBoardLeave(!!(table?.game || table?.adventure), requestLeave);
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
    const drafting = action?.type === 'adventure-move' && action.move.type === 'arrange';
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
          {(table.status === 'lobby' || table.isHost) && <details
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
              <TableAmbienceControl table={table} disabled={disabled} dispatch={dispatch} />
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
                            : !m.connected
                              ? 'Disconnected'
                              : m.seat === null && table.status !== 'lobby'
                                ? 'Waiting for next match'
                                : 'Connected'}
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
                      table.status === 'playing' && !requiresHumanPlayers(table.gameId) && (
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
                      ? requiresHumanPlayers(table.gameId) ? ` · Waiting for ${table.capacity - table.members.length} human players` : ` · ${table.capacity - table.members.length} bots will fill the remaining seats`
                      : table.members.some(m => !m.connected && !m.bot) ? ' · Some players are disconnected' : ' · Everyone is here'}
                  </p>

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
          </details>}
          {table.status === 'lobby' && (
            <LobbyGames error={error} table={table} disabled={disabled} dispatch={dispatch} />
          )}
          {table.game?.tutorial && (
            <SharedLesson
              table={table}
              disabled={disabled}
              dispatch={dispatch}
            />
          )}
          {table.adventure && table.viewerSeat !== null && <AdventureMatch key={table.matchId} table={table} disabled={disabled} dispatch={dispatch} onHome={requestLeave} />}
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
      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent className="modal help-modal" finalFocus={returnFocus}>
          <DialogTitle>Leave the table?</DialogTitle>
          <DialogDescription>
            The match will keep going, and the other players may be waiting for you.
            Your seat stays reserved. You can return from My tables.
          </DialogDescription>
          <button className="primary" onClick={() => setLeaving(false)}>Keep playing</button>
          <button className="secondary" onClick={() => { allowLeave(); window.location.href = '/tables'; }}>Leave table</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
