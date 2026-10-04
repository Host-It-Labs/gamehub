'use client';
import { useEffect, useState } from 'react';
import {
  Bot,
  Compass,
  Heart,
  LayoutGrid,
  Layers,
  Lock,
  Shuffle,
  Swords,
  Users,
} from 'lucide-react';
import { allCards, cards, type CardId } from '@/lib/games/arena/cards';
import { LOCKED, REGIONS } from '@/lib/games/arena/quest';
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
import { SetupOptions } from '../setup-pages';
import { Segmented, SetupRow } from '../setup-row';
import {
  arenaManifest,
  filesFor,
  isCached,
  prefetch,
  totalBytes,
} from './assets';
import { pickQuality } from './quality';
import { loadRun, loadUnlocked } from './quest-store';
import { CardBrowser } from './card-info';
import './arena-box.css';

const KEY = 'gamehub.arena.difficulty';
const MODE_KEY = 'gamehub.arena.mode';
const KIND_KEY = 'gamehub.arena.kind';
const DRAFT_KEY = 'gamehub.arena.draft';
function rememberedDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) === 'on';
  } catch {
    return false;
  }
}
type Kind = 'versus' | 'quest';
function rememberedKind(): Kind {
  try {
    return localStorage.getItem(KIND_KEY) === 'quest' ? 'quest' : 'versus';
  } catch {
    return 'versus';
  }
}
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
 * against two, how strong the bots play, whether the decks are drafted, and
 * Learn or Play (decks are picked over the battle's loading screen). At a table it also shows who plays on which side, and Play opens an
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
    deck?: CardId[];
    draft?: boolean;
    quest?: 'new' | 'continue';
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
  const [kind, setKind] = useState<Kind>(rememberedKind);
  // Draft the decks (Split draft) instead of picking one; off by default.
  const [draft, setDraft] = useState(rememberedDraft);
  // The card browser, every card with its stats.
  const [browsing, setBrowsing] = useState(false);
  // What earlier quests left: a run to continue, cards unlocked.
  const [saved] = useState(() => (table ? null : loadRun()));
  const [unlocked] = useState(loadUnlocked);
  // A quest seats one or two.
  const questFits = people.length <= 2;
  const quest = kind === 'quest' && questFits;
  const chooseKind = (k: Kind) => {
    setKind(k);
    remember(KIND_KEY, k);
  };
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
  const chooseDraft = (on: boolean) => {
    setDraft(on);
    remember(DRAFT_KEY, on ? 'on' : 'off');
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
      await table.onLaunch(
        quest
          ? { kind: 'arena', mode: 'team', difficulty, quest: true, unlocked }
          : {
              kind: 'arena',
              mode,
              difficulty,
              teams,
              decks: draft ? 'draft' : 'pick',
            },
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SetupShell game={game} className="arena-box">
      <SetupIntro game={game} />
      <SetupOptions>
        <SetupRow label="Play" Icon={Compass}>
          <Segmented
            label="Play"
            className="seg-count"
            disabled={false}
            value={quest ? 'quest' : 'versus'}
            onChange={chooseKind}
            options={[
              { value: 'versus', label: <b>Versus</b> },
              { value: 'quest', label: <b>Quest</b>, disabled: !questFits },
            ]}
          />
          {/* Every card's stats (card-info.tsx). */}
          <button
            type="button"
            className="arena-box-cards"
            onClick={() => setBrowsing(true)}
          >
            <LayoutGrid aria-hidden="true" />
            <span>Cards</span>
          </button>
        </SetupRow>
        {quest ? (
          <>
            {saved && (
              <SetupRow label="Saved quest" Icon={Heart}>
                <p className="arena-box-run">
                  <b>{REGIONS[saved.region].name}</b>
                  <span aria-label={`${saved.hearts} hearts`}>
                    {Array.from({ length: saved.maxHearts }, (_, i) => (
                      <Heart
                        key={i}
                        data-on={i < saved.hearts}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                  <span className="arena-box-run-deck">
                    {saved.deck.map((id) => (
                      <Card key={id} id={id} />
                    ))}
                  </span>
                </p>
              </SetupRow>
            )}
            <SetupRow
              label="Collection"
              Icon={Layers}
              note={
                cached === false
                  ? `The first battle downloads about ${megabytes} MB of 3D art, then keeps it on this device.`
                  : undefined
              }
            >
              <ul
                className="arena-box-deck collection"
                aria-label="Cards in the quest"
              >
                {allCards.map((id) => {
                  const locked = LOCKED.includes(id) && !unlocked.includes(id);
                  return (
                    <li key={id} title={cards[id].name} data-locked={locked}>
                      <Card id={id} />
                      {locked && (
                        <Lock className="arena-box-lock" aria-label="Locked" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </SetupRow>
          </>
        ) : (
          <>
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
              <BotLevels
                value={difficulty}
                onChange={choose}
                disabled={false}
              />
            </SetupRow>
            <SetupRow
              label="Draft"
              Icon={Shuffle}
              note={
                cached === false
                  ? `The first battle downloads about ${megabytes} MB of 3D art, then keeps it on this device.`
                  : undefined
              }
            >
              <Segmented
                label="Draft"
                className="seg-count"
                disabled={!!table?.disabled}
                value={draft ? 'on' : 'off'}
                onChange={(v) => chooseDraft(v === 'on')}
                options={[
                  { value: 'off', label: <b>Off</b> },
                  { value: 'on', label: <b>On</b> },
                ]}
              />
            </SetupRow>
          </>
        )}
      </SetupOptions>
      <div className="setup-actions">
        {table ? (
          <PlayButton
            data-starts-game
            disabled={table.disabled || busy}
            onClick={() => void launch()}
          />
        ) : (
          <StartGameButton
            name={quest ? 'Quest' : game.name}
            saved={quest && !!saved}
            onResume={() =>
              onPlay?.({ difficulty, mode, learn: false, quest: 'continue' })
            }
            onLearn={() =>
              onPlay?.({ difficulty, mode, learn: true, draft })
            }
            onPlay={() =>
              onPlay?.(
                quest
                  ? { difficulty, mode, learn: false, quest: 'new' }
                  : { difficulty, mode, learn: false, draft },
              )
            }
          />
        )}
      </div>
      <CardBrowser open={browsing} onOpenChange={setBrowsing} />
    </SetupShell>
  );
}

function Card({ id }: { id: CardId }) {
  return (
    <>
      {arenaManifest.cards[id] ? (
        <img
          src={arenaManifest.cards[id].path}
          alt={cards[id].name}
          loading="lazy"
        />
      ) : (
        <i className="arena-box-blank" aria-label={cards[id].name}>
          {cards[id].name[0]}
        </i>
      )}
      <span>{cards[id].cost}</span>
    </>
  );
}
