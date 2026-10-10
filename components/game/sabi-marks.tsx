/** Quiz's game marks: one small enamel object from the measuring desk per
 * game, drawn for the vote tiles and the starting screen. Their parts carry
 * classes (`mark-land`, `mark-pin`, `mark-tape`, `mark-card-*`…) so each
 * game's own motion lives in sabi.css. */

/** A globe on its brass stand, the land turning, a pin dropping in. */
export function AtlasMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark mark-atlas"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sabi-atlas-sea" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#7fa6ff" />
          <stop offset=".55" stopColor="#3569ff" />
          <stop offset="1" stopColor="#1d3fb0" />
        </radialGradient>
        <clipPath id="sabi-atlas-clip">
          <circle cx="30" cy="30" r="18" />
        </clipPath>
      </defs>
      <ellipse cx="30" cy="59" rx="15" ry="2.6" className="mark-shadow" />
      <path d="M30 48v6M20 57h20" className="mark-brass-line" />
      <circle cx="30" cy="30" r="18" fill="url(#sabi-atlas-sea)" />
      <g clipPath="url(#sabi-atlas-clip)">
        <g className="mark-land">
          {[0, 40].map((dx) => (
            <g key={dx} transform={`translate(${dx} 0)`}>
              <path d="M6 20c4-5 11-6 14-2s-1 8 2 11-2 9-7 8-5-6-8-8-4-6-1-9z" />
              <path d="M26 14c3-2 8-1 9 2s-3 4-2 7 5 3 4 7-6 3-8 0-1-6-4-8-2-6 1-8z" />
              <path d="M14 40c3-1 7 0 7 3s-4 4-7 3-3-5 0-6z" />
            </g>
          ))}
        </g>
        <ellipse cx="23" cy="20" rx="7" ry="4" className="mark-gloss" />
      </g>
      <path
        d="M30 8a22 22 0 0 1 0 44"
        className="mark-brass-ring"
        fill="none"
      />
      <g className="mark-pin">
        <path d="M45 4a7 7 0 0 1 7 7c0 5-7 12-7 12s-7-7-7-12a7 7 0 0 1 7-7z" />
        <circle cx="45" cy="11" r="2.6" className="mark-pin-dot" />
      </g>
    </svg>
  );
}

/** A tape measure running out under a small block and a big one. */
export function SizesMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark mark-sizes"
      aria-hidden="true"
    >
      <ellipse cx="34" cy="59" rx="26" ry="2.4" className="mark-shadow" />
      <g className="mark-tape">
        <rect x="16" y="48" width="44" height="8" rx="1.5" />
        <path
          d="M22 48v3M27 48v2M32 48v3M37 48v2M42 48v3M47 48v2M52 48v3M57 48v2"
          className="mark-tape-ticks"
        />
      </g>
      <g className="mark-case">
        <rect x="3" y="38" width="20" height="20" rx="6" />
        <circle cx="13" cy="48" r="4.5" className="mark-case-hub" />
      </g>
      <g className="mark-small">
        <path d="M25 40l4-3h8l-4 3z" className="mark-top" />
        <rect x="25" y="40" width="8" height="8" rx="1" />
      </g>
      <g className="mark-big">
        <path d="M38 14l6-5h16l-6 5z" className="mark-top" />
        <path d="M54 14l6-5v34l-6 5z" className="mark-side" />
        <rect x="38" y="14" width="16" height="34" rx="1.5" />
      </g>
      <path d="M27 22l6 6M33 22l-6 6" className="mark-times" />
    </svg>
  );
}

/** A year pin arcing down onto a ruler, a spark where it lands. */
export function YearsMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark mark-years"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="58" rx="27" ry="2.4" className="mark-shadow" />
      <path d="M8 30C14 10 30 6 40 14" className="mark-trail" fill="none" />
      <g className="mark-ruler">
        <rect x="4" y="38" width="56" height="13" rx="3" />
        <path
          d="M10 38v5M16 38v3M22 38v5M28 38v3M34 38v5M40 38v3M46 38v5M52 38v3"
          className="mark-ticks"
        />
      </g>
      <g className="mark-spark">
        <path d="M42 30l-4-4M48 31l3-5M45 28v-6" />
      </g>
      <g className="mark-pin">
        <path d="M43 18v24" className="mark-stem" />
        <circle cx="43" cy="16" r="7" className="mark-head" />
        <circle cx="41" cy="14" r="2.2" className="mark-pin-dot" />
      </g>
    </svg>
  );
}

/** Five cards stood in a row, smallest to tallest, each a colour. */
export function OrderMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark mark-order"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="58" rx="27" ry="2.4" className="mark-shadow" />
      {[0, 1, 2, 3, 4].map((i) => {
        const h = 14 + i * 8;
        return (
          <g key={i} className={`mark-card mark-card-${i}`}>
            <rect x={5 + i * 11} y={55 - h} width={10} height={h} rx={2} />
            <rect
              x={5 + i * 11}
              y={55 - h}
              width={10}
              height={4}
              rx={2}
              className="mark-card-cap"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** End: a chequered finish flag on a desk pin. */
export function QuizEndMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark mark-end"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="sabi-end-check"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill="#fff8e6" />
          <rect width="4" height="4" fill="#1b2a24" />
          <rect x="4" y="4" width="4" height="4" fill="#1b2a24" />
        </pattern>
      </defs>
      <ellipse cx="24" cy="58" rx="14" ry="2.4" className="mark-shadow" />
      <path d="M20 57h10" className="mark-end-foot" />
      <path d="M24 56V9" className="mark-end-pole" />
      <g className="mark-flag">
        <path
          d="M25 10c8-3 14 3 24 0v20c-10 3-16-3-24 0z"
          fill="url(#sabi-end-check)"
          className="mark-end-cloth"
        />
      </g>
      <circle cx="24" cy="8" r="3.4" className="mark-end-knob" />
    </svg>
  );
}

/** Trivia's 4 more: four index cards fanned out, one per game, a tomato
 * enamel plus on the front card. */
export function QuizMoreMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="tribu-mark sabi-mark mark-more"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="58" rx="22" ry="2.6" className="mark-shadow" />
      {(
        [
          ['#3569ff', -21, 0],
          ['#ff5a3c', -7, 1],
          ['#ffd23f', 7, 2],
          ['#1f5a4a', 21, 3],
        ] as const
      ).map(([band, angle, i]) => (
        <g key={i} transform={`rotate(${angle} 32 56)`} className="mark-more-card">
          <rect
            x="20"
            y="14"
            width="24"
            height="34"
            rx="3"
            fill="#fff8e6"
            stroke="#1b2a24"
            strokeWidth="1.4"
          />
          <rect x="20" y="14" width="24" height="9" rx="3" fill={band} />
          <path d="M24 30h16M24 35h16M24 40h10" stroke="#1b2a2433" strokeWidth="1.4" />
        </g>
      ))}
      <circle cx="46" cy="16" r="10" fill="#ff5a3c" stroke="#c93a20" strokeWidth="1.6" />
      <path d="M46 10.5v11M40.5 16h11" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="42.5" cy="12" rx="3" ry="1.6" fill="#fff" opacity=".5" />
    </svg>
  );
}
