'use client';
import {
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  begin,
  travel,
  hold,
  release,
  HOLD_MS,
  type Gesture,
} from '@/lib/games/trio/gesture';
export type Inspection = { title: string; art?: ReactNode; body: ReactNode };
export type Inspect = (item: Inspection, source?: HTMLElement) => void;
export function Piece({
  children,
  label,
  className = '',
  style,
  inspect,
  onTap,
  onDrop,
  onLift,
  draggable = false,
  cardId,
  selected = false,
  coachId,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  style?: CSSProperties;
  inspect: () => void;
  onTap?: () => void;
  onDrop?: (x: number, y: number) => void;
  onLift?: () => void;
  draggable?: boolean;
  cardId?: number;
  selected?: boolean;
  coachId?: string;
}) {
  const gesture = useRef<Gesture | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    button = useRef<HTMLButtonElement>(null),
    suppress = useRef(false);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  function clear() {
    clearTimeout(timer.current);
    timer.current = undefined;
  }
  function cancel() {
    clear();
    gesture.current = null;
    suppress.current = true;
    setOffset(null);
  }
  useEffect(() => {
    function multi(e: PointerEvent) {
      if (gesture.current && e.pointerId !== gesture.current.pointer) cancel();
    }
    document.addEventListener('pointerdown', multi, true);
    return () => {
      document.removeEventListener('pointerdown', multi, true);
      clearTimeout(timer.current);
    };
  }, []);
  function down(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    if (!e.isPrimary) {
      cancel();
      return;
    }
    clear();
    suppress.current = false;
    gesture.current = begin(
      e.pointerId,
      e.clientX,
      e.clientY,
      performance.now(),
      draggable,
    );
    e.currentTarget.setPointerCapture(e.pointerId);
    timer.current = setTimeout(() => {
      if (!gesture.current) return;
      gesture.current = hold(gesture.current, performance.now() + 1);
      if (gesture.current.mode === 'inspect') {
        suppress.current = true;
        setOffset(null);
        inspect();
      }
    }, HOLD_MS);
  }
  return (
    <div
      className={`piece-wrap ${offset ? 'is-dragging' : ''}`}
      data-card-id={cardId}
      data-coach={coachId}
      style={{
        ...style,
        ...(offset
          ? {
              transform: `translate(${offset.x}px,${offset.y}px) rotate(0deg)`,
              zIndex: 1000,
            }
          : {}),
      }}
    >
      <button
        ref={button}
        type="button"
        className={`piece ${className} ${selected ? 'selected' : ''}`}
        aria-label={label}
        aria-pressed={selected}
        onPointerDown={down}
        onPointerMove={(e) => {
          let g = gesture.current;
          if (!g || g.pointer !== e.pointerId) return;
          const before = g.mode;
          g = travel(g, e.clientX, e.clientY);
          gesture.current = g;
          if (g.mode !== 'pending') clear();
          if (g.mode === 'drag') {
            e.preventDefault();
            if (before !== 'drag') onLift?.();
            setOffset({ x: e.clientX - g.x, y: e.clientY - g.y });
          }
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.pointer !== e.pointerId) return;
          clear();
          const action = release(g);
          gesture.current = null;
          setOffset(null);
          suppress.current = true;
          if (action === 'tap') onTap?.();
          if (action === 'drop') onDrop?.(e.clientX, e.clientY);
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (gesture.current) cancel();
        }}
        onClick={(e) => {
          if (e.detail === 0 && !suppress.current) onTap?.();
          suppress.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key.toLowerCase() === 'i') {
            e.preventDefault();
            inspect();
          } else if (e.key === 'Escape') cancel();
          else if (e.key === 'Enter' || e.key === ' ') {
            suppress.current = false;
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {children}
      </button>
      <button
        className="inspect-button"
        aria-label={`Inspect ${label}`}
        title="Inspect · hold or press I"
        onClick={inspect}
      >
        i
      </button>
    </div>
  );
}
