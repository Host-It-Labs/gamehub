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
/** Most open suggestions one teammate may have at once. */
export const SUGGESTION_LIMIT = 3;
/** Once this many rounds of an act are played, its boss may be rerolled once. */
export const REROLL_AFTER = 2;
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
    description: 'Find the five-letter word in 6 guesses',
    rules:
      'Find the hidden five-letter word in 6 guesses. Each guess must be a real word. Green is the right letter in the right spot, yellow is in the word but in another spot, grey is not in the word.',
    boss: {
      name: 'Hard mode',
      rules:
        'Hints must be reused: green letters stay in place, and yellow letters must be in every later guess.',
    },
  },
  groups: {
    name: 'Connections',
    source: 'Connections',
    mark: '4×4',
    description: 'Sort 16 words into 4 groups',
    rules:
      'Sort 16 words into 4 groups of four that share something. Select four and submit. A wrong group is a mistake, and 4 mistakes lose the puzzle. Groups run from yellow, the easiest, to purple, the trickiest.',
    boss: {
      name: 'Purple week',
      rules: 'Trickier groups full of red herrings, and only 3 mistakes.',
    },
  },
  four: {
    name: 'Quad words',
    source: 'Quordle',
    mark: '⊞',
    description: 'Solve 4 words at once in 9 guesses',
    rules:
      'Find 4 hidden words in 9 guesses. Every guess plays on each board not yet solved. Colours work as in Wordle, and the keyboard shows each board in its own quarter.',
    boss: {
      name: 'Sequence',
      rules:
        'Boards open one at a time: a board shows your guesses only once the one before it is solved. 10 guesses.',
    },
  },
  waffle: {
    name: 'Waffle',
    source: 'Waffle',
    mark: '▦',
    description: 'Swap letters until 6 words appear',
    rules:
      'Swap two letters at a time to rebuild 6 words, 3 across and 3 down. Green is right and stays put. Yellow belongs in that row or column but in another spot, and on a crossing square it can mean either word. Grey is not in that row or column. You have 15 swaps, and 10 are enough.',
    boss: {
      name: 'Deluxe',
      rules:
        'A bigger 7×7 waffle of 8 seven-letter words, with 25 swaps. 20 are enough.',
    },
  },
  country: {
    name: 'Country outline',
    source: 'Worldle',
    mark: '◒',
    description: 'Name the country from its shape in 6 guesses',
    rules:
      'Name the country from its outline in 6 guesses. Type to search any country. Each wrong guess shows its distance and direction to the answer, and how close it is in percent.',
    boss: {
      name: 'Far corners',
      rules: 'Rarely seen countries, with the outline turned at an angle.',
    },
  },
  equation: {
    name: 'Hidden equation',
    source: 'Mathler',
    mark: '+=',
    description: 'Find the equation that equals the number',
    rules:
      'Find the hidden 6-character calculation in 6 guesses. Every guess must be a calculation that equals the target, with × and ÷ before + and −. Tiles turn green, yellow or grey as in Wordle. Swapped terms count: 2+3×4 also solves 3×4+2.',
    boss: {
      name: 'Hard Mathler',
      rules: 'An 8-character calculation instead of 6.',
    },
  },
  sudoku: {
    name: 'Sudoku',
    source: 'Sudoku',
    mark: '9',
    description: 'Fill the grid before your 3rd mistake',
    rules:
      'Fill every row, column and 3×3 box with the digits 1 to 9. Select a square, then a number. A wrong number is a mistake, and 3 mistakes lose the puzzle. Your notes are private and free.',
    boss: {
      name: 'Expert',
      rules:
        'Far fewer starting numbers. You will need advanced techniques and careful notes.',
    },
  },
  mines: {
    name: 'Minesweeper',
    source: 'Minesweeper',
    mark: '✹',
    description: 'Clear the field without touching a mine',
    rules:
      'Open every square that is not a mine. A number shows how many of its 8 neighbours hide a mine. Flag the squares you are sure of. Your first square is always safe, and no board needs a guess. Open a mine and the puzzle is lost.',
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
      'The numbers by each row and column give its runs of filled squares, in order, with a gap between runs. Fill squares and mark blanks with ×, or drag along a line. Filling a blank or crossing a filled square is a mistake, and 3 mistakes lose the puzzle.',
    boss: {
      name: 'Big picture',
      rules: 'A 15×15 picture instead of 10×10.',
    },
  },
  code: {
    name: 'Codebreaker',
    source: 'Mastermind',
    mark: '●●',
    description: 'Crack the colour code in 10 rows',
    rules:
      'Crack a hidden code of 4 colours out of 6 in 10 rows. From medium on the code may repeat a colour, and at very hard it always does. A black peg is a right colour in the right place, a white peg a right colour in the wrong place. Pegs are not in order.',
    boss: {
      name: 'Super code',
      rules: '5 places, 8 colours and 12 rows, as in Super Mastermind.',
    },
  },
};
export const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Very hard'] as const;
/** What each starting difficulty means, shown under the slider. */
export const DIFFICULTY_NOTES = [
  '',
  'Easy, medium, hard, then very hard until you lose.',
  'Medium, hard, then very hard until you lose.',
  'Hard, then very hard until you lose.',
] as const;
