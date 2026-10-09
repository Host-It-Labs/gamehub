"""The Cadets (card `archers`): detailed editable master, 8 October 2026.

Brief: work/arena/2026-10-08-roster/archers/brief.md. Two 1960s retro space
cadets (a young man, look A, and a young woman, look B, sharing one suit
and rig) in chunky off-white pressure suits with cobalt team panels, a gold
neck ring carrying a clear glass bubble, gauntlet gloves, moon boots, a
life-support pack with a whip antenna and a chrome ray gun in two hands.

Blender +Y is forward, Z is up, metres. The suit is one connected sculpt
(torso, sleeves, trouser legs) fused by a voxel remesh and weighted to a
common-axis skeleton (every bone points +Z with the root's axes, so the
runtime's radians mean the same as for rigid parts). Construction that
sits on the suit (panels, bands, bellows, boots) is skinned from the suit's
weights; hard parts (ring, glass, chest unit, pack, belt, gloves, head,
gun) ride their bones rigidly.

Rest pose: relaxed natural stance; upper arms hang against the flanks in a
shallow recess of the suit, elbows bent about 20 degrees, hands beside the
thighs, palms in; the right fist holds the gun muzzle down-forward.
"""
import json
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

import kit
import figure_folk_kit as fk

V = fk.V
TAU = math.tau
R = "archers"
T = kit.tint

# ------------------------------------------------------------- paints

SUIT = "weave:" + T("cadet-suit", "#e8e3d4")
TEAM = "weave:team"
RUBBER = "resin:" + T("cadet-rubber", "#c6c3b8")
GLOVE = "hide:" + T("cadet-glove", "#ece5d3")
BOOT = "resin:" + T("cadet-boot", "#eeeae0")
SOLE = "resin:" + T("cadet-sole", "#2a2b2f")
BELT = "hide:" + T("cadet-belt", "#2c2d33")
POUCH = "hide:" + T("cadet-pouch", "#8c6a46")
GOLD = "gilt:" + T("cadet-gold", "#c99a3c")
CHROME = "chrome:" + T("cadet-chrome", "#c8ced6")
SHELL = "lacquer:" + T("cadet-unit", "#dcdad2")
PACK = "lacquer:team"
GRIP = "resin:" + T("cadet-grip", "#27282c")
RAY = "glow:" + T("cadet-ray", "#ff3b2b")
GLASS = "glass:" + T("cadet-glass", "#dff2ff")
SKIN = {"A": "skin:" + T("cadet-skin-him", "#e0a684"),
        "B": "skin:" + T("cadet-skin-her", "#ecb79a")}
HAIR = {"A": "hair:" + T("cadet-hair-him", "#5b3721"),
        "B": "hair:" + T("cadet-hair-her", "#6e3b22")}
LIPS = {"A": SKIN["A"], "B": "skin:" + T("cadet-lips-her", "#b9574c")}
EYE = "resin:" + T("cadet-eye", "#f3f0e8")
IRIS = "resin:" + T("cadet-iris", "#2a211d")
BROW = "hair:" + T("cadet-brow", "#3f2617")
MOUTH = "resin:" + T("cadet-mouth", "#5b2c27")

# ------------------------------------------------------------- joints

HIP = {s: V(s * .088, -.004, .578) for s in (-1, 1)}
KNEE = {s: V(s * .094, .016, .322) for s in (-1, 1)}
ANKLE = {s: V(s * .098, -.008, .090) for s in (-1, 1)}
WAIST = V(0, -.012, .655)
CHEST = V(0, -.020, .815)
NECK = V(0, -.004, 1.030)
CLAV = {s: V(s * .030, .022, .935) for s in (-1, 1)}
SHOULDER = {s: V(s * .176, -.018, .905) for s in (-1, 1)}
ELBOW = {s: V(s * .206, -.032, .668) for s in (-1, 1)}
WRIST = {s: V(s * .213, .030, .470) for s in (-1, 1)}
ANTENNA = V(-.092, -.198, .978)
HEAD_C = V(0, .006, 1.118)          # centre of the head's mass
BUBBLE_C = V(0, .006, 1.105)        # the glass sphere
BUBBLE_R = .168
RING_Z = .990                       # where the glass seats on the ring


def g(x, c, r):
    return math.exp(-((x - c) / r) ** 2)


def ss(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def table(rows, x):
    """Smooth bounded (monotone Hermite) section interpolation."""
    if x <= rows[0][0]:
        return tuple(rows[0][1:])
    if x >= rows[-1][0]:
        return tuple(rows[-1][1:])
    for i in range(len(rows) - 1):
        a, b = rows[i:i + 2]
        if x > b[0]:
            continue
        u = (x - a[0]) / (b[0] - a[0])
        previous = rows[max(0, i - 1)]
        following = rows[min(len(rows) - 1, i + 2)]
        vals = []
        for j in range(1, len(a)):
            ma = (b[j] - previous[j]) / (b[0] - previous[0])
            mb = (following[j] - a[j]) / (following[0] - a[0])
            v = ((2 * u ** 3 - 3 * u ** 2 + 1) * a[j] +
                 (u ** 3 - 2 * u ** 2 + u) * ma * (b[0] - a[0]) +
                 (-2 * u ** 3 + 3 * u ** 2) * b[j] +
                 (u ** 3 - u ** 2) * mb * (b[0] - a[0]))
            vals.append(max(min(a[j], b[j]), min(max(a[j], b[j]), v)))
        return tuple(vals)


def line_path(points, t):
    """Catmull-Rom through points, parameterised by physical length."""
    distances = [0]
    for a, b in zip(points, points[1:]):
        distances.append(distances[-1] + (b - a).length)
    target = max(0, min(1, t)) * distances[-1]
    i = next((j for j in range(len(points) - 1)
              if target <= distances[j + 1]), len(points) - 2)
    f = (target - distances[i]) / max(1e-6, distances[i + 1] - distances[i])
    a, b, c, d = [points[max(0, min(len(points) - 1, j))]
                  for j in (i - 1, i, i + 1, i + 2)]
    return .5 * ((2 * b) + (-a + c) * f +
                 (2 * a - 5 * b + 4 * c - d) * f * f +
                 (-a + 3 * b - 3 * c + d) * f ** 3)


def adeg(a):
    """Angle from the front, 0..180 degrees, either side."""
    return abs((math.degrees(a) + 180) % 360 - 180)


# ------------------------------------------------------------- the suit
# Sections of the trunk: (z, half-width, front, back). A chunky padded suit
# over a slim athletic young adult: chest and shoulder-blade masses, a
# tapered waist under the belt, a seat behind, the trapezius slope up to
# the neck opening under the ring.

BODY = [(.505, .050, .040, .046), (.525, .104, .070, .078),
        (.550, .140, .086, .095), (.580, .156, .091, .101),
        (.620, .154, .091, .101), (.660, .143, .087, .094),
        (.700, .142, .089, .094), (.750, .152, .098, .099),
        (.800, .164, .108, .103), (.850, .174, .115, .105),
        (.880, .174, .112, .105), (.905, .162, .104, .101),
        (.930, .136, .090, .093), (.955, .106, .076, .081),
        (.978, .080, .063, .067), (.998, .062, .054, .057),
        (1.008, .050, .046, .050)]


def body_point(a, z, extra=0.0):
    width, front, back = table(BODY, z)
    sa, ca = math.sin(a), math.cos(a)
    power = 2.3
    x = math.copysign(abs(sa) ** (2 / power), sa) * (width + extra)
    y = math.copysign(abs(ca) ** (2 / power), ca) * \
        ((front if ca >= 0 else back) + extra)
    ad = adeg(a)
    sx = 1 if x >= 0 else -1
    # The hanging arm lies in a shallow recess along the flank, so the
    # upper arm can rest against the body without fusing to it.
    x -= sx * .026 * g(z, .790, .085) * g(ad, 96, 24)
    if ad < 90:
        # Chest masses either side of a soft sternum line, a flat belly.
        y += .010 * g(z, .858, .036) * g(ad, 30, 19)
        y -= .003 * g(z, .826, .010) * g(ad, 30, 16)
        y -= .004 * g(z, .850, .040) * g(ad, 0, 7)
        y += .004 * g(z, .745, .045) * g(ad, 0, 32)
        # Fabric gathered above and below the belt.
        y += .0012 * (math.sin(ad * .21) + .6 * math.sin(ad * .47 + 1)) * \
            g(z, .714, .011) * g(ad, 35, 45)
        # The trapezius slope dips in to the collarbones.
        y += .004 * g(z, .945, .018) * g(ad, 40, 25)
    else:
        # Shoulder blades, a spine channel and the seat.
        y -= .008 * g(z, .862, .048) * g(ad, 148, 20)
        y += .005 * g(ad, 180, 8) * g(z, .770, .095)
        y -= .008 * g(z, .590, .040) * g(ad, 150, 26)
    return V(x, y - .012, z)


def torso():
    rings = [[body_point(i / 128 * TAU, z) for i in range(128)]
             for z in np.linspace(BODY[0][0], BODY[-1][0], 120)]
    return fk.loft(f"{R}.trunk", rings, SUIT, start="pole", end="pole",
                   recalc=True)


def limb_frame(points, t):
    """Ring frame along a limb: `front` is the figure's +Y made square to
    the limb, `across` completes it (lateral for a hanging limb, upward
    where a sleeve leaves the shoulder sideways)."""
    p = line_path(points, t)
    axis = (line_path(points, min(1, t + .0005)) -
            line_path(points, max(0, t - .0005))).normalized()
    front = (V(0, 1, 0) - axis * axis.y).normalized()
    across = axis.cross(front).normalized()
    return p, axis, across, front


def limb_rings(points, sections, detail, count=90, around=60, t0=0.0, t1=1.0,
               extra=0.0):
    rings = []
    for t in np.linspace(t0, t1, count):
        p, axis, across, front = limb_frame(points, t)
        width, rf, rb = table(sections, t)
        row = []
        for i in range(around):
            a = i / around * TAU
            sn, cs = math.sin(a), math.cos(a)
            d = detail(t, a) if detail else 0
            row.append(p + across * sn * (width + extra + d * .6) +
                       front * cs * ((rf if cs >= 0 else rb) + extra + d))
        rings.append(row)
    return rings


def arm_points(s):
    sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
    return [sh + V(-s * .060, -.004, -.006), sh + V(s * .014, 0, -.030),
            (sh + el) / 2, el, (el + wr) / 2,
            wr + (wr - el).normalized() * .010]


# Sleeve: (t, half-width, front, back). A padded shoulder cap, a
# fuller upper arm, the elbow, a forearm narrowing to the cuff.
ARM = [(0, .044, .050, .052), (.10, .055, .058, .061),
       (.22, .058, .056, .058), (.38, .054, .052, .054),
       (.48, .048, .046, .050), (.56, .049, .048, .050),
       (.70, .046, .045, .045), (.86, .040, .039, .040),
       (1, .036, .035, .036)]


def arm_detail(s):
    def detail(t, a):
        cs, sn = math.cos(a), math.sin(a)
        front, back = max(0, cs), max(0, -cs)
        out = max(0, s * sn)
        # Deltoid front and rear heads under the padding, a soft biceps,
        # the elbow point behind, and a few fabric folds that spiral round
        # the upper arm as a padded sleeve does.
        d = (.006 * g(t, .12, .07) * front ** 3 +
             .005 * g(t, .14, .08) * back ** 3 +
             .004 * g(t, .10, .06) * out ** 2 +
             .004 * g(t, .30, .09) * front ** 4 +
             .005 * g(t, .51, .03) * back ** 8 -
             .003 * g(t, .50, .03) * front ** 6)
        d += .0018 * math.sin(a * 3 + t * 22) * g(t, .30, .10)
        d += .0015 * math.sin(a * 2 - t * 30) * g(t, .72, .10)
        return d
    return detail


def arm(s):
    rings = limb_rings(arm_points(s), ARM, arm_detail(s))
    return fk.loft(f"{R}.sleeve-{s}", rings, SUIT, start="pole", end="pole",
                   recalc=True)


def leg_points(s):
    h, k, a = HIP[s], KNEE[s], ANKLE[s]
    return [h + V(-s * .022, -.004, .052), h + V(0, -.002, .004),
            (h + k) / 2, k, (k + a) / 2,
            a + V(0, .004, -.012)]


# Trouser leg: (t, half-width, front, back). A full thigh merging into
# the seat, the knee, the calf (inside the boot shaft below t .6).
LEG = [(0, .050, .060, .064), (.10, .084, .084, .094),
       (.20, .080, .079, .086),
       (.32, .070, .068, .072), (.46, .060, .060, .058),
       (.52, .058, .060, .057), (.62, .056, .054, .062),
       (.78, .050, .048, .052), (1, .046, .046, .046)]


def leg_detail(s):
    def detail(t, a):
        cs, sn = math.cos(a), math.sin(a)
        front, back = max(0, cs), max(0, -cs)
        inner = max(0, -s * sn)
        d = (.006 * g(t, .26, .10) * front ** 3 +
             .004 * g(t, .30, .08) * inner ** 3 +
             .005 * g(t, .49, .035) * front ** 6 +
             .004 * g(t, .66, .07) * back ** 3)
        # Loose fabric folds over the thigh and behind the knee.
        d += .0016 * math.sin(a * 3 + t * 18) * g(t, .22, .09)
        d += .0020 * math.sin(a * 5) * g(t, .52, .03) * back ** 2
        return d
    return detail


def leg(s):
    rings = limb_rings(leg_points(s), LEG, leg_detail(s), count=80)
    return fk.loft(f"{R}.trouser-{s}", rings, SUIT, start="pole", end="pole",
                   recalc=True)


def add_weights(group, values, step=1000):
    """Write a weight field to a vertex group in sorted batches."""
    q = np.rint(np.clip(values, 0, 1) * step).astype(int)
    indices = np.flatnonzero(q > 0)
    indices = indices[np.argsort(q[indices], kind="stable")]
    cuts = np.flatnonzero(np.diff(q[indices])) + 1
    for batch in np.split(indices, cuts):
        if len(batch):
            group.add(batch.tolist(), float(q[batch[0]]) / step, "REPLACE")


def fuse(parts, name, voxel, smooth=3):
    for o in parts:
        kit.apply(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = parts[0]
    o.name = name
    mod = o.modifiers.new("Connected suit", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    co = np.empty(len(o.data.vertices) * 3, dtype=np.float64)
    o.data.vertices.foreach_get("co", co)
    x, y, z = co.reshape(-1, 3).T
    shoulder = np.maximum(0, 1 - ((np.abs(x) - .150) / .060) ** 2 -
                          ((z - .925) / .060) ** 2)
    hip = np.maximum(0, 1 - ((np.abs(x) - .150) / .040) ** 2 -
                     ((z - .610) / .060) ** 2)
    field = np.maximum(shoulder, hip)
    blend = o.vertex_groups.new(name="Shoulder and hip junctions")
    add_weights(blend, field)
    mod = o.modifiers.new("Continuous shoulder girdle", "SMOOTH")
    mod.factor, mod.iterations = .75, 14
    mod.vertex_group = blend.name
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.vertex_groups.clear()
    if smooth:
        mod = o.modifiers.new("Soft fabric transitions", "SMOOTH")
        mod.factor, mod.iterations = .5, smooth
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


def suit(voxel=None):
    voxel = voxel or float(os.environ.get("ARCHERS_VOXEL", ".0026"))
    parts = [torso()]
    for s in (-1, 1):
        parts += [arm(s), leg(s)]
    o = fuse(parts, f"{R}.suit", voxel)
    o.data.materials.clear()
    o.data.materials.append(kit.material(SUIT))
    return o


# ------------------------------------------------------------- construction
# Cobalt team panels and bands, ribbed rubber bellows: separate skinned
# shells laid over the suit, with a real edge where they are sewn on.

def laid_on(obj, suit_obj, lift=.0026, thickness=.0045):
    """Shrink a sheet onto the suit `lift` above it, then give it a sewn
    edge `thickness` deep."""
    import figure_archers_parts as P
    P.shrink_onto(obj, suit_obj, lift)
    P.solidify(obj, thickness, offset=-1)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def sheet(name, fn, us, vs, mat, closed=False):
    c = fk.Mesh(name, mat)
    rows = [[c.v(fn(u, v)) for u in us] for v in vs]
    c.grid(rows, mat, closed=closed)
    return c.obj(recalc=True)


def arm_band(s, t0, t1, suit_obj, name):
    pts = arm_points(s)

    def fn(u, v):
        t = t0 + (t1 - t0) * v
        p, axis, across, front = limb_frame(pts, t)
        width, rf, rb = table(ARM, t)
        a = u * TAU
        cs = math.cos(a)
        return (p + across * math.sin(a) * width +
                front * cs * (rf if cs >= 0 else rb))
    o = sheet(name, fn, np.linspace(0, 1, 72, endpoint=False),
              np.linspace(0, 1, 6), TEAM, closed=True)
    return laid_on(o, suit_obj)


def torso_panel(name, a_range, z0, z1, suit_obj, rows=24, cols=28):
    def fn(u, v):
        z = z0 + (z1 - z0) * v
        lo, hi = a_range(z)
        return body_point(math.radians(lo + (hi - lo) * u), z)
    o = sheet(name, fn, np.linspace(0, 1, cols), np.linspace(0, 1, rows), TEAM)
    return laid_on(o, suit_obj)


def panels(suit_obj):
    out = []
    # The front stripe from the belt up into the collar yoke.
    out.append(torso_panel(f"{R}.panel-front",
                           lambda z: (-13 - 3 * g(z, .93, .03), 13 + 3 * g(z, .93, .03)),
                           .704, .935, suit_obj, rows=28, cols=14))
    # The collar yoke round the ring's base.
    def yoke(u, v):
        z = .892 + (.975 - .892) * v
        return body_point(u * TAU, z)
    o = sheet(f"{R}.panel-yoke", yoke, np.linspace(0, 1, 128, endpoint=False),
              np.linspace(0, 1, 10), TEAM, closed=True)
    out.append(laid_on(o, suit_obj))
    # Side panels under the arms, rounded at the top.
    for s in (-1, 1):
        def side(z, s=s):
            k = max(0, (z - .80) / .055)
            half = max(5, 24 * math.sqrt(max(0, 1 - k * k))) if z > .80 else 24
            lo, hi = 87 - half, 87 + half
            return (s * lo, s * hi) if s > 0 else (s * hi, s * lo)
        out.append(torso_panel(f"{R}.panel-side-{s}", side, .704, .852, suit_obj,
                               rows=20, cols=18))
    # Two bands on each upper arm and one at the cuff.
    for s in (-1, 1):
        for k, (t0, t1) in enumerate(((.25, .31), (.35, .41), (.80, .88))):
            out.append(arm_band(s, t0, t1, suit_obj, f"{R}.band-{s}-{k}"))
    return out


def bellows(name, points, sections, t0, t1, ribs=3):
    rings = []
    for k, t in enumerate(np.linspace(t0, t1, 9 * ribs + 1)):
        u = (t - t0) / (t1 - t0)
        rib = .5 - .5 * math.cos(u * ribs * TAU)
        env = math.sin(math.pi * u) ** .35
        extra = .0010 + env * (.0018 + .0034 * rib)
        rings.append(limb_rings(points, sections, None, count=1, around=56,
                                t0=t, t1=t, extra=extra)[0])
    o = fk.loft(name, rings, RUBBER, start=None, end=None)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def joints_rubber():
    out = []
    for s in (-1, 1):
        out.append(bellows(f"{R}.bellows-elbow-{s}", arm_points(s), ARM, .45, .57))
        out.append(bellows(f"{R}.bellows-knee-{s}", leg_points(s), LEG, .42, .55))
    return out


# ------------------------------------------------------------- the rig

BONES = {"torso": (WAIST, None), "chest": (CHEST, "torso"),
         "head": (NECK, "chest"), "antenna": (ANTENNA, "chest")}
for _s, _x in ((-1, "L"), (1, "R")):
    BONES["clav" + _x] = (CLAV[_s], "chest")
    BONES["arm" + _x] = (SHOULDER[_s], "clav" + _x)
    BONES["fore" + _x] = (ELBOW[_s], "arm" + _x)
    BONES["hand" + _x] = (WRIST[_s], "fore" + _x)
    BONES["leg" + _x] = (HIP[_s], None)
    BONES["knee" + _x] = (KNEE[_s], "leg" + _x)
    BONES["foot" + _x] = (ANKLE[_s], "knee" + _x)


def make_rig(root, weapon_at):
    data = bpy.data.armatures.new("Cadet joint frames")
    rig = bpy.data.objects.new(f"{R}.skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = dict(BONES)
    bones["weapon"] = (weapon_at, "handR")
    for name, (pos, _) in bones.items():
        bone = data.edit_bones.new(f"{R}.{name}")
        bone.head, bone.tail = pos, pos + V(0, 0, .06)
        bone.use_connect = False
    for name, (_, parent) in bones.items():
        if parent:
            data.edit_bones[f"{R}.{name}"].parent = data.edit_bones[f"{R}.{parent}"]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    data.display_type = "STICK"
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k: list(v[0]) for k, v in bones.items()})
    return rig


def segment(p, a, b):
    a, b = np.array(a), np.array(b)
    d = b - a
    t = np.clip((p - a) @ d / d.dot(d), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * d), axis=1), t


def body_width(z):
    zs = np.array([r[0] for r in BODY])
    ws = np.array([r[1] for r in BODY])
    return np.interp(z, zs, ws) - .026 * np.exp(-((z - .79) / .085) ** 2)


def suit_weights(o, rig):
    n = len(o.data.vertices)
    co = np.empty(n * 3)
    o.data.vertices.foreach_get("co", co)
    p = co.reshape(-1, 3)
    x, y, z = p.T
    names = [b.name.removeprefix(f"{R}.") for b in rig.data.bones]
    W = {k: np.zeros(n) for k in names}
    trunk = np.ones(n)
    for s, side in ((-1, "L"), (1, "R")):
        sw = ss(-.014, .014, x * s)
        share = (1 - ss(.552, .668, z)) * sw
        knee = 1 - ss(KNEE[s].z - .050, KNEE[s].z + .050, z)
        foot = 1 - ss(ANKLE[s].z - .015, ANKLE[s].z + .030, z)
        W["leg" + side] += share * (1 - knee)
        W["knee" + side] += share * knee * (1 - foot)
        W["foot" + side] += share * knee * foot
        trunk -= share
    chest = ss(.700, .860, z)
    W["torso"] += trunk * (1 - chest)
    W["chest"] += trunk * chest
    bw = body_width(z)
    for s, side in ((-1, "L"), (1, "R")):
        S_, E_, W_ = SHOULDER[s], ELBOW[s], WRIST[s]
        d1, t1 = segment(p, S_, E_)
        d2, t2 = segment(p, E_, W_)
        tip = W_ + (W_ - E_).normalized() * .02
        d3, _ = segment(p, W_, tip)
        dist = np.minimum.reduce([d1, d2, d3])
        l1, l2 = (E_ - S_).length, (W_ - E_).length
        along = np.where(d1 <= d2, t1 * l1, l1 + t2 * l2)
        outside = ss(bw + .002, bw + .018, x * s)
        shoulder = ss(.835, .900, z) * (1 - ss(.985, 1.01, z)) * ss(.100, .175, x * s)
        region = (x * s > .09) & (z > .40) & (dist < .088)
        arm = region * np.maximum(outside, shoulder)
        fore = ss(l1 - .040, l1 + .035, along)
        hand = ss(l1 + l2 - .004, l1 + l2 + .014, along)
        clav = (1 - ss(.00, .09, along)) * .40 * arm
        armw = arm - clav
        W["clav" + side] += clav
        W["arm" + side] += armw * (1 - fore)
        W["fore" + side] += armw * fore * (1 - hand)
        W["hand" + side] += armw * fore * hand
        for k in W:
            if k not in ("clav" + side, "arm" + side, "fore" + side, "hand" + side):
                W[k] *= (1 - arm)
        # The trapezius slope rides the shoulder girdle.
        trap = (.45 * ss(.050, .115, x * s) * ss(.875, .935, z) *
                (1 - ss(.990, 1.010, z)) * (1 - arm))
        take = np.minimum(W["chest"], trap)
        W["chest"] -= take
        W["clav" + side] += take
    total = np.maximum(1e-6, sum(W.values()))
    groups = {}
    for k, w in W.items():
        grp = o.vertex_groups.new(name=f"{R}.{k}")
        add_weights(grp, w / total, 10000)
        groups[k] = grp
    smooth_weights(o, 3)
    return o


def smooth_weights(o, repeat):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=.5,
                                       repeat=repeat, expand=0)
    bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=.002)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL",
                                              lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def transfer_weights(target, source):
    """Skin a shell laid on the suit from the suit's own weights."""
    for grp in source.vertex_groups:
        if grp.name not in target.vertex_groups:
            target.vertex_groups.new(name=grp.name)
    mod = target.modifiers.new("Suit weights", "DATA_TRANSFER")
    mod.object = source
    mod.use_vert_data = True
    mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"
    mod.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    smooth_weights(target, 1)


def boot_weights(o, s):
    side = "L" if s < 0 else "R"
    n = len(o.data.vertices)
    co = np.empty(n * 3)
    o.data.vertices.foreach_get("co", co)
    z = co.reshape(-1, 3)[:, 2]
    shin = ss(.105, .175, z)
    for name, w in ((f"knee{side}", shin), (f"foot{side}", 1 - shin)):
        grp = o.vertex_groups.get(f"{R}.{name}") or o.vertex_groups.new(name=f"{R}.{name}")
        add_weights(grp, w, 10000)


def skin(o, rig):
    mod = o.modifiers.new("Cadet skin", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False
    o.parent = rig
    o.matrix_parent_inverse = rig.matrix_world.inverted()
    return o


def bone_attach(o, rig, name):
    kit.refresh()
    world = o.matrix_world.copy()
    o.parent, o.parent_type, o.parent_bone = rig, "BONE", f"{R}.{name}"
    o.matrix_world = world
    return o


FACE_NAMES = {"eye": "eye", "iris": "pupil", "brow": "brow"}


def attach_faces(pieces, rig):
    """Centred surface-frame controls for faces.ts: eyes (with their
    pupils as children), brows and mouth; lash lines stay fixed."""
    nodes = {}
    fixed = []
    groups = {}
    for o in pieces:
        feature = None
        for s, suffix in ((-1, "L"), (1, "R")):
            for stem, kind in FACE_NAMES.items():
                if o.name == f"{R}.{stem}-{s}":
                    feature = kind + suffix
        if o.name == f"{R}.mouth-line":
            feature = "mouth"
        if feature:
            groups[feature] = o
        else:
            fixed.append(o)
    for o in fixed:
        bone_attach(o, rig, "head")
    for name in ("eyeL", "eyeR", "browL", "browR", "mouth", "pupilL", "pupilR"):
        o = groups[name]
        kit.apply(o)
        kit.apply_transform(o)
        o.name = R + name
        pts = [v.co.copy() for v in o.data.vertices]
        lo = V(*(min(q[j] for q in pts) for j in range(3)))
        hi = V(*(max(q[j] for q in pts) for j in range(3)))
        centre, size = (lo + hi) / 2, hi - lo
        if name.startswith("pupil"):
            axes = nodes["eye" + name[-1]].matrix_world.to_3x3()
        else:
            normal = V(centre.x * 3, 1, 0).normalized()
            right = normal.cross(V(0, 0, 1)).normalized()
            axes = Matrix((right, normal, V(0, 0, 1))).transposed()
        frame = Matrix.Translation(centre) @ axes.to_4x4()
        o.data.transform(frame.inverted())
        o.matrix_world = frame
        if name.startswith("pupil"):
            o.parent = nodes["eye" + name[-1]]
        else:
            o.parent, o.parent_type, o.parent_bone = rig, "BONE", f"{R}.head"
        o.matrix_world = frame
        o["faceWidth"] = max(.006, size.x)
        o["faceHeight"] = max(.003, size.z)
        nodes[name] = o
        kit.refresh()
    rig["faceContract"] = "archerseyeL/R -> archerspupilL/R; archersbrowL/R; archersmouth"


def look_node(rig, look, pieces, shown):
    node = bpy.data.objects.new(f"{R}.look{look}", None)
    bpy.context.collection.objects.link(node)
    node.location = HEAD_C
    kit.refresh()
    bone_attach(node, rig, "head")
    for o in pieces:
        kit.refresh()
        world = o.matrix_world.copy()
        o.parent = node
        o.matrix_world = world
    if not shown:
        node.scale = (1e-4, 1e-4, 1e-4)
    node["cadetLook"] = {"A": "him", "B": "her"}[look]
    return node


# ------------------------------------------------------------- assembly

def surface_finish():
    """Studio-render surfaces for the master: glass that transmits, cloth
    with a fine weave, a soft skin sheen. The game uses its own families."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        family = m.name.split(":")[0]
        if family == "glass":
            bsdf.inputs["Transmission Weight"].default_value = 1
            bsdf.inputs["Roughness"].default_value = .02
            bsdf.inputs["IOR"].default_value = 1.45
            bsdf.inputs["Alpha"].default_value = .35
            m.surface_render_method = "BLENDED"
        elif family == "skin":
            bsdf.inputs["Subsurface Weight"].default_value = .06
            bsdf.inputs["Subsurface Radius"].default_value = (.006, .003, .002)
        elif family == "weave":
            bsdf.inputs["Sheen Weight"].default_value = .25
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        layer = o.data.color_attributes.get("AO") or o.data.color_attributes.new(
            name="AO", type="FLOAT_COLOR", domain="CORNER")
        layer.data.foreach_set("color", np.ones(len(layer.data) * 4, dtype=np.float32))


def build_master(look="A", both=True):
    import figure_archers_parts as P
    root = kit.empty(R)
    body = suit()
    gun_m = P.gun_rest_matrix()
    rig = make_rig(root, gun_m @ V(0, 0, 0))
    suit_weights(body, rig)
    skin(body, rig)
    shells = panels(body) + joints_rubber()
    for o in shells:
        transfer_weights(o, body)
        skin(o, rig)
    for s in (-1, 1):
        boot = P.boot_shell(s)
        soles = P.boot_sole(s)
        for o in [boot] + soles:
            boot_weights(o, s)
            skin(o, rig)
    # Hard parts on their bones.
    for o in P.neck_ring() + [P.bubble()] + P.chest_unit() + P.pack():
        bone_attach(o, rig, "chest")
    for o in P.belt():
        bone_attach(o, rig, "torso")
    for o in P.antenna():
        bone_attach(o, rig, "antenna")
    left, right = P.gloves()
    bone_attach(left, rig, "handL")
    bone_attach(right, rig, "handR")
    for o in P.ray_gun():
        o.data.transform(gun_m)
        bone_attach(o, rig, "weapon")
    muzzle = bpy.data.objects.new(f"{R}.muzzle", None)
    bpy.context.collection.objects.link(muzzle)
    muzzle.location = gun_m @ (P.MUZZLE * P.GUN_SCALE)
    kit.refresh()
    bone_attach(muzzle, rig, "weapon")
    for name in ("A", "B") if both else (look,):
        look_node(rig, name, P.look_pieces(name), shown=name == look)
    attach_faces(P.face_features(), rig)
    surface_finish()
    root["masterBrief"] = "work/arena/2026-10-08-roster/archers/brief.md"
    root["unoptimized"] = True
    root["cadetLooks"] = "lookA him (shown), lookB her (scale 1e-4 until the runtime picks it)"
    kit.refresh()
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in kit.descendants(root) if o.type == "MESH")
    print(f"CADET MASTER: {tris} triangles, suit {len(body.data.polygons)} faces")
    return root
