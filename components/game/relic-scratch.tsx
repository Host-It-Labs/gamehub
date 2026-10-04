'use client';
import type { useRoomTable } from '../online/room-table';
import { TableManager } from './table-manager';
import { LuckyRules } from './relic-rules';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Copy, Star, Users, Volume2, X } from 'lucide-react';
import { GameNavigation } from './game-navigation';
import { SoundToggle } from './sound-settings';
import { useGameMotion } from './game-motion';
import {
  formatNumber,
  type ActionResult,
  type RelicAction,
  type RelicGame,
} from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  MACHINES,
  advanceFactory,
  TICK_MS,
  type MachineKind,
} from '@/lib/games/relic/factory';
import {
  BOOK_LEVEL_GAIN,
  PACKS,
  packFor,
  packOpen,
  rubTicket,
  upgradeFor,
  type FeedEntry,
  type PackId,
  type ScratchTicket,
} from '@/lib/games/relic/scratch';
import type { ExpeditionView } from '@/lib/games/relic/types';
import { devSession, requestId } from '@/lib/online/client';
import { ScratchAudio } from './relic-scratch-audio';
import { ScratchDesk } from './relic-scratch-desk';
import { MachineIcon, ScratchFactory, type FactoryView } from './relic-scratch-factory';
import { ScratchUpgrades, UPGRADE_ICONS } from './relic-scratch-upgrades';
import { DESK_TABS, WatchTv } from './relic-scratch-watch';
import {
  PLAYER_COLOURS,
  RemoteCursors,
  anchorOf,
  deskPointer,
  useDeskPresence,
  type DeskTab,
  type PresenceView,
  type StrokeEvent,
} from './relic-presence';
import { TICKET_ART } from './relic-scratch-art';
import './relic-scratch.css';

function playing() {
  return !document.hidden && document.hasFocus();
}
/** A fresh snapshot, carried forward by the active time this browser has
 * already shown but the server has not been paid for yet, so the factory never
 * steps back when a snapshot lands between ticks. */
function aligned(next: RelicGame, shown: RelicGame) {
  const lag = (shown.scratch?.activeMs ?? 0) - (next.scratch?.activeMs ?? 0);
  if (!(lag > 0 && lag < 4000) || !next.scratch?.factory.machines.length)
    return { game: next, lag };
  const copy = structuredClone(next);
  advanceFactory(copy, lag);
  return { game: copy, lag };
}
/** The factory moves smoothly between server snapshots by running the same
 * deterministic step locally, once every tick, on the tick. */
function usePredicted(game: RelicGame) {
  const [live, setLive] = useState(() => ({ source: game, game, ahead: false }));
  const latest = useRef(live),
    clock = useRef({ at: 0 });
  useEffect(() => {
    latest.current = live;
  });
  let current = live;
  if (live.source !== game) {
    const next = aligned(game, live.game);
    current = { source: game, game: next.game, ahead: next.lag <= 0 };
    setLive(current);
  }
  // A snapshot that is not behind already counts the time since our last
  // step, so the next step counts from its arrival.
  useEffect(() => {
    if (live.ahead) clock.current.at = performance.now();
  }, [live]);
  useEffect(() => {
    clock.current.at = performance.now();
    let timer = 0;
    const run = () => {
      const now = performance.now(),
        ms = Math.min(2500, now - clock.current.at);
      clock.current.at = now;
      const g = latest.current.game;
      if (playing() && g.scratch?.factory.machines.length) {
        const next = structuredClone(g);
        advanceFactory(next, ms);
        const value = { source: latest.current.source, game: next, ahead: false };
        latest.current = value;
        setLive(value);
      }
      // The next step lands as the factory clock crosses the next tick, so
      // tickets glide one cell per tick without pausing between steps.
      const f = latest.current.game.scratch?.factory;
      timer = window.setTimeout(
        run,
        f?.machines.length ? Math.max(20, TICK_MS - f.clock + 4) : TICK_MS,
      );
    };
    timer = window.setTimeout(run, TICK_MS);
    return () => clearTimeout(timer);
  }, []);
  return current.game;
}
/** One notification: a purchase, a level opened, or what a ticket just paid. */
function Toast({
  entry,
  name,
  colour,
}: {
  entry: FeedEntry;
  name: string;
  colour: string;
}) {
  const who = (
    <b className="rs-toast-name" style={{ '--player': colour } as React.CSSProperties}>
      {name}
    </b>
  );
  const book = (id: string) => (
    <img src={TICKET_ART[id as PackId]?.small} alt="" className="rs-toast-book" />
  );
  switch (entry.kind) {
    case 'win':
      return (
        <span className={`rs-toast is-win ${(entry.amount ?? 0) < (entry.cost ?? 0) ? 'is-loss' : ''}`}>
          {who}
          {book(entry.what)}
          <Coins size={13} />
          <strong>+{formatNumber(entry.amount ?? 0)}</strong>
        </span>
      );
    case 'book':
      return (
        <span className="rs-toast">
          {who}
          {book(entry.what)}
          <span>{packFor(entry.what as PackId)?.name}</span>
        </span>
      );
    case 'upgrade': {
      const u = upgradeFor(entry.what),
        Icon = UPGRADE_ICONS[entry.what];
      return (
        <span className="rs-toast">
          {who}
          {u?.book && u.id.endsWith('-prize') ? book(u.book) : Icon && <Icon size={14} />}
          <span>{u?.name}</span>
          {!!entry.n && (u?.max ?? 1) > 1 && <small>{entry.n}</small>}
        </span>
      );
    }
    case 'blueprint':
    case 'machine': {
      // Opening the factory itself unlocks belts, printers, bots and cashiers.
      const factory = entry.what === 'starter',
        kind = (factory
          ? 'printer'
          : (BLUEPRINTS.find((b) => b.id === entry.what)?.kinds[0] ??
            entry.what)) as MachineKind;
      return (
        <span className="rs-toast">
          {who}
          <MachineIcon kind={kind} className="rs-toast-machine" />
          <span>{factory ? 'Factory' : MACHINES[kind]?.name}</span>
          {entry.kind === 'machine' && (entry.n ?? 1) > 1 && <small>×{entry.n}</small>}
        </span>
      );
    }
    case 'level':
      return (
        <span className="rs-toast is-level">
          {book(entry.what)}
          <span>{packFor(entry.what as PackId)?.name}</span>
          <b className="rs-toast-level">Lv {(entry.n ?? 0) + 1}</b>
        </span>
      );
    case 'max':
      return (
        <span className="rs-toast is-level is-max">
          {book(entry.what)}
          <span>{packFor(entry.what as PackId)?.name}</span>
          <Star size={13} fill="currentColor" />
          <small>×{1 + BOOK_LEVEL_GAIN}</small>
        </span>
      );
  }
  return null;
}
export function RelicScratch({
  room,
  view,
  busy,
  error,
  onAct,
  onView,
  onBack,
  onRefresh,
}: {
  room: ReturnType<typeof useRoomTable>;
  view: ExpeditionView;
  busy: boolean;
  error: string;
  onAct: (action: RelicAction) => Promise<ActionResult | null>;
  onView: (view: ExpeditionView) => void;
  onBack: () => void;
  /** Fetches the desk now: someone else just changed it. */
  onRefresh: () => void;
}) {
  const game = view.game,
    state = game.scratch!,
    hand = state.hands?.[view.viewerId];
  const live = usePredicted(game),
    liveState = live.scratch!;
  const [tab, setTab] = useState<DeskTab>(() => {
    try {
      const saved = localStorage.getItem('gamehub-relic-tab');
      return saved === 'factory' || saved === 'upgrades' ? saved : 'tickets';
    } catch {
      return 'tickets';
    }
  });
  const others = view.members.filter((m) => m.id !== view.viewerId);
  const colours = Object.fromEntries(
    view.members.map((m, i) => [m.id, PLAYER_COLOURS[i % PLAYER_COLOURS.length]]),
  );
  const names = Object.fromEntries(view.members.map((m) => [m.id, m.name]));
  const [overlay, setOverlay] = useState<'players' | 'help' | null>(null);
  const [tv, setTv] = useState(false),
    [watching, setWatching] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => {
      try {
        return localStorage.getItem('gamehub-relic-muted') === 'true';
      } catch {
        return false;
      }
    }),
    [copied, setCopied] = useState(false);
  const [audio] = useState(() => new ScratchAudio());
  const root = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    viewRef = useRef(onView),
    stateRef = useRef(state);
  useGameMotion(root, tab);
  useEffect(() => {
    viewRef.current = onView;
    stateRef.current = state;
  });

  // ---- Live presence: others' pointers, their screens, and their strokes.
  const [mirrorHands, setMirrorHands] = useState<Record<string, ScratchTicket>>({});
  const viewerId = view.viewerId;
  const onStrokeEvent = useCallback(
    (e: StrokeEvent) => {
      if (e.by === viewerId) return;
      setMirrorHands((list) => {
        const saved = stateRef.current.hands?.[e.by],
          known = list[e.by];
        const base =
          known && known.id === e.ticket && (!saved || saved.id !== known.id || known.sequence >= saved.sequence)
            ? known
            : saved;
        if (!base || base.id !== e.ticket || base.sequence !== e.sequence || base.ended)
          return list;
        const next = structuredClone(base);
        rubTicket(next, stateRef.current, e.points, e.breaks ?? []);
        next.sequence++;
        return { ...list, [e.by]: next };
      });
    },
    [viewerId],
  );
  const presence = useDeskPresence(view.token, {
    onChanged: onRefresh,
    onStroke: onStrokeEvent,
  });
  const publish = presence.publish;
  useEffect(() => publish({ tab }), [publish, tab]);
  useEffect(() => {
    const size = () =>
      publish({
        screen: { w: window.innerWidth, h: window.innerHeight },
        desktop: deskPointer(),
      });
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [publish]);
  const shownView = useRef<PresenceView>({});
  const report = useCallback(
    (patch: PresenceView) => {
      shownView.current = { ...shownView.current, ...patch };
      publish({ view: shownView.current });
    },
    [publish],
  );
  const onFactoryView = useCallback(
    (v: FactoryView) =>
      report({ tool: v.tool, dir: v.dir, selected: v.selected, preview: v.preview ?? undefined }),
    [report],
  );
  const onUpgradeView = useCallback(
    (v: { upgrade: string; path: string }) => report(v),
    [report],
  );
  const onLevels = useCallback(
    (levels: Partial<Record<PackId, number>>) =>
      report({ levels: levels as Record<string, number> }),
    [report],
  );
  /** The newest copy of another player's ticket: saved, or scratched along live. */
  const handOf = (id: string) => {
    const saved = state.hands?.[id],
      mirrored = mirrorHands[id];
    if (!mirrored) return saved;
    if (!saved) return mirrored;
    if (mirrored.id === saved.id) return mirrored.sequence > saved.sequence ? mirrored : saved;
    return mirrored.id > saved.id ? mirrored : saved;
  };
  const watched =
    others.find((m) => m.id === watching) ??
    others.find((m) => m.online) ??
    others[0];

  // ---- Notifications: what the others bought and won, and levels opened.
  const [toasts, setToasts] = useState<(FeedEntry & { shown: number })[]>([]);
  const seenFeed = useRef<number | null>(null);
  const feed = state.feed;
  useEffect(() => {
    const list = feed ?? [];
    const top = list.at(-1)?.id ?? 0;
    if (seenFeed.current === null) {
      seenFeed.current = top;
      return;
    }
    const since = seenFeed.current;
    const fresh = list.filter(
      (e) =>
        e.id > since &&
        (e.by !== viewerId || e.kind === 'level' || e.kind === 'max'),
    );
    seenFeed.current = Math.max(since, top);
    if (fresh.length)
      setToasts((t) =>
        [...t, ...fresh.map((e) => ({ ...e, shown: Date.now() }))].slice(-4),
      );
  }, [feed, viewerId]);
  useEffect(() => {
    if (!toasts.length) return;
    const oldest = Math.min(...toasts.map((t) => t.shown));
    const timer = setTimeout(
      () => setToasts((t) => t.filter((x) => Date.now() - x.shown < 4400)),
      Math.max(60, oldest + 4500 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    try {
      localStorage.setItem('gamehub-relic-tab', tab);
    } catch {}
  }, [tab]);
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => {
    audio.setMuted(muted);
  }, [audio, muted]);
  useEffect(() => {
    const sessionId = requestId();
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function activity(forceStop = false) {
      try {
        const response = await fetch(
          `/api/expeditions/${view.token}/activity`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Development test players carry their own guest session.
              ...(devSession() ? { 'X-Gamehub-Dev-Session': devSession()! } : {}),
            },
            body: JSON.stringify({
              sessionId,
              playing: !forceStop && playing(),
            }),
            keepalive: forceStop,
          },
        );
        if (response.ok && !forceStop && !stopped)
          viewRef.current((await response.json()) as ExpeditionView);
      } catch {
        /* The normal poll reports connectivity errors. */
      }
      if (!stopped && !forceStop)
        timer = setTimeout(() => void activity(), 1000);
    }
    void activity();
    const visibility = () => {
      if (document.hidden) {
        audio.stop();
        void activity(true);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      void activity(true);
    };
  }, [view.token, audio]);
  useEffect(() => {
    if (!overlay) return;
    audio.stop();
    const opener = document.activeElement as HTMLElement | null,
      panel = dialog.current;
    const controls = () =>
      [
        ...(panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, [tabindex="0"]',
        ) ?? []),
      ].filter((e) => e.getClientRects().length);
    controls()[0]?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOverlay(null);
      }
      if (event.key === 'Tab') {
        const list = controls(),
          first = list[0],
          last = list.at(-1);
        if (!first) return;
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !panel?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panel?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [overlay, audio]);
  async function act(action: RelicAction, cue?: 'paper' | 'upgrade') {
    await audio.unlock();
    const result = await onAct(action);
    if (result && cue) audio.cue(cue);
    return result;
  }
  // Stable handlers keep the ticket desk and the upgrade tree from redrawing
  // every factory tick.
  const actRef = useRef(act),
    onActRef = useRef(onAct);
  useEffect(() => {
    actRef.current = act;
    onActRef.current = onAct;
  });
  const onBuy = useCallback(
    (pack: PackId, level: number) =>
      actRef.current({ type: 'scratch-open', pack, level }, 'paper'),
    [],
  );
  const onBuyBook = useCallback((id: PackId) => {
    void actRef.current({ type: 'scratch-book', pack: id }, 'upgrade');
  }, []);
  const onStroke = useCallback(
    (
      ticket: number,
      sequence: number,
      batch: { points: { x: number; y: number }[]; breaks?: number[] },
    ) => onActRef.current({ type: 'scratch-stroke', ticket, sequence, ...batch }),
    [],
  );
  const onFactoryAct = useCallback(
    (action: RelicAction) =>
      actRef.current(
        action,
        action.type === 'factory-blueprint' ? 'upgrade' : 'paper',
      ),
    [],
  );
  const onUpgrade = useCallback((id: string) => {
    void actRef.current({ type: 'scratch-upgrade', id }, 'upgrade');
  }, []);
  const rate = liveState.factory.rate;
  return (
    <main
      className="relic-scratch-room"
      ref={root}
      data-tab={tab}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse' && deskPointer())
          publish({ cursor: anchorOf(event) });
      }}
      onPointerLeave={() => publish({ cursor: null })}
    >
      <picture className="scratch-desk-art">
        <source
          media="(orientation: portrait)"
          srcSet="/art/relic/scratch-desk-portrait-v1.webp"
        />
        <img src="/art/relic/scratch-desk-landscape-v1.webp" alt="" />
      </picture>
      {room.table && (
        <TableManager
          table={room.table}
          connected={!room.error}
          disabled={room.busy || room.retry}
          theme="lucky"
          dispatch={room.dispatch}
          error={room.error}
        />
      )}
      <GameNavigation
        name="Lucky"
        onBack={onBack}
        menu={{
          theme: 'lucky',
          onRules: () => setOverlay('help'),
          items: [
            {
              label: 'Players and invitation',
              icon: Users,
              onSelect: () => setOverlay('players'),
            },
            ...(process.env.NODE_ENV === 'development'
              ? [
                  {
                    label: 'Dev: unlimited coins',
                    icon: Coins,
                    pressed: !!game.devUnlimited,
                    onSelect: () =>
                      void act({
                        type: 'dev-unlimited',
                        on: !game.devUnlimited,
                      }),
                  },
                ]
              : []),
          ],
          sound: (
            <SoundToggle
              Icon={Volume2}
              label="Sound effects"
              on={!muted}
              onChange={(on) => {
                setMuted(!on);
                audio.setMuted(!on);
                audio.stop();
                if (on) void audio.unlock();
                try {
                  localStorage.setItem('gamehub-relic-muted', String(!on));
                } catch {}
              }}
            />
          ),
          extra: (
            <>
              <div className="scratch-menu-stats">
                <span>
                  <b>{state.completed}</b> tickets
                </span>
                <span>
                  <b>{formatNumber(state.earned)}</b> earned
                </span>
                <span>
                  <b>{formatNumber(state.best)}</b> best ticket
                </span>
                <span>
                  <b>{formatNumber(state.factory.sold)}</b> factory sales
                </span>
              </div>
              {state.migrationCredit > 0 && (
                <p>
                  Earlier upgrades were refunded:{' '}
                  {formatNumber(state.migrationCredit)} coins.
                </p>
              )}
            </>
          ),
          onLeave: onBack,
          leaveLabel: 'Save and leave',
        }}
        onOthers={others.length ? () => setTv((open) => !open) : undefined}
        othersLabel="Watch"
        progress={`${state.completed} ${state.completed === 1 ? 'ticket' : 'tickets'} · ${PACKS.filter((p) => packOpen(state, p.id)).length}/${PACKS.length} books`}
      />
      <header className="rs-top">
        <div className="rs-tabs" role="tablist" aria-label="Lucky">
          {DESK_TABS.map(({ id, name, icon: Icon }) => {
            const here = others.filter((m) => presence.others[m.id]?.tab === id);
            return (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-label={
                  here.length
                    ? `${name}, ${here.map((m) => m.name).join(', ')} here`
                    : undefined
                }
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                <span>{name}</span>
                {here.length > 0 && (
                  <b className="rs-tab-here" aria-hidden="true">
                    {here.map((m) => (
                      <i
                        key={m.id}
                        style={{ '--player': colours[m.id] } as React.CSSProperties}
                      >
                        {m.name.trim().charAt(0).toUpperCase()}
                      </i>
                    ))}
                  </b>
                )}
              </button>
            );
          })}
        </div>
        <div className="rs-purse">
          <output
            className="rs-wallet"
            aria-label="Coins"
            data-game-motion="change"
            data-game-motion-key={state.completed}
          >
            <Coins size={18} />
            <strong>{formatNumber(live.coins)}</strong>
            <small>{rate >= 0.05 ? `+${formatNumber(rate)}/s` : ''}</small>
          </output>
          <div className="rs-toasts" aria-live="polite">
            {toasts.map((t) => (
              <Toast
                key={t.id}
                entry={t}
                name={names[t.by] ?? ''}
                colour={colours[t.by] ?? PLAYER_COLOURS[0]}
              />
            ))}
          </div>
        </div>
      </header>
      <div className="rs-stage" data-game-motion="stage" data-rs-area="stage">
        {tab === 'tickets' ? (
          <ScratchDesk
            state={state}
            coins={game.coins}
            hand={hand}
            busy={busy}
            audio={audio}
            onBuy={onBuy}
            onBuyBook={onBuyBook}
            onStroke={onStroke}
            onLevels={onLevels}
          />
        ) : tab === 'factory' ? (
          <ScratchFactory
            state={liveState}
            coins={game.coins}
            busy={busy}
            onAct={onFactoryAct}
            onView={onFactoryView}
          />
        ) : (
          <ScratchUpgrades
            state={state}
            coins={game.coins}
            busy={busy}
            onBuy={onUpgrade}
            onView={onUpgradeView}
          />
        )}
      </div>
      <RemoteCursors
        root={root}
        others={Object.values(presence.others)}
        tab={tab}
        colours={colours}
      />
      {tv && watched && (
        <WatchTv
          players={others}
          watching={watched.id}
          presence={presence.others[watched.id]}
          state={liveState}
          coins={live.coins}
          hand={handOf(watched.id)}
          colours={colours}
          onPick={setWatching}
          onClose={() => setTv(false)}
        />
      )}
      {error && (
        <p
          className="scratch-error"
          role="alert"
          data-game-motion="change"
          data-game-motion-key={error}
        >
          {error}
        </p>
      )}
      {overlay && (
        <div className="scratch-modal-backdrop">
          <dialog
            open
            ref={dialog}
            className="scratch-modal"
            data-game-motion="piece"
            data-game-motion-key={overlay}
            aria-modal="true"
            aria-label={
              overlay === 'help' ? 'How to play' : 'Players'
            }
          >
            <button
              className="scratch-modal-close"
              aria-label="Close"
              onClick={() => setOverlay(null)}
            >
              <X size={21} />
            </button>
            {overlay === 'help' ? (
              <>
                <h2>How to play</h2>
                <LuckyRules />
              </>
            ) : overlay === 'players' ? (
              <>
                <h2>Players</h2>
                <ul>
                  {view.members.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
                <label className="scratch-invite">
                  Invitation link
                  <input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/expedition/${view.token}`}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <button
                  className="rs-primary"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(`${location.origin}/expedition/${view.token}`)
                      .then(() => setCopied(true))
                      .catch(() => setCopied(false));
                  }}
                >
                  <Copy size={17} />
                  {copied ? 'Copied' : 'Copy invitation'}
                </button>
              </>
            ) : null}
          </dialog>
        </div>
      )}
    </main>
  );
}
