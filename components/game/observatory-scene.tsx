'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { paperWorldTarget, type PaperWorld } from '@/lib/games/mora-world';

type Layout = { width: number; height: number; board: { x: number; y: number; width: number } };

/** Deterministic specks so the scene looks the same on every mount. */
function motes(count: number) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => ({
    x: rand(), y: rand(), size: 1 + rand() * 1.6, speed: 6 + rand() * 9, wobble: rand() * 6.28,
  }));
}
const MOTES = motes(26);

/**
 * One source image is drawn once per frame across the whole table. Where the
 * uniformly scaled scene cannot reach the surface edges, a soft, darkened copy
 * of the same woodland fills the gap instead of a paper table. Measured crowns
 * sway, the pond surface shifts and pollen floats; targets never move.
 */
export function ObservatoryScene({ art }: { art: PaperWorld }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef<Layout | null>(null);
  const redraw = useRef<(() => void) | null>(null);
  const [table, setTable] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const board = anchor.current?.parentElement;
    const surface = board?.closest<HTMLElement>('.table-layout');
    if (!board || !surface) return;
    setTable(surface);
    let frame = 0;
    const measure = () => {
      const s = surface.getBoundingClientRect(), b = board.getBoundingClientRect();
      const next = { width: s.width, height: s.height, board: { x: b.left - s.left, y: b.top - s.top, width: b.width } };
      latest.current = next;
      setLayout(next);
      redraw.current?.();
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(board); resize.observe(surface);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [art]);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx || !table) return;
    setReady(false);
    let disposed = false, loaded = false, visible = true, frame = 0, last = -Infinity;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const source = new Image();
    // A tiny copy upscaled with smoothing reads as a soft blur everywhere, without ctx.filter.
    const tiny = document.createElement('canvas');
    const backdrop = document.createElement('canvas');
    let backdropKey = '';
    const polygon = (points: number[][]) => {
      ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    };
    const paintBackdrop = (width: number, height: number, target: { x: number; y: number; width: number; height: number }) => {
      const key = `${width}x${height}:${target.x.toFixed(1)},${target.y.toFixed(1)},${target.width.toFixed(1)}`;
      if (key === backdropKey) return;
      backdropKey = key;
      const tctx = tiny.getContext('2d'), bctx = backdrop.getContext('2d');
      if (!tctx || !bctx) return;
      tiny.width = 96; tiny.height = Math.max(1, Math.round((96 * art.height) / art.width));
      tctx.drawImage(source, 0, 0, tiny.width, tiny.height);
      backdrop.width = Math.max(1, Math.round(width / 2)); backdrop.height = Math.max(1, Math.round(height / 2));
      const scale = Math.max(width / art.width, height / art.height) * 1.12;
      const w = art.width * scale, h = art.height * scale;
      // Keep the blurred copy aligned with the sharp scene so trees continue outward.
      const cx = target.x + target.width / 2, cy = target.y + target.height / 2;
      const x = Math.min(0, Math.max(width - w, cx - w / 2)), y = Math.min(0, Math.max(height - h, cy - h / 2));
      bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      bctx.drawImage(tiny, x, y, w, h);
      bctx.fillStyle = 'rgba(22, 34, 22, 0.42)';
      bctx.fillRect(0, 0, width, height);
    };
    // Outside the crop, the sharp scene's outer margin dissolves into the soft copy
    // so no rectangle is visible on screens the source cannot cover.
    const feather = document.createElement('canvas');
    let featherKey = '';
    const featheredSource = (width: number, height: number, target: { x: number; y: number; width: number; height: number }) => {
      const scale = target.width / art.width;
      const c = art.crop;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const limit = Math.min(72 * dpr, target.width * 0.1 * dpr);
      const bands = {
        left: target.x > 0.5 ? Math.min(limit, c.left * scale * dpr) : 0,
        top: target.y > 0.5 ? Math.min(limit, c.top * scale * dpr) : 0,
        right: target.x + target.width < width - 0.5 ? Math.min(limit, (art.width - c.left - c.width) * scale * dpr) : 0,
        bottom: target.y + target.height < height - 0.5 ? Math.min(limit, (art.height - c.top - c.height) * scale * dpr) : 0,
      };
      if (!bands.left && !bands.top && !bands.right && !bands.bottom) return source;
      const key = `${Math.round(target.width * dpr)}:${bands.left | 0},${bands.top | 0},${bands.right | 0},${bands.bottom | 0}`;
      if (key !== featherKey) {
        featherKey = key;
        const w = Math.max(1, Math.round(target.width * dpr)), h = Math.max(1, Math.round(target.height * dpr));
        feather.width = w; feather.height = h;
        const f = feather.getContext('2d');
        if (!f) return source;
        f.drawImage(source, 0, 0, w, h);
        f.globalCompositeOperation = 'destination-out';
        const erase = (x0: number, y0: number, x1: number, y1: number, gx0: number, gy0: number, gx1: number, gy1: number) => {
          const g = f.createLinearGradient(gx0, gy0, gx1, gy1);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          f.fillStyle = g; f.fillRect(x0, y0, x1 - x0, y1 - y0);
        };
        if (bands.left) erase(0, 0, bands.left, h, 0, 0, bands.left, 0);
        if (bands.right) erase(w - bands.right, 0, w, h, w, 0, w - bands.right, 0);
        if (bands.top) erase(0, 0, w, bands.top, 0, 0, 0, bands.top);
        if (bands.bottom) erase(0, h - bands.bottom, w, h, 0, h, 0, h - bands.bottom);
      }
      return feather;
    };
    const draw = (time = 0) => {
      const current = latest.current;
      if (disposed || !loaded || !visible || document.hidden || !current) return;
      const { width, height, board } = current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6_000_000 / Math.max(1, width * height)));
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const target = paperWorldTarget(art, board);
      const covers = target.x <= 0.5 && target.y <= 0.5 && target.x + target.width >= width - 0.5 && target.y + target.height >= height - 0.5;
      if (!covers) {
        paintBackdrop(width, height, target);
        ctx.drawImage(backdrop, 0, 0, width, height);
      }
      const scale = target.width / art.width;
      const still = reduced.matches;
      ctx.save();
      ctx.translate(target.x, target.y); ctx.scale(scale, scale);
      const sharp = covers ? source : featheredSource(width, height, target);
      ctx.drawImage(sharp, 0, 0, sharp.width, sharp.height, 0, 0, art.width, art.height);
      if (!still) {
        // Only the measured crowns lean; ground, paths and buildings never move.
        art.animation.foliage.forEach((leaf, i) => {
          ctx.save(); polygon(leaf.polygon); ctx.clip();
          const [x, y] = leaf.pivot;
          const sway = Math.sin(time / 2300 + i * 1.7) * 0.016 + Math.sin(time / 610 + i * 2.3) * 0.004;
          ctx.translate(x, y); ctx.rotate(sway); ctx.translate(-x, -y);
          ctx.drawImage(source, 0, 0, art.width, art.height); ctx.restore();
        });
        // Water: the surface itself shifts in thin bands with incommensurate
        // periods, so nothing ever visibly repeats or travels as a wave.
        ctx.save(); polygon(art.animation.water.polygon); ctx.clip();
        const points = art.animation.water.polygon;
        const left = Math.min(...points.map((p) => p[0])), right = Math.max(...points.map((p) => p[0]));
        const top = Math.min(...points.map((p) => p[1])), bottom = Math.max(...points.map((p) => p[1]));
        for (let y = top; y < bottom; y += 3) {
          const dx = 1.1 * Math.sin(time / 1370 + y * 0.31) + 0.7 * Math.sin(time / 2210 * 1.618 - y * 0.19);
          const dy = 0.5 * Math.sin(time / 1730 * 1.272 + y * 0.23);
          ctx.drawImage(source, left, y, right - left, 3, left + dx, y + dy, right - left, 3);
        }
        const sheen = 0.05 + 0.03 * Math.sin(time / 3100) * Math.sin(time / 4700 * 1.414);
        ctx.fillStyle = `rgba(255,255,240,${sheen})`;
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.restore();
      }
      ctx.restore();
      if (!still) {
        ctx.save(); ctx.fillStyle = 'rgba(255, 249, 214, 0.7)';
        for (const m of MOTES) {
          const y = ((m.y * height - (time / 1000) * m.speed) % height + height) % height;
          const x = m.x * width + Math.sin(time / 1700 + m.wobble) * 14;
          const a = 0.3 + 0.3 * Math.sin(time / 900 + m.wobble * 3);
          ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, m.size, 0, 6.283); ctx.fill();
        }
        ctx.restore();
      }
      setReady(true);
    };
    const tick = (time: number) => {
      if (time - last >= 40) { draw(time); last = time; }
      if (!disposed && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame); draw(performance.now());
      if (loaded && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    redraw.current = restart;
    source.onload = () => { loaded = true; restart(); };
    source.src = art.image;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', restart);
    reduced.addEventListener('change', restart);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); source.onload = null;
      document.removeEventListener('visibilitychange', restart); reduced.removeEventListener('change', restart);
      redraw.current = null;
    };
  }, [art, table]);

  const target = layout ? paperWorldTarget(art, layout.board) : null;
  return <><span ref={anchor} hidden />{table && createPortal(
    <div className="observatory-world" aria-hidden="true">
      {target && <img className="paper-world-fallback" src={art.image} alt="" style={{ left: target.x, top: target.y, width: target.width, height: target.height, visibility: ready ? 'hidden' : 'visible' }} />}
      <canvas ref={canvas} style={{ visibility: ready ? 'visible' : 'hidden' }} className={`paper-world-canvas ${ready ? 'scene-ready' : ''}`} />
    </div>, table)}</>;
}
