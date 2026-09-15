'use client';
import { canAct, type PublicGame } from '@/lib/games/trio/engine';

export function MoraTrash({ g, viewer, selected, preparedZone, onPlace }: {
  g: PublicGame;
  viewer: number;
  selected: number | null;
  preparedZone: number | null;
  onPlace: (zone: number) => void;
}) {
  if (g.id !== 'wildgrove') return null;
  const allowed = g.phase === 'play' && canAct(g, viewer) && selected !== null;
  return (
    <button
      type="button"
      className={`mora-trash ${preparedZone === 5 ? 'prepared' : ''}`}
      data-drop="zone:5"
      data-drop-allowed={allowed ? 'true' : 'false'}
      aria-label="Trash selected creature for zero points. It leaves the board and uses this turn."
      aria-disabled={!allowed}
      title="Trash a creature · 0 points · always available"
      onClick={() => { if (allowed) onPlace(5); }}
    >
      <span>Discard · 0 pts</span>
    </button>
  );
}
