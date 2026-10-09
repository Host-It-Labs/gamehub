'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Check,
  Info,
  Lock,
  RotateCcw,
  Sparkles,
  Undo2,
  Volume2,
} from 'lucide-react';
import {
  canPlaceAnywhere,
  looseEnds,
  placements,
  withCells,
  type Sheet as SheetModel,
} from '@/lib/games/rota/board';
import {
  canFinish,
  mandatory,
  mapOf,
  openDice,
  outcome,
  scoreSeat,
  sheetOf,
  specialsLeft,
  validMove,
  type Extension,
  type RotaGame,
  type RotaMove,
} from '@/lib/games/rota/engine';
import {
  SPECIALS,
  SPECIALS_PER_MATCH,
  orientations,
  pieces,
  type PieceId,
} from '@/lib/games/rota/pieces';
import {
  OUTLET_POINTS,
  RIVER_POINTS,
  TOWN_CAP,
  TUNNEL_POINTS,
  plans as planDefs,
  scoreParts,
  type Breakdown,
} from '@/lib/games/rota/score';
import { gameSound } from '@/lib/games/game-sound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { GameNavigation } from '../game-navigation';
import { PlayerStatus } from '../player-status';
import { SoundToggle } from '../sound-settings';
import { useBadgeFit } from '../use-fit';
import { useResultsFeedback, WinnerCelebration } from '../results-feedback';
import { useGameSound } from '../use-game-sound';
import { RuleSection, Rules } from '../rules';
import { PieceIcon } from './route-art';
import { Sheet } from './sheet';
import { RotaBoard } from './rota-board';
import type { RotaWorld } from './three/world';
import { ExtensionRules, RotaRules, extensionNames } from './rota-rules';
import './rota.css';

export type RotaPerson = { online: boolean; bot: boolean; you?: boolean };

type Pick = { die: number } | { special: PieceId } | null;
type Drag = {
  pick: NonNullable<Pick>;
  p: PieceId;
  x: number;
  y: number;
  cell: number | null;
  moved: boolean;
};

const pickedPiece = (g: RotaGame, pick: Pick): PieceId | null =>
  !pick ? null : 'die' in pick ? g.dice[pick.die] : pick.special;

/** The orientation that joins the most and leaves the fewest loose ends. */
function bestTurn(sh: SheetModel, p: PieceId, cell: number, os: number[]) {
  let best = os[0],
    bestLoose = Infinity;
  for (const o of os) {
    const cells = [...sh.cells];
    cells[cell] = { p, o, r: 0 };
    const loose = looseEnds(withCells(sh, cells)).length;
    if (loose < bestLoose) {
      bestLoose = loose;
      best = o;
    }
  }
  return best;
}

const breakdownRows = (
  g: RotaGame,
): { key: keyof Breakdown; label: string }[] => [
  { key: 'exits', label: 'Exits' },
  { key: 'road', label: 'Road' },
  { key: 'rail', label: 'Rail' },
  { key: 'centre', label: 'Centre' },
  ...(mapOf(g).peaks.length
    ? [{ key: 'tunnels' as const, label: 'Tunnels' }]
    : []),
  ...(g.ext.rivers ? [{ key: 'river' as const, label: 'River' }] : []),
  ...(g.ext.towns ? [{ key: 'towns' as const, label: 'Mills' }] : []),
  ...(g.ext.plans ? [{ key: 'plans' as const, label: 'Plans' }] : []),
  { key: 'errors', label: 'Loose ends' },
];

/** The title block in the sheet's corner: the running score, category by
 *  category. Tap it for the workings. */
function TitleBlock({
  g,
  b,
  name,
  onOpen,
}: {
  g: RotaGame;
  b: Breakdown;
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="rota-title-block"
      onClick={onOpen}
      aria-label={`${name}: ${b.total} points. Show how they add up.`}
    >
      <span className="rota-title-head">
        <span>{mapOf(g).name}</span>
        <b>{b.total}</b>
        <Info className="rota-title-info" aria-hidden="true" />
      </span>
      <span className="rota-title-rows">
        {breakdownRows(g).map((r) => (
          <span
            key={r.key}
            data-key={r.key}
            data-zero={b[r.key] === 0 || undefined}
          >
            <span>{r.label}</span>
            <b>{b[r.key]}</b>
          </span>
        ))}
      </span>
    </button>
  );
}

type PointsRow = {
  key: keyof Breakdown;
  label: string;
  lines: { text: string; points?: number }[];
  note: string;
};

/** The workings of one sheet's score: what each category counted. */
function PointsDetail({
  g,
  seat,
  b,
}: {
  g: RotaGame;
  seat: number;
  b: Breakdown;
}) {
  const map = mapOf(g);
  const parts = useMemo(
    () =>
      scoreParts(sheetOf(g, seat), {
        rivers: g.ext.rivers,
        towns: g.ext.towns ? g.towns : undefined,
        budget: 40_000,
      }),
    [g, seat],
  );
  const squares = (k: number) => `${k} square${k === 1 ? '' : 's'}`;
  const rows: PointsRow[] = [
    {
      key: 'exits',
      label: 'Exits',
      lines: parts.networks.length
        ? parts.networks.map((n) => ({
            text: `A network linking ${n.exits} exits${n.exits === parts.exitsOnMap ? ', all of them' : ''}`,
            points: n.points,
          }))
        : [{ text: 'No network links two exits yet' }],
      note: `4 for each exit a network links after its first, 4 more for linking all ${parts.exitsOnMap}.`,
    },
    {
      key: 'road',
      label: 'Road',
      lines: [{ text: `Longest road, ${squares(parts.road)}` }],
      note: 'A point a square along your longest road, each square once.',
    },
    {
      key: 'rail',
      label: 'Rail',
      lines: [{ text: `Longest rail, ${squares(parts.rail)}` }],
      note: 'A point a square along your longest rail, each square once.',
    },
    {
      key: 'centre',
      label: 'Centre',
      lines: [
        {
          text: `${parts.centre.built} of ${parts.centre.of} centre squares built`,
        },
      ],
      note: 'A point for each paved centre square you build on.',
    },
    ...(map.peaks.length
      ? [
          {
            key: 'tunnels' as const,
            label: 'Tunnels',
            lines: [
              {
                text: `${parts.tunnels} of ${map.peaks.length} peaks tunnelled`,
              },
            ],
            note: `${TUNNEL_POINTS} for each peak with a straight through it.`,
          },
        ]
      : []),
    ...(g.ext.rivers
      ? [
          {
            key: 'river' as const,
            label: 'River',
            lines: [
              {
                text: `Longest river, ${squares(parts.river.length)}`,
                points: parts.river.length * RIVER_POINTS,
              },
              ...(parts.river.outlet
                ? [
                    {
                      text: 'Leaves the map at both ends',
                      points: OUTLET_POINTS,
                    },
                  ]
                : []),
            ],
            note: `${RIVER_POINTS} a square of your longest river, ${OUTLET_POINTS} more if it leaves the map at both ends.`,
          },
        ]
      : []),
    ...(g.ext.towns
      ? [
          {
            key: 'towns' as const,
            label: 'Mills',
            lines: parts.towns.map((t, i) => ({
              text: `Mill ${i + 1}${sheetOf(g, seat).cells[t.cell] ? '' : ', not built'}`,
              points: t.points,
            })),
            note: `A built mill scores a point per exit its network links, up to ${TOWN_CAP}.`,
          },
        ]
      : []),
    ...(g.ext.plans
      ? [
          {
            key: 'plans' as const,
            label: 'Plans',
            lines: g.plans.map((id, k) => {
              const mine = g.seats[seat].plans[k];
              const first = Math.min(
                ...g.seats.map((s) => s.plans[k] || Infinity),
              );
              const plan = planDefs[id];
              return {
                text: `${plan.name}${mine ? `, round ${mine}` : ', not yet'}`,
                points: mine ? (mine === first ? plan.first : plan.later) : 0,
              };
            }),
            note: 'The first round anyone completes a plan pays its high value; later rounds pay less.',
          },
        ]
      : []),
    {
      key: 'errors',
      label: 'Loose ends',
      lines: [
        {
          text: parts.loose
            ? `${parts.loose} road or rail end${parts.loose === 1 ? '' : 's'} leading nowhere`
            : 'None',
        },
      ],
      note: 'Each end into open ground, a blank side, the edge or rubble costs 1. They pulse red on the board.',
    },
  ];
  return (
    <div className="rota-points">
      <p className="rota-points-total">
        <b>Total</b>
        <span>{b.total}</span>
      </p>
      <ul>
        {rows.map((r) => (
          <li
            key={r.key}
            data-key={r.key}
            data-zero={b[r.key] === 0 || undefined}
          >
            <header>
              <b>{r.label}</b>
              <span>{b[r.key]}</span>
            </header>
            {r.lines.map((l, i) => (
              <p key={i}>
                <span>{l.text}</span>
                {l.points !== undefined && <span>{l.points}</span>}
              </p>
            ))}
            <small>{r.note}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCards({
  g,
  seat,
  sheet,
  onInspect,
}: {
  g: RotaGame;
  seat: number;
  sheet: SheetModel;
  onInspect: (k: number) => void;
}) {
  if (!g.ext.plans) return null;
  return (
    <ul className="rota-plans" aria-label="Plans">
      {g.plans.map((id, k) => {
        const plan = planDefs[id];
        const mine = g.seats[seat].plans[k];
        const first = Math.min(...g.seats.map((s) => s.plans[k] || Infinity));
        const taken = Number.isFinite(first);
        const p = plan.progress(sheet);
        const earned = mine ? (mine === first ? plan.first : plan.later) : 0;
        return (
          <li
            key={id}
            data-done={!!mine || undefined}
            data-taken={(taken && !mine) || undefined}
          >
            <button
              type="button"
              onClick={() => onInspect(k)}
              aria-label={`${plan.name}: ${plan.text} ${mine ? `Done, ${earned} points.` : `${p.have} of ${p.of}.`}`}
            >
              <b>{plan.name}</b>
              <span className="rota-plan-points">
                <s
                  data-gone={(taken && !(mine && mine === first)) || undefined}
                >
                  {plan.first}
                </s>
                <i>{plan.later}</i>
              </span>
              {mine ? (
                <span className="rota-plan-stamp">
                  <Check aria-hidden="true" /> {earned}
                </span>
              ) : (
                <span
                  className="rota-plan-bar"
                  style={{ '--p': Math.min(1, p.have / p.of) } as CSSProperties}
                >
                  <i />
                  <small>
                    {p.have}/{p.of}
                  </small>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One of the round's dice: the shared cube with the rolled piece on its face. */
function DieToken({
  g,
  i,
  p,
  state,
  selected,
  onPick,
  onDragStart,
}: {
  g: RotaGame;
  i: number;
  p: PieceId;
  state: 'open' | 'placed' | 'stuck';
  selected: boolean;
  onPick: () => void;
  onDragStart: (e: ReactPointerEvent) => void;
}) {
  const optional = !mandatory(g, i);
  const kind = i === 3 ? 'junction' : i === 4 ? 'river' : 'route';
  return (
    <button
      type="button"
      className="rota-die dice-token"
      data-kind={kind}
      data-state={state}
      data-selected={selected || undefined}
      data-optional={optional || undefined}
      disabled={state !== 'open'}
      aria-pressed={selected}
      aria-label={`${pieces[p].name}${optional ? ', optional' : ''}${state === 'placed' ? ', placed' : state === 'stuck' ? ', fits nowhere' : ''}`}
      onClick={onPick}
      onPointerDown={state === 'open' ? onDragStart : undefined}
    >
      <span className="die-display">
        <span className="die-cube-scene" aria-hidden="true">
          <span key={`${g.round}:${i}`} className="die-cube die-rolling">
            {[0, 1, 2, 3, 4, 5].map((f) => (
              <span key={f} className={`die-face die-face-${f}`}>
                {f === 0 && <PieceIcon p={p} />}
              </span>
            ))}
          </span>
        </span>
      </span>
      {state === 'placed' && (
        <Check className="rota-die-mark" aria-hidden="true" />
      )}
    </button>
  );
}

export function RotaTable({
  g,
  seat,
  people,
  onMove,
  onLeave,
  onAgain,
  againLabel = 'Play again',
  volume,
  onVolume,
  tableSlot,
  notice,
  waitingOn,
}: {
  g: RotaGame;
  seat: number;
  people?: RotaPerson[];
  onMove: (m: RotaMove) => void;
  onLeave: () => void;
  onAgain?: () => void;
  againLabel?: string;
  volume: number;
  onVolume: (v: number) => void;
  /** The table admin's Table button, when played at a table. */
  tableSlot?: ReactNode;
  notice?: string;
  /** Seats the round waits for, when a server knows better than `locked`. */
  waitingOn?: number[];
}) {
  const me = g.seats[seat];
  const map = mapOf(g);
  // A choice belongs to its round: a new roll clears it.
  const [held, setPick] = useState<{ pick: Pick; round: number }>({
    pick: null,
    round: g.round,
  });

  const [drag, setDrag] = useState<Drag | null>(null);
  const [panel, setPanel] = useState<
    'rules' | 'others' | 'score' | 'points' | null
  >(null);
  const [plan, setPlan] = useState<number | null>(null);
  const [viewing, setViewing] = useState(seat);
  const badges = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const world3d = useRef<RotaWorld | null>(null);
  const [shots, setShots] = useState<Record<number, string>>({});
  const stage = useRef<HTMLElement>(null);
  useBadgeFit(badges);
  useGameSound('rota', volume);

  const sh = useMemo(() => sheetOf(g, seat), [g, seat]);
  const open = openDice(g, seat);
  const specials = specialsLeft(g, seat);
  const raw = held.round === g.round ? held.pick : null;
  // A die already placed or a special no longer on offer cannot stay picked.
  const pick: Pick =
    raw &&
    ('die' in raw ? open.includes(raw.die) : specials.includes(raw.special))
      ? raw
      : null;
  const choosePick = (p: Pick) => setPick({ pick: p, round: g.round });
  const piece = pickedPiece(g, pick);
  const spots = useMemo(
    () => (piece && !me.locked ? placements(sh, piece) : []),
    [sh, piece, me.locked],
  );
  const targets = useMemo(
    () => (piece ? new Set(spots.map((s) => s.cell)) : undefined),
    [spots, piece],
  );
  const last = me.draft.at(-1);
  const turnable = !me.locked && last ? last.cell : undefined;
  const loose = useMemo(() => looseEnds(sh), [sh]);
  const scores = useMemo(
    () =>
      g.seats.map((_, i) => (g.final ? g.final[i] : scoreSeat(g, i, 40_000))),
    [g],
  );
  const finish = canFinish(g, seat);
  const strike =
    g.ext.rockfall && !g.over ? (g.strikes[g.round - 1] ?? -1) : -1;

  // A new roll sounds once.
  useEffect(() => {
    if (g.round > 1 && !g.over) gameSound('rota', 'turn', volume);
    // Only the round matters here.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [g.round]);
  // Others shows each sheet as a picture of the 3D board, taken on opening.
  const othersOpen = panel === 'others';
  useEffect(() => {
    if (!othersOpen) return;
    const t = setTimeout(() => {
      const w = world3d.current;
      if (!w) return;
      const next: Record<number, string> = {};
      g.seats.forEach((s, i) => {
        if (i === seat) return;
        next[i] = w.snapshot({
          map,
          cells: s.cells,
          rubble: s.rubble,
          towns: g.ext.towns ? g.towns : [],
          strike: -1,
          loose: looseEnds(sheetOf(g, i)),
          livery: i,
        });
      });
      setShots(next);
    }, 60);
    return () => clearTimeout(t);
    // The pictures are taken when Others opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [othersOpen]);
  const over = g.over;
  const outcomeNow = over ? outcome(g) : null;
  useResultsFeedback('rota', over, over, volume);

  function send(m: RotaMove) {
    if (!validMove(g, m, seat)) {
      gameSound('rota', 'invalid', volume);
      return false;
    }
    onMove(m);
    return true;
  }
  function placeAt(cell: number, chosen: NonNullable<Pick> = pick!) {
    if (!chosen) return;
    const p = pickedPiece(g, chosen)!;
    const os = orientations(p).filter((o) =>
      validMove(
        g,
        'die' in chosen
          ? { type: 'place', die: chosen.die, cell, o }
          : { type: 'special', p, cell, o },
        seat,
      ),
    );
    if (!os.length) return;
    const o = bestTurn(sh, p, cell, os);
    const ok = send(
      'die' in chosen
        ? { type: 'place', die: chosen.die, cell, o }
        : { type: 'special', p, cell, o },
    );
    if (ok) {
      gameSound('rota', 'place', volume);
      choosePick(null);
    }
  }
  const placeRef = useRef(placeAt);
  useEffect(() => {
    placeRef.current = placeAt;
  });
  function turn() {
    if (!last) return;
    const os = orientations(last.p);
    const from = os.indexOf(last.o);
    for (let k = 1; k < os.length; k++) {
      const o = os[(from + k) % os.length];
      if (validMove(g, { type: 'turn', o }, seat)) {
        onMove({ type: 'turn', o });
        gameSound('rota', 'place', volume);
        return;
      }
    }
  }
  function tapCell(cell: number) {
    if (cell === turnable && (!targets || !targets.has(cell))) return turn();
    if (pick && targets?.has(cell)) return placeAt(cell);
    if (cell === turnable) turn();
  }
  function choose(next: NonNullable<Pick>) {
    choosePick(
      pick && JSON.stringify(pick) === JSON.stringify(next) ? null : next,
    );
    gameSound('rota', 'select', volume);
  }
  // Drag a die or a special onto the sheet; a short tap still just picks it.
  function startDrag(next: NonNullable<Pick>, e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const p = pickedPiece(g, next)!;
    const start = { x: e.clientX, y: e.clientY };
    setDrag({
      pick: next,
      p,
      x: e.clientX,
      y: e.clientY,
      cell: null,
      moved: false,
    });
    const move = (ev: PointerEvent) => {
      const moved = Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8;
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-rota-cell]');
      setDrag(
        (d) =>
          d && {
            ...d,
            x: ev.clientX,
            y: ev.clientY,
            moved: d.moved || moved,
            cell: el ? Number(el.dataset.rotaCell) : null,
          },
      );
      if (moved) choosePick(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag((d) => {
        if (d?.moved && d.cell !== null)
          queueMicrotask(() => placeRef.current(d.cell!, d.pick));
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  const dragTargets = useMemo(
    () => (drag ? new Set(placements(sh, drag.p).map((s) => s.cell)) : null),
    [drag, sh],
  );
  const ghost =
    drag?.moved && drag.cell !== null && dragTargets?.has(drag.cell)
      ? (() => {
          const os = placements(sh, drag.p)
            .filter((s) => s.cell === drag.cell)
            .map((s) => s.o);
          return {
            cell: drag.cell!,
            p: drag.p,
            o: bestTurn(sh, drag.p, drag.cell!, os),
          };
        })()
      : null;

  const status = (i: number): 'deciding' | 'ready' | 'offline' => {
    if (people?.[i] && !people[i].online && !people[i].bot) return 'offline';
    const waiting = waitingOn ? waitingOn.includes(i) : !g.seats[i].locked;
    return waiting ? 'deciding' : 'ready';
  };
  const viewSeat = over ? viewing : seat;
  const viewSheet = viewSeat === seat ? sh : sheetOf(g, viewSeat);
  const activeExt = (
    ['rivers', 'plans', 'towns', 'rockfall'] as Extension[]
  ).filter((e) => g.ext[e]);
  const usedSpecials = new Map(me.specials.map((u) => [u.p, u.r]));
  const owedNow = open.filter(
    (i) => mandatory(g, i) && canPlaceAnywhere(sh, g.dice[i]),
  );

  return (
    <main
      ref={root}
      className="rota-world"
      data-map={g.map}
      data-over={over || undefined}
      data-dragging={drag?.moved || undefined}
    >
      <RotaBoard
        world={root}
        stage={stage}
        onWorld={(w) => (world3d.current = w)}
        livery={viewSeat}
        dusk={over ? 1 : (0.8 * (g.round - 1)) / Math.max(1, g.rounds - 1)}
        map={map}
        cells={over ? g.seats[viewSeat].cells : me.cells}
        rubble={g.seats[viewSeat].rubble}
        towns={g.ext.towns ? g.towns : []}
        strike={strike}
        loose={over ? looseEnds(viewSheet) : loose}
        round={over ? undefined : g.round}
        targets={
          over ? undefined : drag?.moved ? (dragTargets ?? undefined) : targets
        }
        turnable={over ? undefined : turnable}
        onCell={over || me.locked ? undefined : tapCell}
        ghost={ghost}
        label={`${g.seats[viewSeat].name}’s sheet`}
      />
      <GameNavigation
        name="Rota"
        round={over ? 'Final' : `Round ${g.round} of ${g.rounds}`}
        onBack={onLeave}
        onOthers={g.seats.length > 1 ? () => setPanel('others') : undefined}
        menu={{
          theme: 'rota',
          onRules: () => setPanel('rules'),
          items: [
            {
              label: 'Score sheet',
              icon: Sparkles,
              onSelect: () => setPanel('score'),
            },
          ],
          sound: (
            <SoundToggle
              Icon={Volume2}
              label="Sound effects"
              on={volume > 0}
              onChange={(on) => onVolume(on ? 0.5 : 0)}
            />
          ),
          onLeave,
        }}
      />
      {tableSlot}
      <div className="rota-players" ref={badges} aria-label="Players">
        {g.seats.map((s, i) => (
          <span
            key={i}
            className="rota-badge"
            data-you={i === seat || undefined}
            data-seat={i}
            title={s.name}
          >
            <i className="rota-badge-mark" aria-hidden="true">
              {s.name.slice(0, 1).toUpperCase()}
            </i>
            <b className="rota-badge-name">{s.name}</b>
            <span className="rota-badge-score">{scores[i].total}</span>
            {!over && <PlayerStatus state={status(i)} />}
          </span>
        ))}
      </div>
      {notice && <output className="rota-notice">{notice}</output>}
      <div className="rota-stage">
        <aside className="rota-side rota-side-left">
          <PlanCards
            g={g}
            seat={viewSeat}
            sheet={viewSheet}
            onInspect={setPlan}
          />
        </aside>
        <section className="rota-desk" ref={stage} />
        <aside className="rota-side rota-side-right">
          <TitleBlock
            g={g}
            b={scores[viewSeat]}
            name={g.seats[viewSeat].name}
            onOpen={() => setPanel('points')}
          />
        </aside>
      </div>
      {over && outcomeNow ? (
        <section className="rota-results" aria-label="Results">
          <WinnerCelebration won={outcomeNow.winners.includes(seat)} />
          <h2>{outcomeNow.title}</h2>
          <ol>
            {outcomeNow.rows.map((r, rank) => (
              <li
                key={r.seat}
                data-you={r.seat === seat || undefined}
                data-viewing={r.seat === viewing || undefined}
              >
                <button
                  type="button"
                  onClick={() => setViewing(r.seat)}
                  aria-label={`${r.name}: ${r.value} points. Show their sheet.`}
                >
                  <span className="rota-rank">{rank + 1}</span>
                  <b>{r.name}</b>
                  <span className="rota-result-total">{r.value}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="rota-results-actions">
            {onAgain && (
              <button
                type="button"
                className="rota-plate rota-again"
                onClick={onAgain}
              >
                <RotateCcw aria-hidden="true" />
                {againLabel}
              </button>
            )}
            <button type="button" className="rota-plate" onClick={onLeave}>
              Leave
            </button>
          </div>
        </section>
      ) : (
        <div className="rota-dock" aria-label="Your dice">
          <div className="rota-dock-row">
            <button
              type="button"
              className="rota-undo"
              disabled={me.locked || !me.draft.length}
              onClick={() => send({ type: 'undo' })}
              aria-label="Undo"
            >
              <Undo2 aria-hidden="true" />
            </button>
            <div className="rota-specials" aria-label="Specials">
              {SPECIALS.map((p) => {
                const used = usedSpecials.get(p);
                const ready = specials.includes(p) && !me.locked;
                const sel = !!pick && 'special' in pick && pick.special === p;
                return (
                  <button
                    key={p}
                    type="button"
                    className="rota-special"
                    data-used={used !== undefined || undefined}
                    data-selected={sel || undefined}
                    disabled={!ready}
                    aria-pressed={sel}
                    aria-label={`${pieces[p].name}${used !== undefined ? `, used in round ${used}` : ready ? '' : ', not this round'}`}
                    onClick={() => choose({ special: p })}
                    onPointerDown={
                      ready ? (e) => startDrag({ special: p }, e) : undefined
                    }
                  >
                    <PieceIcon p={p} />
                    {used !== undefined && (
                      <span className="rota-special-round">{used}</span>
                    )}
                  </button>
                );
              })}
              <span
                className="rota-specials-count"
                aria-label={`${SPECIALS_PER_MATCH - me.specials.length} specials left`}
              >
                {SPECIALS_PER_MATCH - me.specials.length}
              </span>
            </div>
          </div>
          <div className="rota-hand">
            <div className="rota-dice">
              {g.dice.map((p, i) => {
                const placed = !open.includes(i);
                const stuck = !placed && !canPlaceAnywhere(sh, p);
                const sel = !!pick && 'die' in pick && pick.die === i;
                return (
                  <DieToken
                    key={i}
                    g={g}
                    i={i}
                    p={p}
                    state={
                      placed ? 'placed' : stuck || me.locked ? 'stuck' : 'open'
                    }
                    selected={sel}
                    onPick={() => choose({ die: i })}
                    onDragStart={(e) => startDrag({ die: i }, e)}
                  />
                );
              })}
            </div>
            {me.locked ? (
              <button
                type="button"
                className="rota-done"
                data-locked=""
                onClick={() => send({ type: 'reopen' })}
                aria-label="Locked in. Tap to change this round."
              >
                <Lock aria-hidden="true" />
                <PlayerStatus state="waiting" />
              </button>
            ) : (
              <button
                type="button"
                className="rota-done"
                data-ready={finish || undefined}
                disabled={!finish}
                onClick={() => {
                  if (send({ type: 'done' }))
                    gameSound('rota', 'place', volume);
                }}
                aria-label={finish ? 'Done' : `Place ${owedNow.length} more`}
              >
                <Check aria-hidden="true" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      )}
      {drag?.moved && (
        <span
          className="rota-drag"
          aria-hidden="true"
          style={{ left: drag.x, top: drag.y } as CSSProperties}
        >
          <PieceIcon p={drag.p} />
        </span>
      )}
      <Dialog
        open={panel === 'rules'}
        onOpenChange={(o) => !o && setPanel(null)}
      >
        <DialogContent className="modal help-modal rota-modal">
          <DialogTitle>How to play</DialogTitle>
          <DialogDescription className="sr-only">Rota rules</DialogDescription>
          <RotaRules map={g.map} />
          {activeExt.map((e) => (
            <div key={e} className="rota-rules-ext">
              <h3>{extensionNames[e]}</h3>
              <ExtensionRules id={e} />
            </div>
          ))}
        </DialogContent>
      </Dialog>
      <Dialog
        open={panel === 'score'}
        onOpenChange={(o) => !o && setPanel(null)}
      >
        <DialogContent className="modal rota-modal rota-score-modal">
          <DialogTitle>Score sheet</DialogTitle>
          <DialogDescription className="sr-only">
            Everyone’s points so far
          </DialogDescription>
          <ScoreTable g={g} scores={scores} seat={seat} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={panel === 'points'}
        onOpenChange={(o) => !o && setPanel(null)}
      >
        <DialogContent className="modal rota-modal rota-points-modal">
          <DialogTitle>
            {viewSeat === seat
              ? 'Your points'
              : `${g.seats[viewSeat].name}’s points`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            How the score adds up, category by category
          </DialogDescription>
          {panel === 'points' && (
            <PointsDetail g={g} seat={viewSeat} b={scores[viewSeat]} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={panel === 'others'}
        onOpenChange={(o) => !o && setPanel(null)}
      >
        <DialogContent className="modal rota-modal rota-others-modal">
          <DialogTitle>Others</DialogTitle>
          <DialogDescription className="sr-only">
            The other players’ sheets, as of their last finished round
          </DialogDescription>
          <div className="rota-others">
            {g.seats.map((s, i) =>
              i === seat ? null : (
                <figure key={i}>
                  {shots[i] ? (
                    <img
                      className="rota-other-shot"
                      src={shots[i]}
                      alt={`${s.name}’s sheet`}
                      draggable={false}
                    />
                  ) : (
                    <Sheet
                      map={map}
                      cells={s.cells}
                      rubble={s.rubble}
                      towns={g.ext.towns ? g.towns : []}
                      loose={looseEnds(sheetOf(g, i))}
                      label={`${s.name}’s sheet`}
                    />
                  )}
                  <figcaption>
                    <b>{s.name}</b>
                    <span>{scores[i].total}</span>
                    {!over && <PlayerStatus state={status(i)} />}
                  </figcaption>
                </figure>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={plan !== null} onOpenChange={(o) => !o && setPlan(null)}>
        <DialogContent className="modal extension-rules-modal rota-modal">
          {plan !== null && (
            <>
              <DialogTitle>{planDefs[g.plans[plan]].name}</DialogTitle>
              <DialogDescription className="sr-only">Plan</DialogDescription>
              <Rules className="rota-rules">
                <RuleSection
                  note={`${planDefs[g.plans[plan]].first} to everyone who finishes it in the first round anyone does; ${planDefs[g.plans[plan]].later} after that.`}
                >
                  <p>{planDefs[g.plans[plan]].text}</p>
                </RuleSection>
              </Rules>
              <ul className="rota-plan-who">
                {g.seats.map((s, i) => (
                  <li key={i} data-done={!!s.plans[plan] || undefined}>
                    <b>{s.name}</b>
                    <span>
                      {s.plans[plan] ? `Round ${s.plans[plan]}` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ScoreTable({
  g,
  scores,
  seat,
}: {
  g: RotaGame;
  scores: Breakdown[];
  seat: number;
}) {
  const rows = breakdownRows(g);
  return (
    <div className="rota-score-table-wrap">
      <table className="rota-score-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Category</span>
            </th>
            {g.seats.map((s, i) => (
              <th key={i} scope="col" data-you={i === seat || undefined}>
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {scores.map((b, i) => (
                <td key={i}>{b[r.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {scores.map((b, i) => (
              <td key={i}>{b.total}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
