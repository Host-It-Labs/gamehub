'use client';
import { BlackwakeTable, type TableGeometry } from './blackwake-table';
import { paperWorldFor, paperWorldIdFor } from '@/lib/games/mora-world';
import { cropPercent, tableWorldFor } from '@/lib/games/table-world';
import { WorldScene } from './world-scene';
import { useArtVariant } from '@/lib/games/art-variant';
import { ObservatoryScene } from './observatory-scene';
import { cue } from '@/lib/games/trio/sound';
import {
  decisionKey,
  readySeats,
  simultaneous,
  migratedZones,
} from '@/lib/games/trio/engine';
import { Fragment, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OpponentBoards, PlayerResources } from './opponent-boards';
import { PlayerStatus } from './player-status';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { festivalBreakdown } from '@/lib/games/trio/engine';
import { moraMapFor } from '@/lib/games/trio/mora-map';
import { MoraTrash } from './mora-trash';
import { Store, UsersRound } from 'lucide-react';
import { ScrollArea } from './scroll-area';
import { dropTargetNear } from './drag-preview';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { Piece, type Inspect } from './interactions';
import {
  suits,
  suitNames,
  creaturesFor,
  foodsFor,
  habitatsFor,
  placementDieRule,
  tokenImage,
  type ContentSet,
  habitatOrder,
  dice,
  cardName,
  penalty,
  tideRanks,
  tidePenaltyRank,
  tidePenaltyValue,
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
  contentSet,
}: {
  kind: number;
  food?: boolean;
  contentSet?: ContentSet;
}) {
  return (
    <span className="token-art" aria-hidden="true">
      {food ? (
        <img
          src={tokenImage(kind, true, contentSet)}
          alt=""
          draggable={false}
        />
      ) : (
        <img
          src={tokenImage(kind, false, contentSet)}
          alt=""
          draggable={false}
        />
      )}
    </span>
  );
}
export function Face({
  card,
  id,
  hazard = -1,
  penaltyRank = 8,
  penaltyValue = 40,
  contentSet,
}: {
  card: Card;
  id: GameId;
  hazard?: number;
  penaltyRank?: number;
  penaltyValue?: number;
  contentSet?: ContentSet;
}) {
  if (id === 'wildgrove')
    return (
      <>
        <TokenArt contentSet={contentSet} kind={card.kind} />
      </>
    );
  if (id === 'midnight')
    return (
      <>
        <strong className="dish-name">
          {foodsFor(contentSet)[card.kind].name}
        </strong>
        <TokenArt contentSet={contentSet} kind={card.kind} food />
        <span className="dish-formula">
          {foodsFor(contentSet)[card.kind].formula}
        </span>
      </>
    );
  return (
    <div className={`playing-face tide-face suit-${card.kind}`}>
      <span className="tide-index">
        <strong className="tide-rank">{card.rank}</strong>
        <span className="tide-suit">{suits[card.kind]}</span>
        <span className="tide-cost">
          {penalty(card, hazard, penaltyRank, penaltyValue) > 0
            ? `+${penalty(card, hazard, penaltyRank, penaltyValue)}`
            : ''}
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
    title: cardName(g.id, c, g.contentSet),
    art: (
      <div className={`inspect-face ${g.id}`}>
        <Face
          card={c}
          id={g.id}
          contentSet={g.contentSet}
          hazard={g.hazard}
          penaltyRank={tidePenaltyRank(g)}
          penaltyValue={tidePenaltyValue(g)}
        />
      </div>
    ),
    body:
      g.id === 'undertow' ? (
        <>
          <p>
            <b>
              {penalty(c, g.hazard, tidePenaltyRank(g), tidePenaltyValue(g))}{' '}
              penalty points
            </b>{' '}
            if captured in a trick.
          </p>
          <p>
            {c.kind === 4
              ? 'Storm is its own suit, not trump.'
              : c.rank === tidePenaltyRank(g)
                ? `This ${tidePenaltyRank(g)} costs ${tidePenaltyValue(g)} when its suit matches the die.`
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
            One of {tideRanks(g)} cards in {suitNames[c.kind]}.
            {g.shields === true
              ? ' A selected Shield halves the trick’s penalty points, rounded up.'
              : ' The base game has no shields.'}
          </p>
        </>
      ) : g.id === 'midnight' ? (
        <>
          <h3>{foodsFor(g.contentSet)[c.kind].formula}</h3>
          <p>{foodsFor(g.contentSet)[c.kind].rule}</p>
          <div className="example">
            {foodsFor(g.contentSet)[c.kind].example}
          </div>
          <p>
            {counts(g.players[viewer].zones[0])[c.kind]} in your collection · 12
            in the full deck.
          </p>
        </>
      ) : (
        <>
          <p>
            One of six species. There are{' '}
            <b>12 {creaturesFor(g.contentSet)[c.kind]} pieces</b> in the supply.
          </p>
          <div className="inspection-scores">
            {habitatOrder
              .filter((z) => z !== 5)
              .map((z) => {
                const h = habitatsFor(g.contentSet)[z];
                const zones = g.players[viewer].zones.map((r) => [...r]);
                (zones[z] ??= []).push(c);
                const delta = zones.reduce(
                  (s, _, i) =>
                    s +
                    zoneScore(zones, i, g.contentSet) -
                    zoneScore(g.players[viewer].zones, i, g.contentSet),
                  0,
                );
                const legal = legalMoves({ ...g, active: viewer }).some(
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
/** Scoring phrases separated by " · "; a run of bare numbers stays with its
 *  phrase so "2 · 6 · 11 · 17" never breaks apart. Cards wrap only between segments. */
export function summarySegments(summary: string): string[] {
  const out: string[] = [];
  for (const piece of summary.split(' · ')) {
    if (out.length && /^\d+$/.test(piece)) out[out.length - 1] += ` · ${piece}`;
    else out.push(piece);
  }
  return out;
}
export function Board({
  g,
  natureChoice = {},
  player = 0,
  viewer = 0,
  mini = false,
  selected,
  inspect,
  onPlace,
  preparedZone,
  onCapturesSettled,
  onMigrate,
}: {
  g: Game;
  natureChoice?: {
    roam?: boolean;
    migration?: { card: number; from: number; to: number };
  };
  player?: number;
  viewer?: number;
  mini?: boolean;
  selected?: number | null;
  inspect?: Inspect;
  onPlace?: (z: number) => void;
  preparedZone?: number | null;
  onCapturesSettled?: (lastEventId: number) => void;
  /** Migration: a placed creature is tapped or dragged straight to another habitat. */
  onMigrate?: (migration?: { card: number; from: number; to: number }) => void;
}) {
  const [portrait, setPortrait] = useState(false);
  const [resident, setResident] = useState<{
    card: number;
    from: number;
  } | null>(null);
  useEffect(() => {
    // Every full-table world has its own portrait plate.
    if (mini) return;
    const query = window.matchMedia('(orientation: portrait)');
    const update = () => setPortrait(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [mini]);
  // Mora's two worlds keep separate candidate picks; the Observatory uses the legacy key.
  const worldId = paperWorldIdFor(g.contentSet);
  const [variant] = useArtVariant(
    g.id === 'wildgrove' ? (worldId === 'floodline' ? 'floodline' : undefined) : g.id,
  );
  const world = paperWorldFor(portrait, variant, worldId);
  const baseMap = mini
    ? moraMapFor(g.contentSet, false, true)
    : moraMapFor(g.contentSet, portrait);
  // Candidate artwork shares the measured geometry; only the image differs.
  const map = {
    ...baseMap,
    image: mini
      ? paperWorldFor(false, variant, worldId).overviewImage
      : world.boardImage,
  };
  const p =
    natureChoice.migration && player === viewer
      ? {
          ...g.players[player],
          zones: migratedZones(g.players[player].zones, natureChoice.migration),
        }
      : g.players[player];
  const migrating =
    !mini &&
    player === viewer &&
    !!onMigrate &&
    !!g.migration &&
    (g.players[player].migrations ?? 0) > 0 &&
    canAct(g, viewer) &&
    g.phase === 'play';
  const pending = natureChoice.migration;
  if (g.id === 'undertow') {
    const face = (card: Card, hazard: number) => (
      <Face
        card={card}
        id={g.id}
        hazard={hazard}
        penaltyRank={tidePenaltyRank(g)}
        penaltyValue={tidePenaltyValue(g)}
      />
    );
    if (mini)
      return (
        <BlackwakeTable
          onCapturesSettled={onCapturesSettled}
          g={g}
          viewer={viewer}
          face={face}
        />
      );
    // The captain's cabin: the painted chart table is the board; the crew sits
    // on the painted stools around it, each seat carrying its own score tag.
    const cabin = tableWorldFor('undertow', portrait, variant);
    const totals = scores(g);
    const stools = cabin.seats?.[String(g.players.length) as keyof typeof cabin.seats];
    const anchors = stools?.map(([x, y]) => ({
      x: ((x - cabin.table.left) / cabin.table.width) * 100,
      y: ((y - cabin.table.top) / cabin.table.height) * 100,
    }));
    return (
      <div
        className="nox-board"
        data-paper-world={portrait ? 'portrait' : 'landscape'}
        data-world="undertow"
      >
        <WorldScene art={cabin} tint="rgba(6, 10, 16, 0.5)" />
        <BlackwakeTable
          onCapturesSettled={onCapturesSettled}
          g={g}
          viewer={viewer}
          face={face}
          style={cropPercent(cabin, cabin.table)}
          geometry={cabinGeometry}
          aspect={cabin.table.width / cabin.table.height}
          anchors={anchors}
          seatTags
          onSeat={
            inspect
              ? (seat) =>
                  inspect({
                    title: `${g.players[seat].name} · ${totals[seat]} penalty points`,
                    body: (
                      <p>
                        {g.players[seat].hand.length} cards remaining
                        {g.shields === true
                          ? ` · ${g.players[seat].wards} shields`
                          : ''}
                        {g.salvage
                          ? ` · ${g.players[seat].salvageClaims ?? 0} salvage claim`
                          : ''}
                        .
                      </p>
                    ),
                  })
              : undefined
          }
        />
      </div>
    );
  }
  if (g.id === 'wildgrove')
    return (
      <div
        className={`mora-board observatory-board ${mini ? 'mini-board' : ''} ${g.sanctuaryGoalsEnabled && !mini ? 'has-sanctuary-goals' : ''} ${player !== viewer ? 'opponent-board' : ''}`}
        data-coach="board"
        style={
          mini
            ? {
                aspectRatio: `${world.overview.width} / ${world.overview.height}`,
              }
            : undefined
        }
        data-paper-world={portrait ? 'portrait' : 'landscape'}
        data-world={worldId}
      >
        <img
          className="mora-landscape"
          src={map.image}
          alt={
            worldId === 'floodline'
              ? 'Floodline Station: shore wildlife reclaiming an abandoned coastal field station.'
              : 'The Observatory: wildlife reclaiming an abandoned inland observatory.'
          }
          draggable={false}
        />
        {!mini && <ObservatoryScene art={world} />}
        {map.habitats.map((art) => {
          const z = art.zone;
          const h = habitatsFor(g.contentSet)[z];
          const allowed =
            player === viewer &&
            !mini &&
            canAct(g, viewer) &&
            selected != null &&
            legalMoves({ ...g, active: viewer }).some(
              (m) =>
                m.type === 'play' &&
                m.card === selected &&
                m.zone === z &&
                !!m.roam === !!natureChoice.roam &&
                m.migration?.card === natureChoice.migration?.card &&
                m.migration?.from === natureChoice.migration?.from &&
                m.migration?.to === natureChoice.migration?.to,
            );
          const migrationTarget =
            migrating &&
            !pending &&
            resident !== null &&
            z !== resident.from &&
            z !== 5 &&
            (p.zones[z]?.length ?? 0) < h.cap;
          const [x, y, width, height] = art.bounds;
          const relative = (point: [number, number]): CSSProperties => ({
            left: `${((point[0] - x) / width) * 100}%`,
            top: `${((point[1] - y) / height) * 100}%`,
          });
          const overflow = (p.zones[z] ?? []).slice(h.cap);
          // Chrome caps an absolutely positioned child of a button at the button's
          // width, so the card renders beside the piece; the piece's accessible
          // label already carries name and score.
          const segments = summarySegments(art.summary);
          const groundLabel = (
            <span className="mora-ground-label" style={relative(art.label)}>
              <strong>
                <span className="habitat-name">{h.name}</span>{' '}
                <b
                  aria-label={`${zoneScore(p.zones, z, g.contentSet)} out of ${h.maxScore} points`}
                >
                  {zoneScore(p.zones, z, g.contentSet)}
                  <span>/{h.maxScore}</span>
                </b>
              </strong>
              <small>
                {segments.map((segment, i) => (
                  // The space before each segment is the only break opportunity.
                  <Fragment key={i}>
                    {i > 0 && ' '}
                    <span className="summary-segment">
                      {/* One keyword per area is marked *like this* in the art metadata. */}
                      {segment
                        .split(/(\*[^*]+\*)/)
                        .map((part, j) =>
                          part.startsWith('*') ? (
                            <b key={j}>{part.slice(1, -1)}</b>
                          ) : (
                            part
                          ),
                        )}
                      {i < segments.length - 1 && (
                        <span className="summary-dot">·</span>
                      )}
                    </span>
                  </Fragment>
                ))}
              </small>
            </span>
          );
          const pads = (
            <>
              {art.slots.map((point, i) => {
                const creature = p.zones[z]?.[i];
                return (
                  <span
                    className={`mora-nest ${creature ? 'occupied' : 'empty'} ${[0, 1, 2].includes(z) ? 'square-space' : 'round-space'} ${creature && !mini && migrating && (!pending || pending.card === creature.id) ? 'migratable' : ''}`}
                    key={creature ? `c${creature.id}` : `e${i}`}
                    style={{
                      ...relative(point),
                      width: `${(art.tokenWidth / width) * 100}%`,
                    }}
                  >
                    {/* Only the Pier is filled in order; the Glasshouse trail no longer is. */}
                    {z === 3 && g.contentSet === 'intermediate' && (
                      <span className="mora-trail-step">{i + 1}</span>
                    )}
                    {creature && !mini && player === viewer && !!onMigrate ? (
                      <Piece
                        className={`board-creature ${pending?.card === creature.id ? 'migrated' : ''}`}
                        label={`${creaturesFor(g.contentSet)[creature.kind]} in ${h.name}. ${pending?.card === creature.id ? 'Tap to cancel its migration.' : 'Tap or drag to migrate it to another habitat.'}`}
                        selected={
                          resident?.card === creature.id ||
                          pending?.card === creature.id
                        }
                        unavailable={
                          !migrating ||
                          (!!pending && pending.card !== creature.id)
                        }
                        draggable={migrating && !pending}
                        inspect={() =>
                          inspect?.({
                            title: 'Migration',
                            body: (
                              <p>
                                Move this creature to another habitat with
                                space, once per match. Then make your normal
                                placement.
                              </p>
                            ),
                          })
                        }
                        onTap={() => {
                          if (!migrating) return;
                          if (pending) {
                            if (pending.card === creature.id) {
                              onMigrate?.(undefined);
                              setResident(null);
                            }
                          } else
                            setResident(
                              resident?.card === creature.id
                                ? null
                                : { card: creature.id, from: z },
                            );
                        }}
                        onLift={() =>
                          migrating &&
                          !pending &&
                          setResident({ card: creature.id, from: z })
                        }
                        onDrop={(x, y) => {
                          const target = dropTargetNear(x, y, art.tokenWidth);
                          const to = target?.dataset.drop?.startsWith('zone:')
                            ? Number(target.dataset.drop.split(':')[1])
                            : null;
                          if (
                            to !== null &&
                            to !== z &&
                            to !== 5 &&
                            (p.zones[to]?.length ?? 0) <
                              habitatsFor(g.contentSet)[to].cap
                          )
                            onMigrate?.({ card: creature.id, from: z, to });
                          setResident(null);
                        }}
                      >
                        <TokenArt
                          contentSet={g.contentSet}
                          kind={creature.kind}
                        />
                      </Piece>
                    ) : creature ? (
                      <TokenArt
                        contentSet={g.contentSet}
                        kind={creature.kind}
                      />
                    ) : null}
                    {creature && !mini && (
                      <span
                        key={`portal-${creature.id}`}
                        className="portal-burst"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                );
              })}
              {overflow.length > 0 && (
                <span
                  className="mora-legacy-creatures"
                  title="Creatures retained from the previous map. This habitat cannot accept more."
                >
                  {overflow.map((creature) => (
                    <span key={creature.id}>
                      <TokenArt
                        contentSet={g.contentSet}
                        kind={creature.kind}
                      />
                    </span>
                  ))}
                </span>
              )}
            </>
          );
          return (
            <div
              key={z}
              className={`mora-habitat mora-habitat-${z} ${allowed || migrationTarget ? 'legal-region' : ''} ${preparedZone === z ? 'prepared-region' : ''} ${natureChoice.migration && [natureChoice.migration.from, natureChoice.migration.to].includes(z) ? 'migration-preview-region' : ''}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              data-drop={mini ? undefined : `zone:${z}`}
              data-drop-allowed={allowed ? 'true' : 'false'}
              data-coach={`region-${z}`}
            >
              {mini ? (
                <div className="mora-habitat-inner">
                  {groundLabel}
                  {pads}
                </div>
              ) : (
                <Piece
                  className="mora-habitat-inner"
                  label={`${h.name}. ${h.rule} ${p.zones[z]?.length ?? 0} of ${h.cap} spaces used. ${zoneScore(p.zones, z, g.contentSet)} out of ${h.maxScore} points.`}
                  inspect={() =>
                    inspect?.({
                      title: h.name,
                      body: (
                        <>
                          <p className="big-rule">{h.formula}</p>
                          <p>{h.rule}</p>
                          <p>
                            {p.zones[z]?.length ?? 0} of {h.cap} spaces used.
                            Currently{' '}
                            <b>
                              {zoneScore(p.zones, z, g.contentSet)} /{' '}
                              {h.maxScore} points
                            </b>
                            .
                          </p>
                          <p>
                            {(p.zones[z] ?? [])
                              .map(
                                (creature) =>
                                  creaturesFor(g.contentSet)[creature.kind],
                              )
                              .join(' · ') || 'This habitat is empty.'}
                          </p>
                          <p>
                            {player === g.roller
                              ? 'You are the roller: choose any habitat with space.'
                              : `Current restriction: ${dice[g.die].name}. ${placementDieRule(g.die, g.contentSet)}`}
                          </p>
                        </>
                      ),
                    })
                  }
                  onTap={() => {
                    if (migrationTarget && resident) {
                      onMigrate?.({ ...resident, to: z });
                      setResident(null);
                    } else if (allowed) onPlace?.(z);
                  }}
                >
                  <span className="mora-habitat-target" />
                </Piece>
              )}
              {!mini && pads}
              {!mini && groundLabel}
            </div>
          );
        })}
        {!mini && player === viewer && onPlace && (
          <MoraTrash
            style={{
              left: `${((world.release[0] - world.crop.left) / world.crop.width) * 100}%`,
              top: `${((world.release[1] - world.crop.top) / world.crop.height) * 100}%`,
            }}
            g={g}
            viewer={viewer}
            selected={selected ?? null}
            preparedZone={preparedZone ?? null}
            onPlace={onPlace}
          />
        )}
      </div>
    );
  const c = counts(p.zones[0]),
    sc = foodBreakdown(
      p.zones[0],
      g.players.filter((_, i) => i !== player).map((p) => p.zones[0]),
      g.contentSet,
    );
  // The night market: the collection board stands on the painted counter.
  const market = mini ? null : tableWorldFor('midnight', portrait, variant);
  const marketBoard = (
    <div
      className={`market-board ${g.customerOrders || g.specialtyStalls ? 'festival-board' : ''} ${mini ? 'mini-board' : ''} ${market ? 'counter-board' : ''}`}
      data-drop={mini ? undefined : 'menu'}
      aria-label={`${p.name}’s dishes`}
      data-coach="board"
      style={market ? cropPercent(market, market.table) : undefined}
    >
      {foodsFor(g.contentSet).map((f, k) => {
        const stall = g.specialtyStalls
          ? festivalBreakdown(p).stalls.find((item) => item.kind === k)
          : undefined;
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
                    <TokenArt contentSet={g.contentSet} kind={k} food />
                  </span>
                ),
              )}
              <b className="quantity">×{c[k]}</b>
            </div>
            <strong>{f.name}</strong>
            <span className="collection-score">{sc[k]} pts</span>
            {stall && (
              <span
                className="dish-permit"
                aria-label={`Specialty stall: +${stall.points} of 6 bonus points`}
              >
                <Store size={16} aria-hidden="true" />
                <b>+{stall.points}</b>
              </span>
            )}
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
                    art: <TokenArt contentSet={g.contentSet} kind={k} food />,
                    body: (
                      <>
                        <h3>{f.formula}</h3>
                        <p>{f.rule}</p>
                        <div className="example">{f.example}</div>
                        <p>
                          {c[k]} collected · {sc[k]} points.
                          {stall &&
                            ` Specialty stall: +${stall.points}/6 bonus points. Every matching dish drafted after opening earns +2; the opening dish does not count. This permit lasts across rounds.`}
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
  if (!market) return marketBoard;
  return (
    <div
      className="market-world"
      data-paper-world={portrait ? 'portrait' : 'landscape'}
      data-world="midnight"
    >
      <WorldScene art={market} tint="rgba(14, 18, 48, 0.45)" />
      {marketBoard}
    </div>
  );
}
/** Crew seats sit on the painted stools just outside the chart table; played
 *  cards gather well inside its rim. Percentages of the table box. */
const cabinGeometry: TableGeometry = { seats: [57, 66], cards: [27, 26] };
export function Players({
  g,
  inspect,
  viewer = 0,
  volume = 0.5,
  disabled = false,
  connectionStatus,
  advanced = false,
  boardButton = false,
  progress,
}: {
  g: Game;
  inspect: Inspect;
  viewer?: number;
  volume?: number;
  disabled?: boolean;
  connectionStatus?: string;
  advanced?: boolean;
  /** One shared Board control opens the table inspection; player tags only preview on hover. */
  boardButton?: boolean;
  /** Round and pick progress, shown centred on the same line as the Boards control. */
  progress?: ReactNode;
}) {
  const playersRoot = useRef<HTMLDivElement>(null);
  const [othersSlot, setOthersSlot] = useState<Element | null>(null);
  useEffect(() => {
    setOthersSlot(playersRoot.current?.closest('.table-layout')?.querySelector('.table-others-slot') ?? null);
  }, []);
  const boardTrigger = useRef<HTMLButtonElement | null>(null);
  const [boardSeat, setBoardSeat] = useState<number | null>(null);
  const actionable = canAct(g, viewer) && !disabled;
  const turn = decisionKey(g);
  const key = `${turn}:${canAct(g, viewer)}`;
  const lastCue = useRef(actionable ? turn : null);
  useEffect(() => {
    if (actionable && g.phase !== 'roll' && lastCue.current !== turn) {
      cue('turn', volume);
      lastCue.current = turn;
    }
  }, [turn, actionable, volume, g.phase]);
  const waiting = g.players.flatMap((player, seat) =>
    canAct(g, seat) ? [seat === viewer ? 'you' : player.name] : [],
  );
  const committed =
    simultaneous(g) &&
    readySeats(g)[viewer] &&
    (g.phase !== 'salvage' ||
      (viewer !== g.trickLeader && (g.players[viewer].salvageClaims ?? 0) > 0));
  const status = disabled
    ? (connectionStatus ?? 'Connecting…')
    : g.phase === 'over'
      ? 'Final scores'
      : actionable
        ? g.phase === 'salvage'
          ? 'Your decision · claim or pass'
          : g.phase === 'pass'
            ? 'Your exchange · choose cards'
            : g.phase === 'roll'
              ? 'Rolling…'
              : 'Your turn'
        : `${committed ? 'Locked · waiting for' : 'Waiting for'} ${waiting.join(', ')}`;
  const sc = scores(g);
  return (
    <div
      ref={playersRoot}
      className={`players ${actionable ? 'your-turn' : ''} count-${g.players.length}`}
      data-coach="players"
    >
      <Dialog
        open={boardSeat !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBoardSeat(null);
            requestAnimationFrame(() => boardTrigger.current?.focus());
          }
        }}
      >
        <DialogContent className="all-boards-modal" data-game={g.id}>
          <DialogTitle className="sr-only">Boards around the table</DialogTitle>
          <DialogDescription className="sr-only">
            Passing order, then every opponent’s board and remaining abilities.
          </DialogDescription>
          <OpponentBoards
            g={g}
            viewer={viewer}
            inspect={inspect}
            selected={boardSeat ?? viewer}
          />
        </DialogContent>
      </Dialog>
      <output
        className={`player-turn-status ${disabled ? 'connection-warning' : 'sr-only'}`}
        key={key}
      >
        {status}
      </output>
      {g.players.map((p, i) => {
        const trigger = (
          <button
            title={p.name}
            className={`player-button ${canAct(g, i) ? 'active' : ''}`}
            onClick={(event) => {
              if (boardButton) return;
              boardTrigger.current = event.currentTarget;
              return advanced && g.id !== 'undertow'
                ? setBoardSeat(i)
                : inspect({
                    title: `${p.name} · ${sc[i]} ${g.id === 'undertow' ? 'penalty points' : 'points'}`,
                    body:
                      g.id === 'undertow' ? (
                        <p>
                          {p.hand.length} cards remaining · {p.wards} shields.
                        </p>
                      ) : (
                        <>
                          <PlayerResources g={g} player={i} inspect={inspect} />
                          <Board g={g} player={i} mini />
                        </>
                      ),
                  });
            }}
          >
            <span className={`avatar avatar-${i}`}>{p.name.slice(0, 1)}</span>
            <span>{p.name}</span>
            <b>{sc[i]}</b>
            {g.phase !== 'over' && (
              <PlayerStatus
                state={
                  disabled
                    ? 'offline'
                    : canAct(g, i)
                      ? 'deciding'
                      : simultaneous(g) && readySeats(g)[i]
                        ? 'ready'
                        : 'waiting'
                }
                roller={g.id === 'wildgrove' && g.roller === i}
              />
            )}
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
              <>
                <PlayerResources g={g} player={i} inspect={inspect} />
                <Board g={g} player={i} mini />
              </>
            </HoverCardContent>
          </HoverCard>
        );
      })}
      {boardButton && (
        <div className="table-second-line">
          {progress}
          {othersSlot && createPortal(
          <button
            type="button"
            className="table-board-button"
            onClick={(event) => {
              boardTrigger.current = event.currentTarget;
              setBoardSeat(viewer);
            }}
          >
            <span className="table-board-chip">
              <UsersRound size={16} aria-hidden="true" />
              <span>Others</span>
            </span>
          </button>, othersSlot)}
        </div>
      )}
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
  onDragSelect,
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
  onDragSelect?: (id: number) => void;
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
      className={`hand ${g.id === 'wildgrove' ? 'token-tray' : 'card-hand'} ${g.id === 'undertow' ? 'tide-hand' : ''} ${count > 12 ? 'large-hand' : ''} ${count > 20 ? 'deep-hand' : ''}`}
      data-coach="hand"
      data-drop="hand"
      style={
        {
          '--count': count,
          '--count-2': Math.ceil(count / 2),
          '--count-3': Math.ceil(count / 3),
        } as CSSProperties
      }
    >
      {hand.map((c, index) => {
        return (
          <Piece
            key={c.id}
            cardId={c.id}
            style={
              g.id === 'wildgrove' && g.contentSet !== 'intermediate'
                ? ({
                    '--fan-rise': `calc(var(--fan-lift, 16px) * ${(-(1 - (count > 1 ? ((2 * index) / (count - 1) - 1) ** 2 : 1))).toFixed(3)})`,
                    '--fan-angle': `${count > 1 ? ((2 * index) / (count - 1) - 1) * 7 : 0}deg`,
                  } as CSSProperties)
                : undefined
            }
            label={cardName(g.id, c, g.contentSet)}
            className={`${g.id === 'wildgrove' ? 'creature-piece' : g.id === 'midnight' ? `food-card food-kind-${c.kind}` : 'standard-card'} ${(!canAct(g, viewer) || !legalMoves({ ...g, active: viewer }).some((m) => m.type === 'play' && m.card === c.id)) && g.phase === 'play' ? 'not-playable' : ''}`}
            selected={selected === c.id || passed.includes(c.id)}
            draggable
            inspect={() => inspect(cardInspection(g, c, viewer))}
            onTap={() => onTap(c)}
            onLift={() => {
              if (g.id === 'wildgrove') onDragSelect?.(c.id);
              onLift();
            }}
            onDrop={(x, y, before) => onDrop(c, x, y, before)}
          >
            <Face
              card={c}
              id={g.id}
              contentSet={g.contentSet}
              hazard={g.hazard}
              penaltyRank={tidePenaltyRank(g)}
              penaltyValue={tidePenaltyValue(g)}
            />
          </Piece>
        );
      })}
    </ScrollArea>
  );
}
