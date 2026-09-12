'use client';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { api, rememberName } from '@/lib/online/client';
import type { User } from '@/lib/online/types';
import { catalog, type GameId } from '@/lib/games/trio/engine';

export function OnlineHeader() {
  return (
    <header className="app-header">
      <a className="brand" href="/">
        <span className="brand-icon">g</span>gamehub
      </a>
      <a className="secondary" href="/tables">
        My tables
      </a>
    </header>
  );
}
export function Account() {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api(
        `/api/auth/${signup ? 'signup' : 'login'}`,
        Object.fromEntries(data),
      );
      if (signup) rememberName(data.get('name') as string);
      window.location.assign('/tables');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="app">
      <OnlineHeader />
      <main className="online-card auth-card">
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p>Host a table and invite your friends.</p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              Your name
              <input name="name" autoComplete="name" required maxLength={30} />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              minLength={signup ? 10 : undefined}
              maxLength={128}
              required
            />
          </label>
          {signup && <small>At least 10 characters.</small>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setSignup(!signup);
            setError('');
          }}
        >
          {signup ? 'Already have an account? Log in' : 'New here? Sign up'}
        </button>
        <a href="/">Play solo without an account</a>
      </main>
    </div>
  );
}
type Summary = { token: string; gameId: GameId; status: string; count: number };
export function MyTables() {
  const [user, setUser] = useState<User | null>(null),
    [tables, setTables] = useState<Summary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await api<{ user: User | null }>('/api/session');
        if (!active) return;
        setUser(session.user);
        if (session.user) {
          const rows = await api<Summary[]>('/api/tables');
          if (active) setTables(rows);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function create() {
    setBusy(true);
    try {
      const t = await api<{ token: string }>('/api/tables', {});
      window.location.assign(`/table/${t.token}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api('/api/auth/logout', {});
      window.location.assign('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app">
      <OnlineHeader />
      <main className="online-card">
        <h1>Play with friends</h1>
        {loading ? (
          <output>Loading your tables…</output>
        ) : user ? (
          <>
            <div className="online-row">
              <p>Hi, {user.name}.</p>
              <button className="text-button" onClick={logout}>
                Log out
              </button>
            </div>
            <button className="primary" onClick={create} disabled={busy}>
              Create a table
            </button>
            <div className="table-list">
              {tables.map((t) => (
                <a href={`/table/${t.token}`} key={t.token}>
                  <strong>
                    {catalog.find((g) => g.id === t.gameId)?.name}
                  </strong>
                  <span>
                    {t.count} {t.count === 1 ? 'person' : 'people'} ·{' '}
                    {{
                      lobby: 'Waiting to start',
                      playing: 'In progress',
                      finished: 'Finished',
                      closed: 'Closed',
                    }[t.status] ?? 'Unavailable'}
                  </span>
                  <span>Open table →</span>
                </a>
              ))}
            </div>
            {!tables.length && (
              <p>Create a table, copy its link, and send it to your friends.</p>
            )}
          </>
        ) : (
          <>
            <p>
              Create an account to host. Your friends only need the invite link
              and a name.
            </p>
            <a className="primary" href="/auth">
              Log in / Sign up
            </a>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
