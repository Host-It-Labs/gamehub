import { allCards, cards, type CardId } from '@/lib/games/arena/cards';
import { RuleList, RuleSection, Rules } from '../rules';

/** How to play: the goal, elixir and the hand, the Meteor, decks, Quest,
 *  then every card. The pattern every game's rules follow (see
 *  `components/game/rules.tsx`). `quest` leads with the Quest's own rules. */
export function ArenaRules({
  cardArt,
  quest = false,
}: {
  cardArt?: Partial<Record<CardId, string>>;
  quest?: boolean;
}) {
  const questRules = (
    <>
      <RuleSection
        title="Cross three regions"
        note="Lose a battle and you lose a heart. The last heart ends the quest."
      >
        <p>
          Pick a stop on the map and walk up to the <b>boss</b>. Beat three
          bosses to finish the quest. Battles last <b>two minutes</b>.
        </p>
      </RuleSection>
      <RuleSection title="Draft your deck">
        <p>
          Three times, take <b>one of three pairs</b> of cards. You start the
          quest with those <b>six cards</b>.
        </p>
      </RuleSection>
      <RuleSection title="Grow your deck">
        <p>
          Wins pay <b>gold</b> and a choice: a <b>new card</b> or an{' '}
          <b>upgrade</b> (each level adds 10% hit points and damage). Elites and
          bosses give <b>charms</b>, which help in every battle.
        </p>
      </RuleSection>
      <RuleSection
        title="Camps, shops, strangers"
        note="Each boss you beat adds a new card to every future quest."
      >
        <p>
          At a <b>camp</b> rest for a heart or train a card. <b>Shops</b> sell
          cards, upgrades and charms. <b>Strangers</b> offer a trade.
        </p>
      </RuleSection>
      <RuleSection title="With a friend">
        <p>
          Two players share the run and fight <b>two against two</b>, each with
          the deck. The host picks the way; the other player&apos;s taps show up
          as suggestions.
        </p>
      </RuleSection>
    </>
  );
  return (
    <Rules className="arena-rules">
      {quest && questRules}
      <RuleSection title="Knock down towers">
        <p>
          Each side has a <b>king</b> and two smaller towers. A fallen tower is
          a <b>crown</b>. Take the king and you win at once with three crowns.
        </p>
      </RuleSection>
      <RuleSection
        title="Spend elixir"
        note="When one of their small towers falls, you may also drop troops a few rows past the river on that side."
      >
        <p>
          <b>Drag a card</b> onto your half of the field, or tap it and tap the
          field. You start with <b>7 elixir</b>, up to 10. Each card costs the
          amount on its drop. Elixir refills on its own, <b>twice as fast</b> in
          the last minute and <b>2.5× as fast</b> in overtime.
        </p>
      </RuleSection>
      <RuleSection
        title="The Meteor"
        note="Towers take less from it than troops do."
      >
        <p>
          The one spell. <b>Drop it anywhere</b>, on their half or right on a
          tower. A second later it crashes and hits everything of theirs in its
          circle, <b>on the ground and in the air</b>, and shoves light troops
          back. Aim where they will be.
        </p>
      </RuleSection>
      <RuleSection title="Build a deck">
        <p>
          A deck is <b>eight cards</b> of the twenty-four. Four are in your
          hand; a played card goes to the back of the line. Bring a <b>tank</b>{' '}
          to lead your pushes.
        </p>
      </RuleSection>
      {!quest && (
        <RuleSection
          title="Pick or draft"
          note="When the clock runs out, the two best cards are kept for you."
        >
          <p>
            Pick your deck while the battle loads. With <b>Draft</b> on, take
            two of four cards, twice; the two you leave go to the player
            across from you.
          </p>
        </RuleSection>
      )}
      {!quest && (
        <RuleSection title="Two against two">
          <p>
            Teammates share a half and its towers but keep{' '}
            <b>their own hand and elixir</b>. Towers are sturdier and hit
            harder, because twice the troops come at them.
          </p>
        </RuleSection>
      )}
      <RuleSection title="Three minutes">
        <p>
          More crowns at full time wins. Level? <b>Overtime</b>: the next tower
          to fall wins. Still level after a minute, the side with the stronger
          weakest tower wins.
        </p>
      </RuleSection>
      <RuleSection title="Cards" className="arena-rules-cards">
        <RuleList
          items={allCards.map((id) => ({
            key: id,
            mark: (
              <span className="arena-rules-card">
                {cardArt?.[id] ? (
                  <img src={cardArt[id]} alt="" />
                ) : (
                  <span className="arena-rules-blank" />
                )}
                <span className="arena-cost">{cards[id].cost}</span>
              </span>
            ),
            name: cards[id].name,
            text: cards[id].role,
          }))}
        />
      </RuleSection>
    </Rules>
  );
}
