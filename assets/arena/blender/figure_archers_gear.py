"""The Cadets' hard gear (9 October 2026): the chrome ray gun, the gold neck
ring with its rubber neck dam, the clear glass bubble, the chest control
unit, the life-support pack with its hoses and whip antenna, the belt's
gold buckle and pouches, and the `archers.muzzle` empty at the emitter.

Each is a signed-distance sculpt (figure_archers_sdf.py) polygonised on its
own and painted by construction groups, or (the bubble, the antenna's
whip) a plain authored mesh. Blender +Y forward, Z up, metres.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_archers_sdf as S
import figure_archers_body as B
from figure_archers_sdf import (arc_tube, capsule, ellipsoid, frame, ring, round_cone, rounded_box,
                                tube, vec)

V = B.V
TAU = math.tau


def sdf_object(name, sc, h, groups, materials, lo=None, hi=None, transform=None, log=print):
    """Polygonise a sculpt, paint its faces by group, optionally move it
    from its own frame into the world (transform: (centre, R))."""
    points, quads, tris = S.mesh_arrays(sc, h, lo=lo, hi=hi, log=lambda m: None)
    faces = np.concatenate([quads, np.c_[tris, tris[:, 2:3]]]) if len(tris) else quads
    tri_mask = np.r_[np.zeros(len(quads), bool), np.ones(len(tris), bool)]
    corners = points[faces]
    centres = np.where(tri_mask[:, None], corners[:, :3].mean(1), corners.mean(1))
    gi = sc.classify(centres, groups, "group") if len(groups) > 1 else np.zeros(len(faces), int)
    if transform is not None:
        c, R = transform
        points = points @ np.asarray(R).T + np.asarray(c)
    obj = S.mesh_from_arrays(name, points, quads, tris)
    names = []
    for g in groups:
        if materials[g] not in names:
            names.append(materials[g])
    for m in names:
        obj.data.materials.append(kit.material(m))
    index = np.array([names.index(materials[g]) for g in groups])[gi]
    obj.data.polygons.foreach_set("material_index", index.astype(np.int32))
    obj.data.update()
    log(f"{name}: {len(obj.data.vertices)} vertices, {len(obj.data.polygons)} faces")
    return obj


# ------------------------------------------------------------------ ray gun
# The gun's own frame: origin at the grip's centre (in the right fist), +Y
# down the barrel, +Z the top of the gun (figure_archers_body.gun_frame).

BARREL_Z = .052
MUZZLE = V(0, .186, BARREL_Z)


def gun_sculpt():
    sc = S.Sculpt("cadet ray gun")
    z = BARREL_Z
    # The bulbous body: a fat rear bulb flowing into the barrel housing.
    sc.add(ellipsoid((0, -.018, z + .002), (.0290, .0420, .0310)), group="chrome")
    sc.add(round_cone((0, -.010, z + .002), (0, .072, z), .0270, .0175), k=.012, group="chrome")
    # A raised spine with a dorsal fin, retro style.
    sc.add(rounded_box((0, -.006, z + .034), (.0040, .0420, .0075), .0035), k=.008, group="chrome")
    sc.add(ellipsoid((0, -.036, z + .030), (.0042, .0200, .0180),
                     frame(x_axis=(1, 0, 0), y_axis=(0, 1, -.6))), k=.006, group="chrome")
    # The rear cap: a cobalt dome ringed in chrome.
    sc.add(ellipsoid((0, -.058, z + .002), (.0175, .0080, .0175)), k=.004, group="team")
    sc.add(ring((0, -.054, z + .002), (0, 1, 0), .0215, .0034), k=.003, group="chrome")
    # The barrel with three finned rings and cobalt inserts between them.
    sc.add(capsule((0, .060, z), (0, .168, z), .0118), k=.006, group="chrome")
    for i, y in enumerate((.090, .114, .138)):
        sc.add(ring((0, y, z), (0, 1, 0), .0172, .0052, squash=.85), k=.002, group="chrome")
        if i < 2:
            sc.add(ring((0, y + .012, z), (0, 1, 0), .0128, .0040, squash=1.2), k=.002, group="team")
    # The emitter: a flared bell with the red lens set in it.
    sc.add(round_cone((0, .160, z), (0, .182, z), .0128, .0200), k=.004, group="chrome")
    sc.cut(ellipsoid((0, .190, z), (.0150, .0070, .0150)), k=.0015, group=None)
    sc.add(ellipsoid((0, .180, z), (.0138, .0055, .0138)), k=.0010, group="glow")
    # Side vents on the bulb.
    for s in (-1, 1):
        for y in (-.026, -.014, -.002):
            sc.cut(capsule((s * .029, y, z + .010), (s * .029, y, z - .006), .0016), k=.0012, group=None)
    # The grip, raked back, chequered dark resin with a chrome butt.
    r = B.RAKE
    g = np.array([0, -math.sin(r), -math.cos(r)])
    top = np.array([0, .004, .030])
    butt = top + g * .074
    hx, hy = B.GRIP_HALF
    Rg = frame(x_axis=(1, 0, 0), z_axis=-g)
    sc.add(rounded_box((top + butt) / 2, (hx, hy, .040), .0085, Rg), k=.008, group="grip")
    sc.add(ellipsoid(butt + g * .002, (hx + .0030, hy + .0030, .0060), Rg), k=.004, group="chrome")
    for i in range(5):
        c = top + g * (.020 + i * .010)
        sc.cut(capsule(c + np.array([-.02, hy + .0005, 0]), c + np.array([.02, hy + .0005, 0]), .0013),
               k=.001, group="grip")
    # Trigger guard and trigger.
    sc.add(ring((0, .028, .014), (1, 0, 0), .0150, .0030, squash=1.4), k=.002, group="chrome")
    sc.add(capsule((0, .022, .024), (0, .028, .010), .0030), k=.002, group="chrome")
    # Keep the guard only below the body: the body covers its top.
    return sc


def gun(log=print):
    sc = gun_sculpt()
    obj = sdf_object("cadet-gun", sc, .0008, ["chrome", "team", "glow", "grip"], {
        "chrome": PAL["CHROME"], "team": PAL["GUN_TEAM"], "glow": PAL["RAY"], "grip": PAL["GRIP"]},
        lo=(-.040, -.080, -.060), hi=(.040, .200, .100), transform=(B.GUN_C, B.GUN_R), log=log)
    return obj


def muzzle_point():
    return B.gun_point(MUZZLE + V(0, .004, 0))


# ------------------------------------------------------------------ ring, dam, bubble

RING_C = V(0, -.008, .971)
RING_AXIS = B.unit(V(0, -.04, 1))
BUBBLE_C = V(0, .012, 1.116)
BUBBLE_R = .163


def neck_ring(log=print):
    """The gold ring the bubble seats in: a heavy rolled collar, a lip
    round its top, studs round its side."""
    sc = S.Sculpt("cadet neck ring")
    sc.add(ring(RING_C, RING_AXIS, .1060, .0190, squash=.95), group="gold")
    sc.add(ring(RING_C + RING_AXIS * .016, RING_AXIS, .1052, .0072), k=.004, group="gold")
    sc.cut(ring(RING_C + RING_AXIS * .009, RING_AXIS, .1250, .0026), k=.0012, group="gold")
    for i in range(12):
        a = TAU * (i + .5) / 12
        p = RING_C + V(math.sin(a) * .1245, math.cos(a) * .1245, -.004)
        sc.add(ellipsoid(p, (.0042, .0042, .0042)), k=.0015, group="stud")
    return sdf_object("cadet-ring", sc, .0009, ["gold", "stud"], {"gold": PAL["GOLD"], "stud": PAL["CHROME"]},
                      log=log)


def neck_dam(log=print):
    """The rubber neck dam closing the ring round the neck."""
    prof = [(.0920, .958), (.0890, .975), (.0760, .987), (.0560, .995), (.0440, 1.004), (.0410, 1.020)]
    verts, faces = [], []
    seg = 40
    for r_, z_ in prof:
        for j in range(seg):
            a = TAU * j / seg
            verts.append((math.sin(a) * r_, -.010 + math.cos(a) * r_, z_))
    for i in range(len(prof) - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    me = bpy.data.meshes.new("cadet-dam")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("cadet-dam", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(kit.material(PAL["DAM"]))
    me.shade_smooth()
    m = o.modifiers.new("thick", "SOLIDIFY")
    m.thickness, m.offset = .002, 1
    kit.apply(o)
    return o


def bubble(seg=40, rings=22):
    """The clear glass bubble: one front-facing shell from the ring's lip
    over the head, open at the bottom where it seats in the ring."""
    z_cut = .990
    verts, faces = [], []
    cos_cut = (z_cut - BUBBLE_C[2]) / BUBBLE_R
    th_max = math.acos(max(-1, min(1, cos_cut)))
    for i in range(1, rings + 1):
        th = th_max * i / rings
        for j in range(seg):
            ph = TAU * j / seg
            verts.append(tuple(BUBBLE_C + BUBBLE_R * V(math.sin(th) * math.sin(ph),
                                                       math.sin(th) * math.cos(ph), math.cos(th))))
    top = len(verts)
    verts.append(tuple(BUBBLE_C + V(0, 0, BUBBLE_R)))
    for j in range(seg):
        faces.append((top, (j + 1) % seg, j))
    for i in range(rings - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    me = bpy.data.meshes.new("cadet-bubble")
    me.from_pydata(verts, [], [tuple(reversed(f)) for f in faces])
    me.update()
    o = bpy.data.objects.new("cadet-bubble", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(kit.material(PAL["GLASS"]))
    me.shade_smooth()
    # Outward normals.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    c = Vector(BUBBLE_C)
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - c) < 0:
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()
    o["clearHelmet"] = True
    o["noShadow"] = True
    # The glass must not occlude the face when AO is baked.
    o.visible_shadow = False
    return o


# ------------------------------------------------------------------ chest unit

def chest_unit(log=print):
    """The chest control unit on the front panel: a rounded case, a big
    gold-bezelled gauge, two knobs and a row of lamps."""
    z0 = .764
    surf = B.torso_surface([z0], [0.0])[0]
    c = surf + V(0, .010, 0)
    R = frame(x_axis=(1, 0, 0), y_axis=(0, 1, .12))
    sc = S.Sculpt("cadet chest unit")
    sc.add(rounded_box(c, (.040, .014, .026), .009, R), group="case")
    sc.add(rounded_box(c + R @ V(0, .010, 0), (.036, .006, .022), .006, R), k=.002, group="face")
    gauge = c + R @ V(-.012, .016, .002)
    sc.add(ring(gauge, R @ V(0, 1, 0), .0118, .0030), k=.0015, group="gold")
    sc.add(ellipsoid(gauge + R @ V(0, -.001, 0), (.0112, .0026, .0112), R), k=.001, group="dial")
    sc.add(capsule(gauge + R @ V(0, .0018, 0), gauge + R @ V(.006, .0020, .006), .0010), k=.0004,
           group="needle")
    for i, x in enumerate((.012, .026)):
        sc.add(round_cone(c + R @ V(x, .014, .009), c + R @ V(x, .022, .009), .0050, .0042), k=.0015,
               group="gold")
    for i, x in enumerate((.008, .017, .026)):
        sc.add(ellipsoid(c + R @ V(x, .0155, -.010), (.0030, .0024, .0030), R), k=.001,
               group=("lampR", "lampA", "lampG")[i])
    return sdf_object("cadet-chest-unit", sc, .0006,
                      ["case", "face", "gold", "dial", "needle", "lampR", "lampA", "lampG"],
                      {"case": PAL["SHELL"], "face": PAL["CHROME"], "gold": PAL["GOLD"],
                       "dial": PAL["DIAL"], "needle": PAL["RAY"], "lampR": PAL["RAY"],
                       "lampA": PAL["AMBER"], "lampG": PAL["GREEN"]}, log=log)


# ------------------------------------------------------------------ pack, hoses, antenna

PACK_C = V(0, -.150, .842)
ANTENNA_BASE = V(-.072, -.170, .952)


def pack(log=print):
    """The life-support pack: a rounded cobalt case on the back with chrome
    trim, a ribbed lower vent and twin tank caps on its top."""
    sc = S.Sculpt("cadet pack")
    c = PACK_C
    sc.add(rounded_box(c, (.098, .040, .094), .030), group="team")
    sc.add(rounded_box(c + V(0, -.040, .010), (.074, .006, .066), .010), k=.006, group="team")
    # Chrome trim round the back panel and the vent below it.
    sc.add(ring(c + V(0, -.040, .010), (0, 1, 0), .072, .0035, squash=1.0), k=.0015, group="chrome")
    for i in range(4):
        z = c[2] - .060 + i * .010
        sc.cut(capsule(c + V(-.055, -.045, z - c[2]), c + V(.055, -.045, z - c[2]), .0022), k=.0015,
               group=None)
    for s in (-1, 1):
        sc.add(round_cone(c + V(s * .056, -.004, .086), c + V(s * .056, -.004, .108), .020, .016), k=.006,
               group="chrome")
    # The antenna's socket.
    sc.add(round_cone(ANTENNA_BASE - V(0, 0, .030), ANTENNA_BASE, .010, .008), k=.004, group="chrome")
    return sdf_object("cadet-pack", sc, .0012, ["team", "chrome"],
                      {"team": PAL["PACK"], "chrome": PAL["CHROME"]}, log=log)


def hoses(log=print):
    """Two ribbed hoses from the pack's top over the shoulders to the ring."""
    sc = S.Sculpt("cadet hoses")
    for s in (-1, 1):
        pts = [PACK_C + V(s * .056, .010, .100), V(s * .070, -.110, .990), V(s * .078, -.072, 1.000),
               V(s * .082, -.050, .982)]
        path, _ = S.catmull(pts, 48)
        sc.add(tube(list(path), [.0085] * len(path)), group="hose")
        for i in range(4, len(path) - 4, 3):
            sc.add(ring(path[i], path[i + 1] - path[i - 1], .0085, .0022), k=.001, group="hose")
    return sdf_object("cadet-hoses", sc, .0010, ["hose"], {"hose": PAL["HOSE"]}, log=log)


def antenna():
    """The whip: a thin chrome rod tapering up from its socket to a red
    bead (the `antenna` joint springs it)."""
    base = ANTENNA_BASE
    tip = base + V(-.010, -.006, .372)
    rod = kit.tube("cadet-antenna-rod", [Vector(base), Vector(base.tolist()) * .5 + Vector(tip.tolist()) * .5,
                                          Vector(tip)], .0030, mat=PAL["CHROME"], segments=8,
                   taper=lambda t: 1 - .45 * t)
    bead = kit.sphere("cadet-antenna-bead", .0105, location=Vector(tip), mat=PAL["RAY"], segments=16,
                      rings=10)
    return [rod, bead], tip


# ------------------------------------------------------------------ belt gear

def buckle(log=print):
    surf = B.torso_surface([.644], [0.0], lift=.0055)[0]
    R = frame(x_axis=(1, 0, 0), y_axis=(0, 1, -.05))
    c = surf + V(0, .003, 0)
    sc = S.Sculpt("cadet buckle")
    sc.add(ellipsoid(c, (.0230, .0060, .0215), R), group="gold")
    sc.cut(ring(c + R @ V(0, .006, 0), R @ V(0, 1, 0), .0150, .0018), k=.0010, group=None)
    sc.add(ellipsoid(c + R @ V(0, .0045, 0), (.0080, .0025, .0080), R), k=.002, group="gold")
    return sdf_object("cadet-buckle", sc, .0006, ["gold"], {"gold": PAL["GOLD"]}, log=log)


def pouches(log=print):
    """Two metal belt boxes, one each side of the buckle."""
    sc = S.Sculpt("cadet pouches")
    for s in (-1, 1):
        ang = s * .92
        surf = B.torso_surface([.632], [ang], lift=.0055)[0]
        out = B.unit(V(math.sin(ang), math.cos(ang), 0))
        R = frame(x_axis=np.cross(out, V(0, 0, 1)), y_axis=out)
        c = surf + out * .011 + V(0, 0, -.004)
        sc.add(rounded_box(c, (.019, .011, .023), .005, R), group="box")
        sc.add(rounded_box(c + R @ V(0, .006, .015), (.020, .007, .009), .004, R), k=.002, group="box")
        sc.add(ellipsoid(c + R @ V(0, .0118, .006), (.0035, .0020, .0035), R), k=.001, group="clasp")
    return sdf_object("cadet-pouches", sc, .0008, ["box", "clasp"],
                      {"box": PAL["POUCH"], "clasp": PAL["GOLD"]}, log=log)


PAL = {}
