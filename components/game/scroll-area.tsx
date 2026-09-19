'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Overflow regions must be focusable for native keyboard scrolling. */
import { paperWorldFor, paperWorldFrame } from '@/lib/games/mora-world';
import {
  isTableWorldGame,
  tableWorldFor,
  tableWorldFrame,
} from '@/lib/games/table-world';
import { illustratedBoardScale } from '@/lib/games/viewport';
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';

/**
 * Rule cards keep their screen size while the scene scales, so on narrow
 * stages a card centred on its habitat can run past the stage edge. Slide
 * such cards inward just enough to stay readable; the CSS applies the nudge.
 */
function keepLabelsOnStage(
  board: HTMLElement,
  stage: DOMRect,
  watch: (node: Element) => void,
) {
  const gutter = 6;
  for (const label of board.querySelectorAll<HTMLElement>(
    '.mora-ground-label',
  )) {
    watch(label);
    const previous =
      parseFloat(label.style.getPropertyValue('--label-nudge')) || 0;
    const r = label.getBoundingClientRect();
    const left = r.left - previous,
      right = r.right - previous;
    const nudge =
      left < stage.left + gutter
        ? stage.left + gutter - left
        : right > stage.right - gutter
          ? stage.right - gutter - right
          : 0;
    if (Math.abs(nudge - previous) > 0.5)
      label.style.setProperty('--label-nudge', `${nudge}px`);
  }
}

/** Native scrolling, with wheel routing only when the page has no vertical scroll. */
export function ScrollArea({
  children,
  className = '',
  fitBoard,
  fitBoardWidth = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  fitBoard?: string;
  fitBoardWidth?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({
    left: false,
    right: false,
    vertical: false,
  });
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
        if (board.dataset.paperWorld) {
          // The scene covers the whole table; the stage is only where gameplay must stay.
          const tall = board.dataset.paperWorld === 'portrait';
          const world = board.dataset.world;
          const surface = el.closest<HTMLElement>('.table-layout') ?? el;
          const s = surface.getBoundingClientRect(),
            r = el.getBoundingClientRect();
          const stage = {
            x: r.left - s.left,
            y: r.top - s.top,
            width: el.clientWidth,
            height: el.clientHeight,
          };
          const size = { width: s.width, height: s.height };
          // Candidate variants share one geometry, so the frame needs no variant.
          const layout =
            world && isTableWorldGame(world)
              ? tableWorldFrame(tableWorldFor(world, tall), size, stage)
              : paperWorldFrame(paperWorldFor(tall), size, stage);
          board.style.width = `${layout.width}px`;
          board.style.height = `${layout.height}px`;
          board.style.position = 'absolute';
          board.style.left = `${layout.x - stage.x}px`;
          board.style.top = `${layout.y - stage.y}px`;
          board.style.margin = '0';
          board.style.zoom = '1';
          el.scrollLeft = 0;
          el.scrollTop = 0;
          keepLabelsOnStage(board, r, watch);
        } else if (board.classList.contains('mora-board')) {
          // Existing coastal geography retains its independent layout.
          const scale = illustratedBoardScale(
            660,
            el.clientWidth,
            el.clientHeight,
            portrait.matches,
          );
          const width = 660 * scale;
          board.style.width = `${width}px`;
          board.style.height = `${width / 1.5}px`;
          board.style.zoom = '1';
          board.style.setProperty('--board-scale', '1');
          board.style.setProperty(
            '--goals-left',
            `${Math.min(width / 2, el.clientWidth / 2 + el.scrollLeft)}px`,
          );
        } else if (fitBoard === 'undertow') {
          const width = Math.max(
            280,
            Math.min(el.clientWidth - 12, el.clientHeight * 1.47 - 12),
          );
          board.style.width = `${width}px`;
          board.style.height = `${width / 1.47}px`;
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
          board.style.setProperty('--board-scale', String(scale));
          const center =
            (el.getBoundingClientRect().left +
              el.clientWidth / 2 -
              board.getBoundingClientRect().left) /
            scale;
          const badgeHalf =
            (board.querySelector<HTMLElement>('.sanctuary-goals')
              ?.offsetWidth ?? 0) / 2;
          board.style.setProperty(
            '--goals-left',
            `${Math.max(badgeHalf + 4, Math.min(width - badgeHalf - 4, center))}px`,
          );
        }
      }
      const staged = !!(board && board.dataset.paperWorld);
      const next = {
        left: !staged && el.scrollLeft > 3,
        right: !staged && el.scrollWidth - el.clientWidth - el.scrollLeft > 3,
        vertical: !staged && el.scrollHeight > el.clientHeight + 3,
      };
      setEdges((old) =>
        old.left === next.left &&
        old.right === next.right &&
        old.vertical === next.vertical
          ? old
          : next,
      );
    }
    function onScroll() {
      if (el && (el.scrollLeft > 8 || el.scrollTop > 8)) setExplored(true);
      schedule();
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const resize = new ResizeObserver(schedule);
    const watched = new WeakSet<Element>();
    const watch = (node: Element) => {
      if (watched.has(node)) return;
      watched.add(node);
      resize.observe(node);
    };
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    const surface = el.closest<HTMLElement>('.table-layout');
    if (surface && surface !== el) resize.observe(surface);
    const mutation = new MutationObserver(schedule);
    mutation.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-paper-world'],
    });
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
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    el.addEventListener('scroll', onScroll, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      if (fitBoard && fitBoard !== 'undertow' && el.parentElement)
        el.parentElement.style.minHeight = '';
      portrait.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', wheel);
    };
  }, [fitBoard, fitBoardWidth]);
  return (
    <div
      className={`scroll-frame ${className.includes('hand') ? 'hand-frame' : 'board-frame'} ${className.includes('token-tray') ? 'token-frame' : ''}`}
    >
      <section
        {...props}
        className={className}
        ref={ref}
        tabIndex={edges.left || edges.right || edges.vertical ? 0 : undefined}
        aria-label={
          fitBoard
            ? 'Game board. Scroll to explore.'
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
      {fitBoard &&
        !explored &&
        (edges.left || edges.right || edges.vertical) && (
          <span className="board-pan-cue">
            {edges.vertical
              ? '↔ ↕ Swipe or scroll to explore'
              : '↔ Swipe or scroll to explore'}
          </span>
        )}
    </div>
  );
}
