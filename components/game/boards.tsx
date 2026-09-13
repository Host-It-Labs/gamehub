'use client';
import { ScrollArea } from './scroll-area';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { Piece, type Inspect } from './interactions';
import {
  suits,
  suitNames,
  creatures,
  foods,
  habitats,
  habitatOrder,
  dice,
  cardName,
  penalty,
  zoneScore,
  foodBreakdown,
  scores,
  legalMoves,
  canAct,
  passCount,
  counts,
  type PublicGame as Game,
  type GameId,
  type Card,
} from '@/lib/games/trio/engine';
export function TokenArt({
  kind,
  food = false,
}: {
  kind: number;
  food?: boolean;
}) {
  return (
    <span className="token-art" aria-hidden="true">
      {food ? (
        <img src={`/art/food-${kind}-v7.webp`} alt="" draggable={false} />
      ) : (
        <img src={`/art/creature-${kind}-v5.webp`} alt="" draggable={false} />
      )}
    </span>
  );
}
export function Face({
  card,
  id,
  hazard = -1,
}: {
  card: Card;
  id: GameId;
  hazard?: number;
}) {
  if (id === 'wildgrove')
    return (
      <>
        <TokenArt kind={card.kind} />
      </>
    );
  if (id === 'midnight')
    return (
      <>
        <strong className="dish-name">{foods[card.kind].name}</strong>
        <TokenArt kind={card.kind} food />
        <span className="dish-formula">{foods[card.kind].formula}</span>
      </>
    );
  return (
    <div className={`playing-face tide-face suit-${card.kind}`}>
      <span className="tide-index">
        <strong className="tide-rank">{card.rank}</strong>
        <span className="tide-suit">{suits[card.kind]}</span>
        <span className="tide-cost">
          {penalty(card, hazard) > 0 ? `+${penalty(card, hazard)}` : ''}
        </span>
      </span>
      <span className="tide-pips" aria-hidden="true">
        {Array.from({ length: card.rank }, (_, i) => (
          <span key={i}>{suits[card.kind]}</span>
        ))}
      </span>
      <span className="tide-bottom" aria-hidden="true">
        {card.rank}
        <span>{suits[card.kind]}</span>
      </span>
    </div>
  );
}
export function cardInspection(g: Game, c: Card, viewer = 0) {
  const playable =
    g.phase === 'play' &&
    canAct(g, viewer) &&
    legalMoves(g).some((m) => m.type === 'play' && m.card === c.id);
  return {
    title: cardName(g.id, c),
    art: (
      <div className={`inspect-face ${g.id}`}>
        <Face card={c} id={g.id} hazard={g.hazard} />
      </div>
    ),
    body:
      g.id === 'undertow' ? (
        <>
          <p>
            <b>{penalty(c, g.hazard)} penalty points</b> if captured in a trick.
          </p>
          <p>
            {c.kind === 4
              ? 'Storm is its own suit, not trump.'
              : c.rank === 9
                ? 'This 9 costs 40 when its suit matches the die.'
                : 'Follow the first card’s suit if you can.'}
          </p>
          <p>
            {g.phase === 'pass'
              ? `Select ${passCount(g)} cards to pass before the die rolls.`
              : playable
                ? 'You can play this card.'
                : !canAct(g, viewer)
                  ? 'Wait for your turn.'
                  : 'You must follow the led suit when possible.'}
          </p>
          <p>
            One of 12 cards in {suitNames[c.kind]}.
            {g.starter !== false
              ? ' A selected Shield halves the trick’s penalty points, rounded up.'
              : ' The base game has no shields.'}
          </p>
        </>
      ) : g.id === 'midnight' ? (
        <>
          <h3>{foods[c.kind].formula}</h3>
          <p>{foods[c.kind].rule}</p>
          <div className="example">{foods[c.kind].example}</div>
          <p>
            {counts(g.players[viewer].zones[0])[c.kind]} in your collection · 12
            in the full deck.
          </p>
        </>
      ) : (
        <>
          <p>
            One of six species. There are <b>12 {creatures[c.kind]} pieces</b>{' '}
            in the supply.
          </p>
          <div className="inspection-scores">
            {habitatOrder.map((z) => {
              const h = habitats[z];
              const zones = g.players[viewer].zones.map((r) => [...r]);
              (zones[z] ??= []).push(c);
              const delta = zones.reduce(
                (s, _, i) =>
                  s +
                  zoneScore(zones, i) -
                  zoneScore(g.players[viewer].zones, i),
                0,
              );
              const legal = legalMoves(g).some(
                (m) => m.type === 'play' && m.card === c.id && m.zone === z,
              );
              return (
                <p key={h.name}>
                  <span>{h.name}</span>
                  <b>
                    {legal
                      ? `${delta >= 0 ? '+' : ''}${delta} pts`
                      : 'Unavailable'}
                  </b>
                </p>
              );
            })}
          </div>
        </>
      ),
  };
}
export function Board({
  g,
  player = 0,
  viewer = 0,
  mini = false,
  selected,
  inspect,
  onPlace,
  preparedZone,
}: {
  g: Game;
  player?: number;
  viewer?: number;
  mini?: boolean;
  selected?: number | null;
  inspect?: Inspect;
  onPlace?: (z: number) => void;
  preparedZone?: number | null;
}) {
  const p = g.players[player];
  const completed = [...g.events].reverse().find((e) => e.type === 'trick');
  const [dismissedTrick, setDismissedTrick] = useState(completed?.id);
  const reveal =
    completed?.trick && completed.id !== dismissedTrick ? completed : undefined;
  const revealId = reveal?.id;
  useEffect(() => {
    if (revealId === undefined) return;
    const timer = setTimeout(() => setDismissedTrick(revealId), 2500);
    return () => clearTimeout(timer);
  }, [revealId]);
  if (g.id === 'undertow')
    return (
      <div className="trick-board" data-drop="trick" data-coach="table">
        <div className="trick-info">
          {reveal ? (
            <>
              {reveal.text} ·{' '}
              {g.phase === 'over'
                ? 'Final trick'
                : g.phase === 'pass'
                  ? 'Next: pass cards'
                  : `${g.players[reveal.player].name} leads next`}
            </>
          ) : g.trick.length ? (
            <>
              {suits[g.trick[0].card.kind]} Follow{' '}
              {suitNames[g.trick[0].card.kind]}
            </>
          ) : g.phase === 'pass' ? (
            `Select ${passCount(g)} cards to pass`
          ) : g.phase === 'roll' ? (
            'The die is revealing the 9 worth 40 points…'
          ) : g.phase === 'over' ? (
            'Game complete'
          ) : (
            `${g.players[g.active].name} leads · play a card`
          )}
        </div>
        <div className="trick-row">
          {(reveal?.trick ?? g.trick).map((t) => (
            <div className="table-card" key={t.card.id}>
              <span>
                {g.players[t.player].name}
                {t.ward ? ' · shield' : ''}
                {t.calm ? ' · Calm' : ''}
              </span>
              <div className="static-face">
                <Face
                  card={t.card}
                  id={g.id}
                  hazard={reveal?.hazard ?? g.hazard}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (g.id === 'wildgrove')
    return (
      <div
        className={`grove-board world-board ${mini ? 'mini-board' : ''}`}
        data-coach="board"
      >
        {habitatOrder.map((z) => {
          const h = habitats[z];
          const allowed =
            player === viewer &&
            canAct(g, viewer) &&
            selected != null &&
            legalMoves({ ...g, active: viewer }).some(
              (m) => m.type === 'play' && m.card === selected && m.zone === z,
            );
          const content = (
            <>
              <div className="region-heading" title={`${h.formula}. ${h.rule}`}>
                <strong>{h.name}</strong>
                <b>{zoneScore(p.zones, z)}</b>
              </div>
              <div className="region-pieces">
                {(p.zones[z] ?? []).map((c) => (
                  <TokenArt key={c.id} kind={c.kind} />
                ))}
              </div>
              <div className="region-bottom">
                <span>{h.formula}</span>
                <small>
                  {p.zones[z]?.length ?? 0}/{h.cap}
                </small>
              </div>
            </>
          );
          return (
            <div
              data-drop={`zone:${z}`}
              data-coach={`region-${z}`}
              className={`region region-${z} ${allowed ? 'legal-region' : ''} ${preparedZone === z ? 'prepared-region' : ''} ${canAct(g, viewer) && g.phase === 'play' && selected != null && !allowed && !mini ? 'blocked-region' : ''}`}
              key={h.name}
            >
              {mini ? (
                <div className="region-inner">{content}</div>
              ) : (
                <Piece
                  className="region-inner"
                  label={h.name}
                  inspect={() =>
                    inspect?.({
                      title: h.name,
                      body: (
                        <>
                          <p className="big-rule">{h.formula}</p>
                          <p>{h.rule}</p>
                          <p>
                            {p.zones[z]?.length ?? 0} of {h.cap} spaces used.
                            Currently <b>{zoneScore(p.zones, z)} points</b>.
                          </p>
                          <p>
                            {player === g.roller
                              ? 'You are the roller: choose any habitat with space.'
                              : `Current restriction: ${dice[g.die].name}. ${dice[g.die].rule}`}
                          </p>
                        </>
                      ),
                    })
                  }
                  onTap={() => selected != null && onPlace?.(z)}
                >
                  {content}
                </Piece>
              )}
            </div>
          );
        })}
      </div>
    );
  const c = counts(p.zones[0]),
    sc = foodBreakdown(
      p.zones[0],
      g.players.filter((_, i) => i !== player).map((p) => p.zones[0]),
    );
  return (
    <div
      className={`market-board ${mini ? 'mini-board' : ''}`}
      data-drop="menu"
      data-coach="board"
    >
      {foods.map((f, k) => {
        const content = (
          <>
            <div className={`dish-stack ${c[k] ? 'has-dish' : ''}`}>
              {Array.from(
                { length: Math.max(1, Math.min(c[k], 6)) },
                (_, i) => (
                  <span
                    className="stack-layer"
                    style={
                      {
                        '--layer': i,
                        '--layers': Math.max(1, Math.min(c[k], 6)),
                      } as CSSProperties
                    }
                    key={i}
                  >
                    <TokenArt kind={k} food />
                  </span>
                ),
              )}
              <b className="quantity">×{c[k]}</b>
            </div>
            <strong>{f.name}</strong>
            <span className="collection-score">{sc[k]} pts</span>
          </>
        );
        return (
          <div className="serving-dish" key={k}>
            {mini ? (
              <div>{content}</div>
            ) : (
              <Piece
                label={f.name}
                inspect={() =>
                  inspect?.({
                    title: f.name,
                    art: <TokenArt kind={k} food />,
                    body: (
                      <>
                        <h3>{f.formula}</h3>
                        <p>{f.rule}</p>
                        <div className="example">{f.example}</div>
                        <p>
                          {c[k]} collected · {sc[k]} points.
                        </p>
                      </>
                    ),
                  })
                }
              >
                {content}
              </Piece>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function Players({ g, inspect }: { g: Game; inspect: Inspect }) {
  const sc = scores(g);
  return (
    <div className="players" data-coach="players">
      {g.players.map((p, i) => {
        const trigger = (
          <button
            className={`player-button ${canAct(g, i) ? 'active' : ''}`}
            onClick={() =>
              inspect({
                title: `${p.name} · ${sc[i]} ${g.id === 'undertow' ? 'penalty points' : 'points'}`,
                body:
                  g.id === 'undertow' ? (
                    <p>
                      {p.hand.length} cards remaining · {p.wards} shields.
                    </p>
                  ) : (
                    <Board g={g} player={i} mini />
                  ),
              })
            }
          >
            <span className={`avatar avatar-${i}`}>{p.name.slice(0, 1)}</span>
            <span>{p.name}</span>
            <b>{sc[i]}</b>
            {g.id === 'wildgrove' && g.roller === i && <small>ROLLER</small>}
          </button>
        );
        return g.id === 'undertow' ? (
          <div key={i}>{trigger}</div>
        ) : (
          <HoverCard key={i}>
            <HoverCardTrigger render={trigger} />
            <HoverCardContent className="board-preview" side="bottom">
              <strong>
                {p.name} · {sc[i]} points
              </strong>
              <Board g={g} player={i} mini />
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
export function Hand({
  g,
  viewer = 0,
  order,
  selected,
  passed,
  inspect,
  onTap,
  onDrop,
  onLift,
}: {
  g: Game;
  viewer?: number;
  order: number[];
  selected: number | null;
  passed: number[];
  inspect: Inspect;
  onTap: (c: Card) => void;
  onDrop: (c: Card, x: number, y: number, before?: number | null) => void;
  onLift: () => void;
}) {
  const hand = [...g.players[viewer].hand].sort((a, b) => {
    const ai = order.indexOf(a.id),
      bi = order.indexOf(b.id);
    return ai < 0 && bi < 0
      ? a.kind - b.kind || a.rank - b.rank
      : ai < 0
        ? 1
        : bi < 0
          ? -1
          : ai - bi;
  });
  const count = hand.length;
  return (
    <ScrollArea
      className={`hand ${g.id === 'wildgrove' ? 'token-tray' : 'card-hand'} ${g.id === 'undertow' ? 'tide-hand' : ''} ${count > 12 ? 'large-hand' : ''}`}
      data-coach="hand"
      data-drop="hand"
      style={{ '--count': count } as CSSProperties}
    >
      {hand.map((c) => {
        return (
          <Piece
            key={c.id}
            cardId={c.id}
            label={cardName(g.id, c)}
            className={`${g.id === 'wildgrove' ? 'creature-piece' : g.id === 'midnight' ? `food-card food-kind-${c.kind}` : 'standard-card'} ${(!canAct(g, viewer) || !legalMoves({ ...g, active: viewer }).some((m) => m.type === 'play' && m.card === c.id)) && g.phase === 'play' ? 'not-playable' : ''}`}
            selected={selected === c.id || passed.includes(c.id)}
            draggable
            inspect={() => inspect(cardInspection(g, c, viewer))}
            onTap={() => onTap(c)}
            onLift={onLift}
            onDrop={(x, y, before) => onDrop(c, x, y, before)}
          >
            <Face card={c} id={g.id} hazard={g.hazard} />
          </Piece>
        );
      })}
    </ScrollArea>
  );
}
