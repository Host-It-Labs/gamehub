'use client';
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Clock,
  Handshake,
  Search,
  Swords,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { GameBox } from './game-box';
import type { Game, GameId } from '@/lib/games/trio/engine';
import type { AnyGame } from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import {
  friendById,
  gameByLibraryId,
  initials,
  librarySections,
  libraryGames,
  playerRange,
  type Friend,
  type LibraryGame,
} from '@/lib/games/library-fixtures';
import './library.css';

export function Avatar({
  friend,
  size = 28,
}: {
  friend: Friend;
  size?: number;
}) {
  return (
    <span
      className={`avatar ${friend.online ? 'online' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: `hsl(${friend.hue} 45% 78%)`,
        color: `hsl(${friend.hue} 40% 24%)`,
      }}
      title={friend.name}
    >
      {initials(friend.name)}
    </span>
  );
}
export function AvatarStack({
  ids,
  size = 24,
  max = 3,
}: {
  ids: string[];
  size?: number;
  max?: number;
}) {
  if (!ids.length) return null;
  const shown = ids.slice(0, max);
  return (
    <span className="avatar-stack" aria-label={`${ids.length} playing now`}>
      {shown.map((id) => (
        <Avatar key={id} friend={friendById(id)} size={size} />
      ))}
      {ids.length > max && (
        <span className="avatar-more" style={{ width: size, height: size }}>
          +{ids.length - max}
        </span>
      )}
    </span>
  );
}

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
export function Weight({ value }: { value: number }) {
  return (
    <span className="stat" aria-label={`Weight ${value} of 4`}>
      <span className="weight" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <i key={step} className={step <= value ? 'on' : ''} />
        ))}
      </span>
      <span>{['Light', 'Light', 'Medium', 'Heavy'][value - 1]}</span>
    </span>
  );
}
export function StatStrip({
  game,
  full = false,
}: {
  game: LibraryGame;
  full?: boolean;
}) {
  return (
    <span className={`stat-strip ${full ? 'full' : ''}`}>
      <Stat
        icon={Clock}
        label={game.durationLabel ?? `${game.minutes} minutes`}
      >
        {game.durationLabel ?? `${game.minutes} min`}
      </Stat>
      <Stat icon={Users} label={`${playerRange(game.players)} players`}>
        {playerRange(game.players)}
      </Stat>
      {full && (
        <>
          <Stat
            icon={game.mode === 'Co-op' ? Handshake : Swords}
            label={`Mode: ${game.mode}`}
          >
            {game.mode}
          </Stat>
          <Weight value={game.weight} />
        </>
      )}
    </span>
  );
}

/** The search field earns its place once the catalog outgrows a glance. */
const SEARCH_FROM = 13;

function inProgress(
  game: LibraryGame,
  saves: Partial<Record<GameId, Game>>,
  own: Partial<Record<StandaloneId, AnyGame>>,
) {
  if (game.gameId) {
    const save = saves[game.gameId];
    return !!save && save.phase !== 'over';
  }
  if (game.standaloneId) {
    const save = own[game.standaloneId];
    return !!save && !save.over;
  }
  return false;
}

function GameTile({
  game,
  saves,
  own,
  onOpen,
}: {
  game: LibraryGame;
  saves: Partial<Record<GameId, Game>>;
  own: Partial<Record<StandaloneId, AnyGame>>;
  onOpen: (game: LibraryGame) => void;
}) {
  const marked = inProgress(game, saves, own);
  const time = game.durationLabel ?? `${game.minutes} min`;
  return (
    <li className="lib-tile">
      <button
        type="button"
        className="gbox-button lib-tile-button"
        onClick={() => onOpen(game)}
        aria-label={`${game.name}. ${time}, ${playerRange(game.players)} players${marked ? ', match in progress' : ''}. Open`}
      >
        <GameBox game={game} width={150} sizes="(max-width: 700px) 34vw, 400px">
          {marked && <span className="gbox-ribbon" />}
        </GameBox>
        <span className="lib-tile-name">{game.name}</span>
        <span className="lib-tile-meta">
          <Users aria-hidden="true" />
          {playerRange(game.players)}
          <span className="lib-tile-dot" aria-hidden="true" />
          {time}
        </span>
      </button>
    </li>
  );
}

export function Library({
  saves,
  own,
  volume,
  onSetup,
  onStandalone,
  onOpenPlaceholder,
  onSound,
}: {
  saves: Partial<Record<GameId, Game>>;
  /** Saved matches for the games that run on their own rules module. */
  own: Partial<Record<StandaloneId, AnyGame>>;
  volume: number;
  onSetup: (id: GameId) => void;
  onStandalone: (id: StandaloneId) => void;
  /** Games without an engine id (Folio, Relic) open their own box. */
  onOpenPlaceholder: (game: LibraryGame) => void;
  onSound: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const searchable = libraryGames.length >= SEARCH_FROM;

  function open(game: LibraryGame) {
    if (game.gameId) onSetup(game.gameId);
    else if (game.standaloneId) onStandalone(game.standaloneId);
    else onOpenPlaceholder(game);
  }
  const matches = (game: LibraryGame) =>
    !needle ||
    game.name.toLowerCase().includes(needle) ||
    game.genre.toLowerCase().includes(needle);
  const sections = librarySections
    .map((section) => ({
      ...section,
      entries: section.games
        .map((id) => gameByLibraryId(id))
        .filter((g): g is LibraryGame => !!g && matches(g)),
    }))
    .filter((section) => section.entries.length);

  return (
    <div className="night-library">
      <header className="lib-bar">
        <a className="lib-brand" href="/" aria-label="Gamehub home">
          <span className="lib-brand-mark" aria-hidden="true">
            g
          </span>
          <span>gamehub</span>
        </a>
        {searchable && (
          <label className="lib-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search games"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search games"
            />
          </label>
        )}
        <div className="lib-actions">
          <button
            type="button"
            className="lib-sound"
            onClick={onSound}
            aria-label="Sound settings"
          >
            {volume ? (
              <Volume2 aria-hidden="true" />
            ) : (
              <VolumeX aria-hidden="true" />
            )}
          </button>
          <a className="lib-friends" href="/tables">
            <Users aria-hidden="true" />
            <span>Play with friends</span>
          </a>
        </div>
      </header>
      <main className="lib-main" aria-labelledby="lib-title">
        <h1 id="lib-title" className="sr-only">
          Games
        </h1>
        {sections.length ? (
          <div className="lib-sections">
            {sections.map((section) => (
              <section
                className="lib-section"
                key={section.id}
                aria-labelledby={`lib-${section.id}`}
                style={{ '--n': section.entries.length } as CSSProperties}
              >
                <h2 id={`lib-${section.id}`} className="lib-section-title">
                  {section.title}
                </h2>
                <ul className="lib-grid">
                  {section.entries.map((game) => (
                    <GameTile
                      key={game.id}
                      game={game}
                      saves={saves}
                      own={own}
                      onOpen={open}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="lib-empty">No game matches “{query.trim()}”.</p>
        )}
      </main>
    </div>
  );
}
