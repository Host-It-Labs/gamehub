'use client';
import { type CSSProperties } from 'react';
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
  dice,
  cardName,
  penalty,
  zoneScore,
  foodBreakdown,
  scores,
  legalMoves,
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
      <span
        className="sprite"
        style={{ backgroundPosition: `${kind * 20}% ${food ? 100 : 0}%` }}
      />
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
        <span className="creature-name">{creatures[card.kind]}</span>
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
    <div className={`playing-face suit-${card.kind}`}>
      <span className="rank-corner">
        {card.rank}
        <b>{suits[card.kind]}</b>
      </span>
      <div className="pips">
        {card.kind === 4 ? (
          <b>{card.rank}</b>
        ) : (
          Array.from({ length: Math.min(card.rank, 10) }, (_, i) => (
            <span key={i}>{suits[card.kind]}</span>
          ))
        )}
      </div>
      {penalty(card, hazard) > 0 && (
        <span className="penalty-badge">+{penalty(card, hazard)}</span>
      )}
      <span className="rank-corner bottom">
        {card.rank}
        <b>{suits[card.kind]}</b>
      </span>
    </div>
  );
}
export function cardInspection(g: Game, c: Card, viewer = 0) {
  const playable =
    g.phase === 'play' &&
    g.active === viewer &&
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
            <b>{penalty(c, g.hazard)} penalty marks</b> if captured in a trick.
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
              ? 'Select three cards to pass before the die rolls.'
              : playable
                ? 'You can play this card.'
                : g.active !== viewer
                  ? 'Wait for your turn.'
                  : 'You must follow the led suit when possible.'}
          </p>
          <p>
            One of 12 cards in {suitNames[c.kind]}. A ward halves the whole
            trick, rounded up.
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
            {habitats.map((h, z) => {
              const zones = g.players[viewer].zones.map((r) => [...r]);
              zones[z].push(c);
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
}: {
  g: Game;
  player?: number;
  viewer?: number;
  mini?: boolean;
  selected?: number | null;
  inspect?: Inspect;
  onPlace?: (z: number) => void;
}) {
  const p = g.players[player];
  if (g.id === 'undertow')
    return (
      <div className="trick-board" data-drop="trick" data-coach="table">
        <div className="trick-info">
          {g.trick.length ? (
            <>
              {suits[g.trick[0].card.kind]} Follow{' '}
              {suitNames[g.trick[0].card.kind]}
            </>
          ) : g.phase === 'pass' ? (
            'Select 3 cards to pass'
          ) : g.phase === 'roll' ? (
            'Roll to reveal the dangerous 9'
          ) : g.lastTrick.length ? (
            'Last trick'
          ) : (
            'Play a card here'
          )}
        </div>
        <div className="trick-row">
          {(g.trick.length ? g.trick : g.lastTrick).map((t) => (
            <div className="table-card" key={t.card.id}>
              <span>
                {g.players[t.player].name}
                {t.ward ? ' · shield' : ''}
              </span>
              <div className="static-face">
                <Face card={t.card} id={g.id} hazard={g.hazard} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (g.id === 'wildgrove')
    return (
      <div
        className={`grove-board ${mini ? 'mini-board' : ''}`}
        data-coach="board"
      >
        {habitats.map((h, z) => {
          const allowed =
            player === viewer &&
            g.active === viewer &&
            selected != null &&
            legalMoves(g).some(
              (m) => m.type === 'play' && m.card === selected && m.zone === z,
            );
          const content = (
            <>
              <div className="region-heading">
                <strong>{h.name}</strong>
                <b>{zoneScore(p.zones, z)}</b>
              </div>
              <div className="region-pieces">
                {p.zones[z].map((c) => (
                  <TokenArt key={c.id} kind={c.kind} />
                ))}
                {Array.from(
                  {
                    length: Math.max(0, Math.min(h.cap, 4) - p.zones[z].length),
                  },
                  (_, i) => (
                    <span className="piece-slot" key={i} />
                  ),
                )}
              </div>
              <div className="region-bottom">
                <span>{h.formula}</span>
                <small>
                  {p.zones[z].length}/{h.cap}
                </small>
              </div>
            </>
          );
          return (
            <div
              data-drop={`zone:${z}`}
              data-coach={`region-${z}`}
              className={`region region-${z} ${allowed ? 'legal-region' : ''} ${selected != null && !allowed && !mini ? 'blocked-region' : ''}`}
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
                            {p.zones[z].length} of {h.cap} spaces used.
                            Currently <b>{zoneScore(p.zones, z)} points</b>.
                          </p>
                          <p>
                            {player === g.roller
                              ? 'You are the roller: the placement restriction does not apply.'
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
              <TokenArt kind={k} food />
              {c[k] > 1 && <span className="stack-shadow" />}
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
            className={`player-button ${g.active === i && g.phase !== 'over' ? 'active' : ''}`}
            onClick={() =>
              inspect({
                title: `${p.name} · ${sc[i]} ${g.id === 'undertow' ? 'marks' : 'points'}`,
                body:
                  g.id === 'undertow' ? (
                    <p>
                      {p.hand.length} cards remaining · {p.wards} wards.
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
  onDrop: (c: Card, x: number, y: number) => void;
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
    <div
      className={`hand ${g.id === 'wildgrove' ? 'token-tray' : 'card-hand'} ${count > 12 ? 'large-hand' : ''}`}
      data-coach="hand"
      data-drop="hand"
      style={{ '--count': count } as CSSProperties}
    >
      {hand.map((c, i) => {
        const relative = (i - (count - 1) / 2) / Math.max(1, count / 2);
        return (
          <Piece
            key={c.id}
            cardId={c.id}
            label={cardName(g.id, c)}
            className={`${g.id === 'wildgrove' ? 'creature-piece' : g.id === 'midnight' ? 'food-card' : 'standard-card'} ${(g.active !== viewer || !legalMoves(g).some((m) => m.type === 'play' && m.card === c.id)) && g.phase === 'play' ? 'not-playable' : ''}`}
            style={
              {
                '--angle': `${g.id === 'wildgrove' ? relative * 5 : relative * 7}deg`,
                '--lift': `${relative * relative * 14}px`,
                '--index': i,
              } as CSSProperties
            }
            selected={selected === c.id || passed.includes(c.id)}
            draggable
            inspect={() => inspect(cardInspection(g, c, viewer))}
            onTap={() => onTap(c)}
            onLift={onLift}
            onDrop={(x, y) => onDrop(c, x, y)}
          >
            <Face card={c} id={g.id} hazard={g.hazard} />
          </Piece>
        );
      })}
    </div>
  );
}
