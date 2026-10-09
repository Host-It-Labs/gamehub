"""The Inventor's detailed editable anatomy (9 October 2026).

A young Black woman inventor of the 1950s, retro-futurist (card portrait
assets/arena/cards/card-inventor-v7-b.png): slim and athletic, square
shoulders under a white cotton lab coat worn open over a cobalt coverall,
the coat's sleeves rolled above the elbows, long cobalt gauntlets, a
leather belt and work boots. Her face is young and fierce: round cranium,
high cheekbones, full cheeks, a broad soft nose, full lips set firm, big
almond eyes under low lids and brows drawn down. Her hair is pulled up
into two big round puffs; brass goggles are pushed up on her forehead.

Blender +Y forward, Z up, her right at +X, authored at the figure's final
size (puffs about 1.32, the shipped toy 1.355 with its coil ball). The body
is one connected surface sculpted as signed-distance clay
(figure_miner_sdf.py, the Miner's generic SDF engine): body, head and two
fists welded into one skin. Above the waist the trunk wears the coat's
volume; its front edges, lapels and collar are sculpted into it, and the
paint (figure_inventor_dress.paint_regions) tells coat, coverall, skin and
glove apart. The coat's skirt below the waist is its own shell (the tails).

Rest pose: relaxed, weight on both feet, upper arms hanging at the
flanks, elbows bent about 20 degrees, fists by the thighs, palms in; the
right fist holds the wand's pistol grip, the left closes on nothing (it
takes the wand's front grip in the attack).

INVENTOR_FAST=1 sculpts at a coarser voxel for quick form reviews.
"""

import math
import os

import numpy as np
from mathutils import Vector

import kit
import figure_folk_kit as fk
import figure_miner_clay as mc
import figure_miner_sdf as sd
from figure_miner_clay import V, g, table

R = "inventor"
TAU = math.tau
CLAY = "resin:inventor-clay"
FAST = os.environ.get("INVENTOR_FAST") == "1"


def vox(h):
    return h * (1.7 if FAST else 1.0)


# ------------------------------------------------------------- paints

T = kit.tint
SKIN = "skin:" + T("inventor-skin", "#7a4930")
HAIR = "hair:" + T("inventor-hair", "#271b16")
COAT = "weave:" + T("inventor-coat", "#f1eee7")
COVER = "weave:team"                       # the coverall
GLOVE = "rubber:team"                      # the gauntlets
LEATHER = "hide:" + T("inventor-leather", "#6b4026")
LEATHER_DARK = "hide:" + T("inventor-leather-dark", "#3f271b")
BRASS = "gilt:" + T("inventor-brass", "#c99a46")
COPPER = "gilt:" + T("inventor-copper", "#c4683a")
BUTTON = "resin:" + T("inventor-button", "#e6dfcf")

# ------------------------------------------------------------- joints

ANKLE = {s: V(s * 0.080, -0.006, 0.082) for s in (-1, 1)}
KNEE = {s: V(s * 0.077, 0.012, 0.330) for s in (-1, 1)}
HIP = {s: V(s * 0.078, 0.000, 0.592) for s in (-1, 1)}
WAIST = V(0, -0.008, 0.705)
CHEST = V(0, -0.016, 0.840)
NECK = V(0, -0.016, 1.000)
CLAV = {s: V(s * 0.022, 0.024, 0.948) for s in (-1, 1)}
SHOULDER = {s: V(s * 0.145, -0.012, 0.930) for s in (-1, 1)}
ELBOW = {s: V(s * 0.181, -0.034, 0.720) for s in (-1, 1)}
WRIST = {s: V(s * 0.209, 0.010, 0.537) for s in (-1, 1)}
# The coat tails' pivots: at the seat, so the hips keep the cloth above.
SKIRT = {s: V(s * 0.072, -0.004, 0.618) for s in (-1, 1)}


def hand_frame(s):
    """The fist's frame at the wrist: e1 along the hand (the forearm's
    line), e2 the thumb's side (the grip's axis), e3 the palm's normal
    (towards the thigh at rest)."""
    e1 = (WRIST[s] - ELBOW[s]).normalized()
    n0 = V(-s, 0.0, 0.0)
    e3 = (n0 - e1 * n0.dot(e1)).normalized()
    e2 = e1.cross(e3).normalized()
    if e2.y < 0:
        e2 = -e2
    return e1, e2, e3


# The grip's centre in the fist frame and its radius: the wand's pistol
# grip (right) and front grip (left, in the attack) run through it along e2.
GRIP_E1, GRIP_E3 = 0.050, 0.023
BAR_R = 0.0118


def grip_centre(s):
    e1, e2, e3 = hand_frame(s)
    return WRIST[s] + e1 * GRIP_E1 + e3 * GRIP_E3


# ------------------------------------------------------------- trunk

# (z, half width, front, back) of the clothed trunk's base volume: hips
# and seat in the coverall, the waist, then the coat over the ribs, bust
# and shoulders.
BODY = [(0.515, 0.062, 0.046, 0.054),
        (0.550, 0.108, 0.066, 0.082),
        (0.590, 0.126, 0.074, 0.092),
        (0.630, 0.130, 0.076, 0.092),
        (0.670, 0.124, 0.073, 0.084),
        (0.705, 0.113, 0.070, 0.075),
        (0.740, 0.105, 0.069, 0.070),
        (0.775, 0.107, 0.071, 0.070),
        (0.810, 0.114, 0.075, 0.073),
        (0.850, 0.120, 0.078, 0.077),
        (0.885, 0.124, 0.074, 0.079),
        (0.915, 0.124, 0.067, 0.078),
        (0.940, 0.113, 0.059, 0.070),
        (0.962, 0.090, 0.051, 0.060),
        (0.982, 0.058, 0.044, 0.050),
        (1.002, 0.042, 0.039, 0.043)]


def bulges(x, y, z, front):
    """Outward offsets of the trunk's soft forms at a section point: the
    bust under the coat and coverall, shoulder blades, the seat."""
    ax = abs(x)
    if front:
        return (0.022 * g(z, 0.852, 0.030) * g(ax, 0.050, 0.030)
                - 0.004 * g(z, 0.815, 0.010) * g(ax, 0.050, 0.030))
    return (0.006 * g(z, 0.890, 0.030) * g(ax, 0.056, 0.028)
            + 0.012 * g(z, 0.600, 0.035) * g(ax, 0.060, 0.040)
            - 0.003 * g(ax, 0.0, 0.010) * mc.ssf(0.76, 0.80, z) * (1 - mc.ssf(0.92, 0.95, z)))


def body_point(a, z, grow=0.0):
    """The trunk's surface (a = 0 at the front, +pi/2 her right)."""
    w, f, b = table(BODY, z)
    s, c = math.sin(a), math.cos(a)
    p = 2.25 + 0.4 * mc.ssf(0.80, 0.93, z)
    x = fk.spow(s, 2 / p) * (w + grow)
    y = fk.spow(c, 2 / p) * ((f if c >= 0 else b) + grow)
    out = bulges(x, y, z, c >= 0) * abs(c) ** 0.5
    d = Vector((x, y, 0))
    n = d.normalized() if d.length > 1e-9 else Vector((0, 1, 0))
    return V(x, y, z) + n * out


def angle_at_x(x, z, front=True):
    """The section angle whose point lies at lateral x (front or back)."""
    w, _, _ = table(BODY, z)
    p = 2.25 + 0.4 * mc.ssf(0.80, 0.93, z)
    s = min(1.0, abs(x) / w) ** (p / 2)
    a = math.asin(s) * (1 if x >= 0 else -1)
    return a if front else math.copysign(math.pi, x) - a


# Where the open coat's front edges lie: lateral x by height, from the
# collar's front down to the waist (the skirt continues it below).
OPEN = [(0.700, 0.064), (0.740, 0.062), (0.800, 0.058), (0.860, 0.055),
        (0.910, 0.048), (0.950, 0.039), (0.985, 0.032)]


def x_open(z):
    return float(np.interp(z, [r[0] for r in OPEN], [r[1] for r in OPEN]))


# The lapels: from the collar to their points on the bust, widest at the
# notch.
LAPEL = [(0.832, 0.000), (0.860, 0.014), (0.895, 0.026), (0.928, 0.033),
         (0.940, 0.020), (0.952, 0.026), (0.975, 0.020)]


def lapel_width(z):
    return float(np.interp(z, [r[0] for r in LAPEL], [r[1] for r in LAPEL]))


def trunk_mesh():
    zs = np.linspace(BODY[0][0], BODY[-1][0], 120)
    rings = [[body_point(i / 112 * TAU, z) for i in range(112)] for z in zs]
    return fk.loft("inventor.trunk", rings, CLAY, start="pole", end="pole", recalc=True)


def slab_mesh(name, rows_top, rows_bottom):
    """A closed slab between two grids of surface points (rows x cols)."""
    c = fk.Mesh(name, CLAY)
    top = [[c.v(p) for p in r] for r in rows_top]
    bot = [[c.v(p) for p in r] for r in rows_bottom]
    c.grid(top, CLAY)
    c.grid(bot, CLAY, flip=True)
    n = len(top)
    m = len(top[0])
    for j in range(n - 1):
        c.face((bot[j][0], bot[j + 1][0], top[j + 1][0], top[j][0]), CLAY)
        c.face((top[j][-1], top[j + 1][-1], bot[j + 1][-1], bot[j][-1]), CLAY)
    for i in range(m - 1):
        c.face((top[0][i], top[0][i + 1], bot[0][i + 1], bot[0][i]), CLAY)
        c.face((bot[-1][i], bot[-1][i + 1], top[-1][i + 1], top[-1][i]), CLAY)
    return c.obj(recalc=True)


def coat_edge_slab(s, kind):
    """Sculpted cloth on the trunk, as a slab hugging body_point: the coat's
    front edge band ('edge') or its lapel folded back over it ('lapel')."""
    zs = np.linspace(0.740 if kind == "edge" else 0.832, 0.975, 40)
    top, bot = [], []
    for z in zs:
        x0 = x_open(z)
        if kind == "edge":
            xs, lift = (x0 - 0.0015, x0 + 0.010), 0.0030
        else:
            wl = max(0.0008, lapel_width(z))
            xs, lift = (x0 - 0.0005, x0 + wl), 0.0042
        rt, rb = [], []
        for k in np.linspace(0, 1, 7):
            x = s * (xs[0] + (xs[1] - xs[0]) * k)
            a = angle_at_x(x, z)
            edge = 1 - abs(2 * k - 1) ** 4
            rt.append(body_point(a, z, lift * (0.55 + 0.45 * edge)))
            rb.append(body_point(a, z, -0.004))
        top.append(rt)
        bot.append(rb)
    return slab_mesh(f"inventor.{kind}{s}", top, bot)


NECK_AXIS = (0.0, -0.016)
COAT_Z = 0.736  # the coat's waist: painted coat above, its skirt below


def neckline_z(x, y):
    """Where the skin of the neck and throat meets the clothes: the coat's
    collar round the back, the coverall's open collar in a V in front."""
    a = math.atan2(x, y - NECK_AXIS[1])
    front = max(0.0, math.cos(a))
    return min(0.997, 0.997 - 0.062 * front ** 2 + 1.25 * abs(x) * front ** 2)


def collar_slab():
    """The coat's turned-down collar: a band lying round the base of the
    neck from one lapel's top round the back to the other."""
    top, bot = [], []
    phis = np.linspace(math.radians(-128), math.radians(128), 41)
    for k in np.linspace(0, 1, 6):
        rt, rb = [], []
        for phi in phis:
            ph = math.pi + phi  # 0 at the front, through the back
            back = math.cos(phi) ** 2 if abs(phi) < math.pi / 2 else 0.0
            zc = 0.979 + 0.010 * back
            r_in, r_out = 0.043, 0.069 - 0.004 * back
            z_in, z_out = zc + 0.014, zc - 0.012
            r = r_in + (r_out - r_in) * k
            z = z_in + (z_out - z_in) * k
            d = V(math.sin(ph), math.cos(ph), 0)
            edge = 1 - abs(2 * k - 1) ** 4
            n = V(d.x * 0.62, d.y * 0.62, 0.78)
            p = V(NECK_AXIS[0], NECK_AXIS[1], 0) + d * r + V(0, 0, z)
            rt.append(p + n * (0.0030 + 0.0020 * edge))
            rb.append(p - n * 0.006)
        top.append(rt)
        bot.append(rb)
    # rows across the band (k), columns round the neck (phi)
    return slab_mesh("inventor.collar", top, bot)


def cover_collar_slab(s):
    """The coverall's small shirt collar point on the chest, in the coat's
    opening beside the throat's V."""
    top, bot = [], []
    for z in np.linspace(0.935, 0.985, 14):
        xv = (z - 0.935) / 1.25
        xs = (xv - 0.001, min(x_open(z) - 0.002, xv + 0.024 * (0.3 + 0.7 * (1 - (z - 0.935) / 0.05))))
        rt, rb = [], []
        for k in np.linspace(0, 1, 6):
            x = s * (xs[0] + (xs[1] - xs[0]) * k)
            a = angle_at_x(x, z)
            edge = 1 - abs(2 * k - 1) ** 4
            rt.append(body_point(a, z, 0.0024 * (0.5 + 0.5 * edge)))
            rb.append(body_point(a, z, -0.004))
        top.append(rt)
        bot.append(rb)
    return slab_mesh(f"inventor.covercollar{s}", top, bot)


def pocket_slab():
    """The coat's breast pocket on her left chest, outside the lapel."""
    top, bot = [], []
    for z in np.linspace(0.790, 0.845, 12):
        rt, rb = [], []
        for k in np.linspace(0, 1, 9):
            x = -(0.072 + 0.040 * k)
            a = angle_at_x(x, z)
            edge = (1 - abs(2 * k - 1) ** 6) * (1 - abs(2 * (z - 0.790) / 0.055 - 1) ** 6)
            rt.append(body_point(a, z, 0.0018 + 0.0014 * edge))
            rb.append(body_point(a, z, -0.004))
        top.append(rt)
        bot.append(rb)
    return slab_mesh("inventor.breastpocket", top, bot)


# (t along shoulder-elbow-wrist, width across, front, back). The upper arm
# wears the coat's sleeve, rolled above the elbow (CUFF_T); the elbow is
# bare; the gauntlet flares from GLOVE_T down to the fist.
ARM_SECTIONS = [(0.00, 0.050, 0.049, 0.053), (0.10, 0.049, 0.047, 0.051),
                (0.24, 0.045, 0.043, 0.046), (0.36, 0.043, 0.041, 0.043),
                (0.41, 0.042, 0.040, 0.042), (0.445, 0.033, 0.031, 0.033),
                (0.50, 0.030, 0.028, 0.033), (0.56, 0.030, 0.029, 0.031),
                (0.60, 0.032, 0.031, 0.031), (0.64, 0.038, 0.036, 0.036),
                (0.72, 0.034, 0.032, 0.031), (0.86, 0.029, 0.026, 0.025),
                (0.96, 0.027, 0.022, 0.022), (1.00, 0.027, 0.022, 0.022)]
CUFF_T = 0.425
GLOVE_T = 0.615
ARM_GAP = 0.0075


def arm_points(s):
    sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
    return [sh + V(-s * 0.018, 0.0, -0.010), sh + V(s * 0.006, 0.0, -0.034),
            sh + (el - sh) * 0.5, el, el + (wr - el) * 0.5, wr + (wr - el).normalized() * 0.014]


def arm_frame(s, t):
    pts = arm_points(s)
    c = mc.path_at(pts, t)
    ax = (mc.path_at(pts, min(1, t + 0.01)) - mc.path_at(pts, max(0, t - 0.01))).normalized()
    u = (V(1, 0, 0) - ax * ax.x).normalized()
    v = u.cross(ax)  # the limb's front (+Y on a hanging arm)
    return c, ax, u, v


def on_arm(s, t, a, lift=0.0):
    """A point on the arm's base loft at parameter t and angle a (0 front,
    +pi/2 outward)."""
    c, ax, u, v = arm_frame(s, t)
    w, f, b = table(ARM_SECTIONS, t)
    r = (f if math.cos(a) >= 0 else b) + lift
    return c + u * (math.sin(a) * s * (w + lift)) + v * (math.cos(a) * r)


def limb_down(name, points, sections, detail, rows, around):
    """mc.limb for a limb hanging down. Its own frame puts the sections'
    'front' column and cos(a) > 0 behind a downward limb; here sections
    are (t, width, front, back) and detail(t, a) takes a = 0 at the front
    and +pi/2 towards +X, as everywhere else in this figure."""
    swapped = [(t, w, b, f) for t, w, f, b in sections]
    return mc.limb(name, points, swapped, CLAY, u_hint=(1, 0, 0),
                   detail=lambda t, a: detail(t, math.pi - a), rows=rows, around=around)


def arm_mesh(s):
    def detail(t, a):
        front, back = max(0, math.cos(a)), max(0, -math.cos(a))
        out = max(0, s * math.sin(a))
        # The elbow's point behind and its crook in front; the forearm's
        # muscles under the gauntlet.
        return (-0.002 * g(t, 0.50, 0.022) * front ** 6
                + 0.004 * g(t, 0.51, 0.025) * back ** 6
                + 0.002 * g(t, 0.70, 0.05) * out ** 2)
    return limb_down(f"inventor.arm{s}", arm_points(s), ARM_SECTIONS, detail, 130, 56)


LEG_SECTIONS = [(0.00, 0.072, 0.074, 0.080), (0.14, 0.073, 0.073, 0.080),
                (0.32, 0.065, 0.066, 0.068), (0.50, 0.056, 0.058, 0.056),
                (0.60, 0.055, 0.057, 0.056), (0.74, 0.054, 0.054, 0.058),
                (0.88, 0.053, 0.053, 0.054), (1.00, 0.053, 0.053, 0.053)]


def leg_points(s):
    h, k, a = HIP[s], KNEE[s], ANKLE[s]
    return [h + V(-s * 0.008, -0.004, 0.058), h, (h + k) * 0.5, k, (k + a) * 0.5,
            V(a.x, a.y + 0.004, 0.150)]


def leg_mesh(s):
    def detail(t, a):
        front, back = max(0, math.cos(a)), max(0, -math.cos(a))
        out = max(0, s * math.sin(a))
        # Roomy cargo trousers: fuller at the thigh's front and side, the
        # cloth hanging off the knee and the calf.
        return (0.003 * g(t, 0.22, 0.10) * front ** 2 + 0.004 * g(t, 0.72, 0.08) * back ** 3
                + 0.004 * g(t, 0.34, 0.12) * out ** 2)
    return limb_down(f"inventor.leg{s}", leg_points(s), LEG_SECTIONS, detail, 110, 56)


def neck_forms():
    # A slender, upright neck rising behind the jaw.
    return [sd.Chain([V(0, -0.024, 0.955), V(0, -0.020, 1.010), V(0, -0.014, 1.058), V(0, -0.010, 1.100)],
                     [0.046, 0.037, 0.035, 0.037])]


def k_above(z0, z1, k_hi, k_lo):
    def fn(X, Y, Z):
        return k_lo + (k_hi - k_lo) * mc.ss(z0, z1, Z)
    return sd.kfield(fn, max(k_hi, k_lo))


def fold(points, r, n=10):
    return sd.Chain(mc.smooth_points(points, n), r)


def body_sculpt(arms=True):
    """The clothed body. arms=False sculpts the trunk, neck and legs alone
    (the armpit recess included), which the rig uses to tell the flank's
    skin from the arm's."""
    s = sd.Sculpt((-0.30, -0.16, 0.130), (0.30, 0.17, 1.075), vox(0.0019))
    E, C = sd.Ellipsoid, sd.Chain
    s.add(s.mesh_form(trunk_mesh()))
    for side in (-1, 1):
        # Trapezius: a gentle slope from the neck to the shoulder's point,
        # under the coat.
        s.add(C([V(side * 0.026, -0.026, 1.000), V(side * 0.080, -0.026, 0.968),
                 V(side * 0.132, -0.018, 0.940)], [0.034, 0.030, 0.027]), 0.04)
        # Collarbones under the coverall's open neck.
        s.add(C([V(side * 0.016, 0.040, 0.965), V(side * 0.060, 0.038, 0.962),
                 V(side * 0.110, 0.012, 0.952)], [0.0080, 0.0075, 0.0080]), 0.015)
        # The coat's front edge band and the lapel folded back over it.
        s.add(s.mesh_form(coat_edge_slab(side, "edge")), 0.0016)
        s.add(s.mesh_form(coat_edge_slab(side, "lapel")), 0.0016)
        s.add(s.mesh_form(cover_collar_slab(side)), 0.0016)
    s.add(s.mesh_form(collar_slab()), 0.0020)
    s.add(s.mesh_form(pocket_slab()), 0.0012)
    for f in neck_forms():
        s.add(f, 0.035)
    # Legs: a broad blend into the hips and seat, none along the inseam.
    for side in (-1, 1):
        s.add(s.mesh_form(leg_mesh(side)), k_above(0.42, 0.53, 0.030, 0.004))
    for side in (-1, 1):
        sh = SHOULDER[side]
        ax = (ELBOW[side] - sh).normalized()
        if arms:
            # The square tailored shoulder of the coat over the deltoid.
            s.add(E(sh + V(side * 0.002, 0.000, -0.026), (0.042, 0.050, 0.058),
                    axes=(V(1, 0, 0), V(0, 1, 0), ax)), 0.04)
        arm = s.mesh_form(arm_mesh(side))
        # Below the armpit the hanging arm only rests against the flank: a
        # recess keeps a few millimetres between them.
        s.carve(sd.Intersect(sd.Offset(arm, ARM_GAP),
                             sd.Plane(V(0, 0, 0.862), (0, 0, 1), [-1, -1, -1], [1, 1, 1]), 0.022), 0.004)
        if not arms:
            continue
        s.add(arm, k_above(0.86, 0.92, 0.026, 0.0))
        # The gauntlet's flared cuff: a rolled lip at its top.
        c, axv, u, v = arm_frame(side, GLOVE_T + 0.012)
        ring = [c + (u * math.sin(a) + v * math.cos(a)) * 0.0375 for a in np.linspace(0, TAU, 33)]
        s.add(C(ring, 0.0042), 0.004)
        # The sleeve's rolled cuff: two rolls, the lower one fuller.
        for dt, r0, r1 in ((0.000, 0.0465, 0.0060), (-0.034, 0.0475, 0.0062)):
            c, axv, u, v = arm_frame(side, CUFF_T + dt)
            ring = [c + (u * math.sin(a) + v * math.cos(a)) * (r0 + 0.0012 * math.sin(3 * a + dt * 40))
                    for a in np.linspace(0, TAU, 37)]
            s.add(C(ring, r1), 0.005)
    # ---- cloth: short, uneven folds where the cloth is pulled or bunched.
    for side in (-1, 1):
        sh = SHOULDER[side]
        # The sleeve's bunching above the roll and pulls from the armpit.
        for t0, t1, a0, a1, r in ((0.33, 0.37, -0.8, 0.6, 0.0022), (0.29, 0.35, -0.2, 1.1, 0.0018),
                                  (0.12, 0.24, -1.8, -1.0, 0.0018), (0.18, 0.30, -2.5, -1.7, 0.0016),
                                  (0.20, 0.30, 1.6, 2.3, 0.0016)):
            s.carve(fold([on_arm(side, t0 + (t1 - t0) * k, a0 + (a1 - a0) * k) for k in (0, 0.5, 1)], r), 0.006)
        # The sleeve's set-in seam round the shoulder.
        seam = [sh + V(side * (0.044 * math.cos(a) + 0.002), 0.056 * math.sin(a), 0.034 * math.cos(a) - 0.002)
                for a in np.linspace(-1.9, 1.9, 13)]
        s.carve(fold(seam, 0.0010, 30), 0.0014)
        # Gauntlet: the wrinkles where the rubber bunches at the wrist.
        for t0, a0, a1 in ((0.86, -0.8, 0.9), (0.80, -1.6, -0.2), (0.90, 0.6, 2.0)):
            s.carve(fold([on_arm(side, t0 + 0.01 * k, a0 + (a1 - a0) * k) for k in (0, 0.5, 1)], 0.0016),
                    0.005)
        # The coat over the ribs: pulls from the bust's side to the back.
        s.carve(fold([V(side * 0.100, 0.050, 0.835), V(side * 0.118, 0.010, 0.815),
                      V(side * 0.112, -0.040, 0.800)], 0.0022), 0.008)
        # Trousers: the back of the knee, the break above the boots, the
        # pull from the crotch round the thigh.
        k, a = KNEE[side], ANKLE[side]
        s.carve(fold([k + V(-side * 0.040, -0.052, 0.010), k + V(0.0, -0.062, -0.004),
                      k + V(side * 0.036, -0.054, -0.018)], 0.0028), 0.009)
        s.carve(fold([k + V(-side * 0.030, -0.058, 0.032), k + V(side * 0.024, -0.060, 0.024)], 0.0020), 0.007)
        s.carve(fold([V(a.x - side * 0.046, a.y + 0.036, 0.205), V(a.x, a.y + 0.058, 0.194),
                      V(a.x + side * 0.044, a.y + 0.034, 0.200)], 0.0026), 0.009)
        s.carve(fold([V(side * 0.026, 0.044, 0.470), V(side * 0.062, 0.070, 0.425),
                      V(side * 0.104, 0.058, 0.388)], 0.0022), 0.009)
        s.carve(fold([k + V(-side * 0.030, 0.050, 0.040), k + V(side * 0.010, 0.060, 0.022)], 0.0018), 0.007)
    return s.build("inventor.region-body" if arms else "inventor.region-trunk", CLAY)


# ------------------------------------------------------------- head

EYE_C = {s: V(s * 0.0310, 0.0730, 1.1270) for s in (-1, 1)}
EYE_R = (0.0174, 0.0118, 0.0122)


def head_sculpt():
    s = sd.Sculpt((-0.105, -0.125, 0.960), (0.105, 0.150, 1.262), vox(0.00085))
    E, C, B = sd.Ellipsoid, sd.Chain, sd.Box
    for f in neck_forms():
        s.add(f)
    # Cranium and occiput: round and full, under the hair.
    s.add(E(V(0, -0.012, 1.152), (0.077, 0.088, 0.085)), 0.02)
    s.add(E(V(0, -0.040, 1.138), (0.067, 0.064, 0.072)), 0.02)
    # The face: the forehead's broad front plane, the cheekbones' width,
    # a young jaw tapering to a small rounded chin.
    s.add(E(V(0, 0.030, 1.176), (0.063, 0.050, 0.044)), 0.03)
    s.add(E(V(0, 0.024, 1.100), (0.061, 0.058, 0.060)), 0.03)
    s.add(E(V(0, 0.032, 1.066), (0.043, 0.048, 0.033)), 0.03)
    for side in (-1, 1):
        # The jaw's angle below the ear and the mandible's edge to the chin.
        s.add(E(V(side * 0.042, -0.006, 1.064), (0.010, 0.016, 0.015)), 0.02)
        s.add(C([V(side * 0.042, -0.004, 1.058), V(side * 0.031, 0.038, 1.041),
                 V(side * 0.013, 0.066, 1.031)], [0.0085, 0.0082, 0.0080]), 0.016)
    s.add(E(V(0, 0.071, 1.039), (0.019, 0.016, 0.015)), 0.014)
    # High cheekbones and full cheeks.
    for side in (-1, 1):
        s.add(E(V(side * 0.052, 0.050, 1.114), (0.022, 0.018, 0.015)), 0.018)
        s.add(E(V(side * 0.037, 0.060, 1.094), (0.019, 0.018, 0.018)), 0.02)
    # The muzzle round the teeth, which carries the lips.
    s.add(E(V(0, 0.070, 1.068), (0.031, 0.024, 0.023)), 0.018)
    # Temples turn the forehead to the sides.
    for side in (-1, 1):
        s.carve(E(V(side * 0.095, 0.045, 1.168), (0.024, 0.040, 0.044)), 0.03)
    # The brow ridge, drawn down into a frown: low over the inner corners,
    # the corrugators bunched between the brows.
    ridge = mc.smooth_points([V(-0.058, 0.056, 1.151), V(-0.040, 0.072, 1.154), V(-0.018, 0.078, 1.148),
                              V(0.018, 0.078, 1.148), V(0.040, 0.072, 1.154), V(0.058, 0.056, 1.151)], 20)
    s.add(C(ridge, [0.0042 + 0.0008 * math.sin(math.pi * i / 19) for i in range(20)]), 0.010)
    for side in (-1, 1):
        s.add(E(V(side * 0.0075, 0.080, 1.1460), (0.0055, 0.0036, 0.0038)), 0.004)
    # Eye sockets under the ridge (the eyes sit in them), the lower lids'
    # cushions and the cheek's top.
    for side in (-1, 1):
        c = EYE_C[side]
        s.carve(E(c + V(0, 0.010, 0.000), (0.0192, 0.0122, 0.0134)), 0.006)
        s.add(E(c + V(side * 0.002, 0.006, -0.0145), (0.0150, 0.0056, 0.0038)), 0.005)
        # The upper lid's crease under the brow, lowest at the inner corner.
        crease = [c + V(side * 0.016 * u, 0.0098 - 0.004 * u * u, 0.0136 + 0.0016 * u * side * side)
                  for u in np.linspace(-0.95, 0.95, 9)]
        s.carve(C(mc.smooth_points(crease, 15), 0.0008), 0.0018)
    # The nose: a low soft bridge, a broad rounded tip and full wings.
    s.add(C([V(0, 0.080, 1.136), V(0, 0.088, 1.118), V(0, 0.096, 1.104)], [0.0058, 0.0074, 0.0096]), 0.009)
    s.add(E(V(0, 0.1020, 1.0950), (0.0155, 0.0125, 0.0124)), 0.006)
    for side in (-1, 1):
        s.add(E(V(side * 0.0175, 0.0920, 1.0895), (0.0102, 0.0095, 0.0090)), 0.005)
        s.carve(E(V(side * 0.0088, 0.0990, 1.0835), (0.0044, 0.0050, 0.0024)), 0.002)
        # The soft fold from the nose's wing past the mouth's corner.
        s.carve(C([V(side * 0.026, 0.090, 1.090), V(side * 0.033, 0.083, 1.073),
                   V(side * 0.033, 0.080, 1.062)], [0.0009, 0.0007, 0.0004]), 0.008)
    # Full lips set firm: the upper lip's bow, the fuller lower lip, the
    # line between them and the groove over the chin.
    s.add(E(V(0, 0.0900, 1.0712), (0.0198, 0.0080, 0.0066)), 0.006)
    for side in (-1, 1):
        s.add(E(V(side * 0.0058, 0.0945, 1.0732), (0.0062, 0.0040, 0.0044)), 0.003)
    s.add(E(V(0, 0.0885, 1.0578), (0.0180, 0.0090, 0.0074)), 0.006)
    s.carve(C(mc.smooth_points([V(-0.0212, 0.0860, 1.0655), V(0, 0.0965, 1.0648),
                                V(0.0212, 0.0860, 1.0655)], 11), 0.0013), 0.002)
    for side in (-1, 1):
        # The corners pressed in.
        s.carve(E(V(side * 0.0215, 0.0850, 1.0650), (0.0028, 0.0028, 0.0028)), 0.003)
    s.carve(C([V(0, 0.0975, 1.0795), V(0, 0.0955, 1.0750)], 0.0012), 0.003)
    s.carve(C([V(-0.011, 0.0880, 1.0490), V(0.011, 0.0880, 1.0490)], 0.0018), 0.005)
    # Ears: small and close, shell, rim and bowl.
    for side in (-1, 1):
        c = V(side * 0.072, -0.016, 1.120)
        ax = V(side * 0.20, 0.98, 0).normalized()
        s.add(E(c, (0.008, 0.017, 0.024), axes=(V(1, 0, 0), ax, V(0, 0, 1))), 0.007)
        s.add(C(mc.smooth_points([c + V(side * 0.006, 0.010, -0.020), c + V(side * 0.008, -0.010, -0.012),
                                  c + V(side * 0.009, -0.016, 0.006), c + V(side * 0.007, -0.005, 0.022),
                                  c + V(side * 0.005, 0.009, 0.018)], 16), 0.0046), 0.0035)
        s.carve(E(c + V(side * 0.011, 0.002, -0.002), (0.0045, 0.0085, 0.0120)), 0.0035)
    return s.build("inventor.region-head", CLAY)


# ------------------------------------------------------------- fists

FINGERS = [  # (offset along the grip, radius, sweep start, sweep end)
    (0.0255, 0.0090, -0.70, 3.50),
    (0.0085, 0.0095, -0.70, 3.65),
    (-0.0085, 0.0092, -0.68, 3.60),
    (-0.0240, 0.0081, -0.62, 3.45)]


def finger_path(s, i):
    e1, e2, e3 = hand_frame(s)
    W, Cc = WRIST[s], grip_centre(s)
    x, rf, a0, a1 = FINGERS[i]
    rr = BAR_R + rf * 0.92
    pts = [W + e1 * 0.052 + e2 * x - e3 * 0.003]
    for k in range(9):
        t = k / 8
        a = a0 + (a1 - a0) * t
        rad = rr + 0.008 * (1 - t) ** 4
        pts.append(Cc + e2 * x + (e1 * math.cos(a) + e3 * math.sin(a)) * rad)
    return pts, rf


def hand_sculpt(s):
    e1, e2, e3 = hand_frame(s)
    W, Cc = WRIST[s], grip_centre(s)
    lo = np.array(list(W)) - 0.080
    hi = np.array(list(W)) + 0.095
    sc = sd.Sculpt(lo, hi, vox(0.0008))
    # The forearm's end, shared with the body region.
    sc.add(sc.mesh_form(arm_mesh(s)))
    E, Ch = sd.Ellipsoid, sd.Chain
    frame = (e2, e3, e1)
    # A gloved hand, drawn a little large: the palm, the thenar mound under
    # the thumb, the heel of the hand.
    sc.add(sd.Box(W + e1 * 0.036, (0.038, 0.016, 0.034), 0.013, axes=frame), 0.009)
    sc.add(E(W + e1 * 0.022 + e2 * 0.022 + e3 * 0.009, (0.018, 0.014, 0.023), axes=frame), 0.007)
    sc.add(E(W + e1 * 0.027 - e2 * 0.024 + e3 * 0.007, (0.014, 0.012, 0.023), axes=frame), 0.007)
    sc.add(E(W + e1 * 0.006, (0.029, 0.019, 0.015), axes=frame), 0.010)
    for i in range(4):
        pts, rf = finger_path(s, i)
        n = len(pts)
        radii = [rf * (1.10 if j < 2 else 1.0 - 0.14 * (j / (n - 1)) ** 2) for j in range(n)]
        sc.add(Ch(pts, radii), 0.0035 if i else 0.0045)
        sc.add(E(pts[0] + e1 * 0.005 - e3 * 0.0025, (rf * 1.06, rf * 0.92, rf * 1.0), axes=frame), 0.0045)
        mid = pts[4]
        sc.carve(E(mid + (mid - Cc - e2 * FINGERS[i][0]).normalized() * rf * 0.95,
                   (rf * 1.1, rf * 0.25, rf * 0.25), axes=frame), 0.0018)
    # Thumb: from the thenar round the grip, over the index and middle.
    tp = [W + e1 * 0.013 + e2 * 0.030 + e3 * 0.003,
          W + e1 * 0.028 + e2 * 0.037 + e3 * 0.017,
          Cc + e2 * 0.027 + e3 * (BAR_R + 0.017),
          Cc + e2 * 0.012 + e1 * 0.010 + e3 * (BAR_R + 0.021),
          Cc - e2 * 0.002 + e1 * 0.018 + e3 * (BAR_R + 0.018)]
    sc.add(Ch(tp, [0.0122, 0.0126, 0.0112, 0.0100, 0.0088]), 0.006)
    # The channel through the fist stays filled, so the empty left fist
    # reads as a fist rather than a ring.
    sc.add(Ch([Cc - e2 * 0.030, Cc + e2 * 0.022], BAR_R * 0.95), 0.005)
    return sc.build(f"inventor.region-hand{s}", CLAY)


# ------------------------------------------------------------- assembly

# The head is sculpted in its own frame and drawn a tenth larger, as a
# collector's cartoon figure's is: every head piece (eyes, brows, hair,
# goggles) is built against the unscaled sculpt and moved by the same
# matrix (head_matrix), so they stay registered.
HEAD_K = 1.10
HEAD_PIVOT = V(0, -0.012, 1.008)


def head_matrix():
    from mathutils import Matrix
    return (Matrix.Translation(HEAD_PIVOT) @ Matrix.Scale(HEAD_K, 4)
            @ Matrix.Translation(-HEAD_PIVOT))


def to_head(p):
    """A point given in the unscaled head's frame, in the figure."""
    return HEAD_PIVOT + (V(*p) - HEAD_PIVOT) * HEAD_K


def skin_clay(head_ref=False):
    """The welded skin. head_ref=True also returns a copy of the unscaled
    head region, the surface the head pieces are fitted to."""
    head = head_sculpt()
    ref = None
    if head_ref:
        ref = head.copy()
        ref.data = head.data.copy()
        ref.name = "inventor.head-ref"
        import bpy
        bpy.context.collection.objects.link(ref)
    head.data.transform(head_matrix())
    head.data.update()
    regions = [body_sculpt(), head, hand_sculpt(-1), hand_sculpt(1)]
    skin = sd.union_meshes(regions, "inventor.skin", vox(0.00135), CLAY)
    return (skin, ref) if head_ref else skin


def build_clay():
    root = kit.empty(R)
    body = skin_clay()
    body.parent = root
    return root
