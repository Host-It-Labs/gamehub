"""The Cadet: a vinyl retro-future space cadet from a 1960s space toy line.

A rounded team suit with a cream chest panel and three coloured buttons,
chunky white gloves and boots, a round white helmet with a big smoked visor
over a friendly face, an antenna with a red ball, a twin-tank backpack and a
bulbous finned ray gun in the right hand. Two per card; one also stands
guard on each small tower, so the rest pose is a calm, ready stance.

Built from subdivided quad cages (figures_a); see troops.py for the part
contract. Facing +y, feet on z = 0, about 1.25 tall to the helmet top.
"""

import math

import bmesh
import kit
from figures_a import (S, decal, extrude_face, lathe_y, loft, mat_index,
                       place, raise_faces, rod, slab, slim, sphere_patch,
                       stroke, tree)
from mathutils import Matrix, Vector
from troopkit import part

WHITE = "plastic:" + kit.tint("cadet-white", "#f2f0e9")
CREAM = "plastic:" + kit.tint("cadet-cream", "#efdcb4")
SOLE = "plastic:" + kit.tint("cadet-sole", "#8d949e")
VISOR = "plastic:" + kit.tint("cadet-visor", "#18283a")
GLINT = "plain:" + kit.tint("cadet-glint", "#b9cfe0")
CHROME = "chrome:" + kit.tint("cadet-chrome", "#dfe3ea")
RED = "plastic:" + kit.tint("cadet-red", "#e2392c")
YELLOW = "plastic:" + kit.tint("cadet-yellow", "#f6c126")
GREEN = "plastic:" + kit.tint("cadet-green", "#2fb36a")
RAY = "glow:" + kit.tint("cadet-ray", "#a6ff4d")
SKIN = "vinyl:" + kit.tint("cadet-skin", "#f3c8a2")
EYE = "plain:" + kit.tint("cadet-eye", "#fbfaf6")
IRIS = "plain:" + kit.tint("cadet-iris", "#1f2636")
MOUTH = "plain:" + kit.tint("cadet-mouth", "#8a3a33")
CHEEK = "plain:" + kit.tint("cadet-cheek", "#f4a592")
SUIT = "vinyl:team"
SUIT2 = "vinyl:team2"
TEAM = "plastic:team"
TEAM2 = "plastic:team2"

HIP = 0.52           # hip joint height
HIP_X = 0.076
WAIST = 0.56
NECK = 0.915
SHOULDER = Vector((0.178, 0.0, 0.838))
HELMET_C = Vector((0.0, 0.004, 1.058))
HELMET_R = 0.155
GUN_SCALE = 1.18
AIM = math.radians(24)        # the gun points this far below level at rest
SLIM = 0.7                    # decimation kept on the big smooth cages


def leg(t, side, sx, foot):
    """A suit leg from its hip ball joint, and a chunky white boot."""
    hip = Vector((sx * HIP_X, 0, HIP))
    foot = Vector(foot)
    ankle = Vector((foot.x, foot.y - 0.01, 0.16))
    knee = hip.lerp(ankle, 0.56) + Vector((0, 0.014, 0))
    limb = loft(f"{t}-leg{side}", [
        S(hip + Vector((0, 0, 0.044)), 0.044),
        S(hip, 0.072),
        S(hip.lerp(knee, 0.3), 0.061, crease=0.8),     # ball-joint seam
        S(knee, 0.063),
        S(ankle, 0.058),
    ], SUIT, n=8, cap0=0.032, cap1=None)
    f = foot
    boot = loft(f"{t}-boot{side}", [
        S((f.x, f.y, 0.0), 0.068, 0.124, sq=0.8, oy=0.036, crease=1.0,
          mat=SOLE),
        S((f.x, f.y, 0.032), 0.071, 0.128, sq=0.8, oy=0.036, crease=1.0,
          mat=WHITE),
        S((f.x, f.y, 0.04), 0.065, 0.118, sq=0.85, oy=0.034),
        S((f.x, f.y - 0.006, 0.15), 0.064, 0.07, oy=0.004),
        S((f.x, f.y - 0.008, 0.228), 0.074, 0.075, crease=0.9),
    ], SOLE, n=8, axis=(0, 0, 1), cap0=0.0, cap1=-0.014)
    return part(t, f"leg{side}", [slim(limb, SLIM), slim(boot, 0.6)], hip,
                None)


def glove(t, side, wrist, fwd, grip_axis, fist, thumb_face, thumb_steps):
    """A chunky white mitten: a flared gauntlet cuff, then the hand. `fwd`
    runs down the forearm into the hand, `grip_axis` across the palm (the
    way the fingers wrap), `fist` = (length, width, thickness, shift)."""
    w = Vector(wrist)
    f = Vector(fwd).normalized()
    g = Vector(grip_axis)
    g = (g - f * g.dot(f)).normalized()
    u = g.cross(f).normalized()           # the hand's thickness axis
    length, width, thick, shift = fist
    secs = [
        S(w - f * 0.072, 0.064, crease=0.9),
        S(w - f * 0.02, 0.052, crease=0.5),
        S(w + f * 0.004, 0.039),
        S(w + f * (length * 0.55), thick, width, oy=shift),
        S(w + f * length, thick * 0.84, width * 0.86, oy=shift * 0.8),
    ]

    def edit(bm, info):
        face = info["bands"][2][thumb_face]
        extrude_face(bm, face, thumb_steps(face))

    return slim(loft(f"{t}-glove{side}", secs, WHITE, n=8, ref=u,
                     cap0=-0.012, cap1=thick * 0.9, edit=edit), 0.62)


def arm(t, side, sx, elbow, wrist, hand_fwd, grip_axis, fist, thumb_face,
        thumb_steps):
    s = Vector((sx * SHOULDER.x, SHOULDER.y, SHOULDER.z))
    e, w = Vector(elbow), Vector(wrist)
    up = (e - s).normalized()
    fo = (w - e).normalized()
    sleeve = loft(f"{t}-arm{side}", [
        S(s - up * 0.042, 0.042),
        S(s, 0.064),
        S(s + up * 0.05, 0.053, crease=0.8),        # ball-joint seam
        S(e - up * 0.02, 0.052),
        S(e + fo * 0.03, 0.051),
        S(w - fo * 0.03, 0.047),
    ], SUIT, n=8, cap0=0.028, cap1=None)
    slim(sleeve, SLIM)
    hand = glove(t, side, w, hand_fwd, grip_axis, fist, thumb_face,
                 thumb_steps)
    return s, [sleeve, hand]


def ray_gun(t):
    """A bulbous retro ray gun in its own frame: the grip's centre (in the
    fist) at the origin, the barrel along +y on an axis 0.066 above it."""
    z0 = 0.066
    body = lathe_y(f"{t}-gun-body", [
        (0.0, -0.09), (0.024, -0.086), (0.04, -0.074), (0.052, -0.054),
        (0.058, -0.028), (0.057, 0.0), (0.05, 0.026), (0.036, 0.046),
        (0.026, 0.056), (0.0, 0.056)], YELLOW, segments=12)
    ring = lathe_y(f"{t}-gun-ring", [
        (0.046, 0.022), (0.054, 0.025), (0.054, 0.036), (0.042, 0.04)],
        CHROME, segments=10)
    barrel = lathe_y(f"{t}-gun-barrel", [
        (0.022, 0.05), (0.022, 0.084), (0.026, 0.088), (0.026, 0.1),
        (0.02, 0.104), (0.02, 0.138)], TEAM2, segments=8)
    emitter = lathe_y(f"{t}-gun-emitter", [
        (0.018, 0.13), (0.03, 0.146), (0.042, 0.164), (0.043, 0.172),
        (0.026, 0.176)], CHROME, segments=12)
    tip = lathe_y(f"{t}-gun-tip", [
        (0.027, 0.166), (0.027, 0.176), (0.023, 0.188), (0.014, 0.197),
        (0.0, 0.2)], RAY, segments=12)
    parts = [body, ring, barrel, emitter, tip]
    for o in parts:
        place([o], at=(0, 0, z0))
    # Three swept fins round the bulb: one on top, two slanting down.
    fin = [(0.0, -0.058), (0.0, 0.016), (0.028, -0.006), (0.054, -0.072),
           (0.056, -0.104), (0.036, -0.104)]
    for k, roll in enumerate((90, 210, 330)):
        pts = [(0.036 + r, y) for r, y in fin]
        f = slab(f"{t}-gun-fin{k}", pts, 0.013, TEAM, bevel=0.0045,
                 segments=1)
        f.data.transform(Matrix.Rotation(math.radians(-roll), 4, "Y"))
        place([f], at=(0, 0, z0))
        parts.append(f)
    grip = loft(f"{t}-gun-grip", [
        S((0, 0.006, 0.03), 0.019, 0.028),
        S((0, -0.016, -0.06), 0.021, 0.029, crease=0.6),
    ], TEAM2, n=8, ref=(1, 0, 0), cap0=None, cap1=0.006)
    parts.append(slim(grip, SLIM))
    for o in parts:
        o.data.transform(Matrix.Scale(GUN_SCALE, 4))
    return parts


def torso(t, root):
    """A rounded suit from the crotch to the collar with a moulded white
    belt and a raised cream chest panel; the backpack and collar ring."""
    ring = [
        (0.465, 0.086, 0.07), (0.515, 0.127, 0.092), (0.572, 0.124, 0.09),
        (0.622, 0.127, 0.091), (0.74, 0.155, 0.105), (0.842, 0.156, 0.102),
        (0.9, 0.09, 0.07)]
    secs = [S((0, 0, z), rx, ry) for z, rx, ry in ring]

    def edit(bm, info):
        cl = info["cl"]
        raise_faces(bm, info["bands"][2], 0.012, inset=0.0, rim=0.003,
                    mi=mat_index(info, WHITE), crease=0.7, cl=cl)
        panel = [info["bands"][4][s] for s in (0, 1, 2)]
        raise_faces(bm, panel, 0.009, inset=0.0, rim=0.004,
                    mi=mat_index(info, CREAM), crease=0.9, cl=cl)

    suit = slim(loft(f"{t}-suit", secs, SUIT, n=12, axis=(0, 0, 1),
                     cap0=0.03, cap1=None, edit=edit), SLIM, sym=True)
    pieces = [suit]
    bvh = tree([suit])

    def on_body(x, z):
        loc, nrm, _, _ = bvh.ray_cast(Vector((x, 0.5, z)), Vector((0, -1, 0)))
        return loc, nrm

    # Three buttons in a row on the chest panel.
    for k, (x, m) in enumerate(((-0.044, RED), (0.0, YELLOW),
                                (0.044, GREEN))):
        loc, nrm = on_body(x, 0.79)
        b = lathe_y(f"{t}-button{k}", [
            (0.0155, -0.006), (0.0155, 0.002), (0.012, 0.007), (0.0, 0.0095)],
            m, segments=8)
        place([b], rot=nrm.to_track_quat("Y", "Z"), at=loc)
        pieces.append(b)
    # A rounded yellow buckle on the front of the belt.
    loc, nrm = on_body(0.0, 0.597)
    buckle = loft(f"{t}-buckle", [
        S((0, -0.004, 0), 0.03, 0.022, sq=0.5),
        S((0, 0.008, 0), 0.028, 0.02, sq=0.5, crease=0.6)],
        YELLOW, n=8, axis=(0, 1, 0), ref=(1, 0, 0), cap0=None, cap1=0.003,
        levels=0)
    place([buckle], rot=nrm.to_track_quat("Y", "Z"), at=loc)
    pieces.append(buckle)
    # Chrome collar ring the helmet sits in.
    pieces.append(kit.lathe(f"{t}-collar", [
        (0.074, 0.872), (0.098, 0.878), (0.106, 0.892), (0.1, 0.912),
        (0.08, 0.919)], segments=14, mat=CHROME, close=False))
    # Backpack: a white plate with two team oxygen tanks, chrome caps.
    pieces.append(slim(loft(f"{t}-pack", [
        S((0, -0.112, 0.63), 0.102, 0.03, sq=0.45),
        S((0, -0.114, 0.86), 0.102, 0.03, sq=0.45)],
        WHITE, n=8, axis=(0, 0, 1), cap0=0.012, cap1=0.012), SLIM, sym=True))
    for k, x in enumerate((-0.056, 0.056)):
        pieces.append(slim(loft(f"{t}-tank{k}", [
            S((x, -0.182, 0.65), 0.048),
            S((x, -0.182, 0.826), 0.048, crease=0.7, mat=CHROME),
            S((x, -0.182, 0.848), 0.047)],
            TEAM, n=8, axis=(0, 0, 1), cap0=0.04, cap1=0.036), SLIM))
        pieces.append(lathe_y(f"{t}-valve{k}", [
            (0.012, 0.0), (0.012, 0.014), (0.017, 0.016), (0.017, 0.024),
            (0.0, 0.026)], CHROME, segments=6))
        place([pieces[-1]], rot=Matrix.Rotation(math.pi / 2, 3, "X"),
              at=(x, -0.182, 0.874))
    return part(t, "torso", pieces, (0, 0, WAIST), root)


def head(t, torso_obj):
    """The white helmet with its face window, the smoked visor over it, the
    face, the team ear pods and the antenna."""
    c, R = HELMET_C, HELMET_R
    lat = [-60, -36, -10, 16, 42, 66]
    secs = [S((c.x, c.y, c.z + R * math.sin(math.radians(p))),
              R * math.cos(math.radians(p))) for p in lat]

    def edit(bm, info):
        cl = info["cl"]
        # The face window: three bands high, a quarter turn wide.
        window = [info["bands"][b][s] for b in (1, 2, 3) for s in (0, 1, 2)]
        bmesh.ops.delete(bm, geom=window, context="FACES")
        edges = [e for e in bm.edges if e.is_boundary]
        hole = [e for e in edges if all(v.co.z > c.z - 0.11 for v in e.verts)]
        rim = [e for e in edges if e not in hole]
        for e in hole + rim:
            e[cl] = 0.6
        out = bmesh.ops.extrude_edge_only(bm, edges=hole)
        for v in [g for g in out["geom"] if isinstance(g, bmesh.types.BMVert)]:
            v.co = c + (v.co - c) * ((R - 0.016) / R)
        out = bmesh.ops.extrude_edge_only(bm, edges=rim)
        for v in [g for g in out["geom"] if isinstance(g, bmesh.types.BMVert)]:
            d = Vector((v.co.x - c.x, v.co.y - c.y, 0))
            v.co = Vector((c.x, c.y, v.co.z + 0.012)) + d * 0.84
        # A faint mould seam round the back, through the ear pods.
        seam = info["rings"][3]
        for i in range(12):
            a, b = seam[i], seam[(i + 1) % 12]
            e = bm.edges.get((a, b)) if a.is_valid and b.is_valid else None
            if e and not e.is_boundary:
                e[cl] = 0.4

    helmet = slim(loft(f"{t}-helmet", secs, WHITE, n=12, axis=(0, 0, 1),
                       cap0=None, cap1=R * (1 - math.sin(math.radians(66))),
                       edit=edit), 0.86, sym=True)
    # The visor: a big glossy smoked lens bulging proud of the helmet over
    # the top of the window, so the face shows just below its rim.
    visor = sphere_patch(f"{t}-visor", c + Vector((0, 0.016, 0.008)),
                         R - 0.004, (90 - 60, 90 + 60), (6, 60), 4, 3, VISOR,
                         thick=0.009, crease=0.65)
    face = sphere_patch(f"{t}-face", c + Vector((0, 0.0, -0.004)), 0.137,
                        (90 - 58, 90 + 58), (-58, 24), 5, 4, SKIN)
    neck = kit.cylinder(f"{t}-neck", 0.064, 0.064, 0.12, (0, 0, 0.9),
                        verts=10, mat=SUIT2)
    pieces = [helmet, visor, face, neck]
    # A painted gloss streak on the visor, so it reads as glass at a glance.
    vb = tree([visor])
    pieces.append(stroke(f"{t}-glint", vb, [
        (-0.1, 0.4, 1.12), (-0.083, 0.4, 1.146), (-0.056, 0.4, 1.166),
        (-0.024, 0.4, 1.177)], 0.013, GLINT, lift=0.0015, taper=0.25))
    pieces.append(decal(f"{t}-glint-dot", vb, (0.004, 0.4, 1.18), 0.0065,
                        0.0065, GLINT, lift=0.0015, n=8))
    fb = tree([face])
    for sx in (-1, 1):
        ex, ez = sx * 0.045, 1.046
        pieces.append(decal(f"{t}-eye{sx}", fb, (ex, 0.3, ez), 0.021, 0.025,
                            EYE, lift=0.0015, n=14))
        pieces.append(decal(f"{t}-iris{sx}", fb,
                            (ex + sx * 0.001, 0.3, ez - 0.004), 0.014, 0.017,
                            IRIS, lift=0.003, n=12))
        pieces.append(decal(f"{t}-glint{sx}", fb,
                            (ex + 0.005, 0.3, ez + 0.003), 0.0048, 0.0048,
                            EYE, lift=0.0045, n=8))
        pieces.append(decal(f"{t}-cheek{sx}", fb, (sx * 0.079, 0.3, 1.01),
                            0.016, 0.011, CHEEK, lift=0.0015, n=10))
    smile = [(-0.03, 0.3, 1.002), (-0.015, 0.3, 0.993), (0.0, 0.3, 0.99),
             (0.015, 0.3, 0.993), (0.03, 0.3, 1.002)]
    pieces.append(stroke(f"{t}-smile", fb, smile, 0.008, MOUTH, lift=0.0015))
    # Team ear pods on the helmet sides, with chrome hubs.
    for sx in (-1, 1):
        pod = lathe_y(f"{t}-pod{sx}", [
            (0.0, -0.014), (0.046, -0.014), (0.052, -0.006), (0.052, 0.006),
            (0.046, 0.013), (0.0, 0.014)], TEAM, segments=10)
        hub = lathe_y(f"{t}-hub{sx}", [
            (0.022, 0.01), (0.021, 0.018), (0.012, 0.024), (0.0, 0.025)],
            CHROME, segments=8)
        at = c + Vector((sx * (R + 0.002), 0.0, 0.016))
        place([pod, hub], rot=Matrix.Rotation(-sx * math.pi / 2, 3, "Z"),
              at=at)
        pieces += [pod, hub]
    # Antenna from the left pod, a red ball at its tip.
    base = c + Vector((-(R + 0.006), -0.008, 0.05))
    tip = c + Vector((-(R + 0.024), -0.034, 0.23))
    pieces.append(rod(f"{t}-antenna", base, tip, 0.01, CHROME, verts=8))
    pieces.append(loft(f"{t}-antenna-ball", [S(tip + Vector((0, 0, 0.008)),
                                                 0.028)],
                       RED, n=8, axis=(0, 0, 1), cap0=0.026, cap1=0.026))
    return part(t, "head", pieces, (0, 0, NECK), torso_obj)


def build(root_name="archers"):
    t = root_name
    root = kit.empty(t)
    for side, sx, foot in (("L", -1, (-0.102, 0.03, 0)),
                           ("R", 1, (0.102, -0.02, 0))):
        kit.parent(leg(t, side, sx, foot), root)
    body = torso(t, root)
    head(t, body)

    # Right arm: forearm forward and a little down, the ray gun in the fist.
    fo = Vector((0.03, math.cos(AIM), -math.sin(AIM))).normalized()
    e_r = Vector((0.21, -0.03, 0.632))
    w_r = e_r + fo * 0.158
    grip_axis = fo.cross(Vector((1, 0, 0))).normalized()   # down the grip
    fist = (0.082, 0.05, 0.037, 0.008)
    grip = w_r + fo * 0.045 + grip_axis * 0.008

    def thumb_r(face):
        n = face.normal.copy()
        return [(n * 0.013 + fo * 0.004, 0.85), (fo * 0.024 + n * 0.004, 0.8)]

    s_r, arm_r = arm(t, "R", 1, e_r, w_r, fo, grip_axis, fist, 4, thumb_r)
    right = part(t, "armR", arm_r, s_r, body)
    gun = ray_gun(t)
    frame = Matrix((fo.cross(-grip_axis), fo, -grip_axis)).transposed()
    place(gun, rot=frame, at=grip)
    part(t, "weapon", gun, grip, right)

    # Left arm: hanging relaxed, an open mitten, thumb forward.
    e_l = Vector((-0.212, -0.02, 0.63))
    w_l = Vector((-0.218, 0.03, 0.472))
    down = (w_l - e_l).normalized()
    hand_fwd = (down + Vector((0.14, 0.06, 0))).normalized()

    def thumb_l(face):
        n = face.normal.copy()
        return [(n * 0.013 + hand_fwd * 0.004, 0.85),
                (hand_fwd * 0.022 + n * 0.006, 0.8)]

    s_l, arm_l = arm(t, "L", -1, e_l, w_l, hand_fwd, Vector((0, -1, 0)),
                     (0.084, 0.046, 0.03, 0.0), 5, thumb_l)
    part(t, "armL", arm_l, s_l, body)
    return root
