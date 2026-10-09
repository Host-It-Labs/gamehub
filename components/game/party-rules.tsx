import type { StandaloneId } from '@/lib/games/standalone/types';
import { nearPoints, perfectPoints } from '@/lib/games/party/ranking';
import { bands, points as dialPoints } from '@/lib/games/party/dial';
import { maxPinPoints, pinCurve } from '@/lib/games/party/geography';
import { curve } from '@/lib/games/party/size';
import {
  coinCost,
  optionsPerPrompt,
  perfectRead,
  totalCoins,
} from '@/lib/games/party/coins';
import { eraFactor, yearCurve } from '@/lib/games/party/year';
import { pairPoints } from '@/lib/games/party/order';
import { roundVoteMs } from '@/lib/games/party/vote';
import {
  clueLimit,
  drawMs,
  escapePoints,
  foundPoints,
} from '@/lib/games/party/impostor';
import { RuleList, RuleSection, Rules } from './rules';
import type { TriviaMode } from '@/lib/games/party/trivia';
import { TriviaGoal, TriviaRoundRules } from './trivia-rules';

const percent = (e: number) => `${Math.round(e * 100)}%`;
/** Sizes' curve at a glance: full marks, a step down, and nothing. */
const marks = [0, 2, curve.length - 1];
/** A factor off as words: 1.4 → "1.4 times too big or small". */
const times = (f: number) =>
  f === 2 ? 'Twice or half the size' : `${f} times too big or small`;
/** Atlas' distance curve at a glance. */
const pinMarks = [0, 2, 4, pinCurve.length - 1];
const km = (d: number) => `${d.toLocaleString('en')} km`;

/** What closes every round: the host's pick, or the table's vote. */
function RoundVote({
  when,
  again,
  set,
}: {
  when: string;
  again: string;
  set: 'Know Me' | 'Trivia';
}) {
  return (
    <RuleSection
      title="What next?"
      note={`With Votes on in setup, the table has ${roundVoteMs / 1000} seconds to vote instead. Silent players don’t count, and a tie never ends the match.`}
    >
      <p>
        {when}, the <b>host picks</b>: {again} again, another {set} game, or
        End. Points carry across the games, and the <b>most points</b> wins.
      </p>
    </RuleSection>
  );
}
/** Every Know Me game guesses the same way now: everyone, all at once. */
function GuessEveryone({ what }: { what: string }) {
  return (
    <RuleSection
      title="Guess everyone"
      note="You can unlock until everyone has locked."
    >
      <p>
        Then everyone at once guesses <b>every other player’s {what}</b>. Tap a
        face to switch players, and <b>lock once</b> when all are done.
      </p>
    </RuleSection>
  );
}

function TopFiveRules() {
  return (
    <Rules>
      <RuleSection
        title="Rank your list"
        note="You may refresh the prompts twice a round."
      >
        <p>
          Pick one of <b>3 prompts</b> and rank its five answers from{' '}
          <b>1st to 5th</b>, the way you really feel. <b>Lock</b> when you are
          done. Nobody else sees your list.
        </p>
      </RuleSection>
      <GuessEveryone what="list, ranked the way you think they did" />
      <RuleSection title="Closer scores more">
        <p>
          The lists are revealed <b>one by one</b>, and the host presses{' '}
          <b>Next</b>. Each answer scores <b>{nearPoints[0]}</b> on the author’s
          exact rank and <b>{nearPoints[1]}</b> one rank away, so a perfect list
          scores <b>{perfectPoints}</b>. The author scores nothing on their own
          list.
        </p>
      </RuleSection>
      <RoundVote
        when="When every list is revealed"
        again="Top Five"
        set="Know Me"
      />
    </Rules>
  );
}

function DialRules() {
  return (
    <Rules>
      <RuleSection
        title="Everyone writes a clue"
        note="Use words, not numbers. You can unlock until everyone has locked."
      >
        <p>
          Everyone gets <b>their own spectrum</b> at once, such as Cold – Hot,
          and only you see its <b>hidden point</b>. Type a short clue that sits
          right there, like “A bath” a little towards Hot, and lock it.
        </p>
      </RuleSection>
      <RuleSection
        title="Or place yourself"
        note="The card with your face is the Me card."
      >
        <p>
          Your other card is about <b>you</b>, such as Night owl – Early bird.
          Take it instead, turn the dial to <b>where you really are</b>, and
          lock. Its point is your place.
        </p>
      </RuleSection>
      <GuessEveryone what="clue: turn a dial to where you think its point is" />
      <RuleSection title="Closer scores more">
        <p>
          The clues are revealed <b>one by one</b>, and the host presses{' '}
          <b>Next</b>. The dial runs from 0 to 100. The author earns the{' '}
          <b>average</b> of everyone’s points on their clue.
        </p>
        <RuleList
          items={[
            ...bands.map((band) => ({
              key: `${band}`,
              name: `${dialPoints(band, 0)} points`,
              text: `Within ${band} of the point`,
            })),
            { key: 'off', name: '0 points', text: 'Further off' },
          ]}
        />
      </RuleSection>
      <RoundVote
        when="When every clue is revealed"
        again="Dial"
        set="Know Me"
      />
    </Rules>
  );
}

function AtlasRules({
  mode,
  legacy = false,
}: {
  mode: TriviaMode;
  legacy?: boolean;
}) {
  return (
    <Rules>
      <TriviaGoal mode={mode} legacy={legacy} />
      <RuleSection title="Two places and a final">
        <p>
          Each round has <b>3 places</b>: a named town or city, a harder one,
          then the <b>final</b>, a photo with two clues and no name.
        </p>
      </RuleSection>
      <RuleSection
        title="Pin all three"
        note="A lock is final. Nobody else sees your pins before the reveal."
      >
        <p>
          <b>Tap the globe</b> to drop a pin for each place. Your pins stay put
          when you switch places. Then <b>lock</b> all three together.
        </p>
      </RuleSection>
      <RuleSection
        title="Closer scores more"
        note="Points fall steadily between these marks."
      >
        <p>
          The places are revealed one by one, and the host presses <b>Next</b>{' '}
          to move on. <b>Every pin</b> scores up to <b>{maxPinPoints}</b>, by
          how far it landed.
        </p>
        <RuleList
          items={pinMarks.map((i) => ({
            key: `${pinCurve[i][0]}`,
            name: `${pinCurve[i][1]} points`,
            text:
              i === 0
                ? `Within ${km(pinCurve[i][0])}`
                : i === pinCurve.length - 1
                  ? `${km(pinCurve[i][0])} off or more`
                  : `${km(pinCurve[i][0])} off`,
          }))}
        />
      </RuleSection>
      <TriviaRoundRules mode={mode} legacy={legacy} />
    </Rules>
  );
}

function SizesRules({
  mode,
  legacy = false,
}: {
  mode: TriviaMode;
  legacy?: boolean;
}) {
  return (
    <Rules>
      <TriviaGoal mode={mode} legacy={legacy} />
      <RuleSection title="Size it up">
        <p>
          The cream piece stands at its <b>true size</b>. Make the{' '}
          <b>red one</b> its own real size beside it. Each round has 3: an
          animal, an object or landmark, then a country, lying flat like a map.
        </p>
      </RuleSection>
      <RuleSection
        title="Resize and lock"
        note="Drag a piece to move it, or lay it over the other. The wheel and arrow keys resize too."
      >
        <p>
          Slide the <b>tape</b> on the right, pull the red piece’s <b>knob</b>,
          or pinch to resize it. Size all three, then <b>lock</b> once. You can
          unlock until everyone has locked.
        </p>
      </RuleSection>
      <RuleSection
        title="Closer scores more"
        note="Points fall steadily between these marks."
      >
        <p>
          The host reveals the three one at a time. Each guess scores up to{' '}
          <b>{curve[0][1]}</b>, by how many <b>times</b> too big or too small it
          is: double and half cost the same.
        </p>
        <RuleList
          items={marks.map((i) => ({
            key: `${curve[i][0]}`,
            name: `${curve[i][1]} points`,
            text:
              i === 0
                ? `Within ${percent(curve[i][0] - 1)}`
                : i === curve.length - 1
                  ? `${times(curve[i][0])}, or further`
                  : times(curve[i][0]),
          }))}
        />
      </RuleSection>
      <TriviaRoundRules mode={mode} legacy={legacy} />
    </Rules>
  );
}

function CoinsRules() {
  return (
    <Rules>
      <RuleSection
        title="Split your coins"
        note="You may switch to the other prompt before you lock; its coins start over."
      >
        <p>
          Everyone gets <b>their own prompt</b> at once, such as A perfect
          weekend: Sleep, Friends, Adventure, Food. Share{' '}
          <b>exactly {totalCoins} coins</b> between its {optionsPerPrompt}{' '}
          options, the way you really are, and lock.
        </p>
      </RuleSection>
      <GuessEveryone what="split" />
      <RuleSection title="Closer scores more">
        <p>
          The splits are revealed <b>one by one</b>, and the host presses{' '}
          <b>Next</b>. A perfect read scores <b>{perfectRead}</b>, and every
          coin out of place costs <b>{coinCost}</b>. The author scores nothing
          on their own split.
        </p>
        <RuleList
          items={[0, 1, 2, 5].map((off) => ({
            key: `${off}`,
            name: `${Math.max(0, perfectRead - coinCost * off)} points`,
            text:
              off === 0
                ? 'Every coin in place'
                : off === 5
                  ? '5 coins or more out of place'
                  : `${off} coin${off === 1 ? '' : 's'} out of place`,
          }))}
        />
      </RuleSection>
      <RoundVote
        when="When every split is revealed"
        again="Ten Coins"
        set="Know Me"
      />
    </Rules>
  );
}

function YearsRules({
  mode,
  legacy = false,
}: {
  mode: TriviaMode;
  legacy?: boolean;
}) {
  const last = yearCurve[yearCurve.length - 1][0];
  return (
    <Rules>
      <TriviaGoal mode={mode} legacy={legacy} />
      <RuleSection title="Three events">
        <p>
          Each round has <b>3 events</b>: one from before 1800, one from 1800 to
          1949 and one since 1950, in any order.
        </p>
      </RuleSection>
      <RuleSection
        title="Place and lock"
        note="Drag the close-up ruler below to fine-tune. Arrow keys move one year."
      >
        <p>
          Drag the marker, or its round head, along the <b>timeline</b> to the
          year you think it happened. Place all three, then <b>lock</b> once.
        </p>
      </RuleSection>
      <RuleSection
        title="Closer scores more"
        note="Points fall steadily from the right year to nothing."
      >
        <p>
          The host reveals the three one at a time. The right year scores{' '}
          <b>{yearCurve[0][1]}</b>. <b>Older events give more room</b>, so each
          is scored for its era:
        </p>
        <RuleList
          items={(['old', 'modern', 'recent'] as const).map((era) => ({
            key: era,
            name:
              era === 'old'
                ? 'Before 1800'
                : era === 'modern'
                  ? '1800 to 1949'
                  : 'Since 1950',
            text: `Nothing at ${last * eraFactor[era]} years off`,
          }))}
        />
      </RuleSection>
      <TriviaRoundRules mode={mode} legacy={legacy} />
    </Rules>
  );
}

function OrderRules({
  mode,
  legacy = false,
}: {
  mode: TriviaMode;
  legacy?: boolean;
}) {
  return (
    <Rules>
      <TriviaGoal mode={mode} legacy={legacy} />
      <RuleSection title="Put them in order">
        <p>
          Each round has <b>3 sets</b> of five things, such as buildings to put{' '}
          <b>tallest first</b>. Drag each thing by its handle into order.
        </p>
      </RuleSection>
      <RuleSection
        title="Sort and lock"
        note="A set you leave untouched counts as dealt."
      >
        <p>
          Sort all three sets, then <b>lock</b> once. You can unlock until
          everyone has locked.
        </p>
      </RuleSection>
      <RuleSection title="Closer scores more">
        <p>
          The host reveals the three one at a time. A perfect order scores{' '}
          <b>{pairPoints[0]}</b>. One pair of things the wrong way round scores{' '}
          <b>{pairPoints[1]}</b>, two pairs <b>{pairPoints[2]}</b>, more scores
          nothing.
        </p>
      </RuleSection>
      <TriviaRoundRules mode={mode} legacy={legacy} />
    </Rules>
  );
}

function ImpostorRules() {
  return (
    <Rules>
      <RuleSection
        title="Find the impostor"
        note="Nobody is told who the impostor is, not even the impostor. From seven players there are two, with the same word."
      >
        <p>
          Everyone gets the same <b>secret word</b>, such as Cat. The{' '}
          <b>impostor</b> gets a close one, such as Fox. Find them, or blend in
          if it turns out to be you.
        </p>
      </RuleSection>
      <RuleSection
        title="Draw it"
        note="Pick an ink and a pen size beside the card; undo takes back your last line."
      >
        <p>
          Everyone draws their word at once, in <b>{drawMs / 1000} seconds</b>,
          without letters. Tap <b>Done</b> to finish early.
        </p>
      </RuleSection>
      <RuleSection
        title="One word"
        note={`Up to ${clueLimit} letters. You can unlock until everyone has locked.`}
      >
        <p>
          Every drawing goes up on the board. Write <b>one word</b> that fits
          your word without naming it. If the drawings look wrong to you, you
          may be the impostor.
        </p>
      </RuleSection>
      <RuleSection title="Accuse">
        <p>
          Talk it over, then tap the player you suspect and <b>lock</b>.
          Accusing an impostor scores <b>{foundPoints}</b>. An impostor without
          the most accusations <b>escapes</b> and scores <b>{escapePoints}</b>;
          a tie at the top catches them.
        </p>
      </RuleSection>
      <RuleSection
        title="What next?"
        note={`With Votes on in setup, the table has ${roundVoteMs / 1000} seconds to vote instead. Silent players don’t count.`}
      >
        <p>
          The reveal shows both words. Then the <b>host picks</b> another round
          or End. The <b>most points</b> wins.
        </p>
      </RuleSection>
    </Rules>
  );
}

/** How to play for the party games (Know Me: Top Five, Dial and Ten Coins; Trivia: Atlas, Sizes, Years and Order). The practice coach has
 * its own four short steps in `lib/games/adventures/lessons.ts`; both take
 * their numbers from the engines. */
export function PartyRules({
  kind,
  triviaMode = 'quick',
  legacyTrivia = false,
}: {
  kind: StandaloneId;
  triviaMode?: TriviaMode;
  legacyTrivia?: boolean;
}) {
  switch (kind) {
    case 'dial':
      return <DialRules />;
    case 'coins':
      return <CoinsRules />;
    case 'miro':
      return <AtlasRules mode={triviaMode} legacy={legacyTrivia} />;
    case 'size':
      return <SizesRules mode={triviaMode} legacy={legacyTrivia} />;
    case 'year':
      return <YearsRules mode={triviaMode} legacy={legacyTrivia} />;
    case 'order':
      return <OrderRules mode={triviaMode} legacy={legacyTrivia} />;
    case 'impostor':
      return <ImpostorRules />;
    default:
      return <TopFiveRules />;
  }
}
