import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const round2 = !!process.env.DINER_REVIEW_ROUND2;
const out = new URL(round2 ? './review/round2/' : './review/', import.meta.url);
const places = ['truckstop', 'drivein', 'fairground', 'harbour', 'oldtown', 'moonmile'];
const names = ['Truck stop', 'Drive-in', 'Fairground', 'Harbour', 'Old Town', 'Moon Mile'];
const label = (text, width) => Buffer.from(`<svg width="${width}" height="28"><rect width="100%" height="100%" fill="#20263a"/><text x="12" y="19" fill="#f0e5d1" font-family="Arial" font-size="13">${text}</text></svg>`);

async function sheet(files, labels, name, columns, width, height) {
  const layers = [];
  for (let i = 0; i < files.length; i++) {
    const left = i % columns * width, top = Math.floor(i / columns) * (height + 28);
    layers.push({ input: label(labels[i], width), left, top });
    layers.push({ input: await sharp(new URL(files[i], out).pathname).resize(width, height).png().toBuffer(), left, top: top + 28 });
  }
  await sharp({ create: { width: columns * width, height: Math.ceil(files.length / columns) * (height + 28), channels: 4, background: '#20263a' } }).composite(layers).png().toFile(new URL(name, out).pathname);
}

for (const detail of ['stage', 'map']) for (const asset of ['car', 'truck']) {
  const angles = ['clay-front', 'clay-side', 'clay-rear', 'clay-three-quarter', 'colour'];
  await sheet(angles.map(a => `source-${asset}-${detail}-${a}.png`), angles.map(a => `${asset} / ${detail} / ${a} / CPU source`), `source-${asset}-${detail}-sheet.png`, 2, 500, 340);
}
for (const quality of ['high', 'low', '44deg']) {
  const prefix = quality === 'high' ? '' : quality + '-';
  await sheet(places.map(p => `source-${p}-${prefix}1280x720.png`), names.map(n => `${n} / ${quality === '44deg' ? '44° camera' : quality + ' / responsive camera'} / CPU source`), `source-stage-${quality}-desktop-sheet.png`, 2, 640, 360);
  for (let i = 0; i < 3; i++) {
    await sheet(places.slice(i * 2, i * 2 + 2).map(p => `source-${p}-${prefix}390x844.png`), names.slice(i * 2, i * 2 + 2).map(n => `${n} / ${quality} / CPU source`), `source-stage-${quality}-phone-pair-${i + 1}.png`, 2, 390, 844);
  }
}
const budget = JSON.parse(readFileSync(new URL('source-budget.json', out)));
const rows = places.map((p, i) => {
  const values = ['high', 'low'].map(q => budget.find(r => r.place === p && r.quality === q && !r.upgrades));
  return `<tr><th>${names[i]}</th>${values.map(r => `<td>${r.draws + r.shadowDraws}</td><td>${(r.triangles + r.shadowTriangles).toLocaleString('en')}</td>`).join('')}</tr>`;
}).join('');
const image = (file, title) => `<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${title}"></a><figcaption>${title}</figcaption></figure>`;
writeFileSync(new URL('index.html', out), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diner car — source review</title>
<style>body{margin:0;background:#101424;color:#efe6d6;font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:32px}h1,h2{line-height:1.1}p{max-width:85ch;color:#bfc7d5}a{color:#9edbcd}nav{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}button{background:#293347;border:1px solid #596477;color:#efe6d6;border-radius:8px;padding:12px;font:inherit;cursor:pointer}button[aria-pressed=true]{background:#487b72}section{margin:48px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:20px}figure{margin:0;background:#20263a;border-radius:12px;overflow:hidden}img{width:100%;display:block}figcaption{padding:12px;color:#c7cbd4}.pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pair img{max-height:844px;object-fit:contain}.phone{width:auto;max-width:50%;margin:auto}table{border-collapse:collapse;width:100%;max-width:1000px;font-variant-numeric:tabular-nums}td,th{padding:10px 16px;text-align:left;border-bottom:1px solid #354052}th{font-weight:500}small{color:#aeb6c6}@media(max-width:600px){main{padding:18px}.pair{grid-template-columns:1fr}.phone{max-width:100%}table{font-size:12px}td,th{padding:6px}}</style>
<main><h1>Diner car and six places${round2 ? ' — round 2' : ''}</h1><p>9 October 2026. CPU source renders of the live TypeScript geometry. These approximate materials and omit WebGL reflections, bloom, shadows and normal maps. ${round2 ? 'The supplied WebGL baseline is linked below; Claude will capture the next runtime review with the night lighting.' : 'Browser access was blocked; these are source review evidence.'}</p><p><a href="${round2 ? '../../' : '../'}notes.md">Review notes and API</a> · <a href="source-budget.json">Raw geometry measurements</a>${round2 ? ' · <a href="../../feedback-round-2.md">Claude’s round 2 feedback</a>' : ' · <a href="browser-check.log">Browser blocker</a>'}</p>
${round2 ? '<section><h2>Supplied WebGL baseline</h2><p>These are Claude’s actual night renders before this revision. They establish the rejected empty surroundings and plain roof; the new CPU views cannot establish final night exposure or bloom.</p><div class="grid">' + places.map((p,i)=>'<figure><div class="pair"><a href="../runtime-'+p+'-1280x720.png"><img loading="lazy" src="../runtime-'+p+'-1280x720.png" alt="Previous '+names[i]+' runtime desktop"></a><a href="../runtime-'+p+'-390x844.png"><img loading="lazy" src="../runtime-'+p+'-390x844.png" alt="Previous '+names[i]+' runtime phone"></a></div><figcaption>'+names[i]+' · previous WebGL night view</figcaption></figure>').join('') + '</div></section>' : ''}
<section><h2>The shift stage</h2><nav><button aria-pressed="true" data-mode="high">High / responsive camera</button><button aria-pressed="false" data-mode="low">Low / responsive camera</button><button aria-pressed="false" data-mode="44deg">High / 44° camera</button></nav><div id="stages" class="grid"></div></section>
<section><h2>Car and truck, clay and colour</h2><div class="grid">${['stage','map'].flatMap(d=>['car','truck'].map(a=>image(`source-${a}-${d}-sheet.png`,`${a} / ${d} detail / four clay angles and colour`))).join('')}</div></section>
${round2 ? '<section><h2>Coupled rig</h2><p>The truck’s rear attachment and the diner’s A-frame coupler meet at the same world point. The rig remains straight, nose out, with tyres on the ground. It is secondary scenery and crops at the left edge on portrait phones.</p><div class="grid">'+image('source-hitched-rig-clay.png','Stage rig / clay / whole silhouette')+image('source-hitched-rig-colour.png','Stage rig / colour / whole silhouette')+'</div></section>' : ''}
<section><h2>Workshop variants</h2><div class="grid">${['stage','map'].flatMap(d=>['car','truck'].map(a=>image(`source-upgraded-${a}-${d}-colour.png`,`${a} / ${d} / all workshop details`))).join('')}</div><div class="grid">${image('source-upgraded-fairground-low-1280x720.png','All upgrades, low detail, desktop')}${image('source-upgraded-fairground-low-390x844.png','All upgrades, low detail, phone')}</div></section>
<section><h2>Map landmark vignettes</h2>${image('source-map-contact.png','Truck stop, Drive-in, Fairground, Harbour, Old Town, Moon Mile, Garage and Motel')}</section>
<section><h2>Living motion</h2><p>Source samples at 0 / 2.5 / 5 / 7.5 seconds. Walking, vehicle motion, rides, flags, water, signs and the entrance gate are time-driven. Full cycles and occupied gameplay still need WebGL review.</p><div class="grid">${places.map((p,i)=>image('source-motion-'+p+'-sheet.png', names[i]+' / four source motion samples')).join('')}</div></section>
<section><h2>Measured geometry budget</h2><p>Conservative totals: main pass plus one complete shadow pass, all five booths, plain car. These are analytical source counts, not renderer.info measurements. High limits: 140 calls / 450,000 triangles. Low limits: 70 calls / 180,000 triangles.</p><table><thead><tr><th>Place</th><th>High calls</th><th>High triangles</th><th>Low calls</th><th>Low triangles</th></tr></thead><tbody>${rows}</tbody></table><p>Every stage uses three point lights without shadows. Maximum procedural texture: 256 × 256. See notes for all-upgrade counts and validation.</p></section></main>
<script>const places=${JSON.stringify(places)},names=${JSON.stringify(names)};function show(mode){const prefix=mode==='high'?'':mode+'-';document.getElementById('stages').innerHTML=places.map((p,i)=>'<figure><div class="pair"><a href="source-'+p+'-'+prefix+'1280x720.png"><img src="source-'+p+'-'+prefix+'1280x720.png" alt="'+names[i]+' desktop"></a><a href="source-'+p+'-'+prefix+'390x844.png"><img src="source-'+p+'-'+prefix+'390x844.png" alt="'+names[i]+' portrait phone"></a></div><figcaption>'+names[i]+' · '+mode+'</figcaption></figure>').join('');}for(const b of document.querySelectorAll('button'))b.addEventListener('click',()=>{for(const s of document.querySelectorAll('button'))s.setAttribute('aria-pressed',s===b);show(b.dataset.mode)});show('high');</script></html>`);
console.log('Review contact sheets and index.html created');
