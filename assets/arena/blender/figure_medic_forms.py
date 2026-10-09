"""The Medic (figure id `medic`) as a collector's miniature: a South Asian
field medic of the 1940s in hand-painted resin.

A round cream cap with a stiff band and a green cross on its front and
crown over dark hair pinned back into a low bun; a khaki uniform shirt with
a pointed collar, a team-colour tie, team epaulettes and rolled sleeves; a
cream armband with a green cross on the left arm; a khaki A-line skirt over
team-colour trousers, a leather belt, lace-up ankle boots; a big leather
satchel with a cream cross patch on her right hip, its strap across her
chest; in her right hand, held up before her, a round tonic flask of
glowing green. The cross is always green, never red.

Parts (figures.py has the contract), none with a rest rotation:

  medic           root at the feet, facing +y
    legL, legR    pivots on the hips (trousers and boots); knees and ankles
                  are split here in build() with articulation.py
    torso         pivot at the waist: shirt, belt, satchel and an inner
                  skirt that shows through when the halves part
      skirtL/R    the skirt's halves, hung from the waist so they trail
                  the thighs instead of swinging rigidly with them
      head        pivot at the neck, the cap on it
      armL        pivot on the left shoulder, the whole arm
      armR        pivot on the right shoulder, the upper arm
        foreR     pivot at the elbow, forearm and fist
          weapon  the flask, pivot in the right fist

MEDIC_POSE=<name> turns the parts as the game would (three.js Euler terms,
see figure_medic_kit.runtime_quat) before the previews: `pulse` lifts the
flask for a heal, `walkA`/`walkB` are two moments of the stride with the
knees, ankles and skirt halves as troops.ts and moves/medic.ts set them,
`pulsewalk` both at once.
"""

import math
import os

import articulation
import face_paint
import face_rig
import kit
import figure_medic_kit as rk
from figure_medic_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

R = "medic"
T = kit.tint

# ------------------------------------------------------------- paints

SKIN = "resin:" + T("medic-skin", "#b87a51")
HAIR = "resin:" + T("medic-hair", "#241a16")      # hair, soles, lashes
KHAKI = "weave:" + T("medic-khaki", "#baa26f")    # shirt and skirt
TEAM = "weave:team"                               # trousers, epaulettes
TEAM2 = "weave:team2"                             # the tie
CREAM = "resin:" + T("medic-cream", "#f1e7cd")    # cap, armband, patch
CROSS = "resin:" + T("medic-cross", "#23a257")    # the green cross
LEATHER = "hide:" + T("medic-leather", "#7c4a29")  # satchel, belt, boots
BRASS = "gilt:" + T("medic-brass", "#c9a257")
GLOW = "glow:" + T("medic-tonic", "#3fe85c")
LIP = "resin:" + T("medic-lip", "#a8544c")
DARK = HAIR

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.082, 0.61
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.155, 0.952
S_L = V(-SH_X, 0.0, SH_Z)
S_R = V(SH_X, 0.0, SH_Z)
NECK = V(0, 0.0, 1.018)
UPPER, FORE = 0.235, 0.21
WRIST_FIST = 0.04
SKIRT_PIVOT_Z = 0.645

# The head is sculpted in the tower guard's head space (skull centre at
# 1.162) and lowered onto this shorter neck.
HEAD_DZ = -0.004
HC = V(0, 0.012, 1.162)
CY = 0.012

# The right arm: upper arm hanging a little forward, forearm raised before
# her so the flask stands upright at chest height.
E_R = S_R + V(0.03, 0.035, -0.23).normalized() * UPPER
F_DIR = V(-0.16, 0.9, 0.42).normalized()
C_R = E_R + F_DIR * (FORE + WRIST_FIST)
E_L = S_L + V(-0.045, -0.012, -0.23).normalized() * UPPER
C_L = E_L + V(-0.07, 0.33, -0.94).normalized() * (FORE + WRIST_FIST)

# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the shirt.
BODY = [(0.6, 0.112, 0.088, 0.094), (0.64, 0.114, 0.087, 0.089),
        (0.68, 0.116, 0.086, 0.084), (0.73, 0.124, 0.092, 0.084),
        (0.79, 0.136, 0.104, 0.088), (0.845, 0.145, 0.108, 0.092),
        (0.89, 0.15, 0.1, 0.095), (0.925, 0.148, 0.092, 0.093),
        (0.952, 0.132, 0.08, 0.082), (0.978, 0.094, 0.064, 0.064),
        (1.004, 0.052, 0.047, 0.047)]
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
    # A modest bust under the shirt.
    p.y += 0.017 * gauss(z, 0.83, 0.04) * (gauss(ad, 24, 17) +
                                           gauss(ad, -24, 17))
    return p


# The A-line skirt, from under the belt to just above the knee.
SKIRT = [(0.44, 0.19, 0.14, 0.146), (0.5, 0.179, 0.132, 0.137),
         (0.56, 0.167, 0.122, 0.128), (0.62, 0.158, 0.114, 0.118),
         (0.66, 0.133, 0.1, 0.099), (0.695, 0.124, 0.094, 0.092)]
SKIRT_P = 2.2
HEM = 0.44


def skirt_point(a, z, extra=0.0):
    ad = math.degrees(a)
    # Soft pressed pleats that open toward the hem.
    fold = 0.0055 * smooth(0.66, HEM, z) * math.sin(8 * a + 0.4)
    return ring_point(SKIRT, SKIRT_P, a, z, extra + fold * (1 - 0.3 *
                                                            abs(math.cos(a))))


# ------------------------------------------------------------- legs


def boot(sx, ankle, knee, toe_out):
    """A lace-up ankle boot: a round toe cap, a low heel, a padded collar
    and laces crossing up the front."""
    pieces = []
    foot = [(-0.062, 0.025, 0.034, 0.062), (-0.052, 0.036, 0.028, 0.082),
            (-0.028, 0.042, 0.028, 0.088), (0.012, 0.043, 0.024, 0.076),
            (0.05, 0.042, 0.02, 0.064), (0.088, 0.037, 0.018, 0.056),
            (0.115, 0.029, 0.019, 0.05), (0.134, 0.017, 0.022, 0.043)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in rk.sup(10, rx_, (zt - zb) / 2, 2.4, math.pi / 10):
            ring.append(V(x, y, (zb + zt) / 2 + z))
        rings.append(ring)
    pieces.append(rk.loft(f"{R}-foot{sx}", rings, LEATHER,
                          bands=lambda i, j: DARK if i in (6, 7) else None,
                          start=V(0, -0.067, 0.048), end=V(0, 0.141, 0.033)))
    # The welt round the sole.
    welt = [V(x, y, 0.022) for x, y, _ in rk.sup(16, 0.047, 0.1, 2.6)]
    welt = [V(p.x * (0.92 if p.y < 0 else 1.0), p.y + 0.036, p.z)
            for p in welt]
    pieces.append(rk.tube(f"{R}-welt{sx}", welt + [welt[0]], [0.006] * 17,
                          DARK, n=4, caps=(None, None)))
    heel = []
    for z, s in ((0.0, 0.84), (0.016, 0.94), (0.026, 1.0)):
        heel.append([V(x * s, -0.043 + y * s, z) for x, y, _ in
                     rk.sup(8, 0.031, 0.026, 2.6)])
    pieces.append(rk.loft(f"{R}-heel{sx}", heel, DARK, start="flat",
                          end="flat"))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    rk.transform(pieces, place)

    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    n = 14
    shaft = []
    for z, r in ((0.045, 0.043), (0.09, 0.046), (0.14, 0.05), (0.19, 0.054),
                 (0.205, 0.057)):
        c = on_leg(z)
        shaft.append([V(c.x + math.sin(i / n * math.tau) * r,
                        c.y + math.cos(i / n * math.tau) * r * 1.05, z)
                      for i in range(n)])
    pieces.append(rk.loft(f"{R}-shaft{sx}", shaft, LEATHER))
    # The padded collar.
    top = on_leg(0.203)
    ring = [top + V(math.sin(i / n * math.tau) * 0.058,
                    math.cos(i / n * math.tau) * 0.061, 0) for i in range(n)]
    pieces.append(rk.tube(f"{R}-collar{sx}", ring + [ring[0]], [0.0065] *
                          (n + 1), LEATHER, n=5, caps=(None, None)))
    # Laces crossing up the front of the shaft and the instep.
    for k, z in enumerate((0.085, 0.118, 0.151, 0.184)):
        c = on_leg(z)
        r = 0.05 + (z - 0.085) * 0.06
        a0, a1 = math.radians(-24), math.radians(24)
        pa = c + V(math.sin(a0) * r, math.cos(a0) * r * 1.05 + 0.003, 0.012)
        pb = c + V(math.sin(a1) * r, math.cos(a1) * r * 1.05 + 0.003, -0.012)
        pm = lerp(pa, pb, 0.5) + V(0, 0.004, 0)
        pieces.append(rk.tube(f"{R}-lace{sx}{k}", [pa, pm, pb], [0.0026] * 3,
                              CREAM, n=4, caps=("dome", "dome")))
        pieces.append(rk.tube(f"{R}-lacex{sx}{k}",
                              [V(-pa.x + 2 * c.x, pa.y, pa.z),
                               V(-pm.x + 2 * c.x, pm.y, pm.z),
                               V(-pb.x + 2 * c.x, pb.y, pb.z)],
                              [0.0026] * 3, CREAM, n=4, caps=("dome", "dome")))
    return pieces


def trouser_leg(sx, hip, knee, ankle):
    """Team-colour trousers from the hip ball into the boot."""
    below = lerp(knee, ankle, 0.2)
    boot_top = lerp(knee, ankle, 0.58)
    path = [hip + V(0, 0, 0.04), lerp(hip, knee, 0.33), lerp(hip, knee, 0.7),
            knee, V(below.x, below.y, below.z), V(boot_top.x, boot_top.y,
                                                  0.185)]
    radii = [0.063, 0.061, 0.054, 0.049, 0.051, 0.049]
    limb = rk.tube(f"{R}-trouser{sx}", path, radii, TEAM, n=12, up=(0, 1, 0),
                   caps=(None, None))
    kneecap = rk.ball(f"{R}-knee{sx}", 0.022, knee + V(0, 0.02, 0.004), TEAM,
                      scale=(1.2, 0.75, 1.3), seg=8, rings=5)
    # A soft bunch of cloth where the trousers tuck into the boot.
    bunch = rk.tube(f"{R}-tuck{sx}", [V(boot_top.x, boot_top.y, 0.2),
                                      V(boot_top.x, boot_top.y, 0.225)],
                    [0.056, 0.053], TEAM, n=12, caps=(None, None),
                    flute=0.06)
    return [limb, kneecap, bunch]


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    pieces = trouser_leg(sx, hip, knee, ankle)
    pieces += boot(sx, ankle, knee, toe_out)
    return pieces, hip


# ------------------------------------------------------------- skirt


def skirt_half(sx):
    """One half of the skirt: from under the belt to the hem, lapping past
    the centre front and back; the right half lies a hair outside the left
    at both seams. Lined, so it never shows a hole from below."""
    a0, a1 = -10.0 if sx > 0 else -24.0, 192.0 if sx > 0 else 186.0
    zs = [0.684, 0.66, 0.62, 0.58, 0.54, 0.5, 0.47, HEM]
    us = [i / 18 for i in range(19)]
    lift = 0.004 if sx > 0 else 0.0

    def fn(u, v):
        z = zs[int(round(v))]
        a = math.radians(lerp(a0, a1, u)) * sx
        p = skirt_point(a, z, lift)
        if z <= HEM + 1e-6:
            p.z -= 0.006 * max(0.0, -math.cos(a))
        return p

    vs = list(range(len(zs)))
    out = [rk.sheet(f"{R}-skirt{sx}", fn, us, vs, KHAKI, rim=0.005,
                    back=True, inside=V(sx * 0.03, 0, 0.56))]
    # A stitched hem line.
    pts = [skirt_point(math.radians(lerp(a0, a1, u)) * sx, HEM + 0.018,
                       lift + 0.0014) for u in us]
    out.append(rk.tube(f"{R}-hemline{sx}", pts, [0.0014] * len(pts), KHAKI,
                       n=3, caps=(None, None)))
    return out


def inner_skirt():
    """The skirt goes on, inset, round the torso: where the halves part as
    she strides the gap shows khaki, not a hole."""
    zs = [0.695, 0.66, 0.62, 0.58, 0.54, 0.5]
    n = 28
    rings = [[skirt_point(i / n * math.tau, z, -0.008) for i in range(n)]
             for z in zs]
    return rk.loft(f"{R}-innerskirt", rings, KHAKI, start=None, end=None)


# ------------------------------------------------------------- torso


def shirt():
    n = 22
    c = rk.Mesh(f"{R}-shirt", KHAKI)
    rows = []
    for z, _, _, _ in BODY:
        rows.append([c.v(body_point(i / n * math.tau, z)) for i in range(n)])
    c.grid(rows, KHAKI, closed=True)
    c.fan(rows[-1], V(0, 0, 1.02), KHAKI)
    c.fan(rows[0], V(0, 0, 0.58), KHAKI, flip=True)
    return c.obj(recalc=True)


def hips():
    """The trousers' seat under the skirt."""
    rings = []
    for z, rx_, ry_ in ((0.5, 0.06, 0.05), (0.54, 0.11, 0.085),
                        (0.58, 0.126, 0.096), (0.62, 0.124, 0.096),
                        (0.64, 0.116, 0.09)):
        rings.append([V(x, y, z) for x, y, _ in rk.sup(18, rx_, ry_, 2.3)])
    return rk.loft(f"{R}-hips", rings, TEAM, start="pole", end=None)


def belt():
    pieces = []
    n = 28
    rings = []
    for z, off in ((0.658, 0.004), (0.661, 0.0095), (0.689, 0.0095),
                   (0.692, 0.004)):
        rings.append([skirt_point(i / n * math.tau, z, off) for i in range(n)])
    pieces.append(rk.loft(f"{R}-belt", rings, LEATHER))
    c = skirt_point(0.0, 0.675, 0.012)
    frame = [c + V(x, 0.0, z) for x, z, _ in rk.sup(12, 0.02, 0.019, 3.4)]
    pieces.append(rk.tube(f"{R}-buckle", frame + [frame[0]], [0.0032] * 13,
                          BRASS, n=4, up=(0, 1, 0), caps=(None, None)))
    pieces.append(rk.tube(f"{R}-tongue", [c + V(0.0, 0.001, 0.0),
                                         c + V(-0.022, 0.001, 0.0)],
                          [0.0022] * 2, BRASS, n=4, caps=("dome", "dome")))
    return pieces


def placket():
    """Buttons down the shirt front, below the tie."""
    out = []
    pts = [body_point(0.0, z, 0.0022) for z in (0.7, 0.76, 0.82, 0.88,
                                                0.94)]
    out.append(rk.tube(f"{R}-placket", pts, [(0.009, 0.0022)] * len(pts),
                       KHAKI, n=4, up=(1, 0, 0), caps=("flat", "flat")))
    for k, z in enumerate((0.715, 0.765)):
        out.append(rk.ball(f"{R}-button{k}", 0.0055,
                           body_point(0.0, z, 0.0055), BRASS,
                           scale=(1, 0.55, 1), seg=6, rings=3))
    return out


def pockets():
    """Two flap pockets at the breast, military fashion, above the bust."""
    out = []
    for sx in (-1, 1):
        def flap(u, v, sx=sx):
            a = math.radians(sx * lerp(14, 40, u))
            z = lerp(0.892, 0.872, v) - 0.006 * math.sin(math.pi * u) * v
            return body_point(a, z, 0.004 + 0.002 * v)
        out.append(rk.sheet(f"{R}-flap{sx}", flap, [0, 0.25, 0.5, 0.75, 1],
                            [0, 0.5, 1], KHAKI, rim=0.004,
                            inside=V(0, 0, 0.88), rim_edges=("u0", "u1", "v1")))
        out.append(rk.ball(f"{R}-pbutton{sx}", 0.0045,
                           body_point(math.radians(sx * 27), 0.874, 0.0075),
                           BRASS, scale=(1, 0.6, 1), seg=6, rings=3))
    return out


def collar():
    """A pointed shirt collar turned down round the neck, its points lying
    on the chest either side of the tie's knot."""
    def col(u, v):
        a = math.radians(lerp(22, 338, u))
        s, c = math.sin(a), math.cos(a)
        front = max(0.0, c) ** 3
        r_in = V(0.052 * s, 0.05 * c, 0.992)
        r_out = V((0.098 + 0.02 * front) * s, (0.084 + 0.03 * front) * c,
                  0.964 - 0.046 * front)
        mid = lerp(r_in, r_out, 0.45) + V(0, 0, 0.01)
        if v <= 0.5:
            return lerp(r_in, mid, v * 2)
        return lerp(mid, r_out, (v - 0.5) * 2)

    return [rk.sheet(f"{R}-collar", col, [i / 18 for i in range(19)],
                     [0.0, 0.5, 1.0], KHAKI, rim=0.005, inside=V(0, 0, 0.9),
                     rim_edges=("u0", "u1", "v1"))]


def tie():
    """A team tie knotted at the throat and tucked into the shirt."""
    pieces = []
    k = V(0, body_point(0.0, 0.975).y + 0.008, 0.976)
    pieces.append(rk.ball(f"{R}-knot", 0.013, k, TEAM2,
                          scale=(1.0, 0.8, 1.1), seg=8, rings=5))

    def blade(u, v):
        z = lerp(0.966, 0.845, v)
        w = lerp(0.0105, 0.018, v) * (1 - 0.9 * smooth(0.9, 1.0, v) *
                                      abs(u))
        zz = z - 0.014 * smooth(0.8, 1.0, v) * (1 - abs(u))
        return body_point(math.atan2(u * w, 0.1), zz, 0.006)

    pieces.append(rk.sheet(f"{R}-tie", blade, [-1, -0.5, 0, 0.5, 1],
                           [0, 0.25, 0.5, 0.75, 0.9, 1.0], TEAM2, rim=0.003,
                           inside=V(0, 0, 0.9)))
    return pieces


def epaulettes():
    out = []
    for sx in (-1, 1):
        path = [V(sx * 0.06, -0.004, 1.0), V(sx * 0.1, -0.004, 0.982),
                V(sx * 0.14, -0.004, 0.958)]
        out.append(rk.tube(f"{R}-epaulette{sx}", path,
                           [(0.017, 0.006), (0.019, 0.006), (0.02, 0.0062)],
                           TEAM, n=6, up=(0, 1, 0), caps=("dome", "flat")))
        out.append(rk.ball(f"{R}-ebutton{sx}", 0.006,
                           V(sx * 0.068, -0.004, 1.002), BRASS,
                           scale=(1, 1, 0.6), seg=6, rings=3))
    return out


def cross_outline(size, bar):
    """A plus sign (CCW), arms `size` from the centre, `bar` wide."""
    s, b = size, bar / 2
    return [(b, -s), (b, -b), (s, -b), (s, b), (b, b), (b, s), (-b, s),
            (-b, b), (-s, b), (-s, -b), (-b, -b), (-b, -s)]


def satchel():
    """A big leather satchel on her right hip with a cream cross patch on
    the flap, its strap over the left shoulder, across the chest and back."""
    pieces = []
    c = V(0.215, 0.0, 0.595)
    # The bag: a soft rounded block, a little fuller at the bottom.
    bag = rk.rbox(f"{R}-bag", (0.056, 0.15, 0.13), c, LEATHER, levels=2,
                  crease=0.45)
    for v in bag.data.vertices:
        k = (c.z + 0.065 - v.co.z) / 0.13
        v.co.y = c.y + (v.co.y - c.y) * (0.94 + 0.08 * k)
    pieces.append(bag)
    # The flap over the top and the outer face.
    def flap(u, v):
        y = lerp(-0.074, 0.074, u)
        if v < 0.3:
            t = v / 0.3
            return V(lerp(0.19, 0.247, t), y, c.z + 0.07 + 0.004 *
                     math.sin(math.pi * t))
        t = (v - 0.3) / 0.7
        return V(0.2475 + 0.003 * math.sin(math.pi * t), y * (1 - 0.14 * t
                                                              ** 3),
                 c.z + 0.07 - 0.085 * t)
    pieces.append(rk.sheet(f"{R}-bagflap", flap, [i / 8 for i in range(9)],
                           [0, 0.15, 0.3, 0.55, 0.8, 1.0], LEATHER, rim=0.004,
                           inside=c))
    # The cream patch and its green cross on the flap.
    m = rk.basis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0), V(0.2515, 0.0,
                                                        c.z + 0.02))
    patch = [(math.cos(i / 16 * math.tau) * 0.034,
              math.sin(i / 16 * math.tau) * 0.034) for i in range(16)]
    pieces.append(rk.slab(f"{R}-patch", patch, 0.002, CREAM, matrix=m))
    m2 = rk.basis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0), V(0.2525, 0.0,
                                                         c.z + 0.02))
    pieces.append(rk.slab(f"{R}-bagcross", cross_outline(0.024, 0.016),
                          0.0022, CROSS, matrix=m2))
    # Buckled straps down the flap.
    for k, y in enumerate((-0.05, 0.05)):
        pieces.append(rk.tube(f"{R}-bagstrap{k}",
                              [V(0.249, y, c.z + 0.02),
                               V(0.2505, y, c.z - 0.035)],
                              [(0.0025, 0.007)] * 2, DARK, n=4,
                              up=(0, 1, 0), caps=("flat", "flat")))
        pieces.append(rk.ball(f"{R}-bagbuckle{k}", 0.006,
                              V(0.252, y, c.z - 0.028), BRASS,
                              scale=(0.5, 1.1, 1), seg=6, rings=3))
    # The strap: from the bag's front up across the chest over the left
    # shoulder and down the back to the bag.
    front = [V(0.2, 0.05, c.z + 0.06)]
    for ad, z in ((72, 0.72), (46, 0.78), (18, 0.838), (-8, 0.88),
                  (-34, 0.918), (-58, 0.946)):
        front.append(body_point(math.radians(ad), z, 0.009))
    top = [V(-0.108, 0.0, 0.99)]
    back = []
    for ad, z in ((-122, 0.946), (-150, 0.9), (-178, 0.84), (158, 0.78),
                  (126, 0.72)):
        back.append(body_point(math.radians(ad), z, 0.009))
    back.append(V(0.2, -0.05, c.z + 0.06))
    path = rk_smooth(front + top + back)
    pieces.append(rk.tube(f"{R}-strap", path, [(0.0045, 0.014)] * len(path),
                          LEATHER, n=4, up=(0, 0, 1), caps=("flat", "flat")))
    return pieces


def rk_smooth(points, samples=3):
    return kit.smooth_path(points, samples=samples)


# ------------------------------------------------------------- head

FACE_W = [(1.0, 0.026), (1.025, 0.036), (1.045, 0.046), (1.062, 0.0535),
          (1.076, 0.0585), (1.095, 0.0625), (1.12, 0.066), (1.145, 0.069),
          (1.17, 0.071), (1.2, 0.072), (1.225, 0.069), (1.245, 0.061),
          (1.26, 0.045), (1.268, 0.02)]
FACE_D = [(1.0, 0.028), (1.025, 0.038), (1.045, 0.052), (1.062, 0.064),
          (1.074, 0.07), (1.09, 0.073), (1.12, 0.076), (1.15, 0.074),
          (1.172, 0.08), (1.2, 0.081), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
FACE_P = 2.5
NOSE_H = [(1.1, 0.0), (1.107, 0.005), (1.114, 0.0125), (1.121, 0.0168),
          (1.13, 0.0152), (1.145, 0.0108), (1.16, 0.0064), (1.172, 0.003),
          (1.186, 0.0)]
NOSE_S = [(1.11, 11.5), (1.13, 8.0), (1.17, 6.0)]


def face_disp(ad, z):
    """A soft, open face: a small straight nose, full cheeks and lips, a
    rounded chin."""
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.0048 * gauss(a, 12, 5) * gauss(z, 1.113, 0.006)        # nostrils
    d -= 0.0095 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)      # sockets
    bz = 1.174 - 0.003 * gauss(a, 9, 8)
    d += 0.0052 * gauss(z, bz, 0.0065) * smooth(52, 30, a)        # brow
    d += 0.0075 * gauss(a, 46, 13) * gauss(z, 1.136, 0.012)       # cheekbone
    d += 0.004 * gauss(a, 34, 14) * gauss(z, 1.108, 0.014)        # cheeks
    d -= 0.0024 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)     # mouth
    d += 0.003 * gauss(z, 1.101, 0.0035) * gauss(ad, 0, 14)       # upper lip
    d += 0.0036 * gauss(z, 1.088, 0.004) * gauss(ad, 0, 13)       # lower lip
    d += 0.006 * gauss(z, 1.066, 0.01) * gauss(ad, 0, 17)         # chin
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
    """The hair's lower edge at angle a (degrees): a high smooth forehead,
    swept back above the ears, down to the nape."""
    return table([(0, 1.212), (22, 1.206), (42, 1.192), (58, 1.17),
                  (70, 1.148), (80, 1.15), (92, 1.178), (104, 1.16),
                  (120, 1.118), (145, 1.082), (180, 1.066)], abs(a))


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


def hair():
    """The hair as a smooth shell over the skull, fullest over the crown
    and the back, parted on her left and swept back into a low bun."""
    cols = [i * 10.0 - 180 for i in range(36)]
    ts = [0.0, 0.05, 0.14, 0.26, 0.4, 0.55, 0.7, 0.84, 0.94]
    c = rk.Mesh(f"{R}-hair", HAIR)
    grid = []
    for a in cols:
        z0 = hairline(a)
        col = []
        for t in ts:
            z = lerp(z0, 1.262, t)
            th = 0.0165 * smooth(0.0, 0.3, t) * (1 - 0.45 * smooth(0.6, 1.0, t))
            # Fuller at the back, a soft wave swept back from the part.
            th *= 0.8 + 0.35 * max(0.0, -math.cos(math.radians(a)))
            th += 0.0022 * math.sin(math.radians(a) * 6 + t * 5) * \
                smooth(0.05, 0.4, t)
            # The side part on her left.
            th -= 0.004 * gauss(a, -38, 5) * smooth(0.3, 0.7, t)
            col.append(c.v(face_point(a, z) + face_normal(a, z) *
                           (th + 0.0008)))
        grid.append(col)
    for i in range(len(cols)):
        k = (i + 1) % len(cols)
        for j in range(len(ts) - 1):
            c.face((grid[i][j], grid[k][j], grid[k][j + 1], grid[i][j + 1]))
    top = V(0, CY - 0.004, 1.268 + 0.003)
    ring = [grid[i][-1] for i in range(len(cols))]
    c.fan(ring, top)
    obj = c.obj(outward=HC)
    out = [obj]
    # The low bun, wound round with a groove.
    b = V(0, CY - 0.118, 1.103)
    out.append(rk.ball(f"{R}-bun", 1.0, b, HAIR, scale=(0.046, 0.034, 0.04),
                       seg=12, rings=8))
    wind = []
    for i in range(26):
        t = i / 25
        a = t * math.tau * 1.6
        r = lerp(0.036, 0.006, t)
        x, z = math.cos(a) * r * 1.2, math.sin(a) * r
        k = max(0.0, 1 - (x / 0.046) ** 2 - (z / 0.04) ** 2)
        wind.append(b + V(x, -0.034 * math.sqrt(k) + 0.001, z))
    out.append(rk.tube(f"{R}-bunwind", wind, [0.0042] * len(wind), HAIR,
                       n=5, caps=("dome", "dome")))
    return out


def cap():
    """A round cream cap: a stiff band hugging the hair, lower at the back,
    and a soft crown puffed a little over it, with a green cross on the
    front of the band and a bigger one on the crown."""
    pieces = []
    n = 32
    angles = [i / n * 360 for i in range(n)]

    def base(ad):
        z = 1.199 + 0.007 * math.cos(math.radians(ad))
        p = face_point(ad, z) + face_normal(ad, z) * 0.0205
        return p, z

    centre = V(0, CY - 0.004, 0)
    prof = [(0.0, 1.0), (0.028, 1.01), (0.034, 1.04), (0.047, 1.05),
            (0.063, 1.015), (0.076, 0.84), (0.083, 0.6), (0.0855, 0.3)]
    rings = []
    for dz, k in prof:
        ring = []
        for ad in angles:
            p, z = base(ad)
            q = centre + (V(p.x, p.y, 0) - centre) * k
            ring.append(V(q.x, q.y, z + dz + 0.004 * (1 - k) *
                          math.cos(math.radians(ad))))
        rings.append(ring)
    top = sum((r for r in rings[-1]), Vector()) / n
    pieces.append(rk.loft(f"{R}-cap", rings, CREAM, start=None, end=top))
    # The band's inside, so it has a thickness from below.
    inner = [rings[0], [centre + (V(p.x, p.y, 0) - centre) * 0.93 +
                        V(0, 0, p.z) for p in rings[0]],
             [centre + (V(p.x, p.y, 0) - centre) * 0.9 + V(0, 0, p.z + 0.02)
              for p in rings[0]]]
    pieces.append(rk.loft(f"{R}-caprim", inner, CREAM))
    # A piped seam where the crown meets the band.
    seam = [lerp(a, b, 0.5) for a, b in zip(rings[1], rings[2])]
    pieces.append(rk.tube(f"{R}-capseam", seam + [seam[0]], [0.0028] *
                          (n + 1), CREAM, n=4, caps=(None, None)))
    # The crosses.
    p0, z0 = base(0)
    m = rk.basis(V(1, 0, 0), V(0, 0, 1), V(0, 1, 0),
                 V(0, p0.y + 0.0015, z0 + 0.016))
    pieces.append(rk.slab(f"{R}-capcross", cross_outline(0.0145, 0.0098),
                          0.0026, CROSS, matrix=m))
    m = rk.basis(V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), top + V(0, 0, 0.0005))
    pieces.append(rk.slab(f"{R}-topcross", cross_outline(0.027, 0.017),
                          0.0022, CROSS, matrix=m))
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
    return out


def face_details():
    """Painted eyes and mouth, a flick of lashes at each outer corner and a
    soft lip colour under the mouth's line."""
    out = face_paint.eyes(rk, R, face_point, HC, z=1.1565,
                          expression="confident")
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
    lips = [(-25, zm + 0.005), (-14, zm + 0.0066), (-5, zm + 0.006),
            (0, zm + 0.005), (5, zm + 0.006), (14, zm + 0.0066),
            (25, zm + 0.0072), (18, zm - 0.009), (0, zm - 0.015),
            (-17, zm - 0.01)]
    out.append(rk.decal(f"{R}-lips", face_point, lips[::-1], 0.0029, LIP,
                        depth=0.0006, eps=0.05, ref=HC))
    return out


def neck():
    return rk.tube(f"{R}-neck", [V(0, -0.004, 0.965), V(0, 0.0, 1.04),
                                 V(0, 0.008, 1.095)],
                   [0.041, 0.04, 0.039], SKIN, n=12, caps=(None, None))


def head():
    locks = hair()
    bun, hat = locks[1:], cap()
    pieces = [skull(), locks[0]] + face_details() + ears()
    rk.transform(pieces + bun + hat, Matrix.Translation(V(0, 0, HEAD_DZ)))
    return pieces + [neck()], bun, hat


# ------------------------------------------------------------- arms


def fist(name, c, xax, kax, chir, mat=SKIN):
    """A closed fist round a pole along Z (the index finger's end), its
    fingertips toward X and knuckles toward K; the wrist at -X. A little
    slimmer than the Cowboy's."""
    zs = [-0.034, -0.027, -0.016, -0.008, 0.0, 0.008, 0.016, 0.027, 0.034]
    grooves = {-0.016, 0.0, 0.016}
    cx, cy, hx, hy = -0.0035, 0.002, 0.03, 0.025
    rings = []
    for z in zs:
        k = 1.0
        if abs(z) > 0.033:
            k = 0.74
        elif abs(z) > 0.026:
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
    pieces = [rk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.036),
                      end=V(cx, cy, 0.037))]
    thumb = [V(-0.022, -0.018, 0.015), V(-0.008, -0.025, 0.029),
             V(0.01, -0.02, 0.035)]
    pieces.append(rk.tube(f"{name}-thumb", thumb, [0.009, 0.008, 0.0072],
                          mat, n=6))
    pieces.append(rk.tube(f"{name}-heel", [V(-0.044, 0.002, -0.004),
                                           V(-0.028, 0.0, 0.0)],
                          [(0.02, 0.025), (0.023, 0.028)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = rk.basis(xax, kax, zax, c)
    rk.transform(pieces, m)
    return pieces


def upper_arm(side, s, e, sx):
    """The khaki sleeve rolled up above the elbow, the bare arm below."""
    pieces = []
    up = (e - s).normalized()
    roll = lerp(s, e, 0.62)
    pieces.append(rk.ball(f"{R}-shoulder{side}", 1.0, s + V(sx * 0.004, 0,
                                                           -0.02),
                          KHAKI, scale=(0.05, 0.052, 0.044), seg=10, rings=6))
    pieces.append(rk.tube(f"{R}-sleeve{side}", [s + up * 0.004,
                                               lerp(s, e, 0.3),
                                               roll - up * 0.01],
                          [0.05, 0.049, 0.046], KHAKI, n=12,
                          caps=(None, None)))
    # The rolled cuff: a fat soft band with a fold line.
    pieces.append(rk.tube(f"{R}-roll{side}", [roll - up * 0.024,
                                             roll + up * 0.006],
                          [0.051, 0.05], KHAKI, n=12, caps=(None, None),
                          flute=0.03))
    pieces.append(rk.tube(f"{R}-arm{side}", [roll - up * 0.01, e],
                          [0.036, 0.033], SKIN, n=10, caps=(None, None)))
    pieces.append(rk.ball(f"{R}-elbow{side}", 0.0335, e, SKIN, seg=10,
                          rings=6))
    return pieces


def forearm(side, e, w, xax):
    fo = (w - e).normalized()
    return [rk.tube(f"{R}-fore{side}", [e, lerp(e, w, 0.45), w + fo * 0.012],
                    [0.032, 0.03, 0.022], SKIN, n=10, caps=(None, None))]


def armband(s, e):
    """A cream band with a green cross round the left upper arm."""
    up = (e - s).normalized()
    c = lerp(s, e, 0.3)
    pieces = [rk.tube(f"{R}-armband", [c - up * 0.024, c + up * 0.024],
                      [0.0525, 0.0515], CREAM, n=14, caps=(None, None))]
    out = V(-1, 0.25, 0).normalized()
    out = (out - up * out.dot(up)).normalized()
    m = rk.look(out, -up, c + out * 0.0515)
    pieces.append(rk.slab(f"{R}-armcross", cross_outline(0.019, 0.012),
                          0.0022, CROSS, matrix=m))
    return pieces


def build_arm_r():
    s, e, c = S_R, E_R, C_R
    xax = (c - e)
    up = V(0, 0, 1)
    xax = (xax - up * xax.dot(up)).normalized()
    kax = xax.cross(up)
    w = c - (c - e).normalized() * WRIST_FIST
    upper = upper_arm("R", s, e, 1)
    lower = forearm("R", e, w, xax)
    lower += fist(f"{R}-handR", c, xax, kax, -1)
    return upper, lower, e, c


def build_arm_l():
    s, e, c = S_L, E_L, C_L
    d = V(0, 1, 0)
    xax = (c - e)
    xax = (xax - d * xax.dot(d)).normalized()
    kax = d.cross(xax)
    w = c - (c - e).normalized() * WRIST_FIST
    upper = upper_arm("L", s, e, -1) + armband(s, e)
    lower = forearm("L", e, w, xax) + fist(f"{R}-handL", c, xax, kax, 1)
    return upper, lower, e


# ------------------------------------------------------------- the flask


def flask():
    """A round tonic flask of glowing green, gripped at its foot: the bulb
    over the fist, a short neck with a brass collar and a cork."""
    c = C_R
    P = []
    P.append(rk.tube(f"{R}-foot", [c + V(0, 0, -0.03), c + V(0, 0, 0.03)],
                     [0.013, 0.015], GLOW, n=10, caps=("flat", None)))
    b = c + V(0, 0, 0.074)
    P.append(rk.ball(f"{R}-bulb", 1.0, b, GLOW, scale=(0.045, 0.045, 0.043),
                     seg=16, rings=10))
    P.append(rk.tube(f"{R}-neck", [b + V(0, 0, 0.03), b + V(0, 0, 0.066)],
                     [0.015, 0.0135], GLOW, n=10, caps=(None, None)))
    P.append(rk.tube(f"{R}-collar", [b + V(0, 0, 0.056), b + V(0, 0, 0.068)],
                     [0.0172, 0.0172], BRASS, n=10, caps=("flat", "flat")))
    P.append(rk.tube(f"{R}-cork", [b + V(0, 0, 0.066), b + V(0, 0, 0.088)],
                     [0.0135, 0.0152], LEATHER, n=10, caps=(None, "flat")))
    # A cream label with a green cross, facing forward.
    m = rk.basis(V(1, 0, 0), V(0, 0, 1), V(0, 1, 0), b + V(0, 0.0445, 0.0))
    label = [(math.cos(i / 14 * math.tau) * 0.02,
              math.sin(i / 14 * math.tau) * 0.017) for i in range(14)]
    lab = rk.slab(f"{R}-label", label, 0.002, CREAM, matrix=m)
    P.append(lab)
    m = rk.basis(V(1, 0, 0), V(0, 0, 1), V(0, 1, 0), b + V(0, 0.0468, 0.0))
    P.append(rk.slab(f"{R}-labelcross", cross_outline(0.012, 0.0075), 0.0018,
                     CROSS, matrix=m))
    return P


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    return rk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="medic"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.088, 0.018, 0.36), V(-0.096, 0.026, 0.085), 11),
            ("R", 1, V(0.088, 0.012, 0.36), V(0.098, 0.018, 0.085), 8)):
        pieces, hip = leg(sx, knee, ankle, out)
        part(f"leg{side}", pieces, hip, root)

    torso = [shirt(), hips(), inner_skirt()] + belt() + placket() + \
        pockets() + collar() + tie() + epaulettes() + satchel()
    torso_obj = part("torso", torso, WAIST, root)
    part("skirtL", skirt_half(-1), V(0, 0, SKIRT_PIVOT_Z), torso_obj)
    part("skirtR", skirt_half(1), V(0, 0, SKIRT_PIVOT_Z), torso_obj)
    face, bun, hat = head()
    head_obj = face_rig.head(rk.part, R, face, NECK, torso_obj, angle=62)
    part("hair", bun, V(0, CY - 0.1, 1.11 + HEAD_DZ), head_obj, angle=62)
    part("hat", hat, V(0, CY - 0.004, 1.2 + HEAD_DZ), head_obj, angle=62)

    upper, lower, e, c = build_arm_r()
    arm_r = part("armR", upper, S_R, torso_obj)
    fore_r = part("foreR", lower, e, arm_r)
    part("weapon", flask(), c, fore_r, angle=40)
    upper, lower, e = build_arm_l()
    arm_l = part("armL", upper, S_L, torso_obj)
    part("foreL", lower, e, arm_l)

    # Knees and ankles here (figures.py leaves a leg alone once it has
    # them), so the posed previews can bend them.
    articulation.legs(root, R)
    report(root)
    pose = os.environ.get("MEDIC_POSE")
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


# Mirrors moves/medic.ts.
SWING, ARM_SWING, SKIRT_FOLLOW = 0.6, 0.34, 0.62


def stride(cycle):
    hl, kl, al, fl = walking_leg(cycle, SWING)
    hr, kr, ar, fr = walking_leg(cycle + 0.5, SWING)
    return {"legL": (hl, 0, 0), "kneeL": (kl, 0, 0), "footL": (al, 0, 0),
            "legR": (hr, 0, 0), "kneeR": (kr, 0, 0), "footR": (ar, 0, 0),
            "skirtL": (hl * SKIRT_FOLLOW, 0, 0),
            "skirtR": (hr * SKIRT_FOLLOW, 0, 0),
            "armL": (fr * ARM_SWING, 0, 0), "armR": (fl * ARM_SWING * 0.3,
                                                      0, 0)}


# The heal pulse at its height (moves/medic.ts): the flask held up and
# forward over her head, kept upright in the fist.
PULSE = {"armR": (1.75, 0, 0.14), "foreR": (-0.9, 0, 0),
         "weapon": (-0.85, 0, 0), "head": (0.16, 0, 0),
         "torso": (0.05, 0, 0), "armL": (0.12, 0, -0.18)}

POSES = {
    "pulse": PULSE,
    "walkA": stride(0.78),
    "walkB": stride(0.08),
    "pulsewalk": {**stride(0.78), **PULSE},
}


def report(root):
    print("MEDIC joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:18s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {rk.tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("MEDIC materials", len(mats), mats)
