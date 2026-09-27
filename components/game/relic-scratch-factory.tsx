'use client';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Boxes,
  Coins,
  Eraser,
  Hand,
  Lock,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { formatNumber, type RelicAction } from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  DIRS,
  MACHINES,
  PRINT_TICKS,
  TICK_MS,
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
  bookLevel,
  level,
  levelOpen,
  packFor,
  packOpen,
  type ScratchState,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from './relic-scratch-art';

/** Painted top-down machines (scripts/optimize-lucky-factory-art.mjs, v2
 * since 26 September 2026: every side a machine takes tickets from has an
 * intake slot); each faces right, so a machine turns by its direction.
 * Literal paths keep them in the production asset list. */
export const MACHINE_ART: Record<MachineKind, string> = {
  belt: '/art/lucky/factory/belt.webp',
  printer: '/art/lucky/factory/printer-v2.webp',
  bot: '/art/lucky/factory/bot-v2.webp',
  cashier: '/art/lucky/factory/cashier-v2.webp',
  splitter: '/art/lucky/factory/splitter-v2.webp',
  lamp: '/art/lucky/factory/lamp-v2.webp',
  ink: '/art/lucky/factory/ink-v2.webp',
  stamper: '/art/lucky/factory/stamper-v2.webp',
  gilder: '/art/lucky/factory/gilder-v2.webp',
  charm: '/art/lucky/factory/charm-v2.webp',
  bundler: '/art/lucky/factory/bundler-v2.webp',
};
const FLOOR_ART = '/art/lucky/factory/floor.webp';
/** Each sprite is centred on its plate and output chute together; this shift
 * (of the sprite's width, toward its output) centres the plate on its cell,
 * so the chute reaches into the next one. Measured from the v2 sprites. */
const PLATE_SHIFT: Partial<Record<MachineKind, number>> = {
  printer: 8.3,
  bot: 5.7,
  splitter: 6.5,
  stamper: 6,
  gilder: 6.5,
  bundler: 4.7,
};
const LEVEL_NAMES = ['I', 'II', 'III'];
type Tool = { mode: 'build'; kind: MachineKind } | { mode: 'select' | 'erase' };
type Cell = { x: number; y: number };
/** What a player's factory shows: sent to the others' TV, drawn read-only. */
export type FactoryView = {
  tool: 'select' | 'erase' | MachineKind;
  dir: Dir;
  selected: Cell[];
  preview: MachineKind | null;
};
const ORDER = BLUEPRINTS.flatMap((b) => b.kinds);
/** Number keys pick machines in palette order: 1–9, then 0. */
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const same = (a: Cell | null | undefined, b: Cell | null | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y;
const includes = (list: Cell[], c: Cell) => list.some((s) => same(s, c));
/** Multi-select and keyboard hints are for a mouse; touch keeps one machine. */
function finePointer() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  );
}
function toolView(tool: Tool): FactoryView['tool'] {
  return tool.mode === 'build' ? tool.kind : tool.mode;
}
function toolOf(view: FactoryView['tool']): Tool {
  return view === 'select' || view === 'erase'
    ? { mode: view }
    : { mode: 'build', kind: view };
}

export function ScratchFactory({
  state,
  coins,
  busy,
  onAct,
  readOnly = false,
  mirror,
  onView,
}: {
  state: ScratchState;
  coins: number;
  busy: boolean;
  onAct: (action: RelicAction) => Promise<unknown>;
  /** The TV: another player's factory, drawn from their reported view. */
  readOnly?: boolean;
  mirror?: FactoryView;
  /** Tells the others what this factory shows. */
  onView?: (view: FactoryView) => void;
}) {
  const f = state.factory,
    { width, height } = floorSize(state);
  const [ownTool, setTool] = useState<Tool>({ mode: 'select' }),
    [ownDir, setDir] = useState<Dir>(0),
    [ownSelection, setSelection] = useState<Cell[]>([]),
    [ownPreview, setPreview] = useState<MachineKind | null>(null),
    [hover, setHover] = useState<Cell | null>(null),
    [ghost, setGhostState] = useState<(Cell & { dir: Dir })[]>([]),
    [erasing, setErasingState] = useState<Cell[]>([]),
    [moving, setMovingState] = useState<{
      from: Cell;
      to: Cell;
      cells: Cell[];
    } | null>(null),
    [marquee, setMarqueeState] = useState<{ a: Cell; b: Cell } | null>(null),
    [cell, setCell] = useState(0),
    [turned, setTurned] = useState(false),
    [settledFor, setSettledFor] = useState('');
  const tool = mirror ? toolOf(mirror.tool) : ownTool,
    dir = mirror ? mirror.dir : ownDir,
    selection = mirror ? mirror.selected : ownSelection,
    preview = mirror ? mirror.preview : ownPreview;
  const wrap = useRef<HTMLDivElement>(null),
    floor = useRef<HTMLDivElement>(null),
    drag = useRef<{ last: Cell; pointer: number } | null>(null),
    pending = useRef<{
      ghost: (Cell & { dir: Dir })[];
      erasing: Cell[];
      moving: { from: Cell; to: Cell; cells: Cell[]; pointer: number } | null;
      marquee: { a: Cell; b: Cell; pointer: number; add: boolean } | null;
    }>({ ghost: [], erasing: [], moving: null, marquee: null });
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
  const setMoving = (next: typeof pending.current.moving) => {
    pending.current.moving = next;
    setMovingState(next && { from: next.from, to: next.to, cells: next.cells });
  };
  const setMarquee = (next: typeof pending.current.marquee) => {
    pending.current.marquee = next;
    setMarqueeState(next && { a: next.a, b: next.b });
  };
  // Machines that were removed or moved away drop out of the selection.
  const selected = selection.filter((c) => machineAt(f, c.x, c.y));
  const single =
    selected.length === 1
      ? machineAt(f, selected[0].x, selected[0].y)
      : undefined;
  useEffect(() => {
    onView?.({ tool: toolView(ownTool), dir: ownDir, selected: ownSelection, preview: ownPreview });
  }, [onView, ownTool, ownDir, ownSelection, ownPreview]);
  useLayoutEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const view = element.ownerDocument.defaultView ?? window;
    const measure = () => {
      // The brass frame adds 0.14 of a cell on every side; the wrap pads 10px.
      const style = view.getComputedStyle(element),
        w = element.clientWidth - parseFloat(style.paddingLeft) * 2,
        h = element.clientHeight - parseFloat(style.paddingTop) * 2,
        flat = Math.min(w / (width + 0.28), h / (height + 0.28)),
        upright = Math.min(w / (height + 0.28), h / (width + 0.28));
      // Tall screens show the same floor turned a quarter clockwise.
      setTurned(upright > flat * 1.15);
      setCell(Math.max(22, Math.floor(Math.max(flat, upright))));
    };
    measure();
    const observer = new view.ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height, f.blueprints.length]);
  // Nothing slides into place when the floor opens or changes size: motion
  // starts once the new cell size has been painted.
  const sizeKey = `${cell}:${turned}`,
    settled = !!cell && settledFor === sizeKey;
  useEffect(() => {
    if (!cell) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSettledFor(sizeKey));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [cell, sizeKey]);
  function rotate() {
    if (readOnly) return;
    if (tool.mode === 'build') {
      setDir((d) => ((d + 1) % 4) as Dir);
      return;
    }
    const turnable = selected.filter((c) => {
      const m = machineAt(f, c.x, c.y);
      return m && MACHINES[m.kind].turns;
    });
    if (turnable.length === 1)
      void onAct({ type: 'factory-rotate', ...turnable[0] });
    else if (turnable.length)
      void onAct({ type: 'factory-rotate', ...turnable[0], cells: turnable });
  }
  function removeSelected() {
    if (readOnly || !selected.length) return;
    void onAct({ type: 'factory-remove', cells: selected });
    setSelection([]);
  }
  function pick(kind: MachineKind) {
    if (!kindOpen(f, kind)) {
      // A locked machine is explained first; Unlock buys it.
      setPreview((p) => (p === kind ? null : kind));
      return;
    }
    setPreview(null);
    setSelection([]);
    setTool((t) =>
      t.mode === 'build' && t.kind === kind
        ? { mode: 'select' }
        : { mode: 'build', kind },
    );
  }
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.defaultPrevented ||
        target.closest?.('input, select, textarea, dialog, canvas') ||
        document.querySelector('.scratch-modal-backdrop')
      )
        return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'a') {
        event.preventDefault();
        setTool({ mode: 'select' });
        setSelection(f.machines.map((m) => ({ x: m.x, y: m.y })));
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (key === 'r') rotate();
      else if (key === 'v' || key === 's') {
        setTool({ mode: 'select' });
        setPreview(null);
      } else if (key === 'e' || key === 'x') {
        setTool((t) => (t.mode === 'erase' ? { mode: 'select' } : { mode: 'erase' }));
        setSelection([]);
        setPreview(null);
      } else if (key === 'delete' || key === 'backspace') removeSelected();
      else if (key === 'escape') {
        setTool({ mode: 'select' });
        setSelection([]);
        setPreview(null);
      } else if (DIGITS.includes(key) && ORDER[DIGITS.indexOf(key)])
        pick(ORDER[DIGITS.indexOf(key)]);
      else return;
      event.preventDefault();
    };
  });
  useEffect(() => {
    if (readOnly) return;
    const listener = (event: KeyboardEvent) => keys.current(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [readOnly]);
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
          disabled={readOnly || busy || coins < price}
          onClick={() =>
            void onAct({ type: 'factory-blueprint', id: 'starter' })
          }
        >
          Build it <Coins size={16} /> {formatNumber(price)}
        </button>
      </div>
    );
  }
  const view = { cell: cell || 48, turned, height };
  function cellAt(event: { clientX: number; clientY: number }): Cell | null {
    const r = floor.current!.getBoundingClientRect(),
      c = view.cell,
      sx = Math.floor((event.clientX - r.left) / c),
      sy = Math.floor((event.clientY - r.top) / c),
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
        ...steps.filter((s) => occupied(s) && !includes(list, s)),
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
        if (!occupied(s) && !includes(next, s)) {
          prev = { ...s };
          next.push(prev);
        } else prev = undefined;
      }
      return next;
    });
  }
  /** Where a dragged group would land, and whether every cell is free. */
  function shifted(m: { from: Cell; to: Cell; cells: Cell[] }) {
    const dx = m.to.x - m.from.x,
      dy = m.to.y - m.from.y;
    const cells = m.cells.map((c) => ({ x: c.x + dx, y: c.y + dy }));
    const ok = cells.every(
      (c) =>
        c.x >= 0 &&
        c.y >= 0 &&
        c.x < width &&
        c.y < height &&
        (!occupied(c) || includes(m.cells, c)),
    );
    return { dx, dy, cells, ok };
  }
  function commit() {
    const pieces = pending.current.ghost,
      removed = pending.current.erasing,
      move = pending.current.moving,
      box = pending.current.marquee;
    drag.current = null;
    setGhost([]);
    setErasing([]);
    setMoving(null);
    setMarquee(null);
    if (box) {
      const x0 = Math.min(box.a.x, box.b.x),
        x1 = Math.max(box.a.x, box.b.x),
        y0 = Math.min(box.a.y, box.b.y),
        y1 = Math.max(box.a.y, box.b.y);
      const inside = f.machines
        .filter((m) => m.x >= x0 && m.x <= x1 && m.y >= y0 && m.y <= y1)
        .map((m) => ({ x: m.x, y: m.y }));
      setSelection((list) =>
        box.add
          ? [...list, ...inside.filter((c) => !includes(list, c))]
          : inside,
      );
      return;
    }
    if (move) {
      const { dx, dy, cells, ok } = shifted(move);
      if (!dx && !dy) {
        // A tap selects the machine; selecting is the select tool's job.
        setTool({ mode: 'select' });
        setPreview(null);
        setSelection(
          move.cells.length > 1 && includes(ownSelection, move.from)
            ? [move.from]
            : [move.from],
        );
        return;
      }
      if (!ok) return;
      if (move.cells.length === 1)
        void onAct({ type: 'factory-move', ...move.from, to: move.to });
      else void onAct({ type: 'factory-shift', cells: move.cells, dx, dy });
      setSelection(cells);
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
  const lifted = moving && (moving.from.x !== moving.to.x || moving.from.y !== moving.to.y)
    ? shifted(moving)
    : null;
  const placing =
    tool.mode === 'build' && !moving
      ? ghost.length
        ? ghost
        : hover && !occupied(hover)
          ? [{ ...hover, dir }]
          : []
      : [];
  const kindHeld = tool.mode === 'build' ? tool.kind : null;
  const marqueeBox = marquee && (() => {
    const a = screen(view, marquee.a),
      b = screen(view, marquee.b);
    return {
      left: Math.min(a.x, b.x) * view.cell,
      top: Math.min(a.y, b.y) * view.cell,
      width: (Math.abs(a.x - b.x) + 1) * view.cell,
      height: (Math.abs(a.y - b.y) + 1) * view.cell,
    };
  })();
  const hints = !readOnly && finePointer();
  return (
    <div className={`rs-factory ${readOnly ? 'is-mirror' : ''}`}>
      <aside className="rs-palette" aria-label="Machines">
        <div className="rs-palette-tools">
          <button
            aria-pressed={tool.mode === 'select'}
            aria-keyshortcuts="V"
            aria-label="Select and move"
            title="Select and move (V)"
            onClick={() => {
              setTool({ mode: 'select' });
              setPreview(null);
            }}
          >
            <Hand size={17} />
            {hints && <kbd>V</kbd>}
          </button>
          <button
            aria-pressed={tool.mode === 'erase'}
            aria-keyshortcuts="E"
            aria-label="Remove machines"
            title="Remove, with a refund (E)"
            onClick={() => {
              setTool((t) =>
                t.mode === 'erase' ? { mode: 'select' } : { mode: 'erase' },
              );
              setSelection([]);
              setPreview(null);
            }}
          >
            <Eraser size={17} />
            {hints && <kbd>E</kbd>}
          </button>
          <button
            aria-keyshortcuts="R"
            aria-label="Rotate"
            title="Rotate (R)"
            onClick={rotate}
            className="rs-rotate"
          >
            <RotateCw size={17} />
            <i style={{ rotate: `${screenDir({ turned }, dir) * 90}deg` }}>→</i>
            {hints && <kbd>R</kbd>}
          </button>
        </div>
        <div className="rs-palette-list">
          {ORDER.map((kind, i) => {
            const open = kindOpen(f, kind),
              blueprint = BLUEPRINTS.find((b) => b.kinds.includes(kind))!,
              price = open ? machinePrice(f, kind, 0, state) : blueprint.price;
            return (
              <button
                key={kind}
                className={`rs-part ${open ? '' : 'is-locked'} ${preview === kind ? 'is-previewed' : ''}`}
                aria-pressed={
                  open ? kindHeld === kind : preview === kind
                }
                aria-keyshortcuts={DIGITS[i]}
                title={`${MACHINES[kind].name}${DIGITS[i] ? ` (${DIGITS[i]})` : ''}`}
                onClick={() => pick(kind)}
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
                {hints && DIGITS[i] && <kbd>{DIGITS[i]}</kbd>}
              </button>
            );
          })}
        </div>
      </aside>
      <section className="rs-floor-area">
        <div className="rs-floor-wrap" ref={wrap}>
          <div
            className="rs-floor-frame"
            style={{ '--cell': `${view.cell}px` } as React.CSSProperties}
          >
            <div
              ref={floor}
              className={`rs-floor mode-${tool.mode} ${moving ? 'is-moving' : ''}`}
              data-rs-area="floor"
              data-turned={turned ? '' : undefined}
              data-rows={height}
              data-cell={view.cell}
              data-settled={settled ? '' : undefined}
              style={{
                width: view.cell * (turned ? height : width),
                height: view.cell * (turned ? width : height),
                backgroundImage: `url(${FLOOR_ART})`,
                visibility: cell ? undefined : 'hidden',
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (readOnly) return;
                const c = cellAt(event);
                const m = c && machineAt(f, c.x, c.y);
                if (m && MACHINES[m.kind].turns)
                  void onAct({ type: 'factory-rotate', x: m.x, y: m.y });
              }}
              onPointerDown={(event) => {
                if (readOnly || event.button !== 0) return;
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
                const mouse = event.pointerType === 'mouse';
                if (m) {
                  // Shift or ⌘ adds a machine to the selection (mouse only).
                  if (mouse && (event.shiftKey || event.metaKey || event.ctrlKey)) {
                    setTool({ mode: 'select' });
                    setSelection((list) =>
                      includes(list, c)
                        ? list.filter((s) => !same(s, c))
                        : [...list, c],
                    );
                    return;
                  }
                  // Press on a machine: a tap selects it, a drag moves it, and
                  // a selected group moves together.
                  const group =
                    tool.mode === 'select' && includes(selected, c) && selected.length > 1
                      ? selected
                      : [c];
                  setMoving({ from: c, to: c, cells: group, pointer: event.pointerId });
                  return;
                }
                if (tool.mode === 'select') {
                  // A mouse drag on empty floor draws a selection box.
                  const add = event.shiftKey || event.metaKey || event.ctrlKey;
                  if (!add) setSelection([]);
                  if (mouse)
                    setMarquee({ a: c, b: c, pointer: event.pointerId, add });
                  return;
                }
                setSelection([]);
                drag.current = { last: c, pointer: event.pointerId };
                setGhost([{ ...c, dir }]);
              }}
              onPointerMove={(event) => {
                if (readOnly) return;
                const c = cellAt(event);
                if (!same(c, hover)) setHover(c);
                const move = pending.current.moving;
                if (move?.pointer === event.pointerId) {
                  if (c && !same(c, move.to)) setMoving({ ...move, to: c });
                  return;
                }
                const box = pending.current.marquee;
                if (box?.pointer === event.pointerId) {
                  if (c && !same(c, box.b)) setMarquee({ ...box, b: c });
                  return;
                }
                if (drag.current?.pointer === event.pointerId && c) extend(c);
              }}
              onPointerLeave={() => setHover(null)}
              onPointerUp={(event) => {
                if (
                  drag.current?.pointer === event.pointerId ||
                  pending.current.moving?.pointer === event.pointerId ||
                  pending.current.marquee?.pointer === event.pointerId
                )
                  commit();
              }}
              onPointerCancel={() => {
                drag.current = null;
                setGhost([]);
                setErasing([]);
                setMoving(null);
                setMarquee(null);
              }}
            >
              {f.machines.map((m) =>
                lifted && includes(moving!.cells, m) ? null : (
                  <MachineTile
                    key={`${m.x}-${m.y}`}
                    m={m}
                    state={state}
                    view={view}
                    selected={includes(selected, m)}
                    erasing={includes(erasing, m)}
                    stuck={deadEnd(f, m)}
                  />
                ),
              )}
              {lifted &&
                moving!.cells.map((c, i) => {
                  const m = machineAt(f, c.x, c.y);
                  return m ? (
                    <MachineTile
                      key={`lift-${c.x}-${c.y}`}
                      m={{ ...m, ...lifted.cells[i] }}
                      state={state}
                      view={view}
                      selected
                      erasing={false}
                      ghost
                      blocked={!lifted.ok}
                    />
                  ) : null;
                })}
              {kindHeld &&
                placing.map((g) => {
                  const at = screen(view, g);
                  return (
                    <div
                      key={`g${g.x}-${g.y}`}
                      className={`rs-machine is-ghost kind-${kindHeld}`}
                      style={{
                        transform: `translate(${at.x * view.cell}px, ${at.y * view.cell}px)`,
                      }}
                    >
                      <MachineArt kind={kindHeld} rotate={screenDir(view, g.dir)} />
                    </div>
                  );
                })}
              <FactoryItems
                f={f}
                clock={state.activeMs}
                view={view}
                hidden={lifted ? moving!.cells : []}
              />
              {marqueeBox && <div className="rs-marquee" style={marqueeBox} />}
            </div>
          </div>
        </div>
        <Inspector
          state={state}
          machine={single}
          selection={selected}
          preview={preview}
          tool={tool}
          ghostCost={ghostCost}
          ghostCount={ghost.length}
          coins={coins}
          busy={busy || readOnly}
          onAct={onAct}
          onRotate={rotate}
          onRemove={removeSelected}
          onUnlocked={(kind) => {
            setPreview(null);
            setTool({ mode: 'build', kind });
          }}
        />
      </section>
    </div>
  );
}

type View = { cell: number; turned: boolean; height: number };
function screen(view: View, c: Cell): Cell {
  return view.turned ? { x: view.height - 1 - c.y, y: c.x } : c;
}
/** A point on the floor (cell units, not a whole cell) on screen. */
function screenPoint(view: View, x: number, y: number): Cell {
  return view.turned ? { x: view.height - y, y: x } : { x, y };
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
        transform: PLATE_SHIFT[kind] ? `translateX(${PLATE_SHIFT[kind]}%)` : undefined,
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
/** A work ring that fills on its own clock between ticks. It is keyed by
 * the ticket or print it works on, so it starts again at each one, and it is
 * timed once when it starts: later ticks never touch it. */
function Progress({ value, perMs }: { value: number; perMs: number }) {
  const [start] = useState(() => ({ left: Math.max(0, 1 - value), perMs }));
  return (
    <svg className="rs-machine-progress" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="rs-progress-track" r="15" cx="18" cy="18" />
      <circle
        className="rs-progress-fill"
        r="15"
        cx="18"
        cy="18"
        pathLength="1"
        style={
          {
            '--from': start.left,
            animationDuration: `${Math.max(1, start.left / Math.max(start.perMs, 1e-9))}ms`,
          } as React.CSSProperties
        }
      />
    </svg>
  );
}
/** A machine redraws when something it shows changes: most of a floor is
 * belts, which never do between ticks. */
const MachineTile = memo(MachineTileView, (a, b) => {
  const working = (m: Machine) => m.kind === 'printer' || (m.kind === 'bot' && !!(m.item || m.output));
  return (
    a.m.kind === b.m.kind &&
    a.m.x === b.m.x &&
    a.m.y === b.m.y &&
    a.m.dir === b.m.dir &&
    a.m.book === b.m.book &&
    (a.m.hold?.length ?? 0) === (b.m.hold?.length ?? 0) &&
    !working(a.m) &&
    !working(b.m) &&
    a.selected === b.selected &&
    a.erasing === b.erasing &&
    a.stuck === b.stuck &&
    a.ghost === b.ghost &&
    a.blocked === b.blocked &&
    a.view.cell === b.view.cell &&
    a.view.turned === b.view.turned &&
    a.view.height === b.view.height
  );
});
function MachineTileView({
  m,
  state,
  view,
  selected,
  erasing,
  stuck = false,
  ghost = false,
  blocked = false,
}: {
  m: Machine;
  state: ScratchState;
  view: View;
  stuck?: boolean;
  selected: boolean;
  erasing: boolean;
  ghost?: boolean;
  blocked?: boolean;
}) {
  const f = state.factory;
  // Progress per millisecond at this machine's speed, so the ring runs smoothly.
  let progress = 0,
    perMs = 0;
  if (!ghost && m.kind === 'printer' && !m.output) {
    progress = m.t / PRINT_TICKS;
    perMs = (1.5 ** level(state, 'printers') * boost(f, m).speed) / PRINT_TICKS / TICK_MS;
  } else if (!ghost && m.kind === 'bot' && m.item && !m.output) {
    const ticks = scratchTicks(m.item.book);
    progress = m.t / ticks;
    perMs = (1.5 ** level(state, 'bots') * boost(f, m).speed) / ticks / TICK_MS;
  }
  const at = screen(view, m);
  return (
    <div
      className={`rs-machine kind-${m.kind} ${selected ? 'is-selected' : ''} ${erasing ? 'is-erasing' : ''} ${stuck ? 'is-stuck' : ''} ${ghost ? 'is-ghost is-lifted' : ''} ${blocked ? 'is-blocked' : ''} ${perMs ? 'is-working' : ''}`}
      style={
        {
          transform: `translate(${at.x * view.cell}px, ${at.y * view.cell}px)`,
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
      {m.kind === 'bundler' && !!m.hold?.length && (
        <span className="rs-bundle-count" aria-hidden="true">
          {m.hold.map((item) => (
            <i key={item.id} />
          ))}
        </span>
      )}
      {perMs > 0 && (
        <Progress
          key={m.kind === 'bot' ? `t${m.item?.id}` : `p${m.printed ?? 0}`}
          value={progress}
          perMs={perMs}
        />
      )}
    </div>
  );
}
type Placed = {
  item: Item;
  /** Floor position of the ticket's centre, in cells. */
  x: number;
  y: number;
  /** Inside a machine: drawn beneath it, so it slides in and out of sight. */
  inside: boolean;
  sold?: boolean;
};
/** Tickets ride the belts one cell per tick. They slide under a machine as it
 * takes them, peek out of its output while they wait, and a sold ticket keeps
 * its place long enough to slide into its cashier, which flips a coin. */
function FactoryItems({
  f,
  clock,
  view,
  hidden,
}: {
  f: FactoryState;
  /** The desk's active time: the factory's clock. */
  clock: number;
  view: View;
  hidden: Cell[];
}) {
  const placed: Placed[] = [];
  const where = new Map<number, { item: Item; x: number; y: number }>();
  for (const m of f.machines) {
    for (const item of [m.item, m.output, ...(m.hold ?? [])])
      if (item) where.set(item.id, { item, x: m.x, y: m.y });
    if (includes(hidden, m)) continue;
    const cx = m.x + 0.5,
      cy = m.y + 0.5;
    if (m.item)
      placed.push({
        item: m.item,
        x: cx,
        y: cy,
        inside: m.kind !== 'belt' && m.kind !== 'splitter',
      });
    if (m.output) {
      const [dx, dy] = DIRS[m.dir];
      placed.push({ item: m.output, x: cx + dx * 0.34, y: cy + dy * 0.34, inside: true });
    }
    m.hold?.forEach((item) =>
      placed.push({ item, x: cx, y: cy, inside: true }),
    );
  }
  // Compared with the last floor: a ticket that vanished beside a cashier
  // was sold there. It stays, under the same key, and slides into the till;
  // the factory's own active time says when it has gone.
  const [seen, setSeen] = useState<{
    f: FactoryState;
    where: typeof where;
    leaving: { id: number; item: Item; to: Cell; at: number }[];
  }>({ f, where, leaving: [] });
  let leaving = seen.leaving;
  if (seen.f !== f) {
    const fresh: typeof leaving = [];
    for (const [id, was] of seen.where) {
      if (where.has(id) || leaving.some((l) => l.id === id)) continue;
      const cashier = DIRS.map(([dx, dy]) =>
        machineAt(f, was.x + dx, was.y + dy),
      ).find((n) => n?.kind === 'cashier');
      if (cashier)
        fresh.push({ id, item: was.item, to: { x: cashier.x, y: cashier.y }, at: clock });
    }
    leaving = [...leaving, ...fresh].filter(
      (l) => !where.has(l.id) && clock - l.at < TICK_MS * 1.6,
    );
    setSeen({ f, where, leaving });
  }
  for (const { item, to } of leaving)
    placed.push({ item, x: to.x + 0.5, y: to.y + 0.5, inside: true, sold: true });
  placed.sort((a, b) => a.item.id - b.item.id);
  const size = 0.34;
  const place = (x: number, y: number) => {
    const p = screenPoint(view, x, y);
    return `translate(${(p.x - size / 2) * view.cell}px, ${(p.y - size / 2) * view.cell}px)`;
  };
  return (
    <>
      {placed.map(({ item, x, y, inside, sold }) => (
        <span
          key={item.id}
          className={`rs-item ${inside ? 'is-inside' : ''} ${sold ? 'is-sold' : ''} ${item.done ? 'is-done' : ''} ${item.star ? 'is-star' : ''} ${item.value ? 'is-bundle' : ''} ${item.gilded ? 'is-gilded' : ''} ${item.stamped ? 'is-stamped' : ''}`}
          style={
            {
              '--book': packFor(item.book).color,
              '--tilt': `${((item.id * 37) % 13) - 6}deg`,
              transform: place(x, y),
            } as React.CSSProperties
          }
        >
          <img src={TICKET_ART[item.book].small} alt="" draggable={false} />
        </span>
      ))}
      {leaving.map(({ id, to }) => {
        const p = screenPoint(view, to.x + 0.5, to.y + 0.5);
        return (
          <i
            key={`coin-${id}`}
            className="rs-sale-coin"
            aria-hidden="true"
            style={{ transform: `translate(${p.x * view.cell}px, ${p.y * view.cell}px)` }}
          />
        );
      })}
    </>
  );
}

function Inspector({
  state,
  machine,
  selection,
  preview,
  tool,
  ghostCost,
  ghostCount,
  coins,
  busy,
  onAct,
  onRotate,
  onRemove,
  onUnlocked,
}: {
  state: ScratchState;
  machine: Machine | undefined;
  selection: Cell[];
  preview: MachineKind | null;
  tool: Tool;
  ghostCost: number;
  ghostCount: number;
  coins: number;
  busy: boolean;
  onAct: (action: RelicAction) => Promise<unknown>;
  onRotate: () => void;
  onRemove: () => void;
  onUnlocked: (kind: MachineKind) => void;
}) {
  const f = state.factory;
  if (preview && !kindOpen(f, preview)) {
    const blueprint = BLUEPRINTS.find((b) => b.kinds.includes(preview))!;
    return (
      <div className="rs-inspector is-locked" aria-live="polite">
        <span className={`rs-part-art kind-${preview}`}>
          <img src={MACHINE_ART[preview]} alt="" />
          <Lock size={14} className="rs-part-lock" />
        </span>
        <div className="rs-inspector-text">
          <b>{MACHINES[preview].name}</b>
          <small>{MACHINES[preview].does}</small>
        </div>
        <button
          className="rs-primary rs-unlock"
          disabled={busy || coins < blueprint.price}
          onClick={() =>
            void onAct({ type: 'factory-blueprint', id: blueprint.id }).then(
              (result) => {
                if (result) onUnlocked(preview);
              },
            )
          }
        >
          <Unlock size={16} />
          Unlock
          <span className="rs-again-price">
            <Coins size={13} />
            {formatNumber(blueprint.price)}
          </span>
        </button>
      </div>
    );
  }
  if (selection.length > 1) {
    const machines = selection
      .map((c) => machineAt(f, c.x, c.y))
      .filter((m): m is Machine => !!m);
    const refund = machines.reduce(
      (n, m, i) =>
        n + machinePrice(f, m.kind, -1 - machines.slice(0, i).filter((o) => o.kind === m.kind).length, state),
      0,
    );
    return (
      <div className="rs-inspector" aria-live="polite">
        <span className="rs-inspector-group" aria-label={`${machines.length} machines`}>
          <Boxes size={20} />
          <b>{machines.length}</b>
        </span>
        <div className="rs-inspector-kinds" aria-hidden="true">
          {[...new Set(machines.map((m) => m.kind))].slice(0, 6).map((kind) => (
            <img key={kind} src={MACHINE_ART[kind]} alt="" />
          ))}
        </div>
        <button className="rs-icon-button" onClick={onRotate} disabled={busy} title="Rotate (R)">
          <RotateCw size={16} />
          <span className="sr-only">Rotate</span>
        </button>
        <button
          className="rs-icon-button is-danger"
          disabled={busy}
          title="Remove (Delete)"
          onClick={onRemove}
        >
          <Trash2 size={16} />
          <span>+{formatNumber(refund)}</span>
        </button>
      </div>
    );
  }
  if (machine) {
    const b = boost(f, machine);
    return (
      <div className="rs-inspector" aria-live="polite">
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
            {PACKS.filter((p) => packOpen(state, p.id)).map((p) => {
              const rank = bookLevel(state, p.id),
                top = levelOpen(state, p.id);
              return (
                <button
                  key={p.id}
                  title={`${p.name}, level ${rank}, difficulty ${LEVEL_NAMES[top]}`}
                  aria-label={`${p.name}, level ${rank}, difficulty ${LEVEL_NAMES[top]}`}
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
                  <i className="rs-book-level">
                    {rank}
                  </i>
                </button>
              );
            })}
          </div>
        )}
        {MACHINES[machine.kind].turns && (
          <button className="rs-icon-button" onClick={onRotate} disabled={busy} title="Rotate (R)">
            <RotateCw size={16} />
            <span className="sr-only">Rotate</span>
          </button>
        )}
        <button
          className="rs-icon-button is-danger"
          disabled={busy}
          title="Remove (Delete)"
          onClick={onRemove}
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
      <div className="rs-inspector" aria-live="polite">
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
    <div className="rs-inspector" aria-live="polite">
      <div className="rs-inspector-text">
        <b>{tool.mode === 'erase' ? 'Remove' : 'Factory'}</b>
      </div>
      <span className="rs-inspector-price">
        <Coins size={14} />
        {formatNumber(f.rate)}/s · {formatNumber(f.sold)} sold
      </span>
    </div>
  );
}
