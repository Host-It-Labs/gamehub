'use client';
import { lazy, Suspense } from 'react';

const TriviaLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/trivia-3d/trivia-lab'))
    : null;

export default function TriviaLabPage() {
  return TriviaLab ? (
    <Suspense fallback={null}>
      <TriviaLab />
    </Suspense>
  ) : null;
}
