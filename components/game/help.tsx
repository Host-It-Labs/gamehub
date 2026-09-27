import { MoraDieSymbol } from './mora-symbols';
import { NewExtensionRules } from './new-extensions';
import { WildTrailsRules } from './mora-extension';
import { AbilityRules, CustomerOrderRules } from './extension-rules';
import { Rules, RuleSection, RuleList } from './rules';
import {
  foodsFor,
  habitatsFor,
  habitatOrder,
  dice,
  placementDieRule,
  suits,
  handSize,
  tideDeck,
  tideRanks,
  tidePenaltyRank,
  tidePenaltyValue,
  tokenImage,
  passCount,
  totalRounds,
  supplyPerKind,
  type PublicGame as Game,
} from '@/lib/games/trio/engine';

/** How to play Nox, Mora or Yata (goal, turn, scoring, end, then reference lists), or the card counts. */
export function Help({
  g,
  reference = false,
}: {
  g: Game;
  reference?: boolean;
}) {
  if (reference) return <Counts g={g} />;
  if (g.id === 'undertow') return <NoxRules g={g} />;
  if (g.id === 'wildgrove') return <MoraRules g={g} />;
  return <YataRules g={g} />;
}

function NoxRules({ g }: { g: Game }) {
  const pass = passCount(g),
    rank = tidePenaltyRank(g),
    value = tidePenaltyValue(g);
  // Two-player games keep only some ranks, always including the penalty rank.
  const ranks = [...new Set(tideDeck(g).map((card) => card.rank))].sort(
    (a, b) => a - b,
  );
  return (
    <Rules>
      <RuleSection title="Avoid penalty points">
        <p>
          Tricks you win can bring <b>penalty points</b>. After{' '}
          <b>{totalRounds(g)} rounds</b>, one per player, the{' '}
          <b>fewest points</b> wins. Tied players share the win.
        </p>
      </RuleSection>
      <RuleSection title={`Pass ${pass} cards`}>
        <p>
          Each round deals <b>{handSize(g)} cards</b> each. Choose{' '}
          <b>{pass}</b> to pass, then press <b>Pass</b> to lock them. Everyone
          passes at once, and the direction changes each round.
        </p>
      </RuleSection>
      <RuleSection
        title="Follow the suit"
        note="There are no trumps: a card off the led suit never wins."
      >
        <p>
          The leader plays any card. Everyone else must play{' '}
          <b>the same suit</b> if they can. <b>Tap a card</b> to play it, or
          drag it to the table.
        </p>
        <p>
          {g.turningTide ? (
            <>
              The <b>highest</b> card of the led suit wins odd tricks, the{' '}
              <b>lowest</b> wins even tricks.
            </>
          ) : (
            <>
              The <b>highest card of the led suit</b> wins the trick.
            </>
          )}{' '}
          The winner takes its points and leads the next trick.
        </p>
      </RuleSection>
      <RuleSection
        title="Penalty points"
        note={
          g.duelDeck
            ? `With two players the deck holds only the ${ranks.slice(0, -1).join(', ')} and ${ranks.at(-1)} of each suit.`
            : undefined
        }
      >
        <p>
          Five suits of cards 1 to {tideRanks(g)}: {suits.slice(0, 4).join(' ')}{' '}
          and Storm {suits[4]}. After the pass, the <b>die</b> picks one of the
          four plain suits.
        </p>
        <RuleList
          items={[
            {
              key: 'storm',
              mark: suits[4],
              name: 'Storm',
              text: 'Each card adds its number.',
            },
            {
              key: 'die',
              mark: suits.slice(0, 4).join(''),
              name: `${rank} of the die’s suit`,
              text: `Adds ${value}.`,
            },
            { key: 'rest', name: 'Every other card', text: 'Adds nothing.' },
          ]}
        />
      </RuleSection>
      {g.shields && <AbilityRules kind="shield" title="Shields" />}
      {g.turningTide && (
        <NewExtensionRules kind="turningTide" title="Turning Tide" />
      )}
      {g.salvage && <NewExtensionRules kind="salvage" title="Salvage" />}
    </Rules>
  );
}

function MoraRules({ g }: { g: Game }) {
  const areas = habitatsFor(g.contentSet);
  return (
    <Rules>
      <RuleSection title="Build a sanctuary">
        <p>
          Place creatures in your habitats. Each habitat <b>scores</b> in its
          own way. After <b>{totalRounds(g)} rounds</b> of 6 picks, the{' '}
          <b>most points</b> wins. Tied players share the win.
        </p>
      </RuleSection>
      <RuleSection
        title="Roll, pick, place"
        note={
          <>
            The <b>roller</b>, marked with a die, may use any habitat with
            space. <b>Release</b> is always allowed and scores 0.
          </>
        }
      >
        <p>
          Before each pick the <b>die</b> rolls and limits where you may place.
          Everyone picks at once: <b>tap a creature, then a lit habitat</b>, or
          drag it there.
        </p>
      </RuleSection>
      <RuleSection title="Pass the rest">
        <p>
          Each hand then passes to the next player. After <b>6 picks</b> a new
          round deals 6 more creatures and passes the other way. Your board
          stays.
        </p>
      </RuleSection>
      {g.roamEnabled && <NewExtensionRules kind="roamEnabled" title="Roam" />}
      {g.migration && <NewExtensionRules kind="migration" title="Migration" />}
      {g.sanctuaryGoalsEnabled && (
        <WildTrailsRules
          title="Sanctuary Goals"
          goals={g.sanctuaryGoals}
          contentSet={g.contentSet}
        />
      )}
      <RuleSection title="Habitats">
        <RuleList
          items={habitatOrder.map((zone) => ({
            key: String(zone),
            name:
              zone === 5
                ? areas[zone].name
                : `${areas[zone].name} · ${areas[zone].cap} ${areas[zone].cap === 1 ? 'space' : 'spaces'}`,
            text: areas[zone].rule,
          }))}
        />
      </RuleSection>
      <RuleSection title="Die faces">
        <RuleList
          items={dice.map((face, i) => ({
            key: face.name,
            mark: <MoraDieSymbol face={i} />,
            name: face.name,
            text: placementDieRule(i, g.contentSet),
          }))}
        />
      </RuleSection>
    </Rules>
  );
}

function YataRules({ g }: { g: Game }) {
  return (
    <Rules>
      <RuleSection title="Collect dishes">
        <p>
          Each kind of dish <b>scores</b> in its own way. After <b>{totalRounds(g)} rounds</b> of 6 picks, the{' '}
          <b>most points</b> wins. Tied players share the win.
        </p>
      </RuleSection>
      <RuleSection title="Keep one, pass the rest">
        <p>
          Everyone picks at once. <b>Tap a dish</b> to keep it, or drag it
          onto your board. Each hand then passes to the next player.
        </p>
        <p>
          After <b>6 picks</b> a new round deals 6 more dishes and passes the
          other way. Your dishes stay.
        </p>
      </RuleSection>
      {g.customerOrders && <CustomerOrderRules title="Customer Orders" />}
      {g.specialtyStalls && <AbilityRules kind="stall" title="Specialty Stalls" />}
      {g.marketSeasons && (
        <NewExtensionRules kind="marketSeasons" title="Market Seasons" />
      )}
      <RuleSection title="Dishes">
        <RuleList
          items={foodsFor(g.contentSet).map((food, kind) => ({
            key: food.name,
            mark: (
              <img
                src={tokenImage(kind, true, g.contentSet)}
                alt=""
                width={40}
                height={40}
                draggable={false}
              />
            ),
            name: food.name,
            text: food.rule,
          }))}
        />
      </RuleSection>
    </Rules>
  );
}

/** Card and piece counts: public facts about this match, never what a hand holds. */
function Counts({ g }: { g: Game }) {
  const tide = g.id === 'undertow',
    grove = g.id === 'wildgrove';
  const tideTotal = tideDeck(g).length,
    tideUsed = handSize(g) * g.players.length;
  const perKind = supplyPerKind(g),
    supply = perKind * 6,
    used = g.players.length * totalRounds(g) * 6;
  const inHands = g.players.reduce((n, p) => n + p.hand.length, 0);
  const placed = g.players.reduce((n, p) => n + p.zones.flat().length, 0);
  // Released creatures leave the game, so count the rounds still to come.
  const toDeal =
    g.phase === 'over'
      ? 0
      : (totalRounds(g) - g.round) * 6 * g.players.length;
  const items = tide ? 'cards' : grove ? 'creatures' : 'dishes';
  return (
    <Rules>
      <RuleSection title="This game">
        <dl className="match-facts">
          <dt>Players</dt>
          <dd>{g.players.length}</dd>
          <dt>{tide ? 'Full deck' : 'Full supply'}</dt>
          <dd>
            {tide
              ? `${tideTotal} cards · 5 suits × ${tideTotal / 5}`
              : `${supply} ${items} · 6 kinds × ${perKind}`}
          </dd>
          <dt>{tide ? 'Dealt each round' : 'Used this game'}</dt>
          <dd>{tide ? tideUsed : used}</dd>
          <dt>Set aside, hidden</dt>
          <dd>{tide ? tideTotal - tideUsed : supply - used}</dd>
          <dt>Round</dt>
          <dd>
            {g.round} / {totalRounds(g)}
          </dd>
          <dt>In hands</dt>
          <dd>{inHands}</dd>
          {tide ? (
            <>
              <dt>In the current trick</dt>
              <dd>{g.trick.length}</dd>
              <dt>Played this round</dt>
              <dd>{tideUsed - inHands}</dd>
            </>
          ) : (
            <>
              <dt>On boards</dt>
              <dd>{placed}</dd>
              <dt>Still to be dealt</dt>
              <dd>{toDeal}</dd>
            </>
          )}
        </dl>
      </RuleSection>
      <RuleSection
        title="Each player"
        note={`Hands and unused ${items} stay hidden.`}
      >
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
      </RuleSection>
    </Rules>
  );
}
