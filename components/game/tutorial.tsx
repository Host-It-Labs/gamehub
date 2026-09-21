'use client';
import { useEffect } from 'react';
import { Clock3 } from 'lucide-react';
import type { GameId } from '@/lib/games/trio/engine';
import { lessons } from '@/lib/games/trio/lessons';
export { lessons } from '@/lib/games/trio/lessons';
export function Tutorial({
  id,
  step,
  onSkip,
  onRestart,
  onStep,
  onAdvance,
}: {
  id: GameId;
  step: number;
  onSkip: () => void;
  onRestart: () => void;
  onStep: (step: number) => void;
  onAdvance: () => void;
}) {
  const lesson = lessons[id][step];
  useEffect(() => {
    if (!lesson) return;
    const target = document.querySelector<HTMLElement>(
      `[data-coach="${lesson.target}"]`,
    );
    target?.setAttribute('data-tutorial-active', 'true');
    return () => target?.removeAttribute('data-tutorial-active');
  }, [lesson]);
  return (
    <>
    <button className="practice-advance-time" onClick={onAdvance} aria-label="Advance time"><Clock3 size={18} /><span>Advance time</span></button>
    <aside
      className="coach sandbox-coach"
      aria-label="Sandbox tutorial"
      aria-live="polite"
    >
      <div>
        <span>
          Practice only · {Math.min(step + 1, lessons[id].length)}/
          {lessons[id].length}
        </span>
      </div>
      <h3>{lesson?.title ?? 'Ready to play'}</h3>
      <p>{lesson?.text ?? 'Your practice scores will be cleared.'}</p>
      <small>
        Try any legal move. The clock waits for you; saved matches are
        untouched.
      </small>
      <div className="sandbox-controls">
        <button disabled={step === 0} onClick={() => onStep(step - 1)}>
          Back
        </button>
        <button onClick={onRestart}>Reset practice</button>
        {step < lessons[id].length - 1 ? (
          <button onClick={() => onStep(step + 1)}>Next</button>
        ) : (
          <button onClick={onSkip}>Start fresh game</button>
        )}
        <button onClick={onSkip}>Skip to fresh game</button>
      </div>
    </aside>
    </>
  );
}
