"""The Miner (figure id `miner`) as a collector's miniature: a cheerful,
stocky Latino miner of the early 1900s in hand-painted resin.

A glossy brown hard hat with a ridge over the crown and a brass carbide
headlamp whose lens glows; a big black moustache over a wide smile, thick
brows, short dark hair; a dark-team bandana; a dusty team-colour shirt with
its sleeves rolled above the elbows; denim dungarees over a round belly,
the bib held by crossed straps with brass buttons, a light-team patch on
one knee and rolled cuffs; heavy lace-up work boots; a pickaxe on his right
shoulder.

Parts (figures.py has the contract), none with a rest rotation:

  miner           root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split off by
                  articulation.py)
    torso         pivot at the waist: shirt, dungarees, straps, bandana
      head        pivot at the neck: hat and lamp
      armL        pivot on the shoulder, a relaxed hanging arm
      armR        pivot on the shoulder: the upper arm to the elbow
        foreR     pivot in the elbow: forearm and fist
          weapon  the pickaxe, pivot in the right fist

At rest the right elbow is bent and the haft lies back over the shoulder,
the pick's head behind it. The swing (moves/miner.ts) lifts the upper arm,
straightens the elbow and turns the pick in the fist; all three turn about
x, so the pick stays in the arm's plane, clear of the hat.

MINER_POSE=<name> splits the knees early and turns the parts as the game
would (three.js Euler terms) before the previews: `walk`, `walk2`, `ready`,
`wind`, `strike`, `rise`.
"""

import math
import os

import bpy
import kit
import face_paint
import face_rig
import figure_miner_kit as mk
from figure_miner_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix

R = "miner"
T = kit.tint

# ------------------------------------------------------------- paints

SKIN = "resin:" + T("miner-skin", "#c7875c")
HAIR = "weave:" + T("miner-hair", "#2b211c")    # hair, moustache, brows
HAT = "lacquer:" + T("miner-hat", "#7a4f2a")
BRASS = "gilt:" + T("miner-brass", "#caa150")
LAMP = "glow:" + T("miner-lamp", "#fff0b8")
TEAM = "weave:team"                              # shirt
TEAM2 = "weave:team2"                            # bandana
TEAM3 = "weave:team3"                            # knee patch, rolled cuffs
DENIM = "weave:" + T("miner-denim", "#3f4b69")
BOOT = "hide:" + T("miner-boot", "#6a4128")
DARK = "hide:" + T("miner-dark", "#2f221b")      # soles, laces, eyes' pot
WOOD = "wood:" + T("miner-haft", "#9c6a3c")
IRON = "gilt:" + T("miner-iron", "#6c737d")
EDGE = "gilt:" + T("miner-edge", "#d2d8de")

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.095, 0.6
WAIST = V(0, 0, 0.64)
SH_X, SH_Z = 0.19, 0.955
S_L = V(-SH_X, 0, SH_Z)
S_R = V(SH_X, 0, SH_Z)
NECK = V(0, 0, 0.995)
UPPER, FORE = 0.23, 0.2
WRIST_FIST = 0.04
FIST_SCALE = 1.12

HEAD_DZ = -0.04
HC = V(0, 0.012, 1.162)          # skull centre (head space)

# The right arm at rest: elbow bent, fist in front of the shoulder, the
# haft back over the shoulder.
ELBOW_R = V(0.21, -0.03, 0.727)
FIST_R = ELBOW_R + V(0.02, 0.24 * math.cos(math.radians(40)),
                     0.24 * math.sin(math.radians(40)))
D = V(0, -0.751, 0.66).normalized()           # the haft, toward the head
P = V(0, 0.66, 0.751).normalized()            # the pick's point
HEAD_AT = 0.55

# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the shirt: a round belly.
BODY = [(0.5, 0.136, 0.115, 0.11), (0.58, 0.148, 0.132, 0.118),
        (0.64, 0.157, 0.148, 0.12), (0.7, 0.163, 0.158, 0.12),
        (0.76, 0.168, 0.156, 0.12), (0.83, 0.178, 0.142, 0.12),
        (0.89, 0.183, 0.13, 0.118), (0.935, 0.172, 0.113, 0.108),
        (0.965, 0.12, 0.084, 0.08), (0.998, 0.058, 0.052, 0.052)]
BODY_P = 2.3


def section(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def ring_point(rows, power, a, z, extra=0.0):
    rx_, ryf, ryb = section(rows, z)
    e = 2.0 / power
    s, c = math.sin(a), math.cos(a)
    return V((rx_ + extra) * spow(s, e),
             ((ryf if c >= 0 else ryb) + extra) * spow(c, e), z)


def body_point(a, z, extra=0.0):
    return ring_point(BODY, BODY_P, a, z, extra)


def radial(obj, centre_of, amount):
    for v in obj.data.vertices:
        p = v.co
        c = centre_of(p)
        d = V(p.x - c.x, p.y - c.y, 0)
        if d.length < 1e-6:
            continue
        a = math.atan2(d.x, d.y)
        v.co = p + d.normalized() * amount(a, p.z)
    return obj


# ------------------------------------------------------------- legs


def boot(sx, ankle, toe_out):
    """A heavy lace-up work boot: a round toe cap, a thick dark sole with a
    heel, a padded collar and criss-cross laces up the front."""
    pieces = []
    foot = [(-0.074, 0.034, 0.018, 0.07), (-0.062, 0.048, 0.018, 0.092),
            (-0.034, 0.056, 0.018, 0.102), (0.008, 0.058, 0.018, 0.096),
            (0.05, 0.057, 0.018, 0.084), (0.09, 0.052, 0.018, 0.074),
            (0.124, 0.042, 0.02, 0.066), (0.147, 0.024, 0.026, 0.056)]
    rings = []
    for y, rx_, zb, zt in foot:
        rings.append([V(x, y, (zb + zt) / 2 + z) for x, z, _ in
                      mk.sup(12, rx_, (zt - zb) / 2, 2.6, math.pi / 12)])
    pieces.append(mk.loft(f"{R}-boot{sx}", rings, BOOT,
                          start=V(0, -0.079, 0.045), end=V(0, 0.153, 0.04)))
    # The sole, a slab under the whole foot, and the heel.
    outline = [(x * (1.0 if y < 0 else 1.04), y + 0.035) for x, y, _ in
               mk.sup(16, 0.062, 0.118, 2.4)]
    pieces.append(mk.slab(f"{R}-sole{sx}", outline, 0.024, DARK,
                          bevel=0.004))
    # A toe cap, a hair proud of the upper.
    cap = []
    for y, rx_, zb, zt in foot[4:]:
        cap.append([V(x * 1.04, y + 0.002, (zb + zt) / 2 + z * 1.06)
                    for x, z, _ in mk.sup(12, rx_, (zt - zb) / 2, 2.6,
                                          math.pi / 12)])
    capm = mk.loft(f"{R}-cap{sx}", cap, BOOT, start=None,
                   end=V(0, 0.155, 0.041))
    pieces.append(capm)
    # Laces: an X over the instep, three times.
    for k in range(3):
        y0 = 0.07 - k * 0.03
        for side in (-1, 1):
            pts = [V(side * 0.03, y0, 0.08 + k * 0.012),
                   V(0, y0 - 0.015, 0.1 + k * 0.012),
                   V(-side * 0.03, y0 - 0.03, 0.098 + k * 0.012)]
            pieces.append(mk.tube(f"{R}-lace{sx}{k}{side}", pts,
                                  [0.0035] * 3, DARK, n=4,
                                  caps=("dome", "dome")))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    mk.transform(pieces, place)
    # The shaft round the ankle and its padded collar.
    c = V(ankle.x, ankle.y - 0.006, 0.0)
    shaft = []
    for z, r in ((0.07, 0.058), (0.12, 0.059), (0.17, 0.058),
                 (0.2, 0.06), (0.21, 0.064), (0.222, 0.063),
                 (0.228, 0.056)):
        shaft.append([c + V(math.sin(a) * r, math.cos(a) * r * 1.06, z)
                      for a in (i / 14 * math.tau for i in range(14))])
    pieces.append(mk.loft(f"{R}-shaft{sx}", shaft, BOOT,
                          bands=lambda i, j: DARK if j in (3, 4, 5)
                          else None))
    # Laces up the front of the shaft.
    for k in range(3):
        z = 0.12 + k * 0.03
        for side in (-1, 1):
            p0 = c + V(side * 0.03, 0.05, z)
            p1 = c + V(-side * 0.03, 0.05, z + 0.026)
            mid = (p0 + p1) / 2 + V(0, 0.012, 0)
            pieces.append(mk.tube(f"{R}-slace{sx}{k}{side}", [p0, mid, p1],
                                  [0.0035] * 3, DARK, n=4,
                                  caps=("dome", "dome")))
    return pieces


def trouser(sx, hip, knee, ankle):
    """A denim dungaree leg, roomy, with a rolled cuff over the boot."""
    below = lerp(knee, ankle, 0.35)
    path = [hip + V(0, 0, 0.01), lerp(hip, knee, 0.35), lerp(hip, knee, 0.72),
            knee + V(0, 0.004, 0.0), V(below.x, below.y, 0.26),
            V(below.x, below.y, 0.2)]
    radii = [0.058, 0.08, 0.077, 0.071, 0.068, 0.068]
    leg = mk.tube(f"{R}-denim{sx}", path, radii, DENIM, n=14,
                  caps=(None, None))

    def centre(p):
        t = mk.clamp01((hip.z + 0.01 - p.z) / (hip.z + 0.01 - 0.2))
        return lerp(hip, V(below.x, below.y, 0.2), t)

    radial(leg, centre, lambda a, z: 0.004 * math.sin(5 * a + 20 * z) *
           smooth(0.58, 0.5, z) * smooth(0.5, 0.55, z))
    pieces = [leg]
    # The rolled cuff.
    cuff = []
    for z, r in ((0.186, 0.069), (0.192, 0.076), (0.232, 0.077),
                 (0.24, 0.07)):
        cuff.append([V(below.x + math.sin(a) * r, below.y + math.cos(a) * r,
                       z) for a in (i / 14 * math.tau for i in range(14))])
    pieces.append(mk.loft(f"{R}-rollcuff{sx}", cuff, DENIM))
    if sx < 0:
        # A light-team patch over the left knee, with stitches.
        a0 = math.radians(-8)

        def patch(u, v):
            a = a0 + math.radians(lerp(-34, 34, u))
            z = lerp(0.382, 0.47, v)
            c = lerp(knee, hip, (z - knee.z) / (hip.z - knee.z)) \
                if z > knee.z else lerp(knee, ankle, (knee.z - z) /
                                        (knee.z - ankle.z))
            r = 0.084
            return V(c.x + math.sin(a) * r, c.y + math.cos(a) * r, z)

        pieces.append(mk.sheet(f"{R}-patch", patch, [0, 0.25, 0.5, 0.75, 1],
                               [0, 0.33, 0.66, 1], TEAM3, rim=0.004,
                               inside=knee))
    return pieces


def leg(sx):
    hip = V(sx * HIP_X, 0, HIP_Z)
    knee = V(sx * 0.105, 0.016, 0.36)
    ankle = V(sx * 0.116, -0.004, 0.09)
    pieces = trouser(sx, hip, knee, ankle) + boot(sx, ankle, 10)
    return pieces, hip


# ------------------------------------------------------------- torso


def shirt():
    n = 22
    c = mk.Mesh(f"{R}-shirt", TEAM)
    rows = []
    for z in [r[0] for r in BODY]:
        rows.append([c.v(body_point(i / n * math.tau, z)) for i in range(n)])
    c.grid(rows, TEAM, closed=True)
    c.fan(rows[-1], V(0, 0, 1.0), TEAM)
    c.fan(rows[0], V(0, 0, 0.49), TEAM, flip=True)
    return [c.obj(recalc=True)]


def dungarees():
    """The dungarees' seat and waist round the belly, the bib over the
    chest with a pocket, crossed straps over the shoulders and brass
    buttons."""
    pieces = []
    n = 24
    zs = [0.47, 0.52, 0.58, 0.64, 0.68]
    rings = []
    for z in zs:
        rings.append([body_point(i / n * math.tau, z, 0.007)
                      for i in range(n)])
    # The crotch closes under the seat.
    pieces.append(mk.loft(f"{R}-seat", rings, DENIM,
                          start=V(0, 0.0, 0.44), end=None))
    # The waistband seam, a little proud.
    band = [[body_point(i / n * math.tau, z, off) for i in range(n)]
            for z, off in ((0.655, 0.007), (0.66, 0.012), (0.68, 0.012),
                           (0.685, 0.007))]
    pieces.append(mk.loft(f"{R}-waistband", band, DENIM))

    def bib(u, v):
        z = lerp(0.66, 0.87, v)
        w = lerp(44, 36, v)
        a = math.radians(lerp(-w, w, u))
        return body_point(a, z, 0.008 + 0.002 * math.sin(math.pi * u))

    pieces.append(mk.sheet(f"{R}-bib", bib, [i / 8 for i in range(9)],
                           [i / 6 for i in range(7)], DENIM, rim=0.005,
                           inside=V(0, 0, 0.76)))

    def pocket(u, v):
        z = lerp(0.74, 0.815, v)
        a = math.radians(lerp(-17, 17, u))
        return body_point(a, z, 0.0135)

    pieces.append(mk.sheet(f"{R}-pocket", pocket, [0, 0.5, 1],
                           [0, 0.5, 1], DENIM, rim=0.004,
                           inside=V(0, 0, 0.78), rim_edges=("u0", "u1",
                                                            "v0")))
    # Straps: from the bib's top corners over the shoulders, crossing on
    # the back down to the waistband.
    for sx in (-1, 1):
        top = body_point(math.radians(sx * 32), 0.865, 0.011)
        pts = [top, body_point(math.radians(sx * 30), 0.92, 0.012),
               V(sx * 0.1, 0.03, 0.985), V(sx * 0.098, -0.06, 0.975),
               body_point(math.radians(sx * 150), 0.9, 0.012),
               body_point(math.radians(-sx * 164), 0.78, 0.012),
               body_point(math.radians(-sx * 146), 0.69, 0.012)]
        pts = [V(p) for p in kit.smooth_path(pts, 3)]
        pieces.append(ribbon(f"{R}-strap{sx}", pts, 0.017, 0.0035, DENIM))
        # The brass button at each corner of the bib.
        b = body_point(math.radians(sx * 32), 0.855, 0.017)
        pieces.append(mk.ball(f"{R}-button{sx}", 0.011, b, BRASS,
                              scale=(1, 0.6, 1), seg=8, rings=4))
        hb = body_point(math.radians(sx * 88), 0.63, 0.015)
        pieces.append(mk.ball(f"{R}-hbutton{sx}", 0.009, hb, BRASS,
                              scale=(0.6, 1, 1), seg=8, rings=4))
    return pieces


def ribbon(name, pts, half, th, mat):
    """A flat strap along a path over the body: wide across, thin along
    the body's outward normal (which turns up over the shoulders)."""
    rings = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        n = V(p.x, p.y, max(0.0, p.z - 0.93) * 14).normalized()
        n = (n - t * n.dot(t)).normalized()
        side = t.cross(n).normalized()
        rings.append([p + side * half + n * th, p - side * half + n * th,
                      p - side * half - n * th, p + side * half - n * th])
    return mk.loft(name, rings, mat, start="flat", end="flat")


def bandana():
    """The dark-team bandana round the neck, knotted at the front left."""
    pieces = []
    n = 16
    rings = []
    for z, r in ((0.965, 0.1), (0.985, 0.082), (1.002, 0.068),
                 (1.018, 0.062), (1.03, 0.056)):
        rings.append([V(math.sin(a) * r * 1.03, -0.004 + math.cos(a) * r, z)
                      for a in (i / n * math.tau for i in range(n))])
    pieces.append(mk.loft(f"{R}-bandana", rings, TEAM2))

    def tri(u, v):
        w = lerp(0.052, 0.004, v ** 0.9)
        z = lerp(0.99, 0.9, v)
        y = body_point(0.0, max(0.88, z)).y + 0.012 + 0.008 * (1 - v)
        y += 0.004 * math.sin(math.pi * v) * (1 - abs(u))
        return V(u * w, y, z)

    pieces.append(mk.sheet(f"{R}-bpoint", tri, [-1, -0.5, 0, 0.5, 1],
                           [0, 0.35, 0.7, 1], TEAM2, rim=0.004,
                           inside=V(0, 0, 0.9)))
    k = V(-0.046, 0.058, 0.99)
    pieces.append(mk.ball(f"{R}-bknot", 0.016, k, TEAM2,
                          scale=(1.1, 0.8, 0.9), seg=8, rings=5))
    for j, (dx, dz) in enumerate(((-0.012, -0.035), (-0.03, -0.024))):
        pieces.append(mk.tube(f"{R}-bend{j}", [k, k + V(dx, 0.008, dz)],
                              [(0.004, 0.012), (0.003, 0.008)], TEAM2, n=5,
                              up=(0, 1, 0), caps=(None, "dome")))
    return pieces


# ------------------------------------------------------------- head

FACE_W = [(1.0, 0.032), (1.025, 0.045), (1.045, 0.057), (1.062, 0.064),
          (1.076, 0.068), (1.095, 0.071), (1.12, 0.073), (1.145, 0.074),
          (1.17, 0.074), (1.2, 0.074), (1.225, 0.071), (1.245, 0.063),
          (1.26, 0.047), (1.268, 0.02)]
FACE_D = [(1.0, 0.03), (1.025, 0.043), (1.045, 0.058), (1.062, 0.069),
          (1.074, 0.074), (1.09, 0.076), (1.12, 0.078), (1.15, 0.075),
          (1.172, 0.081), (1.2, 0.082), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
NOSE_H = [(1.1, 0.0), (1.106, 0.008), (1.113, 0.021), (1.121, 0.028),
          (1.13, 0.026), (1.145, 0.018), (1.16, 0.01), (1.172, 0.004),
          (1.186, 0.0)]
NOSE_S = [(1.11, 13.5), (1.13, 10.0), (1.17, 7.0)]


def face_disp(ad, z):
    """A broad nose, round smiling cheeks and a soft chin."""
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.007 * gauss(a, 13.5, 5.5) * gauss(z, 1.114, 0.007)     # nostrils
    d -= 0.01 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)        # sockets
    bz = 1.174 - 0.003 * gauss(a, 9, 8)
    d += 0.008 * gauss(z, bz, 0.0065) * smooth(52, 30, a)         # brow
    d += 0.011 * gauss(a, 40, 13) * gauss(z, 1.122, 0.014)        # cheeks
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.0026 * gauss(z, 1.084, 0.0035) * gauss(ad, 0, 12)      # lip
    d += 0.008 * gauss(z, 1.064, 0.011) * gauss(ad, 0, 22)        # chin
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)        # temples
    return d


HEAD = mk.Head(R, FACE_W, FACE_D, BACK_D, face_disp, hc=tuple(HC))


def hairline(a):
    if abs(a) < 64:
        return 9.0
    return table([(64, 1.19), (80, 1.19), (86, 1.17),
                  (100, 1.178), (116, 1.13), (140, 1.082), (180, 1.066)],
                 abs(a))


def moustache():
    """A big black moustache: two thick rolls from under the nose,
    drooping over the corners of the smile and curling up at the ends."""
    out = []
    for sx in (-1, 1):
        pts = []
        for ad, z, off in ((1, 1.104, 0.007), (9, 1.101, 0.011),
                           (18, 1.095, 0.013), (27, 1.088, 0.011),
                           (35, 1.09, 0.009), (40, 1.1, 0.007)):
            pts.append(HEAD.point(sx * ad, z) + HEAD.normal(sx * ad, z) *
                       off)
        out.append(mk.tube(f"{R}-stache{sx}", pts,
                           [0.0095, 0.0135, 0.0135, 0.011, 0.008, 0.004],
                           HAIR, n=8, caps=("dome", "dome")))
    return out


def brows():
    out = []
    for sx in (-1, 1):
        pts = []
        for ad, z in ((11, 1.18), (21, 1.188), (32, 1.19), (42, 1.185)):
            pts.append(HEAD.point(sx * ad, z) + HEAD.normal(sx * ad, z) *
                       0.005)
        out.append(mk.tube(f"{R}-brow{sx}", pts,
                           [(0.005, 0.006), (0.0062, 0.0074),
                            (0.0055, 0.0066), (0.0035, 0.0042)], HAIR, n=8,
                           up=(0, 1, 0), caps=("dome", "dome")))
    return out


def face():
    eyes = face_paint.eyes(mk, R, HEAD.point, HC, z=1.1565,
                           expression="confident")
    keep = []
    for o in eyes:
        if "brow" in o.name:
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            keep.append(o)
    return keep + face_paint.mouth(mk, R, HEAD.point, HC, z=1.084,
                                   expression="confident")


def stubble():
    """A close dark shadow over the jaw and chin."""
    top = [(0, 1.072), (14, 1.072), (24, 1.08), (34, 1.098), (46, 1.106),
           (60, 1.11), (72, 1.113), (82, 1.112)]
    return [HEAD.shell(f"{R}-stubble", "resin:" + T("miner-shadow",
                                                    "#a06a49"),
                       lambda a: table(top, abs(a)), lambda a: 1.03,
                       0.003, rows=6)]


def neck():
    return mk.tube(f"{R}-neck", [V(0, 0.0, 0.95), V(0, 0.004, 1.03),
                                 V(0, 0.01, 1.07)],
                   [0.052, 0.05, 0.047], SKIN, n=12, caps=(None, None))


HAT_RIM = 1.196
HAT_TOP = 1.335


def hat_rim(ad):
    return HAT_RIM - 0.012 * (1 - math.cos(math.radians(ad))) / 2


def hat_point(ad, z, off=0.0):
    a = math.radians(ad)
    k = 1.0
    if z > HAT_RIM + 0.01:
        q = (z - HAT_RIM - 0.01) / (HAT_TOP - HAT_RIM - 0.01)
        k = math.sqrt(max(0.0, 1 - q ** 1.8))
    s, c = math.sin(a), math.cos(a)
    rx_, ryf, ryb = 0.094 + off, 0.103 + off, 0.113 + off
    e = 2.0 / 2.3
    return V(rx_ * k * spow(s, e), 0.006 + (ryf if c >= 0 else ryb) * k *
             spow(c, e), z)


def hat():
    """A glossy hard hat: a round crown with a ridge from front to back,
    a narrow brim with a peak at the front, and the brass lamp."""
    pieces = []
    n = 30
    angs = [i / n * 360 - 180 for i in range(n)]
    zs = [None, 1.215, 1.24, 1.265, 1.288, 1.306, 1.32, 1.33]
    rings = []
    for j, z in enumerate(zs):
        ring = []
        for ad in angs:
            zz = hat_rim(ad) if j == 0 else z
            ring.append(hat_point(ad, zz))
        rings.append(ring)
    under = [hat_point(ad, hat_rim(ad), -0.022) for ad in angs]
    pieces.append(mk.loft(f"{R}-crown", [under] + rings, HAT,
                          end=V(0, 0.006, HAT_TOP)))
    # A raised rib over the crown from front to back.
    rib = [hat_point(0, z, 0.002) for z in (1.228, 1.26, 1.29, 1.312)] + \
        [V(0, 0.006, HAT_TOP + 0.004)] + \
        [hat_point(180, z, 0.002) for z in (1.312, 1.29, 1.26, 1.228)]
    pieces.append(mk.tube(f"{R}-rib", rib, [(0.011, 0.007)] * len(rib), HAT,
                          n=6, up=(1, 0, 0), caps=("dome", "dome")))

    # The brim: narrow round the sides and back, a peak at the front.
    def brim(u, v):
        ad = u
        c = math.cos(math.radians(ad))
        reach = 0.018 + 0.042 * max(0.0, c) ** 2
        inner = hat_point(ad, hat_rim(ad) + 0.004, -0.002)
        d = V(inner.x, inner.y - 0.006, 0)
        d.normalize()
        p = inner + d * reach * v
        p.z = hat_rim(ad) + 0.004 - 0.012 * v * max(0.0, c) ** 2 + \
            0.004 * v * max(0.0, -c)
        return p

    pieces.append(mk.sheet(f"{R}-brim", brim, [i * 360 / 32 - 180
                                               for i in range(32)],
                           [0.0, 0.6, 1.0], HAT, rim=0.006, closed_u=True,
                           back=True, inside=V(0, 0.006, 1.4)))
    # The lamp's bracket, water tank, reflector and glowing lens, on the
    # front of the crown.
    base = hat_point(0, 1.245, 0.0)
    pieces.append(mk.rbox(f"{R}-bracket", (0.034, 0.012, 0.04),
                          base + V(0, 0.004, 0.0), BRASS, levels=1,
                          crease=0.5))
    tank = base + V(0, 0.022, -0.004)
    pieces.append(mk.tube(f"{R}-tank", [tank - V(0, 0, 0.026),
                                       tank + V(0, 0, 0.022)],
                          [0.017, 0.017], BRASS, n=12, caps=("dome", "flat")))
    dish_c = tank + V(0, 0.018, 0.03)
    prof = [(0.011, -0.004), (0.02, 0.004), (0.031, 0.014), (0.035, 0.019),
            (0.034, 0.012), (0.022, -0.002), (0.012, -0.01)]
    dish = kit.lathe(f"{R}-dish", prof, segments=16, mat=BRASS)
    m = mk.basis(V(1, 0, 0), V(0, 0, -1), V(0, 1, 0), dish_c)
    mk.transform([dish], m)
    pieces.append(dish)
    lens = mk.Mesh(f"{R}-lens", LAMP)
    ring = [lens.v(dish_c + V(x, 0.006, z)) for x, z, _ in
            mk.sup(14, 0.021, 0.021)]
    lens.fan(ring, dish_c + V(0, 0.013, 0))
    pieces.append(lens.obj(outward=dish_c - V(0, 0.05, 0)))
    pieces.append(mk.tube(f"{R}-burner", [dish_c + V(0, -0.004, 0),
                                         dish_c + V(0, 0.02, 0)],
                          [0.006, 0.004], BRASS, n=6, caps=(None, "dome")))
    return pieces


def head():
    skull = HEAD.skull(SKIN, HAIR, hairline=hairline)
    pieces = [skull, neck()] + stubble() + face() + moustache() + brows() + \
        HEAD.ears(SKIN)
    helmet = hat()
    mk.transform(pieces + helmet, Matrix.Translation(V(0, 0, HEAD_DZ)))
    return pieces, helmet


# ------------------------------------------------------------- arms


def upper_sleeve(side, s, e, sx):
    """The shirt sleeve rolled above the elbow, bare arm below it to the
    elbow ball."""
    pieces = []
    up = (e - s).normalized()
    roll_at = lerp(s, e, 0.62)
    pieces.append(mk.ball(f"{R}-shoulder{side}", 1.0,
                          s + V(sx * 0.004, 0, -0.014), TEAM,
                          scale=(0.06, 0.062, 0.05), seg=12, rings=6))
    pieces.append(mk.tube(f"{R}-sleeve{side}", [s + up * 0.004,
                                               lerp(s, e, 0.3), roll_at],
                          [0.06, 0.06, 0.057], TEAM, n=12,
                          caps=(None, None)))
    pieces.append(mk.tube(f"{R}-roll{side}", [roll_at - up * 0.012,
                                             roll_at + up * 0.026],
                          [0.064, 0.063], TEAM3, n=12, caps=(None, None)))
    pieces.append(mk.tube(f"{R}-biceps{side}", [roll_at, e],
                          [0.05, 0.046], SKIN, n=10, caps=(None, None)))
    pieces.append(mk.ball(f"{R}-elbow{side}", 0.046, e, SKIN, seg=10,
                          rings=6))
    return pieces


def forearm(side, e, w, c, xax, kax, chir):
    fo = (w - e).normalized()
    pieces = [mk.ball(f"{R}-elbowf{side}", 0.045, e, SKIN, seg=10, rings=6),
              mk.tube(f"{R}-fore{side}", [e, lerp(e, w, 0.45), w],
                      [0.045, 0.047, 0.039], SKIN, n=10, caps=(None, None))]
    hand = mk.fist(f"{R}-hand{side}", c, xax, kax, chir, SKIN)
    mk.scale_about(hand, c, FIST_SCALE)
    return pieces + hand


def right_arm():
    s, e, c = S_R, ELBOW_R, FIST_R
    xax = (c - e) - D * (c - e).dot(D)
    xax.normalize()
    w = c - xax * WRIST_FIST
    # The forearm reaches the wrist; the upper arm keeps its length.
    kax = xax.cross(D)
    upper = upper_sleeve("R", s, e, 1)
    fore = forearm("R", e, w, c, xax, kax, -1)
    return upper, fore


def left_arm():
    """Hanging relaxed, a little bent, the fist loose by the hip."""
    s = S_L
    c = V(-0.228, 0.07, 0.545)
    pole = s + V(-0.3, -0.6, -0.2)
    e0 = mk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    fwd = V(0, 1, 0)
    xax = (c - e0).normalized()
    w = c - xax * WRIST_FIST
    e = mk.ik(s, w, UPPER, FORE, pole)
    # The pole of the fist points forward, the knuckles out to the side.
    z = fwd - xax * fwd.dot(xax)
    z.normalize()
    kax = z.cross(xax)
    return upper_sleeve("L", s, e, -1), \
        forearm("L", e, w, c, xax, kax, 1), s, e


# ------------------------------------------------------------- the pick


def pickaxe():
    """In its own frame: y along the haft toward the head, x toward the
    point (the other end a chisel), z across; the right fist at the
    origin. The two arms of the head curve back toward the hands."""
    Q = []
    butt, end = -0.07, HEAD_AT + 0.035
    Q.append(mk.tube(f"{R}-haft", [V(0, butt, 0), V(0, 0.3, 0),
                                  V(0, end, 0)],
                     [0.0175, 0.018, 0.0205], WOOD, n=10,
                     caps=("dome", "flat")))
    h = HEAD_AT
    # The eye: a collar round the haft.
    Q.append(mk.tube(f"{R}-eye", [V(0, h - 0.035, 0), V(0, h - 0.02, 0),
                                 V(0, h + 0.02, 0), V(0, h + 0.03, 0)],
                     [(0.024, 0.022), (0.03, 0.026), (0.03, 0.026),
                      (0.026, 0.022)], IRON, n=10, up=(1, 0, 0),
                     caps=("flat", "flat")))
    # The point and the chisel, curving back toward the hands.
    for side, length, flat in ((1, 0.2, False), (-1, 0.16, True)):
        pts, radii = [], []
        for k in range(7):
            t = k / 6
            x = side * (0.02 + length * t)
            y = h - 0.05 * t * t
            pts.append(V(x, y, 0))
            r = lerp(0.023, 0.004 if not flat else 0.012, t ** 0.9)
            radii.append((r, r * (0.95 if not flat else 0.5 + 0.5 *
                                  (1 - t))))
        Q.append(mk.tube(f"{R}-arm{side}", pts, radii, IRON, n=8,
                         up=(0, 0, 1), caps=("flat", "dome"),
                         bands={5: EDGE, 6: EDGE}))
    # A wedge in the top of the haft.
    Q.append(mk.rbox(f"{R}-wedge", (0.012, 0.012, 0.03), V(0, end, 0),
                     IRON, levels=1, crease=0.5))
    return Q


def pick_frame():
    return mk.basis(P, D, P.cross(D), FIST_R)


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("MINER_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + mk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return mk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="miner"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        pieces, hip = leg(sx)
        part(f"leg{side}", pieces, hip, root)

    torso = shirt() + dungarees() + bandana()
    torso_obj = part("torso", torso, WAIST, root)
    face, helmet = head()
    head_obj = face_rig.head(mk.part, R, face, NECK, torso_obj, angle=62)
    # The lamp belongs to the helmet and never moves away from its bracket.
    part("hat", helmet, V(0, 0.008, 1.2 + HEAD_DZ), head_obj, angle=62)

    upper, fore = right_arm()
    arm_r = part("armR", upper, S_R, torso_obj)
    fore_r = part("foreR", fore, ELBOW_R, arm_r)
    pick = pickaxe()
    mk.transform(pick, pick_frame())
    part("weapon", pick, FIST_R, fore_r, angle=40)
    upper, lower, s_l, e_l = left_arm()
    arm_l = part("armL", upper, s_l, torso_obj)
    part("foreL", lower, e_l, arm_l)

    report(root)
    pose = os.environ.get("MINER_POSE")
    if pose:
        mk.pose(root, R, POSES, pose)
    return root


# Preview poses in three.js Euler terms, as moves/miner.ts sets them.
POSES = {
    "walk": {"legL": (0.6, 0, 0), "kneeL": (-0.25, 0, 0),
             "footL": (-0.35, 0, 0), "legR": (-0.42, 0, 0),
             "kneeR": (-0.05, 0, 0), "footR": (0.47, 0, 0),
             "armL": (-0.35, 0, 0), "armR": (0.05, 0, 0),
             "torso": (-0.05, 0.06, 0)},
    "walk2": {"legR": (0.88, 0, 0), "kneeR": (-0.95, 0, 0),
              "footR": (0.07, 0, 0), "legL": (-0.3, 0, 0),
              "armL": (0.35, 0, 0), "armR": (-0.05, 0, 0)},
    "ready": {"armR": (0.9, 0, 0), "foreR": (-1.2, 0, 0),
              "weapon": (-0.5, 0, 0), "armL": (0.4, 0, 0)},
    "wind": {"armR": (2.6, 0, 0.12), "foreR": (-0.8, 0, 0),
             "weapon": (-0.35, 0, 0), "armL": (1.2, 0, 0),
             "torso": (0.14, 0, 0), "head": (0.1, 0, 0)},
    "strike": {"armR": (1.05, 0, 0), "foreR": (-2.2, 0, 0),
               "weapon": (-0.75, 0, 0), "armL": (0.3, 0, 0),
               "torso": (-0.32, 0, 0), "head": (0.2, 0, 0),
               "legL": (0.25, 0, 0), "legR": (-0.2, 0, 0)},
    "rise": {"armR": (1.4, 0, 0), "foreR": (-0.6, 0, 0),
             "armL": (2.4, 0, 0.3), "legL": (0.3, 0, 0),
             "kneeL": (-0.6, 0, 0), "legR": (-0.2, 0, 0)},
}


def report(root):
    print("MINER joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {mk.tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("MINER materials", len(mats), mats)
