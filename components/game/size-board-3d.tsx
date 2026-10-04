'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The tape is a vertical log-scale size control with its own drag and keys. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { LocateFixed, MoveDiagonal } from 'lucide-react';
import type { SizeKind } from '@/lib/games/party/size';
import { hasWebGL, pieceBox, SizeScene, type PieceSpec } from './size-scene';

/** Whether the 3D table can be drawn here; the flat board is the fallback. */
export function useWebGL() {
  return useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => false,
  );
}
const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

function create(el: HTMLElement, flat: boolean, padRight: number) {
  try {
    return new SizeScene(el, { flat, reduced: reducedMotion(), padRight });
  } catch {
    return null;
  }
}

/** Creates the scene when its host mounts and tears it down with it. */
function useScene(flat: boolean, padRight = 0) {
  const [scene, setScene] = useState<SizeScene | null>(null);
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const s = create(el, flat, padRight);
      if (!s) return;
      setScene(s);
      return () => {
        s.dispose();
        setScene(null);
      };
    },
    [flat, padRight],
  );
  return { attach, scene };
}

const GAP = 0.3;

/** The guessing table: the cream reference and the tomato piece on the
 * mat, seen from one fixed angle. Drag either piece to move it, and size the tomato piece with its corner knob, the tape on the right,
 * the wheel or a pinch. `size` is its longest side in reference units. */
export function SizeBoard3D({
  kind,
  refItem,
  targetItem,
  refName,
  targetName,
  size,
  range,
  live,
  showTarget,
  onSize,
  children,
}: {
  kind: SizeKind;
  refItem: string;
  targetItem: string;
  refName: string;
  targetName: string;
  size: number;
  range: readonly [number, number];
  live: boolean;
  showTarget: boolean;
  /** A new size; `done` once the gesture that set it ends. */
  onSize: (size: number, done: boolean) => void;
  children?: ReactNode;
}) {
  const flat = kind === 'country';
  const { attach, scene } = useScene(flat, 64);
  const refBox = pieceBox(kind, refItem),
    tBox = pieceBox(kind, targetItem);
  const [place, setPlace] = useState(() => ({
    ref: { x: -refBox.x / 2 - GAP / 2, z: 0 },
    // The target's left edge stays put while it grows.
    target: { left: GAP / 2, z: 0 },
  }));
  const clamp = (r: number) => Math.min(range[1], Math.max(range[0], r));
  const latest = useRef({ size, onSize, live });
  useEffect(() => {
    latest.current = { size, onSize, live };
  });
  // Wheel and pinch settle a moment after they stop.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function nudge(f: number) {
    const { size: s, onSize: set, live: on } = latest.current;
    if (!on) return;
    const next = clamp(s * f);
    set(next, false);
    latest.current.size = next;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => set(latest.current.size, true), 280);
  }
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!scene) return;
    const pieces: PieceSpec[] = [
      {
        key: 'ref',
        kind,
        item: refItem,
        size: 1,
        x: place.ref.x,
        z: place.ref.z,
        finish: 'cream',
        movable: true,
      },
    ];
    if (showTarget)
      pieces.push({
        key: 'target',
        kind,
        item: targetItem,
        size,
        x: place.target.left + (tBox.x * size) / 2,
        z: place.target.z,
        finish: 'enamel',
        movable: live,
        front: true,
      });
    scene.setPieces(pieces);
  }, [scene, kind, refItem, targetItem, size, place, live, showTarget, tBox.x]);

  useEffect(() => {
    if (!scene) return;
    scene.listen({
      onMove: (key, x, z) =>
        setPlace((p) =>
          key === 'ref'
            ? { ...p, ref: { x, z } }
            : {
                ...p,
                target: { left: x - (tBox.x * latest.current.size) / 2, z },
              },
        ),
      onWheel: (f) => nudge(f),
      onPinch: (f, done) => {
        if (done) latest.current.onSize(latest.current.size, true);
        else nudge(f);
      },
    });
  });

  // The corner knob: drag it away from the piece's foot to grow it.
  const knob = useRef<HTMLSpanElement>(null),
    refLabel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!scene) return;
    scene.anchor(refLabel.current, 'ref', 'base');
    if (showTarget) scene.anchor(knob.current, 'target', 'corner');
    const k = knob.current,
      l = refLabel.current;
    return () => {
      scene.unanchor(k);
      scene.unanchor(l);
    };
  }, [scene, showTarget, live]);
  const drag = useRef<{
    id: number;
    foot: { x: number; y: number };
    dir: { x: number; y: number };
    len: number;
    size: number;
  } | null>(null);
  function local(e: ReactPointerEvent) {
    const r = (e.currentTarget as Element)
      .closest('.size-board')!
      .getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function knobDown(e: ReactPointerEvent<HTMLSpanElement>) {
    if (!scene || !live) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const foot = scene.screenOf('target', 'foot'),
      corner = scene.screenOf('target', 'corner');
    if (!foot || !corner) return;
    const dx = corner.x - foot.x,
      dy = corner.y - foot.y,
      len = Math.hypot(dx, dy) || 1;
    scene.freeze(true);
    drag.current = {
      id: e.pointerId,
      foot,
      dir: { x: dx / len, y: dy / len },
      len,
      size,
    };
  }
  function knobMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = local(e);
    // Along the line from the foot through the corner, so the knob stays
    // under the finger.
    const along = (p.x - d.foot.x) * d.dir.x + (p.y - d.foot.y) * d.dir.y;
    onSize(clamp(d.size * Math.max(0.02, along / d.len)), false);
  }
  function knobUp(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    scene?.freeze(false);
    onSize(latest.current.size, true);
  }

  return (
    <div
      ref={attach}
      className={`sabi-board size-board size-board-3d ${flat ? 'is-flat' : ''}`}
    >
      <small ref={refLabel} className="size-3d-label is-ref">
        {refName}
      </small>
      {showTarget && (
        <span
          ref={knob}
          className={`size-knob ${live ? 'is-live' : ''}`}
          aria-hidden="true"
          onPointerDown={knobDown}
          onPointerMove={knobMove}
          onPointerUp={knobUp}
          onPointerCancel={knobUp}
        >
          <MoveDiagonal
            className="size-knob-arrows"
            size={18}
            strokeWidth={3}
          />
        </span>
      )}
      {showTarget && (
        <SizeTape
          size={size}
          range={range}
          live={live}
          label={`${targetName} size`}
          valueText={`${Math.round(size * 100)}% of the ${refName}`}
          onSize={onSize}
        />
      )}
      <button
        type="button"
        className="size-recentre"
        aria-label="Put the pieces back"
        onClick={() => {
          setPlace({
            ref: { x: -refBox.x / 2 - GAP / 2, z: 0 },
            target: { left: GAP / 2, z: 0 },
          });
        }}
      >
        <LocateFixed size={18} />
      </button>
      {children}
    </div>
  );
}

/** The tape measure along the right edge: the tomato tab slides up to grow
 * the piece, on a log scale so small and huge sizes are equally easy. */
function SizeTape({
  size,
  range,
  live,
  label,
  valueText,
  onSize,
}: {
  size: number;
  range: readonly [number, number];
  live: boolean;
  label: string;
  valueText: string;
  onSize: (size: number, done: boolean) => void;
}) {
  const track = useRef<HTMLDivElement>(null),
    held = useRef<number | null>(null),
    grip = useRef(0);
  const lo = Math.log(range[0]),
    hi = Math.log(range[1]);
  const pos = (Math.log(size) - lo) / (hi - lo);
  const at = (e: ReactPointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    const t = 1 - (e.clientY - r.top) / r.height + grip.current;
    return Math.exp(lo + Math.min(1, Math.max(0, t)) * (hi - lo));
  };
  function key(e: KeyboardEvent) {
    if (!live) return;
    const f =
      e.key === 'ArrowUp' || e.key === 'ArrowRight'
        ? e.shiftKey
          ? 1.25
          : 1.04
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
          ? e.shiftKey
            ? 1 / 1.25
            : 1 / 1.04
          : e.key === 'PageUp'
            ? 1.5
            : e.key === 'PageDown'
              ? 1 / 1.5
              : null;
    let next: number | null = f ? size * f : null;
    if (e.key === 'Home') next = range[0];
    if (e.key === 'End') next = range[1];
    if (next === null) return;
    e.preventDefault();
    onSize(Math.min(range[1], Math.max(range[0], next)), true);
  }
  return (
    <div
      className={`size-tape ${live ? 'is-live' : ''}`}
      role="slider"
      tabIndex={live ? 0 : -1}
      aria-label={label}
      aria-orientation="vertical"
      aria-disabled={!live}
      aria-valuemin={range[0]}
      aria-valuemax={range[1]}
      aria-valuenow={Number(size.toPrecision(3))}
      aria-valuetext={valueText}
      onKeyDown={key}
    >
      <div
        ref={track}
        className="size-tape-track"
        onPointerDown={(e) => {
          if (!live || (e.pointerType === 'mouse' && e.button !== 0)) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          held.current = e.pointerId;
          grip.current = 0;
          if ((e.target as Element).closest('.size-tape-tab')) {
            const r = e.currentTarget.getBoundingClientRect();
            grip.current = pos - (1 - (e.clientY - r.top) / r.height);
          }
          onSize(at(e), false);
        }}
        onPointerMove={(e) =>
          held.current === e.pointerId && onSize(at(e), false)
        }
        onPointerUp={(e) => {
          if (held.current !== e.pointerId) return;
          held.current = null;
          onSize(at(e), true);
        }}
        onPointerCancel={() => (held.current = null)}
      >
        <span className="size-tape-fill" style={{ height: `${pos * 100}%` }} />
        <span
          className="size-tape-mark"
          style={{ bottom: `${((0 - lo) / (hi - lo)) * 100}%` }}
          aria-hidden="true"
        />
        <span
          className="size-tape-tab"
          style={{ bottom: `${pos * 100}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

export type LineupPiece = {
  key: string;
  item: string;
  size: number;
  finish: PieceSpec['finish'];
  color?: string;
  delay?: number;
  label: ReactNode;
  /** The seat this piece belongs to, for focusing. */
  seat?: number;
};

/** The reveal: the reference, the true size in gold and every guess in its
 * player's colour, rising out of the mat in a row. Hovering or tapping a
 * guess (or its label) singles it out. */
export function SizeLineup3D({
  kind,
  pieces,
  cap,
  focus,
  onHover,
  onToggle,
  children,
}: {
  kind: SizeKind;
  pieces: LineupPiece[];
  /** Framing ignores anything beyond this size. */
  cap: number;
  focus: number | null;
  onHover: (seat: number | null) => void;
  onToggle: (seat: number) => void;
  children?: ReactNode;
}) {
  const flat = kind === 'country';
  const { attach, scene } = useScene(flat);
  const labels = useRef(new Map<string, HTMLElement>());
  // Slots by capped width, so a wild guess cannot push the others away.
  const gap = 0.22;
  let x = 0;
  const xs = pieces.map((p) => {
    const w = Math.max(0.28, pieceBox(kind, p.item).x * Math.min(p.size, cap));
    const at = x + w / 2;
    x += w + gap;
    return at;
  });
  const mid = (x - gap) / 2;
  const seatOf = (key: string | null) =>
    pieces.find((p) => p.key === key)?.seat ?? null;
  useEffect(() => {
    if (!scene) return;
    scene.setPieces(
      pieces.map((p, i) => ({
        key: p.key,
        kind,
        item: p.item,
        size: p.size,
        x: xs[i] - mid,
        z: 0,
        finish: p.finish,
        color: p.color,
        delay: p.delay,
        dim: focus !== null && p.seat !== undefined && p.seat !== focus,
      })),
    );
    scene.frame(null, cap);
  });
  useEffect(() => {
    if (!scene) return;
    scene.listen({
      onHover: (key) => onHover(seatOf(key)),
      onTap: (key) => {
        const s = seatOf(key);
        if (s !== null) onToggle(s);
      },
    });
  });
  useEffect(() => {
    if (!scene) return;
    for (const [key, el] of labels.current) scene.anchor(el, key, 'base');
  }, [scene, pieces.length]);
  return (
    <div
      ref={attach}
      className={`sabi-board size-board size-board-3d is-revealed ${flat ? 'is-flat' : ''}`}
    >
      {pieces.map((p) => (
        <span
          key={p.key}
          ref={(el) => {
            if (el) labels.current.set(p.key, el);
            else labels.current.delete(p.key);
          }}
          className={`size-3d-label is-${p.finish} ${p.seat !== undefined && focus === p.seat ? 'is-focus' : ''} ${focus !== null && p.seat !== undefined && p.seat !== focus ? 'is-dim' : ''}`}
          style={{ '--seat': p.color } as CSSProperties}
        >
          {p.label}
        </span>
      ))}
      {children}
    </div>
  );
}
