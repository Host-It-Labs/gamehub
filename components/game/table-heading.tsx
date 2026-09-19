import {
  catalog,
  handSize,
  totalRounds,
  type PublicGame,
} from '@/lib/games/trio/engine';

export function TableProgress({ g, roundOnly = false }: { g: PublicGame; roundOnly?: boolean }) {
  const phase =
    g.phase === 'over'
      ? 'Finished'
      : g.phase === 'salvage'
        ? 'Secret Salvage claims'
        : g.phase === 'pass'
          ? 'Passing cards'
          : g.phase === 'roll'
            ? 'Rolling dice'
            : `Pick ${Math.min(g.pick, handSize(g))} / ${handSize(g)}`;
  if (roundOnly)
    return (
      <div className="table-progress table-round" aria-label={`Round ${g.round} of ${totalRounds(g)}`}>
        <span>Round</span>
        <b>{g.round}<small>/{totalRounds(g)}</small></b>
      </div>
    );
  return (
    <div className="table-progress">
      <span>
        Round{' '}
        <b>
          {g.round} / {totalRounds(g)}
        </b>
      </span>
      <small>{phase}</small>
    </div>
  );
}

export const gameName = (g: PublicGame) => catalog.find((game) => game.id === g.id)?.name;

export function TableHeading({ g }: { g: PublicGame }) {
  return (
    <div className="table-heading">
      <strong className="table-game-name">{gameName(g)}</strong>
      <TableProgress g={g} />
    </div>
  );
}
