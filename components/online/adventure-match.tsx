'use client';
import { useEffect, useRef, useState } from 'react';
import type { Table, TableCommand } from '@/lib/online/types';
import { decisionKey } from '@/lib/games/standalone/registry';
import { Users } from 'lucide-react';
import { StandaloneTable } from '../game/standalone-table';
import { SoundSettings, SoundToggle } from '../game/sound-settings';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import {
  readAmbienceLevel,
  saveAmbienceLevel,
  useAmbience,
} from '../game/use-ambience';
export function AdventureMatch({
  table,
  disabled,
  dispatch,
  onHome,
}: {
  table: Table;
  disabled: boolean;
  dispatch: (a: TableCommand) => Promise<boolean>;
  onHome: () => void;
}) {
  const [volume, setVolume] = useState(() => process.env.NODE_ENV === 'development' ? readAudioLevel() : 0.5),
    [ambient, setAmbient] = useState(readAmbienceLevel);
  const g = table.adventure!;
  const moveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ dispatch, g });
  useEffect(() => { latest.current = { dispatch, g }; }, [dispatch, g]);
  // Effects and ambience are switched on and off separately.
  useAmbience(g.over ? null : g.kind, 1, table.ambienceEnabled ? ambient : 0);
  return (
    <>
      <StandaloneTable
        g={g}
        online
        viewerSeat={table.viewerSeat}
        disabled={disabled || table.viewerSeat === null}
        volume={volume}
        onHome={onHome}
        onNew={() => void dispatch({ type: 'abandon' })}
        sound={
          <>
            {table.isHost && (
              <SoundToggle
                Icon={Users}
                label="Table ambience"
                on={table.ambienceEnabled === true}
                onChange={(enabled) =>
                  void dispatch({ type: 'ambience', enabled })
                }
              />
            )}
            <SoundSettings
              volume={volume}
              ambience={ambient}
              onVolume={(level) => {
                setVolume(level);
                if (process.env.NODE_ENV === 'development') saveAudioLevel(level);
              }}
              onAmbience={(level) => {
                setAmbient(level);
                saveAmbienceLevel(level);
              }}
            />
          </>
        }
        onMove={(move) => {
          const key = decisionKey(g);
          moveQueue.current = moveQueue.current.then(async () => {
            if (decisionKey(latest.current.g) !== key) return;
            await latest.current.dispatch({ type: 'adventure-move', move, key });
          });
        }}
        onLesson={(step) => void dispatch({ type: 'lesson', step })}
        onAdvance={() => void dispatch({ type: 'advance-practice' })}
        onBegin={() => void dispatch({ type: 'begin-match' })}
        canTeach={table.isHost}
        canAdvance={table.canAdvance}
        hostName={table.members.find((m) => m.host)?.name}
        hostSeat={table.members.find((m) => m.host)?.seat ?? null}
        awaySeats={table.members.flatMap((m) =>
          m.seat !== null && !m.connected ? [m.seat] : [],
        )}
        canPickNext={table.isHost}
        nextVote={table.status === 'finished' ? table.nextVote : null}
        viewerId={table.viewerId}
        onNextGame={(gameId) => void dispatch({ type: 'next-game', gameId })}
      />
    </>
  );
}
