'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Castle,
  Check,
  ChevronLeft,
  CircleHelp,
  Coins,
  Crosshair,
  Crown,
  Drum,
  Droplets,
  FlaskConical,
  GraduationCap,
  HandCoins,
  Heart,
  Lock,
  Mountain,
  Plane,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Trophy,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cards, type CardId } from '@/lib/games/arena/cards';
import {
  DECK_MAX,
  DECK_MIN,
  DRAFT_ROUNDS,
  MAX_LEVEL,
  REGIONS,
  charms,
  eventAllowed,
  events,
  isAirAnswer,
  isWinCard,
  levelOf,
  reachable,
  removePrice,
  type Bundle,
  type CharmId,
  type Offer,
  type QuestAction,
  type QuestState,
  type Stop,
} from '@/lib/games/arena/quest';
import { arenaManifest } from './assets';
import { QuestMap, stopIcons, stopLabel } from './quest-map';
import { playQuestSound, preloadQuestSounds } from './sound';
import { GameMenu } from '../game-menu';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import './quest.css';

export const charmIcons: Record<CharmId, LucideIcon> = {
  well: Droplets,
  brew: FlaskConical,
  walls: Castle,
  arrows: Crosshair,
  drums: Drum,
  hide: Shield,
  steel: Sword,
  coin: Coins,
  rock: Mountain,
  wind: Wind,
  crown: Crown,
  heart: Heart,
  mentor: GraduationCap,
  haggle: HandCoins,
};
export function CardArt({ id, className }: { id: CardId; className?: string }) {
  const src = arenaManifest.cards[id]?.path;
  return (
    <span className={`quest-card-art ${className ?? ''}`}>
      {src ? (
        <img src={src} alt="" draggable={false} />
      ) : (
        <span className="quest-card-blank">{cards[id].name[0]}</span>
      )}
      <span className="arena-cost">{cards[id].cost}</span>
    </span>
  );
}

function Pips({ level }: { level: number }) {
  return (
    <span className="quest-pips" aria-label={`Level ${level}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <i key={i} data-on={i < level} />
      ))}
    </span>
  );
}

/** A suggestion the host's partner made, shown on the thing suggested. */
export type Suggestion = { key: string; name: string };

/**
 * The Quest screens: the region map, and over it the start, reward, swap,
 * camp, shop, event and end panels. Battles are the parent's (quest-solo
 * or the online table). `host` makes the choices; everyone else's taps
 * become suggestions (`onSuggest`), shown to all on what they point at.
 */
export function QuestView({
  q,
  act,
  host = true,
  suggestions = [],
  onSuggest,
  onLeave,
  onNewRun,
  rules,
  sound,
  saved = 'Your quest is saved on this device.',
  volume = 0.5,
}: {
  q: QuestState;
  act: (a: QuestAction) => void;
  host?: boolean;
  suggestions?: Suggestion[];
  onSuggest?: (key: string) => void;
  onLeave: () => void;
  /** Offered once a run is over. */
  onNewRun?: () => void;
  rules: () => void;
  sound: ReactNode;
  saved?: string;
  /** The effects level, for the map's own cues. */
  volume?: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [inspect, setInspect] = useState<
    { kind: 'card'; id: CardId } | { kind: 'charm'; id: CharmId } | null
  >(null);
  const [picking, setPicking] = useState<'train' | 'remove' | null>(null);
  const [menu, setMenu] = useState(false);
  const leave = useLeaveDialog();
  const next = reachable(q);
  const screen = q.screen;
  const region = REGIONS[q.region];
  useEffect(() => preloadQuestSounds(), []);
  // Cues for what changed: a reward, a lost heart, gold, a level, the end.
  const [last, setLast] = useState(q);
  if (last !== q) {
    setLast(q);
    // A new screen starts with nothing half chosen.
    if (last.screen.kind !== screen.kind || last.region !== q.region) {
      setPicking(null);
      setSelected(null);
    }
    const cue =
      screen.kind === 'won'
        ? 'quest-victory'
        : q.hearts < last.hearts
          ? 'quest-heart-lost'
          : screen.kind === 'reward' && last.screen.kind !== 'reward'
            ? 'quest-reward'
            : Object.keys(q.levels).some(
                  (c) =>
                    (q.levels[c as CardId] ?? 1) >
                    (last.levels[c as CardId] ?? 1),
                )
              ? 'quest-upgrade'
              : q.gold !== last.gold
                ? 'quest-coin'
                : q.trail.length > last.trail.length
                  ? 'quest-step'
                  : null;
    if (cue) queueMicrotask(() => playQuestSound(cue, volume));
  }

  /** The host acts; anyone else suggests. */
  const choose = (key: string, action: QuestAction) => {
    if (host) act(action);
    else onSuggest?.(key);
  };
  const marks = (key: string) =>
    suggestions
      .filter((s) => s.key === key)
      .map((s) => (
        <span key={s.name} className="quest-suggest">
          {s.name}
        </span>
      ));

  // Cards taking off from the draft, by card: where they were on screen.
  const flights = useRef(new Map<CardId, DOMRect>());
  const measureBundles = (root: ParentNode = document) => {
    for (const el of root.querySelectorAll<HTMLElement>(
      '.quest-bundle-card[data-card]',
    ))
      flights.current.set(
        el.dataset.card as CardId,
        el.querySelector('.quest-card-art')!.getBoundingClientRect(),
      );
  };
  // Measure the offer once it has dealt in, for picks made elsewhere.
  const draftKey =
    screen.kind === 'draft'
      ? `${screen.round}:${screen.bundles.flat().join(',')}`
      : '';
  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => measureBundles(), 700);
    return () => clearTimeout(t);
  }, [draftKey]);
  // New cards in the deck fly in from where they were offered.
  const before = useRef(q.deck);
  useLayoutEffect(() => {
    const added = q.deck.filter((c) => !before.current.includes(c));
    before.current = q.deck;
    if (
      !added.length ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    added.forEach((id, i) => {
      const from = flights.current.get(id);
      const el = document.querySelector<HTMLElement>(
        `.quest-deck [data-card="${id}"] .quest-card-art`,
      );
      if (!from || !el) return;
      const to = el.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const k = from.width / (to.width || 1);
      el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${k})`,
            zIndex: 30,
          },
          {
            offset: 0.55,
            transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 40}px) scale(${(k + 1) / 2}) rotate(${i ? 8 : -8}deg)`,
          },
          { transform: 'none' },
        ],
        {
          duration: 640,
          delay: i * 90,
          easing: 'cubic-bezier(.3,.7,.3,1)',
          fill: 'backwards',
        },
      );
      el.closest('li')?.animate(
        [
          { filter: 'brightness(1)' },
          { filter: 'brightness(1.7) drop-shadow(0 0 12px #ffcf5a)' },
          { filter: 'brightness(1)' },
        ],
        { duration: 520, delay: 560 + i * 90 },
      );
    });
    flights.current.clear();
  }, [q.deck]);
  const pickBundle = (i: number, el: HTMLElement) => {
    measureBundles(el.closest('.quest-bundles') ?? document);
    choose(`bundle:${i}`, { type: 'bundle', bundle: i });
  };

  const overlay = (() => {
    switch (screen.kind) {
      case 'draft':
        return (
          <Sheet
            title="Draft"
            head={
              <span
                className="quest-draft-pips"
                aria-label={`Round ${screen.round + 1} of ${DRAFT_ROUNDS}`}
              >
                {Array.from({ length: DRAFT_ROUNDS }, (_, i) => (
                  <i key={i} data-on={i <= screen.round} />
                ))}
              </span>
            }
          >
            <div className="quest-bundles" key={screen.round}>
              {screen.bundles.map((b, i) => (
                <BundleChoice
                  key={b.join()}
                  bundle={b}
                  index={i}
                  onPick={(el) => pickBundle(i, el)}
                >
                  {marks(`bundle:${i}`)}
                </BundleChoice>
              ))}
            </div>
          </Sheet>
        );
      case 'reward':
        return (
          <Sheet
            title={screen.won ? 'Victory' : 'Defeat'}
            tone={screen.won ? 'win' : 'lose'}
            head={
              screen.won ? (
                <span className="quest-gain">
                  <Coins aria-hidden="true" />+{screen.gold}
                </span>
              ) : (
                <span className="quest-gain lose">
                  <Heart aria-hidden="true" />
                  −1
                </span>
              )
            }
          >
            {screen.offers.length > 0 && (
              <div className="quest-choices">
                {screen.offers.map((o, i) => (
                  <OfferChoice
                    key={i}
                    q={q}
                    offer={o}
                    onClick={() =>
                      choose(`offer:${i}`, { type: 'take', offer: i })
                    }
                  >
                    {marks(`offer:${i}`)}
                  </OfferChoice>
                ))}
              </div>
            )}
            <button
              type="button"
              className="arena-button quiet"
              onClick={() => choose('skip', { type: 'skip' })}
            >
              {screen.offers.length ? 'Skip' : 'Continue'}
              {marks('skip')}
            </button>
          </Sheet>
        );
      case 'swap':
        return (
          <Sheet
            title="Your deck is full"
            head={<CardArt id={screen.card} className="quest-new" />}
          >
            <p className="quest-prompt">Pick the card it replaces.</p>
            <DeckGrid
              q={q}
              onPick={(id) => choose(`swap:${id}`, { type: 'swap', out: id })}
              marks={(id) => marks(`swap:${id}`)}
            />
            <button
              type="button"
              className="arena-button quiet"
              onClick={() => choose('swap:none', { type: 'swap', out: null })}
            >
              Keep my deck {marks('swap:none')}
            </button>
          </Sheet>
        );
      case 'camp':
        return (
          <Sheet title="Camp">
            {picking === 'train' ? (
              <>
                <p className="quest-prompt">Train one card.</p>
                <DeckGrid
                  q={q}
                  disabled={(id) => levelOf(q, id) >= MAX_LEVEL}
                  onPick={(id) =>
                    choose(`train:${id}`, { type: 'train', card: id })
                  }
                  marks={(id) => marks(`train:${id}`)}
                />
                <button
                  type="button"
                  className="arena-button quiet"
                  onClick={() => setPicking(null)}
                >
                  Back
                </button>
              </>
            ) : (
              <div className="quest-choices two">
                <button
                  type="button"
                  className="quest-choice"
                  data-kind="rest"
                  disabled={q.hearts >= q.maxHearts}
                  onClick={() => choose('rest', { type: 'rest' })}
                >
                  <span className="quest-choice-art">
                    <Heart />
                  </span>
                  <b>Rest</b>
                  <small>One heart back</small>
                  {marks('rest')}
                </button>
                <button
                  type="button"
                  className="quest-choice"
                  data-kind="train"
                  onClick={() => setPicking('train')}
                >
                  <span className="quest-choice-art">
                    <GraduationCap />
                  </span>
                  <b>Train</b>
                  <small>Upgrade a card</small>
                </button>
              </div>
            )}
          </Sheet>
        );
      case 'shop':
        return (
          <Sheet
            title="Shop"
            head={
              <span className="quest-gain">
                <Coins aria-hidden="true" />
                {q.gold}
              </span>
            }
          >
            {picking === 'remove' ? (
              <>
                <p className="quest-prompt">Take one card out of your deck.</p>
                <DeckGrid
                  q={q}
                  onPick={(id) =>
                    choose(`remove:${id}`, { type: 'remove', card: id })
                  }
                  marks={(id) => marks(`remove:${id}`)}
                />
                <button
                  type="button"
                  className="arena-button quiet"
                  onClick={() => setPicking(null)}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <div className="quest-choices wares">
                  {screen.wares.map((w, i) => {
                    const full = w.kind === 'card' && q.deck.length >= DECK_MAX;
                    return (
                      <OfferChoice
                        key={i}
                        q={q}
                        offer={w}
                        price={w.price}
                        sold={w.sold}
                        disabled={w.sold || q.gold < w.price || full}
                        note={full && !w.sold ? 'Deck full' : undefined}
                        onClick={() =>
                          choose(`ware:${i}`, { type: 'buy', ware: i })
                        }
                      >
                        {marks(`ware:${i}`)}
                      </OfferChoice>
                    );
                  })}
                  <button
                    type="button"
                    className="quest-choice"
                    data-kind="remove"
                    disabled={
                      q.deck.length <= DECK_MIN || q.gold < removePrice(q)
                    }
                    onClick={() => setPicking('remove')}
                  >
                    <span className="quest-choice-art">
                      <X />
                    </span>
                    <b>Remove</b>
                    <small>A card from your deck</small>
                    <span className="quest-price">
                      <Coins aria-hidden="true" />
                      {removePrice(q)}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  className="arena-button quiet"
                  onClick={() => choose('leave', { type: 'leave' })}
                >
                  Leave {marks('leave')}
                </button>
              </>
            )}
          </Sheet>
        );
      case 'event': {
        const e = events[screen.event];
        return (
          <Sheet
            title={e.name}
            head={<CircleHelp className="quest-event-mark" />}
          >
            <p className="quest-prompt">{e.text}</p>
            {screen.card && <CardArt id={screen.card} className="quest-new" />}
            <div className="quest-options">
              {e.options.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={`arena-button ${i ? 'quiet' : ''}`}
                  disabled={i === 0 && !eventAllowed(q)}
                  onClick={() =>
                    choose(`option:${i}`, {
                      type: 'choose',
                      option: i as 0 | 1,
                    })
                  }
                >
                  {label}
                  {marks(`option:${i}`)}
                </button>
              ))}
            </div>
          </Sheet>
        );
      }
      case 'won':
      case 'lost':
        return (
          <Sheet
            title={screen.kind === 'won' ? 'Quest complete' : 'Quest over'}
            tone={screen.kind === 'won' ? 'win' : 'lose'}
            head={
              screen.kind === 'won' ? (
                <Trophy className="quest-trophy" />
              ) : (
                <Heart className="quest-trophy lose" />
              )
            }
          >
            <dl className="quest-summary">
              <div>
                <dt>Regions</dt>
                <dd>
                  {screen.kind === 'won' ? REGIONS.length : q.region}/
                  {REGIONS.length}
                </dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd>{q.wins}</dd>
              </div>
              <div>
                <dt>Gold</dt>
                <dd>{q.gold}</dd>
              </div>
            </dl>
            {q.unlocked.length > 0 && (
              <div className="quest-unlocked">
                <Sparkles aria-hidden="true" />
                {q.unlocked.map((id) => (
                  <CardArt key={id} id={id} />
                ))}
              </div>
            )}
            <div className="quest-options">
              {onNewRun && host && (
                <button
                  type="button"
                  className="arena-button"
                  onClick={onNewRun}
                >
                  <RotateCcw aria-hidden="true" /> New quest
                </button>
              )}
              <button
                type="button"
                className="arena-button quiet"
                onClick={onLeave}
              >
                Back
              </button>
            </div>
          </Sheet>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="quest" data-region={q.region} data-screen={screen.kind}>
      <div className="quest-top">
        <button
          type="button"
          className="arena-back"
          aria-label="Leave the quest"
          onClick={() =>
            screen.kind === 'won' || screen.kind === 'lost'
              ? onLeave()
              : leave.ask(onLeave)
          }
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div
          className="quest-region"
          aria-label={`${region.name}, region ${q.region + 1} of ${REGIONS.length}`}
        >
          <b>{region.name}</b>
          <span aria-hidden="true">
            {REGIONS.map((_, i) => (
              <i key={i} data-on={i <= q.region} />
            ))}
          </span>
        </div>
        <div className="quest-corner">
          <div className="quest-status">
            <span
              className="quest-hearts"
              aria-label={`${q.hearts} of ${q.maxHearts} hearts`}
            >
              {Array.from({ length: q.maxHearts }, (_, i) => (
                <Heart key={i} data-on={i < q.hearts} aria-hidden="true" />
              ))}
            </span>
            <span className="quest-gold" aria-label={`${q.gold} gold`}>
              <Coins aria-hidden="true" />
              <b data-game-motion="change" data-game-motion-key={q.gold}>
                {q.gold}
              </b>
            </span>
          </div>
          <GameMenu
            name="Quest"
            theme="arena"
            open={menu}
            onOpenChange={setMenu}
            onRules={rules}
            sound={sound}
            onLeave={() => leave.ask(onLeave)}
          />
          {q.charms.length > 0 && (
            <ul className="quest-charms" aria-label="Charms">
              {q.charms.map((id) => {
                const Icon = charmIcons[id];
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-label={`${charms[id].name}: ${charms[id].text}`}
                      onClick={() => setInspect({ kind: 'charm', id })}
                    >
                      <Icon aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <QuestMap
        q={q}
        active={screen.kind === 'map' && !inspect}
        walk={host}
        selected={selected}
        onSelect={setSelected}
        onGo={(id) => choose(`stop:${id}`, { type: 'go', stop: id })}
        marks={marks}
      >
        {(stop, at, size, go) => (
          <StopPreview
            q={q}
            stop={stop}
            at={at}
            size={size}
            open={next.includes(stop.id)}
            onGo={() => go(stop.id)}
            onClose={() => setSelected(null)}
          />
        )}
      </QuestMap>

      <ul className="quest-deck" aria-label="Your deck">
        {q.deck.map((id) => (
          <li key={id} data-card={id}>
            <button
              type="button"
              aria-label={`${cards[id].name}, level ${levelOf(q, id)}`}
              onClick={() => setInspect({ kind: 'card', id })}
            >
              <CardArt id={id} />
              <Pips level={levelOf(q, id)} />
            </button>
          </li>
        ))}
        {screen.kind === 'draft' &&
          Array.from(
            { length: Math.max(0, DRAFT_ROUNDS * 2 - q.deck.length) },
            (_, i) => (
              <li
                key={`socket${i}`}
                className="quest-socket"
                aria-hidden="true"
              >
                <span />
              </li>
            ),
          )}
      </ul>

      {overlay && <div className="quest-overlay">{overlay}</div>}

      {inspect && (
        <div
          className="quest-overlay quest-inspect"
          role="presentation"
          onClick={(e) => {
            // A tap beside the card closes it; the card itself stays.
            if (e.target === e.currentTarget) setInspect(null);
          }}
        >
          <Sheet
            title={
              inspect.kind === 'card'
                ? cards[inspect.id].name
                : charms[inspect.id].name
            }
            head={
              inspect.kind === 'card' ? (
                <CardArt id={inspect.id} className="quest-new" />
              ) : (
                <CharmMark id={inspect.id} />
              )
            }
          >
            {inspect.kind === 'card' ? (
              <>
                <Pips level={levelOf(q, inspect.id)} />
                <p className="quest-prompt">{cards[inspect.id].role}</p>
              </>
            ) : (
              <p className="quest-prompt">{charms[inspect.id].text}</p>
            )}
          </Sheet>
        </div>
      )}
      <LeaveDialog
        state={leave}
        title="Leave the quest?"
        saved={saved}
        theme="arena"
      />
    </div>
  );
}

function Sheet({
  title,
  head,
  tone,
  children,
}: {
  title: string;
  head?: ReactNode;
  tone?: 'win' | 'lose';
  children: ReactNode;
}) {
  return (
    <section
      className="quest-sheet"
      data-tone={tone}
      aria-label={title}
      data-game-motion="deal"
    >
      {head && <div className="quest-sheet-head">{head}</div>}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CharmMark({ id }: { id: CharmId }) {
  const Icon = charmIcons[id];
  return (
    <span className="quest-charm-mark">
      <Icon aria-hidden="true" />
    </span>
  );
}

/** Two cards taken together: tap the pair to take both. */
function BundleChoice({
  bundle,
  index,
  onPick,
  children,
}: {
  bundle: Bundle;
  index: number;
  onPick: (el: HTMLElement) => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="quest-bundle"
      style={{ '--i': index } as CSSProperties}
      aria-label={bundle.map((id) => cards[id].name).join(' and ')}
      onClick={(e) => onPick(e.currentTarget)}
    >
      {bundle.map((id) => (
        <span key={id} className="quest-bundle-card" data-card={id}>
          <CardArt id={id} />
          <b>{cards[id].name}</b>
          <span className="quest-roles" aria-hidden="true">
            {isWinCard(id) && <Castle data-role="win" />}
            {isAirAnswer(id) && <Plane data-role="air" />}
          </span>
        </span>
      ))}
      {children}
    </button>
  );
}

function OfferChoice({
  q,
  offer,
  price,
  sold,
  disabled,
  note,
  onClick,
  children,
}: {
  q: QuestState;
  offer: Offer;
  price?: number;
  sold?: boolean;
  disabled?: boolean;
  note?: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  if (offer.kind === 'charm')
    return (
      <button
        type="button"
        className="quest-choice"
        data-kind="charm"
        data-sold={sold}
        disabled={disabled}
        onClick={onClick}
      >
        <CharmMark id={offer.charm} />
        <b>{charms[offer.charm].name}</b>
        <small>{charms[offer.charm].text}</small>
        {price !== undefined && <Price price={price} sold={sold} />}
        {children}
      </button>
    );
  const level = levelOf(q, offer.card);
  return (
    <button
      type="button"
      className="quest-choice"
      data-kind={offer.kind}
      data-sold={sold}
      disabled={disabled}
      onClick={onClick}
    >
      <CardArt id={offer.card} />
      <b>{cards[offer.card].name}</b>
      <small>
        {offer.kind === 'upgrade' ? (
          <span className="quest-level-up">
            Lv {level} <span aria-hidden="true">→</span> {level + 1}
          </span>
        ) : (
          (note ?? cards[offer.card].role)
        )}
      </small>
      {offer.kind === 'card' && <span className="quest-badge">New</span>}
      {price !== undefined && <Price price={price} sold={sold} />}
      {children}
    </button>
  );
}

function Price({ price, sold }: { price: number; sold?: boolean }) {
  return (
    <span className="quest-price" data-sold={sold}>
      {sold ? (
        <Check aria-label="Bought" />
      ) : (
        <>
          <Coins aria-hidden="true" />
          {price}
        </>
      )}
    </span>
  );
}

function DeckGrid({
  q,
  onPick,
  disabled,
  marks,
}: {
  q: QuestState;
  onPick: (id: CardId) => void;
  disabled?: (id: CardId) => boolean;
  marks?: (id: CardId) => ReactNode;
}) {
  return (
    <ul className="quest-deck-grid">
      {q.deck.map((id) => (
        <li key={id}>
          <button
            type="button"
            disabled={disabled?.(id)}
            aria-label={`${cards[id].name}, level ${levelOf(q, id)}`}
            onClick={() => onPick(id)}
          >
            <CardArt id={id} />
            <Pips level={levelOf(q, id)} />
            {marks?.(id)}
          </button>
        </li>
      ))}
    </ul>
  );
}

function StopPreview({
  q,
  stop,
  at,
  size,
  open,
  onGo,
  onClose,
}: {
  q: QuestState;
  stop: Stop;
  /** The stop's ground point and the map's size, in pixels. */
  at: [number, number];
  size: [number, number];
  open: boolean;
  onGo: () => void;
  onClose: () => void;
}) {
  const foe = stop.foe;
  const Icon = stopIcons[stop.kind];
  const foeCards = foe ? [...new Set(foe.decks.flat())] : [];
  const below = at[1] < size[1] * 0.45;
  const half = Math.min(150, size[0] * 0.39);
  return (
    <div
      className="quest-preview"
      data-below={below}
      style={
        {
          left: Math.min(size[0] - half - 12, Math.max(half + 12, at[0])),
          top: at[1],
        } as CSSProperties
      }
      aria-label={foe && stop.kind === 'boss' ? foe.name : stopLabel[stop.kind]}
    >
      <header>
        <Icon aria-hidden="true" />
        <b>{foe && stop.kind === 'boss' ? foe.name : stopLabel[stop.kind]}</b>
        {foe && <span className="quest-foe-level">Lv {foe.level}</span>}
        <button
          type="button"
          className="quest-preview-close"
          aria-label="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </header>
      {foe && (
        <ul className="quest-foe-cards" aria-label="Their cards">
          {foeCards.map((id) => (
            <li key={id}>
              <CardArt id={id} />
            </li>
          ))}
        </ul>
      )}
      {stop.kind === 'boss' && foe && (
        <p className="quest-foe-boost" aria-label="Their towers are stronger">
          <Castle aria-hidden="true" />+
          {Math.round(((foe.boost.towerHp ?? 1) - 1) * 100)}%
        </p>
      )}
      {open ? (
        <button type="button" className="arena-button" onClick={onGo}>
          <Swords aria-hidden="true" /> Go
        </button>
      ) : (
        <span className="quest-locked">
          <Lock aria-hidden="true" />
        </span>
      )}
      {q.curse > 0 && foe && (
        <span className="quest-curse" aria-label="Foes are tougher this region">
          <Skull aria-hidden="true" />+{Math.round(q.curse * 100)}%
        </span>
      )}
    </div>
  );
}
