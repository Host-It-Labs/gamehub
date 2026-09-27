'use client';
import { useEffect } from 'react';

/** Fields you type into keep their own copy, paste and context menu. */
function editable(target: EventTarget | null) {
  // Selection starts on a text node; look from its element.
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return (
    !!element &&
    !!element.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    )
  );
}

/**
 * Nothing on the site can be copied: no copy or cut shortcuts, no text
 * selection started by dragging or a long press, no context menu (the
 * long-press menu on phones) and no dragging images out. The CSS in
 * `app/globals.css` turns selection off; this catches what CSS cannot.
 */
export function CopyGuard() {
  useEffect(() => {
    const block = (event: Event) => {
      if (!editable(event.target)) event.preventDefault();
    };
    const drag = (event: DragEvent) => {
      // Game pieces use pointer events, not native drag and drop.
      if (
        event.target instanceof Element &&
        event.target.closest('img, a, svg, picture, canvas')
      )
        event.preventDefault();
    };
    const events = ['copy', 'cut', 'selectstart', 'contextmenu'] as const;
    for (const name of events) document.addEventListener(name, block, true);
    document.addEventListener('dragstart', drag, true);
    return () => {
      for (const name of events)
        document.removeEventListener(name, block, true);
      document.removeEventListener('dragstart', drag, true);
    };
  }, []);
  return null;
}
