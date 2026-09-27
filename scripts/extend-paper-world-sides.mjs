// Makes a portrait paper world wider so portrait tablets, which fit the play
// box by height, still reach both side edges: each side is continued by its
// own mirror image, so the join is seamless. Pad and label coordinates move
// right by `px` pixels.
//   node scripts/extend-paper-world-sides.mjs <src> <out> <px>
import sharp from 'sharp';
const [, , src, out, pxArg] = process.argv;
const px = Number(pxArg);
const { width, height } = await sharp(src).metadata();
const side = (left) =>
  sharp(src).extract({ left, top: 0, width: px, height }).flop().png().toBuffer();
await sharp({ create: { width: width + 2 * px, height, channels: 3, background: '#2f3b2a' } })
  .composite([
    { input: await side(0), top: 0, left: 0 },
    { input: src, top: 0, left: px },
    { input: await side(width - px), top: 0, left: px + width },
  ])
  .png()
  .toFile(out);
console.log('wrote', out, `${width + 2 * px}x${height}, content shifted right ${px}px`);
