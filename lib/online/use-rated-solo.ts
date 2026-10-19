'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveRatedGame } from '../games/leaderboards.ts';
import { api, rememberedName } from './client.ts';
import { launchRankedSolo, rankedSoloRequest, type RankedSoloLaunch, type RankedSoloRequest } from './ranked-solo.ts';

/**
 * Hard games count on their own: setup hands them to the server, for guests
 * as much as for accounts, and nobody picks a mode. Easy and Medium, and
 * every game while offline, stay on this device.
 */
export function useRatedSolo({ list = true }: { list?: boolean } = {}) {
  const [active, setActive] = useState<ActiveRatedGame[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const attempt = useRef<RankedSoloRequest | undefined>(undefined);

  const refresh = useCallback(
    () =>
      api<ActiveRatedGame[]>('/api/solo/ranked').then(setActive, () => {
        /* Offline or no session yet: nothing unfinished to offer. */
      }),
    [],
  );
  useEffect(() => {
    if (!list) return;
    let live = true;
    api<ActiveRatedGame[]>('/api/solo/ranked').then(
      (games) => live && setActive(games),
      () => { /* Offline or no session yet: nothing unfinished to offer. */ },
    );
    return () => {
      live = false;
    };
  }, [list]);

  async function start(choice: RankedSoloLaunch) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      attempt.current = rankedSoloRequest(choice, attempt.current, rememberedName() || undefined);
      window.location.assign(await launchRankedSolo(attempt.current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The rated game could not be opened.');
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    active,
    busy,
    error,
    start,
    refresh,
    clearError: () => setError(''),
    /** The unfinished rated game of this game, if any. */
    activeFor: (gameId: string) => active.find((game) => game.gameId === gameId),
  };
}
