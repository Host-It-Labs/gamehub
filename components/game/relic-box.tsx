'use client';
import { useEffect, useState } from 'react';
import { Factory, Sparkles, Ticket } from 'lucide-react';
import { api, rememberedName, rememberName } from '@/lib/online/client';
import type {
  ExpeditionSummary,
  ExpeditionView,
} from '@/lib/games/relic/types';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import { PlayButton, RunPicker, SetupIntro, SetupShell } from './setup-box';
import { SetupRow } from './setup-row';
import './online-boxes.css';

type Session = {
  user: { name: string } | null;
  guest: { name: string } | null;
};
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : 'Could not reach the scratch desk. Please try again.';

/**
 * Relic's desk picker in the library's open-box modal. Opening a desk lands
 * on its own page, because a desk is shared through its link.
 */
export function RelicSetupBox({ game }: { game: LibraryGame }) {
  const [session, setSession] = useState<Session | null>(null),
    [desks, setDesks] = useState<ExpeditionSummary[]>([]),
    [name, setName] = useState(rememberedName),
    [title, setTitle] = useState('Our scratch desk'),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Session>('/api/session'),
      api<ExpeditionSummary[]>('/api/expeditions'),
    ])
      .then(([s, list]) => {
        if (!active) return;
        setSession(s);
        setDesks(list);
        setName(s.user?.name ?? s.guest?.name ?? rememberedName());
      })
      .catch((e) => active && setError(errorText(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  const known = !!(session?.user || session?.guest);
  async function open() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      rememberName(name.trim());
      const v = await api<ExpeditionView>('/api/expeditions', {
        name,
        title,
        world: 'dunes',
      });
      window.location.assign(`/expedition/${v.token}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <SetupShell game={game} className="online-box relic-box">
      <SetupIntro game={game} />
      <ul className="relic-box-facts" aria-label="What is in the box">
        <li>
          <Ticket aria-hidden="true" /> 8 ticket books
        </li>
        <li>
          <Factory aria-hidden="true" /> A factory you build
        </li>
        <li>
          <Sparkles aria-hidden="true" /> Up to 6 at one desk
        </li>
      </ul>
      <form
        className="relic-box-new"
        onSubmit={(e) => {
          e.preventDefault();
          void open();
        }}
      >
        <div className="setup-options">
          {!known && (
            <SetupRow label="Your name" className="setup-name">
              <input
                required
                aria-label="Your name"
                maxLength={30}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
              />
            </SetupRow>
          )}
          <SetupRow
            label="Desk"
            className="setup-name"
            note={
              !session?.user &&
              !loading && (
                <>
                  Saved in this browser. <a href="/auth">Sign in</a> to play
                  anywhere.
                </>
              )
            }
          >
            <input
              required
              aria-label="Desk name"
              maxLength={40}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </SetupRow>
        </div>
        {error && (
          <p role="alert" className="online-error">
            {error}
          </p>
        )}
        <div className="setup-actions">
          <PlayButton
            type="submit"
            disabled={loading || busy || (!known && !name.trim())}
          >
            {busy ? 'Opening…' : 'New desk'}
          </PlayButton>
          <RunPicker
            noun="desk"
            runs={desks.map((d) => ({
              key: d.token,
              href: `/expedition/${d.token}`,
              label: `Continue at ${d.name}: ${d.members.join(', ')}, ${d.tickets ?? 0} tickets finished`,
              icon: <Ticket />,
              title: d.name,
              detail: `${d.members.join(' · ')} · ${d.tickets ?? 0} tickets`,
            }))}
          />
        </div>
      </form>
    </SetupShell>
  );
}
