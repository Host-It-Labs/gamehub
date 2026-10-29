'use client';
import { useState } from 'react';
import { Bot, Users } from 'lucide-react';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import {
  EXTENSIONS,
  MAX_SEATS,
  noExtensions,
  type Difficulty,
  type Extensions,
} from '@/lib/games/metro/engine';
import type { MetroLaunch } from '@/lib/games/metro/room';
import { ExtensionChoice } from '../expansions';
import { BotLevels, PlayButton, SetupIntro, SetupShell, StartGameButton } from '../setup-box';
import { Segmented, SetupRow } from '../setup-row';
import { ExtensionRow, SetupOptions } from '../setup-pages';
import { ExtensionRules, extensionIcons, extensionNames } from './metro-rules';
import { readMetroSave, type MetroChoice } from './metro-save';
import './metro.css';

const KEY = 'gamehub.metro.setup.v1';
type Stored = { ext: Extensions; difficulty: Difficulty; seats: number };
function remembered(): Stored {
  const fallback: Stored = { ext: { ...noExtensions }, difficulty: 'medium', seats: 3 };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!v || typeof v !== 'object') return fallback;
    return {
      ext: Object.fromEntries(EXTENSIONS.map((e) => [e, v.ext?.[e] === true])) as Extensions,
      difficulty: ['easy', 'medium', 'hard'].includes(v.difficulty) ? v.difficulty : 'medium',
      seats: Number.isInteger(v.seats) && v.seats >= 1 && v.seats <= MAX_SEATS ? v.seats : 3,
    };
  } catch {
    return fallback;
  }
}
function remember(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // A convenience only.
  }
}

/**
 * Metro's setup in the library's open-box modal: how many sit at the table,
 * how the bots play, the extensions, then Learn or Play. At a table everyone
 * seated plays, bots fill the rest, and Play opens an online room.
 */
export function MetroSetupBox({
  game,
  onPlay,
  table,
}: {
  game: LibraryGame;
  onPlay?: (choice: MetroChoice) => void;
  table?: {
    players: string[];
    disabled: boolean;
    onLaunch: (launch: MetroLaunch) => Promise<void>;
  };
}) {
  const [choice, setChoice] = useState<Stored>(remembered);
  const [busy, setBusy] = useState(false);
  const [saved] = useState(() => (table ? null : readMetroSave()));
  const people = table?.players.length ?? 1;
  const seats = Math.max(people, choice.seats);
  const update = (next: Partial<Stored>) => {
    const merged = { ...choice, ...next };
    setChoice(merged);
    remember(merged);
  };
  const launch = async () => {
    if (!table) return;
    setBusy(true);
    try {
      await table.onLaunch({
        kind: 'metro',
        map: 'city',
        ext: choice.ext,
        difficulty: choice.difficulty,
        seats,
      });
    } finally {
      setBusy(false);
    }
  };
  const solo = { ...choice, seats };
  return (
    <SetupShell game={game} className="metro-box">
      <SetupIntro game={game} />
      <SetupOptions>
        <SetupRow label="Players" Icon={Users}>
          <Segmented
            label="Players"
            className="seg-count"
            value={seats}
            onChange={(n) => update({ seats: n })}
            options={Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => ({
              value: n,
              label: <b>{n}</b>,
              disabled: n < people,
            }))}
          />
        </SetupRow>
        <SetupRow label="Bots" Icon={Bot}>
          <BotLevels
            value={choice.difficulty}
            onChange={(d) => update({ difficulty: d })}
            disabled={seats <= people}
          />
        </SetupRow>
        <ExtensionRow
          items={EXTENSIONS.map((e) => ({
            key: e,
            on: choice.ext[e],
            tile: (
              <ExtensionChoice
                title={extensionNames[e]}
                Icon={extensionIcons[e]}
                enabled={choice.ext[e]}
                disabled={false}
                onChange={() => update({ ext: { ...choice.ext, [e]: !choice.ext[e] } })}
              >
                <ExtensionRules id={e} />
              </ExtensionChoice>
            ),
          }))}
        />
      </SetupOptions>
      <div className="setup-actions">
        {table ? (
          <PlayButton data-starts-game disabled={table.disabled || busy} onClick={() => void launch()} />
        ) : (
          <StartGameButton
            name={game.name}
            saved={!!saved}
            detail={saved ? `Round ${saved.round} of ${saved.rounds}` : undefined}
            onLearn={() => onPlay?.({ ...solo, learn: true })}
            onPlay={() => onPlay?.(solo)}
            onResume={() => onPlay?.({ ...solo, resume: true })}
          />
        )}
      </div>
    </SetupShell>
  );
}
