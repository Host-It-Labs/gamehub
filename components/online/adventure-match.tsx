'use client';
import { useEffect, useRef, useState } from 'react';
import type { Table, TableCommand } from '@/lib/online/types';
import { decisionKey } from '@/lib/games/standalone/registry';
import { TableAmbienceControl } from './table-ambience-control';
import { StandaloneTable } from '../game/standalone-table';
import {
  readAmbienceLevel,
  saveAmbienceLevel,
  useAmbience,
} from '../game/use-ambience';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
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
  const [volume, setVolume] = useState(0.5),
    [ambient, setAmbient] = useState(readAmbienceLevel),
    [sound, setSound] = useState(false);
  const g = table.adventure!;
  const moveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ dispatch, g });
  useEffect(() => { latest.current = { dispatch, g }; }, [dispatch, g]);
  useAmbience(g.over ? null : g.kind, volume, table.ambienceEnabled ? ambient : 0);
  return (
    <>
      <StandaloneTable
        g={g}
        online
        viewerSeat={table.viewerSeat ?? 0}
        disabled={disabled || table.viewerSeat === null}
        volume={volume}
        onHome={onHome}
        onNew={() => void dispatch({ type: 'abandon' })}
        onSound={() => setSound(true)}
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
        nextVote={table.status === 'finished' ? table.nextVote : null}
        viewerId={table.viewerId}
        onNextGame={(gameId) => void dispatch({ type: 'next-game', gameId })}
      />
      <Dialog open={sound} onOpenChange={setSound}>
        <DialogContent>
          <DialogTitle>Sound</DialogTitle>
          <DialogDescription>
            The host controls background sounds for the table. Volume sliders only affect this device.
          </DialogDescription>
          <TableAmbienceControl table={table} disabled={disabled} dispatch={dispatch} />
          <label>
            Effects
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
          <label>
            Ambience
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ambient}
              onChange={(e) => {
                setAmbient(Number(e.target.value));
                saveAmbienceLevel(Number(e.target.value));
              }}
            />
          </label>
        </DialogContent>
      </Dialog>
    </>
  );
}
