// Lucky's ticket-factory delivery files: the ten machine sprites sliced from
// one 5×2 sheet, the seamless floor texture and the straight belt segment.
// Mechanical slicing, keying, trims and resizes only.
// Sources: docs/concepts/2026-09-25-lucky-factory; the PNGs live in the art
// archive beside the repo (ART_ARCHIVE), not in git.
import { existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const archive =
  process.env.ART_ARCHIVE ?? '../gamehub-art-archive/public/art/lucky';
const source = (file) => {
  const path = `${archive}/factory/${file}`;
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  return path;
};
/** The accepted variant of each image. */
const chosen = {
  machines: process.env.LUCKY_MACHINES ?? 'machines-v1-b.png',
  floor: process.env.LUCKY_FLOOR ?? 'floor-v1-b.png',
  belt: process.env.LUCKY_BELT ?? 'belt-v1-a.png',
};
/** Sheet order, left to right, top row first. */
const kinds = [
  'printer',
  'bot',
  'cashier',
  'splitter',
  'lamp',
  'ink',
  'stamper',
  'gilder',
  'charm',
  'bundler',
];
const out = 'public/art/lucky/factory';
mkdirSync(out, { recursive: true });
const clear = { r: 0, g: 0, b: 0, alpha: 0 };

/** RGBA pixels of an image; a flat magenta backdrop is keyed to alpha. */
async function rgba(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 250) opaque++;
  if (opaque === info.width * info.height) {
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // Distance from pure magenta: near → clear, a soft ramp at the edge,
      // and the pink spill pulled out of the green channel's complement.
      const d = Math.max(255 - r, g, 255 - b);
      if (d < 40) data[i + 3] = 0;
      else if (d < 90) {
        data[i + 3] = Math.round(((d - 40) / 50) * 255);
        const m = Math.min(r, b);
        data[i] = Math.min(r, Math.max(g, m - 40));
        data[i + 2] = Math.min(b, Math.max(g, m - 40));
      }
    }
  }
  return { data, width: info.width, height: info.height };
}

// Machines: a 5×2 sheet. Cut lines are taken at the emptiest column or row
// near each fifth or half mark, so no cut crosses a machine; each cell is
// then trimmed to its opaque bounding box and centred in a square.
// The generated rows sit nearer the middle than the geometric cell centres,
// so each machine is centred on its own box rather than on the cell.
{
  const { data, width, height } = await rgba(source(chosen.machines));
  const solid = (x, y) => data[(y * width + x) * 4 + 3] > 24;
  const cuts = (profile, parts) =>
    Array.from({ length: parts - 1 }, (_, k) => {
      const at = Math.round((profile.length * (k + 1)) / parts),
        reach = Math.round((profile.length / parts) * 0.35);
      let best = at;
      for (let i = at - reach; i <= at + reach; i++)
        if (
          profile[i] < profile[best] ||
          (profile[i] === profile[best] &&
            Math.abs(i - at) < Math.abs(best - at))
        )
          best = i;
      if (profile[best] > 0)
        console.warn(`cut at ${best} crosses ${profile[best]} solid pixels`);
      return best;
    });
  const rowProfile = Array.from({ length: height }, (_, y) => {
    let n = 0;
    for (let x = 0; x < width; x++) n += solid(x, y) ? 1 : 0;
    return n;
  });
  const ys = [0, ...cuts(rowProfile, 2), height];
  const sheet = sharp(data, { raw: { width, height, channels: 4 } });
  const report = {};
  const boxes = [];
  for (let row = 0; row < 2; row++) {
    const top = ys[row],
      bottom = ys[row + 1];
    const columnProfile = Array.from({ length: width }, (_, x) => {
      let n = 0;
      for (let y = top; y < bottom; y++) n += solid(x, y) ? 1 : 0;
      return n;
    });
    const xs = [0, ...cuts(columnProfile, 5), width];
    for (let col = 0; col < 5; col++) {
      const kind = kinds[row * 5 + col];
      // Opaque bounding box inside the cell.
      let x0 = width,
        y0 = height,
        x1 = -1,
        y1 = -1;
      for (let y = top; y < bottom; y++)
        for (let x = xs[col]; x < xs[col + 1]; x++)
          if (solid(x, y)) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      if (x1 < 0) throw new Error(`${kind}: empty cell`);
      boxes.push([kind, x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
    }
  }
  // One square size for every machine, so the bodies keep one scale; each
  // machine sits centred on its own bounding box. Only the box itself is
  // copied, so no neighbour can bleed in.
  const side = Math.ceil(
    Math.max(...boxes.map(([, , , w, h]) => Math.max(w, h))) * 1.04,
  );
  for (const [kind, x0, y0, w, h] of boxes) {
    const piece = await sheet
      .clone()
      .extract({ left: x0, top: y0, width: w, height: h })
      .png()
      .toBuffer();
    const square = await sharp({
      create: { width: side, height: side, channels: 4, background: clear },
    })
      .composite([
        {
          input: piece,
          left: Math.floor((side - w) / 2),
          top: Math.floor((side - h) / 2),
        },
      ])
      .png()
      .toBuffer();
    await sharp(square)
      .resize(192, 192, { kernel: 'lanczos3' })
      .webp({ quality: 88, alphaQuality: 92 })
      .toFile(`${out}/${kind}.webp`);
    report[kind] = { box: [x0, y0, w, h], side };
  }
  console.log(JSON.stringify(report));
}

// Floor: a seamless square texture, resized whole so it still tiles.
await sharp(source(chosen.floor))
  .resize(512, 512, { kernel: 'lanczos3' })
  .webp({ quality: 84 })
  .toFile(`${out}/floor.webp`);

// Belt: the whole transparent square (not cropped to the band), so the
// component can centre it vertically on a cell.
{
  const { data, width, height } = await rgba(source(chosen.belt));
  await sharp(data, { raw: { width, height, channels: 4 } })
    .resize(256, 256, { kernel: 'lanczos3' })
    .webp({ quality: 86, alphaQuality: 92 })
    .toFile(`${out}/belt.webp`);
}
