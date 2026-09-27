'use client';
import { ArrowLeft, Clock3, Users } from 'lucide-react';
import './game-navigation.css';
import { GameProgress } from './game-progress';
import { GameMenu, type GameMenuProps } from './game-menu';

/** Shared navigation islands for games that do not use the trio table toolbar. */
export function GameNavigation({
  name,
  onBack,
  menu,
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
  /** The shared drop-down menu; its name defaults to the game's. */
  menu: Omit<GameMenuProps, 'name' | 'triggerClassName'> & { name?: string };
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
        <GameMenu
          name={name}
          {...menu}
          triggerClassName="game-navigation-menu"
        />
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
