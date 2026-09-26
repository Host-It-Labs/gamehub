'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Coins, Eraser, Hand, Lock, RotateCw, Trash2 } from 'lucide-react';
import { formatNumber, type RelicAction } from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  DIRS,
  MACHINES,
  PRINT_TICKS,
  boost,
  floorSize,
  kindOpen,
  machineAt,
  machinePrice,
  machineRefund,
  scratchTicks,
  type Dir,
  type FactoryState,
  type Item,
  type Machine,
  type MachineKind,
} from '@/lib/games/relic/factory';
import {
  PACKS,
  packFor,
  packOpen,
  type ScratchState,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from './relic-scratch-art';

/** Painted top-down machines (scripts/optimize-lucky-factory-art.mjs); each
 * faces right, so a machine turns by its direction. Literal paths keep them
 * in the production asset list. */
export const MACHINE_ART: Record<MachineKind, string> = {
  belt: '/art/lucky/factory/belt.webp',
  printer: '/art/lucky/factory/printer.webp',
  bot: '/art/lucky/factory/bot.webp',
  cashier: '/art/lucky/factory/cashier.webp',
  splitter: '/art/lucky/factory/splitter.webp',
  lamp: '/art/lucky/factory/lamp.webp',
  ink: '/art/lucky/factory/ink.webp',
  stamper: '/art/lucky/factory/stamper.webp',
  gilder: '/art/lucky/factory/gilder.webp',
  charm: '/art/lucky/factory/charm.webp',
  bundler: '/art/lucky/factory/bundler.webp',
};
const FLOOR_ART = '/art/lucky/factory/floor.webp';
type Tool = { mode: 'build'; kind: MachineKind } | { mode: 'select' | 'erase' };
type Cell = { x: number; y: number };
const ORDER = BLUEPRINTS.flatMap((b) => b.kinds);
const same = (a: Cell | null | undefined, b: Cell | null | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y;

export function ScratchFactory({
  state,
  coins,
  busy,
  onAct,
}: {
  state: ScratchState;
  coins: number;
  busy: boolean;
  onAct: (action: RelicAction) => Promise<unknown>;
}) {
  const f = state.factory,
    { width, height } = floorSize(state);
  const [tool, setTool] = useState<Tool>({ mode: 'build', kind: 'belt' }),
    [dir, setDir] = useState<Dir>(0),
    [selected, setSelected] = useState<Cell | null>(null),
    [hover, setHover] = useState<Cell | null>(null),
    [ghost, setGhostState] = useState<(Cell & { dir: Dir })[]>([]),
    [erasing, setErasingState] = useState<Cell[]>([]),
    [moving, setMovingState] = useState<{ from: Cell; to: Cell } | null>(null),
    [cell, setCell] = useState(48),
    [turned, setTurned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null),
    floor = useRef<HTMLDivElement>(null),
    drag = useRef<{ last: Cell; pointer: number } | null>(null),
    pending = useRef<{
      ghost: (Cell & { dir: Dir })[];
      erasing: Cell[];
      moving: { from: Cell; to: Cell; pointer: number } | null;
    }>({
      ghost: [],
      erasing: [],
      moving: null,
    });
  // The pointer handlers read the latest drag through a ref; state only draws it.
  const setGhost = (
    next:
      | (Cell & { dir: Dir })[]
      | ((list: (Cell & { dir: Dir })[]) => (Cell & { dir: Dir })[]),
  ) => {
    pending.current.ghost =
      typeof next === 'function' ? next(pending.current.ghost) : next;
    setGhostState(pending.current.ghost);
  };
  const setErasing = (next: Cell[] | ((list: Cell[]) => Cell[])) => {
    pending.current.erasing =
      typeof next === 'function' ? next(pending.current.erasing) : next;
    setErasingState(pending.current.erasing);
  };
  const setMoving = (
    next: { from: Cell; to: Cell; pointer: number } | null,
  ) => {
    pending.current.moving = next;
    setMovingState(next && { from: next.from, to: next.to });
  };
  const selectedMachine = selected
    ? machineAt(f, selected.x, selected.y)
    : undefined;
  useLayoutEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const measure = () => {
      // The brass frame adds 0.14 of a cell on every side; the wrap pads 10px.
      const style = getComputedStyle(element),
        w = element.clientWidth - parseFloat(style.paddingLeft) * 2,
        h = element.clientHeight - parseFloat(style.paddingTop) * 2,
        r = { width: w, height: h },
        flat = Math.min(r.width / (width + 0.28), r.height / (height + 0.28)),
        upright = Math.min(
          r.width / (height + 0.28),
          r.height / (width + 0.28),
        );
      // Tall screens show the same floor turned a quarter clockwise.
      setTurned(upright > flat * 1.15);
      setCell(Math.max(22, Math.floor(Math.max(flat, upright))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height, f.blueprints.length]);
  const rotate = () => {
    if (tool.mode === 'build' && !selectedMachine)
      setDir((d) => ((d + 1) % 4) as Dir);
    else if (selectedMachine && MACHINES[selectedMachine.kind].turns)
      void onAct({ type: 'factory-rotate', ...selected! });
  };
  const rotateRef = useRef(rotate);
  useEffect(() => {
    rotateRef.current = rotate;
  });
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, select, textarea'))
        return;
      if (event.key === 'r' || event.key === 'R') rotateRef.current();
      if (event.key === 'Escape') {
        setTool({ mode: 'select' });
        setSelected(null);
      }
    };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, []);
  if (!f.blueprints.includes('starter')) {
    const price = BLUEPRINTS[0].price;
    return (
      <div className="rs-factory-closed">
        <div className="rs-factory-preview" aria-hidden="true">
          {(['printer', 'belt', 'bot', 'belt', 'cashier'] as const).map(
            (kind, i) => (
              <img key={i} src={MACHINE_ART[kind]} alt="" />
            ),
          )}
        </div>
        <h2>Ticket factory</h2>
        <button
          className="rs-primary"
          disabled={busy || coins < price}
          onClick={() =>
            void onAct({ type: 'factory-blueprint', id: 'starter' })
          }
        >
          Build it <Coins size={16} /> {formatNumber(price)}
        </button>
      </div>
    );
  }
  const view = { cell, turned, height };
  function cellAt(event: { clientX: number; clientY: number }): Cell | null {
    const r = floor.current!.getBoundingClientRect(),
      sx = Math.floor((event.clientX - r.left) / cell),
      sy = Math.floor((event.clientY - r.top) / cell),
      x = turned ? sy : sx,
      y = turned ? height - 1 - sx : sy;
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  }
  const occupied = (c: Cell) => !!machineAt(f, c.x, c.y);
  function extend(to: Cell) {
    const d = drag.current;
    if (!d || same(d.last, to)) return;
    // Walk cell by cell so a fast drag still draws a connected line.
    let { x, y } = d.last;
    const steps: (Cell & { dir: Dir })[] = [];
    while (x !== to.x || y !== to.y) {
      const stepDir: Dir = x !== to.x ? (to.x > x ? 0 : 2) : to.y > y ? 1 : 3;
      x += DIRS[stepDir][0];
      y += DIRS[stepDir][1];
      steps.push({ x, y, dir: stepDir });
    }
    d.last = to;
    if (tool.mode === 'erase') {
      setErasing((list) => [
        ...list,
        ...steps.filter((s) => occupied(s) && !list.some((c) => same(c, s))),
      ]);
      return;
    }
    if (tool.mode !== 'build' || tool.kind !== 'belt') return;
    setDir(steps.at(-1)!.dir);
    setGhost((list) => {
      const next = list.map((c) => ({ ...c }));
      let prev = next.at(-1);
      for (const s of steps) {
        // The previous belt now points toward this one.
        if (prev && Math.abs(prev.x - s.x) + Math.abs(prev.y - s.y) === 1)
          prev.dir = s.dir;
        if (!occupied(s) && !next.some((c) => same(c, s))) {
          prev = { ...s };
          next.push(prev);
        } else prev = undefined;
      }
      return next;
    });
  }
  function commit() {
    const pieces = pending.current.ghost,
      removed = pending.current.erasing,
      move = pending.current.moving;
    drag.current = null;
    setGhost([]);
    setErasing([]);
    setMoving(null);
    if (move) {
      if (!same(move.from, move.to) && !occupied(move.to)) {
        void onAct({ type: 'factory-move', ...move.from, to: move.to });
        setSelected(move.to);
      } else setSelected(move.from);
      return;
    }
    if (pieces.length && tool.mode === 'build')
      void onAct({
        type: 'factory-build',
        pieces: pieces.map((p) => ({ ...p, kind: tool.kind })),
      });
    if (removed.length) void onAct({ type: 'factory-remove', cells: removed });
  }
  const ghostCost =
    tool.mode === 'build'
      ? ghost.reduce((n, _, i) => n + machinePrice(f, tool.kind, i, state), 0)
      : 0;
  const items: { item: Item; x: number; y: number; slot: number }[] = [];
  for (const m of f.machines) {
    if (same(m, moving?.from)) continue;
    if (m.item) items.push({ item: m.item, x: m.x, y: m.y, slot: 0 });
    if (m.output) items.push({ item: m.output, x: m.x, y: m.y, slot: 1 });
    m.hold?.forEach((item, i) => items.push({ item, x: m.x, y: m.y, slot: i }));
  }
  items.sort((a, b) => a.item.id - b.item.id);
  const movingMachine = moving
    ? machineAt(f, moving.from.x, moving.from.y)
    : undefined;
  const placing =
    tool.mode === 'build' && !moving
      ? ghost.length
        ? ghost
        : hover && !occupied(hover)
          ? [{ ...hover, dir }]
          : []
      : [];
  return (
    <div className="rs-factory">
      <aside className="rs-palette" aria-label="Machines">
        <div className="rs-palette-tools">
          <button
            aria-pressed={tool.mode === 'select'}
            aria-label="Select and move"
            title="Select and move"
            onClick={() => setTool({ mode: 'select' })}
          >
            <Hand size={17} />
          </button>
          <button
            aria-pressed={tool.mode === 'erase'}
            aria-label="Remove machines"
            title="Remove (refunds)"
            onClick={() => setTool({ mode: 'erase' })}
          >
            <Eraser size={17} />
          </button>
          <button
            aria-label="Rotate (R)"
            title="Rotate (R)"
            onClick={rotate}
            className="rs-rotate"
          >
            <RotateCw size={17} />
            <i style={{ rotate: `${screenDir({ turned }, dir) * 90}deg` }}>→</i>
          </button>
        </div>
        <div className="rs-palette-list">
          {ORDER.map((kind) => {
            const open = kindOpen(f, kind),
              blueprint = BLUEPRINTS.find((b) => b.kinds.includes(kind))!,
              price = open ? machinePrice(f, kind, 0, state) : blueprint.price;
            return (
              <button
                key={kind}
                className={`rs-part ${open ? '' : 'is-locked'}`}
                data-game-motion="change"
                data-game-motion-key={open ? 'open' : 'locked'}
                aria-pressed={
                  open ? tool.mode === 'build' && tool.kind === kind : undefined
                }
                disabled={!open && (busy || coins < price)}
                title={MACHINES[kind].does}
                onClick={() => {
                  if (!open)
                    void onAct({ type: 'factory-blueprint', id: blueprint.id });
                  else {
                    setTool({ mode: 'build', kind });
                    setSelected(null);
                  }
                }}
              >
                <span className={`rs-part-art kind-${kind}`}>
                  <img src={MACHINE_ART[kind]} alt="" draggable={false} />
                  {!open && <Lock size={14} className="rs-part-lock" />}
                </span>
                <b>{MACHINES[kind].name}</b>
                <small className={coins < price ? 'is-short' : ''}>
                  <Coins size={10} />
                  {formatNumber(price)}
                </small>
              </button>
            );
          })}
        </div>
      </aside>
      <section className="rs-floor-area">
        <div className="rs-floor-wrap" ref={wrap}>
          <div
            className="rs-floor-frame"
            style={
              {
                '--cell': `${cell}px`,
              } as React.CSSProperties
            }
          >
            <div
              ref={floor}
              className={`rs-floor mode-${tool.mode} ${moving ? 'is-moving' : ''}`}
              style={{
                width: cell * (turned ? height : width),
                height: cell * (turned ? width : height),
                backgroundImage: `url(${FLOOR_ART})`,
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                const c = cellAt(event);
                const m = c && machineAt(f, c.x, c.y);
                if (m && MACHINES[m.kind].turns)
                  void onAct({ type: 'factory-rotate', x: m.x, y: m.y });
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const c = cellAt(event);
                if (!c) return;
                const m = machineAt(f, c.x, c.y);
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  /* A pointer the browser no longer tracks: no capture. */
                }
                if (tool.mode === 'erase') {
                  drag.current = { last: c, pointer: event.pointerId };
                  setErasing(m ? [c] : []);
                  return;
                }
                if (m) {
                  // Press on a machine: a tap selects it, a drag moves it.
                  setMoving({ from: c, to: c, pointer: event.pointerId });
                  return;
                }
                setSelected(null);
                if (tool.mode === 'select') return;
                drag.current = { last: c, pointer: event.pointerId };
                setGhost([{ ...c, dir }]);
              }}
              onPointerMove={(event) => {
                const c = cellAt(event);
                setHover(c);
                const move = pending.current.moving;
                if (move?.pointer === event.pointerId) {
                  if (c && !same(c, move.to)) setMoving({ ...move, to: c });
                  return;
                }
                if (drag.current?.pointer === event.pointerId && c) extend(c);
              }}
              onPointerLeave={() => setHover(null)}
              onPointerUp={(event) => {
                if (
                  drag.current?.pointer === event.pointerId ||
                  pending.current.moving?.pointer === event.pointerId
                )
                  commit();
              }}
              onPointerCancel={() => {
                drag.current = null;
                setGhost([]);
                setErasing([]);
                setMoving(null);
              }}
            >
              {f.machines.map((m) =>
                same(m, moving?.from) &&
                !same(moving?.from, moving?.to) ? null : (
                  <MachineTile
                    key={`${m.x}-${m.y}`}
                    m={m}
                    view={view}
                    selected={same(selected, m)}
                    erasing={erasing.some((c) => same(c, m))}
                    stuck={deadEnd(f, m)}
                  />
                ),
              )}
              {movingMachine && moving && !same(moving.from, moving.to) && (
                <MachineTile
                  m={{ ...movingMachine, ...moving.to }}
                  view={view}
                  selected
                  erasing={false}
                  ghost
                  blocked={occupied(moving.to)}
                />
              )}
              {placing.map((g) => (
                <div
                  key={`g${g.x}-${g.y}`}
                  className={`rs-machine is-ghost kind-${(tool as { kind: MachineKind }).kind}`}
                  style={{
                    left: screen(view, g).x * cell,
                    top: screen(view, g).y * cell,
                  }}
                >
                  <MachineArt
                    kind={(tool as { kind: MachineKind }).kind}
                    rotate={screenDir(view, g.dir)}
                  />
                </div>
              ))}
              {items.map(({ item, x, y, slot }) => {
                const at = screen(view, { x, y });
                return (
                  <span
                    key={item.id}
                    className={`rs-item ${item.done ? 'is-done' : ''} ${item.star ? 'is-star' : ''} ${item.value ? 'is-bundle' : ''} ${item.gilded ? 'is-gilded' : ''} ${item.stamped ? 'is-stamped' : ''}`}
                    style={
                      {
                        '--book': packFor(item.book).color,
                        '--tilt': `${((item.id * 37) % 13) - 6}deg`,
                        transform: `translate(${(at.x + 0.22 + slot * 0.1) * cell}px, ${(at.y + 0.2 - slot * 0.06) * cell}px)`,
                      } as React.CSSProperties
                    }
                  >
                    <img
                      src={TICKET_ART[item.book].small}
                      alt=""
                      draggable={false}
                    />
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <Inspector
          state={state}
          machine={selectedMachine}
          tool={tool}
          ghostCost={ghostCost}
          ghostCount={ghost.length}
          coins={coins}
          busy={busy}
          onAct={onAct}
          onRotate={rotate}
        />
      </section>
    </div>
  );
}

type View = { cell: number; turned: boolean; height: number };
function screen(view: View, c: Cell): Cell {
  return view.turned ? { x: view.height - 1 - c.y, y: c.x } : c;
}
function screenDir(view: { turned: boolean }, dir: Dir) {
  return view.turned ? (dir + 1) % 4 : dir;
}
function MachineArt({ kind, rotate }: { kind: MachineKind; rotate: number }) {
  if (kind === 'belt')
    return (
      <span
        className="rs-belt"
        style={{ rotate: `${rotate * 90}deg` }}
        aria-hidden="true"
      />
    );
  return (
    <img
      className="rs-machine-art"
      src={MACHINE_ART[kind]}
      alt=""
      draggable={false}
      style={{
        rotate: MACHINES[kind].turns ? `${rotate * 90}deg` : undefined,
      }}
    />
  );
}
/** A machine holding a ticket it can never pass on: nothing in front, a
 * machine that takes no tickets, or a belt pointing back at it. A queue
 * behind a slow bot is not stuck. */
function deadEnd(f: FactoryState, m: Machine) {
  if ((m.stuck ?? 0) <= 20 || m.kind === 'splitter') return false;
  const [dx, dy] = DIRS[m.dir],
    next = machineAt(f, m.x + dx, m.y + dy);
  if (!next) return true;
  if (['printer', 'lamp', 'ink', 'charm'].includes(next.kind)) return true;
  const [bx, by] = DIRS[next.dir];
  return (
    MACHINES[next.kind].turns && next.x + bx === m.x && next.y + by === m.y
  );
}
function MachineTile({
  m,
  view,
  selected,
  erasing,
  stuck = false,
  ghost = false,
  blocked = false,
}: {
  m: Machine;
  view: View;
  stuck?: boolean;
  selected: boolean;
  erasing: boolean;
  ghost?: boolean;
  blocked?: boolean;
}) {
  const progress =
    m.kind === 'printer'
      ? m.t / PRINT_TICKS
      : m.kind === 'bot' && m.item
        ? m.t / scratchTicks(m.item.book)
        : 0;
  const at = screen(view, m);
  return (
    <div
      className={`rs-machine kind-${m.kind} ${selected ? 'is-selected' : ''} ${erasing ? 'is-erasing' : ''} ${stuck ? 'is-stuck' : ''} ${ghost ? 'is-ghost is-lifted' : ''} ${blocked ? 'is-blocked' : ''} ${progress > 0 ? 'is-working' : ''}`}
      data-game-motion={ghost ? undefined : 'piece'}
      style={
        {
          left: `calc(var(--cell) * ${at.x})`,
          top: `calc(var(--cell) * ${at.y})`,
          '--book': m.book ? packFor(m.book).color : undefined,
        } as React.CSSProperties
      }
    >
      <MachineArt kind={m.kind} rotate={screenDir(view, m.dir)} />
      {m.kind === 'printer' && m.book && (
        <img
          className="rs-machine-book"
          src={TICKET_ART[m.book].small}
          alt=""
          draggable={false}
        />
      )}
      {progress > 0 && (
        <svg
          className="rs-machine-progress"
          viewBox="0 0 36 36"
          aria-hidden="true"
        >
          <circle
            r="15"
            cx="18"
            cy="18"
            pathLength="1"
            strokeDasharray={`${Math.min(1, progress)} 1`}
          />
        </svg>
      )}
    </div>
  );
}

function Inspector({
  state,
  machine,
  tool,
  ghostCost,
  ghostCount,
  coins,
  busy,
  onAct,
  onRotate,
}: {
  state: ScratchState;
  machine: Machine | undefined;
  tool: Tool;
  ghostCost: number;
  ghostCount: number;
  coins: number;
  busy: boolean;
  onAct: (action: RelicAction) => Promise<unknown>;
  onRotate: () => void;
}) {
  const f = state.factory;
  if (machine) {
    const b = boost(f, machine);
    return (
      <div
        className="rs-inspector"
        data-game-motion="change"
        data-game-motion-key={`${machine.kind}:${machine.x}:${machine.y}:${machine.book ?? ''}`}
      >
        <span className={`rs-part-art kind-${machine.kind}`}>
          <img src={MACHINE_ART[machine.kind]} alt="" />
        </span>
        <div className="rs-inspector-text">
          <b>{MACHINES[machine.kind].name}</b>
          <small>
            {MACHINES[machine.kind].does}
            {b.speed > 1 && ` Now +${Math.round((b.speed - 1) * 100)}% speed.`}
            {b.stars > 0 && ` +${Math.round(b.stars * 100)}% stars.`}
          </small>
        </div>
        {machine.kind === 'printer' && (
          <div className="rs-inspector-books" aria-label="Printed book">
            {PACKS.filter((p) => packOpen(state, p.id)).map((p) => (
              <button
                key={p.id}
                title={p.name}
                aria-label={p.name}
                aria-pressed={machine.book === p.id}
                disabled={busy}
                onClick={() =>
                  void onAct({
                    type: 'factory-book',
                    x: machine.x,
                    y: machine.y,
                    book: p.id,
                  })
                }
              >
                <img src={TICKET_ART[p.id].small} alt="" />
              </button>
            ))}
          </div>
        )}
        {MACHINES[machine.kind].turns && (
          <button className="rs-icon-button" onClick={onRotate} disabled={busy}>
            <RotateCw size={16} />
            <span className="sr-only">Rotate</span>
          </button>
        )}
        <button
          className="rs-icon-button is-danger"
          disabled={busy}
          onClick={() =>
            void onAct({
              type: 'factory-remove',
              cells: [{ x: machine.x, y: machine.y }],
            })
          }
        >
          <Trash2 size={16} />
          <span>+{formatNumber(machineRefund(f, machine.kind, state))}</span>
        </button>
      </div>
    );
  }
  if (tool.mode === 'build') {
    const price = ghostCount ? ghostCost : machinePrice(f, tool.kind, 0, state);
    return (
      <div
        className="rs-inspector"
        data-game-motion="change"
        data-game-motion-key={tool.kind}
      >
        <span className={`rs-part-art kind-${tool.kind}`}>
          <img src={MACHINE_ART[tool.kind]} alt="" />
        </span>
        <div className="rs-inspector-text">
          <b>{MACHINES[tool.kind].name}</b>
          <small>{MACHINES[tool.kind].does}</small>
        </div>
        <span
          className={`rs-inspector-price ${coins < price ? 'is-short' : ''}`}
        >
          {ghostCount > 1 && `${ghostCount} × `}
          <Coins size={14} />
          {formatNumber(price)}
        </span>
      </div>
    );
  }
  return (
    <div
      className="rs-inspector"
      data-game-motion="change"
      data-game-motion-key={tool.mode}
    >
      <div className="rs-inspector-text">
        <b>{tool.mode === 'erase' ? 'Remove' : 'Select'}</b>
        <small>
          {tool.mode === 'erase'
            ? 'Drag over machines to remove them. You get their price back.'
            : 'Tap a machine to turn, remove or change it; drag it to move it.'}
        </small>
      </div>
      <span className="rs-inspector-price">
        <Coins size={14} />
        {formatNumber(f.rate)}/s · {formatNumber(f.sold)} sold
      </span>
    </div>
  );
}
