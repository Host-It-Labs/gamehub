'use client';
/* eslint-disable jsx-a11y/no-interactive-element-to-noninteractive-role -- This canvas is a custom keyboard-operated scratching application, with instructions and Space/arrow controls. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  brushRadius,
  MASK_SIDE,
  packFor,
  prizeUnit,
  rubTicket,
  type ScratchPoint,
  type ScratchState,
  type ScratchTicket,
} from '@/lib/games/relic/scratch';
import { levelFor, type Face } from '@/lib/games/relic/books';
import { formatNumber } from '@/lib/games/relic/engine';
import type { ScratchAudio } from './relic-scratch-audio';
import { SYMBOL_SHEET } from './relic-scratch-art';

/** Where each prize symbol sits on the 4×4 sheet. */
const SPRITES: Partial<Record<Face, number>> = {
  seven: 0,
  cherry: 1,
  bell: 2,
  clover: 3,
  coin: 4,
  star: 5,
  moon: 6,
  sun: 7,
  diamond: 8,
  ruby: 9,
  gold: 10,
  dynamite: 11,
  rose: 12,
  ship: 13,
  crown: 14,
  horseshoe: 15,
};
/** Region colours for Crown Jewels, band colours for Ladder (cool to hot). */
const REGIONS = [
  '#e7a7a1',
  '#a9c9e8',
  '#b9dcae',
  '#f1d08a',
  '#cdb4e4',
  '#f2b98c',
  '#a8dcd6',
];
const BANDS = ['#7fc6c4', '#a6d38c', '#f2d36b', '#f2a65a', '#e9725a'];
/** A ladder band's colour, spread from cool to hot whatever the band count. */
function bandColour(t: ScratchTicket, group = 0) {
  const bands = levelFor(t.pack, t.level).count;
  return BANDS[
    Math.round((group * (BANDS.length - 1)) / Math.max(1, bands - 1))
  ];
}
export function Prize({
  face,
  className = '',
}: {
  face: Face;
  className?: string;
}) {
  const at = SPRITES[face];
  if (at === undefined) return null;
  return (
    <i
      className={`scratch-symbol ${className}`}
      style={{
        backgroundImage: `url(${SYMBOL_SHEET})`,
        backgroundPosition: `${(at % 4) * (100 / 3)}% ${Math.floor(at / 4) * (100 / 3)}%`,
      }}
    />
  );
}
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
type Foil = {
  from: string;
  mid: string;
  to: string;
  clue?: string;
  strong?: boolean;
};
function foilFor(t: ScratchTicket, i: number): Foil {
  const cell = t.cells[i],
    mechanic = packFor(t.pack).mechanic;
  const silver: Foil = { from: '#e6e2d6', mid: '#aeb7b4', to: '#8c9a97' };
  switch (mechanic) {
    case 'seven':
      return { from: '#f1e6c8', mid: '#c9ad6e', to: '#9c7b3c' };
    case 'twins':
      return {
        from: '#ebe6f5',
        mid: '#aea3c9',
        to: '#7f73a3',
        clue: ARROWS[cell.dir ?? 0],
        strong: true,
      };
    case 'path':
      return {
        from: '#e5eed6',
        mid: '#a9bd90',
        to: '#7d9665',
        clue: cell.n !== undefined ? String(cell.n) : undefined,
        strong: true,
      };
    case 'ladder': {
      const band = bandColour(t, cell.group);
      return { from: '#f6f2e8', mid: band, to: band };
    }
    case 'mine':
      return { from: '#8c8375', mid: '#5c554b', to: '#3e3a34' };
    case 'sunmoon':
      return { from: '#e9edf5', mid: '#aab4c8', to: '#7d8aa6' };
    case 'chart':
      return { from: '#e2eef0', mid: '#a7c3c8', to: '#7fa1a8' };
    case 'crown': {
      const region = REGIONS[(cell.group ?? 0) % REGIONS.length];
      return { from: '#fbf6ec', mid: region, to: region };
    }
  }
  return silver;
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
/** What a seal shows once it is open. */
function SealFace({
  t,
  i,
  unit,
}: {
  t: ScratchTicket;
  i: number;
  unit: number;
}) {
  const cell = t.cells[i],
    mechanic = packFor(t.pack).mechanic;
  const amount = cell.paid && cell.prize ? formatNumber(cell.prize * unit) : '';
  if (mechanic === 'ladder')
    return (
      <>
        <b className="seal-number">{cell.n}</b>
        {amount && <span className="seal-amount">{amount}</span>}
      </>
    );
  if (mechanic === 'chart' && cell.face === 'water')
    return <b className="seal-water">≈</b>;
  if (mechanic === 'crown' && cell.face === 'blank') return null;
  return (
    <>
      <Prize face={cell.face} />
      {mechanic === 'seven' && cell.dir !== undefined && (
        <b className="seal-arrow" style={{ rotate: `${cell.dir * 45}deg` }}>
          →
        </b>
      )}
      {mechanic === 'mine' && cell.face !== 'dynamite' && !!cell.n && (
        <b className={`seal-count count-${cell.n}`}>{cell.n}</b>
      )}
      {mechanic === 'path' && cell.n !== undefined && (
        <b className="seal-stop">{cell.n}</b>
      )}
      {amount && <span className="seal-amount">{amount}</span>}
    </>
  );
}
/** Hedges, signs and the path drawn over the seals. */
function Overlay({ t }: { t: ScratchTicket }) {
  const { cols, rows } = t,
    mechanic = packFor(t.pack).mechanic;
  const centre = (i: number) => [(i % cols) + 0.5, Math.floor(i / cols) + 0.5];
  const between = (a: number, b: number) => {
    const [ax, ay] = centre(a),
      [bx, by] = centre(b);
    return [(ax + bx) / 2, (ay + by) / 2, ax === bx] as const;
  };
  const route =
    mechanic === 'path'
      ? t.order.filter((i) => t.cells[i].paid).map(centre)
      : [];
  return (
    <svg
      className="scratch-overlay"
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {route.length > 1 && (
        <polyline
          className="scratch-route"
          points={route.map(([x, y]) => `${x},${y}`).join(' ')}
        />
      )}
      {t.walls?.map((w) => {
        const [x, y, vertical] = between(Math.floor(w / 64), w % 64);
        return vertical ? (
          <line
            key={w}
            className="scratch-hedge"
            x1={x - 0.42}
            x2={x + 0.42}
            y1={y}
            y2={y}
          />
        ) : (
          <line
            key={w}
            className="scratch-hedge"
            x1={x}
            x2={x}
            y1={y - 0.42}
            y2={y + 0.42}
          />
        );
      })}
      {t.signs?.map(([a, b, same]) => {
        const [x, y] = between(a, b);
        return (
          <g
            key={`${a}-${b}`}
            className="scratch-sign"
            transform={`translate(${x} ${y})`}
          >
            <circle r="0.16" />
            <text y="0.07">{same ? '=' : '×'}</text>
          </g>
        );
      })}
    </svg>
  );
}
export function ScratchSurface({
  ticket,
  state,
  audio,
  onStroke,
  onStatus,
}: {
  ticket: ScratchTicket;
  state: ScratchState;
  audio: ScratchAudio;
  onStroke: (sequence: number, batch: Batch) => Promise<boolean>;
  /** The predicted ticket after every change, and whether strokes are in flight. */
  onStatus: (ticket: ScratchTicket, syncing: boolean) => void;
}) {
  const dust = useRef<HTMLCanvasElement>(null),
    dustFrame = useRef(0),
    quietMotion = useRef(false);
  const flakes = useRef<FoilFlake[]>([]);
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
    status = useRef(onStatus);
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
  }, [ticket, state, onStroke, onStatus]);
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
    const t = model.current,
      cw = w / t.cols,
      ch = h / t.rows;
    t.cells.forEach((cell, index) => {
      if (cell.revealed) return;
      const x = ((index % t.cols) + 0.1) * cw,
        y = (Math.floor(index / t.cols) + 0.1) * ch,
        width = cw * 0.8,
        height = ch * 0.8,
        foil = foilFor(t, index);
      c.save();
      c.beginPath();
      c.roundRect(x, y, width, height, Math.min(cw, ch) * 0.12);
      c.clip();
      const gradient = c.createLinearGradient(
        x,
        y,
        x + width * 0.7,
        y + height,
      );
      gradient.addColorStop(0, foil.from);
      gradient.addColorStop(0.4, foil.mid);
      gradient.addColorStop(0.55, foil.from);
      gradient.addColorStop(1, foil.to);
      c.fillStyle = gradient;
      c.fillRect(x, y, width, height);
      c.strokeStyle = '#ffffff30';
      c.lineWidth = dpr;
      for (let stripe = -height; stripe < width + height; stripe += 6 * dpr) {
        c.beginPath();
        c.moveTo(x + stripe, y);
        c.lineTo(x + stripe + height, y + height);
        c.stroke();
      }
      if (foil.clue) {
        c.fillStyle = foil.strong ? '#2c2440d8' : '#3a4a4670';
        c.font = `800 ${Math.round(Math.min(ch, cw) * 0.42)}px Georgia, serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(foil.clue, x + width / 2, y + height / 2 + ch * 0.02);
      }
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
    status.current(model.current, busy);
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
      if (model.current.ended) return;
      const points = last.current ? [last.current, point] : [point];
      const count = rubTicket(model.current, stateRef.current, points);
      if (!current.current.length && last.current)
        current.current.push(last.current);
      current.current.push(point);
      const distance = last.current
        ? Math.hypot(point.x - last.current.x, point.y - last.current.y)
        : 0;
      if (distance > 0.0003) scatter(point);
      if (distance > 0.0003) audio.scratch(distance * 16, false);
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
        const t = model.current;
        if (count)
          t.cells.forEach((cell, index) => {
            if (cell.revealed)
              c.clearRect(
                (index % t.cols) / t.cols,
                Math.floor(index / t.cols) / t.rows,
                1 / t.cols,
                1 / t.rows,
              );
          });
        c.restore();
      }
      if (model.current.ended) {
        finish();
        audio.cue('prize');
      }
      report();
      if (current.current.length >= 48) flush(true);
      if (cursor.current && !model.current.ended) {
        cursor.current.style.left = `${point.x * 100}%`;
        cursor.current.style.top = `${point.y * 100}%`;
        cursor.current.style.opacity = '1';
      }
    },
    [audio, finish, flush, report, scatter],
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
  const unit = prizeUnit(state, ticket.pack, ticket.level);
  const mechanic = pack.mechanic;
  return (
    <div
      className={`scratch-field scratch-field-${mechanic} ${display.ended ? 'is-ended' : ''}`}
      style={
        {
          '--scratch-columns': ticket.cols,
          '--scratch-rows': ticket.rows,
        } as React.CSSProperties
      }
    >
      <div className="scratch-seals" aria-hidden="true">
        {display.cells.map((cell, i) => {
          const region =
            mechanic === 'crown'
              ? REGIONS[(cell.group ?? 0) % REGIONS.length]
              : mechanic === 'ladder'
                ? bandColour(display, cell.group)
                : undefined;
          const waiting =
            mechanic === 'twins' && display.last === i && !display.ended;
          const state = cell.given
            ? 'is-given'
            : !cell.revealed || waiting
              ? ''
              : cell.paid
                ? 'is-paid'
                : cell.picked
                  ? 'is-miss'
                  : 'is-missed';
          return (
            <div
              className={`scratch-seal face-${cell.face} ${state} ${waiting ? 'is-open' : ''}`}
              style={
                region
                  ? ({ '--region': region } as React.CSSProperties)
                  : undefined
              }
              key={i}
            >
              {cell.revealed && <SealFace t={display} i={i} unit={unit} />}
            </div>
          );
        })}
      </div>
      <Overlay t={display} />
      <canvas
        ref={canvas}
        tabIndex={display.ended ? -1 : 0}
        role="application"
        aria-label={`${pack.name} scratch ticket`}
        aria-describedby="scratch-keyboard-help"
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            held.current !== null ||
            model.current.ended
          )
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
            ].includes(event.key)
          )
            return;
          event.preventDefault();
          void audio.unlock();
          if (event.key === ' ' || event.key === 'Enter')
            keyboard.current.down = true;
          const step = 0.5 / Math.max(ticket.cols, ticket.rows);
          keyboard.current.x = Math.max(
            0.01,
            Math.min(
              0.99,
              keyboard.current.x +
                (event.key === 'ArrowRight'
                  ? step / 3
                  : event.key === 'ArrowLeft'
                    ? -step / 3
                    : 0),
            ),
          );
          keyboard.current.y = Math.max(
            0.01,
            Math.min(
              0.99,
              keyboard.current.y +
                (event.key === 'ArrowDown'
                  ? step / 3
                  : event.key === 'ArrowUp'
                    ? -step / 3
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
        with arrow keys; hold Space while moving to scratch.
      </span>
    </div>
  );
}
