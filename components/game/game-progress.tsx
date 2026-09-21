import './game-progress.css';

/** All games place progress immediately below their back/name control. */
export function GameProgress({ label }: { label: string }) {
  return (
    <output className="game-progress" aria-label={label}>
      {label}
    </output>
  );
}
