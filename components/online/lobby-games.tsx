'use client';
import { BookOpen, Check, ThumbsUp } from 'lucide-react';
import { catalog } from '@/lib/games/trio/engine';
import { lessons } from '@/lib/games/trio/lessons';
import type { Table, TableCommand } from '@/lib/online/types';
import { ArtworkImage } from '../game/artwork';
import './table-lobby.css';

type Props = {
  table: Table;
  disabled: boolean;
  dispatch: (action: TableCommand) => Promise<boolean>;
};
export function LobbyGames({ table, disabled, dispatch }: Props) {
  return (
    <section className="lobby-library" aria-labelledby="lobby-games-title">
      <div className="lobby-library-heading">
        <div>
          <span className="lobby-eyebrow">Choose together</span>
          <h2 id="lobby-games-title">What shall we play?</h2>
          <p>
            {table.isHost
              ? 'See what everyone likes, choose a game, then start your table.'
              : 'Vote for the games you’d like to play. Your host will start the match.'}
          </p>
        </div>
        <span className="lobby-pill">Vote for more than one</span>
      </div>
      <div className="lobby-games-grid">
        {catalog.map((game) => {
          const voters = table.votes?.[game.id] ?? [];
          const voted = voters.includes(table.viewerId);
          const selected = table.gameId === game.id;
          const names = voters
            .map((id) => table.members.find((m) => m.id === id)?.name)
            .filter(Boolean);
          return (
            <article
              className={`lobby-game ${game.id} ${selected ? 'is-selected' : ''}`}
              key={game.id}
            >
              <div className="lobby-game-cover">
                <ArtworkImage
                  src={game.cover}
                  width={960}
                  height={640}
                  alt={game.name}
                  draggable={false}
                />
                {selected && (
                  <span className="lobby-selection">
                    <Check size={14} />
                    Up next
                  </span>
                )}
              </div>
              <div className="lobby-game-details">
                <h3>{game.name}</h3>
                <span className="lobby-game-genre">{game.genre}</span>
                <div className="lobby-game-actions">
                  <button
                    className={voted ? 'primary' : 'secondary'}
                    aria-pressed={voted}
                    aria-label={`${voted ? 'Remove vote for' : 'Vote for'} ${game.name}`}
                    disabled={disabled}
                    onClick={() =>
                      void dispatch({ type: 'vote', gameId: game.id })
                    }
                  >
                    <ThumbsUp size={15} />
                    {voted ? 'Voted' : 'Suggest'} · {voters.length}
                  </button>
                  {table.isHost && (
                    <button
                      className="secondary"
                      disabled={disabled || selected}
                      onClick={() =>
                        void dispatch({
                          type: 'configure',
                          gameId: game.id,
                          capacity: table.capacity,
                          difficulty: table.difficulty,
                          starter:
                            game.id === table.gameId &&
                            (table.starter ?? false),
                        })
                      }
                    >
                      {selected ? 'Selected' : 'Choose game'}
                    </button>
                  )}
                </div>
                <p className="lobby-voters" aria-live="polite">
                  {names.length
                    ? names.join(', ')
                    : 'Be the first to suggest this game'}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function SharedLesson({ table, disabled, dispatch }: Props) {
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
