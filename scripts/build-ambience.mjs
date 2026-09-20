// Cuts and encodes the ambient soundscapes from CC0 field recordings on Freesound.
// Beds are steady stretches of a recording; one-shots are single calls, creaks or clinks.
// Sources are fetched as Freesound's HQ previews (public, no account) and cached locally.
//   node scripts/build-ambience.mjs [--raw DIR] [world ...]
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
const run = promisify(execFile);

const OUT = 'public/audio/ambience';
const args = process.argv.slice(2);
const rawIndex = args.indexOf('--raw');
const RAW = rawIndex >= 0 ? args.splice(rawIndex, 2)[1] : `${tmpdir()}/gamehub-ambience`;
const only = new Set(args);

/** Every clip: [name, freesoundId, startSeconds, durationSeconds, kind, fadeSeconds]. Kinds: 'bed' (stereo), 'layer' (a quieter mono bed) or 'shot' (one-shot). */
const SPEC = {
  forest: [
    ['breeze', 460178, 3, 96, 'bed'],
    ['birds-far', 788118, 3, 96, 'layer'],
    ['thrush-1', 156826, 7.7, 4.0],
    ['thrush-2', 156826, 59.0, 4.0],
    ['thrush-3', 156826, 96.2, 4.5],
    ['jay', 57906, 4.6, 4.2],
    ['woodpecker-1', 347047, 5.1, 2.5],
    ['woodpecker-2', 347047, 24.0, 2.5],
    ['crow-1', 173866, 13.6, 3.2],
    ['crow-2', 173866, 92.6, 4.5],
    ['owl', 465697, 0, 4.4],
    ['branch-1', 501302, 0, 1.4],
    ['branch-2', 501303, 0, 2.2],
    ['leaves', 405140, 4, 5],
    ['frog', 532235, 'peak', 3.0],
  ],
  ship: [
    ['crew-murmur-1', 819223, 22, 12, 'crew', 2],
    ['crew-murmur-2', 819223, 78, 14, 'crew', 2],
    ['hull', 851577, 3, 125, 'bed'],
    ['swell', 578524, 6, 150, 'layer'],
    ['creak-1', 31574, 34.6, 3.5],
    ['creak-2', 31574, 77.6, 3.5],
    ['creak-3', 31574, 21.6, 3.5],
    ['creak-short-1', 502511, 0, 1.2],
    ['creak-short-2', 506665, 0, 1.2],
    ['bell-single', 353233, 0, 4.3],
    ['bell-double', 353232, 0, 2.9],
    ['gull-1', 510917, 4.8, 2.6],
    ['gull-2', 510917, 8.5, 2.5],
    ['sail', 448975, 8.9, 3.0],
    ['oar', 588307, 22.7, 3.2],
    ['wash', 388408, 5.2, 4.5],
  ],
  coast: [
    ['surf', 578524, 8, 150, 'bed'],
    ['shore', 388408, 0.5, 19, 'layer'],
    ['gulls-near', 510917, 0.2, 6],
    ['gulls-far', 510917, 7, 6],
    ['wash', 388408, 4, 10, 'shot', 1.5],
  ],
  street: [
    ['sizzle', 402380, 1, 26, 'layer'],
    ['market', 755969, 43, 150, 'bed'],
    ['bazaar', 819223, 3, 110, 'layer'],
    ['plate', 463902, 0.8, 2.6],
    ['dishes-1', 316643, 1.3, 2.2],
    ['dishes-2', 339676, 30.0, 3.2],
    ['chopsticks', 561032, 65.8, 3.0],
    ['wok-1', 679946, 5, 12, 'shot', 0.8],
    ['wok-2', 402380, 13, 12, 'shot', 0.8],
    ['bike-bell-1', 81875, 0, 1.8],
    ['bike-bell-2', 188032, 0, 1.3],
    ['scooter', 509522, 0.5, 9.5, 'shot', 1.2],
    ['laughter', 651669, 14.4, 3.2, 'shot', 0.6],
    ['flute', 315888, 43.0, 6.5, 'shot', 1.5],
  ],
};

const credits = JSON.parse(await readFile('scripts/ambience-sources.json', 'utf8').catch(() => '{}'));

async function exists(path) {
  return access(path).then(() => true, () => false);
}
async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 gamehub-ambience' } });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}
/** Freesound's HQ preview is public; the page also carries the title, author and licence. */
async function source(id) {
  const path = `${RAW}/${id}.mp3`;
  if (!(await exists(path)) || !credits[id]) {
    const page = await fetchText(`https://freesound.org/s/${id}/`);
    const mp3 = page.match(/data-mp3="([^"]+)"/)[1].replace('-lq.mp3', '-hq.mp3');
    const title = page.match(/data-title="([^"]*)"/)[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const user = page.match(new RegExp(`href="/people/([^/]+)/sounds/${id}/`))[1];
    const license = page.match(/href="(https?:\/\/creativecommons\.org\/[^"]+)"/)?.[1] ?? 'unknown';
    if (!(await exists(path))) {
      const response = await fetch(mp3);
      if (!response.ok) throw new Error(`${mp3}: ${response.status}`);
      await writeFile(path, Buffer.from(await response.arrayBuffer()));
    }
    credits[id] = { title, user, license, url: `https://freesound.org/s/${id}/` };
  }
  return path;
}
/** Loudest 50 ms frame, so a whole-file one-shot can be centred on its transient. */
async function peakTime(path) {
  const { stderr } = await run('ffmpeg', ['-v', 'info', '-i', path, '-af', 'astats=metadata=1:reset=1:length=0.05,ametadata=print:key=lavfi.astats.Overall.RMS_level', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  let best = -Infinity, at = 0, time = 0;
  for (const line of stderr.split('\n')) {
    const pts = line.match(/pts_time:([\d.]+)/);
    if (pts) time = Number(pts[1]);
    const level = line.match(/RMS_level=(-?[\d.]+|-inf)/);
    if (level && Number(level[1]) > best) { best = Number(level[1]); at = time; }
  }
  return at;
}
async function measure(path) {
  const { stderr } = await run('ffmpeg', ['-i', path, '-af', 'volumedetect', '-f', 'null', '-']);
  return {
    mean: Number(stderr.match(/mean_volume: (-?[\d.]+)/)[1]),
    max: Number(stderr.match(/max_volume: (-?[\d.]+)/)[1]),
  };
}
async function encode(world, [name, id, start, duration, kind = 'shot', fade]) {
  const input = await source(id);
  if (start === 'peak') start = Math.max(0, (await peakTime(input)) - 0.35);
  const out = `${OUT}/${world}/${name}.m4a`;
  const bed = kind === 'bed' || kind === 'layer';
  const stereo = kind === 'bed';
  const cut = ['-ss', String(start), '-t', String(duration), '-i', input];
  // Cut once at unity to measure, then encode with a gain that lands on the target level.
  const probe = `${RAW}/probe-${world}-${name}.wav`;
  await run('ffmpeg', ['-y', '-v', 'error', ...cut, '-ac', stereo ? '2' : '1', probe]);
  const { mean, max } = await measure(probe);
  const gain = bed ? -27 - mean : Math.min(-3 - max, 24);
  const fadeIn = fade ?? (bed ? 0.3 : 0.02), fadeOut = fade ?? (bed ? 0.3 : Math.min(0.4, duration / 4));
  const filters = [
    'highpass=f=40',
    `afade=t=in:d=${fadeIn}`,
    `afade=t=out:st=${(duration - fadeOut).toFixed(3)}:d=${fadeOut}`,
    `volume=${gain.toFixed(2)}dB`,
    'alimiter=limit=0.95:level=false',
  ].join(',');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', probe, '-af', filters, '-ar', '44100', '-c:a', 'aac', '-b:a', stereo ? '56k' : '40k', '-movflags', '+faststart', out]);
  return out;
}

await mkdir(RAW, { recursive: true });
const report = [];
for (const [world, clips] of Object.entries(SPEC)) {
  if (only.size && !only.has(world)) continue;
  await mkdir(`${OUT}/${world}`, { recursive: true });
  for (const clip of clips) {
    const out = await encode(world, clip);
    const { size } = await import('node:fs').then((fs) => fs.promises.stat(out));
    report.push(`${out} ${(size / 1024).toFixed(0)} KB`);
    console.log(report.at(-1));
  }
}
await writeFile('scripts/ambience-sources.json', JSON.stringify(credits, null, 1) + '\n');
const used = new Set(Object.values(SPEC).flat().map((c) => c[1]));
const lines = ['# Ambience sources', '', 'All recordings are Creative Commons 0 (public domain) from Freesound, cut and re-encoded by scripts/build-ambience.mjs.', ''];
for (const id of [...used].sort((a, b) => a - b)) {
  const c = credits[id];
  if (c) lines.push(`- [${c.title}](${c.url}) by ${c.user} — ${c.license}`);
}
await writeFile(`${OUT}/CREDITS.md`, lines.join('\n') + '\n');
