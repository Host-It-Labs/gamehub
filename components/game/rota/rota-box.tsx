'use client';
import { useEffect, useState } from 'react';
import {
  Bot,
  Check,
  House,
  Pickaxe,
  ScrollText,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { RadioGroupItem } from '@/components/ui/radio-group';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import { emptyCells } from '@/lib/games/rota/board';
import {
  EXTENSIONS,
  noExtensions,
  type Difficulty,
  type Extension,
  type Extensions,
} from '@/lib/games/rota/engine';
import { MAP_IDS, maps, type MapId } from '@/lib/games/rota/maps';
import { ExtensionChoice } from '../expansions';
import {
  BotLevels,
  PlayButton,
  RatedBar,
  type RatedSetup,
  SetupIntro,
  SetupShell,
  StartGameButton,
} from '../setup-box';
import { Segmented, SetupRow } from '../setup-row';
import { ExtensionRow, SetChoiceRow, SetupOptions } from '../setup-pages';
import { ExtensionRules, extensionNames } from './rota-rules';
import { readRotaSave, type RotaChoice } from './rota-save';
import { Sheet } from './sheet';
import './rota.css';

/** What a table sends to open an online Rota room. */
export type RotaLaunch = {
  kind: 'rota';
  map: MapId;
  ext: Extensions;
  difficulty: Difficulty;
  seats: number;
};

const KEY = 'gamehub.rota.setup.v1';
type Stored = {
  map: MapId;
  ext: Extensions;
  difficulty: Difficulty;
  seats: number;
};
function remembered(): Stored {
  const fallback: Stored = {
    map: 'meadow',
    ext: { ...noExtensions },
    difficulty: 'medium',
    seats: 3,
  };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!v || typeof v !== 'object') return fallback;
    return {
      map: MAP_IDS.includes(v.map) ? v.map : fallback.map,
      ext: Object.fromEntries(
        EXTENSIONS.map((e) => [e, v.ext?.[e] === true]),
      ) as Extensions,
      difficulty: ['easy', 'medium', 'hard'].includes(v.difficulty)
        ? v.difficulty
        : 'medium',
      seats:
        Number.isInteger(v.seats) && v.seats >= 1 && v.seats <= 6 ? v.seats : 3,
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

export const extensionIcons: Record<Extension, LucideIcon> = {
  rivers: Waves,
  plans: ScrollText,
  towns: House,
  rockfall: Pickaxe,
};

/** A map card's picture: the empty sheet itself, exits, sea and peaks. */
function MapPreview({ id }: { id: MapId }) {
  const m = maps[id];
  return (
    <Sheet
      map={m}
      cells={emptyCells(m)}
      rubble={[]}
      towns={[]}
      className="rota-map-preview"
      label={m.name}
    />
  );
}

/**
 * Rota's setup in the library's open-box modal: the map, the extensions, how
 * many sit at the table, how the bots play, then Learn or Play. At a table
 * everyone seated plays, bots fill the rest, and Play opens an online room.
 */
export function RotaSetupBox({
  game,
  onPlay,
  table,
  rated,
}: {
  game: LibraryGame;
  onPlay?: (choice: RotaChoice) => void;
  /** Solo setup only: Hard games, and every game alone, are rated and run
   *  on the server. */
  rated?: Omit<RatedSetup, 'onPlay'> & { onPlay: (choice: RotaChoice) => void };
  table?: {
    players: string[];
    disabled: boolean;
    onLaunch: (launch: RotaLaunch) => Promise<void>;
  };
}) {
  const [choice, setChoice] = useState<Stored>(remembered);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Fetch the town's models while the box is open: the board then opens
  // with them already in hand.
  useEffect(() => {
    const t = setTimeout(() => {
      void import('./three/assets')
        .then((a) => a.library(a.pickTier()))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, []);
  const [saved] = useState(() => (table ? null : readRotaSave()));
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
        kind: 'rota',
        map: choice.map,
        ext: choice.ext,
        difficulty: choice.difficulty,
        seats,
      });
    } finally {
      setBusy(false);
    }
  };
  const solo = { ...choice, seats };
  const ratedOn = !table && !!rated;
  // Alone there are no bots: every solo town is a best score.
  const isRated = ratedOn && (seats === 1 || choice.difficulty === 'hard');
  const ratedBusy = !!rated?.busy;
  const ratedRun = rated?.active && (isRated || !saved) ? rated.active : undefined;
  const ratedSetup: RatedSetup | undefined = rated && {
    ...rated,
    onPlay: () => rated.onPlay({ ...solo, difficulty: seats === 1 ? choice.difficulty : 'hard' }),
  };
  return (
    <SetupShell game={game} className="rota-box">
      <SetupIntro game={game} />
      <SetupOptions>
        <SetupRow label="Players" Icon={Users}>
          <Segmented
            label="Players"
            className="seg-count"
            value={seats}
            disabled={ratedBusy}
            onChange={(n) => {
              setConfirming(false);
              update({ seats: n });
            }}
            options={[1, 2, 3, 4, 5, 6].map((n) => ({
              value: n,
              label: <b>{n}</b>,
              disabled: n < people,
            }))}
          />
        </SetupRow>
        <SetupRow label="Bots" Icon={Bot}>
          <BotLevels
            value={choice.difficulty}
            onChange={(d) => {
              setConfirming(false);
              rated?.onDismissError();
              update({ difficulty: d });
            }}
            disabled={seats <= people || ratedBusy}
            rated={ratedOn}
          />
        </SetupRow>
        <SetChoiceRow
          label="Map"
          className="rota-maps"
          value={choice.map}
          disabled={ratedBusy}
          onChange={(v) => update({ map: v as MapId })}
          cards={MAP_IDS.map((id) => ({
            value: id,
            card: (
              <label className="set-card rota" htmlFor={`rota-map-${id}`}>
                <RadioGroupItem
                  id={`rota-map-${id}`}
                  value={id}
                  className="sr-only"
                />
                <span className="set-preview" aria-hidden="true">
                  <MapPreview id={id} />
                  <span className="set-check">
                    <Check />
                  </span>
                </span>
                <span className="set-copy">
                  <strong>{maps[id].name}</strong>
                  <small>
                    {maps[id].level} · {maps[id].rounds} rounds
                  </small>
                </span>
              </label>
            ),
          }))}
        />
        <ExtensionRow
          items={EXTENSIONS.map((e) => ({
            key: e,
            on: choice.ext[e],
            tile: (
              <ExtensionChoice
                title={extensionNames[e]}
                Icon={extensionIcons[e]}
                enabled={choice.ext[e]}
                disabled={ratedBusy}
                onChange={() =>
                  update({ ext: { ...choice.ext, [e]: !choice.ext[e] } })
                }
              >
                <ExtensionRules id={e} />
              </ExtensionChoice>
            ),
          }))}
        />
      </SetupOptions>
      {ratedSetup && (
        <RatedBar
          rated={ratedSetup}
          confirming={confirming}
          onCancel={() => setConfirming(false)}
          onUnrated={() => {
            ratedSetup.onDismissError();
            onPlay?.(solo);
          }}
        />
      )}
      <div className="setup-actions">
        {table ? (
          <PlayButton
            data-starts-game
            disabled={table.disabled || busy}
            onClick={() => void launch()}
          />
        ) : (
          <StartGameButton
            name={game.name}
            saved={!!ratedRun || !!saved}
            disabled={ratedBusy}
            rated={isRated}
            detail={
              ratedRun
                ? `Rated · round ${ratedRun.round} of ${ratedRun.rounds}`
                : saved
                  ? `${maps[saved.map].name}, round ${saved.round} of ${saved.rounds}`
                  : undefined
            }
            onLearn={() => onPlay?.({ ...solo, learn: true })}
            onPlay={() => {
              if (!isRated || !ratedSetup) return onPlay?.(solo);
              if (ratedSetup.active && !confirming) return setConfirming(true);
              ratedSetup.onPlay();
            }}
            onResume={() =>
              ratedRun ? window.location.assign(ratedRun.url) : onPlay?.({ ...solo, resume: true })
            }
          />
        )}
      </div>
    </SetupShell>
  );
}
