import type { Shape, Side } from '@/lib/games/metro/map';
import { cardShape, cardSide, type Card } from '@/lib/games/metro/engine';

/** The four line colours, painted in glaze: the names are for screen readers. */
export const LINE_NAMES = ['Terracotta', 'Cobalt', 'Olive', 'Saffron'];
export const SHAPE_NAMES: Record<Shape | 'any', string> = {
  circle: 'circle',
  square: 'square',
  triangle: 'triangle',
  diamond: 'diamond',
  any: 'any station',
};
export const BANK_NAMES: Record<Side, string> = { moon: 'Moon', sun: 'Sun' };

/** A station's outline, centred on (cx, cy), about 2r across. */
export function shapePoints(shape: Shape, cx: number, cy: number, r: number) {
  switch (shape) {
    case 'triangle': {
      const h = r * 1.1;
      return `${cx},${cy - h} ${cx + r * 1.08},${cy + h * 0.78} ${cx - r * 1.08},${cy + h * 0.78}`;
    }
    case 'diamond':
      return `${cx},${cy - r * 1.18} ${cx + r * 1.18},${cy} ${cx},${cy + r * 1.18} ${cx - r * 1.18},${cy}`;
    default:
      return '';
  }
}

/** A station shape as an SVG element (inside an existing <svg>). */
export function ShapeGlyph({
  shape,
  cx,
  cy,
  r,
  className,
}: {
  shape: Shape;
  cx: number;
  cy: number;
  r: number;
  className?: string;
}) {
  if (shape === 'circle')
    return <circle className={className} cx={cx} cy={cy} r={r} />;
  if (shape === 'square') {
    const s = r * 0.9;
    return (
      <rect
        className={className}
        x={cx - s}
        y={cy - s}
        width={s * 2}
        height={s * 2}
        rx={r * 0.12}
      />
    );
  }
  return (
    <polygon
      className={className}
      points={shapePoints(shape, cx, cy, r)}
      strokeLinejoin="round"
    />
  );
}

/** The eight-point star of the wild card: any station. */
export function AnyGlyph({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * i) / 8 - Math.PI / 2;
    const rr = i % 2 ? r * 0.46 : r * 1.12;
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  return <polygon className="metro-any" points={pts.join(' ')} strokeLinejoin="round" />;
}

/** The Sun bank's mark: a disc with short rays. */
export function SunGlyph({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r * 0.72}
        y1={cy + Math.sin(a) * r * 0.72}
        x2={cx + Math.cos(a) * r * 1.05}
        y2={cy + Math.sin(a) * r * 1.05}
      />
    );
  });
  return (
    <g className="metro-sun">
      {rays}
      <circle cx={cx} cy={cy} r={r * 0.5} />
    </g>
  );
}

/** The Moon bank's mark: a crescent. */
export function MoonGlyph({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const R = r * 0.9;
  return (
    <path
      className="metro-moon"
      d={`M ${cx + R * 0.35} ${cy - R}
          A ${R} ${R} 0 1 0 ${cx + R * 0.35} ${cy + R}
          A ${R * 0.78} ${R * 0.78} 0 1 1 ${cx + R * 0.35} ${cy - R} Z`}
    />
  );
}

export const BankGlyph = ({
  side,
  ...p
}: {
  side: Side;
  cx: number;
  cy: number;
  r: number;
}) => (side === 'sun' ? <SunGlyph {...p} /> : <MoonGlyph {...p} />);

/** The railway switch: one track forking in two. */
export function SwitchGlyph({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g className="metro-switch-glyph">
      <path
        d={`M ${cx} ${cy + r} L ${cx} ${cy} M ${cx} ${cy} L ${cx - r * 0.8} ${cy - r} M ${cx} ${cy} L ${cx + r * 0.8} ${cy - r}`}
      />
      <circle cx={cx} cy={cy} r={r * 0.2} />
    </g>
  );
}

/** A standalone shape icon for rules, the score sheet and buttons. */
export function ShapeIcon({ shape, className }: { shape: Shape | 'any'; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className ?? 'metro-shape-icon'} aria-hidden="true">
      {shape === 'any' ? (
        <AnyGlyph cx={20} cy={20} r={15} />
      ) : (
        <ShapeGlyph shape={shape} cx={20} cy={21} r={13} className="metro-icon-shape" />
      )}
    </svg>
  );
}

export function SwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className ?? 'metro-switch-icon'} aria-hidden="true">
      <SwitchGlyph cx={20} cy={22} r={13} />
    </svg>
  );
}

export function BankIcon({ side, className }: { side: Side; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className ?? 'metro-bank-icon'} aria-hidden="true">
      <BankGlyph side={side} cx={20} cy={20} r={16} />
    </svg>
  );
}

export const cardLabel = (c: Card) =>
  c === 'sw'
    ? 'Railway switch'
    : `${BANK_NAMES[cardSide(c)!]} bank, ${SHAPE_NAMES[cardShape(c)!]}`;

/**
 * A card is a painted tile: its bank's mark in the corner and the station
 * shape large in the middle; the switch tile shows the fork.
 */
export function CardFace({ card }: { card: Card }) {
  if (card === 'sw')
    return (
      <svg viewBox="0 0 100 100" className="metro-card-art" aria-hidden="true">
        <SwitchGlyph cx={50} cy={54} r={28} />
      </svg>
    );
  const side = cardSide(card)!;
  const shape = cardShape(card)!;
  return (
    <svg viewBox="0 0 100 100" className="metro-card-art" aria-hidden="true">
      <BankGlyph side={side} cx={22} cy={22} r={13} />
      {shape === 'any' ? (
        <AnyGlyph cx={56} cy={58} r={28} />
      ) : (
        <ShapeGlyph shape={shape} cx={56} cy={59} r={24} className="metro-card-shape" />
      )}
    </svg>
  );
}
