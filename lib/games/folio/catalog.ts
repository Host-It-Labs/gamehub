import type { Kind } from './types.ts';

/**
 * The trail never ends: acts of three puzzle rounds and a boss keep coming
 * until the crew runs out of lives. The map always holds the act in play and
 * the one after it.
 */
export const BOSS_EVERY = 4;
export const LANES = 3;
/** Two shared lives: the crew may lose once. Nothing restores a life. */
export const START_LIVES = 2;
export const PUZZLES: Record<
  Kind,
  {
    name: string;
    source: string;
    mark: string;
    description: string;
    rules: string;
    boss: { name: string; rules: string };
  }
> = {
  word: {
    name: 'Word guess',
    source: 'Wordle',
    mark: 'W',
    description: 'Find the five-letter word in six guesses',
    rules:
      'Guess the word in 6 tries. Each guess must be a valid five-letter word. The tiles change colour: green is the right letter in the right spot, yellow is in the word but elsewhere, grey is not in the word.',
    boss: {
      name: 'Hard mode',
      rules:
        'Any revealed hints must be used in later guesses: green letters stay in place and yellow letters must appear.',
    },
  },
  groups: {
    name: 'Connections',
    source: 'Connections',
    mark: '4×4',
    description: 'Sort sixteen words into four groups',
    rules:
      'Find groups of four items that share something in common. Select four items and tap Submit. Each puzzle has exactly one solution. Categories are coloured yellow (easiest), green, blue and purple (trickiest). Four mistakes and the puzzle is over.',
    boss: {
      name: 'Purple week',
      rules:
        'Trickier categories full of red herrings, and only three mistakes.',
    },
  },
  four: {
    name: 'Quad words',
    source: 'Quordle',
    mark: '⊞',
    description: 'Solve four words at once in nine guesses',
    rules:
      'Guess all four words in 9 tries. Every guess is played on each unsolved board. Colours work as in Wordle; the keyboard shows each board in its own quarter.',
    boss: {
      name: 'Sequence',
      rules:
        'Boards unlock one at a time: the next board only shows your guesses once the one before it is solved. Ten guesses.',
    },
  },
  waffle: {
    name: 'Waffle',
    source: 'Waffle',
    mark: '▦',
    description: 'Swap letters until six words appear',
    rules:
      'Swap any two letters to rebuild six words: three across and three down. Green is correct. Yellow belongs in that row or column but in another spot (a yellow on a crossing square can belong to either word). Grey is not in that row or column. You have 15 swaps; it can be done in 10.',
    boss: {
      name: 'Deluxe',
      rules: 'A bigger waffle of seven-letter words with 25 swaps.',
    },
  },
  country: {
    name: 'Country outline',
    source: 'Worldle',
    mark: '◒',
    description: 'Name the country from its shape in six guesses',
    rules:
      'Guess the country in 6 tries. Type to search any country. Each wrong guess shows its distance from the answer, the direction toward it and how close you are.',
    boss: {
      name: 'Far corners',
      rules: 'Rarely seen countries, and the outline is turned at an angle.',
    },
  },
  equation: {
    name: 'Hidden equation',
    source: 'Mathler',
    mark: '+=',
    description: 'Find the equation that equals the number',
    rules:
      'Find the hidden calculation in 6 guesses. Each guess must be a valid calculation that equals the target. Normal order of operations applies: × and ÷ before + and −. Tiles turn green, yellow or grey as in Wordle. Commutative answers are accepted: 2+3×4 also counts for 3×4+2.',
    boss: {
      name: 'Hard Mathler',
      rules: 'An eight-character calculation instead of six.',
    },
  },
  sudoku: {
    name: 'Sudoku',
    source: 'Sudoku',
    mark: '9',
    description: 'Fill the grid; three mistakes and it is over',
    rules:
      'Fill every row, column and 3×3 box with the digits 1–9. Select a square, then a number. A wrong number counts as a mistake; the third mistake ends the puzzle. Notes are private to you and never cost anything.',
    boss: {
      name: 'Expert',
      rules:
        'Far fewer starting numbers. You will need pairs, pointing and careful notes.',
    },
  },
  mines: {
    name: 'Minesweeper',
    source: 'Minesweeper',
    mark: '✹',
    description: 'Clear the field without touching a mine',
    rules:
      'Open every square that is not a mine. A number tells how many of the eight neighbours hide mines. Flag squares you are sure about. Your first square is always safe, and every board can be solved without guessing. Open a mine and the puzzle is lost.',
    boss: {
      name: 'Intermediate',
      rules: 'The classic 16×16 field with 40 mines.',
    },
  },
  nonogram: {
    name: 'Nonogram',
    source: 'Picross',
    mark: '▚',
    description: 'Paint the hidden picture from the number clues',
    rules:
      'The numbers beside each row and above each column give the runs of filled squares in order, with at least one gap between runs. Fill squares and mark blanks with ×; drag to mark a whole line. Filling a square that should be blank, or crossing one that should be filled, is a mistake; three mistakes end the puzzle. Finished rows and columns cross off their blanks.',
    boss: {
      name: 'Big picture',
      rules: 'A 15×15 picture instead of 10×10.',
    },
  },
  code: {
    name: 'Codebreaker',
    source: 'Mastermind',
    mark: '●●',
    description: 'Crack the colour code in ten tries',
    rules:
      'Guess the hidden code of four colours from six; on harder levels the code may repeat a colour. After each guess, a black peg means a right colour in the right place and a white peg a right colour in the wrong place. Pegs are not in order. Ten rows to crack it.',
    boss: {
      name: 'Super code',
      rules:
        'Five positions, eight colours and twelve rows, as in Super Mastermind.',
    },
  },
};
export const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Very hard'] as const;
/** What each starting difficulty means, shown under the slider. */
export const DIFFICULTY_NOTES = [
  '',
  'Easy, then medium, hard, and very hard until you lose.',
  'Medium, then hard, and very hard until you lose.',
  'Hard, then very hard until you lose.',
] as const;
