'use client';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError, returnPath } from '@/lib/online/client';
import { SoundSettings } from '../sound-settings';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { readAmbienceLevel, saveAmbienceLevel } from '../use-ambience';
import { useGameSound } from '../use-game-sound';
import { joinRoom, type OnlineSession } from './online';

const ArenaGame = lazy(() => import('./arena-game'));
const QuestView = lazy(() =>
  import('./quest-view').then((m) => ({ default: m.QuestView })),
);
const ArenaRules = lazy(() =>
  import('./arena-rules').then((m) => ({ default: m.ArenaRules })),
);

/**
 * An online Arena room at /arena/<token>: a table sends its players here.
 * Leaving goes back to that table; the room plays on with a bot in the seat.
 */
export default function ArenaRoom({ token }: { token: string }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [failed, setFailed] = useState('');
  const [volume, setVolume] = useState(() => readAudioLevel());
  const [ambience, setAmbience] = useState(readAmbienceLevel);
  const [rules, setRules] = useState(false);
  useGameSound('arena', volume);
  // Re-render as the room moves between the Quest map and its battles.
  const subscribe = useCallback(
    (l: () => void) => session?.subscribe(l) ?? (() => {}),
    [session],
  );
  const view = useSyncExternalStore(
    subscribe,
    () =>
      session
        ? `${session.room.status}|${session.room.round}|${JSON.stringify(session.room.suggestions)}|${session.room.quest?.screen.kind}|${session.room.quest?.gold}|${session.room.quest?.deck.join()}|${session.room.quest?.trail.join()}|${session.room.quest?.hearts}`
        : '',
    () => '',
  );
  void view;
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
  const sound = (
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
  );
  const room = session.room;
  const quest = room.quest;
  if (quest && room.status === 'map')
    return (
      <div className="app at-table arena">
        <Suspense
          fallback={
            <main className="startup-loading" aria-busy="true">
              Arena
            </main>
          }
        >
          <QuestView
            q={quest}
            act={(a) => session.quest(a)}
            host={room.host}
            suggestions={room.suggestions}
            onSuggest={(key) => session.suggest(key)}
            onLeave={exit}
            rules={() => setRules(true)}
            sound={sound}
            saved="The quest waits at the table."
            volume={volume}
          />
          <Dialog open={rules} onOpenChange={setRules}>
            <DialogContent className="modal arena-modal arena-rules-modal">
              <DialogTitle>How to play</DialogTitle>
              <DialogDescription className="sr-only">
                Rules of Arena
              </DialogDescription>
              <ArenaRules quest />
              <button
                type="button"
                className="arena-button"
                onClick={() => setRules(false)}
              >
                Back
              </button>
            </DialogContent>
          </Dialog>
        </Suspense>
      </div>
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
          key={quest ? `quest-${room.round}` : 'versus'}
          online={session}
          volume={volume}
          music={ambience}
          onExit={exit}
          sound={sound}
          onFinish={quest && room.host ? () => session.again() : undefined}
          leaveNote={
            quest ? 'A bot plays your seat until you come back.' : undefined
          }
        />
      </Suspense>
    </div>
  );
}
