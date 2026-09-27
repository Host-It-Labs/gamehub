"""Tin-toy building blocks for Arena's Robots and Biplane (see troops.py).

Hard-surface pieces in world space, like troopkit's: bevelled blocks,
lathed parts aimed along any axis, flat die-cut plates (with holes) cut from
an outline, lofted rings and oval tubes, rivets. `part()` joins pieces like
troopkit.part and then gives the part weighted normals, so every flat tin
face stays flat and only its bevels bend the light.
"""

import math
import os

import bmesh
import kit
from mathutils import Matrix, Vector
from troopkit import finish

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))
CHROME = "chrome:silver"


def frame(axis, up=None):
    """A rotation taking local z to `axis` and local y toward `up`."""
    z = Vector(axis).normalized()
    if up is None:
        up = Z if abs(z.z) < 0.9 else Y
    x = Vector(up).cross(z).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()


def place(obj, at=(0, 0, 0), axis=Z, up=None):
    """Move a piece built round the origin (along +z) to `at`, aimed."""
    obj.matrix_world = Matrix.Translation(Vector(at)) @ frame(axis, up)
    kit.apply_transform(obj)
    return obj


def block(name, size, at, mat, bevel=0.01, seg=2, taper=None, cuts=0,
          angle=35):
    """A bevelled box centred on `at`. `taper` scales the top face (x, y);
    `cuts` splits it along x and y so long plates carry baked AO."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if cuts:
        edges = [e for e in bm.edges
                 if abs((e.verts[0].co - e.verts[1].co).z) < 1e-6]
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=cuts,
                                  use_grid_fill=True)
    if taper:
        for v in bm.verts:
            f = 0.5 + v.co.z / size[2]
            v.co.x *= 1 + (taper[0] - 1) * f
            v.co.y *= 1 + (taper[1] - 1) * f
    obj = kit._from_bmesh(name, bm, mat)
    obj.location = at
    if bevel:
        kit.add_bevel(obj, bevel, seg, angle)
    return obj


def turned(name, profile, at, axis=Z, mat=CHROME, segments=16, up=None,
           bevel=0.0, seg=2, close=True):
    """A lathe of (radius, height) points about local z, then aimed."""
    obj = kit.lathe(name, profile, segments=segments, mat=mat, close=close)
    place(obj, at, axis, up)
    if bevel:
        kit.add_bevel(obj, bevel, seg, 35)
    return obj


def disc(name, r, depth, at, axis=Z, mat=CHROME, segments=16, chamfer=0.0,
         r2=None, both=False):
    """A short cylinder centred on `at`, along `axis`; `chamfer` rounds
    its outer (+axis) rim with one cheap bevel step, both rims if `both`."""
    r2 = r if r2 is None else r2
    c = chamfer
    prof = [(r - c, -depth / 2), (r, -depth / 2 + c)] if c and both \
        else [(r, -depth / 2)]
    prof += [(r2, depth / 2 - c), (r2 - c, depth / 2)] if c \
        else [(r2, depth / 2)]
    return turned(name, prof, at, axis, mat, segments)


def rod(name, a, b, r, mat=CHROME, segments=8, cap=True):
    """A plain round rod from `a` to `b`."""
    a, b = Vector(a), Vector(b)
    obj = kit.lathe(name, [(r, 0), (r, (b - a).length)], segments=segments,
                    mat=mat, close=cap)
    return place(obj, a, b - a)


def dome(name, r, h, at, axis=Z, mat=CHROME, segments=12, rings=3,
         base=False):
    """A low dome (lamp, eye, spinner) standing on `at`; its base is left
    open unless `base`."""
    prof = []
    for i in range(rings + 1):
        a = i / rings * math.pi / 2
        prof.append((r * math.cos(a), h * math.sin(a)))
    prof[-1] = (0.0, h)
    return turned(name, prof, at, axis, mat, segments, close=base)


def rivet(name, at, normal, r=0.008):
    """A round-headed chrome rivet sitting on a surface (its buried base
    left open)."""
    prof = [(r, 0.0), (r * 0.72, r * 0.5), (0.0, r * 0.68)]
    obj = kit.lathe(name, prof, segments=6, mat=CHROME, close=False)
    return place(obj, Vector(at) - Vector(normal) * r * 0.12, normal)


def cassini(a, b, n=40):
    """A Cassini oval: a peanut with a waist when b is a little over a."""
    pts = []
    for i in range(n):
        t = i / n * math.tau
        c2 = math.cos(2 * t)
        s2 = math.sin(2 * t)
        r2 = a * a * c2 + math.sqrt(max(0.0, b ** 4 - a ** 4 * s2 * s2))
        r = math.sqrt(max(0.0, r2))
        pts.append((r * math.cos(t), r * math.sin(t)))
    return pts


def circle(cx, cy, r, n=12, start=0.0):
    return [(cx + r * math.cos(start + i / n * math.tau),
             cy + r * math.sin(start + i / n * math.tau)) for i in range(n)]


def plate(name, outline, thick, mat, holes=(), at=(0, 0, 0), axis=Z,
          up=None, bevel=0.0, seg=2, rim_only=False):
    """A flat die-cut plate: an (x, y) outline (counter-clockwise) with
    optional holes, `thick` deep along local z, then aimed like place().
    `rim_only` bevels the outline but leaves the holes sharp (cheaper)."""
    bm = bmesh.new()
    edges = []
    for loop in [outline, *holes]:
        vs = [bm.verts.new((x, y, -thick / 2)) for x, y in loop]
        for v0, v1 in zip(vs, vs[1:] + vs[:1]):
            edges.append(bm.edges.new((v0, v1)))
    faces = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False,
                                    edges=edges, normal=(0, 0, 1))["geom"]
    faces = [f for f in faces if isinstance(f, bmesh.types.BMFace)]
    # Merge the fill back into as few faces as it can (a flat cap).
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts[:],
                             edges=bm.edges[:])
    faces = bm.faces[:]
    ext = bmesh.ops.extrude_face_region(bm, geom=faces)
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
    place(obj, at, axis, up)
    if bevel:
        mod = kit.add_bevel(obj, bevel, seg, 35)
        if rim_only:
            mod.limit_method = "WEIGHT"
    return obj


def loft(name, rings, mat, caps=(True, True)):
    """Join rings of 3D points (all the same length, closed loops) into one
    surface, capping the first and last ring with flat faces."""
    bm = bmesh.new()
    vs = [[bm.verts.new(Vector(p)) for p in ring] for ring in rings]
    n = len(vs[0])
    for r0, r1 in zip(vs, vs[1:]):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((r0[j], r0[k], r1[k], r1[j]))
    if caps[0]:
        bm.faces.new(list(reversed(vs[0])))
    if caps[1]:
        bm.faces.new(vs[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit._from_bmesh(name, bm, mat)


def superellipse(a, b, n=2.0, segments=16, start=0.0):
    """(x, y) points of |x/a|^n + |y/b|^n = 1 (a squircle when n > 2)."""
    out = []
    for i in range(segments):
        t = start + i / segments * math.tau
        c, s = math.cos(t), math.sin(t)
        out.append((a * math.copysign(abs(c) ** (2 / n), c),
                    b * math.copysign(abs(s) ** (2 / n), s)))
    return out


def centroid(objs):
    """The area-weighted centre of a set of meshes (modifiers applied)."""
    total, acc = 0.0, Vector()
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        for p in o.data.polygons:
            total += p.area
            acc += p.center * p.area
    return acc / max(total, 1e-9)


def oval_tube(name, centre, widths, heights, mat, up=Z, segments=6,
              caps=(True, True)):
    """A tube with an oval section through 3D points: `widths` across the
    path (perpendicular to `up`), `heights` along `up`."""
    pts = [Vector(p) for p in centre]
    up = Vector(up).normalized()
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        d = (b - a).normalized()
        side = up.cross(d).normalized()
        lift = d.cross(side).normalized()
        ring = []
        for j in range(segments):
            ang = (j + 0.5) / segments * math.tau
            ring.append(bm.verts.new(p + side * math.cos(ang) * widths[i] / 2
                                     + lift * math.sin(ang) * heights[i] / 2))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(segments):
            k = (j + 1) % segments
            bm.faces.new((r0[j], r0[k], r1[k], r1[j]))
    if caps[0]:
        bm.faces.new(list(reversed(rings[0])))
    if caps[1]:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit._from_bmesh(name, bm, mat)


def weighted(obj, weight=100):
    """Weighted normals: big flat faces keep their own normal."""
    mod = obj.modifiers.new("weighted", "WEIGHTED_NORMAL")
    mod.mode = "FACE_AREA"
    mod.weight = weight
    mod.keep_sharp = True
    kit.apply(obj)
    return obj


def part(troop, name, objs, pivot, par, angle=50):
    """troopkit.part with weighted normals (modifiers applied first)."""
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        # Curve tubes carry their own UV layer; drop it before the join.
        while o.data.uv_layers:
            o.data.uv_layers.remove(o.data.uv_layers[0])
    finish(objs)
    if os.environ.get("TIN_DEBUG"):
        counts = sorted(((sum(len(p.vertices) - 2 for p in o.data.polygons),
                          o.name) for o in objs), reverse=True)
        print(f"PART {troop}.{name}: {sum(c for c, _ in counts)}",
              " ".join(f"{n}={c}" for c, n in counts))
    obj = kit.join(objs, f"{troop}.{name}")
    kit.shade(obj, angle)
    weighted(obj)
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    return obj
