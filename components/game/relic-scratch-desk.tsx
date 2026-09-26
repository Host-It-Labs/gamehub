'use client';
import { useCallback, useEffect, useState } from 'react';
import { Coins, Heart, Lock, RotateCcw, Star, Zap } from 'lucide-react';
import { formatNumber, type ActionResult } from '@/lib/games/relic/engine';
import {
  PACKS,
  houseTicket,
  jackpot,
  levelAt,
  levelOpen,
  nextBook,
  packFor,
  packOpen,
  starPays,
  ticketPrice,
  type PackId,
  type ScratchState,
  type ScratchTicket,
} from '@/lib/games/relic/scratch';
import { useCountUp } from './reveal-motion';
import type { ScratchAudio } from './relic-scratch-audio';
import { ScratchSurface } from './relic-scratch-surface';
import { TICKET_ART } from './relic-scratch-art';

const LEVEL_NAMES = ['I', 'II', 'III'];
type Buy = (pack: PackId, level: number) => Promise<ActionResult | null>;
type Stroke = (
  id: number,
  sequence: number,
  batch: { points: { x: number; y: number }[] },
) => Promise<ActionResult | null>;
function remembered<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function useLevels(state: ScratchState) {
  const [chosen, setChosen] = useState<Partial<Record<PackId, number>>>(() =>
    remembered('gamehub-lucky-levels', {}),
  );
  const levelOf = (id: PackId) =>
    Math.min(chosen[id] ?? levelOpen(state, id), levelOpen(state, id));
  const choose = (id: PackId, level: number) => {
    const next = { ...chosen, [id]: level };
    setChosen(next);
    remember('gamehub-lucky-levels', next);
  };
  return { levelOf, choose };
}
/** The ticket books: buy a ticket straight into your hand, choose its level. */
function Shelf({
  state,
  coins,
  held,
  locked,
  busy,
  levelOf,
  choose,
  onBuy,
  onBuyBook,
}: {
  state: ScratchState;
  coins: number;
  held: PackId | null;
  locked: boolean;
  busy: boolean;
  levelOf: (id: PackId) => number;
  choose: (id: PackId, level: number) => void;
  onBuy: (id: PackId) => void;
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
              data-game-motion="piece"
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
          played = state.books[p.id] ?? 0,
          lvl = levelOf(p.id),
          free = houseTicket(state, coins, p.id, lvl),
          price = ticketPrice(state, p.id, lvl);
        return (
          <div
            key={p.id}
            className={`rs-book ${held === p.id ? 'is-held' : ''}`}
            data-game-motion="piece"
            data-game-motion-key={`${open}:${top}`}
            style={{ '--book': p.color } as React.CSSProperties}
          >
            <button
              className="rs-book-take"
              disabled={busy || locked || (!free && coins < price)}
              aria-label={`Buy a ${p.name} ticket, level ${LEVEL_NAMES[lvl]}, for ${free ? 'free' : formatNumber(price)}`}
              onClick={() => onBuy(p.id)}
            >
              <span className="rs-book-cover">
                <img src={TICKET_ART[p.id].small} alt="" />
              </span>
              <span className="rs-book-text">
                <b>{p.name}</b>
                <small className={`rs-price ${free ? 'is-free' : ''}`}>
                  <Coins size={11} />
                  {free ? 'Free' : formatNumber(price)}
                </small>
              </span>
            </button>
            <fieldset className="rs-levels" aria-label={`${p.name} level`}>
              {LEVEL_NAMES.map((name, level) => (
                <button
                  key={name}
                  aria-pressed={lvl === level}
                  disabled={level > top}
                  aria-label={
                    level > top
                      ? `Level ${name} opens after ${levelAt(state, level) - played} more tickets`
                      : `Level ${name}`
                  }
                  title={
                    level > top
                      ? `${levelAt(state, level) - played} more`
                      : undefined
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
function Payout({ t, state }: { t: ScratchTicket; state: ScratchState }) {
  const total = t.payout + (t.refund ?? 0),
    net = total - (t.cost ?? 0);
  const value = useCountUp(t.payout, { log: true, key: t.id, duration: 1100 });
  return (
    <div
      className={`rs-payout ${t.perfect ? 'is-perfect' : ''} ${net < 0 ? 'is-loss' : ''}`}
      aria-live="polite"
    >
      <strong>
        <Coins size={22} />+{formatNumber(Math.round(value))}
      </strong>
      <span className="rs-payout-chips">
        {t.perfect && <small>Jackpot ×{jackpot(state)}</small>}
        {t.star && (
          <small>
            <Star size={11} fill="currentColor" />×{starPays(state)}
          </small>
        )}
        {t.quick && !!state.upgrades.quick && (
          <small>
            <Zap size={11} fill="currentColor" />
            Quick
          </small>
        )}
        {!!t.refund && <small>Refund +{formatNumber(t.refund)}</small>}
      </span>
      {!!t.cost && (
        <span
          className="rs-net"
          aria-label={`${net < 0 ? 'Lost' : 'Won'} ${formatNumber(Math.abs(net))} on this ticket`}
        >
          {net < 0 ? '−' : '+'}
          {formatNumber(Math.abs(net))}
        </span>
      )}
    </div>
  );
}
/** One ticket held up: the painted book with its scratch panel. */
function BigTicket({
  readOnly = false,
  ticket,
  state,
  audio,
  onStroke,
  onStatus,
}: {
  readOnly?: boolean;
  ticket: ScratchTicket;
  state: ScratchState;
  audio: ScratchAudio;
  onStroke: Stroke;
  onStatus: (t: ScratchTicket, syncing: boolean) => void;
}) {
  const art = TICKET_ART[ticket.pack],
    [x, y, w, h] = art.panel,
    pack = packFor(ticket.pack),
    chart = pack.mechanic === 'chart',
    ladder = pack.mechanic === 'ladder';
  const aspect =
    ((ticket.cols + (chart ? 0.7 : 0)) * (ladder ? 1.25 : 1)) /
    (ticket.rows + (chart ? 0.7 : 0));
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
            readOnly={readOnly}
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
      <span className="rs-level-badge">{LEVEL_NAMES[ticket.level]}</span>
      {ticket.star && (
        <span className="rs-star-badge">
          <Star size={13} fill="currentColor" /> ×{starPays(state)}
        </span>
      )}
    </div>
  );
}
/** The ticket desk: the book shelf on the left and the ticket in your hand,
 * always open. When it has paid, Again buys the same one. */
export function ScratchDesk({
  state,
  coins,
  hand,
  busy,
  audio,
  onBuy,
  onBuyBook,
  onStroke,
}: {
  state: ScratchState;
  coins: number;
  hand: ScratchTicket | undefined;
  busy: boolean;
  audio: ScratchAudio;
  onBuy: Buy;
  onBuyBook: (id: PackId) => void;
  onStroke: Stroke;
}) {
  const { levelOf, choose } = useLevels(state);
  const [live, setLive] = useState<{
    ticket: ScratchTicket;
    syncing: boolean;
  } | null>(null);
  // Without a ticket in hand the stage shows the book last played.
  const [stored] = useState<PackId>(() =>
    remembered<PackId>('gamehub-lucky-book', 'seven'),
  );
  const shown = live && live.ticket.id === hand?.id ? live.ticket : hand;
  const onStatus = useCallback(
    (ticket: ScratchTicket, syncing: boolean) => setLive({ ticket, syncing }),
    [],
  );
  const heldPack = hand?.pack,
    last = heldPack ?? stored;
  useEffect(() => {
    if (heldPack) remember('gamehub-lucky-book', heldPack);
  }, [heldPack]);
  const ended = !!shown?.ended,
    settled = !!hand?.claimed,
    playing = !!hand && !ended;
  const again = hand
    ? {
        pack: hand.pack,
        level: Math.min(hand.level, levelOpen(state, hand.pack)),
      }
    : {
        pack: packOpen(state, last) ? last : ('seven' as PackId),
        level: levelOf(packOpen(state, last) ? last : 'seven'),
      };
  const free = houseTicket(state, coins, again.pack, again.level);
  const price = ticketPrice(state, again.pack, again.level);
  const canBuy = !busy && !playing && (free || coins >= price);
  async function buy(pack: PackId, level: number) {
    setLive(null);
    await audio.unlock();
    await onBuy(pack, level);
  }
  const lives = shown ? shown.lives - shown.mistakes : 0,
    mechanic = shown ? packFor(shown.pack).mechanic : null;
  const againButton = (
    <button
      className="rs-primary rs-again"
      disabled={!canBuy || (ended && !settled)}
      onClick={() => void buy(again.pack, again.level)}
    >
      <RotateCcw size={18} />
      {hand ? 'Again' : 'Buy'}
      <span className="rs-again-price">
        <Coins size={13} />
        {free ? 'Free' : formatNumber(price)}
      </span>
    </button>
  );
  return (
    <div className="rs-desk">
      <Shelf
        state={state}
        coins={coins}
        held={hand?.pack ?? null}
        locked={playing}
        busy={busy}
        levelOf={levelOf}
        choose={choose}
        onBuy={(id) => void buy(id, levelOf(id))}
        onBuyBook={onBuyBook}
      />
      <section
        className={`rs-hand ${playing ? 'is-playing' : ''}`}
        aria-label="Your ticket"
      >
        <div className="rs-hand-ticket">
          {hand && shown ? (
            <BigTicket
              key={hand.id}
              ticket={hand}
              state={state}
              audio={audio}
              onStroke={onStroke}
              onStatus={onStatus}
            />
          ) : (
            <div
              className="rs-big is-blank"
              style={
                {
                  '--aspect': TICKET_ART[again.pack].aspect,
                } as React.CSSProperties
              }
            >
              <img
                className="rs-big-art"
                src={TICKET_ART[again.pack].src}
                alt=""
                draggable={false}
              />
            </div>
          )}
        </div>
        <div className="rs-hand-rail">
          {playing && shown ? (
            <span
              className={`rs-lives mechanic-${mechanic}`}
              data-game-motion="change"
              data-game-motion-key={lives}
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
          ) : hand && settled ? (
            <Payout t={hand} state={state} />
          ) : hand && ended ? (
            <span className="rs-payout is-waiting" aria-hidden="true">
              <Coins size={22} className="rs-spin" />
            </span>
          ) : null}
          {!playing && againButton}
        </div>
      </section>
    </div>
  );
}

/** The same ticket, driven only by the other player's saved strokes. */
export function WatchTicket({ ticket, state, audio }: {
  ticket: ScratchTicket; state: ScratchState; audio: ScratchAudio;
}) {
  return <div className="rs-watch-ticket">
    <BigTicket key={ticket.id} readOnly ticket={ticket} state={state} audio={audio} onStroke={async () => null} onStatus={() => {}} />
    {ticket.claimed && <Payout t={ticket} state={state} />}
  </div>;
}
