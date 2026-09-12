import {
  catalog,
  handSize,
  totalRounds,
  type PublicGame,
} from '@/lib/games/trio/engine';

export function TableHeading({ g }: { g: PublicGame }) {
  const phase =
    g.phase === 'over'
      ? 'Finished'
      : g.phase === 'pass'
        ? 'Passing cards'
        : g.phase === 'roll'
          ? 'Rolling dice'
          : `Pick ${Math.min(g.pick, handSize(g))} / ${handSize(g)}`;
  return (
    <div className="table-heading">
      <strong className="table-game-name">
        {catalog.find((game) => game.id === g.id)?.name}
      </strong>
      <div className="table-progress">
        <span>
          Round{' '}
          <b>
            {g.round} / {totalRounds(g)}
          </b>
        </span>
        <small>{phase}</small>
      </div>
    </div>
  );
}
