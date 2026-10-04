import { useSyncExternalStore } from 'react';
import { iconFor, iconVersion, subscribeIcons } from './icon-store';
import {
  RAIL,
  RIVER,
  ROAD,
  orient,
  pieces,
  type PieceId,
  type Route,
} from '@/lib/games/rota/pieces';

/**
 * Rota's pieces drawn in white ink, one 100 by 100 square each. Roads are a
 * cased lane with a dashed centre line, rails a pair of lines on sleepers,
 * rivers a pale channel with white banks. Bends are quarter circles, forks
 * and crossings meet in the middle, and stations are a small building where
 * road turns into rail. Overpasses and bridges lift one route over another.
 */
const MID: [number, number][] = [
  [50, 0],
  [100, 50],
  [50, 100],
  [0, 50],
];

/** The path from side `a` to side `b` of the square, or to the middle. */
function segment(a: number, b: number | null) {
  const [ax, ay] = MID[a];
  if (b === null) return `M${ax} ${ay}L50 50`;
  const [bx, by] = MID[b];
  if ((a + 2) % 4 === b) return `M${ax} ${ay}L${bx} ${by}`;
  const cx = ax === 50 ? bx : ax,
    cy = ay === 50 ? by : ay;
  const cross = (ax - cx) * (by - cy) - (ay - cy) * (bx - cx);
  return `M${ax} ${ay}A50 50 0 0 ${cross > 0 ? 1 : 0} ${bx} ${by}`;
}

/** Paths for one kind of route inside one link group. */
function paths(sides: number[], through: boolean) {
  if (sides.length === 2 && through) return [segment(sides[0], sides[1])];
  return sides.map((d) => segment(d, null));
}

type Stroke = { d: string; kind: Route };

function strokes(p: PieceId, o: number) {
  const t = orient(p, o);
  const lines: Stroke[] = [];
  for (const g of t.links) {
    const kinds = new Set(g.map((d) => t.edges[d]));
    for (const kind of kinds) {
      const sides = g.filter((d) => t.edges[d] === kind);
      // A single kind runs straight through or bends; a mix meets in the middle.
      for (const d of paths(sides, kinds.size === 1)) lines.push({ d, kind });
    }
  }
  return lines;
}

/** The route carried over the other on an overpass or a bridge. */
const upperOf = (p: PieceId): Route | null =>
  p === 'overpass' || p === 'road-bridge'
    ? ROAD
    : p === 'rail-bridge'
      ? RAIL
      : null;

function RoadLines({ d }: { d: string }) {
  return (
    <g className="rota-road">
      <path className="rota-road-case" d={d} />
      <path className="rota-road-fill" d={d} />
      <path className="rota-road-dash" d={d} />
    </g>
  );
}
function RailLines({ d }: { d: string }) {
  return (
    <g className="rota-rail">
      <path className="rota-rail-ties" d={d} />
      <path className="rota-rail-case" d={d} />
      <path className="rota-rail-gap" d={d} />
    </g>
  );
}
function RiverLines({ d }: { d: string }) {
  return (
    <g className="rota-river">
      <path className="rota-river-bank" d={d} />
      <path className="rota-river-water" d={d} />
      <path className="rota-river-flow" d={d} />
    </g>
  );
}

/** The drawing of a piece, in a 100 by 100 square at the origin. */
export function PieceArt({ p, o }: { p: PieceId; o: number }) {
  const lines = strokes(p, o);
  const upper = upperOf(p);
  const draw = (s: Stroke, i: number) =>
    s.kind === ROAD ? (
      <RoadLines key={i} d={s.d} />
    ) : s.kind === RAIL ? (
      <RailLines key={i} d={s.d} />
    ) : (
      <RiverLines key={i} d={s.d} />
    );
  const order = [RIVER, RAIL, ROAD] as Route[];
  const lower = lines.filter((s) => s.kind !== upper);
  const top = lines.filter((s) => s.kind === upper);
  return (
    <g className="rota-piece" data-piece={p}>
      {(upper
        ? lower
        : [...lines].sort(
            (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
          )
      ).map(draw)}
      {upper &&
        top.map((s, i) => (
          <g key={`b${i}`} className="rota-bridge">
            <path className="rota-bridge-rail" d={s.d} />
            <path className="rota-bridge-deck" d={s.d} />
          </g>
        ))}
      {top.map((s, i) => draw(s, 10 + i))}
      {pieces[p].station && (
        <g className="rota-station">
          <rect x="33" y="36" width="34" height="28" rx="4" />
          <path d="M39 46h22M39 54h22" />
        </g>
      )}
    </g>
  );
}

/** A piece on its own, for dice, specials and rules. */
export function PieceIcon({
  p,
  o = 0,
  className,
  label,
}: {
  p: PieceId;
  o?: number;
  className?: string;
  label?: string;
}) {
  useSyncExternalStore(subscribeIcons, iconVersion, () => 0);
  // The 3D tile once the board has rendered it; it shows the piece unturned.
  const picture = o === 0 ? iconFor(p) : undefined;
  if (picture)
    return (
      <img
        className={`rota-piece-icon rota-piece-picture ${className ?? ''}`}
        src={picture}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        draggable={false}
      />
    );
  return (
    <svg
      className={`rota-piece-icon ${className ?? ''}`}
      viewBox="-4 -4 108 108"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect
        className="rota-piece-ground"
        x="-4"
        y="-4"
        width="108"
        height="108"
        rx="10"
      />
      <clipPath id={`clip-${p}-${o}`}>
        <rect x="0" y="0" width="100" height="100" />
      </clipPath>
      <g clipPath={`url(#clip-${p}-${o})`}>
        <PieceArt p={p} o={o} />
      </g>
    </svg>
  );
}
