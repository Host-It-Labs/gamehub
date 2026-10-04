'use client';
import { Check } from 'lucide-react';

/** Quiz's three-step strip, shared by every Quiz game: numbered index-card
 * tabs, the current one lifted, finished ones ticked. Atlas lets players pick
 * a step; Sizes only shows where the round is. */
export function SabiSteps({
  steps,
  current,
  done,
  onSelect,
  label = 'Round steps',
}: {
  steps: string[];
  current: number;
  done: (i: number) => boolean;
  onSelect?: (i: number) => void;
  label?: string;
}) {
  const items = steps.map((step, i) => {
    const body = (
      <>
        <b
          data-game-motion="change"
          data-game-motion-key={done(i) ? 'done' : 'open'}
        >
          {done(i) ? (
            <Check size={13} strokeWidth={3} aria-label="Done" />
          ) : (
            i + 1
          )}
        </b>
        <span>{step}</span>
      </>
    );
    const className = `${i === current ? 'is-current' : ''} ${done(i) ? 'is-done' : ''}`;
    return onSelect ? (
      <button
        key={i}
        type="button"
        role="tab"
        aria-selected={i === current}
        className={className}
        onClick={() => onSelect(i)}
      >
        {body}
      </button>
    ) : (
      <li
        key={i}
        aria-current={i === current ? 'step' : undefined}
        className={className}
      >
        {body}
      </li>
    );
  });
  return onSelect ? (
    <div className="sabi-steps" role="tablist" aria-label={label}>
      {items}
    </div>
  ) : (
    <ol className="sabi-steps" aria-label={label}>
      {items}
    </ol>
  );
}
