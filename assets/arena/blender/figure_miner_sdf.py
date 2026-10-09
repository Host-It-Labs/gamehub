"""Signed-distance clay for the Miner (OpenVDB through Blender's bundled
`openvdb` module).

A sculpt is a list of steps applied in order to a distance field over a
box: each step adds (smooth union) or carves (smooth subtraction) a form
with its own blend radius `k`. Forms are analytic (ellipsoids, tapered
capsule chains, rounded boxes) or closed meshes turned into level sets
(lofted limbs and trunk). The field is evaluated slab by slab, each form
only inside its bounds, then meshed by OpenVDB. Smooth blends are what
make one connected body out of authored masses: a deltoid flowing into
the chest, cheeks into the nose, fingers into the palm.
"""

import math

import bpy
import numpy as np
import openvdb as vdb
from mathutils import Matrix, Vector

import kit


# ------------------------------------------------------------- blends

def smin(a, b, k):
    if np.isscalar(k) and k <= 0:
        return np.minimum(a, b)
    k = np.maximum(k, 1e-7)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


# ------------------------------------------------------------- forms

class Form:
    """An analytic or sampled distance with world bounds."""

    def bounds(self):
        raise NotImplementedError

    def eval(self, X, Y, Z):
        raise NotImplementedError


def _frame(axes):
    if axes is None:
        return np.eye(3)
    m = np.array([list(Vector(a).normalized()) for a in axes], dtype=np.float64)
    return m  # rows are the local axes in world space


class Ellipsoid(Form):
    def __init__(self, c, r, axes=None):
        self.c = np.array(list(c), dtype=np.float64)
        self.r = np.array(list(r), dtype=np.float64)
        self.m = _frame(axes)

    def bounds(self):
        e = np.abs(self.m.T) @ self.r
        return self.c - e, self.c + e

    def eval(self, X, Y, Z):
        dx, dy, dz = X - self.c[0], Y - self.c[1], Z - self.c[2]
        m = self.m
        lx = dx * m[0, 0] + dy * m[0, 1] + dz * m[0, 2]
        ly = dx * m[1, 0] + dy * m[1, 1] + dz * m[1, 2]
        lz = dx * m[2, 0] + dy * m[2, 1] + dz * m[2, 2]
        r = self.r
        k0 = np.sqrt((lx / r[0]) ** 2 + (ly / r[1]) ** 2 + (lz / r[2]) ** 2)
        k1 = np.sqrt((lx / r[0] ** 2) ** 2 + (ly / r[1] ** 2) ** 2 + (lz / r[2] ** 2) ** 2)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


class Chain(Form):
    """Round cones through points with radii (a tapered capsule path)."""

    def __init__(self, points, radii, scale=None):
        self.p = [np.array(list(p), dtype=np.float64) for p in points]
        self.r = list(radii) if isinstance(radii, (list, tuple)) else [radii] * len(points)
        self.scale = scale  # (axes rows, factors): squash the field locally

    def bounds(self):
        P = np.array(self.p)
        R = max(self.r)
        return P.min(axis=0) - R, P.max(axis=0) + R

    @staticmethod
    def round_cone(X, Y, Z, a, b, r1, r2):
        # iq's exact round cone
        ba = b - a
        l2 = float(ba @ ba)
        rr = r1 - r2
        a2 = l2 - rr * rr
        il2 = 1.0 / max(l2, 1e-12)
        px, py, pz = X - a[0], Y - a[1], Z - a[2]
        y = px * ba[0] + py * ba[1] + pz * ba[2]
        z = y - l2
        xx, xy, xz = px * l2 - ba[0] * y, py * l2 - ba[1] * y, pz * l2 - ba[2] * y
        x2 = xx * xx + xy * xy + xz * xz
        y2 = y * y * l2
        z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        out = np.empty_like(X)
        c1 = np.sign(z) * a2 * z2 > k
        c2 = np.sign(y) * a2 * y2 < k
        out[:] = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
        out = np.where(c2, np.sqrt(x2 + y2) * il2 - r1, out)
        out = np.where(c1, np.sqrt(x2 + z2) * il2 - r2, out)
        return out

    def eval(self, X, Y, Z):
        d = None
        for i in range(len(self.p) - 1):
            a, b = self.p[i], self.p[i + 1]
            if np.allclose(a, b):
                continue
            e = self.round_cone(X, Y, Z, a, b, self.r[i], self.r[i + 1])
            d = e if d is None else np.minimum(d, e)
        if d is None:
            # Every point coincides: a ball.
            p, r = self.p[0], max(self.r)
            d = np.sqrt((X - p[0]) ** 2 + (Y - p[1]) ** 2 + (Z - p[2]) ** 2) - r
        return d


class Box(Form):
    """A rounded box with a frame: half sizes, corner radius."""

    def __init__(self, c, half, radius, axes=None):
        self.c = np.array(list(c), dtype=np.float64)
        self.h = np.array(list(half), dtype=np.float64)
        self.rad = radius
        self.m = _frame(axes)

    def bounds(self):
        e = np.abs(self.m.T) @ self.h
        return self.c - e, self.c + e

    def eval(self, X, Y, Z):
        dx, dy, dz = X - self.c[0], Y - self.c[1], Z - self.c[2]
        m = self.m
        q = []
        for i in range(3):
            l = dx * m[i, 0] + dy * m[i, 1] + dz * m[i, 2]
            q.append(np.abs(l) - (self.h[i] - self.rad))
        qx, qy, qz = q
        outside = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2 + np.maximum(qz, 0) ** 2)
        inside = np.minimum(np.maximum(qx, np.maximum(qy, qz)), 0)
        return outside + inside - self.rad


class Plane(Form):
    """Half space below a plane (distance positive above along n)."""

    def __init__(self, point, normal, lo, hi):
        self.p = np.array(list(point), dtype=np.float64)
        n = np.array(list(normal), dtype=np.float64)
        self.n = n / np.linalg.norm(n)
        self.lo, self.hi = np.array(lo, dtype=np.float64), np.array(hi, dtype=np.float64)

    def bounds(self):
        return self.lo, self.hi

    def eval(self, X, Y, Z):
        return (X - self.p[0]) * self.n[0] + (Y - self.p[1]) * self.n[1] + (Z - self.p[2]) * self.n[2]


class MeshForm(Form):
    """A closed Blender mesh as a narrow-band level set."""

    def __init__(self, obj, voxel, band):
        pts, tri = mesh_arrays(obj)
        tr = vdb.createLinearTransform(voxelSize=voxel)
        self.voxel = voxel
        self.band = band
        self.grid = vdb.FloatGrid.createLevelSetFromPolygons(pts, triangles=tri, transform=tr,
                                                            halfWidth=float(band))
        self.lo = pts.min(axis=0).astype(np.float64) - voxel * band
        self.hi = pts.max(axis=0).astype(np.float64) + voxel * band
        bpy.data.objects.remove(obj, do_unlink=True)

    def bounds(self):
        return self.lo, self.hi

    def sample(self, origin, h, shape):
        """Dense samples at origin + ijk*h, nearest voxel of this grid."""
        # Our sculpt grid and this grid share the voxel size and an origin
        # aligned to it, so sampling is a block copy.
        ijk = np.rint(np.array(origin) / self.voxel).astype(int)
        arr = np.empty(shape, dtype=np.float32)
        self.grid.copyToArray(arr, ijk=tuple(int(v) for v in ijk))
        return arr.astype(np.float64)

    def eval(self, X, Y, Z):
        raise RuntimeError("MeshForm is sampled by Sculpt")


class Offset(Form):
    """A form grown (d > 0) or shrunk by a distance."""

    def __init__(self, form, d):
        self.form, self.d = form, d

    def bounds(self):
        lo, hi = self.form.bounds()
        return lo - max(0, self.d), hi + max(0, self.d)


class Intersect(Form):
    """Where both forms are (the second usually a clipping half space)."""

    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k

    def bounds(self):
        la, ha = self.a.bounds()
        lb, hb = self.b.bounds()
        return np.maximum(la, lb), np.minimum(ha, hb)


def kfield(fn, kmax):
    """A blend radius varying over space: fn(X, Y, Z) -> k array."""
    fn.kmax = kmax
    return fn


# ------------------------------------------------------------- sculpt

class Sculpt:
    def __init__(self, lo, hi, voxel):
        self.h = voxel
        # Align the origin to the voxel lattice so mesh grids line up.
        self.lo = np.floor(np.array(lo, dtype=np.float64) / voxel) * voxel
        self.hi = np.array(hi, dtype=np.float64)
        self.n = np.ceil((self.hi - self.lo) / voxel).astype(int) + 1
        self.steps = []

    def add(self, form, k=0.0):
        self.steps.append(("add", form, k))
        return self

    def carve(self, form, k=0.0):
        self.steps.append(("carve", form, k))
        return self

    def clip(self, form, k=0.0):
        self.steps.append(("clip", form, k))
        return self

    def mesh_form(self, obj, band=None):
        b = band or int(math.ceil(0.06 / self.h)) + 4
        return MeshForm(obj, self.h, b)

    def field_slab(self, k0, k1):
        nx, ny, _ = self.n
        nz = k1 - k0
        h = self.h
        xs = (self.lo[0] + np.arange(nx) * h).astype(np.float32)
        ys = (self.lo[1] + np.arange(ny) * h).astype(np.float32)
        zs = (self.lo[2] + np.arange(k0, k1) * h).astype(np.float32)
        far = 1.0
        D = np.full((nx, ny, nz), far, dtype=np.float32)
        for op, form, k in self.steps:
            lo, hi = form.bounds()
            kfn = k if callable(k) else None
            kmax = getattr(k, "kmax", 0.05) if kfn else k
            m = kmax + 2 * h
            if op == "clip":
                ilo = np.array([0, 0, 0])
                ihi = np.array([nx, ny, nz])
            else:
                ilo = np.maximum(0, np.floor((lo - m - [self.lo[0], self.lo[1], zs[0]]) / h).astype(int))
                ihi = np.minimum([nx, ny, nz], np.ceil((hi + m - [self.lo[0], self.lo[1], zs[0]]) / h).astype(int) + 1)
                if np.any(ihi <= ilo):
                    continue
            sx, sy, sz = slice(ilo[0], ihi[0]), slice(ilo[1], ihi[1]), slice(ilo[2], ihi[2])
            shape = (ihi[0] - ilo[0], ihi[1] - ilo[1], ihi[2] - ilo[2])
            d = self.sample(form, xs, ys, zs, ilo, ihi)
            cur = D[sx, sy, sz]
            if kfn is not None:
                X, Y, Z = np.meshgrid(xs[sx], ys[sy], zs[sz], indexing="ij")
                k = kfn(X, Y, Z)
            if op == "add":
                D[sx, sy, sz] = smin(cur, d.astype(np.float32), k)
            elif op == "carve":
                D[sx, sy, sz] = smax(cur, -d.astype(np.float32), k)
            else:
                D[sx, sy, sz] = smax(cur, d.astype(np.float32), k)
        return D

    def sample(self, form, xs, ys, zs, ilo, ihi):
        """A form's distances over the block ilo..ihi of this slab."""
        shape = (ihi[0] - ilo[0], ihi[1] - ilo[1], ihi[2] - ilo[2])
        if isinstance(form, MeshForm):
            origin = (xs[ilo[0]], ys[ilo[1]], zs[ilo[2]])
            return form.sample(origin, self.h, shape)
        if isinstance(form, Offset):
            return self.sample(form.form, xs, ys, zs, ilo, ihi) - form.d
        if isinstance(form, Intersect):
            a = self.sample(form.a, xs, ys, zs, ilo, ihi)
            b = self.sample(form.b, xs, ys, zs, ilo, ihi)
            return smax(a, b, form.k)
        X, Y, Z = np.meshgrid(xs[ilo[0]:ihi[0]], ys[ilo[1]:ihi[1]], zs[ilo[2]:ihi[2]], indexing="ij")
        return form.eval(X, Y, Z)

    def build(self, name, mat, slab=48, adaptivity=0.0):
        import time
        started = time.time()
        nx, ny, nz = self.n
        tr = vdb.createLinearTransform(voxelSize=self.h)
        tr.postTranslate(tuple(float(v) for v in self.lo))
        grid = vdb.FloatGrid(background=float(self.h * 3))
        grid.transform = tr
        grid.gridClass = vdb.GridClass.LEVEL_SET if hasattr(vdb, "GridClass") else grid.gridClass
        for k0 in range(0, nz, slab):
            k1 = min(nz, k0 + slab)
            D = self.field_slab(k0, k1)
            # Close the box: its outer shell is outside.
            if k0 == 0:
                D[:, :, 0] = np.maximum(D[:, :, 0], self.h)
            if k1 == nz:
                D[:, :, -1] = np.maximum(D[:, :, -1], self.h)
            D[0, :, :] = np.maximum(D[0, :, :], self.h)
            D[-1, :, :] = np.maximum(D[-1, :, :], self.h)
            D[:, 0, :] = np.maximum(D[:, 0, :], self.h)
            D[:, -1, :] = np.maximum(D[:, -1, :], self.h)
            D = np.clip(D, -self.h * 3, self.h * 3).astype(np.float32)
            grid.copyFromArray(D, ijk=(0, 0, k0), tolerance=0.0)
        pts, tris, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=adaptivity)
        o = to_object(name, pts, tris, quads, mat)
        print(f"SCULPT {name}: {tuple(self.n)} voxels, {len(self.steps)} steps, "
              f"{len(o.data.polygons)} faces, {time.time() - started:.1f}s", flush=True)
        return o


def to_object(name, pts, tris, quads, mat):
    import bmesh
    pts = np.asarray(pts, dtype=np.float32).reshape(-1, 3)
    tris = np.asarray(tris, dtype=np.int64).reshape(-1, 3)
    quads = np.asarray(quads, dtype=np.int64).reshape(-1, 4)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(pts))
    me.vertices.foreach_set("co", pts.reshape(-1))
    nq, nt = len(quads), len(tris)
    loops = np.concatenate([quads.reshape(-1), tris.reshape(-1)]).astype(np.int32)
    sizes = np.concatenate([np.full(nq, 4), np.full(nt, 3)]).astype(np.int32)
    starts = np.concatenate([[0], np.cumsum(sizes)[:-1]]).astype(np.int32)
    me.loops.add(len(loops))
    me.loops.foreach_set("vertex_index", loops)
    me.polygons.add(nq + nt)
    me.polygons.foreach_set("loop_start", starts)
    me.update(calc_edges=True)
    me.validate(clean_customdata=False)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    # Make the normals point outside.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(kit.material(mat))
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), dtype=bool))
    me.update()
    return o


def mesh_arrays(o):
    """World-space points and triangle indices of a mesh object."""
    kit.refresh()
    me = o.data
    pts = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", pts)
    pts = pts.reshape(-1, 3)
    mw = np.array(o.matrix_world)
    pts = pts @ mw[:3, :3].T + mw[:3, 3]
    me.calc_loop_triangles()
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", tri)
    return pts.astype(np.float32), tri.reshape(-1, 3).astype(np.uint32)


def union_meshes(objs, name, voxel, mat, adaptivity=0.0):
    """Weld region meshes into one surface (their overlaps coincide)."""
    pts_all, tri_all, off = [], [], 0
    for o in objs:
        p, t = mesh_arrays(o)
        pts_all.append(p)
        tri_all.append(t + off)
        off += len(p)
    pts = np.concatenate(pts_all)
    tri = np.concatenate(tri_all)
    tr = vdb.createLinearTransform(voxelSize=voxel)
    grid = vdb.FloatGrid.createLevelSetFromPolygons(pts, triangles=tri, transform=tr, halfWidth=3.0)
    p, t, q = grid.convertToPolygons(isovalue=0.0, adaptivity=adaptivity)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return to_object(name, p, t, q, mat)
