'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/online/client';
import type { User } from '@/lib/online/types';
import { triviaSetupLink } from '@/lib/online/trivia-setup';
import { useTriviaSetupMode } from './use-trivia-setup';
import { ArrowLeft, LogOut, Plus, Users } from 'lucide-react';
import { gameByLibraryId } from '@/lib/games/library-fixtures';
import { GameBox } from '../game/game-box';
import { ThemeButton } from '../game/theme-control';
import '../game/library.css';
import './table-lobby.css';

export { Account } from './account-screen';

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
  const triviaMode = useTriviaSetupMode();
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let session = await api<{ user: User | null }>('/api/session');
        // Development: skip logging in; the dev account hosts.
        if (!session.user && process.env.NODE_ENV === 'development') {
          await api('/api/auth/dev', {});
          session = await api<{ user: User | null }>('/api/session');
        }
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
      window.location.assign(triviaSetupLink(`/table/${t.token}`, triviaMode));
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
                <a
                  className="friends-me"
                  href="/account"
                  title={user.name}
                  aria-label={`Account for ${user.name}`}
                >
                  {user.name.trim().charAt(0).toUpperCase()}
                </a>
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
                      href={triviaSetupLink(
                        `/table/${t.token}`,
                        t.status === 'lobby' ? triviaMode : null,
                      )}
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
              <a
                className="lib-friends"
                href={triviaSetupLink('/auth', triviaMode)}
              >
                Log in
              </a>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
