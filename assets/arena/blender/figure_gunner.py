"""The Gunner (figure id `gunner`) as a collector's miniature: a veteran
Napoleonic foot artilleryman in hand-painted resin, pushing a small bronze
field gun in front of him.

A tall black felt shako with a leather peak, a brass lozenge plate, brass
chin scales, a team-colour cockade and a tall team-colour plume; big grey
mutton-chop sideburns meeting a grey moustache; a short dark coatee with a
team-colour standing collar, cuffs and fringed epaulettes, a
row of brass buttons and a white cross belt to a black cartridge box on the
right hip; white trousers, black buttoned gaiters and black shoes. Both
fists hold the push bar of the gun: a bronze barrel with a muzzle swell,
reinforcing rings and a cascabel knob on a dark-wood carriage with iron
fittings, two push rails and a few round shot, riding on two big wooden
spoked wheels with iron tyres.

Parts (figures.py has the contract), none with a rest rotation:

  gunner          root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split by
                  articulation.py)
    torso         pivot at the waist, sculpted leaning into the push
      head        pivot at the neck, the shako on it
      armL, armR  pivots on the shoulders, fists closed on the push bar
    offhand       the gun carriage, rails and push bar, pivot on the axle;
                  a child of the root so the body's twist never moves it
      extra       the barrel, pivot on the trunnions (+x raises the muzzle)
      wheels      both wheels, pivot on the axle (turn about x to roll)

The wheels' radius is WHEEL_R (0.17 figure units). GUNNER_POSE=<name>
turns the parts as the game would (three.js Euler terms, see
figure_gunner_kit.runtime_quat) before the previews.
"""

import math
import os

import kit
import face_paint
import face_rig
import figure_gunner_kit as gk
from figure_gunner_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

G = "gunner"
T = kit.tint

# ------------------------------------------------------------- paints

SKIN = "resin:" + T("gunner-skin", "#e2a582")
CHOPS = "resin:" + T("gunner-chops", "#b3aca3")      # sideburns, hair
JACKET = "weave:" + T("gunner-jacket", "#2c3140")
TEAM = "weave:team"                                  # collar, cuffs, plume
WHITE = "weave:" + T("gunner-white", "#ece6d8")      # trousers, cross belt
BLACK = "hide:" + T("gunner-black", "#22242a")       # shako, gaiters, shoes
BRASS = "gilt:" + T("gunner-brass", "#c9a04e")
BRONZE = "gilt:" + T("gunner-bronze", "#b87a3c")
WOOD = "wood:" + T("gunner-wood", "#6b4127")
IRON = "gilt:" + T("gunner-iron", "#3f4249")
BROW = "resin:" + T("gunner-brow", "#6d6760")

HAIR = CHOPS

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.085, 0.63
WAIST = V(0, 0, 0.68)
SH_X, SH_Z = 0.172, 0.985
NECK0 = V(0, 0.0, 1.04)
UPPER, FORE = 0.25, 0.225
WRIST_FIST = 0.04
# The upper body is sculpted leaning into the push, about the waist.
LEAN = math.radians(11)
LEAN_M = (Matrix.Translation(WAIST) @ Matrix.Rotation(-LEAN, 4, "X") @
          Matrix.Translation(-WAIST))


def leaned(p):
    return LEAN_M @ Vector(p)


S_L = leaned(V(-SH_X, 0, SH_Z))
S_R = leaned(V(SH_X, 0, SH_Z))
NECK = leaned(NECK0)

# The head is sculpted in the Cowboy's head space and lifted onto the neck.
HEAD_DZ = 0.006
HC = V(0, 0.012, 1.162)
CY = 0.012

# ------------------------------------------------------------- the gun

WHEEL_R = 0.17
AXLE = V(0, 0.6, WHEEL_R)
WHEEL_X = 0.215
TRUNNION = V(0, 0.6, 0.305)
BAR_Y, BAR_Z = 0.35, 0.64
GRIP_X = 0.145

# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the body under the coatee.
BODY = [(0.575, 0.126, 0.097, 0.1), (0.64, 0.13, 0.1, 0.098),
        (0.70, 0.136, 0.104, 0.098), (0.78, 0.148, 0.112, 0.1),
        (0.86, 0.157, 0.118, 0.103), (0.92, 0.161, 0.12, 0.105),
        (0.965, 0.154, 0.106, 0.099), (1.0, 0.108, 0.078, 0.074),
        (1.035, 0.056, 0.052, 0.052)]
BODY_P = 2.3


def section(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def body_point(a, z, extra=0.0):
    """A point on the body at angle a (0 = front, toward +x at 90 deg)."""
    rx_, ryf, ryb = section(BODY, z)
    e = 2.0 / BODY_P
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


# The coatee: snug and short, cut square across the waist.
COAT_OFF = 0.012


def hem_z(a):
    """The coatee's lower edge: level at the front, a little lower at the
    back."""
    back = max(0.0, -math.cos(a))
    return 0.606 - 0.012 * back ** 1.5


def coat_point(a, z, extra=0.0):
    p = body_point(a, z, COAT_OFF + extra)
    # A soft chest and a hint of the waist seam.
    p += V(math.sin(a), math.cos(a), 0) * 0.004 * gauss(z, 0.86, 0.06)
    return p


# ------------------------------------------------------------- legs


# The gaiter's rings (z, radius): it stops just under the knee joint.
GAITER = [(0.035, 0.05), (0.07, 0.047), (0.12, 0.044), (0.2, 0.049),
          (0.27, 0.054), (0.315, 0.056), (0.335, 0.057)]


def shoe_and_gaiter(sx, ankle, knee, toe_out):
    """A black buckled shoe and a black gaiter buttoned up the outside to
    just under the knee."""
    pieces = []
    foot = [(-0.062, 0.026, 0.0, 0.058), (-0.05, 0.037, 0.0, 0.078),
            (-0.025, 0.043, 0.0, 0.086), (0.01, 0.045, 0.0, 0.074),
            (0.05, 0.043, 0.0, 0.058), (0.088, 0.037, 0.0, 0.046),
            (0.118, 0.027, 0.002, 0.037), (0.138, 0.014, 0.006, 0.03)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in gk.sup(10, rx_, (zt - zb) / 2, 2.6, math.pi / 10):
            ring.append(V(x, y, (zb + zt) / 2 + z))
        rings.append(ring)
    pieces.append(gk.loft(f"{G}-shoe{sx}", rings, BLACK,
                          start=V(0, -0.066, 0.03), end=V(0, 0.144, 0.019)))
    # The brass buckle on the instep.
    pieces.append(gk.rbox(f"{G}-buckle{sx}", (0.036, 0.012, 0.022),
                          V(0, 0.07, 0.062), BRASS, levels=1, crease=0.6,
                          matrix=Matrix.Translation(V(0, 0.07, 0.056)) @
                          Matrix.Rotation(math.radians(-30), 4, "X")))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    gk.transform(pieces, place)

    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    # The gaiter: flared over the shoe, snug up the shin, a scalloped top
    # a little higher at the front.
    n = 14
    shaft = []
    for z, r in GAITER:
        c = on_leg(z)
        ring = []
        for i in range(n):
            a = i / n * math.tau
            zz = z + (0.014 * max(0.0, math.cos(a)) if z >= GAITER[-1][0]
                      else 0.0)
            # A spat that reaches forward over the instep at the bottom.
            fwd = 0.02 * max(0.0, math.cos(a)) ** 2 * smooth(0.08, 0.035, z)
            ring.append(V(c.x + math.sin(a) * r,
                          c.y + math.cos(a) * (r * 1.05 + fwd), zz))
        shaft.append(ring)
    pieces.append(gk.loft(f"{G}-gaiter{sx}", shaft, BLACK))
    # The buttons up the outside and the strap under the instep.
    for k in range(5):
        z = lerp(0.07, GAITER[-1][0] - 0.03, k / 4)
        c = on_leg(z)
        r = table(GAITER, z)
        a = math.radians(sx * 78)
        p = V(c.x + math.sin(a) * (r + 0.002), c.y + math.cos(a) * r, z)
        pieces.append(gk.ball(f"{G}-gbutton{sx}{k}", 0.0068, p, BRASS,
                              scale=(1, 1, 1), seg=6, rings=3))
    return pieces


def trouser_leg(sx, hip, knee, ankle):
    """White trousers from the hip ball, tucked into the gaiter."""
    path = [hip + V(0, 0, 0.035), lerp(hip, knee, 0.33), lerp(hip, knee, 0.7),
            knee, lerp(knee, ankle, 0.12)]
    radii = [0.072, 0.068, 0.058, 0.052, 0.05]
    limb = gk.tube(f"{G}-trouser{sx}", path, radii, WHITE, n=12,
                   up=(0, 1, 0), caps=(None, None))
    return [limb]


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    pieces = trouser_leg(sx, hip, knee, ankle)
    pieces += shoe_and_gaiter(sx, ankle, knee, toe_out)
    return pieces, hip


# ------------------------------------------------------------- torso


def hips():
    """The trousers' seat and fall front under the coatee's hem."""
    rings = []
    for z, rx_, ry_ in ((0.52, 0.07, 0.06), (0.56, 0.12, 0.094),
                        (0.6, 0.133, 0.103), (0.63, 0.136, 0.105),
                        (0.645, 0.13, 0.1)):
        rings.append([V(x, y, z) for x, y, _ in gk.sup(18, rx_, ry_, 2.3)])
    return gk.loft(f"{G}-hips", rings, WHITE, start="pole", end=None)


def coatee():
    """The coatee's body from the hem to the collar, closed down the front."""
    n = 28
    zs = [0.0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.32, 0.37, 0.4, 0.43]
    c = gk.Mesh(f"{G}-coatee", JACKET)
    rows = []
    for k, t in enumerate(zs):
        row = []
        for i in range(n):
            a = i / n * math.tau
            z0 = hem_z(a)
            z = lerp(z0, 1.03, t / 0.43)
            p = coat_point(a, z)
            # The shoulders round off into the collar.
            row.append(c.v(p))
        rows.append(row)
    c.grid(rows, JACKET, closed=True)
    c.fan(rows[-1], V(0, 0, 1.045), JACKET)
    return c.obj(outward=V(0, 0, 0.8))


def front_trim():
    """Brass buttons down the closed front, the team collar and the black
    stock at the throat."""
    pieces = []
    for k, z in enumerate((0.965, 0.915, 0.865, 0.815, 0.765, 0.715, 0.665)):
        p = coat_point(0.0, z, 0.004)
        pieces.append(gk.ball(f"{G}-button{k}", 0.0085, p, BRASS,
                              scale=(1, 0.55, 1), seg=8, rings=4))
    # The standing collar: team colour, open at the throat.
    n = 22
    rings = []
    for z, r in ((0.995, 0.074), (1.02, 0.07), (1.056, 0.064),
                 (1.062, 0.061)):
        ring = []
        for i in range(n + 1):
            a = math.radians(lerp(22, 338, i / n))
            ring.append(V(math.sin(a) * r * 1.05, -0.006 + math.cos(a) * r, z))
        rings.append(ring)
    c = gk.Mesh(f"{G}-collar", TEAM)
    vs = [[c.v(p) for p in r] for r in rings]
    c.grid(vs, TEAM)
    inner = [[c.v(V(p.x * 0.88, (p.y + 0.006) * 0.88 - 0.006, p.z))
              for p in rings[-1]]]
    c.grid([vs[-1], inner[0]], TEAM)
    pieces.append(c.obj(outward=V(0, -0.006, 1.02)))
    pieces.append(gk.tube(f"{G}-stock", [V(0, 0.0, 1.0), V(0, 0.004, 1.05)],
                          [0.05, 0.047], BLACK, n=12, caps=(None, None)))
    return pieces


def cross_belt():
    """A white belt from the left shoulder across the chest to the right
    hip, a brass plate where it crosses the chest, and the black cartridge
    box it carries on the right hip."""
    pieces = []
    # The path round the body: (angle deg, z) front then back.
    front = [(-62, 1.0), (-44, 0.955), (-22, 0.885), (0, 0.815), (24, 0.745),
             (48, 0.685), (70, 0.64), (90, 0.615)]
    back = [(-118, 1.0), (-140, 0.945), (-162, 0.875), (180, 0.805),
            (158, 0.735), (134, 0.675), (110, 0.63), (90, 0.615)]
    for k, path in enumerate((front, back)):
        pts = [coat_point(math.radians(a), z, 0.0065) for a, z in path]
        pts = [V(p) for p in kit.smooth_path(pts, samples=3)]

        def fn(u, v, pts=pts):
            i = int(round(v))
            p = pts[i]
            a = pts[max(0, i - 1)]
            b = pts[min(len(pts) - 1, i + 1)]
            d = (b - a).normalized()
            out = V(p.x, p.y, 0).normalized()
            side = d.cross(out).normalized()
            return p + side * u * 0.021
        pieces.append(gk.sheet(f"{G}-belt{k}", fn, [-1, 0, 1],
                               list(range(len(pts))), WHITE, rim=0.004,
                               inside=V(0, 0, 0.8)))
    # Over the shoulder.
    top = [coat_point(math.radians(-62), 1.0, 0.0065),
           V(-0.13, -0.004, 1.022), coat_point(math.radians(-118), 1.0,
                                               0.0065)]
    pieces.append(gk.tube(f"{G}-beltshoulder", top, [(0.021, 0.005)] * 3,
                          WHITE, n=6, up=(0, 0, 1), caps=(None, None)))
    # The brass plate on the chest.
    c = coat_point(math.radians(-24), 0.89, 0.011)
    nrm = V(math.sin(math.radians(-24)), math.cos(math.radians(-24)), 0.1)
    m = gk.look(nrm, (0.4, 0, 1), c)
    pieces.append(gk.slab(f"{G}-plate", [(x, y) for x, y, _ in
                                          gk.sup(12, 0.022, 0.017, 2.6)],
                          0.004, BRASS, matrix=m))
    # The cartridge box on the right hip, behind.
    a = math.radians(128)
    c = coat_point(a, 0.585, 0.03)
    m = gk.look(V(math.sin(a), math.cos(a), 0), (0, 0, 1), c)
    pieces.append(gk.rbox(f"{G}-pouch", (0.1, 0.07, 0.045), V(0, 0, 0),
                          BLACK, levels=2, crease=0.8, matrix=m))
    pieces.append(gk.rbox(f"{G}-pouchbadge", (0.03, 0.03, 0.006), V(0, 0, 0),
                          BRASS, levels=1, crease=0.6,
                          matrix=m @ Matrix.Translation(V(0, 0.0, 0.024))))
    return pieces


def epaulette(sx):
    """A team-colour epaulette: a rounded pad on the shoulder and a short
    thick fringe round its outer end."""
    pieces = []
    s = V(sx * SH_X, 0, SH_Z)
    pad = []
    for k in range(7):
        t = k / 6
        pad.append(V(sx * lerp(0.07, SH_X + 0.03, t), -0.006,
                     SH_Z + 0.052 - 0.028 * t * t))
    pieces.append(gk.tube(f"{G}-epstrap{sx}", pad,
                          [(0.022 + 0.018 * (k / 6) ** 2, 0.008)
                           for k in range(7)],
                          TEAM, n=8, up=(0, 0, 1), caps=("dome", None)))
    # The crescent: a ring round the pad's end.
    c = V(sx * (SH_X + 0.03), -0.006, SH_Z + 0.022)
    ring = [c + V(sx * 0.004 * math.cos(a), 0.043 * math.sin(a),
                  0.012 * math.cos(a)) for a in
            (i / 12 * math.tau for i in range(12))]
    pieces.append(gk.tube(f"{G}-crescent{sx}", ring + [ring[0]], [0.008] * 13,
                          BRASS, n=5, caps=(None, None)))
    # The fringe: fat bullion twists hanging from the crescent.
    for k in range(9):
        a = math.radians(lerp(-80, 80, k / 8))
        p = c + V(sx * 0.016 * math.cos(a), 0.04 * math.sin(a), -0.004)
        q = p + V(sx * 0.028, 0.004 * math.sin(a), -0.035)
        pieces.append(gk.tube(f"{G}-fringe{sx}{k}", [p, q], [0.0068, 0.0058],
                              TEAM, n=5, caps=(None, "dome")))
    return pieces


# ------------------------------------------------------------- head
# The face follows the Cowboy's sculpt (figure_ranger.py), without the
# stubble, with a softer jaw and a friendlier brow.

FACE_W = [(1.0, 0.03), (1.025, 0.041), (1.045, 0.051), (1.062, 0.0575),
          (1.076, 0.0615), (1.095, 0.064), (1.12, 0.0665), (1.145, 0.07),
          (1.17, 0.072), (1.2, 0.073), (1.225, 0.07), (1.245, 0.062),
          (1.26, 0.046), (1.268, 0.02)]
FACE_D = [(1.0, 0.03), (1.025, 0.04), (1.045, 0.055), (1.062, 0.067),
          (1.074, 0.072), (1.09, 0.074), (1.12, 0.077), (1.15, 0.074),
          (1.172, 0.081), (1.2, 0.082), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
FACE_P = 2.5
NOSE_H = [(1.1, 0.0), (1.107, 0.007), (1.114, 0.019), (1.121, 0.025),
          (1.13, 0.022), (1.145, 0.0155), (1.16, 0.009), (1.172, 0.004),
          (1.186, 0.0)]
NOSE_S = [(1.11, 12.0), (1.13, 9.0), (1.17, 6.0)]


def face_disp(ad, z):
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.006 * gauss(a, 12.5, 5) * gauss(z, 1.116, 0.006)       # nostrils
    d -= 0.011 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)       # sockets
    bz = 1.173 - 0.003 * gauss(a, 9, 8)
    d += 0.0075 * gauss(z, bz, 0.0065) * smooth(52, 30, a)        # brow
    d += 0.008 * gauss(a, 40, 13) * gauss(z, 1.128, 0.013)        # cheeks
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.0026 * gauss(z, 1.087, 0.0035) * gauss(ad, 0, 12)      # lower lip
    d += 0.008 * gauss(z, 1.066, 0.011) * gauss(ad, 0, 20)        # chin
    d += 0.003 * gauss(a, 68, 12) * gauss(z, 1.068, 0.014)        # jaw angle
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)        # temples
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
    """Grey hair below the shako: over the ears and down to the collar."""
    return table([(62, 1.2), (84, 1.19), (100, 1.17), (116, 1.13),
                  (140, 1.09), (180, 1.075)], abs(a))


def skull():
    cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
    cols = [a for a in cols if a > -180]
    c = gk.Mesh(f"{G}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]
    n = len(cols)

    def mat(i, j):
        a0, a1 = cols[i], cols[(i + 1) % n]
        if i == n - 1:
            a1 += 360
        a = (a0 + a1) / 2
        a = a - 360 if a > 180 else a
        z = (FACE_Z[j] + FACE_Z[j + 1]) / 2
        if abs(a) > 66 and z > hairline(a):
            return HAIR
        return SKIN

    c.grid(rows, mat, closed=True)
    c.fan(rows[-1], V(0, CY - 0.005, 1.268), HAIR)
    return c.obj(outward=HC)


CHOP_TOP = [(27, 1.105), (40, 1.126), (55, 1.152), (70, 1.186),
            (94, 1.198)]
CHOP_BOTTOM = [(27, 1.093), (38, 1.071), (50, 1.051), (65, 1.041),
               (80, 1.047), (94, 1.074)]
TACHE_TOP = [(0, 1.1085), (8, 1.11), (16, 1.1135), (26, 1.111), (34, 1.106)]
TACHE_BOTTOM = [(0, 1.0985), (8, 1.098), (16, 1.0955), (26, 1.0915),
                (34, 1.09)]


def pillow(name, cols, top, bottom, depth, rows=8, edge=4.0):
    """A thick hair pad lying on the face between two outlines (tables of
    z by face angle), bulging in the middle and meeting the skin at every
    edge, with soft tufts along it."""
    c = gk.Mesh(name, CHOPS)
    a0, a1 = cols[0], cols[-1]
    grid = []
    for j in range(rows + 1):
        v = j / rows
        row = []
        for a in cols:
            aa = abs(a)
            z = lerp(table(bottom, aa), table(top, aa), v)
            ends = smooth(a0, a0 + edge, a) * smooth(a1, a1 - edge, a)
            bulge = math.sin(math.pi * v) ** 0.55 * ends
            tuft = 1 + 0.18 * math.sin(a * 0.55 + v * 7.0) * math.sin(
                math.pi * v)
            p = face_point(a, z) + face_normal(a, z) * (
                0.0008 + depth * bulge * tuft)
            row.append(c.v(p))
        grid.append(row)
    c.grid(grid, CHOPS)
    return c.obj(outward=HC)


def chops():
    """Big grey mutton-chop sideburns from the ears down the cheeks, meeting
    a full moustache over the lip; the chin stays shaved."""
    out = []
    for sx in (-1, 1):
        cols = [sx * a for a in range(27, 95, 3)]
        if sx < 0:
            cols = list(reversed(cols))
        out.append(pillow(f"{G}-chop{sx}", cols, CHOP_TOP, CHOP_BOTTOM,
                          0.012))
    out.append(pillow(f"{G}-tache", list(range(-34, 35, 2)), TACHE_TOP,
                      TACHE_BOTTOM, 0.0085, rows=6, edge=6.0))
    return out


def eyes():
    out = face_paint.eyes(gk, G, face_point, HC, z=1.1565,
                          expression="confident")
    for o in out:
        if "brow" in o.name:
            kit.assign(o, BROW)
    # The mouth sits a touch lower, under the moustache.
    out += face_paint.mouth(gk, G, face_point, HC, z=1.0905,
                            expression="confident")
    return out


def ears():
    out = []
    for sx in (-1, 1):
        p = face_point(sx * 90, 1.142) + V(sx * 0.004, -0.008, 0)
        e = gk.ball(f"{G}-ear{sx}", 1.0, V(0, 0, 0), SKIN,
                    scale=(0.008, 0.02, 0.029), seg=8, rings=5)
        m = Matrix.Translation(p) @ Matrix.Rotation(math.radians(-sx * 14),
                                                    4, "Z") @ \
            Matrix.Rotation(math.radians(-10), 4, "X")
        gk.transform([e], m)
        out.append(e)
    return out


def neck():
    return gk.tube(f"{G}-neck", [V(0, 0.0, 0.985), V(0, 0.004, 1.03),
                                 V(0, 0.01, 1.07)],
                   [0.047, 0.046, 0.044], SKIN, n=12, caps=(None, None))


# The shako, in head space: level on the brow, a little higher behind.
SHAKO_Z = 1.214
SHAKO_H = 0.19


def shako():
    pieces = []
    cy = -0.006
    n = 28

    def rim(z, grow):
        rx_, ry_ = 0.086 + grow, 0.101 + grow
        return [V(rx_ * spow(math.sin(a), 0.92),
                  cy + ry_ * spow(math.cos(a), 0.92), z)
                for a in (i / n * math.tau for i in range(n))]

    rings = []
    for t, grow in ((0.0, 0.0), (0.04, 0.001), (0.3, 0.003), (0.6, 0.006),
                    (0.9, 0.009), (1.0, 0.0095)):
        rings.append(rim(SHAKO_Z - 0.004 + t * SHAKO_H, grow))
    # The crown dips a little in the middle.
    pieces.append(gk.loft(f"{G}-shako", rings, BLACK, start=None,
                          end=V(0, cy, SHAKO_Z + SHAKO_H - 0.006)))
    # A rolled top edge and the black leather band round the bottom.
    top = [p + (p - V(0, cy, p.z)).normalized() * 0.002
           for p in rim(SHAKO_Z + SHAKO_H - 0.003, 0.0095)]
    pieces.append(gk.tube(f"{G}-shakotop", top + [top[0]],
                          [(0.0045, 0.011)] * (n + 1), TEAM, n=6,
                          up=(0, 0, 1), caps=(None, None)))
    band = [p + (p - V(0, cy, p.z)).normalized() * 0.003
            for p in rim(SHAKO_Z + 0.008, 0.0)]
    pieces.append(gk.tube(f"{G}-shakoband", band + [band[0]],
                          [(0.004, 0.012)] * (n + 1), BLACK, n=6,
                          up=(0, 0, 1), caps=(None, None)))
    # The peak: a stiff leather visor over the eyes.

    def peak(u, v):
        a = math.radians(lerp(-72, 72, u))
        r0x, r0y = 0.086, 0.101
        inner = V(r0x * spow(math.sin(a), 0.92),
                  cy + r0y * spow(math.cos(a), 0.92), SHAKO_Z + 0.002)
        out = V(math.sin(a), math.cos(a), 0)
        reach = 0.042 * math.cos(a) ** 1.2
        return inner + out * reach * v + V(0, 0, -0.012 * v * v)
    pieces.append(gk.sheet(f"{G}-peak", peak, [i / 12 for i in range(13)],
                           [0, 0.5, 1], BLACK, rim=0.004, back=True,
                           inside=V(0, cy, SHAKO_Z + 0.2)))
    # The brass lozenge plate on the front with a raised boss.
    front = V(0, cy + 0.101 + 0.006, SHAKO_Z + 0.085)
    m = gk.basis(V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0), front)
    loz = [(0.0, -0.05), (0.036, 0.0), (0.0, 0.052), (-0.036, 0.0)]
    pieces.append(gk.slab(f"{G}-lozenge", loz, 0.004, BRASS, matrix=m,
                          bevel=0.0015))
    pieces.append(gk.ball(f"{G}-boss", 0.014, front + V(0, 0.004, 0.0),
                          BRASS, scale=(1, 0.5, 1), seg=10, rings=5))
    # The cockade and the tall plume above it.
    ck = V(0, cy + 0.108, SHAKO_Z + SHAKO_H - 0.022)
    m = gk.basis(V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0), ck)
    pieces.append(gk.slab(f"{G}-cockade", [(x, y) for x, y, _ in
                                            gk.sup(14, 0.024, 0.024)],
                          0.006, TEAM, matrix=m, bevel=0.002))
    pieces.append(gk.slab(f"{G}-cockadec", [(x, y) for x, y, _ in
                                             gk.sup(10, 0.01, 0.01)],
                          0.009, BRASS, matrix=m))
    base = ck + V(0, -0.004, 0.012)
    path = [base, base + V(0, -0.004, 0.05), base + V(0, -0.012, 0.1),
            base + V(0, -0.024, 0.145), base + V(0, -0.04, 0.178)]
    pieces.append(gk.tube(f"{G}-plume", path,
                          [0.014, 0.027, 0.03, 0.024, 0.011], TEAM, n=12,
                          caps=("dome", "dome"), flute=0.2))
    # Brass chin scales down each side to under the jaw.
    for sx in (-1, 1):
        pts = [V(sx * 0.086, cy + 0.03, SHAKO_Z + 0.008),
               V(sx * 0.082, 0.04, 1.14), V(sx * 0.07, 0.05, 1.075),
               V(sx * 0.04, 0.058, 1.035), V(0, 0.06, 1.022)]
        pts = [V(p) for p in kit.smooth_path(pts, samples=2)]
        pieces.append(gk.tube(f"{G}-scales{sx}", pts,
                              [(0.0075, 0.004)] * len(pts), BRASS, n=4,
                              up=(1, 0, 0), caps=(None, None)))
        pieces.append(gk.ball(f"{G}-rosette{sx}", 0.012,
                              V(sx * 0.089, cy + 0.03, SHAKO_Z + 0.008),
                              BRASS, scale=(0.5, 1, 1), seg=8, rings=4))
    return pieces


def head():
    hat = shako()
    plume = [o for o in hat if "-plume" in o.name]
    pieces = [skull(), neck()] + chops() + eyes() + ears() + \
        [o for o in hat if o not in plume]
    gk.transform(pieces + plume, Matrix.Translation(V(0, 0, HEAD_DZ)))
    # Onto the leaning neck.
    gk.transform(pieces + plume, Matrix.Translation(NECK - NECK0))
    return pieces, plume


# ------------------------------------------------------------- arms


def fist(name, c, xax, kax, chir, mat=SKIN):
    """The Cowboy's closed fist round a pole along Z (the index finger's
    end), fingertips toward X and knuckles toward K; the wrist at -X."""
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
        for x, y, ang in gk.sup(10, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.0022 * (1 if px > 0.004 else 0.5)
                py += 0.0016 if py < -0.01 else 0.0
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0012
                py += 0.0012
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [gk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                      end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(gk.tube(f"{name}-thumb", thumb, [0.0098, 0.0086, 0.0078],
                          mat, n=6))
    pieces.append(gk.tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                           V(-0.03, 0.0, 0.0)],
                          [(0.022, 0.027), (0.025, 0.03)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = gk.basis(xax, kax, zax, c)
    gk.transform(pieces, m)
    return pieces


def sleeve(side, s, e, w, sx):
    """The coatee's sleeve with a deep team-colour cuff."""
    up = (e - s).normalized()
    fo = (w - e).normalized()
    cuff_at = lerp(e, w, 0.62)
    tube = gk.tube(f"{G}-sleeve{side}",
                   [s + up * 0.004, lerp(s, e, 0.3), lerp(s, e, 0.65), e],
                   [0.05, 0.051, 0.047, 0.044], JACKET, n=12, caps=(None, None))
    fore = gk.tube(f"{G}-fore{side}", [e, lerp(e, cuff_at, 0.5), cuff_at],
                   [0.044, 0.042, 0.041], JACKET, n=12, caps=(None, None))
    bend = (up - fo)
    for obj in (tube, fore):
        for v in obj.data.vertices:
            p = v.co
            d = min((p - e).length, 0.08)
            k = (1 - d / 0.08) ** 2
            out = (p - e)
            out = out - fo * out.dot(fo)
            if out.length > 1e-6 and bend.length > 1e-6:
                out.normalize()
                ang = math.atan2(out.dot(bend.cross(fo).normalized()),
                                 out.dot(bend.normalized()))
                v.co = p + out * 0.005 * k * math.sin(3 * ang + 1.0)
    upper = [tube, gk.ball(f"{G}-shoulder{side}", 1.0,
                          s + V(sx * 0.004, 0, -0.024), JACKET,
                          scale=(0.05, 0.052, 0.04), seg=10, rings=6),
             gk.ball(f"{G}-elbow{side}", 0.042, e, JACKET, seg=10, rings=6)]
    lower = [fore]
    # The cuff: a deep team-colour band flaring a little to the wrist, with
    # a brass button.
    lower.append(gk.tube(f"{G}-cuff{side}", [cuff_at - fo * 0.012,
                                             w - fo * 0.004],
                          [0.046, 0.043], TEAM, n=12, caps=("flat", "flat")))
    side_v = fo.cross(V(0, 0, 1))
    if side_v.length > 1e-6:
        side_v.normalize()
        p = lerp(cuff_at, w, 0.5) + side_v * sx * 0.045
        lower.append(gk.ball(f"{G}-cbutton{side}", 0.0065, p, BRASS,
                              seg=6, rings=3))
    return upper, lower


def build_arm(side):
    """An arm from the leaning shoulder to its fist on the push bar."""
    if side == "R":
        s, sx, chir = S_R, 1, -1
    else:
        s, sx, chir = S_L, -1, 1
    c = V(sx * GRIP_X, BAR_Y, BAR_Z)
    pole = s + V(sx * 0.6, -0.4, -0.2)
    bar = V(1, 0, 0)
    e0 = gk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    xax = (c - e0) - bar * (c - e0).dot(bar)
    xax.normalize()
    w = c - xax * WRIST_FIST
    e = gk.ik(s, w, UPPER, FORE, pole)
    # The index finger's end points in toward the middle of the bar.
    zax = V(-sx, 0, 0)
    kax = zax.cross(xax) if chir > 0 else xax.cross(zax)
    upper, lower = sleeve(side, s, e, w, sx)
    lower += fist(f"{G}-hand{side}", c, xax, kax, chir)
    return upper, lower, s, e


# ------------------------------------------------------------- the gun


def spoked_wheel(sx):
    """A wooden artillery wheel: felloe, iron tyre, twelve spokes and a
    hub with an iron cap; centred on the axle at x = sx * WHEEL_X."""
    pieces = []
    c = V(sx * WHEEL_X, AXLE.y, AXLE.z)
    ax = Matrix.Translation(c) @ Matrix.Rotation(math.radians(90), 4, "Y")
    r = WHEEL_R
    # Tyre and felloe as one lathe about the axle (local z = world x).
    tyre = [(r - 0.012, -0.017), (r - 0.001, -0.017), (r, -0.012),
            (r, 0.012), (r - 0.001, 0.017), (r - 0.012, 0.017),
            (r - 0.012, -0.017)]
    pieces.append(gk.lathe(f"{G}-tyre{sx}", tyre, IRON, n=22, matrix=ax))
    felloe = [(r - 0.042, 0.015), (r - 0.012, 0.016), (r - 0.012, -0.016),
              (r - 0.042, -0.015), (r - 0.045, 0.0)]
    pieces.append(gk.lathe(f"{G}-felloe{sx}",
                           felloe[:4] + [felloe[0]], WOOD, n=22, matrix=ax))
    hub = [(0.0, -0.05), (0.024, -0.05), (0.034, -0.036), (0.036, -0.012),
           (0.036, 0.012), (0.034, 0.03), (0.024, 0.046), (0.0, 0.046)]
    hub = [(rr, h * sx) for rr, h in hub]
    if sx < 0:
        hub = list(reversed(hub))
    pieces.append(gk.lathe(f"{G}-hub{sx}", hub, WOOD, n=14, matrix=ax))
    cap = [(0.0, 0.044), (0.02, 0.044), (0.02, 0.058), (0.012, 0.064),
           (0.0, 0.066)]
    cap = [(rr, h * sx) for rr, h in cap]
    if sx < 0:
        cap = list(reversed(cap))
    pieces.append(gk.lathe(f"{G}-hubcap{sx}", cap, IRON, n=12, matrix=ax))
    # A ring of iron round the hub's inner face.
    band = [(0.0375, -0.03 * sx), (0.0375, -0.018 * sx)]
    if sx < 0:
        band = list(reversed(band))
    pieces.append(gk.lathe(f"{G}-hubband{sx}", band, IRON, n=14,
                           matrix=ax))
    # Spokes: twelve, dished a little outward toward the rim.
    for k in range(12):
        a = k / 12 * math.tau + 0.13
        d = V(0, math.cos(a), math.sin(a))
        p0 = c + d * 0.03 + V(-sx * 0.004, 0, 0)
        p1 = c + d * (r - 0.036) + V(sx * 0.004, 0, 0)
        pieces.append(gk.tube(f"{G}-spoke{sx}{k}", [p0, lerp(p0, p1, 0.5),
                                                   p1],
                              [(0.009, 0.0075), (0.0085, 0.007),
                               (0.007, 0.006)],
                              WOOD, n=4, up=(1, 0, 0), caps=(None, None)))
    return pieces


def wheels():
    return spoked_wheel(-1) + spoked_wheel(1)


def carriage():
    """The carriage cheeks, axle-tree, iron straps, the two push rails and
    the push bar, and three round shot riding between the cheeks."""
    pieces = []
    for sx in (-1, 1):
        x = sx * 0.1
        # A cheek: a thick board from ahead of the axle back to the trail,
        # its top notched for the trunnions.
        outline = [(0.72, 0.19), (0.72, 0.29), (0.66, 0.325), (0.54, 0.325),
                   (0.44, 0.285), (0.38, 0.235), (0.36, 0.18), (0.4, 0.15),
                   (0.52, 0.12), (0.64, 0.13)]
        m = gk.basis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0),
                     V(x - 0.017, 0, 0))
        pieces.append(gk.slab(f"{G}-cheek{sx}", outline, 0.034, WOOD,
                              matrix=m, bevel=0.005))
        # The trunnion cap-square and two iron bands on the cheek.
        pieces.append(gk.rbox(f"{G}-capsq{sx}", (0.04, 0.05, 0.016),
                              V(x, TRUNNION.y, 0.33), IRON, levels=1,
                              crease=0.6))
        for y in (0.44, 0.69):
            pieces.append(gk.rbox(f"{G}-band{sx}{y}", (0.04, 0.012, 0.13),
                                  V(x, y, 0.22 + (0.05 if y > 0.6 else 0.02)),
                                  IRON, levels=1, crease=0.7))
        # The push rail: from the back of the cheek up to the bar.
        a = V(x, 0.45, 0.26)
        b = V(sx * 0.17, BAR_Y + 0.004, BAR_Z - 0.01)
        pieces.append(gk.tube(f"{G}-rail{sx}", [a, lerp(a, b, 0.5) +
                                               V(sx * 0.01, 0, 0.012), b],
                              [(0.017, 0.019), (0.016, 0.018),
                               (0.015, 0.017)],
                              WOOD, n=8, up=(1, 0, 0), caps=("flat", None)))
        pieces.append(gk.rbox(f"{G}-railstrap{sx}", (0.04, 0.03, 0.04),
                              lerp(a, b, 0.12), IRON, levels=1, crease=0.6))
    # The axle-tree under the cheeks, out to the hubs.
    pieces.append(gk.tube(f"{G}-axletree",
                          [V(-WHEEL_X + 0.02, AXLE.y, AXLE.z),
                           V(WHEEL_X - 0.02, AXLE.y, AXLE.z)],
                          [(0.024, 0.03), (0.024, 0.03)], WOOD, n=8,
                          up=(0, 0, 1), caps=("flat", "flat")))
    pieces.append(gk.tube(f"{G}-axle",
                          [V(-WHEEL_X - 0.05, AXLE.y, AXLE.z),
                           V(WHEEL_X + 0.05, AXLE.y, AXLE.z)],
                          [0.012, 0.012], IRON, n=8, caps=("flat", "flat")))
    # The transom joining the cheeks behind the breech, and the bed.
    pieces.append(gk.rbox(f"{G}-transom", (0.17, 0.05, 0.05),
                          V(0, 0.42, 0.19), WOOD, levels=1, crease=0.7))
    pieces.append(gk.rbox(f"{G}-bed", (0.17, 0.2, 0.025),
                          V(0, 0.5, 0.2), WOOD, levels=1, crease=0.7))
    # The push bar, with iron ferrules at its ends.
    pieces.append(gk.tube(f"{G}-bar", [V(-0.2, BAR_Y, BAR_Z),
                                       V(0.2, BAR_Y, BAR_Z)],
                          [0.016, 0.016], WOOD, n=10,
                          caps=("dome", "dome")))
    for sx in (-1, 1):
        pieces.append(gk.tube(f"{G}-ferrule{sx}",
                              [V(sx * 0.18, BAR_Y, BAR_Z),
                               V(sx * 0.2, BAR_Y, BAR_Z)],
                              [0.0185, 0.0185], IRON, n=10,
                              caps=("flat", "flat")))
    # A few round shot on the bed behind the breech.
    for k, (x, y, z) in enumerate(((-0.042, 0.435, 0.245),
                                   (0.042, 0.435, 0.245),
                                   (0.0, 0.43, 0.29))):
        pieces.append(gk.ball(f"{G}-shot{k}", 0.036, V(x, y, z), IRON,
                              seg=10, rings=6))
    return pieces


def barrel():
    """A bronze field-gun barrel along +y: the cascabel knob, the breech
    and its reinforce rings, the trunnions, a slim chase and a swelling
    muzzle round a dark bore."""
    prof = [(0.0, -0.265), (0.018, -0.262), (0.022, -0.25), (0.016, -0.238),
            (0.017, -0.226), (0.034, -0.222), (0.058, -0.212),
            (0.072, -0.19), (0.075, -0.17), (0.08, -0.166), (0.08, -0.152),
            (0.074, -0.148), (0.071, -0.06), (0.076, -0.056), (0.076, -0.04),
            (0.068, -0.036), (0.062, 0.1), (0.066, 0.104), (0.066, 0.116),
            (0.058, 0.12), (0.05, 0.25), (0.056, 0.275), (0.066, 0.3),
            (0.068, 0.315), (0.064, 0.325), (0.04, 0.327), (0.035, 0.31)]
    m = gk.basis(V(1, 0, 0), V(0, 0, -1), V(0, 1, 0), TRUNNION)
    pieces = [gk.lathe(f"{G}-barrel", prof, BRONZE, n=20, matrix=m,
                       end=V(0, 0, 0.29))]
    # The dark bore just inside the muzzle.
    pieces.append(gk.slab(f"{G}-bore", [(x, y) for x, y, _ in
                                         gk.sup(14, 0.034, 0.034)],
                          0.004, IRON,
                          matrix=gk.basis(V(1, 0, 0), V(0, 0, 1),
                                          V(0, -1, 0),
                                          TRUNNION + V(0, 0.318, 0))))
    # Trunnions sitting in the cheeks.
    pieces.append(gk.tube(f"{G}-trunnions", [TRUNNION + V(-0.11, 0, 0),
                                             TRUNNION + V(0.11, 0, 0)],
                          [0.021, 0.021], BRONZE, n=10,
                          caps=("flat", "flat")))
    # The vent on the breech.
    pieces.append(gk.ball(f"{G}-vent", 0.012, TRUNNION + V(0, -0.17, 0.077),
                          BRONZE, scale=(1, 1, 0.5), seg=8, rings=4))
    return pieces


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("GUNNER_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + gk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return gk.part(G, name, pieces, pivot, par, angle=angle)


def build(root_name="gunner"):
    assert root_name == G
    root = kit.empty(G)

    for sx, knee, ankle, out in ((-1, V(-0.094, 0.016, 0.36),
                                  V(-0.104, 0.02, 0.085), 11),
                                 (1, V(0.094, -0.01, 0.36),
                                  V(0.106, -0.018, 0.085), 9)):
        pieces, hip = leg(sx, knee, ankle, out)
        part(f"leg{'L' if sx < 0 else 'R'}", pieces, hip, root)

    torso = [coatee(), hips()] + front_trim() + cross_belt() + \
        epaulette(-1) + epaulette(1)
    gk.transform(torso, LEAN_M)
    torso_obj = part("torso", torso, WAIST, root)
    face, plume = head()
    head_obj = face_rig.head(gk.part, G, face, NECK, torso_obj, angle=62)
    plume_pivot = V(0, 0.098, SHAKO_Z + SHAKO_H - 0.01 + HEAD_DZ) + NECK - NECK0
    part("hat", plume, plume_pivot, head_obj, angle=62)
    for side in ("R", "L"):
        upper, lower, s, e = build_arm(side)
        arm = part(f"arm{side}", upper, s, torso_obj)
        part(f"fore{side}", lower, e, arm)

    gun = part("offhand", carriage(), AXLE, root, angle=40)
    part("extra", barrel(), TRUNNION, gun, angle=40)
    part("wheels", wheels(), AXLE, gun, angle=40)

    report(root)
    pose = os.environ.get("GUNNER_POSE")
    if pose in POSES:
        gk.apply_runtime(root, POSES[pose])
    return root


# Poses in three.js Euler terms (x, y about the vertical, z), as the game
# sets them (components/game/arena/moves/gunner.ts): strides pushing the
# gun, the brace before a shot and the recoil.
POSES = {
    "walk": {"legL": (0.5, 0, 0), "legR": (-0.5, 0, 0),
             "wheels": (-1.2, 0, 0)},
    "walk2": {"legL": (-0.5, 0, 0), "legR": (0.5, 0, 0),
              "wheels": (-2.4, 0, 0)},
    "brace": {"legL": (0.28, 0, 0), "legR": (-0.35, 0, 0),
              "torso": (-0.08, 0, 0),
              "head": (0.12, 0.35, 0), "extra": (0.22, 0, 0)},
    "fire": {"legL": (0.28, 0, 0), "legR": (-0.35, 0, 0),
             "torso": (0.06, 0, 0), "head": (-0.12, 0.3, 0),
             "extra": (0.42, 0, 0), "wheels": (0.5, 0, 0)},
}


def report(root):
    print("GUNNER joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {gk.tris(o)} mats "
                  f"{[m.name for m in o.data.materials]}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("GUNNER materials", len(mats), mats)
