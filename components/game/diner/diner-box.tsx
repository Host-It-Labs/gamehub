'use client';
import { useState, type CSSProperties } from 'react';
import { Check, Moon, Users } from 'lucide-react';
import { RadioGroupItem } from '@/components/ui/radio-group';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import {
  MAX_PLAYERS,
  nights,
  NIGHTS,
  type DishId,
  type NightId,
} from '@/lib/games/diner/content';
import {
  PlayButton,
  SetupIntro,
  SetupShell,
  StartGameButton,
} from '../setup-box';
import { SetupRow } from '../setup-row';
import { SetChoiceRow, SetupOptions } from '../setup-pages';
import type { DinerChoice } from './diner-entry';
import { readDiner, rememberNight } from './diner-store';
import { DinerIcon } from './icons';
import { SEAT_COLOURS } from './seats';
import './diner.css';

/** What a table sends to open an online Diner room. */
export type DinerLaunch = { kind: 'diner'; night: NightId };

const menus: Record<NightId, DishId[]> = {
  1: ['burger', 'shake'],
  2: ['burger', 'shake', 'pie'],
  3: ['burger', 'fries', 'shake', 'pie'],
};

/** A night's card picture: its sky through the diner window and its menu. */
function NightPreview({ night }: { night: NightId }) {
  return (
    <span className={`diner-night-art n${night}`} aria-hidden="true">
      <i className="diner-night-moon" />
      <i className="diner-night-sign" />
      {night > 1 && <i className="diner-night-goo" />}
      <span className="diner-night-menu">
        {menus[night].map((d) => (
          <DinerIcon key={d} name={d} />
        ))}
      </span>
    </span>
  );
}

/**
 * Diner's setup in the library's open-box modal: pick a night (its medals
 * shown), then Learn or Play. At a table everyone seated waits tables
 * together and Play opens an online room.
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
  const [record] = useState(readDiner);
  const [night, setNight] = useState<NightId>(record.night);
  const [busy, setBusy] = useState(false);
  const people = table?.players ?? [];
  const tooMany = people.length > MAX_PLAYERS;
  const pick = (n: NightId) => {
    setNight(n);
    rememberNight(n);
  };
  const launch = async () => {
    if (!table) return;
    setBusy(true);
    try {
      await table.onLaunch({ kind: 'diner', night });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SetupShell game={game} className="diner-box">
      <SetupIntro game={game} />
      <SetupOptions>
        <SetChoiceRow
          label="Night"
          Icon={Moon}
          className="diner-nights"
          value={String(night)}
          onChange={(v) => pick(Number(v) as NightId)}
          cards={NIGHTS.map((n) => ({
            value: String(n),
            card: (
              <label className="set-card diner" htmlFor={`diner-night-${n}`}>
                <RadioGroupItem
                  id={`diner-night-${n}`}
                  value={String(n)}
                  className="sr-only"
                />
                <span className="set-preview" aria-hidden="true">
                  <NightPreview night={n} />
                  <span className="set-check">
                    <Check />
                  </span>
                </span>
                <span className="set-copy">
                  <strong>
                    {n}. {nights[n].name}
                  </strong>
                  <small
                    className="diner-night-medals"
                    aria-label={`${record.medals[n]} of 3 medals`}
                  >
                    {[0, 1, 2].map((i) => (
                      <i
                        key={i}
                        className={`m${i} ${i < record.medals[n] ? 'won' : ''}`}
                      />
                    ))}
                  </small>
                </span>
              </label>
            ),
          }))}
        />
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
      <div className="setup-actions">
        {table ? (
          <PlayButton
            data-starts-game
            disabled={table.disabled || busy || tooMany}
            onClick={() => void launch()}
          />
        ) : (
          <StartGameButton
            name={game.name}
            saved={false}
            onLearn={() => onPlay?.({ night, learn: true })}
            onPlay={() => onPlay?.({ night, learn: false })}
            onResume={() => {}}
          />
        )}
      </div>
    </SetupShell>
  );
}
