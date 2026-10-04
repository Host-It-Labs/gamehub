'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Boxes,
  Coins,
  Eraser,
  Hand,
  Lock,
  Minus,
  Move,
  Plus,
  RotateCw,
  Scan,
  Trash2,
  Unlock,
} from 'lucide-react';
import { formatNumber, type RelicAction } from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  DIRS,
  MACHINES,
  boost,
  floorSize,
  kindOpen,
  machineAt,
  machinePrice,
  machineRefund,
  type Dir,
  type Machine,
  type MachineKind,
} from '@/lib/games/relic/factory';
import {
  PACKS,
  bookLevel,
  levelOpen,
  packOpen,
  type ScratchState,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from './relic-scratch-art';
import { floorProjectors } from './relic-factory/anchor';
import { STATUS_WORD, statusOf } from './relic-factory/status';
import { useMachineIcons } from './relic-factory/use-icons';
import type { FactoryWorld, Overlay } from './relic-factory/world';
import { MAX_ZOOM, MIN_ZOOM } from './relic-factory/limits';
import { FactoryGestures } from './relic-factory/gestures';

/** A machine's picture, rendered from its 3D model (blank until drawn). */
export function MachineIcon({
  kind,
  className,
}: {
  kind: MachineKind;
  className?: string;
}) {
  const icons = useMachineIcons();
  return icons ? (
    <img src={icons[kind]} alt="" draggable={false} className={className} />
  ) : (
    <span className={`rs-icon-wait ${className ?? ''}`} aria-hidden="true" />
  );
}

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
/** On a turned floor, a direction points a quarter further round on screen. */
function screenDir(turned: boolean, dir: Dir) {
  return turned ? (dir + 1) % 4 : dir;
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
    [turned, setTurned] = useState(false),
    [zoom, setZoom] = useState(MIN_ZOOM),
    [panMode, setPanMode] = useState(false),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(0);
  const tool = mirror ? toolOf(mirror.tool) : ownTool,
    dir = mirror ? mirror.dir : ownDir,
    selection = mirror ? mirror.selected : ownSelection,
    preview = mirror ? mirror.preview : ownPreview;
  const host = useRef<HTMLDivElement>(null),
    fxLayer = useRef<HTMLDivElement>(null),
    world = useRef<FactoryWorld | null>(null),
    shownOverlay = useRef(''),
    latest = useRef({ state }),
    drag = useRef<{ last: Cell; pointer: number } | null>(null),
    gestures = useRef(new FactoryGestures()),
    pending = useRef<{
      ghost: (Cell & { dir: Dir })[];
      erasing: Cell[];
      moving: { from: Cell; to: Cell; cells: Cell[]; pointer: number } | null;
      marquee: { a: Cell; b: Cell; pointer: number; add: boolean } | null;
    }>({ ghost: [], erasing: [], moving: null, marquee: null });
  useEffect(() => {
    latest.current.state = state;
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
  const setMoving = (next: typeof pending.current.moving) => {
    pending.current.moving = next;
    setMovingState(next && { from: next.from, to: next.to, cells: next.cells });
  };
  const setMarquee = (next: typeof pending.current.marquee) => {
    pending.current.marquee = next;
    setMarqueeState(next && { a: next.a, b: next.b });
  };
  function cancelEditing() {
    drag.current = null;
    setGhost([]);
    setErasing([]);
    setMoving(null);
    setMarquee(null);
    setHover(null);
  }
  function changeZoom(value: number) {
    gestures.current.consume();
    cancelEditing();
    world.current?.zoomTo(value);
  }
  function fitView() {
    gestures.current.consume();
    cancelEditing();
    world.current?.resetView();
    setPanMode(false);
  }
  // Machines that were removed or moved away drop out of the selection.
  const selected = selection.filter((c) => machineAt(f, c.x, c.y));
  const single =
    selected.length === 1
      ? machineAt(f, selected[0].x, selected[0].y)
      : undefined;
  const open = f.blueprints.includes('starter');
  useEffect(() => {
    onView?.({
      tool: toolView(ownTool),
      dir: ownDir,
      selected: ownSelection,
      preview: ownPreview,
    });
  }, [onView, ownTool, ownDir, ownSelection, ownPreview]);

  // The 3D floor lives as long as the open factory; three.js loads with it.
  useLayoutEffect(() => {
    if (!open) return;
    const el = host.current;
    if (!el) return;
    // Each world draws on its own canvas: a lost context is never reused.
    const cv = el.ownerDocument.createElement('canvas');
    cv.className = 'rs-floor-canvas';
    el.prepend(cv);
    let live = true,
      observer: ResizeObserver | null = null;
    const view = el.ownerDocument.defaultView ?? window;
    const input = gestures.current;
    const wheel = (event: WheelEvent) => {
      const w = world.current;
      if (readOnly || !w) return;
      event.preventDefault();
      input.consume();
      cancelEditing();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el.clientHeight
            : 1;
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
      w.zoomTo(w.zoom * Math.exp(-delta * 0.0022), {
        x: event.clientX,
        y: event.clientY,
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    void import('./relic-factory/world')
      .then(({ FactoryWorld }) => {
        if (!live) return;
        const w = new FactoryWorld(cv, fxLayer.current, {
          mirror: readOnly,
          reduced: !!view.matchMedia?.('(prefers-reduced-motion: reduce)')
            .matches,
          onTurn: setTurned,
          onZoom: setZoom,
        });
        world.current = w;
        if (process.env.NODE_ENV === 'development')
          (window as unknown as { luckyFactory?: unknown }).luckyFactory = w;
        const measure = () => w.resize(el.clientWidth, el.clientHeight);
        measure();
        observer = new view.ResizeObserver(measure);
        observer.observe(el);
        w.update(latest.current.state.factory, latest.current.state);
        setReady((n) => n + 1);
        floorProjectors.set(el, {
          toFloor: (x, y) => w.pick(x, y).point,
          toPage: (x, y) => w.project(x, y),
        });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      observer?.disconnect();
      el.removeEventListener('wheel', wheel);
      input.cancel();
      floorProjectors.delete(el);
      world.current?.dispose();
      world.current = null;
      cv.remove();
    };
  }, [open, readOnly]);
  useEffect(() => {
    world.current?.update(f, state);
  }, [f, state]);

  const occupied = (c: Cell) => !!machineAt(f, c.x, c.y);
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
  const lifted =
    moving && (moving.from.x !== moving.to.x || moving.from.y !== moving.to.y)
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
  // Everything the floor draws over the machines.
  const overlayKey = JSON.stringify([
    tool.mode,
    hover,
    selected,
    erasing,
    kindHeld,
    placing,
    lifted && moving && [moving.cells, lifted.cells, lifted.ok],
    marquee,
    f.machines.length,
  ]);
  useEffect(() => {
    // Drawn again only when what it shows has changed.
    const w = world.current,
      key = `${ready}|${overlayKey}`;
    if (!w || shownOverlay.current === key) return;
    shownOverlay.current = key;
    const overlay: Overlay = {
      mode: tool.mode,
      hover: readOnly ? null : hover,
      selected,
      erasing,
      ghosts: kindHeld ? placing.map((g) => ({ ...g, kind: kindHeld })) : [],
      lifted:
        lifted && moving
          ? { from: moving.cells, to: lifted.cells, ok: lifted.ok }
          : null,
      marquee: marquee && {
        x0: Math.min(marquee.a.x, marquee.b.x),
        y0: Math.min(marquee.a.y, marquee.b.y),
        x1: Math.max(marquee.a.x, marquee.b.x),
        y1: Math.max(marquee.a.y, marquee.b.y),
      },
    };
    w.setOverlay(overlay);
  });

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
    setPanMode(false);
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
        target.closest?.('input, select, textarea, dialog') ||
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
      if (key === '+' || key === '=')
        changeZoom((world.current?.zoom ?? 1) * 1.25);
      else if (key === '-' || key === '_')
        changeZoom((world.current?.zoom ?? 1) / 1.25);
      else if (key === 'f') fitView();
      else if (key === 'p') {
        gestures.current.consume();
        cancelEditing();
        setPanMode((p) => !p);
      } else if (key === 'r') rotate();
      else if (key === 'v' || key === 's') {
        setPanMode(false);
        setTool({ mode: 'select' });
        setPreview(null);
      } else if (key === 'e' || key === 'x') {
        setPanMode(false);
        setTool((t) =>
          t.mode === 'erase' ? { mode: 'select' } : { mode: 'erase' },
        );
        setSelection([]);
        setPreview(null);
      } else if (key === 'delete' || key === 'backspace') removeSelected();
      else if (key === 'escape') {
        setPanMode(false);
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
  if (!open) {
    const price = BLUEPRINTS[0].price;
    return (
      <div className="rs-factory-closed">
        <div className="rs-factory-preview" aria-hidden="true">
          {(['printer', 'belt', 'bot', 'belt', 'cashier'] as const).map(
            (kind, i) => (
              <MachineIcon key={i} kind={kind} />
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
  function cellAt(event: { clientX: number; clientY: number }): Cell | null {
    return world.current?.pick(event.clientX, event.clientY).cell ?? null;
  }
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
        setSelection([move.from]);
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
              setPanMode(false);
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
              setPanMode(false);
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
            <i style={{ rotate: `${screenDir(turned, dir) * 90}deg` }}>→</i>
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
                aria-pressed={open ? kindHeld === kind : preview === kind}
                aria-keyshortcuts={DIGITS[i]}
                title={`${MACHINES[kind].name}${DIGITS[i] ? ` (${DIGITS[i]})` : ''}`}
                onClick={() => pick(kind)}
              >
                <span className={`rs-part-art kind-${kind}`}>
                  <MachineIcon kind={kind} />
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
        {!readOnly && !failed && (
          <fieldset className="rs-camera-tools" aria-label="Factory view">
            <button
              type="button"
              aria-label="Zoom out"
              aria-keyshortcuts="-"
              title="Zoom out (−)"
              disabled={!ready || zoom <= MIN_ZOOM}
              onClick={() => changeZoom(zoom / 1.25)}
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              aria-label="Fit factory"
              aria-keyshortcuts="F"
              title="Fit factory (F)"
              disabled={!ready}
              onClick={fitView}
            >
              <Scan size={18} />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              aria-keyshortcuts="+"
              title="Zoom in (+)"
              disabled={!ready || zoom >= MAX_ZOOM}
              onClick={() => changeZoom(zoom * 1.25)}
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              aria-label="Pan factory"
              aria-pressed={panMode}
              aria-keyshortcuts="P"
              title="Pan factory (P), or drag with the middle mouse button"
              disabled={!ready}
              onClick={() => {
                gestures.current.consume();
                cancelEditing();
                setPanMode((p) => !p);
              }}
            >
              <Move size={18} />
            </button>
          </fieldset>
        )}
        <div
          ref={host}
          className={`rs-floor3d mode-${tool.mode} ${moving ? 'is-moving' : ''} ${panMode ? 'is-panning' : ''}`}
          data-rs-area="floor"
          data-turned={turned ? '' : undefined}
          data-rows={height}
          data-zoom={zoom.toFixed(3)}
          onContextMenu={(event) => {
            event.preventDefault();
            if (readOnly || gestures.current.cameraActive) return;
            const c = cellAt(event);
            const m = c && machineAt(f, c.x, c.y);
            if (m && MACHINES[m.kind].turns)
              void onAct({ type: 'factory-rotate', x: m.x, y: m.y });
          }}
          onPointerDown={(event) => {
            if (readOnly || (event.button !== 0 && event.button !== 1)) return;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* Pointer no longer tracked. */
            }
            if (
              gestures.current.begin(
                event.pointerId,
                { x: event.clientX, y: event.clientY },
                panMode || event.button === 1,
              )
            ) {
              event.preventDefault();
              cancelEditing();
              return;
            }
            const c = cellAt(event);
            if (!c) {
              if (tool.mode === 'select' && !event.shiftKey) setSelection([]);
              return;
            }
            const m = machineAt(f, c.x, c.y);
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
                tool.mode === 'select' &&
                includes(selected, c) &&
                selected.length > 1
                  ? selected
                  : [c];
              setMoving({
                from: c,
                to: c,
                cells: group,
                pointer: event.pointerId,
              });
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
            const gesture = gestures.current.move(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            if (gesture) {
              const w = world.current;
              w?.zoomTo(w.zoom * gesture.factor, gesture.from);
              w?.pan(gesture.from, gesture.to);
              return;
            }
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
            if (gestures.current.end(event.pointerId)) return;
            if (
              drag.current?.pointer === event.pointerId ||
              pending.current.moving?.pointer === event.pointerId ||
              pending.current.marquee?.pointer === event.pointerId
            )
              commit();
          }}
          onPointerCancel={() => {
            gestures.current.cancel();
            cancelEditing();
          }}
          onLostPointerCapture={(event) => {
            if (gestures.current.has(event.pointerId)) {
              gestures.current.cancel();
              cancelEditing();
            }
          }}
        >
          <div ref={fxLayer} className="rs-floor-fx" aria-hidden="true" />
          {failed && (
            <p className="rs-floor-failed">
              This browser cannot draw the factory.
            </p>
          )}
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
          <MachineIcon kind={preview} />
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
        n +
        machinePrice(
          f,
          m.kind,
          -1 - machines.slice(0, i).filter((o) => o.kind === m.kind).length,
          state,
        ),
      0,
    );
    return (
      <div className="rs-inspector" aria-live="polite">
        <span
          className="rs-inspector-group"
          aria-label={`${machines.length} machines`}
        >
          <Boxes size={20} />
          <b>{machines.length}</b>
        </span>
        <div className="rs-inspector-kinds" aria-hidden="true">
          {[...new Set(machines.map((m) => m.kind))].slice(0, 6).map((kind) => (
            <MachineIcon key={kind} kind={kind} />
          ))}
        </div>
        <button
          className="rs-icon-button"
          onClick={onRotate}
          disabled={busy}
          title="Rotate (R)"
        >
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
    const b = boost(f, machine),
      status = machine.kind === 'belt' ? null : statusOf(f, machine);
    return (
      <div className="rs-inspector" aria-live="polite">
        <span className={`rs-part-art kind-${machine.kind}`}>
          <MachineIcon kind={machine.kind} />
        </span>
        <div className="rs-inspector-text">
          <b>
            {MACHINES[machine.kind].name}
            {status &&
              machine.kind !== 'splitter' &&
              machine.kind !== 'cashier' && (
                <span className={`rs-status is-${status}`}>
                  {STATUS_WORD[status]}
                </span>
              )}
          </b>
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
                  <i className="rs-book-level">{rank}</i>
                </button>
              );
            })}
          </div>
        )}
        {MACHINES[machine.kind].turns && (
          <button
            className="rs-icon-button"
            onClick={onRotate}
            disabled={busy}
            title="Rotate (R)"
          >
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
          <MachineIcon kind={tool.kind} />
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
