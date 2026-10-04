'use client';
import { useEffect, useState } from 'react';
import type { SetGame } from '@/lib/games/party/vote';
import { partNames } from '@/lib/games/party/tribu';
import { setMarks } from './tribu-vote';
import './game-intro.css';

/** How long the burst stays on screen; the CSS timeline fits inside it. */
export const introMs = 1100;

/** The quick burst that opens a game picked in Know Me: its colours, its
 * mark and its name, each game with its own motion in game-intro.css (Quiz
 * has its own, quiz-intro.tsx). It never takes input and is skipped under
 * reduced motion. */
export function GameIntro({ game }: { game: SetGame }) {
  const Mark = setMarks[game];
  return (
    <div className={`game-intro intro-${game}`} aria-hidden="true">
      <div className="game-intro-burst" />
      <span className="game-intro-mark">
        <Mark />
      </span>
      <strong className="game-intro-name">{partNames[game]}</strong>
    </div>
  );
}

/** Which game just came out of a set's pick, for as long as its burst
 * plays: set when the table leaves the pick for a game, never on a reload
 * mid-game or when the match ends. */
export function useGameIntro(
  kind: SetGame,
  phase: string,
  active: boolean,
): { game: SetGame; key: number } | null {
  const [seen, setSeen] = useState({
    kind,
    phase,
    intro: null as { game: SetGame; key: number } | null,
  });
  if (seen.kind !== kind || seen.phase !== phase) {
    const starts = seen.phase === 'vote' && phase !== 'vote' && active;
    setSeen({
      kind,
      phase,
      intro: starts
        ? { game: kind, key: (seen.intro?.key ?? 0) + 1 }
        : seen.intro,
    });
  }
  const intro = seen.intro;
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(
      () => setSeen((s) => (s.intro === intro ? { ...s, intro: null } : s)),
      introMs,
    );
    return () => clearTimeout(timer);
  }, [intro]);
  return intro;
}
