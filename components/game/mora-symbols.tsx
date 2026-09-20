import { dice } from '@/lib/games/trio/engine';

/** Die engravings show the restriction itself, so they read on any board:
 *  a square pad, a round pad, three pads, an occupied pad, an empty pad, a newcomer. */
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
      // Big homes: a habitat with three or more pads.
      return (
        <svg {...common}>
          <rect x="6" y="8" width="16" height="14" rx="3" className="ink-fill" />
          <rect x="9" y="11" width="10" height="8" rx="2" className="paper-fill" />
          <rect x="26" y="8" width="16" height="14" rx="3" className="ink-fill" />
          <rect x="29" y="11" width="10" height="8" rx="2" className="paper-fill" />
          <rect x="16" y="26" width="16" height="14" rx="3" className="ink-fill" />
          <rect x="19" y="29" width="10" height="8" rx="2" className="paper-fill" />
        </svg>
      );
    case 3:
      // Company: a pad that already holds a creature.
      return (
        <svg {...common}>
          <rect x="9" y="11" width="30" height="26" rx="4" className="ink-fill" />
          <rect x="13" y="15" width="22" height="18" rx="3" className="paper-fill" />
          <circle cx="24" cy="24" r="6" className="ink-fill" />
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
