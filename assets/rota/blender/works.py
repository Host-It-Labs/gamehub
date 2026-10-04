"""Rota's works: the mills, warehouses, sheds and yard things of a 1950s
northern mill town, plus the goods stations and the maps' fixed pieces
(tunnel, gritstone outcrops, subsidence, cranes, the hoarding and a
cleared mill site). See docs/concepts/2026-10-03-rota-mill-town/brief.md.

One grid square is 25 m = 1 m here, the ground is z = 0, fronts face -Y
(towards the track). Every asset is a root empty at its footprint centre
(tunnel_rail's root sits on its portal face, y = 0) with one joined mesh
under it.

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
OFF_CENTRE = {"yard_crane", "wharf_crane", "tunnel_rail"}


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
    """A mill chimney: a stone-capped square pedestal, an octagonal
    tapering brick shaft with stone bands, sootier towards the top, and a
    corbelled cap."""
    ped = 0.13
    B.add(box("plinth", (base, base, 0.022), (x, y, 0.008), GRIT))
    B.add(box("pedestal", (base - 0.008, base - 0.008, ped - 0.02),
              (x, y, 0.017 + (ped - 0.02) / 2), BRICK))
    B.add(box("pedcap", (base, base, 0.012), (x, y, ped + 0.002), STONE))
    B.add(box("pedcap2", (base - 0.012, base - 0.012, 0.01),
              (x, y, ped + 0.012), STONE))
    r0, r1 = 0.031, 0.021
    z0, z1 = ped + 0.017, H * 0.925

    def rad(z):
        return r0 + (r1 - r0) * (z - z0) / (z1 - z0)

    def octo(name, prof, mat):
        o = lathe(name, prof, (x, y, 0), 8, mat, close=False)
        tf(o, T(x, y) @ rot("Z", 22.5) @ T(-x, -y))
        B.add(o, uv=("cyl", (x, y)))
    cuts = [z0, H * 0.34, H * 0.36, H * 0.6, H * 0.62, H * 0.8, H * 0.82,
            z1]
    mats = [BRICK, STONE, BRICK, STONE, BRICK_DK, STONE, BRICK_DEEP]
    for i in range(len(cuts) - 1):
        za, zb = cuts[i], cuts[i + 1]
        out = 0.0025 if mats[i] == STONE else 0.0
        octo("shaft", [(rad(za) + out, za), (rad(zb) + out, zb)], mats[i])
    # Corbelled cap: oversailing brick, a stone band, the rim.
    rt = rad(z1)
    octo("cap", [(rt, z1), (rt + 0.008, z1 + 0.018), (rt + 0.008,
                                                      z1 + 0.03)],
         BRICK_DEEP)
    octo("capband", [(rt + 0.01, z1 + 0.03), (rt + 0.01, z1 + 0.042)], STONE)
    octo("rim", [(rt + 0.004, z1 + 0.042), (rt + 0.004, H),
                 (rt - 0.004, H), (rt - 0.004, H - 0.016)], BRICK_DEEP)
    B.add(cyl("flue", rt - 0.004, rt - 0.004, 0.001, (x, y, H - 0.016), 8,
              VOID, cap=True))
    for z in (H * 0.47, H * 0.71):
        B.add(cyl("hoop", rad(z) + 0.0008, rad(z) + 0.0008, 0.003,
                  (x, y, z), 8, IRON, cap=False))


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

WW, WH = 0.048, 0.06        # a mill window, 1.2 x 1.5 m


@asset
def mill_big(name):
    """A five-storey spinning mill: six bays of tall many-paned windows on
    every floor, stone sill bands, a pale stone name band under the
    cornice, a stack of taking-in doors with a cathead, a cart door, and
    a stair tower at the east end carrying an iron water tank."""
    r = root(name)
    B = Build(name)
    x0, x1 = -0.392, 0.27
    w, d, hw, rise = x1 - x0, 0.31, 0.48, 0.056
    cx = (x0 + x1) / 2
    B.body(K.body("walls", w, d, hw, rise, "x", centre=(cx, 0), mat=BRICK,
                  edge=0.25))
    B.add(box("plinth", (w + 0.006, d + 0.006, 0.026), (cx, 0, 0.0115),
              GRIT))
    Wm = walls(cx, 0, w, d)
    f, bk = Wm["front"], Wm["back"]
    bays = 6
    pitch = w / bays
    us = [-w / 2 + pitch * (i + 0.5) for i in range(bays)]
    zs = [0.034 + k * 0.088 for k in range(5)]
    for i, u in enumerate(us):
        for k, z in enumerate(zs):
            if i == 1:
                if k == 0:
                    plank_door(B, f, u, 0.044, 0.074, GREEN)
                    B.add(f.put(box("lintel", (0.054, 0.005, 0.007),
                                    (u, -0.002, 0.078), STONE)))
                else:
                    plank_door(B, f, u, 0.036, 0.064, GREEN, z0=z - 0.004)
                    B.add(f.put(box("lintel", (0.044, 0.005, 0.006),
                                    (u, -0.002, z + 0.064), STONE)))
                continue
            if i == 4 and k == 0:
                plank_door(B, f, u, 0.06, 0.08, GREEN, arch="segment")
                arch_ring(B, f, u, 0.06, 0.08, "segment", 0.008, STONE)
                continue
            win(B, f, u, z, WW, WH, arch="segment", bars="grid")
    cathead(B, f, us[1], 0.462, reach=0.014)
    for z in zs[1:]:
        sill_band(B, f, -w / 2, w / 2, z - 0.002)
    # Name band and cornice.
    flat_box(B, f, (us[2] + us[3]) / 2, 0.462, 0.3, 0.02, PALE, proud=0.003)
    letters(B, f, (us[2] + us[3]) / 2, 0.462, 10, 0.26, 0.011)
    cornice(B, cx, 0, w, d, hw - 0.004, 0.009, STONE, out=0.003)
    # Back: the same grid of windows.
    for u in us:
        for z in zs:
            win(B, bk, u, z, WW, WH, bars="grid", flush=True)
    for z in zs[1:]:
        sill_band(B, bk, -w / 2, w / 2, z - 0.002)
    # West end: three bays and a round window in the gable.
    lw = Wm["left"]
    for u in (-0.095, 0.0, 0.095):
        for z in zs:
            win(B, lw, u, z, 0.044, WH, bars="grid", flush=True)
    for z in zs[1:]:
        sill_band(B, lw, -d / 2, d / 2, z - 0.002)
    win(B, lw, 0.0, hw + 0.006, 0.028, 0.028, arch="round", bars="cross")
    # East end, either side of the tower.
    rw = Wm["right"]
    for u in (-0.122, 0.122):
        for z in zs:
            win(B, rw, u, z, 0.036, WH, bars="mullion", flush=True)
    W.roof(B, cx, 0, w, d, hw, rise, SLATE, over=0.005, over_gable=0.004,
           ridge_mat=SLATE_DK, gutter=ZINC)
    for u in (-w / 2 + 0.004, us[2] + pitch / 2):
        downpipe(B, cx + u, -d / 2 - 0.003, hw)
    # Stair tower with its tank.
    tx0, tx1, td, th = x1 - 0.004, 0.396, 0.18, 0.6
    tw = tx1 - tx0
    tcx = (tx0 + tx1) / 2
    B.body(K.body("tower", tw, td, th, centre=(tcx, 0), mat=BRICK,
                  edge=0.3))
    B.add(box("tplinth", (tw, td + 0.006, 0.026), (tcx, 0, 0.0115), GRIT))
    Wt = walls(tcx, 0, tw, td)
    K.door(B, Wt["front"], 0.0, 0.032, 0.07, MAROON, STONE, arch="round",
           fanlight=True, step=GRIT, panels=False, knob=None, fb=0.006)
    for k in range(6):
        z = 0.12 + k * 0.08
        win(B, Wt["front"], 0.0, z, 0.026, 0.046, arch="round",
            bars="mullion")
        if k:
            win(B, Wt["right"], 0.0, z - 0.04, 0.026, 0.046, arch="round",
                bars="mullion")
    for z in (0.098, 0.54):
        B.add(box("tband", (tw, td + 0.004, 0.006), (tcx, 0, z), STONE))
    B.add(box("tcorn", (tw, td + 0.008, 0.01), (tcx, 0, th - 0.002), STONE))
    # The tank: riveted iron plates on bearers.
    for y in (-0.05, 0.05):
        B.add(box("bearer", (tw - 0.004, 0.008, 0.006), (tcx, y, th + 0.006),
                  IRON))
    tk = (tw - 0.016, td - 0.02, 0.054)
    tz = th + 0.009 + tk[2] / 2
    B.add(box("tank", tk, (tcx, 0, tz), TANK))
    B.add(box("flange", (tk[0] + 0.003, tk[1] + 0.003, 0.003),
              (tcx, 0, th + 0.032), TANK))
    B.add(box("rim", (tk[0] + 0.004, tk[1] + 0.004, 0.003),
              (tcx, 0, th + 0.009 + tk[2]), IRON))
    for k in (-1, 1):
        B.add(box("rib", (0.003, tk[1] + 0.003, tk[2] - 0.004),
                  (tcx + k * 0.03, 0, tz), TANK))
        B.add(box("rib", (tk[0] + 0.003, 0.003, tk[2] - 0.004),
                  (tcx, k * 0.04, tz), TANK))
    W.carve(B)
    B.finish(r)
    return r


@asset
def mill_small(name):
    """A three-storey weaving mill: four bays of tall windows, a timber
    lucam (hoist housing) over a stack of loading doors, a datestone and
    a boiler-house stack on the east gable."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.396, 0.256, 0.32, 0.055
    cy = 0.0
    B.body(K.body("walls", w, d, hw, rise, "x", centre=(0, cy), mat=BRICK_DK,
                  edge=0.25))
    B.add(box("plinth", (w + 0.006, d + 0.006, 0.024), (0, cy, 0.0105),
              GRIT))
    Wm = walls(0, cy, w, d)
    f, bk = Wm["front"], Wm["back"]
    pitch = w / 4
    us = [-w / 2 + pitch * (i + 0.5) for i in range(4)]
    zs = [0.036, 0.138, 0.24]
    WH2 = 0.066
    for i, u in enumerate(us):
        for k, z in enumerate(zs):
            win(B, bk, -u, z, 0.048, WH2, bars="grid", flush=True)
            if i == 1:
                if k == 0:
                    plank_door(B, f, u, 0.05, 0.08, NAVY, arch="segment")
                    arch_ring(B, f, u, 0.05, 0.08, "segment", 0.007, STONE)
                else:
                    plank_door(B, f, u, 0.036, 0.07, NAVY, z0=z - 0.004)
                continue
            win(B, f, u, z, 0.048, WH2, arch="segment", bars="grid")
    for z in zs[1:]:
        sill_band(B, f, -w / 2, w / 2, z - 0.002)
        sill_band(B, bk, -w / 2, w / 2, z - 0.002)
    for side in ("left", "right"):
        for u in (-0.075, 0.0, 0.075):
            for z in zs:
                if side == "right" and u == 0.0 and z == zs[0]:
                    continue
                win(B, Wm[side], u, z, 0.04, WH2, arch="segment",
                    bars="grid", flush=True)
        win(B, Wm[side], 0.0, hw + 0.004, 0.024, 0.024, arch="round",
            bars="cross")
    K.door(B, Wm["right"], 0.0, 0.032, 0.066, MAROON, STONE,
           arch="segment", step=GRIT, panels=True, knob=None, fb=0.005)
    # Datestone and cornice.
    flat_box(B, f, (us[2] + us[3]) / 2, 0.3, 0.1, 0.016, PALE, proud=0.003)
    letters(B, f, (us[2] + us[3]) / 2, 0.3, 5, 0.08, 0.009)
    cornice(B, 0, cy, w, d, hw - 0.004, 0.008, STONE, out=0.003)
    W.roof(B, 0, cy, w, d, hw, rise, SLATE, over=0.006, over_gable=0.004,
           ridge_mat=SLATE_DK, gutter=ZINC)
    # The lucam: a timber hoist housing hung on the wall at the top.
    lu = us[1]
    ly = cy - d / 2
    lz0, lz1 = 0.25, 0.345
    B.add(box("lucam", (0.054, 0.016, lz1 - lz0),
              (lu, ly - 0.008, (lz0 + lz1) / 2), WEATHER))
    for k in (-1, 1):
        B.add(box("lpost", (0.004, 0.018, lz1 - lz0 + 0.002),
                  (lu + k * 0.027, ly - 0.009, (lz0 + lz1) / 2), TIMBER))
    B.add(box("lpanel", (0.034, 0.002, 0.05), (lu, ly - 0.0165, 0.29),
              PLANK))
    rl = Build("tmp")
    W.roof(rl, 0, 0, 0.06, 0.018, 0.0, 0.018, SLATE, ridge="y", over=0.003,
           over_gable=0.001)
    for o, uv in rl.parts:
        tf(o, T(lu, ly - 0.008, lz1))
        B.add(o, uv)
    B.add(box("lbrace", (0.004, 0.016, 0.004), (lu, ly - 0.008, lz0 - 0.003),
              TIMBER))
    B.add(cyl("lrope", 0.0007, 0.0007, 0.13, (lu, ly - 0.014, 0.12), 4, IRON))
    crate(B, lu, ly - 0.014, 0.014, 0.106, mat=CRATE, ang=10)
    # Boiler-house stack on the east gable.
    K.chimney(B, w / 2 - 0.03, cy, hw - 0.01, hw + rise + 0.06, 0.04, 0.05,
              BRICK_DEEP, cap=STONE, pots=0)
    for x in (-w / 2 + 0.006, w / 2 - 0.006):
        downpipe(B, x, cy - d / 2 - 0.003, hw)
    W.carve(B)
    B.finish(r)
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
    """A free-standing mill chimney, 25 m: stone-capped pedestal, tapering
    octagonal brick shaft with stone bands and iron hoops, corbelled cap."""
    r = root(name)
    B = Build(name)
    build_chimney(B, 0, 0)
    W.carve(B)
    B.finish(r)
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


def _platform(B, half, top=0.044):
    """A goods shed's raised loading bank: blue brick, flagged, a
    sandstone edge."""
    s = 2 * half
    B.add(gbox("bank", (s - 0.008, s - 0.008, top - 0.006),
               (0, 0, (top - 0.006) / 2 - 0.003), BLUE, edge=0.25))
    B.add(box("edge", (s - 0.002, s - 0.002, 0.007), (0, 0, top - 0.0045),
              GRIT, bevel=0.0008))
    B.add(box("flags", (s - 0.03, s - 0.03, 0.002), (0, 0, top - 0.0003),
              FLAGS))


def _skirt(B, inner, outer, z_in, z_out, mat, thick=0.004):
    """A canopy running round a square shed (hipped at the corners)."""
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


def _goods(B, half, core, hw, rise, door_w, door_h, top, canopy_z,
           lantern=0.03, storeys=1):
    """The shared goods shed: a brick core on a loading bank, a big
    boarded door and a timber canopy on every side, a hipped roof with a
    louvred lantern."""
    _platform(B, half, top)
    c = core
    B.body(K.body("core", 2 * c, 2 * c, hw, mat=BRICK, edge=0.2))
    Wm = walls(0, 0, 2 * c, 2 * c)
    for i, side in enumerate(("front", "right", "back", "left")):
        wl = Wm[side]
        leaf = (MAROON, GREEN, MAROON, GREEN)[i]
        plank_door(B, wl, 0.0, door_w, door_h, leaf, z0=top, arch="segment")
        arch_ring(B, wl, 0.0, door_w, door_h, "segment", 0.008, STONE,
                  z0=top)
        for u in (-c * 0.62, c * 0.62):
            win(B, wl, u, top + 0.05, 0.028, 0.05, arch="segment",
                bars="cross")
            if storeys > 1:
                win(B, wl, u, hw - 0.075, 0.028, 0.05, arch="segment",
                    bars="cross")
        if storeys > 1:
            plank_door(B, wl, 0.0, 0.04, 0.06, leaf, z0=hw - 0.085)
        # Sacks and crates by the door.
        cr = wl.at(c * 0.55, -(half - c) * 0.55, top)
        crate(B, cr.x, cr.y, 0.016, top, mat=CRATE, ang=7 * (i + 1))
        sk = wl.at(-c * 0.5, -(half - c) * 0.5, top)
        sacks(B, sk.x, sk.y, 2, z0=top, seed=i + 3)
    cornice(B, 0, 0, 2 * c, 2 * c, hw - 0.003, 0.007, STONE, out=0.003)
    W.hip(B, 0, 0, 2 * c, 2 * c, hw, rise, SLATE, over=0.008,
          ridge_mat=SLATE_DK)
    # Lantern.
    lz = hw + rise - 0.012
    B.add(box("lantern", (0.05, 0.05, lantern), (0, 0, lz + lantern / 2),
              WEATHER))
    for k in range(3):
        B.add(box("louvre", (0.054, 0.054, 0.0025),
                  (0, 0, lz + 0.006 + k * (lantern - 0.008) / 2), TIMBER))
    lid = Build("tmp")
    W.hip(lid, 0, 0, 0.064, 0.064, 0.0, 0.016, SLATE, over=0.004,
          thick=0.004)
    for o, uv in lid.parts:
        tf(o, T(0, 0, lz + lantern))
        B.add(o, uv)
    # The canopy all round, on brackets, with a valance.
    out = half - 0.004
    _skirt(B, c, out, canopy_z, canopy_z - 0.012, WEATHER)
    zo = canopy_z - 0.012
    for i in range(4):
        a = math.pi / 2 * i
        ca, sa = math.cos(a), math.sin(a)

        def P(u, v, z):
            return (ca * u - sa * v, sa * u + ca * v, z)
        valance(B, P(-out, -out - 0.0005, zo), P(out, -out - 0.0005, zo),
                0.01, FRAME, teeth=int(out * 2 / 0.042))
        for u in (-c * 0.7, c * 0.7):
            B.add(beam("bracket", P(u, -c - 0.001, canopy_z - 0.05),
                       P(u, -out + 0.012, zo - 0.002), (0.0025, 0.0025),
                       IRON))


@asset
def goods_shed(name):
    """A goods shed served from all four sides: a brick shed on a raised
    loading bank, a big boarded door and a timber canopy on every face,
    crates and sacks, a hipped slate roof with a louvred lantern."""
    r = root(name)
    B = Build(name)
    _goods(B, 0.2, 0.146, 0.212, 0.052, 0.07, 0.096, 0.044, 0.162,
           lantern=0.026)
    W.carve(B)
    B.finish(r)
    return r


@asset
def goods_grand(name):
    """The big goods station: a two-storey brick goods warehouse on a
    loading bank, doors, canopies and hoist doors on all four sides, and
    an iron travelling crane on trestle legs over the front."""
    r = root(name)
    B = Build(name)
    half = 0.25
    _goods(B, half, 0.18, 0.29, 0.078, 0.08, 0.12, 0.044, 0.196,
           lantern=0.034, storeys=2)
    # Travelling crane over the front bank.
    yc = -0.222
    gz = 0.33
    for x in (-0.236, 0.236):
        for k in (-1, 1):
            B.add(beam("leg", (x, yc + k * 0.022, 0.044), (x, yc, gz - 0.01),
                       (0.007, 0.007), OXIDE))
        B.add(box("foot", (0.014, 0.05, 0.006), (x, yc, 0.047), IRON))
        B.add(box("legtie", (0.004, 0.032, 0.004), (x, yc, 0.15), OXIDE))
    for k in (-1, 1):
        B.add(gbox("girder", (0.49, 0.006, 0.02), (0, yc + k * 0.011, gz),
                   OXIDE, edge=0.0))
    for i in range(7):
        x = -0.21 + i * 0.07
        B.add(box("web", (0.003, 0.022, 0.003), (x, yc, gz - 0.008), OXIDE))
    # The crab, its chain and a crate on the hook.
    cxr = 0.07
    B.add(box("crab", (0.034, 0.03, 0.016), (cxr, yc, gz + 0.016), IRON,
              bevel=0.001))
    B.add(cyl("cdrum", 0.006, 0.006, 0.028, (cxr, yc, gz + 0.016), 8, IRON,
              axis="y"))
    B.add(cyl("cchain", 0.0009, 0.0009, 0.13, (cxr, yc, gz - 0.13), 4, IRON))
    B.add(box("chook", (0.006, 0.004, 0.008), (cxr, yc, gz - 0.132), IRON))
    for k in (-1, 1):
        B.add(beam("sling", (cxr, yc, gz - 0.134),
                   (cxr + k * 0.01, yc, gz - 0.152), (0.001, 0.001), IRON))
    B.add(box("load", (0.024, 0.02, 0.018), (cxr, yc, gz - 0.161), CRATE,
              bevel=0.0008))
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


def _outcrop(name, seed, tors):
    """A gritstone outcrop filling one square: a heather ridge along Y,
    broken gritstone edges of flat slabs along both flanks, tors on the
    crest, a straight lined bore along Y and a stone portal on both
    faces."""
    rnd = random.Random(seed)
    r = root(name)
    B = Build(name)
    half, spring, rise = 0.18, 0.14, 0.1
    face_w, top = 0.54, 0.284
    off = seed * 1.7

    def h(x, y):
        a = abs(x) + 0.02 * W.fbm(y * 2.2, x * 0.5, off)
        crest = 0.292 + 0.014 * W.fbm(y * 1.4, 0.3, off + 4)
        if a < 0.235:
            v = crest
        elif a < 0.3:
            # Under the gritstone edge: a steep drop.
            t = (a - 0.235) / 0.065
            v = crest + (0.16 - crest) * t
        else:
            t = min(1.0, (a - 0.3) / 0.19)
            v = 0.16 * (1 - t) ** 1.4
        v += 0.006 * W.fbm(x * 3.5, y * 3.5, off + 2)
        if abs(x) > 0.47:
            v *= max(0.0, (0.5 - abs(x)) / 0.03)
        return min(0.322, max(0.003, v))
    mass = W.heightfield("moor", -0.497, 0.497, -0.47, 0.47, 16, 16, h,
                         mat=MOOR, side_mat=GRITSTONE)

    def rule(c, n):
        if n.z < 0.5:
            return GRITSTONE
        k = W.fbm(c.x * 1.8, c.y * 1.8, off + 5)
        if c.z > 0.16 and k > -0.3:
            return HEATHER
        if k > 0.2:
            return HEATHER_BR
        return MOOR
    W.paint(mass, rule)
    B.body(mass)
    for y, flip in ((-0.49, False), (0.49, True)):
        W.portal_face(B, 0.0, y, half, spring, rise, face_w, top, 0.045,
                      GRIT, STONE, n=12, ring=0.026, flip=flip)
        s = 1 if not flip else -1
        for k in (-1, 1):
            _wing(B, k * (face_w / 2 - 0.004), k * 0.486,
                  lambda x: max(0.012, h(x, y + s * 0.03) - 0.006),
                  y + (0.0 if s > 0 else -0.032), y + (0.032 if s > 0 else
                                                      0.0), GRIT, STONE)
    W.bore(B, 0.0, half, spring, rise, -0.494, 0.494, LINING, t=0.02,
           cut_t=0.02, cut_from=-0.53, cut_to=0.53)
    # Gritstone edges: a broken line of big blocks along each flank, two
    # courses each, their faces the cliff; boulders fallen below.
    for sx in (-1, 1):
        y = -0.43 + rnd.uniform(0.0, 0.03)
        while y < 0.4:
            L = min(rnd.uniform(0.09, 0.15), 0.44 - y)
            if L < 0.05:
                break
            yc = y + L / 2
            x = sx * rnd.uniform(0.262, 0.278)
            ztop = min(0.33, h(sx * 0.2, yc) + rnd.uniform(0.004, 0.026))
            zb = 0.13
            split = zb + (ztop - zb) * rnd.uniform(0.45, 0.6)
            yaw = rnd.uniform(-0.12, 0.12)
            sd = int((yc + 1) * 1000) * (3 if sx > 0 else 1)
            W.slab(B, (rnd.uniform(0.085, 0.1), L, split - zb + 0.006),
                   (x + sx * 0.006, yc, zb), yaw, GRITSTONE_DK,
                   seed * 131 + sd)
            W.slab(B, (rnd.uniform(0.07, 0.09), L * rnd.uniform(0.75, 0.95),
                       ztop - split), (x - sx * 0.004, yc +
                                       rnd.uniform(-0.01, 0.01), split),
                   yaw + rnd.uniform(-0.1, 0.1), GRITSTONE,
                   seed * 173 + sd)
            y += L + rnd.uniform(0.012, 0.045)
        for i in range(3):
            x = sx * rnd.uniform(0.34, 0.42)
            yy = rnd.uniform(-0.38, 0.38)
            sz = rnd.uniform(0.035, 0.055)
            W.slab(B, (sz, sz * 0.8, sz * 0.6), (x, yy, h(x, yy) - 0.01),
                   rnd.uniform(0, math.tau), GRITSTONE_DK,
                   seed * 77 + i + (10 if sx > 0 else 0))
    # Loose stones on the crest.
    for i in range(6):
        x, yy = rnd.uniform(-0.2, 0.2), rnd.uniform(-0.38, 0.38)
        sz = rnd.uniform(0.025, 0.04)
        W.slab(B, (sz, sz * 0.8, sz * 0.45), (x, yy, h(x, yy) - 0.006),
               rnd.uniform(0, math.tau), GRITSTONE, seed * 59 + i)
    # Tors: stacked slabs on the crest.
    for i, (x, y, layers) in enumerate(tors):
        z = h(x, y) - 0.01
        for j, (sx_, sy_, sz_) in enumerate(layers):
            W.slab(B, (sx_, sy_, sz_), (x + rnd.uniform(-0.006, 0.006),
                                        y + rnd.uniform(-0.006, 0.006), z),
                   rnd.uniform(0, math.tau), GRITSTONE if j % 2 == 0 else
                   GRITSTONE_DK, seed * 53 + i * 7 + j)
            z += sz_ - 0.004
    B.finish(r)
    return r


@asset
def outcrop_a(name):
    return _outcrop(name, 3, [
        (-0.16, 0.18, [(0.11, 0.09, 0.022), (0.08, 0.065, 0.02)]),
        (0.15, -0.22, [(0.09, 0.08, 0.026)]),
        (0.08, 0.3, [(0.07, 0.06, 0.018), (0.045, 0.04, 0.012)]),
    ])


@asset
def outcrop_b(name):
    return _outcrop(name, 8, [
        (0.15, 0.12, [(0.12, 0.08, 0.02), (0.09, 0.06, 0.02),
                      (0.05, 0.045, 0.012)]),
        (-0.17, -0.2, [(0.08, 0.07, 0.022)]),
        (-0.06, -0.34, [(0.07, 0.055, 0.016)]),
    ])


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
    """A cleared mill site: cinder ground over the brick footings of a
    mill (outer walls, cross walls, rows of column pads, an engine bed),
    weeds and rubble, and the mill chimney still standing in one corner."""
    r = root(name)
    B = Build(name)
    rnd = random.Random(33)
    B.add(gbox("ground", (0.79, 0.79, 0.006), (0, 0, 0.0), CINDER,
               edge=0.25))
    # Footings of a 0.7 x 0.3 mill and an engine house.
    mx0, mx1, my0, my1 = -0.36, 0.3, -0.22, 0.08
    t = 0.014
    walls_ = [((mx0 + mx1) / 2, my0, mx1 - mx0, t),
              ((mx0 + mx1) / 2, my1, mx1 - mx0, t)]
    for x in (mx0, -0.14, 0.08, mx1):
        walls_.append(("x", x, my0, my1))
    for wl in walls_:
        if wl[0] == "x":
            _, x, ya, yb = wl
            parts = [(ya, yb)]
            if x == -0.14:
                parts = [(ya, -0.1), (-0.02, yb)]
            for a, b in parts:
                hgt = rnd.uniform(0.01, 0.018)
                B.add(gbox("footing", (t, b - a + t, hgt),
                           (x, (a + b) / 2, hgt / 2), BRICK_DK, edge=0.0))
        else:
            cx_, y, L, tt = wl
            segs = [(mx0, -0.25), (-0.19, 0.0), (0.06, mx1)] if y == my0 \
                else [(mx0, mx1)]
            for a, b in segs:
                hgt = rnd.uniform(0.01, 0.018)
                B.add(gbox("footing", (b - a + t, tt, hgt),
                           ((a + b) / 2, y, hgt / 2), BRICK_DK, edge=0.0))
    for x in (-0.3, -0.24, -0.08, -0.02, 0.14, 0.2, 0.26):
        for y in (-0.15, -0.06, 0.01):
            B.add(box("pad", (0.014, 0.014, 0.008), (x, y, 0.004), GRIT))
    # Engine bed and boiler seating.
    B.add(gbox("bed", (0.1, 0.06, 0.016), (0.0, 0.2, 0.007), GRIT, edge=0.0,
               bevel=0.001))
    for x in (-0.03, 0.03):
        B.add(box("bolt", (0.006, 0.006, 0.006), (x, 0.2, 0.017), IRON))
    for x in (-0.3, -0.18):
        B.add(gbox("seat", (0.1, 0.05, 0.012), (x, 0.21, 0.005), BRICK,
                   edge=0.0))
    # Rubble heaps and weeds.
    for i in range(18):
        x, y = rnd.uniform(-0.37, 0.37), rnd.uniform(-0.37, 0.37)
        if x > 0.24 and y > 0.24:
            continue
        o = box("brick", (0.012, 0.006, 0.005), (0, 0, 0),
                rnd.choice((BRICK, BRICK_DK)))
        tf(o, T(x, y, 0.004) @ rot("Z", rnd.uniform(0, 180)))
        B.add(o)
    for i in range(9):
        x, y = rnd.uniform(-0.36, 0.36), rnd.uniform(-0.36, 0.36)
        if x > 0.22 and y > 0.22:
            continue
        o = ball("weed", 1.0, (0, 0, 0), WEED, seg=6, rings=3,
                 scale=(rnd.uniform(0.02, 0.035), rnd.uniform(0.015, 0.03),
                        0.007))
        tf(o, T(x, y, 0.003))
        B.add(o)
    for i in range(3):
        x, y = (-0.33 + i * 0.27, 0.32)
        o = lathe("rubble", [(0.04, -0.003), (0.03, 0.008), (0.012, 0.016),
                             (0.0, 0.017)], (0, 0, 0), 7,
                  (BRICK_DK, CINDER, BRICK)[i], close=False)
        for v in o.data.vertices:
            if v.co.z > 0:
                v.co.x *= rnd.uniform(0.7, 1.25)
                v.co.y *= rnd.uniform(0.7, 1.1)
                v.co.z *= rnd.uniform(0.7, 1.15)
        tf(o, T(x, y, 0.0))
        B.add(o)
    build_chimney(B, 0.33, 0.33)
    W.carve(B)
    B.finish(r)
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
            W.bore_check(r, 0.18, 0.14, 0.1, -0.6, 0.6, "straight through")
    if out:
        kit.export(roots, out)
        print("GLB bytes", os.path.getsize(out))
    if prev:
        W.render_previews(prev, roots)


main()
