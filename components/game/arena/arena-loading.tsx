'use client';
import { useRef, useState, type CSSProperties } from 'react';
import type { CardId } from '@/lib/games/arena/cards';
import { arenaManifest } from './assets';
import { useLoadingBar } from '../loading-bar';
import type { PathGoal } from '../loading-path';

/** How long the painting takes to fade into the battle (ms); arena.css. */
const FADE = 450;

/**
 * Arena's loading screen: the painting, your deck lighting up card by card
 * and a bar that fills at a steady pace (`loading-bar.ts`), however the
 * files arrive and however long the shaders take. Once the battle is ready
 * the bar eases into 100% and the painting fades into the field.
 */
export function ArenaLoading({
  goal,
  deck,
  percent,
  onLifting,
  onGone,
}: {
  goal: PathGoal;
  /** The cards that light up as the bar passes them. */
  deck: readonly CardId[];
  /** The real progress, for screen readers. */
  percent: number;
  /** The bar is full and the painting starts to fade. */
  onLifting: () => void;
  /** The painting is gone. */
  onGone: () => void;
}) {
  const fill = useRef<HTMLElement>(null);
  const label = useRef<HTMLElement>(null);
  const cards = useRef<HTMLUListElement>(null);
  const [lifting, setLifting] = useState(false);
  const [art, setArt] = useState(false);
  const shown = deck.slice(0, 8);
  useLoadingBar(fill, goal, {
    onFrame: (x) => {
      if (label.current) label.current.textContent = `${Math.round(x * 100)}%`;
      cards.current?.querySelectorAll('li').forEach((li, i, all) => {
        const lit = String(x >= (i + 1) / (all.length + 1));
        if (li.dataset.in !== lit) li.dataset.in = lit;
      });
    },
    onFull: () => {
      setLifting(true);
      onLifting();
      setTimeout(onGone, FADE);
    },
  });
  return (
    <div
      className="arena-loading"
      aria-busy={!lifting}
      data-lifting={lifting || undefined}
    >
      <picture className="arena-loading-art" data-in={art || undefined}>
        <source
          media="(max-aspect-ratio: 4/5)"
          srcSet="/art/optimized/arena-loading-tall.webp"
        />
        <img
          src="/art/optimized/arena-loading-wide.webp"
          alt=""
          onLoad={() => setArt(true)}
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
      </picture>
      <div className="arena-loading-foot">
        <ul ref={cards} className="arena-loading-cards" aria-hidden="true">
          {shown.map((id, i) => (
            <li key={id} style={{ '--i': i } as CSSProperties} data-in="false">
              {arenaManifest.cards[id] && (
                <img
                  src={arenaManifest.cards[id].path}
                  alt=""
                  draggable={false}
                />
              )}
            </li>
          ))}
        </ul>
        <progress
          className="sr-only"
          max={100}
          value={Math.round(percent * 100)}
          aria-label="Loading"
        />
        <div className="arena-loading-bar" aria-hidden="true">
          <i ref={fill} />
          <b ref={label} />
        </div>
      </div>
    </div>
  );
}
