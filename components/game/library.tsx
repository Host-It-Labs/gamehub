'use client';
import { type CSSProperties } from 'react';
import { ArtworkImage } from './artwork';
import { Play, ArrowRight } from 'lucide-react';
import { catalog, type Game, type GameId } from '@/lib/games/trio/engine';
export function Library({
  saves,
  onSetup,
  onResume,
}: {
  saves: Partial<Record<GameId, Game>>;
  onSetup: (id: GameId) => void;
  onResume: (g: Game) => void;
}) {
  return (
    <main className="library-page box-library" aria-label="Games">
      <div className="library-grid box-shelf">
        {catalog.map((c) => (
          <article className={`game-tile game-box ${c.id}`} key={c.id}>
            <button
              className="cover box-object"
              onClick={() => onSetup(c.id)}
              aria-label={`Play ${c.name}`}
            >
              {c.id === 'wildgrove' &&
                Array.from({ length: 16 }, (_, layer) => (
                  <span
                    key={layer}
                    className="box-stone-layer"
                    aria-hidden="true"
                    style={{ '--stone-layer': layer + 1 } as CSSProperties}
                  />
                ))}
              <span className="box-back" aria-hidden="true" />
              <span className="box-top" aria-hidden="true" />
              <span className="box-spine" aria-hidden="true">
                {c.name}
              </span>
              <span className="box-front">
                <ArtworkImage
                  width={c.id === 'undertow' ? 1024 : 1122}
                  height={c.id === 'undertow' ? 1536 : 1402}
                  sizes={
                    c.id === 'undertow'
                      ? '(min-width: 1024px) 324px, (max-width: 480px) 212px, 240px'
                      : '(min-width: 1024px) 400px, (max-width: 480px) 264px, 296px'
                  }
                  src={`/art/box-${c.id}-v2.png`}
                  alt={c.name}
                  draggable={false}
                />
                <span className="cover-wordmark">{c.name}</span>
              </span>
            </button>
            <div className="tile-details">
              <span className="genre">{c.genre}</span>
              <div className="tile-actions">
                <button className="primary" onClick={() => onSetup(c.id)}>
                  <Play size={14} />
                  Play
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
      </div>
    </main>
  );
}
