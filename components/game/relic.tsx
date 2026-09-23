'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Ticket, Factory, Sparkles } from 'lucide-react';
import {
  api,
  ApiError,
  rememberedName,
  rememberName,
} from '@/lib/online/client';
import type {
  ExpeditionSummary,
  ExpeditionView,
} from '@/lib/games/relic/types';
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
export default function Relic({ invite }: { invite?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [expeditions, setExpeditions] = useState<ExpeditionSummary[]>([]);
  const [view, setView] = useState<ExpeditionView | null>(null);
  const [name, setName] = useState(rememberedName);
  const [title, setTitle] = useState('Our scratch desk');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [s, list] = await Promise.all([
          api<Session>('/api/session'),
          api<ExpeditionSummary[]>('/api/expeditions'),
        ]);
        if (!active) return;
        setSession(s);
        setExpeditions(list);
        setName(s.user?.name ?? s.guest?.name ?? rememberedName());
        if (invite) {
          try {
            const v = await api<ExpeditionView>(`/api/expeditions/${invite}`);
            if (active) setView(v);
          } catch (e) {
            if (!(e instanceof ApiError && [401, 403].includes(e.status)))
              throw e;
          }
        }
      } catch (e) {
        if (active) setError(message(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [invite]);
  async function enter() {
    setBusy(true);
    setError('');
    try {
      rememberName(name.trim());
      const v = await api<ExpeditionView>(
        invite ? `/api/expeditions/${invite}/join` : '/api/expeditions',
        { name, title, world: 'dunes' },
      );
      if (invite) setView(v);
      else window.location.assign(`/expedition/${v.token}`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (view) return <RelicScratchSession initial={view} />;
  return (
    <main className="relic-hub">
      <div className="relic-hub-art" aria-hidden="true" />
      <a className="relic-home-link" href="/">
        <ArrowLeft size={18} /> Game library
      </a>
      <div className="relic-hub-content">
        <h1>
          Relic
          <span>Scratch tickets. Build a ticket factory.</span>
        </h1>
        <div className="relic-hub-facts">
          <span>
            <Ticket size={16} /> 8 ticket books
          </span>
          <span>
            <Factory size={16} /> Your own factory
          </span>
          <span>
            <Sparkles size={16} /> Up to 6 players
          </span>
        </div>
        {loading ? (
          <output>Opening the scratch desk…</output>
        ) : (
          <>
            {!invite && expeditions.length > 0 && (
              <section
                className="relic-expeditions"
                aria-label="Your saved scratch desks"
              >
                <h2>Your desks</h2>
                {expeditions.map((e) => (
                  <a
                    key={e.token}
                    href={`/expedition/${e.token}`}
                    className={`relic-saved relic-${e.world}`}
                  >
                    <span className="relic-world-dot" />
                    <span>
                      <strong>{e.name}</strong>
                      <small>
                        {e.members.join(' · ')}
                        <br />
                        {e.tickets ?? 0} tickets finished
                      </small>
                    </span>
                    <ArrowRight size={20} />
                  </a>
                ))}
              </section>
            )}
            <form
              className="relic-new-expedition"
              onSubmit={(e) => {
                e.preventDefault();
                void enter();
              }}
            >
              <h2>
                {invite
                  ? 'Your scratch desk is waiting'
                  : expeditions.length
                    ? 'New desk'
                    : 'Open your first scratch desk'}
              </h2>
              {!session?.user && !session?.guest && (
                <label>
                  Your name
                  <input
                    required
                    maxLength={30}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                  />
                </label>
              )}
              {!invite && (
                <>
                  <label>
                    Desk name
                    <input
                      required
                      maxLength={40}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                </>
              )}
              <button
                className="relic-primary"
                disabled={
                  busy || (!name.trim() && !session?.user && !session?.guest)
                }
              >
                {busy
                  ? 'Turning the key…'
                  : invite
                    ? 'Join the scratch desk'
                    : 'Let’s play'}
                <ArrowRight size={18} />
              </button>
              {!session?.user && (
                <p className="relic-fine">
                  Saved in this browser. <a href="/auth">Sign in</a> to play on
                  other devices.
                </p>
              )}
            </form>
          </>
        )}
        {error && (
          <div className="relic-error" role="alert">
            {error}
            <button onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
      </div>
    </main>
  );
}
