import type { ReactNode } from 'react';
import { RuleSection } from './rules';

/** Specialty Stalls (Yata). `title` only where no dialog title names it. */
export function AbilityRules({ title }: { title?: ReactNode }) {
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
