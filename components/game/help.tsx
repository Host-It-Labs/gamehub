import {
  foods,
  creatures,
  habitats,
  dice,
  suits,
  handSize,
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
  const used = g.players.length * 12,
    omitted = 72 - used;
  if (reference) {
    const inHands = g.players.reduce((n, p) => n + p.hand.length, 0);
    const placed = g.players.reduce((n, p) => n + p.zones.flat().length, 0);
    return (
      <div className="reference readable-reference">
        <h3>Match supply</h3>
        <dl className="match-facts">
          <dt>Players</dt>
          <dd>{g.players.length}</dd>
          <dt>Full supply</dt>
          <dd>
            {tide
              ? '60 cards · 5 suits × 12 ranks'
              : `72 ${grove ? 'creatures' : 'cards'} · 6 types × 12`}
          </dd>
          <dt>Used in this match</dt>
          <dd>{tide ? 60 : used}</dd>
          <dt>Set aside, unseen</dt>
          <dd>{tide ? 0 : omitted}</dd>
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
              <dd>{60 - inHands}</dd>
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
        <h3>Public table counts</h3>
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
          Only public totals are shown. The identities of other players’ cards
          and set-aside items stay hidden.
        </p>
      </div>
    );
  }
  return (
    <div className="reference readable-reference">
      <section className="reference-goal">
        <h3>
          {tide
            ? 'Win with the fewest penalty marks'
            : 'Win with the most points'}
        </h3>
        <p>
          {tide
            ? `Play ${totalRounds(g)} rounds. Storm cards cost their number; the die-selected suit’s 9 costs 40. All other cards cost zero. Tied players share the win.`
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
              <b>Roll the die.</b> Its suit tells everyone which 9 costs 40 this
              round.
            </li>
            <li>
              <b>Play one card.</b> Follow the first card’s suit if you have it.
              Otherwise play any card. There is no trump suit.
            </li>
            <li>
              <b>Resolve the trick.</b> Once everyone has played, the highest
              card in the first suit takes all the cards and their penalties,
              then leads next.
            </li>
          </>
        ) : (
          <>
            {grove && (
              <li>
                <b>Roll once for the table.</b> Everyone follows the face’s
                placement rule except the roller. Full regions are always
                unavailable.
              </li>
            )}
            <li>
              <b>Choose one {grove ? 'creature' : 'dish'}.</b>{' '}
              {grove
                ? 'Select it and tap a highlighted region, or drag it there.'
                : 'Tap a card to keep it, or drag it onto your serving board.'}
            </li>
            <li>
              <b>Pass the rest.</b> After everyone chooses, hands move to the
              next player. Watch the seating diagram above your hand to see who
              receives yours.
            </li>
            <li>
              <b>Start round two after six picks.</b> Deal six new items to each
              player and reverse the passing direction.
            </li>
          </>
        )}
      </ol>
      {tide && g.starter !== false && (
        <section className="reference-goal">
          <h3>
            {g.starter
              ? 'Safe Harbour expansion'
              : 'Shields in this saved match'}
          </h3>
          <p>
            <b>Two shields each round:</b> arm one before playing. If you take
            the trick, halve its total penalty, rounding up. A 45-mark trick
            becomes 23.
          </p>
          {g.starter && (
            <p>
              <b>One Calm each round:</b> arm it before playing. If you take the
              trick, remove the highest Storm card’s penalty. It never cancels
              the dangerous 9. Calm applies before a shield: 40 + Storm 8
              becomes 40, then 20 with both.
            </p>
          )}
          <p>
            Armed tokens are spent even when you lose the trick. Tap an armed
            token again to turn it off before playing.
          </p>
        </section>
      )}
      {!reference && (
        <>
          <h3>
            {grove
              ? 'Where to place — and why'
              : tide
                ? 'Know your cards'
                : 'What each dish earns'}
          </h3>
          {grove ? (
            habitats.map((h, i) => (
              <section className="reference-rule" key={h.name}>
                <b>
                  {i + 1}. {h.name} · {h.cap} spaces
                </b>
                <span>{h.rule}</span>
              </section>
            ))
          ) : tide ? (
            <p>
              Five suits, with cards numbered 1–12 in each: {suits.join(' ')}.
              Storm is a separate suit, so follow it when it is led. Each of the
              four ordinary suits is equally likely on the die.
            </p>
          ) : (
            foods.map((f) => (
              <section className="reference-rule" key={f.name}>
                <b>{f.name}</b>
                <span>{f.rule}</span>
                <small className="example">{f.example}</small>
              </section>
            ))
          )}
          {grove && (
            <>
              <h3>Read the die</h3>
              {dice.map((d) => (
                <section className="reference-rule" key={d.name}>
                  <b>
                    {d.symbol} {d.name}
                  </b>
                  <span>{d.rule}</span>
                </section>
              ))}
              <p>
                Each face is equally likely. The Riverbank is always available
                and earns one point per creature, whatever the die shows.
              </p>
            </>
          )}
        </>
      )}
      <h3>What is in this match?</h3>
      {tide ? (
        <p>
          All 60 cards are dealt every round: <b>{handSize(g)} cards each</b>{' '}
          for {g.players.length} players. No cards are set aside. Shuffle and
          deal again next round.
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
              The species are {creatures.join(', ')}. They share the same
              placement rules; their arrangement earns the points.
            </p>
          )}
        </>
      )}
      <p className="reference-note">
        Swipe sideways through your hand. Tap to choose; hold a card or region,
        or use its information button, for details. Other players’ collections
        are public; their hands stay hidden.
      </p>
    </div>
  );
}
