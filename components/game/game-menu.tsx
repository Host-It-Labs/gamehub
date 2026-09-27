'use client';
import { useState, type ReactNode } from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import {
  BookOpen,
  EllipsisVertical,
  LogOut,
  Maximize,
  Minimize,
  Play,
  type LucideIcon,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useFullscreen } from './fullscreen-control';
import './game-menu.css';

export type GameMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Toggles show their state and keep the menu open. */
  pressed?: boolean;
};

export type GameMenuProps = {
  /** Game name, read out as the menu's title. */
  name: string;
  /** Tints the panel to the game's world; see game-menu.css. */
  theme?: string;
  onRules: () => void;
  /** Games that pause while the menu is open lead with Resume. */
  onResume?: () => void;
  /** The game's own entries, listed after How to play. */
  items?: GameMenuItem[];
  /** Sound switches, shown inline so sound never opens another window. */
  sound?: ReactNode;
  /** Other inline content: a game's stats, the table host's settings. */
  extra?: ReactNode;
  /** Leaving, always last. */
  onLeave?: () => void;
  leaveLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Replaces the default "⋮ Menu" trigger contents (Arena's pause button). */
  trigger?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
};

/**
 * Every game's menu, the same everywhere: a panel that drops down from the
 * Menu button at the top right, along the side of the screen, and leaves the
 * table in view. Taps outside only close it. The order never changes:
 * (Resume, where the game pauses), How to play, the game's own entries,
 * sound, fullscreen, extra content, then leaving.
 */
export function GameMenu({
  name,
  theme,
  onRules,
  onResume,
  items = [],
  sound,
  extra,
  onLeave,
  leaveLabel = 'Leave',
  open: openProp,
  onOpenChange,
  trigger,
  triggerClassName = 'game-menu-trigger',
  triggerLabel = 'Game menu',
}: GameMenuProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  function setOpen(next: boolean) {
    setOwnOpen(next);
    onOpenChange?.(next);
  }
  function choose(action: () => void) {
    setOpen(false);
    action();
  }
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger className={triggerClassName} aria-label={triggerLabel}>
        {trigger ?? (
          <>
            <EllipsisVertical size={18} aria-hidden="true" />
            <span>Menu</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="game-menu"
        data-menu-theme={theme}
        side="bottom"
        align="end"
        sideOffset={8}
      >
        <PopoverTitle className="sr-only">{name} menu</PopoverTitle>
        <PopoverPrimitive.Close className="sr-only">
          Close menu
        </PopoverPrimitive.Close>
        <div className="game-menu-group">
          {onResume && (
            <button type="button" onClick={() => choose(onResume)}>
              <Play aria-hidden="true" />
              Resume
            </button>
          )}
          <button type="button" onClick={() => choose(onRules)}>
            <BookOpen aria-hidden="true" />
            How to play
          </button>
          {items.map(({ label, icon: Icon, onSelect, disabled, pressed }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              aria-pressed={pressed}
              onClick={() =>
                pressed === undefined ? choose(onSelect) : onSelect()
              }
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {sound && (
          <div className="game-menu-group game-menu-sound">{sound}</div>
        )}
        <FullscreenEntry onDone={() => setOpen(false)} />
        {extra && (
          <div className="game-menu-group game-menu-extra">{extra}</div>
        )}
        {onLeave && (
          <div className="game-menu-group">
            <button
              type="button"
              className="game-menu-leave"
              onClick={() => choose(onLeave)}
            >
              <LogOut aria-hidden="true" />
              {leaveLabel}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Only where the browser can go fullscreen (not iPhone Safari). */
function FullscreenEntry({ onDone }: { onDone: () => void }) {
  const { active, message, toggle } = useFullscreen();
  if (typeof document === 'undefined' || !document.fullscreenEnabled)
    return null;
  return (
    <div className="game-menu-group">
      <button
        type="button"
        data-fullscreen-toggle
        onClick={() => {
          onDone();
          void toggle();
        }}
      >
        {active ? (
          <Minimize aria-hidden="true" />
        ) : (
          <Maximize aria-hidden="true" />
        )}
        {active ? 'Exit fullscreen' : 'Fullscreen'}
      </button>
      {message && <output className="game-menu-message">{message}</output>}
    </div>
  );
}
