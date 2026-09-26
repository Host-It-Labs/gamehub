'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Handshake,
  Menu,
  Search,
  Swords,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { GameBox, SealedBox } from './game-box';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { SoundSettings } from './sound-settings';
import { ThemeButton, ThemeSwitch } from './theme-control';
import type { GameId } from '@/lib/games/trio/engine';
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
      <Stat icon={Clock} label={game.durationSpoken}>
        {game.duration}
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

/**
 * One box on a shelf and its time and player badges. The cover carries the
 * name. The landing library and the table lobby both show games with this tile.
 */
export function ShelfTile({
  game,
  label,
  className = '',
  disabled,
  pressed,
  onOpen,
  children,
}: {
  game: LibraryGame;
  /** What the button does, e.g. "Open" or "Set up"; the badges are added. */
  label: string;
  className?: string;
  disabled?: boolean;
  pressed?: boolean;
  onOpen: (game: LibraryGame) => void;
  children?: ReactNode;
}) {
  return (
    <li className={`lib-tile ${className}`}>
      <button
        type="button"
        className="gbox-button lib-tile-button"
        disabled={disabled}
        aria-pressed={pressed}
        onClick={() => onOpen(game)}
        aria-label={`${game.name}. ${game.durationSpoken}, ${playerRange(game.players)} players. ${label}`}
      >
        <GameBox
          game={game}
          width={150}
          sizes="(max-width: 700px) 34vw, 400px"
        />
        <StatStrip game={game} />
        {children}
      </button>
    </li>
  );
}

/** Every shelf row is at least this many boxes long; sealed boxes fill the
 *  rest, so each kind of game reads as a shelf with room for more. */
const ROW_LENGTH = 8;
const MIN_SEALED = 3;

/**
 * One kind of game as a horizontal shelf: the title, arrows on the right that
 * page through it, then the boxes followed by sealed boxes for games to come.
 * The landing library and the table lobby share it.
 */
export function ShelfRow({
  id,
  title,
  count,
  sealed = true,
  children,
}: {
  id: string;
  title: string;
  /** How many real boxes the row holds, to size the sealed run after them. */
  count: number;
  sealed?: boolean;
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEnds({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);
  function page(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const tile = el.querySelector('li')?.getBoundingClientRect().width ?? 0;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * Math.max(tile, el.clientWidth - tile),
      behavior: still ? 'auto' : 'smooth',
    });
  }
  const filler = sealed ? Math.max(MIN_SEALED, ROW_LENGTH - count) : 0;
  const scrolls = !(ends.start && ends.end);
  return (
    <section className="lib-section" aria-labelledby={id}>
      <div className="lib-section-head">
        <h2 id={id} className="lib-section-title">
          {title}
        </h2>
        <div className={`lib-arrows ${scrolls ? '' : 'is-still'}`}>
          <button
            type="button"
            className="lib-arrow"
            aria-label={`Previous ${title} games`}
            aria-controls={`${id}-track`}
            disabled={ends.start}
            onClick={() => page(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lib-arrow"
            aria-label={`More ${title} games`}
            aria-controls={`${id}-track`}
            disabled={ends.end}
            onClick={() => page(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        id={`${id}-track`}
        className={`lib-grid ${ends.start ? '' : 'has-less'} ${ends.end ? '' : 'has-more'}`}
        onScroll={measure}
      >
        {children}
        {Array.from({ length: filler }, (_, i) => (
          <li
            key={`sealed-${i}`}
            className="lib-tile is-sealed"
            aria-hidden="true"
          >
            <span className="gbox-button lib-tile-button">
              <SealedBox width={150} />
              <span className="stat-strip">
                <span className="stat" />
                <span className="stat" />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Library({
  volume,
  ambience,
  onSetup,
  onStandalone,
  onOpenPlaceholder,
  onSound,
  onVolume,
  onAmbience,
}: {
  volume: number;
  ambience: number;
  onSetup: (id: GameId) => void;
  onStandalone: (id: StandaloneId) => void;
  /** Games without an engine id (Folio, Relic) open their own box. */
  onOpenPlaceholder: (game: LibraryGame) => void;
  /** Wide screens open the sound dialog; phones switch sounds in the menu. */
  onSound: () => void;
  onVolume: (level: number) => void;
  onAmbience: (level: number) => void;
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
          <ThemeButton className="lib-sound lib-wide-only" />
          <button
            type="button"
            className="lib-sound lib-wide-only"
            onClick={onSound}
            aria-label="Sound settings"
          >
            {volume ? (
              <Volume2 aria-hidden="true" />
            ) : (
              <VolumeX aria-hidden="true" />
            )}
          </button>
          <Popover>
            <PopoverTrigger
              className="lib-sound lib-phone-only"
              aria-label="Menu"
            >
              <Menu aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent className="lib-menu" align="end" sideOffset={8}>
              <SoundSettings
                volume={volume}
                ambience={ambience}
                onVolume={onVolume}
                onAmbience={onAmbience}
              />
              <ThemeSwitch />
            </PopoverContent>
          </Popover>
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
              <ShelfRow
                key={section.id}
                id={`lib-${section.id}`}
                title={section.title}
                count={section.entries.length}
                sealed={!needle}
              >
                {section.entries.map((game) => (
                  <ShelfTile
                    key={game.id}
                    game={game}
                    label="Open"
                    onOpen={open}
                  />
                ))}
              </ShelfRow>
            ))}
          </div>
        ) : (
          <p className="lib-empty">No game matches “{query.trim()}”.</p>
        )}
      </main>
    </div>
  );
}
