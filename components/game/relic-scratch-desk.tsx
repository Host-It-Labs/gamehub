'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Coins, Heart, Lock, Plus, Star, X } from 'lucide-react';
import { formatNumber, type ActionResult } from '@/lib/games/relic/engine';
import {
  LEVEL_AT,
  PACKS,
  TABLE_MAX,
  jackpot,
  levelOpen,
  nextBook,
  packFor,
  packOpen,
  type PackId,
  type ScratchState,
  type ScratchTicket,
} from '@/lib/games/relic/scratch';
import { useCountUp } from './reveal-motion';
import type { ScratchAudio } from './relic-scratch-audio';
import { ScratchSurface } from './relic-scratch-surface';
import { TICKET_ART } from './relic-scratch-art';

const LEVEL_NAMES = ['I', 'II', 'III'];
type Take = (pack: PackId, level: number) => Promise<ActionResult | null>;
function useLevels(state: ScratchState) {
  const [chosen, setChosen] = useState<Partial<Record<PackId, number>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('gamehub-lucky-levels') ?? '{}');
    } catch {
      return {};
    }
  });
  const levelOf = (id: PackId) =>
    Math.min(chosen[id] ?? levelOpen(state, id), levelOpen(state, id));
  const choose = (id: PackId, level: number) => {
    const next = { ...chosen, [id]: level };
    setChosen(next);
    try {
      localStorage.setItem('gamehub-lucky-levels', JSON.stringify(next));
    } catch {}
  };
  return { levelOf, choose };
}
/** The ticket books: take a ticket onto the table, choose its level. */
function Shelf({
  state,
  coins,
  busy,
  full,
  levelOf,
  choose,
  onTake,
  onBuyBook,
}: {
  state: ScratchState;
  coins: number;
  busy: boolean;
  full: boolean;
  levelOf: (id: PackId) => number;
  choose: (id: PackId, level: number) => void;
  onTake: (id: PackId) => void;
  onBuyBook: (id: PackId) => void;
}) {
  const forSale = nextBook(state);
  return (
    <nav className="rs-shelf" aria-label="Ticket books">
      {PACKS.map((p, i) => {
        const open = packOpen(state, p.id),
          sale = forSale?.id === p.id;
        if (!open && !sale)
          return (
            <div className="rs-book is-hidden" key={p.id}>
              <span className="rs-book-cover">
                <Lock size={14} />
              </span>
              <span className="rs-book-text">
                <b>Book {i + 1}</b>
                <small>
                  <Coins size={11} />
                  {formatNumber(p.price)}
                </small>
              </span>
            </div>
          );
        if (!open)
          return (
            <button
              key={p.id}
              className="rs-book is-for-sale"
              style={{ '--book': p.color } as React.CSSProperties}
              disabled={busy || coins < p.price}
              onClick={() => onBuyBook(p.id)}
            >
              <span className="rs-book-cover">
                <img src={TICKET_ART[p.id].small} alt="" />
                <Lock size={14} className="rs-book-lock" />
              </span>
              <span className="rs-book-text">
                <b>{p.name}</b>
                <small className="rs-price">
                  <Coins size={11} />
                  {formatNumber(p.price)}
                </small>
              </span>
            </button>
          );
        const top = levelOpen(state, p.id),
          played = state.books[p.id] ?? 0;
        return (
          <div
            key={p.id}
            className="rs-book"
            style={{ '--book': p.color } as React.CSSProperties}
          >
            <button
              className="rs-book-take"
              disabled={busy || full}
              aria-label={`Take a ${p.name} ticket, level ${LEVEL_NAMES[levelOf(p.id)]}`}
              onClick={() => onTake(p.id)}
            >
              <span className="rs-book-cover">
                <img src={TICKET_ART[p.id].small} alt="" />
              </span>
              <span className="rs-book-text">
                <b>{p.name}</b>
                <small>{p.hint}</small>
              </span>
              <Plus size={18} className="rs-book-plus" />
            </button>
            <fieldset className="rs-levels" aria-label={`${p.name} level`}>
              {LEVEL_NAMES.map((name, level) => (
                <button
                  key={name}
                  aria-pressed={levelOf(p.id) === level}
                  disabled={level > top}
                  aria-label={
                    level > top
                      ? `Level ${name} opens after ${LEVEL_AT[level] - played} more tickets`
                      : `Level ${name}`
                  }
                  title={
                    level > top ? `${LEVEL_AT[level] - played} more` : undefined
                  }
                  onClick={() => choose(p.id, level)}
                >
                  {level > top ? <Lock size={9} /> : name}
                </button>
              ))}
            </fieldset>
          </div>
        );
      })}
    </nav>
  );
}
/** A small ticket lying on the table. */
function Slip({ t, onOpen }: { t: ScratchTicket; onOpen: () => void }) {
  const art = TICKET_ART[t.pack],
    tilt = ((t.id * 37) % 9) - 4;
  const touched = t.cells.some((c) => c.picked);
  return (
    <button
      className={`rs-slip ${t.star ? 'is-star' : ''} ${touched ? 'is-started' : ''}`}
      style={
        {
          '--tilt': `${tilt}deg`,
          '--aspect': art.aspect,
        } as React.CSSProperties
      }
      aria-label={`${packFor(t.pack).name}, level ${LEVEL_NAMES[t.level]}${t.star ? ', star ticket' : ''}`}
      onClick={onOpen}
    >
      <img src={art.small} alt="" draggable={false} />
      <span className="rs-slip-level">{LEVEL_NAMES[t.level]}</span>
      {t.star && (
        <span className="rs-slip-star">
          <Star size={11} fill="currentColor" />
        </span>
      )}
    </button>
  );
}
function Payout({ t, state }: { t: ScratchTicket; state: ScratchState }) {
  const value = useCountUp(t.payout, { log: true, key: t.id, duration: 1100 });
  return (
    <div
      className={`rs-payout ${t.perfect ? 'is-perfect' : ''}`}
      aria-live="polite"
    >
      {t.perfect && <small>Jackpot ×{jackpot(state)}</small>}
      <strong>
        <Coins size={22} />+{formatNumber(Math.round(value))}
      </strong>
      {t.star && (
        <small>
          <Star size={12} fill="currentColor" /> ×5
        </small>
      )}
    </div>
  );
}
/** One ticket opened big: the painted book with its scratch panel. */
function BigTicket({
  ticket,
  state,
  audio,
  onStroke,
  onStatus,
}: {
  ticket: ScratchTicket;
  state: ScratchState;
  audio: ScratchAudio;
  onStroke: (
    id: number,
    sequence: number,
    batch: { points: { x: number; y: number }[] },
  ) => Promise<ActionResult | null>;
  onStatus: (t: ScratchTicket, syncing: boolean) => void;
}) {
  const art = TICKET_ART[ticket.pack],
    [x, y, w, h] = art.panel,
    pack = packFor(ticket.pack),
    chart = pack.mechanic === 'chart';
  const aspect =
    (ticket.cols + (chart ? 0.7 : 0)) / (ticket.rows + (chart ? 0.7 : 0));
  return (
    <div
      className={`rs-big ${ticket.star ? 'is-star' : ''}`}
      style={
        {
          '--aspect': art.aspect,
          '--book': pack.color,
        } as React.CSSProperties
      }
    >
      <img className="rs-big-art" src={art.src} alt="" draggable={false} />
      <h2 className="sr-only">
        {pack.name}, level {LEVEL_NAMES[ticket.level]}
      </h2>
      <div
        className="rs-panel"
        style={{
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: `${w * 100}%`,
          height: `${h * 100}%`,
        }}
      >
        <div
          className={`rs-board ${chart ? 'has-counts' : ''}`}
          style={
            {
              '--board-aspect': aspect,
              '--cols': ticket.cols,
              '--rows': ticket.rows,
            } as React.CSSProperties
          }
        >
          <ScratchSurface
            key={ticket.id}
            ticket={ticket}
            state={state}
            audio={audio}
            onStatus={onStatus}
            onStroke={async (sequence, batch) =>
              !!(await onStroke(ticket.id, sequence, batch))
            }
          />
          {chart && (
            <>
              <ol className="rs-counts is-rows" aria-label="Ship cells per row">
                {ticket.rowCounts?.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
              <ol
                className="rs-counts is-cols"
                aria-label="Ship cells per column"
              >
                {ticket.colCounts?.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
      {ticket.star && (
        <span className="rs-star-badge">
          <Star size={13} fill="currentColor" /> ×5
        </span>
      )}
    </div>
  );
}
/** The ticket table: the book shelf on the left, your tickets spread on the
 * table, and one ticket opened big when you pick it up. */
export function ScratchDesk({
  state,
  coins,
  table,
  busy,
  audio,
  onTake,
  onBuyBook,
  onStroke,
}: {
  state: ScratchState;
  coins: number;
  table: ScratchTicket[];
  busy: boolean;
  audio: ScratchAudio;
  onTake: Take;
  onBuyBook: (id: PackId) => void;
  onStroke: (
    id: number,
    sequence: number,
    batch: { points: { x: number; y: number }[] },
  ) => Promise<ActionResult | null>;
}) {
  const { levelOf, choose } = useLevels(state);
  const [openId, setOpenId] = useState<number | null>(null);
  // Another: the new ticket arrives with the next view and opens as it lands.
  const [pending, setPending] = useState<{
    pack: PackId;
    before: Set<number>;
  } | null>(null);
  const [live, setLive] = useState<{
    ticket: ScratchTicket;
    syncing: boolean;
  } | null>(null);
  const waiting = table.filter((t) => !t.claimed);
  const fresh = pending
    ? table.find((t) => !pending.before.has(t.id) && t.pack === pending.pack)
    : undefined;
  const activeId = fresh?.id ?? openId;
  // A ticket that left the table (another tab, a reload) simply closes.
  const open = table.find((t) => t.id === activeId) ?? null;
  const shown = live && live.ticket.id === open?.id ? live.ticket : open;
  const full = waiting.length >= TABLE_MAX;
  const closeRef = useRef<HTMLButtonElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const openTicket = useCallback((id: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    setLive(null);
    setPending(null);
    setOpenId(id);
  }, []);
  const close = useCallback(() => {
    setOpenId(null);
    setPending(null);
    setLive(null);
    const back = opener.current;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (activeId === null) return;
    closeRef.current?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [activeId, close]);
  const onStatus = useCallback(
    (ticket: ScratchTicket, syncing: boolean) => setLive({ ticket, syncing }),
    [],
  );
  const ended = !!shown?.ended,
    settled = !!open?.claimed;
  const same = open
    ? waiting.filter((t) => t.pack === open.pack && t.id !== open.id)
    : [];
  async function another() {
    if (!open) return;
    const before = new Set(table.map((t) => t.id));
    if (await onTake(open.pack, open.level))
      setPending({ pack: open.pack, before });
  }
  const lives = shown ? shown.lives - shown.mistakes : 0;
  const mechanic = open ? packFor(open.pack).mechanic : null;
  return (
    <div className={`rs-desk ${open ? 'is-focused' : ''}`}>
      <Shelf
        state={state}
        coins={coins}
        busy={busy}
        full={full}
        levelOf={levelOf}
        choose={choose}
        onTake={(id) => void onTake(id, levelOf(id))}
        onBuyBook={onBuyBook}
      />
      <section className="rs-table" aria-label="Your table">
        <div className="rs-spread">
          {waiting.map((t) => (
            <Slip key={t.id} t={t} onOpen={() => openTicket(t.id)} />
          ))}
        </div>
        {waiting.length > 0 && (
          <span
            className="rs-table-count"
            aria-label={`${waiting.length} of ${TABLE_MAX} tickets`}
          >
            {waiting.length}/{TABLE_MAX}
          </span>
        )}
      </section>
      {open && shown && (
        <dialog
          open
          className="rs-focus"
          aria-label={`${packFor(open.pack).name} ticket`}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <button
            ref={closeRef}
            className="rs-focus-close"
            aria-label="Back to the table"
            onClick={close}
          >
            <X size={20} />
          </button>
          <div className="rs-focus-ticket">
            <BigTicket
              ticket={open}
              state={state}
              audio={audio}
              onStroke={onStroke}
              onStatus={onStatus}
            />
          </div>
          <div className="rs-focus-rail">
            {!ended ? (
              <span
                className={`rs-lives mechanic-${mechanic}`}
                aria-label={
                  mechanic === 'seven'
                    ? `${lives} misses left`
                    : `${lives} mistakes left`
                }
              >
                {Array.from({ length: shown.lives }, (_, i) => (
                  <Heart
                    key={i}
                    size={18}
                    className={i < lives ? 'is-left' : ''}
                    fill={i < lives ? 'currentColor' : 'none'}
                  />
                ))}
              </span>
            ) : settled ? (
              <Payout t={open} state={state} />
            ) : (
              <span className="rs-payout is-waiting" aria-hidden="true">
                <Coins size={22} className="rs-spin" />
              </span>
            )}
            {ended && (
              <div className="rs-focus-actions">
                {same.length ? (
                  <button
                    className="rs-primary"
                    onClick={() => openTicket(same[0].id)}
                  >
                    Next
                    <span className="rs-next-count">{same.length}</span>
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    className="rs-primary"
                    disabled={busy || full}
                    onClick={() => void another()}
                  >
                    <Plus size={18} />
                    Another
                  </button>
                )}
              </div>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
