'use client';
import { useEffect, useState } from 'react';
import { Crown, Dumbbell, Grid3x3, User, Users } from 'lucide-react';
import { api, rememberedName, rememberName } from '@/lib/online/client';
import {
  KINDS,
  type Difficulty,
  type FolioSummary,
  type FolioView,
} from '@/lib/games/folio/types';
import {
  DIFFICULTY_NOTES,
  LEVEL_NAMES,
  PUZZLES,
  ROUNDS,
} from '@/lib/games/folio/catalog';
import type { LibraryGame } from '@/lib/games/library-fixtures';
import {
  LearnButton,
  PlayButton,
  RunPicker,
  SetupIntro,
  SetupShell,
} from './setup-box';
import { Segmented, SetupRow } from './setup-row';
import { KindIcon } from './folio-icons';
import './online-boxes.css';

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Could not reach Folio. Please try again.';

/** What tells one run from another: where it stands, then who and how hard. */
function runTitle(s: FolioSummary) {
  if (s.phase === 'lobby')
    return `Waiting for ${s.seats - s.members.length} more`;
  return `Round ${Math.max(1, s.round)} of ${ROUNDS}`;
}
function runDetail(s: FolioSummary) {
  const who = s.seats === 1 ? 'Solo' : s.members.join(', ');
  return s.phase === 'lobby'
    ? `${who} · ${LEVEL_NAMES[s.difficulty]}`
    : `${who} · ${LEVEL_NAMES[s.difficulty]} · ${s.lives} ♥`;
}

const shortDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

/**
 * Folio's setup in the library's open-box modal. Starting a run still lands
 * on the run's own page, because a run is a shared, linkable table.
 */
export function FolioSetupBox({ game }: { game: LibraryGame }) {
  const [name, setName] = useState(rememberedName),
    [seats, setSeats] = useState(1),
    [difficulty, setDifficulty] = useState<Difficulty>(1),
    [runs, setRuns] = useState<FolioSummary[]>([]),
    [practice, setPractice] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api<FolioSummary[]>('/api/folio')
      .then((rows) => !cancelled && setRuns(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const trimmed = name.trim();
  async function enter(body: Record<string, unknown>) {
    if (busy) return;
    if (!trimmed) {
      setError('Enter your name first.');
      document.getElementById('folio-box-name')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const v = await api<FolioView>('/api/folio', { ...body, name: trimmed });
      rememberName(trimmed);
      window.location.assign(`/folio/${v.token}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  const active = runs.filter((r) => r.phase !== 'over' && !r.practice);
  return (
    <SetupShell game={game} className="online-box folio-box">
      <SetupIntro game={game} />
      <div className="setup-options">
        <SetupRow label="Your name" className="setup-name">
          <input
            id="folio-box-name"
            aria-label="Your name"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="How the crew will see you"
          />
        </SetupRow>
        {practice ? (
          <SetupRow label="Practise" className="folio-box-practice">
            <ul>
              {KINDS.map((kind) => (
                <li key={kind}>
                  <span className="folio-box-kind" aria-hidden="true">
                    <KindIcon kind={kind} />
                  </span>
                  <span className="folio-box-kind-name">
                    <b>{PUZZLES[kind].name}</b>
                    <small>Inspired by {PUZZLES[kind].source}</small>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Play ${PUZZLES[kind].name}`}
                    onClick={() =>
                      void enter({ practice: { kind, boss: false } })
                    }
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title={PUZZLES[kind].boss.rules}
                    aria-label={`${PUZZLES[kind].name} boss: ${PUZZLES[kind].boss.name}`}
                    onClick={() =>
                      void enter({ practice: { kind, boss: true } })
                    }
                  >
                    <Crown aria-hidden="true" /> Boss
                  </button>
                </li>
              ))}
            </ul>
          </SetupRow>
        ) : (
          <>
            <SetupRow label="Players" Icon={Users}>
              <Segmented
                label="Players"
                className="seg-count"
                value={seats}
                onChange={setSeats}
                options={[1, 2, 3].map((n) => ({
                  value: n,
                  label: <b>{n === 1 ? 'Solo' : n}</b>,
                }))}
              />
            </SetupRow>
            <SetupRow
              label="Difficulty"
              Icon={Grid3x3}
              note={DIFFICULTY_NOTES[difficulty]}
            >
              <Segmented
                label="Difficulty"
                className="seg-levels"
                value={difficulty}
                onChange={setDifficulty}
                options={([1, 2, 3] as const).map((level) => ({
                  value: level,
                  label: (
                    <>
                      <span className="level-bars" aria-hidden="true">
                        {[1, 2, 3].map((bar) => (
                          <i key={bar} className={bar <= level ? 'on' : ''} />
                        ))}
                      </span>
                      <b>{LEVEL_NAMES[level]}</b>
                    </>
                  ),
                }))}
              />
            </SetupRow>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="online-error">
          {error}
        </p>
      )}
      <div className="setup-actions">
        <LearnButton
          label={practice ? 'Back' : 'Practise'}
          Icon={Dumbbell}
          expanded={practice}
          onClick={() => setPractice((v) => !v)}
        />
        {!practice && (
          <>
            <PlayButton
              disabled={busy}
              onClick={() => void enter({ seats, difficulty })}
            >
              New run
            </PlayButton>
            <RunPicker
              runs={active.map((s) => ({
                key: s.token,
                href: `/folio/${s.token}`,
                label: `Continue: ${runTitle(s)}, ${runDetail(s).replace('♥', 'lives')}, ${shortDate(s.updatedAt)}`,
                icon: s.seats === 1 ? <User /> : <Users />,
                title: runTitle(s),
                detail: `${runDetail(s)} · ${shortDate(s.updatedAt)}`,
              }))}
            />
          </>
        )}
      </div>
    </SetupShell>
  );
}
