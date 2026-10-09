'use client';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Check,
  Crown,
  Flag,
  Orbit,
  LayoutGrid,
  LoaderCircle,
  Package,
  ReceiptText,
  RotateCcw,
  Rocket,
  Sparkles,
  Star,
  Undo2,
} from 'lucide-react';
import {
  captainById,
  goods,
  islands as islandList,
  orderById,
  planById,
  windBonus,
  type Family,
  type Good,
  type Goods,
} from '@/lib/games/alto/content';
import {
  aloneBonus,
  breakdown,
  buildable,
  canUndo,
  currentPlans,
  decisionKey,
  discount,
  fillable,
  hold,
  raceValue,
  shareBonus,
  totalGoods,
  turnsPerSeason,
  winners,
  yieldBonus,
  type AltoGame,
  type AltoMove,
  type Report,
} from '@/lib/games/alto/engine';
import {
  captainArt,
  goodArt,
  planetArt,
  seasonNames,
  skyArt,
} from '@/lib/games/alto/art';
import { familyNames, planRule } from '@/lib/games/alto/text';
import { altoLessons } from '@/lib/games/alto/lessons';
import { gameSound } from '@/lib/games/game-sound';
import { viewerWon } from '@/lib/games/results-feedback';
import { GameNavigation } from '../game-navigation';
import { Piece } from '../interactions';
import { useBadgeFit } from '../use-fit';
import { useGameMotion } from '../game-motion';
import { useGameSound } from '../use-game-sound';
import { useResultsFeedback, WinnerCelebration } from '../results-feedback';
import { CountUp, stagger } from '../reveal-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../ui/dialog';
import { AltoPlanRules, AltoRules, PlanList } from './alto-rules';
import {
  CostRow,
  EffectLine,
  FamilyIcon,
  GoodIcon,
  GoodsRow,
  PlanFace,
  PlanMark,
  ShipIcon,
  YearTrack,
  seatStyle,
} from './alto-parts';
import { AltoSpace, type ShipTargets, type Year } from './alto-scene';
import './alto.css';

export type AltoPractice = {
  step: number;
  onStep: (step: number) => void;
  onBegin: () => void;
  /** Online, only the host turns the coach's pages. */
  canTeach: boolean;
};

type Props = {
  /** The match as this viewer may see it. */
  g: AltoGame;
  viewer: number;
  disabled?: boolean;
  volume: number;
  /** Sound switches, inline in the menu. */
  sound?: ReactNode;
  onMove: (m: AltoMove) => void;
  onLeave: () => void;
  leaveLabel?: string;
  onNew?: () => void;
  /** The results' buttons: Play again and Library, or the table's own. */
  finale?: ReactNode;
  practice?: AltoPractice | null;
  /** Online: a choice sent and not yet confirmed. */
  sending?: boolean;
  /** Online: a connection problem, shown small at the top. */
  notice?: string;
  /** Online: who is a bot, and who has stepped away. */
  presence?: { bot: boolean; away: boolean }[];
};

type Pick = { kind: 'plan' | 'order'; id: string };
type Inspecting =
  | { kind: 'plan'; id: string }
  | { kind: 'order'; id: string }
  | { kind: 'island'; index: number }
  | { kind: 'player'; seat: number };

// Long enough for every ship to fly in, hover a moment and see the haul.
const REVEAL_MS = 3400;

/** The stage takes exactly the room between the top bar (with its badges and
 *  round pill) and the dock, whatever either holds on this screen. Measured
 *  on the next frame, never inside the observer's own delivery. */
function useStageRoom(root: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const world = root.current;
    if (!world) return;
    let frame = 0;
    const measure = () => {
      const top = world.getBoundingClientRect().top;
      const upper = world.querySelectorAll<HTMLElement>(
        '.game-navigation, .game-navigation .game-progress, .alto-players',
      );
      let bottom = 0;
      for (const el of upper) {
        const r = el.getBoundingClientRect();
        if (r.height) bottom = Math.max(bottom, r.bottom - top);
      }
      const dock = world.querySelector<HTMLElement>('.alto-dock');
      const set = (name: string, value: string) => {
        if (world.style.getPropertyValue(name) !== value)
          world.style.setProperty(name, value);
      };
      if (bottom) set('--stage-top', `${Math.round(bottom + 6)}px`);
      if (dock) set('--dock-h', `${Math.round(dock.offsetHeight)}px`);
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    for (const el of world.querySelectorAll(
      '.game-navigation, .alto-players, .alto-dock',
    ))
      observer.observe(el);
    observer.observe(world);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [root]);
}

/** Owned upgrades share the cargo row: with names while they fit, then
 * pictures only, then just the counts. Measured on the next frame. */
function useOwnedFit(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const row = ref.current;
    const owned = row?.querySelector<HTMLElement>('.alto-owned');
    if (!row || !owned) return;
    const check = () => {
      const over = () => owned.scrollWidth > owned.clientWidth + 1;
      row.removeAttribute('data-fit');
      if (!over()) return;
      row.dataset.fit = 'marks';
      if (over()) row.dataset.fit = 'count';
    };
    check();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    observer.observe(row);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
}

type Spot = { x: number; y: number; s: number };
/**
 * Lays the planets out as large as the stage allows. On wide stages they
 * zig-zag between an upper and a lower lane, so neighbours tuck past each
 * other and every planet gets a bigger slot than one straight row allows.
 * Otherwise it takes rows of nearly equal length whose shorter rows sit in
 * the gaps of the longer ones, or a zig-zag down the stage, whichever is
 * biggest. Slots never overlap, and each planet fits everything it carries
 * inside its slot, so planets never touch.
 */
export function arrangePlanets(n: number, width: number, H: number): Spot[] {
  const W = width * 0.98;
  if (!n || W <= 0 || H <= 0) return [];
  const rows = rowLayout(n, width, W, H);
  if (n < 3) return rows;
  const across = zigzag(n, width, W, H, true);
  const down = zigzag(n, width, W, H, false);
  // A wide stage prefers the two lanes unless rows are clearly bigger.
  if (width > H && across[0].s >= rows[0].s * 0.97) return across;
  return [rows, across, down].reduce((a, b) => (b[0].s > a[0].s ? b : a));
}

function rowLayout(n: number, width: number, W: number, H: number): Spot[] {
  let best: { s: number; rows: number[] } | null = null;
  for (let r = 1; r <= n; r++) {
    // Rows as even as they go, the longer ones first and last.
    const rows = Array.from(
      { length: r },
      (_, k) => Math.floor(n / r) + (k < n % r ? 1 : 0),
    );
    if (r > 2 && n % r) rows.splice(1, 0, ...rows.splice(rows.length - 1, 1));
    const s = Math.min(W / Math.max(...rows), H / r);
    if (!best || s > best.s * 1.02) best = { s, rows };
  }
  const { s, rows } = best!;
  const top = (H - s * rows.length) / 2;
  const spots: Spot[] = [];
  const sway =
    rows.length === 1 ? Math.min(s * 0.09, Math.max(0, (H - s) / 2)) : 0;
  rows.forEach((count, row) => {
    const left = (width - count * s) / 2;
    for (let k = 0; k < count; k++)
      spots.push({
        x: left + k * s,
        y: top + row * s + (sway ? (spots.length % 2 ? sway : -sway) : 0),
        s,
      });
  });
  return spots;
}

/** Planets alternating between two lanes, along the stage's width or height. */
function zigzag(
  n: number,
  width: number,
  W: number,
  H: number,
  wide: boolean,
): Spot[] {
  const along = wide ? W : H;
  const side = wide ? H : W;
  const fits = (s: number) => {
    if (s > side || s > along) return false;
    const step = (along - s) / (n - 1);
    // Every other planet shares a lane, so those must clear each other too.
    if (step * 2 < s) return false;
    const off = side - s;
    return step * step + off * off >= s * s;
  };
  let lo = 0;
  let hi = Math.min(side, along);
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const s = lo;
  const step = (along - s) / (n - 1);
  // The lanes sit as far apart as the stage allows, within reason.
  const need = Math.sqrt(Math.max(0, s * s - step * step));
  const off = Math.min(side - s, Math.max(need, s * 0.6));
  const start = ((wide ? width : H) - ((n - 1) * step + s)) / 2;
  const lane = ((wide ? H : width) - s - off) / 2;
  return Array.from({ length: n }, (_, k) => {
    const a = start + k * step;
    const b = lane + (k % 2 ? off : 0);
    return wide ? { x: a, y: b, s } : { x: b, y: a, s };
  });
}

/** Another player's tile: their base (with their ship on its pad) above a
 * tag with their cargo. Wider than tall, like the station it frames. */
export type BaseSpot = Spot & { w: number; h: number };
/** The tag under each base. */
const TAG_H = 26;

/**
 * The stage holds the planets and every other player's base. On wide stages
 * the bases stand in a column at each side; on tall ones they take a row
 * along the top (two rows when a narrow stage has more than three). The
 * planets get the rest.
 */
export function arrangeStage(
  planets: number,
  bases: number,
  width: number,
  height: number,
): { planets: Spot[]; bases: BaseSpot[] } {
  if (!bases)
    return { planets: arrangePlanets(planets, width, height), bases: [] };
  const gap = 8;
  const tile = (x: number, y: number, w: number, h: number): BaseSpot => ({
    x,
    y,
    w,
    h,
    s: Math.min(w, h),
  });
  if (width > height * 1.25) {
    const perSide = Math.ceil(bases / 2);
    const h = Math.min(190, (height - gap * (perSide - 1)) / perSide);
    const w = Math.min(250, width * 0.17, (h - TAG_H) * 1.7);
    const inner = width - 2 * (w + gap);
    const spots = arrangePlanets(planets, inner, height).map((p) => ({
      ...p,
      x: p.x + w + gap,
    }));
    const column = (count: number, x: number) => {
      const top = (height - (count * h + (count - 1) * gap)) / 2;
      return Array.from({ length: count }, (_, k) =>
        tile(x, top + k * (h + gap), w, h),
      );
    };
    // Seats alternate left and right so the table reads round the screen.
    const left = column(perSide, 0);
    const right = column(bases - perSide, width - w);
    const out: BaseSpot[] = [];
    for (let k = 0; k < bases; k++)
      out.push(k % 2 ? right[(k - 1) / 2] : left[k / 2]);
    return { planets: spots, bases: out };
  }
  const rows = bases > 3 && width < 560 ? 2 : 1;
  const perRow = Math.ceil(bases / rows);
  const w = Math.min(230, (width - gap * (perRow - 1)) / perRow);
  const layout = (h: number) => {
    const top = rows * h + (rows - 1) * (gap / 2) + gap;
    return { h, top, planets: arrangePlanets(planets, width, height - top) };
  };
  // The bases take the height the planets cannot use (planets on a narrow
  // stage are sized by its width), up to a generous tile.
  const least = layout(Math.min(w * 0.55 + TAG_H, (height * 0.24) / rows));
  // A second row of bases may take a little from the planets.
  const give = rows > 1 ? 0.9 : 0.97;
  let best = least;
  for (let h = least.h; h <= w * 0.8 + TAG_H; h += 4) {
    const next = layout(h);
    if (!next.planets.length || next.planets[0].s < least.planets[0].s * give)
      break;
    best = next;
  }
  const out: BaseSpot[] = [];
  for (let row = 0; row < rows; row++) {
    const count = row < rows - 1 ? perRow : bases - perRow * (rows - 1);
    const left = (width - (count * w + (count - 1) * gap)) / 2;
    for (let k = 0; k < count; k++)
      out.push(tile(left + k * (w + gap), row * (best.h + gap / 2), w, best.h));
  }
  return {
    planets: best.planets.map((p) => ({ ...p, y: p.y + best.top })),
    bases: out,
  };
}

function useStageLayout(
  stage: React.RefObject<HTMLElement | null>,
  planets: number,
  bases: number,
) {
  const [spots, setSpots] = useState<{
    planets: Spot[];
    bases: BaseSpot[];
  }>({
    planets: [],
    bases: [],
  });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    let frame = 0;
    const near = (a?: number, b?: number) =>
      Math.abs((a ?? 0) - (b ?? 0)) < 0.5;
    const same = (a: (Spot & Partial<BaseSpot>)[], b: typeof a) =>
      a.length === b.length &&
      a.every(
        (o, i) =>
          near(o.x, b[i].x) &&
          near(o.y, b[i].y) &&
          near(o.s, b[i].s) &&
          near(o.w, b[i].w) &&
          near(o.h, b[i].h),
      );
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = arrangeStage(planets, bases, r.width, r.height);
      setSpots((old) =>
        same(old.planets, next.planets) && same(old.bases, next.bases)
          ? old
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [stage, planets, bases]);
  return spots;
}

const spotStyle = (spot?: Spot | BaseSpot) =>
  (spot
    ? {
        '--x': `${spot.x}px`,
        '--y': `${spot.y}px`,
        '--s': `${spot.s}px`,
        ...('w' in spot ? { '--w': `${spot.w}px`, '--h': `${spot.h}px` } : {}),
      }
    : { visibility: 'hidden' }) as CSSProperties;

/** The last turn's flights, for as long as they are being shown. */
function useReveal(last: Report | null) {
  const key = last ? `${last.season}:${last.turn}` : '';
  const first = useRef(key);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!key || key === first.current) return;
    first.current = '';
    setShown(key);
    const timer = setTimeout(() => setShown(null), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [key]);
  return shown === key ? last : null;
}

/** The loading screen: everything (pictures, planets, bases, ships, the
 *  shop's objects and their shaders) is ready before the table shows. */
function useLoading(root: React.RefObject<HTMLElement | null>) {
  const [art, setArt] = useState(false);
  const [three, setThree] = useState<'loading' | 'ready' | 'none'>('loading');
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const world = root.current;
    if (!world) return;
    let live = true;
    const pictures = [
      ...world.querySelectorAll<HTMLImageElement>('.alto-space img'),
      ...([0, 1, 2, 3] as Good[]).map((k) => {
        const img = new Image();
        img.src = goodArt(k);
        return img;
      }),
    ];
    void Promise.all(
      pictures.map((img) => img.decode().catch(() => undefined)),
    ).then(() => live && setArt(true));
    return () => {
      live = false;
    };
  }, [root]);
  const ready = art && three !== 'loading';
  return {
    ready,
    progress: Math.min(1, progress * 0.92 + (art ? 0.08 : 0)),
    onProgress: setProgress,
    onReady: (ok: boolean) => setThree(ok ? 'ready' : 'none'),
  };
}

function Loader({ progress }: { progress: number }) {
  return (
    <div className="alto-loading" aria-busy="true">
      <img
        className="alto-loading-cover"
        src="/art/optimized/box-alto-wide-v2.webp"
        alt=""
        draggable={false}
      />
      <div className="alto-loading-orbit" aria-hidden="true">
        <span className="alto-loading-planet" />
        <span className="alto-loading-ship">
          <Rocket size={18} />
        </span>
      </div>
      <progress
        className="sr-only"
        max={100}
        value={Math.round(progress * 100)}
        aria-label="Loading"
      />
      <div
        className="alto-loading-bar"
        aria-hidden="true"
        style={{ '--p': progress } as CSSProperties}
      >
        <i />
      </div>
    </div>
  );
}

export function AltoTable({
  g,
  viewer,
  disabled = false,
  volume,
  sound,
  onMove,
  onLeave,
  leaveLabel,
  onNew,
  finale,
  practice,
  sending = false,
  notice,
  presence,
}: Props) {
  const me = g.players[viewer];
  const decision = decisionKey(g);
  const [pickState, setPick] = useState<{ at: string; pick: Pick | null }>({
    at: decision,
    pick: null,
  });
  // A prepared upgrade belongs to the turn it was chosen in.
  const pick = pickState.at === decision ? pickState.pick : null;
  const [panel, setPanel] = useState<'rules' | 'others' | 'plans' | null>(null);
  const [inspecting, setInspecting] = useState<Inspecting | null>(null);
  const root = useRef<HTMLElement>(null);
  const badges = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dockRow = useRef<HTMLDivElement>(null);
  const others = g.seats.map((_, s) => s).filter((s) => s !== viewer);
  useBadgeFit(badges);
  useOwnedFit(dockRow);
  useStageRoom(root);
  const spots = useStageLayout(stage, g.islands.length, others.length);
  const loading = useLoading(root);
  useGameMotion(root, `alto:${decision}:${g.over}`);
  useGameSound('alto', volume);
  const reveal = useReveal(g.last);
  const seasonKey = `${g.season}:${g.over}`;
  const [banner, setBanner] = useState<number | null>(null);
  const seasonRef = useRef(seasonKey);
  useEffect(() => {
    if (seasonRef.current === seasonKey || g.over) return;
    seasonRef.current = seasonKey;
    setBanner(g.season);
    const timer = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(timer);
  }, [seasonKey, g.season, g.over]);

  const locked = g.ready[viewer];
  const mine = g.pending[viewer];
  const acting =
    !g.over &&
    g.phase === 'plan' &&
    !locked &&
    !disabled &&
    !sending &&
    loading.ready;
  const undoable = canUndo(g, viewer) && !disabled && !sending;
  const scores = useMemo(
    () => g.players.map((_, s) => breakdown(g, s).total),
    [g],
  );
  const plans = currentPlans(g);
  const shelves = (['ship', 'base'] as Family[])
    .map((family) => ({
      family,
      ids: plans.filter((id) => planById[id].family === family),
    }))
    .filter((s) => s.ids.length);
  const price = (p: Pick | null): Goods | null =>
    !p
      ? null
      : p.kind === 'plan'
        ? buildable(g, viewer, p.id)
        : fillable(g, viewer, p.id);
  const delta = pick ? price(pick) : null;

  // Feedback: a turn to take sounds once; every reveal lands with a place cue.
  const turnCue = useRef('');
  useEffect(() => {
    if (g.over || g.phase !== 'plan' || locked || disabled) return;
    if (turnCue.current === decision) return;
    turnCue.current = decision;
    if (g.revision > 0) gameSound('alto', 'turn', volume);
  }, [decision, locked, disabled, g.over, g.phase, g.revision, volume]);
  useEffect(() => {
    if (reveal) gameSound('alto', 'move', volume);
  }, [reveal, volume]);
  useResultsFeedback('alto', g.over, g.over, volume);

  function choose(island: number) {
    if (!acting) return;
    const p = pick && price(pick) ? pick : null;
    gameSound('alto', 'place', volume);
    onMove({
      type: 'choose',
      island,
      ...(p?.kind === 'plan' ? { build: p.id } : {}),
      ...(p?.kind === 'order' ? { order: p.id } : {}),
    });
  }
  function toggle(p: Pick) {
    if (!acting || !price(p)) return;
    gameSound('alto', 'select', volume);
    setPick({ at: decision, pick: pick?.id === p.id ? null : p });
  }
  function undo() {
    if (!undoable) return;
    // Taking a choice back keeps its upgrade ready to go again.
    if (mine?.build)
      setPick({ at: decision, pick: { kind: 'plan', id: mine.build } });
    else if (mine?.order)
      setPick({ at: decision, pick: { kind: 'order', id: mine.order } });
    onMove({ type: 'undo' });
  }

  const turns = turnsPerSeason(g);
  const round = g.over ? 'Final' : seasonNames[g.season - 1];
  const wind = g.winds
    ? (g.winds[(g.season - 1) * turns + g.turn - 1] ?? -1)
    : -1;
  const nextWind =
    g.winds && !g.over ? (g.winds[(g.season - 1) * turns + g.turn] ?? -1) : -1;
  const lesson = practice ? altoLessons[practice.step] : null;
  const captainPick =
    g.phase === 'captain' && !me.captain ? me.captainOffer : null;
  // Ships: yours lifts off as soon as you pick; everyone's fly out at the reveal.
  const ships: ShipTargets = g.seats.map((_, s) =>
    g.over
      ? null
      : s === viewer
        ? (mine?.island ?? reveal?.visits[s] ?? null)
        : (reveal?.visits[s] ?? null),
  );
  const kits = g.players.map((p) => p.built);
  // Your ship or base wears the upgrade you are about to build, see-through.
  const ghost = mine?.build ?? (pick?.kind === 'plan' ? pick.id : null);
  const year = (g.over ? 3 : g.season) as Year;
  // The next year's planets are built during the last turn of this one.
  const prepareYear =
    !g.over && g.turn === turns && g.season < 3
      ? ((g.season + 1) as Year)
      : null;

  return (
    <main
      ref={root}
      className={`alto-world ${practice ? 'is-practice' : ''}`}
      data-phase={g.phase}
      data-year={year}
      data-planets={g.islands.length}
      data-locked={locked || undefined}
      data-picking={pick ? pick.kind : undefined}
      data-loading={!loading.ready || undefined}
    >
      <picture className="alto-space">
        <source
          media="(orientation: portrait)"
          srcSet={`${skyArt.portraitSmall} 512w, ${skyArt.portrait} 1024w`}
          sizes="100vw"
        />
        <img
          src={skyArt.landscape}
          srcSet={`${skyArt.landscapeSmall} 768w, ${skyArt.landscape} 1536w`}
          sizes="100vw"
          alt=""
          draggable={false}
        />
      </picture>
      <AltoSpace
        root={root}
        ships={ships}
        kits={kits}
        ghost={ghost}
        viewer={viewer}
        year={year}
        prepareYear={prepareYear}
        onProgress={loading.onProgress}
        onReady={loading.onReady}
      />
      <GameNavigation
        name="Alto"
        round={round}
        roundTrack={
          <YearTrack
            year={g.season}
            turn={g.over ? turns : g.turn}
            turns={turns}
            over={g.over}
          />
        }
        onBack={onLeave}
        onOthers={() => setPanel('others')}
        menu={{
          theme: 'alto',
          onRules: () => setPanel('rules'),
          items: [
            {
              label: 'All upgrades',
              icon: LayoutGrid,
              onSelect: () => setPanel('plans'),
            },
            ...(onNew
              ? [{ label: 'New game', icon: RotateCcw, onSelect: onNew }]
              : []),
          ],
          sound,
          onLeave,
          leaveLabel,
        }}
      />
      <header
        className="alto-players"
        ref={badges}
        style={{ '--seats': g.seats.length } as CSSProperties}
        aria-label="Players"
      >
        {g.seats.map((name, s) => {
          const waiting =
            !g.over &&
            (g.phase === 'captain' ? !g.players[s].captain : !g.ready[s]);
          return (
            <button
              type="button"
              key={s}
              className={`alto-player ${s === viewer ? 'is-you' : ''} ${waiting ? 'is-choosing' : 'is-ready'} ${presence?.[s]?.away ? 'is-away' : ''}`}
              style={seatStyle(s)}
              onClick={() => setInspecting({ kind: 'player', seat: s })}
              aria-label={`${name}${s === viewer ? ' (you)' : ''}, ${scores[s]} points, ${waiting ? 'choosing' : 'ready'}`}
            >
              <span className="alto-avatar">{name.slice(0, 1)}</span>
              <span className="alto-player-copy">
                <b>{name}</b>
              </span>
              <small data-game-motion="change" data-game-motion-key={scores[s]}>
                {scores[s]}
              </small>
              <output className="alto-status" aria-hidden="true">
                {g.over ? null : waiting ? (
                  <LoaderCircle size={13} />
                ) : (
                  <Check size={13} />
                )}
              </output>
            </button>
          );
        })}
      </header>

      {notice && <output className="alto-notice">{notice}</output>}
      <section
        className="alto-stage"
        data-coach="islands"
        aria-label="Planets"
        ref={stage}
      >
        <ul className="alto-bases" aria-label="Bases">
          {others.map((s, k) => {
            const p = g.players[s];
            const built = reveal?.builds[s];
            return (
              <li
                key={s}
                className="alto-base"
                style={{ ...seatStyle(s), ...spotStyle(spots.bases[k]) }}
              >
                <button
                  type="button"
                  className="alto-base-button"
                  data-base-seat={s}
                  onClick={() => setInspecting({ kind: 'player', seat: s })}
                  aria-label={`${g.seats[s]}’s base and ship`}
                >
                  <span className="alto-base-fallback" aria-hidden="true">
                    <ShipIcon seat={s} size={40} />
                  </span>
                </button>
                <span className="alto-base-tag" aria-hidden="true">
                  <span className="alto-avatar">{g.seats[s].slice(0, 1)}</span>
                  <GoodsRow amounts={p.stock} all size={14} />
                </span>
                {built && (
                  <span
                    className="alto-base-built"
                    aria-hidden="true"
                    style={stagger(0, 300)}
                  >
                    <FamilyIcon family={planById[built].family} size={11} />
                    {planById[built].name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <ul className="alto-planets">
          {g.islands.map((island, i) => {
            const info = islandList[i];
            const visitors = reveal
              ? reveal.visits.flatMap((v, s) => (v === i ? [s] : []))
              : [];
            const chosen = mine?.island === i;
            const flags = g.options.flags
              ? g.players.map((p) => p.flags[i] ?? 0)
              : null;
            const topFlags = flags ? Math.max(...flags) : 0;
            return (
              <li
                key={island.id}
                className={`alto-planet ${chosen ? 'is-mine' : ''} ${wind === i ? 'has-comet' : ''}`}
                data-good={island.good}
                data-island={island.id}
                data-index={i}
                data-full={island.pile >= 10 || undefined}
                style={spotStyle(spots.planets[i])}
              >
                <Piece
                  className="alto-planet-button"
                  label={`${info.name}: ${island.pile} ${goods[island.good].toLowerCase()}${wind === i ? ', comet' : ''}${chosen ? ', your pick' : ''}`}
                  unavailable={!acting}
                  onTap={() => choose(i)}
                  inspect={() => setInspecting({ kind: 'island', index: i })}
                >
                  <span className="alto-planet-fallback" aria-hidden="true" />
                  <span
                    className="alto-pile"
                    data-game-motion="change"
                    data-game-motion-key={`${decision}:${island.pile}`}
                  >
                    <GoodIcon good={island.good} size={30} />
                    <b>
                      {reveal ? (
                        <CountUp
                          value={island.pile}
                          from={reveal.piles[i]}
                          delay={900}
                          duration={700}
                        />
                      ) : (
                        island.pile
                      )}
                    </b>
                  </span>
                  {wind === i && (
                    <span className="alto-comet is-now" aria-hidden="true">
                      <Sparkles size={15} />
                      <b>+{windBonus}</b>
                    </span>
                  )}
                  {nextWind === i && wind !== i && (
                    <span className="alto-comet is-next" aria-hidden="true">
                      <Sparkles size={14} />
                    </span>
                  )}
                  {flags && topFlags > 0 && (
                    <span className="alto-flags" aria-hidden="true">
                      {flags.map((n, s) =>
                        n ? (
                          <span
                            key={s}
                            style={seatStyle(s)}
                            data-top={n === topFlags || undefined}
                          >
                            <Flag size={11} />
                            {n}
                          </span>
                        ) : null,
                      )}
                    </span>
                  )}
                  {visitors.length > 0 && (
                    <span className="alto-arrivals" aria-hidden="true">
                      {visitors.map((s, k) => (
                        <span
                          key={s}
                          className="alto-arrival"
                          style={{
                            ...seatStyle(s),
                            ...stagger(0, 900 + 120 * k),
                          }}
                        >
                          <span className="alto-avatar">
                            {g.seats[s].slice(0, 1)}
                          </span>
                          <b>+{reveal!.takes[s] + reveal!.bonus[s]}</b>
                        </span>
                      ))}
                    </span>
                  )}
                </Piece>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="alto-dock" aria-label="Your ship and base">
        <div
          className="alto-home"
          data-away={mine?.island !== undefined || !!reveal || undefined}
        >
          {(['ship', 'base'] as Family[]).map((family) => (
            <button
              key={family}
              type="button"
              className="alto-preview"
              data-family={family}
              onClick={() => setInspecting({ kind: 'player', seat: viewer })}
              aria-label={`Your ${family}, ${me.built.filter((id) => planById[id].family === family).length} owned upgrades${family === 'ship' ? `, hold ${hold(me)}` : ''}`}
            >
              <span
                className="alto-home-bay"
                data-base-seat={family === 'base' ? viewer : undefined}
                data-ship-seat={family === 'ship' ? viewer : undefined}
                aria-hidden="true"
              >
                {family === 'ship' ? (
                  <ShipIcon
                    seat={viewer}
                    size={64}
                    className="alto-home-fallback"
                  />
                ) : (
                  <Orbit size={52} className="alto-home-fallback" />
                )}
              </span>
              <span className="alto-preview-label">
                <FamilyIcon family={family} size={13} />
                <span className="alto-family-word">
                  {family === 'ship' ? 'Ship' : 'Base'}
                </span>
                {family === 'ship' && (
                  <span className="alto-preview-hold">
                    <Package size={12} />
                    <b>{hold(me)}</b>
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="alto-dock-row" ref={dockRow}>
          <GoodsRow
            amounts={me.stock}
            all
            delta={delta}
            className="alto-stock"
            size={24}
          />
          <div className="alto-owned" aria-label="Owned upgrades">
            {(['ship', 'base'] as Family[]).map((family) => {
              const owned = me.built.filter(
                (id) => planById[id].family === family,
              );
              return (
                <section
                  key={family}
                  className="alto-owned-family"
                  data-family={family}
                  aria-label={`Owned ${familyNames[family][1]}`}
                >
                  <button
                    type="button"
                    className="alto-owned-count"
                    onClick={() =>
                      setInspecting({ kind: 'player', seat: viewer })
                    }
                    aria-label={`Inspect ${owned.length} owned ${familyNames[family][1]}`}
                  >
                    <FamilyIcon family={family} size={13} />
                    <b>{owned.length}</b>
                  </button>
                  {owned.length > 0 && (
                    <ul className="alto-owned-list">
                      {owned.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => setInspecting({ kind: 'plan', id })}
                            aria-label={`Owned: ${planById[id].name}. ${planRule(planById[id])}`}
                            title={planById[id].name}
                          >
                            <PlanMark id={id} size={22} />
                            <span>{planById[id].name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          <button
            type="button"
            className="alto-all"
            data-coach="season"
            onClick={() => setPanel('plans')}
            aria-label="All upgrades"
          >
            <LayoutGrid size={17} />
          </button>
          <button
            type="button"
            className="alto-undo"
            disabled={!undoable}
            onClick={undo}
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>
        </div>
        {g.phase === 'plan' && g.options.orders && g.openOrders && (
          <div className="alto-orders" aria-label="Orders">
            {g.openOrders.map((id) => {
              const order = orderById[id];
              const can = !!fillable(g, viewer, id);
              return (
                <Piece
                  key={id}
                  className={`alto-order ${pick?.id === id || mine?.order === id ? 'is-picked' : ''} ${can ? '' : 'is-short'}`}
                  label={`Order: ${order.points} points for ${order.cost
                    .map((n, k) => (n ? `${n} ${goods[k].toLowerCase()}` : ''))
                    .filter(Boolean)
                    .join(', ')}`}
                  selected={pick?.id === id}
                  unavailable={!acting || !can}
                  onTap={() => toggle({ kind: 'order', id })}
                  inspect={() => setInspecting({ kind: 'order', id })}
                >
                  <ReceiptText size={14} aria-hidden="true" />
                  <CostRow cost={order.cost} stock={me.stock} size={18} />
                  <b className="alto-order-points">
                    <Star size={11} aria-hidden="true" />
                    {order.points}
                  </b>
                </Piece>
              );
            })}
          </div>
        )}
        <div
          className="alto-shop"
          data-coach="hand"
          data-shelves={shelves.length}
          style={{ '--items': plans.length } as CSSProperties}
        >
          {shelves.map(({ family, ids }) => (
            <section
              key={family}
              className="alto-shelf"
              data-family={family}
              style={{ '--count': ids.length } as CSSProperties}
              aria-label={`${seasonNames[g.season - 1]} ${familyNames[family][1]}`}
            >
              <span className="alto-shelf-label" aria-hidden="true">
                <FamilyIcon family={family} size={13} />
                <span>{family === 'ship' ? 'Ship' : 'Base'}</span>
              </span>
              {ids.map((id) => {
                const plan = planById[id];
                const built = me.built.includes(id);
                const cost = buildable(g, viewer, id);
                const race = plan.effects.some((e) => e.type === 'race');
                return (
                  <Piece
                    key={id}
                    className={`alto-item is-${plan.family} ${built ? 'is-built' : cost ? 'is-ready' : 'is-short'} ${pick?.id === id || mine?.build === id ? 'is-picked' : ''}`}
                    label={`${plan.name}, ${familyNames[plan.family][0]}. ${planRule(plan)}${built ? ' Owned.' : mine?.build === id ? ' Queued for this flight.' : pick?.id === id ? ' Selected for this flight.' : cost ? '' : ' Not enough cargo.'}`}
                    selected={pick?.id === id}
                    unavailable={!acting || !cost}
                    onTap={() => toggle({ kind: 'plan', id })}
                    inspect={() => setInspecting({ kind: 'plan', id })}
                  >
                    <PlanFace
                      id={id}
                      next={race ? raceValue(g, plan) : undefined}
                      earned={built ? (me.scored[id] ?? 0) : undefined}
                      stock={me.stock}
                      hideCost={built}
                      off={discount(g, me, plan.family)}
                    />
                    {built && (
                      <span className="alto-item-seal" aria-hidden="true">
                        <Check size={12} />
                        <span>Owned</span>
                      </span>
                    )}
                    {!built && (pick?.id === id || mine?.build === id) && (
                      <span className="alto-item-choice" aria-hidden="true">
                        {mine?.build === id ? 'Queued' : 'Selected'}
                      </span>
                    )}
                  </Piece>
                );
              })}
            </section>
          ))}
        </div>
      </footer>

      {captainPick && loading.ready && (
        <section className="alto-captains" aria-label="Pick your crew">
          {captainPick.map((id) => (
            <button
              key={id}
              type="button"
              className="alto-captain"
              disabled={disabled || sending}
              onClick={() => onMove({ type: 'captain', captain: id })}
            >
              <img src={captainArt(id)} alt="" width={96} height={96} />
              <b>{captainById[id].name}</b>
              <small>{captainById[id].text}</small>
            </button>
          ))}
        </section>
      )}

      {banner !== null && !g.over && (
        <div className="alto-banner" aria-live="polite" key={banner}>
          <YearTrack year={banner} turn={0} turns={turns} />
          <b>{seasonNames[banner - 1]}</b>
        </div>
      )}

      {lesson && practice && loading.ready && (
        <aside className="alto-coach" aria-live="polite">
          <b>
            {practice.step + 1}/{altoLessons.length} · {lesson.title}
          </b>
          <p>{lesson.text}</p>
          {practice.canTeach && (
            <div>
              <button
                type="button"
                disabled={practice.step === 0}
                onClick={() => practice.onStep(practice.step - 1)}
              >
                Back
              </button>
              {practice.step < altoLessons.length - 1 && (
                <button
                  type="button"
                  onClick={() => practice.onStep(practice.step + 1)}
                >
                  Next
                </button>
              )}
              <button
                type="button"
                className="is-primary"
                onClick={practice.onBegin}
              >
                Start real game
              </button>
            </div>
          )}
        </aside>
      )}
      <CoachTarget target={lesson?.target} />

      {g.over && loading.ready && (
        <AltoFinale g={g} viewer={viewer}>
          {finale}
        </AltoFinale>
      )}

      {!loading.ready && <Loader progress={loading.progress} />}

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent
          className={`modal alto-dialog ${panel === 'others' ? 'is-wide' : ''}`}
        >
          <DialogTitle>
            {panel === 'rules'
              ? 'How to play'
              : panel === 'plans'
                ? 'All upgrades'
                : 'Bases and ships'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'plans'
              ? 'Every upgrade of this match, year by year.'
              : 'Alto'}
          </DialogDescription>
          <div className="alto-dialog-body">
            {panel === 'rules' && (
              <AltoRules options={g.options} plans={g.plans} />
            )}
            {panel === 'plans' && <PlansOverview g={g} viewer={viewer} />}
            {panel === 'others' && (
              <Others
                g={g}
                viewer={viewer}
                onPlan={(id) => setInspecting({ kind: 'plan', id })}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={inspecting !== null}
        onOpenChange={(open) => !open && setInspecting(null)}
      >
        <DialogContent className="modal alto-dialog alto-inspect">
          {inspecting && (
            <Inspection
              g={g}
              viewer={viewer}
              item={inspecting}
              onPlan={(id) => setInspecting({ kind: 'plan', id })}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

/** Marks the part of the table the coach is talking about. */
function CoachTarget({ target }: { target?: string }) {
  useEffect(() => {
    if (!target) return;
    const node = document.querySelector<HTMLElement>(
      `.alto-world [data-coach="${target}"]`,
    );
    node?.setAttribute('data-tutorial-active', 'true');
    return () => node?.removeAttribute('data-tutorial-active');
  }, [target]);
  return null;
}

function Inspection({
  g,
  viewer,
  item,
  onPlan,
}: {
  g: AltoGame;
  viewer: number;
  item: Inspecting;
  onPlan: (id: string) => void;
}) {
  if (item.kind === 'plan') {
    const plan = planById[item.id];
    const race = plan.effects.find((e) => e.type === 'race');
    const builders = g.players.flatMap((p, s) =>
      p.built.includes(plan.id) ? [s] : [],
    );
    return (
      <>
        <DialogTitle>{plan.name}</DialogTitle>
        <DialogDescription className="sr-only">
          {plan.name}, {familyNames[plan.family][0]}
        </DialogDescription>
        <div className="alto-inspect-plan">
          <PlanMark id={plan.id} size={160} />
          <div>
            <span className="alto-inspect-family" data-family={plan.family}>
              <FamilyIcon family={plan.family} size={14} />
              {plan.family === 'ship' ? 'Ship part' : 'Base module'}
            </span>
            {g.players[viewer].built.includes(plan.id) ? (
              <GoodsRow amounts={plan.cost} size={22} />
            ) : (
              <CostRow
                cost={plan.cost}
                stock={g.players[viewer].stock}
                off={discount(g, g.players[viewer], plan.family)}
                size={24}
              />
            )}
            <EffectLine
              plan={plan}
              next={race ? raceValue(g, plan) : undefined}
              earned={
                g.players[viewer].built.includes(plan.id)
                  ? (g.players[viewer].scored[plan.id] ?? 0)
                  : undefined
              }
            />
            {race && race.type === 'race' && (
              <ol className="alto-ladder" aria-label="Prizes">
                {race.ladder.map((v, k) => (
                  <li
                    key={k}
                    data-taken={k < (g.races[plan.id] ?? 0) || undefined}
                  >
                    {v}
                  </li>
                ))}
              </ol>
            )}
            {builders.length > 0 && (
              <span className="alto-builders">
                {builders.map((s) => (
                  <span
                    key={s}
                    className="alto-avatar"
                    style={seatStyle(s)}
                    title={g.seats[s]}
                  >
                    {g.seats[s].slice(0, 1)}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <AltoPlanRules plan={plan} />
      </>
    );
  }
  if (item.kind === 'order') {
    const order = orderById[item.id];
    return (
      <>
        <DialogTitle>Order</DialogTitle>
        <DialogDescription>
          Pay this cargo instead of building an upgrade and score {order.points}{' '}
          at once.
        </DialogDescription>
        <div className="alto-inspect-plan">
          <CostRow
            cost={order.cost}
            stock={g.players[viewer].stock}
            size={24}
          />
          <b className="alto-order-points">{order.points}</b>
        </div>
      </>
    );
  }
  if (item.kind === 'island') {
    const island = g.islands[item.index];
    const info = islandList[item.index];
    return (
      <>
        <DialogTitle>{info.name}</DialogTitle>
        <DialogDescription>
          {island.pile} {goods[island.good].toLowerCase()} waiting. Alone you
          take up to your hold; together you split it.
        </DialogDescription>
        <div className="alto-inspect-island">
          <img src={planetArt(island.id)} alt="" width={200} height={200} />
          {g.options.flags && (
            <ul className="alto-flag-list" aria-label="Flags">
              {g.players.map((p, s) => (
                <li key={s} style={seatStyle(s)}>
                  <Flag size={14} /> {g.seats[s]}{' '}
                  <b>{p.flags[item.index] ?? 0}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  }
  return (
    <PlayerSheet
      g={g}
      seat={item.seat}
      viewer={viewer}
      titled
      onPlan={onPlan}
    />
  );
}

/** One player: score, cargo, hold, their ship's parts and their base's modules. */
function PlayerSheet({
  g,
  seat,
  viewer,
  titled = false,
  onPlan,
}: {
  g: AltoGame;
  seat: number;
  viewer: number;
  titled?: boolean;
  onPlan?: (id: string) => void;
}) {
  const p = g.players[seat];
  const b = breakdown(g, seat);
  const yields = ([0, 1, 2, 3] as Good[]).filter((k) => yieldBonus(p, k) > 0);
  const Title = titled ? DialogTitle : 'h3';
  const of = (family: Family) =>
    p.built.filter((id) => planById[id].family === family);
  return (
    <section className="alto-sheet" style={seatStyle(seat)}>
      <Title className="alto-sheet-title">
        <span className="alto-avatar">{g.seats[seat].slice(0, 1)}</span>
        {g.seats[seat]}
        {seat === viewer && g.seats[seat] !== 'You' ? ' (you)' : ''}
        <b className="alto-sheet-score">{b.total}</b>
      </Title>
      {titled && (
        <DialogDescription className="sr-only">
          {g.seats[seat]}’s base and ship
        </DialogDescription>
      )}
      <div className="alto-sheet-stats">
        <GoodsRow amounts={p.stock} all size={20} />
        <span className="alto-stat">
          <Package size={14} aria-hidden="true" /> Hold {hold(p)}
        </span>
        {aloneBonus(p) > 0 && (
          <span className="alto-stat">Alone +{aloneBonus(p)}</span>
        )}
        {shareBonus(p) > 0 && (
          <span className="alto-stat">Shared +{shareBonus(p)}</span>
        )}
        {yields.map((k) => (
          <span key={k} className="alto-stat">
            <GoodIcon good={k} size={16} /> +{yieldBonus(p, k)}
          </span>
        ))}
        {p.captain && (
          <span className="alto-stat alto-stat-captain">
            <img src={captainArt(p.captain)} alt="" width={22} height={22} />{' '}
            {captainById[p.captain].name}
          </span>
        )}
      </div>
      {(['ship', 'base'] as Family[]).map((family) => (
        <div key={family} className="alto-sheet-row" data-family={family}>
          <span className="alto-sheet-family" title={familyNames[family][1]}>
            <FamilyIcon family={family} size={14} />
            <span>{family === 'ship' ? 'Ship' : 'Base'}</span>
            <b>{of(family).length}</b>
          </span>
          {of(family).length ? (
            <ul className="alto-built">
              {of(family).map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onPlan?.(id)}
                    disabled={!onPlan}
                    aria-label={planById[id].name}
                  >
                    <PlanMark id={id} size={44} />
                    <span className="alto-built-detail">
                      <b>{planById[id].name}</b>
                      <EffectLine
                        plan={planById[id]}
                        earned={p.scored[id] ?? 0}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="alto-sheet-empty" aria-hidden="true">
              –
            </span>
          )}
        </div>
      ))}
      <dl className="alto-breakdown">
        <div>
          <dt>Modules</dt>
          <dd>{b.plans}</dd>
        </div>
        {b.bonus > 0 && (
          <div>
            <dt>End scores</dt>
            <dd>{b.bonus}</dd>
          </div>
        )}
        {g.options.orders && (
          <div>
            <dt>Orders</dt>
            <dd>{b.orders}</dd>
          </div>
        )}
        {g.options.flags && (
          <div>
            <dt>Flags</dt>
            <dd>{b.flags}</dd>
          </div>
        )}
        <div>
          <dt>Cargo left</dt>
          <dd>{b.leftover}</dd>
        </div>
      </dl>
    </section>
  );
}

function Others({
  g,
  viewer,
  onPlan,
}: {
  g: AltoGame;
  viewer: number;
  onPlan: (id: string) => void;
}) {
  // Your own first, then the table in seat order.
  const order = [
    viewer,
    ...g.players.map((_, s) => s).filter((s) => s !== viewer),
  ];
  return (
    <div className="alto-others">
      {order.map((s) => (
        <PlayerSheet key={s} g={g} seat={s} viewer={viewer} onPlan={onPlan} />
      ))}
    </div>
  );
}

function PlansOverview({ g, viewer }: { g: AltoGame; viewer: number }) {
  return (
    <div className="alto-overview">
      {g.plans.map((ids, s) => (
        <section
          key={s}
          className="alto-overview-season"
          data-now={s + 1 === g.season || undefined}
          data-past={s + 1 < g.season || undefined}
        >
          <h3>{seasonNames[s]}</h3>
          <ul>
            {ids.map((id) => {
              const plan = planById[id];
              const race = plan.effects.some((e) => e.type === 'race');
              const builders = g.players.flatMap((p, k) =>
                p.built.includes(id) ? [k] : [],
              );
              return (
                <li
                  key={id}
                  className={`alto-item is-static ${g.players[viewer].built.includes(id) ? 'is-built' : ''}`}
                  data-family={plan.family}
                >
                  <PlanFace
                    id={id}
                    next={race ? raceValue(g, plan) : undefined}
                    earned={
                      g.players[viewer].built.includes(id)
                        ? (g.players[viewer].scored[id] ?? 0)
                        : undefined
                    }
                  />
                  {builders.length > 0 && (
                    <span className="alto-builders">
                      {builders.map((k) => (
                        <i key={k} style={seatStyle(k)} title={g.seats[k]} />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <PlanList plans={g.plans} />
    </div>
  );
}

/** Final scores: rows land from last place up, each counting up by category. */
function AltoFinale({
  g,
  viewer,
  children,
}: {
  g: AltoGame;
  viewer: number;
  children?: ReactNode;
}) {
  const win = winners(g);
  const rows = g.players
    .map((_, s) => ({ s, b: breakdown(g, s) }))
    .sort(
      (a, b) =>
        b.b.total - a.b.total ||
        totalGoods(g.players[b.s]) - totalGoods(g.players[a.s]),
    );
  const STEP = 260;
  const delay = (i: number) => (rows.length - 1 - i) * STEP;
  const title =
    win.length > 1
      ? `${win.map((s) => g.seats[s]).join(' & ')} tie`
      : g.seats[win[0]] === 'You'
        ? 'You win'
        : `${g.seats[win[0]]} wins`;
  return (
    <section className="alto-finale results-surface" aria-label="Final scores">
      <WinnerCelebration won={viewerWon(viewer, win)} />
      <div
        className="alto-finale-crown reveal-pop reveal-burst"
        style={stagger(0, rows.length * STEP)}
      >
        <Crown size={36} aria-hidden="true" />
      </div>
      <h2 className="reveal-rise" style={stagger(0, rows.length * STEP + 120)}>
        {title}
      </h2>
      <ol className="alto-finale-rows">
        {rows.map(({ s, b }, i) => (
          <li
            key={s}
            className={`reveal-rise ${win.includes(s) ? 'is-winner' : ''}`}
            style={{ ...seatStyle(s), ...stagger(0, delay(i)) }}
          >
            <span className="alto-avatar">{g.seats[s].slice(0, 1)}</span>
            <b className="alto-finale-name">{g.seats[s]}</b>
            <span className="alto-finale-parts">
              <span
                title="Base modules"
                aria-label={`Base modules ${b.plans + b.bonus}`}
              >
                <Orbit size={12} />
                {b.plans + b.bonus}
              </span>
              {g.options.orders && (
                <span title="Orders" aria-label={`Orders ${b.orders}`}>
                  <ReceiptText size={12} />
                  {b.orders}
                </span>
              )}
              {g.options.flags && (
                <span title="Flags" aria-label={`Flags ${b.flags}`}>
                  <Flag size={12} />
                  {b.flags}
                </span>
              )}
              <span title="Cargo left" aria-label={`Cargo left ${b.leftover}`}>
                <Package size={12} />
                {b.leftover}
              </span>
            </span>
            <CountUp className="alto-finale-total" value={b.total} />
          </li>
        ))}
      </ol>
      <div className="alto-finale-actions">{children}</div>
    </section>
  );
}
