import './know-me-marks.css';

/** Know Me's game marks: one chunky game-show object per game, ink-outlined
 * like the studio set, drawn for the pick tiles and the starting burst.
 * Their parts carry classes (`mark-bar-*`, `mark-needle`, `mark-stack-*`,
 * `mark-drop`…) so each game's own motion lives in game-intro.css. The End
 * flag is shared by both sets. */

/** Five ranked ribbons, numbered, a star on the winner. */
export function TopFiveMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark know-mark mark-orin"
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} className={`mark-rank mark-rank-${i}`}>
          <rect
            x={14}
            y={6 + i * 11}
            width={44 - i * 6}
            height={8.5}
            rx={4.25}
            className={`mark-bar mark-bar-${i}`}
          />
          <circle cx={9} cy={10.25 + i * 11} r={5} className="mark-chip" />
          <text x={9} y={12.6 + i * 11} className="mark-digit">
            {i + 1}
          </text>
        </g>
      ))}
      <path
        d="M57 3.5l1.7 3.4 3.8.5-2.8 2.6.7 3.7-3.4-1.8-3.4 1.8.7-3.7-2.8-2.6 3.8-.5z"
        className="mark-star"
      />
    </svg>
  );
}

/** A studio dial: coloured arc, ticks, bulbs on top, the needle mid-swing. */
export function DialMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark know-mark mark-dial"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="know-mark-arc" x1="0" x2="1">
          <stop offset="0" stopColor="#1f9e94" />
          <stop offset=".5" stopColor="#f2b531" />
          <stop offset="1" stopColor="#e5482e" />
        </linearGradient>
      </defs>
      <path d="M4 48a28 28 0 0 1 56 0z" className="mark-face" />
      <path
        d="M10 46a22 22 0 0 1 44 0"
        fill="none"
        stroke="url(#know-mark-arc)"
        strokeWidth="8"
        className="mark-arc"
      />
      {[-60, -30, 0, 30, 60].map((a) => (
        <path
          key={a}
          d="M32 20v4"
          transform={`rotate(${a} 32 46)`}
          className="mark-tick"
        />
      ))}
      <g className="mark-needle">
        <path d="M32 46L44 27" />
      </g>
      <circle cx="32" cy="46" r="4.5" className="mark-hub" />
      <rect x="6" y="48" width="52" height="8" rx="4" className="mark-base" />
      {[18, 32, 46].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy="52"
          r="2"
          className={`mark-bulb mark-bulb-${i}`}
        />
      ))}
    </svg>
  );
}

/** Ten coins split three ways: stacks of five, three and two, the last
 * coin dropping onto its pile. */
export function CoinsMark() {
  const stacks: [number, number][] = [
    [14, 5],
    [32, 3],
    [50, 2],
  ];
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark know-mark mark-coins"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="58" rx="28" ry="4" className="mark-shadow" />
      {stacks.map(([x, n], k) => (
        <g key={x} className={`mark-stack mark-stack-${k}`}>
          {Array.from({ length: n }, (_, i) => (
            <g
              key={i}
              className="mark-coin"
              transform={`translate(${x} ${52 - i * 6.5})`}
            >
              <path d="M-9 0v4a9 3.4 0 0 0 18 0V0" className="mark-coin-side" />
              <ellipse rx="9" ry="3.4" className="mark-coin-top" />
            </g>
          ))}
        </g>
      ))}
      <g className="mark-drop" transform="translate(50 20) rotate(-18)">
        <ellipse rx="9" ry="9" className="mark-coin-face" />
        <ellipse rx="5.5" ry="5.5" className="mark-coin-ring" />
      </g>
    </svg>
  );
}

/** A chequered finish flag, shared by both sets. */
export function EndMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark know-mark mark-end"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="know-mark-check"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <rect width="12" height="12" fill="#fffaf0" />
          <rect width="6" height="6" fill="#2b1a12" />
          <rect x="6" y="6" width="6" height="6" fill="#2b1a12" />
        </pattern>
      </defs>
      <path d="M14 6v54" className="mark-pole" />
      <path
        d="M16 8c8-4 16 4 24 0s12-2 16 0v26c-4-2-8-4-16 0s-16-4-24 0z"
        fill="url(#know-mark-check)"
        className="mark-flag"
      />
    </svg>
  );
}
