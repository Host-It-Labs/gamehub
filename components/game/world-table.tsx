'use client';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Menu,
  RotateCcw,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import {
  actingSeats,
  botMove,
  decisionKey,
  observe,
  outcome,
  play,
  progress,
  worldGames,
  type WorldGame,
  type WorldMove,
} from '@/lib/games/worlds/registry';
import { worldLessons, worldTagline } from '@/lib/games/worlds/lessons';
import { worldCue } from '@/lib/games/worlds/sound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import { RuleExplanation } from './extension-rules';
import { FullscreenControl } from './fullscreen-control';
import { OrinBoard } from './orin-board';
import { VelaBoard } from './vela-board';
import { MiroBoard } from './miro-board';
import './world-table.css';
import './orin-world.css';
import './vela-world.css';
import './miro-world.css';

export type BoardProps = {
  g: WorldGame;
  viewer: number;
  disabled: boolean;
  commit: (m: WorldMove) => void;
};

type Props = {
  g: WorldGame;
  onChange: (g: WorldGame) => void;
  onHome: () => void;
  onNew?: () => void;
  onSound?: () => void;
  volume: number;
  viewerSeat?: number;
  disabled?: boolean;
};

export function WorldTable({
  g,
  onChange,
  onHome,
  onNew,
  onSound,
  volume,
  viewerSeat = 0,
  disabled = false,
}: Props) {
  const [panel, setPanel] = useState<'menu' | 'rules' | 'others' | null>(null);
  const entry = worldGames[g.kind];
  const view = observe(g, viewerSeat);
  const step = decisionKey(g);
  const previous = useRef(step);
  const finished = g.over;
  const youWon = finished && outcome(g).winners.includes(viewerSeat);
  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    worldCue(g.kind, finished ? (youWon ? 'win' : 'lose') : 'move', volume);
  }, [step, g.kind, finished, youWon, volume]);

  function commit(m: WorldMove) {
    if (disabled) return;
    const next = play(g, m, viewerSeat);
    if (next !== g) onChange(next);
  }

  // The bot clock. One bot acts per tick so the table reads as a table and not
  // as a sudden jump from your move to your next one.
  useEffect(() => {
    if (g.over || panel) return;
    const seat = actingSeats(g).find((s) => s !== viewerSeat);
    if (seat === undefined) return;
    const timer = setTimeout(() => {
      const m = botMove(g, seat);
      if (m) onChange(play(g, m, seat));
    }, 750);
    return () => clearTimeout(timer);
  }, [g, panel, viewerSeat, onChange]);

  const result = g.over ? outcome(g) : null;
  const waiting = actingSeats(view);
  const note = progress(g);
  const won = result?.winners.includes(viewerSeat);

  return (
    <div className={`world-table world-${g.kind}`}>
      <div className="world-scenery" aria-hidden="true" />
      <nav className="world-nav" aria-label="Game navigation">
        <button onClick={() => setPanel('menu')}>
          <Menu size={17} />
          <span>Menu</span>
        </button>
        <button onClick={() => setPanel('others')}>
          <Users size={17} />
          <span>Others</span>
        </button>
      </nav>
      <header className="world-players">
        {g.seats.map((name, s) => (
          <div
            key={s}
            className={`world-player ${s === viewerSeat ? 'is-you' : ''} ${waiting.includes(s) ? 'is-active' : ''}`}
            data-team={g.kind === 'meadow' ? g.teams[s] : undefined}
          >
            <span className="world-tag" aria-hidden="true">
              {name.slice(0, 1)}
            </span>
            <span className="world-who">
              <b>
                {name}
                {s === viewerSeat ? ' · you' : ''}
              </b>
              <small>{waiting.includes(s) ? 'Choosing' : 'Waiting'}</small>
            </span>
          </div>
        ))}
      </header>
      <main className="world-main">
        <div className="world-title">
          <p>
            {note.label} <span aria-hidden="true">•</span>{' '}
            {worldTagline[g.kind]}
          </p>
          <h1>{entry.name}</h1>
        </div>
        {result ? (
          <section className="world-finale">
            <Sparkles size={44} aria-hidden="true" />
            <h2>{result.title}</h2>
            <p>{result.detail}</p>
            <p className="world-verdict">
              {won ? 'You were on the winning side.' : 'Not this time.'}
            </p>
            <div className="world-scores">
              {result.rows?.map((r) => (
                <div key={r.name}>
                  <b>{r.name}</b>
                  <strong>{r.value}</strong>
                </div>
              ))}
            </div>
            <div className="world-finale-actions">
              <button className="world-primary" onClick={onNew ?? onHome}>
                Play again
              </button>
              <button onClick={onHome}>Back to library</button>
            </div>
          </section>
        ) : view.kind === 'coast' ? (
          <OrinBoard
            key={step}
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
          />
        ) : view.kind === 'meadow' ? (
          <VelaBoard
            key={step}
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
          />
        ) : (
          <MiroBoard
            key={step}
            g={view}
            viewer={viewerSeat}
            disabled={disabled}
            commit={commit}
          />
        )}
      </main>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <DialogContent className="world-dialog">
          <DialogTitle>
            {panel === 'menu'
              ? entry.name
              : panel === 'rules'
                ? 'How to play'
                : 'Around the table'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'others'
              ? 'Public standing and activity. Private choices stay private.'
              : note.detail}
          </DialogDescription>
          {panel === 'menu' && (
            <div className="world-menu">
              <button onClick={() => setPanel('rules')}>
                <BookOpen size={18} />
                Rules
              </button>
              <button
                onClick={() => {
                  setPanel(null);
                  onSound?.();
                }}
              >
                <Volume2 size={18} />
                Sound
              </button>
              <FullscreenControl />
              {onNew && (
                <button onClick={onNew}>
                  <RotateCcw size={18} />
                  New game
                </button>
              )}
              <button onClick={onHome}>Library</button>
            </div>
          )}
          {panel === 'rules' && (
            <RuleExplanation
              outcome={worldLessons[g.kind][0].title}
              note={
                g.kind === 'coast'
                  ? 'You may not say what you are holding. One bell each, all night.'
                  : g.kind === 'meadow'
                    ? 'Teammates cannot see each other’s cards until everything turns over.'
                    : 'Your own role is yours alone, and a hold stays shut until the run opens.'
              }
            >
              {worldLessons[g.kind].map((l) => (
                <p key={l.title}>
                  <b>{l.title}. </b>
                  {l.text}
                </p>
              ))}
            </RuleExplanation>
          )}
          {panel === 'others' && (
            <>
              <div className="world-score-list">
                {g.seats.map((name, s) => (
                  <p key={s}>
                    <b>{name}</b>
                    {s === viewerSeat ? ' · you' : ''} ·{' '}
                    {waiting.includes(s) ? 'Choosing' : 'Waiting'}
                  </p>
                ))}
              </div>
              <ol className="world-log">
                {g.log
                  .slice(-14)
                  .map((l) => <li key={l.id}>{l.text}</li>)
                  .reverse()}
              </ol>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
