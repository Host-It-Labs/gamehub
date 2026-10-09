'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArtworkImage } from './artwork';
import { usePreviews, useReelTier } from './use-media';
import { boxCover } from '@/lib/games/box-covers';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import { reelFor, reelSource } from '@/lib/games/library-reels';
import './game-card.css';

/** A sweep across a shelf shouldn't start every clip it passes over. */
const HOVER_DELAY_MS = 140;

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
  const [deep, mid] = game.palette;

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
      style={{ '--gc-deep': deep, '--gc-mid': mid } as CSSProperties}
      aria-hidden="true"
      data-game={game.id}
    >
      <span ref={frame} className="gcard-window">
        {cover && (
          <ArtworkImage
            className="gcard-cover"
            src={cover}
            width={1024}
            height={1024}
            sizes={sizes ?? '200px'}
            alt=""
            draggable={false}
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
