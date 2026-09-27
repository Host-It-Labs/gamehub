import {
  BOSS_EVERY,
  LEVEL_NAMES,
  PUZZLES,
  REROLL_AFTER,
  START_LIVES,
  SUGGESTION_LIMIT,
} from '@/lib/games/folio/catalog';
import type { Difficulty, Kind, Puzzle } from '@/lib/games/folio/types';
import { RuleSection, Rules } from './rules';

/** How to play a Folio run: the goal, the path, the puzzles, the lives, the
 * levels and the change after a boss. */
export function FolioRunRules({
  difficulty,
  struck,
}: {
  difficulty: Difficulty;
  struck: Kind[];
}) {
  return (
    <Rules>
      <RuleSection title="Climb the trail">
        <p>
          Solve one famous puzzle after another and climb{' '}
          <b>as far as you can</b>. The trail never ends: the run is over when
          the crew runs out of lives.
        </p>
      </RuleSection>
      <RuleSection
        title="Pick your path"
        note="At a shared table the host picks and moves the crew on. Tap a stop to vote; everyone sees it."
      >
        <p>
          Each act is <b>{BOSS_EVERY - 1} rounds and a boss</b>. Pick the next
          stop on a path leading on.
        </p>
      </RuleSection>
      <RuleSection
        title="Solve the puzzle"
        note={`At a shared table the host plays the board. Your own moves become suggestions everyone sees; the host plays them or turns them down. You can have ${SUGGESTION_LIMIT} open at once.`}
      >
        <p>
          Each game plays like its original, with <b>its own limit</b>: 6
          guesses, 4 mistakes, 1 mine… The crew shares <b>one board</b>.
        </p>
      </RuleSection>
      <RuleSection title="Shared lives">
        <p>
          The crew has <b>{START_LIVES} lives</b>. Losing a puzzle, or giving
          up, costs one, and nothing restores it.
        </p>
      </RuleSection>
      <RuleSection
        title="Harder each act"
        note={`This run started at ${LEVEL_NAMES[difficulty].toLowerCase()}. Levels change the puzzles, never their limits.`}
      >
        <p>
          Each act ends with a <b>boss</b>, a harder version of one game. Every
          new act is <b>one level harder</b>, up to very hard.
        </p>
      </RuleSection>
      <RuleSection title="Reroll the boss">
        <p>
          Once you have played {REROLL_AFTER} rounds of an act, the die beside
          its boss wakes up. Tap it <b>once per act</b> to turn the boss into
          another game.
        </p>
      </RuleSection>
      <RuleSection
        title="After a boss"
        note={
          struck.length > 0
            ? `Removed so far: ${struck.map((k) => PUZZLES[k].name).join(', ')}.`
            : undefined
        }
      >
        <p>
          Beat a boss and you may <b>remove one game</b> from the run: any of
          the ten still in it, until six are left. Its stops ahead become other
          games.
        </p>
      </RuleSection>
    </Rules>
  );
}

/** Help for the puzzle in front of the crew. The dialog title names the game,
 * so its rules need no heading; a boss adds what it changes. */
export function FolioPuzzleRules({
  puzzle,
  practice,
}: {
  puzzle: Puzzle;
  practice: boolean;
}) {
  const info = PUZZLES[puzzle.kind];
  const lives = practice
    ? 'Practice puzzles never touch a run.'
    : `Losing it, or giving up, costs one of the crew’s ${START_LIVES} lives.`;
  return (
    <Rules>
      <RuleSection note={puzzle.boss ? undefined : lives}>
        <p>{info.rules}</p>
      </RuleSection>
      {puzzle.boss && (
        <RuleSection title={`Boss · ${info.boss.name}`} note={lives}>
          <p>{info.boss.rules}</p>
        </RuleSection>
      )}
    </Rules>
  );
}
