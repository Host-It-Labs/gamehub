'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ApiError, returnPath } from '@/lib/online/client';
import { SoundSettings } from '../sound-settings';
import { readAmbienceLevel, saveAmbienceLevel } from '../use-ambience';
import { useGameSound } from '../use-game-sound';
import { joinRoom, type OnlineSession } from './online';

const ArenaGame = lazy(() => import('./arena-game'));
const VOLUME = 'gamehub.volume.v3';

function readVolume() {
  try {
    const v = Number(localStorage.getItem(VOLUME) ?? '.5');
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  } catch {
    return 0.5;
  }
}

/**
 * An online Arena room at /arena/<token>: a table sends its players here.
 * Leaving goes back to that table; the room plays on with a bot in the seat.
 */
export default function ArenaRoom({ token }: { token: string }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [failed, setFailed] = useState('');
  const [volume, setVolume] = useState(readVolume);
  const [ambience, setAmbience] = useState(readAmbienceLevel);
  useGameSound('arena', volume);
  useEffect(() => {
    let live = true;
    joinRoom(token)
      .then((s) => {
        if (live) setSession(s);
        else s.dispose();
      })
      .catch((e) => {
        if (!live) return;
        setFailed(
          e instanceof ApiError && [403, 404, 410].includes(e.status)
            ? 'This battle is not open to you.'
            : 'Could not reach the battle.',
        );
      });
    return () => {
      live = false;
    };
  }, [token]);
  const exit = () => {
    const back = session?.room.table
      ? `/table/${session.room.table}`
      : returnPath();
    window.location.assign(back);
  };
  if (failed)
    return (
      <main className="arena-game">
        <div className="arena-loading">
          <div className="arena-loading-panel" role="alert">
            <p>{failed}</p>
            <button type="button" className="arena-button" onClick={exit}>
              Back
            </button>
          </div>
        </div>
      </main>
    );
  if (!session)
    return (
      <main className="startup-loading" aria-busy="true">
        Arena
      </main>
    );
  return (
    <div className="app at-table arena">
      <Suspense
        fallback={
          <main className="startup-loading" aria-busy="true">
            Arena
          </main>
        }
      >
        <ArenaGame
          online={session}
          volume={volume}
          music={ambience}
          onExit={exit}
          sound={
            <SoundSettings
              volume={volume}
              ambience={ambience}
              onVolume={(v) => {
                setVolume(v);
                try {
                  localStorage.setItem(VOLUME, String(v));
                } catch {
                  /* Preference is optional. */
                }
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
