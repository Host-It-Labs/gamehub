'use client';
import type { ReactNode } from 'react';
import { Crown } from 'lucide-react';
import type { Outcome } from '@/lib/games/standalone/types';
import { CountUp, stagger } from './reveal-motion';
import './party-finale.css';

const STEP = 260;

/** The match results as a countdown: standings land from last place up,
 * each score counts up as its row arrives, and the winner lands last with a
 * burst. Around two seconds even at six players; instant under reduced
 * motion. */
export function PartyFinale({
  result,
  children,
}: {
  result: Outcome;
  /** The next-game vote, or Play again and Library. */
  children: ReactNode;
}) {
  const rows = result.rows ?? [];
  const winners = new Set(result.winners);
  // Rows arrive bottom first, so the last row starts at zero delay.
  const delay = (i: number) => (rows.length - 1 - i) * STEP;
  const crowned = rows.length * STEP;
  return (
    <section className="party-finale is-animated">
      <div
        className="finale-crown reveal-pop reveal-burst"
        style={stagger(0, crowned)}
      >
        <Crown size={40} aria-hidden="true" />
      </div>
      <h2 className="reveal-rise" style={stagger(0, crowned + 120)}>
        {result.title}
      </h2>
      <ol className="finale-standings">
        {rows.map((row, i) => {
          const top = row.seat !== undefined ? winners.has(row.seat) : i === 0;
          const suffix =
            row.points !== undefined
              ? row.value.replace(/^[\d.,]+/, '').trim()
              : '';
          return (
            <li
              key={`${row.name}-${i}`}
              className={`reveal-rise ${top ? 'is-winner' : ''}`}
              style={stagger(0, delay(i))}
            >
              <span className="finale-rank">{i + 1}</span>
              {row.seat !== undefined && (
                <i
                  className={`party-avatar seat-${row.seat}`}
                  aria-hidden="true"
                >
                  {row.name.slice(0, 1)}
                </i>
              )}
              <b>{row.name}</b>
              {row.points !== undefined ? (
                <strong>
                  <CountUp
                    value={row.points}
                    duration={650}
                    delay={delay(i)}
                    format={(v) =>
                      Number.isInteger(row.points)
                        ? Math.round(v).toLocaleString('en')
                        : v.toFixed(1)
                    }
                  />
                  {suffix && <small> {suffix}</small>}
                </strong>
              ) : (
                <strong>{row.value}</strong>
              )}
              {top && <span className="finale-glow" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <div
        className="finale-actions reveal-rise"
        style={stagger(0, crowned + 300)}
      >
        {children}
      </div>
    </section>
  );
}
