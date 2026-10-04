"""Shared modelling helpers for the eight collector figures of 1 October
2026 (diver, sumo, linebacker, beekeeper, drummer, firefighter, jetpack,
explorer) and the Beekeeper's bee. The geometry helpers are copied from
figure_viking_kit.py (itself from figure_ranger_kit.py) so edits to the
older figures never move these; below them sit the pieces these eight
share: one palette of pots (fewer draw batches at runtime), two head
sculpts (hers and his), lighter painted eyes with a focused brow, shoes,
limbs, grips and the knee and ankle split.

Everything builds plain bmesh geometry in world space: parametric
sheets (a garment panel from a surface function), lofts of rings, tubes
along paths, rounded blocks and extruded outlines, plus the small bits of
rotation maths the pose previews need. Pieces are joined into jointed parts
by `part()`, which puts the origin on the joint without any rotation.
"""

import math
import os

import bmesh
import kit
from mathutils import Matrix, Quaternion, Vector

TAU = math.tau

# Metres per texture repeat for this figure's surfaces: the miniature
# families borrow the fine small-scale densities of their relief tiles.
UV_TILE = {"weave": 0.28, "cloth": 0.28, "hide": 0.3, "leather": 0.3,
           "wood": 0.45, "metal": 0.22, "resin": 0.5, "gilt": 0.3,
           "lacquer": 0.5}


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(t):
    return max(0.0, min(1.0, t))


def smooth(e0, e1, x):
    t = clamp01((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)


def gauss(x, mu, s):
    return math.exp(-((x - mu) / s) ** 2)


def table(rows, x):
    """Piecewise-linear lookup in [(x, value...), ...] sorted by x."""
    if x <= rows[0][0]:
        return rows[0][1:] if len(rows[0]) > 2 else rows[0][1]
    for a, b in zip(rows, rows[1:]):
        if x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            vals = tuple(lerp(p, q, t) for p, q in zip(a[1:], b[1:]))
            return vals if len(vals) > 1 else vals[0]
    return rows[-1][1:] if len(rows[-1]) > 2 else rows[-1][1]


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


# ------------------------------------------------------------- mesh builder

class Mesh:
    def __init__(self, name, mat=None):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []
        self.cr = self.bm.edges.layers.float.new("crease_edge")
        if mat:
            self.m(mat)

    def m(self, mat):
        if mat is None:
            return 0
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def v(self, p):
        return self.bm.verts.new(Vector(p))

    def face(self, verts, mat=None):
        f = self.bm.faces.new(verts)
        f.material_index = self.m(mat) if mat else 0
        return f

    def grid(self, rows, mat=None, closed=False, flip=False):
        """Quads between consecutive rows of verts. `mat(i, j)` or a name."""
        faces = []
        for j in range(len(rows) - 1):
            a, b = rows[j], rows[j + 1]
            n = len(a)
            for i in range(n if closed else n - 1):
                k = (i + 1) % n
                vs = (a[i], a[k], b[k], b[i])
                if flip:
                    vs = vs[::-1]
                mm = mat(i, j) if callable(mat) else mat
                faces.append(self.face(vs, mm))
        return faces

    def fan(self, ring, centre, mat=None, flip=False):
        c = self.v(centre)
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            vs = (c, ring[i], ring[j]) if not flip else (c, ring[j], ring[i])
            self.face(vs, mat)
        return c

    def crease(self, ring, value=1.0, closed=True):
        n = len(ring)
        for i in range(n if closed else n - 1):
            e = self.bm.edges.get((ring[i], ring[(i + 1) % n]))
            if e:
                e[self.cr] = value

    def obj(self, levels=0, recalc=False, outward=None, inward=None):
        """The finished object. `outward`/`inward`: a point the faces
        should face away from / toward (fixes the winding of open sheets)."""
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
        if recalc:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if outward is not None or inward is not None:
            bm.normal_update()
            ref = Vector(outward if outward is not None else inward)
            score = sum((f.calc_center_median() - ref).dot(f.normal)
                        for f in bm.faces)
            if (score < 0) == (outward is not None):
                bmesh.ops.reverse_faces(bm, faces=bm.faces)
        obj = kit._from_bmesh(self.name, bm)
        for m in self.mats:
            obj.data.materials.append(kit.material(m))
        if levels:
            kit.add_subsurf(obj, levels)
            kit.apply(obj)
        return obj


# ------------------------------------------------------------- shapes

def sup(n, rx, ry, power=2.0, phase=0.0):
    e = 2.0 / power
    out = []
    for i in range(n):
        a = phase + i / n * TAU
        out.append((rx * spow(math.cos(a), e), ry * spow(math.sin(a), e), a))
    return out


def frame_at(t, up):
    t = Vector(t).normalized()
    up = Vector(up)
    u = up - t * up.dot(t)
    if u.length < 1e-6:
        u = t.orthogonal()
    u.normalize()
    return u, t.cross(u)


def rings_along(path, radii, n=8, up=(0, 0, 1), power=2.0, phase=0.0,
                flute=0.0):
    """Rings across a path; `flute` pulls every other point in (quilted
    channels)."""
    path = [Vector(p) for p in path]
    out = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        u, v = frame_at(b - a, up)
        r = radii[i]
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        ring = []
        for k, (x, y, _) in enumerate(sup(n, rx, ry, power, phase)):
            f = 1.0 - flute if (flute and k % 2) else 1.0
            ring.append(p + (u * x + v * y) * f)
        out.append(ring)
    return out


def loft(name, rings, mat, bands=None, start=None, end=None, closed=True,
         levels=0, creases=(), recalc=True):
    """Bridge rings of equal length. `bands` maps band index to a material
    (or is a function (i, band) -> material). Caps: "pole", "flat", a point
    or None."""
    c = Mesh(name, mat)
    vs = [[c.v(p) for p in r] for r in rings]

    def band_mat(i, j):
        if callable(bands):
            return bands(i, j)
        if bands and j in bands:
            return bands[j]
        return mat

    c.grid(vs, band_mat, closed=closed)
    for cap, ring, is_end in ((start, vs[0], False), (end, vs[-1], True)):
        if cap is None:
            continue
        idx = 0 if not is_end else len(rings) - 1
        pts = [Vector(p) for p in rings[idx]]
        centre = sum(pts, Vector()) / len(pts)
        cm = band_mat(0, "start" if not is_end else "end")
        if cap == "flat":
            c.face(ring if is_end else ring[::-1], cm)
        else:
            c.fan(ring, centre if cap == "pole" else cap, cm,
                  flip=not is_end)
    for k in creases:
        c.crease(vs[k])
    return c.obj(levels=levels, recalc=recalc)


def tube(name, path, radii, mat, n=8, up=(0, 0, 1), power=2.0,
         caps=("dome", "dome"), bands=None, phase=0.0, levels=0, flute=0.0):
    path = [Vector(p) for p in path]
    radii = list(radii)
    rings = rings_along(path, radii, n, up, power, phase, flute)
    s, e = caps
    bands = dict(bands or {})
    if s == "dome":
        d = (path[0] - path[1]).normalized()
        r0 = radii[0] if not isinstance(radii[0], (tuple, list)) \
            else min(radii[0])
        rings.insert(0, [path[0] + (p - path[0]) * 0.6 + d * r0 * 0.55
                         for p in rings[0]])
        bands = {(k + 1 if isinstance(k, int) else k): v
                 for k, v in bands.items()}
        s = path[0] + d * r0 * 0.8
    if e == "dome":
        d = (path[-1] - path[-2]).normalized()
        r1 = radii[-1] if not isinstance(radii[-1], (tuple, list)) \
            else min(radii[-1])
        rings.append([path[-1] + (p - path[-1]) * 0.6 + d * r1 * 0.55
                      for p in rings[-1]])
        e = path[-1] + d * r1 * 0.8
    return loft(name, rings, mat, bands=bands, start=s, end=e, levels=levels)


def ball(name, r, at, mat, scale=(1, 1, 1), seg=10, rings=None):
    obj = kit.sphere(name, r, at, scale=scale, mat=mat, segments=seg,
                     rings=rings or max(4, seg // 2))
    kit.apply_transform(obj)
    return obj


def rbox(name, size, at, mat, levels=2, crease=0.0, matrix=None):
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
    if matrix is not None:
        obj.matrix_world = matrix
    else:
        obj.location = at
    kit.apply_transform(obj)
    return obj


def slab(name, outline, depth, mat, matrix=None, bevel=0.0):
    """Extrude a flat CCW outline from z = 0 to z = depth."""
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
        kit.add_bevel(obj, bevel, 1, angle=40)
        kit.apply(obj)
    if matrix is not None:
        obj.matrix_world = matrix
        kit.apply_transform(obj)
    return obj


def sheet(name, fn, us, vs, mat, rim=0.0, inside=None, closed_u=False,
          back=False, rim_mat=None, rim_edges=("u0", "u1", "v0", "v1")):
    """A garment panel: the surface fn(u, v) over the grid us x vs, facing
    away from `inside`. With `rim`, the boundary is folded back toward
    `inside` by that thickness (a cloth edge with no hidden inner skin);
    `back` adds the full inner skin too."""
    c = Mesh(name, None if callable(mat) else mat)
    pts = [[Vector(fn(u, v)) for u in us] for v in vs]
    rows = [[c.v(p) for p in row] for row in pts]
    faces = c.grid(rows, mat, closed=closed_u)
    bm = c.bm
    bm.normal_update()
    ref = Vector(inside) if inside is not None else None
    flipped = False
    if ref is not None:
        score = sum((f.calc_center_median() - ref).dot(f.normal)
                    for f in faces)
        if score < 0:
            bmesh.ops.reverse_faces(bm, faces=faces)
            bm.normal_update()
            flipped = True
    if rim or back:
        # Offset copies of the verts along their inward normals.
        off = {}
        for row in rows:
            for vert in row:
                off[vert] = c.v(vert.co - vert.normal * rim)
        edges = []
        nu, nv = len(us), len(vs)
        if "v0" in rim_edges:
            edges += [(rows[0][i], rows[0][(i + 1) % nu])
                      for i in range(nu if closed_u else nu - 1)]
        if "v1" in rim_edges:
            edges += [(rows[-1][i], rows[-1][(i + 1) % nu])
                      for i in range(nu if closed_u else nu - 1)]
        if not closed_u:
            if "u0" in rim_edges:
                edges += [(rows[j][0], rows[j + 1][0]) for j in range(nv - 1)]
            if "u1" in rim_edges:
                edges += [(rows[j][-1], rows[j + 1][-1])
                          for j in range(nv - 1)]
        rm = c.m(rim_mat or (mat(0, 0) if callable(mat) else mat))
        for a, b in edges:
            e = bm.edges.get((a, b))
            if not e or not e.link_faces:
                continue
            f = e.link_faces[0]
            # Keep the winding opposite to the neighbouring face.
            loop = next(lp for lp in f.loops if lp.edge == e)
            p, q = loop.vert, loop.link_loop_next.vert
            nf = bm.faces.new((q, p, off[p], off[q]))
            nf.material_index = rm
        if back:
            for j in range(len(rows) - 1):
                for i in range(nu if closed_u else nu - 1):
                    k = (i + 1) % nu
                    a, b = rows[j], rows[j + 1]
                    # The inner skin faces the other way from the outer
                    # one (whose winding may have been reversed above).
                    quad = (off[a[i]], off[b[i]], off[b[k]], off[a[k]])
                    f = bm.faces.new(quad[::-1] if flipped else quad)
                    f.material_index = rm
        # Faces built from a normal-oriented sheet share its winding.
    return c.obj()


def decal(name, fn, pts2d, lift, mat, depth=0.002, eps=1e-3, ref=None):
    """A thin raised appliqué: a flat outline (CCW in the (u, v) parameter
    space of the surface fn) triangulated, lifted `lift` off the surface,
    with a shallow wall `depth` back down toward it."""
    bm = bmesh.new()
    ring = [bm.verts.new((u, v, 0)) for u, v in pts2d]
    f = bm.faces.new(ring)
    bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY",
                          ngon_method="BEAUTY")
    normals = {}
    for vert in bm.verts:
        u, v = vert.co.x, vert.co.y
        p = Vector(fn(u, v))
        du = Vector(fn(u + eps, v)) - Vector(fn(u - eps, v))
        dv = Vector(fn(u, v + eps)) - Vector(fn(u, v - eps))
        n = du.cross(dv).normalized()
        if ref is not None and (p - Vector(ref)).dot(n) < 0:
            n = -n
        normals[vert] = n
        vert.co = p
    # Orient: faces point along the surface normal given by fn's (u, v).
    bm.normal_update()
    avg = sum(normals.values(), Vector()).normalized()
    if sum(f.normal.dot(avg) for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.normal_update()
    nrm = sum((f.normal for f in bm.faces), Vector()).normalized()
    for vert, n in normals.items():
        if n.dot(nrm) < 0:
            normals[vert] = -n
        vert.co += normals[vert] * lift
    if depth:
        low = {}
        for e in [e for e in bm.edges if e.is_boundary]:
            fc = e.link_faces[0]
            loop = next(lp for lp in fc.loops if lp.edge == e)
            p, q = loop.vert, loop.link_loop_next.vert
            for vv in (p, q):
                if vv not in low:
                    low[vv] = bm.verts.new(vv.co - normals[vv] * depth)
            bm.faces.new((q, p, low[p], low[q]))
    return kit._from_bmesh(name, bm, mat)


# ------------------------------------------------------------- placement

def basis(x, y, z, origin):
    x, y, z = Vector(x), Vector(y), Vector(z)
    return Matrix(((x.x, y.x, z.x, origin[0]),
                   (x.y, y.y, z.y, origin[1]),
                   (x.z, y.z, z.z, origin[2]),
                   (0, 0, 0, 1)))


def transform(objs, m):
    kit.refresh()
    flip = m.to_3x3().determinant() < 0
    for o in objs:
        o.matrix_world = m @ o.matrix_world
        kit.apply_transform(o)
        if flip:
            o.data.flip_normals()
    return objs


def ik(root, target, l1, l2, pole):
    root, target, pole = Vector(root), Vector(target), Vector(pole)
    d = target - root
    dist = min(d.length, (l1 + l2) * 0.9995)
    dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    side = pole - root
    side = side - dn * side.dot(dn)
    side.normalize()
    return root + dn * a + side * h


def frame_quat(x0, z0, x1, z1):
    """The rotation taking the frame (x0, z0) onto (x1, z1)."""
    def m(x, z):
        x = Vector(x).normalized()
        z = Vector(z)
        z = (z - x * z.dot(x)).normalized()
        y = z.cross(x)
        return Matrix((x, y, z)).transposed()
    return (m(x1, z1) @ m(x0, z0).transposed()).to_quaternion()


def twist_quat(v0, v1, angle):
    """Shortest rotation from v0 to v1, then a twist about v1."""
    q = Vector(v0).rotation_difference(Vector(v1))
    return Quaternion(Vector(v1).normalized(), angle) @ q


# ------------------------------------------------------------- parts

def uv_box(obj):
    """Per-face planar UVs in texture repeats (see UV_TILE)."""
    me = obj.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        tex = me.materials[f.material_index].name.split(":")[0] \
            if me.materials else "plain"
        tile = UV_TILE.get(tex, kit.TILE.get(tex, 1.0))
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            c = loop.vert.co
            if ax == 2:
                u, v = c.x * (1 if n.z >= 0 else -1), c.y
            elif ax == 0:
                u, v = c.y * (1 if n.x >= 0 else -1), c.z
            else:
                u, v = -c.x * (1 if n.y >= 0 else -1), c.z
            loop[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()


def part(root_name, name, objs, pivot, par, angle=48):
    kit.refresh()
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        uvs = o.data.uv_layers
        while len(uvs):
            uvs.remove(uvs[0])
    obj = kit.join(objs, f"{root_name}.{name}")
    uv_box(obj)
    kit.shade(obj, angle)
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    return obj


def take_parts(pieces, *prefixes):
    """Move existing pieces onto a joint, preserving their world geometry."""
    selected = [p for p in pieces if p.name.startswith(prefixes)]
    assert selected, f"No pieces matched {prefixes}"
    pieces[:] = [p for p in pieces if p not in selected]
    return selected


def face_head(name, pieces, pivot, parent, scale=1.0, angle=62):
    """Keep the painted facial features on the same expressive rig as the
    original figures, without changing the miniature's rest sculpt."""
    import face_rig
    if scale != 1.0:
        transform(pieces, Matrix.Scale(scale, 4))
    return face_rig.head(part, name, pieces, pivot * scale, parent,
                         angle=angle)


def cloth_below(source, name, height, pivot):
    """Split a garment at its seam, retaining paint and UVs. Cloth needs
    no rounded limb socket: the overlapped seam remains inside the belt."""
    import bpy
    import articulation
    kit.refresh()
    lower = articulation.clipped(source, height, True)
    source.data = articulation.clipped(source, height, False)
    child = bpy.data.objects.new(name, lower)
    bpy.context.scene.collection.objects.link(child)
    child.matrix_world = source.matrix_world.copy()
    kit.set_pivot(child, pivot)
    kit.parent(child, source)
    return child


def radial_hits(obj, axis_xy, z, angles, default):
    """Distance from a vertical axis to the mesh along horizontal rays at
    height z, one per angle (0 = +y, toward +x)."""
    from mathutils.bvhtree import BVHTree
    kit.refresh()
    me = obj.data
    verts = [obj.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    out = []
    for a in angles:
        o = Vector((axis_xy[0], axis_xy[1], z))
        d = Vector((math.sin(a), math.cos(a), 0))
        hit = tree.ray_cast(o, d, 1.0)
        out.append((hit[0] - o).length if hit[0] is not None else default)
    return out


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ------------------------------------------------------------- runtime poses

def runtime_quat(rx_, ry_, rz_):
    """The quaternion (Blender axes) of a joint turned by the game: three.js
    applies Euler XYZ in its y-up frame, where three y is Blender z and
    three z is Blender -y, so R = Rx(rx) Rz(ry) Ry(-rz) in Blender terms."""
    return (Quaternion((1, 0, 0), rx_) @ Quaternion((0, 0, 1), ry_) @
            Quaternion((0, 1, 0), -rz_))


def apply_runtime(root, pose):
    """Turn the named parts as the game would: {part: (x, y, z)} in
    three.js Euler terms (see runtime_quat)."""
    for o in kit.descendants(root):
        if o.type != "MESH" or "." not in o.name:
            continue
        key = o.name.split(".", 1)[1]
        if key in pose:
            o.rotation_mode = "QUATERNION"
            o.rotation_quaternion = runtime_quat(*pose[key])
    kit.refresh()


def look(z_axis, y_hint, origin):
    """A frame whose z is `z_axis` and whose y leans toward `y_hint`."""
    z = Vector(z_axis).normalized()
    y = Vector(y_hint) - z * Vector(y_hint).dot(z)
    y.normalize()
    x = y.cross(z)
    return basis(x, y, z, origin)


# ------------------------------------------------------------- heads
# A head sculpted as rings of superellipse sections (the Cowboy's skull,
# figure_ranger.py), with the displacement of its features passed in, so
# each figure keeps its own nose, brow and jaw.

FACE_A = [0, 4, 8.5, 13.5, 19, 25, 32, 41, 52, 66, 82, 100, 124, 152]
FACE_Z = [1.012, 1.03, 1.047, 1.062, 1.075, 1.085, 1.093, 1.101, 1.108,
          1.115, 1.122, 1.131, 1.141, 1.15, 1.159, 1.167, 1.176, 1.187,
          1.202, 1.228, 1.252]


class Head:
    """face_point(ad, z): the skin at `ad` degrees from the front (toward
    +x) and height z, in the shared head space (skull centre HC)."""

    def __init__(self, name, width, front, back, disp, power=2.5,
                 cy=0.012, hc=(0, 0.012, 1.162), scale=1.0):
        self.name = name
        self.width, self.front, self.back = width, front, back
        self.disp = disp
        self.power = power
        self.cy = cy
        self.hc = V(hc)
        self.scale = scale

    def point(self, ad, z):
        a = math.radians(ad)
        w = table(self.width, z) * self.scale
        front = table(self.front, z) * self.scale
        back = table(self.back, z) * self.scale
        e = 2.0 / self.power
        s_, c_ = math.sin(a), math.cos(a)
        x = w * spow(s_, e)
        dd = front if c_ >= 0 else back
        y = dd * spow(c_, e)
        gx = spow(x / w, self.power - 1) / w if x else 0.0
        gy = spow(y / dd, self.power - 1) / dd if y else 0.0
        n = V(gx, gy, 0)
        n = n.normalized() if n.length > 1e-9 else V(0, 1, 0)
        return V(x, self.cy + y, z) + n * self.disp(ad, z)

    def normal(self, ad, z):
        du = self.point(ad + 0.5, z) - self.point(ad - 0.5, z)
        dz = self.point(ad, z + 0.001) - self.point(ad, z - 0.001)
        n = du.cross(dz).normalized()
        if (self.point(ad, z) - self.hc).dot(n) < 0:
            n = -n
        return n

    def skull(self, skin, hair, hairline=None, top=1.268):
        cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
        cols = [a for a in cols if a > -180]
        c = Mesh(f"{self.name}-face", skin)
        rows = [[c.v(self.point(a, z)) for a in cols] for z in FACE_Z]
        n = len(cols)

        def mat(i, j):
            if hairline is None:
                return skin
            a0, a1 = cols[i], cols[(i + 1) % n]
            if i == n - 1:
                a1 += 360
            a = (a0 + a1) / 2
            a = a - 360 if a > 180 else a
            z = (FACE_Z[j] + FACE_Z[j + 1]) / 2
            return hair if z > hairline(a) else skin

        c.grid(rows, mat, closed=True)
        c.fan(rows[-1], V(0, self.cy - 0.005, top),
              hair if hairline else skin)
        return c.obj(outward=self.hc)

    def shell(self, name, mat, top, bottom, th, cols=None, rows=8,
              grow=None):
        """A shell over the skin (stubble, a beard's cheeks) between
        z = bottom(a) and z = top(a), `th` off the surface (or grow(a, z))
        and facing out."""
        cols = cols or [a for a in sorted(set([-a for a in FACE_A] + FACE_A))
                        if abs(a) <= 82]
        c = Mesh(name, mat)
        grid = []
        for a in cols:
            zt, zb = top(a), bottom(a)
            col = []
            for j in range(rows + 1):
                z = lerp(zb, zt, j / rows)
                col.append(c.v(self.point(a, z) + self.normal(a, z) *
                               (grow(a, z) if grow else th)))
            grid.append(col)
        for i in range(len(cols) - 1):
            for j in range(rows):
                c.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1],
                        grid[i][j + 1]))
        return c.obj(outward=self.hc)

    def ears(self, skin, z=1.142):
        out = []
        for sx in (-1, 1):
            p = self.point(sx * 90, z) + V(sx * 0.004, -0.008, 0)
            e = ball(f"{self.name}-ear{sx}", 1.0, V(0, 0, 0), skin,
                     scale=(0.008, 0.02, 0.029), seg=8, rings=5)
            m = Matrix.Translation(p) @ \
                Matrix.Rotation(math.radians(-sx * 14), 4, "Z") @ \
                Matrix.Rotation(math.radians(-10), 4, "X")
            transform([e], m)
            out.append(e)
        return out


def fist(name, c, xax, kax, chir, mat):
    """A closed fist round a pole along Z (the index finger's end), its
    fingertips toward X and knuckles toward K; the wrist is at -X (the
    Cowboy's fist)."""
    zs = [-0.036, -0.029, -0.017, -0.0085, 0.0, 0.0085, 0.017, 0.029, 0.036]
    grooves = {-0.017, 0.0, 0.017}
    cx, cy, hx, hy = -0.0035, 0.002, 0.0325, 0.027
    rings = []
    for z in zs:
        k = 1.0
        if abs(z) > 0.035:
            k = 0.74
        elif abs(z) > 0.03:
            k = 0.93
        if z < 0:
            k *= 0.94
        ring = []
        for x, y, ang in sup(10, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.0022 * (1 if px > 0.004 else 0.5)
                py += 0.0016 if py < -0.01 else 0.0
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0012
                py += 0.0012
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                   end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(tube(f"{name}-thumb", thumb, [0.0098, 0.0086, 0.0078],
                       mat, n=6))
    pieces.append(tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                        V(-0.03, 0.0, 0.0)],
                       [(0.022, 0.027), (0.025, 0.03)], mat, n=8,
                       up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = basis(xax, kax, zax, c)
    transform(pieces, m)
    return pieces


def scale_about(objs, centre, s):
    """Scale pieces about a point (a bigger fist for a bigger figure)."""
    c = Vector(centre)
    m = Matrix.Translation(c) @ Matrix.Diagonal((s, s, s, 1)) @ \
        Matrix.Translation(-c)
    return transform(objs, m)


def pose(root, figure, poses, name):
    """Split the legs at knee and ankle now (articulation.py), so a preview
    pose can bend them, then turn the parts as the game would."""
    import articulation
    articulation.legs(root, figure)
    if name in poses:
        apply_runtime(root, poses[name])


# =========================================================== the eight's own
# Everything below is shared by the figures of 1 October 2026.

T = kit.tint

# One palette of pots: the eight share these names, so at runtime they share
# batches (each material is one draw per team).
TEAM = "weave:team"
TEAM2 = "weave:team2"
TEAM3 = "weave:team3"
INK = "resin:" + T("face-ink", "#242c39")
IVORY = "resin:" + T("face-ivory", "#fff4de")
IRIS = "resin:" + T("folk-iris", "#6b4a2e")
LEATHER = "hide:" + T("folk-leather", "#7a4a2a")
DARK = "hide:" + T("folk-dark", "#2f2622")      # soles, straps, hair
BRASS = "gilt:" + T("folk-brass", "#d6a548")
STEEL = "gilt:" + T("folk-steel", "#9ea7b1")
CREAM = "weave:" + T("folk-cream", "#efe5cc")
WHITE = "weave:" + T("folk-white", "#f6f4ee")
LIP = "resin:" + T("folk-lip", "#a8544c")
SKINS = {
    "fair": "resin:" + T("folk-skin-fair", "#efbe9a"),
    "warm": "resin:" + T("folk-skin-warm", "#d99a6c"),
    "tan": "resin:" + T("folk-skin-tan", "#bf8256"),
    "deep": "resin:" + T("folk-skin-deep", "#8a5634"),
}
HAIRS = {
    "black": "resin:" + T("folk-hair-black", "#211a17"),
    "brown": "resin:" + T("folk-hair-brown", "#5a3520"),
    "auburn": "resin:" + T("folk-hair-auburn", "#93421f"),
    "blond": "resin:" + T("folk-hair-blond", "#d8a85a"),
}

HC = V(0, 0.012, 1.162)          # skull centre in head space


# ------------------------------------------------------------- head sculpts

# Hers: the Medic's soft open face (figure_medic.py).
F_W = [(1.0, 0.026), (1.025, 0.036), (1.045, 0.046), (1.062, 0.0535),
       (1.076, 0.0585), (1.095, 0.0625), (1.12, 0.066), (1.145, 0.069),
       (1.17, 0.071), (1.2, 0.072), (1.225, 0.069), (1.245, 0.061),
       (1.26, 0.045), (1.268, 0.02)]
F_D = [(1.0, 0.028), (1.025, 0.038), (1.045, 0.052), (1.062, 0.064),
       (1.074, 0.07), (1.09, 0.073), (1.12, 0.076), (1.15, 0.074),
       (1.172, 0.08), (1.2, 0.081), (1.225, 0.076), (1.245, 0.066),
       (1.26, 0.048), (1.268, 0.02)]
F_B = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
       (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
       (1.255, 0.066), (1.268, 0.03)]
F_NOSE_H = [(1.1, 0.0), (1.107, 0.005), (1.114, 0.0125), (1.121, 0.0168),
            (1.13, 0.0152), (1.145, 0.0108), (1.16, 0.0064),
            (1.172, 0.003), (1.186, 0.0)]
F_NOSE_S = [(1.11, 11.5), (1.13, 8.0), (1.17, 6.0)]


def her_disp(ad, z):
    a = abs(ad)
    d = table(F_NOSE_H, z) * gauss(ad, 0, table(F_NOSE_S, z))
    d += 0.0048 * gauss(a, 12, 5) * gauss(z, 1.113, 0.006)
    d -= 0.0095 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)
    bz = 1.174 - 0.003 * gauss(a, 9, 8)
    d += 0.0058 * gauss(z, bz, 0.0065) * smooth(52, 30, a)
    d += 0.0075 * gauss(a, 46, 13) * gauss(z, 1.136, 0.012)
    d += 0.004 * gauss(a, 34, 14) * gauss(z, 1.108, 0.014)
    d -= 0.0024 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)
    d += 0.003 * gauss(z, 1.101, 0.0035) * gauss(ad, 0, 14)
    d += 0.0036 * gauss(z, 1.088, 0.004) * gauss(ad, 0, 13)
    d += 0.006 * gauss(z, 1.066, 0.01) * gauss(ad, 0, 17)
    d -= 0.0022 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)
    return d


# His: the Viking's broad head with a straighter, smaller nose.
M_W = [(1.0, 0.03), (1.025, 0.043), (1.045, 0.054), (1.062, 0.061),
       (1.076, 0.065), (1.095, 0.067), (1.12, 0.069), (1.145, 0.072),
       (1.17, 0.074), (1.2, 0.075), (1.225, 0.072), (1.245, 0.064),
       (1.26, 0.047), (1.268, 0.02)]
M_D = [(1.0, 0.03), (1.025, 0.042), (1.045, 0.057), (1.062, 0.068),
       (1.074, 0.073), (1.09, 0.075), (1.12, 0.077), (1.15, 0.074),
       (1.172, 0.081), (1.2, 0.082), (1.225, 0.076), (1.245, 0.066),
       (1.26, 0.048), (1.268, 0.02)]
M_B = F_B
M_NOSE_H = [(1.098, 0.0), (1.105, 0.008), (1.113, 0.019), (1.121, 0.024),
            (1.131, 0.022), (1.146, 0.016), (1.16, 0.009), (1.172, 0.004),
            (1.186, 0.0)]
M_NOSE_S = [(1.11, 12.0), (1.13, 8.5), (1.17, 6.0)]


def his_disp(ad, z):
    a = abs(ad)
    d = table(M_NOSE_H, z) * gauss(ad, 0, table(M_NOSE_S, z))
    d += 0.0065 * gauss(a, 13, 5.5) * gauss(z, 1.113, 0.007)
    d -= 0.011 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)
    bz = 1.174 - 0.004 * gauss(a, 9, 8)
    d += 0.0095 * gauss(z, bz, 0.007) * smooth(54, 30, a)
    d -= 0.0025 * gauss(ad, 0, 4) * gauss(z, 1.17, 0.006)
    d += 0.005 * gauss(a, 45, 13) * gauss(z, 1.136, 0.013)
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)
    d += 0.003 * gauss(z, 1.086, 0.004) * gauss(ad, 0, 12)
    d += 0.009 * gauss(z, 1.066, 0.011) * gauss(ad, 0, 20)
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)
    return d


def head_of(name, sex, scale=1.0, disp=None):
    """A Head for `name`: sex "f" (the Medic's sculpt) or "m"."""
    if sex == "f":
        return Head(name, F_W, F_D, F_B, disp or her_disp, hc=tuple(HC),
                    scale=scale)
    return Head(name, M_W, M_D, M_B, disp or his_disp, hc=tuple(HC),
                scale=scale)


def _patch(H, label, ac, z, width, height, lift, mat, slope=0.0, rings=3,
           seg=16, top_cut=None):
    """A painted oval on the skin round (ac degrees, z): `width` in
    degrees, `height` in metres, raised `lift`. `top_cut` flattens its top
    (a heavy upper lid) at that fraction of the height."""
    bm = bmesh.new()

    def vert(r, t):
        dz = math.sin(t) * height * r
        if top_cut is not None:
            dz = min(dz, height * top_cut)
        u = ac + math.cos(t) * width * r
        v = z + dz + math.cos(t) * slope * r
        p = H.point(u, v)
        n = H.normal(u, v)
        return bm.verts.new(p + n * lift)

    mid = vert(0, 0)
    prev = None
    for k in range(1, rings + 1):
        cur = [vert(k / rings, i / seg * TAU) for i in range(seg)]
        for i in range(seg):
            j = (i + 1) % seg
            if prev:
                bm.faces.new((prev[i], prev[j], cur[j], cur[i]))
            else:
                bm.faces.new((mid, cur[i], cur[j]))
        prev = cur
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - H.hc) < 0:
            f.normal_flip()
    obj = kit._from_bmesh(f"{H.name}-{label}", bm, mat)
    kit.shade(obj)
    return obj


def eyes(H, z=1.1565, spread=27, squint=0.82, frown=0.006, iris=IRIS,
         brows=True, brow_mat=INK):
    """Painted eyes with a focused, determined look: the whites a little
    narrowed under a flat upper lid, the pupils centred, and brows drawn
    down toward the nose (no smile anywhere)."""
    out = []
    for sx in (-1, 1):
        ac = sx * spread
        slope = sx * 0.0016
        out.append(_patch(H, f"eye-outline{sx}", ac, z, 15.0, 0.0138 * squint,
                          0.003, INK, slope, top_cut=0.62))
        out.append(_patch(H, f"eye-white{sx}", ac, z - 0.0004, 13.2,
                          0.0118 * squint, 0.004, IVORY, slope,
                          top_cut=0.5))
        out.append(_patch(H, f"iris{sx}", ac - sx * 0.6, z, 6.4,
                          0.0098 * squint, 0.005, iris, top_cut=0.52,
                          rings=2))
        out.append(_patch(H, f"pupil{sx}", ac - sx * 0.6, z, 3.6,
                          0.0078 * squint, 0.0058, INK, top_cut=0.56,
                          rings=2, seg=12))
        out.append(_patch(H, f"glint{sx}", ac - sx * 2.6, z + 0.0035, 1.8,
                          0.0026, 0.0065, IVORY, rings=1, seg=8))
        if brows:
            # Inner ends low and close (the frown), outer ends lifted.
            inner, outer = ac - sx * 14, ac + sx * 15
            zi = z + 0.0155 - frown * 0.4
            zo = z + 0.023 + frown * 0.15
            pts = [(inner, zi), (ac, z + 0.0225), (outer, zo),
                   (outer, zo + 0.0058), (ac, z + 0.0292),
                   (inner, zi + 0.0068)]
            if sx < 0:
                pts = pts[::-1]
            out.append(decal(f"{H.name}-brow{sx}", H.point, pts, 0.0048,
                             brow_mat, depth=0.001, eps=0.05, ref=H.hc))
    return out


def mouth(H, z=1.0965, kind="firm", lips=None):
    """`firm`: a set straight line, corners a touch down. `grit`: teeth
    clenched in effort. `open`: a shout (an oval with the teeth above)."""
    out = []
    if kind == "firm":
        line = [(-19, z - 0.003), (-9, z + 0.0012), (0, z + 0.0018),
                (9, z + 0.0012), (19, z - 0.003), (19, z - 0.0062),
                (9, z - 0.0026), (0, z - 0.0024), (-9, z - 0.0026),
                (-19, z - 0.0062)]
        out.append(decal(f"{H.name}-mouth", H.point, line[::-1], 0.0034,
                         INK, depth=0.0005, eps=0.05, ref=H.hc))
    elif kind == "grit":
        # Corners pulled down: a grimace, never a grin.
        outline = [(-22, z - 0.0045), (-12, z + 0.0035), (0, z + 0.0045),
                   (12, z + 0.0035), (22, z - 0.0045), (12, z - 0.0085),
                   (0, z - 0.009), (-12, z - 0.0085)]
        teeth = [(-15, z - 0.0018), (-8, z + 0.0018), (0, z + 0.0024),
                 (8, z + 0.0018), (15, z - 0.0018), (8, z - 0.0054),
                 (0, z - 0.0058), (-8, z - 0.0054)]
        out.append(decal(f"{H.name}-mouth", H.point, outline[::-1], 0.0035,
                         INK, depth=0.0005, eps=0.05, ref=H.hc))
        out.append(decal(f"{H.name}-teeth", H.point, teeth[::-1], 0.0045,
                         IVORY, depth=0.0005, eps=0.05, ref=H.hc))
    else:
        outline = [(-15, z + 0.003), (-7, z + 0.0065), (0, z + 0.007),
                   (7, z + 0.0065), (15, z + 0.003), (10, z - 0.011),
                   (0, z - 0.015), (-10, z - 0.011)]
        teeth = [(-11, z + 0.002), (0, z + 0.0045), (11, z + 0.002),
                 (8, z - 0.001), (0, z - 0.0005), (-8, z - 0.001)]
        out.append(decal(f"{H.name}-mouth", H.point, outline[::-1], 0.0035,
                         INK, depth=0.0005, eps=0.05, ref=H.hc))
        out.append(decal(f"{H.name}-teeth", H.point, teeth[::-1], 0.0045,
                         IVORY, depth=0.0005, eps=0.05, ref=H.hc))
    if lips:
        zm = z
        pts = [(-21, zm + 0.004), (-10, zm + 0.0058), (0, zm + 0.005),
               (10, zm + 0.0058), (21, zm + 0.004), (14, zm - 0.008),
               (0, zm - 0.012), (-14, zm - 0.008)]
        out.append(decal(f"{H.name}-lips", H.point, pts[::-1], 0.0029, lips,
                         depth=0.0006, eps=0.05, ref=H.hc))
    return out


def neck(name, skin, r=0.042, top=1.095, bottom=0.965, lean=0.008):
    return tube(f"{name}-neck", [V(0, -0.004, bottom),
                                 V(0, 0.0, lerp(bottom, top, 0.55)),
                                 V(0, lean, top)],
                [r, r * 0.97, r * 0.94], skin, n=12, caps=(None, None))


def hair_shell(H, name, mat, hairline, top=1.262, th=0.016, back=1.0,
               cols=24, rows=7, wave=0.0018):
    """Hair as a smooth shell over the skull from `hairline(a)` up to the
    crown, fuller at the back by `back`."""
    angles = [i * 360.0 / cols - 180 for i in range(cols)]
    ts = [j / rows for j in range(rows + 1)]
    c = Mesh(name, mat)
    grid = []
    for a in angles:
        z0 = hairline(a)
        col = []
        for t in ts[:-1]:
            z = lerp(z0, top, t)
            k = th * smooth(0.0, 0.3, t) * (1 - 0.4 * smooth(0.6, 1.0, t))
            k *= 0.85 + 0.3 * back * max(0.0, -math.cos(math.radians(a)))
            k += wave * math.sin(math.radians(a) * 6 + t * 5) * \
                smooth(0.05, 0.4, t)
            col.append(c.v(H.point(a, z) + H.normal(a, z) * (k + 0.0008)))
        grid.append(col)
    n = len(angles)
    for i in range(n):
        k = (i + 1) % n
        for j in range(len(ts) - 2):
            c.face((grid[i][j], grid[k][j], grid[k][j + 1], grid[i][j + 1]))
    c.fan([grid[i][-1] for i in range(n)], V(0, H.cy - 0.004, top + 0.004))
    return c.obj(outward=H.hc)


# ------------------------------------------------------------- body pieces

def section_of(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def ring_point(rows, power, a, z, extra=0.0, cx=0.0, cy=0.0):
    """A point on a superellipse section of `rows` [(z, half width, front,
    back)] at angle a (0 = front, +90 degrees toward +x)."""
    rx_, ryf, ryb = section_of(rows, z)
    e = 2.0 / power
    s, c = math.sin(a), math.cos(a)
    return V(cx + (rx_ + extra) * spow(s, e),
             cy + ((ryf if c >= 0 else ryb) + extra) * spow(c, e), z)


def trunk(name, rows, power, mat, n=20, top=None, bottom=None, bands=None,
          fn=None, zs=None):
    """A closed body of superellipse sections; `fn(a, z)` may replace
    ring_point (to sculpt a belly or a bust); `zs` adds rows between."""
    zs = zs or [r[0] for r in rows]
    pt = fn or (lambda a, z: ring_point(rows, power, a, z))
    rings = [[pt(i / n * TAU, z) for i in range(n)] for z in zs]
    return loft(name, rings, mat, bands=bands, start=bottom, end=top)


def shoe(name, sx, ankle, toe_out, mat, sole=DARK, length=1.0, width=1.0,
         height=1.0, toe=None, heel=True, n=10):
    """A rounded shoe or boot foot on the ground under `ankle`, toe along
    +y: `length`, `width` and `height` scale the Medic's last; `toe` paints
    the toe cap another pot."""
    pieces = []
    foot = [(-0.062, 0.025, 0.034, 0.062), (-0.052, 0.036, 0.028, 0.082),
            (-0.028, 0.042, 0.028, 0.088), (0.012, 0.043, 0.024, 0.076),
            (0.05, 0.042, 0.02, 0.064), (0.088, 0.037, 0.018, 0.056),
            (0.115, 0.029, 0.019, 0.05), (0.134, 0.017, 0.022, 0.043)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in sup(n, rx_ * width, (zt - zb) / 2 * height, 2.4,
                           math.pi / n):
            ring.append(V(x, y * length, ((zb + zt) / 2) * height + z))
        rings.append(ring)
    bands = (lambda i, j: toe if j in (5, 6, 7, "end") else None) if toe \
        else None
    pieces.append(loft(f"{name}-foot{sx}", rings, mat, bands=bands,
                       start=V(0, -0.067 * length, 0.048 * height),
                       end=V(0, 0.141 * length, 0.033 * height)))
    if sole is None:
        place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
            Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
        transform(pieces, place)
        return pieces
    # The sole under it.
    so = [V(x * width, (y + 0.036) * length, 0.0) for x, y, _ in
          sup(14, 0.049, 0.103, 2.6)]
    rings = [[V(p.x * 0.96, p.y * 0.99, 0.0) for p in so],
             [V(p.x, p.y, 0.012) for p in so],
             [V(p.x * 0.97, p.y * 0.985, 0.024) for p in so]]
    pieces.append(loft(f"{name}-sole{sx}", rings, sole, start="flat",
                       end="flat"))
    if heel:
        hl = []
        for z, s in ((0.0, 0.9), (0.02, 1.0), (0.03, 1.0)):
            hl.append([V(x * s * width, (-0.045 + y * s) * length, z) for
                       x, y, _ in sup(8, 0.033, 0.026, 2.6)])
        pieces.append(loft(f"{name}-heel{sx}", hl, sole, start="flat",
                           end="flat"))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    transform(pieces, place)
    return pieces


def limb(name, path, radii, mat, n=12, caps=(None, None), flute=0.0,
         power=2.0, up=(0, 1, 0)):
    return tube(name, path, radii, mat, n=n, up=up, caps=caps, flute=flute,
                power=power)


def grip_frame(f, g, chir):
    """Axes for fist(): fingertips across `f` (the forearm's way) and the
    gripped pole along `g`; chir -1 for the right hand, 1 for the left."""
    g = Vector(g).normalized()
    f = Vector(f)
    xax = (f - g * f.dot(g)).normalized()
    kax = g.cross(xax) * chir
    return xax, kax


def hand(name, c, f, g, chir, mat, scale=1.0):
    """A fist at `c` gripping a pole along `g`, the forearm coming along
    `f` (toward the fist)."""
    xax, kax = grip_frame(f, g, chir)
    pieces = fist(name, c, xax, kax, chir, mat)
    if scale != 1.0:
        scale_about(pieces, c, scale)
    return pieces


def palm(name, c, f, n, chir, mat, scale=1.0):
    """An open hand, fingers together (a slap): the palm faces `n`, the
    fingers point along `f`, the thumb along the palm's inner edge."""
    f = Vector(f).normalized()
    n = Vector(n)
    n = (n - f * n.dot(f)).normalized()
    side = f.cross(n) * chir
    P = []
    rings = []
    for t, w, d in ((-0.04, 0.026, 0.017), (-0.015, 0.034, 0.019),
                    (0.02, 0.037, 0.016), (0.055, 0.035, 0.013),
                    (0.08, 0.03, 0.011), (0.095, 0.019, 0.009)):
        rings.append([V(x, t, y) for x, y, _ in sup(12, w, d, 2.8)])
    P.append(loft(f"{name}-palm", rings, mat, start="pole", end="pole"))
    P.append(tube(f"{name}-thumb", [V(0.026, -0.01, 0.004),
                                    V(0.042, 0.018, 0.008),
                                    V(0.046, 0.042, 0.006)],
                  [0.011, 0.0095, 0.008], mat, n=6))
    m = basis(side, f, n, c)
    transform(P, m)
    if scale != 1.0:
        scale_about(P, c, scale)
    return P


def split_legs(root, name, knee_z=0.36, ankle_z=0.1):
    """Knees and ankles (articulation.py at chosen heights), so previews
    can bend them; figures.py leaves a leg alone once it has them."""
    import articulation
    for side in ("L", "R"):
        leg = next((o for o in kit.descendants(root)
                    if o.name == f"{name}.leg{side}"), None)
        if leg is None or any(o.name == f"{name}.knee{side}"
                              for o in kit.descendants(root)):
            continue
        kit.apply(leg)
        shin = articulation.split_below(leg, f"{name}.knee{side}", knee_z)
        articulation.split_below(shin, f"{name}.foot{side}", ankle_z)


def finish(root, name, poses, knee_z=0.36, ankle_z=0.1):
    split_legs(root, name, knee_z, ankle_z)
    report(root, name)
    p = os.environ.get(f"{name.upper()}_POSE")
    if p in poses:
        apply_runtime(root, poses[p])
    return root


def report(root, name):
    print(f"{name.upper()} joints:")
    total = 0
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            total += tris(o)
            print(f"  {o.name:20s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print(f"{name.upper()} tris {total} materials {len(mats)} {mats}")
