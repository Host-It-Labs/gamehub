'use client';
import { useState, type ReactNode } from 'react';
import { Footprints, MoveRight, Waves, Sun, Anchor } from 'lucide-react';
import {
  canAct,
  decisionKey,
  foodsFor,
  lowTide,
  tokenImage,
  type Move,
  type PublicGame,
} from '@/lib/games/trio/engine';
import { RuleSection } from './rules';
import { Piece, type Inspect } from './interactions';
export type ExtensionKind =
  | 'roamEnabled'
  | 'migration'
  | 'salvage'
  | 'turningTide'
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
}: {
  kind: ExtensionKind;
  /** Only where no dialog title already names the extension. */
  title?: ReactNode;
}) {
  if (kind === 'roamEnabled')
    return (
      <RuleSection title={title} note="The habitat still needs a free space.">
        <p>
          Once per game, place a creature in a habitat <b>the die blocks</b>.
          Tap the <b>footprints</b>, then place your creature.
        </p>
      </RuleSection>
    );
  if (kind === 'migration')
    return (
      <RuleSection
        title={title}
        note="The move ignores the die and cannot go to Release. Your placement still follows the die."
      >
        <p>
          Once per game, before you place, <b>move one creature</b> already on
          your board to another habitat with space. Tap or drag it there, then
          place from your hand as usual.
        </p>
      </RuleSection>
    );
  if (kind === 'salvage')
    return (
      <RuleSection
        title={title}
        note="The player who leads cannot claim, and no one can on the last trick. Scores can go below zero."
      >
        <p>
          Once per round, you may bet on winning <b>the next trick</b>. Before
          each trick, choose <b>Claim</b> or <b>Pass</b> and lock it. All
          choices show at once.
        </p>
        <p>
          Claim and win the trick: <b>−6</b>. Claim and lose it: <b>+3</b>. The
          trick’s own points still count.
        </p>
      </RuleSection>
    );
  if (kind === 'turningTide')
    return (
      <RuleSection
        title={title}
        note="The count starts again each round. A card off the led suit still never wins."
      >
        <p>
          Odd tricks: the <b>highest</b> card of the led suit wins. Even tricks:
          the <b>lowest</b> wins. The wave arrow shows which.
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
export type NatureChoice = {
  roam?: boolean;
  migration?: { card: number; from: number; to: number };
};
export function useNatureChoice(g: PublicGame | null, viewer: number) {
  const key = g
    ? `${decisionKey(g)}:${g.players[viewer]?.hand.map((c) => c.id).join(',')}`
    : '';
  const [draft, setDraft] = useState<{ key: string; value: NatureChoice }>({
    key: '',
    value: {},
  });
  const choice =
    (g?.roamEnabled || g?.migration) && draft.key === key ? draft.value : {};
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
  const hasResidents = p.zones.some((z, i) => i !== 5 && z.length);
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
      {g.migration && (
        <Piece
          className="extension-action mora-migration-action"
          label={`Migration · ${p.migrations ?? 0} remaining`}
          selected={!!choice.migration}
          unavailable={locked || !p.migrations || !hasResidents}
          onTap={
            locked || !p.migrations || !hasResidents
              ? undefined
              : choice.migration
                ? () => onChange({ ...choice, migration: undefined })
                : () => showRules('migration', 'Migration')
          }
          inspect={() => showRules('migration', 'Migration')}
        >
          <MoveRight />
          <span className="extension-count">{p.migrations ?? 0}</span>
        </Piece>
      )}
      {g.salvage && (
        <Piece
          className="extension-action salvage-emblem"
          label={`Salvage · ${p.salvageClaims ?? 0} claim remaining`}
          selected={(g.salvageClaimants ?? []).includes(viewer)}
          inspect={() => showRules('salvage', 'Salvage')}
          onTap={() => showRules('salvage', 'Salvage')}
        >
          <Anchor />
          <span className="extension-count">{p.salvageClaims ?? 0}</span>
        </Piece>
      )}
      {g.turningTide && (
        <button
          className="forecast-tide"
          onClick={() => showRules('turningTide', 'Turning Tide')}
          aria-label={`Turning Tide: ${lowTide(g) ? 'lowest' : 'highest'} wins`}
        >
          <Waves />
          <b aria-hidden="true">{lowTide(g) ? '↓' : '↑'}</b>
        </button>
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
