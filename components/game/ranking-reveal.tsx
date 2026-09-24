'use client';
import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  tiers,
  guessSlot,
  guessName,
  guessPoints,
  guessOffsets,
  itemPoints,
  guessingTeams,
  groupName,
  perfectPoints,
  type RankingGame,
} from '@/lib/games/party/ranking';
import type { Topic } from '@/lib/games/party/catalog';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { CountUp, stagger } from './reveal-motion';

/** Reveal pacing: a rank lands every ROW ms, its guesses drop in DROP ms
 * apart, then the scores pop. Settles in under two seconds at six players. */
const ROW = 180,
  DROP = 45;

/** Each of the author's answers is a five-slot track, like a straight Dial:
 * the real rank glows teal, the ranks beside it are the near band, and every
 * guess drops in where that player ranked the answer. How close everyone was
 * reads at a glance; full lists stay one tap away. */
export function RankingReveal({
  g,
  viewer,
  topic,
}: {
  g: RankingGame;
  viewer: number;
  topic: Topic;
}) {
  const [open, setOpen] = useState(false);
  const result = g.result!,
    author = g.seats[g.target],
    slots = guessingTeams(g),
    mine = viewer === g.target ? -1 : guessSlot(g, viewer),
    // The viewer first, then everyone else in seat order.
    ordered = [...slots].sort(
      (a, b) => Number(b === mine) - Number(a === mine),
    ),
    name = (slot: number) => (slot === mine ? 'You' : guessName(g, slot)),
    order = (slot: number) => result.guesses[slot]!.order,
    // A shared team guess wears its team colour; everyone else their seat.
    avatar = (slot: number) =>
      g.mode === 'teams' && slot < 2
        ? `team-${slot}`
        : `seat-${g.mode === 'teams' ? slot - 2 : slot}`,
    scoresAt = result.order.length * ROW + 300;
  return (
    <div className="ranking-reveal">
      <ol className="rank-tracks">
        {result.order.map((answer, i) => {
          const placed = ordered.map((slot) => ({
            slot,
            at: order(slot).indexOf(answer),
          }));
          return (
            <li
              key={answer}
              className={`rank-track-row tier-${i} reveal-flip`}
              style={stagger(i, 0, ROW)}
            >
              <span className="tier-label">{tiers[i]}</span>
              <strong className="rank-track-answer">
                {topic.answers[answer]}
              </strong>
              <ol
                className="rank-track"
                aria-label={`${topic.answers[answer]}: ${placed
                  .map(({ slot, at }) => `${name(slot)} ${tiers[at]}`)
                  .join(', ')}`}
              >
                {tiers.map((tier, cell) => {
                  const d = Math.abs(cell - i);
                  return (
                    <li
                      key={tier}
                      className={`rank-cell ${d === 0 ? 'is-spot' : d === 1 ? 'is-near' : ''}`}
                      aria-hidden="true"
                    >
                      <span className="rank-cell-number">{cell + 1}</span>
                      <span className="rank-cell-guesses">
                        {placed.flatMap(({ slot, at }, j) =>
                          at === cell
                            ? [
                                <i
                                  key={slot}
                                  className={`party-avatar ${avatar(slot)} ${slot === mine ? 'is-mine' : ''} reveal-drop`}
                                  style={stagger(j, i * ROW + 160, DROP)}
                                  title={name(slot)}
                                >
                                  {name(slot).slice(0, 1)}
                                </i>,
                              ]
                            : [],
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
      <div className="rank-scores">
        {ordered.map((slot, j) => {
          const points = guessPoints(order(slot), result.order, g.kind),
            perfect = points === perfectPoints,
            at = scoresAt + j * 90;
          return (
            <span
              key={slot}
              className={`${avatar(slot)} ${slot === mine ? 'is-mine' : ''} ${perfect ? 'is-perfect reveal-burst' : ''} reveal-pop`}
              style={stagger(0, at)}
            >
              <i className={`party-avatar ${avatar(slot)}`} aria-hidden="true">
                {name(slot).slice(0, 1)}
              </i>
              <b>{name(slot)}</b>
              <strong>
                +<CountUp value={points} duration={450} delay={at} />
              </strong>
            </span>
          );
        })}
        <button
          type="button"
          className="comparison-open"
          aria-label="Every full guess"
          title="Every full guess"
          onClick={() => setOpen(true)}
        >
          <Users size={16} aria-hidden="true" />
        </button>
      </div>
      {g.mode === 'teams' && (
        <p className="guess-team-summary">
          {result.gains
            .map(
              (gain, team) =>
                `${groupName(g, team)} +${Number(gain.toFixed(2))}`,
            )
            .join(' · ')}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="party-dialog">
          <DialogTitle>Every guess for {author}’s list</DialogTitle>
          <DialogDescription>{topic.title}</DialogDescription>
          <div className="guess-comparison">
            <div className="is-author">
              <h4>
                {author} <b>real</b>
              </h4>
              <ol>
                {result.order.map((v, i) => (
                  <li key={i} className="correct">
                    <span>{tiers[i]}</span>
                    {topic.answers[v]}
                  </li>
                ))}
              </ol>
            </div>
            {ordered.map((slot) => {
              const offsets = guessOffsets(order(slot), result.order);
              return (
                <div key={slot}>
                  <h4>
                    {name(slot)}{' '}
                    <b>+{guessPoints(order(slot), result.order, g.kind)}</b>
                  </h4>
                  <ol>
                    {order(slot).map((v, i) => {
                      const earned = itemPoints(
                        offsets[result.order.indexOf(v)],
                      );
                      return (
                        <li
                          key={i}
                          className={
                            earned === perfectPoints / 5
                              ? 'correct'
                              : earned
                                ? 'near'
                                : 'incorrect'
                          }
                        >
                          <span>{tiers[i]}</span>
                          {topic.answers[v]} <b>+{earned}</b>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
