'use client';

import { useEffect, useState } from 'react';
import { TURN_EVENT } from '@/lib/games/turn-signal';
import './turn-signal.css';

/** Every game's Your turn: one soft breath of light round the edge of the
 *  screen. It never takes a tap, never covers a control and has no words;
 *  it shows with sound off too. Mounted once, in the root layout. */
export function TurnSignal() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const show = () => setPulse((n) => n + 1);
    window.addEventListener(TURN_EVENT, show);
    return () => window.removeEventListener(TURN_EVENT, show);
  }, []);
  if (!pulse) return null;
  return (
    <div
      key={pulse}
      className="turn-signal"
      aria-hidden="true"
      onAnimationEnd={() => setPulse(0)}
    />
  );
}
