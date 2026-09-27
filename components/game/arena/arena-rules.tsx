import { cards, deck, type CardId } from '@/lib/games/arena/cards';
import { RuleList, RuleSection, Rules } from '../rules';

/** How to play: the goal, elixir and the hand, the Meteor, then the eight
 *  cards (seven toys and the spell). The pattern every game's rules follow
 *  (see `components/game/rules.tsx`). */
export function ArenaRules({
  cardArt,
}: {
  cardArt?: Partial<Record<CardId, string>>;
}) {
  return (
    <Rules className="arena-rules">
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
          field. It costs the elixir on its drop. Elixir refills on its own,{' '}
          <b>twice as fast</b> in the last minute and <b>2.5× as fast</b> in
          overtime.
        </p>
      </RuleSection>
      <RuleSection
        title="The Meteor"
        note="Towers take less from it than troops do."
      >
        <p>
          Your one spell. <b>Drop it anywhere</b>, on their half or right on a
          tower. A second later it crashes and hits everything of theirs in its
          circle, <b>on the ground and in the air</b>, and shoves light troops
          back. Aim where they will be.
        </p>
      </RuleSection>
      <RuleSection title="Two against two">
        <p>
          Teammates share a half and its towers but keep{' '}
          <b>their own hand and elixir</b>. Towers are sturdier and hit harder,
          because twice the troops come at them.
        </p>
      </RuleSection>
      <RuleSection title="Three minutes">
        <p>
          More crowns at full time wins. Level? <b>Overtime</b>: the next tower
          to fall wins. Still level after a minute, the side with the stronger
          weakest tower wins.
        </p>
      </RuleSection>
      <RuleSection title="Your deck" className="arena-rules-cards">
        <RuleList
          items={deck.map((id) => ({
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
