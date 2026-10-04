'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { devSession } from '@/lib/online/client';
import { floorProjectors } from './relic-factory/anchor';

export type DeskTab = 'tickets' | 'factory' | 'upgrades';
/** The pointer, anchored to what is under it: floor cells in the factory,
 * otherwise 0–1 across the shelf, the ticket, the upgrade tree or the stage. */
export type Cursor = { area: string; x: number; y: number };
export type PresenceView = {
  upgrade?: string;
  path?: string;
  tool?: string;
  dir?: number;
  preview?: string;
  selected?: { x: number; y: number }[];
  levels?: Record<string, number>;
};
export type Presence = {
  session: string;
  member: string;
  name: string;
  tab: DeskTab;
  cursor: Cursor | null;
  view: PresenceView;
  screen: { w: number; h: number };
  desktop: boolean;
  at: number;
};
export type StrokeEvent = {
  by: string;
  ticket: number;
  sequence: number;
  points: { x: number; y: number }[];
  breaks?: number[];
};
function randomSession() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
    n.toString(16).padStart(8, '0'),
  ).join('');
}
/** Cursors and the Watch TV are for a mouse on a wide screen. */
export function deskPointer() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches &&
    window.innerWidth >= 900
  );
}
/** Where a pointer is, anchored to the area under it. */
export function anchorOf(event: {
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}): Cursor | null {
  const el = (event.target as Element | null)?.closest?.(
    '[data-rs-area]',
  ) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect(),
    area = el.dataset.rsArea!;
  if (!r.width || !r.height) return null;
  if (area === 'floor') {
    const projector = floorProjectors.get(el);
    if (projector) {
      const p = projector.toFloor(event.clientX, event.clientY);
      return p ? { area, x: round(p.x), y: round(p.y) } : null;
    }
    const cell = Number(el.dataset.cell) || 48,
      rows = Number(el.dataset.rows) || 0,
      sx = (event.clientX - r.left) / cell,
      sy = (event.clientY - r.top) / cell;
    const turned = el.dataset.turned !== undefined;
    return {
      area,
      x: round(turned ? sy : sx),
      y: round(turned ? rows - sx : sy),
    };
  }
  return {
    area,
    x: round((event.clientX - r.left) / r.width),
    y: round((event.clientY - r.top) / r.height),
  };
}
const round = (v: number) => Math.round(v * 1000) / 1000;
/** Where an anchored pointer falls in a document, in its viewport pixels. */
export function pointFor(
  cursor: Cursor,
  doc: Document,
): { x: number; y: number } | null {
  const el = doc.querySelector<HTMLElement>(`[data-rs-area="${cursor.area}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  if (cursor.area === 'floor') {
    const projector = floorProjectors.get(el);
    if (projector) return projector.toPage(cursor.x, cursor.y);
    const cell = Number(el.dataset.cell) || 48,
      rows = Number(el.dataset.rows) || 0,
      turned = el.dataset.turned !== undefined;
    const sx = turned ? rows - cursor.y : cursor.x,
      sy = turned ? cursor.x : cursor.y;
    return { x: r.left + sx * cell, y: r.top + sy * cell };
  }
  return { x: r.left + cursor.x * r.width, y: r.top + cursor.y * r.height };
}
/** Colours for the other players' cursors, by seat. */
export const PLAYER_COLOURS = ['#f0b64d', '#7fc6e8', '#ef8c7a', '#b39ae6'];

/** A live line to the rest of the desk: everyone's tab, view and pointer, and
 * a nudge whenever the desk changes, so nobody waits for the next poll. */
export function useDeskPresence(
  token: string,
  handlers: {
    onChanged: () => void;
    onStroke: (event: StrokeEvent) => void;
  },
) {
  const [session] = useState(randomSession);
  const [others, setOthers] = useState<Record<string, Presence>>({});
  const mine = useRef<Omit<Presence, 'session' | 'member' | 'name' | 'at'>>({
    tab: 'tickets',
    cursor: null,
    view: {},
    screen: { w: 1280, h: 800 },
    desktop: false,
  });
  const sent = useRef({
    at: 0,
    timer: 0 as ReturnType<typeof setTimeout> | 0,
    body: '',
  });
  const on = useRef(handlers);
  useEffect(() => {
    on.current = handlers;
  });
  const flush = useCallback(() => {
    sent.current.timer = 0;
    const body = JSON.stringify({ session, ...mine.current });
    if (body === sent.current.body) return;
    sent.current.body = body;
    sent.current.at = performance.now();
    const dev = devSession();
    void fetch(`/api/expeditions/${token}/presence`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(dev ? { 'X-Gamehub-Dev-Session': dev } : {}),
      },
      body,
      keepalive: body.length < 60000,
    }).catch(() => {
      /* Presence is best effort; the next change sends it again. */
    });
  }, [session, token]);
  /** Updates what this player shows; sent at most every 80 ms. */
  const publish = useCallback(
    (next: Partial<typeof mine.current>) => {
      mine.current = { ...mine.current, ...next };
      if (sent.current.timer) return;
      const wait = Math.max(0, 80 - (performance.now() - sent.current.at));
      sent.current.timer = setTimeout(flush, wait);
    },
    [flush],
  );
  useEffect(() => {
    const dev = devSession();
    const url = `/api/expeditions/${token}/events?session=${session}${dev ? `&dev_session=${dev}` : ''}`;
    const events = new EventSource(url);
    events.addEventListener('presence', (e) => {
      const p = JSON.parse((e as MessageEvent).data) as Presence;
      setOthers((list) => ({ ...list, [p.session]: p }));
    });
    events.addEventListener('leave', (e) => {
      const { session: gone } = JSON.parse((e as MessageEvent).data) as {
        session: string;
      };
      setOthers((list) => {
        if (!list[gone]) return list;
        const next = { ...list };
        delete next[gone];
        return next;
      });
    });
    events.addEventListener('changed', () => on.current.onChanged());
    events.addEventListener('stroke', (e) =>
      on.current.onStroke(JSON.parse((e as MessageEvent).data) as StrokeEvent),
    );
    // Reconnecting: announce ourselves again for anyone who joined meanwhile.
    events.addEventListener('open', () => {
      sent.current.body = '';
      publish({});
    });
    const outbox = sent.current;
    const heartbeat = setInterval(() => {
      outbox.body = '';
      publish({});
    }, 10000);
    return () => {
      clearInterval(heartbeat);
      clearTimeout(outbox.timer || undefined);
      events.close();
    };
  }, [token, session, publish]);
  // Everyone's latest session per player: a second tab replaces the first.
  const byMember: Record<string, Presence> = {};
  for (const p of Object.values(others))
    if (!byMember[p.member] || byMember[p.member].at < p.at)
      byMember[p.member] = p;
  return { session, others: byMember, publish };
}

/** The other players' pointers, drawn over the same area of this screen when
 * both are on the factory or upgrades tab with a mouse (never over tickets). */
export function RemoteCursors({
  root,
  others,
  tab,
  colours,
}: {
  root: React.RefObject<HTMLElement | null>;
  others: Presence[];
  tab: DeskTab;
  colours: Record<string, string>;
}) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const again = () => redraw((n) => n + 1);
    window.addEventListener('resize', again);
    return () => window.removeEventListener('resize', again);
  }, []);
  const element = root.current;
  if (!element || tab === 'tickets' || !deskPointer()) return null;
  const box = element.getBoundingClientRect();
  return (
    <div className="rs-cursors" aria-hidden="true">
      {others.map((p) => {
        if (!p.desktop || p.tab !== tab || !p.cursor) return null;
        const at = pointFor(p.cursor, element.ownerDocument);
        if (!at) return null;
        return (
          <span
            key={p.member}
            className="rs-cursor"
            style={
              {
                '--player': colours[p.member] ?? PLAYER_COLOURS[0],
                transform: `translate(${at.x - box.left}px, ${at.y - box.top}px)`,
              } as React.CSSProperties
            }
          >
            <svg viewBox="0 0 16 20" width="16" height="20">
              <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" />
            </svg>
            <b>{p.name}</b>
          </span>
        );
      })}
    </div>
  );
}
