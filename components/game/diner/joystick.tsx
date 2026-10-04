'use client';
import { useEffect, useRef, type RefObject } from 'react';

/** The stick's current direction: x right, z down the screen, length 0..1. */
export type Stick = { x: number; z: number };

const DEAD = 0.14;

/**
 * A floating joystick: touch anywhere in its zone and the stick appears
 * under your thumb; drag to walk, lift to stop. It follows one pointer only
 * (captured), so a second finger can press Use or Out! at the same time. The
 * direction goes into `stick` (a ref, never React state) and the knob moves
 * by style alone, so nothing re-renders while you walk.
 */
export function Joystick({
  stick,
  disabled = false,
}: {
  stick: RefObject<Stick>;
  disabled?: boolean;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: number; x: number; y: number; r: number } | null>(
    null,
  );

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const rest = () => {
      const r = el.getBoundingClientRect();
      if (base.current) {
        base.current.style.transform = `translate3d(${r.width * 0.5}px, ${r.height * 0.55}px, 0)`;
        base.current.dataset.active = 'false';
      }
      if (knob.current)
        knob.current.style.transform = 'translate3d(-50%, -50%, 0)';
    };
    const release = () => {
      active.current = null;
      stick.current.x = 0;
      stick.current.z = 0;
      rest();
    };
    const down = (e: PointerEvent) => {
      if (disabled || active.current) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const radius = Math.max(38, Math.min(64, r.width * 0.2));
      active.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        r: radius,
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* Synthetic pointers cannot be captured. */
      }
      if (base.current) {
        base.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`;
        base.current.dataset.active = 'true';
      }
    };
    const move = (e: PointerEvent) => {
      const a = active.current;
      if (!a || e.pointerId !== a.id) return;
      e.preventDefault();
      let dx = (e.clientX - a.x) / a.r;
      let dy = (e.clientY - a.y) / a.r;
      const len = Math.hypot(dx, dy);
      // Drag past the rim and the stick follows your thumb.
      if (len > 1.35) {
        const r = el.getBoundingClientRect();
        a.x += (dx / len) * (len - 1.35) * a.r;
        a.y += (dy / len) * (len - 1.35) * a.r;
        if (base.current)
          base.current.style.transform = `translate3d(${a.x - r.left}px, ${a.y - r.top}px, 0)`;
        dx = (e.clientX - a.x) / a.r;
        dy = (e.clientY - a.y) / a.r;
      }
      const l = Math.min(1, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      if (knob.current)
        knob.current.style.transform = `translate3d(calc(-50% + ${Math.cos(ang) * l * a.r}px), calc(-50% + ${Math.sin(ang) * l * a.r}px), 0)`;
      // Past the dead zone the walk eases in, then runs at full speed.
      const strength = l < DEAD ? 0 : Math.min(1, (l - DEAD) / (0.85 - DEAD));
      stick.current.x = Math.cos(ang) * strength;
      stick.current.z = Math.sin(ang) * strength;
    };
    const up = (e: PointerEvent) => {
      if (active.current?.id === e.pointerId) release();
    };
    rest();
    const ro = new ResizeObserver(() => !active.current && rest());
    ro.observe(el);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    return () => {
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
      release();
    };
  }, [stick, disabled]);

  return (
    <div ref={zone} className="diner-stick-zone" aria-hidden="true">
      <div ref={base} className="diner-stick-base">
        <div ref={knob} className="diner-stick-knob" />
      </div>
    </div>
  );
}
