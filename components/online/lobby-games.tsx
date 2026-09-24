'use client';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import { BookOpen, Check, ThumbsUp } from 'lucide-react';
import { onlineCatalog as catalog } from '@/lib/online/catalog';
import { isStandaloneId } from '@/lib/games/standalone/registry';
import { lessons } from '@/lib/games/trio/lessons';
import type { Table, TableCommand } from '@/lib/online/types';
import { GameBox } from '../game/game-box';
import { StatStrip } from '../game/library';
import { realGames, standaloneLibraryGames } from '@/lib/games/library-fixtures';
import { SetupBox, StandaloneSetupBox } from '../game/setup-box';
import { Dialog, DialogContent } from '../ui/dialog';
import { useState } from 'react';
import '../game/library.css';
import './table-lobby.css';

type Props = {
  table: Table;
  disabled: boolean;
  error?: string;
  dispatch: (action: TableCommand) => Promise<boolean>;
};
export function LobbyGames({ table, disabled, dispatch, error }: Props) {
  const [dismissed, setDismissed] = useState(false);
  // Reset local guest dismissal when the host closes or changes the shared box.
  const session = `${table.gameId}:${!!table.setupOpen}`;
  const [lastSession, setLastSession] = useState(session);
  if (session !== lastSession) {
    setLastSession(session);
    setDismissed(false);
  }
  const game = isStandaloneId(table.gameId)
    ? standaloneLibraryGames[table.gameId] : realGames[table.gameId];
  const configure = (changes: Partial<Extract<TableCommand, { type: 'configure' }>>) => {
    if (!table.isHost || disabled) return;
    void dispatch({ type: 'configure', gameId: table.gameId,
      capacity: table.capacity, difficulty: table.difficulty, ...changes });
  };
  const offline = table.members.filter(m => !m.bot && !m.host && !m.connected);
  const needsHumans = requiresHumanPlayers(table.gameId) && table.members.length !== table.capacity;
  const start = (learning = false) => {
    if (table.isHost && !disabled && !offline.length && !needsHumans) void dispatch({ type: 'start', learning });
  };
  return (
    <section className="lobby-library" aria-labelledby="lobby-games-title">
      <div className="lobby-library-heading">
        <div>
          <span className="lobby-eyebrow">Choose together</span>
          <h2 id="lobby-games-title">What shall we play?</h2>
          <p>{table.isHost ? 'Open a game box to set up the match for everyone.'
            : 'Suggest games you’d like to play. The host chooses and sets up the match.'}</p>
        </div>
        {table.setupOpen && dismissed && <button className="secondary" onClick={() => setDismissed(false)}>View setup</button>}
      </div>
      <div className="lobby-boxes">
        {catalog.map((entry) => {
          const box = isStandaloneId(entry.id) ? standaloneLibraryGames[entry.id] : realGames[entry.id];
          const voters = table.votes?.[entry.id] ?? [];
          const voted = voters.includes(table.viewerId);
          const selected = table.gameId === entry.id;
          return <article className="shelf-item lobby-box" key={entry.id}>
            <button type="button" className="gbox-button shelf-box" disabled={disabled}
              aria-label={`${table.isHost ? 'Choose' : 'Suggest'} ${box.name}`}
              onClick={() => table.isHost
                ? configure({ gameId: entry.id, openSetup: true })
                : void dispatch({ type: 'vote', gameId: entry.id })}>
              <GameBox game={box} width={126} sizes="(max-width: 700px) 45vw, 360px" />
              <span className="shelf-item-details"><StatStrip game={box} /></span>
            </button>
            <div className="lobby-box-actions">
              {table.isHost ? <span className="lobby-box-choice">{selected ? <><Check size={14} /> Up next</> : 'Click to choose'}</span> :
                <button className={voted ? 'primary' : 'secondary'} disabled={disabled} aria-pressed={voted}
                  aria-label={`${voted ? 'Remove suggestion for' : 'Suggest'} ${box.name}`}
                  onClick={() => void dispatch({ type: 'vote', gameId: entry.id })}>
                  <ThumbsUp size={15} /> {voted ? 'Suggested' : 'Suggest'}
                </button>}
              <span className="lobby-voters" aria-live="polite">{voters.length} suggestions{voters.length > 0 && ` · ${voters.map(id => table.members.find(m => m.id === id)?.name).filter(Boolean).join(', ')}`}</span>
            </div>
          </article>;
        })}
      </div>
      <Dialog open={!!table.setupOpen && !dismissed} onOpenChange={(open) => {
        if (open) return;
        if (table.isHost && !disabled) void dispatch({ type: 'setup', open: false });
        else setDismissed(true);
      }}>
        <DialogContent className="modal setup-modal">
          <output className="lobby-setup-status">{table.isHost ? 'Setting up for everyone' : 'The host is setting up your game · Settings update live'}</output>
          <div className="lobby-shared-setup">
            {offline.length > 0 && <section className="lobby-offline-warning" aria-live="polite">
              <strong>Players disconnected</strong>
              <p>Wait for them to reconnect or remove them before starting. {requiresHumanPlayers(table.gameId) ? 'Every seat needs a human player.' : 'Empty seats will be filled by bots.'}</p>
              <ul>{offline.map(member => <li key={member.id}><span>{member.name}</span>{table.isHost && <button type="button" className="secondary" disabled={disabled} onClick={() => void dispatch({ type: 'remove', memberId: member.id })}>Remove {member.name}</button>}</li>)}</ul>
            </section>}
            {error && <p className="online-notice" role="alert">{error}</p>}
            {isStandaloneId(table.gameId) ? <StandaloneSetupBox
              online
              disabled={disabled || !table.isHost} startDisabled={offline.length > 0 || needsHumans} game={game} seats={table.capacity} minPlayers={table.members.length}
              difficulty={table.difficulty}
              players={table.members.filter(m => !m.bot).map(m => ({ id: m.id, name: m.name, connected: m.connected, host: m.host, you: m.id === table.viewerId }))}
              onHost={table.isHost && !disabled ? memberId => void dispatch({ type: 'host', memberId }) : undefined}
              onSeats={capacity => configure({ capacity })} onDifficulty={difficulty => configure({ difficulty })}
              onPlay={() => start()} onLearn={() => start(true)} onResume={() => {}}
            /> : <SetupBox disabled={disabled || !table.isHost} startDisabled={offline.length > 0} game={game} players={table.capacity} minPlayers={table.members.length}
              difficulty={table.difficulty} fastMode={table.fastMode ?? false} options={{contentSet: table.contentSet, roamEnabled: table.roamEnabled,
                turningTide: table.turningTide, marketSeasons: table.marketSeasons,
                migration: table.migration, salvage: table.salvage, specialtyStalls: table.specialtyStalls}}
              shields={table.shields ?? false} customerOrders={table.customerOrders ?? false}
              sanctuaryGoalsEnabled={table.sanctuaryGoalsEnabled ?? false}
              onPlayers={capacity => configure({ capacity })} onDifficulty={difficulty => configure({ difficulty })}
              onFastMode={fastMode => configure({ fastMode })} onOptions={options => configure(options)}
              onExtensions={extensions => configure(extensions)} onPlay={() => start()} onLearn={() => start(true)} onResume={() => {}}
            />}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
export function SharedLesson({ table, disabled, dispatch }: Props) {
  if(isStandaloneId(table.gameId))return null;
  const step = table.game?.lesson ?? 0;
  const course = lessons[table.gameId];
  const lesson = course[step];
  if (!lesson) return null;
  return (
    <aside className="shared-lesson" aria-label="Shared learning session">
      <div className="lesson-symbol">
        <BookOpen size={24} />
      </div>
      <div className="lesson-copy" aria-live="polite">
        <span className="lobby-eyebrow">
          Practice together · Lesson {step + 1} of {course.length}
        </span>
        <h2>{lesson.title}</h2>
        <p>{lesson.text}</p>
        <small>
          Try moves on the table below.{' '}
          {table.isHost
            ? 'You decide when everyone moves on.'
            : 'Your host will move everyone to the next lesson.'}{' '}
          Practice scores are cleared when the real match starts.
        </small>
      </div>
      {table.isHost && (
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
              Next lesson
            </button>
          )}
          <button className="secondary" disabled={disabled} onClick={()=>void dispatch({type:'advance-practice'})}>Advance time</button>
          <button
            className={step === course.length - 1 ? 'primary' : 'secondary'}
            disabled={disabled}
            onClick={() => void dispatch({ type: 'begin-match' })}
          >
            Start real match
          </button>
        </div>
      )}
    </aside>
  );
}
