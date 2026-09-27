import type { ServerResponse } from 'node:http';
import { check, type Identity } from './auth.ts';

/** Where a Lucky player is looking, relayed live to the others at the desk:
 * their tab, what that tab shows and their pointer. Nothing here is saved or
 * trusted by the game; it only draws cursors and the Watch TV. */
export type Presence = {
  session: string;
  member: string;
  name: string;
  tab: 'tickets' | 'factory' | 'upgrades';
  /** The pointer, anchored to the area under it (floor cells, or 0–1 of the
   * shelf, ticket, tree or stage box). */
  cursor: { area: string; x: number; y: number } | null;
  /** Small, tab-specific view details (selected upgrade, factory tool…). */
  view: Record<string, unknown>;
  screen: { w: number; h: number };
  desktop: boolean;
  at: number;
};
type Listener = { res: ServerResponse; member: string; session: string };
const TABS = new Set(['tickets', 'factory', 'upgrades']);
const AREAS = new Set(['floor', 'shelf', 'ticket', 'tree', 'stage']);
const SESSION = /^[A-Za-z0-9_-]{16,80}$/;
const WORD = /^[a-z0-9-]{1,40}$/;
function number(v: unknown, min: number, max: number) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}
/** Keeps only the view fields the TV draws, each checked and bounded. */
function cleanView(raw: unknown): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return view;
  const v = raw as Record<string, unknown>;
  for (const key of ['upgrade', 'path', 'tool', 'preview'])
    if (typeof v[key] === 'string' && WORD.test(v[key] as string))
      view[key] = v[key];
  if (Number.isInteger(v.dir) && number(v.dir, 0, 3)) view.dir = v.dir;
  if (Array.isArray(v.selected))
    view.selected = v.selected
      .slice(0, 144)
      .filter(
        (c) =>
          c &&
          Number.isInteger((c as { x: number }).x) &&
          Number.isInteger((c as { y: number }).y) &&
          number((c as { x: number }).x, 0, 63) &&
          number((c as { y: number }).y, 0, 63),
      )
      .map((c) => ({ x: (c as { x: number }).x, y: (c as { y: number }).y }));
  if (v.levels && typeof v.levels === 'object' && !Array.isArray(v.levels)) {
    const levels: Record<string, number> = {};
    for (const [book, lvl] of Object.entries(v.levels).slice(0, 12))
      if (WORD.test(book) && Number.isInteger(lvl) && number(lvl, 0, 2))
        levels[book] = lvl as number;
    view.levels = levels;
  }
  return view;
}
export class DeskPresence {
  private listeners = new Map<string, Set<Listener>>();
  private seen = new Map<string, Map<string, Presence>>();
  private timer = setInterval(() => this.sweep(), 15000);
  constructor() {
    this.timer.unref?.();
  }
  private send(invite: string, event: string, data: unknown, except?: string) {
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const l of this.listeners.get(invite) ?? []) {
      if (l.session === except) continue;
      if (l.res.writableLength > 256000) {
        l.res.destroy();
        continue;
      }
      l.res.write(line);
    }
  }
  /** Opens a player's live stream: everyone else's presence now, then changes. */
  connect(invite: string, who: Identity, session: string, res: ServerResponse) {
    check(SESSION.test(session), 400, 'Invalid play session.');
    const set = this.listeners.get(invite) ?? new Set<Listener>();
    check(set.size < 24, 429, 'Too many open connections.');
    this.listeners.set(invite, set);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const listener = { res, member: who.id, session };
    set.add(listener);
    for (const p of this.seen.get(invite)?.values() ?? [])
      if (p.session !== session)
        res.write(`event: presence\ndata: ${JSON.stringify(p)}\n\n`);
    res.on('close', () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(invite);
      this.seen.get(invite)?.delete(session);
      this.send(invite, 'leave', { session, member: who.id });
    });
  }
  /** A player's latest view, passed straight on to the others. */
  post(invite: string, who: Identity, input: Record<string, unknown>, now = Date.now()) {
    check(typeof input.session === 'string' && SESSION.test(input.session), 400, 'Invalid play session.');
    check(typeof input.tab === 'string' && TABS.has(input.tab), 400, 'Choose a tab.');
    const c = input.cursor as { area?: unknown; x?: unknown; y?: unknown } | null;
    const cursor =
      c && typeof c === 'object' && typeof c.area === 'string' && AREAS.has(c.area) && number(c.x, -2, 70) && number(c.y, -2, 70)
        ? { area: c.area, x: c.x as number, y: c.y as number }
        : null;
    const s = input.screen as { w?: unknown; h?: unknown } | undefined;
    const presence: Presence = {
      session: input.session as string,
      member: who.id,
      name: who.name,
      tab: input.tab as Presence['tab'],
      cursor,
      view: cleanView(input.view),
      screen:
        s && number(s.w, 200, 8000) && number(s.h, 200, 8000)
          ? { w: Math.round(s.w as number), h: Math.round(s.h as number) }
          : { w: 1280, h: 800 },
      desktop: input.desktop === true,
      at: now,
    };
    const seen = this.seen.get(invite) ?? new Map<string, Presence>();
    this.seen.set(invite, seen);
    seen.set(presence.session, presence);
    this.send(invite, 'presence', presence, presence.session);
    return { ok: true };
  }
  /** The desk changed: others fetch it now instead of at their next poll.
   * Strokes carry their points, so a Watch TV scratches along live. */
  changed(invite: string, data: Record<string, unknown>) {
    this.send(invite, data.stroke ? 'stroke' : 'changed', data);
  }
  private sweep(now = Date.now()) {
    for (const [invite, seen] of this.seen) {
      for (const [session, p] of seen)
        if (now - p.at > 30000) {
          seen.delete(session);
          this.send(invite, 'leave', { session, member: p.member });
        }
      if (!seen.size) this.seen.delete(invite);
    }
    for (const set of this.listeners.values())
      for (const l of set) l.res.write(': ping\n\n');
  }
  close() {
    clearInterval(this.timer);
    for (const set of this.listeners.values()) for (const l of set) l.res.end();
    this.listeners.clear();
  }
}
