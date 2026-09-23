'use client';
import {
  Bomb,
  Brush,
  Calculator,
  Earth,
  Grid2x2,
  Grid3x3,
  Hash,
  LayoutGrid,
  Palette,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { Kind } from '@/lib/games/folio/types';

/** One recognisable icon per game, used on the map and in lists. */
export const KIND_ICONS: Record<Kind, LucideIcon> = {
  word: Type,
  groups: LayoutGrid,
  four: Grid2x2,
  waffle: Hash,
  country: Earth,
  equation: Calculator,
  sudoku: Grid3x3,
  mines: Bomb,
  nonogram: Brush,
  code: Palette,
};
export function KindIcon({ kind, size = 18 }: { kind: Kind; size?: number }) {
  const Icon = KIND_ICONS[kind];
  return <Icon size={size} strokeWidth={2.2} aria-hidden="true" />;
}
