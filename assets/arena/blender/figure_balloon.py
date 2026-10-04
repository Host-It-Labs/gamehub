"""The Balloon (figure id `balloon`) as a collector's miniature: a Belle
Epoque gas balloon in hand-painted resin, flown by a white-haired elderly
aviatrix.

A round envelope of twelve gores, team colour and cream in turn, each
gore bulging a little between its seams, a team crown cap with a brass
valve and a team band round the waist; a diamond rope net over the top
gathered into twelve lines down to a wooden load ring; four ropes from the
ring to a wicker basket with a padded leather rim, a lower band and two
skids, sandbags hanging round it and a small rack of three round bombs on
its right side. In the basket the aviatrix: a brown leather flying jacket
with a big cream shearling collar, a long mustard scarf wound round her
neck and streaming behind, white hair in a bun, brass-rimmed round goggles
pushed up on her forehead, a warm smile.

She is built at the Cowboy's human scale and shrunk into the basket (as
the Biplane's pilot is), so the envelope keeps the room to read.

Parts (figures.py has the contract), none with a rest rotation:

  balloon         root on the ground under the basket, facing +y
    torso         the envelope, net and load ring; pivot on the load ring
      basket      the basket, its ropes, sandbags, bombs and the
                  aviatrix's body; pivot on the load ring, so it swings on
                  its ropes under the envelope
        head      the aviatrix's head, pivot at her neck
        armL      her left arm, the fist on the rim
        armR      her right arm, the one that drops the bombs

No legs: articulation.py leaves it alone. BALLOON_POSE=<name> turns the
parts as the game would (three.js Euler terms, see
figure_balloon_kit.runtime_quat) before the previews.
"""

import math
import os

import kit
import face_paint
import face_rig
import figure_balloon_kit as bk
from figure_balloon_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

B = "balloon"
T = kit.tint

# ------------------------------------------------------------- paints

TEAM = "weave:team"
TEAM2 = "weave:team2"
CREAM = "weave:" + T("balloon-cream", "#f1e6cc")     # gores, shearling
ROPE = "weave:" + T("balloon-rope", "#a37f52")       # net, ropes, sandbags
WICKER = "weave:" + T("balloon-wicker", "#c9975a")
LEATHER = "hide:" + T("balloon-leather", "#7c4a2b")  # jacket, rim, wood
WOOD = LEATHER                                       # ring, skids, rack
SKIN = "resin:" + T("balloon-skin", "#efbe9e")
HAIR = "resin:" + T("balloon-hair", "#f2eee8")
SCARF = "weave:" + T("balloon-scarf", "#e0a53c")
BRASS = "gilt:" + T("balloon-brass", "#caa150")
BROW = "resin:" + T("balloon-brow", "#9a938c")
BLUSH = "resin:" + T("balloon-blush", "#ec9c8c")
BOMB = face_paint.INK                                # shares the ink pot
LENS = face_paint.WHITE                              # shares the ivory
SHEARLING = CREAM
SACK = ROPE

# ------------------------------------------------------------- layout

RING_Z = 0.64            # the load ring: the envelope and basket pivot
RING_R = 0.115
GORES = 12
PER_GORE = 4
# The envelope's profile: (radius, z) from the mouth to the crown.
PROFILE = [(0.07, 0.745), (0.086, 0.785), (0.14, 0.862), (0.228, 0.948),
           (0.326, 1.04), (0.418, 1.132), (0.49, 1.225), (0.538, 1.322),
           (0.558, 1.42), (0.548, 1.52), (0.51, 1.628), (0.442, 1.736),
           (0.344, 1.836), (0.224, 1.912), (0.104, 1.955), (0.0, 1.966)]
# The basket: half widths at the floor and rim, the rim height.
BASKET_B, BASKET_T, BASKET_H = 0.148, 0.164, 0.2
BASKET_P = 3.2

# The aviatrix is sculpted at the Cowboy's human scale, her waist at
# HUMAN_WAIST, then shrunk by S and set in the basket at WAIST.
S = 0.62
HUMAN_WAIST = V(0, 0, 0.68)
WAIST = V(0, -0.012, 0.17)
AV = (Matrix.Translation(WAIST) @ Matrix.Scale(S, 4) @
      Matrix.Translation(-HUMAN_WAIST))
SH_X, SH_Z = 0.165, 0.975
NECK_H = V(0, 0.0, 1.035)
UPPER, FORE = 0.25, 0.225
WRIST_FIST = 0.04
HC = V(0, 0.012, 1.162)
CY = 0.012


def human(p):
    """A point in the aviatrix's human frame, placed in the basket."""
    return AV @ Vector(p)


def to_human(p):
    return AV.inverted() @ Vector(p)


# ------------------------------------------------------------- envelope


def envelope_profile(samples=2):
    pts = [V(r, 0, z) for r, z in PROFILE]
    return [(p[0], p[2]) for p in kit.smooth_path(pts, samples=samples)]


PROF = envelope_profile()


def env_radius(z):
    """The envelope's radius at height z (between the mouth and crown)."""
    rows = sorted((zz, r) for r, zz in PROF)
    return table(rows, z)


def bulge(phi):
    """Each gore swells a little between its seams."""
    g = (phi / math.tau * GORES) % 1.0
    return 1.0 + 0.028 * math.sin(math.pi * g) ** 1.4


def env_point(phi, z, off=0.0):
    r = env_radius(z)
    # Near the mouth and crown the gores are drawn in flat.
    k = smooth(0.76, 0.95, z) * smooth(1.95, 1.84, z)
    rr = r * (1 + (bulge(phi) - 1) * k) + off
    return V(rr * math.cos(phi), rr * math.sin(phi), z)


def envelope():
    """The gores, the crown cap and valve, the waist band and the mouth."""
    pieces = []
    n = GORES * PER_GORE
    c = bk.Mesh(f"{B}-envelope", TEAM)
    prof = [p for p in PROF if p[0] > 1e-4]
    rows = []
    for r, z in prof:
        rows.append([c.v(env_point(i / n * math.tau + math.pi / GORES, z))
                     for i in range(n)])
    cap_z = 1.9

    def mat(i, j):
        z = (prof[j][1] + prof[j + 1][1]) / 2
        if z > cap_z:
            return TEAM2
        if 1.395 < z < 1.45:
            return TEAM2
        return TEAM if (i // PER_GORE) % 2 == 0 else CREAM

    c.grid(rows, mat, closed=True)
    c.fan(rows[-1], V(0, 0, PROF[-1][1]), TEAM2)
    # The mouth: a short cream sleeve turned in.
    inner = [c.v(V(p.co.x * 0.8, p.co.y * 0.8, p.co.z + 0.03))
             for p in rows[0]]
    c.grid([inner, rows[0]], CREAM, closed=True)
    pieces.append(c.obj(outward=V(0, 0, 1.35)))
    # The brass valve on the crown.
    top = PROF[-1][1]
    pieces.append(bk.lathe(f"{B}-valve", [(0.0, top - 0.01), (0.045, top - 0.01),
                                          (0.046, top + 0.008),
                                          (0.03, top + 0.014),
                                          (0.012, top + 0.03),
                                          (0.0, top + 0.034)],
                           BRASS, n=16))
    return pieces


# The net: diamonds over the top, gathered into lines below the waist.
NET_TOP = 1.905
NET_BOTTOM = 1.19
NET_N = 12
NET_TWIST = 2 * math.tau / NET_N


def net():
    pieces = []
    rows = 13
    for k in range(NET_N):
        phi0 = k / NET_N * math.tau
        for d in (-1, 1):
            pts = []
            for j in range(rows + 1):
                t = j / rows
                z = lerp(NET_TOP, NET_BOTTOM, t)
                phi = phi0 + d * NET_TWIST * t
                pts.append(env_point(phi, z, 0.007))
            pieces.append(bk.tube(f"{B}-net{k}{d}", pts, [0.0052] * len(pts),
                                  ROPE, n=3, caps=(None, None)))
    # The crown ring where the net starts.
    ring = [env_point(i / 24 * math.tau, NET_TOP, 0.008) for i in range(24)]
    pieces.append(bk.tube(f"{B}-netcrown", ring + [ring[0]], [0.007] * 25,
                          ROPE, n=5, caps=(None, None)))
    # Twelve lines from the net's foot down to the load ring, with a
    # toggle where each one leaves the net.
    for k in range(NET_N):
        phi = k / NET_N * math.tau + NET_TWIST
        a = env_point(phi, NET_BOTTOM, 0.007)
        b = V(RING_R * math.cos(phi), RING_R * math.sin(phi), RING_Z + 0.004)
        pieces.append(bk.tube(f"{B}-line{k}", [a, b], [0.0045, 0.0045], ROPE,
                              n=4, caps=(None, None)))
        pieces.append(bk.ball(f"{B}-toggle{k}", 0.011, a, WOOD,
                              scale=(1, 1, 1.4), seg=6, rings=4))
    # The wooden load ring.
    hoop = [V(RING_R * math.cos(i / 20 * math.tau),
              RING_R * math.sin(i / 20 * math.tau), RING_Z) for i in range(20)]
    pieces.append(bk.tube(f"{B}-ring", hoop + [hoop[0]], [0.014] * 21, WOOD,
                          n=6, caps=(None, None)))
    return pieces


# ------------------------------------------------------------- basket


def basket_point(a, z, off=0.0):
    """The basket's wall: a rounded square (a = 0 toward +y), flaring a
    little toward the rim."""
    h = lerp(BASKET_B, BASKET_T, smooth(0.0, BASKET_H, z)) + off
    e = 2.0 / BASKET_P
    s, c = math.sin(a), math.cos(a)
    return V(h * spow(s, e), h * spow(c, e), z)


def basket():
    pieces = []
    n = 40
    zs = [0.012 + k * (BASKET_H - 0.012) / 11 for k in range(12)]
    c = bk.Mesh(f"{B}-wicker", WICKER)
    rows = []
    for j, z in enumerate(zs):
        row = []
        for i in range(n):
            a = i / n * math.tau
            # Over-and-under weave: the rows bulge in turn between stakes.
            weave = 0.0035 * (1 if (i // 2 + j) % 2 == 0 else -0.3)
            if j in (0, len(zs) - 1):
                weave = 0.0
            row.append(c.v(basket_point(a, z, weave)))
        rows.append(row)
    c.grid(rows, WICKER, closed=True)
    # The floor underneath, and the inside wall and floor.
    c.fan(rows[0], V(0, 0, 0.004), WICKER, flip=True)
    pieces.append(c.obj(outward=V(0, 0, 0.1)))
    inner = []
    for z in (0.03, BASKET_H - 0.004):
        inner.append([basket_point(i / n * math.tau, z, -0.014)
                      for i in range(n)])
    lin = bk.loft(f"{B}-inside", inner, WICKER, start="pole", recalc=False)
    # Faces toward the middle.
    bk_orient(lin, V(0, 0, 0.1), inward=True)
    pieces.append(lin)
    # The padded leather rim and a woven band low down.
    rim = [basket_point(i / 32 * math.tau, BASKET_H, -0.006)
           for i in range(32)]
    pieces.append(bk.tube(f"{B}-rim", rim + [rim[0]], [(0.016, 0.014)] * 33,
                          LEATHER, n=6, caps=(None, None)))
    band = [basket_point(i / 32 * math.tau, 0.055, 0.004) for i in range(32)]
    pieces.append(bk.tube(f"{B}-band", band + [band[0]],
                          [(0.004, 0.011)] * 33, LEATHER, n=4,
                          up=(0, 0, 1), caps=(None, None)))
    # Two wooden skids under the floor.
    for sx in (-1, 1):
        pieces.append(bk.tube(f"{B}-skid{sx}", [V(sx * 0.1, -0.15, 0.006),
                                                V(sx * 0.1, 0.15, 0.006)],
                              [(0.013, 0.01)] * 2, WOOD, n=6,
                              caps=("dome", "dome")))
    # The four ropes up to the ring, from rope loops at the rim's corners.
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        a = math.atan2(sx, sy)
        foot = basket_point(a, BASKET_H + 0.004, 0.004)
        top = V(RING_R * 0.8 * sx * 0.707, RING_R * 0.8 * sy * 0.707,
                RING_Z - 0.006)
        pieces.append(bk.tube(f"{B}-rope{k}", [foot, top], [0.0058] * 2, ROPE,
                              n=5, caps=(None, None)))
        low = basket_point(a, 0.06, 0.01)
        pieces.append(bk.tube(f"{B}-ropeloop{k}", [low, foot],
                              [0.0058] * 2, ROPE, n=5, caps=(None, None)))
    return pieces


def bk_orient(obj, ref, inward=False):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    for f in bm.faces:
        d = f.calc_center_median() - Vector(ref)
        d.z = 0 if abs(f.normal.z) < 0.7 else d.z
        if abs(f.normal.z) > 0.7:
            # The floor faces up, into the basket.
            if f.normal.z < 0:
                f.normal_flip()
            continue
        if (f.normal.dot(d) > 0) == inward:
            f.normal_flip()
    bm.to_mesh(obj.data)
    bm.free()


def sandbags():
    """Four burlap sandbags hung on short ropes round the basket."""
    pieces = []
    for k, (a_deg, z) in enumerate(((-128, 0.118), (-52, 0.125),
                                    (180, 0.112), (52 + 180, 0.12))):
        a = math.radians(a_deg)
        top = basket_point(a, BASKET_H - 0.004, 0.012)
        c = basket_point(a, z, 0.036)
        pieces.append(bk.ball(f"{B}-sack{k}", 1.0, c, SACK,
                              scale=(0.03, 0.026, 0.038), seg=10, rings=6))
        # The tied neck and its rope over the rim.
        neck = c + V(0, 0, 0.036)
        pieces.append(bk.ball(f"{B}-sackneck{k}", 0.01, neck, SACK,
                              scale=(1, 1, 1.3), seg=6, rings=4))
        pieces.append(bk.tube(f"{B}-sackrope{k}", [neck, top], [0.0035] * 2,
                              ROPE, n=4, caps=(None, None)))
    return pieces


def bomb_rack():
    """A small wooden rack on the basket's right side with three round
    bombs, their brass fuze caps and short wicks up."""
    pieces = []
    x = basket_point(math.radians(90), 0.1, 0.0).x
    for z in (0.045, 0.12):
        pieces.append(bk.rbox(f"{B}-rail{z}", (0.022, 0.2, 0.016),
                              V(x + 0.012, 0.0, z), WOOD, levels=1,
                              crease=0.7))
    for k, y in enumerate((-0.062, 0.0, 0.062)):
        c = V(x + 0.042, y, 0.082)
        pieces.append(bk.ball(f"{B}-bomb{k}", 0.03, c, BOMB, seg=12,
                              rings=7))
        pieces.append(bk.lathe(f"{B}-fuze{k}", [(0.012, -0.004),
                                                (0.013, 0.006),
                                                (0.009, 0.012),
                                                (0.0, 0.013)], BRASS, n=8,
                               matrix=Matrix.Translation(c + V(0, 0, 0.028))))
        pieces.append(bk.tube(f"{B}-wick{k}", [c + V(0, 0, 0.038),
                                               c + V(0.004, 0.002, 0.05),
                                               c + V(0.012, 0.0, 0.056)],
                              [0.0028] * 3, ROPE, n=4,
                              caps=(None, "dome")))
    # The straps holding them to the rails.
    for k, y in enumerate((-0.031, 0.031)):
        pieces.append(bk.rbox(f"{B}-rackpost{k}", (0.012, 0.012, 0.1),
                              V(x + 0.016, y, 0.083), WOOD, levels=1,
                              crease=0.7))
    return pieces


# ------------------------------------------------------------- aviatrix

BODY = [(0.575, 0.118, 0.094, 0.092), (0.64, 0.12, 0.096, 0.092),
        (0.70, 0.124, 0.1, 0.094), (0.78, 0.138, 0.112, 0.1),
        (0.86, 0.148, 0.118, 0.104), (0.92, 0.152, 0.116, 0.106),
        (0.965, 0.146, 0.1, 0.1), (1.0, 0.104, 0.078, 0.078),
        (1.035, 0.056, 0.052, 0.052)]
BODY_P = 2.3


def body_point(a, z, extra=0.0):
    rx_, ryf, ryb = table([(r[0], r[1], r[2], r[3]) for r in BODY], z)
    e = 2.0 / BODY_P
    s, c = math.sin(a), math.cos(a)
    return V((rx_ + extra) * spow(s, e),
             ((ryf if c >= 0 else ryb) + extra) * spow(c, e), z)


def jacket():
    """Her leather flying jacket from inside the basket to the collar."""
    n = 24
    zs = [0.56, 0.62, 0.7, 0.78, 0.86, 0.92, 0.965, 1.0, 1.03]
    c = bk.Mesh(f"{B}-jacket", LEATHER)
    rows = [[c.v(body_point(i / n * math.tau, z, 0.012 +
                            0.003 * math.sin(3 * i / n * math.tau + z * 20)))
             for i in range(n)] for z in zs]
    c.grid(rows, LEATHER, closed=True)
    c.fan(rows[-1], V(0, 0, 1.045), LEATHER)
    c.fan(rows[0], V(0, 0, 0.55), LEATHER, flip=True)
    pieces = [c.obj(outward=V(0, 0, 0.8))]
    # A zip placket and brass buttons down the front.
    for k, z in enumerate((0.9, 0.835, 0.77)):
        p = body_point(math.radians(-14), z, 0.018)
        pieces.append(bk.ball(f"{B}-button{k}", 0.012, p, BRASS,
                              scale=(1, 0.55, 1), seg=8, rings=4))
    # The big shearling collar lying over the shoulders.

    def collar(u, v):
        a = math.radians(lerp(28, 332, u))
        s, cc = math.sin(a), math.cos(a)
        inner = V(0.07 * s, -0.004 + 0.066 * cc, 1.052)
        front = max(0.0, cc)
        outer = V(0.182 * s, -0.004 + 0.152 * cc,
                  0.955 - 0.045 * front ** 2)
        mid = lerp(inner, outer, 0.45) + V(0, 0, 0.028)
        if v <= 0.5:
            return lerp(inner, mid, v * 2)
        return lerp(mid, outer, (v - 0.5) * 2)
    pieces.append(bk.sheet(f"{B}-collar", collar, [i / 18 for i in range(19)],
                           [0.0, 0.5, 1.0], SHEARLING, rim=0.012, back=True,
                           inside=V(0, 0, 0.92)))
    return pieces


def scarf():
    """A long mustard scarf: wound round her neck, one short end on her
    chest, the long one streaming back and out over the basket's rim."""
    pieces = []
    pieces.append(bk.lathe(f"{B}-wrap", [(0.058, 1.0), (0.066, 1.012),
                                         (0.066, 1.036), (0.056, 1.052)],
                           SCARF, n=16,
                           matrix=Matrix.Translation(V(0, -0.002, 0))))
    # The knot, front left, and the short end.
    k = V(-0.03, 0.062, 1.015)
    pieces.append(bk.ball(f"{B}-knot", 0.018, k, SCARF,
                          scale=(1.1, 0.8, 0.9), seg=8, rings=5))
    pieces.append(ribbon(f"{B}-scarfshort", [k, k + V(-0.01, 0.018, -0.04),
                                             k + V(-0.004, 0.024, -0.09)],
                         [0.05, 0.046, 0.042], seed=1))
    # The long end over the right shoulder, flying back in the wind.
    start = V(0.045, -0.055, 1.03)
    path = [start, start + V(0.035, -0.06, -0.03),
            start + V(0.06, -0.12, -0.1), start + V(0.1, -0.2, -0.16),
            start + V(0.16, -0.28, -0.19), start + V(0.2, -0.37, -0.17),
            start + V(0.27, -0.44, -0.2), start + V(0.32, -0.52, -0.18)]
    path = [V(p) for p in kit.smooth_path(path, samples=3)]
    m = len(path)
    widths = [lerp(0.062, 0.056, i / (m - 1)) for i in range(m)]
    pieces.append(ribbon(f"{B}-scarflong", path, widths, seed=3))
    # A fringe on the long end.
    end, before = path[-1], path[-2]
    d = (end - before).normalized()
    side = d.cross(V(0, 0, 1)).normalized()
    for j in range(5):
        p = end + side * lerp(-0.018, 0.018, j / 4)
        pieces.append(bk.tube(f"{B}-fringe{j}", [p - d * 0.002, p + d * 0.022],
                              [0.0035, 0.0028], SCARF, n=4,
                              caps=(None, "dome")))
    return pieces


def ribbon(name, path, widths, thick=0.009, seed=0):
    """A flat fluttering band along a path, rolling a little as it goes."""
    path = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        d = (b - a).normalized()
        side = V(0, 0, 1).cross(d)
        if side.length < 1e-4:
            side = V(1, 0, 0)
        side.normalize()
        lift = d.cross(side).normalized()
        roll = math.sin(i * 0.9 + seed * 2.0) * 0.5 + 0.3
        s2 = side * math.cos(roll) + lift * math.sin(roll)
        l2 = -side * math.sin(roll) + lift * math.cos(roll)
        w = widths[i]
        h = thick / 2
        s3, l3 = s2, l2
        rings.append([p + s3 * w / 2, p + s3 * w / 6 + l3 * h,
                      p - s3 * w / 6 + l3 * h, p - s3 * w / 2,
                      p - s3 * w / 6 - l3 * h, p + s3 * w / 6 - l3 * h])
    return bk.loft(name, rings, SCARF, start="flat", end="flat")


# The face: the Cowboy's sculpt made softer and rounder, a smaller nose
# and a gentle chin.
FACE_W = [(1.0, 0.028), (1.025, 0.034), (1.045, 0.043), (1.062, 0.05),
          (1.076, 0.056), (1.095, 0.0615), (1.12, 0.0665), (1.145, 0.07),
          (1.17, 0.0705), (1.2, 0.0715), (1.225, 0.069), (1.245, 0.061),
          (1.26, 0.046), (1.268, 0.02)]
FACE_D = [(1.0, 0.03), (1.025, 0.04), (1.045, 0.054), (1.062, 0.065),
          (1.074, 0.07), (1.09, 0.073), (1.12, 0.077), (1.15, 0.075),
          (1.172, 0.08), (1.2, 0.081), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
FACE_P = 2.4
NOSE_H = [(1.1, 0.0), (1.107, 0.006), (1.114, 0.015), (1.121, 0.019),
          (1.13, 0.016), (1.145, 0.011), (1.16, 0.006), (1.172, 0.003),
          (1.186, 0.0)]
NOSE_S = [(1.11, 10.0), (1.13, 7.5), (1.17, 5.5)]


def face_disp(ad, z):
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.005 * gauss(a, 11.5, 5) * gauss(z, 1.114, 0.006)       # nostrils
    d -= 0.01 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)        # sockets
    bz = 1.176 - 0.003 * gauss(a, 9, 8)
    d += 0.006 * gauss(z, bz, 0.0065) * smooth(52, 30, a)         # brow
    d += 0.013 * gauss(a, 38, 14) * gauss(z, 1.124, 0.016)        # cheeks
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.003 * gauss(z, 1.087, 0.0035) * gauss(ad, 0, 12)       # lower lip
    d += 0.005 * gauss(z, 1.07, 0.01) * gauss(ad, 0, 15)          # chin
    d -= 0.002 * gauss(a, 60, 10) * gauss(z, 1.175, 0.015)        # temples
    return d


def face_point(ad, z):
    a = math.radians(ad)
    w = table(FACE_W, z)
    front = table(FACE_D, z)
    back = table(BACK_D, z)
    e = 2.0 / FACE_P
    s_, c_ = math.sin(a), math.cos(a)
    x = w * spow(s_, e)
    dd = front if c_ >= 0 else back
    y = dd * spow(c_, e)
    gx = spow(x / w, FACE_P - 1) / w if x else 0.0
    gy = spow(y / dd, FACE_P - 1) / dd if y else 0.0
    n = V(gx, gy, 0)
    n = n.normalized() if n.length > 1e-9 else V(0, 1, 0)
    return V(x, CY + y, z) + n * face_disp(ad, z)


def face_normal(ad, z):
    du = face_point(ad + 0.5, z) - face_point(ad - 0.5, z)
    dz = face_point(ad, z + 0.001) - face_point(ad, z - 0.001)
    n = du.cross(dz).normalized()
    p = face_point(ad, z)
    if (p - HC).dot(n) < 0:
        n = -n
    return n


FACE_A = [0, 4, 8.5, 13.5, 19, 25, 32, 41, 52, 66, 82, 100, 124, 152]
FACE_Z = [1.012, 1.03, 1.047, 1.062, 1.075, 1.085, 1.093, 1.101, 1.108,
          1.115, 1.122, 1.131, 1.141, 1.15, 1.159, 1.167, 1.176, 1.187,
          1.202, 1.228, 1.252]


def hairline(a):
    """Her hairline: high on the forehead, down over the ears and to the
    nape (the hair itself is a shell on top)."""
    base = table([(0, 1.203), (30, 1.199), (55, 1.188), (72, 1.16),
                  (84, 1.16), (100, 1.15), (130, 1.09), (180, 1.07)],
                 abs(a))
    # Soft scallops of waves along the front.
    return base - 0.004 * max(0.0, math.cos(math.radians(a) * 7)) * \
        smooth(80, 50, abs(a))


def skull():
    cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
    cols = [a for a in cols if a > -180]
    c = bk.Mesh(f"{B}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]
    n = len(cols)

    def mat(i, j):
        a0, a1 = cols[i], cols[(i + 1) % n]
        if i == n - 1:
            a1 += 360
        a = (a0 + a1) / 2
        a = a - 360 if a > 180 else a
        z = (FACE_Z[j] + FACE_Z[j + 1]) / 2
        if z > hairline(a):
            return HAIR
        return SKIN

    c.grid(rows, mat, closed=True)
    c.fan(rows[-1], V(0, CY - 0.005, 1.268), HAIR)
    return c.obj(outward=HC)


def hair():
    """Soft white hair swept up from the face into a bun, over the skull."""
    pieces = []
    cols = [i * 10 - 180 for i in range(36)]
    zs = [1.07, 1.09, 1.12, 1.15, 1.18, 1.2, 1.22, 1.24, 1.255, 1.266]
    c = bk.Mesh(f"{B}-hairshell", HAIR)
    rows = []
    for z in zs:
        row = []
        for a in cols:
            lo = hairline(a)
            # The shell starts at the hairline and thickens above it.
            zz = max(z, lo - 0.004)
            th = 0.003 + 0.0075 * smooth(lo - 0.01, lo + 0.05, zz)
            # Combed waves swept back from the face.
            wave = 0.003 * math.sin(math.radians(a) * 14 + zz * 160) * \
                smooth(lo, lo + 0.02, zz)
            p = face_point(a, zz) + face_normal(a, zz) * (th + wave)
            row.append(c.v(p))
        rows.append(row)
    c.grid(rows, HAIR, closed=True)
    c.fan(rows[-1], V(0, CY - 0.006, 1.282), HAIR)
    pieces.append(c.obj(outward=HC))
    # The bun at the back of the crown, with a wound strand round it.
    bun_c = V(0, -0.072, 1.258)
    pieces.append(bk.ball(f"{B}-bun", 1.0, bun_c, HAIR,
                          scale=(0.046, 0.04, 0.038), seg=14, rings=8))
    wind = [bun_c + V(0.047 * math.cos(t), 0.041 * math.sin(t) - 0.004,
                      0.012 * math.sin(2 * t) - 0.004)
            for t in (i / 12 * math.tau for i in range(12))]
    pieces.append(bk.tube(f"{B}-bunwind", wind + [wind[0]], [0.009] * 13,
                          HAIR, n=5, caps=(None, None)))
    return pieces


def goggles():
    """Round brass-rimmed goggles pushed up on her forehead, the strap
    round the hair."""
    pieces = []
    lens = []
    z = 1.228
    for sx in (-1, 1):
        a = sx * 24
        at = face_point(a, z) + face_normal(a, z) * 0.018
        d = face_normal(a, z)
        d = (d + V(0, 0, 0.35)).normalized()
        m = bk.look(d, (0, 0, 1), at)
        pieces.append(bk.lathe(f"{B}-goggle{sx}", [(0.028, -0.008),
                                                   (0.031, 0.004),
                                                   (0.029, 0.011),
                                                   (0.022, 0.012),
                                                   (0.021, 0.004)],
                               BRASS, n=16, matrix=m))
        pieces.append(bk.lathe(f"{B}-lens{sx}", [(0.022, 0.004),
                                                 (0.012, 0.009),
                                                 (0.0, 0.01)], LENS, n=16,
                               matrix=m))
        lens.append(at)
    mid = (lens[0] + lens[1]) / 2 + V(0, 0.01, 0.002)
    pieces.append(bk.tube(f"{B}-bridge", [lens[0] + V(0.024, 0.004, 0), mid,
                                          lens[1] - V(0.024, -0.004, 0)],
                          [0.004] * 3, BRASS, n=5))
    strap = []
    for k in range(17):
        a = 38 + k * (360 - 76) / 16
        aa = a if a <= 180 else a - 360
        zz = z - 0.004 + 0.012 * (1 - math.cos(math.radians(a))) / 2
        strap.append(face_point(aa, zz) + face_normal(aa, zz) * 0.017)
    pieces.append(bk.tube(f"{B}-gstrap", strap, [(0.004, 0.011)] * 17,
                          LEATHER, n=4, up=(0, 0, 1), caps=(None, None)))
    return pieces


def eyes():
    out = face_paint.eyes(bk, B, face_point, HC, z=1.1565,
                          expression="confident")
    for o in out:
        if "brow" in o.name:
            kit.assign(o, BROW)
    out += face_paint.mouth(bk, B, face_point, HC, z=1.0965,
                            expression="confident")
    for sx in (-1, 1):
        # Rosy cheeks.
        blush = [(sx * 40 + 9 * math.cos(t), 1.121 + 0.0085 * math.sin(t))
                 for t in (i / 12 * math.tau for i in range(12))]
        if sx < 0:
            blush.reverse()
        out.append(bk.decal(f"{B}-blush{sx}", face_point, blush, 0.0012,
                            BLUSH, depth=0.0008, eps=0.05, ref=HC))
        # Two lashes flicking up from each eye's outer corner.
        for j, (da, dz) in enumerate(((13.5, 0.004), (11.0, 0.0105))):
            a0 = sx * (27 + da)
            lash = [(a0, 1.1565 + dz), (a0 + sx * 6, 1.1565 + dz + 0.011),
                    (a0 + sx * 3.5, 1.1565 + dz + 0.002)]
            if sx < 0:
                lash.reverse()
            out.append(bk.decal(f"{B}-lash{sx}{j}", face_point, lash, 0.0042,
                                face_paint.INK, depth=0.001, eps=0.05,
                                ref=HC))
    return out


def ears():
    out = []
    for sx in (-1, 1):
        p = face_point(sx * 90, 1.142) + V(sx * 0.004, -0.008, 0)
        e = bk.ball(f"{B}-ear{sx}", 1.0, V(0, 0, 0), SKIN,
                    scale=(0.008, 0.019, 0.027), seg=8, rings=5)
        m = Matrix.Translation(p) @ Matrix.Rotation(math.radians(-sx * 14),
                                                    4, "Z") @ \
            Matrix.Rotation(math.radians(-10), 4, "X")
        bk.transform([e], m)
        out.append(e)
        # A small brass drop earring.
        lobe = face_point(sx * 90, 1.118) + V(sx * 0.009, -0.004, 0)
        out.append(bk.ball(f"{B}-earring{sx}", 0.0075, lobe - V(0, 0, 0.012),
                           BRASS, scale=(1, 1, 1.3), seg=8, rings=5))
        out.append(bk.tube(f"{B}-earhook{sx}", [lobe, lobe - V(0, 0, 0.006)],
                           [0.002, 0.002], BRASS, n=4, caps=(None, None)))
    return out


def neck():
    return bk.tube(f"{B}-neck", [V(0, 0.0, 0.985), V(0, 0.004, 1.03),
                                 V(0, 0.01, 1.07)],
                   [0.043, 0.042, 0.04], SKIN, n=12, caps=(None, None))


def head():
    locks = hair()
    return [skull(), neck(), locks[0]] + goggles() + eyes() + ears(), locks[1:]


def fist(name, c, xax, kax, chir, mat=SKIN):
    """The Cowboy's closed fist round a pole along Z, fingertips toward X
    and knuckles toward K; the wrist at -X."""
    zs = [-0.036, -0.029, -0.017, -0.0085, 0.0, 0.0085, 0.017, 0.029, 0.036]
    grooves = {-0.017, 0.0, 0.017}
    cx, cy, hx, hy = -0.0035, 0.002, 0.0325, 0.027
    rings = []
    for z in zs:
        k = 1.0
        if abs(z) > 0.035:
            k = 0.74
        elif abs(z) > 0.03:
            k = 0.93
        if z < 0:
            k *= 0.94
        ring = []
        for x, y, ang in bk.sup(10, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.0022 * (1 if px > 0.004 else 0.5)
                py += 0.0016 if py < -0.01 else 0.0
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0012
                py += 0.0012
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [bk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                      end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(bk.tube(f"{name}-thumb", thumb, [0.0098, 0.0086, 0.0078],
                          mat, n=6))
    pieces.append(bk.tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                           V(-0.03, 0.0, 0.0)],
                          [(0.022, 0.027), (0.025, 0.03)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    bk.transform(pieces, bk.basis(xax, kax, zax, c))
    return pieces


def build_arm(side):
    """An arm in the human frame, the fist closed on the basket's rim."""
    sx = 1 if side == "R" else -1
    s = V(sx * SH_X, 0, SH_Z)
    # The rim in her frame, a hand's width to the side of the chest.
    rim = to_human(V(sx * 0.1, BASKET_T - 0.004, BASKET_H + 0.012))
    c = rim
    pole = s + V(sx * 0.6, -0.4, -0.3)
    rail = V(1, 0, 0)
    e0 = bk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    xax = (c - e0) - rail * (c - e0).dot(rail)
    xax.normalize()
    w = c - xax * WRIST_FIST
    e = bk.ik(s, w, UPPER, FORE, pole)
    zax = V(-sx, 0, 0)
    chir = -1 if side == "R" else 1
    kax = zax.cross(xax) if chir > 0 else xax.cross(zax)
    up = (e - s).normalized()
    fo = (w - e).normalized()
    upper = [bk.tube(f"{B}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5), e],
                      [0.05, 0.05, 0.046], LEATHER, n=12,
                      caps=(None, None)),
              bk.ball(f"{B}-shoulder{side}", 1.0, s + V(sx * 0.002, 0, -0.028),
                      LEATHER, scale=(0.046, 0.048, 0.04), seg=10, rings=6),
              bk.ball(f"{B}-elbow{side}", 0.045, e, LEATHER, seg=10, rings=6)]
    lower = [bk.tube(f"{B}-fore{side}", [e, lerp(e, w, 0.55), w - fo * 0.022],
                      [0.046, 0.043, 0.042], LEATHER, n=12, caps=(None, None)),
              # A shearling cuff turned back at the wrist.
              bk.tube(f"{B}-cuff{side}", [w - fo * 0.05, w - fo * 0.012],
                      [0.05, 0.052], SHEARLING, n=12,
                      caps=("flat", "flat"))]
    lower += fist(f"{B}-hand{side}", c, xax, kax, chir)
    return upper, lower, s, e


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("BALLOON_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + bk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return bk.part(B, name, pieces, pivot, par, angle=angle)


def build(root_name="balloon"):
    assert root_name == B
    root = kit.empty(B)
    ring = V(0, 0, RING_Z)
    env = part("torso", envelope() + net(), ring, root, angle=40)
    cloth = scarf()
    trailing = [o for o in cloth if "-scarflong" in o.name or "-fringe" in o.name]
    body = jacket() + [o for o in cloth if o not in trailing]
    bk.transform(body + trailing, AV)
    car = part("basket", basket() + sandbags() + bomb_rack() + body, ring,
               env, angle=40)
    part("cape", trailing, human(V(0.045, -0.055, 1.03)), car, angle=62)
    face, bun = head()
    bk.transform(face + bun, AV)
    head_obj = face_rig.head(bk.part, B, face, human(NECK_H), car, angle=62)
    part("hair", bun, human(V(0, -0.048, 1.248)), head_obj, angle=62)
    for side in ("R", "L"):
        upper, lower, s, e = build_arm(side)
        bk.transform(upper + lower, AV)
        arm = part(f"arm{side}", upper, human(s), car)
        part(f"fore{side}", lower, human(e), arm)

    report(root)
    pose = os.environ.get("BALLOON_POSE")
    if pose in POSES:
        bk.apply_runtime(root, POSES[pose])
    return root


# Poses in three.js Euler terms (x, y about the vertical, z), as the game
# sets them (components/game/arena/moves/balloon.ts): the envelope rocking
# with the basket trailing a turn, reaching for a bomb and dropping it.
POSES = {
    "turn": {"torso": (0.05, 0, -0.06), "basket": (-0.05, 0, 0.2),
             "head": (0, 0.5, 0)},
    "reach": {"basket": (0.03, 0, 0), "armR": (-0.35, 0, 0.85),
              "torso": (0, 0, 0), "head": (0.3, -0.5, 0)},
    "drop": {"basket": (-0.06, 0, -0.05), "armR": (0.35, 0, 1.3),
             "armL": (0.2, 0, 0), "head": (0.35, -0.6, 0)},
}


def report(root):
    print("BALLOON joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {bk.tris(o)} mats "
                  f"{[m.name for m in o.data.materials]}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("BALLOON materials", len(mats), mats)
