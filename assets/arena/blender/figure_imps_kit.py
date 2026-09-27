"""Private hard-surface helpers for the collector Robot (figure_imps.py).

Copied from tin_kit.py and extended, so edits to the old toy troops never
move this figure. Every helper returns a plain world-space mesh object:
bevelled blocks (optionally tapered, or oriented along any frame), lathed
parts aimed along any axis, squircle lofts (waist bands, bellows, limbs),
flat die-cut plates with holes, rivets. `part()` joins pieces into one
jointed part with weighted normals, so flat enamel stays flat and only
the bevels catch the light.
"""

import math
import os

import bmesh
import kit
from mathutils import Matrix, Vector

TAU = math.tau
X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


def lerp(a, b, t):
    return a + (b - a) * t


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


# ------------------------------------------------------------- placement

def frame(axis, up=None):
    """A rotation taking local z to `axis` and local y toward `up`."""
    z = Vector(axis).normalized()
    if up is None:
        up = Z if abs(z.z) < 0.9 else Y
    x = Vector(up).cross(z).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()


def basis(x, y, z, origin):
    x, y, z = Vector(x), Vector(y), Vector(z)
    return Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0, 0, 0, 1)))


def flip_if_mirrored(obj, m):
    if m.determinant() < 0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for f in bm.faces:
            f.normal_flip()
        bm.to_mesh(obj.data)
        bm.free()


def place(obj, at=(0, 0, 0), axis=Z, up=None):
    """Move a piece built round the origin (along +z) to `at`, aimed."""
    obj.matrix_world = Matrix.Translation(Vector(at)) @ frame(axis, up)
    kit.apply_transform(obj)
    return obj


def transform(objs, m):
    kit.refresh()
    for o in objs:
        kit.apply(o)
        o.matrix_world = m @ o.matrix_world
        kit.apply_transform(o)
        flip_if_mirrored(o, m)
    return objs


# ------------------------------------------------------------- pieces

def block(name, size, at, mat, bevel=0.01, seg=2, taper=None, angle=35,
          matrix=None, cuts=0):
    """A bevelled box centred on `at`. `taper` scales the top face (x, y).
    `matrix` (a rotation) turns it about its centre first. `cuts` splits
    every face into a grid, so baked AO has vertices to live on."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts,
                                  use_grid_fill=True)
    if taper:
        for v in bm.verts:
            f = 0.5 + v.co.z / size[2]
            v.co.x *= 1 + (taper[0] - 1) * f
            v.co.y *= 1 + (taper[1] - 1) * f
    obj = kit._from_bmesh(name, bm, mat)
    if bevel:
        kit.add_bevel(obj, bevel, seg, angle)
        kit.apply(obj)
    m = Matrix.Translation(Vector(at))
    if matrix is not None:
        m = m @ matrix.to_4x4()
    obj.matrix_world = m
    kit.apply_transform(obj)
    return obj


def obox(name, centre, u, n, size, mat, bevel=0.0, seg=1):
    """A box centred on `centre` with its x along `u` and z along `n`
    (a strip lying on a surface of normal n)."""
    u = Vector(u).normalized()
    n = Vector(n)
    n = (n - u * n.dot(u)).normalized()
    w = n.cross(u)
    rot = Matrix((u, w, n)).transposed()
    return block(name, size, centre, mat, bevel=bevel, seg=seg, matrix=rot)


def sheet(name, centre, u, n, w, h, nu, nv, mat):
    """A flat single-sided grid `w` along `u` by `h`, facing `n`: a panel
    face with inner vertices for the AO bake."""
    u = Vector(u).normalized()
    n = Vector(n)
    n = (n - u * n.dot(u)).normalized()
    v = n.cross(u)
    c = Vector(centre)
    bm = bmesh.new()
    rows = [[bm.verts.new(c + u * w * (i / nu - 0.5) + v * h * (j / nv - 0.5))
             for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1],
                          rows[j + 1][i]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.dot(n) < 0:
        for f in bm.faces:
            f.normal_flip()
    return kit._from_bmesh(name, bm, mat)


def turned(name, profile, at, axis=Z, mat=None, segments=16, up=None,
           close=True):
    """A lathe of (radius, height) points about local z, then aimed."""
    obj = kit.lathe(name, profile, segments=segments, mat=mat, close=close)
    return place(obj, at, axis, up)


def disc(name, r, depth, at, axis=Z, mat=None, segments=16, chamfer=0.0,
         both=False, close=True):
    """A short cylinder centred on `at` along `axis`; `chamfer` bevels its
    +axis rim (both rims with `both`)."""
    c = chamfer
    prof = [(r - c, -depth / 2), (r, -depth / 2 + c)] if c and both \
        else [(r, -depth / 2)]
    prof += [(r, depth / 2 - c), (r - c, depth / 2)] if c else \
        [(r, depth / 2)]
    return turned(name, prof, at, axis, mat, segments, close=close)


def rod(name, a, b, r, mat, segments=8, cap=True):
    a, b = Vector(a), Vector(b)
    obj = kit.lathe(name, [(r, 0), (r, (b - a).length)], segments=segments,
                    mat=mat, close=cap)
    return place(obj, a, b - a)


def dome(name, r, h, at, axis=Z, mat=None, segments=12, rings=3):
    """A low dome (lamp, eye) standing on `at`, its base open."""
    prof = []
    for i in range(rings + 1):
        a = i / rings * math.pi / 2
        prof.append((r * math.cos(a), h * math.sin(a)))
    prof[-1] = (0.0, h)
    return turned(name, prof, at, axis, mat, segments, close=False)


def rivet(name, at, normal, r, mat, segments=5):
    """A round-headed rivet sitting on a surface (buried base left open)."""
    prof = [(r, 0.0), (r * 0.78, r * 0.48), (0.0, r * 0.66)]
    obj = kit.lathe(name, prof, segments=segments, mat=mat, close=False)
    return place(obj, Vector(at) - Vector(normal) * r * 0.15, normal)


def rivet_row(name, a, b, count, normal, r, mat, ends=True):
    a, b = Vector(a), Vector(b)
    out = []
    for i in range(count):
        t = i / (count - 1) if ends else (i + 0.5) / count
        out.append(rivet(f"{name}{i}", a.lerp(b, t), normal, r, mat))
    return out


def sq(n, rx, ry, power=2.0, phase=0.0):
    """(x, y) round a superellipse, counter-clockwise from +x."""
    e = 2.0 / power
    return [(rx * spow(math.cos(phase + i / n * TAU), e),
             ry * spow(math.sin(phase + i / n * TAU), e)) for i in range(n)]


def loft(name, rings, mat, bands=None, start=None, end=None, closed=True):
    """Bridge rings of equal length; `bands(i)` may give a material per
    band; caps "flat", "pole" or None."""
    bm = bmesh.new()
    mats = [mat]

    def mi(m):
        if m is None:
            return 0
        if m not in mats:
            mats.append(m)
        return mats.index(m)

    vs = [[bm.verts.new(Vector(p)) for p in r] for r in rings]
    n = len(vs[0])
    for i in range(len(vs) - 1):
        a, b = vs[i], vs[i + 1]
        m = mi(bands(i) if bands else None)
        for j in range(n if closed else n - 1):
            k = (j + 1) % n
            bm.faces.new((a[j], a[k], b[k], b[j])).material_index = m
    for cap, ring, is_end in ((start, 0, False), (end, -1, True)):
        if not cap:
            continue
        r = vs[ring]
        if cap == "flat":
            bm.faces.new(r if is_end else list(reversed(r))).material_index \
                = mi(None)
        else:
            pts = [Vector(p) for p in rings[ring]]
            c = bm.verts.new(sum(pts, Vector()) / len(pts))
            for j in range(n):
                k = (j + 1) % n
                vv = (c, r[j], r[k]) if is_end else (c, r[k], r[j])
                bm.faces.new(vv)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm)
    for m in mats:
        obj.data.materials.append(kit.material(m))
    return obj


def sq_lathe(name, profile, mat, n=16, power=4.0, cx=0.0, cy=0.0,
             bands=None, start="flat", end="flat"):
    """Stacked squircle rings: `profile` holds (z, rx, ry)."""
    rings = [[(cx + x, cy + y, z) for x, y in sq(n, rx, ry, power)]
             for z, rx, ry in profile]
    return loft(name, rings, mat, bands=bands, start=start, end=end)


def sq_tube(name, path, radii, mat, n=8, power=3.0, up=Z, start="flat",
            end="flat", bands=None):
    """Squircle rings across a path; `radii` holds (rx, ry): rx across,
    ry along `up`'s side."""
    path = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        t = (b - a).normalized()
        u = Vector(up) - t * Vector(up).dot(t)
        u.normalize()
        w = t.cross(u)
        rx, ry = radii[i]
        rings.append([p + w * x + u * y
                      for x, y in sq(n, rx, ry, power, math.pi / n)])
    return loft(name, rings, mat, bands=bands, start=start, end=end)


def cassini(a, b, n=40):
    """A Cassini oval: a peanut with a waist when b is a little over a."""
    pts = []
    for i in range(n):
        t = i / n * TAU
        c2, s2 = math.cos(2 * t), math.sin(2 * t)
        r = math.sqrt(max(0.0, a * a * c2 +
                          math.sqrt(max(0.0, b ** 4 - a ** 4 * s2 * s2))))
        pts.append((r * math.cos(t), r * math.sin(t)))
    return pts


def circle(cx, cy, r, n=12, start=0.0):
    return [(cx + r * math.cos(start + i / n * TAU),
             cy + r * math.sin(start + i / n * TAU)) for i in range(n)]


def plate(name, outline, thick, mat, holes=(), matrix=None, bevel=0.0,
          seg=1, rim_only=True):
    """A flat die-cut plate from an (x, y) outline (counter-clockwise) with
    optional holes, centred on z = 0 and `thick` deep, then moved by
    `matrix`. `rim_only` bevels the outline but not the holes."""
    bm = bmesh.new()
    edges = []
    for loop in [outline, *holes]:
        vs = [bm.verts.new((x, y, -thick / 2)) for x, y in loop]
        for v0, v1 in zip(vs, vs[1:] + vs[:1]):
            edges.append(bm.edges.new((v0, v1)))
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False,
                            edges=edges, normal=(0, 0, 1))
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts[:],
                             edges=bm.edges[:])
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    moved = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, thick)), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel and rim_only:
        outer = {(round(x, 6), round(y, 6)) for x, y in outline}
        layer = bm.edges.layers.float.get("bevel_weight_edge") or \
            bm.edges.layers.float.new("bevel_weight_edge")
        for e in bm.edges:
            a, b = e.verts
            if abs(a.co.z - b.co.z) < 1e-7 and all(
                    (round(v.co.x, 6), round(v.co.y, 6)) in outer
                    for v in (a, b)):
                e[layer] = 1.0
    obj = kit._from_bmesh(name, bm, mat)
    if bevel:
        mod = kit.add_bevel(obj, bevel, seg, 35)
        if rim_only:
            mod.limit_method = "WEIGHT"
        kit.apply(obj)
    if matrix is not None:
        transform([obj], matrix)
    return obj


def slab(name, outline, depth, mat, matrix=None, bevel=0.0, seg=1):
    """Extrude a simple convex-ish outline (counter-clockwise) from
    z = -depth/2 to depth/2, then move it by `matrix`."""
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, -depth / 2)) for x, y in outline]
    top = [bm.verts.new((x, y, depth / 2)) for x, y in outline]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm, mat)
    if bevel:
        kit.add_bevel(obj, bevel, seg, 40)
        kit.apply(obj)
    if matrix is not None:
        transform([obj], matrix)
    return obj


# ------------------------------------------------------------- parts

def tris(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in objs)


def uv_box(obj, tile=0.3):
    me = obj.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
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


def weighted(obj, weight=100):
    mod = obj.modifiers.new("weighted", "WEIGHTED_NORMAL")
    mod.mode = "FACE_AREA"
    mod.weight = weight
    mod.keep_sharp = True
    kit.apply(obj)
    return obj


def part(root, name, objs, pivot, par, angle=40):
    """Join pieces into one jointed part `<root>.<name>` with its origin on
    `pivot`, no rest rotation, weighted normals."""
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        while o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers[0])
    if os.environ.get("IMPS_DEBUG"):
        tally = {}
        for o in objs:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + tris([o])
        print(f"PART {name}: {tris(objs)}  " + " ".join(
            f"{k}={v}" for k, v in sorted(tally.items(),
                                          key=lambda kv: -kv[1])))
    obj = kit.join(objs, f"{root}.{name}")
    uv_box(obj)
    kit.shade(obj, angle)
    weighted(obj)
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    obj.rotation_euler = (0, 0, 0)
    return obj
