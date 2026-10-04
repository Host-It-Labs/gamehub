// Checks that nothing collides on Alto's ships and home bases: every bolt-on
// part against every other and against the hull's features (canopy, legs out
// and folding, engine and flame, antenna, portholes, fins), in every pose the
// animations reach; and every base module against the others, the hub, the
// pad, the walkways and the docked full-kit ship. Surfaces are compared
// triangle by triangle, so only real contact counts.
// Usage: node --experimental-strip-types scripts/alto-fit.mjs [ship|base]
import { register } from 'node:module';

const root = new URL('../', import.meta.url).href;
// The game code imports without extensions and through `@/`; resolve both.
register(
  `data:text/javascript,${encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith('@/')) base = fileURLToPath(root + spec.slice(2));
  else if (/^\\.\\.?\\//.test(spec) && ctx.parentURL?.startsWith('file:') && !/\\.[cm]?[jt]sx?$/.test(spec))
    base = fileURLToPath(new URL(spec, ctx.parentURL));
  if (base)
    for (const ext of ['.ts', '.tsx'])
      if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
  return next(spec, ctx);
}`)}`,
);

const THREE = await import('three');
const { buildShip, shipBounds } =
  await import('../components/game/alto/alto-ship.ts');

const which = process.argv[2] ?? 'all';
const SHIP_PARTS =
  'rigging sawmill mason fold kite pier glassworks sails harbor balloon windmill'.split(
    ' ',
  );

// ——— Triangles ———

/** World-space triangles of everything visible under `obj` (morphs and instances applied). */
function triangles(obj, filter = () => true) {
  obj.updateMatrixWorld(true);
  const out = [];
  const v = new THREE.Vector3();
  const im = new THREE.Matrix4();
  const wm = new THREE.Matrix4();
  const visible = (o) => {
    // Meshes merged away (`baked`) still count as themselves.
    for (let p = o; p; p = p.parent)
      if (!p.visible && !p.userData.baked) return false;
    return !o.userData.ghostly;
  };
  obj.traverse((o) => {
    if (!o.isMesh || !visible(o) || !filter(o)) return;
    const g = o.geometry;
    const pos = g.getAttribute('position');
    const n = g.index ? g.index.count : pos.count;
    const verts = new Float32Array(pos.count * 3);
    const copies = o.isInstancedMesh ? o.count : 1;
    for (let c = 0; c < copies; c++) {
      wm.copy(o.matrixWorld);
      if (o.isInstancedMesh) {
        o.getMatrixAt(c, im);
        wm.multiply(im);
      }
      for (let i = 0; i < pos.count; i++) {
        o.getVertexPosition(i, v);
        v.applyMatrix4(wm);
        verts[i * 3] = v.x;
        verts[i * 3 + 1] = v.y;
        verts[i * 3 + 2] = v.z;
      }
      const tri = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const k = g.index ? g.index.getX(i) : i;
        tri[i * 3] = verts[k * 3];
        tri[i * 3 + 1] = verts[k * 3 + 1];
        tri[i * 3 + 2] = verts[k * 3 + 2];
      }
      out.push(tri);
    }
  });
  let len = 0;
  for (const t of out) len += t.length;
  const all = new Float32Array(len);
  let at = 0;
  for (const t of out) {
    all.set(t, at);
    at += t.length;
  }
  return all;
}
/** Keep the triangles for which `keep(i, tris)` holds. */
function pick(tris, keep) {
  const out = [];
  for (let i = 0; i < tris.length; i += 9)
    if (keep(i, tris)) for (let k = 0; k < 9; k++) out.push(tris[i + k]);
  return new Float32Array(out);
}
function boxOf(tris) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 3)
    b.expandByPoint(v.set(tris[i], tris[i + 1], tris[i + 2]));
  return b;
}

// Segment–triangle intersection (Möller–Trumbore, segment p→q).
function segHits(p, q, t, o) {
  const ax = t[o],
    ay = t[o + 1],
    az = t[o + 2];
  const e1x = t[o + 3] - ax,
    e1y = t[o + 4] - ay,
    e1z = t[o + 5] - az;
  const e2x = t[o + 6] - ax,
    e2y = t[o + 7] - ay,
    e2z = t[o + 8] - az;
  const dx = q[0] - p[0],
    dy = q[1] - p[1],
    dz = q[2] - p[2];
  const px = dy * e2z - dz * e2y,
    py = dz * e2x - dx * e2z,
    pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det;
  const sx = p[0] - ax,
    sy = p[1] - ay,
    sz = p[2] - az;
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y,
    qy = sz * e1x - sx * e1z,
    qz = sx * e1y - sy * e1x;
  const w = (dx * qx + dy * qy + dz * qz) * inv;
  if (w < 0 || u + w > 1) return false;
  const s = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return s >= 0 && s <= 1;
}
const P = [0, 0, 0];
const Q = [0, 0, 0];
function triHits(a, i, b, j) {
  for (let e = 0; e < 3; e++) {
    const f = (e + 1) % 3;
    P[0] = a[i + e * 3];
    P[1] = a[i + e * 3 + 1];
    P[2] = a[i + e * 3 + 2];
    Q[0] = a[i + f * 3];
    Q[1] = a[i + f * 3 + 1];
    Q[2] = a[i + f * 3 + 2];
    if (segHits(P, Q, b, j)) return true;
    P[0] = b[j + e * 3];
    P[1] = b[j + e * 3 + 1];
    P[2] = b[j + e * 3 + 2];
    Q[0] = b[j + f * 3];
    Q[1] = b[j + f * 3 + 1];
    Q[2] = b[j + f * 3 + 2];
    if (segHits(P, Q, a, i)) return true;
  }
  return false;
}

/** A grid of triangles for fast neighbour lookups. */
class Grid {
  constructor(tris, cell) {
    this.tris = tris;
    this.cell = cell;
    this.map = new Map();
    for (let i = 0; i < tris.length; i += 9) {
      const [x0, y0, z0, x1, y1, z1] = this.range(tris, i, 0);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const k = `${x},${y},${z}`;
            const list = this.map.get(k);
            if (list) list.push(i);
            else this.map.set(k, [i]);
          }
    }
  }
  range(t, i, pad) {
    const c = this.cell;
    let a = Infinity,
      b = Infinity,
      d = Infinity,
      e = -Infinity,
      f = -Infinity,
      g = -Infinity;
    for (let k = 0; k < 9; k += 3) {
      a = Math.min(a, t[i + k]);
      e = Math.max(e, t[i + k]);
      b = Math.min(b, t[i + k + 1]);
      f = Math.max(f, t[i + k + 1]);
      d = Math.min(d, t[i + k + 2]);
      g = Math.max(g, t[i + k + 2]);
    }
    return [
      Math.floor((a - pad) / c),
      Math.floor((b - pad) / c),
      Math.floor((d - pad) / c),
      Math.floor((e + pad) / c),
      Math.floor((f + pad) / c),
      Math.floor((g + pad) / c),
    ];
  }
  /** The first triangle of `other` that cuts into this grid, or null. */
  hit(other) {
    const seen = new Set();
    for (let i = 0; i < other.length; i += 9) {
      const [x0, y0, z0, x1, y1, z1] = this.range(other, i, 0);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4096) continue;
      seen.clear();
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const list = this.map.get(`${x},${y},${z}`);
            if (!list) continue;
            for (const j of list) {
              if (seen.has(j)) continue;
              seen.add(j);
              if (triHits(other, i, this.tris, j))
                return [
                  (other[i] +
                    other[i + 3] +
                    other[i + 6] +
                    this.tris[j] +
                    this.tris[j + 3] +
                    this.tris[j + 6]) /
                    6,
                  (other[i + 1] +
                    other[i + 4] +
                    other[i + 7] +
                    this.tris[j + 1] +
                    this.tris[j + 4] +
                    this.tris[j + 7]) /
                    6,
                  (other[i + 2] +
                    other[i + 5] +
                    other[i + 8] +
                    this.tris[j + 2] +
                    this.tris[j + 5] +
                    this.tris[j + 8]) /
                    6,
                ];
            }
          }
    }
    return null;
  }
}
/** Where two sets of triangles touch (a point), or null. */
function touch(a, b, cell = 0.03) {
  if (!a.length || !b.length) return null;
  const ba = boxOf(a);
  const bb = boxOf(b);
  if (!ba.intersectsBox(bb)) return null;
  // Only the triangles inside the overlap of the two boxes matter.
  const over = ba.clone().intersect(bb).expandByScalar(1e-4);
  const inside = (i, t) => {
    const tb = new THREE.Box3();
    for (let k = 0; k < 9; k += 3)
      tb.expandByPoint(new THREE.Vector3(t[i + k], t[i + k + 1], t[i + k + 2]));
    return tb.intersectsBox(over);
  };
  const a2 = pick(a, inside);
  const b2 = pick(b, inside);
  if (!a2.length || !b2.length) return null;
  const [big, small] = a2.length > b2.length ? [a2, b2] : [b2, a2];
  return new Grid(big, cell).hit(small);
}
/** Vertices of `a` that lie inside the closed surfaces of `b` (a ray cast
 * three ways must cross b an odd number of times each), as a count. */
function inside(a, b) {
  const over = boxOf(a).intersect(boxOf(b));
  if (over.isEmpty()) return 0;
  const near = pick(b, (i, t) => {
    for (let k = 0; k < 9; k += 3)
      if (
        t[i + k] >= over.min.x - 0.5 &&
        t[i + k + 1] >= over.min.y - 0.5 &&
        t[i + k + 2] >= over.min.z - 0.5
      )
        return true;
    return false;
  });
  const far = 50;
  const dirs = [
    [far, 0.013, 0.007],
    [0.011, far, -0.017],
    [-0.009, 0.019, far],
  ];
  let n = 0;
  const seen = new Set();
  for (let i = 0; i < a.length; i += 3) {
    const p = [a[i], a[i + 1], a[i + 2]];
    if (!over.containsPoint(new THREE.Vector3(...p))) continue;
    const key = p.map((x) => x.toFixed(4)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    let odd = 0;
    for (const d of dirs) {
      const q = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
      let c = 0;
      for (let j = 0; j < near.length; j += 9) if (segHits(p, q, near, j)) c++;
      if (c % 2) odd++;
    }
    if (odd === 3) n++;
  }
  return n;
}
const fmt = (p) => (p ? p.map((x) => x.toFixed(3)).join(', ') : '');

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

// ——— The ship ———

/** The hull's own features, sorted out of its merged meshes by where they are. */
function hullFeatures(ship) {
  ship.setKit([]);
  const hull = ship.group.children[0];
  const own = new Set(hull.children);
  const legs = [];
  let flame = null;
  for (const c of hull.children) {
    if (c.isGroup && c.rotation.z) legs.push(c);
    else if (c.isGroup) flame = c;
  }
  const merged = triangles(hull, (o) => own.has(o) && o.isMesh);
  const { hullRadius } = kit;
  const radius = (z) => hullRadius((z + 1) / 2);
  const feats = {
    canopy: [],
    portholes: [],
    antenna: [],
    engine: [],
    fins: [],
    rcs: [],
    nose: [],
    studs: [],
  };
  const ports = [];
  for (const a of [-1.22, 1.22])
    for (const z of [-0.42, -0.08])
      ports.push([radius(z) * Math.sin(a), radius(z) * Math.cos(a), z]);
  const ant = [
    radius(-0.42) * Math.sin(-0.62),
    radius(-0.42) * Math.cos(-0.62),
    -0.42,
  ];
  for (let i = 0; i < merged.length; i += 9) {
    const x = (merged[i] + merged[i + 3] + merged[i + 6]) / 3;
    const y = (merged[i + 1] + merged[i + 4] + merged[i + 7]) / 3;
    const z = (merged[i + 2] + merged[i + 5] + merged[i + 8]) / 3;
    const r = Math.hypot(x, y);
    const out = z > -1 && z < 1 ? r - radius(z) : 1;
    let kind = null;
    if (z < -0.95) kind = 'engine';
    else if (Math.hypot(x, y, z - 0.985) < 0.045) kind = 'nose';
    else if (
      (x / 0.24) ** 2 + ((y - 0.3) / 0.25) ** 2 + ((z - 0.4) / 0.31) ** 2 <
      1
    )
      kind = 'canopy';
    else if (ports.some((p) => Math.hypot(x - p[0], y - p[1], z - p[2]) < 0.1))
      kind = 'portholes';
    else if (
      Math.hypot(x - ant[0], y - ant[1], z - ant[2]) < 0.04 ||
      (z < -0.4 &&
        z > -0.62 &&
        x < 0 &&
        out > 0.01 &&
        Math.abs(Math.atan2(x, y) + 0.62) < 0.6)
    )
      kind = 'antenna';
    else if (Math.abs(z + 0.8) < 0.08 && Math.abs(y) < 0.1 && out > 0.004)
      kind = 'rcs';
    else if (z < -0.1 && out > 0.02) kind = 'fins';
    else if (out > 0.0105) kind = 'studs';
    if (kind) for (let k = 0; k < 9; k++) feats[kind].push(merged[i + k]);
  }
  const res = {};
  for (const [k, list] of Object.entries(feats))
    res[k] = new Float32Array(list);
  res.legs = legs;
  res.flame = flame;
  return res;
}

/** Contact that is the mount itself, hidden inside the part. */
const MOUNTED = {
  'mason × nose': 'the drill chuck clamps over the chrome nose tip',
};
let kit;
async function checkShip() {
  kit = await import('../components/game/alto/alto-kit.ts');
  console.log('Ship: every bolt-on part against the others and the hull');
  const ship = buildShip('#3a86ff');
  const hull = ship.group.children[0];
  const feats = hullFeatures(ship);
  // Each part's object: the group setKit adds to the hull for it.
  const parts = new Map();
  for (const id of SHIP_PARTS) {
    const before = new Set(hull.children);
    ship.setKit([...parts.keys(), id]);
    const added = hull.children.filter((c) => !before.has(c));
    if (added.length !== 1) throw new Error(`${id}: ${added.length} objects`);
    parts.set(id, added[0]);
  }
  ship.setLanded(1);
  // The poses: animation times, legs out, folding and in, the flame at full burn.
  const times = [];
  for (let t = 0; t < 26; t += 0.43) times.push(t);
  const legPoses = [1, 0.66, 0.33];
  const flameTris = () => {
    feats.flame.visible = true;
    feats.flame.scale.set(1, 1, 1.08);
    return triangles(feats.flame);
  };
  const legTris = (v) =>
    feats.legs.map((leg) => {
      leg.children[0].scale.setScalar(v);
      leg.children[0].visible = true;
      return triangles(leg);
    });
  const flame = flameTris();
  const legs = legPoses.map(legTris);
  const found = new Map();
  const note = (key, p) => {
    if (!found.has(key)) found.set(key, p);
  };
  const ids = [...parts.keys()];
  const cache = new Map();
  for (const t of times) {
    ship.update(t, 0.016);
    hull.rotation.z = 0;
    for (const leg of feats.legs) leg.children[0].visible = false;
    feats.flame.visible = false;
    const tris = new Map();
    for (const id of ids) {
      const t0 = triangles(parts.get(id));
      const prev = cache.get(id);
      // Skip a static part's checks after the first pose.
      const same =
        prev && prev.length === t0.length && prev.every((x, k) => x === t0[k]);
      cache.set(id, t0);
      tris.set(id, { tris: t0, moved: !prev || !same });
    }
    for (let a = 0; a < ids.length; a++) {
      const A = tris.get(ids[a]);
      for (let b = a + 1; b < ids.length; b++) {
        const B = tris.get(ids[b]);
        if (!A.moved && !B.moved) continue;
        const key = `${ids[a]} × ${ids[b]}`;
        if (found.has(key)) continue;
        const p = touch(A.tris, B.tris, 0.025);
        if (p) note(key, `${fmt(p)} at t=${t.toFixed(2)}`);
      }
      if (!A.moved) continue;
      for (const [kind, ft] of Object.entries(feats)) {
        if (kind === 'legs' || kind === 'flame') continue;
        const key = `${ids[a]} × ${kind}`;
        if (found.has(key)) continue;
        const p = touch(A.tris, ft, 0.025);
        if (p) note(key, `${fmt(p)} at t=${t.toFixed(2)}`);
      }
      legs.forEach((set, k) => {
        const key = `${ids[a]} × legs`;
        if (found.has(key)) return;
        for (const leg of set) {
          const p = touch(A.tris, leg, 0.025);
          if (p) {
            note(key, `${fmt(p)} at t=${t.toFixed(2)}, legs ${legPoses[k]}`);
            return;
          }
        }
      });
      {
        const key = `${ids[a]} × flame`;
        if (!found.has(key)) {
          const p = touch(A.tris, flame, 0.03);
          if (p) note(key, `${fmt(p)} at t=${t.toFixed(2)}`);
        }
      }
    }
  }
  // One part sunk whole inside another never cuts its surface; look for that too.
  ship.update(0, 0.016);
  hull.rotation.z = 0;
  for (const a of ids)
    for (const b of ids) {
      if (a === b) continue;
      const n = inside(triangles(parts.get(a)), triangles(parts.get(b)));
      if (n > 2) found.set(`${a} inside ${b}`, `${n} points`);
    }
  for (const [k, where] of found)
    if (k.endsWith('studs'))
      console.log(
        `  · ${k.replace('studs', 'a stripe rivet')} at ${where} (under its bracket)`,
      );
    else if (MOUNTED[k]) console.log(`  · ${k}: ${MOUNTED[k]}`);
    else fail(`${k} at ${where}`);
  if (![...found.keys()].some((k) => !k.endsWith('studs') && !MOUNTED[k]))
    console.log(
      `  ✓ ${ids.length} parts, ${times.length} poses, legs ${legPoses.join(' / ')}: nothing else touches`,
    );
  // The bounds the base docks the ship by must hold the whole kit.
  for (const v of legPoses) {
    for (const leg of feats.legs) {
      leg.children[0].scale.setScalar(v);
      leg.children[0].visible = true;
    }
  }
  ship.setLanded(1);
  ship.setThrust(0);
  const box = new THREE.Box3();
  for (const t of times) {
    ship.update(t, 0.016);
    hull.rotation.z = 0;
    box.union(new THREE.Box3().setFromObject(ship.group, true));
  }
  for (const r of [-0.04, 0.04]) {
    hull.rotation.z = r;
    ship.group.updateMatrixWorld(true);
    box.union(new THREE.Box3().setFromObject(ship.group, true));
  }
  if (!shipBounds.containsBox(box))
    fail(
      `shipBounds ${fmt(shipBounds.min.toArray())} → ${fmt(shipBounds.max.toArray())} misses the kit ${fmt(box.min.toArray())} → ${fmt(box.max.toArray())}`,
    );
  else
    console.log(
      `  ✓ shipBounds hold the full kit (${fmt(box.min.toArray())} → ${fmt(box.max.toArray())})`,
    );
  ship.dispose();
}

// ——— The base ———

async function checkBase() {
  const { buildBase, baseModules, baseLayout } =
    await import('../components/game/alto/alto-base.ts');
  console.log('Base: modules, hub, pad, walkways and the docked ship');
  const base = buildBase('#3a86ff');
  base.setModules(baseModules);
  const layout = baseLayout(base);
  const { position, scale, yaw } = base.dock;
  console.log(
    `  dock ${fmt(position.toArray())}, scale ${scale}, yaw ${yaw.toFixed(3)}; reach ${base.reach.toFixed(2)}`,
  );
  const times = [0, 1.3, 2.9, 4.4, 7.7, 11.2];
  const found = new Map();
  for (const t of times) {
    base.update(t, 0.016);
    const pieces = layout.pieces.map((p) => ({
      name: p.name,
      tris: triangles(p.object),
    }));
    // The docked ship: its whole kit's bounds, as a solid box.
    const ship = shipBounds.clone().expandByScalar(0.02);
    for (let a = 0; a < pieces.length; a++) {
      for (let b = a + 1; b < pieces.length; b++) {
        const key = `${pieces[a].name} × ${pieces[b].name}`;
        if (found.has(key) || layout.joined(pieces[a].name, pieces[b].name))
          continue;
        const p = touch(pieces[a].tris, pieces[b].tris, 0.04);
        if (p) found.set(key, `${fmt(p)} at t=${t}`);
      }
      const key = `${pieces[a].name} × docked ship`;
      if (found.has(key)) continue;
      const tr = pieces[a].tris;
      const v = new THREE.Vector3();
      for (let i = 0; i < tr.length; i += 3)
        if (
          ship.containsPoint(
            v.set(tr[i], tr[i + 1], tr[i + 2]).applyMatrix4(layout.toShip),
          )
        ) {
          found.set(key, `${fmt(v.toArray())} at t=${t}`);
          break;
        }
    }
  }
  for (const [k, where] of found) fail(`${k} at ${where}`);
  if (!found.size)
    console.log(
      `  ✓ ${layout.pieces.length} pieces, ${times.length} poses: no contact`,
    );
  // Any module may land in any slot, so each slot keeps a clear room (a
  // cylinder MODEL_R wide, MODEL_H tall on its plate) that every model fits
  // and nothing else enters.
  const { slots, room } = layout;
  const roomOf = (i) => ({ ...slots[i], r: room.r, h: room.h });
  const inRoom = (q, x, y, z, pad = 0) =>
    Math.hypot(x - q.x, z - q.z) < q.r + pad &&
    y > q.y + 0.001 &&
    y < q.y + q.h;
  let roomy = true;
  for (const t of [...times, 0.6, 2.2, 3.5, 5.3, 6.1, 9.4, 13.7, 17.9]) {
    base.update(t, 0.016);
    for (const { name, object } of layout.pieces) {
      if (!name.startsWith('module')) continue;
      const q = roomOf(Number(name.split(' ')[1]));
      const tr = triangles(object);
      for (let i = 0; i < tr.length; i += 3) {
        const [x, y, z] = [tr[i], tr[i + 1], tr[i + 2]];
        if (
          Math.hypot(x - q.x, z - q.z) > q.r + 0.002 ||
          y < q.y - 0.002 ||
          y > q.y + q.h + 0.002
        ) {
          fail(`${name} leaves its room at ${fmt([x, y, z])}, t=${t}`);
          roomy = false;
          break;
        }
      }
    }
  }
  base.update(0, 0.016);
  const others = layout.pieces.filter((p) => !p.name.startsWith('module'));
  for (let s = 0; s < slots.length; s++) {
    const q = roomOf(s);
    for (const { name, object } of others) {
      if (name === `plate ${s}`) continue;
      const tr = triangles(object);
      // Vertices, and points along every edge, so long thin parts count too.
      let hit = null;
      for (let i = 0; i < tr.length && !hit; i += 9)
        for (let e = 0; e < 3 && !hit; e++) {
          const a = i + e * 3;
          const b = i + ((e + 1) % 3) * 3;
          const len = Math.hypot(
            tr[b] - tr[a],
            tr[b + 1] - tr[a + 1],
            tr[b + 2] - tr[a + 2],
          );
          const n = Math.max(1, Math.ceil(len / 0.01));
          for (let k = 0; k <= n && !hit; k++) {
            const u = k / n;
            const x = tr[a] + (tr[b] - tr[a]) * u;
            const y = tr[a + 1] + (tr[b + 1] - tr[a + 1]) * u;
            const z = tr[a + 2] + (tr[b + 2] - tr[a + 2]) * u;
            if (inRoom(q, x, y, z)) hit = [x, y, z];
          }
        }
      if (hit) {
        fail(`${name} enters slot ${s}'s room at ${fmt(hit)}`);
        roomy = false;
      }
    }
    // The docked ship's box.
    for (let k = 0; k < 400; k++) {
      const a = (k / 400) * Math.PI * 2 * 7;
      const r = q.r * Math.sqrt((k % 20) / 19);
      const v = new THREE.Vector3(
        q.x + Math.cos(a) * r,
        q.y + (q.h * (k % 13)) / 12,
        q.z + Math.sin(a) * r,
      );
      if (shipBounds.containsPoint(v.applyMatrix4(layout.toShip))) {
        fail(`the docked ship enters slot ${s}'s room`);
        roomy = false;
        break;
      }
    }
    for (let o = s + 1; o < slots.length; o++)
      if (Math.hypot(slots[o].x - q.x, slots[o].z - q.z) < 2 * q.r)
        fail(`slots ${s} and ${o} share room`);
  }
  if (roomy)
    console.log(
      `  ✓ every model stays in its slot's room; nothing else enters any of the ${slots.length} rooms`,
    );
  // Everything, the docked ship's box included, lies within `reach`.
  let far = 0;
  const all = triangles(base.group);
  for (let i = 0; i < all.length; i += 3)
    far = Math.max(far, Math.hypot(all[i], all[i + 1], all[i + 2]));
  const sb = ship_box(base);
  for (let k = 0; k < 8; k++)
    far = Math.max(
      far,
      Math.hypot(
        k & 1 ? sb.max.x : sb.min.x,
        k & 2 ? sb.max.y : sb.min.y,
        k & 4 ? sb.max.z : sb.min.z,
      ),
    );
  if (far > base.reach)
    fail(
      `reach ${base.reach.toFixed(2)} is under the base's extent ${far.toFixed(2)}`,
    );
  else
    console.log(
      `  ✓ reach ${base.reach.toFixed(2)} holds everything (farthest ${far.toFixed(2)})`,
    );
  // Triangles and draws as modules are added.
  for (const n of [0, 3, 6, 12, 16]) {
    base.setModules(baseModules.slice(0, n));
    base.update(1, 0.016);
    let tris = 0;
    let draws = 0;
    base.group.traverse((o) => {
      if (!o.isMesh) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      const g = o.geometry;
      tris +=
        ((g.index ? g.index.count : g.getAttribute('position').count) / 3) *
        (o.isInstancedMesh ? o.count : 1);
      draws++;
    });
    console.log(
      `  ${String(n).padStart(2)} modules: ${tris.toLocaleString('en')} triangles, ${draws} draws`,
    );
  }
  base.dispose();
}
const ship_box = (base) => {
  const { position, scale, yaw } = base.dock;
  return shipBounds
    .clone()
    .applyMatrix4(
      new THREE.Matrix4().compose(
        position,
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw,
        ),
        new THREE.Vector3(scale, scale, scale),
      ),
    );
};

if (which === 'all' || which === 'ship') await checkShip();
if (which === 'all' || which === 'base') await checkBase();
if (failures) {
  console.log(`${failures} collision${failures > 1 ? 's' : ''}`);
  process.exit(1);
}
console.log('No collisions.');
