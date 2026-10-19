'use client';
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
  type Plan,
} from '@/lib/games/alto/content';
import {
  captainFor,
  planFor,
  turnsPerSeason,
  type AltoGame,
  type AltoOptions,
  type ExtensionKey,
} from '@/lib/games/alto/engine';
import { captainArt, seasonNames } from '@/lib/games/alto/art';
import { effectRuleParts, familyLabel, planRule } from '@/lib/games/alto/text';
import { FamilyIcon, GoodsRow, PlanMark } from './alto-parts';

/** How to play Alto, in Arena's pattern: the goal, a turn, building, the
 *  two kinds of upgrade, how it ends; then this match's extensions and
 *  upgrades. */
export function AltoRules({
  options,
  plans,
  game,
}: {
  options?: AltoOptions;
  plans?: string[][];
  game?: AltoGame;
}) {
  const turns = game
    ? turnsPerSeason(game)
    : lengths[options?.length ?? 'standard'];
  const legacy = game?.rules === 2;
  return (
    <Rules className="alto-rules">
      <RuleSection title="Build your ship">
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
      <RuleSection title="Ship and base">
        <p>
          <b>Ship parts</b> (blue, <FamilyIcon family="ship" size={13} />) bolt
          onto your ship and <b>load more</b>: a bigger hold, more of one cargo,
          more alone or shared. <b>Base modules</b> (gold,{' '}
          <FamilyIcon family="base" size={13} />) build up your base to{' '}
          <b>score points</b> or make later upgrades <b>cost less</b>.
        </p>
      </RuleSection>
      {!legacy && (
        <RuleSection
          title="Refit your ship"
          note="A refit replaces the old effect; the levels do not add together. Refitting uses your one build for the flight."
        >
          <p>
            <b>Year 1</b> is for ship parts. In <b>Year 2</b>, you can refit
            them to <b>level II</b>; <b>Year 3</b> opens <b>level III</b>.
            Earlier upgrades stay in the shop, so you can keep developing your
            ship.
          </p>
          <p>
            Some parts bring a <b>second cargo</b> home. A <b>route</b> bonus
            pays when you visit a different cargo kind from your previous
            flight; it does not pay on your first flight.
          </p>
        </RuleSection>
      )}
      <RuleSection
        title="Read the points"
        note="Build a race module on the same turn as others and you all get the last builder’s prize."
      >
        <p>
          A <b>star</b> means points. <b>Now</b> scores when you build the
          module. <b>Next in race</b> shows the next builder’s prize; later
          builders score less.
        </p>
        <p>
          <b>Per</b> bonuses score at the end: count the named upgrades or
          cargo. A <b>cargo slot</b> is one space in your ship’s hold; empty
          slots count too.
        </p>
      </RuleSection>
      <RuleSection title="Three years">
        <p>
          Each year lasts <b>{turns} turns</b> and {legacy ? 'holds' : 'adds'}{' '}
          <b>{plansPerSeason} upgrades</b>
          {legacy
            ? '; they leave when it ends.'
            : '; earlier upgrades stay available.'}{' '}
          After the third, every <b>{leftoverPer} cargo</b> left score 1. A tie
          goes to more cargo left.
        </p>
      </RuleSection>
      {extensionKeysIn(options).map((key) => (
        <AltoExtensionRules
          key={key}
          kind={key}
          titled
          legacy={legacy}
          game={game}
        />
      ))}
      {plans && <PlanList plans={plans} game={game} />}
    </Rules>
  );
}

/** The same upgrade wording as its accessible label, in the shared rules UI. */
export function AltoPlanRules({ plan }: { plan: Plan }) {
  const race = plan.effects.some((e) => e.type === 'race');
  const capacity = plan.effects.find((e) => e.type === 'perHold');
  const note = race
    ? 'Build this module on the same turn as others and you all get the last builder’s prize.'
    : capacity?.type === 'perHold'
      ? `A hold of ${baseHold} scores ${baseHold * capacity.points} points. Ship parts that expand your hold count too.`
      : undefined;
  return (
    <Rules className="alto-rules">
      <RuleSection title="What it does" note={note}>
        {plan.effects.map((effect, i) => (
          <p key={i}>
            {effectRuleParts(effect).map((part, j) =>
              typeof part === 'string' ? part : <b key={j}>{part.bold}</b>,
            )}
          </p>
        ))}
      </RuleSection>
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
  legacy = false,
  game,
}: {
  kind: ExtensionKey;
  titled?: boolean;
  legacy?: boolean;
  game?: AltoGame;
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
          {!legacy && (
            <>
              From <b>Year 2</b>,{' '}
            </>
          )}
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
        items={captains.map((base) => {
          const c = game ? captainFor(game, base.id) : base;
          return {
            key: c.id,
            mark: <img src={captainArt(c.id)} alt="" width={32} height={32} />,
            name: c.name,
            text: c.text,
          };
        })}
      />
    </RuleSection>
  );
}

/** The upgrades of this match, year by year. */
export function PlanList({
  plans,
  game,
}: {
  plans: string[][];
  game?: AltoGame;
}) {
  return (
    <>
      {plans.map((ids, s) => (
        <RuleSection
          key={s}
          title={`${seasonNames[s]} upgrades`}
          className="alto-rule-plans"
        >
          <RuleList
            items={ids.map((id) => {
              const plan = game ? planFor(game, id) : planById[id];
              return {
                key: id,
                mark: <PlanMark id={id} size={36} />,
                name: (
                  <>
                    <span
                      className="alto-family"
                      data-family={plan.family}
                      aria-label={familyLabel(plan.family)}
                    >
                      <FamilyIcon family={plan.family} size={11} />
                    </span>
                    {plan.name} <GoodsRow amounts={plan.cost} size={13} />
                  </>
                ),
                text: planRule(plan),
              };
            })}
          />
        </RuleSection>
      ))}
    </>
  );
}
