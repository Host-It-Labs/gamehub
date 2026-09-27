'use client';
import type { CSSProperties, ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { Puzzle, Suggestion } from '@/lib/games/folio/types';
import type { Voter } from './folio-map';
import { PEGS } from './folio-kinds/code';

/** A square named like a spreadsheet cell: column letter, row number. */
const square = (i: number, size: number) =>
  `${String.fromCharCode(65 + (i % size))}${Math.floor(i / size) + 1}`;

/** What a suggested move does, in the original game's own terms. */
function describe(p: Puzzle, move: Record<string, unknown>): ReactNode {
  const view = p.view as Record<string, unknown>;
  switch (p.kind) {
    case 'word':
    case 'four':
    case 'equation':
    case 'country':
      return typeof move.guess === 'string' ? move.guess : '';
    case 'groups':
      return (move.words as string[]).join(' · ');
    case 'code':
      return (
        <span className="folio-suggestion-pegs">
          {(move.guess as number[]).map((c, i) => (
            <i
              key={i}
              style={{ '--peg': PEGS[c]?.fill } as CSSProperties}
              aria-label={PEGS[c]?.name}
            />
          ))}
        </span>
      );
    case 'waffle': {
      const letters = view.letters as string[];
      return `${letters[move.a as number]} ⇄ ${letters[move.b as number]}`;
    }
    case 'sudoku':
      return move.erase
        ? `Erase ${square(move.cell as number, 9)}`
        : `${move.digit as number} in ${square(move.cell as number, 9)}`;
    case 'mines': {
      const size = view.size as number;
      const [how, at] = Object.entries(move)[0] as [string, number];
      return `${how === 'flag' ? 'Flag' : how === 'chord' ? 'Clear around' : 'Dig'} ${square(at, size)}`;
    }
    case 'nonogram': {
      const size = view.size as number;
      const cells = move.cells as number[];
      const span =
        cells.length > 1
          ? `${square(cells[0], size)}–${square(cells.at(-1)!, size)}`
          : square(cells[0], size);
      return `${move.mark === 'cross' ? 'Cross' : 'Fill'} ${span}`;
    }
  }
}

/**
 * The others' moves for the puzzle in play, seen by the whole crew. The host
 * plays one with the tick or turns it down with the cross; anyone else can
 * take their own name off. The same move from two players is one row.
 */
export function FolioSuggestions({
  p,
  suggestions,
  voterOf,
  viewerId,
  lead,
  busy,
  onAccept,
  onDismiss,
}: {
  p: Puzzle;
  suggestions: Suggestion[];
  voterOf: (id: string) => Voter | null;
  viewerId: string;
  lead: boolean;
  busy: boolean;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <ol className="folio-suggestions" aria-label="Suggestions">
      {suggestions.map((s) => {
        const voters = s.by.flatMap((id) => voterOf(id) ?? []);
        const label = describe(p, s.move);
        const text =
          typeof label === 'string'
            ? label
            : (s.move.guess as number[]).map((c) => PEGS[c]?.name).join(', ');
        const names = voters.map((v) => v.name).join(' and ');
        return (
          <li key={s.id} data-mine={s.by.includes(viewerId) || undefined}>
            <span className="folio-suggestion-by" aria-label={names}>
              {voters.map((v) => (
                <i key={v.id} style={{ '--voter': v.colour } as CSSProperties}>
                  {v.initial}
                </i>
              ))}
            </span>
            <b className="folio-suggestion-move">{label}</b>
            {lead ? (
              <>
                <button
                  type="button"
                  className="folio-suggestion-accept"
                  disabled={busy}
                  onClick={() => onAccept(s.id)}
                  aria-label={`Play ${text}, suggested by ${names}`}
                >
                  <Check size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="folio-suggestion-dismiss"
                  disabled={busy}
                  onClick={() => onDismiss(s.id)}
                  aria-label={`Turn down ${text}`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </>
            ) : (
              s.by.includes(viewerId) && (
                <button
                  type="button"
                  className="folio-suggestion-dismiss"
                  onClick={() => onDismiss(s.id)}
                  aria-label={`Take back ${text}`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}
