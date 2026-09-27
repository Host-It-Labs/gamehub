"""Shape helpers for Arena's diorama scenery (props.py).

The pieces are built the way a model-maker builds them: armature trees with
clump-foam foliage glued to the branch ends, pines with layered drooping
boughs, rocks cast as fractured blocks with crisp planes and chamfered
edges, moss cushions pressed into their tops, static-grass fibres. Every
generator writes into a Builder (one bmesh, several named materials, one
"UVMap" layer in texture repeats at the kit's real-world densities), so a
prop of many small parts costs one mesh object per shading style.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

import kit

TAU = math.tau
UP = Vector((0, 0, 1))


def tile_of(mat_name):
    return kit.TILE.get(mat_name.partition(":")[0], 1.0)


# Default texture repeats per tile, relative to the kit's density: foliage
# (moss, flock) is drawn fine, like foam grain, not as big painted leaves.
DEFAULT_SCALES = {"foliage": 0.3}


def rvec(rnd, spread=99.0):
    return Vector((rnd.uniform(-spread, spread), rnd.uniform(-spread, spread),
                   rnd.uniform(-spread, spread)))


def frame_from(n):
    """Two unit vectors perpendicular to n (right-handed with n)."""
    n = Vector(n).normalized()
    ref = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
    e1 = ref.cross(n).normalized()
    e2 = n.cross(e1).normalized()
    return e1, e2


def rot_to(n):
    """Rotation taking +Z to the direction n."""
    return UP.rotation_difference(Vector(n).normalized()).to_matrix()


# ---------------------------------------------------------------- builder

class Builder:
    """One mesh object in the making: a bmesh with a UV layer and a list of
    material names. New faces get planar UVs at their texture's density
    unless explicit UVs are given."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []
        # Texture repeats per material, relative to the kit's density.
        self.uv_scales = {}

    def mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def vert(self, co):
        return self.bm.verts.new(co)

    def face(self, verts, mat, uvs=None):
        try:
            f = self.bm.faces.new(verts)
        except ValueError:
            return None
        f.material_index = self.mat(mat)
        if uvs is not None:
            for loop, uv in zip(f.loops, uvs):
                loop[self.uv].uv = uv
        else:
            self.planar(f)
        return f

    def planar(self, f, scale=1.0, normal=None):
        name = self.mats[f.material_index]
        tile = tile_of(name) * self.uv_scales.get(
            name, DEFAULT_SCALES.get(name.partition(":")[0], 1.0)) * scale
        f.normal_update()
        n = Vector(normal) if normal is not None else f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            c = loop.vert.co
            if ax == 2:
                u, v = c.x * (1 if n.z >= 0 else -1), c.y
            elif ax == 0:
                u, v = c.y * (1 if n.x >= 0 else -1), c.z
            else:
                u, v = -c.x * (1 if n.y >= 0 else -1), c.z
            loop[self.uv].uv = (u / tile, v / tile)

    def replan(self, faces=None, scale=1.0, guide=None):
        """Re-project UVs; `guide(centre, normal)` picks each face's
        projection axis from a smooth, large-scale normal (a crown's
        rounded mass) so neighbouring faces share one projection and the
        texture runs on without seams across the small facets."""
        for f in (faces if faces is not None else self.bm.faces):
            n = None
            if guide:
                f.normal_update()
                n = guide(f.calc_center_median(), f.normal)
            self.planar(f, scale, n)

    def merge(self, src, mat, matrix=None, mats=None, uv="planar",
              uv_scale=1.0):
        """Copy the faces of another bmesh in. `mats` maps its material
        indices to names; otherwise every face takes `mat`."""
        vmap = {}
        m = matrix or Matrix.Identity(4)
        for v in src.verts:
            vmap[v] = self.bm.verts.new(m @ v.co)
        src_uv = src.loops.layers.uv.active if uv == "keep" else None
        out = []
        for f in src.faces:
            name = mats[f.material_index] if mats else mat
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = self.mat(name)
            if src_uv is not None:
                for a, b in zip(f.loops, nf.loops):
                    b[self.uv].uv = a[src_uv].uv
            else:
                self.planar(nf, uv_scale)
            out.append(nf)
        return out

    def tris(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def build(self, smooth=45, parent=None):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(obj)
        for m in self.mats:
            me.materials.append(kit.material(m))
        kit.shade(obj, smooth)
        if parent:
            obj.parent = parent
        return obj


def drop_buried(obj, z=-0.015):
    """Delete faces that sit wholly below the ground."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dead = [f for f in bm.faces if all(v.co.z < z for v in f.verts)]
    if dead:
        bmesh.ops.delete(bm, geom=dead, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def tri_count(root):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in kit.descendants(root) if o.type == "MESH")


# ---------------------------------------------------------------- templates

_ICO = {}


def ico(sub):
    """A unit icosphere as (directions, faces)."""
    if sub not in _ICO:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1)
        bm.verts.index_update()
        _ICO[sub] = ([v.co.normalized() for v in bm.verts],
                     [[v.index for v in f.verts] for f in bm.faces])
        bm.free()
    return _ICO[sub]


# ---------------------------------------------------------------- tubes

def tube(b, path, radius, sides, mat, shape=None, cap=None, noise_amp=0.0,
         seed=0, v0=0.0, u_reps=None, twist=0.0):
    """A tube through `path` (a list of points) with parallel-transport
    frames. radius(t) sets the radius along the length (t in 0..1) and
    shape(t, angle) an optional multiplier. UVs wrap the texture around the
    tube (whole repeats) and run it along the length, so bark plates stand
    up the trunk. cap: None (open), "flat" or "point". Returns the rings."""
    pts = [Vector(p) for p in path]
    n = len(pts)
    rnd = random.Random(seed)
    off = rvec(rnd)
    tan = []
    for i in range(n):
        a = pts[min(n - 1, i + 1)] - pts[max(0, i - 1)]
        tan.append(a.normalized())
    nrm, _ = frame_from(tan[0])
    frames = []
    for i in range(n):
        if i:
            axis = tan[i - 1].cross(tan[i])
            if axis.length > 1e-7:
                nrm = Matrix.Rotation(tan[i - 1].angle(tan[i]), 3,
                                      axis.normalized()) @ nrm
        nrm = (nrm - tan[i] * nrm.dot(tan[i])).normalized()
        frames.append((nrm.copy(), tan[i].cross(nrm).normalized()))
    lengths = [0.0]
    for i in range(1, n):
        lengths.append(lengths[-1] + (pts[i] - pts[i - 1]).length)
    total = max(lengths[-1], 1e-6)
    tile = tile_of(mat)
    if u_reps is None:
        u_reps = max(1, round(TAU * radius(0.0) / tile))
    rings = []
    for i, p in enumerate(pts):
        t = lengths[i] / total
        r = radius(t)
        ring = []
        for j in range(sides):
            a = j / sides * TAU + twist * t
            f = shape(t, a) if shape else 1.0
            d = frames[i][0] * math.cos(a) + frames[i][1] * math.sin(a)
            q = p + d * r * f
            if noise_amp:
                q = q + d * r * noise_amp * noise.noise(q * 3.0 + off)
            ring.append(b.vert(q))
        rings.append(ring)
    for i in range(n - 1):
        va, vb = v0 + lengths[i] / tile, v0 + lengths[i + 1] / tile
        for j in range(sides):
            jj = (j + 1) % sides
            ua, ub = j / sides * u_reps, (j + 1) / sides * u_reps
            b.face([rings[i][j], rings[i][jj], rings[i + 1][jj],
                    rings[i + 1][j]], mat,
                   [(ua, va), (ub, va), (ub, vb), (ua, vb)])
    if cap == "point":
        tip = b.vert(pts[-1] + tan[-1] * radius(1.0) * 1.5)
        vt = v0 + (total + radius(1.0)) / tile
        vl = v0 + total / tile
        for j in range(sides):
            jj = (j + 1) % sides
            b.face([rings[-1][j], rings[-1][jj], tip], mat,
                   [(j / sides * u_reps, vl), ((j + 1) / sides * u_reps, vl),
                    ((j + 0.5) / sides * u_reps, vt)])
    elif cap == "flat":
        b.face(list(rings[-1]), mat)
    return rings


def polyline(points, samples=4):
    return kit.smooth_path(points, samples)


# ---------------------------------------------------------------- foliage

def foam(b, centre, radius, seed, mat, sub=2, squash=0.86, rough=0.2,
         crumb=0.1, under=0.5, scale=(1, 1, 1)):
    """A clump of foam foliage: an icosphere pushed about by coarse noise
    and a little per-vertex crumble, with a flattened underside."""
    rnd = random.Random(seed)
    dirs, faces = ico(sub)
    off = rvec(rnd)
    c = Vector(centre)
    vs = []
    for d in dirs:
        r = 1 + rough * noise.noise(d * 1.7 + off) + \
            rnd.uniform(-crumb, crumb)
        p = d * r
        p.z *= squash
        if p.z < -under:
            p.z = -under + (p.z + under) * 0.35
        vs.append(b.vert(c + Vector((p.x * scale[0], p.y * scale[1],
                                     p.z * scale[2])) * radius))
    out = []
    for f in faces:
        nf = b.face([vs[i] for i in f], mat)
        if nf:
            out.append(nf)
    return out


def tint_tips(b, mats, tip, rule):
    """Re-colour foliage faces that catch the light: the model-maker's dry
    dusting of lighter flock on the top of each clump."""
    idx = {b.mat(m) for m in mats}
    t = b.mat(tip)
    for f in b.bm.faces:
        if f.material_index in idx:
            f.normal_update()
            if rule(f.calc_center_median(), f.normal):
                f.material_index = t


# ---------------------------------------------------------------- pines

def bough(b, root, az, length, width, rise, droop, seed, mat, thick=0.36,
          stations=(0.0, 0.32, 0.62, 0.86)):
    """One drooping pine bough: a flat, serrated pad (a diamond section)
    that leaves the trunk, rises a little and hangs at the tip."""
    rnd = random.Random(seed)
    d = Vector((math.cos(az), math.sin(az), 0))
    s = Vector((-math.sin(az), math.cos(az), 0))
    root = Vector(root)

    def centre(u):
        return root + d * (length * u) + UP * (length * (rise * u -
                                                         droop * u * u))
    rings = []
    for k, u in enumerate(stations):
        w = width * math.sin(math.pi * (0.14 + 0.86 * u)) * \
            (1 + (rnd.uniform(-0.15, 0.2) if k else 0))
        w = max(w, width * 0.18)
        c = centre(u)
        # The pad's own up leans with the droop so tips hang, not tilt.
        tangent = (centre(min(1, u + 0.05)) - centre(max(0, u - 0.05)))
        tangent.normalize()
        up = s.cross(tangent).normalized()
        if up.z < 0:
            up = -up
        jig = lambda a: rnd.uniform(-a, a)  # noqa: E731
        # A rounded section whose edges hang below the midrib: a cupped,
        # drooping spray.
        t = w * thick * (1 + jig(0.2))
        ring = [c + s * (w / 2) - up * (w * 0.12 + jig(0.03 * w)),
                c + s * (w * 0.24) + up * t * 0.8,
                c - s * (w * 0.24) + up * t * 0.8,
                c - s * (w / 2) - up * (w * 0.12 + jig(0.03 * w)),
                c - up * (w * thick * 0.35)]
        ring = [q + tangent * jig(0.03 * length) for q in ring]
        rings.append([b.vert(q) for q in ring])
    tip = b.vert(centre(1.0) + s * rnd.uniform(-0.05, 0.05) * width)
    faces = []
    m = len(rings[0])
    for ra, rb in zip(rings, rings[1:]):
        for j in range(m):
            jj = (j + 1) % m
            faces.append(b.face([ra[j], ra[jj], rb[jj], rb[j]], mat))
    for j in range(m):
        faces.append(b.face([rings[-1][j], rings[-1][(j + 1) % m], tip], mat))
    faces.append(b.face(list(reversed(rings[0])), mat))
    faces = [f for f in faces if f]
    bmesh.ops.recalc_face_normals(b.bm, faces=faces)
    return faces


# ---------------------------------------------------------------- rock

def fracture(size, seed, cuts=10, lo=0.62, hi=0.9, flat_top=0.0,
             bevel=0.025, max_edge=0.5, wobble=0.012, bottom=None):
    """A fractured block: a box with random planes sawn off its corners and
    edges (crisp flat faces), chamfered so every edge catches the light,
    then subdivided a little and nudged so the planes are not machine-flat.
    Returns a fresh bmesh centred on the origin."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    for v in bm.verts:
        v.co += Vector((rnd.uniform(-0.06, 0.06) * hx,
                        rnd.uniform(-0.06, 0.06) * hy,
                        rnd.uniform(-0.04, 0.04) * hz))
    for i in range(cuts):
        n = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1) * 0.9))
        if i < 2 and flat_top:
            n = Vector((rnd.gauss(0, 0.25), rnd.gauss(0, 0.25), 1))
        n.normalize()
        support = abs(n.x) * hx + abs(n.y) * hy + abs(n.z) * hz
        k = rnd.uniform(lo, hi)
        if i < 2 and flat_top:
            k = rnd.uniform(0.86, 0.97)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5,
                                     plane_co=n * support * k, plane_no=n,
                                     clear_outer=True)
        edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    if bottom is not None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5,
                                     plane_co=(0, 0, bottom),
                                     plane_no=(0, 0, -1), clear_outer=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    if bevel:
        sharp = [e for e in bm.edges if e.is_manifold and
                 e.calc_face_angle(0) > math.radians(28)]
        try:
            bmesh.ops.bevel(bm, geom=sharp, offset=bevel, offset_type="OFFSET",
                            segments=1, profile=0.5, affect="EDGES",
                            clamp_overlap=True)
        except Exception as exc:  # pragma: no cover
            print("bevel failed", exc)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY",
                          ngon_method="BEAUTY")
    for _ in range(2):
        long = [e for e in bm.edges if e.calc_length() > max_edge]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY",
                              ngon_method="BEAUTY")
    if wobble:
        off = rvec(rnd)
        s = max(size)
        for v in bm.verts:
            v.co += Vector(noise.noise_vector(v.co * (2.2 / s) + off)) * \
                wobble * s
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def place(bm, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    return bm


def block_matrix(loc, yaw=0.0, tilt=(0.0, 0.0)):
    return (Matrix.Translation(Vector(loc)) @
            Matrix.Rotation(yaw, 4, "Z") @
            Matrix.Rotation(tilt[0], 4, "X") @
            Matrix.Rotation(tilt[1], 4, "Y"))


def cushion(b, at, normal, radius, seed, mat, flat=0.38, sub=2, sink=0.3,
            spread=(1.0, 1.0)):
    """A cushion of moss (or a pad of flock) pressed onto a surface: the
    upper part of a crumbly icosphere, flattened along the normal."""
    rnd = random.Random(seed)
    dirs, faces = ico(sub)
    off = rvec(rnd)
    rot = rot_to(normal) @ Matrix.Rotation(rnd.uniform(0, TAU), 3, "Z")
    base = Vector(at) - Vector(normal).normalized() * radius * flat * sink
    keep = [d.z > (-0.5 if sub == 1 else -0.3) for d in dirs]
    vs = {}
    for i, d in enumerate(dirs):
        if not keep[i]:
            continue
        r = 1 + 0.22 * noise.noise(d * 2.0 + off) + rnd.uniform(-0.12, 0.12)
        p = Vector((d.x * r * spread[0], d.y * r * spread[1],
                    max(d.z, -0.3) * r * flat))
        vs[i] = b.vert(base + rot @ (p * radius))
    out = []
    for f in faces:
        if all(keep[i] for i in f):
            nf = b.face([vs[i] for i in f], mat)
            if nf:
                out.append(nf)
    return out


def bvh(b):
    b.bm.normal_update()
    return BVHTree.FromBMesh(b.bm)


def moss_on(b, tree, seed, count, area, radius, mat, min_nz=0.55,
            top=10.0, cluster=None, flat=0.38, sub=2):
    """Press `count` moss cushions onto the upward faces of what the builder
    holds so far, found by dropping rays inside area=(x0, y0, x1, y1)."""
    rnd = random.Random(seed)
    placed = []
    tries = 0
    while len(placed) < count and tries < count * 30:
        tries += 1
        if cluster and placed and rnd.random() < 0.6:
            px, py, _ = rnd.choice(placed)
            x = px + rnd.gauss(0, cluster)
            y = py + rnd.gauss(0, cluster)
        else:
            x = rnd.uniform(area[0], area[2])
            y = rnd.uniform(area[1], area[3])
        hit = tree.ray_cast(Vector((x, y, top)), Vector((0, 0, -1)))
        if hit[0] is None or hit[1].z < min_nz or hit[0].z < 0.02:
            continue
        r = radius * rnd.uniform(0.6, 1.2)
        cushion(b, hit[0], hit[1], r, seed * 31 + len(placed), mat, flat=flat,
                sub=sub)
        placed.append((x, y, r))
    return placed


def moss_skirt(b, tree, seed, count, centre, reach, radius, mat, z=0.07,
               flat=0.32, sub=2, arc=None):
    """Moss (or flock) cushions tucked round the foot of a rock or post,
    found by casting rays in towards `centre` just above the ground."""
    rnd = random.Random(seed)
    c = Vector(centre)
    placed = 0
    for i in range(count * 12):
        if placed >= count:
            break
        a = rnd.uniform(*(arc or (0, TAU)))
        d = Vector((math.cos(a), math.sin(a), 0))
        start = c + d * reach + Vector((0, 0, z * rnd.uniform(0.6, 1.4)))
        hit = tree.ray_cast(start, -d)
        if hit[0] is None:
            continue
        n = (hit[1] * 0.35 + UP).normalized()
        r = radius * rnd.uniform(0.7, 1.25)
        cushion(b, hit[0] + d * r * 0.25, n, r, seed * 17 + i, mat,
                flat=flat, sub=sub, sink=0.6)
        placed += 1


# ---------------------------------------------------------------- grass

_FIBRE = random.Random(77)


def fibre(b, base, tip, width, mat, patch=True):
    """A static-grass fibre: a thin three-sided spike (three triangles).
    Each fibre samples its own random patch of the tile, so a tuft mixes
    the tile's light and dark blades instead of repeating one spot."""
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    e1, e2 = frame_from(axis)
    vs = []
    for k in range(3):
        a = k / 3 * TAU
        vs.append(b.vert(base + (e1 * math.cos(a) + e2 * math.sin(a)) *
                         width / 2))
    t = b.vert(tip)
    u0, v0 = _FIBRE.random(), _FIBRE.random()
    tile = tile_of(mat)
    h = (tip - base).length / tile
    w = width / tile
    for k in range(3):
        f = b.face([vs[k], vs[(k + 1) % 3], t], mat,
                   [(u0, v0), (u0 + w, v0), (u0 + w / 2, v0 + h)]
                   if patch else None)


def tuft(b, seed, count, height, mats, weights, width=0.016, centre=(0, 0),
         root=0.05, sink=0.03, splay=(58, 86)):
    """A static-grass tuft: fibres standing out of one glued root, taller in
    the middle, fanning outwards."""
    rnd = random.Random(seed)
    cx, cy = centre
    for i in range(count):
        a = rnd.uniform(0, TAU)
        d = root * math.sqrt(rnd.random())
        base = Vector((cx + math.cos(a) * d, cy + math.sin(a) * d, -sink))
        out = d / max(root, 1e-6)
        h = height * rnd.uniform(0.62, 1.08) * (1.05 - 0.4 * out)
        el = math.radians(rnd.uniform(*splay) - 18 * out)
        az = a + rnd.uniform(-0.6, 0.6)
        tip = base + Vector((math.cos(az) * math.cos(el),
                             math.sin(az) * math.cos(el),
                             math.sin(el))) * (h + sink)
        r = rnd.random() * sum(weights)
        k = 0
        while r > weights[k] and k < len(weights) - 1:
            r -= weights[k]
            k += 1
        fibre(b, base, tip, width * rnd.uniform(0.8, 1.2), mats[k])


def revolve(b, profile, segs, mat, u_reps=None, vert=None, seam=0.0,
            cap_bottom=False, cap_top=False):
    """Spin (radius, z) points around z. u wraps `u_reps` texture repeats
    around (a whole number of planks or stones), v runs up the profile.
    vert(j, k, point) may move each vertex (j: around, k: profile row)."""
    tile = tile_of(mat)
    rings = []
    for k, (r, z) in enumerate(profile):
        if r < 1e-5:
            p = Vector((0, 0, z))
            if vert:
                p = vert(0, k, p)
            pole = b.vert(p)
            rings.append([pole] * segs)
            continue
        ring = []
        for j in range(segs):
            a = seam + j / segs * TAU
            p = Vector((math.cos(a) * r, math.sin(a) * r, z))
            if vert:
                p = vert(j, k, p)
            ring.append(b.vert(p))
        rings.append(ring)
    if u_reps is None:
        rmax = max(r for r, _ in profile)
        u_reps = max(1, round(TAU * rmax / tile))
    vs = [0.0]
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        vs.append(vs[-1] + math.hypot(r1 - r0, z1 - z0) / tile)
    for k in range(len(profile) - 1):
        for j in range(segs):
            jj = (j + 1) % segs
            ua, ub = j / segs * u_reps, (j + 1) / segs * u_reps
            quad = [(rings[k][j], (ua, vs[k])), (rings[k][jj], (ub, vs[k])),
                    (rings[k + 1][jj], (ub, vs[k + 1])),
                    (rings[k + 1][j], (ua, vs[k + 1]))]
            seen, keep = set(), []
            for v, uv in quad:
                if v not in seen:
                    seen.add(v)
                    keep.append((v, uv))
            if len(keep) >= 3:
                b.face([v for v, _ in keep], mat, [uv for _, uv in keep])
    if cap_bottom:
        b.face(list(reversed(rings[0])), mat)
    if cap_top:
        b.face(list(rings[-1]), mat)
    return rings


def box(b, size, mat, matrix=None, bevel=0.0):
    """A (bevelled) box merged into the builder."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel,
                        offset_type="OFFSET", segments=1, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    faces = b.merge(bm, mat, matrix)
    bm.free()
    return faces


# ---------------------------------------------------------------- AO

def smooth_ao(obj, mix=1.0, floor=0.0):
    """Average the baked corner AO of every vertex, so soft foliage shades
    as soft masses instead of showing each face (crisp rocks keep their
    per-corner AO)."""
    me = obj.data
    attr = me.color_attributes.get("AO")
    if not attr:
        return
    total = [0.0] * len(me.vertices)
    count = [0] * len(me.vertices)
    for loop in me.loops:
        total[loop.vertex_index] += attr.data[loop.index].color[0]
        count[loop.vertex_index] += 1
    for loop in me.loops:
        i = loop.vertex_index
        v = total[i] / max(1, count[i])
        own = attr.data[loop.index].color[0]
        g = own + (v - own) * mix
        g = floor + (1 - floor) * g
        attr.data[loop.index].color = (g, g, g, 1)


def height_ao(obj, top, lo=0.5, hi=1.0, gamma=0.8, keep=0.0):
    """Static grass: darker at the glued root, catching the light at the
    tips, whatever the bake said (a tuft sits inside its own AO radius)."""
    me = obj.data
    attr = me.color_attributes.get("AO")
    if not attr:
        return
    for loop in me.loops:
        z = me.vertices[loop.vertex_index].co.z
        t = max(0.0, min(1.0, z / top)) ** gamma
        g = lo + (hi - lo) * t
        own = attr.data[loop.index].color[0]
        g = g * (1 - keep) + own * keep
        attr.data[loop.index].color = (g, g, g, 1)


def light_ao(obj, rule, lo=0.7):
    """Darken the baked AO where `rule(co, normal)` (0..1) says a vertex is
    in the crown's shade: undersides and the inner layers stay deep, the
    outer tops keep their full light, smoothly."""
    me = obj.data
    attr = me.color_attributes.get("AO")
    if not attr:
        return
    k = []
    for v in me.vertices:
        t = max(0.0, min(1.0, rule(v.co, v.normal)))
        k.append(lo + (1 - lo) * t)
    for loop in me.loops:
        g = attr.data[loop.index].color[0] * k[loop.vertex_index]
        attr.data[loop.index].color = (g, g, g, 1)


def fuse(lumps, target, voxel=0.06, smooth=2, crumb=0.05, grain=3.5,
         seed=0):
    """One continuous foliage surface from many lumps: the lumps are
    unioned by a voxel remesh, relaxed, then decimated to `target`
    triangles, so every triangle is spent on the visible outer surface
    (crevices, lobes), none inside overlapping balls.
    lumps: (centre, radius, seed, foam options). Returns a bmesh."""
    b = Builder("__fuse")
    for c, r, sd, kw in lumps:
        opts = {"sub": 3, "rough": 0.3, "crumb": 0.02}
        opts.update(kw)
        foam(b, c, r, sd, "plain:grey", **opts)
    obj = b.build(smooth=180)
    mod = obj.modifiers.new("remesh", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.adaptivity = 0
    kit.apply(obj)
    if smooth:
        mod = obj.modifiers.new("smooth", "SMOOTH")
        mod.iterations = smooth
        mod.factor = 0.6
        kit.apply(obj)
    if crumb:
        # Foam crumbs: small bubbly bumps over the whole surface, so the
        # decimated crown keeps a broken, porous outline.
        off = rvec(random.Random(seed))
        me = obj.data
        for v in me.vertices:
            q = v.co * grain + off
            bump = noise.noise(q) + 0.5 * noise.noise(q * 2.1 + off)
            v.co += v.normal * crumb * bump
        me.update()

    def count():
        return sum(len(p.vertices) - 2 for p in obj.data.polygons)
    for _ in range(3):
        n = count()
        if n <= target * 1.01:
            break
        mod = obj.modifiers.new("decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.use_collapse_triangulate = True
        mod.ratio = max(0.001, target / n * 0.995)
        kit.apply(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(me)
    return bm


def set_normals(obj, fn):
    """Custom vertex normals: fn(co, normal) returns the direction each
    vertex should shade with. Grass takes the ground's up so its fibres
    light like the turf they stand in; crowns lean towards their own
    rounded mass, so foam lumps shade as one soft volume."""
    me = obj.data
    out = []
    for v in me.vertices:
        n = Vector(fn(v.co, v.normal))
        if n.length < 1e-6:
            n = Vector(v.normal)
        n.normalize()
        out.append(n)
    me.normals_split_custom_set_from_vertices(out)
