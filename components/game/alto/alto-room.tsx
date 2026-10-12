'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { api, ApiError, requestId, returnPath } from '@/lib/online/client';
import {
  validMove,
  type AltoGame,
  type AltoMove,
} from '@/lib/games/alto/engine';
import type { AltoView } from '@/lib/games/alto/room';
import { TableManager } from '../table-manager';
import { useRoomTable } from '../../online/room-table';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBoardLeave } from '../use-board-leave';
import { recordCompletedGame } from '../play-experience';
import { SoundToggle } from '../sound-settings';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { AltoTable } from './alto-table';
import { GameStartup } from '../game-curtain';

const VOLUME = 'gamehub.alto.volume';

/** Your own pick as it will look once the room has it. The turn itself
 *  resolves on the server, which alone knows everyone's pick. */
function optimistic(g: AltoGame, m: AltoMove, seat: number): AltoGame | null {
  if (!validMove(g, m, seat)) return null;
  const v = structuredClone(g);
  if (m.type === 'captain') {
    v.players[seat].captain = m.captain;
    delete v.players[seat].captainOffer;
  } else if (m.type === 'undo') {
    v.pending[seat] = null;
    v.ready[seat] = false;
  } else {
    v.pending[seat] = {
      island: m.island,
      ...(m.build ? { build: m.build } : {}),
      ...(m.order ? { order: m.order } : {}),
    };
    v.ready[seat] = true;
  }
  return v;
}

/**
 * An online Alto room, opened from a table. The page polls the room; your
 * own pick shows at once while the server confirms it. The server alone
 * knows everyone else's pick, so the turn resolves there.
 */
export default function AltoRoom({ token }: { token: string }) {
  const [view, setView] = useState<AltoView | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [volume, setVolume] = useState(() => readAudioLevel(VOLUME));
  const inFlight = useRef(false);
  const recorded = useRef(false);
  const leaving = useLeaveDialog(
    () =>
      new Promise<void>((resolve) => {
        const started = Date.now();
        const wait = () =>
          inFlight.current && Date.now() - started < 4000
            ? setTimeout(wait, 80)
            : resolve();
        wait();
      }),
  );
  const home = useCallback(() => window.location.assign(returnPath()), []);
  const room = useRoomTable((path) => window.location.assign(path));
  const accept = useCallback((v: AltoView) => {
    // A pick on its way stays drawn until the room has it.
    if (inFlight.current) return;
    setView((old) =>
      old &&
      v.game.revision < old.game.revision &&
      v.game.season === old.game.season &&
      v.game.turn === old.game.turn
        ? old
        : v,
    );
    setError('');
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const v = await api<AltoView>(`/api/alto/${token}`);
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

  async function move(m: AltoMove) {
    if (!view || view.viewerSeat === null || inFlight.current) return;
    const seat = view.viewerSeat;
    // Your own pick shows at once; the room resolves the turn.
    const mine = optimistic(view.game, m, seat);
    if (!mine) return;
    setView({ ...view, game: mine });
    inFlight.current = true;
    setSending(true);
    try {
      const v = await api<AltoView>(`/api/alto/${token}/commands`, {
        requestId: requestId(),
        move: m,
      });
      inFlight.current = false;
      setView(v);
    } catch (e) {
      inFlight.current = false;
      setError(e instanceof ApiError ? e.message : 'Reconnecting…');
      try {
        setView(await api<AltoView>(`/api/alto/${token}`));
      } catch {}
    } finally {
      setSending(false);
    }
  }

  const over = view?.game.over ?? false;
  useEffect(() => {
    if (over && !recorded.current) {
      recorded.current = true;
      recordCompletedGame('Alto');
    }
  }, [over]);
  const allow = useBoardLeave(!!view && !over, (ok) =>
    leaving.ask(() => {
      ok();
      home();
    }, true),
  );

  if (!view)
    return error ? (
      <main className="startup-loading">{error}</main>
    ) : (
      <GameStartup game="alto" name="Alto" />
    );
  const again = view.isOwner
    ? () =>
        void api<AltoView>(`/api/alto/${token}/again`, {}).then(setView, (e) =>
          setError(e instanceof Error ? e.message : 'Could not start again.'),
        )
    : undefined;
  const leave = () =>
    over
      ? (allow(), home())
      : leaving.ask(() => {
          allow();
          home();
        }, true);
  return (
    <div className="app at-table alto">
      <AltoTable
        g={view.game}
        viewer={view.viewerSeat ?? 0}
        disabled={view.viewerSeat === null}
        sending={sending}
        volume={volume}
        sound={
          <SoundToggle
            Icon={Volume2}
            label="Sound effects"
            on={volume > 0}
            onChange={(on) => {
              const next = on ? 0.5 : 0;
              setVolume(next);
              saveAudioLevel(next, VOLUME);
            }}
          />
        }
        onMove={(m) => void move(m)}
        onLeave={leave}
        finale={
          <>
            {again && (
              <button type="button" onClick={again}>
                Another match
              </button>
            )}
            <button type="button" onClick={leave}>
              Back to the table
            </button>
          </>
        }
        notice={error || room.error || undefined}
        presence={view.seats.map((s) => ({
          bot: s.bot,
          away: s.away || !s.online,
        }))}
      />
      {room.table && (
        <TableManager
          table={room.table}
          connected={!room.error}
          disabled={room.busy || room.retry}
          theme="alto"
          dispatch={room.dispatch}
          error={room.error}
        />
      )}
      <LeaveDialog
        state={leaving}
        title="Leave the match?"
        saved="Your seat is kept. A bot flies for you while you are away."
        theme="alto"
        leavesPage
      />
    </div>
  );
}
