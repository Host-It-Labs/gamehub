'use client';
import { useEffect, useState } from 'react';
import { Bot, Layers, Swords, Users } from 'lucide-react';
import { cards, deck } from '@/lib/games/arena/cards';
import {
  seatCount,
  type Difficulty,
  type Mode,
  type Side,
} from '@/lib/games/arena/engine';
import type { ArenaLaunch, ArenaTeams } from '@/lib/games/arena/room';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import {
  BotLevels,
  StartGameButton,
  PlayButton,
  SetupIntro,
  SetupShell,
} from '../setup-box';
import { Segmented, SetupRow } from '../setup-row';
import {
  arenaManifest,
  filesFor,
  isCached,
  prefetch,
  totalBytes,
} from './assets';
import { pickQuality } from './quality';
import './arena-box.css';

const KEY = 'gamehub.arena.difficulty';
const MODE_KEY = 'gamehub.arena.mode';
function remembered(): Difficulty {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'easy' || v === 'medium' || v === 'hard') return v;
  } catch {
    // Private windows may block storage.
  }
  return 'medium';
}
function rememberedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'team' ? 'team' : 'duel';
  } catch {
    return 'duel';
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Remembering the choice is a convenience only.
  }
}

type Member = { id: string; name: string };

/** A duel puts two people against each other; a team battle seats friends
 *  together first, with bots making up the numbers. */
function defaultTeams(members: Member[], mode: Mode): ArenaTeams {
  const per = seatCount(mode) / 2;
  const teams: ArenaTeams = {};
  members.forEach((m, i) => {
    teams[m.id] = (mode === 'duel' ? i % 2 : i < per ? 0 : 1) as Side;
  });
  return teams;
}

/**
 * Arena's setup in the library's open-box modal: one against one or two
 * against two, how strong the bots play, the deck everyone holds, and Learn or
 * Play. At a table it also shows who plays on which side, and Play opens an
 * online room for everyone. Opening the box starts fetching the 3D art in the
 * background so the battle is ready sooner.
 */
export function ArenaSetupBox({
  game,
  onPlay,
  table,
}: {
  game: LibraryGame;
  onPlay?: (choice: {
    difficulty: Difficulty;
    mode: Mode;
    learn: boolean;
  }) => void;
  table?: {
    members: Member[];
    disabled: boolean;
    onLaunch: (choice: ArenaLaunch) => Promise<void>;
  };
}) {
  const people = table?.members ?? [];
  const [difficulty, setDifficulty] = useState<Difficulty>(remembered);
  const [chosenMode, setMode] = useState<Mode>(rememberedMode);
  // More than two people only fit a team battle.
  const mode: Mode = people.length > 2 ? 'team' : chosenMode;
  const [picked, setPicked] = useState<{ key: string; teams: ArenaTeams }>();
  const key = `${mode}:${people.map((p) => p.id).join()}`;
  const teams = picked?.key === key ? picked.teams : defaultTeams(people, mode);
  const [cached, setCached] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const { tier } = pickQuality();
    let live = true;
    void isCached(tier).then((hit) => {
      if (!live) return;
      setCached(hit);
      if (!hit) void prefetch(tier);
    });
    return () => {
      live = false;
    };
  }, []);
  const choose = (d: Difficulty) => {
    setDifficulty(d);
    remember(KEY, d);
  };
  const chooseMode = (m: Mode) => {
    setMode(m);
    remember(MODE_KEY, m);
  };
  const per = seatCount(mode) / 2;
  const count = (side: Side) =>
    people.filter((p) => teams[p.id] === side).length;
  const swap = (id: string) => {
    const to: Side = teams[id] === 0 ? 1 : 0;
    if (count(to) >= per) return;
    setPicked({ key, teams: { ...teams, [id]: to } });
  };
  const megabytes = Math.round(
    totalBytes(filesFor(pickQuality().tier)) / 1048576,
  );
  const launch = async () => {
    if (!table) return;
    setBusy(true);
    try {
      await table.onLaunch({ kind: 'arena', mode, difficulty, teams });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SetupShell game={game} className="arena-box">
      <SetupIntro game={game} />
      <div className="setup-options">
        <SetupRow label="Battle" Icon={Swords}>
          <Segmented
            label="Battle"
            className="seg-count"
            disabled={false}
            value={mode}
            onChange={chooseMode}
            options={[
              {
                value: 'duel',
                label: <b>1 v 1</b>,
                disabled: people.length > 2,
              },
              { value: 'team', label: <b>2 v 2</b> },
            ]}
          />
        </SetupRow>
        {table && people.length > 1 && (
          <SetupRow label="Sides" Icon={Users}>
            <div className="arena-box-sides">
              {([0, 1] as Side[]).map((side) => (
                <ul
                  key={side}
                  className={`team-${side}`}
                  aria-label={side ? 'Red' : 'Blue'}
                >
                  {people
                    .filter((p) => teams[p.id] === side)
                    .map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={
                            table.disabled || count(side ? 0 : 1) >= per
                          }
                          aria-label={`${p.name}: move to ${side ? 'blue' : 'red'}`}
                          onClick={() => swap(p.id)}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  {Array.from({ length: per - count(side) }, (_, i) => (
                    <li key={`bot-${i}`} className="bot">
                      <Bot aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </SetupRow>
        )}
        <SetupRow label="Bots" Icon={Bot}>
          <BotLevels value={difficulty} onChange={choose} disabled={false} />
        </SetupRow>
        <SetupRow
          label="Deck"
          Icon={Layers}
          note={
            cached === false
              ? `The first battle downloads about ${megabytes} MB of 3D art, then keeps it on this device.`
              : undefined
          }
        >
          <ul className="arena-box-deck" aria-label="Your eight cards">
            {deck.map((id) => (
              <li key={id} title={cards[id].name}>
                {arenaManifest.cards[id] && (
                  <img
                    src={arenaManifest.cards[id].path}
                    alt={cards[id].name}
                    loading="lazy"
                  />
                )}
                <span>{cards[id].cost}</span>
              </li>
            ))}
          </ul>
        </SetupRow>
      </div>
      <div className="setup-actions">
        {table ? (
          <PlayButton
            data-starts-game
            disabled={table.disabled || busy}
            onClick={() => void launch()}
          />
        ) : (
          <StartGameButton name={game.name} saved={false} onResume={() => {}}
            onLearn={() => onPlay?.({ difficulty, mode, learn: true })}
            onPlay={() => onPlay?.({ difficulty, mode, learn: false })} />
        )}
      </div>
    </SetupShell>
  );
}
