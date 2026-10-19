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
import { RotaLoading } from './rota-loading';
import type { RotaWorld } from './three/world';

/**
 * Rota's board: the 3D mill town when WebGL is there (the loading screen
 * until its first frame), the drawn survey sheet otherwise. The canvas fills the whole
 * table behind the controls; the board is framed inside `stage`, and the
 * squares you tap stay real buttons laid over the drawn ground through a
 * perspective transform, so drag, keyboard and screen readers keep working.
 */
/** Hand the board the sheet to draw. */
function pushView(w: RotaWorld, s: SheetProps, livery: number, dusk: number) {
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
    dusk,
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
  dusk = 0,
  onWorld,
  ...sheet
}: SheetProps & {
  /** How far the afternoon has worn on: 0 first round, 1 match over. */
  dusk?: number;
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
  /** Download share, then building; `drawn` once the first frame is up. */
  const [progress, setProgress] = useState(0);
  const [drawn, setDrawn] = useState(false);
  // A town has been drawn here before: a new map's loader fades in over it.
  const [hadTown, setHadTown] = useState(false);
  if (drawn && !hadTown) setHadTown(true);
  const onWorldRef = useRef(onWorld);
  const view = useRef({ sheet, livery, dusk });
  useLayoutEffect(() => {
    onWorldRef.current = onWorld;
    view.current = { sheet, livery, dusk };
  });
  const map = sheet.map;
  const mapKey = `${map.id}:${map.size}:${map.rounds}`;

  // Make the world for this map once the models are in.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let alive = true;
    let made: RotaWorld | null = null;
    let unfollow = () => {};
    void (async () => {
      try {
        const assets = await import('./three/assets');
        if (!alive) return;
        // The models are most of the wait; building the town is the rest.
        const follow = (share: number) =>
          alive && setProgress((p) => Math.max(p, share * 0.88));
        follow(assets.loadedShare());
        unfollow = assets.onProgress(follow);
        const tier = assets.pickTier();
        const [{ RotaWorld }, lib] = await Promise.all([
          import('./three/world'),
          assets.library(tier),
        ]);
        unfollow();
        if (!alive) return;
        setProgress(0.92);
        // Let the loader paint its last step before the town is built.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (!alive) return;
        made = new RotaWorld(el, view.current.sheet.map, lib, {
          lite: tier === 'lite',
          still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          onOverlay: (m) => alive && setOverlay(m),
        });
        engine.current = made;
        if (process.env.NODE_ENV !== 'production')
          (window as unknown as { rotaWorld?: RotaWorld }).rotaWorld = made;
        onWorldRef.current?.(made);
        pushView(
          made,
          view.current.sheet,
          view.current.livery,
          view.current.dusk,
        );
        measureFrame(made, world.current, stage.current);
        // Dice and specials take the 3D pieces once the board is up.
        void import('./three/icons').then(({ renderIcons }) =>
          renderIcons(lib),
        );
      } catch {
        if (alive) setFailed(true);
      } finally {
        unfollow();
      }
    })();
    return () => {
      alive = false;
      unfollow();
      made?.dispose();
      engine.current = null;
      onWorldRef.current?.(null);
      setOverlay(null);
      setDrawn(false);
      setProgress(0);
    };
    // A saved layout and its current replacement can share an id. Rebuild
    // for the resolved map definition so rematches use the new geometry.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (engine.current)
      pushView(
        engine.current,
        view.current.sheet,
        view.current.livery,
        view.current.dusk,
      );
  });

  // These refs belong to the parent table. Its DOM refs are attached after
  // this child's layout effects, so subscribe after the whole commit.
  useEffect(() => {
    const root = world.current,
      box = stage.current;
    if (!root || !box) return;
    const measure = () => measureFrame(engine.current, root, box);
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(box);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    measure();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [world, stage]);

  const ready = !!overlay && !failed;
  // The board is framed: two frames later the town has been drawn.
  useEffect(() => {
    if (!ready) return;
    let b = 0;
    const a = requestAnimationFrame(() => {
      setProgress(1);
      b = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [ready]);
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
      ) : failed ? (
        <FallbackSheet world={world} stage={stage} sheet={sheet} />
      ) : null}
      {failed ? null : (
        <RotaLoading
          key={mapKey}
          progress={progress}
          done={drawn}
          fadeIn={hadTown}
        />
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
