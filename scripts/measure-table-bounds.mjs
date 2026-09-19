// Bounding box of the painted table (Nox: petrol-green felt; Yata: red counter) in a plate.
// Usage: node scripts/measure-table-bounds.mjs public/art/<plate>.png ...
import sharp from 'sharp';
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels, nox = f.includes('nox');
  const hit = (r, g, b) => nox
    ? g > r * 1.12 && b > r * 0.95 && g > 28 && g < 150 && r < 120   // dark teal felt
    : r > 120 && r > g * 1.8 && r > b * 1.8;                          // saturated red enamel
  const rows = Array.from({ length: H }, () => 0), cols = Array.from({ length: W }, () => 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * C; if (hit(data[i], data[i + 1], data[i + 2])) { rows[y]++; cols[x]++; } }
  const rmax = Math.max(...rows), cmax = Math.max(...cols);
  const span = (arr, max) => { let a = -1, b = -1; arr.forEach((v, i) => { if (v > max * 0.3) { if (a < 0) a = i; b = i; } }); return [a, b]; };
  const [top, bottom] = span(rows, rmax), [left, right] = span(cols, cmax);
  console.log(f.split('/').pop(), `${W}x${H}`, { left, top, right, bottom, width: right - left, height: bottom - top },
    'bands t/b/l/r', (top / H).toFixed(3), ((H - bottom) / H).toFixed(3), (left / W).toFixed(3), ((W - right) / W).toFixed(3), 'maxRow', rmax);
  const step = Math.round((bottom - top) / 12);
  for (let y = top; y <= bottom; y += step) { const xs = []; for (let x = 0; x < W; x++) { const i = (y * W + x) * C; if (hit(data[i], data[i + 1], data[i + 2])) xs.push(x); } console.log('   y', y, 'n', rows[y], 'x', xs[0], '-', xs.at(-1)); }
}
