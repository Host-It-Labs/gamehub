'use client';
import { useEffect, useRef } from 'react';
/** Transparent ink ripples clipped to the lagoon, with no hit-testing surface. */
export function LagoonWater() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      visible = false,
      stopped = false;
    function draw(time: number) {
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(canvas.width / 100, canvas.height / 100);
      context.beginPath();
      // Paper Floodline: only the uninterrupted central water channel.
      context.moveTo(44, 0);
      context.lineTo(54, 0);
      context.lineTo(54, 32);
      context.lineTo(56, 40);
      context.lineTo(54, 57);
      context.lineTo(62, 68);
      context.lineTo(70, 72);
      context.lineTo(68, 96);
      context.lineTo(59, 96);
      context.lineTo(56, 75);
      context.lineTo(44, 62);
      context.lineTo(47, 50);
      context.lineTo(47, 40);
      context.lineTo(43, 32);
      context.closePath();
      context.clip();
      context.strokeStyle = '#e8d5a5';
      context.lineWidth = 0.13;
      for (let i = 0; i < 38; i++) {
        const x = 28 + ((i * 19.7) % 50),
          y = (i * 7.9 + time * 0.0007) % 102;
        context.globalAlpha = 0.1 + 0.12 * Math.sin(time * 0.0005 + i) ** 2;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(
          x + 1.8,
          y + 0.5 * Math.sin(time * 0.001 + i),
          x + 4,
          y,
        );
        context.stroke();
      }
      context.restore();
      if (!stopped && visible && !document.hidden && !reduced.matches)
        frame = requestAnimationFrame(draw);
    }
    function restart() {
      cancelAnimationFrame(frame);
      if (!stopped && visible && !document.hidden)
        draw(reduced.matches ? 0 : performance.now());
    }
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      restart();
    });
    observer.observe(canvas);
    const resize = new ResizeObserver(() => {
      canvas.width = Math.round(
        canvas.clientWidth * Math.min(devicePixelRatio, 2),
      );
      canvas.height = Math.round(
        canvas.clientHeight * Math.min(devicePixelRatio, 2),
      );
      restart();
    });
    resize.observe(canvas);
    document.addEventListener('visibilitychange', restart);
    reduced.addEventListener('change', restart);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener('visibilitychange', restart);
      reduced.removeEventListener('change', restart);
    };
  }, []);
  return <canvas ref={ref} className="lagoon-water" aria-hidden="true" />;
}
