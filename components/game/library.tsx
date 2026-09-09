'use client';
import { Play, BookOpen, ArrowRight } from 'lucide-react';
import { catalog, type Game, type GameId } from '@/lib/games/trio/engine';
export function Library({
  saves,
  onSetup,
  onLearn,
  onResume,
}: {
  saves: Partial<Record<GameId, Game>>;
  onSetup: (id: GameId) => void;
  onLearn: (id: GameId) => void;
  onResume: (g: Game) => void;
}) {
  return (
    <main className="library-page">
      <div className="library-heading">
        <h1>Games</h1>
        <span>{catalog.length} games · 2–6 players</span>
      </div>
      <div className="library-grid">
        {catalog.map((c) => (
          <article className={`game-tile ${c.id}`} key={c.id}>
            <button
              className="cover"
              onClick={() => onSetup(c.id)}
              aria-label={`Play ${c.name}`}
            >
              <img src={c.cover} alt="" draggable={false} />
            </button>
            <div className="tile-details">
              <span className="genre">{c.genre}</span>
              <h2>{c.name}</h2>
              <span className="player-range">You + 1–5 bots</span>
              <div className="tile-actions">
                <button className="primary" onClick={() => onSetup(c.id)}>
                  <Play size={15} />
                  Play
                </button>
                <button className="secondary" onClick={() => onLearn(c.id)}>
                  <BookOpen size={15} />
                  Learn
                </button>
              </div>
              {saves[c.id] && saves[c.id]!.phase !== 'over' && (
                <button
                  className="resume"
                  onClick={() => onResume(saves[c.id]!)}
                >
                  Resume round {saves[c.id]!.round}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
