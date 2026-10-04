'use client';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { Bomb, Castle, Check, Plane, Sparkles } from 'lucide-react';
import { DECK_SIZE, cards, type CardId } from '@/lib/games/arena/cards';
import { KEEP, OFFER, type DraftView } from '@/lib/games/arena/draft';
import { CardFace, Ring, type ArtOf } from './deck-editor';
import './deck-phase.css';

/** One icon per offer slot, in the draft's role order (win, air, splash,
 *  spell or support). */
const roleIcons = [Castle, Plane, Bomb, Sparkles];
const roleNames = ['Win condition', 'Hits air', 'Splash', 'Spell or support'];

const still = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The Split draft over the loading screen: the other side at the top, your
 * offer of four in the middle under a draining ring, your teammate's offer
 * and live picks below it in 2 v 2, and your deck along the bottom. Tap two
 * cards to keep them; the second locks them in. When the round settles the
 * kept cards fly down into your deck, the others fly away across, and what
 * came over flies in. The final eight show, then the battle.
 */
export function DraftBoard({
  view,
  at,
  names,
  art,
  onPick,
}: {
  view: DraftView | null;
  /** When `view.left` was measured, on the `performance.now()` clock. */
  at: number;
  names: string[];
  art: ArtOf;
  onPick: (picks: CardId[]) => void;
}) {
  const offerEls = useRef(new Map<CardId, HTMLElement>());
  const slotEls = useRef<(HTMLElement | null)[]>([]);
  const foeEl = useRef<HTMLLIElement>(null);
  const shown = useRef<{ round: number; stage: string } | null>(null);

  // Cards fly when a round settles.
  useLayoutEffect(() => {
    if (!view) return;
    const was = shown.current;
    shown.current = { round: view.round, stage: view.stage };
    if (
      view.stage !== 'reveal' ||
      !was ||
      was.round !== view.round ||
      was.stage !== 'pick' ||
      still()
    )
      return;
    const r = view.round;
    const round = view.rounds[r];
    const foe = foeEl.current?.getBoundingClientRect();
    const centre = (b: DOMRect) => [b.left + b.width / 2, b.top + b.height / 2];
    round.offer.forEach((id, i) => {
      const el = offerEls.current.get(id);
      const k = round.picks.indexOf(id);
      const target =
        k >= 0 ? slotEls.current[r * OFFER + k]?.getBoundingClientRect() : foe;
      if (!el || !target) return;
      const from = el.getBoundingClientRect();
      const [fx, fy] = centre(from);
      const [tx, ty] = centre(target);
      const scale = k >= 0 ? target.width / from.width : 0.3;
      el.animate(
        [
          { transform: 'none', opacity: 1 },
          {
            transform: `translate(${tx - fx}px, ${ty - fy}px) scale(${scale})`,
            opacity: k >= 0 ? 1 : 0,
          },
        ],
        {
          duration: 520,
          delay: i * 60,
          easing: 'cubic-bezier(0.55, 0, 0.25, 1)',
          fill: 'forwards',
        },
      );
    });
    // Your two land; what came over flies in from across.
    for (let k = 0; k < OFFER; k++) {
      const slot = slotEls.current[r * OFFER + k];
      if (!slot) continue;
      if (k < KEEP) {
        slot.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 80,
          delay: 500 + k * 60,
          fill: 'backwards',
        });
        continue;
      }
      const to = slot.getBoundingClientRect();
      const [sx, sy] = centre(to);
      const [ox, oy] = foe ? centre(foe) : [sx, sy - 200];
      slot.animate(
        [
          {
            transform: `translate(${ox - sx}px, ${oy - sy}px) scale(0.4)`,
            opacity: 0,
          },
          { transform: 'none', opacity: 1 },
        ],
        {
          duration: 460,
          delay: 560 + (k - KEEP) * 90,
          easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)',
          fill: 'backwards',
        },
      );
    }
  }, [view]);

  const you = view?.you ?? 0;
  const opponent = view?.opponent ?? 1;
  const mate = view?.mate ?? null;
  // Everyone on the other side, the one across you first.
  const foes = names
    .map((_, i) => i)
    .filter((i) => i % 2 !== you % 2)
    .sort((a, b) => +(b === opponent) - +(a === opponent));
  const round = view?.rounds[view.round];
  const picking = view?.stage === 'pick' && !!round && !round.locked;
  const tap = (id: CardId) => {
    if (!round || !picking) return;
    const picks = round.picks.includes(id)
      ? round.picks.filter((c) => c !== id)
      : round.picks.length < KEEP
        ? [...round.picks, id]
        : round.picks;
    if (picks !== round.picks) onPick(picks);
  };
  const deck = view?.deck ?? [];
  return (
    <section
      className="arena-draft"
      aria-label="Draft"
      data-stage={view?.stage ?? 'join'}
      data-team={mate !== null}
    >
      <ul className="arena-draft-foes arena-dots" aria-label="Across">
        {foes.map((seat) => (
          <li
            key={seat}
            ref={seat === opponent ? foeEl : undefined}
            className="team-1"
            data-ready={!!view?.locked[seat]}
            data-lane={seat === opponent}
          >
            <span>{names[seat]}</span>
            <i aria-label={view?.locked[seat] ? 'Ready' : 'Choosing'} />
          </li>
        ))}
      </ul>
      <div className="arena-draft-middle">
        {view?.stage === 'final' || view?.stage === 'done' ? (
          <ul className="arena-draft-final" aria-label="Your deck">
            {deck.map((id, i) => (
              <li key={id} style={{ '--i': i } as CSSProperties}>
                <CardFace id={id} art={art} />
                <span className="arena-pc-name">{cards[id].name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="arena-draft-clock">
              {view && view.stage === 'pick' ? (
                <Ring ends={at + view.left} total={view.total} />
              ) : (
                <span className="arena-ring idle" aria-hidden="true" />
              )}
              <span className="arena-draft-rounds" aria-hidden="true">
                {[0, 1].map((r) => (
                  <i key={r} data-on={!!view && r <= view.round} />
                ))}
              </span>
            </div>
            <ul
              key={view?.round ?? -1}
              className="arena-draft-offer"
              aria-label="Keep two"
              data-locked={!!round?.locked}
            >
              {(round?.offer ?? Array<CardId | null>(OFFER).fill(null)).map(
                (id, i) => {
                  const Icon = roleIcons[i];
                  if (!id)
                    return (
                      <li key={i} style={{ '--i': i } as CSSProperties}>
                        <span className="arena-draft-back" />
                      </li>
                    );
                  const kept = !!round?.picks.includes(id);
                  return (
                    <li key={id} style={{ '--i': i } as CSSProperties}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) offerEls.current.set(id, el);
                          else offerEls.current.delete(id);
                        }}
                        aria-pressed={kept}
                        disabled={!picking}
                        aria-label={`${cards[id].name}, ${cards[id].cost} elixir. ${roleNames[i]}`}
                        onClick={() => tap(id)}
                      >
                        <CardFace id={id} art={art} />
                        <Icon className="arena-draft-role" aria-hidden="true" />
                        {kept && (
                          <Check className="arena-pick-in" aria-hidden="true" />
                        )}
                        <span className="arena-pc-name">{cards[id].name}</span>
                      </button>
                    </li>
                  );
                },
              )}
            </ul>
            {mate !== null && round?.mate && (
              <div className="arena-draft-mate">
                <span
                  className="arena-dots-one team-0"
                  data-ready={round.mate.locked}
                >
                  <span>{names[mate]}</span>
                  <i aria-label={round.mate.locked ? 'Ready' : 'Choosing'} />
                </span>
                <ul aria-label={`${names[mate]} keeps`}>
                  {round.mate.offer.map((id) => (
                    <li
                      key={id}
                      data-picked={round.mate!.picks.includes(id)}
                      title={cards[id].name}
                    >
                      <CardFace id={id} art={art} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      <ol className="arena-draft-deck" aria-label="Your deck">
        {Array.from({ length: DECK_SIZE }, (_, i) => {
          const id = deck[i];
          return (
            <li
              key={i}
              ref={(el) => {
                slotEls.current[i] = el;
              }}
              data-empty={!id}
            >
              {id && <CardFace id={id} art={art} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
