"""The Pirate's connected body as one signed-distance sculpt (9 October 2026).

Skin, the linen shirt, trousers and boots are one closed surface
(figure_pirate_sdf.py), so a sleeve never parts from its shoulder and skin
never breaks through a garment under skinning: the shirt *is* the torso's
surface, the boot *is* the shin's. Material groups meet under the overlays
that hide those seams in life too (collar, rolled cuffs, sash, boot tops).
Every operation also names an anatomical part, which seeds the skin weights.

Authored in metres for a 1.27 m (crown) adult woman in Arena's stylised
collector style: about 6 heads tall, a strong neck and shoulders, a narrow
rib cage, slim waist and full hips, long legs in tall boots, strong
forearms and large readable hands. +Y forward, Z up; her right is +X.

Pure numpy (no Blender), so the sculpt can be evaluated and cached by the
bundled Python: `python figure_pirate_body.py out.npz [voxel]`.
"""
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import figure_pirate_sdf as S  # noqa: E402
from figure_pirate_sdf import (Limb, arc_tube, capsule, ellipsoid, frame, gauss,  # noqa: E402
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
ANKLE = {s: V(s * .084, -.004, .082) for s in (-1, 1)}
KNEE = {s: V(s * .081, .010, .345) for s in (-1, 1)}
HIP = {s: V(s * .078, .000, .612) for s in (-1, 1)}
WAIST = V(0, -.012, .700)        # torso bone: lumbar (abdomen and pelvis)
CHEST = V(0, -.020, .860)        # chest bone: lower thoracic (rib cage)
NECK = V(0, -.014, 1.030)        # head bone: base of the neck
CLAV = {s: V(s * .022, .024, .984) for s in (-1, 1)}   # sternal ends
SHOULDER = {s: V(s * .132, -.016, .964) for s in (-1, 1)}
ELBOW = {-1: V(-.170, -.026, .752), 1: V(.173, -.022, .752)}
# The hands hang clear of the hips and the waistcoat's skirt; the sword
# hand a little further out and forward.
WRIST = {-1: V(-.207, .030, .560), 1: V(.213, .036, .558)}
HC = V(0, .000, 1.165)           # head centre (between the ears)
CHIN_Z = 1.050
CROWN_Z = 1.277
BOOT_TOP = .306

UPPER = {s: unit(ELBOW[s] - SHOULDER[s]) for s in (-1, 1)}
FOREARM = {s: unit(WRIST[s] - ELBOW[s]) for s in (-1, 1)}
CUFF = {s: ELBOW[s] - UPPER[s] * .034 for s in (-1, 1)}


def hand_frame(s):
    """d: wrist to knuckles; n: the palm's facing (towards the thigh);
    a: across the knuckles towards the thumb (forward)."""
    d = unit(FOREARM[s] + V(-s * .085, .06, -.02))
    n = V(-s, 0, 0)
    n = unit(n - d * (n @ d))
    a = np.cross(n, d)
    if a[1] < 0:
        a = -a
    return d, n, a


# The cutlass grip: its centre in the right fist (on the palm side of the
# knuckles, where the fingers close round it) and its axis from pommel to
# guard, forward and a little down: the curved blade carries on from it.
_d, _n, _a = hand_frame(1)
FIST = WRIST[1] + _d * .049 + _n * .019
GRIP_DIR = unit(_a * .93 + _d * .28 + V(.05, 0, 0))


def front_of(ang, width=1.0):
    return np.maximum(0, np.cos(ang)) ** (2 / width)


# ------------------------------------------------------------------ head

EYE = {s: V(s * .0315, .0668, 1.1630) for s in (-1, 1)}
EYE_RADII = (.0150, .0110, .0124)   # the visible eyeball: a lens, wider than deep
# The almond aperture in the eye's own frame (x outward from the nose, z
# up): corners at +-14.4 mm, the upper lid 5.6 mm over the centre (it
# covers the top of the iris: a focused glare), the lower lid 5.6 mm under.
LID_UPPER = (.0050, .0225)   # lid height over the centre, arc radius
LID_LOWER = (-.0057, .0228)
LID_TILT = math.radians(7)   # outer corners higher: alert, fierce
MOUTH = V(0, .0905, 1.0945)  # centre of the open mouth's aperture
MOUTH_HALF = .0222


def eye_frame(s):
    """Columns: x outward (away from the nose), y the gaze (a touch
    outward of straight ahead), z up."""
    return frame(x_axis=vec((s, -s * .12, 0)), y_axis=vec((s * .12, 1, 0)))


def almond(s, grow=0.0):
    """The lid aperture as a 2D distance (negative inside), extruded along
    the gaze."""
    c = EYE[s].astype(np.float32)
    R = eye_frame(s).astype(np.float32)
    up_h, up_r = LID_UPPER
    lo_h, lo_r = LID_LOWER
    ct, st = math.cos(LID_TILT), math.sin(LID_TILT)

    def fn(p):
        q = (p - c) @ R
        x, z = q[:, 0], q[:, 2]
        xr = x * ct - z * st
        zr = x * st + z * ct
        du = np.sqrt(xr ** 2 + (zr - (up_h - up_r)) ** 2) - up_r
        dl = np.sqrt(xr ** 2 + (zr - (lo_h + lo_r)) ** 2) - lo_r
        return np.maximum(du, dl) - grow
    return fn


def face_y(x):
    """How far the face's front falls back with |x| at mouth height."""
    return -9.0 * x * x


def mouth_edges(x):
    """The open mouth's upper and lower aperture edges (z) at x: a shout,
    the upper lip lifted in a shallow arch over the teeth, the lower lip
    dropped in a squarish curve."""
    u = np.clip(np.abs(x) / MOUTH_HALF, 0, 1)
    upper = MOUTH[2] + .0070 - .0058 * u ** 3.2 - .0004 * gauss(u, 0, .14)
    lower = MOUTH[2] - .0128 + .0122 * u ** 2.3
    return upper, lower


def mouth_aperture(grow=0.0):
    def fn(p):
        x, z = p[:, 0] - MOUTH[0], p[:, 2]
        up, lo = mouth_edges(x)
        d = np.maximum(np.maximum(z - up, lo - z), np.abs(x) - MOUTH_HALF)
        return d - grow
    return fn


def head(sc):
    P = "head"
    # Skull and face masses, smoothly joined: a round cranium, a broad
    # face with high cheekbones, a firm V of a jaw to a defined chin, and
    # a full mouth area.
    sc.add(ellipsoid((0, -.012, 1.188), (.0765, .0920, .0890)), group="skin", part=P)
    sc.add(ellipsoid((0, .026, 1.129), (.0655, .0600, .0670)), k=.034, group="skin", part=P)
    for s in (-1, 1):
        sc.add(round_cone((s * .049, -.014, 1.098), (s * .012, .064, 1.064), .0105, .0110),
               k=.030, group="skin", part=P)
        sc.add(ellipsoid((s * .0500, .046, 1.146), (.0245, .0220, .0160),
                         frame(x_axis=(s, -.40, 0), y_axis=(s * .40, 1, 0))), k=.026,
               group="skin", part=P)
    sc.add(ellipsoid((0, .0670, 1.0660), (.0220, .0170, .0170)), k=.020, group="skin", part=P)
    # The side of the face, jaw ramus to the ear: flat, not hollow.
    for s in (-1, 1):
        sc.add(ellipsoid((s * .0525, -.006, 1.128), (.0195, .0420, .0400)), k=.030, group="skin",
               part=P)
    sc.add(ellipsoid((0, .0685, 1.1000), (.0290, .0210, .0220)), k=.022, group="skin", part=P)
    # Brow ridge: the eyes sit deep under it.
    for s in (-1, 1):
        sc.add(capsule((s * .013, .0745, 1.1835), (s * .049, .0625, 1.1885), .0098), k=.017,
               group="skin", part=P)
    # Eyes: the almond opening cut through the face to the eyeball (a
    # separate control that fills it), its walls the lid margins; a heavy
    # upper lid fold and a soft lower lid.
    for s in (-1, 1):
        R = eye_frame(s)
        ap = almond(s)
        c, Rf = EYE[s].astype(np.float32), R.astype(np.float32)

        def opening(p, ap=ap, c=c, Rf=Rf):
            y = ((p - c) @ Rf)[:, 1]
            return np.maximum(ap(p), -(y + .0035))
        sc.cut(S.Shape(opening, EYE[s] - .03, EYE[s] + .03), k=.0016, group=None)
        fold = [EYE[s] + R @ V(-.0135, .0072, .0068), EYE[s] + R @ V(0, .0098, .0090),
                EYE[s] + R @ V(.0158, .0060, .0072)]
        sc.add(arc_tube(fold, [.0014, .0022, .0012]), k=.0045, group="skin", part=P)
        lower = [EYE[s] + R @ V(-.0110, .0090, -.0060), EYE[s] + R @ V(0, .0105, -.0072),
                 EYE[s] + R @ V(.0130, .0075, -.0052)]
        sc.add(arc_tube(lower, [.0010, .0016, .0009]), k=.0040, group="skin", part=P)
    # Nose: straight bridge, broad rounded tip and full alae.
    sc.add(round_cone((0, .0815, 1.1720), (0, .0945, 1.1405), .0046, .0058), k=.010,
           group="skin", part=P)
    sc.add(ellipsoid((0, .0955, 1.1340), (.0112, .0082, .0084)), k=.0075, group="skin", part=P)
    for s in (-1, 1):
        R = frame(x_axis=(s, -.30, 0), y_axis=(s * .30, 1, 0))
        sc.add(ellipsoid((s * .0135, .0870, 1.1290), (.0078, .0070, .0064), R), k=.0055,
               group="skin", part=P)
        sc.cut(ellipsoid((s * .0076, .0920, 1.1255), (.0031, .0026, .0017)), k=.0012, group="skin")
    # The shout: full lips round an open mouth (the teeth and tongue are
    # the separate `mouth` control), a soft groove under the lower lip.
    xs = np.linspace(-MOUTH_HALF * 1.04, MOUTH_HALF * 1.04, 15)
    up, lo = mouth_edges(xs)
    u = np.abs(xs) / MOUTH_HALF
    upper_lip = [V(x, MOUTH[1] + face_y(x) + .0005, z + .0027 - .0010 * uu)
                 for x, z, uu in zip(xs, up, u)]
    lower_lip = [V(x, MOUTH[1] + face_y(x) + .0008, z - .0036 + .0014 * uu)
                 for x, z, uu in zip(xs, lo, u)]
    sc.add(arc_tube(upper_lip, list(.0011 + .0015 * (1 - u ** 2))), k=.0040, group="lip", part=P)
    sc.add(arc_tube(lower_lip, list(.0014 + .0025 * (1 - u ** 2))), k=.0045, group="lip", part=P)
    sc.cut(capsule((-.010, .0845, 1.0760), (.010, .0845, 1.0760), .0022), k=.005, group="skin")
    ap = mouth_aperture()
    cav = ellipsoid(MOUTH - V(0, .004, .0015), (.0235, .0165, .0160))

    def cavity(p, ap=ap, cav=cav):
        return np.maximum(np.maximum(ap(p), cav(p)), -(p[:, 1] - (MOUTH[1] - .017)))
    sc.cut(S.Shape(cavity, MOUTH - .03, MOUTH + .03), k=.0014, group=None)
    # Ears: flat to the head, a rolled rim round a recessed bowl.
    for s in (-1, 1):
        R = frame(x_axis=(s, .12, 0), z_axis=(0, -.22, 1))
        c = V(s * .0735, -.012, 1.1530)
        sc.add(ellipsoid(c, (.0072, .0160, .0240), R), k=.0055, group="skin", part=P)
        sc.cut(ellipsoid(c + V(s * .0058, .0025, -.0008), (.0034, .0086, .0122), R), k=.0024,
               group="skin")
        sc.add(ellipsoid(c + V(s * .0012, .0040, -.0198), (.0044, .0057, .0061), R), k=.004,
               group="skin", part=P)
    # Neck, with the sternocleidomastoid running to the sternum.
    sc.add(limb([(0, -.022, .955), (0, -.015, 1.030), (0, -.008, 1.105)],
                [(0, .0410, .0400, .0450), (.5, .0380, .0372, .0418), (1, .0375, .0365, .0410)]),
           k=.018, group="skin", part=P)


# ------------------------------------------------------------------ torso

TORSO_Z = [.598, .625, .665, .710, .755, .790, .830, .870, .910, .950, .980, 1.000]
TORSO_W = [.078, .116, .125, .116, .101, .096, .098, .101, .103, .103, .086, .053]
TORSO_F = [.052, .066, .070, .066, .064, .066, .072, .076, .074, .068, .058, .046]
TORSO_B = [.058, .080, .090, .080, .070, .066, .068, .072, .075, .072, .064, .052]
TORSO_PATH = [(0, -.004, .598), (0, .000, .700), (0, .004, .800), (0, -.002, .900),
              (0, -.016, 1.000)]


def torso_rows():
    path = np.array(TORSO_PATH)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.interp(TORSO_Z, path[:, 2], s / s[-1])
    return list(zip(t, TORSO_W, TORSO_F, TORSO_B))


def torso_detail(t, ang):
    z = .598 + t * .402
    front = np.maximum(0, np.cos(ang))
    back = np.maximum(0, -np.cos(ang))
    side = np.abs(np.sin(ang))
    d = np.zeros_like(t)
    # Linen blousing over the sash and soft gathers above it.
    d += .0035 * (0.55 + 0.45 * np.sin(ang * 9 + .6)) * gauss(z, .812, .014)
    d += .0016 * np.sin(ang * 15 + 1.1) * gauss(z, .826, .020)
    # Drape folds falling from the bust and pulling to the waist.
    d += .0020 * np.sin(ang * 7.5 + 1.3 - z * 22) * gauss(z, .845, .028) * front ** 2
    d += .0014 * np.sin(ang * 5 + 2.0 + z * 30) * gauss(z, .90, .05) * side * back
    # The armpit: the rib cage's side falls in under the hanging arm.
    d -= .0085 * gauss(z, .885, .050) * side ** 6
    # Shoulder blades and the spine's groove under the cloth.
    d += .0040 * gauss(z, .910, .040) * gauss(np.abs(ang), 2.50, .30)
    d -= .0022 * gauss(z, .86, .10) * gauss(np.abs(ang), math.pi, .15)
    # The buttoned placket down the front of the shirt.
    band = sstep(-.075, -.050, ang) * (1 - sstep(.050, .075, ang))
    d += .0015 * band * sstep(.795, .812, z) * (1 - sstep(.985, .995, z))
    # Trousers: seat, and a crease at each hip.
    d += .0026 * gauss(z, .630, .030) * back
    d -= .0018 * gauss(z, .605, .010) * front * side
    d += .0012 * np.sin(ang * 6 + 1) * gauss(z, .675, .02) * front
    return d


def torso(sc, part="torso", details=True):
    sc.add(limb(TORSO_PATH, torso_rows(), torso_detail if details else None, samples=64,
                power=2.25), group="shirt", part=part)
    # Seat under the trousers.
    for s in (-1, 1):
        sc.add(ellipsoid((s * .050, -.054, .630), (.060, .040, .056)), k=.030, group="trousers",
               part=part)
    # A modest bust under the loose shirt; the cloth bridges and falls from it.
    for s in (-1, 1):
        R = frame(x_axis=(s, -.22, 0), y_axis=(s * .22, 1, -.10))
        sc.add(ellipsoid((s * .043, .046, .868), (.043, .037, .040), R), k=.026, group="shirt",
               part=part)
    sc.add(ellipsoid((0, .060, .862), (.052, .030, .034)), k=.026, group="shirt", part=part)
    # Shoulder girdle: the trapezius slope from the neck to the acromion,
    # and the collarbones under the yoke.
    for s in (-1, 1):
        sc.add(round_cone((s * .034, -.022, .988), (s * .110, -.016, .966), .027, .025),
               k=.026, group="shirt", part=part)
        sc.add(round_cone((s * .018, .030, .976), (s * .094, .012, .972), .0100, .0110),
               k=.020, group="shirt", part=part)
    # The high band collar, buttoned to the throat (split at the front).
    collar = limb([(0, -.020, .985), (0, -.013, 1.016), (0, -.010, 1.060)],
                  [(0, .0455, .0470, .0480), (.6, .0440, .0455, .0465), (1, .0430, .0445, .0455)],
                  samples=16)
    sc.add(S.intersect(collar, S.half_space((0, 0, 1.045), (0, -.08, 1)), k=.0016), k=.006,
           group="shirt", part=part)


# ------------------------------------------------------------------ arms

def sleeve_detail(s):
    def fn(t, ang):
        d = .0024 * np.sin(ang * 4 + t * 12 + s) * gauss(t, .55, .22)
        d += .0022 * np.sin(ang * 6 + .4 - t * 6) * gauss(t, .85, .08)
        d += .0012 * np.sin(ang * 3 - t * 9) * gauss(t, .30, .12)
        return d
    return fn


def arm(sc, s):
    P = "arm" + ("L" if s < 0 else "R")
    sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
    up = UPPER[s]
    cuff = CUFF[s]
    # The loose linen sleeve from the shoulder seam to the rolled cuff.
    path = [sh + V(-s * .024, -.002, .004), sh + V(s * .008, .001, -.028),
            (sh + cuff) * .5 + V(s * .004, 0, 0), cuff + up * .006]
    sections = [(0, .031, .035, .037), (.20, .038, .039, .041), (.55, .041, .040, .043),
                (.85, .040, .039, .042), (1, .038, .037, .040)]

    def k_arm(p):
        # Blend generously into the shoulder, not at all down the flank.
        return .004 + .026 * sstep(.900, .950, p[:, 2])
    sc.add(limb(path, sections, sleeve_detail(s), side=(s, 0, 0), samples=40),
           k=k_arm, reach=.032, group="shirt", part=P)
    # Deltoid cap under the sleeve.
    sc.add(ellipsoid(sh + V(s * .010, .002, -.018), (.031, .036, .038)), k=k_arm, reach=.03,
           group="shirt", part=P)
    # The rolled cuff: two turns of linen.
    sc.add(ring(cuff + up * .004, up, .0385, .0110, squash=1.15), k=.003, group="shirt", part=P)
    sc.add(ring(cuff - up * .011, up, .0355, .0090, squash=1.1), k=.004, group="shirt", part=P)
    # Forearm: round under the elbow, flattening towards the wrist (wide
    # front to back with the palm turned in); strong, a fighter's.
    fa = FOREARM[s]
    path = [cuff + up * .010, el, el + fa * .070, wr + fa * .004]

    def fdetail(t, ang):
        d = .0042 * gauss(t, .30, .12) * np.maximum(0, np.cos(ang - .6))   # brachioradialis
        d += .0026 * gauss(t, .25, .14) * np.maximum(0, -np.cos(ang + .4))  # flexor mass
        return d
    sc.add(limb(path, [(0, .032, .033, .035), (.20, .0335, .0330, .0360), (.42, .0315, .030, .031),
                       (.75, .0255, .0245, .0235), (1, .0178, .0228, .0218)],
                fdetail, side=(s, 0, 0), samples=36), k=.006, group="skin", part=P)
    sc.add(ellipsoid(el + V(0, -.024, .002), (.011, .009, .012)), k=.010, group="skin", part=P)
    sc.add(ellipsoid(wr + V(s * .004, -.010, .004), (.0070, .0070, .0070)), k=.008, group="skin",
           part=P)


# ------------------------------------------------------------------ hands

def palm(sc, s, d, n, a, wrist, P):
    """The palm block from the wrist to the knuckles, pads on the palm."""
    k_end = wrist + d * .056
    sections = [(0, .0190, .0108, .0092), (.35, .0212, .0124, .0080),
                (.75, .0222, .0114, .0074), (1, .0212, .0094, .0070)]

    def pd(t, ang):
        e = .0042 * gauss(t, .30, .20) * np.maximum(0, np.cos(ang - 1.0)) ** 2   # thenar
        e += .0026 * gauss(t, .40, .25) * np.maximum(0, np.cos(ang + 1.0)) ** 2  # hypothenar
        return e
    sc.add(limb([wrist - d * .012, wrist + d * .022, k_end], sections, pd,
                side=tuple(a), front=tuple(n), samples=24), k=.010, group="skin", part=P)
    return k_end


def finger_k(base, d, near=.006, far=.016, big=.0075, small=.0006):
    base, d = vec(base), vec(d)

    def k(p):
        along = (p - base) @ d
        return small + (big - small) * (1 - sstep(near, far, along))
    return k


def thumb(sc, points, P, radii=(.0108, .0083, .0074, .0058)):
    sc.add(tube(points, list(radii)),
           k=finger_k(points[0], unit(points[1] - points[0]), near=.012, far=.024, big=.010),
           reach=.010, group="skin", part=P)


def left_hand(sc):
    s, P = -1, "armL"
    d, n, a = hand_frame(s)
    wr = WRIST[s]
    knuckles = palm(sc, s, d, n, a, wr, P)
    # Relaxed fingers: a gentle cascade of curl, the index least.
    specs = [(.0122, .0240, .0160, .0130, .0060, 12, 16, 10, -.004),
             (.0005, .0262, .0172, .0138, .0062, 16, 22, 13, 0.0),
             (-.0112, .0248, .0164, .0132, .0058, 21, 28, 17, -.002),
             (-.0212, .0198, .0130, .0114, .0051, 27, 33, 20, -.006)]
    for i, (off, l1, l2, l3, r, c1, c2, c3, drop) in enumerate(specs):
        spread = math.radians((i - 1.2) * -4.0)
        base = knuckles + a * off + d * drop
        dv = unit(d * math.cos(spread) + a * math.sin(spread))
        pts, rad = [base - d * .006], [r * 1.10]
        cur = base
        for L, c, rr in ((l1, c1, r), (l2, c2, r * .90), (l3, c3, r * .80)):
            axis = unit(np.cross(dv, n))
            dv = unit(rot(axis, math.radians(c)) @ dv)
            pts.append(cur)
            rad.append(rr)
            cur = cur + dv * L
        pts.append(cur - dv * .002)
        rad.append(r * .66)
        sc.add(tube(pts[1:], rad[1:]), k=finger_k(knuckles, d), reach=.008, group="skin", part=P)
        sc.add(tube(pts[:2], rad[:2]), k=.006, group="skin", part=P)
        sc.add(ellipsoid(base - n * .0048, (.0052, .0052, .0052)), k=.004, group="skin", part=P)
    cmc = wr + d * .012 + a * .0135 + n * .0052
    t1 = cmc + unit(d * .80 + a * .45 + n * .40) * .028
    t2 = t1 + unit(d * .85 + a * .15 + n * .50) * .020
    t3 = t2 + unit(d * .70 + n * .70) * .016
    thumb(sc, [cmc, t1, t2, t3], P)


def right_hand(sc):
    """A hammer grip round the cutlass: the fingers wrap the grip, the
    thumb closes over the index."""
    s, P = 1, "armR"
    d, n, a = hand_frame(s)
    wr = WRIST[s]
    g = GRIP_DIR
    knuckles = palm(sc, s, d, n, a, wr, P)
    C = FIST
    u = unit(d - g * (d @ g))
    v = np.cross(g, u)
    if v @ n < 0:
        v = -v
    R_wrap = .0172
    stations = [(.0172, .0236, .0154, .0120, .0055), (.0058, .0256, .0164, .0126, .0056),
                (-.0057, .0246, .0158, .0122, .0054), (-.0168, .0198, .0128, .0104, .0048)]
    phi0 = math.atan2(-.0150, .0050)
    for along, l1, l2, l3, r in stations:
        centre = C + g * along
        pts = [knuckles + a * (along * 0.92) - u * .004 - v * .002]
        rad = [r * 1.12]
        phi = phi0
        for L, rr in ((l1, r), (l2, r * .92), (l3, r * .82)):
            dphi = L / R_wrap
            for half in (.5, 1.0):
                ph = phi + dphi * half
                pts.append(centre + (u * math.cos(ph) + v * math.sin(ph)) * R_wrap)
                rad.append(rr)
            phi += dphi
        rad[-1] = r * .70
        sc.add(tube(pts, rad), k=finger_k(knuckles, d, near=.002, far=.010), reach=.008,
               group="skin", part=P)
        kn = centre + (u * math.cos(phi0 + l1 / R_wrap) + v * math.sin(phi0 + l1 / R_wrap)) * \
            (R_wrap + r * .55)
        sc.add(ellipsoid(kn, (.0047, .0047, .0047)), k=.004, group="skin", part=P)
    cmc = wr + d * .010 + a * .0145 + n * .0062
    pts = [cmc,
           cmc + unit(d * .35 + g * .70 + n * .40) * .027,
           C + g * .0212 + (u * math.cos(-2.55) + v * math.sin(-2.55)) * .0190,
           C + g * .0248 + (u * math.cos(2.80) + v * math.sin(2.80)) * .0182]
    thumb(sc, pts, P)


# ------------------------------------------------------------------ legs

def trouser_detail(s):
    def fn(t, ang):
        front = np.maximum(0, np.cos(ang))
        back = np.maximum(0, -np.cos(ang))
        d = .0028 * np.sin(ang * 4 + t * 20 + s) * gauss(t, .30, .12)
        d += .0032 * back * np.sin(t * 95) * gauss(t, .64, .05)       # behind the knee
        d += .0026 * front * np.sin(ang * 3 - t * 30) * gauss(t, .55, .08)
        d += .0048 * (0.6 + 0.4 * np.sin(ang * 7 + s)) * gauss(t, .95, .045)  # bunched over the boot
        return d
    return fn


def leg(sc, s):
    P = "leg" + ("L" if s < 0 else "R")
    h, k = HIP[s], KNEE[s]
    path = [h + V(-s * .010, 0, .045), h + V(s * .003, 0, -.030), (h + k) * .5 + V(s * .002, .004, 0),
            k, V(k[0], k[1] - .004, BOOT_TOP - .006)]
    sections = [(0, .066, .066, .078), (.18, .066, .065, .075), (.42, .060, .060, .064),
                (.64, .053, .053, .055), (.82, .049, .050, .051), (1, .052, .052, .054)]
    sc.add(limb(path, sections, trouser_detail(s), side=(s, 0, 0), samples=40),
           k=lambda p: .004 + .032 * sstep(.550, .640, p[:, 2]), reach=.036, group="trousers",
           part=P)
    sc.add(ellipsoid(k + V(0, .041, .004), (.023, .012, .025)), k=.016, group="trousers", part=P)


def boot(sc, s):
    P = "leg" + ("L" if s < 0 else "R")
    k, a = KNEE[s], ANKLE[s]
    toe_out = math.radians(7) * s
    fwd = V(math.sin(toe_out), math.cos(toe_out), 0)
    top = V(k[0], k[1] - .006, BOOT_TOP)
    path = [top + V(0, 0, .004), V(k[0] + s * .002, k[1] - .010, .250), V(a[0], a[1] - .004, .150),
            V(a[0], a[1], .086)]

    def bdetail(t, ang):
        e = .0058 * gauss(t, .27, .14) * np.maximum(0, -np.cos(ang)) ** 1.5   # calf
        e += .0022 * np.sin(ang * 5 + s) * gauss(t, .82, .07)                 # ankle creases
        e += .0016 * np.sin(ang * 3 + 1 + s) * gauss(t, .55, .10)
        return e
    sc.add(limb(path, [(0, .0615, .0630, .0650), (.07, .0585, .0595, .0625), (.18, .0545, .0540, .0595),
                       (.36, .0510, .0480, .0590), (.68, .0420, .0420, .0450), (1, .0385, .0425, .0445)],
                bdetail, side=(s, 0, 0), samples=36), k=.003, group="boot", part=P)
    # The wide bucket top: a rolled lip and the opening the trousers tuck into.
    tilt = unit(V(0, -.10, 1))
    sc.add(ring(top + V(0, .001, .002), tilt, .0592, .0032), k=.002, group="boot", part=P)
    sc.cut(ring(top + V(0, .001, .006), tilt, .0540, .0044), k=.0015, group="boot")
    # The foot: heel, instep, a rounded toe, flat on the floor.
    heel = V(a[0], a[1], 0) - fwd * .052
    ball = V(a[0], a[1], 0) + fwd * .086
    toe = V(a[0], a[1], 0) + fwd * .143
    foot_path = [heel + V(0, 0, .048), V(a[0], a[1], 0) + fwd * .012 + V(0, 0, .064),
                 ball + V(0, 0, .037), toe + V(0, 0, .026)]
    sc.add(limb(foot_path, [(0, .032, .038, .038), (.35, .038, .044, .038), (.70, .041, .030, .022),
                            (1, .026, .017, .016)], side=(1, 0, 0), front=(0, 0, 1),
                samples=28), k=.016, group="boot", part=P)
    # Sole (a welt a little proud of the upper) and a low stacked heel.
    sole_path = [heel + V(0, 0, .0065) + fwd * .006, V(a[0], a[1], .0065) + fwd * .03,
                 ball + V(0, 0, .0065), toe + V(0, 0, .0065) - fwd * .012]
    sc.add(limb(sole_path, [(0, .033, .0062, .0062), (.35, .038, .0062, .0062),
                            (.72, .044, .0062, .0062), (1, .030, .0062, .0062)],
                side=(1, 0, 0), front=(0, 0, 1), samples=24), k=.003, group="sole", part=P)
    R = frame(x_axis=tuple(V(fwd[1], -fwd[0], 0)), y_axis=tuple(fwd))
    sc.add(S.rounded_box(heel + fwd * .017 + V(0, 0, .017), (.031, .025, .017), .006, R), k=.004,
           group="sole", part=P)


def sculpt():
    sc = S.Sculpt("pirate body")
    torso(sc)
    head(sc)
    for s in (-1, 1):
        arm(sc, s)
    left_hand(sc)
    right_hand(sc)
    for s in (-1, 1):
        leg(sc, s)
        boot(sc, s)
    # Keep a gap between each forearm and the hip it hangs beside (under
    # the waistcoat's skirt), so the skin there never bridges the two.
    for s in (-1, 1):
        el, wr = ELBOW[s], WRIST[s]
        fa = limb([el - FOREARM[s] * .02, el + FOREARM[s] * .07, wr],
                  [(0, .036, .036, .038), (.5, .034, .033, .034), (1, .026, .026, .025)],
                  side=(s, 0, 0), samples=20)

        def gap(p, fa=fa, s=s, el=el, wr=wr):
            f = fa(p)
            z = p[:, 2]
            t = np.clip((el[2] - z) / (el[2] - wr[2]), 0, 1)
            axis_x = el[0] + (wr[0] - el[0]) * t
            zone = (z > .575) & (z < .725) & (s * p[:, 0] < s * axis_x)
            return np.where(zone, np.maximum(f - .006, -f), 1.0)
        sc.cut(S.Shape(gap, np.minimum(el, wr) - .05, np.maximum(el, wr) + .05), k=.0015)
    # Everything stands on the floor.
    sc.clip(S.half_space((0, 0, 0), (0, 0, -1)), k=0.0)
    return sc


def head_only():
    sc = S.Sculpt("pirate head")
    head(sc)
    return sc


def project(sc, origins, dirs, reach=.06, steps=36):
    """Where rays from inside a sculpt (origins, unit dirs) cross its
    surface: vectorised bisection on [0, reach]."""
    origins = np.asarray(origins, float)
    dirs = np.asarray(dirs, float)
    lo = np.zeros(len(origins))
    hi = np.full(len(origins), reach)
    for _ in range(steps):
        mid = (lo + hi) / 2
        inside = sc.at(origins + dirs * mid[:, None]) < 0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    return origins + dirs * ((lo + hi) / 2)[:, None]


def gradient(sc, p, e=.0006):
    p = np.asarray(p, float)
    g = np.zeros_like(p)
    for j in range(3):
        d = np.zeros(3)
        d[j] = e
        g[:, j] = sc.at(p + d) - sc.at(p - d)
    return g / np.maximum(np.linalg.norm(g, axis=1), 1e-9)[:, None]


def torso_only():
    """The torso's own surface (no arms, head or legs), for garments built
    on it: the waistcoat and the sash."""
    sc = S.Sculpt("pirate torso")
    torso(sc, details=False)
    return sc


GROUPS = ["skin", "lip", "shirt", "trousers", "boot", "sole"]
PARTS = ["head", "torso", "armL", "armR", "legL", "legR"]


REGIONS = {
    "all": ((-.27, -.13, -.002), (.27, .23, 1.30)),
    "head": ((-.095, -.125, 1.0), (.095, .125, 1.30)),
    "hands": ((-.25, -.07, .40), (.25, .14, .66)),
    "feet": ((-.17, -.10, -.002), (.17, .20, .38)),
}


def build_arrays(h=.0016, log=print, region="all"):
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
    h = float(sys.argv[2]) if len(sys.argv) > 2 else .0016

    def log(m):
        print(f"[{time.time() - t0:6.1f}s] {m}", flush=True)
    arrays = build_arrays(h, log)
    np.savez_compressed(out, **arrays)
    log(f"saved {out}: {len(arrays['points'])} vertices, {len(arrays['quads'])} quads")
