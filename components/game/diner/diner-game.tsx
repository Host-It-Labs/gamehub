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
  Heart,
  Layers,
  LogOut,
  Pause,
  RotateCcw,
  Settings2,
  Trophy,
  WifiOff,
  Wrench,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { dishes, nights, stationDish } from '@/lib/games/diner/content';
import {
  clock,
  hasMimics,
  matchEffects,
  medalsFor,
  cookSeconds,
  burnSeconds,
  isRush,
  powerOnline,
  stationSlots,
  campaignShiftWon,
  eatSeconds,
  outTarget,
  actionFor,
  type DinerEvent,
  type Match,
  type UseAction,
} from '@/lib/games/diner/engine';
import { COUNTER_X, QUEUE } from '@/lib/games/diner/layout';
import { GameMenu } from '../game-menu';
import { Rules, RuleSection } from '../rules';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBadgeFit } from '../use-fit';
import { recordCompletedGame } from '../play-experience';
import { useResultsFeedback, WinnerCelebration } from '../results-feedback';
import { Pacer, ladder } from '../render-pacer';
import { floorAt, nativeRatio, startLevel } from '../render-quality';
import { DinerRules } from './diner-rules';
import { recordLevel } from './diner-store';
import { CHAPTERS, LEVEL_COUNT, levelById } from '@/lib/games/diner/levels';
import { PLACES } from '@/lib/games/diner/road';
import { DinerLandscape } from './diner-landscape';
import { KIT_NOTES, noteFor, TROUBLE_NOTES, troubleNote } from './level-notes';
import { DinerIcon, type IconName } from './icons';
import { Joystick, type Stick } from './joystick';
import { SEAT_COLOURS } from './seats';
import type { Controls, Session } from './session';
import { DinerSound } from './sound';
import { DinerView } from './view';
import { NIGHT_PLACE, type CarUpgrades } from './stage-contract';
import './diner.css';
import './diner-hud.css';

/** What the online room adds around a shift. */
export type RoomInfo = {
  status: 'waiting' | 'playing' | 'over';
  seats: { name: string; connected: boolean }[];
  link: 'live' | 'lost' | 'gone';
};

/** Campaign-only information about the stop being played. */
export type CampaignShiftInfo = {
  /** Stops driven, counting this one. */
  stop: number;
  title: string;
  place: string;
  boss: boolean;
  /** The trouble this shift brings, as short names. */
  troubles: string[];
  /** What finishing pays, in words. */
  reward: string | null;
};
/** What the run made of the shift, once it is banked. */
export type CampaignShiftResult = {
  survived: boolean;
  banked: number;
  lost: number;
  lives: number;
  tokens: number;
  reward: string | null;
};

type Hud = {
  seconds: number;
  coins: number;
  stars: number;
  phase: Match['phase'];
  countdown: number;
  medals: number;
  targets: [number, number, number];
  rush: boolean;
  power: boolean;
  goalProgress: string;
  held: string;
};
const readHud = (m: Match): Hud => ({
  seconds: Math.ceil(clock(m)),
  coins: m.coins,
  stars: m.stars,
  phase: m.phase,
  countdown: m.countdown > 0 ? Math.ceil(m.countdown / 30) : 0,
  medals: medalsFor(m),
  targets: m.targets,
  rush: isRush(m),
  power: powerOnline(m),
  goalProgress: `${m.stats.served},${m.stats.caught},${m.stats.burnt},${m.activity?.repairs ?? 0},${m.activity?.vipServed ?? 0}`,
  held: '',
});
const sameHud = (a: Hud, b: Hud) =>
  a.seconds === b.seconds &&
  a.coins === b.coins &&
  a.stars === b.stars &&
  a.phase === b.phase &&
  a.countdown === b.countdown &&
  a.medals === b.medals &&
  a.rush === b.rush &&
  a.power === b.power &&
  a.goalProgress === b.goalProgress &&
  a.held === b.held &&
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
    case 'repair':
      return { icon: 'repair', word: 'Fix' };
    case 'put':
      return { icon: a.dish ?? 'burger', word: 'Shelve' };
    case 'pick':
      return { icon: a.dish ?? 'burger', word: 'Take' };
    case 'pot':
    case 'refill':
      return { icon: 'coffee', word: a.kind === 'pot' ? 'Coffee' : 'Refill' };
    case 'stow':
      return { icon: 'coffee', word: 'Put back' };
    case 'pour':
      return { icon: 'coffee', word: 'Pour' };
    case 'juke':
      return { icon: 'music', word: 'Play' };
  }
}

/** What your hands hold, as pictures beside the Use button. */
function heldIcons(
  m: Match,
  you: number,
): { icon: IconName; burnt?: boolean }[] {
  const p = m.players[you];
  if (!p) return [];
  return p.hands.map((i) =>
    i.k === 'dish'
      ? { icon: i.dish as IconName, burnt: i.burnt }
      : i.k === 'dirty'
        ? { icon: 'dirty' as IconName }
        : { icon: 'coffee' as IconName },
  );
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
  seat?: number;
  colour?: string;
  /** Continuous values set straight on the element. */
  patience?: number;
  progress?: number;
  at: [number, number, number];
  demanding?: boolean;
  lanes?: { state: string; progress: number }[];
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
        progress:
          g.state === 'eat'
            ? Math.min(1, g.t / (eatSeconds(m) * 30))
            : undefined,
        demanding: g.demanding,
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
      demanding: g.demanding,
      at: [cx, g.state === 'queue' ? 0.95 : 1.9, cz],
    });
  }
  for (const s of m.stations) {
    const dish = stationDish[s.id];
    const total = cookSeconds(m, s.id) * 30;
    const burn = burnSeconds(m, s.id);
    const lanes = stationSlots(s).map((lane) => ({
      state:
        lane.state === 'ready' && burn !== null && lane.t > burn * 15
          ? 'smoking'
          : lane.state,
      progress:
        lane.state === 'cook'
          ? 1 - lane.t / Math.max(1, total)
          : lane.state === 'ready' && burn !== null
            ? 1 - lane.t / (burn * 30)
            : 1,
    }));
    const smoking = lanes.some((lane) => lane.state === 'smoking');
    const state = s.jam
      ? 'jam'
      : lanes.some((lane) => lane.state === 'burnt')
        ? 'burnt'
        : smoking
          ? 'smoking'
          : lanes.some((lane) => lane.state === 'ready')
            ? 'ready'
            : lanes.some((lane) => lane.state === 'cook')
              ? 'cook'
              : 'idle';
    out.push({
      key: `s${s.id}`,
      kind: 'station',
      state,
      sig: `${lanes.map((lane) => lane.state).join(',')}|${s.jam ?? 0}`,
      icons: [{ name: s.jam ? 'repair' : dish }],
      // Pictures only: a jam shows how many taps are left.
      label: s.jam ? String(s.jam) : undefined,
      lanes: s.jam ? undefined : lanes,
      // High in the hatch, under the striped valance: clear of the top bar.
      at: [COUNTER_X[s.id], 2.12, 1.1],
    });
  }
  for (const id of ['sink', 'bin'] as const)
    out.push({
      key: `s${id}`,
      kind: 'station',
      state: 'utility',
      sig: id,
      icons: [{ name: id === 'sink' ? 'wash' : 'bin' }],
      at: [COUNTER_X[id], 2.12, 1.1],
    });
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
        seat: i + 1,
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
      data-demanding={!!b.demanding}
      style={b.colour ? ({ '--seat': b.colour } as CSSProperties) : undefined}
    >
      {b.kind === 'name' ? (
        <span className="diner-name" aria-label={b.label}>
          {b.seat}
        </span>
      ) : b.kind === 'queue' ? (
        <span className="diner-mood">
          <i className="diner-mood-face">
            <DinerIcon name="heart" />
          </i>
          {b.demanding && <DinerIcon name="star" />}
          <b>{b.label}</b>
        </span>
      ) : (
        <span className="diner-bubble-body">
          {b.kind === 'table' && b.patience !== undefined && (
            <i className="diner-patience" />
          )}
          {b.demanding && (
            <span className="diner-vip-mark">
              <DinerIcon name="star" />
            </span>
          )}
          {b.lanes ? (
            <span className="diner-station-lanes">
              {b.lanes.map((lane, i) => (
                <span
                  key={i}
                  className="diner-station-lane"
                  data-state={lane.state}
                  style={{ '--lane-fill': lane.progress } as CSSProperties}
                >
                  <DinerIcon
                    name={lane.state === 'burnt' ? 'burnt' : b.icons[0].name}
                  />
                </span>
              ))}
            </span>
          ) : (
            b.icons.map((icon, i) => (
              <span
                key={i}
                className={`diner-bubble-icon ${icon.done ? 'done' : ''}`}
              >
                <DinerIcon name={icon.name} />
              </span>
            ))
          )}
          {b.label && <b className="diner-bubble-label">{b.label}</b>}
          {b.kind === 'station' &&
            b.progress !== undefined &&
            b.state !== 'idle' && <i className="diner-ring" />}
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
  onLevel,
  onLevels,
  leaveNote,
  campaign,
  campaignResult,
  upgrades,
  equipment,
  onCheckpoint,
  onShiftEnd,
  onResultsContinue,
}: {
  session: Session;
  volume: number;
  music: number;
  sound: ReactNode;
  room?: RoomInfo;
  learn?: boolean;
  onExit: () => void;
  /** Solo free play: a level's shift ended (its medals are kept on the device). */
  onLevel?: (level: number) => void;
  /** Free play: back to the grid of levels. */
  onLevels?: () => void;
  leaveNote?: string;
  campaign?: CampaignShiftInfo;
  campaignResult?: CampaignShiftResult | null;
  /** What the Workshop shows on the car and patio. */
  upgrades?: CarUpgrades;
  equipment?: ReactNode;
  onCheckpoint?: (match: Match) => void;
  onShiftEnd?: (match: Match) => void;
  onResultsContinue?: () => void;
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
  const badges = useRef<HTMLUListElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const fxLayer = useRef<HTMLDivElement>(null);
  const coinTarget = useRef<HTMLSpanElement>(null);
  const coinTargetPhone = useRef<HTMLSpanElement>(null);
  const view = useRef<DinerView | null>(null);
  const audio = useRef<DinerSound | null>(null);
  const stick = useRef<Stick>({ x: 0, z: 0 });
  const keys = useRef(new Set<string>());
  const controls = useRef<Controls>({
    mx: 0,
    mz: 0,
    use: false,
    out: false,
    dash: false,
  });
  const modalOrigin = useRef<HTMLElement | null>(null);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const [hud, setHud] = useState<Hud>(() => readHud(session.match));
  const [hint, setHint] = useState<{ use: UseAction | null; out: boolean }>({
    use: null,
    out: false,
  });
  const [items, setItems] = useState<Bubble[]>([]);
  const [panel, setPanel] = useState<
    'menu' | 'rules' | 'equipment' | 'progress' | null
  >(learn ? 'rules' : null);
  // Results belong to the round they were shown for: a new round (the host
  // pressed Again online) never inherits the previous round's results.
  const [resultsRound, setResultsRound] = useState<number | null>(null);
  const results = resultsRound === round;
  const [error, setError] = useState('');
  const [touch, setTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
  );
  const [started, setStarted] = useState(
    session.kind === 'online' || session.match.phase !== 'ready',
  );
  const [record, setRecord] = useState<{
    best: boolean;
    opened: number | null;
  } | null>(null);
  const paused = useRef(false);
  const touchRef = useRef(touch);
  const remeasure = useRef<() => void>(() => {});
  const levels = useRef({ volume, music });
  const online = session.kind === 'online';
  useBadgeFit(badges);
  const leave = useLeaveDialog(async () => {
    onCheckpoint?.(session.match);
  });
  const askLeave = leave.ask;
  const showPanel = (next: 'rules' | 'equipment' | 'progress') => {
    modalOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanel(next);
  };

  useEffect(() => {
    const save = () => onCheckpoint?.(session.match);
    const visibility = () => {
      if (document.hidden) save();
    };
    const request = (event: Event) => {
      const allow = (event as CustomEvent<{ allow?: () => void }>).detail
        ?.allow;
      askLeave(() => {
        save();
        allow?.();
        onExit();
      });
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('diner-request-leave', request);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('diner-request-leave', request);
    };
  }, [session, onCheckpoint, onExit, askLeave]);

  useEffect(() => {
    paused.current =
      session.canPause &&
      (panel !== null ||
        leave.open ||
        (!started && session.match.phase === 'ready'));
    if (panel !== null || leave.open) {
      keys.current.clear();
      controls.current.mx = controls.current.mz = 0;
      controls.current.use =
        controls.current.out =
        controls.current.dash =
          false;
    }
    audio.current?.pause(paused.current);
  }, [panel, session, started, leave.open]);

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
    (which: 'use' | 'out' | 'dash') => {
      controls.current[which] = true;
      audio.current?.startMusic(session.match.night);
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
      if (panel || leave.open || results || !started) return;
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
        // A focused button keeps its own Space and Enter.
        if (k !== 'e' && (e.target as HTMLElement)?.closest?.('button')) return;
        e.preventDefault();
        press('use');
      } else if ((k === 'q' || k === 'x') && !e.repeat) {
        e.preventDefault();
        press('out');
      } else if (k === 'shift' && !e.repeat) {
        e.preventDefault();
        press('dash');
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
  }, [panel, press, leave.open, results, started]);

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
      const fx = matchEffects(m0);
      v = new DinerView(el, {
        night: m0.night,
        place: m0.config?.place ?? NIGHT_PLACE[m0.night],
        tables: m0.tables.map((t) => t.slot),
        stations: m0.stations.map((s) => s.id),
        players: m0.players.length,
        pixelRatio: nativeRatio(),
        upgrades: upgrades ?? {},
        grillLanes: fx.grillLanes,
        pass: fx.pass,
        coffee: fx.coffee,
        skates: fx.dash,
      });
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
      // A sideways phone: the top bar floats over the trailer's roof and the
      // controls over the deck's planter corners, so play takes the screen.
      const short = Math.min(s.width, s.height) < 500;
      const below = bar ? Math.max(0, bar.bottom - s.top) : 56;
      const badgeRoom = online ? 26 : 0;
      v.resize(
        short
          ? {
              width: s.width,
              height: s.height,
              top: 26 + badgeRoom,
              bottom: 4,
              left: 6,
              right: 6,
            }
          : {
              width: s.width,
              height: s.height,
              top: below + 2 + badgeRoom,
              bottom: touchRef.current ? 8 : 50,
              left: 12,
              right: 12,
            },
      );
    };
    measure();
    remeasure.current = measure;
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    if (top.current) ro.observe(top.current);
    window.visualViewport?.addEventListener('resize', measure);
    // Native density on top; never under the 1.2× the diner always kept.
    const rungs = ladder(2048, floorAt(1.2));
    const pacer = new Pacer(
      rungs,
      (rung) => v.setRung(rung),
      startLevel(rungs, window.innerWidth, window.innerHeight),
    );
    if (pacer.level) v.setRung(pacer.rung);
    let raf = 0;
    let last = performance.now();
    let prevHud: Hud | null = null;
    let prevHint = '';
    let prevSig = '';
    let resultsAt = 0;
    let recorded = false;
    let savedTick = 0;
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
      if (onCheckpoint && m.phase === 'open' && m.tick >= savedTick + 120) {
        savedTick = m.tick;
        onCheckpoint(m);
      }
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
      h.held = heldIcons(m, session.you)
        .map((i) => `${i.icon}${i.burnt ? '!' : ''}`)
        .join(',');
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
        b.lanes?.forEach((lane, i) => {
          (
            node.querySelectorAll('.diner-station-lane')[i] as
              | HTMLElement
              | undefined
          )?.style.setProperty('--lane-fill', lane.progress.toFixed(3));
        });
      }
      if (m.phase === 'over') {
        if (!recorded) {
          recorded = true;
          recordCompletedGame('Diner');
          if (session.kind === 'solo' && session.level) {
            const r = recordLevel(session.level, m.medals, m.coins);
            setRecord({ best: r.best, opened: r.opened });
            onLevel?.(session.level);
          }
          onShiftEnd?.(m);
          resultsAt = now + 1300;
        }
        if (resultsAt > 0 && now >= resultsAt) {
          resultsAt = -1;
          setResultsRound(session.round);
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
          floatText('−1 ♥', at.x, at.y, 'bad');
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
      if (process.env.NODE_ENV === 'development')
        delete (window as unknown as { dinerDebug?: unknown }).dinerDebug;
    };
    // The view is rebuilt for a new night (its room differs).
  }, [
    session,
    round,
    floatText,
    flyCoins,
    onLevel,
    showFailure,
    onCheckpoint,
    onShiftEnd,
    campaign,
    online,
    upgrades,
  ]);
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
    onCheckpoint?.(session.match);
    audio.current?.startMusic(session.match.night);
  };
  const again = (next?: number) => {
    setResultsRound(null);
    setRecord(null);
    if (session.kind === 'solo') setStarted(false);
    session.again(next);
  };

  const look = lookFor(hint.use);
  const m = session.match;
  const held = heldIcons(m, session.you);
  const effects = matchEffects(m);
  const handSlots = Math.max(effects.hands, held.length);
  const canDash = effects.dash;
  const level = session.level ? levelById(session.level) : null;
  const title = m.config?.title ?? nights[m.night].name;
  const kicker = campaign
    ? `Stop ${campaign.stop}${campaign.boss ? ' · Boss' : ''}`
    : level
      ? `Level ${level.id}${level.boss ? ' · Boss' : ''}`
      : '';
  const nextLevel =
    level && hud.medals > 0 && hud.stars > 0 && level.id < LEVEL_COUNT
      ? level.id + 1
      : null;
  const waiting = online && room?.status === 'waiting';
  const ready = hud.phase === 'ready';
  const won = campaign ? campaignShiftWon(m) : hud.medals > 0 && hud.stars > 0;
  const outcome = campaign ? campaignResult : null;
  const blocked = panel !== null || leave.open || !started || results;
  const notes = level
    ? level.novelties.map(noteFor)
    : (campaign?.troubles ?? []).map(troubleNote);
  const kit = level
    ? level.kit.filter(
        (k) => !level.novelties.some((n) => n.kind === 'kit' && n.kit === k),
      )
    : [];
  // Trouble already met on earlier levels, still on tonight.
  const tonight = level
    ? level.troubles
        .filter(
          (t) =>
            !level.novelties.some(
              (n) => n.kind === 'trouble' && n.trouble === t,
            ),
        )
        .map((t) => TROUBLE_NOTES[t])
    : [];
  const pressHandlers = (which: 'use' | 'out' | 'dash') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      press(which);
    },
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) press(which);
    },
  });
  const medalTrack = (
    <span className="diner-meter" aria-hidden="true">
      <span
        className="diner-meter-fill"
        style={
          {
            '--fill': Math.min(1, hud.coins / Math.max(1, hud.targets[2])),
          } as CSSProperties
        }
      />
      {hud.targets.map((t, i) => (
        <i
          key={i}
          className={`m${i}`}
          data-on={hud.coins >= t}
          style={{ '--at': t / Math.max(1, hud.targets[2]) } as CSSProperties}
        />
      ))}
    </span>
  );

  return (
    <DinerLandscape>
      <div
        ref={root}
        className="diner-game at-table"
        data-touch={touch ? 'true' : 'false'}
        data-night={m.night}
        data-phase={hud.phase}
        data-campaign={!!campaign}
        data-power={hud.power ? 'on' : 'off'}
        data-rush={hud.rush}
      >
        <div ref={stage} className="diner-stage">
          <canvas
            key={round}
            ref={canvas}
            className="diner-canvas"
            aria-label={`The diner: ${kicker ? `${kicker}, ` : ''}${title}`}
          />
          <div className="diner-vignette" aria-hidden="true" />
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
              onClick={() => leave.ask()}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <span className="diner-title">Diner</span>
            {kicker && (
              <span
                className="diner-ticket"
                data-boss={!!(level?.boss || campaign?.boss)}
              >
                <b>{level ? level.id : campaign?.stop}</b>
                <span>{title}</span>
              </span>
            )}
          </div>
          <div className="diner-top-centre">
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
            {(hud.rush || !hud.power) && (
              <output
                className="diner-service-light"
                aria-label={hud.rush ? 'Rush wave' : 'Power out'}
              >
                <DinerIcon name={hud.rush ? 'bell' : 'bolt'} />
                {hud.rush ? 'Rush' : 'Brownout'}
              </output>
            )}
          </div>
          <div className="diner-top-right">
            {room?.link === 'lost' && (
              <output className="diner-offline" aria-label="Reconnecting">
                <WifiOff aria-hidden="true" />
              </output>
            )}
            <button
              type="button"
              className="diner-hud-stats"
              aria-label={`${hud.coins} coins, ${hud.medals} medals, ${hud.stars} lives. Shift goals`}
              onClick={(e) => {
                modalOrigin.current = e.currentTarget;
                setPanel('progress');
              }}
            >
              <span className="diner-coins">
                <span ref={coinTarget} className="diner-coin-icon">
                  <DinerIcon name="coin" />
                </span>
                <b data-game-motion="change" data-game-motion-key={hud.coins}>
                  {hud.coins}
                </b>
              </span>
              {medalTrack}
              <span className="diner-lives">
                <Heart aria-hidden="true" />
                <b>{hud.stars}</b>
              </span>
            </button>
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
              onRules={() => showPanel('rules')}
              items={[
                ...(campaign && equipment
                  ? [
                      {
                        label: 'Equipment',
                        icon: Wrench,
                        onSelect: () => showPanel('equipment'),
                      },
                    ]
                  : []),
                ...(session.kind === 'solo' && !campaign
                  ? [
                      {
                        label: 'Restart',
                        icon: RotateCcw,
                        onSelect: () => again(),
                      },
                    ]
                  : []),
                ...(onLevels
                  ? [
                      {
                        label: 'Levels',
                        icon: Layers,
                        onSelect: () => onLevels(),
                      },
                    ]
                  : []),
              ]}
              sound={sound}
              extra={
                <button type="button" onClick={() => showPanel('progress')}>
                  <Trophy aria-hidden="true" />
                  Shift goals
                </button>
              }
              onLeave={() => leave.ask()}
            />
          </div>
        </div>

        {online && room && (
          <ul ref={badges} className="diner-badges" aria-label="Waiters">
            {room.seats.map((s, i) => (
              <li
                key={i}
                style={{ '--seat': SEAT_COLOURS[i] } as CSSProperties}
                data-away={!s.connected}
                aria-label={`Waiter ${i + 1}: ${s.name}${s.connected ? '' : ', away'}`}
              >
                <i />
                <b className="diner-badge-seat" aria-hidden="true">
                  {i + 1}
                </b>
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Touch: the stick on the left, the buttons on the right, over the
          deck's two planter corners. Keys: a slim strip at the bottom. */}
        <div ref={pad} className="diner-pad">
          <Joystick stick={stick} disabled={blocked} />
          <div className="diner-actions">
            <output
              className="diner-hands"
              data-count={held.length}
              aria-label={
                held.length
                  ? `Holding ${held.map((i) => i.icon).join(', ')}`
                  : 'Hands free'
              }
            >
              {Array.from({ length: handSlots }, (_, i) => (
                <span key={i} data-burnt={held[i]?.burnt ? 'true' : undefined}>
                  {held[i] && <DinerIcon name={held[i].icon} />}
                </span>
              ))}
            </output>
            {canDash && (
              <button
                type="button"
                className="diner-dash"
                aria-label="Dash"
                disabled={blocked}
                {...pressHandlers('dash')}
              >
                <DinerIcon name="skate" />
                <kbd>Shift</kbd>
              </button>
            )}
            {hasMimics(m) && (
              <button
                type="button"
                className="diner-out"
                data-armed={hint.out ? 'true' : 'false'}
                aria-label="Out! Throw out the guest you face"
                disabled={blocked}
                {...pressHandlers('out')}
              >
                <DinerIcon name="out" />
                <span>Out!</span>
                <kbd>Q</kbd>
              </button>
            )}
            <button
              type="button"
              className="diner-use"
              data-armed={hint.use ? 'true' : 'false'}
              aria-label={`Use: ${look.word}${hint.use?.dish ? ` ${dishes[hint.use.dish].name}` : ''}`}
              disabled={blocked}
              {...pressHandlers('use')}
            >
              <span key={look.icon + look.word} className="diner-use-face">
                <DinerIcon name={look.icon} />
                <span>{look.word}</span>
              </span>
              <kbd>Space</kbd>
            </button>
          </div>
        </div>

        {/* Before the doors open: what this shift brings, your kit, the medals. */}
        {ready && !started && panel === null && !error && (
          <div className="diner-plate-wrap">
            <section className="diner-plate intro" aria-label={kicker || title}>
              <div className="diner-intro-head">
                {kicker && <p className="diner-plate-night">{kicker}</p>}
                <h2>{title}</h2>
                {(level || (campaign && campaign.place !== title)) && (
                  <p className="diner-intro-place">
                    {level
                      ? CHAPTERS[level.chapter].name ===
                        PLACES[level.place].name
                        ? PLACES[level.place].name
                        : `${CHAPTERS[level.chapter].name} · ${PLACES[level.place].name}`
                      : campaign!.place}
                  </p>
                )}
              </div>
              <div className="diner-intro-body">
                {notes.length > 0 && (
                  <ul
                    className="diner-notes"
                    aria-label={level ? 'New tonight' : 'This shift'}
                  >
                    {notes.map((n) => (
                      <li key={n.title}>
                        <DinerIcon name={n.icon} />
                        <span>
                          <strong>{n.title}</strong>
                          {n.line && <small>{n.line}</small>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="diner-intro-side">
                  {tonight.length > 0 && (
                    <ul className="diner-tonight" aria-label="Also tonight">
                      {tonight.map((n) => (
                        <li key={n.title}>
                          <DinerIcon name={n.icon} />
                          {n.title}
                        </li>
                      ))}
                    </ul>
                  )}
                  {kit.length > 0 && (
                    <div className="diner-kit" aria-label="Your kit">
                      <p className="diner-plate-night">Your kit</p>
                      <ul>
                        {kit.map((k) => (
                          <li key={k} title={KIT_NOTES[k].line}>
                            <DinerIcon name={KIT_NOTES[k].icon} />
                            <span>{KIT_NOTES[k].title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ul
                    className="diner-targets"
                    aria-label="Medal goals in coins"
                  >
                    {hud.targets.map((t, i) => (
                      <li key={i} className={`m${i}`}>
                        <i className="diner-medal" aria-hidden="true" />
                        <strong>{['Bronze', 'Silver', 'Gold'][i]}</strong>
                        <b>{t}</b>
                      </li>
                    ))}
                  </ul>
                  {level && (
                    <p className="diner-intro-goal">
                      Finish with a medal to open the next level.
                    </p>
                  )}
                  {campaign?.reward && (
                    <p className="diner-shift-reward">{campaign.reward}</p>
                  )}
                  <div className="diner-result-actions">
                    <button
                      type="button"
                      className="diner-button"
                      data-starts-game
                      onClick={open}
                    >
                      Open
                    </button>
                    {onLevels && (
                      <button
                        type="button"
                        className="diner-button quiet"
                        onClick={onLevels}
                      >
                        <Layers aria-hidden="true" /> Levels
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
        {waiting && room && (
          <div className="diner-plate-wrap">
            <section className="diner-plate intro" aria-label="Waiters">
              <p className="diner-plate-night">{kicker}</p>
              <h2>{title}</h2>
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
                {kicker ? `${kicker} · ${title}` : title}
              </p>
              <h2>
                {campaign
                  ? won
                    ? 'Made it'
                    : 'Out of lives'
                  : hud.stars <= 0
                    ? 'Out of lives'
                    : hud.medals === 3
                      ? 'Perfect'
                      : hud.medals
                        ? 'Well done'
                        : 'Not yet'}
              </h2>
              <ul className="diner-medals" aria-label={`${hud.medals} medals`}>
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className={`m${i} ${i < hud.medals ? 'won' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <i className="diner-medal" aria-hidden="true" />
                    <strong>{['Bronze', 'Silver', 'Gold'][i]}</strong>
                    <b>{hud.targets[i]}</b>
                  </li>
                ))}
              </ul>
              <div className="diner-result-row">
                <span className="diner-coins big">
                  <DinerIcon name="coin" />
                  <b>{outcome ? outcome.banked : hud.coins}</b>
                  {record?.best && <em>Best</em>}
                </span>
                <span className="diner-lives">
                  <Heart aria-hidden="true" />
                  <b>{hud.stars}</b>
                </span>
                {outcome && outcome.tokens > 0 && (
                  <span
                    className="diner-tokens"
                    aria-label={`${outcome.tokens} tokens`}
                  >
                    <DinerIcon name="token" />
                    <b>+{outcome.tokens}</b>
                  </span>
                )}
              </div>
              {outcome?.lost ? (
                <p className="diner-result-lost">
                  −{outcome.lost} {outcome.lost === 1 ? 'life' : 'lives'}
                </p>
              ) : null}
              {outcome?.survived && outcome.reward && (
                <p className="diner-shift-reward">{outcome.reward}</p>
              )}
              {record?.opened && (
                <p className="diner-shift-reward">
                  Level {record.opened} is open
                </p>
              )}
              {level && !won && (
                <p className="diner-result-lost">
                  A medal opens the next level
                </p>
              )}
              <div className="diner-result-actions">
                {campaign && onResultsContinue && (
                  <button
                    type="button"
                    className="diner-button"
                    onClick={onResultsContinue}
                  >
                    {won ? 'Drive on' : 'Workshop'}
                  </button>
                )}
                {session.host && !campaign && nextLevel && (
                  <button
                    type="button"
                    className="diner-button"
                    data-starts-game
                    onClick={() => again(nextLevel)}
                  >
                    Level {nextLevel}
                  </button>
                )}
                {session.host && !campaign && (
                  <button
                    type="button"
                    className={`diner-button ${nextLevel ? 'quiet' : ''}`}
                    data-starts-game
                    onClick={() => again()}
                  >
                    <RotateCcw aria-hidden="true" /> Again
                  </button>
                )}
                {onLevels ? (
                  <button
                    type="button"
                    className="diner-button quiet"
                    onClick={onLevels}
                  >
                    <Layers aria-hidden="true" /> Levels
                  </button>
                ) : (
                  !campaign && (
                    <button
                      type="button"
                      className="diner-button quiet"
                      onClick={onExit}
                    >
                      {online ? 'Table' : 'Games'}
                    </button>
                  )
                )}
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
          open={
            panel === 'rules' || panel === 'equipment' || panel === 'progress'
          }
          onOpenChange={(o) => !o && setPanel(null)}
        >
          <DialogContent
            className={`modal diner-modal ${panel === 'rules' ? 'diner-rules-modal' : 'diner-equipment-modal'}`}
            finalFocus={() =>
              modalOrigin.current?.isConnected &&
              modalOrigin.current.getClientRects().length
                ? modalOrigin.current
                : (root.current?.querySelector<HTMLButtonElement>(
                    '.diner-menu-trigger',
                  ) ?? null)
            }
          >
            {panel === 'rules' ? (
              <>
                <DialogTitle>How to play</DialogTitle>
                <DialogDescription className="sr-only">
                  Rules of Diner
                </DialogDescription>
                <DinerRules campaign={!!campaign} />
                <button
                  type="button"
                  className="diner-button"
                  onClick={() => setPanel(null)}
                >
                  {ready && !started ? 'Got it' : 'Resume'}
                </button>
              </>
            ) : panel === 'equipment' ? (
              <>
                <DialogTitle>Equipment</DialogTitle>
                <DialogDescription className="sr-only">
                  Your equipment for this run.
                </DialogDescription>
                {equipment}
              </>
            ) : panel === 'progress' ? (
              <>
                <DialogTitle>Your shift</DialogTitle>
                <DialogDescription className="sr-only">
                  Coins, lives and goals for this shift.
                </DialogDescription>
                <div className="diner-progress-summary">
                  <span>
                    <DinerIcon name="coin" />
                    <b>{hud.coins}</b>Coins
                  </span>
                  <span>
                    <Heart aria-hidden="true" />
                    <b>{hud.stars}</b>Lives
                  </span>
                </div>
                <Rules>
                  <RuleSection title="Keep your lives">
                    <p>
                      A party walking out, or throwing out a real guest, costs{' '}
                      <strong>one life</strong>. At zero, the{' '}
                      {campaign ? 'run' : 'shift'} ends.
                    </p>
                  </RuleSection>
                  {level && (
                    <RuleSection title="Finish the level">
                      <p>
                        End the shift with a life left and at least the{' '}
                        <strong>bronze</strong> coins to open the next level.
                      </p>
                    </RuleSection>
                  )}
                  {campaign && (
                    <RuleSection title="Medals">
                      <p>
                        Medals pay <strong>tokens</strong> for the Workshop.
                        Lives you lose here stay lost for the rest of the run.
                      </p>
                    </RuleSection>
                  )}
                </Rules>
                <div
                  className="diner-progress-medals"
                  aria-label="Medal targets"
                >
                  {hud.targets.map((target, i) => (
                    <span
                      key={i}
                      className={`m${i}`}
                      data-earned={hud.coins >= target}
                    >
                      <i className="diner-medal" aria-hidden="true" />
                      <strong>{['Bronze', 'Silver', 'Gold'][i]}</strong>
                      <span>{target} coins</span>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="diner-button"
                  onClick={() => setPanel(null)}
                >
                  Resume
                </button>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
        <LeaveDialog
          state={leave}
          title="Leave the diner?"
          saved={
            leaveNote ??
            (campaign
              ? 'Your campaign is saved on this device.'
              : online
                ? 'Your place at the diner is saved.'
                : 'Your medals are saved on this device.')
          }
          theme="diner"
          onLeave={onExit}
        />
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
    </DinerLandscape>
  );
}
