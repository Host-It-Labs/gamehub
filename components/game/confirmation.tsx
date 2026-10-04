'use client';
import { useEffect, useEffectEvent, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
export function useAutoRoll(eligible: boolean, roll: () => void) {
  const performRoll = useEffectEvent(roll);
  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => performRoll(), 450);
    return () => clearTimeout(timer);
  }, [eligible]);
}
import {
  canAct,
  validMove,
  canUndo,
  passCount,
  type PublicGame,
  type Move,
} from '@/lib/games/trio/engine';
/** The lock plate beside the hand for the cards you pass in Nox. Every
 *  other move plays the moment its card is tapped or dropped. */
export function MoveConfirmation({
  g,
  viewer,
  passed,
  onConfirm,
  onClear,
  disabled = false,
}: {
  g: PublicGame;
  viewer: number;
  passed: number[];
  onConfirm: (move: Move) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const choice: Move | null = passed.length
    ? { type: 'pass', cards: passed }
    : null;
  if (g.phase !== 'pass' || !canAct(g, viewer)) return null;
  return (
    <div className="hand-confirmation" data-game-motion="stage" aria-label="Lock your pass">
      <button
        className="primary confirm-action"
        disabled={disabled || !choice || !validMove(g, choice, viewer)}
        onClick={() => {
          if (choice) onConfirm(choice);
        }}
      >
        {`Pass ${passed.length}/${passCount(g)}`}
      </button>
      <button
        className="secondary"
        disabled={disabled || passed.length === 0}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}

/** Stable hand-dock control for local preparation and unrevealed commitments. */
export function UndoChoice({ g, viewer, drafted, disabled = false, onUndo, onClear }: {
  g: PublicGame; viewer: number; drafted: boolean; disabled?: boolean;
  onUndo: () => void; onClear: () => void;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const [dock, setDock] = useState<Element | null>(null);
  useEffect(() => { setDock(marker.current?.closest('.play-area')?.querySelector('.hand-frame') ?? null); }, [g.id]);
  const committed = canUndo(g, viewer);
  return <><span ref={marker} hidden />{dock && createPortal(<button className="undo-choice" disabled={disabled || (!committed && !drafted)}
    onClick={committed ? onUndo : onClear}
    title={committed ? 'Withdraw your choice before everyone finishes' : 'Clear your prepared move'}>
    <span aria-hidden="true">↶</span> Undo
  </button>, dock)}</>;
}
