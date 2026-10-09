"""The Miner's costume and features around the sculpted skin.

Boots and hair pieces are small SDF sculpts of their own; garment edges
(collar, rolled cuffs, bib, pocket, straps and buckles, waistband,
turn-ups, back panel and pocket) are shells snapped onto the skin, so
they move with it once skinned. Face controls follow the contract in
figure_sumo_sculpt.attach_faces: separate eyes, pupils, brows and mouth.
"""

import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as fk
import figure_miner_clay as mc
import figure_miner_sdf as sd
import figure_miner_sculpt as ms
from figure_miner_clay import V, g

T = kit.tint
SKIN = "skin:" + T("miner-skin", "#b67552")
HAIR = "hair:" + T("miner-hair", "#1b1613")
SHIRT = "weave:team"
DENIM = "weave:" + T("miner-denim", "#3e4c6b")
STITCH = "weave:" + T("miner-stitch", "#c98b44")
BRASS = "gilt:" + T("miner-brass", "#cfa04a")
BOOT = "hide:" + T("miner-boot", "#6c4127")
# The soles share the boots' leather (painted dark below 2.8 cm in
# figure_miner_paint), and laces and shirt buttons the tan stitching, so the
# skinned mesh draws in fewer material groups.
SOLE = BOOT
LACE = STITCH
EYE = "resin:" + T("miner-eye", "#ece5d6")
IRIS = "resin:" + T("miner-iris", "#3a2417")
MOUTH = "resin:" + T("miner-mouth", "#40201b")
TEETH = "resin:" + T("miner-teeth", "#efe6d0")
BUTTON = STITCH


# ------------------------------------------------------------- skin regions

CUFF_T = ms.CUFF_T  # where the rolled sleeves end on the upper arm
WAIST_Z = 0.662  # the dungarees' waist seam (under the waistband strip)


# The garments' edges are planes, so the runtime reduction can cut the skin
# exactly along them (figure_miner_runtime.crisp_regions) and the paint
# never follows a coarse triangle's edge.
COLLAR_POINT = Vector((0, 0, 0.9696))
COLLAR_NORMAL = Vector((0, 0.16, 1)).normalized()
NECK_R = 0.077


def collar_z(x, y):
    """The shirt's neckline (a plane: low in front, high at the nape),
    under the collar band's centre."""
    return 0.9696 - 0.16 * y


def cuff_plane(s):
    """Where the rolled sleeve ends: a plane across the upper arm."""
    pts = ms.arm_points(s)
    c = mc.path_at(pts, CUFF_T)
    ax = (mc.path_at(pts, CUFF_T + 0.01) - mc.path_at(pts, CUFF_T - 0.01)).normalized()
    return c, ax


def neck_f(x, y, z):
    """The neckline as an implicit function (negative inside): a cylinder
    round the base of the neck, a little wider at the throat, above the
    chest. Its zero line on the skin is the shirt's edge, and the collar band
    is laid along it."""
    a = math.atan2(x, y + 0.016)
    # Wider at the sides, where the neck runs up under the jaw.
    r = NECK_R + 0.012 * max(0.0, math.cos(a)) ** 2 + 0.011 * math.sin(a) ** 2
    return max(math.hypot(x, y + 0.016) - r, 0.905 - z)


# The neckline loop on the master's skin (neckline()), set by the rig before
# painting and kept on the root ("neckline") for the runtime's repaint.
NECKLINE = None
NECKLINE_POINTS = []


def above_neckline(p):
    """Higher than the neckline at this angle round the neck (the jaw, ears
    and head, which lie outside its cylinder but are never shirt)."""
    if NECKLINE is None:
        return p.z > 1.035
    a = math.degrees(math.atan2(p.x, p.y + 0.016)) % 360
    angs, zs = NECKLINE
    return p.z > float(np.interp(a, angs, zs, period=360)) + 0.006


def set_neckline(points):
    global NECKLINE
    pts = np.array([list(q) for q in points])
    angs = np.degrees(np.arctan2(pts[:, 0], pts[:, 1] + 0.016)) % 360
    order = np.argsort(angs)
    NECKLINE = (angs[order], pts[order, 2])
    NECKLINE_POINTS[:] = [list(map(float, q)) for q in pts]
    return NECKLINE_POINTS


def region_of(p, arm_l, arm_r, head):
    """0 skin, 1 shirt, 2 denim for a point with its arm and head shares."""
    side = 1 if p.x > 0 else -1
    if (arm_r if side > 0 else arm_l) > 0.5:
        c, ax = cuff_plane(side)
        return 0 if (p - c).dot(ax) > 0 else 1
    # One boundary only (the neckline, which the runtime cuts along): inside
    # it the neck, above the trunk the head; the head's own share covers the
    # chin, which overhangs the throat.
    if head > 0.5 or neck_f(p.x, p.y, p.z) < 0 or p.z > 1.06:
        return 0
    return 1 if p.z > WAIST_Z else 2


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


def paint_regions(o, weights, names):
    """Skin, shirt or denim per face, from the bones that own it: hands,
    forearms and the arm below the rolled cuff are skin, the rest of the
    arm shirt; the trunk is shirt above the dungarees' waist and skin above
    the collar; legs are denim."""
    mats = [SKIN, SHIRT, DENIM]
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
    # Per-face mean weights (faces are tris and quads).
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


# ------------------------------------------------------------- boots

def boot(s):
    a = ms.ANKLE[s]
    yaw = s * math.radians(7)
    fwd = V(math.sin(yaw), math.cos(yaw), 0)
    side = V(fwd.y, -fwd.x, 0)
    base = V(a.x, a.y, 0)

    def at(x, y, z):
        return base + side * x + fwd * y + V(0, 0, z)
    sc = sd.Sculpt(np.array(list(base)) + [-0.075, -0.09, 0.0], np.array(list(base)) + [0.075, 0.17, 0.20], 0.0008)
    E, C = sd.Ellipsoid, sd.Chain
    ax = (side, fwd, V(0, 0, 1))
    # Heel counter, instep, the round toe cap of a work boot.
    sc.add(E(at(0, -0.040, 0.050), (0.046, 0.044, 0.034), axes=ax))
    sc.add(E(at(0, 0.030, 0.050), (0.050, 0.062, 0.036), axes=ax), 0.02)
    sc.add(E(at(0, 0.100, 0.044), (0.050, 0.050, 0.034), axes=ax), 0.02)
    sc.add(E(at(0, 0.112, 0.046), (0.046, 0.040, 0.032), axes=ax), 0.008)
    # Shaft up the ankle, flaring to a padded collar.
    sc.add(C([at(0, -0.012, 0.055), at(0, -0.006, 0.120), at(0, -0.004, 0.168)], [0.048, 0.050, 0.054]), 0.02)
    sc.add(C([at(0, -0.004, 0.170) + side * 0.0, at(0, -0.004, 0.170)], [0.058, 0.058]), 0.006)
    # Tongue and the lacing seam.
    sc.add(C([at(0, 0.034, 0.090), at(0, 0.026, 0.135), at(0, 0.034, 0.178)], [0.017, 0.016, 0.014]), 0.01)
    # Flatten the bottom onto the sole's top.
    sc.clip(sd.Plane(at(0, 0, 0.024), (0, 0, -1), [-1, -1, -1], [1, 1, 1]), 0.004)
    # Toe-cap seam and the welt line.
    sc.carve(C(mc.smooth_points([at(-0.042, 0.090, 0.040), at(-0.030, 0.082, 0.070), at(0, 0.078, 0.080),
                                 at(0.030, 0.082, 0.070), at(0.042, 0.090, 0.040)], 18), 0.0016), 0.002)
    upper = sc.build(f"miner.boot{s}", BOOT)
    parts = [upper]
    # Sole: a thick dark outline with a heel block and a welt lip.
    outline = []
    for i in range(48):
        u = i / 48 * math.tau
        y = 0.045 + 0.112 * math.cos(u)
        w = 0.046 + 0.010 * g(y, 0.095, 0.06) - 0.006 * g(y, 0.0, 0.03)
        outline.append((math.sin(u) * w * 1.04, y))
    pts = [at(x, y, 0) for x, y in outline]
    rows = [[p + V(0, 0, z) for p in pts] for z in (0.0, 0.004, 0.020, 0.0265)]
    sole = fk.loft(f"miner.sole{s}", rows, SOLE, start="flat", end="flat", recalc=True)
    parts.append(sole)
    heel = []
    for i in range(32):
        u = i / 32 * math.tau
        heel.append(at(math.sin(u) * 0.042, -0.040 + math.cos(u) * 0.040 * (1 if math.cos(u) < 0 else 0.5), 0))
    parts.append(fk.loft(f"miner.heel{s}", [[p + V(0, 0, z) for p in heel] for z in (0.0, 0.004, 0.022)],
                         SOLE, start="flat", end="flat", recalc=True))
    # Laces criss-crossing between brass eyelets.
    eyes = []
    for k in range(5):
        z = 0.085 + k * 0.021
        y = 0.036 - k * 0.004
        for xs in (-1, 1):
            eyes.append(at(xs * 0.017, y + 0.006, z))
            parts.append(fk.ball(f"miner.eyelet{s}{k}{xs}", 0.0034, at(xs * 0.018, y + 0.008, z), BRASS, seg=10))
    for k in range(4):
        z0, z1 = 0.085 + k * 0.021, 0.085 + (k + 1) * 0.021
        y0, y1 = 0.036 - k * 0.004 + 0.011, 0.036 - (k + 1) * 0.004 + 0.011
        for xs in (-1, 1):
            parts.append(fk.tube(f"miner.lace{s}{k}{xs}", [at(xs * 0.017, y0, z0), at(0, (y0 + y1) / 2 + 0.003, (z0 + z1) / 2),
                                                          at(-xs * 0.017, y1, z1)], [0.0021] * 3, LACE, n=8))
    bow = at(0, 0.029, 0.188)
    for xs in (-1, 1):
        parts.append(fk.tube(f"miner.bow{s}{xs}", [bow, bow + side * xs * 0.010 + V(0, 0.004, 0.004),
                                                   bow + side * xs * 0.016 + V(0, 0.006, -0.008)],
                             [0.0024] * 3, LACE, n=8))
    for o in parts:
        for p in o.data.polygons:
            p.use_smooth = True
    return parts


# ------------------------------------------------------------- hair and face

def on_head(surf, p, lift):
    """A point on the head's surface nearest p, lifted along its normal."""
    q, n = surf.snap(V(*p))
    return q + n * lift


def lock(surf, ctrl, radii, lifts, n=12):
    """A tapered lock of hair lying on the head: control points snapped onto
    the skin and lifted, then smoothed."""
    pts = [on_head(surf, p, l) for p, l in zip(ctrl, lifts)]
    pts = mc.smooth_points(pts, n)
    rr = [float(np.interp(i / (n - 1), np.linspace(0, 1, len(radii)), radii)) for i in range(n)]
    return sd.Chain(pts, rr)


def moustache(surf):
    """A big bushy black moustache: thick locks from under the nose sweep
    out over the upper lip and droop past the mouth's corners, with lock
    tips along the lower edge. Sculpted once to find its own surface, then
    again with combed grooves laid on that surface so they really cut it."""
    lo, hi = (-0.095, 0.050, 1.010), (0.095, 0.160, 1.100)

    def locks(sc):
        for s in (-1, 1):
            for k in range(8):
                t = k / 7
                root = (s * (0.003 + 0.022 * t), 0.13, 1.081 - 0.005 * t)
                mid = (s * (0.024 + 0.030 * t), 0.13, 1.067 - 0.006 * t)
                low = (s * (0.042 + 0.024 * t), 0.12, 1.054 - 0.008 * t)
                tip = (s * (0.052 + 0.022 * t), 0.11, 1.046 - 0.010 * t + 0.004 * math.sin(k * 1.7))
                body = 0.0105 + 0.0035 * math.sin(math.pi * min(1.0, 0.25 + t))
                sc.add(lock(surf, [root, mid, low, tip], [body * 0.8, body, body * 0.75, 0.0032],
                            [body * 0.35, body * 0.95, body * 0.9, 0.004], 14), 0.0030)
            # The heavy bulk over the upper lip, under the nose.
            sc.add(lock(surf, [(s * 0.004, 0.13, 1.075), (s * 0.030, 0.13, 1.066), (s * 0.052, 0.12, 1.054)],
                        [0.012, 0.014, 0.010], [0.010, 0.014, 0.011], 12), 0.004)
        return sc

    first = locks(sd.Sculpt(lo, hi, 0.0008)).build("miner.moustache-shape", HAIR)
    shape = mc.Surface(first)
    bpy.data.objects.remove(first, do_unlink=True)
    sc = locks(sd.Sculpt(lo, hi, 0.0006))
    # Combed grooves following the locks, centred just under the sculpted
    # surface, and a parting under the nose.
    for s in (-1, 1):
        for k in range(14):
            t = (k + 0.5) / 14
            ctrl = [(s * (0.004 + 0.022 * t), 0.13, 1.081 - 0.005 * t),
                    (s * (0.026 + 0.030 * t), 0.13, 1.067 - 0.006 * t),
                    (s * (0.046 + 0.028 * t), 0.12, 1.052 - 0.012 * t),
                    (s * (0.054 + 0.024 * t), 0.11, 1.046 - 0.012 * t)]
            path = mc.smooth_points([on_head(surf, p, l) for p, l in zip(ctrl, (0.010, 0.024, 0.020, 0.010))], 16)
            on = []
            for p in path:
                q, n = shape.snap(p)
                on.append(q - n * 0.0004)
            radii = [0.0016 * (0.5 + 0.5 * math.sin(math.pi * min(1.0, (i + 1) / 15 * 1.2))) for i in range(16)]
            sc.carve(sd.Chain(on, radii), 0.0006)
    q0, n0 = shape.snap(on_head(surf, (0, 0.13, 1.083), 0.014))
    q1, n1 = shape.snap(on_head(surf, (0, 0.13, 1.068), 0.024))
    sc.carve(sd.Chain([q0 - n0 * 0.001, q1 - n1 * 0.001], 0.0018), 0.0012)
    return sc.build("miner.moustache", HAIR)


def brow(surf, s):
    """A thick bushy brow set in a frown: low and pulled in at the nose,
    high over the middle of the eye, tufted along its length."""
    lo = (min(0, s * 0.085) - 0.01, 0.040, 1.130)
    hi = (max(0, s * 0.085) + 0.01, 0.130, 1.190)
    sc = sd.Sculpt(lo, hi, 0.0006)
    line = [(s * 0.009, 0.12, 1.149), (s * 0.030, 0.12, 1.160), (s * 0.050, 0.11, 1.164), (s * 0.070, 0.09, 1.157)]
    sc.add(lock(surf, line, [0.0078, 0.0085, 0.0072, 0.0050], [0.0050, 0.0060, 0.0055, 0.0040], 16), 0.002)
    for k in range(7):
        t = k / 6
        x0, x1 = 0.008 + 0.054 * t, 0.020 + 0.054 * t
        z0 = 1.146 + 0.016 * math.sin(math.pi * min(1.0, t * 0.85 + 0.1)) - 0.002
        ctrl = [(s * x0, 0.12, z0 - 0.002), (s * (x0 + x1) / 2, 0.12, z0 + 0.004), (s * x1, 0.12, z0 + 0.006)]
        sc.add(lock(surf, ctrl, [0.0050, 0.0058, 0.0030], [0.0050, 0.0075, 0.0055], 10), 0.0015)
    return sc.build(f"miner.brow{s}", HAIR)


def hair(surf):
    """Short thick black hair under the hat: a close crop round the back and
    sides, over the ears' tops, tapering sideburns and an uneven cut at the
    nape. A shell on the skull with shallow combed grooves; nothing reaches
    the hat's crown."""
    sc = sd.Sculpt((-0.110, -0.130, 1.050), (0.110, 0.070, 1.235), 0.0008)
    E, C = sd.Ellipsoid, sd.Chain
    sc.add(E(V(0, -0.014, 1.158), (0.0890, 0.1010, 0.1030)))
    sc.add(E(V(0, -0.044, 1.136), (0.0815, 0.0755, 0.0835)), 0.008)
    # Only the hair's region: behind the face and above the nape.
    sc.clip(sd.Plane(V(0, 0.022, 0), (0, 1, 0), [-1, -1, -1], [1, 1, 1]), 0.008)
    sc.clip(sd.Plane(V(0, -0.02, 1.100), (0.0, 0.45, -1.0), [-1, -1, -1], [1, 1, 1]), 0.010)
    # Above the ears in front: the hair line rises to the temple.
    sc.clip(sd.Plane(V(0, 0.010, 1.150), (0.0, 0.70, -0.71), [-1, -1, -1], [1, 1, 1]), 0.010)
    for s in (-1, 1):
        # Round the ear: clear of it, with a little room.
        sc.carve(E(V(s * 0.088, -0.012, 1.110), (0.022, 0.030, 0.036)), 0.008)
        # Sideburns tapering down in front of the ears.
        sc.add(C([V(s * 0.081, 0.012, 1.166), V(s * 0.082, 0.014, 1.140), V(s * 0.080, 0.016, 1.118)],
                 [0.0055, 0.0048, 0.0030]), 0.005)
        # Uneven ends of the cut at the nape and behind the ears.
        for k in range(6):
            a = math.radians(115 + k * 12)
            p = V(s * math.sin(a) * 0.080, -0.030 + math.cos(a) * 0.088, 1.098 + 0.010 * math.sin(k * 1.9))
            sc.add(C([p + V(0, 0, 0.016), p], [0.0032, 0.0018]), 0.004)
    # Shallow grooves combed back and down.
    for s in (-1, 1):
        for k in range(14):
            a = math.radians(48 + k * 9.5)
            p0 = V(s * math.sin(a) * 0.0935, -0.014 + math.cos(a) * 0.1055, 1.185)
            p1 = V(s * math.sin(a + 0.18) * 0.0915, -0.014 + math.cos(a + 0.18) * 0.1025,
                   1.110 + 0.010 * math.sin(k * 2.3))
            sc.carve(C(mc.smooth_points([p0, (p0 + p1) / 2 + V(s * 0.002, 0, 0), p1], 8), 0.0011), 0.0014)
    return sc.build("miner.hair", HAIR)


EYE_C = {s: V(s * 0.0345, 0.0880, 1.1335) for s in (-1, 1)}
EYE_R = (0.0160, 0.0110, 0.0104)


def eyes():
    out = []
    for s in (-1, 1):
        c = EYE_C[s]
        white = mc.ellipsoid(f"miner.eye{s}", c, EYE_R, EYE, seg=48, rings=24)
        iris = mc.ellipsoid(f"miner.iris{s}", c + V(-s * 0.0015, 0.0099, 0.0008), (0.0076, 0.0024, 0.0080), IRIS,
                            seg=32, rings=16)
        out.append((white, f"eye{'L' if s < 0 else 'R'}"))
        out.append((iris, f"pupil{'L' if s < 0 else 'R'}"))
    return out


def eyelids():
    """Heavy upper lids over the eye's top third (a focused, determined
    look) and lighter lower lids, on the head."""
    out = []
    for s in (-1, 1):
        c = EYE_C[s]
        for upper in (True, False):
            pts, radii = [], []
            for t in np.linspace(-1, 1, 17):
                ang = t * 1.30
                x = math.sin(ang) * (EYE_R[0] + 0.0004)
                y = math.cos(ang) * (EYE_R[1] + 0.0002) - 0.0006
                if upper:
                    # Lower over the inner corner: the frown carries into the lid.
                    z = 0.0050 * math.cos(ang * 0.9) ** 0.7 - 0.0010 * s * t
                    r = 0.0042 * (0.55 + 0.45 * math.cos(t * 1.4))
                else:
                    z = -0.0050 * math.cos(ang * 0.9) ** 0.7
                    r = 0.0030 * (0.55 + 0.45 * math.cos(t * 1.4))
                pts.append(c + V(x, y, z))
                radii.append(r)
            out.append(fk.tube(f"miner.lid{s}{upper}", pts, radii, SKIN, n=14, caps=("dome", "dome")))
    return out


def mouth():
    m = mc.ellipsoid("miner.mouth-dark", V(0, 0.0930, 1.0615), (0.0230, 0.0060, 0.0044), MOUTH, seg=40, rings=16)
    t = fk.rbox("miner.teeth", (0.032, 0.006, 0.0040), V(0, 0.0960, 1.0620), TEETH, levels=2)
    return [m, t]


# ------------------------------------------------------------- garments on the skin

def ring_on_arm(name, surf, s, t, width, bulge, mat, rolls=2):
    """A rolled sleeve: stacked rolls round the arm at parameter t."""
    sh, el, wr = ms.SHOULDER[s], ms.ELBOW[s], ms.WRIST[s]
    pts = ms.arm_points(s)
    out = []
    for r in range(rolls):
        tt = t - r * width / 0.42
        c = mc.path_at(pts, tt)
        ax = (mc.path_at(pts, tt + 0.01) - mc.path_at(pts, tt - 0.01)).normalized()
        u = (V(1, 0, 0) - ax * ax.x).normalized()
        v = ax.cross(u)
        rings = []
        for j, f in enumerate(np.linspace(-1, 1, 9)):
            row = []
            off = ax * f * width * 0.5
            for i in range(48):
                a = i / 48 * math.tau
                d = (u * math.sin(a) + v * math.cos(a))
                hit, n = surf.snap(c + off + d * 0.052)
                lift = 0.0015 + bulge * math.sqrt(max(0.0, 1 - f * f)) * (1 + 0.15 * math.sin(a * 3 + r))
                row.append(hit + d * lift)
            rings.append(row)
        inner = [[p - (p - c).normalized() * 0.003 for p in row] for row in rings[::-1]]
        o = fk.loft(f"{name}{r}", rings + inner + [rings[0]], mat, closed=True, recalc=True)
        out.append(o)
    return out


def neckline(surf, step=4.0, window=3.0):
    """The skin's points on neck_f's zero line, one per `step` degrees round
    the neck (median of the points within `window`), smoothed as a loop."""
    P = surf.P
    # The neck's base only: the jaw and ears also cross the cylinder higher up.
    near = np.flatnonzero((P[:, 2] > 0.90) & (P[:, 2] < 1.03) & (np.hypot(P[:, 0], P[:, 1] + 0.016) < 0.13))
    f = np.array([neck_f(*P[i]) for i in near])
    line = P[near[np.abs(f) < 0.0015]]
    ang = np.degrees(np.arctan2(line[:, 0], line[:, 1] + 0.016)) % 360
    pts = []
    for a in np.arange(0.0, 360.0, step):
        sel = np.abs((ang - a + 180) % 360 - 180) < window
        if sel.sum() >= 2:
            pts.append(np.median(line[sel], axis=0))
    pts = np.array(pts)
    for _ in range(2):
        pts = (np.roll(pts, 1, axis=0) + 2 * pts + np.roll(pts, -1, axis=0)) / 4
    return [V(*p) for p in pts]


def band_ring(name, surf, centre, width, lift, thick, mat, across=4):
    """A closed band lying on the skin round a loop of points: its middle on
    the loop, `width` across the surface, standing `lift` off it with a
    rounded `thick` top, closed by side walls (no seam, no end caps)."""
    snapped = [surf.snap(p) for p in centre]
    n = len(snapped)
    tops, bots = [], []
    for j in range(across):
        u = j / (across - 1) * 2 - 1
        top, bot = [], []
        for i, (q, nq) in enumerate(snapped):
            t = (snapped[(i + 1) % n][0] - snapped[i - 1][0]).normalized()
            side = nq.cross(t).normalized()
            p, pn = surf.snap(q + side * u * width * 0.5)
            edge = 1 - abs(u) ** 4
            top.append(p + pn * (lift + thick * (0.45 + 0.55 * edge)))
            bot.append(p + pn * (lift * 0.4))
        tops.append(top)
        bots.append(bot)
    c = fk.Mesh(name, mat)
    vt = [[c.v(p) for p in row] for row in tops]
    vb = [[c.v(p) for p in row] for row in bots]
    c.grid(vt, mat, closed=True)
    c.grid(vb, mat, closed=True, flip=True)
    c.grid([vt[0], vb[0]], mat, closed=True, flip=True)
    c.grid([vt[-1], vb[-1]], mat, closed=True)
    return c.obj(recalc=True)


def collar(surf):
    """A buttoned work-shirt collar: a band closed round the base of the
    neck, lying exactly on the shirt's edge (so no skin shows past it), and
    two points folded down over the collarbones."""
    line = neckline(surf) if NECKLINE is None else [V(*q) for q in NECKLINE_POINTS]
    out = [band_ring("miner.collar-band", surf, line, 0.030, 0.0035, 0.0055, SHIRT)]
    for s in (-1, 1):
        p = [V(s * 0.012, 0.066, 0.958), V(s * 0.042, 0.064, 0.946), V(s * 0.068, 0.054, 0.932)]
        out.append(mc.strip(f"miner.collar-point{s}", surf, p, 0.030, 0.004, 0.003, SHIRT, samples=16, across=9,
                            width_fn=lambda t: 0.4 + 0.6 * math.sin(math.pi * min(1, t * 1.1)) + 0.15))
    # Placket and two buttons down to the bib.
    out.append(mc.strip("miner.placket", surf, [V(0, 0.07, 0.955), V(0, 0.095, 0.90), V(0, 0.11, 0.86)],
                        0.018, 0.0015, 0.002, SHIRT, samples=14, across=5))
    for z in (0.93, 0.895):
        p, n = surf.ray(V(0, 0.4, z), V(0, -1, 0))
        out.append(fk.ball(f"miner.shirt-button{z}", 0.0048, p + n * 0.004, BUTTON, seg=14))
    return out


BIB_TOP = 0.878
BIB_HALF = 0.104


def bib(surf):
    out = []
    # Front bib: a rounded rectangle down to the trousers' front.
    outline = []
    for i in range(41):
        t = i / 40
        outline.append(V(-BIB_HALF + 2 * BIB_HALF * t, 0.4, BIB_TOP + 0.004 * math.sin(math.pi * t)))
    for z in np.linspace(BIB_TOP, 0.630, 14)[1:]:
        outline.append(V(BIB_HALF + 0.020 * mc.ssf(0.70, 0.64, z), 0.4, z))
    for i in range(1, 40):
        t = i / 40
        outline.append(V(BIB_HALF + 0.020 - 2 * (BIB_HALF + 0.020) * t, 0.4, 0.628))
    for z in np.linspace(0.630, BIB_TOP, 14)[:-1]:
        outline.append(V(-BIB_HALF - 0.020 * mc.ssf(0.70, 0.64, z), 0.4, z))
    out.append(mc.panel("miner.bib", surf, outline, (0, -1, 0), 0.006, 0.0045, DENIM, res=0.005))
    # The bib's chest pocket with a flap seam.
    pk = []
    for x, z in ((-0.058, 0.840), (0.040, 0.840), (0.040, 0.760), (0.034, 0.752), (-0.052, 0.752), (-0.058, 0.760)):
        pk.append(V(x, 0.4, z))
    pocket = mc.panel("miner.bib-pocket", surf, pk, (0, -1, 0), 0.0105, 0.003, DENIM, res=0.005)
    out.append(pocket)
    # Stitching round the bib's edge and the pocket.
    for path, name in ((
            [V(-BIB_HALF + 0.006, 0.4, BIB_TOP - 0.006), V(BIB_HALF - 0.006, 0.4, BIB_TOP - 0.006)], "top"),
            ([V(-0.054, 0.4, 0.836), V(0.036, 0.4, 0.836)], "pocket")):
        seam = []
        for p in mc.smooth_points(path, 30):
            hit, n = surf.ray(p, (0, -1, 0))
            if hit is not None:
                seam.append(hit + n * (0.0115 if name == "top" else 0.0142))
        out.append(fk.tube(f"miner.stitch-{name}", seam, [0.0011] * len(seam), STITCH, n=6, caps=("dome", "dome")))
    # The sides of the bib: double stitch lines.
    for s in (-1, 1):
        seam = []
        for z in np.linspace(BIB_TOP - 0.008, 0.70, 24):
            hit, n = surf.ray(V(s * (BIB_HALF - 0.007), 0.4, z), (0, -1, 0))
            if hit is not None:
                seam.append(hit + n * 0.0112)
        out.append(fk.tube(f"miner.stitch-side{s}", seam, [0.0011] * len(seam), STITCH, n=6))
    return out


def back_panel(surf):
    outline = []
    top = 0.770
    for i in range(31):
        t = i / 30
        outline.append(V(-0.095 + 0.19 * t, -0.4, top - 0.016 * math.sin(math.pi * t)))
    for z in np.linspace(top, 0.630, 10)[1:]:
        outline.append(V(0.095 + 0.03 * mc.ssf(0.70, 0.64, z), -0.4, z))
    for i in range(1, 30):
        t = i / 30
        outline.append(V(0.125 - 0.25 * t, -0.4, 0.628))
    for z in np.linspace(0.630, top, 10)[:-1]:
        outline.append(V(-0.095 - 0.03 * mc.ssf(0.70, 0.64, z), -0.4, z))
    out = [mc.panel("miner.back-panel", surf, outline, (0, 1, 0), 0.0055, 0.004, DENIM, res=0.006)]
    # A patch pocket on the seat.
    for s in (1,):
        pk = [V(s * 0.030, -0.4, 0.600), V(s * 0.105, -0.4, 0.600), V(s * 0.100, -0.4, 0.525),
              V(s * 0.068, -0.4, 0.512), V(s * 0.036, -0.4, 0.525)]
        out.append(mc.panel("miner.seat-pocket", surf, pk, (0, 1, 0), 0.0035, 0.0028, DENIM, res=0.005))
    return out


def straps(surf):
    """Suspenders from the bib's corners over the shoulders, crossed on
    the back, with brass buckles and buttons in front."""
    out = []
    for s in (-1, 1):
        front = V(s * (BIB_HALF - 0.022), 0.13, BIB_TOP + 0.020)
        path = [front + V(0, 0, -0.012), V(s * 0.090, 0.11, 0.935), V(s * 0.112, 0.02, 0.985),
                V(s * 0.105, -0.07, 0.965), V(s * 0.040, -0.115, 0.860), V(-s * 0.060, -0.118, 0.776)]
        out.append(mc.strip(f"miner.strap{s}", surf, path, 0.030, 0.0085, 0.003, DENIM, samples=60, across=7))
        # Brass buckle: a rounded frame with a crossbar, and the button
        # on the bib it hooks onto.
        p, n = surf.ray(front + V(0, 0.3, -0.004), (0, -1, 0))
        up = V(0, 0, 1)
        side = n.cross(up).normalized()
        upv = side.cross(n).normalized()
        c = p + n * 0.014
        frame = []
        for i in range(24):
            a = i / 24 * math.tau
            frame.append(c + side * math.cos(a) * 0.019 + upv * math.sin(a) * 0.015)
        out.append(fk.tube(f"miner.buckle{s}", frame + frame[:1], [0.0026] * 25, BRASS, n=10, caps=(None, None)))
        out.append(fk.tube(f"miner.buckle-bar{s}", [c - side * 0.018, c + side * 0.018], [0.0024, 0.0024], BRASS,
                           n=10))
        bp, bn = surf.ray(front + V(0, 0.3, -0.026), (0, -1, 0))
        out.append(mc.ellipsoid(f"miner.bib-button{s}", bp + bn * 0.012, (0.0080, 0.0080, 0.0045), BRASS,
                                axes=(bn.cross(V(0, 0, 1)).normalized(), V(0, 0, 1), bn), seg=24, rings=12))
    # The straps' crossing point and their ends on the back panel.
    for s in (-1, 1):
        p, n = surf.ray(V(-s * 0.060, -0.4, 0.775), (0, 1, 0))
        out.append(mc.ellipsoid(f"miner.back-button{s}", p + n * 0.010, (0.0075, 0.0075, 0.004), BRASS,
                                axes=(n.cross(V(0, 0, 1)).normalized(), V(0, 0, 1), n), seg=20, rings=10))
    return out


def waistband(surf):
    """The dungarees' waist seam round the sides (bib and back panel cover
    front and back) with a brass side button on each hip."""
    out = []
    for s in (-1, 1):
        pts = []
        for a in np.linspace(35, 145, 18):
            r = math.radians(a)
            pts.append(V(s * math.sin(r) * 0.2, math.cos(r) * 0.2, WAIST_Z))
        out.append(mc.strip(f"miner.waistband{s}", surf, pts, 0.026, 0.003, 0.004, DENIM, samples=30, across=7))
        p, n = surf.ray(V(s * 0.4, 0.02, WAIST_Z), (-s, 0, 0))
        out.append(mc.ellipsoid(f"miner.side-button{s}", p + n * 0.0095, (0.0072, 0.0072, 0.0042), BRASS,
                                axes=(n.cross(V(0, 0, 1)).normalized(), V(0, 0, 1), n), seg=20, rings=10))
        # The side opening's placket below it.
        out.append(mc.strip(f"miner.side-placket{s}", surf, [V(s * 0.2, 0.02, WAIST_Z - 0.012), V(s * 0.2, 0.0, 0.575)],
                            0.016, 0.0025, 0.0025, DENIM, samples=10, across=5))
    return out


def turnups(surf):
    out = []
    for s in (-1, 1):
        a = ms.ANKLE[s]
        c = V(a.x, a.y + 0.004, 0.162)
        rings = []
        for j, f in enumerate(np.linspace(-1, 1, 9)):
            row = []
            for i in range(48):
                ang = i / 48 * math.tau
                d = V(math.sin(ang), math.cos(ang), 0)
                hit, n = surf.snap(c + V(0, 0, f * 0.016) + d * 0.064)
                lift = 0.004 + 0.004 * math.sqrt(max(0.0, 1 - f * f))
                row.append(hit + d * lift)
            rings.append(row)
        inner = [[p - (p - V(c.x, c.y, p.z)).normalized() * 0.004 for p in row] for row in rings[::-1]]
        out.append(fk.loft(f"miner.turnup{s}", rings + inner + [rings[0]], DENIM, closed=True, recalc=True))
    return out


def cuffs(surf):
    out = []
    for s in (-1, 1):
        out += ring_on_arm(f"miner.cuff{s}-", surf, s, CUFF_T + 0.012, 0.022, 0.0055, SHIRT, rolls=2)
    return out


def garments(surfaces):
    """Sewn shells on the skin. Each is placed on, and later takes its
    weights from, only its own kind of skin (surfaces: 'trunk', never an
    arm; 'arm'; 'leg'), so a button aimed at the hip never lands on the
    hanging forearm."""
    parts = []
    for fn, kind in ((collar, "trunk"), (bib, "trunk"), (back_panel, "trunk"), (straps, "trunk"),
                     (waistband, "trunk"), (turnups, "leg"), (cuffs, "arm")):
        parts += [(o, kind) for o in fn(surfaces[kind])]
    for o, _ in parts:
        for p in o.data.polygons:
            p.use_smooth = True
    return parts
