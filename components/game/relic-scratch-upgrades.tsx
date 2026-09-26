'use client';
import { useState } from 'react';
import {
  ArrowRight,
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
  ShieldCheck,
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

const ICONS: Record<string, LucideIcon> = {
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
  insurance: ShieldCheck,
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
  insurance: 'A ticket that pays less than it cost gives some of it back.',
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
/** Where a node sits in its path column: books pair up two to a row. */
function place(u: Upgrade): [number, number] {
  if (u.path !== 'books') return u.at;
  const book = u.at[1];
  return [(book % 2) * 2 + u.at[0], Math.floor(book / 2)];
}
const WIDTHS: Record<PathId, number> = {
  scratch: 2,
  luck: 2,
  payout: 2,
  shop: 2,
  books: 4,
  factory: 2,
};
function Medallion({
  node,
  coins,
  selected,
  onSelect,
  onBuy,
}: {
  node: Node;
  coins: number;
  selected: boolean;
  onSelect: () => void;
  onBuy: () => void;
}) {
  const { u, rank, ready, hidden, max, price } = node;
  const Icon = ICONS[u.id];
  const book = u.book && u.id.endsWith('-prize') ? (u.book as PackId) : null;
  const affordable = ready && !max && coins >= price;
  return (
    <button
      className={`rs-node ${ready ? '' : 'is-locked'} ${hidden ? 'is-hidden' : ''} ${max ? 'is-max' : ''} ${affordable ? 'is-affordable' : ''} ${rank ? 'is-owned' : ''}`}
      data-game-motion="change"
      data-game-motion-key={`${rank}:${ready}:${hidden}`}
      aria-pressed={selected}
      aria-label={
        hidden
          ? 'Undiscovered upgrade'
          : `${u.name}, ${rank} of ${u.max}${max ? '' : `, ${formatNumber(price)} coins`}`
      }
      style={
        {
          '--rank': rank / u.max,
        } as React.CSSProperties
      }
      onClick={onSelect}
      onDoubleClick={() => affordable && onBuy()}
    >
      <span className="rs-node-disc">
        {hidden ? (
          <b className="rs-node-mystery">?</b>
        ) : book ? (
          <img src={TICKET_ART[book].small} alt="" draggable={false} />
        ) : Icon ? (
          <Icon size={22} />
        ) : null}
        {!ready && !hidden && <Lock size={12} className="rs-node-lock" />}
        {max && <Check size={12} className="rs-node-check" />}
      </span>
      {!hidden && (
        <span className="rs-node-pips" aria-hidden="true">
          {Array.from({ length: u.max }, (_, i) => (
            <i key={i} className={i < rank ? 'is-on' : ''} />
          ))}
        </span>
      )}
      <span className="rs-node-name">{hidden ? '' : u.name}</span>
      {!hidden && !max && (
        <small className="rs-node-price">
          <Coins size={9} />
          {formatNumber(price)}
        </small>
      )}
    </button>
  );
}
/** The upgrade tree: six paths side by side, each a little tree of
 * medallions. An upgrade opens once the one before it has a rank; the
 * selected one is explained and bought in the bar below. */
export function ScratchUpgrades({
  state,
  coins,
  busy,
  onBuy,
}: {
  state: ScratchState;
  coins: number;
  busy: boolean;
  onBuy: (id: string) => void;
}) {
  const [selected, setSelected] = useState('coin'),
    [path, setPath] = useState<PathId>('scratch');
  const u = upgradeFor(selected)!,
    node = nodeOf(state, u);
  const Icon = ICONS[u.id] ?? Ticket;
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
      <div className="rs-tree">
        {PATHS.map((p) => {
          const PathIcon = PATH_ICONS[p.id],
            list = UPGRADES.filter((x) => x.path === p.id),
            nodes = list.map((x) => nodeOf(state, x)),
            rows = Math.max(...list.map((x) => place(x)[1])) + 1,
            cols = WIDTHS[p.id];
          const bought = list.reduce((n, x) => n + level(state, x.id), 0),
            total = list.reduce((n, x) => n + x.max, 0);
          return (
            <section
              key={p.id}
              className={`rs-branch ${path === p.id ? 'is-current' : ''}`}
              data-game-motion="change"
              data-game-motion-key={path === p.id ? 'current' : 'other'}
              style={
                {
                  '--path': p.color,
                  '--cols': cols,
                  '--rows': rows,
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
              <div className="rs-branch-grid">
                <svg
                  className="rs-branch-links"
                  viewBox={`0 0 ${cols} ${rows}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {list.map((x) => {
                    const from = x.requires && upgradeFor(x.requires);
                    if (!from || from.path !== x.path) return null;
                    const [ax, ay] = place(from),
                      [bx, by] = place(x);
                    return (
                      <line
                        key={x.id}
                        className={level(state, from.id) ? 'is-lit' : ''}
                        x1={ax + 0.5}
                        y1={ay + 0.42}
                        x2={bx + 0.5}
                        y2={by + 0.42}
                      />
                    );
                  })}
                </svg>
                {nodes.map((n) => {
                  const [x, y] = place(n.u);
                  return (
                    <div
                      key={n.u.id}
                      className="rs-node-slot"
                      style={{
                        left: `${(x / cols) * 100}%`,
                        top: `${(y / rows) * 100}%`,
                        width: `${100 / cols}%`,
                        height: `${100 / rows}%`,
                      }}
                    >
                      <Medallion
                        node={n}
                        coins={coins}
                        selected={selected === n.u.id}
                        onSelect={() => {
                          setSelected(n.u.id);
                          setPath(p.id);
                        }}
                        onBuy={() => onBuy(n.u.id)}
                      />
                    </div>
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
        style={{ '--path': color } as React.CSSProperties}
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
}
