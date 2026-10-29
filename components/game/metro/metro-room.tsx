'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, requestId, returnPath } from '@/lib/online/client';
import { play, type MetroGame, type MetroMove } from '@/lib/games/metro/engine';
import type { MetroView } from '@/lib/games/metro/room';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { TableManager } from '../table-manager';
import { useRoomTable } from '../../online/room-table';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBoardLeave } from '../use-board-leave';
import { recordCompletedGame } from '../play-experience';
import { MetroTable } from './metro-table';

const VOLUME = 'gamehub.metro.volume';

/**
 * An online Metro room, opened from a table. The page polls the room; your
 * own sections show at once while the server confirms them, and Done waits
 * for the server, which alone knows everyone else's turn and the next card.
 */
export default function MetroRoom({ token }: { token: string }) {
  const [view, setView] = useState<MetroView | null>(null);
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(() => readAudioLevel(VOLUME));
  // Each move carries the turn it was made on, so the room refuses it once
  // that turn is over.
  const queue = useRef<{ move: MetroMove; at: { round: number; turn: number } }[]>([]);
  const sending = useRef(false);
  const local = useRef<MetroGame | null>(null);
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

  const accept = useCallback((v: MetroView) => {
    // Sections still on their way stay drawn until the server has them.
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
        const v = await api<MetroView>(`/api/metro/${token}`);
        if (!stopped) accept(v);
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && [401, 403, 404, 410].includes(e.status)) {
          setError(e.message);
          return;
        }
        setError('Reconnecting…');
      }
      if (!stopped) timer = setTimeout(poll, document.hidden ? 4000 : 1000);
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
        const { move, at } = queue.current[0];
        try {
          const v = await api<MetroView>(`/api/metro/${token}/commands`, {
            requestId: requestId(),
            move,
            at,
          });
          queue.current.shift();
          if (!queue.current.length) {
            local.current = v.game;
            setView(v);
          }
        } catch (e) {
          // A refused move is dropped and the room's own state wins.
          queue.current = [];
          setError(e instanceof ApiError ? e.message : 'Reconnecting…');
          try {
            const v = await api<MetroView>(`/api/metro/${token}`);
            local.current = v.game;
            setView(v);
          } catch {}
        }
      }
    } finally {
      sending.current = false;
    }
  }

  function move(m: MetroMove) {
    if (!view || view.viewerSeat === null || !local.current) return;
    // Once Done is on its way nothing more goes out until the room answers:
    // a second Done, or a tap meant for this turn, must not land on the next.
    if (queue.current.some((q) => q.move.type === 'done')) return;
    const at = { round: local.current.round, turn: local.current.turn };
    // Your own sections show at once; Done waits for the room.
    if (m.type !== 'done') {
      const next = play(local.current, m, view.viewerSeat);
      local.current = next;
      setView({ ...view, game: next });
    }
    queue.current.push({ move: m, at });
    void flush();
  }

  const over = view?.game.over ?? false;
  useEffect(() => {
    if (over && !recorded.current) {
      recorded.current = true;
      recordCompletedGame('Metro');
    }
  }, [over]);

  const allow = useBoardLeave(!!view && !over, (ok) =>
    leaving.ask(() => {
      ok();
      home();
    }, true),
  );

  if (!view)
    return <main className="startup-loading metro-startup">{error || <span className="sr-only">Metro</span>}</main>;
  const seat = view.viewerSeat ?? 0;
  return (
    <div className="app at-table metro">
      <MetroTable
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
                void api<MetroView>(`/api/metro/${token}/again`, {}).then(
                  (v) => {
                    local.current = v.game;
                    setView(v);
                  },
                  (e) => setError(e instanceof Error ? e.message : 'Could not start again.'),
                )
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
              theme="metro"
              dispatch={room.dispatch}
              error={room.error}
            />
          )
        }
      />
      <LeaveDialog
        state={leaving}
        title="Leave the match?"
        saved="Your seat is kept. A bot draws your turns while you are away."
        theme="metro"
        leavesPage
      />
    </div>
  );
}
