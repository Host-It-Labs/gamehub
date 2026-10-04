"""The Cadets (card id `archers`, two per card) as collector's miniatures:
eager 1960s space-race rookies in hand-painted resin.

An off-white quilted pressure suit with team panels (a chest yoke over the
shoulders, a stripe down the outside of each arm and leg, team boot tops
and a team life-support pack), a gilt neck ring and wrist rings, a dark
belt with a big round gilt buckle, a round bubble helmet (drawn a size
larger than the sculpt, HEAD_S) with a padded face seal, gilt radio pods
over the ears with team bosses, its gold visor raised on hinges over a
grinning clean-shaven face and a springy whip antenna with a glowing red
bead, a small chest control box with two corrugated hoses to gilt hip
ports, silver gauntlets (a fist on the gun, an open glove on the left),
chunky white moon boots on dark soles, and a chrome 1960s ray gun with
finned barrel rings and a red glowing emitter in the right fist.

Parts (the contract of troops.py), none with a rest rotation:

  archers            root at the feet, facing +y
    legL/R           thighs, pivots on the hips
      kneeL/R        shins and boot shafts from a bellows knee (split here,
                     so figures.py's knee split leaves them alone)
        footL/R      the boots' feet, on the ankles
    torso            at the waist: yoke, caps, neck ring, belt, chest box,
                     hoses and pack
      head           at the neck: face, helmet, pods
        hat          the visor, on the pods' hinge line (bounces)
        antenna      the whip antenna, at its gilt foot (springs)
      armR           upper arm at the shoulder
        foreR        forearm and fist from the elbow
          weapon     the ray gun, pivot in the fist
      armL           upper arm
        foreL        forearm from the elbow
          handL      the open glove, on the wrist

The right arm and the gun are modelled in the aim (arm straight out
forward, gun level) and then swung down by AIM about the shoulder's x axis,
so at rest the gun hangs muzzle down beside the thigh; armR + foreR +
weapon summing to AIM (with the torso turned TURN to the left) brings it
back level along +y. The rest barrel is aimed 10 degrees to the right to
cancel that torso turn. components/game/arena/moves/archers.ts poses it.

ARCHERS_POSE=aim, blaster, walk, carry or salute poses the figure before
the previews are rendered.
"""

import math
import os

import kit
import face_rig
import face_paint
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
SKIN = "resin:" + T("cadet-skin", "#e3ae8b")
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
GUN_S = 1.16

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


def paint_patch(label, side, ac, z, width, height, lift, mat, dz=0.0,
                da=0.0, rings=3, seg=16, slope=0.0):
    """One layer of painted eye (face_paint.py's look, fewer triangles:
    two cadets per card): an oval subdivided across the socket so it
    follows the concave surface."""
    import bmesh
    bm = bmesh.new()

    def vertex(radius, t):
        u = ac + da + math.cos(t) * width * radius
        v = z + dz + math.sin(t) * height * radius + \
            math.cos(t) * slope * radius
        p = face_point(u, v)
        return bm.verts.new(p + face_normal(u, v) * lift)

    middle = vertex(0, 0)
    prev = None
    for ring in range(1, rings + 1):
        cur = [vertex(ring / rings, i / seg * math.tau) for i in range(seg)]
        for i in range(seg):
            j = (i + 1) % seg
            if prev:
                bm.faces.new((prev[i], prev[j], cur[j], cur[i]))
            else:
                bm.faces.new((middle, cur[i], cur[j]))
        prev = cur
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - HC) < 0:
            f.normal_flip()
    obj = kit._from_bmesh(f"{R}-{label}{side}", bm, mat)
    kit.shade(obj)
    return obj


def eyes():
    """Big painted eyes (ink rim, ivory, iris, pupil, catchlight) under
    eager raised brows, and the confident grin."""
    out = []
    z = 1.1565
    iris = "resin:" + T("face-iris", "#725032")
    for side in (-1, 1):
        ac = side * 27
        slope = side * 0.003
        out.append(paint_patch("eye-outline", side, ac, z, 15.0, 0.0142,
                               0.003, face_paint.INK, slope=slope))
        out.append(paint_patch("eye-white", side, ac, z, 13.4, 0.0121,
                               0.004, face_paint.WHITE, slope=slope))
        out.append(paint_patch("iris", side, ac, z, 6.6, 0.0102, 0.005,
                               iris, dz=0.0015, rings=2, seg=12,
                               slope=slope))
        out.append(paint_patch("pupil", side, ac, z, 3.8, 0.0083, 0.0058,
                               face_paint.INK, dz=0.0015, rings=2, seg=10,
                               slope=slope))
        out.append(paint_patch("catchlight", side, ac, z, 1.9, 0.0028,
                               0.0065, face_paint.WHITE, dz=0.005, da=-2.0,
                               rings=1, seg=8))
        # Eager brows: both raised a touch, the left one higher.
        up = 0.004 + (0.003 if side == -1 else 0.0)
        brow = [(ac - 15, z + 0.020 - slope + up), (ac, z + 0.026 + up),
                (ac + 15, z + 0.020 + slope + up),
                (ac + 15, z + 0.025 + slope + up), (ac, z + 0.033 + up),
                (ac - 15, z + 0.025 - slope + up)]
        out.append(ak.decal(f"{R}-expression-brow{side}", face_point, brow,
                            0.0045, face_paint.INK, depth=0.001, eps=0.05,
                            ref=HC))
    return out + face_paint.mouth(ak, R, face_point, HC,
                                  expression="confident")


# ------------------------------------------------------------- helmet

HH = V(0, 0.008, 1.12)          # helmet centre
H_RX, H_RYF, H_RYB, H_RZU, H_RZD = 0.124, 0.131, 0.127, 0.135, 0.142
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
    a = 74 * spow(sn, 0.78)
    z = 1.13 + (0.095 if c > 0 else 0.086) * spow(c, 0.85)
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
    n = 40
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
    ts = [0.07, 0.16, 0.26, 0.36, 0.46, 0.56, 0.66, 0.75, 0.84, 0.92, 1.0]
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
    to the hinges, with a lift tab at its lower edge. Its own joint (`hat`)
    turns on the hinge pods, so it bounces on every landing."""
    def fn(u, v):
        k = (u / 80) ** 2
        el = lerp(56 - 16 * k, 90 - 25 * k, v)
        return on_shell(sdir(u, el), 0.0075)

    us = [-80 + i * 10 for i in range(17)]
    vs = [0.0, 0.25, 0.5, 0.75, 1.0]
    pieces = [ak.sheet(f"{R}-visor", fn, us, vs, VISOR, rim=0.0065,
                       inside=HH)]
    # A small lift tab at the bottom of the visor.
    at = on_shell(sdir(0, 55), 0.0085)
    nrm = sdir(0, 55)
    m = ak.basis(V(1, 0, 0), nrm.cross(V(1, 0, 0)), nrm, at)
    tab = [(x, y - 0.006) for x, y, _ in ak.sup(10, 0.018, 0.0085, 3.0)]
    pieces.append(ak.slab(f"{R}-visortab", tab, 0.006, VISOR, matrix=m))
    return pieces


POD_AZ, POD_EL = 90, 16


def pod_frame(sx, lift=0.0):
    d = sdir(sx * POD_AZ, POD_EL)
    up = V(0, 0, 1) - d * d.z
    return ak.basis(up.cross(d).normalized(), up.normalized(), d,
                    on_shell(d, lift)), d


def ear_pods():
    """Round gilt radio pods over the ears (the card's), a team boss in
    each; the visor hinges on them."""
    pieces = []
    for sx in (-1, 1):
        mh, _ = pod_frame(sx, -0.003)
        pieces.append(ak.lathe(f"{R}-pod{sx}",
                               [(0.031, 0.0), (0.033, 0.006),
                                (0.031, 0.012), (0.024, 0.0135),
                                (0.019, 0.0125)], GILT,
                               matrix=mh, segments=14, caps=(False, False)))
        pieces.append(ak.lathe(f"{R}-boss{sx}",
                               [(0.0195, 0.0095), (0.017, 0.016),
                                (0.009, 0.0195), (0.0, 0.0205)], TEAM,
                               matrix=mh, segments=12, caps=(False, True)))
    return pieces


def hinge_pivot():
    a = on_shell(sdir(-POD_AZ, POD_EL))
    b = on_shell(sdir(POD_AZ, POD_EL))
    return (a + b) / 2


def antenna():
    """A springy whip antenna from the left pod, up and a little back,
    with a glowing red bead on its tip: its own joint (`antenna`)."""
    mh, d = pod_frame(-1, 0.0)
    base = mh.translation + d * 0.014 + V(0, -0.004, 0.022)
    tip = base + V(-0.01, -0.026, 0.125)
    mid = base.lerp(tip, 0.5) + V(-0.003, 0.0, 0.0)
    pieces = [ak.tube(f"{R}-whip", [base, base + V(0, 0, 0.014), mid, tip],
                      [0.0078, 0.0064, 0.005, 0.0042], CHROME, n=6,
                      caps=("flat", None))]
    pieces.append(ak.lathe(f"{R}-antfoot", [(0.0115, -0.006), (0.0115, 0.006),
                                            (0.0085, 0.012),
                                            (0.0075, 0.014)], GILT,
                           matrix=Matrix.Translation(base), segments=10,
                           caps=(True, False)))
    pieces.append(ak.ball(f"{R}-bead", 0.0165, tip + V(0, 0, 0.009), RAY,
                          seg=10, rings=6))
    return pieces, base


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
    n = 28
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
    """A dark utility belt with a big round gilt buckle (the card's) and a
    gilt stud over each hip."""
    n = 24
    rings = [[body_point(i / n * math.tau, z, off) for i in range(n)]
             for z, off in ((0.632, -0.002), (0.635, 0.006), (0.66, 0.006),
                            (0.663, -0.002))]
    pieces = [ak.loft(f"{R}-belt", rings, DARK, start=None, end=None)]
    for k, ad in enumerate((0, -62, 62)):
        a = math.radians(ad)
        p = body_point(a, 0.6475, 0.006)
        q = body_point(a + 0.02, 0.6475, 0.006)
        tng = (q - p).normalized()
        nrm = V(0, 0, 1).cross(tng).normalized()
        if nrm.dot(V(p.x, p.y, 0)) < 0:
            nrm = -nrm
        r = 0.024 if ad == 0 else 0.0125
        m = ak.basis(tng, V(0, 0, 1), nrm, p - nrm * 0.002)
        prof = [(r, 0.0), (r, 0.004), (r * 0.86, 0.008), (r * 0.5, 0.0095),
                (0.0, 0.01)]
        pieces.append(ak.lathe(f"{R}-stud{k}", prof, GILT, matrix=m,
                               segments=14 if ad == 0 else 8,
                               caps=(False, True)))
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
    pieces.append(ak.rbox(f"{R}-pack", (0.2, 0.066, 0.23), c, TEAM, levels=2,
                          crease=0.66))
    for k, x in enumerate((-0.049, 0.049)):
        axis = V(x, c.y - 0.052, 0.0)
        pieces.append(ak.tube(f"{R}-bottle{k}",
                              [axis + V(0, 0, 0.705), axis + V(0, 0, 0.9)],
                              [0.036, 0.036], SHELL, n=14,
                              caps=("dome", "dome")))
        pieces.append(ak.tube(f"{R}-band{k}",
                              [axis + V(0, 0, 0.77), axis + V(0, 0, 0.785)],
                              [0.0385, 0.0385], HOSE, n=14,
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


def upper_sleeve(name, s, e, sx):
    """The quilted upper sleeve from the shoulder ball to a rounded elbow,
    a team stripe down its outside."""
    u = (e - s).normalized()
    path = [s - u * 0.012, s + u * 0.03, lerp(s, e, 0.4), lerp(s, e, 0.7),
            e - u * 0.03, e - u * 0.012, e]
    radii = [0.05, 0.053, 0.0505, 0.049, 0.0495, 0.0485, 0.0475]
    pieces = [ak.tube(f"{name}-upper", path, radii, SUIT, n=12,
                      caps=(None, "dome"),
                      flute=lambda i: 0.035 if i in (1, 2, 3) else 0.0)]
    pieces.append(ak.ball(f"{name}-ball", 0.054, s + V(sx * 0.005, 0, 0),
                          SUIT, seg=12, rings=6))
    pieces.append(stripe(f"{name}-stripe", path, radii, V(sx, 0, 0), 0.06,
                         1.0, half=0.019, nv=8))
    return pieces


def fore_sleeve(name, e, w, sx, up=V(0, 0, 1)):
    """The forearm from a bellows elbow to the wrist: a team cuff band, a
    gilt wrist ring and the silver gauntlet's flared cuff."""
    f = (w - e).normalized()
    path = [e - f * 0.006, e + f * 0.012, e + f * 0.026, e + f * 0.04,
            lerp(e, w, 0.55), w - f * 0.03, w]
    radii = [0.044, 0.0495, 0.0455, 0.0485, 0.0445, 0.0415, 0.0395]
    pieces = [ak.tube(f"{name}-fore", path, radii, SUIT, n=12,
                      caps=("dome", None))]
    pieces.append(stripe(f"{name}-fstripe", path, radii, V(sx, 0, 0), 0.04,
                         0.8, half=0.019, nv=7))
    ring_c = w - f * 0.036
    pieces.append(ak.tube(f"{name}-wring",
                          [ring_c - f * 0.007, ring_c + f * 0.007],
                          [0.0455, 0.0455], GILT, n=14,
                          caps=("flat", "flat")))
    rings = []
    k_up = V(up) - f * f.dot(V(up))
    for d, r in ((0.002, 0.042), (0.008, 0.0495), (0.013, 0.051),
                 (0.026, 0.044), (0.04, 0.034)):
        rings.append(ak.rings_along([ring_c + f * d, ring_c + f * (d + 0.001)],
                                    [r, r], 14, up=k_up)[0])
    pieces.append(ak.loft(f"{name}-gauntlet", rings, CHROME, start="flat",
                          end=None))
    return pieces


def open_hand(name, c, xax, kax, zax):
    """A relaxed open glove: the palm and the fingers together in one
    mitten, curling a little toward the palm, and a thumb along the front.
    Built from the wrist `c` along X (the fingers), the back of the hand
    toward K, the thumb's side toward Z."""
    rings = []
    for x, w, t, curl in ((-0.012, 0.036, 0.022, 0.0),
                          (0.004, 0.044, 0.025, 0.0),
                          (0.024, 0.05, 0.026, 0.0),
                          (0.046, 0.052, 0.023, 0.002),
                          (0.066, 0.049, 0.019, 0.006),
                          (0.082, 0.043, 0.016, 0.011),
                          (0.093, 0.034, 0.013, 0.016)):
        ring = []
        for a, b, _ in ak.sup(12, t, w / 2, 2.6):
            ring.append(V(x, a - curl, b))
        rings.append(ring)
    pieces = [ak.loft(f"{name}-palm", rings, CHROME,
                      start=V(-0.016, 0, 0), end=V(0.1, -0.018, 0))]
    pieces.append(ak.tube(f"{name}-thumb", [V(0.014, -0.008, 0.02),
                                            V(0.034, -0.014, 0.031),
                                            V(0.056, -0.02, 0.031)],
                          [0.0105, 0.0094, 0.0084], CHROME, n=7))
    m = ak.basis(V(xax).normalized(), V(kax).normalized(),
                 V(zax).normalized(), c)
    ak.transform(pieces, m)
    return pieces


def build_armR():
    """Modelled in the aim: straight out forward, the fist on the grip;
    the upper arm and the forearm (`foreR`, from the elbow) apart."""
    z_f = (G_UP * math.cos(RAKE) + B_AIM * math.sin(RAKE)).normalized()
    k_f = G_RIGHT
    x_f = z_f.cross(k_f)
    w = C_AIM - x_f * WRIST_FIST
    e = ak.ik(S_R, w, UPPER, FORE, S_R + V(0.35, 0.18, -0.28))
    upper = upper_sleeve(f"{R}-armR", S_R, e, 1)
    fore = fore_sleeve(f"{R}-armR", e, w, 1)
    fore += fist(f"{R}-fistR", C_AIM, x_f, k_f, -1)
    ak.transform(upper + fore, M_REST)
    bend = math.degrees((e - S_R).angle(w - e))
    return upper, fore, M_REST @ e, bend


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


# The left arm hangs relaxed beside the thigh, a little forward, the open
# hand's palm toward the leg.
W_L = V(-0.21, 0.034, 0.5)


def build_armL():
    """The upper arm, the forearm (`foreL`) and the open hand (`handL`, on
    the wrist), each its own joint for salutes and waves."""
    e = ak.ik(S_L, W_L, UPPER, FORE, S_L + V(-0.3, -0.3, -0.25))
    fdir = (W_L - e).normalized()
    upper = upper_sleeve(f"{R}-armL", S_L, e, -1)
    fore = fore_sleeve(f"{R}-armL", e, W_L, -1, up=V(0, 1, 0))
    x_h = (fdir + V(0.02, 0.06, 0)).normalized()
    k_h = V(-1, 0, 0) - x_h * x_h.x
    z_h = k_h.cross(x_h)
    if z_h.y < 0:
        z_h = -z_h
    hand = open_hand(f"{R}-handL", W_L - x_h * 0.006, x_h, k_h, z_h)
    return upper, fore, e, hand


def boot(name, ankle, knee, sx, toe_out):
    """A chunky white moon boot on a thick dark sole with a heel; its shaft
    (on the shin) has a grey strap with a gilt buckle and a team top."""
    foot = []
    rings = []
    for y, rx_, zb, zt in ((-0.07, 0.03, 0.026, 0.07),
                           (-0.064, 0.042, 0.026, 0.096),
                           (-0.04, 0.051, 0.026, 0.114),
                           (-0.006, 0.054, 0.026, 0.112),
                           (0.03, 0.055, 0.026, 0.1),
                           (0.066, 0.054, 0.026, 0.084),
                           (0.1, 0.05, 0.026, 0.07),
                           (0.128, 0.042, 0.028, 0.058),
                           (0.146, 0.03, 0.032, 0.049),
                           (0.154, 0.016, 0.035, 0.043)):
        ring = []
        for x, z, _ in ak.sup(12, rx_, (zt - zb) / 2, 2.6, math.pi / 12):
            ring.append(V(x, y, max(zb, (zb + zt) / 2 + z)))
        rings.append(ring)
    foot.append(ak.loft(f"{name}-foot", rings, SHELL,
                        start=V(0, -0.074, 0.05), end=V(0, 0.158, 0.039)))
    # The sole: a dark slab a little proud of the upper, a ridged toe cap
    # line and a heel block.
    outline = [(x * (1.0 if y < 0.03 else 1.06), y + 0.04)
               for x, y, _ in ak.sup(18, 0.058, 0.12, 2.4)]
    foot.append(ak.slab(f"{name}-sole", outline, 0.03, SOLE, bevel=0.004))
    heel = [(x, y - 0.045) for x, y, _ in ak.sup(10, 0.054, 0.036, 3.0)]
    foot.append(ak.slab(f"{name}-heel", heel, 0.02, SOLE))
    m = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    ak.transform(foot, m)

    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    def band(label, mat, rows):
        rings = []
        for z, r in rows:
            c = on_leg(z)
            rings.append([c + V(x, y, 0)
                          for x, y, _ in ak.sup(12, r, r * 1.03)])
        return ak.loft(f"{name}-{label}", rings, mat, start=None, end=None)

    shaft = [band("cuff", SHELL, ((0.07, 0.055), (0.13, 0.0575),
                                  (0.178, 0.0595), (0.184, 0.0565)))]
    shaft.append(band("top", TEAM, ((0.18, 0.058), (0.186, 0.0645),
                                    (0.21, 0.065), (0.218, 0.06),
                                    (0.218, 0.048))))
    shaft.append(band("strap", HOSE, ((0.11, 0.0582), (0.112, 0.062),
                                      (0.13, 0.062), (0.132, 0.0585))))
    bc = on_leg(0.121) + V(sx * 0.063, 0.0, 0)
    shaft.append(ak.rbox(f"{name}-buckle", (0.007, 0.024, 0.024), bc, GILT,
                         levels=0))
    return shaft, foot


def leg(sx, knee, ankle, toe_out):
    """The thigh to a rounded knee, the shin (`knee`) from a bellows below
    it, and the boot's foot (`foot`, on the ankle)."""
    hip = V(sx * HIP_X, 0, HIP_Z)
    u = (knee - hip).normalized()
    f = (ankle - knee).normalized()
    tpath = [hip + V(0, 0, 0.02), lerp(hip, knee, 0.3), lerp(hip, knee, 0.62),
             knee - u * 0.045, knee - u * 0.02, knee]
    tradii = [0.08, 0.078, 0.072, 0.066, 0.0645, 0.0635]
    thigh = [ak.tube(f"{R}-thigh{sx}", tpath, tradii, SUIT, n=12,
                     up=(0, 1, 0), caps=("dome", "dome"),
                     flute=lambda i: 0.04 if i in (1, 2) else 0.0)]
    length = sum((b - a).length for a, b in zip(tpath, tpath[1:]))
    thigh.append(stripe(f"{R}-lstripe{sx}", tpath, tradii, V(sx, 0, 0),
                        0.075 / length, 1.0, half=0.022, nv=8))
    spath = [knee - f * 0.008, knee + f * 0.012, knee + f * 0.028,
             knee + f * 0.044, lerp(knee, ankle, 0.5), lerp(knee, ankle, 0.75),
             ankle]
    sradii = [0.058, 0.065, 0.06, 0.063, 0.0585, 0.055, 0.0525]
    shin = [ak.tube(f"{R}-shin{sx}", spath, sradii, SUIT, n=12,
                    up=(0, 1, 0), caps=("dome", None))]
    slen = sum((b - a).length for a, b in zip(spath, spath[1:]))
    shin.append(stripe(f"{R}-sstripe{sx}", spath, sradii, V(sx, 0, 0),
                       0.0, 1.0 - (0.19 - ankle.z) / slen, half=0.022,
                       nv=5))
    shaft, foot = boot(f"{R}-boot{sx}", ankle, knee, sx, toe_out)
    return thigh, shin + shaft, foot, hip


# ------------------------------------------------------------- build

# The head is drawn a size larger than the guard's sculpt: a chunky,
# readable bubble from the game's high camera.
HEAD_S = 1.1


def build(root_name="archers"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.092, -0.006, 0.322), V(-0.102, -0.018, 0.078), 12),
            ("R", 1, V(0.09, 0.02, 0.322), V(0.1, 0.022, 0.078), 8)):
        thigh, shin, foot, hip = leg(sx, knee, ankle, out)
        leg_obj = ak.part(R, f"leg{side}", thigh, hip, root)
        knee_obj = ak.part(R, f"knee{side}", shin, knee, leg_obj)
        ak.part(R, f"foot{side}", foot, ankle, knee_obj)

    torso = [suit_body(), yoke(), shoulder_cap(1), shoulder_cap(-1),
             neck_ring()] + belt() + badge() + chest_box() + backpack()
    torso_obj = ak.part(R, "torso", torso, WAIST, root)

    grow = (Matrix.Translation(NECK) @ Matrix.Scale(HEAD_S, 4) @
            Matrix.Translation(-NECK))
    shell = helmet()
    head = ([face(), shell, helmet_stripe()] + eyes() + ear_pods())
    lid = visor()
    whip, whip_base = antenna()
    hinge = hinge_pivot()
    ak.transform(head + lid + whip, grow)
    head_obj = face_rig.head(ak.part, R, head, NECK, torso_obj, angle=58)
    ak.part(R, "hat", lid, grow @ hinge, head_obj, angle=58)
    ak.part(R, "antenna", whip, grow @ whip_base, head_obj, angle=50)

    upper_r, fore_r, elbow_r, bend = build_armR()
    arm_r_obj = ak.part(R, "armR", upper_r, S_R, torso_obj)
    fore_r_obj = ak.part(R, "foreR", fore_r, elbow_r, arm_r_obj)
    gun, grip = build_weapon()
    ak.part(R, "weapon", gun, grip, fore_r_obj, angle=40)
    upper_l, fore_l, elbow_l, hand_l = build_armL()
    arm_l_obj = ak.part(R, "armL", upper_l, S_L, torso_obj)
    fore_l_obj = ak.part(R, "foreL", fore_l, elbow_l, arm_l_obj)
    ak.part(R, "handL", hand_l, W_L, fore_l_obj, angle=50)

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
    "walk": {"legL": (0.62, 0, 0), "kneeL": (-0.3, 0, 0),
             "legR": (-0.5, 0, 0), "kneeR": (-0.7, 0, 0),
             "footR": (0.4, 0, 0),
             "armL": (-0.4, 0, 0), "foreL": (0.5, 0, 0),
             "armR": (0.3, 0, 0), "foreR": (1.5, 0, 0),
             "torso": (0, 0, -0.13)},
    # Carrying the ray gun up at the ready, as the game walks it.
    "carry": {"armR": (0.62, 0, 0.02), "foreR": (1.75, 0, 0),
              "weapon": (0.32, 0, 0), "foreL": (0.3, 0, 0),
              "hat": (-0.1, 0, 0), "antenna": (0.2, 0, 0)},
    # A salute to the other cadet.
    "salute": {"armL": (0.5, 0, -1.25), "foreL": (2.1, 0, 0),
               "handL": (0, 0, 0.3), "head": (0, 0, 0.15)},
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
