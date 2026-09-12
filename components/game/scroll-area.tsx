'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Overflow regions must be focusable for native keyboard scrolling. */
import { illustratedBoardScale } from '@/lib/games/viewport';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';

/** Native scrolling, with wheel routing only when the page has no vertical scroll. */
export function ScrollArea({
  children,
  className = '',
  fitBoard,
  ...props
}: HTMLAttributes<HTMLElement> & {
  fitBoard?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [explored, setExplored] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const portrait = window.matchMedia('(orientation: portrait)');
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
          const scale = illustratedBoardScale(
            width,
            el.clientWidth,
            el.clientHeight,
            portrait.matches,
          );
          board.style.width = `${width}px`;
          board.style.height = `${(width * 2) / 3}px`;
          board.style.zoom = String(scale);
        }
      }
      const next = {
        left: el.scrollLeft > 3,
        right: el.scrollWidth - el.clientWidth - el.scrollLeft > 3,
      };
      setEdges((old) =>
        old.left === next.left && old.right === next.right ? old : next,
      );
    }
    function onScroll() {
      if (el && el.scrollLeft > 8) setExplored(true);
      schedule();
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
    el.addEventListener('wheel', wheel, { passive: false });
    portrait.addEventListener('change', schedule);
    el.addEventListener('scroll', onScroll, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      if (fitBoard && fitBoard !== 'undertow' && el.parentElement)
        el.parentElement.style.minHeight = '';
      portrait.removeEventListener('change', schedule);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', wheel);
    };
  }, [fitBoard]);
  return (
    <div
      className={`scroll-frame ${className.includes('hand') ? 'hand-frame' : 'board-frame'} ${className.includes('token-tray') ? 'token-frame' : ''}`}
    >
      <section
        {...props}
        className={className}
        ref={ref}
        tabIndex={edges.left || edges.right ? 0 : undefined}
        aria-label={
          fitBoard
            ? 'Game board. Scroll sideways to explore.'
            : 'Your hand. Scroll sideways to see more.'
        }
      >
        {children}
      </section>
      {edges.left && (
        <span className="scroll-fade scroll-fade-left" aria-hidden="true" />
      )}
      {edges.right && (
        <span className="scroll-fade scroll-fade-right" aria-hidden="true" />
      )}
      {fitBoard && !explored && (edges.left || edges.right) && (
        <span className="board-pan-cue">↔ Swipe or scroll to explore</span>
      )}
    </div>
  );
}
