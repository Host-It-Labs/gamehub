'use client';
import {
  Bot,
  Clock,
  Flag,
  Layers,
  ReceiptText,
  Shuffle,
  Users,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import {
  firstFlight,
  lengths,
  plansPerSeason,
  plans as allPlans,
} from '@/lib/games/alto/content';
import {
  defaultOptions,
  extensionKeys,
  isAltoSave,
  totalTurns,
  turnNumber,
  type AltoGame,
  type AltoOptions,
  type Difficulty,
  type ExtensionKey,
} from '@/lib/games/alto/engine';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { ExtensionChoice } from '../expansions';
import {
  BotLevels,
  PlayButton,
  SetupIntro,
  SetupShell,
  StartGameButton,
} from '../setup-box';
import { Segmented, SetupRow } from '../setup-row';
import { ExtensionRow, SetChoiceRow, SetupOptions } from '../setup-pages';
import { AltoExtensionRules, extensionTitles } from './alto-rules';
import { seasonNames } from '@/lib/games/alto/art';
import { Check } from 'lucide-react';
import { Rules } from '../rules';
import { PlanMark } from './alto-parts';

export type AltoSetup = {
  players: number;
  difficulty: Difficulty;
  options: AltoOptions;
};
const SETUP_KEY = 'gamehub.alto.setup.v1';
export const SAVE_KEY = 'gamehub.alto.v1';

export function readAltoSetup(): AltoSetup {
  const fallback: AltoSetup = {
    players: 3,
    difficulty: 'medium',
    options: defaultOptions(),
  };
  try {
    const raw = JSON.parse(
      localStorage.getItem(SETUP_KEY) ?? 'null',
    ) as Partial<AltoSetup> | null;
    if (!raw) return fallback;
    const players =
      Number.isInteger(raw.players) && raw.players! >= 2 && raw.players! <= 6
        ? raw.players!
        : 3;
    const difficulty = ['easy', 'medium', 'hard'].includes(
      raw.difficulty as string,
    )
      ? raw.difficulty!
      : 'medium';
    const o = raw.options ?? defaultOptions();
    return {
      players,
      difficulty,
      options: {
        length: o.length in lengths ? o.length : 'standard',
        plans: o.plans === 'random' ? 'random' : 'first',
        ...Object.fromEntries(extensionKeys.map((k) => [k, o[k] === true])),
      },
    };
  } catch {
    return fallback;
  }
}
export function saveAltoSetup(setup: AltoSetup) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    // Remembering the setup is a convenience only.
  }
}
export function readAltoSave(): AltoGame | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return isAltoSave(raw) && !raw.tutorial ? raw : null;
  } catch {
    return null;
  }
}

/** Three upgrades fanned out in space; Random adds a shuffle mark. */
function SetFan({
  ids,
  shuffled = false,
}: {
  ids: string[];
  shuffled?: boolean;
}) {
  return (
    <span className="alto-set-fan">
      {ids.map((id) => (
        <span key={id} className="alto-set-medal">
          <PlanMark id={id} size={128} />
        </span>
      ))}
      {shuffled && (
        <span className="alto-set-shuffle">
          <Shuffle size={16} />
        </span>
      )}
    </span>
  );
}

const extensionIcons: Record<ExtensionKey, typeof Sparkles> = {
  winds: Sparkles,
  orders: ReceiptText,
  flags: Flag,
  captains: UserRound,
};

/**
 * Alto's open box: players and bots, how long the voyage runs, which
 * upgrades come up, and the four extensions, each a tile with its rules behind the
 * information mark. Solo it starts a match against bots; at a table the host
 * sets it up for everyone.
 */
export function AltoSetupBox({
  game,
  setup,
  onChange,
  minPlayers = 2,
  disabled = false,
  startDisabled = false,
  online = false,
  save,
  onPlay,
  onLearn,
  onResume,
}: {
  game: LibraryGame;
  setup: AltoSetup;
  onChange: (setup: AltoSetup) => void;
  minPlayers?: number;
  disabled?: boolean;
  startDisabled?: boolean;
  online?: boolean;
  save?: AltoGame | null;
  onPlay: () => void;
  onLearn: () => void;
  onResume?: () => void;
}) {
  const o = setup.options;
  const set = (options: Partial<AltoOptions>) =>
    onChange({ ...setup, options: { ...o, ...options } });
  const resumable = !online && save && !save.over;
  const shown = firstFlight();
  return (
    <SetupShell game={game} className="alto-setup">
      <SetupIntro game={game} />
      <SetupOptions>
        <SetupRow label="Players" Icon={Users}>
          <Segmented
            label="Players"
            className="seg-count"
            disabled={disabled}
            value={setup.players}
            onChange={(players) => onChange({ ...setup, players })}
            options={[2, 3, 4, 5, 6].map((n) => ({
              value: n,
              label: <b>{n}</b>,
              disabled: n < minPlayers,
            }))}
          />
        </SetupRow>
        <SetupRow label="Bots" Icon={Bot}>
          <BotLevels
            value={setup.difficulty}
            onChange={(difficulty) => onChange({ ...setup, difficulty })}
            disabled={disabled}
          />
        </SetupRow>
        <SetupRow label="Voyage" Icon={Clock}>
          <Segmented
            label="Voyage length"
            disabled={disabled}
            value={o.length}
            onChange={(length) => set({ length })}
            options={[
              {
                value: 'short',
                label: (
                  <>
                    <b>Quick</b>
                    <small>{3 * lengths.short} turns</small>
                  </>
                ),
              },
              {
                value: 'standard',
                label: (
                  <>
                    <b>Full</b>
                    <small>{3 * lengths.standard} turns</small>
                  </>
                ),
              },
            ]}
          />
        </SetupRow>
        <SetChoiceRow
          label="Upgrades"
          Icon={Layers}
          disabled={disabled}
          value={o.plans}
          onChange={(v) => set({ plans: v === 'random' ? 'random' : 'first' })}
          cards={[
            {
              value: 'first',
              name: 'First Flight',
              meta: `The same ${3 * plansPerSeason} upgrades`,
              preview: <SetFan ids={[shown[0][0], shown[0][2], shown[0][5]]} />,
            },
            {
              value: 'random',
              name: 'Random',
              meta: `${3 * plansPerSeason} of ${allPlans.length}, all shown`,
              preview: <SetFan ids={['shrine', 'fold', 'sawmill']} shuffled />,
            },
          ].map((card) => ({
            value: card.value,
            card: (
              <label className="set-card alto-set">
                <RadioGroupItem value={card.value} className="sr-only" />
                <span className="set-preview" aria-hidden="true">
                  {card.preview}
                  <span className="set-check">
                    <Check />
                  </span>
                </span>
                <span className="set-copy">
                  <strong>{card.name}</strong>
                  <small>{card.meta}</small>
                </span>
              </label>
            ),
          }))}
        />
        <ExtensionRow
          items={extensionKeys.map((key) => ({
            key,
            on: !!o[key],
            tile: (
              <ExtensionChoice
                title={extensionTitles[key]}
                Icon={extensionIcons[key]}
                enabled={!!o[key]}
                disabled={disabled}
                onChange={() => set({ [key]: !o[key] })}
              >
                <Rules className="alto-rules">
                  <AltoExtensionRules kind={key} />
                </Rules>
              </ExtensionChoice>
            ),
          }))}
        />
      </SetupOptions>
      <div className="setup-actions">
        {online ? (
          <PlayButton
            disabled={disabled || startDisabled}
            data-starts-game
            onClick={onPlay}
          />
        ) : (
          <StartGameButton
            name={game.name}
            saved={!!resumable}
            detail={
              resumable
                ? `${seasonNames[save!.season - 1]}, turn ${turnNumber(save!)} of ${totalTurns(save!)}`
                : undefined
            }
            disabled={disabled || startDisabled}
            onPlay={onPlay}
            onLearn={onLearn}
            onResume={() => onResume?.()}
          />
        )}
      </div>
    </SetupShell>
  );
}
