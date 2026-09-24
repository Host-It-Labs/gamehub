'use client';
import { useState } from 'react';
import {
  EllipsisVertical,
  BookOpen,
  List,
  Trophy,
  Volume2,
  Maximize,
  Minimize,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import { ConfirmMoves } from './confirmation';

export function TableMenu({
  confirmMoves,
  onConfirmMoves,
  onRules,
  onCounts,
  onScores,
  onSound,
  soundLabel = 'Sound settings',
  advanced = false,
  onAdvanced,
  fullscreen,
}: {
  /** When given, fullscreen lives in the menu instead of a separate toolbar button. */
  fullscreen?: { active: boolean; toggle: () => void | Promise<void> };
  advanced?: boolean;
  onAdvanced?: (enabled: boolean) => void;
  confirmMoves: boolean;
  onConfirmMoves: (enabled: boolean) => void;
  onRules: () => void;
  onCounts: () => void;
  onScores: () => void;
  onSound: () => void;
  soundLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  function show(action: () => void) {
    setOpen(false);
    action();
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="table-menu-trigger" aria-label="Game menu">
        <EllipsisVertical size={22} />
        <span>Menu</span>
      </PopoverTrigger>
      <PopoverContent className="table-menu" align="end">
        <PopoverTitle>Game menu</PopoverTitle>
        <button onClick={() => show(onRules)}>
          <BookOpen size={18} />
          How to play
        </button>
        <button onClick={() => show(onCounts)}>
          <List size={18} />
          Card and piece counts
        </button>
        <button onClick={() => show(onScores)}>
          <Trophy size={18} />
          Scores and activity
        </button>
        <button onClick={() => show(onSound)}>
          <Volume2 size={18} />
          {soundLabel}
        </button>
        {fullscreen && (
          <button
            data-fullscreen-toggle
            onClick={() => show(() => void fullscreen.toggle())}
          >
            {fullscreen.active ? (
              <Minimize size={18} />
            ) : (
              <Maximize size={18} />
            )}
            {fullscreen.active ? 'Exit fullscreen' : 'Play fullscreen'}
          </button>
        )}
        <div className="table-menu-preference">
          {onAdvanced && (
            <label className="confirm-moves">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  show(() => onAdvanced(enabled));
                }}
              />
              Advanced view
            </label>
          )}
          <ConfirmMoves enabled={confirmMoves} onChange={onConfirmMoves} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
