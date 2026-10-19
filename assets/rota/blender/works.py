"""Rota's works: the mills, warehouses, sheds and yard things of a 1950s
northern mill town, plus the passenger stations and the maps' fixed pieces
(tunnel, gritstone outcrops, subsidence, cranes, the hoarding and a
cleared mill site). See docs/concepts/2026-10-03-rota-mill-town/brief.md
and, for the stations, docs/concepts/2026-10-08-rota-passengers/models.md.

One grid square is 25 m = 1 m here, the ground is z = 0, fronts face -Y
(towards the track). Every asset is a root empty at its footprint centre
(tunnel_rail's root sits on its portal face, y = 0) with one joined mesh
under it. The stations' per-side props (station_platforms*, station_steps*)
have their root at the station square's centre and are built on its -Y
side, between y = -0.5 and the bank face at y = -half.

  Blender -b --factory-startup --python assets/rota/blender/works.py -- \\
      assets/rota/build/works.glb \\
      docs/concepts/2026-10-03-rota-mill-town/previews/works.png

With a preview path it renders the line-up there and close-ups from the
game camera (elevation 55, azimuth 0 and 30) beside a 1 m square and a
car-sized box as works-<asset>-a0.png / -a30.png. ROTA_ONLY=a,b builds a
subset.
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rkit  # noqa: E402

kit = rkit.kit
rkit.reset(seed=23)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import building_kit as K  # noqa: E402
from building_kit import (Build, walls, gbox, box, cyl, lathe, ball, beam,  # noqa
                          prism_xz, pane, mesh, tf, T, rot, crate, barrel,
                          valance, chimney, downpipe, lamp_post, ring,
                          outline)
import works_kit as W  # noqa: E402
from works_kit import win, opening, arch_ring, plank_door, flat_box  # noqa

# ---------------------------------------------------------------- palette
# Sooty brick, blue-grey slate, sandstone dressings, iron, timber; muted
# paint on doors and frames. The game draws each as a flat toon colour.

TINTS = {
    # brick
    "soot": "#8e4c3a", "soot-dark": "#6e3a2e", "soot-deep": "#5a3027",
    "engine-blue": "#4c4648", "mill-red": "#9a5440",
    # slate and stone
    "blue-slate": "#5c6670", "slate-ridge": "#454c55",
    "dressing": "#c8b48c", "pale": "#d8c8a2", "grit": "#a3927a",
    "grit-dark": "#857862", "flags": "#a9a191", "setts": "#77726b",
    "lining": "#4f4943",
    # metal
    "iron": "#3d4248", "oxide": "#86402e", "zinc": "#7a838b",
    "bell": "#59655f", "rust": "#8c4f32",
    # wood
    "timber": "#54402f", "plank": "#7a634c", "weathered": "#8b8174",
    "crate": "#a08560", "fence": "#6a5a49",
    # paint
    "frame": "#e2dac8", "door-green": "#2f4b3c", "door-maroon": "#5a2b26",
    "door-blue": "#2f4259", "sign-black": "#262a2f", "letter": "#ece4cf",
    "poster-red": "#a65d4c", "poster-blue": "#687c8f",
    "poster-cream": "#dbd0b2", "poster-yellow": "#c9ae68",
    "poster-green": "#7d9071", "poster-ink": "#3b3a3c",
    "sack": "#c4b08a", "danger": "#c9a23a",
    # ground and moor
    "coal": "#2a292b", "coal-lit": "#3d3c40", "cinder": "#5d5852",
    "earth": "#6b5844", "clay": "#8a7257", "puddle": "#3c4650",
    "moor": "#737548", "moor-rough": "#857f52", "heather": "#65525c",
    "heather-brown": "#77634d", "gritstone": "#837867",
    "gritstone-dark": "#645b50", "weed": "#6f7d45", "hawthorn": "#4f6136", "ironwork": "#4a514c",
    # glass, glow, void
    "dark": "#2a3442", "hose": "#2b2724", "lamp": "#fff1c4", "void": "#050505",
    # passenger stations
    "station": "#a0553d", "canopy": "#776b5d", "valance": "#ebe2ca",
    "station-iron": "#5c2629", "edge-white": "#f2efe6", "step": "#cfc5ae",
    "clockface": "#f2ecdc", "lamp-green": "#2f4a3d", "buffer-red": "#b23a2d",
    "stop": "#ff4a2e", "shed": "#9fb5bd", "lead": "#6d7477",
    "gilt": "#c4a052", "pot": "#a85b3d", "steel": "#c9ced6",
}
for _n, _h in TINTS.items():
    kit.tint(_n, _h)

BRICK = "brick:soot"
BRICK_DK = "brick:soot-dark"
BRICK_DEEP = "brick:soot-deep"
BLUE = "brick:engine-blue"
SLATE = "slate:blue-slate"
SLATE_DK = "slate:slate-ridge"
STONE = "stone:dressing"
PALE = "stone:pale"
GRIT = "stone:grit"
GRIT_DK = "stone:grit-dark"
FLAGS = "stone:flags"
SETTS = "cobble:setts"
LINING = "stone:lining"
IRON = "metal:iron"
OXIDE = "paint:oxide"
TANK = "paint:ironwork"
ZINC = "metal:zinc"
TIMBER = "wood:timber"
PLANK = "wood:plank"
WEATHER = "wood:weathered"
CRATE = "wood:crate"
FENCE = "wood:fence"
FRAME = "paint:frame"
GREEN = "paint:door-green"
MAROON = "paint:door-maroon"
NAVY = "paint:door-blue"
SIGN = "paint:sign-black"
LETTER = "paint:letter"
GLASS = "glass:dark"
LAMP = "glow:lamp"
VOID = "plain:void"
COAL = "rock:coal"
COAL_LIT = "rock:coal-lit"
CINDER = "ballast:cinder"
EARTH = "field:earth"
CLAY = "field:clay"
PUDDLE = "glass:puddle"
MOOR = "grass:moor"
MOOR_RO = "grass:moor-rough"
HEATHER = "foliage:heather"
HEATHER_BR = "foliage:heather-brown"
GRITSTONE = "rock:gritstone"
GRITSTONE_DK = "rock:gritstone-dark"
WEED = "foliage:weed"
SACK = "plaster:sack"

ASSETS = {}
# Assets whose root is not the bounding box's centre (jibs reach out,
# the tunnel's root sits on its portal face).
OFF_CENTRE = {"yard_crane", "wharf_crane", "tunnel_rail", "station_platforms",
              "station_platforms_grand", "station_steps",
              "station_steps_grand"}


def asset(fn):
    ASSETS[fn.__name__] = fn
    return fn


def root(name):
    return kit.empty(name)


# ---------------------------------------------------------------- pieces

def sill_band(B, wall, u0, u1, z, mat=STONE, h=0.0035, proud=0.004):
    B.add(wall.put(box("sillband", (u1 - u0, proud, h),
                       ((u0 + u1) / 2, -proud / 2 + 0.0005, z), mat)))


def cornice(B, cx, cy, w, d, z, h, mat=STONE, out=0.004):
    B.add(box("cornice", (w + 2 * out, d + 2 * out, h), (cx, cy, z), mat))


def letters(B, wall, u, z, n, w, h, mat=SIGN, gap=0.4):
    """A painted name as a row of letter blocks."""
    step = w / n
    rnd = random.Random(n * 7 + int(u * 100))
    for i in range(n):
        x = u - w / 2 + step * (i + 0.5)
        lw = step * (1 - gap) * rnd.uniform(0.75, 1.05)
        B.add(wall.put(pane("letter", [(x + lw / 2, z - h / 2),
                                       (x + lw / 2, z + h / 2),
                                       (x - lw / 2, z + h / 2),
                                       (x - lw / 2, z - h / 2)], -0.0026,
                            mat)))


def cathead(B, wall, u, z, reach=0.026):
    """A hoist beam over a loading-door stack, a pulley and a hook."""
    B.add(wall.put(box("cat", (0.007, reach + 0.004, 0.007),
                       (u, -reach / 2 + 0.002, z), TIMBER)))
    B.add(wall.put(cyl("pulley", 0.004, 0.004, 0.003,
                       (u, -reach + 0.004, z - 0.006), 6, IRON, axis="x")))
    B.add(wall.put(cyl("rope", 0.0007, 0.0007, 0.05,
                       (u, -reach + 0.0045, z - 0.06), 4, IRON)))
    B.add(wall.put(box("hook", (0.003, 0.002, 0.005),
                       (u, -reach + 0.0045, z - 0.063), IRON)))


def build_chimney(B, x, y, H=1.0, base=0.08):
    """A circular engineering-brick stack, slender and genuinely tapered.
    A dark corbelled crown replaces the old oversized pale stripes. All
    heights follow H so the reclaimed site's short stack stays proportioned."""
    ped = H * 0.13
    B.add(box("plinth", (base, base, H * 0.018), (x, y, H * 0.006), GRIT))
    B.add(box("pedestal", (base - 0.007, base - 0.007, ped),
              (x, y, ped / 2), BRICK_DEEP))
    B.add(box("pedcap", (base, base, H * 0.012), (x, y, ped), BRICK_DK))
    r0, r1 = base * 0.375, base * 0.25
    z0, z1 = ped, H * 0.94

    def rad(z):
        return r0 + (r1 - r0) * (z - z0) / (z1 - z0)

    def round_section(name, prof, mat):
        o = lathe(name, prof, (x, y, 0), 20, mat, close=False)
        B.add(o, uv=("cyl", (x, y)))
    for za, zb, mat in ((z0, H * 0.70, BRICK),
                        (H * 0.70, z1, BRICK_DK)):
        round_section("shaft", [(rad(za), za), (rad(zb), zb)], mat)
    rt = rad(z1)
    round_section("crown", [(rt, z1), (rt + 0.002, H * 0.95),
                            (rt + 0.002, H * 0.962),
                            (rt + 0.005, H * 0.975),
                            (rt + 0.005, H * 0.992),
                            (rt + 0.003, H), (rt - 0.004, H),
                            (rt - 0.004, H * 0.974)], BRICK_DEEP)
    B.add(cyl("flue", rt - 0.004, rt - 0.004, 0.001, (x, y, H * 0.973), 20,
              VOID, cap=True))
    for z in (H * 0.40, H * 0.62, H * 0.82):
        B.add(cyl("hoop", rad(z) + 0.001, rad(z) + 0.001, H * 0.003,
                  (x, y, z), 20, IRON, cap=False))


def crate_stack(B, x, y, n=2, s=0.016, ang=0.0, seed=1):
    rnd = random.Random(seed)
    for i in range(n):
        crate(B, x + rnd.uniform(-0.002, 0.002), y + rnd.uniform(-0.002,
                                                                  0.002),
              s * rnd.uniform(0.85, 1.05), z0=i * s * 0.95 if i < 2 else 0,
              mat=CRATE, ang=ang + rnd.uniform(-12, 12))


def sacks(B, x, y, n=3, z0=0.0, seed=2):
    rnd = random.Random(seed)
    for i in range(n):
        a = rnd.uniform(0, math.tau)
        o = ball("sack", 1.0, (0, 0, 0), SACK, seg=5, rings=3,
                 scale=(0.007, 0.0055, 0.0045))
        tf(o, T(x + math.cos(a) * 0.006 * i, y + math.sin(a) * 0.006 * i,
                z0 + 0.0035) @ rot("Z", rnd.uniform(0, 180)))
        B.add(o)


# ---------------------------------------------------------------- mills

def finish_mill(B, r):
    """Keep individually editable architectural parts beside the runtime mesh.
    They live in a hidden source collection and are never included in glTF."""
    if os.environ.get("ROTA_MASTER"):
        collection = bpy.data.collections.new(r.name + "-editable-parts")
        bpy.context.scene.collection.children.link(collection)
        collection.hide_render = True
        collection.hide_viewport = True
        for obj, _ in B.parts:
            copy = obj.copy()
            copy.data = obj.data.copy()
            collection.objects.link(copy)
    B.finish(r)

def mill_window(B, wall, u, z, w, h, arch=True, flush=False):
    """Deep workshop glazing, with masonry arch and a thin six-pane frame."""
    shape = "segment" if arch else None
    win(B, wall, u, z, w, h, arch=shape, bars="grid", frame=FRAME,
        recess=0.006, flush=flush, sill=STONE)
    if arch:
        arch_ring(B, wall, u, w, h, shape, 0.0042, BRICK_DK,
                  proud=0.003, n=8, z0=z)
        B.add(wall.put(box("keystone", (0.006, 0.006, 0.009),
                           (u, -0.003, z + h + 0.0015), STONE)))


def mill_piers(B, wall, width, bays, ztop, mat=BRICK):
    """Vertical masonry carries the roof; sills are local to each window."""
    pitch = width / bays
    for i in range(bays + 1):
        u = -width / 2 + pitch * i
        pw = 0.014 if 0 < i < bays else 0.018
        B.add(wall.put(box("pier", (pw, 0.007, ztop - 0.022),
                           (u, -0.002, (ztop + 0.022) / 2), mat)))
        B.add(wall.put(box("pier-cap", (pw + 0.006, 0.011, 0.009),
                           (u, -0.004, ztop - 0.008), mat)))


@asset
def mill_big(name):
    """Four-storey spinning mill with twin slate roofs and a water tower.
    Brick piers, shadowed arch reveals and a recessed hoist bay give the
    long front a vertical rhythm; the two roofs read from a phone's plan view."""
    r = root(name)
    B = Build(name)
    cx, cy, w, d, hw = -0.06, 0, 0.65, 0.304, 0.442
    x0, x1 = cx - w / 2, cx + w / 2
    B.body(K.body("spinning-hall", w, d, hw, centre=(cx, cy),
                  mat="brick:mill-red", edge=0.07, bevel=0.001))
    B.add(box("stone-base", (w + 0.006, d + 0.006, 0.022),
              (cx, cy, 0.009), GRIT))
    wm = walls(cx, cy, w, d)
    pitch = w / 7
    us = [-w / 2 + pitch * (i + 0.5) for i in range(7)]
    zs = [0.036, 0.133, 0.230, 0.327]
    for side in ("front", "back"):
        wall = wm[side]
        mill_piers(B, wall, w, 7, hw - 0.009, "brick:mill-red")
        for i, u in enumerate(us):
            for floor, z in enumerate(zs):
                if side == "front" and i == 1:
                    plank_door(B, wall, u, 0.045, 0.073, GREEN,
                               z0=0 if floor == 0 else z - 0.004,
                               arch="segment", braces=False)
                    sill_band(B, wall, u - 0.027, u + 0.027,
                              0.075 if floor == 0 else z + 0.071,
                              mat=BRICK_DK, h=0.007)
                else:
                    mill_window(B, wall, u, z, 0.054, 0.074)
        # A brick dentil frieze below the roof's stone coping.
        for k in range(35):
            u = -w / 2 + w * (k + 0.5) / 35
            B.add(wall.put(box("dentil", (0.008, 0.006, 0.007),
                               (u, -0.003, hw - 0.013), BRICK_DK)))
    cathead(B, wm["front"], us[1], 0.429, reach=0.014)
    # Two complete gables, each with an oculus, and a shadowed central valley.
    for side in ("left", "right"):
        wall = wm[side]
        for u in (-d / 4, d / 4):
            for z in zs:
                mill_window(B, wall, u, z, 0.058, 0.074)
            win(B, wall, u, hw + 0.017, 0.023, 0.023, arch="round",
                bars="cross", flush=True)
    cornice(B, cx, cy, w, d, hw - 0.001, 0.009, STONE, out=0.004)
    for yc in (-d / 4, d / 4):
        B.add(K.body("roof-gables", w, d / 2, 0.0, 0.067, "x",
                     centre=(cx, yc), mat=BRICK, edge=0.09, bevel=0))
        tf(B.parts[-1][0], T(0, 0, hw))
        W.roof(B, cx, yc, w, d / 2, hw, 0.067, SLATE,
               over=0.004, over_gable=0.005, ridge_mat=SLATE_DK)
    B.add(box("valley-gutter", (w + 0.01, 0.009, 0.004),
              (cx, 0, hw + 0.008), ZINC))
    # The tank tower: structural corner piers and a stepped brick parapet.
    tx, tw, td, th = 0.326, 0.132, 0.176, 0.582
    B.body(K.body("water-tower", tw, td, th, centre=(tx, 0),
                  mat=BRICK_DK, edge=0.07, bevel=0.001))
    wt = walls(tx, 0, tw, td)
    for side in ("front", "right", "back"):
        wall = wt[side]
        wd = td if side == "right" else tw
        for u in (-wd / 2 + 0.005, wd / 2 - 0.005):
            B.add(wall.put(box("tower-pier", (0.018, 0.008, th),
                               (u, -0.003, th / 2), BRICK)))
        for k in range(5):
            z = 0.065 + k * 0.096
            mill_window(B, wall, 0, z, 0.035, 0.057, flush=side == "back")
        sill_band(B, wall, -wd / 2, wd / 2, 0.546, STONE, h=0.009)
    K.door(B, wt["front"], 0, 0.038, 0.067, GREEN, STONE,
           arch="round", step=GRIT, panels=False, knob=None, fb=0.005)
    cornice(B, tx, 0, tw, td, th, 0.01, BRICK, out=0.004)
    # A visible riveted tank recessed between the crown's four corners.
    B.add(box("water-tank", (tw - 0.022, td - 0.024, 0.049),
              (tx, 0, th + 0.029), TANK))
    for side in (-1, 1):
        B.add(box("tank-rib", (tw - 0.016, 0.003, 0.045),
                  (tx, side * (td / 2 - 0.011), th + 0.029), IRON))
        for x in (-tw / 2 + 0.007, tw / 2 - 0.007):
            B.add(box("tower-corner", (0.018, 0.018, 0.06),
                      (tx + x, side * (td / 2 - 0.007), th + 0.03), BRICK))
            B.add(box("corner-cap", (0.022, 0.022, 0.006),
                      (tx + x, side * (td / 2 - 0.007), th + 0.062), STONE))
    B.add(box("tank-lid", (tw - 0.014, td - 0.016, 0.004),
              (tx, 0, th + 0.055), IRON))
    for x in (x0 + 0.015, x1 - 0.008):
        downpipe(B, x, -d / 2 - 0.004, hw)
    W.carve(B)
    finish_mill(B, r)
    return r


@asset
def mill_small(name):
    """A compact two-floor weaving works with a north-light saw roof.
    The roof glazing is structural, the loading bay has its own pitched
    hoist hood, and every side retains proper window depth."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.392, 0.254, 0.283, 0.101
    B.body(K.body("weaving-hall", w, d, hw, mat=BRICK,
                  edge=0.065, bevel=0.001))
    B.add(box("base", (w + 0.006, d + 0.006, 0.021), (0, 0, 0.009), GRIT))
    wm = walls(0, 0, w, d)
    us = [-w / 2 + w / 4 * (i + 0.5) for i in range(4)]
    for side in ("front", "back"):
        wall = wm[side]
        mill_piers(B, wall, w, 4, hw - 0.008)
        for i, u in enumerate(us):
            for k, z in enumerate((0.04, 0.16)):
                if side == "front" and i == 1:
                    plank_door(B, wall, u, 0.055, 0.091, GREEN,
                               z0=0 if k == 0 else z - 0.004,
                               arch="segment", braces=False)
                    arch_ring(B, wall, u, 0.055, 0.091, "segment",
                              0.006, BRICK_DK, z0=0 if k == 0 else z - 0.004)
                else:
                    mill_window(B, wall, u, z, 0.057, 0.091)
    for side in ("left", "right"):
        for u in (-0.067, 0.067):
            for z in (0.04, 0.16):
                mill_window(B, wm[side], u, z, 0.059, 0.091)
    cornice(B, 0, 0, w, d, hw - 0.002, 0.008, STONE, out=0.003)
    # Two north-light ridges. Strong asymmetry distinguishes a weaving shed
    # even when only the roof can be read in the near-plan phone view.
    prof = W.sawtooth(B, -w / 2, w / 2, -d / 2, d / 2,
                     hw, rise, 2, SLATE, GLASS, FRAME, over=0.004)
    for yy in (-d / 2 + 0.003, d / 2 - 0.003):
        for i in range(2):
            xa, xb = -w / 2 + w / 2 * i, -w / 2 + w / 2 * (i + 1)
            B.add(prism_xz("saw-gable", [(xa, hw), (xb, hw),
                                         (xb, hw + rise)],
                           yy - 0.003, yy + 0.003, BRICK))
            B.add(beam("gable-coping", (xa, yy, hw + 0.004),
                       (xb, yy, hw + rise + 0.004), (0.005, 0.008), STONE))
    # Tall hoist lucam occupies a complete front bay, no floating crate.
    lu, ly = us[1], -d / 2 - 0.006
    B.add(box("hoist-bay", (0.072, 0.018, 0.153),
              (lu, ly, 0.273), BRICK_DK))
    hf = walls(lu, ly, 0.072, 0.018)["front"]
    plank_door(B, hf, 0, 0.044, 0.07, GREEN, z0=0.233, braces=False)
    W.roof(B, lu, ly, 0.077, 0.024, 0.349, 0.031, SLATE,
           ridge="y", over=0.003, over_gable=0.001, ridge_mat=SLATE_DK)
    cathead(B, hf, 0, 0.338, reach=0.008)
    for x in (-w / 2 + 0.012, w / 2 - 0.012):
        downpipe(B, x, -d / 2 - 0.004, hw)
    W.carve(B)
    finish_mill(B, r)
    return r


@asset
def warehouse_rail(name):
    """A two-storey railway warehouse: two stacks of loading doors, each
    under a gabled hoist lucarne with its beam, a timber canopy on iron
    brackets over a stone loading bank on the rail side."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.408, 0.196, 0.26, 0.065
    cy = 0.03
    B.body(K.body("walls", w, d, hw, rise, "x", centre=(0, cy), mat=BRICK,
                  edge=0.2))
    B.add(box("plinth", (w + 0.006, d + 0.006, 0.02), (0, cy, 0.0085),
              BLUE))
    Wm = walls(0, cy, w, d)
    f, bk = Wm["front"], Wm["back"]
    yb = cy - d / 2
    # Loading bank.
    bank_d = 0.066
    B.add(gbox("bank", (w + 0.004, bank_d, 0.04), (0, yb - bank_d / 2 + 0.002,
                                                   0.018), BLUE, edge=0.2))
    B.add(box("bankedge", (w + 0.006, 0.012, 0.006),
              (0, yb - bank_d + 0.006, 0.041), GRIT))
    B.add(box("banktop", (w + 0.004, bank_d - 0.01, 0.004),
              (0, yb - bank_d / 2 + 0.006, 0.0395), FLAGS))
    door_us = (-0.105, 0.105)
    for u in door_us:
        plank_door(B, f, u, 0.05, 0.072, MAROON, z0=0.04)
        B.add(f.put(box("lintel", (0.06, 0.005, 0.008),
                        (u, -0.002, 0.116), STONE)))
        plank_door(B, f, u, 0.04, 0.072, MAROON, z0=0.148)
        B.add(f.put(box("lintel", (0.05, 0.005, 0.007), (u, -0.002, 0.223),
                        STONE)))
    for u in (-0.175, 0.0, 0.175):
        for z in (0.05, 0.154):
            win(B, f, u, z, 0.03, 0.055, arch="segment", bars="cross")
    for u in (-0.15, -0.075, 0.0, 0.075, 0.15):
        for z in (0.03, 0.154):
            win(B, bk, u, z, 0.03, 0.055, arch="segment", bars="cross",
                flush=True)
    for side in ("left", "right"):
        for u in (-0.05, 0.05):
            for z in (0.03, 0.154):
                win(B, Wm[side], u, z, 0.03, 0.055, arch="segment",
                    bars="cross", flush=True)
        win(B, Wm[side], 0.0, hw + 0.012, 0.03, 0.03, arch="round", bars=None)
    sill_band(B, f, -w / 2, w / 2, 0.135, STONE, h=0.006)
    sill_band(B, bk, -w / 2, w / 2, 0.135, STONE, h=0.006)
    cornice(B, 0, cy, w, d, hw - 0.004, 0.008, STONE, out=0.003)
    W.roof(B, 0, cy, w, d, hw, rise, SLATE, over=0.008, over_gable=0.005,
           ridge_mat=SLATE_DK, gutter=ZINC)
    # Hoist lucarnes: little gabled wall dormers over each door stack.
    for u in door_us:
        lw, ld = 0.064, 0.05
        lyc = yb + ld / 2 - 0.004
        B.body(K.body("luc", lw, ld, hw + 0.05, 0.03, "y",
                      centre=(u, lyc), mat=BRICK, edge=0.2))
        plank_door(B, f, u, 0.036, 0.05, MAROON, z0=hw - 0.004)
        rl = Build("tmp")
        W.roof(rl, 0, 0, lw, ld + 0.01, hw + 0.05, 0.03, SLATE, ridge="y",
               over=0.005, over_gable=0.004, ridge_mat=SLATE_DK)
        for o, uv in rl.parts:
            tf(o, T(u, lyc - 0.004))
            B.add(o, uv)
        cathead(B, f, u, hw + 0.064, reach=0.03)
    # Canopy over the bank: boarded, on iron brackets, a valance.
    cz0, cz1 = 0.13, 0.118
    cy0, cy1 = yb, yb - bank_d + 0.002
    L = w + 0.002
    B.add(box("canopy", (L, cy0 - cy1 + 0.002, 0.004), (0, 0, 0), WEATHER))
    tf(B.parts[-1][0], T(0, (cy0 + cy1) / 2, (cz0 + cz1) / 2) @
       rot("X", -math.degrees(math.atan2(cz0 - cz1, cy0 - cy1))))
    valance(B, (-L / 2, cy1 + 0.001, cz1 - 0.001), (L / 2, cy1 + 0.001,
                                                    cz1 - 0.001),
            0.012, PLANK, teeth=14)
    for x in (-0.19, -0.105, 0.0, 0.105, 0.19):
        B.add(beam("bracket", (x, cy0 - 0.001, cz0 - 0.04),
                   (x, cy1 + 0.012, cz1 - 0.003), (0.0025, 0.0025), IRON))
        B.add(box("bkarm", (0.0025, cy0 - cy1 - 0.01, 0.0025),
                  (x, (cy0 + cy1) / 2 + 0.004, cz1 + 0.002), IRON))
    crate_stack(B, -0.03, yb - 0.03, 2, 0.016, 8, seed=3)
    sacks(B, 0.04, yb - 0.028, 3, z0=0.041, seed=5)
    barrel(B, 0.175, yb - 0.03, z0=0.04, mat=PLANK, hoop=IRON)
    for x in (-w / 2 + 0.006, w / 2 - 0.006):
        downpipe(B, x, yb - 0.003, hw)
    W.carve(B)
    B.finish(r)
    return r


@asset
def works_shed(name):
    """A single-storey engineering shed under a north-light sawtooth roof
    (the teeth show on the front gable), a big boarded door, side
    windows and a stove pipe."""
    r = root(name)
    B = Build(name)
    x0, x1, y0, y1 = -0.146, 0.146, -0.114, 0.114
    hw, rise, teeth = 0.128, 0.064, 4
    prof = []
    tw = (x1 - x0) / teeth
    for i in range(teeth):
        xa, xb = x0 + i * tw, x0 + (i + 1) * tw
        if i == 0:
            prof.append((xa, hw))
        prof += [(xb - 0.0001 if i < teeth - 1 else xb, hw + rise)]
        if i < teeth - 1:
            prof.append((xb, hw))
    poly = [(x1, -0.003), (x1, hw + rise)] + \
        [p for p in reversed(prof) if p[0] < x1 - 1e-4] + [(x0, -0.003)]
    body = prism_xz("walls", poly, y0, y1, BRICK)
    kit.add_bevel(body, 0.0012, 1, angle=50)
    B.body(body)
    B.add(box("plinth", (x1 - x0 + 0.006, y1 - y0 + 0.006, 0.02),
              (0, 0, 0.0085), BLUE))
    W.sawtooth(B, x0, x1, y0, y1, hw, rise, teeth, SLATE, GLASS, FRAME)
    # Copings along the saw on both gables.
    for y in (y0 - 0.001, y1 + 0.001):
        for i in range(teeth):
            xa, xb = x0 + i * tw, x0 + (i + 1) * tw
            B.add(beam("cope", (xa - 0.002, y, hw + 0.002),
                       (xb + 0.001, y, hw + rise + 0.003), (0.008, 0.006),
                       STONE, up=Vector((0, 0, 1))))
            B.add(box("copev", (0.006, 0.008, rise), (xb, y, hw + rise / 2 +
                                                      0.002), STONE)
                  if i < teeth - 1 else box("copev", (0.006, 0.008, 0.004),
                                            (xb, y, hw + rise), STONE))
    Wm = walls(0, 0, x1 - x0, y1 - y0)
    f = Wm["front"]
    plank_door(B, f, -0.04, 0.08, 0.098, GREEN, arch="segment")
    arch_ring(B, f, -0.04, 0.08, 0.098, "segment", 0.008, STONE)
    win(B, f, 0.07, 0.04, 0.05, 0.06, arch="segment", bars="grid")
    for i in range(teeth):
        xm = x0 + (i + 0.62) * tw
        win(B, f, xm, hw + 0.012, 0.022, 0.022, arch="round", bars=None)
    for side in ("left", "right"):
        for u in (-0.06, 0.0, 0.06):
            win(B, Wm[side], u, 0.04, 0.042, 0.06, arch="segment",
                bars="grid", flush=True)
    for u in (-0.09, 0.0, 0.09):
        win(B, Wm["back"], u, 0.04, 0.042, 0.06, arch="segment", bars="grid",
            flush=True)
    sill_band(B, f, -0.146, 0.146, 0.11, STONE)
    # Stove pipe through the second valley.
    B.add(cyl("stove", 0.005, 0.005, 0.08, (x0 + 2 * tw - 0.008, 0.05,
                                           hw + 0.01), 6, IRON))
    B.add(cyl("stovecap", 0.009, 0.004, 0.006,
              (x0 + 2 * tw - 0.008, 0.05, hw + 0.09), 6, IRON))
    for x in (x0 + tw, x0 + 3 * tw):
        downpipe(B, x, y0 - 0.003, hw)
    W.carve(B)
    B.finish(r)
    return r


@asset
def coal_drops(name):
    """Coal drops: a raised stone staithe with arched cells, timber
    hoppers on its deck feeding iron chutes into three stone-walled coal
    bays open to the rail."""
    r = root(name)
    B = Build(name)
    w = 0.296
    sy0, sy1, sh = 0.012, 0.076, 0.072
    B.body(gbox("staithe", (w, sy1 - sy0, sh + 0.003),
                (0, (sy0 + sy1) / 2, sh / 2 - 0.0015), GRIT_DK, edge=0.1,
                bevel=0.001))
    face = K.Wall((0, sy0, 0), (0, -1, 0))
    for u in (-0.098, 0.0, 0.098):
        opening(B, face, u, 0.05, 0.05, arch="segment", depth=0.03)
        arch_ring(B, face, u, 0.05, 0.05, "segment", 0.007, STONE)
    B.add(box("deckcope", (w + 0.004, sy1 - sy0 + 0.004, 0.006),
              (0, (sy0 + sy1) / 2, sh + 0.002), STONE))
    # Hoppers on the deck and their chutes.
    for u in (-0.098, 0.0, 0.098):
        hp = prism_xz("hopper", [(0.024, sh + 0.004), (0.024, sh + 0.04),
                                 (-0.024, sh + 0.04), (-0.024, sh + 0.004)],
                      sy0 + 0.006, sy1 - 0.008, PLANK)
        tf(hp, T(u))
        B.add(hp)
        B.add(box("hrim", (0.052, sy1 - sy0 - 0.01, 0.004),
                  (u, (sy0 + sy1) / 2 - 0.001, sh + 0.041), TIMBER))
        B.add(box("hcoal", (0.044, sy1 - sy0 - 0.02, 0.004),
                  (u, (sy0 + sy1) / 2 - 0.001, sh + 0.038), COAL))
        B.add(beam("chute", (u, sy0 + 0.004, sh + 0.012),
                   (u, sy0 - 0.044, 0.036), (0.022, 0.003), IRON,
                   up=Vector((0, 0, 1))))
        for k in (-1, 1):
            B.add(beam("chside", (u + k * 0.011, sy0 + 0.004, sh + 0.016),
                       (u + k * 0.011, sy0 - 0.044, 0.04), (0.002, 0.008),
                       IRON, up=Vector((0, 0, 1))))
    for x in (-0.13, 0.13):
        B.add(box("post", (0.006, 0.006, 0.04), (x, sy1 - 0.008, sh + 0.02),
                  TIMBER))
    B.add(box("rail", (0.27, 0.004, 0.004), (0, sy1 - 0.008, sh + 0.04),
              TIMBER))
    # Bay walls and the coal.
    for x in (-0.146, -0.049, 0.049, 0.146):
        wx = 0.008
        xx = max(-0.144, min(0.144, x))
        B.add(box("baywall", (wx, 0.07, 0.042), (xx, sy0 - 0.035, 0.019),
                  GRIT_DK))
        B.add(box("baycope", (wx + 0.003, 0.072, 0.004),
                  (xx, sy0 - 0.035, 0.041), STONE))
    rnd = random.Random(4)
    for u, hh in ((-0.098, 0.04), (0.0, 0.028), (0.098, 0.046)):
        o = lathe("heap", [(0.046, -0.003), (0.04, 0.006), (0.024, hh * 0.6),
                           (0.008, hh), (0.0, hh + 0.002)], (0, 0, 0), 9,
                  COAL, close=False)
        for v in o.data.vertices:
            if v.co.z > 0.0:
                v.co.x += rnd.uniform(-0.003, 0.003)
                v.co.y += rnd.uniform(-0.003, 0.003)
                v.co.z += rnd.uniform(-0.002, 0.002)
        tf(o, T(u, sy0 - 0.032, 0.0) @ rot("Z", rnd.uniform(0, 40)) @
           T(0, 0, 0))
        for v in o.data.vertices:
            v.co.y = max(v.co.y, sy0 - 0.076)
        B.add(o)
        for j in range(3):
            lump = box("lump", (0.006, 0.005, 0.004), (0, 0, 0), COAL_LIT)
            tf(lump, T(u + rnd.uniform(-0.03, 0.03), sy0 - 0.068 +
                       rnd.uniform(-0.004, 0.004), 0.002) @
               rot("Z", rnd.uniform(0, 90)))
            B.add(lump)
    # A coal merchant's sacks and a weighing machine.
    sacks(B, 0.128, -0.07, 2, seed=8)
    B.add(box("scale", (0.016, 0.012, 0.012), (-0.128, -0.068, 0.006), IRON))
    B.add(box("scalepost", (0.003, 0.003, 0.02), (-0.128, -0.064, 0.022),
              IRON))
    W.carve(B)
    B.finish(r)
    return r


@asset
def engine_shed(name):
    """A two-road engine shed: twin slate gables to the front, each over a
    tall arched doorway, louvred smoke vents along both ridges, arched
    windows down the sides between pilasters."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.444, 0.288, 0.158, 0.056
    hx = w / 2
    poly = [(hx, -0.003), (hx, hw), (hx / 2, hw + rise), (0.0, hw),
            (-hx / 2, hw + rise), (-hx, hw), (-hx, -0.003)]
    body = prism_xz("walls", poly, -d / 2, d / 2, BRICK_DK)
    kit.add_bevel(body, 0.0012, 1, angle=50)
    B.body(body)
    B.add(box("plinth", (w + 0.006, d + 0.006, 0.018), (0, 0, 0.0075), BLUE))
    Wm = walls(0, 0, w, d)
    f = Wm["front"]
    for u in (-hx / 2, hx / 2):
        opening(B, f, u, 0.104, 0.158, arch="round", depth=0.05, n=10)
        arch_ring(B, f, u, 0.104, 0.158, "round", 0.012, STONE, n=10)
        win(B, f, u, hw + 0.012, 0.03, 0.03, arch="round", bars=None)
        # Rails running in.
        for k in (-1, 1):
            B.add(box("rail", (0.004, 0.06, 0.006), (u + k * 0.045,
                                                     -d / 2 + 0.024, 0.003),
                      IRON))
    for k in (-1, 0, 1):
        B.add(box("pilf", (0.016, 0.006, hw - 0.01),
                  (k * hx * (0.97 if k else 1) if k else 0.0, -d / 2 - 0.003,
                   (hw - 0.01) / 2), BRICK_DK))
    # Gable copings.
    for y in (-d / 2 - 0.002, d / 2 + 0.002):
        for xa, xb in ((-hx, -hx / 2), (0.0, -hx / 2), (0.0, hx / 2),
                       (hx, hx / 2)):
            B.add(beam("cope", (xa, y, hw + 0.001), (xb, y, hw + rise + 0.002),
                       (0.008, 0.006), STONE, up=Vector((0, 0, 1))))
    for side in ("left", "right"):
        for i, u in enumerate((-0.105, -0.035, 0.035, 0.105)):
            win(B, Wm[side], u, 0.04, 0.036, 0.1, arch="round", bars="grid",
                flush=True)
        for u in (-0.14, -0.07, 0.0, 0.07, 0.14):
            B.add(Wm[side].put(box("pil", (0.01, 0.005, hw - 0.006),
                                   (u, -0.0025, (hw - 0.006) / 2), BRICK_DK)))
    for u in (-hx / 2, hx / 2):
        win(B, Wm["back"], u, 0.05, 0.05, 0.09, arch="round", bars="grid",
            flush=True)
    for cx in (-hx / 2, hx / 2):
        W.roof(B, cx, 0, hx, d, hw, rise, SLATE, ridge="y", over=0.006,
               over_gable=0.006, ridge_mat=None, gutter=None)
        # A louvred smoke vent along the ridge.
        vz = hw + rise - 0.004
        vh = 0.03
        B.add(box("vent", (0.036, d - 0.06, vh), (cx, 0, vz + vh / 2),
                  TIMBER))
        for k in range(2):
            B.add(box("louvre", (0.038, d - 0.064, 0.003),
                      (cx, 0, vz + 0.009 + k * 0.009), WEATHER))
        cap = Build("tmp")
        W.roof(cap, 0, 0, 0.036, d - 0.06, 0.0, 0.011, SLATE_DK, ridge="y",
               over=0.007, over_gable=0.004, thick=0.004)
        for o, uv in cap.parts:
            tf(o, T(cx, 0, vz + vh))
            B.add(o, uv)
        # Smoke stacks over the stalls.
        for y in (0.07,):
            B.add(cyl("smoke", 0.008, 0.008, 0.05, (cx + 0.035, y,
                                                   hw + rise * 0.3), 8,
                      IRON, cap=False))
            B.add(cyl("smcap", 0.012, 0.008, 0.005,
                      (cx + 0.035, y, hw + rise * 0.3 + 0.05), 8, IRON))
    B.add(box("valley", (0.008, d + 0.01, 0.004), (0, 0, hw + 0.002), ZINC))
    for x in (-hx + 0.006, 0.0, hx - 0.006):
        downpipe(B, x, -d / 2 - 0.004, hw)
    W.carve(B)
    B.finish(r)
    return r


@asset
def water_tower(name):
    """A riveted iron tank on a brick tower with arched panels, a stone
    cornice, a ladder, a delivery arm and a pyramid lid."""
    r = root(name)
    B = Build(name)
    s, bh = 0.094, 0.19
    B.body(K.body("base", s, s, bh, mat=BRICK, edge=0.2))
    B.add(box("plinth", (s + 0.006, s + 0.006, 0.02), (0, 0, 0.0085), BLUE))
    Wm = walls(0, 0, s, s)
    K.door(B, Wm["front"], 0.0, 0.03, 0.062, GREEN, STONE, arch="segment",
           step=GRIT, panels=False, knob=None, fb=0.004)
    for side in ("left", "right", "back"):
        win(B, Wm[side], 0.0, 0.05, 0.026, 0.056, arch="round",
            bars="mullion")
    for side in ("front", "left", "right", "back"):
        win(B, Wm[side], 0.0, 0.12, 0.022, 0.044, arch="round", bars=None)
    B.add(box("corn", (s + 0.01, s + 0.01, 0.01), (0, 0, bh + 0.002), STONE,
              bevel=0.001))
    for y in (-0.03, 0.03):
        B.add(box("bearer", (0.116, 0.008, 0.008), (0, y, bh + 0.011), IRON))
    tz0, tz1 = bh + 0.015, bh + 0.1
    ts = 0.116
    B.add(gbox("tank", (ts, ts, tz1 - tz0), (0, 0, (tz0 + tz1) / 2), TANK,
               edge=0.06, bevel=0.0008))
    for z in (tz0 + 0.028, tz0 + 0.057):
        B.add(box("flange", (ts + 0.003, ts + 0.003, 0.0025), (0, 0, z),
                  TANK))
    for k in (-1, 1):
        for ax in ("x", "y"):
            sz = (0.0025, ts + 0.003, tz1 - tz0) if ax == "x" else \
                (ts + 0.003, 0.0025, tz1 - tz0)
            c = (k * 0.02, 0, (tz0 + tz1) / 2) if ax == "x" else \
                (0, k * 0.02, (tz0 + tz1) / 2)
            B.add(box("rib", sz, c, TANK))
    B.add(box("rim", (ts + 0.004, ts + 0.004, 0.004), (0, 0, tz1), IRON))
    lid = Build("tmp")
    W.hip(lid, 0, 0, ts, ts, 0.0, 0.016, SLATE_DK, over=0.003, thick=0.003)
    for o, uv in lid.parts:
        tf(o, T(0, 0, tz1 + 0.002))
        B.add(o, uv)
    B.add(cyl("vent", 0.005, 0.005, 0.012, (0, 0, tz1 + 0.012), 6, IRON))
    B.add(cyl("ventcap", 0.008, 0.002, 0.005, (0, 0, tz1 + 0.024), 6, IRON))
    # Ladder up the right side.
    lx = s / 2 + 0.0035
    for k in (-1, 1):
        B.add(box("lrail", (0.002, 0.002, tz1 - 0.02), (lx, k * 0.008,
                                                        (tz1 - 0.02) / 2 +
                                                        0.02), IRON))
    for i in range(8):
        B.add(box("rung", (0.0015, 0.016, 0.0015),
                  (lx, 0, 0.04 + i * (tz1 - 0.06) / 7), IRON))
    # Delivery arm and hose on the front.
    B.add(cyl("pipe", 0.004, 0.004, 0.024, (0.025, -0.051, tz0 - 0.022), 6,
              IRON))
    B.add(beam("arm", (0.025, -0.051, tz0 - 0.018), (-0.03, -0.054,
                                                       tz0 - 0.024),
               (0.007, 0.007), IRON))
    B.add(cyl("hose", 0.0035, 0.003, 0.09, (-0.03, -0.054, tz0 - 0.115), 6,
              "rubber:hose"))
    W.carve(B)
    B.finish(r)
    return r


@asset
def chimney(name):
    """A 25 m circular stack with a square base and corbelled brick crown."""
    r = root(name)
    B = Build(name)
    build_chimney(B, 0, 0)
    W.carve(B)
    finish_mill(B, r)
    return r


@asset
def gasholder(name):
    """A two-lift gasholder: an iron bell half risen in its water tank,
    inside a guide frame of twelve iron columns tied by two girder rings
    and lattice bracing."""
    r = root(name)
    B = Build(name)
    n = 12
    R = 0.198
    # Tank wall and the two lifts of the bell.
    B.add(lathe("tank", [(0.19, -0.003), (0.19, 0.024), (0.184, 0.024),
                         (0.184, 0.012)], (0, 0, 0), 24, BRICK_DK,
                close=False), uv=("cyl", (0, 0)))
    B.add(cyl("tcope", 0.192, 0.192, 0.005, (0, 0, 0.022), 24, STONE,
              cap=False))
    B.add(lathe("lift1", [(0.181, 0.01), (0.181, 0.11), (0.184, 0.112),
                          (0.184, 0.118), (0.172, 0.118)], (0, 0, 0), 24,
                "metal:bell", close=False), uv=("cyl", (0, 0)))
    crown = [(0.17, 0.116), (0.17, 0.2), (0.164, 0.206)]
    for i in range(1, 4):
        t = i / 3
        crown.append((0.164 * (1 - t) ** 0.8 + 0.001, 0.206 + 0.026 *
                      math.sin(t * math.pi / 2)))
    crown.append((0.0, 0.232))
    B.add(lathe("lift2", crown, (0, 0, 0), 24, "metal:bell", close=False),
          uv=("cyl", (0, 0)))
    B.add(cyl("cup", 0.1715, 0.1715, 0.005, (0, 0, 0.198), 24, IRON,
              cap=False))
    # Guide columns, girders and bracing.
    H = 0.296
    for i in range(n):
        a = math.tau * i / n
        x, y = math.cos(a) * R, math.sin(a) * R
        B.add(cyl("col", 0.0065, 0.0055, H, (x, y, 0.0), 6, OXIDE, rings=1,
                  cap=False))
        B.add(box("cbase", (0.016, 0.016, 0.012), (x, y, 0.024), STONE))
        B.add(box("ccap", (0.016, 0.016, 0.006), (x, y, H + 0.003), OXIDE))
        # Roller carriage from the bell's crown to the column.
        B.add(beam("roller", (math.cos(a) * 0.168, math.sin(a) * 0.168,
                              0.204),
                   (math.cos(a) * (R - 0.006), math.sin(a) * (R - 0.006),
                    0.204), (0.004, 0.004), IRON))
    for z, h in ((0.15, 0.008), (H - 0.006, 0.01)):
        B.add(ring("girder", R, 0.003, z, (0, 0), n, OXIDE, h=h))
    for i in range(n):
        a0, a1 = math.tau * i / n, math.tau * (i + 1) / n
        p0 = Vector((math.cos(a0) * R, math.sin(a0) * R, 0))
        p1 = Vector((math.cos(a1) * R, math.sin(a1) * R, 0))
        for za, zb in ((0.154, H - 0.012),):
            B.add(beam("brace", p0 + Vector((0, 0, za)),
                       p1 + Vector((0, 0, zb)), (0.0022, 0.0022), OXIDE))
            B.add(beam("brace", p1 + Vector((0, 0, za)),
                       p0 + Vector((0, 0, zb)), (0.0022, 0.0022), OXIDE))
    # A stair up one column.
    B.add(beam("stair", (0.13, -0.158, -0.002), (0.062, -0.188, 0.146),
               (0.012, 0.003), IRON))
    W.carve(B)
    B.finish(r)
    return r


@asset
def yard_crane(name):
    """A hand-worked yard crane: an iron post on a stone block, an iron
    jib reaching over the track to 0.36, a winch with handles, a tie rod,
    a counterweight and a hanging hook."""
    r = root(name)
    B = Build(name)
    B.add(gbox("block", (0.12, 0.12, 0.03), (0, 0, 0.012), GRIT, edge=0,
               bevel=0.002))
    B.add(box("pad", (0.07, 0.07, 0.006), (0, 0, 0.029), IRON))
    B.add(cyl("post", 0.008, 0.006, 0.17, (0, 0, 0.03), 8, IRON))
    for k in (-1, 1):
        cheek = box("cheekp", (0.003, 0.05, 0.08), (k * 0.013, 0.008, 0.09),
                    OXIDE)
        B.add(cheek)
        B.add(beam("jib", (k * 0.008, 0.005, 0.045),
                   (k * 0.004, -0.17, 0.355), (0.006, 0.006), OXIDE))
        B.add(box("handle", (0.004, 0.014, 0.003), (k * 0.019, 0.02, 0.1),
                  IRON))
    for t in (0.33, 0.66):
        p = Vector((0, 0.005, 0.045)).lerp(Vector((0, -0.17, 0.355)), t)
        B.add(box("strut", (0.018 - t * 0.008, 0.003, 0.003), p, OXIDE))
    B.add(cyl("drum", 0.009, 0.009, 0.024, (0, 0.02, 0.1), 8, IRON,
              axis="x"))
    B.add(box("weight", (0.04, 0.024, 0.03), (0, 0.04, 0.16), IRON,
              bevel=0.002))
    B.add(beam("tie", (0, 0.03, 0.2), (0, -0.17, 0.358), (0.0025, 0.0025),
               IRON))
    B.add(cyl("sheave", 0.006, 0.006, 0.004, (0, -0.172, 0.352), 8, IRON,
              axis="x"))
    B.add(cyl("chain", 0.0009, 0.0009, 0.12, (0, -0.178, 0.23), 4, IRON))
    B.add(box("hook", (0.006, 0.004, 0.01), (0, -0.178, 0.225), IRON))
    W.carve(B)
    B.finish(r)
    return r


# ---------------------------------------------------------------- stations
# Passenger stations (8 October 2026). A station square holds a booking
# hall on a square platform-level bank (top z = 0.056) over the whole
# footprint (half = 0.20 or 0.25), with an open doorway on every face for
# passengers to walk into, and a canopy all round. Each side the square is
# served from takes a per-side prop, built on the -Y side of the square's
# centre between y = -0.5 and y = -half (the game turns it to face the
# side): two side platforms and a buffer stop for a rail, a flight of
# steps up from the street for a road.

BANK_TOP = 0.056
DOOR_W, DOOR_H = 0.044, 0.086
FACES = ("front", "right", "back", "left")
SBRICK = "brick:station"
CANOPY = "wood:canopy"
VALANCE = "paint:valance"
MAROON_IRON = "paint:station-iron"
EDGE = "paint:edge-white"
STEP = "stone:step"
CLOCK = "paint:clockface"
LAMP_POST = "paint:lamp-green"
BUFRED = "paint:buffer-red"
STOP = "glow:stop"
CANOPY_GLASS = "glass:shed"
LEAD = "metal:lead"
GILT = "paint:gilt"
STEEL = "metal:steel"


def _ring(B, wall, u, w, h, arch, t, mat, proud=0.003, n=8, z0=0.0):
    """A dressed stone ring round an opening, lean: its face, its outer
    edge and its inner reveal edge (the back stays buried in the wall)."""
    inner = [(x + u, z0 + z) for x, z in outline(w, h, arch, n)]
    outer = [(x + u, z0 + z) for x, z in K.offset_outline(w, h, arch, t, n)]
    m = len(inner)
    y0, y1 = -proud, 0.002
    verts = [(x, y0, z) for x, z in inner] + [(x, y0, z) for x, z in outer] + \
        [(x, y1, z) for x, z in inner] + [(x, y1, z) for x, z in outer]
    faces = []
    for i in range(m - 1):
        a, b = i, i + 1
        faces.append([a, b, m + b, m + a])                  # face
        faces.append([2 * m + b, 2 * m + a, a, b])          # inner reveal
        faces.append([m + a, m + b, 3 * m + b, 3 * m + a])  # outer edge
    for a in (0, m - 1):
        faces.append([a, m + a, 3 * m + a, 2 * m + a])      # feet
    o = mesh("ring", verts, faces, mat)
    B.add(wall.put(o))


def _bank(B, half, top=BANK_TOP):
    """The square platform-level bank: blue-brick faces, a pale stone
    coping flush with the footprint carrying a white-painted edge line,
    and a flagged top."""
    cw, ch = 0.014, 0.006
    s = 2 * half
    B.add(gbox("bank", (s - 0.006, s - 0.006, top - ch + 0.003),
               (0, 0, (top - ch - 0.003) / 2), BLUE, edge=0.1))
    z = top - ch / 2
    for k in (-1, 1):
        B.add(gbox("cope", (s, cw, ch), (0, k * (half - cw / 2), z), PALE,
                   edge=0.1))
        B.add(gbox("cope", (cw, s - 2 * cw, ch), (k * (half - cw / 2), 0, z),
                   PALE, edge=0.1))
        B.add(box("edge", (s, 0.003, 0.0005), (0, k * (half - 0.002),
                                              top + 0.00025), EDGE))
        B.add(box("edge", (0.003, s - 0.008, 0.0005),
                  (k * (half - 0.002), 0, top + 0.00025), EDGE))
    B.add(gbox("flags", (s - 2 * cw, s - 2 * cw, ch - 0.0003),
               (0, 0, top - (ch + 0.0003) / 2), FLAGS, edge=0.1))


def _doorway(B, wall, z0=BANK_TOP, w=DOOR_W, h=DOOR_H, depth=0.018,
             dress=STONE, n=8, ring=0.0075):
    """An open round-headed doorway: carved `depth` into the wall with its
    reveals, soffit and floor dark (the hall inside, where passengers
    vanish), a stone architrave with a keystone, a threshold stone."""
    pts = [(x, z0 + z) for x, z in outline(w, h, "round", n)]
    B.cut(wall.put(prism_xz("cut", pts, -0.02, depth, VOID)))
    _ring(B, wall, 0.0, w, h, "round", ring, dress, proud=0.003, n=n, z0=z0)
    B.add(wall.put(box("key", (0.009, 0.006, 0.013),
                       (0, -0.0033, z0 + h + 0.0045), dress)))
    B.add(wall.put(box("threshold", (w + 0.012, 0.012, 0.0008),
                       (0, -0.002, z0 + 0.0003), dress)))


def _quoins(B, c, z0, z1, mat, course=0.016, long=0.03, short=0.017,
            proud=0.0018):
    """Dressed quoins up the four corners of a square block (half c):
    long and short stones alternating face to face."""
    n = max(1, round((z1 - z0) / course))
    hq = (z1 - z0) / n
    for sx in (-1, 1):
        for sy in (-1, 1):
            for k in range(n):
                lx, ly = (long, short) if (k + (sx * sy > 0)) % 2 else \
                    (short, long)
                B.add(box("quoin", (lx, ly, hq - 0.0018),
                          (sx * (c + proud - lx / 2), sy * (c + proud - ly / 2),
                           z0 + hq * (k + 0.5)), mat))


def _arched(B, wall, u, z0, w, h, dress=STONE, ring=0.0055, glass=GLASS):
    """A tall round-headed sash window: carved reveal, glass, glazing
    bars, a stone sill, a dressed stone arch ring and keystone."""
    win(B, wall, u, z0, w, h, arch="round", bars="grid", n=6, glass=glass)
    _ring(B, wall, u, w, h, "round", ring, dress, proud=0.0025, n=6, z0=z0)
    B.add(wall.put(box("key", (0.0065, 0.0045, 0.009),
                       (u, -0.0026, z0 + h + 0.003), dress)))
    B.add(wall.put(box("sill", (w + 0.012, 0.008, 0.004),
                       (u, -0.003, z0 - 0.002), dress)))


def _lantern(B, x, y, z, s=0.008, glow=LAMP, frame=MAROON_IRON):
    """A square gas lantern, its glass glowing (z is its base)."""
    g = cyl("lglass", s * 0.42, s * 0.62, s * 1.1, (x, y, z), 4, glow)
    tf(g, T(x, y) @ rot("Z", 45) @ T(-x, -y))
    B.add(g)
    cap = cyl("lcap", s * 0.78, 0.0006, s * 0.55, (x, y, z + s * 1.1), 4,
              frame)
    tf(cap, T(x, y) @ rot("Z", 45) @ T(-x, -y))
    B.add(cap)
    B.add(box("lbot", (s * 0.6, s * 0.6, s * 0.16), (x, y, z - s * 0.06),
              frame))


def _lamp_standard(B, x, y, z0, h=0.11, s=0.009, mat=LAMP_POST):
    """A cast-iron gas lamp standard: base, fluted column, ladder bar and
    a glowing lantern."""
    B.add(lathe("lbase", [(0.0045, z0 - 0.002), (0.0045, z0 + 0.005),
                          (0.0032, z0 + 0.01), (0.0022, z0 + 0.013),
                          (0.0, z0 + 0.013)], (x, y, 0), 6, mat))
    B.add(cyl("lcol", 0.0019, 0.0014, h - 0.01, (x, y, z0 + 0.01), 6, mat))
    B.add(box("lbar", (0.009, 0.0013, 0.0013), (x, y, z0 + h - 0.008), mat))
    _lantern(B, x, y, z0 + h, s, frame=mat)


def _hanging_lamp(B, x, y, z_top, drop=0.016, s=0.0085):
    B.add(cyl("lrod", 0.0006, 0.0006, drop, (x, y, z_top - drop), 4,
              MAROON_IRON))
    _lantern(B, x, y, z_top - drop - s * 1.6, s)


def _canopy(B, c, out, z_wall, z_edge, us, thick=0.003, bar=0.034):
    """A glazed canopy all round a square block: a hipped ring of glass
    from the wall (z_wall) down to its edge (z_edge) at `out`, iron
    glazing and hip bars, a maroon fascia over a cream saw-tooth valance,
    iron bearers and struts at `us` along each face and a gas lantern
    under the edge before each doorway."""
    _skirt(B, c - 0.002, out, z_wall, z_edge, CANOPY_GLASS, thick=thick)
    tw, te = z_wall + thick + 0.0005, z_edge + thick + 0.0005
    nb = max(2, round(2 * c / bar))
    for i in range(4):
        a = math.pi / 2 * i
        ca, sa = math.cos(a), math.sin(a)

        def P(u, v, z):
            return (ca * u - sa * v, sa * u + ca * v, z)

        for k in range(nb + 1):
            u = -c + 2 * c * k / nb
            q = [P(u - 0.0007, -c, tw), P(u - 0.0007, -out, te),
                 P(u + 0.0007, -out, te), P(u + 0.0007, -c, tw)]
            o = mesh("gbar", q, [[0, 1, 2, 3]], MAROON_IRON, fix=False)
            if o.data.polygons[0].normal.z < 0:
                o.data.polygons[0].flip()
            B.add(o)
        B.add(beam("hipbar", P(c, -c, tw), P(out, -out, te),
                   (0.0018, 0.0014), MAROON_IRON))
        B.add(beam("fascia", P(-out - 0.001, -out - 0.0008, z_edge + 0.0005),
                   P(out + 0.001, -out - 0.0008, z_edge + 0.0005),
                   (0.0016, thick + 0.004), MAROON_IRON,
                   up=Vector((0, 0, 1))))
        valance(B, P(-out - 0.001, -out - 0.0012, z_edge - 0.0012),
                P(out + 0.001, -out - 0.0012, z_edge - 0.0012), 0.011,
                VALANCE, teeth=max(6, round(2 * out / 0.03)))
        for u in us:
            B.add(beam("bearer", P(u, -c, z_wall - 0.0035),
                       P(u, -out + 0.006, z_edge - 0.0025), (0.0022, 0.0035),
                       MAROON_IRON))
            f = 0.62
            B.add(beam("strut", P(u, -c, z_wall - 0.036),
                       P(u, -c - (out - c) * f,
                         z_wall - 0.005 - (z_wall - z_edge) * f),
                       (0.0022, 0.0022), MAROON_IRON))
        v = -out + 0.02
        zt = z_edge + (z_wall - z_edge) * (out + v) / (out - c) - 0.001
        _hanging_lamp(B, *P(0.0, v, 0.0)[:2], zt, drop=0.002)


def _skirt(B, inner, outer, z_in, z_out, mat, thick=0.004):
    """A canopy roof running round a square block (hipped at the
    corners), `thick` thick, solidified upwards."""
    v = []
    for h, z in ((inner, z_in), (outer, z_out)):
        v += [(-h, -h, z), (h, -h, z), (h, h, z), (-h, h, z)]
    faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    o = mesh("skirt", v, faces, mat, fix=False)
    for p in o.data.polygons:
        p.flip()
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = 1
    kit.apply(o)
    B.add(o)


def _gutters(B, c, z, over, r=0.0028):
    L = 2 * (c + over) + 2 * r
    for k in (-1, 1):
        B.add(box("gutter", (L, 2 * r, 1.6 * r), (0, k * (c + over), z), ZINC))
        B.add(box("gutter", (2 * r, L - 4 * r, 1.6 * r), (k * (c + over), 0, z),
                  ZINC))


def _name_band(B, wall, z, w, n, mat=MAROON_IRON, u=0.0):
    """A painted name board on a wall (cream letters on the railway's
    colour) in a stone surround."""
    flat_box(B, wall, u, z, w + 0.008, 0.02, STONE, proud=0.002)
    flat_box(B, wall, u, z, w, 0.014, mat, proud=0.003)
    letters(B, wall, u, z, n, w - 0.012, 0.0075, mat=LETTER, gap=0.35)


def _stack(B, x, y, z0, z1, w=0.026, d=0.044, pots=2, mat=SBRICK):
    """A lean chimney stack: brick shaft, a two-step stone cap, pots."""
    B.add(box("stack", (w, d, z1 - z0), (x, y, (z0 + z1) / 2), mat))
    B.add(box("scap", (w + 0.005, d + 0.005, 0.004), (x, y, z1 - 0.004),
              STONE))
    B.add(box("scap2", (w + 0.002, d + 0.002, 0.003), (x, y, z1 - 0.0005),
              STONE))
    for i in range(pots):
        py = y + (i - (pots - 1) / 2) * (d / max(1, pots))
        B.add(cyl("pot", 0.0034, 0.0027, 0.011, (x, py, z1 + 0.001), 6,
                  "paint:pot", cap=False, rings=1))


def _clock(B, wall, u, z, r, rim=STONE, depth=0.004, seg=12):
    """A lean station clock: a stone rim, a white face, two hands and
    four hour marks."""
    B.add(wall.put(cyl("crim", r + 0.003, r + 0.003, depth,
                       (u, -depth / 2, z), seg, rim, axis="y", rings=1)))
    pts = [(u + math.cos(math.tau * i / seg) * r,
            z + math.sin(math.tau * i / seg) * r) for i in range(seg)]
    B.add(wall.put(pane("cface", pts, -depth - 0.0003, CLOCK)))
    y = -depth - 0.0007

    def hand(a, ln, w_):
        ca, sa = math.cos(a), math.sin(a)
        nx, nz = -sa * w_, ca * w_
        q = [(u + nx, z + nz), (u - nx, z - nz),
             (u - nx + ca * ln, z - nz + sa * ln),
             (u + nx + ca * ln, z + nz + sa * ln)]
        B.add(wall.put(pane("hand", q, y, SIGN)))
    hand(math.radians(80), r * 0.82, 0.0007)
    hand(math.radians(-25), r * 0.58, 0.0009)
    for i in range(4):
        a = math.pi / 2 * i
        cx_, cz_ = u + math.cos(a) * r * 0.84, z + math.sin(a) * r * 0.84
        q = [(cx_ + 0.0009, cz_ - 0.0009), (cx_ + 0.0009, cz_ + 0.0009),
             (cx_ - 0.0009, cz_ + 0.0009), (cx_ - 0.0009, cz_ - 0.0009)]
        B.add(wall.put(pane("tick", q, y, SIGN)))


def _coped_gable(B, wall, gw, hw, rise, dress=STONE, t=0.006):
    """Stone copings up both rakes of a gable on `wall` (gw wide at the
    eaves hw, rising `rise`), with kneelers at their feet."""
    a = math.atan2(rise, gw / 2)
    for k in (-1, 1):
        pa = (k * (gw / 2 + 0.006), -0.0028, hw - 0.006 * math.tan(a) + 0.003)
        pb = (0.0, -0.0028, hw + rise + 0.0042)
        B.add(wall.put(beam("gcope", pa, pb, (0.012, t), dress,
                            up=Vector((0, 0, 1)))))
        B.add(wall.put(box("kneeler", (0.014, 0.012, 0.011),
                           (k * (gw / 2 - 0.001), 0.002, hw + 0.002), dress)))


@asset
def station_hall(name):
    """A small town station's booking hall: one tall storey of red brick
    with sandstone quoins and dressings on a square blue-brick platform
    bank, under a cross-gabled slate roof with stone-coped gables on all
    four faces and two tall stacks. Every face has a round-headed open
    doorway between two arched sash windows, a glazed canopy all round on
    maroon iron brackets with a cream valance, and above the canopy a row
    of arched clerestory windows and a name board; the -Y gable carries
    the station clock, the others a round window."""
    r = root(name)
    B = Build(name)
    half, c = 0.20, 0.136
    hw, rise = 0.228, 0.062
    zw, ze = 0.161, 0.153
    _bank(B, half)
    B.body(K.body("hall", 2 * c, 2 * c, hw, rise, ridge="x", mat=SBRICK,
                  bevel=0.0, edge=0.1, z0=BANK_TOP - 0.006))
    B.add(prism_xz("gables", [(c, hw - 0.006), (0.0, hw + rise - 0.002),
                              (-c, hw - 0.006)], -c, c, SBRICK))
    B.add(box("plinth", (2 * c + 0.006, 2 * c + 0.006, 0.013),
              (0, 0, BANK_TOP + 0.0055), STONE))
    Wm = walls(0, 0, 2 * c, 2 * c)
    for side in FACES:
        wl = Wm[side]
        _doorway(B, wl)
        for u in (-0.076, 0.076):
            # Under the canopy: glazed flush, framed by a stone surround.
            win(B, wl, u, BANK_TOP + 0.018, 0.03, 0.07, arch="round",
                bars="grid", n=6, flush=True)
            B.add(wl.put(box("key", (0.0065, 0.004, 0.008),
                             (u, -0.002, BANK_TOP + 0.018 + 0.073), STONE)))
            B.add(wl.put(box("sill", (0.04, 0.008, 0.004),
                             (u, -0.003, BANK_TOP + 0.016), STONE)))
            _arched(B, wl, u, 0.176, 0.026, 0.036)
        _name_band(B, wl, 0.195, 0.078, 7)
        _coped_gable(B, wl, 2 * c, hw, rise)
        if side == "front":
            _clock(B, wl, 0.0, hw + 0.0215, 0.0175, seg=16)
        else:
            B.add(wl.put(cyl("oculus", 0.011, 0.011, 0.004,
                             (0.0, -0.001, hw + 0.02), 10, STONE, axis="y",
                             rings=1)))
            B.add(wl.put(pane("oculus-glass", [
                (math.cos(math.tau * i / 10) * 0.0075,
                 hw + 0.02 + math.sin(math.tau * i / 10) * 0.0075)
                for i in range(10)], -0.0032, GLASS)))
    B.add(box("course", (2 * c + 0.006, 2 * c + 0.006, 0.005),
              (0, 0, 0.1685), STONE))
    cornice(B, 0, 0, 2 * c, 2 * c, hw - 0.004, 0.008, STONE, out=0.004)
    _quoins(B, c, BANK_TOP + 0.012, 0.166, STONE, course=0.02)
    _quoins(B, c, 0.171, hw - 0.008, STONE, course=0.024)
    for ridge in ("x", "y"):
        W.roof(B, 0, 0, 2 * c, 2 * c, hw, rise, SLATE, ridge=ridge,
               over=0.007, over_gable=0.004, thick=0.005,
               ridge_mat=SLATE_DK)
    for x, y in ((-0.088, 0.088), (0.088, -0.088)):
        _stack(B, x, y, hw - 0.004, 0.287, w=0.03, d=0.03)
    _canopy(B, c, half - 0.004, zw, ze, (-0.112, 0.112))
    for (x, y, ang) in ((-0.076, c + 0.011, 180), (c + 0.011, 0.076, 90)):
        K.bench(B, x, y, ang, wood=PLANK, iron=MAROON_IRON, L=0.04,
                z0=BANK_TOP)
    W.carve(B)
    B.finish(r)
    return r


def _railing(B, a, b, z, h, n, mat=IRON):
    """Iron railings from a to b (x, y) standing on z: n bars and a top
    and a middle rail."""
    a, b = Vector((a[0], a[1], z)), Vector((b[0], b[1], z))
    verts, faces = [], []
    q = 0.0006
    for i in range(n):
        p = a + (b - a) * (i / (n - 1))
        k = len(verts)
        for zz in (z - 0.001, z + h):
            verts += [(p.x - q, p.y - q, zz), (p.x + q, p.y - q, zz),
                      (p.x + q, p.y + q, zz), (p.x - q, p.y + q, zz)]
        faces += [[k + j, k + (j + 1) % 4, k + 4 + (j + 1) % 4, k + 4 + j]
                  for j in range(4)]
    B.add(mesh("rbars", verts, faces, mat))
    B.add(beam("rtop", a + Vector((0, 0, h)), b + Vector((0, 0, h)),
               (0.0018, 0.0016), mat))
    B.add(beam("rmid", a + Vector((0, 0, h * 0.3)), b + Vector((0, 0, h * 0.3)),
               (0.0012, 0.0012), mat))


def _slab_x(name, top, x0, x1, thick, mat, nx=1):
    """A slab of `thick` under a top line [(y, z), ...] (y increasing),
    extruded along x from x0 to x1."""
    prof = [(y, z) for y, z in top] + [(y, z - thick)
                                        for y, z in reversed(top)]
    return K.extrude_x(name, prof, x0, x1, nx, mat)


def _platforms(name, half):
    """Two side platforms flanking the track into a station square, a
    buffer stop on the bank face and the platform furniture."""
    r = root(name)
    B = Build(name)
    top = BANK_TOP
    y0, y1 = -0.5, -half
    ramp = 0.046
    zr = 0.021                     # the ramp's foot at the square edge
    ys = [y0, y0 + ramp]
    while ys[-1] + 0.05 < y1:
        ys.append(ys[-1] + 0.05)
    ys.append(y1)

    def z_at(y):
        if y >= y0 + ramp:
            return top
        return zr + (top - zr) * (y - y0) / ramp

    line = [(y, z_at(y)) for y in ys]
    for s in (-1, 1):
        xi, xc, xo = 0.082, 0.094, 0.19
        # Blue brick wall and fill under the coping and flags.
        body = [(y, z - 0.006) for y, z in line]
        prof = [(y0, -0.003)] + body + [(y1, -0.003)]
        prof = [(y, z) for y, z in prof]
        x0, x1 = sorted((s * xi, s * xo))
        B.add(K.extrude_x("pwall", prof, x0, x1, 3, BLUE))
        # Coping overhanging the track a little, its white edge, flags.
        a, b = sorted((s * 0.0802, s * xc))
        B.add(_slab_x("pcope", line, a, b, 0.0062, PALE))
        a, b = sorted((s * xc, s * xo))
        B.add(_slab_x("pflags", [(y, z - 0.0002) for y, z in line], a, b,
                      0.006, FLAGS, nx=3))
        a, b = sorted((s * 0.0806, s * 0.0838))
        B.add(_slab_x("pedge", [(y, z + 0.0005) for y, z in line], a, b,
                      0.0006, EDGE))
        # Railings along the back edge, a lamp, a bench by the building.
        _railing(B, (s * 0.186, y0 + ramp + 0.006), (s * 0.186, y1 - 0.006),
                 top, 0.03, max(6, round((y1 - y0 - ramp) / 0.016)))
        _lamp_standard(B, s * 0.168, y1 - 0.15, top, h=0.112)
        K.bench(B, s * 0.17, y1 - 0.034, -90 * s, wood=PLANK,
                iron=MAROON_IRON, L=0.04, z0=top)
    # Station nameboard on two posts on the +X platform, facing the track.
    ny = y1 - (0.21 if half < 0.22 else 0.19)
    bx = 0.176
    for dy in (-0.036, 0.036):
        B.add(box("npost", (0.003, 0.003, 0.05), (bx + 0.002, ny + dy,
                                                   top + 0.025), MAROON_IRON))
    B.add(box("nboard", (0.003, 0.088, 0.019), (bx, ny, top + 0.04),
              MAROON_IRON))
    B.add(box("nrim", (0.0035, 0.092, 0.0025), (bx, ny, top + 0.0507),
              VALANCE))
    face = K.Wall((bx - 0.0015, ny, 0), (-1, 0, 0))
    letters(B, face, 0.0, top + 0.04, 8, 0.074, 0.009, mat=LETTER, gap=0.35)
    # Milk churns near the ramp of the -X platform; a parcels barrow.
    for i, (dx, dy) in enumerate(((0.0, 0.0), (0.009, 0.004), (0.002, 0.011),
                                  (0.011, -0.006))):
        K.churn(B, -0.16 + dx, y0 + ramp + 0.03 + dy, z0=top, mat=ZINC)
    bxx, byy = 0.15, y1 - 0.09
    B.add(box("barrow", (0.022, 0.04, 0.002), (bxx, byy, top + 0.009),
              PLANK))
    for k in (-1, 1):
        B.add(box("brail", (0.002, 0.042, 0.004), (bxx + k * 0.0105, byy,
                                                   top + 0.0115), TIMBER))
        B.add(cyl("bwheel", 0.0055, 0.0055, 0.0025, (bxx + k * 0.0125, byy,
                                                     top + 0.0055), 8, IRON,
                  axis="x"))
        B.add(beam("bhandle", (bxx + k * 0.009, byy + 0.02, top + 0.011),
                   (bxx + k * 0.008, byy + 0.034, top + 0.02),
                   (0.0016, 0.0016), TIMBER))
    for k in range(2):
        crate(B, bxx + (k - 0.5) * 0.009, byy - 0.008, 0.0085,
              z0=top + 0.010, mat=CRATE, ang=8 * k)
    sacks(B, bxx, byy + 0.01, 2, z0=top + 0.0102, seed=5)
    # The buffer stop on the bank face, on the track's centre line: a
    # timber beam on iron brackets bolted to the face, two buffers, a red
    # stop lamp. It reaches no more than 0.012 out from the face.
    yb = y1
    zb = 0.0635
    B.add(box("bstop", (0.104, 0.0055, 0.017), (0, yb - 0.003, zb), BUFRED,
              bevel=0.0008))
    B.add(box("bstop-band", (0.105, 0.0057, 0.0035), (0, yb - 0.003,
                                                       zb + 0.0045), VALANCE))
    for x in (-0.05, 0.05):
        B.add(cyl("bshank", 0.0032, 0.0032, 0.0045, (x, yb - 0.0075, zb), 8,
                  IRON, axis="y"))
        B.add(cyl("bhead", 0.0068, 0.0068, 0.0022, (x, yb - 0.0109, zb), 10,
                  STEEL, axis="y"))
    for x in (-0.034, 0.034):
        B.add(beam("bbracket", (x, yb - 0.0025, 0.03), (x, yb - 0.004,
                                                         zb - 0.007),
                   (0.004, 0.003), IRON))
        B.add(box("bplate", (0.008, 0.001, 0.012), (x, yb - 0.0005, 0.034),
                  IRON))
    B.add(box("stoplamp", (0.007, 0.0045, 0.007), (0, yb - 0.003,
                                                    zb + 0.0125), IRON))
    B.add(box("stoplens", (0.0045, 0.0008, 0.0045), (0, yb - 0.0058,
                                                      zb + 0.0125), STOP))
    W.carve(B)
    B.finish(r)
    return r


@asset
def station_platforms(name):
    """Two side platforms on the -Y side of a small station square: blue
    brick faces, a stone coping with a white edge, flags, a ramp at the
    outer end, railings, lamps, benches, a nameboard, milk churns, a
    parcels barrow, and a buffer stop on the bank face."""
    return _platforms(name, 0.20)


@asset
def station_platforms_grand(name):
    """The platforms for the grand station (bank half 0.25)."""
    return _platforms(name, 0.25)


def _steps(name, half):
    """A broad flight of seven stone steps from the street (z = 0.012) at
    y = -(half + 0.06) up to the bank top at y = -half, across the street
    and both pavements, with low stone cheek walls carrying a lamp each
    and two iron handrails over the kerb lines."""
    r = root(name)
    B = Build(name)
    y0, y1 = -(half + 0.06), -half
    n = 7
    z0 = 0.012
    rise = (BANK_TOP - z0) / n
    tread = (y1 - y0) / n
    prof = [(y0, z0 - 0.004)]
    for i in range(n):
        ya = y0 + i * tread
        zt = z0 + (i + 1) * rise
        prof += [(ya, zt), (ya + tread, zt)]
    prof += [(y1, z0 - 0.004)]
    st = K.extrude_x("steps", prof, -0.188, 0.188, 12, STEP)
    # Darker risers under pale treads, so the flight reads from above.
    st.data.materials.append(kit.material(GRIT))
    for p in st.data.polygons:
        if p.normal.y < -0.9:
            p.material_index = 1
    B.add(st)
    # Nosings: a pale line along each step's edge.
    for i in range(n):
        ya = y0 + i * tread
        zt = z0 + (i + 1) * rise
        B.add(box("nosing", (0.376, 0.0018, 0.0012), (0, ya + 0.0009,
                                                       zt + 0.0003), PALE))
    # Cheek walls with copings, piers and lamps.
    for s in (-1, 1):
        a, b = sorted((s * 0.188, s * 0.2))
        wt = [(y0 + 0.016, z0 + 0.03), (y1, BANK_TOP + 0.018)]
        prof = [(y0 + 0.016, z0 - 0.004)] + wt + [(y1, z0 - 0.004)]
        B.add(K.extrude_x("cheek", prof, a, b, 1, GRIT))
        B.add(beam("ccope", (s * 0.1935, y0 + 0.016, z0 + 0.0325),
                   (s * 0.1935, y1 - 0.003, BANK_TOP + 0.0185),
                   (0.0125, 0.005), PALE, up=Vector((0, 0, 1))))
        px = s * 0.1915
        py = y0 + 0.0085
        B.add(box("pier", (0.015, 0.015, 0.044), (px, py, z0 + 0.018),
                  GRIT))
        B.add(box("piercap", (0.017, 0.017, 0.005), (px, py, z0 + 0.0425),
                  PALE))
        _lamp_standard(B, px, py, z0 + 0.045, h=0.085)
        # A handrail over the kerb line: three posts and a sloping rail.
        hx = s * 0.15
        rz = 0.032
        posts = [y0 + tread * 0.5, (y0 + y1) / 2, y1 - tread * 0.5]
        for py_ in posts:
            k = min(n - 1, int((py_ - y0) / tread))
            zt = z0 + (k + 1) * rise
            B.add(cyl("hpost", 0.0011, 0.0011, rz, (hx, py_, zt), 6,
                      MAROON_IRON))
        za = z0 + rise + rz
        zb = BANK_TOP + rz
        B.add(beam("hrail", (hx, posts[0] - 0.002, za - 0.002),
                   (hx, y1 - 0.0025, zb + 0.0015), (0.0022, 0.0022),
                   MAROON_IRON))
    W.carve(B)
    B.finish(r)
    return r


@asset
def station_steps(name):
    """Steps up to a small station's bank from the street on its -Y side."""
    return _steps(name, 0.20)


@asset
def station_steps_grand(name):
    """Steps up to the grand station's bank (half 0.25)."""
    return _steps(name, 0.25)


def _ridge_furrow(B, c, out, z_w, z_e, bays, rr=0.012, hv=0.009):
    """A glazed ridge-and-furrow canopy all round a square block: on each
    face `bays` glass ridges running out from the wall (z_w at the wall,
    z_e at the edge) with iron ridge bars, a cream valance board under
    each gable end, a maroon edge girder and wall plate, and a glass
    pyramid over each corner."""
    bw = 2 * c / bays
    for i in range(4):
        a = math.pi / 2 * i
        ca, sa = math.cos(a), math.sin(a)
        turn = rot("Z", math.degrees(a))

        def P(u, v, z):
            return Vector((ca * u - sa * v, sa * u + ca * v, z))

        def board(pts):
            o = prism_xz("rfval", pts, -0.0008, 0.0008, VALANCE)
            tf(o, turn @ T(0, -out - 0.0014, 0))
            B.add(o)

        for j in range(bays):
            ua, ub = -c + j * bw, -c + (j + 1) * bw
            um = (ua + ub) / 2
            for u0, u1 in ((ua, um), (um, ub)):
                h0 = rr if u0 == um else 0.0
                h1 = rr if u1 == um else 0.0
                q = [P(u0, -c, z_w + h0), P(u0, -out, z_e + h0),
                     P(u1, -out, z_e + h1), P(u1, -c, z_w + h1)]
                o = mesh("rfglass", q, [[0, 1, 2, 3]], CANOPY_GLASS,
                         fix=False)
                if o.data.polygons[0].normal.z < 0:
                    o.data.polygons[0].flip()
                B.add(o)
            B.add(beam("rfridge", P(um, -c, z_w + rr + 0.0009),
                       P(um, -out - 0.0015, z_e + rr + 0.0009),
                       (0.0022, 0.0018), MAROON_IRON))
            # The gable-end valance board with a pointed foot.
            board([(ub, z_e + 0.0005), (um, z_e + rr + 0.0005),
                   (ua, z_e + 0.0005), (ua, z_e - hv), (um, z_e - hv * 1.6),
                   (ub, z_e - hv)])
        # Edge girder and wall plate.
        B.add(beam("rfedge", P(-out, -out + 0.002, z_e - 0.002),
                   P(out, -out + 0.002, z_e - 0.002), (0.004, 0.005),
                   MAROON_IRON))
        B.add(beam("rfplate", P(-c, -c - 0.002, z_w - 0.003),
                   P(c, -c - 0.002, z_w - 0.003), (0.004, 0.006),
                   MAROON_IRON))
        # The corner pyramid over (c..out) at this face's right end.
        k0, k1 = P(c, -c, z_w), P(out, -c, z_e)
        k2, k3 = P(out, -out, z_e), P(c, -out, z_e)
        ap = (k0 + k1 + k2 + k3) / 4
        ap.z = z_e + rr
        o = mesh("rfcorner", [k0, k1, k2, k3, ap],
                 [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]], CANOPY_GLASS,
                 fix=False)
        for p in o.data.polygons:
            if p.normal.z < 0:
                p.flip()
        B.add(o)
        B.add(beam("rfhip", k2 + Vector((0, 0, 0.0009)),
                   ap + Vector((0, 0, 0.0009)), (0.0018, 0.0016),
                   MAROON_IRON))
        for flip in (False, True):
            pts = [(out, z_e + 0.0005), (c, z_e + 0.0005), (c, z_e - hv),
                   ((c + out) / 2, z_e - hv * 1.6), (out, z_e - hv)]
            o = prism_xz("rfval", pts, -0.0008, 0.0008, VALANCE)
            if flip:
                tf(o, rot("Z", math.degrees(a) + 90) @
                   T(0, -out - 0.0014, 0) @ T(-(c + out), 0, 0))
            else:
                tf(o, turn @ T(0, -out - 0.0014, 0))
            B.add(o)


def _columns(B, pts, z0, z1, r=0.0028, mat=MAROON_IRON):
    """Cast-iron canopy columns with a base and a capital."""
    for x, y in pts:
        B.add(cyl("col", r, r * 0.85, z1 - z0 - 0.01, (x, y, z0 + 0.005), 6,
                  mat, cap=False, rings=1))
        B.add(box("cbase", (0.0072, 0.0072, 0.006), (x, y, z0 + 0.003), mat))
        B.add(box("ccap", (0.0085, 0.0085, 0.005), (x, y, z1 - 0.0025), mat))


def _gable_roof_face(B, i, w, y0, y1, hw, rise, mat=SLATE):
    """A small gable roof over a pavilion on face i (0 front, 1 right,
    2 back, 3 left), its ridge running in from the face: built on the
    front between y0 (outer) and y1 and turned to its face."""
    tmp = Build("tmp")
    W.roof(tmp, 0, (y0 + y1) / 2, w, y1 - y0, hw, rise, mat, ridge="y",
           over=0.005, over_gable=0.0, thick=0.005)
    m = rot("Z", 90 * i)
    for o, uv in tmp.parts:
        tf(o, m)
        B.add(o, uv)


@asset
def station_grand(name):
    """A grand town station: a two-storey Italianate booking hall of red
    brick with pale stone pilasters, string courses and a bold cornice on
    a square blue-brick platform bank. Each face has a central pavilion
    under a stone pediment with an oculus, its round-headed open doorway
    in a dressed surround and a tall arched window above; a glazed
    ridge-and-furrow canopy on cast-iron columns runs all round. A slate
    pyramid roof with four stacks carries a central clock turret under a
    lead cupola."""
    r = root(name)
    B = Build(name)
    half, c = 0.25, 0.18
    g1, hw, rise = 0.19, 0.30, 0.034
    zw, zev = 0.178, 0.172
    pw, pp = 0.104, 0.011
    _bank(B, half)
    B.body(K.body("hall", 2 * c, 2 * c, hw, mat=SBRICK, bevel=0.0,
                  edge=0.1, z0=BANK_TOP - 0.006))
    B.add(box("plinth", (2 * c + 0.008, 2 * c + 0.008, 0.014),
              (0, 0, BANK_TOP + 0.006), PALE))
    for z, h, o in ((g1, 0.008, 0.0045), (0.2075, 0.0035, 0.003),
                    (hw - 0.012, 0.005, 0.004)):
        B.add(box("course", (2 * c + 2 * o, 2 * c + 2 * o, h), (0, 0, z),
                  PALE))
    cornice(B, 0, 0, 2 * c, 2 * c, hw - 0.004, 0.011, PALE, out=0.009)
    for sx in (-1, 1):
        for sy in (-1, 1):
            B.add(box("pilaster", (0.024, 0.024, hw - 0.014 - 0.069),
                      (sx * (c - 0.0095), sy * (c - 0.0095),
                       (hw - 0.014 + 0.069) / 2), PALE))
    Wm = walls(0, 0, 2 * c, 2 * c)
    for i, side in enumerate(FACES):
        wl = Wm[side]
        # The central pavilion, its pilasters and pediment.
        B.body(wl.put(gbox("pavilion", (pw, pp + 0.004, hw - 0.004 - 0.05),
                           (0, -pp / 2 + 0.002, (hw - 0.004 + 0.05) / 2),
                           SBRICK, edge=0.1)))
        pv = K.Wall(wl.at(0, -pp, 0), wl.n)
        for u in (-1, 1):
            B.add(pv.put(box("ppil", (0.012, 0.004, hw - 0.012 - 0.069),
                             (u * (pw / 2 - 0.006), -0.0015,
                              (hw - 0.012 + 0.069) / 2), PALE)))
        B.add(pv.put(prism_xz("pediment", [(pw / 2 + 0.006, hw),
                                           (0.0, hw + 0.04),
                                           (-pw / 2 - 0.006, hw)],
                              -0.002, 0.04, PALE)))
        ap = math.atan2(0.04, pw / 2 + 0.006)
        for k in (-1, 1):
            B.add(pv.put(beam("rake", (k * (pw / 2 + 0.011),
                                       -0.0045, hw - 0.002),
                              (0.0, -0.0045, hw + 0.0455),
                              (0.008, 0.006), PALE, up=Vector((0, 0, 1)))))
        B.add(pv.put(cyl("oculus", 0.0085, 0.0085, 0.003,
                         (0.0, -0.0035, hw + 0.0145), 8, PALE, axis="y",
                         rings=1)))
        B.add(pv.put(pane("oculus-glass", [
            (math.cos(math.tau * k / 10) * 0.0058,
             hw + 0.0145 + math.sin(math.tau * k / 10) * 0.0058)
            for k in range(10)], -0.0052, GLASS)))
        _gable_roof_face(B, i, pw + 0.012, -c - pp - 0.004, -c + 0.05, hw,
                         0.04)
        _doorway(B, pv, ring=0.009, dress=PALE)
        B.add(pv.put(box("hood", (DOOR_W + 0.032, 0.012, 0.006),
                         (0, -0.005, BANK_TOP + DOOR_H + 0.016), PALE)))
        _arched(B, pv, 0.0, g1 + 0.024, 0.032, 0.068, dress=PALE,
                ring=0.006)
        # Side bays: a window each side on both floors.
        for u in (-0.112, 0.112):
            win(B, wl, u, BANK_TOP + 0.018, 0.03, 0.086, arch="round",
                bars="grid", n=6, flush=True)
            B.add(wl.put(box("key", (0.0065, 0.004, 0.008),
                             (u, -0.002, BANK_TOP + 0.018 + 0.089), PALE)))
            B.add(wl.put(box("sill", (0.04, 0.008, 0.004),
                             (u, -0.003, BANK_TOP + 0.016), PALE)))
        for u in (-0.128, -0.08, 0.08, 0.128):
            win(B, wl, u, 0.212, 0.026, 0.058, arch="segment", bars="cross",
                n=6)
            B.add(wl.put(box("hoodm", (0.034, 0.005, 0.005),
                             (u, -0.0025, 0.212 + 0.058 + 0.004), PALE)))
            B.add(wl.put(box("key", (0.006, 0.006, 0.009),
                             (u, -0.003, 0.212 + 0.058 + 0.002), PALE)))
    # Pyramid roof with gutters, four stacks, the clock turret.
    ze = W.hip(B, 0, 0, 2 * c, 2 * c, hw, rise, SLATE, over=0.014,
               thick=0.006)
    _gutters(B, c, ze - 0.002, 0.016)
    for sx in (-1, 1):
        for sy in (-1, 1):
            _stack(B, sx * 0.118, sy * 0.118, hw - 0.01, 0.37, w=0.03,
                   d=0.03, pots=2)
    ts, tz0, tz1 = 0.078, hw - 0.01, 0.372
    B.add(gbox("turret", (ts, ts, tz1 - tz0), (0, 0, (tz0 + tz1) / 2),
               SBRICK, edge=0.1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            B.add(box("tpil", (0.012, 0.012, tz1 - 0.326),
                      (sx * (ts / 2 - 0.004), sy * (ts / 2 - 0.004),
                       (tz1 + 0.326) / 2), PALE))
    tw = walls(0, 0, ts, ts)
    for side in FACES:
        _clock(B, tw[side], 0.0, 0.3505, 0.0155, rim=PALE)
    B.add(box("tcorn", (ts + 0.012, ts + 0.012, 0.007), (0, 0, tz1), PALE))
    B.add(lathe("cupola", [(0.034, tz1 + 0.0035), (0.033, tz1 + 0.009),
                           (0.028, tz1 + 0.018), (0.018, tz1 + 0.026),
                           (0.007, tz1 + 0.031), (0.0, tz1 + 0.032)],
                (0, 0, 0), 12, LEAD))
    B.add(lathe("tfinial", [(0.0035, tz1 + 0.031), (0.0042, tz1 + 0.034),
                            (0.0012, tz1 + 0.037), (0.0007, 0.418),
                            (0.0, 0.418)], (0, 0, 0), 6, GILT))
    # The ridge-and-furrow canopy on its columns.
    out = half - 0.004
    _ridge_furrow(B, c, out, zw, zev, 4)
    cols = []
    for i in range(4):
        a = math.pi / 2 * i
        ca, sa = math.cos(a), math.sin(a)
        for u in (-0.09, 0.09, out - 0.005):
            v = -out + 0.005
            cols.append((ca * u - sa * v, sa * u + ca * v))
    _columns(B, cols, BANK_TOP, zev - 0.004)
    for i in range(4):
        a = math.pi / 2 * i
        ca, sa = math.cos(a), math.sin(a)
        v = -out + 0.022
        _hanging_lamp(B, -sa * v, ca * v, zev - 0.003, drop=0.006)
    for (x, y, ang) in ((-0.112, c + 0.011, 180), (c + 0.011, -0.112, 90)):
        K.bench(B, x, y, ang, wood=PLANK, iron=MAROON_IRON, L=0.042,
                z0=BANK_TOP)
    W.carve(B)
    B.finish(r)
    return r


# ---------------------------------------------------------------- edges

@asset
def hoarding(name):
    """A timber site hoarding, 1 m long (the game stretches it along X):
    uneven boards on posts and rails, faded bill posters."""
    r = root(name)
    B = Build(name)
    rnd = random.Random(12)
    n = 28
    bw = 1.0 / n
    for i in range(n):
        x = -0.5 + bw * (i + 0.5)
        h = 0.056 + rnd.uniform(-0.003, 0.004)
        o = box("board", (bw - 0.0012, 0.003, h), (0, 0, h / 2 - 0.002),
                rnd.choice((PLANK, PLANK, WEATHER, FENCE)))
        tf(o, T(x, -0.002, 0) @ rot("Y", rnd.uniform(-1.2, 1.2)))
        B.add(o)
    for z in (0.012, 0.046):
        B.add(box("rail", (0.996, 0.004, 0.006), (0, 0.0015, z), TIMBER))
    for i in range(6):
        x = -0.48 + i * 0.192
        B.add(box("post", (0.008, 0.008, 0.064), (x, 0.0055, 0.03), TIMBER))
    cols = ["paint:poster-red", "paint:poster-blue", "paint:poster-cream",
            "paint:poster-yellow", "paint:poster-green"]
    x = -0.45
    k = 0
    while x < 0.42:
        pw = rnd.uniform(0.05, 0.08)
        ph = rnd.uniform(0.026, 0.036)
        z0 = rnd.uniform(0.012, 0.018)
        col = cols[k % len(cols)]
        y = -0.0039
        B.add(pane("poster", [(x + pw, z0), (x + pw, z0 + ph), (x, z0 + ph),
                              (x, z0)], y, col))
        # A title band and a block of print.
        B.add(pane("ptitle", [(x + pw - 0.005, z0 + ph - 0.009),
                              (x + pw - 0.005, z0 + ph - 0.004),
                              (x + 0.005, z0 + ph - 0.004),
                              (x + 0.005, z0 + ph - 0.009)], y - 0.0004,
                   "paint:poster-ink"))
        if k % 2:
            B.add(pane("pblock", [(x + pw * 0.7, z0 + 0.005),
                                  (x + pw * 0.7, z0 + ph * 0.55),
                                  (x + pw * 0.3, z0 + ph * 0.55),
                                  (x + pw * 0.3, z0 + 0.005)], y - 0.0004,
                       "paint:poster-cream" if k % 4 != 1 else
                       "paint:poster-red"))
        x += pw + rnd.uniform(0.02, 0.07)
        k += 1
    W.carve(B)
    B.finish(r)
    return r


def _wing(B, x0, x1, top, y0, y1, mat, cope):
    """A straight wing wall along X from x0 to x1, its top following
    top(x) (sampled), with a coping."""
    n = 4
    xs = [x0 + (x1 - x0) * i / n for i in range(n + 1)]
    poly = [(xs[-1], -0.004)] + [(x, top(x)) for x in reversed(xs)] + \
        [(xs[0], -0.004)]
    if x1 < x0:
        poly = list(reversed(poly))
    B.add(prism_xz("wing", poly, y0, y1, mat))
    for a, b in zip(xs, xs[1:]):
        B.add(beam("wcope", (a, (y0 + y1) / 2, top(a) + 0.003),
                   (b, (y0 + y1) / 2, top(b) + 0.003),
                   (abs(y1 - y0) + 0.006, 0.006), cope,
                   up=Vector((0, 0, 1))))
    for x in (xs[-1],):
        B.add(box("wend", (0.014, abs(y1 - y0) + 0.008, top(x) + 0.012),
                  (x, (y0 + y1) / 2, (top(x) + 0.012) / 2 - 0.004), cope))


@asset
def tunnel_rail(name):
    """A dressed stone tunnel portal facing -Y on y = 0 (a 0.17 x 0.24
    opening), set in a grassed embankment running back 1.4 along +Y,
    1.1 wide and 0.38 tall, its bore lined and open for 1.1 into the
    mound, wing walls retaining the slopes."""
    r = root(name)
    B = Build(name)
    half, spring, rise = 0.085, 0.155, 0.085
    face_w, top = 0.34, 0.31
    Hm = 0.38

    def fx(x):
        a = abs(x)
        if a < 0.13:
            return 1.0
        t = min(1.0, (a - 0.13) / 0.42)
        return 0.5 + 0.5 * math.cos(t * math.pi)

    def fy(y):
        if y < 1.05:
            return 1.0
        t = min(1.0, (y - 1.05) / 0.35)
        return 0.5 + 0.5 * math.cos(t * math.pi)

    def h(x, y):
        v = Hm * fx(x) * fy(y) * (0.97 + 0.03 * math.sin(min(y, 1.05) * 3))
        v += 0.008 * W.fbm(x * 2.5, y * 2.5, 3.1) * fx(x)
        if y < 0.06 and abs(x) < face_w / 2 + 0.01:
            v = min(v, top + 0.03)
        return max(0.002, v)
    mound = W.heightfield("mound", -0.545, 0.545, 0.03, 1.4, 20, 24, h,
                          mat=MOOR, side_mat=GRIT)
    B.body(mound)
    W.portal_face(B, 0.0, 0.0, half, spring, rise, face_w, top, 0.05, GRIT,
                  STONE, n=12, ring=0.022)
    W.bore(B, 0.0, half, spring, rise, 0.002, 1.1, LINING, t=0.018,
           cut_t=0.018, cut_from=-0.03)
    B.add(pane("void", W.arch_pts(0.0, half, spring, rise, 12, 0.0), 1.099,
               VOID))
    for k in (-1, 1):
        _wing(B, k * (face_w / 2 - 0.004), k * 0.536,
              lambda x: max(0.02, Hm * fx(x) - 0.01 if abs(x) > 0.2 else
                            top - 0.02), 0.0, 0.03, GRIT, STONE)
    # Hawthorn clumps on the slopes.
    rnd = random.Random(17)
    for (x, y) in ((-0.36, 0.35), (-0.4, 0.42), (0.38, 0.8), (0.41, 0.72),
                   (-0.3, 1.18), (0.25, 1.25)):
        for j in range(2):
            px = x + rnd.uniform(-0.02, 0.02)
            py = y + rnd.uniform(-0.02, 0.02)
            rr = rnd.uniform(0.025, 0.035)
            o = ball("bush", 1.0, (0, 0, 0), "foliage:hawthorn", seg=6,
                     rings=4, scale=(rr, rr, rr * 0.8))
            tf(o, T(px, py, h(px, py) + rr * 0.35))
            B.add(o)
    # A post-and-wire fence along the top of the portal.
    for i in range(7):
        x = -0.15 + i * 0.05
        B.add(box("fpost", (0.004, 0.004, 0.026), (x, 0.075,
                                                   h(x, 0.075) + 0.01),
                  FENCE))
    B.add(box("frail", (0.31, 0.002, 0.002), (0, 0.075, h(0, 0.075) + 0.02),
              FENCE))
    W.carve(B)
    B.finish(r)
    return r


@asset
def outcrop_a(name):
    from ridges import build_outcrop
    return build_outcrop(name, 31, 1)


@asset
def outcrop_b(name):
    from ridges import build_outcrop
    return build_outcrop(name, 83, -1)


@asset
def subsidence(name):
    """Collapsed ground: a pit of churned clay and puddled water ringed by
    a raised lip of broken setts, broken brick and splintered timbers in
    it, inside a rough timber fence with a warning board."""
    r = root(name)
    B = Build(name)
    rnd = random.Random(21)

    def h(x, y):
        rr = math.hypot(x * 1.05, y) * (1 + 0.15 * W.fbm(x * 3, y * 3, 2.2))
        lip = 0.03 * math.exp(-((rr - 0.25) / 0.06) ** 2)
        pit = 0.0 if rr > 0.24 else -0.028 * (1 - (rr / 0.24) ** 2)
        return 0.034 + lip + pit + 0.004 * W.fbm(x * 9, y * 9, 4.4) \
            - 0.032 * max(0.0, (rr - 0.3) / 0.1) if rr > 0.3 else \
            0.034 + lip + pit + 0.004 * W.fbm(x * 9, y * 9, 4.4)

    def hh(x, y):
        return max(0.002, h(x, y))
    g = W.heightfield("ground", -0.39, 0.39, -0.39, 0.39, 14, 14, hh,
                      mat=CINDER, side_mat=CINDER)

    def rule(c, n):
        rr = math.hypot(c.x, c.y)
        if rr < 0.1 and c.z < 0.012:
            return PUDDLE
        if rr < 0.22:
            return CLAY if W.fbm(c.x * 8, c.y * 8, 1.0) > -0.1 else EARTH
        if rr < 0.31:
            return EARTH
        return None
    W.paint(g, rule)
    B.add(g)
    # Tilted slabs of broken setts sagging into the pit.
    for i in range(7):
        a = i / 7 * math.tau + rnd.uniform(-0.2, 0.2)
        rr = rnd.uniform(0.2, 0.25)
        x, y = math.cos(a) * rr, math.sin(a) * rr
        s = rnd.uniform(0.06, 0.09)
        o = box("setts", (s, s * 0.7, 0.008), (0, 0, 0), SETTS)
        tf(o, T(x, y, hh(x, y) - 0.002) @ rot("Z", math.degrees(a) + 90) @
           rot("X", rnd.uniform(14, 26)))
        B.add(o)
    # Broken brick in heaps and timbers.
    for i in range(18):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.02, 0.2)
        x, y = math.cos(a) * rr, math.sin(a) * rr
        o = box("brick", (0.012, 0.006, 0.005), (0, 0, 0),
                rnd.choice((BRICK, BRICK_DK, BRICK)))
        tf(o, T(x, y, hh(x, y) + 0.001) @ rot("Z", rnd.uniform(0, 180)) @
           rot("X", rnd.uniform(-25, 25)))
        B.add(o)
    for i in range(6):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.05, 0.16)
        x, y = math.cos(a) * rr, math.sin(a) * rr
        L = rnd.uniform(0.09, 0.15)
        b2 = a + rnd.uniform(-0.8, 0.8)
        p0 = Vector((x, y, hh(x, y) - 0.004))
        p1 = p0 + Vector((math.cos(b2) * L * 0.7, math.sin(b2) * L * 0.7,
                          L * rnd.uniform(0.35, 0.6)))
        B.add(beam("timber", p0, p1, (0.008, 0.008), rnd.choice((TIMBER,
                                                                 WEATHER))))
    B.add(beam("pipe", (-0.16, 0.05, 0.02), (0.08, -0.02, 0.03),
               (0.01, 0.01), "metal:rust"))
    # Rough fence.
    n = 12
    posts = []
    for i in range(n):
        a = i / n * math.tau + math.pi / n
        rr = 0.37 if i % 3 else 0.36
        x = max(-0.385, min(0.385, math.cos(a) * rr * 1.08))
        y = max(-0.385, min(0.385, math.sin(a) * rr * 1.08))
        lean = (rnd.uniform(-6, 6), rnd.uniform(-6, 6))
        p = Vector((x, y, hh(x, y) - 0.006))
        top_ = p + Vector((math.sin(math.radians(lean[0])) * 0.06,
                           math.sin(math.radians(lean[1])) * 0.06, 0.06))
        B.add(beam("fpost", p, top_, (0.006, 0.006), FENCE))
        posts.append((p, top_))
    for i in range(n):
        if i == 4:
            continue
        a, b = posts[i], posts[(i + 1) % n]
        for t in (0.45, 0.85):
            pa = a[0].lerp(a[1], t)
            pb = b[0].lerp(b[1], t - (0.12 if i == 7 and t < 0.5 else 0))
            B.add(beam("frail", pa, pb, (0.0035, 0.006), FENCE))
    p, tp = posts[9]
    B.add(box("board", (0.05, 0.003, 0.03), (0, 0, 0), "paint:danger"))
    tf(B.parts[-1][0], T(tp.x, tp.y - 0.006, tp.z - 0.012))
    B.add(box("bstripe", (0.042, 0.0034, 0.006), (tp.x, tp.y - 0.006,
                                                  tp.z - 0.012),
              "paint:sign-black"))
    W.carve(B)
    B.finish(r)
    return r


@asset
def wharf_crane(name):
    """A quayside crane: a timber cab with a slate roof and stove pipe on
    an iron turntable over an octagonal stone pedestal, a long iron jib
    rising over the water to 0.42, tie rods, a counterweight and hook."""
    r = root(name)
    B = Build(name)
    B.add(lathe("ped", [(0.07, -0.003), (0.07, 0.03), (0.064, 0.036),
                        (0.0, 0.036)], (0, 0, 0), 8, GRIT), uv=("cyl", (0,
                                                                         0)))
    B.add(cyl("turn", 0.05, 0.05, 0.008, (0, 0, 0.036), 12, IRON))
    cw, cd, ch = 0.072, 0.088, 0.07
    cy = 0.012
    B.body(K.body("cab", cw, cd, 0.044 + ch, centre=(0, cy), mat=WEATHER,
                  edge=0.2, z0=0.04))
    Wc = walls(0, cy, cw, cd)
    win(B, Wc["front"], 0.018, 0.075, 0.018, 0.022, bars="cross")
    win(B, Wc["left"], 0.0, 0.075, 0.024, 0.022, bars="cross")
    win(B, Wc["right"], 0.0, 0.075, 0.024, 0.022, bars="cross")
    plank_door(B, Wc["back"], 0.0, 0.026, 0.05, GREEN, z0=0.044)
    rl = Build("tmp")
    W.roof(rl, 0, 0, cw, cd, 0.0, 0.022, SLATE, ridge="y", over=0.006,
           over_gable=0.005, ridge_mat=SLATE_DK)
    for o, uv in rl.parts:
        tf(o, T(0, cy, 0.044 + ch))
        B.add(o, uv)
    B.add(cyl("stove", 0.004, 0.004, 0.04, (0.022, cy + 0.025, 0.12), 6,
              IRON))
    # Jib, ties and the hook.
    tip = Vector((0, -0.24, 0.415))
    for k in (-1, 1):
        B.add(beam("jib", (k * 0.02, cy - cd / 2 + 0.004, 0.05),
                   tip + Vector((k * 0.004, 0, 0)), (0.007, 0.007), OXIDE))
        B.add(beam("tie", (k * 0.016, cy + 0.02, 0.135),
                   tip + Vector((k * 0.003, 0.004, 0.004)), (0.0025, 0.0025),
                   IRON))
    for t in (0.25, 0.5, 0.75):
        p = Vector((0, cy - cd / 2 + 0.004, 0.05)).lerp(tip, t)
        w = 0.04 * (1 - t) + 0.008 * t
        B.add(box("lace", (w, 0.003, 0.003), p, OXIDE))
    B.add(box("post", (0.01, 0.01, 0.03), (0, cy + 0.02, 0.124), IRON))
    B.add(box("weight", (0.06, 0.02, 0.03), (0, cy + cd / 2 + 0.006, 0.065),
              IRON, bevel=0.002))
    B.add(cyl("sheave", 0.007, 0.007, 0.005, tip - Vector((0.0025, 0.004,
                                                           0.006)), 8, IRON,
              axis="x"))
    B.add(cyl("chain", 0.001, 0.001, 0.2, (0, tip.y - 0.006, tip.z - 0.21), 4,
              IRON))
    B.add(box("hook", (0.008, 0.005, 0.012), (0, tip.y - 0.006,
                                              tip.z - 0.214), IRON))
    W.carve(B)
    B.finish(r)
    return r


@asset
def mill_site(name):
    """A reclaimed weaving yard: legible foundation lines, a paved apron,
    and one surviving boiler-house corner. The empty middle invites a route;
    no full-height stack or loose rubble obscures its neighbouring cells."""
    r = root(name)
    B = Build(name)
    B.add(gbox("cinder-yard", (0.78, 0.78, 0.006), (0, 0, -0.001),
               CINDER, edge=0.2))
    # Perimeter footing, with a clear cart entrance towards the viewer.
    for y in (-0.32, 0.30):
        parts = [(-0.33, -0.10), (0.10, 0.33)] if y < 0 else [(-0.33, 0.33)]
        for xa, xb in parts:
            B.add(box("foundation", (xb - xa, 0.019, 0.019),
                      ((xa + xb) / 2, y, 0.009), BRICK_DK))
            B.add(box("foundation-cap", (xb - xa, 0.021, 0.004),
                      ((xa + xb) / 2, y, 0.020), GRIT))
    for x in (-0.33, 0.33):
        B.add(box("foundation", (0.019, 0.62, 0.019), (x, -0.01, 0.009),
                  BRICK_DK))
    # Two floor bays, deliberately open rather than a mesh of tiny debris.
    for x in (-0.105, 0.105):
        B.add(box("floor-beam-bed", (0.012, 0.53, 0.005),
                  (x, -0.005, 0.004), GRIT_DK))
    B.add(box("loading-apron", (0.38, 0.12, 0.009), (0, -0.315, 0.003), FLAGS))
    for x in (-0.18, -0.06, 0.06, 0.18):
        B.add(box("slab-joint", (0.002, 0.112, 0.001),
                  (x, -0.315, 0.008), GRIT_DK))
    # The surviving engine room rests inside the rear footprint, with its
    # chimney set behind it. A raised arch and green door make it a landmark.
    bx, by, bw, bd, bh = 0.215, 0.215, 0.17, 0.12, 0.12
    B.body(K.body("boiler-room", bw, bd, bh, 0.031, "x",
                  centre=(bx, by), mat=BRICK, edge=0.07, bevel=0.001))
    wall = walls(bx, by, bw, bd)["front"]
    plank_door(B, wall, -0.025, 0.057, 0.087, GREEN, arch="segment",
               braces=False)
    arch_ring(B, wall, -0.025, 0.057, 0.087, "segment", 0.0065, BRICK_DK)
    mill_window(B, wall, 0.049, 0.039, 0.032, 0.046, arch=False)
    W.roof(B, bx, by, bw, bd, bh, 0.031, SLATE, over=0.005,
           over_gable=0.004, ridge_mat=SLATE_DK)
    build_chimney(B, 0.297, 0.320, H=0.40, base=0.067)
    # A single kept wall with an old capped buttress, no random rubble.
    for x in (-0.31, -0.19):
        B.add(box("old-pier", (0.028, 0.029, 0.075),
                  (x, 0.29, 0.036), BRICK_DK))
        B.add(box("old-pier-cap", (0.033, 0.033, 0.006),
                  (x, 0.29, 0.076), GRIT))
    B.add(box("old-wall", (0.12, 0.017, 0.05), (-0.25, 0.29, 0.025), BRICK))
    W.carve(B)
    finish_mill(B, r)
    return r


# ---------------------------------------------------------------- run

def recentre(r):
    """Report an asset whose bounds are not centred on its root (every
    asset is built centred on its footprint)."""
    if r.name in OFF_CENTRE:
        return
    lo, hi = W.bounds(r)
    off = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, 0))
    if off.length < 0.0015:
        return
    print("OFFSET", r.name, tuple(round(-v, 4) for v in off))


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    out = args[0] if args else None
    prev = args[1] if len(args) > 1 else None
    only = [s for s in os.environ.get("ROTA_ONLY", "").split(",") if s]
    roots = []
    for name, fn in ASSETS.items():
        if only and name not in only:
            continue
        roots.append(fn(name))
    for r in roots:
        recentre(r)
    for i, r in enumerate(roots):
        r.location = Vector(((i % 6) * 2.2, (i // 6) * 2.2, 0))
    kit.refresh()
    meshes = [o for r in roots for o in kit.descendants(r) if o.type == "MESH"]
    kit.bake_ao(meshes, samples=64, distance=0.06)
    for r in roots:
        r.location = (0, 0, 0)
    kit.refresh()
    W.report(roots)
    for r in roots:
        if r.name == "tunnel_rail":
            W.bore_check(r, 0.085, 0.155, 0.085, -0.05, 1.095, "into mound")
        if r.name.startswith("outcrop"):
            from ridges import validate_clearance
            validate_clearance(r)
    if os.environ.get("ROTA_MASTER"):
        bpy.ops.wm.save_as_mainfile(
            filepath=os.path.abspath(os.environ["ROTA_MASTER"]))
    if out:
        kit.export(roots, out)
        print("GLB bytes", os.path.getsize(out))
    if prev:
        W.render_previews(prev, roots)


main()
