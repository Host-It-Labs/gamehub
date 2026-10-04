import type { SanctuaryGoal } from '@/lib/games/trio/engine';

/*
 * One picture per goal, drawn from the board's own language: square or round
 * pads (the die's two shapes) holding creatures shown as coloured dots. The
 * same colour is the same species; different colours are different species;
 * brown dots are any species. A dashed outline is a whole habitat. The picture
 * shows the finished goal, so it reads without its text.
 */
const SPECIES = [
  '#c55f38',
  '#2f7f8f',
  '#d8a232',
  '#7b5796',
  '#5f9344',
  '#48505f',
];
const ANY = '#8b6a45';
type Shape = 'square' | 'round';
type Dot = string | null;

const shapeOf = (zone?: number): Shape =>
  zone !== undefined && [0, 1, 2].includes(zone) ? 'square' : 'round';

function Pad({
  x,
  y,
  size,
  shape,
  dot,
}: {
  x: number;
  y: number;
  size: number;
  shape: Shape;
  dot?: Dot;
}) {
  const r = size / 2;
  return (
    <g>
      {shape === 'square' ? (
        <rect
          x={x - r}
          y={y - r}
          width={size}
          height={size}
          rx={size * 0.2}
          className="goal-pad"
        />
      ) : (
        <circle cx={x} cy={y} r={r} className="goal-pad" />
      )}
      {dot && <circle cx={x} cy={y} r={r * 0.58} fill={dot} />}
    </g>
  );
}

/** Pads laid out in rows (for example [3, 2] is three above two), centred in the 24 × 24 box. */
function Pads({
  rows,
  shape,
  dots,
  top = 12,
  size,
}: {
  rows: number[];
  shape: Shape;
  dots: Dot[];
  top?: number;
  size?: number;
}) {
  const widest = Math.max(...rows);
  const s =
    size ??
    Math.min(
      9,
      21 / (widest + (widest - 1) * 0.2),
      21 / (rows.length + (rows.length - 1) * 0.2),
    );
  const gap = s * 0.2;
  const height = rows.length * s + (rows.length - 1) * gap;
  let index = 0;
  return (
    <>
      {rows.map((count, row) => {
        const width = count * s + (count - 1) * gap;
        return Array.from({ length: count }, (_, i) => {
          const dot = dots[index++] ?? null;
          return (
            <Pad
              key={`${row}-${i}`}
              x={12 - width / 2 + s / 2 + i * (s + gap)}
              y={top - height / 2 + s / 2 + row * (s + gap)}
              size={s}
              shape={shape}
              dot={dot}
            />
          );
        });
      })}
    </>
  );
}

/** A whole habitat: a dashed outline holding a few creatures. */
function Habitat({
  x,
  y,
  w,
  h,
  dots,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  dots: Dot[];
}) {
  const r = Math.min(h * 0.26, (w / Math.max(1, dots.length)) * 0.34);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className={`goal-habitat ${w < 8 ? 'small' : ''}`}
      />
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={x + (w / dots.length) * (i + 0.5)}
          cy={y + h / 2}
          r={r}
          fill={dot ?? ANY}
        />
      ))}
    </g>
  );
}

/** A compact grid of whole habitats, kept inside the round medal. */
function Habitats({ count, dots }: { count: number; dots: () => Dot[] }) {
  const cols = count <= 2 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const gap = 1.2,
    box = 19;
  const w = (box - (cols - 1) * gap) / cols,
    h = Math.min(w * 0.9, (box - (rows - 1) * gap) / rows);
  const top = 12 - (rows * h + (rows - 1) * gap) / 2;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / cols),
          inRow = Math.min(cols, count - row * cols);
        const left = 12 - (inRow * w + (inRow - 1) * gap) / 2;
        return (
          <Habitat
            key={i}
            x={left + (i % cols) * (w + gap)}
            y={top + row * (h + gap)}
            w={w}
            h={h}
            dots={dots()}
          />
        );
      })}
    </>
  );
}

const rowsFor = (count: number): number[] =>
  count <= 3 ? [count] : count === 4 ? [2, 2] : count === 5 ? [3, 2] : [3, 3];
const same = (n: number, colour = SPECIES[0]) => Array<Dot>(n).fill(colour);
const any = (n: number) => Array<Dot>(n).fill(ANY);
const spread = (n: number) =>
  Array.from({ length: n }, (_, i) => SPECIES[i % SPECIES.length]);
const arrow = (y: number) => (
  <path d={`M4 ${y}H19M16 ${y - 2.5}l3 2.5-3 2.5`} className="goal-line" />
);

export function GoalIcon({
  goal,
  size = 30,
}: {
  goal: SanctuaryGoal;
  size?: number;
}) {
  const shape = shapeOf(goal.zone);
  const target = goal.target;
  let art;
  switch (goal.type) {
    case 'full':
      // Two habitats, full to the edge.
      art = (
        <>
          <Habitat x={1.5} y={3} w={21} h={7.5} dots={any(4)} />
          <Habitat x={1.5} y={13.5} w={21} h={7.5} dots={any(4)} />
        </>
      );
      break;
    case 'squares':
    case 'rounds':
      art = (
        <Pads
          rows={[3, 3]}
          shape={goal.type === 'squares' ? 'square' : 'round'}
          dots={any(6)}
        />
      );
      break;
    case 'herd':
      // One species across two neighbouring habitats.
      art = (
        <>
          <Habitat x={1.5} y={3} w={21} h={7.5} dots={same(2)} />
          <Habitat x={1.5} y={13.5} w={21} h={7.5} dots={same(2)} />
        </>
      );
      break;
    case 'mirror':
      // A pair in one habitat, the same species in the other.
      art = (
        <>
          <Habitat
            x={1.5}
            y={3}
            w={21}
            h={7.5}
            dots={[SPECIES[0], SPECIES[0], SPECIES[1], SPECIES[1]]}
          />
          <Habitat
            x={5.5}
            y={13.5}
            w={13}
            h={7.5}
            dots={[SPECIES[0], SPECIES[1]]}
          />
        </>
      );
      break;
    case 'family':
      art =
        goal.zone === undefined ? (
          // Many of one species, anywhere on the board.
          <Pads rows={[3, 3]} shape="square" dots={same(6)} />
        ) : (
          <Pads rows={rowsFor(target)} shape={shape} dots={same(target)} />
        );
      break;
    case 'diversity':
      art = <Pads rows={[3, 3]} shape="round" dots={spread(6)} />;
      break;
    case 'habitats':
      // Several habitats, each holding its share of creatures.
      art = (
        <Habitats
          count={Math.min(6, target)}
          dots={() => any(Math.min(3, goal.min ?? 1))}
        />
      );
      break;
    case 'pairs': {
      // Families of two: rows of matching pairs.
      const n = Math.min(target, 6);
      const dots = Array.from({ length: n }, (_, i) => [
        SPECIES[i],
        SPECIES[i],
      ]).flat();
      // Up to three pairs stack; more sit two pairs to a row.
      const rows =
        n <= 3
          ? Array<number>(n).fill(2)
          : Array.from({ length: Math.ceil(n / 2) }, (_, i) =>
              i * 2 + 2 <= n ? 4 : 2,
            );
      art = <Pads rows={rows} shape="square" dots={dots} />;
      break;
    }
    case 'variety':
      art = <Pads rows={rowsFor(target)} shape={shape} dots={spread(target)} />;
      break;
    case 'twins': {
      const dots = Array.from({ length: target }, (_, i) => [
        SPECIES[i],
        SPECIES[i],
      ]).flat();
      art = (
        <Pads rows={target === 1 ? [2] : [2, 2]} shape={shape} dots={dots} />
      );
      break;
    }
    case 'fill':
      art = <Pads rows={rowsFor(target)} shape={shape} dots={any(target)} />;
      break;
    case 'trail':
      // Two species taking turns along the spaces, in order.
      art = (
        <>
          <Pads
            rows={[4]}
            shape={shape}
            dots={[SPECIES[0], SPECIES[1], SPECIES[0], SPECIES[1]]}
            top={9}
          />
          {arrow(18.5)}
        </>
      );
      break;
    case 'run':
      // One species several times in a row, in order.
      art = (
        <>
          <Pads
            rows={[Math.min(4, target)]}
            shape={shape}
            dots={same(Math.min(4, target))}
            top={9}
          />
          {arrow(18.5)}
        </>
      );
      break;
    case 'lookout':
      // The watcher and its species in other habitats.
      art = (
        <>
          <Pad x={12} y={5.5} size={8} shape="round" dot={SPECIES[0]} />
          <path
            d="M12 9.5V13M12 13H4.5V15M12 13H19.5V15M12 13V15"
            className="goal-line"
          />
          {[0, 1, 2].map((i) => (
            <Habitat
              key={i}
              x={1 + i * 7.6}
              y={15.5}
              w={6.4}
              h={6.5}
              dots={same(1)}
            />
          ))}
        </>
      );
      break;
    case 'spread':
      // One species found in several habitats.
      art = <Habitats count={Math.min(6, target)} dots={() => same(1)} />;
      break;
    case 'lighthouse':
      // Species found only here: each dot alone, ringed.
      art = (
        <>
          <Pads
            rows={[2]}
            shape="round"
            dots={[SPECIES[0], SPECIES[1]]}
            top={10}
            size={9}
          />
          <circle cx={6.6} cy={10} r={6.2} className="goal-ring" />
          <circle cx={17.4} cy={10} r={6.2} className="goal-ring" />
          <path d="M7 20.5h10" className="goal-line" />
        </>
      );
      break;
  }
  return (
    <svg
      className="goal-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {art}
    </svg>
  );
}
