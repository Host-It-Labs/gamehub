'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronsRight,
  Clover,
  Coins,
  Droplet,
  Eraser,
  Factory,
  Lamp,
  Lock,
  MousePointer2,
  Package,
  Printer,
  RotateCw,
  Sparkles,
  Split,
  Stamp,
  Store,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
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

export const MACHINE_ICONS: Record<MachineKind, LucideIcon> = {
  belt: ChevronsRight,
  printer: Printer,
  bot: Bot,
  cashier: Store,
  splitter: Split,
  lamp: Lamp,
  ink: Droplet,
  stamper: Stamp,
  gilder: Sparkles,
  charm: Clover,
  bundler: Package,
};
type Tool = { mode: 'build'; kind: MachineKind } | { mode: 'select' | 'erase' };
type Cell = { x: number; y: number };
const ORDER = BLUEPRINTS.flatMap((b) => b.kinds);

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
    [cell, setCell] = useState(48),
    [turned, setTurned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null),
    floor = useRef<HTMLDivElement>(null),
    drag = useRef<{ last: Cell; pointer: number } | null>(null),
    pending = useRef<{ ghost: (Cell & { dir: Dir })[]; erasing: Cell[] }>({
      ghost: [],
      erasing: [],
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
  const selectedMachine = selected
    ? machineAt(f, selected.x, selected.y)
    : undefined;
  useLayoutEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const measure = () => {
      const r = element.getBoundingClientRect(),
        flat = Math.min(r.width / width, r.height / height),
        upright = Math.min(r.width / height, r.height / width);
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
    if (tool.mode === 'build') setDir((d) => ((d + 1) % 4) as Dir);
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
        <Factory size={54} strokeWidth={1.3} />
        <h2>Ticket factory</h2>
        <p>Print, scratch and sell tickets automatically.</p>
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
    if (!d || (d.last.x === to.x && d.last.y === to.y)) return;
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
        ...steps.filter(
          (s) => occupied(s) && !list.some((c) => c.x === s.x && c.y === s.y),
        ),
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
        if (!occupied(s) && !next.some((c) => c.x === s.x && c.y === s.y)) {
          prev = { ...s };
          next.push(prev);
        } else prev = undefined;
      }
      return next;
    });
  }
  function commit() {
    const pieces = pending.current.ghost,
      removed = pending.current.erasing;
    drag.current = null;
    setGhost([]);
    setErasing([]);
    if (pieces.length && tool.mode === 'build')
      void onAct({
        type: 'factory-build',
        pieces: pieces.map((p) => ({ ...p, kind: tool.kind })),
      });
    if (removed.length) void onAct({ type: 'factory-remove', cells: removed });
  }
  const ghostCost =
    tool.mode === 'build'
      ? ghost.reduce((n, _, i) => n + machinePrice(f, tool.kind, i), 0)
      : 0;
  const items: { item: Item; x: number; y: number; slot: number }[] = [];
  for (const m of f.machines) {
    if (m.item) items.push({ item: m.item, x: m.x, y: m.y, slot: 0 });
    if (m.output) items.push({ item: m.output, x: m.x, y: m.y, slot: 1 });
    m.hold?.forEach((item, i) => items.push({ item, x: m.x, y: m.y, slot: i }));
  }
  items.sort((a, b) => a.item.id - b.item.id);
  return (
    <div className="rs-factory">
      <aside className="rs-palette" aria-label="Machines">
        <div className="rs-palette-tools">
          <button
            aria-pressed={tool.mode === 'select'}
            aria-label="Select"
            title="Select"
            onClick={() => setTool({ mode: 'select' })}
          >
            <MousePointer2 size={17} />
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
            const Icon = MACHINE_ICONS[kind],
              open = kindOpen(f, kind),
              blueprint = BLUEPRINTS.find((b) => b.kinds.includes(kind))!,
              price = open ? machinePrice(f, kind) : blueprint.price;
            return (
              <button
                key={kind}
                className={`rs-part ${open ? '' : 'is-locked'}`}
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
                <span className={`rs-part-icon kind-${kind}`}>
                  {open ? <Icon size={18} /> : <Lock size={15} />}
                </span>
                <b>{MACHINES[kind].name}</b>
                <small className={coins < price ? 'is-short' : ''}>
                  {!open && 'Unlock '}
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
            ref={floor}
            className={`rs-floor mode-${tool.mode}`}
            style={
              {
                width: cell * (turned ? height : width),
                height: cell * (turned ? width : height),
                '--cell': `${cell}px`,
              } as React.CSSProperties
            }
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
              if (tool.mode === 'erase') {
                drag.current = { last: c, pointer: event.pointerId };
                event.currentTarget.setPointerCapture(event.pointerId);
                setErasing(m ? [c] : []);
                return;
              }
              if (m || tool.mode === 'select') {
                setSelected(m ? c : null);
                return;
              }
              setSelected(null);
              drag.current = { last: c, pointer: event.pointerId };
              event.currentTarget.setPointerCapture(event.pointerId);
              setGhost([{ ...c, dir }]);
            }}
            onPointerMove={(event) => {
              const c = cellAt(event);
              setHover(c);
              if (drag.current?.pointer === event.pointerId && c) extend(c);
            }}
            onPointerLeave={() => setHover(null)}
            onPointerUp={(event) => {
              if (drag.current?.pointer === event.pointerId) commit();
            }}
            onPointerCancel={() => {
              drag.current = null;
              setGhost([]);
              setErasing([]);
            }}
          >
            {f.machines.map((m) => (
              <MachineTile
                key={`${m.x}-${m.y}`}
                m={m}
                view={view}
                selected={selected?.x === m.x && selected?.y === m.y}
                erasing={erasing.some((c) => c.x === m.x && c.y === m.y)}
              />
            ))}
            {tool.mode === 'build' &&
              (ghost.length
                ? ghost
                : hover && !occupied(hover)
                  ? [{ ...hover, dir }]
                  : []
              ).map((g) => {
                const Icon = MACHINE_ICONS[tool.kind];
                return (
                  <div
                    key={`g${g.x}-${g.y}`}
                    className={`rs-machine is-ghost kind-${tool.kind}`}
                    style={{
                      left: screen(view, g).x * cell,
                      top: screen(view, g).y * cell,
                    }}
                  >
                    <span
                      className="rs-machine-face"
                      style={{
                        rotate:
                          tool.kind === 'belt'
                            ? `${screenDir(view, g.dir) * 90}deg`
                            : undefined,
                      }}
                    >
                      <Icon />
                    </span>
                    {MACHINES[tool.kind].turns && tool.kind !== 'belt' && (
                      <i
                        className="rs-machine-dir"
                        style={{ rotate: `${screenDir(view, g.dir) * 90}deg` }}
                      />
                    )}
                  </div>
                );
              })}
            {items.map(({ item, x, y, slot }) => {
              const at = screen(view, { x, y });
              return (
                <span
                  key={item.id}
                  className={`rs-item ${item.done ? 'is-done' : ''} ${item.star ? 'is-star' : ''} ${item.value ? 'is-bundle' : ''}`}
                  style={
                    {
                      '--book': packFor(item.book).color,
                      transform: `translate(${(at.x + 0.3 + slot * 0.12) * cell}px, ${(at.y + 0.3 - slot * 0.08) * cell}px)`,
                    } as React.CSSProperties
                  }
                />
              );
            })}
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
function MachineTile({
  m,
  view,
  selected,
  erasing,
}: {
  m: Machine;
  view: View;
  selected: boolean;
  erasing: boolean;
}) {
  const Icon = MACHINE_ICONS[m.kind];
  const progress =
    m.kind === 'printer'
      ? m.t / PRINT_TICKS
      : m.kind === 'bot' && m.item
        ? m.t / scratchTicks(m.item.book)
        : 0;
  return (
    <div
      className={`rs-machine kind-${m.kind} ${selected ? 'is-selected' : ''} ${erasing ? 'is-erasing' : ''} ${(m.stuck ?? 0) > 20 ? 'is-stuck' : ''}`}
      style={
        {
          left: `calc(var(--cell) * ${screen(view, m).x})`,
          top: `calc(var(--cell) * ${screen(view, m).y})`,
          '--book': m.book ? packFor(m.book).color : undefined,
        } as React.CSSProperties
      }
    >
      <span
        className="rs-machine-face"
        style={{
          rotate:
            m.kind === 'belt' ? `${screenDir(view, m.dir) * 90}deg` : undefined,
        }}
      >
        <Icon />
      </span>
      {MACHINES[m.kind].turns && m.kind !== 'belt' && (
        <i
          className="rs-machine-dir"
          style={{ rotate: `${screenDir(view, m.dir) * 90}deg` }}
        />
      )}
      {progress > 0 && (
        <b
          className="rs-machine-progress"
          style={{ width: `${Math.min(1, progress) * 80}%` }}
        />
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
    const Icon = MACHINE_ICONS[machine.kind],
      b = boost(f, machine);
    return (
      <div className="rs-inspector">
        <span className={`rs-part-icon kind-${machine.kind}`}>
          <Icon size={18} />
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
                style={{ '--book': p.color } as React.CSSProperties}
                disabled={busy}
                onClick={() =>
                  void onAct({
                    type: 'factory-book',
                    x: machine.x,
                    y: machine.y,
                    book: p.id,
                  })
                }
              />
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
          <span>+{formatNumber(machineRefund(f, machine.kind))}</span>
        </button>
      </div>
    );
  }
  if (tool.mode === 'build') {
    const Icon = MACHINE_ICONS[tool.kind],
      price = ghostCount ? ghostCost : machinePrice(f, tool.kind);
    return (
      <div className="rs-inspector">
        <span className={`rs-part-icon kind-${tool.kind}`}>
          <Icon size={18} />
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
    <div className="rs-inspector">
      <div className="rs-inspector-text">
        <b>{tool.mode === 'erase' ? 'Remove' : 'Select'}</b>
        <small>
          {tool.mode === 'erase'
            ? 'Drag over machines to remove them. You get their price back.'
            : 'Tap a machine to rotate it, remove it or change its book.'}
        </small>
      </div>
      <span className="rs-inspector-price">
        <Coins size={14} />
        {formatNumber(f.rate)}/s · {formatNumber(f.sold)} sold
      </span>
    </div>
  );
}
