"""The Gladiator (figure id `gladiator`) as a collector's miniature: a
North African gladiator of the Roman arena, hand-painted resin.

A bronze helmet with a broad brim, open cheek guards and a tall
team-colour brush crest front to back; a stern bearded face; a bare,
muscled chest crossed by a leather strap; a wide leather belt with bronze
plates; a kilt of leather strips over a team-colour underskirt; a quilted
leather guard down the sword arm with a bronze shoulder plate; bronze
greaves over sandals laced round the ankles; a tall curved rectangular
team-colour shield with a bronze boss and rim on the left arm; a short,
straight gladius in the right fist.

Parts (troops.ts has the contract), none with a rest rotation:

  gladiator        root at the feet, facing +y
    legL, legR     pivots on the hips (figures.py splits knees and ankles)
    torso          pivot at the waist: chest, strap, belt
      skirtL/R     the kilt's halves, pivots at the waist over each hip,
                   so the strips trail the legs instead of swinging rigidly
      head         pivot at the neck: face, beard, helmet and crest
      armL, armR   pivots on the shoulders (one line along x)
        foreL      the left elbow: forearm and fist on the shield's grip
          shield   the scutum, pivot in the left fist
        foreR      the right elbow: forearm and fist
          weapon   the gladius, pivot in the right fist

GLADIATOR_POSE=<name> turns the parts as the game would (three.js Euler
terms, see figure_gladiator_kit.runtime_quat) before the previews, with the
numbers moves/gladiator.ts produces: `guard` the shield-up stance, `wind`
the sword drawn back, `thrust` the strike past the shield, `walk`/`walk2`
mid-stride, `down` the spent shield at his side.
"""

import math
import os

import kit
import face_paint
import face_rig
import figure_gladiator_kit as gk
from figure_gladiator_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

R = "gladiator"
T = kit.tint

# ------------------------------------------------------------- paints

SKIN = "resin:" + T("gladiator-skin", "#b3784a")
HAIR = "resin:" + T("gladiator-hair", "#35271e")
BRONZE = "gilt:" + T("gladiator-bronze", "#c98f3f")
LEATHER = "hide:" + T("gladiator-leather", "#6c3d22")
PAINTED = "lacquer:team2"
DARK = "hide:" + T("gladiator-strap", "#3e2517")
STEEL = "gilt:" + T("gladiator-steel", "#c4cbd3")
IVORY = "resin:" + T("gladiator-ivory", "#eadfc6")
SHIELD = "lacquer:team"
PLUME = "weave:team"
UNDER = "weave:team2"
PAINT = "lacquer:team3"
WOOD = "wood:" + T("gladiator-wood", "#8a5a36")

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.09, 0.63
WAIST = V(0, 0, 0.68)
SH_X, SH_Z = 0.186, 0.985
S_L = V(-SH_X, 0, SH_Z)
S_R = V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.04)
UPPER, FORE = 0.245, 0.225
WRIST_FIST = 0.04

HC = V(0, 0.012, 1.162)
CY = 0.012

# The gladius: its rod (grip to point) and the right fist round the grip,
# held low at the hip, point forward.
BLADE = V(0.04, 1.0, 0.16).normalized()
GRIP = V(0.222, 0.125, 0.69)
# The left fist on the shield's horizontal grip, behind the boss.
LEFT = V(-0.105, 0.19, 0.715)
LEFT_ROD = V(1.0, 0.0, 0.0)
# The shield: its face's middle, its curve's radius, width and height.
SHIELD_C = V(-0.105, 0.232, 0.715)
SHIELD_R = 0.34
SHIELD_W, SHIELD_H = 0.39, 0.54

# ------------------------------------------------------------- body shapes

BODY = [(0.575, 0.134, 0.1, 0.108), (0.64, 0.134, 0.098, 0.104),
        (0.70, 0.14, 0.102, 0.1), (0.78, 0.158, 0.114, 0.104),
        (0.86, 0.174, 0.124, 0.108), (0.92, 0.181, 0.122, 0.11),
        (0.962, 0.174, 0.108, 0.104), (0.998, 0.124, 0.08, 0.078),
        (1.03, 0.064, 0.056, 0.056)]
BODY_P = 2.3


def section(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def ring_point(rows, power, a, z, extra=0.0):
    rx_, ryf, ryb = section(rows, z)
    e = 2.0 / power
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


def muscle(a, z):
    """Sculpted relief on the bare chest: pectorals, the breastbone's
    groove, the abdominals and the shoulder blades."""
    ad = math.degrees(a)
    ad = ad - 360 if ad > 180 else ad
    aa = abs(ad)
    d = 0.0
    # Pectorals: full above, a crisp lower edge.
    d += 0.012 * gauss(aa, 30, 17) * gauss(z, 0.885, 0.04) * \
        smooth(0.82, 0.86, z)
    d -= 0.004 * gauss(ad, 0, 5) * gauss(z, 0.88, 0.06)
    # Abdominals: a centre groove and three soft rows.
    for zr in (0.8, 0.75, 0.7):
        d += 0.004 * gauss(aa, 11, 7) * gauss(z, zr, 0.018)
    d -= 0.003 * gauss(ad, 0, 3.5) * smooth(0.84, 0.8, z) * \
        smooth(0.66, 0.7, z)
    # Shoulder blades and the spine's groove.
    d += 0.01 * gauss(aa, 146, 18) * gauss(z, 0.895, 0.04)
    d -= 0.005 * gauss(aa, 180, 6) * gauss(z, 0.83, 0.12)
    # The lats' sweep under the arms.
    d += 0.006 * gauss(aa, 112, 16) * gauss(z, 0.84, 0.05)
    return d


def body_point(a, z, extra=0.0):
    p = ring_point(BODY, BODY_P, a, z, extra)
    n = V(math.sin(a), math.cos(a), 0)
    return p + n * muscle(a, z)


# The kilt: from under the belt, flaring clear of the bare thighs.
KILT = [(0.43, 0.212, 0.172, 0.186), (0.5, 0.2, 0.16, 0.172),
        (0.56, 0.186, 0.146, 0.156), (0.6, 0.172, 0.13, 0.14),
        (0.63, 0.16, 0.118, 0.128)]
KILT_P = 2.4
SEAM = 0.625


def kilt_point(a, z, extra=0.0):
    return ring_point(KILT, KILT_P, a, z, extra)


# ------------------------------------------------------------- legs


def sandal(sx, ankle, toe_out):
    """A bare foot on a leather sole, laced over the instep and up round
    the ankle."""
    pieces = []
    foot = [(-0.06, 0.03, 0.012, 0.058), (-0.048, 0.039, 0.012, 0.074),
            (-0.02, 0.042, 0.012, 0.074), (0.02, 0.043, 0.012, 0.06),
            (0.06, 0.045, 0.012, 0.045), (0.095, 0.044, 0.012, 0.036),
            (0.118, 0.038, 0.012, 0.03)]
    rings = []
    for y, rx_, zb, zt in foot:
        rings.append([V(x, y, (zb + zt) / 2 + z) for x, z, _ in
                      gk.sup(10, rx_, (zt - zb) / 2, 2.4, math.pi / 10)])
    pieces.append(gk.loft(f"{R}-foot{sx}", rings, SKIN,
                          start=V(0, -0.066, 0.035), end="flat"))
    # Toes: five little rounded nubs.
    for k, (x, y, r) in enumerate(((-0.028, 0.128, 0.012),
                                   (-0.011, 0.133, 0.0105),
                                   (0.005, 0.131, 0.0095),
                                   (0.019, 0.126, 0.0088),
                                   (0.031, 0.119, 0.008))):
        pieces.append(gk.ball(f"{R}-toe{sx}{k}", r, V(x * -sx, y, 0.021),
                              SKIN, scale=(1, 1.25, 0.9), seg=6, rings=4))
    sole = []
    for z, s in ((0.0, 1.0), (0.012, 1.02)):
        sole.append([V(x * s, 0.035 + y * s, z) for x, y, _ in
                     gk.sup(18, 0.05, 0.108, 2.6)])
    pieces.append(gk.loft(f"{R}-sole{sx}", sole, DARK, start="flat",
                          end="flat"))
    # Straps over the instep and the toes.
    for k, (y, h) in enumerate(((0.07, 0.042), (0.02, 0.06))):
        strap = []
        for i in range(9):
            t = i / 8 * math.pi
            strap.append(V(math.cos(t) * 0.05, y, 0.012 + math.sin(t) * h))
        pieces.append(gk.tube(f"{R}-sstrap{sx}{k}", strap,
                              [(0.004, 0.009)] * 9, LEATHER, n=4,
                              up=(0, 1, 0), caps=(None, None)))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    gk.transform(pieces, place)
    # Laces spiralling up round the ankle under the greave.
    lace = []
    for i in range(17):
        t = i / 16
        a = t * math.tau * 2.0
        r = 0.044 + 0.004 * t
        lace.append(V(ankle.x + math.sin(a) * r, ankle.y + math.cos(a) * r,
                      0.05 + t * 0.075))
    pieces.append(gk.tube(f"{R}-lace{sx}", lace, [0.0042] * 17, LEATHER, n=4,
                          caps=("dome", "dome")))
    return pieces


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    pieces = []
    # The bare leg, thigh to ankle, a tuck under the knee.
    below = lerp(knee, ankle, 0.35)
    path = [hip + V(-sx * 0.01, 0, 0.02), lerp(hip, knee, 0.3),
            lerp(hip, knee, 0.72), knee, below, ankle + V(0, 0, 0.015)]
    radii = [0.066, 0.074, 0.062, 0.05, 0.052, 0.038]
    pieces.append(gk.tube(f"{R}-limb{sx}", path, radii, SKIN, n=14,
                          up=(0, 1, 0), caps=(None, "dome")))
    pieces.append(gk.ball(f"{R}-knee{sx}", 0.03, knee + V(0, 0.028, 0.0),
                          SKIN, scale=(1.15, 0.7, 1.15), seg=8, rings=5))

    # The greave: a bronze shell over the shin, flared at the top below
    # the knee and at the ankle, with a rolled rim.
    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    prof = [(0.125, 0.045, 0.052), (0.16, 0.049, 0.058), (0.22, 0.057, 0.069),
            (0.28, 0.06, 0.073), (0.32, 0.059, 0.071), (0.345, 0.063,
                                                         0.076)]

    def greave(u, v):
        z, rx_, ry_ = prof[int(round(v))]
        a = math.radians(u)
        c = on_leg(z)
        # Wraps the front and sides; open at the back of the calf.
        return V(c.x + math.sin(a) * rx_, c.y + 0.008 + math.cos(a) * ry_,
                 z + 0.01 * math.cos(a) * (z > 0.34))

    us = [i * 20.0 - 120 for i in range(13)]
    pieces.append(gk.sheet(f"{R}-greave{sx}", greave, us,
                           list(range(len(prof))), BRONZE, rim=0.005,
                           back=True, rim_mat=LEATHER,
                           inside=on_leg(0.24) + V(0, -0.02, 0)))
    ring = [greave(u, 5) for u in us]
    pieces.append(gk.tube(f"{R}-grim{sx}", ring, [0.0045] * len(ring), BRONZE,
                          n=4, caps=("dome", "dome")))
    # A raised ridge down the shin.
    ridge = [greave(0, v) + V(0, 0.003, 0) for v in (0.3, 1, 2, 3, 4, 4.7)]
    pieces.append(gk.tube(f"{R}-gridge{sx}", ridge, [0.0045] * 6, BRONZE,
                          n=4, caps=("dome", "dome")))
    # Leather straps holding it on behind the calf.
    for z in (0.3, 0.17):
        c = on_leg(z)
        strap = [c + V(math.sin(math.radians(a)) * 0.056,
                       0.004 + math.cos(math.radians(a)) * 0.062, 0)
                 for a in range(116, 245, 16)]
        pieces.append(gk.tube(f"{R}-gstrap{sx}{z}", strap,
                              [(0.004, 0.009)] * len(strap), DARK, n=4,
                              up=(0, 0, 1), caps=(None, None)))
    # The knee's bronze boss at the top of the greave.
    pieces.append(gk.ball(f"{R}-gboss{sx}", 0.013, greave(0, 4.6) + V(0, 0.006,
                                                                     0.0),
                          BRONZE, scale=(1, 0.6, 1), seg=8, rings=5))
    pieces += sandal(sx, ankle, toe_out)
    return pieces, hip


# ------------------------------------------------------------- torso


def chest():
    zs = [0.575, 0.63, 0.69, 0.74, 0.78, 0.82, 0.85, 0.88, 0.91, 0.94,
          0.965, 0.985, 1.005, 1.035]
    n = 26
    c = gk.Mesh(f"{R}-chest", SKIN)
    rows = [[c.v(body_point(i / n * math.tau, z)) for i in range(n)]
            for z in zs]
    c.grid(rows, SKIN, closed=True)
    c.fan(rows[-1], V(0, 0, 1.05), SKIN)
    c.fan(rows[0], V(0, 0, 0.56), SKIN, flip=True)
    return c.obj(recalc=True)


def hips():
    """The team-colour underskirt's waist, under the belt."""
    rings = []
    for z, rx_, ry_ in ((0.52, 0.07, 0.06), (0.55, 0.116, 0.09),
                        (0.6, 0.126, 0.098), (0.64, 0.128, 0.098),
                        (0.66, 0.126, 0.096)):
        rings.append([V(x, y, z) for x, y, _ in gk.sup(18, rx_, ry_, 2.3)])
    return gk.loft(f"{R}-hips", rings, UNDER, start="pole", end=None)


def belt():
    """The wide leather belt with a row of bronze plates round the front
    and a buckle."""
    pieces = []
    n = 32
    zs = [(0.594, -0.004), (0.6, 0.004), (0.678, 0.004), (0.686, -0.004)]
    rings = [[ring_point(BODY, BODY_P, i / n * math.tau, z, 0.008 + off)
              for i in range(n)] for z, off in zs]
    pieces.append(gk.loft(f"{R}-belt", rings, LEATHER))
    for k in range(-3, 4):
        a = math.radians(k * 22.0)
        p = ring_point(BODY, BODY_P, a, 0.64, 0.0145)
        nrm = V(math.sin(a), math.cos(a), 0)
        side = V(0, 0, 1).cross(nrm).normalized()
        big = k == 0
        pieces.append(gk.rbox(f"{R}-plate{k}",
                              (0.036 if big else 0.024, 0.006,
                               0.058 if big else 0.05),
                              V(0, 0, 0), BRONZE, levels=1, crease=0.6,
                              matrix=gk.basis(-side, nrm, V(0, 0, 1), p)))
        if not big:
            pieces.append(gk.ball(f"{R}-rivet{k}", 0.0052,
                                  p + nrm * 0.0045, BRONZE, seg=6, rings=3))
    return pieces


def strap():
    """A leather strap over the left shoulder, across the chest to the
    right hip and round the back again."""
    pts = []
    for i in range(33):
        a = i / 32 * math.tau
        z = 0.845 + 0.152 * math.cos(a + math.pi / 2)
        pts.append(body_point(a, z, 0.006))
    return [gk.tube(f"{R}-strap", pts, [(0.0045, 0.017)] * len(pts), DARK,
                    n=4, up=(0, 0, 1), caps=(None, None))]


def neck():
    return gk.tube(f"{R}-neck", [V(0, -0.004, 0.955), V(0, 0.0, 1.03),
                                 V(0, 0.008, 1.075)],
                   [0.056, 0.053, 0.048], SKIN, n=12, caps=(None, None))


# ------------------------------------------------------------- the kilt


def kilt(sx):
    """One half of the kilt: a team-colour underskirt and, over it, a row
    of overlapping leather strips hanging from the belt, each with a
    bronze stud at its tip."""
    out = []

    def under(u, v):
        z = lerp(SEAM, 0.465, v)
        a = math.radians(lerp(-4.0, 184.0, u))
        p = kilt_point(a, z, -0.006)
        return V(sx * p.x, p.y, p.z)

    out.append(gk.sheet(f"{R}-under{sx}", under, [i / 9 for i in range(10)],
                        [0, 0.25, 0.5, 0.75, 1], UNDER, rim=0.004, back=True,
                        inside=V(sx * 0.03, 0, 0.55)))
    count = 7
    for k in range(count):
        mid = 8 + k * (164 / (count - 1))
        half = 11.5
        low = 0.44 + 0.012 * (k % 2)
        lift = 0.002 + 0.0022 * (k % 2)

        def strip(u, v, mid=mid, half=half, low=low, lift=lift):
            z = lerp(SEAM + 0.005, low, v)
            a = math.radians(mid + u * half * (1 + 0.1 * v))
            p = kilt_point(a, z, lift + 0.0015 * math.cos(u * math.pi / 2))
            return V(sx * p.x, p.y, p.z)

        out.append(gk.sheet(f"{R}-strip{sx}{k}", strip, [-1, -0.5, 0, 0.5, 1],
                            [0, 0.33, 0.66, 1],
                            PAINTED if k % 2 else LEATHER, rim=0.005,
                            rim_mat=DARK, inside=V(sx * 0.03, 0, 0.55),
                            back=True))
        tip = strip(0, 0.9) + V(0, 0, 0)
        nrm = V(sx * math.sin(math.radians(mid)), math.cos(math.radians(mid)),
                0)
        out.append(gk.ball(f"{R}-stud{sx}{k}", 0.0078, tip + nrm * 0.004,
                           BRONZE, scale=(1, 1, 1), seg=6, rings=3))
    return out


# ------------------------------------------------------------- head
# A broad, strong-jawed man's face on the Cowboy's head space.

FACE_W = [(1.0, 0.034), (1.025, 0.046), (1.045, 0.056), (1.062, 0.062),
          (1.076, 0.0655), (1.095, 0.067), (1.12, 0.068), (1.145, 0.071),
          (1.17, 0.073), (1.2, 0.074), (1.225, 0.071), (1.245, 0.063),
          (1.26, 0.047), (1.268, 0.02)]
FACE_D = [(1.0, 0.032), (1.025, 0.043), (1.045, 0.058), (1.062, 0.069),
          (1.074, 0.073), (1.09, 0.075), (1.12, 0.077), (1.15, 0.075),
          (1.172, 0.082), (1.2, 0.083), (1.225, 0.077), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.04), (1.04, 0.056), (1.07, 0.076), (1.1, 0.091),
          (1.14, 0.101), (1.18, 0.105), (1.21, 0.101), (1.235, 0.089),
          (1.255, 0.067), (1.268, 0.03)]
NOSE_H = [(1.1, 0.0), (1.107, 0.007), (1.114, 0.017), (1.121, 0.023),
          (1.13, 0.021), (1.145, 0.016), (1.16, 0.011), (1.172, 0.006),
          (1.186, 0.0)]
NOSE_S = [(1.11, 12.0), (1.13, 8.5), (1.17, 6.5)]


def face_disp(ad, z):
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.006 * gauss(a, 12.5, 5) * gauss(z, 1.116, 0.006)       # nostrils
    d -= 0.011 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)       # sockets
    bz = 1.173 - 0.003 * gauss(a, 9, 8)
    d += 0.0105 * gauss(z, bz, 0.0065) * smooth(52, 30, a)        # brow
    d -= 0.003 * gauss(ad, 0, 4) * gauss(z, 1.169, 0.006)         # frown
    d += 0.007 * gauss(a, 47, 13) * gauss(z, 1.138, 0.012)        # cheekbone
    d -= 0.004 * gauss(a, 40, 12) * gauss(z, 1.104, 0.013)        # hollow
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.002 * gauss(z, 1.1, 0.004) * gauss(ad, 0, 15)
    d += 0.0026 * gauss(z, 1.087, 0.0035) * gauss(ad, 0, 12)      # lower lip
    d += 0.011 * gauss(z, 1.062, 0.012) * gauss(ad, 0, 22)        # chin
    d += 0.006 * gauss(a, 64, 12) * gauss(z, 1.066, 0.014)        # jaw angle
    return d


HEAD = gk.Head(FACE_W, FACE_D, BACK_D, 2.5, face_disp, CY, HC)
FACE_A = [0, 3, 6, 9.5, 13.5, 17.5, 22, 27, 33, 40, 48, 58, 70, 84, 100, 124,
          152]
FACE_Z = [1.012, 1.025, 1.038, 1.05, 1.062, 1.072, 1.081, 1.088, 1.094, 1.1,
          1.106, 1.112, 1.118, 1.125, 1.133, 1.141, 1.149, 1.157, 1.165,
          1.173, 1.182, 1.193, 1.215, 1.245]


def skull():
    cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
    cols = [a for a in cols if a > -180]
    return HEAD.skull(f"{R}-face", cols, FACE_Z, lambda a, z: SKIN,
                      V(0, CY - 0.005, 1.268))


def face():
    out = face_paint.eyes(gk, R, HEAD.point, HC, z=1.1565,
                          expression="focused")
    out += face_paint.mouth(gk, R, HEAD.point, HC, expression="focused")
    return out


BEARD_TOP = [(0, 1.081), (11, 1.081), (18, 1.083), (25, 1.083),
             (33, 1.079), (44, 1.076), (57, 1.082), (68, 1.1), (76, 1.13)]


def beard():
    """A short, full black beard along the jaw and chin, and a moustache
    over the lip, thicker at the chin."""
    cols = sorted(set([-a for a in FACE_A] + FACE_A))
    cols = [a for a in cols if abs(a) <= 78]
    out = [HEAD.shell(f"{R}-beard", HAIR, cols,
                      lambda a: 1.018 + 0.03 * smooth(30, 70, abs(a)),
                      lambda a: table(BEARD_TOP, abs(a)),
                      lambda a, t: 0.0014 + 0.004 * (1 - t) ** 0.7 *
                      gauss(a, 0, 26) + 0.0008 * (1 - t),
                      rows=6)]
    lc = [a for a in cols if abs(a) <= 22]
    out.append(HEAD.shell(f"{R}-moustache", HAIR, lc,
                          lambda a: 1.1015 + 0.001 * abs(a) / 22,
                          lambda a: 1.1085 - 0.002 * abs(a) / 22,
                          lambda a, t: 0.0022 + 0.001 * math.sin(math.pi * t),
                          rows=2))
    return out


def rim_z(a):
    """The helmet's lower edge: across the brow, up over the temples, down
    over the nape."""
    return table([(0, 1.193), (40, 1.196), (60, 1.2), (100, 1.19),
                  (140, 1.17), (180, 1.16)], abs(a))


def helmet():
    pieces = []
    cols = [i * 11.25 - 180 for i in range(32)]
    # The bowl, standing clear of the skull.
    pieces.append(HEAD.shell(f"{R}-bowl", BRONZE, cols, rim_z,
                             lambda a: 1.268,
                             lambda a, t: 0.012 + 0.004 * math.sin(math.pi *
                                                                  t),
                             rows=6, closed=True))
    cap = HEAD.point(0, 1.268)
    top = [HEAD.point(a, 1.268) + HEAD.normal(a, 1.268) * 0.012 for a in cols]
    pieces.append(gk.loft(f"{R}-cap", [top], BRONZE, start=None,
                          end=V(cap.x, cap.y, 1.284)))
    # A rolled rim round the lower edge.
    ring = [HEAD.point(a, rim_z(a)) + HEAD.normal(a, rim_z(a)) * 0.014
            for a in cols]
    pieces.append(gk.tube(f"{R}-rim", ring + [ring[0]], [0.0058] *
                          (len(ring) + 1), BRONZE, n=4, caps=(None, None)))

    # The brim: flat and broad over the sides and back, a short peak over
    # the brow.
    def brim(u, v):
        a = u
        z0 = rim_z(a)
        base = HEAD.point(a, z0) + HEAD.normal(a, z0) * 0.012
        out = V(math.sin(math.radians(a)), math.cos(math.radians(a)), 0)
        w = lerp(0.016, 0.06, smooth(35, 115, abs(a)))
        drop = lerp(0.004, 0.02, smooth(60, 170, abs(a)))
        return base + out * w * v + V(0, 0, -drop * v * v)

    bu = [i * 11.25 - 180 for i in range(32)]
    pieces.append(gk.sheet(f"{R}-brim", brim, bu, [0, 0.5, 1], BRONZE,
                           rim=0.005, closed_u=True, back=True,
                           inside=V(0, CY, 1.4)))
    # Cheek guards hinged open beside the face, covering the ears.
    for sx in (-1, 1):
        def cheek(u, v, sx=sx):
            a = lerp(66, 106, u)
            z = lerp(rim_z(a) - 0.004, 1.066 + 0.02 * u, v)
            flare = 0.014 + 0.008 * v
            p = HEAD.point(a, z) + HEAD.normal(a, z) * flare
            return V(sx * p.x, p.y, p.z)
        pieces.append(gk.sheet(f"{R}-cheek{sx}", cheek, [0, 0.25, 0.5, 0.75, 1],
                               [0, 0.25, 0.5, 0.75, 1], BRONZE, rim=0.005,
                               back=True, inside=V(0, 0.01, 1.14)))
        # Its rolled edge and a rivet.
        edge = [cheek(u, 1) for u in (0, 0.25, 0.5, 0.75, 1)] + \
            [cheek(0, v) for v in (0.75, 0.5, 0.25)]
        pieces.append(gk.tube(f"{R}-cedge{sx}", edge, [0.004] * len(edge),
                              BRONZE, n=4, caps=("dome", "dome")))
        pieces.append(gk.ball(f"{R}-crivet{sx}", 0.007, cheek(0.5, 0.2) +
                              V(sx * 0.005, 0, 0), BRONZE, seg=6, rings=4))
    # The crest's bronze ridge, front to back.
    ridge = []
    for i in range(13):
        phi = math.radians(lerp(58, -95, i / 12))
        z = 1.2 + math.cos(phi) * 0.086
        y = CY - 0.004 + math.sin(phi) * 0.096
        ridge.append(V(0, y, z))
    pieces.append(gk.tube(f"{R}-ridge", ridge, [(0.012, 0.009)] * 13,
                          BRONZE, n=6, up=(1, 0, 0), caps=("dome", "dome")))
    return pieces


def plume():
    """A tall team-colour brush crest standing on the ridge, front to back:
    rising from a point over the brow, tallest over the crown, trailing
    off behind; its top edge scalloped into tufts."""
    rings = []
    n = 18
    centre = V(0, CY - 0.004, 1.2)
    for i in range(n):
        t = i / (n - 1)
        phi = math.radians(lerp(50, -100, t))
        radial = V(0, math.sin(phi), math.cos(phi))
        height = 0.11 * smooth(-0.08, 0.3, t) * lerp(1.0, 0.45,
                                                    smooth(0.55, 1.0, t))
        height = max(0.012, height)
        tuft = 1 + 0.1 * math.sin(t * math.pi * 8) ** 2
        base = centre + radial * 0.088
        width = 0.036 * lerp(0.45, 1.0, smooth(0, 0.3, t)) * \
            lerp(1.0, 0.6, smooth(0.7, 1.0, t))
        ring = []
        for x, r, _ in gk.sup(10, width, height / 2, 2.2, 0):
            up = r + height / 2
            top = up / height
            ring.append(base + V(x * (1 - 0.15 * top), 0, 0) +
                        radial * up * (tuft if top > 0.6 else 1))
        rings.append(ring)
    return [gk.loft(f"{R}-plume", rings, PLUME, start="pole", end="pole")]


def head():
    return [skull(), neck()] + beard() + face() + helmet()


# ------------------------------------------------------------- arms


def arm_pose(s, c, rod, pole):
    e0 = gk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    w, xax = gk.hand_frame(e0, c, rod, WRIST_FIST)
    e = gk.ik(s, w, UPPER, FORE, pole)
    return e, w, xax


def upper_arm(side, s, e, sx):
    """The upper arm: the right one in the quilted leather guard under a
    bronze shoulder plate, the left bare with a bronze band."""
    pieces = []
    up = (e - s).normalized()
    guard = side == "R"
    mat = LEATHER if guard else SKIN
    path = [s + up * 0.045, lerp(s, e, 0.32), lerp(s, e, 0.7), e]
    radii = [0.055, 0.057, 0.05, 0.043] if not guard else \
        [0.057, 0.059, 0.054, 0.047]
    pieces.append(gk.tube(f"{R}-upper{side}", path, radii, mat, n=12,
                          caps=(None, None), flute=0.06 if guard else 0.0))
    pieces.append(gk.ball(f"{R}-deltoid{side}", 1.0,
                          s + V(sx * 0.008, 0, -0.012), mat,
                          scale=(0.062, 0.064, 0.056), seg=12, rings=8))
    pieces.append(gk.ball(f"{R}-elbow{side}", 0.041 if guard else 0.037, e,
                          mat, seg=10, rings=6))
    if guard:
        # Quilted bands, and the bronze shoulder plate over the deltoid.
        for k, t in enumerate((0.35, 0.6, 0.85)):
            c = lerp(s, e, t)
            r = lerp(0.058, 0.047, t) + 0.004
            pieces.append(gk.tube(f"{R}-band{side}{k}", [c - up * 0.007,
                                                        c + up * 0.007],
                                  [r, r], DARK, n=12, caps=(None, None)))

        def plate(u, v):
            az = math.radians(lerp(-80, 80, u))
            pol = math.radians(lerp(4, 82, v))
            ctr = s + V(sx * 0.008, 0, -0.014)
            d = V(sx * math.sin(pol) * math.cos(az) * 0.076,
                  math.sin(pol) * math.sin(az) * 0.078, math.cos(pol) * 0.07)
            return ctr + d

        pieces.append(gk.sheet(f"{R}-pauldron{side}", plate,
                               [i / 8 for i in range(9)],
                               [i / 4 for i in range(5)], BRONZE, rim=0.005,
                               back=True, inside=s + V(0, 0, -0.03)))
    else:
        c = lerp(s, e, 0.42)
        pieces.append(gk.tube(f"{R}-armband{side}", [c - up * 0.01,
                                                    c + up * 0.01],
                              [0.059, 0.06], BRONZE, n=12, caps=(None, None)))
    return pieces


def forearm(side, e, w, c, xax, rod, right):
    fo = (w - e).normalized()
    guard = side == "R"
    mat = LEATHER if guard else SKIN
    pieces = [gk.tube(f"{R}-forearm{side}",
                      [e - fo * 0.02, lerp(e, w, 0.35), w + fo * 0.004],
                      [0.043, 0.042, 0.033] if guard else
                      [0.04, 0.04, 0.03], mat, n=10, caps=(None, None),
                      flute=0.06 if guard else 0.0)]
    # A leather wrap at the wrist (a thick cuff on the sword arm).
    pieces.append(gk.tube(f"{R}-wrist{side}", [w - fo * 0.045, w - fo * 0.002],
                          [0.038, 0.036] if guard else [0.034, 0.033], DARK,
                          n=10, caps=(None, None)))
    if guard:
        for k, t in enumerate((0.3, 0.6)):
            p = lerp(e, w, t)
            r = lerp(0.043, 0.035, t) + 0.004
            pieces.append(gk.tube(f"{R}-fband{k}", [p - fo * 0.006,
                                                   p + fo * 0.006],
                                  [r, r], DARK, n=10, caps=(None, None)))
    pieces += gk.fist(f"{R}-hand{side}", c, xax, rod, right, SKIN)
    return pieces


# ------------------------------------------------------------- the gladius


def gladius():
    """A short, broad, straight gladius in its own frame (x across the flat,
    y through the grip to the point, z the flat's normal), the grip's middle
    at the origin: an ivory grip with ridges, a round bronze guard and a
    ball pommel."""
    P = []
    L0, L1 = 0.048, 0.3
    half = []
    for i in range(9):
        t = i / 8
        y = lerp(L0, L1 - 0.055, t)
        w = lerp(0.029, 0.025, smooth(0, 0.6, t)) + 0.002 * smooth(0.6, 1, t)
        half.append((w, y))
    tip = (0.0, L1)
    outline = half + [tip] + [(-x, y) for x, y in reversed(half)]
    # A lens section: the flat's middle proud of the edges.
    th = 0.0095
    P.append(gk.slab(f"{R}-blade", outline, th, STEEL,
                     matrix=Matrix.Translation(V(0, 0, -th / 2)),
                     bevel=0.0026))
    ridge = [V(0, lerp(L0 + 0.01, L1 - 0.03, t), 0) for t in (0, 0.5, 1.0)]
    for zz in (1, -1):
        P.append(gk.tube(f"{R}-midrib{zz}", [p + V(0, 0, zz * th / 2)
                                             for p in ridge],
                         [(0.004, 0.0012)] * 3, STEEL, n=4, up=(0, 0, 1),
                         caps=("dome", "dome")))
    guard = []
    for dy, s in ((0.036, 0.85), (0.042, 1.0), (0.05, 0.95)):
        guard.append([V(x * s, dy, z * s) for x, z, _ in
                      gk.sup(14, 0.034, 0.02, 2.2)])
    P.append(gk.loft(f"{R}-guard", guard, BRONZE, start="flat", end="flat"))
    grip = []
    for y, r in ((-0.042, 0.011), (-0.03, 0.0125), (-0.018, 0.011),
                 (-0.006, 0.0125), (0.006, 0.011), (0.018, 0.0125),
                 (0.03, 0.011), (0.038, 0.012)):
        grip.append([V(x, y, z) for x, z, _ in gk.sup(8, r, r)])
    P.append(gk.loft(f"{R}-grip", grip, IVORY))
    P.append(gk.ball(f"{R}-pommel", 0.019, V(0, -0.056, 0), BRONZE,
                     scale=(1, 0.8, 0.85), seg=10, rings=6))
    return P


def gladius_frame(xax):
    """The gladius at rest in the right fist: y along the rod, its flat
    lying level (x across the flat, sideways)."""
    y = BLADE
    k = xax.cross(y).normalized()
    z = k.cross(y).normalized()
    return gk.basis(k, y, z, GRIP)


# ------------------------------------------------------------- the shield


def shield_point(u, v, lift=0.0):
    """The shield's face: u across (-1 left edge .. 1 right), v up (-1..1),
    curved round a vertical axis behind it."""
    psi = u * SHIELD_W / 2 / SHIELD_R
    r = SHIELD_R + lift
    axis = SHIELD_C - V(0, SHIELD_R, 0)
    return V(axis.x + math.sin(psi) * r, axis.y + math.cos(psi) * r,
             SHIELD_C.z + v * SHIELD_H / 2)


def shield_outline(k, n):
    """A point round the shield's rounded-rectangle rim (u, v)."""
    a = k / n * math.tau
    e = 2 / 7.0
    return (spow(math.cos(a), e), spow(math.sin(a), e))


def scutum():
    pieces = []
    n = 28

    def face_fn(u, v):
        # A square grid pulled out to the rounded rim.
        if abs(u) < 1e-9 and abs(v) < 1e-9:
            return shield_point(0, 0)
        th = math.atan2(v, u)
        c, s_ = abs(math.cos(th)), abs(math.sin(th))
        square = 1 / max(c, s_)
        rounded = 1 / (c ** 7 + s_ ** 7) ** (1 / 7)
        k = rounded / square
        return shield_point(u * k, v * k)

    grid = [i / 5 - 1 for i in range(11)]
    pieces.append(gk.sheet(f"{R}-shield", face_fn, grid,
                           [j / 6 - 1 for j in range(13)], SHIELD, rim=0.02,
                           back=True, rim_mat=WOOD,
                           inside=SHIELD_C - V(0, 0.2, 0)))
    # The bronze rim round the edge.
    rim = [shield_point(*shield_outline(k, n), lift=-0.008) for k in range(n)]
    pieces.append(gk.tube(f"{R}-srim", rim + [rim[0]], [(0.011, 0.0075)] *
                          (n + 1), BRONZE, n=4, up=(0, 1, 0),
                          caps=(None, None)))
    # The spine top to bottom through the boss, and two painted wings of
    # stripes above and below it.
    spine = [shield_point(0, v, 0.004) for v in (-0.93, -0.5, 0.0, 0.5, 0.93)]
    pieces.append(gk.tube(f"{R}-spina", spine, [(0.012, 0.004)] * 5, BRONZE,
                          n=4, up=(0, 1, 0), caps=("dome", "dome")))
    for k, v0 in enumerate((0.42, 0.56, -0.42, -0.56)):
        def band(u, v, v0=v0):
            return shield_point(lerp(-0.84, 0.84, u), v0 + lerp(-0.03, 0.03, v),
                                0.0016)
        pieces.append(gk.sheet(f"{R}-sband{k}", band,
                               [i / 10 for i in range(11)], [0, 1], PAINT,
                               inside=SHIELD_C - V(0, 0.2, 0)))
    # The boss: a bronze dome on a round flange, with rivets.
    ctr = shield_point(0, 0, 0.0)
    fwd = (ctr - (SHIELD_C - V(0, SHIELD_R, 0))).normalized()
    boss = []
    for r, h in ((0.066, 0.0), (0.066, 0.006), (0.052, 0.008), (0.05, 0.02),
                 (0.042, 0.038), (0.026, 0.05), (0.0, 0.054)):
        boss.append((r, h))
    m = gk.look(fwd, V(0, 0, 1), ctr)
    b = kit.lathe(f"{R}-boss", [(r, h) for r, h in boss if r > 0] +
                  [(0.0005, 0.054)], segments=14, mat=BRONZE)
    b.matrix_world = m
    kit.apply_transform(b)
    pieces.append(b)
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4
        side = fwd.cross(V(0, 0, 1)).normalized()
        p = ctr + (side * math.cos(a) + V(0, 0, 1) * math.sin(a)) * 0.058 + \
            fwd * 0.007
        pieces.append(gk.ball(f"{R}-brivet{k}", 0.006, p, BRONZE, seg=6,
                              rings=3))
    # The grip bar behind the boss, for the fist.
    back = ctr - fwd * 0.02
    pieces.append(gk.tube(f"{R}-sgrip", [back - V(0.05, 0, 0),
                                         back - V(0.05, 0.022, 0) * 0.5,
                                         LEFT - V(0.05, 0, 0),
                                         LEFT + V(0.05, 0, 0),
                                         back + V(0.05, -0.011, 0),
                                         back + V(0.05, 0, 0)],
                          [0.0085] * 6, WOOD, n=6, caps=(None, None)))
    return pieces


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("GLADIATOR_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + gk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return gk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="gladiator"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.102, 0.03, 0.36), V(-0.116, 0.04, 0.085), 12),
            ("R", 1, V(0.1, -0.02, 0.36), V(0.114, -0.03, 0.085), 14)):
        pieces, hip = leg(sx, knee, ankle, out)
        part(f"leg{side}", pieces, hip, root)

    torso = [chest(), hips()] + belt() + strap()
    torso_obj = part("torso", torso, WAIST, root)
    for side, sx in (("L", -1), ("R", 1)):
        part(f"skirt{side}", kilt(sx), V(sx * HIP_X, 0.0, 0.655), torso_obj)
    head_obj = face_rig.head(gk.part, R, head(), NECK, torso_obj, angle=62)
    # Only the brush crest flexes; the bronze helmet stays on the skull.
    part("hair", plume(), V(0, CY - 0.004, 1.278), head_obj, angle=62)

    e_r, w_r, x_r = arm_pose(S_R, GRIP, BLADE, S_R + V(0.35, -0.8, -0.3))
    arm_r = part("armR", upper_arm("R", S_R, e_r, 1), S_R, torso_obj)
    fore_r = part("foreR", forearm("R", e_r, w_r, GRIP, x_r, BLADE, True),
                  e_r, arm_r)
    sword = gladius()
    gk.transform(sword, gladius_frame(x_r))
    part("weapon", sword, GRIP, fore_r, angle=40)

    e_l, w_l, x_l = arm_pose(S_L, LEFT, LEFT_ROD, S_L + V(-0.6, -0.25, -0.5))
    arm_l = part("armL", upper_arm("L", S_L, e_l, -1), S_L, torso_obj)
    fore_l = part("foreL", forearm("L", e_l, w_l, LEFT, x_l, LEFT_ROD, False),
                  e_l, arm_l)
    part("shield", scutum(), LEFT, fore_l, angle=40)

    report(root)
    pose = os.environ.get("GLADIATOR_POSE")
    if pose in POSES:
        gk.pose_root(root, R, POSES[pose])
    return root


# Poses in three.js Euler terms (x, y about the vertical, z), as troops.ts
# and moves/gladiator.ts set them (the torso's x there is its negated bend).
POSES = {
    # On guard: the shield up to the chin, the sword drawn back to the hip.
    "guard": {"armL": (0.3, 0, 0), "foreL": (0.3, 0, 0),
              "shield": (-0.55, 0, 0), "armR": (-0.3, 0, 0),
              "foreR": (0.5, 0, 0), "weapon": (-0.18, 0, 0),
              "torso": (-0.1, -0.1, 0), "head": (-0.06, 0.08, 0)},
    "wind": {"armL": (0.3, 0, 0), "foreL": (0.3, 0, 0),
             "shield": (-0.58, 0, 0), "armR": (-0.6, 0, 0),
             "foreR": (0.95, 0, 0), "weapon": (-0.32, 0, 0),
             "torso": (-0.06, -0.32, 0), "head": (-0.06, 0.24, 0)},
    # The thrust past the shield's right edge.
    "thrust": {"armL": (0.3, 0, 0), "foreL": (0.36, 0, 0),
               "shield": (-0.45, 0, 0), "armR": (1.25, 0, -0.1),
               "foreR": (-0.25, 0, 0), "weapon": (-0.92, 0, 0),
               "torso": (-0.22, 0.32, 0), "head": (-0.06, -0.24, 0),
               "skirtL": (0.27, 0, 0), "skirtR": (0.27, 0, 0)},
    # Mid-stride (the left leg forward), the kilt trailing the thighs.
    "walk": {"legL": (0.5, 0, 0), "kneeL": (-0.25, 0, 0),
             "footL": (-0.25, 0, 0), "legR": (-0.37, 0, 0),
             "kneeR": (-0.05, 0, 0), "footR": (0.42, 0, 0),
             "armR": (-0.28, 0, 0), "armL": (0.06, 0, 0),
             "shield": (-0.06, 0, 0), "foreR": (0.0, 0, 0),
             "skirtL": (0.31, 0, 0), "skirtR": (-0.23, 0, 0)},
    # The recovering leg lifted high through the pass.
    "walk2": {"legL": (-0.2, 0, 0), "kneeL": (-0.05, 0, 0),
              "footL": (0.25, 0, 0), "legR": (0.6, 0, 0),
              "kneeR": (-0.95, 0, 0), "footR": (0.35, 0, 0),
              "armR": (0.2, 0, 0), "armL": (-0.04, 0, 0),
              "shield": (0.04, 0, 0),
              "skirtL": (-0.12, 0, 0), "skirtR": (0.37, 0, 0)},
    # The shield spent: it hangs at his side.
    "down": {"armL": (-0.12, 0, -0.18), "foreL": (-0.5, 0, 0),
             "shield": (0.3, 0, 0)},
}


def report(root):
    print("GLADIATOR joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {gk.tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("GLADIATOR materials", len(mats), mats)
