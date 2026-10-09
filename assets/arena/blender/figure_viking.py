"""The Viking (figure id `viking`) as a collector's miniature: a big, broad
Norse warrior in hand-painted resin.

A round iron helmet with a nose guard and bronze bands (no horns), bushy
ginger brows under its rim, a huge ginger beard with two bronze-beaded
braids and a drooping moustache; a thick grey fur collar over the
shoulders; a team-colour tunic with light team trim at the neck, cuffs and
hem, split front and back below a broad leather belt with a bronze buckle
and a pouch; dark team trousers, cream leg wraps criss-crossed with leather
thongs, soft leather shoes; leather bracers on bare forearms; and a long
two-handed bearded axe held low across the body, its head down by his left
foot.

Parts (figures.py has the contract), none with a rest rotation:

  viking          root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split off by
                  articulation.py)
    torso         pivot at the waist: tunic, belt, pouch, fur collar
      skirtL/R    the tunic's split skirt halves, pivots on the hip line,
                  turned by moves/viking.ts to trail the legs
      head        pivot at the neck: helmet, beard, braids
      armL, armR  pivots on the shoulders, which share one line along x
        weapon    the axe, child of armR, pivot in the right fist

The hold is built for the spin: turning BOTH arms by the same angle about x
keeps both fists on the haft, and at about +0.84 rad the haft lies level,
pointing out forward left with the blade flat and leading, so a whole-body
turn to the left (positive yawKick) sweeps it round like a scythe.

VIKING_POSE=<name> splits the knees early and turns the parts as the game
would (three.js Euler terms, figure_viking_kit.runtime_quat) before the
previews: `walk`, `walk2`, `wind`, `spin`, `rage`.
"""

import math
import os

import bpy
import kit
import face_paint
import face_rig
import figure_viking_kit as vk
import figure_viking_sculpt as sculpt
from figure_viking_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

R = "viking"
T = kit.tint

# ------------------------------------------------------------- paints
# Twelve pots, one draw batch each at runtime.

SKIN = "skin:" + T("viking-skin", "#dca580")
GINGER = "hair:" + T("viking-ginger", "#a54d23")
IRON = "gilt:" + T("viking-iron", "#7d8591")
EDGE = "gilt:" + T("viking-edge", "#d3dae2")
BRONZE = "gilt:" + T("viking-bronze", "#c08d45")
FUR = "hair:" + T("viking-fur", "#8d8b86")
TEAM = "weave:team"                          # tunic
TRIM = "weave:team3"                         # tunic trim
TROUSER = "weave:team2"                      # trousers
WRAP = "weave:" + T("viking-wrap", "#d8c7a0")
LEATHER = "hide:" + T("viking-leather", "#744729")
DARK = "hide:" + T("viking-dark", "#3b281b")  # soles, thongs, pupils' pot
WOOD = "wood:" + T("viking-ash", "#a8763f")

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.092, 0.62
WAIST = V(0, 0, 0.68)
SH_X, SH_Z = 0.205, 1.0
S_L = V(-SH_X, 0, SH_Z)
S_R = V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.04)
UPPER, FORE = 0.27, 0.24
WRIST_FIST = 0.042
FIST_SCALE = 1.14

HEAD_DZ = 0.014
HC = V(0, 0.012, 1.162)          # skull centre (head space)

# ------------------------------------------------------------- the axe hold
# The haft runs from the right fist (near its butt) down and across to the
# left, through the left fist, to the head by the left foot. SPIN is the
# arms' turn that lays it level; the blade's flat then faces straight up.

D = V(-0.66, 0.5, -0.56).normalized()
SPIN = math.atan2(-D.z, D.y)
N_REST = V(0, math.sin(SPIN), math.cos(SPIN))
B_REST = N_REST.cross(D).normalized()       # the blade, up and out left
GRIP_R = V(0.135, 0.2, 0.74)
GRIP_L = GRIP_R + D * 0.24
HEAD_AT = 0.95                               # the head's centre on the haft

# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the tunic.
BODY = [(0.5, 0.14, 0.114, 0.108), (0.58, 0.15, 0.124, 0.114),
        (0.64, 0.158, 0.132, 0.117), (0.7, 0.165, 0.139, 0.118),
        (0.78, 0.177, 0.143, 0.12), (0.86, 0.19, 0.146, 0.124),
        (0.93, 0.196, 0.141, 0.126), (0.975, 0.186, 0.123, 0.116),
        (1.01, 0.13, 0.09, 0.086), (1.045, 0.062, 0.056, 0.056)]
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
    """Push each vertex out from its own centre (centre_of(z)) by
    amount(angle, z): folds and tufts on a finished piece."""
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


def shoe(sx, ankle, toe_out):
    """A soft leather turnshoe with a rounded toe, a dark sole and a cuff
    round the ankle closed by a toggle."""
    pieces = []
    foot = [(-0.072, 0.03, 0.004, 0.066), (-0.06, 0.045, 0.0, 0.088),
            (-0.032, 0.053, 0.0, 0.098), (0.008, 0.055, 0.0, 0.09),
            (0.05, 0.053, 0.0, 0.076), (0.09, 0.047, 0.0, 0.062),
            (0.122, 0.037, 0.002, 0.052), (0.143, 0.021, 0.008, 0.042)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in vk.sup(12, rx_, (zt - zb) / 2, 2.5, math.pi / 12):
            ring.append(V(x, y, max(0.0, (zb + zt) / 2 + z)))
        rings.append(ring)
    pieces.append(vk.loft(f"{R}-shoe{sx}", rings, LEATHER,
                          bands=lambda i, j: DARK if i in (7, 8, 9) else None,
                          start=V(0, -0.077, 0.036), end=V(0, 0.15, 0.026)))
    # A seam over the instep.
    seam = [V(0, 0.132, 0.045), V(0, 0.09, 0.066), V(0, 0.045, 0.082),
            V(0, 0.01, 0.094)]
    pieces.append(vk.tube(f"{R}-seam{sx}", seam, [0.0035] * 4, LEATHER, n=4,
                          caps=("dome", "dome")))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    vk.transform(pieces, place)
    # The cuff round the ankle, above the shoe, and its toggle.
    c = V(ankle.x, ankle.y - 0.008, 0.0)
    cuff = []
    for z, r in ((0.07, 0.052), (0.09, 0.056), (0.118, 0.054),
                 (0.126, 0.049)):
        cuff.append([c + V(math.sin(a) * r, math.cos(a) * r * 1.06, z)
                     for a in (i / 14 * math.tau for i in range(14))])
    pieces.append(vk.loft(f"{R}-cuff{sx}", cuff, LEATHER))
    tg = c + V(sx * 0.052, 0.012, 0.1)
    pieces.append(vk.tube(f"{R}-toggle{sx}", [tg - V(0, 0, 0.012),
                                             tg + V(0, 0, 0.012)],
                          [0.0055, 0.0055], BRONZE, n=6,
                          caps=("dome", "dome")))
    return pieces


def trousers(sx, hip, knee):
    """Baggy dark-team trousers from the hip, bloused over the knee."""
    path = [hip + V(0, 0, 0.01), lerp(hip, knee, 0.3), lerp(hip, knee, 0.62),
            knee + V(0, 0.004, 0.03), knee + V(0, 0, -0.02)]
    radii = [0.058, 0.084, 0.086, 0.077, 0.064]
    leg = vk.tube(f"{R}-trouser{sx}", path, radii, TROUSER, n=14,
                  caps=(None, None))

    def centre(p):
        t = vk.clamp01((hip.z + 0.01 - p.z) / (hip.z + 0.03 - knee.z))
        return lerp(hip, knee, t)

    radial(leg, centre, lambda a, z: 0.006 * math.sin(6 * a + 18 * z) *
           smooth(0.62, 0.52, z))
    return [leg]


def wraps(sx, knee, ankle):
    """Cream wool bands wound from the knee to the ankle, tilted as they
    go round, criss-crossed by two leather thongs."""
    pieces = []
    top, bot = 0.35, 0.108
    n = 12
    bands = 10

    def along(z):
        return lerp(ankle, knee, (z - ankle.z) / (knee.z - ankle.z))

    def rad(z):
        return lerp(0.047, 0.061, smooth(bot, top, z) ** 0.8)

    rings = []
    for k in range(bands + 1):
        for part, (dz, grow) in enumerate(((0.0, 0.96), (0.5, 1.07))):
            if k == bands and part:
                break
            zc = lerp(bot, top, (k + dz) / bands)
            ring = []
            for i in range(n):
                a = i / n * math.tau
                z = zc + 0.007 * math.sin(a)
                c = along(z)
                r = rad(z) * grow
                ring.append(V(c.x + math.sin(a) * r, c.y + math.cos(a) * r,
                              z))
            rings.append(ring)
    pieces.append(vk.loft(f"{R}-wrap{sx}", rings, WRAP))
    # Two thongs spiralling opposite ways, crossing at the front and back.
    for hand in (-1, 1):
        pts = []
        for k in range(19):
            t = k / 18
            z = lerp(bot + 0.012, top - 0.01, t)
            a = hand * t * 2.5 * math.tau + (0 if hand > 0 else math.pi)
            c = along(z)
            r = rad(z) * 1.075 + 0.002
            pts.append(V(c.x + math.sin(a) * r, c.y + math.cos(a) * r, z))
        pieces.append(vk.tube(f"{R}-thong{sx}{hand}", pts, [0.0036] * 19,
                              DARK, n=4, caps=("dome", "dome")))
    # A tie under the knee.
    c = along(top)
    tie = [[c + V(math.sin(a) * r, math.cos(a) * r, top + dz)
            for a in (i / n * math.tau for i in range(n))]
           for dz, r in ((-0.012, 0.062), (0.0, 0.067), (0.012, 0.062))]
    pieces.append(vk.loft(f"{R}-tie{sx}", tie, DARK))
    return pieces


def leg(sx):
    hip = V(sx * HIP_X, 0, HIP_Z)
    knee = V(sx * 0.112, 0.012, 0.36)
    ankle = V(sx * 0.122, -0.004, 0.09)
    pieces = trousers(sx, hip, knee) + wraps(sx, knee, ankle) + \
        shoe(sx, ankle, 11 if sx < 0 else 8)
    return pieces, hip


# ------------------------------------------------------------- torso


def tunic():
    """The tunic body from under the skirts to the neck, with a little
    chest and a trim band round the neckline."""
    n = 22
    zs = [0.49] + [r[0] for r in BODY[1:]]
    c = vk.Mesh(f"{R}-tunic", TEAM)
    rows = []
    for z in zs:
        row = []
        for i in range(n):
            a = i / n * math.tau
            p = body_point(a, z, -0.008 * smooth(0.6, 0.56, z))
            # Pecs and shoulder blades under the wool.
            p += V(math.sin(a), math.cos(a), 0) * (
                0.008 * gauss(z, 0.88, 0.05) * gauss(abs(math.sin(a)), 0.45,
                                                       0.25))
            row.append(c.v(p))
        rows.append(row)
    c.grid(rows, TEAM, closed=True)
    c.fan(rows[-1], V(0, 0, 1.05), TEAM)
    c.fan(rows[0], V(0, 0, 0.48), TEAM, flip=True)
    pieces = [c.obj(recalc=True)]
    band = []
    for z, off in ((1.004, 0.0), (1.009, 0.006), (1.03, 0.005),
                   (1.036, -0.001)):
        band.append([body_point(i / n * math.tau, z, off) for i in range(n)])
    pieces.append(vk.loft(f"{R}-neckband", band, TRIM))
    return pieces


BELT_Z = (0.572, 0.655)


def belt():
    pieces = []
    n = 26
    rings = []
    for z, off in ((BELT_Z[0], 0.004), (BELT_Z[0] + 0.004, 0.013),
                   (BELT_Z[1] - 0.004, 0.013), (BELT_Z[1], 0.004)):
        rings.append([body_point(i / n * math.tau, z, off) for i in range(n)])
    pieces.append(vk.loft(f"{R}-belt", rings, LEATHER))
    # The bronze buckle: a D-shaped frame and a plate.
    zc = sum(BELT_Z) / 2
    front = body_point(0.0, zc, 0.016)
    frame = [front + V(x, 0.006, z) for x, z, _ in
             vk.sup(14, 0.036, 0.04, 3.2)]
    pieces.append(vk.tube(f"{R}-buckle", frame + [frame[0]], [0.0065] * 15,
                          BRONZE, n=5, up=(0, 1, 0), caps=(None, None)))
    pieces.append(vk.rbox(f"{R}-bplate", (0.05, 0.01, 0.056),
                          front + V(0.0, 0.002, 0.0), BRONZE, levels=1,
                          crease=0.6))
    pieces.append(vk.tube(f"{R}-tongue", [front + V(-0.03, 0.004, 0.0),
                                         front + V(-0.07, 0.0, -0.002)],
                          [(0.005, 0.024)] * 2, LEATHER, n=4, up=(0, 1, 0),
                          caps=("flat", "dome")))
    # Studs round the belt.
    for k, ad in enumerate((-150, -120, -90, -60, -32, 32, 60, 90, 120, 150,
                            180)):
        p = body_point(math.radians(ad), zc, 0.017)
        pieces.append(vk.ball(f"{R}-stud{k}", 0.0075, p, BRONZE,
                              scale=(1, 1, 1), seg=5, rings=3))
    # A pouch on the left hip.
    a = math.radians(-62)
    p = body_point(a, 0.555, 0.034)
    out = V(math.sin(a), math.cos(a), 0)
    m = vk.look(out, (0, 0, 1), p)
    pouch = vk.rbox(f"{R}-pouch", (0.075, 0.08, 0.04), V(0, 0, 0), LEATHER,
                    levels=2, crease=0.3, matrix=m)
    flap = vk.rbox(f"{R}-flap", (0.08, 0.04, 0.03), V(0, 0, 0), LEATHER,
                   levels=2, crease=0.3,
                   matrix=m @ Matrix.Translation(V(0, 0.028, 0.012)))
    pieces += [pouch, flap]
    pieces.append(vk.ball(f"{R}-pbutton", 0.008, p + out * 0.03 +
                          V(0, 0, 0.012), BRONZE, seg=6, rings=3))
    return pieces


def fur_collar():
    """A thick grey pelt round the shoulders and the back of the neck, open
    at the front where the beard lies: a soft lumpy roll with a scalloped
    edge of tufts hanging over the tunic."""
    n = 10
    angs = [lerp(-150, 150, k / 20) for k in range(21)]

    def centre(ad):
        a = math.radians(180 + ad)          # 0 at the back
        side = abs(math.sin(a))
        front = max(0.0, math.cos(a))        # 1 toward the front ends
        c = V(0.158 * math.sin(a), 0.128 * math.cos(a),
              1.0 + 0.022 * side - 0.012 * front)
        r = 0.06 * (1 - 0.45 * smooth(115, 150, abs(ad)))
        return c, V(math.sin(a), math.cos(a), 0), r

    rings = []
    for k, ad in enumerate(angs):
        c, outv, r = centre(ad)
        ring = []
        for i in range(n):
            t = i / n * math.tau
            d = outv * math.cos(t) * 1.2 + V(0, 0, 1) * math.sin(t)
            # Lumps in a checker so the subdivided roll reads as clumps.
            lump = 1 + 0.3 * (1 if (i + k) % 2 else -0.35) * \
                (0.3 if math.sin(t) < -0.5 else 1.0)
            ring.append(c + d * r * lump)
        rings.append(ring)
    pieces = [vk.loft(f"{R}-fur", rings, FUR, start="pole", end="pole",
                      levels=1)]
    # Soft rounded lobes hanging off the lower edge, overlapping.
    for k in range(15):
        ad = lerp(-132, 132, k / 14)
        c, outv, r = centre(ad)
        tt = -0.62
        d = outv * math.cos(tt) * 1.2 + V(0, 0, 1) * math.sin(tt)
        at = c + d * r * 0.78
        side = V(0, 0, 1).cross(outv).normalized()
        lobe = vk.ball(f"{R}-lobe{k}", 1.0, V(0, 0, 0), FUR,
                       scale=(r * 0.5, r * 0.26, r * (0.62 + 0.18 * (k % 2))),
                       seg=7, rings=4)
        m = vk.basis(side, outv, V(0, 0, 1), at) @ \
            Matrix.Rotation(-0.35, 4, "X")
        vk.transform([lobe], m)
        pieces.append(lobe)
    return pieces


def skirt(sx):
    """One half of the tunic's skirt: from under the belt to the hem, split
    at the front and the back, flaring over the thigh, with a trim hem."""
    zs = [0.586, 0.565, 0.54, 0.51, 0.48, 0.456, 0.442, 0.43]
    a0, a1 = (4.0, 176.0)
    us = [i / 12 for i in range(13)]
    top = zs[0]

    def fn(u, v):
        z = zs[int(round(v))]
        a = math.radians(lerp(a0, a1, u)) * sx
        t = (top - z) / (top - zs[-1])
        z -= 0.012 * max(0.0, -math.cos(a)) * t
        p = ring_point([(0.58, 0.15, 0.124, 0.114)] * 2, BODY_P, a, 0.58,
                       0.006 + 0.004 * sx)
        k = V(p.x * (1 + 0.5 * t ** 0.9), p.y * (1 + 0.38 * t ** 0.9), 0)
        fold = 0.007 * t * math.sin(9 * a + 1.3)
        k += V(math.sin(a), math.cos(a), 0) * fold
        return V(k.x, k.y, z)

    last = len(zs) - 2

    def mat(i, j):
        return TRIM if j >= last - 1 else TEAM

    return [vk.sheet(f"{R}-skirt{sx}", fn, us, list(range(len(zs))), mat,
                     rim=0.006, back=True, rim_mat=TEAM,
                     inside=V(sx * 0.05, 0, 0.5))]


# ------------------------------------------------------------- head

FACE_W = [(1.0, 0.03), (1.025, 0.043), (1.045, 0.054), (1.062, 0.061),
          (1.076, 0.065), (1.095, 0.067), (1.12, 0.069), (1.145, 0.072),
          (1.17, 0.074), (1.2, 0.075), (1.225, 0.072), (1.245, 0.064),
          (1.26, 0.047), (1.268, 0.02)]
FACE_D = [(1.0, 0.03), (1.025, 0.042), (1.045, 0.057), (1.062, 0.068),
          (1.074, 0.073), (1.09, 0.075), (1.12, 0.077), (1.15, 0.074),
          (1.172, 0.081), (1.2, 0.082), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
NOSE_H = [(1.098, 0.0), (1.105, 0.01), (1.113, 0.024), (1.121, 0.03),
          (1.131, 0.027), (1.146, 0.019), (1.16, 0.011), (1.172, 0.005),
          (1.186, 0.0)]
NOSE_S = [(1.11, 13.0), (1.13, 9.5), (1.17, 6.5)]


def face_disp(ad, z):
    """A big bulbous nose, a heavy brow and broad cheeks."""
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.008 * gauss(a, 13.5, 5.5) * gauss(z, 1.113, 0.007)     # nostrils
    d -= 0.011 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)       # sockets
    bz = 1.174 - 0.004 * gauss(a, 9, 8)
    d += 0.011 * gauss(z, bz, 0.007) * smooth(54, 30, a)          # brow
    d -= 0.003 * gauss(ad, 0, 4) * gauss(z, 1.17, 0.006)          # frown
    d += 0.005 * gauss(a, 45, 13) * gauss(z, 1.136, 0.013)        # cheeks
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.003 * gauss(z, 1.086, 0.004) * gauss(ad, 0, 12)        # lip
    d += 0.009 * gauss(z, 1.066, 0.011) * gauss(ad, 0, 20)        # chin
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)        # temples
    return d


HEAD = vk.Head(R, FACE_W, FACE_D, BACK_D, face_disp, hc=tuple(HC))


def hairline(a):
    if abs(a) < 64:
        return 9.0
    return table([(62, 1.15), (70, 1.118), (84, 1.16), (100, 1.17),
                  (120, 1.12), (150, 1.075), (180, 1.064)], abs(a))


# Where the beard's cheeks stop (angle from the front -> z): below the
# mouth at the front, round its corners, up the jaw into the sideburns.
BEARD_TOP = [(0, 1.079), (12, 1.08), (21, 1.086), (29, 1.1), (36, 1.116),
             (46, 1.128), (58, 1.136), (70, 1.148), (82, 1.16)]


def beard():
    pieces = []
    cols = [a for a in sorted(set([-a for a in vk.FACE_A] + vk.FACE_A))
            if abs(a) <= 82]

    def grow(a, z):
        # Thicker toward the jaw and the chin, strands in grooves.
        return 0.007 + 0.009 * smooth(1.12, 1.03, z) + \
            0.0025 * math.sin(math.radians(a) * 14 + z * 90)

    pieces.append(HEAD.shell(f"{R}-cheeks", GINGER,
                             lambda a: table(BEARD_TOP, abs(a)),
                             lambda a: 1.02, 0.008, cols=cols, rows=9,
                             grow=grow))
    # The great mass under the chin, jutting forward over the chest.
    prof = [(1.078, 0.032, 0.066, 0.056, 0.032),
            (1.05, 0.055, 0.08, 0.068, 0.04),
            (1.012, 0.085, 0.088, 0.074, 0.045),
            (0.972, 0.112, 0.085, 0.07, 0.046),
            (0.935, 0.132, 0.072, 0.058, 0.042),
            (0.905, 0.143, 0.052, 0.044, 0.032),
            (0.884, 0.147, 0.026, 0.024, 0.018)]
    n = 18
    rings = []
    for k, (z, cy, rx_, ryf, ryb) in enumerate(prof):
        ring = []
        for i in range(n):
            a = i / n * math.tau
            s, c = math.sin(a), math.cos(a)
            strand = 1 + (0.06 * math.sin(10 * a + 1.1 * k) +
                          0.03 * math.sin(23 * a)) * min(1, k / 2)
            # A shallow cleft down the middle of the front.
            cleft = 1 - 0.07 * gauss(math.degrees(math.atan2(s, c)), 0, 9) \
                * min(1, k / 2)
            ring.append(V(rx_ * s * strand,
                          cy + (ryf if c > 0 else ryb) * c * strand * cleft,
                          z + 0.01 * c * min(1, k / 3)))
        rings.append(ring)
    pieces.append(vk.loft(f"{R}-beard", rings, GINGER, start="pole",
                          end="pole", levels=1))
    # Two braids from the bottom corners, each with a bronze bead.
    for sx in (-1, 1):
        p0 = V(sx * 0.035, 0.158, 0.91)
        path = [p0 + V(sx * 0.006 * k * 0.2, 0.016 * min(k, 2) / 2,
                       -0.03 * k) for k in range(6)]
        for k in range(5):
            a, b = path[k], path[k + 1]
            m = lerp(a, b, 0.5)
            wob = V(sx * 0.008 * (1 if k % 2 else -1), 0, 0)
            pieces.append(vk.ball(f"{R}-braid{sx}{k}", 1.0, V(0, 0, 0),
                                  GINGER, scale=(0.02 - 0.0015 * k,
                                                 0.018 - 0.0012 * k, 0.022),
                                  seg=6, rings=4))
            mm = Matrix.Translation(m + wob) @ \
                Matrix.Rotation(math.radians(24 if k % 2 else -24), 4, "Y")
            vk.transform([pieces[-1]], mm)
        bead = path[-1] + V(0, 0.002, 0.004)
        pieces.append(vk.tube(f"{R}-bead{sx}", [bead + V(0, 0, 0.012),
                                               bead - V(0, 0, 0.012)],
                              [0.016, 0.016], BRONZE, n=10,
                              caps=("flat", "flat")))
        tip = [bead - V(0, 0, 0.01), bead - V(0, -0.002, 0.03),
               bead - V(0, -0.004, 0.046)]
        pieces.append(vk.tube(f"{R}-tip{sx}", tip, [0.014, 0.012, 0.004],
                              GINGER, n=8, caps=(None, "dome")))
    # The moustache: two thick rolls from under the nose drooping into the
    # beard past the mouth's corners.
    for sx in (-1, 1):
        pts = []
        for ad, z, off in ((2, 1.103, 0.006), (10, 1.1, 0.009),
                           (19, 1.093, 0.011), (27, 1.08, 0.011),
                           (33, 1.064, 0.012)):
            pts.append(HEAD.point(sx * ad, z) + HEAD.normal(sx * ad, z) *
                       off)
        pieces.append(vk.tube(f"{R}-stache{sx}", pts,
                              [0.009, 0.0115, 0.0115, 0.0095, 0.007],
                              GINGER, n=8, caps=("dome", "dome")))
    return pieces


def brows():
    """Bushy ginger brows drawn down to the nose: a scowl."""
    out = []
    for sx in (-1, 1):
        pts = []
        for ad, z in ((10, 1.174), (20, 1.18), (31, 1.188), (42, 1.193)):
            pts.append(HEAD.point(sx * ad, z) + HEAD.normal(sx * ad, z) *
                       0.005)
        out.append(vk.tube(f"{R}-brow{sx}", pts,
                           [(0.005, 0.0062), (0.0062, 0.0072),
                            (0.0055, 0.0065), (0.0035, 0.004)], GINGER, n=8,
                           up=(0, 1, 0), caps=("dome", "dome")))
    return out


def face():
    eyes = face_paint.eyes(vk, R, HEAD.point, HC, z=1.1565,
                           expression="focused")
    keep = []
    for o in eyes:
        if "brow" in o.name:
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            keep.append(o)
    return keep + face_paint.mouth(vk, R, HEAD.point, HC, z=1.093,
                                   expression="focused")


def nape():
    out = []
    for k, ad in enumerate((128, 146, 163, 180, 197, 214, 232)):
        z0 = 1.15
        p0 = HEAD.point(ad, z0) + HEAD.normal(ad, z0) * 0.004
        p1 = HEAD.point(ad, 1.05) + HEAD.normal(ad, 1.05) * 0.016 + \
            V(0, 0, -0.012 * (k % 2))
        mid = lerp(p0, p1, 0.55) + HEAD.normal(ad, 1.1) * 0.01
        out.append(vk.tube(f"{R}-lock{k}", [p0, mid, p1],
                           [(0.008, 0.016), (0.009, 0.017), (0.004, 0.008)],
                           GINGER, n=6, up=V(0, 0, 1).cross(p0 - HC),
                           caps=(None, "dome")))
    return out


def neck():
    return vk.tube(f"{R}-neck", [V(0, 0.0, 0.97), V(0, 0.004, 1.03),
                                 V(0, 0.01, 1.075)],
                   [0.056, 0.054, 0.05], SKIN, n=12, caps=(None, None))


def rim_z(ad):
    return table([(0, 1.207), (30, 1.203), (60, 1.19), (90, 1.176),
                  (125, 1.152), (180, 1.14)], abs(ad))


HELM = (0.09, 0.1, 0.113)          # half width, front and back at the rim
HELM_TOP = 1.345


def helm_point(ad, z, off=0.0):
    """The helmet's surface: straight walls down to the rim, a dome above."""
    a = math.radians(ad)
    k = 1.0
    if z > 1.214:
        q = (z - 1.214) / (HELM_TOP - 1.214)
        k = math.sqrt(max(0.0, 1 - q * q))
    rx_, ryf, ryb = HELM
    e = 2.0 / 2.2
    s, c = math.sin(a), math.cos(a)
    return V((rx_ + off) * k * spow(s, e),
             0.008 + ((ryf if c >= 0 else ryb) + off) * k * spow(c, e), z)


def helmet():
    pieces = []
    n = 96
    angs = [i / n * 360 - 180 for i in range(n)]
    zs = [None, None] + [lerp(1.224, 1.342, j / 22) for j in range(23)]
    rings = []
    for j, z in enumerate(zs):
        ring = []
        for ad in angs:
            zz = rim_z(ad) if j == 0 else (max(rim_z(ad), 1.21) + 0.004
                                           if j == 1 else z)
            ring.append(helm_point(ad, zz))
        rings.append(ring)
    # The underside of the rim, reaching in to the skull.
    under = [helm_point(ad, rim_z(ad), -0.02) for ad in angs]
    pieces.append(vk.loft(f"{R}-helm", [under] + rings, IRON,
                          end=V(0, 0.008, HELM_TOP)))
    # A brow band round the rim, a little proud.
    band = []
    for dz, off in ((-0.002, 0.0), (0.0, 0.006), (0.026, 0.006),
                    (0.029, 0.0)):
        band.append([helm_point(ad, rim_z(ad) + dz, off) for ad in angs])
    pieces.append(vk.loft(f"{R}-browband", band, IRON))
    # Four bronze bands over the dome, riveted to the brow band.
    for k, ad in enumerate((0, 90, 180, -90)):
        pts, zs2 = [], [rim_z(ad) + 0.02] + [lerp(1.225, 1.347, j / 18)
                                           for j in range(19)]
        for z in zs2:
            pts.append(helm_point(ad, min(z, HELM_TOP - 0.003), 0.004))
        up = V(math.sin(math.radians(ad)), math.cos(math.radians(ad)), 0)
        pieces.append(vk.tube(f"{R}-spangen{k}", pts,
                              [(0.004, 0.013)] * len(pts), BRONZE, n=12,
                              up=up, caps=("flat", None)))
        for dz in (0.008, 0.019):
            p = helm_point(ad, rim_z(ad) + dz, 0.0085)
            pieces.append(vk.ball(f"{R}-rivet{k}{dz}", 0.0048, p, BRONZE,
                                  seg=20, rings=10))
    pieces.append(vk.ball(f"{R}-boss", 0.02, V(0, 0.008, HELM_TOP), BRONZE,
                          scale=(1, 1, 0.6), seg=32, rings=16))
    # The nasal, following the nose.
    pts = []
    for z, off in ((1.216, 0.02), (1.19, 0.011), (1.17, 0.008),
                   (1.152, 0.007)):
        pts.append(HEAD.point(0, z) + HEAD.normal(0, z) * off)
    pts[0] = helm_point(0, 1.214, 0.007)
    pieces.append(vk.tube(f"{R}-nasal", pts,
                          [(0.006, 0.011), (0.0045, 0.009), (0.004, 0.0085),
                           (0.004, 0.008)], IRON, n=8,
                          up=(0, 1, 0), caps=("flat", "dome")))
    return pieces


def head():
    skull = HEAD.skull(SKIN, GINGER, hairline=hairline)
    whiskers = sculpt.beard()
    # The cheek hair and moustache stay on the face. Only the hanging mass
    # and its beaded ends swing, so the mouth never separates from its skin.
    soft = [o for o in whiskers if not any(x in o.name for x in
                                          ("-beard-cheek", "-stache"))]
    pieces = [skull, neck()] + face() + brows() + \
        [o for o in whiskers if o not in soft] + \
        HEAD.ears(SKIN) + sculpt.nape() + helmet()
    vk.transform(pieces + soft, Matrix.Translation(V(0, 0, HEAD_DZ)))
    return pieces, soft


# ------------------------------------------------------------- arms


def arm_pose(s, c, pole):
    e0 = vk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    xax = (c - e0) - D * (c - e0).dot(D)
    xax.normalize()
    w = c - xax * WRIST_FIST
    e = vk.ik(s, w, UPPER, FORE, pole)
    return e, w, xax


def sleeve(side, s, e, w, sx):
    """The tunic sleeve past the elbow with a trim cuff, a bare forearm
    and a leather bracer over the wrist."""
    pieces = []
    up = (e - s).normalized()
    fo = (w - e).normalized()
    cuff_at = lerp(e, w, 0.26)
    path = [s + up * 0.004, lerp(s, e, 0.35), lerp(s, e, 0.7), e,
            cuff_at]
    tube = vk.tube(f"{R}-sleeve{side}", path,
                   [0.066, 0.068, 0.064, 0.058, 0.057], TEAM, n=12,
                   caps=(None, None))
    bend = (up - fo)
    for v in tube.data.vertices:
        p = v.co
        d = min((p - e).length, 0.09)
        k = (1 - d / 0.09) ** 2
        out = (p - e)
        out = out - fo * out.dot(fo)
        if out.length > 1e-6 and bend.length > 1e-6:
            out.normalize()
            ang = math.atan2(out.dot(bend.cross(fo).normalized()),
                             out.dot(bend.normalized()))
            v.co = p + out * 0.007 * k * math.sin(3 * ang + 1.0)
    pieces.append(tube)
    pieces.append(vk.ball(f"{R}-shoulder{side}", 1.0,
                          s + V(sx * 0.004, 0, -0.018), TEAM,
                          scale=(0.066, 0.068, 0.054), seg=12, rings=6))
    pieces.append(vk.tube(f"{R}-scuff{side}", [cuff_at - fo * 0.026,
                                              cuff_at + fo * 0.006],
                          [0.062, 0.064], TRIM, n=12, caps=(None, None)))
    pieces.append(vk.tube(f"{R}-fore{side}", [cuff_at - fo * 0.01,
                                             lerp(cuff_at, w, 0.5), w],
                          [0.052, 0.049, 0.043], SKIN, n=10,
                          caps=(None, None)))
    b0 = lerp(cuff_at, w, 0.38)
    pieces.append(vk.tube(f"{R}-bracer{side}", [b0, lerp(b0, w, 0.5),
                                               w + fo * 0.006],
                          [0.054, 0.052, 0.048], LEATHER, n=10,
                          caps=("flat", "flat")))
    for t in (0.2, 0.75):
        c = lerp(b0, w, t)
        pieces.append(vk.tube(f"{R}-lace{side}{t}", [c - fo * 0.004,
                                                     c + fo * 0.004],
                              [0.057, 0.057], DARK, n=10,
                              caps=(None, None)))
    return pieces


def build_arm(side):
    if side == "R":
        s, sx = S_R, 1
        c = GRIP_R
        pole = S_R + V(0.7, -0.45, -0.25)
        chir = -1
    else:
        s, sx = S_L, -1
        c = GRIP_L
        pole = S_L + V(-0.55, -0.3, -0.35)
        chir = 1
    e, w, xax = arm_pose(s, c, pole)
    kax = D.cross(xax) if chir > 0 else xax.cross(D)
    pieces = sleeve(side, s, e, w, sx)
    hand = vk.fist(f"{R}-hand{side}", c, xax, kax, chir, SKIN)
    vk.scale_about(hand, c, FIST_SCALE)
    return pieces + hand, s


def articulated_arm(side, torso):
    """Anatomical shoulder, elbow and wrist pivots with a shaft-sized grip.

    Both shoulders share their x axis and both carry the same pitch.  The
    bent elbows and wrists therefore stay in the authored two-hand hold,
    including a complete circular attack, without drifting on separate
    springs.  The source retains separate forearm/hand editability.
    """
    if side == "R":
        s, sx, c, chir = S_R, 1, GRIP_R, -1
        pole = S_R + V(0.7, -0.45, -0.25)
    else:
        s, sx, c, chir = S_L, -1, GRIP_L, 1
        pole = S_L + V(-0.55, -0.3, -0.35)
    e, w, xax = arm_pose(s, c, pole)
    kax = D.cross(xax) if chir > 0 else xax.cross(D)
    upper, lower = sculpt.sleeve(side, s, e, w, sx)
    arm = part(f"arm{side}", upper, s, torso)
    fore = part(f"fore{side}", lower, e, arm)
    grip = sculpt.gripping_hand(side, c, xax, kax, chir)
    hand = part(f"hand{side}", grip, w, fore, angle=65)
    hand["gripCentre"] = list(c - w)
    hand["shaftRadius"] = .0205
    return arm, fore, hand


# ------------------------------------------------------------- the axe


def axe():
    """The long bearded axe in its own frame: y along the haft toward the
    head, x the blade's reach, z the flat's normal; the right fist at the
    origin."""
    P = []
    butt, end = -0.085, HEAD_AT + 0.05
    P.append(vk.tube(f"{R}-haft", [V(0, butt, 0), V(0, 0.4, 0),
                                  V(0, end, 0)],
                     [0.0195, 0.0205, 0.0185], WOOD, n=10,
                     caps=("flat", "flat")))
    # A bronze butt cap and rings; a leather wrap between the fists.
    P.append(vk.tube(f"{R}-cap", [V(0, butt - 0.012, 0), V(0, butt + 0.02, 0)],
                     [0.0235, 0.024], BRONZE, n=10, caps=("dome", "flat")))
    for y in (HEAD_AT - 0.1, HEAD_AT - 0.075):
        P.append(vk.tube(f"{R}-ring{y}", [V(0, y - 0.006, 0),
                                         V(0, y + 0.006, 0)],
                         [0.0235, 0.0235], BRONZE, n=10,
                         caps=("flat", "flat")))
    P.append(vk.tube(f"{R}-grip", [V(0, 0.05, 0), V(0, 0.2, 0)],
                     [0.0225, 0.0225], LEATHER, n=10, caps=("flat", "flat")))
    for k in range(6):
        y = 0.06 + k * 0.026
        P.append(vk.tube(f"{R}-wind{k}", [V(0, y - 0.004, 0),
                                         V(0, y + 0.004, 0)],
                         [0.0245, 0.0245], DARK, n=8, caps=("flat", "flat")))
    # The socket round the haft's end, swelling into a short poll behind.
    h = HEAD_AT
    rings = []
    for dy, k, poll in ((-0.056, 0.78, 0.0), (-0.046, 1.0, 0.0),
                        (-0.02, 1.0, 1.0), (0.02, 1.0, 1.0),
                        (0.046, 1.0, 0.0), (0.056, 0.78, 0.0)):
        ring = []
        for x, z, ang in vk.sup(12, 0.029, 0.024, 2.6):
            if x < 0:
                x -= 0.016 * poll * (abs(math.cos(ang)) ** 2)
            ring.append(V(0.006 + x * k, h + dy, z * k))
        rings.append(ring)
    P.append(vk.loft(f"{R}-socket", rings, IRON, start="pole", end="pole"))

    # The blade in rows along the haft (w), each a lens from its back
    # (u0) to the edge (u1): a narrow neck at the socket, a top edge
    # flaring up, a broad curved edge and a long beard hooking back down
    # along the haft toward the hands.
    def u_back(w):
        if w > 0.03:
            return 0.03 + ((w - 0.03) / 0.05) ** 0.45 * 0.18
        if w < -0.03:
            return 0.03 + 0.095 * ((-0.03 - w) / 0.175) ** 2
        return 0.03

    def u_edge(w):
        s = (0.08 - w) / 0.285
        return 0.235 + 0.02 * math.sin(math.pi * s * 0.8) - \
            0.12 * smooth(0.45, 1.0, s) ** 1.3

    ws = [0.08, 0.076, 0.068, 0.056, 0.044, 0.034, 0.02, -0.005, -0.035,
          -0.065, -0.095, -0.125, -0.155, -0.18, -0.205]
    rings = []
    for w in ws:
        u0, u1 = u_back(w), u_edge(w)
        if u1 - u0 < 0.012:
            u1 = u0 + 0.012
        t0 = 0.013 if -0.03 <= w <= 0.03 else 0.01
        ub = max(lerp(u0, u1, 0.62), u1 - 0.024)
        pts = [(u0, t0), (lerp(u0, u1, 0.35), 0.0085), (ub, 0.0055),
               (u1, 0.0), (ub, -0.0055), (lerp(u0, u1, 0.35), -0.0085),
               (u0, -t0), (u0 - 0.005, 0.0)]
        rings.append([V(u, h + w, t) for u, t in pts])
    # Bright steel on the two bands either side of the edge.
    P.append(vk.loft(f"{R}-blade", rings, IRON,
                     bands=lambda i, j: EDGE if i in (2, 3) else None,
                     start="pole", end="pole"))
    # Two bronze rivets through the socket.
    for dy in (-0.028, 0.028):
        P.append(vk.ball(f"{R}-arivet{dy}", 0.006, V(0.006, h + dy, 0.024),
                         BRONZE, scale=(1, 1, 0.6), seg=6, rings=3))
    return P


def axe_frame():
    """The axe's frame at rest: x along the blade, y along the haft
    (toward the head), z the flat's normal; origin in the right fist."""
    return vk.basis(B_REST, D, B_REST.cross(D), GRIP_R)


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("VIKING_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + vk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return vk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="viking"):
    global HEAD
    assert root_name == R
    sculpt.configure(globals())
    HEAD = sculpt.SculptedHead(R, FACE_W, FACE_D, BACK_D, face_disp,
                              hc=tuple(HC))
    sculpt.configure(globals())
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        thigh, shin, boot, hip, knee, ankle = sculpt.legs(sx)
        thigh_obj = part(f"leg{side}", thigh, hip, root)
        shin_obj = part(f"knee{side}", shin, knee, thigh_obj)
        part(f"foot{side}", boot, ankle, shin_obj)

    torso = sculpt.tunic() + belt() + sculpt.fur()
    torso_obj = part("torso", torso, WAIST, root)
    for side, sx in (("L", -1), ("R", 1)):
        part(f"skirt{side}", sculpt.skirt(sx), V(sx * HIP_X, 0, HIP_Z), torso_obj)
    face, whiskers = head()
    head_obj = face_rig.head(vk.part, R, face, NECK, torso_obj, angle=62)
    part("beard", whiskers, V(0, 0.032, 1.078 + HEAD_DZ), head_obj, angle=62)

    _, _, hand_r = articulated_arm("R", torso_obj)
    blade = sculpt.axe()
    vk.transform(blade, axe_frame())
    part("weapon", blade, GRIP_R, hand_r, angle=40)
    articulated_arm("L", torso_obj)
    sculpt.prepare_materials()

    root["sourceVersion"] = "2026-10-04-viking-authored-v1"
    root["twoHandGrip"] = "equal shoulder x; locked forearm, wrist and haft"
    root["scaleIdentity"] = "original 1.36m miniature, unchanged gameplay size"

    report(root)
    pose = os.environ.get("VIKING_POSE")
    if pose:
        vk.pose(root, R, POSES, pose)
    return root


def build_master(root_name="viking"):
    """Reconstruct the detailed editable source, independent of runtime."""
    return build(root_name)


def build_runtime(root_name="viking"):
    """Reconstruct the exact reviewed runtime topology, rest and baked AO."""
    import figure_viking_runtime_cache
    return figure_viking_runtime_cache.restore(root_name)


def build_runtime_recipe(root_name="viking"):
    """Author a new separate reduction; review it before replacing the cache."""
    import figure_viking_runtime as runtime
    previous = vk.RUNTIME_REDUCER
    runtime.begin()
    vk.RUNTIME_REDUCER = runtime
    try:
        root = build(root_name)
        runtime.finish(root)
        # Match the retained v4 review copy's rest and genuine AO. A full
        # figures build may already contain other characters; their meshes
        # must not cast occlusion into this independently reviewed sculpt.
        head = next(o for o in kit.descendants(root)
                    if o.name == f"{root_name}.head")
        head.rotation_euler.x += math.radians(5)
        kit.refresh()
        meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
        own = set(meshes)
        foreign = [(o, o.hide_render) for o in bpy.data.objects
                   if o.type == "MESH" and o not in own]
        try:
            for obj, _ in foreign:
                obj.hide_render = True
            kit.bake_ao(meshes, samples=64, distance=.17)
        finally:
            for obj, hidden in foreign:
                obj.hide_render = hidden
        root["arenaReviewedRestPose"] = 1
        root["arenaReviewedAO"] = 1
        root["arenaAOSamples"] = 64
        root["arenaAODistance"] = .17
        return root
    finally:
        vk.RUNTIME_REDUCER = previous


# Preview poses in three.js Euler terms, as moves/viking.ts sets them.
_S = SPIN
POSES = {
    "walk": {"legL": (0.62, 0, 0), "kneeL": (-0.25, 0, 0),
             "footL": (-0.37, 0, 0), "legR": (-0.45, 0, 0),
             "kneeR": (-0.05, 0, 0), "footR": (0.5, 0, 0),
             "skirtL": (0.34, 0, 0), "skirtR": (-0.25, 0, 0),
             "armL": (0.1, 0, 0), "armR": (0.1, 0, 0),
             "torso": (-0.04, 0.05, 0)},
    "walk2": {"legR": (0.9, 0, 0), "kneeR": (-0.95, 0, 0),
              "footR": (0.05, 0, 0), "legL": (-0.3, 0, 0),
              "skirtR": (0.5, 0, 0), "skirtL": (-0.17, 0, 0),
              "armL": (-0.1, 0, 0), "armR": (-0.1, 0, 0)},
    "wind": {"armL": (_S, 0, 0), "armR": (_S, 0, 0),
             "torso": (0.08, -0.3, 0), "head": (0.0, 0.25, 0),
             "legL": (0.25, 0, 0), "legR": (-0.2, 0, 0)},
    "spin": {"armL": (_S, 0, 0), "armR": (_S, 0, 0),
             "torso": (0.04, 0.2, 0), "head": (-0.05, -0.1, 0)},
    "rage": {"armL": (0.45, 0, 0), "armR": (0.45, 0, 0),
             "torso": (-0.3, 0, 0), "head": (0.28, 0, 0),
             "skirtL": (0.24, 0, 0), "skirtR": (0.24, 0, 0),
             "legL": (0.2, 0, 0), "kneeL": (-0.3, 0, 0),
             "legR": (-0.1, 0, 0), "kneeR": (-0.25, 0, 0)},
}


def report(root):
    print("VIKING joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {vk.tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("VIKING materials", len(mats), mats)
