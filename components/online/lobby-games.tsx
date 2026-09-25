'use client';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import { BookOpen, Play, ThumbsUp, Users } from 'lucide-react';
import { isStandaloneId } from '@/lib/games/standalone/registry';
import { lessons } from '@/lib/games/trio/lessons';
import { LEVEL_NAMES } from '@/lib/games/folio/catalog';
import type { ShelfGameId, Table, TableCommand } from '@/lib/online/types';
import type { GameId } from '@/lib/games/trio/engine';
import { GameBox } from '../game/game-box';
import {
  gameByLibraryId,
  librarySections,
  playerRange,
  realGames,
  standaloneLibraryGames,
  type LibraryGame,
} from '@/lib/games/library-fixtures';
import { SetupBox, StandaloneSetupBox } from '../game/setup-box';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { useState, type CSSProperties } from 'react';
import '../game/library.css';
import './table-lobby.css';

type Props = {
  table: Table;
  disabled: boolean;
  error?: string;
  dispatch: (action: TableCommand) => Promise<boolean>;
};
export type Launch = { kind: 'folio' | 'relic'; difficulty?: 1 | 2 | 3 };

/** Folio and Relic run in their own rooms; the rest are set up at the table. */
const ownRoom = (id: string): id is 'folio' | 'relic' =>
  id === 'folio' || id === 'relic';

/** The table's shelf: the library's sections and boxes. The host opens a box
 *  to set it up for everyone; guests tap boxes to suggest them. */
export function LobbyGames({
  table,
  disabled,
  dispatch,
  error,
  onLaunch,
}: Props & { onLaunch: (launch: Launch) => Promise<void> }) {
  const [dismissed, setDismissed] = useState(false);
  const [launching, setLaunching] = useState<LibraryGame | null>(null);
  // Reset local guest dismissal when the host closes or changes the shared box.
  const session = `${table.gameId}:${!!table.setupOpen}`;
  const [lastSession, setLastSession] = useState(session);
  if (session !== lastSession) {
    setLastSession(session);
    setDismissed(false);
  }
  const game = isStandaloneId(table.gameId)
    ? standaloneLibraryGames[table.gameId]
    : realGames[table.gameId as GameId];
  const configure = (
    changes: Partial<Extract<TableCommand, { type: 'configure' }>>,
  ) => {
    if (!table.isHost || disabled) return;
    void dispatch({
      type: 'configure',
      gameId: table.gameId,
      capacity: table.capacity,
      difficulty: table.difficulty,
      ...changes,
    });
  };
  const people = table.members.filter((m) => !m.bot);
  const offline = people.filter((m) => !m.owner && !m.connected);
  const needsHumans =
    requiresHumanPlayers(table.gameId) && people.length !== table.capacity;
  const start = (learning = false) => {
    if (table.isHost && !disabled && !offline.length && !needsHumans)
      void dispatch({ type: 'start', learning });
  };
  const anyLeader = people.some((m) => m.nextHost);
  const sections = librarySections.map((section) => ({
    ...section,
    entries: section.games
      .map((id) => gameByLibraryId(id))
      .filter((g): g is LibraryGame => !!g),
  }));
  function open(box: LibraryGame) {
    const id = (box.gameId ?? box.standaloneId ?? box.id) as ShelfGameId;
    if (!table.isHost) void dispatch({ type: 'vote', gameId: id });
    else if (ownRoom(id)) setLaunching(box);
    else configure({ gameId: id, openSetup: true });
  }
  return (
    <section className="lobby-library" aria-label="Games">
      <div className="lib-sections">
        {sections.map((section) => (
          <section
            className="lib-section"
            key={section.id}
            aria-labelledby={`lobby-${section.id}`}
            style={{ '--n': section.entries.length } as CSSProperties}
          >
            <h2 id={`lobby-${section.id}`} className="lib-section-title">
              {section.title}
            </h2>
            <ul className="lib-grid">
              {section.entries.map((box) => {
                const id = (box.gameId ??
                  box.standaloneId ??
                  box.id) as ShelfGameId;
                const voters = table.votes?.[id] ?? [];
                const voted = voters.includes(table.viewerId);
                const fits = people.length <= box.players[1];
                const names = voters
                  .map((v) => table.members.find((m) => m.id === v)?.name)
                  .filter(Boolean);
                return (
                  <li
                    className={`lib-tile lobby-tile ${fits ? '' : 'is-full'} ${voted ? 'is-voted' : ''}`}
                    key={box.id}
                  >
                    <button
                      type="button"
                      className="gbox-button lib-tile-button"
                      disabled={disabled || (table.isHost && !fits)}
                      aria-pressed={table.isHost ? undefined : voted}
                      aria-label={`${table.isHost ? 'Set up' : voted ? 'Unsuggest' : 'Suggest'} ${box.name}, ${playerRange(box.players)} players${names.length ? `. Suggested by ${names.join(', ')}` : ''}`}
                      onClick={() => open(box)}
                    >
                      <GameBox
                        game={box}
                        width={150}
                        sizes="(max-width: 700px) 34vw, 400px"
                      />
                      <span className="lib-tile-name">{box.name}</span>
                      <span className="lib-tile-meta">
                        <Users aria-hidden="true" />
                        {playerRange(box.players)}
                      </span>
                      {(voters.length > 0 || !table.isHost) && (
                        <span className="lobby-votes" aria-hidden="true">
                          <ThumbsUp />
                          {voters.length > 0 && <b>{voters.length}</b>}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {table.setupOpen && dismissed && (
        <button
          className="lib-friends lobby-reopen"
          onClick={() => setDismissed(false)}
        >
          <Play aria-hidden="true" />
          {game?.name}
        </button>
      )}
      <Dialog
        open={!!table.setupOpen && !dismissed}
        onOpenChange={(open) => {
          if (open) return;
          if (table.isHost && !disabled)
            void dispatch({ type: 'setup', open: false });
          else setDismissed(true);
        }}
      >
        <DialogContent className="modal setup-modal">
          <div className="lobby-shared-setup">
            {offline.length > 0 && (
              <section className="lobby-offline-warning" aria-live="polite">
                <strong>Offline</strong>
                <ul>
                  {offline.map((member) => (
                    <li key={member.id}>
                      <span>{member.name}</span>
                      {table.isHost && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={disabled}
                          onClick={() =>
                            void dispatch({
                              type: 'remove',
                              memberId: member.id,
                            })
                          }
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {error && (
              <p className="online-notice" role="alert">
                {error}
              </p>
            )}
            {isStandaloneId(table.gameId) ? (
              <StandaloneSetupBox
                online
                disabled={disabled || !table.isHost}
                startDisabled={offline.length > 0 || needsHumans}
                game={game}
                seats={table.capacity}
                minPlayers={people.length}
                difficulty={table.difficulty}
                players={people.map((m) => ({
                  id: m.id,
                  name: m.name,
                  connected: m.connected,
                  host: !!m.nextHost || (!anyLeader && !!m.owner),
                  you: m.id === table.viewerId,
                }))}
                onHost={
                  table.isHost && !disabled
                    ? (memberId) => void dispatch({ type: 'host', memberId })
                    : undefined
                }
                onSeats={(capacity) => configure({ capacity })}
                onDifficulty={(difficulty) => configure({ difficulty })}
                onPlay={() => start()}
                onLearn={() => start(true)}
                onResume={() => {}}
              />
            ) : (
              <SetupBox
                disabled={disabled || !table.isHost}
                startDisabled={offline.length > 0}
                game={game}
                players={table.capacity}
                minPlayers={people.length}
                difficulty={table.difficulty}
                fastMode={table.fastMode ?? false}
                options={{
                  contentSet: table.contentSet,
                  roamEnabled: table.roamEnabled,
                  turningTide: table.turningTide,
                  marketSeasons: table.marketSeasons,
                  migration: table.migration,
                  salvage: table.salvage,
                  specialtyStalls: table.specialtyStalls,
                }}
                shields={table.shields ?? false}
                customerOrders={table.customerOrders ?? false}
                sanctuaryGoalsEnabled={table.sanctuaryGoalsEnabled ?? false}
                onPlayers={(capacity) => configure({ capacity })}
                onDifficulty={(difficulty) => configure({ difficulty })}
                onFastMode={(fastMode) => configure({ fastMode })}
                onOptions={(options) => configure(options)}
                onExtensions={(extensions) => configure(extensions)}
                onPlay={() => start()}
                onLearn={() => start(true)}
                onResume={() => {}}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <LaunchDialog
        box={launching}
        table={table}
        disabled={disabled || offline.length > 0}
        error={error}
        onClose={() => setLaunching(null)}
        onLaunch={onLaunch}
      />
    </section>
  );
}

/** Folio and Relic open their own room with everyone at the table seated. */
function LaunchDialog({
  box,
  table,
  disabled,
  error,
  onClose,
  onLaunch,
}: {
  box: LibraryGame | null;
  table: Table;
  disabled: boolean;
  error?: string;
  onClose: () => void;
  onLaunch: (launch: Launch) => Promise<void>;
}) {
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const people = table.members.filter((m) => !m.bot);
  const folio = box?.id === 'folio';
  return (
    <Dialog open={!!box} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="modal launch-modal">
        {box && (
          <>
            <DialogTitle className="sr-only">{box.name}</DialogTitle>
            <GameBox game={box} width={170} sizes="200px" />
            <ul className="launch-players" aria-label="Players">
              {people.map((m) => (
                <li key={m.id} className={m.connected ? '' : 'away'}>
                  <span aria-hidden="true">
                    {m.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  {m.name}
                </li>
              ))}
            </ul>
            {folio && (
              <fieldset className="launch-levels">
                <legend className="sr-only">Difficulty</legend>
                {([1, 2, 3] as const).map((level) => (
                  <label key={level}>
                    <input
                      type="radio"
                      name="folio-level"
                      className="sr-only"
                      checked={difficulty === level}
                      onChange={() => setDifficulty(level)}
                    />
                    {LEVEL_NAMES[level]}
                  </label>
                ))}
              </fieldset>
            )}
            {error && (
              <p className="online-notice" role="alert">
                {error}
              </p>
            )}
            <button
              className="lib-friends launch-play"
              data-starts-game
              disabled={disabled || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onLaunch({
                    kind: folio ? 'folio' : 'relic',
                    ...(folio ? { difficulty } : {}),
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Play aria-hidden="true" />
              Play
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SharedLesson({ table, disabled, dispatch }: Props) {
  if (isStandaloneId(table.gameId)) return null;
  const step = table.game?.lesson ?? 0;
  const course = lessons[table.gameId as GameId];
  const lesson = course[step];
  if (!lesson) return null;
  const leads = table.members.find((m) => m.host)?.id === table.viewerId;
  return (
    <aside className="shared-lesson" aria-label="Shared learning session">
      <div className="lesson-symbol">
        <BookOpen size={24} />
      </div>
      <div className="lesson-copy" aria-live="polite">
        <span className="lobby-eyebrow">
          {step + 1} / {course.length}
        </span>
        <h2>{lesson.title}</h2>
        <p>{lesson.text}</p>
      </div>
      {leads && (
        <div className="lesson-actions">
          <button
            className="secondary"
            disabled={disabled || step === 0}
            onClick={() => void dispatch({ type: 'lesson', step: step - 1 })}
          >
            Previous
          </button>
          {step < course.length - 1 && (
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void dispatch({ type: 'lesson', step: step + 1 })}
            >
              Next
            </button>
          )}
          <button
            className="secondary"
            disabled={disabled}
            onClick={() => void dispatch({ type: 'advance-practice' })}
          >
            Advance time
          </button>
          <button
            className={step === course.length - 1 ? 'primary' : 'secondary'}
            disabled={disabled}
            onClick={() => void dispatch({ type: 'begin-match' })}
          >
            Start match
          </button>
        </div>
      )}
    </aside>
  );
}
