"""Modelling helpers for the collector Dino (figure_ogre.py).

Organic parts are loft cages (rings of points joined by quads) smoothed by
subdivision, sculpted by displacement functions, thinned by a symmetric
decimate and then painted: a material function of position splits the mesh
along smooth curves (belly line, dorsal saddle, stripes), so colour
boundaries stay clean whatever the triangle count. Scales, scutes, teeth and
claws are small crisp shells laid on the finished surface.

Rings are given in a local frame: `side` (the part's width axis, usually x),
`up` (the ring's "top") and a centre; ring points are (side, up) pairs,
counter-clockwise from +side, every ring of a cage with the same count.
"""

import math

import bmesh
import bpy
import kit
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


# ---------------------------------------------------------------- rings

def ellipse(w, ht, hb=None, angles=None, power=2.0, pinch=0.0, keel=0.0):
    """Points on a superellipse of half-width w, half-height ht above and hb
    below. `pinch` narrows the upper half (a back narrower than the belly),
    `keel` the lower half."""
    hb = ht if hb is None else hb
    angles = angles if angles is not None else [i * 30 for i in range(12)]
    e = 2.0 / power
    pts = []
    for a in angles:
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        x = math.copysign(abs(ca) ** e, ca) * w
        y = math.copysign(abs(sa) ** e, sa) * (ht if sa >= 0 else hb)
        if sa > 0:
            x *= 1 - pinch * sa
        else:
            x *= 1 + keel * sa
        pts.append((x, y))
    return pts


def ring(centre, up, pts, side=X):
    up = Vector(up).normalized()
    side = Vector(side)
    side = (side - up * side.dot(up)).normalized()
    return {"c": Vector(centre), "side": side, "up": up, "pts": pts}


def ring_tb(top, bottom, shape, x=0.0, side=X):
    """A ring from its side-view top and bottom points (y, z); `shape(h)`
    gives its points for the half-height h."""
    t = Vector((x, top[0], top[1]))
    b = Vector((x, bottom[0], bottom[1]))
    return ring((t + b) / 2, (t - b).normalized(), shape((t - b).length / 2),
                side)


def world(r, p):
    return r["c"] + r["side"] * p[0] + r["up"] * p[1]


def centre_of(r):
    pts = [world(r, p) for p in r["pts"]]
    return sum(pts, Vector()) / len(pts)


# ---------------------------------------------------------------- cages

STRIP8 = [(1, 2, 3, 4), (0, 1, 4, 5), (5, 6, 7, 0)]
STRIP12 = [(1, 2, 3, 4, 5), (0, 1, 5, 6), (11, 0, 6, 7), (7, 8, 9, 10, 11)]


def loft(name, rings, mats, face_mat=None, start=None, end=None,
         start_mat=0, end_mat=0, extra=None, creases=()):
    """Join rings with quads into one closed cage (see dino_kit.loft).
    creases are (k0, k1, i, value): the edges along ring point i from ring
    k0 to ring k1 hold a subdivision crease (a crisp lip or brow line)."""
    bm = bmesh.new()
    vrings = [[bm.verts.new(world(r, p)) for p in r["pts"]] for r in rings]
    n = len(vrings[0])
    for k in range(len(vrings) - 1):
        a, b = vrings[k], vrings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = face_mat(k, i) if face_mat else 0
    if creases:
        cl = bm.edges.layers.float.new("crease_edge")
        for k0, k1, i, value in creases:
            for k in range(k0, k1):
                e = bm.edges.get((vrings[k][i], vrings[k + 1][i]))
                if e:
                    e[cl] = value

    def cap(vs, spec, r, mat):
        if spec is None:
            return
        kind = spec[0]
        polys = []
        if kind == "dome":
            c = bm.verts.new(centre_of(r) + Vector(spec[1]))
            polys = [(vs[k], vs[k + 1], vs[(k + 2) % n], c)
                     for k in range(0, n, 2)]
        elif kind == "strip":
            polys = [tuple(vs[i] for i in q)
                     for q in (STRIP8 if n == 8 else STRIP12)]
        for q, poly in enumerate(polys):
            f = bm.faces.new(poly)
            f.material_index = mat[q] if isinstance(mat, (list, tuple)) \
                else mat

    cap(vrings[0], start, rings[0], start_mat)
    cap(vrings[-1], end, rings[-1], end_mat)
    if extra:
        extra(bm, vrings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm)
    for m in mats:
        obj.data.materials.append(kit.material(m))
    return obj


def tube(name, pts, radii, mat, n=6, side=X, squash=None):
    """A round cage through points with a radius per point."""
    pts = [Vector(p) for p in pts]
    rings = []
    for k, p in enumerate(pts):
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        s = Vector(side)
        s = (s - t * s.dot(t)).normalized()
        up = s.cross(t).normalized()
        r = radii[k]
        h = r * (squash[k] if squash else 1.0)
        rings.append(ring(p, up, ellipse(r, h, h, [i * 360 / n
                                                   for i in range(n)]), s))
    t0 = (pts[0] - pts[1]).normalized()
    t1 = (pts[-1] - pts[-2]).normalized()
    return loft(name, rings, [mat], start=("dome", t0 * radii[0] * 0.8),
                end=("dome", t1 * radii[-1] * 0.9))


# ---------------------------------------------------------------- mesh ops

def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def arrays(obj):
    me = obj.data
    n = len(me.vertices)
    co = np.zeros(n * 3)
    me.vertices.foreach_get("co", co)
    no = np.zeros(n * 3)
    me.vertex_normals.foreach_get("vector", no)
    return co.reshape(n, 3), no.reshape(n, 3)


def set_co(obj, co):
    obj.data.vertices.foreach_set("co", np.asarray(co).reshape(-1))
    obj.data.update()


def subdivide(obj, level=2):
    kit.add_subsurf(obj, level)
    kit.apply(obj)
    return obj


def displace(obj, fn):
    """Move each vertex by fn(co, no): along its normal for an array of
    numbers, or by the vectors of an (n, 3) array."""
    co, no = arrays(obj)
    off = fn(co, no)
    if off.ndim == 1:
        off = no * off[:, None]
    set_co(obj, co + off)
    return obj


def decimate(obj, target, symmetric=True):
    """Collapse towards `target` triangles, symmetric in x (for parts on the
    midline), never moving a vertex that sits on a material boundary."""
    if tris(obj) <= target:
        return obj
    me = obj.data
    mod = obj.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / tris(obj)
    mod.use_symmetry = symmetric
    mod.symmetry_axis = "X"
    if len(me.materials) > 1:
        owner = {}
        for p in me.polygons:
            for vi in p.vertices:
                owner.setdefault(vi, set()).add(p.material_index)
        edge = [vi for vi, s in owner.items() if len(s) > 1]
        if edge:
            vg = obj.vertex_groups.new(name="boundary")
            vg.add(edge, 1.0, "REPLACE")
            mod.vertex_group = "boundary"
            mod.invert_vertex_group = True
            mod.vertex_group_factor = 50.0
    kit.apply(obj)
    for g in list(obj.vertex_groups):
        obj.vertex_groups.remove(g)
    return obj


def flatten_below(obj, z0=0.0):
    co, _ = arrays(obj)
    co[:, 2] = np.maximum(co[:, 2], z0)
    set_co(obj, co)
    return obj


def bump(P, c, r, amp):
    """A gaussian bump (array of offsets) centred at c with radii r (a
    number or three per-axis radii)."""
    r = np.broadcast_to(np.asarray(r, dtype=float), (3,))
    d = (P - np.asarray(c)) / r
    return amp * np.exp(-np.sum(d * d, axis=1))


def bump2(P, c, r, amp):
    """The same bump mirrored in x (a pair on both sides)."""
    c = np.asarray(c, dtype=float)
    m = c.copy()
    m[0] = -m[0]
    return bump(P, c, r, amp) + bump(P, m, r, amp)


def groove(P, a, b, w, depth):
    """A rounded groove (negative offsets) along the segment a-b."""
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    d = b - a
    t = np.clip(((P - a) @ d) / max(d @ d, 1e-12), 0.0, 1.0)
    q = a + t[:, None] * d
    r = np.linalg.norm(P - q, axis=1)
    fade = np.sin(np.pi * np.clip(t, 0, 1)) ** 0.5
    return -depth * np.exp(-(r / w) ** 2) * fade


def groove2(P, a, b, w, depth):
    m = np.array([-1.0, 1.0, 1.0])
    return groove(P, a, b, w, depth) + groove(P, np.asarray(a) * m,
                                              np.asarray(b) * m, w, depth)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- spines

class Spine:
    """Tube coordinates about a part's centreline: s (length along it),
    theta (degrees round it: 0 right side, 90 top, 270 bottom) and r."""

    def __init__(self, rings, steps=3):
        cs = [centre_of(r) for r in rings]
        ups = [r["up"] for r in rings]
        sides = [r["side"] for r in rings]
        C, U, S = [], [], []
        for k in range(len(cs) - 1):
            for q in range(steps):
                f = q / steps
                C.append(cs[k].lerp(cs[k + 1], f))
                U.append(ups[k].lerp(ups[k + 1], f).normalized())
                S.append(sides[k].lerp(sides[k + 1], f).normalized())
        C.append(cs[-1])
        U.append(ups[-1])
        S.append(sides[-1])
        self.C = np.array([c[:] for c in C])
        self.U = np.array([u[:] for u in U])
        self.S = np.array([s[:] for s in S])
        seg = np.linalg.norm(self.C[1:] - self.C[:-1], axis=1)
        self.seg = seg
        self.cum = np.concatenate([[0.0], np.cumsum(seg)])
        self.length = float(self.cum[-1])

    def coords(self, P):
        P = np.asarray(P, dtype=float).reshape(-1, 3)
        A, B = self.C[:-1], self.C[1:]
        D = B - A
        L2 = np.maximum(np.sum(D * D, axis=1), 1e-12)
        AP = P[:, None, :] - A[None, :, :]
        t = np.clip(np.sum(AP * D[None], axis=2) / L2[None], 0.0, 1.0)
        Q = A[None] + t[..., None] * D[None]
        d2 = np.sum((P[:, None, :] - Q) ** 2, axis=2)
        j = np.argmin(d2, axis=1)
        idx = np.arange(len(P))
        tj = t[idx, j]
        q = Q[idx, j]
        s = self.cum[j] + tj * self.seg[j]
        up = self.U[j] * (1 - tj)[:, None] + self.U[j + 1] * tj[:, None]
        sd = self.S[j] * (1 - tj)[:, None] + self.S[j + 1] * tj[:, None]
        d = P - q
        th = np.degrees(np.arctan2(np.sum(d * up, axis=1),
                                   np.sum(d * sd, axis=1))) % 360.0
        return s, th, np.linalg.norm(d, axis=1)

    def at(self, s):
        """Centre, up, side and tangent at length s."""
        s = min(max(s, 0.0), self.length - 1e-6)
        j = int(np.searchsorted(self.cum, s, side="right") - 1)
        j = min(max(j, 0), len(self.seg) - 1)
        f = (s - self.cum[j]) / max(self.seg[j], 1e-9)
        c = Vector(self.C[j] * (1 - f) + self.C[j + 1] * f)
        up = Vector(self.U[j] * (1 - f) + self.U[j + 1] * f).normalized()
        sd = Vector(self.S[j] * (1 - f) + self.S[j + 1] * f).normalized()
        tg = Vector(self.C[j + 1] - self.C[j]).normalized()
        return c, up, sd, tg

    def point(self, s, theta, far=1.5):
        """A ray origin and direction reaching the surface at (s, theta)
        from the centreline."""
        c, up, sd, _ = self.at(s)
        a = math.radians(theta)
        d = (sd * math.cos(a) + up * math.sin(a)).normalized()
        return c, d


def dorsal(th):
    """Angle from the top (0 on the spine, 180 on the belly)."""
    return np.abs((th - 90.0 + 180.0) % 360.0 - 180.0)


def arc(th, c):
    """Signed angle (degrees) from c to th, in [-180, 180)."""
    return (th - c + 180.0) % 360.0 - 180.0


def mass(s, th, s0, th0, ls, lth, amp, p=2.0):
    """A muscle mass in tube coordinates centred at length s0 and angle
    th0, with half-widths ls (length) and lth (degrees): a gaussian for
    p=2, a fuller belly with a defined edge for larger p."""
    q = ((s - s0) / ls) ** 2 + (arc(th, th0) / lth) ** 2
    return amp * np.exp(-q ** (p / 2))


def seam(s, th, s0, s1, th0, lth, depth, taper=0.35):
    """A groove (negative offsets) along a line of constant angle th0 from
    s0 to s1, fading in and out over `taper` of its length."""
    f = np.clip((s - s0) / max(s1 - s0, 1e-9), 0.0, 1.0)
    fade = smoothstep(0.0, taper, f) * smoothstep(1.0, 1.0 - taper, f)
    inside = (s >= s0) & (s <= s1)
    return -depth * np.exp(-(arc(th, th0) / lth) ** 2) * fade * inside


# ---------------------------------------------------------------- painting

def paint(obj, mats, fn, lock=(), iters=12, refine=0):
    """Split the mesh where fn (an array of indices into `mats` for an array
    of points) changes, then give every face the material fn gives its
    centre. Faces whose material is in `lock` keep it."""
    me = obj.data
    names = [m.name for m in me.materials]
    for m in mats:
        if m not in names:
            me.materials.append(kit.material(m))
            names.append(m)
    slot = np.array([names.index(m) for m in mats])
    locked = {names.index(m) for m in lock if m in names}
    bm = bmesh.new()
    bm.from_mesh(me)

    def free(f):
        return f.material_index not in locked

    for _ in range(refine):
        # Split the faces a boundary crosses, so small shapes stay round.
        bm.verts.index_update()
        co = np.array([v.co[:] for v in bm.verts])
        val = fn(co)
        edges = set()
        for f in bm.faces:
            if free(f) and len({val[v.index] for v in f.verts}) > 1:
                edges.update(f.edges)
        if edges:
            bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=1,
                                      use_grid_fill=True)
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    co = np.array([v.co[:] for v in bm.verts])
    val = fn(co)

    cut = [e for e in bm.edges
           if val[e.verts[0].index] != val[e.verts[1].index]
           and any(free(f) for f in e.link_faces)]
    if cut:
        A = np.array([e.verts[0].co[:] for e in cut])
        B = np.array([e.verts[1].co[:] for e in cut])
        va = np.array([val[e.verts[0].index] for e in cut])
        lo = np.zeros(len(cut))
        hi = np.ones(len(cut))
        for _ in range(iters):
            mid = (lo + hi) / 2
            same = fn(A + (B - A) * mid[:, None]) == va
            lo = np.where(same, mid, lo)
            hi = np.where(same, hi, mid)
        t = np.clip((lo + hi) / 2, 0.04, 0.96)
        new = set()
        for e, f in zip(cut, t):
            _, nv = bmesh.utils.edge_split(e, e.verts[0], float(f))
            new.add(nv)
        for f in list(bm.faces):
            if not free(f):
                continue
            vs = [v for v in f.verts if v in new]
            if len(vs) == 2:
                try:
                    bmesh.utils.face_split(f, vs[0], vs[1])
                except (ValueError, RuntimeError):
                    pass
            elif len(vs) > 2:
                bmesh.ops.connect_verts(bm, verts=vs)
    faces = [f for f in bm.faces if free(f)]
    if faces:
        C = np.array([f.calc_center_median()[:] for f in faces])
        k = fn(C)
        for f, ki in zip(faces, k):
            f.material_index = int(slot[ki])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces
                                     if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()
    me.update()
    return obj


# ---------------------------------------------------------------- placement

def tree(objs):
    kit.refresh()
    bm = bmesh.new()
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def hit(t, origin, direction, far=6.0):
    d = Vector(direction).normalized()
    loc, nrm, _, _ = t.ray_cast(Vector(origin), d, far)
    return loc, nrm


def surface(t, origin, direction):
    """The outermost surface point along a ray from inside the body: cast
    back from far out towards the origin."""
    d = Vector(direction).normalized()
    far = Vector(origin) + d * 2.5
    loc, nrm = hit(t, far, -d, 2.5)
    return loc, nrm


def rotate_about(obj, point, angle, axis="X"):
    kit.apply_transform(obj)
    p = Vector(point)
    m = Matrix.Translation(p) @ Matrix.Rotation(angle, 4, axis) @ \
        Matrix.Translation(-p)
    obj.data.transform(m)
    obj.data.update()
    return obj


def _mesh(name, verts, faces, mats, face_mats):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f, m in zip(faces, face_mats):
        try:
            face = bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue
        face.material_index = m
    obj = kit._from_bmesh(name, bm)
    for m in mats:
        obj.data.materials.append(kit.material(m))
    return obj


def _frame(n, along):
    n = Vector(n).normalized()
    t = Vector(along)
    t = (t - n * t.dot(n)).normalized()
    return n, t, n.cross(t)


def _project(t, origin, p, n, far=0.6):
    """Put p on the surface: radially out from `origin` when given, else
    down the normal."""
    if origin is not None:
        loc, nrm = surface(t, origin, p - Vector(origin))
    else:
        loc, nrm = hit(t, p + n * 0.25, -n, far)
    if loc is None:
        return p, n
    return loc, nrm.normalized()


def panel(name, t, sp, sa, sb, tha, thb, h, mats, gap=0.012, keel=1.25,
          inner=0.87, sink=0.01, round_=0.16):
    """An armour panel covering the cell s in [sa, sb], theta in [tha, thb]
    of a spine's tube coordinates, less a groove of `gap` all round: a
    gently keeled top (mats[0]) and a bevelled edge (mats[1]) sinking into
    the skin. Its corners are rounded by `round_`."""
    sm, thm = (sa + sb) / 2, (tha + thb) / 2
    o, d = sp.point(sm, thm)
    c, cn = surface(t, o, d)
    if c is None:
        return None
    r = max((c - o).length, 0.05)
    gs = gap / 2
    gt = math.degrees(gap / 2 / r) * (1 if thb > tha else -1)
    s0, s1 = sa + gs, sb - gs
    t0, t1 = tha + gt, thb - gt
    # Eight outline points: corners (pulled in) and edge middles, going
    # round the cell.
    cells = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1),
             (1, -1)]
    outline = []
    for u, v in cells:
        k = 1 - round_ if (u and v) else 1.0
        outline.append((sm + (s1 - sm) * u * k, thm + (t1 - thm) * v * k))

    def put(ss, th, lift):
        oo, dd = sp.point(ss, th)
        q, qn = surface(t, oo, dd)
        if q is None:
            q, qn = oo + dd * r, dd
        return q + qn.normalized() * lift

    verts = [c + cn.normalized() * h * keel]
    verts += [put(sm + (ss - sm) * inner, thm + (th - thm) * inner, h)
              for ss, th in outline]
    verts += [put(ss, th, -sink) for ss, th in outline]
    faces, fm = [], []
    for i in range(8):
        j = (i + 1) % 8
        faces.append((0, 1 + i, 1 + j))
        fm.append(0)
        faces.append((1 + i, 9 + i, 9 + j, 1 + j))
        fm.append(1)
    obj = _mesh(name, verts, faces, mats, fm)
    _outward(obj, o)
    return obj


def band(name, t, sp, s, th0, th1, a, h, mats, n=7, sink=0.01):
    """A ventral scale band wrapped round the body at length s, from angle
    th0 to th1: a raised strip of half-width a along the body whose
    bevelled edges (mats[1]) run into the skin."""
    rows = []
    for m in range(n):
        f = m / (n - 1)
        th = th0 + (th1 - th0) * f
        lift = h * math.sin(math.pi * f) ** 0.35
        col = []
        for ds, up in ((-a, -sink), (-a * 0.55, lift), (a * 0.55, lift),
                       (a, -sink)):
            o, d = sp.point(s + ds, th)
            loc, nrm = surface(t, o, d)
            if loc is None:
                loc, nrm = o + d * 0.3, d
            col.append(loc + nrm.normalized() * up)
        rows.append(col)
    verts = [v for col in rows for v in col]
    faces, fm = [], []
    for m in range(n - 1):
        for q in range(3):
            i0, i1 = m * 4 + q, (m + 1) * 4 + q
            faces.append((i0, i0 + 1, i1 + 1, i1))
            fm.append(0 if q == 1 else 1)
    obj = _mesh(name, verts, faces, mats, fm)
    c, _, _, _ = sp.at(s)
    _outward(obj, c)
    return obj


def s_of(sp, p):
    """A point's length along a spine."""
    return float(sp.coords(np.array([Vector(p)[:]]))[0][0])


def scute(name, t, c, n, along, L, W, H, mats, sweep=0.35, tip=0.42,
          origin=None, sink=0.012):
    """A keeled scute: a leaf-shaped base on the skin rising to a point
    swept back (against `along`); the upper `tip` fraction in mats[1]."""
    n, tt, ss = _frame(n, along)
    c = Vector(c)
    leaf = [(0.55, 0.0), (0.22, 0.5), (-0.28, 0.42), (-0.5, 0.0),
            (-0.28, -0.42), (0.22, -0.5)]
    base = []
    for u, v in leaf:
        q, qn = _project(t, origin, c + tt * (u * L) + ss * (v * W), n)
        base.append(q - qn * sink)
    apex = c + n * H - tt * (sweep * L)
    mid = [q + (apex - q) * (1 - tip) for q in base]
    k = len(leaf)
    verts = base + mid + [apex]
    faces, fm = [], []
    for i in range(k):
        j = (i + 1) % k
        faces.append((i, j, k + j, k + i))
        fm.append(0)
        faces.append((k + i, k + j, 2 * k))
        fm.append(1)
    obj = _mesh(name, verts, faces, mats, fm)
    _outward(obj, c - n * 0.05)
    return obj


def scales(name, t, sp, cells, mats, pick=None, skip=None, sink=0.008,
           sweep=0.3):
    """A field of small keeled diamond scales in one mesh, four triangles
    each: cells are (s, theta, L, W, H) in a spine's tube coordinates. The
    apex is swept back against the spine's direction, so each scale reads
    as a low overlapping shingle. pick(point) chooses a scale's material
    (an index into mats); skip(point) drops it."""
    bm = bmesh.new()
    for s, th, L, W, H in cells:
        o, d = sp.point(s, th)
        c, cn = surface(t, o, d)
        if c is None or (skip and skip(c)):
            continue
        _, _, _, tg = sp.at(s)
        n, tt, ss = _frame(cn, tg)
        base = []
        for u, v in ((0.5, 0.0), (0.0, 0.5), (-0.5, 0.0), (0.0, -0.5)):
            q, qn = _project(t, o, c + tt * (u * L) + ss * (v * W), n)
            base.append(q - qn * sink)
        apex = c + n * H - tt * (sweep * L * 0.5)
        vs = [bm.verts.new(q) for q in base] + [bm.verts.new(apex)]
        mat = pick(c) if pick else 0
        for i in range(4):
            f = bm.faces.new((vs[i], vs[(i + 1) % 4], vs[4]))
            f.material_index = mat
            f.normal_update()
            if f.normal.dot(n) < 0:
                f.normal_flip()
    obj = kit._from_bmesh(name, bm)
    for m in mats:
        obj.data.materials.append(kit.material(m))
    return obj


def _outward(obj, inside):
    """Point every face away from an interior point."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    p = Vector(inside)
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - p) < 0:
            f.normal_flip()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def fang(name, base, direction, length, r, mats, fore=Y, flat=0.6,
         curve=0.0, segs=4, tipmat=None):
    """A sharp blade-like cone from `base` along `direction`: r across the
    fore-aft axis, r*flat sideways; `curve` bends the tip back along
    -fore. Its open base is buried."""
    d = Vector(direction).normalized()
    f = Vector(fore)
    f = (f - d * f.dot(d)).normalized()
    s = d.cross(f).normalized()
    base = Vector(base)
    verts = []
    for frac, sc in ((0.0, 1.0), (0.45, 0.7), (0.78, 0.36)):
        c = base + d * (length * frac) - f * (curve * frac * frac)
        for i in range(segs):
            a = math.tau * i / segs
            verts.append(c + f * (r * sc * math.cos(a)) +
                         s * (r * flat * sc * math.sin(a)))
    verts.append(base + d * length - f * curve)
    faces, fm = [], []
    for ring_i in range(2):
        for i in range(segs):
            j = (i + 1) % segs
            a0, a1 = ring_i * segs, (ring_i + 1) * segs
            faces.append((a0 + i, a0 + j, a1 + j, a1 + i))
            fm.append(0 if (tipmat is None or ring_i == 0) else 1)
    tip = 3 * segs
    for i in range(segs):
        j = (i + 1) % segs
        faces.append((2 * segs + i, 2 * segs + j, tip))
        fm.append(0 if tipmat is None else 1)
    mats = list(mats) + ([tipmat] if tipmat else [])
    obj = _mesh(name, verts, faces, mats, fm)
    _outward_axis(obj, base, d)
    return obj


def _outward_axis(obj, base, d):
    """Point every face away from the axis through base along d."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    b = Vector(base)
    for f in bm.faces:
        c = f.calc_center_median()
        axis_pt = b + d * (c - b).dot(d)
        out = c - axis_pt
        if out.length < 1e-6:
            out = d
        if f.normal.dot(out) < 0:
            f.normal_flip()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


# ---------------------------------------------------------------- normals

class Dense:
    """The smooth normals of a dense sculpt, to shade its decimated copy as
    if it still had every vertex."""

    def __init__(self, obj=None, co=None, no=None, tris=None):
        if obj is not None:
            co, no = arrays(obj)
            tris = []
            for p in obj.data.polygons:
                vs = list(p.vertices)
                for k in range(1, len(vs) - 1):
                    tris.append((vs[0], vs[k], vs[k + 1]))
            tris = np.array(tris)
        self.co, self.no, self.tris = co, no, tris
        self.tree = BVHTree.FromPolygons([Vector(c) for c in co],
                                         [tuple(int(i) for i in t)
                                          for t in tris])

    def mirrored(self):
        m = np.array([-1.0, 1.0, 1.0])
        return Dense(co=self.co * m, no=self.no * m, tris=self.tris)

    def normals(self, P):
        from mathutils.geometry import barycentric_transform
        e = (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        out = np.zeros((len(P), 3))
        for k, p in enumerate(P):
            loc, _, idx, _ = self.tree.find_nearest(Vector(p))
            a, b, c = self.tris[idx]
            w = barycentric_transform(loc, Vector(self.co[a]),
                                      Vector(self.co[b]), Vector(self.co[c]),
                                      *e)
            n = self.no[a] * w.x + self.no[b] * w.y + self.no[c] * w.z
            out[k] = n / max(np.linalg.norm(n), 1e-9)
        return out


def mirror_copy(obj, name):
    """A copy of a finished piece mirrored in x."""
    me = obj.data.copy()
    me.transform(Matrix.Scale(-1, 4, X))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    new = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(new)
    return new


# ---------------------------------------------------------------- parts

def part(troop, name, objs, pivot, par, angle=52, dense=None):
    """Join pieces into one jointed part with its origin at `pivot`. With
    `dense`, the first piece (the sculpted body) takes its normals from the
    dense sculpt it was decimated from."""
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
    n_body = len(objs[0].data.vertices)
    obj = kit.join(objs, f"{troop}.{name}")
    # Painting can leave a duplicate edge or face where cuts meet.
    obj.data.validate(clean_customdata=False)
    kit.uv_box(obj, small=True)
    kit.shade(obj, angle)
    if dense is not None:
        me = obj.data
        me.update()
        cn = np.array([c.vector[:] for c in me.corner_normals])
        co, _ = arrays(obj)
        dn = dense.normals(co[:n_body])
        lv = np.zeros(len(me.loops), dtype=np.int64)
        me.loops.foreach_get("vertex_index", lv)
        body = lv < n_body
        want = dn[np.where(body, lv, 0)]
        ok = body & (np.sum(want * cn, axis=1) > 0.4)
        cn[ok] = want[ok]
        me.normals_split_custom_set([tuple(n) for n in cn])
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    return obj
