import { formatNumber } from '@/lib/games/relic/engine';
import { BLUEPRINTS, MACHINES, ORDER } from '@/lib/games/relic/factory';
import {
  JACKPOTS,
  DIFFICULTY_AT,
  INFINITY_AT,
  XP_SCALE,
  XP_WEIGHTS,
  BOOK_LEVEL_GAIN,
  PACKS,
  levelMult,
  packFor,
  type PackId,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from './relic-scratch-art';
import { MachineIcon } from './relic-factory/machine-icon';
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
        note="Keyboard: Enter buys; move with the arrows while holding Space."
      >
        <p>
          Win <b>coins</b> by scratching tickets. <b>Pick a book</b> on the
          shelf and its difficulty, then <b>Buy</b> beside the ticket and{' '}
          <b>rub the foil</b>. A wrong seal costs a <b>heart</b>.
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
        title="Difficulty"
        note="The factory prints up to III, never IV."
      >
        <p>
          Each book has four difficulties: <b>I</b>, <b>II</b>, <b>III</b> and{' '}
          <b>IV</b>, its hardest ticket. II opens at book level{' '}
          <b>{DIFFICULTY_AT[1]}</b>, III at level <b>{DIFFICULTY_AT[2]}</b> and
          IV at level <b>{INFINITY_AT}</b>. They pay <b>×{levelMult(0, 1)}</b>,{' '}
          <b>×{levelMult(0, 2)}</b> and <b>×{levelMult(0, 3)}</b>. Easier ones
          stay open.
        </p>
      </RuleSection>
      <RuleSection title="Book levels" note="Early print shortens every level.">
        <p>
          Each ticket earns <b>XP</b> for its book, for how <b>well</b> you
          played it. A ticket that wins about the average earns{' '}
          <b>{XP_WEIGHTS.map((w) => w * XP_SCALE).join(', ')}</b> XP on I, II,
          III and IV; a jackpot earns more, a poor ticket nothing.
        </p>
        <p>
          Levels <b>never stop</b>, and only harder tickets keep them moving
          quickly. Each level past 3 adds <b>{BOOK_LEVEL_GAIN * 100}%</b> of the
          level 3 value to prizes, prices and factory sales.
        </p>
      </RuleSection>
      <RuleSection title="Buy upgrades">
        <p>
          Each <b>upgrade</b> opens once you own the one before it. Every book
          on the shelf adds its own.
        </p>
      </RuleSection>
      <RuleSection title="Build a factory">
        <p>
          The <b>factory</b> costs {formatNumber(BLUEPRINTS[0].price)} and runs
          while someone has Lucky open. <b>Printers</b> print tickets,{' '}
          <b>bots</b> scratch them and <b>cashiers</b> sell them; <b>belts</b>{' '}
          carry them between. One printer keeps <b>three bots</b> busy.
        </p>
        <p>
          Tickets go into a machine at its <b>back</b> or sides and come out of
          its <b>orange chute</b>. Its lamp shows how it is doing: <b>green</b>{' '}
          working, <b>amber</b> waiting for room, <b>red</b> stuck, dark with
          nothing to do.
        </p>
      </RuleSection>
      <RuleSection title="The machines">
        <RuleList
          className="relic-machine-list"
          items={ORDER.map((kind) => ({
            key: kind,
            mark: <MachineIcon kind={kind} />,
            name: MACHINES[kind].name,
            text: MACHINES[kind].does,
          }))}
        />
      </RuleSection>
      <RuleSection
        title="Build and edit"
        note="Keys: V select, E erase, R rotate, Q picks the machine under the pointer, 1–0 machines, ⌘C copy, ⌘V paste, ⌘D duplicate, ⌘Z undo, Delete removes, arrows move the selection, Esc lets go."
      >
        <p>
          Pick a machine and <b>tap</b> the floor to place it. It faces the flow
          on its own; <b>Rotate</b> turns it. <b>Drag</b> to draw belts, or drag
          the orange handle of a selected machine to pull a belt out of it.
        </p>
        <p>
          <b>Drag</b> a machine to move it, or drag across empty floor to select
          several. Selected machines <b>rotate</b>, <b>copy</b> and{' '}
          <b>delete</b> together; deleting gives their price back. <b>Undo</b>{' '}
          takes back any change for free.
        </p>
      </RuleSection>
      <RuleSection
        title="Move the view"
        note="Keys: + and − zoom, F fits the floor, arrows pan when nothing is selected."
      >
        <p>
          Use the <b>wheel</b> or <b>pinch</b> to zoom, and <b>two fingers</b>{' '}
          or the <b>right mouse button</b> to move the view. <b>Fit</b> shows
          the whole factory again.
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
