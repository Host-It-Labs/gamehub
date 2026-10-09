"""Jetpack's private editable anatomical source, +Y forward / Z up.

This file builds the detailed source only. No reduction happens here. The
bind stance is natural: softly flexed elbows, hanging arms, palms inward.
All procedural forms, weights and hardware belong solely to Jetpack.
"""
import json
import math

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as fk

R = "jetpack"
TAU = math.tau
V = lambda *a: Vector(a[0] if len(a) == 1 else a)

SKIN = "skin:" + kit.tint("jetpack-sculpt-skin", "#e7ad83")
LIP = "skin:" + kit.tint("jetpack-sculpt-lips", "#a95548")
HAIR = "hair:" + kit.tint("jetpack-sculpt-bob", "#181d26")
HAIR_LIGHT = "hair:" + kit.tint("jetpack-sculpt-lock-light", "#303744")
SUIT = "weave:team"
SEAM = "weave:team2"
WHITE = "weave:" + kit.tint("jetpack-sculpt-white-panels", "#ece9dd")
SCARF = "drape:" + kit.tint("jetpack-sculpt-scarf", "#f2ede3")
GLOVE = "hide:" + kit.tint("jetpack-sculpt-gloves", "#efede6")
STITCH = "weave:" + kit.tint("jetpack-sculpt-stitch", "#c5c1b5")
SOLE = "hide:" + kit.tint("jetpack-sculpt-soles", "#373f4b")
HARNESS = "hide:" + kit.tint("jetpack-sculpt-harness", "#343e52")
CHROME = "chrome:" + kit.tint("jetpack-sculpt-chrome", "#d2d9df")
BRUSHED = "tin:" + kit.tint("jetpack-sculpt-brushed", "#8b97a3")
NOZZLE = "tin:" + kit.tint("jetpack-sculpt-nozzle", "#4b5564")
GLASS = "glass:" + kit.tint("jetpack-sculpt-bubble", "#e5f2f4")
INK = "resin:" + kit.tint("jetpack-sculpt-dark", "#24212a")
EYE = "resin:" + kit.tint("jetpack-sculpt-eye-ivory", "#f6ebd6")
IRIS = "resin:" + kit.tint("jetpack-sculpt-iris", "#70412b")
CYAN = "glow:" + kit.tint("jetpack-sculpt-emitter", "#74e4ff")
FLAME_EDGE = "glow:" + kit.tint("jetpack-sculpt-flame-edge", "#ff6414")
FLAME = "glow:" + kit.tint("jetpack-sculpt-flame", "#ffc52e")
HOT = "glow:" + kit.tint("jetpack-sculpt-hot-core", "#fff2bd")

WAIST, CHEST = V(0, 0, .662), V(0, -.004, .875)
NECK, HEAD = V(0, -.005, 1.035), V(0, -.005, 1.066)
SH = {s: V(s * .169, -.006, .984) for s in (-1, 1)}
EL = {s: V(s * .205, .006, .752) for s in (-1, 1)}
WR = {s: V(s * .215, .058, .536) for s in (-1, 1)}
HIP = {s: V(s * .082, 0, .629) for s in (-1, 1)}
KNEE = {s: V(s * .092, .020, .374) for s in (-1, 1)}
ANKLE = {s: V(s * .102, .029, .092) for s in (-1, 1)}
BUBBLE_CENTER = V(0, -.004, 1.207)
BUBBLE_RADIUS = .168
# Preserve the upper bubble and native height; only its clear lower skirt
# extends to the shoulder ring. The hat/head rig pivots do not move.
HELMET_SEAT_Z = 1.023
HELMET_SEAL_Z = HELMET_SEAT_Z - .008
HELMET_SKIRT_START = 2.03
TANK_Y, TANK_X, NOZZLE_Z = -.193, .074, .695

BODY = [(.536, .091, .079, .080), (.565, .114, .086, .094),
        (.620, .127, .092, .100), (.666, .119, .088, .095),
        (.721, .112, .084, .090), (.779, .120, .090, .094),
        (.832, .137, .110, .096), (.881, .145, .113, .100),
        (.920, .151, .104, .101), (.961, .146, .087, .090),
        (.984, .132, .071, .076), (1.010, .087, .048, .057),
        (1.047, .043, .037, .043)]
FACE = [(1.068, .014, .026, .035), (1.079, .040, .052, .052),
        (1.096, .061, .074, .063), (1.113, .073, .076, .070),
        (1.134, .085, .080, .080), (1.155, .090, .078, .087),
        (1.180, .091, .074, .090), (1.207, .089, .075, .087),
        (1.233, .086, .074, .083), (1.259, .075, .060, .074),
        (1.282, .050, .036, .051),
        (1.293, .007, .007, .009)]


def g(x, centre, radius):
    return math.exp(-((x - centre) / radius) ** 2)


def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def profile(rows, x):
    """Monotone cubic sections; no abrupt ring-power changes or shelves."""
    if x <= rows[0][0]:
        return tuple(rows[0][1:])
    if x >= rows[-1][0]:
        return tuple(rows[-1][1:])
    for i in range(len(rows) - 1):
        a, b = rows[i:i + 2]
        if x > b[0]:
            continue
        t, span = (x - a[0]) / (b[0] - a[0]), b[0] - a[0]
        previous, following = rows[max(0, i - 1)], rows[min(len(rows) - 1, i + 2)]
        result = []
        for k in range(1, len(a)):
            slope = (b[k] - a[k]) / span
            m0 = (b[k] - previous[k]) / (b[0] - previous[0])
            m1 = (following[k] - a[k]) / (following[0] - a[0])
            m0 = math.copysign(min(abs(m0), abs(slope) * 2), slope) if m0 * slope > 0 else 0
            m1 = math.copysign(min(abs(m1), abs(slope) * 2), slope) if m1 * slope > 0 else 0
            result.append((2 * t ** 3 - 3 * t ** 2 + 1) * a[k] +
                          (t ** 3 - 2 * t ** 2 + t) * m0 * span +
                          (-2 * t ** 3 + 3 * t ** 2) * b[k] +
                          (t ** 3 - t ** 2) * m1 * span)
        return tuple(result)


def curve(points, samples=12):
    # kit.smooth_path returns plain tuples; the forms below do vector maths.
    return [Vector(p) for p in kit.smooth_path(points, samples=samples)]


def tag(obj, budget, region):
    obj["runtimeTriangles"] = int(budget)
    obj["sourceRegion"] = region
    return obj


def join(parts, name, budget, region):
    return tag(kit.join(parts, name), budget, region)


def union(parts, name, material, voxel=.0019):
    """Connected sculpt, not a row of colliding limb primitives."""
    for obj in parts:
        kit.apply(obj)
        kit.apply_transform(obj)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
    obj = kit.join(parts, name)
    mod = obj.modifiers.new("Connected authored source", "REMESH")
    mod.mode, mod.voxel_size, mod.use_smooth_shade = "VOXEL", voxel, True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("Restrained seam relaxation", "SMOOTH")
    mod.factor, mod.iterations = .19, 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.assign(obj, material)
    kit.shade(obj, 72)
    return obj


def body_point(a, z, extra=0):
    width, front, back = profile(BODY, z)
    sn, cs = math.sin(a), math.cos(a)
    x = math.copysign(abs(sn) ** .88, sn) * (width + extra)
    y = math.copysign(abs(cs) ** .88, cs) * ((front if cs >= 0 else back) + extra)
    angle = abs((math.degrees(a) + 180) % 360 - 180)
    if angle < 90:
        y += .007 * g(angle, 27, 19) * g(z, .864, .049)
        y -= .0025 * g(angle, 0, 11) * g(z, .868, .100)
        y += .0030 * g(angle, 31, 23) * g(z, .983 - angle * .00045, .009)
        y -= .0021 * g(angle, 50 + (z - .80) * 100, 5) * g(z, .839, .052)
    # Folds concentrate at the belt and loaded side seams.
    y += cs * (.0020 * math.sin(a * 7 + z * 42) * g(z, .706, .024) +
               .0016 * math.sin(a * 6 - z * 22) * g(angle, 65, 19) * g(z, .826, .075))
    return V(x, y, z)


def torso():
    rows = [[body_point(i / 112 * TAU, float(z)) for i in range(112)]
            for z in np.linspace(.536, 1.047, 122)]
    return fk.loft(R + ".source-torso", rows, SUIT, start="pole", end="pole")


def sleeve(s):
    sh, el, wr = SH[s], EL[s], WR[s]
    path = curve([sh + V(-s * .023, 0, .003), sh + V(s * .006, 0, -.032),
                  (sh + el) / 2, el, (el + wr) / 2, wr + V(0, 0, -.015)], 24)
    radii = []
    for i in range(len(path)):
        t = i / (len(path) - 1)
        w = profile([(0, .049), (.12, .047), (.27, .041), (.46, .035),
                     (.53, .036), (.68, .038), (.83, .030), (1, .024)], t)[0]
        radii.append((w, w * (.94 + .06 * g(t, .48, .11))))
    rows = fk.rings_along(path, radii, n=64, up=(0, 1, 0))
    for j, row in enumerate(rows):
        t = j / (len(rows) - 1)
        for i, p in enumerate(row):
            angle = i / 64 * TAU
            normal = (p - path[j]).normalized()
            fold = .0027 * math.sin(angle * 5 - t * 19) * g(t, .51, .075)
            fold += .0017 * math.sin(angle * 6 + t * 10) * g(t, .82, .085)
            row[i] = p + normal * fold
            if t < .19:
                # The upper deltoid slopes away from the neck. A circular
                # first tube ring otherwise grows an elevated pointed cap
                # above the shoulder and recreates the toy's robot socket.
                top = 1.048 - .31 * abs(row[i].x)
                if row[i].z > top:
                    share = float(1 - ss(.10, .19, t))
                    row[i].z -= (row[i].z - top) * .88 * share
            # The medial sleeve meets the chest only at the actual deltoid.
            # A hanging sleeve cannot fuse to the flank down to the elbow.
            if .778 < p.z < .942:
                boundary = profile(BODY, p.z)[0] + .009
                share = float(ss(.946, .915, p.z)) * float(ss(.771, .807, p.z))
                if row[i].x * s < boundary:
                    row[i].x = s * (row[i].x * s * (1 - share) + boundary * share)
    return fk.loft(R + f".source-sleeve{s}", rows, SUIT, start="pole", end="pole")


def trouser(s):
    h, k, a = HIP[s], KNEE[s], ANKLE[s]
    path = curve([h + V(0, 0, .031), (h + k) / 2, k, (k + a) / 2,
                  a + V(0, 0, .002)], 24)
    radii = []
    for i in range(len(path)):
        t = i / (len(path) - 1)
        w = profile([(0, .066), (.15, .067), (.31, .056), (.47, .043),
                     (.53, .041), (.65, .047), (.78, .037), (1, .027)], t)[0]
        radii.append((w, w * (.95 + .06 * g(t, .10, .15))))
    rows = fk.rings_along(path, radii, n=64, up=(1, 0, 0))
    for j, row in enumerate(rows):
        t = j / (len(rows) - 1)
        for i, p in enumerate(row):
            a = i / 64 * TAU
            relief = .0021 * math.sin(a * 5 + t * 23) * g(t, .50, .066)
            relief += .0016 * math.sin(a * 7 - t * 20) * g(t, .10, .085)
            row[i] = p + (p - path[j]).normalized() * relief
    return fk.loft(R + f".source-trouser{s}", rows, SUIT, start="pole", end="pole")


def suit_panels():
    """Sewn, shaped white panels follow the anatomy rather than a new shell."""
    out = []
    for s in (-1, 1):
        def panel(u, v, s=s):
            z = .702 + v * .264
            angle = s * (.50 + u * .54 + .14 * math.sin(v * math.pi))
            return body_point(angle, z, .0032)
        out.append(fk.sheet(R + f".white-side-panel{s}", panel,
                            np.linspace(0, 1, 18), np.linspace(0, 1, 42), WHITE,
                            rim=.0018, inside=V(0, 0, .842)))
        # Curved white shoulder flash sits flat over the fitted fabric.
        def shoulder_panel(u, v, s=s):
            angle = s * (.13 + u * .89)
            z = .941 + .030 * v - .021 * u
            return body_point(angle, z, .0038)
        out.append(fk.sheet(R + f".white-shoulder-panel{s}", shoulder_panel,
                            np.linspace(0, 1, 24), np.linspace(0, 1, 8), WHITE,
                            rim=.0015, inside=V(0, 0, .948)))
        points = [body_point(s * (.50 + .14 * math.sin(v * math.pi)),
                             .702 + v * .264, .0049) for v in np.linspace(0, 1, 50)]
        out.append(fk.tube(R + f".panel-seam{s}", points, [.0010] * len(points),
                           STITCH, n=6, caps=("dome", "dome")))
        path = curve([body_point(s * .52, .768, .016),
                      body_point(s * .56, .893, .016),
                      V(s * .093, -.008, .996), V(s * .094, -.092, .967),
                      V(s * .086, -.137, .873), V(s * .080, -.137, .738)], 14)
        out.append(fk.tube(R + f".pack-strap{s}", path,
                           [(.013, .004)] * len(path), HARNESS, n=8, up=(1, 0, 0)))
        out.append(fk.rbox(R + f".strap-buckle{s}", (.031, .011, .031),
                           body_point(s * .54, .812, .021), BRUSHED, levels=1, crease=.9))
    belt = [[body_point(i / 96 * TAU, z, .008) for i in range(96)]
            for z in (.650, .657, .679, .686)]
    out.append(fk.loft(R + ".white-belt", belt, GLOVE))
    # A shallow circular buckle with a rim, recessed centre and fastening.
    ctr = body_point(0, .669, .013)
    points = [ctr + V(math.sin(a) * .031, .001, math.cos(a) * .031)
              for a in np.linspace(0, TAU, 64, endpoint=False)]
    out.append(fk.tube(R + ".belt-buckle-rim", points + [points[0]], [.0033] * 65,
                       CHROME, n=10, up=(0, 1, 0)))
    out.append(fk.ball(R + ".belt-buckle-disc", 1, ctr, BRUSHED,
                       scale=(.028, .005, .028), seg=40, rings=20))
    zip_path = [body_point(0, z, .0033) for z in np.linspace(.699, .979, 40)]
    out.append(fk.tube(R + ".zipper-seam", zip_path, [.0013] * 40, SEAM, n=6))
    out.append(fk.rbox(R + ".zipper-pull", (.005, .003, .013),
                       body_point(0, .964, .006), BRUSHED, levels=1, crease=.8))
    return tag(kit.join(out, R + ".tailored-details"), 1800, "weighted cloth panels and harness")


def hand_frame(s):
    down = (WR[s] - EL[s]).normalized()
    palm = V(-s, 0, 0)
    palm = (palm - down * palm.dot(down)).normalized()
    across = down.cross(palm).normalized()
    return down, palm, across


def grip_position():
    """Keep the reviewed prop/rest-bone frame unchanged for shared reach."""
    down, palm, _ = hand_frame(1)
    return WR[1] + down * .043 + palm * .022


def glove_digit_path(s, finger):
    down, palm, across = hand_frame(s)
    # The index is on the thumb/forward side, not on the little-finger edge.
    offset = s * (.0225 - finger * .015)
    base = WR[s] + across * offset
    if s > 0:
        # Each phalanx wraps the actual grip section at down=.043,
        # palm=.022. The exposed proximal joints start beyond the palm pad.
        radius = [.0063, .0066, .0062, .0054][finger]
        bend = .043 + .0115 + radius * .95
        shape = [(.028, -.003), (.042, -.001), (bend, .009),
                 (bend, .025), (.050, .041), (.040, .040)]
    else:
        length = [.038, .043, .040, .031][finger]
        shape = [(.029, -.003), (.041, .000),
                 (.036 + length * .56, .006),
                 (.036 + length * .86, .015),
                 (.036 + length * .89, .021)]
    return curve([base + down * t + palm * p for t, p in shape], 9)


def glove_digit_radii(count, finger):
    radius = [.0063, .0066, .0062, .0054][finger]
    result = []
    for j in range(count):
        t = j / (count - 1)
        joint = 1 + .10 * g(t, .32, .10) + .07 * g(t, .62, .08)
        # Flexion creases divide the phalanges without slicing the glove.
        crease = 1 - .09 * g(t, .41, .025) - .07 * g(t, .72, .022)
        result.append((radius * (1 - .20 * t) * joint * crease,
                       radius * .91 * (1 - .15 * t) * crease))
    return result


def glove_thumb_path(s):
    down, palm, across = hand_frame(s)
    # A distinct metacarpal and opposed tip, with a real web beside the index.
    if s > 0:
        shape = [(.004, .018, .006), (.016, .031, .015),
                 (.031, .037, .030), (.039, .030, .043),
                 (.031, .014, .036)]
    else:
        shape = [(.004, .018, .006), (.015, .034, .009),
                 (.036, .037, .015), (.050, .030, .023),
                 (.053, .021, .026)]
    return curve([WR[s] + down * t + across * (s * a) + palm * p
                  for t, a, p in shape], 10)


def glove(s):
    """A constructed gauntlet, shaped palm/thenar and five actual digits."""
    down, palm, across = hand_frame(s)
    wrist = WR[s]
    rows = []
    sections = [(-.066, .032, .029), (-.048, .034, .030),
                (-.038, .029, .026), (-.006, .022, .019),
                (.012, .026, .018), (.024, .030, .0185),
                (.032, .0275, .016), (.039, .0225, .012), (.043, .017, .0075)]
    for t in np.linspace(-.066, .043, 54):
        w, depth = profile(sections, float(t))
        row = []
        for i in range(56):
            a = i / 56 * TAU
            # Four small metacarpal ridges, not one broad mitten/paddle cap.
            knuckle = .0018 * g(float(t), .028, .008) * abs(math.sin(a)) ** 6
            thenar = .0035 * g(float(t), .014, .017) * max(0, s * math.sin(a)) ** 5
            cuff = .0018 * g(float(t), -.049, .004)
            flexion = -.0008 * g(float(t), .018 + .005 * math.sin(a), .0025)
            row.append(wrist + down * t + across * math.sin(a) * (w + knuckle + cuff) +
                       palm * math.cos(a) * (depth + thenar + cuff + flexion))
        rows.append(row)
    pieces = [fk.loft(R + f".glove-palm-source{s}", rows, GLOVE, start="pole", end="pole")]
    seams = []
    for finger in range(4):
        pts = glove_digit_path(s, finger)
        radius = [.0063, .0066, .0062, .0054][finger]
        rr = glove_digit_radii(len(pts), finger)
        pieces.append(fk.tube(R + f".glove-digit-source{s}-{finger}", pts, rr, GLOVE,
                              n=22, up=across, caps=("dome", "dome")))
        seam_pts = [p - palm * radius * .94 for p in pts[3:len(pts) // 2]]
        seams.append(fk.tube(R + f".glove-digit-seam{s}-{finger}", seam_pts,
                             [.0006] * len(seam_pts), STITCH, n=6))
    pts = glove_thumb_path(s)
    pieces.append(fk.tube(R + f".glove-thumb-source{s}", pts,
                          [(profile([(0, .0093, .0083), (.25, .010, .009),
                                     (.55, .0083, .0074), (1, .0059, .0055)],
                                    j / (len(pts) - 1))) for j in range(len(pts))],
                          GLOVE, n=24, up=across))
    # Fine voxel size preserves the spaces between individual fingers.
    glove_mesh = tag(union(pieces, R + f".anatomical-glove{s}", GLOVE, .00085),
                     1650, "glove and separated digits")
    cuff = [wrist + down * -.051 + across * math.sin(i / 56 * TAU) * .0347 +
            palm * math.cos(i / 56 * TAU) * .0306 for i in range(56)]
    seams.append(fk.tube(R + f".glove-cuff-stitch{s}", cuff + [cuff[0]], [.0007] * 57,
                         STITCH, n=6))
    return glove_mesh, tag(kit.join(seams, R + f".glove-stitches{s}"), 110, "glove stitching")


def boot(s):
    ankle = ANKLE[s]
    rows = []
    for z, w, depth, cy in [(0, .050, .100, .046), (.010, .051, .104, .047),
                           (.027, .049, .102, .047), (.047, .046, .096, .046),
                           (.072, .039, .065, .027), (.096, .030, .034, .023)]:
        rows.append([V(ankle.x + math.copysign(abs(math.sin(a)) ** .73, math.sin(a)) * w,
                       cy + math.copysign(abs(math.cos(a)) ** .72, math.cos(a)) * depth, z)
                     for a in np.linspace(0, TAU, 72, endpoint=False)])
    foot = fk.loft(R + f".boot-foot{s}", rows, GLOVE, start="flat", end="pole",
                   bands={0: SOLE, 1: SOLE})
    zs = np.linspace(.066, .246, 48)
    shaft = fk.tube(R + f".boot-shaft{s}", [V(ankle.x, .018, z) for z in zs],
                    [(profile([(.066, .032, .033), (.102, .031, .032),
                               (.161, .040, .039), (.223, .042, .037),
                               (.246, .039, .035)], float(z))) for z in zs],
                    GLOVE, n=56, up=(1, 0, 0), caps=(None, "flat"))
    # Cloth/boot cuff is intentionally overlapped, with a fitted welt.
    rim = [V(ankle.x + math.sin(a) * .040, .018 + math.cos(a) * .036, .243)
           for a in np.linspace(0, TAU, 56, endpoint=False)]
    trim = fk.tube(R + f".boot-cuff{s}", rim + [rim[0]], [.0014] * 57, STITCH,
                   n=8, caps=(None, None))
    seam = [V(p.x, p.y, .030) for p in rows[2]]
    welt = fk.tube(R + f".boot-welt{s}", seam + [seam[0]], [.0010] * 73, STITCH, n=6)
    # The sculpted heel is load-bearing; the toe is longer and flatter.
    heel = fk.rbox(R + f".boot-heel{s}", (.068, .052, .020),
                    V(ankle.x, -.025, .015), SOLE, levels=2, crease=.6)
    return tag(kit.join([foot, shaft, trim, welt, heel], R + f".constructed-boot{s}"),
               800, "sole heel instep and boot shaft")


def face_point(a, z, extra=0):
    width, front, back = profile(FACE, z)
    sn, cs = math.sin(a), math.cos(a)
    x = math.copysign(abs(sn) ** .90, sn) * (width + extra)
    y = -.005 + math.copysign(abs(cs) ** .90, cs) * ((front if cs >= 0 else back) + extra)
    angle = abs((math.degrees(a) + 180) % 360 - 180)
    if angle < 90:
        # Convex forehead/oral/chin sections establish the face first.
        # A low broad bridge and short rounded tip sit on that volume;
        # they no longer form a sharp beak in front of recessed lips.
        y += .0034 * g(z, 1.216, .015) * g(abs(x), .039, .026)
        y -= .0031 * g(z, 1.192, .013) * g(abs(x), .039, .023)
        y += .0062 * g(z, 1.190, .027) * g(x, 0, .016)
        y += .0033 * g(z, 1.175, .019) * g(x, 0, .011)
        y += .0170 * g(z, 1.162, .0118) * g(x, 0, .017)
        y += .0051 * g(z, 1.158, .0085) * g(abs(x), .015, .007)
        y += .0027 * g(z, 1.152, .0055) * g(x, 0, .005)
        y -= .0016 * g(z, 1.1518, .0028) * g(abs(x), .0118, .0038)
        y += .0075 * g(z, 1.173, .022) * g(abs(x), .052, .025)
        y -= .0024 * g(z, 1.139, .023) * g(abs(x), .065, .019)
        # Full lips grow from a forward oral mound, not a floating mask.
        y += .0034 * g(z, 1.136, .017) * g(x, 0, .037)
        y += .0015 * g(z, 1.147, .0065) * g(abs(x), .0050, .0030)
        y -= .0011 * g(z, 1.147, .0065) * g(x, 0, .0028)
        y += .0047 * g(z, 1.098, .0135) * g(x, 0, .037)
        # The lower-lip break and forward chin carry a readable jaw.
        y -= .0027 * g(z, 1.116, .0060) * g(x, 0, .030)
    return V(x, y, z)


def face_normal(a, z):
    du = face_point(a + .001, z) - face_point(a - .001, z)
    dz = face_point(a, z + .0001) - face_point(a, z - .0001)
    normal = du.cross(dz).normalized()
    if normal.dot(face_point(a, z) - V(0, -.005, 1.19)) < 0:
        normal = -normal
    return normal


def front_angle(x, z):
    width = profile(FACE, z)[0]
    sn = min(.999999, (abs(x) / max(.001, width)) ** (1 / .90))
    return math.copysign(math.asin(sn), x)


def front_surface(x, z, lift=0):
    a = front_angle(x, z)
    return face_point(a, z) + face_normal(a, z) * lift


def adult_head():
    rows = [[face_point(i / 144 * TAU, float(z)) for i in range(144)]
            for z in np.linspace(FACE[0][0], FACE[-1][0], 130)]
    skull = fk.loft(R + ".source-adult-face", rows, SKIN, start="pole", end="pole")
    rows = [[V(math.sin(a) * w, -.005 + math.cos(a) * d, z)
             for a in np.linspace(0, TAU, 72, endpoint=False)]
            for z, w, d in [(float(z), *profile([(1.005, .037, .036),
                                                 (1.045, .032, .031),
                                                 (1.081, .029, .034),
                                                 (1.111, .031, .039)], float(z)))
                            for z in np.linspace(1.005, 1.111, 52)]]
    neck = fk.loft(R + ".source-neck", rows, SKIN, start="pole", end="pole")
    mesh = tag(union([skull, neck], R + ".adult-head-skin", SKIN, .0012),
               4400, "adult face nasal chin orbital planes and neck")
    ears = []
    for s in (-1, 1):
        rows = []
        for radius in np.linspace(.001, 1, 28):
            row = []
            for a in np.linspace(0, TAU, 56, endpoint=False):
                helix = .0075 * g(float(radius), .81, .12) * (1 + .22 * math.cos(a))
                antihelix = .0030 * g(float(radius), .45, .13)
                row.append(V(s * (.087 + helix + antihelix),
                             -.014 + math.sin(a) * .014 * radius,
                             1.184 + math.cos(a) * .026 * radius))
            rows.append(row)
        ears.append(fk.loft(R + f".ear{s}", rows, SKIN, start="pole", end="pole"))
    return mesh, tag(kit.join(ears, R + ".ears"), 180, "ears helix and ear cup")


def face_patch(name, a, z, width, height, material, lift=.002, slant=0):
    mesh = fk.Mesh(name, material)
    centre = mesh.v(face_point(a, z) + face_normal(a, z) * lift)
    rows = []
    for radius in (.16, .34, .55, .77, 1):
        row = []
        for i in range(48):
            t = i / 48 * TAU
            dx, dz = math.cos(t) * width * radius, math.sin(t) * height * radius
            aa = a + dx / max(.060, profile(FACE, z)[0])
            zz = z + dz + slant * dx
            row.append(mesh.v(face_point(aa, zz) + face_normal(aa, zz) *
                              (lift + .0002 * (1 - radius * radius))))
        rows.append(row)
    for i in range(48):
        mesh.face([centre, rows[0][i], rows[0][(i + 1) % 48]])
    mesh.grid(rows, closed=True)
    return mesh.obj(outward=V(0, -.005, 1.19))


EYE_WIDTH, EYE_UPPER, EYE_LOWER = .0190, .0066, .0044


def eye_surface(s, u, v):
    """Convex globe under an asymmetric almond aperture, not a skull decal."""
    x = s * .0385 + u * EYE_WIDTH
    z = 1.193 + s * .105 * u * EYE_WIDTH + v * (EYE_UPPER if v >= 0 else EYE_LOWER)
    dome = max(0, 1 - u * u - v * v)
    return front_surface(x, z, .0015 + .0058 * dome)


def eye_dome(s, suffix):
    mesh = fk.Mesh(R + "eye" + suffix, EYE)
    centre = mesh.v(eye_surface(s, 0, 0))
    rows = []
    for radius in (.14, .29, .45, .60, .74, .87, 1):
        rows.append([mesh.v(eye_surface(s, math.cos(a) * radius, math.sin(a) * radius))
                     for a in np.linspace(0, TAU, 64, endpoint=False)])
    for i in range(64):
        mesh.face([centre, rows[0][i], rows[0][(i + 1) % 64]])
    mesh.grid(rows, closed=True)
    return tag(mesh.obj(outward=V(0, -.005, 1.19)), 160, "live convex almond eye")


def eye_disc(name, s, dx, dz, rx, rz, material, lift):
    mesh = fk.Mesh(name, material)

    def point(x, z):
        u = x / EYE_WIDTH
        v = z / (EYE_UPPER if z >= 0 else EYE_LOWER)
        p = eye_surface(s, u, v)
        return p + V(0, lift, 0)

    centre = mesh.v(point(dx, dz))
    rows = []
    for radius in (.22, .44, .65, .83, 1):
        rows.append([mesh.v(point(dx + math.cos(a) * rx * radius,
                                 dz + math.sin(a) * rz * radius))
                     for a in np.linspace(0, TAU, 40, endpoint=False)])
    for i in range(40):
        mesh.face([centre, rows[0][i], rows[0][(i + 1) % 40]])
    mesh.grid(rows, closed=True)
    return mesh.obj(outward=V(0, -.005, 1.19))


def lid_surface(s, upper, u, v):
    sign = 1 if upper else -1
    arch = math.sqrt(max(0, 1 - u * u))
    x = s * .0385 + u * EYE_WIDTH
    z = 1.193 + s * .105 * u * EYE_WIDTH + sign * arch * (EYE_UPPER if upper else EYE_LOWER)
    z += sign * v * (.0016 + arch * (.0072 if upper else .0044))
    # The flesh rim rolls out from the globe then blends to the orbital skin.
    lift = .0018 * (1 - v) + (.0036 if upper else .0027) * math.sin(math.pi * v) * arch
    return front_surface(x, z, lift + .00045 * v)


def mouth_seam(u):
    return 1.1348 + .0006 * (1 - u * u) - .0008 * g(u, -.85, .24)


def lip_surface(upper, u, v):
    arc = max(0, 1 - u * u) ** .65
    gap = .00115 * arc
    if upper:
        # Cupid's bow has two lobes and a small central notch.
        height = .0062 * arc * (1 - .25 * g(u, 0, .20))
        z = mouth_seam(u) + gap + height * v
    else:
        height = .0075 * arc
        z = mouth_seam(u) - gap - height * v
    lift = arc * (.0043 * (1 - v) + .0051 * math.sin(math.pi * v)) + .0005
    return front_surface(.024 * u, z, lift)


def facial_features():
    controls, fixed = {}, []
    for s, suffix in ((-1, "L"), (1, "R")):
        controls["eye" + suffix] = eye_dome(s, suffix)
        pupil_parts = [eye_disc(R + ".iris" + suffix, s, s * .0003, -.00025,
                               .0062, .0040, IRIS, .0004),
                       eye_disc(R + ".pupil" + suffix, s, s * .0003, -.00025,
                                .0031, .0031, INK, .00075),
                       eye_disc(R + ".eye-shine" + suffix, s, -.0018, .0019,
                                .0010, .0010, EYE, .0011)]
        controls["pupil" + suffix] = join(pupil_parts, R + "pupil" + suffix, 100, "live domed iris and pupil")
        brow = [(s * .0165, 1.2060), (s * .029, 1.2100),
                (s * .045, 1.2160), (s * .060, 1.2150), (s * .067, 1.2110)]
        points = curve([front_surface(x, z, .0020) for x, z in brow], 9)
        radii = [(.0028 * (.55 + .45 * math.sin(math.pi * i / (len(points) - 1))),
                  .0016 * (.50 + .50 * math.sin(math.pi * i / (len(points) - 1))))
                 for i in range(len(points))]
        controls["brow" + suffix] = tag(fk.tube(R + "brow" + suffix, points, radii,
                                               HAIR, n=10), 95, "live curved tapered focused brow")
        for upper in (True, False):
            fixed.append(fk.sheet(R + f".skin-lid{s}-{upper}",
                                  lambda u, v, s=s, upper=upper: lid_surface(s, upper, u, v),
                                  np.linspace(-1, 1, 42), np.linspace(0, 1, 12), SKIN,
                                  rim=.00065, inside=V(0, -.005, 1.19)))
            margin = [lid_surface(s, upper, float(u), 0) + V(0, .00055, 0)
                      for u in np.linspace(-.99, .99, 52)]
            fixed.append(fk.tube(R + f".lid-margin{s}-{upper}", margin,
                                 [(.00060 if upper else .00038)] * len(margin),
                                 HAIR if upper else LIP, n=8))
        fixed.append(face_patch(R + f".nostril{s}", front_angle(s * .0118, 1.1518),
                                1.1518, .0023, .00105, INK, .00035))
    # The opening remains the live mouth control; the sculpted lip rolls
    # taper into the skin rather than becoming two floating ellipses.
    def opening(u, v):
        arc = max(0, 1 - u * u) ** .65
        return front_surface(.024 * u, mouth_seam(u) + v * .0013 * arc, .0038 * arc + .0006)

    controls["mouth"] = tag(fk.sheet(R + "mouth", opening,
                                    np.linspace(-1, 1, 40), np.linspace(-1, 1, 7), INK,
                                    rim=.0004, inside=V(0, -.005, 1.19)),
                            260, "live small firm mouth opening")
    for upper in (True, False):
        fixed.append(fk.sheet(R + (".upper-lip" if upper else ".lower-lip"),
                              lambda u, v, upper=upper: lip_surface(upper, u, v),
                              np.linspace(-1, 1, 42), np.linspace(0, 1, 14), LIP,
                              rim=.00065, inside=V(0, -.005, 1.19)))
    return controls, tag(kit.join(fixed, R + ".fixed-face-planes"), 800,
                         "skin eyelid folds nasal undersides and shaped lips")


BOB_CROWN_Z = 1.307
BOB_HAIRLINE = [(-180, 1.116), (-145, 1.113), (-100, 1.124),
                (-75, 1.156), (-50, 1.230), (-25, 1.251),
                (0, 1.254), (25, 1.260), (50, 1.239),
                (75, 1.162), (100, 1.127), (145, 1.119), (180, 1.116)]
# Each clump has its own curved volume and tip. The large swept fringe,
# two temple locks and two rear locks replace rows of identical stripes.
BOB_LOCKS = [
    ([(.040, .056, 1.281), (.018, .088, 1.273), (-.021, .097, 1.253),
      (-.058, .080, 1.234), (-.078, .048, 1.218)],
     [(0, .011, .004), (.30, .021, .007), (.58, .024, .0075),
      (.82, .017, .006), (1, .0015, .0006)], (0, 0, 1)),
    ([(.045, .065, 1.277), (.073, .059, 1.259), (.093, .025, 1.225),
      (.096, .017, 1.175), (.090, .023, 1.145)],
     [(0, .011, .004), (.27, .016, .007), (.58, .017, .008),
      (.82, .013, .007), (1, .0014, .0007)], (1, 0, 0)),
    ([(-.073, .026, 1.248), (-.098, .009, 1.216), (-.105, -.004, 1.177),
      (-.095, .005, 1.139), (-.079, .011, 1.123)],
     [(0, .012, .005), (.30, .017, .007), (.58, .017, .008),
      (.82, .013, .006), (1, .0016, .0007)], (1, 0, 0)),
    ([(.072, -.051, 1.272), (.103, -.069, 1.233), (.100, -.066, 1.184),
      (.079, -.060, 1.134), (.054, -.046, 1.112)],
     [(0, .013, .004), (.27, .020, .008), (.58, .023, .009),
      (.82, .016, .007), (1, .0016, .0007)], (0, 1, 0)),
    ([(-.033, -.080, 1.285), (-.081, -.095, 1.245), (-.104, -.064, 1.193),
      (-.085, -.060, 1.142), (-.064, -.036, 1.113)],
     [(0, .011, .004), (.27, .022, .008), (.58, .022, .009),
      (.82, .016, .007), (1, .0016, .0007)], (0, 1, 0)),
]


def bob_surface(a, t):
    """Rounded hair volume independent of nasal/cheek relief on the skin."""
    degrees = (math.degrees(a) + 180) % 360 - 180
    low = profile(BOB_HAIRLINE, degrees)[0]
    z = low * (1 - t) + BOB_CROWN_Z * t
    # The lower bob stays full before its rolled-under edge; a symmetric
    # skull ellipse would pinch the rear hair inside the jaw/occiput.
    latitude = (z - 1.204) / ((BOB_CROWN_Z - 1.204) if z >= 1.204 else .137)
    roundness = math.sqrt(max(0, 1 - latitude * latitude))
    sn, cs = math.sin(a), math.cos(a)
    # Only broad mass changes; there is no high-frequency combed relief.
    fullness = .0030 * math.sin(a * 3 - t * .9) * math.sin(math.pi * t)
    part_angle = .44 + .12 * t
    angular_distance = (a - part_angle + math.pi) % TAU - math.pi
    part = .0017 * g(angular_distance, 0, .047) * math.sin(math.pi * t) ** .55
    rx = .108 * roundness + fullness - part
    ry = (.099 if cs >= 0 else .118) * roundness + fullness - part
    return V(sn * rx, -.009 + cs * ry, z)


def bob_lock_path(k):
    return curve([V(p) for p in BOB_LOCKS[k][0]], 12)


def bob_lock_radii(k, count):
    return [profile(BOB_LOCKS[k][1], i / (count - 1)) for i in range(count)]


def bob():
    inner, edge = [], []
    for i in range(128):
        a = i / 128 * TAU
        degrees = (math.degrees(a) + 180) % 360 - 180
        low = profile(BOB_HAIRLINE, degrees)[0]
        inner.append(face_point(a, low, .0015))
        edge.append(bob_surface(a, 0) - V(0, 0, .0015))
    rows = [inner, edge] + [[bob_surface(i / 128 * TAU, float(t)) for i in range(128)]
            for t in np.linspace(0, .999, 70)]
    pieces = [fk.loft(R + ".rounded-bob-volume", rows, HAIR,
                      end=V(0, -.009, BOB_CROWN_Z))]
    for k, (_, _, up) in enumerate(BOB_LOCKS):
        path = bob_lock_path(k)
        pieces.append(fk.tube(R + f".volumetric-hair-lock{k}", path,
                              bob_lock_radii(k, len(path)), HAIR, n=28, up=up,
                              caps=("dome", "dome")))
    mesh = tag(kit.join(pieces, R + ".sculpted-bob"), 1000,
               "rounded side-part bob with five separate tapered locks")
    mesh["hairLockCount"], mesh["hairPartAngle"] = len(BOB_LOCKS), .44
    return mesh


def helmet_surface(a, theta):
    """Keep the approved upper bubble; lower its clear skirt to the ring."""
    end = math.acos((1.079 - BUBBLE_CENTER.z) / BUBBLE_RADIUS)
    skirt = float(ss(HELMET_SKIRT_START, end, theta)) * (1.079 - HELMET_SEAT_Z)
    return BUBBLE_CENTER + V(math.sin(a) * math.sin(theta) * BUBBLE_RADIUS,
                             math.cos(a) * math.sin(theta) * BUBBLE_RADIUS,
                             math.cos(theta) * BUBBLE_RADIUS - skirt)


def helmet():
    """A complete thin clear shell; opacity cannot be replaced by blue paint."""
    theta_end = math.acos((1.079 - BUBBLE_CENTER.z) / BUBBLE_RADIUS)
    rows = []
    for theta in np.linspace(.014, theta_end, 64):
        rows.append([helmet_surface(float(a), float(theta))
                     for a in np.linspace(0, TAU, 112, endpoint=False)])
    shell = fk.loft(R + ".clear-bubble-shell", rows, GLASS, start="pole")
    shell["noShadow"] = True
    shell["clearHelmet"] = True
    tag(shell, 850, "clear glass bubble silhouette")
    points = rows[-1]
    rim = fk.tube(R + ".helmet-chrome-collar", points + [points[0]], [.007] * 113,
                   CHROME, n=14, up=(0, 0, 1), caps=(None, None))
    seal = fk.tube(R + ".helmet-white-seal", [p - V(0, 0, .008) for p in points + [points[0]]],
                    [.006] * 113, GLOVE, n=12, up=(0, 0, 1), caps=(None, None))
    for s in (-1, 1):
        # Only physical helmet latches; no invented antenna in the portrait.
        latch = fk.rbox(R + f".helmet-latch{s}", (.021, .024, .014),
                        V(s * .110, -.004, HELMET_SEAT_Z - .004),
                        BRUSHED, levels=1, crease=.75)
        if s < 0:
            hardware = [rim, seal, latch]
        else:
            hardware.append(latch)
    return shell, tag(kit.join(hardware, R + ".helmet-hardware"), 480, "helmet collar and latches")


COLLAR_SECTIONS = [(1.001, .101, .093), (1.000, .112, .102),
                   (1.006, .116, .107), (1.013, .114, .109),
                   (1.018, .108, .108), (1.018, .072, .066),
                   (1.013, .046, .043), (1.004, .044, .041),
                   (.997, .075, .065)]


def collar_support():
    """Short rounded shoulder pad, with a chrome gasket above it.

    A broad horizontal annulus replaces the tall widening white funnel.
    Its medial underside overlaps the neckline while its lateral mass rests
    on the shoulders; the inner opening leaves the neck/scarf visible.
    """
    rows = []
    for j, (z, rx, ry) in enumerate(COLLAR_SECTIONS):
        row = []
        for a in np.linspace(0, TAU, 80, endpoint=False):
            fold = .00065 * math.cos(a * 5 + .7) if j < 5 else 0
            row.append(V(math.sin(a) * (rx + fold),
                         -.005 + math.cos(a) * (ry + fold), z))
        rows.append(row)
    rows.append([p.copy() for p in rows[0]])
    mesh = tag(fk.loft(R + ".padded-collar-support", rows, WHITE, levels=1),
               340, "short padded shoulder annulus beneath chrome helmet gasket")
    mesh["collarBaseZ"], mesh["collarSealZ"] = .997, HELMET_SEAL_Z
    mesh["collarTopZ"], mesh["helmetSeatZ"] = 1.018, HELMET_SEAT_Z
    return mesh


SCARF_FIRST_PATH = [(0, -.021, -.046, 1.043), (.075, -.017, -.039, 1.030),
                    (.13, -.018, -.039, 1.014), (.20, -.026, -.073, 1.000),
                    (.27, -.040, -.083, .984), (.43, -.124, -.083, .984),
                    (.64, -.150, -.127, 1.058), (.82, -.114, -.170, 1.115),
                    (1, -.021, -.170, 1.138)]
SCARF_FIRST_WIDTH = [(0, .020), (.075, .006), (.18, .006),
                     (.32, .018), (.50, .020), (1, .0152)]


def scarf_surface(link, u, v):
    if link == "cape":
        # The extended lower bubble needs the scarf to leave BELOW its
        # shoulder ring. A narrow tucked fold travels under that pad, then
        # the cloth goes round the left tank and rejoins the fixed cape2
        # pivot above both tank caps. No rig/attachment coordinate moves.
        cx, cy, cz = profile(SCARF_FIRST_PATH, v)
        width = profile(SCARF_FIRST_WIDTH, v)[0]
    else:
        cx, cy, cz = -.021, -.170 - .170 * v, 1.138 + .039 * v
        width = .020 * (1 - .24 * v)
    return V(cx + (u - .5) * 2 * width, cy,
             cz + .006 * math.sin(u * math.pi) * math.sin(v * math.pi) +
             .002 * math.sin(v * 7))


def scarf():
    # An actual folded neck band with one short, two-link flowing tail.
    rows = []
    for z in np.linspace(1.023, 1.067, 16):
        row = []
        for a in np.linspace(0, TAU, 64, endpoint=False):
            radius = .045 + .009 * math.sin((z - 1.023) / .044 * math.pi)
            fold = .0015 * math.cos(a * 7 + z * 82)
            row.append(V(math.sin(a) * (radius + fold),
                         -.005 + math.cos(a) * (radius + fold), z))
        rows.append(row)
    band = fk.loft(R + ".scarf-neck-folds", rows, WHITE)
    knot = fk.rbox(R + ".scarf-knot", (.036, .026, .040),
                   V(-.028, -.037, 1.045), WHITE, levels=2, crease=.15)
    base = tag(kit.join([band, knot], R + ".scarf-band"), 240, "rooted scarf neck folds")
    pieces = []
    for link, y0, y1, z0, z1 in [("cape", -.046, -.170, 1.043, 1.138),
                                ("cape2", -.170, -.340, 1.138, 1.177)]:
        def tail(u, v, link=link):
            return scarf_surface(link, u, v)
        obj = fk.sheet(R + ".scarf-" + link, tail, np.linspace(0, 1, 14),
                       np.linspace(0, 1, 28), SCARF, rim=.0024, back=True,
                       inside=V(0, -.14, .995))
        kit.drape(obj, free=lambda p, y0=y0, y1=y1: (p.y - y0) / (y1 - y0))
        pieces.append((tag(obj, 280, "scarf two-link tail"), link))
    return base, pieces


def tank_pack():
    pieces = []
    for s in (-1, 1):
        x = s * TANK_X
        rows = []
        tank_rows = [(.754, .024), (.765, .043), (.795, .059), (.825, .065),
                     (1.010, .065), (1.047, .060), (1.080, .043), (1.094, .004)]
        for z in np.linspace(.754, 1.094, 75):
            radius = profile(tank_rows, float(z))[0]
            rows.append([V(x + math.sin(a) * radius, TANK_Y + math.cos(a) * radius, z)
                         for a in np.linspace(0, TAU, 72, endpoint=False)])
        pieces.append(fk.loft(R + f".chrome-tank{s}", rows, CHROME, start="pole", end="pole"))
        for z in (.830, 1.015):
            rows = [[V(x + math.sin(a) * .067, TANK_Y + math.cos(a) * .067, zz)
                     for a in np.linspace(0, TAU, 64, endpoint=False)]
                    for zz in (z - .011, z - .007, z + .007, z + .011)]
            pieces.append(fk.loft(R + f".tank-blue-band{s}-{z}", rows, SEAM))
            points = [V(x + math.sin(a) * .0678, TANK_Y + math.cos(a) * .0678, z - .010)
                      for a in np.linspace(0, TAU, 64, endpoint=False)]
            pieces.append(fk.tube(R + f".tank-band-edge{s}-{z}", points + [points[0]],
                                  [.0015] * 65, CHROME, n=8, up=(0, 0, 1)))
        # Tapered nozzle with a recessed interior ring and an open exit.
        path = [V(x, TANK_Y, zz) for zz in (.800, .787, .724, NOZZLE_Z)]
        pieces.append(fk.tube(R + f".nozzle-shell{s}", path,
                              [.029, .034, .041, .046], NOZZLE, n=48, up=(1, 0, 0),
                              caps=(None, None)))
        inner = [V(x, TANK_Y, NOZZLE_Z + .003), V(x, TANK_Y, NOZZLE_Z + .050)]
        pieces.append(fk.tube(R + f".nozzle-inner{s}", inner, [.039, .022], INK,
                              n=40, up=(1, 0, 0), caps=(None, "flat")))
        points = [V(x + math.sin(a) * .0463, TANK_Y + math.cos(a) * .0463, NOZZLE_Z)
                  for a in np.linspace(0, TAU, 64, endpoint=False)]
        pieces.append(fk.tube(R + f".nozzle-lip{s}", points + [points[0]], [.0028] * 65,
                              BRUSHED, n=10, up=(0, 0, 1)))
        hose = curve([V(x, TANK_Y + .040, .815), V(s * .105, -.145, .809),
                      V(s * .118, -.119, .773), V(s * .091, -.106, .736)], 14)
        pieces.append(fk.tube(R + f".fuel-line{s}", hose, [.006] * len(hose), HARNESS,
                              n=12, caps=(None, None)))
        for k, z in enumerate((.854, .927, .993)):
            pieces.append(fk.rbox(R + f".tank-service-panel{s}-{k}", (.026, .007, .017),
                                  V(x, TANK_Y - .065, z), BRUSHED, levels=1, crease=.8))
    pieces.append(fk.rbox(R + ".pack-support", (.151, .039, .221),
                          V(0, -.133, .900), HARNESS, levels=2, crease=.45))
    # A connector manifold visibly feeds both rockets.
    manifold = [V(-TANK_X, TANK_Y, .775), V(-.041, -.158, .775),
                V(.041, -.158, .775), V(TANK_X, TANK_Y, .775)]
    pieces.append(fk.tube(R + ".rocket-manifold", curve(manifold, 10),
                          [.011] * len(curve(manifold, 10)), CHROME, n=14))
    return tag(kit.join(pieces, R + ".twin-tank-jetpack"), 2000, "chrome tank pack engineering")


def flame_surface(s, a, t, lift=0):
    radius = profile([(0, .027), (.12, .034), (.28, .036), (.43, .029),
                      (.60, .020), (.76, .011), (.90, .006), (1, .00045)], t)[0]
    scallop = 1 + .13 * math.cos(a * 3 - t * 5) + .05 * math.cos(a * 5 + t * 7)
    radius = radius * scallop + lift
    centre = V(s * TANK_X + s * .007 * t * t, TANK_Y - .013 * t,
               NOZZLE_Z - .008 - .208 * t)
    return centre + V(math.sin(a) * radius, math.cos(a) * radius,
                      .004 * math.sin(a * 3) * math.sin(math.pi * t))


def flames():
    """Visible cartoon layers on plump flame masses, not nested opaque cones."""
    pieces = []
    for s in (-1, 1):
        rows = [[flame_surface(s, float(a), float(t))
                 for a in np.linspace(0, TAU, 48, endpoint=False)]
                for t in np.linspace(0, 1, 44)]
        pieces.append(fk.loft(R + f".orange-thrust-mass{s}", rows, FLAME_EDGE,
                              start="pole", end="pole"))
        for k, angle in enumerate((0, math.pi / 2, math.pi, math.pi * 1.5)):
            for hot in (False, True):
                def layer(u, v, angle=angle, s=s, hot=hot):
                    end = .56 if hot else .86
                    t = .018 + v * (end - .018)
                    width = (.37 if hot else .69) * max(.018, (1 - v) ** .64)
                    # Raised over the orange surface so the core is visible
                    # from every review side, with an orange rim between it.
                    lift = (.0022 if hot else .0010) * (1 - abs(u) ** 3) + .00018
                    return flame_surface(s, angle + u * width, t, lift)
                pieces.append(fk.sheet(R + f".flame-layer{s}-{k}-{hot}", layer,
                                      np.linspace(-1, 1, 17), np.linspace(0, 1, 28),
                                      HOT if hot else FLAME, rim=.0003,
                                      inside=V(s * TANK_X, TANK_Y, .61)))
        # Two shorter split tongues give each jet a flame silhouette at
        # oblique angles, rather than a uniformly straight geometric cone.
        for k, sign in enumerate((-1, 1)):
            pts = curve([V(s * TANK_X + sign * .015, TANK_Y, NOZZLE_Z - .014),
                         V(s * TANK_X + sign * .027, TANK_Y - .003, .645),
                         V(s * TANK_X + sign * .034, TANK_Y - .014, .595),
                         V(s * TANK_X + sign * .023, TANK_Y - .023, .552)], 9)
            radii = [profile([(0, .011, .009), (.25, .014, .010),
                             (.54, .010, .007), (1, .0005, .0005)],
                            j / (len(pts) - 1)) for j in range(len(pts))]
            pieces.append(fk.tube(R + f".split-flame-tongue{s}-{k}", pts, radii,
                                  FLAME_EDGE if k == 0 else FLAME, n=20, up=(1, 0, 0)))
    mesh = tag(kit.join(pieces, R + ".twin-exhaust-flames"), 650,
               "orange gold and hot layered split cartoon thrust")
    mesh["visibleFlameLayers"] = True
    mesh["noShadow"] = True
    return mesh


def pistol():
    """A chunky space-age receiver, proper grip/trigger guard and bright bore."""
    down, palm, across = hand_frame(1)
    grip = grip_position()
    centre = grip + V(0, .031, .058)
    pieces = []
    # Grip follows the hand's palm axis in the authored bind frame.
    grip_mesh = fk.tube(R + ".pistol-grip", [grip - across * .031, grip + across * .031],
                        [(.0115, .0125), (.011, .012)], HARNESS, n=20, up=down)
    pieces.append(fk.rbox(R + ".pistol-receiver", (.075, .094, .066), centre,
                          CHROME, levels=3, crease=.45))
    # The receiver's long cylindrical barrel projects forward outside the thigh.
    path = [centre + V(0, y, 0) for y in (.017, .039, .174, .195)]
    pieces.append(fk.tube(R + ".pistol-barrel", path, [.040, .045, .041, .033],
                          CHROME, n=56, up=(1, 0, 0), caps=(None, None)))
    for k, y in enumerate((.058, .129, .179)):
        points = [centre + V(math.sin(a) * .046, y, math.cos(a) * .046)
                  for a in np.linspace(0, TAU, 56, endpoint=False)]
        pieces.append(fk.tube(R + f".pistol-band{k}", points + [points[0]], [.0033] * 57,
                              SEAM if k == 1 else BRUSHED, n=10, up=(0, 1, 0)))
    pieces.append(fk.tube(R + ".pistol-bore", [centre + V(0, .188, 0), centre + V(0, .198, 0)],
                          [.027, .026], INK, n=40, up=(1, 0, 0), caps=("flat", None)))
    pieces.append(fk.tube(R + ".pistol-cyan-emitter", [centre + V(0, .193, 0), centre + V(0, .197, 0)],
                          [.019, .019], CYAN, n=36, up=(1, 0, 0), caps=(None, "flat")))
    for s in (-1, 1):
        pieces.append(fk.rbox(R + f".pistol-side-insert{s}", (.004, .055, .019),
                              centre + V(s * .038, -.006, 0), INK, levels=1, crease=.8))
        for k in range(4):
            pieces.append(fk.rbox(R + f".pistol-vent{s}-{k}", (.0045, .006, .012),
                                  centre + V(s * .040, -.022 + k * .012, 0), CYAN,
                                  levels=1, crease=.75))
    loop = [centre + V(0, .029, -.025), centre + V(0, .043, -.054),
            centre + V(0, .010, -.086), grip + V(0, -.017, -.001)]
    pts = curve(loop, 12)
    pieces.append(fk.tube(R + ".pistol-trigger-guard", pts, [.0038] * len(pts),
                          BRUSHED, n=12, up=(1, 0, 0)))
    trigger = [centre + V(0, .019, -.034), centre + V(0, .013, -.048)]
    pieces.append(fk.tube(R + ".pistol-trigger", trigger, [.0028] * 2, BRUSHED, n=10))
    pieces.append(fk.rbox(R + ".pistol-sight", (.017, .018, .007),
                          centre + V(0, .017, .036), BRUSHED, levels=1, crease=.8))
    # A 45-degree low-ready muzzle is part of the neutral source, so aiming
    # never needs an implausible ninety-degree wrist fold. The grip remains
    # on the digit row: it is not rotated away from the actual fingers.
    frame = Matrix.Translation(grip) @ Matrix.Rotation(-math.pi / 4, 4, "X") @ Matrix.Translation(-grip)
    receiver = kit.join(pieces, R + ".blaster-receiver-source")
    receiver.data.transform(frame)
    mesh = tag(kit.join([receiver, grip_mesh], R + ".chrome-ray-blaster"),
               1200, "chrome blaster grip guard and muzzle")
    mesh["muzzleLocalAuthored"] = list(frame @ (centre + V(0, .197, 0)))
    mesh["neutralMuzzlePitch"] = -math.pi / 4
    return mesh, grip


def make_rig(root, grip):
    data = bpy.data.armatures.new(R + " common-axis anatomical frames")
    rig = bpy.data.objects.new(R + ".skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    positions = {"torso": WAIST, "chest": CHEST, "neck": NECK, "head": HEAD,
                 "hair": V(0, -.008, 1.281), "hat": V(0, -.005, 1.079),
                 "weapon": grip, "extra": V(0, TANK_Y, NOZZLE_Z),
                 "cape": V(-.021, -.046, 1.043), "cape2": V(-.021, -.170, 1.138)}
    parents = {"chest": "torso", "neck": "chest", "head": "neck",
               "hair": "head", "hat": "head", "weapon": "handR",
               "extra": "chest", "cape": "neck", "cape2": "cape"}
    for s, suffix in ((-1, "L"), (1, "R")):
        for name, point, parent in [("clav", V(s * .030, -.005, .994), "chest"),
                                    ("arm", SH[s], "clav" + suffix),
                                    ("fore", EL[s], "arm" + suffix),
                                    ("hand", WR[s], "fore" + suffix),
                                    ("leg", HIP[s], None), ("knee", KNEE[s], "leg" + suffix),
                                    ("foot", ANKLE[s], "knee" + suffix)]:
            positions[name + suffix] = point
            if parent:
                parents[name + suffix] = parent
    for name, point in positions.items():
        bone = data.edit_bones.new(R + "." + name)
        # Match the reviewed Sumo frame exactly: every head/tail points
        # world +Z, with the same zero roll. The GLTF exporter supplies
        # the common bone frame; Arena then adds its XYZ pose angles.
        bone.head, bone.tail, bone.use_connect = point, point + V(0, 0, .065), False
    for name, parent in parents.items():
        data.edit_bones[R + "." + name].parent = data.edit_bones[R + "." + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({key: list(value) for key, value in positions.items()})
    return rig


def weights(obj, rig, values):
    kit.apply(obj)
    kit.apply_transform(obj)
    names = list(values)
    a = np.stack([np.asarray(values[name]) + np.zeros(len(obj.data.vertices)) for name in names], axis=1)
    a = np.clip(a, 0, 1)
    if len(names) > 4:
        rank = np.argsort(a, axis=1)[:, :-4]
        np.put_along_axis(a, rank, 0, axis=1)
    sums = a.sum(axis=1, keepdims=True)
    if np.any(sums < 1e-8):
        raise ValueError(obj.name + " has an unweighted vertex")
    a /= sums
    for j, name in enumerate(names):
        group = obj.vertex_groups.new(name=R + "." + name)
        quantized = np.round(a[:, j] * 100000).astype(int)
        indices = np.flatnonzero(quantized > 0)
        indices = indices[np.argsort(quantized[indices])]
        for batch in np.split(indices, np.flatnonzero(np.diff(quantized[indices])) + 1):
            if len(batch):
                group.add(batch.tolist(), float(quantized[batch[0]]) / 100000, "REPLACE")
    mod = obj.modifiers.new("Connected anatomical skin", "ARMATURE")
    mod.object = rig
    obj.parent = rig
    obj["continuousSkin"] = True


def weight_uniform(obj, rig, sleeves=True, legs=True):
    p = np.array([v.co[:] for v in obj.data.vertices])
    x, y, z = p.T
    chest = ss(.785, .935, z)
    values = {"torso": 1 - chest, "chest": chest}
    width = np.interp(z, [r[0] for r in BODY], [r[1] for r in BODY])
    arm_total = np.zeros(len(p))
    for s, suffix in ((-1, "L"), (1, "R")):
        deltoid = ss(.906, .977, z)
        # Below the deltoid there is open air between sleeve and flank.
        # Every point on the medial sleeve must therefore move with its
        # arm, rather than blending halfway to a distant waist joint.
        lateral = ss(width - .002 - deltoid * .020,
                     width + .006 + deltoid * .021, x * s)
        upper = ss(.666, .746, z)
        lower_arm = ss(.157, .177, x * s)
        arm = (lateral * (upper + (1 - upper) * lower_arm) * ss(.438, .490, z) *
               (1 - ss(.984, 1.037, z))) if sleeves else np.zeros(len(p))
        arm_total += arm
        shoulder = ss(.926, .995, z) * ss(.070, .149, x * s) * (1 - arm) * chest
        values["clav" + suffix] = shoulder * .55
        values["chest"] -= shoulder * .55
        for name in ("torso", "chest", "clav" + suffix):
            values[name] *= 1 - arm
        fore = 1 - ss(EL[s].z - .048, EL[s].z + .050, z)
        wrist = 1 - ss(WR[s].z - .018, WR[s].z + .029, z)
        values["arm" + suffix] = arm * (1 - fore)
        values["fore" + suffix] = arm * fore * (1 - wrist)
        values["hand" + suffix] = arm * fore * wrist
    if legs:
        # Hanging wrists are below hip height. A height-only pelvis mask
        # used to reassign their sleeves to the legs and made an elbow
        # stretch into a triangular web during a shot or cuff check.
        below = (1 - ss(.595, .681, z)) * (1 - np.clip(arm_total, 0, 1))
        side = ss(-.022, .022, x)
        for name in list(values):
            values[name] *= 1 - below
        for s, suffix in ((-1, "L"), (1, "R")):
            share = below * (side if s > 0 else 1 - side)
            knee = 1 - ss(KNEE[s].z - .049, KNEE[s].z + .053, z)
            foot = 1 - ss(ANKLE[s].z - .018, ANKLE[s].z + .028, z)
            values["leg" + suffix] = share * (1 - knee)
            values["knee" + suffix] = share * knee * (1 - foot)
            values["foot" + suffix] = share * knee * foot
    weights(obj, rig, values)


def attach(obj, rig, part):
    kit.apply(obj)
    kit.apply_transform(obj)
    world = obj.matrix_world.copy()
    obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", R + "." + part
    obj.matrix_world = world
    return obj


def attach_faces(features, rig):
    nodes = {}
    for name in ("eyeL", "eyeR", "browL", "browR", "mouth", "pupilL", "pupilR"):
        obj = features[name]
        kit.apply(obj)
        kit.apply_transform(obj)
        pts = np.array([v.co[:] for v in obj.data.vertices])
        lo, hi = pts.min(axis=0), pts.max(axis=0)
        centre, size = V((lo + hi) / 2), hi - lo
        if name.startswith("pupil"):
            axes = nodes["eye" + name[-1]].matrix_world.to_3x3()
        else:
            normal, up = V(centre.x * 3, 1, 0).normalized(), V(0, 0, 1)
            axes = Matrix((normal.cross(up).normalized(), normal, up)).transposed()
        frame = Matrix.Translation(centre) @ axes.to_4x4()
        obj.data.transform(frame.inverted())
        if name.startswith("pupil"):
            obj.parent = nodes["eye" + name[-1]]
        else:
            obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", R + ".head"
        obj.matrix_world = frame
        obj["faceWidth"], obj["faceHeight"] = max(.006, float(size[0])), max(.003, float(size[2]))
        nodes[name] = obj
        kit.refresh()


def source_materials():
    # Only Jetpack's private pots are dressed here; shared team materials
    # retain the collector's common finish and are never modified.
    for name in (SKIN, LIP, HAIR, HAIR_LIGHT, WHITE, SCARF, GLOVE, STITCH, SOLE,
                 HARNESS, CHROME, BRUSHED, NOZZLE, GLASS, INK, EYE, IRIS, CYAN,
                 FLAME_EDGE, FLAME, HOT):
        material = kit.material(name)
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if name.startswith("skin"):
            bsdf.inputs["Roughness"].default_value = .65
            bsdf.inputs["Specular IOR Level"].default_value = .27
        elif name.startswith("hair"):
            bsdf.inputs["Roughness"].default_value = .50
            bsdf.inputs["Coat Weight"].default_value = .045
        elif name.startswith(("weave", "drape")):
            bsdf.inputs["Roughness"].default_value = .86
            bsdf.inputs["Sheen Weight"].default_value = .25
        elif name == GLOVE:
            bsdf.inputs["Roughness"].default_value = .55
        elif name == GLASS:
            # Root must implement this family in Arena. These properties
            # make Blender's review honest rather than an opaque stand-in.
            bsdf.inputs["Base Color"].default_value = (.90, .97, 1, 1)
            bsdf.inputs["Roughness"].default_value = .065
            bsdf.inputs["Transmission Weight"].default_value = 1
            bsdf.inputs["IOR"].default_value = 1.08
            bsdf.inputs["Alpha"].default_value = .16
            bsdf.inputs["Coat Weight"].default_value = .65
            material["arenaRequiresGlassFamily"] = True
            material["arenaGlassOpacity"] = .16
        elif name in (FLAME_EDGE, FLAME, HOT):
            # The old strength=4 bleached orange under AgX. A hot inner
            # tongue and saturated outer rim now retain distinct colours.
            bsdf.inputs["Roughness"].default_value = 1
            bsdf.inputs["Specular IOR Level"].default_value = 0
            bsdf.inputs["Emission Strength"].default_value = {
                FLAME_EDGE: .85, FLAME: 1.55, HOT: 2.3}[name]


def pigment(root):
    """Generic point cache + one exporting COLOR_0, never extra colours."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        for attr in list(mesh.color_attributes):
            mesh.color_attributes.remove(attr)
        attr = mesh.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="CORNER")
        rgb = np.ones((len(mesh.vertices), 3), dtype=np.float32)
        if obj.name == R + ".adult-head-skin":
            pts = np.array([v.co[:] for v in mesh.vertices])
            x, y, z = pts.T
            cheek = np.exp(-((abs(x) - .060) / .022) ** 2) * np.exp(-((z - 1.163) / .020) ** 2) * (y > .024)
            rgb[:, 1] -= cheek * .065
            rgb[:, 2] -= cheek * .070
        generic = mesh.attributes.get("JetpackPigment") or mesh.attributes.new(
            name="JetpackPigment", type="FLOAT_VECTOR", domain="POINT")
        generic.data.foreach_set("vector", rgb.ravel())
        indices = np.array([loop.vertex_index for loop in mesh.loops])
        rgba = np.column_stack((rgb[indices], np.ones(len(mesh.loops), dtype=np.float32)))
        attr.data.foreach_set("color", rgba.ravel())
        mesh.color_attributes.active_color = attr
        mesh.color_attributes.render_color_index = 0


def finish_ao(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        ao = mesh.color_attributes.get("AO")
        if not ao:
            ao = mesh.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="CORNER")
            ao.data.foreach_set("color", np.ones(len(mesh.loops) * 4, dtype=np.float32))
        rgba = np.empty((len(mesh.loops), 4), dtype=np.float32)
        ao.data.foreach_get("color", rgba.ravel())
        cache = mesh.attributes.get("JetpackPigment")
        if cache:
            rgb = np.empty((len(mesh.vertices), 3), dtype=np.float32)
            cache.data.foreach_get("vector", rgb.ravel())
            indices = np.array([loop.vertex_index for loop in mesh.loops])
            # Glass, flame and facial paint remain clean; dark AO must not
            # turn the transparent shell into a smoky sphere.
            minimum = .93 if obj.get("clearHelmet") else .68
            rgba[:, :3] = np.clip(rgba[:, :3], minimum, 1) * rgb[indices]
        rgba[:, 3] = 1
        ao.data.foreach_set("color", rgba.ravel())
        for other in list(mesh.color_attributes):
            if other != ao:
                mesh.color_attributes.remove(other)
        mesh.color_attributes.active_color = ao
        mesh.color_attributes.render_color_index = 0


def build_master(root_name=R):
    if root_name != R:
        raise ValueError("Jetpack has a fixed named anatomical rig")
    source_materials()
    root = kit.empty(R)
    gun, grip = pistol()
    rig = make_rig(root, grip)
    uniform = tag(union([torso(), sleeve(-1), sleeve(1), trouser(-1), trouser(1)],
                        R + ".connected-flight-suit", SUIT, .00185),
                  9300, "connected tailored adult torso shoulders elbows hips knees")
    weight_uniform(uniform, rig)
    details = suit_panels()
    weight_uniform(details, rig, False, False)
    for s, suffix in ((-1, "L"), (1, "R")):
        glove_mesh, stitch = glove(s)
        down, _, _ = hand_frame(s)
        t = np.array([(v.co - WR[s]).dot(down) for v in glove_mesh.data.vertices])
        share = ss(-.051, -.007, t)
        weights(glove_mesh, rig, {"fore" + suffix: 1 - share, "hand" + suffix: share})
        attach(stitch, rig, "hand" + suffix)
        boot_mesh = boot(s)
        z = np.array([v.co.z for v in boot_mesh.data.vertices])
        share = 1 - ss(.073, .115, z)
        weights(boot_mesh, rig, {"knee" + suffix: 1 - share, "foot" + suffix: share})
    head_mesh, ears = adult_head()
    z = np.array([v.co.z for v in head_mesh.data.vertices])
    neck_share, head_share = ss(1.014, 1.044, z), ss(1.049, 1.086, z)
    weights(head_mesh, rig, {"chest": 1 - neck_share,
                            "neck": neck_share * (1 - head_share),
                            "head": neck_share * head_share})
    attach(ears, rig, "head")
    controls, fixed = facial_features()
    attach_faces(controls, rig)
    attach(fixed, rig, "head")
    attach(bob(), rig, "hair")
    shell, hardware = helmet()
    attach(shell, rig, "hat")
    attach(hardware, rig, "head")
    collar = collar_support()
    kit.apply(collar)
    kit.apply_transform(collar)
    z = np.array([v.co.z for v in collar.data.vertices])
    neck_share, head_share = ss(1.000, 1.011, z), ss(1.007, 1.016, z)
    weights(collar, rig, {"chest": 1 - neck_share,
                          "neck": neck_share * (1 - head_share),
                          "head": neck_share * head_share})
    neck_band, tails = scarf()
    attach(neck_band, rig, "neck")
    for obj, joint in tails:
        attach(obj, rig, joint)
    attach(tank_pack(), rig, "chest")
    attach(flames(), rig, "extra")
    attach(gun, rig, "weapon")
    pigment(root)
    kit.refresh()
    root["authorScale"] = 1.0
    root["sourceBrief"] = "work/arena/2026-10-08-roster/jetpack/brief.md"
    root["restPose"] = "natural hanging arms; roughly 13 degree elbow flexion; inward palms"
    root["runtimeCopyRequired"] = True
    root["rigContract"] = "common axes; torso chest clavL clavR; separate live face controls"
    root["nativeBaseline"] = json.dumps([.511924386, .669390745, 1.392495076])
    return root
