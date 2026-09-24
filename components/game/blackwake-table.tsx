'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Anchor, Shield } from 'lucide-react';
import { PlayerStatus } from './player-status';
import {
  canAct,
  tableOrderStep,
  readySeats,
  scores,
  simultaneous,
  suitNames,
  suits,
  trickRevealMs,
  type PublicGame,
  type Card,
  type Event,
} from '@/lib/games/trio/engine';
export function seatPosition(
  seat: number,
  viewer: number,
  count: number,
  radiusX = 40,
  radiusY = 38,
) {
  const angle =
    Math.PI / 2 + (((seat - viewer + count) % count) * Math.PI * 2) / count;
  return {
    x: 50 + Math.cos(angle) * radiusX,
    y: 50 + Math.sin(angle) * radiusY,
  };
}
/** Seat and played-card radii as percentages of the table box. The classic
 *  table keeps its seats on the rim; the cabin plate seats the crew on the
 *  painted stools just outside the painted table. */
export type TableGeometry = { seats: [number, number]; cards: [number, number] };
const classicGeometry: TableGeometry = { seats: [40, 38], cards: [24, 22] };
export function BlackwakeTable({
  g,
  viewer,
  face,
  onCapturesSettled,
  geometry = classicGeometry,
  anchors,
  seatTags = false,
  onSeat,
  cardPull,
  style,
}: {
  g: PublicGame;
  viewer: number;
  face: (card: Card, hazard: number) => ReactNode;
  onCapturesSettled?: (lastEventId: number) => void;
  geometry?: TableGeometry;
  /** Painted stools, as percentages of the table box, clockwise from the viewer's seat. */
  anchors?: { x: number; y: number }[];
  /** Seat tags carry each player's score and turn state (the cabin has no top row). */
  seatTags?: boolean;
  onSeat?: (seat: number) => void;
  /** With anchors: place each played card this share of the way from the centre to its
   *  player's stool, horizontally and vertically, instead of on the shared card ellipse. */
  cardPull?: [number, number];
  style?: CSSProperties;
  /** Width over height of the table box, so the painted direction ring keeps true arrowheads. */
  aspect?: number;
}) {
  const latestSeen = useRef(g.events.at(-1)?.id ?? -1);
  const [queue, setQueue] = useState<Event[]>([]);
  useEffect(() => {
    const fresh = g.events.filter(
      (e) => e.id > latestSeen.current && e.type === 'trick' && e.trick,
    );
    latestSeen.current = Math.max(
      latestSeen.current,
      g.events.at(-1)?.id ?? -1,
    );
    if (fresh.length) setQueue((previous) => [...previous, ...fresh]);
    else if (!queue.length) onCapturesSettled?.(latestSeen.current);
  }, [g.events, queue.length, onCapturesSettled]);
  const reveal = queue[0];
  useEffect(() => {
    if (!reveal) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const timer = setTimeout(
      () => setQueue((previous) => previous.slice(1)),
      reduced ? 1000 : trickRevealMs,
    );
    return () => clearTimeout(timer);
  }, [reveal]);
  const trick = reveal?.trick ?? g.trick;
  const count = g.players.length;
  const seatAt = (seat: number) =>
    anchors?.[(seat - viewer + count) % count] ?? seatPosition(seat, viewer, count, ...geometry.seats);
  const winner = reveal ? seatAt(reveal.player) : null;
  const totals = seatTags ? scores(g) : null;
  return (
    <div
      className={`blackwake-table ${reveal ? 'collecting' : ''} ${seatTags ? 'seat-tags' : ''}`}
      data-drop="trick"
      data-coach="table"
      style={style}
    >
      <div className="blackwake-surface" />
      {seatTags && g.phase !== 'over' && <DirectionRing clockwise={tableOrderStep(g) === 1} passing={g.phase === 'pass'} />}
      <div className="blackwake-centre" aria-live="polite">
        {!seatTags && <span className="table-direction" aria-label={tableOrderStep(g) === 1 ? "Clockwise" : "Counterclockwise"}>{tableOrderStep(g) === 1 ? "↻" : "↺"}</span>}
        {g.salvage && <Anchor aria-label="Salvage" />}
        <span>
          {reveal
            ? g.players[reveal.player].name
            : trick.length
              ? `${suits[trick[0].card.kind]} ${suitNames[trick[0].card.kind]}`
              : g.phase === 'salvage'
                ? 'Secret claims'
                : ''}
        </span>
      </div>
      {g.players.map((player, seat) => {
        const position = seatAt(seat);
        const edge = Math.abs(position.x - 50) > Math.abs(position.y - 50)
          ? position.x < 50 ? 'left' : 'right'
          : position.y < 50 ? 'top' : 'bottom';
        const delta =
          reveal?.scoreChanges?.[seat] ??
          (reveal?.player === seat ? reveal.points : undefined);
        const Tag = onSeat ? 'button' : 'div';
        return (
          <Tag
            className={`table-seat ${canAct(g, seat) ? 'active' : ''} ${seat === viewer ? 'viewer' : ''}`}
            key={seat}
            data-seat-edge={edge}
            style={{
              left: `calc(${position.x}% + var(--seat-offset-x, 0px))`,
              top: `calc(${position.y}% + var(--seat-offset-y, 0px))`,
            }}
            {...(onSeat
              ? { type: 'button' as const, onClick: () => onSeat(seat), title: player.name,
                  'aria-label': `${player.name}${totals ? `, ${totals[seat]} penalty points` : ''}` }
              : {})}
          >
            <span className={`avatar avatar-${seat}`}>
              {player.name.slice(0, 1)}
            </span>
            <strong>{seat === viewer ? 'You' : player.name}</strong>
            {totals && <b className="seat-score" aria-hidden="true">{totals[seat]}</b>}
            {seatTags && g.phase !== 'over' && (
              <PlayerStatus
                state={canAct(g, seat) ? 'deciding' : simultaneous(g) && readySeats(g)[seat] ? 'ready' : 'waiting'}
              />
            )}
            {(reveal?.trick?.[0]?.player ??
              g.trickLeader ??
              g.trick[0]?.player ??
              g.active) === seat && <small>LEAD</small>}
            {(reveal
              ? !!reveal.salvageChanges?.[seat]
              : (g.salvageClaimants ?? []).includes(seat)) && (
              <Anchor size={16} aria-label="Salvage claimed" />
            )}
            {delta !== undefined &&
              (delta !== 0 || !!reveal?.salvageChanges?.[seat]) && (
                <b
                  key={reveal!.id}
                  className={`capture-score ${delta < 0 ? 'reward' : ''}`}
                  aria-label={`${delta < 0 ? 'Score reduction' : 'Penalty'} ${Math.abs(delta)}`}
                >
                  {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                  {Math.abs(delta)}
                  {reveal?.salvageChanges?.[seat] ? (
                    <small className="salvage-score-detail">
                      {seat === reveal.player
                        ? `+${reveal.points ?? 0} / −6`
                        : 'Salvage +3'}
                    </small>
                  ) : null}
                </b>
              )}
          </Tag>
        );
      })}
      {trick.map((entry, order) => {
        const stool = cardPull && anchors?.[(entry.player - viewer + count) % count];
        const position = stool
          ? { x: 50 + (stool.x - 50) * cardPull[0], y: 50 + (stool.y - 50) * cardPull[1] }
          : seatPosition(entry.player, viewer, count, ...geometry.cards);
        return (
          <div
            key={`${reveal?.id ?? 'live'}:${entry.card.id}`}
            className={`blackwake-played-card ${reveal ? 'captured' : ''} ${order === 0 ? 'lead' : ''}`}
            // Upper-half cards carry their order tag underneath, clear of the top seat plates.
            data-tag-edge={position.y < 45 ? 'bottom' : undefined}
            style={
              {
                left: `${position.x}%`,
                top: `${position.y}%`,
                '--collect-x': `${(winner?.x ?? position.x) - position.x}cqw`,
                '--collect-y': `${((winner?.y ?? position.y) - position.y) * 0.68}cqw`,
                '--card-order': order,
              } as CSSProperties
            }
          >
            <span className="played-order" aria-label={order === 0 ? 'Lead card' : undefined}>
              {order === 0 ? 'LEAD' : order + 1}
              {entry.ward && <Shield size={13} />}
            </span>
            <div className="static-face">
              {face(entry.card, reveal?.hazard ?? g.hazard)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One circular chalk arrow at the centre, reversing with the passing round. */
function DirectionRing({ clockwise, passing }: { clockwise: boolean; passing: boolean }) {
  return <svg className="table-direction-ring" viewBox="0 0 100 100"
    aria-label={`${passing ? 'Cards pass' : 'Tricks proceed'} ${clockwise ? 'clockwise' : 'counterclockwise'}`}>
    <g transform={clockwise ? undefined : 'translate(100 0) scale(-1 1)'}>
      <path d="M 50 83 A 33 33 0 1 1 83 50" />
      <polygon points="75,45 83,58 91,45" />
    </g>
  </svg>;
}
