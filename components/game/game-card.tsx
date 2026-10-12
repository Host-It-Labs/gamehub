'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePreviews, useReelTier } from './use-media';
import { boxCover } from '@/lib/games/box-covers';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import { reelFor, reelSource } from '@/lib/games/library-reels';
import previews from '@/lib/artwork-previews.json';
import './game-card.css';

/** A sweep across a shelf shouldn't start every clip it passes over. */
const HOVER_DELAY_MS = 140;

/** A game's palette as the custom properties its lit placeholder reads. */
export const paletteVars = (game: LibraryGame) =>
  ({
    '--gc-deep': game.palette[0],
    '--gc-mid': game.palette[1],
    '--gc-light': game.palette[2],
  }) as CSSProperties;

/**
 * A square cover that never shows half drawn: it stays hidden until the
 * browser has fully decoded it, then fades in over its slot, which shows the
 * game's palette lit from above with a slow band of light crossing it while
 * the cover loads (`data-state`, game-card.css). A cover that fails to load
 * leaves the lit palette, still.
 */
export function CoverImage({
  src,
  sizes,
  className = '',
  onReady,
}: {
  src: string;
  sizes: string;
  className?: string;
  /** The cover is decoded (or failed): its slot may show. */
  onReady?: () => void;
}) {
  const [state, setState] = useState<{ src: string; ok: boolean } | null>(null);
  /** False once the cover has unmounted: a decode that finishes after that
   *  must not report a slot that is gone (or mounted afresh) ready. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const art = previews[src as keyof typeof previews];
  const settled = state?.src === src ? state : null;
  return (
    <span
      className={`cover-art ${className}`}
      data-state={settled ? (settled.ok ? 'ready' : 'failed') : 'loading'}
    >
      <img
        src={src}
        srcSet={art?.srcSet}
        sizes={sizes}
        width={1024}
        height={1024}
        alt=""
        draggable={false}
        decoding="async"
        onLoad={(event) => {
          const image = event.currentTarget;
          // A loaded image that can't be decoded ahead can still be shown.
          // Unmounted, or on another picture by now, it reports nothing.
          void image
            .decode()
            .catch(() => {})
            .then(() => {
              if (!mounted.current || image.getAttribute('src') !== src) return;
              setState({ src, ok: true });
              onReady?.();
            });
        }}
        onError={() => {
          if (!mounted.current) return;
          setState({ src, ok: false });
          onReady?.();
        }}
      />
    </span>
  );
}

/**
 * A game's square cover. On a desktop, hovering it (`previewing`) plays the
 * game's footage inside the square, filmed on a desktop screen; the clip only
 * loads the first time it's wanted. Touch screens, reduced motion and data
 * saver keep the cover, even if the preference changes mid-hover.
 */
export function GameCard({
  game,
  sizes,
  previewing = false,
  className = '',
}: {
  game: LibraryGame;
  sizes?: string;
  previewing?: boolean;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const reel = reelFor(game.id);
  const allowed = usePreviews();
  const showing = !!reel && previewing && allowed;
  const [wanted, setWanted] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Cards are small: usually the 360p cut, 720p on big dense ones.
  const tier = useReelTier(frame, 'wide');
  const cover = game.cover ?? boxCover(game.id);

  useEffect(() => {
    if (!showing) {
      video.current?.pause();
      return;
    }
    const timer = setTimeout(() => {
      setWanted(true);
      void video.current?.play().catch(() => {});
    }, HOVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [showing]);

  return (
    <span
      className={`gcard ${playing && showing ? 'is-playing' : ''} ${className}`}
      style={paletteVars(game)}
      aria-hidden="true"
      data-game={game.id}
    >
      <span ref={frame} className="gcard-window">
        {cover && (
          <CoverImage
            className="gcard-cover"
            src={cover}
            sizes={sizes ?? '200px'}
          />
        )}
        {reel && wanted && allowed && tier && (
          <video
            ref={video}
            className="gcard-reel"
            src={reelSource(reel, 'wide', tier)}
            muted
            loop
            playsInline
            autoPlay={showing}
            preload="auto"
            disablePictureInPicture
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
      </span>
    </span>
  );
}
