// Makes a portrait paper world taller so its sanctuary fits a phone's visible
// column (see scripts/check-board-cover.mjs): a band of the picture's own
// bottom scenery, mirrored, is added above the scene with a feathered join,
// and the bottom edge is continued by its own mirror image. Pad and label
// coordinates move down by `top` pixels.
//   node scripts/extend-paper-world.mjs <src> <out> <top> <bottom> [feather]
import sharp from 'sharp';
const [, , src, out, topArg, bottomArg, featherArg] = process.argv;
const top = Number(topArg),
  bottom = Number(bottomArg),
  feather = Number(featherArg ?? 40);
const { width, height } = await sharp(src).metadata();
const band = top + feather;
// Mirrored left-right so the repeat is not obvious next to the trees below.
const above = await sharp(src)
  .extract({ left: 0, top: height - band - 16, width, height: band })
  .flop()
  .png()
  .toBuffer();
// The edge continued by its own reflection: seamless at the join.
const below = await sharp(src)
  .extract({ left: 0, top: height - bottom, width, height: bottom })
  .flip()
  .png()
  .toBuffer();
// The scene fades in over `feather` px at its top so the seam disappears.
const mask = Buffer.from(
  `<svg width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${feather / height}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="1"/>
   </linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
);
const scene = await sharp(src)
  .ensureAlpha()
  .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
  .png()
  .toBuffer();
await sharp({
  create: {
    width,
    height: height + top + bottom,
    channels: 3,
    background: '#2f3b2a',
  },
})
  .composite([
    { input: above, top: 0, left: 0 },
    { input: scene, top, left: 0 },
    { input: below, top: top + height, left: 0 },
  ])
  .png()
  .toFile(out);
console.log(
  'wrote',
  out,
  `${width}x${height + top + bottom}, content shifted down ${top}px`,
);
