import { grade, requireThat, rng, shuffle, type KindModule } from '../kind.ts';
import { ANSWERS, answersFor, GUESSES } from '../words.ts';

/**
 * Quordle: four boards, one shared guess stream. `marks[r]` is guess r graded
 * against that board; a board stops taking rows once solved. In Sequence mode
 * a locked board holds no marks at all until the board before it is solved,
 * then every earlier guess is graded against it at once.
 */
export type FourBoard = {
  marks: number[][];
  /** Index of the guess that solved this board. */
  solved: number | null;
  locked: boolean;
  answer?: string;
};
export type FourView = {
  sequence: boolean;
  guesses: string[];
  boards: FourBoard[];
};
type FourSecret = { answers: string[] };

/** Grade guesses from `from` onward into a board until it is solved. */
function play(
  board: FourBoard,
  guesses: string[],
  answer: string,
  from: number,
) {
  for (let r = from; r < guesses.length && board.solved === null; r++) {
    board.marks.push(grade(guesses[r], answer));
    if (guesses[r] === answer) board.solved = r;
  }
}
function unlockReady(view: FourView, secret: FourSecret) {
  for (let i = 1; i < 4; i++) {
    const b = view.boards[i];
    if (b.locked && view.boards[i - 1].solved !== null) {
      b.locked = false;
      play(b, view.guesses, secret.answers[i], 0);
    }
  }
}

export const four: KindModule<FourView, FourSecret> = {
  make({ seed, boss, level }) {
    const answers = shuffle(answersFor(level), rng(seed)).slice(0, 4);
    return {
      view: {
        sequence: boss,
        guesses: [],
        boards: answers.map((_, i) => ({
          marks: [],
          solved: null,
          locked: boss && i > 0,
        })),
      },
      secret: { answers },
      allowance: boss ? 10 : 9,
      budget: 'guesses',
    };
  },
  move(view, secret, move) {
    requireThat(typeof move.guess === 'string', 'Not enough letters');
    const guess = (move.guess as string).toUpperCase();
    requireThat(/^[A-Z]{5}$/.test(guess), 'Not enough letters');
    requireThat(
      GUESSES.has(guess) || secret.answers.includes(guess),
      'Not in word list',
    );
    requireThat(
      view.boards.some((b) => b.solved === null),
      'All boards are solved',
    );
    view.guesses.push(guess);
    const r = view.guesses.length - 1;
    view.boards.forEach((b, i) => {
      if (!b.locked) play(b, view.guesses, secret.answers[i], r);
    });
    unlockReady(view, secret);
    return { cost: 1, solved: view.boards.every((b) => b.solved !== null) };
  },
  reveal(view, secret) {
    view.boards.forEach((b, i) => {
      b.answer = secret.answers[i];
      if (b.locked) {
        // Game over: show what the hidden boards would have looked like.
        b.locked = false;
        play(b, view.guesses, secret.answers[i], 0);
      }
    });
    return secret.answers.join(' · ');
  },
  win(view, secret) {
    const i = view.boards.findIndex((b) => b.solved === null && !b.locked);
    return { guess: secret.answers[i] };
  },
  lose(view, secret) {
    const guess = ANSWERS.find(
      (w) => !secret.answers.includes(w) && !view.guesses.includes(w),
    );
    return { guess };
  },
};
