import { dice } from '@/lib/games/trio/engine';

/** Die engravings show the restriction itself, so they read on any board:
 *  a square pad, a round pad, paving stones, a log, an empty pad, a newcomer. */
export function MoraDieSymbol({ face }: { face: number }) {
  const common = { viewBox: '0 0 48 48', 'aria-hidden': true as const, className: 'mora-die-symbol' };
  switch (face) {
    case 0:
      return (
        <svg {...common}>
          <rect x="9" y="9" width="30" height="30" rx="3" className="ink-fill" />
          <rect x="14" y="14" width="20" height="20" rx="2" className="paper-fill" />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" className="ink-fill" />
          <circle cx="24" cy="24" r="10" className="paper-fill" />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <path className="ink-fill" d="M7 12h16v10H7zM25 12h16v10H25zM7 24h11v12H7zM20 24h14v12H20zM36 24h5v12h-5z" />
          <path className="paper-fill" d="M9 14h12v6H9zM27 14h12v6H27zM9 26h7v8H9zM22 26h10v8H22z" />
        </svg>
      );
    case 3:
      return (
        <svg {...common}>
          <rect x="6" y="17" width="34" height="14" rx="7" className="ink-fill" />
          <ellipse cx="38" cy="24" rx="6" ry="7" className="paper-fill" />
          <ellipse cx="38" cy="24" rx="2.5" ry="3" className="ink-fill" />
          <path d="M11 21h18M11 27h14" className="ink-line" />
        </svg>
      );
    case 4:
      return (
        <svg {...common}>
          <rect x="9" y="11" width="30" height="26" rx="4" className="ink-dash" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="7" y="13" width="26" height="24" rx="4" className="ink-fill" />
          <rect x="11" y="17" width="18" height="16" rx="3" className="paper-fill" />
          <path d="M37 6v12M31 12h12" className="ink-line" />
        </svg>
      );
  }
}

export const moraDieLabels = dice.map((d) => d.name);
