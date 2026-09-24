'use client';
import { useState } from 'react';
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
import { RuleExplanation } from './extension-rules';
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
export function NewExtensionRules({ kind }: { kind: ExtensionKind }) {
  if (kind === 'roamEnabled')
    return (
      <RuleExplanation
        outcome="Place in a habitat blocked by the die."
        note="Once per match. Capacity still applies. Never needed for Release."
      >
        <p>
          <b>Prepare.</b> Select the footprints, then place a creature in a
          blocked habitat.
        </p>
        <p>
          <b>Spend.</b> Used only when the placement needs it. May accompany
          Migration.
        </p>
      </RuleExplanation>
    );
  if (kind === 'migration')
    return (
      <RuleExplanation
        outcome="Move one sheltered creature, then make your normal placement."
        note="Once per match. Both choices lock together. You may also use Roam."
      >
        <p>
          <b>Relocate.</b> Tap or drag a creature already on your board to
          another habitat with space. This move ignores the die; Release is
          excluded.
        </p>
        <p>
          <b>Order.</b> Remaining creatures keep their order. The moved creature
          goes to the end of its new habitat.
        </p>
        <p>
          <b>Place.</b> Choose your hand creature and destination on the
          previewed board. The normal die restriction applies to this placement.
        </p>
        <p>
          <b>Cancel.</b> Tap the moved creature, or the Migration token, before
          committing to spend nothing.
        </p>
      </RuleExplanation>
    );
  if (kind === 'salvage')
    return (
      <RuleExplanation
        outcome="Secretly claim before the lead, then try to take the trick."
        note="One claim per player per round. The leader cannot claim. No claims on the final trick. Printed ranks and follow-suit rules stay unchanged."
      >
        <p>
          <b>Commit.</b> Eligible players choose Claim or Pass, then lock.
          Choices reveal together before the first card.
        </p>
        <p>
          <b>Reward.</b> A claimant who takes the trick reduces their score by
          6. Every unsuccessful claimant takes 3 penalty points.
        </p>
        <p>
          <b>Risk.</b> Ordinary trick penalties still apply. Shields halve those
          first; Salvage applies afterward. Your total may fall below zero.
        </p>
      </RuleExplanation>
    );
  if (kind === 'turningTide')
    return (
      <RuleExplanation
        outcome="Odd tricks: highest led-suit card wins. Even tricks: lowest wins."
        note="The pattern restarts each round. Follow suit normally. Off-suit cards never win."
      >
        <p>
          <b>Read.</b> The wave marker shows whether high or low wins.
        </p>
        <p>
          <b>Plan.</b> The winner takes penalties and leads next. Shields and
          Salvage work normally.
        </p>
      </RuleExplanation>
    );
  return (
    <RuleExplanation
      outcome="Draft the featured dish on its forecast turn."
      note="Every dish type appears once per round. The forecast is shared and works with either menu."
    >
      <p>
        <b>Forecast.</b> Six dishes show the order this round; the highlighted
        dish is featured now.
      </p>
      <p>
        <b>Reward.</b> Draft that type for 2 extra points, in addition to normal
        scoring.
      </p>
    </RuleExplanation>
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
          <span className="season-route">
            <SeasonRouteLine
              reached={g.phase === 'over' ? SEASON_ROUTE.length + 1 : g.pick}
            />
            {g
              .seasonForecast!.slice((g.round - 1) * 6, g.round * 6)
              .map((kind, i) => (
                <span className="season-step" data-step={i} key={i}>
                  <img
                    className={
                      i === g.pick - 1 && g.phase !== 'over'
                        ? 'current'
                        : i < g.pick - 1 || g.phase === 'over'
                          ? 'past'
                          : ''
                    }
                    src={tokenImage(kind, true, g.contentSet)}
                    alt={foodsFor(g.contentSet)[kind].name}
                  />
                </span>
              ))}
          </span>
          <b>+{p.seasonPoints ?? 0}</b>
        </button>
      )}
    </>
  );
}
