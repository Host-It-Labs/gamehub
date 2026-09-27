"""The Dino (card id `ogre`) as a collector's miniature: a heroic
tyrannosaur sculpted and hand-painted like a museum-quality resin figure.

About 2.25 units tall at the head and 3.1 from nose to tail tip, standing
on two massive legs with the body held forward and the long heavy tail
lifted off the floor as a counterweight. Team hide with a darker saddle, a
cream throat, belly and tail underside; bold keeled scutes down the neck,
spine and tail between rows of armour-like scale plates on the back, tail
and thighs, each plate edged in gilt, darker plates banding the tail, and
a second tier of small keeled scales down the flanks below them. Sculpted
muscle on the legs (quadriceps and hamstrings split by deep seams, a knee
cap, the calf and Achilles tendon) and on the small arms. A
massive head with brow ridges over small deep-set amber eyes, a lipped jaw
line with rows of sharp individual teeth, a tongue, tiny two-clawed arms
and three-toed feet with dark claws.

Organic parts are sculpted cages (figure_ogre_kit.py), decimated and shaded
with the normals of the dense sculpt. The joints are hidden like a poseable
figure's: the tail turns in a spheroid socket and the neck in a ball socket
in the body, the thighs press into the flanks.

Parts (origins on their joints, no rest rotation):
  ogre.legL / legR   hip
  ogre.torso         hips; parent of head, arms and tail
    ogre.head        neck socket at the shoulders (the whole neck and head)
      ogre.jaw       hinge at the back of the mouth, resting a little open
    ogre.armL / armR shoulder
    ogre.tail        tail socket
"""

import math

import figure_ogre_kit as fk
import kit
import numpy as np
from figure_ogre_kit import X, Y, Z
from mathutils import Matrix, Vector

# As in the mockup: a deep navy (or oxblood) hide, the brighter team colour
# on the gold-edged armour plates and the saddle along the back.
HIDE = "hide:team2"
DARK = "hide:team"
LIGHT = "hide:team3"
BELLY = "resin:" + kit.tint("dino-belly", "#e3d3ae")
SHADE = "resin:" + kit.tint("dino-belly-shade", "#b9a47c")
MOUTH = "resin:" + kit.tint("dino-mouth", "#5b2025")
TONGUE = "resin:" + kit.tint("dino-tongue", "#93403f")
TOOTH = "resin:" + kit.tint("dino-tooth", "#eee4c8")
CLAW = "resin:" + kit.tint("dino-claw", "#2d241e")
GILT = "gilt:" + kit.tint("dino-gilt", "#c5974c")
EYE = "lacquer:" + kit.tint("dino-eye", "#e0a020")
PUPIL = "lacquer:" + kit.tint("dino-pupil", "#130c07")

# Joints.
HIP = Vector((0.0, -0.05, 1.14))
LEG_X = 0.41                                     # thigh centre
NS = Vector((0.0, 0.52, 1.56))                   # neck ball
NECK_R = 0.25
NECK_AXIS = Vector((0.0, 0.35, 0.937)).normalized()
NECK_UP = X.cross(NECK_AXIS).normalized()        # back of the neck
TS = Vector((0.0, -0.86, 1.24))                  # tail ball (spheroid)
TAIL_A, TAIL_C = 0.27, 0.3
HINGE = Vector((0.0, 0.6, 1.79))
JAW_OPEN = 0.25                                   # radians, at rest

ANG12 = [i * 30 for i in range(12)]
ANG8 = [22.5 + 45 * i for i in range(8)]


def oval(w, pinch=0.1, power=2.2, keel=0.0):
    return lambda h: fk.ellipse(w, h, h, ANG12, power, pinch, keel)


def neck_ring(off, r):
    return fk.ring(NS + NECK_AXIS * off, NECK_UP,
                   fk.ellipse(r, r, r, ANG12, 2.0))


def spheroid_ring(d):
    s = math.sqrt(max(0.0, 1 - (d / TAIL_A) ** 2))
    return fk.ring(TS + Y * d, Z, fk.ellipse(TAIL_A * s, TAIL_C * s,
                                             TAIL_C * s, ANG12, 2.0))


# ---------------------------------------------------------------- torso

def torso_rings():
    rings = [fk.ring_tb(top, bot, oval(w, pinch, power, keel))
             for top, bot, w, pinch, power, keel in (
        ((-0.88, 1.552), (-0.88, 0.928), 0.282, 0.0, 2.0, 0.0),  # socket
        ((-0.8, 1.6), (-0.8, 0.905), 0.305, 0.03, 2.1, 0.02),
        ((-0.62, 1.698), (-0.62, 0.872), 0.345, 0.08, 2.2, 0.08),
        ((-0.38, 1.765), (-0.38, 0.845), 0.385, 0.12, 2.3, 0.12),  # hips
        ((-0.12, 1.77), (-0.12, 0.79), 0.405, 0.14, 2.3, 0.14),
        ((0.08, 1.755), (0.14, 0.738), 0.41, 0.15, 2.3, 0.16),     # belly
        ((0.19, 1.728), (0.4, 0.742), 0.39, 0.15, 2.2, 0.16),      # ribs
        ((0.25, 1.698), (0.62, 0.888), 0.335, 0.12, 2.1, 0.12),    # chest
    )]
    rings += [neck_ring(0.02, 0.262), neck_ring(-0.01, 0.246),
              neck_ring(-0.16, 0.2)]
    return rings


def torso_sculpt(sp):
    def fn(P, N):
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        off = np.zeros(len(P))
        # The ilium over the hips, the shoulder blades, the ribcage.
        off += fk.bump2(P, (0.2, -0.34, 1.65), (0.1, 0.22, 0.08), 0.024)
        off += fk.bump2(P, (0.25, 0.14, 1.56), (0.09, 0.13, 0.12), 0.022)
        off += fk.bump2(P, (0.36, 0.2, 1.1), (0.08, 0.28, 0.22), 0.018)
        # A spine ridge down the back.
        off += 0.014 * np.exp(-(da / 10) ** 2)
        # Belly folds across the underside.
        belly = fk.smoothstep(118, 158, da)
        off += 0.011 * np.sin(s * math.tau / 0.1) * belly * \
            fk.smoothstep(0.3, 0.5, s) * fk.smoothstep(1.4, 1.2, s)
        # A fold down each flank, from the armpit to the thigh.
        g = np.abs(((th + 180) % 360) - 180)          # 0 at the right side
        g = np.minimum(g, np.abs(((th - 180 + 180) % 360) - 180))
        off -= 0.012 * np.exp(-((g - 28) / 7) ** 2) * \
            fk.smoothstep(0.55, 0.8, s) * fk.smoothstep(1.4, 1.15, s)
        return off
    return fn


def torso_paint(sp):
    def fn(P):
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        out = np.zeros(len(P), int)
        band = 56 + 5 * np.sin(s * 15.0)
        out[da < band] = 1
        bw = 38 + 12 * fk.smoothstep(0.9, 1.4, s) - 6 * fk.smoothstep(
            0.3, 0.0, s)
        out[(180 - da) < bw + 9] = 3
        out[(180 - da) < bw] = 2
        return out
    return fn


# ---------------------------------------------------------------- tail

def tail_rings():
    rings = [spheroid_ring(d) for d in (0.25, 0.19, 0.1, 0.0)]
    rings += [fk.ring_tb(top, bot, oval(w, 0.14, 2.1, 0.16))
              for top, bot, w in (
        ((-1.0, 1.536), (-1.0, 0.952), 0.26),
        ((-1.19, 1.465), (-1.19, 0.962), 0.222),
        ((-1.37, 1.342), (-1.37, 0.932), 0.174),
        ((-1.54, 1.19), (-1.54, 0.876), 0.122),
        ((-1.67, 1.045), (-1.67, 0.822), 0.077),
        ((-1.75, 0.95), (-1.75, 0.806), 0.043),
    )]
    return rings


def tail_paint(sp, s0):
    def fn(P):
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        out = np.zeros(len(P), int)
        out[da < 58] = 1
        out[(180 - da) < 60] = 3
        out[(180 - da) < 52] = 2
        return out
    return fn


# ---------------------------------------------------------------- head

def head_ring(y, zt, brow, cheek, lip, edge, pal, palc):
    (xb, zb), (xc, zc), (xl, zl), (xe, ze), (xp, zp) = brow, cheek, lip, \
        edge, pal
    pts = [(xl, zl), (xc, zc), (xb, zb), (0.0, zt), (-xb, zb), (-xc, zc),
           (-xl, zl), (-xe, ze), (-xp, zp), (0.0, palc), (xp, zp), (xe, ze)]
    return fk.ring(Vector((0, y, 0)), Z, pts)


HEAD = [
    # y     top    brow            cheek          lip bulge      lip edge        palate         centre
    (0.62, 2.17, (0.18, 2.15), (0.31, 1.98), (0.29, 1.83), (0.26, 1.78), (0.15, 1.85), 1.87),
    (0.76, 2.225, (0.16, 2.205), (0.29, 2.02), (0.275, 1.845), (0.25, 1.785), (0.16, 1.85), 1.875),
    (0.9, 2.24, (0.145, 2.215), (0.245, 2.04), (0.245, 1.855), (0.228, 1.78), (0.145, 1.845), 1.875),
    (1.03, 2.2, (0.115, 2.175), (0.205, 2.02), (0.21, 1.855), (0.196, 1.776), (0.125, 1.84), 1.87),
    (1.15, 2.135, (0.09, 2.11), (0.172, 1.99), (0.18, 1.858), (0.168, 1.784), (0.105, 1.845), 1.865),
    (1.25, 2.07, (0.075, 2.045), (0.146, 1.96), (0.155, 1.862), (0.143, 1.795), (0.085, 1.85), 1.862),
    (1.32, 2.02, (0.06, 1.995), (0.118, 1.932), (0.122, 1.866), (0.11, 1.806), (0.062, 1.85), 1.858),
    (1.35, 1.985, (0.042, 1.965), (0.085, 1.912), (0.088, 1.862), (0.078, 1.812), (0.042, 1.848), 1.855),
]
EYE_AT = Vector((0.212, 0.85, 2.11))
N_NECK = 6       # rings before the skull


def head_rings():
    rings = [neck_ring(-0.2, 0.15), neck_ring(-0.12, 0.219),
             neck_ring(0.0, NECK_R)]
    rings += [fk.ring_tb(top, bot, oval(w, 0.1, 2.1, keel))
              for top, bot, w, keel in (
        ((0.3, 1.8), (0.8, 1.52), 0.252, 0.06),
        ((0.38, 1.96), (0.86, 1.575), 0.24, 0.2),
        ((0.48, 2.08), (0.88, 1.6), 0.262, 0.34),
    )]
    rings += [head_ring(*h) for h in HEAD]
    return rings


def head_faces(k, i):
    # The mouth: under the skull, from the last neck ring forward.
    if k >= N_NECK - 1 and i in (7, 8, 9, 10):
        return 1
    return 0


# The lip line and the edges of the skull roof stay crisp.
HEAD_CREASES = [(N_NECK, N_NECK + 7, 7, 0.85), (N_NECK, N_NECK + 7, 11, 0.85),
                (N_NECK, N_NECK + 6, 2, 0.5), (N_NECK, N_NECK + 6, 4, 0.5),
                (N_NECK, N_NECK + 7, 0, 0.3), (N_NECK, N_NECK + 7, 6, 0.3)]


def head_sculpt(sp, s_neck, s_skull):
    e = EYE_AT

    def fn(P, N):
        off = np.zeros(len(P))
        # Brow ridges and the horn bosses in front of the eyes, deep-set
        # sockets, flaring cheekbones and jaw muscles.
        off += fk.bump2(P, (0.16, 0.83, 2.225), (0.05, 0.08, 0.03), 0.03)
        off += fk.bump2(P, (0.13, 0.97, 2.2), (0.035, 0.045, 0.03), 0.026)
        off += fk.bump2(P, (e.x, e.y, e.z), (0.05, 0.055, 0.04), -0.03)
        off += fk.bump2(P, (0.25, e.y, e.z - 0.052), (0.035, 0.06, 0.018),
                        0.012)
        off += fk.bump2(P, (0.3, 0.74, 1.96), (0.04, 0.12, 0.035), 0.026)
        off += fk.bump2(P, (0.3, 0.64, 2.06), (0.05, 0.07, 0.07), 0.02)
        # A hollow on the side of the snout, the lip ridge over the teeth
        # and the rugose top of the snout.
        off += fk.bump2(P, (0.2, 1.06, 1.98), (0.03, 0.1, 0.05), -0.014)
        off += fk.bump2(P, (0.2, 1.02, 1.855), (0.05, 0.3, 0.022), 0.011)
        for y in (1.0, 1.08, 1.16, 1.24):
            off += fk.bump2(P, (0.045, y, 2.22 - (y - 1.0) * 0.6),
                            (0.03, 0.03, 0.03), 0.011)
        off += fk.bump(P, (0.0, 1.06, 2.215), (0.022, 0.2, 0.03), -0.008)
        # Nostrils.
        off += fk.bump2(P, (0.056, 1.3, 1.99), (0.02, 0.03, 0.018), -0.018)
        # Wrinkles fanning back from the corner of the mouth, under the
        # eye and along the brow.
        for a0, a1 in (((0.29, 0.68, 1.845), (0.305, 0.56, 1.94)),
                       ((0.3, 0.72, 1.9), (0.305, 0.6, 2.01)),
                       ((0.28, 0.66, 1.8), (0.27, 0.54, 1.73)),
                       ((0.24, 0.79, 2.055), (0.232, 0.93, 2.05)),
                       ((0.25, 0.77, 2.025), (0.24, 0.9, 2.015)),
                       ((0.14, 0.76, 2.245), (0.11, 0.96, 2.22))):
            off += fk.groove2(P, a0, a1, 0.018, 0.01)
        # Heavy folds across the throat and the sides of the neck.
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        neck = fk.smoothstep(s_neck - 0.05, s_neck + 0.05, s) * \
            fk.smoothstep(s_skull - 0.02, s_skull - 0.12, s)
        off += 0.016 * np.sin((s - s_neck) * math.tau / 0.095) * neck * \
            fk.smoothstep(55, 110, da)
        vec = N * off[:, None]
        # The brow ridge overhangs the eye.
        Pa = P.copy()
        Pa[:, 0] = np.abs(Pa[:, 0])
        w = fk.bump(Pa, (0.18, 0.85, 2.19), (0.04, 0.085, 0.03), 1.0)
        sx = np.sign(P[:, 0])
        vec += w[:, None] * 0.034 * np.stack([sx * 0.85, 0 * sx + 0.1,
                                              0 * sx - 0.3], axis=1)
        return vec
    return fn


def head_paint(sp, s_skull):
    def fn(P):
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        out = np.zeros(len(P), int)
        band = np.where(s < s_skull, 50, 58 - (s - s_skull) * 50)
        out[da < band] = 1
        # Cream throat down the neck, edged in the light tone.
        throat = s < s_skull - 0.02
        out[((180 - da) < 63) & (s < s_skull - 0.14)] = 3
        out[((180 - da) < 54) & throat] = 2
        return out
    return fn


# ---------------------------------------------------------------- jaw

def jaw_ring(y, rim, gum, floor, floorc, side, corner, bottom):
    (xr, zr), (xg, zg), (xf, zf), (xs, zs), (xk, zk) = rim, gum, floor, \
        side, corner
    pts = [(xr, zr), (xg, zg), (xf, zf), (0.0, floorc), (-xf, zf),
           (-xg, zg), (-xr, zr), (-xs, zs), (-xk, zk), (0.0, bottom),
           (xk, zk), (xs, zs)]
    return fk.ring(Vector((0, y, 0)), Z, pts)


JAW = [
    # y     rim            gum           floor         centre side          corner         bottom
    (0.55, (0.18, 1.8), (0.14, 1.79), (0.08, 1.75), 1.74, (0.205, 1.66), (0.145, 1.56), 1.54),
    (0.66, (0.215, 1.815), (0.172, 1.8), (0.1, 1.745), 1.735, (0.235, 1.66), (0.165, 1.53), 1.505),
    (0.82, (0.205, 1.82), (0.165, 1.805), (0.1, 1.75), 1.74, (0.226, 1.675), (0.155, 1.56), 1.535),
    (0.98, (0.18, 1.82), (0.143, 1.805), (0.09, 1.76), 1.75, (0.2, 1.7), (0.135, 1.6), 1.58),
    (1.12, (0.155, 1.825), (0.12, 1.81), (0.075, 1.77), 1.76, (0.17, 1.725), (0.115, 1.64), 1.625),
    (1.22, (0.13, 1.83), (0.098, 1.818), (0.06, 1.78), 1.775, (0.142, 1.745), (0.092, 1.67), 1.655),
    (1.3, (0.095, 1.835), (0.072, 1.825), (0.045, 1.79), 1.787, (0.104, 1.762), (0.07, 1.7), 1.69),
]
JAW_CREASES = [(0, 6, 0, 0.85), (0, 6, 6, 0.85), (0, 6, 8, 0.3),
               (0, 6, 10, 0.3)]


def jaw_faces(k, i):
    return 1 if i in (0, 1, 2, 3, 4, 5) else 0


def jaw_sculpt():
    def fn(P, N):
        off = np.zeros(len(P))
        # Jaw muscles at the back, the lower lip over the teeth and the
        # groove along the side of the jaw.
        off += fk.bump2(P, (0.23, 0.7, 1.62), (0.03, 0.13, 0.07), 0.02)
        off += fk.bump2(P, (0.19, 1.0, 1.79), (0.03, 0.3, 0.02), 0.01)
        off += fk.groove2(P, (0.215, 0.74, 1.72), (0.15, 1.26, 1.73), 0.012,
                          0.01)
        return off
    return fn


def jaw_paint(sp):
    def fn(P):
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        out = np.zeros(len(P), int)
        out[(180 - da) < 78] = 1
        return out
    return fn


# ---------------------------------------------------------------- legs

def foot_shape(a):
    b = a / 3
    return lambda h: [(a, 0.35 * h), (b, h), (-b, h), (-a, 0.35 * h),
                      (-a, -h), (-b, -h), (b, -h), (a, -h)]


LEG = [
    # y      z    front  back   width
    (-0.06, 1.46, 0.14, 0.17, 0.13),
    (-0.08, 1.28, 0.27, 0.38, 0.2),
    (-0.06, 1.05, 0.32, 0.42, 0.24),
    (0.04, 0.84, 0.25, 0.3, 0.2),
    (0.13, 0.7, 0.16, 0.15, 0.145),      # knee
    (0.04, 0.55, 0.12, 0.17, 0.118),     # calf
    (-0.06, 0.38, 0.085, 0.1, 0.088),    # ankle
    (0.0, 0.22, 0.075, 0.075, 0.08),     # metatarsus
    (0.1, 0.1, 0.07, 0.08, 0.112),
]


def leg_rings(sx=1):
    side = X * sx
    tuck = [0.07, 0.035, 0.0, 0, 0, 0, 0, 0, 0]
    cs = [Vector((sx * (LEG_X - tuck[k]), y, z))
          for k, (y, z, *_) in enumerate(LEG)]
    rings = []
    for k, (y, z, df, db, w) in enumerate(LEG):
        a = cs[max(k - 1, 0)]
        b = cs[min(k + 1, len(cs) - 1)]
        t = (b - a).normalized()
        up = Vector((0, -t.z, t.y)).normalized()
        rings.append(fk.ring(cs[k], up, fk.ellipse(w, df, db, ANG8, 2.1),
                             side))
    rings.append(fk.ring(Vector((sx * LEG_X, 0.27, 0.055)), Z,
                         foot_shape(0.19)(0.08), side))
    # Splay the lower leg out a little for a wide, planted stance.
    for r in rings:
        r["c"].x += sx * 0.04 * max(0.0, 1.0 - r["c"].z / 0.95)
    return rings


def leg_sculpt(sp, s_knee, s_ankle):
    """Tube angles: 0 the outside of the leg, 90 the front, 180 the inside,
    270 the back."""
    M, G = fk.mass, fk.seam
    k, a = s_knee, s_ankle

    def fn(P, N):
        s, th, r = sp.coords(P)
        off = np.zeros(len(P))
        sn = np.sin(np.radians(th))
        # Thigh: the quadriceps down the front, swelling into two teardrops
        # over the knee, and the hamstrings down the back in two heads;
        # deep seams between the masses on the outside and the inside.
        # Nothing grows near the hip, where the thigh swings in the flank.
        off += M(s, th, 0.5, 95, 0.2, 34, 0.068, 4)
        off += M(s, th, k - 0.16, 34, 0.085, 22, 0.06, 3)
        off += M(s, th, k - 0.14, 146, 0.08, 22, 0.052, 3)
        off += M(s, th, 0.47, 300, 0.2, 22, 0.065, 4)
        off += M(s, th, 0.45, 244, 0.19, 22, 0.06, 4)
        off += G(s, th, 0.28, k - 0.1, 272, 6, 0.03)
        off += G(s, th, 0.2, k - 0.02, 336, 8, 0.06)
        off += G(s, th, 0.24, k - 0.04, 205, 8, 0.05)
        off += G(s, th, 0.42, k - 0.08, 62, 6, 0.028)
        off += G(s, th, 0.42, k - 0.08, 124, 6, 0.022)
        # The tendon waist above the knee, the knee cap between two
        # hollows, and the bony front of the knee.
        off -= 0.03 * np.exp(-((s - (k - 0.075)) / 0.03) ** 2) * \
            np.clip(-sn + 0.35, 0, 1)
        off += M(s, th, k - 0.005, 92, 0.045, 28, 0.045, 3)
        off += M(s, th, k + 0.01, 40, 0.035, 14, -0.03)
        off += M(s, th, k + 0.01, 144, 0.035, 14, -0.03)
        # Shin: the tibialis down the outer front beside the shin bone, and
        # the calf's two heads high on the back, tapering into the
        # Achilles tendon with a hollow either side.
        off += M(s, th, k + 0.15, 50, 0.1, 20, 0.04, 3)
        off += G(s, th, k + 0.04, a - 0.03, 78, 6, 0.02)
        off += M(s, th, k + 0.12, 112, 0.08, 12, 0.01)
        off += M(s, th, k + 0.13, 238, 0.08, 24, 0.065, 3)
        off += M(s, th, k + 0.14, 304, 0.08, 22, 0.058, 3)
        off += G(s, th, k + 0.05, k + 0.24, 271, 6, 0.026)
        off -= 0.016 * np.exp(-((s - (a - 0.07)) / 0.05) ** 2) * \
            (1 - np.exp(-(fk.arc(th, 270) / 14) ** 2))
        off += 0.014 * np.exp(-(fk.arc(th, 270) / 11) ** 2) * \
            fk.smoothstep(k + 0.2, k + 0.28, s) * \
            fk.smoothstep(a + 0.02, a - 0.04, s)
        off += G(s, th, k + 0.22, a + 0.01, 228, 10, 0.016)
        off += G(s, th, k + 0.22, a + 0.01, 314, 10, 0.016)
        # The ankle bones, and tendons down the front of the metatarsus.
        off += M(s, th, a, 0, 0.03, 22, 0.012)
        off += M(s, th, a, 180, 0.03, 22, 0.01)
        for c in (68, 92, 116):
            off += 0.005 * np.exp(-(fk.arc(th, c) / 6) ** 2) * \
                fk.smoothstep(a + 0.02, a + 0.08, s) * \
                fk.smoothstep(a + 0.3, a + 0.22, s)
        # Skin folds behind the knee and in front of the ankle.
        knee = np.exp(-((s - s_knee) / 0.06) ** 2) * np.clip(-sn, 0, 1)
        off += 0.012 * np.sin((s - s_knee) * math.tau / 0.05) * knee
        ankle = np.exp(-((s - s_ankle) / 0.05) ** 2) * np.clip(sn, 0, 1)
        off += 0.008 * np.sin((s - s_ankle) * math.tau / 0.04) * ankle
        return off
    return fn


def build_leg(t):
    """The right leg (the left is its mirror)."""
    rings = leg_rings(1)
    tips = []

    def toes(bm, vrings):
        base = vrings[-1]
        for idx, yaw, length in (([0, 1, 6, 7], -0.46, 0.19),
                                 ([1, 2, 5, 6], -0.05, 0.24),
                                 ([2, 3, 4, 5], 0.46, 0.17)):
            quad = [base[i] for i in idx]
            c0 = sum((q.co for q in quad), Vector()) / 4
            rot = Matrix.Rotation(yaw, 3, "Z")
            d = rot @ Y
            hz = (max(q.co.z for q in quad) - min(q.co.z for q in quad)) / 2
            prev = quad
            for f, sw, sz in ((0.24, 0.9, 0.95), (0.44, 0.74, 0.76),
                              (0.62, 0.84, 0.86), (0.8, 0.66, 0.68),
                              (1.0, 0.6, 0.58)):
                c = c0 + d * (length * f)
                c.z -= hz * (1 - sz)
                ring = [bm.verts.new(c + rot @ Vector(((q.co.x - c0.x) * sw,
                                                       0.0,
                                                       (q.co.z - c0.z) * sz)))
                        for q in quad]
                for i in range(4):
                    j = (i + 1) % 4
                    bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
                prev = ring
            bm.faces.new(prev)
            tips.append((c, d, length))

    leg = fk.loft(f"{t}-legR", rings, [HIDE],
                  start=("dome", Vector((0, -0.01, 0.07))), extra=toes)
    sp = fk.Spine(rings)
    s_knee = fk.s_of(sp, rings[4]["c"])
    s_meta = fk.s_of(sp, rings[7]["c"])
    fk.subdivide(leg, 3)
    fk.displace(leg, leg_sculpt(sp, s_knee, fk.s_of(sp, rings[6]["c"])))
    fk.flatten_below(leg, 0.0)
    dense = fk.Dense(leg)
    fk.decimate(leg, 910, symmetric=False)

    def paint(P):
        s, th, r = sp.coords(P)
        da = fk.dorsal(th)
        out = np.zeros(len(P), int)
        out[(s > s_knee + 0.06) & (da < 80)] = 1
        return out

    fk.paint(leg, [HIDE, DARK], paint)
    tree = fk.tree([leg])
    pieces = [leg]
    for k, (c, d, length) in enumerate(tips):
        loc, nrm = fk.hit(tree, c - d * 0.12, d)
        if loc is None:
            loc = c
        claw = fk.fang(f"{t}-clawR{k}", loc - d * 0.03 + Z * 0.012,
                       (d - Z * 0.5).normalized(), 0.15, 0.038, [CLAW],
                       fore=Z, flat=0.72, curve=0.065, segs=5)
        fk.flatten_below(claw, 0.0)
        pieces.append(claw)
    # A rosette of armour scales on the outside of the thigh, scutes down
    # the front of the shin.
    pieces += plating(t, tree, sp, 0.13, 0.6, 3, [-52, -14, 24, 62],
                      "thighR", h=0.026, gap=0.016, sides=(1,))
    pieces += plating(t, tree, sp, s_meta - 0.15, s_meta + 0.07, 4,
                      [48, 132], "shinR", h=0.014, gap=0.012, sides=(1,),
                      tops=lambda r, c: DARK)
    return pieces, dense


# ---------------------------------------------------------------- arms

def arm_sculpt(sx, s, n, elbow, fore, wrist):
    """The small arm's muscles: a shoulder cap, biceps in front of the
    upper arm and triceps behind it, split by a seam on the outside, a
    pointed elbow and the forearm's two masses."""
    s, n, elbow = Vector(s), Vector(n), Vector(elbow)
    fore, wrist = Vector(fore), Vector(wrist)
    sh = s + n * 0.02
    out = X * sx

    def at(v):
        return np.asarray(v[:], dtype=float)

    def on(p, d, r):
        """A point on the surface: r out from the axis point p along d."""
        return np.asarray((p + d.normalized() * r)[:], dtype=float)

    def upper(t):
        return sh.lerp(elbow, t), 0.08 + (0.05 - 0.08) * t

    def lower(t):
        return elbow.lerp(wrist, t), 0.047 + (0.036 - 0.047) * t

    def fn(P, N):
        off = np.zeros(len(P))
        p, r = upper(0.12)
        off += fk.bump(P, on(p, Y * 0.5 + out + Z * 0.4, r),
                       (0.04, 0.04, 0.045), 0.02)
        p, r = upper(0.5)
        off += fk.bump(P, on(p, Y + out * 0.25, r), (0.032, 0.03, 0.05),
                       0.022)
        off += fk.bump(P, on(p, -Y + out * 0.35, r), (0.034, 0.03, 0.055),
                       0.02)
        off += fk.bump(P, on(p, -Y - out * 0.5, r), (0.03, 0.03, 0.05),
                       0.014)
        a0, _ = upper(0.22)
        a1, _ = upper(0.88)
        off += fk.groove(P, on(a0, out + Y * 0.1, 0.08),
                         on(a1, out + Y * 0.1, 0.052), 0.011, 0.016)
        # The crease in the crook of the elbow.
        crook = elbow + (Y + Z).normalized() * 0.04
        off += fk.groove(P, at(crook + out * 0.045), at(crook - out * 0.045),
                         0.012, 0.014)
        off += fk.bump(P, on(elbow, -Y - Z * 0.8, 0.05), (0.02, 0.02, 0.02),
                       0.018)
        p, r = lower(0.3)
        off += fk.bump(P, on(p, Z + out * 0.9, r), (0.025, 0.04, 0.025),
                       0.016)
        off += fk.bump(P, on(p, -Z - out * 0.2, r), (0.025, 0.04, 0.022),
                       0.012)
        p, r = lower(0.85)
        off += fk.groove(P, on(p, Z, r), on(p, out, r), 0.01, 0.006)
        return off
    return fn


def build_arm(t, name, sx, torso_tree):
    loc, nrm = fk.hit(torso_tree, (0.25, 2.0, 1.2), -Y)
    loc.x *= sx
    n = nrm.normalized()
    n.x *= sx
    s = loc - n * 0.02
    bicep = s + Vector((sx * 0.03, 0.045, -0.09))
    elbow = s + Vector((sx * 0.045, 0.06, -0.19))
    fore = elbow + Vector((-sx * 0.005, 0.07, -0.005))
    wrist = elbow + Vector((-sx * 0.01, 0.13, 0.0))
    hand = wrist + Vector((0, 0.04, -0.015))
    arm = fk.tube(f"{t}-arm{name}", [s - n * 0.09, s + n * 0.02, bicep,
                                     elbow, fore, wrist, hand],
                  [0.075, 0.08, 0.072, 0.05, 0.047, 0.036, 0.04], HIDE,
                  n=8, squash=[1, 1, 1, 1, 0.9, 0.85, 0.65])
    fk.subdivide(arm, 3)
    fk.displace(arm, arm_sculpt(sx, s, n, elbow, fore, wrist))
    dense = fk.Dense(arm)
    fk.decimate(arm, 250, symmetric=False)
    pieces = [arm]
    for k, dx in enumerate((-0.02, 0.02)):
        base = hand + Vector((dx * sx, 0.015, -0.005))
        tip = base + Vector((dx * 0.4 * sx, 0.065, -0.05))
        finger = fk.tube(f"{t}-finger{name}{k}",
                         [base, base + Vector((dx * 0.3 * sx, 0.04, -0.02)),
                          tip], [0.018, 0.016, 0.013], HIDE, n=6)
        pieces.append(finger)
        pieces.append(fk.fang(f"{t}-talon{name}{k}",
                              tip + Vector((0, -0.005, 0.004)),
                              (0, 0.15, -0.99), 0.06, 0.015, [CLAW],
                              fore=Y, flat=0.8, curve=-0.022, segs=5))
    return pieces, s + n * 0.02, dense


# ---------------------------------------------------------------- details

def crest(t, tree, sp, spots, tag):
    """Keeled scutes down the midline: spots are (s, length, height)."""
    out = []
    for k, (s, L, H) in enumerate(spots):
        o, d = sp.point(s, 90)
        loc, nrm = fk.surface(tree, o, d)
        if loc is None:
            continue
        _, _, _, tg = sp.at(s)
        out.append(fk.scute(f"{t}-scute{tag}{k}", tree, loc, nrm, tg,
                            L, L * 0.5, H, [DARK, GILT], origin=o,
                            tip=0.36))
    return out


def plating(t, tree, sp, s0, s1, cols, edges, tag, h=0.022, gap=0.014,
            tops=None, sides=(1, -1), stagger=True):
    """Armour panels covering a band of the surface in brick rows: edges
    are theta boundaries on the right side, from the spine outward; the
    left side mirrors them. tops(row, col) may pick a panel's colour."""
    out = []
    step = (s1 - s0) / cols
    for r in range(len(edges) - 1):
        off = 0.5 * step if (stagger and r % 2) else 0.0
        for c in range(cols + (1 if off else 0)):
            sa = max(s0 + c * step - off, s0)
            sb = min(s0 + (c + 1) * step - off, s1)
            if sb - sa < step * 0.4:
                continue
            top = tops(r, c) if tops else HIDE
            for side in sides:
                ta, tb = edges[r], edges[r + 1]
                if side < 0:
                    ta, tb = 180 - ta, 180 - tb
                o = fk.panel(f"{t}-panel{tag}{r}{c}{side}", tree, sp, sa, sb,
                             ta, tb, h, [top, GILT], gap=gap)
                if o is not None:
                    out.append(o)
    return out


def ventral(t, tree, sp, s0, s1, count, half, tag, a=0.032, h=0.018):
    """Cream scale bands across the underside between s0 and s1."""
    step = (s1 - s0) / count
    return [fk.band(f"{t}-belly{tag}{k}", tree, sp, s0 + (k + 0.5) * step,
                    270 - half, 270 + half, a, h, [BELLY, SHADE], n=5)
            for k in range(count)]


def flank_scales(t, tree, sp, legs, arms):
    """The second tier of scale armour: rows of small keeled scales down
    each flank below the back plates, growing smaller towards the belly,
    stopping short of the thighs and the arms."""
    leg_tree, arm_tree = fk.tree(legs), fk.tree(arms)
    paint = torso_paint(sp)
    mats = [HIDE, DARK, BELLY, LIGHT]

    def skip(c):
        m = Vector((abs(c.x), c.y, c.z))
        loc, nrm, _, dist = leg_tree.find_nearest(m)
        if loc is not None and (m - loc).dot(nrm) < 0 and dist > 0.03:
            return True
        loc, _, _, dist = arm_tree.find_nearest(c)
        return loc is not None and dist < 0.03

    def pick(c):
        return int(paint(np.array([c[:]]))[0])

    cells = []
    s0, s1, step = 0.1, 1.36, 0.068
    for row, (th, L, W, H) in enumerate((
            (23.0, 0.074, 0.09, 0.011), (17.0, 0.074, 0.084, 0.0105),
            (11.5, 0.074, 0.078, 0.01), (6.5, 0.074, 0.072, 0.0095),
            (1.8, 0.074, 0.068, 0.009), (-2.6, 0.074, 0.064, 0.0085))):
        k = 0
        while True:
            s = s0 + (k + (0.5 if row % 2 else 0.0)) * step
            if s > s1:
                break
            for side in (1, -1):
                cells.append((s, th if side > 0 else 180 - th, L, W, H))
            k += 1
    return [fk.scales(f"{t}-flank", tree, sp, cells, mats, pick, skip,
                      sink=0.003, sweep=0.55)]


def nostrils(t, tree):
    """Dark oval nostrils in the dents at the tip of the snout."""
    out = []
    for sx in (-1, 1):
        loc, nrm = fk.hit(tree, (sx * 0.056, 1.3, 2.4), -Z)
        if loc is None:
            continue
        n = nrm.normalized()
        along = (Y - n * Y.dot(n)).normalized()
        across = n.cross(along).normalized()
        out.append(ellipsoid(f"{t}-nostril{sx}", loc - n * 0.006,
                             (across * 0.015, along * 0.026, n * 0.008),
                             PUPIL, 8, 4))
    return out


def horns(t, tree):
    """Gilt-tipped horn bosses over and in front of each eye."""
    out = []
    for sx in (-1, 1):
        for k, (x, y, z, L, H, lean) in enumerate((
                (0.15, 0.8, 2.3, 0.075, 0.05, 0.3),
                (0.165, 0.72, 2.28, 0.06, 0.038, 0.25),
                (0.12, 0.97, 2.28, 0.055, 0.034, 0.1))):
            loc, nrm = fk.hit(tree, (sx * x, y, z + 0.4), -Z)
            if loc is None:
                continue
            n = (nrm.normalized() + X * sx * lean).normalized()
            out.append(fk.scute(f"{t}-horn{sx}{k}", tree, loc, n, Y, L,
                                L * 0.6, H, [DARK, GILT], tip=0.45,
                                sweep=0.3))
    return out


def ellipsoid(name, c, axes, mat, seg=10, rings=6):
    o = kit.sphere(name, 1.0, mat=mat, segments=seg, rings=rings)
    m = Matrix.Identity(4)
    for i in range(3):
        for j in range(3):
            m[j][i] = axes[i][j]
    o.data.transform(m)
    o.data.transform(Matrix.Translation(Vector(c)))
    o.data.update()
    return o


def eyes(t, tree):
    """Small amber eyes with slit pupils, set deep under hooded lids."""
    out = []
    r = 0.034
    for sx in (-1, 1):
        loc, nrm = fk.hit(tree, (sx * 1.0, EYE_AT.y, EYE_AT.z), (-sx, 0, 0))
        n = nrm.normalized()
        look = (n + Y * 0.45).normalized()
        c = loc - n * r * 0.5
        up = (Z - look * Z.dot(look)).normalized()
        side = look.cross(up).normalized()
        out.append(ellipsoid(f"{t}-eye{sx}", c, (side * r, up * r * 0.9,
                                                  look * r * 0.85), EYE, 10,
                             6))
        out.append(ellipsoid(f"{t}-pupil{sx}", c + look * r * 0.64,
                             (side * r * 0.14, up * r * 0.62,
                              look * r * 0.24), PUPIL, 6, 4))
        # The upper lid hoods the eye, slanting down towards the snout in a
        # scowl; a thinner lower lid under it.
        phi = -0.38 if side.dot(Y) < 0 else 0.38
        lup = up * math.cos(phi) + side * math.sin(phi)
        lside = side * math.cos(phi) - up * math.sin(phi)
        out.append(ellipsoid(f"{t}-lid{sx}", c + lup * r * 0.6 + look * r *
                             0.14, (lside * r * 1.35, lup * r * 0.5,
                                    look * r * 0.84), HIDE, 8, 5))
        out.append(ellipsoid(f"{t}-lidlow{sx}", c - up * r * 0.78 + look *
                             r * 0.05, (side * r * 1.15, up * r * 0.3,
                                        look * r * 0.72), HIDE, 8, 4))
    return out


def lerp_edge(table, y, which):
    """Interpolate a ring point (x, z) along y from HEAD or JAW rows."""
    ys = [row[0] for row in table]
    xs = [row[which][0] for row in table]
    zs = [row[which][1] for row in table]
    return float(np.interp(y, ys, xs)), float(np.interp(y, ys, zs))


def upper_teeth(t, tree):
    out = []
    spots = [(0.8, 0.045), (0.88, 0.056), (0.96, 0.066),
             (1.04, 0.074), (1.11, 0.07), (1.18, 0.062), (1.25, 0.052)]
    for sx in (-1, 1):
        for k, (y, L) in enumerate(spots):
            xe, ze = lerp_edge(HEAD, y, 5)
            x = sx * (xe - 0.022)
            loc, _ = fk.hit(tree, (x, y, ze - 0.3), Z)
            if loc is None:
                continue
            d = Vector((sx * 0.08, 0.1, -1)).normalized()
            out.append(fk.fang(f"{t}-tooth-u{sx}{k}", loc + Z * 0.016, d, L,
                               L * 0.25, [TOOTH], fore=Y, flat=0.6,
                               curve=L * 0.28))
        for k, (fx, L) in enumerate(((0.068, 0.046), (0.032, 0.04))):
            loc, _ = fk.hit(tree, (sx * fx, 1.6, 1.83), -Y)
            if loc is None:
                continue
            loc2, _ = fk.hit(tree, (sx * fx, loc.y - 0.025, 1.5), Z)
            if loc2 is None:
                continue
            d = Vector((sx * 0.05, 0.14, -1)).normalized()
            out.append(fk.fang(f"{t}-tooth-f{sx}{k}", loc2 + Z * 0.016, d, L,
                               L * 0.25, [TOOTH], fore=Y, flat=0.7,
                               curve=L * 0.2))
    return out


def lower_teeth(t, tree):
    out = []
    spots = [(0.8, 0.034), (0.88, 0.044), (0.96, 0.052), (1.04, 0.058),
             (1.12, 0.054), (1.19, 0.048), (1.26, 0.04)]
    for sx in (-1, 1):
        for k, (y, L) in enumerate(spots):
            xr, zr = lerp_edge(JAW, y, 1)
            x = sx * (xr - 0.02)
            loc, _ = fk.hit(tree, (x, y, zr + 0.3), -Z)
            if loc is None:
                continue
            d = Vector((sx * 0.06, 0.08, 1)).normalized()
            out.append(fk.fang(f"{t}-tooth-l{sx}{k}", loc - Z * 0.012, d, L,
                               L * 0.26, [TOOTH], fore=Y, flat=0.6,
                               curve=L * 0.2))
    return out


def tongue(t, tree):
    pts = []
    for y in (0.7, 0.82, 0.94, 1.05, 1.14):
        loc, _ = fk.hit(tree, (0, y, 2.2), -Z)
        z = loc.z if loc is not None else 1.75
        pts.append((0, y, z + 0.012))
    o = fk.tube(f"{t}-tongue", pts, [0.07, 0.075, 0.07, 0.058, 0.035],
                TONGUE, n=6, squash=[0.3, 0.3, 0.3, 0.32, 0.4])
    fk.subdivide(o, 1)
    return o


# ---------------------------------------------------------------- build

def build(root_name="ogre"):
    t = root_name
    root = kit.empty(t)

    # Legs: the right one sculpted, the left its mirror image.
    pieces, dense = build_leg(t)
    left = [fk.mirror_copy(o, o.name.replace("R", "L")) for o in pieces]
    leg_r = fk.part(t, "legR", pieces, (0.4, HIP.y, HIP.z), root,
                    dense=dense)
    fk.part(t, "legL", left, (-0.4, HIP.y, HIP.z), root,
            dense=dense.mirrored())

    # Torso.
    rings = torso_rings()
    body = fk.loft(f"{t}-body", rings, [HIDE], start=("dome", Y * 0.1),
                   end=("dome", -NECK_AXIS * 0.06))
    sp = fk.Spine(rings[:9])
    fk.subdivide(body, 3)
    fk.displace(body, torso_sculpt(sp))
    dense = fk.Dense(body)
    fk.decimate(body, 1420)
    fk.paint(body, [HIDE, DARK, BELLY, LIGHT], torso_paint(sp))
    tree = fk.tree([body])
    pieces = [body]
    s_a = fk.s_of(sp, (0, -0.8, 1.6))
    s_b = fk.s_of(sp, (0, 0.2, 1.75))
    pieces += crest(t, tree, sp, [
        (s_a + 0.05, 0.1, 0.07), (s_a + 0.22, 0.13, 0.1),
        (s_a + 0.4, 0.15, 0.12), (s_a + 0.58, 0.15, 0.12),
        (s_a + 0.76, 0.14, 0.11), (s_a + 0.93, 0.13, 0.095),
        (s_b, 0.11, 0.08)], "t")
    pieces += plating(t, tree, sp, s_a - 0.07, s_b + 0.04, 7,
                      [85, 66, 47, 28], "t", h=0.022)
    pieces += ventral(t, tree, sp, fk.s_of(sp, (0, -0.42, 0.82)),
                      fk.s_of(sp, (0, 0.62, 0.9)), 12, 36, "t")
    arms = [build_arm(t, name, sx, tree) for name, sx in (("L", -1),
                                                          ("R", 1))]
    pieces += flank_scales(t, tree, sp, [leg_r],
                           [o for a in arms for o in a[0]])
    torso = fk.part(t, "torso", pieces, HIP, root, dense=dense)

    # Tail, turning in its spheroid socket.
    rings = tail_rings()
    tail = fk.loft(f"{t}-tail", rings, [HIDE], start=("dome", Y * 0.03),
                   end=("dome", Vector((0, -0.04, 0.0))))
    sp = fk.Spine(rings)
    s0 = fk.s_of(sp, TS)
    fk.subdivide(tail, 3)
    dense = fk.Dense(tail)
    fk.decimate(tail, 870)
    fk.paint(tail, [HIDE, DARK, BELLY, LIGHT], tail_paint(sp, s0))
    tree = fk.tree([tail])
    pieces = [tail]
    pieces += crest(t, tree, sp, [
        (s0 + 0.12, 0.12, 0.09), (s0 + 0.3, 0.12, 0.085),
        (s0 + 0.48, 0.11, 0.075), (s0 + 0.65, 0.095, 0.062),
        (s0 + 0.8, 0.08, 0.05), (s0 + 0.93, 0.065, 0.04),
        (s0 + 1.03, 0.05, 0.03)], "l")
    pieces += plating(t, tree, sp, s0 + 0.08, s0 + 0.98, 6,
                      [84, 62, 38], "l", h=0.02,
                      tops=lambda r, c: DARK if c % 2 == 1 else HIDE)
    pieces += ventral(t, tree, sp, s0 + 0.1, s0 + 0.78, 7, 40, "l",
                      a=0.028, h=0.014)
    fk.part(t, "tail", pieces, TS, torso, dense=dense)

    # Arms.
    for (pieces, shoulder, dense), name in zip(arms, ("L", "R")):
        fk.part(t, f"arm{name}", pieces, shoulder, torso, dense=dense)

    # Head: the neck from its ball socket up to the skull and snout.
    rings = head_rings()
    head = fk.loft(f"{t}-head", rings, [HIDE, MOUTH], head_faces,
                   start=("dome", -NECK_AXIS * 0.06), end=("strip",),
                   end_mat=[0, 0, 0, 1], creases=HEAD_CREASES)
    # The first skull ring steps back behind the last neck ring; the
    # centreline skips it so the back of the neck never reads as throat.
    sp = fk.Spine(rings[:N_NECK] + rings[N_NECK + 1:])
    s_skull = fk.s_of(sp, fk.centre_of(rings[N_NECK]))
    s_neck = fk.s_of(sp, fk.centre_of(rings[3]))
    fk.subdivide(head, 3)
    fk.displace(head, head_sculpt(sp, s_neck, s_skull))
    dense = fk.Dense(head)
    fk.decimate(head, 2500)
    fk.paint(head, [HIDE, DARK, BELLY, LIGHT], head_paint(sp, s_skull),
             lock=[MOUTH])
    tree = fk.tree([head])
    pieces = [head] + eyes(t, tree) + upper_teeth(t, tree)
    pieces += horns(t, tree) + nostrils(t, tree)
    n_a = fk.s_of(sp, (0, 0.32, 1.83))
    n_b = fk.s_of(sp, (0, 0.58, 2.17))
    pieces += crest(t, tree, sp, [
        (n_a + 0.02, 0.09, 0.06), (n_a + 0.15, 0.1, 0.07),
        (n_a + 0.28, 0.1, 0.07), (n_b, 0.08, 0.05)], "h")
    pieces += plating(t, tree, sp, n_a - 0.06, n_b - 0.02, 3,
                      [84, 64, 44], "h", h=0.018)
    head_obj = fk.part(t, "head", pieces, NS, torso, dense=dense)

    # Jaw, hinged at the back of the mouth, resting a little open.
    rings = [jaw_ring(*j) for j in JAW]
    jaw = fk.loft(f"{t}-jaw", rings, [HIDE, MOUTH], jaw_faces,
                  start=("dome", Vector((0, -0.05, 0.0))), end=("strip",),
                  end_mat=[1, 1, 0, 0], creases=JAW_CREASES)
    sp = fk.Spine(rings)
    fk.subdivide(jaw, 3)
    fk.displace(jaw, jaw_sculpt())
    dense = fk.Dense(jaw)
    fk.decimate(jaw, 700)
    fk.paint(jaw, [HIDE, BELLY], jaw_paint(sp), lock=[MOUTH])
    tree = fk.tree([jaw])
    pieces = [jaw, tongue(t, tree)] + lower_teeth(t, tree)
    # The dense sculpt turns with the jaw.
    fk.rotate_about(pieces[0], HINGE, -JAW_OPEN)
    for o in pieces[1:]:
        fk.rotate_about(o, HINGE, -JAW_OPEN)
    rot = (Matrix.Translation(HINGE) @ Matrix.Rotation(-JAW_OPEN, 4, "X") @
           Matrix.Translation(-HINGE))
    dense = fk.Dense(co=np.array([(rot @ Vector(c))[:] for c in dense.co]),
                     no=np.array([(rot.to_3x3() @ Vector(n))[:]
                                  for n in dense.no]),
                     tris=dense.tris)
    fk.part(t, "jaw", pieces, HINGE, head_obj, dense=dense)

    for o in kit.descendants(root):
        if o.type == "MESH":
            print(f"  {o.name}: {fk.tris(o)} triangles")
    return root
