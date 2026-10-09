import { dishes } from '@/lib/games/diner/content';
import { BASE_LIVES } from '@/lib/games/diner/campaign-content';
import { CHAPTERS, LEVEL_COUNT } from '@/lib/games/diner/levels';
import { RuleList, RuleSection, Rules } from '../rules';
import { DinerIcon } from './icons';

/** How to play Diner, in the shared rules pieces (Arena's pattern). */
export function DinerRules({ campaign = false }: { campaign?: boolean }) {
  return (
    <Rules className="diner-rules">
      <RuleSection
        title={campaign ? 'One night on the road' : 'Forty levels'}
        note={
          campaign
            ? 'Lives you lose stay lost until a Motel or the Garage gives some back.'
            : 'A party that runs out of patience walks out and costs one life. Lose them all and the shift ends.'
        }
      >
        {campaign ? (
          <>
            <p>
              Drive the diner truck down the road. At every fork the road splits
              toward <b>two stops</b>: drive into its lot and press{' '}
              <b>Stop here</b>. Each place has its own crowd and trouble, and
              its sign shows how busy it is, the <b>gas</b> and what finishing
              pays.
            </p>
            <p>
              You start with <b>{BASE_LIVES} lives</b> for the whole run. Three{' '}
              <b>bosses</b> close the three legs of the night.
            </p>
          </>
        ) : (
          <p>
            Each level is a short shift at one of {CHAPTERS.length} places.
            Finish with a <b>medal</b> and a life left to open the next one. The
            opening card shows what is <b>new</b> and the <b>kit</b> you have,
            and {LEVEL_COUNT} levels later you have everything.
          </p>
        )}
      </RuleSection>
      {campaign && (
        <>
          <RuleSection
            title="Coins and gas"
            note="Medals in a shift pay extra tokens."
          >
            <p>
              Coins stay in your wallet. Driving to a stop costs <b>gas</b>; if
              you cannot pay, pushing the car costs a life. Spend the rest at
              the <b>Garage</b> on equipment and repairs.
            </p>
          </RuleSection>
          <RuleSection title="Equipment and Workshop">
            <p>
              Stops with a <b>crate</b> let you pick one of three pieces of
              equipment for this run. Every run banks <b>tokens</b>; spend them
              in the <b>Workshop</b> to upgrade the car for the next run.
            </p>
          </RuleSection>
        </>
      )}
      <RuleSection
        title="Use does the obvious thing"
        note="Use shows its picture and one word before you press it."
      >
        <p>
          <b>Use</b> first <b>gives</b> what you hold to whatever wants it, then{' '}
          <b>takes</b> what is ready, then <b>starts</b> what is needed.
        </p>
      </RuleSection>
      <RuleSection title="Seat and order">
        <p>
          Guests come in by the gate and wait in rows on the left. Use beside a
          party and they follow you; Use beside a free booth <b>big enough</b>{' '}
          to seat them. When the <b>bell</b> rings, Use at the booth to take the
          order.
        </p>
      </RuleSection>
      <RuleSection
        title="Cook and serve"
        note="A machine only starts a dish someone still needs. With nothing ordered, it makes one ahead."
      >
        <p>
          The kitchen is the open hatch of the truck. You carry{' '}
          <b>two plates</b>. Use at a machine to start a dish and again to take
          it when ready. Use at a booth to serve the plate a guest ordered. A
          burger or fries left too long <b>burns</b>: take it to the <b>bin</b>.
        </p>
      </RuleSection>
      <RuleSection
        title="Clear and get paid"
        note="A stack of dirty plates fills both hands."
      >
        <p>
          When everyone has eaten they leave <b>coins</b> and dirty plates. With
          empty hands, Use at the booth to take both, then Use at the{' '}
          <b>sink</b>. Each guest pays <b>10</b>, plus up to <b>5</b> tip for
          patience left.
        </p>
      </RuleSection>
      <RuleSection
        title="Spot the mimics"
        note="Skin and hair are never a clue, and only a party of three or four can hide a mimic."
      >
        <p>
          A party wears <b>the same outfit</b>. A mimic gets{' '}
          <b>one thing wrong</b>: the hat, the shirt colour, stripes or dark
          glasses. Face it and press <b>Out!</b> for <b>15 coins</b>. Throw out
          a real guest and the party leaves, costing a life. A missed mimic
          bursts out with the bill and leaves <b>goo</b>: Use in it to mop.
        </p>
      </RuleSection>
      <RuleSection title="Trouble">
        <RuleList
          items={[
            { key: 'rush', name: 'Rushes', text: 'Guests arrive in waves.' },
            {
              key: 'big',
              name: 'Big spenders',
              text: 'Starred parties pay more and wait less.',
            },
            {
              key: 'jam',
              name: 'Jams',
              text: 'A machine shows a wrench: Use it until it runs.',
            },
            {
              key: 'spill',
              name: 'Spills',
              text: 'Puddles slow you down until you mop them.',
            },
            {
              key: 'power',
              name: 'Brownouts',
              text: 'The lights dip and cooking slows.',
            },
          ]}
        />
      </RuleSection>
      <RuleSection title="Menu" className="diner-rules-menu">
        <RuleList
          items={(Object.keys(dishes) as (keyof typeof dishes)[]).map((d) => ({
            key: d,
            mark: <DinerIcon name={d} />,
            name: dishes[d].name,
            text:
              dishes[d].cook === 0
                ? 'Ready at once from the pie case.'
                : `${dishes[d].cook} s${dishes[d].burn ? `, burns ${dishes[d].burn} s later` : ', never spoils'}.`,
          }))}
        />
      </RuleSection>
      <RuleSection
        title="Controls"
        note="Keys: WASD or arrows to walk and drive, Space or E for Use, Q or X for Out!, Shift to dash once you have skates, Escape for the menu."
      >
        <p>
          Turn your phone <b>sideways</b>: drag the stick on the left to walk,
          press the buttons on the right.{' '}
          {campaign
            ? 'The campaign is solo.'
            : 'At a table, up to four waiters share the coins and lives.'}
        </p>
      </RuleSection>
    </Rules>
  );
}
