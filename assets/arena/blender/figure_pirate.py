"""The Pirate (figure id `pirate`) as a collector's miniature: a swaggering
Afro-Caribbean pirate captain of the golden age of sail, hand-painted resin.

A black felt tricorne trimmed with gold braid over a team-colour bandana
knotted at the back; a long black braid down her back; a gold hoop in her
right ear; a loose white shirt with the sleeves rolled to the elbows; a
dark team-colour waistcoat with gold buttons and trim whose skirts flare
over the hips; a striped sash wound round the waist with a flintlock pistol
tucked in it; brown breeches and black knee boots with wide turned-down
cuffs; a broad curved cutlass with a brass shell guard in her right fist.

Parts (troops.ts has the contract), none with a rest rotation:

  pirate           root at the feet, facing +y
    legL, legR     pivots on the hips (figures.py splits knees and ankles)
    torso          pivot at the waist: shirt, waistcoat, sash, pistol
      skirtL/R     the waistcoat's skirts, pivots at the waist over each
                   hip, so they trail the legs instead of swinging rigidly
      head         pivot at the neck: face, bandana, tricorne, earring
        tail       the braid, pivot at the nape, so it can hang and sway
      armL, armR   pivots on the shoulders (one line along x)
        foreL/R    elbows: forearm and fist
          weapon   the cutlass, child of foreR, pivot in the right fist

PIRATE_POSE=<name> turns the parts as the game would (three.js Euler
terms, see figure_pirate_kit.runtime_quat) before the previews: `wind` and
`strike` the forehand slash, `back` the backhand, `walk`/`walk2` mid-stride,
`dash` the crouched lunge of her leap, `idle` a hand on the hip.
"""

import math
import os

import kit
import face_paint
import face_rig
import figure_pirate_kit as pk
from figure_pirate_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

R = "pirate"
T = kit.tint

# ------------------------------------------------------------- paints

SKIN = "resin:" + T("pirate-skin", "#8a5436")
HAIR = "hide:" + T("pirate-hair", "#211816")
FELT = "weave:" + T("pirate-felt", "#26242c")
GOLD = "gilt:" + T("pirate-gold", "#d9a94a")
SHIRT = "weave:" + T("pirate-shirt", "#f2eadb")
VEST = "weave:team2"
TEAM = "weave:team"
BREECH = "weave:" + T("pirate-breeches", "#5a4334")
BOOT = "hide:" + T("pirate-boot", "#2a201c")
STEEL = "gilt:" + T("pirate-steel", "#b9c1ca")
WOOD = "wood:" + T("pirate-wood", "#6e3c22")
LIPS = "resin:" + T("pirate-lips", "#7c3934")
LINING = "hide:" + T("pirate-lining", "#7a5236")

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.08, 0.63
WAIST = V(0, 0, 0.68)
SH_X, SH_Z = 0.158, 0.975
S_L = V(-SH_X, 0, SH_Z)
S_R = V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.035)
UPPER, FORE = 0.235, 0.212
WRIST_FIST = 0.04

HC = V(0, 0.012, 1.162)
CY = 0.012

# The cutlass: its rod (grip to point) and the right fist round the grip.
BLADE = V(0.3, 0.84, -0.46).normalized()
GRIP = V(0.215, 0.15, 0.625)
# The left fist, loose at her side.
LEFT = V(-0.228, 0.055, 0.54)
LEFT_ROD = V(0.15, 1.0, -0.1).normalized()

# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the shirt under everything.
BODY = [(0.575, 0.126, 0.094, 0.104), (0.64, 0.124, 0.092, 0.098),
        (0.70, 0.116, 0.088, 0.09), (0.78, 0.128, 0.1, 0.092),
        (0.85, 0.143, 0.118, 0.098), (0.92, 0.151, 0.11, 0.1),
        (0.962, 0.146, 0.097, 0.096), (0.998, 0.1, 0.07, 0.07),
        (1.03, 0.05, 0.046, 0.048)]
BODY_P = 2.3


def section(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def ring_point(rows, power, a, z, extra=0.0):
    """A point on a superellipse section at angle a (0 = front, toward +x
    at 90 degrees) and height z."""
    rx_, ryf, ryb = section(rows, z)
    e = 2.0 / power
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


def body_point(a, z, extra=0.0):
    return ring_point(BODY, BODY_P, a, z, extra)


# The waistcoat's skirts: from under the sash, flaring clear of the thighs.
SKIRT = [(0.44, 0.19, 0.152, 0.168), (0.5, 0.176, 0.14, 0.152),
         (0.56, 0.16, 0.124, 0.136), (0.6, 0.148, 0.112, 0.124),
         (0.63, 0.14, 0.106, 0.116)]
SKIRT_P = 2.2
SEAM = 0.625
HEM = 0.445


def skirt_edge(z):
    """The front edge of the right skirt, degrees from the front."""
    return lerp(15.0, 1.5, smooth(HEM, SEAM, z))


def skirt_point(a, z, extra=0.0):
    p = ring_point(SKIRT, SKIRT_P, a, z, extra)
    # Soft pipe folds deepening toward the hem, strongest at the back.
    k = smooth(0.6, HEM, z) * (0.4 + 0.6 * max(0.0, -math.cos(a)))
    n = V(math.sin(a), math.cos(a), 0)
    return p + n * 0.007 * k * math.sin(9 * a + 0.4)


# ------------------------------------------------------------- legs


def boot(sx, ankle, knee, toe_out):
    """A knee boot: a square-ish toe, a low heel and a wide turned-down
    bucket cuff below the knee."""
    pieces = []
    foot = [(-0.062, 0.026, 0.0, 0.062), (-0.052, 0.038, 0.0, 0.084),
            (-0.028, 0.043, 0.0, 0.09), (0.012, 0.045, 0.0, 0.078),
            (0.052, 0.045, 0.0, 0.062), (0.092, 0.041, 0.0, 0.05),
            (0.124, 0.034, 0.0, 0.042), (0.142, 0.022, 0.004, 0.036)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in pk.sup(10, rx_, (zt - zb) / 2, 2.6, math.pi / 10):
            ring.append(V(x, y, (zb + zt) / 2 + z))
        rings.append(ring)
    pieces.append(pk.loft(f"{R}-foot{sx}", rings, BOOT,
                          start=V(0, -0.066, 0.042), end=V(0, 0.148, 0.02)))
    heel = []
    for z, s in ((0.0, 0.86), (0.014, 0.94), (0.026, 1.0)):
        heel.append([V(x * s, -0.043 + y * s, z) for x, y, _ in
                     pk.sup(8, 0.032, 0.027, 2.6)])
    pieces.append(pk.loft(f"{R}-heel{sx}", heel, HAIR, start="flat",
                          end="flat"))
    # A brass buckle on a strap over the instep.
    strap = []
    for k in range(9):
        t = k / 8 * math.pi
        strap.append(V(math.cos(t) * 0.047, 0.03 + math.sin(t) * 0.004,
                       0.012 + math.sin(t) * 0.058))
    pieces.append(pk.tube(f"{R}-bstrap{sx}", strap, [(0.0035, 0.009)] * 9,
                          HAIR, n=4, up=(0, 1, 0), caps=(None, None)))
    bk = V(0.0, 0.052, 0.068)
    frame = [bk + V(x, 0, z) for x, z, _ in pk.sup(8, 0.013, 0.011, 3.4)]
    pieces.append(pk.tube(f"{R}-bbuckle{sx}", frame + [frame[0]],
                          [0.0028] * 9, GOLD, n=4, up=(0, 1, 0),
                          caps=(None, None)))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    pk.transform(pieces, place)

    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    n = 16
    shaft = []
    for z, r in ((0.04, 0.042), (0.1, 0.043), (0.16, 0.047), (0.2, 0.051),
                 (0.24, 0.054)):
        c = on_leg(z)
        shaft.append([V(c.x + math.sin(i / n * math.tau) * r,
                        c.y + math.cos(i / n * math.tau) * r * 1.04, z)
                      for i in range(n)])
    pieces.append(pk.loft(f"{R}-shaft{sx}", shaft, BOOT))
    # The bucket cuff, turned down over the shaft and flaring at its top,
    # higher at the front over the knee; its lighter lining shows inside.
    prof = [(0.228, 0.057, 0.0), (0.242, 0.064, 0.0), (0.275, 0.073, 0.01),
            (0.31, 0.083, 0.018), (0.336, 0.091, 0.026)]

    def cuff(u, v):
        z, r, lip = prof[int(round(v))]
        a = math.radians(u)
        c = on_leg(z)
        zz = z + lip * max(0.0, math.cos(a)) ** 2
        return V(c.x + math.sin(a) * r, c.y + math.cos(a) * r * 1.04, zz)

    pieces.append(pk.sheet(f"{R}-cuff{sx}", cuff, [i * 360 / n for i in
                                                   range(n)],
                           list(range(len(prof))), LINING, rim=0.006,
                           closed_u=True, back=True, rim_mat=LINING,
                           inside=on_leg(0.25)))
    return pieces


def breeches(sx, hip, knee, ankle):
    """Brown breeches from the hip, gathered into the boot cuffs."""
    below = lerp(knee, ankle, 0.14)
    path = [hip + V(-sx * 0.014, 0, 0.022), lerp(hip, knee, 0.3),
            lerp(hip, knee, 0.7), knee, V(below.x, below.y, 0.3)]
    radii = [0.056, 0.063, 0.057, 0.053, 0.052]
    limb = pk.tube(f"{R}-breech{sx}", path, radii, BREECH, n=14,
                   up=(0, 1, 0), caps=(None, None))
    kneecap = pk.ball(f"{R}-knee{sx}", 0.03, knee + V(0, 0.026, 0.004),
                      BREECH, scale=(1.2, 0.72, 1.25), seg=8, rings=5)
    return [limb, kneecap]


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    return breeches(sx, hip, knee, ankle) + boot(sx, ankle, knee, toe_out), hip


# ------------------------------------------------------------- torso


def shirt():
    n = 22
    c = pk.Mesh(f"{R}-shirt", SHIRT)
    rows = []
    for z, _, _, _ in BODY:
        rows.append([c.v(body_point(i / n * math.tau, z)) for i in range(n)])
    c.grid(rows, SHIRT, closed=True)
    c.fan(rows[-1], V(0, 0, 1.045), SHIRT)
    c.fan(rows[0], V(0, 0, 0.56), SHIRT, flip=True)
    return c.obj(recalc=True)


def shirt_v(z):
    """The open shirt's neckline (degrees from the front)."""
    return lerp(0.0, 28.0, smooth(0.862, 1.0, z) ** 0.9)


def collar():
    """Skin in the open shirt's V, and the shirt's collar points folded
    out over the waistcoat either side of it."""
    def skin(u, v):
        z = lerp(0.878, 1.03, v)
        a = math.radians(u * (shirt_v(z) - 0.5))
        return body_point(a, z, 0.0016)

    out = [pk.sheet(f"{R}-chest", skin, [i / 4 - 1 for i in range(9)],
                    [i / 6 for i in range(7)], SKIN, inside=V(0, 0, 0.95))]
    for side in (1, -1):
        def flap(u, v, side=side):
            z = lerp(0.9, 1.02, u)
            w = 15.0 * smooth(0.9, 1.0, z)
            a = math.radians(shirt_v(z) + v * w)
            p = vest_point(a, z, 0.004 + 0.002 * v)
            return V(side * p.x, p.y, p.z)
        out.append(pk.sheet(f"{R}-collar{side}", flap,
                            [i / 6 for i in range(7)], [0, 0.5, 1], SHIRT,
                            rim=0.004, inside=V(0, 0, 0.94),
                            rim_edges=("u0", "v1")))
    return out


def vest_edge(z):
    """The waistcoat's front edge (degrees): closed to the chest, then a
    deep V to the shoulders."""
    if z < 0.79:
        return 0.0
    return lerp(0.0, 46.0, smooth(0.79, 1.0, z) ** 0.85)


VEST_ZS = [0.54, 0.6, SEAM, 0.66, 0.7, 0.75, 0.79, 0.83, 0.87, 0.91, 0.94,
           0.965, 0.985, 0.997]


def vest_point(a, z, extra=0.0):
    return body_point(a, z, 0.0075 + extra + 0.0015 * math.sin(3 * a))


def waistcoat():
    """The upper waistcoat: two halves meeting down the front below a deep
    V and at a seam down the back, over the shoulders to the neck."""
    pieces = []
    us = [i / 10 for i in range(11)]
    for side in (1, -1):
        lap = 1.2 if side > 0 else -0.6

        def fn(u, v, side=side, lap=lap):
            z = VEST_ZS[int(round(v))]
            a0 = vest_edge(z) + lap
            a = math.radians(lerp(a0, 180.0, u))
            inset = -0.004 * smooth(SEAM, SEAM - 0.02, z)
            p = vest_point(a, z, inset + (0.0008 if side > 0 else 0.0))
            return V(side * p.x, p.y, p.z)

        pieces.append(pk.sheet(f"{R}-vest{side}", fn, us,
                               list(range(len(VEST_ZS))), VEST, rim=0.005,
                               inside=V(0, 0, 0.8), rim_edges=("u0", "v1")))
        # Gold braid down the front edge and round the V to the neck.
        pts = []
        for k in range(12):
            z = lerp(0.6, 0.994, k / 11)
            a = math.radians(vest_edge(z) + lap + 1.2)
            p = vest_point(a, z, 0.0035)
            pts.append(V(side * p.x, p.y, p.z))
        pieces.append(pk.tube(f"{R}-vtrim{side}", pts, [0.0042] * 12, GOLD,
                              n=5, caps=(None, None)))
    for k, z in enumerate((0.785, 0.745, 0.705)):
        p = vest_point(math.radians(-2.6), z, 0.006)
        pieces.append(pk.ball(f"{R}-button{k}", 0.0075, p, GOLD,
                              scale=(1, 0.6, 1), seg=8, rings=4))
    return pieces


def hips():
    """The breeches' seat under the waistcoat skirts."""
    rings = []
    for z, rx_, ry_ in ((0.52, 0.066, 0.056), (0.55, 0.108, 0.086),
                        (0.6, 0.118, 0.092), (0.64, 0.114, 0.088),
                        (0.66, 0.108, 0.084)):
        rings.append([V(x, y, z) for x, y, _ in pk.sup(18, rx_, ry_, 2.3)])
    return pk.loft(f"{R}-hips", rings, BREECH, start="pole", end=None)


SASH_ZS = [0.598, 0.606, 0.622, 0.638, 0.654, 0.67, 0.684, 0.69]


def sash_point(a, z, extra=0.0):
    swell = 0.004 * math.sin(math.pi * (z - 0.598) / 0.092)
    return vest_point(a, z, 0.006 + swell + extra)


def sash():
    """The sash wound twice round the waist in team-colour and cream
    stripes, knotted on the left hip."""
    pieces = []
    n = 28
    rings = [[sash_point(i / n * math.tau, z) for i in range(n)]
             for z in SASH_ZS]
    # Tuck the top and bottom edges in, so the wrap sits proud.
    rings[0] = [sash_point(i / n * math.tau, SASH_ZS[0], -0.006)
                for i in range(n)]
    rings[-1] = [sash_point(i / n * math.tau, SASH_ZS[-1], -0.006)
                 for i in range(n)]
    stripe = {1: SHIRT, 3: SHIRT, 5: SHIRT}
    pieces.append(pk.loft(f"{R}-sash", rings, TEAM, bands=stripe))
    # The knot on the left hip.
    a = math.radians(-58)
    k = sash_point(a, 0.638, 0.012)
    pieces.append(pk.ball(f"{R}-sknot", 0.022, k, TEAM,
                          scale=(1.0, 0.8, 1.05), seg=10, rings=6))
    return pieces


def sash_ends():
    """The knot's two striped ends, hanging over the left skirt (they
    swing with it)."""
    out = []
    a = math.radians(-58)
    k = sash_point(a, 0.63, 0.016)
    out_dir = V(math.sin(a), math.cos(a), 0)
    for j, (da, length, tw) in enumerate(((-9, 0.15, 0.03), (8, 0.12, -0.02))):
        pts = []
        for i in range(6):
            t = i / 5
            aa = a + math.radians(da * t)
            z = 0.63 - length * t
            base = skirt_point(aa, max(HEM, z), 0.013 + 0.004 * j)
            pts.append(lerp(k, base, smooth(0, 0.35, t)) + V(0, 0, 0) +
                       out_dir * 0.002 * math.sin(3 * t))
        out.append(pk.tube(f"{R}-send{j}", pts,
                           [(0.004, 0.02 - 0.004 * t) for t in
                            (0, 0.2, 0.4, 0.6, 0.8, 1.0)],
                           TEAM, n=6, up=out_dir, caps=(None, "dome"),
                           bands={2: SHIRT, 4: SHIRT}))
    return out


def pistol():
    """A flintlock tucked through the sash at the front: the barrel hidden
    behind the wrap, the lock and its cock above it, and the walnut grip
    curving out to a big brass butt cap."""
    pieces = []
    base = sash_point(math.radians(-14), 0.682, -0.002)
    ax = V(0.25, 0.1, 0.96).normalized()        # up the lock
    out = V(0, 1, 0) - ax * ax.y
    out.normalize()
    rt = ax.cross(out)                            # toward her right
    pieces.append(pk.tube(f"{R}-pbarrel", [base - ax * 0.022 - out * 0.004,
                                           base + out * 0.002],
                          [0.0085, 0.0095], STEEL, n=8,
                          caps=("flat", None)))
    lock = base + ax * 0.026 + out * 0.008
    pieces.append(pk.rbox(f"{R}-plock", (0.024, 0.016, 0.04), V(0, 0, 0),
                          STEEL, levels=1, crease=0.6,
                          matrix=pk.basis(rt, out, ax, lock)))
    cock = [lock + ax * 0.006 + out * 0.008 - rt * 0.004,
            lock + ax * 0.02 + out * 0.018 - rt * 0.008,
            lock + ax * 0.028 + out * 0.012 - rt * 0.01]
    pieces.append(pk.tube(f"{R}-pcock", cock, [(0.0035, 0.006)] * 3, STEEL,
                          n=4, up=rt, caps=(None, "dome")))
    grip = [lock + ax * 0.004, lock + ax * 0.034 + rt * 0.005,
            lock + ax * 0.058 + rt * 0.022, lock + ax * 0.072 + rt * 0.048]
    pieces.append(pk.tube(f"{R}-pgrip", grip,
                          [(0.0135, 0.016), (0.0145, 0.017), (0.016, 0.019),
                           (0.019, 0.021)], WOOD, n=8, up=out,
                          caps=(None, None)))
    tip = grip[-1] + (grip[-1] - grip[-2]).normalized() * 0.006
    pieces.append(pk.ball(f"{R}-pcap", 1.0, V(0, 0, 0), GOLD,
                          scale=(0.022, 0.024, 0.014), seg=10, rings=6))
    pk.transform([pieces[-1]], pk.look((grip[-1] - grip[-2]).normalized(),
                                       out, tip))
    guard = [lock - ax * 0.006 + out * 0.004, lock - ax * 0.002 - out * 0.018,
             lock + ax * 0.018 - out * 0.016]
    pieces.append(pk.tube(f"{R}-pguard", guard, [0.0026] * 3, GOLD, n=4,
                          caps=("dome", "dome")))
    return pieces


# ------------------------------------------------------------- skirts


def skirt(sx):
    """One skirt of the waistcoat: from the seam under the sash round from
    the front edge to the back vent, flaring toward a gold-trimmed hem."""
    zs = [SEAM, 0.59, 0.55, 0.51, 0.48, HEM]
    us = [i / 11 for i in range(12)]

    def fn(u, v, inset=0.0):
        z = zs[int(round(v))]
        a0 = skirt_edge(z)
        a = math.radians(lerp(a0, 182.0 if sx > 0 else 180.0, u))
        dz = 0.0
        if z <= HEM + 1e-6:
            # The hem rises a little at the front corner.
            dz = 0.018 * (1 - smooth(0, 0.3, u)) - 0.006 * smooth(0.6, 1, u)
        p = skirt_point(a, z, -inset + (0.0016 if sx > 0 else 0.0)) + \
            V(0, 0, dz)
        return V(sx * p.x, p.y, p.z)

    vs = list(range(len(zs)))
    out = [pk.sheet(f"{R}-skirt{sx}", fn, us, vs, VEST, rim=0.005,
                    back=True, inside=V(sx * 0.02, 0, 0.55))]
    # Gold braid down the front edge and along the hem.
    edge = [fn(0.0, v, -0.004) for v in vs]
    hem = [fn(u, len(zs) - 1, -0.004) for u in us]
    out.append(pk.tube(f"{R}-strim{sx}", edge + hem[1:], [0.0042] *
                       (len(edge) + len(hem) - 1), GOLD, n=5,
                       caps=(None, None)))
    # A pocket flap with a gold button on the hip.

    def flap(u, v):
        a = math.radians(lerp(38, 82, u))
        z = lerp(0.575, 0.545, v) - 0.006 * math.sin(math.pi * u) * v
        p = skirt_point(a, z, 0.006 + 0.002 * v)
        return V(sx * p.x, p.y, p.z)

    out.append(pk.sheet(f"{R}-pocket{sx}", flap, [0, 0.25, 0.5, 0.75, 1],
                        [0, 0.5, 1], VEST, rim=0.004,
                        inside=V(0, 0, 0.56), rim_edges=("u0", "u1", "v1")))
    p = flap(0.5, 0.75)
    out.append(pk.ball(f"{R}-pbutton{sx}", 0.007, p + V(sx * 0.003, 0.002, 0),
                       GOLD, scale=(1, 1, 1), seg=8, rings=4))
    return out


# ------------------------------------------------------------- head
# A woman's face on the Cowboy's head space (figure_ranger.py): a narrower
# jaw and chin, high cheekbones, a broad soft nose, full lips.

FACE_W = [(1.0, 0.022), (1.025, 0.033), (1.045, 0.045), (1.062, 0.052),
          (1.076, 0.057), (1.095, 0.0615), (1.12, 0.0655), (1.145, 0.0695),
          (1.17, 0.0715), (1.2, 0.0725), (1.225, 0.07), (1.245, 0.062),
          (1.26, 0.046), (1.268, 0.02)]
FACE_D = [(1.0, 0.028), (1.025, 0.039), (1.045, 0.053), (1.062, 0.064),
          (1.074, 0.07), (1.09, 0.073), (1.12, 0.076), (1.15, 0.074),
          (1.172, 0.079), (1.2, 0.08), (1.225, 0.075), (1.245, 0.065),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.034), (1.04, 0.05), (1.07, 0.072), (1.1, 0.089),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
NOSE_H = [(1.1, 0.0), (1.107, 0.0055), (1.114, 0.0135), (1.121, 0.0175),
          (1.13, 0.015), (1.145, 0.0105), (1.16, 0.0062), (1.172, 0.003),
          (1.186, 0.0)]
NOSE_S = [(1.11, 12.5), (1.13, 8.5), (1.17, 6.0)]


def face_disp(ad, z):
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.0055 * gauss(a, 12.5, 5) * gauss(z, 1.115, 0.006)      # nostrils
    d -= 0.0105 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)      # sockets
    d += 0.0055 * gauss(z, 1.174, 0.0065) * smooth(52, 30, a)     # brow
    d += 0.0085 * gauss(a, 45, 12) * gauss(z, 1.136, 0.011)       # cheekbone
    d -= 0.0045 * gauss(a, 40, 12) * gauss(z, 1.101, 0.013)       # hollow
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.0034 * gauss(z, 1.103, 0.0038) * gauss(ad, 0, 15)      # upper lip
    d += 0.0042 * gauss(z, 1.087, 0.0038) * gauss(ad, 0, 13)      # lower lip
    d += 0.0065 * gauss(z, 1.064, 0.011) * gauss(ad, 0, 17)       # chin
    d += 0.0022 * gauss(a, 66, 12) * gauss(z, 1.07, 0.014)        # jaw
    return d


HEAD = pk.Head(FACE_W, FACE_D, BACK_D, 2.5, face_disp, CY, HC)
FACE_A = [0, 3, 6, 9.5, 13.5, 17.5, 22, 27, 33, 40, 48, 58, 70, 84, 100, 124,
          152]
FACE_Z = [1.012, 1.025, 1.038, 1.05, 1.062, 1.072, 1.081, 1.088, 1.094, 1.1,
          1.106, 1.112, 1.118, 1.125, 1.133, 1.141, 1.149, 1.157, 1.165,
          1.173, 1.182, 1.193, 1.215, 1.245]


def hairline(a):
    """Where skin gives way to hair: in front of the ears, up over them,
    down to the nape."""
    return table([(58, 1.19), (64, 1.15), (72, 1.118), (82, 1.114),
                  (86, 1.17), (100, 1.174), (116, 1.128), (140, 1.078),
                  (180, 1.068)], abs(a))


def skull():
    cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
    cols = [a for a in cols if a > -180]

    def mat(a, z):
        return SKIN

    return HEAD.skull(f"{R}-face", cols, FACE_Z, mat, V(0, CY - 0.005, 1.268),
                      levels=0)


def face():
    k = pk
    out = face_paint.eyes(k, R, HEAD.point, HC, z=1.1565,
                          expression="confident")
    out += face_paint.mouth(k, R, HEAD.point, HC, expression="confident")
    z = 1.1565
    for side in (-1, 1):
        ac = side * 27
        # Lashes: a flick off each outer corner.
        lash = [(ac + side * 11.5, z + 0.0085), (ac + side * 21.5, z + 0.0195),
                (ac + side * 19.0, z + 0.0085), (ac + side * 15.5, z + 0.002)]
        if side < 0:
            lash = lash[::-1]
        out.append(k.decal(f"{R}-lash{side}", HEAD.point, lash, 0.0052,
                           face_paint.INK, depth=0.001, eps=0.05, ref=HC))
    # A rich lip colour under the painted mouth.
    zl = 1.0965
    lips = [(-19, zl + 0.003), (-8, zl - 0.004), (0, zl - 0.0065),
            (8, zl - 0.004), (19, zl + 0.004), (12, zl - 0.012),
            (0, zl - 0.0155), (-12, zl - 0.012)]
    out.append(k.decal(f"{R}-lips", HEAD.point, lips, 0.0028, LIPS,
                       depth=0.0005, eps=0.05, ref=HC))
    return out


def ears():
    out = []
    for sx in (-1, 1):
        p = HEAD.point(sx * 90, 1.142) + V(sx * 0.004, -0.008, 0)
        e = pk.ball(f"{R}-ear{sx}", 1.0, V(0, 0, 0), SKIN,
                    scale=(0.008, 0.019, 0.027), seg=8, rings=5)
        m = Matrix.Translation(p) @ Matrix.Rotation(math.radians(-sx * 14),
                                                    4, "Z") @ \
            Matrix.Rotation(math.radians(-10), 4, "X")
        pk.transform([e], m)
        out.append(e)
    # A gold hoop in the right ear.
    lobe = HEAD.point(90, 1.121) + V(0.011, -0.01, 0)
    hoop = pk.ring_path(lobe + V(0.002, 0, -0.019), V(1, 0.15, 0), 0.02, n=16,
                        up=(0, 0, 1))
    out.append(pk.tube(f"{R}-hoop", hoop, [0.0034] * len(hoop), GOLD, n=5,
                       caps=(None, None)))
    return out


def neck():
    return pk.tube(f"{R}-neck", [V(0, -0.004, 0.96), V(0, 0.0, 1.03),
                                 V(0, 0.008, 1.07)],
                   [0.041, 0.04, 0.039], SKIN, n=12, caps=(None, None))


def bandana_bottom(a):
    return table([(0, 1.199), (36, 1.203), (62, 1.184), (86, 1.176),
                  (110, 1.16), (150, 1.135), (180, 1.126)], abs(a))


def bandana():
    """The team-colour bandana over the whole crown, its rolled lower edge
    across the forehead and over the ears, knotted at the nape with two
    tails."""
    cols = [i * 12.0 - 180 for i in range(30)]
    pieces = [HEAD.shell(f"{R}-bandana", TEAM, cols, bandana_bottom,
                         lambda a: 1.262,
                         lambda a, t: 0.0045 + 0.0035 * (1 - t) ** 6 +
                         0.0012 * math.sin(a * 0.21 + t * 9),
                         rows=7, closed=True)]
    knot = HEAD.point(180, 1.132) + V(0, -0.012, 0)
    pieces.append(pk.ball(f"{R}-bknot", 0.017, knot, TEAM,
                          scale=(1.2, 0.8, 0.9), seg=10, rings=6))
    for j, (dx, dz) in enumerate(((-0.03, -0.075), (0.02, -0.06))):
        pts = [knot + V(dx * t + 0.004 * math.sin(t * 5), -0.01 * t -
                        0.004 * math.sin(math.pi * t), dz * t)
               for t in (0.0, 0.35, 0.7, 1.0)]
        pieces.append(pk.tube(f"{R}-btail{j}", pts,
                              [(0.004, 0.012), (0.004, 0.014), (0.0035, 0.013),
                               (0.003, 0.009)], TEAM, n=6, up=(0, 1, 0),
                              caps=(None, "dome")))
    return pieces


def braid():
    """The long braid: a rope of alternating lobes from the nape down the
    back, tied off with a team-colour ribbon and a tuft. Its own part
    (`tail`), pivoting at the nape."""
    path = [V(0, -0.097, 1.098), V(0.0, -0.122, 1.04), V(0.003, -0.138, 0.98),
            V(0.008, -0.142, 0.92), V(0.013, -0.14, 0.86),
            V(0.017, -0.136, 0.8), V(0.02, -0.132, 0.76)]
    pts = kit.smooth_path([tuple(p) for p in path], samples=6)
    pts = [V(p) for p in pts]
    # Resample evenly.
    lengths = [0.0]
    for a, b in zip(pts, pts[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]

    def at(s):
        for i in range(len(lengths) - 1):
            if lengths[i + 1] >= s:
                t = (s - lengths[i]) / max(1e-9, lengths[i + 1] - lengths[i])
                return lerp(pts[i], pts[i + 1], t), (pts[i + 1] - pts[i])
        return pts[-1], pts[-1] - pts[-2]

    out = []
    step = 0.027
    n = int((total - 0.03) / step)
    for k in range(n):
        s = 0.012 + k * step
        c, d = at(s)
        d.normalize()
        r = lerp(0.0205, 0.0145, k / max(1, n - 1))
        side = d.cross(V(0, 1, 0)).normalized()
        tilt = side * (1 if k % 2 else -1) * 0.45
        axis = (d + tilt).normalized()
        lobe = pk.ball(f"{R}-lobe{k}", 1.0, V(0, 0, 0), HAIR,
                       scale=(r * 0.95, r * 0.85, r * 1.25), seg=7, rings=4)
        m = pk.look(axis, V(0, -1, 0), c + side * (1 if k % 2 else -1) *
                    r * 0.28)
        pk.transform([lobe], m)
        out.append(lobe)
    end, d = at(total - 0.02)
    d.normalize()
    out.append(pk.tube(f"{R}-tie", [end - d * 0.007, end + d * 0.007],
                       [0.0115, 0.0115], TEAM, n=8, caps=(None, None)))
    out.append(pk.tube(f"{R}-tuft", [end, end + d * 0.022, end + d * 0.04],
                       [0.011, 0.012, 0.004], HAIR, n=8, caps=(None, None)))
    return out


# The tricorne, in head space: sitting on the bandana, tipped forward.
HAT_Z = 1.203
HAT_TILT = math.radians(-13)
CROWN = (0.088, 0.103, -0.008)   # base half-width, half-depth, centre y


def tricorne_top(a_deg):
    """Plan radius and height of the brim's upturned edge at an angle: a
    rounded triangle with a point at the front and two at the back."""
    phi = math.radians(((a_deg - 60) % 120) - 60)
    r1 = 0.124 / max(0.2, math.cos(phi))
    r2 = 0.208
    k = 7
    r = (r1 ** -k + r2 ** -k) ** (-1 / k)
    corner = smooth(0.13, 0.2, r)
    z = HAT_Z + lerp(0.084, 0.036, corner)
    return r, z, corner


def tricorne():
    pieces = []
    rx, ry, cy = CROWN
    n = 28
    prof = [(HAT_Z - 0.008, 1.0), (HAT_Z + 0.03, 0.99), (HAT_Z + 0.066, 0.95),
            (HAT_Z + 0.092, 0.84), (HAT_Z + 0.108, 0.64),
            (HAT_Z + 0.115, 0.36)]
    rings = []
    for z, s in prof:
        rings.append([V(rx * s * spow(math.sin(i / n * math.tau), 0.9),
                        cy + ry * s * spow(math.cos(i / n * math.tau), 0.9), z)
                      for i in range(n)])
    pieces.append(pk.loft(f"{R}-crown", rings, FELT, start=None,
                          end=V(0, cy, HAT_Z + 0.118)))
    # The brim, turned up hard into three walls between the points.
    us = [i * 360 / 36 for i in range(36)]
    ts = [0.0, 0.26, 0.52, 0.76, 1.0]

    def brim(u, v):
        a = math.radians(u)
        s, c = math.sin(a), math.cos(a)
        inner = V(rx * spow(s, 0.9), cy + ry * spow(c, 0.9), HAT_Z - 0.004)
        r, zt, corner = tricorne_top(u)
        dirn = V(s, c, 0)
        out = V(dirn.x * r, cy + dirn.y * r, zt)
        ctrl = V(dirn.x * (r - 0.006), cy + dirn.y * (r - 0.006),
                 HAT_Z - 0.008)
        t = ts[int(round(v))]
        p = inner * (1 - t) ** 2 + ctrl * 2 * t * (1 - t) + out * t * t
        return p

    pieces.append(pk.sheet(f"{R}-brim", brim, us, list(range(len(ts))), FELT,
                           rim=0.005, closed_u=True, back=True,
                           inside=V(0, cy, HAT_Z + 0.3)))
    edge = [brim(u, len(ts) - 1) for u in us]
    pieces.append(pk.tube(f"{R}-braid", edge + [edge[0]], [0.0048] *
                          (len(edge) + 1), GOLD, n=4, caps=(None, None)))
    tilt = Matrix.Translation(V(0, 0, HAT_Z)) @ \
        Matrix.Rotation(-HAT_TILT, 4, "X") @ \
        Matrix.Rotation(math.radians(4), 4, "Y") @ \
        Matrix.Translation(V(0, 0, -HAT_Z))
    pk.transform(pieces, tilt)
    return pieces


def hair():
    """Close-cropped hair from the temples round the back of the head, its
    edge smooth, tucked up under the bandana."""
    cols = [58 + i * 8.0 for i in range(31)]
    return HEAD.shell(f"{R}-hair", HAIR, cols,
                      lambda a: hairline(a if a <= 180 else a - 360),
                      lambda a: bandana_bottom(a if a <= 180 else a - 360)
                      + 0.012,
                      lambda a, t: 0.0022 + 0.0012 * t, rows=4)


def head():
    return [skull(), neck(), hair()] + face() + ears() + bandana()


# ------------------------------------------------------------- arms


def arm_pose(s, c, rod, pole):
    e0 = pk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    w, xax = pk.hand_frame(e0, c, rod, WRIST_FIST)
    e = pk.ik(s, w, UPPER, FORE, pole)
    return e, w, xax


def upper_arm(side, s, e, sx):
    """The shirt's full sleeve from the shoulder, rolled up just above the
    elbow; a skin elbow ball fills the joint."""
    pieces = []
    up = (e - s).normalized()
    roll = e - up * 0.028
    path = [s + up * 0.028, lerp(s, roll, 0.35), lerp(s, roll, 0.75),
            roll]
    tube = pk.tube(f"{R}-sleeve{side}", path, [0.047, 0.051, 0.048, 0.044],
                   SHIRT, n=12, caps=(None, None))
    # A few soft folds.
    for v in tube.data.vertices:
        p = v.co
        k = smooth(0.0, 0.12, (p - s).length)
        axial = (p - s).dot(up)
        v.co = p + (p - (s + up * axial)).normalized() * 0.003 * k * \
            math.sin(axial * 70 + math.atan2(p.x, p.y) * 3)
    pieces.append(tube)
    pieces.append(pk.ball(f"{R}-shoulder{side}", 1.0, s + V(sx * 0.005, 0,
                                                           -0.008),
                          SHIRT, scale=(0.052, 0.055, 0.05), seg=12,
                          rings=8))
    # The rolled cuff: a fat soft ring.
    pieces.append(pk.tube(f"{R}-roll{side}", [roll - up * 0.016,
                                             roll + up * 0.006,
                                             roll + up * 0.02],
                          [0.046, 0.052, 0.047], SHIRT, n=12,
                          caps=(None, None)))
    pieces.append(pk.ball(f"{R}-elbow{side}", 0.0345, e, SKIN, seg=10,
                          rings=6))
    return pieces


def forearm(side, e, w, c, xax, rod, right):
    fo = (w - e).normalized()
    pieces = [pk.tube(f"{R}-forearm{side}",
                      [e - fo * 0.02, lerp(e, w, 0.4), w + fo * 0.004],
                      [0.034, 0.033, 0.027], SKIN, n=10, caps=(None, None))]
    pieces += pk.fist(f"{R}-hand{side}", c, xax, rod, right, SKIN)
    return pieces


# ------------------------------------------------------------- the cutlass


def cutlass():
    """A broad, curved cutlass in its own frame (x toward the edge, y
    through the grip to the point, z the flat's normal), the grip's middle
    at the origin: a brass shell guard and knuckle bow, a walnut grip, a
    ball pommel."""
    P = []
    # The blade outline in (x, y): the edge bows forward, the back curves
    # down to a clipped point.
    L0, L1 = 0.052, 0.4
    edge, spine = [], []
    for i in range(13):
        t = i / 12
        y = lerp(L0, L1, t)
        bow = -0.05 * t ** 2
        w = lerp(0.016, 0.024, smooth(0, 0.8, t))
        edge.append((bow + w, y))
        spine.append((bow - 0.013 - 0.004 * t, y))
    # The clipped point: the back slopes forward to meet the edge.
    tip = (edge[-1][0] + 0.004, L1 + 0.03)
    spine[-1] = (spine[-1][0] + 0.022, L1 - 0.012)
    spine[-2] = (spine[-2][0] + 0.006, spine[-2][1])
    outline = edge + [tip] + spine[::-1]
    # Counter-clockwise for slab().
    area = sum(outline[i][0] * outline[(i + 1) % len(outline)][1] -
               outline[(i + 1) % len(outline)][0] * outline[i][1]
               for i in range(len(outline)))
    if area < 0:
        outline = outline[::-1]
    th = 0.0075
    P.append(pk.slab(f"{R}-blade", outline, th, STEEL,
                     matrix=Matrix.Translation(V(0, 0, -th / 2)),
                     bevel=0.0022))
    # The shell guard: a dished oval plate across the blade's root.
    shell = []
    for dy, s in ((0.038, 0.8), (0.043, 1.0), (0.049, 0.96), (0.052, 0.7)):
        shell.append([V(0.008 + x * s, dy + 0.004 * (x / 0.04) ** 2, z * s)
                      for x, z, _ in pk.sup(14, 0.04, 0.03, 2.2)])
    P.append(pk.loft(f"{R}-shell", shell, GOLD, start="flat", end="flat"))
    # The knuckle bow from the guard round the fingers to the pommel.
    bow = [V(0.044, 0.044, 0), V(0.058, 0.02, 0), V(0.06, -0.012, 0),
           V(0.05, -0.04, 0), V(0.026, -0.056, 0), V(0.006, -0.058, 0)]
    P.append(pk.tube(f"{R}-bow", kit.smooth_path([tuple(p) for p in bow], 3),
                     [0.0045] * 16, GOLD, n=6, caps=("dome", "dome")))
    P.append(pk.tube(f"{R}-grip", [V(0, -0.052, 0), V(0, 0.0, 0),
                                   V(0, 0.04, 0)],
                     [0.0115, 0.0125, 0.012], WOOD, n=8, caps=(None, None)))
    P.append(pk.ball(f"{R}-pommel", 0.0125, V(0, -0.056, 0), GOLD,
                     scale=(1, 0.85, 1), seg=10, rings=6))
    return P


def cutlass_frame(xax):
    """The cutlass's frame at rest in the right fist: y along the rod, x
    toward the edge (the fist's knuckles, away from the wrist)."""
    y = BLADE
    x = (xax - y * xax.dot(y)).normalized()
    z = x.cross(y)
    return pk.basis(x, y, z, GRIP)


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("PIRATE_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LRTrueFals")
            tally[key] = tally.get(key, 0) + pk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return pk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="pirate"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.094, 0.026, 0.36), V(-0.108, 0.036, 0.085), 16),
            ("R", 1, V(0.09, -0.014, 0.36), V(0.104, -0.024, 0.085), 9)):
        pieces, hip = leg(sx, knee, ankle, out)
        part(f"leg{side}", pieces, hip, root)

    torso = [shirt(), hips()] + collar() + waistcoat() + sash() + pistol()
    torso_obj = part("torso", torso, WAIST, root)
    for side, sx in (("L", -1), ("R", 1)):
        pieces = skirt(sx) + (sash_ends() if sx < 0 else [])
        part(f"skirt{side}", pieces, V(sx * HIP_X, 0.0, 0.655), torso_obj)
    head_obj = face_rig.head(pk.part, R, head(), NECK, torso_obj, angle=62)
    part("hat", tricorne(), V(0, CY - 0.006, 1.22), head_obj, angle=62)
    # The braid is a chain, not one rigid stick: each lobe belongs to the
    # section above it, and the ribbon follows the final link.
    sections = [[], [], []]
    for obj in braid():
        loc = sum((obj.matrix_world @ v.co for v in obj.data.vertices),
                  Vector()) / len(obj.data.vertices)
        sections[0 if loc.z > 0.995 else 1 if loc.z > 0.87 else 2].append(obj)
    par = head_obj
    for name, pieces, pivot in zip(
            ("tail", "tail2", "tail3"), sections,
            (V(0, -0.1, 1.1), V(0.002, -0.134, 0.995),
             V(0.012, -0.14, 0.87))):
        par = part(name, pieces, pivot, par, angle=70)

    e_r, w_r, x_r = arm_pose(S_R, GRIP, BLADE, S_R + V(0.55, -0.45, -0.35))
    arm_r = part("armR", upper_arm("R", S_R, e_r, 1), S_R, torso_obj)
    fore_r = part("foreR", forearm("R", e_r, w_r, GRIP, x_r, BLADE, True),
                  e_r, arm_r)
    blade = cutlass()
    pk.transform(blade, cutlass_frame(x_r))
    part("weapon", blade, GRIP, fore_r, angle=40)

    e_l, w_l, x_l = arm_pose(S_L, LEFT, LEFT_ROD, S_L + V(-0.25, -1.0, -0.2))
    arm_l = part("armL", upper_arm("L", S_L, e_l, -1), S_L, torso_obj)
    part("foreL", forearm("L", e_l, w_l, LEFT, x_l, LEFT_ROD, False), e_l,
         arm_l)

    report(root)
    pose = os.environ.get("PIRATE_POSE")
    if pose in POSES:
        pk.pose_root(root, R, POSES[pose])
    return root


# Poses in three.js Euler terms (x, y about the vertical, z), as troops.ts
# and moves/pirate.ts set them (the torso's x there is its negated bend).
POSES = {
    # The forehand: wind-up high by the right ear, then the cut.
    "wind": {"armR": (0.6, 0, 1.5), "foreR": (1.4, 0, 0),
             "weapon": (0.3, 0, 0), "torso": (0.06, -0.38, 0),
             "head": (-0.05, 0.27, 0), "armL": (0.35, 0, -0.3),
             "foreL": (0.6, 0, 0), "skirtL": (-0.08, 0, 0),
             "skirtR": (-0.08, 0, 0)},
    "strike": {"armR": (1.15, 0, -0.3), "foreR": (0.05, 0, 0),
               "weapon": (-0.6, 0, 0), "torso": (-0.2, 0.4, 0),
               "head": (0.05, -0.28, 0), "armL": (-0.2, 0, -0.3),
               "foreL": (0.6, 0, 0), "skirtL": (0.26, 0, 0),
               "skirtR": (0.26, 0, 0)},
    # The backhand: from the left shoulder, a flat sweep out right.
    "back": {"armR": (0.9, 0, -0.7), "foreR": (1.5, 0, 0),
             "weapon": (0.2, 0, 0), "torso": (0.0, 0.4, 0),
             "head": (-0.05, -0.28, 0), "armL": (0.35, 0, -0.3),
             "foreL": (0.6, 0, 0)},
    "backhit": {"armR": (1.3, 0, 0.7), "foreR": (0.1, 0, 0),
                "weapon": (-0.1, 0, 0), "torso": (-0.15, -0.35, 0),
                "head": (0.05, 0.25, 0), "armL": (0.25, 0, -0.3),
                "foreL": (0.6, 0, 0), "skirtL": (0.21, 0, 0),
                "skirtR": (0.21, 0, 0)},
    # Mid-stride (the left leg forward), the skirts trailing the thighs.
    "walk": {"legL": (0.55, 0, 0), "kneeL": (-0.25, 0, 0),
             "footL": (-0.3, 0, 0), "legR": (-0.42, 0, 0),
             "kneeR": (-0.05, 0, 0), "footR": (0.45, 0, 0),
             "armR": (-0.3, 0, 0), "armL": (0.35, 0, 0),
             "foreR": (0.0, 0, 0), "foreL": (0.24, 0, 0),
             "skirtL": (0.34, 0, 0), "skirtR": (-0.26, 0, 0),
             "torso": (-0.04, 0.06, 0), "tail": (0.02, 0, 0)},
    # The recovering leg lifted high through the pass.
    "walk2": {"legL": (-0.2, 0, 0), "kneeL": (-0.05, 0, 0),
              "footL": (0.25, 0, 0), "legR": (0.62, 0, 0),
              "kneeR": (-0.95, 0, 0), "footR": (0.33, 0, 0),
              "armR": (0.1, 0, 0), "armL": (-0.1, 0, 0),
              "skirtL": (-0.12, 0, 0), "skirtR": (0.38, 0, 0),
              "torso": (-0.04, -0.03, 0)},
    # The leap: legs split, crouched forward, blade raised.
    "dash": {"legL": (0.95, 0, 0), "kneeL": (-1.1, 0, 0),
             "footL": (0.2, 0, 0), "legR": (-0.6, 0, 0),
             "kneeR": (-0.5, 0, 0), "footR": (0.5, 0, 0),
             "torso": (-0.35, -0.2, 0), "head": (0.25, 0.0, 0),
             "armR": (1.45, 0, 0.3), "foreR": (0.5, 0, 0),
             "weapon": (0.3, 0, 0), "armL": (-0.8, 0, -0.4),
             "foreL": (0.3, 0, 0), "skirtL": (1.06, 0, 0),
             "skirtR": (0.1, 0, 0), "tail": (-0.29, 0, 0)},
    # Waiting: the left fist on her hip.
    "idle": {"armL": (0.12, 0, -0.62), "foreL": (0.45, 0, 1.25),
             "head": (0, 0.1, 0)},
}


def report(root):
    print("PIRATE joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {pk.tris(o)}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("PIRATE materials", len(mats), mats)
