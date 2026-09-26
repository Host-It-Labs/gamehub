'use client';
import { useLayoutEffect, type RefObject } from 'react';

/**
 * Player badges show full names while the row fits, and fall back to the
 * contracted badge (avatar, score, state) once it would scroll sideways.
 * The row is measured with names shown, then marked `data-fit="compact"`.
 * The attribute is set directly so a React className update never drops it.
 */
export function useBadgeFit(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const check = () => {
      row.removeAttribute('data-fit');
      if (row.scrollWidth > row.clientWidth + 1) row.dataset.fit = 'compact';
    };
    check();
    // Name contraction can resize a shrink-wrapped badge row. Measure on the
    // next frame instead of resizing it inside ResizeObserver's delivery loop.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    observer.observe(row);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
}
