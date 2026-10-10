'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, Play, Users } from 'lucide-react';
import { ArtworkImage } from './artwork';
import { StatStrip } from './library-stats';
import { useMedia, useReelTier } from './use-media';
import { boxCover } from '@/lib/games/box-covers';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import { reelFor, reelSource } from '@/lib/games/library-reels';
import { isHumanOnlyGame } from '@/lib/games/player-policy';

/** How long a game without footage holds the stage. */
const STILL_MS = 7000;
/** Phones in portrait get the clip filmed on a phone. */
const TALL_QUERY = '(max-width: 699px) and (orientation: portrait)';

/**
 * The top of the library: a game playing itself on a big screen, filmed on
 * a desktop for wide screens and on a phone for phones, with every game's
 * cover in a rail on its left. On wide screens the covers grow to fill the
 * height of the footage and its caption exactly, never scrolling (a wheel
 * over them moves the page); on phones they stand in a column that scrolls a
 * page at a time from a button beneath it. The games arrive ordered (played
 * last first, `byRecent`, then the documented order, which ends with the
 * With friends games, marked with a people badge). Each
 * clip plays once, then the next game takes the stage; hovering or focusing
 * the showcase keeps the current game looping. The footage itself is the
 * Play button, with a Play plate in its bottom-right corner; the name,
 * time and kind sit under it.
 * Footage that fails to load falls back to the still on a timer; reduced
 * motion shows only the still and never turns.
 */
export function Showcase({
  games: all,
  onOpen,
}: {
  games: LibraryGame[];
  onOpen: (game: LibraryGame) => void;
}) {
  const [index, setIndex] = useState(0);
  /** The phone column is scrolled to its end: its button goes back up. */
  const [railEnd, setRailEnd] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** The player picked this game: announce it (turning on its own is quiet). */
  const [picked, setPicked] = useState(false);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [onScreen, setOnScreen] = useState(true);
  /** The game and shape whose clip is playing; a new one starts hidden. */
  const [playingKey, setPlayingKey] = useState('');
  const tall = useMedia(TALL_QUERY);
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLElement | null>(null);
  const rail = useRef<HTMLFieldSetElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const games = all;
  const game = games[index] ?? games[0];
  const gameId = game?.id;
  const reel = game ? reelFor(game.id) : undefined;
  const filmed = !!reel && !failed.has(game.id);
  // Which clip to load waits until the browser says what screen this is.
  const ready = tall !== null && reduced !== null;
  // The lightest cut that still covers the stage on this screen and device.
  const tier = useReelTier(stage, tall ? 'tall' : 'wide');
  const moving = reduced === false && onScreen;
  const turning = games.length > 1 && moving && !hovered && !focused;
  const playing = playingKey === `${gameId}-${tall}`;
  const advance = () => {
    setPicked(false);
    setIndex((i) => (i + 1) % games.length);
  };
  const fail = (id: string) => setFailed((before) => new Set(before).add(id));

  // Hovering or focusing the showcase keeps the current game looping.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') setHovered(true);
    };
    const leave = () => setHovered(false);
    const focusIn = () => setFocused(true);
    const focusOut = (event: FocusEvent) => {
      if (!el.contains(event.relatedTarget as Node | null)) setFocused(false);
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', focusIn);
    el.addEventListener('focusout', focusOut);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', focusIn);
      el.removeEventListener('focusout', focusOut);
    };
  }, []);

  // Off screen, the footage stops; it picks up where it was.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const id = gameId;
    if (moving) void el.play().catch(() => id && fail(id));
    else el.pause();
  }, [moving, gameId, tall]);

  // The active cover's bar fills with the clip (or the still's timer); a game
  // without footage moves on by the timer.
  useEffect(() => {
    if (!gameId) return;
    let frame = 0;
    let shown = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const el = video.current;
      if (el && filmed) {
        if (el.duration) shown = el.currentTime / el.duration;
      } else {
        if (turning) shown += (now - last) / STILL_MS;
        if (shown >= 1) {
          setPicked(false);
          setIndex((i) => (i + 1) % games.length);
          return;
        }
      }
      last = now;
      bar.current?.style.setProperty('--shown', String(Math.min(shown, 1)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [gameId, filmed, turning, games.length]);


  // Wide screens: size the cover grid so it fills the footage's height and
  // its caption exactly. The rail's width takes room from the footage, which
  // shortens it, so solve for the width: with c columns and r rows, the rail
  // is c covers plus gaps, a cover is the height (footage + caption) over r
  // rows, and the footage is 16:9 in what the rail leaves. Of the column
  // counts that keep the rail under ~36% of the row, take the biggest covers.
  useEffect(() => {
    const box = section.current;
    const caption = info.current;
    const grid = rail.current;
    if (!box || !caption || !grid) return;
    const wide = window.matchMedia('(min-width: 700px)');
    const measure = () => {
      if (!wide.matches) {
        box.style.removeProperty('--rail-w');
        box.style.removeProperty('--rail-cols');
        return;
      }
      const style = getComputedStyle(box);
      const columnGap = parseFloat(style.columnGap) || 0;
      const rowGap = parseFloat(style.rowGap) || 0;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      const width = box.clientWidth;
      const below = rowGap + caption.offsetHeight;
      const n = grid.children.length;
      let best: { width: number; cols: number; cover: number } | undefined;
      for (let cols = 1; cols <= Math.min(n, 6); cols++) {
        const rows = Math.ceil(n / cols);
        const k = cols / rows;
        const railWidth =
          (k * ((width - columnGap) * (9 / 16) + below - (rows - 1) * gap) +
            (cols - 1) * gap) /
          (1 + k * (9 / 16));
        const cover = (railWidth - (cols - 1) * gap) / cols;
        if (railWidth > width * 0.36 || cover <= 0) continue;
        if (!best || cover > best.cover)
          best = { width: railWidth, cols, cover };
      }
      if (!best) {
        box.style.removeProperty('--rail-w');
        box.style.removeProperty('--rail-cols');
        return;
      }
      box.style.setProperty('--rail-w', `${Math.floor(best.width)}px`);
      box.style.setProperty('--rail-cols', String(best.cols));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(caption);
    wide.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', measure);
    };
  }, [games.length]);

  // Phones: keep the playing game's cover in view as the column turns.
  useEffect(() => {
    const box = rail.current;
    const thumb = box?.children[index] as HTMLElement | undefined;
    if (!box || !thumb || box.scrollHeight <= box.clientHeight + 1) return;
    const top = thumb.offsetTop - box.offsetTop;
    if (
      top < box.scrollTop ||
      top + thumb.offsetHeight > box.scrollTop + box.clientHeight
    )
      box.scrollTo({
        top: top - 4,
        behavior: reduced === false ? 'smooth' : 'auto',
      });
  }, [index, reduced]);

  /** The phone column's button: the next page of covers, or back to the top. */
  const nextPage = () => {
    const box = rail.current;
    if (!box) return;
    const behavior = reduced === false ? 'smooth' : 'auto';
    if (railEnd) box.scrollTo({ top: 0, behavior });
    else box.scrollBy({ top: box.clientHeight - 8, behavior });
  };

  if (!game) return null;
  const friends = isHumanOnlyGame(game.id);
  const [deep, mid, light] = game.palette;
  const still =
    reel && ready ? (tall ? reel.tallStill : reel.wideStill) : undefined;

  return (
    <section
      ref={section}
      className={`lib-show ${tall ? 'is-tall' : ''}`}
      aria-roledescription="carousel"
      aria-label="Featured games"
      style={
        {
          '--show-deep': deep,
          '--show-mid': mid,
          '--show-light': light,
        } as CSSProperties
      }
    >
      <button
        ref={stage}
        type="button"
        className={`show-stage ${playing ? 'is-playing' : ''}`}
        data-game={game.id}
        data-starts-game
        aria-label={
          friends ? `Play ${game.name} with friends` : `Play ${game.name}`
        }
        onClick={() => onOpen(game)}
      >
        {still ? (
          <img
            key={`${game.id}-${tall}-still`}
            className="show-still"
            src={still}
            alt=""
            draggable={false}
          />
        ) : reel ? null : (
          <span className="show-poster" key={game.id}>
            <ArtworkImage
              src={game.cover ?? boxCover(game.id)}
              width={1024}
              height={1024}
              sizes="(max-width: 700px) 60vw, 420px"
              alt=""
              draggable={false}
            />
          </span>
        )}
        {reel && filmed && ready && tier && !reduced && (
          <video
            key={`${game.id}-${tall}`}
            ref={video}
            className="show-reel"
            src={reelSource(reel, tall ? 'tall' : 'wide', tier)}
            muted
            playsInline
            autoPlay={moving}
            loop={!turning}
            preload="auto"
            disablePictureInPicture
            onPlaying={() => setPlayingKey(`${game.id}-${tall}`)}
            onEnded={advance}
            onError={() => fail(game.id)}
          />
        )}
        <span className="show-go" aria-hidden="true">
          <span className="show-go-icon">{friends ? <Users /> : <Play />}</span>
          <span className="show-go-label">
            {friends ? 'Play with friends' : 'Play'}
          </span>
        </span>
      </button>
      <div ref={info} className="show-info">
        <h2 className="show-name" aria-live={picked ? 'polite' : 'off'}>
          {game.name}
        </h2>
        <StatStrip game={game} />
      </div>
      {games.length > 1 && (
        <div className="show-side">
          <fieldset
            ref={rail}
            className="show-rail"
            aria-label="Choose a game"
            onScroll={(event) => {
              const box = event.currentTarget;
              setRailEnd(
                box.scrollTop + box.clientHeight >= box.scrollHeight - 4,
              );
            }}
          >
            {games.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                className={`show-thumb ${i === index ? 'is-on' : ''}`}
                aria-label={
                  isHumanOnlyGame(entry.id)
                    ? `${entry.name}, with friends`
                    : entry.name
                }
                aria-current={i === index}
                onClick={() => {
                  setPicked(true);
                  setIndex(i);
                }}
              >
                <ArtworkImage
                  src={entry.cover ?? boxCover(entry.id)}
                  width={1024}
                  height={1024}
                  sizes="96px"
                  alt=""
                  draggable={false}
                />
                {isHumanOnlyGame(entry.id) && (
                  <span className="show-thumb-group" title="With friends">
                    <Users aria-hidden="true" />
                  </span>
                )}
                {i === index && (
                  <i
                    className="show-thumb-time"
                    ref={(el) => {
                      bar.current = el;
                    }}
                  />
                )}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            className="show-rail-next"
            aria-label={railEnd ? 'First games' : 'More games'}
            onClick={nextPage}
          >
            {railEnd ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </section>
  );
}
