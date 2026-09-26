'use client';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { api, rememberName } from '@/lib/online/client';
import type { User } from '@/lib/online/types';
import { ArrowLeft, LogOut, Plus, Users } from 'lucide-react';
import { gameByLibraryId } from '@/lib/games/library-fixtures';
import { GameBox } from '../game/game-box';
import { ThemeButton } from '../game/theme-control';
import '../game/library.css';
import './table-lobby.css';

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
      <div className="night-library friends-page">
        <header className="lib-bar">
          <a className="room-back" href="/tables" aria-label="Back">
            <ArrowLeft aria-hidden="true" />
          </a>
          <h1 className="room-title">{signup ? 'Sign up' : 'Log in'}</h1>
        </header>
        <main className="room-join">
          <form onSubmit={submit} className="friends-auth">
            {signup && (
              <input
                name="name"
                aria-label="Your name"
                placeholder="Your name"
                autoComplete="name"
                required
                maxLength={30}
              />
            )}
            <input
              name="email"
              type="email"
              aria-label="Email"
              placeholder="Email"
              autoComplete="email"
              required
              maxLength={254}
            />
            <input
              name="password"
              type="password"
              aria-label="Password"
              placeholder={signup ? 'Password · 10+ characters' : 'Password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              minLength={signup ? 10 : undefined}
              maxLength={128}
              required
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="lib-friends" disabled={busy}>
              {busy ? '…' : signup ? 'Sign up' : 'Log in'}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSignup(!signup);
                setError('');
              }}
            >
              {signup ? 'Log in instead' : 'Create an account'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
type Summary = {
  token: string;
  gameId: string;
  status: string;
  count: number;
};
/** Play with friends: your open tables, a new one, and signing in to host. */
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
      <div className="night-library friends-page">
        <header className="lib-bar">
          <a className="room-back" href="/" aria-label="Home">
            <ArrowLeft aria-hidden="true" />
          </a>
          <h1 className="room-title">Play with friends</h1>
          <div className="lib-actions">
            <ThemeButton className="lib-sound" />
            {user && (
              <>
                <span
                  className="friends-me"
                  title={user.name}
                  aria-hidden="true"
                >
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
                <button
                  className="lib-sound"
                  onClick={logout}
                  aria-label="Log out"
                >
                  <LogOut aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </header>
        <main className="lib-main friends-main" aria-busy={loading}>
          {error && (
            <p role="alert" className="online-notice">
              {error}
            </p>
          )}
          {loading ? null : user ? (
            <ul className="friends-tables">
              <li>
                <button
                  className="friends-new"
                  onClick={create}
                  disabled={busy}
                >
                  <Plus aria-hidden="true" />
                  <b>New table</b>
                </button>
              </li>
              {tables.map((t) => {
                // A lobby has no game yet; a running table shows its box.
                const box =
                  t.status === 'lobby' ? undefined : gameByLibraryId(t.gameId);
                return (
                  <li key={t.token}>
                    <a
                      className="friends-table"
                      href={`/table/${t.token}`}
                      aria-label={`Table with ${t.count} ${t.count === 1 ? 'player' : 'players'}${box ? `, playing ${box.name}` : ''}`}
                    >
                      {box ? (
                        <GameBox game={box} width={96} sizes="120px" />
                      ) : (
                        <span className="friends-seats" aria-hidden="true">
                          {Array.from(
                            { length: Math.min(t.count, 6) },
                            (_, i) => (
                              <i key={i} />
                            ),
                          )}
                        </span>
                      )}
                      <span>
                        <Users aria-hidden="true" />
                        {t.count}
                        {box && <i className="friends-live" />}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <section className="friends-signin">
              <Users aria-hidden="true" />
              <p>Host with an account. Friends only need the link.</p>
              <a className="lib-friends" href="/auth">
                Log in
              </a>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
