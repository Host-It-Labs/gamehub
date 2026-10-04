"""Private modelling helpers for the collector Samurai (figure_duelist.py).

Copied and extended from figures_b.py / troopkit.py so that edits to the
toy troops never move this figure. Smooth forms are bmesh cages (rings of
points bridged into quads), optionally subdivided with creases; hard pieces
(lames, plates, horns, blade, fittings) are lofts, extruded outlines or
solidified panels. Every helper returns a plain world-space mesh object
with its modifiers applied, ready for `part()`.
"""

import math
import os

import bmesh
import kit
from mathutils import Matrix, Vector

TAU = math.tau
SHARP = 50

# Metres per texture repeat on this figure. Families without a tile
# (resin, lacquer, gilt) ignore their UVs; weave and hide borrow the cloth
# and leather reliefs at the troops' fine density.
TILE = {"weave": 0.26, "hide": 0.3, "cloth": 0.3, "leather": 0.3,
        "metal": 0.22, "wood": 0.6}


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(t):
    return max(0.0, min(1.0, t))


def smooth(t):
    t = clamp01(t)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------- sections

def sup(n, rx, ry, power=2.0, phase=0.0):
    """(x, y, angle) round a superellipse, counter-clockwise from +x."""
    e = 2.0 / power
    out = []
    for i in range(n):
        a = phase + i / n * TAU
        out.append((rx * spow(math.cos(a), e), ry * spow(math.sin(a), e), a))
    return out


def hring(z, rx, ry, n=12, cx=0.0, cy=0.0, power=2.0, phase=0.0,
          warp=None):
    pts = []
    for x, y, a in sup(n, rx, ry, power, phase):
        if warp:
            x, y, zz = warp(x, y, a)
            pts.append(Vector((cx + x, cy + y, z + zz)))
        else:
            pts.append(Vector((cx + x, cy + y, z)))
    return pts


def frame_at(t, up):
    t = Vector(t).normalized()
    up = Vector(up)
    u = up - t * up.dot(t)
    if u.length < 1e-6:
        u = Vector((1, 0, 0)) - t * t.x
    u.normalize()
    return u, t.cross(u)


def path_rings(path, radii, n=8, up=(0, 0, 1), power=2.0, phase=0.0,
               wave=None):
    """Rings across a path; `radii` holds r or (rx, ry) per point. `wave`
    (i, angle) -> radial factor sculpts folds."""
    path = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        u, v = frame_at(b - a, up)
        r = radii[i]
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        ring = []
        for x, y, ang in sup(n, rx, ry, power, phase):
            k = wave(i, ang) if wave else 1.0
            ring.append(p + u * x * k + v * y * k)
        rings.append(ring)
    return rings


# ------------------------------------------------------------- cages

class Cage:
    def __init__(self, name, mat):
        self.name = name
        self.bm = bmesh.new()
        self.mats = [mat]
        self.cr = self.bm.edges.layers.float.new("crease_edge")

    def m(self, mat):
        if mat is None:
            return 0
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def ring(self, pts):
        return [self.bm.verts.new(Vector(p)) for p in pts]

    def bridge(self, a, b, mat=None, closed=True):
        n = len(a)
        mi = self.m(mat)
        out = []
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            f = self.bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = mi
            out.append(f)
        return out

    def fan(self, ring, point, mat=None, end=True):
        c = self.bm.verts.new(Vector(point))
        mi = self.m(mat)
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            vs = (c, ring[i], ring[j]) if end else (c, ring[j], ring[i])
            self.bm.faces.new(vs).material_index = mi
        return c

    def ngon(self, ring, mat=None, end=True):
        f = self.bm.faces.new(ring if end else list(reversed(ring)))
        f.material_index = self.m(mat)
        return f

    def crease(self, ring, value=1.0, closed=True):
        n = len(ring)
        for i in range(n if closed else n - 1):
            e = self.bm.edges.get((ring[i], ring[(i + 1) % n]))
            if e:
                e[self.cr] = value

    def obj(self, levels=1, bevel=0.0, segments=2, recalc=False):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        obj = kit._from_bmesh(self.name, self.bm)
        for m in self.mats:
            obj.data.materials.append(kit.material(m))
        if levels:
            kit.add_subsurf(obj, levels)
        if bevel:
            kit.add_bevel(obj, bevel, segments, angle=40)
        kit.apply(obj)
        return obj


def loft(name, rings, mat, bands=None, start=None, end=None, creases=(),
         levels=1, closed=True, bevel=0.0, recalc=True):
    """Bridge rings of equal length. `bands` maps band index (between ring
    i and i + 1) to a material, or is a function i -> material; `start` /
    `end` close the ends ("pole", a point, or "flat")."""
    c = Cage(name, mat)
    vs = [c.ring(r) for r in rings]
    if bands is None:
        bands = {}
    get = bands if callable(bands) else (lambda i: bands.get(i))
    for i in range(len(vs) - 1):
        c.bridge(vs[i], vs[i + 1], get(i), closed)
    for cap, ring, is_end in ((start, 0, False), (end, -1, True)):
        if cap is None:
            continue
        pts = [Vector(p) for p in rings[ring]]
        centre = sum(pts, Vector()) / len(pts)
        cap_mat = None if callable(bands) else \
            bands.get("start" if not is_end else "end")
        if cap == "flat":
            c.ngon(vs[ring], cap_mat, is_end)
        else:
            c.fan(vs[ring], centre if cap == "pole" else cap, cap_mat,
                  is_end)
    for k in creases:
        i, val = (k, 1.0) if not isinstance(k, tuple) else k
        c.crease(vs[i], val, closed)
    return c.obj(levels=levels, bevel=bevel, recalc=recalc)


def tube(name, path, radii, mat, n=8, up=(0, 0, 1), power=2.0, levels=1,
         caps=("dome", "dome"), creases=(), bands=None, phase=0.0,
         wave=None):
    """A limb or rod: rings across a path. Caps: "dome", "flat", "pole" or
    None (open)."""
    path = [Vector(p) for p in path]
    radii = list(radii)
    rings = path_rings(path, radii, n, up, power, phase, wave)
    bands = dict(bands or {})
    s, e = caps
    if s == "dome":
        d = (path[0] - path[1]).normalized()
        centre = path[0]
        rings.insert(0, [centre + (p - centre) * 0.62 + d * _rmin(radii[0])
                         * 0.62 for p in rings[0]])
        bands = {(k + 1 if isinstance(k, int) else k): v
                 for k, v in bands.items()}
        s = "flat" if levels else "pole"
    if e == "dome":
        d = (path[-1] - path[-2]).normalized()
        centre = path[-1]
        rings.append([centre + (p - centre) * 0.62 + d * _rmin(radii[-1])
                      * 0.62 for p in rings[-1]])
        e = "flat" if levels else "pole"
    return loft(name, rings, mat, bands=bands, start=s, end=e,
                creases=creases, levels=levels)


def _rmin(r):
    return min(r) if isinstance(r, (tuple, list)) else r


def ball(name, r, at, mat, scale=(1, 1, 1), seg=12, rings=None):
    obj = kit.sphere(name, r, at, scale=scale, mat=mat, segments=seg,
                     rings=rings or max(4, seg // 2))
    kit.apply_transform(obj)
    return obj


def cube_ball(name, size, at, mat, levels=2, crease=0.0, matrix=None):
    """A rounded block: a cube cage under subdivision."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if crease:
        layer = bm.edges.layers.float.new("crease_edge")
        for e in bm.edges:
            e[layer] = crease
    obj = kit._from_bmesh(name, bm, mat)
    kit.add_subsurf(obj, levels)
    kit.apply(obj)
    obj.location = at
    kit.apply_transform(obj)
    if matrix is not None:
        transform([obj], matrix)
    return obj


# ------------------------------------------------------------- hard pieces

def slab(name, outline, depth, mat, bevel=0.0, segments=1, matrix=None,
         angle=40, side_mat=None):
    """Extrude a flat outline (2D, counter-clockwise) from z = 0 to depth."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, 0.0)) for x, y in outline]
    top = [bm.verts.new((x, y, depth)) for x, y in outline]
    n = len(outline)
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((bot[i], bot[j], top[j], top[i]))
        if side_mat:
            f.material_index = 1
    obj = kit._from_bmesh(name, bm, mat)
    if side_mat:
        obj.data.materials.append(kit.material(side_mat))
    if bevel:
        kit.add_bevel(obj, bevel, segments, angle=angle)
    kit.apply(obj)
    if matrix is not None:
        obj.matrix_world = matrix
        kit.apply_transform(obj)
        flip_if_mirrored(obj, matrix)
    return obj


def panel(name, fn, us, vs, mat, thickness, bevel=0.0, segments=1,
          faces=None, levels=0, angle=40, inside=None, rim_mat=None):
    """A plate: the surface fn(u, v) over the grid us x vs, thickened
    inward by `thickness`. `faces(i, j)` may return a material per face;
    `inside` is a point behind the plate so the thickness grows inward;
    `rim_mat` paints the solidify rim."""
    if isinstance(us, int):
        us = [i / us for i in range(us + 1)]
    if isinstance(vs, int):
        vs = [j / vs for j in range(vs + 1)]
    c = Cage(name, mat)
    rows = [c.ring([fn(u, v) for u in us]) for v in vs]
    n = len(us)
    for j in range(len(vs) - 1):
        a, b = rows[j], rows[j + 1]
        for i in range(n - 1):
            f = c.bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
            f.material_index = c.m(faces(i, j) if faces else None)
    if inside is not None:
        inside = Vector(inside)
        c.bm.normal_update()
        score = sum((f.calc_center_median() - inside).dot(f.normal)
                    for f in c.bm.faces)
        if score < 0:
            for f in c.bm.faces:
                f.normal_flip()
    rim_index = c.m(rim_mat) if rim_mat else 0
    obj = c.obj(levels=0)
    sol = obj.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = -1.0
    sol.use_even_offset = True
    sol.use_rim = True
    sol.material_offset_rim = rim_index
    if levels:
        sol.edge_crease_rim = 1.0
        sol.edge_crease_outer = 1.0
        sol.edge_crease_inner = 1.0
        kit.add_subsurf(obj, levels)
    if bevel:
        kit.add_bevel(obj, bevel, segments, angle=angle)
    kit.apply(obj)
    return obj


def raised(name, quad, normal, height, mat, taper=0.35):
    """A small raised strip (a laced cord) on a surface: `quad` is four
    points (bottom-left, bottom-right, top-right, top-left) on the
    surface; its top lifts `height` along `normal`, narrowed across by
    `taper`, and its base sinks a little into the surface."""
    n = Vector(normal).normalized()
    q = [Vector(p) for p in quad]
    across = ((q[1] + q[2]) - (q[0] + q[3])) / 2
    bm = bmesh.new()
    base = [bm.verts.new(p - n * height * 0.5) for p in q]
    top = []
    for k, p in enumerate(q):
        side = -1 if k in (0, 3) else 1
        top.append(bm.verts.new(p + n * height -
                                across * 0.5 * taper * side))
    bm.faces.new(top)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((base[i], base[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit._from_bmesh(name, bm, mat)


def flip_if_mirrored(obj, m):
    """A transform with a negative determinant turns faces inside out."""
    if m.determinant() < 0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for f in bm.faces:
            f.normal_flip()
        bm.to_mesh(obj.data)
        bm.free()


# ------------------------------------------------------------- placement

def basis(x, y, z, origin):
    x, y, z = Vector(x), Vector(y), Vector(z)
    return Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0, 0, 0, 1)))


def look(z_axis, y_hint, origin):
    z = Vector(z_axis).normalized()
    y = Vector(y_hint) - z * Vector(y_hint).dot(z)
    y.normalize()
    x = y.cross(z)
    return basis(x, y, z, origin)


def transform(objs, m):
    kit.refresh()
    for o in objs:
        o.matrix_world = m @ o.matrix_world
        kit.apply_transform(o)
        flip_if_mirrored(o, m)
    return objs


def ik(root, target, l1, l2, pole):
    root, target, pole = Vector(root), Vector(target), Vector(pole)
    d = target - root
    dist = min(d.length, (l1 + l2) * 0.999)
    dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    side = pole - root
    side = side - dn * side.dot(dn)
    side.normalize()
    return root + dn * a + side * h


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


def part(troop, name, objs, pivot, par, angle=SHARP):
    """Join pieces into one jointed part with its origin on `pivot` and no
    rest rotation."""
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
    if os.environ.get("DUELIST_DEBUG"):
        tally = {}
        for o in objs:
            key = o.name.split("-")[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + sum(
                len(p.vertices) - 2 for p in o.data.polygons)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  {name:8s} {k:14s} {v:6d}")
    obj = kit.join(objs, f"{troop}.{name}")
    uv_fine(obj)
    kit.shade(obj, angle)
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    obj.rotation_euler = (0, 0, 0)
    return obj


def scale_about(objs, centre, k):
    """Scale pieces by `k` about `centre` (bigger fists, a chunkier face)."""
    c = Vector(centre)
    m = Matrix.Translation(c) @ Matrix.Scale(k, 4) @ Matrix.Translation(-c)
    return transform(objs, m)


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ------------------------------------------------------------- posing

def runtime_quat(rx, ry, rz):
    """The quaternion (Blender axes) of a joint turned by the game: three.js
    applies Euler XYZ in its y-up frame, where three y is Blender z and
    three z is Blender -y, so R = Rx(rx) Rz(ry) Ry(-rz) in Blender terms."""
    from mathutils import Quaternion
    return (Quaternion((1, 0, 0), rx) @ Quaternion((0, 0, 1), ry) @
            Quaternion((0, 1, 0), -rz))


def pose_root(root, rid, pose):
    """Split the knees and ankles as figures.py will, then turn the parts
    as the game would ({part: (x, y, z)} in three.js Euler terms; the
    head keeps figures.py's 5 degree lift)."""
    import articulation
    articulation.legs(root, rid)
    pose = dict(pose)
    hx, hy, hz = pose.get("head", (0.0, 0.0, 0.0))
    pose["head"] = (hx + math.radians(5), hy, hz)
    for o in kit.descendants(root):
        if o.type != "MESH" or "." not in o.name:
            continue
        key = o.name.split(".", 1)[1]
        if key in pose:
            o.rotation_mode = "QUATERNION"
            o.rotation_quaternion = runtime_quat(*pose[key])
    kit.refresh()
