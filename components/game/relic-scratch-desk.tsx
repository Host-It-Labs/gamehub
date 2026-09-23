'use client';
import {
  Coins,
  Lock,
  LoaderCircle,
  Sparkles,
  Star,
  Ticket,
} from 'lucide-react';
import { formatNumber, type ActionResult } from '@/lib/games/relic/engine';
import {
  PACKS,
  nextBook,
  packFor,
  packOpen,
  type PackId,
  type ScratchState,
  type ScratchTicket,
} from '@/lib/games/relic/scratch';
import type { ScratchAudio } from './relic-scratch-audio';
import { ScratchSurface } from './relic-scratch-surface';
import { TICKET_ART } from './relic-scratch-art';

/** The ticket table: the book shelf on the left, the ticket in the middle. */
export function ScratchDesk({
  state,
  coins,
  ticket,
  nextPack,
  busy,
  syncing,
  count,
  audio,
  onChoose,
  onBuyBook,
  onOpen,
  onClaim,
  onStroke,
  onStatus,
}: {
  state: ScratchState;
  coins: number;
  ticket: ScratchTicket | undefined;
  nextPack: PackId;
  busy: boolean;
  syncing: boolean;
  count: number;
  audio: ScratchAudio;
  onChoose: (id: PackId) => void;
  onBuyBook: (id: PackId) => void;
  onOpen: () => void;
  onClaim: () => void;
  onStroke: (
    sequence: number,
    batch: { points: { x: number; y: number }[] },
  ) => Promise<ActionResult | null>;
  onStatus: (revealed: number, pending: boolean) => void;
}) {
  const pack = packFor(ticket?.pack ?? nextPack),
    complete = ticket?.cells.every((c) => c.revealed) ?? false,
    forSale = nextBook(state),
    art = TICKET_ART[pack.id];
  return (
    <div className="rs-desk">
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
          const thumb = TICKET_ART[p.id];
          return (
            <button
              key={p.id}
              className={`rs-book ${open ? '' : 'is-for-sale'} ${nextPack === p.id ? 'is-selected' : ''}`}
              style={{ '--book': p.color } as React.CSSProperties}
              aria-pressed={open ? nextPack === p.id : undefined}
              disabled={!open && (busy || coins < p.price)}
              onClick={() => (open ? onChoose(p.id) : onBuyBook(p.id))}
            >
              <span className="rs-book-cover">
                {thumb ? <img src={thumb} alt="" /> : <Ticket size={16} />}
                {!open && <Lock size={14} className="rs-book-lock" />}
              </span>
              <span className="rs-book-text">
                <b>{p.name}</b>
                {open ? (
                  <small>{p.hint}</small>
                ) : (
                  <small className="rs-price">
                    Unlock <Coins size={11} />
                    {formatNumber(p.price)}
                  </small>
                )}
              </span>
            </button>
          );
        })}
      </nav>
      <section className="rs-table" aria-label="Your ticket">
        <div
          className={`rs-ticket ${art ? 'has-art' : ''} ${ticket?.claimed ? 'is-collected' : ''} ${ticket?.star ? 'is-star' : ''}`}
          style={{ '--book': pack.color } as React.CSSProperties}
        >
          {art ? (
            <img className="rs-ticket-art" src={art} alt="" />
          ) : (
            <div className="rs-ticket-fallback" aria-hidden="true">
              <b>{pack.name}</b>
            </div>
          )}
          <h2 className="sr-only">{pack.name}</h2>
          {ticket?.star && (
            <span className="rs-star-badge">
              <Star size={13} fill="currentColor" /> ×3
            </span>
          )}
          <div className="rs-ticket-field">
            {ticket && (
              <ScratchSurface
                key={ticket.id}
                ticket={ticket}
                state={state}
                audio={audio}
                onActivity={() => {}}
                onStatus={onStatus}
                onStroke={async (sequence, batch) =>
                  !!(await onStroke(sequence, batch))
                }
              />
            )}
          </div>
          {ticket?.claimed && (
            <div className="rs-payout" aria-live="polite">
              <Sparkles size={22} />
              <strong>+{formatNumber(ticket.payout)}</strong>
              {pack.mechanic !== 'luck' && (
                <small>{Math.round(ticket.quality * 100)}% technique</small>
              )}
            </div>
          )}
        </div>
        <div className="rs-ticket-actions">
          {ticket?.claimed || !ticket ? (
            <button className="rs-primary" disabled={busy} onClick={onOpen}>
              <Ticket size={18} />
              Next ticket
            </button>
          ) : complete && !syncing ? (
            <button className="rs-primary" disabled={busy} onClick={onClaim}>
              <Coins size={18} />
              Collect
            </button>
          ) : (
            <span className="rs-count" aria-live="off">
              {syncing && count === ticket.cells.length ? (
                <LoaderCircle size={15} className="rs-spin" />
              ) : null}
              {count} / {ticket.cells.length}
            </span>
          )}
          {ticket && !ticket.claimed && ticket.pack !== nextPack && (
            <small className="rs-next-note">
              Next: {packFor(nextPack).name}
            </small>
          )}
        </div>
      </section>
    </div>
  );
}
