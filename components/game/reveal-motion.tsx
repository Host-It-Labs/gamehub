'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import './reveal-motion.css';

/** Shared reveal motion for party results: numbers that count up, and items
 * that drop or pop in one after another. Everything is quick (well under two
 * seconds per reveal) and settles instantly under reduced motion. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Counts from `from` to `to` once per `key`, after `delay` ms. `log` counts
 * along a logarithmic path, so 1 → 2,000 does not sit on four digits the
 * whole time. */
export function useCountUp(
  to: number,
  {
    from = 0,
    duration = 900,
    delay = 0,
    log = false,
    key,
  }: {
    from?: number;
    duration?: number;
    delay?: number;
    log?: boolean;
    key?: unknown;
  } = {},
) {
  const [value, setValue] = useState(from);
  const still = duration <= 0 || prefersReducedMotion();
  useEffect(() => {
    if (still) return;
    let frame = 0;
    const start = performance.now() + delay;
    const lo = log ? Math.log(Math.max(from, 1e-6)) : from,
      hi = log ? Math.log(Math.max(to, 1e-6)) : to;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const v = lo + (hi - lo) * easeOut(t);
      setValue(t >= 1 ? to : log ? Math.exp(v) : v);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `key` restarts the count for a new reveal with the same target.
  }, [to, from, duration, delay, log, key, still]);
  return still ? to : value;
}

/** A number that counts up to its value. Screen readers get the final value. */
export function CountUp({
  value,
  format = (v) => Math.round(v).toLocaleString('en'),
  className,
  ...options
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
} & Parameters<typeof useCountUp>[1]) {
  const shown = useCountUp(value, options);
  return (
    <span className={`count-up ${className ?? ''}`}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** Inline style for the nth item in a staggered entrance. */
export const stagger = (i: number, base = 0, gap = 110): CSSProperties =>
  ({ '--reveal-delay': `${base + i * gap}ms` }) as CSSProperties;
