"""The Inventor's costume and features around the sculpted skin.

The coat above the waist, its sleeves, the coverall and the gauntlets are
the skin itself, painted by region (paint_regions). Around it: the coat's
skirt (its tails, a shell draped from the hips and split at the front and
at a back vent), its pockets, buttons and back half-belt; the coverall's
belt, placket and cargo pockets; the gauntlets' wrist straps; work boots;
the hair (a combed cap, two puffs of tight curls with their ties, loose
curls at the temples); the goggles; and the face controls (eyes, pupils,
brows, mouth) with the lids and lashes that stay on the head.
"""

import math

import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as fk
import figure_miner_clay as mc
import figure_miner_sdf as sd
import figure_inventor_mesh as M
import figure_inventor_sculpt as ms
from figure_miner_clay import V, g
from figure_inventor_sculpt import (SKIN, HAIR, COAT, COVER, GLOVE, LEATHER, LEATHER_DARK,
                                    BRASS, BUTTON)

T = kit.tint
EYE = "resin:" + T("inventor-eye", "#efe8dc")
IRIS = "resin:" + T("inventor-iris", "#3a2214")
PUPIL = "resin:" + T("inventor-pupil", "#100907")
SHINE = "lacquer:" + T("inventor-shine", "#ffffff")
LASH = HAIR
MOUTH = "resin:" + T("inventor-mouth", "#3a1916")
LENS = "lacquer:" + T("inventor-glass", "#8ec4d8")
TIE = "weave:team3"
SOLE = LEATHER_DARK
LACE = "weave:" + T("inventor-lace", "#d6c4a0")

TAU = math.tau


# ------------------------------------------------------------- skin regions

def arm_t(p, s):
    """Fraction along shoulder-elbow-wrist of the nearest arm point."""
    sh, el, wr = ms.SHOULDER[s], ms.ELBOW[s], ms.WRIST[s]
    best = (9.0, 0.0)
    for a, b, t0, t1 in ((sh, el, 0.0, 0.5), (el, wr, 0.5, 1.0)):
        ab = b - a
        u = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        d = (p - (a + ab * u)).length
        if d < best[0]:
            best = (d, t0 + (t1 - t0) * u)
    return best[1]


def arm_plane(s, t, shift=0.0):
    c, ax, u, v = ms.arm_frame(s, t)
    return c + ax * shift, ax


def sleeve_plane(s):
    """Where the coat's rolled sleeve ends (below its lower roll)."""
    return arm_plane(s, ms.CUFF_T, 0.0062)


def glove_plane(s):
    """Where the gauntlet begins (the top of its rolled lip)."""
    return arm_plane(s, ms.GLOVE_T, 0.0010)


def in_front_v(x, y, z):
    """Inside the open coat's front, where the coverall shows."""
    return y > -0.004 and abs(x) < ms.x_open(z) - 0.0015


def region_of(p, arm_l, arm_r, head):
    """0 skin, 1 coat, 2 coverall, 3 glove for a point with its arm and
    head shares."""
    side = 1 if p.x > 0 else -1
    if (arm_r if side > 0 else arm_l) > 0.5:
        c, ax = sleeve_plane(side)
        if (p - c).dot(ax) < 0:
            return 1
        c, ax = glove_plane(side)
        return 3 if (p - c).dot(ax) > 0 else 0
    if head > 0.5 or p.z > ms.neckline_z(p.x, p.y):
        return 0
    if p.z > ms.COAT_Z and not in_front_v(p.x, p.y, p.z):
        return 1
    return 2


def paint_regions(o, weights, names):
    """Skin, coat, coverall or glove per face, from the bones that own it."""
    mats = [SKIN, COAT, COVER, GLOVE]
    o.data.materials.clear()
    for m in mats:
        o.data.materials.append(kit.material(m))
    me = o.data
    loops = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get("vertex_index", loops)
    starts = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("loop_start", starts)
    sizes = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("loop_total", sizes)
    centres = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("center", centres)
    centres = centres.reshape(-1, 3)
    W = np.zeros((len(me.polygons), len(names)))
    for k in range(4):
        idx = loops[starts + np.minimum(k, sizes - 1)]
        W += weights[idx]
    W /= 4
    col = {n: i for i, n in enumerate(names)}
    arm = {s: W[:, col["arm" + k]] + W[:, col["fore" + k]] + W[:, col["hand" + k]]
           for s, k in ((-1, "L"), (1, "R"))}
    head = W[:, col["head"]]
    out = np.array([region_of(Vector(c), arm[-1][i], arm[1][i], head[i]) for i, c in enumerate(centres)],
                   dtype=np.int32)
    me.polygons.foreach_set("material_index", out)
    me.update()


# ------------------------------------------------------------- face

EYE_C, EYE_R = ms.EYE_C, ms.EYE_R
EYE_YAW = 0.30  # the eyes follow the face round: outer corners further back


def eye_axes(s):
    a = s * EYE_YAW
    x = V(math.cos(a), -math.sin(a), 0)
    y = V(math.sin(a), math.cos(a), 0)
    return x, y, V(0, 0, 1)


def eye_point(s, u, w, lift=0.0):
    """A point on the eyeball: u across (-1 inner .. 1 outer), w up (-1..1)."""
    x, y, z = eye_axes(s)
    c = EYE_C[s]
    ex = u * EYE_R[0] * s
    ez = w * EYE_R[2]
    k = max(0.0, 1 - u * u - w * w)
    ey = math.sqrt(k) * EYE_R[1]
    p = c + (x * s) * (ex * s) + y * ey + z * ez
    n = (p - c)
    n = V(n.dot(x) / EYE_R[0] ** 2, n.dot(y) / EYE_R[1] ** 2, n.dot(z) / EYE_R[2] ** 2)
    n = (x * n.x + y * n.y + z * n.z).normalized()
    return p + n * lift


def eyes():
    out = []
    for s in (-1, 1):
        c = EYE_C[s]
        x, y, z = eye_axes(s)
        axes = (tuple(x), tuple(y), tuple(z))
        white = mc.ellipsoid(f"inventor.eye{s}", c, EYE_R, EYE, axes=axes, seg=48, rings=24)
        front = c + y * (EYE_R[1] - 0.0016) + x * (-s * 0.0010) + z * 0.0004
        iris = mc.ellipsoid(f"inventor.iris{s}", front, (0.0082, 0.0026, 0.0086), IRIS, axes=axes, seg=32, rings=16)
        pupil = mc.ellipsoid(f"inventor.pupil{s}", front + y * 0.0009, (0.0040, 0.0020, 0.0042), PUPIL,
                             axes=axes, seg=24, rings=12)
        shine = mc.ellipsoid(f"inventor.shine{s}", front + y * 0.0016 + x * 0.0030 + z * 0.0032,
                             (0.0016, 0.0012, 0.0016), SHINE, axes=axes, seg=16, rings=8)
        out.append((white, f"eye{'L' if s < 0 else 'R'}"))
        out.append((mc.join([iris, pupil, shine], f"inventor.pupil{s}"), f"pupil{'L' if s < 0 else 'R'}"))
    return out


# Upper lid margin height (in eye half-heights) across the eye, inner to
# outer: lowered and level for a fierce, focused look, lowest at the inner
# corner where the frown pulls; the lower lid raised a little (a squint).
TOP_LID = [(-1.0, 0.04), (-0.6, 0.32), (-0.1, 0.48), (0.4, 0.50), (0.8, 0.34), (1.0, 0.10)]
BOT_LID = [(-1.0, -0.06), (-0.6, -0.50), (0.0, -0.64), (0.6, -0.56), (1.0, -0.14)]


def lid_w(rows, u):
    return float(np.interp(max(-1.0, min(1.0, u)), [r[0] for r in rows], [r[1] for r in rows]))


def lid_curve(s, rows, lift, n=19, span=1.04):
    pts = []
    for u in np.linspace(-span, span, n):
        uu = max(-1.0, min(1.0, u))
        pts.append(eye_point(s, uu * 0.985, lid_w(rows, uu), lift))
    return pts


def eyelids():
    """Upper lids covering the eye's top third as smooth shells over the
    eyeball with a rounded margin, slim lower lids, and a bold lash line
    with a flick at the outer corner (the portrait's winged liner); all on
    the head, so a blink closes the eye white behind them."""
    out = []
    for s in (-1, 1):
        us = np.linspace(-1.0, 1.0, 25)
        rows_o, rows_i = [], []
        for t in np.linspace(0, 1, 8):
            ro, ri = [], []
            for u in us:
                m = lid_w(TOP_LID, u)
                w = m + (1.0 - m) * t ** 0.8
                ro.append(list(eye_point(s, u * 0.99, w, 0.0010 + 0.0006 * (1 - t))))
                ri.append(list(eye_point(s, u * 0.99, w, 0.0001)))
            rows_o.append(ro)
            rows_i.append(ri)
        out.append(M.solid_shell(f"inventor.lid-cover{s}", np.array(rows_o), np.array(rows_i), SKIN))
        top = lid_curve(s, TOP_LID, 0.0012)
        rad = [0.0016 + 0.0010 * math.sin(math.pi * i / (len(top) - 1)) for i in range(len(top))]
        out.append(fk.tube(f"inventor.lid-top{s}", top, rad, SKIN, n=12, caps=("dome", "dome")))
        bot = lid_curve(s, BOT_LID, 0.0006, n=15, span=0.98)
        rad = [0.0011 + 0.0008 * math.sin(math.pi * i / (len(bot) - 1)) for i in range(len(bot))]
        out.append(fk.tube(f"inventor.lid-bot{s}", bot, rad, SKIN, n=10, caps=("dome", "dome")))
        # The lash line along the upper margin and its flick.
        lash = lid_curve(s, TOP_LID, 0.0026, n=17, span=0.98)
        x, y, z = eye_axes(s)
        tip = lash[-1] + (x * s) * 0.0075 + z * 0.0040 - y * 0.0016
        lash = lash + [tip]
        rad = [0.0008 + 0.0008 * min(1.0, i / (len(lash) * 0.7)) for i in range(len(lash) - 1)] + [0.0005]
        out.append(fk.tube(f"inventor.lash{s}", lash, [(r, r * 0.75) for r in rad], LASH, n=8,
                           caps=("dome", "dome")))
    return out


def brow(surf, s):
    """A thick, shaped brow drawn down and in at the nose (a frown), its
    tail tapering over the outer corner, tufted along its length."""
    lo = (min(0, s * 0.078) - 0.01, 0.030, 1.128)
    hi = (max(0, s * 0.078) + 0.01, 0.120, 1.185)
    sc = sd.Sculpt(lo, hi, 0.0005)
    line = [(s * 0.008, 0.11, 1.1440), (s * 0.024, 0.11, 1.1520), (s * 0.042, 0.10, 1.1585),
            (s * 0.058, 0.09, 1.1575), (s * 0.068, 0.07, 1.1525)]
    sc.add(lock(surf, line, [0.0042, 0.0046, 0.0040, 0.0030, 0.0016],
                [0.0026, 0.0032, 0.0030, 0.0024, 0.0014], 18), 0.0015)
    for k in range(8):
        t = k / 7
        x0 = 0.008 + 0.050 * t
        z0 = 1.1440 + 0.0140 * math.sin(math.pi * min(1.0, t * 0.80 + 0.05))
        ctrl = [(s * x0, 0.11, z0 - 0.0028), (s * (x0 + 0.006), 0.11, z0), (s * (x0 + 0.012), 0.10, z0 + 0.0012)]
        sc.add(lock(surf, ctrl, [0.0026, 0.0030, 0.0014], [0.0024, 0.0034, 0.0022], 10), 0.0010)
    return sc.build(f"inventor.brow{s}", HAIR)


def mouth():
    """The dark line where the firm lips meet, its corners pressed in."""
    pts = [V(-0.0200, 0.0868, 1.0654), V(-0.0100, 0.0935, 1.0650), V(0, 0.0958, 1.0647),
           V(0.0100, 0.0935, 1.0650), V(0.0200, 0.0868, 1.0654)]
    pts = mc.smooth_points(pts, 17)
    rad = [0.00065 + 0.00055 * math.sin(math.pi * i / 16) for i in range(17)]
    return fk.tube("inventor.mouth-line", pts, [(r, r * 0.8) for r in rad], MOUTH, n=8, caps=("dome", "dome"))


# ------------------------------------------------------------- hair

def on_head(surf, p, lift):
    q, n = surf.snap(V(*p))
    return q + n * lift


def lock(surf, ctrl, radii, lifts, n=12):
    pts = [on_head(surf, p, l) for p, l in zip(ctrl, lifts)]
    pts = mc.smooth_points(pts, n)
    rr = [float(np.interp(i / (n - 1), np.linspace(0, 1, len(radii)), radii)) for i in range(n)]
    return sd.Chain(pts, rr)


PUFF = {s: V(s * 0.060, -0.022, 1.258) for s in (-1, 1)}
PUFF_R = (0.054, 0.052, 0.049)
PUFF_BASE = {s: V(s * 0.050, -0.022, 1.212) for s in (-1, 1)}
CRANIUM = (V(0, -0.012, 1.152), (0.077, 0.088, 0.085))


def hairline_z(a):
    """The hairline's height round the head (a = 0 front, degrees):
    pulled back off the forehead, round the temples, close behind the ears
    and low at the nape."""
    a = abs(a)
    return float(np.interp(a, [0, 18, 34, 48, 60, 70, 78, 90, 104, 120, 145, 180],
                           [1.196, 1.194, 1.186, 1.172, 1.152, 1.134, 1.140, 1.152, 1.140, 1.110,
                            1.090, 1.084]))


def hair_cap():
    """The pulled-up hair over the skull: a shell on the cranium from the
    hairline up, combed in grooves running up into each puff's base, parted
    down the middle."""
    sc = sd.Sculpt((-0.095, -0.120, 1.060), (0.095, 0.095, 1.262), 0.0008)
    E, C = sd.Ellipsoid, sd.Chain
    c, r = CRANIUM
    sc.add(E(c, (r[0] + 0.0046, r[1] + 0.0046, r[2] + 0.0046)))
    sc.add(E(V(0, -0.040, 1.138), (0.067 + 0.0046, 0.064 + 0.0046, 0.072 + 0.0046)), 0.008)
    # Fill the dip between the puffs' bases and lift the crown into them.
    for s in (-1, 1):
        sc.add(E(PUFF_BASE[s] + V(0, 0, -0.004), (0.040, 0.044, 0.024)), 0.020)
    # The hairline: everything below it (in angle round the head) is cut.
    # A smooth clip: distance below a surface z = hairline(a).
    def hair_clip(X, Y, Z):
        a = np.degrees(np.arctan2(X, Y + 0.012))
        A = np.abs(a)
        zl = np.interp(A, [0, 18, 34, 48, 60, 70, 78, 90, 104, 120, 145, 180],
                       [1.196, 1.194, 1.186, 1.172, 1.152, 1.134, 1.140, 1.152, 1.140, 1.110, 1.090, 1.084])
        return zl - Z

    class Clip(sd.Form):
        def bounds(self):
            return np.array([-1.0, -1.0, -1.0]), np.array([1.0, 1.0, 3.0])

        def eval(self, X, Y, Z):
            return hair_clip(X, Y, Z)
    sc.clip(Clip(), 0.007)
    # Clear the ears with a little room.
    for s in (-1, 1):
        sc.carve(E(V(s * 0.074, -0.016, 1.118), (0.016, 0.024, 0.030)), 0.006)
    # Grooves combed up into the nearer puff, and the centre parting.
    for s in (-1, 1):
        for k in range(18):
            a = math.radians(5 + k * 9.6 + 2.5 * math.sin(k * 2.3)) * s
            zl = hairline_z(math.degrees(a)) + 0.004
            p0 = cranium_point(a, zl, 0.0060)
            p1 = PUFF_BASE[s] + V(s * 0.008 * math.sin(a), 0.020 * math.cos(a), -0.010)
            mid = (p0 + p1) / 2
            mid = cranium_point(math.atan2(mid.x, mid.y + 0.012), mid.z, 0.0062)
            pts = mc.smooth_points([p0, mid, p1], 14)
            sc.carve(C(pts, 0.0008), 0.0011)
    part = [cranium_point(0.0, z, 0.0062) for z in np.linspace(1.198, 1.238, 6)]
    sc.carve(C(part, 0.0013), 0.0016)
    back = [cranium_point(math.pi, z, 0.0062) for z in np.linspace(1.090, 1.220, 8)]
    sc.carve(C(back, 0.0013), 0.0016)
    return sc.build("inventor.hair-cap", HAIR)


def cranium_point(a, z, lift):
    """A point on the cranium ellipsoid at azimuth a (0 front) and height z,
    lifted along its normal."""
    c, r = CRANIUM
    t = max(-0.999, min(0.999, (z - c.z) / r[2]))
    k = math.sqrt(1 - t * t)
    p = V(c.x + math.sin(a) * r[0] * k, c.y + math.cos(a) * r[1] * k, z)
    n = V((p.x - c.x) / r[0] ** 2, (p.y - c.y) / r[1] ** 2, (p.z - c.z) / r[2] ** 2).normalized()
    return p + n * lift


def puff(s, seed):
    """A big round puff of tight curls: clustered coils over a squashed
    ball, smaller curls between them."""
    rng = np.random.default_rng(seed)
    c = PUFF[s]
    rx, ry, rz = PUFF_R
    lo = np.array(list(c)) - 0.080
    hi = np.array(list(c)) + 0.080
    sc = sd.Sculpt(lo, hi, 0.0007)
    E, C = sd.Ellipsoid, sd.Chain
    sc.add(E(c, (rx - 0.006, ry - 0.006, rz - 0.006)))
    # Its base gathered into the tie.
    sc.add(E(PUFF_BASE[s] + V(0, 0, 0.006), (0.030, 0.032, 0.022)), 0.012)
    golden = math.pi * (3 - math.sqrt(5))
    # Fewer, larger, softly blended clumps and no fine coils: the busy
    # version broke into pits and holes when reduced (9 October).
    n = 120
    for i in range(n):
        zc = 1 - 2 * (i + 0.5) / n
        if zc < -0.72:
            continue
        rc = math.sqrt(1 - zc * zc)
        th = golden * i + rng.uniform(0, 0.5)
        d = V(rc * math.cos(th), rc * math.sin(th), zc)
        d = (d + V(*rng.normal(0, 0.06, 3))).normalized()
        p = c + V(d.x * rx, d.y * ry, d.z * rz) * 0.93
        size = rng.uniform(0.0098, 0.0140) * (0.8 if zc < -0.3 else 1.0)
        # A curl clump: a short coiled arc of three beads.
        t1 = d.cross(V(0, 0, 1))
        if t1.length < 1e-3:
            t1 = V(1, 0, 0)
        t1.normalize()
        t2 = d.cross(t1)
        ang = rng.uniform(0, TAU)
        beads = [p + (t1 * math.cos(ang + j * 1.6) + t2 * math.sin(ang + j * 1.6)) * size * 0.55
                 + d * size * (0.15 + 0.12 * j) for j in range(3)]
        sc.add(C(beads, [size * 0.62, size * 0.58, size * 0.50]), 0.0045)
    return sc.build(f"inventor.puff{s}", HAIR)


def puff_tie(s):
    """A band in the team's light colour round the puff's base."""
    c = PUFF_BASE[s] + V(0, 0, 0.003)
    axis = V(s * 0.25, 0.0, 1.0).normalized()
    a = axis.cross(V(0, 1, 0)).normalized()
    b = axis.cross(a)
    ring = [c + (a * math.cos(t) * 0.031 + b * math.sin(t) * 0.033) for t in np.linspace(0, TAU, 41)]
    return fk.tube(f"inventor.tie{s}", ring, [(0.0040, 0.0060)] * 41, TIE, n=10, up=tuple(axis), caps=(None, None))


def curls(surf):
    """Corkscrew curls escaping at the temples and the nape."""
    out = []
    spots = [(-1, 67, 0.024, 0), (1, 67, 0.024, 2), (-1, 160, 0.016, 4), (1, 166, 0.014, 5)]
    for s_, A, length, k in spots:
        a = math.radians(A) * s_
        z0 = hairline_z(A) + 0.006
        top = on_head(surf, cranium_point(a, z0, 0.0), 0.0)
        n_turn = length / 0.0060
        pts = []
        steps = int(n_turn * 10) + 6
        for j in range(steps):
            t = j / (steps - 1)
            z = z0 - t * length
            base = on_head(surf, cranium_point(a + s_ * t * 0.08, z, 0.0), 0.0)
            q, nrm = surf.snap(base)
            down = V(0, 0, -1)
            side = nrm.cross(down).normalized()
            ang = t * n_turn * TAU + k * 1.7
            rad = 0.0022 * (1 - 0.3 * t)
            pts.append(q + nrm * (0.0034 + math.cos(ang) * rad) + side * math.sin(ang) * rad)
        rr = list(np.linspace(0.0016, 0.0010, len(pts)))
        out.append(fk.tube(f"inventor.curl{k}", pts, rr, HAIR, n=8, caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- goggles

def goggles(surf):
    """Big brass goggles pushed up onto her hairline, blue glass lenses
    catching the light, on a leather strap round her head."""
    out = []
    cups = []
    for s in (-1, 1):
        a = math.radians(24) * s
        p = cranium_point(a, 1.205, 0.0)
        q, n = surf.snap(p)
        q, n = on_head(surf, q, 0.0), n
        axis = (n * 0.75 + V(0, 0.15, 0.55)).normalized()
        c = q + n * 0.012
        a1 = axis.cross(V(0, 0, 1))
        if a1.length < 1e-4:
            a1 = V(1, 0, 0)
        a1.normalize()
        b1 = axis.cross(a1)

        def ring(r, h):
            return [tuple(c + axis * h + (a1 * math.cos(t) + b1 * math.sin(t)) * r) for t in np.linspace(0, TAU, 49)]
        rows_o = np.array([ring(0.0205, h) for h in np.linspace(-0.009, 0.006, 6)])[:, :-1]
        rows_i = np.array([ring(0.0168, h) for h in np.linspace(-0.009, 0.006, 6)])[:, :-1]
        out.append(M.solid_shell(f"inventor.goggle-cup{s}", rows_o, rows_i, BRASS, closed=True))
        out.append(fk.tube(f"inventor.goggle-bezel{s}", [V(*p) for p in ring(0.0190, 0.0068)], [0.0032] * 49,
                           BRASS, n=12, up=tuple(axis), caps=(None, None)))
        out.append(fk.tube(f"inventor.goggle-gasket{s}", [V(*p) for p in ring(0.0196, -0.0098)], [0.0034] * 49,
                           LEATHER_DARK, n=10, up=tuple(axis), caps=(None, None)))
        lens = []
        for rr in np.linspace(0.0005, 0.0174, 8):
            lens.append([c + axis * (0.0058 + 0.0024 * (1 - (rr / 0.0174) ** 2)) +
                         (a1 * math.cos(t) + b1 * math.sin(t)) * rr for t in np.linspace(0, TAU, 40, endpoint=False)])
        lens = np.array([[list(p) for p in row] for row in lens])
        back = lens - np.array(list(axis)) * 0.003
        out.append(M.solid_shell(f"inventor.goggle-lens{s}", lens, back, LENS, closed=True))
        for t in np.linspace(0, TAU, 6, endpoint=False):
            q2 = c + axis * 0.0040 + (a1 * math.cos(t) + b1 * math.sin(t)) * 0.0205
            out.append(fk.ball(f"inventor.goggle-rivet{s}{t:.1f}", 0.0017, q2, BRASS, seg=10))
        cups.append((c, axis, a1, b1))
    (c0, ax0, _, _), (c1, ax1, _, _) = cups
    mid = (c0 + c1) / 2 + V(0, 0.004, 0.006)
    out.append(fk.tube("inventor.goggle-bridge", mc.smooth_points([c0 + (c1 - c0) * 0.30, mid,
                                                                   c0 + (c1 - c0) * 0.70], 9),
                       [(0.0034, 0.0022)] * 9, BRASS, n=10, up=(0, 1, 0)))
    # The strap round the back of the head, over the hair.
    pts = []
    for A in list(np.linspace(40, 180, 30)) + list(np.linspace(-180, -40, 30))[1:]:
        z = float(np.interp(abs(A), [40, 70, 100, 140, 180], [1.204, 1.198, 1.186, 1.170, 1.160]))
        pts.append(cranium_point(math.radians(A), z, 0.0110))
    pts = [on_head(surf, p, 0.0094) for p in pts]
    out.append(fk.tube("inventor.goggle-strap", pts, [(0.0066, 0.0022)] * len(pts), LEATHER, n=8,
                       up=(0, 0, 1), caps=("dome", "dome")))
    for s, end in ((1, pts[0]), (-1, pts[-1])):
        cup = cups[0 if s < 0 else 1][0]
        out.append(fk.tube(f"inventor.goggle-strap-end{s}", [end, (end + cup) / 2 + V(0, -0.002, 0), cup],
                           [(0.0066, 0.0022)] * 3, LEATHER, n=8, up=(0, 0, 1)))
    # Brass buckle on her left side.
    bq = on_head(surf, cranium_point(math.radians(-96), 1.186, 0.0), 0.0112)
    frame = [bq + V(0, -0.006, -0.006), bq + V(0, -0.006, 0.006), bq + V(0, 0.006, 0.006),
             bq + V(0, 0.006, -0.006), bq + V(0, -0.006, -0.006)]
    out.append(fk.tube("inventor.goggle-buckle", frame, [0.0013] * 5, BRASS, n=8, caps=(None, None)))
    return out


# ------------------------------------------------------------- boots

def boot(s):
    """A lace-up leather work boot: heel counter, instep, a rounded toe
    cap, the shaft up under the trousers, a dark sole and heel."""
    a = ms.ANKLE[s]
    yaw = s * math.radians(6)
    fwd = V(math.sin(yaw), math.cos(yaw), 0)
    side = V(fwd.y, -fwd.x, 0)
    base = V(a.x, a.y, 0)

    def at(x, y, z):
        return base + side * x + fwd * y + V(0, 0, z)
    sc = sd.Sculpt(np.array(list(base)) + [-0.06, -0.075, 0.0], np.array(list(base)) + [0.06, 0.14, 0.19], 0.0009)
    E, C = sd.Ellipsoid, sd.Chain
    ax = (side, fwd, V(0, 0, 1))
    sc.add(E(at(0, -0.032, 0.044), (0.037, 0.036, 0.030), axes=ax))
    sc.add(E(at(0, 0.024, 0.044), (0.040, 0.050, 0.031), axes=ax), 0.018)
    sc.add(E(at(0, 0.080, 0.038), (0.040, 0.040, 0.028), axes=ax), 0.018)
    sc.add(E(at(0, 0.090, 0.040), (0.036, 0.032, 0.026), axes=ax), 0.007)
    sc.add(C([at(0, -0.010, 0.050), at(0, -0.005, 0.105), at(0, -0.003, 0.150)], [0.038, 0.040, 0.043]), 0.018)
    sc.add(C([at(0, 0.028, 0.080), at(0, 0.022, 0.118), at(0, 0.028, 0.152)], [0.014, 0.013, 0.011]), 0.008)
    sc.clip(sd.Plane(at(0, 0, 0.020), (0, 0, -1), [-1, -1, -1], [1, 1, 1]), 0.0035)
    sc.carve(C(mc.smooth_points([at(-0.034, 0.074, 0.034), at(-0.024, 0.066, 0.058), at(0, 0.063, 0.066),
                                 at(0.024, 0.066, 0.058), at(0.034, 0.074, 0.034)], 18), 0.0013), 0.0016)
    upper = sc.build(f"inventor.boot{s}", LEATHER)
    parts = [upper]
    outline = []
    for i in range(48):
        u = i / 48 * TAU
        y = 0.036 + 0.090 * math.cos(u)
        w = 0.037 + 0.008 * g(y, 0.078, 0.05) - 0.005 * g(y, 0.0, 0.03)
        outline.append((math.sin(u) * w * 1.04, y))
    pts = [at(x, y, 0) for x, y in outline]
    rows = [[p + V(0, 0, z) for p in pts] for z in (0.0, 0.003, 0.016, 0.0215)]
    parts.append(fk.loft(f"inventor.sole{s}", rows, SOLE, start="flat", end="flat", recalc=True))
    heel = []
    for i in range(32):
        u = i / 32 * TAU
        heel.append(at(math.sin(u) * 0.034, -0.032 + math.cos(u) * 0.032 * (1 if math.cos(u) < 0 else 0.5), 0))
    parts.append(fk.loft(f"inventor.heel{s}", [[p + V(0, 0, z) for p in heel] for z in (0.0, 0.003, 0.018)],
                         SOLE, start="flat", end="flat", recalc=True))
    for k in range(4):
        z = 0.072 + k * 0.020
        y = 0.030 - k * 0.003
        for xs in (-1, 1):
            parts.append(fk.ball(f"inventor.eyelet{s}{k}{xs}", 0.0028, at(xs * 0.0145, y + 0.0075, z), BRASS, seg=10))
    for k in range(3):
        z0, z1 = 0.072 + k * 0.020, 0.072 + (k + 1) * 0.020
        y0, y1 = 0.030 - k * 0.003 + 0.0095, 0.030 - (k + 1) * 0.003 + 0.0095
        for xs in (-1, 1):
            parts.append(fk.tube(f"inventor.lace{s}{k}{xs}", [at(xs * 0.0140, y0, z0),
                                                              at(0, (y0 + y1) / 2 + 0.0025, (z0 + z1) / 2),
                                                              at(-xs * 0.0140, y1, z1)], [0.0018] * 3, LACE, n=8))
    for o in parts:
        for p in o.data.polygons:
            p.use_smooth = True
    return parts


# ------------------------------------------------------------- the coat's skirt

SKIRT_TOP = 0.764
HEM = 0.420
VENT = 0.570
SKIRT_AXIS = (0.0, -0.008)


def x_edge(z):
    """The open coat's front edge below the waist (lateral x)."""
    if z >= 0.740:
        return ms.x_open(z)
    return 0.062 + 0.016 * (0.740 - z) / 0.320


def clearance(z):
    """How far the skirt stands off the body beneath: buried in the trunk
    at its top (the waist seam), then a hand's breadth of room by the hem."""
    if z >= 0.752:
        return -0.0065
    if z >= 0.728:
        t = (0.752 - z) / 0.024
        return -0.0065 + (0.0055 + 0.0065) * (t * t * (3 - 2 * t))
    return 0.0055 + 0.012 * mc.ssf(0.68, 0.42, z)


class SkirtShape:
    """The skirt's inner radius r(a, z) round the body: the body's outer
    hull beneath (from rays cast at the trunk and legs), draped from the
    widest point above, plus the clearance; the thickness and soft folds
    are added outside it."""

    def __init__(self, surf):
        self.zs = np.linspace(SKIRT_TOP, HEM, 56)
        self.As = np.linspace(-math.pi, math.pi, 241)
        ax = V(SKIRT_AXIS[0], SKIRT_AXIS[1], 0)
        R = np.zeros((len(self.zs), len(self.As)))
        for i, z in enumerate(self.zs):
            for j, a in enumerate(self.As):
                d = V(math.sin(a), math.cos(a), 0)
                origin = ax + V(0, 0, z) + d * 0.5
                hit, _ = surf.ray(origin, -d)
                R[i, j] = (V(hit.x, hit.y, 0) - ax).length if hit is not None else 0.0
        # Wrap-around max filter over +-6 degrees (cloth bridges small dips),
        # then drape: nothing narrower than what hangs above it.
        k = 6
        Rm = np.max(np.stack([np.roll(R, sft, axis=1) for sft in range(-k, k + 1)]), axis=0)
        for i in range(1, len(self.zs)):
            Rm[i] = np.maximum(Rm[i], Rm[i - 1])
        # A light blur round the body.
        for _ in range(3):
            Rm = (np.roll(Rm, 1, axis=1) + 2 * Rm + np.roll(Rm, -1, axis=1)) / 4
        self.R = Rm

    def radius(self, a, z):
        a = (a + math.pi) % TAU - math.pi
        i = np.interp(z, self.zs[::-1], np.arange(len(self.zs))[::-1])
        j = np.interp(a, self.As, np.arange(len(self.As)))
        i0, j0 = int(min(len(self.zs) - 2, i)), int(min(len(self.As) - 2, j))
        fi, fj = i - i0, j - j0
        r = (self.R[i0, j0] * (1 - fi) * (1 - fj) + self.R[i0 + 1, j0] * fi * (1 - fj)
             + self.R[i0, j0 + 1] * (1 - fi) * fj + self.R[i0 + 1, j0 + 1] * fi * fj)
        return r + clearance(z)

    def point(self, a, z, lift=0.0):
        r = self.radius(a, z)
        hang = mc.ssf(0.66, 0.42, z)
        fold = (0.0030 * math.sin(a * 7 + 1.1 + 0.6 * math.sin(a * 3)) * hang
                + 0.0016 * math.sin(a * 12 - 0.4) * hang * hang)
        return V(SKIRT_AXIS[0] + math.sin(a) * (r + fold + lift), SKIRT_AXIS[1] + math.cos(a) * (r + fold + lift), z)

    def edge_angle(self, z, s):
        """The angle of the front edge on side s (x = s * x_edge)."""
        lo, hi = 0.02, math.pi / 2
        target = x_edge(z)
        for _ in range(40):
            mid = (lo + hi) / 2
            if self.point(mid, z).x < target:
                lo = mid
            else:
                hi = mid
        return s * (lo + hi) / 2


THICK = 0.0042


def skirt(surf):
    """The coat's two tails: left and right halves from the front edges
    round to the back seam, overlapping at the vent below VENT."""
    shape = SkirtShape(surf)
    out = []
    zs = np.linspace(SKIRT_TOP, HEM, 46)
    for s in (-1, 1):
        rows_o, rows_i = [], []
        for z in zs:
            a0 = shape.edge_angle(z, s)
            back = s * math.pi
            if s < 0 and z < VENT + 0.010:
                back -= 0.11 * mc.ssf(VENT + 0.010, VENT - 0.010, z)
            As = np.linspace(a0, back, 72)
            hem = 1 + 0.35 * mc.ssf(HEM + 0.012, HEM + 0.004, z)
            over = 0.0013 if s < 0 else 0.0
            ro, ri = [], []
            for a in As:
                vent = over * mc.ssf(math.pi - 0.16, math.pi - 0.02, abs(a)) if s < 0 else 0.0
                ro.append(shape.point(a, z, THICK * hem + vent))
                ri.append(shape.point(a, z, vent))
            rows_o.append([list(p) for p in ro])
            rows_i.append([list(p) for p in ri])
        o = M.solid_shell(f"inventor.skirt{s}", np.array(rows_o), np.array(rows_i), COAT)
        out.append(o)
    # Patch pockets on the hips, with their top hems.
    for s in (-1, 1):
        rows_o, rows_i = [], []
        for z in np.linspace(0.505, 0.590, 12):
            ro, ri = [], []
            for k in np.linspace(0, 1, 12):
                a = s * (0.78 + 0.50 * k)
                edge = (1 - abs(2 * k - 1) ** 6) * (1 - abs(2 * (z - 0.505) / 0.085 - 1) ** 6)
                top_hem = 0.0012 * mc.ssf(0.578, 0.588, z)
                ro.append(list(shape.point(a, z, THICK + 0.0010 + 0.0016 * edge + top_hem)))
                ri.append(list(shape.point(a, z, THICK - 0.0012)))
            rows_o.append(ro)
            rows_i.append(ri)
        out.append(M.solid_shell(f"inventor.skirt-pocket{s}", np.array(rows_o), np.array(rows_i), COAT))
    # Buttons down her right front edge (the coat is open).
    for z in (0.700, 0.610, 0.520):
        a = shape.edge_angle(z, 1) + 0.12
        p = shape.point(a, z, THICK + 0.0018)
        n = V(math.sin(a), math.cos(a), 0)
        out.append(mc.ellipsoid(f"inventor.coat-button{z}", p, (0.0048, 0.0048, 0.0022), BUTTON,
                                axes=(tuple(n.cross(V(0, 0, 1)).normalized()), (0, 0, 1), tuple(n)), seg=20, rings=10))
    return out, shape


def coat_buttons(surf):
    """Buttons on her right front edge above the waist (on the trunk)."""
    out = []
    for z in (0.860, 0.790):
        x = ms.x_open(z) + 0.006
        a = ms.angle_at_x(x, z)
        p = ms.body_point(a, z, 0.0050)
        q, n = surf.snap(p)
        out.append(mc.ellipsoid(f"inventor.coat-button{z}", q + n * 0.0040, (0.0048, 0.0048, 0.0022), BUTTON,
                                axes=(tuple(n.cross(V(0, 0, 1)).normalized()), (0, 0, 1), tuple(n)), seg=20, rings=10))
    return out


def half_belt(surf):
    """The coat's half-belt across the back of the waist, two buttons."""
    pts = [V(math.sin(a) * 0.2, -0.008 + math.cos(a) * 0.2, 0.744) for a in np.linspace(math.pi - 0.75, math.pi + 0.75, 15)]
    out = [mc.strip("inventor.half-belt", surf, pts, 0.020, 0.0030, 0.0035, COAT, samples=30, across=7)]
    for s in (-1, 1):
        p, n = surf.ray(V(s * 0.055, -0.4, 0.744), (0, 1, 0))
        out.append(mc.ellipsoid(f"inventor.belt-button{s}", p + n * 0.0075, (0.0050, 0.0050, 0.0024), BUTTON,
                                axes=(tuple(n.cross(V(0, 0, 1)).normalized()), (0, 0, 1), tuple(n)), seg=20, rings=10))
    return out


# ------------------------------------------------------------- the coverall

def belt(surf):
    """A broad leather belt across the coverall's front (its ends go under
    the coat's skirt), a square brass buckle."""
    out = []
    z = 0.722
    pts = [V(math.sin(a) * 0.2, -0.008 + math.cos(a) * 0.2, z) for a in np.linspace(-1.05, 1.05, 19)]
    out.append(mc.strip("inventor.belt", surf, pts, 0.024, 0.0010, 0.0032, LEATHER, samples=36, across=7))
    p, n = surf.ray(V(0, 0.4, z), (0, -1, 0))
    c = p + n * 0.0058
    side, up = V(1, 0, 0), V(0, 0, 1)
    frame = [c + side * x + up * y for x, y in ((-0.016, -0.013), (0.016, -0.013), (0.016, 0.013), (-0.016, 0.013),
                                                (-0.016, -0.013))]
    out.append(fk.tube("inventor.buckle", frame, [(0.0030, 0.0022)] * 5, BRASS, n=10, caps=(None, None)))
    out.append(fk.tube("inventor.buckle-tongue", [c - side * 0.016 + n * 0.0015, c + side * 0.004 + n * 0.0025],
                       [0.0016, 0.0014], BRASS, n=8))
    return out


def placket(surf):
    """The coverall's front placket in the coat's opening, brass buttons."""
    out = [mc.strip("inventor.placket", surf, [V(0, 0.2, 0.932), V(0, 0.2, 0.84), V(0, 0.2, 0.745)],
                    0.016, 0.0010, 0.0016, COVER, samples=20, across=5)]
    for z in (0.905, 0.850, 0.795):
        p, n = surf.ray(V(0, 0.4, z), V(0, -1, 0))
        out.append(mc.ellipsoid(f"inventor.cover-button{z}", p + n * 0.0034, (0.0042, 0.0042, 0.0020), BRASS,
                                axes=(tuple(n.cross(V(0, 0, 1)).normalized()), (0, 0, 1), tuple(n)), seg=18, rings=9))
    return out


def cargo_pockets(surf):
    """A bellows pocket on each thigh's outer front, its flap and snap."""
    out = []
    for s in (-1, 1):
        k = ms.KNEE[s]
        d = V(-s * 0.85, -0.53, 0).normalized()
        ux = V(0, 0, 1).cross(d).normalized()
        C0 = V(k.x + s * 0.050, k.y + 0.040, 0) - d * 0.4
        body = [C0 + ux * x + V(0, 0, z) for x, z in
                ((-0.024, 0.455), (0.024, 0.455), (0.024, 0.378), (0.020, 0.372), (-0.020, 0.372), (-0.024, 0.378))]
        out.append(mc.panel(f"inventor.cargo{s}", surf, body, d, 0.0016, 0.0042, COVER, res=0.005))
        flap = [C0 + ux * x + V(0, 0, z) for x, z in ((-0.026, 0.468), (0.026, 0.468), (0.026, 0.446),
                                                     (0.0, 0.440), (-0.026, 0.446))]
        out.append(mc.panel(f"inventor.cargo-flap{s}", surf, flap, d, 0.0058, 0.0026, COVER, res=0.005))
        p, n = surf.ray(C0 + V(0, 0, 0.449), d)
        if p is not None:
            out.append(fk.ball(f"inventor.cargo-snap{s}", 0.0036, p + n * 0.0086, BRASS, seg=12))
    return out


def wrist_straps(surf):
    """A leather strap round each gauntlet's wrist with a brass buckle."""
    out = []
    for s in (-1, 1):
        t = 0.905
        c, ax, u, v = ms.arm_frame(s, t)
        ring = []
        for a in np.linspace(0, TAU, 49):
            d = u * math.sin(a) + v * math.cos(a)
            hit, n = surf.snap(c + d * 0.04)
            ring.append(hit + d * 0.0020)
        rows_o, rows_i = [], []
        for f in np.linspace(-1, 1, 5):
            off = ax * f * 0.0075
            ro = [p + off + (p - c - ax * (p - c).dot(ax)).normalized() * 0.0024 * math.sqrt(max(0, 1 - f * f * 0.6))
                  for p in ring]
            rows_o.append(ro)
        inner = [[p - (p - c - ax * (p - c).dot(ax)).normalized() * 0.0030 for p in row] for row in rows_o[::-1]]
        out.append(fk.loft(f"inventor.strap{s}", rows_o + inner + [rows_o[0]], LEATHER, closed=True, recalc=True))
        # The buckle on the back of the wrist.
        d = u * (s * 1.0)
        hit, n = surf.snap(c + d * 0.04)
        bc = hit + n * 0.0052
        side = ax
        up = n.cross(side).normalized()
        frame = [bc + side * x + up * y for x, y in ((-0.006, -0.007), (0.006, -0.007), (0.006, 0.007),
                                                     (-0.006, 0.007), (-0.006, -0.007))]
        out.append(fk.tube(f"inventor.strap-buckle{s}", frame, [0.0014] * 5, BRASS, n=8, caps=(None, None)))
    return out


def garments(surfaces):
    """Sewn and buckled pieces on the skin, each placed on (and later
    weighted from) only its own kind of skin."""
    parts = []
    for fn, kind in ((belt, "trunk"), (placket, "trunk"), (half_belt, "trunk"), (coat_buttons, "trunk"),
                     (cargo_pockets, "leg"), (wrist_straps, "arm")):
        parts += [(o, kind) for o in fn(surfaces[kind])]
    for o, _ in parts:
        for p in o.data.polygons:
            p.use_smooth = True
    return parts
