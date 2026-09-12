'use client';
import type { PublicGame } from '@/lib/games/trio/engine';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';

function ExpansionDetails() {
  return (
    <>
      <PopoverTitle>Safe Harbour</PopoverTitle>
      <p>
        Each round, you get two Shields and one Calm. Select a token before
        playing your card.
      </p>
      <p>
        <b>Shield:</b> if you win the trick, halve its penalty points, rounding
        up.
      </p>
      <p>
        <b>Calm:</b> if you win the trick, cancel the highest Storm card’s
        penalty. It cannot cancel the 9 worth 40 points.
      </p>
      <p>
        You can use both on one trick. Calm applies first, then the Shield.
        Selected tokens are spent even if you do not win the trick.
      </p>
    </>
  );
}
export function ExpansionChoice({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset
      className="expansion-option expansion-picker"
      aria-label="Expansions"
    >
      <button
        type="button"
        className={`expansion-choice ${enabled ? 'enabled' : ''}`}
        aria-label="Safe Harbour expansion"
        aria-pressed={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        title="Safe Harbour"
      >
        <img src="/art/safe-harbour-v6.webp" alt="" />
        {enabled && (
          <span className="expansion-check" aria-hidden="true">
            ✓
          </span>
        )}
      </button>
      <Popover>
        <PopoverTrigger
          className="icon-button expansion-info-button"
          aria-label="About Safe Harbour"
        >
          i
        </PopoverTrigger>
        <PopoverContent className="expansion-help" align="start">
          <ExpansionDetails />
        </PopoverContent>
      </Popover>
    </fieldset>
  );
}
export function ExpansionBadge({ g }: { g: PublicGame }) {
  if (g.id !== 'undertow' || !g.starter) return null;
  return (
    <Popover>
      <PopoverTrigger
        className="expansion-badge"
        aria-label="Safe Harbour enabled: show expansion rules"
      >
        <img src="/art/safe-harbour-v6.webp" alt="" />
        <span aria-hidden="true">i</span>
      </PopoverTrigger>
      <PopoverContent className="expansion-help">
        <ExpansionDetails />
      </PopoverContent>
    </Popover>
  );
}
