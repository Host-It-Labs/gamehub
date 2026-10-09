"""Rota's vehicles: the little trains, cars and boats that run the networks
on the model-railway layout (docs/concepts/2026-10-02-rota-3d/brief.md).

Premium miniatures in a quality-toy style: lofted lacquered bodies with
rounded ends, windows set into their frames, door seams, chrome bumpers and
lamps, rubber tyres with hub caps, and wheels as separate meshes spinning
about their local X axis (children named wheel*, origin at the axle).

  Blender -b --factory-startup --python assets/rota/blender/vehicles.py \\
      -- out.glb [preview.png] [only=a,b] [views=line,trains,...]

Units: one grid square is one metre. Vehicles drive towards +Y and are
centred on their footprint. Trains: the root sits at rail-top minus 0.04
(z = 0 under the vehicle) so wheel bottoms touch z = 0.04, the rail top of
the game's track. Road vehicles: wheel bottoms at z = 0 (the game lifts
them onto the asphalt). Boats: waterline at z = 0.

Liveries: trains wear paint:team (body) and paint:team2 (darker trim),
cars paint:body; the game swaps those colours at runtime.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rkit  # noqa: E402
import vehicle_kit as vk  # noqa: E402

kit = rkit.kit
rkit.reset(seed=11)

PI = math.pi

# ---------------------------------------------------------------- palette

T = kit.tint
T("team", "#3d7cc9")
T("team2", "#1f3e6e")
T("body", "#d24a3c")
T("chassis", "#2a2b2f")
T("brass", "#c99a48")
T("steel", "#d6dae0")
T("dark", "#1c2631")
T("tyre", "#29292b")
T("lamp", "#fff1c2")
T("tail", "#d42a1f")
T("seal", "#2f3237")
T("whitewall", "#ece8dc")
T("plate", "#f1efe6")
T("beam", "#b8342b")
T("roof", "#8d9197")
T("cream", "#efe5cc")
T("white", "#f3f1ea")
T("navy", "#24395c")
T("hullred", "#a8342c")
T("deck", "#b48a5c")
T("cardeck", "#5a5d61")
T("yellow", "#e8b53a")
T("orange", "#e8722a")
T("sail", "#f6f2e6")
T("log", "#8a6342")
T("logend", "#d8b27c")
T("cargo", "#e9e4d6")
T("seat", "#4a3a2e")
T("rope", "#c9b48a")
T("amber", "#f2a33a")
T("copper", "#c27a4a")
T("coal", "#2c2b2c")
T("planks", "#a07a52")
T("casingtop", "#c9ccd0")
T("starboard", "#3fd17a")
T("flag", "#d23a2e")
T("fishhull", "#2f6f96")
T("fishroof", "#c2462f")
T("net", "#56805a")
T("crate", "#3a78b8")
T("teak", "#b98b5a")
T("kerb", "#d8d2c4")
T("road", "#5a5c60")
T("sleeper", "#6b5440")
T("water", "#2f7f86")
T("floor", "#9aa38a")
T("void", "#050505")
T("alu", "#c6cbd0")
T("frost", "#dfe2dc")
T("engine", "#3b3e43")
T("doorin", "#8c7a62")

TEAM = "paint:team"
TEAM2 = "paint:team2"
BODY = "paint:body"
CHASSIS = "metal:chassis"
BRASS = "metal:brass"
STEEL = "metal:steel"
CHROME = "chrome:steel"
GLASS = "glass:dark"
TYRE = "rubber:tyre"
LAMP = "glow:lamp"
TAIL = "glow:tail"
SEAL = "plastic:seal"
PLATE = "plastic:plate"
BEAM = "paint:beam"
ROOF = "paint:roof"
CREAM = "paint:cream"
WHITE = "paint:white"
NAVY = "paint:navy"
HULLRED = "paint:hullred"
DECK = "wood:deck"
CARDECK = "paint:cardeck"
YELLOW = "paint:yellow"
ORANGE = "plastic:orange"
SAIL = "plastic:sail"
LOG = "bark:log"
LOGEND = "wood:logend"
CARGO = "paint:cargo"
SEAT = "plastic:seat"
ROPE = "plastic:rope"
VOID = "plain:void"
ALU = "paint:alu"
FROST = "paint:frost"
ENGINE = "metal:engine"
DOORIN = "paint:doorin"

BUDGET = 6000


# ---------------------------------------------------------------- road parts

def headlights(y, x, z, r=0.0042, depth=0.004, round_=True):
    parts = []
    for s in (1, -1):
        parts.append(vk.cyl("hl-rim", r * 1.25, depth, (s * x, y - depth / 2,
                            z), "Y", CHROME, verts=14))
        parts.append(vk.cyl("hl-lens", r, 0.0012, (s * x, y + 0.0002, z), "Y",
                            LAMP, verts=14))
    return parts


def taillights(y, x, z, w=0.008, h=0.006):
    out = []
    for s in (1, -1):
        out.append(vk.blk("tail", (w, 0.003, h), (s * x, y, z), TAIL,
                          bevel=0.0008, edge=1))
    return out


def bumper(y, hw, z, front=True, r=0.0028, wrap=0.012, mat=CHROME):
    s = 1 if front else -1
    pts = kit.smooth_path([
        (-hw + 0.001, y - s * wrap, z), (-hw + 0.004, y - s * 0.0025, z),
        (-hw * 0.5, y, z), (hw * 0.5, y, z), (hw - 0.004, y - s * 0.0025, z),
        (hw - 0.001, y - s * wrap, z)], samples=4)
    t = vk.tube("bumper", pts, r, mat, seg=8)
    t.scale = (1, 1, 1.25)
    t.location.z = z * (1 - 1.25)
    return [t]


def plate(y, z, front=True, w=0.016, h=0.005):
    s = 1 if front else -1
    return [vk.blk("plate", (w, 0.0012, h), (0, y + s * 0.0004, z), PLATE,
                   bevel=0.0004, edge=1)]


def mirrors(y, x, z, mat=BODY):
    out = []
    for s in (1, -1):
        out.append(vk.blk("mirror", (0.005, 0.0026, 0.0036),
                          (s * (x + 0.003), y, z), mat, bevel=0.0009,
                          edge=1))
        out.append(vk.blk("mirror-glass", (0.0042, 0.0008, 0.0028),
                          (s * (x + 0.003), y - 0.0014, z), CHROME, edge=1))
        out.append(vk.blk("mirror-arm", (0.0034, 0.0014, 0.0014),
                          (s * (x - 0.0002), y + 0.0004, z - 0.0008), SEAL,
                          edge=1))
    return out


def handles(ys, x, z):
    out = []
    for y in ys:
        for s in (1, -1):
            out.append(vk.blk("handle", (0.0012, 0.0048, 0.0011),
                              (s * x, y, z), CHROME, bevel=0.0004, edge=1))
    return out


def roof_rack(y0, y1, x, z, bars=3):
    out = []
    for s in (1, -1):
        out.append(vk.blk("rail", (0.0024, y1 - y0, 0.0018),
                          (s * x, (y0 + y1) / 2, z + 0.004), CHROME,
                          bevel=0.0006, edge=0.04))
        for y in (y0 + 0.004, y1 - 0.004):
            out.append(vk.blk("foot", (0.003, 0.004, 0.005),
                              (s * x, y, z + 0.0015), SEAL, edge=1))
    for k in range(bars):
        y = y0 + (y1 - y0) * (k + 0.5) / bars
        out.append(vk.blk("bar", (2 * x + 0.002, 0.0022, 0.0016),
                          (0, y, z + 0.0055), SEAL, bevel=0.0005, edge=0.03))
    return out


def arches(body, axles, hw, r, depth=0.016):
    for y in axles:
        for s in (1, -1):
            c = vk.cyl("arch", r, depth * 2, (s * hw, y, r - 0.0022), "X",
                       SEAL, verts=24)
            vk.cut(body, c, SEAL)
    return body


def wheels4(axles, x, r, w, whitewall=False, hub=CHROME, rim=None):
    out = []
    names = ("f", "r")
    for k, y in enumerate(axles):
        for s, side in ((-1, "l"), (1, "r")):
            out.append(vk.road_wheel("wheel_%s%s" % (names[min(k, 1)]
                                                    if len(axles) == 2 else
                                                    str(k), side),
                                     r, w, (s * x, y, r), s, hub=hub,
                                     rim=rim, whitewall=whitewall))
    return out


def body_loft(name, keys, front, rear, seams=(), top_seams=(), ys=(),
              mat=BODY, n=3, bottom=0.4, ring_kw=None, extra=None):
    """A lower car body: underside dark, seams dark, the rest body colour."""
    seam_ys = [y for a, b in seams for y in (a, b)] + \
        [y for a, b in top_seams for y in (a, b)]
    secs = vk.stations(keys, list(ys) + seam_ys, front=front, rear=rear,
                       n=n, bottom=bottom, ring_kw=ring_kw or {"nc": 3,
                                                               "nr": 4})

    def cls(i, lab, c, nrm):
        if lab == "b" or (lab == "bc" and nrm.z < -0.6):
            return 2
        for a, b in seams:
            if a - 1e-5 <= c.y <= b + 1e-5 and abs(nrm.x) > 0.55:
                return 1
        for a, b in top_seams:
            if a - 1e-5 <= c.y <= b + 1e-5 and nrm.z > 0.55:
                return 1
        if extra:
            e = extra(i, lab, c, nrm)
            if e is not None:
                return e
        return 0

    return vk.loft(name, secs, [mat, SEAL, CHASSIS, CHROME, CREAM], cls)


def greenhouse(name, y_rb, y_rt, y_ft, y_fb, z0, zb, zt, hw, tumble=0.006,
               rt=0.006, crown=0.0015, z_rear=None, z_front=None,
               pillars=(), mat=BODY, frame=SEAL, rear_side=False,
               front_side=False, roof_mat=None, nc=3, nr=4, inset=True):
    """A car's cabin: windscreen, side and rear windows set into a shell
    whose roof and pillars are body colour."""
    ys = sorted({y_rb, y_rt, y_ft, y_fb} |
                {y for a, b in pillars for y in (a, b)})
    zr = z_rear if z_rear is not None else z0 + 0.006
    zf = z_front if z_front is not None else z0 + 0.006
    secs = []
    for y in ys:
        if y <= y_rb + 1e-9:
            z1, h = zr, hw - 0.0015
        elif y >= y_fb - 1e-9:
            z1, h = zf, hw - 0.0015
        else:
            t = (y - y_rt) / max(1e-6, y_ft - y_rt)
            z1, h = zt - 0.0012 * (2 * t - 1) ** 2, hw
        secs.append((y, vk.ring(h, z0, z1, rb=0.001, rt=rt, tumble=tumble,
                                crown=crown, side=(zb,), nb=2, nc=nc,
                                nr=nr)))
    last = len(secs) - 2

    def kind(i):
        if i == 0:
            return "rear"
        if i == last:
            return "front"
        a, b = secs[i][0], secs[i + 1][0]
        for p0, p1 in pillars:
            if p0 - 1e-6 <= a and b <= p1 + 1e-6:
                return "pillar"
        return "side"

    roof_i = 0 if roof_mat is None else 3

    def cls(i, lab, c, nrm):
        k = kind(i) if 0 <= i <= last else "cap"
        if lab in ("b", "bc", "s0", "cap"):
            return 0
        if lab == "s1":
            if k == "side" or (k == "rear" and rear_side) or \
                    (k == "front" and front_side):
                return 1
            return 0
        if lab == "tc0":
            return 0
        if k in ("front", "rear"):
            return 1
        return roof_i

    obj = vk.loft(name, secs, [mat, GLASS, frame, roof_mat or mat], cls)
    if inset:
        vk.inset(obj, 1, 2, thick=0.0007, depth=0.0009)
    return obj


# ---------------------------------------------------------------- cars

def _split(obj, pred):
    """Move the faces of obj for which pred(centre, normal) holds into a
    new object (returned); the rest stay in obj."""
    leaf = obj.copy()
    leaf.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(leaf)
    for o, keep in ((obj, False), (leaf, True)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        gone = [f for f in bm.faces
                if pred(f.calc_center_median(), f.normal) != keep]
        bmesh.ops.delete(bm, geom=gone, context="FACES")
        bm.to_mesh(o.data)
        bm.free()
    return leaf


def kerb_doors(body, cab, doors, cavity, seats, handles_x, z_sill,
               trim="plastic:seat"):
    """Cut a car's kerb-side (+X) doors out of its lofted body and cab as
    separate leaves: each is the very panel it was cut from (paint, seams,
    side window and frame), a millimetre thick, its inside a dark trim,
    the object origin on its hinge line along the door's front (+Y) edge,
    so a positive rotation about its local Z (Blender; local +Y in the
    glTF) swings it open. Behind the doors a dark cabin (a box seen from
    inside) holds a hint of the seats.

    doors: [(name, y0, y1, w0, w1)], each door's span on the body and its
    window's span on the cab. cavity: [(x0, x1, y0, y1, z0, z1)] boxes of
    the dark cabin. seats: [(y, w)], a bench seat at y across w. handles_x:
    the +X door handle objects, carried by the door they sit on. Returns
    the leaves and the interior parts."""
    kit.apply(body)
    kit.apply(cab)
    leaves = []
    for name, y0, y1, w0, w1 in doors:
        def on_body(c, n, y0=y0, y1=y1):
            return n.x > 0.25 and c.x > 0.004 and y0 + 1e-4 < c.y < \
                y1 - 1e-4 and c.z > z_sill

        def on_cab(c, n, w0=w0, w1=w1):
            return n.x > 0.45 and c.x > 0.004 and w0 + 1e-4 < c.y < w1 - 1e-4
        parts = [_split(body, on_body), _split(cab, on_cab)]
        for h in list(handles_x):
            if y0 < h.location.y < y1:
                parts.append(h)
                handles_x.remove(h)
        leaf = kit.join(parts, name)
        mod = leaf.modifiers.new("solid", "SOLIDIFY")
        mod.thickness = 0.001
        mod.offset = -1
        kit.apply(leaf)
        leaf.data.materials.append(kit.material(trim))
        k = len(leaf.data.materials) - 1
        for p in leaf.data.polygons:
            if p.normal.x < -0.4:
                p.material_index = k
        kit.shade(leaf, 38)
        xs = [v.co for v in leaf.data.vertices if v.co.y > y1 - 0.0025]
        xh = max(v.x for v in xs)
        zh = sum(v.z for v in xs) / len(xs)
        kit.set_pivot(leaf, (xh, y1, zh))
        leaves.append(leaf)
    inside = []
    for x0, x1, y0, y1, z0, z1 in cavity:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=Vector((x1 - x0, y1 - y0, z1 - z0)),
                        verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2,
                                            (z0 + z1) / 2)), verts=bm.verts)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        inside.append(vk.mesh("cabin", bm, [VOID]))
    for y, w in seats:
        inside.append(vk.blk("seat", (w, 0.012, 0.006), (0.0, y, 0.021),
                             SEAT, bevel=0.001, edge=1))
        inside.append(vk.blk("seat-back", (w, 0.004, 0.016),
                             (0.0, y - 0.007, 0.031), SEAT, bevel=0.001,
                             edge=1))
    return leaves, inside


def car_keys(hw, rear, mid, front, rb=0.006, rt=0.008, tumble=0.003,
             crown=0.002, z0=0.009, half=0.075, mid_y=0.0):
    return [
        (-half, dict(hw=hw - 0.0005, z0=z0 + 0.001, z1=rear, rb=rb, rt=rt,
                     tumble=tumble, crown=crown)),
        (mid_y, dict(hw=hw, z0=z0, z1=mid, rb=rb, rt=rt, tumble=tumble,
                     crown=crown)),
        (half, dict(hw=hw - 0.001, z0=z0 + 0.001, z1=front, rb=rb, rt=rt,
                    tumble=tumble, crown=crown + 0.001)),
    ]


def grille(y, w, h, z, slats=3, frame=CHROME):
    parts = [vk.blk("grille", (w, 0.003, h), (0, y, z), SEAL, bevel=0.001)]
    for k in range(slats):
        parts.append(vk.blk("slat", (w - 0.002, 0.0012, 0.0007),
                            (0, y + 0.0014, z - h / 2 + h * (k + 0.5) / slats),
                            frame, edge=1))
    return parts


def car_hatch():
    root = kit.empty("car_hatch")
    hw, r, w = 0.0365, 0.0165, 0.011
    axles = (0.047, -0.046)
    keys = car_keys(hw, 0.045, 0.043, 0.035)
    body = body_loft("hatch-body", keys, front=0.009, rear=0.006,
                     seams=[(-0.026, -0.0253), (0.0175, 0.0182)],
                     top_seams=[(0.0275, 0.0282)])
    arches(body, axles, hw, r + 0.0024)
    cab = greenhouse("hatch-cab", -0.070, -0.060, -0.004, 0.026, z0=0.036,
                     zb=0.0445, zt=0.0685, hw=0.0325, tumble=0.0065,
                     rt=0.0065, z_rear=0.047, z_front=0.040,
                     pillars=[(-0.0275, -0.0235)])
    parts = [body, cab]
    parts += headlights(0.0745, 0.0235, 0.029, r=0.0048)
    parts += grille(0.0745, 0.026, 0.0065, 0.0225)
    parts += bumper(0.0752, 0.0345, 0.0145, r=0.0024)
    parts += bumper(-0.0756, 0.0345, 0.016, front=False, r=0.0024)
    parts += plate(0.0772, 0.0145)
    parts += plate(-0.0772, 0.0258, front=False)
    parts += taillights(-0.0745, 0.0275, 0.034)
    parts += mirrors(0.0, 0.0318, 0.0462)
    parts += handles([-0.021], 0.0372, 0.0395)
    parts += [vk.blk("spoiler", (0.05, 0.008, 0.0025), (0, -0.064, 0.0688),
                     BODY, bevel=0.001)]
    parts += [vk.cyl("exhaust", 0.0018, 0.008, (0.02, -0.074, 0.0095), "Y",
                     CHROME, verts=10)]
    wheels = wheels4(axles, hw - w / 2 + 0.0006, r, w)
    return vk.finish(root, parts, wheels)


def car_sedan():
    root = kit.empty("car_sedan")
    hw, r, w = 0.037, 0.0165, 0.011
    axles = (0.054, -0.052)
    keys = car_keys(hw, 0.042, 0.042, 0.035, half=0.085, rt=0.007,
                    tumble=0.0035)
    body = body_loft("sedan-body", keys, front=0.009, rear=0.008,
                     seams=[(0.0295, 0.0302), (-0.0085, -0.0078),
                            (-0.0455, -0.0448)],
                     top_seams=[(0.0335, 0.0342), (-0.0545, -0.0538)])
    arches(body, axles, hw, r + 0.0024)
    cab = greenhouse("sedan-cab", -0.052, -0.034, 0.006, 0.033, z0=0.035,
                     zb=0.0438, zt=0.0665, hw=0.0332, tumble=0.0068,
                     rt=0.0065, z_rear=0.044, z_front=0.0395,
                     pillars=[(-0.0105, -0.0062)], frame=CHROME,
                     rear_side=True)
    hs = handles([0.012, -0.026], 0.0377, 0.039)
    hl = [h for h in hs if h.location.x < 0]
    # Kerb-side doors (cars drive on the right): front and rear leaves.
    doors, inside = kerb_doors(
        body, cab,
        [("door_rf", -0.0078, 0.0295, -0.0062, 0.006),
         ("door_rr", -0.0448, -0.0085, -0.034, -0.0105)],
        cavity=[(-0.02, 0.032, -0.033, 0.029, 0.0135, 0.0335),
                (-0.02, 0.028, -0.0445, -0.033, 0.034, 0.041),
                (-0.02, 0.025, -0.034, 0.0055, 0.0335, 0.058)],
        seats=[(0.004, 0.05), (-0.029, 0.05)],
        handles_x=[h for h in hs if h.location.x > 0], z_sill=0.0178)
    parts = [body, cab] + hl + inside
    for s in (1, -1):
        parts.append(vk.blk("hl", (0.011, 0.003, 0.0055),
                            (s * 0.025, 0.0838, 0.029), CHROME, bevel=0.001))
        parts.append(vk.blk("hl-lens", (0.0094, 0.0012, 0.004),
                            (s * 0.025, 0.0852, 0.029), LAMP, edge=1))
    parts += grille(0.0842, 0.03, 0.006, 0.0225, slats=3)
    parts += bumper(0.0848, 0.035, 0.0145, r=0.0024)
    parts += bumper(-0.0852, 0.035, 0.0155, front=False, r=0.0024)
    parts += plate(0.0868, 0.0145)
    parts += plate(-0.0848, 0.031, front=False)
    parts += taillights(-0.0842, 0.0262, 0.0355, w=0.012, h=0.0048)
    parts += mirrors(0.01, 0.0325, 0.0452)
    parts += [vk.blk("sill", (0.002, 0.07, 0.0016), (s * 0.0372, 0.0, 0.0168),
                     CHROME, edge=0.04) for s in (1, -1)]
    parts += [vk.blk("aerial", (0.0008, 0.0008, 0.014), (0.022, -0.06, 0.049),
                     SEAL, edge=1)]
    parts += [vk.cyl("exhaust", 0.0018, 0.008, (0.022, -0.084, 0.0095), "Y",
                     CHROME, verts=10)]
    wheels = wheels4(axles, hw - w / 2 + 0.0006, r, w)
    return vk.finish(root, parts, wheels, doors)


def car_retro():
    """A round little 1950s saloon: domed cabin with a cream roof, bulging
    fenders, round chrome lamps and whitewall tyres."""
    root = kit.empty("car_retro")
    hw, r, w = 0.0335, 0.0155, 0.010
    axles = (0.046, -0.045)
    keys = car_keys(hw, 0.041, 0.042, 0.036, rb=0.01, rt=0.011,
                    tumble=0.003, crown=0.004, z0=0.011)
    body = body_loft("retro-body", keys, front=0.016, rear=0.02, n=4,
                     seams=[(0.017, 0.0177), (-0.0215, -0.0208)],
                     top_seams=[(0.031, 0.0317)], bottom=0.5)
    cab = greenhouse("retro-cab", -0.060, -0.036, 0.0, 0.024, z0=0.035,
                     zb=0.0445, zt=0.069, hw=0.030, tumble=0.0075,
                     rt=0.0105, crown=0.004, z_rear=0.045, z_front=0.041,
                     pillars=[(-0.0175, -0.0135)], frame=CHROME,
                     roof_mat=CREAM, nc=4, nr=4)
    fenders = []
    for k, y in enumerate(axles):
        for s in (1, -1):
            f = vk.ball("fender", 0.02, (s * (hw - 0.0035), y + (0.004 if k == 0
                                                             else -0.003),
                                         0.0205), BODY,
                        scale=(0.42, 1.25 if k == 0 else 1.2, 0.95),
                        seg=14, rings=8)
            fenders.append(f)
    for o in [body] + fenders:
        arches(o, axles, hw + 0.002, r + 0.0022, depth=0.02)
    hs = handles([-0.017], 0.0342, 0.0392)
    hl = [h for h in hs if h.location.x < 0]
    # A two-door saloon: one kerb-side (+X) door leaf.
    doors, inside = kerb_doors(
        body, cab, [("door_rf", -0.0208, 0.017, -0.0135, 0.0)],
        cavity=[(-0.02, 0.029, -0.02, 0.0165, 0.016, 0.033),
                (-0.02, 0.022, -0.0135, -0.0005, 0.033, 0.06)],
        seats=[(0.001, 0.046)],
        handles_x=[h for h in hs if h.location.x > 0], z_sill=0.0165)
    parts = [body, cab] + fenders + inside + hl
    for s in (1, -1):
        parts.append(vk.cyl("hl-rim", 0.0056, 0.004, (s * 0.0262, 0.0705,
                                                      0.0285), "Y", CHROME,
                            verts=16))
        parts.append(vk.cyl("hl-lens", 0.0045, 0.0012, (s * 0.0262, 0.0727,
                                                        0.0285), "Y", LAMP,
                            verts=16))
        parts.append(vk.cyl("tail", 0.003, 0.003, (s * 0.024, -0.072, 0.034),
                            "Y", TAIL, verts=12))
        parts.append(vk.blk("board", (0.006, 0.05, 0.0018),
                            (s * (hw - 0.002), 0.0, 0.0122), SEAL, edge=1))
    # A chrome oval grille and a centre spine on the bonnet.
    parts.append(vk.cyl("grille", 0.0072, 0.003, (0, 0.0742, 0.0225), "Y",
                        CHROME, verts=16))
    parts[-1].scale = (1.35, 1, 0.75)
    parts.append(vk.cyl("grille-in", 0.006, 0.003, (0, 0.0752, 0.0225), "Y",
                        SEAL, verts=16))
    parts[-1].scale = (1.35, 1, 0.72)
    parts.append(vk.blk("spine", (0.0018, 0.036, 0.0012), (0, 0.05, 0.0378),
                        CHROME, edge=0.04))
    parts += bumper(0.0752, 0.033, 0.0145, r=0.0026, wrap=0.016)
    parts += bumper(-0.0756, 0.033, 0.0155, front=False, r=0.0026,
                    wrap=0.016)
    for s in (1, -1):
        for y, d in ((0.0772, 1), (-0.0778, -1)):
            parts.append(vk.blk("overrider", (0.0026, 0.004, 0.009),
                                (s * 0.012, y, 0.017), CHROME, bevel=0.001))
    parts += plate(-0.0748, 0.0262, front=False, w=0.014, h=0.0045)
    parts += mirrors(0.004, 0.0292, 0.0458, mat=CHROME)
    wheels = wheels4(axles, hw - w / 2 + 0.0012, r, w, whitewall=True)
    return vk.finish(root, parts, wheels, doors)


def van():
    """A boxy delivery van: short bonnet, tall load box, sliding side door,
    rear doors with windows and a roof rack."""
    root = kit.empty("van")
    hw, r, w = 0.039, 0.0172, 0.0115
    axles = (0.056, -0.058)
    zt = 0.088
    keys = [
        (-0.09, dict(hw=hw - 0.0005, z0=0.011, z1=zt, rb=0.005, rt=0.008,
                     tumble=0.002, crown=0.003)),
        (0.036, dict(hw=hw, z0=0.010, z1=zt, rb=0.005, rt=0.008,
                     tumble=0.002, crown=0.003)),
        (0.066, dict(hw=hw, z0=0.010, z1=0.047, rb=0.005, rt=0.007,
                     tumble=0.0025, crown=0.003)),
        (0.09, dict(hw=hw - 0.001, z0=0.011, z1=0.042, rb=0.005, rt=0.007,
                    tumble=0.0025, crown=0.003)),
    ]
    ys = [0.012, 0.0155, 0.05, 0.0525, 0.066]
    seams = [(0.0105, 0.0112), (0.0545, 0.0552), (-0.0065, -0.0058),
             (-0.0485, -0.0478)]

    def extra(i, lab, c, n):
        if lab in ("s1",) and 0.0155 <= c.y <= 0.05 and abs(n.x) > 0.5:
            return 5
        if 0.036 <= c.y <= 0.066 and lab in ("tc1", "tc2", "r") \
                and n.z > 0.2:
            return 5
        return None

    secs_kw = {"nc": 3, "nr": 4}
    seam_ys = [y for a, b in seams for y in (a, b)]
    secs = vk.stations(keys, ys + seam_ys + [0.036], front=0.007, rear=0.004,
                       n=3, ring_kw=secs_kw,
                       side_fn=lambda p: (0.051,))

    def cls(i, lab, c, nrm):
        if lab == "b" or (lab == "bc" and nrm.z < -0.6):
            return 2
        e = extra(i, lab, c, nrm)
        if e is not None:
            return e
        for a, b in seams:
            if a - 1e-5 <= c.y <= b + 1e-5 and abs(nrm.x) > 0.55:
                return 1
        return 0

    body = vk.loft("van-body", secs, [BODY, SEAL, CHASSIS, CHROME, CREAM,
                                      GLASS], cls)
    vk.inset(body, 5, 1, thick=0.0008, depth=0.001)
    arches(body, axles, hw, r + 0.0025)
    # Rear door windows and the split between the doors.
    for s in (1, -1):
        vk.window(body, (s * 0.016, -0.09, 0.067), (0.022, 0.02), "-y")
    parts = [body]
    parts.append(vk.blk("rear-split", (0.0008, 0.002, 0.07),
                        (0, -0.0904, 0.048), SEAL, edge=1))
    for s in (1, -1):
        parts.append(vk.blk("hl", (0.011, 0.003, 0.0065),
                            (s * 0.0262, 0.0892, 0.031), CHROME, bevel=0.001))
        parts.append(vk.blk("hl-lens", (0.0094, 0.0012, 0.005),
                            (s * 0.0262, 0.0906, 0.031), LAMP, edge=1))
        parts.append(vk.blk("tail", (0.0055, 0.003, 0.016),
                            (s * 0.0345, -0.0898, 0.032), TAIL, bevel=0.0008))
        parts.append(vk.blk("rail", (0.0016, 0.05, 0.0016),
                            (s * (hw - 0.0005), -0.027, 0.0525), SEAL,
                            edge=0.05))
    parts += grille(0.0892, 0.032, 0.008, 0.021, slats=3, frame=SEAL)
    parts.append(vk.blk("badge", (0.006, 0.001, 0.003), (0, 0.0914, 0.0215),
                        CHROME, edge=1))
    parts += bumper(0.0905, 0.0375, 0.0145, r=0.003, mat=SEAL)
    parts += bumper(-0.0915, 0.0375, 0.015, front=False, r=0.003, mat=SEAL)
    parts += plate(0.0935, 0.0145)
    parts += plate(-0.0935, 0.0265, front=False)
    parts += mirrors(0.054, 0.0385, 0.0505, mat=SEAL)
    parts += handles([0.019, -0.011], 0.0395, 0.045)
    parts += roof_rack(-0.082, 0.028, 0.03, zt + 0.0025, bars=4)
    parts.append(vk.blk("step", (0.03, 0.006, 0.002), (0, -0.0935, 0.012),
                        SEAL, edge=1))
    wheels = wheels4(axles, hw - w / 2 + 0.0006, r, w)
    return vk.finish(root, parts, wheels)


def bus():
    """A city bus: long window band, glazed doors on the kerb side (+x),
    a big framed windscreen, destination display and roof units."""
    root = kit.empty("bus")
    hw, r, w = 0.0445, 0.0175, 0.013
    axles = (0.078, -0.072)
    zt = 0.104
    half = 0.135
    wz = (0.052, 0.088)
    # Window spans along each side, with doors on +x.
    mull = 0.004
    starts = [-0.124 + k * 0.035 for k in range(7)]
    wins = [(y + mull / 2, y + 0.035 - mull / 2) for y in starts]
    doors = [wins[6], wins[3]]
    ys = [y for a, b in wins for y in (a, b)] + \
        [(a + b) / 2 + d for a, b in doors for d in (-0.0004, 0.0004)]
    keys = [(-half, dict(hw=hw, z0=0.013, z1=zt, rb=0.006, rt=0.012,
                         tumble=0.002, crown=0.004)),
            (half, dict(hw=hw, z0=0.013, z1=zt, rb=0.006, rt=0.012,
                        tumble=0.002, crown=0.004))]
    secs = vk.stations(keys, ys, front=0.01, rear=0.008, n=3,
                       ring_kw={"nc": 3, "nr": 4},
                       side_fn=lambda p: wz)

    def cls(i, lab, c, n):
        if lab == "b" or (lab == "bc" and n.z < -0.6):
            return 2
        if c.x > 0 and lab in ("s0", "s1") and abs(n.x) > 0.5:
            for a, b in doors:
                if a <= c.y <= b:
                    return 1 if abs(c.y - (a + b) / 2) < 0.0006 else 3
        if lab == "s1" and abs(n.x) > 0.5:
            if any(a <= c.y <= b for a, b in wins):
                return 3
        if lab == "s0" and abs(n.x) > 0.5:
            return 4
        return 0

    body = vk.loft("bus-body", secs, [BODY, SEAL, CHASSIS, GLASS, CREAM],
                   cls)
    vk.inset(body, 3, 1, thick=0.0009, depth=0.0011)
    arches(body, axles, hw, r + 0.003, depth=0.018)
    vk.window(body, (0, half, 0.067), (0.066, 0.036), "y", depth=0.0016,
              round_=0.004)
    vk.window(body, (0, -half, 0.078), (0.064, 0.026), "-y", depth=0.0016,
              round_=0.004)
    parts = [body]
    parts.append(vk.blk("dest", (0.048, 0.0016, 0.0055), (0, half + 0.0001,
                                                          0.0895), LAMP,
                        edge=1))
    parts.append(vk.blk("dest-frame", (0.052, 0.0012, 0.0078),
                        (0, half - 0.0003, 0.0895), SEAL, edge=1))
    parts.append(vk.blk("wiper", (0.03, 0.001, 0.001), (-0.012, half + 0.0006,
                                                        0.053), SEAL, edge=1,
                        rot=(0, 0.3, 0)))
    for s in (1, -1):
        parts.append(vk.blk("hl", (0.012, 0.003, 0.006),
                            (s * 0.031, half - 0.0004, 0.03), CHROME,
                            bevel=0.001))
        parts.append(vk.blk("hl-lens", (0.0104, 0.0012, 0.0045),
                            (s * 0.031, half + 0.0008, 0.03), LAMP, edge=1))
        parts.append(vk.blk("tail", (0.006, 0.003, 0.018),
                            (s * 0.038, -half + 0.0004, 0.04), TAIL,
                            bevel=0.0008))
        parts.append(vk.blk("mirror-arm", (0.0016, 0.012, 0.0016),
                            (s * (hw + 0.002), half - 0.004, 0.095), SEAL,
                            edge=1, rot=(0.6, 0, 0)))
        parts.append(vk.blk("mirror", (0.004, 0.003, 0.011),
                            (s * (hw + 0.003), half + 0.002, 0.085), SEAL,
                            bevel=0.001))
    parts += bumper(half + 0.0005, 0.043, 0.017, r=0.0035, mat=SEAL,
                    wrap=0.006)
    parts += bumper(-half - 0.0005, 0.043, 0.017, front=False, r=0.0035,
                    mat=SEAL, wrap=0.006)
    parts += plate(half + 0.002, 0.0175)
    parts += plate(-half - 0.002, 0.0265, front=False)
    # Engine grille at the back.
    for k in range(4):
        parts.append(vk.blk("vent", (0.05, 0.0012, 0.0012),
                            (0, -half - 0.0001, 0.05 + k * 0.003), SEAL,
                            edge=1))
    # Roof: air-con pod and two hatches.
    ac = vk.blk("aircon", (0.052, 0.07, 0.008), (0, -0.07, zt + 0.006),
                CREAM, bevel=0.003)
    parts.append(ac)
    for k in range(3):
        parts.append(vk.cyl("fan", 0.0075, 0.002, (0, -0.093 + k * 0.023,
                                                   zt + 0.0105), "Z", SEAL,
                            verts=14))
    for y in (0.02, 0.085):
        parts.append(vk.blk("hatch", (0.026, 0.024, 0.0026),
                            (0, y, zt + 0.0035), CREAM, bevel=0.001))
    wheels = wheels4(axles, hw - w / 2 + 0.0004, r, w)
    return vk.finish(root, parts, wheels)


def lorry():
    """A cab-over lorry with a box body on a black chassis, tandem rear
    axles, steps, mudguards and a fuel tank."""
    root = kit.empty("lorry")
    hw, r, w = 0.0425, 0.018, 0.013
    axles = (0.088, -0.054, -0.09)
    y0, y1 = 0.064, 0.125
    keys = [(y0, dict(hw=hw, z0=0.021, z1=0.1, rb=0.004, rt=0.009,
                      tumble=0.003, crown=0.004)),
            (y1, dict(hw=hw, z0=0.021, z1=0.1, rb=0.004, rt=0.009,
                      tumble=0.003, crown=0.004))]
    side_z = (0.06, 0.088)
    secs = vk.stations(keys, [0.072, 0.074, 0.112, 0.1128, 0.108],
                       front=0.008, rear=0.002, n=3,
                       ring_kw={"nc": 3, "nr": 4}, side_fn=lambda p: side_z)

    def cls(i, lab, c, n):
        if lab == "b":
            return 2
        if lab == "s1" and 0.074 <= c.y <= 0.108 and abs(n.x) > 0.5:
            return 3
        if 0.112 <= c.y <= 0.1128 and lab in ("s0", "s1") and \
                abs(n.x) > 0.5:
            return 1
        return 0

    cab = vk.loft("lorry-cab", secs, [BODY, SEAL, CHASSIS, GLASS], cls)
    vk.inset(cab, 3, 1, thick=0.0008, depth=0.001)
    arches(cab, axles[:1], hw, r + 0.003, depth=0.018)
    vk.window(cab, (0, y1, 0.077), (0.064, 0.026), "y", depth=0.0015,
              round_=0.003)
    parts = [cab]
    # Box body.
    box = vk.blk("box", (0.088, 0.178, 0.082), (0, -0.033, 0.081), CARGO,
                 bevel=0.003, edge=0.03)
    parts.append(box)
    for k in range(7):
        y = -0.118 + k * 0.0283
        for s in (1, -1):
            parts.append(vk.blk("rib", (0.0018, 0.003, 0.08),
                                (s * 0.0444, y, 0.081), CARGO, edge=0.04))
    for s in (1, -1):
        parts.append(vk.blk("stripe", (0.0012, 0.17, 0.008),
                            (s * 0.0446, -0.033, 0.047), BODY, edge=0.04))
        parts.append(vk.blk("top-rail", (0.003, 0.178, 0.003),
                            (s * 0.0442, -0.033, 0.1205), CHROME, edge=0.1))
        parts.append(vk.blk("hinge", (0.004, 0.002, 0.004),
                            (s * 0.04, -0.1225, 0.056), CHROME, edge=1))
        parts.append(vk.blk("hinge", (0.004, 0.002, 0.004),
                            (s * 0.04, -0.1225, 0.106), CHROME, edge=1))
    for k in range(8):
        parts.append(vk.blk("roof-rib", (0.084, 0.0024, 0.0012),
                            (0, -0.112 + k * 0.0225, 0.1222), CARGO,
                            edge=1))
    parts.append(vk.blk("door-split", (0.0008, 0.0016, 0.082),
                        (0, -0.1223, 0.081), SEAL, edge=1))
    for s in (1, -1):
        parts.append(vk.blk("lock-bar", (0.0014, 0.0016, 0.08),
                            (s * 0.008, -0.1228, 0.081), CHROME, edge=1))
    # Chassis, tank, guards.
    for s in (1, -1):
        parts.append(vk.blk("frame", (0.008, 0.24, 0.012),
                            (s * 0.021, -0.0, 0.031), CHASSIS, edge=0.05))
    parts.append(vk.blk("deck", (0.088, 0.18, 0.004), (0, -0.033, 0.039),
                        CHASSIS, bevel=0.001, edge=0.05))
    parts.append(vk.cyl("tank", 0.0085, 0.032, (0.034, 0.016, 0.023), "Y",
                        CHROME, verts=14))
    parts.append(vk.blk("underrun", (0.08, 0.004, 0.006), (0, -0.124, 0.016),
                        SEAL, bevel=0.001))
    for s in (1, -1):
        parts.append(vk.blk("hl", (0.012, 0.003, 0.006),
                            (s * 0.029, y1 - 0.0004, 0.034), CHROME,
                            bevel=0.001))
        parts.append(vk.blk("hl-lens", (0.0104, 0.0012, 0.0045),
                            (s * 0.029, y1 + 0.0008, 0.034), LAMP, edge=1))
        parts.append(vk.blk("tail", (0.008, 0.003, 0.005),
                            (s * 0.034, -0.1245, 0.0255), TAIL, bevel=0.0008))
        parts.append(vk.blk("step", (0.004, 0.012, 0.002),
                            (s * (hw - 0.001), 0.094, 0.018), CHROME,
                            edge=1))
        parts.append(vk.blk("mirror-arm", (0.009, 0.0015, 0.0015),
                            (s * (hw + 0.003), 0.118, 0.085), SEAL, edge=1))
        parts.append(vk.blk("mirror", (0.003, 0.004, 0.014),
                            (s * (hw + 0.007), 0.117, 0.077), SEAL,
                            bevel=0.001))
        parts.append(vk.blk("roof-lamp", (0.005, 0.003, 0.0025),
                            (s * 0.016, y1 - 0.004, 0.1025), "glow:amber",
                            edge=1))
    parts += grille(y1 + 0.0002, 0.05, 0.016, 0.05, slats=5)
    parts += bumper(y1 + 0.0008, 0.042, 0.019, r=0.0036, mat=SEAL,
                    wrap=0.004)
    parts += plate(y1 + 0.0048, 0.019)
    parts += plate(-0.1245, 0.0175, front=False)
    parts.append(vk.blk("visor", (0.078, 0.008, 0.0022), (0, y1 - 0.001,
                                                          0.0985), SEAL,
                        bevel=0.0008))
    wheels = []
    names = ["f", "m", "r"]
    for k, y in enumerate(axles):
        for s, side in ((-1, "l"), (1, "r")):
            wheels.append(vk.road_wheel("wheel_%s%s" % (names[k], side), r,
                                        w, (s * (hw - w / 2 + 0.0004), y, r),
                                        s))
    return vk.finish(root, parts, wheels)


def tractor():
    """A farm tractor: narrow bonnet with grille and stack, a glazed cab
    with a body-coloured roof, big ribbed rear wheels under mudguards."""
    root = kit.empty("tractor")
    rr, rw = 0.029, 0.018
    fr, fw = 0.0155, 0.0105
    ry, fy = -0.03, 0.031
    keys = [(-0.012, dict(hw=0.0175, z0=0.018, z1=0.052, rb=0.004, rt=0.007,
                          tumble=0.002, crown=0.003)),
            (0.051, dict(hw=0.0165, z0=0.02, z1=0.049, rb=0.004, rt=0.007,
                         tumble=0.002, crown=0.003))]
    seams = [(0.0145, 0.0152), (0.034, 0.0347)]
    hood = body_loft("tractor-hood", keys, front=0.006, rear=0.002,
                     seams=seams, n=2)
    parts = [hood]
    # Side vents on the bonnet.
    for s in (1, -1):
        for k in range(4):
            parts.append(vk.blk("vent", (0.001, 0.016, 0.0012),
                                (s * 0.0172, 0.024, 0.03 + k * 0.0032), SEAL,
                                edge=1))
    parts += grille(0.0512, 0.026, 0.022, 0.034, slats=5)
    for s in (1, -1):
        parts.append(vk.cyl("hl-rim", 0.004, 0.004, (s * 0.0105, 0.0515,
                                                     0.051), "Y", CHROME,
                            verts=12))
        parts.append(vk.cyl("hl-lens", 0.0032, 0.0012, (s * 0.0105, 0.0537,
                                                        0.051), "Y", LAMP,
                            verts=12))
    parts.append(vk.cyl("stack", 0.0024, 0.03, (0.009, 0.036, 0.062), "Z",
                        CHASSIS, verts=10))
    parts.append(vk.cyl("stack-cap", 0.0031, 0.003, (0.009, 0.036, 0.0775),
                        "Z", CHROME, verts=10))
    # Chassis and front axle.
    parts.append(vk.blk("chassis", (0.03, 0.09, 0.014), (0, 0.002, 0.017),
                        CHASSIS, bevel=0.002, edge=0.04))
    parts.append(vk.blk("axle-beam", (0.05, 0.007, 0.006), (0, fy, fr),
                        CHASSIS, bevel=0.001))
    parts.append(vk.blk("weights", (0.026, 0.006, 0.012), (0, 0.052, 0.02),
                        CHASSIS, bevel=0.0015))
    # An open cab: platform, four posts, a canopy, seat and wheel.
    cx, cy0, cy1, cz0, cz1 = 0.019, -0.056, -0.01, 0.044, 0.1
    parts.append(vk.blk("floor", (2 * cx + 0.004, cy1 - cy0 + 0.004, 0.005),
                        (0, (cy0 + cy1) / 2, cz0 - 0.0025), CHASSIS,
                        bevel=0.0012))
    for sx in (1, -1):
        for y in (cy0, cy1):
            parts.append(vk.blk("post", (0.0032, 0.0032, cz1 - cz0),
                                (sx * cx, y, (cz0 + cz1) / 2), CHASSIS,
                                bevel=0.0006))
    parts.append(vk.blk("roof", (0.054, cy1 - cy0 + 0.014, 0.0055),
                        (0, (cy0 + cy1) / 2, cz1 + 0.0025), BODY,
                        bevel=0.0024, seg=2))
    parts.append(vk.blk("beacon", (0.005, 0.005, 0.004), (0.012, cy0 + 0.008,
                                                          cz1 + 0.0072),
                        "glow:amber", bevel=0.0012))
    parts.append(vk.blk("seat", (0.018, 0.014, 0.005), (0, -0.044, 0.052),
                        SEAT, bevel=0.002))
    parts.append(vk.blk("seat-back", (0.018, 0.004, 0.016), (0, -0.0515,
                                                              0.062), SEAT,
                        bevel=0.0016))
    parts.append(vk.blk("seat-post", (0.004, 0.004, 0.008), (0, -0.044,
                                                              0.047),
                        CHASSIS, edge=1))
    wheel_ring = vk.cyl("steer", 0.0062, 0.0014, (0, -0.02, 0.066), "Z",
                        SEAL, verts=14)
    wheel_ring.rotation_euler = (-0.6, 0, 0)
    parts.append(wheel_ring)
    parts.append(vk.rod("column", (0, -0.012, 0.05), (0, -0.0195, 0.0655),
                        0.0012, SEAL))
    parts.append(vk.blk("dash", (0.026, 0.008, 0.012), (0, -0.008, 0.05),
                        BODY, bevel=0.0015))
    parts.append(vk.blk("lever", (0.0012, 0.0012, 0.014), (0.012, -0.03,
                                                            0.052), SEAL,
                        edge=1, rot=(0.3, 0, 0)))
    # Rear mudguards: curved shells over the big wheels.
    for s in (1, -1):
        x = s * (0.0315)
        prof = []
        arc = []
        for k in range(9):
            a = math.radians(-10 + 200 * k / 8)
            arc.append((ry + math.cos(a) * (rr + 0.004),
                        rr + math.sin(a) * (rr + 0.004)))
        pts = [(x, y, z) for y, z in arc]
        g = vk.tube("guard", pts, 0.0028, BODY, seg=8)
        g.scale = (3.4, 1, 1)
        g.location = (x * (1 - 3.4), 0, 0)
        parts.append(g)
        parts.append(vk.blk("tail", (0.004, 0.0025, 0.004),
                            (s * 0.0315, ry - rr - 0.0035, rr + 0.006), TAIL,
                            edge=1))
        parts.append(vk.blk("fender-step", (0.008, 0.008, 0.002),
                            (s * 0.024, -0.004, 0.03), CHASSIS, edge=1))
    parts.append(vk.blk("hitch", (0.012, 0.01, 0.005), (0, -0.062, 0.02),
                        CHASSIS, bevel=0.001))
    wheels = []
    for s, side in ((-1, "l"), (1, "r")):
        wheels.append(tractor_wheel("wheel_r%s" % side, rr, rw,
                                    (s * 0.031, ry, rr), s))
        wheels.append(vk.road_wheel("wheel_f%s" % side, fr, fw,
                                    (s * 0.0265, fy, fr), s,
                                    hub=YELLOW, rim=YELLOW))
    return vk.finish(root, parts, wheels)


def tractor_wheel(name, r, w, loc, side):
    """A big tractor wheel: tyre with chunky chevron lugs, yellow rim."""
    s = 1 if side > 0 else -1
    h = w / 2
    prof = [(0.0, -h * s, 0), (r * 0.72, -h * s, 0),
            (r * 0.92, -(h - w * 0.06) * s, 0), (r * 0.94, -(h - w * 0.2) * s, 0),
            (r * 0.94, (h - w * 0.2) * s, 0), (r * 0.92, (h - w * 0.06) * s, 0),
            (r * 0.72, h * s, 1), (r * 0.6, (h - w * 0.15) * s, 1),
            (r * 0.25, (h - w * 0.15) * s, 2), (0.0, (h + w * 0.04) * s, 2)]
    parts = [vk.spin(name + "-t", prof, [TYRE, YELLOW, CHASSIS], (0, 0, 0),
                     22)]
    lugs = 16
    for k in range(lugs):
        a = k / lugs * math.tau
        for half in (-1, 1):
            c = Vector((half * w * 0.25, math.cos(a) * r * 0.955,
                        math.sin(a) * r * 0.955))
            lug = vk.blk(name + "-lug", (w * 0.48, 0.0042, r * 0.1), c, TYRE,
                         edge=1)
            lug.rotation_euler = (a + math.pi / 2, 0, half * 0.5)
            parts.append(lug)
    obj = kit.join(parts, name)
    obj.location = loc
    kit.shade(obj, 45)
    obj["radius"] = r
    return obj


# ---------------------------------------------------------------- trains

RAIL = 0.04       # rail top above the root
BUF = 0.0092      # buffer head reach beyond the buffer beam


def buffers(y, s, z=0.079, beam=BEAM, hw=0.072, lamp=False):
    """A buffer beam whose outer face is at y, two sprung buffers and a
    coupling hook; s = +1 at the front (+Y) end, -1 at the back."""
    parts = [vk.blk("beam", (2 * hw, 0.006, 0.017), (0, y - s * 0.003, z),
                    beam, bevel=0.0012, seg=1, edge=0.08)]
    for x in (-0.05, 0.05):
        parts.append(vk.cyl("buf-shank", 0.0042, 0.007,
                            (x, y + s * 0.0035, z), "Y", CHASSIS, verts=8,
                            cap=False))
        parts.append(vk.cyl("buf-head", 0.0072, 0.0022,
                            (x, y + s * 0.0081, z), "Y", CHROME, verts=12))
    parts.append(vk.blk("hook", (0.005, 0.007, 0.004),
                        (0, y + s * 0.0035, z - 0.002), CHASSIS, edge=1))
    parts.append(vk.rod("link", (0, y + s * 0.0068, z - 0.002),
                        (0, y + s * 0.0088, z - 0.007), 0.001, CHASSIS,
                        seg=6))
    if lamp:
        parts += lamp_at((0.03, y + s * 0.004, z + 0.016), s)
    return parts


def lamp_at(at, s):
    """A little white railway lamp with a glowing lens facing out."""
    x, y, z = at
    return [
        vk.blk("lamp-body", (0.009, 0.007, 0.011), (x, y, z), WHITE,
               bevel=0.0012),
        vk.blk("lamp-top", (0.007, 0.006, 0.002), (x, y, z + 0.0065), CHASSIS,
               edge=1),
        vk.cyl("lamp-lens", 0.0032, 0.0016, (x, y + s * 0.0035, z - 0.0005),
               "Y", LAMP, verts=8),
        vk.blk("lamp-handle", (0.0014, 0.0014, 0.004),
               (x, y, z + 0.009), CHASSIS, edge=1),
    ]


def bogie(tag, y, r=0.012, gap=0.042, centre=CHASSIS, segments=14):
    """A two-axle bogie: side frames with axleboxes and springs, a
    bolster, and its two wheelsets (wheel_<tag>1, wheel_<tag>2)."""
    z = RAIL + r
    parts, wheels = [], []
    for s in (1, -1):
        x = s * 0.0565
        parts.append(vk.blk("frame", (0.005, gap + 2 * r + 0.006, 0.009),
                            (x, y, z + 0.0015), CHASSIS, bevel=0.0015,
                            seg=1, edge=0.1))
        for k in (-1, 1):
            parts.append(vk.blk("axlebox", (0.006, 0.009, 0.0105),
                                (x + s * 0.002, y + k * gap / 2, z),
                                CHASSIS, edge=1))
            parts.append(vk.cyl("spring", 0.0026, 0.007,
                                (x + s * 0.0005, y + k * gap * 0.22,
                                 z + 0.008), "Z", STEEL, verts=6))
        parts.append(vk.blk("equal", (0.004, gap * 0.8, 0.003),
                            (x, y, z - 0.006), CHASSIS, edge=0.04))
    parts.append(vk.blk("bolster", (0.118, 0.012, 0.007), (0, y, z + 0.009),
                        CHASSIS, edge=1))
    for k, dy in enumerate((gap / 2, -gap / 2)):
        wheels.append(vk.rail_wheelset("wheel_%s%d" % (tag, k + 1), r,
                                       (0, y + dy, z), centre=centre,
                                       segments=segments))
    return parts, wheels


def axles2(ys, r=0.013, centre=CHASSIS):
    """Wagon running gear without bogies: W-irons, axleboxes and leaf
    springs under the solebars, one wheelset per axle."""
    z = RAIL + r
    parts, wheels = [], []
    for k, y in enumerate(ys):
        for s in (1, -1):
            x = s * 0.0565
            parts.append(vk.blk("w-iron", (0.004, 0.018, 0.016),
                                (x, y, z + 0.004), CHASSIS, bevel=0.001))
            parts.append(vk.blk("axlebox", (0.007, 0.009, 0.009),
                                (x + s * 0.0018, y, z), CHASSIS,
                                bevel=0.0012))
            for j, ln in enumerate((0.034, 0.027, 0.02)):
                parts.append(vk.blk("leaf", (0.005, ln, 0.0014),
                                    (x + s * 0.0006, y,
                                     z + 0.0058 + j * 0.0015), STEEL,
                                    edge=0.04))
        wheels.append(vk.rail_wheelset("wheel_%d" % (k + 1), r, (0, y, z),
                                       centre=centre))
    return parts, wheels


def solebars(length, z=0.0705, x=0.062):
    return [vk.blk("solebar", (0.006, length, 0.012), (s * x, 0, z), CHASSIS,
                   bevel=0.001, seg=1, edge=0.08) for s in (1, -1)]


def coach():
    """A heritage passenger carriage: two-tone livery, a strip of framed
    windows, slam doors with droplights at both ends, a clerestory-less
    curved roof with torpedo vents, gangways and two bogies."""
    root = kit.empty("coach")
    L = 0.27
    yb = L / 2 - BUF
    hw, z0, z1 = 0.0715, 0.073, 0.150
    side = (0.088, 0.106, 0.133)
    pitch, mull = 0.028, 0.0045
    wins = [(-0.084 + k * pitch + mull / 2, -0.084 + (k + 1) * pitch -
             mull / 2) for k in range(6)]
    seams = [(0.0938, 0.0945), (0.1135, 0.1142)]
    droplight = (0.0975, 0.1102)
    ys = [y for a, b in wins for y in (a, b)]
    for a, b in seams + [droplight]:
        ys += [a, b, -a, -b]
    end = yb - 0.002
    keys = [(-end, dict(hw=hw, z0=z0, z1=z1, rb=0.003, rt=0.01,
                        tumble=-0.0025, crown=0.017)),
            (end, dict(hw=hw, z0=z0, z1=z1, rb=0.003, rt=0.01,
                       tumble=-0.0025, crown=0.017))]
    secs = vk.stations(keys, ys, front=0.005, rear=0.005, n=2,
                       ring_kw={"nc": 2, "nr": 3}, side_fn=lambda p: side)

    def cls(i, lab, c, n):
        if lab == "b":
            return 5
        if lab == "cap":
            return 1 if c.z < 0.088 else 0
        ay = abs(c.y)
        if lab.startswith("s") or lab == "bc":
            for a, b in seams:
                if a - 1e-5 <= ay <= b + 1e-5 and abs(n.x) > 0.5:
                    return 3
        if lab in ("bc", "s0"):
            return 1
        if lab == "s2":
            if any(a - 1e-5 <= c.y <= b + 1e-5 for a, b in wins):
                return 2
            if droplight[0] <= ay <= droplight[1]:
                return 2
            return 0
        if lab in ("s1", "s3"):
            return 0
        return 1

    body = vk.loft("coach-body", secs, [TEAM, TEAM2, GLASS, SEAL, ROOF,
                                        CHASSIS], cls)
    vk.inset(body, 2, 3, thick=0.0011, depth=0.0012)
    for s in (1, -1):
        for x in (-0.034, 0.034):
            vk.window(body, (x, s * end, 0.118), (0.018, 0.022),
                      "y" if s > 0 else "-y", round_=0.002)
    parts = [body]
    parts += solebars(2 * yb - 0.012)
    for s in (1, -1):
        parts += buffers(s * yb, s, beam=CHASSIS)
        parts.append(vk.blk("gangway", (0.046, 0.007, 0.07),
                            (0, s * (end + 0.0015), 0.111), SEAL,
                            bevel=0.002, seg=1, edge=0.1))
        for k in range(4):
            parts.append(vk.blk("bellows", (0.05, 0.0075, 0.0015),
                                (0, s * (end + 0.0015), 0.083 + k * 0.018),
                                CHASSIS, edge=1))
        for x in (-0.06, 0.06):
            parts.append(vk.blk("step", (0.006, 0.02, 0.0018),
                                (x, s * 0.104, 0.067), CHASSIS, edge=1))
            parts.append(vk.blk("handle", (0.0012, 0.0012, 0.012),
                                ((hw + 0.0006) * (1 if x > 0 else -1),
                                 s * 0.0918, 0.104), BRASS, edge=1))
    # Torpedo vents along the roof and a battery box underneath.
    for k in range(5):
        y = -0.072 + k * 0.036
        v = vk.spin("vent", [(0.0, -0.005, 0), (0.0032, -0.0042, 0),
                             (0.0038, 0.0, 0), (0.0032, 0.0042, 0),
                             (0.0, 0.005, 0)], [ROOF], (0, y, z1 + 0.0175),
                    segments=8, axis="Y")
        parts.append(v)
    parts.append(vk.blk("battery", (0.06, 0.03, 0.012), (0, 0.0, 0.062),
                        CHASSIS, edge=1))
    for s in (1, -1):
        parts.append(vk.blk("rain-strip", (0.0016, 2 * end - 0.02, 0.0014),
                            (s * 0.06, 0, z1 + 0.0062), SEAL, edge=0.1))
    for s in (1, -1):
        parts.append(vk.rod("truss", (s * 0.05, -0.06, 0.066),
                            (s * 0.05, 0.06, 0.066), 0.0012, CHASSIS, seg=6))
    wheels = []
    for tag, y in (("f", 0.085), ("r", -0.085)):
        p, w = bogie(tag, y)
        parts += p
        wheels += w
    return vk.finish(root, parts, wheels)


# ---------------------------------------------------------------- DMU

DMU_L = 0.34            # over the cab-end buffers and the inner-end buffers
DMU_HW = 0.0715         # body half-width, as the coach
DMU_Z0 = 0.058          # bottom of the body shell (the solebar line)
DMU_FLOOR = 0.066       # door sill and vestibule floor above the root
DMU_DOOR_Y = (0.10, -0.10)      # door 0 (cab side), door 1 (inner side)
DMU_DOOR_W = 0.022
DMU_DOOR_TOP = 0.142
DMU_BUFFER_Z = 0.0635
# Livery bands and the window band on the body sides and door leaves.
DMU_WAIST = (0.0975, 0.101)
DMU_WIN = (0.1025, 0.1325)
DMU_CANT = (0.1385, 0.141)      # up to the roof corner (z1 - rt)


def dmu_leaf(name, s, j, yc):
    """One slam-door leaf of the DMU: a panel in the livery with the cream
    lining, a framed droplight and a handle at its free edge. s = +1 for
    the +X side (door_r*), -1 for -X (door_l*); j = 0 hinges on its +Y
    edge, j = 1 on its -Y edge. The object origin sits on the hinge line
    (outer body face, nearer car end) at floor level."""
    w, t = DMU_DOOR_W, 0.0016
    z0, z1 = DMU_FLOOR, DMU_DOOR_TOP
    hw = DMU_HW
    dirn = 1 if j == 0 else -1
    yh = yc + dirn * w / 2
    gap = 0.00025
    ya, yb = sorted((yh - dirn * gap, yh - dirn * (w - gap)))
    ym = (ya + yb) / 2
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector((t, yb - ya, z1 - z0)), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((s * (hw - t / 2), ym,
                                        (z0 + z1) / 2)), verts=bm.verts)
    dl = (ym - 0.0068, ym + 0.0068)
    dz = (DMU_WIN[0] + 0.0015, DMU_WIN[1] - 0.001)

    def faces(both):
        fs = [f for f in bm.faces
              if (abs(f.normal.x) if both else f.normal.x * s) > 0.9]
        es = {e for f in fs for e in f.edges}
        vs = {v for f in fs for v in f.verts}
        return list(vs) + list(es) + fs

    # Cut the outer face into the lining bands, both faces round the
    # droplight (its glass shows inside when the door is open).
    for z in DMU_WAIST + DMU_CANT:
        bmesh.ops.bisect_plane(bm, geom=faces(False), plane_co=(0, 0, z),
                               plane_no=(0, 0, 1))
    for z in dz:
        bmesh.ops.bisect_plane(bm, geom=faces(True), plane_co=(0, 0, z),
                               plane_no=(0, 0, 1))
    for y in dl:
        bmesh.ops.bisect_plane(bm, geom=faces(True), plane_co=(0, y, 0),
                               plane_no=(0, 1, 0))
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        m = 0
        if n.x * s > 0.9:
            if DMU_WAIST[0] < c.z < DMU_WAIST[1] or \
                    DMU_CANT[0] < c.z < DMU_CANT[1]:
                m = 1
            elif dz[0] < c.z < dz[1] and dl[0] < c.y < dl[1]:
                m = 2
        elif n.x * s < -0.9:
            m = 4
            if dz[0] < c.z < dz[1] and dl[0] < c.y < dl[1]:
                m = 5
        f.material_index = m
    leaf = vk.mesh(name + "-leaf", bm, [TEAM, CREAM, GLASS, ALU, DOORIN,
                                        GLASS])
    vk.inset(leaf, 2, 3, thick=0.0009, depth=0.0006)
    yf = yh - dirn * (w - 0.0032)
    handle = vk.blk(name + "-handle", (0.0009, 0.0044, 0.0011),
                    (s * (hw + 0.00045), yf, 0.0945), CHROME, edge=1)
    out = kit.join([leaf, handle], name)
    kit.shade(out, 38)
    kit.set_pivot(out, (s * hw, yh, z0))
    return out


def dmu_car():
    """One driving car of a 1950s first-generation diesel multiple unit
    (after the Metro-Cammell and Derby lightweight sets): a full cab at
    +Y, a gangwayed inner end at -Y. The game couples two back to back.

    Cab: a three-pane windscreen with wrap-round corner windows under a
    domed roof end, a route indicator and marker lamps, a headlamp on a
    small yellow warning panel, the cream waist lining carried round the
    front as whiskers, twin horns on the dome. Body: livery (paint:team)
    with cream waist and cantrail lining, aluminium-framed windows, a grey
    roof with rain strips, torpedo vents and exhaust stacks up the inner
    end; black underframe with two engines, gearboxes, radiators, a fuel
    tank and battery box between two bogies.

    Passenger doors (slam doors, both sides) are separate leaves named
    door_l0, door_l1 (-X side) and door_r0, door_r1 (+X side): 0 is the
    door centred at y = +0.10 (cab half), 1 the door at y = -0.10. Each
    is 0.022 wide, from the floor (z = 0.066) to z = 0.142, its origin on
    the hinge line at the outer body face (x = +-0.0715), floor level:
    door_*0 hinges on its +Y edge (y = +0.111), door_*1 on its -Y edge
    (y = -0.111). Rotating about the leaf's local Z (Blender; local +Y in
    the glTF / three.js, where models face -Z) opens it outwards with:
      door_r0 positive, door_r1 negative,
      door_l0 negative, door_l1 positive.
    Behind each leaf is a dark vestibule (plain:void) 0.013 deep with its
    floor at z = 0.066, and a black footstep under it.
    """
    root = kit.empty("dmu_car")
    yb = DMU_L / 2 - BUF          # buffer beam faces
    end = yb - 0.002              # body ends
    HW, Z0, Z1 = DMU_HW, DMU_Z0, 0.150
    RB, RT, CROWN = 0.005, 0.009, 0.016
    side = DMU_WAIST + DMU_WIN + DMU_CANT[:1]
    RP = 0.014                    # plan radius of the cab corners
    RD = 0.035                    # length of the roof dome over the cab
    RR = 0.004                    # rounding of the inner end
    yr = end - RP
    yd = end - RD
    xr = HW - RT

    def roof_z(x, crown=CROWN):
        return Z1 + crown * (1 - min(1.0, (x / xr) ** 2))

    def dome(y):
        s_ = min(1.0, max(0.0, (y - yd) / RD))
        return CROWN - (CROWN - 0.003) * (1 - math.sqrt(max(0.0,
                                                             1 - s_ * s_)))

    def prof(y):
        hw, z0, z1 = HW, Z0, Z1
        if y > yr:
            sa = min(1.0, (y - yr) / RP)
            hw -= RP * (1 - math.sqrt(max(0.0, 1 - sa * sa)))
        if y < -end + RR:
            ca = 1 - (y + end) / RR
            d = RR * (1 - math.sqrt(max(0.0, 1 - ca * ca)))
            hw -= d
            z1 -= d
            z0 += d * 0.4
        return vk.ring(hw, z0, z1, rb=RB, rt=RT, crown=dome(y), side=side,
                       nb=1, nc=2, nr=3)

    seams = [(0.1205, 0.1213), (0.1397, 0.1405)]      # the cab door
    cabwin = (0.1238, 0.1372)
    wins = [(-0.0815, -0.0445), (-0.0395, -0.0025), (0.0025, 0.0395),
            (0.0445, 0.0815)]
    frost = (-0.1395, -0.1185)
    corner = yr + RP * math.sin(math.pi / 8)
    ys = {end, -end}
    for k in range(5):
        ys.add(yr + RP * math.sin(math.pi / 2 * k / 4))
    for f in (0.0, 0.35, 0.6, 0.8):
        ys.add(yd + RD * f)
    ys |= {-end + RR * (1 - math.cos(math.pi / 4)), -end + RR}
    for a, b in [cabwin, frost] + wins:
        ys |= {a, b}
    for yc in DMU_DOOR_Y:
        ys |= {yc - DMU_DOOR_W / 2, yc + DMU_DOOR_W / 2}
    ys = sorted(round(y, 6) for y in ys)
    secs = [(y, prof(y)) for y in ys]
    I_TEAM, I_TEAM2, I_GLASS, I_ALU, I_ROOF, I_CH, I_CREAM, I_FROST = \
        range(8)

    def inside(y, spans):
        return any(a - 1e-5 <= y <= b + 1e-5 for a, b in spans)

    def cls(i, lab, c, n):
        y = c.y
        if lab == "cap":
            return I_TEAM
        if lab in ("b", "bc"):
            return I_CH
        if lab == "s1":
            return I_CREAM
        if lab == "s5":
            return I_CREAM if y < yr + 0.001 else I_TEAM
        if lab == "s3":
            if inside(y, wins) or inside(y, [cabwin]):
                return I_GLASS
            if inside(y, [frost]):
                return I_FROST
            if y > corner:
                return I_GLASS
            return I_TEAM
        if lab.startswith("tc") or lab == "r":
            return I_ROOF
        return I_TEAM

    vents_ = []
    body = vk.loft("dmu-body", secs, [TEAM, TEAM2, GLASS, ALU, ROOF,
                                      CHASSIS, CREAM, FROST], cls)
    vk.inset(body, I_GLASS, I_ALU, thick=0.0011, depth=0.0012)
    vk.inset(body, I_FROST, I_ALU, thick=0.0011, depth=0.0008)
    # The windscreen: two big panes and a narrow centre one.
    zc = (DMU_WIN[0] + DMU_WIN[1]) / 2
    wh = DMU_WIN[1] - DMU_WIN[0]
    for x, w in ((-0.0302, 0.041), (0.0, 0.0135), (0.0302, 0.041)):
        vk.window(body, (x, end, zc), (w, wh), "y", depth=0.0014,
                  round_=0.0022, frame=ALU, glass=GLASS)
    # Sliding ventilators along the top of the saloon windows.
    for s in (1, -1):
        for a, b in wins:
            parts_v = vk.blk("ventilator", (0.0008, b - a - 0.002, 0.0012),
                             (s * (HW - 0.0008), (a + b) / 2,
                              DMU_WIN[1] - 0.0072), ALU, edge=1)
            vents_.append(parts_v)
    # Vestibules behind the four passenger doors.
    for s in (1, -1):
        for yc in DMU_DOOR_Y:
            c = vk.blk("vestibule", (0.026, DMU_DOOR_W,
                                     DMU_DOOR_TOP - DMU_FLOOR),
                       (s * HW, yc, (DMU_FLOOR + DMU_DOOR_TOP) / 2), VOID,
                       edge=1)
            vk.cut(body, c, VOID)
    parts = [body] + vents_

    # Cab front: warning panel, whiskers, lamps, route indicator, wipers.
    fy = end
    parts.append(vk.blk("warning", (0.064, 0.0008, 0.0215),
                        (0, fy + 0.0004, 0.0838), YELLOW, edge=1))
    parts.append(vk.blk("whiskers", (2 * (HW - RP) - 0.0004, 0.0008,
                                     DMU_WAIST[1] - DMU_WAIST[0]),
                        (0, fy + 0.0004, sum(DMU_WAIST) / 2), CREAM,
                        edge=1))
    parts.append(vk.cyl("hl-rim", 0.0042, 0.002, (0, fy + 0.001, 0.0838),
                        "Y", CHROME, verts=12))
    parts.append(vk.cyl("hl-lens", 0.0032, 0.0012, (0, fy + 0.0022,
                                                     0.0838), "Y", LAMP,
                        verts=12))
    for x, z in ((-0.046, 0.0838), (0.046, 0.0838), (-0.034, 0.1405),
                 (0.034, 0.1405)):
        parts.append(vk.cyl("marker-rim", 0.0033, 0.002, (x, fy + 0.001, z),
                            "Y", SEAL, verts=8))
        parts.append(vk.cyl("marker-lens", 0.0024, 0.0012,
                            (x, fy + 0.0022, z), "Y", LAMP, verts=8))
    parts.append(vk.blk("route", (0.024, 0.002, 0.0088),
                        (0, fy + 0.001, 0.1405), SEAL, bevel=0.0005))
    parts.append(vk.blk("route-blind", (0.0196, 0.0006, 0.0054),
                        (0, fy + 0.0021, 0.1405), PLATE, edge=1))
    for x in (-0.0045, 0.0045):
        parts.append(vk.blk("route-digit", (0.0028, 0.0004, 0.0036),
                            (x, fy + 0.0025, 0.1405), SEAL, edge=1))
    for x in (-0.0302, 0.0302):
        parts.append(vk.rod("wiper", (x - 0.0125, fy + 0.0012,
                                      DMU_WIN[0] + 0.0015),
                            (x + 0.003, fy + 0.0012, DMU_WIN[1] - 0.0045),
                            0.0005, SEAL, seg=4))
    for x in (-0.011, 0.011):
        y = 0.1455
        z = roof_z(abs(x), dome(y)) + 0.0028
        parts.append(vk.cyl("horn", 0.0009, 0.008, (x, y, z - 0.0006), "Y",
                            SEAL, verts=8, r2=0.0021))
        parts.append(vk.blk("horn-foot", (0.0026, 0.004, 0.0024),
                            (x, y - 0.002, z - 0.0022), SEAL, edge=1))
    # Cab doors: handles, grab rails and a stirrup step on both sides.
    for s in (1, -1):
        parts.append(vk.blk("cab-handle", (0.0009, 0.0042, 0.0011),
                            (s * (HW + 0.00045), 0.1235, 0.0945), CHROME,
                            edge=1))
        parts.append(vk.blk("grab", (0.0012, 0.0012, 0.04),
                            (s * (HW + 0.0006), 0.1428, 0.098), CHROME,
                            edge=1))
        parts.append(vk.blk("cab-step", (0.008, 0.012, 0.0016),
                            (s * (HW - 0.004), 0.1305, 0.0515), CHASSIS,
                            edge=1))
        for a, b in seams:
            parts.append(vk.blk("seam", (0.0004, b - a, DMU_CANT[1] - 0.064),
                                (s * (HW + 0.0001), (a + b) / 2,
                                 (DMU_CANT[1] + 0.064) / 2), TEAM2, edge=1))
    # Passenger doors: a footstep under each and a grab rail beside it.
    doors = []
    for s, sl in ((-1, "l"), (1, "r")):
        for j, yc in enumerate(DMU_DOOR_Y):
            dirn = 1 if j == 0 else -1
            doors.append(dmu_leaf("door_%s%d" % (sl, j), s, j, yc))
            parts.append(vk.blk("footstep", (0.0105, DMU_DOOR_W + 0.002,
                                             0.0018),
                                (s * (HW + 0.0012 - 0.00525), yc, 0.0574),
                                CHASSIS, edge=1))
            parts.append(vk.blk("grab", (0.0012, 0.0012, 0.032),
                                (s * (HW + 0.0006),
                                 yc - dirn * (DMU_DOOR_W / 2 + 0.0035),
                                 0.1), CHROME, edge=1))

    # Roof: rain strips, torpedo vents.
    for s in (1, -1):
        x = 0.058
        parts.append(vk.blk("rain-strip", (0.0014, end + yr - 0.03, 0.0012),
                            (s * x, (-end + yr - 0.03) / 2 + 0.0,
                             roof_z(x) + 0.0004), SEAL, edge=0.1))
    for y in (-0.118, -0.073, -0.028, 0.017, 0.062, 0.105):
        parts.append(vk.spin("vent", [(0.0, -0.005, 0), (0.0032, -0.0042, 0),
                                      (0.0038, 0.0, 0), (0.0032, 0.0042, 0),
                                      (0.0, 0.005, 0)], [ROOF],
                             (0, y, roof_z(0) + 0.0008), segments=6,
                             axis="Y"))
    # Inner end: gangway with bellows, exhaust stacks up the corners.
    gy = -(end + 0.00475)
    parts.append(vk.blk("gangway", (0.044, 0.0095, 0.072), (0, gy, 0.104),
                        SEAL, bevel=0.0015, seg=1, edge=0.1))
    for k in range(4):
        parts.append(vk.blk("bellows", (0.048, 0.0098, 0.0014),
                            (0, gy, 0.08 + k * 0.016), CHASSIS, edge=1))
    for s in (1, -1):
        x = s * 0.047
        ytop = -end - 0.0028
        parts.append(vk.cyl("exhaust", 0.003, 0.094, (x, ytop - 0.0006,
                                                       0.121),
                            "Z", CHASSIS, verts=8, cap=False))
        parts.append(vk.cyl("exhaust-cowl", 0.0034, 0.006,
                            (x, ytop - 0.0006, 0.1705), "Z", CHASSIS,
                            verts=8, r2=0.0042))
    # Buffer beams, couplings and brake hoses at both ends.
    for s in (1, -1):
        bp = buffers(s * yb, s, z=DMU_BUFFER_Z, beam=CHASSIS)
        for o in [o for o in bp if o.name.startswith(("link", "buf-head"))]:
            if o.name.startswith("buf-head"):
                bp.append(vk.cyl("buf-head", 0.0072, 0.0022,
                                 o.location.copy(), "Y", CHROME, verts=10))
            bp.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
        bp.append(vk.rod("link", (0, s * (yb + 0.0066), DMU_BUFFER_Z - 0.002),
                         (0, s * (yb + 0.0078), DMU_BUFFER_Z - 0.0075),
                         0.001, CHASSIS, seg=6))
        parts += bp
        for x in (-0.024, 0.024):
            parts.append(vk.rod("hose", (x, s * (yb - 0.001),
                                         DMU_BUFFER_Z - 0.004),
                                (x * 1.15, s * (yb + 0.004),
                                 DMU_BUFFER_Z - 0.0145), 0.0011, CHASSIS,
                                seg=4))
    # Underframe: an engine and gearbox under each half, radiators, the
    # fuel tank and the battery box between them, exhaust silencers.
    for k in (1, -1):
        ex = -0.018 * k
        ey = 0.037 * k
        parts.append(vk.blk("engine", (0.05, 0.034, 0.012),
                            (ex, ey, 0.0505), ENGINE, edge=1))
        parts.append(vk.blk("head", (0.044, 0.022, 0.004),
                            (ex, ey, 0.0575), ENGINE, edge=1))
        parts.append(vk.blk("injectors", (0.0012, 0.03, 0.0016),
                            (ex - 0.0252 * k, ey, 0.0545), STEEL, edge=1))
        parts.append(vk.blk("gearbox", (0.022, 0.014, 0.011),
                            (-ex * 0.4, ey + 0.023 * k, 0.051), CHASSIS,
                            edge=1))
        rx = 0.054 * k
        parts.append(vk.blk("radiator", (0.012, 0.03, 0.013),
                            (rx, -ey, 0.0505), SEAL, edge=1))
        for r_ in range(2):
            parts.append(vk.blk("louvre", (0.0008, 0.027, 0.0016),
                                (rx + k * 0.0062, -ey,
                                 0.0478 + r_ * 0.0042), STEEL, edge=1))
        parts.append(vk.cyl("silencer", 0.0042, 0.03,
                            (-0.052 * k, ey, 0.0485), "Y", CHASSIS,
                            verts=8))
    parts.append(vk.blk("fuel-tank", (0.038, 0.026, 0.0125),
                        (0.036, 0.0, 0.0505), CHASSIS, bevel=0.003, seg=1))
    parts.append(vk.blk("battery", (0.03, 0.022, 0.011), (-0.042, 0.0,
                                                           0.0515),
                        CHASSIS, edge=1))
    parts.append(vk.blk("battery-lid", (0.031, 0.0006, 0.0115),
                        (-0.042, 0.0, 0.0515), STEEL, edge=1))
    wheels = []
    for tag, y in (("f", 0.098), ("r", -0.098)):
        p, w = bogie(tag, y, segments=10)
        for o in [o for o in p if o.name.startswith("spring")]:
            p.remove(o)
            p.append(vk.blk("spring", (0.0048, 0.0048, 0.007),
                            o.location.copy(), STEEL, edge=1))
            bpy.data.objects.remove(o, do_unlink=True)
        parts += p
        wheels += w
    return vk.finish(root, parts, wheels, doors)


def loco_diesel():
    """A heritage mainline diesel: cabs at both ends with raked
    windscreens and yellow warning ends, louvred engine-room grilles, roof
    fans, a fuel tank and two bogies."""
    root = kit.empty("loco_diesel")
    L = 0.30
    yb = L / 2 - BUF
    end = yb - 0.002
    hw, z0, z1 = 0.072, 0.077, 0.158
    side = (0.09, 0.118, 0.142)
    base = dict(hw=hw, z0=z0, z1=z1, rb=0.003, rt=0.012, tumble=0.001,
                crown=0.012)
    nose = dict(base, z1=0.13)
    keys = [(-end, nose), (-end + 0.022, base), (end - 0.022, base),
            (end, nose)]
    cabwin = (0.1015, 0.1155)
    seams = [(0.0985, 0.0992), (0.1178, 0.1185)]
    ys = []
    for a, b in seams + [cabwin]:
        ys += [a, b, -a, -b]
    ys += [end - 0.008, -end + 0.008]
    secs = vk.stations(keys, ys, front=0.006, rear=0.006, n=2,
                       ring_kw={"nc": 2, "nr": 3}, side_fn=lambda p: side)
    slope = end - 0.022

    def cls(i, lab, c, n):
        ay = abs(c.y)
        if lab == "b":
            return 5
        if lab == "cap":
            return 6
        if lab.startswith("s") or lab == "bc":
            for a, b in seams:
                if a - 1e-5 <= ay <= b + 1e-5 and abs(n.x) > 0.5:
                    return 3
        if ay > slope + 1e-5 and ay < end - 0.008 + 1e-5 and \
                lab in ("tc1", "tc2", "r"):
            return 2
        if ay > end - 0.008 + 1e-5:
            return 6
        if lab == "s2" and cabwin[0] - 1e-5 <= ay <= cabwin[1] + 1e-5:
            return 2
        if lab in ("bc", "s0"):
            return 1
        if lab in ("tc1", "tc2", "r"):
            return 4
        return 0

    body = vk.loft("diesel-body", secs, [TEAM, TEAM2, GLASS, SEAL, ROOF,
                                         CHASSIS, YELLOW], cls)
    vk.inset(body, 2, 3, thick=0.0011, depth=0.0012)
    # Louvred engine-room grilles along both sides.
    for s in (1, -1):
        for y in (-0.05, 0.0, 0.05):
            vk.window(body, (s * hw, y, 0.13), (0.036, 0.017),
                      "x" if s > 0 else "-x", glass=SEAL, round_=0.001)
    parts = [body]
    for s in (1, -1):
        for y in (-0.05, 0.0, 0.05):
            for k in range(3):
                parts.append(vk.blk("louvre", (0.0012, 0.035, 0.0013),
                                    (s * (hw - 0.0009), y,
                                     0.1243 + k * 0.0057), TEAM2, edge=1))
    parts += solebars(2 * yb - 0.012, z=0.072, x=0.064)
    for s in (1, -1):
        parts += buffers(s * yb, s, beam=CHASSIS)
        parts.append(vk.blk("plough", (0.1, 0.004, 0.012),
                            (0, s * (yb - 0.001), 0.064), CHASSIS, edge=1,
                            rot=(s * 0.35, 0, 0)))
        # Headlights, marker lights and a headcode box on the cab ends.
        for x in (-0.042, 0.042):
            parts.append(vk.cyl("hl-rim", 0.0045, 0.002,
                                (x, s * (end + 0.0006), 0.1), "Y", CHROME,
                                verts=10))
            parts.append(vk.cyl("hl-lens", 0.0035, 0.0012,
                                (x, s * (end + 0.0014), 0.1), "Y",
                                LAMP if s > 0 else TAIL, verts=10))
        parts.append(vk.blk("headcode", (0.028, 0.002, 0.008),
                            (0, s * (end + 0.0004), 0.118), SEAL,
                            bevel=0.0006))
        parts.append(vk.blk("headcode-lens", (0.024, 0.0008, 0.005),
                            (0, s * (end + 0.0014), 0.118), LAMP, edge=1))
        for x in (-1, 1):
            parts.append(vk.blk("grab", (0.0012, 0.0012, 0.02),
                                (x * (hw + 0.0008), s * 0.096, 0.1), CHROME,
                                edge=1))
            parts.append(vk.blk("horn", (0.003, 0.008, 0.003),
                                (x * 0.012, s * (end - 0.026), z1 + 0.0125),
                                CHROME, edge=1))
    # Roof fans and an exhaust.
    for y in (-0.045, 0.045):
        parts.append(vk.cyl("fan", 0.0135, 0.004, (0, y, z1 + 0.0125), "Z",
                            SEAL, verts=16))
        parts.append(vk.cyl("fan-rim", 0.0145, 0.002, (0, y, z1 + 0.0115),
                            "Z", ROOF, verts=16, cap=False))
        for k in range(3):
            parts.append(vk.blk("fan-bar", (0.027, 0.0012, 0.0012),
                                (0, y, z1 + 0.0148), CHROME, edge=1,
                                rot=(0, 0, k * PI / 3)))
    parts.append(vk.blk("exhaust", (0.012, 0.006, 0.004), (0, 0.0, z1 + 0.013),
                        CHASSIS, bevel=0.001))
    parts.append(vk.blk("tank", (0.09, 0.07, 0.018), (0, 0, 0.061), CHASSIS,
                        bevel=0.004))
    parts.append(vk.blk("tank-band", (0.092, 0.003, 0.019), (0, 0.02, 0.061),
                        STEEL, edge=1))
    wheels = []
    for tag, y in (("f", 0.088), ("r", -0.088)):
        p, w = bogie(tag, y, r=0.013, gap=0.044, segments=12)
        parts += p
        wheels += w
    return vk.finish(root, parts, wheels)


def loco_steam():
    """A little 2-6-2 tank engine: boiler with brass bands and dome,
    black smokebox and chimney with a copper cap, side tanks and cab in
    the livery, a coal bunker, red buffer beams, outside cylinders,
    coupling rods, lamps and three pairs of spoked driving wheels."""
    root = kit.empty("loco_steam")
    L = 0.30
    yb = L / 2 - BUF
    parts = []
    rd, rp = 0.022, 0.012
    drivers = (0.05, -0.002, -0.054)
    zd = RAIL + rd
    crank = 0.0105
    # Frames, footplate and valances.
    for s in (1, -1):
        parts.append(vk.blk("frame", (0.006, 2 * yb - 0.006, 0.03),
                            (s * 0.032, 0, 0.07), CHASSIS, edge=0.04))
        parts.append(vk.blk("valance", (0.0022, 2 * yb - 0.004, 0.0065),
                            (s * 0.0755, 0, 0.087), BEAM, edge=0.05))
    parts.append(vk.blk("footplate", (0.152, 2 * yb - 0.004, 0.005),
                        (0, 0, 0.0885), CHASSIS, bevel=0.001, seg=1,
                        edge=0.1))
    for s in (1, -1):
        parts += buffers(s * yb, s, beam=BEAM, lamp=False)
    # Boiler with bands, the smokebox, door and chimney.
    zb, rb = 0.135, 0.044
    parts.append(vk.cyl("boiler", rb, 0.158, (0, 0.02, zb), "Y", TEAM,
                        verts=24, rings=4, cap=False))
    for y in (-0.03, 0.03, 0.097):
        parts.append(vk.cyl("band", rb + 0.0007, 0.0022, (0, y, zb), "Y",
                            BRASS, verts=24, cap=False))
    parts.append(vk.cyl("smokebox", rb + 0.0025, 0.04, (0, 0.118, zb), "Y",
                        CHASSIS, verts=24, cap=False))
    parts.append(vk.spin("door", [(0.0, 0.0055, 0), (0.016, 0.005, 0),
                                  (0.032, 0.003, 0), (0.0405, 0.0, 0),
                                  (0.0405, -0.002, 0)], [CHASSIS],
                         (0, 0.138, zb), segments=18, axis="Y"))
    parts.append(vk.blk("door-plate", (0.014, 0.0012, 0.006),
                        (0, 0.1438, zb + 0.022), BRASS, edge=1))
    parts.append(vk.blk("dart", (0.022, 0.0016, 0.0016), (0, 0.1445, zb),
                        CHROME, edge=1))
    parts.append(vk.blk("saddle", (0.05, 0.03, 0.04), (0, 0.118, 0.106),
                        CHASSIS, edge=1))
    chim = vk.spin("chimney", [(0.0, -0.0, 0), (0.019, 0.0, 0),
                               (0.0118, 0.013, 0),
                               (0.0118, 0.035, 0), (0.0148, 0.039, 1),
                               (0.0148, 0.044, 1), (0.0108, 0.044, 1),
                               (0.0108, 0.032, 0), (0.0, 0.032, 0)],
                   [CHASSIS, "metal:copper"], (0, 0.118, 0.172),
                   segments=12, axis="Z")
    parts.append(chim)
    parts.append(vk.spin("dome", [(0.0, 0.0, 0), (0.0175, 0.0, 0),
                                  (0.0165, 0.012, 0), (0.0145, 0.02, 0),
                                  (0.009, 0.0255, 0), (0.0, 0.027, 0)],
                         [BRASS], (0, 0.04, 0.172), segments=14, axis="Z"))
    parts += lamp_at((0, 0.141, 0.181), 1)
    parts += lamp_at((0.03, -yb + 0.004, 0.1635), -1)
    # Side tanks with lined panels, sandboxes, filler caps.
    for s in (1, -1):
        x = s * 0.0605
        parts.append(vk.blk("tank", (0.029, 0.118, 0.058), (x, 0.0, 0.12),
                            TEAM, bevel=0.002, seg=1))
        parts.append(vk.blk("lining", (0.0008, 0.104, 0.044),
                            (s * 0.0752, 0.0, 0.12), TEAM2, edge=0.04))
        parts.append(vk.blk("panel", (0.0012, 0.1, 0.04),
                            (s * 0.0754, 0.0, 0.12), TEAM, edge=0.04))
        parts.append(vk.cyl("filler", 0.0055, 0.003, (x, 0.04, 0.1505), "Z",
                            BRASS, verts=8))
        parts.append(vk.blk("sandbox", (0.014, 0.014, 0.012),
                            (s * 0.056, 0.077, 0.097), TEAM, edge=1))
        parts.append(vk.rod("handrail", (s * 0.038, -0.054, 0.162),
                            (s * 0.038, 0.094, 0.162), 0.0011, CHROME, seg=6))
        parts.append(vk.rod("steampipe", (s * 0.035, 0.112, 0.112),
                            (s * 0.06, 0.1, 0.083), 0.004, CHASSIS, seg=8))
    # Outside cylinders with slide bars.
    for s in (1, -1):
        x = s * 0.063
        parts.append(vk.cyl("cylinder", 0.0125, 0.034, (x, 0.098, 0.072),
                            "Y", TEAM2, verts=14))
        parts.append(vk.cyl("cyl-cover", 0.0132, 0.0024, (x, 0.116, 0.072),
                            "Y", CHROME, verts=12))
        parts.append(vk.cyl("cyl-band", 0.0131, 0.0024, (x, 0.08, 0.072),
                            "Y", CHROME, verts=12, cap=False))
        parts.append(vk.blk("slidebar", (0.002, 0.03, 0.0022),
                            (x - s * 0.003, 0.066, 0.0755), CHROME, edge=1))
        parts.append(vk.blk("crosshead", (0.004, 0.006, 0.007),
                            (x - s * 0.003, 0.058, 0.073), STEEL, edge=1))
    # Cab with windows, a curved roof, whistle; bunker with coal.
    cy0, cy1 = -0.112, -0.058
    cab = vk.blk("cab", (0.15, cy1 - cy0, 0.112), (0, (cy0 + cy1) / 2,
                                                  0.147), TEAM,
                 bevel=0.0018, seg=1, edge=0.04)
    kit.apply(cab)
    for s in (1, -1):
        vk.window(cab, (s * 0.075, -0.083, 0.17), (0.03, 0.026),
                  "x" if s > 0 else "-x", round_=0.003)
        vk.window(cab, (s * 0.048, cy1, 0.181), (0.017, 0.017), "y",
                  round_=0.007)
        vk.window(cab, (s * 0.036, cy0, 0.181), (0.022, 0.017), "-y",
                  round_=0.003)
    parts.append(cab)
    for s in (1, -1):
        parts.append(vk.blk("cab-grab", (0.0012, 0.0012, 0.03),
                            (s * 0.0762, cy1 - 0.004, 0.13), CHROME, edge=1))
    roof = vk.loft("cab-roof", [(y, vk.ring(0.0775, 0.2015, 0.2045,
                                            rb=0.0008, rt=0.0012,
                                            crown=0.011, nb=1, nc=1, nr=6))
                                for y in (cy0 - 0.0025, cy1 + 0.003)],
                   [TEAM2])
    parts.append(roof)
    parts.append(vk.spin("whistle", [(0.0, 0.0, 0), (0.0025, 0.0, 0),
                                     (0.0025, 0.01, 0), (0.0042, 0.012, 0),
                                     (0.0042, 0.02, 0), (0.0, 0.021, 0)],
                         [BRASS], (0.0, cy1 + 0.002, 0.176), segments=6,
                         axis="Z"))
    by0 = -yb + 0.001
    bunker = vk.blk("bunker", (0.13, cy0 - by0, 0.066), (0, (by0 + cy0) / 2,
                                                         0.124), TEAM,
                    bevel=0.0018, seg=1)
    parts.append(bunker)
    parts.append(vk.blk("bunker-lining", (0.11, 0.0008, 0.048),
                        (0, by0 - 0.0003, 0.123), TEAM2, edge=1))
    parts.append(vk.blk("bunker-panel", (0.104, 0.0008, 0.042),
                        (0, by0 - 0.0006, 0.123), TEAM, edge=1))
    coal = vk.ball("coal", 0.03, (0, (by0 + cy0) / 2 + 0.002, 0.155),
                   "rock:coal", scale=(1.9, 0.42, 0.3), seg=8, rings=5)
    kit.jitter(coal, 0.0012, seed=4)
    parts.append(coal)
    # Coupling rods (separate, so the game can swing them with the
    # wheels: offset (0, -sin a, cos a) * crank about their rest pose).
    rods = []
    for s, side_ in ((-1, "l"), (1, "r")):
        x = s * 0.0535
        bar = [vk.blk("rod", (0.0024, drivers[0] - drivers[2] + 0.004,
                              0.0042), (x, (drivers[0] + drivers[2]) / 2,
                                        zd + crank), STEEL, edge=1)]
        for y in drivers:
            bar.append(vk.cyl("boss", 0.0036, 0.0028, (x, y, zd + crank),
                              "X", STEEL, verts=8))
        rod = kit.join(bar, "rod_" + side_)
        kit.shade(rod, 40)
        kit.set_pivot(rod, (x, (drivers[0] + drivers[2]) / 2, zd + crank))
        rod["crank"] = crank
        rods.append(rod)
    wheels = [vk.rail_wheelset("wheel_lead", rp, (0, 0.108, RAIL + rp),
                               centre=TEAM2, segments=10),
              vk.rail_wheelset("wheel_trail", rp, (0, -0.108, RAIL + rp),
                               centre=TEAM2, segments=10)]
    for k, y in enumerate(drivers):
        wheels.append(vk.rail_wheelset("wheel_d%d" % (k + 1), rd,
                                       (0, y, zd), spokes=7, centre=TEAM2,
                                       crank=crank, segments=12))
    return vk.finish(root, parts, wheels, rods)


def wagon_box():
    """A covered goods van: planked body in the livery with dark external
    framing and diagonal braces, a sliding door, a curved roof, two axles
    on leaf springs."""
    root = kit.empty("wagon_box")
    L = 0.25
    yb = L / 2 - BUF
    end = yb - 0.002
    hw, z0, z1 = 0.0705, 0.077, 0.153
    keys = [(-end, dict(hw=hw, z0=z0, z1=z1, rb=0.002, rt=0.006, tumble=0.0,
                        crown=0.014)),
            (end, dict(hw=hw, z0=z0, z1=z1, rb=0.002, rt=0.006, tumble=0.0,
                       crown=0.014))]
    secs = vk.stations(keys, [], front=0.003, rear=0.003, n=2,
                       ring_kw={"nc": 2, "nr": 4}, side_fn=lambda p: ())

    def cls(i, lab, c, n):
        if lab == "b":
            return 2
        if lab in ("tc1", "r"):
            return 3
        return 0

    body = vk.loft("van-body", secs, [TEAM, TEAM2, CHASSIS, ROOF], cls)
    parts = [body]
    # Roof ribs across the curved roof, and a rain strip each side.
    for k in range(7):
        y = -end + 0.012 + k * (2 * end - 0.024) / 6
        arc = [(x, y, z1 + 0.014 * (1 - (x / 0.064) ** 2) + 0.0006)
               for x in [-0.066 + 0.132 * j / 8 for j in range(9)]]
        parts.append(vk.tube("roof-rib", arc, 0.0011, ROOF, seg=5))
    for s in (1, -1):
        parts.append(vk.blk("rain-strip", (0.0016, 2 * end - 0.01, 0.0014),
                            (s * 0.063, 0, z1 + 0.0025), TEAM2, edge=0.1))
    # Plank lines: faint grooves of seal colour along the sides.
    for s in (1, -1):
        for k in range(1, 6):
            parts.append(vk.blk("plank", (0.0005, 2 * end - 0.006, 0.0007),
                                (s * (hw + 0.0001), 0, z0 + 0.003 + k * 0.012),
                                TEAM2, edge=0.05))
        for y in (-0.1, -0.06, 0.06, 0.1):
            parts.append(vk.blk("stanchion", (0.003, 0.0045, 0.074),
                                (s * (hw + 0.0012), y, 0.115), TEAM2,
                                edge=0.04))
        for y0, y1 in ((-0.1, -0.06), (0.06, 0.1)):
            parts.append(vk.rod("brace", (s * (hw + 0.0011), y0, 0.08),
                                (s * (hw + 0.0011), y1, 0.149), 0.0016,
                                TEAM2, seg=6))
        parts.append(vk.blk("door", (0.002, 0.052, 0.068),
                            (s * (hw + 0.0012), 0, 0.114), TEAM2,
                            bevel=0.0008))
        for z in (0.108, 0.121):
            parts.append(vk.blk("door-bar", (0.0012, 0.05, 0.0018),
                                (s * (hw + 0.0024), 0, z), TEAM, edge=1))
        for z in (0.148, 0.0795):
            parts.append(vk.blk("door-rail", (0.003, 0.064, 0.0022),
                                (s * (hw + 0.0015), 0.0, z), CHASSIS,
                                edge=0.1))
        parts.append(vk.blk("handle", (0.0016, 0.0014, 0.008),
                            (s * (hw + 0.0028), 0.02, 0.114), STEEL, edge=1))
        parts.append(vk.blk("end-rib", (0.11, 0.003, 0.004),
                            (0, s * (end + 0.0012), 0.115), TEAM2, edge=0.04))
        for x in (-0.035, 0.035):
            parts.append(vk.blk("end-post", (0.004, 0.003, 0.074),
                                (x, s * (end + 0.0012), 0.115), TEAM2,
                                edge=0.04))
        parts.append(vk.blk("vent", (0.03, 0.002, 0.008),
                            (0, s * (end + 0.0012), 0.145), SEAL,
                            bevel=0.0006))
    parts.append(vk.blk("floor", (0.13, 2 * yb - 0.01, 0.006),
                        (0, 0, 0.0745), CHASSIS, edge=0.05))
    parts += solebars(2 * yb - 0.012)
    for s in (1, -1):
        parts += buffers(s * yb, s, beam=CHASSIS)
    p, wheels = axles2((0.065, -0.065))
    parts += p
    parts.append(vk.blk("brake", (0.05, 0.004, 0.004), (0, 0.0, 0.058),
                        CHASSIS, edge=1))
    return vk.finish(root, parts, wheels)


def wagon_tank():
    """A tank wagon: a domed-end barrel in the livery with dark bands, a
    dome and hatch, walkway with handrails, a side ladder, saddles."""
    root = kit.empty("wagon_tank")
    L = 0.25
    yb = L / 2 - BUF
    zc, rt_ = 0.133, 0.052
    half = 0.102
    prof = [(0.0, -half, 0), (0.026, -half + 0.0015, 0),
            (0.042, -half + 0.0055, 0), (0.05, -half + 0.011, 0),
            (rt_, -half + 0.018, 0), (rt_, half - 0.018, 0),
            (0.05, half - 0.011, 0), (0.042, half - 0.0055, 0),
            (0.026, half - 0.0015, 0), (0.0, half, 0)]
    # Extra rings along the barrel so AO can shade under the walkway.
    full = prof[:5]
    for k in range(1, 6):
        full.append((rt_, -half + 0.018 + (2 * half - 0.036) * k / 6, 0))
    full += prof[5:]
    tank = vk.spin("tank", full, [TEAM], (0, 0, zc), segments=28, axis="Y")
    parts = [tank]
    for y in (-0.062, 0.0, 0.062):
        parts.append(vk.cyl("band", rt_ + 0.0008, 0.003, (0, y, zc), "Y",
                            TEAM2, verts=28))
    parts.append(vk.cyl("dome", 0.016, 0.014, (0, 0.0, zc + rt_ + 0.003), "Z",
                        TEAM2, verts=18, bevel=0.0012))
    parts.append(vk.cyl("hatch", 0.011, 0.003, (0, 0.0, zc + rt_ + 0.0115),
                        "Z", BRASS, verts=16))
    for s in (1, -1):
        rail = [(s * 0.024, -0.03, zc + rt_ + 0.01),
                (s * 0.024, 0.03, zc + rt_ + 0.01)]
        parts.append(vk.rod("handrail", rail[0], rail[1], 0.0009, CHASSIS,
                            seg=6))
        for y in (-0.03, 0.03):
            parts.append(vk.rod("post", (s * 0.022, y, zc + rt_ - 0.004),
                                (s * 0.024, y, zc + rt_ + 0.01), 0.0008,
                                CHASSIS, seg=5))
        # Running boards along the solebars.
        parts.append(vk.blk("board", (0.007, 2 * yb - 0.03, 0.0016),
                            (s * 0.064, 0, 0.0775), "wood:planks", edge=0.1))
    # Ladder up one side.
    for y in (0.03, 0.044):
        parts.append(vk.rod("ladder", (0.062, y, 0.081), (0.054, y, 0.16),
                            0.0011, CHASSIS, seg=6))
    for k in range(6):
        t = (k + 0.5) / 6
        parts.append(vk.rod("rung", (0.062 - 0.008 * t, 0.03,
                                     0.081 + 0.079 * t),
                            (0.062 - 0.008 * t, 0.044, 0.081 + 0.079 * t),
                            0.0008, CHASSIS, seg=6))
    for y in (-0.07, 0.07):
        parts.append(vk.blk("saddle", (0.09, 0.012, 0.014), (0, y, 0.084),
                            CHASSIS, bevel=0.0015))
        for s in (1, -1):
            parts.append(vk.rod("strap", (s * 0.044, y, 0.082),
                                (s * 0.044, y, 0.11), 0.0012, CHASSIS,
                                seg=6))
    parts.append(vk.cyl("outlet", 0.004, 0.012, (0, 0.0, 0.08), "Z", CHASSIS,
                        verts=10))
    parts.append(vk.cyl("valve-wheel", 0.0055, 0.0015, (0, 0.0, 0.0735),
                        "Z", BEAM, verts=12))
    for y in (-0.07, 0.0, 0.07):
        parts.append(vk.blk("crossbeam", (0.12, 0.006, 0.005),
                            (0, y * 1.4, 0.0745), CHASSIS, edge=1))
    parts += solebars(2 * yb - 0.012)
    for s in (1, -1):
        parts += buffers(s * yb, s, beam=CHASSIS)
    p, wheels = axles2((0.065, -0.065))
    parts += p
    return vk.finish(root, parts, wheels)


def log(name, r, length, at, seed):
    """A sawn log: bark sides, pale end grain with a darker heart."""
    h = length / 2
    prof = [(0.0, -h, 1), (r * 0.86, -h, 0), (r, -h + 0.0025, 0),
            (r, h - 0.0025, 0), (r * 0.86, h, 1), (0.0, h, 1)]
    obj = vk.spin(name, prof, [LOG, LOGEND], at, segments=12, axis="Y")
    kit.jitter(obj, r * 0.04, seed=seed)
    return obj


def wagon_logs():
    """A bogie timber wagon: plank deck, stanchions in the livery and a
    chained pyramid of logs."""
    root = kit.empty("wagon_logs")
    L = 0.25
    yb = L / 2 - BUF
    parts = [vk.blk("deck", (0.132, 2 * yb - 0.008, 0.007), (0, 0, 0.0795),
                    "wood:planks", bevel=0.001, edge=0.05)]
    for s in (1, -1):
        parts.append(vk.blk("side", (0.004, 2 * yb - 0.006, 0.012),
                            (s * 0.066, 0, 0.0775), TEAM, bevel=0.001,
                            edge=0.05))
        for y in (-0.09, -0.03, 0.03, 0.09):
            parts.append(vk.blk("stanchion", (0.004, 0.005, 0.064),
                                (s * 0.0645, y, 0.115), TEAM2, edge=1))
    for s in (1, -1):
        parts.append(vk.blk("bulkhead", (0.13, 0.004, 0.05),
                            (0, s * (yb - 0.004), 0.108), TEAM,
                            bevel=0.001))
        for x in (-0.04, 0.0, 0.04):
            parts.append(vk.blk("rib", (0.004, 0.0016, 0.05),
                                (x, s * (yb - 0.0016), 0.108), TEAM2, edge=1))
    r = 0.0195
    z = 0.083 + r
    logs = [(-0.041, z), (0.0, z), (0.041, z),
            (-0.0205, z + 0.0345), (0.0205, z + 0.0345), (0.0, z + 0.069)]
    for k, (x, zz) in enumerate(logs):
        ln = 0.204 + ((k * 37) % 5 - 2) * 0.004
        parts.append(log("log", r * (0.96 + 0.04 * ((k * 7) % 3) / 2), ln,
                         (x, ((k * 13) % 3 - 1) * 0.003, zz), seed=k + 3))
    for y in (-0.055, 0.055):
        pts = [(-0.064, y, 0.11), (-0.052, y, 0.15), (-0.024, y, 0.176),
               (0.0, y, 0.18), (0.024, y, 0.176), (0.052, y, 0.15),
               (0.064, y, 0.11)]
        parts.append(vk.tube("chain", kit.smooth_path(pts, samples=2),
                             0.0011, STEEL, seg=5))
    parts += solebars(2 * yb - 0.012)
    for s in (1, -1):
        parts += buffers(s * yb, s, beam=CHASSIS)
    wheels = []
    for tag, y in (("f", 0.075), ("r", -0.075)):
        p, w = bogie(tag, y, r=0.012, gap=0.04)
        parts += p
        wheels += w
    return vk.finish(root, parts, wheels)


# ---------------------------------------------------------------- boats

def hull(name, keys, ys=(), top=WHITE, boot=NAVY, bottom=HULLRED,
         deck=DECK, stripe=None, stripe_mat=NAVY, front=0.003, rear=0.003,
         n=2, ring_kw=None, extra=None):
    """A lofted hull with its waterline at z = 0: antifouling below, a
    boot-top band at the waterline, topsides, an optional sheer stripe
    (offsets below the deck edge) and a cambered deck on top."""
    def side_fn(p):
        pts = [-0.0012, 0.0028]
        if stripe:
            pts += [p["z1"] - stripe[0], p["z1"] - stripe[1]]
        return tuple(pts)

    secs = vk.stations(keys, ys, front=front, rear=rear, n=n, bottom=0.2,
                       ring_kw=ring_kw or {"nb": 2, "nc": 4, "nr": 4},
                       side_fn=side_fn, smooth=True)

    def cls(i, lab, c, nrm):
        if extra:
            e = extra(i, lab, c, nrm)
            if e is not None:
                return e
        if lab == "cap":
            return 1 if c.z < -0.001 else (2 if c.z < 0.003 else 0)
        if lab in ("b", "bc", "s0"):
            return 1
        if lab == "s1":
            return 2
        if lab == "s3" and stripe:
            return 4
        if lab in ("tc1", "tc2", "tc3", "r"):
            return 3
        return 0

    return vk.loft(name, secs, [top, bottom, boot, deck, stripe_mat], cls)


def gunwale(keys, ys, mat, r=0.0016, lift=0.002, inset=0.0012):
    """A rail along the deck edge, round the bow, from stern to stern."""
    side = []
    for y in ys:
        p = vk.keyed(keys, y, smooth=True)
        side.append((p["hw"] - p.get("tumble", 0.0) - inset, y,
                     p["z1"] + lift))
    pts = [(x, y, z) for x, y, z in side] + \
        [(-x, y, z) for x, y, z in reversed(side[:-1])]
    return vk.tube("gunwale", pts, r, mat, seg=6, cap=True)


def sail(name, tack, head, clew, camber, mat=SAIL, nu=6, nv=8, roach=0.0):
    """A cambered sail between three corners (x is the camber side)."""
    import bmesh
    bm = bmesh.new()
    T_, H_, C_ = Vector(tack), Vector(head), Vector(clew)
    grid = []
    for j in range(nv + 1):
        v = j / nv
        row = []
        for i in range(nu + 1):
            u = i / nu
            p = T_.lerp(H_, v).lerp(C_.lerp(H_, v), u)
            p.x += camber * math.sin(PI * u) * (1 - v * 0.8)
            # A little roach on the trailing edge.
            p += (C_ - T_).normalized() * roach * math.sin(PI * v) * u
            row.append(bm.verts.new(p))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1],
                          grid[j + 1][i]))
    obj = vk.mesh(name, bm, [mat])
    m = obj.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.0011
    m.offset = 0
    return obj


def life_ring(at, axis="Y", r=0.0065):
    prof = []
    for k in range(7):
        a = k / 6 * math.tau
        prof.append((r + math.cos(a) * 0.0018, math.sin(a) * 0.0018, 0))
    ring = vk.spin("lifering", prof, [ORANGE], at, segments=12, axis=axis)
    for k in range(4):
        a = k / 4 * math.tau + 0.4
        band = vk.blk("lifering-band", (0.0042, 0.0042, 0.0026), (0, 0, 0),
                      WHITE, edge=1)
        if axis == "X":
            band.location = (at[0], at[1] + math.cos(a) * r,
                             at[2] + math.sin(a) * r)
            band.rotation_euler = (a, 0, 0)
        else:
            band.location = (at[0] + math.cos(a) * r, at[1],
                             at[2] + math.sin(a) * r)
            band.rotation_euler = (0, -a, 0)
        ring = kit.join([ring, band], "lifering")
    return ring


def ferry():
    """A small double-ended car ferry: navy hull, an open car deck with
    lane lines and raised ramps at both ends, white side casings carrying
    lifeboats and a funnel, and a bridge spanning the deck."""
    root = kit.empty("ferry")
    hk = dict(z0=-0.022, z1=0.032, rb=0.016, rt=0.003, tumble=-0.004,
              crown=0.0015)
    keys = [(-0.262, dict(hk, hw=0.07, z0=-0.006, z1=0.034)),
            (-0.215, dict(hk, hw=0.094)), (0.215, dict(hk, hw=0.094)),
            (0.262, dict(hk, hw=0.07, z0=-0.006, z1=0.034))]
    ys = [-0.24, 0.24, -0.15, 0.15, -0.075, 0.0, 0.075]
    body = hull("ferry-hull", keys, ys, top=NAVY, boot=WHITE,
                deck=CARDECK, front=0.012, rear=0.012, n=3)
    parts = [body]
    # Car deck lines.
    for k in range(-5, 6):
        parts.append(vk.blk("lane", (0.003, 0.022, 0.0006),
                            (0, k * 0.04, 0.0335), WHITE, edge=1))
    for s in (1, -1):
        parts.append(vk.blk("edge-line", (0.0025, 0.4, 0.0006),
                            (s * 0.06, 0, 0.0335), YELLOW, edge=0.1))
    # Bulwarks with a white cap rail, bollards and life rings.
    for s in (1, -1):
        parts.append(vk.blk("bulwark", (0.004, 0.43, 0.016),
                            (s * 0.0905, 0, 0.04), NAVY, bevel=0.001,
                            seg=1, edge=0.08))
        parts.append(vk.blk("cap-rail", (0.0065, 0.432, 0.0022),
                            (s * 0.0905, 0, 0.0485), WHITE, bevel=0.0007,
                            seg=1, edge=0.1))
        for y in (-0.2, 0.2):
            parts.append(vk.cyl("bollard", 0.0035, 0.008,
                                (s * 0.078, y, 0.0365), "Z", CHASSIS,
                                verts=8))
        parts.append(life_ring((s * 0.0935, 0.15 * s, 0.04), axis="X"))
    # Ramps raised at both ends, chains to the bulwark ends.
    for s in (1, -1):
        ramp = vk.blk("ramp", (0.11, 0.05, 0.0035), (0, 0, 0), CARDECK,
                      bevel=0.0008, seg=1, edge=0.06)
        ramp.data.transform(__import__("mathutils").Matrix.Translation(
            (0, s * 0.025, 0)))
        ramp.location = (0, s * 0.248, 0.036)
        ramp.rotation_euler = (s * 0.42, 0, 0)
        parts.append(ramp)
        for x in (-0.05, 0.05):
            parts.append(vk.rod("ramp-chain", (x * 1.6, s * 0.215, 0.05),
                                (x, s * 0.29, 0.056), 0.0009, CHASSIS,
                                seg=6))
        for k in range(5):
            parts.append(vk.blk("ramp-rib", (0.11, 0.0022, 0.0015),
                                (0, s * (0.252 + k * 0.0085),
                                 0.0385 + k * 0.0038), CHASSIS, edge=1,
                                rot=(s * 0.42, 0, 0)))
    # Side casings with windows and doors.
    cas = []
    for s in (1, -1):
        cy0, cy1 = -0.12, 0.12
        x0 = s * 0.0755
        ck = [(cy0, dict(hw=0.0125, z0=0.03, z1=0.082, rb=0.001, rt=0.004,
                         tumble=0.0, crown=0.002)),
              (cy1, dict(hw=0.0125, z0=0.03, z1=0.082, rb=0.001, rt=0.004,
                         tumble=0.0, crown=0.002))]
        wins = [(-0.095 + k * 0.034, -0.095 + k * 0.034 + 0.02)
                for k in range(6)]
        ys_c = [y for a, b in wins for y in (a, b)]
        secs = vk.stations(ck, ys_c, front=0.004, rear=0.004, n=2,
                           ring_kw={"nb": 1, "nc": 2, "nr": 1},
                           side_fn=lambda p: (0.055, 0.068))

        def ccls(i, lab, c, nrm, wins=wins):
            if lab == "s1" and any(a <= c.y <= b for a, b in wins):
                return 1
            if lab in ("tc1", "r"):
                return 2
            return 0

        c = vk.loft("casing", secs, [WHITE, GLASS, "paint:casingtop", SEAL],
                    ccls)
        vk.inset(c, 1, 3, thick=0.0007, depth=0.0009)
        vk.lift(c, (x0, 0, 0))
        cas.append(c)
    parts += cas
    # Doors on the casing ends facing the camera.
    for s in (1, -1):
        parts.append(vk.blk("door", (0.012, 0.0015, 0.024),
                            (s * 0.0755, -0.1242, 0.044), SEAL,
                            bevel=0.0004))
    # Lifeboats on the casing tops.
    for s in (1, -1):
        for y in (-0.08, 0.08):
            boat = vk.ball("lifeboat", 0.022, (s * 0.0755, y, 0.093), ORANGE,
                           scale=(0.32, 1.0, 0.27), seg=10, rings=6)
            parts.append(boat)
            parts.append(vk.blk("canopy", (0.012, 0.03, 0.003),
                                (s * 0.0755, y, 0.0985), WHITE, edge=1))
            for dy in (-0.016, 0.016):
                parts.append(vk.rod("davit", (s * 0.0755, y + dy, 0.0835),
                                    (s * 0.0755, y + dy, 0.1), 0.0011,
                                    STEEL, seg=6))
    # The bridge spanning the deck.
    bk = [(-0.034, dict(hw=0.088, z0=0.083, z1=0.122, rb=0.001, rt=0.004,
                        tumble=0.0, crown=0.003)),
          (0.034, dict(hw=0.088, z0=0.083, z1=0.122, rb=0.001, rt=0.004,
                       tumble=0.0, crown=0.003))]
    bridge = vk.loft("bridge", vk.stations(bk, [-0.026, -0.006, 0.006, 0.026],
                                           front=0.004, rear=0.004, n=2,
                                           ring_kw={"nc": 2, "nr": 3},
                                           side_fn=lambda p: (0.1, 0.115)),
                     [WHITE, GLASS, SEAL, "paint:casingtop"],
                     lambda i, lab, c, nrm: 1 if lab == "s1" and
                     abs(c.y) < 0.026 and (abs(c.y) > 0.006) else
                     (3 if lab in ("tc1", "r") else 0))
    vk.inset(bridge, 1, 2, thick=0.0007, depth=0.0009)
    for s in (1, -1):
        vk.window(bridge, (0, s * 0.034, 0.1075), (0.15, 0.013),
                  "y" if s > 0 else "-y", round_=0.001)
    parts.append(bridge)
    for s in (1, -1):
        for x in (-0.03, 0.0, 0.03):
            parts.append(vk.blk("mullion", (0.0025, 0.0018, 0.013),
                                (x + s * 0.0, s * 0.0338, 0.1075), WHITE,
                                edge=1))
        parts.append(vk.blk("wing", (0.016, 0.03, 0.0025),
                            (s * 0.096, 0, 0.1205), WHITE, bevel=0.0008))
    # Funnel, mast, radar and navigation lights.
    fun = vk.spin("funnel", [(0.0, 0.0, 0), (0.0115, 0.0, 0),
                             (0.0112, 0.022, 0), (0.0108, 0.026, 1),
                             (0.0106, 0.033, 1), (0.0, 0.033, 1)],
                  [YELLOW, CHASSIS], (0.0755, 0.075, 0.082), segments=16,
                  axis="Z")
    fun.scale = (0.85, 1.45, 1)
    fun.rotation_euler = (-0.12, 0, 0)
    parts.append(fun)
    parts.append(vk.rod("mast", (0, 0.0, 0.124), (0, 0.0, 0.168), 0.0016,
                        WHITE, seg=8))
    parts.append(vk.blk("radar", (0.026, 0.003, 0.0022), (0, 0.0, 0.158),
                        SEAL, bevel=0.0006))
    parts.append(vk.ball("masthead", 0.0024, (0, 0.0, 0.17), LAMP, seg=8,
                         rings=6))
    for s, col in ((1, "glow:starboard"), (-1, TAIL)):
        parts.append(vk.blk("navlight", (0.003, 0.004, 0.003),
                            (s * 0.104, 0.0, 0.124), col, edge=1))
    parts.append(vk.blk("flagpole", (0.0012, 0.0012, 0.03), (0, -0.258, 0.05),
                        WHITE, edge=1))
    parts.append(vk.blk("flag", (0.0008, 0.014, 0.009), (0, -0.265, 0.06),
                        "plastic:flag", edge=1))
    return vk.finish(root, parts)


def sailboat():
    """A small sloop: white hull with a navy sheer stripe and teak deck, a
    cabin with portholes, cockpit and tiller, mast and boom, mainsail and
    jib, stays and a pennant."""
    root = kit.empty("sailboat")
    hk = dict(rt=0.003, tumble=-0.003, crown=0.002, rb=0.03)
    keys = [(-0.098, dict(hk, hw=0.029, z0=-0.004, z1=0.021)),
            (-0.05, dict(hk, hw=0.037, z0=-0.014, z1=0.0205)),
            (0.015, dict(hk, hw=0.038, z0=-0.016, z1=0.021)),
            (0.07, dict(hk, hw=0.028, z0=-0.012, z1=0.0235)),
            (0.1, dict(hk, hw=0.013, z0=-0.004, z1=0.026)),
            (0.113, dict(hk, hw=0.0035, z0=0.006, z1=0.0275))]
    ys = [-0.086, -0.074, -0.062, -0.037, -0.025, -0.005, 0.03, 0.045,
          0.058, 0.078, 0.085, 0.092, 0.097, 0.103, 0.107, 0.11]
    body = hull("sail-hull", keys, ys, top=WHITE, boot=NAVY, deck=DECK,
                stripe=(0.0052, 0.0028), stripe_mat=NAVY)
    vk.cut(body, vk.blk("cockpit", (0.044, 0.046, 0.022),
                        (0, -0.07, 0.024), DECK, bevel=0.003, seg=2), DECK)
    parts = [body]
    parts.append(gunwale(keys, [-0.098, -0.086, -0.074, -0.062, -0.05,
                                -0.025, 0.015, 0.045, 0.07, 0.078, 0.085,
                                0.092, 0.1, 0.103, 0.107, 0.11, 0.113],
                         WHITE,
                         r=0.0011, lift=0.0006, inset=0.0008))
    # Keel and rudder (under water, but the river is clear).
    parts.append(vk.blk("keel", (0.004, 0.04, 0.024), (0, 0.005, -0.026),
                        HULLRED, bevel=0.0015))
    parts.append(vk.blk("rudder", (0.003, 0.014, 0.022), (0, -0.092, -0.008),
                        HULLRED, bevel=0.001))
    # Cabin with portholes and a hatch.
    ck = [(-0.038, dict(hw=0.0215, z0=0.015, z1=0.034, rb=0.001, rt=0.004,
                        tumble=0.004, crown=0.004)),
          (0.042, dict(hw=0.019, z0=0.016, z1=0.0325, rb=0.001, rt=0.004,
                       tumble=0.004, crown=0.004))]
    ports = [(-0.026, -0.014), (-0.006, 0.006), (0.014, 0.026)]
    secs = vk.stations(ck, [y for a, b in ports for y in (a, b)],
                       front=0.009, rear=0.002, n=3,
                       ring_kw={"nc": 2, "nr": 3},
                       side_fn=lambda p: (0.0235, 0.0295))
    cab = vk.loft("cabin", secs, [WHITE, GLASS, SEAL, DECK],
                  lambda i, lab, c, nrm: 1 if lab == "s1" and any(
                      a <= c.y <= b for a, b in ports) else
                  (3 if lab == "r" else 0))
    vk.inset(cab, 1, 2, thick=0.0006, depth=0.0007)
    parts.append(cab)
    parts.append(vk.blk("hatch", (0.016, 0.014, 0.003), (0, -0.028, 0.0365),
                        DECK, bevel=0.0008))
    parts.append(vk.blk("washboard", (0.014, 0.0015, 0.012),
                        (0, -0.0385, 0.027), "wood:teak", edge=1))
    # Tiller and cockpit seats.
    parts.append(vk.rod("tiller", (0, -0.096, 0.026), (0, -0.06, 0.03),
                        0.0014, "wood:teak", seg=6))
    for s in (1, -1):
        parts.append(vk.blk("bench", (0.008, 0.04, 0.003),
                            (s * 0.017, -0.07, 0.016), "wood:teak",
                            edge=1))
    # Mast, boom, sails.
    my = 0.03
    parts.append(vk.cyl("mast", 0.0022, 0.246, (0, my, 0.033 + 0.123), "Z",
                        CHROME, verts=10))
    parts.append(vk.rod("boom", (0, my - 0.002, 0.05), (0, -0.088, 0.05),
                        0.0017, CHROME, seg=8))
    parts.append(sail("mainsail", (0.0, my - 0.003, 0.053),
                      (0.0, my - 0.003, 0.272), (0.0, -0.085, 0.053), 0.007,
                      roach=0.012))
    parts.append(sail("jib", (0.0, 0.108, 0.031), (0.0, my + 0.003, 0.226),
                      (0.01, 0.012, 0.042), -0.006, nu=5, nv=7))
    # Standing rigging and a pulpit.
    top = (0, my, 0.278)
    for a, b in ((top, (0, 0.11, 0.029)), (top, (0, -0.096, 0.024)),
                 ((0, my, 0.22), (0.035, my - 0.004, 0.022)),
                 ((0, my, 0.22), (-0.035, my - 0.004, 0.022))):
        parts.append(vk.rod("stay", a, b, 0.0005, CHASSIS, seg=4))
    pulpit = [(-0.009, 0.092, 0.03), (-0.008, 0.1, 0.039), (0, 0.11, 0.041),
              (0.008, 0.1, 0.039), (0.009, 0.092, 0.03)]
    parts.append(vk.tube("pulpit", kit.smooth_path(pulpit, samples=2),
                         0.0007, CHROME, seg=6))
    parts.append(vk.blk("pennant", (0.0006, 0.012, 0.004),
                        (0, my - 0.006, 0.281), "plastic:flag", edge=1))
    return vk.finish(root, parts)


def fishing_boat():
    """A small trawler: blue hull with a white sheer stripe, wheelhouse
    with framed windows, mast and derrick, stern gallows, nets, fish boxes,
    buoys and life rings."""
    root = kit.empty("fishing_boat")
    hk = dict(rt=0.003, tumble=-0.004, crown=0.002, rb=0.035)
    keys = [(-0.122, dict(hk, hw=0.042, z0=-0.004, z1=0.034)),
            (-0.07, dict(hk, hw=0.05, z0=-0.021, z1=0.033)),
            (0.03, dict(hk, hw=0.05, z0=-0.023, z1=0.0355)),
            (0.09, dict(hk, hw=0.036, z0=-0.017, z1=0.042)),
            (0.123, dict(hk, hw=0.014, z0=-0.006, z1=0.049)),
            (0.135, dict(hk, hw=0.004, z0=0.006, z1=0.051))]
    ys = [-0.112, -0.1, -0.085, -0.04, 0.0, 0.06, 0.075, 0.1, 0.106, 0.112,
          0.118, 0.128, 0.132]
    body = hull("fish-hull", keys, ys, top="paint:fishhull", boot=WHITE,
                deck=DECK, stripe=(0.0062, 0.0032), stripe_mat=WHITE)
    parts = [body]
    gys = [-0.122, -0.112, -0.1, -0.085, -0.07, -0.04, 0.0, 0.03, 0.06,
           0.075, 0.09, 0.1, 0.106, 0.112, 0.118, 0.123, 0.128, 0.132,
           0.135]
    parts.append(gunwale(keys, gys, "paint:fishhull", r=0.0024, lift=0.0042,
                         inset=0.0022))
    parts.append(gunwale(keys, gys, WHITE, r=0.0012, lift=0.0072,
                         inset=0.0022))
    # Wheelhouse.
    wy0, wy1 = -0.002, 0.052
    wk = [(wy0, dict(hw=0.029, z0=0.03, z1=0.083, rb=0.001, rt=0.004,
                     tumble=0.002, crown=0.003)),
          (wy1, dict(hw=0.028, z0=0.032, z1=0.083, rb=0.001, rt=0.004,
                     tumble=0.002, crown=0.003))]
    wins = [(0.006, 0.022), (0.027, 0.044)]
    secs = vk.stations(wk, [y for a, b in wins for y in (a, b)],
                       front=0.003, rear=0.003, n=2,
                       ring_kw={"nc": 2, "nr": 3},
                       side_fn=lambda p: (0.06, 0.076))
    wh = vk.loft("wheelhouse", secs, [WHITE, GLASS, SEAL],
                 lambda i, lab, c, nrm: 1 if lab == "s1" and any(
                     a <= c.y <= b for a, b in wins) else 0)
    vk.inset(wh, 1, 2, thick=0.0008, depth=0.0009)
    for x in (-0.017, 0.0, 0.017):
        vk.window(wh, (x, wy1, 0.069), (0.014, 0.014), "y", round_=0.0015)
    vk.window(wh, (-0.012, wy0, 0.058), (0.014, 0.04), "-y", glass=SEAL,
              round_=0.001)
    vk.window(wh, (0.012, wy0, 0.07), (0.013, 0.012), "-y", round_=0.0015)
    parts.append(wh)
    parts.append(vk.blk("wh-roof", (0.066, 0.064, 0.005),
                        (0, (wy0 + wy1) / 2 + 0.002, 0.0855),
                        "paint:fishroof", bevel=0.0018, seg=2))
    parts.append(vk.blk("visor", (0.06, 0.008, 0.0018),
                        (0, wy1 + 0.005, 0.0805), "paint:fishroof",
                        bevel=0.0006))
    parts.append(life_ring((0.0302, 0.03, 0.05), axis="X"))
    parts.append(life_ring((-0.0302, 0.03, 0.05), axis="X"))
    # Mast with radar, lights and a derrick boom over the aft deck.
    mx, my = 0.0, 0.03
    parts.append(vk.cyl("mast", 0.0022, 0.08, (mx, my, 0.088 + 0.04), "Z",
                        WHITE, verts=10))
    parts.append(vk.blk("radar", (0.03, 0.004, 0.0025), (mx, my, 0.15),
                        SEAL, bevel=0.0007))
    parts.append(vk.blk("crosstree", (0.03, 0.0025, 0.0025), (mx, my, 0.134),
                        WHITE, edge=1))
    for x, col in ((0.014, "glow:starboard"), (-0.014, TAIL)):
        parts.append(vk.blk("navlight", (0.003, 0.003, 0.003),
                            (x, my, 0.1375), col, edge=1))
    parts.append(vk.ball("masthead", 0.0022, (mx, my, 0.1695), LAMP, seg=8,
                         rings=6))
    parts.append(vk.rod("derrick", (mx, my - 0.004, 0.1), (mx, -0.085, 0.07),
                        0.0011, "paint:fishroof", seg=6))
    parts.append(vk.rod("topping", (mx, my, 0.16), (mx, -0.09, 0.076),
                        0.0005, CHASSIS, seg=4))
    parts.append(vk.cyl("stack", 0.004, 0.03, (0.018, -0.008, 0.098), "Z",
                        CHASSIS, verts=10))
    # Stern gallows.
    for s in (1, -1):
        parts.append(vk.rod("gallows", (s * 0.036, -0.112, 0.034),
                            (s * 0.028, -0.116, 0.088), 0.0022,
                            "paint:fishroof", seg=8))
    parts.append(vk.rod("gallows-top", (-0.03, -0.1158, 0.087),
                        (0.03, -0.1158, 0.087), 0.0022, "paint:fishroof",
                        seg=8))
    parts.append(vk.cyl("block", 0.004, 0.003, (0, -0.1158, 0.081), "X",
                        STEEL, verts=10))
    # Nets, boxes, buoys and a winch on the aft deck.
    net = vk.ball("net", 0.024, (0.012, -0.085, 0.036), "plastic:net",
                  scale=(1.0, 0.85, 0.42), seg=14, rings=8)
    kit.jitter(net, 0.0016, seed=9)
    parts.append(net)
    for k, (x, y, z) in enumerate(((-0.024, -0.045, 0.039),
                                   (-0.024, -0.064, 0.039),
                                   (-0.024, -0.054, 0.049),
                                   (0.026, -0.04, 0.039))):
        mat = ORANGE if k % 2 == 0 else "plastic:crate"
        parts.append(vk.blk("crate", (0.016, 0.016, 0.0095), (x, y, z), mat,
                            bevel=0.0012))
    for x, y in ((0.03, -0.065), (-0.035, -0.088), (0.038, -0.1)):
        parts.append(vk.ball("buoy", 0.0055, (x, y, 0.042), ORANGE, seg=10,
                             rings=6))
    parts.append(vk.cyl("winch", 0.007, 0.03, (0, -0.012, 0.042), "X",
                        CHROME, verts=12))
    parts.append(vk.blk("winch-base", (0.036, 0.012, 0.008),
                        (0, -0.012, 0.036), "paint:fishroof", bevel=0.001))
    for s in (1, -1):
        parts.append(vk.ball("fender", 0.005, (s * 0.0505, -0.02, 0.026),
                             WHITE, scale=(0.8, 0.8, 1.4), seg=10, rings=6))
    return vk.finish(root, parts)


# ---------------------------------------------------------------- references

def road_strip(name, length, y=0.0, x=0.0):
    root = kit.empty(name, (x, y, 0))
    parts = [vk.blk("asphalt", (0.30, length, 0.012), (0, 0, 0.006),
                    "asphalt:road", edge=0.1)]
    for s in (1, -1):
        parts.append(vk.blk("kerb", (0.025, length, 0.016),
                            (s * 0.1625, 0, 0.008), "stone:kerb", edge=0.1,
                            bevel=0.002))
    k = -length / 2 + 0.03
    while k < length / 2 - 0.04:
        parts.append(vk.blk("dash", (0.006, 0.05, 0.0006), (0, k + 0.025,
                                                          0.0123),
                            "paint:white", edge=1))
        k += 0.1
    obj = kit.join(parts, name + "-mesh")
    obj.location = root.location.copy()
    kit.parent(obj, root)
    kit.uv_box(obj)
    kit.fill_ao([obj])
    return root


def track_strip(name, length, y=0.0, x=0.0):
    root = kit.empty(name, (x, y, 0))
    parts = [vk.blk("ballast", (0.24, length, 0.014), (0, 0, 0.007),
                    "ballast:warm", edge=0.1, bevel=0.004),
             vk.blk("ballast2", (0.2, length, 0.008), (0, 0, 0.018),
                    "ballast:warm", edge=0.1, bevel=0.003)]
    k = -length / 2 + 0.03
    while k < length / 2:
        parts.append(vk.blk("sleeper", (0.2, 0.03, 0.008), (0, k, 0.024),
                            "wood:sleeper", edge=0.1, bevel=0.001))
        k += 0.065
    for s in (1, -1):
        parts.append(vk.blk("rail", (0.004, length, 0.012),
                            (s * 0.045, 0, 0.034), STEEL, edge=0.1))
        parts.append(vk.blk("railfoot", (0.008, length, 0.003),
                            (s * 0.045, 0, 0.0295), STEEL, edge=0.1))
    obj = kit.join(parts, name + "-mesh")
    obj.location = root.location.copy()
    kit.parent(obj, root)
    kit.uv_box(obj)
    kit.fill_ao([obj])
    return root


def water(name, y=0.0):
    """A teal water surface at z = 0 with a 1 m square marked on it."""
    root = kit.empty(name, (0, y, 0))
    parts = [vk.blk("water", (4.0, 4.0, 0.004), (0, 0, -0.0021),
                    "plastic:water", edge=10)]
    for s in (1, -1):
        parts.append(vk.blk("edge", (1.0, 0.006, 0.001), (0, s * 0.5, 0.0004),
                            "paint:white", edge=1))
        parts.append(vk.blk("edge", (0.006, 1.0, 0.001), (s * 0.5, 0, 0.0004),
                            "paint:white", edge=1))
    obj = kit.join(parts, name + "-mesh")
    obj.location = root.location.copy()
    kit.parent(obj, root)
    kit.fill_ao([obj])
    return root


def metre_square(name, x=0.0, y=0.0):
    root = kit.empty(name, (x, y, 0))
    parts = []
    for s in (1, -1):
        parts.append(vk.blk("edge", (1.0, 0.008, 0.002), (0, s * 0.5, 0.001),
                            "paint:white", edge=1))
        parts.append(vk.blk("edge", (0.008, 1.0, 0.002), (s * 0.5, 0, 0.001),
                            "paint:white", edge=1))
    obj = kit.join(parts, name + "-mesh")
    obj.location = root.location.copy()
    kit.parent(obj, root)
    kit.fill_ao([obj])
    return root


# ---------------------------------------------------------------- build

BUILDERS = [
    ("loco_steam", loco_steam, "train"),
    ("loco_diesel", loco_diesel, "train"),
    ("coach", coach, "train"),
    ("dmu_car", dmu_car, "train"),
    ("wagon_box", wagon_box, "train"),
    ("wagon_tank", wagon_tank, "train"),
    ("wagon_logs", wagon_logs, "train"),
    ("car_hatch", car_hatch, "road"),
    ("car_sedan", car_sedan, "road"),
    ("car_retro", car_retro, "road"),
    ("van", van, "road"),
    ("bus", bus, "road"),
    ("lorry", lorry, "road"),
    ("tractor", tractor, "road"),
    ("ferry", ferry, "boat"),
    ("sailboat", sailboat, "boat"),
    ("fishing_boat", fishing_boat, "boat"),
]


# Exact lengths (Y extent) from the brief; trains are only centred, since
# their gauge and wheel heights are fixed by the track.
LENGTH = {
    "car_hatch": 0.15, "car_sedan": 0.17, "car_retro": 0.15, "van": 0.18,
    "bus": 0.27, "lorry": 0.25, "tractor": 0.12, "ferry": 0.55,
    "sailboat": 0.22, "fishing_boat": 0.26,
}


def main():
    argv = sys.argv
    rest = argv[argv.index("--") + 1:] if "--" in argv else []
    out = next((a for a in rest if a.endswith(".glb")), None)
    preview = next((a for a in rest if a.endswith(".png")), None)
    only = next((a[5:].split(",") for a in rest if a.startswith("only=")),
                None)
    views = next((a[6:].split(",") for a in rest if a.startswith("views=")),
                 None)
    roots, kinds = [], {}
    for name, fn, kind in BUILDERS:
        if only and name not in only:
            continue
        r = fn()
        vk.fit(r, LENGTH.get(name))
        roots.append(r)
        kinds[r.name] = kind

    # Report sizes and budgets.
    for r in roots:
        lo, hi = vk.bounds(r)
        size = hi - lo
        n = vk.tris(r)
        wheels = sorted("%s r=%.4f" % (o.name.split(".")[0], o["radius"])
                        for o in kit.descendants(r)[1:]
                        if o.name.startswith("wheel"))
        mats = sorted({m.name for o in kit.descendants(r) if o.type == "MESH"
                       for m in o.data.materials})
        flag = "  OVER BUDGET" if n > BUDGET else ""
        print(f"VEHICLE {r.name}: {n} tris{flag}  size {size.x:.3f} x "
              f"{size.y:.3f} x {size.z:.3f}  x {lo.x:.3f}..{hi.x:.3f} "
              f"y {lo.y:.3f}..{hi.y:.3f} z {lo.z:.3f}..{hi.z:.3f}")
        print(f"   wheels {wheels}")
        print(f"   materials {mats}")

    # Spread out for the bake so no vehicle shades another.
    for k, r in enumerate(roots):
        r.location = (k * 1.0, 0, 0)
    kit.refresh()
    land = [o for r in roots if kinds[r.name] != "boat"
            for o in kit.descendants(r) if o.type == "MESH"]
    boats = [o for r in roots if kinds[r.name] == "boat"
             for o in kit.descendants(r) if o.type == "MESH"]
    if land:
        kit.bake_ao(land, samples=64, distance=0.03)
    if boats:
        kit.bake_ao(boats, samples=64, distance=0.03, ground=False)
    for r in roots:
        r.location = (0, 0, 0)
    kit.refresh()
    if out:
        kit.export(roots, out)
        vk.clean_names(out)
    if preview:
        previews(preview, roots, kinds, views)


def shot(path, roots, size=1400, elevation=55, azimuth=0, margin=1.05,
         samples=64, floor=0.0, lens=70, centre=None, radius=None,
         width=None):
    """A studio render framed on `roots` (kit.preview with the floor at a
    given height and a warm late-afternoon sun), or on an explicit
    `centre` and `radius`; `width` makes it wider than tall."""
    scene = bpy.context.scene
    kit.gpu()
    scene.cycles.samples = samples
    scene.render.resolution_x = width or size
    scene.render.resolution_y = size
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.6, 0.68, 0.8, 1)
    bg.inputs[1].default_value = 0.65
    pts = []
    for r in roots:
        for o in kit.descendants(r):
            if o.type == "MESH" and not o.hide_render:
                pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    centre = Vector(centre) if centre is not None else (lo + hi) / 2
    radius = (radius or (hi - lo).length / 2) * margin
    cam_data = bpy.data.cameras.new("shot")
    cam_data.lens = lens
    cam_data.sensor_fit = "VERTICAL"
    cam_data.sensor_height = cam_data.sensor_width
    cam = bpy.data.objects.new("shot-cam", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    dist = radius / math.tan(cam_data.angle_y / 2)
    cam.location = centre + Vector((math.sin(az) * math.cos(el) * -dist,
                                    -math.cos(az) * math.cos(el) * dist,
                                    math.sin(el) * dist))
    cam.rotation_euler = (centre - cam.location).to_track_quat(
        "-Z", "Y").to_euler()
    cam_data.clip_start = 0.01
    scene.camera = cam
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.92, 0.8)
    sun_data.angle = math.radians(6)
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = (math.radians(48), math.radians(12),
                          math.radians(-38))
    scene.collection.objects.link(sun)
    fl = vk.blk("__floor", (60, 60, 0.02), (centre.x, centre.y, floor - 0.01),
                "plain:floor", edge=100)
    kit.fill_ao([fl])
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (cam, sun, fl):
        bpy.data.objects.remove(o, do_unlink=True)
    print("PREVIEW", path)


def previews(path, roots, kinds, views):
    base = path[:-4]
    by = {r.name: r for r in roots}
    hidden = []

    def show(names):
        for r in roots:
            on = r.name in names
            for o in kit.descendants(r):
                o.hide_render = not on

    def want(v):
        return not views or v in views

    if want("line"):
        # A line-up on a 1 m square: trains, road vehicles, boats.
        order = {"train": 0, "road": 1, "boat": 2}
        x = {0: -0.45, 1: -0.45, 2: -0.45}
        rows = {0: -0.3, 1: 0.1, 2: 0.42}
        for r in roots:
            row = order[kinds[r.name]]
            lo, hi = vk.bounds(r)
            wdt = hi.x - lo.x
            r.location = (x[row] + wdt / 2, rows[row],
                          0.0 if kinds[r.name] != "boat" else 0.03)
            r.rotation_euler = (0, 0, 0)
            x[row] += wdt + 0.04
        sq = metre_square("ref-square")
        show([r.name for r in roots])
        kit.refresh()
        shot(base + ".png", roots + [sq], size=1600, elevation=38,
             azimuth=20, margin=0.85, samples=64, floor=0.0)
        for d in kit.descendants(sq):
            bpy.data.objects.remove(d, do_unlink=True)
        for r in roots:
            r.location = (0, 0, 0)

    groups = [
        ("trains", [n for n in by if kinds[n] == "train"], "track"),
        ("cars", [n for n in by if kinds[n] == "road"], "road"),
        ("boats", [n for n in by if kinds[n] == "boat"], None),
    ]
    for label, names, ref in groups:
        if not names:
            continue
        for az in (0, 30):
            v = f"{label}{az}"
            if not want(label) and not want(v):
                continue
            # Vehicles one behind another on their lane, as in the game.
            y = 0.0
            lanes = {}
            placed = []
            for k, n in enumerate(names):
                r = by[n]
                lo, hi = vk.bounds(r)
                if label == "cars":
                    li = k % 2
                    lane = 0.075 if li == 0 else -0.075
                    ly = lanes.get(li, 0.0)
                    r.location = (lane, ly - hi.y, 0.012)
                    lanes[li] = ly - (hi.y - lo.y) - 0.03
                    placed.append(r)
                elif label == "trains":
                    r.location = (0, y - lo.y, 0)
                    y -= (hi.y - lo.y) + 0.004
                    placed.append(r)
                else:
                    r.location = (0, y - lo.y, 0)
                    y -= (hi.y - lo.y) + 0.05
                    placed.append(r)
            show(names)
            kit.refresh()
            ext = [vk.bounds(r) for r in placed]
            ymin = min(r.location.y + e[0].y for r, e in zip(placed, ext))
            ymax = max(r.location.y + e[1].y for r, e in zip(placed, ext))
            refs = []
            if ref == "road":
                refs.append(road_strip("ref-road", ymax - ymin + 0.2,
                                       (ymin + ymax) / 2))
            elif ref == "track":
                refs.append(track_strip("ref-track", ymax - ymin + 0.2,
                                        (ymin + ymax) / 2))
            else:
                refs.append(water("ref-water", (ymin + ymax) / 2))
            shot(f"{base}-{v}.png", placed, size=1400, elevation=55,
                 azimuth=az, margin=1.08, samples=64,
                 floor=0.0 if ref else -0.04)
            for o in refs:
                for d in kit.descendants(o):
                    bpy.data.objects.remove(d, do_unlink=True)
            for r in placed:
                r.location = (0, 0, 0)
    # Studio studies (views=study or study-<name>): front and rear three
    # quarters, the side, the game's angle, a close-up of each end and, for
    # a vehicle with door leaves, the doors swung open by the signs its
    # docstring gives.
    for r in roots:
        v = "study-" + r.name
        if not (views and (v in views or "study" in views)):
            continue
        show([r.name])
        refs = []
        if kinds[r.name] == "train":
            refs.append(track_strip("ref-track", 0.7))
        elif kinds[r.name] == "road":
            r.location = (0.075, 0, 0.012)
            refs.append(road_strip("ref-road", 0.6))
        kit.refresh()
        lo, hi = vk.bounds(r)
        lo += r.location
        hi += r.location
        c = (lo + hi) / 2
        rad = (hi - lo).length / 2
        ln = hi.y - lo.y
        views_ = [("front", 18, 148, c, rad * 0.78, 1500, 1000),
                  ("side", 5, 90, c, rad * 0.5, 1800, 800),
                  ("rear", 18, -32, c, rad * 0.78, 1500, 1000),
                  ("game", 52, 30, c, rad * 0.75, 1200, 1000),
                  ("front-close", 10, 162,
                   Vector((c.x, hi.y - ln * 0.16, lo.z + (hi.z - lo.z) * 0.6)),
                   ln * 0.22, 1200, 1000),
                  ("rear-close", 10, -18,
                   Vector((c.x, lo.y + ln * 0.16, lo.z + (hi.z - lo.z) * 0.6)),
                   ln * 0.22, 1200, 1000)]
        for label, el, az, cc, rr, wd, ht in views_:
            shot(f"{base}-{r.name}-{label}.png", [r], size=ht, width=wd,
                 elevation=el, azimuth=az, margin=1.0, centre=cc, radius=rr,
                 samples=64, lens=60)
        doors = {o.name.split(".")[0]: o for o in kit.descendants(r)
                 if o.name.startswith("door_")}
        sign = {"door_r0": 1, "door_r1": -1, "door_l0": -1, "door_l1": 1,
                "door_rf": 1, "door_rr": 1}
        if doors:
            for n_, o in doors.items():
                o.rotation_euler.z = sign.get(n_, 1) * math.radians(80)
            kit.refresh()
            for label, el, az in (("doors-l", 16, 62), ("doors-r", 16, -62)):
                shot(f"{base}-{r.name}-{label}.png", [r], size=1000,
                     width=1500, elevation=el, azimuth=az, margin=1.0,
                     centre=c, radius=rad * 0.6, samples=64, lens=60)
            o = doors.get("door_l0") or next(iter(doors.values()))
            p = o.matrix_world.translation
            shot(f"{base}-{r.name}-door-close.png", [r], size=1000,
                 width=1200, elevation=14, azimuth=58, margin=1.0,
                 centre=Vector((p.x, p.y - 0.012, p.z + 0.035)),
                 radius=0.045, samples=64, lens=60)
            for o in doors.values():
                o.rotation_euler.z = 0.0
            kit.refresh()
        for o in refs:
            for d in kit.descendants(o):
                bpy.data.objects.remove(d, do_unlink=True)
        r.location = (0, 0, 0)

    # Single close-ups of each vehicle from the game's angle.
    for r in roots:
        v = "one-" + r.name
        if not (views and (v in views or "one" in views)):
            continue
        show([r.name])
        refs = []
        if kinds[r.name] == "road":
            r.location = (0.075, 0, 0.012)
            refs.append(road_strip("ref-road", 0.6))
        elif kinds[r.name] == "train":
            refs.append(track_strip("ref-track", 0.6))
        else:
            refs.append(water("ref-water"))
        kit.refresh()
        shot(f"{base}-{r.name}.png", [r], size=1000, elevation=55,
             azimuth=30, margin=1.25, samples=64,
             floor=-0.04 if kinds[r.name] == "boat" else 0.0)
        for o in refs:
            for d in kit.descendants(o):
                bpy.data.objects.remove(d, do_unlink=True)
        r.location = (0, 0, 0)


main()
