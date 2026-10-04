"""Private modelling helpers for the collector Inventor (figure_inventor.py),
copied from figure_ranger_kit.py so edits to other figures never move it.

Everything here builds plain bmesh geometry in world space: parametric
sheets (a garment panel from a surface function), lofts of rings, tubes
along paths, rounded blocks and extruded outlines, plus the small bits of
rotation maths the pose solver needs. Pieces are joined into jointed parts
by `part()`, which puts the origin on the joint without any rotation.
"""

import math

import bmesh
import kit
from mathutils import Matrix, Quaternion, Vector

TAU = math.tau

# Metres per texture repeat for the Inventor's surfaces: the miniature
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
