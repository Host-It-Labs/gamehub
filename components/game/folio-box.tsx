'use client';
import { useEffect, useState } from 'react';
import { Crown, Dumbbell, Play, User, Users } from 'lucide-react';
import { DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { LearnButton, Lid, RunPicker } from './setup-box';
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
    <div className="setup-box online-box folio-box">
      <Lid game={game} />
      <div className="tray">
        <div className="setup-intro">
          <DialogDescription className="tray-note">
            {game.world}
          </DialogDescription>
        </div>

        <label className="compartment online-name">
          <span className="online-legend">Your name</span>
          <input
            id="folio-box-name"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="How the crew will see you"
          />
        </label>

        {practice ? (
          <fieldset className="compartment folio-box-practice">
            <legend>Practise one puzzle</legend>
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
          </fieldset>
        ) : (
          <>
            <div className="tray-row online-box-row">
              <fieldset className="compartment">
                <legend>Players</legend>
                <RadioGroup
                  className="folio-box-seats"
                  value={String(seats)}
                  onValueChange={(v) => setSeats(Number(v))}
                >
                  {[1, 2, 3].map((n) => (
                    <label key={n} className="online-choice">
                      <RadioGroupItem value={String(n)} className="sr-only" />
                      <span className="folio-box-people" aria-hidden="true">
                        {Array.from({ length: n }, (_, i) => (
                          <User key={i} />
                        ))}
                      </span>
                      <b>{n === 1 ? 'Solo' : `${n} players`}</b>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
              <fieldset className="compartment">
                <legend>Difficulty</legend>
                <RadioGroup
                  className="folio-box-levels"
                  value={String(difficulty)}
                  onValueChange={(v) => setDifficulty(Number(v) as Difficulty)}
                >
                  {([1, 2, 3] as const).map((level) => (
                    <label
                      key={level}
                      className={`online-choice level-${level}`}
                    >
                      <RadioGroupItem
                        value={String(level)}
                        className="sr-only"
                      />
                      <span className="folio-box-grid" aria-hidden="true">
                        {Array.from({ length: 9 }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <b>{LEVEL_NAMES[level]}</b>
                    </label>
                  ))}
                </RadioGroup>
                <small className="online-note">
                  {DIFFICULTY_NOTES[difficulty]}
                </small>
              </fieldset>
            </div>
          </>
        )}

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
              <button
                type="button"
                className="play-plate"
                disabled={busy}
                onClick={() => void enter({ seats, difficulty })}
              >
                <Play aria-hidden="true" />
                New run
              </button>
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
      </div>
    </div>
  );
}
