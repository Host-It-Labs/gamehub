"""Cage-modelling helpers for the Samurai (duelist) and the Wizard (mage).

Smooth forms are low-poly bmesh cages (rings of points bridged into quads)
smoothed by a Subdivision Surface modifier, with edge creases wherever a
form needs a crisp edge. Hard pieces (armour plates, blade, crest, stars,
fittings) are extruded outlines or solidified panels with an even bevel.
Every helper returns a plain mesh object in world space with its modifiers
applied, ready for `part()`.
"""

import math

import bmesh
import bpy
import kit
import troopkit
from mathutils import Matrix, Vector

TAU = math.tau
SHARP = 40


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


def lerp(a, b, t):
    return a + (b - a) * t


def part(troop, name, objs, pivot, par):
    """troopkit.part with one clean "UVMap" layer on every piece."""
    for o in objs:
        uvs = o.data.uv_layers
        while len(uvs):
            uvs.remove(uvs[0])
    obj = troopkit.part(troop, name, objs, pivot, par)
    obj.data.uv_layers[0].name = "UVMap"
    # Flat faces stay flat and single chamfers read as crisp highlight
    # lines; subdivided forms (a few degrees per face) stay smooth.
    kit.shade(obj, SHARP)
    return obj


# ------------------------------------------------------------- sections

def sup(n, rx, ry, power=2.0, phase=0.0):
    """(x, y, angle) round a superellipse: power 2 is an ellipse, higher is
    squarer. Counter-clockwise from +x."""
    e = 2.0 / power
    out = []
    for i in range(n):
        a = phase + i / n * TAU
        out.append((rx * spow(math.cos(a), e), ry * spow(math.sin(a), e), a))
    return out


def hring(z, rx, ry, n=12, cx=0.0, cy=0.0, power=2.0, phase=0.0,
          warp=None):
    """A horizontal ring at height z. `warp(x, y, a)` may return a moved
    (x, y, z) to shape it (a flatter back, a pointed front...)."""
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


def path_rings(path, radii, n=8, up=(0, 0, 1), power=2.0, phase=0.0):
    """Rings across a path. `radii` holds one r or (rx, ry) per point; rx
    lies along `up` projected off the path."""
    path = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        u, v = frame_at(b - a, up)
        r = radii[i]
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        rings.append([p + u * x + v * y
                      for x, y, _ in sup(n, rx, ry, power, phase)])
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

    def crease_edge(self, a, b, value=1.0):
        e = self.bm.edges.get((a, b))
        if e:
            e[self.cr] = value

    def obj(self, levels=1, bevel=0.0, segments=2, recalc=False,
            smooth_boundary=True):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        obj = kit._from_bmesh(self.name, self.bm)
        for m in self.mats:
            obj.data.materials.append(kit.material(m))
        if levels:
            mod = kit.add_subsurf(obj, levels)
            if not smooth_boundary:
                mod.boundary_smooth = "PRESERVE_CORNERS"
        if bevel:
            kit.add_bevel(obj, bevel, segments, angle=40)
        kit.apply(obj)
        return obj


def loft(name, rings, mat, bands=None, start=None, end=None, creases=(),
         levels=1, closed=True, bevel=0.0, recalc=True):
    """Bridge rings of equal length. `bands` maps band index (between ring
    i and i + 1) to a material; `start`/`end` close the ends: "pole" (a
    point at the ring centre), a point, or "flat" (an n-gon). `creases`
    lists ring indices (or (index, value)) kept crisp by the subdivision."""
    c = Cage(name, mat)
    vs = [c.ring(r) for r in rings]
    bands = bands or {}
    if isinstance(bands, (list, tuple)):
        bands = dict(enumerate(bands))
    for i in range(len(vs) - 1):
        c.bridge(vs[i], vs[i + 1], bands.get(i), closed)
    for cap, ring, is_end in ((start, 0, False), (end, -1, True)):
        if cap is None:
            continue
        pts = [Vector(p) for p in rings[ring]]
        centre = sum(pts, Vector()) / len(pts)
        cap_mat = bands.get("start" if not is_end else "end")
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
         caps=("dome", "dome"), creases=(), bands=None, phase=0.0):
    """A limb or rod: rings across a path. Caps: "dome" (rounded),
    "flat", "pole" or None (open)."""
    path = [Vector(p) for p in path]
    radii = list(radii)
    rings = path_rings(path, radii, n, up, power, phase)
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


def cube_ball(name, size, at, mat, levels=2, crease=0.0):
    """A rounded block: a cube cage under subdivision (a pebble, a fist).
    A crease keeps its faces flatter and its corners tighter."""
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
    return obj


# ------------------------------------------------------------- hard pieces

def slab(name, outline, depth, mat, bevel=0.004, segments=1, matrix=None,
         angle=40, holes=None):
    """Extrude a flat outline (2D, counter-clockwise) from z = 0 to
    z = depth with an even bevel on every edge."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, 0.0)) for x, y in outline]
    top = [bm.verts.new((x, y, depth)) for x, y in outline]
    n = len(outline)
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    obj = kit._from_bmesh(name, bm, mat)
    if bevel:
        mod = kit.add_bevel(obj, bevel, segments, angle=angle)
        mod.limit_method = "ANGLE"
    kit.apply(obj)
    if matrix is not None:
        obj.matrix_world = matrix
        kit.apply_transform(obj)
    return obj


def panel(name, fn, us, vs, mat, thickness, bevel=0.003, segments=1,
          faces=None, levels=0, closed_u=False, angle=40, inside=None):
    """A plate: the surface fn(u, v) -> point over the grid us x vs (lists
    of parameter values, or counts for an even 0..1 spread), thickened
    inward by `thickness` and bevelled. `faces(i, j)` may return a material
    for the face in column i, row j. With levels > 0 the plate is
    subdivided with its rims creased (a moulded, rounded plate). `inside`
    is a point behind the plate: its faces are turned to face away from
    it, so the thickness always grows inward."""
    if isinstance(us, int):
        us = [i / us for i in range(us + 1)]
    if isinstance(vs, int):
        vs = [j / vs for j in range(vs + 1)]
    if closed_u:
        us = us[:-1]
    c = Cage(name, mat)
    rows = [c.ring([fn(u, v) for u in us]) for v in vs]
    n = len(us)
    for j in range(len(vs) - 1):
        a, b = rows[j], rows[j + 1]
        for i in range(n if closed_u else n - 1):
            k = (i + 1) % n
            f = c.bm.faces.new((a[i], a[k], b[k], b[i]))
            f.material_index = c.m(faces(i, j) if faces else None)
    if inside is not None:
        inside = Vector(inside)
        c.bm.normal_update()
        score = sum((f.calc_center_median() - inside).dot(f.normal)
                    for f in c.bm.faces)
        if score < 0:
            for f in c.bm.faces:
                f.normal_flip()
    obj = c.obj(levels=0)
    sol = obj.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = -1.0
    sol.use_even_offset = True
    sol.use_rim = True
    sol.material_offset_rim = 0
    if levels:
        sol.edge_crease_rim = 1.0
        sol.edge_crease_outer = 1.0
        sol.edge_crease_inner = 1.0
        kit.add_subsurf(obj, levels)
    if bevel:
        kit.add_bevel(obj, bevel, segments, angle=angle)
    kit.apply(obj)
    return obj


def outline_star(r_out, r_in, points=5, phase=math.pi / 2):
    out = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = phase + i / (points * 2) * TAU
        out.append((math.cos(a) * r, math.sin(a) * r))
    return out


def outline_crescent(width, height, thick, n=14, lift=0.0):
    """A crescent with its horns up: outer arc then inner arc."""
    out = []
    for i in range(n + 1):
        a = math.pi + i / n * math.pi        # left horn, bottom, right horn
        out.append((math.cos(a) * width / 2, math.sin(a) * height + lift))
    inner = []
    for i in range(n + 1):
        a = math.pi + i / n * math.pi
        t = math.sin(i / n * math.pi)
        w = width / 2 - thick * 0.25 * t - 0.004
        h = height - thick * t
        inner.append((math.cos(a) * w, math.sin(a) * h + lift))
    # Horn tips are shared; walk the inner arc back.
    return out + list(reversed(inner[1:-1]))


# ------------------------------------------------------------- placement

def basis(x, y, z, origin):
    """A matrix whose local x, y, z axes land on the given world vectors."""
    x, y, z = Vector(x), Vector(y), Vector(z)
    m = Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0, 0, 0, 1)))
    return m


def look(z_axis, y_hint, origin):
    """A frame with local z along `z_axis` and local y as near `y_hint`."""
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
    return objs


def ik(root, target, l1, l2, pole):
    """Two-bone IK: the joint between `root` and `target`, bent toward
    `pole`."""
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


def eye(name, centre, normal, up, r, iris="plain:black", white="plain:white",
        look_dir=(0.0, 0.0), squash=1.25, iris_scale=0.62, lid=None):
    """A painted eye on a surface: a white oval, a dark iris and a tiny
    highlight, each a thin raised disc facing `normal`. `lid` = (height,
    slope) clips the top of the eye along a straight upper lid (in the
    eye's own x, y; a stern look slopes it down toward the nose)."""
    normal = Vector(normal).normalized()
    m = look(normal, up, centre)

    def clip(pts):
        if not lid:
            return pts
        h, k = lid
        return [(x, min(y, h * r + k * x)) for x, y in pts]

    oval = clip([(math.cos(a) * r, math.sin(a) * r * squash)
                 for a in (i / 10 * TAU for i in range(10))])
    parts = [slab(name + "-white", oval, 0.004, white, bevel=0.0,
                  matrix=m)]
    ri = r * iris_scale
    ix, iy = look_dir[0] * r * 0.3, look_dir[1] * r * 0.3
    disc = clip([(ix + math.cos(a) * ri, iy + math.sin(a) * ri * 1.1)
                 for a in (i / 8 * TAU for i in range(8))])
    parts.append(slab(name + "-iris", disc, 0.0055, iris, bevel=0.0,
                      matrix=m))
    hr = r * 0.2
    hx, hy = ix + ri * 0.35, iy + ri * 0.3
    dot = [(hx + math.cos(a) * hr, hy + math.sin(a) * hr)
           for a in (i / 6 * TAU for i in range(6))]
    parts.append(slab(name + "-glint", dot, 0.007, white, bevel=0.0,
                      matrix=m))
    return parts


def bpy_cleanup(obj):
    bpy.data.objects.remove(obj, do_unlink=True)
