'use client';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { ApiError, returnPath } from '@/lib/online/client';
import { SoundSettings } from '../sound-settings';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { readAmbienceLevel, saveAmbienceLevel } from '../use-ambience';
import { joinDiner, type OnlineSession } from './online';
import type { RoomInfo } from './diner-game';

const DinerGame = lazy(() => import('./diner-game'));

/**
 * An online Diner room at /diner/<token>: a table sends its waiters here.
 * Leaving goes back to that table; your waiter waits by the counter.
 */
export default function DinerRoom({ token }: { token: string }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [failed, setFailed] = useState('');
  const [volume, setVolume] = useState(() => readAudioLevel());
  const [ambience, setAmbience] = useState(readAmbienceLevel);
  const subscribe = useCallback(
    (l: () => void) => session?.subscribe(l) ?? (() => {}),
    [session],
  );
  const key = useSyncExternalStore(
    subscribe,
    () =>
      session
        ? `${session.room.status}|${session.room.round}|${session.link}|${session.room.seats.map((s) => `${s.name}:${+s.connected}`).join(',')}|${session.room.host}`
        : '',
    () => '',
  );
  useEffect(() => {
    let live = true;
    joinDiner(token)
      .then((s) => {
        if (live) setSession(s);
        else s.dispose();
      })
      .catch((e) => {
        if (!live) return;
        setFailed(
          e instanceof ApiError && [403, 404, 410].includes(e.status)
            ? 'This diner is not open to you.'
            : 'Could not reach the diner.',
        );
      });
    return () => {
      live = false;
    };
  }, [token]);
  useEffect(() => () => session?.dispose(), [session]);
  const exit = () => {
    const back = session?.room.table
      ? `/table/${session.room.table}`
      : returnPath();
    window.location.assign(back);
  };
  if (failed)
    return (
      <main className="diner-game">
        <div className="diner-plate-wrap">
          <section className="diner-plate" role="alert">
            <p>{failed}</p>
            <button type="button" className="diner-button" onClick={exit}>
              Back
            </button>
          </section>
        </div>
      </main>
    );
  if (!session)
    return (
      <main className="startup-loading" aria-busy="true">
        Diner
      </main>
    );
  void key;
  const room: RoomInfo = {
    status: session.room.status,
    seats: session.room.seats,
    link: session.link,
  };
  return (
    <div className="app at-table diner">
      <Suspense
        fallback={
          <main className="startup-loading" aria-busy="true">
            Diner
          </main>
        }
      >
        <DinerGame
          session={session}
          volume={volume}
          music={ambience}
          room={room}
          onExit={exit}
          sound={
            <SoundSettings
              volume={volume}
              ambience={ambience}
              onVolume={(v) => {
                setVolume(v);
                saveAudioLevel(v);
              }}
              onAmbience={(v) => {
                setAmbience(v);
                saveAmbienceLevel(v);
              }}
            />
          }
        />
      </Suspense>
    </div>
  );
}
