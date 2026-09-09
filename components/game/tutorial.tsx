'use client';
import { useEffect, useState } from 'react';
import type { GameId } from '@/lib/games/trio/engine';
export const lessons: Record<
  GameId,
  { target: string; action: string; title: string; text: string }[]
> = {
  undertow: [
    {
      target: 'hand',
      action: 'pass',
      title: 'Pass three cards',
      text: 'Tap three cards, then confirm. High cards can be risky; try leaving yourself a short suit.',
    },
    {
      target: 'die',
      action: 'roll',
      title: 'Reveal the hazard',
      text: 'Roll the die. The matching 9 is worth 40 marks this round.',
    },
    {
      target: 'hand',
      action: 'play',
      title: 'Play to the trick',
      text: 'Drag a card onto the table, or tap it. Follow the led suit when you can.',
    },
    {
      target: 'ward',
      action: 'arm',
      title: 'Arm a shield',
      text: 'Tap a shield token. It halves the next trick you win, but is spent even if you lose.',
    },
    {
      target: 'hand',
      action: 'ward-play',
      title: 'Try the shield',
      text: 'Play a legal card with your shield armed. Keep your total marks low.',
    },
  ],
  wildgrove: [
    {
      target: 'die',
      action: 'roll',
      title: 'Roll for placement',
      text: 'The die restricts everyone except the roller. Today, you roll first.',
    },
    {
      target: 'hand',
      action: 'select',
      title: 'Pick a creature',
      text: 'Tap a creature, or drag it toward the board. Its legal homes will light up.',
    },
    {
      target: 'board',
      action: 'place',
      title: 'Choose a home',
      text: 'Drop into a lit region or tap it. Each region rewards a different arrangement.',
    },
    {
      target: 'region-0',
      action: 'inspect',
      title: 'Explore the scoring',
      text: 'Hold a region for a closer look. You can also use its i button.',
    },
    {
      target: 'players',
      action: 'opponent',
      title: 'Read your rivals',
      text: 'Tap a player to see their board. On desktop, hovering also gives a preview.',
    },
  ],
  midnight: [
    {
      target: 'hand',
      action: 'inspect',
      title: 'Read a dish',
      text: 'Hold a card for 450 ms to enlarge it and see scoring examples. Or use its i button.',
    },
    {
      target: 'hand',
      action: 'play',
      title: 'Keep a dish',
      text: 'Drag a card to your serving board, or tap it. The remaining menu passes to your neighbour.',
    },
    {
      target: 'board',
      action: 'inspect',
      title: 'Check your collection',
      text: 'Hold a dish on the board to see its count, points, and scoring rule.',
    },
    {
      target: 'players',
      action: 'opponent',
      title: 'Check the competition',
      text: 'Tap a player to view their public menu. Tea rewards the biggest collection.',
    },
  ],
};
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
