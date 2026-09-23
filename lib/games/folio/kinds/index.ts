import type { KindModule } from '../kind.ts';
import type { Kind } from '../types.ts';
import { word } from './word.ts';
import { groups } from './groups.ts';
import { four } from './four.ts';
import { waffle } from './waffle.ts';
import { country } from './country.ts';
import { equation } from './equation.ts';
import { sudoku } from './sudoku.ts';
import { mines } from './mines.ts';
import { nonogram } from './nonogram.ts';
import { code } from './code.ts';

// Server only: modules hold dictionaries, generators and secrets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KIND_MODULES: Record<Kind, KindModule<any, any>> = {
  word,
  groups,
  four,
  waffle,
  country,
  equation,
  sudoku,
  mines,
  nonogram,
  code,
};
