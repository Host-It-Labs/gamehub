'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Stations are SVG shapes on the painted panel; each live one is a keyboard button. */
import { memo, useMemo } from 'react';
import type { CityMap } from '@/lib/games/metro/map';
import { coloursAt, type Section } from '@/lib/games/metro/score';
import { MoonGlyph, ShapeGlyph, SunGlyph, LINE_NAMES, SHAPE_NAMES } from './metro-art';

/** One tile of the panel per grid point; a station sits in a tile's middle. */
export const TILE = 100;
/** The patterned border band round the panel. */
export const BORDER = 46;
const at = (v: number) => BORDER + (v + 0.5) * TILE;

/** A little steady unevenness in the glaze, tile by tile. */
const glaze = (x: number, y: number) => ((x * 73 + y * 151 + x * y * 17) % 7) / 7;

export type Ghost = { from: number; to: number };

type Props = {
  map: CityMap;
  sections: Section[];
  boxed: number[];
  /** The line drawn this round, whose starts and ends are marked. */
  colour?: number;
  /** Stations a section may leave from now. */
  froms?: Set<number>;
  /** Stations a section may reach now. */
  targets?: Set<number>;
  /** The station picked to leave from. */
  picked?: number | null;
  /** Dashed previews of sections you could draw. */
  ghosts?: Ghost[];
  /** Sections drawn this turn, drawn in as they land. */
  fresh?: Set<Section>;
  onStation?: (id: number) => void;
  label: string;
  className?: string;
};

/** The wavy river between the banks, down the grout line between the
 *  two middle columns. */
function riverPath(map: CityMap) {
  const x = BORDER + (map.cols / 2) * TILE;
  const top = BORDER - 10;
  const bottom = BORDER + map.rows * TILE + 10;
  const parts = [`M ${x} ${top}`];
  const steps = map.rows * 2;
  for (let i = 1; i <= steps; i++) {
    const y = top + ((bottom - top) * i) / steps;
    const dx = (i % 2 ? 1 : -1) * 9;
    parts.push(`Q ${x + dx} ${y - (bottom - top) / steps / 2} ${x} ${y}`);
  }
  return parts.join(' ');
}

/** The district edges, as grout lines drawn bolder than the rest. */
function districtEdges(map: CityMap) {
  const of = new Map<number, number>();
  for (const d of map.districts)
    for (const [x, y] of d.points) of.set(y * map.cols + x, d.id);
  const segs: string[] = [];
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++) {
      const here = of.get(y * map.cols + x);
      const left = BORDER + x * TILE,
        top = BORDER + y * TILE;
      if (x + 1 < map.cols && of.get(y * map.cols + x + 1) !== here)
        segs.push(`M ${left + TILE} ${top} V ${top + TILE}`);
      if (y + 1 < map.rows && of.get((y + 1) * map.cols + x) !== here)
        segs.push(`M ${left} ${top + TILE} H ${left + TILE}`);
    }
  return segs.join(' ');
}

/** The static panel: glaze, washes, grout, river and the dotted guides. */
const Panel = memo(function Panel({ map }: { map: CityMap }) {
  const w = map.cols * TILE,
    h = map.rows * TILE;
  const edges = useMemo(() => districtEdges(map), [map]);
  const river = useMemo(() => riverPath(map), [map]);
  const guides = useMemo(() => {
    const p: string[] = [];
    for (let y = 0; y < map.rows; y++) p.push(`M ${at(0)} ${at(y)} H ${at(map.cols - 1)}`);
    for (let x = 0; x < map.cols; x++) p.push(`M ${at(x)} ${at(0)} V ${at(map.rows - 1)}`);
    map.diagonals.forEach((row, y) =>
      row.split('').forEach((c, x) => {
        if (c === '\\' || c === 'x') p.push(`M ${at(x)} ${at(y)} L ${at(x + 1)} ${at(y + 1)}`);
        if (c === '/' || c === 'x') p.push(`M ${at(x + 1)} ${at(y)} L ${at(x)} ${at(y + 1)}`);
      }),
    );
    return p.join(' ');
  }, [map]);
  return (
    <g className="metro-panel">
      <rect
        className="metro-frame"
        x={4}
        y={4}
        width={w + BORDER * 2 - 8}
        height={h + BORDER * 2 - 8}
        rx={22}
      />
      <rect
        className="metro-border-band"
        x={10}
        y={10}
        width={w + BORDER * 2 - 20}
        height={h + BORDER * 2 - 20}
        rx={16}
        fill="url(#metro-border)"
      />
      {map.districts.map((d) =>
        d.points.map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            className="metro-tile"
            data-district={d.id}
            data-outer={d.outer || undefined}
            x={BORDER + x * TILE}
            y={BORDER + y * TILE}
            width={TILE}
            height={TILE}
            style={{ opacity: 0.9 + glaze(x, y) * 0.1 }}
          />
        )),
      )}
      <rect
        x={BORDER}
        y={BORDER}
        width={w}
        height={h}
        fill="url(#metro-glaze)"
        className="metro-glaze"
      />
      {map.districts
        .filter((d) => d.outer)
        .map((d) => {
          const [x, y] = d.points[0];
          const cx = BORDER + x * TILE + TILE / 2,
            cy = BORDER + y * TILE + TILE / 2;
          return (
            <g key={d.id} className="metro-outer-mark">
              <rect x={cx - 41} y={cy - 41} width={82} height={82} rx={6} />
              {[0, 1, 2, 3].map((k) => (
                <path
                  key={k}
                  transform={`rotate(${k * 90} ${cx} ${cy})`}
                  d={`M ${cx - 41} ${cy - 22} Q ${cx - 41} ${cy - 41} ${cx - 22} ${cy - 41}`}
                />
              ))}
            </g>
          );
        })}
      <path className="metro-river-bed" d={river} />
      <path className="metro-river" d={river} />
      <path className="metro-district-edges" d={edges} />
      <path className="metro-guides" d={guides} />
      <g className="metro-banks" aria-hidden="true">
        {/* A plaque on the frame above each bank, at its middle. */}
        <circle className="metro-bank-plaque" cx={BORDER + w / 4} cy={BORDER / 2} r={34} />
        <MoonGlyph cx={BORDER + w / 4 - 2} cy={BORDER / 2} r={24} />
        <circle className="metro-bank-plaque" cx={BORDER + (w * 3) / 4} cy={BORDER / 2} r={34} />
        <SunGlyph cx={BORDER + (w * 3) / 4} cy={BORDER / 2} r={27} />
      </g>
    </g>
  );
});

/** Patterns shared by every panel on the page: the border tiles and the glaze. */
function Defs() {
  return (
    <defs>
      <pattern id="metro-border" width="46" height="46" patternUnits="userSpaceOnUse">
        <rect width="46" height="46" className="metro-border-tile" />
        <path
          className="metro-border-motif"
          d="M23 4 C27 14 32 19 42 23 C32 27 27 32 23 42 C19 32 14 27 4 23 C14 19 19 14 23 4 Z"
        />
        <circle className="metro-border-dot" cx="23" cy="23" r="4" />
        <path className="metro-border-corner" d="M0 0 h8 a8 8 0 0 1 -8 8 Z M46 0 v8 a8 8 0 0 1 -8 -8 Z M0 46 v-8 a8 8 0 0 1 8 8 Z M46 46 h-8 a8 8 0 0 1 8 -8 Z" />
      </pattern>
      <pattern id="metro-glaze" width={TILE} height={TILE} patternUnits="userSpaceOnUse" x={BORDER} y={BORDER}>
        <rect width={TILE} height={TILE} fill="url(#metro-sheen)" />
        <path d={`M 1.5 ${TILE - 1.5} V 1.5 H ${TILE - 1.5}`} className="metro-bevel-light" />
        <path d={`M ${TILE - 1.5} 1.5 V ${TILE - 1.5} H 1.5`} className="metro-bevel-dark" />
        <rect width={TILE} height={TILE} className="metro-grout" />
      </pattern>
      <linearGradient id="metro-sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#5a4a2a" stopOpacity="0.06" />
      </linearGradient>
    </defs>
  );
}

/** Where a section lies, nudged sideways when two colours share a hop. The
 *  nudge follows the hop's own direction, not the way each was drawn, so
 *  sections drawn in opposite directions still sit side by side. */
function sectionLine(map: CityMap, s: Section, lane: number, lanes: number) {
  const e = map.edges[s.e];
  const a = map.stations[e.a],
    b = map.stations[e.b];
  const from = s.from === e.a ? a : b;
  const to = s.from === e.a ? b : a;
  let x1 = at(from.x),
    y1 = at(from.y),
    x2 = at(to.x),
    y2 = at(to.y);
  if (lanes > 1) {
    const dx = at(b.x) - at(a.x),
      dy = at(b.y) - at(a.y);
    const len = Math.hypot(dx, dy);
    const off = (lane - (lanes - 1) / 2) * 15;
    const nx = (-dy / len) * off,
      ny = (dx / len) * off;
    x1 += nx;
    x2 += nx;
    y1 += ny;
    y2 += ny;
  }
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * A seat's map: the tiled panel of the city with every line painted on it.
 * Stations are the buttons; only the ones you may use now respond.
 */
export function MetroMap({
  map,
  sections,
  boxed,
  colour,
  froms,
  targets,
  picked,
  ghosts,
  fresh,
  onStation,
  label,
  className,
}: Props) {
  const w = map.cols * TILE + BORDER * 2,
    h = map.rows * TILE + BORDER * 2;
  const lines = useMemo(() => coloursAt(map, sections), [map, sections]);
  const lanes = useMemo(() => {
    const by = new Map<number, Section[]>();
    for (const s of sections) (by.get(s.e) ?? by.set(s.e, []).get(s.e)!).push(s);
    return by;
  }, [sections]);
  const starts = useMemo(() => {
    const m = new Map<number, number>();
    map.starts.forEach((pair, c) => pair.forEach((s) => m.set(s, c)));
    return m;
  }, [map]);
  const order = (s: Section) => (s.c === colour ? 1 : 0);
  return (
    <div className={`metro-map ${className ?? ''}`} role="group" aria-label={label}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <Defs />
        <Panel map={map} />
        <g className="metro-sections">
          {[...sections]
            .sort((a, b) => order(a) - order(b))
            .map((s, i) => {
              const same = lanes.get(s.e)!;
              const d = sectionLine(map, s, same.indexOf(s), same.length);
              return (
                <g
                  key={`${s.e}-${s.c}-${i}`}
                  className="metro-section"
                  data-line={s.c}
                  data-current={s.c === colour || undefined}
                  data-fresh={fresh?.has(s) || undefined}
                >
                  <path className="metro-section-edge" d={d} pathLength={1} />
                  <path className="metro-section-glaze" d={d} pathLength={1} />
                </g>
              );
            })}
        </g>
        {ghosts && ghosts.length > 0 && (
          <g className="metro-ghosts" data-line={colour}>
            {ghosts.map((gh) => (
              <path
                key={`${gh.from}-${gh.to}`}
                d={`M ${at(map.stations[gh.from].x)} ${at(map.stations[gh.from].y)} L ${at(map.stations[gh.to].x)} ${at(map.stations[gh.to].y)}`}
              />
            ))}
          </g>
        )}
        <g className="metro-stations">
          {map.stations.map((st) => {
            const cx = at(st.x),
              cy = at(st.y);
            const start = starts.get(st.id);
            const on = lines.get(st.id);
            const isTarget = targets?.has(st.id);
            const isFrom = froms?.has(st.id);
            return (
              <g
                key={st.id}
                className="metro-station"
                data-start={start}
                data-mine={start !== undefined && start === colour ? '' : undefined}
                data-interchange={on && on.size > 1 ? on.size : undefined}
                data-target={isTarget || undefined}
                data-from={isFrom || undefined}
                data-picked={picked === st.id || undefined}
              >
                {boxed.includes(st.id) && (
                  <rect
                    className="metro-grand"
                    x={cx - 38}
                    y={cy - 38}
                    width={76}
                    height={76}
                    rx={8}
                  />
                )}
                {(isTarget || isFrom) && <circle className="metro-halo" cx={cx} cy={cy} r={40} />}
                <ShapeGlyph shape={st.shape} cx={cx} cy={cy} r={24} className="metro-station-shape" />
                {on && on.size > 1 && (
                  <ShapeGlyph shape={st.shape} cx={cx} cy={cy} r={12} className="metro-interchange-core" />
                )}
              </g>
            );
          })}
        </g>
        {onStation && (
          <g className="metro-hits">
            {map.stations.map((st) => {
              const live = targets?.has(st.id) || froms?.has(st.id);
              if (!live) return null;
              const where = `${SHAPE_NAMES[st.shape]} at column ${st.x + 1}, row ${st.y + 1}`;
              return (
                <circle
                  key={st.id}
                  className="metro-hit"
                  cx={at(st.x)}
                  cy={at(st.y)}
                  r={46}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    targets?.has(st.id)
                      ? `Draw to the ${where}${colour !== undefined ? ` in ${LINE_NAMES[colour]}` : ''}`
                      : `Leave from the ${where}`
                  }
                  onClick={() => onStation(st.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onStation(st.id);
                    }
                  }}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
