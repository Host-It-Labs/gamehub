'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { BookOpen, Heart, X } from 'lucide-react';
import { packFor, type PackId } from '@/lib/games/relic/scratch';
import { RuleList, Rules } from './rules';
import { TICKET_ART } from './relic-scratch-art';

const HIDDEN_KEY = 'gamehub-lucky-guide-hidden';

const heart = <Heart size={10} fill="currentColor" aria-label="a heart" />;

/** How each book plays, said once on its own ticket: two short lines. */
const GUIDE: Record<
  PackId,
  { mark: ReactNode; name: string; text: ReactNode }[]
> = {
  seven: [
    {
      mark: '7',
      name: 'Find every 7',
      text: <>A miss costs a&nbsp;{heart} and points to the nearest 7.</>,
    },
    {
      mark: '✓',
      name: 'All found',
      text: <>Each {heart} left scratches one more seal for you.</>,
    },
  ],
  twins: [
    {
      mark: '2',
      name: 'Find the twins',
      text: 'Scratch a seal, then its twin beside it with the same number.',
    },
    {
      mark: heart,
      name: 'Wrong twin',
      text: <>Costs a&nbsp;{heart}, and that pair is lost.</>,
    },
  ],
  path: [
    {
      mark: '1→',
      name: 'One path',
      text: 'Draw from 1 through every seal, numbers in order.',
    },
    {
      mark: heart,
      name: 'Hedges',
      text: <>Never cross a hedge. A wrong step costs a&nbsp;{heart}.</>,
    },
  ],
  ladder: [
    {
      mark: '▲▼',
      name: 'Higher or lower',
      text: 'Scratch ▲ if the next card is higher, ▼ if lower.',
    },
    {
      mark: heart,
      name: 'Climb',
      text: <>Each card comes once. A miss costs a&nbsp;{heart}.</>,
    },
  ],
  mine: [
    {
      mark: '3',
      name: 'Dig the gems',
      text: 'Numbers count the dynamite in the eight cells around.',
    },
    {
      mark: heart,
      name: 'Dynamite',
      text: <>Costs a&nbsp;{heart}. Empty ground opens its neighbours.</>,
    },
  ],
  sunmoon: [
    {
      mark: '☾',
      name: 'Moons only',
      text: 'Every row and column holds as many suns as moons.',
    },
    {
      mark: '=',
      name: 'Never 3 alike',
      text: (
        <>
          No three in a line. <b>=</b> joins the same, <b>×</b> different.
        </>
      ),
    },
  ],
  chart: [
    {
      mark: '⚓',
      name: 'Find the ships',
      text: 'Edge numbers count ship parts in each row and column.',
    },
    {
      mark: heart,
      name: 'Keep apart',
      text: (
        <>Ships never touch, even at corners. Water costs a&nbsp;{heart}.</>
      ),
    },
  ],
  crown: [
    {
      mark: '♛',
      name: 'One crown each',
      text: 'One crown per row, column and colour.',
    },
    {
      mark: heart,
      name: 'Keep apart',
      text: (
        <>Crowns never touch, even at corners. A miss costs a&nbsp;{heart}.</>
      ),
    },
  ],
};

/** What a player cannot work out from the ticket, shown at all times. */
function Facts({ book, level: at }: { book: PackId; level: number }) {
  const pack = packFor(book),
    level = pack.levels[at] as { count: number; ships?: number[] };
  switch (pack.mechanic) {
    case 'ladder':
      return (
        <span
          className="rs-guide-facts"
          aria-label={`Cards 1 to ${level.count}`}
        >
          Cards <b>1–{level.count}</b>
        </span>
      );
    case 'mine':
      return (
        <span className="rs-guide-facts">
          <b>{level.count}</b> dynamite
        </span>
      );
    case 'chart':
      return level.ships ? (
        <span
          className="rs-guide-facts"
          aria-label={`Ships of ${level.ships.join(', ')}`}
        >
          {level.ships.map((n, i) => (
            <i
              key={i}
              className="rs-guide-ship"
              style={{ '--n': n } as React.CSSProperties}
            />
          ))}
        </span>
      ) : null;
  }
  return null;
}

// Books whose slip is put away, shared by every slip on the page (the one
// on the ticket and the one beside it), kept in localStorage.
const NONE: PackId[] = [];
let hiddenCache: PackId[] | null = null;
const listeners = new Set<() => void>();
function hiddenBooks(): PackId[] {
  if (hiddenCache) return hiddenCache;
  try {
    hiddenCache = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
  } catch {
    hiddenCache = [];
  }
  return hiddenCache ?? NONE;
}
function setHiddenBooks(next: PackId[]) {
  hiddenCache = next;
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  } catch {}
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The how-to slip for a ticket. On wide screens it stands beside the ticket
 * (`place="rail"`); on narrow ones it lies over the painted heading, never
 * over the scratch panel, so play goes on while it shows. The stylesheet
 * shows one of the two. Hidden per book once read; the book button brings it
 * back. Facts that cannot be worked out (Ladder's cards, the mine's
 * dynamite, the fleet) stay in view either way.
 */
export function TicketGuide({
  book,
  level,
  place = 'ticket',
}: {
  book: PackId;
  level: number;
  place?: 'ticket' | 'rail';
}) {
  const hidden = useSyncExternalStore(subscribe, hiddenBooks, () => NONE);
  const shut = hidden.includes(book);
  const toggle = () =>
    setHiddenBooks(
      shut ? hidden.filter((id) => id !== book) : [...hidden, book],
    );
  const [x, y] = TICKET_ART[book].panel;
  // The painted heading: above the panel, or beside it on a wide ticket.
  const side = x > y ? 'is-left' : 'is-top';
  const name = packFor(book).name;
  const button = (
    <button
      type="button"
      className="rs-guide-toggle"
      aria-label={shut ? `Show how ${name} works` : 'Hide the guide'}
      aria-expanded={!shut}
      onClick={toggle}
    >
      {shut ? <BookOpen size={15} /> : <X size={14} />}
    </button>
  );
  return (
    <div
      className={`rs-guide is-on-${place} ${place === 'ticket' ? side : ''} ${shut ? 'is-shut' : ''}`}
      style={
        {
          '--panel-x': x,
          '--panel-y': y,
        } as React.CSSProperties
      }
    >
      {shut ? (
        <div className="rs-guide-row">
          <Facts book={book} level={level} />
          {button}
        </div>
      ) : (
        <div
          className="rs-guide-card"
          role="note"
          aria-label={`How ${name} works`}
        >
          <Rules className="rs-guide-rules">
            <RuleList
              items={GUIDE[book].map((g, i) => ({
                key: String(i),
                mark: <span className="rs-guide-mark">{g.mark}</span>,
                name: g.name,
                text: g.text,
              }))}
            />
          </Rules>
          {button}
        </div>
      )}
      {!shut && <Facts book={book} level={level} />}
    </div>
  );
}
