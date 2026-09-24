'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, requestId } from '@/lib/online/client';
import type { ActionResult, RelicAction } from '@/lib/games/relic/engine';
import type { ExpeditionView } from '@/lib/games/relic/types';
import { RelicScratch } from './relic-scratch';
export function RelicScratchSession({ initial }: { initial: ExpeditionView }) {
  const [view, setView] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(initial),
    chain = useRef(Promise.resolve()),
    pending = useRef(0),
    mounted = useRef(true);
  const path = `/api/expeditions/${initial.token}`;
  const accept = useCallback((next: ExpeditionView) => {
    const old = latest.current;
    if (
      next.game.revision < old.game.revision ||
      (next.game.revision === old.game.revision &&
        next.serverNow < old.serverNow)
    )
      return;
    latest.current = next;
    if (mounted.current) setView(next);
  }, []);
  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<ExpeditionView>(path);
        if (!stopped) accept(next);
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : 'Reconnecting to your desk…',
          );
      }
      if (!stopped)
        timer = setTimeout(() => void poll(), document.hidden ? 5000 : 1800);
    }
    void poll();
    return () => {
      stopped = true;
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [path, accept]);
  const dispatch = useCallback(
    (action: RelicAction): Promise<ActionResult | null> => {
      pending.current++;
      setBusy(true);
      const work = chain.current.then(async () => {
        const command = { requestId: requestId(), action };
        try {
          let next: ExpeditionView;
          try {
            next = await api<ExpeditionView>(`${path}/commands`, command);
          } catch (e) {
            if (e instanceof ApiError) throw e;
            next = await api<ExpeditionView>(`${path}/commands`, command);
          }
          accept(next);
          if (mounted.current) setError('');
          return next.result ?? {};
        } catch (e) {
          try {
            accept(await api<ExpeditionView>(path));
          } catch {
            /* Keep the last confirmed snapshot. */
          }
          if (mounted.current)
            setError(
              e instanceof Error
                ? e.message
                : 'Could not save that scratch. Try again.',
            );
          return null;
        } finally {
          pending.current--;
          if (mounted.current) setBusy(pending.current > 0);
        }
      });
      chain.current = work.then(() => {});
      return work;
    },
    [accept, path],
  );
  return (
    <RelicScratch
      view={view}
      busy={busy}
      error={error}
      onAct={dispatch}
      onView={accept}
      onBack={() => {
        void chain.current.then(() => window.location.assign('/'));
      }}
    />
  );
}
