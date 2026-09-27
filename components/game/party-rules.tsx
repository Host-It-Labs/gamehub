import type { StandaloneId } from '@/lib/games/standalone/types';
import { nearPoints, perfectPoints } from '@/lib/games/party/ranking';
import { bands, points as dialPoints } from '@/lib/games/party/dial';
import { maxPinPoints, pinCurve } from '@/lib/games/party/geography';
import { curve } from '@/lib/games/party/size';
import { roundVoteMs } from '@/lib/games/party/vote';
import { RuleList, RuleSection, Rules } from './rules';

const percent = (e: number) => `${Math.round(e * 100)}%`;
/** Sizes' curve at a glance: full marks, two steps down, and nothing. */
const marks = [0, 2, 4, curve.length - 1];
/** Atlas' distance curve at a glance. */
const pinMarks = [0, 2, 4, pinCurve.length - 1];
const km = (d: number) => `${d.toLocaleString('en')} km`;

/** The end-of-round vote every party game shares. */
function RoundVote({
  when,
  again,
  other,
}: {
  when: string;
  again: string;
  other: string;
}) {
  return (
    <RuleSection
      title="Another round?"
      note="Silent players don’t count, and a tie never ends the match."
    >
      <p>
        {when}, the table has <b>{roundVoteMs / 1000} seconds</b> to vote:{' '}
        {again} again, {other}, or End. Points carry across both games, and the{' '}
        <b>most points</b> wins.
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
      <RuleSection title="Guess each list">
        <p>
          Then each list takes a turn. Everyone but its author ranks it{' '}
          <b>the way they think the author did</b>, and locks. You can unlock
          until everyone has locked.
        </p>
      </RuleSection>
      <RuleSection title="Closer scores more">
        <p>
          Each answer scores <b>{nearPoints[0]}</b> on the author’s exact rank
          and <b>{nearPoints[1]}</b> one rank away, so a perfect list scores{' '}
          <b>{perfectPoints}</b>. The author scores nothing on their own list.
          The host presses <b>Next</b> to move on.
        </p>
      </RuleSection>
      <RoundVote when="When every list is done" again="Top Five" other="Dial" />
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
          Everyone gets <b>their own spectrum</b> at once: pick one of two, such
          as Cold – Hot, and only you see its <b>hidden point</b>. Type a short
          clue that sits right there, like “A bath” a little towards Hot, and
          lock it.
        </p>
      </RuleSection>
      <RuleSection title="Read the clues">
        <p>
          The clues come up <b>one after the other</b>. Everyone but the author
          turns <b>their own dial</b> to where they think the point is, and
          locks. The author stays quiet.
        </p>
      </RuleSection>
      <RuleSection title="Closer scores more">
        <p>
          The dial runs from 0 to 100. The author earns the <b>average</b> of
          everyone’s points. The host presses <b>Next</b> for the next clue.
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
      <RoundVote when="When every clue is read" again="Dial" other="Top Five" />
    </Rules>
  );
}

function AtlasRules() {
  return (
    <Rules>
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
      <RoundVote when="After the final" again="Atlas" other="Sizes" />
    </Rules>
  );
}

function SizesRules() {
  return (
    <Rules>
      <RuleSection title="Size it up">
        <p>
          One silhouette stands at its <b>true size</b>. Resize the{' '}
          <b>red one</b> to its own real size beside it. Each round has 3: an
          animal, an object or landmark, then a country.
        </p>
      </RuleSection>
      <RuleSection
        title="Resize and lock"
        note="Drag it to move it, and use + and − to zoom the board."
      >
        <p>
          Pull the red silhouette’s <b>corner handle</b>, or pinch, to resize
          it. Size all three, then <b>lock</b> once. You can unlock until
          everyone has locked.
        </p>
      </RuleSection>
      <RuleSection
        title="Closer scores more"
        note="Points fall steadily between these marks."
      >
        <p>
          The host reveals the three one at a time. Each guess scores up to{' '}
          <b>{curve[0][1]}</b>, by how far off it is.
        </p>
        <RuleList
          items={marks.map((i) => ({
            key: `${curve[i][0]}`,
            name: `${curve[i][1]} points`,
            text:
              i === 0
                ? `Within ${percent(curve[i][0])}`
                : i === curve.length - 1
                  ? `${percent(curve[i][0])} off or more`
                  : `${percent(curve[i][0])} off`,
          }))}
        />
      </RuleSection>
      <RoundVote when="After the third reveal" again="Sizes" other="Atlas" />
    </Rules>
  );
}

/** How to play for the party games (Know Me: Top Five and Dial; Quiz: Atlas
 * and Sizes). The practice coach has its own four short steps in
 * `lib/games/adventures/lessons.ts`; both take their numbers from the engines. */
export function PartyRules({ kind }: { kind: StandaloneId }) {
  return kind === 'dial' ? (
    <DialRules />
  ) : kind === 'miro' ? (
    <AtlasRules />
  ) : kind === 'size' ? (
    <SizesRules />
  ) : (
    <TopFiveRules />
  );
}
