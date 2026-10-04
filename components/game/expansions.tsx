'use client';
import { useState, useRef, type ReactNode } from 'react';
import {
  Anchor,
  Award,
  Check,
  Coins,
  Footprints,
  Info,
  Crown,
  ReceiptText,
  Store,
  Sun,
  Sunrise,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NewExtensionRules } from './new-extensions';
import { AbilityRules, CustomerOrderRules } from './extension-rules';
import { WildTrailsRules } from './mora-extension';
import { Piece } from './interactions';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { ExtensionRow, SetChoiceRow } from './setup-pages';
import {
  foodsFor,
  seatRange,
  tokenImage,
  yataContentSets,
  yataMenuLevels,
  yataMenuNames,
  yataRounds,
  yataWorldFor,
  type ContentSet,
  type GameId,
  type GameOptions,
} from '@/lib/games/trio/engine';
type Choices = GameOptions & {
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
};
/** One extension: a switch-like toggle (long-press or I for rules) and an info mark. */
export function ExtensionChoice({
  title,
  Icon,
  enabled,
  disabled,
  onChange,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  enabled: boolean;
  disabled: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const tile = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  function openHelp(source?: HTMLElement) {
    returnFocus.current =
      source ??
      tile.current?.querySelector<HTMLButtonElement>('.ext-toggle') ??
      null;
    setOpen(true);
  }
  return (
    <div ref={tile} className={`ext ${enabled ? 'on' : ''}`}>
      <Piece
        className="ext-toggle"
        label={`${title}. ${enabled ? 'Enabled' : 'Disabled'}. Hold or press I for rules.`}
        selected={enabled}
        unavailable={disabled}
        onTap={disabled ? undefined : onChange}
        inspect={() => openHelp()}
      >
        <span className="ext-icon" aria-hidden="true">
          <Icon />
        </span>
        <strong>{title}</strong>
        <span className="ext-switch" aria-hidden="true">
          <i>{enabled && <Check />}</i>
        </span>
      </Piece>
      <button
        type="button"
        className="ext-info"
        aria-label={`${title} rules`}
        aria-haspopup="dialog"
        onClick={(event) => openHelp(event.currentTarget)}
      >
        <Info />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          finalFocus={returnFocus}
          className="modal extension-rules-modal"
        >
          <DialogTitle>{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SetCard = {
  value: string;
  name: string;
  meta: string;
  preview: ReactNode;
};

/** The two ways to set up the box, each shown as what you will play on. */
function setCards(id: GameId): { label: string; cards: SetCard[] } {
  if (id === 'undertow')
    return {
      label: 'Deck',
      cards: [
        {
          value: 'normal',
          name: 'Normal',
          meta: 'Cards to 10 · Storm to 20',
          preview: <DeckFan faces={[1, 10, 20]} />,
        },
        {
          value: 'fast',
          name: 'Fast',
          meta: 'Cards to 5 · Storm to 10',
          preview: <DeckFan faces={[1, 5, 10]} />,
        },
      ],
    };
  if (id === 'wildgrove')
    return {
      label: 'Board',
      cards: [
        {
          value: 'beginner',
          name: 'The Observatory',
          meta: 'Beginner · 2 rounds',
          preview: (
            <BoardPreview src="/art/optimized/mora-observatory-preview-v1.webp" />
          ),
        },
        {
          value: 'intermediate',
          name: 'Floodline Station',
          meta: 'Intermediate · 3 rounds',
          preview: (
            <BoardPreview src="/art/optimized/mora-floodline-preview-v1.webp" />
          ),
        },
        {
          value: 'desert',
          name: 'Sunset Motel',
          meta: 'Intermediate · 3 rounds',
          preview: (
            <BoardPreview src="/art/optimized/mora-motel-preview-v1.webp" />
          ),
        },
        {
          value: 'alpine',
          name: 'Glacier Dam',
          meta: 'Advanced · 4 rounds',
          preview: (
            <BoardPreview src="/art/optimized/mora-dam-preview-v1.webp" />
          ),
        },
      ],
    };
  return {
    label: 'Menu',
    cards: yataContentSets.map((set) => ({
      value: set,
      name: yataMenuNames[set],
      meta: `${yataMenuLevels[set]} · ${yataRounds(set)} rounds`,
      preview: <DishPreview set={set} />,
    })),
  };
}

function BoardPreview({ src }: { src: string }) {
  return (
    <img
      className="set-board"
      src={src}
      alt=""
      width={480}
      height={240}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

function DishPreview({ set }: { set: ContentSet }) {
  return (
    <span className="set-dishes" data-world={yataWorldFor(set)}>
      {foodsFor(set).map((food, kind) => (
        <img
          key={food.name}
          src={tokenImage(kind, true, set)}
          alt=""
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ))}
    </span>
  );
}

function DeckFan({ faces }: { faces: number[] }) {
  return (
    <span className="set-deck">
      {faces.map((face) => (
        <i key={face}>{face}</i>
      ))}
    </span>
  );
}

/** Board (Mora), menu (Yata) or deck (Nox): two picture cards, one chosen. */
export function ContentChoice({
  id,
  options,
  fastMode,
  seatsTaken = 0,
  onChange,
  onFastMode,
  disabled = false,
}: {
  id: GameId;
  options: GameOptions;
  fastMode: boolean;
  /** People already at an online table: the Fast deck deals four hands at most. */
  seatsTaken?: number;
  onChange: (value: GameOptions) => void;
  onFastMode: (on: boolean) => void;
  disabled?: boolean;
}) {
  const { label, cards } = setCards(id);
  const value =
    id === 'undertow'
      ? fastMode
        ? 'fast'
        : 'normal'
      : (options.contentSet ?? 'beginner');
  return (
    <SetChoiceRow
      label={label}
      disabled={disabled}
      value={value}
      onChange={(v) =>
        id === 'undertow'
          ? onFastMode(v === 'fast')
          : onChange({ ...options, contentSet: v as ContentSet })
      }
      cards={cards.map((card) => ({
        value: card.value,
        card: (
          <label className={`set-card ${id}`}>
            <RadioGroupItem
              value={card.value}
              className="sr-only"
              disabled={
                id === 'undertow' &&
                card.value === 'fast' &&
                seatsTaken > seatRange(id, true)[1]
              }
            />
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
  );
}
export function GameExtensionChoices({
  id,
  options,
  customerOrders,
  sanctuaryGoalsEnabled,
  onChange,
  disabled = false,
  fastMode = false,
}: {
  id: GameId;
  options: GameOptions;
  customerOrders: boolean;
  sanctuaryGoalsEnabled: boolean;
  onChange: (value: Choices) => void;
  disabled?: boolean;
  /** Nox's Fast deck, so the rules quote its values. */
  fastMode?: boolean;
}) {
  const values: Choices = {
    ...options,
    customerOrders,
    sanctuaryGoalsEnabled,
  };
  const entries: {
    key: keyof Choices;
    title: string;
    Icon: LucideIcon;
    rules: ReactNode;
    /** The extension cannot apply with this setup. */
    off?: boolean;
  }[] =
    id === 'undertow'
      ? [
          {
            key: 'gold',
            title: 'Gold',
            Icon: Coins,
            rules: <NewExtensionRules kind="gold" fastMode={fastMode} />,
          },
          {
            key: 'anchor',
            title: 'Anchor',
            Icon: Anchor,
            rules: <NewExtensionRules kind="anchor" />,
          },
          {
            key: 'dawn',
            title: 'Dawn',
            Icon: Sunrise,
            rules: <NewExtensionRules kind="dawn" fastMode={fastMode} />,
          },
        ]
      : id === 'wildgrove'
        ? [
            {
              key: 'roamEnabled',
              title: 'Roam',
              Icon: Footprints,
              rules: <NewExtensionRules kind="roamEnabled" />,
            },
            {
              key: 'sanctuaryGoalsEnabled',
              title: 'Sanctuary Goals',
              Icon: Award,
              rules: <WildTrailsRules contentSet={options.contentSet} />,
            },
            {
              key: 'census',
              title: 'Census',
              Icon: Crown,
              rules: <NewExtensionRules kind="census" />,
            },
          ]
        : [
            {
              key: 'customerOrders',
              title: 'Customer Orders',
              Icon: ReceiptText,
              rules: <CustomerOrderRules />,
            },
            {
              key: 'specialtyStalls',
              title: 'Specialty Stalls',
              Icon: Store,
              rules: <AbilityRules />,
            },
            {
              key: 'marketSeasons',
              title: 'Market Seasons',
              Icon: Sun,
              rules: <NewExtensionRules kind="marketSeasons" />,
            },
          ];
  return (
    <ExtensionRow
      items={entries.map((entry) => ({
        key: entry.key,
        on: !!values[entry.key] && !entry.off,
        tile: (
          <ExtensionChoice
            title={entry.title}
            Icon={entry.Icon}
            enabled={!!values[entry.key] && !entry.off}
            disabled={disabled || !!entry.off}
            onChange={() => onChange({ [entry.key]: !values[entry.key] })}
          >
            {entry.rules}
          </ExtensionChoice>
        ),
      }))}
    />
  );
}
