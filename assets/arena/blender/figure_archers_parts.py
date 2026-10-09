"""Cadet parts that ride the skeleton or sit on the suit: boots, gloves,
the two heads, the helmet and neck ring, chest unit, life-support pack and
antenna, belt, and the ray gun. Geometry is authored in world rest
coordinates (Blender, +Y forward, Z up, metres); figure_archers_sculpt.py
weights or attaches it.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as fk
import figure_archers_sculpt as S
from figure_archers_sculpt import (V, R, TAU, g, table, adeg, line_path,
                                   ANKLE, KNEE, WRIST, ELBOW)

# ------------------------------------------------------------- helpers


def remesh(obj, voxel, smooth=2, factor=.5):
    kit.apply(obj)
    mod = obj.modifiers.new("Fused", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    kit.apply(obj)
    if smooth:
        mod = obj.modifiers.new("Soften", "SMOOTH")
        mod.factor, mod.iterations = factor, smooth
        kit.apply(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def union(pieces, name, voxel, mat, smooth=2):
    o = kit.join(pieces, name)
    remesh(o, voxel, smooth)
    o.data.materials.clear()
    o.data.materials.append(kit.material(mat))
    return o


def lathe(name, profile, mat, centre, axis=(0, 0, 1), seg=48, cap0=True,
          cap1=True):
    """Revolve [(radius, height)] about `axis` through `centre`."""
    axis = Vector(axis).normalized()
    u = axis.orthogonal().normalized()
    w = axis.cross(u)
    rings = []
    for r, h in profile:
        rings.append([Vector(centre) + axis * h +
                      (u * math.cos(i / seg * TAU) + w * math.sin(i / seg * TAU)) * r
                      for i in range(seg)])
    return fk.loft(name, rings, mat, start="pole" if cap0 else None,
                   end="pole" if cap1 else None, recalc=True)


def smooth_shade(o):
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def solidify(o, thickness, offset=-1.0):
    mod = o.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    mod.use_rim = True
    mod.use_even_offset = False
    kit.apply(o)
    return o


def shrink_onto(o, target, offset):
    mod = o.modifiers.new("Onto suit", "SHRINKWRAP")
    mod.target = target
    mod.wrap_method = "NEAREST_SURFACEPOINT"
    mod.wrap_mode = "OUTSIDE_SURFACE"
    mod.offset = offset
    kit.apply(o)
    return o


# ------------------------------------------------------------- boots
# Chunky moon boots: a rounded foot and a straight shaft to mid-calf with a
# rolled cuff, on a dark ribbed sole; a cobalt stripe up the front and
# another down the outer side.

BOOT_TOP = .262


def boot_axis(s, z):
    a, k = ANKLE[s], KNEE[s]
    t = (z - a.z) / (k.z - a.z)
    return a + (k - a) * t


def boot_shell(s):
    pieces = []
    rings = []
    for z in np.linspace(.060, BOOT_TOP, 26):
        c = boot_axis(s, z)
        r = .060 + .004 * g(z, .14, .05) + .003 * (z - .06) / .2
        rings.append([c + V(math.sin(a) * r * 1.0, math.cos(a) * r * 1.04, 0)
                      for a in np.linspace(0, TAU, 56, endpoint=False)])
    pieces.append(fk.loft(f"{R}.boot-shaft-{s}", rings, S.BOOT,
                          start="pole", end="pole"))
    # The rolled cuff.
    cuff = []
    for k, (dr, dz) in enumerate([(-.004, -.012), (.004, -.012), (.010, -.004),
                                  (.010, .006), (.004, .012), (-.004, .013),
                                  (-.010, .006)]):
        z = BOOT_TOP + dz
        c = boot_axis(s, z)
        r = .066 + dr
        cuff.append([c + V(math.sin(a) * r, math.cos(a) * r * 1.04, 0)
                     for a in np.linspace(0, TAU, 56, endpoint=False)])
    pieces.append(fk.loft(f"{R}.boot-cuff-{s}", cuff + [cuff[0]], S.BOOT,
                          start=None, end=None))
    # The foot: sections along the boot's length (y), a high rounded toe.
    a = ANKLE[s]
    toe_out = math.radians(6) * s
    fwd = V(math.sin(toe_out), math.cos(toe_out), 0)
    side = V(fwd.y, -fwd.x, 0)
    rows = []
    sections = [(-.085, .030, .045, .022), (-.072, .050, .070, .024),
                (-.040, .056, .084, .026), (0, .057, .086, .026),
                (.050, .060, .072, .026), (.100, .062, .062, .026),
                (.140, .058, .052, .025), (.168, .046, .040, .022),
                (.186, .024, .024, .016)]
    for t in np.linspace(-.085, .186, 40):
        width, top, low = table(sections, t)
        o = V(a.x, a.y, .040) + fwd * t
        row = []
        for ang in np.linspace(0, TAU, 56, endpoint=False):
            sn, cs = math.sin(ang), math.cos(ang)
            p = o + side * sn * width + V(0, 0, cs * (top if cs >= 0 else low))
            p.z = max(.024, p.z)
            row.append(p)
        rows.append(row)
    pieces.append(fk.loft(f"{R}.boot-foot-{s}", rows, S.BOOT,
                          start="pole", end="pole"))
    shell = union(pieces, f"{R}.boot-{s}", .0024, S.BOOT, smooth=3)
    # Soft creases where the shaft flexes over the instep.
    return shell


def boot_sole(s):
    a = ANKLE[s]
    toe_out = math.radians(6) * s
    fwd = V(math.sin(toe_out), math.cos(toe_out), 0)
    side = V(fwd.y, -fwd.x, 0)
    outline = []
    for ang in np.linspace(0, TAU, 72, endpoint=False):
        sn, cs = math.sin(ang), math.cos(ang)
        # A rounded boot print, wider at the ball than the heel.
        length = .142 if cs > 0 else .094
        wid = .064 * (1 + .06 * cs) if cs > -.3 else .058
        p = V(a.x, a.y, 0) + fwd * (.048 + cs * length) + side * sn * wid
        outline.append(p)
    rings = []
    for z, grow in ((.000, -.004), (.004, 0), (.022, 0), (.028, -.003)):
        c = V(a.x, a.y, 0) + fwd * .048
        rings.append([c + (p - c) * (1 + grow / .1) + V(0, 0, z)
                      for p in outline])
    sole = fk.loft(f"{R}.sole-{s}", rings, S.SOLE, start="pole", end="pole")
    # Tread ribs round the sole's wall.
    ribs = []
    for k in range(3):
        z = .008 + k * .006
        ring = [V(p.x, p.y, z) + (p - (V(a.x, a.y, 0) + fwd * .048)).normalized() * .003
                for p in outline]
        ribs.append(fk.tube(f"{R}.sole-rib-{s}-{k}", ring + [ring[0]],
                            [.0022] * (len(ring) + 1), S.SOLE, n=6,
                            caps=(None, None)))
    return [sole] + ribs


# ------------------------------------------------------------- gloves
# Built in a canonical right hand: wrist at the origin, fingers along -Z,
# palm facing -X, thumb towards +Y. The left glove is the mirror image.

FINGERS = [  # (y at the knuckle, lengths, radius)
    (.027, (.033, .021, .018), .0102),
    (.009, (.036, .023, .019), .0106),
    (-.009, (.034, .022, .018), .0102),
    (-.026, (.027, .018, .016), .0092)]
KNUCKLE_Z = -.082
# The gun grip through the right fist, in canonical hand space.
GRIP_C = V(-.026, -.006, -.062)
GRIP_R = .016


def finger_path(base, lengths, flex, spread=0.0):
    """Joint points of a finger bending towards the palm (-X)."""
    pts = [base]
    angle = 0.0
    p = base.copy()
    for length, bend in zip(lengths, flex):
        angle += math.radians(bend)
        d = V(-math.sin(angle), math.sin(spread) * .3, -math.cos(angle))
        p = p + d.normalized() * length
        pts.append(p)
    return pts


def wrap_path(base, lengths, centre, radius):
    """A finger wrapped round a grip: joints on a circle about the grip's
    axis (Y), so the knuckles stand proud of the chords between them."""
    rel = V(base.x - centre.x, 0, base.z - centre.z)
    start = math.atan2(rel.z, rel.x)
    pts = [base]
    angle = start
    for length in lengths:
        # The chord of `length` on the circle subtends this angle.
        angle -= 2 * math.asin(min(.999, length / (2 * radius)))
        pts.append(V(centre.x + radius * math.cos(angle), base.y,
                     centre.z + radius * math.sin(angle)))
    return pts


def digit(name, pts, r, mat):
    """A padded glove finger through its joint points: full at the knuckle,
    a slight waist on each phalanx, a domed tip."""
    path = [V(q) for q in kit.smooth_path(pts, samples=8)] if len(pts) > 2 else pts
    n = len(path)
    radii = []
    for i in range(n):
        t = i / (n - 1)
        bulge = 1 + .07 * math.cos(t * (len(pts) - 1) * TAU)
        radii.append(r * (1.0 - .16 * t) * bulge)
    return fk.tube(name, path, radii, mat, n=14, up=(1, 0, 0),
                   caps=("dome", "dome"))


def palm_block(name, mat, thick=1.0):
    rows = []
    sections = [(0, .025, .017), (-.018, .031, .019), (-.045, .037, .018),
                (-.070, .039, .016), (-.086, .036, .013)]
    for z in np.linspace(0, -.088, 18):
        hw, ht = table(sections, z)
        ht *= thick
        row = []
        for a in np.linspace(0, TAU, 40, endpoint=False):
            sn, cs = math.sin(a), math.cos(a)
            # Back of the hand (+X) domed, the palm flatter with a heel.
            x = cs * ht * (1.0 if cs > 0 else .85)
            if cs < 0:
                x -= .004 * g(z, -.020, .014) * (1 - abs(sn))
            row.append(V(x, sn * hw, z))
        rows.append(row)
    return fk.loft(name, rows, mat, start="pole", end="pole")


def thumb(name, mat, grip=True):
    if grip:
        pts = [V(-.010, .026, -.016), V(-.030, .034, -.030),
               V(-.050, .032, -.046), V(-.058, .026, -.064)]
    else:
        pts = [V(-.010, .024, -.016), V(-.020, .038, -.034),
               V(-.026, .042, -.054), V(-.026, .040, -.070)]
    return digit(name, pts, .0118, mat)


def cuff(name, mat):
    """The gauntlet: a flared cuff over the sleeve end, with a rolled
    edge, from the wrist up the forearm."""
    rings = []
    for z, r in ((-.010, .028), (.000, .031), (.020, .038), (.040, .045),
                 (.050, .049), (.056, .050), (.060, .047), (.058, .043)):
        rings.append([V(math.cos(a) * r * 1.02, math.sin(a) * r, z)
                      for a in np.linspace(0, TAU, 48, endpoint=False)])
    return fk.loft(name, rings, mat, start="pole", end=None)


def glove_canonical(kind):
    """kind 'fist' (round the gun grip) or 'cup' (a loose support hand)."""
    pieces = [palm_block(f"{R}.palm-{kind}", S.GLOVE)]
    for i, (y, lengths, r) in enumerate(FINGERS):
        base = V(.002, y, KNUCKLE_Z + .004 * abs(i - 1.2))
        if kind == "fist":
            if i == 0:
                # The index finger lies along the trigger.
                pts = finger_path(base, lengths, (38, 52, 22))
            else:
                pts = wrap_path(base, lengths, V(GRIP_C.x, y, GRIP_C.z),
                                GRIP_R + r + .0015)
        else:
            curl = (24 + 4 * i, 38 + 3 * i, 22)
            pts = finger_path(base, lengths, curl, spread=(i - 1.5) * .08)
        pieces.append(digit(f"{R}.finger-{kind}-{i}", pts, r, S.GLOVE))
    pieces.append(thumb(f"{R}.thumb-{kind}", S.GLOVE, grip=kind == "fist"))
    glove = union(pieces, f"{R}.glove-{kind}", .0013, S.GLOVE, smooth=2)
    gauntlet = cuff(f"{R}.cuff-{kind}", S.GLOVE)
    solidify(gauntlet, .0028, offset=-1)
    return glove, gauntlet


def hand_frame(s, pronate=0.0):
    """World rest frame of a hand: canonical (X, Y, Z) as world columns."""
    d = (WRIST[s] - ELBOW[s]).normalized()
    zc = -d
    xc = V(1, 0, 0)
    xc = (xc - zc * xc.dot(zc)).normalized()
    yc = zc.cross(xc)
    m = Matrix((xc, yc, zc)).transposed()
    if pronate:
        m = m @ Matrix.Rotation(pronate, 3, "Z")
    return m


def hand_matrix(s):
    """Canonical right-hand space -> world rest. The left glove is the
    mirror image (palm towards +X), placed in the left hand's frame."""
    m = Matrix.Translation(WRIST[s]) @ hand_frame(s).to_4x4()
    if s < 0:
        m = m @ Matrix.Diagonal((-1, 1, 1, 1))
    return m


def place(obj, s):
    obj.data.transform(hand_matrix(s))
    if s < 0:
        obj.data.flip_normals()
    obj.data.update()
    return obj


def gloves():
    out = {}
    for s, kind in ((1, "fist"), (-1, "cup")):
        glove, gauntlet = glove_canonical(kind)
        for o in (glove, gauntlet):
            place(o, s)
        out[s] = kit.join([glove, gauntlet], f"{R}.glove-{'R' if s > 0 else 'L'}")
        smooth_shade(out[s])
    return out[-1], out[1]


# ------------------------------------------------------------- the gun
# Gun space: grip centre at the origin, barrel along +Y, up +Z, right +X.
# A bulbous chrome body, a finned barrel with cobalt spacers, a red glowing
# emitter in a flared bell, a black grip with finger grooves.

BARREL_Z = .062
MUZZLE = V(0, .236, BARREL_Z)
GUN_SCALE = .94
GRIP_RAKE = math.radians(15)


def ray_gun():
    P = []
    # The body: an egg along Y, fullest behind the middle.
    prof = [(.000, -.092), (.016, -.090), (.026, -.082), (.034, -.062),
            (.037, -.035), (.036, -.005), (.033, .030), (.028, .060),
            (.024, .074), (.000, .076)]
    P.append(lathe(f"{R}.gun-body", [(r, y) for r, y in prof], S.CHROME,
                   V(0, 0, BARREL_Z), axis=(0, 1, 0), seg=48))
    # A team band round the body's waist and the rear cap.
    P.append(lathe(f"{R}.gun-band", [(.0372, -.050), (.0386, -.046),
                                     (.0388, -.034), (.0374, -.030)],
                   S.PACK, V(0, 0, BARREL_Z), axis=(0, 1, 0), seg=48,
                   cap0=False, cap1=False))
    P.append(fk.ball(f"{R}.gun-knob", 1, V(0, -.096, BARREL_Z), S.CHROME,
                     scale=(.015, .012, .015), seg=24, rings=12))
    # Barrel with four cooling fins and cobalt spacers.
    P.append(lathe(f"{R}.gun-barrel", [(.0175, .060), (.0175, .196)],
                   S.CHROME, V(0, 0, BARREL_Z), axis=(0, 1, 0), seg=40))
    for k, y in enumerate((.090, .116, .142, .168)):
        P.append(lathe(f"{R}.gun-fin-{k}", [(.017, y - .006), (.029, y - .005),
                                            (.032, y - .002), (.032, y + .002),
                                            (.029, y + .005), (.017, y + .006)],
                       S.CHROME, V(0, 0, BARREL_Z), axis=(0, 1, 0), seg=40,
                       cap0=False, cap1=False))
        if k < 3:
            P.append(lathe(f"{R}.gun-spacer-{k}", [(.0215, y + .007),
                                                   (.0235, y + .009),
                                                   (.0235, y + .017),
                                                   (.0215, y + .019)],
                           S.PACK, V(0, 0, BARREL_Z), axis=(0, 1, 0), seg=40,
                           cap0=False, cap1=False))
    # The emitter bell, its glowing lens and the needle.
    P.append(lathe(f"{R}.gun-bell", [(.0175, .190), (.020, .198), (.027, .212),
                                     (.033, .224), (.034, .228), (.030, .229),
                                     (.024, .222)],
                   S.CHROME, V(0, 0, BARREL_Z), axis=(0, 1, 0), seg=48,
                   cap0=False, cap1=False))
    P.append(fk.ball(f"{R}.gun-lens", 1, V(0, .222, BARREL_Z), S.RAY,
                     scale=(.025, .010, .025), seg=32, rings=14))
    P.append(fk.tube(f"{R}.gun-needle", [V(0, .222, BARREL_Z), V(0, .238, BARREL_Z)],
                     [.0035, .0018], S.CHROME, n=10, caps=(None, "dome")))
    # Dorsal fin and a sight knob.
    fin = []
    for y, h in ((-.060, .000), (-.040, .018), (-.010, .028), (.020, .026),
                 (.040, .012), (.052, .000)):
        fin.append((y, BARREL_Z + .030 + h))
    outline = [(y, z) for y, z in fin] + [(.052, BARREL_Z + .026), (-.060, BARREL_Z + .026)]
    P.append(_fin(outline))
    P.append(fk.tube(f"{R}.gun-sight", [V(0, .030, BARREL_Z + .030),
                                         V(0, .034, BARREL_Z + .048)],
                     [.0035, .0035], S.CHROME, n=10, caps=(None, None)))
    P.append(fk.ball(f"{R}.gun-sight-ball", 1, V(0, .035, BARREL_Z + .052),
                     S.PACK, scale=(.0075, .0075, .0075), seg=20, rings=10))
    # The grip: raked back, finger grooves in front, a chrome butt cap.
    u = V(0, -math.sin(GRIP_RAKE), -math.cos(GRIP_RAKE))
    front = V(0, math.cos(GRIP_RAKE), -math.sin(GRIP_RAKE))
    rows = []
    for t in np.linspace(-.032, .046, 26):
        c = u * t + V(0, .002, 0)
        row = []
        for a in np.linspace(0, TAU, 40, endpoint=False):
            sn, cs = math.sin(a), math.cos(a)
            depth = .0155 + (.0022 * math.sin((t + .032) / .078 * 3 * math.pi) ** 2
                             if cs > .3 else 0) * cs
            row.append(c + V(sn * .0128, 0, 0) + front * cs * depth)
        rows.append(row)
    P.append(fk.loft(f"{R}.gun-grip", rows, S.GRIP, start="pole", end="pole"))
    P.append(fk.ball(f"{R}.gun-butt", 1, u * .050 + V(0, .002, 0), S.CHROME,
                     scale=(.015, .019, .009), seg=24, rings=10))
    # Trigger guard and trigger.
    guard = [V(0, .018, .022), V(0, .020, .002), V(0, .034, -.014),
             V(0, .058, -.010), V(0, .064, .010), V(0, .060, .022)]
    P.append(fk.tube(f"{R}.gun-guard", kit.smooth_path(guard, 6),
                     [.0034] * len(kit.smooth_path(guard, 6)), S.CHROME, n=10,
                     caps=("dome", "dome")))
    trig = [V(0, .036, .016), V(0, .036, .004), V(0, .031, -.004)]
    P.append(fk.tube(f"{R}.gun-trigger", trig, [.0035, .003, .0026], S.RAY.replace("glow", "resin"),
                     n=10, caps=("dome", "dome")))
    # A ribbed pad under the barrel root for the support hand.
    P.append(lathe(f"{R}.gun-pad", [(.000, .052), (.019, .053), (.0205, .062),
                                    (.0205, .102), (.019, .110), (.000, .111)],
                   S.GRIP, V(0, 0, BARREL_Z - .006), axis=(0, 1, 0), seg=32))
    for k in range(5):
        y = .066 + k * .009
        P.append(lathe(f"{R}.gun-rib-{k}", [(.0204, y - .002), (.0222, y),
                                            (.0204, y + .002)],
                       S.GRIP, V(0, 0, BARREL_Z - .006), axis=(0, 1, 0), seg=32,
                       cap0=False, cap1=False))
    for o in P:
        o.data.transform(Matrix.Scale(GUN_SCALE, 4))
        smooth_shade(o)
    return P


def _fin(outline):
    bm = bmesh.new()
    left = [bm.verts.new((-.004, y, z)) for y, z in outline]
    right = [bm.verts.new((.004, y, z)) for y, z in outline]
    bm.faces.new(left[::-1])
    bm.faces.new(right)
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = kit._from_bmesh(f"{R}.gun-fin", bm, S.CHROME)
    kit.add_bevel(o, .0025, 2, angle=30)
    kit.apply(o)
    return o


def gun_to_hand():
    """Gun space -> canonical right hand: the grip along the knuckle line,
    the barrel 15 degrees past square to it (the wrist's natural cock)."""
    rot = Matrix.Rotation(-math.pi / 2 + GRIP_RAKE, 4, "X")
    return Matrix.Translation(GRIP_C) @ rot


def gun_rest_matrix():
    """Gun space -> world rest (in the right fist)."""
    frame = hand_frame(1).to_4x4()
    return Matrix.Translation(WRIST[1]) @ frame @ gun_to_hand()


# ------------------------------------------------------------- heads
# A young adult in the cartoony collector style, readable through glass from
# the high game camera: bold brows, big eyes, a set mouth. Look A is him
# (square jaw, strong brow, side-parted pompadour), look B is her (softer
# jaw, high cheekbones, full lips, a wavy chin-length bob).

HEAD = [(.950, .043, .040, .046), (.990, .043, .041, .047),
        (1.020, .049, .052, .054), (1.040, .057, .068, .062),
        (1.060, .063, .076, .070), (1.085, .068, .080, .077),
        (1.110, .071, .080, .083), (1.135, .071, .078, .087),
        (1.160, .068, .073, .088), (1.185, .060, .062, .082),
        (1.204, .045, .044, .064), (1.216, .014, .014, .018)]
EYE_Z = 1.127
EYE_X = .029


def head_point(a, z, look="A", extra=0.0):
    """A point on the head: super-elliptic sections (rounder below the
    cheekbones) carrying sculpted planes: brow ridge, deep-set sockets,
    a straight nose with a soft tip, cheekbones over a hollow, a jaw that
    recedes from a square chin (rounder for her), full set lips."""
    width, front, back = table(HEAD, z)
    sn, cs = math.sin(a), math.cos(a)
    ad = adeg(a)
    her = look == "B"
    width += (.0045 if not her else -.001) * g(z, 1.052, .016) * g(ad, 72, 18)
    width += .003 * g(z, 1.112, .016) * g(ad, 70, 20)
    if her:
        width -= .003 * g(z, 1.045, .02)
    p = 2.0 + .25 * float(np.clip((z - 1.07) / .06, 0, 1))
    x = math.copysign(abs(sn) ** (2 / p), sn) * (width + extra)
    y = math.copysign(abs(cs) ** (2 / p), cs) * ((front if cs >= 0 else back) + extra)
    if ad < 95 and extra < .004:
        brow = .0080 if not her else .0042
        nose = .016 if not her else .0125
        y += brow * g(z, 1.1445, .0072) * g(ad, 20, 20)
        y += .0022 * g(z, 1.142, .006) * g(ad, 0, 6)              # glabella
        y -= .0092 * g(z, EYE_Z, .0110) * g(ad, 26, 12)            # sockets
        y -= .0028 * g(z, 1.137, .006) * g(ad, 7, 5)               # bridge root
        profile = table([(1.084, 0), (1.090, .55), (1.097, 1.0), (1.105, .85),
                         (1.118, .55), (1.132, .36), (1.142, .2), (1.15, 0)], z)[0]
        y += nose * profile * g(ad, 0, 7 + 4 * g(z, 1.096, .008))
        y += .0030 * g(z, 1.0985, .0055) * g(ad, 0, 9)              # tip bulb
        y += .0018 * g(z, 1.0925, .0050) * g(ad, 10, 4)             # alar wings
        y -= .0022 * g(ad, 21, 5) * g(z, 1.080, .011)              # nasolabial
        y += (.0060 if not her else .0070) * g(z, 1.110, .012) * g(ad, 44, 13)
        y -= .0035 * g(z, 1.082, .012) * g(ad, 52, 12)             # hollow
        y -= (.0070 if not her else .0080) * g(z, 1.048, .014) * g(ad, 44, 14)
        y -= .0014 * g(ad, 0, 2.8) * g(z, 1.080, .0040)             # philtrum
        upper = .0030 if not her else .0045
        lower = .0038 if not her else .0055
        y += upper * g(z, 1.0735, .0040) * g(ad, 0, 15)
        y += lower * g(z, 1.0615, .0042) * g(ad, 0, 13)
        y -= .0032 * g(z, 1.0675, .0022) * g(ad, 0, 16)
        y -= .0014 * g(z, 1.0675, .0030) * g(ad, 17, 3)            # corners
        y -= .0020 * g(z, 1.055, .0040) * g(ad, 0, 10)             # lip shadow
        chin = .011 if not her else .008
        y += chin * g(z, 1.046, .0100) * g(ad, 0, 22 if not her else 15)
        if not her:
            y -= .0012 * g(ad, 0, 2.5) * g(z, 1.046, .006)         # cleft
        y -= .003 * g(ad, 62, 10) * g(z, 1.15, .015)               # temples
    return V(x, y + .002, z)


def head_mesh(look):
    rows = [[head_point(i / 176 * TAU, z, look) for i in range(176)]
            for z in np.linspace(HEAD[0][0], HEAD[-1][0], 300)]
    return smooth_shade(fk.loft(f"{R}.face-{look}", rows, S.SKIN[look],
                                start="pole", end="pole"))


def ears(look):
    out = []
    for s in (-1, 1):
        rows = []
        for r in np.linspace(.002, 1, 18):
            row = []
            for a in np.linspace(0, TAU, 32, endpoint=False):
                sn, cs = math.sin(a), math.cos(a)
                rim = .006 * g(r, .85, .14)
                row.append(V(s * (.062 + rim + .004 * r),
                             -.010 + sn * .014 * r, 1.122 + cs * .021 * r))
            rows.append(row)
        for r in np.linspace(.95, .002, 10):
            rows.append([V(s * (.058 + .002 * r), -.010 + math.sin(a) * .014 * r,
                           1.122 + math.cos(a) * .021 * r)
                         for a in np.linspace(0, TAU, 32, endpoint=False)])
        out.append(fk.loft(f"{R}.ear-{look}-{s}", rows, S.SKIN[look],
                           start="pole", end="pole"))
    return out


def hair_him():
    """A side-parted 1960s pompadour: short and tight at the back and
    sides, a combed quiff rising off the forehead and swept back, the
    parting on his left."""
    hairline = [(0, 1.176), (25, 1.174), (45, 1.164), (62, 1.142),
                (78, 1.122), (92, 1.128), (120, 1.110), (150, 1.084),
                (180, 1.078)]
    rows = []
    for t in np.linspace(0, 1, 48):
        row = []
        for i in range(144):
            a = i / 144 * TAU
            ad = adeg(a)
            z0 = table(hairline, ad)[0]
            z = z0 * (1 - t) + 1.214 * t
            lift = math.sin(math.pi / 2 * min(1, t * 7)) ** .6
            thick = .0045 + .0035 * t
            side = math.sin(a)
            # The quiff rises steeply from the hairline, fullest over his
            # right brow (away from the parting), and sweeps back over the
            # crown, its combed grooves running back.
            front = g(ad, 8 + 12 * side, 46)
            rise = math.sin(math.pi * min(1, t / .95)) ** .55
            quiff = .026 * front * rise * (1 + .22 * side)
            groove = .0011 * math.cos(a * 36 + t * 5 - side * 3) * lift
            part = -.0035 * g(math.degrees(a), -36, 3.5) * (t > .10)
            extra = (thick + groove + part) * lift + quiff * .25 * lift + .0008
            p = head_point(a, min(z, 1.212), "A", extra)
            p.z = z + quiff * lift + .003 * lift * t
            row.append(p)
        rows.append(row)
    return [smooth_shade(fk.loft(f"{R}.hair-A", rows, S.HAIR["A"], end="pole"))]


def hair_her():
    """A chin-length 1960s bob: a deep side part on her left, a swept
    fringe, full sides that fall past the ears and flip in at the jaw."""
    rows = []
    hairline = [(0, 1.176), (30, 1.172), (55, 1.160), (75, 1.150),
                (100, 1.150), (180, 1.150)]
    def edge(ad):
        z58 = table(hairline, 58)[0]
        if ad < 58:
            return table(hairline, ad)[0]
        k = min(1, (ad - 58) / 24)
        k = k * k * (3 - 2 * k)
        return z58 + (1.052 + .010 * g(ad, 180, 50) - z58) * k

    for t in np.linspace(0, 1, 44):
        row = []
        for i in range(132):
            a = i / 132 * TAU
            ad = adeg(a)
            side = math.sin(a)
            top = 1.226
            z0 = edge(ad) - .008 * g(math.degrees(a), 30, 18) * (ad < 58)
            z = z0 * (1 - t) + top * t
            hang = ad > 50
            body = .012 + .015 * (1 - t) * min(1, max(0, (ad - 45) / 25))
            wave = .0026 * math.sin(z * 240 + side * 2) * hang
            groove = .0010 * math.cos(a * 34 + t * 8)
            fringe = .009 * g(math.degrees(a), 26, 24) * g(t, .18, .18)
            zs = max(z, 1.118)
            p = head_point(a, zs, "B", body + wave + groove + fringe)
            if z < zs:
                # Below the widest skull the hair falls straight, then
                # flips in towards the jaw.
                curl = .14 * (1 - min(1, max(0, (z - 1.050) / .030)))
                p = V(p.x * (1 - curl), p.y * (1 - curl * .6), z)
            row.append(p)
        rows.append(row)
    shell = fk.loft(f"{R}.hair-B", rows, S.HAIR["B"], end="pole")
    solidify(shell, .006, offset=-1)
    return [shell]


def lips_her():
    """Her painted lips, laid over the sculpted mouth."""
    out = []
    for name, zc, h, w in (("upper", 1.0730, .0046, 17), ("lower", 1.0618, .0050, 14)):
        rows = []
        for v in np.linspace(-1, 1, 9):
            row = []
            for ad in np.linspace(-w, w, 25):
                z = zc + v * h * (1 - (ad / w) ** 2) ** .6
                p = head_point(math.radians(ad), z, "B")
                n = (p - V(0, 0, z)).normalized()
                row.append(p + n * .0009)
            rows.append(row)
        sheet = fk.Mesh(f"{R}.lips-{name}", S.LIPS["B"])
        verts = [[sheet.v(p) for p in row] for row in rows]
        sheet.grid(verts, S.LIPS["B"])
        o = sheet.obj(outward=V(0, 0, 1.067))
        solidify(o, .0012, offset=-1)
        out.append(o)
    return out


def face_features():
    """Shared face controls (both looks): eye whites with their irises,
    brows and the mouth line, plus fixed upper lash lines."""
    parts = []
    for s in (-1, 1):
        c = head_point(math.radians(s * 25), EYE_Z, "A") + V(0, -.0015, 0)
        parts.append(fk.ball(f"{R}.eye-{s}", 1, c, S.EYE,
                             scale=(.0134, .0068, .0098), seg=32, rings=16))
        parts.append(fk.ball(f"{R}.iris-{s}", 1, c + V(-s * .0008, .0058, -.0006),
                             S.IRIS, scale=(.0064, .0016, .0074), seg=28, rings=14))
        lash = []
        for t in np.linspace(-1, 1, 17):
            lash.append(c + V(t * .0142, .0030 - .0012 * t * t,
                              .0080 + .0018 * (1 - t * t) - .0014 * s * t))
        parts.append(fk.tube(f"{R}.lash-{s}", lash, [.0016] * len(lash), S.BROW,
                             n=8, caps=("dome", "dome")))
        brow = [head_point(math.radians(s * ad), 1.1445 + .0001 * (ad - 10) - .0022 * g(ad, 9, 6),
                           "A", .0035)
                for ad in np.linspace(7, 41, 15)]
        radii = [.0034 * (1.05 - .45 * (i / 14) ** 1.5) for i in range(15)]
        parts.append(fk.tube(f"{R}.brow-{s}", brow, radii, S.BROW, n=10,
                             caps=("dome", "dome")))
    path = [head_point(math.radians(a), 1.0675 - .0012 * (abs(a) / 16) ** 2, "A", .0009)
            for a in np.linspace(-16, 16, 25)]
    parts.append(fk.tube(f"{R}.mouth-line", path, [.0012] * len(path), S.MOUTH,
                         n=8, caps=("dome", "dome")))
    return parts


def look_pieces(look):
    pieces = [head_mesh(look)] + ears(look)
    pieces += hair_him() if look == "A" else hair_her()
    if look == "B":
        pieces += lips_her()
    return pieces


# ------------------------------------------------------------- helmet

def bubble():
    c, r = S.BUBBLE_C, S.BUBBLE_R
    low = math.acos((S.RING_Z - c.z) / r)
    rows = []
    for th in np.linspace(.0001, low, 44):
        rows.append([c + V(math.sin(th) * math.cos(ph) * r,
                           math.sin(th) * math.sin(ph) * r, math.cos(th) * r)
                     for ph in np.linspace(0, TAU, 112, endpoint=False)])
    glass = fk.loft(f"{R}.glass", rows, S.GLASS, start="pole", end=None)
    return smooth_shade(glass)


def neck_ring():
    pieces = []
    seat_r = math.sqrt(S.BUBBLE_R ** 2 - (S.RING_Z - S.BUBBLE_C.z) ** 2)
    prof = [(seat_r - .010, .995), (seat_r + .002, .996), (seat_r + .006, .990),
            (seat_r + .012, .986), (.145, .982), (.149, .973), (.147, .962),
            (.140, .955), (.126, .953), (.112, .957), (seat_r - .012, .975),
            (seat_r - .012, .990)]
    rings = [[V(math.cos(a) * r, math.sin(a) * r + S.BUBBLE_C.y, z)
              for a in np.linspace(0, TAU, 96, endpoint=False)] for r, z in prof]
    pieces.append(smooth_shade(fk.loft(f"{R}.ring", rings + [rings[0]], S.GOLD,
                                       start=None, end=None)))
    # Locking lugs at the sides and a small latch at the front.
    for s in (-1, 1):
        pieces.append(fk.rbox(f"{R}.lug-{s}", (.016, .030, .026),
                              V(s * .149, S.BUBBLE_C.y, .970), S.GOLD, levels=2))
    # The rubber neck seal from the ring's inner edge up round the neck.
    seal = []
    for k, (r, z) in enumerate([(.118, .960), (.110, .972), (.090, .985),
                                (.070, .993), (.058, .998), (.054, 1.002)]):
        seal.append([V(math.cos(a) * r, math.sin(a) * r * .95 + .002, z)
                     for a in np.linspace(0, TAU, 64, endpoint=False)])
    pieces.append(smooth_shade(fk.loft(f"{R}.neck-seal", seal, S.RUBBER,
                                       start=None, end=None)))
    return pieces


# ------------------------------------------------------------- gear

def chest_unit():
    """The chest control unit: a rounded box with one big chrome gauge
    (red needle), a column of three buttons and a speaker grille."""
    P = []
    c = V(0, .128, .842)
    m = Matrix.Translation(c) @ Matrix.Rotation(math.radians(-8), 4, "X")
    P.append(fk.rbox(f"{R}.unit", (.104, .034, .068), V(0, 0, 0), S.SHELL,
                     levels=3, matrix=m))
    at = m @ V(-.020, .018, .006)
    axis = m.to_3x3() @ V(0, 1, 0)
    P.append(lathe(f"{R}.gauge", [(.000, .000), (.020, .000), (.0205, .004),
                                  (.018, .007), (.000, .006)],
                   S.CHROME, at, axis=axis, seg=32))
    P.append(lathe(f"{R}.gauge-face", [(.000, .0062), (.0158, .0062),
                                       (.0158, .0068), (.000, .0068)],
                   S.SHELL, at, axis=axis, seg=32))
    needle = [m @ V(-.020, .0262, .006), m @ V(-.011, .0262, .015)]
    P.append(fk.tube(f"{R}.gauge-needle", needle, [.0016, .0012], S.RAY, n=8,
                     caps=("dome", "dome")))
    for k, mat in enumerate((S.RAY, S.GOLD, S.PACK)):
        at = m @ V(.026, .019, .020 - k * .014)
        P.append(fk.ball(f"{R}.button-{k}", 1, at, mat,
                         scale=(.0055, .0040, .0055), seg=14, rings=8))
    for k in range(5):
        at = m @ V(.004 + k * .0, .0175, -.024 + 0) + (m.to_3x3() @ V(-.030 + k * .010, 0, 0))
        P.append(fk.rbox(f"{R}.grille-{k}", (.005, .004, .012), at, S.GRIP,
                         levels=1))
    for o in P:
        smooth_shade(o)
    return P


def pack():
    P = []
    c = V(0, -.168, .842)
    P.append(fk.rbox(f"{R}.pack", (.230, .098, .250), c, S.PACK, levels=3))
    P.append(fk.rbox(f"{R}.pack-cap", (.205, .080, .028), c + V(0, -.004, .128),
                     S.SHELL, levels=2))
    for s in (-1, 1):
        at = c + V(s * .060, -.052, .010)
        P.append(lathe(f"{R}.pack-tank-{s}", [(.000, -.100), (.024, -.098),
                                              (.028, -.080), (.028, .080),
                                              (.024, .098), (.000, .100)],
                       S.CHROME, at, axis=(0, 0, 1), seg=32))
    P.append(fk.rbox(f"{R}.pack-plate", (.080, .010, .060), c + V(0, -.050, .055),
                     S.SHELL, levels=2))
    for k in range(3):
        P.append(fk.ball(f"{R}.pack-lamp-{k}", 1, c + V(-.022 + k * .022, -.056, .062),
                         S.RAY if k == 1 else S.GOLD, scale=(.006, .004, .006),
                         seg=12, rings=8))
    # Antenna mount on the cap.
    P.append(lathe(f"{R}.antenna-mount", [(.000, .000), (.012, .000),
                                          (.012, .012), (.007, .020),
                                          (.000, .021)],
                   S.CHROME, S.ANTENNA + V(0, 0, -.012), seg=20))
    for o in P:
        smooth_shade(o)
    return P


def antenna():
    base = S.ANTENNA + V(0, 0, .006)
    pts = [base, base + V(-.002, -.006, .12), base + V(-.004, -.016, .26),
           base + V(-.006, -.028, .37)]
    path = [V(q) for q in kit.smooth_path(pts, samples=10)]
    radii = [.0042 - .0018 * i / (len(path) - 1) for i in range(len(path))]
    rod = fk.tube(f"{R}.antenna-rod", path, radii, S.CHROME, n=10,
                  caps=(None, "dome"))
    bead = fk.ball(f"{R}.antenna-bead", 1, path[-1] + V(0, 0, .010), S.RAY,
                   scale=(.0115, .0115, .0115), seg=20, rings=12)
    return [smooth_shade(rod), smooth_shade(bead)]


def belt():
    P = []
    rows = []
    for z, extra in ((.660, .002), (.662, .010), (.703, .010), (.705, .002)):
        rows.append([S.body_point(a, z, extra) for a in
                     np.linspace(0, TAU, 128, endpoint=False)])
    rows = [r + [r[0]] for r in rows]
    band = fk.loft(f"{R}.belt", rows, S.BELT, start=None, end=None)
    P.append(smooth_shade(band))
    front = S.body_point(0, .6825, .012)
    P.append(lathe(f"{R}.buckle", [(.000, .000), (.026, .000), (.027, .004),
                                   (.024, .008), (.020, .009), (.000, .010)],
                   S.GOLD, front + V(0, -.002, 0), axis=(0, 1, 0), seg=40))
    P.append(fk.tube(f"{R}.buckle-rim", [front + V(math.cos(a) * .019, .009, math.sin(a) * .019)
                                         for a in np.linspace(0, TAU, 33)],
                     [.0022] * 33, S.GOLD, n=8, caps=(None, None)))
    for s in (-1, 1):
        a = math.radians(s * 62)
        at = S.body_point(a, .672, .026)
        normal = (S.body_point(a, .672, .03) - S.body_point(a, .672, 0)).normalized()
        yaw = math.atan2(normal.x, normal.y)
        m = Matrix.Translation(at) @ Matrix.Rotation(-yaw, 4, "Z")
        P.append(fk.rbox(f"{R}.pouch-{s}", (.050, .030, .050), V(0, 0, 0), S.POUCH,
                         levels=2, matrix=m))
        P.append(fk.rbox(f"{R}.pouch-flap-{s}", (.053, .033, .018), V(0, 0, 0), S.POUCH,
                         levels=2, matrix=m @ Matrix.Translation(V(0, .002, .020))))
        P.append(fk.ball(f"{R}.pouch-snap-{s}", 1, m @ V(0, .019, .016), S.CHROME,
                         scale=(.0055, .003, .0055), seg=14, rings=8))
    for o in P:
        smooth_shade(o)
    return P
