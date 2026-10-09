"""The Inventor (figure id `inventor`) as a collector's miniature: a young
Black woman inventor of the 1950s, retro-futurist, in hand-painted resin.

Her hair pulled up into two round puffs tied with team-colour bands, big
brass goggles pushed up on her forehead; a crisp white lab coat to mid
thigh, buttoned, with notched lapels over a team-colour blouse, a breast
pocket of pens and two hip pockets; team-colour gauntlet gloves; slim dark
team trousers and two-tone saddle shoes. On her back a Tesla coil pack: a
riveted case with a pressure gauge, a copper-wound coil standing up behind
her head, a brass ring and a glowing ball on top. In her right fist a
copper zapper wand with a pistol grip, coils along the rod and a glowing
tip.

Parts (figures.py has the contract), none with a rest rotation:

  inventor        root at the feet, facing +y
    legL, legR    pivots on the hips; knees and ankles split in build()
    torso         pivot at the waist: coat, blouse, pack and coil; the coat
                  goes on, inset, under the tails
      skirtL/R    the coat's tails, hung from the waist seam so they trail
                  the thighs
      extra       the coil's glowing ball, pivot at the top of the coil, so
                  it can bob and throb as she charges
      head        pivot at the neck, the goggles and puffs on it
      armL        pivot on the left shoulder, the whole arm
      armR        pivot on the right shoulder, the upper arm
        foreR     pivot at the elbow, forearm and gloved fist
          weapon  the wand, pivot in the right fist

INVENTOR_POSE=<name> turns the parts as the game would (three.js Euler
terms, see figure_inventor_kit.runtime_quat) before the previews: `charge`
is the crackling wind-up (wand drawn back and up), `zap` the thrust at the
hit, `walkA`/`walkB` two moments of the stride with knees, ankles and coat
tails as troops.ts and moves/inventor.ts set them.
"""

import math
import os

import articulation
import face_paint
import face_rig
import kit
import figure_inventor_kit as rk
from figure_inventor_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

R = "inventor"
T = kit.tint

# ------------------------------------------------------------- paints

SKIN = "resin:" + T("inventor-skin", "#7b4a2d")
HAIR = "resin:" + T("inventor-hair", "#1d1512")
COAT = "weave:" + T("inventor-coat", "#eeebe3")    # coat, shoe uppers
TEAM = "weave:team"                                # gloves, blouse, ties
TEAM2 = "weave:team2"                              # trousers
BRASS = "gilt:" + T("inventor-brass", "#caa150")
COPPER = "gilt:" + T("inventor-copper", "#c8703f")
GLOW = "glow:" + T("inventor-spark", "#8eeeff")
DARK = "resin:" + T("inventor-dark", "#2c2f38")    # case, lenses, soles
LEATHER = "hide:" + T("inventor-leather", "#6a4128")
LIP = "resin:" + T("inventor-lip", "#8f4b47")

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.08, 0.61
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.156, 0.952
S_L = V(-SH_X, 0.0, SH_Z)
S_R = V(SH_X, 0.0, SH_Z)
NECK = V(0, 0.0, 1.018)
UPPER, FORE = 0.235, 0.21
WRIST_FIST = 0.042
SKIRT_PIVOT_Z = 0.645

HEAD_DZ = -0.004
HC = V(0, 0.012, 1.162)
CY = 0.012

# The right arm: upper arm hanging a little forward, forearm reaching
# forward and down, the wand's rod along it and its grip across the fist.
E_R = S_R + V(0.03, 0.05, -0.23).normalized() * UPPER
F_R = V(-0.06, 0.86, -0.5).normalized()
C_R = E_R + F_R * (FORE + WRIST_FIST)
E_L = S_L + V(-0.046, -0.012, -0.23).normalized() * UPPER
C_L = E_L + V(-0.07, 0.3, -0.95).normalized() * (FORE + WRIST_FIST)

# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the coat over the chest.
BODY = [(0.49, 0.126, 0.098, 0.1), (0.56, 0.13, 0.1, 0.102),
        (0.62, 0.126, 0.096, 0.096), (0.68, 0.124, 0.093, 0.09),
        (0.73, 0.13, 0.098, 0.09), (0.79, 0.141, 0.109, 0.094),
        (0.845, 0.15, 0.112, 0.098), (0.89, 0.155, 0.104, 0.1),
        (0.925, 0.153, 0.095, 0.098), (0.952, 0.136, 0.082, 0.085),
        (0.978, 0.096, 0.066, 0.066), (1.004, 0.054, 0.048, 0.048)]
BODY_P = 2.3


def section(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def ring_point(rows, power, a, z, extra=0.0):
    """A point on a superellipse section at angle a (0 = front, +90 degrees
    toward +x, her right) and height z."""
    rx_, ryf, ryb = section(rows, z)
    e = 2.0 / power
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


def body_point(a, z, extra=0.0):
    p = ring_point(BODY, BODY_P, a, z, extra)
    ad = math.degrees(a)
    ad = ad - 360 if ad > 180 else ad
    p.y += 0.015 * gauss(z, 0.83, 0.04) * (gauss(ad, 24, 17) +
                                           gauss(ad, -24, 17))
    return p


# The coat below the waist seam: straight, flaring a little to the hem.
TAILS = [(0.43, 0.178, 0.136, 0.142), (0.5, 0.17, 0.13, 0.136),
         (0.56, 0.162, 0.123, 0.128), (0.62, 0.153, 0.115, 0.118),
         (0.665, 0.14, 0.106, 0.104), (0.7, 0.134, 0.1, 0.096)]
TAILS_P = 2.3
HEM = 0.43
SEAM = 0.664


def tail_point(a, z, extra=0.0):
    fold = 0.004 * smooth(0.62, HEM, z) * math.sin(6 * a + 1.1) * \
        (0.4 + 0.6 * max(0.0, -math.cos(a)))
    return ring_point(TAILS, TAILS_P, a, z, extra + fold)


def coat_point(a, z, extra=0.0):
    """The coat's surface: the chest above the seam, the tails' shape below
    it, blended across the waist."""
    if z >= SEAM + 0.03:
        return body_point(a, z, extra + 0.004)
    if z <= SEAM:
        return tail_point(a, z, extra - 0.009)
    t = (z - SEAM) / 0.03
    return lerp(tail_point(a, z, extra - 0.009), body_point(a, z,
                                                            extra + 0.004), t)


def cross_outline(size, bar):
    s, b = size, bar / 2
    return [(b, -s), (b, -b), (s, -b), (s, b), (b, b), (b, s), (-b, s),
            (-b, b), (-s, b), (-s, -b), (-b, -b), (-b, -s)]


# ------------------------------------------------------------- legs


def shoe(sx, ankle, toe_out):
    """A two-tone saddle shoe: white toe and heel, a dark saddle over the
    instep, a dark sole with a low heel and laces."""
    pieces = []
    foot = [(-0.06, 0.026, 0.0, 0.058), (-0.05, 0.036, 0.0, 0.074),
            (-0.026, 0.041, 0.0, 0.078), (0.012, 0.042, 0.0, 0.07),
            (0.05, 0.041, 0.0, 0.058), (0.088, 0.037, 0.0, 0.048),
            (0.116, 0.029, 0.0, 0.042), (0.134, 0.017, 0.004, 0.036)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in rk.sup(10, rx_, (zt - zb) / 2, 2.4, math.pi / 10):
            ring.append(V(x, y, (zb + zt) / 2 + z))
        rings.append(ring)

    def bands(i, j):
        if i in (6, 7):
            return DARK
        if isinstance(j, int) and 2 <= j <= 4:
            return DARK
        return None

    pieces.append(rk.loft(f"{R}-shoe{sx}", rings, COAT, bands=bands,
                          start=V(0, -0.066, 0.03), end=V(0, 0.14, 0.022)))
    welt = [V(x, y, 0.012) for x, y, _ in rk.sup(16, 0.046, 0.1, 2.6)]
    welt = [V(p.x * (0.92 if p.y < 0 else 1.0), p.y + 0.036, p.z)
            for p in welt]
    pieces.append(rk.tube(f"{R}-welt{sx}", welt + [welt[0]], [0.0075] * 17,
                          DARK, n=4, caps=(None, None)))
    heel = []
    for z, s in ((-0.002, 0.84), (0.012, 0.94), (0.02, 1.0)):
        heel.append([V(x * s, -0.043 + y * s, z) for x, y, _ in
                     rk.sup(8, 0.03, 0.025, 2.6)])
    pieces.append(rk.loft(f"{R}-heel{sx}", heel, DARK, start="flat",
                          end="flat"))
    for k, y in enumerate((0.012, 0.03)):
        pieces.append(rk.tube(f"{R}-lace{sx}{k}", [V(-0.018, y, 0.074 -
                                                    y * 0.3),
                                                  V(0.018, y + 0.004,
                                                    0.074 - y * 0.3)],
                              [0.0028] * 2, COAT, n=4, caps=("dome", "dome")))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    rk.transform(pieces, place)
    return pieces


def trouser_leg(sx, hip, knee, ankle):
    """Slim dark trousers from the hip ball to a cuff over the shoe."""
    path = [hip + V(0, 0, 0.04), lerp(hip, knee, 0.33), lerp(hip, knee, 0.7),
            knee, lerp(knee, ankle, 0.5), V(ankle.x, ankle.y, 0.07)]
    radii = [0.062, 0.06, 0.053, 0.048, 0.044, 0.043]
    limb = rk.tube(f"{R}-trouser{sx}", path, radii, TEAM2, n=12,
                   up=(0, 1, 0), caps=(None, None))
    kneecap = rk.ball(f"{R}-knee{sx}", 0.02, knee + V(0, 0.02, 0.004), TEAM2,
                      scale=(1.2, 0.75, 1.3), seg=8, rings=5)
    cuff = rk.tube(f"{R}-cuff{sx}", [V(ankle.x, ankle.y, 0.07),
                                     V(ankle.x, ankle.y + 0.004, 0.092)],
                   [0.046, 0.045], TEAM2, n=12, caps=("flat", None))
    return [limb, kneecap, cuff]


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    pieces = trouser_leg(sx, hip, knee, ankle)
    pieces += shoe(sx, ankle, toe_out)
    return pieces, hip


# ------------------------------------------------------------- coat tails


def tail_half(sx):
    """One of the coat's tails: from the waist seam, lapping just outside
    the coat above, down to the hem; the right tail laps over the left at
    the buttoned front, the two meet at a vent behind. Lined, a hip pocket
    on each, and the lower buttons on the right."""
    a0, a1 = -12.0 if sx > 0 else -26.0, 194.0 if sx > 0 else 188.0
    zs = [SEAM + 0.004, 0.64, 0.6, 0.56, 0.52, 0.48, 0.455, HEM]
    us = [i / 18 for i in range(19)]
    lift = 0.0045 if sx > 0 else 0.0

    def fn(u, v):
        z = zs[int(round(v))]
        a = math.radians(lerp(a0, a1, u)) * sx
        p = tail_point(a, z, lift)
        # The front edge hangs a touch lower, the vent a touch shorter.
        if z <= HEM + 1e-6:
            p.z -= 0.006 * max(0.0, math.cos(a)) - 0.004 * max(0.0,
                                                                -math.cos(a))
        return p

    vs = list(range(len(zs)))
    out = [rk.sheet(f"{R}-tail{sx}", fn, us, vs, COAT, rim=0.005, back=True,
                    inside=V(sx * 0.03, 0, 0.55))]
    # A patch pocket on the hip.
    def pocket(u, v):
        a = math.radians(sx * lerp(38, 78, u))
        z = lerp(0.6, 0.5, v)
        return tail_point(a, z, lift + 0.004 + 0.0015 * math.sin(math.pi *
                                                               v))
    out.append(rk.sheet(f"{R}-pocket{sx}", pocket, [0, 0.25, 0.5, 0.75, 1],
                        [0, 0.5, 1], COAT, rim=0.004, inside=V(0, 0, 0.55),
                        rim_edges=("u0", "u1", "v1")))
    # The pocket's hem, and the stitch line along the tail's front edge.
    top = [tail_point(math.radians(sx * lerp(38, 78, i / 6)), 0.598,
                      lift + 0.0066) for i in range(7)]
    out.append(rk.tube(f"{R}-pockethem{sx}", top, [(0.0022, 0.004)] * 7, COAT,
                       n=4, up=(0, 0, 1), caps=("flat", "flat")))
    if sx > 0:
        for k, z in enumerate((0.62, 0.54)):
            out.append(rk.ball(f"{R}-tbutton{k}", 0.0065,
                               tail_point(math.radians(4), z, lift + 0.0055),
                               DARK, scale=(1, 0.55, 1), seg=6, rings=3))
    return out


# ------------------------------------------------------------- torso


def coat_body():
    """The coat from the neck down past the waist seam, where it goes on,
    inset, under the tails."""
    n = 24
    c = rk.Mesh(f"{R}-coat", COAT)
    zs = [0.46, 0.5, 0.56, 0.62, SEAM, SEAM + 0.015, SEAM + 0.03, 0.73, 0.79, 0.845,
          0.89, 0.925, 0.952, 0.978, 1.004]
    rows = [[c.v(coat_point(i / n * math.tau, z)) for i in range(n)]
            for z in zs]
    c.grid(rows, COAT, closed=True)
    c.fan(rows[-1], V(0, 0, 1.02), COAT)
    return c.obj(recalc=True)


def blouse():
    """The team blouse in the coat's V, with its round collar."""
    pieces = []

    def v_fn(u, v):
        z = lerp(0.868, 1.0, v)
        w = lerp(4.0, 34.0, smooth(0.868, 0.99, z) ** 0.8)
        a = math.radians(u * w)
        return body_point(a, z, 0.0075)

    pieces.append(rk.sheet(f"{R}-blouse", v_fn, [-1, -0.5, 0, 0.5, 1],
                           [0, 0.25, 0.5, 0.75, 1], TEAM, rim=0.003,
                           inside=V(0, 0, 0.9)))
    # A soft round collar at the neck.
    ring = []
    for i in range(15):
        a = math.radians(lerp(-150, 150, i / 14))
        ring.append(V(0.056 * math.sin(a), 0.052 * math.cos(a) - 0.002,
                      0.996 - 0.008 * max(0.0, math.cos(a))))
    pieces.append(rk.tube(f"{R}-bcollar", ring, [(0.006, 0.012)] * 15, TEAM,
                          n=6, up=(0, 0, 1), caps=("dome", "dome")))
    return pieces


def lapels():
    """Notched lapels lying on the chest either side of the V, and the
    coat's collar standing round the back of the neck."""
    pieces = []
    for side in (1, -1):
        def lap(u, v, side=side):
            z = lerp(0.862, 0.985, v)
            edge = lerp(4.0, 34.0, smooth(0.868, 0.99, z) ** 0.8)
            w = lerp(9.0, 20.0, smooth(0.862, 0.95, z))
            # The notch: the lapel narrows just below its top.
            w *= 1 - 0.45 * gauss(v, 0.8, 0.07)
            a = math.radians(side * (edge + u * w))
            return body_point(a, z, 0.0105 + 0.002 * u)
        pieces.append(rk.sheet(f"{R}-lapel{side}", lap, [0, 0.5, 1],
                               [0, 0.2, 0.4, 0.6, 0.72, 0.8, 0.88, 1.0], COAT,
                               rim=0.004, inside=V(0, 0, 0.88),
                               rim_edges=("u0", "v0", "v1")))

    def col(u, v):
        a = math.radians(lerp(36, 324, u))
        s, c = math.sin(a), math.cos(a)
        r_in = V(0.062 * s, 0.058 * c, 1.022)
        r_out = V(0.104 * s, 0.09 * c, 0.978)
        mid = lerp(r_in, r_out, 0.4) + V(0, 0, 0.012)
        if v <= 0.5:
            return lerp(r_in, mid, v * 2)
        return lerp(mid, r_out, (v - 0.5) * 2)

    pieces.append(rk.sheet(f"{R}-collar", col, [i / 16 for i in range(17)],
                           [0.0, 0.5, 1.0], COAT, rim=0.005,
                           inside=V(0, 0, 0.9), rim_edges=("u0", "u1", "v1")))
    return pieces


def front():
    """Buttons down the coat front, a breast pocket full of pens and a
    stitched seam at the waist."""
    pieces = []
    for k, z in enumerate((0.84, 0.77, 0.705)):
        pieces.append(rk.ball(f"{R}-button{k}", 0.0068,
                              body_point(math.radians(4), z, 0.0105), DARK,
                              scale=(1, 0.55, 1), seg=6, rings=3))
    # The breast pocket on her left, and three pens.
    def pk(u, v):
        a = math.radians(-lerp(22, 48, u))
        z = lerp(0.842, 0.79, v)
        return body_point(a, z, 0.0085 + 0.0012 * math.sin(math.pi * v))
    pieces.append(rk.sheet(f"{R}-bpocket", pk, [0, 0.33, 0.67, 1],
                           [0, 0.5, 1], COAT, rim=0.004,
                           inside=V(0, 0, 0.82), rim_edges=("u0", "u1", "v1")))
    for k, (ad, h, mat) in enumerate(((-28, 0.03, TEAM), (-35, 0.024, BRASS),
                                      (-42, 0.028, DARK))):
        p = body_point(math.radians(ad), 0.832, 0.0075)
        pieces.append(rk.tube(f"{R}-pen{k}", [p, p + V(0, 0.002, h)],
                              [0.0042, 0.0038], mat, n=6,
                              caps=("flat", "dome")))
    seam = [coat_point(i / 28 * math.tau, SEAM + 0.006, 0.0022)
            for i in range(28)]
    pieces.append(rk.tube(f"{R}-seam", seam + [seam[0]], [0.0028] * 29, COAT,
                          n=4, caps=(None, None)))
    # A buttoned half-belt across the small of the back.
    def hb(u, v):
        a = math.radians(lerp(150, 210, u))
        z = lerp(SEAM - 0.006, SEAM + 0.022, v)
        return coat_point(a, z, 0.0105)
    pieces.append(rk.sheet(f"{R}-halfbelt", hb, [i / 8 for i in range(9)],
                           [0, 1], COAT, rim=0.004, inside=V(0, 0, 0.66)))
    for k, a in enumerate((155, 205)):
        pieces.append(rk.ball(f"{R}-hbutton{k}", 0.0062,
                              coat_point(math.radians(a), SEAM + 0.008,
                                         0.0135), DARK, seg=6, rings=3))
    return pieces


def hips():
    rings = []
    for z, rx_, ry_ in ((0.5, 0.06, 0.05), (0.54, 0.11, 0.085),
                        (0.58, 0.122, 0.094), (0.62, 0.118, 0.092),
                        (0.64, 0.11, 0.088)):
        rings.append([V(x, y, z) for x, y, _ in rk.sup(18, rx_, ry_, 2.3)])
    return rk.loft(f"{R}-hips", rings, TEAM2, start="pole", end=None)


# ------------------------------------------------------------- the coil pack

PACK = V(0, -0.155, 0.8)
COIL_X, COIL_Y = 0.0, -0.19
COIL_Z0, COIL_Z1 = 0.94, 1.19
TOP = V(COIL_X, COIL_Y, 1.29)


def pack():
    """The Tesla coil pack: a riveted case on shoulder straps, a gauge, the
    copper-wound coil and its brass top ring (the ball is `extra`)."""
    pieces = []
    case = rk.rbox(f"{R}-case", (0.2, 0.085, 0.25), PACK, DARK, levels=2,
                   crease=0.6)
    pieces.append(case)
    # Brass corner guards and a band round the middle.
    for sx in (-1, 1):
        for sz in (-1, 1):
            pieces.append(rk.ball(f"{R}-corner{sx}{sz}", 0.016,
                                  PACK + V(sx * 0.092, -0.03, sz * 0.114),
                                  BRASS, scale=(1, 1.05, 1), seg=8, rings=5))
    band = [PACK + V(x, y - 0.0, 0) for x, y, _ in rk.sup(20, 0.104, 0.046,
                                                          4.0)]
    pieces.append(rk.tube(f"{R}-caseband", band + [band[0]], [(0.004, 0.012)]
                          * 21, BRASS, n=4, up=(0, 0, 1), caps=(None, None)))
    # The gauge on the back: a brass bezel, an ivory face, a needle.
    g = PACK + V(0.045, -0.0445, 0.06)
    m = rk.basis(V(-1, 0, 0), V(0, 0, 1), V(0, -1, 0), g)
    ring = [(math.cos(i / 16 * math.tau) * 0.03,
             math.sin(i / 16 * math.tau) * 0.03) for i in range(16)]
    pieces.append(rk.slab(f"{R}-bezel", ring, 0.008, BRASS, matrix=m, ))
    face = [(math.cos(i / 16 * math.tau) * 0.023,
             math.sin(i / 16 * math.tau) * 0.023) for i in range(16)]
    m2 = rk.basis(V(-1, 0, 0), V(0, 0, 1), V(0, -1, 0), g + V(0, -0.008, 0))
    pieces.append(rk.slab(f"{R}-dial", face, 0.0015, COAT, matrix=m2))
    m3 = rk.basis(V(-1, 0, 0), V(0, 0, 1), V(0, -1, 0), g + V(0, -0.0095, 0))
    pieces.append(rk.slab(f"{R}-needle", [(-0.003, -0.002), (0.017, 0.012),
                                          (-0.002, 0.003)], 0.0015, DARK,
                          matrix=m3))
    # Two copper switches and a cable from the case to the coil's foot.
    for k, x in enumerate((-0.05, -0.02)):
        pieces.append(rk.tube(f"{R}-switch{k}",
                              [PACK + V(x, -0.043, 0.07),
                               PACK + V(x, -0.062, 0.085)],
                              [0.005, 0.004], COPPER, n=6,
                              caps=("flat", "dome")))
    # The coil's base plate on top of the case.
    pieces.append(rk.tube(f"{R}-coilbase", [V(COIL_X, COIL_Y, 0.918),
                                           V(COIL_X, COIL_Y, COIL_Z0 + 0.004)],
                          [0.05, 0.046], BRASS, n=16, caps=("flat", "flat")))
    pieces.append(rk.rbox(f"{R}-mount", (0.07, 0.07, 0.03),
                          V(COIL_X, COIL_Y + 0.012, 0.912), DARK, levels=1,
                          crease=0.5))
    # The coil: a copper winding (a ridged lathe), a little waisted.
    prof = []
    z = COIL_Z0
    k = 0
    while z < COIL_Z1 - 1e-6:
        t = (z - COIL_Z0) / (COIL_Z1 - COIL_Z0)
        r = 0.035 - 0.004 * math.sin(math.pi * t)
        prof.append((r + (0.004 if k % 2 else 0.0), z))
        z += 0.0095
        k += 1
    prof.append((0.034, COIL_Z1))
    obj = kit.lathe(f"{R}-coil", prof, location=(COIL_X, COIL_Y, 0),
                    segments=16, mat=COPPER)
    kit.apply_transform(obj)
    pieces.append(obj)
    # Dark insulator discs between the windings.
    for k, z in enumerate((1.02, 1.1)):
        pieces.append(rk.tube(f"{R}-disc{k}", [V(COIL_X, COIL_Y, z - 0.005),
                                              V(COIL_X, COIL_Y, z + 0.005)],
                              [0.047, 0.047], DARK, n=16,
                              caps=("flat", "flat")))
    # Brass end cap and the big doughnut top ring.
    pieces.append(rk.tube(f"{R}-coilcap", [V(COIL_X, COIL_Y, COIL_Z1 - 0.004),
                                          V(COIL_X, COIL_Y, COIL_Z1 + 0.022)],
                          [0.042, 0.03], BRASS, n=16, caps=(None, "flat")))
    torus = []
    n = 28
    for i in range(n + 1):
        a = i / n * math.tau
        torus.append(V(COIL_X + math.cos(a) * 0.056, COIL_Y + math.sin(a) *
                       0.056, COIL_Z1 + 0.04))
    pieces.append(rk.tube(f"{R}-toroid", torus, [0.0185] * (n + 1), BRASS,
                          n=12, caps=(None, None)))
    for i in range(4):
        a = i / 4 * math.tau + 0.4
        pieces.append(rk.tube(f"{R}-spoke{i}",
                              [V(COIL_X, COIL_Y, COIL_Z1 + 0.03),
                               V(COIL_X + math.cos(a) * 0.05,
                                 COIL_Y + math.sin(a) * 0.05,
                                 COIL_Z1 + 0.04)],
                              [0.005, 0.005], BRASS, n=4, caps=(None, None)))
    # The stalk the ball sits on.
    pieces.append(rk.tube(f"{R}-stalk", [V(COIL_X, COIL_Y, COIL_Z1 + 0.018),
                                        TOP + V(0, 0, -0.02)],
                          [0.008, 0.007], COPPER, n=8, caps=(None, "flat")))
    # Shoulder straps: from the case's top over each shoulder, down the
    # front to the chest, and from its bottom corners round to the front.
    for sx in (-1, 1):
        path = [PACK + V(sx * 0.07, 0.03, 0.12),
                V(sx * 0.1, -0.075, 0.975), V(sx * 0.105, -0.01, 1.0),
                V(sx * 0.108, 0.07, 0.965),
                body_point(math.radians(sx * 50), 0.9, 0.014),
                body_point(math.radians(sx * 62), 0.83, 0.013),
                body_point(math.radians(sx * 88), 0.77, 0.012),
                body_point(math.radians(sx * 125), 0.73, 0.012),
                PACK + V(sx * 0.098, 0.035, -0.1)]
        path = kit.smooth_path(path, samples=3)
        pieces.append(rk.tube(f"{R}-strap{sx}", path, [(0.0045, 0.013)] *
                              len(path), LEATHER, n=4, up=(0, 0, 1),
                              caps=("flat", "flat")))
        buckle = body_point(math.radians(sx * 55), 0.87, 0.019)
        pieces.append(rk.rbox(f"{R}-sbuckle{sx}", (0.022, 0.006, 0.02),
                              buckle, BRASS, levels=1, crease=0.6))
    return pieces


def ball():
    """The coil's glowing top ball with a brass collar under it."""
    pieces = [rk.ball(f"{R}-orb", 0.043, TOP + V(0, 0, 0.022), GLOW, seg=16,
                      rings=10),
              rk.tube(f"{R}-orbcollar", [TOP + V(0, 0, -0.022),
                                        TOP + V(0, 0, -0.012)],
                      [0.0135, 0.0165], BRASS, n=10, caps=("flat", "flat"))]
    # A few sparks crackling off it.
    for k, (d, h) in enumerate(((V(0.8, 0.2, 0.3), 0.03),
                                (V(-0.7, -0.4, 0.5), 0.026),
                                (V(0.1, -0.9, 0.2), 0.028))):
        d = d.normalized()
        c = TOP + V(0, 0, 0.022) + d * 0.041
        side = d.cross(V(0, 0, 1)).normalized()
        pts = [c, c + d * h * 0.45 + side * 0.008, c + d * h * 0.7 - side *
               0.006, c + d * h]
        pieces.append(rk.tube(f"{R}-spark{k}", pts, [0.0034, 0.003, 0.0026,
                                                     0.0018], GLOW, n=4,
                              caps=(None, "dome")))
    return pieces


# ------------------------------------------------------------- head

FACE_W = [(1.0, 0.027), (1.025, 0.037), (1.045, 0.047), (1.062, 0.0545),
          (1.076, 0.0595), (1.095, 0.0635), (1.12, 0.067), (1.145, 0.07),
          (1.17, 0.0715), (1.2, 0.072), (1.225, 0.069), (1.245, 0.061),
          (1.26, 0.045), (1.268, 0.02)]
FACE_D = [(1.0, 0.028), (1.025, 0.038), (1.045, 0.052), (1.062, 0.064),
          (1.074, 0.07), (1.09, 0.073), (1.12, 0.075), (1.15, 0.073),
          (1.172, 0.08), (1.2, 0.081), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
FACE_P = 2.5
NOSE_H = [(1.1, 0.0), (1.107, 0.0055), (1.114, 0.0125), (1.121, 0.0155),
          (1.13, 0.0135), (1.145, 0.0095), (1.16, 0.0055), (1.172, 0.0025),
          (1.186, 0.0)]
NOSE_S = [(1.11, 14.0), (1.13, 9.5), (1.17, 6.5)]


def face_disp(ad, z):
    """A bright young face: a soft, broad nose, high round cheekbones,
    full lips and a small rounded chin."""
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.0062 * gauss(a, 14, 5.5) * gauss(z, 1.112, 0.0065)     # nostrils
    d -= 0.0095 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)      # sockets
    bz = 1.174 - 0.003 * gauss(a, 9, 8)
    d += 0.005 * gauss(z, bz, 0.0065) * smooth(52, 30, a)         # brow
    d += 0.0085 * gauss(a, 45, 13) * gauss(z, 1.136, 0.012)       # cheekbone
    d += 0.004 * gauss(a, 34, 14) * gauss(z, 1.108, 0.014)        # cheeks
    d -= 0.0024 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 17)     # mouth
    d += 0.0042 * gauss(z, 1.102, 0.004) * gauss(ad, 0, 15)       # upper lip
    d += 0.0048 * gauss(z, 1.087, 0.0045) * gauss(ad, 0, 14)      # lower lip
    d += 0.0055 * gauss(z, 1.064, 0.01) * gauss(ad, 0, 17)        # chin
    d -= 0.0022 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)       # temples
    return d


def jaw_z(z):
    """A shorter, rounder chin: below the mouth the sculpt's tables are
    read a quarter faster, so the jaw closes sooner."""
    return z if z >= 1.09 else 1.09 - (1.09 - z) * 1.25


def face_point(ad, z):
    z0 = z
    z = jaw_z(z)
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
    return V(x, CY + y, z0) + n * face_disp(ad, z)


def face_normal(ad, z):
    du = face_point(ad + 0.5, z) - face_point(ad - 0.5, z)
    dz = face_point(ad, z + 0.001) - face_point(ad, z - 0.001)
    n = du.cross(dz).normalized()
    if (face_point(ad, z) - HC).dot(n) < 0:
        n = -n
    return n


# Extra rows and columns hug the painted mouth, so the skin under it (which
# bakes dark in the AO) cannot bleed a shadow round the lips.
FACE_A = [0, 4, 8.5, 13.5, 19, 25, 28.5, 32, 41, 52, 66, 82, 100, 124, 152]
FACE_Z = [1.012, 1.03, 1.047, 1.062, 1.072, 1.0785, 1.0825, 1.087, 1.093,
          1.101, 1.1065, 1.1105, 1.115, 1.122, 1.131, 1.141, 1.15, 1.159,
          1.167, 1.176, 1.187, 1.202, 1.228, 1.252]


def hairline(a):
    """The hair's lower edge at angle a (degrees): pulled smoothly up from
    the forehead, the temples and the nape toward the two puffs."""
    return table([(0, 1.214), (22, 1.208), (42, 1.194), (58, 1.172),
                  (70, 1.152), (80, 1.152), (92, 1.18), (104, 1.164),
                  (120, 1.124), (145, 1.09), (180, 1.074)], abs(a))


def skull():
    cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
    cols = [a for a in cols if a > -180]
    c = rk.Mesh(f"{R}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]
    n = len(cols)

    def mat(i, j):
        a0, a1 = cols[i], cols[(i + 1) % n]
        if i == n - 1:
            a1 += 360
        a = (a0 + a1) / 2
        a = a - 360 if a > 180 else a
        z = (FACE_Z[j] + FACE_Z[j + 1]) / 2
        if z > hairline(a) + 0.03:
            return HAIR
        return SKIN

    c.grid(rows, mat, closed=True)
    c.fan(rows[-1], V(0, CY - 0.005, 1.268), HAIR)
    return c.obj(outward=HC)


PUFFS = [V(sx * 0.066, CY - 0.012, 1.262) for sx in (-1, 1)]
PUFF_R = 0.056


def hair():
    """Hair drawn up close over the skull (with fine combed ridges) into two
    big round puffs on the crown, each tied with a team band."""
    cols = [i * 10.0 - 180 for i in range(36)]
    ts = [0.0, 0.06, 0.16, 0.3, 0.46, 0.62, 0.78, 0.9]
    c = rk.Mesh(f"{R}-hair", HAIR)
    grid = []
    for a in cols:
        z0 = hairline(a)
        col = []
        for t in ts:
            z = lerp(z0, 1.262, t)
            th = 0.0085 * smooth(0.0, 0.25, t)
            th += 0.0012 * math.sin(math.radians(a) * 18) * \
                smooth(0.05, 0.3, t)
            col.append(c.v(face_point(a, z) + face_normal(a, z) *
                           (th + 0.0008)))
        grid.append(col)
    for i in range(len(cols)):
        k = (i + 1) % len(cols)
        for j in range(len(ts) - 1):
            c.face((grid[i][j], grid[k][j], grid[k][j + 1], grid[i][j + 1]))
    ring = [grid[i][-1] for i in range(len(cols))]
    c.fan(ring, V(0, CY - 0.004, 1.274))
    out = [c.obj(outward=HC)]
    for k, p in enumerate(PUFFS):
        puff = kit.sphere(f"{R}-puff{k}", PUFF_R, (0, 0, 0), mat=HAIR,
                          segments=20, rings=14)
        for v in puff.data.vertices:
            d = v.co.normalized()
            th = math.atan2(d.y, d.x)
            ph = math.acos(max(-1, min(1, d.z)))
            # Soft cloud-like curls over the round puff.
            bump = 0.07 * math.sin(5 * th + 1.3 * k) * math.sin(4 * ph) + \
                0.035 * math.sin(9 * th + 3 * ph)
            v.co = d * PUFF_R * (1 + bump) * V(1.0, 0.95, 0.94)
        puff.location = p
        kit.apply_transform(puff)
        out.append(puff)
        # The band tying the puff, round its base toward the head.
        axis = (p - V(0, CY, 1.16)).normalized()
        base = p - axis * PUFF_R * 0.72
        u = axis.orthogonal().normalized()
        w = axis.cross(u)
        band = [base + (u * math.cos(i / 16 * math.tau) +
                        w * math.sin(i / 16 * math.tau)) * PUFF_R * 0.62
                for i in range(17)]
        out.append(rk.tube(f"{R}-tie{k}", band, [0.0075] * 17, TEAM, n=6,
                           caps=(None, None)))
    return out


def goggles():
    """Big brass goggles pushed up on the forehead, on a leather strap
    round the head."""
    pieces = []
    zs = 1.214
    strap = []
    for i in range(33):
        ad = -180 + i * 360 / 32
        z = zs + 0.004 * math.cos(math.radians(ad)) - 0.012 * \
            max(0.0, -math.cos(math.radians(ad)))
        strap.append(face_point(ad, z) + face_normal(ad, z) * 0.0115)
    pieces.append(rk.tube(f"{R}-gstrap", strap, [(0.0035, 0.0078)] * 33,
                          LEATHER, n=4, up=(0, 0, 1), caps=(None, None)))
    for sx in (-1, 1):
        ad = sx * 23
        z = 1.218
        n = face_normal(ad, z)
        up = V(0, 0, 1)
        # Tipped up, as goggles pushed back up the forehead are.
        axis = (n * math.cos(0.5) + up * math.sin(0.5)).normalized()
        base = face_point(ad, z) + n * 0.009
        side = up.cross(axis).normalized()
        upv = axis.cross(side)
        m = rk.basis(side, upv, axis, base)
        cup = kit.lathe(f"{R}-cup{sx}", [(0.019, 0.0), (0.0235, 0.004),
                                         (0.025, 0.014), (0.0235, 0.022),
                                         (0.018, 0.025)], segments=16,
                        mat=BRASS, close=False)
        cup.matrix_world = m
        kit.apply_transform(cup)
        pieces.append(cup)
        lens = [(math.cos(i / 16 * math.tau) * 0.0185,
                 math.sin(i / 16 * math.tau) * 0.0185) for i in range(16)]
        pieces.append(rk.slab(f"{R}-lens{sx}", lens, 0.003, DARK,
                              matrix=m @ Matrix.Translation(V(0, 0, 0.021))))
        glint = [(math.cos(i / 8 * math.tau) * 0.0045 - 0.006,
                  math.sin(i / 8 * math.tau) * 0.0045 + 0.007)
                 for i in range(8)]
        pieces.append(rk.slab(f"{R}-glint{sx}", glint, 0.0012, COAT,
                              matrix=m @ Matrix.Translation(V(0, 0, 0.024))))
        # Rivets round the rim.
        for k in range(4):
            a = k / 4 * math.tau + 0.4
            p = m @ V(math.cos(a) * 0.0232, math.sin(a) * 0.0232, 0.018)
            pieces.append(rk.ball(f"{R}-rivet{sx}{k}", 0.0026, p, BRASS,
                                  seg=5, rings=3))
    # The bridge between the cups.
    a = face_point(-12, 1.222) + face_normal(-12, 1.222) * 0.016
    b = face_point(12, 1.222) + face_normal(12, 1.222) * 0.016
    pieces.append(rk.tube(f"{R}-bridge", [a, lerp(a, b, 0.5) + V(0, 0.004,
                                                                0.002), b],
                          [0.004] * 3, BRASS, n=5, caps=("dome", "dome")))
    return pieces


def ears():
    out = []
    for sx in (-1, 1):
        p = face_point(sx * 90, 1.142) + V(sx * 0.004, -0.008, 0)
        e = rk.ball(f"{R}-ear{sx}", 1.0, V(0, 0, 0), SKIN,
                    scale=(0.008, 0.018, 0.026), seg=8, rings=5)
        m = Matrix.Translation(p) @ Matrix.Rotation(math.radians(-sx * 14),
                                                    4, "Z") @ \
            Matrix.Rotation(math.radians(-10), 4, "X")
        rk.transform([e], m)
        out.append(e)
        # A small brass stud in each lobe.
        lobe = p + V(sx * 0.006, 0.004, -0.02)
        out.append(rk.ball(f"{R}-stud{sx}", 0.0045, lobe, BRASS, seg=6,
                           rings=4))
    return out


def face_details():
    out = face_paint.eyes(rk, R, face_point, HC, z=1.1565,
                          expression="curious")
    out += face_paint.mouth(rk, R, face_point, HC, expression="confident")
    z = 1.1565
    for sx in (-1, 1):
        slope = sx * 0.003
        lash = [(sx * 37, z + 0.008 + slope), (sx * 47, z + 0.015 + slope),
                (sx * 43, z + 0.005 + slope)]
        if sx < 0:
            lash = lash[::-1]
        out.append(rk.decal(f"{R}-lash{sx}", face_point, lash, 0.0046,
                            face_paint.INK, depth=0.001, eps=0.05, ref=HC))
    zm = 1.0965
    lips = [(-25, zm + 0.005), (-14, zm + 0.0068), (-5, zm + 0.0062),
            (0, zm + 0.0052), (5, zm + 0.0062), (14, zm + 0.0068),
            (25, zm + 0.0072), (18, zm - 0.01), (0, zm - 0.0165),
            (-17, zm - 0.011)]
    out.append(rk.decal(f"{R}-lips", face_point, lips[::-1], 0.0031, LIP,
                        depth=0.0006, eps=0.05, ref=HC))
    return out


def neck():
    return rk.tube(f"{R}-neck", [V(0, -0.004, 0.965), V(0, 0.0, 1.04),
                                 V(0, 0.008, 1.095)],
                   [0.041, 0.04, 0.039], SKIN, n=12, caps=(None, None))


def head():
    locks = hair()
    pieces = [skull(), locks[0]] + face_details() + ears() + goggles()
    left, right = locks[1:3], locks[3:5]
    rk.transform(pieces + left + right, Matrix.Translation(V(0, 0, HEAD_DZ)))
    return pieces + [neck()], left, right


# ------------------------------------------------------------- arms


def fist(name, c, xax, kax, chir, mat=TEAM):
    """A gloved fist round a pole along Z (the index finger's end), its
    fingertips toward X and knuckles toward K; the wrist at -X."""
    zs = [-0.035, -0.028, -0.017, -0.0085, 0.0, 0.0085, 0.017, 0.028, 0.035]
    grooves = {-0.017, 0.0, 0.017}
    cx, cy, hx, hy = -0.0035, 0.002, 0.0315, 0.0262
    rings = []
    for z in zs:
        k = 1.0
        if abs(z) > 0.034:
            k = 0.74
        elif abs(z) > 0.027:
            k = 0.93
        if z < 0:
            k *= 0.94
        ring = []
        for x, y, ang in rk.sup(10, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.0022 * (1 if px > 0.004 else 0.5)
                py += 0.0016 if py < -0.01 else 0.0
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [rk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.037),
                      end=V(cx, cy, 0.038))]
    thumb = [V(-0.023, -0.019, 0.015), V(-0.008, -0.026, 0.03),
             V(0.01, -0.021, 0.036)]
    pieces.append(rk.tube(f"{name}-thumb", thumb, [0.0094, 0.0084, 0.0076],
                          mat, n=6))
    pieces.append(rk.tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                           V(-0.029, 0.0, 0.0)],
                          [(0.021, 0.026), (0.024, 0.029)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = rk.basis(xax, kax, zax, c)
    rk.transform(pieces, m)
    return pieces


def upper_arm(side, s, e, sx):
    """The coat sleeve from the shoulder to the elbow."""
    up = (e - s).normalized()
    return [rk.ball(f"{R}-shoulder{side}", 1.0, s + V(sx * 0.003, 0, -0.016),
                    COAT, scale=(0.05, 0.052, 0.044), seg=10, rings=6),
            rk.tube(f"{R}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5), e],
                    [0.049, 0.046, 0.042], COAT, n=12, caps=(None, None)),
            rk.ball(f"{R}-elbow{side}", 0.0418, e, COAT, seg=10, rings=6)]


def forearm(side, e, w):
    """The sleeve from the elbow to a turned-back cuff, then the flared
    gauntlet of the glove."""
    fo = (w - e).normalized()
    cuff = w - fo * 0.03
    return [rk.tube(f"{R}-fore{side}", [e, lerp(e, cuff, 0.5), cuff],
                    [0.041, 0.04, 0.039], COAT, n=12, caps=(None, None)),
            rk.tube(f"{R}-cuff{side}", [cuff - fo * 0.022, cuff + fo * 0.004],
                    [0.043, 0.0445], COAT, n=12, caps=(None, "flat")),
            rk.tube(f"{R}-gauntlet{side}", [cuff - fo * 0.004,
                                           lerp(cuff, w, 0.6),
                                           w + fo * 0.012],
                    [0.043, 0.035, 0.026], TEAM, n=12, caps=("flat", None))]


def build_arm_r():
    s, e, c = S_R, E_R, C_R
    fdir = (c - e).normalized()
    # The grip stands across the fist, square to the forearm; the rod runs
    # forward along the forearm's line.
    grip = V(0, 0, 1) - fdir * fdir.z
    grip.normalize()
    xax = fdir
    kax = xax.cross(grip)
    w = c - fdir * WRIST_FIST
    upper = upper_arm("R", s, e, 1)
    lower = forearm("R", e, w)
    lower += fist(f"{R}-handR", c, xax, kax, -1)
    return upper, lower, e, c, fdir, grip


def build_arm_l():
    s, e, c = S_L, E_L, C_L
    d = V(0, 1, 0)
    xax = (c - e)
    xax = (xax - d * xax.dot(d)).normalized()
    kax = d.cross(xax)
    w = c - (c - e).normalized() * WRIST_FIST
    upper = upper_arm("L", s, e, -1)
    lower = forearm("L", e, w) + fist(f"{R}-handL", c, xax, kax, 1)
    return upper, lower, e


# ------------------------------------------------------------- the wand


def wand(c, fdir, grip):
    """A copper zapper with a pistol grip: the dark grip in the fist, a
    brass housing on top of it, a copper rod forward with three coils and
    a glowing tip in a little brass fork."""
    x = fdir.cross(grip)
    m = rk.basis(x, fdir, grip, c)
    P = []
    P.append(rk.tube(f"{R}-grip", [V(0, -0.004, -0.046), V(0, 0, 0.0),
                                   V(0, 0.004, 0.04)],
                     [(0.013, 0.017), (0.014, 0.018), (0.014, 0.018)], DARK,
                     n=8, up=(0, 1, 0), caps=("dome", None)))
    P.append(rk.rbox(f"{R}-housing", (0.042, 0.078, 0.042),
                     V(0, 0.014, 0.058), BRASS, levels=2, crease=0.55))
    P.append(rk.tube(f"{R}-rod", [V(0, 0.045, 0.06), V(0, 0.2, 0.06)],
                     [0.011, 0.0095], COPPER, n=10, caps=(None, None)))
    for k, y in enumerate((0.075, 0.105, 0.135)):
        P.append(rk.tube(f"{R}-wcoil{k}", [V(0, y - 0.01, 0.06),
                                          V(0, y + 0.01, 0.06)],
                         [0.021 - k * 0.002] * 2, COPPER, n=12,
                         caps=("flat", "flat"), flute=0.12))
    for sx in (-1, 1):
        P.append(rk.tube(f"{R}-prong{sx}", [V(0, 0.19, 0.06),
                                           V(sx * 0.017, 0.204, 0.06),
                                           V(sx * 0.016, 0.224, 0.06)],
                         [0.0048, 0.0043, 0.0036], BRASS, n=5,
                         caps=(None, "dome")))
    P.append(rk.ball(f"{R}-tip", 0.02, V(0, 0.218, 0.06), GLOW, seg=12,
                     rings=8))
    # A copper trigger and a dial on the housing.
    P.append(rk.tube(f"{R}-trigger", [V(0, 0.02, 0.036), V(0, 0.03, 0.02)],
                     [0.0045, 0.004], COPPER, n=5, caps=(None, "dome")))
    P.append(rk.tube(f"{R}-knob", [V(0.02, 0.0, 0.06), V(0.028, 0.0, 0.06)],
                     [0.0085, 0.0085], COPPER, n=10, caps=(None, "flat")))
    # Chunkier than drawn, so it reads from the game's camera; the grip
    # stays the fist's size.
    for o in P[1:]:
        for v in o.data.vertices:
            v.co = V(v.co.x * 1.2, v.co.y * 1.2, 0.06 + (v.co.z - 0.06) * 1.2)
    rk.transform(P, m)
    return P


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    return rk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="inventor"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.086, 0.018, 0.36), V(-0.094, 0.026, 0.085), 11),
            ("R", 1, V(0.086, 0.012, 0.36), V(0.096, 0.018, 0.085), 8)):
        pieces, hip = leg(sx, knee, ankle, out)
        part(f"leg{side}", pieces, hip, root)

    torso = [coat_body(), hips()] + blouse() + lapels() + front() + pack()
    torso_obj = part("torso", torso, WAIST, root)
    part("skirtL", tail_half(-1), V(0, 0, SKIRT_PIVOT_Z), torso_obj)
    part("skirtR", tail_half(1), V(0, 0, SKIRT_PIVOT_Z), torso_obj)
    part("extra", ball(), TOP + V(0, 0, -0.02), torso_obj, angle=40)
    face, left, right = head()
    head_obj = face_rig.head(rk.part, R, face, NECK, torso_obj, angle=62)
    # The two puffs each pivot where their band joins the head.
    for name, pieces, p in zip(("hair", "hat"), (left, right), PUFFS):
        axis = (p - V(0, CY, 1.16)).normalized()
        part(name, pieces, p - axis * PUFF_R * 0.72 + V(0, 0, HEAD_DZ),
             head_obj, angle=62)

    upper, lower, e, c, fdir, grip = build_arm_r()
    arm_r = part("armR", upper, S_R, torso_obj)
    fore_r = part("foreR", lower, e, arm_r)
    part("weapon", wand(c, fdir, grip), c, fore_r, angle=40)
    upper, lower, e = build_arm_l()
    arm_l = part("armL", upper, S_L, torso_obj)
    part("foreL", lower, e, arm_l)

    articulation.legs(root, R)
    report(root)
    pose = os.environ.get("INVENTOR_POSE")
    if pose in POSES:
        rk.apply_runtime(root, POSES[pose])
    return root


# ------------------------------------------------------------- poses


def walking_leg(u, swing):
    """lib/games/arena/gait.ts walkingLeg: hip, knee and ankle turns."""
    u = u % 1
    stance = 0.6
    k = max(0.0, (u - stance) / (1 - stance))
    ease = k * k * (3 - 2 * k)
    forward = 1 - 2 * u / stance if u < stance else -1 + 2 * ease
    lift = math.sin(math.pi * k)
    settle = math.sin(u / stance * math.pi) * 0.065 if u < stance else 0
    hip = forward * swing * 0.68 + lift * 0.44
    knee = -lift * 0.95 - settle
    toe = (math.sin((u - 0.42) / (stance - 0.42) * math.pi) * 0.18
           if 0.42 < u < stance else 0)
    return hip, knee, -(hip + knee) + toe, forward


# Mirrors moves/inventor.ts.
SWING, ARM_SWING, TAIL_FOLLOW = 0.62, 0.36, 0.66


def stride(cycle):
    hl, kl, al, fl = walking_leg(cycle, SWING)
    hr, kr, ar, fr = walking_leg(cycle + 0.5, SWING)
    return {"legL": (hl, 0, 0), "kneeL": (kl, 0, 0), "footL": (al, 0, 0),
            "legR": (hr, 0, 0), "kneeR": (kr, 0, 0), "footR": (ar, 0, 0),
            "skirtL": (hl * TAIL_FOLLOW, 0, 0),
            "skirtR": (hr * TAIL_FOLLOW, 0, 0),
            "armL": (fr * ARM_SWING, 0, 0), "armR": (fl * ARM_SWING * 0.5,
                                                      0, 0)}


POSES = {
    # The charge-up at its peak: wand drawn back and up by the shoulder,
    # the body coiled away from the target.
    "charge": {"armR": (0.55, 0, 0.3), "foreR": (1.35, 0, 0),
               "weapon": (-0.6, 0, 0), "torso": (0.06, -0.3, 0),
               "armL": (0.7, 0, -0.25), "head": (0.0, 0.25, 0)},
    # The thrust on the hit: arm straight at the target, wand level.
    "zap": {"armR": (1.3, 0, 0.05), "foreR": (-0.55, 0, 0),
            "weapon": (-0.3, 0, 0), "torso": (-0.1, 0.32, 0),
            "armL": (-0.1, 0, -0.35), "head": (0.0, -0.28, 0)},
    "walkA": stride(0.78),
    "walkB": stride(0.08),
}


def report(root):
    print("INVENTOR joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:18s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {rk.tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("INVENTOR materials", len(mats), mats)
