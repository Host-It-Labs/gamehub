import { formatNumber } from '@/lib/games/relic/engine';
import { BLUEPRINTS } from '@/lib/games/relic/factory';
import {
  JACKPOTS,
  LEVEL_AT,
  BOOK_LEVEL_STEP,
  BOOK_LEVEL_GAIN,
  PACKS,
  levelMult,
  packFor,
  type PackId,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from './relic-scratch-art';
import { RuleList, RuleSection, Rules } from './rules';

/** Each book's puzzle in one short line; names and art come from the books. */
const PUZZLES: Record<PackId, string> = {
  seven: 'Find every 7. Each miss points to the nearest one.',
  twins: 'Scratch a seal, then its twin beside it with the same number.',
  path: 'Draw one path from 1 through every seal, numbers in order, never across a hedge.',
  ladder:
    'Scratch ▲ if the next card is higher, ▼ if lower. Each card comes once.',
  mine: 'Dig every gem. Numbers count the dynamite around them.',
  sunmoon:
    'Scratch the moons. Rows and columns hold equal suns and moons, never 3 alike in a line. = same, × different.',
  chart: 'Edge numbers count ship parts. Ships never touch, even at corners.',
  crown:
    'One crown per row, column and colour, never touching, even at corners.',
};

/** How to play Lucky: tickets, price, the books, levels, upgrades, the factory and playing together. */
export function LuckyRules() {
  return (
    <Rules>
      <RuleSection
        title="Scratch tickets"
        note="Keyboard: move with the arrows while holding Space."
      >
        <p>
          Win <b>coins</b> by scratching tickets. Buy one from a book on the
          shelf and <b>rub the foil</b>. A wrong seal costs a <b>heart</b>.
        </p>
        <p>
          A ticket <b>pays</b> the moment it is over, and <b>Again</b> buys the
          same one.
        </p>
      </RuleSection>
      <RuleSection
        title="Price and jackpot"
        note={`${packFor('seven').name} I is free when you cannot pay for it.`}
      >
        <p>
          A ticket costs <b>half</b> of what a careful player wins on average,
          so a messy one can lose. Solve it all for a{' '}
          <b>×{JACKPOTS[0]} jackpot</b>.
        </p>
      </RuleSection>
      <RuleSection title="The books">
        <RuleList
          items={PACKS.map((b) => ({
            key: b.id,
            mark: <img src={TICKET_ART[b.id].small} alt="" />,
            name: b.name,
            text: PUZZLES[b.id],
          }))}
        />
      </RuleSection>
      <RuleSection
        title="Levels and difficulty"
        note="Early print lowers these counts."
      >
        <p>
          Difficulty <b>II</b> opens after <b>{LEVEL_AT[1]}</b> tickets of a
          book and <b>III</b> after <b>{LEVEL_AT[2]}</b>, paying{' '}
          <b>×{levelMult(0, 1)}</b> and <b>×{levelMult(0, 2)}</b>. Easier ones
          stay open.
        </p>
        <p>
          Your book level <b>never stops</b>. After III opens, finish
          <b> {BOOK_LEVEL_STEP}</b> difficulty III tickets for level 4, then
          <b> {BOOK_LEVEL_STEP * 2}</b> for level 5, and so on. Each level adds
          <b> {BOOK_LEVEL_GAIN * 100}%</b> of the level 3 value to prizes,
          prices and factory sales. The shelf bar shows your next level.
        </p>
      </RuleSection>
      <RuleSection title="Buy upgrades">
        <p>
          Each <b>upgrade</b> opens once you own the one before it. Every book
          on the shelf adds its own.
        </p>
      </RuleSection>
      <RuleSection
        title="Build a factory"
        note="Keys: V select, E remove, R rotate, 1–0 machines, Delete removes, Esc lets go. Shift-click or drag over empty floor to select several."
      >
        <p>
          The <b>factory</b> costs {formatNumber(BLUEPRINTS[0].price)} and runs
          while someone has Lucky open. <b>Printers</b> print free tickets at a
          book&rsquo;s highest difficulty, <b>bots</b> scratch them,{' '}
          <b>cashiers</b> sell them and <b>belts</b> link them. One printer
          keeps <b>three bots</b> busy.
        </p>
        <p>
          Each machine&rsquo;s lamp shows how it is doing: <b>green</b> working,{' '}
          <b>amber</b> waiting for room, <b>red</b> stuck, dark with nothing to
          do. Pick a machine to see where tickets go in (green arrows) and come
          out (orange).
        </p>
      </RuleSection>
      <RuleSection
        title="Inspect the floor"
        note="Keys: + and − zoom, F fits the floor, P pans."
      >
        <p>
          Use the <b>wheel</b> or <b>pinch</b> to zoom. Pick <b>Pan</b> to drag
          the view, or <b>Fit</b> to see the whole factory again.
        </p>
      </RuleSection>
      <RuleSection title="Play together">
        <p>
          Coins, books, upgrades and the factory are <b>shared</b>. Everyone
          holds <b>their own ticket</b>, and <b>Watch</b> shows another
          player&rsquo;s screen.
        </p>
      </RuleSection>
    </Rules>
  );
}
