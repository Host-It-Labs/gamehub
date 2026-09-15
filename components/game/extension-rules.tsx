import type { ReactNode } from 'react';

/** Inspection convention: one outcome callout, short named steps, then limits. */
export function RuleExplanation({ outcome, children, note }: { outcome: ReactNode; children: ReactNode; note?: ReactNode }) {
  return <div className="rule-explanation"><div className="rule-outcome">{outcome}</div><div className="rule-steps">{children}</div>{note && <p className="rule-note">{note}</p>}</div>;
}
export function AbilityRules({ kind }: { kind: 'tack' | 'shield' | 'stall' }) {
  if (kind === 'tack') return <RuleExplanation outcome={<>Play off-suit, even when you can follow suit.</>} note="One Tack per round. Cannot be combined with a Shield. Tap again to cancel before playing.">
    <p><b>Prepare.</b> Select Tack, then choose an off-suit card.</p><p><b>Resolve.</b> Only the led suit can win. All penalty points still count.</p><p><b>When available.</b> Another player must lead, and you must hold the led suit.</p>
  </RuleExplanation>;
  if (kind === 'shield') return <RuleExplanation outcome={<>Win the trick: halve its penalty points, rounded up.</>} note="Two Shields refresh each round. Cannot be combined with Tack."><p><b>Prepare.</b> Select a Shield before playing your card.</p><p><b>Spend.</b> The Shield is used even if you lose the trick.</p><p><b>Cancel.</b> Tap again before playing.</p></RuleExplanation>;
  return <RuleExplanation outcome={<>Each later matching dish earns <b>+2</b>, up to <b>+6 per stall</b>.</>} note="Two permits for the whole game. Stalls persist across rounds and must be different dish types."><p><b>Open.</b> Select this button, then draft a dish to open a stall of that type. Both choices lock and reveal together.</p><p><b>Collect.</b> Only later dishes count. The opening dish and earlier dishes earn no stall bonus.</p><p><b>Example.</b> Open a Moon bun stall, then draft two more buns for +4 on top of their normal score.</p><p><b>Cancel.</b> Tap again before playing.</p></RuleExplanation>;
}
export function CustomerOrderRules() {
  return <RuleExplanation outcome={<>Collect all three requested dishes this round for <b>+7</b>.</>} note="An unfinished order earns +0, with no penalty."><p><b>Choose.</b> Pick one of three orders with your first dish each round. They lock and reveal together.</p><p><b>Collect.</b> Green checks mark the dishes you have collected. Previous rounds do not count.</p><p><b>Keep your dishes.</b> Orders never consume food. Everyone can choose the same order.</p></RuleExplanation>;
}
