import type { ReactNode } from 'react';

/** Inspection convention: one prominent action or requirement callout, short named steps, then limits. */
export function RuleExplanation({
  outcome,
  children,
  note,
}: {
  outcome: ReactNode;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rule-explanation">
      <div className="rule-outcome">{outcome}</div>
      <div className="rule-steps">{children}</div>
      {note && <p className="rule-note">{note}</p>}
    </div>
  );
}
export function AbilityRules({ kind }: { kind: 'shield' | 'stall' }) {
  if (kind === 'shield')
    return (
      <RuleExplanation
        outcome={<>Win the trick: halve its penalty points, rounded up.</>}
        note="Two Shields refresh each round. Salvage adjustments apply afterward."
      >
        <p>
          <b>Prepare.</b> Select a Shield before playing your card.
        </p>
        <p>
          <b>Spend.</b> The Shield is used even if you lose the trick.
        </p>
        <p>
          <b>Cancel.</b> Tap again before playing.
        </p>
      </RuleExplanation>
    );
  return (
    <RuleExplanation
      outcome="Open a stall, then collect more dishes of that type."
      note="Two permits for the whole game. Stalls persist across rounds and must be different dish types."
    >
      <p>
        <b>Open.</b> Select this button, then draft a dish to open a stall of
        that type. Both choices lock and reveal together.
      </p>
      <p>
        <b>Reward.</b> Each later matching dish earns +2, up to +6 per stall.
      </p>
      <p>
        <b>Collect.</b> Only later dishes count. The opening dish and earlier
        dishes earn no stall bonus.
      </p>
      <p>
        <b>Example.</b> Open a stall, then draft two more matching dishes for +4
        on top of their normal score.
      </p>
      <p>
        <b>Cancel.</b> Tap again before playing.
      </p>
    </RuleExplanation>
  );
}
export function CustomerOrderRules() {
  return (
    <RuleExplanation
      outcome={<>Collect all three requested dishes this round.</>}
      note="An unfinished order earns +0, with no penalty."
    >
      <p>
        <b>Reward.</b> A completed order earns +7.
      </p>
      <p>
        <b>Choose.</b> Pick one of three orders with your first dish each round.
        They lock and reveal together.
      </p>
      <p>
        <b>Collect.</b> Green checks mark the dishes you have collected.
        Previous rounds do not count.
      </p>
      <p>
        <b>Keep your dishes.</b> Orders never consume food. Everyone can choose
        the same order.
      </p>
    </RuleExplanation>
  );
}
