'use client';
import {
  useId,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { RotateCw } from 'lucide-react';
import type { MapDef } from '@/lib/games/rota/maps';
import type { Placed } from '@/lib/games/rota/board';
import { ROAD, pieces, type PieceId } from '@/lib/games/rota/pieces';
import { PieceArt } from './route-art';

/**
 * A survey sheet: the grid, its exits, sea, peaks, towns and rubble, the
 * pieces drawn so far and, when it is yours, the squares you may build on.
 * The drawing is one SVG; the squares you tap are real buttons laid over it.
 */
export const MARGIN = 44;
const DX = [0, 1, 0, -1],
  DY = [-1, 0, 1, 0];

export const cellName = (map: MapDef, cell: number) =>
  `${String.fromCharCode(65 + (cell % map.size))}${Math.floor(cell / map.size) + 1}`;

export type SheetProps = {
  map: MapDef;
  cells: (Placed | null)[];
  rubble: number[];
  towns: number[];
  /** Rockfall's target this round. */
  strike?: number;
  loose?: { cell: number; dir: number }[];
  /** The round in play: its pieces are drawn fresh. */
  round?: number;
  /** Squares the chosen piece may go on. */
  targets?: Set<number>;
  /** The last piece down this round, which a tap turns. */
  turnable?: number;
  onCell?: (cell: number) => void;
  onPointerCell?: (cell: number | null) => void;
  /** The piece being dragged, drawn where it would land. */
  ghost?: { cell: number; p: PieceId; o: number } | null;
  className?: string;
  label: string;
  style?: CSSProperties;
};

function Exits({ map }: { map: MapDef }) {
  return (
    <g className="rota-exits">
      {map.exits.map((e, i) => {
        const x = (e.cell % map.size) * 100 + 50 + DX[e.dir] * 50,
          y = Math.floor(e.cell / map.size) * 100 + 50 + DY[e.dir] * 50;
        const len = e.pier ? 46 : MARGIN - 8;
        const x2 = x + DX[e.dir] * len,
          y2 = y + DY[e.dir] * len;
        const d = `M${x} ${y}L${x2} ${y2}`;
        // An arrowhead at the far end, pointing off the sheet.
        const ax = x2 + DX[e.dir] * 7,
          ay = y2 + DY[e.dir] * 7;
        const px = DY[e.dir] * 9,
          py = DX[e.dir] * 9;
        return (
          <g
            key={i}
            className={`rota-exit ${e.route === ROAD ? 'road' : 'rail'}`}
            data-pier={e.pier || undefined}
          >
            {e.route === ROAD ? (
              <g className="rota-road">
                <path className="rota-road-case" d={d} />
                <path className="rota-road-fill" d={d} />
                <path className="rota-road-dash" d={d} />
              </g>
            ) : (
              <g className="rota-rail">
                <path className="rota-rail-ties" d={d} />
                <path className="rota-rail-case" d={d} />
                <path className="rota-rail-gap" d={d} />
              </g>
            )}
            <path
              className="rota-exit-arrow"
              d={`M${x2 + px} ${y2 + py}L${ax} ${ay}L${x2 - px} ${y2 - py}`}
            />
          </g>
        );
      })}
    </g>
  );
}

function Terrain({
  map,
  towns,
  rubble,
}: {
  map: MapDef;
  towns: number[];
  rubble: number[];
}) {
  const at = (cell: number) => [
    (cell % map.size) * 100,
    Math.floor(cell / map.size) * 100,
  ];
  return (
    <g className="rota-terrain">
      {map.centre.map((c) => {
        const [x, y] = at(c);
        return (
          <rect
            key={`c${c}`}
            className="rota-centre"
            x={x + 7}
            y={y + 7}
            width="86"
            height="86"
            rx="6"
          />
        );
      })}
      {map.sea.map((c) => {
        const [x, y] = at(c);
        return (
          <g
            key={`s${c}`}
            className="rota-sea"
            transform={`translate(${x} ${y})`}
          >
            <rect width="100" height="100" />
            <path d="M14 30q9-8 18 0t18 0 18 0M30 56q9-8 18 0t18 0 18 0M10 80q9-8 18 0t18 0 18 0" />
          </g>
        );
      })}
      {map.peaks.map((c) => {
        const [x, y] = at(c);
        return (
          <g
            key={`p${c}`}
            className="rota-peak"
            transform={`translate(${x} ${y})`}
          >
            <path d="M10 82L38 30L52 52L64 36L90 82Z" />
            <path
              className="rota-peak-snow"
              d="M32 42L38 30L44 41M60 42L64 36L69 43"
            />
          </g>
        );
      })}
      {towns.map((c) => {
        const [x, y] = at(c);
        return (
          <g
            key={`t${c}`}
            className="rota-town"
            transform={`translate(${x} ${y})`}
          >
            <path d="M8 30V18L16 11L24 18V30ZM76 30V18L84 11L92 18V30ZM8 92V80L16 73L24 80V92ZM76 92V80L84 73L92 80V92Z" />
          </g>
        );
      })}
      {rubble.map((c) => {
        const [x, y] = at(c);
        return (
          <g
            key={`r${c}`}
            className="rota-rubble"
            transform={`translate(${x} ${y})`}
          >
            <rect width="100" height="100" />
            <path d="M18 70l14-22 16 8 10-18 22 12-6 30-44 4z" />
            <path
              className="rota-rubble-hatch"
              d="M10 20l20-10M44 16l24-8M70 30l20-12M8 44l10-6"
            />
          </g>
        );
      })}
    </g>
  );
}

export function Sheet({
  map,
  cells,
  rubble,
  towns,
  strike = -1,
  loose = [],
  round,
  targets,
  turnable,
  onCell,
  onPointerCell,
  ghost,
  className,
  label,
  style,
}: SheetProps) {
  const clip = `rota-clip-${useId().replace(/:/g, '')}`;
  const n = map.size;
  const span = n * 100 + MARGIN * 2;
  const inset = `${(MARGIN / span) * 100}%`;
  const interactive = !!onCell;
  const blocked = new Set([...map.sea, ...rubble]);
  return (
    <div
      className={`rota-sheet ${className ?? ''}`}
      style={
        { '--rota-inset': inset, '--rota-n': n, ...style } as CSSProperties
      }
      data-interactive={interactive || undefined}
      data-targeting={targets ? '' : undefined}
    >
      <svg viewBox={`${-MARGIN} ${-MARGIN} ${span} ${span}`} aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <rect x="0" y="0" width="100" height="100" />
          </clipPath>
        </defs>
        <rect
          className="rota-paper"
          x={-MARGIN + 6}
          y={-MARGIN + 6}
          width={span - 12}
          height={span - 12}
          rx="18"
        />
        <rect
          className="rota-border"
          x={-MARGIN + 16}
          y={-MARGIN + 16}
          width={span - 32}
          height={span - 32}
          rx="10"
        />
        <rect
          className="rota-grid-ground"
          x="0"
          y="0"
          width={n * 100}
          height={n * 100}
        />
        <Terrain map={map} towns={towns} rubble={rubble} />
        <g className="rota-grid">
          {Array.from({ length: n + 1 }, (_, i) => (
            <path key={`v${i}`} d={`M${i * 100} 0V${n * 100}`} />
          ))}
          {Array.from({ length: n + 1 }, (_, i) => (
            <path key={`h${i}`} d={`M0 ${i * 100}H${n * 100}`} />
          ))}
        </g>
        <Exits map={map} />
        {cells.map((c, cell) => {
          if (!c) return null;
          const x = (cell % n) * 100,
            y = Math.floor(cell / n) * 100;
          return (
            <g
              key={`${cell}:${c.p}:${c.o}`}
              className="rota-placed"
              data-fresh={c.r === round || undefined}
              data-town={towns.includes(cell) || undefined}
              data-tunnel={map.peaks.includes(cell) || undefined}
              transform={`translate(${x} ${y})`}
            >
              <g clipPath={`url(#${clip})`}>
                <PieceArt p={c.p} o={c.o} />
              </g>
              <text className="rota-round-mark" x="93" y="94">
                {c.r}
              </text>
            </g>
          );
        })}
        {ghost && (
          <g
            className="rota-placed rota-ghost"
            transform={`translate(${(ghost.cell % n) * 100} ${Math.floor(ghost.cell / n) * 100})`}
          >
            <PieceArt p={ghost.p} o={ghost.o} />
          </g>
        )}
        <g className="rota-loose">
          {loose.map((e, i) => {
            const x = (e.cell % n) * 100 + 50 + DX[e.dir] * 44,
              y = Math.floor(e.cell / n) * 100 + 50 + DY[e.dir] * 44;
            return <circle key={i} cx={x} cy={y} r="7" />;
          })}
        </g>
        {strike >= 0 && !blocked.has(strike) && (
          <g
            className="rota-strike"
            data-covered={!!cells[strike] || undefined}
            transform={`translate(${(strike % n) * 100} ${Math.floor(strike / n) * 100})`}
          >
            <circle cx="50" cy="50" r="38" />
            <path d="M50 4v18M50 78v18M4 50h18M78 50h18" />
          </g>
        )}
      </svg>
      <SheetCells
        map={map}
        cells={cells}
        rubble={rubble}
        towns={towns}
        strike={strike}
        targets={targets}
        turnable={turnable}
        onCell={onCell}
        onPointerCell={onPointerCell}
        label={label}
      />
    </div>
  );
}

/** The squares you tap: real buttons, one per square, in a grid. The SVG
 * sheet lays them over its drawing; the 3D board lays them over the ground
 * through a perspective transform. */
export function SheetCells({
  map,
  cells,
  rubble,
  towns,
  strike = -1,
  targets,
  turnable,
  onCell,
  onPointerCell,
  label,
  className,
  style,
}: Pick<
  SheetProps,
  | 'map'
  | 'cells'
  | 'rubble'
  | 'towns'
  | 'strike'
  | 'targets'
  | 'turnable'
  | 'onCell'
  | 'onPointerCell'
  | 'label'
> & { className?: string; style?: CSSProperties }) {
  const interactive = !!onCell;
  const describe = (cell: number) => {
    const c = cells[cell];
    const name = cellName(map, cell);
    if (c)
      return `${name}: ${pieces[c.p].name}${cell === turnable ? ', tap to turn' : ''}`;
    if (map.sea.includes(cell)) return `${name}: sea`;
    if (rubble.includes(cell)) return `${name}: rubble`;
    const bits = [
      map.peaks.includes(cell) && 'peak',
      towns.includes(cell) && 'town',
      map.centre.includes(cell) && 'centre',
      cell === strike && 'rockfall',
    ].filter(Boolean);
    return `${name}${bits.length ? `: ${bits.join(', ')}` : ''}${targets?.has(cell) ? ', build here' : ''}`;
  };
  const cellAt = (e: ReactPointerEvent) => {
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-rota-cell]');
    return el ? Number(el.dataset.rotaCell) : null;
  };
  return (
    <div
      className={`rota-cells ${className ?? ''}`}
      style={style}
      role={interactive ? 'grid' : undefined}
      aria-label={label}
      onPointerMove={
        onPointerCell ? (e) => onPointerCell(cellAt(e)) : undefined
      }
    >
      {cells.map((c, cell) => {
        const target = targets?.has(cell);
        const turn = cell === turnable;
        if (!interactive)
          return (
            <span key={cell} className="rota-cell" data-rota-cell={cell} />
          );
        return (
          <button
            key={cell}
            type="button"
            className="rota-cell"
            data-rota-cell={cell}
            data-target={target || undefined}
            data-turn={turn || undefined}
            disabled={!target && !turn}
            aria-label={describe(cell)}
            onClick={() => onCell?.(cell)}
          >
            {turn && <RotateCw className="rota-turn-mark" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
