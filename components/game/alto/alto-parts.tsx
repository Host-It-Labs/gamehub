'use client';
import type { CSSProperties } from 'react';
import { Orbit, Package, Rocket, Star, Trophy } from 'lucide-react';
import {
  goods,
  planById,
  type Effect,
  type Family,
  type Good,
  type Goods,
  type Plan,
} from '@/lib/games/alto/content';
import { goodArt, planArt, seatColours } from '@/lib/games/alto/art';
import { discounted, payment } from '@/lib/games/alto/engine';
import { effectRule, familyLabel } from '@/lib/games/alto/text';

/** One kind of cargo's token, painted; its name is read out. */
export function GoodIcon({
  good,
  size = 22,
  className = '',
}: {
  good: Good;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={`alto-good ${className}`}
      src={goodArt(good)}
      alt={goods[good]}
      width={size}
      height={size}
      draggable={false}
    />
  );
}

/** A cost or a stock as token chips: an icon and a count for every kind present. */
export function GoodsRow({
  amounts,
  size = 18,
  className = '',
  all = false,
  delta,
}: {
  amounts: Goods;
  size?: number;
  className?: string;
  /** Show every kind, zeros included (a player's stock). */
  all?: boolean;
  /** What a prepared build would take, shown beside each count. */
  delta?: Goods | null;
}) {
  const label = amounts
    .map((n, k) => (n || all ? `${n} ${goods[k].toLowerCase()}` : ''))
    .filter(Boolean)
    .join(', ');
  return (
    <span className={`alto-goods ${className}`} aria-label={label || 'Nothing'}>
      {amounts.map((n, k) =>
        n || all ? (
          <span
            key={k}
            className="alto-goods-chip"
            data-good={k}
            data-empty={n === 0 || undefined}
          >
            <GoodIcon good={k as Good} size={size} />
            <b data-game-motion="change" data-game-motion-key={n}>
              {n}
            </b>
            {delta && delta[k] > 0 && (
              <i className="alto-goods-delta">−{delta[k]}</i>
            )}
          </span>
        ) : null,
      )}
    </span>
  );
}

/** A cost measured against a hold, one cargo icon per unit: bright for cargo
 *  you have, ringed gold where two of your others stand in for it, an empty
 *  red socket where you are short, and faint where a discount takes it. */
export function CostRow({
  cost,
  stock,
  off = 0,
  size = 20,
  className = '',
}: {
  cost: Goods;
  stock: Goods;
  off?: number;
  size?: number;
  className?: string;
}) {
  const need = discounted(cost, stock, off);
  const payable = !!payment(cost, stock, off);
  const missing: string[] = [];
  const kinds = cost.map((n, k) => {
    if (!n) return null;
    const have = Math.min(stock[k], need[k]);
    const short = need[k] - have;
    if (short && !payable) missing.push(`${short} ${goods[k].toLowerCase()}`);
    const units = [
      ...Array<string>(have).fill('have'),
      ...Array<string>(short).fill(payable ? 'swap' : 'missing'),
      ...Array<string>(n - need[k]).fill('free'),
    ];
    return (
      <span key={k} className="alto-cost-kind" data-good={k}>
        {units.map((state, i) => (
          <span key={i} className="alto-cost-unit" data-unit={state}>
            <GoodIcon good={k as Good} size={size} />
          </span>
        ))}
      </span>
    );
  });
  const label = cost
    .map((n, k) => (n ? `${n} ${goods[k].toLowerCase()}` : ''))
    .filter(Boolean)
    .join(', ');
  return (
    <span
      className={`alto-cost ${className}`}
      data-short={!payable || undefined}
      style={{ '--units': cost.reduce((a, n) => a + n, 0) } as CSSProperties}
    >
      <span className="sr-only">
        {`Costs ${label}${missing.length ? `; you need ${missing.join(' and ')} more` : ''}`}
      </span>
      <span className="alto-cost-units" aria-hidden="true">
        {kinds}
      </span>
    </span>
  );
}

/** Where an upgrade goes: a rocket for the ship, an orbital station for the base. */
export function FamilyIcon({
  family,
  size = 14,
}: {
  family: Family;
  size?: number;
}) {
  const Icon = family === 'ship' ? Rocket : Orbit;
  return <Icon size={size} aria-hidden="true" />;
}

/** The family mark on a shop item: the icon on a disc in the family's colour. */
export function FamilyMark({ family }: { family: Family }) {
  return (
    <span
      className="alto-family"
      data-family={family}
      title={familyLabel(family)}
    >
      <FamilyIcon family={family} size={12} />
    </span>
  );
}

/** One effect as a small picture: what it loads, what it scores. Its full
 *  sentence is the label. */
function EffectBadge({ e, next }: { e: Effect; next?: number }) {
  const points =
    e.type === 'points' ||
    e.type === 'race' ||
    e.type === 'per' ||
    e.type === 'perHold' ||
    e.type === 'sets' ||
    e.type === 'thrift';
  let body: React.ReactNode;
  switch (e.type) {
    case 'hold':
      body = (
        <>
          <Package aria-hidden="true" />+{e.amount}
        </>
      );
      break;
    case 'yield':
      body = (
        <>
          <GoodIcon good={e.good} size={16} />+{e.amount}
        </>
      );
      break;
    case 'alone':
      body = <>Alone +{e.amount}</>;
      break;
    case 'share':
      body = <>Shared +{e.amount}</>;
      break;
    case 'discount':
      body = e.family ? (
        <>
          <FamilyIcon family={e.family} size={12} />−{e.amount}
        </>
      ) : (
        <>All −{e.amount}</>
      );
      break;
    case 'points':
      body = (
        <>
          <Star aria-hidden="true" />
          {e.points}
        </>
      );
      break;
    case 'race':
      body = (
        <>
          <Trophy aria-hidden="true" />
          {next ?? e.ladder[0]}
        </>
      );
      break;
    case 'per':
      body = (
        <>
          <Star aria-hidden="true" />
          {e.points}
          <i>/</i>
          {e.family ? <FamilyIcon family={e.family} size={12} /> : 'each'}
        </>
      );
      break;
    case 'perHold':
      body = (
        <>
          <Star aria-hidden="true" />
          {e.points}
          <i>/</i>
          <Package aria-hidden="true" />
        </>
      );
      break;
    case 'thrift':
      body = (
        <>
          <Star aria-hidden="true" />1<i>/</i>
          {e.per} left
        </>
      );
      break;
    case 'sets':
      body = (
        <>
          <Star aria-hidden="true" />
          {e.points}
          <i>/</i>
          <span className="alto-effect-set">
            {([0, 1, 2, 3] as Good[]).map((k) => (
              <GoodIcon key={k} good={k} size={11} />
            ))}
          </span>
        </>
      );
      break;
  }
  return (
    <span
      className={`alto-effect ${points ? 'is-points' : 'is-ability'}`}
      data-effect={e.type}
      title={effectRule(e)}
    >
      {body}
    </span>
  );
}

/** An upgrade's effects as small pictures: points gold, abilities blue. */
export function EffectLine({ plan, next }: { plan: Plan; next?: number }) {
  return (
    <span className="alto-effects">
      {plan.effects.map((e, i) => (
        <EffectBadge key={i} e={e} next={next} />
      ))}
    </span>
  );
}

/** An upgrade's picture: the still of its 3D object. */
export function PlanMark({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <img
      className="alto-mark"
      src={planArt(id) ?? undefined}
      alt=""
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}

/** The face of a shop item; the button around it belongs to the caller. */
export function PlanFace({
  id,
  next,
  compact = false,
  stock,
  off = 0,
  hideCost = false,
}: {
  id: string;
  next?: number;
  compact?: boolean;
  /** The viewer's hold, to measure the cost against. */
  stock?: Goods;
  off?: number;
  hideCost?: boolean;
}) {
  const plan = planById[id];
  return (
    <>
      <span className="alto-item-art" data-model={id}>
        <PlanMark id={id} size={96} />
      </span>
      <FamilyMark family={plan.family} />
      <span className="alto-item-body">
        {!compact && <b className="alto-item-name">{plan.name}</b>}
        <EffectLine plan={plan} next={next} />
        {hideCost ? (
          <span className="alto-item-cost alto-cost-space" aria-hidden="true" />
        ) : stock ? (
          <CostRow
            cost={plan.cost}
            stock={stock}
            off={off}
            size={20}
            className="alto-item-cost"
          />
        ) : (
          <GoodsRow amounts={plan.cost} size={15} className="alto-item-cost" />
        )}
      </span>
    </>
  );
}

/** The match's length at a glance: three years, each a bar that fills turn
 *  by turn. */
export function YearTrack({
  year,
  turn,
  turns,
  over = false,
}: {
  year: number;
  turn: number;
  turns: number;
  over?: boolean;
}) {
  return (
    <span className="alto-years" aria-hidden="true">
      {[1, 2, 3].map((y) => (
        <span
          key={y}
          className="alto-year"
          data-state={over || y < year ? 'done' : y === year ? 'now' : 'later'}
        >
          {Array.from({ length: turns }, (_, t) => (
            <i
              key={t}
              data-on={
                over || y < year || (y === year && t < turn) || undefined
              }
            />
          ))}
        </span>
      ))}
    </span>
  );
}

/** A player's ship, drawn flat: a little cream rocket with the seat's stripe. */
export function ShipIcon({
  seat,
  size = 30,
  className = '',
}: {
  seat: number;
  size?: number;
  className?: string;
}) {
  const c = seatColours[seat % seatColours.length];
  return (
    <svg
      className={`alto-ship ${className}`}
      width={size}
      height={size * 0.6}
      viewBox="0 0 50 30"
      aria-hidden="true"
    >
      <path
        d="M7 15 C 4 13, 2 11, 0 11 C 1 13, 1 17, 0 19 C 2 19, 4 17, 7 15 Z"
        fill="#ffb347"
        opacity="0.9"
      />
      <path
        d="M12 5 L 6 0 L 4 1 L 8 9 Z M12 25 L 6 30 L 4 29 L 8 21 Z"
        fill={c}
      />
      <path
        d="M8 9 C 14 5, 30 4, 40 8 C 46 10, 50 13, 50 15 C 50 17, 46 20, 40 22 C 30 26, 14 25, 8 21 C 6 18, 6 12, 8 9 Z"
        fill="#f3eadb"
      />
      <path
        d="M19 6.2 C 22 5.6, 25 5.4, 27 5.4 L 27 24.6 C 25 24.6, 22 24.4, 19 23.8 Z"
        fill={c}
      />
      <path
        d="M44 9.6 C 47 11, 50 13, 50 15 C 50 17, 47 19, 44 20.4 C 45 17, 45 13, 44 9.6 Z"
        fill={c}
      />
      <ellipse
        cx="35"
        cy="12.5"
        rx="5"
        ry="3.6"
        fill="#1d3557"
        stroke="#f3eadb"
        strokeWidth="1.2"
      />
      <ellipse cx="34" cy="11.6" rx="2" ry="1" fill="#ffcf80" opacity="0.7" />
    </svg>
  );
}

export const seatStyle = (seat: number) =>
  ({ '--seat': seatColours[seat % seatColours.length] }) as CSSProperties;
