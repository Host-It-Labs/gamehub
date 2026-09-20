import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = process.cwd() + '/public/audio/ambience';
let rng = 719201;
const random = () => {
  rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
  return (rng / 4294967296) * 2 - 1;
};
for (const [world, style] of [
  ['roka', 0],
  ['talo', 1],
  ['soma', 2],
]) {
  fs.mkdirSync(`${root}/${world}`, { recursive: true });
  for (const [name, seconds] of [
    ['bed', 42],
    ['texture', 37],
    ['event-1', 3],
    ['event-2', 4],
    ['event-3', 5],
  ]) {
    const out = `${root}/${world}/${name}.m4a`;
    if (fs.existsSync(out)) continue;
    const rate = 24000,
      N = rate * seconds,
      data = Buffer.alloc(N * 4 + 44);
    data.write('RIFF');
    data.writeUInt32LE(data.length - 8, 4);
    data.write('WAVEfmt ', 8);
    data.writeUInt32LE(16, 16);
    data.writeUInt16LE(1, 20);
    data.writeUInt16LE(2, 22);
    data.writeUInt32LE(rate, 24);
    data.writeUInt32LE(rate * 4, 28);
    data.writeUInt16LE(4, 32);
    data.writeUInt16LE(16, 34);
    data.write('data', 36);
    data.writeUInt32LE(N * 4, 40);
    let l = 0,
      r = 0,
      deep = 0;
    const event = name.startsWith('event'),
      texture = name === 'texture';
    for (let i = 0; i < N; i++) {
      const t = i / rate;
      l = 0.985 * l + 0.015 * random();
      r = 0.982 * r + 0.018 * random();
      deep = 0.9995 * deep + 0.0005 * random();
      const envelope = event
        ? Math.pow(Math.sin((Math.PI * i) / N), 2)
        : Math.min(1, t / 2, (seconds - t) / 2);
      let tonal = 0,
        noise = 0;
      if (style === 0) {
        noise = (l * 2 + deep * 6) * (0.5 + 0.4 * Math.sin(t * 0.49));
        tonal = texture ? Math.sin(t * 2 * Math.PI * 57) * 0.015 : 0;
        if (event)
          tonal =
            Math.sin(t * 2 * Math.PI * (640 + 80 * Math.sin(t * 5))) *
            0.08 *
            Math.pow(Math.max(0, Math.sin(t * 7)), 8);
      }
      if (style === 1) {
        noise = l * 0.6 + deep * 2;
        tonal =
          Math.sin(t * 2 * Math.PI * 96) * 0.012 +
          Math.sin(t * 2 * Math.PI * 144.2) * 0.007;
        if (texture)
          tonal =
            Math.sin(t * 2 * Math.PI * 222) *
            0.015 *
            Math.pow(Math.max(0, Math.sin(t * 0.71)), 10);
        if (event)
          tonal =
            (Math.sin(t * 2 * Math.PI * 260) +
              0.4 * Math.sin(t * 2 * Math.PI * 781)) *
            0.09 *
            Math.exp(-t * 1.7);
      }
      if (style === 2) {
        noise = l * 1.6 + deep * 4;
        tonal =
          (Math.sin(t * 2 * Math.PI * 72) +
            0.3 * Math.sin(t * 2 * Math.PI * 108)) *
          0.035 *
          (0.75 + 0.25 * Math.sin(t * 1.7));
        if (texture) noise *= 0.4 + 0.3 * Math.sin(t * 0.37);
        if (event) {
          noise *= 2;
          tonal =
            Math.sin(t * 2 * Math.PI * (150 + 15 * Math.sin(t * 3))) *
            0.06 *
            Math.pow(Math.max(0, Math.sin(t * 2)), 3);
        }
      }
      for (let ch = 0; ch < 2; ch++) {
        const v = (noise + (ch ? r - l : 0) + tonal) * envelope;
        data.writeInt16LE(
          Math.round(Math.max(-0.8, Math.min(0.8, v)) * 32767),
          44 + i * 4 + ch * 2,
        );
      }
    }
    const temp = `/tmp/${world}-${name}.wav`;
    fs.writeFileSync(temp, data);
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      temp,
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      out,
    ]);
  }
}
