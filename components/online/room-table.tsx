'use client';
import { useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import {
  api,
  ApiError,
  requestId,
  returnPath,
  withDevSession,
} from '@/lib/online/client';
import type { Command, Table } from '@/lib/online/types';

/** Keep a standalone saved game connected to the table that opened it. */
export function useRoomTable(onExit: (path: string) => void) {
  const [table, setTable] = useState<Table | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const current = useRef<Table | null>(null);
  const exit = useRef(onExit);
  const pending = useRef<Command | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    exit.current = onExit;
  }, [onExit]);
  useEffect(() => {
    let back = returnPath();
    // Upgrade tabs opened before return links were scoped to an individual run.
    try {
      if (back === '/')
        back = sessionStorage.getItem('gamehub.return-table') ?? '/';
    } catch {}
    if (!/^\/table\/[A-Za-z0-9_-]{32}$/.test(back)) return;
    const path = `/api/tables/${back.split('/').at(-1)}`;
    let stopped = false;
    let events: EventSource | undefined;
    let reconnect: ReturnType<typeof setTimeout>;
    function detach(destination: string) {
      stopped = true;
      events?.close();
      try {
        sessionStorage.removeItem(
          `gamehub.return-table.${window.location.pathname}`,
        );
      } catch {}
      // A save opened later from the library must stay playable even if its
      // former table has ended. Only move players out of a live table session.
      if (current.current) exit.current(destination);
      setTable(null);
      setError('');
    }
    function accept(t: Table) {
      if (stopped || (current.current && t.revision < current.current.revision))
        return;
      if (
        t.status === 'closed' ||
        !t.members.some((m) => m.id === t.viewerId)
      ) {
        detach('/');
        return;
      }
      if (t.handoff?.url !== window.location.pathname) {
        detach(back);
        return;
      }
      current.current = t;
      try {
        sessionStorage.setItem(
          `gamehub.return-table.${window.location.pathname}`,
          back,
        );
      } catch {}
      setTable(t);
      setError('');
      return true;
    }
    function failed(e: unknown) {
      if (stopped) return;
      if (e instanceof ApiError && [401, 403, 404, 410].includes(e.status))
        detach('/');
      else setError('Reconnecting to the table…');
    }
    function connect() {
      void api<Table>(path)
        .then((t) => {
          if (stopped) return;
          if (!accept(t)) return;
          events = new EventSource(withDevSession(`${path}/events`));
          events.onmessage = (event) => accept(JSON.parse(event.data) as Table);
          events.onerror = () => {
            void api<Table>(path).then(accept).catch(failed);
          };
          events.addEventListener('gone', () => detach('/'));
          events.addEventListener('revoked', () => detach('/'));
        })
        .catch((e) => {
          failed(e);
          if (!stopped) reconnect = setTimeout(connect, 2500);
        });
    }
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      events?.close();
    };
  }, []);
  async function dispatch(type?: 'abandon' | 'close') {
    const t = current.current;
    if (!t || sending.current) return;
    if (!pending.current && type)
      pending.current = {
        requestId: requestId(),
        revision: t.revision,
        matchId: t.matchId,
        action: { type },
      };
    if (!pending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const next = await api<Table>(
        `/api/tables/${t.token}/commands`,
        pending.current,
      );
      pending.current = null;
      setRetry(false);
      exit.current(next.status === 'closed' ? '/' : `/table/${t.token}`);
    } catch (e) {
      if (e instanceof ApiError) {
        pending.current = null;
        setRetry(false);
        try {
          current.current = await api<Table>(`/api/tables/${t.token}`);
        } catch {}
      }
      if (!(e instanceof ApiError)) setRetry(true);
      setError(e instanceof Error ? e.message : 'Could not reach the table.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return { table, error, busy, retry, dispatch };
}

export function RoomTableSettings({
  room,
}: {
  room: ReturnType<typeof useRoomTable>;
}) {
  if (!room.table) return room.error ? <p role="alert">{room.error}</p> : null;
  return (
    <details className="room-game-settings">
      <summary>
        <Settings2 size={18} /> Table settings
      </summary>
      <ul>
        {room.table.members.map((m) => (
          <li key={m.id}>
            {m.name}
            {m.owner ? ' · Host' : ''}
          </li>
        ))}
      </ul>
      {room.table.isHost && (
        <>
          <button
            disabled={room.busy || room.retry}
            onClick={() => void room.dispatch('abandon')}
          >
            Back to lobby
          </button>
          <button
            disabled={room.busy || room.retry}
            onClick={() => void room.dispatch('close')}
          >
            Close table
          </button>
        </>
      )}
      {room.error && <p role="alert">{room.error}</p>}
      {room.retry && (
        <button disabled={room.busy} onClick={() => void room.dispatch()}>
          Retry
        </button>
      )}
    </details>
  );
}
