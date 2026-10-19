'use client';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { ArrowLeft, Check, Flame, KeyRound, LogOut, Pencil, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { api, rememberName } from '@/lib/online/client';
import type { User } from '@/lib/online/types';
import {
  formatValue,
  leaderboardGame,
  unitLabel,
  type LeaderboardSummary,
} from '@/lib/games/leaderboards';
import { boxCover } from '@/lib/games/box-covers';
import { triviaSetupLink } from '@/lib/online/trivia-setup';
import { useTriviaSetupMode } from './use-trivia-setup';
import { ArtworkImage } from '../game/artwork';
import { ThemeButton } from '../game/theme-control';
import { AccessForm, PasswordField, RecoveryCode, type AccessMode } from './account-forms';
import { PlayerMark } from './player-mark';
import '../game/library.css';
import './account-forms.css';
import './account.css';

const subscribe = () => () => {};
const tableAccess = () => window.location.pathname === '/auth';
const serverTableAccess = () => false;
function initialMode(): AccessMode {
  if (typeof window === 'undefined') return 'signup';
  const mode = new URLSearchParams(window.location.search).get('mode');
  return mode === 'login' || mode === 'recover' ? mode : window.location.pathname === '/auth' ? 'login' : 'signup';
}

/** Your standing in every game you have played, guest or account. */
function useSummaries(key: string) {
  const [rows, setRows] = useState<LeaderboardSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    void api<LeaderboardSummary[]>('/api/leaderboards/me').then(
      (r) => live && setRows(r),
      () => live && setRows([]),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return rows;
}

function Boards({ rows, guest }: { rows: LeaderboardSummary[]; guest: boolean }) {
  return (
    <ul className="acct-boards">
      {rows.map((row) => {
        const game = leaderboardGame(row.gameId);
        return (
          <li key={`${row.gameId}:${row.view}`}>
            <a href={`/leaderboards?game=${row.gameId}&view=${encodeURIComponent(row.view)}`} className="acct-board">
              <span className="acct-board-cover">
                <ArtworkImage src={boxCover(row.gameId)} width={512} height={512} sizes="64px" alt="" draggable={false} />
              </span>
              <span className="acct-board-text">
                <span className="acct-board-name">
                  {game?.name}
                  {row.label && row.metric !== 'rating' && <small> · {row.label}</small>}
                </span>
                <b>
                  {formatValue(row.value)}
                  {row.metric !== 'rating' && <small>{unitLabel(row.metric, row.value)}</small>}
                </b>
              </span>
              <span className="acct-board-place">
                #{row.rank}
                <small>{guest || !row.public ? 'when you join' : `of ${row.total}`}</small>
                {row.metric === 'rating' && row.streak >= 2 && (
                  <span className="acct-board-streak">
                    <Flame aria-hidden="true" />
                    {row.streak}
                  </span>
                )}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Setting({ icon, title, children, danger = false }: { icon: ReactNode; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <details className={`acct-setting ${danger ? 'is-danger' : ''}`}>
      <summary>
        {icon}
        {title}
      </summary>
      <div className="acct-setting-body">{children}</div>
    </details>
  );
}

function Profile({
  user,
  onUpdate,
  onLogout,
  onRecovery,
  children,
}: {
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
  onRecovery: (code: string) => void;
  /** Shown between the name card and the settings: your boards. */
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) nameField.current?.select();
  }, [editing]);
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }
  function submit(event: SyntheticEvent<HTMLFormElement>, action: (data: Record<string, FormDataEntryValue>) => Promise<void>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    void perform(async () => {
      await action(data);
      form.reset();
    });
  }
  return (
    <>
      <section className="acct-card acct-profile" aria-busy={busy}>
        <PlayerMark id={user.id} name={user.name} size={64} />
        <div className="acct-profile-text">
          {editing ? (
            <form
              className="acct-name-form"
              onSubmit={(event) =>
                submit(event, async (data) => {
                  const result = await api<{ user: User }>('/api/account/profile', data);
                  onUpdate(result.user);
                  rememberName(result.user.name);
                  setEditing(false);
                  setNotice('Name saved');
                })
              }
            >
              <label className="sr-only" htmlFor="acct-profile-name">
                Name on the board
              </label>
              <input
                ref={nameField}
                id="acct-profile-name"
                name="name"
                defaultValue={user.name}
                autoComplete="name"
                required
                maxLength={30}
                disabled={busy}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              />
              <button className="acct-primary" disabled={busy}>
                Save
              </button>
            </form>
          ) : (
            <h2>
              {user.name}
              <button type="button" className="acct-icon" aria-label="Change your name" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
              </button>
            </h2>
          )}
          <p>{user.email}</p>
        </div>
        <button
          type="button"
          className="acct-ghost acct-logout"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              await api('/api/auth/logout', {});
              onLogout();
            })
          }
        >
          <LogOut aria-hidden="true" />
          <span>Log out</span>
        </button>
        {(notice || error) && (
          <p className={notice ? 'acct-notice' : 'acct-error'} role={error ? 'alert' : 'status'}>
            {notice && <Check aria-hidden="true" />}
            {notice || error}
          </p>
        )}
      </section>
      {children}
      <section className="acct-settings" aria-label="Account settings">
        <Setting icon={<KeyRound aria-hidden="true" />} title="Change password">
          <form
            className="acct-form"
            onSubmit={(event) =>
              submit(event, async (data) => {
                await api('/api/account/password', data);
                setNotice('Password changed. Other devices are logged out.');
              })
            }
          >
            <fieldset disabled={busy}>
              <PasswordField name="currentPassword" label="Current password" />
              <PasswordField label="New password" fresh />
            </fieldset>
            <button className="acct-ghost" disabled={busy}>
              Change password
            </button>
          </form>
        </Setting>
        <Setting icon={<ShieldCheck aria-hidden="true" />} title="New recovery code">
          <p>A new code replaces the old one.</p>
          <form
            className="acct-form"
            onSubmit={(event) =>
              submit(event, async (data) => {
                const result = await api<{ recoveryCode: string }>('/api/account/recovery-code', data);
                onRecovery(result.recoveryCode);
              })
            }
          >
            <fieldset disabled={busy}>
              <PasswordField label="Current password" />
            </fieldset>
            <button className="acct-ghost" disabled={busy}>
              Make a new code
            </button>
          </form>
        </Setting>
        <Setting icon={<Trash2 aria-hidden="true" />} title="Delete account" danger>
          <p>Your account and places on the boards go. Tables you own close. You can still play as a guest.</p>
          <form
            className="acct-form"
            onSubmit={(event) =>
              submit(event, async (data) => {
                if (!deleteConfirmed) return;
                await api('/api/account/delete', { password: data.password });
                onLogout();
              })
            }
          >
            <fieldset disabled={busy}>
              <PasswordField label="Current password" />
              <label className="acct-check">
                <input type="checkbox" checked={deleteConfirmed} onChange={(e) => setDeleteConfirmed(e.target.checked)} required />
                Delete my account for good
              </label>
            </fieldset>
            <button className="acct-ghost acct-danger" disabled={busy || !deleteConfirmed}>
              Delete account
            </button>
          </form>
        </Setting>
      </section>
    </>
  );
}

/** Opened from the account button; nothing during play leads here unasked. */
export function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const fromTables = useSyncExternalStore(subscribe, tableAccess, serverTableAccess);
  const triviaMode = useTriviaSetupMode();
  const heading = useRef<HTMLHeadingElement>(null);
  const summaries = useSummaries(user?.id ?? 'guest');
  const [mode] = useState(initialMode);
  useEffect(() => {
    let active = true;
    void api<{ user: User | null }>('/api/session')
      .then((session) => active && setUser(session.user))
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  const back = fromTables ? triviaSetupLink('/tables', triviaMode) : '/';
  const waiting = summaries?.filter((s) => !s.public) ?? [];
  return (
    <div className="app">
      <div className="night-library acct-page">
        <header className="lib-bar acct-bar">
          <a className="lib-sound" href={back} aria-label={fromTables ? 'Back to tables' : 'Back to games'}>
            <ArrowLeft aria-hidden="true" />
          </a>
          <h1 ref={heading} tabIndex={-1}>
            Account
          </h1>
          <div className="lib-actions">
            <a className="lib-sound" href="/leaderboards" aria-label="Leaderboards" title="Leaderboards">
              <Trophy aria-hidden="true" />
            </a>
            <ThemeButton className="lib-sound" />
          </div>
        </header>
        <main className="acct-main" aria-busy={loading}>
          {loading ? (
            <div className="acct-card acct-loading" aria-hidden="true" />
          ) : user ? (
            <div className="acct-signed-in">
              {recoveryCode && (
                <RecoveryCode
                  code={recoveryCode}
                  onDone={() => {
                    setRecoveryCode(null);
                    heading.current?.focus();
                  }}
                />
              )}
              <Profile
                user={user}
                onUpdate={setUser}
                onRecovery={setRecoveryCode}
                onLogout={() => {
                  setRecoveryCode(null);
                  setUser(null);
                  heading.current?.focus();
                }}
              >
                <section className="acct-section" aria-labelledby="acct-boards-title">
                  <h2 id="acct-boards-title">Your boards</h2>
                  {summaries === null ? (
                    <div className="acct-boards-loading" aria-hidden="true" />
                  ) : summaries.length ? (
                    <Boards rows={summaries} guest={false} />
                  ) : (
                    <div className="acct-boards-empty">
                      <p>Play a game against Hard bots to get your first rating.</p>
                      <a className="acct-primary" href="/">
                        Play
                      </a>
                    </div>
                  )}
                </section>
              </Profile>
            </div>
          ) : (
            <div className="acct-join">
              <section className="acct-hero">
                <div className="acct-hero-medal" aria-hidden="true">
                  <span>
                    <Trophy />
                  </span>
                </div>
                <h2>{mode === 'login' ? 'Welcome back' : 'Your name on the boards'}</h2>
                <p>
                  {mode === 'login'
                    ? 'Log in to pick up your boards on this device.'
                    : 'Your games count from the first one. Join to show your name and keep your places on every device.'}
                </p>
                {waiting.length > 0 && (
                  <div className="acct-waiting">
                    <span className="acct-waiting-label">Waiting for your name</span>
                    <Boards rows={waiting} guest />
                  </div>
                )}
              </section>
              <section className="acct-card acct-access-card">
                {error && (
                  <p role="alert" className="acct-error">
                    {error}
                  </p>
                )}
                {recoveryCode ? (
                  <RecoveryCode code={recoveryCode} onDone={() => setRecoveryCode(null)} />
                ) : (
                  <AccessForm
                    initialMode={mode}
                    onSignedIn={(signedIn, code) => {
                      setError('');
                      setUser(signedIn);
                      if (code) setRecoveryCode(code);
                      else if (fromTables) window.location.assign(back);
                    }}
                    footer={<p className="acct-fine">Only your name and results are public. Your email stays private.</p>}
                  />
                )}
                <a className="acct-guest" href={back}>
                  Keep playing as a guest
                </a>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
