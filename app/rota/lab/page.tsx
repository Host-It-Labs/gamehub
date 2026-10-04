'use client';
import { lazy, Suspense } from 'react';

// Dev-only bench; the import is dead code in production so no chunk ships.
const RotaLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/rota/rota-lab'))
    : null;

export default function RotaLabPage() {
  return RotaLab ? (
    <Suspense fallback={null}>
      <RotaLab />
    </Suspense>
  ) : null;
}
