import {
  legacyTriviaRoutes,
  triangle,
  triviaBlock,
  triviaCosts,
  triviaExpedition,
  triviaLengths,
  triviaMaxLength,
  triviaMaxRoundPoints,
  triviaRoutes,
  triviaRoundLimit,
  triviaTower,
  type TriviaMode,
} from '@/lib/games/party/trivia';
import { RuleList, RuleSection, Rules } from './rules';

/** Which rules a match plays: 1 for the old shop saves, 2 for the route and
 * floor saves of 4 October 2026, 3 since 10 October 2026. */
export type TriviaVersion = 1 | 2 | 3;
type TriviaRulesProps = {
  mode: TriviaMode;
  version?: TriviaVersion;
  /** A match's planned rounds; setup leaves it out and offers 4 or 8. */
  length?: number;
};
const rounds = (length?: number) =>
  length ? `${length} rounds` : `${triviaLengths.join(' or ')} rounds`;

export function TriviaGoal({ mode, version = 3, length }: TriviaRulesProps) {
  if (version === 3 && mode === 'tower')
    return (
      <RuleSection title="Build the tallest">
        <p>
          Build your <b>tower</b> over <b>{rounds(length)}</b>. The tallest
          wins; points break a tie.
        </p>
      </RuleSection>
    );
  if (version === 3 && mode === 'expedition')
    return (
      <RuleSection title="Collect the best finds">
        <p>
          Finish higher to <b>pick first</b>, and collect finds: the more of{' '}
          <b>one kind</b> you hold, the more each is worth. Over{' '}
          <b>{rounds(length)}</b>, the best collection wins; points break a
          tie.
        </p>
      </RuleSection>
    );
  const legacy = version === 1;
  return (
    <RuleSection
      title={
        mode === 'tower'
          ? 'Build the tallest'
          : mode === 'expedition'
            ? legacy
              ? 'Collect the trophies'
              : 'Go the furthest'
            : 'Score the most'
      }
    >
      <p>
        {mode === 'tower' ? (
          <>
            Build your <b>tower</b> over{' '}
            <b>{legacy ? 5 : triviaRoundLimit(mode)} rounds</b>. The tallest
            wins; points break a tie.
          </>
        ) : mode === 'expedition' ? (
          <>
            Take {legacy ? 'an' : 'a'}{' '}
            <b>{legacy ? 8 : triviaRoundLimit(mode)}-round journey</b>.{' '}
            {legacy ? (
              <>
                Buy the most <b>trophies</b> to win. Ties go to the furthest
                traveller, then leftover coins, then points.
              </>
            ) : (
              <>
                Travel the <b>most steps</b> to win; points break a tie.
              </>
            )}
          </>
        ) : (
          <>
            Play any of the four mini-games. Your <b>points carry across</b>,
            and the most points wins.
          </>
        )}
      </p>
    </RuleSection>
  );
}

/** Rules 3: four rounds at a time, then the host's 4 more or End. */
function MoreRounds({ what }: { what: string }) {
  return (
    <RuleSection
      title="Four more rounds"
      note={`A match stops after ${triviaMaxLength} rounds.`}
    >
      <p>
        Every {triviaBlock} rounds play each mini-game once, in the{' '}
        <b>host’s order</b>. After the last round, the host picks{' '}
        <b>4 more</b> with the same {what}, or <b>End</b>.
      </p>
    </RuleSection>
  );
}

export function TriviaRoundRules({
  mode,
  version = 3,
}: TriviaRulesProps) {
  if (version === 3 && mode === 'tower')
    return (
      <>
        <RuleSection
          title="Place to build"
          note="Tied players share the higher place, and the places below carry on counting: two tied first of four get 4 each, the next 2."
        >
          <p>
            Your points only decide your <b>place</b> in the round. First
            place earns <b>one block per player</b>, each place below one
            fewer: with four players <b>4, 3, 2 and 1</b>, with six{' '}
            <b>6 down to 1</b>.
          </p>
        </RuleSection>
        <MoreRounds what="towers" />
      </>
    );
  if (version === 3 && mode === 'expedition')
    return (
      <>
        <RuleSection
          title="Pick in turn"
          note="A tie picks in order of who is behind on the expedition, then fewer points. Nobody presses Next between picks."
        >
          <p>
            After each round the camp lays out{' '}
            <b>one find more than there are players</b>. Pick one each, in the
            order you finished: the <b>winner first</b>, last place from the{' '}
            <b>last two</b>. The find left over is lost.
          </p>
        </RuleSection>
        <RuleSection
          title="Build your kinds"
          note="Every collection is on show, so taking the find someone else needs is fair play."
        >
          <p>
            Finds come in four kinds: crystal, fossil, gold and fern. Each find
            of a kind is worth <b>one more</b> than the one before, and the{' '}
            <b>big find</b> counts as two.
          </p>
          <RuleList
            items={[1, 2, 3, 4, 5].map((n) => ({
              key: `${n}`,
              name: `${n} of a kind`,
              text: `${triangle(n)} point${triangle(n) === 1 ? '' : 's'}`,
            }))}
          />
        </RuleSection>
        <MoreRounds what="finds" />
      </>
    );
  const legacy = version === 1;
  if (legacy && mode !== 'quick') return <LegacyTriviaRoundRules mode={mode} />;
  if (mode === 'tower')
    return (
      <RuleSection
        title="Add your floors"
        note="Tied round winners each get the bonus. An exact tie on height and points is shared."
      >
        <p>
          Build <b>1 floor per {triviaTower.pointsPerFloor} points</b>. The
          round’s highest score earns{' '}
          <b>{triviaTower.victoryFloors} extra floors</b>. Play each of the four
          mini-games once; the <b>host picks the order</b> and ends the match
          after round <b>{triviaRoundLimit(mode)}</b>.
        </p>
      </RuleSection>
    );
  if (mode === 'expedition')
    return (
      <>
        <RuleSection
          title="Choose your route"
          note="Your choice stays private until the host starts. You can unlock until everyone has locked."
        >
          <p>
            Before each round, choose <b>one route</b> and <b>lock</b>. Your
            score decides how many steps you travel.
          </p>
          <RuleList
            items={triviaRoutes.map((r) => ({
              key: r.id,
              name: r.name,
              text:
                r.threshold === 0
                  ? `${r.distance} step, whatever your score`
                  : `${r.threshold} points: ${r.distance} steps. Below: ${r.missDistance} step${r.missDistance === 1 ? '' : 's'}`,
            }))}
          />
        </RuleSection>
        <RuleSection
          title="Reach the checkpoints"
          note="An exact tie on steps and points is shared."
        >
          <p>
            Every <b>{triviaExpedition.checkpointSteps} steps</b> earns a{' '}
            <b>trophy</b> automatically. Play each mini-game once, in the host’s
            order. After round <b>{triviaRoundLimit(mode)}</b>, the{' '}
            <b>host ends</b> the journey.
          </p>
        </RuleSection>
      </>
    );
  return <LegacyTriviaRoundRules mode={mode} />;
}

function LegacyTriviaRoundRules({ mode }: { mode: TriviaMode }) {
  const limit =
    mode === 'tower' ? 5 : mode === 'expedition' ? 8 : triviaRoundLimit(mode);
  if (mode === 'tower')
    return (
      <RuleSection
        title="Add your floors"
        note="Tied winners each get the victory bonus. A tie on both height and points is shared."
      >
        <p>
          Each round gives{' '}
          <b>1 floor per {triviaTower.pointsPerFloor} points</b>. The round’s
          highest score earns <b>{triviaTower.victoryFloors} extra floors</b>.
          The host picks the next mini-game, then ends the match after round{' '}
          <b>{limit}</b>.
        </p>
      </RuleSection>
    );
  if (mode === 'expedition')
    return (
      <>
        <RuleSection
          title="Pick your route"
          note="Your plan stays private until the host starts the next mini-game. You can unlock until everyone locks."
        >
          <p>
            Before each mini-game, choose a <b>route</b> and an optional
            purchase, then <b>lock</b>. Each mini-game gives up to{' '}
            <b>{triviaMaxRoundPoints} points</b>; your route turns that score
            into coins and steps.
          </p>
          <RuleList
            items={legacyTriviaRoutes.map((r) => ({
              key: r.id,
              name: r.name,
              text:
                r.threshold === 0
                  ? `${r.coins} coins and ${r.distance} step, whatever your score`
                  : `${r.threshold} points: ${r.coins} coins and ${r.distance} steps. Below: ${r.missCoins} coin${r.missCoins === 1 ? '' : 's'}, ${r.missDistance} step${r.missDistance === 1 ? '' : 's'}`,
            }))}
          />
        </RuleSection>
        <RuleSection
          title="Spend your coins"
          note={`One purchase per camp. You can hold up to ${triviaCosts.maxSupplies} supplies. Unspent coins stay yours.`}
        >
          <p>
            A <b>trophy costs {triviaCosts.trophy} coins</b>.{' '}
            <b>Supplies cost {triviaCosts.supplies}</b> and each adds{' '}
            <b>1 coin</b> to every later round’s reward. Pay when the host moves
            on.
          </p>
        </RuleSection>
        <RuleSection title="Finish the journey">
          <p>
            After round <b>{limit}</b>, make one last purchase and lock. The{' '}
            <b>host ends</b> the journey once everyone is ready.
          </p>
        </RuleSection>
      </>
    );
  return (
    <RuleSection
      title="Pick what follows"
      note="With Everyone votes in setup, the table has 10 seconds to pick. Silence does not count; a tie keeps playing."
    >
      <p>
        After a round, the <b>host picks</b> the same mini-game, another one, or{' '}
        <b>End</b>. Play up to <b>{limit} rounds</b>.
      </p>
    </RuleSection>
  );
}

export function TriviaRules(props: TriviaRulesProps) {
  return (
    <Rules>
      <TriviaGoal {...props} />
      <RuleSection
        title="Four mini-games"
        note="Everyone plays for themselves, with the same prompts. Each round has three prompts, worth up to 100 points each."
      >
        <RuleList
          items={[
            { name: 'Atlas', text: 'Pin three places on the globe' },
            { name: 'Sizes', text: 'Resize three things beside a reference' },
            { name: 'Years', text: 'Place three events on the timeline' },
            { name: 'Order', text: 'Sort three sets of five things' },
          ]}
        />
      </RuleSection>
      <RuleSection title="Lock and reveal">
        <p>
          Prepare all three answers and <b>lock once</b>. The host reveals them{' '}
          <b>one at a time</b>. Your answers stay private before the reveal.
        </p>
      </RuleSection>
      <TriviaRoundRules {...props} />
    </Rules>
  );
}
