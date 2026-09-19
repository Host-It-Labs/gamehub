'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sceneTarget, type SceneArt } from '@/lib/games/mora-world';

type Layout = { width: number; height: number; board: { x: number; y: number; width: number } };
type Glow = { x: number; y: number; radius: number; color: string; alpha: number; period: number };
type Shimmer = { polygon: number[][] };
export type WorldSceneArt = SceneArt & {
  image: string;
  animation?: { glows?: Glow[]; water?: Shimmer[]; glints?: number[][]; motes?: boolean };
};

/**
 * One environment plate drawn once per frame across the whole table. Where the
 * uniformly scaled scene cannot reach the surface edges, a soft, darkened copy
 * of the same plate fills the gap. Lantern pools breathe and the sea seen
 * through windows shifts in thin bands; the table and every target never move.
 * Reduced motion draws one still frame.
 */
export function WorldScene({ art, tint = 'rgba(10, 14, 20, 0.45)' }: { art: WorldSceneArt; tint?: string }) {
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
      // Expose the plate's placement so CSS can pin controls to painted objects
      // (signboards, shelves) by their source coordinates.
      const t = sceneTarget(art, next.board);
      surface.style.setProperty('--world-x', `${t.x}px`);
      surface.style.setProperty('--world-y', `${t.y}px`);
      surface.style.setProperty('--world-scale', `${t.width / art.width}`);
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
      for (const name of ['--world-x', '--world-y', '--world-scale']) surface.style.removeProperty(name);
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
    const tiny = document.createElement('canvas');
    const backdrop = document.createElement('canvas');
    let backdropKey = '';
    const polygon = (points: number[][]) => {
      ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    };
    // A tiny copy upscaled with smoothing reads as a soft blur everywhere, without ctx.filter.
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
      const cx = target.x + target.width / 2, cy = target.y + target.height / 2;
      const x = Math.min(0, Math.max(width - w, cx - w / 2)), y = Math.min(0, Math.max(height - h, cy - h / 2));
      bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      bctx.drawImage(tiny, x, y, w, h);
      bctx.fillStyle = tint;
      bctx.fillRect(0, 0, width, height);
    };
    // Outside the crop, the sharp plate's outer margin dissolves into the soft copy.
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
    const glows = art.animation?.glows ?? [];
    const shimmer = art.animation?.water ?? [];
    const glints = art.animation?.glints ?? [];
    const draw = (time = 0) => {
      const current = latest.current;
      if (disposed || !loaded || !visible || document.hidden || !current) return;
      const { width, height, board } = current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6_000_000 / Math.max(1, width * height)));
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const target = sceneTarget(art, board);
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
        // The sea behind the windows: thin bands drift with incommensurate periods, never repeating.
        for (const layer of shimmer) {
          ctx.save(); polygon(layer.polygon); ctx.clip();
          const points = layer.polygon;
          const left = Math.min(...points.map((p) => p[0])), right = Math.max(...points.map((p) => p[0]));
          const top = Math.min(...points.map((p) => p[1])), bottom = Math.max(...points.map((p) => p[1]));
          for (let y = top; y < bottom; y += 3) {
            const dx = 1.2 * Math.sin(time / 1370 + y * 0.31) + 0.8 * Math.sin((time / 2210) * 1.618 - y * 0.19);
            ctx.drawImage(source, left, y, right - left, 3, left + dx, y, right - left, 3);
          }
          ctx.restore();
        }
        // Lantern pools breathe: a soft additive glow whose strength slowly wanders.
        for (const [i, glow] of glows.entries()) {
          const pulse = 0.5 + 0.5 * Math.sin(time / glow.period + i * 1.9) * Math.sin((time / (glow.period * 1.73)) + i);
          const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
          g.addColorStop(0, `rgba(${glow.color}, ${glow.alpha * pulse})`);
          g.addColorStop(1, `rgba(${glow.color}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(glow.x - glow.radius, glow.y - glow.radius, glow.radius * 2, glow.radius * 2);
        }
      }
      if (!still) {
        // Coins catch the lantern: a brief four-point glint on each marked coin, out of step with the others.
        for (const [i, [x, y]] of glints.entries()) {
          const phase = Math.sin(time / (1900 + (i % 5) * 230) + i * 2.3);
          const strength = Math.max(0, phase) ** 10;
          if (strength < 0.02) continue;
          const size = 9 + 4 * strength;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 1.6);
          halo.addColorStop(0, `rgba(255, 232, 170, ${0.35 * strength})`); halo.addColorStop(1, 'rgba(255, 232, 170, 0)');
          ctx.fillStyle = halo; ctx.fillRect(x - size * 1.6, y - size * 1.6, size * 3.2, size * 3.2);
          ctx.strokeStyle = `rgba(255, 244, 214, ${0.9 * strength})`; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
      setReady(true);
    };
    const tick = (time: number) => {
      if (time - last >= 40) { draw(time); last = time; }
      if (!disposed && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame); draw(performance.now());
      if (loaded && visible && !document.hidden && !reduced.matches && (glows.length || shimmer.length || glints.length)) frame = requestAnimationFrame(tick);
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
  }, [art, table, tint]);

  const target = layout ? sceneTarget(art, layout.board) : null;
  return <><span ref={anchor} hidden />{table && createPortal(
    <div className="observatory-world world-scene" aria-hidden="true">
      {target && <img className="paper-world-fallback" src={art.image} alt="" style={{ left: target.x, top: target.y, width: target.width, height: target.height, visibility: ready ? 'hidden' : 'visible' }} />}
      <canvas ref={canvas} style={{ visibility: ready ? 'visible' : 'hidden' }} className={`paper-world-canvas ${ready ? 'scene-ready' : ''}`} />
    </div>, table)}</>;
}
