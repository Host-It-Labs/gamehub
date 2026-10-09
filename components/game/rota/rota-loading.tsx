'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/**
 * Rota's loading screen: a goods train, an engine at each end, on its way
 * into town across a brick viaduct while the 3D board downloads and builds.
 * The train cruises at a steady speed while the town slides past in
 * layers; a light along the parapet fills as the models arrive. The moment
 * the board is drawn the train pulls away out of the picture and the
 * screen fades into the board; nothing waits for the animation. Nothing
 * shows at all when everything is already in the cache.
 */

/** Width of one skyline tile in its own units; layers repeat it. */
const TILE = 1600;

/** A seeded run of rooftops that tiles seamlessly every TILE units. */
function skyline(seed: number, base: number, mills: number) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const roofs: string[] = [];
  const stacks: { x: number; top: number; w: number }[] = [];
  const windows: { x: number; y: number; d: number }[] = [];
  let x = 8;
  while (x < TILE - 40) {
    if (rand() < mills) {
      // A mill: a tall block with rows of windows and a chimney.
      const w = 90 + rand() * 70,
        h = 120 + rand() * 60;
      if (x + w > TILE - 8) break;
      roofs.push(`M${x} ${base}V${base - h}H${x + w}V${base}Z`);
      for (let row = base - h + 16; row < base - 16; row += 22)
        for (let col = x + 10; col < x + w - 12; col += 16)
          if (rand() < 0.55) windows.push({ x: col, y: row, d: rand() * 9 });
      stacks.push({
        x: x + w * (0.2 + rand() * 0.6),
        top: base - h - 90 - rand() * 60,
        w: 10 + rand() * 4,
      });
      x += w + 6 + rand() * 10;
    } else {
      // A terrace: pitched roofs in a row, a chimney on each party wall.
      const n = 2 + Math.floor(rand() * 4),
        w = 26 + rand() * 10,
        h = 36 + rand() * 30,
        pitch = 14 + rand() * 6;
      if (x + n * w > TILE - 8) break;
      let d = `M${x} ${base}V${base - h}`;
      for (let i = 0; i < n; i++)
        d += `L${x + w * i + w / 2} ${base - h - pitch}L${x + w * (i + 1)} ${base - h}`;
      d += `V${base}Z`;
      roofs.push(d);
      for (let i = 1; i < n; i++)
        roofs.push(`M${x + w * i - 3} ${base - h - pitch * 0.5}h6v-12h-6Z`);
      for (let i = 0; i < n; i++)
        if (rand() < 0.4)
          windows.push({
            x: x + w * i + w / 2 - 4,
            y: base - h + 12 + rand() * 8,
            d: rand() * 9,
          });
      x += n * w + 4 + rand() * 18;
    }
  }
  return { roof: roofs.join(''), stacks, windows };
}

const MOOR =
  'M0 250C140 205 260 228 400 196S640 150 800 182 1080 214 1220 178 1480 182 1600 250V400H0Z';
const FAR = skyline(7, 330, 0.26);
const NEAR = skyline(31, 400, 0.12);

/** How fast each layer drifts, against the viaduct (1). */
const PARALLAX = { moor: 0.08, far: 0.22, near: 0.5 };
/** The train's cruising speed in CSS pixels a second. */
const CRUISE = 360;
/** Once the board is drawn: the train pulls away out of the picture
 *  while the screen fades into the board (milliseconds). */
const DASH = 760;
const GONE = 820;
/** A load quicker than this never shows the loader at all. */
const QUICK = 450;

/**
 * Rota's loading screen. The scenery's drift and the train's dash at the
 * end are compositor animations (transform and opacity only), so they
 * stay smooth while the main thread builds and draws the board; no frame
 * loop drives them. Script only sets the cruising durations, once per
 * size, and quickens the wheels once when the train pulls away.
 */
export function RotaLoading({
  progress,
  done,
}: {
  progress: number;
  done: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const born = useRef(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    born.current = performance.now();
    const el = root.current;
    if (!el) return;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const train = q<SVGSVGElement>('.rota-loading-train');
    // Durations that make every layer move at its share of the train's
    // speed: one tile, one arch, one run of sleepers, one wheel turn.
    const pace = () => {
      const set = (k: string, seconds: number) =>
        el.style.setProperty(k, `${Math.max(0.05, seconds).toFixed(3)}s`);
      for (const [k, f] of Object.entries(PARALLAX)) {
        const layer = q<SVGSVGElement>(`.rota-loading-${k}`);
        const tile = layer.getBoundingClientRect().width / 3;
        set(`--${k}-dur`, tile / (CRUISE * f));
      }
      set('--arch-dur', 120 / CRUISE);
      set('--rail-dur', 150 / CRUISE);
      const wheel = 5.5 * (train.getBoundingClientRect().width / 220);
      set('--wheel-dur', (2 * Math.PI * wheel) / CRUISE);
    };
    pace();
    const ro = new ResizeObserver(pace);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The board is drawn: the train pulls away and the town fades in at
  // once; a quick load (from the cache) was never shown, so it just goes.
  useEffect(() => {
    if (!done) return;
    const el = root.current;
    const quick = performance.now() - born.current < QUICK;
    if (el && !quick) {
      // Only the wheels and puffs quicken (one change each, from where
      // they are): the scenery keeps its pace while the train pulls ahead.
      for (const a of el.getAnimations({ subtree: true }))
        if (
          a instanceof CSSAnimation &&
          (a.animationName === 'rota-loading-run-wheel' ||
            a.animationName === 'rota-loading-puff')
        )
          a.updatePlaybackRate(2.6);
    }
    const t = setTimeout(() => setGone(true), quick ? 0 : GONE);
    return () => clearTimeout(t);
  }, [done]);

  // Unmounting the scene ends its animations and observer.
  if (gone) return null;
  return (
    <div
      ref={root}
      className="rota-loading"
      data-done={done || undefined}
      style={{ '--dash': `${DASH}ms` } as CSSProperties}
    >
      <progress
        className="sr-only"
        aria-label="Loading the town"
        max={100}
        value={Math.round(Math.max(0, Math.min(1, progress)) * 100)}
      />
      <div className="rota-loading-sun" />
      <svg
        className="rota-loading-birds"
        viewBox="0 0 200 60"
        aria-hidden="true"
      >
        <path d="M20 30q6-6 12 0q6-6 12 0" />
        <path d="M58 18q4-4 8 0q4-4 8 0" />
        <path d="M84 36q5-5 10 0q5-5 10 0" />
      </svg>
      <Layer className="rota-loading-moor">
        <path d={MOOR} />
      </Layer>
      <Layer className="rota-loading-far">
        <path d={FAR.roof} />
        {FAR.stacks.map((c, i) => (
          <rect key={i} x={c.x} y={c.top} width={c.w} height={330 - c.top} />
        ))}
        <g className="rota-loading-farwin">
          {FAR.windows.map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width="7" height="9" />
          ))}
        </g>
        {FAR.stacks.map((c, i) => (
          <g
            key={i}
            className="rota-loading-smoke"
            style={{ '--d': `${i * 1.3}s` } as CSSProperties}
          >
            <circle cx={c.x + c.w / 2} cy={c.top - 8} r="9" />
            <circle cx={c.x + c.w / 2} cy={c.top - 8} r="9" />
          </g>
        ))}
      </Layer>
      <Layer className="rota-loading-near">
        <path d={NEAR.roof} />
        {NEAR.stacks.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.top + 40}
            width={c.w}
            height={360 - c.top}
          />
        ))}
        <g className="rota-loading-windows">
          {NEAR.windows.map((w, i) => (
            <rect
              key={i}
              x={w.x}
              y={w.y}
              width="8"
              height="10"
              style={{ '--d': `${w.d}s` } as CSSProperties}
            />
          ))}
        </g>
      </Layer>
      <div className="rota-loading-viaduct" aria-hidden="true">
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="rota-arches"
              width="120"
              height="600"
              patternUnits="userSpaceOnUse"
            >
              <path
                fillRule="evenodd"
                d="M0 0H120V600H0ZM22 600V58A38 38 0 0 1 98 58V600Z"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rota-arches)" />
          <rect className="rota-loading-coping" width="100%" height="7" />
        </svg>
        <div
          className="rota-loading-gauge"
          style={{ '--p': Math.max(0, Math.min(1, progress)) } as CSSProperties}
        />
      </div>
      <div className="rota-loading-line" aria-hidden="true">
        <div className="rota-loading-rails" />
        <div className="rota-loading-run">
          <svg className="rota-loading-train" viewBox="0 0 220 64">
            <g className="rota-loading-puffs">
              <circle cx="198" cy="14" r="6" />
              <circle cx="198" cy="14" r="6" />
              <circle cx="198" cy="14" r="6" />
            </g>
            {/* Tail engine, facing back. */}
            <g transform="translate(64 0) scale(-1 1)">
              <Engine flip />
            </g>
            <Wagon x={68} tone="#7c2f2b" />
            <Wagon x={114} tone="#5a6c78" />
            <g transform="translate(156 0)">
              <Engine />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

/** One parallax layer: three skyline tiles side by side. */
function Layer({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={`rota-loading-layer ${className}`}
      viewBox={`0 0 ${TILE * 3} 400`}
      preserveAspectRatio="xMinYMax meet"
      aria-hidden="true"
    >
      <defs>
        <g id={`${className}-tile`}>{children}</g>
      </defs>
      {[0, 1, 2].map((i) => (
        <use key={i} href={`#${className}-tile`} x={i * TILE} />
      ))}
    </svg>
  );
}

function Wheel({ cx, r, flip }: { cx: number; r: number; flip?: boolean }) {
  const cy = 51;
  return (
    <g
      className="rota-loading-wheel"
      data-cx={cx}
      data-cy={cy}
      data-r={r}
      data-flip={flip ? '1' : '0'}
    >
      <circle cx={cx} cy={cy} r={r} />
      <path
        d={`M${cx - r + 1.2} ${cy}H${cx + r - 1.2}M${cx} ${cy - r + 1.2}V${cy + r - 1.2}`}
      />
    </g>
  );
}

function Engine({ flip }: { flip?: boolean }) {
  return (
    <g className="rota-loading-engine">
      <rect x="0" y="22" width="20" height="22" rx="2" />
      <rect
        x="2"
        y="18"
        width="16"
        height="5"
        rx="1.5"
        className="rota-loading-roof"
      />
      <rect x="18" y="28" width="38" height="16" rx="7" />
      <rect
        x="44"
        y="14"
        width="7"
        height="15"
        rx="1.5"
        className="rota-loading-roof"
      />
      <rect
        x="5"
        y="26"
        width="9"
        height="8"
        rx="1"
        className="rota-loading-glass"
      />
      <rect
        x="18"
        y="35"
        width="38"
        height="2"
        className="rota-loading-lining"
      />
      <circle cx="56" cy="38" r="2" className="rota-loading-lamp" />
      <rect
        x="-1"
        y="44"
        width="60"
        height="4"
        rx="1"
        className="rota-loading-frame"
      />
      <Wheel cx={12} r={5.5} flip={flip} />
      <Wheel cx={30} r={5.5} flip={flip} />
      <Wheel cx={47} r={5.5} flip={flip} />
    </g>
  );
}

function Wagon({ x, tone }: { x: number; tone: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="24" width="40" height="20" rx="2" fill={tone} />
      <rect
        x="0"
        y="21"
        width="40"
        height="4"
        rx="2"
        className="rota-loading-roof"
      />
      <rect
        x="-2"
        y="44"
        width="44"
        height="4"
        rx="1"
        className="rota-loading-frame"
      />
      <Wheel cx={9} r={5.5} />
      <Wheel cx={31} r={5.5} />
    </g>
  );
}
