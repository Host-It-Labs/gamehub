import {
  play,
  standaloneGames,
  validMove,
  type AnyGame,
  type AnyMove,
} from '../../../lib/games/standalone/registry.ts';
import {
  campReady,
  remainingTriviaGames,
  triviaComplete,
  triviaOf,
  type TriviaRoute,
} from '../../../lib/games/party/trivia.ts';
import {
  pinCurve,
  places,
  type Pin,
} from '../../../lib/games/party/geography.ts';
import {
  curve as sizeCurve,
  guessRange,
  points as sizePoints,
  tidy,
} from '../../../lib/games/party/size.ts';
import { points as yearPoints } from '../../../lib/games/party/year.ts';
import { timeline, yearEvents } from '../../../lib/games/party/year-events.ts';
import type { SabiPart } from '../../../lib/games/party/tribu.ts';

type LabMode = 'tower' | 'expedition';
type LabScore = 0 | 150 | 300;
const names = ['Alex', 'Milo', 'Noor', 'Luna', 'Theo', 'Ines'];

/** Local fixtures for the development-only Debug screen. Scores and awards
 * always come from real answers, locks, reveals and host picks. */
export function createTriviaLabGame(
  mode: LabMode,
  seats: number,
  seed = 731,
): AnyGame {
  if (mode !== 'tower' && mode !== 'expedition')
    throw new Error('Choose Tower or Expedition for the Trivia lab.');
  const g = standaloneGames.miro.create(
    seats,
    seed,
    'medium',
    undefined,
    undefined,
    undefined,
    false,
    mode,
  );
  g.seats = names.slice(0, seats);
  return g;
}

function validate(g: AnyGame, scores: readonly LabScore[], route: TriviaRoute) {
  const t = triviaOf(g);
  if (
    !t ||
    t.rules !== 2 ||
    (t.mode !== 'tower' && t.mode !== 'expedition') ||
    !standaloneGames.miro.isSavedGame(g)
  )
    throw new Error(
      'The Trivia lab needs a complete current Tower or Expedition state.',
    );
  if (
    !Array.isArray(scores) ||
    scores.length !== g.seats.length ||
    !scores.every((score) => score === 0 || score === 150 || score === 300)
  )
    throw new Error('Choose 0, 150 or 300 points for each lab player.');
  if (route !== 'trail' && route !== 'river' && route !== 'summit')
    throw new Error('Choose Trail, River or Summit for the Trivia lab.');
}

function move(g: SabiPart, m: AnyMove, seat = 0): SabiPart {
  if (!validMove(g, m, seat))
    throw new Error(
      `Invalid Trivia lab move: ${g.kind}/${g.phase} ${m.type}, seat ${seat}.`,
    );
  return play(g, m, seat, 1000) as SabiPart;
}

function inverseCurve(
  curve: readonly (readonly [number, number])[],
  score: number,
) {
  for (let i = 1; i < curve.length; i++) {
    const [x0, p0] = curve[i - 1],
      [x1, p1] = curve[i];
    if (score <= p0 && score >= p1)
      return x0 + ((p0 - score) / (p0 - p1)) * (x1 - x0);
  }
  throw new Error(
    `The Trivia lab cannot produce ${score} points from this curve.`,
  );
}

/** An eastward great-circle destination also works near poles and the dateline. */
function pinFor(target: Pin, score: number): Pin {
  if (score === 100) return { lat: target.lat, lng: target.lng };
  const radians = Math.PI / 180,
    arc = inverseCurve(pinCurve, score) / 6371,
    lat = target.lat * radians,
    lng = target.lng * radians,
    nextLat = Math.asin(Math.sin(lat) * Math.cos(arc)),
    nextLng =
      lng +
      Math.atan2(
        Math.sin(arc) * Math.cos(lat),
        Math.cos(arc) - Math.sin(lat) * Math.sin(nextLat),
      );
  return {
    lat: nextLat / radians,
    lng: ((nextLng / radians + 540) % 360) - 180,
  };
}

function sizeFor(answer: number, score: number) {
  const factor = score === 100 ? 1 : inverseCurve(sizeCurve, score);
  for (const raw of [answer * factor, answer / factor]) {
    const value = tidy(raw);
    if (
      value >= guessRange[0] &&
      value <= guessRange[1] &&
      sizePoints(value, answer) === score
    )
      return value;
  }
  throw new Error(
    `The Trivia lab cannot size this answer for ${score} points.`,
  );
}

/** Integer year guesses cannot always earn 50 on every prompt. Find three
 * legal guesses whose actual rounded scores add to the chosen round total. */
function yearsFor(events: readonly number[], score: LabScore) {
  let totals = new Map<number, number[]>([[0, []]]);
  for (const id of events) {
    const year = yearEvents[id].year,
      guesses = new Map<number, number>();
    for (let value = timeline[0]; value <= timeline[1]; value++) {
      const points = yearPoints(value, year);
      if (!guesses.has(points)) guesses.set(points, value);
    }
    const next = new Map<number, number[]>();
    for (const [total, values] of totals)
      for (const [points, value] of guesses) {
        const sum = total + points;
        if (sum <= score && !next.has(sum)) next.set(sum, [...values, value]);
      }
    totals = next;
  }
  const values = totals.get(score);
  if (!values)
    throw new Error(
      `The Trivia lab cannot produce ${score} points for these years.`,
    );
  return values;
}

function answer(g: SabiPart, seat: number, score: LabScore): SabiPart {
  const points = score / 3;
  if (g.kind === 'miro') {
    const pins = g.cityIds.map((id) => pinFor(places[id], points));
    for (let prompt = 0; prompt < 3; prompt++)
      g = move(g, { type: 'pin', prompt, ...pins[prompt] }, seat);
    return move(g, { type: 'lock' }, seat);
  }
  if (g.kind === 'size')
    return move(
      g,
      {
        type: 'lock',
        values: g.questions.map((q) => sizeFor(q.answer, points)),
      },
      seat,
    );
  if (g.kind === 'year')
    return move(g, { type: 'lock', values: yearsFor(g.events, score) }, seat);
  if (g.kind === 'order') {
    const order =
      points === 100
        ? [0, 1, 2, 3, 4]
        : points === 50
          ? [1, 0, 2, 3, 4]
          : [4, 3, 2, 1, 0];
    for (let step = 0; step < 3; step++)
      g = move(g, { type: 'arrange', step, order }, seat);
    return move(g, { type: 'lock' }, seat);
  }
  throw new Error('The Trivia lab only simulates Trivia mini-games.');
}

/** Complete the current round, or start the first remaining game at camp.
 * Locked answers and fully committed routes keep their real results. A
 * final 4/4 camp advances with the host's Finish, without extra player locks. */
export function simulateTriviaLabRound(
  value: AnyGame,
  scores: readonly LabScore[],
  route: TriviaRoute,
): AnyGame {
  validate(value, scores, route);
  let g = structuredClone(value) as SabiPart;
  if (g.over) return g;
  if (triviaComplete(g)) return move(g, { type: 'vote', choice: 'finish' });
  if (g.phase === 'vote') {
    const t = triviaOf(g)!;
    if (t.mode === 'expedition' && !campReady(g)) {
      for (let seat = 0; seat < g.seats.length; seat++)
        if (triviaOf(g)!.ready[seat])
          g = move(g, { type: 'trivia-unlock' }, seat);
      for (let seat = 0; seat < g.seats.length; seat++)
        g = move(g, { type: 'trivia-plan', route, purchase: null }, seat);
    }
    g = move(g, { type: 'vote', choice: remainingTriviaGames(g)[0] });
  }
  if (g.phase === 'guess') {
    for (let seat = 0; seat < g.seats.length; seat++)
      if (!g.guesses[seat].locked) g = answer(g, seat, scores[seat]);
  }
  for (let step = 0; step < 3 && g.phase === 'reveal'; step++)
    g = move(g, { type: 'next' });
  if (g.phase !== 'vote')
    throw new Error('The Trivia lab could not complete the current round.');
  return g;
}

/** Finish the current match through its remaining rounds, preserving its
 * score ledger, deals, private commitments and the host's final action. */
export function finishTriviaLabGame(
  value: AnyGame,
  scores: readonly LabScore[],
  route: TriviaRoute,
): AnyGame {
  validate(value, scores, route);
  let g = structuredClone(value);
  for (let round = 0; round < 5 && !g.over; round++)
    g = simulateTriviaLabRound(g, scores, route);
  if (!g.over)
    throw new Error('The Trivia lab could not finish the four-round match.');
  return g;
}
