"""Editable Sumo-only high-resolution anatomy and linear skinning.

Blender +Y is forward, Z is up. Dimensions below are unscaled authoring
coordinates; the established Sumo 1.22 size is applied once at assembly.
All skin is one connected sculpt, including neck, shoulders, palms and feet.
The master retains subdivision, separate woven garments and a named armature.
"""
import json
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector
import kit
import figure_folk_kit as fk
from figure_sumo_weights import repair_shoulder_weights

V = fk.V
K = 1.22
TAU = math.tau
SKIN = "skin:" + kit.tint("sumo-skin-master", "#ce9a75")
HAIR = "hair:" + kit.tint("sumo-hair-master", "#1c2027")
CLOTH = "weave:team"
EDGE = "weave:team2"
CORD = "weave:" + kit.tint("sumo-sagari-master", "#e9dcc0")
NAIL = "skin:" + kit.tint("sumo-nail-master", "#d6aa91")
EYE = "resin:" + kit.tint("sumo-eye-master", "#d7d1be")
IRIS = "resin:" + kit.tint("sumo-iris-master", "#40332a")
DARK = "resin:" + kit.tint("sumo-shadow-master", "#5b3c31")
WAIST = V(0, 0, .55)
NECK = V(0, -.005, 1.045)
HIP = {s: V(s * .145, -.002, .55) for s in (-1, 1)}
KNEE = {s: V(s * .174, .035, .312) for s in (-1, 1)}
ANKLE = {s: V(s * .194, -.004, .077) for s in (-1, 1)}
SHOULDER = {s: V(s * .259, -.015, .941) for s in (-1, 1)}
ELBOW = {s: V(s * .409, .027, .741) for s in (-1, 1)}
WRIST = {s: V(s * .439, .064, .545) for s in (-1, 1)}


def g(x, c, r):
    return math.exp(-((x - c) / r) ** 2)


def ss(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def table(rows, x):
    """Smooth bounded section interpolation without limb-radius overshoot."""
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
    # Anatomical profiles follow physical length: unequal shoulder/elbow
    # control spans must not move the elbow silhouette into the forearm.
    distances = [0]
    for a, b in zip(points, points[1:]):
        distances.append(distances[-1] + (b - a).length)
    target = max(0, min(1, t)) * distances[-1]
    i = next((j for j in range(len(points) - 1)
              if target <= distances[j + 1]), len(points) - 2)
    f = (target - distances[i]) / max(.000001, distances[i + 1] - distances[i])
    a, b, c, d = [points[max(0, min(len(points) - 1, j))]
                  for j in (i - 1, i, i + 1, i + 2)]
    return .5 * ((2 * b) + (-a + c) * f +
                 (2 * a - 5 * b + 4 * c - d) * f * f +
                 (-a + 3 * b - 3 * c + d) * f ** 3)


BODY = [(.435, .170, .138, .130), (.480, .208, .160, .155),
        (.550, .222, .174, .166), (.605, .248, .213, .183),
        (.666, .274, .234, .188), (.724, .276, .220, .188),
        (.790, .272, .188, .181), (.830, .278, .171, .173),
        (.870, .282, .158, .163), (.915, .280, .151, .154),
        (.956, .258, .131, .145), (.980, .237, .111, .134),
        (1.005, .148, .083, .112), (1.028, .095, .073, .092),
        (1.068, .074, .070, .079), (1.083, .073, .069, .073)]


def body_point(a, z, extra=0):
    width, front, back = table(BODY, z)
    sa, ca = math.sin(a), math.cos(a)
    power = 2.12 + .20 * float(ss(.76, .88, z))
    x = math.copysign(abs(sa) ** (2 / power), sa) * (width + extra)
    y = math.copysign(abs(ca) ** (2 / power), ca) * \
        ((front if ca >= 0 else back) + extra)
    ad = abs((math.degrees(a) + 180) % 360 - 180)
    # The armpit is a recess below the rib cage. Its opening prevents the
    # resting arm from being fused to the flank during the continuous union.
    x -= math.copysign(.027 * g(z, .851, .064) * g(ad, 90, 18), x)
    if ad < 90:
        # Pectoral planes, sternum, curved collarbone and suprasternal notch.
        y += .029 * g(z, .892, .045) * g(ad, 31, 22)
        underside = .840 + .034 * (ad / 65) ** 1.5
        y -= .004 * g(z, underside, .014) * g(ad, 32, 21)
        y -= .007 * g(z, .919, .054) * g(ad, 0, 8)
        clavicle = .970 - .021 * (ad / 75) ** 1.3
        y += .006 * g(z, clavicle, .011) * g(ad, 35, 32)
        y -= .005 * g(z, .994, .015) * g(ad, 0, 13)
        y += .004 * g(z, 1.033, .039) * g(ad, 40, 11)
        # Soft weight falls towards the belt, rather than a cylindrical vest.
        y += .021 * g(z, .645, .056) * g(ad, 0, 55)
        y -= .003 * g(z, .687, .008) * g(ad, 0, 4)
        y -= .006 * g(z, .577, .012) * g(ad, 0, 59)
        y -= .005 * g(z, .751, .074) * g(ad, 68, 12)
    else:
        y -= .010 * g(z, .883, .070) * g(ad, 138, 23)
        y -= .009 * g(z, .975, .035) * g(ad, 148, 24)
        y += .007 * g(z, .891, .097) * g(ad, 180, 8)
        y -= .006 * g(z, .554, .055) * g(ad, 151, 24)
    return V(x, y, z)


def torso():
    rings = [[body_point(i / 128 * TAU, z) for i in range(128)]
             for z in np.linspace(BODY[0][0], BODY[-1][0], 110)]
    return fk.loft("sumo.anatomical-torso", rings, SKIN,
                   start="pole", end="pole", recalc=True)


def anatomical_limb(name, points, sections, detail):
    rings = []
    for t in np.linspace(0, 1, 80):
        p = line_path(points, t)
        axis = (line_path(points, min(1, t + .0001)) -
                line_path(points, max(0, t - .0001))).normalized()
        across = (V(1, 0, 0) - axis * axis.x).normalized()
        front = across.cross(axis).normalized()
        if front.y < 0:
            front = -front
        width, rf, rb = table(sections, t)
        row = []
        for i in range(56):
            a = i / 56 * TAU
            sn, cs = math.sin(a), math.cos(a)
            d = detail(t, a)
            row.append(p + across * sn * (width + d * .6) +
                       front * cs * ((rf if cs >= 0 else rb) + d))
        rings.append(row)
    return fk.loft(name, rings, SKIN, start="pole", end="pole", recalc=True)


def arm(s):
    sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
    points = [sh + V(-s * .054, -.006, .010),
              sh + V(s * .012, 0, -.037), (sh + el) / 2, el,
              (el + wr) / 2, wr + (wr - el).normalized() * .022]
    sections = [(0, .051, .059, .064), (.13, .080, .079, .089),
                (.25, .082, .080, .088), (.38, .073, .073, .082),
                (.46, .057, .055, .064), (.52, .058, .052, .060),
                (.62, .068, .065, .061), (.77, .054, .051, .043),
                (.90, .040, .035, .031), (1, .033, .028, .026)]

    def detail(t, a):
        front, back, side = max(0, math.cos(a)), max(0, -math.cos(a)), abs(math.sin(a))
        return (.007 * g(t, .30, .105) * front ** 5 +
                .007 * g(t, .33, .135) * back ** 3 +
                .004 * g(t, .47, .029) * side ** 6 +
                .006 * g(t, .50, .030) * back ** 7 -
                .004 * g(t, .49, .021) * front ** 8 +
                .005 * g(t, .64, .120) * side ** 2 * front)
    return anatomical_limb(f"sumo.arm-sculpt-{s}", points, sections, detail)


def leg(s):
    h, k, a = HIP[s], KNEE[s], ANKLE[s]
    points = [h + V(0, -.002, .026), (h + k) / 2, k, (k + a) / 2,
              a + V(0, .002, -.011)]
    sections = [(0, .102, .108, .111), (.17, .115, .107, .114),
                (.32, .105, .092, .100), (.46, .082, .073, .074),
                (.53, .070, .071, .067), (.68, .083, .071, .085),
                (.79, .067, .054, .070), (.91, .046, .040, .047),
                (1, .038, .033, .038)]

    def detail(t, angle):
        f, b = max(0, math.cos(angle)), max(0, -math.cos(angle))
        inner = max(0, -s * math.sin(angle))
        return (.010 * g(t, .28, .13) * f ** 3 +
                .008 * g(t, .43, .06) * inner ** 4 +
                .008 * g(t, .53, .04) * f ** 8 +
                .008 * g(t, .70, .10) * b ** 3 * (1 - .35 * b ** 6) +
                .004 * g(t, .59, .06) * f ** 12 -
                .004 * g(t, .83, .16) * f ** 6 +
                .002 * g(t, .83, .16) * f ** 18 +
                .003 * g(t, .91, .10) * b ** 10 -
                .003 * g(t, .90, .10) * b ** 3 * math.sin(angle) ** 2)
    return anatomical_limb(f"sumo.leg-sculpt-{s}", points, sections, detail)


def shaped_digit(name, points, radius):
    radii = [(0, .90), (.12, 1), (.36, .97), (.42, 1.07),
             (.50, .93), (.73, .85), (.79, .93), (.86, .77), (1, .54)]
    ts = np.linspace(0, 1, 24)
    return fk.tube(name, [line_path(points, t) for t in ts],
                   [(radius * table(radii, t)[0], radius * .83 * table(radii, t)[0])
                    for t in ts], SKIN, n=20, up=(1, 0, 0),
                   caps=("dome", "dome"), levels=1)


def hand(s):
    el, wr = ELBOW[s], WRIST[s]
    f = (wr - el).normalized()
    n = (V(0, 1, .12) - f * V(0, 1, .12).dot(f)).normalized()
    across = f.cross(n).normalized()
    sections = [(-.017, .035, .027), (0, .040, .028), (.023, .054, .037),
                (.045, .058, .034), (.064, .059, .028), (.073, .053, .022)]
    rows = []
    for t in np.linspace(-.017, .073, 28):
        width, depth = table(sections, t)
        row = []
        for i in range(48):
            a = i / 48 * TAU
            x, cs = math.sin(a) * width, math.cos(a)
            if cs >= 0:
                relief = .012 * g(x, -s * .030, .026) * g(t, .034, .030)
                relief -= .002 * g(t, .047, .006) * g(x, 0, .044)
            else:
                relief = -.001 * g(x, 0, .041) * g(t, .030, .025)
                relief += sum(.005 * g(x, at, .010) * g(t, .060, .018)
                              for at in (-.039, -.012, .014, .040))
            d = depth + relief
            row.append(wr + f * t + across * x + n * cs * d)
        rows.append(row)
    pieces = [fk.loft(f"sumo.palm-{s}", rows, SKIN,
                      start="pole", end="pole", recalc=True)]
    nails = []
    for i, (offset, length, r) in enumerate([
            (-s * .050, .066, .0128), (-s * .014, .074, .0135),
            (s * .022, .071, .0128), (s * .055, .054, .0108)]):
        base = wr + f * .066 + across * offset
        pts = [base - f * .008, base + f * length * .31 + n * .002,
               base + f * length * .70 + n * .007,
               base + f * length + n * .013]
        pieces.append(shaped_digit(f"sumo.finger-{s}-{i}", pts, r))
        at = line_path(pts, .89) - n * (r * .79)
        nail = fk.ball(f"sumo.nail-{s}-{i}", 1, at, NAIL,
                       scale=(r * .72, r * .15, r * .88), seg=28, rings=16)
        # A nail plate follows the dorsal plane rather than the global axes.
        rotation = fk.basis(across, n, f, at)
        for v in nail.data.vertices:
            local = v.co - at
            v.co = at + across * local.x + n * local.y + f * local.z
        nails.append(nail)
    thumb = [wr + f * .019 - across * s * .032 + n * .007,
             wr + f * .028 - across * s * .058 + n * .015,
             wr + f * .050 - across * s * .074 + n * .020,
             wr + f * .074 - across * s * .078 + n * .015]
    pieces.append(shaped_digit(f"sumo.thumb-{s}", thumb, .018))
    web = [wr + f * .025 - across * s * .022 + n * .006,
           wr + f * .043 - across * s * .044 + n * .010,
           wr + f * .061 - across * s * .061 + n * .012]
    pieces.append(fk.tube(f"sumo.thumb-web-{s}", web,
                         [(.022, .017), (.018, .015), (.011, .010)],
                         SKIN, n=32, up=across, caps=("dome", "dome"), levels=1))
    return pieces, nails


def foot(s):
    ankle = ANKLE[s]
    f = V(s * .12, .993, 0).normalized()
    across = V(f.y, -f.x, 0)
    origin = V(ankle.x, ankle.y, .038)
    sections = [(-.061, .024, .029, .029), (-.042, .048, .034, .033),
                (0, .048, .056, .034), (.042, .058, .043, .028),
                (.084, .066, .029, .023), (.109, .054, .021, .018)]
    rows = []
    for t in np.linspace(-.061, .109, 45):
        width, upper, lower = table(sections, t)
        row = []
        for i in range(48):
            a = i / 48 * TAU
            sn, cs = math.sin(a), math.cos(a)
            p = origin + f * t + across * sn * width + V(0, 0, cs * (upper if cs >= 0 else lower))
            arch = .010 * g(t, .011, .035) * max(0, -s * sn) ** 4
            p.z = max(.008 + arch, p.z)
            row.append(p)
        rows.append(row)
    pieces = [fk.loft(f"sumo.foot-sculpt-{s}", rows, SKIN,
                      start="pole", end="pole", recalc=True)]
    for i, (offset, length, r) in enumerate([
            (-s * .047, .045, .021), (-s * .018, .043, .015),
            (s * .009, .037, .013), (s * .033, .031, .012),
            (s * .050, .023, .010)]):
        base = V(ankle.x, ankle.y, .027) + f * .100 + across * offset
        pts = [base - f * .012, base + f * length * .4,
               base + f * length * .75, base + f * length]
        toe = shaped_digit(f"sumo.toe-{s}-{i}", pts, r)
        for v in toe.data.vertices:
            v.co.z = max(.008, v.co.z)
        pieces.append(toe)
    return pieces


HEAD = [(1.044, .060, .048, .052), (1.068, .077, .072, .065),
        (1.093, .095, .079, .077), (1.131, .108, .079, .084),
        (1.176, .112, .081, .089), (1.220, .108, .078, .090),
        (1.260, .100, .070, .087), (1.301, .075, .051, .069),
        (1.326, .019, .015, .021)]


def head_point(a, z, extra=0):
    width, front, back = table(HEAD, z)
    sn, cs = math.sin(a), math.cos(a)
    x = math.copysign(abs(sn) ** .88, sn) * (width + extra)
    y = -.003 + math.copysign(abs(cs) ** .88, cs) * ((front if cs >= 0 else back) + extra)
    ad = abs((math.degrees(a) + 180) % 360 - 180)
    if ad < 90:
        y += .010 * g(z, 1.219, .010) * g(ad, 25, 18)
        y -= .008 * g(z, 1.201, .012) * g(ad, 27, 16)
        y += .016 * g(z, 1.197, .029) * g(ad, 0, 8)
        y += .025 * g(z, 1.174, .011) * g(ad, 0, 10)
        y += .010 * g(z, 1.173, .010) * g(ad, 18, 6)
        y -= .010 * g(z, 1.165, .0045) * g(ad, 15, 4)
        y += .013 * g(z, 1.172, .024) * g(ad, 40, 18)
        y -= .004 * g(z, 1.142, .022) * g(ad, 40, 16)
        y -= .004 * g(z, 1.146, .021) * g(ad, 20, 5)
        upper_lip = 1.142 + .0018 * g(ad, 8, 6) - .0015 * (ad / 24) ** 2
        mouth = 1.1375 - .002 * (ad / 25) ** 1.6
        lower_lip = 1.132 - .001 * (ad / 25) ** 2
        y += .004 * g(z, upper_lip, .0035) * g(ad, 0, 22)
        y += .007 * g(z, lower_lip, .0035) * g(ad, 0, 19)
        y -= .004 * g(z, mouth, .0022) * g(ad, 0, 23)
        y -= .003 * g(z, 1.152, .006) * g(ad, 0, 5)
        y += .008 * g(z, 1.088, .015) * g(ad, 0, 31)
        y += .004 * g(z, 1.104, .013) * g(ad, 48, 19)
    return V(x, y, z)


def head():
    rows = [[head_point(i / 128 * TAU, z) for i in range(128)]
            for z in np.linspace(HEAD[0][0], HEAD[-1][0], 110)]
    parts = [fk.loft("sumo.adult-head", rows, SKIN,
                     start="pole", end="pole", recalc=True)]
    for s in (-1, 1):
        rows = []
        # A rolled helix surrounds a recessed concha; the back returns to
        # the skull as a continuous thin shell instead of a pointed tab.
        for r in np.linspace(.002, 1, 40):
            row = []
            for a in np.linspace(0, TAU, 64, endpoint=False):
                sn, cs = math.sin(a), math.cos(a)
                width = .024 * (.78 + .22 * (cs + 1) / 2)
                helix = .020 * g(r, .83, .13) * (.60 + .40 * abs(sn))
                antihelix = .007 * g(r, .45, .11) * (.5 + .5 * max(0, cs))
                tragus = .005 * g(r, .48, .20) * max(0, sn) ** 8
                lobe = .003 * g(1.171 + cs * .046 * r, 1.136, .013)
                x = .111 + helix + antihelix + tragus + lobe
                row.append(V(s * x, -.015 + sn * width * r,
                             1.171 + cs * .046 * r))
            rows.append(row)
        for r in np.linspace(.98, .002, 28):
            rows.append([V(s * (.106 + .003 * r),
                           -.015 + math.sin(a) * .024 * (.78 + .22 * (math.cos(a) + 1) / 2) * r,
                           1.171 + math.cos(a) * .046 * r)
                         for a in np.linspace(0, TAU, 64, endpoint=False)])
        parts.append(fk.loft(f"sumo.ear-{s}", rows, SKIN,
                             start="pole", end="pole", recalc=True))
    return parts


def fuse(parts):
    for o in parts:
        kit.apply(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = parts[0]
    o.name = "sumo.skin"
    mod = o.modifiers.new("Connected anatomical skin", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = float(os.environ.get("SUMO_MASTER_VOXEL", ".0028"))
    mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    shoulder = o.vertex_groups.new(name="Master shoulder continuity")
    for value in range(1, 11):
        indices = []
        for v in o.data.vertices:
            x, y, z = v.co
            t = max(0, 1 - ((abs(x) - .275) / .071) ** 2 - ((z - .908) / .132) ** 2)
            if int(round(t * 10)) == value:
                indices.append(v.index)
        if indices:
            shoulder.add(indices, value / 10, "REPLACE")
    mod = o.modifiers.new("Continuous shoulder girdle blend", "SMOOTH")
    mod.factor, mod.iterations = .72, 12
    mod.vertex_group = shoulder.name
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.vertex_groups.clear()
    mod = o.modifiers.new("Soft tissue transitions", "SMOOTH")
    mod.factor, mod.iterations = .55, 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.clear()
    o.data.materials.append(kit.material(SKIN))
    for poly in o.data.polygons:
        poly.use_smooth = True
    sub = o.modifiers.new("Editable sculpt subdivision", "SUBSURF")
    sub.levels = sub.render_levels = 1
    return o


def make_rig(root):
    data = bpy.data.armatures.new("Sumo anatomical joint frames")
    rig = bpy.data.objects.new("sumo.skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    positions = {"torso": WAIST, "head": NECK, "hair": V(0, -.03, 1.31),
                 "extra": V(0, .190, .485)}
    parents = {"head": "torso", "hair": "head", "extra": "torso"}
    for s, suffix in ((-1, "L"), (1, "R")):
        for part, pos, parent in (("arm", SHOULDER[s], "torso"),
                                  ("fore", ELBOW[s], "arm" + suffix),
                                  ("hand", WRIST[s], "fore" + suffix),
                                  ("leg", HIP[s], None),
                                  ("knee", KNEE[s], "leg" + suffix),
                                  ("foot", ANKLE[s], "knee" + suffix)):
            positions[part + suffix] = pos
            if parent:
                parents[part + suffix] = parent
    for name, pos in positions.items():
        bone = data.edit_bones.new("sumo." + name)
        bone.head, bone.tail = pos * K, pos * K + V(0, 0, .070 * K)
        bone.use_connect = False
    for name, parent in parents.items():
        data.edit_bones["sumo." + name].parent = data.edit_bones["sumo." + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    data.display_type = "WIRE"
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k: list(v * K) for k, v in positions.items()})
    return rig


def segment_distance(p, a, b):
    av, bv = np.array(a), np.array(b)
    d = bv - av
    t = np.clip((p - av).dot(d) / d.dot(d), 0, 1)
    return np.linalg.norm(p - (av + t[:, None] * d), axis=1)


def weight_skin(o, rig):
    p = np.array([v.co[:] for v in o.data.vertices]) / K
    x, y, z = p.T
    weights = {name: np.zeros(len(p)) for name in
               [b.name.removeprefix("sumo.") for b in rig.data.bones]}
    h = ss(1.018, 1.095, z)
    weights["torso"], weights["head"] = 1 - h, h
    # Bounded section interpolation differs by less than this ownership
    # margin. The actual source profile remains the sculpt above.
    body_width = np.interp(z, [r[0] for r in BODY], [r[1] for r in BODY])
    body_width -= .027 * np.exp(-((z - .851) / .064) ** 2)
    for s, suffix in ((-1, "L"), (1, "R")):
        leg_share = (1 - ss(.492, .590, z)) * (x * s > 0)
        knee = 1 - ss(.277, .347, z)
        toe = ss(.022, .060, y) * (1 - ss(.09, .13, z))
        foot = np.maximum(1 - ss(.058, .108, z), toe)
        weights["leg" + suffix] = leg_share * (1 - knee)
        weights["knee" + suffix] = leg_share * knee * (1 - foot)
        weights["foot" + suffix] = leg_share * knee * foot
        weights["torso"] -= leg_share
        tip = WRIST[s] + (WRIST[s] - ELBOW[s]).normalized() * .165
        dist = np.minimum.reduce([
            segment_distance(p, SHOULDER[s], ELBOW[s]),
            segment_distance(p, ELBOW[s], WRIST[s]),
            segment_distance(p, WRIST[s], tip)])
        # Own the actual appendage, not nearby belly or thigh surface.
        # Only the shoulder's connected tissue has a mixed torso/arm zone.
        outside_body = ss(body_width + .007, body_width + .025, x * s)
        shoulder_blend = ss(.835, .910, z) * (1 - ss(1.010, 1.075, z))
        limit = .104 + .030 * ss(.835, .910, z)
        region = (x * s > .219) & (z > .365) & (z < 1.075) & (dist < limit)
        share = ss(.223, .307, x * s) * region * np.maximum(outside_body, shoulder_blend)
        fore = 1 - ss(ELBOW[s].z - .047, ELBOW[s].z + .052, z)
        hand = 1 - ss(WRIST[s].z - .025, WRIST[s].z + .025, z)
        weights["arm" + suffix] = share * (1 - fore)
        weights["fore" + suffix] = share * fore * (1 - hand)
        weights["hand" + suffix] = share * fore * hand
        for name in ("torso", "head", "leg" + suffix, "knee" + suffix, "foot" + suffix):
            weights[name] *= 1 - share
    total = np.maximum(.000001, np.sum(list(weights.values()), axis=0))
    for name, raw in weights.items():
        group = o.vertex_groups.new(name="sumo." + name)
        # Coarse 1% bands formed visible ridges at a bent elbow. Retain
        # 0.01% continuous blends; sorted batches avoid repeated mesh scans.
        q = np.rint(np.clip(raw / total, 0, 1) * 10000).astype(int)
        indices = np.flatnonzero(q > 0)
        indices = indices[np.argsort(q[indices])]
        cuts = np.flatnonzero(np.diff(q[indices])) + 1
        for batch in np.split(indices, cuts):
            if len(batch):
                group.add(batch.tolist(), float(q[batch[0]]) / 10000, "REPLACE")
    mod = o.modifiers.new("Linear anatomical skin", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False
    o.parent = rig
    o["continuousSkin"] = True
    o["weightRegions"] = "head,torso,handL,handR,footL,footR"
    o["shoulderOwnershipRepair"] = json.dumps(repair_shoulder_weights(o))


def bone_attach(o, rig, name):
    kit.apply(o)
    for v in o.data.vertices:
        v.co *= K
    world = o.matrix_world.copy()
    o.parent, o.parent_type, o.parent_bone = rig, "BONE", "sumo." + name
    o.matrix_world = world
    return o


def attach_faces(pieces, rig):
    """Real, centred surface-frame controls for the existing faceRig.

    The eye's pupil is its child, so blink closes both. Head skin and fixed
    upper/lower lids remain on the deforming head; brows and mouth carry
    separate expression controls. Game names deliberately have no dots.
    """
    groups, fixed = {}, []
    for o in pieces:
        feature = None
        for s, suffix in ((-1, "L"), (1, "R")):
            for stem, kind in (("eye", "eye"), ("iris", "pupil"), ("brow", "brow")):
                if o.name == f"sumo.{stem}-{s}":
                    feature = kind + suffix
        if o.name == "sumo.mouth-shadow":
            feature = "mouth"
        (groups.setdefault(feature, []) if feature else fixed).append(o)
    for o in fixed:
        bone_attach(o, rig, "head")
    nodes = {}
    for name in ("eyeL", "eyeR", "browL", "browR", "mouth", "pupilL", "pupilR"):
        objects = groups.get(name)
        if not objects:
            continue
        o = kit.join(objects, "sumo" + name) if len(objects) > 1 else objects[0]
        kit.apply(o)
        kit.apply_transform(o)
        o.name = "sumo" + name
        for v in o.data.vertices:
            v.co *= K
        points = [v.co.copy() for v in o.data.vertices]
        lo = V(*(min(p[j] for p in points) for j in range(3)))
        hi = V(*(max(p[j] for p in points) for j in range(3)))
        centre, size = (lo + hi) / 2, hi - lo
        if name.startswith("pupil"):
            axes = nodes["eye" + name[-1]].matrix_world.to_3x3()
        else:
            normal = V(centre.x * 3, 1, 0).normalized()
            up = V(0, 0, 1)
            right = normal.cross(up).normalized()
            axes = Matrix((right, normal, up)).transposed()
        frame = Matrix.Translation(centre) @ axes.to_4x4()
        inverse = frame.inverted()
        o.data.transform(inverse)
        o.matrix_world = frame
        if name.startswith("pupil"):
            o.parent = nodes["eye" + name[-1]]
        else:
            o.parent, o.parent_type, o.parent_bone = rig, "BONE", "sumo.head"
        o.matrix_world = frame
        o["faceWidth"] = max(.006 * K, size.x)
        o["faceHeight"] = max(.003 * K, size.z)
        nodes[name] = o
        kit.refresh()
    rig["faceContract"] = "sumoeyeL/R -> sumopupilL/R; sumobrowL/R; sumomouth; centred surface frames"


def mawashi():
    parts, fringe = [], []
    for layer, (lo, hi, offset) in enumerate([
            (.455, .548, .010), (.492, .578, .015), (.535, .592, .019)]):
        rows = []
        for t in np.linspace(0, 1, 16):
            row = []
            for i in range(128):
                a = i / 128 * TAU
                z = lo + (hi - lo) * t + .004 * math.cos(a) + .002 * math.sin(4 * a)
                fold = .003 * math.sin(t * math.pi) + .0012 * math.sin(a * 17 + layer)
                p = body_point(a, max(.533, min(z, .566)), offset + fold)
                p.z = z
                row.append(p)
            rows.append(row)
        parts.append(fk.loft(f"sumo.mawashi-wrap-{layer}", rows, CLOTH, levels=1, recalc=True))
        lip = []
        for dz in (-.0025, -.0008, .0005):
            row = []
            for i in range(128):
                a = i / 128 * TAU
                z = hi + dz + .004 * math.cos(a) + .002 * math.sin(4 * a)
                p = body_point(a, max(.533, min(z, .566)), offset + .0015)
                p.z = z
                row.append(p)
            lip.append(row)
        parts.append(fk.loft(f"sumo.selvedge-{layer}", lip, EDGE, levels=1, recalc=True))
    for s in (-1, 1):
        rows = []
        for t in np.linspace(0, 1, 28):
            z = .480 - .117 * t
            width = .069 - .020 * t
            y = s * (.185 - .128 * t + .023 * math.sin(t * math.pi))
            rows.append([V(u * width, y + s * .004 * math.cos(u * math.pi),
                           z + .003 * u * u) for u in np.linspace(-1, 1, 20)])
        strip = fk.loft(f"sumo.crotch-strip-{s}", rows, CLOTH, closed=False, levels=1, recalc=True)
        mod = strip.modifiers.new("Woven cloth thickness", "SOLIDIFY")
        mod.thickness = .012
        parts.append(strip)
    for s in (-1, 1):
        path = [V(0, -.181, .533), V(s * .049, -.204, .551),
                V(s * .074, -.216, .530), V(s * .045, -.220, .505), V(0, -.195, .511)]
        path = kit.smooth_path(path, samples=7)
        parts.append(fk.tube(f"sumo.rear-knot-fold-{s}", path, [(.014, .026)] * len(path),
                             CLOTH, n=32, up=(1, 0, 0), levels=1, caps=("dome", "dome")))
    parts.append(fk.rbox("sumo.knot-binding", (.055, .035, .065), V(0, -.215, .533),
                         EDGE, levels=3, crease=.2))
    for i in range(17):
        a = (i - 8) * .083
        top = body_point(a, .490, .038)
        length = .129 - .011 * abs(i - 8) / 8
        pts = [top, top + V(0, .005, -length * .25),
               top + V(0, .009, -length * .7), top + V(0, .006, -length)]
        fringe.append(fk.tube(f"sumo.sagari-{i}", pts, [.0032, .0032, .0030, .0027],
                              CORD, n=12, caps=("dome", "dome"), levels=1))
    return parts, fringe


def hair():
    parts = []
    hairline = [(0, 1.271), (30, 1.270), (55, 1.249), (78, 1.202),
                (100, 1.205), (135, 1.163), (180, 1.146)]
    rows = []
    for t in np.linspace(0, 1, 45):
        row = []
        for i in range(144):
            a = i / 144 * TAU
            ad = abs((math.degrees(a) + 180) % 360 - 180)
            z = table(hairline, ad)[0] * (1 - t) + 1.326 * t
            ridge = (.005 + .0012 * math.cos(a * 44 + t * 9)) * math.sin(math.pi * t) ** .35
            p = head_point(a, z, ridge)
            p.z += .003 * t
            row.append(p)
        rows.append(row)
    parts.append(fk.loft("sumo.combed-hair", rows, HAIR, end="pole", levels=1, recalc=True))
    path = [V(0, -.038, 1.321), V(0, -.057, 1.357), V(0, -.005, 1.378),
            V(0, .060, 1.359), V(0, .077, 1.342)]
    smooth = kit.smooth_path(path, samples=8)
    radii = [(.030 + .016 * math.sin(i / (len(smooth) - 1) * math.pi),
              .010 + .010 * math.sin(i / (len(smooth) - 1) * math.pi)) for i in range(len(smooth))]
    parts.append(fk.tube("sumo.folded-topknot", smooth, radii, HAIR, n=64,
                         up=(1, 0, 0), caps=("dome", "dome"), levels=2))
    for i in range(-6, 7):
        ridge = [V(p) + V(i * .0046, 0, .013 + .006 * math.sin(j / (len(smooth) - 1) * math.pi))
                 for j, p in enumerate(smooth)]
        parts.append(fk.tube(f"sumo.topknot-ridge-{i}", ridge, [.0009] * len(ridge),
                             HAIR, n=8, caps=("dome", "dome")))
    tie = [V(-.039, -.046, 1.348), V(-.028, -.052, 1.353),
           V(.028, -.052, 1.353), V(.039, -.046, 1.348)]
    parts.append(fk.tube("sumo.topknot-binding", tie, [.0024] * 4, CORD, n=12))
    return parts


def face_details():
    parts = []
    for s in (-1, 1):
        centre = head_point(math.radians(s * 25), 1.201, .005)
        parts.append(fk.ball(f"sumo.eye-{s}", 1, centre, EYE,
                             scale=(.017, .006, .0064), seg=48, rings=24))
        parts.append(fk.ball(f"sumo.iris-{s}", 1, centre + V(-s * .001, .0055, -.0007),
                             IRIS, scale=(.0042, .0014, .0047), seg=40, rings=20))
        for upper in (False, True):
            path = []
            for t in np.linspace(-1, 1, 22):
                z = .002 + (1 - t * t) * .0032 if upper else -.002 - (1 - t * t) * .0018
                path.append(centre + V(t * .016, .0025, z))
            parts.append(fk.tube(f"sumo.eyelid-{s}-{upper}", path, [.0019] * len(path),
                                 SKIN, n=10, caps=("dome", "dome")))
        path = [head_point(math.radians(s * ad), 1.222 - .006 * (ad - 12) / 29, .003)
                for ad in np.linspace(12, 41, 25)]
        parts.append(fk.tube(f"sumo.brow-{s}", path, [.0032] * len(path), HAIR,
                             n=12, caps=("dome", "dome")))
        at = head_point(math.radians(s * 15), 1.165, .0002)
        parts.append(fk.ball(f"sumo.nostril-{s}", 1, at, DARK,
                             scale=(.0026, .0011, .0012), seg=24, rings=12))
    path = [head_point(math.radians(a), 1.1375 - .002 * (abs(a) / 25) ** 1.6, .0008)
            for a in np.linspace(-23, 23, 45)]
    parts.append(fk.tube("sumo.mouth-shadow", path, [.001] * len(path), DARK, n=10))
    return parts


def surface_finish():
    # Master preview has controlled microstructure; the optimized runtime
    # copy will bake it after the anatomy/deformation review.
    for name, roughness in ((SKIN, .64), (HAIR, .48), (CLOTH, .85), (EDGE, .85)):
        mat = kit.material(name)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Specular IOR Level"].default_value = .25
        bsdf.inputs["Coat Weight"].default_value = .025 if name == SKIN else .05 if name == HAIR else 0
        bsdf.inputs["Coat Roughness"].default_value = .65 if name == SKIN else .55
        if name == SKIN:
            bsdf.inputs["Subsurface Weight"].default_value = .05
            bsdf.inputs["Subsurface Radius"].default_value = (.008, .004, .002)
            noise = nodes.new("ShaderNodeTexNoise")
            noise.inputs["Scale"].default_value = 230
            noise.inputs["Detail"].default_value = 2
            bump = nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = .12
            bump.inputs["Distance"].default_value = .0005
            links.new(noise.outputs["Fac"], bump.inputs["Height"])
            links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        elif name in (CLOTH, EDGE):
            bsdf.inputs["Sheen Weight"].default_value = .17
            wave = nodes.new("ShaderNodeTexWave")
            wave.wave_type = "BANDS"
            wave.bands_direction = "X"
            wave.inputs["Scale"].default_value = 175
            wave.inputs["Distortion"].default_value = .15
            bump = nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = .19
            bump.inputs["Distance"].default_value = .00045
            links.new(wave.outputs["Color"], bump.inputs["Height"])
            links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        layer = o.data.color_attributes.get("AO") or o.data.color_attributes.new(
            name="AO", type="FLOAT_COLOR", domain="CORNER")
        layer.data.foreach_set("color", np.ones(len(layer.data) * 4, dtype=np.float32))


def finish_ao(root):
    """Combine editable anatomical skin pigment with the current AO bake.

    Colour follows tissue rather than a repeated leather tile: warmer ears,
    cheek/nose, knuckles and elbows, with quiet broad skin variation. The
    separate pigment layer remains editable in the detailed master.
    """
    kit.refresh()
    inv_root = root.matrix_world.inverted()
    for o in kit.descendants(root):
        if o.type != "MESH" or not any(m.name in (SKIN, NAIL) for m in o.data.materials):
            continue
        coords = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get("co", coords)
        coords = coords.reshape(-1, 3)
        matrix = np.array(inv_root @ o.matrix_world)
        coords = (coords @ matrix[:3, :3].T + matrix[:3, 3]) / K
        x, y, z = coords.T
        ear = np.exp(-((np.abs(x) - .119) / .024) ** 2 - ((z - 1.174) / .056) ** 2 - ((y + .012) / .040) ** 2)
        cheek = np.exp(-((np.abs(x) - .075) / .026) ** 2 - ((z - 1.172) / .031) ** 2) * (y > .025)
        nose = np.exp(-(x / .030) ** 2 - ((z - 1.177) / .030) ** 2) * (y > .07)
        knuckle = np.exp(-((np.abs(x) - .45) / .09) ** 2 - ((z - .48) / .047) ** 2)
        elbow = np.exp(-((np.abs(x) - .41) / .065) ** 2 - ((z - .742) / .050) ** 2)
        heat = np.clip(ear * .85 + cheek * .75 + nose * .5 + knuckle * .65 + elbow * .40, 0, 1)
        broad = .012 * np.sin(x * 9 + z * 6) * np.cos(y * 8 - z * 3)
        pigment = np.ones((len(coords), 4), dtype=np.float32)
        pigment[:, 0] = .990 + .010 * heat + broad
        pigment[:, 1] = .985 - .035 * heat + broad * .7
        pigment[:, 2] = .975 - .055 * heat + broad * .5
        pigment[:, :3] = np.clip(pigment[:, :3], 0, 1)
        layer = o.data.color_attributes.get("SkinPigment") or o.data.color_attributes.new(
            name="SkinPigment", type="FLOAT_COLOR", domain="POINT")
        layer.data.foreach_set("color", pigment.reshape(-1))
        ao = o.data.color_attributes.get("AO")
        if ao:
            loops = np.empty(len(o.data.loops), dtype=np.int32)
            o.data.loops.foreach_get("vertex_index", loops)
            values = np.empty(len(ao.data) * 4, dtype=np.float32)
            ao.data.foreach_get("color", values)
            values = values.reshape(-1, 4)
            values[:, :3] *= pigment[loops, :3]
            ao.data.foreach_set("color", values.reshape(-1))
            o.data.color_attributes.active_color = ao
            o.data.color_attributes.render_color_index = list(o.data.color_attributes).index(ao)


def build_master():
    root = kit.empty("sumo")
    parts = [torso()] + head()
    nails = []
    for s in (-1, 1):
        pieces, plates = hand(s)
        parts += [arm(s), leg(s)] + pieces + foot(s)
        nails += [(o, "handL" if s < 0 else "handR") for o in plates]
    skin = fuse(parts)
    for v in skin.data.vertices:
        v.co *= K
    rig = make_rig(root)
    weight_skin(skin, rig)
    belt, fringe = mawashi()
    for o in belt:
        bone_attach(o, rig, "torso")
    for o in fringe:
        bone_attach(o, rig, "extra")
    for o in hair():
        bone_attach(o, rig, "hair")
    attach_faces(face_details(), rig)
    for o, bone in nails:
        bone_attach(o, rig, bone)
    surface_finish()
    finish_ao(root)
    root["masterBrief"] = "work/arena/2026-10-04-rebuild/sumo/brief.md"
    root["authorScale"] = K
    root["skinContract"] = "continuous linear skin; common joint axes; named bone attachments"
    root["unoptimized"] = True
    print(f"SUMO MASTER: {len(skin.data.vertices)} editable skin vertices, {len(skin.data.polygons)} faces")
    kit.refresh()
    return root
