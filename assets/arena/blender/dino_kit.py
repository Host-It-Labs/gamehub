"""Subdivision-cage helpers for the Dino (troop_ogre.py).

Organic parts are low-poly loft cages (rings of eight points joined by
quads, capped by a dome or a flat strip), smoothed by a Subdivision Surface
modifier at level 2 and then thinned by a symmetric Decimate that never moves
a material boundary, so the belly line stays a clean curve.

Rings are given in a local frame: `side` (the part's width axis, usually x),
`up` (the ring's "top" direction) and a centre; ring points are (x, y) pairs
in (side, up), counter-clockwise, all rings of a cage with the same count.
"""

import math

import bmesh
import bpy
import kit
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


def v(*a):
    return Vector(a if len(a) == 3 else a[0])


# ---------------------------------------------------------------- ring shapes

def ellipse(w, ht, hb=None, angles=None, power=2.0):
    """Points on an ellipse (superellipse for power > 2) of half-width w,
    half-height ht above and hb below, at the given angles (degrees)."""
    hb = ht if hb is None else hb
    angles = angles or [i * 45 for i in range(8)]
    e = 2.0 / power
    pts = []
    for a in angles:
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        x = math.copysign(abs(ca) ** e, ca) * w
        y = math.copysign(abs(sa) ** e, sa) * (ht if sa >= 0 else hb)
        pts.append((x, y))
    return pts


def ring(centre, up, pts, side=X):
    """A ring in the plane through `centre` spanned by `side` and `up`."""
    up = Vector(up).normalized()
    side = Vector(side)
    side = (side - up * side.dot(up)).normalized()
    return {"c": Vector(centre), "side": side, "up": up, "pts": pts}


def tb(top, bottom, x=0.0, side=X):
    """Centre, up and half-height of a ring drawn in side view by its top and
    bottom points (y, z)."""
    t = Vector((x, top[0], top[1]))
    b = Vector((x, bottom[0], bottom[1]))
    return (t + b) / 2, (t - b).normalized(), (t - b).length / 2


def ring_tb(top, bottom, shape, x=0.0, side=X):
    """A ring from side-view top and bottom points; `shape(h)` gives its
    points for the half-height h."""
    c, up, h = tb(top, bottom, x, side)
    return ring(c, up, shape(h), side)


def world(r, p):
    return r["c"] + r["side"] * p[0] + r["up"] * p[1]


def centre_of(r):
    pts = [world(r, p) for p in r["pts"]]
    return sum(pts, Vector()) / len(pts)


def tangent_of(r):
    """The ring's forward axis (up x side is +y for up = z, side = x)."""
    return r["up"].cross(r["side"]).normalized()


# ---------------------------------------------------------------- cages

STRIP8 = [(1, 2, 3, 4), (0, 1, 4, 5), (5, 6, 7, 0)]


def loft(name, rings, mats, face_mat=None, start=None, end=None,
         start_mat=0, end_mat=0, extra=None):
    """Join rings with quads into one closed cage.

    face_mat(k, i) picks the material slot of the quad between rings k and
    k+1 and ring points i and i+1. `start`/`end` close the ends: ("dome",
    offset) adds a centre point at the ring centre + offset and fans quads
    to it, ("strip",) closes an eight-point ring with three flat quads,
    ("quad",) closes a four-point ring. start_mat/end_mat are a slot or a
    list of slots per cap quad. `extra(bm, vrings)` may add more faces (toes)
    before normals are made consistent."""
    bm = bmesh.new()
    vrings = [[bm.verts.new(world(r, p)) for p in r["pts"]] for r in rings]
    n = len(vrings[0])
    for k in range(len(vrings) - 1):
        a, b = vrings[k], vrings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = face_mat(k, i) if face_mat else 0

    def cap(vs, spec, r, mat):
        if spec is None:
            return
        kind = spec[0]
        quads = []
        if kind == "dome":
            c = bm.verts.new(centre_of(r) + Vector(spec[1]))
            quads = [(vs[k], vs[k + 1], vs[(k + 2) % n], c)
                     for k in range(0, n, 2)]
        elif kind == "strip":
            quads = [tuple(vs[i] for i in q) for q in STRIP8]
        elif kind == "quad":
            quads = [tuple(vs)]
        for q, quad in enumerate(quads):
            f = bm.faces.new(quad)
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


def tube(name, pts, radii, mat, n=6, side=X, start=True, end=True,
         squash=None):
    """A round cage through points with a radius per point (arms, claws).
    squash scales the ring height per point (flattened hands)."""
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
    return loft(name, rings, [mat],
                start=("dome", t0 * radii[0] * 0.8) if start else None,
                end=("dome", t1 * radii[-1] * 0.9) if end else None)


# ---------------------------------------------------------------- smoothing

def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def smooth(obj, level=2, target=None, after=None):
    """Subdivide (applied), run `after(obj)` on the smooth mesh, then
    decimate towards `target` triangles, symmetric in x, never moving a
    vertex that sits on a material boundary."""
    if level:
        kit.add_subsurf(obj, level)
        kit.apply(obj)
    if after:
        after(obj)
        obj.data.update()
    if target and tris(obj) > target:
        me = obj.data
        mod = obj.modifiers.new("decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = target / tris(obj)
        mod.use_symmetry = True
        mod.symmetry_axis = "X"
        if len(me.materials) > 1:
            # Vertices shared by faces of two materials stay put.
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


def flatten_below(z0=0.0):
    def fn(obj):
        for vert in obj.data.vertices:
            if vert.co.z < z0:
                vert.co.z = z0
    return fn


# ---------------------------------------------------------------- placement

def tree(objs):
    """A ray-cast tree of some (modifier-applied) mesh objects in world
    space."""
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
    """The first surface point and normal along a ray."""
    d = Vector(direction).normalized()
    loc, nrm, _, _ = t.ray_cast(Vector(origin), d, far)
    return loc, nrm


def rotate_about(obj, point, angle, axis="X"):
    """Turn an object's mesh (transforms applied) about a world point."""
    kit.apply_transform(obj)
    p = Vector(point)
    m = Matrix.Translation(p) @ Matrix.Rotation(angle, 4, axis) @ \
        Matrix.Translation(-p)
    obj.data.transform(m)
    obj.data.update()
    return obj


def aim(obj, direction, at):
    """Turn a piece built along +z about its origin toward `direction`,
    then move it to `at`."""
    kit.apply_transform(obj)
    q = Z.rotation_difference(Vector(direction).normalized())
    obj.data.transform(q.to_matrix().to_4x4())
    obj.data.transform(Matrix.Translation(Vector(at)))
    obj.data.update()
    return obj


def cap(obj, z0):
    """Keep only the part of a mesh built along +z above z0 (the rest of an
    eye bead or pupil is buried)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[vert for vert in bm.verts if vert.co.z < z0],
                     context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def cone(name, r, length, mat, segments=6, bend=0.0):
    """A soft rounded cone along +z (a tooth or a claw); `bend` curls the tip
    toward -y."""
    prof = [(r, 0.0), (r * 0.84, length * 0.45), (r * 0.42, length * 0.84),
            (0.0, length)]
    # The base is buried in the gum or toe, so it stays open.
    obj = kit.lathe(name, prof, segments=segments, mat=mat, close=False)
    if bend:
        for vert in obj.data.vertices:
            f = vert.co.z / length
            vert.co.y -= bend * f * f
    return obj


def plate(name, base, normal, along, length, height, thick, mat, lean=0.25):
    """A soft back plate: a thin lens-section fin standing on `base` (buried
    a little) along `normal`, its length running along `along`."""
    n = Vector(normal).normalized()
    t = (Vector(along) - n * Vector(along).dot(n)).normalized()
    s = n.cross(t).normalized()
    grow = (n - t * lean).normalized()
    # (height fraction, half-length, half-thickness) from the buried base
    # up; the lens section's edge points sit out past the outline, since
    # subdivision pulls them in.
    prof = [(-0.2, 0.62, 0.9), (0.12, 0.74, 1.0), (0.5, 0.64, 0.8),
            (0.8, 0.38, 0.6)]
    rings = []
    for f, hl, ht in prof:
        c = Vector(base) + grow * (f * height)
        L, T = hl * length, ht * thick
        pts = [(L, 0.0), (L * 0.55, T), (-L * 0.55, T), (-L, 0.0),
               (-L * 0.55, -T), (L * 0.55, -T)]
        rings.append(ring(c, s, pts, side=t))
    return loft(name, rings, [mat], start=("dome", -grow * 0.02),
                end=("dome", grow * height * 0.26))
