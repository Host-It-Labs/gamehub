import { maps, MAP_IDS, type MapId } from '@/lib/games/rota/maps';
import { SPECIALS, SPECIALS_PER_MATCH } from '@/lib/games/rota/pieces';
import { pieces } from '@/lib/games/rota/pieces';
import {
  OUTLET_POINTS,
  PLAN_IDS,
  RIVER_POINTS,
  TOWN_CAP,
  TUNNEL_POINTS,
  plans,
} from '@/lib/games/rota/score';
import type { Extension } from '@/lib/games/rota/engine';
import { RuleList, RuleSection, Rules } from '../rules';
import { PieceIcon } from './route-art';

export const extensionNames: Record<Extension, string> = {
  rivers: 'Rivers',
  plans: 'Plans',
  towns: 'Mills',
  rockfall: 'Rockfall',
};

export const mapLines: Record<MapId, string> = {
  meadow: 'Seven rounds on a seven-by-seven board, with twelve exits.',
  harbour: 'Ten rounds around a deep dock basin, with four wharves.',
  ridge: `Fourteen rounds across two rock bands. Only straights cross an outcrop: each tunnel scores ${TUNNEL_POINTS}.`,
  capital: 'Eight by eight, sixteen exits, eight rounds.',
};

const originalMapLines: Record<MapId, string> = {
  meadow: 'The edge of town, twelve exits.',
  harbour: 'The docks take a corner; two wharves reach into them.',
  ridge: `Four rock outcrops take only a straight: each tunnel scores ${TUNNEL_POINTS}.`,
  capital: 'Eight by eight, sixteen exits, eight rounds.',
};

/** How to play: the goal, placing the dice, junctions, specials, scoring,
 *  the maps and the end. Arena's pattern (see `components/game/rules.tsx`). */
export function RotaRules({ map, rounds }: { map?: MapId; rounds?: number }) {
  const original =
    map &&
    (map === 'capital' ||
      (rounds !== undefined && rounds !== maps[map].rounds));
  return (
    <Rules className="rota-rules">
      <RuleSection title="Link the exits">
        <p>
          Each round everyone draws with the <b>same dice</b> on their own
          sheet. Build roads and rails that link the <b>exits</b> on the edge.
          After the last round, the most points wins.
        </p>
      </RuleSection>
      <RuleSection
        title="Place the dice"
        note="A die that fits nowhere is lost. Undo takes back your last piece until you press Done."
      >
        <p>
          <b>Tap a die</b>, then a lit square, or drag it there. Tap the piece
          again to <b>turn</b> it. Every piece must <b>join</b> an exit or a
          route of the same kind, and a road may never run into a rail. Place
          <b> all four dice</b>, then press <b>Done</b>.
        </p>
      </RuleSection>
      <RuleSection title="Junctions">
        <p>
          The fourth die is a junction. An <b>overpass</b> carries a road over a
          rail without joining them. A <b>station</b> is where a road turns into
          a rail.
        </p>
      </RuleSection>
      <RuleSection
        title="Specials"
        note={`One a round, ${SPECIALS_PER_MATCH} a match, each once.`}
      >
        <p>
          Beside the dice sit <b>six specials</b>: crossings and big stations.
          You may add one to a round, on top of the dice.
        </p>
        <RuleList
          className="rota-rule-pieces"
          items={SPECIALS.map((p) => ({
            key: p,
            mark: <PieceIcon p={p} />,
            name: pieces[p].name,
            text: specialLine[p] ?? '',
          }))}
        />
      </RuleSection>
      <RuleSection
        title="Scoring"
        note="A loose end runs into open ground, a blank side, the map’s edge away from an exit, the sea or rubble."
      >
        <p>
          Each network scores for the <b>exits</b> it links: 2 exits score 4,
          then <b>4 more</b> for each extra exit, and 4 more again for linking
          them all. Your longest <b>road</b> and longest <b>rail</b> score a
          point a square. Each <b>centre</b> square you build on scores 1. Each{' '}
          <b>loose end</b> costs 1.
        </p>
      </RuleSection>
      <RuleSection title="The maps">
        <RuleList
          items={(original ? [map] : MAP_IDS).map((id) => ({
            key: id,
            name: maps[id].name,
            text: original ? originalMapLines[id] : mapLines[id],
          }))}
        />
      </RuleSection>
      <RuleSection title="The end">
        <p>
          {map ? (
            <>
              The match lasts <b>{rounds ?? maps[map].rounds} rounds</b>.
            </>
          ) : (
            <>
              Play <b>7 rounds</b> on Meadow, <b>10</b> on Harbour or <b>14</b>{' '}
              on Ridge.
            </>
          )}{' '}
          Most points wins; <b>fewer loose ends</b> breaks a tie.
        </p>
      </RuleSection>
    </Rules>
  );
}

const specialLine: Partial<Record<(typeof SPECIALS)[number], string>> = {
  'road-cross': 'Four roads.',
  'rail-cross': 'Four rails.',
  'station-tee-road': 'A road running through, a rail branching off.',
  'station-tee-rail': 'A rail running through, a road branching off.',
  'station-cross': 'Road on two sides, rail on two, all joined.',
  'station-corner': 'Two roads meeting two rails, all joined.',
};

/** One extension's rules, for the setup modal and the match menu. */
export function ExtensionRules({ id }: { id: Extension }) {
  if (id === 'rivers')
    return (
      <Rules className="rota-rules">
        <RuleSection
          title="A fifth die"
          note="River ends are never loose. A river never meets a road or a rail, except on a bridge."
        >
          <p>
            A <b>river die</b> joins the roll. It is <b>optional</b>. A river
            starts at the <b>edge</b> of the map or the sea, or runs on from one
            you drew. Bridges carry a road or a rail over it.
          </p>
        </RuleSection>
        <RuleSection title="Scoring">
          <p>
            Your <b>longest river</b> scores <b>{RIVER_POINTS} a square</b>, and{' '}
            <b>{OUTLET_POINTS} more</b> if it leaves the map at both ends.
          </p>
        </RuleSection>
      </Rules>
    );
  if (id === 'plans')
    return (
      <Rules className="rota-rules">
        <RuleSection
          title="Three plans"
          note="Everyone who completes a plan in the same first round scores the first value."
        >
          <p>
            Three plans are drawn for the match. Complete one by the end of a
            round and score its <b>first</b> value, or the <b>later</b> value if
            someone finished it in an earlier round.
          </p>
        </RuleSection>
        <RuleSection title="The plans">
          <RuleList
            items={PLAN_IDS.map((p) => ({
              key: p,
              name: plans[p].name,
              text: `${plans[p].text} ${plans[p].first} first, ${plans[p].later} later.`,
            }))}
          />
        </RuleSection>
      </Rules>
    );
  if (id === 'towns')
    return (
      <Rules className="rota-rules">
        <RuleSection
          title="Mill sites"
          note="A mill site takes only an overpass, a station or a special station."
        >
          <p>
            A few <b>mill sites</b> are marked on everyone’s map. Build a{' '}
            <b>junction</b> there: a piece with both road and rail.
          </p>
        </RuleSection>
        <RuleSection title="Scoring">
          <p>
            Each mill scores <b>a point per exit</b> its network links, up to{' '}
            <b>{TOWN_CAP}</b>.
          </p>
        </RuleSection>
      </Rules>
    );
  return (
    <Rules className="rota-rules">
      <RuleSection
        title="Old workings"
        note="There is no rockfall in the first or the last round."
      >
        <p>
          Each round old mine workings threaten <b>one square</b>, the same on
          every sheet and marked in red. If that square is <b>still empty</b> at
          the end of the round, it caves in to <b>rubble</b>: nothing can be
          built there, and ends facing it are loose.
        </p>
      </RuleSection>
    </Rules>
  );
}
