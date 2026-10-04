'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { CardId } from '@/lib/games/arena/cards';
import { DECK_MS } from '@/lib/games/arena/room';
import {
  CardFace,
  DeckPicker,
  DeckWait,
  rememberedDeck,
  type ArtOf,
  type SeatDot,
} from './deck-editor';
import { DraftBoard } from './draft-board';
import type { OnlineSession } from './online';
import type { Session } from './session';

/**
 * The deck phase over the battle's loading screen (or the field, before a
 * later battle): the deck picker with your last deck ready, or the draft.
 * Ready counts once the battle has loaded too; until then your eight wait
 * above the loading bar. Online, everyone else's dot lights as they are in.
 */
export function DeckLayer({
  session,
  loading,
  art,
}: {
  session: Session;
  /** The battle's art is still loading on this device. */
  loading: boolean;
  art: ArtOf;
}) {
  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener),
    [session],
  );
  const phase = useSyncExternalStore(
    subscribe,
    () => session.phase,
    () => null,
  );
  const [deck, setDeck] = useState<CardId[]>(rememberedDeck);
  const [confirmed, setConfirmed] = useState(false);
  // Each battle's phase starts with nothing confirmed.
  const [open, setOpen] = useState(!!phase);
  if (!!phase !== open) {
    setOpen(!!phase);
    if (!phase) setConfirmed(false);
  }
  const kind = phase?.kind;

  useEffect(() => {
    if (!loading) session.loaded();
  }, [loading, session]);
  // Online, the room holds your latest deck in case its clock runs out.
  useEffect(() => {
    if (kind === 'pick' && !confirmed && session.kind === 'online')
      session.chooseDeck(deck, false);
  }, [deck, kind, confirmed, session]);
  // Ready counts once the battle has loaded here.
  useEffect(() => {
    if (kind === 'pick' && confirmed && !loading)
      session.chooseDeck(deck, true);
  }, [kind, confirmed, loading, deck, session]);

  if (!phase) return null;
  const online = session.kind === 'online' ? (session as OnlineSession) : null;
  const ready =
    phase.kind === 'pick'
      ? phase.ready
      : (phase.view?.locked ?? session.names.map(() => false));
  // The people at the table besides you; bots are always in.
  const seats: SeatDot[] | undefined = online
    ? online.room.seats
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => !s.bot && i !== session.you)
        .map(({ s, i }) => ({
          name: s.name,
          team: (i % 2 === session.you % 2 ? 0 : 1) as 0 | 1,
          ready: !!ready[i],
        }))
    : undefined;
  const clock =
    phase.kind === 'pick' && phase.ends
      ? { ends: phase.ends, total: DECK_MS }
      : undefined;

  if (phase.kind === 'draft')
    return (
      <div className="arena-deckphase" data-loading={loading}>
        <DraftBoard
          view={phase.view}
          at={phase.at}
          names={session.names}
          art={art}
          onPick={(picks) => session.draftPick(picks)}
        />
      </div>
    );
  if (confirmed)
    return (
      <div className="arena-deckphase" data-loading={loading} data-wait="true">
        <DeckWait seats={seats ?? []} clock={online ? clock : undefined}>
          <ol className="arena-pick-deck" aria-label="Your deck">
            {deck.map((id, i) => (
              <li key={i}>
                <CardFace id={id} art={art} />
              </li>
            ))}
          </ol>
        </DeckWait>
      </div>
    );
  return (
    <div className="arena-deckphase" data-loading={loading}>
      <DeckPicker
        deck={deck}
        onChange={setDeck}
        onReady={() => setConfirmed(true)}
        art={art}
        seats={seats?.length ? seats : undefined}
        clock={clock}
      />
    </div>
  );
}
