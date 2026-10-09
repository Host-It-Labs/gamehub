"""The Cadets' connected suit as one signed-distance sculpt (9 October 2026).

The pressure suit, its cobalt team panels, the ribbed rubber bellows at
elbows and knees, the gauntlet gloves (the right fist round the ray gun's
grip, the left a loose cupped hand) and the moon boots are one closed
surface (figure_archers_sdf.py). Material groups follow construction: the
team panels and bands are raised 2.5 mm proud of the suit with crisp
edges, the bellows are rubber ribs, the quilting and seams are carved.
Every operation names an anatomical part, which seeds the skin weights.

Authored in metres for a 1.24 m (crown) young adult in a chunky padded
1960s pressure suit, in Arena's collector style. +Y forward, Z up; the
figure's right is +X. The head, helmet, ring and hard gear are separate
(figure_archers_head.py, figure_archers_gear.py).

Pure numpy (no Blender): `python figure_archers_body.py out.npz [voxel]`.
"""
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import figure_archers_sdf as S  # noqa: E402
from figure_archers_sdf import (Limb, arc_tube, capsule, ellipsoid, frame, gauss,  # noqa: E402
                                limb, ring, round_cone, sstep, tube, vec)

TAU = math.tau


def V(*a):
    return np.array(a, dtype=float)


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


def rot(axis, angle):
    """Rotation matrix about a unit axis (Rodrigues)."""
    a = unit(axis)
    c, s = math.cos(angle), math.sin(angle)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + s * K + (1 - c) * K @ K


# ------------------------------------------------------------ landmarks

SIDES = ((-1, "L"), (1, "R"))
ANKLE = {s: V(s * .098, -.010, .092) for s in (-1, 1)}
KNEE = {s: V(s * .094, .012, .318) for s in (-1, 1)}
HIP = {s: V(s * .088, -.004, .560) for s in (-1, 1)}
WAIST = V(0, -.012, .640)        # torso bone: lumbar (abdomen and pelvis)
CHEST = V(0, -.020, .800)        # chest bone: lower thoracic (rib cage)
NECK = V(0, -.012, 1.000)        # head bone: base of the neck, in the neck dam
CLAV = {s: V(s * .030, .020, .948) for s in (-1, 1)}    # sternal ends
SHOULDER = {s: V(s * .176, -.014, .902) for s in (-1, 1)}
ELBOW = {s: V(s * .222, -.036, .684) for s in (-1, 1)}
WRIST = {s: V(s * .230, .000, .500) for s in (-1, 1)}
BOOT_TOP = .248
RING_Z = .990                    # top of the gold neck ring (the bubble seats in it)

UPPER = {s: unit(ELBOW[s] - SHOULDER[s]) for s in (-1, 1)}
FOREARM = {s: unit(WRIST[s] - ELBOW[s]) for s in (-1, 1)}


def hand_frame(s, deviation=None):
    """d: wrist to knuckles; n: the palm's facing (towards the thigh);
    a: across the knuckles towards the thumb (forward). The right hand is
    tipped towards its thumb (radial deviation) to carry the gun."""
    fa = FOREARM[s]
    n = V(-s, 0, 0)
    n = unit(n - fa * (n @ fa))
    a = np.cross(n, fa)
    if a[1] < 0:
        a = -a
    dev = math.radians(deviation if deviation is not None else (14 if s > 0 else 6))
    d = unit(fa * math.cos(dev) + a * math.sin(dev))
    a = unit(a - d * (a @ d))
    return d, n, a


# ------------------------------------------------------------ the ray gun's grip
# The gun's own frame (figure_archers_gear.gun): origin at the grip's centre
# in the right fist, +Y down the barrel, +Z the top of the gun. The grip is
# raked RAKE back from the gun's vertical, so the barrel sits RAKE above the
# hand's own line: Yg = d cos r + a sin r, Zg = a cos r - d sin r, and the
# palm faces -Xg.
RAKE = math.radians(16)
GRIP_E1 = .047     # grip centre along the hand from the wrist
GRIP_E3 = .021     # and off the palm
GRIP_HALF = (.0118, .0165)   # the grip's half width (Xg) and half depth (front-back)


def gun_frame():
    """(centre, R): R's columns are the gun's x, y, z axes in the world."""
    d, n, a = hand_frame(1)
    c, s = math.cos(RAKE), math.sin(RAKE)
    yg = unit(d * c + a * s)
    zg = unit(a * c - d * s)
    xg = np.cross(yg, zg)
    centre = WRIST[1] + d * GRIP_E1 + n * GRIP_E3
    return centre, np.stack([xg, yg, zg], axis=1)


GUN_C, GUN_R = gun_frame()


def gun_point(local):
    return GUN_C + GUN_R @ vec(local)


# The grip's axis (top of the grip to its butt), raked back.
GRIP_AXIS = GUN_R @ unit(V(0, -math.sin(RAKE), -math.cos(RAKE)))


def front_of(ang, width=1.0):
    return np.maximum(0, np.cos(ang)) ** (2 / width)


def band_mask(fn_lo, fn_hi):
    """A region between two levels of a scalar field (metres): negative
    inside, so `intersect` keeps it."""
    def fn(p):
        v = fn_lo(p)
        w = fn_hi(p)
        return np.maximum(v, w)
    return S.Shape(fn)


# ------------------------------------------------------------------ torso
# Sections of the padded trunk: (z, half width, front, back). Broad padded
# chest and shoulder blades, the flank narrowed below the armpit where the
# arm hangs, a firm waist under the belt, a padded seat.

TORSO_Z = [.522, .556, .600, .642, .690, .740, .790, .838, .880, .912, .940, .966, .990, 1.006]
TORSO_W = [.084, .146, .150, .140, .142, .146, .148, .156, .164, .156, .128, .098, .078, .066]
TORSO_F = [.066, .086, .089, .086, .090, .097, .106, .113, .110, .101, .089, .076, .064, .056]
TORSO_B = [.072, .102, .103, .094, .093, .095, .097, .099, .100, .097, .090, .080, .068, .060]
TORSO_PATH = [(0, -.004, .522), (0, -.002, .640), (0, .000, .780), (0, -.006, .900),
              (0, -.012, 1.006)]


def torso_rows():
    path = np.array(TORSO_PATH)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.interp(TORSO_Z, path[:, 2], s / s[-1])
    return list(zip(t, TORSO_W, TORSO_F, TORSO_B))


def torso_detail(t, ang):
    z = .522 + t * .484
    front = np.maximum(0, np.cos(ang))
    back = np.maximum(0, -np.cos(ang))
    side = np.abs(np.sin(ang))
    d = np.zeros_like(t)
    # The armpit: the trunk's side falls in under the hanging arm.
    d -= .010 * gauss(z, .800, .060) * side ** 6
    # Chest padding either side of the front, shoulder blades behind.
    d += .006 * gauss(z, .850, .040) * gauss(np.abs(ang), .55, .32)
    d += .005 * gauss(z, .870, .045) * gauss(np.abs(ang), 2.55, .30)
    d -= .0025 * gauss(z, .80, .12) * gauss(np.abs(ang), math.pi, .16)
    # Suit fabric bunched above the belt, soft pulls towards it.
    d += .0030 * (0.6 + 0.4 * np.sin(ang * 11 + .7)) * gauss(z, .668, .010)
    d += .0016 * np.sin(ang * 7 + 1.4 + z * 40) * gauss(z, .700, .022) * side
    # Padded seat and a crease at the front of each hip.
    d += .0040 * gauss(z, .585, .030) * back
    d -= .0022 * gauss(z, .566, .010) * front * side
    return d


TORSO = None


def torso_limb():
    global TORSO
    if TORSO is None:
        TORSO = Limb(TORSO_PATH, torso_rows(), torso_detail, samples=72, power=2.3)
    return TORSO


def torso_level(p):
    """(z, angle) of points about the trunk's axis (0 front, +pi/2 right)."""
    L = torso_limb()
    t, ang, radial, over, rs, corr = L.coords(p)
    return p[:, 2], ang, radial, rs


def torso(sc, part="torso"):
    sc.add(torso_limb().shape(), group="suit", part=part)
    # Shoulder girdle: the trapezius slope from the collar to the shoulder,
    # padded, and the deltoid's front and back.
    for s in (-1, 1):
        sc.add(round_cone((s * .045, -.018, .952), (s * .150, -.016, .912), .034, .044),
               k=.030, group="suit", part=part)


CORE = None


def torso_core():
    """The trunk's own surface with its shoulder girdle (no arms, legs or
    construction), as a shape the panels and belt are laid on."""
    global CORE
    if CORE is None:
        sc = S.Sculpt("cadet trunk")
        torso(sc)
        lo, hi = sc.bounds()
        CORE = S.Shape(lambda p: sc.at(p), lo, hi)
    return CORE


def torso_surface(z, ang, lift=0.0):
    """Points on the trunk's own surface at heights z and angles ang (ray
    from the axis, bisected on the trunk alone)."""
    L = torso_limb()
    z = np.atleast_1d(np.asarray(z, float))
    ang = np.atleast_1d(np.asarray(ang, float))
    path = np.array(TORSO_PATH)
    cy = np.interp(z, path[:, 2], path[:, 1])
    origins = np.stack([np.zeros_like(z), cy, z], 1)
    dirs = np.stack([np.sin(ang), np.cos(ang), np.zeros_like(z)], 1)
    lo = np.zeros(len(z))
    hi = np.full(len(z), .3)
    for _ in range(40):
        mid = (lo + hi) / 2
        inside = L(origins + dirs * mid[:, None]) < 0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    return origins + dirs * ((lo + hi) / 2 + lift)[:, None]


# ------------------------------------------------------------------ panels

PANEL_UP = .0026     # how far the team panels stand proud of the suit


def proud(shape, up=PANEL_UP, under=.006):
    """The band of space just outside a form (a panel's slab)."""
    return S.shell(shape, -under, up)


def yoke_line(ang):
    """The chest yoke's lower edge: a broad V from the shoulders to the
    sternum (z of the edge at each angle; 0 is the front)."""
    a = np.abs(ang)
    return .842 - .040 * np.clip(1 - a / .9, 0, 1) ** 1.3 + .020 * sstep(1.2, 1.9, a)


def chest_panels(sc):
    slab = proud(torso_core())

    # The cobalt yoke across the upper chest and over the shoulders to the
    # shoulder blades, its lower edge a broad V on the chest, level behind.
    def yoke(p):
        z, ang, _, _ = torso_level(p)
        return np.maximum(yoke_line(ang) - z, z - .975)
    sc.add(S.intersect(slab, S.Shape(yoke), k=.0012), k=.0014, group="team", part="torso")
    # The cobalt front panel: from the yoke's point down to the belt, a
    # little wider at the chest (the chest unit sits on it).
    def front(p):
        z, ang, radial, _ = torso_level(p)
        half = .040 + .010 * gauss(z, .79, .05)
        across = np.abs(ang) * radial - half
        return np.maximum(across, np.maximum(.655 - z, z - .845))
    sc.add(S.intersect(slab, S.Shape(front), k=.0012), k=.0014, group="team", part="torso")
    # Side panels under the arms down to the belt (they carry on down the
    # outside of each leg).
    def side(p):
        z, ang, radial, _ = torso_level(p)
        off = (np.abs(ang) - math.pi / 2) * radial
        return np.maximum(np.abs(off + .002) - .020, np.maximum(.655 - z, z - .800))
    sc.add(S.intersect(slab, S.Shape(side), k=.0012), k=.0014, group="team", part="torso")


def seam(sc, points, r=.0013, k=.0012):
    """A sewn seam carved along a path on the surface."""
    sc.cut(arc_tube(points, [r] * len(points)), k=k, group=None)


def torso_seams(sc):
    # Centre-back seam and the quilted channels across the abdomen (front
    # and sides, between the front panel's edges and the side panels).
    zs = np.linspace(.68, .88, 9)
    back = torso_surface(zs, np.full(len(zs), math.pi), lift=-.0002)
    seam(sc, list(back))
    for z in (.700, .728, .756, .784):
        for s in (-1, 1):
            angs = s * np.linspace(.52, 1.28, 9)
            pts = torso_surface(np.full(len(angs), z), angs, lift=-.0004)
            sc.cut(arc_tube(list(pts), [.0022] * len(pts)), k=.0035, group=None)
    # Shoulder seams over the top, from the collar to the arm.
    for s in (-1, 1):
        pts = [V(s * .060, -.010, .985), V(s * .105, -.012, .962), V(s * .150, -.014, .940),
               V(s * .190, -.016, .936)]
        seam(sc, pts, r=.0012)


# ------------------------------------------------------------------ arms

def sleeve_detail(s):
    def fn(t, ang):
        d = .0020 * np.sin(ang * 4 + t * 14 + s) * gauss(t, .55, .20)
        d += .0012 * np.sin(ang * 3 - t * 9) * gauss(t, .25, .12)
        return d
    return fn


UPPER_SECTIONS = [(0, .042, .046, .048), (.22, .046, .050, .051), (.6, .045, .048, .048),
                  (.88, .042, .045, .045), (1, .040, .042, .042)]
FORE_SECTIONS = [(0, .040, .042, .042), (.5, .041, .042, .043), (1, .039, .040, .040)]
_LIMBS = {}


def sleeve(s, which):
    """The upper or forearm sleeve's limb (shared by the form and its bands)."""
    key = (s, which)
    if key not in _LIMBS:
        sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
        up, fa = UPPER[s], FOREARM[s]
        if which == "upper":
            path = [sh + V(-s * .018, 0, .010), sh + V(s * .006, .001, -.030),
                    (sh + el) * .5 + V(s * .004, 0, 0), el - up * .036]
            _LIMBS[key] = Limb(path, UPPER_SECTIONS, sleeve_detail(s), side=(s, 0, 0), samples=40)
        else:
            path = [el + fa * .034, el + fa * .090, wr - fa * .040]
            _LIMBS[key] = Limb(path, FORE_SECTIONS, sleeve_detail(-s), side=(s, 0, 0), samples=24)
    return _LIMBS[key]


def arm(sc, s):
    P = "arm" + ("L" if s < 0 else "R")
    sh, el = SHOULDER[s], ELBOW[s]
    up, fa = UPPER[s], FOREARM[s]

    def k_arm(p):
        # Blend generously into the shoulder, not at all down the flank.
        return .003 + .030 * sstep(.865, .925, p[:, 2])
    # The padded upper sleeve, narrowing into the elbow's bellows.
    sc.add(sleeve(s, "upper").shape(), k=k_arm, reach=.034, group="suit", part=P)
    # The deltoid's padded cap.
    sc.add(ellipsoid(sh + V(s * .014, .002, -.012), (.046, .050, .052)), k=k_arm, reach=.034,
           group="suit", part=P)
    # The bellows: a narrower rubber sleeve with four ribs over the elbow.
    bell_axis = unit(up + fa)
    sc.add(limb([el - up * .044, el, el + fa * .040], [(0, .036, .036, .036), (1, .034, .034, .034)],
                side=(s, 0, 0), samples=12), k=.008, group="rubber", part=P)
    for i, u in enumerate(np.linspace(-.032, .030, 4)):
        c = el + (up if u < 0 else fa) * u
        sc.add(ring(c, bell_axis, .0352 - .0008 * i, .0062, squash=1.0), k=.0035, group="rubber",
               part=P)
    # The forearm sleeve to the gauntlet.
    sc.add(sleeve(s, "fore").shape(), k=.006, group="suit", part=P)


def along(origin, axis, a, b):
    """Between two planes across an axis (a slab mask)."""
    o, ax = vec(origin), unit(axis)

    def fn(p):
        u = (p - o) @ ax
        return np.maximum(a - u, u - b)
    return S.Shape(fn)


def arm_bands(sc, s):
    """Two cobalt bands round the upper arm and one round the forearm."""
    P = "arm" + ("L" if s < 0 else "R")
    sh, el = SHOULDER[s], ELBOW[s]
    up, fa = UPPER[s], FOREARM[s]
    for a, b in ((.070, .094), (.108, .124)):
        sc.add(S.intersect(proud(sleeve(s, "upper").shape(), .0030), along(sh, up, a, b), k=.0010),
               k=.0012, group="team", part=P)
    sc.add(S.intersect(proud(sleeve(s, "fore").shape(), .0030), along(el, fa, .104, .130), k=.0010),
           k=.0012, group="team", part=P)


# ------------------------------------------------------------------ gloves

def finger_k(base, d, near=.006, far=.016, big=.0075, small=.0006):
    base, d = vec(base), vec(d)

    def k(p):
        along = (p - base) @ d
        return small + (big - small) * (1 - sstep(near, far, along))
    return k


def gauntlet(sc, s):
    """The glove's flared gauntlet over the sleeve's end, a rolled lip."""
    P = "arm" + ("L" if s < 0 else "R")
    wr, fa = WRIST[s], FOREARM[s]
    top = wr - fa * .060
    sc.add(limb([top, wr - fa * .030, wr + fa * .004],
                [(0, .0475, .0490, .0490), (.45, .0430, .0440, .0445), (1, .0330, .0300, .0300)],
                side=(s, 0, 0), samples=16), k=.004, group="glove", part=P)
    sc.add(ring(top + fa * .001, fa, .0462, .0048, squash=1.0), k=.0025, group="glove", part=P)
    # A wrist strap with a tab.
    sc.add(ring(wr - fa * .010, fa, .0400, .0040, squash=1.1), k=.002, group="glove", part=P)


def palm(sc, s, d, n, a, wrist, P, sections=None):
    """The padded glove palm from the wrist to the knuckles."""
    k_end = wrist + d * .058
    sections = sections or [(0, .0220, .0128, .0112), (.35, .0250, .0142, .0098),
                            (.75, .0262, .0132, .0090), (1, .0252, .0112, .0086)]

    def pd(t, ang):
        e = .0045 * gauss(t, .30, .20) * np.maximum(0, np.cos(ang - 1.0)) ** 2   # thenar
        e += .0028 * gauss(t, .40, .25) * np.maximum(0, np.cos(ang + 1.0)) ** 2  # hypothenar
        e += .0014 * gauss(t, .85, .10) * np.maximum(0, -np.cos(ang)) ** 2       # knuckle pad
        return e
    sc.add(limb([wrist - d * .012, wrist + d * .022, k_end], sections, pd,
                side=tuple(a), front=tuple(n), samples=24), k=.010, group="glove", part=P)
    return k_end


def thumb(sc, points, P, radii=(.0122, .0098, .0088, .0070)):
    sc.add(tube(points, list(radii)),
           k=finger_k(points[0], unit(points[1] - points[0]), near=.012, far=.024, big=.010),
           reach=.010, group="glove", part=P)


def left_hand(sc):
    """A loose glove, the fingers cupped together (it cups the gun's body
    in a two-handed hold and hangs relaxed otherwise)."""
    s, P = -1, "armL"
    d, n, a = hand_frame(s)
    wr = WRIST[s]
    knuckles = palm(sc, s, d, n, a, wr, P)
    # (offset across, three lengths, radius, curls in degrees, drop)
    specs = [(.0150, .0250, .0170, .0140, .0074, 22, 30, 20, -.004),
             (.0050, .0272, .0180, .0146, .0076, 26, 34, 22, 0.0),
             (-.0052, .0258, .0172, .0140, .0072, 30, 38, 24, -.002),
             (-.0150, .0206, .0140, .0120, .0064, 34, 42, 26, -.006)]
    for i, (off, l1, l2, l3, r, c1, c2, c3, drop) in enumerate(specs):
        spread = math.radians((i - 1.4) * -3.0)
        base = knuckles + a * off + d * drop
        dv = unit(d * math.cos(spread) + a * math.sin(spread))
        pts, rad = [base - d * .006], [r * 1.10]
        cur = base
        for L, c, rr in ((l1, c1, r), (l2, c2, r * .93), (l3, c3, r * .86)):
            axis = unit(np.cross(dv, n))
            dv = unit(rot(axis, math.radians(c)) @ dv)
            pts.append(cur)
            rad.append(rr)
            cur = cur + dv * L
        pts.append(cur - dv * .003)
        rad.append(r * .74)
        sc.add(tube(pts[1:], rad[1:]), k=finger_k(knuckles, d), reach=.008, group="glove", part=P)
        sc.add(tube(pts[:2], rad[:2]), k=.006, group="glove", part=P)
        sc.add(ellipsoid(base - n * .0052, (.0062, .0062, .0062)), k=.004, group="glove", part=P)
    cmc = wr + d * .013 + a * .0150 + n * .0058
    t1 = cmc + unit(d * .80 + a * .45 + n * .40) * .030
    t2 = t1 + unit(d * .85 + a * .10 + n * .52) * .021
    t3 = t2 + unit(d * .70 + n * .70) * .016
    thumb(sc, [cmc, t1, t2, t3], P)


def right_hand(sc):
    """A firm pistol grip round the ray gun: three fingers wrap the grip
    below the trigger guard, the index curls through it onto the trigger,
    the thumb closes over the side of the grip."""
    s, P = 1, "armR"
    d, n, a = hand_frame(s)
    wr = WRIST[s]
    knuckles = palm(sc, s, d, n, a, wr, P)
    C = GUN_C
    g = unit(-GRIP_AXIS)          # along the grip, butt to top (towards the thumb)
    u = unit(d - g * (d @ g))
    v = np.cross(g, u)
    if v @ n < 0:
        v = -v
    R_wrap = .0215
    # (along the grip, lengths, radius); the index first, up by the trigger.
    stations = [(.0225, .0250, .0160, .0128, .0078), (.0072, .0270, .0172, .0136, .0080),
                (-.0080, .0260, .0166, .0130, .0077), (-.0222, .0210, .0138, .0112, .0068)]
    phi0 = math.atan2(-.0150, .0040)
    for i, (along, l1, l2, l3, r) in enumerate(stations):
        centre = C + g * along
        wrap = R_wrap + (.0045 if i == 0 else 0)
        pts = [knuckles + a * (along * 0.92) - u * .004 - v * .002]
        rad = [r * 1.12]
        phi = phi0
        for L, rr in ((l1, r), (l2, r * .93), (l3, r * .85)):
            dphi = L / wrap * (.86 if i == 0 else 1.0)
            for half in (.5, 1.0):
                ph = phi + dphi * half
                pts.append(centre + (u * math.cos(ph) + v * math.sin(ph)) * wrap)
                rad.append(rr)
            phi += dphi
        rad[-1] = r * .74
        sc.add(tube(pts, rad), k=finger_k(knuckles, d, near=.002, far=.010), reach=.008,
               group="glove", part=P)
        kn = centre + (u * math.cos(phi0 + l1 / wrap) + v * math.sin(phi0 + l1 / wrap)) * \
            (wrap + r * .55)
        sc.add(ellipsoid(kn, (.0056, .0056, .0056)), k=.004, group="glove", part=P)
    cmc = wr + d * .011 + a * .0160 + n * .0066
    pts = [cmc,
           cmc + unit(d * .35 + g * .70 + n * .40) * .029,
           C + g * .0250 + (u * math.cos(-2.45) + v * math.sin(-2.45)) * .0225,
           C + g * .0290 + (u * math.cos(2.75) + v * math.sin(2.75)) * .0212]
    thumb(sc, pts, P)


# ------------------------------------------------------------------ legs

def trouser_detail(s):
    def fn(t, ang):
        front = np.maximum(0, np.cos(ang))
        back = np.maximum(0, -np.cos(ang))
        d = .0024 * np.sin(ang * 4 + t * 20 + s) * gauss(t, .30, .12)
        d += .0020 * front * np.sin(ang * 3 - t * 30) * gauss(t, .74, .06)
        d += .0040 * (0.6 + 0.4 * np.sin(ang * 7 + s)) * gauss(t, .97, .04)   # bunched over the boot
        d += .0015 * back * gauss(t, .45, .12)
        return d
    return fn


def leg_path(s):
    h, k = HIP[s], KNEE[s]
    return [h + V(-s * .010, 0, .050), h + V(s * .004, 0, -.030), (h + k) * .5 + V(s * .003, .004, 0),
            k + V(0, 0, .046)]


def shin_path(s):
    k = KNEE[s]
    return [k + V(0, -.002, -.044), V(k[0], k[1] - .006, .210), V(k[0], k[1] - .008, BOOT_TOP - .02)]


LEG_SECTIONS = [(0, .074, .074, .086), (.18, .072, .072, .082), (.50, .066, .066, .070),
                (.82, .060, .060, .060), (1, .056, .057, .057)]
SHIN_SECTIONS = [(0, .053, .055, .055), (.35, .056, .056, .060), (1, .053, .053, .055)]


def leg_limb(s, which):
    key = (s, which)
    if key not in _LIMBS:
        if which == "thigh":
            _LIMBS[key] = Limb(leg_path(s), LEG_SECTIONS, trouser_detail(s), side=(s, 0, 0), samples=40)
        else:
            _LIMBS[key] = Limb(shin_path(s), SHIN_SECTIONS, trouser_detail(-s), side=(s, 0, 0), samples=24)
    return _LIMBS[key]


def leg(sc, s):
    P = "leg" + ("L" if s < 0 else "R")
    k = KNEE[s]
    sc.add(leg_limb(s, "thigh").shape(), k=lambda p: .004 + .034 * sstep(.500, .600, p[:, 2]),
           reach=.038, group="suit", part=P)
    # The knee bellows: a narrower rubber sleeve with four ribs.
    sc.add(limb([k + V(0, 0, .050), k, k + V(0, -.002, -.050)],
                [(0, .050, .052, .052), (.5, .048, .050, .050), (1, .050, .051, .051)],
                side=(s, 0, 0), samples=12), k=.010, group="rubber", part=P)
    for i, dz in enumerate(np.linspace(.036, -.036, 4)):
        sc.add(ring(k + V(0, .002, dz), (0, -.04, 1), .0505, .0074, squash=1.0), k=.004,
               group="rubber", part=P)
    # The shin to the boot.
    sc.add(leg_limb(s, "shin").shape(), k=.008, group="suit", part=P)


def leg_panels(sc, s):
    """The side stripe down the outside of each thigh and shin."""
    P = "leg" + ("L" if s < 0 else "R")

    def stripe(L, lo, hi):
        def fn(p):
            t, ang, radial, over, rs, corr = L.coords(p)
            off = (ang - math.pi / 2) * radial
            return np.maximum(np.abs(off) - .017, np.maximum(lo - t, t - hi))
        return S.Shape(fn)
    for which, lo, hi in (("thigh", .08, .86), ("shin", .08, .95)):
        L = leg_limb(s, which)
        sc.add(S.intersect(proud(L.shape()), stripe(L, lo, hi), k=.0012), k=.0014, group="team",
               part=P)


def boot(sc, s):
    """A chunky moon boot: a padded shaft with a rolled ribbed top, a
    rounded toe, a thick dark sole with tread."""
    P = "leg" + ("L" if s < 0 else "R")
    k, a = KNEE[s], ANKLE[s]
    toe_out = math.radians(6) * s
    fwd = V(math.sin(toe_out), math.cos(toe_out), 0)
    top = V(k[0], k[1] - .010, BOOT_TOP)
    path = [top + V(0, 0, .004), V(a[0], a[1] - .002, .180), V(a[0], a[1], .110), V(a[0], a[1] + .004, .060)]

    def bdetail(t, ang):
        e = .0030 * np.sin(ang * 5 + s) * gauss(t, .78, .08)        # ankle creases
        e += .0018 * np.sin(ang * 3 + 1 + s) * gauss(t, .45, .12)
        return e
    sc.add(limb(path, [(0, .0660, .0680, .0690), (.30, .0630, .0650, .0670), (.62, .0600, .0640, .0650),
                       (1, .0580, .0660, .0640)], bdetail, side=(s, 0, 0), samples=30),
           k=.004, group="boot", part=P)
    # The rolled ribbed top.
    sc.add(ring(top + V(0, .001, .004), (0, -.06, 1), .0672, .0105), k=.004, group="boot", part=P)
    sc.add(ring(top + V(0, .001, -.016), (0, -.06, 1), .0668, .0062), k=.004, group="boot", part=P)
    # The foot: a chunky rounded toe over a broad sole.
    heel = V(a[0], a[1], 0) - fwd * .078
    ball = V(a[0], a[1], 0) + fwd * .085
    toe = V(a[0], a[1], 0) + fwd * .140
    foot_path = [heel + V(0, 0, .058), V(a[0], a[1], 0) + fwd * .010 + V(0, 0, .072),
                 ball + V(0, 0, .050), toe + V(0, 0, .042)]
    sc.add(limb(foot_path, [(0, .046, .052, .050), (.35, .052, .058, .048), (.72, .054, .046, .034),
                            (1, .040, .030, .028)], side=(1, 0, 0), front=(0, 0, 1),
                samples=28), k=.022, group="boot", part=P)
    # The sole: a thick dark wedge proud of the upper all round, then the
    # tread cut across it.
    sole_path = [heel + V(0, 0, .014) + fwd * .006, V(a[0], a[1], .014) + fwd * .03,
                 ball + V(0, 0, .014), toe + V(0, 0, .014) - fwd * .006]
    sole = limb(sole_path, [(0, .052, .0145, .0145), (.35, .057, .0145, .0145),
                            (.72, .060, .0145, .0145), (1, .046, .0145, .0145)],
                side=(1, 0, 0), front=(0, 0, 1), samples=24, power=3.0)
    sc.add(sole, k=.003, group="sole", part=P)
    side_v = V(fwd[1], -fwd[0], 0)
    for i in range(9):
        c = heel + fwd * (.020 + i * .026) + V(0, 0, -.0005)
        sc.cut(capsule(c - side_v * .07, c + side_v * .07, .0044), k=.0015, group="sole")
    # The cobalt stripe down the front of the shaft and over the instep.
    shaft = Limb(path, [(0, .0660, .0680, .0690), (.30, .0630, .0650, .0670), (.62, .0600, .0640, .0650),
                        (1, .0580, .0660, .0640)], None, side=(s, 0, 0), samples=30)

    def stripe(p):
        t, ang, radial, over, rs, corr = shaft.coords(p)
        return np.maximum(np.abs(ang * radial) - .016, np.maximum(.08 - t, t - .70))
    sc.add(S.intersect(proud(shaft.shape(), .0028), S.Shape(stripe), k=.0010), k=.0012, group="team",
           part=P)


# ------------------------------------------------------------------ belt

def belt(sc):
    """A broad dark belt over the suit's waist (the buckle and pouches are
    hard parts in figure_archers_gear)."""
    slab = S.shell(torso_core(), -.006, .0055)

    def band(p):
        z = p[:, 2]
        return np.maximum(.627 - z, z - .661)
    sc.add(S.intersect(slab, S.Shape(band), k=.0016), k=.0018, group="belt", part="torso")


# ------------------------------------------------------------------ sculpt

def sculpt():
    sc = S.Sculpt("cadet suit")
    torso(sc)
    for s in (-1, 1):
        arm(sc, s)
        gauntlet(sc, s)
    left_hand(sc)
    right_hand(sc)
    for s in (-1, 1):
        leg(sc, s)
        boot(sc, s)
    # Construction on top of the forms.
    chest_panels(sc)
    for s in (-1, 1):
        arm_bands(sc, s)
        leg_panels(sc, s)
    belt(sc)
    torso_seams(sc)
    # Keep a gap between each hanging arm and the flank below the armpit,
    # and between the forearm and the hip, so the skin never bridges them.
    for s in (-1, 1):
        sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
        arm_shape = limb([sh + V(0, 0, -.06), el, wr],
                         [(0, .052, .054, .054), (.5, .047, .049, .049), (1, .046, .047, .047)],
                         side=(s, 0, 0), samples=24)

        def gap(p, arm_shape=arm_shape, s=s, sh=sh, wr=wr):
            f = arm_shape(p)
            z = p[:, 2]
            axis_x = sh[0] + (wr[0] - sh[0]) * np.clip((sh[2] - z) / (sh[2] - wr[2]), 0, 1)
            zone = (z > .575) & (z < .835) & (s * p[:, 0] < s * axis_x)
            return np.where(zone, np.maximum(f - .006, -f), 1.0)
        sc.cut(S.Shape(gap, np.minimum(sh, wr) - .07, np.maximum(sh, wr) + .07), k=.0015)
    # Everything stands on the floor.
    sc.clip(S.half_space((0, 0, 0), (0, 0, -1)), k=0.0)
    return sc


GROUPS = ["suit", "team", "rubber", "glove", "boot", "sole", "belt"]
PARTS = ["torso", "armL", "armR", "legL", "legR"]

REGIONS = {
    "all": ((-.30, -.14, -.002), (.30, .26, 1.03)),
    "hands": ((-.29, -.06, .38), (.29, .12, .60)),
    "upper": ((-.30, -.14, .60), (.30, .16, 1.03)),
    "feet": ((-.18, -.12, -.002), (.18, .26, .36)),
}


def build_arrays(h=.0018, log=print, region="all"):
    sc = sculpt()
    lo, hi = REGIONS[region]
    points, quads, tris = S.mesh_arrays(sc, h, lo=lo, hi=hi, log=log)
    faces = np.concatenate([quads, np.c_[tris, tris[:, 2:3]]]) if len(tris) else quads
    tri_mask = np.r_[np.zeros(len(quads), bool), np.ones(len(tris), bool)]
    corners = points[faces]
    centres = np.where(tri_mask[:, None], corners[:, :3].mean(1), corners.mean(1))
    groups = sc.classify(centres, GROUPS, "group")
    parts_v = sc.classify(points, PARTS, "part")
    return dict(points=points, quads=quads, tris=tris, groups=groups, parts=parts_v)


if __name__ == "__main__":
    import time
    t0 = time.time()
    out = sys.argv[1]
    h = float(sys.argv[2]) if len(sys.argv) > 2 else .0018

    def log(m):
        print(f"[{time.time() - t0:6.1f}s] {m}", flush=True)
    arrays = build_arrays(h, log)
    np.savez_compressed(out, **arrays)
    log(f"saved {out}: {len(arrays['points'])} vertices, {len(arrays['quads'])} quads")
