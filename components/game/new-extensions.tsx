'use client';
import { useState, type ReactNode } from 'react';
import { Crown, Footprints, Sun } from 'lucide-react';
import {
  canAct,
  censusBreakdown,
  censusPoints,
  counts,
  creaturesFor,
  decisionKey,
  foodsFor,
  dawnValue,
  goldValue,
  tideRanks,
  tokenImage,
  type Move,
  type PublicGame,
} from '@/lib/games/trio/engine';
import { RuleSection } from './rules';
import { Piece, type Inspect } from './interactions';
export type ExtensionKind =
  | 'roamEnabled'
  | 'census'
  | 'gold'
  | 'anchor'
  | 'dawn'
  | 'marketSeasons';
// The six picks of a round snake through two columns: across, down, back, down, across.
// Centres in a 100 × 100 box; the line stretches with the grid, so any cell size works.
const SEASON_ROUTE = [
  [25, 16.7],
  [75, 16.7],
  [75, 50],
  [25, 50],
  [25, 83.3],
  [75, 83.3],
];
function SeasonRouteLine({ reached }: { reached: number }) {
  const path = (points: number[][]) => points.map((p) => p.join(',')).join(' ');
  const route = [[4, 16.7], ...SEASON_ROUTE, [96, 83.3]];
  // The tail before the first pick counts as travelled once the round starts.
  const travelled = route.slice(0, Math.min(route.length, reached + 1));
  return (
    <svg
      className="season-line"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline className="season-line-ahead" points={path(route)} />
      {travelled.length > 1 && (
        <polyline className="season-line-done" points={path(travelled)} />
      )}
    </svg>
  );
}
/** One public route, shared by the live counter and the Others mats. */
export function SeasonTrack({ g, player, results = false }: {
  g: PublicGame; player: number; results?: boolean;
}) {
  const start = (g.round - 1) * 6;
  const cards = g.players[player].zones[0];
  return <span className={`season-route ${results ? 'season-results' : ''}`} aria-label="Market Seasons">
    <SeasonRouteLine reached={g.phase === 'over' ? SEASON_ROUTE.length + 1 : g.pick} />
    {g.seasonForecast?.slice(start, start + 6).map((kind, i) => {
      const played = cards[start + i];
      const matched = played?.kind === kind;
      const current = i === g.pick - 1 && g.phase !== 'over';
      const name = foodsFor(g.contentSet)[kind].name;
      return <span className="season-step" data-step={i} key={i}
        aria-label={results ? `${name}: ${matched ? 'matched' : played ? 'missed' : 'upcoming'}` : undefined}>
        {results && matched ? <span className="season-check" aria-hidden="true">✓</span> :
          <img className={results ? `unmatched ${current ? 'current' : ''}` : current ? 'current' : played ? 'past' : ''}
            src={tokenImage(kind, true, g.contentSet)} alt={results ? '' : name} />}
      </span>;
    })}
  </span>;
}

export function NewExtensionRules({
  kind,
  title,
  fastMode = false,
}: {
  kind: ExtensionKind;
  /** Only where no dialog title already names the extension. */
  title?: ReactNode;
  /** Nox's Fast deck, whose cards and values are smaller. */
  fastMode?: boolean;
}) {
  const deck = { fastMode };
  if (kind === 'roamEnabled')
    return (
      <RuleSection title={title} note="The habitat still needs a free space.">
        <p>
          Once per game, place a creature in a habitat <b>the die blocks</b>.
          Tap the <b>footprints</b>, then place your creature.
        </p>
      </RuleSection>
    );
  if (kind === 'census')
    return (
      <RuleSection
        title={title}
        note="Released creatures never count. You need at least one of a species to lead it."
      >
        <p>
          At the end, each species is counted across the table. The player with{' '}
          <b>the most</b> of it on their board earns <b>+{censusPoints.lead}</b>.
          Tied leaders earn <b>+{censusPoints.tie}</b> each.
        </p>
        <p>
          Watch the other boards: taking a creature someone needs can win you
          the lead. Tap the <b>crown</b> to see the count.
        </p>
      </RuleSection>
    );
  if (kind === 'gold')
    return (
      <RuleSection title={title} note="Scores can go below zero.">
        <p>
          The <b>{tideRanks(deck)}</b> of the die’s suit is <b>Gold</b>. Win the
          trick that holds it and take <b>{goldValue(deck)} points off</b> your
          score.
        </p>
      </RuleSection>
    );
  if (kind === 'dawn')
    return (
      <RuleSection
        title={title}
        note="The cards in that trick still count as usual."
      >
        <p>
          Win the <b>last trick</b> of a round and take{' '}
          <b>{dawnValue(deck)} extra points</b>. Keep a low card for the end.
        </p>
      </RuleSection>
    );
  if (kind === 'anchor')
    return (
      <RuleSection
        title={title}
        note="Gold counts double too. Dawn’s extra points do not."
      >
        <p>
          The <b>Storm 1</b> is the <b>Anchor</b>. The trick that holds it
          counts <b>double</b>. Sink it under a bigger Storm card someone
          else will win.
        </p>
      </RuleSection>
    );
  return (
    <RuleSection title={title}>
      <p>
        Each pick has one <b>featured dish</b>, shown in the forecast. Every
        dish is featured once a round. Keep the featured dish on its pick for{' '}
        <b>+2</b>, on top of its usual score.
      </p>
    </RuleSection>
  );
}
export type NatureChoice = { roam?: boolean };
export function useNatureChoice(g: PublicGame | null, viewer: number) {
  const key = g
    ? `${decisionKey(g)}:${g.players[viewer]?.hand.map((c) => c.id).join(',')}`
    : '';
  const [draft, setDraft] = useState<{ key: string; value: NatureChoice }>({
    key: '',
    value: {},
  });
  const choice =
    g?.roamEnabled && draft.key === key ? draft.value : {};
  return {
    choice,
    setChoice: (value: NatureChoice) => setDraft({ key, value }),
    withChoice: (move: Move): Move =>
      move.type === 'play' ? { ...move, ...choice } : move,
  };
}
export function ExtensionControls({
  g,
  viewer,
  choice,
  onChange,
  inspect,
  disabled = false,
}: {
  g: PublicGame;
  viewer: number;
  choice: NatureChoice;
  onChange: (choice: NatureChoice) => void;
  inspect: Inspect;
  disabled?: boolean;
}) {
  const p = g.players[viewer];
  const census = g.census ? censusBreakdown(g.players.map((q) => q.zones))[viewer] : null;
  const locked = disabled || !canAct(g, viewer) || g.phase !== 'play';
  const showRules = (kind: ExtensionKind, title: string) =>
    inspect({ title, body: <NewExtensionRules kind={kind} /> });
  return (
    <>
      {g.roamEnabled && (
        <Piece
          className="extension-action mora-roam-action"
          label={`Roam · ${p.roams ?? 0} remaining`}
          selected={!!choice.roam}
          unavailable={locked || !p.roams}
          onTap={
            locked || !p.roams
              ? undefined
              : () => onChange({ ...choice, roam: !choice.roam })
          }
          inspect={() => showRules('roamEnabled', 'Roam')}
        >
          <Footprints />
          <span className="extension-count">{p.roams ?? 0}</span>
        </Piece>
      )}
      {census && (
        <Piece
          className="extension-action mora-census-action"
          label={`Census · you lead ${census.leads.length} species and tie ${census.ties.length}: ${census.points} points. Open the count.`}
          onTap={() => inspect({ title: 'Census', body: <CensusCount g={g} viewer={viewer} /> })}
          inspect={() => showRules('census', 'Census')}
        >
          <Crown />
          <span className="extension-count">+{census.points}</span>
        </Piece>
      )}
      {g.marketSeasons && (
        <button
          className="season-forecast"
          aria-label={`Market Seasons · ${p.seasonPoints ?? 0} bonus points. Open rules.`}
          onClick={() => showRules('marketSeasons', 'Market Seasons')}
        >
          <Sun />
          <SeasonTrack g={g} player={viewer} />
          <b>+{p.seasonPoints ?? 0}</b>
        </button>
      )}
    </>
  );
}

/** Census: each species, your count against the best other count at the table. */
export function CensusCount({ g, viewer }: { g: PublicGame; viewer: number }) {
  const tallies = g.players.map((p) => counts(p.zones.filter((_, i) => i !== 5).flat()));
  const names = creaturesFor(g.contentSet);
  return (
    <ul className="census-count">
      {names.map((name, kind) => {
        const mine = tallies[viewer][kind];
        const best = Math.max(0, ...tallies.filter((_, seat) => seat !== viewer).map((t) => t[kind]));
        const state = mine === 0 ? 'none' : mine > best ? 'lead' : mine === best ? 'tie' : 'behind';
        return (
          <li key={kind} className={`census-row ${state}`}>
            <img src={tokenImage(kind, false, g.contentSet)} alt="" draggable={false} />
            <span className="census-name">{name}</span>
            <b aria-label={`You ${mine}`}>{mine}</b>
            <span className="census-vs" aria-label={`Best rival ${best}`}>{best}</span>
            <span className="census-mark" aria-label={state === 'lead' ? `+${censusPoints.lead}` : state === 'tie' ? `+${censusPoints.tie}` : 'No points'}>
              {state === 'lead' ? <><Crown size={16} aria-hidden="true" />+{censusPoints.lead}</> : state === 'tie' ? `+${censusPoints.tie}` : '–'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
