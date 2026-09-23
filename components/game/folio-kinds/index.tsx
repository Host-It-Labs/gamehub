'use client';
import type { ComponentType } from 'react';
import type { Kind } from '@/lib/games/folio/types';
import type { KindProps } from './shared';
import Word from './word';
import Groups from './groups';
import Four from './four';
import Waffle from './waffle';
import Country from './country';
import Equation from './equation';
import Sudoku from './sudoku';
import Mines from './mines';
import Nonogram from './nonogram';
import Code from './code';

export const KIND_VIEWS: Record<Kind, ComponentType<KindProps<never>>> = {
  word: Word,
  groups: Groups,
  four: Four,
  waffle: Waffle,
  country: Country,
  equation: Equation,
  sudoku: Sudoku,
  mines: Mines,
  nonogram: Nonogram,
  code: Code,
};
