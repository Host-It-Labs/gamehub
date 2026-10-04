'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { Sheet, SheetCells, type SheetProps } from './sheet';
import type { RotaWorld } from './three/world';

/**
 * Rota's board: the 3D model railway when WebGL is there, the drawn survey
 * sheet otherwise (and while the models load). The canvas fills the whole
 * table behind the controls; the board is framed inside `stage`, and the
 * squares you tap stay real buttons laid over the drawn ground through a
 * perspective transform, so drag, keyboard and screen readers keep working.
 */
/** Hand the board the sheet to draw. */
function pushView(w: RotaWorld, s: SheetProps, livery: number) {
  w.setView({
    map: s.map,
    cells: s.cells,
    rubble: s.rubble,
    towns: s.towns,
    strike: s.strike ?? -1,
    loose: s.loose ?? [],
    targets: s.targets,
    turnable: s.turnable,
    ghost: s.ghost,
    livery,
    finished: s.round === undefined,
  });
}

/** Tell the board its canvas size and the stage it should fill. */
function measureFrame(
  w: RotaWorld | null,
  root: HTMLElement | null,
  box: HTMLElement | null,
) {
  if (!w || !root || !box) return;
  const r = root.getBoundingClientRect();
  const s = box.getBoundingClientRect();
  w.setFrame(r.width, r.height, {
    x: s.left - r.left,
    y: s.top - r.top,
    w: s.width,
    h: s.height,
  });
}

export function RotaBoard({
  world,
  stage,
  livery,
  onWorld,
  ...sheet
}: SheetProps & {
  /** The 3D world, once ready (for snapshots of other sheets). */
  onWorld?: (w: RotaWorld | null) => void;
  /** The table's root, which the canvas covers. */
  world: RefObject<HTMLElement | null>;
  /** The area the board should fill. */
  stage: RefObject<HTMLElement | null>;
  livery: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RotaWorld | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const onWorldRef = useRef(onWorld);
  const view = useRef({ sheet, livery });
  useLayoutEffect(() => {
    onWorldRef.current = onWorld;
    view.current = { sheet, livery };
  });
  const mapId = sheet.map.id;

  // Make the world for this map once the models are in.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let alive = true;
    let made: RotaWorld | null = null;
    void (async () => {
      try {
        const [{ RotaWorld }, { library, pickTier }] = await Promise.all([
          import('./three/world'),
          import('./three/assets'),
        ]);
        const tier = pickTier();
        const lib = await library(tier);
        if (!alive) return;
        made = new RotaWorld(el, view.current.sheet.map, lib, {
          lite: tier === 'lite',
          still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          onOverlay: (m) => alive && setOverlay(m),
        });
        engine.current = made;
        onWorldRef.current?.(made);
        pushView(made, view.current.sheet, view.current.livery);
        measureFrame(made, world.current, stage.current);
        // Dice and specials take the 3D pieces once the board is up.
        void import('./three/icons').then(({ renderIcons }) =>
          renderIcons(lib),
        );
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      made?.dispose();
      engine.current = null;
      onWorldRef.current?.(null);
      setOverlay(null);
    };
    // A new map makes a new world; everything else is pushed below.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  useEffect(() => {
    if (engine.current)
      pushView(engine.current, view.current.sheet, view.current.livery);
  });

  useLayoutEffect(() => {
    const root = world.current,
      box = stage.current;
    if (!root || !box) return;
    const measure = () => measureFrame(engine.current, root, box);
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(box);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = !!overlay && !failed;
  const n = sheet.map.size;
  return (
    <>
      <canvas
        ref={canvas}
        className="rota-canvas"
        data-ready={ready || undefined}
        aria-hidden="true"
      />
      {ready ? (
        <SheetCells
          map={sheet.map}
          cells={sheet.cells}
          rubble={sheet.rubble}
          towns={sheet.towns}
          strike={sheet.strike}
          targets={sheet.targets}
          turnable={sheet.turnable}
          onCell={sheet.onCell}
          onPointerCell={sheet.onPointerCell}
          label={sheet.label}
          className="rota-cells-3d"
          style={
            {
              transform: overlay,
              '--rota-n': n,
              width: n * 100,
              height: n * 100,
            } as CSSProperties
          }
        />
      ) : (
        <FallbackSheet world={world} stage={stage} sheet={sheet} />
      )}
    </>
  );
}

/** The drawn sheet, sitting in the stage until (or unless) the 3D is ready. */
function FallbackSheet({
  world,
  stage,
  sheet,
}: {
  world: RefObject<HTMLElement | null>;
  stage: RefObject<HTMLElement | null>;
  sheet: SheetProps;
}) {
  const [box, setBox] = useState<{ x: number; y: number; s: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const el = stage.current,
      root = world.current;
    if (!el || !root) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const parent = root.getBoundingClientRect();
      const s = Math.min(r.width, r.height);
      setBox({
        x: r.left - parent.left + (r.width - s) / 2,
        y: r.top - parent.top + (r.height - s) / 2,
        s,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(root);
    return () => ro.disconnect();
  }, [stage, world]);
  if (!box) return null;
  return (
    <div
      className="rota-fallback"
      style={{ left: box.x, top: box.y, width: box.s, height: box.s }}
    >
      <Sheet {...sheet} />
    </div>
  );
}
