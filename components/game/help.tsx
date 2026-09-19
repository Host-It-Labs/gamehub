import { MoraDieSymbol } from './mora-symbols';
import { NewExtensionRules } from './new-extensions';
import { WildTrailsRules } from './mora-extension';
import { AbilityRules, CustomerOrderRules } from './extension-rules';
import {
  foodsFor,
  creaturesFor,
  habitatsFor,
  dice,
  placementDieRule,
  suits,
  handSize,
  tideRanks,
  tidePenaltyRank,
  tidePenaltyValue,
  passCount,
  totalRounds,
  type PublicGame as Game,
} from '@/lib/games/trio/engine';
export function Help({
  g,
  reference = false,
}: {
  g: Game;
  reference?: boolean;
}) {
  const tide = g.id === 'undertow',
    grove = g.id === 'wildgrove';
  const tideUsed = handSize(g) * g.players.length;
  const tideTotal = 5 * tideRanks(g);
  const used = g.players.length * 12,
    omitted = 72 - used;
  if (reference) {
    const inHands = g.players.reduce((n, p) => n + p.hand.length, 0);
    const placed = g.players.reduce((n, p) => n + p.zones.flat().length, 0);
    return (
      <div className="reference readable-reference">
        {g.id === 'wildgrove' && g.sanctuaryGoalsEnabled && (
          <WildTrailsRules goals={g.sanctuaryGoals} contentSet={g.contentSet} />
        )}
        {g.customerOrders && <CustomerOrderRules />}
        {g.specialtyStalls && <AbilityRules kind="stall" />}
        {g.migration && <NewExtensionRules kind="migration" />}
        {g.salvage && <NewExtensionRules kind="salvage" />}
        {g.roamEnabled && <NewExtensionRules kind="roamEnabled" />}
        {g.turningTide && <NewExtensionRules kind="turningTide" />}
        {g.marketSeasons && <NewExtensionRules kind="marketSeasons" />}
        <h3>Cards and pieces in this game</h3>
        <dl className="match-facts">
          <dt>Players</dt>
          <dd>{g.players.length}</dd>
          <dt>{grove ? 'Full creature supply' : 'Full deck'}</dt>
          <dd>
            {tide
              ? `${tideTotal} cards · 5 suits × ${tideRanks(g)} ranks`
              : `72 ${grove ? 'creatures' : 'cards'} · 6 types × 12`}
          </dd>
          <dt>Used in this game</dt>
          <dd>{tide ? tideUsed : used}</dd>
          <dt>Not used (hidden)</dt>
          <dd>{tide ? tideTotal - tideUsed : omitted}</dd>
          <dt>Round</dt>
          <dd>
            {g.round} / {totalRounds(g)}
          </dd>
          <dt>Still in players’ hands</dt>
          <dd>{inHands}</dd>
          {tide ? (
            <>
              <dt>Cards in current trick</dt>
              <dd>{g.trick.length}</dd>
              <dt>Cards played this round</dt>
              <dd>{tideUsed - inHands}</dd>
            </>
          ) : (
            <>
              <dt>Placed on boards</dt>
              <dd>{placed}</dd>
              <dt>Still to be dealt</dt>
              <dd>{Math.max(0, used - inHands - placed)}</dd>
            </>
          )}
        </dl>
        <h3>Each player’s collection</h3>
        <div className="public-counts">
          {g.players.map((p, i) => (
            <p key={i}>
              <b>{p.name}</b>
              <span>
                {p.hand.length} in hand
                {!tide && ` · ${p.zones.flat().length} placed`}
              </span>
            </p>
          ))}
        </div>
        <p className="reference-note">
          You can see how many cards or pieces each player has, but not what is
          in their hand. Unused cards and pieces also stay hidden.
        </p>
      </div>
    );
  }
  return (
    <div className="reference readable-reference">
      {g.id === 'wildgrove' && g.sanctuaryGoalsEnabled && (
        <WildTrailsRules goals={g.sanctuaryGoals} contentSet={g.contentSet} />
      )}
      {g.customerOrders && <CustomerOrderRules />}
      {g.specialtyStalls && <AbilityRules kind="stall" />}
      {g.migration && <NewExtensionRules kind="migration" />}
      {g.salvage && <NewExtensionRules kind="salvage" />}
      {g.roamEnabled && <NewExtensionRules kind="roamEnabled" />}
      {g.turningTide && <NewExtensionRules kind="turningTide" />}
      {g.marketSeasons && <NewExtensionRules kind="marketSeasons" />}
      <section className="reference-goal">
        <h3>
          {tide
            ? 'Win with the fewest penalty points'
            : 'Win with the most points'}
        </h3>
        <p>
          {tide
            ? `Play ${totalRounds(g)} rounds. Each Storm card adds penalty points equal to its number. The ${tidePenaltyRank(g)} of the suit shown on the die adds ${tidePenaltyValue(g)} points. Other cards add no penalty points. Tied players share the win.`
            : `Keep one ${grove ? 'creature' : 'dish'} per turn. After two rounds you will have kept twelve. Your collection stays between rounds. Tied players share the win.`}
        </p>
      </section>
      <h3>Your turn, in order</h3>
      <ol className="rule-sequence">
        {tide ? (
          <>
            <li>
              <b>Pass {passCount(g)} cards.</b> Everyone chooses at the same
              time. Select your cards, then confirm. Cards are exchanged once
              everyone is ready. Everyone exchanges left in odd rounds and right
              in even rounds.
            </li>
            <li>
              <b>The die rolls automatically.</b> The {tidePenaltyRank(g)} of
              the suit shown is worth {tidePenaltyValue(g)} penalty points for
              this round.
            </li>
            <li>
              <b>Play one card.</b> Follow the first card’s suit if you have it.
              Otherwise play any card. Select or drag your card, then confirm if
              confirmation is on. No suit beats the others: only cards matching
              the first suit can win the trick.
            </li>
            <li>
              <b>Collect the trick.</b> A trick is one card from each player.
              The player who played{' '}
              {g.turningTide
                ? 'the highest led-suit card on odd tricks or lowest on even tricks wins it,'
                : 'the highest card of the first suit wins it,'}
              takes its penalty points, and plays first in the next trick.
            </li>
          </>
        ) : (
          <>
            {grove && (
              <li>
                <b>The die rolls automatically before each pick.</b> Its rule
                applies to everyone except the player marked ROLLER. That player
                may use any habitat with space. No one can place in a full
                habitat.
              </li>
            )}
            <li>
              <b>Choose one {grove ? 'creature' : 'dish'}.</b>{' '}
              {grove
                ? 'Select a creature and tap a highlighted habitat, or drag the creature there. Confirm your move if confirmation is on.'
                : 'Select a card, then confirm to keep it. With confirmation off, tap a card or drag it onto your board to keep it immediately.'}
            </li>
            <li>
              <b>Pass the rest.</b> After everyone chooses, hands move to the
              next player. The name above your hand shows who receives it. Tap
              the seating icon to see the passing direction.
            </li>
            <li>
              <b>Round two starts after six picks.</b> Everyone receives six new
              cards or creatures. Passing changes direction. Keep everything
              already on your board.
            </li>
          </>
        )}
      </ol>
      {tide && g.shields && <AbilityRules kind="shield" />}
      {!reference && (
        <>
          <h3>
            {grove
              ? 'How each habitat scores'
              : tide
                ? 'Know your cards'
                : 'What each dish earns'}
          </h3>
          {grove ? (
            habitatsFor(g.contentSet).map((h, i) => (
              <section className="reference-rule" key={h.name}>
                <b>
                  {i + 1}. {h.name} · {h.cap} spaces
                </b>
                <span>{h.rule}</span>
              </section>
            ))
          ) : tide ? (
            <p>
              Five suits, with cards numbered 1–{tideRanks(g)} in each:{' '}
              {suits.join(' ')}. Storm is a separate suit, so follow it when it
              is led. Each of the four ordinary suits is equally likely on the
              die.
            </p>
          ) : (
            foodsFor(g.contentSet).map((f) => (
              <section className="reference-rule" key={f.name}>
                <b>{f.name}</b>
                <span>{f.rule}</span>
                <small className="example">{f.example}</small>
              </section>
            ))
          )}
          {grove && (
            <>
              <h3>What each die face means</h3>
              {dice.map((d) => (
                <section className="reference-rule" key={d.name}>
                  <b>
                    <MoraDieSymbol face={dice.indexOf(d)} /> {d.name}
                  </b>
                  <span>{placementDieRule(dice.indexOf(d), g.contentSet)}</span>
                </section>
              ))}
              <p>
                Each face is equally likely. Release is always available:
                release a creature from your hand for zero points. It leaves
                your board and never counts in any scoring area.
              </p>
            </>
          )}
        </>
      )}
      <h3>What is in this match?</h3>
      {tide ? (
        <p>
          Each round, deal <b>{handSize(g)} cards each</b> for{' '}
          {g.players.length} players. {tideTotal - tideUsed} cards are set aside
          face down. Shuffle and deal again next round.
        </p>
      ) : (
        <>
          <p>
            The full supply contains <b>72 {grove ? 'creatures' : 'cards'}</b>:
            12 of each of the six types. Each player receives six per round and
            keeps twelve across the whole game.
          </p>
          <p>
            With {g.players.length} players,{' '}
            <b>
              {used} are played and {omitted} stay out of this match
            </b>
            . The shuffled supply is drawn without replacement. Unused items
            stay hidden and never join a hand; you cannot assume all twelve of a
            type will appear.
          </p>
          {grove && (
            <p>
              The species are {creaturesFor(g.contentSet).join(', ')}. They
              share the same placement rules; their arrangement earns the
              points.
            </p>
          )}
        </>
      )}
      <p className="reference-note">
        Swipe sideways through your hand. Tap to choose; press and hold a card
        or habitat for details. Other players’ collections are public; their
        hands stay hidden.
      </p>
    </div>
  );
}
