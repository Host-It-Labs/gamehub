'use client';
import { lazy, Suspense } from 'react';

// Dev-only bench; the import is dead code in production so no chunk ships.
const DinerLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/diner/diner-lab'))
    : null;

export default function DinerLabPage() {
  return DinerLab ? (
    <Suspense fallback={null}>
      <DinerLab />
    </Suspense>
  ) : null;
}
