"""Toy-block pieces for Arena's world models (see towers.py).

Every helper returns a plain mesh object built round its own origin, with
its edges rounded like a real wooden or moulded toy and UVs whose v runs
along the wood grain (the beech tile's grain is vertical in the image), so a
block can be placed and turned before it is joined. Blocks follow one set:
the 1.6 unit cube module and its halves and quarters.
"""

import math
import random

import bmesh
from mathutils import Vector

import kit

M, H, Q = 1.6, 0.8, 0.4
# Metres per repeat of the beech tile: one cube module.
GRAIN = 1.6


def _obj(name, bm, mat):
    return kit._from_bmesh(name, bm, mat)


def srgb(hex_colour):
    """Linear preview colour of an sRGB hex (no hex travels in the GLB)."""
    h = hex_colour.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
                 for v in c)


# ---------------------------------------------------------------- UVs

def uv_grain(obj, axis=2, seed=None, repeat=GRAIN):
    """Planar UVs per face with v along the grain `axis` (0 x, 1 y, 2 z) and
    a random offset per piece, so neighbouring blocks never share grain."""
    rnd = random.Random(seed if seed is not None else obj.name)
    du, dv = rnd.random(), rnd.random()
    me = obj.data
    kit._fresh_uvs(me)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        others = [i for i in range(3) if i != ax]
        if axis in others:
            vi = axis
            ui = others[0] if others[1] == axis else others[1]
        else:
            ui, vi = others
        s = 1 if n[ax] >= 0 else -1
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = (c[ui] * s / repeat + du, c[vi] / repeat + dv)
    bm.to_mesh(me)
    bm.free()
    return obj


def uv_round(obj, seed=None, repeat=GRAIN, cap=0.7):
    """Grain up the side of a turned piece, planar on its caps."""
    rnd = random.Random(seed if seed is not None else obj.name)
    du, dv = rnd.random(), rnd.random()
    me = obj.data
    kit._fresh_uvs(me)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        if abs(f.normal.z) > cap:
            for loop in f.loops:
                c = loop.vert.co
                loop[uv].uv = (c.x / repeat + du, c.y / repeat + dv)
            continue
        centre = f.calc_center_median()
        a0 = math.atan2(centre.y, centre.x)
        r = max(0.03, math.hypot(centre.x, centre.y))
        reps = max(1, round(math.tau * r / repeat))
        for loop in f.loops:
            c = loop.vert.co
            a = math.atan2(c.y, c.x)
            while a - a0 > math.pi:
                a -= math.tau
            while a - a0 < -math.pi:
                a += math.tau
            loop[uv].uv = (a / math.tau * reps + du, c.z / repeat + dv)
    bm.to_mesh(me)
    bm.free()
    return obj


# ---------------------------------------------------------------- pieces

def grid_box_bm(size, step=0.4):
    """A closed box with a vertex grid of about `step` on every face, so
    baked AO has somewhere to live, without over-cutting thin sides."""
    n = [max(1, math.ceil(s / step - 1e-6)) for s in size]
    bm = bmesh.new()
    cache = {}

    def vert(co):
        key = tuple(round(c, 6) for c in co)
        v = cache.get(key)
        if v is None:
            v = bm.verts.new(co)
            cache[key] = v
        return v

    for a in range(3):
        b, c = ((1, 2), (0, 2), (0, 1))[a]
        for sgn in (-1, 1):
            rows = []
            for i in range(n[b] + 1):
                row = []
                for j in range(n[c] + 1):
                    co = [0.0, 0.0, 0.0]
                    co[a] = sgn * size[a] / 2
                    co[b] = -size[b] / 2 + size[b] * i / n[b]
                    co[c] = -size[c] / 2 + size[c] * j / n[c]
                    row.append(vert(co))
                rows.append(row)
            for i in range(n[b]):
                for j in range(n[c]):
                    bm.faces.new((rows[i][j], rows[i + 1][j],
                                  rows[i + 1][j + 1], rows[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def block(name, size, at=(0, 0, 0), mat="beech:tower-beech", bevel=None,
          seg=3, rot=(0, 0, 0), grain=None, step=0.4, seed=None):
    """A rounded rectangular block centred on its origin."""
    obj = _obj(name, grid_box_bm(size, step), mat)
    if bevel is None:
        bevel = min(0.065, min(size) * 0.14)
    kit.add_bevel(obj, bevel, seg, angle=60)
    kit.apply(obj)
    if grain is None:
        big = max(size)
        grain = 2 if size[2] >= big * 0.99 else size.index(big)
    uv_grain(obj, grain, seed)
    obj.location = at
    obj.rotation_euler = rot
    return obj


def round_profile(r, h, e, seg=3, step=0.5, inner=0.55, top=True,
                  bottom=True):
    """Lathe profile of a turned piece with rounded rims: (radius, z)."""
    pts = []
    rings = inner if isinstance(inner, tuple) else (inner,)
    if bottom:
        pts += [(0.0, 0.0)] + [(r * f, 0.0) for f in rings]
        for i in range(seg + 1):
            a = -math.pi / 2 + math.pi / 2 * i / seg
            pts.append((r - e + e * math.cos(a), e + e * math.sin(a)))
    else:
        pts.append((r, 0.0))
    n = max(1, math.ceil((h - 2 * e) / step))
    for i in range(1, n):
        pts.append((r, e + (h - 2 * e) * i / n))
    if top:
        for i in range(seg + 1):
            a = math.pi / 2 * i / seg
            pts.append((r - e + e * math.cos(a), h - e + e * math.sin(a)))
        pts += [(r * f, h) for f in reversed(rings)] + [(0.0, h)]
    else:
        pts.append((r, h))
    return pts


def segments_for(r, lo=24, hi=64, chord=0.09):
    return int(min(hi, max(lo, math.ceil(math.tau * r / chord / 4) * 4)))


def drum(name, r, h, at=(0, 0, 0), mat="beech:tower-beech", e=None,
         segments=None, rot=(0, 0, 0), seed=None, seg=None):
    """A cylinder block standing on its base at its origin."""
    e = e if e is not None else min(0.06, h * 0.14, r * 0.25)
    seg = seg or (3 if r >= 0.8 else 2)
    # Wide caps get extra rings so contact shadows have vertices to sit on.
    inner = (0.3, 0.6, 0.84) if r >= 0.6 else (0.55,)
    obj = kit.lathe(name, round_profile(r, h, e, seg, inner=inner),
                    segments=segments or segments_for(r), mat=mat)
    uv_round(obj, seed)
    obj.location = at
    obj.rotation_euler = rot
    return obj


def ball(name, r, at=(0, 0, 0), mat="paint:team", segments=16):
    obj = kit.sphere(name, r, at, mat=mat, segments=segments,
                     rings=segments // 2)
    uv_round(obj)
    return obj


def cone(name, rb, h, at=(0, 0, 0), mat="plastic:team", segments=32,
         lip=0.1):
    """A moulded cone roof with a rounded base band and a soft tip."""
    pts = [(0.0, 0.0), (rb * 0.5, 0.0), (rb - 0.03, 0.0), (rb - 0.005, 0.012),
           (rb, 0.035), (rb, lip - 0.03), (rb - 0.008, lip - 0.008),
           (rb - 0.03, lip)]
    r0, z0 = rb - 0.055, lip + 0.012
    tip = 0.05
    n = 5
    for i in range(n + 1):
        t = i / n
        pts.append((r0 + (tip - r0) * t, z0 + (h - 0.035 - z0) * t))
    pts += [(tip * 0.55, h - 0.01), (0.0, h)]
    obj = kit.lathe(name, pts, segments=segments, mat=mat)
    uv_round(obj)
    obj.location = at
    return obj


def resample(pts, step, closed=True):
    """Insert points so no outline edge is longer than `step`."""
    out = []
    count = len(pts) if closed else len(pts) - 1
    for i in range(count):
        a = Vector(pts[i])
        b = Vector(pts[(i + 1) % len(pts)])
        n = max(1, math.ceil((b - a).length / step))
        for k in range(n):
            out.append(tuple(a + (b - a) * (k / n)))
    if not closed:
        out.append(tuple(pts[-1]))
    return out


def extrude(name, pts, depth, axis="y", mat=None, bevel=0.0, seg=3,
            step=0.3, grain=2, angle=60):
    """A flat outline (u, w) extruded `depth` across `axis`, centred on
    it: axis 'y' reads the outline as (x, z), axis 'x' as (y, z)."""
    pts = resample(pts, step)
    bm = bmesh.new()
    front, back = [], []
    for u, w in pts:
        if axis == "y":
            a, b = (u, -depth / 2, w), (u, depth / 2, w)
        else:
            a, b = (-depth / 2, u, w), (depth / 2, u, w)
        front.append(bm.verts.new(a))
        back.append(bm.verts.new(b))
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _obj(name, bm, mat)
    if bevel:
        kit.add_bevel(obj, bevel, seg, angle=angle)
        kit.apply(obj)
    uv_grain(obj, grain)
    return obj


def arch_outline(w, h, r, spring, arc=14):
    """U-shaped outline of an arch block: width w, height h, an opening of
    radius r whose round top springs at height `spring`."""
    pts = [(-w / 2, 0.0), (-r, 0.0)]
    for i in range(arc + 1):
        a = math.pi - math.pi * i / arc
        pts.append((r * math.cos(a), spring + r * math.sin(a)))
    pts += [(r, 0.0), (w / 2, 0.0), (w / 2, h), (-w / 2, h)]
    return pts


def opening_outline(r, spring, arc=14, inset=0.0):
    r -= inset
    pts = [(-r, 0.0), (r, 0.0)]
    for i in range(arc + 1):
        a = math.pi * i / arc
        pts.append((r * math.cos(a), spring + r * math.sin(a)))
    return pts[:2] + pts[2:]


def arch(name, w, d, h, r, spring, mat, bevel=0.06):
    """An arch block standing on its base, opening through y."""
    return extrude(name, arch_outline(w, h, r, spring), d, "y", mat,
                   bevel=bevel, grain=2)


# ---------------------------------------------------------------- sweeps

def sweep_y(name, ys, section, mat, cap=True):
    """Sweep a closed cross-section along y: section(y) returns the same
    number of (x, z) points for every y."""
    bm = bmesh.new()
    rings = []
    for y in ys:
        rings.append([bm.verts.new((x, y, z)) for x, z in section(y)])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if cap:
        ends = [f for f in bm.faces if len(f.verts) > 4]
        bmesh.ops.triangulate(bm, faces=ends, quad_method="BEAUTY",
                              ngon_method="BEAUTY")
    return _obj(name, bm, mat)


def strip_solid(name, cols, x0, x1, mat, rows=2):
    """A solid between x0 and x1 whose side outline is a strip of columns
    (y, z_bottom, z_top), like a bridge's arched side girder."""
    bm = bmesh.new()
    L, R = [], []
    for y, zb, zt in cols:
        L.append([bm.verts.new((x0, y, zb + (zt - zb) * j / rows))
                  for j in range(rows + 1)])
        R.append([bm.verts.new((x1, y, zb + (zt - zb) * j / rows))
                  for j in range(rows + 1)])
    for i in range(len(cols) - 1):
        for j in range(rows):
            bm.faces.new((L[i][j], L[i + 1][j], L[i + 1][j + 1], L[i][j + 1]))
            bm.faces.new((R[i][j], R[i][j + 1], R[i + 1][j + 1], R[i + 1][j]))
        bm.faces.new((L[i][rows], L[i + 1][rows], R[i + 1][rows], R[i][rows]))
        bm.faces.new((L[i][0], R[i][0], R[i + 1][0], L[i + 1][0]))
    for i in (0, len(cols) - 1):
        for j in range(rows):
            bm.faces.new((L[i][j], L[i][j + 1], R[i][j + 1], R[i][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat)


# ---------------------------------------------------------------- finishing

def rest(obj, z=0.0):
    """Drop (or lift) an object so its lowest point sits at height z."""
    kit.refresh()
    mw = obj.matrix_world
    lo = min((mw @ v.co).z for v in obj.data.vertices)
    obj.location.z += z - lo
    kit.refresh()
    return obj


def finish(obj, angle=40):
    """Smooth shading, sharp above `angle`, and face-weighted normals so
    flat faces stay flat and only the rounded edges shade round."""
    kit.shade(obj, angle)
    mod = obj.modifiers.new("weighted", "WEIGHTED_NORMAL")
    mod.mode = "FACE_AREA"
    mod.weight = 50
    mod.keep_sharp = True
    kit.apply(obj)
    return obj


def triangles(root):
    n = 0
    for o in kit.descendants(root):
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n
