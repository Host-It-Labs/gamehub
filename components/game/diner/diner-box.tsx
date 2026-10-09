'use client';
import { useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Layers, Route, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import { MAX_PLAYERS } from '@/lib/games/diner/content';
import { CHAPTERS, LEVEL_COUNT, levelById } from '@/lib/games/diner/levels';
import { PLACES } from '@/lib/games/diner/road';
import { dinerPlaceUrl } from '@/lib/games/diner/art';
import { runActive } from '@/lib/games/diner/campaign';
import {
  PlayButton,
  SetupIntro,
  SetupShell,
  StartGameButton,
} from '../setup-box';
import { Segmented, SetupRow } from '../setup-row';
import { SetupOptions } from '../setup-pages';
import type { DinerChoice } from './diner-entry';
import {
  levelOpen,
  levelsFinished,
  nextLevel,
  readCampaign,
  readLevels,
  restartCampaign,
} from './diner-store';
import { SEAT_COLOURS } from './seats';
import './diner.css';

/** What a table sends to open an online Diner room. */
export type DinerLaunch = { kind: 'diner'; level: number };

/** A level's postcard, number and name. */
function LevelCard({ id, medals }: { id: number; medals?: number }) {
  const l = levelById(id);
  return (
    <span
      className="diner-box-level"
      style={{ '--place': PLACES[l.place].colour } as CSSProperties}
    >
      <span
        className="diner-box-level-art"
        style={{ backgroundImage: `url(${dinerPlaceUrl(l.place)})` }}
        aria-hidden="true"
      >
        <b>{l.id}</b>
      </span>
      <span className="diner-box-level-copy">
        <strong>{l.name}</strong>
        <small>
          {CHAPTERS[l.chapter].name}
          {l.boss ? ' · Boss' : ''}
        </small>
        {medals !== undefined && (
          <span
            className="diner-level-medals"
            aria-label={`${medals} of 3 medals`}
          >
            {[0, 1, 2].map((i) => (
              <i key={i} className={`m${i}`} data-won={i < medals} />
            ))}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Diner's setup in the library's open-box modal. Alone: the campaign (one
 * night on the road, a roguelite) or the levels (forty shifts, each opened by
 * finishing the one before). At a table everyone seated waits tables
 * together on a level the host has opened, and Play opens an online room.
 */
export function DinerSetupBox({
  game,
  onPlay,
  table,
}: {
  game: LibraryGame;
  onPlay?: (choice: DinerChoice) => void;
  table?: {
    players: string[];
    disabled: boolean;
    onLaunch: (launch: DinerLaunch) => Promise<void>;
  };
}) {
  const [levels] = useState(readLevels);
  const [campaign] = useState(readCampaign);
  const [mode, setMode] = useState<'campaign' | 'levels'>(
    table ? 'levels' : 'campaign',
  );
  const highest = (() => {
    let top = 1;
    for (let id = 1; id <= LEVEL_COUNT; id++)
      if (levelOpen(levels, id)) top = id;
    return top;
  })();
  const [level, setLevel] = useState(() => Math.min(highest, levels.last));
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const people = table?.players ?? [];
  const tooMany = people.length > MAX_PLAYERS;
  const run = campaign.run;
  const active = runActive(run);
  const launch = async () => {
    if (!table) return;
    setBusy(true);
    try {
      await table.onLaunch({ kind: 'diner', level });
    } finally {
      setBusy(false);
    }
  };
  const play = () => {
    if (mode === 'campaign' && active) setAsking(true);
    else onPlay?.({ mode, learn: false });
  };
  return (
    <SetupShell game={game} className="diner-box">
      <SetupIntro game={game} />
      <SetupOptions>
        {!table && (
          <SetupRow label="Mode" Icon={Route}>
            <Segmented
              label="Diner mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'campaign', label: 'Campaign' },
                { value: 'levels', label: 'Levels' },
              ]}
            />
          </SetupRow>
        )}
        {!table && mode === 'campaign' ? (
          <SetupRow
            label="The night road"
            Icon={Route}
            className="diner-campaign-preview-row"
          >
            <div className="diner-campaign-preview">
              <Route aria-hidden="true" />
              <strong>
                {active && run
                  ? `Stop ${Math.max(1, run.visited.length)} · ${run.lives} lives`
                  : '3 legs · 3 bosses'}
              </strong>
              <span>
                Drive the truck, pick one of two stops, keep the diner going.
              </span>
            </div>
          </SetupRow>
        ) : !table ? (
          <SetupRow
            label="Next level"
            Icon={Layers}
            note={`${levelsFinished(levels)} of ${LEVEL_COUNT} levels finished`}
          >
            <LevelCard
              id={nextLevel(levels)}
              medals={levels.medals[nextLevel(levels) - 1]}
            />
          </SetupRow>
        ) : (
          <SetupRow
            label="Level"
            Icon={Layers}
            aside={
              <span className="diner-box-pager">
                <button
                  type="button"
                  aria-label="Previous level"
                  disabled={level <= 1}
                  onClick={() => setLevel((l) => Math.max(1, l - 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Next level"
                  disabled={level >= highest}
                  onClick={() => setLevel((l) => Math.min(highest, l + 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </span>
            }
          >
            <LevelCard id={level} medals={levels.medals[level - 1]} />
          </SetupRow>
        )}
        {table && (
          <SetupRow
            label="Waiters"
            Icon={Users}
            note={tooMany ? `Up to ${MAX_PLAYERS} waiters.` : undefined}
          >
            <ul className="diner-box-waiters">
              {people.slice(0, MAX_PLAYERS).map((name, i) => (
                <li
                  key={i}
                  style={{ '--seat': SEAT_COLOURS[i] } as CSSProperties}
                >
                  <i />
                  {name}
                </li>
              ))}
            </ul>
          </SetupRow>
        )}
      </SetupOptions>
      {/* Play here starts a sideways game: phones lock to landscape. */}
      <div className="setup-actions" data-landscape>
        {table ? (
          <PlayButton
            data-starts-game
            data-landscape
            disabled={table.disabled || busy || tooMany}
            onClick={() => void launch()}
          />
        ) : (
          <StartGameButton
            name={game.name}
            saved={mode === 'campaign' && active}
            detail={
              mode === 'campaign' && active && run
                ? `Stop ${Math.max(1, run.visited.length)}`
                : undefined
            }
            onLearn={() => onPlay?.({ mode, learn: true })}
            onPlay={play}
            onResume={() => onPlay?.({ mode, learn: false })}
          />
        )}
      </div>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="modal diner-modal diner-new-run">
          <DialogTitle>Start a new run?</DialogTitle>
          <DialogDescription>
            {run
              ? `Your run at stop ${Math.max(1, run.visited.length)} ends. Tokens you banked stay.`
              : 'Tokens you banked stay.'}
          </DialogDescription>
          <button
            type="button"
            className="diner-button"
            data-starts-game
            data-landscape
            onClick={() => {
              setAsking(false);
              try {
                restartCampaign(crypto.getRandomValues(new Uint32Array(1))[0]);
              } catch {
                // Storage refused: the campaign starts from what it can read.
              }
              onPlay?.({ mode: 'campaign', learn: false });
            }}
          >
            New run
          </button>
          <button
            type="button"
            className="diner-button quiet"
            data-starts-game
            data-landscape
            onClick={() => {
              setAsking(false);
              onPlay?.({ mode: 'campaign', learn: false });
            }}
          >
            Continue
          </button>
        </DialogContent>
      </Dialog>
    </SetupShell>
  );
}
