"""Arena's world pieces for the Collector's Diorama, Medieval board
(docs/concepts/2026-09-26-arena-retheme/diorama.md): the stone keep with its
bronze cannon, the round watchtowers, their rubble, the stone arch bridge,
the timber bridge on stone footings, the river's stone embankments, the
dry-stone field wall and the Meteor's rock.

Blender axes: z up, +y is a tower's front (towards the river for the near
side; the far side's towers are turned round at runtime). One unit is one
tile. Masonry is modelled stone by stone (masonry.py) with UVs that line
each stone up with one course of the stone tile.

  Blender -b --factory-startup --python assets/arena/blender/towers.py -- out.glb [preview.png]

With a preview path it also renders close views beside it
(<preview>-game.png, -near.png, -king.png, -king-front.png, -princess.png,
-princess-front.png, -rubble.png, -bridges.png, -bridge.png, -bridge-b.png,
-wall.png, -meteor.png).
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import masonry as M  # noqa: E402
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

kit.reset(seed=11)

# ---------------------------------------------------------------- surfaces
# Tints multiply the diorama tiles (stone, slate, wood, rock, cloth, metal),
# so they stay light: they shift each stone's tone, not its value.

kit.tint("tower-stone", "#e3e6ea")
kit.tint("tower-stone-warm", "#eee4d6")
kit.tint("tower-stone-cool", "#d3dae4")
kit.tint("tower-mortar", "#8f8a82")
kit.tint("tower-shadow", "#2b2b30")
kit.tint("tower-dust", "#f1e7d6")
kit.tint("tower-dust-2", "#ddd2c0")
kit.tint("tower-slate", "#f2f6fc")
kit.tint("tower-slate-2", "#dde3ec")
kit.tint("tower-ridge", "#aeb6c2")
kit.tint("tower-oak", "#e8d9c6")
kit.tint("tower-oak-dark", "#c2b2a2")
kit.tint("tower-bronze", "#d9a25a")
kit.tint("tower-gold", "#e3b451")
kit.tint("tower-moss", "#9db35a")
kit.tint("tower-heap", "#d9d3c8")
kit.tint("tower-meteor", "#8e847c")
kit.tint("tower-lava", "#ff6a1f")

STONES = [("stone:tower-stone", 5), ("stone:tower-stone-warm", 3),
          ("stone:tower-stone-cool", 3)]
DUSTY = [("stone:tower-dust", 4), ("stone:tower-dust-2", 3),
         ("stone:tower-stone-warm", 2)]
MORTAR = "stone:tower-mortar"
SHADOW = "stone:tower-shadow"
SLATES = [("slate:tower-slate", 3), ("slate:tower-slate-2", 2)]
RIDGE = "slate:tower-ridge"
OAK = "wood:tower-oak"
OAK2 = "wood:tower-oak-dark"
IRON = "metal:iron"
BRASS = "metal:brass"
BRONZE = "metal:tower-bronze"
TEAM = "cloth:team"
TEAM2 = "cloth:team2"
GOLD = "cloth:tower-gold"
MOSS = "rock:tower-moss"
HEAP = "rock:tower-heap"
CRUST = "rock:tower-meteor"
LAVA = "glow:tower-lava"

# Preview renders wear the diorama tiles the game will load, and the game's
# team colours (preview only: team tints carry no hex).
kit.CHOSEN.update({"stone": "stone-v3-a", "slate": "slate-v3-a",
                   "wood": "wood-v3-a", "rock": "rock-v3-b",
                   "cloth": "cloth-v1-a", "metal": "metal-v1-b"})


def _lin(hx):
    h = hx.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
                 for x in c)


for _n, _h in (("team", "#2446b8"), ("team2", "#142a70"),
               ("rteam", "#b8261e"), ("rteam2", "#6e1511")):
    kit.TINTS[_n] = _lin(_h)

GUARD_Z = 2.9     # the princess tower's platform
CANNON_Z = 3.2    # the keep's wall walk
TRUNNION = 0.36   # barrel pivot above the wall walk


def foot_moss(g, loop, rnd, z=0.0, reach=0.14, skip=None, lift=0.05,
              fill=0.5, seg=0.1):
    """Moss and grass creeping out from the foot of a wall round a loop,
    in ragged runs."""
    tri = 0
    u = rnd.uniform(0, 1)
    end = loop.length + u
    while u < end:
        run = rnd.uniform(0.25, 1.1)
        gap = rnd.uniform(0.2, 1.2) * (1 - fill) / 0.5
        a, b = u, min(end, u + run)
        n = max(2, int((b - a) / seg))
        rows = []
        ph = rnd.uniform(0, 50)
        for i in range(n + 1):
            uu = a + (b - a) * i / n
            pt, nn = loop.S(uu, z)
            n2 = Vector((nn.x, nn.y, 0)).normalized()
            t = math.sin(math.pi * i / n)
            h = lift * t * (0.6 + 0.4 * noise.noise(Vector((uu * 8 + ph, 0,
                                                             0))))
            r = reach * (0.4 + 0.6 * t) * (0.8 + 0.3 * noise.noise(
                Vector((uu * 11 + ph, 2, 0))))
            rows.append([g.vert(pt - n2 * 0.01 + Vector((0, 0, h))),
                         g.vert(pt + n2 * r * 0.45 + Vector((0, 0, h * 0.6))),
                         g.vert(pt + n2 * r + Vector((0, 0, -0.01)))])
        if not (skip and skip(loop.S((a + b) / 2, z)[0])):
            for i in range(n):
                for j in range(2):
                    q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1],
                         rows[i][j + 1]]
                    g.face(q, [(v.co.x / 0.6, v.co.y / 0.6) for v in q],
                           MOSS, (0, 0, 1))
                    tri += 2
        u = b + gap
    return tri


def rnd_for(name):
    return random.Random(sum(ord(ch) * (i + 7) for i, ch in enumerate(name)))


def face_frame(origin, normal):
    return M.frame_at(Vector(origin), Vector(normal))


def on_face(F, u, d, z):
    """A point on a wall face frame F: u across, d out of the wall, z
    absolute height (F's origin sits at z 0)."""
    return F @ Vector((u, z, d))


def face_block(g, F, u, d, z, size, mat, rnd, **kw):
    """A block on a wall face frame: centre (u across, d out, z up), size
    (across, depth, height)."""
    ex = Vector((F[0][0], F[1][0], F[2][0]))
    ey = Vector((F[0][1], F[1][1], F[2][1]))
    ez = Vector((F[0][2], F[1][2], F[2][2]))
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0], m[i][1], m[i][2] = ex[i], ez[i], ey[i]
    m.translation = on_face(F, u, d, z)
    return M.block(g, m, size, mat, rnd, **kw)


def slit(g, F, u, z0, rnd, height=0.47, width=0.085, p=0.045):
    """An arrow slit with a dark throat, two jambs, a sill and a lintel."""
    S = M.plane_surface(F.translation, (F[0][2], F[1][2], F[2][2]))
    S0 = lambda uu, vv: S(uu, vv)  # noqa: E731
    g.poly([on_face(F, u - width / 2, 0.004, z0),
            on_face(F, u + width / 2, 0.004, z0),
            on_face(F, u + width / 2, 0.004, z0 + height),
            on_face(F, u - width / 2, 0.004, z0 + height)],
           [(0, 0), (0.1, 0), (0.1, 0.5), (0, 0.5)], SHADOW,
           out=(F[0][2], F[1][2], F[2][2]))
    t = 0
    jw = 0.095
    for sgn in (-1, 1):
        a = u + sgn * width / 2
        b = a + sgn * jw
        lo, hi = min(a, b), max(a, b)
        t += M.facing_stone(g, S0, (lo, hi), (lo, hi), z0, z0 + height,
                            M.pick(rnd, STONES), rnd, p=p, c=0.018)
    t += M.facing_stone(g, S0, (u - 0.16, u + 0.16), (u - 0.16, u + 0.16),
                        z0 - 0.08, z0 - 0.004, M.pick(rnd, STONES), rnd,
                        p=p + 0.012, c=0.018)
    t += M.facing_stone(g, S0, (u - 0.16, u + 0.16), (u - 0.16, u + 0.16),
                        z0 + height + 0.004, z0 + height + 0.085,
                        M.pick(rnd, STONES), rnd, p=p + 0.008, c=0.018)
    return t


def slit_box(solids, F, u, z0, height=0.47):
    lo = on_face(F, u - 0.17, -0.12, z0 - 0.09)
    hi = on_face(F, u + 0.17, 0.14, z0 + height + 0.095)
    solids.box([min(lo[i], hi[i]) for i in range(3)],
               [max(lo[i], hi[i]) for i in range(3)])


def stud(g, at, normal, r=0.012, h=0.008, mat=IRON):
    """A little iron nail head: a four-sided pyramid."""
    n = Vector(normal).normalized()
    t1 = n.orthogonal().normalized()
    t2 = n.cross(t1)
    base = [g.vert(Vector(at) + (t1 * math.cos(a) + t2 * math.sin(a)) * r)
            for a in (0.785, 2.356, 3.927, 5.498)]
    tip = g.vert(Vector(at) + n * h)
    for i in range(4):
        g.face([base[i], base[(i + 1) % 4], tip], [(0, 0), (0.1, 0),
                                                    (0.05, 0.1)], mat, n)
    return 4


def arched_door(g, F, uc, sill, spring, r, rnd, ring=0.15, p=0.1,
                nv=11, planks=5, jambs=3, keystone=True):
    """A timber door under a round arch of voussoirs, between stone jambs
    that stand proud of the wall so the door sits in a deep reveal."""
    n = Vector((F[0][2], F[1][2], F[2][2]))
    S = M.plane_surface(F.translation, n)
    t = 0
    jw = 0.16
    # jambs
    zs = [sill + (spring - sill) * i / jambs for i in range(jambs + 1)]
    for sgn in (-1, 1):
        for i in range(jambs):
            w = jw + (0.04 if (i % 2) else 0.0)
            a = uc + sgn * r
            b = a + sgn * w
            lo, hi = min(a, b), max(a, b)
            t += M.facing_stone(g, S, (lo, hi), (lo, hi), zs[i] + 0.006,
                                zs[i + 1] - 0.006, M.pick(rnd, STONES), rnd,
                                p=p * rnd.uniform(0.9, 1.05), c=0.02)
    # voussoirs
    P = M.polar_surface(S, uc, spring, r)
    arc = math.pi * r
    for i in range(nv):
        s0, s1 = arc * i / nv + 0.006, arc * (i + 1) / nv - 0.006
        key = keystone and i == nv // 2
        t += M.facing_stone(g, P, (s0, s1), (s0, s1),
                            -0.01 if key else 0.0,
                            ring + (0.05 if key else 0.0),
                            M.pick(rnd, STONES), rnd,
                            p=p * (1.2 if key else 1.0), c=0.018,
                            squeeze=0.5)
    # the reveal: the arch's soffit and the jambs' inner faces
    k = 12
    for i in range(k):
        a0 = math.pi * i / k
        a1 = math.pi * (i + 1) / k
        pts = [on_face(F, uc + r * math.cos(a), dd, spring + r * math.sin(a))
               for a, dd in ((a0, 0.0), (a1, 0.0), (a1, p), (a0, p))]
        g.poly(pts, [(i / k, 0), ((i + 1) / k, 0), ((i + 1) / k, 0.1),
                     (i / k, 0.1)], M.pick(rnd, STONES),
               out=-(pts[0] - on_face(F, uc, 0, spring)))
    for sgn in (-1, 1):
        x = uc + sgn * r
        pts = [on_face(F, x, 0.0, sill), on_face(F, x, 0.0, spring),
               on_face(F, x, p, spring), on_face(F, x, p, sill)]
        g.poly(pts, [(0, 0), (0, 0.4), (0.06, 0.4), (0.06, 0)],
               M.pick(rnd, STONES), out=-(on_face(F, sgn, 0, 0) -
                                          on_face(F, 0, 0, 0)))
    # door planks, their tops following the arch
    d0 = 0.012
    pw = 2 * r / planks
    ex = Vector((F[0][0], F[1][0], F[2][0]))
    ey = Vector((F[0][1], F[1][1], F[2][1]))
    for i in range(planks):
        u0 = uc - r + pw * i
        uc_p = u0 + pw / 2

        def f(x, y, z, uc_p=uc_p):
            uu = uc_p + y
            top = spring + math.sqrt(max(0.0, r * r - (uu - uc) ** 2)) - 0.005
            zz = sill + (x + 0.5) * (top - sill)
            return on_face(F, uu, d0 + 0.02 + z, zz)
        t += M.block(g, f, (1.0, pw - 0.008, 0.04), OAK2 if i % 2 else OAK,
                     rnd, c=0.008, uv="wood", grain=0.9)
    # iron straps with nail heads, and a ring pull
    for zz in (sill + 0.2, sill + (spring - sill) * 0.85):
        m = Matrix.Identity(4)
        for j in range(3):
            m[j][0], m[j][1], m[j][2] = ex[j], n[j], ey[j]
        m.translation = on_face(F, uc, d0 + 0.046, zz)
        t += M.block(g, m, (2 * r - 0.06, 0.012, 0.045), IRON, rnd, c=0.004,
                     uv="tile", tile=0.25)
        for q in range(5):
            uu = uc - r + 0.08 + (2 * r - 0.16) * q / 4
            t += stud(g, on_face(F, uu, d0 + 0.052, zz), n)
    ring_pts = []
    for q in range(10):
        a = math.tau * q / 9
        ring_pts.append(tuple(on_face(F, uc + r * 0.45 + 0.04 * math.cos(a),
                                      d0 + 0.058, sill +
                                      (spring - sill) * 0.55 +
                                      0.04 * math.sin(a))))
    ringo = kit.tube("__ring", ring_pts, 0.007, mat=IRON, segments=6)
    g.add(ringo, uv="box-small")
    return t


def door_solid(solids, F, uc, sill, spring, r, ring=0.15, jw=0.2):
    solids.add(M.Arch(F @ Matrix.Translation((uc, 0, 0)), r + jw, spring,
                      sill, r + ring + 0.02, (-0.15, 0.3)))


# ---------------------------------------------------------------- cannon

def cannon(name="king-cannon"):
    """The keep's small bronze cannon on an oak turntable. The root turns
    about z; the barrel pitches about its trunnions, which are its origin,
    and points along +y."""
    rnd = rnd_for(name)
    root = kit.empty(name)
    g = M.Geo()
    # turntable: an oak disc with an iron tyre
    disc = kit.lathe(name + "-disc", [(0.0, 0.085), (0.37, 0.085),
                                      (0.395, 0.075), (0.40, 0.035),
                                      (0.385, 0.022), (0.0, 0.022)],
                     segments=28, mat=OAK)
    g.add(disc, uv="box")
    tyre = kit.lathe(name + "-tyre", [(0.402, 0.03), (0.412, 0.034),
                                      (0.412, 0.07), (0.402, 0.074)],
                     segments=28, mat=IRON, close=False)
    g.add(tyre, uv="box-small")
    for q in range(8):
        a = math.tau * (q + 0.5) / 8
        stud(g, (math.cos(a) * 0.412, math.sin(a) * 0.412, 0.052),
             (math.cos(a), math.sin(a), 0), r=0.01)
    # cheeks, a notch for each trunnion, trucks on short axles
    out = [(-0.34, 0.085), (0.28, 0.085), (0.28, 0.25), (0.15, 0.25),
           (0.15, 0.40), (0.036, 0.40), (0.036, TRUNNION)]
    for q in range(1, 8):
        a = -math.pi * q / 8
        out.append((0.036 * math.cos(a), TRUNNION + 0.036 * math.sin(a)))
    out += [(-0.036, TRUNNION), (-0.036, 0.40), (-0.12, 0.40), (-0.12, 0.30),
            (-0.24, 0.30), (-0.24, 0.20), (-0.34, 0.20)]
    m = len(out)
    for sx in (-1, 1):
        x0, x1 = sx * 0.165, sx * 0.235
        front = [g.vert((x1, y, z)) for y, z in out]
        back = [g.vert((x0, y, z)) for y, z in out]
        g.face(front, [(y / 0.28, z / 0.28) for y, z in out], OAK,
               (sx, 0, 0))
        g.face(back, [(y / 0.28, z / 0.28) for y, z in out], OAK,
               (-sx, 0, 0))
        for i in range(m):
            j = (i + 1) % m
            (ya, za), (yb, zb) = out[i], out[j]
            # the outline runs anticlockwise in (y, z): outward (dz, -dy)
            o = Vector((0, zb - za, -(yb - ya)))
            g.face([front[i], front[j], back[j], back[i]],
                   [(ya / 0.3, 0), (yb / 0.3, 0), (yb / 0.3, 0.2),
                    (ya / 0.3, 0.2)], OAK, o)
        # iron cap-square over the trunnion
        M.block(g, M.placed((sx * 0.2, 0.0, 0.406)), (0.08, 0.1, 0.012),
                IRON, rnd, c=0.003, uv="tile", tile=0.25)
        for sy in (-0.2, 0.2):
            w = kit.cylinder("__truck", 0.068, 0.068, 0.045, verts=14,
                             mat=OAK2, rings=1)
            w.rotation_euler = (0, math.pi / 2, 0)
            w.location = (0.24 if sx > 0 else -0.285, sy, 0.155)
            g.add(w, uv="box")
            h = kit.cylinder("__hub", 0.02, 0.02, 0.06, verts=8, mat=IRON,
                             rings=1)
            h.rotation_euler = (0, math.pi / 2, 0)
            h.location = (0.235 if sx > 0 else -0.295, sy, 0.155)
            g.add(h, uv="box-small")
    for sy in (-0.2, 0.2):
        M.block(g, M.placed((0, sy, 0.155)), (0.6, 0.07, 0.065), OAK2, rnd,
                c=0.01, uv="wood")
    # the elevating quoin under the breech
    M.block(g, M.placed((0, -0.2, 0.2), (math.radians(-8), 0, 0)),
            (0.2, 0.2, 0.05), OAK2, rnd, c=0.01, uv="wood")
    mount = g.build(name + "-mount", 50)
    kit.parent(mount, root)

    # barrel along +y, origin on the trunnions
    prof = [(0.0, -0.425), (0.03, -0.418), (0.046, -0.39), (0.04, -0.36),
            (0.024, -0.335), (0.09, -0.318), (0.124, -0.306), (0.134, -0.285),
            (0.124, -0.265), (0.126, -0.1), (0.133, -0.09), (0.133, -0.06),
            (0.122, -0.052), (0.112, 0.2), (0.119, 0.21), (0.119, 0.235),
            (0.108, 0.245), (0.09, 0.5), (0.099, 0.51), (0.092, 0.528),
            (0.104, 0.585), (0.111, 0.62), (0.102, 0.633), (0.05, 0.633),
            (0.046, 0.35), (0.0, 0.35)]
    g = M.Geo()
    tube = kit.lathe(name + "-tube", prof, segments=16, mat=BRONZE)
    tube.rotation_euler = (-math.pi / 2, 0, 0)
    g.add(tube, uv="box-small")
    for sx in (-1, 1):
        tr = kit.cylinder("__trun", 0.034, 0.034, 0.1, verts=12, mat=BRONZE,
                          rings=1)
        tr.rotation_euler = (0, math.pi / 2, 0)
        tr.location = (0.1 if sx > 0 else -0.2, 0, 0)
        g.add(tr, uv="box-small")
    # dolphins: two lifting handles over the trunnions
    for sx in (-1, 1):
        pts = kit.smooth_path([(sx * 0.03, -0.05, 0.11), (sx * 0.05, -0.02,
                                                          0.16),
                               (sx * 0.05, 0.05, 0.16), (sx * 0.03, 0.08,
                                                         0.105)], 4)
        d = kit.tube("__dolphin", pts, 0.012, mat=BRONZE, segments=6)
        g.add(d, uv="box-small")
    barrel = g.build(name + "-barrel", 55)
    kit.parent(barrel, root)
    kit.set_pivot(barrel, (0, 0, 0))
    barrel.location = (0, 0, TRUNNION)
    kit.refresh()
    return root, [mount, barrel]


# ---------------------------------------------------------------- king

KA = 1.55                 # curtain core half-width
TIN, TOUT = 1.11, 1.95    # corner turrets span these on both axes
WALK_BASE, PAR_TOP, MER_TOP = 3.1, 3.52, 3.86
T_TOP = 3.92              # turret stones end; a string course, parapet
HOUSE = (-1.0, 1.0, -1.2, -0.25, CANNON_Z, 3.9)
SLITS_Z = 2.3


def keep_outline(o=0.0):
    a, i, t = KA + o, TIN - o, TOUT + o
    pts = [(t, t), (i, t), (i, a), (-i, a), (-i, t), (-t, t), (-t, i),
           (-a, i), (-a, -i), (-t, -i), (-t, -t), (-i, -t), (-i, -a),
           (i, -a), (i, -t), (t, -t), (t, -i), (a, -i), (a, i), (t, i)]
    return pts


FACES = {  # curtain face frames: origin on the face at z 0, normal
    "front": ((0, KA, 0), (0, 1, 0)),
    "back": ((0, -KA, 0), (0, -1, 0)),
    "right": ((KA, 0, 0), (1, 0, 0)),
    "left": ((-KA, 0, 0), (-1, 0, 0)),
}


def turret_faces():
    """Outer faces of the four turrets: (frame, u of the face centre)."""
    c = (TIN + TOUT) / 2
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            out.append(face_frame((sx * c, sy * TOUT, 0), (0, sy, 0)))
            out.append(face_frame((sx * TOUT, sy * c, 0), (sx, 0, 0)))
    return out


def parapet_runs():
    """(frame, merlon spans) for the four curtain parapets."""
    runs = []
    for key in ("front", "back", "right", "left"):
        F = face_frame(*FACES[key])
        if key == "front":
            mer = [(-0.82, -0.5), (0.5, 0.82)]
        else:
            mer = [(-0.82, -0.5), (-0.16, 0.16), (0.5, 0.82)]
        runs.append((key, F, mer))
    return runs


FINE = dict(p=0.028, c=0.018, joint=0.009, lengths=(0.28, 0.62),
            vary=(0.6, 1.4), tilt=0.35, wobble=0.004)


def merlon(g, F, u, w, z0, z1, rnd, th=0.2):
    """A merlon on a parapet: one tall stone and a thin cap stone that
    overhangs it a little."""
    t = face_block(g, F, u, 0.0, (z0 + z1 - 0.05) / 2,
                   (w - 0.012, th, z1 - z0 - 0.055), M.pick(rnd, STONES),
                   rnd, c=0.016, jit=0.003, skip=("-z",))
    t += face_block(g, F, u, 0.0, z1 - 0.024, (w + 0.03, th + 0.04, 0.046),
                    M.pick(rnd, STONES), rnd, c=0.012, jit=0.002,
                    skip=("-z",))
    return t


def king(name="king"):
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    # --- plinth: two stepped courses of big stones (a battered base)
    for (z0, z1, off, p) in ((0.0, 0.24, 0.08, 0.055),
                             (0.24, 0.46, 0.04, 0.045)):
        loop = M.Loop(M.offset_poly(keep_outline(), off))
        sol = M.Solids()
        door_solid(sol, face_frame(*FACES["front"]), 0, 0.3, 1.12, 0.36)
        tri += M.lay_loop(g, loop, [(z0, z1)], rnd, STONES, p=p, c=0.026,
                          lengths=(0.38, 0.62), solids=sol,
                          quoin=(0.36, 0.2), rings=2)
        M.core_loop(g, loop, z0 - 0.02, z1, MORTAR, top=True)
    # --- the keep: curtain and turrets in one loop up to the wall walk
    loop = M.Loop(keep_outline())
    sol = M.Solids()
    front = face_frame(*FACES["front"])
    back = face_frame(*FACES["back"])
    door_solid(sol, front, 0, 0.3, 1.12, 0.36)
    for F in turret_faces():
        slit_box(sol, F, 0, SLITS_Z)
    for key in ("right", "left"):
        slit_box(sol, face_frame(*FACES[key]), 0, SLITS_Z)
    # stones hidden by the banners
    for F, top, length in ((front, 2.84, 0.86), (back, 2.84, 1.45)):
        lo = on_face(F, -0.36, -0.1, top - length)
        hi = on_face(F, 0.36, 0.2, top - 0.1)
        sol.box([min(lo[i], hi[i]) for i in range(3)],
                [max(lo[i], hi[i]) for i in range(3)])
    # the parapets stand over the curtain's last course
    for key, F, _ in parapet_runs():
        lo = on_face(F, -TIN + 0.01, -0.3, WALK_BASE)
        hi = on_face(F, TIN - 0.01, 0.2, MER_TOP)
        sol.box([min(lo[i], hi[i]) for i in range(3)],
                [max(lo[i], hi[i]) for i in range(3)])
    courses = M.course_heights(0.46, CANNON_Z, rnd, 0.18, 0.25,
                               joints=(1.12, SLITS_Z - 0.08,
                                       SLITS_Z + 0.555, WALK_BASE))
    tri += M.lay_loop(g, loop, courses, rnd, STONES, solids=sol, **FINE)
    M.core_loop(g, loop, 0.44, WALK_BASE, MORTAR)
    print("TRIS king walls", M.tri_count(g))
    # --- the gate, slits and corbels
    tri += arched_door(g, front, 0, 0.46, 1.12, 0.36, rnd)
    # steps up to the gate
    M.block(g, M.placed((0, KA + 0.1, 0.35)), (1.1, 0.34, 0.22),
            M.pick(rnd, STONES), rnd, c=0.025, skip=("-z",), jit=0.003)
    M.block(g, M.placed((0, KA + 0.3, 0.12)), (1.34, 0.36, 0.24),
            M.pick(rnd, STONES), rnd, c=0.025, skip=("-z",), jit=0.003)
    for F in turret_faces():
        tri += slit(g, F, 0, SLITS_Z, rnd)
    for key in ("right", "left"):
        tri += slit(g, face_frame(*FACES[key]), 0, SLITS_Z, rnd)
    for key, F, mer in parapet_runs():
        # corbels carrying the parapet
        for u in (-0.88, -0.44, 0.0, 0.44, 0.88):
            ex = Vector((F[0][0], F[1][0], F[2][0]))
            nn = Vector((F[0][2], F[1][2], F[2][2]))

            def f(x, y, z, u=u, ex=ex, nn=nn):
                t = (z + 0.11) / 0.22
                depth = (y + 0.06) * (0.4 + 0.6 * t)
                return (on_face(F, u + x, -0.01, WALK_BASE - 0.11 + z) +
                        nn * depth)
            tri += M.block(g, f, (0.12, 0.12, 0.22), M.pick(rnd, STONES),
                           rnd, c=0.016, skip=("-y",))
        # parapet: two courses of through-stones, then capped merlons
        for (z0, z1) in ((WALK_BASE, 3.3), (3.3, PAR_TOP)):
            js = M._split(-TIN, TIN, (0.28, 0.5), rnd, [], [], [])
            for a, b in zip(js, js[1:]):
                tri += face_block(g, F, (a + b) / 2, 0.0, (z0 + z1) / 2,
                                  (b - a - 0.01, 0.2, z1 - z0 - 0.01),
                                  M.pick(rnd, STONES), rnd, c=0.016,
                                  jit=0.003, skip=("-z",))
        for a, b in mer:
            tri += merlon(g, F, (a + b) / 2, b - a, PAR_TOP, MER_TOP, rnd)
    print("TRIS king +gate/slits/corbels/parapets", M.tri_count(g))
    # --- the wall walk: flagstones, the turntable's iron rail
    walk = M.Solids()
    for sx in (-1, 1):
        for sy in (-1, 1):
            walk.box((min(sx * TIN, sx * TOUT) - (0.02 if sx > 0 else 0),
                      min(sy * TIN, sy * TOUT) - (0.02 if sy > 0 else 0),
                      0), (max(sx * TIN, sx * TOUT) + (0.02 if sx < 0 else 0),
                           max(sy * TIN, sy * TOUT) + (0.02 if sy < 0 else 0),
                           5))
    walk.box((HOUSE[0] - 0.01, HOUSE[2] - 0.01, 0),
             (HOUSE[1] + 0.01, HOUSE[3] + 0.01, 5))
    Sf = lambda u, v: (Vector((u, v, CANNON_Z - 0.02)), Vector((0, 0, 1)))  # noqa
    rows = M.course_heights(-1.40, 1.40, rnd, 0.28, 0.4)
    tri += M.lay_courses(g, Sf, -1.40, 1.40, rows, rnd, STONES, solids=walk,
                         p=0.02, c=0.016, lengths=(0.3, 0.5))
    g.poly([(-1.42, -1.42, CANNON_Z - 0.025), (1.42, -1.42, CANNON_Z - 0.025),
            (1.42, 1.42, CANNON_Z - 0.025), (-1.42, 1.42, CANNON_Z - 0.025)],
           [(0, 0), (1, 0), (1, 1), (0, 1)], MORTAR, out=(0, 0, 1))
    rail = kit.lathe("__rail", [(0.37, CANNON_Z - 0.005),
                                (0.44, CANNON_Z - 0.005),
                                (0.44, CANNON_Z + 0.018),
                                (0.37, CANNON_Z + 0.018)], segments=28,
                     mat=IRON)
    rail.location = (0, 0.62, 0)
    g.add(rail, uv="box-small")
    # a stack of shot by the cannon
    for i, (x, y, z) in enumerate(((-0.95, 0.95, 0), (-0.83, 0.95, 0),
                                   (-0.89, 1.05, 0))):
        s = kit.sphere("__shot", 0.06, (x, y, CANNON_Z + 0.06 + z), mat=IRON,
                       segments=8, rings=5)
        g.add(s, uv="box-small")
    # --- turrets above the wall walk
    for sx in (-1, 1):
        for sy in (-1, 1):
            xs = sorted((sx * TIN, sx * TOUT))
            ys = sorted((sy * TIN, sy * TOUT))
            sq = [(xs[1], ys[1]), (xs[0], ys[1]), (xs[0], ys[0]),
                  (xs[1], ys[0])]
            tl = M.Loop(sq)
            ts = M.Solids()
            for key, F, mer in parapet_runs():
                lo = on_face(F, -TIN, -0.2, WALK_BASE)
                hi = on_face(F, TIN, 0.14, PAR_TOP)
                ts.box([min(lo[i], hi[i]) for i in range(3)],
                       [max(lo[i], hi[i]) for i in range(3)])
                for a, b in mer:
                    lo = on_face(F, a - 0.01, -0.2, PAR_TOP)
                    hi = on_face(F, b + 0.01, 0.14, MER_TOP)
                    ts.box([min(lo[i], hi[i]) for i in range(3)],
                           [max(lo[i], hi[i]) for i in range(3)])
            tc = M.course_heights(CANNON_Z, T_TOP, rnd, 0.15, 0.21,
                                  joints=(PAR_TOP, MER_TOP))
            tri += M.lay_loop(g, tl, tc, rnd, STONES, solids=ts,
                              **dict(FINE, lengths=(0.22, 0.44)))
            M.core_loop(g, tl, WALK_BASE, T_TOP, MORTAR)
            # string course, parapet, corner merlons, flagged floor
            sl = M.Loop(M.offset_poly(sq, 0.035))
            tri += M.lay_loop(g, sl, [(T_TOP, T_TOP + 0.12)], rnd, STONES,
                              p=0.05, c=0.022, lengths=(0.34, 0.5))
            M.core_loop(g, sl, T_TOP - 0.01, T_TOP + 0.12, MORTAR, top=True)
            x0, x1 = xs[0] - 0.05, xs[1] + 0.05
            y0, y1 = ys[0] - 0.05, ys[1] + 0.05
            th = 0.16
            zb, zt = T_TOP + 0.12, T_TOP + 0.37
            for (cy, ax0, ax1) in ((y1 - th / 2, x0, x1), (y0 + th / 2, x0,
                                                           x1)):
                js = M._split(ax0, ax1, (0.28, 0.42), rnd, [], [], [])
                for a, b in zip(js, js[1:]):
                    tri += M.block(g, M.placed(((a + b) / 2, cy,
                                                (zb + zt) / 2)),
                                   (b - a - 0.012, th, zt - zb - 0.01),
                                   M.pick(rnd, STONES), rnd, c=0.02,
                                   jit=0.003, skip=("-z",))
            for (cx, ay0, ay1) in ((x1 - th / 2, y0 + th, y1 - th),
                                   (x0 + th / 2, y0 + th, y1 - th)):
                js = M._split(ay0, ay1, (0.26, 0.44), rnd, [], [], [])
                for a, b in zip(js, js[1:]):
                    tri += M.block(g, M.placed((cx, (a + b) / 2,
                                                (zb + zt) / 2)),
                                   (th, b - a - 0.012, zt - zb - 0.01),
                                   M.pick(rnd, STONES), rnd, c=0.02,
                                   jit=0.003, skip=("-z",))
            for cx in (x0 + 0.115, x1 - 0.115):
                for cy in (y0 + 0.115, y1 - 0.115):
                    tri += M.block(g, M.placed((cx, cy, zt + 0.125)),
                                   (0.22, 0.22, 0.25), M.pick(rnd, STONES),
                                   rnd, c=0.016, jit=0.003, skip=("-z",))
                    tri += M.block(g, M.placed((cx, cy, zt + 0.272)),
                                   (0.26, 0.26, 0.044), M.pick(rnd, STONES),
                                   rnd, c=0.011, jit=0.002, skip=("-z",))
            Sf2 = lambda u, v: (Vector((u, v, zb + 0.005)),  # noqa: E731
                                Vector((0, 0, 1)))
            fr = M.course_heights(y0 + th, y1 - th, rnd, 0.22, 0.3)
            tri += M.lay_courses(g, Sf2, x0 + th, x1 - th, fr, rnd, STONES,
                                 p=0.018, c=0.014, lengths=(0.2, 0.3))
            g.poly([(x0 + th, y0 + th, zb), (x1 - th, y0 + th, zb),
                    (x1 - th, y1 - th, zb), (x0 + th, y1 - th, zb)],
                   [(0, 0), (1, 0), (1, 1), (0, 1)], MORTAR, out=(0, 0, 1))
    print("TRIS king +walk/turrets", M.tri_count(g))
    # --- the house over the rear, and its slate roof
    hx0, hx1, hy0, hy1, hz0, hz1 = HOUSE
    hl = M.Loop([(hx1, hy1), (hx0, hy1), (hx0, hy0), (hx1, hy0)])
    hs = M.Solids()
    hback = face_frame((0, hy0, 0), (0, -1, 0))
    hfront = face_frame((0, hy1, 0), (0, 1, 0))
    wins = [(hback, -0.48), (hback, 0.48), (hfront, 0.5)]
    for F, u in wins:
        lo = on_face(F, u - 0.17, -0.1, 3.36)
        hi = on_face(F, u + 0.17, 0.12, 3.8)
        hs.box([min(lo[i], hi[i]) for i in range(3)],
               [max(lo[i], hi[i]) for i in range(3)])
    door_solid(hs, hfront, -0.5, CANNON_Z - 0.05, 3.52, 0.16, ring=0.1,
               jw=0.12)
    hc = M.course_heights(hz0, hz1, rnd, 0.17, 0.22, joints=(3.38, 3.78))
    tri += M.lay_loop(g, hl, hc, rnd, STONES, solids=hs, p=0.03, c=0.02,
                      lengths=(0.28, 0.46))
    M.core_loop(g, hl, hz0 - 0.02, hz1, MORTAR, top=True)
    for F, u in wins:
        S = M.plane_surface(F.translation, (F[0][2], F[1][2], F[2][2]))
        g.poly([on_face(F, u - 0.08, 0.004, 3.44),
                on_face(F, u + 0.08, 0.004, 3.44),
                on_face(F, u + 0.08, 0.004, 3.7),
                on_face(F, u - 0.08, 0.004, 3.7)],
               [(0, 0), (0.1, 0), (0.1, 0.3), (0, 0.3)], SHADOW,
               out=(F[0][2], F[1][2], F[2][2]))
        for sgn in (-1, 1):
            a, b = sorted((u + sgn * 0.08, u + sgn * 0.16))
            tri += M.facing_stone(g, S, (a, b), (a, b), 3.44, 3.7,
                                  M.pick(rnd, STONES), rnd, p=0.045,
                                  c=0.016)
        tri += M.facing_stone(g, S, (u - 0.17, u + 0.17),
                              (u - 0.17, u + 0.17), 3.385, 3.436,
                              M.pick(rnd, STONES), rnd, p=0.06, c=0.014)
        tri += M.facing_stone(g, S, (u - 0.17, u + 0.17),
                              (u - 0.17, u + 0.17), 3.704, 3.78,
                              M.pick(rnd, STONES), rnd, p=0.05, c=0.016)
        # an oak shutter folded back beside the window
        tri += face_block(g, F, u + 0.215, 0.07, 3.57, (0.08, 0.02, 0.27),
                          OAK2, rnd, c=0.005, uv="wood", grain=0.8)
    tri += arched_door(g, hfront, -0.5, CANNON_Z, 3.52, 0.16, rnd,
                       ring=0.1, p=0.06, nv=7, planks=3, jambs=2)
    # roof: a hip of slates, ridge and hip tiles, iron finials
    ov = 0.11
    ex0, ex1, ey0, ey1 = hx0 - ov, hx1 + ov, hy0 - ov, hy1 + ov
    ez = hz1 + 0.01
    half = (ey1 - ey0) / 2
    pitch = math.radians(58)
    zr = ez + half * math.tan(pitch)
    yr = (ey0 + ey1) / 2
    r0, r1 = Vector((ex0 + half, yr, zr)), Vector((ex1 - half, yr, zr))
    c00, c10 = Vector((ex0, ey0, ez)), Vector((ex1, ey0, ez))
    c01, c11 = Vector((ex0, ey1, ez)), Vector((ex1, ey1, ez))
    rows = 10
    nf = Vector((0, math.sin(pitch), math.cos(pitch)))
    nb = Vector((0, -math.sin(pitch), math.cos(pitch)))
    nr = Vector((math.sin(pitch), 0, math.cos(pitch)))
    nl = Vector((-math.sin(pitch), 0, math.cos(pitch)))
    tri += M.slate_plane(g, c01, c11, r1, r0, rows, None, rnd, nf,
                         mats=SLATES)
    tri += M.slate_plane(g, c10, c00, r0, r1, rows, None, rnd, nb,
                         mats=SLATES)
    tri += M.slate_plane(g, c11, c10, r1, r1, rows, None, rnd, nr,
                         mats=SLATES)
    tri += M.slate_plane(g, c00, c01, r0, r0, rows, None, rnd, nl,
                         mats=SLATES)
    tri += M.ridge_caps(g, r0, r1, nf, nb, RIDGE, rnd)
    for a, b, n1, n2 in ((c01, r0, nf, nl), (c11, r1, nf, nr),
                         (c00, r0, nb, nl), (c10, r1, nb, nr)):
        tri += M.ridge_caps(g, a, b, n1, n2, RIDGE, rnd, width=0.06)
    for (a, b) in ((c00, c10), (c10, c11), (c11, c01), (c01, c00)):
        d = (b - a)
        mid = (a + b) / 2 + Vector((0, 0, -0.035))
        ang = math.atan2(d.y, d.x)
        M.block(g, M.placed(mid, (0, 0, ang)), (d.length + 0.02, 0.05, 0.07),
                OAK2, rnd, c=0.008, uv="wood")
    for rp in (r0, r1):
        col = kit.lathe("__finial", [(0.0, 0.0), (0.035, 0.0), (0.03, 0.05),
                                     (0.012, 0.07), (0.012, 0.26),
                                     (0.0, 0.34)], segments=10, mat=IRON)
        col.location = rp + Vector((0, 0, 0.02))
        g.add(col, uv="box-small")
        ball = kit.sphere("__ball", 0.028, rp + Vector((0, 0, 0.17)),
                          mat=BRASS, segments=8, rings=5)
        g.add(ball, uv="box-small")
    print("TRIS king +house/roof", M.tri_count(g))
    # --- banners: the big one over the gate, one at the back for the
    # player's own keep
    for F, length, width in ((front, 1.12, 1.0), (back, 1.72, 1.1)):
        bf = F @ Matrix.Translation((0, 2.86, 0.07))
        sh = M.crown_shape(0, min(0.5, length * 0.36), 0.3)
        sh += M.lozenge(0, length * 0.72, 0.11, 0.17)
        tri += M.cloth_sheet(g, bf, width, length, rnd, TEAM, GOLD,
                             point=0.3, cols=8, rows=12, emblem=sh,
                             border=0.055)
        # an iron rod on two brackets, brass knobs
        hw = width / 2 + 0.07
        pts = [tuple(bf @ Vector((x, 0.02, 0.0))) for x in (-hw, hw)]
        rod = kit.tube("__rod", pts, 0.018, mat=IRON, segments=8)
        g.add(rod, uv="box-small")
        for x in (-hw, hw):
            k = kit.sphere("__knob", 0.03, bf @ Vector((x, 0.02, 0.0)),
                           mat=BRASS, segments=10, rings=6)
            g.add(k, uv="box-small")
        for x in (-width * 0.4, width * 0.4):
            br = [tuple(bf @ Vector((x, 0.02, 0.0))),
                  tuple(bf @ Vector((x, 0.07, -0.07))),
                  tuple(bf @ Vector((x, 0.1, -0.075)))]
            b = kit.tube("__bracket", br, 0.011, mat=IRON, segments=6)
            g.add(b, uv="box-small")
    # --- moss where the keep meets the ground and on a few ledges
    pl = M.Loop(M.offset_poly(keep_outline(), 0.13))
    tri += foot_moss(g, pl, rnd, skip=lambda q: abs(q.x) < 0.9 and q.y > 0,
                     fill=0.45)
    pl = M.Loop(M.offset_poly(keep_outline(), 0.1))
    for i in range(6):
        u = rnd.uniform(0, pl.length)
        pt, n = pl.S(u, 0.24)
        tri += M.moss(g, pt - n * 0.01, (0, 0, 1), rnd.uniform(0.05, 0.09),
                      0.025, rnd, MOSS, k=6, squash=0.6,
                      along=(n.y, -n.x, 0))
    print("TRIS king total", M.tri_count(g))
    body = g.build(name + "-keep")
    root = kit.empty(name)
    kit.parent(body, root)
    gun, gun_parts = cannon(name + "-cannon")
    gun.location = (0, 0.62, CANNON_Z)
    kit.parent(gun, root)
    return root, [body] + gun_parts


# ---------------------------------------------------------------- princess

PR0 = 1.34                # shaft radius above the plinth
PR1 = 1.27                # at the corbels
P_CORBEL = 2.48


def shaft_r(z):
    return PR0 + (PR1 - PR0) * (z - 0.44) / (P_CORBEL - 0.44)


def princess(name="princess"):
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    back = face_frame((0, -PR0, 0), (0, -1, 0))
    front_a = math.pi / 2
    door_f = face_frame((0, -shaft_r(0.7), 0), (0, -1, 0))
    for (z0, z1, r, p) in ((0.0, 0.24, 1.44, 0.055),
                           (0.24, 0.44, 1.39, 0.045)):
        loop = M.Loop(M.circle(r, 40), chamfer=0)
        sol = M.Solids()
        door_solid(sol, face_frame((0, -r, 0), (0, -1, 0)), 0, 0.3, 0.98,
                   0.28, ring=0.14)
        tri += M.lay_loop(g, loop, [(z0, z1)], rnd, STONES, p=p, c=0.024,
                          lengths=(0.4, 0.6), solids=sol, rings=2)
        M.core_loop(g, loop, z0 - 0.02, z1, MORTAR, top=True)
    loop = M.Loop(M.circle(PR0, 40), chamfer=0,
                  scale=lambda z: shaft_r(z) / PR0)
    sol = M.Solids()
    door_solid(sol, door_f, 0, 0.3, 0.98, 0.28, ring=0.14)
    slit_zs = 1.6
    slit_angles = [math.radians(a) for a in (28, 152, -28, -152)]
    frames = []
    for a in slit_angles:
        r = shaft_r(slit_zs + 0.2)
        F = face_frame((math.cos(a) * r, math.sin(a) * r, 0),
                       (math.cos(a), math.sin(a), 0))
        frames.append(F)
        slit_box(sol, F, 0, slit_zs)
    for a, length in ((front_a, 0.82), (-front_a, 0.66)):
        r = shaft_r(2.0)
        F = face_frame((math.cos(a) * r, math.sin(a) * r, 0),
                       (math.cos(a), math.sin(a), 0))
        lo = on_face(F, -0.18, -0.15, 2.42 - length + 0.12)
        hi = on_face(F, 0.18, 0.2, 2.4)
        sol.box([min(lo[i], hi[i]) for i in range(3)],
                [max(lo[i], hi[i]) for i in range(3)])
    courses = M.course_heights(0.44, P_CORBEL + 0.1, rnd, 0.18, 0.24,
                               joints=(0.98, slit_zs - 0.08,
                                       slit_zs + 0.555, P_CORBEL))
    tri += M.lay_loop(g, loop, courses, rnd, STONES, solids=sol,
                      **dict(FINE, rings=2, lengths=(0.24, 0.5)))
    M.core_loop(g, loop, 0.42, P_CORBEL + 0.1, MORTAR)
    tri += arched_door(g, door_f, 0, 0.44, 0.98, 0.28, rnd, ring=0.14,
                       p=0.09, nv=9, planks=4)
    tri += portal_backing(g, door_f, 0.44, 0.98, 0.28 + 0.2, 0.28 + 0.15,
                          lambda z: shaft_r(z))
    M.block(g, M.placed((0, -1.45, 0.34)), (0.86, 0.3, 0.2),
            M.pick(rnd, STONES), rnd, c=0.024, skip=("-z",), jit=0.003)
    M.block(g, M.placed((0, -1.62, 0.12)), (1.04, 0.3, 0.24),
            M.pick(rnd, STONES), rnd, c=0.024, skip=("-z",), jit=0.003)
    for F in frames:
        tri += slit(g, F, 0, slit_zs, rnd)
    # corbels, then the parapet ring and its merlons
    nc = 18
    for i in range(nc):
        a = math.tau * (i + 0.5) / nc
        base = Vector((math.cos(a), math.sin(a), 0))
        tang = Vector((-math.sin(a), math.cos(a), 0))

        def f(x, y, z, base=base, tang=tang):
            t = (z + 0.11) / 0.22
            depth = (y + 0.07) * (0.4 + 0.6 * t)
            return (base * (PR1 - 0.01 + depth) + tang * x +
                    Vector((0, 0, P_CORBEL + 0.11 + z)))
        tri += M.block(g, f, (0.12, 0.14, 0.22), M.pick(rnd, STONES), rnd,
                       c=0.016, skip=("-y",))
    ro, ri = 1.40, 1.18
    rc, th = (ro + ri) / 2, ro - ri
    zp0 = P_CORBEL + 0.22
    for ci, (z0, z1) in enumerate(((zp0, 2.95), (2.95, 3.22))):
        circ = math.tau * rc
        js = M._split(0, circ, (0.3, 0.48), rnd, [], [], [])
        off = rnd.uniform(0, 0.3)
        for a, b in zip(js, js[1:]):
            L = b - a - 0.012
            f = M.ring_map(rc, (a + b) / 2 / rc + off, (z0 + z1) / 2)
            tri += M.block(g, f, (L, th, z1 - z0 - 0.01),
                           M.pick(rnd, STONES), rnd, c=0.016, nx=2,
                           jit=0.003, skip=("-z",))
    nm = 10
    for i in range(nm):
        a = math.tau * (i + 0.25) / nm
        f = M.ring_map(rc, a, (3.22 + 3.47) / 2)
        tri += M.block(g, f, (0.36, th, 0.24), M.pick(rnd, STONES), rnd,
                       c=0.016, nx=2, jit=0.003, skip=("-z",))
        f = M.ring_map(rc, a, 3.495)
        tri += M.block(g, f, (0.4, th + 0.04, 0.046), M.pick(rnd, STONES),
                       rnd, c=0.011, nx=2, jit=0.002, skip=("-z",))
    # the platform: oak planks, a hatch
    pw = 0.17
    y = -ri
    k = 0
    while y < ri - 0.02:
        y1 = min(ri, y + pw)
        edge = max(abs(y), abs(y1))
        half = math.sqrt(max(0.01, (ri + 0.03) ** 2 - edge ** 2))
        tri += M.block(g, M.placed((0, (y + y1) / 2, GUARD_Z - 0.025)),
                       (2 * half, y1 - y - 0.012, 0.05),
                       OAK if k % 3 else OAK2, rnd, c=0.008, uv="wood",
                       skip=("-z",))
        y = y1
        k += 1
    g.poly([(math.cos(a) * ri, math.sin(a) * ri, GUARD_Z - 0.06)
            for a in [math.tau * i / 24 for i in range(24)]],
           [(0, 0)] * 24, OAK2, out=(0, 0, 1))
    tri += M.block(g, M.placed((0.52, -0.42, GUARD_Z + 0.012)),
                   (0.36, 0.36, 0.03), OAK2, rnd, c=0.006, uv="wood")
    for dy in (-0.1, 0.1):
        tri += M.block(g, M.placed((0.52, -0.42 + dy, GUARD_Z + 0.03)),
                       (0.3, 0.03, 0.006), IRON, rnd, c=0.002, uv="tile",
                       tile=0.25)
    # banners on the front and back
    for a, length in ((front_a, 0.82), (-front_a, 0.66)):
        r = shaft_r(2.4) + 0.05
        F = face_frame((math.cos(a) * r, math.sin(a) * r, 0),
                       (math.cos(a), math.sin(a), 0))
        bf = F @ Matrix.Translation((0, 2.44, 0.03))
        sh = M.star_shape(0, length * 0.42, 0.11, points=6)
        tri += M.cloth_sheet(g, bf, 0.54, length, rnd, TEAM, GOLD,
                             point=0.2, cols=6, rows=10, emblem=sh,
                             border=0.035, sway=0.012, lean=0.03)
        pts = [tuple(bf @ Vector((x, 0.015, 0.0))) for x in (-0.3, 0.3)]
        rod = kit.tube("__rod", pts, 0.014, mat=IRON, segments=8)
        g.add(rod, uv="box-small")
        for x in (-0.3, 0.3):
            kb = kit.sphere("__knob", 0.022, bf @ Vector((x, 0.015, 0.0)),
                            mat=BRASS, segments=8, rings=5)
            g.add(kb, uv="box-small")
    # the pennant on its pole
    pa = math.radians(225)
    px, py = math.cos(pa) * 0.98, math.sin(pa) * 0.98
    top = 4.36
    pole = kit.cylinder("__pole", 0.03, 0.024, top - GUARD_Z,
                        (px, py, GUARD_Z), verts=10, mat=IRON)
    g.add(pole, uv="box-small")
    fin = kit.lathe("__fin", [(0.0, 0.0), (0.03, 0.0), (0.035, 0.02),
                              (0.02, 0.05), (0.008, 0.06), (0.008, 0.1),
                              (0.0, 0.16)], segments=10, mat=BRASS)
    fin.location = (px, py, top)
    g.add(fin, uv="box-small")
    kb = kit.sphere("__knob", 0.038, (px, py, top + 0.05), mat=BRASS,
                    segments=10, rings=6)
    g.add(kb, uv="box-small")
    for zb in (3.05, 3.4):
        band = kit.lathe("__band", [(0.036, zb - 0.02), (0.036, zb + 0.02)],
                         segments=10, mat=IRON, close=False)
        band.location = (px, py, 0)
        g.add(band, uv="box-small")
        arm = kit.tube("__arm", [(px, py, zb), (px * 1.17, py * 1.17, zb)],
                       0.012, mat=IRON, segments=6)
        g.add(arm, uv="box-small")
    fly = Vector((0.55, 0.83, 0)).normalized()
    pf = Matrix.Identity(4)
    side = Vector((0, 0, 1)).cross(fly)
    for i in range(3):
        pf[i][0], pf[i][1], pf[i][2] = fly[i], 0.0, side[i]
    pf[2][1] = 1.0
    pf.translation = Vector((px, py, top - 0.22))
    tri += pennant(g, pf, 0.98, 0.4, rnd)
    # moss at the foot
    tri += foot_moss(g, M.Loop(M.circle(1.49, 40), chamfer=0), rnd,
                     skip=lambda q: q.y < -1.2 and abs(q.x) < 0.7, fill=0.5)
    for i in range(4):
        a = rnd.uniform(0, math.tau)
        r = 1.42
        tri += M.moss(g, (math.cos(a) * r, math.sin(a) * r, 0.24),
                      (0, 0, 1), rnd.uniform(0.05, 0.08), 0.022, rnd, MOSS,
                      k=6, squash=0.6, along=(-math.sin(a), math.cos(a), 0))
    print("TRIS princess", M.tri_count(g))
    body = g.build(name + "-tower")
    root = kit.empty(name)
    kit.parent(body, root)
    kit.empty(name + "-guard", (0, 0, GUARD_Z), root)
    return root, [body]


def portal_backing(g, F, sill, spring, half, rext, radius, k=10):
    """Close the gap between a flat door surround on a tangent plane and
    the round wall behind it: side faces from the surround's outline back
    to the wall."""
    outline = [(-half, sill), (-half, spring)]
    for i in range(1, k):
        a = math.pi - math.pi * i / k
        outline.append((rext * math.cos(a), spring + rext * math.sin(a)))
    outline += [(half, spring), (half, sill)]
    rnd = random.Random(3)
    tri = 0
    for (u0, z0), (u1, z1) in zip(outline, outline[1:]):
        pa, pb = on_face(F, u0, 0.0, z0), on_face(F, u1, 0.0, z1)
        qa, qb = Vector(pa), Vector(pb)
        for q, z in ((qa, z0), (qb, z1)):
            d = Vector((q.x, q.y, 0))
            q.xy = (d.normalized() * (radius(z) - 0.01)).xy
        mid = (pa + pb) / 2
        out = mid - on_face(F, 0, 0.0, spring * 0.5 + sill * 0.5)
        g.poly([pa, pb, qb, qa], [(u0, z0), (u1, z1), (u1, z1 - 0.1),
                                  (u0, z0 - 0.1)], M.pick(rnd, STONES),
               out=out)
        tri += 2
    return tri


def pennant(g, F, length, height, rnd, notch=0.2, torn=None,
            ts=(0.0, 0.09, 0.3, 0.5, 0.7, 0.91, 1.0), cols=12):
    """A swallowtail pennant flying from its hoist at F's origin along F's
    x, F's y up, both sides of the cloth, a gold border and a star."""
    ph = rnd.uniform(0, math.tau)

    def shape(s, t):
        """s along the fly 0..1, t down the hoist 0..1."""
        h = height * (1 - 0.45 * s)
        top = h / 2
        y = h / 2 - t * h
        x = s * length
        if s > 0.72:
            k = (s - 0.72) / 0.28
            mid = abs(t - 0.5) * 2
            x = length * (0.72 + 0.28 * (k if mid > 0.001 else k))
            x -= notch * max(0.0, 1 - mid) * k
        wave = 0.05 * math.sin(s * 5.2 + ph) * s + 0.015 * math.sin(
            t * 3 + s * 7)
        droop = -0.1 * s * s
        return Vector((x, y + droop, wave)), top

    tri = 0
    rows = len(ts) - 1
    grid = [[shape(i / cols, t)[0] for i in range(cols + 1)] for t in ts]
    nz = Vector((F[0][2], F[1][2], F[2][2]))
    for off, out in ((0.004, nz), (-0.004, -nz)):
        vs = [[g.vert(F @ (p + Vector((0, 0, off)))) for p in row]
              for row in grid]
        for j in range(rows):
            for i in range(cols):
                if torn and torn(i / cols, ts[j]):
                    continue
                q = [vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]]
                uv = [(i / cols * length / 0.3, ts[j] * height / 0.3),
                      ((i + 1) / cols * length / 0.3, ts[j] * height / 0.3),
                      ((i + 1) / cols * length / 0.3,
                       ts[j + 1] * height / 0.3),
                      (i / cols * length / 0.3, ts[j + 1] * height / 0.3)]
                mat = GOLD if j in (0, rows - 1) or i == 0 else TEAM
                g.face(q, uv, mat, out)
                tri += 2
    return tri


# ---------------------------------------------------------------- rubble

def heap(g, radius, height, rnd, centre=(0, 0), step=0.14, lump=0.12,
         mat=HEAP, seed=0.0):
    """A mound of broken stone and dust, its foot sunk just below ground.
    Returns a height function for placing stones on it."""
    cx, cy = centre
    ph = seed

    def H(x, y):
        r = math.hypot(x - cx, y - cy) / radius
        if r >= 1:
            return -0.02
        base = height * (1 - r * r) ** 1.25
        base += lump * noise.noise(Vector((x * 1.7 + ph, y * 1.7, 0.3))) * \
            (1 - r)
        base += 0.04 * noise.noise(Vector((x * 5 + ph, y * 5, 1.1)))
        return max(-0.02, base - 0.02)
    n = int(2 * radius / step) + 1
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x = cx - radius + 2 * radius * i / n
            y = cy - radius + 2 * radius * j / n
            row.append((x, y, H(x, y)))
        grid.append(row)
    vs = [[g.vert(p) for p in row] for row in grid]
    for j in range(n):
        for i in range(n):
            cxy = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1],
                   grid[j + 1][i]]
            if all(p[2] <= -0.019 for p in cxy):
                continue
            q = [vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]]
            g.face(q, [(p[0] / 1.2, p[1] / 1.2) for p in cxy], mat, (0, 0, 1))
    return H


def scatter_stones(g, H, n, rnd, area, mats, size=(0.14, 0.34), sink=0.3,
                   jit=0.012):
    tri = 0
    for _ in range(n):
        x, y = area(rnd)
        s = rnd.uniform(*size)
        dims = (s * rnd.uniform(1.0, 1.7), s * rnd.uniform(0.7, 1.1),
                s * rnd.uniform(0.5, 0.8))
        e = 0.03
        gx = (H(x + e, y) - H(x - e, y)) / (2 * e)
        gy = (H(x, y + e) - H(x, y - e)) / (2 * e)
        tilt_x = math.atan(gy) * 0.8 + rnd.uniform(-0.3, 0.3)
        tilt_y = -math.atan(gx) * 0.8 + rnd.uniform(-0.3, 0.3)
        z = H(x, y) + dims[2] * (0.5 - sink)
        tri += M.block(g, M.placed((x, y, z), (tilt_x, tilt_y,
                                               rnd.uniform(0, math.pi))),
                       dims, M.pick(rnd, mats), rnd, c=0.03, jit=jit,
                       skip=("-z",))
    return tri


def broken_beam(g, a, b, w, h, rnd, mat=OAK2):
    """A timber beam from a to b with a splintered far end."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    ang_z = math.atan2(d.y, d.x)
    ang_y = -math.asin(max(-1, min(1, d.z / L)))
    Mx = M.placed((a + b) / 2, (0, ang_y, ang_z))
    seed = rnd.random() * 10

    def f(x, y, z):
        p = Vector((x, y, z))
        if x > L / 2 - 0.12:
            k = (x - (L / 2 - 0.12)) / 0.12
            p.x += 0.1 * k * noise.noise(Vector((y * 40 + seed, z * 40, 0)))
            p.x -= 0.08 * k * (0.5 + 0.5 * math.sin(y * 60 + z * 45 + seed))
        return Mx @ p
    return M.block(g, f, (L, w, h), mat, rnd, c=0.012, nx=4, uv="wood")


def torn(rnd, width, length, rate=0.18):
    holes = [(rnd.uniform(-width / 2, width / 2), rnd.uniform(0.2, 1.0) *
              length, rnd.uniform(0.05, 0.12)) for _ in range(4)]

    def f(x, y):
        edge = length * (0.62 + 0.3 * math.sin(x * 23.0 + 1.3) *
                         math.sin(x * 7.1))
        if y > edge:
            return True
        for hx, hy, hr in holes:
            if (x - hx) ** 2 + (y - hy) ** 2 < hr * hr:
                return True
        return False
    return f


def ruin_loop(g, loop, top, courses, rnd, mats, inner=0.36, p=0.032,
              rings=1, lengths=(0.3, 0.5), solids=None, crown=0.34):
    """What is left of a wall round a loop: stones up to a ragged top(u),
    a core with its inner face sunk below them, a rubble fill on top and
    loose stones along the broken crown."""
    tri = M.lay_loop(g, loop, courses, rnd, mats, p=p, c=0.02, rings=rings,
                     lengths=lengths, solids=solids, vary=(0.6, 1.4),
                     tilt=0.4, wobble=0.006,
                     keep=lambda u, v: v < top(u))
    us = []
    for i, u in enumerate(loop.vertex_us):
        e = loop.cum[i + 1]
        k = max(1, math.ceil((e - u) / 0.14))
        us += [u + (e - u) * j / k for j in range(k)]
    z0 = courses[0][0] - 0.02
    outer, inner_v = [], []
    for u in us:
        pt, n = loop.S(u, z0)
        t = max(z0 + 0.08, top(u) - 0.16 - 0.06 * abs(math.sin(u * 5.3)))
        pt_t, n_t = loop.S(u, t)
        n2 = Vector((n.x, n.y, 0)).normalized()
        cut = inner + 0.05 * math.sin(u * 13)
        outer.append((g.vert(pt), g.vert(pt_t)))
        ip = pt - n2 * inner
        it = pt_t - n2 * cut + Vector((0, 0, -0.08 * abs(math.sin(u * 7))))
        inner_v.append((g.vert(ip), g.vert(it)))
    m = len(us)
    for i in range(m):
        j = (i + 1) % m
        _, n = loop.S(us[i] + 0.001, z0)
        g.face([outer[i][0], outer[j][0], outer[j][1], outer[i][1]],
               [(0, 0), (0.2, 0), (0.2, 0.2), (0, 0.2)], MORTAR, n)
        g.face([inner_v[i][0], inner_v[j][0], inner_v[j][1], inner_v[i][1]],
               [(us[i] / 2, 0), (us[j] / 2, 0), (us[j] / 2, 0.3),
                (us[i] / 2, 0.3)], "stone:tower-dust-2", -n)
        g.face([outer[i][1], outer[j][1], inner_v[j][1], inner_v[i][1]],
               [(us[i] / 1.2, 0), (us[j] / 1.2, 0), (us[j] / 1.2, 0.3),
                (us[i] / 1.2, 0.3)], HEAP, Vector((0, 0, 1)))
    # loose stones lying on the broken crown
    u = rnd.uniform(0, 0.3)
    while u < loop.length:
        pt, n = loop.S(u, 0)
        n2 = Vector((n.x, n.y, 0)).normalized()
        c = pt - n2 * rnd.uniform(0.05, inner - 0.05)
        z = top(u) - 0.12
        sz = rnd.uniform(0.16, 0.3)
        tri += M.block(g, M.placed((c.x, c.y, z + sz * 0.2),
                                   (rnd.uniform(-0.5, 0.5),
                                    rnd.uniform(-0.5, 0.5),
                                    rnd.uniform(0, math.pi))),
                       (sz * rnd.uniform(1.0, 1.6), sz * 0.8, sz * 0.6),
                       M.pick(rnd, DUSTY), rnd, c=0.025, jit=0.01,
                       skip=("-z",))
        u += rnd.uniform(1.0 / crown, 1.6 / crown) * 0.35
    return tri


def pile(g, H, rnd, n, area, lift=(0.0, 0.0), size=(0.15, 0.36)):
    """Stones tumbled onto a heap: each lies on the surface H, turned to
    its slope, some lifted to lie on others."""
    def H2(x, y):
        return H(x, y) + rnd.uniform(*lift)
    return scatter_stones(g, H2, n, rnd, area, DUSTY, size=size, sink=0.25,
                          jit=0.012)


def king_rubble(name="king-rubble"):
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    loop = M.Loop(M.offset_poly(keep_outline(), 0.08))
    tri += M.lay_loop(g, loop, [(0.0, 0.24)], rnd, DUSTY + STONES, p=0.05,
                      c=0.024, lengths=(0.38, 0.62),
                      keep=lambda u, v: rnd.random() > 0.12)
    M.core_loop(g, loop, -0.02, 0.24, MORTAR, top=True)
    loop = M.Loop(M.offset_poly(keep_outline(), 0.04))

    def top(u):
        # a tall stub at the rear-left turret, a breach at the front
        pt, _ = loop.S(u, 0)
        h = 0.5 + 0.3 * noise.noise(Vector((u * 0.8, 1.3, 0.2))) + \
            0.14 * noise.noise(Vector((u * 2.9, 0.2, 0.7)))
        d = math.hypot(pt.x + 1.53, pt.y + 1.53)
        h += 1.45 * max(0.0, 1 - d / 1.05) ** 0.8
        d2 = math.hypot(pt.x - 1.53, pt.y + 1.53)
        h += 0.5 * max(0.0, 1 - d2 / 0.8)
        d3 = math.hypot(pt.x - 1.6, pt.y - 1.6)
        h += 0.35 * max(0.0, 1 - d3 / 0.7)
        if pt.y > 0.9 and abs(pt.x) < 1.0:
            h -= 0.3
        if pt.x < -1.2 and abs(pt.y) < 0.6:
            h -= 0.2
        return 0.24 + max(0.1, h)
    courses = M.course_heights(0.24, 2.3, rnd, 0.18, 0.25)
    tri += ruin_loop(g, loop, top, courses, rnd, DUSTY + STONES, inner=0.34)
    H = heap(g, 2.25, 1.3, rnd, centre=(0.05, 0.1), step=0.2, lump=0.2,
             seed=2.0)

    def area(rr):
        a = rr.uniform(0, math.tau)
        d = rr.uniform(0, 1.0) ** 0.7 * 2.15
        return 0.05 + math.cos(a) * d, 0.1 + math.sin(a) * d
    tri += pile(g, H, rnd, 60, area)
    tri += pile(g, H, rnd, 14, area, lift=(0.05, 0.14), size=(0.13, 0.26))

    def spill(rr):
        a = rr.uniform(0, math.tau)
        d = rr.uniform(2.0, 2.3)
        return math.cos(a) * d, math.sin(a) * d
    tri += scatter_stones(g, lambda x, y: 0.0, 9, rnd, spill, DUSTY,
                          size=(0.1, 0.22), sink=0.35)
    # broken timbers, a piece of slate roof, the fallen barrel
    tri += broken_beam(g, (-1.1, -0.4, 0.62), (0.8, 0.5, 1.25), 0.13, 0.12,
                       rnd)
    tri += broken_beam(g, (0.5, -1.2, 0.95), (1.45, 0.05, 0.3), 0.11, 0.1,
                       rnd, OAK)
    rx, ry = -0.45, 0.5
    rp = M.placed((rx, ry, H(rx, ry) + 0.08),
                  (math.radians(26), math.radians(-14), 0.7))
    tri += M.slate_plane(g, rp @ Vector((-0.34, -0.26, 0)),
                         rp @ Vector((0.34, -0.26, 0)),
                         rp @ Vector((0.3, 0.26, 0)),
                         rp @ Vector((-0.3, 0.26, 0)), 5, None,
                         rnd_for("roof"), rp.to_3x3() @ Vector((0, 0, 1)),
                         mats=SLATES)
    for i in range(8):
        x, y = rnd.uniform(-1.3, 1.3), rnd.uniform(-1.3, 1.3)
        tri += M.block(g, M.placed((x, y, H(x, y) + 0.02),
                                   (rnd.uniform(-0.4, 0.4),
                                    rnd.uniform(-0.4, 0.4),
                                    rnd.uniform(0, 3))),
                       (0.16, 0.1, 0.012), M.pick(rnd, SLATES), rnd,
                       c=0.003, uv="tile", tile=1.0)
    bar = kit.lathe("__barrel", [(0.0, -0.42), (0.04, -0.4), (0.03, -0.34),
                                 (0.13, -0.3), (0.126, -0.1), (0.12, 0.05),
                                 (0.11, 0.24), (0.092, 0.5), (0.108, 0.6),
                                 (0.11, 0.63), (0.05, 0.63), (0.046, 0.4),
                                 (0.0, 0.4)], segments=14, mat=BRONZE)
    bar.rotation_euler = (math.radians(-78), 0, math.radians(35))
    bx, by_ = 0.6, 1.2
    bar.location = (bx, by_, H(bx, by_) + 0.08)
    g.add(bar, uv="box-small")
    # the torn banner still hanging on the tall stub
    F = face_frame((-1.53, -TOUT - 0.075, 0), (0, -1, 0))
    bf = F @ Matrix.Translation((0, 1.78, 0.04))
    tri += M.cloth_sheet(g, bf, 0.66, 0.95, rnd, TEAM, GOLD, point=0.2,
                         cols=7, rows=10, border=0.04,
                         torn=torn(rnd, 0.66, 0.95), sway=0.03, lean=0.06,
                         emblem=M.crown_shape(0.05, 0.36, 0.2))
    pts = [tuple(bf @ Vector((x, 0.02, 0.0))) for x in (-0.4, 0.25)]
    rod = kit.tube("__rod", pts, 0.016, mat=IRON, segments=8)
    g.add(rod, uv="box-small")
    for i in range(10):
        a = rnd.uniform(0, math.tau)
        d = rnd.uniform(2.0, 2.45)
        tri += M.moss(g, (math.cos(a) * d, math.sin(a) * d, 0), (0, 0, 1),
                      rnd.uniform(0.07, 0.14), rnd.uniform(0.03, 0.05), rnd,
                      MOSS, k=6, squash=0.7)
    print("TRIS", name, M.tri_count(g))
    body = g.build(name + "-mesh", 50)
    root = kit.empty(name)
    kit.parent(body, root)
    return root, [body]


def princess_rubble(name="princess-rubble"):
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    loop = M.Loop(M.circle(1.44, 40), chamfer=0)
    tri += M.lay_loop(g, loop, [(0.0, 0.24)], rnd, DUSTY + STONES, p=0.05,
                      c=0.024, lengths=(0.4, 0.6),
                      keep=lambda u, v: rnd.random() > 0.12)
    M.core_loop(g, loop, -0.02, 0.24, MORTAR, top=True)
    loop = M.Loop(M.circle(1.36, 40), chamfer=0)

    def top(u):
        a = u / 1.36
        h = 0.45 + 0.28 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) *
                                               2, 0.4))) + \
            0.12 * noise.noise(Vector((u * 3.3, 0.5, 0.1)))
        # a tall shard at the back left, a breach at the front
        h += 1.2 * max(0.0, 1 - abs(((a - math.radians(215)) + math.pi) %
                                    math.tau - math.pi) / 0.65) ** 0.8
        h -= 0.3 * max(0.0, 1 - abs(((a - math.radians(70)) + math.pi) %
                                    math.tau - math.pi) / 0.6)
        return 0.24 + max(0.1, h)
    courses = M.course_heights(0.24, 2.0, rnd, 0.18, 0.24)
    tri += ruin_loop(g, loop, top, courses, rnd, DUSTY + STONES, inner=0.3)
    H = heap(g, 1.7, 1.0, rnd, centre=(0.05, 0.05), step=0.16, lump=0.16,
             seed=5.0)

    def area(rr):
        a = rr.uniform(0, math.tau)
        d = rr.uniform(0, 1.0) ** 0.7 * 1.6
        return math.cos(a) * d, math.sin(a) * d
    tri += pile(g, H, rnd, 40, area, size=(0.14, 0.3))
    tri += pile(g, H, rnd, 14, area, lift=(0.05, 0.12), size=(0.12, 0.22))

    def spill(rr):
        a = rr.uniform(0, math.tau)
        d = rr.uniform(1.5, 1.72)
        return math.cos(a) * d, math.sin(a) * d
    tri += scatter_stones(g, lambda x, y: 0.0, 9, rnd, spill, DUSTY,
                          size=(0.1, 0.2), sink=0.35)
    tri += broken_beam(g, (-0.8, 0.4, 0.8), (0.75, -0.2, 0.5), 0.12, 0.11,
                       rnd)
    # the snapped pennant pole and its torn pennant across the heap
    pole = kit.cylinder("__pole", 0.03, 0.026, 1.1, verts=10, mat=IRON)
    pole.rotation_euler = (0, math.radians(76), math.radians(-25))
    pole.location = (-0.9, 0.55, H(-0.9, 0.55) + 0.05)
    g.add(pole, uv="box-small")
    pf = Matrix.Identity(4)
    fly = Vector((0.9, -0.42, -0.08)).normalized()
    upv = Vector((0.1, 0.25, 1)).normalized()
    side = fly.cross(upv).normalized()
    upv = side.cross(fly)
    for i in range(3):
        pf[i][0], pf[i][1], pf[i][2] = fly[i], upv[i], side[i]
    pf.translation = Vector((-0.3, 0.3, H(-0.3, 0.3) + 0.16))
    tri += pennant(g, pf, 0.7, 0.32, rnd,
                   torn=lambda s, t: (s > 0.55 and (t * 7 + s * 11) % 1.6 <
                                      0.5) or s > 0.85)
    # a torn banner on the tall shard
    a = math.radians(215)
    F = face_frame((math.cos(a) * 1.4, math.sin(a) * 1.4, 0),
                   (math.cos(a), math.sin(a), 0))
    bf = F @ Matrix.Translation((0, 1.5, 0.03))
    tri += M.cloth_sheet(g, bf, 0.42, 0.62, rnd, TEAM, GOLD, point=0.16,
                         cols=6, rows=9, border=0.03,
                         torn=torn(rnd, 0.42, 0.62), sway=0.02, lean=0.04,
                         emblem=M.star_shape(0.0, 0.25, 0.09))
    for i in range(12):
        a = rnd.uniform(0, math.tau)
        d = rnd.uniform(1.5, 1.85)
        tri += M.moss(g, (math.cos(a) * d, math.sin(a) * d, 0), (0, 0, 1),
                      rnd.uniform(0.07, 0.13), rnd.uniform(0.03, 0.05), rnd,
                      MOSS, k=6, squash=0.7)
    print("TRIS", name, M.tri_count(g))
    body = g.build(name + "-mesh", 50)
    root = kit.empty(name)
    kit.parent(body, root)
    return root, [body]


# ---------------------------------------------------------------- bridges

SPAN = 1.95
SINK = 0.3     # the game drops the bridges this far; world 0 is z 0.3 here


def ground_z(y):
    """The field under a bridge, in bridge coordinates."""
    return SINK + M.river_ground(abs(y))


def curved_surface(x_face, normal_x, top_off=0.0):
    """A bridge side face at x = x_face whose courses follow the deck: u
    along y, v down from the deck line."""
    n = Vector((normal_x, 0, 0))

    def S(u, v):
        return Vector((x_face, u, M.deck_top(u) - top_off - v)), n
    return S


def arch_inside(R, zc, half, spring):
    def inside(y, z):
        if abs(y) < half and z < spring:
            return True
        return y * y + (z - zc) ** 2 < R * R and z >= spring - 0.001
    return inside


class PredSolid:
    def __init__(self, fn, round_=False):
        self.fn, self.round = fn, round_

    def hit(self, p):
        return self.fn(p)


def bridge_face(g, x_face, sx, rnd, top_off, below, extra=None, p=0.03,
                lengths=(0.3, 0.5)):
    """Stone courses on one side face of a bridge, following the deck,
    down to the ground or to `below(y)`."""
    S = curved_surface(x_face, sx, top_off)
    sol = M.Solids()
    sol.add(PredSolid(lambda q: q.z < below(q.y), False))
    if extra:
        for e in extra:
            sol.add(e)
    vmax = M.deck_top(0) - top_off + 0.5
    courses = M.course_heights(0.0, vmax, rnd, 0.17, 0.23)
    return M.lay_courses(g, S, -SPAN, SPAN, courses, rnd, STONES,
                         solids=sol, p=p, c=0.02, lengths=lengths)


def face_core(g, x_face, sx, top_fn, bottom_fn, y0=-SPAN, y1=SPAN, step=0.1,
              mat=MORTAR, splits=()):
    """A flat core on a bridge's side between bottom_fn(y) and top_fn(y)."""
    ys = [y0 + (y1 - y0) * i / max(1, int((y1 - y0) / step))
          for i in range(max(1, int((y1 - y0) / step)) + 1)]
    ys = sorted(set(ys + [s for s in splits if y0 < s < y1]))
    for a, b in zip(ys, ys[1:]):
        ba, bb = bottom_fn(a + 1e-4), bottom_fn(b - 1e-4)
        ta, tb = top_fn(a), top_fn(b)
        if ta - ba < 0.005 and tb - bb < 0.005:
            continue
        g.poly([(x_face, a, ba), (x_face, b, bb), (x_face, b, tb),
                (x_face, a, ta)], [(a / 2, ba / 2), (b / 2, bb / 2),
                                   (b / 2, tb / 2), (a / 2, ta / 2)], mat,
               out=(sx, 0, 0))


def deck_map(yc, xc=0.0, zoff=0.0):
    """Blocks lying on the deck: local x across (world x), y along the
    bridge, z up from the deck line."""
    def f(x, y, z):
        yy = yc + y
        n = Vector((0, M.deck_slope(yy), 1)).normalized()
        n = Vector((0, -M.deck_slope(yy), 1)).normalized()
        base = Vector((xc + x, yy, M.deck_top(yy) + zoff))
        return base + n * z
    return f


def along_map(x0, y0, zoff):
    """Blocks bent along the bridge: local x along y (from y0), local y
    across (world x from x0), local z up from the deck line + zoff."""
    def f(x, y, z):
        yy = y0 + x
        n = Vector((0, -M.deck_slope(yy), 1)).normalized()
        return Vector((x0 + y, yy, M.deck_top(yy) + zoff)) + n * z
    return f


def setts(g, x0, x1, y0, y1, rnd, mats, top=M.deck_top, row=(0.1, 0.16)):
    """Cobbled setts whose tops lie exactly on the deck line."""
    tri = 0
    rows = M.course_heights(y0, y1, rnd, *row)
    prev = []
    for (a, b) in rows:
        js = M._split(x0, x1, (0.11, 0.24), rnd, [], [], prev, gap=0.035,
                      min_len=0.09)
        for s0, s1 in zip(js, js[1:]):
            ya, yb = a + 0.005, b - 0.005
            xa, xb = s0 + 0.005, s1 - 0.005
            p = 0.017
            low = rnd.uniform(0.0, 0.003)

            def S(u, v, p=p, low=low):
                n = Vector((0, -M.deck_slope(v), 1)).normalized()
                return Vector((u, v, top(v) - low)) - n * p, n
            tri += M.facing_stone(g, S, (xa, xb), (xa, xb), ya, yb,
                                  M.pick(rnd, mats), rnd, p=p, c=0.02,
                                  tilt=0.0, jit=0.0, sink=0.002,
                                  vary=(1.0, 1.0), wobble=0.022)
        prev = js[1:-1]
    return tri


def deck_core(g, x0, x1, y0, y1, drop, mat=MORTAR, step=0.2):
    ys = [y0 + (y1 - y0) * i / int((y1 - y0) / step)
          for i in range(int((y1 - y0) / step) + 1)]
    for a, b in zip(ys, ys[1:]):
        g.poly([(x0, a, M.deck_top(a) - drop), (x1, a, M.deck_top(a) - drop),
                (x1, b, M.deck_top(b) - drop), (x0, b, M.deck_top(b) - drop)],
               [(x0, a), (x1, a), (x1, b), (x0, b)], mat, out=(0, 0, 1))


def bridge(name="bridge"):
    """The old stone arch: a segmental arch over the water, cobbled deck,
    low parapets with coping and end posts, buttresses on the banks."""
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    W, WI = 1.2, 1.0
    half = 1.0                       # the arch springs at the banks
    spring = 0.03
    crown = 0.4
    R = (half * half + (crown - spring) ** 2) / (2 * (crown - spring))
    zc = crown - R
    ring = 0.16
    th0 = math.asin(half / R)
    inside = arch_inside(R, zc, half, spring)
    ring_in = arch_inside(R + ring + 0.015, zc, half, spring)
    top_off = 0.02
    # deck
    tri += setts(g, -WI, WI, -SPAN, SPAN, rnd, STONES)
    deck_core(g, -WI - 0.01, WI + 0.01, -SPAN, SPAN, 0.017, mat=HEAP)
    # approach ramps down to the field
    for sy in (-1, 1):
        def ramp(v, sy=sy):
            t = (abs(v) - SPAN) / 0.3
            return M.deck_top(sy * SPAN) - 0.1 * min(1, max(0, t))
        y0, y1 = sorted((sy * SPAN, sy * (SPAN + 0.3)))
        rows = M.course_heights(y0, y1, rnd, 0.13, 0.17)
        for (a, b) in rows:
            js = M._split(-WI - 0.1, WI + 0.1, (0.18, 0.3), rnd, [], [], [])
            for s0, s1 in zip(js, js[1:]):
                def S(u, v):
                    return Vector((u, v, ramp(v) - 0.022)), Vector((0, 0, 1))
                tri += M.facing_stone(g, S, (s0 + 0.006, s1 - 0.006),
                                      (s0 + 0.006, s1 - 0.006), a + 0.006,
                                      b - 0.006, M.pick(rnd, STONES), rnd,
                                      p=0.024, c=0.016, tilt=0.0, jit=0.0)
        g.poly([(-WI - 0.12, y0, SINK - 0.04), (WI + 0.12, y0, SINK - 0.04),
                (WI + 0.12, y1, SINK - 0.04), (-WI - 0.12, y1, SINK - 0.04)],
               [(0, 0), (1, 0), (1, 1), (0, 1)], MORTAR, out=(0, 0, 1))
    # side faces: courses following the deck, round the arch
    for sx in (-1, 1):
        xf = sx * W
        extra = [PredSolid(lambda q: ring_in(q.y, q.z), True),
                 PredSolid(lambda q: 0.99 < abs(q.y) < 1.41 and
                           q.z < M.deck_top(1.2) - 0.14)]
        tri += bridge_face(g, xf, sx, rnd, top_off,
                           lambda y: ground_z(y) - 0.04, extra)

        def bottom(y):
            if abs(y) < half:
                return zc + math.sqrt(max(0, R * R - y * y))
            return max(-0.45, ground_z(y) - 0.06)
        face_core(g, xf, sx, lambda y: M.deck_top(y) - top_off, bottom,
                  splits=(-half, half))
        # voussoirs
        S = M.plane_surface((xf, 0, 0), (sx, 0, 0))
        a0 = math.pi / 2 + th0

        def P(s, t, sx=sx):
            a = a0 - s / R
            y = (R + t) * math.cos(a)
            u = y * sx          # plane u runs along +y on the +x face
            return S(u, zc + (R + t) * math.sin(a))
        arc = R * 2 * th0
        nv = 15
        for i in range(nv):
            s0, s1 = arc * i / nv + 0.006, arc * (i + 1) / nv - 0.006
            key = i == nv // 2
            tri += M.facing_stone(g, P, (s0, s1), (s0, s1), 0.0,
                                  ring + (0.05 if key else 0.0),
                                  M.pick(rnd, STONES), rnd,
                                  p=0.055 if key else 0.045, c=0.018,
                                  squeeze=0.5)
    # the barrel of the arch
    a0 = math.pi / 2 + th0
    arc = R * 2 * th0

    def Sb(u, v):
        a = a0 - v / R
        pt = Vector((u, R * math.cos(a), zc + R * math.sin(a)))
        n = -Vector((0, math.cos(a), math.sin(a)))
        return pt, n
    nv = 15
    bc = [(arc * i / nv, arc * (i + 1) / nv) for i in range(nv)]
    tri += M.lay_courses(g, Sb, -W, W, bc, rnd, STONES, p=0.018, c=0.014,
                         lengths=(0.35, 0.6))
    k = 24
    for i in range(k):
        v0, v1 = arc * i / k, arc * (i + 1) / k
        pa, pb = Sb(-W, v0)[0], Sb(W, v0)[0]
        pc, pd = Sb(W, v1)[0], Sb(-W, v1)[0]
        g.poly([pa, pb, pc, pd], [(0, v0), (1, v0), (1, v1), (0, v1)], MORTAR,
               out=Sb(0, (v0 + v1) / 2)[1])
    # abutment faces under the springing, facing the water
    for sy in (-1, 1):
        g.poly([(-W, sy * half, -0.45), (W, sy * half, -0.45),
                (W, sy * half, spring), (-W, sy * half, spring)],
               [(0, 0), (1, 0), (1, 0.2), (0, 0.2)], MORTAR, out=(0, -sy, 0))
    # buttresses on the banks, reaching the embankments
    for sx in (-1, 1):
        for sy in (-1, 1):
            yb0, yb1 = sorted((sy * 0.98, sy * 1.42))
            xb0, xb1 = sorted((sx * (W - 0.02), sx * 1.33))
            zt = M.deck_top(sy * 1.2) - 0.2
            zs = M.course_heights(-0.3, zt, rnd, 0.17, 0.22)
            for (z0, z1) in zs:
                if z1 < ground_z(sy * 1.42) - 0.1 and \
                        z1 < ground_z(sy * 0.98) - 0.25:
                    continue
                tri += M.block(g, M.placed(((xb0 + xb1) / 2,
                                            (yb0 + yb1) / 2, (z0 + z1) / 2),
                                           (0, 0, rnd.uniform(-0.01, 0.01))),
                               (xb1 - xb0, yb1 - yb0 - rnd.uniform(0, 0.03),
                                z1 - z0 - 0.012), M.pick(rnd, STONES), rnd,
                               c=0.022, jit=0.003, skip=("-z",))
            # a sloped cap
            tri += M.block(g, M.placed(((xb0 + xb1) / 2, (yb0 + yb1) / 2,
                                        zt + 0.05),
                                       (sy * math.radians(-4), 0, 0)),
                           (xb1 - xb0 + 0.04, yb1 - yb0 + 0.04, 0.1),
                           M.pick(rnd, STONES), rnd, c=0.03, jit=0.003,
                           skip=("-z",))
    # parapets: two courses and a coping, bent along the deck
    for sx in (-1, 1):
        xc = sx * (W + WI) / 2
        tp = W - WI
        zo = -top_off
        for ci, (h, thk) in enumerate(((0.13, tp), (0.12, tp - 0.01),
                                       (0.075, tp + 0.05))):
            y0, y1 = -SPAN + 0.3, SPAN - 0.3
            js = M._split(y0, y1, (0.24, 0.42) if ci < 2 else (0.32, 0.5),
                          rnd, [0.0] if ci == 2 else [], [], [])
            for a, b in zip(js, js[1:]):
                L = b - a - 0.012
                f0 = along_map(xc, (a + b) / 2, zo + h / 2)
                tri += M.block(g, f0, (L, thk, h - 0.01),
                               M.pick(rnd, STONES), rnd, c=0.016 if ci < 2
                               else 0.02, nx=1, jit=0.004, skip=("-z",))
            zo += h
        # end and middle posts
        for yp, hgt, wd in ((-SPAN + 0.15, 0.56, 0.3), (SPAN - 0.15, 0.56,
                                                         0.3)):
            zb = M.deck_top(yp) - top_off
            for ci, (z0, z1) in enumerate(((0, 0.2), (0.2, 0.4),
                                           (0.4, hgt - 0.06))):
                tri += M.block(g, M.placed((xc + sx * 0.03, yp,
                                            zb + (z0 + z1) / 2),
                                           (0, 0, rnd.uniform(-0.03, 0.03))),
                               (wd - 0.01 * ci, wd - 0.01 * ci, z1 - z0 -
                                0.012), M.pick(rnd, STONES), rnd, c=0.022,
                               jit=0.003, skip=("-z",))
            capz = zb + hgt - 0.06

            def fcap(x, y, z, cx=xc + sx * 0.03, cy=yp, cz=capz):
                t = (z + 0.06) / 0.12
                s = 1.08 - 0.62 * t
                return Vector((cx + x * s, cy + y * s, cz + 0.06 + z))
            tri += M.block(g, fcap, (wd, wd, 0.12), M.pick(rnd, STONES), rnd,
                           c=0.02, skip=("-z",))
    # moss in the corners where the bridge meets the field
    for sx in (-1, 1):
        for sy in (-1, 1):
            for i in range(3):
                x = sx * rnd.uniform(1.25, 1.45)
                y = sy * rnd.uniform(1.45, 1.95)
                tri += M.moss(g, (x, y, SINK), (0, 0, 1),
                              rnd.uniform(0.07, 0.13), 0.04, rnd, MOSS, k=6,
                              squash=0.8)
            tri += M.moss(g, (sx * 1.02, sy * rnd.uniform(0.4, 1.4),
                              M.deck_top(sy * 0.9) - 0.01), (0, 0, 1), 0.05,
                          0.02, rnd, MOSS, k=5, squash=0.5,
                          along=(0, 1, 0))
    body = g.build(name + "-mesh", 50)
    root = kit.empty(name)
    kit.parent(body, root)
    return root, [body]


def bridge_b(name="bridge-b"):
    """A timber bridge on stone footings: masonry abutments and a
    cutwater pier, oak stringers, a plank deck and railings."""
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    plank_t, str_h = 0.045, 0.15
    str_top = -plank_t
    # abutments: masonry from the channel up to the stringers
    for sy in (-1, 1):
        ya, yb = sorted((sy * 0.95, sy * (SPAN + 0.05)))
        # river face
        F = face_frame((0, sy * 0.95, 0), (0, -sy, 0))
        S = M.plane_surface(F.translation, (0, -sy, 0))
        top_face = M.deck_top(sy * 0.95) - plank_t - str_h
        sol = M.Solids()
        tri += M.lay_courses(g, S, -1.28, 1.28,
                             M.course_heights(-0.45, top_face, rnd, 0.17,
                                              0.23), rnd, STONES, p=0.032,
                             c=0.02, lengths=(0.3, 0.5))
        g.poly([on_face(F, -1.28, 0, -0.45), on_face(F, 1.28, 0, -0.45),
                on_face(F, 1.28, 0, top_face), on_face(F, -1.28, 0, top_face)],
               [(0, 0), (1, 0), (1, 1), (0, 1)], MORTAR, out=(0, -sy, 0))
        # side faces, courses following the deck
        for sx in (-1, 1):
            S2 = curved_surface(sx * 1.28, sx, plank_t + str_h)
            sol = M.Solids()
            sol.add(PredSolid(lambda q, ya=ya, yb=yb: q.y < ya + 0.005 or
                              q.y > yb - 0.005 or q.z < ground_z(q.y) - 0.05))
            cs = M.course_heights(0.0, 1.2, rnd, 0.17, 0.23)
            tri += M.lay_courses(g, S2, ya, yb, cs, rnd, STONES, solids=sol,
                                 p=0.032, c=0.02, lengths=(0.3, 0.5),
                                 corners=())
            face_core(g, sx * 1.28, sx,
                      lambda y: M.deck_top(y) - plank_t - str_h,
                      lambda y: max(-0.45, ground_z(y) - 0.08), ya, yb)
        # the abutment's top, under the stringers
        ys = [ya + (yb - ya) * i / 8 for i in range(9)]
        for a, b in zip(ys, ys[1:]):
            za = M.deck_top(a) - plank_t - str_h
            zb = M.deck_top(b) - plank_t - str_h
            g.poly([(-1.28, a, za), (1.28, a, za), (1.28, b, zb),
                    (-1.28, b, zb)], [(0, a), (1, a), (1, b), (0, b)],
                   MORTAR, out=(0, 0, 1))
    # the pier
    pier = [(1.5, 0.0), (1.12, 0.21), (-1.12, 0.21), (-1.5, 0.0),
            (-1.12, -0.21), (1.12, -0.21)]
    pl = M.Loop(pier)
    cap_z = M.deck_top(0) - plank_t - str_h - 0.14
    pc = M.course_heights(-0.45, cap_z, rnd, 0.17, 0.22)
    tri += M.lay_loop(g, pl, pc, rnd, STONES, p=0.032, c=0.02,
                      lengths=(0.28, 0.46), quoin=(0.26, 0.15))
    M.core_loop(g, pl, -0.45, cap_z, MORTAR, top=True)
    for i in range(4):
        x = rnd.uniform(-1.0, 1.0)
        tri += M.moss(g, (x, rnd.choice((-0.23, 0.23)), 0.02), (0, 0, 1),
                      rnd.uniform(0.05, 0.09), 0.02, rnd, MOSS, k=5,
                      squash=0.6, along=(1, 0, 0))
    # cap beam on the pier
    tri += M.block(g, M.placed((0, 0, cap_z + 0.07)), (2.9, 0.26, 0.14),
                   OAK2, rnd, c=0.012, uv="wood", skip=("-z",))
    # stringers, bent along the deck
    for x in (-1.1, -0.42, 0.42, 1.1):
        f = along_map(x, 0.0, str_top - str_h / 2)
        tri += M.block(g, f, (2 * SPAN + 0.1, 0.12, str_h), OAK2, rnd,
                       c=0.012, nx=14, uv="wood", grain=1.6)
        for yy in (-0.12, 0.12):
            # iron straps where the stringers bear on the cap beam
            fb = along_map(x, yy, str_top - str_h / 2)
            tri += M.block(g, fb, (0.03, 0.135, str_h + 0.012), IRON, rnd,
                           c=0.004, uv="tile", tile=0.25)
    # planks, tops exactly on the deck line
    y = -SPAN
    k = 0
    while y < SPAN - 0.02:
        w = min(0.17 + rnd.uniform(-0.01, 0.015), SPAN - y)
        yc = y + w / 2
        L = 2.36 - rnd.uniform(0, 0.06)
        xo = rnd.uniform(-0.02, 0.02)

        def f(x, yy, z, yc=yc, xo=xo):
            y2 = yc + yy
            n = Vector((0, -M.deck_slope(y2), 1)).normalized()
            return Vector((xo + x, y2, M.deck_top(y2))) + n * (
                z - plank_t / 2)
        tri += M.block(g, f, (L, w - 0.013, plank_t), OAK if k % 3 else OAK2,
                       rnd, c=0.007, uv="wood", grain=1.3, skip=("-z",))
        for sx in (-1.1, -0.42, 0.42, 1.1):
            for dy in (-0.045, 0.045):
                p = Vector((sx + xo * 0, yc + dy, M.deck_top(yc + dy)))
                tri += stud(g, p, (0, -M.deck_slope(yc), 1), r=0.009,
                            h=0.004)
        y += w
        k += 1
    # kerbs, posts, rails and braces
    posts = [-1.8, -0.9, 0.0, 0.9, 1.8]
    for sx in (-1, 1):
        f = along_map(sx * 1.06, 0.0, 0.035)
        tri += M.block(g, f, (2 * SPAN - 0.1, 0.07, 0.07), OAK2, rnd,
                       c=0.01, nx=10, uv="wood")
        for yp in posts:
            zb = M.deck_top(yp)
            tri += M.block(g, M.placed((sx * 1.1, yp, zb + 0.28)),
                           (0.09, 0.09, 0.66), OAK2, rnd, c=0.012, uv="wood",
                           grain=0.9)
            tri += M.block(g, lambda x, y, z, cx=sx * 1.1, cy=yp,
                           cz=zb + 0.64: Vector((cx + x * (1 - 0.5 * (z + 0.03)
                                                            / 0.06),
                                                 cy + y * (1 - 0.5 * (
                                                     z + 0.03) / 0.06),
                                                 cz + z)),
                           (0.11, 0.11, 0.06), OAK2, rnd, c=0.01, uv="wood")
            for side in (-1, 1):
                tri += stud(g, (sx * 1.1 + sx * 0.046, yp + side * 0.02,
                                zb - 0.07), (sx, 0, 0), r=0.011, h=0.006)
        for zo, hh, ww in ((0.57, 0.07, 0.1), (0.33, 0.055, 0.06)):
            f = along_map(sx * 1.1, 0.0, zo)
            tri += M.block(g, f, (2 * 1.8 + 0.1, ww, hh),
                           OAK if zo > 0.5 else OAK2, rnd, c=0.012, nx=12,
                           uv="wood", grain=1.6)
        for a, b in zip(posts, posts[1:]):
            ya, yb = a + 0.06, b - 0.06
            za, zb2 = M.deck_top(ya) + 0.08, M.deck_top(yb) + 0.3
            pa = Vector((sx * 1.16, ya, za))
            pb = Vector((sx * 1.16, yb, zb2))
            d = pb - pa
            ang = math.atan2(d.z, d.y)
            m4 = Matrix.Translation((pa + pb) / 2) @ \
                Matrix.Rotation(ang, 4, "X") @ Matrix.Rotation(math.pi / 2,
                                                                4, "Z")
            tri += M.block(g, m4, (d.length, 0.05, 0.05), OAK2, rnd, c=0.008,
                           uv="wood")
    # the ends meet the field: low stone thresholds
    for sy in (-1, 1):
        js = M._split(-1.25, 1.25, (0.28, 0.45), rnd, [], [], [])
        for a, b in zip(js, js[1:]):
            yc = sy * (SPAN + 0.14)
            tri += M.block(g, M.placed(((a + b) / 2, yc, SINK + 0.03),
                                       (sy * math.radians(-8), 0, 0)),
                           (b - a - 0.012, 0.26, 0.12), M.pick(rnd, STONES),
                           rnd, c=0.024, jit=0.004, skip=("-z",))
    for sx in (-1, 1):
        for sy in (-1, 1):
            for i in range(3):
                tri += M.moss(g, (sx * rnd.uniform(1.3, 1.5),
                                  sy * rnd.uniform(1.4, 1.95), SINK),
                              (0, 0, 1), rnd.uniform(0.07, 0.12), 0.04, rnd,
                              MOSS, k=6, squash=0.8)
    body = g.build(name + "-mesh", 50)
    root = kit.empty(name)
    kit.parent(body, root)
    return root, [body]


# ---------------------------------------------------------------- river

RIVER_X = 10.3
BANK = (1.0, 1.35)
GAPS = [(-10.3, -6.8), (-4.2, 4.2), (6.8, 10.3)]


def river(name="river"):
    """The channel's stone embankments: a mossy coping over two courses of
    facing stones on the water side, along both banks, open where the
    bridges stand."""
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    z_top, z_cap = 0.12, -0.03
    for sy in (-1, 1):
        yi, yo = sy * BANK[0], sy * BANK[1]
        F = face_frame((0, yi, 0), (0, -sy, 0))
        S = M.plane_surface(F.translation, (0, -sy, 0))
        for x0, x1 in GAPS:
            u0, u1 = sorted((on_face_u(F, x0), on_face_u(F, x1)))
            tri += M.lay_courses(g, S, u0, u1, [(-0.42, -0.23),
                                                (-0.23, z_cap)], rnd,
                                 STONES, p=0.03, c=0.02,
                                 lengths=(0.32, 0.5))
            g.poly([(x0, yi, -0.44), (x1, yi, -0.44), (x1, yi, z_cap),
                    (x0, yi, z_cap)], [(x0, 0), (x1, 0), (x1, 0.3),
                                       (x0, 0.3)], MORTAR, out=(0, -sy, 0))
            js = M._split(x0, x1, (0.26, 0.6), rnd, [], [], [])
            for a, b in zip(js, js[1:]):
                h = z_top - z_cap + rnd.uniform(-0.02, 0.01)
                yc = (yi + yo) / 2 - sy * rnd.uniform(0.0, 0.03)
                tri += M.block(g, M.placed(((a + b) / 2, yc, z_cap + h / 2),
                                           (rnd.uniform(-0.035, 0.035),
                                            rnd.uniform(-0.025, 0.025),
                                            rnd.uniform(-0.03, 0.03))),
                               (b - a - 0.012, abs(yo - yi) +
                                rnd.uniform(0.0, 0.05), h),
                               M.pick(rnd, STONES), rnd, c=0.022, jit=0.007,
                               skip=("-z",))
                # moss along the landward edge and in some joints
                pass
                if rnd.random() < 0.35:
                    tri += M.moss(g, (b, (yi + yo) / 2, z_top - 0.01),
                                  (0, 0, 1), 0.05, 0.018, rnd, MOSS, k=5,
                                  squash=1.6, along=(1, 0, 0))
            # moss creeping over the landward edge
            x = x0 + rnd.uniform(0.0, 0.3)
            while x < x1 - 0.2:
                e = min(x1 - 0.05, x + rnd.uniform(0.4, 1.4))
                tri += kerb_moss(g, x, e, yo, sy, z_top, rnd)
                x = e + rnd.uniform(0.15, 0.7)
            # ends
            for xe, sgn in ((x0, -1), (x1, 1)):
                g.poly([(xe, yi, -0.44), (xe, yo, -0.44), (xe, yo, z_cap),
                        (xe, yi, z_cap)], [(0, 0), (0.2, 0), (0.2, 0.3),
                                           (0, 0.3)], MORTAR,
                       out=(sgn, 0, 0))
    body = g.build(name + "-mesh", 50)
    root = kit.empty(name)
    kit.parent(body, root)
    return root, [body]


def kerb_moss(g, x0, x1, yo, sy, z_top, rnd, seg=0.09):
    """A ragged ribbon of moss from a kerb's top down its back to the
    field."""
    n = max(2, int((x1 - x0) / seg))
    ph = rnd.uniform(0, 50)
    rows = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        t = max(0.0, math.sin(math.pi * i / n)) ** 0.5
        w = 0.05 + 0.05 * noise.noise(Vector((x * 7 + ph, 1, 0)))
        h = 0.03 * t * (0.6 + 0.4 * noise.noise(Vector((x * 11 + ph, 3, 0))))
        rows.append([g.vert((x, yo - sy * (0.04 + w) * t, z_top - 0.01)),
                     g.vert((x, yo - sy * 0.01, z_top + h)),
                     g.vert((x, yo + sy * 0.035, z_top - 0.06 + h * 0.5)),
                     g.vert((x, yo + sy * (0.07 + w * 1.3) * t, -0.03))])
    tri = 0
    for i in range(n):
        for j in range(3):
            q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1],
                 rows[i][j + 1]]
            g.face(q, [(v.co.x / 0.6, v.co.y / 0.6) for v in q], MOSS,
                   (0, 0, 1))
            tri += 2
    return tri


def on_face_u(F, x):
    """The across coordinate of world x on a face frame whose across axis
    is ±x."""
    return x * F[0][0]


# ---------------------------------------------------------------- wall

def wall(name="wall"):
    """One 2-unit run of low dry-stone wall along x: two courses of big
    irregular field stones, a cope of stones set on edge, moss along the
    top. Courses step past its ends so runs laid end to end interlock."""
    rnd = rnd_for(name)
    g = M.Geo()
    tri = 0
    mats = [("stone:tower-stone", 3), ("stone:tower-stone-warm", 2),
            ("stone:tower-stone-cool", 2)]
    courses = [(0.0, 0.25, 0.25, -1.06, 0.94, 4),
               (0.25, 0.43, 0.225, -0.95, 1.05, 5)]
    for ci, (z0, z1, hy, x0, x1, n) in enumerate(courses):
        cuts = [x0 + (x1 - x0) * i / n for i in range(n + 1)]
        cuts = [cuts[0]] + [c + rnd.uniform(-0.08, 0.08)
                            for c in cuts[1:-1]] + [cuts[-1]]
        for a, b in zip(cuts, cuts[1:]):
            h = (z1 - z0) * rnd.uniform(0.86, 1.06)
            tri += M.block(g, M.placed(((a + b) / 2, rnd.uniform(-0.02,
                                                                 0.02),
                                        z0 + h / 2 - 0.006),
                                       (rnd.uniform(-0.06, 0.06),
                                        rnd.uniform(-0.05, 0.05),
                                        rnd.uniform(-0.05, 0.05))),
                           (b - a - 0.02, 2 * hy * rnd.uniform(0.88, 1.0),
                            h), M.pick(rnd, mats), rnd, c=0.05, jit=0.026,
                           skip=("-z",))
    # the cope: rounded stones set on edge, leaning a little
    x0, x1, n = -1.03, 0.97, 7
    cuts = [x0 + (x1 - x0) * i / n for i in range(n + 1)]
    cuts = [cuts[0]] + [c + rnd.uniform(-0.04, 0.04)
                        for c in cuts[1:-1]] + [cuts[-1]]
    tops = []
    for a, b in zip(cuts, cuts[1:]):
        h = rnd.uniform(0.1, 0.14)
        lean = rnd.uniform(-0.18, 0.18)
        tri += M.block(g, M.placed(((a + b) / 2, rnd.uniform(-0.015, 0.015),
                                    0.43 + h / 2 - 0.01),
                                   (rnd.uniform(-0.06, 0.06), lean,
                                    rnd.uniform(-0.06, 0.06))),
                       (b - a - 0.012, rnd.uniform(0.34, 0.4), h),
                       M.pick(rnd, mats), rnd, c=0.045, jit=0.02,
                       skip=("-z",))
        tops.append((a, b, 0.43 + h - 0.012))

    def ztop(x):
        for a, b, t in tops:
            if a <= x <= b:
                return t
        return 0.53
    tri += M.moss_strip(g, -1.0, 1.0, ztop, lambda x: 0.02 * math.sin(x * 3),
                        lambda x: 0.12 + 0.07 * (0.5 + 0.5 * math.sin(
                            x * 4.1 + 1.0)), rnd, MOSS, height=0.035,
                        seg=0.085, ends=0.14)
    for i in range(2):
        x = rnd.uniform(-0.8, 0.8)
        sy = (-1, 1)[i]
        tri += M.moss(g, (x, sy * 0.25, 0.02), (0, sy, 0.4),
                      rnd.uniform(0.07, 0.1), 0.03, rnd, MOSS, k=5,
                      squash=0.8, along=(1, 0, 0))
    body = g.build(name + "-mesh", 50)
    root = kit.empty(name)
    kit.parent(body, root)
    return root, [body]


# ---------------------------------------------------------------- meteor

def meteor(name="meteor", radius=0.6):
    """A craggy dark stone about 1.2 across: crust plates split by a
    network of thin cracks whose faces glow molten. Origin at its
    centre."""
    rnd = random.Random(42)
    seeds = []
    for i in range(15):
        v = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
        seeds.append(v.normalized())
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
    o1, o2 = Vector((3.1, 7.7, 1.9)), Vector((8.2, 1.3, 5.5))
    crack = {}
    for v in bm.verts:
        p = v.co.normalized()
        # warp the cells a little so the cracks wander
        q = (p + Vector((noise.noise(p * 3 + o1), noise.noise(p * 3 + o2),
                         noise.noise(p * 3 - o1))) * 0.12).normalized()
        ds = sorted(math.acos(max(-1, min(1, q.dot(s_)))) for s_ in seeds)
        gap = ds[1] - ds[0]
        k = max(0.0, 1 - gap / 0.085)
        k = k * k * (3 - 2 * k)
        crack[v.index] = k
        base = 1 + 0.07 * noise.noise(p * 1.4 + o2) + \
            0.04 * noise.noise(p * 3.3) + 0.02 * noise.noise(p * 7.5) + \
            0.01 * noise.noise(p * 16.0)
        # each plate bulges a little away from its cracks
        base += 0.05 * min(1.0, gap / 0.35)
        v.co = p * (base - 0.2 * k)
    bmesh.ops.scale(bm, vec=Vector((1.1, 0.96, 0.88)) * radius,
                    verts=bm.verts)
    # the crust dips below a molten core along the cracks, so each crack's
    # glowing edge is where the two surfaces meet
    crust = kit._from_bmesh(name + "-crust", bm, CRUST)
    kit.uv_box(crust)
    core = kit.sphere(name + "-core", 0.94 * radius, mat=LAVA, segments=32,
                      rings=16, scale=(1.1, 0.96, 0.88))
    kit.uv_box(core)
    g = M.Geo()
    g.add(crust)
    g.add(core)
    obj = g.build(name + "-rock", 38)
    root = kit.empty(name)
    kit.parent(obj, root)
    return root, [obj]


# ---------------------------------------------------------------- build

ONLY = os.environ.get("TOWERS_ONLY", "")
BUILD = [
    ("king", king, (-9, 0, 0)),
    ("princess", princess, (-3, 0, 0)),
    ("king-rubble", king_rubble, (3, 0, 0)),
    ("princess-rubble", princess_rubble, (8.5, 0, 0)),
    ("wall", wall, (13, 0, 0)),
    ("meteor", meteor, (16, 0, 1)),
    ("bridge", bridge, (-5.5, -30, -SINK)),
    ("bridge-b", bridge_b, (5.5, -30, -SINK)),
    ("river", river, (0, -30, 0)),
]
if ONLY:
    keep_names = set(ONLY.split(","))
    BUILD = [b for b in BUILD if b[0] in keep_names]

roots, meshes, spots = [], [], []
for nm, build, spot in BUILD:
    root, objs = build()
    roots.append(root)
    meshes.append(objs)
    spots.append(spot)
    root.location = spot
kit.refresh()

WET = {"bridge", "bridge-b", "river"}


def terrain_proxy(name, x0, x1, y0, y1, yc=0.0, step=0.2, z=0.0):
    """The field and its river channel, for baking and previews."""
    bm = bmesh.new()
    nx = int((x1 - x0) / step)
    ys = []
    y = y0
    while y < y1:
        ys.append(y)
        y += 0.1 if abs(y) < 2.0 else step
    ys.append(y1)
    grid = []
    for yy in ys:
        row = []
        for i in range(nx + 1):
            xx = x0 + (x1 - x0) * i / nx
            row.append(bm.verts.new((xx, yy + yc, z + M.river_ground(abs(yy)))))
        grid.append(row)
    for j in range(len(ys) - 1):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1],
                          grid[j + 1][i]))
    return kit._from_bmesh(name, bm)


dry = [o for (nm, _, _), objs in zip(BUILD, meshes) if nm not in WET
       for o in objs]
wet = [o for (nm, _, _), objs in zip(BUILD, meshes) if nm in WET
       for o in objs]
if dry:
    kit.bake_ao(dry, samples=128, distance=0.55)
if wet:
    proxy = terrain_proxy("__bake-ground", -11, 11, -3.5, 3.5, yc=-30)
    kit.bake_ao(wet, samples=128, distance=0.55, ground=False)
    bpy.data.objects.remove(proxy, do_unlink=True)

for r in roots:
    r.location = (0, 0, 0)
kit.refresh()


def deck_check(root):
    objs = [o for o in kit.descendants(root) if o.type == "MESH"]
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    tree = BVHTree.FromBMesh(bm)
    out = []
    for y in (-1.95, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 1.95):
        for x in (0.0, -0.6, 0.6):
            best = None
            for dx in (-0.04, -0.02, 0.0, 0.02, 0.04):
                for dy in (-0.04, -0.02, 0.0, 0.02, 0.04):
                    yy = max(-1.95, min(1.95, y + dy))
                    hit = tree.ray_cast(Vector((x + dx, yy, 3.0)),
                                        Vector((0, 0, -1)), 5.0)
                    if hit[0] is not None:
                        z = hit[0].z - M.deck_top(yy)
                        best = z if best is None else max(best, z)
            out.append((x, y, M.deck_top(y), best))
    bm.free()
    return out


def report():
    for r in roots:
        print(f"ROOT {r.name}: {M.triangles(r)} triangles")
        for o in kit.descendants(r):
            loc = tuple(round(v, 3) for v in o.matrix_world.translation)
            if o.type == "MESH":
                pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
                lo = [round(min(p[i] for p in pts), 3) for i in range(3)]
                hi = [round(max(p[i] for p in pts), 3) for i in range(3)]
                o.data.calc_loop_triangles()
                mats = sorted(m.name for m in o.data.materials)
                print(f"  {o.name} (MESH) origin {loc} box {lo}..{hi} "
                      f"tris {len(o.data.loop_triangles)} mats {mats}")
            else:
                print(f"  {o.name} ({o.type}) origin {loc}")
        if r.name in ("bridge", "bridge-b"):
            for x, y, want, got in deck_check(r):
                print(f"  DECK {r.name} x {x:+.1f} y {y:+.2f} formula "
                      f"{want:.3f} top {'-' if got is None else f'{got:+.4f}'}")
    print("TINTS", {k: v for k, v in kit.HEX.items()})


report()

# ---------------------------------------------------------------- previews

RED = {"team": "rteam", "team2": "rteam2"}


def _flat(name, colour, rough=0.6, alpha=1.0, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
    return m


def _textured(name, image, scale, tint=(1, 1, 1), rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    path = os.path.join(kit.TEX, image + ".png")
    if not os.path.exists(path):
        bsdf.inputs["Base Color"].default_value = (*tint, 1)
        return m
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / scale, 1 / scale, 1 / scale)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1
    mix.inputs[7].default_value = (*tint, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return m


def _copy(root, red=False):
    made = {}
    for o in kit.descendants(root):
        c = o.copy()
        if o.type == "MESH":
            c.data = o.data.copy()
            if red:
                for i, m in enumerate(c.data.materials):
                    fam, _, t = m.name.partition(":")
                    if t in RED:
                        c.data.materials[i] = kit.material(f"{fam}:{RED[t]}")
        bpy.context.scene.collection.objects.link(c)
        made[o] = c
    for o, c in made.items():
        if o.parent in made:
            c.parent = made[o.parent]
            c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    return made[root]


def _place(obj, x, y, z=0.0, turn=0.0):
    obj.location = (x, y, z)
    obj.rotation_euler = (0, 0, turn)


def _hide(objs, flag):
    for r in objs:
        for o in kit.descendants(r):
            o.hide_render = flag


def _shoot(path, target, elevation, azimuth, dist, fov=30, res=(1200, 900),
           samples=96):
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    cam_data = bpy.data.cameras.new("pcam")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(fov)
    cam_data.clip_start = 0.1
    cam_data.clip_end = 400
    cam = bpy.data.objects.new("pcam", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    target = Vector(target)
    cam.location = target + dist * Vector((math.sin(az) * math.cos(el),
                                           -math.cos(az) * math.cos(el),
                                           math.sin(el)))
    cam.rotation_euler = (target - cam.location).to_track_quat(
        "-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    print("PREVIEW", path)


def _stage():
    """A studio for the diorama: graphite void, one large soft key light
    from the upper left, a cool rim from behind."""
    scene = bpy.context.scene
    kit.gpu()
    scene.cycles.use_denoising = True
    scene.render.film_transparent = False
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    lava = bpy.data.materials.get(LAVA)
    if lava:
        lava.node_tree.nodes["Principled BSDF"].inputs[
            "Emission Strength"].default_value = 3.0
    world = bpy.data.worlds.new("preview-world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.08, 0.085, 0.095, 1)
    bg.inputs[1].default_value = 1.0
    key = bpy.data.lights.new("pkey", "SUN")
    key.energy = 3.6
    key.angle = math.radians(7)
    key.color = (1.0, 0.95, 0.88)
    k = bpy.data.objects.new("pkey", key)
    k.rotation_euler = Vector((-0.62, -0.3, 0.72)).to_track_quat(
        "Z", "Y").to_euler()
    scene.collection.objects.link(k)
    rim = bpy.data.lights.new("prim", "SUN")
    rim.energy = 1.6
    rim.angle = math.radians(12)
    rim.color = (0.72, 0.82, 1.0)
    r = bpy.data.objects.new("prim", rim)
    r.rotation_euler = Vector((0.2, 1.0, 0.45)).to_track_quat(
        "Z", "Y").to_euler()
    scene.collection.objects.link(r)
    cobble = _textured("__cobble", "cobble-v3-a", 2.4, (0.95, 0.95, 0.95))
    pebble = _textured("__pebble", "pebbles-v3-a", 2.0, (0.8, 0.8, 0.8))
    plinth = _flat("__plinth", (0.025, 0.026, 0.03), 0.35)
    water = _flat("__water", (0.012, 0.03, 0.04), 0.03, alpha=0.9)
    ground = terrain_proxy("__ground", -10.8, 10.8, -18.0, 18.0, step=0.25)
    ground.data.materials.append(cobble)
    ground.data.materials.append(pebble)
    for p in ground.data.polygons:
        if p.center.z < -0.06:
            p.material_index = 1
    slab = kit.box("__slab", (23.5, 38.5, 1.0), (0, 0, -1.2), grid=False)
    slab.data.materials.append(plinth)
    wat = kit.box("__water", (21.4, 2.9, 0.01), (0, 0, -0.3), grid=False)
    wat.data.materials.append(water)
    return [ground, slab, wat]


def render_previews(path, roots):
    by = {r.name: r for r in roots}
    base = os.path.splitext(path)[0]
    stage = _stage()
    ground, slab, wat = stage
    everything = list(roots)
    extras = []
    # 1. Line-up of every piece on the cobbles.
    _hide(everything, True)
    lay = {"king": (-7.6, -6.5, 0), "princess": (-2.6, -6.5, 0),
           "king-rubble": (2.4, -6.5, 0), "princess-rubble": (7.2, -6.5, 0),
           "bridge": (-5.5, 0, -SINK), "bridge-b": (5.5, 0, -SINK),
           "river": (0, 0, 0), "wall": (-1.0, -10.2, 0),
           "meteor": (2.4, -10.2, 0.9)}
    for n, at in lay.items():
        if n in by:
            by[n].location = at
            _hide([by[n]], False)
    kit.refresh()
    _shoot(path, (0, -5.0, 1.0), 36, -12, 34, fov=30, res=(1500, 950))

    # 2. The field, as the game shows it.
    _hide(everything, True)
    field = []
    if "king" in by and "princess" in by:
        pk = by["king"]
        pp = [by["princess"], _copy(by["princess"])]
        rk = _copy(by["king"], red=True)
        rp = [_copy(by["princess"], red=True)]
        if "princess-rubble" in by:
            rp.append(_copy(by["princess-rubble"], red=True))
        else:
            rp.append(_copy(by["princess"], red=True))
        extras += pp[1:] + [rk] + rp
        _place(pk, 0, -13)
        _place(pp[0], -5.5, -9.5)
        _place(pp[1], 5.5, -9.5)
        _place(rk, 0, 13, turn=math.pi)
        _place(rp[0], -5.5, 9.5, turn=math.pi)
        _place(rp[1], 5.5, 9.5, turn=math.pi)
        field += [pk] + pp + [rk] + rp
    for n, x in (("bridge", -5.5), ("bridge-b", 5.5)):
        if n in by:
            _place(by[n], x, 0, -SINK)
            field.append(by[n])
    if "river" in by:
        _place(by["river"], 0, 0)
        field.append(by["river"])
    walls = []
    if "wall" in by:
        _place(by["wall"], 0, 0)
        kit.refresh()
        wm = [o for o in kit.descendants(by["wall"]) if o.type == "MESH"]
        spots_w = []
        for z in range(-16, 17, 2):
            if abs(z) < 2:
                continue
            spots_w += [(-9.8, -z, math.pi / 2), (9.8, -z, math.pi / 2)]
        x = -8.8
        while x <= 8.8 + 1e-6:
            spots_w += [(x, 17.2, 0.0), (x, -17.2, 0.0)]
            x += 2
        for fx, fy, turn in spots_w:
            for o in wm:
                c = o.copy()
                c.hide_render = False
                bpy.context.scene.collection.objects.link(c)
                c.matrix_world = (Matrix.Translation((fx, fy, 0)) @
                                  Matrix.Rotation(turn, 4, "Z") @
                                  o.matrix_world)
                walls.append(c)
    _hide(field, False)
    kit.refresh()
    _shoot(base + "-game.png", (0, -2.5, 0.5), 46, 0, 46, fov=36,
           res=(1500, 1000))
    _shoot(base + "-near.png", (0, -7.5, 0.8), 42, 0, 30, fov=34,
           res=(1500, 1000))
    _shoot(base + "-far.png", (0, 8.0, 0.8), 42, 180, 30, fov=34,
           res=(1500, 1000))
    # 3. Close views of the towers as the game frames them.
    if "king" in by:
        _shoot(base + "-king.png", (0, -13, 2.3), 45, 18, 13, fov=30,
               res=(1200, 1000))
        _shoot(base + "-king-front.png", (0, 13, 2.3), 42, -18, 13, fov=30,
               res=(1200, 1000))
        _shoot(base + "-king-gate.png", (0, -13, 2.0), 32, 160, 10, fov=30,
               res=(1200, 1000))
        _shoot(base + "-king-top.png", (0, -12.6, 3.4), 62, 25, 7.5, fov=30,
               res=(1200, 1000))
    if "princess" in by:
        _shoot(base + "-princess.png", (-5.5, -9.5, 1.9), 45, 20, 10,
               fov=30, res=(1000, 1000))
        _shoot(base + "-princess-front.png", (-5.5, 9.5, 1.9), 42, -18, 10,
               fov=30, res=(1000, 1000))
    if "bridge" in by:
        _shoot(base + "-bridge.png", (-5.5, 0, 0.4), 40, 60, 8.5, fov=30,
               res=(1200, 900))
        _shoot(base + "-arch.png", (-5.5, 0, 0.2), 16, 95, 6.5, fov=30,
               res=(1200, 800))
        _shoot(base + "-bridges.png", (0, -1.0, 0.3), 45, 0, 22, fov=34,
               res=(1500, 800))
    if "bridge-b" in by:
        _shoot(base + "-bridge-b.png", (5.5, 0, 0.4), 40, -60, 8.5, fov=30,
               res=(1200, 900))
    if "wall" in by:
        _shoot(base + "-wall.png", (-8.4, -15.6, 0.3), 36, 200, 6.5, fov=30,
               res=(1200, 800))
    for o in walls:
        bpy.data.objects.remove(o, do_unlink=True)
    # 4. Rubble and the meteor.
    _hide(field, True)
    wat.hide_render = True
    if "king-rubble" in by and "princess-rubble" in by:
        _hide([by["king-rubble"], by["princess-rubble"]], False)
        _place(by["king-rubble"], -2.5, -12)
        _place(by["princess-rubble"], 2.6, -12)
        kit.refresh()
        _shoot(base + "-rubble.png", (0, -12, 0.7), 46, 15, 15, fov=30,
               res=(1300, 850))
        _hide([by["king-rubble"], by["princess-rubble"]], True)
    if "meteor" in by:
        _hide([by["meteor"]], False)
        _place(by["meteor"], 0, -12, 1.0)
        kit.refresh()
        _shoot(base + "-meteor.png", (0, -12, 1.0), 25, 20, 4.8, fov=30,
               res=(700, 700))


out = kit.out_path()
if out:
    kit.export(roots, out)
    argv = sys.argv
    if len(argv) > argv.index("--") + 2:
        render_previews(argv[argv.index("--") + 2], roots)
