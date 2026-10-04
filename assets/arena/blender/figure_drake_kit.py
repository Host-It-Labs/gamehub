"""Private modelling helpers for the collector Biplane (figure_drake.py).

Kept apart from the other figures' kits so edits elsewhere never move this
model. Every helper returns a plain world-space mesh object with its
modifiers applied, ready for `part()`. Thin shells (decals, caps, ribbons)
orient their faces explicitly, since the game draws front faces only.
"""

import math

import bmesh
import kit
from mathutils import Matrix, Vector

TAU = math.tau
X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))
SHARP = 48

# Metres per texture repeat on this figure (weave and hide carry the cloth
# and leather reliefs at the troops' fine density).
TILE = {"weave": 0.26, "drape": 0.26, "hide": 0.3}


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(t):
    return max(0.0, min(1.0, t))


def smooth(t):
    t = clamp01(t)
    return t * t * (3 - 2 * t)


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


def table(rows, x):
    """Piecewise-linear lookup in rows of (x, v...) sorted by x."""
    if x <= rows[0][0]:
        return list(rows[0][1:])
    for a, b in zip(rows, rows[1:]):
        if x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0]) if b[0] != a[0] else 0.0
            return [lerp(p, q, t) for p, q in zip(a[1:], b[1:])]
    return list(rows[-1][1:])


# ------------------------------------------------------------- frames

def frame(axis, up=None):
    """A rotation taking local z to `axis` and local y toward `up`."""
    z = Vector(axis).normalized()
    if up is None:
        up = Z if abs(z.z) < 0.9 else Y
    x = Vector(up).cross(z).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()


def place(obj, at=(0, 0, 0), axis=Z, up=None):
    obj.matrix_world = Matrix.Translation(Vector(at)) @ frame(axis, up)
    kit.apply_transform(obj)
    return obj


def orient(obj, outward):
    """Flip each face whose normal disagrees with outward(centre)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(outward(c)) < 0:
            f.normal_flip()
    bm.to_mesh(obj.data)
    bm.free()
    return obj


# ------------------------------------------------------------- cages

class Cage:
    def __init__(self, name, mat):
        self.name = name
        self.bm = bmesh.new()
        self.mats = [mat]

    def m(self, mat):
        if mat is None:
            return 0
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def ring(self, pts):
        return [self.bm.verts.new(Vector(p)) for p in pts]

    def face(self, vs, mat=None):
        f = self.bm.faces.new(vs)
        f.material_index = self.m(mat)
        return f

    def obj(self, recalc=True):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-7)
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        obj = kit._from_bmesh(self.name, self.bm)
        for m in self.mats:
            obj.data.materials.append(kit.material(m))
        return obj


def loft(name, rings, mat, face_mat=None, start=None, end=None,
         closed=True, recalc=True):
    """Bridge rings of equal length. `face_mat(i, j)` may paint the quad
    between rings i, i + 1 and points j, j + 1. Ends: "flat", "pole", a
    point, or None."""
    c = Cage(name, mat)
    vs = [c.ring(r) for r in rings]
    n = len(rings[0])
    for i in range(len(vs) - 1):
        for j in range(n if closed else n - 1):
            k = (j + 1) % n
            c.face((vs[i][j], vs[i][k], vs[i + 1][k], vs[i + 1][j]),
                   face_mat(i, j) if face_mat else None)
    for cap, idx, last in ((start, 0, False), (end, -1, True)):
        if cap is None:
            continue
        ring = vs[idx]
        cm = face_mat(("cap", idx), 0) if face_mat else None
        if cap == "flat":
            c.face(ring if last else list(reversed(ring)), cm)
        else:
            pts = [Vector(p) for p in rings[idx]]
            centre = sum(pts, Vector()) / len(pts) if cap == "pole" \
                else Vector(cap)
            mid = c.bm.verts.new(centre)
            for j in range(n):
                k = (j + 1) % n
                c.face((mid, ring[j], ring[k]) if last
                       else (mid, ring[k], ring[j]), cm)
    return c.obj(recalc=recalc)


def path_frames(path, up):
    path = [Vector(p) for p in path]
    out = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        d = (b - a).normalized()
        side = Vector(up).cross(d)
        if side.length < 1e-6:
            side = X.cross(d)
        side.normalize()
        lift = d.cross(side).normalized()
        out.append((p, d, side, lift))
    return out


def tube(name, path, radii, mat, n=6, up=Z, caps=("flat", "flat"),
         phase=0.5, closed_path=False, face_mat=None):
    """An oval tube through points: radii are r or (across, along up)."""
    fr = path_frames(path, up)
    if closed_path:
        # Tangents wrap round the loop.
        pts = [Vector(p) for p in path]
        fr = []
        for i, p in enumerate(pts):
            d = (pts[(i + 1) % len(pts)] - pts[i - 1]).normalized()
            side = Vector(up).cross(d).normalized()
            fr.append((p, d, side, d.cross(side).normalized()))
    rings = []
    for (p, d, side, lift), r in zip(fr, radii):
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        rings.append([p + side * math.cos((j + phase) / n * TAU) * rx
                      + lift * math.sin((j + phase) / n * TAU) * ry
                      for j in range(n)])
    if closed_path:
        rings.append(rings[0])
        return loft(name, rings, mat, face_mat=face_mat)
    s, e = caps
    return loft(name, rings, mat, start=s, end=e, face_mat=face_mat)


def wire(name, a, b, r, mat, n=4):
    """A thin rigging wire: an open n-sided prism (2n triangles)."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    side = Z.cross(d)
    if side.length < 1e-4:
        side = X.cross(d)
    side.normalize()
    lift = d.cross(side)
    rings = []
    for p in (a, b):
        rings.append([p + side * math.cos((j + 0.5) / n * TAU) * r
                      + lift * math.sin((j + 0.5) / n * TAU) * r
                      for j in range(n)])
    obj = loft(name, rings, mat, recalc=False)
    return orient(obj, lambda c: c - (a + d * (c - a).dot(d)))


def lathe(name, profile, at, axis, mat, segments=16, up=None, mats=None,
          start=None, end=None, phase=0.0, flip=False):
    """Spin (radius, height) points about local z, then aim it. Faces
    point to the right of the profile's travel: go up the outside, then in
    over the top (`flip` reverses). `mats` paints each profile band; ends
    as in loft() (the start cap faces -z, the end cap +z)."""
    rings = []
    for r, h in profile:
        rings.append([(r * math.cos((i + phase) / segments * TAU),
                       r * math.sin((i + phase) / segments * TAU), h)
                      for i in range(segments)])
    fm = None
    if mats:
        def fm(i, j):
            return mats[i] if isinstance(i, int) and i < len(mats) else None
    obj = loft(name, rings, mat, face_mat=fm, start=start, end=end,
               recalc=False)
    if flip:
        obj.data.flip_normals()
    return place(obj, at, axis, up)


def rounded_lathe(name, profile, at, axis, mat, segments=16, up=None,
                  mats=None):
    """A closed lathe: a profile point on the axis (r = 0) at either end
    becomes a pointed pole, otherwise that end closes with a flat fan.
    Normals recalculated."""
    prof = list(profile)
    start = end = "pole"
    if prof[0][0] < 1e-6:
        start = Vector((0, 0, prof.pop(0)[1]))
    if prof[-1][0] < 1e-6:
        end = Vector((0, 0, prof.pop()[1]))
    rings = []
    for r, h in prof:
        rings.append([(r * math.cos(i / segments * TAU),
                       r * math.sin(i / segments * TAU), h)
                      for i in range(segments)])
    fm = None
    if mats:
        def fm(i, j):
            return mats[i] if isinstance(i, int) and i < len(mats) else None
    obj = loft(name, rings, mat, face_mat=fm, start=start, end=end)
    return place(obj, at, axis, up)


def box(name, size, at, mat, matrix=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    obj = kit._from_bmesh(name, bm, mat)
    obj.location = at
    kit.apply_transform(obj)
    if matrix is not None:
        obj.matrix_world = matrix
        kit.apply_transform(obj)
    return obj


def ball(name, r, at, mat, scale=(1, 1, 1), seg=10, rings=6):
    obj = kit.sphere(name, r, at, scale=scale, mat=mat, segments=seg,
                     rings=rings)
    kit.apply_transform(obj)
    return obj


def decal(name, rings, surf, segments=20, lift=0.002, skirt=0.004):
    """Concentric painted rings lying on a surface. `rings` is a list of
    (radius, material) from the outside in; `surf(a, r)` gives the
    (point, normal) on the surface at angle a, radius r. The outer rim
    tucks a short skirt into the surface."""
    c = Cage(name, rings[0][1])

    def at(a, r, off):
        p, n = surf(a, r)
        return p + n * off

    angs = [i / segments * TAU for i in range(segments)]
    outer = c.ring([at(a, rings[0][0], lift - skirt) for a in angs])
    prev = c.ring([at(a, rings[0][0], lift) for a in angs])
    for i in range(segments):
        j = (i + 1) % segments
        c.face((outer[i], outer[j], prev[j], prev[i]), rings[0][1])
    for k, (r, mat) in enumerate(rings):
        inner_r = rings[k + 1][0] if k + 1 < len(rings) else None
        if inner_r is None:
            p, n = surf(0.0, 0.0)
            mid = c.bm.verts.new(p + n * lift)
            for i in range(segments):
                j = (i + 1) % segments
                c.face((mid, prev[i], prev[j]), mat)
            break
        # A mid ring keeps the band on the surface's curve.
        nxt = c.ring([at(a, inner_r, lift) for a in angs])
        for i in range(segments):
            j = (i + 1) % segments
            c.face((prev[i], prev[j], nxt[j], nxt[i]), mat)
        prev = nxt
    obj = c.obj(recalc=False)

    centre, n0 = surf(0.0, 0.0)

    def outward(q):
        radial = q - centre
        radial -= n0 * radial.dot(n0)
        return n0 + (radial.normalized() * 0.7 if radial.length > 1e-6
                     else Vector())
    return orient(obj, outward)


def slab(name, outline, depth, mat, matrix):
    """Extrude a flat outline (2D, counter-clockwise) from z=-d/2 to d/2,
    then place it with `matrix`."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, -depth / 2)) for x, y in outline]
    top = [bm.verts.new((x, y, depth / 2)) for x, y in outline]
    n = len(outline)
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm, mat)
    obj.matrix_world = matrix
    kit.apply_transform(obj)
    return obj


def basis(x, y, z, origin):
    x, y, z = Vector(x), Vector(y), Vector(z)
    return Matrix(((x.x, y.x, z.x, origin[0]),
                   (x.y, y.y, z.y, origin[1]),
                   (x.z, y.z, z.z, origin[2]),
                   (0, 0, 0, 1)))


def mirror_x(objs, name_suffix="m"):
    """Mirrored copies of pieces across x = 0 (faces flipped back)."""
    out = []
    m = Matrix.Scale(-1, 4, X)
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        me = o.data.copy()
        me.transform(m)
        me.flip_normals()
        new = kit.bpy.data.objects.new(o.name + name_suffix, me)
        kit.bpy.context.scene.collection.objects.link(new)
        out.append(new)
    return out


# ------------------------------------------------------------- parts

def uv_fine(obj):
    """Per-face planar UVs in texture repeats at this figure's density."""
    me = obj.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        fam = me.materials[f.material_index].name.split(":")[0] \
            if me.materials else "plain"
        tile = TILE.get(fam, 1.0)
        nrm = f.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        for loop in f.loops:
            c = loop.vert.co
            if ax == 2:
                u, v = c.x * (1 if nrm.z >= 0 else -1), c.y
            elif ax == 0:
                u, v = c.y * (1 if nrm.x >= 0 else -1), c.z
            else:
                u, v = -c.x * (1 if nrm.y >= 0 else -1), c.z
            loop[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()


def tris(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in objs)


def part(troop, name, objs, pivot, par, angle=SHARP, report=None):
    """Join pieces into one jointed part with its origin on `pivot` and no
    rest rotation."""
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        while o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers[0])
    if report is not None:
        for o in objs:
            key = o.name.split("-")[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LRm")
            report[key] = report.get(key, 0) + tris([o])
    obj = kit.join(objs, f"{troop}.{name}")
    uv_fine(obj)
    kit.shade(obj, angle)
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    obj.rotation_euler = (0, 0, 0)
    return obj
