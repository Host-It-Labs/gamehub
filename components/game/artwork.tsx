'use client';
import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { catalog, type GameId } from '@/lib/games/trio/engine';

const decoded = new Map<string, Promise<void>>();
function loadImage(src: string) {
  let pending = decoded.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => img.decode().then(resolve, reject);
      img.onerror = () => reject(new Error('Artwork could not load'));
      img.src = src;
    }).catch((error) => {
      decoded.delete(src);
      throw error;
    });
    decoded.set(src, pending);
  }
  return pending;
}

export function ArtworkImage({
  src = '',
  alt,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string }) {
  const [ready, setReady] = useState('');
  useEffect(() => {
    let active = true;
    loadImage(src)
      .then(() => {
        if (active) setReady(src);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [src]);
  return (
    <img
      {...props}
      src={src}
      alt={alt}
      decoding="async"
      style={{
        ...props.style,
        opacity: ready === src ? 1 : 0,
        transition: 'opacity 240ms ease, transform var(--artwork-zoom-duration, 350ms) ease',
      }}
    />
  );
}

/** Keep the table covered until its image elements and CSS textures are decoded. */
export function ArtworkLoading({ game }: { game: GameId | 'library' }) {
  const [ready, setReady] = useState<GameId | 'library' | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const assets =
      game === 'library'
        ? catalog.map((c) => c.cover)
        : game === 'wildgrove'
          ? [
              '/art/mora-sanctuary-v10.webp',
              ...Array.from(
                { length: 6 },
                (_, i) => `/art/creature-${i}-v5.webp`,
              ),
            ]
          : game === 'midnight'
            ? Array.from({ length: 6 }, (_, i) => `/art/food-${i}-v7.webp`)
            : ['/art/safe-harbour-v6.webp'];
    Promise.all(assets.map(loadImage))
      .then(() => {
        if (active) setReady(game);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [game, attempt]);
  if (ready === game) return null;
  return (
    <output className="artwork-loading" aria-live="polite">
      <span className="artwork-loader" aria-hidden="true">
        ✦
      </span>
      <strong>
        {error
          ? 'The artwork couldn’t load'
          : game === 'library'
            ? 'Loading games…'
            : `Setting the ${catalog.find((c) => c.id === game)?.name} table…`}
      </strong>
      <span>
        {error ? 'Check your connection and try again.' : 'Loading artwork…'}
      </span>
      {error && (
        <button
          className="secondary"
          onClick={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      )}
    </output>
  );
}
