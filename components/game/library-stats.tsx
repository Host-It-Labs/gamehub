'use client';
import { type ReactNode } from 'react';
import { Clock, Handshake, Swords, Users, type LucideIcon } from 'lucide-react';
import {
  playerRange,
  playersSpoken,
  type LibraryGame,
} from '@/lib/games/library-fixtures';

export function Stat({
  icon: Icon,
  children,
  label,
}: {
  icon: LucideIcon;
  children: ReactNode;
  label: string;
}) {
  return (
    <span className="stat" aria-label={label}>
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

/** How long a game runs. */
export function Time({ game }: { game: LibraryGame }) {
  return (
    <Stat icon={Clock} label={game.durationSpoken}>
      {game.duration}
    </Stat>
  );
}

/** What kind of game it is, on one plain badge. */
export function Kind({ game }: { game: LibraryGame }) {
  return (
    <span className="stat kind">
      <span>{game.kind}</span>
    </span>
  );
}

/**
 * Time and the kind of game. The setup lid (`full`) adds the player count
 * and the mode; the library leaves the count out.
 */
export function StatStrip({
  game,
  full = false,
}: {
  game: LibraryGame;
  full?: boolean;
}) {
  return (
    <span className={`stat-strip ${full ? 'full' : ''}`}>
      <Time game={game} />
      {full && (
        <>
          <Stat icon={Users} label={playersSpoken(game.players)}>
            {playerRange(game.players)}
          </Stat>
          <Stat
            icon={game.mode === 'Co-op' ? Handshake : Swords}
            label={`Mode: ${game.mode}`}
          >
            {game.mode}
          </Stat>
        </>
      )}
      <Kind game={game} />
    </span>
  );
}
