import {
  Check,
  Circle,
  Copy,
  Flower2,
  Footprints,
  Grid2x2,
  Heart,
  Lightbulb,
  Waypoints,
  PawPrint,
  Package,
  Home,
  Square,
  Trees,
  Eye,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  sanctuaryGoalsFor,
  tokenImage,
  type ContentSet,
  sanctuaryGoalProgress,
  type Card,
  type SanctuaryGoal,
} from '@/lib/games/trio/engine';
import { Piece, type Inspect } from './interactions';
import { RuleExplanation } from './extension-rules';

function GoalArt({
  goal,
  contentSet,
}: {
  goal: SanctuaryGoal;
  contentSet?: ContentSet;
}) {
  if (goal.kind !== undefined)
    return (
      <span className="sanctuary-goal-creature">
        <span className="token-art" aria-hidden="true">
          <img
            src={tokenImage(goal.kind, false, contentSet)}
            alt=""
            draggable={false}
          />
        </span>
      </span>
    );
  const Icon = ({
    full: Home,
    squares: Square,
    rounds: Circle,
    herd: PawPrint,
    mirror: Copy,
    family: Users,
    diversity: Sparkles,
    habitats: Trees,
    pairs: Heart,
    variety: Flower2,
    twins: Grid2x2,
    fill: Package,
    trail: Footprints,
    lookout: Eye,
    spread: Waypoints,
    lighthouse: Lightbulb,
  } satisfies Record<SanctuaryGoal['type'], unknown>)[goal.type];
  return <Icon size={30} aria-hidden="true" />;
}

function GoalRules({
  id,
  zones,
  contentSet,
}: {
  id: number;
  zones?: Card[][];
  contentSet?: ContentSet;
}) {
  const goal = sanctuaryGoalsFor(contentSet)[id];
  const status = zones ? sanctuaryGoalProgress(zones, id, contentSet) : null;
  return (
    <RuleExplanation
      outcome={goal.rule}
      note="Only your own board counts. Released creatures never count. Awarded once at the end of this match."
    >
      <p>
        <b>Reward.</b> Earn +{goal.points} points when complete.
      </p>
      {status && (
        <p>
          <b>Progress.</b> {status.progress}/{goal.target} ·{' '}
          {status.complete ? 'Completed!' : 'In progress'}
        </p>
      )}
    </RuleExplanation>
  );
}

export function WildTrailsRules({
  zones,
  goals,
  contentSet,
  compact = false,
}: {
  contentSet?: ContentSet;
  zones?: Card[][];
  goals?: number[];
  /** In-match inspection: the goals themselves, side by side, without the introduction. */
  compact?: boolean;
}) {
  if (compact)
    return (
      <div className="goal-cards">
        {goals?.map((id) => {
          const goal = sanctuaryGoalsFor(contentSet)[id];
          const status = zones ? sanctuaryGoalProgress(zones, id, contentSet) : null;
          return (
            <section key={id} className={`goal-card ${status?.complete ? 'complete' : ''}`}>
              <span className="sanctuary-goal-medal"><GoalArt goal={goal} contentSet={contentSet} /></span>
              <h3>{goal.name}</h3>
              <p>{goal.rule}</p>
            </section>
          );
        })}
      </div>
    );
  return (
    <>
      <RuleExplanation
        outcome={
          <>
            Complete three randomly drawn goals for <b>bonus points</b>.
          </>
        }
        note="Goals stay the same for every round. Released creatures never count. Normal placement, habitat scoring and the die stay the same."
      >
        <p>
          <b>Discover.</b> Each new match draws three goals from twelve.
          Everyone receives the same goals and completes them on their own
          board.
        </p>
        <p>
          <b>Track.</b> Badges on your board show what to collect, your progress
          and the reward. A completed badge turns gold.
        </p>
        <p>
          <b>Inspect.</b> Tap or hold a badge, or focus it and press I, for its
          exact requirement.
        </p>
        <p>
          <b>Score.</b> Earn each completed badge’s points once, at the end of
          the match.
        </p>
      </RuleExplanation>
      {goals?.map((id) => (
        <section key={id}>
          <h3>{sanctuaryGoalsFor(contentSet)[id].name}</h3>
          <GoalRules id={id} zones={zones} contentSet={contentSet} />
        </section>
      ))}
    </>
  );
}

export function SanctuaryBadges({
  zones,
  goals,
  inspect,
  contentSet,
}: {
  contentSet?: ContentSet;
  zones: Card[][];
  goals?: number[];
  inspect?: Inspect;
}) {
  if (!goals) return null;
  const summary = goals.map((id) => {
    const goal = sanctuaryGoalsFor(contentSet)[id];
    const status = sanctuaryGoalProgress(zones, id, contentSet);
    return `${goal.name} ${status.progress} of ${status.complete ? goal.target + ', complete' : goal.target}`;
  }).join('. ');
  const show = () =>
    inspect?.({
      title: 'Sanctuary goals',
      wide: true,
      body: <WildTrailsRules zones={zones} goals={goals} contentSet={contentSet} compact />,
    });
  const card = goals.map((id) => {
    const goal = sanctuaryGoalsFor(contentSet)[id];
    const status = sanctuaryGoalProgress(zones, id, contentSet);
    return (
      <span key={id} className={`sanctuary-goal ${status.complete ? 'complete' : ''}`}>
        <span className="sanctuary-goal-medal">
          <GoalArt goal={goal} contentSet={contentSet} />
          <span className="sanctuary-goal-reward">
            {status.complete ? <Check size={13} /> : `+${goal.points}`}
          </span>
        </span>
        <strong>{goal.name}</strong>
        <span className="sanctuary-goal-count" aria-hidden="true">
          {status.progress}<small>/{goal.target}</small>
        </span>
      </span>
    );
  });
  if (!inspect) return <div className="sanctuary-goals" aria-label={`Sanctuary goals. ${summary}`}>{card}</div>;
  return (
    <Piece className="sanctuary-goals" label={`Sanctuary goals. ${summary} Hold or press I for the rules.`} inspect={show} onTap={show}>
      {card}
    </Piece>
  );
}
