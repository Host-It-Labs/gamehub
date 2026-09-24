/** Sabi's vote-tile marks, drawn like the Tribu marks: one simple shape per game. */

/** A globe with a planted pin. */
export function AtlasMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark"
      aria-hidden="true"
    >
      <circle cx="30" cy="36" r="21" className="mark-globe" />
      <path
        d="M9 36h42M30 15c-7 6-7 36 0 42M30 15c7 6 7 36 0 42"
        className="mark-lines"
        fill="none"
      />
      <path
        d="M44 6a8 8 0 0 1 8 8c0 6-8 14-8 14s-8-8-8-14a8 8 0 0 1 8-8z"
        className="mark-pin"
      />
      <circle cx="44" cy="14" r="3" className="mark-pin-dot" />
    </svg>
  );
}
/** Two blocks side by side, one many times the other, with a ×. */
export function SizesMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark"
      aria-hidden="true"
    >
      <rect x="6" y="40" width="12" height="12" rx="3" className="mark-small" />
      <rect x="26" y="12" width="32" height="40" rx="5" className="mark-big" />
      <path d="M9 22l8 8M17 22l-8 8" className="mark-times" />
    </svg>
  );
}
