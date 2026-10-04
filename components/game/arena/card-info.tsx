'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  Bird,
  Bomb,
  Bug,
  Castle,
  ChevronsRight,
  CircleDot,
  CircleOff,
  Crosshair,
  Droplets,
  Drum,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HeartPulse,
  Hourglass,
  Megaphone,
  MoveRight,
  Pickaxe,
  Rabbit,
  Radius,
  RotateCw,
  Shield,
  ShieldHalf,
  Snowflake,
  Sparkles,
  Sword,
  Target,
  Timer,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { allCards, cards, type CardId } from '@/lib/games/arena/cards';
import { cardFacts, type StatKey } from '@/lib/games/arena/card-facts';
import type { Boost, Match } from '@/lib/games/arena/engine';
import { arenaManifest } from './assets';
import type { ArenaView } from './view';
import './card-info.css';

const STAT_ICON: Record<StatKey, LucideIcon> = {
  hp: Heart,
  damage: Sword,
  dps: Gauge,
  hitSpeed: Timer,
  range: Crosshair,
  speed: Footprints,
  targets: Target,
  splash: CircleDot,
  towerDamage: Castle,
  radius: Radius,
  delay: Hourglass,
};

const ABILITY_ICON: Record<string, LucideIcon> = {
  leap: Rabbit,
  spin: RotateCw,
  rage: Flame,
  shield: Shield,
  heal: HeartPulse,
  burrow: Pickaxe,
  deathBlast: Bomb,
  chain: Zap,
  stun: Sparkles,
  minRange: CircleOff,
  armour: ShieldHalf,
  taunt: Megaphone,
  knockback: MoveRight,
  tackle: ChevronsRight,
  spawn: Bug,
  aura: Drum,
  follows: Users,
  cone: Droplets,
  slow: Snowflake,
  anywhere: Crosshair,
};

const artOf = (id: CardId, art?: Partial<Record<string, string>>) =>
  art?.[id] ?? arenaManifest.cards[id]?.path;

/**
 * One card as a little collector's card: the portrait with its cost and
 * troop count, the name and roles, a grid of stat tiles and one short line
 * per ability. `team` tints the frame (0 yours, 1 theirs) in battle.
 */
export function CardPanel({
  id,
  boost,
  art,
  team,
  className = '',
  live,
}: {
  id: CardId;
  boost?: Boost;
  art?: Partial<Record<string, string>>;
  team?: 0 | 1;
  className?: string;
  /** Announce changes (the browser's panel, not the hover card). */
  live?: boolean;
}) {
  const f = cardFacts(id, boost);
  const src = artOf(id, art);
  return (
    <article
      className={`arena-cardinfo ${className}`}
      data-team={team}
      data-kind={f.kind}
      aria-label={f.name}
      aria-live={live ? 'polite' : undefined}
    >
      <div className="arena-cardinfo-art">
        {src ? (
          <img src={src} alt="" draggable={false} />
        ) : (
          <span className="arena-cardinfo-blank" aria-hidden="true">
            {f.name[0]}
          </span>
        )}
        {f.cost > 0 && (
          <span className="arena-cardinfo-cost" aria-label={`${f.cost} elixir`}>
            {f.cost}
          </span>
        )}
        {f.count > 1 && (
          <span
            className="arena-cardinfo-count"
            aria-label={`${f.count} troops`}
          >
            ×{f.count}
          </span>
        )}
        {f.level > 1 && (
          <span
            className="arena-cardinfo-level"
            aria-label={`Level ${f.level}`}
          >
            {f.level}
          </span>
        )}
      </div>
      <header className="arena-cardinfo-head">
        <h3>{f.name}</h3>
        <p className="arena-cardinfo-roles">
          {f.roles.map((r) => (
            <span key={r}>{r}</span>
          ))}
          {f.flying && (
            <span className="fly">
              <Bird aria-hidden="true" />
              Flies
            </span>
          )}
        </p>
      </header>
      <dl className="arena-cardinfo-stats">
        {f.stats.map((s) => {
          const Icon = s.key === 'speed' && f.flying ? Bird : STAT_ICON[s.key];
          return (
            <div key={s.key} data-stat={s.key}>
              <dt>
                <Icon aria-hidden="true" />
                {s.label}
              </dt>
              <dd>{s.value}</dd>
            </div>
          );
        })}
      </dl>
      {f.abilities.length > 0 && (
        <ul className="arena-cardinfo-abilities">
          {f.abilities.map((a) => {
            const Icon = ABILITY_ICON[a.key] ?? Sparkles;
            return (
              <li key={a.key}>
                <Icon aria-hidden="true" />
                <span>{a.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

const ALL = 'All';
/** The role filters: every tag a card carries, in the cards' own order,
 *  then the spell. */
function roleFilters() {
  const seen: string[] = [];
  for (const id of allCards) {
    for (const r of cardFacts(id).roles) if (!seen.includes(r)) seen.push(r);
  }
  return [ALL, ...seen.filter((r) => r !== 'Spell'), 'Spell'];
}

/**
 * Every card and its stats, in a modal above the setup or the battle: the
 * cards in a grid (with a role filter), the picked one's panel beside them
 * (above them on phones). Hover or focus shows a card; arrow keys move
 * through the grid.
 */
export function CardBrowser({
  open,
  onOpenChange,
  boost,
  art,
  first,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boost?: Boost;
  art?: Partial<Record<string, string>>;
  /** The card shown when it opens. */
  first?: CardId;
}) {
  const filters = useMemo(() => roleFilters(), []);
  const [role, setRole] = useState(ALL);
  const [shown, setShown] = useState<CardId>(first ?? allCards[0]);
  const grid = useRef<HTMLUListElement>(null);
  const list = allCards.filter(
    (id) => role === ALL || cardFacts(id).roles.includes(role),
  );
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const buttons = [
      ...(grid.current?.querySelectorAll<HTMLButtonElement>('button') ?? []),
    ];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    let to = at + step;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // A row is as many buttons as share the first one's top.
      const top = buttons[0]?.offsetTop;
      const cols = Math.max(
        1,
        buttons.filter((b) => b.offsetTop === top).length,
      );
      to = at + (e.key === 'ArrowDown' ? cols : -cols);
    } else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = buttons.length - 1;
    else if (!step) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, to))]?.focus();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal arena-cards-modal">
        <DialogTitle>Cards</DialogTitle>
        <DialogDescription className="sr-only">
          Every card and its stats. Pick a card to see it.
        </DialogDescription>
        <fieldset className="arena-cards-filter" aria-label="Role">
          {filters.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {r}
            </button>
          ))}
        </fieldset>
        <div className="arena-cards-body">
          <CardPanel
            id={shown}
            boost={boost}
            art={art}
            className="arena-cards-panel"
            live
          />
          <ul ref={grid} className="arena-cards-grid" aria-label="Every card">
            {list.map((id) => {
              const src = artOf(id, art);
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={shown === id}
                    aria-label={`${cards[id].name}, ${cards[id].cost} elixir`}
                    onClick={() => setShown(id)}
                    onFocus={() => setShown(id)}
                    onKeyDown={move}
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse') setShown(id);
                    }}
                  >
                    {src ? (
                      <img src={src} alt="" draggable={false} loading="lazy" />
                    ) : (
                      <i aria-hidden="true">{cards[id].name[0]}</i>
                    )}
                    <span className="arena-cards-cost" aria-hidden="true">
                      {cards[id].cost}
                    </span>
                    <span className="arena-cards-name" aria-hidden="true">
                      {cards[id].name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** What the hover card shows: a card and whose it is. */
type Peek = { id: CardId; seat: number; key: string };

/** The hover card's tallest, for the room it needs beside the field. */
const PEEK_HEIGHT = 470;

const finePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * The battle's hover card (desktop, fine pointers only): hovering a card in
 * your hand, the next card, or any troop on the field shows that card's
 * panel in the forest at the right of the field (or, where the field is
 * seen across and fills the width, on its side in the meadow under it, right
 * of the hand), never over the field, the hand or the top bar. Picking runs ten times a second against where the
 * mouse last was, so a troop walking out from under a still mouse hides
 * it; React renders only when what is hovered changes. Nothing shows while
 * a button is held (a drag) or where the side band has no room.
 */
export function CardPeek({
  root,
  canvas,
  view,
  session,
  hand,
  art,
  enabled,
}: {
  root: RefObject<HTMLElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  view: RefObject<ArenaView | null>;
  /** The battle: its match as it is now (read on each pick) and your seat. */
  session: {
    readonly match: Match;
    readonly you: number;
    readonly side: 0 | 1;
  };
  /** The hand's card buttons, in slot order. */
  hand: RefObject<(HTMLElement | null)[]>;
  art?: Partial<Record<string, string>>;
  enabled: boolean;
}) {
  const [peek, setPeek] = useState<Peek | null>(null);
  const [band, setBand] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    /** Beside the hand, under the field: the card lies on its side. */
    wide?: boolean;
  } | null>(null);
  const shownKey = useRef('');
  // Nothing shows while the hover card is off or has no room; going off
  // clears it, so turning it back on starts empty.
  const live = enabled && band !== null;
  const [wasLive, setWasLive] = useState(live);
  if (wasLive !== live) {
    setWasLive(live);
    if (!live) setPeek(null);
  }

  // The room at the right of the field: from the walls' rightmost point on
  // screen to the window's edge, below the top corner.
  useEffect(() => {
    if (!enabled || !finePointer()) return;
    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const v = view.current;
        const r = root.current?.getBoundingClientRect();
        if (!v || !r) return;
        const corner = root.current?.querySelector('.arena-corner');
        const top = Math.max(
          16,
          (corner?.getBoundingClientRect().bottom ?? 0) - r.top + 14,
        );
        // The card is at most about this tall; the field below it may be
        // wider (the near walls beside the hand).
        const right = v.fieldRight(top + PEEK_HEIGHT);
        const room = r.width - right - 28;
        // A little larger where the forest is wide (1920 and up).
        const width = Math.min(room > 420 ? 312 : 280, room);
        const height = r.height - top - 16;
        if (width >= 196 && height >= 300)
          return setBand({
            left: Math.round(right + (room - width) / 2 + 14),
            top: Math.round(top),
            width: Math.round(width),
            height: Math.round(height),
          });
        // Looking across the field, it fills the width: the card lies on
        // its side in the meadow under the field, right of the hand.
        const tray = root.current
          ?.querySelector('.arena-dock')
          ?.getBoundingClientRect();
        const left = tray ? tray.right - r.left + 16 : r.width;
        // It starts no higher than the hand's top; a long card may rise a
        // little further, over the near wall's end (it sits at the band's
        // foot).
        const below =
          Math.min(
            v.fieldBottom(left) + 10,
            tray ? tray.top - r.top : r.height,
          ) - 80;
        const across = Math.min(440, r.width - left - 16);
        setBand(
          across >= 300 && r.height - below - 14 >= 260
            ? {
                left: Math.round(left + (r.width - left - 16 - across) / 2),
                top: Math.round(below),
                width: Math.round(across),
                height: Math.round(r.height - below - 14),
                wide: true,
              }
            : null,
        );
      });
    };
    fit();
    const el = root.current;
    const observer = new ResizeObserver(fit);
    if (el) observer.observe(el);
    // The camera settles a moment after the view is built.
    const again = window.setTimeout(fit, 400);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearTimeout(again);
    };
  }, [enabled, root, view]);

  useEffect(() => {
    const el = root.current;
    if (!enabled || !band || !el) {
      shownKey.current = '';
      return;
    }
    const pointer = { x: 0, y: 0, in: false, held: false };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.in = true;
      pointer.held = e.buttons !== 0;
    };
    const onLeave = () => {
      pointer.in = false;
    };
    const show = (next: Peek | null) => {
      const key = next?.key ?? '';
      if (key === shownKey.current) return;
      shownKey.current = key;
      setPeek(next);
    };
    const pick = () => {
      if (!pointer.in || pointer.held || el.classList.contains('dragging'))
        return show(null);
      const at = document.elementFromPoint(pointer.x, pointer.y);
      const m = session.match;
      const you = session.you;
      const seat = m.players[you];
      // A card in the hand, or the next one.
      const slots = hand.current ?? [];
      for (let i = 0; i < slots.length; i++) {
        const card = slots[i];
        if (card && at && card.contains(at) && seat.hand.cards[i])
          return show({
            id: seat.hand.cards[i],
            seat: you,
            key: `hand-${seat.hand.cards[i]}`,
          });
      }
      if (at?.closest('.arena-next') && seat.hand.queue[0])
        return show({
          id: seat.hand.queue[0],
          seat: you,
          key: `hand-${seat.hand.queue[0]}`,
        });
      const c = canvas.current;
      const v = view.current;
      if (!c || !v || at !== c) return show(null);
      const r = c.getBoundingClientRect();
      const u = v.troopAt(m, pointer.x - r.left, pointer.y - r.top);
      show(u ? { id: u.card, seat: u.owner, key: `unit-${u.id}` } : null);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onMove);
    el.addEventListener('pointerup', onMove);
    el.addEventListener('pointerleave', onLeave);
    const timer = window.setInterval(pick, 100);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onMove);
      el.removeEventListener('pointerup', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.clearInterval(timer);
    };
  }, [enabled, band, root, canvas, view, session, hand]);

  if (!peek || !band) return null;
  const owner = session.match.players[peek.seat];
  const team = owner && owner.side !== session.side ? 1 : 0;
  return (
    <div
      className={`arena-peek${band.wide ? ' wide' : ''}`}
      aria-hidden="true"
      style={
        {
          left: band.left,
          top: band.top,
          width: band.width,
          maxHeight: band.height,
          // On its side the card sits at the band's foot.
          height: band.wide ? band.height : undefined,
        } as CSSProperties
      }
    >
      <CardPanel
        key={peek.key}
        id={peek.id}
        boost={owner?.boost}
        art={art}
        team={team}
      />
    </div>
  );
}
