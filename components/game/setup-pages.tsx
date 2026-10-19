'use client';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Puzzle,
  type LucideIcon,
} from 'lucide-react';
import { RadioGroup } from '@/components/ui/radio-group';
import { SetupRow } from './setup-row';

/** Every setup is the same height (a deck or two boards beside three
 *  extensions). Longer lists show this many at a time, behind a pager. */
export const TILES_PER_PAGE = { sets: 2, extensions: 3 } as const;

/** Pages over `count` items, opening on the page that holds `start`. */
export function usePages(count: number, per: number, start = 0) {
  const pages = Math.max(1, Math.ceil(count / per));
  const [page, setPage] = useState(() =>
    Math.min(pages - 1, Math.max(0, Math.floor(start / per))),
  );
  const current = Math.min(page, pages - 1);
  return {
    page: current,
    pages,
    setPage,
    from: current * per,
    to: current * per + per,
    /** Which pages hold one of the marked items (a pick, a switched-on extension). */
    marks: (marked: boolean[]) =>
      Array.from({ length: pages }, (_, p) =>
        marked.slice(p * per, p * per + per).some(Boolean),
      ),
  };
}

/** Arrows either side of one dot per page; a dot carries a mark when its page
 *  holds something chosen, so a pick on another page is never invisible. */
export function Pager({
  noun,
  page,
  pages,
  marked,
  onPage,
  className = '',
}: {
  noun: string;
  page: number;
  pages: number;
  marked?: boolean[];
  onPage: (page: number) => void;
  className?: string;
}) {
  if (pages < 2) return null;
  return (
    // Each button names its page ("Board, page 2 of 2"), so no group label.
    <div className={`setup-pager ${className}`}>
      <button
        type="button"
        className="pager-step"
        aria-label={`Previous ${noun}`}
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`pager-dot ${i === page ? 'on' : ''} ${marked?.[i] ? 'marked' : ''}`}
          aria-label={`${noun}, page ${i + 1} of ${pages}`}
          aria-current={i === page ? 'page' : undefined}
          onClick={() => onPage(i)}
        >
          <i aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        className="pager-step next"
        aria-label={`More ${noun}`}
        disabled={page === pages - 1}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

/** A row of picture cards (boards, maps, menus, decks), one chosen, two to a page. */
export function SetChoiceRow({
  label,
  Icon,
  className = '',
  value,
  onChange,
  disabled = false,
  cards,
}: {
  label: string;
  Icon?: LucideIcon;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Each card is a `label.set-card` holding its own radio item. */
  cards: { value: string; card: ReactNode }[];
}) {
  const chosen = Math.max(
    0,
    cards.findIndex((c) => c.value === value),
  );
  const pager = usePages(cards.length, TILES_PER_PAGE.sets, chosen);
  return (
    <SetupRow
      label={label}
      Icon={Icon}
      className={`setup-sets ${className}`}
      aside={
        <Pager
          noun={label.toLowerCase()}
          page={pager.page}
          pages={pager.pages}
          marked={pager.marks(cards.map((c) => c.value === value))}
          onPage={pager.setPage}
        />
      }
    >
      <RadioGroup
        aria-label={label}
        disabled={disabled}
        className="set-cards"
        value={value}
        onValueChange={(v) => onChange(String(v))}
      >
        {cards.slice(pager.from, pager.to).map((c) => (
          <Fragment key={c.value}>{c.card}</Fragment>
        ))}
      </RadioGroup>
    </SetupRow>
  );
}

/** The Extensions row: three tiles to a page; a dot marks a page with one switched on. */
export function ExtensionRow({
  items,
}: {
  items: { key: string; on: boolean; tile: ReactNode }[];
}) {
  const pager = usePages(items.length, TILES_PER_PAGE.extensions);
  return (
    <SetupRow
      label="Extensions"
      Icon={Puzzle}
      className="setup-extensions"
      aside={
        <Pager
          noun="extensions"
          page={pager.page}
          pages={pager.pages}
          marked={pager.marks(items.map((i) => i.on))}
          onPage={pager.setPage}
        />
      }
    >
      <div className="ext-list">
        {items.slice(pager.from, pager.to).map((i) => (
          <Fragment key={i.key}>{i.tile}</Fragment>
        ))}
      </div>
    </SetupRow>
  );
}

/**
 * The settings grid of a setup. The modal has one fixed height, so when the
 * rows do not fit (an online table adds Leads and Next round) the grid splits
 * at a visual row and the rest waits on the next page. Rows that wait are
 * hidden, not unmounted, so nothing typed or picked on them is lost.
 */
export function SetupOptions({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [starts, setStarts] = useState<number[]>([0]);
  const [page, setPage] = useState(0);
  const current = Math.min(page, starts.length - 1);
  const shown = useRef(current);

  // Only the DOM changes here: which rows the current page shows.
  useLayoutEffect(() => {
    shown.current = current;
    if (grid.current) showPage(grid.current, starts, current);
  }, [current, starts]);

  // The rows are measured whenever the room or a row changes size, or a row
  // comes or goes (a player joins and Leads appears).
  useEffect(() => {
    const el = grid.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = paginate(el);
      showPage(el, next, Math.min(shown.current, next.length - 1));
      setStarts((was) => (was.join() === next.join() ? was : next));
    };
    // Pagination hides rows, changing the sizes this observer watches. Apply
    // it on the next frame so that those changes cannot re-enter delivery.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const sizes = new ResizeObserver(schedule);
    const watchAll = () => {
      sizes.disconnect();
      sizes.observe(el);
      for (const kid of el.children) sizes.observe(kid);
    };
    const rows = new MutationObserver(() => {
      watchAll();
      schedule();
    });
    watchAll();
    rows.observe(el, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      rows.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={grid} className={`setup-options ${className}`}>
        {children}
      </div>
      <Pager
        className="setup-rows-pager"
        noun="settings"
        page={current}
        pages={starts.length}
        onPage={setPage}
      />
    </>
  );
}

/** Where each page of the grid starts, measured with every row shown. */
function paginate(el: HTMLElement) {
  const kids = [...el.children] as HTMLElement[];
  kids.forEach((kid) => delete kid.dataset.pagedOut);
  const room = el.clientHeight;
  // Children sharing a top edge sit in one visual row of the grid. Layout
  // offsets, not client rects: the dialog scales in while it opens.
  const rows: { first: number; top: number; bottom: number }[] = [];
  kids.forEach((kid, i) => {
    const top = kid.offsetTop;
    const bottom = top + kid.offsetHeight;
    const row = rows.at(-1);
    if (row && Math.abs(top - row.top) < 2)
      row.bottom = Math.max(row.bottom, bottom);
    else rows.push({ first: i, top, bottom });
  });
  // A page starts at a row, so the next page's grid places items exactly as here.
  const starts = [0];
  let pageTop = rows[0]?.top ?? 0;
  rows.forEach((row, i) => {
    if (i > 0 && row.bottom - pageTop > room + 1) {
      starts.push(row.first);
      pageTop = row.top;
    }
  });
  // One row taller than the room scrolls inside the grid rather than clipping.
  el.classList.toggle(
    'overflowing',
    rows.some((row) => row.bottom - row.top > room + 1),
  );
  return starts;
}

function showPage(el: HTMLElement, starts: number[], page: number) {
  const end = starts[page + 1] ?? Infinity;
  [...el.children].forEach((kid, i) => {
    if (!(kid instanceof HTMLElement)) return;
    if (i < starts[page] || i >= end) kid.dataset.pagedOut = '';
    else delete kid.dataset.pagedOut;
  });
}
