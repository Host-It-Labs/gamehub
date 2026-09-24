'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The silhouette itself is the size control: dragged, pinched, or stepped with the arrow keys. */
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ArrowRight, LockKeyhole, Minus, Plus, Unlock } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import {
  country,
  guessRange,
  measure,
  offBy,
  thing,
  tidy,
  type SizeGame,
  type SizeKind,
  type SizeQuestion,
} from '@/lib/games/party/size';
import silhouettes from '@/lib/games/party/size-silhouettes.json';
import { CountUp, stagger } from './reveal-motion';
import { SabiSteps } from './sabi-steps';
import './size-table.css';

const seatColors = [
  '#ff5a3c',
  '#3569ff',
  '#12a870',
  '#9c52f2',
  '#f28c28',
  '#f26aae',
];
type Box = { w: number; h: number };
type Shape = {
  kind: SizeKind;
  id: string;
  /** Real size of the silhouette's box, in the item's unit. */
  real: Box;
};
/** Parses a country outline's bounds once; the paths are plain M/L/Z. */
const countryBounds = new Map<
  string,
  { x: number; y: number; w: number; h: number }
>();
function bounds(id: string) {
  let b = countryBounds.get(id);
  if (!b) {
    const n = country(id)!
      .path.match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) {
      x0 = Math.min(x0, n[i]);
      x1 = Math.max(x1, n[i]);
      y0 = Math.min(y0, n[i + 1]);
      y1 = Math.max(y1, n[i + 1]);
    }
    b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    countryBounds.set(id, b);
  }
  return b;
}
function cell(id: string) {
  const t = thing(id)!;
  return silhouettes.sheets[t.sheet as keyof typeof silhouettes.sheets][t.cell];
}
/** The real-world box of a silhouette whose measured side is `value`. */
function shape(kind: SizeKind, id: string, value: number): Shape {
  const m = measure(kind, id);
  const box = kind === 'country' ? bounds(id) : cell(id);
  const aspect = box.w / box.h;
  return {
    kind,
    id,
    real:
      m.axis === 'w'
        ? { w: value, h: value / aspect }
        : { w: value * aspect, h: value },
  };
}
function Silhouette({
  s,
  scale,
  className = '',
  style,
}: {
  s: Shape;
  scale: number;
  className?: string;
  style?: CSSProperties;
}) {
  const w = s.real.w * scale,
    h = s.real.h * scale;
  if (s.kind === 'country') {
    const b = bounds(s.id);
    return (
      <svg
        className={`size-sil ${className}`}
        style={{ width: w, height: h, ...style }}
        viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={country(s.id)!.path} />
      </svg>
    );
  }
  const t = thing(s.id)!,
    c = cell(s.id),
    k = w / c.w;
  return (
    <span
      className={`size-sil ${className}`}
      style={
        {
          width: w,
          height: h,
          '--sheet': `url(/art/optimized/sizes-sil-${t.sheet}-v1.webp)`,
          maskSize: `${silhouettes.size * k}px ${silhouettes.size * k}px`,
          WebkitMaskSize: `${silhouettes.size * k}px ${silhouettes.size * k}px`,
          maskPosition: `${-c.x * k}px ${-c.y * k}px`,
          WebkitMaskPosition: `${-c.x * k}px ${-c.y * k}px`,
          ...style,
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}
const name = (kind: SizeKind, id: string) => {
  if (kind === 'country') {
    const n = country(id)!.name;
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return thing(id)!.name;
};
const sub = (kind: SizeKind, id: string) =>
  kind === 'country' ? undefined : thing(id)!.sub;
export function formatSize(v: number, unit: 'm' | 'km') {
  if (unit === 'km')
    return `${(v >= 100 ? Math.round(v) : Number(v.toPrecision(3))).toLocaleString('en')} km`;
  if (v < 1) return `${Number((v * 100).toPrecision(3))} cm`;
  return `${(v >= 100 ? Math.round(v) : Number(v.toPrecision(3))).toLocaleString('en')} m`;
}

/** Board geometry: the reference stands at the left of a ground line; the
 * target stands to its right. `scale` is pixels per real unit. */
function useBoardSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measureNow = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measureNow();
    const o = new ResizeObserver(measureNow);
    o.observe(el);
    return () => o.disconnect();
  }, [ref]);
  return size;
}
const PAD = 28,
  GROUND = 46;
/** A scale that fits these real boxes side by side above the ground line. */
function fit(shapes: Box[], w: number, h: number, gapFactor = 0.18) {
  const tallest = Math.max(...shapes.map((s) => s.h)),
    wide =
      shapes.reduce((sum, s) => sum + s.w, 0) +
      gapFactor * Math.max(...shapes.map((s) => s.w)) * (shapes.length - 1);
  return Math.min((h - GROUND - PAD * 1.6) / tallest, (w - PAD * 2) / wide);
}

export function SizeTable({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: SizeGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  if (g.phase !== 'guess')
    return (
      <Reveal
        key={`${g.round}:${g.step}`}
        g={g}
        viewer={viewer}
        disabled={disabled}
        commit={commit}
        canAdvance={canAdvance}
        hostName={hostName}
      />
    );
  return (
    <Guessing
      key={g.round}
      g={g}
      viewer={viewer}
      disabled={disabled}
      commit={commit}
    />
  );
}

const stepNames = ['Animal', 'Thing', 'Country'];
/** The guessing phase: all three comparisons, in any order, then one lock.
 * Sizes you set but have not sent yet survive switching between them. */
function Guessing({
  g,
  viewer,
  disabled,
  commit,
}: {
  g: SizeGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [drafts, setDrafts] = useState<(number | null)[]>(() =>
    Array(g.questions.length).fill(null),
  );
  const spectator = viewer < 0 || viewer >= g.seats.length;
  const mine = spectator ? null : g.guesses[viewer];
  const sized = (i: number) => drafts[i] ?? mine?.values[i] ?? null;
  const draft = (i: number, v: number) =>
    setDrafts((d) => d.map((x, j) => (j === i ? v : x)));
  return (
    <Comparison
      key={selected}
      g={g}
      step={selected}
      viewer={viewer}
      disabled={disabled}
      commit={commit}
      draft={sized(selected)}
      onDraft={(v) => draft(selected, v)}
      steps={
        <SabiSteps
          steps={stepNames}
          current={selected}
          label="Your sizes"
          done={(i) => sized(i) !== null}
          onSelect={setSelected}
        />
      }
      onNext={(v) => {
        draft(selected, v);
        const next = g.questions
          .map((_, o) => (selected + o + 1) % g.questions.length)
          .find((i) => i !== selected && sized(i) === null);
        if (next !== undefined) setSelected(next);
      }}
      canLock={g.questions.every((_, i) => i === selected || sized(i) !== null)}
      onLock={(v) =>
        commit({
          type: 'lock',
          values: g.questions.map((_, i) =>
            i === selected ? v : (sized(i) as number),
          ),
        })
      }
    />
  );
}

function Comparison({
  g,
  step,
  viewer,
  disabled,
  commit,
  draft,
  onDraft,
  steps,
  onNext,
  canLock,
  onLock,
}: {
  g: SizeGame;
  step: number;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  draft: number | null;
  onDraft: (v: number) => void;
  steps: ReactNode;
  onNext: (v: number) => void;
  canLock: boolean;
  onLock: (v: number) => void;
}) {
  const q: SizeQuestion = g.questions[step];
  const spectator = viewer < 0 || viewer >= g.seats.length;
  const mine = spectator ? null : g.guesses[viewer];
  const locked = !!mine?.locked,
    live = !disabled && !spectator && !locked;
  const refM = measure(q.kind, q.ref),
    tarM = measure(q.kind, q.target);
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useBoardSize(boardRef);
  const refShape = shape(q.kind, q.ref, refM.real);
  // The target starts as tall as the reference's longest side, which says
  // nothing about the answer.
  const unit = shape(q.kind, q.target, 1).real;
  const start = tidy(
    (Math.max(refShape.real.w, refShape.real.h) * 0.8) /
      Math.max(unit.w, unit.h),
  );
  const [value, setValue] = useState<number>(draft ?? start);
  const target = shape(q.kind, q.target, value);
  // Zoom: a factor on top of the scale that fits the reference and the
  // target's start size.
  const base =
    board.w && board.h
      ? fit(
          [refShape.real, shape(q.kind, q.target, start).real],
          board.w,
          board.h,
        )
      : 1;
  const [zoom, setZoom] = useState(1);
  const scale = base * zoom;
  const gap = Math.max(refShape.real.w, refShape.real.h * 0.4) * 0.18;
  const [offset, setOffset] = useState<number | null>(null);
  // Target's left edge, in real units from the reference's left edge.
  const left = offset ?? refShape.real.w + gap;
  const groundY = board.h - GROUND;
  const toPx = (x: number) => PAD + x * scale;

  // Pointer handling: drag the body to move, a corner to resize, two
  // fingers to pinch. Nothing is sent until the gesture ends.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | null
    | { type: 'move'; x: number; left: number }
    | { type: 'resize'; value: number }
    | { type: 'pinch'; d: number; value: number }
  >(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const clamp = (v: number) =>
    tidy(Math.min(guessRange[1], Math.max(guessRange[0], v)));
  function settle(v: number) {
    const c = clamp(v);
    setValue(c);
    latest.current = c;
    // A silhouette pulled past the mat's edge zooms the mat out to keep it.
    const s = shape(q.kind, q.target, c).real;
    const room = Math.min(
      (board.h - GROUND - PAD) / (s.h * scale),
      (board.w - PAD - toPx(left)) / (s.w * scale),
    );
    if (room < 1) setZoom((z) => Math.max(1 / 40, z * room * 0.9));
    if (live) {
      onDraft(c);
      commit({ type: 'guess', step, value: c });
    }
  }
  function local(e: ReactPointerEvent) {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: ReactPointerEvent, type: 'move' | 'resize') {
    if (!live) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        type: 'pinch',
        d: Math.hypot(a.x - b.x, a.y - b.y),
        value: latest.current,
      };
    } else
      gesture.current =
        type === 'move'
          ? { type, x: p.x, left }
          : { type, value: latest.current };
  }
  function move(e: ReactPointerEvent) {
    const gst = gesture.current;
    if (!gst || !pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (gst.type === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gst.d > 0) setValue(clamp((gst.value * d) / gst.d));
    } else if (gst.type === 'move') {
      setOffset(Math.max(0, gst.left + (p.x - gst.x) / scale));
    } else if (gst.type === 'resize') {
      // Scale so the corner follows the pointer, keeping the shape.
      const unit = shape(q.kind, q.target, gst.value).real;
      const fx = (p.x - toPx(left)) / (unit.w * scale),
        fy = (groundY - p.y) / (unit.h * scale);
      const f = Math.max(0.02, Math.max(fx, fy));
      setValue(clamp(gst.value * f));
    }
  }
  function up(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const gst = gesture.current;
    if (!gst) return;
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (gst.type !== 'move') settle(latest.current);
    } else if (gst.type === 'pinch') {
      gesture.current = null;
      settle(latest.current);
    }
  }
  function key(e: KeyboardEvent) {
    if (!live) return;
    const step = e.shiftKey ? 1.25 : 1.05;
    if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=')
      settle(value * step);
    else if (e.key === 'ArrowDown' || e.key === '-') settle(value / step);
    else if (e.key === 'ArrowRight') setOffset(left + 20 / scale);
    else if (e.key === 'ArrowLeft') setOffset(Math.max(0, left - 20 / scale));
    else return;
    e.preventDefault();
  }

  const tpx = { w: target.real.w * scale, h: target.real.h * scale };

  return (
    <section className="sabi-stage size-stage">
      <div ref={boardRef} className="sabi-board size-board">
        {board.w > 0 && (
          <>
            <span className="size-ground" style={{ top: groundY }} />
            <div
              className="size-thing is-ref"
              style={{ left: toPx(0), top: groundY - refShape.real.h * scale }}
            >
              <Silhouette s={refShape} scale={scale} />
              <small style={{ top: refShape.real.h * scale + 8 }}>
                {name(q.kind, q.ref)}
              </small>
            </div>
            {!spectator && (
              <div
                className={`size-thing is-target ${live ? 'is-live' : ''} ${locked ? 'is-locked' : ''}`}
                style={{ left: toPx(left), top: groundY - tpx.h }}
                role="slider"
                tabIndex={live ? 0 : -1}
                aria-label={`${name(q.kind, q.target)} size`}
                aria-disabled={!live}
                aria-valuenow={value}
                aria-valuetext={formatSize(value, tarM.unit)}
                onKeyDown={key}
                onPointerDown={(e) => down(e, 'move')}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              >
                <Silhouette s={target} scale={scale} />
                {live && (
                  <>
                    <span className="size-frame" />
                    <span
                      className="size-handle"
                      onPointerDown={(e) => down(e, 'resize')}
                      aria-hidden="true"
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
        <div className="size-zoom">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(8, z * 1.5))}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(1 / 40, z / 1.5))}
          >
            <Minus size={18} />
          </button>
        </div>
      </div>
      <aside className="sabi-card size-card">
        {steps}
        <Legend q={q} />
        {!spectator && (
          <div className="sabi-actions">
            <output className="size-readout">
              {formatSize(value, tarM.unit)}
            </output>
            {locked ? (
              <button
                type="button"
                className="party-locked"
                disabled={disabled}
                onClick={() => commit({ type: 'unlock' })}
              >
                <Unlock size={16} />
                Locked
              </button>
            ) : canLock ? (
              <button
                type="button"
                className="party-primary"
                disabled={!live}
                onClick={() => onLock(clamp(value))}
              >
                <LockKeyhole size={16} />
                Lock
              </button>
            ) : (
              <button
                type="button"
                className="party-primary"
                disabled={!live}
                onClick={() => {
                  const c = clamp(value);
                  if (c !== mine?.values[step])
                    commit({ type: 'guess', step, value: c });
                  onNext(c);
                }}
              >
                <ArrowRight size={16} />
                Next
              </button>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}

function Legend({ q }: { q: SizeQuestion }) {
  const tarM = measure(q.kind, q.target);
  return (
    <ul className="size-legend">
      <li className="is-ref">
        <i />
        <span>
          <b>{name(q.kind, q.ref)}</b>
          {sub(q.kind, q.ref) && <em> {sub(q.kind, q.ref)}</em>}
        </span>
      </li>
      <li className="is-target">
        <i />
        <span>
          <b>{name(q.kind, q.target)}</b>
          {sub(q.kind, q.target) && <em> {sub(q.kind, q.target)}</em>}
          <small>{tarM.dimension}</small>
        </span>
      </li>
    </ul>
  );
}

/** Narrowest slot in the lineup, so every name fits under its silhouette. */
const SLOT = 64,
  SLOT_GAP = 12;
/** The reveal: the reference, the true size in gold, then every player's
 * guess in their colour, best first, each with the true size laid over it.
 * Hovering or tapping a player (on the mat or in the list) singles them out. */
function Reveal({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: SizeGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
}) {
  const step = g.step;
  const q: SizeQuestion = g.questions[step];
  const spectator = viewer < 0 || viewer >= g.seats.length;
  const tarM = measure(q.kind, q.target);
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useBoardSize(boardRef);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const shown = pinned ?? focus;
  const refShape = shape(q.kind, q.ref, measure(q.kind, q.ref).real);
  const answer = shape(q.kind, q.target, Math.max(q.answer, guessRange[0]));
  const rows = g.seats
    .map((seat, s) => ({
      s,
      seat,
      value: g.guesses[s].values[step],
      gain: g.gains[step]?.[s] ?? 0,
    }))
    .sort((a, b) => b.gain - a.gain || a.s - b.s);
  const guesses = rows.flatMap((r) =>
    r.value ? [{ ...r, shape: shape(q.kind, q.target, r.value) }] : [],
  );
  // A wild guess is cropped to its slot; the lineup fits the rest.
  const cap = (b: Box) => ({
    w: Math.min(b.w, answer.real.w * 3.5),
    h: Math.min(b.h, answer.real.h * 3.5),
  });
  const boxes = [
    refShape.real,
    answer.real,
    ...guesses.map((x) => x.shape.real),
  ];
  const capped = boxes.map(cap);
  // On a narrow mat the slots shrink so the whole lineup still fits.
  const pad = board.w < 480 ? 12 : PAD,
    slotGap = board.w < 480 ? 6 : SLOT_GAP,
    room = board.w - pad * 2 - slotGap * (boxes.length - 1),
    slotMin = Math.min(SLOT, room / boxes.length);
  const scale = (() => {
    if (!board.w || !board.h) return 1;
    const tall =
      (board.h - GROUND - PAD * 1.6) / Math.max(...capped.map((b) => b.h));
    const width = (k: number) =>
      capped.reduce((sum, b) => sum + Math.max(slotMin, b.w * k), 0);
    if (width(tall) <= room) return tall;
    let lo = 0,
      hi = tall;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (width(mid) <= room) lo = mid;
      else hi = mid;
    }
    return lo;
  })();
  const groundY = board.h - GROUND;
  let x = pad;
  const slots = capped.map((b) => {
    const w = Math.max(slotMin, b.w * scale),
      at = x;
    x += w + slotGap;
    return { left: at, width: w };
  });
  // Centre the lineup when it is narrower than the mat.
  const shift = Math.max(0, (board.w - pad - x + slotGap) / 2);
  const my = spectator ? null : g.guesses[viewer].values[step];
  const myPoints = spectator ? 0 : (g.gains[step]?.[viewer] ?? 0);
  const color = (s: number) => seatColors[s % seatColors.length];
  const toggle = (s: number) => setPinned((p) => (p === s ? null : s));
  const hover = (s: number | null) => ({
    onPointerEnter: (e: ReactPointerEvent) =>
      e.pointerType === 'mouse' && setFocus(s),
    onPointerLeave: (e: ReactPointerEvent) =>
      e.pointerType === 'mouse' && setFocus(null),
  });

  return (
    <section
      className={`sabi-stage size-stage is-revealed ${shown !== null ? 'has-focus' : ''}`}
    >
      <div ref={boardRef} className="sabi-board size-board">
        {board.w > 0 && (
          <>
            <span className="size-ground" style={{ top: groundY }} />
            <div
              className="size-slot is-ref"
              style={{ left: slots[0].left + shift, width: slots[0].width }}
            >
              <div
                className="size-thing is-ref"
                style={{ top: groundY - refShape.real.h * scale }}
              >
                <Silhouette s={refShape} scale={scale} />
              </div>
              <small style={{ top: groundY + 8 }}>{name(q.kind, q.ref)}</small>
            </div>
            <div
              className="size-slot is-answer reveal-rise"
              style={{
                left: slots[1].left + shift,
                width: slots[1].width,
                ...stagger(0, 150),
              }}
            >
              <div
                className="size-thing is-truth"
                style={{ top: groundY - answer.real.h * scale }}
              >
                <Silhouette s={answer} scale={scale} />
              </div>
              <small style={{ top: groundY + 8 }}>
                <b>{formatSize(q.answer, tarM.unit)}</b>
              </small>
            </div>
            {guesses.map((r, i) => {
              const slot = slots[i + 2];
              return (
                <button
                  key={r.s}
                  type="button"
                  className={`size-slot is-guess reveal-rise ${shown === r.s ? 'is-focus' : ''} ${r.s === viewer ? 'is-you' : ''}`}
                  style={{
                    left: slot.left + shift,
                    width: slot.width,
                    ...stagger(i, 450, 140),
                    ['--seat' as string]: color(r.s),
                  }}
                  aria-pressed={pinned === r.s}
                  aria-label={`${r.seat}: ${formatSize(r.value!, tarM.unit)}, ${r.gain} points`}
                  onClick={() => toggle(r.s)}
                  {...hover(r.s)}
                >
                  <span
                    className={`size-clip ${capped[i + 2].w < r.shape.real.w || capped[i + 2].h < r.shape.real.h ? 'is-over' : ''}`}
                    style={{ height: groundY }}
                  >
                    <span
                      className="size-thing is-guess"
                      style={{ top: groundY - r.shape.real.h * scale }}
                    >
                      <Silhouette s={r.shape} scale={scale} />
                    </span>
                    <span
                      className="size-thing is-ghost"
                      style={{ top: groundY - answer.real.h * scale }}
                    >
                      <Silhouette s={answer} scale={scale} />
                    </span>
                  </span>
                  <small style={{ top: groundY + 8 }}>
                    <i />
                    {r.seat}
                    <em>{formatSize(r.value!, tarM.unit)}</em>
                  </small>
                </button>
              );
            })}
          </>
        )}
        {!spectator && (
          <div className="size-score" aria-live="polite">
            <p
              className={`size-points reveal-pop ${myPoints >= 90 ? 'reveal-burst' : ''}`}
            >
              <CountUp value={myPoints} duration={1100} delay={300} />
              <small>/100</small>
            </p>
            {my !== null && (
              <dl className="reveal-rise" style={stagger(0, 1400)}>
                <div>
                  <dt>Off</dt>
                  <dd>{Math.round(offBy(my, q.answer) * 100)}%</dd>
                </div>
              </dl>
            )}
          </div>
        )}
      </div>
      <aside className="sabi-card size-card">
        <SabiSteps steps={stepNames} current={step} done={(i) => i <= step} />
        <Legend q={q} />
        {q.kind === 'thing' && (
          <p className="size-fact reveal-rise" style={stagger(0, 600)}>
            {thing(q.target)!.fact}
          </p>
        )}
        <ol className="sabi-results">
          {rows.map((r, i) => (
            <li
              key={r.s}
              className={`reveal-rise ${r.gain >= 90 ? 'is-perfect' : ''} ${r.s === viewer ? 'is-you' : ''} ${shown === r.s ? 'is-focus' : ''}`}
              style={stagger(i, 700, 140)}
            >
              <button
                type="button"
                aria-pressed={pinned === r.s}
                onClick={() => toggle(r.s)}
                {...hover(r.s)}
              >
                <i style={{ background: color(r.s) }} aria-hidden="true" />
                <b>{r.seat}</b>
                <span>{r.value ? formatSize(r.value, tarM.unit) : '—'}</span>
                <strong className="reveal-pop" style={stagger(i, 1100, 140)}>
                  +{r.gain}
                </strong>
              </button>
            </li>
          ))}
        </ol>
        {!spectator &&
          (canAdvance ? (
            <div className="sabi-actions">
              <button
                type="button"
                className="party-primary"
                disabled={disabled}
                onClick={() => commit({ type: 'next' })}
              >
                Next
              </button>
            </div>
          ) : (
            <p className="party-host-wait">{hostName ?? 'The host'} moves on</p>
          ))}
      </aside>
    </section>
  );
}
