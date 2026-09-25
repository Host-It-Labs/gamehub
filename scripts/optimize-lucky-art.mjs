// Lucky's delivery files: each chosen ticket book trimmed to its die-cut
// shape, its empty play panel measured by flood fill, plus the prize symbol
// sheet and the library covers. Mechanical trims and resizes only.
// Sources: docs/concepts/2026-09-25-lucky-tickets; the PNGs live in the art
// archive beside the repo (ART_ARCHIVE), not in git.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const archive =
  process.env.ART_ARCHIVE ?? '../gamehub-art-archive/public/art/lucky';
/** The accepted variant of each book and a point inside its empty panel. */
const books = {
  seven: ['ticket-seven-v1-a.png', 0.5, 0.52],
  twins: ['ticket-twins-v1-a.png', 0.5, 0.6],
  path: ['ticket-path-v1-a.png', 0.5, 0.64],
  ladder: ['ticket-ladder-v1-a.png', 0.5, 0.62],
  mine: ['ticket-mine-v1-a.png', 0.5, 0.55],
  sunmoon: ['ticket-sunmoon-v1-b.png', 0.5, 0.5],
  chart: ['ticket-chart-v1-a.png', 0.72, 0.5],
  crown: ['ticket-crown-v1-a.png', 0.5, 0.55],
};
const out = 'public/art/lucky';
const round = (n) => Math.round(n * 10000) / 10000;

/** The bounding box of the flat panel around a seed point. */
function panelAt(data, width, height, sx, sy) {
  const at = (x, y) => (y * width + x) * 4;
  const seed = at(Math.round(sx * width), Math.round(sy * height));
  const ref = [data[seed], data[seed + 1], data[seed + 2]];
  const seen = new Uint8Array(width * height),
    stack = [[Math.round(sx * width), Math.round(sy * height)]];
  let x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height || seen[y * width + x])
      continue;
    seen[y * width + x] = 1;
    const i = at(x, y);
    if (
      data[i + 3] < 200 ||
      Math.abs(data[i] - ref[0]) +
        Math.abs(data[i + 1] - ref[1]) +
        Math.abs(data[i + 2] - ref[2]) >
        36
    )
      continue;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return { x0, y0, x1, y1 };
}

const art = {};
for (const [id, [file, sx, sy]] of Object.entries(books)) {
  const source = `${archive}/${file}`;
  if (!existsSync(source)) throw new Error(`Missing ${source}`);
  // Trim the transparent margin around the die-cut ticket.
  const trimmed = await sharp(source).trim({ threshold: 1 }).png().toBuffer();
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const p = panelAt(data, info.width, info.height, sx, sy);
  if (p.x1 - p.x0 < info.width * 0.3) throw new Error(`${id}: panel not found`);
  // Stay just inside the panel's printed edge.
  const inset = Math.round(Math.min(p.x1 - p.x0, p.y1 - p.y0) * 0.02);
  art[id] = {
    src: `/art/lucky/ticket-${id}-v1.webp`,
    small: `/art/lucky/ticket-${id}-v1-small.webp`,
    aspect: round(info.width / info.height),
    panel: [
      round((p.x0 + inset) / info.width),
      round((p.y0 + inset) / info.height),
      round((p.x1 - p.x0 - inset * 2) / info.width),
      round((p.y1 - p.y0 - inset * 2) / info.height),
    ],
  };
  const long = (size) =>
    info.width > info.height ? { width: size } : { height: size };
  await sharp(trimmed)
    .resize(long(1100))
    .webp({ quality: 84, alphaQuality: 90 })
    .toFile(`${out}/ticket-${id}-v1.webp`);
  await sharp(trimmed)
    .resize(long(360))
    .webp({ quality: 80, alphaQuality: 85 })
    .toFile(`${out}/ticket-${id}-v1-small.webp`);
}

// Prize symbols: a 4×4 sheet, 160px a cell. The generated sheet is split
// along its real empty gaps (columns first, then rows within each column),
// each symbol trimmed and re-centred with a clear gutter, so no neighbour
// ever bleeds into another.
{
  const source = `${archive}/symbols-v1-a.png`;
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const solid = (x, y) => data[(y * info.width + x) * 4 + 3] > 24;
  /** Three cut lines, each at the emptiest line near a quarter mark, so a
   * cut crosses as little of any symbol as possible. */
  const cuts = (profile) =>
    [1, 2, 3].map((k) => {
      const at = Math.round((profile.length * k) / 4),
        reach = Math.round(profile.length * 0.12);
      let best = at;
      for (let i = at - reach; i <= at + reach; i++)
        if (
          profile[i] < profile[best] ||
          (profile[i] === profile[best] &&
            Math.abs(i - at) < Math.abs(best - at))
        )
          best = i;
      return best;
    });
  const columnProfile = Array.from({ length: info.width }, (_, x) => {
    let n = 0;
    for (let y = 0; y < info.height; y++) n += solid(x, y) ? 1 : 0;
    return n;
  });
  const xs = [0, ...cuts(columnProfile), info.width];
  const tiles = [];
  for (let col = 0; col < 4; col++) {
    const x0 = xs[col],
      x1 = xs[col + 1];
    const rowProfile = Array.from({ length: info.height }, (_, y) => {
      let n = 0;
      for (let x = x0; x < x1; x++) n += solid(x, y) ? 1 : 0;
      return n;
    });
    const ys = [0, ...cuts(rowProfile), info.height];
    for (let row = 0; row < 4; row++) {
      const cut = await sharp(source)
        .extract({
          left: x0,
          top: ys[row],
          width: x1 - x0,
          height: ys[row + 1] - ys[row],
        })
        .png()
        .toBuffer();
      const icon = await sharp(cut)
        .trim({ threshold: 8 })
        .resize(140, 140, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      tiles.push({ input: icon, left: col * 160 + 10, top: row * 160 + 10 });
    }
  }
  await sharp({
    create: {
      width: 640,
      height: 640,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(tiles)
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(`${out}/symbols-v1.webp`);
}

// Library covers: square with spine and sizes, and the 3:1 lid.
const manifestPath = 'lib/artwork-previews.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const cover = '/art/optimized/box-lucky-v1.webp';
const square = () => sharp(`${archive}/cover-v1-a.png`).resize(1024, 1024);
await square().webp({ quality: 88 }).toFile(`public${cover}`);
await square()
  .extract({ left: 0, top: 0, width: 64, height: 1024 })
  .webp({ quality: 88 })
  .toFile(`public${cover.replace('.webp', '-spine.webp')}`);
const variants = [];
for (const width of [320, 640]) {
  const target = cover.replace('.webp', `-${width}.webp`);
  await square()
    .resize(width, width)
    .webp({ quality: 88 })
    .toFile(`public${target}`);
  variants.push(`${target} ${width}w`);
}
variants.push(`${cover} 1024w`);
const preview = await square().resize(24, 24).webp({ quality: 35 }).toBuffer();
manifest[cover] = {
  preview: `data:image/webp;base64,${preview.toString('base64')}`,
  srcSet: variants.join(', '),
};
const wideSource = `${archive}/${process.env.LUCKY_WIDE ?? 'wide-v1-a.png'}`;
if (existsSync(wideSource)) {
  const wide = '/art/optimized/box-lucky-wide-v1.webp';
  const { width, height } = await sharp(wideSource).metadata();
  const band = Math.round(width / 3);
  const cut = () =>
    sharp(wideSource).extract({
      left: 0,
      top: Math.round((height - band) / 2),
      width,
      height: band,
    });
  const sizes = [];
  for (const size of [768, 1536]) {
    const target =
      size === 1536 ? wide : wide.replace('.webp', `-${size}.webp`);
    await cut()
      .resize(size, Math.round(size / 3))
      .webp({ quality: 82 })
      .toFile(`public${target}`);
    sizes.push(`${target} ${size}w`);
  }
  manifest[wide] = {
    preview: `data:image/webp;base64,${(await cut().resize(36, 12).webp({ quality: 35 }).toBuffer()).toString('base64')}`,
    srcSet: sizes.join(', '),
  };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const lines = Object.entries(art).map(
  ([id, a]) =>
    `  ${id}: {\n    src: '${a.src}',\n    small: '${a.small}',\n    aspect: ${a.aspect},\n    panel: [${a.panel.join(', ')}],\n  },`,
);
await writeFile(
  'components/game/relic-scratch-art.ts',
  `import type { PackId } from '@/lib/games/relic/scratch';
/** Painted ticket books (generated by scripts/optimize-lucky-art.mjs).
 * \`panel\` is the empty play panel as x, y, width, height fractions of the
 * trimmed ticket; \`aspect\` is its width over height. */
export type TicketArt = {
  src: string;
  small: string;
  aspect: number;
  panel: [number, number, number, number];
};
export const TICKET_ART: Record<PackId, TicketArt> = {
${lines.join('\n')}
};
export const SYMBOL_SHEET = '/art/lucky/symbols-v1.webp';
`,
);
console.log(JSON.stringify(art, null, 1));
