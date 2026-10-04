"""Helpers for Rota's mill-town works (works.py).

Lean pieces on top of building_kit: windows that cost a handful of
triangles (a mill front holds sixty of them), plain hipped and sawtooth
roofs, stone arch rings and tunnel bores, heightfield ground masses, and
the preview stage shared with buildings.py (copied here: buildings.py runs
its own build when imported).

Conventions as everywhere in Rota: one grid square is one metre (25 m),
z = 0 is the ground, fronts face -Y. See
docs/concepts/2026-10-03-rota-mill-town/brief.md.
"""

import math
import os

import bmesh
import bpy
from mathutils import Vector, noise

import rkit
import building_kit as K
from building_kit import (box, gbox, cyl, beam, prism_xz, pane, mesh,
                          outline, tf, T, rot)

kit = rkit.kit
Z = Vector((0, 0, 1))


# ---------------------------------------------------------------- walls

def win(B, wall, u, z0, w, h, arch=None, recess=0.0045, glass="glass:dark",
        bars=None, frame=None, n=6, sill=None, flush=False):
    """A cheap window: a carved reveal with glass at its back (or, flush,
    a glazed pane just proud of the wall, for backs and ends) and, if
    asked, glazing bars as flat strips ("cross", "mullion", "transom",
    "grid")."""
    pts = [(x + u, z0 + z) for x, z in outline(w, h, arch, n)]
    if flush:
        B.add(wall.put(pane("glass", pts, -0.0007, glass)))
        recess = 0.0
        yb = -0.0013
    else:
        B.cut(wall.put(cutter(pts, -0.02, recess, glass)))
        yb = recess - 0.0008
    bt = 0.0018
    top = z0 + h - (w * 0.18 if arch == "segment" else 0) - \
        (w / 2 if arch == "round" else 0)
    strips = []
    if bars in ("cross", "mullion", "grid"):
        strips.append((u - bt / 2, z0, u + bt / 2, z0 + h - 0.0005))
    if bars in ("cross", "transom"):
        zc = top if arch == "round" else z0 + h * 0.5
        strips.append((u - w / 2, zc - bt / 2, u + w / 2, zc + bt / 2))
    if bars == "grid":
        for f in (1 / 3, 2 / 3):
            zc = z0 + (top - z0) * f
            strips.append((u - w / 2, zc - bt / 2, u + w / 2, zc + bt / 2))
    for x0, za, x1, zb in strips:
        B.add(wall.put(pane("bar", [(x1, za), (x1, zb), (x0, zb), (x0, za)],
                            yb, frame or "paint:frame")))
    if sill:
        B.add(wall.put(box("sill", (w + 0.006, 0.006, 0.0035),
                           (u, -0.0015, z0 - 0.0015), sill)))


BODY = "plain:__body"


def cutter(pts, y0, y1, back=None):
    """A recess cutter whose faces carry materials onto the carved body
    (see carve): its back cap becomes the recess's back face in `back`
    (glass, a door leaf), its sides the body's own material."""
    o = prism_xz("cut", pts, y0, y1, None)
    me = o.data
    me.materials.append(kit.material(BODY))
    if back:
        me.materials.append(kit.material(back))
        for p in me.polygons:
            if p.normal.y > 0.9 and abs(p.center.y - y1) < 1e-5:
                p.material_index = 1
    return o


def carve(B):
    """Carve B's bodies with material transfer: recess backs take the
    cutters' back material, everything else the body's first material."""
    for c in B.cutters:
        if not len(c.data.materials):
            c.data.materials.append(kit.material(BODY))
    B.transfer = True
    B.carve()
    for b in B.bodies:
        me = b.data
        names = [m.name if m else None for m in me.materials]
        if BODY not in names:
            continue
        k = names.index(BODY)
        for p in me.polygons:
            if p.material_index == k:
                p.material_index = 0
        for p in me.polygons:
            if p.material_index > k:
                p.material_index -= 1
        me.materials.pop(index=k)


def opening(B, wall, u, w, h, arch=None, depth=0.03, back="plain:void",
            n=8, z0=0.0):
    """A deep open doorway (an engine shed's road, a cart arch): carved
    right through the wall face, dark at the back."""
    pts = [(x + u, z0 + z) for x, z in outline(w, h, arch, n)]
    cpts = [(x, z - 0.004) if z <= z0 + 1e-6 else (x, z) for x, z in pts]
    B.cut(wall.put(prism_xz("cut", cpts, -0.02, depth, None)))
    B.add(wall.put(pane("void", pts, depth - 0.001, back)))


def arch_ring(B, wall, u, w, h, arch, t, mat, proud=0.003, n=8, z0=0.0):
    """A dressed ring round an opening (voussoirs as one band)."""
    inner = [(x + u, z0 + z) for x, z in outline(w, h, arch, n)]
    outer = [(x + u, z0 + z) for x, z in K.offset_outline(w, h, arch, t, n)]
    B.add(wall.put(K.band("ring", inner, outer, -proud, 0.002, mat)))


def plank_door(B, wall, u, w, h, leaf, frame=None, recess=0.004, z0=0.0,
               braces=True, arch=None, n=6):
    """A boarded loading or cart door: a recessed leaf with a Z brace."""
    pts = [(x + u, z0 + z) for x, z in outline(w, h, arch, n)]
    cpts = [(x, z - 0.004) if z <= z0 + 1e-6 else (x, z) for x, z in pts]
    B.cut(wall.put(prism_xz("cut", cpts, -0.02, recess, None)))
    B.add(wall.put(pane("leaf", pts, recess - 0.0005, leaf)))
    if braces:
        hh = h - (w * 0.18 if arch == "segment" else 0)
        y = recess - 0.0016
        for zz in (z0 + hh * 0.18, z0 + hh * 0.82):
            B.add(wall.put(pane("ledge", [(u + w / 2 - 0.002, zz - 0.0015),
                                          (u + w / 2 - 0.002, zz + 0.0015),
                                          (u - w / 2 + 0.002, zz + 0.0015),
                                          (u - w / 2 + 0.002, zz - 0.0015)],
                                y, leaf)))
        B.add(wall.put(beam("brace", (u - w / 2 + 0.003, recess - 0.0022,
                                      z0 + hh * 0.2),
                            (u + w / 2 - 0.003, recess - 0.0022,
                             z0 + hh * 0.8), (0.0024, 0.001), leaf,
                            up=Vector((0, -1, 0)))))
    if w > 0.04:
        B.add(wall.put(pane("split", [(u + 0.0008, z0), (u + 0.0008, z0 + h
                                                          - 0.002),
                                      (u - 0.0008, z0 + h - 0.002),
                                      (u - 0.0008, z0)], recess - 0.0018,
                            frame or "wood:timber")))


def flat_box(B, wall, u, z, w, h, mat, proud=0.002):
    """A slab proud of a wall (a sign, a name band)."""
    B.add(wall.put(box("slab", (w, proud, h), (u, -proud / 2, z), mat)))


# ---------------------------------------------------------------- roofs

def roof(B, cx, cy, w, d, hw, rise, mat, ridge="x", over=0.008,
         over_gable=0.006, thick=0.006, ridge_mat=None, gutter=None):
    """building_kit.gable_roof with a coarse AO grid (fewer triangles)."""
    return K.gable_roof(B, cx, cy, w, d, hw, rise, mat, ridge=ridge,
                        over=over, over_gable=over_gable, thick=thick,
                        ridge_mat=ridge_mat, gutter=gutter, edge=0.16)


def hip(B, cx, cy, w, d, hw, rise, mat, over=0.008, thick=0.006,
        ridge_mat=None):
    """A lean hipped roof (ridge along the longer side)."""
    along_x = w >= d
    if not along_x:
        w, d = d, w
    hx, hd = w / 2 + over, d / 2 + over
    a = math.atan2(rise, d / 2)
    ze = hw - over * math.tan(a)
    rz = hw + rise
    rl = max(0.0, w / 2 - d / 2)
    v = [(-hx, -hd, ze), (hx, -hd, ze), (hx, hd, ze), (-hx, hd, ze),
         (-rl, 0, rz), (rl, 0, rz)]
    faces = [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]]
    if rl < 1e-6:
        v = v[:5]
        faces = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
    o = mesh("hip", v, faces, mat)
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = 1
    kit.apply(o)
    if not along_x:
        tf(o, rot("Z", 90))
    tf(o, T(cx, cy))
    B.add(o)
    if ridge_mat and rl > 0:
        rc = cyl("ridge", 0.0035, 0.0035, 2 * rl + 0.004, (0, 0, 0), 6,
                 ridge_mat, axis="x", rings=1)
        tf(rc, T(0, 0, rz + thick - 0.0008))
        if not along_x:
            tf(rc, rot("Z", 90))
        tf(rc, T(cx, cy))
        B.add(rc)
    return ze


def sawtooth(B, x0, x1, y0, y1, hw, rise, teeth, slate, glass, frame,
             thick=0.005, over=0.006):
    """A north-light roof whose ridges run along Y: each tooth a slate
    slope rising from west to east and a glazed upright face to the east.
    Returns the gable profile (x, z) points for the end walls."""
    tw = (x1 - x0) / teeth
    L = (y1 - y0) + 2 * over
    yc = (y0 + y1) / 2
    prof = []
    for i in range(teeth):
        xa, xb = x0 + i * tw, x0 + (i + 1) * tw
        prof += [(xa, hw), (xb, hw + rise)]
        if i < teeth - 1:
            prof.append((xb, hw))
        # The slate slope with thickness.
        s = math.hypot(tw, rise)
        a = math.degrees(math.atan2(rise, tw))
        sl = box("saw", (s + 0.004, L, thick), (0, 0, 0), slate)
        tf(sl, T((xa + xb) / 2, yc, hw + rise / 2 + thick / 2) @ rot("Y", -a))
        B.add(sl)
        # The glazed upright, set a little back under the ridge.
        gx = xb - 0.0015
        B.add(K.pane("north", [(-L / 2 + over, hw), (L / 2 - over, hw),
                               (L / 2 - over, hw + rise - 0.002),
                               (-L / 2 + over, hw + rise - 0.002)], 0,
                     glass))
        tf(B.parts[-1][0], T(gx, yc) @ rot("Z", 90))
        # Glazing bars on it and a ridge capping.
        for k in range(1, 6):
            yy = y0 + (y1 - y0) * k / 6
            B.add(box("nbar", (0.0016, 0.0016, rise - 0.003),
                      (gx + 0.0008, yy, hw + (rise - 0.003) / 2), frame))
        B.add(box("ncap", (0.006, L, 0.004), (xb - 0.001, yc,
                                              hw + rise + 0.001), slate))
        # Valley gutter.
        if i < teeth - 1:
            B.add(box("valley", (0.006, L, 0.003), (xb + 0.002, yc,
                                                    hw + 0.002), "metal:zinc"))
    return prof


# ---------------------------------------------------------------- stone

def portal_face(B, cx, y, half, spring, rise, face_w, top, depth, mat,
                dress, n=12, flip=False, ring=0.026, key=True,
                parapet=True, pilasters=True):
    """A dressed portal face at y, its opening an elliptical arch (half
    width, spring and rise). flip faces it +Y. Wall body carved by the
    Build's cutters; returns the arch outline (x, z) for the bore."""
    s = 1 if not flip else -1
    pts = arch_pts(cx, half, spring, rise, n)
    body = gbox("pface", (face_w, depth, top + 0.003),
                (cx, y + s * depth / 2, top / 2 - 0.0015), mat, edge=0,
                grid=False, bevel=0.0012)
    B.body(body)
    # Voussoirs as alternating blocks, keystone proud.
    for i in range(n):
        t0 = math.pi * (i + 0.05) / n
        t1 = math.pi * (i + 0.95) / n
        mid = (t0 + t1) / 2
        kk = key and abs(mid - math.pi / 2) < math.pi / n * 0.6
        ow = ring + (0.01 if kk else (0.004 if i % 2 else 0.0))
        quad = [(cx + math.cos(t0) * half, spring + math.sin(t0) * rise),
                (cx + math.cos(t0) * (half + ow),
                 spring + math.sin(t0) * (rise + ow)),
                (cx + math.cos(t1) * (half + ow),
                 spring + math.sin(t1) * (rise + ow)),
                (cx + math.cos(t1) * half, spring + math.sin(t1) * rise)]
        p = prism_xz("vouss", quad, -0.004 - (0.004 if kk else 0.0), 0.004,
                     dress)
        if flip:
            tf(p, T(0, 0, 0) @ _mirror_y())
        tf(p, T(0, y))
        B.add(p)
    for k in (-1, 1):
        im = box("impost", (0.03, 0.008, 0.01),
                 (cx + k * (half + 0.012), y - s * 0.002, spring - 0.004),
                 dress)
        B.add(im)
        if pilasters:
            B.add(gbox("pilaster", (0.024, 0.008, top - 0.01),
                       (cx + k * (face_w / 2 - 0.016), y - s * 0.003,
                        (top - 0.01) / 2 - 0.002), dress, edge=0.2))
    if parapet:
        B.add(gbox("string", (face_w + 0.012, 0.012, 0.008),
                   (cx, y - s * 0.002, top - 0.004), dress, edge=0.2))
        B.add(gbox("parapet", (face_w, 0.016, 0.022),
                   (cx, y + s * 0.008, top + 0.011), mat, edge=0.2))
        B.add(gbox("coping", (face_w + 0.006, 0.022, 0.006),
                   (cx, y + s * 0.008, top + 0.024), dress, edge=0.2))
    return pts


def _mirror_y():
    from mathutils import Matrix
    m = Matrix.Identity(4)
    m[1][1] = -1
    return m


def arch_pts(cx, half, spring, rise, n=12, z0=-0.01):
    """An elliptical-arched opening's outline (x, z), from bottom right."""
    pts = [(cx + half, z0), (cx + half, spring)]
    for i in range(1, n):
        t = math.pi * i / n
        pts.append((cx + math.cos(t) * half, spring + math.sin(t) * rise))
    return pts + [(cx - half, spring), (cx - half, z0)]


def bore(B, cx, half, spring, rise, y0, y1, lining, t=0.02, n=12,
         cut_t=0.0, cut_from=None, cut_to=None):
    """Cut a bore through every body (cut_from..cut_to, default y0..y1)
    and line it from y0 to y1 with a stone barrel (walls and vault) t
    thick."""
    ca = y0 if cut_from is None else cut_from
    cb = y1 if cut_to is None else cut_to
    B.cut(prism_xz("bore", arch_pts(cx, half + cut_t, spring,
                                    rise + cut_t, n, -0.02), ca, cb, None))
    inner = arch_pts(cx, half, spring, rise, n, -0.002)
    outer = arch_pts(cx, half + t, spring, rise + t, n, -0.002)
    o = K.band("lining", inner, outer, y0, y1, lining)
    B.add(o)
    return o


# ---------------------------------------------------------------- ground

def heightfield(name, x0, x1, y0, y1, nx, ny, h, base=-0.004, mat=None,
                side_mat=None):
    """A closed solid whose top follows h(x, y) over a grid, with upright
    sides down to `base` and a flat bottom. Returns the object; its top
    faces carry `mat`, its sides `side_mat`."""
    bm = bmesh.new()
    top = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            row.append(bm.verts.new((x, y, max(base + 0.001, h(x, y)))))
        top.append(row)
    bot = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            on_edge = i in (0, nx) or j in (0, ny)
            row.append(bm.verts.new((top[j][i].co.x, top[j][i].co.y, base))
                       if on_edge else None)
        bot.append(row)
    faces_top = []
    for j in range(ny):
        for i in range(nx):
            a, b_, c, d = top[j][i], top[j][i + 1], top[j + 1][i + 1], \
                top[j + 1][i]
            # Split each quad along its shorter diagonal.
            if (a.co - c.co).length < (b_.co - d.co).length:
                faces_top += [bm.faces.new((a, b_, c)), bm.faces.new((a, c, d))]
            else:
                faces_top += [bm.faces.new((a, b_, d)),
                              bm.faces.new((b_, c, d))]
    ring_t, ring_b = [], []
    for i in range(nx):
        ring_t.append(top[0][i]), ring_b.append(bot[0][i])
    for j in range(ny):
        ring_t.append(top[j][nx]), ring_b.append(bot[j][nx])
    for i in range(nx, 0, -1):
        ring_t.append(top[ny][i]), ring_b.append(bot[ny][i])
    for j in range(ny, 0, -1):
        ring_t.append(top[j][0]), ring_b.append(bot[j][0])
    side = []
    m = len(ring_t)
    for k in range(m):
        k2 = (k + 1) % m
        side.append(bm.faces.new((ring_t[k], ring_b[k], ring_b[k2],
                                  ring_t[k2])))
    bottom = bm.faces.new(list(reversed(ring_b)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    me.materials.append(kit.material(mat))
    if side_mat and side_mat != mat:
        me.materials.append(kit.material(side_mat))
        nt = len(faces_top)
        for p in me.polygons[nt:]:
            p.material_index = 1
    return obj


def paint(obj, rule):
    """Repaint each face with rule(centre, normal) -> material name (or
    None to keep)."""
    me = obj.data
    names = [m.name for m in me.materials]
    for p in me.polygons:
        m = rule(Vector(p.center), Vector(p.normal))
        if m is None:
            continue
        if m not in names:
            me.materials.append(kit.material(m))
            names.append(m)
        p.material_index = names.index(m)
    me.update()


def fbm(x, y, seed=0.0, oct=3):
    v, a, f, tot = 0.0, 1.0, 1.0, 0.0
    for _ in range(oct):
        v += a * noise.noise(Vector((x * f + seed, y * f - seed, seed * 0.3)))
        tot += a
        a *= 0.5
        f *= 2.03
    return v / tot


def slab(B, size, at, yaw, mat, seed, tilt=(0.0, 0.0), cuts=6, bevel=0.0):
    """A flat-topped gritstone slab: a fractured block (forest kit), its
    top kept level, set at `at` (centre of its base)."""
    import forest_kit as fk
    bm = fk.fracture(size, seed, cuts=cuts, lo=0.7, hi=0.92, flat_top=1.0,
                     bevel=bevel, max_edge=0.2, wobble=0.012)
    # Merge the near-duplicate vertices fracture leaves at this scale.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0015)
    fk.place(bm, fk.block_matrix((at[0], at[1], at[2] + size[2] / 2), yaw,
                                 tilt))
    me = bpy.data.meshes.new("slab")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("slab", me)
    bpy.context.scene.collection.objects.link(o)
    kit.assign(o, mat)
    B.add(o)
    return o


# ---------------------------------------------------------------- report

def tris(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bounds(r):
    kit.refresh()
    pts = []
    for o in kit.descendants(r):
        if o.type == "MESH":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts),
                 min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts),
                 max(p.z for p in pts)))
    return lo, hi


def report(roots):
    kit.refresh()
    total = 0
    for r in roots:
        lo, hi = bounds(r)
        lo -= r.location
        hi -= r.location
        n = sum(tris(o) for o in kit.descendants(r) if o.type == "MESH")
        total += n
        size = hi - lo
        print("ROOT %-16s size %.3f x %.3f x %.3f  x %+.3f..%+.3f  "
              "y %+.3f..%+.3f  z %+.4f..%.3f  tris %5d" % (
                  r.name, size.x, size.y, size.z, lo.x, hi.x, lo.y, hi.y,
                  lo.z, hi.z, n))
    print("TOTAL tris", total)
    used = set()
    for r in roots:
        for o in kit.descendants(r):
            if o.type == "MESH":
                used |= {m.name for m in o.data.materials if m}
    print("MATERIALS", len(used), ", ".join(sorted(used)))


def bore_check(r, half, spring, rise, y0, y1, label):
    """Fire rays along +Y through a bore's opening (inset 6 mm) from y0
    and report the nearest hit: an open bore is clear to y1."""
    from mathutils.bvhtree import BVHTree
    kit.refresh()
    dg = bpy.context.evaluated_depsgraph_get()
    worst = None
    blocked = 0
    n = 0
    for o in kit.descendants(r):
        if o.type != "MESH":
            continue
        tree = BVHTree.FromObject(o, dg)
        inv = o.matrix_world.inverted()
        for i in range(-6, 7):
            x = (half - 0.006) * i / 6
            ztop = spring + rise * math.sqrt(max(0.0, 1 - (x / half) ** 2))
            for j in range(1, 8):
                z = 0.004 + (ztop - 0.01) * j / 7
                p = r.matrix_world @ Vector((x, y0, z))
                hit = tree.ray_cast(inv @ p, Vector((0, 1, 0)),
                                    y1 - y0)
                n += 1
                if hit[0] is not None:
                    hy = (o.matrix_world @ hit[0]).y - r.matrix_world[1][3]
                    blocked += 1
                    if worst is None or hy < worst[0]:
                        worst = (hy, round(x, 3), round(z, 3))
    print("BORE %s %s: %d of %d rays blocked before y=%.3f%s" % (
        r.name, label, blocked, n, y1,
        "" if worst is None else ", first at y=%.3f (x %.3f, z %.3f)" %
        worst))


# ---------------------------------------------------------------- stage

def stage():
    scene = bpy.context.scene
    kit.gpu()
    scene.cycles.use_denoising = True
    scene.render.film_transparent = False
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    world = bpy.data.worlds.new("rota-preview")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.66, 0.82, 1)
    bg.inputs[1].default_value = 0.55
    sun = bpy.data.lights.new("rsun", "SUN")
    sun.energy = 4.2
    sun.angle = math.radians(3)
    sun.color = (1.0, 0.86, 0.68)
    s = bpy.data.objects.new("rsun", sun)
    s.rotation_euler = Vector((-0.55, -0.75, 0.62)).to_track_quat(
        "Z", "Y").to_euler()
    scene.collection.objects.link(s)
    kit.tint("__ground", "#8a8476")
    kit.tint("__square", "#a59e8c")
    kit.tint("__edge", "#e9e2cc")
    kit.tint("__car", "#c43a2f")
    floor = kit.box("__floor", (80, 80, 0.02), (0, 0, -0.0115),
                    mat="plain:__ground", grid=False)
    kit.fill_ao([floor])
    return [s, floor]


def ref_square(at):
    sq = kit.box("__sq", (1.0, 1.0, 0.002), (at.x, at.y, -0.0005),
                 mat="plain:__square", grid=False)
    edges = []
    for k in (-1, 1):
        edges.append(kit.box("__e", (1.0, 0.008, 0.0025),
                             (at.x, at.y + k * 0.496, -0.0003),
                             mat="plain:__edge", grid=False))
        edges.append(kit.box("__e", (0.008, 1.0, 0.0025),
                             (at.x + k * 0.496, at.y, -0.0003),
                             mat="plain:__edge", grid=False))
    kit.fill_ao([sq] + edges)
    return [sq] + edges


def car_box(at):
    c = kit.box("__car", (0.16, 0.07, 0.06), (at.x, at.y, 0.03),
                mat="plain:__car", grid=False)
    kit.fill_ao([c])
    return c


def shot(path, centre, radius, elevation=55, azimuth=0, size=900, lens=80,
         samples=64, width=None):
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.render.resolution_x = width or size
    scene.render.resolution_y = size
    cam_data = bpy.data.cameras.new("pcam")
    cam_data.lens = lens
    cam_data.sensor_fit = "VERTICAL"
    cam = bpy.data.objects.new("pcam", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    dist = radius / math.tan(cam_data.angle_y / 2)
    cam.location = centre + Vector((math.sin(az) * math.cos(el) * -dist,
                                    -math.cos(az) * math.cos(el) * dist,
                                    math.sin(el) * dist))
    cam.rotation_euler = (centre - cam.location).to_track_quat(
        "-Z", "Y").to_euler()
    cam_data.clip_start = 0.01
    cam_data.clip_end = 200
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    print("PREVIEW", path)


def render_previews(path, roots, gap=2.2):
    """A line-up of every asset, then close-ups (elevation 55, azimuth 0
    and 30) of each beside a 1 m square and a car-sized box."""
    base = os.path.splitext(path)[0]
    K.preview_look()
    stage()
    x, y, row_h = 0.0, 0.0, 0.0
    for r in roots:
        lo, hi = bounds(r)
        wdt = hi.x - lo.x
        if x + wdt > 3.6 and x > 0:
            x, y = 0.0, y + row_h + 0.15
            row_h = 0.0
        r.location = Vector((x + wdt / 2 - (lo.x + hi.x) / 2 + r.location.x,
                             y - lo.y + r.location.y, 0))
        x += wdt + 0.12
        row_h = max(row_h, hi.y - lo.y)
    kit.refresh()
    lo = Vector((min(bounds(r)[0].x for r in roots),
                 min(bounds(r)[0].y for r in roots), 0))
    hi = Vector((max(bounds(r)[1].x for r in roots),
                 max(bounds(r)[1].y for r in roots), 0.1))
    centre = (lo + hi) / 2
    radius = max((hi.x - lo.x) / 3.2, (hi.y - lo.y) * 0.62) * 1.08
    if len(roots) > 1 and not os.environ.get("ROTA_NOLINEUP"):
        shot(path, centre, radius, 55, 0, size=1000, width=1600, lens=60,
             samples=32)
    if os.environ.get("ROTA_LINEUP_ONLY"):
        return
    for i, r in enumerate(roots):
        r.location = Vector(((i % 6) * gap, (i // 6) * gap, 0))
    kit.refresh()
    for r in roots:
        for o in roots:
            for d_ in kit.descendants(o):
                d_.hide_render = o is not r
        sq = ref_square(r.location)
        lo, hi = bounds(r)
        car = car_box(Vector((lo.x - 0.1, lo.y - 0.06, 0)))
        lo2 = Vector((min(lo.x, lo.x - 0.18), min(lo.y, lo.y - 0.1), 0))
        c = (lo2 + hi) / 2
        rad = max((hi - lo2).length * 0.58, 0.18)
        for az in (0, 30):
            shot("%s-%s-a%d.png" % (base, r.name, az), c, rad, 55, az,
                 size=600, samples=int(os.environ.get("ROTA_SAMPLES", 24)))
        bpy.data.objects.remove(car, do_unlink=True)
        for o in sq:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in roots:
        for d_ in kit.descendants(o):
            d_.hide_render = False
