'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  api,
  ApiError,
  rememberedName,
  rememberName,
} from '@/lib/online/client';
import type { ExpeditionView } from '@/lib/games/relic/types';
import { RelicScratchSession } from './relic-scratch-session';
import './relic.css';

type Session = {
  user: { name: string } | null;
  guest: { name: string } | null;
};
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Could not reach the scratch desk. Please try again.';
}
/**
 * A Lucky desk link. Desks are opened from the library's box, so this page
 * only loads the desk, or asks an invited player for a name, over the desk
 * itself; it never shows a menu page of its own.
 */
export default function Relic({ invite }: { invite?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ExpeditionView | null>(null);
  const [name, setName] = useState(rememberedName);
  const [invited, setInvited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // The old hub address leads to the library, where Lucky's box lives.
    if (!invite) {
      window.location.replace('/');
      return;
    }
    let active = true;
    void (async () => {
      try {
        const s = await api<Session>('/api/session');
        if (!active) return;
        setSession(s);
        setName(s.user?.name ?? s.guest?.name ?? rememberedName());
        try {
          const v = await api<ExpeditionView>(`/api/expeditions/${invite}`);
          if (active) setView(v);
        } catch (e) {
          if (!(e instanceof ApiError && [401, 403].includes(e.status)))
            throw e;
          if (active) setInvited(true);
        }
      } catch (e) {
        if (active) setError(message(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [invite]);
  async function join() {
    setBusy(true);
    setError('');
    try {
      rememberName(name.trim());
      setView(
        await api<ExpeditionView>(`/api/expeditions/${invite}/join`, { name }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (view) return <RelicScratchSession initial={view} />;
  const known = !!(session?.user || session?.guest);
  return (
    <main className="relic-door" aria-busy={!invited && !error}>
      <picture className="relic-door-art">
        <source
          media="(orientation: portrait)"
          srcSet="/art/relic/scratch-desk-portrait-v1.webp"
        />
        <img src="/art/relic/scratch-desk-landscape-v1.webp" alt="" />
      </picture>
      <a className="relic-door-back" href="/" aria-label="Game library">
        <ArrowLeft size={18} />
      </a>
      {invited ? (
        <form
          className="relic-door-card"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <img
            className="relic-door-cover"
            src="/art/lucky/ticket-seven-v1-small.webp"
            alt=""
          />
          <h1>Lucky</h1>
          {!known && (
            <input
              required
              aria-label="Your name"
              maxLength={30}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          )}
          <button
            className="relic-primary"
            disabled={busy || (!known && !name.trim())}
          >
            Join <ArrowRight size={18} />
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : error ? (
        <div className="relic-door-card" role="alert">
          <p>{error}</p>
          <button
            className="relic-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : (
        <output className="relic-door-wait" aria-label="Opening the desk">
          <img src="/art/lucky/ticket-seven-v1-small.webp" alt="" />
        </output>
      )}
    </main>
  );
}
