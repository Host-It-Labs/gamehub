"""Fast numpy mesh tools for the sculpted Inventor (figure_inventor_*.py).

Every builder here returns an ordinary Blender mesh object in world space
(Blender metres, +Y forward, Z up). Grids are numpy arrays of rows; solids
are closed and consistently wound so the voxel union can fuse them into one
connected surface.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import kit

TAU = math.tau


def ss(lo, hi, x):
    """Smoothstep, numpy friendly."""
    t = np.clip((np.asarray(x, dtype=float) - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def g(x, c, r):
    return np.exp(-((np.asarray(x, dtype=float) - c) / r) ** 2)


def spow(v, e):
    v = np.asarray(v, dtype=float)
    return np.sign(v) * np.abs(v) ** e


def interp_rows(rows, x, cols=None):
    """Monotone cubic interpolation of a sorted table [(x, a, b, ...)] at x
    (scalar or array). No overshoot between rows, so profiles stay smooth
    without bulges."""
    rows = np.asarray(rows, dtype=float)
    xs = rows[:, 0]
    out = []
    x = np.asarray(x, dtype=float)
    for c in range(1, rows.shape[1]):
        ys = rows[:, c]
        h = np.diff(xs)
        d = np.diff(ys) / h
        m = np.zeros_like(ys)
        m[1:-1] = np.where(d[:-1] * d[1:] > 0,
                           2 / (1 / np.where(d[:-1] == 0, 1e-9, d[:-1]) +
                                1 / np.where(d[1:] == 0, 1e-9, d[1:])), 0)
        m[0], m[-1] = d[0], d[-1]
        xc = np.clip(x, xs[0], xs[-1])
        i = np.clip(np.searchsorted(xs, xc) - 1, 0, len(xs) - 2)
        t = (xc - xs[i]) / h[i]
        h00 = 2 * t ** 3 - 3 * t ** 2 + 1
        h10 = t ** 3 - 2 * t ** 2 + t
        h01 = -2 * t ** 3 + 3 * t ** 2
        h11 = t ** 3 - t ** 2
        out.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] +
                   h11 * h[i] * m[i + 1])
    return out if len(out) > 1 else out[0]


# ------------------------------------------------------------- objects

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name, verts, faces, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.asarray(verts, dtype=float).tolist(), [],
                   [tuple(int(i) for i in f) for f in faces])
    me.validate(clean_customdata=False)
    me.update()
    obj = link(bpy.data.objects.new(name, me))
    if mat:
        obj.data.materials.append(kit.material(mat))
    if smooth:
        me.shade_smooth()
    return obj


def grid_faces(rows, cols, closed=True, offset=0):
    faces = []
    span = cols if closed else cols - 1
    for j in range(rows - 1):
        for i in range(span):
            k = (i + 1) % cols
            a = offset + j * cols
            b = offset + (j + 1) * cols
            faces.append((a + i, a + k, b + k, b + i))
    return faces


def grid(name, P, mat=None, closed=True, cap0=None, cap1=None):
    """Rows P[j, i] bridged into quads (closed around i). Caps: "pole" (a
    fan to the ring's centre), a point, or None. Rows run from cap0 to
    cap1; faces point outward when rows go up and columns turn
    counter-clockwise seen from above."""
    P = np.asarray(P, dtype=float)
    nr, nc = P.shape[:2]
    verts = P.reshape(-1, 3).tolist()
    faces = grid_faces(nr, nc, closed)
    for cap, j, flip in ((cap0, 0, True), (cap1, nr - 1, False)):
        if cap is None:
            continue
        centre = P[j].mean(axis=0) if isinstance(cap, str) else np.asarray(cap)
        c = len(verts)
        verts.append(list(centre))
        for i in range(nc):
            k = (i + 1) % nc
            a, b = j * nc + i, j * nc + k
            faces.append((c, b, a) if flip else (c, a, b))
    obj = mesh_object(name, verts, faces, mat)
    fix_winding(obj)
    return obj


def solid_shell(name, outer, inner, mat=None, closed=False):
    """A closed slab between two grids of equal shape (rows x cols), open
    along the columns unless `closed`: outer and inner faces joined along
    every boundary."""
    O = np.asarray(outer, dtype=float)
    I = np.asarray(inner, dtype=float)
    nr, nc = O.shape[:2]
    verts = np.concatenate([O.reshape(-1, 3), I.reshape(-1, 3)])
    n = nr * nc
    faces = grid_faces(nr, nc, closed)
    faces += [f[::-1] for f in grid_faces(nr, nc, closed, offset=n)]
    # Rims: first and last rows, and the two open column edges.
    for j in (0, nr - 1):
        span = nc if closed else nc - 1
        for i in range(span):
            k = (i + 1) % nc
            a, b = j * nc + i, j * nc + k
            q = (a, b, b + n, a + n)
            faces.append(q if j == 0 else q[::-1])
    if not closed:
        for i in (0, nc - 1):
            for j in range(nr - 1):
                a, b = j * nc + i, (j + 1) * nc + i
                q = (a, a + n, b + n, b)
                faces.append(q if i == 0 else q[::-1])
    obj = mesh_object(name, verts, faces, mat)
    fix_winding(obj)
    return obj


def fix_winding(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    try:
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    except Exception:
        pass
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def frames(path, up=(0, 0, 1)):
    """Parallel-transport frames (tangent, normal, binormal) along a path,
    seeded so the first normal leans toward `up`."""
    path = np.asarray(path, dtype=float)
    n = len(path)
    T = np.gradient(path, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    up = np.asarray(up, dtype=float)
    N = np.zeros_like(path)
    u = up - T[0] * up.dot(T[0])
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(T[0], [1, 0, 0])
    N[0] = u / np.linalg.norm(u)
    for i in range(1, n):
        v = N[i - 1] - T[i] * N[i - 1].dot(T[i])
        if np.linalg.norm(v) < 1e-9:
            v = N[i - 1]
        N[i] = v / np.linalg.norm(v)
    B = np.cross(T, N)
    return T, N, B


def sweep(name, path, radius, mat=None, n=24, up=(0, 0, 1), caps=("dome", "dome"),
          shape=None):
    """A tube along `path` (k x 3). `radius(t, a)` or a list of (rx, ry)
    per point; `shape(t, a)` adds a radial offset (relief)."""
    path = np.asarray(path, dtype=float)
    T, N, B = frames(path, up)
    k = len(path)
    ts = np.linspace(0, 1, k)
    angles = np.linspace(0, TAU, n, endpoint=False)
    rows = []
    for j in range(k):
        if callable(radius):
            r = radius(ts[j], angles)
            rx = ry = np.asarray(r, dtype=float) * np.ones(n)
        else:
            r = radius[j]
            rx, ry = (r, r) if np.isscalar(r) else r
            rx = rx * np.ones(n)
            ry = ry * np.ones(n)
        extra = shape(ts[j], angles) if shape else 0
        ring = (path[j] + np.outer((rx + extra) * np.cos(angles), N[j]) +
                np.outer((ry + extra) * np.sin(angles), B[j]))
        rows.append(ring)
    rows = np.array(rows)
    c0 = c1 = None
    if caps[0] == "dome":
        r0 = rows[0] - path[0]
        rows = np.concatenate([[path[0] + r0 * 0.55 - T[0] * np.abs(r0).max() * 0.55],
                               rows])
        c0 = path[0] - T[0] * np.abs(r0).max() * 0.8
    elif caps[0] == "flat":
        c0 = "pole"
    if caps[1] == "dome":
        r1 = rows[-1] - path[-1]
        rows = np.concatenate([rows, [path[-1] + r1 * 0.55 + T[-1] * np.abs(r1).max() * 0.55]])
        c1 = path[-1] + T[-1] * np.abs(r1).max() * 0.8
    elif caps[1] == "flat":
        c1 = "pole"
    return grid(name, rows, mat, closed=True, cap0=c0, cap1=c1)


def catmull(points, samples=8):
    """A Catmull-Rom path through points (inclusive of both ends)."""
    P = [np.asarray(p, dtype=float) for p in points]
    out = []
    for i in range(len(P) - 1):
        a = P[max(0, i - 1)]
        b, c = P[i], P[i + 1]
        d = P[min(len(P) - 1, i + 2)]
        for s in range(samples):
            t = s / samples
            out.append(0.5 * ((2 * b) + (-a + c) * t +
                              (2 * a - 5 * b + 4 * c - d) * t * t +
                              (-a + 3 * b - 3 * c + d) * t ** 3))
    out.append(P[-1])
    return np.array(out)


def resample(path, count):
    path = np.asarray(path, dtype=float)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    target = np.linspace(0, s[-1], count)
    return np.stack([np.interp(target, s, path[:, k]) for k in range(3)], axis=1)


def ball(name, r, at, mat=None, scale=(1, 1, 1), seg=24, rings=12):
    obj = kit.sphere(name, r, tuple(at), scale=scale, mat=mat,
                     segments=seg, rings=rings)
    kit.apply_transform(obj)
    obj.data.shade_smooth()
    return obj


def icosphere(name, r, at, mat=None, level=4):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=level, radius=r)
    bmesh.ops.translate(bm, vec=Vector(at), verts=bm.verts)
    obj = kit._from_bmesh(name, bm, mat)
    obj.data.shade_smooth()
    return obj


def coords(obj):
    a = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", a)
    return a.reshape(-1, 3)


def set_coords(obj, P):
    obj.data.vertices.foreach_set("co", np.asarray(P, dtype=float).reshape(-1))
    obj.data.update()


def normals(obj):
    obj.data.update()
    a = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("normal", a)
    return a.reshape(-1, 3)


def transform_obj(obj, M):
    obj.data.transform(Matrix(M) if not isinstance(M, Matrix) else M)
    obj.data.update()
    return obj


def apply_mods(obj):
    kit.apply(obj)
    return obj


def remesh(obj, voxel, smooth=0.0, iters=0, adaptivity=0.0):
    mod = obj.modifiers.new("Voxel union", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.adaptivity = adaptivity
    mod.use_smooth_shade = True
    kit.apply(obj)
    if iters:
        mod = obj.modifiers.new("Relax", "SMOOTH")
        mod.factor, mod.iterations = smooth, iters
        kit.apply(obj)
    obj.data.shade_smooth()
    return obj


def join(objs, name):
    """Join meshes (keeping materials) without remeshing."""
    for o in objs:
        kit.apply(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = objs[0]
    o.name = name
    o.data.name = name
    return o


def fuse(name, objs, voxel, mat=None, smooth=0.5, iters=2):
    """One connected surface from overlapping closed solids."""
    o = join(objs, name)
    remesh(o, voxel, smooth, iters)
    if mat:
        o.data.materials.clear()
        o.data.materials.append(kit.material(mat))
        for p in o.data.polygons:
            p.material_index = 0
    return o


def tree(obj):
    """A BVH of the evaluated mesh, in world space."""
    kit.refresh()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    me.transform(obj.matrix_world)
    me.calc_loop_triangles()
    verts = [v.co.copy() for v in me.vertices]
    tris = [tuple(t.vertices) for t in me.loop_triangles]
    ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, tris, all_triangles=True)


def nearest_distance(tree_, P):
    out = np.empty(len(P))
    for i, p in enumerate(P):
        hit = tree_.find_nearest(Vector(p))
        out[i] = hit[3] if hit[0] is not None else 1e9
    return out


def adjacency(obj):
    me = obj.data
    e = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", e)
    return e.reshape(-1, 2)


def laplacian(values, edges, mask=None, factor=0.5, iters=4):
    """Smooth per-vertex values (n x k) across mesh edges."""
    v = np.array(values, dtype=float)
    n = len(v)
    deg = np.bincount(edges.ravel(), minlength=n).astype(float)
    deg[deg == 0] = 1
    for _ in range(iters):
        acc = np.zeros_like(v)
        np.add.at(acc, edges[:, 0], v[edges[:, 1]])
        np.add.at(acc, edges[:, 1], v[edges[:, 0]])
        avg = acc / deg[:, None] if v.ndim == 2 else acc / deg
        step = (avg - v) * factor
        if mask is not None:
            step *= (mask[:, None] if v.ndim == 2 else mask)
        v += step
    return v


def smooth_positions(obj, mask, factor=0.5, iters=4):
    P = coords(obj)
    E = adjacency(obj)
    set_coords(obj, laplacian(P, E, mask, factor, iters))


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def solidify(obj, thickness, offset=-1.0):
    """Give an open sheet a closed thickness (inward by default)."""
    fix_normals_outward(obj)
    mod = obj.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = True
    mod.use_rim = True
    kit.apply(obj)
    obj.data.shade_smooth()
    return obj


def fix_normals_outward(obj, centre=None):
    """Point an open sheet's faces away from a centre (its bounds' middle)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    if centre is None:
        P = np.array([v.co[:] for v in bm.verts])
        centre = (P.min(0) + P.max(0)) / 2
    score = sum((Vector(f.calc_center_median()) - Vector(centre)).dot(f.normal)
                for f in bm.faces)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj
