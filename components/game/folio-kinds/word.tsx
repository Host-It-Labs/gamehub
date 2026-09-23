'use client';
import { useState } from 'react';
import type { WordView } from '@/lib/games/folio/kinds/word';
import {
  Keyboard,
  keyGrades,
  Panel,
  TileRow,
  useFresh,
  useKeys,
  usePulse,
  useToast,
  type KindProps,
} from './shared';

export default function Word({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<WordView>) {
  const [typed, setTyped] = useState('');
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse();
  const fresh = useFresh(view.guesses.length);
  const grades = keyGrades(view.guesses);
  const won = view.guesses.at(-1)?.marks.every((m) => m === 2);
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
  // The allowance, not the original six, so an extra-guess upgrade gets a row.
  const rows = Array.from({ length: p.allowance }, (_, i) => {
    const g = view.guesses[i];
    if (g)
      return (
        <TileRow
          key={i}
          letters={g.word}
          length={5}
          marks={g.marks}
          reveal={i >= fresh}
          win={won && i === view.guesses.length - 1 && i >= fresh}
        />
      );
    const current = i === view.guesses.length && !done;
    return (
      <TileRow
        key={i}
        letters={current ? typed : ''}
        length={5}
        shake={current && shake}
      />
    );
  });
  return (
    <Panel className="fk-word">
      {toast}
      {view.hard && <span className="fk-badge">Hard mode</span>}
      <div
        className="fk-word-grid"
        aria-label="Guesses"
        style={{ '--rows': p.allowance } as React.CSSProperties}
      >
        {rows}
      </div>
      {done && view.answer && !won && (
        <p className="fk-answer">
          The word was <b>{view.answer}</b>
        </p>
      )}
      <Keyboard state={grades} onKey={(k) => void key(k)} disabled={done} />
    </Panel>
  );
}
