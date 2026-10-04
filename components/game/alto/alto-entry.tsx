'use client';
import { useState } from 'react';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import type { AltoGame } from '@/lib/games/alto/engine';
import type { AltoLaunch } from '@/lib/games/alto/room';
import {
  AltoSetupBox,
  readAltoSave,
  readAltoSetup,
  saveAltoSetup,
  type AltoSetup,
} from './alto-box';
import { newAltoMatch } from './alto-match';

/** What the library's box starts: a new or saved match, and its setup. */
export type AltoChoice = { game: AltoGame; setup: AltoSetup };

/**
 * Alto's box in the library, remembering the last setup on this device. Solo
 * it starts a match against bots or continues the saved one; at a table the
 * host's Play opens an online room for everyone seated.
 */
export function AltoSetupEntry({
  game,
  onPlay,
  table,
}: {
  game: LibraryGame;
  onPlay?: (choice: AltoChoice) => void;
  table?: {
    players: string[];
    disabled: boolean;
    onLaunch: (launch: AltoLaunch) => Promise<void>;
  };
}) {
  const [setup, setSetup] = useState<AltoSetup>(() => readAltoSetup());
  // The box only ever opens in the browser, after the library has loaded.
  const [save] = useState<AltoGame | null>(() =>
    table ? null : readAltoSave(),
  );
  const people = table?.players.length ?? 1;
  const seats = Math.max(setup.players, people, 2);
  const change = (next: AltoSetup) => {
    setSetup(next);
    saveAltoSetup(next);
  };
  const start = (learn: boolean) => {
    const chosen = { ...setup, players: seats };
    if (table)
      void table.onLaunch({
        kind: 'alto',
        seats,
        difficulty: chosen.difficulty,
        options: chosen.options,
      });
    else onPlay?.({ game: newAltoMatch(chosen, learn), setup: chosen });
  };
  return (
    <AltoSetupBox
      game={game}
      setup={{ ...setup, players: seats }}
      onChange={change}
      minPlayers={Math.max(2, people)}
      online={!!table}
      disabled={table?.disabled ?? false}
      save={save}
      onPlay={() => start(false)}
      onLearn={() => start(true)}
      onResume={() => save && onPlay?.({ game: save, setup })}
    />
  );
}
