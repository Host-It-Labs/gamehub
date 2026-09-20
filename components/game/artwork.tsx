'use client';
import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { paperWorldFor, paperWorldIdFor } from '@/lib/games/mora-world';
import { tableWorldFor } from '@/lib/games/table-world';
import previews from '@/lib/artwork-previews.json';
import {
  catalog,
  tokenImage,
  type ContentSet,
  type GameId,
} from '@/lib/games/trio/engine';

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
  const artwork = previews[src as keyof typeof previews];
  return (
    <span
      className="artwork-frame"
      style={
        artwork ? { backgroundImage: `url("${artwork.preview}")` } : undefined
      }
    >
      <img
        {...props}
        src={src}
        srcSet={artwork?.srcSet}
        sizes={
          props.sizes ??
          '(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 330px'
        }
        alt={alt}
        decoding="async"
        onLoad={async (event) => {
          const image = event.currentTarget;
          const loadedSource = src;
          try {
            await image.decode();
          } catch {
            /* A loaded image can still be displayed. */
          }
          setReady(loadedSource);
          props.onLoad?.(event);
        }}
        onError={(event) => {
          setReady(src);
          props.onError?.(event);
        }}
        style={{ ...props.style, opacity: ready === src ? 1 : 0 }}
      />
    </span>
  );
}

/** Keep the table covered until its image elements and CSS textures are decoded. */
export function ArtworkLoading({
  game,
  contentSet,
}: {
  game: GameId | 'library';
  contentSet?: ContentSet;
}) {
  const identity = `${game}:${contentSet ?? 'beginner'}`;
  const [ready, setReady] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Once everything is decoded the curtain lifts over a short fade, then unmounts.
  useEffect(() => {
    if (ready !== identity) return;
    const timer = setTimeout(() => setGone(identity), 420);
    return () => clearTimeout(timer);
  }, [ready, identity]);
  useEffect(() => {
    let active = true;
    const assets =
      game === 'library'
        ? catalog.map((c) => `/art/optimized/box-${c.id}-v2-320.webp`)
        : game === 'wildgrove'
          ? [
              '/art/optimized/mora-paper-fibers-v1.webp',
              ...[false, true].flatMap((tall) => {
                const world = paperWorldFor(tall, undefined, paperWorldIdFor(contentSet));
                return [world.image, world.boardImage, world.overviewImage];
              }),
              ...Array.from({ length: 6 }, (_, i) =>
                tokenImage(i, false, contentSet),
              ),
            ]
          : game === 'midnight'
            ? [
                tableWorldFor('midnight', false).image,
                tableWorldFor('midnight', true).image,
                ...Array.from({ length: 6 }, (_, i) =>
                  tokenImage(i, true, contentSet),
                ),
              ]
            : [tableWorldFor('undertow', false).image, tableWorldFor('undertow', true).image];
    Promise.all(assets.map(loadImage))
      .then(() => {
        if (active) setReady(identity);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [game, contentSet, identity, attempt]);
  if (gone === identity) return null;
  const lifting = ready === identity;
  return (
    <output
      className={`artwork-loading ${lifting ? 'is-lifting' : ''}`}
      data-game={game}
      aria-live="polite"
      aria-busy={!lifting}
    >
      <span className="artwork-loader" aria-hidden="true">
        <span className="loader-table">
          <i className="loader-card" />
          <i className="loader-card" />
          <i className="loader-card" />
          <i className="loader-die">
            <b>{game === 'undertow' ? '♠' : game === 'wildgrove' ? '✿' : '☾'}</b>
          </i>
        </span>
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
