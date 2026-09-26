'use client';
import { RoomTableSettings, type useRoomTable } from '../online/room-table';
import { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Copy,
  Factory,
  HelpCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  Ticket,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { GameNavigation } from './game-navigation';
import { useGameMotion } from './game-motion';
import {
  formatNumber,
  type ActionResult,
  type RelicAction,
  type RelicGame,
} from '@/lib/games/relic/engine';
import { advanceFactory, TICK_MS } from '@/lib/games/relic/factory';
import { PACKS, packOpen } from '@/lib/games/relic/scratch';
import type { ExpeditionView } from '@/lib/games/relic/types';
import { ScratchAudio } from './relic-scratch-audio';
import { ScratchDesk, WatchTicket } from './relic-scratch-desk';
import { ScratchFactory } from './relic-scratch-factory';
import { ScratchUpgrades } from './relic-scratch-upgrades';
import './relic-scratch.css';

type Tab = 'tickets' | 'factory' | 'upgrades';
const TABS: { id: Tab; name: string; icon: typeof Ticket }[] = [
  { id: 'tickets', name: 'Tickets', icon: Ticket },
  { id: 'factory', name: 'Factory', icon: Factory },
  { id: 'upgrades', name: 'Upgrades', icon: Sparkles },
];
function playing() {
  return !document.hidden && document.hasFocus();
}
/** The factory moves smoothly between server snapshots by running the same
 * deterministic step locally; every snapshot replaces the prediction. */
function usePredicted(game: RelicGame) {
  const [live, setLive] = useState(() => ({ source: game, game }));
  const latest = useRef(live);
  useEffect(() => {
    latest.current = live;
  });
  let current = live;
  if (live.source !== game) {
    current = { source: game, game };
    setLive(current);
  }
  useEffect(() => {
    let at = performance.now(),
      pending = 0,
      seen = latest.current.source;
    const timer = window.setInterval(() => {
      const now = performance.now(),
        ms = Math.min(2500, now - at),
        g = latest.current.game;
      at = now;
      // A fresh snapshot already contains the time waited so far.
      if (latest.current.source !== seen) {
        seen = latest.current.source;
        pending = 0;
      }
      if (!playing() || !g.scratch?.factory.machines.length) return;
      pending += ms;
      if (g.scratch.factory.clock + pending < TICK_MS) return;
      const next = structuredClone(g);
      advanceFactory(next, pending);
      pending = 0;
      const value = { source: latest.current.source, game: next };
      latest.current = value;
      setLive(value);
    }, 100);
    return () => clearInterval(timer);
  }, []);
  return current.game;
}
export function RelicScratch({
  room,
  view,
  busy,
  error,
  onAct,
  onView,
  onBack,
}: {
  room: ReturnType<typeof useRoomTable>;
  view: ExpeditionView;
  busy: boolean;
  error: string;
  onAct: (action: RelicAction) => Promise<ActionResult | null>;
  onView: (view: ExpeditionView) => void;
  onBack: () => void;
}) {
  const game = view.game,
    state = game.scratch!,
    hand = state.hands?.[view.viewerId];
  const live = usePredicted(game),
    liveState = live.scratch!;
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem('gamehub-relic-tab');
      return saved === 'factory' || saved === 'upgrades' ? saved : 'tickets';
    } catch {
      return 'tickets';
    }
  });
  const [watching, setWatching] = useState<string | null>(null);
  const others = view.members.filter((m) => m.id !== view.viewerId);
  const watched = others.find((m) => m.id === watching) ?? others[0];
  const [overlay, setOverlay] = useState<'menu' | 'others' | 'players' | 'help' | null>(
    null,
  );
  const [muted, setMuted] = useState(() => {
      try {
        return localStorage.getItem('gamehub-relic-muted') === 'true';
      } catch {
        return false;
      }
    }),
    [copied, setCopied] = useState(false),
    [fullscreen, setFullscreen] = useState(false);
  const [audio] = useState(() => new ScratchAudio());
  const root = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    viewRef = useRef(onView);
  useGameMotion(root, tab);
  useEffect(() => {
    viewRef.current = onView;
  }, [onView]);
  useEffect(() => {
    try {
      localStorage.setItem('gamehub-relic-tab', tab);
    } catch {}
  }, [tab]);
  useEffect(() => {
    const listener = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', listener);
    return () => {
      audio.dispose();
      document.removeEventListener('fullscreenchange', listener);
    };
  }, [audio]);
  useEffect(() => {
    audio.setMuted(muted);
  }, [audio, muted]);
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function activity(forceStop = false) {
      try {
        const response = await fetch(
          `/api/expeditions/${view.token}/activity`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else await root.current?.requestFullscreen?.();
    } catch {
      /* Fullscreen is optional on unsupported devices. */
    }
  }
  const rate = liveState.factory.rate;
  return (
    <main className="relic-scratch-room" ref={root} data-tab={tab}>
      <picture className="scratch-desk-art">
        <source
          media="(orientation: portrait)"
          srcSet="/art/relic/scratch-desk-portrait-v1.webp"
        />
        <img src="/art/relic/scratch-desk-landscape-v1.webp" alt="" />
      </picture>
      <GameNavigation
        name="Lucky"
        onBack={onBack}
        onMenu={() => setOverlay('menu')}
        onOthers={view.members.length > 1 ? () => setOverlay('others') : undefined}
        othersLabel="Watch"
        progress={`${state.completed} ${state.completed === 1 ? 'ticket' : 'tickets'} · ${PACKS.filter((p) => packOpen(state, p.id)).length}/${PACKS.length} books`}
      />
      <header className="rs-top">
        <div className="rs-tabs" role="tablist" aria-label="Lucky">
          {TABS.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              <span>{name}</span>
            </button>
          ))}
        </div>
        <output
          className="rs-wallet"
          aria-label="Coins"
          data-game-motion="change"
          data-game-motion-key={state.completed}
        >
          <Coins size={18} />
          <strong>{formatNumber(live.coins)}</strong>
          {rate >= 0.05 && <small>+{formatNumber(rate)}/s</small>}
        </output>
      </header>
      <div className="rs-quick">
        <button
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            audio.setMuted(next);
            audio.stop();
            if (!next) void audio.unlock();
            try {
              localStorage.setItem('gamehub-relic-muted', String(next));
            } catch {}
          }}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <button aria-label="How to play" onClick={() => setOverlay('help')}>
          <HelpCircle size={17} />
        </button>
        {typeof document !== 'undefined' && document.fullscreenEnabled && (
          <button
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        )}
      </div>
      <div className="rs-stage" data-game-motion="stage">
        {tab === 'tickets' ? (
          <ScratchDesk
            state={state}
            coins={game.coins}
            hand={hand}
            busy={busy}
            audio={audio}
            onBuy={(pack, level) =>
              act({ type: 'scratch-open', pack, level }, 'paper')
            }
            onBuyBook={(id) => {
              void act({ type: 'scratch-book', pack: id }, 'upgrade');
            }}
            onStroke={(ticket, sequence, batch) =>
              onAct({ type: 'scratch-stroke', ticket, sequence, ...batch })
            }
          />
        ) : tab === 'factory' ? (
          <ScratchFactory
            state={liveState}
            coins={game.coins}
            busy={busy}
            onAct={(action) =>
              act(action, action.type === 'factory-blueprint' ? 'upgrade' : 'paper')
            }
          />
        ) : (
          <ScratchUpgrades
            state={state}
            coins={game.coins}
            busy={busy}
            onBuy={(id) => void act({ type: 'scratch-upgrade', id }, 'upgrade')}
          />
        )}
      </div>
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
            className={`scratch-modal ${overlay === 'others' ? 'rs-watch-modal' : ''}`}
            data-game-motion="piece"
            data-game-motion-key={overlay}
            aria-modal="true"
            aria-label={
              overlay === 'help'
                ? 'How to play'
                : overlay === 'others'
                  ? 'Watch'
                  : overlay === 'players' ? 'Players'
                  : 'Lucky menu'
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
                <div className="scratch-help">
                  <p>
                    <b>Tickets.</b> Buy a ticket from a book on the shelf; it
                    opens in your hand. Hold and rub the foil; keyboard: arrows
                    to move, hold Space to scratch. A ticket pays the moment it
                    is over, and <b>Again</b> buys the same one.
                  </p>
                  <p>
                    <b>Price.</b> A ticket costs half of what a careful player
                    wins with it. A perfect ticket pays the jackpot; a messy one
                    can lose. With an empty purse Lucky Seven I is free.
                  </p>
                  <ul>
                    <li>
                      <b>Lucky Seven:</b> each miss shows an arrow toward the
                      nearest 7. Find every 7 before the misses run out; the
                      misses left then scratch themselves.
                    </li>
                    <li>
                      <b>Twins:</b> the ticket splits into side-by-side pairs
                      printed with the same number, in exactly one way. Scratch
                      a seal, then its twin; a wrong twin is a mistake.
                    </li>
                    <li>
                      <b>Garden:</b> start at 1 and draw one path through every
                      seal, numbers in order, never across a hedge.
                    </li>
                    <li>
                      <b>Ladder:</b> the card at the bottom is printed. On each
                      rung scratch ▲ if you think the next card is higher, ▼ if
                      lower. Every card appears once, so count what is left.
                      Higher rungs pay more.
                    </li>
                    <li>
                      <b>Gold Mine:</b> numbers count the dynamite around them.
                    </li>
                    <li>
                      <b>Sun &amp; Moon:</b> each row and column holds as many
                      suns as moons, never three alike in a line; = and × join
                      equal and opposite seals. Scratch only the moons.
                    </li>
                    <li>
                      <b>Sea Chart:</b> the edge numbers count ship parts in
                      each row and column; ships never touch.
                    </li>
                    <li>
                      <b>Crown Jewels:</b> one crown in every row, column and
                      colour, and crowns never touch.
                    </li>
                  </ul>
                  <p>
                    <b>Levels.</b> Playing a book opens harder levels that pay
                    more. You can always go back to an easier one.
                  </p>
                  <p>
                    <b>Upgrades.</b> Each branch opens as you buy the upgrade
                    before it. Books get their own upgrades once they are on the
                    shelf.
                  </p>
                  <p>
                    <b>Factory.</b> Printers make tickets, bots scratch them,
                    cashiers sell them. Link them with belts. Drag to draw
                    belts, drag a machine to move it, R to rotate, right-click
                    to turn a machine. It runs while this page is open.
                  </p>
                  <p>
                    <b>Together.</b> Coins, books, the factory and upgrades are
                    shared. Everyone holds their own ticket.
                  </p>
                </div>
              </>
            ) : overlay === 'others' || overlay === 'players' ? (
              <>
                <h2>{overlay === 'others' ? 'Watch' : 'Players'}</h2>
                {overlay === 'others' && <>
                <div className="scratch-members rs-watch-players">
                  {others.map((m) => (
                    <button key={m.id} aria-pressed={watched?.id === m.id} onClick={() => setWatching(m.id)}>
                      <i className={m.online ? 'is-online' : ''} />{m.name}
                    </button>
                  ))}
                </div>
                {watched && state.hands?.[watched.id]
                  ? <WatchTicket ticket={state.hands[watched.id]} state={state} audio={audio} />
                  : <p>No ticket in hand.</p>}
                </>}
                {overlay === 'players' && <>
                <ul>{view.members.map((m) => <li key={m.id}>{m.name}</li>)}</ul>
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
                </>}
              </>
            ) : (
              <>
                <h2>Lucky</h2>
                <RoomTableSettings room={room} />
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
                <button
                  className="scratch-menu-item"
                  onClick={() => setOverlay('help')}
                >
                  <HelpCircle />
                  How to play
                </button>
                <button
                  className="scratch-menu-item"
                  onClick={() => setOverlay('players')}
                >
                  <Users />
                  Players and invitation
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    className="scratch-menu-item"
                    aria-pressed={!!game.devUnlimited}
                    onClick={() =>
                      void act({
                        type: 'dev-unlimited',
                        on: !game.devUnlimited,
                      })
                    }
                  >
                    <Coins />
                    Dev: unlimited coins {game.devUnlimited ? 'on' : 'off'}
                  </button>
                )}
              </>
            )}
          </dialog>
        </div>
      )}
    </main>
  );
}
