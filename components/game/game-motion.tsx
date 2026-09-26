'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { createGameMotionController } from './game-motion-controller';
import './game-motion.css';

/** Keep the root mounted. Explicit markers animate new pieces, changed values,
 * and stage changes without resetting drafts, focus, scroll or canvas state. */
export function useGameMotion(root: RefObject<HTMLElement | null>, phaseKey: string | number) {
  const session = useRef<{
    element: HTMLElement;
    controller: ReturnType<typeof createGameMotionController>;
  } | null>(null);

  // Every commit also handles a conditional root appearing after the library.
  useLayoutEffect(() => {
    if (session.current?.element !== root.current) {
      session.current?.controller.dispose();
      session.current = root.current
        ? { element: root.current, controller: createGameMotionController(root.current) }
        : null;
    }
    session.current?.controller.update(phaseKey);
  });
  useLayoutEffect(() => () => {
    session.current?.controller.dispose();
    session.current = null;
  }, []);
}
