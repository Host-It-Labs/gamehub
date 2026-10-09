'use client';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BadgePercent,
  BookOpen,
  Bot,
  Check,
  Clock,
  Clover,
  Coins,
  Crown,
  Factory,
  Flame,
  Gem,
  Gift,
  Grid3x3,
  Hand,
  Handshake,
  Heart,
  HeartPulse,
  LifeBuoy,
  Link2,
  Lock,
  Map as MapIcon,
  Maximize,
  Medal,
  Printer,
  Radar,
  Scroll,
  CreditCard,
  Sparkles,
  Star,
  Store,
  Sun,
  Thermometer,
  Ticket,
  TrendingUp,
  Trophy,
  Wand,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber } from '@/lib/games/relic/engine';
import {
  PATHS,
  UPGRADES,
  level,
  packFor,
  upgradeCost,
  upgradeFor,
  upgradeReady,
  type PackId,
  type PathId,
  type ScratchState,
  type Upgrade,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from './relic-scratch-art';

export const UPGRADE_ICONS: Record<string, LucideIcon> = {
  coin: Maximize,
  foil: Wand,
  quick: Zap,
  extra: Heart,
  star: Star,
  goldseal: Medal,
  starpower: Sparkles,
  streak: Flame,
  value: Coins,
  jackpot: Gem,
  hearts: HeartPulse,
  golden: Crown,
  mastery: Trophy,
  collector: BookOpen,
  discount: BadgePercent,
  loyalty: CreditCard,
  freebie: Gift,
  early: Clock,
  'seven-help': Thermometer,
  'twins-help': Link2,
  'path-help': MapIcon,
  'ladder-help': LifeBuoy,
  'mine-help': Radar,
  'sunmoon-help': Sun,
  'chart-help': Waves,
  'crown-help': Scroll,
  printers: Printer,
  bots: Bot,
  sales: Handshake,
  cashiers: TrendingUp,
  wholesale: Store,
  floor: Grid3x3,
};
/** Each path's deep enamel: the solid colour of its medallions. */
const RICH: Record<PathId, string> = {
  scratch: '#16878b',
  luck: '#c98a12',
  payout: '#c0502f',
  shop: '#8d47b0',
  books: '#3069bd',
  factory: '#46852f',
};
const PATH_ICONS: Record<PathId, LucideIcon> = {
  scratch: Hand,
  luck: Clover,
  payout: Coins,
  shop: Ticket,
  books: BookOpen,
  factory: Factory,
};
/** One sentence each, shown only for the selected upgrade. */
const DOES: Record<string, string> = {
  coin: 'A much wider coin: each stroke clears far more foil.',
  foil: 'Seals pop open with far less foil scratched away.',
  quick: 'A ticket finished within a few seconds per seal pays extra.',
  extra: 'Every ticket forgives one more mistake.',
  star: 'Star tickets pay several times over. Factory tickets too.',
  goldseal: 'One seal on a ticket may be golden and pay ten times its prize.',
  starpower: 'Star tickets pay even more.',
  streak: 'Every perfect ticket in a row adds this much, up to ten.',
  value:
    'Doubles every prize. Tickets cost twice as much and win twice as much.',
  jackpot: 'A perfect ticket pays this many times over.',
  hearts: 'Every heart still left when a ticket ends adds to its prize.',
  golden: 'Doubles everything the desk wins, tickets and factory.',
  mastery: 'Harder levels pay far more.',
  collector: 'Every book on the shelf adds to every prize.',
  discount: 'Every ticket costs less.',
  loyalty: 'One ticket in every few you buy is free, whatever the book.',
  freebie: 'Some tickets are free.',
  early: 'Harder levels open after fewer tickets.',
  'seven-help': 'Misses also show how far the nearest 7 is.',
  'twins-help': 'Tickets come with pairs already matched.',
  'path-help': 'Tickets print more numbers along the path.',
  'ladder-help': 'Wrong guesses are forgiven, once per rank on each ticket.',
  'mine-help': 'Dynamite is marked on the foil and cannot be scratched.',
  'sunmoon-help': 'Tickets print more suns and moons.',
  'chart-help': 'Ship parts are shown on every ticket.',
  'crown-help': 'A crown is shown on every ticket.',
  printers: 'Every printer prints half as fast again.',
  bots: 'Every scratch bot scratches half as fast again.',
  sales: 'Every ticket the factory sells pays more.',
  cashiers: 'Scratch bots play their tickets better and hit more jackpots.',
  wholesale: 'Every machine costs less.',
  floor: 'More room on the factory floor.',
};
function does(u: Upgrade) {
  if (u.book && u.id.endsWith('-prize'))
    return `Every ${packFor(u.book).name} prize, by hand or in the factory.`;
  return DOES[u.id];
}
type Node = {
  u: Upgrade;
  rank: number;
  ready: boolean;
  /** Two steps from anything bought: shown only as a silhouette. */
  hidden: boolean;
  max: boolean;
  price: number;
};
function nodeOf(state: ScratchState, u: Upgrade): Node {
  const rank = level(state, u.id),
    ready = upgradeReady(state, u),
    parent = u.requires ? upgradeFor(u.requires) : undefined;
  const hidden =
    (!!u.book && !upgradeReady(state, { ...u, requires: undefined })) ||
    (!!parent &&
      !ready &&
      !!parent.requires &&
      level(state, parent.requires) === 0);
  return {
    u,
    rank,
    ready,
    hidden,
    max: rank >= u.max,
    price: upgradeCost(state, u),
  };
}
/** Tiles are listed in tree order; Books pair each book's prize with its
 * helper, one book to a row. */
const order = (a: Upgrade, b: Upgrade) =>
  a.at[1] - b.at[1] || a.at[0] - b.at[0];
const COLUMNS: Record<PathId, number> = {
  scratch: 1,
  luck: 1,
  payout: 1,
  shop: 1,
  books: 2,
  factory: 1,
};
/** One upgrade: an enamel icon, its name, a bar of ranks and the price. */
const Tile = memo(function Tile({
  node,
  affordable,
  selected,
  onSelect,
  onBuy,
}: {
  node: Node;
  affordable: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onBuy: (id: string) => void;
}) {
  const { u, rank, ready, hidden, max, price } = node;
  const Icon = UPGRADE_ICONS[u.id];
  const book = u.book && u.id.endsWith('-prize') ? (u.book as PackId) : null;
  // A bare number or switch needs its label to mean anything.
  const value = u.show(rank);
  return (
    <button
      className={`rs-tile ${ready ? '' : 'is-locked'} ${hidden ? 'is-hidden' : ''} ${max ? 'is-max' : ''} ${affordable ? 'is-affordable' : ''} ${rank ? 'is-owned' : ''}`}
      aria-pressed={selected}
      aria-label={
        hidden
          ? 'Undiscovered upgrade'
          : `${u.name}, ${rank} of ${u.max}${max ? '' : `, ${formatNumber(price)} coins`}${affordable ? ', can buy' : ''}`
      }
      onClick={() => onSelect(u.id)}
      onDoubleClick={() => affordable && onBuy(u.id)}
    >
      <span className={`rs-tile-icon ${book ? 'is-book' : ''}`}>
        {hidden ? (
          <b>?</b>
        ) : book ? (
          <img src={TICKET_ART[book].small} alt="" draggable={false} />
        ) : Icon ? (
          <Icon size={19} />
        ) : null}
        {affordable && (
          <span className="rs-tile-ready" aria-hidden="true">
            <ArrowUp size={10} strokeWidth={3.2} />
          </span>
        )}
      </span>
      {!hidden && (
        <span className="rs-tile-text">
          <b className="rs-tile-name">{u.name}</b>
          <span className="rs-tile-value">
            {value}
            {/^(\d+|on|off)$/.test(value) && <small> {u.label}</small>}
          </span>
          <span className="rs-tile-meta">
            <span className="rs-tile-ranks" aria-hidden="true">
              {Array.from({ length: u.max }, (_, i) => (
                <i key={i} className={i < rank ? 'is-on' : ''} />
              ))}
            </span>
            {max ? (
              <Check size={13} className="rs-tile-check" />
            ) : (
              <small className="rs-tile-price">
                {ready ? <Coins size={10} /> : <Lock size={10} />}
                {formatNumber(price)}
              </small>
            )}
          </span>
        </span>
      )}
    </button>
  );
});
/** The upgrades: six paths side by side, each a column of tiles in tree
 * order. An upgrade opens once the one before it has a rank; the selected
 * one is explained and bought in the bar below. */
export const ScratchUpgrades = memo(function ScratchUpgrades({
  state,
  coins,
  busy,
  onBuy,
  mirror,
  onView,
}: {
  state: ScratchState;
  coins: number;
  busy: boolean;
  onBuy: (id: string) => void;
  /** The Watch TV: another player's selected upgrade and path. */
  mirror?: { upgrade?: string; path?: string };
  onView?: (view: { upgrade: string; path: string }) => void;
}) {
  const [ownSelected, setSelected] = useState('coin'),
    [ownPath, setPath] = useState<PathId>('scratch');
  const selected =
      mirror?.upgrade && upgradeFor(mirror.upgrade)
        ? mirror.upgrade
        : ownSelected,
    path = (PATHS.find((p) => p.id === mirror?.path)?.id ?? ownPath) as PathId;
  useEffect(() => {
    if (!mirror) onView?.({ upgrade: ownSelected, path: ownPath });
  }, [mirror, onView, ownSelected, ownPath]);
  const [select] = useState(() => (id: string) => {
    setSelected(id);
    setPath(upgradeFor(id)!.path);
  });
  // One node per upgrade, rebuilt only when the desk changes, so choosing an
  // upgrade redraws two medallions rather than forty.
  const nodes = useMemo(
    () => new Map(UPGRADES.map((x) => [x.id, nodeOf(state, x)])),
    [state],
  );
  const u = upgradeFor(selected)!,
    node = nodes.get(u.id)!;
  const Icon = UPGRADE_ICONS[u.id] ?? Ticket;
  const color = PATHS.find((p) => p.id === u.path)!.color;
  return (
    <div className="rs-upgrades">
      <div className="rs-path-tabs" role="tablist" aria-label="Upgrade paths">
        {PATHS.map((p) => {
          const PathIcon = PATH_ICONS[p.id];
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={path === p.id}
              aria-label={p.name}
              style={{ '--path': p.color } as React.CSSProperties}
              onClick={() => {
                setPath(p.id);
                setSelected(UPGRADES.find((x) => x.path === p.id)!.id);
              }}
            >
              <PathIcon size={15} />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className="rs-tree" data-rs-area="tree">
        {PATHS.map((p) => {
          const PathIcon = PATH_ICONS[p.id],
            list = UPGRADES.filter((x) => x.path === p.id).sort(order),
            cols = COLUMNS[p.id];
          const bought = list.reduce((n, x) => n + level(state, x.id), 0),
            total = list.reduce((n, x) => n + x.max, 0);
          return (
            <section
              key={p.id}
              className={`rs-branch is-${p.id} ${path === p.id ? 'is-current' : ''}`}
              style={
                {
                  '--path': p.color,
                  '--rich': RICH[p.id],
                  '--cols': cols,
                  '--rows': Math.ceil(list.length / cols),
                  '--done': bought / total,
                } as React.CSSProperties
              }
              aria-label={p.name}
            >
              <h3 className="rs-branch-name">
                <PathIcon size={16} />
                <span>{p.name}</span>
                <small>
                  {bought}/{total}
                </small>
              </h3>
              <div className="rs-branch-list">
                {list.map((x) => {
                  const n = nodes.get(x.id)!;
                  return (
                    <Tile
                      key={x.id}
                      node={n}
                      affordable={
                        n.ready && !n.max && !n.hidden && coins >= n.price
                      }
                      selected={selected === x.id}
                      onSelect={select}
                      onBuy={onBuy}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div
        className="rs-buy-bar"
        data-game-motion="change"
        data-game-motion-key={selected}
        style={
          { '--path': color, '--rich': RICH[u.path] } as React.CSSProperties
        }
        aria-live="polite"
      >
        <span className="rs-card-icon">
          {node.hidden ? <b>?</b> : <Icon size={20} />}
        </span>
        <div className="rs-buy-text">
          <b>
            {node.hidden ? 'Undiscovered' : u.name}{' '}
            {!node.hidden && (
              <small>
                {node.rank} / {u.max}
              </small>
            )}
          </b>
          <small>
            {node.hidden
              ? 'Buy the upgrades before it to find out.'
              : !node.ready && u.book && !state.unlocked.includes(u.book)
                ? `Put ${packFor(u.book).name} on the shelf first.`
                : !node.ready && u.requires
                  ? `First buy ${upgradeFor(u.requires)?.name}.`
                  : !node.ready
                    ? 'Build the factory first.'
                    : does(u)}
          </small>
        </div>
        {!node.hidden && (
          <span className="rs-buy-stat">
            {u.label} <b>{u.show(node.rank)}</b>
            {!node.max && (
              <>
                <ArrowRight size={13} />
                <b>{u.show(node.rank + 1)}</b>
              </>
            )}
          </span>
        )}
        <button
          className="rs-primary"
          disabled={busy || !node.ready || node.max || coins < node.price}
          onClick={() => onBuy(u.id)}
        >
          {node.max ? (
            <>
              <Check size={17} /> Maxed
            </>
          ) : (
            <>
              Buy <Coins size={15} />
              {node.hidden ? '?' : formatNumber(node.price)}
            </>
          )}
        </button>
      </div>
    </div>
  );
});
