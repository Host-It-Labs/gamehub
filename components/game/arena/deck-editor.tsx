'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Check, Droplet } from 'lucide-react';
import {
  DECK_SIZE,
  cards,
  deck as startingDeck,
  validDeck,
  type CardId,
} from '@/lib/games/arena/cards';
import { presets } from '@/lib/games/arena/decks';
import { draftPool } from '@/lib/games/arena/draft';
import './deck-phase.css';

const KEY = 'gamehub.arena.deck.v1';

/** Your Versus deck on this device, or the starting eight. */
export function rememberedDeck(): CardId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (
      validDeck(raw) &&
      raw.length === DECK_SIZE &&
      raw.every((id) => draftPool().includes(id))
    )
      return raw;
  } catch {
    // Private windows may block storage.
  }
  return [...startingDeck];
}

export function rememberDeck(deck: CardId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(deck));
  } catch {
    // Remembering the deck is a convenience only.
  }
}

/** Where a card's portrait is (decoded art once loaded, the file before). */
export type ArtOf = (id: CardId) => string | undefined;

/** A card's face: portrait, cost crystal. */
export function CardFace({ id, art }: { id: CardId; art: ArtOf }) {
  const src = art(id);
  return (
    <span className="arena-pc">
      {src ? (
        <img src={src} alt="" draggable={false} />
      ) : (
        <i className="arena-pc-blank" aria-hidden="true">
          {cards[id].name[0]}
        </i>
      )}
      <span className="arena-cost">{cards[id].cost}</span>
    </span>
  );
}

/** A ring that drains to a deadline on the `performance.now()` clock, with
 *  the seconds left inside. */
export function Ring({
  ends,
  total,
  className = '',
}: {
  ends: number;
  total: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, ends - now);
  const seconds = Math.ceil(left / 1000);
  // Set once per deadline: the animation then runs on its own.
  const fill = useRef<SVGCircleElement>(null);
  useLayoutEffect(() => {
    const el = fill.current;
    if (!el) return;
    const gone = Math.min(
      total,
      Math.max(0, total - (ends - performance.now())),
    );
    el.style.setProperty('--ring-total', `${total}ms`);
    el.style.setProperty('--ring-delay', `${-gone}ms`);
  }, [ends, total]);
  return (
    <span
      className={`arena-ring ${className}`}
      data-low={seconds <= 3}
      role="timer"
      aria-label={`${seconds} seconds`}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="arena-ring-track" cx="22" cy="22" r="19" />
        <circle
          key={ends}
          className="arena-ring-fill"
          cx="22"
          cy="22"
          r="19"
          ref={fill}
          pathLength={100}
        />
      </svg>
      <b aria-hidden="true">{seconds}</b>
    </span>
  );
}

export type SeatDot = {
  name: string;
  /** 0 your side, 1 the other. */
  team: 0 | 1;
  ready: boolean;
};

/** Players as small name badges with a dot that lights when they are in. */
export function SeatDots({
  seats,
  className = '',
}: {
  seats: SeatDot[];
  className?: string;
}) {
  return (
    <ul className={`arena-dots ${className}`} aria-label="Players">
      {seats.map((s, i) => (
        <li key={i} className={`team-${s.team}`} data-ready={s.ready}>
          <span>{s.name}</span>
          <i aria-label={s.ready ? 'Ready' : 'Choosing'} />
        </li>
      ))}
    </ul>
  );
}

/** The cards a deck may hold, cheapest first. */
function pool() {
  const all = draftPool();
  return [...all].sort(
    (a, b) => cards[a].cost - cards[b].cost || all.indexOf(a) - all.indexOf(b),
  );
}

const sameSet = (a: CardId[], b: CardId[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * The deck picker over the battle's loading screen: your eight on top, every
 * card below, the ready-made decks as quick picks, the average elixir and
 * one Ready. Tap a slot then a card, or a card then a slot, to swap; a card
 * already in the deck picks its slot.
 */
export function DeckPicker({
  deck,
  onChange,
  onReady,
  art,
  seats,
  clock,
}: {
  deck: CardId[];
  onChange: (deck: CardId[]) => void;
  onReady: () => void;
  art: ArtOf;
  /** Everyone at an online table, with their Ready dots. */
  seats?: SeatDot[];
  /** The phase's cap, as a draining ring beside Ready. */
  clock?: { ends: number; total: number };
}) {
  const [held, setHeld] = useState<{ slot?: number; card?: CardId }>({});
  // A swap pops the slot it lands in.
  const [landed, setLanded] = useState<{ slot: number; n: number } | null>(
    null,
  );
  const [all] = useState(pool);
  const put = (slot: number, id: CardId) => {
    const next = [...deck];
    next[slot] = id;
    rememberDeck(next);
    onChange(next);
    setHeld({});
    setLanded((l) => ({ slot, n: (l?.n ?? 0) + 1 }));
  };
  const tapSlot = (slot: number) => {
    if (held.card) return put(slot, held.card);
    setHeld((h) => (h.slot === slot ? {} : { slot }));
  };
  const tapCard = (id: CardId) => {
    const at = deck.indexOf(id);
    if (at >= 0) return setHeld((h) => (h.slot === at ? {} : { slot: at }));
    if (held.slot !== undefined) return put(held.slot, id);
    setHeld((h) => (h.card === id ? {} : { card: id }));
  };
  const pickPreset = (list: CardId[]) => {
    rememberDeck(list);
    onChange([...list]);
    setHeld({});
  };
  const avg = deck.reduce((s, c) => s + cards[c].cost, 0) / deck.length;
  const cols = all.length > 18 ? 8 : 6;
  return (
    <section
      className="arena-pick"
      aria-label="Your deck"
      style={
        {
          '--cols': cols,
          '--rows': Math.ceil(all.length / cols),
          '--rows-phone': Math.ceil(all.length / 6),
        } as CSSProperties
      }
    >
      {seats && <SeatDots seats={seats} />}
      <ol
        className="arena-pick-deck"
        aria-label="In your deck"
        data-holding={!!held.card}
      >
        {deck.map((id, i) => (
          <li key={i}>
            <button
              type="button"
              aria-pressed={held.slot === i}
              aria-label={`${cards[id].name}, ${cards[id].cost} elixir`}
              data-landed={landed?.slot === i ? landed.n % 2 : undefined}
              onClick={() => tapSlot(i)}
            >
              <CardFace id={id} art={art} />
            </button>
          </li>
        ))}
      </ol>
      <div className="arena-pick-bar">
        <ul className="arena-pick-presets" aria-label="Ready-made decks">
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={sameSet(p.cards, deck)}
                onClick={() => pickPreset(p.cards)}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        <span
          className="arena-pick-avg"
          aria-label={`Average elixir ${avg.toFixed(1)}`}
        >
          <Droplet aria-hidden="true" />
          {avg.toFixed(1)}
        </span>
      </div>
      <div className="arena-pick-fit">
        <ul className="arena-pick-all" aria-label="Every card">
          {all.map((id) => {
            const on = deck.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  data-in={on}
                  aria-pressed={
                    held.card === id || held.slot === deck.indexOf(id)
                  }
                  aria-label={`${cards[id].name}, ${cards[id].cost} elixir${on ? ', in your deck' : ''}`}
                  onClick={() => tapCard(id)}
                >
                  <CardFace id={id} art={art} />
                  {on && <Check className="arena-pick-in" aria-hidden="true" />}
                  <span className="arena-pc-name">{cards[id].name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="arena-pick-go">
        {clock && <Ring ends={clock.ends} total={clock.total} />}
        <button
          type="button"
          className="arena-button arena-pick-ready"
          data-starts-game
          onClick={onReady}
        >
          <Check aria-hidden="true" /> Ready
        </button>
      </div>
    </section>
  );
}

/** A thin row of what is held while the rest of the table decides. */
export function DeckWait({
  seats,
  clock,
  children,
}: {
  seats: SeatDot[];
  clock?: { ends: number; total: number };
  children?: ReactNode;
}) {
  return (
    <section className="arena-pick-wait" aria-label="Players">
      {clock && <Ring ends={clock.ends} total={clock.total} />}
      <SeatDots seats={seats} />
      {children}
    </section>
  );
}
