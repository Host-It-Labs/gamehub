// Adds woodland above a paper world by cloning a strip of its own bottom
// forest, blended with a feathered join, and pushes the scene down by the same
// amount. The output keeps the source size; the discarded bottom band is spare
// forest. Usage: node scripts/extend-paper-world-top.mjs <src> <out> <px> [bandTop] [feather]
import sharp from 'sharp';
const [, , src, out, pxArg, stripTopArg, featherArg] = process.argv;
const px = Number(pxArg),
  feather = Number(featherArg ?? 40);
const { width, height } = await sharp(src).metadata();
// One continuous band of forest, tall enough to run under the feathered join.
const band = px + feather;
const stripTop = Number(stripTopArg ?? height - band - 16);
// Mirrored so the repeat is not obvious next to the same trees below.
const strip = await sharp(src)
  .extract({ left: 0, top: stripTop, width, height: band })
  .flop()
  .png()
  .toBuffer();
// The scene fades in over `feather` px at its top so the seam disappears; keep the
// feather short so nothing of the sanctuary (a flag, a vane) turns translucent.
// A white rect whose opacity ramps from 0 to 1 over the feather; dest-in keeps
// the scene's colour and takes this alpha.
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
await sharp({ create: { width, height, channels: 3, background: '#2f3b2a' } })
  .composite([
    { input: strip, top: 0, left: 0 },
    { input: scene, top: px, left: 0 },
  ])
  .png()
  .toFile(out);
console.log('wrote', out, `shift ${px}px, band from y=${stripTop}`);
