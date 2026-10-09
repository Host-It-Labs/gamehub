"""Signed-distance sculpting for the Pirate (figure id `pirate`).

A small vectorised modelling language for authored organic forms: shaped
primitives (ellipsoids, round cones, generalised limbs with authored
cross-sections and surface detail) combined in order with smooth unions,
smooth subtractions and spatially varying blend radii, then polygonised
once by OpenVDB. One connected surface carries the transitions a sculptor
would model (shoulder into chest, palm into fingers, jaw into neck)
instead of intersecting primitives that a remesh glues together.

Each operation names a surface group ("skin", "shirt", ...). Groups only
decide the material of each face afterwards (`classify`); the shape is the
ordered combination of every operation.
"""
import math

import numpy as np

F = np.float32


def vec(a):
    return np.asarray(a, dtype=np.float64)


def smin(a, b, k):
    """Polynomial smooth minimum; k may be an array (spatially varying)."""
    if np.isscalar(k) and k <= 0:
        return np.minimum(a, b)
    k = np.maximum(k, 1e-7)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def gauss(x, c, r):
    return np.exp(-((x - c) / r) ** 2)


class Shape:
    """A signed-distance function of an (N, 3) array, with a finite world
    bound (lo, hi) or None for unbounded half-spaces."""

    def __init__(self, fn, lo=None, hi=None):
        self.fn = fn
        self.lo = None if lo is None else vec(lo)
        self.hi = None if hi is None else vec(hi)

    def __call__(self, p):
        return self.fn(p)

    def grown(self, pad):
        if self.lo is None:
            return None, None
        return self.lo - pad, self.hi + pad


def frame(x_axis=None, y_axis=None, z_axis=None):
    """A rotation whose columns are the given orthonormalised axes (two of
    them suffice; the third follows right-handed)."""
    axes = [None if a is None else vec(a) for a in (x_axis, y_axis, z_axis)]
    if axes[2] is None:
        x = axes[0] / np.linalg.norm(axes[0])
        y = axes[1] - x * (axes[1] @ x)
        y /= np.linalg.norm(y)
        z = np.cross(x, y)
    elif axes[1] is None:
        z = axes[2] / np.linalg.norm(axes[2])
        x = axes[0] - z * (axes[0] @ z)
        x /= np.linalg.norm(x)
        y = np.cross(z, x)
    else:
        y = axes[1] / np.linalg.norm(axes[1])
        z = axes[2] - y * (axes[2] @ y)
        z /= np.linalg.norm(z)
        x = np.cross(y, z)
    return np.stack([x, y, z], axis=1)


def ellipsoid(c, r, R=None):
    """Ellipsoid of radii r about centre c; R's columns are its local axes."""
    c, r = vec(c), vec(r)
    R = np.eye(3) if R is None else vec(R)
    ext = np.sqrt((R * R) @ (r * r))
    cf, Rf, rf = c.astype(F), R.astype(F), r.astype(F)

    def fn(p):
        c, R, r = cf, Rf, rf
        q = (p - c) @ R
        k0 = np.sqrt(((q / r) ** 2).sum(1))
        k1 = np.sqrt(((q / (r * r)) ** 2).sum(1))
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
    return Shape(fn, c - ext, c + ext)


def round_cone(a, b, r1, r2):
    """A capsule whose radius runs from r1 at a to r2 at b (exact)."""
    a, b = vec(a), vec(b)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    assert a2 > 0, "round cone radii differ by more than its length"
    il2 = 1.0 / l2
    lo = np.minimum(a - r1, b - r2)
    hi = np.maximum(a + r1, b + r2)
    af, baf = a.astype(F), ba.astype(F)

    def fn(p):
        a, ba = af, baf
        pa = p - a
        y = pa @ ba
        z = y - l2
        xv = pa * l2 - y[:, None] * ba
        x2 = (xv * xv).sum(1)
        y2 = y * y * l2
        z2 = z * z * l2
        k = math.copysign(1, rr) * rr * rr * x2 if rr else np.zeros_like(x2)
        d1 = np.sqrt(x2 + z2) * il2 - r2
        d2 = np.sqrt(x2 + y2) * il2 - r1
        d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
        return np.where(np.sign(z) * a2 * z2 > k, d1,
                        np.where(np.sign(y) * a2 * y2 < k, d2, d3))
    return Shape(fn, lo, hi)


def tube(points, radii):
    """A chain of round cones through points (hard union: equal radii
    meet on a shared sphere, so the chain is continuous)."""
    cones = [round_cone(points[i], points[i + 1], radii[i], radii[i + 1])
             for i in range(len(points) - 1)]
    lo = np.min([c.lo for c in cones], axis=0)
    hi = np.max([c.hi for c in cones], axis=0)

    def fn(p):
        d = cones[0](p)
        for c in cones[1:]:
            d = np.minimum(d, c(p))
        return d
    return Shape(fn, lo, hi)


def rounded_box(c, half, radius, R=None):
    c, half = vec(c), vec(half)
    R = np.eye(3) if R is None else vec(R)
    ext = np.abs(R) @ (half + radius)
    cf, Rf, inner = c.astype(F), R.astype(F), (half - radius).astype(F)

    def fn(p):
        q = np.abs((p - cf) @ Rf) - inner
        outside = np.sqrt((np.maximum(q, 0) ** 2).sum(1))
        inside = np.minimum(q.max(1), 0)
        return outside + inside - radius
    return Shape(fn, c - ext, c + ext)


def half_space(point, normal):
    """Inside behind the plane: negative where (p - point) . n < 0."""
    point, normal = vec(point), vec(normal)
    normal = normal / np.linalg.norm(normal)
    pf, nf = point.astype(F), normal.astype(F)
    return Shape(lambda p: (p - pf) @ nf)


def catmull(points, samples):
    """A centripetal-free uniform Catmull-Rom path through points, sampled
    by arc length into samples + 1 positions."""
    pts = [vec(p) for p in points]
    dense = []
    for i in range(len(pts) - 1):
        a = pts[max(0, i - 1)]
        b, c = pts[i], pts[i + 1]
        d = pts[min(len(pts) - 1, i + 2)]
        for u in np.linspace(0, 1, 40, endpoint=False):
            dense.append(0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u +
                                (-a + 3 * b - 3 * c + d) * u ** 3))
    dense.append(pts[-1])
    dense = np.array(dense)
    seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    want = np.linspace(0, s[-1], samples + 1)
    out = np.stack([np.interp(want, s, dense[:, j]) for j in range(3)], axis=1)
    return out, s[-1]


class Limb:
    """A generalised cylinder: an authored path with elliptical sections
    (half width across, front and back depth) and a detail offset
    detail(t, angle) -> metres, angle 0 at the front, +pi/2 toward `side`.

    The distance is the radial excess over the local section, corrected
    for the section's slope along the path; near the surface (where smooth
    blends and the polygoniser look) it is close to Euclidean.
    """

    def __init__(self, path, sections, detail=None, side=(1, 0, 0),
                 front=(0, 1, 0), samples=48, caps=(True, True), window=4, power=2.0):
        self.S, self.length = catmull(path, samples)
        self.n = samples
        S = self.S
        T = np.gradient(S, axis=0)
        T /= np.linalg.norm(T, axis=1)[:, None]
        Fv = vec(front)[None, :] - T * (T @ vec(front))[:, None]
        Fv /= np.linalg.norm(Fv, axis=1)[:, None]
        X = vec(side)[None, :] - T * (T @ vec(side))[:, None] - Fv * (Fv @ vec(side))[:, None]
        X /= np.linalg.norm(X, axis=1)[:, None]
        self.T, self.X, self.Fv = T.astype(F), X.astype(F), Fv.astype(F)
        self.S = self.S.astype(F)
        ts = np.linspace(0, 1, samples + 1)
        rows = sections if not callable(sections) else None
        if rows is not None:
            cols = list(zip(*rows))
            self.sec = np.stack([np.interp(ts, cols[0], cols[j]) for j in (1, 2, 3)], axis=1)
            # Smooth the linear table once so broad forms carry no bands.
            for _ in range(3):
                pad = np.concatenate([self.sec[:1], self.sec, self.sec[-1:]])
                self.sec = (pad[:-2] + 2 * pad[1:-1] + pad[2:]) / 4
        else:
            self.sec = np.array([sections(t) for t in ts])
        mean = self.sec.mean(1)
        slope = np.gradient(mean, ts) / max(self.length, 1e-6)
        self.corr = (1 / np.sqrt(1 + slope ** 2)).astype(F)
        self.sec = self.sec.astype(F)
        self.detail = detail
        self.power = power
        self.caps = caps
        self.window = window
        big = float(self.sec.max()) + 0.03
        self.lo = self.S.min(0).astype(np.float64) - big
        self.hi = self.S.max(0).astype(np.float64) + big

    def shape(self):
        return Shape(self, self.lo, self.hi)

    def locate(self, p):
        S, n = self.S, self.n
        chord = S[-1] - S[0]
        g = np.clip(((p - S[0]) @ chord) / (chord @ chord), 0, 1)
        i0 = np.clip((g * n).astype(np.int64), 0, n - 1)
        best = np.full(len(p), np.inf)
        bi = np.zeros(len(p), dtype=np.int64)
        bu = np.zeros(len(p))
        for o in range(-self.window, self.window + 1):
            i = np.clip(i0 + o, 0, n - 1)
            a = S[i]
            ab = S[i + 1] - a
            u = np.clip(((p - a) * ab).sum(1) / (ab * ab).sum(1), 0, 1)
            q = p - (a + ab * u[:, None])
            d = (q * q).sum(1)
            m = d < best
            best = np.where(m, d, best)
            bi = np.where(m, i, bi)
            bu = np.where(m, u, bu)
        return bi, bu

    def coords(self, p):
        """(t, angle, radial, axial overshoot, section radius) per point."""
        i, u = self.locate(p)
        w0, w1 = 1 - u, u
        C = self.S[i] * w0[:, None] + self.S[i + 1] * w1[:, None]
        T = self.T[i] * w0[:, None] + self.T[i + 1] * w1[:, None]
        X = self.X[i] * w0[:, None] + self.X[i + 1] * w1[:, None]
        Fv = self.Fv[i] * w0[:, None] + self.Fv[i + 1] * w1[:, None]
        T /= np.linalg.norm(T, axis=1)[:, None]
        X /= np.linalg.norm(X, axis=1)[:, None]
        Fv /= np.linalg.norm(Fv, axis=1)[:, None]
        q = p - C
        x = (q * X).sum(1)
        y = (q * Fv).sum(1)
        ax = (q * T).sum(1)
        t = (i + u) / self.n
        sec = self.sec[i] * w0[:, None] + self.sec[i + 1] * w1[:, None]
        ang = np.arctan2(x, y)
        depth = np.where(y >= 0, sec[:, 1], sec[:, 2])
        if self.power == 2.0:
            rs = 1 / np.sqrt((np.sin(ang) / sec[:, 0]) ** 2 + (np.cos(ang) / depth) ** 2)
        else:
            pw = self.power
            rs = (np.abs(np.sin(ang) / sec[:, 0]) ** pw + np.abs(np.cos(ang) / depth) ** pw) ** (-1 / pw)
        if self.detail is not None:
            rs = rs + self.detail(t, ang)
        corr = self.corr[i] * w0 + self.corr[i + 1] * w1
        radial = np.sqrt(x * x + y * y)
        over = np.full(len(p), -1.0)
        if self.caps[0]:
            over = np.where((i == 0) & (u <= 0), -ax, over)
        if self.caps[1]:
            over = np.where((i == self.n - 1) & (u >= 1), ax, over)
        return t, ang, radial, over, rs, corr

    def __call__(self, p):
        t, ang, radial, over, rs, corr = self.coords(p)
        dr = (radial - rs) * corr
        outside = np.sqrt(np.maximum(dr, 0) ** 2 + np.maximum(over, 0) ** 2)
        inside = np.minimum(np.maximum(dr, over), 0)
        return outside + inside


def limb(*args, **kwargs):
    return Limb(*args, **kwargs).shape()


def displaced(shape, fn, amount):
    """shape minus a displacement field fn(p) (metres, + pushes out); its
    bound grows by `amount`."""
    lo, hi = shape.grown(amount)
    return Shape(lambda p: shape(p) - fn(p), lo, hi)


def shell(shape, inner, outer):
    """The band of space between offsets `inner` and `outer` of a shape."""
    lo, hi = shape.grown(outer)

    def fn(p):
        d = shape(p)
        return np.maximum(d - outer, inner - d)
    return Shape(fn, lo, hi)


def intersect(shape, *masks, k=0.0):
    def fn(p):
        d = shape(p)
        for m in masks:
            d = smax(d, m(p), k)
        return d
    return Shape(fn, shape.lo, shape.hi)


def subtract(shape, *cuts, k=0.0):
    def fn(p):
        d = shape(p)
        for m in cuts:
            d = smax(d, -m(p), k)
        return d
    return Shape(fn, shape.lo, shape.hi)


def union(*shapes, k=0.0):
    lo = np.min([s.lo for s in shapes], axis=0)
    hi = np.max([s.hi for s in shapes], axis=0)

    def fn(p):
        d = shapes[0](p)
        for s in shapes[1:]:
            d = smin(d, s(p), k)
        return d
    return Shape(fn, lo, hi)


class Sculpt:
    """Ordered operations: add (smooth union), cut (smooth subtraction) and
    clip (smooth intersection with a mask). k may be a function of the
    points; `reach` bounds it for culling. Every add names a material
    `group` and an anatomical `part` (for skin weights); cuts and clips
    may name the groups/parts they apply to when classifying (None: all)."""

    def __init__(self, name):
        self.name = name
        self.ops = []

    def add(self, shape, k=0.0, group="body", reach=None, part=None):
        self.ops.append(("add", shape, k, group, reach, part))
        return shape

    def cut(self, shape, k=0.0, group=None, reach=None, part=None):
        self.ops.append(("cut", shape, k, group, reach, part))
        return shape

    def clip(self, shape, k=0.0, group=None, reach=None, part=None):
        self.ops.append(("clip", shape, k, group, reach, part))
        return shape

    @staticmethod
    def _k(k, p):
        return k(p) if callable(k) else k

    def bounds(self):
        los = [op[1].lo for op in self.ops if op[0] == "add" and op[1].lo is not None]
        his = [op[1].hi for op in self.ops if op[0] == "add" and op[1].hi is not None]
        return np.min(los, axis=0), np.max(his, axis=0)

    def evaluate(self, lo, h, dims, band, coarse=4, log=None):
        """The level set on a regular grid as a sparse OpenVDB grid.

        A coarse pass (coarse * h) finds where the surface can be; only
        fine voxels within reach of it are evaluated exactly, slab by slab.
        Everything else keeps the coarse sign at +-band.
        """
        import openvdb as vdb
        lo = vec(lo)
        hc = h * coarse
        dc = tuple(int(math.ceil((dims[j] - 1) / coarse)) + 2 for j in range(3))
        axes_c = [lo[j] + hc * np.arange(dc[j]) for j in range(3)]
        coarse_field = np.empty(dc, dtype=F)
        for i in range(dc[0]):
            gy, gz = np.meshgrid(axes_c[1], axes_c[2], indexing="ij")
            pc = np.stack([np.full(gy.size, axes_c[0][i]), gy.ravel(), gz.ravel()], axis=1)
            coarse_field[i] = self.at(pc).reshape(dc[1], dc[2])
        if log:
            log(f"{self.name}: coarse pass {dc}")
        margin = 1.3 * (hc * math.sqrt(3) + band)
        grid = vdb.FloatGrid(background=float(band))
        slab = 32
        fx = (np.arange(dims[0]) / coarse)
        fy = (np.arange(dims[1]) / coarse)
        ix0, iy0 = fx.astype(np.int64), fy.astype(np.int64)
        tx, ty = (fx - ix0).astype(F), (fy - iy0).astype(F)
        evaluated = 0
        c = coarse_field
        for z0 in range(0, dims[2], slab):
            z1 = min(dims[2], z0 + slab)
            fz = np.arange(z0, z1) / coarse
            iz0 = fz.astype(np.int64)
            tz = (fz - iz0).astype(F)

            def at(i, j, k):
                return c[np.ix_(ix0 + i, iy0 + j, iz0 + k)]
            wx, wy, wz = tx[:, None, None], ty[None, :, None], tz[None, None, :]
            up = ((at(0, 0, 0) * (1 - wx) + at(1, 0, 0) * wx) * (1 - wy) +
                  (at(0, 1, 0) * (1 - wx) + at(1, 1, 0) * wx) * wy) * (1 - wz) + \
                 ((at(0, 0, 1) * (1 - wx) + at(1, 0, 1) * wx) * (1 - wy) +
                  (at(0, 1, 1) * (1 - wx) + at(1, 1, 1) * wx) * wy) * wz
            out = np.where(up < 0, -band, band).astype(F)
            near = np.abs(up) < margin
            del up
            idx = np.nonzero(near)
            del near
            if len(idx[0]):
                for c0 in range(0, len(idx[0]), 400000):
                    sl = slice(c0, c0 + 400000)
                    p = np.stack([lo[0] + h * idx[0][sl], lo[1] + h * idx[1][sl],
                                  lo[2] + h * (idx[2][sl] + z0)], axis=1)
                    d = self.at(p)
                    out[idx[0][sl], idx[1][sl], idx[2][sl]] = np.clip(d, -band, band).astype(F)
                    evaluated += len(p)
            grid.copyFromArray(np.ascontiguousarray(out), ijk=(0, 0, z0), tolerance=0.0)
            if log and (z0 // slab) % 6 == 0:
                log(f"{self.name}: slab {z0}/{dims[2]}, {evaluated} exact voxels")
        grid.transform = vdb.createLinearTransform(voxelSize=float(h))
        return grid

    def at(self, p, only=None):
        """The field at arbitrary points (unclamped). `only(op)` filters ops."""
        p = np.ascontiguousarray(p, dtype=F)
        d = np.full(len(p), 1.0, dtype=F)
        for op in self.ops:
            if only is not None and not only(op):
                continue
            kind, shape, k, group, reach, part = op
            d = self._apply(d, kind, shape, k, reach, p)
        return d

    def _apply(self, d, kind, shape, k, reach, p):
        r = reach if reach is not None else (k if np.isscalar(k) else 0.03)
        if shape.lo is not None and kind != "clip":
            a, b = shape.grown(r + 1e-4)
            m = np.all((p >= a) & (p <= b), axis=1)
            if not m.any():
                return d
            idx = np.flatnonzero(m)
            q = p[idx]
            s = shape(q).astype(F)
            kk = self._k(k, q)
            if kind == "add":
                d[idx] = smin(d[idx], s, kk)
            elif kind == "cut":
                d[idx] = smax(d[idx], -s, kk)
            return d
        s = shape(p).astype(F)
        kk = self._k(k, p)
        if kind == "add":
            return smin(d, s, kk).astype(F)
        if kind == "cut":
            return smax(d, -s, kk).astype(F)
        return smax(d, s, kk).astype(F)

    def classify(self, p, labels, field="group"):
        """Which label's own surface each point lies on (field "group" or
        "part"): every label is evaluated alone (its adds, plus cuts and
        clips that name it or nothing), and the closest wins."""
        j = 3 if field == "group" else 5
        p = np.ascontiguousarray(p, dtype=F)
        out = np.zeros((len(labels), len(p)), dtype=F)
        for gi, g in enumerate(labels):
            def only(op, g=g):
                if op[0] == "add":
                    return op[j] == g
                return op[j] in (None, g)
            out[gi] = np.abs(self.at(p, only))
        return np.argmin(out, axis=0)


def polygonise(grid, lo, log=None):
    """OpenVDB dual contouring of the level set at zero: world vertices,
    triangles and quads."""
    points, tris, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=0.0)
    points = np.asarray(points, dtype=np.float64) + vec(lo)
    if log:
        log(f"polygonised {len(points)} vertices, {len(quads)} quads, {len(tris)} triangles")
    return points, np.asarray(tris), np.asarray(quads)


def ring(c, axis, R_ring, r_tube, squash=1.0):
    """A torus about `axis` through c (major radius R_ring, tube r_tube);
    squash < 1 flattens the tube along the axis."""
    c, axis = vec(c), vec(axis) / np.linalg.norm(axis)
    cf, af = c.astype(F), axis.astype(F)

    def fn(p):
        q = p - cf
        ax = q @ af
        rad = np.sqrt(np.maximum((q * q).sum(1) - ax * ax, 0))
        return np.sqrt((rad - R_ring) ** 2 + (ax / squash) ** 2) * min(1, squash) - r_tube
    e = R_ring + r_tube + .002
    return Shape(fn, c - e, c + e)


def capsule(a, b, r):
    return round_cone(a, b, r, r * 0.9999)


def arc_tube(points, radii):
    """A smooth tube through a Catmull-Rom path of points with radii
    interpolated along it (round cones between dense samples)."""
    path, _ = catmull(points, max(8, 6 * (len(points) - 1)))
    t = np.linspace(0, 1, len(path))
    rr = np.interp(t, np.linspace(0, 1, len(radii)), radii)
    return tube(list(path), list(rr))


def mesh_arrays(sculpt, h, band=None, lo=None, hi=None, log=print):
    """Evaluate and polygonise a sculpt without Blender: (points, quads,
    triangles) in world metres."""
    band = band or 3 * h
    if lo is None or hi is None:
        blo, bhi = sculpt.bounds()
        lo = blo if lo is None else vec(lo)
        hi = bhi if hi is None else vec(hi)
    lo = vec(lo) - 3 * h
    hi = vec(hi) + 3 * h
    dims = tuple(int(math.ceil((hi[j] - lo[j]) / h)) + 1 for j in range(3))
    log(f"{sculpt.name}: grid {dims} at {h * 1000:.2f} mm")
    grid = sculpt.evaluate(lo, h, dims, band, log=log)
    points, tris, quads = polygonise(grid, lo, log=log)
    del grid
    return points, quads, tris


def mesh_from_arrays(name, points, quads, tris):
    import bpy
    me = bpy.data.meshes.new(name)
    faces = [tuple(int(i) for i in q) for q in quads] + [tuple(int(i) for i in t) for t in tris]
    me.from_pydata(np.asarray(points).tolist(), [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    nrm = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("normal", nrm)
    area = np.empty(len(me.polygons))
    me.polygons.foreach_get("area", area)
    starts = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get("loop_start", starts)
    loops = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", loops)
    first = loops[starts]
    vol = (co.reshape(-1, 3)[first] * nrm.reshape(-1, 3)).sum(1) @ area / 3
    if vol < 0:
        me.flip_normals()
        me.update()
    me.shade_smooth()
    return obj


def build_mesh(name, sculpt, h, band=None, lo=None, hi=None, log=print):
    """Evaluate a sculpt and return a Blender mesh object (quads), with a
    face attribute naming each face's group index."""
    import bpy
    import bmesh  # noqa: F401  (Blender module availability)
    band = band or 3 * h
    if lo is None or hi is None:
        blo, bhi = sculpt.bounds()
        lo = blo if lo is None else vec(lo)
        hi = bhi if hi is None else vec(hi)
    lo = vec(lo) - 3 * h
    hi = vec(hi) + 3 * h
    dims = tuple(int(math.ceil((hi[j] - lo[j]) / h)) + 1 for j in range(3))
    log(f"{name}: grid {dims} at {h * 1000:.2f} mm")
    grid = sculpt.evaluate(lo, h, dims, band, log=log)
    points, tris, quads = polygonise(grid, lo, log=log)
    del grid
    me = bpy.data.meshes.new(name)
    faces = [tuple(int(i) for i in q) for q in quads] + [tuple(int(i) for i in t) for t in tris]
    me.from_pydata(points.tolist(), [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    # Face outward: the signed volume of a closed outward mesh is positive.
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    nrm = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("normal", nrm)
    area = np.empty(len(me.polygons))
    me.polygons.foreach_get("area", area)
    starts = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get("loop_start", starts)
    loops = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", loops)
    first = loops[starts]
    vol = (co.reshape(-1, 3)[first] * nrm.reshape(-1, 3)).sum(1) @ area / 3
    if vol < 0:
        me.flip_normals()
        me.update()
    me.shade_smooth()
    return obj
