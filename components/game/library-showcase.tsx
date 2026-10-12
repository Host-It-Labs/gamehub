'use client';
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type RefObject,
} from 'react';
import { ChevronDown, ChevronUp, Play, Users } from 'lucide-react';
import { CoverImage, paletteVars } from './game-card';
import { StatStrip } from './library-stats';
import { useMedia, useReelTier } from './use-media';
import { boxCover } from '@/lib/games/box-covers';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import {
  playRefused,
  reelFor,
  reelSource,
  type ReelTier,
} from '@/lib/games/library-reels';
import { isHumanOnlyGame } from '@/lib/games/player-policy';

/** How long a game without footage holds the stage. */
const STILL_MS = 7000;
/** The next game's footage fades in over the last one (library.css). */
const FADE_MS = 500;
/** How long the last game's footage waits for the next one to arrive before
 *  it fades to the next game's lit palette instead. */
const HOLD_MS = 700;
/** Phones in portrait get the clip filmed on a phone. */
const TALL_QUERY = '(max-width: 699px) and (orientation: portrait)';

/**
 * What the stage shows. Each game and shape is a slide (`${id}-${tall}`):
 * `shown` is on screen, `leaving` are the slides it faded in over (kept
 * until the fade ends), `ready` the mounted slides whose media is decoded,
 * and `letGo` the shown slide that stopped waiting for a slow next one: it
 * fades out, then drops, leaving the stage to the next game's palette.
 */
type Stage = {
  shown: string;
  leaving: string[];
  ready: string[];
  letGo: string;
};
type StageAction =
  | { type: 'ready' | 'gone' | 'show'; key: string }
  | { type: 'let-go' | 'drop' | 'settle' | 'hold' };
function stageReducer(stage: Stage, action: StageAction): Stage {
  switch (action.type) {
    case 'ready':
      return stage.ready.includes(action.key)
        ? stage
        : { ...stage, ready: [...stage.ready, action.key] };
    case 'gone':
      return { ...stage, ready: stage.ready.filter((k) => k !== action.key) };
    // The next slide fades in over the one on screen, unless that one has
    // already let go (faded out) while it waited.
    case 'show':
      return {
        ...stage,
        shown: action.key,
        leaving:
          stage.shown && stage.letGo !== stage.shown
            ? [...stage.leaving.filter((k) => k !== action.key), stage.shown]
            : stage.leaving,
        letGo: '',
      };
    case 'let-go':
      return { ...stage, letGo: stage.shown };
    case 'drop':
      return stage.letGo && stage.letGo === stage.shown
        ? { ...stage, shown: '', letGo: '' }
        : stage;
    case 'hold':
      return { ...stage, letGo: '' };
    case 'settle':
      return { ...stage, leaving: [] };
  }
}

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
 * Footage that fails to load, or that the browser won't start on its own,
 * falls back to the still on a timer; reduced motion shows only the still
 * and never turns. Nothing shows half drawn:
 * until a game's still is decoded the screen is its palette, lit, with a
 * slow band of light crossing it, and switching games the last footage
 * holds until the next fades in over it (`stageReducer`, StageSlide).
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
  /** The game and shape whose clip is playing. */
  const [playingKey, setPlayingKey] = useState('');
  const [screen, dispatch] = useReducer(stageReducer, {
    shown: '',
    leaving: [],
    ready: [],
    letGo: '',
  });
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
  const key = ready && gameId ? `${gameId}-${tall}` : '';
  const shownKey = screen.shown;
  const holding = !!shownKey && !!key && shownKey !== key;
  // The game on stage is decoded: it fades in over the footage on screen,
  // which goes once the fade is over. Nothing on the stage is ever half
  // drawn, and switching games never flashes it empty. Back on the footage
  // that was holding, it waits afresh next time.
  if (key && shownKey !== key && screen.ready.includes(key))
    dispatch({ type: 'show', key });
  else if (!holding && screen.letGo) dispatch({ type: 'hold' });
  const arrived = !!key && key === shownKey;
  const letGo = holding && screen.letGo === shownKey;
  const advance = () => {
    setPicked(false);
    setIndex((i) => (i + 1) % games.length);
  };
  const fail = useCallback(
    (id: string) => setFailed((before) => new Set(before).add(id)),
    [],
  );

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
    if (!screen.leaving.length) return;
    const timer = setTimeout(() => dispatch({ type: 'settle' }), FADE_MS + 50);
    return () => clearTimeout(timer);
  }, [screen.leaving]);
  // A slow arrival doesn't leave the last game's footage under the next
  // game's name: after a moment it fades to the next game's lit palette.
  useEffect(() => {
    if (!holding) return;
    const timer = setTimeout(
      () => dispatch({ type: letGo ? 'drop' : 'let-go' }),
      letGo ? FADE_MS + 50 : HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [holding, letGo]);
  // While a clip plays, the next game's still loads, so the turn is clean.
  const nextId = games.length > 1 ? games[(index + 1) % games.length].id : '';
  useEffect(() => {
    const next = nextId ? reelFor(nextId) : undefined;
    if (!arrived || (moving && playingKey !== key) || !next) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = tall ? next.tallStill : next.wideStill;
  }, [arrived, moving, playingKey, key, nextId, tall]);

  // The active cover's bar fills with the clip (or the still's timer); a game
  // without footage moves on by the timer.
  useEffect(() => {
    if (!gameId) return;
    let frame = 0;
    let shown = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const el = video.current;
      // Footage still loading (its clip waits for its still) holds the turn.
      if (filmed) {
        if (el?.duration) shown = el.currentTime / el.duration;
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
  // Under the game on stage: the footage it fades in over, and the footage
  // that holds while it loads.
  const layers = [
    ...screen.leaving.filter((k) => k !== key && k !== shownKey),
    ...(holding ? [shownKey] : []),
    ...(key ? [key] : []),
  ];

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
        className={`show-stage ${arrived ? '' : 'is-waiting'}`}
        data-game={game.id}
        data-starts-game
        aria-label={
          friends ? `Play ${game.name} with friends` : `Play ${game.name}`
        }
        onClick={() => onOpen(game)}
      >
        {layers.map((layer) => {
          const id = layer.slice(0, layer.lastIndexOf('-'));
          const entry = games.find((g) => g.id === id);
          if (!entry) return null;
          const active = layer === key;
          return (
            <StageSlide
              key={layer}
              slideKey={layer}
              game={entry}
              tall={layer.endsWith('-true')}
              tier={tier}
              filmed={!failed.has(entry.id)}
              motion={reduced === false}
              active={active}
              phase={
                active
                  ? arrived
                    ? 'in'
                    : 'loading'
                  : layer === shownKey && letGo
                    ? 'out'
                    : 'in'
              }
              autoPlay={active && moving}
              loop={!turning}
              videoRef={active ? video : undefined}
              report={dispatch}
              onPlaying={setPlayingKey}
              onEnded={active ? advance : undefined}
              onFail={fail}
            />
          );
        })}
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
                style={
                  {
                    ...paletteVars(entry),
                    '--shimmer-delay': `${(i % 3) * 0.14}s`,
                  } as CSSProperties
                }
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
                <CoverImage
                  src={entry.cover ?? boxCover(entry.id) ?? ''}
                  sizes="96px"
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

/**
 * One game's footage on the stage: its still, then its clip over the still
 * once the clip plays (a game without footage shows its cover). It reports
 * itself ready once the still is fully decoded or the clip is playing, and
 * only shows when the stage says (`phase`), so it is never painted half
 * drawn. Footage that leaves the centre of the stage stops where it is;
 * footage the browser refuses to play gives way to the still.
 */
function StageSlide({
  slideKey,
  game,
  tall,
  tier,
  filmed,
  motion,
  active,
  phase,
  autoPlay,
  loop,
  videoRef,
  report,
  onPlaying,
  onEnded,
  onFail,
}: {
  slideKey: string;
  game: LibraryGame;
  tall: boolean;
  tier: ReelTier | null;
  /** The clip hasn't failed to load. */
  filmed: boolean;
  /** Motion is allowed: the clip may play. */
  motion: boolean;
  /** The game on the stage now (the others hold or fade beneath it). */
  active: boolean;
  phase: 'loading' | 'in' | 'out';
  autoPlay: boolean;
  loop: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Tells the stage the slide is ready (its still is decoded or its clip
   *  plays) and when it is gone (mounted again, it loads afresh). */
  report: Dispatch<StageAction>;
  onPlaying: (key: string) => void;
  onEnded?: () => void;
  /** The game's clip won't play here: the stage falls back to its still. */
  onFail: (id: string) => void;
}) {
  /** The clip's element, while it is on the page. */
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  /** The clip loads once the still is on hand, so the still comes first. */
  const [still, setStill] = useState(false);
  /** False once the slide has left the stage: an image that finishes
   *  decoding after that must not report it ready. Back on the stage, it is
   *  a fresh slide that loads afresh. */
  const mounted = useRef(true);
  const reel = reelFor(game.id);
  const ready = () => {
    if (mounted.current) report({ type: 'ready', key: slideKey });
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      report({ type: 'gone', key: slideKey });
    };
  }, [report, slideKey]);

  // A clip taken off the page (reduced motion turned on, a failed clip, the
  // slide gone) stops downloading at once, not whenever it is collected.
  const attach = useCallback((el: HTMLVideoElement | null) => {
    setClip(el);
    if (!el) return;
    return () => {
      setClip(null);
      setPlaying(false);
      // Only once React has really removed it, not merely re-attached it.
      queueMicrotask(() => {
        if (el.isConnected) return;
        el.removeAttribute('src');
        el.load();
      });
    };
  }, []);

  // The clip is asked to play as it mounts and whenever it may start or must
  // stop. A browser that blocks autoplay says so only by refusing play(),
  // with no event: the clip then gives way to its still and its timer.
  useEffect(() => {
    if (!clip) return;
    if (!autoPlay) {
      clip.pause();
      return;
    }
    void clip.play().catch((error: unknown) => {
      if (playRefused(error)) onFail(game.id);
    });
  }, [clip, autoPlay, onFail, game.id]);

  // The stage reads the clip of the game on it (its cover's bar fills).
  useEffect(() => {
    if (!videoRef || !clip) return;
    videoRef.current = clip;
    return () => {
      if (videoRef.current === clip) videoRef.current = null;
    };
  }, [videoRef, clip]);

  return (
    <span
      className={`show-slide is-${phase} ${playing ? 'is-playing' : ''}`}
      data-slide={slideKey}
    >
      {reel ? (
        <img
          className="show-still"
          src={tall ? reel.tallStill : reel.wideStill}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority={active ? 'high' : 'auto'}
          onLoad={(event) => {
            void event.currentTarget
              .decode()
              .catch(() => {})
              .then(() => {
                setStill(true);
                ready();
              });
          }}
          onError={() => {
            setStill(true);
            ready();
          }}
        />
      ) : (
        <span className="show-poster">
          <CoverImage
            src={game.cover ?? boxCover(game.id) ?? ''}
            sizes="(max-width: 700px) 60vw, 420px"
            onReady={ready}
          />
        </span>
      )}
      {reel && filmed && motion && tier && still && (
        <video
          ref={attach}
          className="show-reel"
          src={reelSource(reel, tall ? 'tall' : 'wide', tier)}
          muted
          playsInline
          autoPlay={autoPlay}
          loop={loop}
          preload="auto"
          disablePictureInPicture
          onPlaying={() => {
            setPlaying(true);
            ready();
            onPlaying(slideKey);
          }}
          onEnded={onEnded}
          onError={() => onFail(game.id)}
        />
      )}
    </span>
  );
}
