'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
type Drag = {
  id: number;
  pointer: number;
  base: number[];
  next: number[];
  pointerY: number;
  grabOffset: number;
  initialScroll: number;
  rows: { id: number; node: HTMLElement; top: number; height: number }[];
  gap: number;
  scroller: HTMLElement | null;
  frame: number;
  previousTime: number;
};
function move(values: number[], id: number, to: number) {
  const next = values.filter((v) => v !== id);
  next.splice(to, 0, id);
  return next;
}
/** Keep the captured DOM stationary. Only transforms change until the drop. */
export function SortableRanking({
  order,
  disabled,
  label,
  render,
  onReorder,
  onPreview,
}: {
  order: number[];
  disabled: boolean;
  label: (id: number) => string;
  render: (id: number, index: number) => ReactNode;
  onReorder: (order: number[]) => void;
  onPreview?: (order: number[]) => void;
}) {
  const list = useRef<HTMLOListElement>(null),
    drag = useRef<Drag | null>(null);
  const positions = useRef(new Map<number, number>());
  useLayoutEffect(() => {
    if (!list.current || drag.current) return;
    const next = new Map<number, number>();
    Array.from(list.current.children).forEach((child, index) => {
      const row = child as HTMLElement, id = order[index], top = row.getBoundingClientRect().top;
      const previous = positions.current.get(id);
      next.set(id, top);
      if (previous !== undefined && previous !== top && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        row.getAnimations().forEach(animation => animation.cancel());
        row.animate([{ transform: `translateY(${previous - top}px)` }, { transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' });
      }
    });
    positions.current = next;
  }, [order]);
  const latest = useRef({ order, disabled, onReorder, onPreview });
  const [held, setHeld] = useState<{ id: number; base: number[] } | null>(null);
  const [pending, setPending] = useState<{
    base: number[];
    next: number[];
  } | null>(null);
  const [preview, setPreview] = useState<number[] | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    latest.current = { order, disabled, onReorder, onPreview };
  }, [order, disabled, onReorder, onPreview]);
  useEffect(
    () => () => {
      if (drag.current) cancelAnimationFrame(drag.current.frame);
    },
    [],
  );
  const shown = held?.base ?? (pending?.base === order ? pending.next : order);
  function end(commit: boolean) {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    cancelAnimationFrame(active.frame);
    for (const row of active.rows) {
      row.node.style.removeProperty('transform');
      row.node.style.removeProperty('transition');
    }
    list.current?.classList.remove('is-sorting');
    if (list.current?.hasPointerCapture(active.pointer))
      list.current.releasePointerCapture(active.pointer);
    if (!commit) latest.current.onPreview?.(active.base);
    setHeld(null);
    setPreview(null);
    if (
      commit &&
      !latest.current.disabled &&
      (latest.current.onPreview || latest.current.order.join() === active.base.join()) &&
      (latest.current.onPreview || active.next.join() !== active.base.join())
    ) {
      setPending({ base: latest.current.order, next: active.next });
      setAnnouncement(
        `${label(active.id)} moved to position ${active.next.indexOf(active.id) + 1} of ${active.next.length}.`,
      );
      latest.current.onReorder(active.next);
    }
  }
  function frame(time: number) {
    const active = drag.current,
      element = list.current;
    if (!active || !element) return;
    const dt = Math.min(32, time - active.previousTime);
    active.previousTime = time;
    const bounds = active.scroller?.getBoundingClientRect();
    const top = Math.max(0, bounds?.top ?? 0),
      bottom = Math.min(
        window.innerHeight,
        bounds?.bottom ?? window.innerHeight,
      );
    const edge = Math.min(80, (bottom - top) / 4);
    const speed =
      active.pointerY < top + edge
        ? -Math.min(1, (top + edge - active.pointerY) / edge)
        : active.pointerY > bottom - edge
          ? Math.min(1, (active.pointerY - bottom + edge) / edge)
          : 0;
    if (speed) {
      if (active.scroller) active.scroller.scrollTop += speed * dt * 0.65;
      else window.scrollBy(0, speed * dt * 0.65);
    }
    const scroll =
      (active.scroller?.scrollTop ?? window.scrollY) - active.initialScroll;
    const row = active.rows.find((r) => r.id === active.id)!;
    const localTop = active.pointerY - active.grabOffset + scroll;
    const first = active.rows[0],
      last = active.rows.at(-1)!;
    const y = Math.max(
      first.top,
      Math.min(last.top + last.height - row.height, localTop),
    );
    // Use the unclamped centre so the final slot is reachable even for tall rows.
    const centre = localTop + row.height / 2;
    const destination = active.rows.filter(
      (r) => r.id !== active.id && centre >= r.top + r.height / 2,
    ).length;
    const next = move(active.base, active.id, destination);
    if (next.join() !== active.next.join()) {
      setPreview(next);
      latest.current.onPreview?.(next);
    }
    active.next = next;
    let slot = first.top;
    for (const id of active.next) {
      const current = active.rows.find((r) => r.id === id)!;
      current.node.style.transform = `translate3d(0,${id === active.id ? y - current.top : slot - current.top}px,0)`;
      slot += current.height + active.gap;
    }
    active.frame = requestAnimationFrame(frame);
  }
  return (
    <>
      <ol
        ref={list}
        className="tier-list"
        aria-label="Ranking; drag handles or use arrow keys"
        onPointerMove={(event) => {
          if (drag.current?.pointer === event.pointerId)
            drag.current.pointerY = event.clientY;
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointer === event.pointerId) {
            drag.current.pointerY = event.clientY;
            cancelAnimationFrame(drag.current.frame);
            frame(event.timeStamp);
            end(true);
          }
        }}
        onPointerCancel={() => end(false)}
        onLostPointerCapture={() => end(false)}
      >
        {shown.map((id, index) => (
          <li
            key={id}
            className={`tier-row tier-${preview ? preview.indexOf(id) : index} ${held?.id === id ? 'is-dragging' : ''}`}
          >
            {render(id, preview ? preview.indexOf(id) : index)}
            {!disabled && (
              <button
                type="button"
                className="ranking-handle"
                aria-label={`Move ${label(id)}. Drag, or use up and down arrows.`}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && drag.current) {
                    event.preventDefault();
                    end(false);
                    return;
                  }
                  const direction =
                    event.key === 'ArrowUp'
                      ? -1
                      : event.key === 'ArrowDown'
                        ? 1
                        : 0;
                  if (!direction || drag.current) return;
                  event.preventDefault();
                  const to = Math.max(
                    0,
                    Math.min(shown.length - 1, index + direction),
                  );
                  if (to !== index) {
                    const next = move(shown, id, to);
                    setPending({ base: order, next });
                    onReorder(next);
                    setAnnouncement(
                      `${label(id)} moved to position ${to + 1}.`,
                    );
                  }
                }}
                onPointerDown={(event) => {
                  if (
                    event.button !== 0 ||
                    !event.isPrimary ||
                    drag.current ||
                    !list.current
                  )
                    return;
                  event.preventDefault();
                  event.currentTarget.focus({ preventScroll: true });
                  positions.current.clear();
                  Array.from(list.current.children).forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
                  const nodes = Array.from(
                    list.current.children,
                  ) as HTMLElement[];
                  const rows = nodes.map((node, i) => {
                    const box = node.getBoundingClientRect();
                    return {
                      id: shown[i],
                      node,
                      top: box.top,
                      height: box.height,
                    };
                  });
                  let scroller = list.current.parentElement;
                  while (
                    scroller &&
                    !(
                      scroller.scrollHeight > scroller.clientHeight + 1 &&
                      /(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
                    )
                  )
                    scroller = scroller.parentElement;
                  if (
                    scroller === document.body ||
                    scroller === document.documentElement
                  )
                    scroller = null;
                  const selected = rows[index];
                  const active: Drag = {
                    id,
                    pointer: event.pointerId,
                    base: [...shown],
                    next: [...shown],
                    pointerY: event.clientY,
                    grabOffset: event.clientY - selected.top,
                    initialScroll: scroller?.scrollTop ?? window.scrollY,
                    rows,
                    gap:
                      rows.length > 1
                        ? rows[1].top - rows[0].top - rows[0].height
                        : 0,
                    scroller,
                    frame: 0,
                    previousTime: event.timeStamp,
                  };
                  drag.current = active;
                  setHeld({ id, base: [...shown] });
                  list.current.classList.add('is-sorting');
                  list.current.setPointerCapture(event.pointerId);
                  active.frame = requestAnimationFrame(frame);
                }}
              >
                <GripVertical size={24} />
              </button>
            )}
          </li>
        ))}
      </ol>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </>
  );
}
