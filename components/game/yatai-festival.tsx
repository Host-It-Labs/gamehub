'use client';
import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Piece, type Inspect } from './interactions';
import { RuleExplanation } from './extension-rules';
import { ExtensionAction } from './extension-action';
import {
  availableOrders,
  canAct,
  festivalBreakdown,
  festivalOrders,
  foodsFor,
  tokenImage,
  type ContentSet,
  type PublicGame,
  type Move,
} from '@/lib/games/trio/engine';

export type FestivalChoice = { order?: number; stall?: boolean };
export function useFestivalChoice(g: PublicGame | null, viewer: number) {
  // Other seats locking a choice must not clear this player's preparation.
  const key = g
    ? `${g.id}:${g.round}:${g.pick}:${viewer}:${g.players[viewer]?.hand.map((c) => c.id).join(',')}`
    : '';
  const [draft, setDraft] = useState<{
    key: string;
    order?: number;
    stall?: boolean;
  }>({ key: '' });
  const current: FestivalChoice = draft.key === key ? draft : {};
  const enabled =
    g?.id === 'midnight' && (g.customerOrders || g.specialtyStalls);
  const needsOrder =
    enabled &&
    g.customerOrders &&
    (g.players[viewer].festival?.orders.length ?? 0) < g.round;
  const choice: FestivalChoice = enabled
    ? {
        ...(needsOrder
          ? { order: current.order ?? availableOrders(g.round, g)[0] }
          : {}),
        ...(g?.specialtyStalls && current.stall ? { stall: true } : {}),
      }
    : {};
  return {
    choice,
    setChoice: (value: FestivalChoice) =>
      setDraft({ key, ...choice, ...value }),
    withChoice: (move: Move): Move =>
      move.type === 'play' ? { ...move, ...choice } : move,
  };
}
function MenuFace({
  id,
  progress,
  round,
  cards = [],
  settled = false,
  contentSet,
}: {
  contentSet?: ContentSet;
  id: number;
  progress?: number;
  round?: number;
  cards?: { kind: number }[];
  settled?: boolean;
}) {
  const dishes = festivalOrders[id].needs.flatMap((n, kind) =>
    Array.from({ length: n }, () => kind),
  );
  const have = cards.reduce<number[]>((counts, card) => {
    counts[card.kind] = (counts[card.kind] ?? 0) + 1;
    return counts;
  }, []);
  return (
    <>
      <ReceiptText className="order-emblem" size={13} aria-hidden="true" />
      {settled ? (
        <span
          className={`order-result ${progress === 3 ? 'complete' : ''}`}
          aria-hidden="true"
        >
          {progress === 3 ? '✓' : '×'}
        </span>
      ) : (
        <span className="order-dishes" aria-hidden="true">
          {dishes.map((kind, i) => {
            const complete =
              (have[kind] ?? 0) >
              dishes.slice(0, i).filter((dish) => dish === kind).length;
            return (
              <span
                className={`order-dish ${complete ? 'complete' : ''}`}
                key={i}
              >
                <img src={tokenImage(kind, true, contentSet)} alt="" />
                {complete && <span className="order-dish-check">✓</span>}
              </span>
            );
          })}
        </span>
      )}
      {/* An open menu shows what it pays; a settled one shows what it paid. */}
      <span
        className={`order-reward ${!settled && progress !== undefined && progress < 3 ? 'pending' : ''}`}
      >
        +{!settled || progress === undefined || progress === 3 ? 7 : 0}
      </span>
      {!settled && round && <span className="order-round">{round}</span>}
    </>
  );
}
function orderSettled(g: PublicGame, player: number, round: number) {
  return g.players[player].zones[0].length >= (round + 1) * 6;
}
export function FestivalSummary({
  g,
  player,
}: {
  g: PublicGame;
  player: number;
}) {
  if (g.id !== 'midnight' || (!g.customerOrders && !g.specialtyStalls))
    return null;
  return (
    <div className="festival-preview-menus" aria-label="Chosen menus">
      {festivalBreakdown(g.players[player]).orders.map((entry, i) => (
        <div
          className={`festival-order ${orderSettled(g, player, i) ? 'settled' : ''}`}
          key={i}
          aria-label={`Round ${i + 1}: ${festivalOrders[entry.order].name}, ${entry.progress} of 3 dishes, ${entry.points} points`}
        >
          <MenuFace
            contentSet={g.contentSet}
            id={entry.order}
            progress={entry.progress}
            round={i + 1}
            cards={g.players[player].zones[0].slice(i * 6, i * 6 + 6)}
            settled={orderSettled(g, player, i)}
          />
        </div>
      ))}
    </div>
  );
}
export function FestivalControls({
  g,
  viewer,
  choice,
  onChange,
  inspect,
  disabled = false,
}: {
  g: PublicGame;
  viewer: number;
  choice: FestivalChoice;
  onChange: (value: FestivalChoice) => void;
  inspect: Inspect;
  disabled?: boolean;
}) {
  if (g.id !== 'midnight' || (!g.customerOrders && !g.specialtyStalls))
    return null;
  const stalls = g.players[viewer].festival?.stalls ?? [];
  const canBuild =
    stalls.length < 2 &&
    g.players[viewer].hand.some(
      (card) => !stalls.some((stall) => stall.kind === card.kind),
    );
  const locked = disabled || !canAct(g, viewer);
  const orders = festivalBreakdown(g.players[viewer]).orders;
  return (
    <div className="festival-controls">
      {orders.map((entry, i) => (
        <Piece
          key={`chosen-${i}`}
          className={`festival-order ${orderSettled(g, viewer, i) ? 'settled' : ''}`}
          label={`${festivalOrders[entry.order].name}: ${entry.progress}/3 collected · +${entry.points} points`}
          inspect={() =>
            inspect({
              title: festivalOrders[entry.order].name,
              body: (
                <RuleExplanation
                  outcome={
                    <>
                      Collect{' '}
                      {festivalOrders[entry.order].needs
                        .flatMap((n, k) =>
                          n ? [`${n} ${foodsFor(g.contentSet)[k].name}`] : [],
                        )
                        .join(' + ')}{' '}
                      in round {i + 1}.
                    </>
                  }
                  note="Dishes are not consumed. Previous rounds do not count."
                >
                  <p>
                    <b>Progress.</b> {entry.progress} of 3 collected.
                  </p>
                  <p>
                    <b>Reward.</b> +7 when complete; currently +{entry.points}.
                  </p>
                </RuleExplanation>
              ),
            })
          }
        >
          <MenuFace
            contentSet={g.contentSet}
            id={entry.order}
            progress={entry.progress}
            round={i + 1}
            cards={g.players[viewer].zones[0].slice(i * 6, i * 6 + 6)}
            settled={orderSettled(g, viewer, i)}
          />
        </Piece>
      ))}
      {choice.order !== undefined && (
        <fieldset
          className="festival-orders"
          aria-label="Customer order for this round"
        >
          {availableOrders(g.round, g).map((id) => {
            const order = festivalOrders[id];
            const description = `${order.needs.flatMap((n, k) => (n ? [`${n} ${foodsFor(g.contentSet)[k].name}`] : [])).join(' + ')}. Collect these dishes this round for +7. Your choice locks with your first dish. Orders do not consume dishes.`;
            return (
              <Piece
                key={id}
                className={`festival-order ${locked ? 'unavailable' : ''}`}
                label={`${order.name}: ${description}${locked ? ' Choice locked.' : ''}`}
                selected={choice.order === id}
                unavailable={locked}
                inspect={() =>
                  inspect({
                    title: order.name,
                    body: (
                      <RuleExplanation
                        outcome={
                          <>
                            Collect{' '}
                            {order.needs
                              .flatMap((n, k) =>
                                n
                                  ? [`${n} ${foodsFor(g.contentSet)[k].name}`]
                                  : [],
                              )
                              .join(' + ')}{' '}
                            this round.
                          </>
                        }
                        note="Dishes are not consumed. Previous rounds do not count. Everyone may choose the same order."
                      >
                        <p>
                          <b>Choose.</b> Lock this order with your first dish.
                        </p>
                        <p>
                          <b>Reward.</b> +7 for all three dishes; +0 if
                          unfinished.
                        </p>
                      </RuleExplanation>
                    ),
                  })
                }
                onTap={locked ? undefined : () => onChange({ order: id })}
              >
                <MenuFace contentSet={g.contentSet} id={id} />
                <span className="extension-selected" aria-hidden="true">
                  {choice.order === id ? '✓' : ''}
                </span>
              </Piece>
            );
          })}
        </fieldset>
      )}
      {g.specialtyStalls && (
        <ExtensionAction
          kind="stall"
          label="Open a stall"
          selected={!!choice.stall}
          count={2 - stalls.length}
          disabled={locked || !canBuild}
          onTap={() => onChange({ stall: !choice.stall })}
          inspect={inspect}
          description="You have two specialty-stall permits for the entire game. Select this button, then draft a dish to open a stall of that type. Your choice locks and reveals with your dish. Every later matching dish earns +2, capped at +6 per stall; the opening dish and previously collected dishes earn nothing. For example, open a Ramen stall, then draft two more Ramen to earn +4 in addition to their normal food score. Stalls persist across rounds, and your two stalls must be different dish types. The permit icon on the dish tracks its bonus. Tap this button again to cancel before playing."
        />
      )}
    </div>
  );
}
