"""The Wizard (card id `mage`) as a hand-painted collector's miniature.

A tall, stern, weathered high-fantasy wizard: a long team robe with gold
embroidered hems, front band and cuffs, wide bell sleeves lined in the dark
team tone; a charcoal travelling mantle thrown over the shoulders and hanging
down the back; a leather belt with two pouches and a small bound book; a
long flowing grey-white beard in sculpted locks, drooping moustache and
heavy brows; long grey hair falling from under a tall pointed team hat with
a gold band and a bent tip. In the right hand a tall gnarled dark-wood staff
crowned by a glowing amber crystal in silver claws; the left hand raised,
open, palm up, holding a small ball of fire.

Part contract (figures.py / troops.py): the root empty `mage` at the feet,
facing +y. `mage.legL/R` pivot at the hips (each a boot peeking out under
the hem; the robe hides the rest), `mage.torso` at the waist carries the
robe, mantle and belt, `mage.head` at the neck carries the face, beard,
hair and hat, `mage.armL/R` at the shoulders carry the sleeves (the right
one also the fist), `mage.weapon` is the staff (child of armR, pivot in
the right fist) and `mage.offhand` the open casting hand with its flame
(child of armL, pivot at the wrist). No part has a rest rotation.

The crystal and the flame use the `glow` family, which the game draws
emissive (materials.ts), as the older toy wizard's orb did.

MAGE_POSE=cast (armR 2.0, armL 1.0, offhand 0.3, legs +-0.5 about x),
raise (armR 2.2, armL 1.35) or castup (the cast with the staff turned
back upright in the fist) turns the parts before the previews render.
"""

import math
import os

import kit
import figure_mage_kit as mk
from figure_mage_kit import V, gauss, lerp, smooth, spow, table, clamp01
from mathutils import Matrix, Vector

R = "mage"
T = kit.tint

# ------------------------------------------------------------- paints
# Ten pots, one draw batch each at runtime: eyes share the beard's grey
# white and the mantle's charcoal, the book's pages the beard's.

TEAM = "weave:team"
TEAM2 = "weave:team2"
GOLD = "gilt:" + T("wizard-gold", "#c79f4c")
SILVER = "gilt:" + T("wizard-silver", "#b7bcc4")
MANTLE = "weave:" + T("wizard-mantle", "#56585e")
SKIN = "resin:" + T("wizard-skin", "#c8957a")
BEARD = "resin:" + T("wizard-beard", "#d6d2ca")
LEATHER = "leather:" + T("wizard-leather", "#5d3e29")
WOOD = "wood:" + T("wizard-wood", "#5e4130")
FIRE = "glow:" + T("wizard-fire", "#ff8a26")
EYEW = BEARD
IRIS = MANTLE

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.085, 0.5
WAIST = V(0, 0, 0.56)
SH_X, SH_Y, SH_Z = 0.165, -0.005, 0.865
S_R = V(SH_X, SH_Y, SH_Z)
S_L = V(-SH_X, SH_Y, SH_Z)
NECK = V(0, 0.0, 0.925)
UPPER, FORE = 0.21, 0.2
WRIST_FIST = 0.04

# The staff: planted a little forward and out, its top leaning back toward
# the shoulder; the right fist closes round it at chest height.
STAFF_B = V(0.345, 0.2, 0.012)
STAFF_T = V(0.318, 0.128, 1.27)
STAFF_D = (STAFF_T - STAFF_B).normalized()


def staff_at(z):
    t = (z - STAFF_B.z) / (STAFF_T.z - STAFF_B.z)
    return lerp(STAFF_B, STAFF_T, t)


FIST_R = staff_at(0.72)
POLE_R = V(0.45, -0.12, 0.66)
# The casting hand: forearm forward and a little up, palm up.
WRIST_L = V(-0.245, 0.215, 0.795)
POLE_L = V(-0.36, -0.06, 0.52)

# ------------------------------------------------------------- face

DZ = -0.112          # the face tables are the guard's, lowered
CY = 0.012           # the face's centre line (y)
HC = V(0, 0.012, 1.162 + DZ)


def gz(rows):
    return [(z + DZ,) + tuple(r) for z, *r in rows]


FACE_W = gz([(1.0, 0.03), (1.03, 0.039), (1.048, 0.046), (1.062, 0.052),
             (1.076, 0.057), (1.095, 0.061), (1.12, 0.065), (1.145, 0.07),
             (1.17, 0.073), (1.2, 0.074), (1.235, 0.07), (1.262, 0.06)])
FACE_D = gz([(1.0, 0.028), (1.03, 0.038), (1.048, 0.053), (1.062, 0.066),
             (1.074, 0.071), (1.09, 0.074), (1.12, 0.076), (1.15, 0.073),
             (1.172, 0.081), (1.2, 0.083), (1.235, 0.076), (1.262, 0.064)])
FACE_P = 2.5
# A long, hooked nose with a high bridge.
NOSE_H = gz([(1.094, 0.0), (1.101, 0.008), (1.108, 0.019), (1.116, 0.026),
             (1.126, 0.0235), (1.138, 0.019), (1.151, 0.017), (1.163, 0.0105),
             (1.176, 0.0045), (1.188, 0.0)])
NOSE_S = gz([(1.11, 10.0), (1.13, 7.5), (1.17, 6.0)])


def face_disp(ad, z):
    """Sculpted relief of a gaunt old face (metres, along the normal)."""
    a = abs(ad)
    zg = z - DZ
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.0065 * gauss(a, 12.0, 5) * gauss(zg, 1.111, 0.006)      # nostrils
    d -= 0.0135 * gauss(a, 26, 11) * gauss(zg, 1.156, 0.011)       # sockets
    bz = 1.1745 - 0.003 * gauss(a, 9, 8)
    d += 0.0105 * gauss(zg, bz, 0.007) * smooth(56, 30, a)         # brow
    d -= 0.0032 * gauss(ad, 0, 3.5) * gauss(zg, 1.171, 0.01)       # frown
    d += 0.0075 * gauss(a, 48, 12) * gauss(zg, 1.14, 0.011)        # cheekbone
    d -= 0.0065 * gauss(a, 40, 12) * gauss(zg, 1.103, 0.014)       # hollow
    d -= 0.0028 * gauss(z - DZ, 1.0965, 0.0025) * gauss(ad, 0, 16)  # mouth
    d += 0.007 * gauss(zg, 1.068, 0.01) * gauss(ad, 0, 18)         # chin
    d -= 0.0045 * gauss(a, 62, 10) * gauss(zg, 1.178, 0.015)       # temples
    # Two furrows across the brow above the frown.
    d -= 0.0014 * gauss(zg, 1.193, 0.004) * smooth(40, 18, a)
    d -= 0.0012 * gauss(zg, 1.207, 0.004) * smooth(36, 16, a)
    return d


def face_point(ad, z):
    a = math.radians(ad)
    w = table(FACE_W, z)
    dd = table(FACE_D, z)
    e = 2.0 / FACE_P
    s_, c_ = math.sin(a), math.cos(a)
    x = w * spow(s_, e)
    y = dd * spow(c_, e) if c_ >= 0 else 0.75 * dd * spow(c_, e)
    gx = spow(x / w, FACE_P - 1) / w if x else 0.0
    gy = spow(y / dd, FACE_P - 1) / dd if y else 0.0
    n = V(gx, gy, 0)
    n = n.normalized() if n.length > 1e-9 else V(0, 1, 0)
    return V(x, CY + y, z) + n * face_disp(ad, z)


def face_normal(ad, z):
    du = face_point(ad + 0.5, z) - face_point(ad - 0.5, z)
    dz = face_point(ad, z + 0.001) - face_point(ad, z - 0.001)
    n = du.cross(dz).normalized()
    if (face_point(ad, z) - HC).dot(n) < 0:
        n = -n
    return n


FACE_A = [0, 4, 8.5, 13.5, 19, 25, 32, 41, 52, 66, 84, 118]
FACE_Z = [z + DZ for z in (1.01, 1.075, 1.09, 1.098, 1.106, 1.114,
                           1.122, 1.131, 1.141, 1.15, 1.159, 1.167, 1.176,
                           1.187, 1.2, 1.214, 1.232, 1.252)]


def face():
    cols = sorted(set([-a for a in FACE_A] + FACE_A))
    c = mk.Mesh(f"{R}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]
    c.grid(rows, SKIN)
    return c.obj(outward=HC)


def eyes():
    """Narrow, deep-set eyes under the heavy brow: a grey-white almond, a
    dark iris pressed up under the lid and a dark lash line."""
    out = []
    fn = face_point
    for sx in (-1, 1):
        ac, zc = sx * 25.5, 1.1565 + DZ
        lens = []
        for i in range(12):
            t = i / 12 * math.tau
            x = math.cos(t)
            y = math.sin(t) * (0.0034 if math.sin(t) > 0 else 0.0028)
            lens.append((ac + x * 7.0, zc + y + 0.0009 * x * sx))
        if sx < 0:
            lens.reverse()
        out.append(mk.decal(f"{R}-eye{sx}", fn, lens, 0.0007, EYEW,
                            depth=0.0006, eps=0.05, ref=HC))
        iris = [(ac + math.cos(t) * 2.9, zc + math.sin(t) * 0.003 + 0.0007)
                for t in (i / 8 * math.tau for i in range(8))]
        out.append(mk.decal(f"{R}-iris{sx}", fn, iris, 0.0011, IRIS,
                            depth=0.0, eps=0.05, ref=HC))
        lash = []
        for i in range(7):
            t = math.pi * i / 6
            lash.append((ac + math.cos(t) * 7.8,
                         zc + math.sin(t) * 0.0044 + 0.001 * math.cos(t) * sx))
        for i in range(6, -1, -1):
            t = math.pi * i / 6
            lash.append((ac + math.cos(t) * 7.0,
                         zc + math.sin(t) * 0.0033 + 0.001 * math.cos(t) * sx))
        out.append(mk.decal(f"{R}-lash{sx}", fn, lash, 0.0014, IRIS,
                            depth=0.0, eps=0.05, ref=HC))
    return out


def brows():
    """Heavy, bushy brows whose outer ends flare up and out."""
    out = []
    for sx in (-1, 1):
        pts = []
        for ad, z, lift in ((5, 1.1705, 0.003), (12, 1.1745, 0.0042),
                            (20, 1.1775, 0.0046), (29, 1.1785, 0.0046),
                            (38, 1.1775, 0.0042), (46, 1.1795, 0.0048),
                            (52, 1.186, 0.0075)):
            z += DZ
            pts.append(face_point(sx * ad, z) + face_normal(sx * ad, z) * lift)
        out.append(mk.tube(f"{R}-brow{sx}", pts,
                           [(0.0034, 0.0026), (0.0048, 0.0034),
                            (0.0054, 0.0038), (0.0054, 0.0038),
                            (0.005, 0.0036), (0.0042, 0.003),
                            (0.0022, 0.0018)], BEARD, n=6,
                           caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- beard

def lock(x, k, sharp=0.55):
    """A row of rounded locks: +1 on a lock's crest, -1 in the groove."""
    s = math.sin(x * k)
    return math.copysign(abs(s) ** sharp, s)


def beard_shell():
    """The beard over the cheeks and jaw: a thick sculpted shell following
    the face, from the sideburns down under the chin."""
    top = [(0, 0.972), (10, 0.973), (16, 0.976), (22, 0.984), (30, 0.996),
           (40, 1.006), (52, 1.016), (66, 1.03), (80, 1.046), (88, 1.056)]
    cols = [0, 7, 14, 21, 29, 38, 48, 59, 70, 80, 88]
    cols = sorted(set([-a for a in cols] + cols))
    vs = [0.0, 0.12, 0.32, 0.56, 0.8, 1.0]
    zbot = 0.93

    def fn(ad, v):
        zt = table(top, abs(ad))
        z = lerp(zt, zbot, v ** 1.1)
        th = lerp(0.0014, 0.013, smooth(0.0, 0.55, v))
        th += 0.0022 * lock(ad * 0.18 + v * 1.4, 1.0) * smooth(0.05, 0.4, v)
        return face_point(ad, z) + face_normal(ad, z) * th

    return mk.sheet(f"{R}-beardshell", fn, cols, vs, BEARD, rim=0.0,
                    inside=HC)


# (z, half width, back y, front y, x drift): the long beard hanging over
# the chest, from under the jaw to its tip above the belt.
BEARD_RINGS = [(0.968, 0.064, 0.0, 0.096, 0.0),
               (0.945, 0.077, 0.018, 0.113, 0.0),
               (0.915, 0.084, 0.05, 0.131, 0.0),
               (0.88, 0.087, 0.098, 0.156, 0.001),
               (0.84, 0.083, 0.127, 0.173, 0.003),
               (0.8, 0.077, 0.137, 0.182, 0.006),
               (0.76, 0.069, 0.141, 0.186, 0.009),
               (0.72, 0.058, 0.144, 0.185, 0.012),
               (0.686, 0.046, 0.147, 0.181, 0.015),
               (0.657, 0.032, 0.15, 0.175, 0.017)]
BEARD_TIP = V(0.02, 0.166, 0.628)


def beard_mass():
    n = 26
    rings = []
    for j, (z, w, yb, yf, dx) in enumerate(BEARD_RINGS):
        mid, half = (yb + yf) / 2, (yf - yb) / 2
        ring = []
        for i in range(n):
            a = i / n * math.tau
            c_, s_ = math.cos(a), math.sin(a)
            x = w * spow(c_, 0.85)
            y = mid + half * spow(s_, 0.8)
            if s_ > -0.2:
                # Seven locks across the front, flowing a little to one
                # side as they fall; deeper toward the tip.
                amp = 0.0072 * (0.5 + 0.5 * smooth(0.97, 0.8, z))
                ph = 0.22 * j
                f = lock(a - math.pi / 2 + ph * 0.3, 7.0) * amp
                f *= smooth(-0.2, 0.25, s_)
                y += f * s_
                x += f * c_ * 0.8
            ring.append(V(x + dx, y, z))
        rings.append(ring)
    return mk.loft(f"{R}-beard", rings, BEARD, start="flat", end=BEARD_TIP)


def beard_locks():
    """Loose locks over the beard and two forked tails at its tip."""
    out = []
    specs = [
        # (points, radii)
        ([V(-0.05, 0.13, 0.9), V(-0.058, 0.162, 0.84), V(-0.056, 0.176, 0.78),
          V(-0.044, 0.178, 0.72), V(-0.03, 0.172, 0.675)],
         [(0.012, 0.007), (0.013, 0.008), (0.012, 0.0075), (0.009, 0.006),
          (0.004, 0.003)]),
        ([V(0.046, 0.132, 0.9), V(0.056, 0.164, 0.84), V(0.058, 0.178, 0.775),
          V(0.05, 0.179, 0.71), V(0.042, 0.172, 0.665)],
         [(0.012, 0.007), (0.013, 0.008), (0.012, 0.0075), (0.009, 0.006),
          (0.004, 0.003)]),
        ([V(0.004, 0.14, 0.9), V(-0.004, 0.176, 0.83), V(0.002, 0.19, 0.76),
          V(0.012, 0.186, 0.69), V(0.022, 0.176, 0.635)],
         [(0.013, 0.007), (0.015, 0.008), (0.013, 0.0075), (0.01, 0.006),
          (0.004, 0.003)]),
        # The forked tails.
        ([V(-0.028, 0.168, 0.7), V(-0.034, 0.17, 0.665), V(-0.03, 0.166,
                                                           0.638),
          V(-0.018, 0.162, 0.622)],
         [(0.013, 0.007), (0.011, 0.0065), (0.007, 0.005), (0.003, 0.003)]),
    ]
    for k, (pts, radii) in enumerate(specs):
        path = [V(p) for p in kit.smooth_path(pts, 2)]
        rr = []
        for i in range(len(path)):
            t = i / (len(path) - 1) * (len(radii) - 1)
            a, b = radii[int(t)], radii[min(len(radii) - 1, int(t) + 1)]
            f = t - int(t)
            rr.append((lerp(a[0], b[0], f), lerp(a[1], b[1], f)))
        out.append(mk.tube(f"{R}-lock{k}", path, rr, BEARD, n=6,
                           up=(0, 1, 0), caps=("dome", "dome")))
    return out


def moustache():
    """A long moustache from under the nose, drooping past the mouth into
    the beard."""
    out = []
    for sx in (-1, 1):
        pts = []
        for ad, z, lift in ((2, 1.1005, 0.0035), (9, 1.0995, 0.0055),
                            (17, 1.095, 0.0068), (24, 1.086, 0.0075),
                            (28, 1.073, 0.0085)):
            z += DZ
            pts.append(face_point(sx * ad, z) + face_normal(sx * ad, z) * lift)
        pts += [V(sx * 0.047, 0.118, 0.935), V(sx * 0.05, 0.14, 0.895),
                V(sx * 0.048, 0.158, 0.855)]
        path = [V(p) for p in kit.smooth_path(pts[:5], 2)] + pts[5:]
        m = len(path)
        radii = []
        for i in range(m):
            t = i / (m - 1)
            r = 0.0046 + 0.0042 * math.sin(math.pi * min(1.0, t * 1.6)) \
                - 0.004 * smooth(0.7, 1.0, t)
            radii.append((max(0.0018, r), max(0.0016, r * 0.72)))
        out.append(mk.tube(f"{R}-moustache{sx}", path, radii, BEARD, n=5,
                           up=(0, 1, 0.3), caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- hair

def hair():
    """Long grey hair falling from under the hat round the back and sides
    to the mantle's collar, in soft locks ending in ragged points."""
    us = [90 + i * 9 for i in range(21)]           # 90 .. 270 degrees
    vs = [0.0, 0.2, 0.4, 0.58, 0.74, 0.88, 1.0]

    def fn(ad, v):
        a = math.radians(ad)
        i = round((ad - 90) / 9)
        back = max(0.0, -math.cos(a))
        side = 1 - back
        zt = 1.135
        zb = lerp(1.0, 0.872, back ** 1.4)
        # Every other column ends in a lock's point.
        zb -= 0.022 * (i % 2) * (0.4 + 0.6 * back) * (0 < i < 20)
        z = lerp(zt, zb, v ** 0.9)
        # Hugging the skull, then falling straight and a little out.
        rx = 0.078 if z > 1.02 else lerp(0.078, 0.09, (1.02 - z) / 0.14)
        ry = lerp(0.092, 0.112, clamp01((1.07 - z) / 0.19))
        if z > 1.08:
            q = (z - 1.08) / 0.055
            rx *= 1 - 0.08 * q
            ry *= 1 - 0.1 * q
        wave = 0.0085 * lock(a * 9.0 + 0.4 + v * 0.6, 1.0) * \
            smooth(0.1, 0.55, v)
        # The front edge by the ear tucks in thin.
        edge = min(ad - 90, 270 - ad) / 9.0
        tuck = 0.004 * (1 - min(1.0, edge))
        s_, c_ = math.sin(a), math.cos(a)
        x = (rx + wave - tuck) * spow(s_, 0.9)
        y = CY - 0.006 + (ry + wave - tuck) * spow(c_, 0.9) - 0.004 * side
        return V(x, y, z)

    return mk.sheet(f"{R}-hair", fn, us, vs, BEARD, rim=0.006,
                    inside=V(0, 0, 1.0), rim_edges=("v1", "u0", "u1"))


# ------------------------------------------------------------- hat

HAT_BASE = V(0, 0.0, 1.106)
HAT_TILT = math.radians(7)
HAT_RX, HAT_RY = 0.09, 0.1
HAT_L = 0.385
# (height along the spine, radius factor): the band first, then a tall
# concave cone.
HAT_PROF = [(0.0, 1.0), (0.003, 1.055), (0.013, 1.07), (0.023, 1.055),
            (0.027, 0.99), (0.065, 0.905), (0.115, 0.775), (0.165, 0.65),
            (0.21, 0.535), (0.25, 0.435), (0.282, 0.35), (0.3, 0.3),
            (0.325, 0.235), (0.35, 0.16), (0.37, 0.09)]
HAT_BEND = 0.28


def hat_dir(th):
    return V(-0.14 * math.sin(th), -math.sin(th), math.cos(th)).normalized()


def hat_spine(h):
    """The cone's centre line: straight, then folding back and a little to
    the left above a crease."""
    p = V(0, 0, 0)
    th = 0.0
    steps = 48
    dh = h / steps
    for i in range(steps):
        hh = (i + 0.5) * dh
        k = max(0.0, (hh - 0.17) / (HAT_L - 0.17))
        th = 0.35 * k + 1.0 * smooth(HAT_BEND - 0.02, HAT_BEND + 0.03, hh) \
            * k
        p += hat_dir(th) * dh
    return p, th


def hat():
    pieces = []
    n = 24
    rings = []
    for k, (h, rk) in enumerate(HAT_PROF):
        c, th = hat_spine(h)
        tang = hat_dir(th)
        side = V(1, 0, 0)
        up = tang.cross(side).normalized()        # toward the front
        side = up.cross(tang).normalized()
        ring = []
        for i in range(n):
            a = i / n * math.tau
            ca, sa = math.cos(a), math.sin(a)
            r = rk
            if 0.001 < h < 0.025:
                # The embroidered band: a raised row of stitches.
                if k == 2:
                    r += 0.012 * (i % 2)
            else:
                # Felt dents, and the crease where the tip folds back: the
                # back pinches in, the front bulges over it.
                r *= 1 + 0.055 * math.sin(3 * a + h * 11 + 0.6) * \
                    smooth(0.04, 0.14, h)
                r *= 1 + 0.04 * math.sin(5 * a - h * 17) * smooth(0.1, 0.25, h)
                pinch = gauss(h, HAT_BEND, 0.022)
                r *= 1 - 0.26 * pinch * max(0.0, -sa) ** 1.5
                r *= 1 + 0.1 * pinch * max(0.0, sa) ** 2
            ring.append(c + side * ca * HAT_RX * r + up * sa * HAT_RY * r)
        rings.append(ring)
    tip, th = hat_spine(HAT_L)
    tip = tip + hat_dir(th) * 0.012
    cone = mk.loft(f"{R}-cone", rings, TEAM,
                   bands=lambda i, j: GOLD if isinstance(j, int) and j <= 3
                   else TEAM, start="flat", end=tip)
    pieces.append(cone)

    # The brim: soft felt, drooping at the sides and back with a slow wave
    # round it, its edge rolled.
    prof = [(0.0, 0.004), (0.4, -0.001), (0.8, -0.011), (1.0, -0.021),
            (1.03, -0.028), (0.95, -0.032), (0.5, -0.015), (0.0, -0.007)]
    m = 32
    c = mk.Mesh(f"{R}-brim", TEAM)
    rows = []
    for t, dz in prof:
        row = []
        for i in range(m):
            a = i / m * math.tau
            ca, sa = math.cos(a), math.sin(a)
            x = lerp(HAT_RX, 0.19, t) * ca
            y = lerp(HAT_RY, 0.196, t) * sa
            droop = -0.022 * t ** 1.6 * (1 - 0.65 * max(0.0, sa))
            wave = t ** 2 * (0.009 * math.sin(3 * a + 0.9) +
                             0.004 * math.sin(5 * a + 2.0))
            row.append(c.v(V(x, y, dz + droop + wave)))
        rows.append(row)
    c.grid(rows, TEAM, closed=True)
    for i in range(m):
        j = (i + 1) % m
        c.face((rows[-1][i], rows[-1][j], rows[0][j], rows[0][i]), TEAM)
    pieces.append(c.obj(recalc=True))
    mat = (Matrix.Translation(HAT_BASE) @
           Matrix.Rotation(HAT_TILT, 4, "X"))
    mk.transform(pieces, mat)
    return pieces


def head_parts():
    return ([face()] + eyes() + brows() + [beard_shell(), beard_mass()] +
            beard_locks() + moustache() + [hair()] + hat())


# ------------------------------------------------------------- robe

# (z, half width, front depth, back depth)
ROBE = [(0.905, 0.068, 0.066, 0.066), (0.872, 0.138, 0.1, 0.094),
        (0.84, 0.172, 0.114, 0.102), (0.78, 0.172, 0.125, 0.106),
        (0.7, 0.157, 0.122, 0.103), (0.64, 0.146, 0.116, 0.1),
        (0.6, 0.138, 0.11, 0.098), (0.565, 0.145, 0.117, 0.105),
        (0.5, 0.158, 0.132, 0.12), (0.42, 0.174, 0.152, 0.138),
        (0.33, 0.19, 0.17, 0.155), (0.24, 0.205, 0.188, 0.171),
        (0.16, 0.217, 0.203, 0.184), (0.095, 0.226, 0.213, 0.192),
        (0.013, 0.232, 0.22, 0.198)]
ROBE_P = 2.3


def robe_sec(z):
    return table([(r[0],) + r[1:] for r in reversed(ROBE)], z)


def fold_wave(a):
    return math.sin(10 * a + 0.3 + 0.5 * math.sin(3 * a))


def robe_fold(a, z):
    """Radial fold offset: deep pipe folds on the skirt, gathered under the
    belt, and a gentle blousing over it."""
    skirt = smooth(0.58, 0.05, z)
    w = fold_wave(a)
    ridge = (abs(w) ** 0.5) * math.copysign(1, w)
    f = skirt ** 1.1 * 0.024 * ridge
    f += 0.0045 * math.sin(22 * a) * gauss(z, 0.54, 0.05)
    f += 0.009 * gauss(z, 0.632, 0.02)
    f += 0.003 * math.sin(7 * a + 1.0) * smooth(0.6, 0.85, z)
    return f


def open_w(z):
    """Half width of the robe's front opening: closed under the beard, it
    parts below the belt to show the under-robe."""
    return 0.003 + 0.05 * smooth(0.56, 0.06, z) ** 0.8


# Front columns (k): 0 the under-robe's middle, 1 its edge under the trim,
# 2 and 3 the inner and outer edges of the outer robe's gold trim.
FRONT = {0: (0.0, -0.005), 1: (-0.0025, -0.0045), 2: (0.0, 0.005),
         3: (0.013, 0.005)}


def band_angle(k, z):
    """The angle (degrees) of a front column at height z: the trim keeps
    its width down the flaring skirt."""
    ryf = robe_sec(z)[1]
    w = max(0.0, open_w(z) + FRONT[abs(k)][0]) if abs(k) else 0.0
    return math.copysign(math.degrees(w / ryf), k)


def robe_point(ad, z, off=0.0, fold=True, band=None):
    a = math.radians(ad)
    rx, ryf, ryb = robe_sec(z)
    s_, c_ = math.sin(a), math.cos(a)
    f = robe_fold(a, z) if fold else 0.0
    # The front edges are free of the skirt's folds; the trim stands proud
    # and the under-robe lies a little back.
    if band is not None:
        f = robe_fold(0.0, z) + band
    e = 2.0 / ROBE_P
    x = (rx + f + off) * spow(s_, e)
    y = ((ryf if c_ >= 0 else ryb) + f + off) * spow(c_, e)
    return V(x, y, z)


def hem_lift(ad):
    """The hem rises at the front over the toes, and the fold ridges hang
    a little lower than the valleys."""
    a = math.radians(ad)
    front = max(0.0, math.cos(a))
    return 0.06 * front ** 3 - 0.007 * fold_wave(a)


def robe():
    reg = [11 + 9.8 * k for k in range(18)]
    # Columns: regular angles, and the front's seven (see FRONT), placed
    # per row.
    cols = [-a for a in reversed(reg)] + \
        ["-3", "-2", "-1", "0", "1", "2", "3"] + reg
    # (z, radial offset, material of the band below, hem weight, pattern)
    rows = [(0.905, 0.0, TEAM, 0, 0), (0.84, 0.0, TEAM, 0, 0), (0.74, 0.0, TEAM, 0, 0),
            (0.64, 0.0, TEAM, 0, 0),
            (0.6, 0.0, TEAM, 0, 0), (0.565, 0.0, TEAM, 0, 0),
            (0.5, 0.0, TEAM, 0, 0), (0.42, 0.0, TEAM, 0.1, 0),
            (0.33, 0.0, TEAM, 0.3, 0), (0.24, 0.0, TEAM, 0.55, 0),
            (0.16, 0.0, TEAM, 0.8, 0),
            # The embroidered hem: a fine gold line, then a broad band
            # stitched with a zigzag, rolled under into the dark lining.
            (0.106, 0.0, GOLD, 1, 0), (0.102, 0.0045, GOLD, 1, 0),
            (0.093, 0.0045, TEAM2, 1, 0), (0.089, 0.0, TEAM, 1, 0),
            (0.07, 0.0, GOLD, 1, 0), (0.065, 0.0065, GOLD, 1, 0),
            (0.046, 0.0085, GOLD, 1, 1), (0.028, 0.0065, GOLD, 1, 0),
            (0.02, 0.0, TEAM2, 1, 0), (0.027, -0.011, TEAM2, 1, 0)]
    c = mk.Mesh(f"{R}-robe", TEAM)
    grid = []
    for z, off, _, hw, pat in rows:
        row = []
        for i, col in enumerate(cols):
            band = isinstance(col, str)
            ad = band_angle(int(col), z) if band else col
            o = off
            dz = 0.0
            if pat:
                o += 0.0026 * (i % 2)
                dz = 0.009 * ((i % 2) - 0.5)
            zz = z + hem_lift(ad) * hw + dz
            p = robe_point(ad, z, o,
                           band=FRONT[abs(int(col))][1] if band else None)
            row.append(c.v(V(p.x, p.y, zz)))
        grid.append(row)
    n = len(cols)

    def mat(i, j):
        m = rows[j][2]
        if m != TEAM or j < 1 or i == n - 1:
            return m
        a, b = cols[i], cols[i + 1]
        if isinstance(a, str) and isinstance(b, str):
            k = max(abs(int(a)), abs(int(b)))
            return TEAM2 if k <= 1 else GOLD
        return m

    c.grid(grid, mat, closed=True)
    c.fan(grid[0], V(0, 0, 0.912), TEAM, flip=True)
    c.fan(grid[-1], V(0, 0, 0.03), TEAM2)
    return c.obj(recalc=True)


def collar():
    """A standing collar round the neck, gold edged."""
    rings = []
    for z, r in ((0.895, 0.07), (0.93, 0.061), (0.94, 0.06),
                 (0.944, 0.054)):
        rings.append([V(x, y + 0.002, z) for x, y, _ in mk.sup(12, r, r)])
    return mk.loft(f"{R}-collar", rings, TEAM, bands={1: GOLD, 2: GOLD},
                   start=None, end="flat")


def belt():
    pieces = []
    n = 24
    rings = []
    for z, off in ((0.582, 0.004), (0.585, 0.012), (0.615, 0.012),
                   (0.618, 0.004)):
        rings.append([robe_point(i / n * 360.0, 0.6, off, fold=False)
                      + V(0, 0, z - 0.6) for i in range(n)])
    pieces.append(mk.loft(f"{R}-belt", rings, LEATHER))
    front = robe_point(0.0, 0.6, 0.012, fold=False).y
    # A silver buckle and the belt's tail hanging down beside it.
    loop = [V(x, front + 0.004, 0.6 + z) for x, z, _ in
            mk.sup(10, 0.022, 0.023, 3.4)]
    loop.append(loop[0])
    pieces.append(mk.tube(f"{R}-buckle", loop, [0.0045] * len(loop), SILVER,
                          n=5, up=(0, 1, 0), caps=(None, None)))
    pieces.append(mk.tube(f"{R}-pin", [V(-0.02, front + 0.007, 0.6),
                                       V(0.012, front + 0.008, 0.6)],
                          [0.003, 0.003], SILVER, n=4, caps=("pole", "pole")))
    tail = [V(-0.036, front + 0.006, 0.598), V(-0.042, front + 0.012, 0.56),
            V(-0.046, front + 0.02, 0.5)]
    pieces.append(mk.tube(f"{R}-tail", tail, [(0.004, 0.012)] * 3, LEATHER,
                          n=6, up=(0, 1, 0), caps=("flat", "flat")))
    return pieces


def pouch(name, ad, z_top, size, flap_mat=LEATHER):
    """A leather belt pouch with a flap and a silver stud."""
    w, h, d = size
    a = math.radians(ad)
    top = robe_point(ad, z_top, 0.012, fold=False)
    out = V(math.sin(a), math.cos(a), 0)
    side = V(0, 0, 1).cross(out).normalized()
    rings = []
    for k, (zz, ww, dd) in enumerate(((0.0, 0.85, 0.6), (-0.15, 1.0, 0.95),
                                      (-0.55, 1.0, 1.0), (-0.88, 0.9, 0.9),
                                      (-1.0, 0.6, 0.5))):
        rings.append([top + side * x + out * (y + d * 0.55) + V(0, 0, zz * h)
                      for x, y, _ in mk.sup(12, w * ww, d * dd * 0.5, 2.8)])
    bag = mk.loft(f"{name}-bag", rings, LEATHER, start="pole", end="pole")

    def flap(u, v):
        return (top + side * (u * w * 1.06) +
                out * (d * 1.08 + 0.002 * math.sin(v * 2.6)) +
                V(0, 0, 0.006 - v * h * 0.55 - 0.006 * (1 - u * u) * v))

    fl = mk.sheet(f"{name}-flap", flap, [-1, -0.5, 0, 0.5, 1], [0, 0.5, 1],
                  flap_mat, rim=0.003, inside=top)
    stud = mk.ball(f"{name}-stud", 0.0055, top + out * (d * 1.12) +
                   V(0, 0, -h * 0.5), SILVER, seg=6, rings=4)
    return [bag, fl, stud]


def book():
    """A small leather-bound book with gold corners, hung from the belt on
    the left hip by a strap."""
    ad = -58.0
    a = math.radians(ad)
    top = robe_point(ad, 0.585, 0.012, fold=False)
    out = V(math.sin(a), math.cos(a), 0)
    side = V(0, 0, 1).cross(out).normalized()
    # The book hangs a little tilted, its spine toward the front.
    down = V(0, 0, -1)
    tilt = Matrix.Rotation(math.radians(-12), 3, out)
    x_ax = tilt @ side
    z_ax = tilt @ -down
    y_ax = z_ax.cross(x_ax)
    centre = top + out * 0.026 + V(0, 0, -0.07)
    m = mk.basis(x_ax, y_ax, z_ax, centre)
    pieces = []
    W, H, D = 0.032, 0.046, 0.014     # half sizes
    cover = mk.rbox(f"{R}-bookcover", (W * 2, D * 2, H * 2), V(0, 0, 0),
                    LEATHER, levels=1, crease=0.8)
    pages = mk.rbox(f"{R}-bookpages", (W * 1.86, D * 1.5, H * 1.9),
                    V(0.003, 0, 0), BEARD, levels=1, crease=0.9)
    # Push the pages out of the fore edge side.
    for v in pages.data.vertices:
        if v.co.x > 0:
            v.co.x += 0.0035
    pieces += [cover, pages]
    for sx in (-1, 1):
        for sz in (-1, 1):
            pieces.append(kit.box(f"{R}-corner{sx}{sz}",
                                  (0.012, D * 2.25, 0.012),
                                  (W * 0.8 * sx + 0.004, 0, H * 0.84 * sz),
                                  mat=GOLD, grid=False))
    pieces.append(mk.rbox(f"{R}-clasp", (0.014, D * 2.3, 0.01),
                          V(W + 0.004, 0, 0), SILVER, levels=1, crease=0.5))
    mk.transform(pieces, m)
    strap = mk.tube(f"{R}-bookstrap", [top + V(0, 0, 0.02),
                                       top + out * 0.012 + V(0, 0, -0.012),
                                       centre + z_ax * H * 0.9 +
                                       out * 0.004],
                    [(0.003, 0.009)] * 3, LEATHER, n=6, up=out,
                    caps=(None, None))
    return pieces + [strap]


# ------------------------------------------------------------- mantle

# (half width, front depth, back depth, z side, z front, z back,
#  front edge angle): control rows from the collar down to the hem.
MANTLE_ROWS = [
    (0.074, 0.072, 0.082, 0.957, 0.942, 0.962, 32),
    (0.1, 0.092, 0.106, 0.94, 0.918, 0.944, 38),
    (0.152, 0.114, 0.124, 0.934, 0.892, 0.912, 52),
    (0.205, 0.13, 0.136, 0.91, 0.86, 0.852, 78),
    (0.232, 0.138, 0.148, 0.845, 0.815, 0.78, 100),
    (0.242, 0.14, 0.164, 0.76, 0.75, 0.69, 112),
    (0.252, 0.14, 0.186, 0.64, 0.64, 0.53, 117),
    (0.265, 0.14, 0.21, 0.52, 0.52, 0.37, 120),
    (0.282, 0.14, 0.236, 0.42, 0.42, 0.21, 122),
]


def crom(vals, v):
    """Catmull-Rom through a list of numbers or vectors at index v."""
    i = min(len(vals) - 2, max(0, int(math.floor(v))))
    t = v - i
    p0 = vals[max(0, i - 1)]
    p1, p2 = vals[i], vals[i + 1]
    p3 = vals[min(len(vals) - 1, i + 2)]
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t +
                  (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                  (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def mantle_point(u, j):
    rx, ryf, ryb, zs, zf, zb, a0 = MANTLE_ROWS[j]
    ad = lerp(a0, 360 - a0, u)
    a = math.radians(ad)
    s_, c_ = math.sin(a), math.cos(a)
    e = 2.0 / 2.1
    x = rx * spow(s_, e)
    y = (ryf if c_ >= 0 else ryb) * spow(c_, e)
    z = lerp(zf if c_ >= 0 else zb, zs, s_ * s_)
    return V(x, y, z), a


def mantle():
    """The travelling mantle: a rolled collar, a cape rounding over the
    shoulders and a long fall down the back in deep folds, open in front
    so the arms and the robe show."""
    nu = 31
    us = [i / (nu - 1) for i in range(nu)]
    last = len(MANTLE_ROWS) - 1
    vs = [0, 1, 2, 2.5, 3, 4, 5, 6, 7, 8]

    def fn(u, v):
        pts = [mantle_point(u, j)[0] for j in range(len(MANTLE_ROWS))]
        p = crom(pts, v)
        a = math.atan2(p.x, p.y)
        t = v / last
        back = max(0.0, -math.cos(a))
        # Pipe folds: broad rounded ridges between narrow deep valleys,
        # six across, each valley on a column so it stays crisp.
        g = abs(math.sin(6 * math.pi * u))
        ridge = 2.0 * g ** 0.85 - 1.1
        w8 = ridge
        fold = smooth(0.12, 0.75, t) * (0.3 + 0.7 * back) * \
            (0.03 * ridge + 0.004 * math.sin(15 * a + 1.3))
        # A soft fold where the cape rounds over each shoulder.
        fold += 0.006 * gauss(t, 0.4, 0.08) * math.sin(4 * a)
        out = V(p.x, p.y, 0)
        out = out.normalized() if out.length > 1e-6 else V(0, -1, 0)
        p += out * fold
        p.z += t * t * (0.02 * w8 + 0.008 * math.sin(3 * a + 2)) * \
            (0.3 + 0.7 * back)
        return p

    return mk.sheet(f"{R}-mantle", fn, us, vs, MANTLE, rim=0.007,
                    inside=V(0, 0, 0.75), back=True,
                    rim_edges=("u0", "u1", "v1"))


def clasps():
    """Silver clasps at the mantle's collar and the chain between them."""
    out = []
    pts = []
    for sx in (-1, 1):
        rx, ryf, ryb, zs, zf, zb, a0 = MANTLE_ROWS[2]
        a = math.radians(a0 + 3)
        e = 2.0 / 2.2
        x = sx * rx * spow(math.sin(a), e) * 1.02
        y = ryf * spow(math.cos(a), e) + 0.006
        z = lerp(zf, zs, math.sin(a) ** 2) - 0.006
        at = V(x, y, z)
        pts.append(at)
        nrm = V(x * 0.8, y, 0.25).normalized()
        xa = V(0, 0, 1).cross(nrm).normalized()
        m = mk.basis(xa, nrm.cross(xa), nrm, at - nrm * 0.002)
        disc = [(xx, yy) for xx, yy, _ in mk.sup(8, 0.013, 0.013)]
        out.append(mk.slab(f"{R}-clasp{sx}", disc, 0.0045, SILVER,
                           matrix=m))
        out.append(mk.ball(f"{R}-boss{sx}", 0.0065, at + nrm * 0.004,
                           SILVER, seg=6, rings=3))
    a, b = pts
    mid = lerp(a, b, 0.5) + V(0, 0.012, -0.03)
    chain = [V(p) for p in kit.smooth_path([a, lerp(a, mid, 0.6) +
                                            V(0, 0, -0.006), mid,
                                            lerp(b, mid, 0.6) +
                                            V(0, 0, -0.006), b], 2)]
    out.append(mk.tube(f"{R}-chain", chain, [0.0028] * len(chain), SILVER,
                       n=4, caps=(None, None)))
    return out


def torso_parts():
    return ([robe(), collar(), mantle()] + clasps() + belt() +
            pouch(f"{R}-pouch1", 52.0, 0.583, (0.03, 0.058, 0.03)) +
            pouch(f"{R}-pouch2", 118.0, 0.583, (0.026, 0.05, 0.026)) +
            book())


# ------------------------------------------------------------- arms

def fist(name, c, xax, kax, chir, mat=SKIN):
    """A closed fist round a pole along Z (the index finger's end), with
    its fingertips toward X and knuckles toward K; the wrist is at -X."""
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
        for x, y, ang in mk.sup(10, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.004 * (1 if px > 0.004 else 0.5)
                py += 0.003 if py < -0.01 else 0.0
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0024
                py += 0.0024
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [mk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                      end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(mk.tube(f"{name}-thumb", thumb, [0.0098, 0.0086, 0.0078],
                          mat, n=6))
    pieces.append(mk.tube(f"{name}-heel", [V(-0.05, 0.002, -0.004),
                                           V(-0.03, 0.0, 0.0)],
                          [(0.021, 0.026), (0.025, 0.03)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    for o in pieces:
        for v in o.data.vertices:
            v.co *= 0.94
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = mk.basis(xax, kax, zax, c)
    mk.transform(pieces, m)
    return pieces


def sleeve(name, s, e, w, bell=0.078, sag=0.034):
    """A wide robe sleeve from the shoulder to just past the wrist: snug
    over the upper arm, widening into a bell that hangs under the forearm,
    its mouth cut longer underneath, with an embroidered gold cuff and the
    dark lining inside."""
    fore = (w - e).normalized()
    path = [s + (s - e).normalized() * 0.015, s, lerp(s, e, 0.5), e,
            lerp(e, w, 0.35), lerp(e, w, 0.7), w + fore * 0.012]
    radii = [0.046, 0.05, 0.049, 0.048, 0.053, 0.064, bell]
    sags = [0.0, 0.0, 0.0, 0.004, 0.012, 0.022, sag]
    n = 16
    rings = []
    downs = []
    for i, p in enumerate(path):
        a = path[max(0, i - 1)]
        b = path[min(len(path) - 1, i + 1)]
        tang = (b - a).normalized()
        down = V(0, 0, -1) - tang * (-tang.z)
        if down.length < 1e-4:
            down = V(0, -1, 0)
        down.normalize()
        side = tang.cross(down).normalized()
        downs.append((down, side))
        r = radii[i]
        k = i / 6
        ring = []
        for q in range(n):
            ang = q / n * math.tau
            ca, sa = math.cos(ang), math.sin(ang)
            # Cloth folds along the sleeve, fuller toward the bell; the
            # bell's underside hangs deeper.
            fold = 1 + (0.04 + 0.08 * k) * math.sin(5 * ang + 1.1 * i)
            rd = r * (1.0 + 0.3 * k * k * max(0.0, ca))
            ring.append(p + down * (ca * rd * fold + sags[i]) +
                        side * sa * r * fold)
        rings.append(ring)
    # The mouth: cut on a slant, longer underneath.
    down, side = downs[-1]
    last = rings[-1]
    centre = sum(last, Vector()) / n
    reach = [fore * (0.016 * ((p - centre).normalized().dot(down)))
             for p in last]
    mouth = [p + d for p, d in zip(last, reach)]
    cuff_out = [centre + (p - centre) * (1.065 + 0.03 * (q % 2)) + d
                for q, (p, d) in enumerate(zip(last, reach))]
    cuff_edge = [q + fore * 0.022 for q in cuff_out]
    lip = [centre + (p - centre) * 0.9 + fore * 0.022 + d
           for p, d in zip(last, reach)]
    inner = [centre + (p - centre) * 0.82 - fore * 0.035 for p in last]
    rings[-1] = mouth
    k = len(rings)
    all_rings = rings + [cuff_out, cuff_edge, lip, inner]
    bands = {k - 1: GOLD, k: GOLD, k + 1: GOLD, k + 2: TEAM2}

    def bm(i, j):
        if isinstance(j, int):
            if j == k:
                # The cuff's embroidery: alternate stitches in the dark.
                return GOLD
            return bands.get(j, TEAM)
        return TEAM2 if j == "end" else TEAM

    return mk.loft(f"{name}-sleeve", all_rings, TEAM, bands=bm,
                   start="pole", end="flat")


def arm_joints(s, target, pole, fist_len):
    e0 = mk.ik(s, target, UPPER, FORE + fist_len, pole)
    fdir = (target - e0).normalized()
    w = target - fdir * fist_len
    e = mk.ik(s, w, UPPER, FORE, pole)
    return e, w


def build_armR():
    e, w = arm_joints(S_R, FIST_R, POLE_R, WRIST_FIST)
    xax = FIST_R - w
    xax = (xax - STAFF_D * xax.dot(STAFF_D)).normalized()
    kax = xax.cross(STAFF_D).normalized()
    pieces = fist(f"{R}-handR", FIST_R, xax, kax, -1)
    pieces.append(mk.tube(f"{R}-wristR", [w - (w - e).normalized() * 0.03,
                                          w + xax * 0.012],
                          [0.022, 0.024], SKIN, n=8, caps=(None, None)))
    pieces.append(mk.ball(f"{R}-shoulderR", 0.05, S_R, TEAM, seg=8,
                          rings=5))
    pieces.append(mk.ball(f"{R}-elbowR", 0.046, e, TEAM, seg=8, rings=5))
    pieces.append(sleeve(f"{R}-armR", S_R, e, w, bell=0.074, sag=0.03))
    return pieces, e, w


def hand_frame():
    e, w = arm_joints(S_L, WRIST_L, POLE_L, 0.0)
    fore = (w - e).normalized()
    # The hand held level, palm up, turned a little in toward the body.
    f = V(fore.x * 0.6 + 0.12, fore.y, fore.z * 0.25).normalized()
    u = V(0, 0, 1) - f * f.z
    u.normalize()
    s = f.cross(u).normalized()           # toward the body (+x)
    return e, w, f, u, s


def build_armL():
    e, w, f, u, s = hand_frame()
    pieces = [mk.ball(f"{R}-shoulderL", 0.05, S_L, TEAM, seg=8, rings=5),
              mk.ball(f"{R}-elbowL", 0.046, e, TEAM, seg=8, rings=5),
              sleeve(f"{R}-armL", S_L, e, w, bell=0.076, sag=0.036)]
    return pieces, e, w


def open_hand():
    """The casting hand, open and palm up, the fingers a little spread and
    curling up round the flame, the thumb out to the side."""
    e, w, f, u, s = hand_frame()
    pieces = []
    p = w + f * 0.04 + u * 0.004
    m = mk.basis(s, f, u, p)
    palm = mk.rbox(f"{R}-palm", (0.054, 0.056, 0.02), V(0, 0, 0), SKIN,
                   levels=2, crease=0.3)
    for v in palm.data.vertices:
        # Cupped: the middle of the palm dips, the heel is fuller.
        if v.co.z > 0:
            v.co.z -= 0.004 * (1 - (v.co.x / 0.027) ** 2)
        if v.co.y < -0.01:
            v.co.x *= 1.05
    mk.transform([palm], m)
    pieces.append(palm)
    pieces.append(mk.tube(f"{R}-wristL", [w - f * 0.04, w + f * 0.02],
                          [0.021, 0.024], SKIN, n=8, caps=(None, None)))
    # Fingers, index (thumb side, -s) to little finger: three joints each,
    # curling gently upward.
    for k, (off, length, r, curl, sp) in enumerate((
            (-0.0185, 0.05, 0.0068, 0.16, -0.16),
            (-0.0062, 0.055, 0.007, 0.2, -0.05),
            (0.0062, 0.052, 0.0068, 0.24, 0.05),
            (0.0185, 0.042, 0.006, 0.3, 0.16))):
        base = p + f * 0.024 + s * off + u * 0.003
        d = (f + s * sp).normalized()
        pts = [base - d * 0.006]
        seg = length / 3
        ang = 0.05
        for j in range(3):
            ang += curl * (0.7 + 0.3 * j)
            dd = (d * math.cos(ang) + u * math.sin(ang)).normalized()
            pts.append(pts[-1] + dd * seg)
        pieces.append(mk.tube(f"{R}-finger{k}", pts,
                              [r * 1.1, r, r * 0.9, r * 0.75], SKIN, n=6,
                              up=u, caps=(None, "dome")))
    thumb = [p - s * 0.02 - f * 0.014,
             p - s * 0.036 + f * 0.002 + u * 0.004,
             p - s * 0.046 + f * 0.018 + u * 0.012,
             p - s * 0.05 + f * 0.032 + u * 0.022]
    pieces.append(mk.tube(f"{R}-thumbL", thumb, [0.0105, 0.0094, 0.0084,
                                                 0.007], SKIN, n=6,
                          caps=("dome", "dome")))
    return pieces, p, u, f, s


def flame(p, u, f, s):
    """A small ball of fire hovering over the palm: a round heart with a
    crown of tongues licking up and curling off it, and a few sparks."""
    c = p + u * 0.056 + f * 0.004
    R0 = 0.034
    pieces = [mk.ball(f"{R}-fireball", R0, c, FIRE, seg=10, rings=6)]
    for k in range(7):
        a = k / 7 * math.tau + 0.3
        tall = (0.042, 0.06, 0.036, 0.055, 0.04, 0.064, 0.038)[k]
        twist = (0.7, -0.6, 0.8, -0.7, 0.6, -0.8, 0.7)[k]
        pts = []
        for j in range(5):
            t = j / 4
            ang = a + twist * t
            o = s * math.cos(ang) + f * math.sin(ang)
            # From the ball's shoulder, out a little, then up and in.
            rad = R0 * (0.92 + 0.35 * math.sin(math.pi * t * 0.8) - 0.75 *
                        t * t)
            pts.append(c + o * rad + u * (R0 * 0.25 + tall * 1.15 * t))
        out = s * math.cos(a) + f * math.sin(a)
        pieces.append(mk.tube(f"{R}-tongue{k}", pts,
                              [0.012, 0.011, 0.008, 0.0045, 0.0012], FIRE,
                              n=4, up=out, caps=("dome", "pole")))
    pieces.append(mk.tube(f"{R}-crown",
                          [c + u * 0.012, c + u * 0.056 + s * 0.006,
                           c + u * 0.1 - s * 0.006 + f * 0.004,
                           c + u * 0.124 + s * 0.004],
                          [0.019, 0.012, 0.005, 0.001], FIRE, n=6,
                          caps=("dome", "pole")))
    for k, (dx, dy, dz, r) in enumerate(((0.036, 0.012, 0.075, 0.0045),
                                         (-0.032, -0.012, 0.09, 0.0038),
                                         (0.01, 0.034, 0.112, 0.0032))):
        pieces.append(mk.ball(f"{R}-spark{k}", r,
                              c + s * dx + f * dy + u * dz, FIRE, seg=5,
                              rings=3))
    return pieces


# ------------------------------------------------------------- staff

def staff():
    """A tall gnarled staff: a twisting, knotted dark-wood shaft with a
    silver shoe, swelling into a knotted head bound by a silver collar
    from which four claws hold the glowing crystal."""
    pieces = []
    L = (STAFF_T - STAFF_B).length
    d = STAFF_D
    side = d.cross(V(0, 1, 0)).normalized()
    fwd = side.cross(d).normalized()
    nr = 8
    ts = [i / 30 for i in range(31)]
    knots = [(0.24, 0.006, 0.03), (0.47, 0.005, 0.025), (0.83, 0.007, 0.03),
             (0.93, 0.009, 0.025)]
    rings = []
    for i, t in enumerate(ts):
        # A crooked centre line.
        wob = (side * (0.006 * math.sin(t * 17 + 0.5) +
                       0.009 * gauss(t, 0.33, 0.07) -
                       0.007 * gauss(t, 0.75, 0.06)) +
               fwd * (0.006 * math.cos(t * 13 + 1.2) -
                      0.006 * gauss(t, 0.6, 0.08)))
        c = STAFF_B + d * (L * t) + wob
        r = lerp(0.0205, 0.0175, smooth(0.0, 0.6, t))
        r = lerp(r, 0.021, smooth(0.8, 1.0, t))
        r += 0.004 * smooth(0.97, 1.0, t)
        for kt, amp, wd in knots:
            r += amp * gauss(t, kt, wd)
        twist = t * 5.5 * math.tau / 8 * 8 / math.tau * 1.0
        ring = []
        for k in range(nr):
            a = k / nr * math.tau + twist
            ridge = 1.0 + 0.11 * math.cos(3 * a + t * 20) + \
                0.06 * math.sin(5 * a - t * 31)
            ring.append(c + (side * math.cos(a) + fwd * math.sin(a)) * r *
                        ridge)
        rings.append(ring)
    top_c = sum(rings[-1], Vector()) / nr
    pieces.append(mk.loft(f"{R}-shaft", rings, WOOD, start="pole",
                          end=top_c + d * 0.004))
    # Broken branch stubs at two of the knots.
    for k, (t, ang, ln) in enumerate(((0.24, 1.2, 0.028), (0.83, -2.0, 0.024))):
        c = STAFF_B + d * (L * t)
        out = (side * math.cos(ang) + fwd * math.sin(ang)).normalized()
        dirv = (out + d * 0.8).normalized()
        pieces.append(mk.tube(f"{R}-stub{k}", [c, c + dirv * ln * 0.6,
                                               c + dirv * ln],
                              [0.012, 0.009, 0.006], WOOD, n=6,
                              caps=(None, "flat")))
    # The silver shoe at the foot.
    shoe = [[STAFF_B + d * z + (side * x + fwd * y)
             for x, y, _ in mk.sup(10, r, r)]
            for z, r in ((0.0, 0.019), (0.003, 0.023), (0.028, 0.0235),
                         (0.034, 0.0215))]
    pieces.append(mk.loft(f"{R}-shoe", shoe, SILVER, start="flat",
                          end=None))
    # The collar round the head of the staff.
    col_c = STAFF_T - d * 0.01
    collar_r = [[col_c + d * z + side * x + fwd * y
                 for x, y, _ in mk.sup(12, r, r)]
                for z, r in ((-0.018, 0.024), (-0.013, 0.0285),
                             (0.012, 0.0285), (0.018, 0.024))]
    pieces.append(mk.loft(f"{R}-collar", collar_r, SILVER, start=None,
                          end="flat"))
    # The crystal: a long faceted amber point.
    cc = STAFF_T + d * 0.072
    cr = []
    for z, r, ph in ((-0.042, 0.022, 0.0), (0.0, 0.037, 0.12),
                     (0.032, 0.035, 0.05)):
        cr.append([cc + d * z + (side * math.cos(a) + fwd * math.sin(a)) *
                   r * (1 + 0.08 * math.sin(3 * a + 1)) for a in
                   (k / 6 * math.tau + ph for k in range(6))])
    pieces.append(mk.loft(f"{R}-crystal", cr, FIRE, start=cc - d * 0.058,
                          end=cc + d * 0.1 + side * 0.004))
    # Four silver claws from the collar up round the crystal, their tips
    # hooked over its shoulders.
    for k in range(4):
        a0 = k / 4 * math.tau + math.pi / 4
        pts = []
        for j, (r, z, da) in enumerate(((0.022, -0.09, 0.0),
                                        (0.034, -0.072, 0.06),
                                        (0.045, -0.045, 0.13),
                                        (0.047, -0.01, 0.2),
                                        (0.043, 0.024, 0.26),
                                        (0.033, 0.046, 0.3),
                                        (0.023, 0.058, 0.32))):
            a = a0 + da
            pts.append(cc + d * z +
                       (side * math.cos(a) + fwd * math.sin(a)) * r)
        pieces.append(mk.tube(f"{R}-claw{k}", pts,
                              [0.0075, 0.0074, 0.007, 0.0064, 0.0054,
                               0.0038, 0.0014], SILVER, n=4,
                              caps=("dome", "pole")))
    return pieces


# ------------------------------------------------------------- legs

def boot(sx):
    """A pointed leather boot with a slightly upturned toe; only the foot
    shows under the hem."""
    ankle = V(sx * 0.098, 0.078, 0.07)
    toe_out = math.radians(9)
    foot = [(-0.064, 0.024, 0.006, 0.062), (-0.052, 0.035, 0.0, 0.085),
            (-0.012, 0.041, 0.0, 0.094), (0.045, 0.042, 0.0, 0.07),
            (0.1, 0.037, 0.0, 0.05), (0.145, 0.027, 0.003, 0.04),
            (0.178, 0.015, 0.012, 0.036)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in mk.sup(10, rx_, (zt - zb) / 2, 2.6, math.pi / 10):
            ring.append(V(x, y, max(0.0015, (zb + zt) / 2 + z)))
        rings.append(ring)
    pieces = [mk.loft(f"{R}-foot{sx}", rings, LEATHER,
                      start=V(0, -0.069, 0.032), end=V(0, 0.198, 0.04))]
    # A sole edge.
    welt = [V(x * 1.04, y + 0.052, 0.0) for x, y, _ in
            mk.sup(14, 0.045, 0.118, 2.4)]
    pieces.append(mk.loft(f"{R}-welt{sx}",
                          [[p + V(0, 0, 0.0) for p in welt],
                           [p + V(0, 0, 0.011) for p in welt]],
                          LEATHER, start="flat", end=None))
    m = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(-sx * toe_out, 4, "Z")
    mk.transform(pieces, m)
    shaft = mk.tube(f"{R}-shaft{sx}", [V(ankle.x, ankle.y, 0.04),
                                       V(ankle.x, ankle.y - 0.004, 0.135)],
                    [0.046, 0.048], LEATHER, n=10, caps=(None, "flat"))
    return pieces + [shaft]


def leg(sx):
    """Only the boot: the robe hides the leg, and a boot this short stays
    under the skirt through the whole stride."""
    hip = V(sx * HIP_X, 0, HIP_Z)
    return boot(sx), hip


# ------------------------------------------------------------- build

POSES = {
    "cast": {"armR": 2.0, "armL": 1.0, "offhand": 0.3, "legL": 0.5,
             "legR": -0.5},
    "raise": {"armR": 2.2, "armL": 1.35, "offhand": 0.3},
    # The cast with the staff turned back upright in the fist (a runtime
    # option: weapon about -0.9 x the arm's lift keeps the crystal up).
    "castup": {"armR": 2.0, "weapon": -1.75, "armL": 1.0, "offhand": 0.3},
}


def build(root_name="mage"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        pieces, hip = leg(sx)
        mk.part(R, f"leg{side}", pieces, hip, root)

    torso = mk.part(R, "torso", torso_parts(), WAIST, root)
    mk.part(R, "head", head_parts(), NECK, torso, angle=60)

    arm_r, e_r, w_r = build_armR()
    arm_r_obj = mk.part(R, "armR", arm_r, S_R, torso, angle=70)
    mk.part(R, "weapon", staff(), FIST_R, arm_r_obj, angle=40)

    arm_l, e_l, w_l = build_armL()
    arm_l_obj = mk.part(R, "armL", arm_l, S_L, torso, angle=70)
    hand, p, u, f, s = open_hand()
    mk.part(R, "offhand", hand + flame(p, u, f, s), w_l, arm_l_obj)

    report(root)
    pose = POSES.get(os.environ.get("MAGE_POSE", ""))
    if pose:
        for o in kit.descendants(root):
            key = o.name.split(".", 1)[-1]
            if o.type == "MESH" and key in pose:
                o.rotation_euler = (pose[key], 0, 0)
        kit.refresh()
    return root


def report(root):
    print("MAGE joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:14s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {mk.tris(o)} mats "
                  f"{[m.name for m in o.data.materials]}")
