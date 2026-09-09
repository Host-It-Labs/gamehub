'use client';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';

/** Native scrolling, with wheel routing only when the page has no vertical scroll. */
export function ScrollArea({
  children,
  className = '',
  itemSelector = ':scope > *',
  fitBoard,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  itemSelector?: string;
  fitBoard?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState([0, 0, 0, 0]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const touchDevice = window.matchMedia('(any-pointer: coarse)');
    function measure() {
      if (!el) return;
      // Scale the entire illustrated board, including pieces and hit targets.
      const board = el.firstElementChild as HTMLElement | null;
      if (fitBoard && board) {
        if (fitBoard === 'undertow') {
          const contentWidth = Math.max(
            320,
            board.querySelectorAll('.table-card').length * 119 + 20,
          );
          el.style.setProperty(
            '--tide-content-scale',
            String(
              Math.min(
                1,
                Math.max(0.1, (el.clientWidth - 32) / contentWidth),
                Math.max(0.1, (el.clientHeight - 24) / 220),
              ),
            ),
          );
        } else {
          const width = fitBoard === 'wildgrove' ? 660 : 540;
          const heightScale = Math.max(
            0.01,
            (el.clientHeight - 16) / ((width * 2) / 3),
          );
          const scale = touchDevice.matches
            ? heightScale
            : Math.max(
                0.01,
                Math.min((el.clientWidth - 12) / width, heightScale),
              );
          board.style.width = `${width}px`;
          board.style.height = `${(width * 2) / 3}px`;
          board.style.zoom = String(scale);
        }
      }
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
    function wheel(e: WheelEvent) {
      if (
        !el ||
        e.ctrlKey ||
        e.shiftKey ||
        Math.abs(e.deltaX) >= Math.abs(e.deltaY)
      )
        return;
      const page = document.scrollingElement;
      if (
        !page ||
        page.scrollHeight > page.clientHeight + 2 ||
        el.scrollWidth <= el.clientWidth + 2
      )
        return;
      // Preserve a nested panel that can actually scroll vertically in this direction.
      let node = e.target instanceof Element ? e.target : null;
      while (node && el.contains(node)) {
        const style = getComputedStyle(node);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 2 &&
          (e.deltaY < 0
            ? node.scrollTop > 0
            : node.scrollTop < node.scrollHeight - node.clientHeight - 1)
        )
          return;
        if (node === el) break;
        node = node.parentElement;
      }
      const delta =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
      const next = Math.max(
        0,
        Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + delta),
      );
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    }
    touchDevice.addEventListener('change', schedule);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      touchDevice.removeEventListener('change', schedule);
      if (fitBoard && fitBoard !== 'undertow' && el.parentElement)
        el.parentElement.style.minHeight = '';
      el.removeEventListener('scroll', schedule);
      el.removeEventListener('wheel', wheel);
    };
  }, [itemSelector, fitBoard]);
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
