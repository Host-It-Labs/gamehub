import fs from 'node:fs/promises';
import sharp from 'sharp';
const base = 'docs/concepts/2026-09-22-relic/art/ruins-cover';
const source = '/Users/williamguinaudie/.codex/generated_images/01a0c92b-b901-7123-a350-a9f101e683e6/';
const files = [
  ['exec-d8a3cc44-952a-49b6-a7f6-b23592095f7a.png', 'ruins-landscape-v1.png'],
  ['exec-e748ac8f-93a7-4dd9-9cfd-f3c0420b428c.png', 'ruins-landscape-v2.png'],
  ['exec-7c752002-9ebb-460f-9836-93097486b06d.png', 'ruins-portrait-v1.png'],
  ['exec-3785bcf1-5546-459b-9a82-7e7af3bdbcec.png', 'ruins-portrait-v2.png'],
  ['exec-88739a93-164e-41df-a75d-eb0e5dd92a9b.png', 'box-relic-blind-v1.png'],
];
for (const [generated, local] of files) {
  try { await fs.access(base + '/' + local); } catch { await fs.copyFile(source + generated, base + '/' + local); }
  const meta = await sharp(base + '/' + local).metadata();
  console.log(local, meta.width, meta.height);
}
await sharp(base + '/ruins-landscape-v2.png').webp({ quality: 88 }).toFile('public/art/relic/ruins-landscape-v1.webp');
await sharp(base + '/ruins-portrait-v2.png').webp({ quality: 88 }).toFile('public/art/relic/ruins-portrait-v1.webp');
await sharp(base + '/box-relic-blind-v1.png').resize(1024, 1024).webp({ quality: 90 }).toFile('public/art/optimized/box-relic-blind-v1.webp');
await sharp('public/art/optimized/box-relic-blind-v1.webp').extract({left:0,top:0,width:64,height:1024}).webp({quality:88}).toFile('public/art/optimized/box-relic-blind-v1-spine.webp');
