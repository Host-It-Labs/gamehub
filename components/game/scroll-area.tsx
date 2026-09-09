'use client';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';

/** Passive edge labels: native scrolling remains the only interaction. */
export function ScrollArea({
  children,
  className = '',
  itemSelector = ':scope > *',
  ...props
}: HTMLAttributes<HTMLDivElement> & { itemSelector?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState([0, 0, 0, 0]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    function measure() {
      if (!el) return;
      const box = el.getBoundingClientRect();
      const next = [0, 0, 0, 0];
      el.querySelectorAll(itemSelector).forEach((item) => {
        const r = item.getBoundingClientRect();
        if (r.left < box.left - 6) next[0]++;
        if (r.right > box.right + 6) next[1]++;
        if (r.top < box.top - 6) next[2]++;
        if (r.bottom > box.bottom + 6) next[3]++;
      });
      if (el.scrollLeft < 2) next[0] = 0;
      if (el.scrollWidth - el.clientWidth - el.scrollLeft < 2) next[1] = 0;
      if (el.scrollTop < 2) next[2] = 0;
      if (el.scrollHeight - el.clientHeight - el.scrollTop < 2) next[3] = 0;
      setHidden((old) => (old.every((n, i) => n === next[i]) ? old : next));
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    const mutation = new MutationObserver(schedule);
    mutation.observe(el, { childList: true, subtree: true });
    el.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      el.removeEventListener('scroll', schedule);
    };
  }, [itemSelector]);
  return (
    <div
      className={`scroll-frame ${className.includes('hand') ? 'hand-frame' : 'board-frame'} ${className.includes('token-tray') ? 'token-frame' : ''}`}
    >
      <div {...props} className={className} ref={ref}>
        {children}
      </div>
      {hidden.map(
        (n, i) =>
          n > 0 && (
            <span
              key={i}
              className={`scroll-hint edge-${i}`}
              aria-label={`${n} partially or fully hidden ${['to the left', 'to the right', 'above', 'below'][i]}`}
            >
              {n} {['left', 'right', 'above', 'below'][i]}
            </span>
          ),
      )}
    </div>
  );
}
