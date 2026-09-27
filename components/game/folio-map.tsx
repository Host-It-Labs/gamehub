'use client';
import { type CSSProperties } from 'react';
import { Crown, Dices } from 'lucide-react';
import type { MapNode, PublicGame } from '@/lib/games/folio/types';
import {
  BOSS_EVERY,
  LANES,
  LEVEL_NAMES,
  PUZZLES,
} from '@/lib/games/folio/catalog';
import { KindIcon } from './folio-icons';

/** Stable small offset so lanes wobble like a hand-drawn trail. */
function wobble(id: string) {
  let n = 7;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) % 997;
  return ((n % 13) - 6) / 100;
}
/** Vertical position of a round within its act: the start low, the boss high. */
const rowY = (row: number) =>
  0.07 + ((BOSS_EVERY - 1 - (row % BOSS_EVERY)) / (BOSS_EVERY - 1)) * 0.74;
export const actOfRow = (row: number) => Math.floor(row / BOSS_EVERY);
/** The act the crew is in or about to enter. */
export function currentAct(g: PublicGame, open: string[]) {
  const first = g.map.find((n) => n.id === (open[0] ?? g.at));
  return first ? actOfRow(first.row) : 0;
}
export function nodePoint(n: MapNode) {
  const x = n.type === 'boss' ? 0.5 : (n.lane + 0.5) / LANES + wobble(n.id);
  return { x, y: rowY(n.row) };
}
export function nodeTitle(n: MapNode) {
  const game = PUZZLES[n.kind];
  return n.type === 'boss'
    ? `Boss · ${game.name}: ${game.boss.name}`
    : game.name;
}
/** A teammate's pick on the map: their initial in their colour. */
export type Voter = {
  id: string;
  initial: string;
  colour: string;
  name: string;
};
/**
 * The act's boss reroll: `soon` until round 2 is played, `ready` once it may
 * be used, `used` after it was.
 */
export type Reroll = {
  state: 'soon' | 'ready' | 'used';
  /** Present for whoever may use it now (the host). */
  onReroll?: () => void;
  picked?: boolean;
};
export function VoteChips({ voters }: { voters: Voter[] }) {
  if (!voters.length) return null;
  return (
    <span className="folio-votes" aria-hidden="true">
      {voters.map((v) => (
        <i key={v.id} style={{ '--voter': v.colour } as CSSProperties}>
          {v.initial}
        </i>
      ))}
    </span>
  );
}
export function FolioMap({
  g,
  open,
  picked,
  onPick,
  act,
  votes,
  reroll,
}: {
  g: PublicGame;
  /** Node ids the crew can choose now. */
  open: string[];
  picked?: string;
  onPick?: (n: MapNode) => void;
  /** Only the current section is visible; future sections stay hidden. */
  act: number;
  /** Who picked which open stop. */
  votes?: Record<string, Voter[]>;
  reroll?: Reroll;
}) {
  const shown = act;
  const nodes = g.map.filter((n) => actOfRow(n.row) === shown);
  const firstRow = shown * BOSS_EVERY;
  const byId = new Map(g.map.map((n) => [n.id, n]));
  const visited = new Map(g.path.map((p) => [p.id, p.won]));
  const trail = g.path.map((p) => p.id);
  const onTrail = (a: string, b: string) => {
    const i = trail.indexOf(a);
    return i >= 0 && trail[i + 1] === b;
  };
  return (
    <div className="folio-map-wrap">
      <fieldset className="folio-map" aria-label="Current route">
        <svg
          className="folio-map-lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {nodes.flatMap((a) =>
            a.next.flatMap((id) => {
              const b = byId.get(id)!;
              if (actOfRow(b.row) !== shown) return [];
              const p = nodePoint(a),
                q = nodePoint(b);
              const walked = onTrail(a.id, b.id);
              const ahead = a.id === g.at && open.includes(b.id);
              return (
                <path
                  key={`${a.id}-${b.id}`}
                  d={`M${p.x * 100} ${p.y * 100} C${p.x * 100} ${(p.y + q.y) * 50}, ${q.x * 100} ${(p.y + q.y) * 50}, ${q.x * 100} ${q.y * 100}`}
                  className={walked ? 'walked' : ahead ? 'ahead' : ''}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }),
          )}
          {nodes
            .filter((n) => n.row === firstRow)
            .map((n) => {
              const q = nodePoint(n);
              const walked = trail.includes(n.id);
              return (
                <path
                  key={`start-${n.id}`}
                  d={`M50 100 C50 ${q.y * 100 + 9}, ${q.x * 100} ${q.y * 100 + 9}, ${q.x * 100} ${q.y * 100 + 7}`}
                  className={
                    walked ? 'walked' : open.includes(n.id) ? 'ahead' : ''
                  }
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </svg>
        {Array.from({ length: BOSS_EVERY }, (_, i) => firstRow + i).map(
          (row) => (
            <span
              key={row}
              className="folio-map-row"
              style={{ top: `${rowY(row) * 100}%` }}
              aria-hidden="true"
            >
              {row + 1}
            </span>
          ),
        )}
        {nodes.map((n) => {
          const { x, y } = nodePoint(n);
          const can = open.includes(n.id) && !!onPick;
          const state = visited.has(n.id)
            ? visited.get(n.id)
              ? 'won'
              : 'lost'
            : n.id === g.at
              ? 'here'
              : open.includes(n.id)
                ? 'open'
                : 'later';
          const voters = votes?.[n.id] ?? [];
          return (
            <button
              key={n.id}
              type="button"
              className={`folio-node ${n.type}`}
              data-state={state}
              data-picked={picked === n.id || undefined}
              disabled={!can}
              style={
                { left: `${x * 100}%`, top: `${y * 100}%` } as CSSProperties
              }
              onClick={() => can && onPick(n)}
              aria-label={`Round ${n.row + 1}: ${nodeTitle(n)}${`, ${LEVEL_NAMES[n.level]}`}${state === 'won' ? ', solved' : state === 'lost' ? ', lost' : state === 'open' ? ', available' : ''}${voters.length ? `, picked by ${voters.map((v) => v.name).join(', ')}` : ''}`}
            >
              <span
                className="folio-node-seal"
                // A rerolled boss turns over into its new game.
                key={n.type === 'boss' ? n.kind : undefined}
                data-rerolled={
                  (n.type === 'boss' &&
                    g.rerolled?.includes(actOfRow(n.row))) ||
                  undefined
                }
              >
                <VoteChips voters={voters} />
                {n.type === 'boss' ? (
                  <>
                    <Crown size={15} className="folio-node-crown" />
                    <KindIcon kind={n.kind} size={22} />
                  </>
                ) : (
                  <KindIcon kind={n.kind} />
                )}
                {state === 'won' && <i className="folio-node-tick">✓</i>}
                {state === 'lost' && <i className="folio-node-tick lost">×</i>}
              </span>
              <small>{PUZZLES[n.kind].name}</small>
              {n.type === 'boss' && (
                <small className="folio-node-boss">
                  Boss · {PUZZLES[n.kind].boss.name}
                </small>
              )}
            </button>
          );
        })}
        {reroll &&
          nodes
            .filter((n) => n.type === 'boss')
            .map((n) => {
              const { x, y } = nodePoint(n);
              return (
                <button
                  key={`reroll-${n.id}`}
                  type="button"
                  className="folio-reroll"
                  data-state={reroll.state}
                  data-picked={reroll.picked || undefined}
                  disabled={reroll.state !== 'ready' || !reroll.onReroll}
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                  onClick={reroll.onReroll}
                  aria-label={
                    reroll.state === 'used'
                      ? 'Boss rerolled'
                      : reroll.state === 'ready'
                        ? 'Reroll the boss'
                        : 'Boss reroll opens after round 2'
                  }
                  title={
                    reroll.state === 'used'
                      ? 'Boss rerolled'
                      : reroll.state === 'ready'
                        ? 'Reroll the boss'
                        : 'Reroll after round 2'
                  }
                >
                  <Dices size={17} strokeWidth={2.2} aria-hidden="true" />
                </button>
              );
            })}
      </fieldset>
    </div>
  );
}
