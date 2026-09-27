"""Cage modelling helpers for the Cadet and Cowboy action figures.

Organic forms (bodies, limbs, heads, hands, boots) are built as low-poly
quad cages and smoothed with a Subdivision Surface modifier, with edge
creases where a crisp moulded edge belongs. Hard-surface pieces (guns,
rifles, buckles, badges) are lathed or extruded and bevelled. Painted
details (eyes, mouths) are thin decals shrink-wrapped onto the surface.

Every helper returns a plain mesh object in world space with its modifiers
applied, ready for troopkit.part().
"""

import math

import bmesh
import bpy
import kit
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def S(c, rx, ry=None, **kw):
    """One loft section: centre, half width (u) and half depth (v).
    Options: sq (superellipse exponent, <1 squarer), crease (ring edges),
    mat (material of the band that starts here), u (width axis), ox/oy
    (offset of the ring in the section frame)."""
    d = {"c": Vector(c), "rx": rx, "ry": rx if ry is None else ry}
    d.update(kw)
    return d


def _frames(secs, ref, axis):
    out = []
    n = len(secs)
    for i, s in enumerate(secs):
        if axis is not None:
            t = Vector(axis).normalized()
        else:
            a = secs[max(0, i - 1)]["c"]
            b = secs[min(n - 1, i + 1)]["c"]
            t = b - a
            if t.length < 1e-9:
                t = Vector((0, 0, 1))
            t.normalize()
        r = Vector(s.get("u", ref))
        u = r - t * r.dot(t)
        if u.length < 1e-6:
            u = t.orthogonal()
        u.normalize()
        out.append((t, u, t.cross(u)))
    return out


def _ring(s, frame, n, phase):
    t, u, v = frame
    sq = s.get("sq", 1.0)
    ox, oy = s.get("ox", 0.0), s.get("oy", 0.0)
    pts = []
    for i in range(n):
        a = phase + math.tau * i / n
        ca, sa = math.cos(a), math.sin(a)
        if sq != 1.0:
            ca = math.copysign(abs(ca) ** sq, ca)
            sa = math.copysign(abs(sa) ** sq, sa)
        pts.append(s["c"] + u * (s["rx"] * ca + ox) + v * (s["ry"] * sa + oy))
    return pts


def _cap(bm, ring, centre, out, dome, frame, rx, ry):
    """Close a ring of 4k vertices with a (k+1)x(k+1) quad grid (a Coons
    patch), pushed out along `out` into a dome."""
    n = len(ring)
    k = n // 4
    P = [v.co.copy() for v in ring]
    _, u_ax, v_ax = frame

    def idx(i, j):
        if j == 0:
            return i
        if i == k:
            return k + j
        if j == k:
            return 3 * k - i
        return (4 * k - j) % n

    grid = [[None] * (k + 1) for _ in range(k + 1)]
    for i in range(k + 1):
        for j in range(k + 1):
            if i in (0, k) or j in (0, k):
                grid[i][j] = ring[idx(i, j)]
                continue
            s, w = i / k, j / k
            p = ((1 - w) * P[idx(i, 0)] + w * P[idx(i, k)] +
                 (1 - s) * P[idx(0, j)] + s * P[idx(k, j)] -
                 ((1 - s) * (1 - w) * P[idx(0, 0)] + s * (1 - w) * P[idx(k, 0)] +
                  (1 - s) * w * P[idx(0, k)] + s * w * P[idx(k, k)]))
            d = p - centre
            rho2 = (d.dot(u_ax) / max(rx, 1e-6)) ** 2 + \
                (d.dot(v_ax) / max(ry, 1e-6)) ** 2
            p = p + out * dome * math.sqrt(max(0.0, 1.0 - rho2))
            grid[i][j] = bm.verts.new(p)
    faces = []
    for i in range(k):
        for j in range(k):
            faces.append(bm.faces.new((grid[i][j], grid[i + 1][j],
                                       grid[i + 1][j + 1], grid[i][j + 1])))
    return faces


def crease_layer(bm):
    return bm.edges.layers.float.get("crease_edge") or \
        bm.edges.layers.float.new("crease_edge")


def loft(name, secs, mat, n=8, phase=None, cap0=0.0, cap1=0.0, levels=1,
         ref=(1, 0, 0), axis=None, closed=False, edit=None, apply=True):
    """A subdivision cage through `secs` (see S()). cap0/cap1: None leaves
    the end open, a number closes it with a quad grid domed by that amount.
    `edit(bm, info)` may reshape the cage before smoothing; info holds
    rings (vertex lists), bands[band][slot] faces, mats and the frames."""
    if phase is None:
        # Grid caps put their corners at 45 degrees, so the cage stays
        # mirror symmetric; with n=12 a face (not a vertex) looks along +v.
        phase = math.pi / 4
    frames = _frames(secs, Vector(ref), axis)
    bm = bmesh.new()
    cl = crease_layer(bm)
    mats = [mat]
    rings = []
    for s, f in zip(secs, frames):
        rings.append([bm.verts.new(p) for p in _ring(s, f, n, phase)])
    bands = []
    cur = 0
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for bi, (a, b) in enumerate(pairs):
        m = secs[bi].get("mat")
        if m:
            if m not in mats:
                mats.append(m)
            cur = mats.index(m)
        row = []
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = cur
            row.append(f)
        bands.append(row)
    for s, ring in zip(secs, rings):
        c = s.get("crease", 0.0)
        if c:
            for i in range(n):
                e = bm.edges.get((ring[i], ring[(i + 1) % n]))
                if e:
                    e[cl] = c
    caps = [None, None]
    if not closed and n % 4 == 0:
        for end, dome in ((0, cap0), (1, cap1)):
            if dome is None:
                continue
            i = 0 if end == 0 else len(secs) - 1
            s, f = secs[i], frames[i]
            out = -f[0] if end == 0 else f[0]
            faces = _cap(bm, rings[i], s["c"], out, dome, f, s["rx"], s["ry"])
            mi = 0 if end == 0 or not bands else bands[-1][0].material_index
            for fc in faces:
                fc.material_index = mi
            caps[end] = faces
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    info = {"rings": rings, "bands": bands, "caps": caps, "mats": mats,
            "frames": frames, "cl": cl}
    if edit:
        edit(bm, info)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_cage(name, bm, info["mats"], levels, apply)


def slot(n, deg, phase=45.0):
    """The index of the cage face (in each band) centred nearest `deg`,
    measured from +u toward +v."""
    step = 360.0 / n
    return round((deg - phase - step / 2) / step) % n


def sphere_patch(name, c, r, th, ph, nu, nv, mat, thick=0.0, levels=1,
                 crease=0.0, apply=True):
    """A quad patch of the sphere (c, r) between azimuths th=(a0, a1) (from
    +x toward +y) and latitudes ph=(b0, b1), in degrees; with `thick` it is
    a shell whose rim loops carry `crease`."""
    c = Vector(c)
    bm = bmesh.new()
    cl = crease_layer(bm)

    def pt(i, j, rad):
        a = math.radians(th[0] + (th[1] - th[0]) * i / nu)
        b = math.radians(ph[0] + (ph[1] - ph[0]) * j / nv)
        return c + Vector((math.cos(b) * math.cos(a),
                           math.cos(b) * math.sin(a), math.sin(b))) * rad

    def grid(rad):
        return [[bm.verts.new(pt(i, j, rad)) for j in range(nv + 1)]
                for i in range(nu + 1)]

    def loop(g):
        out = [g[i][0] for i in range(nu + 1)]
        out += [g[nu][j] for j in range(1, nv + 1)]
        out += [g[i][nv] for i in range(nu - 1, -1, -1)]
        out += [g[0][j] for j in range(nv - 1, 0, -1)]
        return out

    outer = grid(r)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((outer[i][j], outer[i + 1][j], outer[i + 1][j + 1],
                          outer[i][j + 1]))
    if thick:
        inner = grid(r - thick)
        for i in range(nu):
            for j in range(nv):
                bm.faces.new((inner[i][j + 1], inner[i + 1][j + 1],
                              inner[i + 1][j], inner[i][j]))
        lo, li = loop(outer), loop(inner)
        m = len(lo)
        for k in range(m):
            q = (k + 1) % m
            bm.faces.new((lo[q], lo[k], li[k], li[q]))
        for ring in (lo, li):
            for k in range(m):
                e = bm.edges.get((ring[k], ring[(k + 1) % m]))
                if e:
                    e[cl] = crease
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if (f.calc_center_median() - c).dot(f.normal) < 0 and not thick:
            f.normal_flip()
    return finish_cage(name, bm, [mat], levels, apply)


def finish_cage(name, bm, mats, levels=1, apply=True):
    obj = kit._from_bmesh(name, bm)
    for m in mats:
        obj.data.materials.append(kit.material(m))
    obj.data.shade_smooth()
    if levels:
        kit.add_subsurf(obj, levels)
    if apply:
        kit.apply(obj)
    return obj


def mat_index(info, m):
    if m not in info["mats"]:
        info["mats"].append(m)
    return info["mats"].index(m)


def raise_faces(bm, faces, depth, inset=0.004, rim=0.002, mi=None,
                crease=0.0, cl=None):
    """Raise a patch of cage faces into a moulded panel with a support loop
    at its foot, so the smoothed edge stays crisp."""
    faces = list(faces)
    if inset:
        bmesh.ops.inset_region(bm, faces=faces, thickness=inset, depth=0.0,
                               use_even_offset=True)
    r = bmesh.ops.inset_region(bm, faces=faces, thickness=rim, depth=depth,
                               use_even_offset=True)
    if mi is not None:
        for f in faces + r["faces"]:
            f.material_index = mi
    if crease and cl is not None:
        edges = {e for f in faces for e in f.edges if not all(
            g in faces for g in e.link_faces)}
        for e in edges:
            e[cl] = crease
    return faces, r["faces"]


def extrude_face(bm, face, steps):
    """Extrude one cage face in steps of (offset vector, scale): thumbs,
    noses, ears."""
    cur = face
    for off, scale in steps:
        r = bmesh.ops.extrude_discrete_faces(bm, faces=[cur])
        cur = r["faces"][0]
        c = cur.calc_center_median()
        for v in cur.verts:
            v.co = c + (v.co - c) * scale + Vector(off)
    return cur


# ---------------------------------------------------------------- joints

def elbow(s, w, a, b, pole):
    """Two-bone IK: the elbow (or knee) between shoulder s and wrist w for
    bone lengths a and b, bending toward `pole`."""
    s, w, pole = Vector(s), Vector(w), Vector(pole)
    d = w - s
    length = min(d.length, (a + b) * 0.999)
    dn = d.normalized()
    x = (a * a - b * b + length * length) / (2 * length)
    h = math.sqrt(max(0.0, a * a - x * x))
    p = pole - dn * pole.dot(dn)
    p.normalize()
    return s + dn * x + p * h


# ---------------------------------------------------------------- decals

def tree(objs):
    verts, polys = [], []
    for o in objs:
        kit.apply(o)
        kit.refresh()
        mw = o.matrix_world
        off = len(verts)
        verts += [mw @ v.co for v in o.data.vertices]
        polys += [[off + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


def _frame_for(view):
    view = Vector(view).normalized()
    up = Vector((0, 0, 1)) if abs(view.z) < 0.9 else Vector((0, 1, 0))
    e1 = view.cross(up).normalized()
    e2 = e1.cross(view).normalized()
    return view, e1, e2


def _hit(bvh, p, view, lift):
    loc, nrm, _, _ = bvh.ray_cast(p + view * 0.5, -view, 2.0)
    if loc is None:
        return p
    return loc + nrm * lift


def decal(name, bvh, centre, rx, ry, mat, view=(0, 1, 0), lift=0.0015,
          n=12, rot=0.0, rings=1):
    """A painted oval shrink-wrapped onto the surface seen along `view`."""
    view, e1, e2 = _frame_for(view)
    centre = Vector(centre)
    bm = bmesh.new()
    mid = bm.verts.new(_hit(bvh, centre, view, lift))
    prev = None
    for k in range(1, rings + 1):
        f = k / rings
        ring = []
        for i in range(n):
            a = math.tau * i / n
            x, y = rx * f * math.cos(a), ry * f * math.sin(a)
            x, y = (x * math.cos(rot) - y * math.sin(rot),
                    x * math.sin(rot) + y * math.cos(rot))
            ring.append(bm.verts.new(_hit(bvh, centre + e1 * x + e2 * y,
                                          view, lift)))
        for i in range(n):
            j = (i + 1) % n
            if prev is None:
                bm.faces.new((mid, ring[i], ring[j]))
            else:
                bm.faces.new((prev[i], ring[i], ring[j], prev[j]))
        prev = ring
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm, mat)
    _face_out(obj, view)
    return obj


def stroke(name, bvh, pts, width, mat, view=(0, 1, 0), lift=0.0015,
           taper=0.5):
    """A painted line (a smile, a brow) through points seen along `view`."""
    view, e1, e2 = _frame_for(view)
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        t = (b - a)
        t2 = Vector((t.dot(e1), t.dot(e2))).normalized()
        nx, ny = -t2.y, t2.x
        f = i / (len(pts) - 1)
        w = width / 2 * (taper + (1 - taper) * math.sin(math.pi * f))
        off = e1 * nx * w + e2 * ny * w
        left.append(bm.verts.new(_hit(bvh, p + off, view, lift)))
        right.append(bm.verts.new(_hit(bvh, p - off, view, lift)))
    for i in range(len(pts) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    obj = kit._from_bmesh(name, bm, mat)
    _face_out(obj, view)
    return obj


def _face_out(obj, view):
    """Flip a decal's faces toward the viewer."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        if f.normal.dot(view) < 0:
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()


# ---------------------------------------------------------------- hard parts

def place(objs, rot=None, at=(0, 0, 0)):
    """Rotate pieces built around the origin, then move them to `at`."""
    if rot is None:
        rot = Matrix.Identity(3)
    elif not isinstance(rot, Matrix):
        rot = rot.to_matrix()
    if len(rot) == 3:
        rot = rot.to_4x4()
    m = Matrix.Translation(Vector(at)) @ rot
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        o.data.transform(m)
    return objs


def lathe_y(name, profile, mat, segments=16, bevel=0.0, crease_all=False):
    """Spin (radius, y) points around the y axis (a barrel, a ray-gun
    body). A zero radius at either end closes that end."""
    obj = kit.lathe(name, [(r, y) for r, y in profile], segments=segments,
                    mat=mat)
    # kit.lathe spins about z; turn z into y.
    obj.data.transform(Matrix.Rotation(-math.pi / 2, 4, "X"))
    if bevel:
        kit.add_bevel(obj, bevel, 2, angle=40)
        kit.apply(obj)
    obj.data.shade_smooth()
    return obj


def slab(name, outline, thickness, mat, bevel=0.003, segments=2,
         plane="xy"):
    """Extrude a flat outline (2D points, counter-clockwise) into a bevelled
    slab centred on its plane: fins, stars, lever loops."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -thickness / 2)) for x, y in outline]
    hi = [bm.verts.new((x, y, thickness / 2)) for x, y in outline]
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm, mat)
    if bevel:
        mod = kit.add_bevel(obj, bevel, segments, angle=30)
        mod.limit_method = "ANGLE"
        kit.apply(obj)
    if plane == "yz":        # outline x→y, y→z, thickness along x
        obj.data.transform(Matrix(((0, 0, 1, 0), (1, 0, 0, 0),
                                   (0, 1, 0, 0), (0, 0, 0, 1))))
    elif plane == "xz":      # outline x→x, y→z, thickness along y
        obj.data.transform(Matrix(((1, 0, 0, 0), (0, 0, -1, 0),
                                   (0, 1, 0, 0), (0, 0, 0, 1))))
    return obj


def rbox(name, size, at, mat, bevel=0.006, segments=2, rot=None):
    """A bevelled box (buckles, receivers, sights)."""
    obj = kit.box(name, size, (0, 0, 0), mat=mat, bevel=bevel,
                  segments=segments, grid=False)
    kit.apply(obj)
    place([obj], rot=rot, at=at)
    return obj


def rod(name, a, b, r, mat, verts=8):
    """A thin straight cylinder from a to b (antennas, barrels)."""
    a, b = Vector(a), Vector(b)
    obj = kit.cylinder(name, r, r, (b - a).length, verts=verts, mat=mat,
                       rings=1)
    q = (b - a).to_track_quat("Z", "Y")
    place([obj], rot=q, at=a)
    return obj


def slim(obj, ratio, sym=False):
    """Collapse-decimate a smoothed cage where it is nearly flat, keeping its
    silhouette, its open rims and its colour borders exactly in place: the
    subdivided surface for a fraction of the triangles."""
    if ratio >= 1.0:
        return obj
    kit.apply(obj)
    me = obj.data
    mats = {}
    for p in me.polygons:
        for ek in p.edge_keys:
            mats.setdefault(ek, []).append(p.material_index)
    keep = set()
    for ek, m in mats.items():
        if len(m) == 1 or len(set(m)) > 1:
            keep.update(ek)
    vg = obj.vertex_groups.new(name="slim")
    vg.add([v.index for v in me.vertices if v.index not in keep], 1.0,
           "REPLACE")
    if keep:
        vg.add(list(keep), 0.0, "REPLACE")
    mod = obj.modifiers.new("slim", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = False
    mod.vertex_group = "slim"
    mod.vertex_group_factor = 60.0
    if sym:
        mod.use_symmetry = True
        mod.symmetry_axis = "X"
    kit.apply(obj)
    obj.vertex_groups.clear()
    return obj


def tris(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in objs if o.type == "MESH")
