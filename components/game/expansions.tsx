'use client';
import { useState, useRef, type ReactNode } from 'react';
import {
  Anchor,
  Award,
  Check,
  Footprints,
  Info,
  MoveRight,
  Puzzle,
  ReceiptText,
  Shield,
  Store,
  Sun,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NewExtensionRules } from './new-extensions';
import { AbilityRules, CustomerOrderRules } from './extension-rules';
import { WildTrailsRules } from './mora-extension';
import { Piece } from './interactions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SetupRow } from './setup-row';
import {
  foodsFor,
  tokenImage,
  type ContentSet,
  type GameId,
  type GameOptions,
} from '@/lib/games/trio/engine';
type Choices = GameOptions & {
  shields?: boolean;
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
};
/** One extension: a switch-like toggle (long-press or I for rules) and an info mark. */
function ExtensionChoice({
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
          meta: 'Cards 1 to 10',
          preview: <DeckFan faces={[1, 6, 10]} />,
        },
        {
          value: 'fast',
          name: 'Fast',
          meta: 'Cards 1 to 5',
          preview: <DeckFan faces={[1, 3, 5]} />,
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
      ],
    };
  return {
    label: 'Menu',
    cards: (['beginner', 'intermediate'] as const).map((set) => ({
      value: set,
      name: set === 'beginner' ? 'After Hours' : 'Side B',
      meta: set === 'beginner' ? 'Original scoring' : 'Alternate scoring',
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
    <span className="set-dishes">
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
  onChange,
  onFastMode,
  disabled = false,
}: {
  id: GameId;
  options: GameOptions;
  fastMode: boolean;
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
    <SetupRow label={label} className="setup-sets">
      <RadioGroup
        aria-label={label}
        disabled={disabled}
        className="set-cards"
        value={value}
        onValueChange={(v) =>
          id === 'undertow'
            ? onFastMode(v === 'fast')
            : onChange({ ...options, contentSet: v as ContentSet })
        }
      >
        {cards.map((card) => (
          <label key={card.value} className={`set-card ${id}`}>
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
        ))}
      </RadioGroup>
    </SetupRow>
  );
}
export function GameExtensionChoices({
  id,
  options,
  shields,
  customerOrders,
  sanctuaryGoalsEnabled,
  onChange,
  disabled = false,
}: {
  id: GameId;
  options: GameOptions;
  shields: boolean;
  customerOrders: boolean;
  sanctuaryGoalsEnabled: boolean;
  onChange: (value: Choices) => void;
  disabled?: boolean;
}) {
  const values: Choices = {
    ...options,
    shields,
    customerOrders,
    sanctuaryGoalsEnabled,
  };
  const entries: {
    key: keyof Choices;
    title: string;
    Icon: LucideIcon;
    rules: ReactNode;
  }[] =
    id === 'undertow'
      ? [
          {
            key: 'shields',
            title: 'Shields',
            Icon: Shield,
            rules: <AbilityRules kind="shield" />,
          },
          {
            key: 'turningTide',
            title: 'Turning Tide',
            Icon: Waves,
            rules: <NewExtensionRules kind="turningTide" />,
          },
          {
            key: 'salvage',
            title: 'Salvage',
            Icon: Anchor,
            rules: <NewExtensionRules kind="salvage" />,
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
              key: 'migration',
              title: 'Migration',
              Icon: MoveRight,
              rules: <NewExtensionRules kind="migration" />,
            },
            {
              key: 'sanctuaryGoalsEnabled',
              title: 'Sanctuary Goals',
              Icon: Award,
              rules: <WildTrailsRules contentSet={options.contentSet} />,
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
              rules: <AbilityRules kind="stall" />,
            },
            {
              key: 'marketSeasons',
              title: 'Market Seasons',
              Icon: Sun,
              rules: <NewExtensionRules kind="marketSeasons" />,
            },
          ];
  return (
    <SetupRow label="Extensions" Icon={Puzzle} className="setup-extensions">
      <div className="ext-list">
        {entries.map((entry) => (
          <ExtensionChoice
            key={entry.key}
            title={entry.title}
            Icon={entry.Icon}
            enabled={!!values[entry.key]}
            disabled={disabled}
            onChange={() => onChange({ [entry.key]: !values[entry.key] })}
          >
            {entry.rules}
          </ExtensionChoice>
        ))}
      </div>
    </SetupRow>
  );
}
