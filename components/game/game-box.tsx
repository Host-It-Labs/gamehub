'use client';
import { printedBoxArt } from '@/lib/games/box-covers';
import { type CSSProperties, type ReactNode } from 'react';
import {
  Amphora,
  Castle,
  Bug,
  Cat,
  Coffee,
  Drum,
  Fish,
  Flame,
  Grid3x3,
  Hexagon,
  Lamp,
  Leaf,
  Lightbulb,
  Moon,
  Scale,
  Shell,
  Ship,
  Snowflake,
  Sparkles,
  Tent,
  TrainFront,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { ArtworkImage } from './artwork';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import './game-box.css';

const motifs: Record<string, LucideIcon> = {
  lantern: Lamp,
  leaf: Leaf,
  flame: Flame,
  train: TrainFront,
  scale: Scale,
  lighthouse: Lightbulb,
  shell: Shell,
  drum: Drum,
  tent: Tent,
  wind: Wind,
  mushroom: Sparkles,
  cup: Coffee,
  sparkle: Sparkles,
  waves: Waves,
  cat: Cat,
  ship: Ship,
  grid: Grid3x3,
  snow: Snowflake,
  pot: Amphora,
  bridge: Castle,
  hexagon: Hexagon,
  moon: Moon,
  fish: Fish,
  moth: Bug,
};

// Sizes travel as --gw/--gh/--gd so stylesheets can still resize boxes per breakpoint.
const sizeStyle = (width: number) =>
  ({
    '--gw': `${width}px`,
    '--gh': `${width}px`,
    '--gd': `${Math.round(width * 0.24)}px`,
  }) as CSSProperties;

export function boxStyle(game: LibraryGame, width: number): CSSProperties {
  const [deep, mid, light] = game.palette;
  return {
    ...sizeStyle(width),
    '--box-deep': deep,
    '--box-mid': mid,
    '--box-light': light,
  } as CSSProperties;
}

/**
 * A plain, sealed box with no art or title: it holds a shelf's place for games
 * still to come. It poses and lifts exactly like a real box.
 */
export function SealedBox({ width }: { width: number }) {
  return (
    <span className="gbox sealed" style={sizeStyle(width)} aria-hidden="true">
      <span className="gbox-solid">
        <span className="gbox-face gbox-top" />
        <span className="gbox-face gbox-bottom" />
        <span className="gbox-face gbox-side" />
        <span className="gbox-face gbox-front">
          <span className="gbox-seal" />
        </span>
      </span>
      <span className="gbox-shadow" />
    </span>
  );
}

/**
 * A square game box drawn with four CSS faces (front, spine, top, bottom), posed at the
 * library's shared angle. Real games carry dedicated cover and spine artwork;
 * placeholders print a material, a motif, and their title.
 */
export function GameBox({
  game,
  width,
  sizes,
  children,
  className = '',
}: {
  game: LibraryGame;
  width: number;
  sizes?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Motif = motifs[game.motif] ?? Sparkles;
  const developed = game.gameId ?? game.standaloneId;
  // Folio and Relic have no engine id but do carry printed cover and spine art.
  const cover = game.cover ?? (developed && printedBoxArt(developed).cover);
  const spine = game.spine ?? (developed && printedBoxArt(developed).spine);
  return (
    <span
      className={`gbox ${game.material} ${game.gameId ?? game.standaloneId ?? 'placeholder'} ${game.coverIncludesTitle ? 'printed-cover' : ''} ${className}`}
      style={boxStyle(game, width)}
      aria-hidden="true"
    >
      <span className="gbox-solid">
        <span className="gbox-face gbox-top" />
        <span className="gbox-face gbox-bottom" />
        <span className="gbox-face gbox-side">
          {spine && (
            <img
              className="gbox-spine-art"
              src={spine}
              alt=""
              draggable={false}
            />
          )}
          {!game.coverIncludesTitle && (
            <span className="gbox-side-title">{game.name}</span>
          )}
          {!game.coverIncludesTitle && <Motif className="gbox-side-motif" />}
        </span>
        <span className="gbox-face gbox-front">
          {cover ? (
            <ArtworkImage
              src={cover}
              width={1024}
              height={game.coverIncludesTitle || game.standaloneId ? 1024 : 683}
              sizes={sizes ?? `${width * 2}px`}
              alt=""
              draggable={false}
            />
          ) : (
            <span className="gbox-illustration">
              <Motif className="gbox-motif" strokeWidth={1.4} />
            </span>
          )}
          {!game.coverIncludesTitle && (
            <span className="gbox-title">{game.name}</span>
          )}
          {children}
        </span>
      </span>
      <span className="gbox-shadow" />
    </span>
  );
}
