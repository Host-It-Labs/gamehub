'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './client.ts';
import type { User } from './types.ts';

export type Session = {
  user: User | null;
  /** A guest the server already knows (they typed a name somewhere). */
  guest: { name: string } | null;
};

/** Who is here. Guests play without waiting on this; it only shapes the
 *  account button and the join prompts. */
export function useSession() {
  const [session, setSession] = useState<Session>({ user: null, guest: null });
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    api<Session>('/api/session').then(
      (next) => {
        if (!live) return;
        setSession({ user: next.user ?? null, guest: next.guest ?? null });
        setLoaded(true);
      },
      () => live && setLoaded(true), // Offline: everything local still plays.
    );
    return () => {
      live = false;
    };
  }, [tick]);
  return { ...session, loaded, refresh, setUser: (user: User | null) => setSession((s) => ({ ...s, user })) };
}
