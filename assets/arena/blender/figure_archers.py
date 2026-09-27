"""The Cadets (card id `archers`, two per card) as collector's miniatures: a
grown-up 1960s space-race astronaut cadet, a young test pilot, in
hand-painted resin.

An off-white quilted pressure suit with deep team panels (a chest yoke that
runs over the shoulders, a stripe down the outside of each arm and leg), a
gilt neck ring and gilt wrist rings, a rounded white helmet with a padded
face seal and its gold visor raised over a determined clean-shaven face, a
small chest control box with two corrugated grey hoses down to gilt hip
ports, a compact white life-support backpack, silver gauntlet gloves,
white boots with dark soles, and a chrome 1960s ray gun with finned barrel
rings and a red glowing emitter in the right fist.

Parts (the contract of troops.py): the root empty `archers` at the feet,
facing +y; `archers.legL/R` pivot at the hips; `archers.torso` at the
waist carries the yoke, the shoulder caps, the neck ring, the chest box
and hoses and the backpack; `archers.head` (neck) is the face and helmet;
`archers.armL/R` pivot at the shoulders; `archers.weapon` is the ray gun, a
child of armR with its pivot in the right fist. No part has a rest
rotation.

The right arm and the gun are modelled in the aim (arm straight out
forward, gun level) and then swung down by AIM about the shoulder's x axis,
so at rest the gun hangs muzzle down beside the thigh and the game's
blaster lift (armR +1.45 to +1.8 rad about x, with the torso turned 0.18
rad to the left) brings it back level along +y. The rest barrel is aimed
10 degrees to the right to cancel that torso turn.

ARCHERS_POSE=aim (arms raised and legs apart, the attack check),
walk (mid stride) or blaster (the exact steady aim, arms only) poses the
figure before the previews are rendered.
"""

import math
import os

import kit
import figure_archers_kit as ak
from figure_archers_kit import V, clamp01, gauss, lerp, smooth, spow, table
from mathutils import Matrix

R = "archers"
T = kit.tint

# ------------------------------------------------------------- paints
# Ten pots (one draw batch each at runtime); small bits share them.

SUIT = "weave:" + T("cadet-suit", "#e2ddcf")
TEAM = "weave:team"
SHELL = "resin:" + T("cadet-shell", "#ebe8df")
GILT = "gilt:" + T("cadet-gilt", "#bb9546")
CHROME = "gilt:" + T("cadet-chrome", "#b7bdc5")
DARK = "resin:" + T("cadet-dark", "#29292c")
HOSE = "resin:" + T("cadet-hose", "#7b8189")
SKIN = "resin:" + T("cadet-skin", "#c38e70")
LIP = "resin:" + T("cadet-lip", "#a46e5b")
RAY = "glow:" + T("cadet-ray", "#ff3b2b")
VISOR = GILT
SEAL = HOSE
EYEW = SHELL
IRIS = DARK
BROW = DARK
SOLE = DARK
GRIP = DARK

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.08, 0.585
WAIST = V(0, 0, 0.64)
NECK = V(0, 0, 0.975)
SH_X, SH_Y, SH_Z = 0.166, -0.006, 0.905
S_R = V(SH_X, SH_Y, SH_Z)
S_L = V(-SH_X, SH_Y, SH_Z)
UPPER, FORE = 0.222, 0.198
WRIST_FIST = 0.04

# The aim: the game lifts armR by about 1.45-1.5 rad and turns the torso
# 0.18 rad to the left (components/game/arena/troops.ts, 'blaster').
AIM = 1.47
TURN = 0.18
B_AIM = V(math.sin(TURN), math.cos(TURN), 0)        # the barrel in the aim
G_UP = V(0, 0, 1)
G_RIGHT = B_AIM.cross(G_UP)
RAKE = math.radians(16)                             # grip rake
C_AIM = S_R + B_AIM * 0.45 + V(-0.016, 0, -0.06)  # right fist, in the aim
M_REST = (Matrix.Translation(S_R) @ Matrix.Rotation(-AIM, 4, "X") @
          Matrix.Translation(-S_R))
GUN_Z = 0.038                                       # barrel above the fist
GUN_S = 1.04

# ------------------------------------------------------------- face
# The face is sculpted in the guard's face space (a proven adult head) and
# scaled into the helmet: HCG there becomes HC here.

HCG = V(0, 0.012, 1.162)
SF = 0.93
HC = V(0, 0.012, 1.117)
CY = 0.012

FACE_W = [(1.0, 0.031), (1.03, 0.042), (1.048, 0.05), (1.062, 0.056),
          (1.076, 0.061), (1.095, 0.064), (1.12, 0.068), (1.145, 0.071),
          (1.17, 0.073), (1.2, 0.073), (1.235, 0.068)]
FACE_D = [(1.0, 0.03), (1.03, 0.042), (1.048, 0.056), (1.062, 0.067),
          (1.074, 0.071), (1.09, 0.074), (1.12, 0.077), (1.15, 0.074),
          (1.172, 0.081), (1.2, 0.082), (1.235, 0.074)]
FACE_P = 2.5
NOSE_H = [(1.1, 0.0), (1.107, 0.006), (1.114, 0.016), (1.121, 0.022),
          (1.13, 0.019), (1.145, 0.0135), (1.16, 0.0085), (1.172, 0.004),
          (1.186, 0.0)]
NOSE_S = [(1.11, 11.0), (1.13, 8.5), (1.17, 6.0)]


def face_disp(ad, z):
    """Sculpted relief (metres, along the surface normal): a straight
    nose, deep-set eyes under a lowered brow, cheekbones, a firm closed
    mouth and a square clean-shaven chin and jaw."""
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.0055 * gauss(a, 12.5, 5) * gauss(z, 1.116, 0.006)      # nostrils
    d -= 0.0085 * gauss(a, 26, 11) * gauss(z, 1.156, 0.011)       # sockets
    bz = 1.172 - 0.004 * gauss(a, 8, 8)
    d += 0.0082 * gauss(z, bz, 0.0065) * smooth(52, 30, a)        # brow
    d -= 0.0026 * gauss(ad, 0, 4) * gauss(z, 1.17, 0.006)         # frown
    d += 0.0068 * gauss(a, 47, 13) * gauss(z, 1.138, 0.012)       # cheekbone
    d -= 0.0045 * gauss(a, 40, 12) * gauss(z, 1.108, 0.012)       # hollow
    d -= 0.0032 * gauss(z, 1.0965, 0.0022) * gauss(ad, 0, 17)     # mouth
    d += 0.0018 * gauss(z, 1.101, 0.0035) * gauss(ad, 0, 14)      # upper lip
    d += 0.0026 * gauss(z, 1.089, 0.0032) * gauss(ad, 0, 12)      # lower lip
    d -= 0.0022 * gauss(z, 1.08, 0.004) * gauss(ad, 0, 10)        # lip shadow
    d += 0.0095 * gauss(z, 1.062, 0.011) * gauss(ad, 0, 20)       # chin
    d -= 0.0018 * gauss(z, 1.058, 0.006) * gauss(ad, 0, 3)        # chin cleft
    d += 0.0045 * gauss(z, 1.066, 0.012) * gauss(a, 58, 10)       # jaw corner
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)        # temples
    return d


def gpoint(ad, z):
    """A point of the face in the guard's face space."""
    a = math.radians(ad)
    w = table(FACE_W, z) + 0.004 * gauss(z, 1.075, 0.012) * \
        gauss(abs(ad), 68, 15)
    dd = table(FACE_D, z)
    e = 2.0 / FACE_P
    s_, c_ = math.sin(a), math.cos(a)
    x = w * spow(s_, e)
    y = dd * spow(c_, e) if c_ >= 0 else 0.6 * dd * spow(c_, e)
    gx = spow(x / w, FACE_P - 1) / w if x else 0.0
    gy = spow(y / dd, FACE_P - 1) / dd if y else 0.0
    n = V(gx, gy, 0)
    n = n.normalized() if n.length > 1e-9 else V(0, 1, 0)
    return V(x, CY + y, z) + n * face_disp(ad, z)


def face_point(ad, z):
    return HC + (gpoint(ad, z) - HCG) * SF


def face_normal(ad, z):
    du = face_point(ad + 0.5, z) - face_point(ad - 0.5, z)
    dz = face_point(ad, z + 0.001) - face_point(ad, z - 0.001)
    n = du.cross(dz).normalized()
    if (face_point(ad, z) - HC).dot(n) < 0:
        n = -n
    return n


FACE_A = [0, 6, 12, 19, 27, 37, 49, 62, 76]
FACE_Z = [1.036, 1.056, 1.071, 1.084, 1.094, 1.104, 1.114, 1.124, 1.135,
          1.146, 1.156, 1.165, 1.175, 1.187, 1.202, 1.224]


def face():
    cols = sorted(set([-a for a in FACE_A] + FACE_A))
    c = ak.Mesh(f"{R}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]

    c.grid(rows, SKIN)
    return c.obj(outward=HC)


def mouth():
    """Firm closed lips: a lip-coloured shape with a dark parting line."""
    lips = [(-14, 1.0959), (-9, 1.0982), (-3.5, 1.099), (0, 1.0985),
            (3.5, 1.099), (9, 1.0982), (14, 1.0959), (9, 1.0932),
            (3.5, 1.0918), (0, 1.0915), (-3.5, 1.0918), (-9, 1.0932)]
    line = [(-13.5, 1.0961), (-6, 1.0963), (0, 1.096), (6, 1.0963),
            (13.5, 1.0961), (6, 1.0954), (0, 1.0952), (-6, 1.0954)]
    return [ak.decal(f"{R}-lips", face_point, lips, 0.0012, LIP,
                     depth=0.001, eps=0.05, ref=HC),
            ak.decal(f"{R}-parting", face_point, line, 0.0019, DARK,
                     depth=0.0, eps=0.05, ref=HC)]


def eyes():
    """Painted eyes in the sockets (an off-white almond, a dark iris under
    the lid, a lash line) and straight, lowered brows."""
    out = []
    fn = face_point
    for sx in (-1, 1):
        ac, zc = sx * 25.5, 1.1565
        lens = []
        for i in range(12):
            t = i / 12 * math.tau
            x = math.cos(t)
            y = math.sin(t) * (0.82 if math.sin(t) > 0 else 0.8)
            lens.append((ac + x * 8.4, zc + y * 0.0056 + 0.0006 * x * sx))
        if sx < 0:
            lens.reverse()
        out.append(ak.decal(f"{R}-eye{sx}", fn, lens, 0.0019, EYEW,
                            depth=0.0014, eps=0.05, ref=HC))
        iris = [(ac - sx * 0.4 + math.cos(t) * 3.7,
                 zc + math.sin(t) * 0.0046 + 0.0004)
                for t in (i / 8 * math.tau for i in range(8))]
        out.append(ak.decal(f"{R}-iris{sx}", fn, iris, 0.0024, IRIS,
                            depth=0.0, eps=0.05, ref=HC))
        lash = []
        for i in range(7):
            t = math.pi * i / 6
            lash.append((ac + math.cos(t) * 9.2, zc + math.sin(t) * 0.0062 +
                         0.0007 * math.cos(t) * sx))
        for i in range(6, -1, -1):
            t = math.pi * i / 6
            lash.append((ac + math.cos(t) * 8.4, zc + math.sin(t) * 0.0052 +
                         0.0007 * math.cos(t) * sx))
        out.append(ak.decal(f"{R}-lash{sx}", fn, lash, 0.0026, IRIS,
                            depth=0.0, eps=0.05, ref=HC))
        # Brows: level and low, the inner ends pulled down (determined).
        pts = []
        for ad, z in ((9, 1.1698), (16, 1.1735), (24, 1.1755), (32, 1.175),
                      (40, 1.1728)):
            pts.append(face_point(sx * ad, z) +
                       face_normal(sx * ad, z) * 0.002)
        out.append(ak.tube(f"{R}-brow{sx}", pts,
                           [(0.0036, 0.0021), (0.0038, 0.0023),
                            (0.0035, 0.0021), (0.0028, 0.0017),
                            (0.0019, 0.0012)], BROW, n=4,
                           caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- helmet

HH = V(0, 0.008, 1.12)          # helmet centre
H_RX, H_RYF, H_RYB, H_RZU, H_RZD = 0.117, 0.127, 0.121, 0.128, 0.142
RING_R, RING_Z = 0.09, 0.992    # the helmet's lower edge (head space)


def shell_r(d):
    ry = H_RYF if d.y >= 0 else H_RYB
    rz = H_RZU if d.z >= 0 else H_RZD
    return 1.0 / math.sqrt((d.x / H_RX) ** 2 + (d.y / ry) ** 2 +
                           (d.z / rz) ** 2)


def shell_pt(d, lift=0.0):
    d = d.normalized()
    return HH + d * (shell_r(d) + lift)


def sdir(az, el):
    """A direction from the helmet centre: az degrees from the front
    toward +x, el degrees above level."""
    a, e = math.radians(az), math.radians(el)
    return V(math.sin(a) * math.cos(e), math.cos(a) * math.cos(e),
             math.sin(e))


def opening(s):
    """The face opening, as (face angle, guard-space z), s = 0 at the top."""
    c, sn = math.cos(s), math.sin(s)
    a = 66 * spow(sn, 0.78)
    z = 1.13 + (0.078 if c > 0 else 0.086) * spow(c, 0.85)
    return a, z


_SHELL = {}


def on_shell(d, lift=0.0):
    """The built shell's surface along d from the helmet centre (a ray
    cast into the finished mesh), lifted along its normal."""
    d = d.normalized()
    hit, nrm, _, _ = _SHELL["tree"].ray_cast(HH, d, 1.0)
    if hit is None:
        return shell_pt(d, lift)
    if nrm.dot(d) < 0:
        nrm = -nrm
    return hit + nrm * lift


def ring_pt(s):
    return V(RING_R * math.sin(s), -RING_R * math.cos(s) + 0.006, RING_Z)


# Where each column of the shell passes from the face opening to the lower
# edge: over the crown for the top, round behind the ear for the cheeks,
# straight down under the chin.
WAY = [(0.0, 0.0, -0.45, 0.89), (math.pi / 4, 0.62, -0.5, 0.6),
       (math.pi / 2, 0.86, -0.42, -0.2), (3 * math.pi / 4, 0.66, -0.05, -0.75),
       (math.pi, 0.0, 0.34, -0.94)]


def waypoint(s):
    sa = abs(((s + math.pi) % math.tau) - math.pi)
    wx, wy, wz = table(WAY, sa)
    return V(math.copysign(wx, math.sin(s) or 1.0), wy, wz).normalized()


def helmet():
    """The shell: a padded grey face seal on the skin, a thick rolled rim,
    then the round shell down to the lower edge on the neck ring."""
    n = 28
    ss = [i / n * math.tau for i in range(n)]
    centre = face_point(0, 1.135)
    lips = []
    for s in ss:
        a, z = opening(s)
        p = face_point(a, z)
        nn = face_normal(a, z)
        m = p - centre
        m = (m - nn * m.dot(nn)).normalized()
        lips.append((p, nn, m))
    c = ak.Mesh(f"{R}-helmet", SHELL)
    pts = [[p + nn * 0.001 - m * 0.001 for p, nn, m in lips],
           [p + nn * 0.0075 + m * 0.0035 for p, nn, m in lips],
           [p + nn * 0.011 + m * 0.0095 for p, nn, m in lips]]
    dirs0 = [(p + nn * 0.032 + m * 0.012 - HH).normalized()
             for p, nn, m in lips]
    pts.append([shell_pt(d) for d in dirs0])
    ts = [0.11, 0.25, 0.4, 0.55, 0.7, 0.84, 1.0]
    for t in ts:
        row = []
        for i, s in enumerate(ss):
            da = dirs0[i]
            b0 = ring_pt(s) - HH
            db = b0.normalized()
            ctrl = waypoint(s) * 2 - (da + db) / 2
            d = (da * (1 - t) ** 2 + ctrl * 2 * t * (1 - t) + db * t * t)
            d.normalize()
            w = t ** 3
            r = shell_r(d) * (1 - w) + b0.length * w
            row.append(HH + d * r)
        pts.append(row)
    # The lower edge turns in to show the shell's thickness.
    pts.append([V(p.x * 0.9, (p.y - 0.006) * 0.9 + 0.006, RING_Z + 0.003)
                for p in (ring_pt(s) for s in ss)])
    rows = [[c.v(p) for p in r] for r in pts]

    def mat(i, j):
        return SEAL if j < 2 else SHELL

    c.grid(rows, mat, closed=True)
    obj = c.obj(outward=HH)
    from mathutils.bvhtree import BVHTree
    kit.refresh()
    _SHELL["tree"] = BVHTree.FromPolygons(
        [v.co.copy() for v in obj.data.vertices],
        [tuple(p.vertices) for p in obj.data.polygons])
    return obj


def visor():
    """The gold visor, raised over the brow and crown, its sides tapering
    to the hinges."""
    def fn(u, v):
        k = (u / 80) ** 2
        el = lerp(36 - 20 * k, 76 - 40 * k, v)
        return on_shell(sdir(u, el), 0.0075)

    us = [-80 + i * 16 for i in range(11)]
    vs = [0.0, 0.35, 0.7, 1.0]
    pieces = [ak.sheet(f"{R}-visor", fn, us, vs, VISOR, rim=0.0065,
                       inside=HH)]
    # A small lift tab at the bottom of the visor.
    at = on_shell(sdir(0, 34), 0.009)
    nrm = sdir(0, 34)
    m = ak.basis(V(1, 0, 0), nrm.cross(V(1, 0, 0)), nrm, at)
    tab = [(x, y) for x, y, _ in ak.sup(8, 0.016, 0.007, 3.0)]
    pieces.append(ak.slab(f"{R}-visortab", tab, 0.006, VISOR, matrix=m))
    # Hinge bosses at the temples.
    for sx in (-1, 1):
        d = sdir(sx * 88, 22)
        up = V(0, 0, 1) - d * d.z
        mh = ak.basis(up.cross(d).normalized(), up.normalized(), d,
                      on_shell(d, -0.002))
        pieces.append(ak.lathe(f"{R}-hinge{sx}",
                               [(0.021, 0.0), (0.022, 0.006),
                                (0.015, 0.012), (0.0, 0.013)], GILT,
                               matrix=mh, segments=9, caps=(False, True)))
    return pieces


def helmet_stripe():
    """A team stripe from under the visor over the crown to the back."""
    def fn(u, v):
        phi = math.radians(lerp(62, 214, v))
        d = V(0, math.cos(phi), math.sin(phi))
        r = shell_r(d.normalized())
        return on_shell(d + V(1, 0, 0) * (u / r), 0.0048)

    us = [-0.019, 0.0, 0.019]
    vs = [i / 15 for i in range(16)]
    return ak.sheet(f"{R}-hstripe", fn, us, vs, TEAM, rim=0.003, inside=HH)


# ------------------------------------------------------------- torso

# (z, half width, front depth, back depth) of the suit's body.
BODY = [(0.548, 0.07, 0.048, 0.055), (0.562, 0.106, 0.072, 0.084),
        (0.585, 0.13, 0.089, 0.097), (0.612, 0.138, 0.098, 0.102),
        (0.64, 0.134, 0.096, 0.099), (0.69, 0.131, 0.095, 0.096),
        (0.74, 0.14, 0.101, 0.096), (0.79, 0.15, 0.109, 0.099),
        (0.845, 0.157, 0.114, 0.101), (0.9, 0.155, 0.105, 0.097),
        (0.94, 0.126, 0.086, 0.085), (0.97, 0.082, 0.072, 0.072)]
BODY_P = 2.3


def body_at(z):
    return table([b for b in BODY], z)


def body_point(a, z, extra=0.0):
    """A point on the suit at angle a (radians, 0 = front, toward +x)."""
    rx_, ryf, ryb = body_at(z)
    e = 2.0 / BODY_P
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


def suit_body():
    """The quilted body from the crotch to the collar, in vertical
    stitched channels."""
    n = 20
    c = ak.Mesh(f"{R}-body", SUIT)
    # Rows above the yoke's lowest edge are hidden under it: skip them.
    zs = [b[0] for b in BODY if not 0.92 < b[0] < 0.96]
    zs = sorted(set(zs))
    rows = []
    for z in zs:
        row = []
        quilt = 0.57 < z < 0.63 or 0.668 < z < 0.93
        seam = 0.0
        for i in range(n):
            a = i / n * math.tau
            p = body_point(a, z, seam)
            if quilt and i % 2:
                p = V(p.x * 0.962, p.y * 0.962, z)
            if z > 0.86:
                # Under the yoke: kept clear of its coarser facets.
                p = V(p.x * 0.955, p.y * 0.955, z)
            row.append(c.v(p))
        rows.append(row)
    c.grid(rows, SUIT, closed=True)
    c.fan(rows[0], V(0, 0, 0.54), SUIT)
    c.fan(rows[-1], V(0, 0, 0.978), SUIT)
    return c.obj(recalc=True)


YOKE = [(0, 0.786), (20, 0.806), (45, 0.84), (70, 0.866), (100, 0.874),
        (140, 0.862), (180, 0.842)]


def belt():
    """A grey waist seal band with a small gilt buckle plate."""
    rings = [[body_point(i / 20 * math.tau, z, off) for i in range(20)]
             for z, off in ((0.636, -0.002), (0.639, 0.0045), (0.655, 0.0045),
                            (0.658, -0.002))]
    pieces = [ak.loft(f"{R}-belt", rings, HOSE, start=None, end=None)]
    fy = body_point(0, 0.647, 0.0045).y
    pieces.append(ak.rbox(f"{R}-buckle", (0.03, 0.006, 0.022),
                          V(0, fy + 0.002, 0.647), GILT, levels=0))
    return pieces


def badge():
    """Gilt pilot's wings on the left breast of the yoke."""
    half = [(0.0, 0.0075), (0.009, 0.0058), (0.024, 0.0062),
            (0.043, 0.0052), (0.054, 0.0026), (0.042, 0.0006),
            (0.026, -0.0012), (0.011, -0.0026), (0.0, -0.0075)]
    outline = half + [(-x, y) for x, y in reversed(half[1:-1])]
    a = math.radians(-34)
    z = 0.852
    p = body_point(a, z, 0.0045)
    q = body_point(a + 0.02, z, 0.0045)
    tng = (q - p).normalized()
    up = V(0, 0, 1)
    nrm = up.cross(tng).normalized()
    if nrm.y < 0:
        nrm = -nrm
    m = ak.basis(tng, up, nrm, p - nrm * 0.0008)
    disc = [(x, y) for x, y, _ in ak.sup(8, 0.0085, 0.0085)]
    return [ak.slab(f"{R}-wings", outline, 0.003, GILT, matrix=m),
            ak.slab(f"{R}-medal", disc, 0.0048, GILT, matrix=m)]


def yoke():
    """The team yoke over the chest and back, pointed at the breastbone."""
    def fn(ad, v):
        z = lerp(table(YOKE, abs(ad)), 0.966, v ** 0.9)
        return body_point(math.radians(ad), z, 0.0045)

    us = [i * 15 - 180 for i in range(24)]
    vs = [0.0, 0.3, 0.65, 1.0]
    return ak.sheet(f"{R}-yoke", fn, us, vs, TEAM, rim=0.0045,
                    inside=V(0, 0, 0.86), closed_u=True, rim_edges=("v0",))


def shoulder_cap(sx):
    """The yoke carried over the shoulder: a team cap round the shoulder
    ball, low at the outside and cut high at the front and back so the
    lifted and swinging arm never meets it."""
    s = V(sx * SH_X, SH_Y, SH_Z)
    rad = 0.066

    def fn(u, v):
        a = math.radians(u)
        front = max(0.0, math.sin(a)) ** 1.4
        back = max(0.0, -math.sin(a)) ** 1.4
        el0 = 16 + 42 * front + 26 * back
        el = math.radians(lerp(el0, 88, v))
        d = V(sx * math.cos(a) * math.cos(el), math.sin(a) * math.cos(el),
              math.sin(el))
        return s + d * rad

    us = [-120 + i * 24 for i in range(11)]
    if sx < 0:
        us = us[::-1]
    vs = [0.0, 0.45, 1.0]
    return ak.sheet(f"{R}-cap{sx}", fn, us, vs, TEAM, rim=0.0045, inside=s,
                    rim_edges=("v0", "u0", "u1"))


def neck_ring():
    prof = [(0.078, 0.942), (0.104, 0.948), (0.104, 0.978), (0.084, 0.99)]
    return ak.lathe(f"{R}-neckring", prof, GILT, segments=20,
                    caps=(False, False))


def chest_box():
    """A small control box on the stomach under the yoke's point: a dark
    face with two gilt knobs, a toggle and a red lamp, and two corrugated
    grey hoses looping down to gilt ports on the hips."""
    pieces = []
    z0 = 0.742
    fy = body_point(0, z0).y
    c = V(0, fy + 0.012, z0)
    pieces.append(ak.rbox(f"{R}-box", (0.1, 0.044, 0.064), c, SHELL, levels=1,
                          crease=0.85))
    front = c.y + 0.022
    plate = [(x, y) for x, y, _ in ak.sup(16, 0.038, 0.022, 4.0)]
    m = ak.basis(V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0),
                 V(0, front - 0.001, z0 - 0.003))
    pieces.append(ak.slab(f"{R}-boxplate", plate, 0.0035, DARK, matrix=m))
    for k, x in enumerate((-0.021, 0.021)):
        mk = ak.basis(V(1, 0, 0), V(0, 0, -1), V(0, 1, 0),
                      V(x, front + 0.0015, z0 - 0.006))
        pieces.append(ak.lathe(f"{R}-knob{k}",
                               [(0.0085, 0.0), (0.0085, 0.004),
                                (0.006, 0.007)], GILT,
                               matrix=mk, segments=7, caps=(False, True)))
    pieces.append(ak.ball(f"{R}-lamp", 0.0048, V(0, front + 0.002, z0 + 0.012),
                          RAY, seg=6, rings=4))
    pieces.append(ak.tube(f"{R}-toggle", [V(0, front + 0.002, z0 - 0.009),
                                          V(0, front + 0.011, z0 - 0.004)],
                          [0.0022, 0.0018], CHROME, n=5))
    # Hoses from the lower corners of the box to the hip ports.
    for sx in (-1, 1):
        a_port = math.radians(sx * 50)
        port = body_point(a_port, 0.625, 0.0)
        pn = V(port.x, port.y * 1.5, 0).normalized()
        ctrl = [V(sx * 0.038, c.y + 0.004, z0 - 0.03),
                V(sx * 0.058, c.y + 0.016, z0 - 0.06),
                V(sx * 0.082, c.y + 0.006, z0 - 0.095),
                port + pn * 0.03 + V(0, 0, 0.012),
                port + pn * 0.006]
        path = [V(p) for p in kit.smooth_path(ctrl, 3)]
        radii = [0.0098 if k % 2 == 0 else 0.0082 for k in range(len(path))]
        pieces.append(ak.tube(f"{R}-hose{sx}", path, radii, HOSE, n=5,
                              caps=(None, None)))
        mp = ak.basis(V(0, 0, 1).cross(pn), V(0, 0, 1), pn, port - pn * 0.004)
        pieces.append(ak.lathe(f"{R}-port{sx}",
                               [(0.017, 0.0), (0.017, 0.006),
                                (0.012, 0.011), (0.012, 0.016)],
                               GILT, matrix=mp, segments=8,
                               caps=(False, False)))
        # A collar where the hose leaves the box.
        d0 = (path[1] - path[0]).normalized()
        pieces.append(ak.tube(f"{R}-collar{sx}",
                              [path[0] - d0 * 0.004, path[0] + d0 * 0.008],
                              [0.0118, 0.0118], GILT, n=8,
                              caps=("flat", "flat")))
    return pieces


def backpack():
    """A compact white life-support pack: a rounded case on the back with
    two oxygen bottles standing on it, each with a grey strap and a gilt
    valve on top."""
    pieces = []
    c = V(0, -0.132, 0.8)
    pieces.append(ak.rbox(f"{R}-pack", (0.2, 0.066, 0.23), c, SHELL, levels=2,
                          crease=0.66))
    for k, x in enumerate((-0.049, 0.049)):
        axis = V(x, c.y - 0.052, 0.0)
        pieces.append(ak.tube(f"{R}-bottle{k}",
                              [axis + V(0, 0, 0.705), axis + V(0, 0, 0.9)],
                              [0.036, 0.036], SHELL, n=10,
                              caps=("dome", "dome")))
        pieces.append(ak.tube(f"{R}-band{k}",
                              [axis + V(0, 0, 0.77), axis + V(0, 0, 0.785)],
                              [0.0385, 0.0385], HOSE, n=10,
                              caps=(None, None)))
        pieces.append(ak.lathe(f"{R}-valve{k}",
                               [(0.011, 0.918), (0.011, 0.93),
                                (0.015, 0.932), (0.015, 0.94), (0.0, 0.942)],
                               GILT, segments=8, caps=(False, True),
                               matrix=Matrix.Translation(axis)))
    return pieces


# ------------------------------------------------------------- limbs

def envelope(path, radii):
    """Radius along a polyline (by length fraction), bridging bellows."""
    path = [V(p) for p in path]
    cum = [0.0]
    for a, b in zip(path, path[1:]):
        cum.append(cum[-1] + (b - a).length)
    total = cum[-1]

    def at(t):
        d = t * total
        near = [r for r, cd in zip(radii, cum) if abs(cd - d) < 0.016]
        for k in range(len(cum) - 1):
            if cum[k] <= d <= cum[k + 1] or k == len(cum) - 2:
                f = clamp01((d - cum[k]) / max(1e-9, cum[k + 1] - cum[k]))
                near.append(lerp(radii[k], radii[k + 1], f))
                break
        return max(near)
    return at


def stripe(name, path, radii, out, t0, t1, half=0.017, lift=0.0032, nv=12):
    """A raised team stripe down the outside of a limb tube."""
    rad = envelope(path, radii)
    out = V(out)

    def fn(u, v):
        t = lerp(t0, t1, v)
        c, tng = ak.polyline_at(path, t)
        r = rad(t) + lift
        o = (out - tng * out.dot(tng)).normalized()
        side = tng.cross(o)
        th = u / r
        return c + (o * math.cos(th) + side * math.sin(th)) * r

    mid, _ = ak.polyline_at(path, (t0 + t1) / 2)
    us = [-half, 0.0, half]
    vs = [i / nv for i in range(nv + 1)]
    return ak.sheet(name, fn, us, vs, TEAM, rim=0.003, inside=mid)


def fist(name, c, xax, kax, chir, mat=CHROME, size=1.06):
    """A closed gloved fist round a pole along Z (the index finger's end),
    fingers toward X, the back of the hand toward K; the wrist at -X."""
    zs = [-0.036, -0.029, -0.017, 0.0, 0.017, 0.029, 0.036]
    grooves = {-0.017, 0.0, 0.017}
    ring_n = 10
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
        for x, y, ang in ak.sup(ring_n, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.004 * (1 if px > 0.004 else 0.5)
                py += 0.003 if py < -0.01 else 0.0
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0022
                py += 0.0022
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [ak.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                      end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(ak.tube(f"{name}-thumb", thumb, [0.0102, 0.009, 0.0082],
                          mat, n=5))
    pieces.append(ak.tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                           V(-0.03, 0.0, 0.0)],
                          [(0.022, 0.027), (0.025, 0.03)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = V(xax).normalized(), V(kax).normalized()
    kax = (kax - xax * kax.dot(xax)).normalized()
    zax = xax.cross(kax) * chir
    m = ak.basis(xax * size, kax * size, zax * size, c)
    ak.transform(pieces, m)
    return pieces


def sleeve(name, s, e, w, sx):
    """The quilted sleeve from the shoulder ball over a bellows elbow to
    the wrist, a team stripe down its outside, a gilt wrist ring and a
    silver gauntlet cuff."""
    u = (e - s).normalized()
    f = (w - e).normalized()
    path = [s - u * 0.012, s + u * 0.03, lerp(s, e, 0.4), e - u * 0.046,
            e - u * 0.031, e - u * 0.016, e, e + f * 0.016, e + f * 0.031,
            e + f * 0.046, lerp(e, w, 0.55), w - f * 0.03, w]
    radii = [0.05, 0.053, 0.05, 0.047, 0.0505, 0.046, 0.0505, 0.046, 0.0495,
             0.045, 0.044, 0.041, 0.039]
    pieces = [ak.tube(f"{name}-sleeve", path, radii, SUIT, n=10,
                      caps=(None, None),
                      flute=lambda i: 0.04 if i in (1, 2, 10) else 0.0)]
    pieces.append(ak.ball(f"{name}-ball", 0.054, s + V(sx * 0.005, 0, 0),
                          SUIT, seg=9, rings=5))
    out = V(sx, 0, 0)
    pieces.append(stripe(f"{name}-stripe", path, radii, out, 0.05, 0.95,
                         half=0.019))
    # Gilt wrist ring, then the gauntlet's flared cuff down to the hand.
    ring_c = w - f * 0.036
    pieces.append(ak.tube(f"{name}-wring",
                          [ring_c - f * 0.007, ring_c + f * 0.007],
                          [0.0445, 0.0445], GILT, n=12,
                          caps=("flat", "flat")))
    # The gauntlet: a bell cuff with a rolled rim under the ring.
    rings = []
    k_up = V(0, 0, 1) - f * f.z
    for d, r in ((0.002, 0.042), (0.008, 0.0495), (0.013, 0.05),
                 (0.026, 0.043), (0.04, 0.034)):
        rings.append(ak.rings_along([ring_c + f * d, ring_c + f * (d + 0.001)],
                                    [r, r], 12, up=k_up)[0])
    pieces.append(ak.loft(f"{name}-gauntlet", rings, CHROME, start="flat",
                          end=None))
    return pieces


def build_armR():
    """Modelled in the aim: straight out forward, the fist on the grip."""
    z_f = (G_UP * math.cos(RAKE) + B_AIM * math.sin(RAKE)).normalized()
    k_f = G_RIGHT
    x_f = z_f.cross(k_f)
    w = C_AIM - x_f * WRIST_FIST
    e = ak.ik(S_R, w, UPPER, FORE, S_R + V(0.35, 0.18, -0.28))
    pieces = sleeve(f"{R}-armR", S_R, e, w, 1)
    pieces += fist(f"{R}-fistR", C_AIM, x_f, k_f, -1)
    ak.transform(pieces, M_REST)
    bend = math.degrees((e - S_R).angle(w - e))
    return pieces, bend


def ray_gun():
    """A 1960s ray gun in its own frame (y along the barrel, z up, the
    grip's centre in the fist at the origin): a chrome bulb with swept
    fins, a gilt collar, three finned rings on the barrel, a flared
    emitter and a red glowing tip."""
    pieces = []
    zb = GUN_Z
    # Local z along the barrel for the lathes: x -> x, y (barrel) -> z.
    along = ak.basis(V(1, 0, 0), V(0, 0, -1), V(0, 1, 0), V(0, 0, zb))

    def lathe(name, prof, mat, seg=16, caps=(True, True)):
        return ak.lathe(f"{R}-gun-{name}", [(r, y) for r, y in prof], mat,
                        matrix=along, segments=seg, caps=caps)

    pieces.append(lathe("body", [(0.0, -0.074), (0.015, -0.071),
                                 (0.026, -0.061), (0.032, -0.045),
                                 (0.033, -0.028), (0.029, -0.011),
                                 (0.02, 0.002), (0.013, 0.01)], CHROME,
                        seg=11, caps=(True, False)))
    pieces.append(lathe("collar", [(0.014, 0.002), (0.0185, 0.004),
                                   (0.0185, 0.013), (0.013, 0.015)], GILT,
                        seg=10, caps=(False, False)))
    pieces.append(lathe("barrel", [(0.0105, 0.012), (0.0105, 0.104)],
                        CHROME, seg=10, caps=(False, False)))
    for k, y in enumerate((0.034, 0.055, 0.076)):
        pieces.append(lathe(f"fin{k}", [(0.0105, y - 0.0045),
                                        (0.0245, y - 0.0018),
                                        (0.0245, y + 0.0018),
                                        (0.0105, y + 0.0045)], CHROME,
                            seg=10, caps=(False, False)))
    pieces.append(lathe("emitter", [(0.0105, 0.098), (0.014, 0.106),
                                    (0.021, 0.121), (0.0225, 0.128),
                                    (0.017, 0.13)], CHROME, seg=10,
                        caps=(False, False)))
    pieces.append(lathe("tip", [(0.0, 0.124), (0.0172, 0.124),
                                (0.0178, 0.13), (0.013, 0.139),
                                (0.0, 0.1445)], RAY, seg=10))
    # Three swept fins round the bulb (top, and two slanting down).
    fin = [(0.022, -0.066), (0.024, -0.02), (0.033, -0.03), (0.046, -0.062),
           (0.047, -0.082), (0.036, -0.08)]
    for k, roll in enumerate((90, 215, 325)):
        o = ak.slab(f"{R}-gun-rfin{k}", fin, 0.0045, CHROME)
        o.data.transform(Matrix.Translation(V(0, 0, -0.00225)))
        # The outline lies in local (x = out, y = along); stand it up.
        a = math.radians(roll)
        radial = V(math.cos(a), 0, math.sin(a))
        mf = ak.basis(radial, V(0, 1, 0), radial.cross(V(0, 1, 0)),
                      V(0, 0, zb))
        ak.transform([o], mf)
        pieces.append(o)
    # A small blade sight on the top of the barrel's root.
    sight = [(0.0, -0.012), (0.0, 0.016), (0.008, 0.012), (0.01, -0.006)]
    o = ak.slab(f"{R}-gun-sight", sight, 0.003, CHROME)
    o.data.transform(Matrix.Translation(V(0, 0, -0.0015)))
    ak.transform([o], ak.basis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0),
                               V(0, 0, zb + 0.009)))
    pieces.append(o)
    # The grip, raked back, with a chrome butt cap.
    g = V(0, math.sin(RAKE), math.cos(RAKE))
    grip_path = [-g * 0.047, -g * 0.02, g * 0.01, g * 0.03 + V(0, 0, 0.006)]
    pieces.append(ak.tube(f"{R}-gun-grip", grip_path,
                          [(0.012, 0.0185), (0.0125, 0.0195), (0.0125, 0.02),
                           (0.012, 0.019)], GRIP, n=10, up=(0, 1, 0),
                          power=2.6, caps=("flat", None)))
    pieces.append(ak.lathe(f"{R}-gun-butt", [(0.0145, 0.0), (0.016, 0.004),
                                              (0.0, 0.01)], CHROME,
                           matrix=ak.basis(V(1, 0, 0),
                                           (-g).cross(V(1, 0, 0)), -g,
                                           -g * 0.05), segments=10))
    # Trigger guard and trigger.
    guard = [V(0, 0.022, -0.004), V(0, 0.036, -0.012), V(0, 0.046, -0.002),
             V(0, 0.044, zb - 0.026)]
    pieces.append(ak.tube(f"{R}-gun-guard", guard, [0.0026] * 4, CHROME,
                          n=4))
    pieces.append(ak.tube(f"{R}-gun-trigger",
                          [V(0, 0.03, zb - 0.03), V(0, 0.033, -0.001)],
                          [0.0035, 0.0028], GILT, n=5))
    s = Matrix.Scale(GUN_S, 4)
    ak.transform(pieces, s)
    return pieces


def build_weapon():
    pieces = ray_gun()
    m = ak.basis(G_RIGHT, B_AIM, G_UP, C_AIM)
    ak.transform(pieces, m)
    ak.transform(pieces, M_REST)
    return pieces, M_REST @ C_AIM


def build_armL():
    """Hanging relaxed beside the thigh, the fist loosely closed."""
    w = V(-0.214, 0.028, 0.5)
    e = ak.ik(S_L, w, UPPER, FORE, S_L + V(-0.3, -0.3, -0.25))
    fdir = (w - e).normalized()
    x_f = (fdir + V(0.08, 0.1, 0)).normalized()
    c = w + x_f * WRIST_FIST
    pieces = sleeve(f"{R}-armL", S_L, e, w, -1)
    pieces += fist(f"{R}-fistL", c, x_f, V(-1, 0.1, 0), 1)
    return pieces


def boot(name, ankle, knee, sx, toe_out):
    """A white ankle boot on a dark sole with a heel, a grey strap with a
    gilt buckle and a rolled top."""
    pieces = []
    foot = [(-0.068, 0.032, 0.026, 0.072), (-0.06, 0.043, 0.026, 0.098),
            (-0.034, 0.05, 0.026, 0.112), (0.008, 0.052, 0.026, 0.104),
            (0.056, 0.052, 0.026, 0.082), (0.096, 0.047, 0.026, 0.066),
            (0.126, 0.037, 0.028, 0.054), (0.144, 0.023, 0.032, 0.045)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in ak.sup(9, rx_, (zt - zb) / 2, 2.6, math.pi / 9):
            ring.append(V(x, y, max(zb, (zb + zt) / 2 + z)))
        rings.append(ring)
    pieces.append(ak.loft(f"{name}-foot", rings, SHELL,
                          start=V(0, -0.072, 0.05), end=V(0, 0.152, 0.037)))
    # The sole: a dark slab a little proud of the upper, a heel block.
    outline = [(x * (1.0 if y < 0.03 else 1.05), y + 0.038)
               for x, y, _ in ak.sup(14, 0.056, 0.114, 2.4)]
    pieces.append(ak.slab(f"{name}-sole", outline, 0.028, SOLE))
    heel = [(x, y - 0.043) for x, y, _ in ak.sup(8, 0.052, 0.034, 3.0)]
    pieces.append(ak.slab(f"{name}-heel", heel, 0.018, SOLE))
    m = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    ak.transform(pieces, m)

    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    # The shaft and its rolled top in one piece.
    rings = []
    for z, r in ((0.07, 0.054), (0.13, 0.0565), (0.182, 0.0585),
                 (0.19, 0.0628), (0.206, 0.0632), (0.215, 0.0585),
                 (0.215, 0.046)):
        c = on_leg(z)
        rings.append([c + V(x, y, 0) for x, y, _ in ak.sup(10, r, r * 1.02)])
    cuff = ak.loft(f"{name}-cuff", rings, SHELL, start=None, end=None)
    rings = []
    for z, r in ((0.112, 0.0572), (0.114, 0.0605), (0.13, 0.0605),
                 (0.132, 0.0575)):
        c = on_leg(z)
        rings.append([c + V(x, y, 0) for x, y, _ in ak.sup(10, r, r * 1.02)])
    strap = ak.loft(f"{name}-strap", rings, HOSE, start=None, end=None)
    bc = on_leg(0.122) + V(sx * 0.062, 0.0, 0)
    buckle = ak.rbox(f"{name}-buckle", (0.006, 0.022, 0.022), bc, GILT,
                     levels=0)
    return pieces + [cuff, strap, buckle]


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    u = (knee - hip).normalized()
    f = (ankle - knee).normalized()
    path = [hip + V(0, 0, 0.02), lerp(hip, knee, 0.3), lerp(hip, knee, 0.62),
            knee - u * 0.05, knee - u * 0.033, knee - u * 0.016, knee,
            knee + f * 0.016, knee + f * 0.033, lerp(knee, ankle, 0.42),
            lerp(knee, ankle, 0.68), ankle]
    radii = [0.074, 0.071, 0.065, 0.058, 0.0625, 0.057, 0.0625, 0.057, 0.061,
             0.056, 0.052, 0.05]
    pieces = [ak.tube(f"{R}-leg{sx}", path, radii, SUIT, n=10, up=(0, 1, 0),
                      caps=("dome", None),
                      flute=lambda i: 0.045 if i in (1, 2, 3) else 0.0)]
    # The stripe from under the hip to the boot top.
    length = sum((b - a).length for a, b in zip(path, path[1:]))
    t0 = 0.075 / length
    t1 = 1.0 - (0.2 - ankle.z) / length
    pieces.append(stripe(f"{R}-lstripe{sx}", path, radii, V(sx, 0, 0), t0,
                         t1, half=0.021, nv=10))
    pieces += boot(f"{R}-boot{sx}", ankle, knee, sx, toe_out)
    return pieces, hip


# ------------------------------------------------------------- build

def build(root_name="archers"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.092, -0.006, 0.322), V(-0.102, -0.018, 0.078), 12),
            ("R", 1, V(0.09, 0.02, 0.322), V(0.1, 0.022, 0.078), 8)):
        pieces, hip = leg(sx, knee, ankle, out)
        ak.part(R, f"leg{side}", pieces, hip, root)

    torso = [suit_body(), yoke(), shoulder_cap(1), shoulder_cap(-1),
             neck_ring()] + belt() + badge() + chest_box() + backpack()
    torso_obj = ak.part(R, "torso", torso, WAIST, root)

    shell = helmet()
    head = [face(), shell, helmet_stripe()] + eyes() + mouth() + visor()
    ak.part(R, "head", head, NECK, torso_obj, angle=58)

    arm_r, bend = build_armR()
    arm_r_obj = ak.part(R, "armR", arm_r, S_R, torso_obj)
    gun, grip = build_weapon()
    ak.part(R, "weapon", gun, grip, arm_r_obj, angle=40)
    ak.part(R, "armL", build_armL(), S_L, torso_obj)

    report(root, bend)
    pose(root, os.environ.get("ARCHERS_POSE", ""))
    return root


POSES = {
    # The attack check: the gun up (a little past the steady aim), the
    # off arm raised, the legs apart as far as the walk swings them.
    "aim": {"armR": (1.6, 0, 0), "armL": (0.45, 0, 0), "torso": (0, 0, TURN),
            "legL": (0.6, 0, 0), "legR": (-0.6, 0, 0)},
    # The steady aim exactly as the game holds it.
    "blaster": {"armR": (AIM, 0, 0), "armL": (0.45, 0, 0),
                "torso": (0, 0, TURN), "head": (0.06, 0, 0)},
    "walk": {"legL": (0.62, 0, 0), "legR": (-0.62, 0, 0),
             "armL": (-0.4, 0, 0), "armR": (0.4, 0, 0),
             "torso": (0, 0, -0.13)},
}


def pose(root, name):
    if name not in POSES:
        return
    for o in kit.descendants(root):
        key = o.name.split(".", 1)[1] if "." in o.name else ""
        if key in POSES[name]:
            o.rotation_euler = POSES[name][key]
    kit.refresh()
    for o in kit.descendants(root):
        if o.name == f"{R}.weapon":
            mw = o.matrix_world
            d = (mw.to_3x3() @ (M_REST.to_3x3() @ B_AIM)).normalized()
            g = mw.translation
            print(f"CADET pose {name}: grip {tuple(round(c, 3) for c in g)}"
                  f" barrel {tuple(round(c, 3) for c in d)}")


def report(root, bend):
    print(f"CADET elbow bend in the aim {bend:.1f} deg")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {ak.tris(o)} mats "
                  f"{[m.name for m in o.data.materials]}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print(f"CADET materials ({len(mats)}): {mats}")
