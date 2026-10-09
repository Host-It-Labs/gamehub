import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const directory = new URL('../review/round3-fixes/', import.meta.url);
const places = [
  ['truckstop', 'Truck stop'],
  ['drivein', 'Drive-in'],
  ['fairground', 'Fairground'],
  ['harbour', 'Harbour'],
  ['oldtown', 'Old Town'],
  ['moonmile', 'Moon Mile'],
];
async function contactSheet(size, width, height, columns, name) {
  const gap = 12, labelHeight = 28;
  const composites = [];
  for (let index = 0; index < places.length; index++) {
    const [id, label] = places[index];
    const left = gap + (index % columns) * (width + gap);
    const top = gap + Math.floor(index / columns) * (height + labelHeight + gap);
    const input = await sharp(await readFile(new URL(`webgl-${id}-${size}.jpg`, directory)))
      .resize(width, height, { fit: 'contain', background: '#121822' }).jpeg({ quality: 95 }).toBuffer();
    composites.push({ input, left, top });
    const caption = Buffer.from(`<svg width="${width}" height="${labelHeight}"><text x="0" y="20" fill="#ddd8cf" font-family="sans-serif" font-size="16">${label}</text></svg>`);
    composites.push({ input: caption, left, top: top + height });
  }
  const rows = Math.ceil(places.length / columns);
  await sharp({ create: { width: columns * (width + gap) + gap, height: rows * (height + labelHeight + gap) + gap, channels: 3, background: '#121822' } })
    .composite(composites).jpeg({ quality: 94 }).toFile(new URL(name, directory).pathname);
}
await contactSheet('1280x720', 480, 270, 3, 'sheet-desktop.jpg');
await contactSheet('390x844', 260, 563, 3, 'sheet-phone.jpg');
const cards = places.map(([id, label]) => `<article><h2>${label}</h2><div class="views"><a href="webgl-${id}-1280x720.jpg"><img src="webgl-${id}-1280x720.jpg" alt="${label}, desktop WebGL"></a><a href="webgl-${id}-390x844.jpg"><img src="webgl-${id}-390x844.jpg" alt="${label}, portrait WebGL"></a></div></article>`).join('\n');
await writeFile(new URL('index.html', directory), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diner stage — round 3 fixes</title>
<style>body{margin:0;padding:24px;background:#121822;color:#e5dfd4;font:16px/1.5 system-ui;max-width:1440px;margin-inline:auto}h1{font-size:26px}h2{font-size:20px}p{max-width:80ch}a{color:#b8dfe8}article{margin-block:32px}.views{display:grid;grid-template-columns:1fr minmax(150px,25%);gap:16px;align-items:start}img{display:block;width:100%;height:auto;border-radius:6px}nav{display:flex;gap:20px;flex-wrap:wrap}@media(max-width:600px){body{padding:12px}.views{grid-template-columns:1fr}.views a:nth-child(2){max-width:260px}}</style>
<h1>Diner stage — round 3 fixes</h1>
<p>Actual WebGL captures from the existing Diner lab, with its ACES exposure and bloom (strength 0.38, threshold 0.92). Desktop 1280×720 and portrait 390×844. These six-place views show the stage and surroundings; the occupied shift below also shows appliances and a player. Click an image for its original capture.</p>
<nav><a href="../../notes.md">Notes and validation</a><a href="source-budget.json">Conservative stage budgets</a><a href="renderer-budgets.json">Observed renderer budgets</a><a href="../round3/sheet-desktop.png">Claude’s pre-fix review</a></nav>
${cards}
<article><h2>Occupied shift — Drive-in</h2><p>One focused integration view with appliances, the player and the normal HUD. This is not an all-place gameplay or physical-touch check.</p><a href="webgl-occupied-drivein-1280x720.jpg"><img src="webgl-occupied-drivein-1280x720.jpg" alt="Occupied Drive-in shift with warm laminate and blue film screen"></a></article>
</html>`);
console.log('Saved WebGL desktop/phone contact sheets and review gallery.');
