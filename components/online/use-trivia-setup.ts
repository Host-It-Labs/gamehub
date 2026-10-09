'use client';
import { useState, useSyncExternalStore } from 'react';
import { triviaSetupMode } from '../../lib/online/trivia-setup.ts';

const subscribe = () => () => {};
const serverMode = () => null;

/** Hydration starts without a request; the browser then keeps its first pick. */
export function useTriviaSetupMode() {
  const [readMode] = useState(() => {
    let captured: ReturnType<typeof triviaSetupMode> | undefined;
    return () => {
      if (captured === undefined)
        captured = triviaSetupMode(window.location.search);
      return captured;
    };
  });
  return useSyncExternalStore(subscribe, readMode, serverMode);
}
