'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  LogOut,
  Pause,
  RotateCcw,
  Settings2,
  WifiOff,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  dishes,
  nights,
  stationDish,
  type NightId,
} from '@/lib/games/diner/content';
import {
  clock,
  hasMimics,
  medalsFor,
  outTarget,
  actionFor,
  type DinerEvent,
  type Match,
  type UseAction,
} from '@/lib/games/diner/engine';
import { COUNTER_X, QUEUE } from '@/lib/games/diner/layout';
import { GameMenu } from '../game-menu';
import { recordCompletedGame } from '../play-experience';
import { useResultsFeedback, WinnerCelebration } from '../results-feedback';
import { Pacer, ladder } from '../arena/pacer';
import { DinerRules } from './diner-rules';
import { readDiner, recordShift } from './diner-store';
import { DinerIcon, type IconName } from './icons';
import { Joystick, type Stick } from './joystick';
import { SEAT_COLOURS } from './seats';
import type { Controls, Session } from './session';
import { DinerSound } from './sound';
import { DinerView } from './view';
import './diner.css';

/** What the online room adds around a shift. */
export type RoomInfo = {
  status: 'waiting' | 'playing' | 'over';
  seats: { name: string; connected: boolean }[];
  link: 'live' | 'lost' | 'gone';
};

type Hud = {
  seconds: number;
  coins: number;
  stars: number;
  phase: Match['phase'];
  countdown: number;
  medals: number;
  targets: [number, number, number];
};
const readHud = (m: Match): Hud => ({
  seconds: Math.ceil(clock(m)),
  coins: m.coins,
  stars: m.stars,
  phase: m.phase,
  countdown: m.countdown > 0 ? Math.ceil(m.countdown / 30) : 0,
  medals: medalsFor(m),
  targets: m.targets,
});
const sameHud = (a: Hud, b: Hud) =>
  a.seconds === b.seconds &&
  a.coins === b.coins &&
  a.stars === b.stars &&
  a.phase === b.phase &&
  a.countdown === b.countdown &&
  a.medals === b.medals &&
  a.targets.join() === b.targets.join();

const time = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The picture and one word on the Use button. */
function lookFor(a: UseAction | null): { icon: IconName; word: string } {
  if (!a) return { icon: 'hand', word: 'Use' };
  switch (a.kind) {
    case 'lead':
      return { icon: 'follow', word: 'Lead' };
    case 'return':
      return { icon: 'back', word: 'Back' };
    case 'seat':
      return { icon: 'seat', word: 'Seat' };
    case 'order':
      return { icon: 'order', word: 'Order' };
    case 'serve':
      return { icon: a.dish ?? 'burger', word: 'Serve' };
    case 'clear':
      return { icon: 'dirty', word: 'Clear' };
    case 'cook':
      return { icon: a.dish ?? 'burger', word: 'Cook' };
    case 'take':
      return { icon: a.dish ?? 'burger', word: 'Take' };
    case 'wash':
      return { icon: 'wash', word: 'Wash' };
    case 'bin':
      return { icon: 'bin', word: 'Bin' };
    case 'mop':
      return { icon: 'mop', word: 'Mop' };
  }
}

// ---------------------------------------------------------------- overlays

type Bubble = {
  key: string;
  kind: 'table' | 'queue' | 'station' | 'name';
  /** Discrete content; the bubble re-renders only when this changes. */
  sig: string;
  icons: { name: IconName; done?: boolean }[];
  state: string;
  label?: string;
  colour?: string;
  /** Continuous values set straight on the element. */
  patience?: number;
  progress?: number;
  at: [number, number, number];
};

function bubbles(m: Match, you: number, online: boolean): Bubble[] {
  const out: Bubble[] = [];
  const groups = new Map(m.groups.map((g) => [g.id, g]));
  for (const t of m.tables) {
    const g = t.group >= 0 ? groups.get(t.group) : undefined;
    const at: [number, number, number] = [t.x, 1.45, t.z - 0.2];
    if (
      g &&
      (g.state === 'read' ||
        g.state === 'order' ||
        g.state === 'food' ||
        g.state === 'eat')
    ) {
      const members = m.guests.filter(
        (x) => x.group === g.id && x.state !== 'goo',
      );
      const icons: { name: IconName; done?: boolean }[] =
        g.state === 'read'
          ? [{ name: 'dots' as IconName }]
          : g.state === 'order'
            ? [{ name: 'bell' as IconName }]
            : g.state === 'eat'
              ? [{ name: 'eat' as IconName }]
              : members
                  .filter((x) => x.dish)
                  .map((x) => ({ name: x.dish as IconName, done: x.served }));
      out.push({
        key: `t${t.slot}`,
        kind: 'table',
        state: g.state,
        sig: `${g.state}|${icons.map((i) => `${i.name}${i.done ? 1 : 0}`).join(',')}|${g.patience < 0.3 ? 'low' : g.patience < 0.6 ? 'mid' : 'ok'}`,
        icons,
        patience: g.patience,
        progress: g.state === 'eat' ? Math.min(1, g.t / 180) : undefined,
        at,
      });
    } else if (t.dirty) {
      out.push({
        key: `t${t.slot}`,
        kind: 'table',
        state: 'dirty',
        sig: `dirty|${t.coins}`,
        icons: [{ name: t.coins > 0 ? 'coin' : 'dirty' }],
        label: t.coins > 0 ? String(t.coins) : undefined,
        at,
      });
    }
  }
  for (const g of m.groups) {
    if (g.state !== 'queue' && g.state !== 'follow') continue;
    const members = m.guests.filter((x) => x.group === g.id);
    if (!members.length) continue;
    // Beside the row's right end, or over the last of a conga line.
    const top = g.state === 'follow' ? members[members.length - 1] : undefined;
    const cx = top ? top.x : g.slot >= 0 ? QUEUE[g.slot].x + 1.5 : members[0].x;
    const cz = top
      ? top.z
      : g.slot >= 0
        ? QUEUE[g.slot].z - 0.15
        : members[0].z;
    out.push({
      key: `g${g.id}`,
      kind: 'queue',
      state: g.state,
      sig: `${g.state}|${g.patience < 0.3 ? 'low' : g.patience < 0.6 ? 'mid' : 'ok'}|${members.length}`,
      icons: [],
      label: String(members.length),
      patience: g.patience,
      at: [cx, g.state === 'queue' ? 0.95 : 1.9, cz],
    });
  }
  for (const s of m.stations) {
    if (s.state === 'idle') continue;
    const dish = stationDish[s.id];
    const total = dishes[dish].cook * 30;
    const burn = dishes[dish].burn;
    const smoking = s.state === 'ready' && burn !== null && s.t > burn * 15;
    out.push({
      key: `s${s.id}`,
      kind: 'station',
      state: s.state === 'ready' && smoking ? 'smoking' : s.state,
      sig: `${s.state}|${smoking}`,
      icons: [{ name: s.state === 'burnt' ? 'burnt' : dish }],
      progress:
        s.state === 'cook'
          ? 1 - s.t / Math.max(1, total)
          : s.state === 'ready' && burn !== null
            ? 1 - s.t / (burn * 30)
            : 1,
      at: [COUNTER_X[s.id], 1.75, 0.75],
    });
  }
  if (online)
    m.players.forEach((p, i) => {
      if (i === you) return;
      out.push({
        key: `p${i}`,
        kind: 'name',
        state: 'name',
        sig: p.name,
        icons: [],
        label: p.name,
        colour: SEAT_COLOURS[i],
        at: [p.x, 2.05, p.z],
      });
    });
  return out;
}

function BubbleView({
  b,
  register,
}: {
  b: Bubble;
  register: (key: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={(el) => register(b.key, el)}
      className={`diner-bubble ${b.kind}`}
      data-state={b.state}
      style={b.colour ? ({ '--seat': b.colour } as CSSProperties) : undefined}
    >
      {b.kind === 'name' ? (
        <span className="diner-name">{b.label}</span>
      ) : b.kind === 'queue' ? (
        <span className="diner-mood">
          <i className="diner-mood-face" />
          <b>{b.label}</b>
        </span>
      ) : (
        <span className="diner-bubble-body">
          {b.kind === 'table' && b.patience !== undefined && (
            <i className="diner-patience" />
          )}
          {b.icons.map((icon, i) => (
            <span
              key={i}
              className={`diner-bubble-icon ${icon.done ? 'done' : ''}`}
            >
              <DinerIcon name={icon.name} />
            </span>
          ))}
          {b.label && <b className="diner-bubble-label">{b.label}</b>}
          {b.kind === 'station' && <i className="diner-ring" />}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the screen

export default function DinerGame({
  session,
  volume,
  music,
  sound,
  room,
  learn = false,
  onExit,
  onNight,
  leaveNote,
}: {
  session: Session;
  volume: number;
  music: number;
  sound: ReactNode;
  room?: RoomInfo;
  learn?: boolean;
  onExit: () => void;
  /** Solo: a shift ended with medals (kept on the device by the caller too). */
  onNight?: (night: NightId) => void;
  leaveNote?: string;
}) {
  const subscribe = useCallback(
    (l: () => void) => session.subscribe(l),
    [session],
  );
  const round = useSyncExternalStore(
    subscribe,
    () => session.round,
    () => 0,
  );
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const fxLayer = useRef<HTMLDivElement>(null);
  const coinTarget = useRef<HTMLSpanElement>(null);
  const coinTargetPhone = useRef<HTMLSpanElement>(null);
  const view = useRef<DinerView | null>(null);
  const audio = useRef<DinerSound | null>(null);
  const stick = useRef<Stick>({ x: 0, z: 0 });
  const keys = useRef(new Set<string>());
  const controls = useRef<Controls>({ mx: 0, mz: 0, use: false, out: false });
  const elements = useRef(new Map<string, HTMLDivElement>());
  const [hud, setHud] = useState<Hud>(() => readHud(session.match));
  const [hint, setHint] = useState<{ use: UseAction | null; out: boolean }>({
    use: null,
    out: false,
  });
  const [items, setItems] = useState<Bubble[]>([]);
  const [panel, setPanel] = useState<'menu' | 'rules' | 'leave' | null>(
    learn ? 'rules' : null,
  );
  const [results, setResults] = useState(false);
  const [error, setError] = useState('');
  const [touch, setTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
  );
  const [started, setStarted] = useState(session.kind === 'online');
  const [record, setRecord] = useState<{ best: boolean } | null>(null);
  const paused = useRef(false);
  const touchRef = useRef(touch);
  const remeasure = useRef<() => void>(() => {});
  const levels = useRef({ volume, music });
  const online = session.kind === 'online';

  useEffect(() => {
    paused.current =
      session.canPause &&
      (panel !== null || (!started && session.match.phase === 'ready'));
    audio.current?.pause(paused.current && panel !== null);
  }, [panel, session, started]);

  // Sound.
  useEffect(() => {
    const a = new DinerSound();
    a.levels(levels.current.volume, levels.current.music);
    audio.current = a;
    const onVisible = () =>
      a.levels(levels.current.volume, levels.current.music);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      a.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    levels.current = { volume, music };
    audio.current?.levels(volume, music);
  }, [volume, music]);

  // A touch anywhere shows the touch controls; keys alone keep them hidden.
  useEffect(() => {
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onTouch);
  }, []);

  const press = useCallback(
    (which: 'use' | 'out') => {
      controls.current[which] = true;
      audio.current?.startMusic(session.night);
      try {
        navigator.vibrate?.(which === 'out' ? 18 : 10);
      } catch {
        /* No haptics here. */
      }
    },
    [session],
  );

  // Keyboard.
  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === 'Escape') {
        setPanel((p) => (p ? p : 'menu'));
        return;
      }
      if (panel) return;
      const k = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(k)
      ) {
        keys.current.add(k);
        e.preventDefault();
      } else if ((k === ' ' || k === 'e' || k === 'enter') && !e.repeat) {
        if (k === 'enter' && (e.target as HTMLElement)?.closest?.('button'))
          return;
        e.preventDefault();
        press('use');
      } else if ((k === 'q' || k === 'x') && !e.repeat) {
        e.preventDefault();
        press('out');
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [panel, press]);

  // Floating feedback in the DOM: amounts that rise, coins that fly home.
  const floatText = useCallback(
    (text: string, x: number, y: number, tone: string) => {
      const layer = fxLayer.current;
      if (!layer) return;
      const el = document.createElement('span');
      el.className = `diner-float ${tone}`;
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      layer.appendChild(el);
      const calm = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const anim = el.animate(
        calm
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
              {
                transform: 'translate(-50%, -90%) scale(1.15)',
                opacity: 1,
                offset: 0.25,
              },
              { transform: 'translate(-50%, -190%) scale(1)', opacity: 0 },
            ],
        { duration: 1300, easing: 'cubic-bezier(.2,.8,.3,1)' },
      );
      anim.onfinish = () => el.remove();
    },
    [],
  );
  const flyCoins = useCallback((count: number, x: number, y: number) => {
    const layer = fxLayer.current;
    const phone = coinTargetPhone.current;
    const target = phone && phone.offsetParent ? phone : coinTarget.current;
    if (
      !layer ||
      !target ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const box = layer.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const tx = t.left + t.width / 2 - box.left;
    const ty = t.top + t.height / 2 - box.top;
    for (let i = 0; i < Math.min(8, count); i++) {
      const el = document.createElement('span');
      el.className = 'diner-coin-fly';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      layer.appendChild(el);
      const dx = tx - x,
        dy = ty - y;
      const spread = (Math.random() - 0.5) * 60;
      const anim = el.animate(
        [
          {
            transform: 'translate(-50%, -50%) scale(0.6) rotateY(0deg)',
            opacity: 0,
          },
          {
            transform: `translate(calc(-50% + ${spread}px), calc(-50% - 40px)) scale(1.1) rotateY(360deg)`,
            opacity: 1,
            offset: 0.3,
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7) rotateY(900deg)`,
            opacity: 1,
          },
        ],
        {
          duration: 650 + i * 70,
          delay: i * 55,
          easing: 'cubic-bezier(.5,0,.4,1)',
          fill: 'backwards',
        },
      );
      anim.onfinish = () => {
        el.remove();
        target.classList.remove('bump');
        void target.offsetWidth;
        target.classList.add('bump');
      };
    }
  }, []);

  const showFailure = useCallback((e: unknown) => {
    setError(
      e instanceof Error && /WebGL/i.test(e.message)
        ? 'This browser cannot show 3D graphics.'
        : 'Could not start the diner.',
    );
  }, []);

  // Build the view and run the loop.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const m0 = session.match;
    let v: DinerView;
    try {
      v = new DinerView(
        el,
        m0.night,
        m0.tables.map((t) => t.slot),
        m0.stations.map((s) => s.id),
        m0.players.length,
        Math.min(window.devicePixelRatio || 1, 2),
      );
    } catch (e) {
      void Promise.reject(e).catch(showFailure);
      return;
    }
    v.you = session.you;
    v.calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    view.current = v;
    if (process.env.NODE_ENV === 'development')
      (window as unknown as { dinerDebug: unknown }).dinerDebug = {
        session,
        view: v,
        controls: controls.current,
        stick: stick.current,
      };
    const measure = () => {
      const s = stage.current?.getBoundingClientRect();
      if (!s) return;
      const bar = top.current?.getBoundingClientRect();
      const p = pad.current?.getBoundingClientRect();
      const phone = s.width <= 600;
      const topInset = bar
        ? Math.max(0, bar.bottom - s.top) + (phone ? 2 : 10)
        : 60;
      // Beside side rails (touch, landscape) keep clear of the stick and buttons.
      const overlaid = !!p && p.height > 0 && p.top < s.bottom - 20;
      const rails =
        touchRef.current && overlaid ? Math.min(s.width * 0.22, 220) : 0;
      v.resize({
        width: s.width,
        height: s.height,
        top: topInset,
        bottom: phone ? 4 : 14,
        left: rails || (phone ? 2 : 14),
        right: rails || (phone ? 2 : 14),
      });
    };
    measure();
    remeasure.current = measure;
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    if (top.current) ro.observe(top.current);
    window.visualViewport?.addEventListener('resize', measure);
    const pacer = new Pacer(ladder(2048, 0.6), (rung) => v.setRung(rung));
    let raf = 0;
    let last = performance.now();
    let prevHud: Hud | null = null;
    let prevHint = '';
    let prevSig = '';
    let resultsAt = 0;
    let recorded = false;
    let shownRound = session.round;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      if (!pacer.frame(now)) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (session.round !== shownRound) {
        shownRound = session.round;
        resultsAt = 0;
        recorded = false;
        setResults(false);
      }
      // Stick first, keys otherwise.
      const c = controls.current;
      const k = keys.current;
      if (stick.current.x || stick.current.z) {
        c.mx = stick.current.x;
        c.mz = stick.current.z;
      } else {
        let x =
          (k.has('d') || k.has('arrowright') ? 1 : 0) -
          (k.has('a') || k.has('arrowleft') ? 1 : 0);
        let z =
          (k.has('s') || k.has('arrowdown') ? 1 : 0) -
          (k.has('w') || k.has('arrowup') ? 1 : 0);
        const len = Math.hypot(x, z);
        if (len > 1) {
          x /= len;
          z /= len;
        }
        c.mx = x;
        c.mz = z;
      }
      const alpha = session.advance(dt, paused.current, c);
      const m = session.match;
      const events = session.drain();
      if (events.length) {
        v.handle(m, events);
        audio.current?.events(events, session.you);
        react(events, m);
      }
      if (m.phase === 'open') audio.current?.clock(clock(m));
      const use = actionFor(m, session.you);
      const out = outTarget(m, session.you);
      v.frame(m, alpha, paused.current ? 0 : dt, { use, out });
      // HUD, Use button and bubbles only re-render on change.
      const h = readHud(m);
      if (!prevHud || !sameHud(prevHud, h)) {
        prevHud = h;
        setHud(h);
      }
      const hk = `${use?.kind}|${use?.dish}|${out !== null}`;
      if (hk !== prevHint) {
        prevHint = hk;
        setHint({ use, out: out !== null });
      }
      const list = bubbles(m, session.you, session.kind === 'online');
      const sig = list.map((b) => `${b.key}:${b.sig}`).join(';');
      if (sig !== prevSig) {
        prevSig = sig;
        setItems(list);
      }
      for (const b of list) {
        const node = elements.current.get(b.key);
        if (!node) continue;
        const at = v.project(...b.at);
        node.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
        if (b.patience !== undefined)
          node.style.setProperty('--p', b.patience.toFixed(3));
        if (b.progress !== undefined)
          node.style.setProperty('--progress', b.progress.toFixed(3));
      }
      if (m.phase === 'over') {
        if (!recorded) {
          recorded = true;
          recordCompletedGame('Diner');
          if (session.kind === 'solo') {
            const best = m.coins > 0 && m.coins > readDiner().best[m.night];
            recordShift(m.night, m.medals, m.coins);
            setRecord({ best });
            onNight?.(m.night);
          }
          resultsAt = now + 1300;
        }
        if (resultsAt > 0 && now >= resultsAt) {
          resultsAt = -1;
          setResults(true);
        }
      }
    };
    /** Screen-space feedback for the events of this frame. */
    const react = (events: DinerEvent[], m: Match) => {
      for (const e of events) {
        if (e.type === 'clear' && e.coins > 0) {
          const t = m.tables.find((s) => s.slot === e.table);
          if (!t) continue;
          const at = v.project(t.x, 1.0, t.z);
          floatText(`+${e.coins}`, at.x, at.y, 'gold');
          flyCoins(Math.ceil(e.coins / 8), at.x, at.y);
        } else if (e.type === 'reveal') {
          const at = v.project(e.x, 1.2, e.z);
          floatText(`+${e.coins}`, at.x, at.y, 'goo');
          flyCoins(3, at.x, at.y);
          if (e.player === session.you)
            try {
              navigator.vibrate?.([20, 30, 40]);
            } catch {
              /* No haptics. */
            }
        } else if (e.type === 'storm') {
          const at = v.project(e.x, 1.4, e.z);
          floatText('−★', at.x, at.y, 'bad');
          root.current?.classList.remove('lost-star');
          void root.current?.offsetWidth;
          root.current?.classList.add('lost-star');
        } else if (e.type === 'burst') {
          const at = v.project(e.x, 1.2, e.z);
          floatText('0', at.x, at.y, 'goo');
        } else if (e.type === 'wrong' && e.player === session.you) {
          try {
            navigator.vibrate?.([30, 40, 30]);
          } catch {
            /* No haptics. */
          }
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.visualViewport?.removeEventListener('resize', measure);
      v.dispose();
      view.current = null;
    };
    // The view is rebuilt for a new night (its room differs).
  }, [session, round, floatText, flyCoins, onNight, showFailure]);
  useEffect(() => {
    touchRef.current = touch;
    remeasure.current();
  }, [touch]);

  useResultsFeedback('diner', hud.phase === 'over', results, 0);

  const register = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) elements.current.set(key, el);
    else elements.current.delete(key);
  }, []);

  const open = () => {
    setStarted(true);
    session.start();
    audio.current?.startMusic(session.night);
  };
  const again = (night?: NightId) => {
    setResults(false);
    setRecord(null);
    if (session.kind === 'solo') setStarted(false);
    session.again(night);
  };

  const look = lookFor(hint.use);
  const m = session.match;
  const night = nights[m.night];
  const nextNight = m.night < 3 ? ((m.night + 1) as NightId) : null;
  const waiting = online && room?.status === 'waiting';
  const ready = hud.phase === 'ready';
  const won = hud.medals > 0 && hud.stars > 0;
  const coinsBar = (
    <span
      className="diner-coins-meter"
      style={
        { '--fill': Math.min(1, hud.coins / hud.targets[2]) } as CSSProperties
      }
    >
      <i className="diner-coins-track">
        <i className="diner-coins-fill" />
        {hud.targets.map((t, i) => (
          <i
            key={i}
            className={`diner-medal-tick m${i} ${hud.coins >= t ? 'on' : ''}`}
            style={{ '--at': t / hud.targets[2] } as CSSProperties}
          />
        ))}
      </i>
    </span>
  );
  const stars = (
    <span className="diner-stars" aria-label={`${hud.stars} stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i < hud.stars ? 'on' : ''}>
          <DinerIcon name="star" />
        </i>
      ))}
    </span>
  );

  return (
    <div
      ref={root}
      className="diner-game at-table"
      data-touch={touch ? 'true' : 'false'}
      data-night={m.night}
      data-phase={hud.phase}
    >
      <div ref={stage} className="diner-stage">
        <canvas
          key={round}
          ref={canvas}
          className="diner-canvas"
          aria-label={`The diner, night ${m.night}: ${night.name}`}
        />
        <div className="diner-bubbles" aria-hidden="true">
          {items.map((b) => (
            <BubbleView key={b.key} b={b} register={register} />
          ))}
        </div>
        <div ref={fxLayer} className="diner-fx" aria-hidden="true" />
      </div>

      <div ref={top} className="diner-top">
        <div className="diner-top-left">
          <button
            type="button"
            className="diner-round-button"
            aria-label="Leave the diner"
            onClick={() => setPanel('leave')}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span className="diner-title">Diner</span>
        </div>
        <output
          className="diner-clock"
          data-urgent={
            hud.phase === 'open' && hud.seconds <= 20 ? 'true' : 'false'
          }
          aria-label={`${time(hud.seconds)} left`}
        >
          <span key={hud.seconds <= 10 ? hud.seconds : 'calm'}>
            {time(hud.seconds)}
          </span>
        </output>
        <div className="diner-top-right">
          {room?.link === 'lost' && (
            <output className="diner-offline" aria-label="Reconnecting">
              <WifiOff aria-hidden="true" />
            </output>
          )}
          <span className="diner-hud-stats">
            <span className="diner-coins" aria-label={`${hud.coins} coins`}>
              <span ref={coinTarget} className="diner-coin-icon">
                <DinerIcon name="coin" />
              </span>
              <b data-game-motion="change" data-game-motion-key={hud.coins}>
                {hud.coins}
              </b>
              {coinsBar}
            </span>
            {stars}
          </span>
          <GameMenu
            name="Diner"
            theme="diner"
            open={panel === 'menu'}
            onOpenChange={(o) => setPanel(o ? 'menu' : null)}
            triggerClassName="diner-round-button diner-menu-trigger"
            triggerLabel={session.canPause ? 'Pause' : 'Menu'}
            trigger={
              session.canPause ? (
                <Pause aria-hidden="true" />
              ) : (
                <Settings2 aria-hidden="true" />
              )
            }
            onResume={session.canPause ? () => {} : undefined}
            onRules={() => setPanel('rules')}
            items={
              session.kind === 'solo'
                ? [
                    {
                      label: 'Restart',
                      icon: RotateCcw,
                      onSelect: () => again(),
                    },
                  ]
                : []
            }
            sound={sound}
            onLeave={() => setPanel('leave')}
          />
        </div>
      </div>

      {online && room && (
        <ul className="diner-badges" aria-label="Waiters">
          {room.seats.map((s, i) => (
            <li
              key={i}
              style={{ '--seat': SEAT_COLOURS[i] } as CSSProperties}
              data-away={!s.connected}
            >
              <i />
              <span>{s.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div ref={pad} className="diner-pad">
        <div className="diner-pad-stats">
          <span className="diner-coins" aria-hidden="true">
            <span ref={coinTargetPhone} className="diner-coin-icon">
              <DinerIcon name="coin" />
            </span>
            <b>{hud.coins}</b>
            {coinsBar}
          </span>
          {stars}
        </div>
        <Joystick stick={stick} disabled={panel !== null} />
        <div className="diner-buttons">
          {hasMimics(m) && (
            <button
              type="button"
              className="diner-out"
              data-armed={hint.out ? 'true' : 'false'}
              aria-label="Out! Throw out the guest you face"
              onPointerDown={(e) => {
                e.preventDefault();
                press('out');
              }}
              onClick={(e) => {
                if (e.detail === 0) press('out');
              }}
            >
              <DinerIcon name="out" />
              <span>Out!</span>
            </button>
          )}
          <button
            type="button"
            className="diner-use"
            data-armed={hint.use ? 'true' : 'false'}
            aria-label={`Use: ${look.word}`}
            onPointerDown={(e) => {
              e.preventDefault();
              press('use');
            }}
            onClick={(e) => {
              if (e.detail === 0) press('use');
            }}
          >
            <span key={look.icon + look.word} className="diner-use-face">
              <DinerIcon name={look.icon} />
              <span>{look.word}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Before the doors open: the night and its medals. */}
      {ready && !started && panel === null && !error && (
        <div className="diner-plate-wrap">
          <section
            className="diner-plate intro"
            aria-label={`Night ${m.night}`}
          >
            <p className="diner-plate-night">Night {m.night}</p>
            <h2>{night.name}</h2>
            <ul className="diner-targets">
              {hud.targets.map((t, i) => (
                <li key={i} className={`m${i}`}>
                  <i className="diner-medal" />
                  <b>{t}</b>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="diner-button"
              data-starts-game
              onClick={open}
            >
              Open
            </button>
          </section>
        </div>
      )}
      {waiting && room && (
        <div className="diner-plate-wrap">
          <section className="diner-plate intro" aria-label="Waiters">
            <p className="diner-plate-night">Night {m.night}</p>
            <h2>{night.name}</h2>
            <ul className="diner-waiters">
              {room.seats.map((s, i) => (
                <li
                  key={i}
                  style={{ '--seat': SEAT_COLOURS[i] } as CSSProperties}
                  data-ready={s.connected}
                >
                  <i />
                  <span>{s.name}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {hud.countdown > 0 && (
        <output
          key={hud.countdown}
          className="diner-countdown"
          aria-label={`${hud.countdown}`}
        >
          {hud.countdown}
        </output>
      )}

      {results && (
        <div className="diner-plate-wrap results">
          <section
            className="diner-plate results"
            aria-label="Results"
            aria-live="polite"
          >
            <WinnerCelebration won={won && hud.medals === 3} />
            <p className="diner-plate-night">
              Night {m.night} · {night.name}
            </p>
            <h2>
              {hud.stars <= 0
                ? 'Closed'
                : hud.medals === 3
                  ? 'Perfect'
                  : hud.medals
                    ? 'Well done'
                    : 'Closed'}
            </h2>
            <ul className="diner-medals" aria-label={`${hud.medals} medals`}>
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className={`m${i} ${i < hud.medals ? 'won' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                >
                  <i className="diner-medal" />
                  <b>{hud.targets[i]}</b>
                </li>
              ))}
            </ul>
            <div className="diner-result-row">
              <span className="diner-coins big">
                <DinerIcon name="coin" />
                <b>{hud.coins}</b>
                {record?.best && <em>Best</em>}
              </span>
              {stars}
            </div>
            <ul className="diner-result-stats">
              <li>
                <DinerIcon name="burger" />
                <b>{m.stats.served}</b>
              </li>
              {m.night > 1 && (
                <li className="goo">
                  <DinerIcon name="out" />
                  <b>{m.stats.caught}</b>
                </li>
              )}
            </ul>
            <div className="diner-result-actions">
              {session.host && (
                <button
                  type="button"
                  className="diner-button"
                  data-starts-game
                  onClick={() => again()}
                >
                  <RotateCcw aria-hidden="true" /> Again
                </button>
              )}
              {session.host && nextNight && hud.medals > 0 && (
                <button
                  type="button"
                  className="diner-button"
                  data-starts-game
                  onClick={() => again(nextNight)}
                >
                  Night {nextNight}
                </button>
              )}
              <button
                type="button"
                className="diner-button quiet"
                onClick={onExit}
              >
                {online ? 'Table' : 'Games'}
              </button>
            </div>
          </section>
        </div>
      )}

      {error && (
        <div className="diner-plate-wrap">
          <section className="diner-plate" role="alert">
            <p>{error}</p>
            <button type="button" className="diner-button" onClick={onExit}>
              Back
            </button>
          </section>
        </div>
      )}

      <Dialog
        open={panel === 'rules' || panel === 'leave'}
        onOpenChange={(o) => !o && setPanel(null)}
      >
        <DialogContent
          className={`modal diner-modal ${panel === 'rules' ? 'diner-rules-modal' : ''}`}
        >
          {panel === 'rules' ? (
            <>
              <DialogTitle>How to play</DialogTitle>
              <DialogDescription className="sr-only">
                Rules of Diner
              </DialogDescription>
              <DinerRules />
              <button
                type="button"
                className="diner-button"
                onClick={() => setPanel(null)}
              >
                {ready && !started ? 'Got it' : 'Resume'}
              </button>
            </>
          ) : panel === 'leave' ? (
            <>
              <DialogTitle>Leave the diner?</DialogTitle>
              <DialogDescription>
                {leaveNote ??
                  (online
                    ? 'Your waiter waits by the counter until you come back.'
                    : 'This shift ends when you leave. Your medals are kept.')}
              </DialogDescription>
              <button type="button" className="diner-button" onClick={onExit}>
                <LogOut aria-hidden="true" /> Leave
              </button>
              <button
                type="button"
                className="diner-button quiet"
                onClick={() => setPanel(null)}
              >
                Keep playing
              </button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={room?.link === 'gone'}>
        <DialogContent className="modal diner-modal" showCloseButton={false}>
          <DialogTitle>The diner has closed</DialogTitle>
          <DialogDescription className="sr-only">
            This online room no longer exists.
          </DialogDescription>
          <button type="button" className="diner-button" onClick={onExit}>
            <LogOut aria-hidden="true" /> Back
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
