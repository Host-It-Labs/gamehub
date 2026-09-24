'use client';
import { useState, type ReactNode } from 'react';
import {
  Calendar,
  ChevronRight,
  Clock,
  Handshake,
  Heart,
  House,
  LayoutGrid,
  Library as LibraryIcon,
  List,
  Moon,
  Play,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { GameBox } from './game-box';
import type { Game, GameId } from '@/lib/games/trio/engine';
import type { AnyGame } from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import {
  filters,
  friendById,
  gameByLibraryId,
  heroGameId,
  initials,
  libraryGames,
  openTables,
  playerRange,
  realGames,
  shelves,
  weeklyLeaders,
  you,
  type Friend,
  type LibraryGame,
} from '@/lib/games/library-fixtures';
import './library.css';

const shelfIcons: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  handshake: Handshake,
  zap: Zap,
  users: Users,
};

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
      <Stat icon={Clock} label={game.durationLabel ?? `${game.minutes} minutes`}>
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
  return !!game.bookmark;
}

function ShelfTile({
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
  return (
    <li className="shelf-item">
      <button
        type="button"
        className="gbox-button shelf-box"
        onClick={() => onOpen(game)}
        aria-label={`${game.name}. ${game.durationLabel ?? `${game.minutes} minutes`}, ${playerRange(game.players)} players${marked ? ', match in progress' : ''}. Open`}
      >
        <GameBox game={game} width={126} sizes="360px">
          {marked && <span className="gbox-ribbon" />}
        </GameBox>
        <span className="shelf-item-details">
          <span className="shelf-item-name">{game.name}</span>
          <StatStrip game={game} />
          <AvatarStack ids={game.playing} size={20} />
        </span>
      </button>
    </li>
  );
}

function Hero({
  game,
  saves,
  own,
  onOpen,
  onPlay,
}: {
  game: LibraryGame;
  saves: Partial<Record<GameId, Game>>;
  own: Partial<Record<StandaloneId, AnyGame>>;
  onOpen: (game: LibraryGame) => void;
  onPlay: (game: LibraryGame) => void;
}) {
  const online = game.playing.length
    ? [...game.playing, 'dev', 'lina', 'tomas', 'noor'].slice(0, 6)
    : [];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <span className="hero-eyebrow">
        <Moon aria-hidden="true" />
        Tonight
      </span>
      <button
        type="button"
        className="gbox-button hero-box"
        onClick={() => onOpen(game)}
        aria-label={`Open ${game.name}`}
      >
        <GameBox game={game} width={215} sizes="640px">
          {inProgress(game, saves, own) && <span className="gbox-ribbon" />}
        </GameBox>
      </button>
      <div className="hero-copy">
        <h1 id="hero-title">{game.name}</h1>
        <p className="hero-world">{game.world}</p>
        <StatStrip game={game} full />
        <span className="stat-strip genre-strip">
          <span className="stat">
            <Sparkles aria-hidden="true" />
            <span>{game.genre}</span>
          </span>
        </span>
        <div className="hero-friends">
          <AvatarStack ids={online} size={34} max={6} />
          <small>{online.length} friends online</small>
        </div>
        <button
          type="button"
          className="play-button"
          onClick={() => onPlay(game)}
        >
          <Play aria-hidden="true" />
          Play
        </button>
      </div>
    </section>
  );
}

function LiveColumn({ onOpen }: { onOpen: (game: LibraryGame) => void }) {
  return (
    <aside className="live-column" aria-label="Friends and tables">
      <section className="panel" aria-labelledby="tables-title">
        <h2 id="tables-title" className="panel-title">
          <span className="live-dot" aria-hidden="true" />
          Tables open now
        </h2>
        <ul className="open-tables">
          {openTables.map((table) => {
            const game = gameByLibraryId(table.game)!;
            return (
              <li key={table.game}>
                <button
                  type="button"
                  className="open-table"
                  onClick={() => onOpen(game)}
                  aria-label={`${game.name}, ${table.seated} of ${table.capacity} seats taken. Open`}
                >
                  <GameBox game={game} width={64} sizes="140px" />
                  <span className="open-table-name">{game.name}</span>
                  <span className="open-table-seats">
                    <Users aria-hidden="true" />
                    {table.seated}/{table.capacity}
                  </span>
                  <AvatarStack ids={table.players} size={22} />
                  <ChevronRight className="chevron" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="panel" aria-labelledby="leaders-title">
        <h2 id="leaders-title" className="panel-title">
          <Trophy aria-hidden="true" />
          Weekly leaders
        </h2>
        <ol className="leaders">
          {weeklyLeaders.map((entry, index) => {
            const friend = friendById(entry.friend);
            return (
              <li key={entry.friend}>
                <span className="rank">{index + 1}</span>
                <Avatar friend={friend} size={26} />
                <span className="leader-name">{friend.name}</span>
                <span
                  className="leader-bar"
                  style={{
                    width: `${(entry.score / weeklyLeaders[0].score) * 100}%`,
                  }}
                  aria-hidden="true"
                />
                <b>{entry.score}</b>
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
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
  onOpenPlaceholder: (game: LibraryGame) => void;
  onSound: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const hero = realGames[heroGameId];
  const needle = query.trim().toLowerCase();

  function open(game: LibraryGame) {
    // Folio and Relic open their own box in the modal, like the placeholders.
    if (game.gameId) onSetup(game.gameId);
    else if (game.standaloneId) onStandalone(game.standaloneId);
    else onOpenPlaceholder(game);
  }
  function matches(game: LibraryGame) {
    if (needle && !game.name.toLowerCase().includes(needle)) return false;
    if (activeFilters.includes('Quick') && game.minutes > 20) return false;
    if (activeFilters.includes('Co-op') && game.mode !== 'Co-op') return false;
    if (activeFilters.includes('Light') && game.weight > 2) return false;
    if (activeFilters.includes('Friends') && !game.playing.length) return false;
    if (activeFilters.includes('New') && !shelves[0].games.includes(game.id))
      return false;
    return true;
  }
  const filtering = !!needle || activeFilters.length > 0;
  const visibleShelves = filtering
    ? [
        {
          id: 'results',
          title: 'Matching games',
          icon: 'sparkles',
          games: libraryGames.filter(matches).map((g) => g.id),
        },
      ]
    : shelves;

  return (
    <div className={`night-library view-${view}`}>
      <nav className="rail" aria-label="Gamehub">
        <a className="rail-brand" href="/" aria-label="Gamehub home">
          g
        </a>
        <button
          type="button"
          className="rail-item is-active"
          aria-current="page"
          title="Home"
        >
          <House aria-hidden="true" />
          <span>Home</span>
        </button>
        <button type="button" className="rail-item" title="Library">
          <LibraryIcon aria-hidden="true" />
          <span>Library</span>
        </button>
        <a className="rail-item" href="/tables" title="Play with friends">
          <Users aria-hidden="true" />
          <span>Play with friends</span>
        </a>
        <button type="button" className="rail-item" title="Game nights">
          <Calendar aria-hidden="true" />
          <span>Game nights</span>
        </button>
        <button type="button" className="rail-item" title="Favourites">
          <Heart aria-hidden="true" />
          <span>Favourites</span>
        </button>
        <button
          type="button"
          className="rail-item rail-settings"
          onClick={onSound}
          title="Settings"
        >
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>
      <main className="library-main" aria-label="Games">
        <header className="library-bar">
          <a className="bar-brand" href="/" aria-label="Gamehub home">
            <span className="rail-brand">g</span>
            <span>gamehub</span>
          </a>
          <div className="filter-row">
            {filters.map((filter) => {
              const on = activeFilters.includes(filter);
              const Icon =
                filter === 'Quick'
                  ? Zap
                  : filter === 'Co-op'
                    ? Handshake
                    : filter === 'Light'
                      ? Sparkles
                      : filter === 'Friends'
                        ? Users
                        : Trophy;
              return (
                <button
                  type="button"
                  key={filter}
                  className={`chip ${on ? 'is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() =>
                    setActiveFilters((current) =>
                      on
                        ? current.filter((f) => f !== filter)
                        : [...current, filter],
                    )
                  }
                >
                  <Icon aria-hidden="true" />
                  {filter}
                </button>
              );
            })}
          </div>
          <label className="search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search games"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search games"
            />
          </label>
          <div className="bar-tools">
            <button
              type="button"
              className={`tool ${view === 'grid' ? 'is-active' : ''}`}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              onClick={() => setView('grid')}
            >
              <LayoutGrid aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`tool ${view === 'list' ? 'is-active' : ''}`}
              aria-pressed={view === 'list'}
              aria-label="List view"
              onClick={() => setView('list')}
            >
              <List aria-hidden="true" />
            </button>
            <button type="button" className="tool" aria-label="Filters">
              <SlidersHorizontal aria-hidden="true" />
            </button>
            <button
              type="button"
              className="tool sound-tool"
              onClick={onSound}
              aria-label="Sound settings"
            >
              {volume ? (
                <Volume2 aria-hidden="true" />
              ) : (
                <VolumeX aria-hidden="true" />
              )}
            </button>
            <a
              className="bar-friends"
              href="/tables"
              aria-label="Play with friends"
            >
              <Users aria-hidden="true" />
              <span>Play with friends</span>
            </a>
            <button type="button" className="account" aria-label="Your account">
              <Avatar friend={you} size={34} />
            </button>
          </div>
        </header>
        <div className="library-top">
          <Hero
            game={hero}
            saves={saves}
            own={own}
            onOpen={open}
            onPlay={(game) => game.gameId && onSetup(game.gameId)}
          />
          <LiveColumn onOpen={open} />
        </div>
        {visibleShelves.map((shelf) => {
          const Icon = shelfIcons[shelf.icon] ?? Sparkles;
          const games = shelf.games
            .map((id) => gameByLibraryId(id))
            .filter((g): g is LibraryGame => !!g);
          return (
            <section
              className="shelf"
              key={shelf.id}
              aria-labelledby={`shelf-${shelf.id}`}
            >
              <h2 id={`shelf-${shelf.id}`} className="shelf-title">
                <Icon aria-hidden="true" />
                {shelf.title}
                {filtering && <small>{games.length}</small>}
              </h2>
              {games.length ? (
                <ul className="shelf-row">
                  {games.map((game) => (
                    <ShelfTile
                      key={`${shelf.id}-${game.id}`}
                      game={game}
                      saves={saves}
                      own={own}
                      onOpen={open}
                    />
                  ))}
                </ul>
              ) : (
                <p className="shelf-empty">Nothing on this shelf matches.</p>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
