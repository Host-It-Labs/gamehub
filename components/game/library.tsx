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
  Menu,
  Search,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameCard } from './game-card';
import { Showcase } from './library-showcase';
import { StatStrip } from './library-stats';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { SoundSettings } from './sound-settings';
import { ThemeButton, ThemeSwitch } from './theme-control';
import { useDragScroll } from './use-drag-scroll';
import type { GameId } from '@/lib/games/trio/engine';
import type { StandaloneId } from '@/lib/games/standalone/types';
import {
  friendById,
  gameByLibraryId,
  initials,
  librarySections,
  libraryGames,
  showcaseGames,
  type Friend,
  type LibraryGame,
} from '@/lib/games/library-fixtures';
import {
  byRecent,
  readLastPlayed,
  recordLastPlayed,
} from '@/lib/games/library-recent';
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

export { Kind, Stat, StatStrip } from './library-stats';

/** The search field earns its place once the catalog outgrows a glance. */
const SEARCH_FROM = 13;

/**
 * One game on a shelf: its cover (which carries the game's title), then its
 * time and depth. Hovering it on a desktop plays the game's footage in the
 * cover's square. The landing library and the table lobby both show games
 * with this tile.
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
  const [previewing, setPreviewing] = useState(false);
  return (
    <li className={`lib-tile ${className}`}>
      <button
        type="button"
        className="lib-tile-button"
        disabled={disabled}
        aria-pressed={pressed}
        onClick={() => onOpen(game)}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setPreviewing(true);
        }}
        onPointerLeave={() => setPreviewing(false)}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible'))
            setPreviewing(true);
        }}
        onBlur={() => setPreviewing(false)}
        aria-label={`${game.name}. ${game.durationSpoken}. ${game.kind}. ${label}`}
      >
        <GameCard
          game={game}
          previewing={previewing && !disabled}
          sizes="(max-width: 600px) 45vw, (max-width: 700px) 34vw, 240px"
        />
        <StatStrip game={game} />
        {children}
      </button>
    </li>
  );
}

/**
 * One shelf: the title, arrows on the right that page through it, then the
 * cards, which a mouse can also hold and drag. The landing library and the
 * table lobby share it.
 */
export function ShelfRow({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  useDragScroll(track);
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
  // The games played last lead every list. Read once as the library mounts
  // (the page renders only in the browser), so nothing reshuffles under the
  // pointer; a game opened now moves up the next time the library shows.
  const [played] = useState(readLastPlayed);

  function open(game: LibraryGame) {
    recordLastPlayed(game.id);
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
      entries: byRecent(section.games, played)
        .map((id) => gameByLibraryId(id))
        .filter((g): g is LibraryGame => !!g && matches(g)),
    }))
    .filter((section) => section.entries.length);
  const featured = byRecent(showcaseGames, played)
    .map((id) => gameByLibraryId(id))
    .filter((g): g is LibraryGame => !!g);

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
          <a
            className="lib-friends"
            href="/tables"
            aria-label="Play with friends"
          >
            <Users aria-hidden="true" />
            <span>Play with friends</span>
          </a>
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
        </div>
      </header>
      <main className="lib-main" aria-labelledby="lib-title">
        <h1 id="lib-title" className="sr-only">
          Games
        </h1>
        {!needle && featured.length > 0 && (
          <Showcase games={featured} onOpen={open} />
        )}
        {sections.length ? (
          <div className="lib-sections">
            {sections.map((section) => (
              <ShelfRow
                key={section.id}
                id={`lib-${section.id}`}
                title={section.title}
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
