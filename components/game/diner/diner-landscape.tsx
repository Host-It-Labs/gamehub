'use client';
import type { ReactNode } from 'react';
import { Smartphone } from 'lucide-react';
import './diner-landscape.css';

/**
 * Diner is played sideways on phones (9 October 2026): the stick on the left,
 * the buttons on the right, the diner across the middle. It is the one game
 * that asks for landscape; `MobileViewport` locks it where the browser
 * allows, and an upright phone sees this plate instead of the game.
 */
export function DinerLandscape({ children }: { children: ReactNode }) {
  return (
    <div className="diner-landscape" data-orientation="landscape">
      {children}
      <div className="rotate-to-landscape" aria-live="polite">
        <Smartphone aria-hidden="true" />
        <p>Turn your phone sideways to play</p>
      </div>
    </div>
  );
}
