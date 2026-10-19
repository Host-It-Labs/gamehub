'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Check, Copy, Download, Eye, EyeOff, KeyRound } from 'lucide-react';
import { api, rememberName, rememberedName } from '@/lib/online/client';
import type { User } from '@/lib/online/types';
import './account-forms.css';

export type AccessMode = 'signup' | 'login' | 'recover';
type AuthResult = { ok: true; recoveryCode?: string };

export function PasswordField({
  name = 'password',
  label = 'Password',
  fresh = false,
}: {
  name?: string;
  label?: string;
  fresh?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="acct-field">
      <label htmlFor={id}>{label}</label>
      <div className="acct-password">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={fresh ? 'new-password' : 'current-password'}
          minLength={fresh ? 10 : undefined}
          maxLength={128}
          required
          placeholder={fresh ? 'At least 10 characters' : undefined}
        />
        <button
          type="button"
          className="acct-reveal"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/** Shown once after creating an account or asking for a new code. There is
 *  no email delivery, so this code is the only way back in after a lost password. */
export function RecoveryCode({
  code,
  onDone,
  doneLabel = 'Done',
}: {
  code: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      field.current?.focus();
      field.current?.select();
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          `Gamehub recovery code\n\n${code}\n\nKeep this private. Use it with your account email to reset your password. Each code works once.\n`,
        ],
        { type: 'text/plain' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gamehub-recovery-code.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="acct-recovery" aria-labelledby="acct-recovery-title">
      <h3 id="acct-recovery-title">
        <KeyRound aria-hidden="true" /> Your recovery code
      </h3>
      <p>Keep it somewhere safe. It resets your password if you forget it.</p>
      <label className="sr-only" htmlFor="acct-recovery-code">
        Recovery code
      </label>
      <input
        id="acct-recovery-code"
        ref={field}
        readOnly
        value={code}
        spellCheck={false}
        autoComplete="off"
      />
      <div className="acct-recovery-actions">
        <button type="button" className="acct-ghost" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="acct-ghost" onClick={download}>
          <Download aria-hidden="true" />
          Save
        </button>
        <button type="button" className="acct-primary" onClick={onDone}>
          {doneLabel}
        </button>
      </div>
      <output className="sr-only">{copied ? 'Recovery code copied.' : ''}</output>
    </section>
  );
}

/** Join, log in or reset, in one card. A guest who joins keeps everything
 *  played so far: the server turns the guest into the account. */
export function AccessForm({
  initialMode = 'signup',
  defaultName,
  onSignedIn,
  focusFirst = false,
  footer,
}: {
  initialMode?: AccessMode;
  defaultName?: string;
  onSignedIn: (user: User, recoveryCode: string | undefined) => void;
  /** Focus the first field on open (the join sheet). */
  focusFirst?: boolean;
  footer?: ReactNode;
}) {
  const [mode, setMode] = useState<AccessMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(() => defaultName ?? rememberedName());
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusFirst || mode !== initialMode) first.current?.focus();
  }, [mode, focusFirst, initialMode]);
  function switchTo(next: AccessMode) {
    setMode(next);
    setError('');
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api<AuthResult>(`/api/auth/${mode}`, data);
      const session = await api<{ user: User | null }>('/api/session');
      if (!session.user) throw new Error('Could not open your account. Try logging in.');
      rememberName(session.user.name);
      onSignedIn(session.user, result.recoveryCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }
  return (
    <div className="acct-access" data-mode={mode}>
      <form className="acct-form" onSubmit={submit} key={mode} aria-busy={busy}>
        <fieldset disabled={busy}>
          {mode === 'signup' && (
            <div className="acct-field">
              <label htmlFor="acct-name">Name on the board</label>
              <input
                ref={first}
                id="acct-name"
                name="name"
                autoComplete="name"
                required
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div className="acct-field">
            <label htmlFor="acct-email">Email</label>
            <input
              ref={mode === 'signup' ? undefined : first}
              id="acct-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          {mode === 'recover' && (
            <div className="acct-field">
              <label htmlFor="acct-code">Recovery code</label>
              <input
                id="acct-code"
                name="recoveryCode"
                required
                maxLength={128}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          )}
          <PasswordField
            label={mode === 'recover' ? 'New password' : 'Password'}
            fresh={mode !== 'login'}
          />
        </fieldset>
        {error && (
          <p role="alert" className="acct-error">
            {error}
          </p>
        )}
        <button className="acct-primary acct-submit" disabled={busy}>
          {busy
            ? 'One moment…'
            : mode === 'signup'
              ? 'Join'
              : mode === 'recover'
                ? 'Reset password'
                : 'Log in'}
        </button>
      </form>
      <div className="acct-switch">
        {mode === 'signup' ? (
          <button type="button" onClick={() => switchTo('login')} disabled={busy}>
            I have an account
          </button>
        ) : (
          <>
            <button type="button" onClick={() => switchTo('signup')} disabled={busy}>
              New here? Join
            </button>
            {mode === 'login' && (
              <button type="button" onClick={() => switchTo('recover')} disabled={busy}>
                Forgot password
              </button>
            )}
          </>
        )}
      </div>
      {footer}
    </div>
  );
}
