'use client';
/**
 * Development-only bench for Folio's games: runs a kind module in the browser
 * so each game can be played and screenshotted without a run or a server.
 * Open /folio/lab?kind=word&level=1&boss=0&seed=7 on the dev server.
 */
import { useState } from 'react';
import {
  KINDS,
  type Kind,
  type Level,
  type Puzzle,
} from '@/lib/games/folio/types';
import { KIND_MODULES } from '@/lib/games/folio/kinds/index';
import { PUZZLES } from '@/lib/games/folio/catalog';
import { KIND_VIEWS } from './folio-kinds/index';
import './folio.css';

function start(kind: Kind, level: Level, boss: boolean, seed: number) {
  const made = KIND_MODULES[kind].make({ level, boss, seed });
  const p: Puzzle = {
    kind,
    boss,
    level,
    remaining: made.allowance,
    allowance: made.allowance,
    budget: made.budget,
    status: 'playing',
    view: made.view,
  };
  return { p, secret: made.secret as unknown, answer: '' };
}
export default function FolioLab() {
  const q = new URLSearchParams(location.search);
  const [kind, setKind] = useState<Kind>((q.get('kind') as Kind) || 'word');
  const [level, setLevel] = useState<Level>(
    (Number(q.get('level')) || 1) as Level,
  );
  const [boss, setBoss] = useState(q.get('boss') === '1');
  const [seed, setSeed] = useState(Number(q.get('seed')) || 7);
  const [state, setState] = useState(() => start(kind, level, boss, seed));
  const [log, setLog] = useState<string[]>([]);
  const restart = (k = kind, l = level, b = boss, s = seed) => {
    setState(start(k, l, b, s));
    setLog([]);
  };
  async function move(m: Record<string, unknown>) {
    await new Promise((r) => setTimeout(r, 60));
    const next = structuredClone(state);
    try {
      const { cost, solved } = KIND_MODULES[kind].move(
        next.p.view,
        next.secret,
        m,
      );
      next.p.remaining = Math.max(0, next.p.remaining - cost);
      if (solved || next.p.remaining <= 0) {
        next.p.status = solved ? 'won' : 'lost';
        next.answer = KIND_MODULES[kind].reveal(
          next.p.view,
          next.secret,
          solved,
        );
      }
      setState(next);
      setLog((l) =>
        [
          `${JSON.stringify(m)} → cost ${cost}${solved ? ' · solved' : ''}`,
          ...l,
        ].slice(0, 6),
      );
      return null;
    } catch (e) {
      setLog((l) =>
        [
          `${JSON.stringify(m)} → rejected: ${(e as Error).message}`,
          ...l,
        ].slice(0, 6),
      );
      return (e as Error).message;
    }
  }
  const View = KIND_VIEWS[kind];
  const p = state.p;
  return (
    <main className="folio-world folio-lab">
      <div className="folio-lab-bar">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Kind);
            restart(e.target.value as Kind);
          }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {PUZZLES[k].name}
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => {
            const l = Number(e.target.value) as Level;
            setLevel(l);
            restart(kind, l);
          }}
        >
          {[1, 2, 3, 4].map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={boss}
            onChange={(e) => {
              setBoss(e.target.checked);
              restart(kind, level, e.target.checked);
            }}
          />{' '}
          Boss
        </label>
        <input
          type="number"
          value={seed}
          onChange={(e) => {
            setSeed(Number(e.target.value));
            restart(kind, level, boss, Number(e.target.value));
          }}
          style={{ width: 80 }}
        />
        <button
          onClick={() =>
            void move(KIND_MODULES[kind].win(state.p.view, state.secret))
          }
        >
          Win step
        </button>
        <button
          onClick={() =>
            void move(KIND_MODULES[kind].lose(state.p.view, state.secret))
          }
        >
          Lose step
        </button>
        <span>
          {p.remaining}/{p.allowance} {p.budget} · {p.status}
          {state.answer ? ` · ${state.answer}` : ''}
        </span>
      </div>
      <section className="folio-play-sheet">
        <header className="folio-play-head">
          <h1>
            {PUZZLES[kind].name}
            {boss ? ` · ${PUZZLES[kind].boss.name}` : ''}
          </h1>
        </header>
        <div className="folio-play-area">
          <View
            key={`${kind}${level}${boss}${seed}`}
            p={p}
            view={p.view as never}
            busy={false}
            done={p.status !== 'playing'}
            move={move}
          />
        </div>
      </section>
      <ol className="folio-lab-log">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </main>
  );
}
