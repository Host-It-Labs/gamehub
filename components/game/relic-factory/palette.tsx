'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Coins,
  Eraser,
  Hand,
  Lock,
  MousePointer2,
  Redo2,
  Undo2,
} from 'lucide-react';
import { formatNumber } from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  MACHINES,
  ORDER,
  kindOpen,
  machinePrice,
  type FactoryState,
  type MachineKind,
} from '@/lib/games/relic/factory';
import type { ScratchState } from '@/lib/games/relic/scratch';
import { MachineIcon } from './machine-icon';

/** Each machine's own colour, shared by its palette tile and the floor. */
export const MACHINE_COLOUR: Record<MachineKind, string> = {
  printer: '#2f6fe0',
  belt: '#ffc940',
  bot: '#ff8a2a',
  cashier: '#1fa36a',
  splitter: '#ffc940',
  lamp: '#7b5cff',
  stamper: '#e0413a',
  gilder: '#f2b632',
  charm: '#b07cf0',
  bundler: '#e0559b',
};
/** Number keys pick machines in palette order: 1–9, then 0. */
export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export type PaletteTool = 'select' | 'erase' | 'build' | 'paste';

const isMac = () =>
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const never = () => () => {};
/** Whether the command key (Ctrl off a Mac) is held, and which it is.
 * Undo and redo show their keys only while it is held. */
function useCommandKey(on: boolean) {
  const [held, setHeld] = useState(false);
  const mac = useSyncExternalStore(never, isMac, () => false);
  useEffect(() => {
    if (!on) return;
    const sync = (event: KeyboardEvent) =>
      setHeld(isMac() ? event.metaKey : event.ctrlKey);
    const release = () => setHeld(false);
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [on]);
  return {
    held: on && held,
    undo: mac ? '⌘Z' : 'Ctrl Z',
    redo: mac ? '⇧⌘Z' : 'Ctrl Y',
  };
}

/** The space bar's mark, drawn rather than spelled out. */
function SpaceKey() {
  return (
    <kbd className="rf-space-key" aria-hidden="true">
      <svg viewBox="0 0 14 6" width="14" height="6">
        <path
          d="M1.5 1v3.5h11V1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </kbd>
  );
}

/** The tool rail (select, erase, pan; undo, redo) and the machines to
 * build. */
export function FactoryPalette({
  f,
  state,
  coins,
  mode,
  panning,
  canPan,
  held,
  preview,
  hints,
  canUndo,
  canRedo,
  onSelect,
  onErase,
  onPan,
  onUndo,
  onRedo,
  onPick,
}: {
  f: FactoryState;
  state: ScratchState;
  coins: number;
  mode: PaletteTool;
  panning: boolean;
  canPan: boolean;
  held: MachineKind | null;
  preview: MachineKind | null;
  hints: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSelect: () => void;
  onErase: () => void;
  onPan: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPick: (kind: MachineKind) => void;
}) {
  const command = useCommandKey(hints);
  return (
    <aside className="rf-palette" aria-label="Machines">
      <div className="rf-rail" role="toolbar" aria-label="Tools">
        <button
          type="button"
          aria-pressed={mode === 'select' && !panning}
          aria-keyshortcuts="V"
          aria-label="Select"
          title="Select (V)"
          onClick={onSelect}
        >
          <MousePointer2 size={18} />
          {hints && <kbd>V</kbd>}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'erase' && !panning}
          aria-keyshortcuts="E"
          aria-label="Erase"
          title="Erase (E)"
          onClick={onErase}
        >
          <Eraser size={18} />
          {hints && <kbd>E</kbd>}
        </button>
        <button
          type="button"
          aria-pressed={panning}
          aria-keyshortcuts="Space"
          aria-label="Pan"
          title="Pan (Space), or drag with two fingers or the right mouse button"
          disabled={!canPan}
          onClick={onPan}
        >
          <Hand size={18} />
          {hints && <SpaceKey />}
        </button>
        <button
          type="button"
          aria-keyshortcuts="Meta+Z Control+Z"
          aria-label="Undo"
          title={`Undo (${command.undo})`}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={18} />
          {command.held && <kbd className="rf-command-key">{command.undo}</kbd>}
        </button>
        <button
          type="button"
          aria-keyshortcuts="Meta+Shift+Z Control+Y"
          aria-label="Redo"
          title={`Redo (${command.redo})`}
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={18} />
          {command.held && <kbd className="rf-command-key">{command.redo}</kbd>}
        </button>
      </div>
      <div className="rf-parts">
        {ORDER.map((kind, i) => {
          const open = kindOpen(f, kind),
            blueprint = BLUEPRINTS.find((b) => b.kinds.includes(kind))!,
            price = open ? machinePrice(f, kind, 0, state) : blueprint.price;
          return (
            <button
              key={kind}
              type="button"
              className={`rf-part family-${MACHINES[kind].family} ${open ? '' : 'is-locked'} ${preview === kind ? 'is-previewed' : ''}`}
              style={
                { '--machine': MACHINE_COLOUR[kind] } as React.CSSProperties
              }
              aria-pressed={open ? held === kind : preview === kind}
              aria-keyshortcuts={DIGITS[i]}
              title={`${MACHINES[kind].name}${DIGITS[i] ? ` (${DIGITS[i]})` : ''}`}
              onClick={() => onPick(kind)}
            >
              <span className="rf-part-art">
                <MachineIcon kind={kind} />
                {!open && <Lock size={14} className="rf-part-lock" />}
              </span>
              <b>{MACHINES[kind].name}</b>
              <small className={coins < price ? 'is-short' : ''}>
                <Coins size={10} />
                {formatNumber(price)}
              </small>
              {hints && DIGITS[i] && <kbd>{DIGITS[i]}</kbd>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
