'use client';
import { ArtworkImage, ArtworkLoading } from './artwork';
import { Play, BookOpen, ArrowRight } from 'lucide-react';
import { catalog, type Game, type GameId } from '@/lib/games/trio/engine';
const soon = [
  { name: 'Orbit', genre: 'Connect the stars', symbol: '☄', color: '#343f69' },
  { name: 'Bloom', genre: 'Grow a garden', symbol: '✿', color: '#8a5970' },
  { name: 'Stack', genre: 'Balance & build', symbol: '▥', color: '#b37b3d' },
  { name: 'Rally', genre: 'Race to the finish', symbol: '⚑', color: '#496f67' },
  { name: 'Mosaic', genre: 'Make a pattern', symbol: '❖', color: '#7970a1' },
  { name: 'Cove', genre: 'Find the treasure', symbol: '◈', color: '#42768a' },
];
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
      <ArtworkLoading game="library" />
      <div className="library-heading">
        <h1>Games</h1>
        <span>3 to play · 6 on the way</span>
      </div>
      <div className="library-grid">
        {catalog.map((c) => (
          <article className={`game-tile ${c.id}`} key={c.id}>
            <button
              className="cover"
              onClick={() => onSetup(c.id)}
              aria-label={`Play ${c.name}`}
            >
              <ArtworkImage
                width={960}
                height={640}
                src={c.cover}
                alt={c.name}
                draggable={false}
              />
            </button>
            <div className="tile-details">
              <span className="genre">{c.genre}</span>
              <div className="tile-actions">
                <button className="primary" onClick={() => onSetup(c.id)}>
                  <Play size={14} />
                  Play
                </button>
                <button
                  className="secondary"
                  onClick={() => onLearn(c.id)}
                  aria-label={`Learn ${c.name}`}
                >
                  <BookOpen size={14} />
                  Learn
                </button>
                {saves[c.id] && saves[c.id]!.phase !== 'over' && (
                  <button
                    className="resume"
                    onClick={() => onResume(saves[c.id]!)}
                    aria-label={`Resume ${c.name}`}
                  >
                    <ArrowRight size={14} />
                    <span className="resume-label">Resume</span>
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {soon.map((c) => (
          <article
            className="game-tile coming-soon"
            aria-label={`${c.name}, coming soon`}
            key={c.name}
          >
            <div className="soon-cover" style={{ background: c.color }}>
              <span aria-hidden="true">{c.symbol}</span>
              <h2>{c.name}</h2>
              <small>Coming soon</small>
            </div>
            <div className="tile-details">
              <span className="genre">{c.genre}</span>
              <span className="soon-note">A new table is on its way</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
