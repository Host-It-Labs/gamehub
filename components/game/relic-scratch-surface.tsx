'use client';
/* eslint-disable jsx-a11y/no-interactive-element-to-noninteractive-role -- This canvas is a custom keyboard-operated scratching application, with instructions and Space/arrow controls. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Crown,
  Diamond,
  Lamp,
  Leaf,
  Moon,
  Shell,
  Star,
  Sun,
} from 'lucide-react';
import {
  brushRadius,
  crownClue,
  lanternWarm,
  MASK_SIDE,
  packFor,
  rubTicket,
  type ScratchPoint,
  type ScratchState,
  type ScratchTicket,
} from '@/lib/games/relic/scratch';
import { formatNumber } from '@/lib/games/relic/engine';
import type { ScratchAudio } from './relic-scratch-audio';
export const ScratchSymbols = [Sun, Moon, Leaf, Star, Shell, Diamond];
const PAIR_MARKS = ['☀', '☾', '❦', '★', '◉', '◆'];
/** The printed hint on each seal's foil, which wears away with the foil. */
function guideFor(ticket: ScratchTicket, index: number) {
  const pack = packFor(ticket.pack),
    cell = ticket.cells[index],
    step = ticket.trail.indexOf(index),
    arrow = cell.direction === 'h' ? '↔' : '↕';
  switch (pack.mechanic) {
    case 'rows':
      return { text: '→', strong: false, warm: false };
    case 'trail':
      return step >= 0
        ? { text: String(step + 1), strong: true, warm: false }
        : { text: '·', strong: false, warm: false };
    case 'pairs':
      return { text: PAIR_MARKS[cell.symbol], strong: true, warm: false };
    case 'grain':
      return { text: arrow, strong: true, warm: false };
    case 'atlas':
      return step >= 0
        ? { text: `${step + 1}${arrow}`, strong: true, warm: false }
        : { text: arrow, strong: false, warm: false };
    case 'lantern':
      return { text: '✦', strong: false, warm: lanternWarm(ticket, index) };
    case 'treasure':
      return {
        text: String(crownClue(ticket, index)),
        strong: true,
        warm: false,
      };
    default:
      return { text: '✦', strong: false, warm: false };
  }
}
type Batch = { points: ScratchPoint[] };
type FoilFlake = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  angle: number;
};
function animateFoil(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  flakes: { current: FoilFlake[] },
  dustFrame: { current: number },
) {
  let previous = performance.now();
  function animate(now: number) {
    const dt = Math.min(2, (now - previous) / 16.67);
    previous = now;
    c.clearRect(0, 0, w, h);
    flakes.current = flakes.current.filter((f) => f.life > 0);
    for (const f of flakes.current) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 0.08 * dt;
      f.life -= 0.03 * dt;
      c.save();
      c.globalAlpha = Math.max(0, f.life);
      c.translate(f.x, f.y);
      c.rotate(f.angle + f.life);
      c.fillStyle = f.angle < 1.5 ? '#e5dcc0' : '#a8b8af';
      c.fillRect(-2, -1, 5, 2);
      c.restore();
    }
    dustFrame.current = flakes.current.length
      ? requestAnimationFrame(animate)
      : 0;
  }
  dustFrame.current = requestAnimationFrame(animate);
}
export function ScratchSurface({
  ticket,
  state,
  audio,
  onStroke,
  onStatus,
  onActivity,
}: {
  ticket: ScratchTicket;
  state: ScratchState;
  audio: ScratchAudio;
  onStroke: (sequence: number, batch: Batch) => Promise<boolean>;
  onStatus: (revealed: number, syncing: boolean) => void;
  onActivity: () => void;
}) {
  const dust = useRef<HTMLCanvasElement>(null),
    dustFrame = useRef(0),
    quietMotion = useRef(false);
  const flakes = useRef<
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      angle: number;
    }[]
  >([]);
  const scatter = useCallback((point: ScratchPoint) => {
    if (quietMotion.current || !dust.current) return;
    const c = dust.current.getContext('2d'),
      w = dust.current.width,
      h = dust.current.height;
    if (!c) return;
    for (let i = 0; i < 2; i++)
      flakes.current.push({
        x: point.x * w,
        y: point.y * h,
        vx: (Math.random() - 0.5) * 2.8,
        vy: -Math.random() * 2 - 0.3,
        life: 1,
        angle: Math.random() * Math.PI,
      });
    flakes.current = flakes.current.slice(-70);
    if (dustFrame.current) return;
    animateFoil(c, w, h, flakes, dustFrame);
  }, []);
  const canvas = useRef<HTMLCanvasElement>(null),
    cursor = useRef<HTMLDivElement>(null);
  const model = useRef(structuredClone(ticket)),
    authoritative = useRef(ticket),
    stateRef = useRef(state);
  const callback = useRef(onStroke),
    status = useRef(onStatus),
    activity = useRef(onActivity);
  const queue = useRef<Batch[]>([]),
    current = useRef<ScratchPoint[]>([]),
    sending = useRef(false);
  const sequence = useRef(ticket.sequence),
    held = useRef<number | null>(null),
    last = useRef<ScratchPoint | null>(null);
  const alive = useRef(true),
    frame = useRef(0),
    keyboard = useRef({ x: 0.5, y: 0.5, down: false });
  const [display, setDisplay] = useState(ticket);
  useEffect(() => {
    authoritative.current = ticket;
    stateRef.current = state;
    callback.current = onStroke;
    status.current = onStatus;
    activity.current = onActivity;
  }, [ticket, state, onStroke, onStatus, onActivity]);
  const pack = packFor(ticket.pack);
  const paint = useCallback(() => {
    const element = canvas.current,
      c = element?.getContext('2d');
    if (!element || !c) return;
    const rect = element.getBoundingClientRect(),
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr),
      h = Math.round(rect.height * dpr);
    if (!w || !h) return;
    if (element.width !== w || element.height !== h) {
      element.width = w;
      element.height = h;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    if (
      dust.current &&
      (dust.current.width !== w || dust.current.height !== h)
    ) {
      dust.current.width = w;
      dust.current.height = h;
    }
    const p = packFor(model.current.pack),
      cw = w / p.columns,
      ch = h / p.rows;
    model.current.cells.forEach((cell, index) => {
      if (cell.revealed) return;
      const x = ((index % p.columns) + 0.12) * cw,
        y = (Math.floor(index / p.columns) + 0.12) * ch,
        width = cw * 0.76,
        height = ch * 0.76,
        guide = guideFor(model.current, index);
      c.save();
      c.beginPath();
      c.roundRect(x, y, width, height, Math.min(cw, ch) * 0.075);
      c.clip();
      const gradient = c.createLinearGradient(
        x,
        y,
        x + width * 0.7,
        y + height,
      );
      const warm = guide.warm;
      gradient.addColorStop(0, warm ? '#f3d9a0' : '#e1d9be');
      gradient.addColorStop(0.36, warm ? '#d6a35a' : '#aab6af');
      gradient.addColorStop(0.52, warm ? '#f6e2b4' : '#e8e2cd');
      gradient.addColorStop(1, warm ? '#b77b35' : '#8a9c98');
      c.fillStyle = gradient;
      c.fillRect(x, y, width, height);
      c.strokeStyle = '#f8f1d755';
      c.lineWidth = dpr;
      for (let stripe = -height; stripe < width + height; stripe += 7 * dpr) {
        c.beginPath();
        c.moveTo(x + stripe, y);
        c.lineTo(x + stripe + height, y + height);
        c.stroke();
      }
      c.fillStyle = guide.strong ? '#4a3a1ee0' : '#526f6975';
      c.font = `${guide.strong ? 700 : 400} ${Math.round(Math.min(ch * 0.3, cw * 0.26))}px Georgia`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(guide.text, x + width / 2, y + height / 2);
      c.globalCompositeOperation = 'destination-out';
      for (let bit = 0; bit < cell.mask.length; bit++)
        if (cell.mask[bit] === '1')
          c.fillRect(
            x + ((bit % MASK_SIDE) * width) / MASK_SIDE - 0.5,
            y + (Math.floor(bit / MASK_SIDE) * height) / MASK_SIDE - 0.5,
            width / MASK_SIDE + 1,
            height / MASK_SIDE + 1,
          );
      c.restore();
    });
  }, []);
  const report = useCallback(() => {
    const busy =
      sending.current || queue.current.length > 0 || current.current.length > 0;
    status.current(model.current.cells.filter((c) => c.revealed).length, busy);
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (alive.current) setDisplay(structuredClone(model.current));
      });
  }, []);
  const drain = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    report();
    while (queue.current.length) {
      const batch = queue.current.shift()!;
      const ok = await callback.current(sequence.current, batch);
      if (!ok) {
        queue.current = [];
        current.current = [];
        held.current = null;
        last.current = null;
        audio.stop();
        model.current = structuredClone(authoritative.current);
        sequence.current = model.current.sequence;
        paint();
        break;
      }
      sequence.current++;
    }
    sending.current = false;
    if (alive.current) report();
  }, [audio, paint, report]);
  const flush = useCallback(
    (continued = false) => {
      if (current.current.length) {
        queue.current.push({ points: current.current });
        current.current = continued && last.current ? [last.current] : [];
        void drain();
      }
    },
    [drain],
  );
  const finish = useCallback(() => {
    held.current = null;
    keyboard.current.down = false;
    flush();
    last.current = null;
    audio.stop();
    if (cursor.current) cursor.current.style.opacity = '0';
  }, [audio, flush]);
  const rub = useCallback(
    (point: ScratchPoint) => {
      if (model.current.claimed || model.current.cells.every((c) => c.revealed))
        return;
      activity.current();
      const points = last.current ? [last.current, point] : [point];
      const count = rubTicket(model.current, stateRef.current, points);
      if (!current.current.length && last.current)
        current.current.push(last.current);
      current.current.push(point);
      const distance = last.current
        ? Math.hypot(point.x - last.current.x, point.y - last.current.y)
        : 0;
      if (distance > 0.0003) scatter(point);
      if (distance > 0.0003)
        audio.scratch(
          distance * 16,
          ['grain', 'atlas'].includes(model.current.pack),
        );
      if (count) audio.cue('reveal', model.current.star);
      last.current = point;
      // Mask calculation is authoritative. The visual cut follows the same geometry.
      const element = canvas.current,
        c = element?.getContext('2d');
      if (element && c) {
        c.save();
        c.setTransform(element.width, 0, 0, element.height, 0, 0);
        c.globalCompositeOperation = 'destination-out';
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.lineWidth = brushRadius(stateRef.current) * 2;
        c.beginPath();
        c.moveTo(points[0].x, points[0].y);
        c.lineTo(point.x, point.y);
        c.stroke();
        c.beginPath();
        c.arc(point.x, point.y, c.lineWidth / 2, 0, Math.PI * 2);
        c.fill();
        const p = packFor(model.current.pack);
        if (count)
          model.current.cells.forEach((cell, index) => {
            if (cell.revealed)
              c.clearRect(
                (index % p.columns) / p.columns,
                Math.floor(index / p.columns) / p.rows,
                1 / p.columns,
                1 / p.rows,
              );
          });
        c.restore();
      }
      report();
      if (current.current.length >= 48) flush(true);
      if (cursor.current) {
        cursor.current.style.left = `${point.x * 100}%`;
        cursor.current.style.top = `${point.y * 100}%`;
        cursor.current.style.opacity = '1';
      }
    },
    [audio, flush, report, scatter],
  );
  useEffect(() => {
    alive.current = true;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      quietMotion.current = motion.matches;
      if (motion.matches) flakes.current = [];
    };
    updateMotion();
    motion.addEventListener('change', updateMotion);
    paint();
    report();
    const resize = new ResizeObserver(paint);
    if (canvas.current) resize.observe(canvas.current);
    const timer = window.setInterval(() => {
      if (current.current.length > 1) flush(true);
    }, 180);
    const visibility = () => {
      if (document.hidden) finish();
    };
    window.addEventListener('blur', finish);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      finish();
      alive.current = false;
      resize.disconnect();
      clearInterval(timer);
      cancelAnimationFrame(dustFrame.current);
      dustFrame.current = 0;
      motion.removeEventListener('change', updateMotion);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      window.removeEventListener('blur', finish);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [finish, flush, paint, report]);
  useEffect(() => {
    if (
      sending.current ||
      queue.current.length ||
      current.current.length ||
      held.current !== null
    )
      return;
    if (ticket.sequence >= model.current.sequence) {
      const changed = ticket.cells.some(
        (cell, i) => cell.mask !== model.current.cells[i].mask,
      );
      model.current = structuredClone(ticket);
      sequence.current = ticket.sequence;
      if (changed) paint();
      report();
    }
  }, [ticket, paint, report]);
  const pointAt = (event: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    };
  };
  return (
    <div
      className={`scratch-field scratch-field-${pack.mechanic}`}
      style={
        {
          '--scratch-columns': pack.columns,
          '--scratch-rows': pack.rows,
        } as React.CSSProperties
      }
    >
      <div className="scratch-seals" aria-hidden="true">
        {display.cells.map((cell, i) => {
          const Symbol =
            cell.special && pack.mechanic === 'lantern'
              ? Lamp
              : cell.special
                ? Crown
                : ScratchSymbols[cell.symbol];
          return (
            <div
              className={`scratch-seal ${cell.revealed ? 'is-revealed' : ''} ${cell.special ? 'is-special' : ''} prize-${Math.min(cell.prize, 12)}`}
              key={i}
            >
              <div className="scratch-prize-symbol">
                <Symbol strokeWidth={1.6} />
                <span>{formatNumber(cell.prize * pack.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="application"
        aria-label={`${pack.name} scratch ticket`}
        aria-describedby="scratch-keyboard-help"
        onPointerDown={(event) => {
          if (event.button !== 0 || held.current !== null || ticket.claimed)
            return;
          event.preventDefault();
          void audio.unlock();
          canvas.current?.focus({ preventScroll: true });
          held.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          last.current = null;
          rub(pointAt(event));
        }}
        onPointerMove={(event) => {
          if (held.current !== event.pointerId) return;
          const samples = event.nativeEvent.getCoalescedEvents?.() ?? [
            event.nativeEvent,
          ];
          for (const sample of samples.length ? samples : [event.nativeEvent])
            rub(pointAt(sample));
        }}
        onPointerUp={(event) => {
          if (held.current === event.pointerId) finish();
        }}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (
            ![
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              ' ',
              'Enter',
              'Escape',
            ].includes(event.key)
          )
            return;
          event.preventDefault();
          if (event.key === 'Escape') {
            finish();
            return;
          }
          void audio.unlock();
          if (event.key === ' ' || event.key === 'Enter')
            keyboard.current.down = true;
          keyboard.current.x = Math.max(
            0.01,
            Math.min(
              0.99,
              keyboard.current.x +
                (event.key === 'ArrowRight'
                  ? 0.028
                  : event.key === 'ArrowLeft'
                    ? -0.028
                    : 0),
            ),
          );
          keyboard.current.y = Math.max(
            0.01,
            Math.min(
              0.99,
              keyboard.current.y +
                (event.key === 'ArrowDown'
                  ? 0.028
                  : event.key === 'ArrowUp'
                    ? -0.028
                    : 0),
            ),
          );
          if (keyboard.current.down)
            rub({ x: keyboard.current.x, y: keyboard.current.y });
          else if (cursor.current) {
            cursor.current.style.left = `${keyboard.current.x * 100}%`;
            cursor.current.style.top = `${keyboard.current.y * 100}%`;
            cursor.current.style.opacity = '1';
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') finish();
        }}
        onBlur={finish}
      />
      <canvas className="scratch-dust" ref={dust} aria-hidden="true" />
      <div
        className="scratch-coin-cursor"
        ref={cursor}
        style={{
          width: `${brushRadius(state) * 200}%`,
          height: `${brushRadius(state) * 200}%`,
        }}
      />
      <span id="scratch-keyboard-help" className="sr-only">
        Hold the mouse button or your finger and rub the foil. Keyboard: move
        with arrow keys; hold Space while moving to scratch. Release Space to
        lift the coin.
      </span>
    </div>
  );
}
