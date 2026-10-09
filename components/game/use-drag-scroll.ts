'use client';
import { useEffect, type RefObject } from 'react';

/** How far the mouse moves before a press becomes a drag, not a click. */
const DRAG_FROM = 6;

/**
 * Lets a mouse hold and drag a row that scrolls sideways, the way a finger
 * already does. Touch and pen keep the browser's own scrolling. Snapping is
 * off while dragging, and the click that ends a drag is swallowed so letting
 * go over a card does not open it.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; left: number; id: number } | null = null;
    let dragging = false;

    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;
      start = { x: event.clientX, left: el.scrollLeft, id: event.pointerId };
      dragging = false;
    };
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_FROM) return;
        dragging = true;
        el.setPointerCapture(start.id);
        el.classList.add('is-dragging');
      }
      el.scrollLeft = start.left - dx;
    };
    const up = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      start = null;
      if (!dragging) return;
      // Snapping comes back and settles on the nearest card.
      el.classList.remove('is-dragging');
      // The click fires after pointerup; drop it, then forget.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => {
        el.removeEventListener('click', swallow, { capture: true });
        dragging = false;
      }, 0);
    };
    const cancel = (event: PointerEvent) => {
      if (start && event.pointerId === start.id) {
        start = null;
        dragging = false;
        el.classList.remove('is-dragging');
      }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('lostpointercapture', cancel);
    };
  }, [ref]);
}
