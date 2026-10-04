'use client';
import { House, Rocket } from 'lucide-react';
import { RuleList, RuleSection, Rules } from '../rules';
import {
  baseHold,
  captains,
  flagPoints,
  growthFor,
  leftoverPer,
  lengths,
  openOrders,
  pileCap,
  plansPerSeason,
  planById,
  windBonus,
} from '@/lib/games/alto/content';
import type { AltoOptions, ExtensionKey } from '@/lib/games/alto/engine';
import { captainArt, seasonNames } from '@/lib/games/alto/art';
import { familyLabel, planRule } from '@/lib/games/alto/text';
import { FamilyIcon, GoodsRow, PlanMark } from './alto-parts';

/** How to play Alto, in Arena's pattern: the goal, a turn, building, the
 *  two kinds of upgrade, how it ends; then this match's extensions and
 *  upgrades. */
export function AltoRules({
  options,
  plans,
}: {
  options?: AltoOptions;
  plans?: string[][];
}) {
  const turns = lengths[options?.length ?? 'standard'];
  return (
    <Rules className="alto-rules">
      <RuleSection title="Build your base">
        <p>
          Over <b>three years</b>, fly your ship between the planets, load their{' '}
          <b>cargo</b> and spend it on <b>upgrades</b>: parts for your ship and
          modules for your home base. The <b>most points</b> wins.
        </p>
      </RuleSection>
      <RuleSection
        title="Pick a planet"
        note={`Planets fill by ${growthFor(2)} each turn (crystal by ${growthFor(2, 3)}), one more with five or more players, up to ${pileCap}.`}
      >
        <p>
          Every turn, <b>everyone at once</b> taps a planet to fly to. Alone,
          you <b>load the whole pile</b>, up to your <b>hold of {baseHold}</b>.
          With others, you <b>split it evenly</b>, rounded down; the rest stays
          for later.
        </p>
      </RuleSection>
      <RuleSection
        title="Build first"
        note="Short of one kind? Two of any others pay for it."
      >
        <p>
          Before you pick your planet, you may tap <b>one upgrade</b> you can
          pay for. It is built with the cargo you <b>already hold</b>; the new
          cargo lands after it.
        </p>
      </RuleSection>
      <RuleSection
        title="Ship parts and modules"
        note="Builders of a trophy module on the same turn all score the lower prize."
      >
        <p>
          <b>Ship parts</b> (blue, <Rocket size={13} aria-hidden="true" />) bolt
          onto your ship and <b>load more</b>: a bigger hold, more of one cargo,
          more alone or shared. <b>Base modules</b> (gold,{' '}
          <House size={13} aria-hidden="true" />) are the blocks of your base
          and <b>score points</b>; a trophy pays most to the <b>first</b> to
          build it.
        </p>
      </RuleSection>
      <RuleSection title="Three years">
        <p>
          Each year the shop holds <b>{plansPerSeason} upgrades</b> for{' '}
          <b>{turns} turns</b>; they leave when it ends. After the third, every{' '}
          <b>{leftoverPer} cargo</b> left score 1. A tie goes to more cargo
          left.
        </p>
      </RuleSection>
      {extensionKeysIn(options).map((key) => (
        <AltoExtensionRules key={key} kind={key} titled />
      ))}
      {plans && <PlanList plans={plans} />}
    </Rules>
  );
}

const extensionKeysIn = (o?: AltoOptions) =>
  (['winds', 'orders', 'flags', 'captains'] as ExtensionKey[]).filter(
    (k) => o?.[k],
  );

export const extensionTitles: Record<ExtensionKey, string> = {
  winds: 'Comets',
  orders: 'Orders',
  flags: 'Flags',
  captains: 'Crew',
};

/** One extension's rules, for its setup tile and for How to play. */
export function AltoExtensionRules({
  kind,
  titled = false,
}: {
  kind: ExtensionKey;
  titled?: boolean;
}) {
  const title = titled ? extensionTitles[kind] : undefined;
  if (kind === 'winds')
    return (
      <RuleSection
        title={title}
        note="A comet never hits the same planet twice running."
      >
        <p>
          Every turn a comet drops <b>{windBonus} more</b> on <b>one planet</b>.
          You always see where the <b>next</b> one lands, so you can plan a turn
          ahead.
        </p>
      </RuleSection>
    );
  if (kind === 'orders')
    return (
      <RuleSection
        title={title}
        note="An order is your build for the turn: an upgrade or an order, not both."
      >
        <p>
          <b>{openOrders} orders</b> wait above the shop. Instead of an upgrade,
          you may <b>fill an order</b>: pay its cargo and score its points at
          once. The <b>first</b> to fill it takes it; fill it on the same turn
          and you all score. The next order, always shown, takes its place.
        </p>
      </RuleSection>
    );
  if (kind === 'flags')
    return (
      <RuleSection
        title={title}
        note={`A tie for the most flags on a planet scores ${flagPoints.tied} each.`}
      >
        <p>
          Land <b>alone</b> on a planet and you plant a <b>flag</b> there. At
          the end, the most flags on each planet scores <b>{flagPoints.most}</b>
          .
        </p>
      </RuleSection>
    );
  return (
    <RuleSection title={title}>
      <p>
        Before the first turn, everyone picks <b>one of two crew</b>. Each bends
        one rule for the whole match.
      </p>
      <RuleList
        className="alto-rule-captains"
        items={captains.map((c) => ({
          key: c.id,
          mark: <img src={captainArt(c.id)} alt="" width={32} height={32} />,
          name: c.name,
          text: c.text,
        }))}
      />
    </RuleSection>
  );
}

/** The upgrades of this match, year by year. */
export function PlanList({ plans }: { plans: string[][] }) {
  return (
    <>
      {plans.map((ids, s) => (
        <RuleSection
          key={s}
          title={`${seasonNames[s]} upgrades`}
          className="alto-rule-plans"
        >
          <RuleList
            items={ids.map((id) => ({
              key: id,
              mark: <PlanMark id={id} size={36} />,
              name: (
                <>
                  <span
                    className="alto-family"
                    data-family={planById[id].family}
                    aria-label={familyLabel(planById[id].family)}
                  >
                    <FamilyIcon family={planById[id].family} size={11} />
                  </span>
                  {planById[id].name}{' '}
                  <GoodsRow amounts={planById[id].cost} size={13} />
                </>
              ),
              text: planRule(planById[id]),
            }))}
          />
        </RuleSection>
      ))}
    </>
  );
}
