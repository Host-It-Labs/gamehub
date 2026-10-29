'use client';
import { lazy, Suspense } from 'react';

// Dev-only bench; the import is dead code in production so no chunk ships.
const MetroLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/metro/metro-lab'))
    : null;

export default function MetroLabPage() {
  return MetroLab ? (
    <Suspense fallback={null}>
      <MetroLab />
    </Suspense>
  ) : null;
}
