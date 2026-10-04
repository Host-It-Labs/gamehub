'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  CircleHelp,
  Crown,
  Skull,
  Store,
  Swords,
  Tent,
  type LucideIcon,
} from 'lucide-react';
import {
  ROWS,
  reachable,
  type QuestState,
  type Stop,
  type StopKind,
} from '@/lib/games/arena/quest';
import { arenaManifest } from './assets';

export const stopIcons: Record<StopKind, LucideIcon> = {
  battle: Swords,
  elite: Skull,
  camp: Tent,
  shop: Store,
  event: CircleHelp,
  boss: Crown,
};

/**
 * Where things are in each region painting, as fractions of the painting:
 * the open ground the stops stand on, the foot of the boss's landmark
 * (painted at the top centre) and a few spots on its water for the glints.
 * Measured on the picks in scripts/arena-splash.mjs.
 */
type Art = {
  open: [number, number, number, number];
  boss: [number, number];
  water: [number, number][];
};
const ART: Record<string, Art> = {
  '1-wide': {
    open: [0.24, 0.28, 0.8, 0.96],
    boss: [0.52, 0.23],
    water: [
      [0.3, 0.07],
      [0.68, 0.22],
      [0.8, 0.1],
      [0.13, 0.52],
      [0.04, 0.63],
      [0.2, 0.45],
    ],
  },
  '1-tall': {
    open: [0.22, 0.24, 0.8, 0.96],
    boss: [0.5, 0.2],
    water: [
      [0.25, 0.06],
      [0.7, 0.2],
      [0.9, 0.15],
      [0.1, 0.33],
      [0.12, 0.4],
    ],
  },
  '2-wide': {
    open: [0.27, 0.25, 0.78, 0.96],
    boss: [0.52, 0.19],
    water: [
      [0.18, 0.32],
      [0.24, 0.35],
      [0.13, 0.3],
    ],
  },
  '2-tall': {
    open: [0.24, 0.22, 0.82, 0.96],
    boss: [0.57, 0.17],
    water: [
      [0.9, 0.38],
      [0.86, 0.42],
      [0.95, 0.45],
    ],
  },
  '3-wide': {
    open: [0.28, 0.24, 0.75, 0.96],
    boss: [0.53, 0.18],
    water: [
      [0.08, 0.33],
      [0.15, 0.45],
      [0.04, 0.5],
      [0.2, 0.3],
    ],
  },
  '3-tall': {
    open: [0.25, 0.21, 0.76, 0.96],
    boss: [0.53, 0.14],
    water: [
      [0.14, 0.85],
      [0.26, 0.9],
      [0.07, 0.8],
    ],
  },
};
/** The image tool's native sizes; the 2x cuts double them. */
const NATIVE = { wide: [1536, 1024], tall: [1024, 1536] } as const;
/** Below this width to height the tall painting shows. */
const TALL_BELOW = 4 / 5;

type Pt = [number, number];
type Layout = {
  w: number;
  h: number;
  /** Ground points of every stop, and where the run starts. */
  at: Map<number, Pt>;
  start: Pt;
  /** Rows' ground heights, row 0 first and the boss's last. */
  rowY: number[];
  /** Perspective: markers shrink toward the far (top) end. */
  scale: (y: number) => number;
  water: Pt[];
  sparkles: Pt[];
  open: [number, number, number, number];
};

/** A painting cut to cover the screen, and the map fitted inside it. */
function layout(
  q: QuestState,
  w: number,
  h: number,
  top: number,
  bottom: number,
): Layout {
  const cut = w / h < TALL_BELOW ? 'tall' : 'wide';
  const art = ART[`${q.region + 1}-${cut}`];
  const [aw, ah] = NATIVE[cut];
  const s = Math.max(w / aw, h / ah);
  const ox = (w - aw * s) / 2;
  const oy = (h - ah * s) / 2;
  const P = (fx: number, fy: number): Pt => [
    ox + fx * aw * s,
    oy + fy * ah * s,
  ];
  const marker = markerSize(w, h);
  // The ground of the open area, kept clear of the corners and the deck:
  // a marker stands above its ground point.
  const [x0, y0] = P(art.open[0], art.open[1]);
  const [x1, y1] = P(art.open[2], art.open[3]);
  const left = Math.max(x0, marker * 0.8);
  const right = Math.min(x1, w - marker * 0.8);
  const floor = Math.min(y1, bottom - marker * 0.5);
  const [bx, rawBy] = P(...art.boss);
  const by = Math.min(
    Math.max(rawBy, top + marker * 1.55),
    floor - (floor - y0) * 0.86,
  );
  const step = (floor - by) / (ROWS + 0.35);
  const rowY = Array.from({ length: ROWS + 1 }, (_, r) =>
    r === ROWS ? by : floor - step * 0.35 - r * step,
  );
  const scale = (y: number) =>
    0.74 + 0.3 * Math.min(1, Math.max(0, (y - by) / (floor - by || 1)));
  const at = new Map<number, Pt>();
  const mid = (left + right) / 2;
  for (const stop of q.stops) {
    if (stop.kind === 'boss') {
      at.set(stop.id, [Math.min(Math.max(bx, left), right), by]);
      continue;
    }
    const y = rowY[stop.row];
    // The ground narrows toward the landmark, and its middle drifts to it.
    const t = stop.row / ROWS;
    const half = ((right - left) / 2) * (1 - t * 0.28);
    const centre = mid + (bx - mid) * t * 0.8;
    const wobble = (((stop.id * 37) % 11) - 5) / 5;
    const x = centre + (stop.col - 1) * half * 0.74 + wobble * half * 0.06;
    const dy = ((((stop.id * 53) % 7) - 3) / 3) * step * 0.12;
    at.set(stop.id, [x, y + dy]);
  }
  const start: Pt = [
    mid,
    Math.min(rowY[0] + step * 0.62, bottom - marker * 0.12),
  ];
  // A few seeded twinkles over the open ground.
  let seed = (q.seed ^ (q.region * 2654435761)) >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sparkles: Pt[] = Array.from({ length: 10 }, () => [
    left + rand() * (right - left),
    by + rand() * (floor - by),
  ]);
  return {
    w,
    h,
    at,
    start,
    rowY,
    scale,
    water: art.water.map(([fx, fy]) => P(fx, fy)),
    sparkles,
    open: [left, by, right, floor],
  };
}

export const markerSize = (w: number, h: number) =>
  Math.round(Math.min(64, Math.max(44, Math.min(w, h) * 0.075)));

/** A gentle curve from a to b that bends a little, the same way each time. */
function curve(a: Pt, b: Pt, bend: number) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return {
    c: [mx - dy * bend, my + dx * bend] as Pt,
    at: (t: number): Pt => {
      const u = 1 - t;
      return [
        u * u * a[0] + 2 * u * t * (mx - dy * bend) + t * t * b[0],
        u * u * a[1] + 2 * u * t * (my + dx * bend) + t * t * b[1],
      ];
    },
  };
}
const bendOf = (a: number, b: number) => (((a * 7 + b * 13) % 5) - 2) * 0.07;

/** The same curve moved sideways by `off` pixels: a line of footprints. */
function side(a: Pt, b: Pt, bend: number, off: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * off;
  const ny = (dx / len) * off;
  const { c } = curve(a, b, bend);
  return `M${a[0] + nx} ${a[1] + ny} Q${c[0] + nx} ${c[1] + ny} ${b[0] + nx} ${b[1] + ny}`;
}

const reduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export type StopState = 'here' | 'done' | 'next' | 'past' | 'ahead';

/**
 * The region map, painted in: the painting covers the screen and every
 * trail, marker, cloud and glint is placed in its coordinates, so the
 * stops stand on its open ground and the boss at its landmark. Trails are
 * worn tracks with footprints, cleared stops carry your flag, fog hides the
 * rows beyond the next two and rolls back as you climb, and the party's
 * token walks to the stop you choose before it opens.
 */
export function QuestMap({
  q,
  active,
  walk = true,
  selected,
  onSelect,
  onGo,
  marks,
  children,
}: {
  q: QuestState;
  /** The map takes taps (no panel over it). */
  active: boolean;
  /** Walk the token before going (the host); a suggestion goes at once. */
  walk?: boolean;
  selected: number | null;
  onSelect: (stop: number | null) => void;
  /** Called once the token has walked there. */
  onGo: (stop: number) => void;
  marks: (key: string) => ReactNode;
  /** The selected stop's details, given its ground point, the map's size
   *  and `go`, which walks the token there. */
  children?: (
    stop: Stop,
    at: Pt,
    size: Pt,
    go: (stop: number) => void,
  ) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  // The token's element, kept in state so `go` can be handed to children.
  const [token, setToken] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  const [walking, setWalking] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    const quest = el?.closest('.quest');
    if (!el || !quest) return;
    const measure = () => {
      const r = quest.getBoundingClientRect();
      const top = quest.querySelector('.quest-top')?.getBoundingClientRect();
      const deck = quest.querySelector('.quest-deck')?.getBoundingClientRect();
      const next: [number, number, number, number] = [
        r.width,
        r.height,
        Math.round((top?.bottom ?? 80) - r.top),
        Math.round((deck?.top ?? r.bottom - 100) - r.top),
      ];
      setBox((b) => (b && b.every((v, i) => v === next[i]) ? b : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(quest);
    const top = quest.querySelector('.quest-top');
    const deck = quest.querySelector('.quest-deck');
    if (top) ro.observe(top);
    if (deck) ro.observe(deck);
    return () => ro.disconnect();
  }, []);

  const L = box ? layout(q, ...box) : null;
  const next = reachable(q);
  const here = q.at === null ? null : q.stops.find((s) => s.id === q.at)!;
  const row = here ? here.row : -1;
  // Rows up to two ahead are clear; fog lies over the rest below the boss.
  const clearTo = row + 2;
  const cut = box && box[0] / box[1] < TALL_BELOW ? 'tall' : 'wide';
  const n = q.region + 1;

  const tokenAt = (): Pt | null => {
    if (!L) return null;
    return here ? L.at.get(here.id)! : L.start;
  };

  // The token walks the trail, then the stop opens.
  const go = (stop: number) => {
    if (walking !== null) return;
    const from = tokenAt();
    const to = L?.at.get(stop);
    const el = token;
    if (!walk || !from || !to || !el || reduced()) {
      onGo(stop);
      return;
    }
    setWalking(stop);
    onSelect(null);
    const { at } = curve(from, to, bendOf(here?.id ?? -1, stop));
    const frames = Array.from({ length: 17 }, (_, i) => {
      const [x, y] = at(i / 16);
      // A little hop on every step.
      const hop = Math.abs(Math.sin((i / 16) * Math.PI * 4)) * 7;
      return { transform: `translate(${x}px, ${y - hop}px)` };
    });
    const anim = el.animate(frames, {
      duration: 760,
      easing: 'ease-in-out',
      fill: 'forwards',
    });
    anim.onfinish = () => {
      setWalking(null);
      onGo(stop);
    };
  };
  // A finished walk leaves the token where the state now puts it.
  useEffect(() => {
    token?.getAnimations().forEach((a) => a.cancel());
  }, [token, q.at, q.region]);

  const stateOf = (s: Stop): StopState =>
    q.at === s.id
      ? 'here'
      : q.trail.includes(s.id)
        ? 'done'
        : next.includes(s.id) && active
          ? 'next'
          : s.row <= row
            ? 'past'
            : 'ahead';

  const edges: { a: Pt; b: Pt; bend: number; kind: string; key: string }[] = [];
  if (L) {
    if (q.at === null)
      for (const s of q.stops.filter((x) => x.row === 0))
        edges.push({
          a: L.start,
          b: L.at.get(s.id)!,
          bend: bendOf(-1, s.id),
          kind: active ? 'open' : 'ahead',
          key: `start-${s.id}`,
        });
    else if (q.trail.length)
      edges.push({
        a: L.start,
        b: L.at.get(q.trail[0])!,
        bend: bendOf(-1, q.trail[0]),
        kind: 'walked',
        key: `start-${q.trail[0]}`,
      });
    for (const s of q.stops)
      for (const t of s.next) {
        const walked =
          q.trail.indexOf(t) > 0 && q.trail[q.trail.indexOf(t) - 1] === s.id;
        const target = q.stops.find((x) => x.id === t)!;
        edges.push({
          a: L.at.get(s.id)!,
          b: L.at.get(t)!,
          bend: bendOf(s.id, t),
          kind: walked
            ? 'walked'
            : q.at === s.id && active
              ? 'open'
              : target.row <= row || s.row < row
                ? 'past'
                : target.row > clearTo
                  ? 'fog'
                  : 'ahead',
          key: `${s.id}-${t}`,
        });
      }
  }
  const order = { fog: 0, past: 1, ahead: 2, walked: 3, open: 4 } as const;
  edges.sort(
    (x, y) =>
      order[x.kind as keyof typeof order] - order[y.kind as keyof typeof order],
  );
  const fogBottom =
    L && clearTo < ROWS - 1 ? (L.rowY[clearTo] + L.rowY[clearTo + 1]) / 2 : 0;
  const fogTop = L
    ? L.rowY[ROWS] + (L.rowY[ROWS - 1] - L.rowY[ROWS]) * 0.45
    : 0;
  const lead = q.deck[0];
  const leadArt = lead ? arenaManifest.cards[lead]?.path : undefined;
  const t0 = tokenAt();
  const size = box ? markerSize(box[0], box[1]) : 56;

  return (
    <div
      ref={root}
      className="quest-world"
      data-walking={walking !== null}
      style={{ '--marker': `${size}px` } as CSSProperties}
    >
      <picture className="quest-map-art">
        <source
          media={`(max-aspect-ratio: ${TALL_BELOW * 5}/5)`}
          srcSet={`/art/optimized/arena-quest-${n}-tall.webp 1024w, /art/optimized/arena-quest-${n}-tall-2x.webp 2048w`}
          sizes="(min-aspect-ratio: 2/3) 100vw, 66.7vh"
        />
        <img
          src={`/art/optimized/arena-quest-${n}-wide.webp`}
          srcSet={`/art/optimized/arena-quest-${n}-wide.webp 1536w, /art/optimized/arena-quest-${n}-wide-2x.webp 3072w`}
          sizes="(min-aspect-ratio: 3/2) 100vw, 150vh"
          alt=""
          draggable={false}
          data-cut={cut}
          onError={(e) => {
            // Until a region's painting exists its sky gradient shows.
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
      </picture>
      {L && (
        <>
          <div className="quest-ambient" aria-hidden="true">
            <i className="quest-cloudshade" />
            <i className="quest-cloudshade b" />
            {L.water.map(([x, y], i) => (
              <i
                key={`w${i}`}
                className="quest-glint"
                style={
                  {
                    left: x,
                    top: y,
                    animationDelay: `${(i * 0.83) % 3}s`,
                  } as CSSProperties
                }
              />
            ))}
            {L.sparkles.map(([x, y], i) => (
              <i
                key={`s${i}`}
                className="quest-sparkle"
                style={
                  {
                    left: x,
                    top: y,
                    animationDelay: `${(i * 1.37) % 5}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <svg
            className="quest-trails"
            viewBox={`0 0 ${L.w} ${L.h}`}
            width={L.w}
            height={L.h}
            aria-hidden="true"
          >
            {edges.map((e) => {
              const k = L.scale((e.a[1] + e.b[1]) / 2);
              const { c } = curve(e.a, e.b, e.bend);
              const d = `M${e.a[0]} ${e.a[1]} Q${c[0]} ${c[1]} ${e.b[0]} ${e.b[1]}`;
              const foot = 2.6 * k;
              return (
                <g
                  key={e.key}
                  data-kind={e.kind}
                  style={{ '--k': k } as CSSProperties}
                >
                  <path className="quest-trail-bed" d={d} />
                  <path
                    className="quest-trail-step"
                    d={side(e.a, e.b, e.bend, -foot)}
                  />
                  <path
                    className="quest-trail-step r"
                    d={side(e.a, e.b, e.bend, foot)}
                  />
                </g>
              );
            })}
          </svg>
          {fogBottom > fogTop + 10 && (
            <div
              className="quest-fog"
              aria-hidden="true"
              style={{
                // A thin bank still gets room to billow.
                top: Math.min(fogTop, fogBottom - size * 2.6),
                height: Math.max(fogBottom - fogTop, size * 2.6),
              }}
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {q.stops.map((s) => {
            const [x, y] = L.at.get(s.id)!;
            const Icon = stopIcons[s.kind];
            const state = stateOf(s);
            const fogged = s.kind !== 'boss' && s.row > clearTo;
            return (
              <button
                key={s.id}
                type="button"
                className="quest-stop"
                data-kind={s.kind}
                data-state={state}
                data-fog={fogged}
                data-selected={selected === s.id}
                style={
                  {
                    left: x,
                    top: y,
                    '--k': L.scale(y),
                    zIndex: Math.round(y),
                  } as CSSProperties
                }
                aria-label={`${s.foe && s.kind === 'boss' ? s.foe.name : stopLabel[s.kind]}${state === 'done' || state === 'here' ? ', done' : ''}`}
                onClick={() => {
                  if (!active || walking !== null) return;
                  if (selected === s.id && next.includes(s.id)) go(s.id);
                  else onSelect(s.id);
                }}
              >
                <i className="quest-stop-shadow" />
                {state === 'next' && <i className="quest-stop-ring" />}
                <i className="quest-stop-plinth" />
                <span className="quest-stop-emblem">
                  <Icon aria-hidden="true" />
                </span>
                {(state === 'done' || state === 'here') && (
                  <i className="quest-stop-flag" />
                )}
                {marks(`stop:${s.id}`)}
              </button>
            );
          })}
          {t0 && (
            <div
              ref={setToken}
              className="quest-token"
              aria-hidden="true"
              style={
                {
                  transform: `translate(${t0[0]}px, ${t0[1]}px)`,
                  zIndex: 2000,
                  '--k': L.scale(t0[1]),
                } as CSSProperties
              }
            >
              <span className="quest-token-body">
                <i className="quest-token-shadow" />
                <span className="quest-token-face">
                  {leadArt ? <img src={leadArt} alt="" /> : null}
                </span>
              </span>
            </div>
          )}
          {selected !== null &&
            active &&
            walking === null &&
            children?.(
              q.stops.find((s) => s.id === selected)!,
              L.at.get(selected)!,
              [L.w, L.h],
              go,
            )}
        </>
      )}
    </div>
  );
}

export const stopLabel: Record<StopKind, string> = {
  battle: 'Battle',
  elite: 'Elite battle',
  camp: 'Camp',
  shop: 'Shop',
  event: 'Stranger',
  boss: 'Boss',
};
