'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, requestId, returnPath } from '@/lib/online/client';
import { play, type RotaGame, type RotaMove } from '@/lib/games/rota/engine';
import type { RotaView } from '@/lib/games/rota/room';
import { TableManager } from '../table-manager';
import { useRoomTable } from '../../online/room-table';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBoardLeave } from '../use-board-leave';
import { recordCompletedGame } from '../play-experience';
import { RotaTable } from './rota-table';

import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';

const VOLUME = 'gamehub.rota.volume';

/**
 * An online Rota room, opened from a table. The page polls the room; your
 * own pieces show at once while the server confirms them, and Done waits for
 * the server, which alone knows everyone else's round.
 */
export default function RotaRoom({ token }: { token: string }) {
  const [view, setView] = useState<RotaView | null>(null);
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(() => readAudioLevel(VOLUME));
  const queue = useRef<RotaMove[]>([]);
  const sending = useRef(false);
  const local = useRef<RotaGame | null>(null);
  const recorded = useRef(false);
  const leaving = useLeaveDialog(
    () =>
      new Promise<void>((resolve) => {
        const wait = () => (sending.current || queue.current.length ? setTimeout(wait, 100) : resolve());
        wait();
      }),
  );
  const home = useCallback(() => window.location.assign(returnPath()), []);
  const room = useRoomTable((path) => window.location.assign(path));

  const accept = useCallback((v: RotaView) => {
    // Pieces still on their way stay drawn until the server has them.
    if (queue.current.length || sending.current) return;
    local.current = v.game;
    setView(v);
    setError('');
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const v = await api<RotaView>(`/api/rota/${token}`);
        if (!stopped) accept(v);
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && [401, 403, 404, 410].includes(e.status)) {
          setError(e.message);
          return;
        }
        setError('Reconnecting…');
      }
      if (!stopped) timer = setTimeout(poll, document.hidden ? 4000 : 1200);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token, accept]);

  async function flush() {
    if (sending.current) return;
    sending.current = true;
    try {
      while (queue.current.length) {
        const move = queue.current[0];
        try {
          const v = await api<RotaView>(`/api/rota/${token}/commands`, {
            requestId: requestId(),
            move,
          });
          queue.current.shift();
          if (!queue.current.length) {
            local.current = v.game;
            setView(v);
          }
        } catch (e) {
          // A refused move is dropped and the room's own state wins.
          queue.current = [];
          if (e instanceof ApiError) setError(e.message);
          else setError('Reconnecting…');
          try {
            const v = await api<RotaView>(`/api/rota/${token}`);
            local.current = v.game;
            setView(v);
          } catch {}
        }
      }
    } finally {
      sending.current = false;
    }
  }

  function move(m: RotaMove) {
    if (!view || view.viewerSeat === null || !local.current) return;
    // Your own pieces show at once; Done waits for the room.
    if (m.type !== 'done') {
      const next = play(local.current, m, view.viewerSeat);
      local.current = next;
      setView({ ...view, game: next });
    }
    queue.current.push(m);
    void flush();
  }

  const over = view?.game.over ?? false;
  useEffect(() => {
    if (over && !recorded.current) {
      recorded.current = true;
      recordCompletedGame('Rota');
    }
  }, [over]);

  const allow = useBoardLeave(!!view && !over, (ok) =>
    leaving.ask(() => {
      ok();
      home();
    }, true),
  );

  if (!view)
    return (
      <main className="startup-loading" aria-busy={!error}>
        {error || 'Rota'}
      </main>
    );
  const seat = view.viewerSeat ?? 0;
  return (
    <div className="app at-table rota">
      <RotaTable
        g={view.game}
        seat={seat}
        people={view.seats.map((s, i) => ({ online: s.online, bot: s.bot, you: i === seat }))}
        onMove={move}
        onLeave={() =>
          over
            ? (allow(), home())
            : leaving.ask(() => {
                allow();
                home();
              }, true)
        }
        onAgain={
          view.isOwner
            ? () =>
                void api<RotaView>(`/api/rota/${token}/again`, {}).then((v) => {
                  local.current = v.game;
                  setView(v);
                }, (e) => setError(e instanceof Error ? e.message : 'Could not start again.'))
            : undefined
        }
        againLabel="Another match"
        volume={volume}
        onVolume={(v) => {
          setVolume(v);
          saveAudioLevel(v, VOLUME);
        }}
        notice={error || room.error || undefined}
        tableSlot={
          room.table && (
            <TableManager
              table={room.table}
              connected={!room.error}
              disabled={room.busy || room.retry}
              theme="rota"
              dispatch={room.dispatch}
              error={room.error}
            />
          )
        }
      />
      <LeaveDialog
        state={leaving}
        title="Leave the match?"
        saved="Your seat is kept. A bot builds your rounds while you are away."
        theme="rota"
        leavesPage
      />
    </div>
  );
}
