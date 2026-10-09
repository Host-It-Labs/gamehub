'use client';
import { resolutionFloor } from './quality';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  Crown,
  LogOut,
  Pause,
  LayoutGrid,
  RotateCcw,
  Settings2,
  Swords,
  WifiOff,
} from 'lucide-react';
import { cards, deck, isSpell, type CardId } from '@/lib/games/arena/cards';
import {
  MAX_ELIXIR,
  nearestLegal,
  threatsAt,
  clock,
  elixirMultiplier,
  type Difficulty,
  type Match,
  type Mode,
  type Side,
} from '@/lib/games/arena/engine';
import { useResultsFeedback, WinnerCelebration } from '../results-feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import * as THREE from 'three';
import { toWorld } from '@/lib/games/arena/layout';
import { arenaManifest, totalBytes, filesFor, type Progress } from './assets';
import { pickQuality, prepare, type Prepared } from './load';
import { ArenaView, type Bar } from './view';
import { TROOP_SCALE } from './troops';
import { ArenaRules } from './arena-rules';
import { CardBrowser, CardPeek } from './card-info';
import { GameMenu } from '../game-menu';
import { recordCompletedGame } from '../play-experience';
import { SoloSession, type Session, type SoloSetup } from './session';
import { DeckLayer } from './deck-layer';
import type { OnlineSession } from './online';
import { Pacer, ladder } from '../render-pacer';
import { startLevel } from '../render-quality';
import { ArenaSound } from './sound';
import './arena.css';

type Hud = {
  hand: CardId[];
  next: CardId;
  elixir: number;
  seconds: number;
  phase: Match['phase'];
  /** Crowns for the viewer's side and for the other. */
  mine: number;
  theirs: number;
  outcome: 'won' | 'lost' | 'draw' | null;
  multiplier: number;
  /** Hand slots whose card is on its way to the server. */
  sent: number[];
};

function read(m: Match, s: Session): Hud {
  const seat = m.players[s.you];
  const side = seat.side;
  const pending = s.pending();
  const owed = pending.reduce((sum, p) => sum + cards[p.card].cost, 0);
  return {
    hand: [...seat.hand.cards],
    next: seat.hand.queue[0],
    elixir: Math.max(0, Math.floor(seat.elixir - owed)),
    seconds: Math.ceil(clock(m)),
    phase: m.phase,
    mine: m.crowns[side],
    theirs: m.crowns[side === 0 ? 1 : 0],
    outcome:
      m.winner === null
        ? null
        : m.winner === 'draw'
          ? 'draw'
          : m.winner === side
            ? 'won'
            : 'lost',
    multiplier: elixirMultiplier(m),
    sent: pending.map((p) => p.slot),
  };
}
const same = (a: Hud, b: Hud) =>
  a.elixir === b.elixir &&
  a.seconds === b.seconds &&
  a.phase === b.phase &&
  a.outcome === b.outcome &&
  a.multiplier === b.multiplier &&
  a.next === b.next &&
  a.mine === b.mine &&
  a.theirs === b.theirs &&
  a.sent.join() === b.sent.join() &&
  a.hand.every((c, i) => c === b.hand[i]);

const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** How loudly the clock should speak: calm, the last minute, the last ten
 *  seconds, or sudden-death overtime. */
function urgency(hud: Hud) {
  if (hud.phase === 'overtime') return 'overtime';
  if (hud.phase !== 'battle') return 'calm';
  if (hud.seconds <= 10) return 'final';
  if (hud.seconds <= 60) return 'minute';
  return 'calm';
}

type Drag = {
  slot: number;
  pointer: number;
  x: number;
  y: number;
  moved: boolean;
};

/** What a floating health bar last showed, so unchanged bars are left be. */
type BarEl = {
  el: HTMLDivElement;
  label: HTMLElement | null;
  x: number;
  y: number;
  hp: number;
  visible: boolean;
  asleep: boolean;
  pinned: boolean;
  text: number;
  shield: number;
};

export default function ArenaGame({
  difficulty = 'medium',
  mode = 'duel',
  online,
  learn = false,
  volume,
  music = 0.6,
  onExit,
  sound,
  setup,
  onFinish,
  leaveNote,
}: {
  difficulty?: Difficulty;
  mode?: Mode;
  /** Decks and boosts for a battle on this device (Versus decks, Quest). */
  setup?: SoloSetup;
  /** A Quest battle: the results offer only Continue, which reports the
   *  outcome here. */
  onFinish?: (outcome: 'won' | 'lost' | 'draw', crowns: number) => void;
  /** What leaving keeps, said in the leave dialog (a Quest run is saved). */
  leaveNote?: string;
  /** An online room; without one the battle is against bots here. */
  online?: OnlineSession;
  learn?: boolean;
  volume: number;
  /** The battle music's level (the Ambient sound switch). */
  music?: number;
  onExit: () => void;
  /** Sound switches, shown inline in the menu. */
  sound: ReactNode;
}) {
  const [session] = useState<Session>(
    () => online ?? new SoloSession(difficulty, mode, setup),
  );
  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener),
    [session],
  );
  // Re-render when the room changes around the match (seats, status).
  const roomKey = useSyncExternalStore(
    subscribe,
    () =>
      online
        ? `${online.round}|${online.room.status}|${online.status}|${online.room.seats.map((s) => +s.connected).join('')}|${online.refused}`
        : String(session.round),
    () => '',
  );
  // The deck phase before a Versus battle (deck-layer.tsx) covers the HUD.
  const decking = useSyncExternalStore(
    subscribe,
    () => session.phase !== null,
    () => false,
  );
  const [quality] = useState(pickQuality);
  const [progress, setProgress] = useState<Progress>({
    loaded: 0,
    total: totalBytes(filesFor(quality.tier)),
    cached: false,
  });
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  // The art is in but the shaders are still being built.
  const [warming, setWarming] = useState(true);
  const [hud, setHud] = useState<Hud | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [panel, setPanel] = useState<
    'menu' | 'rules' | 'leave' | 'cards' | null
  >(learn ? 'rules' : null);
  const [showResults, setShowResults] = useState(false);
  const [shake, setShake] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const handRow = useRef<HTMLDivElement>(null);
  const barsLayer = useRef<HTMLDivElement>(null);
  const elixirBar = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLButtonElement | null)[]>([]);
  const view = useRef<ArenaView | null>(null);
  const selectedRef = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const hover = useRef<[number, number] | null>(null);
  const paused = useRef(learn);
  // Arena's own music and effects (sound.ts), made once the screen mounts.
  const audioRef = useRef<ArenaSound | null>(null);
  const levels = useRef({ volume, music });
  useEffect(() => {
    const a = new ArenaSound();
    a.levels(levels.current.volume, levels.current.music);
    audioRef.current = a;
    return () => {
      a.dispose();
      if (audioRef.current === a) audioRef.current = null;
    };
  }, []);
  useEffect(() => {
    levels.current = { volume, music };
    audioRef.current?.levels(volume, music);
  }, [volume, music]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    // Online battles run on the server's clock and never pause.
    paused.current = session.canPause && panel !== null;
    audioRef.current?.pause(paused.current);
  }, [panel, session]);

  // Download or read the art, then decode it.
  useEffect(() => {
    const abort = new AbortController();
    prepare(quality.tier, setProgress, abort.signal)
      .then(setPrepared)
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Could not load Arena.');
      });
    return () => abort.abort();
  }, [quality.tier, attempt]);

  useEffect(
    () => () => {
      if (prepared)
        for (const url of Object.values(prepared.cards))
          URL.revokeObjectURL(url);
    },
    [prepared],
  );

  // The server refused a card: shake the elixir bar.
  const refused = online?.refused ?? 0;
  useEffect(() => {
    if (!refused) return;
    elixirBar.current?.classList.remove('flash');
    void elixirBar.current?.offsetWidth;
    elixirBar.current?.classList.add('flash');
  }, [refused]);

  const showFailure = useCallback((e: unknown) => {
    setError(
      e instanceof Error && /WebGL/i.test(e.message)
        ? 'This browser cannot show 3D graphics.'
        : 'Could not start the 3D view.',
    );
  }, []);

  // Build the 3D view once the art is ready, and run the loop.
  useEffect(() => {
    if (!prepared || !canvas.current) return;
    let v: ArenaView;
    try {
      v = new ArenaView(
        canvas.current,
        prepared,
        quality,
        session.side,
        session.you,
      );
    } catch (e) {
      void Promise.reject(e).catch(showFailure);
      return;
    }
    view.current = v;
    let shownMatch = session.match;
    let shownRound = session.round;
    v.start(shownMatch);
    let warm = true;
    let live = true;
    void v
      .warm(shownMatch)
      .catch(() => {})
      .then(() => {
        warm = false;
        if (live) setWarming(false);
      });
    // Dev bench hook for scripted screenshots; stripped from production.
    if (process.env.NODE_ENV === 'development')
      (window as unknown as { arenaDebug: unknown }).arenaDebug = {
        session,
        view: v,
        match: {
          get current() {
            return session.match;
          },
        },
      };
    // Lowest a tower's bar may sit: its number stays below the top edge.
    let barFloor = 0;
    const measure = () => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const topEdge = top.current
        ? Math.max(
            ...[...top.current.children].map(
              (el) => el.getBoundingClientRect().bottom - r.top,
            ),
            0,
          )
        : 0;
      const tray = dock.current?.getBoundingClientRect();
      const dockTop = tray ? tray.top - r.top : r.height;
      // On phones the back button and the clock float in the corners and the
      // far king rises between them almost to the top edge (level with the
      // back button, so a notch or status bar is still respected).
      const back = top.current?.firstElementChild?.getBoundingClientRect();
      const phone = r.width <= 600;
      barFloor = back ? Math.max(0, back.top - r.top) + 28 : 28;
      v.resize({
        width: r.width,
        height: r.height,
        top: phone && back ? Math.max(0, back.top - r.top - 6) : topEdge + 10,
        bottom: Math.max(0, r.height - dockTop),
        dock: tray
          ? { left: tray.left - r.left, right: tray.right - r.left }
          : undefined,
      });
      root.current?.style.setProperty(
        '--figure',
        (v.figureScale / TROOP_SCALE).toFixed(3),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    if (dock.current) observer.observe(dock.current);
    window.visualViewport?.addEventListener('resize', measure);
    // Preserve native clarity even at the lowest rendering rung. A weaker
    // device starts a few rungs down and climbs when frames have room.
    const rungs = ladder(quality.shadowSize, resolutionFloor(quality.pixelRatio));
    const pacer = new Pacer(
      rungs,
      (rung) => v.setRung(rung),
      startLevel(
        rungs,
        window.innerWidth,
        window.innerHeight,
        quality.pixelRatio,
      ),
    );
    if (pacer.level) v.setRung(pacer.rung);
    if (process.env.NODE_ENV === 'development')
      Object.assign(
        (window as unknown as { arenaDebug: object }).arenaDebug ?? {},
        {
          pacer,
          get audio() {
            return audioRef.current;
          },
        },
      );
    let raf = 0;
    let last = performance.now();
    let resultsAt = 0;
    const bars = new Map<number, BarEl>();
    const marks: HTMLDivElement[] = [];
    const point = new THREE.Vector3();
    const drawBars = (list: Bar[]) => {
      const layer = barsLayer.current;
      if (!layer) return;
      const seen = new Set<number>();
      for (const b of list) {
        seen.add(b.id);
        let bar = bars.get(b.id);
        if (!bar) {
          const el = document.createElement('div');
          el.className = `arena-bar ${b.kind} team-${b.team}`;
          el.innerHTML =
            b.kind === 'troop'
              ? '<span class="arena-shield-track"><i></i><svg viewBox="0 0 16 18"><path d="M8 1 14 3v5c0 4-3 7-6 9-3-2-6-5-6-9V3Z"/></svg></span><span class="arena-hp-track"><i></i></span>'
              : '<b></b><span class="arena-bar-track"><i></i></span>';
          layer.appendChild(el);
          bar = {
            el,
            label: el.querySelector('b'),
            x: NaN,
            y: NaN,
            hp: -1,
            shield: -1,
            visible: false,
            asleep: false,
            pinned: false,
            text: -1,
          };
          el.style.opacity = '0';
          bars.set(b.id, bar);
        }
        // Touch the page only where something changed. A tower's bar hangs
        // above its top, so on phones, where the far king reaches the top
        // edge, it is held on screen over the roof.
        const shielded = String(b.shield !== undefined);
        if (bar.el.dataset.shielded !== shielded)
          bar.el.dataset.shielded = shielded;
        const edge = b.kind === 'troop' ? 0 : barFloor;
        const x = Math.round(b.x * 2) / 2;
        const y = Math.round(Math.max(b.y, edge) * 2) / 2;
        const pinned = b.y < edge;
        if (pinned !== bar.pinned) {
          bar.pinned = pinned;
          bar.el.dataset.pinned = String(pinned);
        }
        if (x !== bar.x || y !== bar.y) {
          bar.x = x;
          bar.y = y;
          bar.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
        if (b.visible !== bar.visible) {
          bar.visible = b.visible;
          bar.el.style.opacity = b.visible ? '1' : '0';
        }
        const hp = Math.round((b.hp / b.max) * 200) / 200;
        if (hp !== bar.hp) {
          bar.hp = hp;
          bar.el.style.setProperty('--hp', String(hp));
        }
        const shield = Math.round((b.shield ?? 0) * 100) / 100;
        if (shield !== bar.shield) {
          bar.shield = shield;
          bar.el.style.setProperty('--shield', String(shield));
        }
        const asleep = !!b.asleep;
        if (asleep !== bar.asleep) {
          bar.asleep = asleep;
          bar.el.dataset.asleep = String(asleep);
        }
        const text = Math.ceil(b.hp);
        if (bar.label && text !== bar.text) {
          bar.text = text;
          bar.label.textContent = String(text);
        }
      }
      for (const [id, bar] of bars)
        if (!seen.has(id)) {
          bar.el.remove();
          bars.delete(id);
        }
      // Cards on their way to the server wait as rings on the ground.
      const pending = session.pending();
      while (marks.length < pending.length) {
        const el = document.createElement('div');
        el.className = 'arena-pending';
        layer.appendChild(el);
        marks.push(el);
      }
      marks.forEach((el, i) => {
        const p = pending[i];
        el.hidden = !p;
        if (!p) return;
        const at = v.project(point.set(...toWorld(p.x, p.y)));
        el.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
      });
    };
    let previous: Hud | null = null;
    /** Where a field point sits across the screen, -1 to 1, for panning. */
    const panOf = (x: number, y: number) => {
      const at = v.project(point.set(...toWorld(x, y)));
      return (at.x / Math.max(1, root.current?.clientWidth ?? 1)) * 2 - 1;
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // Drawing now would build the shaders one by one, on this thread.
      if (warm) {
        last = now;
        return;
      }
      if (!pacer.frame(now)) return;
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      const alpha = session.advance(dt, paused.current || document.hidden);
      const m = session.match;
      // A new battle, or a fresh copy of this one after a resync.
      if (session.round !== shownRound) {
        shownRound = session.round;
        v.start(m);
        for (const bar of bars.values()) bar.el.remove();
        bars.clear();
        resultsAt = 0;
        setShowResults(false);
        setSelected(null);
      } else if (m !== shownMatch) v.reconcile(m);
      shownMatch = m;
      const events = m.events.splice(0);
      if (events.length) {
        v.handle(m, events);
        // Your own cards online already made their sound when sent.
        audioRef.current?.events(
          m,
          session.kind === 'online'
            ? events.filter(
                (e) => e.type !== 'deploy' || e.player !== session.you,
              )
            : events,
          session.side,
          panOf,
        );
        for (const e of events) if (e.type === 'tower') setShake((n) => n + 1);
      }
      audioRef.current?.frame(m, clock(m), elixirMultiplier(m) > 1);
      if (m.phase === 'over' && !resultsAt) {
        recordCompletedGame('Arena');
        resultsAt = now + 1400;
      }
      if (resultsAt && now >= resultsAt && resultsAt > 0) {
        resultsAt = -1;
        setShowResults(true);
      }
      // Placement preview while a card is held.
      const seat = m.players[session.you];
      const slot = drag.current?.slot ?? selectedRef.current;
      const card =
        slot !== null && slot !== undefined ? seat.hand.cards[slot] : null;
      const at = hover.current;
      v.overlayOn = card !== null && m.phase !== 'over';
      const owed = session
        .pending()
        .reduce((sum, p) => sum + cards[p.card].cost, 0);
      const elixir = seat.elixir - owed;
      // The ghost stands where the card will go: the nearest legal spot,
      // with a faint line back to the finger when that is elsewhere.
      const spot = card && at && nearestLegal(m, seat.side, card, ...at);
      if (card && at && spot)
        v.ghost.show(card, spot[0], spot[1], elixir >= cards[card].cost, at);
      else v.ghost.show(null, 0, 0, false);
      // Enemies that could hit the placement show a compact warning above them.
      v.showThreats(
        m,
        spot && card && elixir >= cards[card].cost
          ? threatsAt(m, seat.side, card, spot[0], spot[1])
          : [],
      );
      // A held spell may land anywhere: the whole field lights up.
      v.overlay.refresh(
        m,
        seat.side,
        card !== null && isSpell(card),
        card ?? undefined,
      );
      v.frame(m, alpha, dt, now / 1000);
      drawBars(v.bars(m));
      // The elixir beads and card fills move every frame; the rest on change.
      const fills = elixirBar.current?.querySelectorAll<HTMLElement>(
        '.arena-elixir-beads i',
      );
      fills?.forEach((el, i) => {
        const f = Math.max(0, Math.min(1, elixir - i)).toFixed(3);
        if (el.dataset.f === f) return;
        el.dataset.f = f;
        el.style.transform = `scaleX(${f})`;
        el.classList.toggle('full', f === '1.000');
      });
      seat.hand.cards.forEach((id, i) => {
        const el = cardEls.current[i];
        if (!el) return;
        const cost = cards[id].cost;
        el.style.setProperty(
          '--short',
          Math.max(0, Math.min(1, (cost - elixir) / cost)).toFixed(2),
        );
        el.dataset.ready = elixir >= cost ? 'true' : 'false';
      });
      const next = read(m, session);
      if (!previous || !same(previous, next)) {
        previous = next;
        setHud(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', measure);
      for (const bar of bars.values()) bar.el.remove();
      for (const el of marks) el.remove();
      v.dispose();
      view.current = null;
    };
  }, [prepared, quality, session, showFailure]);

  const won = hud?.outcome === 'won';
  // The end of a battle has its own sting (sound.ts); the shared results
  // cue stays silent here.
  useResultsFeedback('arena', hud?.phase === 'over', showResults, 0);

  // ---------------------------------------------------------------- input

  /** The field point under a pointer. Over the card row it is null (a drag
   *  released there is cancelled); anywhere else counts, the faded tray
   *  included, so a card can go behind your king beneath it. */
  const fieldAt = (clientX: number, clientY: number) => {
    const v = view.current;
    const r = canvas.current?.getBoundingClientRect();
    if (!v || !r || overHand(clientX, clientY)) return null;
    return v.pick(clientX - r.left, clientY - r.top);
  };
  const overHand = (clientX: number, clientY: number) => {
    const h = handRow.current?.getBoundingClientRect();
    return (
      !!h &&
      clientX >= h.left &&
      clientX <= h.right &&
      clientY >= h.top &&
      clientY <= h.bottom
    );
  };

  /** Plays a card at the legal spot nearest a field point. */
  const place = (slot: number, point: [number, number]) => {
    const m = session.match;
    const seat = m.players[session.you];
    const card = seat.hand.cards[slot];
    const at = card && nearestLegal(m, seat.side, card, ...point);
    if (!at) return false;
    const result = session.play(slot, at[0], at[1]);
    if (result === 'ok' || result === 'sent') {
      // Solo, the deploy event itself sounds; online, the card sounds as
      // it is sent rather than when the server echoes it.
      if (result === 'sent') {
        const audio = audioRef.current;
        audio?.play(isSpell(card) ? 'meteor-fall' : 'card-drop');
        if (!isSpell(card))
          window.setTimeout(() => audio?.play(`${card}-deploy`), 260);
      }
      setSelected(null);
      return true;
    }
    if (result === 'elixir') {
      audioRef.current?.play('no-elixir');
      elixirBar.current?.classList.remove('flash');
      void elixirBar.current?.offsetWidth;
      elixirBar.current?.classList.add('flash');
    }
    return false;
  };

  const pickCard = (slot: number) => {
    if (!hud || hud.phase === 'over' || hud.sent.includes(slot)) return;
    audioRef.current?.play('card-pick', 0, 0.8);
    setSelected((s) => (s === slot ? null : slot));
  };

  const onCardDown = (
    slot: number,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (
      e.button !== 0 ||
      !hud ||
      hud.phase === 'over' ||
      hud.sent.includes(slot)
    )
      return;
    drag.current = {
      slot,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onCardMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
      d.moved = true;
      setDragSlot(d.slot);
    }
    hover.current = d.moved ? fieldAt(e.clientX, e.clientY) : null;
    root.current?.style.setProperty('--drag-x', `${e.clientX}px`);
    root.current?.style.setProperty('--drag-y', `${e.clientY}px`);
    root.current?.classList.toggle('dragging', d.moved);
    // Back over the cards the tray comes back: letting go there cancels.
    root.current?.classList.toggle(
      'over-hand',
      d.moved && overHand(e.clientX, e.clientY),
    );
  };
  const onCardUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    setDragSlot(null);
    root.current?.classList.remove('dragging', 'over-hand');
    const at = d.moved ? fieldAt(e.clientX, e.clientY) : null;
    hover.current = null;
    if (!d.moved) return pickCard(d.slot);
    if (at) {
      if (!place(d.slot, at)) setSelected(d.slot);
    }
  };

  const onFieldMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current) return;
    hover.current =
      selectedRef.current !== null ? fieldAt(e.clientX, e.clientY) : null;
  };
  const onFieldUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const slot = selectedRef.current;
    if (slot === null || drag.current) return;
    const at = fieldAt(e.clientX, e.clientY);
    if (at) place(slot, at);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel) return;
      if (e.key >= '1' && e.key <= '4') pickCard(Number(e.key) - 1);
      else if (e.key === 'Escape') {
        if (selectedRef.current !== null) setSelected(null);
        else setPanel('menu');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------------------------------------------------------------- render

  const cardUrl = (id: CardId) => prepared?.cards[id];
  const loading = (!prepared || warming) && !error;
  // Downloading is most of the bar; decoding and building the shaders
  // fill the rest, so it never sits full while the battle is not ready.
  const pct = prepared
    ? warming
      ? 0.94
      : 1
    : progress.total
      ? Math.min(1, progress.loaded / progress.total) * 0.86
      : 0;
  const room = online?.room;
  const waiting = !!room && room.status === 'waiting' && !loading;
  void roomKey;
  const side: Side = session.side;
  /** The names on one side, for the results. */
  const team = (s: Side) =>
    session.names
      .map((name, seat) =>
        online && seat === session.you ? `${name} (you)` : name,
      )
      .filter((_, seat) => seat % 2 === s)
      .join(' & ');
  const again = () => {
    session.again();
    setSelected(null);
    setShowResults(false);
  };

  return (
    <div
      ref={root}
      className="arena-game at-table"
      data-phase={hud?.phase ?? 'loading'}
      data-selected={selected !== null ? 'true' : 'false'}
      data-decking={decking ? 'true' : undefined}
    >
      <canvas
        ref={canvas}
        className="arena-canvas"
        onPointerMove={onFieldMove}
        onPointerUp={onFieldUp}
        onPointerLeave={() => {
          if (!drag.current) hover.current = null;
        }}
        aria-label="Battlefield. Pick a card, then tap your half of the field to send it in."
      />
      <div ref={barsLayer} className="arena-bars" aria-hidden="true" />
      <div ref={top} className="arena-top">
        <button
          type="button"
          className="arena-back"
          aria-label="Leave the battle"
          onClick={() => setPanel('leave')}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="arena-corner">
          {online?.status === 'lost' && (
            <output className="arena-offline" aria-label="Reconnecting">
              <WifiOff aria-hidden="true" />
            </output>
          )}
          {hud && (
            <div
              className="arena-clock"
              data-urgency={urgency(hud)}
              role="timer"
              aria-label={`${time(hud.seconds)} left. Crowns ${hud.mine} to ${hud.theirs}`}
            >
              <span key={hud.seconds} className="arena-clock-time">
                {time(hud.seconds)}
              </span>
              <span className="arena-clock-crowns" aria-hidden="true">
                <span className="team-0">
                  <Crown />
                  <b data-game-motion="change" data-game-motion-key={hud.mine}>
                    {hud.mine}
                  </b>
                </span>
                <span className="team-1">
                  <Crown />
                  <b
                    data-game-motion="change"
                    data-game-motion-key={hud.theirs}
                  >
                    {hud.theirs}
                  </b>
                </span>
              </span>
            </div>
          )}
          <GameMenu
            name="Arena"
            theme="arena"
            open={panel === 'menu'}
            onOpenChange={(open) => setPanel(open ? 'menu' : null)}
            triggerClassName="arena-pause"
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
            items={[
              ...(session.kind === 'solo' && !onFinish
                ? [{ label: 'Restart', icon: RotateCcw, onSelect: again }]
                : []),
              // Every card's stats (card-info.tsx).
              {
                label: 'Cards',
                icon: LayoutGrid,
                onSelect: () => setPanel('cards'),
              },
            ]}
            sound={sound}
            onLeave={() => setPanel('leave')}
          />
        </div>
      </div>
      {hud?.phase === 'overtime' && (
        <div className="arena-overtime" aria-hidden="true" />
      )}
      {hud?.phase === 'ready' && prepared && !waiting && (
        <output className="arena-ready" aria-label="Ready to battle">
          <Swords />
        </output>
      )}
      {waiting && room && (
        <section className="arena-waiting" aria-label="Players">
          <ul>
            {room.seats.map((seat, i) => (
              <li
                key={i}
                className={`team-${i % 2 === side ? 0 : 1}`}
                data-ready={seat.bot || seat.connected}
              >
                <span>{seat.name}</span>
                <i
                  aria-label={seat.bot || seat.connected ? 'Ready' : 'Joining'}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div ref={dock} className="arena-dock" aria-label="Your hand">
        {hud && (
          <>
            <div ref={handRow} className="arena-hand">
              <div
                className="arena-next"
                aria-label={`Next: ${cards[hud.next].name}`}
              >
                {cardUrl(hud.next) && (
                  <img src={cardUrl(hud.next)} alt="" draggable={false} />
                )}
                <span className="arena-cost">{cards[hud.next].cost}</span>
              </div>
              {hud.hand.map((id, i) => (
                <button
                  key={`${i}-${id}`}
                  ref={(el) => {
                    cardEls.current[i] = el;
                  }}
                  type="button"
                  className="arena-card"
                  data-game-motion="deal"
                  data-sent={hud.sent.includes(i)}
                  aria-pressed={selected === i}
                  aria-label={`${cards[id].name}, ${cards[id].cost} elixir. ${cards[id].role}`}
                  onPointerDown={(e) => onCardDown(i, e)}
                  onPointerMove={onCardMove}
                  onPointerUp={onCardUp}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragSlot(null);
                    hover.current = null;
                    root.current?.classList.remove('dragging', 'over-hand');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pickCard(i);
                    }
                  }}
                >
                  {cardUrl(id) ? (
                    <img src={cardUrl(id)} alt="" draggable={false} />
                  ) : (
                    <span className="arena-card-name" aria-hidden="true">
                      {cards[id].name}
                    </span>
                  )}
                  <span className="arena-card-short" aria-hidden="true" />
                  <span className="arena-cost">{cards[id].cost}</span>
                </button>
              ))}
            </div>
            <div
              ref={elixirBar}
              className={`arena-elixir ${hud.multiplier > 1 ? 'double' : ''}`}
            >
              <meter
                className="sr-only"
                min={0}
                max={MAX_ELIXIR}
                value={hud.elixir}
                aria-label="Elixir"
              >
                {hud.elixir}
              </meter>
              <span className="arena-elixir-drop" aria-hidden="true">
                {hud.elixir}
              </span>
              {/* Ten violet beads on a rod; each fills as its point comes
                  (the loop sets each fill's width directly). */}
              <span className="arena-elixir-beads" aria-hidden="true">
                {Array.from({ length: MAX_ELIXIR }, (_, i) => (
                  <b key={i}>
                    <i />
                  </b>
                ))}
              </span>
              {hud.multiplier > 1 && (
                <span className="arena-elixir-double">×{hud.multiplier}</span>
              )}
            </div>
          </>
        )}
      </div>
      {/* Hovering a hand card or a troop shows its card at the right
          (desktop); card-info.tsx. */}
      <CardPeek
        root={root}
        canvas={canvas}
        view={view}
        session={session}
        hand={cardEls}
        activeCard={
          hud && (dragSlot ?? selected) !== null
            ? hud.hand[(dragSlot ?? selected)!]
            : null
        }
        art={prepared?.cards}
        enabled={!!prepared && !warming && panel === null && !showResults}
      />
      <CardBrowser
        open={panel === 'cards'}
        onOpenChange={(open) => setPanel(open ? 'cards' : null)}
        boost={session.match.players[session.you]?.boost}
        art={prepared?.cards}
      />
      {dragSlot !== null && hud && cardUrl(hud.hand[dragSlot]) && (
        <img
          className="arena-drag-card"
          src={cardUrl(hud.hand[dragSlot])}
          alt=""
          aria-hidden="true"
        />
      )}
      {loading && (
        <div className="arena-loading" aria-busy="true">
          <picture className="arena-loading-art">
            <source
              media="(max-aspect-ratio: 4/5)"
              srcSet="/art/optimized/arena-loading-tall.webp"
            />
            <img
              src="/art/optimized/arena-loading-wide.webp"
              alt=""
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden';
              }}
            />
          </picture>
          <div className="arena-loading-foot">
            <ul className="arena-loading-cards" aria-hidden="true">
              {(session.match.players[session.you]?.deck ?? deck)
                .slice(0, 8)
                .map((id, i, list) => (
                  <li
                    key={id}
                    style={{ '--i': i } as CSSProperties}
                    data-in={pct >= (i + 1) / (list.length + 1)}
                  >
                    {arenaManifest.cards[id] && (
                      <img
                        src={arenaManifest.cards[id].path}
                        alt=""
                        draggable={false}
                      />
                    )}
                  </li>
                ))}
            </ul>
            <progress
              className="sr-only"
              max={100}
              value={Math.round(pct * 100)}
              aria-label="Loading"
            />
            <div
              className="arena-loading-bar"
              aria-hidden="true"
              style={{ '--p': pct } as CSSProperties}
            >
              <i />
              <b>{Math.round(pct * 100)}%</b>
            </div>
          </div>
        </div>
      )}
      {!error && (
        <DeckLayer
          session={session}
          loading={loading}
          art={(id) => cardUrl(id) ?? arenaManifest.cards[id]?.path}
        />
      )}
      {error && (
        <div className="arena-loading">
          <div className="arena-loading-panel" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="arena-button"
              onClick={() => {
                setError('');
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="arena-button quiet"
              onClick={onExit}
            >
              Back
            </button>
          </div>
        </div>
      )}
      {showResults && hud && (
        <div className={`arena-results ${hud.outcome ?? 'draw'}`}>
          <section
            className="arena-results-card"
            aria-label="Results"
            aria-live="polite"
          >
            <WinnerCelebration won={won} />
            <h2>
              {won ? 'Victory' : hud.outcome === 'draw' ? 'Draw' : 'Defeat'}
            </h2>
            <div className="arena-results-crowns">
              {([side, side === 0 ? 1 : 0] as Side[]).map((s, row) => {
                const crowns = row === 0 ? hud.mine : hud.theirs;
                return (
                  <div key={s} className={`team-${row}`}>
                    <span>{team(s)}</span>
                    <span className="arena-crowns big">
                      {[0, 1, 2].map((i) => (
                        <Crown
                          key={i}
                          aria-hidden="true"
                          className={i < crowns ? 'won' : ''}
                          style={{ '--i': i } as CSSProperties}
                        />
                      ))}
                    </span>
                    <b>{crowns}</b>
                  </div>
                );
              })}
            </div>
            <div
              className={`arena-results-actions ${session.host && !onFinish ? '' : 'single'}`}
            >
              {onFinish && (
                <button
                  type="button"
                  className="arena-button"
                  onClick={() => onFinish(hud.outcome ?? 'draw', hud.mine)}
                >
                  <Swords aria-hidden="true" /> Continue
                </button>
              )}
              {session.host && !onFinish && (
                <button type="button" className="arena-button" onClick={again}>
                  <RotateCcw aria-hidden="true" /> Again
                </button>
              )}
              {!onFinish && (
                <button
                  type="button"
                  className="arena-button quiet"
                  onClick={onExit}
                >
                  {online ? 'Table' : 'Games'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      <Dialog
        open={panel === 'rules' || panel === 'leave'}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent
          className={`modal arena-modal ${panel === 'rules' ? 'arena-rules-modal' : ''}`}
        >
          {panel === 'rules' ? (
            <>
              <DialogTitle>How to play</DialogTitle>
              <DialogDescription className="sr-only">
                Rules of Arena
              </DialogDescription>
              <ArenaRules cardArt={prepared?.cards} />
              <button
                type="button"
                className="arena-button"
                onClick={() => setPanel(null)}
              >
                {hud?.phase === 'ready' ? 'Fight' : 'Resume'}
              </button>
            </>
          ) : panel === 'leave' ? (
            <>
              <DialogTitle>Leave the battle?</DialogTitle>
              <DialogDescription>
                {leaveNote ??
                  (online
                    ? 'A bot plays your seat until you come back.'
                    : 'This battle ends when you leave.')}
              </DialogDescription>
              <button type="button" className="arena-button" onClick={onExit}>
                <LogOut aria-hidden="true" /> Leave
              </button>
              <button
                type="button"
                className="arena-button quiet"
                onClick={() => setPanel(null)}
              >
                Keep playing
              </button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={online?.status === 'gone'}>
        <DialogContent className="modal arena-modal">
          <DialogTitle>The battle has closed</DialogTitle>
          <DialogDescription className="sr-only">
            This online room no longer exists.
          </DialogDescription>
          <button type="button" className="arena-button" onClick={onExit}>
            <LogOut aria-hidden="true" /> Back
          </button>
        </DialogContent>
      </Dialog>
      <span className="sr-only" aria-live="polite">
        {shake ? 'A tower fell.' : ''}
      </span>
    </div>
  );
}
