'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import type { FourBoard, FourView } from '@/lib/games/folio/kinds/four';
import {
  Keyboard,
  Panel,
  TileRow,
  useFresh,
  useKeys,
  usePulse,
  useToast,
  type KindProps,
} from './shared';
import './four.css';

/** Best grade per letter on one board, or nothing once it is solved. */
function boardGrades(board: FourBoard, guesses: string[]) {
  const best: Record<string, number> = {};
  if (board.solved !== null || board.locked) return best;
  board.marks.forEach((marks, r) =>
    guesses[r].split('').forEach((c, i) => {
      best[c] = Math.max(best[c] ?? -1, marks[i]);
    }),
  );
  return best;
}

function Board({
  board,
  index,
  guesses,
  rows,
  typed,
  shake,
  done,
}: {
  board: FourBoard;
  index: number;
  guesses: string[];
  rows: number;
  typed: string;
  shake: boolean;
  done: boolean;
}) {
  const fresh = useFresh(board.marks.length);
  // Pop the board once when it becomes solved while on screen.
  const [pop, setPop] = useState(false);
  const wasSolved = useRef(board.solved !== null);
  useEffect(() => {
    const now = board.solved !== null;
    if (now && !wasSolved.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 2600);
      wasSolved.current = now;
      return () => clearTimeout(t);
    }
    wasSolved.current = now;
  }, [board.solved]);
  const solved = board.solved !== null;
  const lost = done && !solved && board.answer;
  const open = !solved && !board.locked && !done;
  const state = board.locked
    ? 'locked'
    : solved
      ? 'solved'
      : lost
        ? 'lost'
        : 'open';
  return (
    <div className="fk-four-cell">
      <div
        className={`fk-four-board ${pop ? 'pop' : ''}`}
        data-state={state}
        aria-label={`Board ${index + 1}${board.locked ? ', locked' : solved ? ', solved' : ''}`}
      >
        {Array.from({ length: rows }, (_, r) => {
          const marks = board.marks[r];
          if (marks)
            return (
              <TileRow
                key={r}
                small
                letters={guesses[r]}
                length={5}
                marks={marks}
                reveal={r >= fresh}
                win={board.solved === r && r >= fresh}
              />
            );
          const current = open && r === guesses.length;
          return (
            <TileRow
              key={r}
              small
              letters={current ? typed : ''}
              length={5}
              shake={current && shake}
            />
          );
        })}
        {board.locked && (
          <span className="fk-four-lock" aria-hidden="true">
            <Lock size={18} />
          </span>
        )}
      </div>
      <p className="fk-four-answer" aria-live="polite">
        {lost ? board.answer : ''}
      </p>
    </div>
  );
}

export default function Four({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<FourView>) {
  const [typed, setTyped] = useState('');
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse();
  const rows = Math.max(p.allowance, view.guesses.length);
  const grades = view.boards.map((b) => boardGrades(b, view.guesses));
  const won = view.boards.every((b) => b.solved !== null);
  async function key(k: string) {
    if (done || busy) return;
    if (k === 'BACK') setTyped((t) => t.slice(0, -1));
    else if (k === 'ENTER') {
      if (typed.length < 5) {
        say('Not enough letters');
        fireShake();
        return;
      }
      const error = await move({ guess: typed });
      if (error) {
        say(error);
        fireShake();
      } else setTyped('');
    } else if (/^[A-Z]$/.test(k)) setTyped((t) => (t.length < 5 ? t + k : t));
  }
  useKeys((k) => void key(k), !done);
  return (
    <Panel className={`fk-four ${won && done ? 'won' : ''}`}>
      {toast}
      <div
        className="fk-four-grid"
        style={{ '--rows': rows } as CSSProperties}
        data-sequence={view.sequence || undefined}
      >
        {view.boards.map((b, i) => (
          <Board
            key={i}
            board={b}
            index={i}
            guesses={view.guesses}
            rows={rows}
            typed={typed}
            shake={shake}
            done={done}
          />
        ))}
      </div>
      <Keyboard
        state={(k) => grades.map((g) => g[k] ?? -1)}
        onKey={(k) => void key(k)}
        disabled={done}
      />
    </Panel>
  );
}
