'use client';
import { useState } from 'react';
import type { Table, TableCommand } from '@/lib/online/types';
import { decisionKey } from '@/lib/games/standalone/registry';
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
  useAmbience(g.kind, volume, ambient);
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
        onMove={(move) =>
          void dispatch({ type: 'adventure-move', move, key: decisionKey(g) })
        }
        onLesson={(step) => void dispatch({ type: 'lesson', step })}
        onAdvance={() => void dispatch({ type: 'advance-practice' })}
        onBegin={() => void dispatch({ type: 'begin-match' })}
        canTeach={table.isHost}
      />
      <Dialog open={sound} onOpenChange={setSound}>
        <DialogContent>
          <DialogTitle>Sound</DialogTitle>
          <DialogDescription>
            Your sound settings only affect this device.
          </DialogDescription>
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
