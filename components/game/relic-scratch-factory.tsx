'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Coins, Minus, Plus, Scan } from 'lucide-react';
import { formatNumber, type RelicAction } from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  DIRS,
  MACHINES,
  ORDER,
  editCost,
  floorSize,
  kindOpen,
  machinePrice,
  machineRefund,
  outlets,
  reach,
  type Dir,
  type Machine,
  type MachineKind,
} from '@/lib/games/relic/factory';
import type { PackId, ScratchState } from '@/lib/games/relic/scratch';
import { floorProjectors } from './relic-factory/anchor';
import type { FactoryWorld } from './relic-factory/world';
import { MAX_ZOOM, MIN_ZOOM } from './relic-factory/limits';
import { FactoryGestures } from './relic-factory/gestures';
import {
  autoDir,
  cellKey,
  clipCorner,
  copyOf,
  emptyEdit,
  extendPath,
  freeCorner,
  includes,
  inside,
  inverseEdit,
  machineMap,
  movesFit,
  pathEdit,
  piecesFit,
  placeClip,
  realMoves,
  same,
  shiftMoves,
  startPath,
  turnClip,
  turnMoves,
  turnPivot,
  expectAfter,
  expectBefore,
  meets,
  walk,
  type BeltPath,
  type Cell,
  type Clip,
  type Edit,
  type Expect,
  type Overlay,
  type Piece,
} from './relic-factory/editor';
import { DIGITS, FactoryPalette } from './relic-factory/palette';
import { FactoryBar, type BarView } from './relic-factory/factory-bar';
import { MachineIcon } from './relic-factory/machine-icon';
import './relic-factory/factory.css';

export { MachineIcon };

type Tool =
  | { mode: 'select' }
  | { mode: 'erase' }
  | { mode: 'build'; kind: MachineKind }
  | { mode: 'paste' };
/** What a player's factory shows: sent to the others' TV, drawn read-only. */
export type FactoryView = {
  tool: 'select' | 'erase' | 'paste' | MachineKind;
  dir: Dir;
  selected: Cell[];
  preview: MachineKind | null;
};
/** A pointer drag on the floor, from press to release. */
type Drag =
  | { kind: 'belt'; pointer: number; path: BeltPath }
  | { kind: 'place'; pointer: number; at: Cell }
  | { kind: 'erase'; pointer: number; last: Cell; cells: Cell[] }
  | { kind: 'move'; pointer: number; from: Cell; to: Cell; cells: Cell[] }
  | { kind: 'box'; pointer: number; a: Cell; b: Cell; add: boolean }
  | { kind: 'paste'; pointer: number };
/** One step of history: what it did and what undoes it, each with what it
 * must find on the floor so it never touches another player's machines. */
type Entry = {
  forward: RelicAction[];
  inverse: RelicAction[];
  before: Expect;
  after: Expect;
};
/** Machines just moved or turned, drawn where they go until confirmed. */
type Lift = { from: Cell[]; to: Cell[]; dirs?: Dir[] };

/** Multi-select and keyboard hints are for a mouse; touch confirms pastes. */
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
  return view === 'select' || view === 'erase' || view === 'paste'
    ? { mode: view === 'paste' ? 'select' : view }
    : { mode: 'build', kind: view };
}
const step = (c: Cell, d: number): Cell => ({
  x: c.x + DIRS[d][0],
  y: c.y + DIRS[d][1],
});
/** What building these machines costs, counting up each kind's price. */
function buildCost(state: ScratchState, kinds: MachineKind[]) {
  const n: Partial<Record<MachineKind, number>> = {};
  return kinds.reduce((sum, kind) => {
    const i = n[kind] ?? 0;
    n[kind] = i + 1;
    return sum + machinePrice(state.factory, kind, i, state);
  }, 0);
}

/** How far the room's floating controls reach into the floor, by edge: those
 * in the top half cover the top, the others the bottom. */
function coveredEdges(el: HTMLElement) {
  const room = el.closest('.relic-scratch-room'),
    r = el.getBoundingClientRect(),
    edges = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!room || !r.height) return edges;
  for (const n of room.querySelectorAll<HTMLElement>(
    '[data-rs-cover], .game-navigation-back, .game-navigation-actions, .game-progress',
  )) {
    if (!n.getClientRects().length) continue;
    const b = n.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) continue;
    if ((b.top + b.bottom) / 2 < r.top + r.height / 2)
      edges.top = Math.max(edges.top, b.bottom - r.top);
    else edges.bottom = Math.max(edges.bottom, r.bottom - b.top);
  }
  return edges;
}
/** The model's soft shadow on the desk, under its frame. */
function groundShadow(
  el: HTMLElement,
  target: HTMLElement | null,
  w: FactoryWorld | null,
) {
  const floor = w?.floorSize;
  if (!target || !w || !floor?.width) return;
  const r = el.getBoundingClientRect(),
    m = 0.8;
  const corners = [
    [-m, -m],
    [floor.width + m, -m],
    [floor.width + m, floor.height + m],
    [-m, floor.height + m],
  ].map(([x, y]) => {
    const p = w.project(x, y, -0.4);
    return `${(p.x - r.left).toFixed(1)}px ${(p.y - r.top + 24).toFixed(1)}px`;
  });
  target.style.clipPath = `polygon(${corners.join(',')})`;
}
export function ScratchFactory({
  state,
  coins,
  busy,
  onAct,
  readOnly = false,
  mirror,
  onView,
  active = true,
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
  /** False while another tab covers it: no keys, no drawing. */
  active?: boolean;
}) {
  const f = state.factory,
    floor = floorSize(state);
  const [ownTool, setToolState] = useState<Tool>({ mode: 'select' }),
    // A machine held to build faces the flow unless the player turned it.
    [manualDir, setManualDir] = useState<Dir | null>(null),
    [lastDir, setLastDir] = useState<Dir>(0),
    [ownSelection, setSelection] = useState<Cell[]>([]),
    [ownPreview, setPreview] = useState<MachineKind | null>(null),
    [hover, setHover] = useState<Cell | null>(null),
    [drag, setDragState] = useState<Drag | null>(null),
    [clip, setClip] = useState<Clip | null>(null),
    [pasteAt, setPasteAt] = useState<Cell | null>(null),
    [pending, setPending] = useState<{ ghosts: Piece[]; lift: Lift | null }>({
      ghosts: [],
      lift: null,
    }),
    // How many steps undo and redo hold, for their buttons.
    [steps, setSteps] = useState({ undo: 0, redo: 0 }),
    // The last pointer was a finger or a pen: copies wait for Place.
    [touch, setTouch] = useState(false),
    [turned, setTurned] = useState(false),
    [zoom, setZoom] = useState(MIN_ZOOM),
    [panMode, setPanMode] = useState(false),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(0);
  const tool = mirror ? toolOf(mirror.tool) : ownTool,
    selection = mirror ? mirror.selected : ownSelection,
    preview = mirror ? mirror.preview : ownPreview;
  const host = useRef<HTMLDivElement>(null),
    fxLayer = useRef<HTMLDivElement>(null),
    shadow = useRef<HTMLDivElement>(null),
    world = useRef<FactoryWorld | null>(null),
    shownOverlay = useRef(''),
    latest = useRef({ state }),
    dragRef = useRef<Drag | null>(null),
    rightClick = useRef<{ x: number; y: number; pointer: number } | null>(null),
    gestures = useRef(new FactoryGestures()),
    history = useRef<{ undo: Entry[]; redo: Entry[] }>({ undo: [], redo: [] }),
    turnAbout = useRef<{ key: string; pivot: Cell } | null>(null);
  useEffect(() => {
    latest.current.state = state;
  });
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  function setTool(next: Tool) {
    // A press still held (an erase, a move) is let go, not committed.
    setDrag(null);
    setToolState(next);
    setManualDir(null);
    setPreview(null);
    setPanMode(false);
    if (next.mode !== 'select') setSelection([]);
  }
  function cancelEditing() {
    setDrag(null);
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
  /** Pan is the third tool beside select and erase: only one is on. */
  function togglePan() {
    gestures.current.consume();
    cancelEditing();
    if (panMode) return setPanMode(false);
    if (tool.mode !== 'select') setTool({ mode: 'select' });
    setPanMode(true);
  }

  const map = machineMap(f);
  // Machines that were removed or moved away drop out of the selection.
  const selected = selection
    .map((c) => map.get(cellKey(c)))
    .filter((m): m is Machine => !!m);
  const selectedCells = selected.map((m) => ({ x: m.x, y: m.y }));
  const single = selected.length === 1 ? selected[0] : undefined;
  const open = f.blueprints.includes('starter');
  const hints = !readOnly && finePointer();
  useEffect(() => {
    onView?.({
      tool: toolView(ownTool),
      dir: manualDir ?? lastDir,
      selected: ownSelection,
      preview: ownPreview,
    });
  }, [onView, ownTool, manualDir, lastDir, ownSelection, ownPreview]);

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
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el.clientHeight
            : 1;
      // The wheel zooms; a trackpad pinch arrives as a ctrl wheel, finer.
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
      w.zoomTo(w.zoom * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0022)), {
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
          onCamera: () => groundShadow(el, shadow.current, world.current),
          // Drawn: the floor and its shadow fade in rather than pop over
          // the desk (the shadow covers everything until it is fitted).
          onDrawn: () => {
            cv.dataset.drawn = '';
            if (shadow.current) shadow.current.dataset.drawn = '';
          },
        });
        world.current = w;
        if (process.env.NODE_ENV === 'development')
          (window as unknown as { luckyFactory?: unknown }).luckyFactory = w;
        const measure = () => {
          w.setInsets(coveredEdges(el));
          w.resize(el.clientWidth, el.clientHeight);
          groundShadow(el, shadow.current, w);
        };
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
  // Hidden behind another tab, the floor waits and catches up when shown.
  useEffect(() => {
    if (active) world.current?.update(f, state);
  }, [f, state, active]);
  // Floating controls come and go with tabs and selections: the overview
  // keeps the floor clear of them.
  useEffect(() => {
    const el = host.current,
      w = world.current;
    if (el && w && active) w.setInsets(coveredEdges(el));
  });
  useEffect(() => {
    world.current?.setPaused(!active);
  }, [active, ready]);

  // ——— Actions, each recorded with the edit that undoes it ———

  function syncSteps() {
    const h = history.current;
    setSteps({ undo: h.undo.length, redo: h.redo.length });
  }
  async function run(actions: RelicAction[]) {
    for (const action of actions) if (!(await onAct(action))) return false;
    return true;
  }
  async function perform(entry: Entry) {
    if (!(await run(entry.forward))) return false;
    const h = history.current;
    h.undo = [...h.undo, entry].slice(-80);
    h.redo = [];
    syncSteps();
    return true;
  }
  async function undo() {
    const h = history.current,
      entry = h.undo.pop();
    syncSteps();
    if (!entry || readOnly) return;
    cancelEditing();
    // Someone changed those cells since: the step is dropped, never forced.
    if (!meets(latest.current.state.factory, entry.after)) return;
    if (await run(entry.inverse)) h.redo.push(entry);
    syncSteps();
  }
  async function redo() {
    const h = history.current,
      entry = h.redo.pop();
    syncSteps();
    if (!entry || readOnly) return;
    cancelEditing();
    if (!meets(latest.current.state.factory, entry.before)) return;
    if (await run(entry.forward)) h.undo.push(entry);
    syncSteps();
  }
  function edit(e: Edit, show?: { ghosts?: Piece[]; lift?: Lift }) {
    if (readOnly || emptyEdit(e)) return Promise.resolve(false);
    const now = latest.current.state.factory;
    const forward: RelicAction = { type: 'factory-edit', ...e },
      inverse: RelicAction = { type: 'factory-edit', ...inverseEdit(now, e) };
    // What was just built or moved stays drawn until the server confirms it.
    if (show)
      setPending({ ghosts: show.ghosts ?? [], lift: show.lift ?? null });
    return perform({
      forward: [forward],
      inverse: [inverse],
      before: expectBefore(now, e),
      after: expectAfter(now, e),
    }).finally(() => setPending({ ghosts: [], lift: null }));
  }
  function build(pieces: Piece[]) {
    return edit({ build: pieces }, { ghosts: pieces });
  }
  function removeCells(cells: Cell[]) {
    const there = cells.filter((c) => map.has(cellKey(c)));
    return edit({ remove: there });
  }
  /** Moves and turns machines; the selection follows them. */
  function arrange(moves: ReturnType<typeof turnMoves>, keepSelection = true) {
    const real = realMoves(f, moves, map);
    if (!real.length || !movesFit(f, moves, floor, map)) return false;
    const was = selectedCells;
    if (keepSelection) setSelection(moves.map((m) => m.to));
    void edit(
      { arrange: real },
      {
        lift: {
          from: real.map((m) => ({ x: m.x, y: m.y })),
          to: real.map((m) => m.to),
          dirs: real.map((m) => m.dir),
        },
      },
    ).then((ok) => {
      // A refused move leaves the selection on the machines that stayed.
      if (!ok && keepSelection) setSelection(was);
    });
    return true;
  }
  function setBook(book: PackId) {
    const printers = selected.filter(
      (m) => m.kind === 'printer' && m.book !== book,
    );
    if (!printers.length || readOnly) return;
    const back = new Map<PackId, Cell[]>();
    for (const p of printers) {
      const old = p.book ?? 'seven';
      back.set(old, [...(back.get(old) ?? []), { x: p.x, y: p.y }]);
    }
    const there = {
      machines: printers.map((p) => ({ x: p.x, y: p.y, kind: p.kind })),
      empty: [],
    };
    void perform({
      before: there,
      after: there,
      forward: [
        {
          type: 'factory-book',
          cells: printers.map((p) => ({ x: p.x, y: p.y })),
          book,
        },
      ],
      inverse: [...back].map(([b, cells]) => ({
        type: 'factory-book',
        cells,
        book: b,
      })),
    });
  }
  function rotate() {
    if (readOnly) return;
    if (tool.mode === 'build') {
      if (!MACHINES[tool.kind].turns) return;
      const at = drag?.kind === 'place' ? drag.at : hover;
      const now = manualDir ?? (at ? ghostDir(tool.kind, at) : lastDir);
      const next = ((now + 1) % 4) as Dir;
      setManualDir(next);
      setLastDir(next);
      return;
    }
    if (tool.mode === 'paste') {
      setClip((c) => (c ? turnClip(c) : c));
      return;
    }
    if (!selected.length) return;
    // Turning the group it just turned keeps the same middle, so four turns
    // bring it back exactly.
    const key = selectedCells.map(cellKey).sort().join(' '),
      pivot =
        turnAbout.current?.key === key
          ? turnAbout.current.pivot
          : turnPivot(selected),
      moves = turnMoves(selected, floor, pivot);
    if (arrange(moves))
      turnAbout.current = {
        key: moves
          .map((m) => cellKey(m.to))
          .sort()
          .join(' '),
        pivot,
      };
  }
  function deleteSelection() {
    if (readOnly || !selected.length) return;
    void removeCells(selectedCells);
    setSelection([]);
  }
  function copySelection() {
    const c = copyOf(selected);
    if (c) setClip(c);
    return c;
  }
  /** Holds the copy over the floor: beside the original on touch, where the
   * pointer is with a mouse. */
  function startPaste(c: Clip | null = clip) {
    if (!c || readOnly) return;
    let at = hover;
    if (touch || !at) {
      const near = selected[0] ?? {
          x: Math.floor(floor.width / 2),
          y: Math.floor(floor.height / 2),
        },
        corner = freeCorner(
          f,
          c,
          { x: near.x + 1, y: near.y + 1 },
          floor,
          map,
        ) ?? { x: 0, y: 0 };
      at = {
        x: corner.x + Math.floor((c.w - 1) / 2),
        y: corner.y + Math.floor((c.h - 1) / 2),
      };
    }
    setDrag(null);
    setPanMode(false);
    setToolState({ mode: 'paste' });
    setSelection([]);
    setPreview(null);
    setPasteAt(at);
  }
  const pastePieces =
    tool.mode === 'paste' && clip && pasteAt
      ? placeClip(clip, clipCorner(clip, pasteAt))
      : [];
  const pasteFits = piecesFit(f, pastePieces, floor, map);
  const pasteCost = pastePieces.length
    ? buildCost(
        state,
        pastePieces.map((p) => p.kind),
      )
    : 0;
  const pasteOk =
    pastePieces.length > 0 && pasteFits.every(Boolean) && coins >= pasteCost;
  function placePaste() {
    if (!pasteOk) return;
    void build(pastePieces);
  }
  function pick(kind: MachineKind) {
    if (readOnly) return;
    if (!kindOpen(f, kind)) {
      // A locked machine is explained first; Unlock buys it.
      setPreview((p) => (p === kind ? null : kind));
      return;
    }
    setTool(
      tool.mode === 'build' && tool.kind === kind
        ? { mode: 'select' }
        : { mode: 'build', kind },
    );
  }
  function pipette() {
    const m = hover && map.get(cellKey(hover));
    if (!m || !kindOpen(f, m.kind)) return;
    setTool({ mode: 'build', kind: m.kind });
    if (MACHINES[m.kind].turns) {
      setManualDir(m.dir);
      setLastDir(m.dir);
    }
  }
  function ghostDir(kind: MachineKind, at: Cell): Dir {
    return manualDir ?? autoDir(f, kind, at, lastDir, map);
  }
  /** Arrow keys and screen directions: a turned floor is a quarter round. */
  function worldDir(screen: Dir): Dir {
    return (turned ? (screen + 3) % 4 : screen) as Dir;
  }
  function nudge(screen: Dir) {
    const [dx, dy] = DIRS[worldDir(screen)];
    arrange(shiftMoves(selected, dx, dy));
  }

  // ——— Keys ———
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
      const key = event.key.toLowerCase(),
        command = event.metaKey || event.ctrlKey;
      // A held Space would toggle pan on every repeat.
      if (event.repeat && key === ' ') return event.preventDefault();
      if (command) {
        if (key === 'z' && !event.shiftKey) void undo();
        else if ((key === 'z' && event.shiftKey) || key === 'y') void redo();
        else if (key === 'a') {
          setTool({ mode: 'select' });
          setSelection(f.machines.map((m) => ({ x: m.x, y: m.y })));
        } else if (key === 'c') copySelection();
        else if (key === 'x') {
          if (copySelection()) deleteSelection();
        } else if (key === 'v') startPaste();
        else if (key === 'd') startPaste(copySelection());
        else return;
        event.preventDefault();
        return;
      }
      if (event.altKey) return;
      const arrows: Record<string, Dir> = {
        arrowright: 0,
        arrowdown: 1,
        arrowleft: 2,
        arrowup: 3,
      };
      if (key in arrows) {
        if (selected.length && tool.mode === 'select') nudge(arrows[key]);
        else {
          const el = host.current,
            w = world.current;
          if (!el || !w) return;
          const r = el.getBoundingClientRect(),
            mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 },
            [dx, dy] = DIRS[arrows[key]];
          w.pan(mid, { x: mid.x - dx * 60, y: mid.y - dy * 60 });
        }
      } else if (key === '+' || key === '=')
        changeZoom((world.current?.zoom ?? 1) * 1.25);
      else if (key === '-' || key === '_')
        changeZoom((world.current?.zoom ?? 1) / 1.25);
      else if (key === 'f') fitView();
      else if (key === ' ' || key === 'p') togglePan();
      else if (key === 'r') rotate();
      else if (key === 'q') pipette();
      else if (key === 'v' || key === 's') setTool({ mode: 'select' });
      else if (key === 'e' || key === 'x')
        setTool(tool.mode === 'erase' ? { mode: 'select' } : { mode: 'erase' });
      else if (key === 'delete' || key === 'backspace') deleteSelection();
      else if (key === 'escape') {
        if (dragRef.current) cancelEditing();
        else if (tool.mode !== 'select') setTool({ mode: 'select' });
        else setSelection([]);
        setPreview(null);
      } else if (DIGITS.includes(key) && ORDER[DIGITS.indexOf(key)])
        pick(ORDER[DIGITS.indexOf(key)]);
      else return;
      event.preventDefault();
    };
  });
  useEffect(() => {
    if (readOnly || !active) return;
    const listener = (event: KeyboardEvent) => keys.current(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [readOnly, active]);

  // ——— What the floor draws over the machines ———

  const handle =
    tool.mode === 'select' && single && !drag
      ? (() => {
          const out = outlets(single.kind, single.dir)[0];
          if (out === undefined || single.kind === 'splitter') return null;
          // Only on empty floor: a press there pulls out a new belt.
          const c = step(single, out);
          return inside(c, floor) && !map.has(cellKey(c))
            ? { ...c, dir: out }
            : null;
        })()
      : null;
  let ghosts: Overlay['ghosts'] = [],
    buildCount = 0,
    buildPrice = 0;
  if (tool.mode === 'build' || drag?.kind === 'belt') {
    if (drag?.kind === 'belt') {
      const e = pathEdit(f, drag.path, floor, map);
      buildCount = e.build.length;
      buildPrice = buildCost(
        state,
        e.build.map((p) => p.kind),
      );
      const broke = coins < buildPrice;
      ghosts = [
        ...e.build.map((p) => ({ ...p, bad: broke })),
        ...e.arrange.map((m) => ({
          kind: 'belt' as const,
          x: m.x,
          y: m.y,
          dir: m.dir,
          lift: true,
        })),
      ];
    } else if (tool.mode === 'build') {
      const at = drag?.kind === 'place' ? drag.at : hover;
      buildCount = 1;
      buildPrice = machinePrice(f, tool.kind, 0, state);
      if (at && !readOnly)
        ghosts = [
          {
            kind: tool.kind,
            ...at,
            dir: ghostDir(tool.kind, at),
            bad: map.has(cellKey(at)) || coins < buildPrice,
          },
        ];
    }
  }
  if (tool.mode === 'paste')
    ghosts = pastePieces.map((p, i) => ({
      ...p,
      bad: !pasteFits[i] || coins < pasteCost,
    }));
  ghosts = [...ghosts, ...pending.ghosts.map((p) => ({ ...p, solid: true }))];
  const moving =
    drag?.kind === 'move' && !same(drag.from, drag.to) ? drag : null;
  const lifted = moving
    ? (() => {
        const dx = moving.to.x - moving.from.x,
          dy = moving.to.y - moving.from.y,
          group = moving.cells
            .map((c) => map.get(cellKey(c)))
            .filter((m): m is Machine => !!m),
          moves = shiftMoves(group, dx, dy);
        return {
          from: moves.map((m) => ({ x: m.x, y: m.y })),
          to: moves.map((m) => m.to),
          ok: movesFit(f, moves, floor, map),
        };
      })()
    : pending.lift
      ? { ...pending.lift, ok: true }
      : null;
  const erasing = drag?.kind === 'erase' ? drag.cells : [];
  const booster =
    tool.mode === 'build' && (tool.kind === 'lamp' || tool.kind === 'charm')
      ? ghosts[0]
      : single && (single.kind === 'lamp' || single.kind === 'charm')
        ? single
        : null;
  // While a box is drawn, the machines it would pick are already marked.
  const boxed =
    drag?.kind === 'box'
      ? f.machines
          .filter(
            (m) =>
              m.x >= Math.min(drag.a.x, drag.b.x) &&
              m.x <= Math.max(drag.a.x, drag.b.x) &&
              m.y >= Math.min(drag.a.y, drag.b.y) &&
              m.y <= Math.max(drag.a.y, drag.b.y),
          )
          .map((m) => ({ x: m.x, y: m.y }))
      : null;
  const overlay: Overlay = {
    mode: tool.mode,
    hover: readOnly ? null : hover,
    selected: boxed
      ? drag?.kind === 'box' && drag.add
        ? [
            ...selectedCells,
            ...boxed.filter((c) => !includes(selectedCells, c)),
          ]
        : boxed
      : selectedCells,
    erasing,
    ghosts,
    lifted,
    marquee:
      drag?.kind === 'box'
        ? {
            x0: Math.min(drag.a.x, drag.b.x),
            y0: Math.min(drag.a.y, drag.b.y),
            x1: Math.max(drag.a.x, drag.b.x),
            y1: Math.max(drag.a.y, drag.b.y),
          }
        : null,
    reach: booster
      ? reach(booster.x, booster.y).filter((c) => inside(c, floor))
      : [],
    handle,
  };
  const overlayKey = JSON.stringify([overlay, f.machines.length]);
  useEffect(() => {
    // Drawn again only when what it shows has changed.
    const w = world.current,
      key = `${ready}|${overlayKey}`;
    if (!w || shownOverlay.current === key) return;
    shownOverlay.current = key;
    w.setOverlay(overlay);
  });

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

  // ——— Pointer ———

  function cellAt(event: { clientX: number; clientY: number }): Cell | null {
    return world.current?.pick(event.clientX, event.clientY).cell ?? null;
  }
  function onDown(event: React.PointerEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (touch !== (event.pointerType !== 'mouse'))
      setTouch(event.pointerType !== 'mouse');
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer no longer tracked. */
    }
    const point = { x: event.clientX, y: event.clientY };
    // The right and middle buttons move the camera; a right click lets go.
    if (event.button === 2)
      rightClick.current = { ...point, pointer: event.pointerId };
    if (
      gestures.current.begin(
        event.pointerId,
        point,
        panMode || event.button !== 0,
      )
    ) {
      event.preventDefault();
      setDrag(null);
      return;
    }
    const c = cellAt(event);
    if (!c) {
      if (tool.mode === 'select' && !event.shiftKey) setSelection([]);
      return;
    }
    const m = map.get(cellKey(c)),
      mouse = event.pointerType === 'mouse',
      add = event.shiftKey || event.metaKey || event.ctrlKey;
    const id = event.pointerId;
    if (tool.mode === 'erase') {
      setDrag({ kind: 'erase', pointer: id, last: c, cells: m ? [c] : [] });
      return;
    }
    if (tool.mode === 'paste') {
      setPasteAt(c);
      setDrag({ kind: 'paste', pointer: id });
      return;
    }
    if (tool.mode === 'build') {
      if (tool.kind !== 'belt') {
        setDrag({ kind: 'place', pointer: id, at: c });
        return;
      }
      // Belts: drawn from empty floor, continued from a belt, or pulled out
      // of a machine's outlet.
      if (!m)
        setDrag({
          kind: 'belt',
          pointer: id,
          path: startPath(c, ghostDir('belt', c)),
        });
      else if (m.kind === 'belt')
        setDrag({ kind: 'belt', pointer: id, path: startPath(c, m.dir) });
      else {
        const out = outlets(m.kind, m.dir)[0];
        const o = out === undefined ? null : step(m, out);
        if (
          o &&
          inside(o, floor) &&
          (!map.has(cellKey(o)) || map.get(cellKey(o))!.kind === 'belt')
        )
          setDrag({ kind: 'belt', pointer: id, path: startPath(o, out!) });
      }
      return;
    }
    // Select.
    if (m) {
      if (mouse && add) {
        setSelection((list) =>
          includes(list, c) ? list.filter((s) => !same(s, c)) : [...list, c],
        );
        return;
      }
      const group =
        includes(selectedCells, c) && selected.length > 1 ? selectedCells : [c];
      setDrag({ kind: 'move', pointer: id, from: c, to: c, cells: group });
      return;
    }
    if (handle && same(c, handle)) {
      setDrag({ kind: 'belt', pointer: id, path: startPath(c, handle.dir) });
      return;
    }
    if (!add) setSelection([]);
    setDrag({ kind: 'box', pointer: id, a: c, b: c, add });
  }
  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    if (readOnly) return;
    const point = { x: event.clientX, y: event.clientY };
    const r = rightClick.current;
    if (
      r?.pointer === event.pointerId &&
      Math.hypot(point.x - r.x, point.y - r.y) > 5
    )
      rightClick.current = null;
    const gesture = gestures.current.move(event.pointerId, point);
    if (gesture) {
      const w = world.current;
      w?.zoomTo(w.zoom * gesture.factor, gesture.from);
      w?.pan(gesture.from, gesture.to);
      return;
    }
    const c = cellAt(event);
    if (!same(c, hover) && (event.pointerType === 'mouse' || dragRef.current))
      setHover(c);
    if (
      tool.mode === 'paste' &&
      event.pointerType === 'mouse' &&
      c &&
      !same(c, pasteAt)
    )
      setPasteAt(c);
    const d = dragRef.current;
    if (!d || d.pointer !== event.pointerId || !c) return;
    if (d.kind === 'belt') {
      const clamped = {
        x: Math.max(0, Math.min(floor.width - 1, c.x)),
        y: Math.max(0, Math.min(floor.height - 1, c.y)),
      };
      const path = extendPath(d.path, clamped);
      if (path !== d.path) setDrag({ ...d, path });
    } else if (d.kind === 'place') {
      if (!same(c, d.at)) setDrag({ ...d, at: c });
    } else if (d.kind === 'erase') {
      if (same(c, d.last)) return;
      const cells = [...d.cells];
      for (const s of walk(d.last, c))
        if (map.has(cellKey(s)) && !includes(cells, s))
          cells.push({ x: s.x, y: s.y });
      setDrag({ ...d, last: c, cells });
    } else if (d.kind === 'move') {
      if (!same(c, d.to)) setDrag({ ...d, to: c });
    } else if (d.kind === 'box') {
      if (!same(c, d.b)) setDrag({ ...d, b: c });
    } else if (d.kind === 'paste') {
      if (!same(c, pasteAt)) setPasteAt(c);
    }
  }
  function onUp(event: React.PointerEvent<HTMLDivElement>) {
    const r = rightClick.current;
    rightClick.current = null;
    if (gestures.current.end(event.pointerId)) {
      // A right click without a drag puts the held machine or copy back.
      if (r?.pointer === event.pointerId) {
        if (tool.mode !== 'select') setTool({ mode: 'select' });
        else setSelection([]);
      }
      return;
    }
    const d = dragRef.current;
    if (!d || d.pointer !== event.pointerId) return;
    setDrag(null);
    // A finger leaves no hover behind; the mouse keeps its ghost.
    if (event.pointerType !== 'mouse') setHover(null);
    if (d.kind === 'belt') {
      const e = pathEdit(f, d.path, floor, map);
      if (
        coins <
        buildCost(
          state,
          e.build.map((p) => p.kind),
        )
      )
        return;
      setLastDir(d.path.cells.at(-1)!.dir);
      void edit(e, { ghosts: e.build });
      if (tool.mode === 'select') setSelection([]);
    } else if (d.kind === 'place' && tool.mode === 'build') {
      if (map.has(cellKey(d.at)) || !inside(d.at, floor)) return;
      const dir = ghostDir(tool.kind, d.at);
      void build([{ kind: tool.kind, x: d.at.x, y: d.at.y, dir }]);
    } else if (d.kind === 'erase') {
      if (d.cells.length) void removeCells(d.cells);
    } else if (d.kind === 'move') {
      const dx = d.to.x - d.from.x,
        dy = d.to.y - d.from.y;
      if (!dx && !dy) {
        // A tap selects the machine.
        setSelection([d.from]);
        return;
      }
      const group = d.cells
        .map((c) => map.get(cellKey(c)))
        .filter((m): m is Machine => !!m);
      arrange(shiftMoves(group, dx, dy));
    } else if (d.kind === 'box') {
      const x0 = Math.min(d.a.x, d.b.x),
        x1 = Math.max(d.a.x, d.b.x),
        y0 = Math.min(d.a.y, d.b.y),
        y1 = Math.max(d.a.y, d.b.y);
      const boxed = f.machines
        .filter((m) => m.x >= x0 && m.x <= x1 && m.y >= y0 && m.y <= y1)
        .map((m) => ({ x: m.x, y: m.y }));
      setSelection((list) =>
        d.add ? [...list, ...boxed.filter((c) => !includes(list, c))] : boxed,
      );
    } else if (d.kind === 'paste' && event.pointerType === 'mouse')
      placePaste();
  }

  // ——— The bar under the floor ———

  let bar: BarView;
  if (preview && !kindOpen(f, preview))
    bar = { kind: 'locked', machine: preview };
  else if (tool.mode === 'build')
    bar = {
      kind: 'build',
      machine: tool.kind,
      count: buildCount,
      cost: buildPrice,
    };
  else if (drag?.kind === 'belt')
    bar = {
      kind: 'build',
      machine: 'belt',
      count: buildCount,
      cost: buildPrice,
    };
  else if (tool.mode === 'paste')
    bar = {
      kind: 'paste',
      kinds: pastePieces.map((p) => p.kind),
      cost: pasteCost,
      ok: pasteOk,
      confirm: touch || !hints,
    };
  else if (tool.mode === 'erase') {
    let refund = 0;
    try {
      refund = erasing.length
        ? editCost(f, state, { remove: erasing }).refund
        : 0;
    } catch {
      /* Cells another player just cleared. */
    }
    bar = { kind: 'erase', count: erasing.length, refund };
  } else if (single)
    bar = {
      kind: 'one',
      m: single,
      refund: machineRefund(f, single.kind, state),
    };
  else if (selected.length > 1) {
    let refund = 0;
    try {
      refund = editCost(f, state, { remove: selectedCells }).refund;
    } catch {
      /* Shown again on the next snapshot. */
    }
    bar = { kind: 'many', machines: selected, refund };
  } else if (hover && hints && map.has(cellKey(hover)))
    bar = { kind: 'peek', m: map.get(cellKey(hover))! };
  else bar = { kind: 'idle', canPaste: !!clip && !readOnly };

  const cameraTools = !readOnly && !failed && (
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
    </fieldset>
  );
  return (
    <div className={`rs-factory rf-factory ${readOnly ? 'is-mirror' : ''}`}>
      <div className="rf-ground" aria-hidden="true">
        <div ref={shadow} className="rf-ground-shadow" />
      </div>
      <div
        ref={host}
        className={`rs-floor3d mode-${tool.mode} ${moving ? 'is-moving' : ''} ${panMode ? 'is-panning' : ''} ${handle && same(hover, handle) ? 'on-handle' : ''} ${tool.mode === 'select' && hover && map.has(cellKey(hover)) ? 'on-machine' : ''}`}
        data-rs-area="floor"
        data-turned={turned ? '' : undefined}
        data-rows={floor.height}
        data-zoom={zoom.toFixed(3)}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={() => {
          if (!dragRef.current) setHover(null);
        }}
        onPointerUp={onUp}
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
      <div className="rf-dock-area" data-rs-cover="">
        <div className="rf-context">
          <FactoryBar
            view={bar}
            state={state}
            coins={coins}
            busy={busy || readOnly}
            actions={{
              onUnlock: (kind) => {
                const blueprint = BLUEPRINTS.find((b) =>
                  b.kinds.includes(kind),
                )!;
                void onAct({
                  type: 'factory-blueprint',
                  id: blueprint.id,
                }).then((result) => {
                  if (result) setTool({ mode: 'build', kind });
                });
              },
              onRotate: rotate,
              onCopy: () => startPaste(copySelection()),
              onDelete: deleteSelection,
              onBook: setBook,
              onPlace: placePaste,
              onCancel: () => setTool({ mode: 'select' }),
              onPaste: () => startPaste(),
            }}
          />
          {cameraTools}
        </div>
        <FactoryPalette
          f={f}
          state={state}
          coins={coins}
          mode={tool.mode}
          panning={panMode}
          canPan={!!ready && !failed}
          held={tool.mode === 'build' ? tool.kind : null}
          preview={preview}
          hints={hints}
          canUndo={!readOnly && steps.undo > 0}
          canRedo={!readOnly && steps.redo > 0}
          onSelect={() => setTool({ mode: 'select' })}
          onErase={() =>
            setTool(
              tool.mode === 'erase' ? { mode: 'select' } : { mode: 'erase' },
            )
          }
          onPan={togglePan}
          onUndo={() => void undo()}
          onRedo={() => void redo()}
          onPick={pick}
        />
      </div>
    </div>
  );
}
