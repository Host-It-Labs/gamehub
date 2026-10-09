'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Heart, Lock, RotateCcw, Star, Zap } from 'lucide-react';
import { formatNumber, type ActionResult } from '@/lib/games/relic/engine';
import {
  PACKS,
  bookExperience,
  houseTicket,
  jackpot,
  xpToOpen,
  levelOpen,
  loyaltyDue,
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
import { TicketGuide } from './relic-ticket-guide';

/** Difficulty names; the fourth, IV, is the hardest ticket of a book and
 * wears its own colour. */
export const LEVEL_NAMES = ['I', 'II', 'III', 'IV'];
const LEVEL_WORDS = LEVEL_NAMES;
/** A difficulty's mark: its numeral. */
function LevelMark({ level }: { level: number }) {
  return <>{LEVEL_NAMES[level]}</>;
}
type Buy = (pack: PackId, level: number) => Promise<ActionResult | null>;
type Stroke = (
  id: number,
  sequence: number,
  batch: { points: { x: number; y: number }[]; breaks?: number[] },
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
function useLevels(
  state: ScratchState,
  mirror?: Partial<Record<PackId, number>>,
) {
  const [own, setChosen] = useState<Partial<Record<PackId, number>>>(() =>
    mirror ? {} : remembered('gamehub-lucky-levels', {}),
  );
  const chosen = mirror ?? own;
  const levelOf = (id: PackId) =>
    Math.min(chosen[id] ?? levelOpen(state, id), levelOpen(state, id));
  const choose = (id: PackId, level: number) => {
    const next = { ...chosen, [id]: level };
    setChosen(next);
    remember('gamehub-lucky-levels', next);
  };
  return { levelOf, choose, chosen };
}
/** A book's difficulties: I, II and III side by side, IV beneath them. */
function Difficulty({
  name,
  levels,
  top,
  chosen,
  until,
  onChoose,
}: {
  name: string;
  levels: number;
  top: number;
  chosen: number;
  until: (level: number) => number;
  onChoose: (level: number) => void;
}) {
  return (
    <fieldset className="rs-levels" aria-label={`${name} difficulty`}>
      {Array.from({ length: Math.max(levels, 4) }, (_, level) => {
        const shut = level > top || level >= levels,
          left = shut ? until(level) : 0;
        return (
          <button
            key={level}
            type="button"
            className={level === 3 ? 'is-four' : undefined}
            aria-pressed={chosen === level}
            disabled={shut}
            aria-label={
              shut
                ? `Difficulty ${LEVEL_WORDS[level]}${left > 0 ? `, opens after ${formatNumber(left)} more XP` : ', not open yet'}`
                : `Difficulty ${LEVEL_WORDS[level]}`
            }
            title={
              shut && left > 0 ? `${formatNumber(left)} XP more` : undefined
            }
            onClick={() => onChoose(level)}
          >
            {shut ? <Lock size={9} /> : <LevelMark level={level} />}
          </button>
        );
      })}
    </fieldset>
  );
}
/** The ticket books. Tapping one picks it; Buy, beside the ticket, buys it. */
function Shelf({
  state,
  coins,
  selected,
  held,
  busy,
  levelOf,
  choose,
  onSelect,
  onBuyBook,
}: {
  state: ScratchState;
  coins: number;
  selected: PackId;
  held: PackId | null;
  busy: boolean;
  levelOf: (id: PackId) => number;
  choose: (id: PackId, level: number) => void;
  onSelect: (id: PackId) => void;
  onBuyBook: (id: PackId) => void;
}) {
  const forSale = nextBook(state),
    loyal = loyaltyDue(state),
    // An empty purse: the house's Lucky Seven I is the way back.
    broke = houseTicket(state, coins, 'seven', 0);
  return (
    <nav className="rs-shelf" aria-label="Ticket books" data-rs-area="shelf">
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
          lvl = levelOf(p.id),
          house = broke && p.id === 'seven',
          free = loyal || house,
          price = ticketPrice(state, p.id, lvl),
          progress = bookExperience(state, p.id);
        return (
          <div
            key={p.id}
            className={`rs-book ${selected === p.id ? 'is-selected' : ''} ${held === p.id ? 'is-held' : ''} ${house ? 'is-house' : ''}`}
            data-game-motion="piece"
            data-game-motion-key={`${open}:${progress.level}`}
            style={{ '--book': p.color } as React.CSSProperties}
          >
            <button
              type="button"
              className="rs-book-take"
              aria-pressed={selected === p.id}
              aria-label={`${p.name}, difficulty ${LEVEL_WORDS[house ? 0 : lvl]}, ${free ? 'free' : formatNumber(price)}`}
              onClick={() => onSelect(p.id)}
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
              <span
                className="rs-book-xp"
                title={`${formatNumber(progress.current)} / ${formatNumber(progress.needed)} XP`}
              >
                <span>Lv {progress.level}</span>
                <progress
                  className="rs-book-progress"
                  aria-label={`${p.name}: level ${progress.level}, progress to level ${progress.level + 1}`}
                  max={progress.needed}
                  value={progress.current}
                  aria-valuetext={`${progress.current} of ${progress.needed} XP`}
                />
              </span>
            </button>
            <Difficulty
              name={p.name}
              levels={p.levels.length}
              top={top}
              chosen={lvl}
              until={(level) => xpToOpen(state, p.id, level)}
              onChoose={(level) => {
                choose(p.id, level);
                onSelect(p.id);
              }}
            />
          </div>
        );
      })}
    </nav>
  );
}
function Payout({ t, state }: { t: ScratchTicket; state: ScratchState }) {
  const net = t.payout - (t.cost ?? 0);
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
      </span>
      {t.xp !== undefined && <PayoutXp t={t} state={state} />}
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
/** The book XP this ticket earned, counting up into the book's level bar. */
function PayoutXp({ t, state }: { t: ScratchTicket; state: ScratchState }) {
  const xp = t.xp ?? 0,
    gained = useCountUp(xp, { key: t.id, duration: 900 }),
    book = bookExperience(state, t.pack);
  return (
    <span className="rs-payout-xp">
      <b>+{formatNumber(Math.round(gained))} XP</b>
      <span className="rs-payout-xp-bar">
        <small>Lv {book.level}</small>
        <progress
          max={book.needed}
          value={book.current}
          aria-label={`Book level ${book.level}: ${formatNumber(book.current)} of ${formatNumber(book.needed)} XP`}
        />
      </span>
    </span>
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
      className={`rs-big ${ticket.star ? 'is-star' : ''} ${ticket.level === 3 ? 'is-four' : ''}`}
      data-rs-area="ticket"
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
      <TicketGuide book={ticket.pack} level={ticket.level} />
      <span className={`rs-level-badge ${ticket.level === 3 ? 'is-four' : ''}`}>
        <LevelMark level={ticket.level} />
      </span>
      {ticket.star && (
        <span className="rs-star-badge">
          <Star size={13} fill="currentColor" /> ×{starPays(state)}
        </span>
      )}
    </div>
  );
}
/** The ticket desk: the books, the ticket in your hand held up big, and
 * beside it its hearts or payout and the one Buy button. */
export const ScratchDesk = memo(function ScratchDesk({
  state,
  coins,
  hand,
  busy,
  audio,
  onBuy,
  onBuyBook,
  onStroke,
  readOnly = false,
  levels,
  book: mirroredBook,
  onLevels,
}: {
  state: ScratchState;
  coins: number;
  hand: ScratchTicket | undefined;
  busy: boolean;
  audio: ScratchAudio;
  onBuy: Buy;
  onBuyBook: (id: PackId) => void;
  onStroke: Stroke;
  /** The Watch TV: another player's desk, with the book and levels they chose. */
  readOnly?: boolean;
  levels?: Partial<Record<PackId, number>>;
  book?: PackId;
  /** Tells the others which book is picked and each book's level. */
  onLevels?: (levels: Partial<Record<PackId, number>>, book: PackId) => void;
}) {
  const { levelOf, choose, chosen } = useLevels(state, levels);
  const [live, setLive] = useState<{
    ticket: ScratchTicket;
    syncing: boolean;
  } | null>(null);
  // The picked book: what Buy buys next. It starts on the last one played.
  const [ownBook, setBook] = useState<PackId>(() =>
    remembered<PackId>('gamehub-lucky-book', 'seven'),
  );
  const picked = mirroredBook ?? ownBook,
    book = packOpen(state, picked) ? picked : ('seven' as PackId);
  useEffect(() => {
    if (!readOnly) onLevels?.(chosen, book);
  }, [chosen, book, onLevels, readOnly]);
  const pick = (id: PackId) => {
    setBook(id);
    remember('gamehub-lucky-book', id);
  };
  const shown = live && live.ticket.id === hand?.id ? live.ticket : hand;
  const onStatus = useCallback(
    (ticket: ScratchTicket, syncing: boolean) => setLive({ ticket, syncing }),
    [],
  );
  const ended = !!shown?.ended,
    settled = !!hand?.claimed,
    playing = !!hand && !ended;
  const level = levelOf(book),
    again = !!hand && hand.pack === book && hand.level === level;
  const price = ticketPrice(state, book, level);
  const free = houseTicket(state, coins, book, level) || loyaltyDue(state);
  // Out of coins for the picked ticket and for any: Buy becomes the house's
  // free Lucky Seven I.
  const broke = !free && coins < price && houseTicket(state, coins, 'seven', 0);
  const canBuy = !busy && !playing && (free || broke || coins >= price);
  async function buy() {
    setLive(null);
    await audio.unlock();
    if (broke) {
      pick('seven');
      choose('seven', 0);
      await onBuy('seven', 0);
    } else await onBuy(book, level);
  }
  const lives = shown ? shown.lives - shown.mistakes : 0,
    mechanic = shown ? packFor(shown.pack).mechanic : null;
  // Enter buys the picked ticket again, wherever the pointer is.
  const buyKey = useRef(() => {});
  useEffect(() => {
    buyKey.current = () => {
      if (!readOnly && canBuy && !(ended && !settled)) void buy();
    };
  });
  useEffect(() => {
    if (readOnly) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key !== 'Enter' ||
        event.defaultPrevented ||
        target.closest?.('button, input, select, textarea, dialog, a') ||
        document.querySelector('.scratch-modal-backdrop')
      )
        return;
      event.preventDefault();
      buyKey.current();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [readOnly]);
  return (
    <div className={`rs-desk ${playing ? 'is-playing' : ''}`}>
      <Shelf
        state={state}
        coins={coins}
        selected={book}
        held={hand?.pack ?? null}
        busy={busy}
        levelOf={levelOf}
        choose={choose}
        onSelect={pick}
        onBuyBook={onBuyBook}
      />
      <section
        className="rs-hand"
        aria-label="Your ticket"
        style={
          {
            '--aspect': TICKET_ART[hand?.pack ?? book].aspect,
          } as React.CSSProperties
        }
      >
        <div className="rs-hand-ticket">
          {hand && shown ? (
            <BigTicket
              key={hand.id}
              readOnly={readOnly}
              ticket={hand}
              state={state}
              audio={audio}
              onStroke={onStroke}
              onStatus={onStatus}
            />
          ) : (
            <div
              className={`rs-big is-blank ${level === 3 ? 'is-four' : ''}`}
              style={
                {
                  '--aspect': TICKET_ART[book].aspect,
                } as React.CSSProperties
              }
            >
              <img
                className="rs-big-art"
                src={TICKET_ART[book].src}
                alt=""
                draggable={false}
              />
              <TicketGuide book={book} level={level} />
              <span
                className={`rs-level-badge ${level === 3 ? 'is-four' : ''}`}
              >
                <LevelMark level={level} />
              </span>
            </div>
          )}
        </div>
        <div className="rs-hand-rail" data-rs-area="rail">
          <TicketGuide
            book={hand?.pack ?? book}
            level={hand ? hand.level : level}
            place="rail"
          />
          <div className="rs-rail-status">
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
          </div>
          {!playing && (
            <div className="rs-rail-buy">
              <button
                className={`rs-primary rs-again ${broke ? 'is-house' : ''}`}
                disabled={readOnly || !canBuy || (ended && !settled)}
                aria-keyshortcuts="Enter"
                aria-label={broke ? 'Free Lucky Seven I' : undefined}
                onClick={() => void buy()}
              >
                {broke ? (
                  <img
                    className="rs-again-book"
                    src={TICKET_ART.seven.small}
                    alt=""
                  />
                ) : again ? (
                  <RotateCcw size={18} />
                ) : (
                  <img
                    className="rs-again-book"
                    src={TICKET_ART[book].small}
                    alt=""
                  />
                )}
                <span className="rs-again-word">
                  {broke ? 'Free' : again ? 'Again' : 'Buy'}
                </span>
                <span className="rs-again-price">
                  {broke ? (
                    'Lucky Seven I'
                  ) : (
                    <>
                      <Coins size={13} />
                      {free ? 'Free' : formatNumber(price)}
                    </>
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
});
