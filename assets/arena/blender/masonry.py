"""Masonry for Arena's diorama world pieces (towers.py).

Stones, slates, planks, cloth and moss are written straight into one bmesh
per piece, with their own UVs lined up with the diorama tiles
(docs/concepts/2026-09-26-arena-retheme/README.md, "Diorama textures"):

- stone: six courses of equal height. The face of every modelled stone maps
  onto exactly one course of the tile, so the tile's mortar lines fall in
  the modelled joints and never across a stone.
- slate: ten rows of equal height. Every modelled row of slates maps onto one
  row of the tile.
- wood: five vertical planks. Every modelled plank or beam maps onto one
  plank of the tile, grain along its length.

Walls are laid in courses round a Loop (a plan outline swept up in z): each
course is split into stones with staggered joints, a stone always wraps a
convex corner (quoins, alternating course by course) and a joint always
falls in a concave one. Solids (boxes and arch outlines) mark where other
parts of the building stand, so no stone is laid where it could not be seen.
"""

import bisect
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

import kit

COURSES = 6    # stone tile
ROWS = 10      # slate tile
PLANKS = 5     # wood tile
UP = Vector((0, 0, 1))


def newell(pts):
    n = Vector((0, 0, 0))
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


def pick(rnd, mats):
    """A material from a list of names or of (name, weight) pairs."""
    if isinstance(mats, str):
        return mats
    if isinstance(mats[0], str):
        return rnd.choice(mats)
    total = sum(w for _, w in mats)
    x = rnd.uniform(0, total)
    for m, w in mats:
        x -= w
        if x <= 0:
            return m
    return mats[-1][0]


# ---------------------------------------------------------------- geometry

class Geo:
    """Faces with UVs and materials gathered in one bmesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def vert(self, co):
        return self.bm.verts.new(co)

    def face(self, vs, uvs, mat, out=None):
        """A face through BMVerts `vs`; wound to face `out` when given."""
        if out is not None:
            n = newell([v.co for v in vs])
            if n.dot(Vector(out)) < 0:
                vs = list(reversed(vs))
                uvs = list(reversed(uvs))
        if len(set(vs)) < 3:
            return None
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = self.mi(mat)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        return f

    def poly(self, pts, uvs, mat, out=None):
        return self.face([self.vert(p) for p in pts], uvs, mat, out)

    def add(self, obj, uv=None):
        """Fold a mesh object (a kit.lathe, kit.tube, ...) in, world
        transform applied, and delete it. `uv` re-projects it first
        ("box", "box-small" or "cyl")."""
        kit.refresh()
        kit.apply(obj)
        if uv == "box":
            kit.uv_box(obj)
        elif uv == "box-small":
            kit.uv_box(obj, small=True)
        elif uv == "cyl":
            kit.uv_cylinder(obj)
        me = obj.data
        tmp = bmesh.new()
        tmp.from_mesh(me)
        tmp.transform(obj.matrix_world)
        uvl = tmp.loops.layers.uv.active
        vmap = {v: self.bm.verts.new(v.co) for v in tmp.verts}
        for f in tmp.faces:
            mat = me.materials[f.material_index].name if me.materials \
                else "stone:tower-stone"
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = self.mi(mat)
            for lo, nl in zip(f.loops, nf.loops):
                nl[self.uv].uv = lo[uvl].uv if uvl else (0, 0)
        tmp.free()
        bpy.data.objects.remove(obj, do_unlink=True)

    def build(self, name, angle=52):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        for m in self.mats:
            me.materials.append(kit.material(m))
        kit.shade(obj, angle)
        return obj


def tri_count(g):
    return sum(len(f.verts) - 2 for f in g.bm.faces)


def triangles(root):
    n = 0
    for o in kit.descendants(root):
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


# ---------------------------------------------------------------- solids

class Box:
    def __init__(self, lo, hi, round_=False):
        self.lo, self.hi, self.round = Vector(lo), Vector(hi), round_

    def hit(self, p):
        return all(self.lo[i] <= p[i] <= self.hi[i] for i in range(3))


class Arch:
    """An arched opening's outline (and its surround) in a wall: `frame`
    maps world points to (across, up, depth) with the springing centre at
    across 0, up `spring`."""

    def __init__(self, frame, half, spring, sill, radius, depth):
        self.inv = frame.inverted()
        self.half, self.spring, self.sill = half, spring, sill
        self.radius, self.depth = radius, depth
        self.round = True

    def hit(self, p):
        q = self.inv @ Vector(p)
        if not (self.depth[0] <= q.z <= self.depth[1]) or q.y < self.sill:
            return False
        if q.y <= self.spring:
            return abs(q.x) <= self.half
        return q.x * q.x + (q.y - self.spring) ** 2 <= self.radius ** 2


class Solids:
    def __init__(self, items=()):
        self.items = list(items)

    def add(self, s):
        self.items.append(s)
        return s

    def box(self, lo, hi):
        return self.add(Box(lo, hi))

    def hit(self, p):
        for s in self.items:
            if s.hit(p):
                return s
        return None


def frame_at(origin, normal, up=UP):
    """A matrix whose x runs across a wall face, y up it, z out of it."""
    n = Vector(normal).normalized()
    y = Vector(up).normalized()
    x = y.cross(n).normalized()
    y = n.cross(x).normalized()
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0], m[i][1], m[i][2] = x[i], y[i], n[i]
        m[i][3] = origin[i]
    return m


# ---------------------------------------------------------------- loops

class Loop:
    """A closed plan outline (anticlockwise from above), convex corners cut
    by a small chamfer, swept up in z and optionally scaled about `centre`
    with height (a battered or tapering wall)."""

    def __init__(self, poly, chamfer=0.028, centre=(0, 0), scale=None,
                 corner=25):
        pts, corners = [], []
        n = len(poly)
        for i in range(n):
            p0, p1, p2 = (Vector(poly[i - 1]).to_2d(), Vector(poly[i]).to_2d(),
                          Vector(poly[(i + 1) % n]).to_2d())
            d0 = (p1 - p0).normalized()
            d1 = (p2 - p1).normalized()
            turn = d0.x * d1.y - d0.y * d1.x
            ang = math.acos(max(-1, min(1, d0.dot(d1))))
            sharp = ang > math.radians(corner)
            if sharp and turn > 0 and chamfer > 0:
                pts += [p1 - d0 * chamfer, p1 + d1 * chamfer]
                corners.append([len(pts) - 2, "convex"])
            else:
                pts.append(p1)
                if sharp:
                    corners.append([len(pts) - 1,
                                    "convex" if turn > 0 else "concave"])
        self.pts = pts
        self.cum = [0.0]
        for i in range(len(pts)):
            self.cum.append(self.cum[-1] + (pts[(i + 1) % len(pts)] -
                                            pts[i]).length)
        self.length = self.cum[-1]
        self.normals = []
        for i in range(len(pts)):
            d = (pts[(i + 1) % len(pts)] - pts[i]).normalized()
            self.normals.append(Vector((d.y, -d.x)))
        self.corners = []
        for idx, kind in corners:
            if kind == "convex" and chamfer > 0 and \
                    (pts[(idx + 1) % len(pts)] - pts[idx]).length < \
                    chamfer * 2.5:
                u = (self.cum[idx] + self.cum[idx + 1]) / 2
            else:
                u = self.cum[idx]
            self.corners.append((u, kind))
        self.centre = Vector(centre).to_2d()
        self.scale = scale
        self.vertex_us = self.cum[:-1]

    def _seg(self, u):
        u %= self.length
        i = bisect.bisect_right(self.cum, u) - 1
        i = min(max(i, 0), len(self.pts) - 1)
        return i, u

    def point2(self, u):
        i, u = self._seg(u)
        a, b = self.pts[i], self.pts[(i + 1) % len(self.pts)]
        seg = self.cum[i + 1] - self.cum[i]
        t = (u - self.cum[i]) / seg if seg > 1e-9 else 0
        if t < 1e-6:
            n = (self.normals[i - 1] + self.normals[i]).normalized()
        elif t > 1 - 1e-6:
            n = (self.normals[i] + self.normals[(i + 1) %
                                                len(self.pts)]).normalized()
        else:
            n = self.normals[i]
        return a + (b - a) * t, n

    def S(self, u, z):
        p, n = self.point2(u)
        if self.scale:
            s = self.scale(z)
            ds = (self.scale(z + 0.01) - self.scale(z - 0.01)) / 0.02
            rel = p - self.centre
            p = self.centre + rel * s
            nz = -ds * rel.dot(n)
            nn = Vector((n.x, n.y, nz)).normalized()
        else:
            nn = Vector((n.x, n.y, 0))
        return Vector((p.x, p.y, z)), nn


def offset_poly(poly, d):
    """Push an anticlockwise polygon out by d, mitring the corners."""
    n = len(poly)
    out = []
    for i in range(n):
        p0, p1, p2 = (Vector(poly[i - 1]).to_2d(), Vector(poly[i]).to_2d(),
                      Vector(poly[(i + 1) % n]).to_2d())
        d0 = (p1 - p0).normalized()
        d1 = (p2 - p1).normalized()
        n0 = Vector((d0.y, -d0.x))
        n1 = Vector((d1.y, -d1.x))
        m = (n0 + n1)
        k = d / max(0.2, (1 + n0.dot(n1)) / 2) if m.length > 1e-6 else d
        m = m.normalized() if m.length > 1e-6 else n0
        out.append(tuple(p1 + m * (k * (m.dot(n0)))))
    return out


def circle(r, n, centre=(0, 0), phase=0.0):
    return [(centre[0] + r * math.cos(phase + math.tau * i / n),
             centre[1] + r * math.sin(phase + math.tau * i / n))
            for i in range(n)]


def course_heights(z0, z1, rnd, lo=0.19, hi=0.26, joints=()):
    """Courses from z0 to z1 of random heights between lo and hi, with a
    joint at every height in `joints`."""
    marks = sorted([z0] + [j for j in joints if z0 + 0.05 < j < z1 - 0.05] +
                   [z1])
    out = []
    for a, b in zip(marks, marks[1:]):
        span = b - a
        k = max(1, round(span / ((lo + hi) / 2)))
        hs = [rnd.uniform(lo, hi) for _ in range(k)]
        s = sum(hs)
        z = a
        for h in hs:
            out.append((z, z + h * span / s))
            z += h * span / s
        out[-1] = (out[-1][0], b)
    return out


# ---------------------------------------------------------------- stones

def band_uv(u, v, u0, v0, h, band, uoff, squeeze=0.8, bands=COURSES):
    return (uoff + (u - u0) / h / bands * squeeze,
            (band + (v - v0) / h) / bands)


def facing_stone(g, S, ub, ut, v0, v1, mat, rnd, breaks=(), p=0.03,
                 c=0.022, rings=1, jit=0.0025, band=None, squeeze=0.8,
                 bands=COURSES, tilt=0.3, sink=0.004, vary=(0.7, 1.3),
                 wobble=0.0):
    """One dressed stone standing proud of a wall surface S(u, v) ->
    (point, normal): a chamfered slab whose bottom edge spans ub = (u0, u1)
    and top edge ut at heights v0..v1 (slanted ends where ub != ut)."""
    h = v1 - v0
    if h < 2.6 * c or min(ub[1] - ub[0], ut[1] - ut[0]) < 2.6 * c:
        return 0
    band = rnd.randrange(bands) if band is None else band
    uoff = rnd.random()
    pp = p * rnd.uniform(*vary)
    tu = rnd.uniform(-tilt, tilt) * pp
    tv = rnd.uniform(-tilt, tilt) * pp
    um = (ub[0] + ub[1] + ut[0] + ut[1]) / 4
    wm = max(0.05, (ub[1] - ub[0] + ut[1] - ut[0]) / 2)
    vm = (v0 + v1) / 2
    lo_b, hi_b = max(ub[0], ut[0]), min(ub[1], ut[1])
    inner = [b for b in breaks if lo_b + c < b < hi_b - c]

    def left(v):
        return ub[0] + (ut[0] - ub[0]) * (v - v0) / h

    def right(v):
        return ub[1] + (ut[1] - ub[1]) * (v - v0) / h

    # an irregular footprint: each corner nudged along and across
    wob = [(rnd.uniform(-wobble, wobble), rnd.uniform(-wobble, wobble))
           for _ in range(4)] if wobble else [(0, 0)] * 4

    def nudge(u, v):
        s_ = (u - um) / wm + 0.5
        t_ = (v - v0) / h
        s_ = min(1, max(0, s_))
        t_ = min(1, max(0, t_))
        du = ((wob[0][0] * (1 - s_) + wob[1][0] * s_) * (1 - t_) +
              (wob[2][0] * (1 - s_) + wob[3][0] * s_) * t_)
        dv = ((wob[0][1] * (1 - s_) + wob[1][1] * s_) * (1 - t_) +
              (wob[2][1] * (1 - s_) + wob[3][1] * s_) * t_)
        return u + du, v + dv

    def row(v, inset):
        a, b = left(v) + inset, right(v) - inset
        return [a] + [x for x in inner if a < x < b] + [b]

    def ring(inset_u, inset_v, off, full):
        vb, vt = v0 + inset_v, v1 - inset_v
        rb, rt = row(vb, inset_u), row(vt, inset_u)
        if len(rb) != len(rt):
            rb = [left(vb) + inset_u] + inner + [right(vb) - inset_u]
            rt = [left(vt) + inset_u] + inner + [right(vt) - inset_u]
        out = []
        for us, v in ((rb, vb), (rt, vt)):
            r = []
            for u in us:
                uu, vv = nudge(u, v)
                pt, n = S(uu, vv)
                o = off
                if full:
                    o += tu * (u - um) / wm + tv * (v - vm) / h
                    o += rnd.uniform(-jit, jit)
                r.append((g.vert(pt + n * o), band_uv(u, v, ub[0], v0, h,
                                                       band, uoff, squeeze,
                                                       bands), n))
            out.append(r)
        return out

    rs = [ring(0, 0, -sink, False)]
    if rings > 1:
        rs.append(ring(c * 0.38, c * 0.38, pp * 0.72, True))
    rs.append(ring(c, c, pp, True))
    ctr = S(um, vm)
    centre, normal = ctr[0], ctr[1]
    front_b, front_t = rs[-1]
    k = 0
    for i in range(len(front_b) - 1):
        a, b, cc, d = front_b[i], front_b[i + 1], front_t[i + 1], front_t[i]
        g.face([a[0], b[0], cc[0], d[0]], [a[1], b[1], cc[1], d[1]], mat,
               a[2])
        k += 2
    for A, B in zip(rs, rs[1:]):
        for side in (0, 1):
            ra, rb = A[side], B[side]
            for i in range(len(ra) - 1):
                q = [ra[i], ra[i + 1], rb[i + 1], rb[i]]
                out = (sum((x[0].co for x in q), Vector()) / 4 - centre)
                out = out.normalized() + normal * 0.3
                g.face([x[0] for x in q], [x[1] for x in q], mat, out)
                k += 2
        for end in (0, -1):
            q = [A[0][end], A[1][end], B[1][end], B[0][end]]
            out = (sum((x[0].co for x in q), Vector()) / 4 - centre)
            out = out.normalized() + normal * 0.3
            g.face([x[0] for x in q], [x[1] for x in q], mat, out)
            k += 2
    return k


def _split(a, b, lengths, rnd, fixed, forbid, avoid, min_len=0.14,
           gap=0.07):
    """Joint positions between a and b: the fixed ones, then random stones
    in each gap, never inside a forbidden zone, staggered from `avoid`."""
    marks = [a]
    for f in sorted(fixed):
        if a + min_len < f < b - min_len and f - marks[-1] > min_len:
            marks.append(f)
    if b - marks[-1] < min_len and len(marks) > 1:
        marks.pop()
    marks.append(b)
    out = [a]
    for s, e in zip(marks, marks[1:]):
        x = s
        while e - x > lengths[1]:
            rem = e - x
            L = rnd.uniform(*lengths)
            if rem - L < min_len:
                L = rem / 2
            j = x + L
            for _ in range(6):
                bad = any(lo < j < hi for lo, hi in forbid) or \
                    any(abs(j - q) < gap for q in avoid)
                if not bad:
                    break
                j += gap * 0.8
            if j > e - min_len:
                break
            out.append(j)
            x = j
        out.append(e)
    clean = [out[0]]
    for j in out[1:]:
        if j - clean[-1] > 0.05:
            clean.append(j)
    clean[-1] = b
    return clean


def _runs(flags, us, L, closed):
    """Runs of True in flags sampled at us: list of (a, b), a < b; on a
    closed loop a run may pass the end (b > L)."""
    n = len(flags)
    if all(flags):
        return None
    runs = []
    i = 0
    while i < n:
        if flags[i]:
            j = i
            while j + 1 < n and flags[j + 1]:
                j += 1
            runs.append([us[i], us[j], i, j])
            i = j + 1
        else:
            i += 1
    if closed and len(runs) > 1 and runs[0][2] == 0 and runs[-1][3] == n - 1:
        first = runs.pop(0)
        runs[-1][1] = first[1] + L
    return [(r[0], r[1]) for r in runs]


def lay_courses(g, S, u0, u1, courses, rnd, mats, solids=None, closed=False,
                corners=(), breaks=(), lengths=(0.3, 0.52), joint=0.012,
                p=0.03, c=0.022, rings=1, quoin=(0.3, 0.16), step=0.02,
                keep=None, **kw):
    """Lay stones in `courses` [(v0, v1)] on surface S between u0 and u1
    (a closed loop when `closed`, u0 = 0 and u1 its length). `corners`
    [(u, "convex"|"concave")] get quoins or joints; `solids` hide stones
    wherever another part stands in front of the wall. `keep(u, v)` may
    veto a stone (ruins). Returns the triangle count."""
    tri = 0
    prev = []
    L = u1 - u0
    n = max(8, int(L / step))
    us = [u0 + L * i / n for i in range(n + (0 if closed else 1))]
    ci = 0
    for (v0, v1) in courses:
        va, vb = v0 + joint / 2, v1 - joint / 2
        if vb - va < 3 * c:
            continue
        samples = (va + 0.004, (va + vb) / 2, vb - 0.004)

        def blocker(u, v):
            if not solids:
                return None
            pt, nn = S(u, v)
            return solids.hit(pt + nn * (p + 0.012))

        free = [all(blocker(u, v) is None for v in samples) for u in us]
        runs = _runs(free, us, L, closed)
        fixed, forbid, quoins = [], [], []
        concave = [uc for uc, kind in corners if kind == "concave"]
        for k, (uc, kind) in enumerate(corners):
            if kind == "concave":
                fixed.append(uc)
            else:
                a, b = quoin if (ci + k) % 2 == 0 else quoin[::-1]
                a += rnd.uniform(-0.03, 0.03)
                b += rnd.uniform(-0.03, 0.03)
                quoins += [uc - a, uc + b]
                forbid.append((uc - a + 0.03, uc + b - 0.03))

        def near_concave(j):
            for q in concave:
                for k in (-1, 0, 1):
                    if abs(j - (q + k * L)) < 0.17:
                        return True
            return False
        fixed += [j for j in quoins if not near_concave(j)]
        if runs is None:
            if closed:
                start = min(fixed) if fixed else rnd.uniform(u0, u1)
                runs = [(start, start + L)]
            else:
                runs = [(u0, u1)]
        joints_here = []
        for a, b in runs:
            if b - a < 0.1:
                continue
            ex = []
            for f in fixed:
                for k in (-1, 0, 1, 2):
                    ex.append(f + k * L if closed else f)
            fb = []
            for lo, hi in forbid:
                for k in (-1, 0, 1, 2):
                    sh = k * L if closed else 0
                    fb.append((lo + sh, hi + sh))
            av = []
            for q in prev:
                for k in (-1, 0, 1, 2):
                    av.append(q + (k * L if closed else 0))
            js = _split(a, b, lengths, rnd, ex, fb, av)
            # Ends against a rounded opening follow its outline.
            ends = {}
            for idx, u in ((0, a), (len(js) - 1, b)):
                d = -1 if idx == 0 else 1
                s = blocker(u + d * step * 1.5, (va + vb) / 2)
                if s is not None and getattr(s, "round", False):
                    got = []
                    for v in (va + 0.004, vb - 0.004):
                        x = u
                        while abs(x - u) < 0.45 and \
                                blocker(x + d * 0.01, v) is None:
                            x += d * 0.01
                        got.append(x)
                    ends[idx] = got
            for i in range(len(js) - 1):
                s0 = js[i] + (joint / 2 if i > 0 else 0.0)
                s1 = js[i + 1] - (joint / 2 if i < len(js) - 2 else 0.0)
                b0 = t0 = s0
                b1 = t1 = s1
                if i == 0 and 0 in ends:
                    b0, t0 = ends[0]
                if i == len(js) - 2 and len(js) - 1 in ends:
                    b1, t1 = ends[len(js) - 1]
                if keep and not keep((s0 + s1) / 2, (va + vb) / 2):
                    continue
                bk = []
                for bu in breaks:
                    for k in (-1, 0, 1, 2):
                        x = bu + (k * L if closed else 0)
                        if min(b0, t0) < x < max(b1, t1):
                            bk.append(x)
                tri += facing_stone(g, S, (b0, b1), (t0, t1), va, vb,
                                    pick(rnd, mats), rnd, sorted(bk), p=p,
                                    c=c, rings=rings, **kw)
            joints_here += js[1:-1]
        prev = [((j - u0) % L) + u0 if closed else j for j in joints_here]
        ci += 1
    return tri


def lay_loop(g, loop, courses, rnd, mats, **kw):
    return lay_courses(g, loop.S, 0.0, loop.length, courses, rnd, mats,
                       closed=True, corners=loop.corners,
                       breaks=loop.vertex_us, **kw)


def plane_surface(origin, normal, up=UP):
    """S(u, v) on a flat wall: u runs across from `origin` (to the right
    seen from outside), v up."""
    m = frame_at(origin, normal, up)
    ex = Vector((m[0][0], m[1][0], m[2][0]))
    ey = Vector((m[0][1], m[1][1], m[2][1]))
    n = Vector((m[0][2], m[1][2], m[2][2]))
    o = Vector(origin)

    def S(u, v):
        return o + ex * u + ey * v, n
    return S


def polar_surface(S, uc, vc, radius):
    """Voussoirs: s along the arc (0 at the left springing, radians x
    radius), t outwards from the intrados, on a flat surface S."""
    def P(s, t):
        a = math.pi - s / radius
        r = radius + t
        return S(uc + r * math.cos(a), vc + r * math.sin(a))
    return P


def core_loop(g, loop, z0, z1, mat, step=0.3, top=False, bottom=False,
              inset=0.0):
    """The mortar core behind a loop's stones."""
    zs = [z0 + (z1 - z0) * i / max(1, math.ceil((z1 - z0) / step))
          for i in range(max(1, math.ceil((z1 - z0) / step)) + 1)]
    us = []
    for i, u in enumerate(loop.vertex_us):
        e = loop.cum[i + 1]
        k = max(1, math.ceil((e - u) / step))
        us += [u + (e - u) * j / k for j in range(k)]
    grid = []
    for z in zs:
        row = []
        for u in us:
            pt, n = loop.S(u, z)
            row.append(g.vert(pt - n * inset))
        grid.append(row)
    m = len(us)
    for r in range(len(zs) - 1):
        for i in range(m):
            j = (i + 1) % m
            q = [grid[r][i], grid[r][j], grid[r + 1][j], grid[r + 1][i]]
            u = us[i]
            _, n = loop.S(u + 0.001, zs[r])
            g.face(q, [(us[i] / 2, zs[r] / 2), (us[j] / 2, zs[r] / 2),
                       (us[j] / 2, zs[r + 1] / 2),
                       (us[i] / 2, zs[r + 1] / 2)], mat, n)
    for flag, row, sign in ((top, grid[-1], 1), (bottom, grid[0], -1)):
        if flag:
            g.face(row, [(v.co.x / 2, v.co.y / 2) for v in row], mat,
                   (0, 0, sign))


# ---------------------------------------------------------------- blocks

def block(g, f, size, mat, rnd, c=0.02, nx=1, skip=(), jit=0.0,
          band=None, uv="stone", grain=1.2, tile=1.0, squeeze=0.8):
    """A chamfered block. `f` maps local points of the box
    [-hx, hx] x [-hy, hy] x [-hz, hz] to world (a Matrix, or a function for
    bent blocks); nx splits it along x so it can bend. `skip` leaves out
    main faces ('+x', '-z', ...). UVs: "stone" (one tile course per block
    height), "wood" (one tile plank, grain along x) or "tile" (planar)."""
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    c = min(c, hx * 0.45, hy * 0.45, hz * 0.45)
    if isinstance(f, Matrix):
        M = f
        f = (lambda x, y, z, M=M: M @ Vector((x, y, z)))
    band = rnd.randrange(COURSES) if band is None else band
    plank = rnd.randrange(PLANKS)
    uoff, voff = rnd.random(), rnd.random()
    oct_ = [(hy, -hz + c), (hy, hz - c), (hy - c, hz), (-hy + c, hz),
            (-hy, hz - c), (-hy, -hz + c), (-hy + c, -hz), (hy - c, -hz)]
    labels = ["+y", "+y+z", "+z", "-y+z", "-y", "-y-z", "-z", "+y-z"]
    lnorm = [(0, 1, 0), (0, 1, 1), (0, 0, 1), (0, -1, 1), (0, -1, 0),
             (0, -1, -1), (0, 0, -1), (0, 1, -1)]
    xs = [-hx + c + (2 * hx - 2 * c) * i / nx for i in range(nx + 1)]
    jitter = {}

    def J(key):
        if not jit:
            return Vector((0, 0, 0))
        if key not in jitter:
            jitter[key] = Vector((rnd.uniform(-jit, jit),
                                  rnd.uniform(-jit, jit),
                                  rnd.uniform(-jit, jit)))
        return jitter[key]

    def W(x, y, z, key):
        return f(x, y, z) + J(key)

    def uvf(x, y, z, n):
        ax = max(range(3), key=lambda i: abs(n[i]) + (0.001 if i == 1 else 0))
        if uv == "wood":
            if ax == 0:
                return ((plank + 0.5 + y / (2 * hy) * 0.8) / PLANKS,
                        voff + z / grain)
            across = z / (2 * hz) if ax == 1 else y / (2 * hy)
            return ((plank + 0.5 + across * 0.8) / PLANKS, voff + x / grain)
        if uv == "tile":
            if ax == 0:
                return (y / tile, z / tile)
            if ax == 1:
                return (x / tile, z / tile)
            return (x / tile, y / tile)
        # One tile course over the block's height; the tile's scale along
        # the block and on its top never finer than a course of 0.2.
        k = 1 / max(2 * hz, 0.2) / COURSES
        if ax == 2:
            return (uoff + x * k * squeeze, voff + y * k)
        t = x if ax == 1 else y
        return (uoff + t * k * squeeze, (band + (z + hz) / (2 * hz)) /
                COURSES)

    def centre_out(loc, ln):
        a = f(*loc)
        b = f(loc[0] + ln[0] * 0.01, loc[1] + ln[1] * 0.01,
              loc[2] + ln[2] * 0.01)
        return b - a

    rings = []
    for i, x in enumerate(xs):
        rings.append([(g.vert(W(x, y, z, (i, k))), (x, y, z))
                      for k, (y, z) in enumerate(oct_)])
    tri = 0
    for i in range(nx):
        for k in range(8):
            if labels[k] in skip:
                continue
            k2 = (k + 1) % 8
            q = [rings[i][k], rings[i + 1][k], rings[i + 1][k2],
                 rings[i][k2]]
            ln = lnorm[k]
            loc = [sum(v[1][d] for v in q) / 4 for d in range(3)]
            g.face([v[0] for v in q], [uvf(*v[1], ln) for v in q], mat,
                   centre_out(loc, ln))
            tri += 2
    rect = [(hy - c, -hz + c), (hy - c, hz - c), (-hy + c, hz - c),
            (-hy + c, -hz + c)]
    link = [(0, 1, [0, 1]), (1, 2, [1]), (2, 3, [1, 2]), (3, 4, [2]),
            (4, 5, [2, 3]), (5, 6, [3]), (6, 7, [3, 0]), (7, 0, [0])]
    for end, x_end, ring_i, lab in ((0, -hx, 0, "-x"), (1, hx, nx, "+x")):
        rv = [(g.vert(W(x_end, y, z, ("e", end, k))), (x_end, y, z))
              for k, (y, z) in enumerate(rect)]
        ring = rings[ring_i]
        for a, b, rs in link:
            q = [ring[a], ring[b]] + [rv[r] for r in reversed(rs)]
            loc = [sum(v[1][d] for v in q) / len(q) for d in range(3)]
            ln = (-1 if end == 0 else 1, 0, 0)
            g.face([v[0] for v in q], [uvf(*v[1], ln) for v in q], mat,
                   centre_out(loc, (ln[0], lnorm[a][1] * 0.3,
                                    lnorm[a][2] * 0.3)))
            tri += len(q) - 2
        if lab not in skip:
            g.face([v[0] for v in rv], [uvf(*v[1], (1, 0, 0)) for v in rv],
                   mat, centre_out((x_end, 0, 0), (-1 if end == 0 else 1,
                                                   0, 0)))
            tri += 2
    return tri


def placed(center, rot=(0, 0, 0), scale=1.0):
    """A Matrix for block(): a location and xyz Euler angles."""
    from mathutils import Euler
    return (Matrix.Translation(Vector(center)) @
            Euler(rot, "XYZ").to_matrix().to_4x4() @
            Matrix.Diagonal((scale, scale, scale, 1)))


def ring_map(radius, a0, z0, centre=(0, 0)):
    """Bend a block round the z axis: local x runs along the circle of
    `radius` from angle a0, local y outwards, local z up from z0."""
    cx, cy = centre

    def f(x, y, z):
        a = a0 + x / radius
        r = radius + y
        return Vector((cx + r * math.cos(a), cy + r * math.sin(a), z0 + z))
    return f


# ---------------------------------------------------------------- slates

def slate_plane(g, eave_l, eave_r, top_r, top_l, rows, mat, rnd, out,
                lip=0.022, seg=0.28, mats=None):
    """A roof plane of slates in rows from the eave (eave_l -> eave_r) up to
    the top edge (top_l -> top_r; equal for a hip's triangle). Each row
    maps onto one row of the slate tile; its lower edge stands proud so the
    rows step like laid slates."""
    eave_l, eave_r = Vector(eave_l), Vector(eave_r)
    top_l, top_r = Vector(top_l), Vector(top_r)
    n = Vector(out).normalized()
    slope = ((top_l + top_r) / 2 - (eave_l + eave_r) / 2).length
    rh = slope / rows
    tile = rh * ROWS
    d = (eave_r - eave_l).normalized()
    down = ((eave_l + eave_r) / 2 - (top_l + top_r) / 2).normalized()
    tri = 0
    for k in range(rows):
        t0, t1 = k / rows, (k + 1) / rows
        l0, r0 = eave_l.lerp(top_l, t0), eave_r.lerp(top_r, t0)
        l1, r1 = eave_l.lerp(top_l, t1), eave_r.lerp(top_r, t1)
        width = max((r0 - l0).length, (r1 - l1).length)
        m = max(1, math.ceil(width / seg))
        band = rnd.randrange(ROWS)
        uoff = rnd.random()
        rm = pick(rnd, mats) if mats else mat
        lower, upper, butt, us_lo, us_up = [], [], [], [], []
        for i in range(m + 1):
            s = i / m
            pl, pu = l0.lerp(r0, s), l1.lerp(r1, s)
            jl = lip * rnd.uniform(0.75, 1.3) if 0 < i < m else lip
            lower.append(g.vert(pl + n * jl))
            butt.append(g.vert(pl - n * 0.002))
            upper.append(g.vert(pu + n * 0.002))
            us_lo.append(uoff + (pl - eave_l).dot(d) / tile)
            us_up.append(uoff + (pu - eave_l).dot(d) / tile)
        v0, v1 = band / ROWS, (band + 1) / ROWS
        for i in range(m):
            g.face([lower[i], lower[i + 1], upper[i + 1], upper[i]],
                   [(us_lo[i], v0), (us_lo[i + 1], v0), (us_up[i + 1], v1),
                    (us_up[i], v1)], rm, n)
            g.face([butt[i], butt[i + 1], lower[i + 1], lower[i]],
                   [(us_lo[i], v0 - 0.008), (us_lo[i + 1], v0 - 0.008),
                    (us_lo[i + 1], v0), (us_lo[i], v0)], rm,
                   n * 0.2 + down)
            tri += 4
    return tri


def ridge_caps(g, a, b, n1, n2, mat, rnd, width=0.07, lift=0.035, piece=0.17,
               lap=0.012):
    """Ridge or hip tiles from a to b over two roof planes (normals n1,
    n2): a row of little inverted-V caps, each lapping the next."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    d.normalize()
    n1, n2 = Vector(n1).normalized(), Vector(n2).normalized()
    up = (n1 + n2).normalized()
    s1 = d.cross(n1).normalized()
    s2 = d.cross(n2).normalized()
    if s1.dot(n2) > 0:
        s1 = -s1
    if s2.dot(n1) > 0:
        s2 = -s2
    k = max(1, round(L / piece))
    tri = 0
    for i in range(k):
        p0 = a + d * (L * i / k)
        p1 = a + d * min(L, L * (i + 1) / k + lap)
        h0 = lift * 1.25
        h1 = lift
        top0, top1 = p0 + up * h0, p1 + up * h1
        w0 = [top0 + s1 * width + n1 * (-0.01), top0,
              top0 + s2 * width + n2 * (-0.01)]
        w1 = [top1 + s1 * width + n1 * (-0.01), top1,
              top1 + s2 * width + n2 * (-0.01)]
        v0 = [g.vert(p) for p in w0]
        v1 = [g.vert(p) for p in w1]
        uv0 = [(0, i * 0.2), (0.1, i * 0.2), (0.2, i * 0.2)]
        uv1 = [(0, i * 0.2 + 0.2), (0.1, i * 0.2 + 0.2), (0.2, i * 0.2 + 0.2)]
        g.face([v0[0], v0[1], v1[1], v1[0]], [uv0[0], uv0[1], uv1[1],
                                              uv1[0]], mat, n1 + up)
        g.face([v0[1], v0[2], v1[2], v1[1]], [uv0[1], uv0[2], uv1[2],
                                              uv1[1]], mat, n2 + up)
        # the butt end facing down the ridge
        base0 = [g.vert(p0 + s1 * width * 0.9 + n1 * -0.01),
                 g.vert(p0 + up * (h0 * 0.2)),
                 g.vert(p0 + s2 * width * 0.9 + n2 * -0.01)]
        g.face([base0[0], base0[1], v0[1], v0[0]],
               [(0, 0), (0.1, 0), (0.1, 0.05), (0, 0.05)], mat, -d)
        g.face([base0[1], base0[2], v0[2], v0[1]],
               [(0.1, 0), (0.2, 0), (0.2, 0.05), (0.1, 0.05)], mat, -d)
        tri += 8
    return tri


# ---------------------------------------------------------------- cloth

def cloth_sheet(g, frame, width, length, rnd, mat="cloth:team",
                trim="cloth:tower-gold", point=0.25, cols=8, rows=12,
                sway=0.018, lean=0.03, emblem=None, border=0.045,
                double=False, torn=None, tile=0.32, fold=None):
    """A hanging banner in `frame` (x across, y up, z out of the wall),
    hung from its top edge at the origin: a V-pointed bottom, soft folds,
    a woven border and an emblem polygon list in (x, y) banner units (y
    down from the top). `torn(x, y)` may cut ragged holes (rubble)."""
    fold = fold or (lambda x, y: 0.0)
    ph = rnd.uniform(0, math.tau)

    def depth(x, y):
        t = y / length
        return (sway * math.sin(x / width * math.tau * 1.6 + ph) *
                (0.25 + 0.75 * t) + lean * t * t + fold(x, y))

    def bottom(x):
        return length - point * (1 - abs(2 * x / width))

    def P(x, y, off=0.0):
        return frame @ Vector((x, -y, depth(x, y) + off))

    def uvp(x, y):
        return (x / tile, -y / tile)

    grid = []
    for j in range(rows + 1):
        row = []
        for i in range(cols + 1):
            x = -width / 2 + width * i / cols
            y = bottom(x) * j / rows
            row.append((x, y))
        grid.append(row)
    fwd = Vector((frame[0][2], frame[1][2], frame[2][2]))
    sides = [(0.0, fwd)]
    if double:
        sides = [(0.004, fwd), (-0.004, -fwd)]
    tri = 0
    for off, out in sides:
        vs = [[g.vert(P(x, y, off)) for x, y in row] for row in grid]
        for j in range(rows):
            for i in range(cols):
                cx = (grid[j][i][0] + grid[j][i + 1][0]) / 2
                cy = (grid[j][i][1] + grid[j + 1][i][1]) / 2
                if torn and torn(cx, cy):
                    continue
                q = [vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]]
                uvs = [uvp(*grid[j][i]), uvp(*grid[j][i + 1]),
                       uvp(*grid[j + 1][i + 1]), uvp(*grid[j + 1][i])]
                g.face(q, uvs, mat, out)
                tri += 2
        # border along both sides and the pointed bottom
        edge = [grid[j][0] for j in range(rows + 1)]
        edge += [grid[rows][i] for i in range(1, cols)]
        edge += [grid[j][cols] for j in range(rows, -1, -1)]
        if border and trim:
            o2 = off + (0.003 if off >= 0 else -0.003)
            for (x0, y0), (x1, y1) in zip(edge, edge[1:]):
                if torn and torn((x0 + x1) / 2, (y0 + y1) / 2):
                    continue
                d = Vector((x1 - x0, y1 - y0))
                if d.length < 1e-6:
                    continue
                nrm = Vector((d.y, -d.x)).normalized()
                # inward is towards the banner's centre line
                mid = Vector(((x0 + x1) / 2, (y0 + y1) / 2))
                if (Vector((0, length * 0.45)) - mid).dot(nrm) < 0:
                    nrm = -nrm
                a0 = Vector((x0, y0)) + nrm * border
                a1 = Vector((x1, y1)) + nrm * border
                q = [g.vert(P(x0, y0, o2)), g.vert(P(x1, y1, o2)),
                     g.vert(P(a1.x, a1.y, o2)), g.vert(P(a0.x, a0.y, o2))]
                g.face(q, [uvp(x0, y0), uvp(x1, y1), uvp(a1.x, a1.y),
                           uvp(a0.x, a0.y)], trim, out)
                tri += 2
        if emblem and trim:
            o3 = off + (0.004 if off >= 0 else -0.004)
            for shape in emblem:
                q = [g.vert(P(x, y, o3)) for x, y in shape]
                g.face(q, [uvp(x, y) for x, y in shape], trim, out)
                tri += len(shape) - 2
    return tri


def crown_shape(cx, cy, s):
    """A crown (a band and three points), y down."""
    pts = [(-0.5, 0.32), (0.5, 0.32), (0.56, -0.26), (0.26, 0.02),
           (0.0, -0.4), (-0.26, 0.02), (-0.56, -0.26)]
    return [[(cx + x * s, cy + y * s) for x, y in pts]]


def star_shape(cx, cy, r, points=6, inner=0.45, turn=0.0):
    pts = []
    for i in range(points * 2):
        a = turn - math.pi / 2 + math.pi * i / points
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return [pts]


def lozenge(cx, cy, w, h):
    return [[(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2),
             (cx - w / 2, cy)]]


# ---------------------------------------------------------------- moss

def moss(g, at, normal, radius, height, rnd, mat="rock:tower-moss", k=7,
         squash=1.0, along=None):
    """A low cushion of moss on a surface: a lumpy dome of k sides."""
    at, n = Vector(at), Vector(normal).normalized()
    t1 = n.orthogonal().normalized()
    if along is not None:
        t1 = (Vector(along) - n * Vector(along).dot(n)).normalized()
    t2 = n.cross(t1)
    rim, mid = [], []
    ph = rnd.uniform(0, math.tau)
    for i in range(k):
        a = ph + math.tau * i / k
        r = radius * rnd.uniform(0.7, 1.15)
        d = t1 * math.cos(a) * r + t2 * math.sin(a) * r * squash
        rim.append(g.vert(at + d - n * 0.008))
        mid.append(g.vert(at + d * 0.62 + n * height * rnd.uniform(0.6, 1.0)))
    top = g.vert(at + n * height * rnd.uniform(1.0, 1.25))
    uv = lambda v: ((v.co - at).dot(t1) / 0.8, (v.co - at).dot(t2) / 0.8)
    tri = 0
    for i in range(k):
        j = (i + 1) % k
        q = [rim[i], rim[j], mid[j], mid[i]]
        g.face(q, [uv(v) for v in q], mat,
               ((rim[i].co + rim[j].co) / 2 - at).normalized() + n * 0.5)
        q = [mid[i], mid[j], top]
        g.face(q, [uv(v) for v in q], mat, n)
        tri += 3
    return tri


def moss_strip(g, x0, x1, zf, yf, width, rnd, mat="rock:tower-moss",
               height=0.03, seg=0.08, ends=None, axis="x"):
    """A ribbon of moss along x (or y) from x0 to x1: its centre line at
    height zf(x) and offset yf(x) across, `width(x)` wide, lumpy on top with
    ragged edges tucked down. `ends` fixes the width at both ends so runs
    laid end to end continue."""
    n = max(2, int(abs(x1 - x0) / seg))
    rows = []
    ph = rnd.uniform(0, 100)
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        w = width(x)
        if ends is not None and i in (0, n):
            w = ends
        h = height * (0.55 + 0.45 * noise.noise(Vector((x * 9 + ph, 0.3,
                                                         0.7))))
        rag = [0.75 + 0.25 * noise.noise(Vector((x * 14 + ph, s_, 1.9)))
               for s_ in (0.1, 5.3)]
        z, y = zf(x), yf(x)
        pts = [(y - w * rag[0], z - 0.012), (y - w * 0.45, z + h * 0.7),
               (y + w * 0.1, z + h), (y + w * rag[1], z - 0.012)]
        if axis == "x":
            rows.append([g.vert((x, py, pz)) for py, pz in pts])
        else:
            rows.append([g.vert((py, x, pz)) for py, pz in pts])
    tri = 0
    for i in range(n):
        for j in range(3):
            q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1],
                 rows[i][j + 1]]
            g.face(q, [(v.co.x / 0.6, v.co.y / 0.6) for v in q], mat,
                   (0, 0, 1))
            tri += 2
    return tri


# ---------------------------------------------------------------- misc

def deck_top(y):
    """The bridges' walking surface (the game's standHeight before the
    0.3 drop)."""
    t = y / 1.95
    return 0.42 + 0.28 * (1 - t * t)


def deck_slope(y):
    return -2 * 0.28 * y / (1.95 * 1.95)


def river_ground(ay):
    """The terrain's river channel (components/game/arena/terrain.ts,
    groundHeight) at |z| = ay, in world metres."""
    t = max(0.0, min(1.0, (ay - 0.78) / (1.42 - 0.78)))
    return -0.72 * (1 - t * t * (3 - 2 * t))


def lumpy(p, scale=3.0, amount=0.05, seed=0.0):
    return amount * noise.noise(Vector(p) * scale + Vector((seed, 0, 0)))
