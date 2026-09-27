'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Coins,
  Factory,
  Maximize2,
  Minimize2,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { formatNumber } from '@/lib/games/relic/engine';
import type { Dir, MachineKind } from '@/lib/games/relic/factory';
import type {
  PackId,
  ScratchState,
  ScratchTicket,
} from '@/lib/games/relic/scratch';
import type { ScratchAudio } from './relic-scratch-audio';
import { ScratchDesk } from './relic-scratch-desk';
import { ScratchFactory, type FactoryView } from './relic-scratch-factory';
import { ScratchUpgrades } from './relic-scratch-upgrades';
import { pointFor, type Cursor, type DeskTab, type Presence } from './relic-presence';

export const DESK_TABS: { id: DeskTab; name: string; icon: typeof Ticket }[] = [
  { id: 'tickets', name: 'Tickets', icon: Ticket },
  { id: 'factory', name: 'Factory', icon: Factory },
  { id: 'upgrades', name: 'Upgrades', icon: Sparkles },
];
const noop = async () => null;
/** The TV makes no sound. */
const SILENT = {
  unlock: async () => {},
  cue() {},
  scratch() {},
  stop() {},
  setMuted() {},
  dispose() {},
} as unknown as ScratchAudio;
const EMPTY_FRAME = '<!doctype html><html><head></head><body></body></html>';

/** A same-origin frame the size of the other player's screen, so their own
 * layout (phone or desktop) is drawn, then scaled down into the TV. The page's
 * stylesheets are copied in, and follow along when they change. */
function Frame({
  width,
  height,
  scale,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: MutationObserver | undefined;
    const copy = (doc: Document) => {
      for (const n of doc.head.querySelectorAll('[data-rs-copied]')) n.remove();
      for (const n of document.head.querySelectorAll(
        'link[rel="stylesheet"], style',
      )) {
        const clone = n.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-rs-copied', '');
        doc.head.appendChild(clone);
      }
    };
    const setup = () => {
      const doc = frame.contentDocument;
      if (!doc?.body || doc.body.dataset.rsReady) return;
      doc.body.dataset.rsReady = '1';
      for (const { name, value } of document.documentElement.attributes)
        doc.documentElement.setAttribute(name, value);
      doc.body.className = document.body.className;
      doc.body.style.margin = '0';
      doc.body.style.overflow = 'hidden';
      copy(doc);
      observer = new MutationObserver(() => copy(doc));
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
      setBody(doc.body);
    };
    frame.addEventListener('load', setup);
    // The blank page a frame starts with is replaced by its srcdoc: wait for it.
    if (
      frame.contentDocument?.readyState === 'complete' &&
      frame.contentDocument.URL === 'about:srcdoc'
    )
      setup();
    return () => {
      frame.removeEventListener('load', setup);
      observer?.disconnect();
    };
  }, []);
  return (
    <>
      <iframe
        ref={ref}
        className="rs-tv-frame"
        title="Watch"
        aria-hidden="true"
        tabIndex={-1}
        srcDoc={EMPTY_FRAME}
        style={{ width, height, transform: `scale(${scale})` }}
      />
      {body && createPortal(children, body)}
    </>
  );
}
/** The other player's pointer inside their mirrored screen. */
function MirrorCursor({ cursor, colour }: { cursor: Cursor | null; colour: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const at = cursor && pointFor(cursor, el.ownerDocument);
    el.style.opacity = at ? '1' : '0';
    if (at) el.style.transform = `translate(${at.x}px, ${at.y}px)`;
  });
  return (
    <span
      ref={ref}
      className="rs-cursor is-mirror"
      style={{ '--player': colour } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 20" width="22" height="27">
        <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" />
      </svg>
    </span>
  );
}
/** Their screen as they see it: the tab they are on, their ticket, their
 * factory tool and selection, the upgrade they are reading. */
function MirrorRoom({
  presence,
  state,
  coins,
  hand,
  colour,
}: {
  presence: Presence | undefined;
  state: ScratchState;
  coins: number;
  hand: ScratchTicket | undefined;
  colour: string;
}) {
  const tab = presence?.tab ?? 'tickets',
    view = presence?.view ?? {};
  const factoryView: FactoryView = {
    tool: (view.tool as FactoryView['tool']) ?? 'select',
    dir: ((view.dir ?? 0) % 4) as Dir,
    selected: view.selected ?? [],
    preview: (view.preview as MachineKind | undefined) ?? null,
  };
  return (
    <main className="relic-scratch-room is-mirror" data-tab={tab}>
      <picture className="scratch-desk-art">
        <source
          media="(orientation: portrait)"
          srcSet="/art/relic/scratch-desk-portrait-v1.webp"
        />
        <img src="/art/relic/scratch-desk-landscape-v1.webp" alt="" />
      </picture>
      <header className="rs-top">
        <div className="rs-tabs" role="tablist">
          {DESK_TABS.map(({ id, name, icon: Icon }) => (
            <button key={id} role="tab" tabIndex={-1} aria-selected={tab === id}>
              <Icon size={16} />
              <span>{name}</span>
            </button>
          ))}
        </div>
        <output className="rs-wallet">
          <Coins size={18} />
          <strong>{formatNumber(coins)}</strong>
        </output>
      </header>
      <div className="rs-stage" data-rs-area="stage">
        {tab === 'tickets' ? (
          <ScratchDesk
            readOnly
            state={state}
            coins={coins}
            hand={hand}
            busy={false}
            audio={SILENT}
            levels={view.levels as Partial<Record<PackId, number>> | undefined}
            onBuy={noop}
            onBuyBook={noop}
            onStroke={noop}
          />
        ) : tab === 'factory' ? (
          <ScratchFactory
            readOnly
            mirror={factoryView}
            state={state}
            coins={coins}
            busy={false}
            onAct={noop}
          />
        ) : (
          <ScratchUpgrades
            state={state}
            coins={coins}
            busy={false}
            onBuy={noop}
            mirror={{ upgrade: view.upgrade, path: view.path }}
          />
        )}
      </div>
      <MirrorCursor cursor={presence?.cursor ?? null} colour={colour} />
    </main>
  );
}
type Corner = 'br' | 'bl' | 'tr' | 'tl';
/** Phones start the TV at the top, clear of Buy, Again and the palette. */
function rememberedCorner(): Corner {
  const fallback =
    typeof window !== 'undefined' && window.innerWidth <= 600 ? 'tr' : 'br';
  try {
    const c = localStorage.getItem('gamehub-lucky-tv-corner');
    return c === 'bl' || c === 'br' || c === 'tr' || c === 'tl' ? c : fallback;
  } catch {
    return fallback;
  }
}
/** Watch: a little TV in a corner showing another player's whole screen,
 * live. Drag it by its top to another corner. */
export function WatchTv({
  players,
  watching,
  presence,
  state,
  coins,
  hand,
  colours,
  onPick,
  onClose,
}: {
  players: { id: string; name: string; online: boolean }[];
  watching: string;
  presence: Presence | undefined;
  state: ScratchState;
  coins: number;
  hand: ScratchTicket | undefined;
  colours: Record<string, string>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [big, setBig] = useState(false),
    [corner, setCorner] = useState<Corner>(rememberedCorner),
    [drag, setDrag] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null),
    [viewport, setViewport] = useState(() => ({
      w: typeof window === 'undefined' ? 1280 : window.innerWidth,
      h: typeof window === 'undefined' ? 800 : window.innerHeight,
    }));
  const tv = useRef<HTMLElement>(null);
  useEffect(() => {
    const resize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const screen = presence?.screen ?? { w: 1280, h: 800 };
  const narrow = viewport.w <= 600;
  const maxW = narrow ? Math.min(200, viewport.w * 0.52) : big ? 720 : 400,
    maxH = narrow ? 170 : big ? Math.min(520, viewport.h * 0.6) : 290;
  const scale = Math.min(maxW / screen.w, maxH / screen.h),
    width = Math.round(screen.w * scale),
    height = Math.round(screen.h * scale);
  const player = players.find((p) => p.id === watching);
  const colour = colours[watching] ?? '#f0b64d';
  const place = (c: Corner) => {
    setCorner(c);
    try {
      localStorage.setItem('gamehub-lucky-tv-corner', c);
    } catch {}
  };
  return (
    <aside
      ref={tv}
      className={`rs-tv is-${corner} ${drag ? 'is-dragging' : ''}`}
      aria-label={`${player?.name ?? 'Player'}'s screen`}
      style={
        {
          '--player': colour,
          ...(drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : {}),
        } as React.CSSProperties
      }
    >
      <div
        className="rs-tv-head"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
        }}
        onPointerMove={(event) => {
          if (drag)
            setDrag({ ...drag, dx: event.clientX - drag.x, dy: event.clientY - drag.y });
        }}
        onPointerUp={() => {
          if (!drag) return;
          setDrag(null);
          const r = tv.current?.getBoundingClientRect();
          if (!r || Math.hypot(drag.dx, drag.dy) < 12) return;
          const cx = r.left + r.width / 2,
            cy = r.top + r.height / 2;
          place(`${cy < viewport.h / 2 ? 't' : 'b'}${cx < viewport.w / 2 ? 'l' : 'r'}` as Corner);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <div className="rs-tv-players">
          {players.map((p) => (
            <button
              key={p.id}
              aria-pressed={p.id === watching}
              style={{ '--player': colours[p.id] } as React.CSSProperties}
              onClick={() => onPick(p.id)}
            >
              <i className={p.online ? 'is-online' : ''} />
              {p.name}
            </button>
          ))}
        </div>
        {!narrow && (
          <button
            className="rs-tv-button"
            aria-label={big ? 'Smaller' : 'Bigger'}
            onClick={() => setBig((b) => !b)}
          >
            {big ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        <button className="rs-tv-button" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className={`rs-tv-screen ${presence ? '' : 'is-static'}`} style={{ width, height }}>
        <Frame width={screen.w} height={screen.h} scale={scale}>
          <MirrorRoom
            presence={presence}
            state={state}
            coins={coins}
            hand={hand}
            colour={colour}
          />
        </Frame>
      </div>
    </aside>
  );
}
