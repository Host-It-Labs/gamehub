'use client';
import { useEffect, useState } from 'react';

/** How long a curtain takes to lift (ms; globals.css). */
const LIFT = 450;

/** The 3D games whose loading pages and curtains share one backdrop. */
export type BackdropGame = 'arena' | 'rota' | 'alto' | 'diner';

/**
 * The game's own backdrop over a 3D stage until its first frame is drawn,
 * then a crossfade into the scene: a game never shows a blank canvas, a
 * half-built scene or a hard cut from the page before. The backdrop is the
 * one the page shows while the game's code loads (`GameStartup`), so the
 * two read as one screen. It never takes input.
 */
export function GameCurtain({
  game,
  lifted,
}: {
  game: BackdropGame;
  /** The scene's first frame is on screen. */
  lifted: boolean;
}) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!lifted) return;
    const t = setTimeout(() => setGone(true), LIFT);
    return () => {
      clearTimeout(t);
      setGone(false);
    };
  }, [lifted]);
  if (gone) return null;
  return (
    <div
      className="game-curtain"
      data-game={game}
      data-lifted={lifted || undefined}
      aria-hidden="true"
    />
  );
}

/**
 * The page while a 3D game's code downloads: just its backdrop, no words,
 * so the game's own loading screen or curtain takes over without a flash.
 */
export function GameStartup({
  game,
  name,
}: {
  game: BackdropGame;
  /** For screen readers only. */
  name: string;
}) {
  return (
    <main className="startup-loading" data-game={game} aria-busy="true">
      <span className="sr-only">{name}</span>
    </main>
  );
}
