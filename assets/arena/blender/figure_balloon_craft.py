"""Private vehicle-only construction snapshot; new hot-air construction
and wicker work are authored by figure_balloon_sculpt.py. No old aviatrix
builder is retained. Original figure_balloon.py SHA256: 35b5a1c8e57f75dfa650c77eba3b8dcd597630dfb009df195d6e710f9051180a
"""
import math
import os

import kit
import face_paint
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
WOOD = "beech:" + T("balloon-wood", "#945b30") # structural load ring                                       # ring, skids, rack
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


