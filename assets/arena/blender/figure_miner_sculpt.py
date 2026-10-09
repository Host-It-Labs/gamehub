"""The Miner's detailed editable anatomy (8-9 October 2026).

A stocky Latino miner of the early 1900s (card portrait
assets/arena/cards/card-miner-v7-b.png): broad sloping shoulders over a
barrel chest and a round belly, a thick short neck, heavy forearms and big
hands, short sturdy legs; a broad square face with high cheekbones, a big
round nose, heavy brows set in a frown and a bushy black moustache. He
wears a dusty cobalt work shirt with its sleeves rolled above the elbows
and denim dungarees over leather boots (figure_miner_dress.py), a hard hat
with a brass lamp and carries a pickaxe (figure_miner_props.py).

Blender +Y forward, Z up, authored at the figure's final size (the hat's
top about 1.31, the shipped toy's 1.30). The body is one connected surface
sculpted as signed-distance clay (figure_miner_sdf.py): authored masses
joined by smooth blends in three regions (body, head, fists) that are welded
into one skin. The shirt and the dungarees are that surface's outer layer
(painted per face, their edges covered by sewn shells in the dress module).

Rest pose: a relaxed stance, weight on both feet, upper arms hanging at the
flanks, elbows bent a little, fists by the thighs, palms in.

MINER_FAST=1 sculpts at a coarser voxel for quick form reviews.
"""

import math
import os

import bpy
import numpy as np
from mathutils import Vector

import kit
import figure_folk_kit as fk
import figure_miner_clay as mc
import figure_miner_sdf as sd
from figure_miner_clay import V, g, table

R = "miner"
TAU = math.tau
CLAY = "resin:miner-clay"
FAST = os.environ.get("MINER_FAST") == "1"


def vox(h):
    return h * (1.6 if FAST else 1.0)


# ------------------------------------------------------------- joints

ANKLE = {s: V(s * 0.104, -0.004, 0.090) for s in (-1, 1)}
KNEE = {s: V(s * 0.098, 0.014, 0.298) for s in (-1, 1)}
HIP = {s: V(s * 0.090, 0.000, 0.512) for s in (-1, 1)}
WAIST = V(0, -0.006, 0.610)
CHEST = V(0, -0.016, 0.800)
NECK = V(0, -0.012, 0.992)
CLAV = {s: V(s * 0.030, 0.035, 0.945) for s in (-1, 1)}
SHOULDER = {s: V(s * 0.206, -0.012, 0.918) for s in (-1, 1)}
ELBOW = {s: V(s * 0.252, -0.034, 0.705) for s in (-1, 1)}
WRIST = {s: V(s * 0.278, 0.012, 0.522) for s in (-1, 1)}
HAT = V(0, -0.010, 1.180)


def hand_frame(s):
    """The fist's frame at the wrist: e1 along the hand (the forearm's line),
    e2 the thumb's side (the haft's axis, towards the pick's head), e3 the
    palm's normal (towards the thigh at rest). (e1, e3, e2) is right-handed
    for the right fist; the left fist is its mirror image."""
    e1 = (WRIST[s] - ELBOW[s]).normalized()
    n0 = V(-s, 0.0, 0.0)
    e3 = (n0 - e1 * n0.dot(e1)).normalized()
    e2 = e1.cross(e3).normalized()
    if e2.y < 0:
        e2 = -e2
    return e1, e2, e3


# The haft's centre in the fist frame and its radius. The pick's haft runs
# through this point along e2 (figure_miner_props.py; moves/miner.ts holds
# the same numbers to put the left fist on the haft).
GRIP_E1, GRIP_E3 = 0.060, 0.030
HAFT_R = 0.0160


def grip_centre(s):
    e1, e2, e3 = hand_frame(s)
    return WRIST[s] + e1 * GRIP_E1 + e3 * GRIP_E3


# ------------------------------------------------------------- trunk

# (z, half width, front, back) of the clothed trunk's base volume.
BODY = [(0.440, 0.118, 0.088, 0.098),
        (0.480, 0.150, 0.104, 0.116),
        (0.540, 0.164, 0.116, 0.124),
        (0.600, 0.166, 0.128, 0.114),
        (0.660, 0.168, 0.138, 0.104),
        (0.720, 0.172, 0.136, 0.102),
        (0.780, 0.172, 0.126, 0.106),
        (0.840, 0.176, 0.118, 0.110),
        (0.890, 0.172, 0.110, 0.106),
        (0.925, 0.150, 0.094, 0.098),
        (0.955, 0.108, 0.074, 0.082),
        (0.985, 0.074, 0.062, 0.068),
        (1.020, 0.066, 0.058, 0.062)]


def body_point(a, z, grow=0.0):
    w, f, b = table(BODY, z)
    s, c = math.sin(a), math.cos(a)
    p = 2.3 + 0.35 * mc.ssf(0.76, 0.90, z)
    return V(fk.spow(s, 2 / p) * (w + grow), fk.spow(c, 2 / p) * ((f if c >= 0 else b) + grow), z)


def trunk_mesh():
    zs = np.linspace(BODY[0][0], BODY[-1][0], 110)
    rings = [[body_point(i / 96 * TAU, z) for i in range(96)] for z in zs]
    return fk.loft("miner.trunk", rings, CLAY, start="pole", end="pole", recalc=True)


# (t along shoulder-elbow-wrist, width across, front, back). The upper arm
# wears the shirt's sleeve; the sleeve is rolled up just above the elbow
# (CUFF_T); the forearm is bare, heavy below the elbow, slim at the wrist.
ARM_SECTIONS = [(0.00, 0.054, 0.054, 0.058), (0.10, 0.062, 0.061, 0.065),
                (0.22, 0.061, 0.060, 0.063), (0.34, 0.058, 0.058, 0.059),
                (0.43, 0.057, 0.055, 0.057), (0.47, 0.050, 0.047, 0.050),
                (0.52, 0.047, 0.045, 0.049), (0.60, 0.053, 0.051, 0.048),
                (0.70, 0.049, 0.046, 0.042), (0.84, 0.039, 0.033, 0.032),
                (0.96, 0.034, 0.025, 0.025), (1.00, 0.033, 0.024, 0.024)]
CUFF_T = 0.455
ARM_GAP = 0.0075


def arm_points(s):
    sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
    return [sh + V(-s * 0.018, 0.0, -0.010), sh + V(s * 0.008, 0.0, -0.034),
            sh + (el - sh) * 0.5, el, el + (wr - el) * 0.5, wr + (wr - el).normalized() * 0.016]


def arm_mesh(s):
    def detail(t, a):
        front, back = max(0, math.cos(a)), max(0, -math.cos(a))
        out = max(0, s * math.sin(a))
        # Elbow point behind, the crook in front; biceps under the sleeve.
        return (-0.003 * g(t, 0.50, 0.022) * front ** 6
                + 0.005 * g(t, 0.50, 0.025) * back ** 6
                + 0.004 * g(t, 0.25, 0.10) * front ** 3
                + 0.003 * g(t, 0.62, 0.06) * out ** 2)
    return mc.limb(f"miner.arm{s}", arm_points(s), ARM_SECTIONS, CLAY, u_hint=(1, 0, 0),
                   detail=detail, rows=120, around=56)


LEG_SECTIONS = [(0.00, 0.090, 0.094, 0.100), (0.14, 0.094, 0.096, 0.102),
                (0.32, 0.088, 0.088, 0.090), (0.50, 0.078, 0.080, 0.076),
                (0.60, 0.076, 0.078, 0.076), (0.74, 0.074, 0.074, 0.078),
                (0.88, 0.072, 0.072, 0.072), (1.00, 0.071, 0.071, 0.071)]


def leg_points(s):
    h, k, a = HIP[s], KNEE[s], ANKLE[s]
    return [h + V(-s * 0.010, -0.004, 0.060), h, (h + k) * 0.5, k, (k + a) * 0.5,
            V(a.x, a.y + 0.004, 0.150)]


def leg_mesh(s):
    def detail(t, a):
        front, back = max(0, math.cos(a)), max(0, -math.cos(a))
        out = max(0, s * math.sin(a))
        # The denim hangs off the thigh's front and the calf's back.
        return (0.004 * g(t, 0.22, 0.10) * front ** 2 + 0.004 * g(t, 0.70, 0.08) * back ** 3
                + 0.003 * g(t, 0.30, 0.12) * out ** 2)
    return mc.limb(f"miner.leg{s}", leg_points(s), LEG_SECTIONS, CLAY, u_hint=(1, 0, 0),
                   detail=detail, rows=100, around=56)


def neck_forms():
    # A thick bull neck rising behind the jaw, so the chin overhangs it.
    return [sd.Chain([V(0, -0.024, 0.950), V(0, -0.022, 1.010), V(0, -0.020, 1.055), V(0, -0.018, 1.098)],
                     [0.068, 0.062, 0.056, 0.054])]


def k_above(z0, z1, k_hi, k_lo):
    """Blend radius from k_lo below z0 to k_hi above z1."""
    def fn(X, Y, Z):
        return k_lo + (k_hi - k_lo) * mc.ss(z0, z1, Z)
    return sd.kfield(fn, max(k_hi, k_lo))


def fold(points, r, n=10):
    """A cloth crease: a thin smooth chain to carve."""
    return sd.Chain(mc.smooth_points(points, n), r)


def body_sculpt(arms=True):
    """The clothed body. arms=False sculpts the trunk, neck and legs alone
    (the armpit recess included), which the rig uses to tell the flank's
    skin from the arm's."""
    s = sd.Sculpt((-0.33, -0.18, 0.130), (0.33, 0.22, 1.080), vox(0.0018))
    E, C = sd.Ellipsoid, sd.Chain
    s.add(s.mesh_form(trunk_mesh()))
    # Barrel chest, the round belly pushing the bib out, the seat.
    s.add(E(V(0, -0.004, 0.842), (0.176, 0.118, 0.112)), 0.04)
    s.add(E(V(0, 0.046, 0.680), (0.152, 0.110, 0.118)), 0.05)
    s.add(E(V(0, 0.088, 0.690), (0.112, 0.074, 0.086)), 0.04)
    for side in (-1, 1):
        # Pectoral masses under the shirt; shoulder blades behind.
        s.add(E(V(side * 0.074, 0.078, 0.862), (0.074, 0.044, 0.054)), 0.035)
        s.add(E(V(side * 0.090, -0.082, 0.866), (0.070, 0.036, 0.080)), 0.035)
        # Trapezius: the sloping mass from the neck to the shoulder's point,
        # high and thick on a man who swings a pick.
        s.add(C([V(side * 0.030, -0.030, 1.010), V(side * 0.100, -0.030, 0.972),
                 V(side * 0.172, -0.020, 0.936)], [0.046, 0.040, 0.034]), 0.05)
        # The buttocks under the seat of the dungarees.
        s.add(E(V(side * 0.066, -0.070, 0.540), (0.074, 0.040, 0.068)), 0.04)
    for f in neck_forms():
        s.add(f, 0.04)
    # Legs: a broad blend into the hips and seat, none along the inseam.
    for side in (-1, 1):
        s.add(s.mesh_form(leg_mesh(side)), k_above(0.42, 0.53, 0.032, 0.004))
    for side in (-1, 1):
        sh = SHOULDER[side]
        ax = (ELBOW[side] - sh).normalized()
        # The deltoid caps the shoulder and flows into chest and back.
        if arms:
            s.add(E(sh + V(side * 0.018, 0.002, -0.040), (0.060, 0.064, 0.078),
                    axes=(V(1, 0, 0), V(0, 1, 0), ax)), 0.045)
        arm = s.mesh_form(arm_mesh(side))
        # Below the armpit the hanging arm only rests against the flank: a
        # recess its shape keeps a few millimetres between them, so the
        # skin never webs arm to flank when the arm rises.
        s.carve(sd.Intersect(sd.Offset(arm, ARM_GAP),
                             sd.Plane(V(0, 0, 0.850), (0, 0, 1), [-1, -1, -1], [1, 1, 1]), 0.025), 0.004)
        if not arms:
            continue
        s.add(arm, k_above(0.85, 0.91, 0.028, 0.0))
        # Forearm masses (bare): brachioradialis and extensors on the outer
        # side, flexors on the inner, tapering into the wrist.
        el, wr = ELBOW[side], WRIST[side]
        fa = (wr - el).normalized()
        out = V(side, 0, 0)
        s.add(E(el + fa * 0.058 + out * 0.010 + V(0, 0.016, 0), (0.038, 0.036, 0.066),
                axes=(V(1, 0, 0), V(0, 1, 0), fa)), 0.012)
        s.add(E(el + fa * 0.060 - out * 0.012 - V(0, 0.008, 0), (0.034, 0.034, 0.062),
                axes=(V(1, 0, 0), V(0, 1, 0), fa)), 0.012)
    # ---- cloth: creases that make the shirt and the denim read as cloth.
    # Short, uneven and diagonal, where the cloth is pulled or bunched,
    # never whole rings.
    for side in (-1, 1):
        sh, el = SHOULDER[side], ELBOW[side]
        pts = arm_points(side)

        def on_arm(t, a, lift=0.0):
            c = mc.path_at(pts, t)
            ax = (mc.path_at(pts, t + 0.01) - mc.path_at(pts, t - 0.01)).normalized()
            u = (V(1, 0, 0) - ax * ax.x).normalized()
            v = ax.cross(u)
            w, f, b = table(ARM_SECTIONS, t)
            r = (f if math.cos(a) >= 0 else b) + lift
            return c + (u * math.sin(a) * side + v * math.cos(a)) * r
        # The sleeve bunched above the rolled cuff, in the elbow's crook.
        for t0, t1, a0, a1, r in ((0.40, 0.43, -0.9, 0.5, 0.0026), (0.36, 0.41, -0.4, 0.9, 0.0022),
                                  (0.42, 0.44, 0.6, 1.5, 0.0020)):
            s.carve(fold([on_arm(t0 + (t1 - t0) * k, a0 + (a1 - a0) * k) for k in (0, 0.5, 1)], r), 0.007)
        # Pulls from the armpit across the sleeve's top.
        for t0, t1, a0, a1, r in ((0.10, 0.22, -1.7, -0.9, 0.0022), (0.16, 0.30, -2.4, -1.6, 0.0020)):
            s.carve(fold([on_arm(t0 + (t1 - t0) * k, a0 + (a1 - a0) * k) for k in (0, 0.5, 1)], r), 0.007)
        # The sleeve's set-in seam round the shoulder.
        seam = [sh + V(side * (0.048 * math.cos(a) + 0.004), 0.062 * math.sin(a), 0.040 * math.cos(a) - 0.006)
                for a in np.linspace(-1.9, 1.9, 13)]
        s.carve(fold(seam, 0.0011, 30), 0.0015)
        # Shirt bunching over the dungarees' side seams.
        s.carve(fold([V(side * 0.168, 0.060, 0.702), V(side * 0.184, 0.0, 0.690),
                      V(side * 0.172, -0.050, 0.700)], 0.0030), 0.009)
        s.carve(fold([V(side * 0.176, 0.030, 0.726), V(side * 0.186, -0.020, 0.718)], 0.0024), 0.008)
        # Trousers: the back of the knee, the break above the boots, the
        # pull from the crotch round the thigh.
        k, a = KNEE[side], ANKLE[side]
        s.carve(fold([k + V(-side * 0.055, -0.064, 0.010), k + V(0.0, -0.082, -0.004),
                      k + V(side * 0.048, -0.066, -0.020)], 0.0032), 0.010)
        s.carve(fold([k + V(-side * 0.040, -0.074, 0.034), k + V(side * 0.030, -0.078, 0.026)], 0.0024), 0.008)
        s.carve(fold([V(a.x - side * 0.060, a.y + 0.044, 0.212), V(a.x, a.y + 0.074, 0.200),
                      V(a.x + side * 0.058, a.y + 0.040, 0.206)], 0.0030), 0.010)
        s.carve(fold([V(a.x - side * 0.040, a.y + 0.064, 0.238), V(a.x + side * 0.030, a.y + 0.068, 0.232)],
                     0.0022), 0.008)
        s.carve(fold([V(side * 0.030, 0.050, 0.470), V(side * 0.080, 0.090, 0.420),
                      V(side * 0.130, 0.070, 0.380)], 0.0026), 0.010)
    return s.build("miner.region-body" if arms else "miner.region-trunk", CLAY)


# ------------------------------------------------------------- head

def head_sculpt():
    s = sd.Sculpt((-0.120, -0.130, 0.975), (0.120, 0.165, 1.275), vox(0.0008))
    E, C, B = sd.Ellipsoid, sd.Chain, sd.Box
    for f in neck_forms():
        s.add(f)
    # Cranium and occiput (under the hat and the hair).
    s.add(E(V(0, -0.014, 1.158), (0.084, 0.096, 0.098)), 0.02)
    s.add(E(V(0, -0.044, 1.136), (0.076, 0.070, 0.078)), 0.02)
    # The face: a broad block with flat planes, the forehead's front plane
    # meeting the temples at a soft corner.
    s.add(B(V(0, 0.030, 1.124), (0.066, 0.056, 0.060), 0.040), 0.035)
    s.add(B(V(0, 0.044, 1.170), (0.066, 0.042, 0.026), 0.024), 0.03)
    # A strong square jaw inside the skull's width: a broad lower-face
    # block with its angles set out below the ears.
    s.add(E(V(0, 0.034, 1.054), (0.062, 0.052, 0.032)), 0.030)
    for side in (-1, 1):
        s.add(E(V(side * 0.056, 0.000, 1.060), (0.014, 0.022, 0.022)), 0.022)
    # The chin's own boss, forward of the lower lip.
    s.add(B(V(0, 0.086, 1.030), (0.026, 0.015, 0.014), 0.012), 0.014)
    # High cheekbones, full cheeks above the moustache, a little jowl.
    for side in (-1, 1):
        s.add(E(V(side * 0.056, 0.062, 1.118), (0.025, 0.020, 0.015)), 0.02)
        s.add(E(V(side * 0.046, 0.070, 1.094), (0.024, 0.021, 0.022)), 0.022)
    # The muzzle over the teeth, which carries the moustache.
    s.add(E(V(0, 0.086, 1.074), (0.040, 0.030, 0.026)), 0.02)
    # Temples turn the forehead to the sides.
    for side in (-1, 1):
        s.carve(E(V(side * 0.108, 0.040, 1.166), (0.030, 0.042, 0.046)), 0.03)
    # The brow ridge: low and heavy, a furrow between the brows.
    ridge = mc.smooth_points([V(-0.070, 0.054, 1.150), V(-0.040, 0.090, 1.156), V(-0.012, 0.097, 1.150),
                              V(0.012, 0.097, 1.150), V(0.040, 0.090, 1.156), V(0.070, 0.054, 1.150)], 20)
    s.add(C(ridge, [0.011 + 0.002 * math.sin(math.pi * i / 19) for i in range(20)]), 0.012)
    # Eye sockets under the ridge, and the bags beneath them.
    for side in (-1, 1):
        s.carve(E(V(side * 0.034, 0.101, 1.133), (0.020, 0.017, 0.012)), 0.008)
        s.add(E(V(side * 0.034, 0.090, 1.118), (0.016, 0.009, 0.005)), 0.006)
    # The nose: a strong bridge, a big round tip, flared wings, nostrils.
    s.add(C([V(0, 0.094, 1.146), V(0, 0.106, 1.126), V(0, 0.118, 1.108)], [0.0090, 0.0120, 0.0150]), 0.010)
    s.add(E(V(0, 0.124, 1.098), (0.0225, 0.0205, 0.0200)), 0.007)
    for side in (-1, 1):
        s.add(E(V(side * 0.0205, 0.108, 1.090), (0.0130, 0.0130, 0.0112)), 0.006)
        s.carve(E(V(side * 0.0108, 0.1140, 1.0815), (0.0050, 0.0060, 0.0030)), 0.002)
        # The fold from the nose's wing past the mouth's corner.
        s.carve(C([V(side * 0.031, 0.106, 1.092), V(side * 0.044, 0.093, 1.064),
                   V(side * 0.046, 0.088, 1.046)], [0.0018, 0.0014, 0.0010]), 0.008)
    # Mouth: the lower lip pushed up in effort below the moustache, the
    # slit, and the groove over the chin.
    s.add(E(V(0, 0.097, 1.0535), (0.020, 0.009, 0.0062)), 0.007)
    s.carve(C(mc.smooth_points([V(-0.028, 0.094, 1.0605), V(0, 0.104, 1.0620), V(0.028, 0.094, 1.0605)], 9),
              0.0022), 0.003)
    s.carve(C([V(-0.016, 0.100, 1.0445), V(0.016, 0.100, 1.0445)], 0.0024), 0.005)
    # Ears: shell, rim and bowl, set back level with the nose.
    for side in (-1, 1):
        c = V(side * 0.082, -0.014, 1.118)
        ax = (V(side * 0.35, 0.94, 0).normalized(), V(0, 0, 1))
        s.add(E(c, (0.010, 0.021, 0.029), axes=(V(1, 0, 0), ax[0], ax[1])), 0.008)
        s.add(C(mc.smooth_points([c + V(side * 0.007, 0.012, -0.024), c + V(side * 0.010, -0.012, -0.014),
                                  c + V(side * 0.011, -0.019, 0.008), c + V(side * 0.009, -0.006, 0.027),
                                  c + V(side * 0.006, 0.011, 0.021)], 16), 0.0058), 0.004)
        s.carve(E(c + V(side * 0.013, 0.002, -0.002), (0.0055, 0.0105, 0.0145)), 0.004)
    return s.build("miner.region-head", CLAY)


# ------------------------------------------------------------- fists

FINGERS = [  # (offset along the haft, radius, sweep start, sweep end)
    (0.029, 0.0112, -0.70, 3.50),
    (0.008, 0.0118, -0.70, 3.65),
    (-0.013, 0.0114, -0.68, 3.60),
    (-0.031, 0.0100, -0.62, 3.45)]


def finger_path(s, i):
    e1, e2, e3 = hand_frame(s)
    W, Cc = WRIST[s], grip_centre(s)
    x, rf, a0, a1 = FINGERS[i]
    rr = HAFT_R + rf * 0.92
    pts = [W + e1 * 0.062 + e2 * x - e3 * 0.004]
    for k in range(9):
        t = k / 8
        a = a0 + (a1 - a0) * t
        rad = rr + 0.010 * (1 - t) ** 4
        pts.append(Cc + e2 * x + (e1 * math.cos(a) + e3 * math.sin(a)) * rad)
    return pts, rf


def hand_sculpt(s):
    e1, e2, e3 = hand_frame(s)
    W, Cc = WRIST[s], grip_centre(s)
    lo = np.array(list(W)) - 0.090
    hi = np.array(list(W)) + 0.110
    sc = sd.Sculpt(lo, hi, vox(0.0008))
    # The forearm's end, shared with the body region so the two surfaces
    # coincide where they overlap.
    sc.add(sc.mesh_form(arm_mesh(s)))
    E, Ch = sd.Ellipsoid, sd.Chain
    frame = (e2, e3, e1)
    # A big working hand: the palm from wrist to knuckles, the thenar mound
    # under the thumb, the heel of the hand, the back's tendons.
    sc.add(sd.Box(W + e1 * 0.042, (0.045, 0.019, 0.040), 0.015, axes=frame), 0.010)
    sc.add(E(W + e1 * 0.026 + e2 * 0.026 + e3 * 0.011, (0.021, 0.017, 0.027), axes=frame), 0.008)
    sc.add(E(W + e1 * 0.032 - e2 * 0.028 + e3 * 0.009, (0.017, 0.014, 0.027), axes=frame), 0.008)
    sc.add(E(W + e1 * 0.008, (0.035, 0.023, 0.017), axes=frame), 0.012)
    for i in range(4):
        pts, rf = finger_path(s, i)
        n = len(pts)
        radii = [rf * (1.12 if j < 2 else 1.0 - 0.16 * (j / (n - 1)) ** 2) for j in range(n)]
        sc.add(Ch(pts, radii), 0.004 if i else 0.005)
        # The knuckle, raised on the back of the fist.
        sc.add(E(pts[0] + e1 * 0.006 - e3 * 0.003, (rf * 1.08, rf * 0.95, rf * 1.02), axes=frame), 0.005)
        # The crease between the first and second joints.
        mid = pts[4]
        sc.carve(E(mid + (mid - Cc - e2 * FINGERS[i][0]).normalized() * rf * 0.95,
                   (rf * 1.1, rf * 0.25, rf * 0.25), axes=frame), 0.002)
    # Thumb: from the thenar round the haft, over the index and middle.
    tp = [W + e1 * 0.016 + e2 * 0.036 + e3 * 0.004,
          W + e1 * 0.033 + e2 * 0.044 + e3 * 0.021,
          Cc + e2 * 0.032 + e3 * (HAFT_R + 0.021),
          Cc + e2 * 0.014 + e1 * 0.012 + e3 * (HAFT_R + 0.025),
          Cc - e2 * 0.002 + e1 * 0.021 + e3 * (HAFT_R + 0.021)]
    sc.add(Ch(tp, [0.0145, 0.0150, 0.0134, 0.0120, 0.0104]), 0.007)
    # The channel through the fist stays filled: from outside, a haft
    # passing through looks the same, and an empty fist reads as a fist
    # rather than a ring.
    sc.add(Ch([Cc - e2 * 0.036, Cc + e2 * 0.026], HAFT_R * 0.95), 0.006)
    return sc.build(f"miner.region-hand{s}", CLAY)


# ------------------------------------------------------------- assembly

def skin_clay():
    regions = [body_sculpt(), head_sculpt(), hand_sculpt(-1), hand_sculpt(1)]
    return sd.union_meshes(regions, "miner.skin", vox(0.0013), CLAY)


def build_clay():
    root = kit.empty(R)
    body = skin_clay()
    body.parent = root
    return root
