// Full scene, gameplay crop and overview crop for every world source and registered variant.
import sharp from 'sharp';
import fs from 'node:fs';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const moraVariants = read('lib/games/observatory-variants.json');
const tableVariants = read('lib/games/table-world-variants.json');
const worlds = [
  ['lib/games/observatory-art.json', (art) => moraVariants.filter((v) => v.orientation === (art.height > art.width ? 'portrait' : 'landscape'))],
  ['lib/games/observatory-portrait-art.json', (art) => moraVariants.filter((v) => v.orientation === (art.height > art.width ? 'portrait' : 'landscape'))],
  ...['nox-world-landscape', 'nox-world-portrait', 'yata-world-landscape', 'yata-world-portrait'].map((name) => [
    `lib/games/${name}.json`,
    (art) => tableVariants.filter((v) => v.game === art.game && v.orientation === (art.height > art.width ? 'portrait' : 'landscape')),
  ]),
];
for (const [f, variantsFor] of worlds) {
  const art = read(f);
  const targets = [art, ...variantsFor(art)];
  for (const t of targets) {
    if (!fs.existsSync(`public${t.source}`)) { console.warn('missing', t.source); continue; }
    await sharp(`public${t.source}`).webp({ quality: 90 }).toFile(`public${t.image}`);
    if (t.boardImage) await sharp(`public${t.source}`).extract(art.crop).webp({ quality: 94 }).toFile(`public${t.boardImage}`);
    if (t.overviewImage) await sharp(`public${t.source}`).extract(art.overview).webp({ quality: 94 }).toFile(`public${t.overviewImage}`);
    console.log('ok', t.image);
  }
}
