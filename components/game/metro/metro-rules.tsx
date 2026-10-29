import {
  BANK_CARDS,
  ROUNDS,
  type Extension,
} from '@/lib/games/metro/engine';
import {
  GOAL_POINTS,
  INTERCHANGE_POINTS,
  JOIN_BONUS,
  type BonusId,
  type GoalId,
} from '@/lib/games/metro/score';
import {
  Copy,
  Equal,
  Expand,
  Eye,
  LayoutGrid,
  MapPinned,
  Repeat,
  Scan,
  Shapes,
  SquareDashed,
  Target,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import { RuleList, RuleSection, Rules } from '../rules';
import { BankIcon, ShapeIcon, SwitchIcon } from './metro-art';

export const extensionNames: Record<Extension, string> = {
  goals: 'Goals',
  express: 'Express',
};
export const extensionIcons: Record<Extension, LucideIcon> = {
  goals: Target,
  express: Ticket,
};

export const goals: Record<GoalId, { name: string; text: string; Icon: LucideIcon }> = {
  whole: {
    name: 'Whole districts',
    text: 'Every station of two main districts is on your lines.',
    Icon: LayoutGrid,
  },
  grand: {
    name: 'Grand line',
    text: 'One colour passes three boxed stations.',
    Icon: SquareDashed,
  },
  spread: {
    name: 'Grand tour',
    text: 'Boxed stations in six different districts.',
    Icon: Shapes,
  },
  corners: {
    name: 'Far corners',
    text: 'Interchanges in two corner districts.',
    Icon: Scan,
  },
  every: {
    name: 'Whole city',
    text: 'Your lines reach all twelve districts.',
    Icon: MapPinned,
  },
};

export const bonuses: Record<BonusId, { name: string; text: string; Icon: LucideIcon }> = {
  peek: {
    name: 'Peek',
    text: 'Everyone sees the next card before it flips.',
    Icon: Eye,
  },
  outskirts: {
    name: 'Outskirts',
    text: 'A corner district counts as three districts for this line.',
    Icon: Expand,
  },
  double: {
    name: 'Double',
    text: 'Your busiest district counts twice for this line.',
    Icon: Copy,
  },
  repeat: {
    name: 'Repeat',
    text: 'The switch goes back into the pile once after it flips.',
    Icon: Repeat,
  },
  parallel: {
    name: 'Parallel',
    text: 'You may draw beside a section of another colour, between the same two stations.',
    Icon: Equal,
  },
};

/** How to play, in Arena's pattern (see `components/game/rules.tsx`). */
export function MetroRules() {
  return (
    <Rules className="metro-rules">
      <RuleSection title="Build four lines">
        <p>
          Everyone draws on their <b>own map</b> of the same city. Each round
          you build <b>one line</b> in a new colour: {ROUNDS} rounds, {ROUNDS}{' '}
          colours. After the last round, the most points wins.
        </p>
      </RuleSection>
      <RuleSection title="Two banks">
        <p>
          The river splits the city into the <b>Moon</b> bank and the{' '}
          <b>Sun</b> bank. Each colour has <b>two starts</b>, one on each bank,
          painted in its colour.
        </p>
        <RuleList
          className="metro-rule-marks"
          items={[
            { key: 'moon', mark: <BankIcon side="moon" />, name: 'Moon', text: 'The west bank.' },
            { key: 'sun', mark: <BankIcon side="sun" />, name: 'Sun', text: 'The east bank.' },
          ]}
        />
      </RuleSection>
      <RuleSection
        title="Draw a section"
        note="Never cross a line, never pass through a station, never draw a hop twice, never visit a station twice on one line."
      >
        <p>
          A card flips. It shows a <b>bank</b> and a <b>shape</b>. You may draw
          one section from an <b>end</b> of that bank’s line to the{' '}
          <b>next station</b> of that shape, straight along a dotted guide.{' '}
          <b>Tap a lit station</b>, then press <b>Done</b>. Drawing is always
          optional.
        </p>
        <RuleList
          className="metro-rule-marks"
          items={[
            {
              key: 'any',
              mark: <ShapeIcon shape="any" />,
              name: 'Star',
              text: 'Any shape. The station you reach gets a box.',
            },
            {
              key: 'switch',
              mark: <SwitchIcon />,
              name: 'Switch',
              text: 'The next card flips too. Draw one section on each half, from any of its stations, not only an end.',
            },
          ]}
        />
      </RuleSection>
      <RuleSection title="Join the starts">
        <p>
          Meet your other half at any of its stations to make <b>one line</b>.
          Once joined, every card works on either bank.
        </p>
      </RuleSection>
      <RuleSection
        title="The round ends"
        note={`The switch can come at any time; a round lasts five to nine turns.`}
      >
        <p>
          A round ends on the turn the <b>fifth card</b> of one bank flips. Each
          bank has {BANK_CARDS} cards: four shapes and a star.
        </p>
      </RuleSection>
      <RuleSection
        title="Scoring"
        note="Two halves that never met score apart, without the bonus. A tie goes to the best single line."
      >
        <p>
          A line scores the <b>districts</b> it passes through times the{' '}
          <b>most stations</b> it has in one district, plus{' '}
          <b>{JOIN_BONUS}</b> if it joins both starts. At the end, a station on{' '}
          <b>2, 3 or 4 lines</b> scores {INTERCHANGE_POINTS[2]},{' '}
          {INTERCHANGE_POINTS[3]} or {INTERCHANGE_POINTS[4]}; a boxed one counts
          twice.
        </p>
      </RuleSection>
      <RuleSection title="Districts">
        <p>
          The city has <b>eight main districts</b>, each its own wash of glaze,
          and <b>four corner districts</b> of a single station each.
        </p>
      </RuleSection>
    </Rules>
  );
}

export function ExtensionRules({ id }: { id: Extension }) {
  if (id === 'goals')
    return (
      <Rules className="metro-rules">
        <RuleSection note={`Two goals a match, ${GOAL_POINTS} points each.`}>
          <p>
            Two <b>goals</b> are drawn at the start. Everyone who reaches one
            by the end scores <b>{GOAL_POINTS}</b>.
          </p>
          <RuleList
            items={(Object.keys(goals) as GoalId[]).map((k) => {
              const G = goals[k];
              return { key: k, mark: <G.Icon />, name: G.name, text: G.text };
            })}
          />
        </RuleSection>
      </Rules>
    );
  return (
    <Rules className="metro-rules">
      <RuleSection note="Parallel never comes in the first round.">
        <p>
          Each round has its own <b>bonus</b>, the same for everyone. Four of
          the five come up, one a round.
        </p>
        <RuleList
          items={(Object.keys(bonuses) as BonusId[]).map((k) => {
            const B = bonuses[k];
            return { key: k, mark: <B.Icon />, name: B.name, text: B.text };
          })}
        />
      </RuleSection>
    </Rules>
  );
}
