'use client';
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

export function boxStyle(game: LibraryGame, width: number): CSSProperties {
  const [deep, mid, light] = game.palette;
  const shapes: Record<string, [number, number]> = { undertow: [0.78, 0.23], wildgrove: [1, 0.24], midnight: [0.66, 0.22], orin: [1.08, 0.3], vela: [0.82, 0.18], miro: [0.9, 0.25] };
  const [height, depth] = shapes[game.id] ?? [0.68 + (game.name.length % 3) * 0.14, 0.22];
  // Sizes travel as --gw/--gh/--gd so stylesheets can still resize boxes per breakpoint.
  return {
    '--gw': `${width}px`,
    '--gh': `${Math.round(width * height)}px`,
    '--gd': `${Math.round(width * depth)}px`,
    '--box-deep': deep,
    '--box-mid': mid,
    '--box-light': light,
  } as CSSProperties;
}

/**
 * A shaped game box drawn with four CSS faces (front, spine, top, bottom), posed at the
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
  return (
    <span
      className={`gbox ${game.material} ${game.gameId ?? game.standaloneId ?? 'placeholder'} ${className}`}
      style={boxStyle(game, width)}
      aria-hidden="true"
    >
      <span className="gbox-solid">
        <span className="gbox-face gbox-top" />
        <span className="gbox-face gbox-bottom" />
        <span className="gbox-face gbox-side">
          {developed && <img className="gbox-spine-art" src={game.spine ?? `/art/optimized/box-${developed}-v4-spine.webp`} alt="" draggable={false} />}
          <span className="gbox-side-title">{game.name}</span>
          <Motif className="gbox-side-motif" />
        </span>
        <span className="gbox-face gbox-front">
          {developed ? (
            <ArtworkImage
              src={game.cover ?? `/art/optimized/box-${developed}-v4-front.webp`}
              width={1024}
              height={game.standaloneId ? 1536 : 683}
              sizes={sizes ?? `${width * 2}px`}
              alt=""
              draggable={false}
            />
          ) : (
            <span className="gbox-illustration">
              <Motif className="gbox-motif" strokeWidth={1.4} />
            </span>
          )}
          <span className="gbox-title">{game.name}</span>
          {children}
        </span>
      </span>
      <span className="gbox-shadow" />
    </span>
  );
}
