// Counter (red enamel top + cream rim) and blank cream menu boards in a plan-view Yata plate.
import sharp from 'sharp';
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const px = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };
  const red = ([r, g, b]) => r > 150 && g < 110 && b < 100 && r > g * 1.9;
  const cream = ([r, g, b]) => r > 190 && g > 175 && b > 140 && r - b < 90 && Math.abs(r - g) < 40;
  // longest contiguous red run per row / column
  const run = (n, get) => { let best = 0, cur = 0, s = -1, bs = -1, be = -1; for (let i = 0; i < n; i++) { if (get(i)) { if (!cur) s = i; cur++; if (cur > best) { best = cur; bs = s; be = i; } } else cur = 0; } return { best, bs, be }; };
  const rows = Array.from({ length: H }, (_, y) => run(W, (x) => red(px(x, y))));
  const longest = Math.max(...rows.map((r) => r.best));
  const redRows = rows.map((r, y) => r.best > longest * 0.8 ? y : -1).filter((y) => y >= 0);
  const top = redRows[0], bottom = redRows.at(-1);
  const mid = rows[Math.round((top + bottom) / 2)];
  const left = mid.bs, right = mid.be;
  // cream rim thickness: walk outward from the red edges along the middle row / column
  const walk = (x0, y0, dx, dy) => { let n = 0, skip = 0, x = x0 + dx, y = y0 + dy; while (x >= 0 && y >= 0 && x < W && y < H && !cream(px(x, y)) && skip < 18) { skip++; x += dx; y += dy; } while (x >= 0 && y >= 0 && x < W && y < H && cream(px(x, y))) { n++; x += dx; y += dy; } return n ? n + skip : 0; };
  const cy = Math.round((top + bottom) / 2), cx = Math.round((left + right) / 2);
  const rim = { left: walk(left, cy, -1, 0), right: walk(right, cy, 1, 0), top: walk(cx, top, 0, -1), bottom: walk(cx, bottom, 0, 1) };
  const outer = { left: left - rim.left, top: top - rim.top, right: right + rim.right, bottom: bottom + rim.bottom };
  const bands = [outer.top / H, (H - outer.bottom) / H, outer.left / W, (W - outer.right) / W].map((v) => v.toFixed(3));
  console.log(f.split('/').pop(), `${W}x${H}`);
  console.log('  red top', { left, top, right, bottom }, 'rim', rim);
  console.log('  outer incl. rim', outer, 'width', outer.right - outer.left, 'height', outer.bottom - outer.top);
  console.log('  bands t/b/l/r', bands.join(' '));
  // side menu boards: cream bounding boxes left of the counter and right of it, within the counter's vertical span ± 30%
  for (const [name, x0, x1] of [['left board', 0, outer.left - 20], ['right board', outer.right + 20, W]]) {
    let bl = W, br = -1, bt = H, bb = -1, n = 0;
    for (let y = Math.max(0, top - 200); y < Math.min(H, bottom + 200); y++) for (let x = x0; x < x1; x++) if (cream(px(x, y))) { n++; bl = Math.min(bl, x); br = Math.max(br, x); bt = Math.min(bt, y); bb = Math.max(bb, y); }
    if (n > 2000) console.log(' ', name, { left: bl, top: bt, right: br, bottom: bb, width: br - bl, height: bb - bt, pixels: n });
    else console.log(' ', name, 'none');
  }
}
