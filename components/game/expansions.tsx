'use client';
import { useState, useRef, type ReactNode } from 'react';
import {
  Anchor,
  Award,
  Footprints,
  Info,
  MoveRight,
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
import type { GameId, GameOptions } from '@/lib/games/trio/engine';
type Choices = GameOptions & {
  shields?: boolean;
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
};
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
      tile.current?.querySelector<HTMLButtonElement>(
        '.extension-tile-toggle',
      ) ??
      null;
    setOpen(true);
  }
  return (
    <div ref={tile} className={`extension-tile ${enabled ? 'enabled' : ''}`}>
      <Piece
        className="extension-tile-toggle"
        label={`${title}. ${enabled ? 'Enabled' : 'Disabled'}. Hold or press I for rules.`}
        selected={enabled}
        unavailable={disabled}
        onTap={disabled ? undefined : onChange}
        inspect={() => openHelp()}
      >
        <Icon aria-hidden="true" />
        <strong>{title}</strong>
        {enabled && <span className="expansion-check">✓</span>}
      </Piece>
      <button
        type="button"
        className="extension-info"
        aria-label={`${title} rules`}
        aria-haspopup="dialog"
        onClick={(event) => openHelp(event.currentTarget)}
      >
        <Info size={17} />
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
export function ContentChoice({
  id,
  options,
  onChange,
  disabled = false,
}: {
  id: GameId;
  options: GameOptions;
  onChange: (value: GameOptions) => void;
  disabled?: boolean;
}) {
  if (id === 'undertow') return null;
  return (
    <fieldset className="content-choice">
      <legend>{id === 'wildgrove' ? 'Field station' : 'Menu'}</legend>
      <div>
        {(['beginner', 'intermediate'] as const).map((set) => (
          <button
            type="button"
            key={set}
            disabled={disabled}
            aria-pressed={(options.contentSet ?? 'beginner') === set}
            onClick={() => onChange({ ...options, contentSet: set })}
          >
            <strong>
              {id === 'wildgrove'
                ? set === 'beginner'
                  ? 'The Observatory'
                  : 'Floodline Station'
                : set === 'beginner'
                  ? 'After Hours'
                  : 'Side B'}
            </strong>
            <small>
              {set === 'beginner' ? 'Original rules' : 'Alternate scoring'}
            </small>
          </button>
        ))}
      </div>
    </fieldset>
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
    <fieldset className="extension-choices">
      <legend>Extensions</legend>
      <div className="extension-grid">
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
    </fieldset>
  );
}
