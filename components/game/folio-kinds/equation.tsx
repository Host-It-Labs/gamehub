'use client';
import { useState } from 'react';
import { CornerDownLeft, Delete } from 'lucide-react';
import type { EquationView } from '@/lib/games/folio/kinds/equation';
import {
  keyGrades,
  Panel,
  TileRow,
  useFresh,
  useKeys,
  usePulse,
  useToast,
  type KindProps,
} from './shared';
import './equation.css';

/** Display glyphs for the ASCII operators the server speaks. */
const GLYPH: Record<string, string> = {
  '*': '×',
  '/': '÷',
  '-': '−',
  '+': '+',
};
const show = (text: string) => text.replace(/[*/\-+]/g, (c) => GLYPH[c]);
const NAME: Record<string, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
};
const DIGITS = '1234567890'.split('');
const OPS = ['+', '-', '*', '/'];

export default function Equation({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<EquationView>) {
  const [typed, setTyped] = useState('');
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse();
  const fresh = useFresh(view.guesses.length);
  const grades = keyGrades(view.guesses);
  const L = view.length;
  const won = !!view.guesses.at(-1)?.marks.every((m) => m === 2);
  const lost = done && !won;
  async function key(k: string) {
    if (done || busy) return;
    if (k === 'BACK') setTyped((t) => t.slice(0, -1));
    else if (k === 'ENTER') {
      if (typed.length < L) {
        say('Not enough characters');
        fireShake();
        return;
      }
      const error = await move({ guess: typed });
      if (error) {
        say(error);
        fireShake();
      } else setTyped('');
    } else if (/^[0-9+\-*/]$/.test(k))
      setTyped((t) => (t.length < L ? t + k : t));
  }
  useKeys((k) => void key(k), !done);
  const rowCount = Math.max(p.allowance, view.guesses.length);
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const g = view.guesses[i];
    if (g)
      return (
        <TileRow
          key={i}
          letters={show(g.word)}
          length={L}
          marks={g.marks}
          reveal={i >= fresh}
          win={won && i === view.guesses.length - 1 && i >= fresh}
        />
      );
    const current = i === view.guesses.length && !done;
    return (
      <TileRow
        key={i}
        letters={current ? show(typed) : ''}
        length={L}
        shake={current && shake}
      />
    );
  });
  const keyButton = (k: string, op = false) => (
    <button
      type="button"
      key={k}
      className={`fk-key ${op ? 'fk-equation-op' : ''}`}
      disabled={done}
      data-grade={grades(k)}
      onClick={() => void key(k)}
      aria-label={NAME[k] ?? k}
    >
      <span className="fk-key-label">{GLYPH[k] ?? k}</span>
    </button>
  );
  return (
    <Panel className="fk-equation">
      {toast}
      <p
        className={`fk-equation-prompt ${won && done ? 'won' : ''} ${lost ? 'lost' : ''}`}
      >
        <span className="fk-equation-lede">
          Find the hidden calculation that equals
        </span>
        <b className="fk-equation-target" key={done ? 'end' : 'play'}>
          {view.target}
        </b>
      </p>
      <div
        className="fk-equation-grid"
        aria-label="Guesses"
        style={
          { '--fk-eq-cols': L, '--fk-eq-rows': rowCount } as React.CSSProperties
        }
      >
        {rows}
      </div>
      {lost && view.answer && (
        <p className="fk-answer fk-equation-answer">
          The answer was <b>{show(view.answer)}</b>
        </p>
      )}
      <div className="fk-keyboard fk-equation-keys" aria-label="Keypad">
        <div className="fk-key-row">{DIGITS.map((d) => keyButton(d))}</div>
        <div className="fk-key-row">
          <button
            type="button"
            className="fk-key wide"
            disabled={done}
            onClick={() => void key('ENTER')}
          >
            <span>Enter</span>
            <CornerDownLeft size={15} aria-hidden="true" />
          </button>
          {OPS.map((o) => keyButton(o, true))}
          <button
            type="button"
            className="fk-key wide"
            disabled={done}
            onClick={() => void key('BACK')}
            aria-label="Delete"
          >
            <Delete size={18} />
          </button>
        </div>
      </div>
    </Panel>
  );
}
