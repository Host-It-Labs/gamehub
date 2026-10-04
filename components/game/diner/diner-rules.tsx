import { dishes, nights, NIGHTS } from '@/lib/games/diner/content';
import { RuleList, RuleSection, Rules } from '../rules';
import { DinerIcon } from './icons';

/** How to play Diner, in the shared rules pieces (Arena's pattern). */
export function DinerRules() {
  return (
    <Rules className="diner-rules">
      <RuleSection
        title="Run the diner"
        note="A party that runs out of patience walks out and takes a star. Lose all five and the diner closes early."
      >
        <p>
          A shift lasts <b>three minutes</b>. Earn <b>coins</b> for up to{' '}
          <b>three medals</b> and keep your <b>five stars</b>.
        </p>
      </RuleSection>
      <RuleSection title="Seat, order, serve">
        <p>
          Press <b>Use</b> beside a waiting party and they follow you. Use
          beside a free booth <b>big enough</b> to seat them. When the{' '}
          <b>bell</b> rings, Use at the booth to take the order.
        </p>
      </RuleSection>
      <RuleSection
        title="Cook"
        note="You carry one thing at a time: a plate or a stack of dishes. Starting a station needs no hands."
      >
        <p>
          Use at a station to start a dish, then Use again to take the plate. A
          burger or fries left too long <b>burns</b>: Use at the <b>bin</b>.
        </p>
      </RuleSection>
      <RuleSection title="Clear and get paid">
        <p>
          Once everyone has their dish they eat, then leave <b>coins</b> and
          dirty plates. Use at the booth to take both, then Use at the{' '}
          <b>sink</b>. Each guest pays <b>10</b>, plus up to <b>5</b> tip for
          patience left.
        </p>
      </RuleSection>
      <RuleSection
        title="Spot the mimics"
        note="From Night 2. Skin and hair are never a clue, and only a party of three or four can hide a mimic."
      >
        <p>
          Everyone in a party wears <b>the same outfit</b>. A mimic gets{' '}
          <b>one thing wrong</b>: a hat, the shirt colour, stripes or dark
          glasses. Face it and press <b>Out!</b> for <b>15 coins</b>. Throw out
          a real guest and the party leaves, with a star. Missed, a mimic bursts
          out with the bill and leaves <b>goo</b> that slows you: Use in it to
          mop.
        </p>
      </RuleSection>
      <RuleSection title="Three nights">
        <RuleList
          items={NIGHTS.map((n) => ({
            key: String(n),
            name: `${n}. ${nights[n].name}`,
            text:
              n === 1
                ? 'Burgers and shakes, three booths.'
                : n === 2
                  ? 'Pie joins the menu, and the first mimics.'
                  : 'Fries too, five booths, mimics everywhere.',
          }))}
        />
      </RuleSection>
      <RuleSection title="Menu" className="diner-rules-menu">
        <RuleList
          items={(Object.keys(dishes) as (keyof typeof dishes)[]).map((d) => ({
            key: d,
            mark: <DinerIcon name={d} />,
            name: dishes[d].name,
            text:
              dishes[d].cook === 0
                ? 'Ready at once from the pie case.'
                : `${dishes[d].cook} s${dishes[d].burn ? `, burns ${dishes[d].burn} s later` : ', never spoils'}.`,
          }))}
        />
      </RuleSection>
      <RuleSection
        title="Together"
        note="Keys: WASD or arrows to walk, Space or E for Use, Q or X for Out!, Escape for the menu."
      >
        <p>
          Up to <b>four waiters</b> share the coins and stars. More waiters,
          more guests. On a phone, drag anywhere on the left to walk.
        </p>
      </RuleSection>
    </Rules>
  );
}
