'use client';
import { ArrowLeft, Clock3, EllipsisVertical, Users } from 'lucide-react';
import './game-navigation.css';
import { GameProgress } from './game-progress';

/** Shared navigation islands for games that do not use the trio table toolbar. */
export function GameNavigation({
  name,
  onBack,
  onMenu,
  onOthers,
  othersLabel = 'Others',
  onAdvance,
  round,
  progress,
}: {
  name: string;
  /** Other progress, shown small beneath the back control. */
  progress?: string;
  /** A fixed round count, shown as a pill centred on the top bar. */
  round?: string;
  onBack: () => void;
  onMenu: () => void;
  /** Omitted where there is nothing private to look at (Know Me, Quiz). */
  onOthers?: () => void;
  othersLabel?: string;
  onAdvance?: () => void;
}) {
  return (
    <nav className="game-navigation" aria-label="Game navigation">
      <button
        className="game-navigation-back"
        onClick={onBack}
        aria-label={`Leave ${name} and go back`}
      >
        <ArrowLeft size={18} />
        <span>{name}</span>
      </button>
      {round ? (
        <GameProgress round label={round} />
      ) : (
        progress && <GameProgress label={progress} />
      )}
      <div className="game-navigation-actions">
        {onAdvance && (
          <button className="game-navigation-time" onClick={onAdvance}>
            <Clock3 size={18} />
            <span>Advance time</span>
          </button>
        )}
        <button className="game-navigation-menu" onClick={onMenu}>
          <EllipsisVertical size={18} />
          <span>Menu</span>
        </button>
        {onOthers && (
          <button className="game-navigation-others" onClick={onOthers}>
            <Users size={18} />
            <span>{othersLabel}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
