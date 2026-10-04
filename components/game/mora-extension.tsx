import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  sanctuaryGoalsFor,
  tokenImage,
  type ContentSet,
  sanctuaryGoalProgress,
  type Card,
  type SanctuaryGoal,
} from '@/lib/games/trio/engine';
import { Piece, type Inspect } from './interactions';
import { RuleList, RuleSection, type RuleListItem } from './rules';
import { GoalIcon } from './goal-icon';

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
  return <GoalIcon goal={goal} />;
}

/** One drawn goal as a reference line, with live progress when a board is given. */
function goalItem(id: number, zones?: Card[][], contentSet?: ContentSet): RuleListItem {
  const goal = sanctuaryGoalsFor(contentSet)[id];
  const status = zones ? sanctuaryGoalProgress(zones, id, contentSet) : null;
  return {
    key: String(id),
    mark: <GoalArt goal={goal} contentSet={contentSet} />,
    name: `${goal.name} · +${goal.points}`,
    text: status
      ? `${goal.rule} ${status.complete ? 'Done.' : `${status.progress}/${goal.target}.`}`
      : goal.rule,
  };
}

export function WildTrailsRules({
  zones,
  goals,
  contentSet,
  compact = false,
  title,
}: {
  contentSet?: ContentSet;
  zones?: Card[][];
  goals?: number[];
  /** In-match inspection: the goals themselves, side by side, without the introduction. */
  compact?: boolean;
  /** Only where no dialog title already names the extension. */
  title?: ReactNode;
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
    <RuleSection
      title={title}
      note="Released creatures never count. Each goal scores once."
    >
      <p>
        Each game draws <b>3 goals</b> from 12, the same for everyone. Every
        goal your board meets at the end earns its <b>bonus</b>.
      </p>
      {goals && (
        <RuleList items={goals.map((id) => goalItem(id, zones, contentSet))} />
      )}
    </RuleSection>
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
