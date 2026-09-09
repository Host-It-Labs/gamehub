import {
  deck,
  foods,
  creatures,
  habitats,
  dice,
  suits,
  handSize,
  totalRounds,
  type PublicGame as Game,
} from '@/lib/games/trio/engine';
const steps = {
  undertow: [
    [
      'Pass',
      'Choose three cards. Everyone passes left in odd rounds and right in even rounds.',
    ],
    [
      'Roll',
      'The die picks a suit. Its 9 is worth 40 penalty marks this round.',
    ],
    [
      'Follow',
      'Play one card. Follow the led suit if possible. Highest card of that suit takes the trick.',
    ],
    [
      'Shield',
      'Arm a ward before playing. If you win, halve all penalties, rounding up. Your ward is spent either way.',
    ],
    [
      'Win',
      'Lowest total after one round per player wins. Black cards cost their number; the dangerous 9 costs 40.',
    ],
  ],
  wildgrove: [
    [
      'Roll',
      'One die roll per shared turn. The roller is exempt; everyone else follows its restriction.',
    ],
    [
      'Choose',
      'Select one creature from your packet. Six species have different personalities, but the same placement rules.',
    ],
    [
      'Place',
      'Drop it into a legal region. Region spaces and scoring matter; hold a region to inspect.',
    ],
    [
      'Pass',
      'After everyone places, packets pass. New pieces arrive in round two and direction reverses.',
    ],
    [
      'Score',
      'Each player places twelve creatures. Highest total wins. If no piece has any legal home, Meadow is available.',
    ],
  ],
  midnight: [
    [
      'Choose',
      'Keep one dish from the six-card menu. Hold a card to see examples of its scoring.',
    ],
    [
      'Collect',
      'Build pairs, trios, variety, or a tea majority. Your collection stays between rounds.',
    ],
    [
      'Pass',
      'After everyone picks, the remaining menus pass to neighbours. Round two reverses direction.',
    ],
    [
      'Watch',
      'Tap another player to see their public menu. Their private cards remain hidden.',
    ],
    ['Win', 'After twelve picks, most points wins. Ties share victory.'],
  ],
};
export function Help({
  g,
  reference = false,
}: {
  g: Game;
  reference?: boolean;
}) {
  if (!reference)
    return (
      <div className="help-steps">
        {steps[g.id].map(([title, text], i) => (
          <section key={title}>
            <b className="step-number">{i + 1}</b>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </section>
        ))}
      </div>
    );
  const cards = deck(g.id),
    kinds = g.id === 'undertow' ? 5 : 6;
  return (
    <div className="reference">
      <div className="reference-stats">
        <div>
          <b>{cards.length}</b>
          <span>{g.id === 'wildgrove' ? 'pieces' : 'cards'}</span>
        </div>
        <div>
          <b>{g.players.length}</b>
          <span>players</span>
        </div>
        <div>
          <b>{totalRounds(g)}</b>
          <span>rounds</span>
        </div>
        <div>
          <b>{handSize(g)}</b>
          <span>per deal</span>
        </div>
      </div>
      <h3>Distribution</h3>
      <div className="reference-rows">
        {Array.from({ length: kinds }, (_, k) => (
          <p key={k}>
            <span>
              {g.id === 'undertow'
                ? `${suits[k]} ${k === 4 ? 'Storm' : '1–12'}`
                : g.id === 'wildgrove'
                  ? creatures[k]
                  : foods[k].name}
            </span>
            <b>{cards.filter((c) => c.kind === k).length}</b>
          </p>
        ))}
      </div>
      {g.id === 'undertow' ? (
        <>
          <h3>Penalties & wards</h3>
          <p>
            Selected-suit 9: <b>40</b> · Storm: printed rank · Other cards:{' '}
            <b>0</b>.
          </p>
          <p>
            Two wards per round. Each halves the whole captured trick, rounded
            up. Three-card passing alternates left/right.
          </p>
          <p>
            Die: {suits.slice(0, 4).join(' · ')}. All four outcomes are equally
            likely.
          </p>
        </>
      ) : g.id === 'wildgrove' ? (
        <>
          <h3>Regions</h3>
          {habitats.map((h) => (
            <p className="reference-rule" key={h.name}>
              <b>
                {h.name} · {h.cap} spaces
              </b>
              <span>{h.rule}</span>
            </p>
          ))}
          <h3>Placement die</h3>
          {dice.map((d) => (
            <p className="reference-rule" key={d.name}>
              <b>
                {d.symbol} {d.name}
              </b>
              <span>{d.rule}</span>
            </p>
          ))}
          <p>
            Six equally likely faces. Roller exempt; capacity still applies.
          </p>
        </>
      ) : (
        <>
          <h3>Scoring</h3>
          {foods.map((f) => (
            <p className="reference-rule" key={f.name}>
              <b>
                {f.name} · {f.formula}
              </b>
              <span>{f.rule}</span>
            </p>
          ))}
        </>
      )}
      <p className="reference-note">
        Drafting supply is drawn without replacement. Public collections and
        your own hand are visible; undealt contents stay hidden.
      </p>
    </div>
  );
}
