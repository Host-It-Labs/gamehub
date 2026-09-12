'use client';
import { useEffect, useState } from 'react';
import type { GameId } from '@/lib/games/trio/engine';
import { lessons } from '@/lib/games/trio/lessons';
export { lessons } from '@/lib/games/trio/lessons';
export function Tutorial({
  id,
  step,
  onSkip,
  onRestart,
}: {
  id: GameId;
  step: number;
  onSkip: () => void;
  onRestart: () => void;
}) {
  const lesson = lessons[id][step];
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  useEffect(() => {
    if (!lesson) return;
    const target = document.querySelector<HTMLElement>(
      `[data-coach="${lesson.target}"]`,
    );
    if (!target) return;
    target.setAttribute('data-tutorial-active', 'true');
    function update() {
      if (!target) return;
      const r = target.getBoundingClientRect(),
        w = Math.min(290, innerWidth - 24),
        above = r.top > 205;
      setPos({
        left: Math.max(
          12,
          Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2),
        ),
        top: above
          ? Math.max(10, r.top - 175)
          : Math.min(innerHeight - 180, r.bottom + 10),
        above,
      });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => {
      target.removeAttribute('data-tutorial-active');
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer.disconnect();
    };
  }, [lesson]);
  if (!lesson)
    return (
      <div className="tutorial-complete">
        <b>Tutorial complete</b>
        <button onClick={onSkip}>Continue match</button>
        <button onClick={onRestart}>Restart lesson</button>
      </div>
    );
  if (!pos) return null;
  return (
    <aside
      className={`coach ${pos.above ? 'coach-above' : 'coach-below'}`}
      style={{ left: pos.left, top: pos.top }}
      aria-live="polite"
    >
      <div>
        <span>
          {step + 1}/{lessons[id].length}
        </span>
        <button onClick={onSkip}>Skip</button>
      </div>
      <h3>{lesson.title}</h3>
      <p>{lesson.text}</p>
    </aside>
  );
}
