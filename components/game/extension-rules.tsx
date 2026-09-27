import type { ReactNode } from 'react';
import { RuleSection } from './rules';

/** Shields (Nox) and Specialty Stalls (Yata). `title` only where no dialog title names it. */
export function AbilityRules({
  kind,
  title,
}: {
  kind: 'shield' | 'stall';
  title?: ReactNode;
}) {
  if (kind === 'shield')
    return (
      <RuleSection
        title={title}
        note="A Shield is spent even if you lose the trick."
      >
        <p>
          You get <b>2 Shields</b> each round. Tap one, then play your card. If
          you <b>win the trick</b>, its penalty points are <b>halved</b>,
          rounded up.
        </p>
      </RuleSection>
    );
  return (
    <RuleSection
      title={title}
      note="The opening dish and earlier ones earn nothing. Your two stalls must be different dishes."
    >
      <p>
        You have <b>2 permits</b> for the whole game. Tap <b>Open a stall</b>,
        then keep a dish: that dish becomes your stall.
      </p>
      <p>
        Each <b>later</b> dish of that kind, in any round, earns <b>+2</b>, up
        to <b>+6</b> per stall.
      </p>
    </RuleSection>
  );
}
export function CustomerOrderRules({ title }: { title?: ReactNode }) {
  return (
    <RuleSection
      title={title}
      note="Only that round’s dishes count, and they still score as usual. An unfinished order earns nothing."
    >
      <p>
        Each round, choose <b>one of three orders</b> with your first dish.
        Collect its <b>3 dishes</b> in that round for <b>+7</b>.
      </p>
    </RuleSection>
  );
}
