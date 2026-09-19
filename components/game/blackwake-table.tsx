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
  readySeats,
  scores,
  simultaneous,
  suitNames,
  suits,
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
  style,
  aspect = 1.6,
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
      reduced ? 1000 : 2200,
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
      {seatTags && g.phase !== 'over' && (
        <DirectionRing clockwise={g.round % 2 === 1} aspect={aspect} />
      )}
      <div className="blackwake-centre" aria-live="polite">
        <span className="table-direction" aria-label="Play proceeds clockwise">
          ↻
        </span>
        {g.salvage && <Anchor aria-label="Salvage" />}
        <span>
          {reveal
            ? g.players[reveal.player].name
            : trick.length
              ? `${suits[trick[0].card.kind]} ${suitNames[trick[0].card.kind]}`
              : g.phase === 'salvage'
                ? 'Secret claims'
                : 'NOX'}
        </span>
      </div>
      {g.players.map((player, seat) => {
        const position = seatAt(seat);
        const delta =
          reveal?.scoreChanges?.[seat] ??
          (reveal?.player === seat ? reveal.points : undefined);
        const Tag = onSeat ? 'button' : 'div';
        return (
          <Tag
            className={`table-seat ${canAct(g, seat) ? 'active' : ''} ${seat === viewer ? 'viewer' : ''}`}
            key={seat}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
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
        const position = seatPosition(
          entry.player,
          viewer,
          g.players.length,
          ...geometry.cards,
        );
        return (
          <div
            key={`${reveal?.id ?? 'live'}:${entry.card.id}`}
            className={`blackwake-played-card ${reveal ? 'captured' : ''}`}
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
            <span className="played-order">
              {order + 1}
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

/** Four arrowed strokes just inside the rim of the rectangular playing surface
 *  show which way this round travels: cards pass and play proceeds clockwise
 *  on odd rounds and the other way on even rounds. It changes once per round,
 *  never per trick. */
function DirectionRing({ clockwise, aspect }: { clockwise: boolean; aspect: number }) {
  const w = 1000, h = w / aspect, inset = 52, gap = 110, size = 30;
  const x0 = inset, x1 = w - inset, y0 = inset, y1 = h - inset;
  // Each side as [from, to] in clockwise travel; reversed for counterclockwise.
  const sides: [number, number, number, number][] = [
    [x0 + gap, y0, x1 - gap, y0],
    [x1, y0 + gap, x1, y1 - gap],
    [x1 - gap, y1, x0 + gap, y1],
    [x0, y1 - gap, x0, y0 + gap],
  ];
  const strokes = sides.map(([ax, ay, bx, by]) => {
    const [fx, fy, tx, ty] = clockwise ? [ax, ay, bx, by] : [bx, by, ax, ay];
    const len = Math.hypot(tx - fx, ty - fy), ux = (tx - fx) / len, uy = (ty - fy) / len, nx = -uy, ny = ux;
    const head = `${tx},${ty} ${tx - ux * size + nx * size * 0.55},${ty - uy * size + ny * size * 0.55} ${tx - ux * size - nx * size * 0.55},${ty - uy * size - ny * size * 0.55}`;
    return { d: `M ${fx} ${fy} L ${tx - ux * size * 0.6} ${ty - uy * size * 0.6}`, head };
  });
  return (
    <svg
      className="table-direction-ring"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <title>{`This round goes ${clockwise ? 'clockwise' : 'counterclockwise'}`}</title>
      {strokes.map((stroke, i) => (
        <g key={i}>
          <path d={stroke.d} />
          <polygon points={stroke.head} />
        </g>
      ))}
    </svg>
  );
}
