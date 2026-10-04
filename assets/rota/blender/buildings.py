"""Rota's buildings: painted resin model-railway buildings in late-afternoon
sun (docs/concepts/2026-10-02-rota-3d/brief.md).

One grid square is one metre, the ground is z = 0, fronts face -Y. Every
asset is a root empty at its footprint centre with one joined mesh under it
(the windmill's sails are a second child, `blades`, turning about local Y
round its origin at the hub).

  Blender -b --factory-startup --python assets/rota/blender/buildings.py -- \
      assets/rota/build/buildings.glb docs/concepts/2026-10-02-rota-3d/previews/buildings.png

With a preview path it renders the line-up there and close-ups from the
game camera (elevation 55, azimuth 0 and 30, a 1 m reference square)
beside it as buildings-<asset>.png. ROTA_ONLY=name,name builds a subset.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rkit  # noqa: E402

kit = rkit.kit
rkit.reset(seed=5)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import building_kit as K  # noqa: E402
from building_kit import (arc_profile, along_y, railing_ring, Build, Wall, walls, window, door, gable_roof,  # noqa
                          hip_roof, chimney, downpipe, plinth, band_course,
                          gbox, box, cyl, lathe, ball, beam, prism_xz,
                          extrude_x, mesh, tf, T, rot, uv_cyl, awning,
                          valance, clock, bench, lamp_post, churn, crate,
                          barrel, profile_roof, body_profile)

# ---------------------------------------------------------------- palette
# Tints are the surfaces' true colours: the game's tiles add painted light
# and shade around them (divided by the tile's own average), as Arena's
# scenery does.

TINTS = {
    # plaster
    "cream": "#efe1c3", "peach": "#ecc39e", "rose": "#e2b2a2",
    "sage": "#c3cfa6", "sky": "#bccfd8", "butter": "#efd894",
    "lime": "#f3ede0", "ochre": "#dcb170",
    # brick
    "red": "#a9503a", "rust": "#b8683f", "plum": "#87443a", "buff": "#cfae80",
    # roofs
    "terracotta": "#c0643c", "tile-rust": "#a95238", "tile-sun": "#d38257",
    "slate-blue": "#66748a", "slate-grey": "#707780", "slate-dark": "#4b5360",
    "thatch": "#c8a25e", "thatch-ridge": "#a8854a",
    # wood
    "barn": "#a63a2c", "oak": "#8c6a48", "timber": "#4f3a2d",
    "weathered": "#9b9187", "deck": "#a68560",
    # stone and paving
    "sand": "#c2ad8a", "granite": "#a19c92", "flag": "#b7aea0",
    "portal": "#b3a587", "setts": "#938c80",
    # paint
    "trim": "#f3ecdc", "white": "#f6f4ee", "green": "#3f6b4e",
    "bottle": "#2f5a45", "blue": "#3f5f86", "navy": "#2c3e5c",
    "maroon": "#6c2b2b", "redpaint": "#b33a2e", "mustard": "#c99a3c",
    "teal": "#3c7a77", "black": "#25262a", "pot": "#b86140",
    "clockface": "#f7f3e6", "gold": "#c9a04c", "flower-red": "#d4504a",
    "flower-pink": "#e58fa8", "flower-yellow": "#efc94a",
    "flower-white": "#f4f1ea", "stripe": "#c8463c", "canopy": "#d9ccab", "stripe-green": "#4f8a5c",
    "sign": "#2f4f6f", "lh-red": "#c43a2f", "sail": "#eee5cf", "concrete": "#cfc8b8",
    # metal, glass, glow
    "iron": "#45494f", "zinc": "#8e959c", "brass": "#c49a4a",
    "copper": "#6fa596", "dark": "#2a3442", "shed": "#9dbac6",
    "window": "#ffc979", "lamp": "#fff1c4",
    # leaves
    "leaf": "#6a8a45", "hedge": "#58743c",
    "void": "#050505", "portal": "#b9ab8d", "lining": "#5b554d",
    "road": "#3a3d42", "grey": "#9a948a", "roof": "#5d6065",
    "terrace": "#b2a898",
}
for _n, _h in TINTS.items():
    kit.tint(_n, _h)

GLASS = "glass:dark"
SHED = "glass:shed"
GLOW = "glow:window"
LAMP = "glow:lamp"
TRIM = "paint:trim"
WHITE = "paint:white"
ZINC = "metal:zinc"
IRON = "metal:iron"
BRASS = "metal:brass"
SAND = "stone:sand"
POT = "paint:pot"
VOID = "plain:void"
FLOWERS = {
    "red": ("paint:green", "foliage:leaf", "paint:flower-red"),
    "pink": (TRIM, "foliage:leaf", "paint:flower-pink"),
    "yellow": ("paint:blue", "foliage:leaf", "paint:flower-yellow"),
    "white": ("wood:oak", "foliage:leaf", "paint:flower-white"),
}

ASSETS = {}


def asset(fn):
    ASSETS[fn.__name__] = fn
    return fn


def root(name):
    return kit.empty(name)


# ---------------------------------------------------------------- houses

@asset
def house_a(name):
    """A cream plaster cottage: terracotta gable, green shutters, flower
    boxes, a door hood and an end chimney."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.19, 0.145, 0.112, 0.072
    B.body(K.body("walls", w, d, hw, rise, "x", mat="plaster:cream"))
    plinth(B, 0, 0, w, d, 0.012, "stone:granite")
    W = walls(0, 0, w, d)
    f = W["front"]
    door(B, f, 0.0, 0.032, 0.056, "paint:green", TRIM, fanlight=True)
    # Door hood on brackets.
    B.add(f.put(box("hood", (0.048, 0.016, 0.004), (0, -0.008, 0.065),
                    "roof:terracotta", bevel=0.001)))
    for k in (-1, 1):
        B.add(f.put(box("bracket", (0.003, 0.012, 0.007),
                        (k * 0.021, -0.006, 0.0605), TRIM)))
    for u in (-0.062, 0.062):
        window(B, f, u, 0.024, 0.03, 0.034, TRIM, bars="sash", sill=SAND,
               shutters="paint:green", flowers=FLOWERS["red"])
        window(B, f, u, 0.076, 0.028, 0.026, TRIM, bars="cross", sill=SAND,
               shutters="paint:green")
    window(B, f, 0, 0.076, 0.022, 0.024, TRIM, bars="cross", sill=SAND)
    for side in ("left", "right"):
        window(B, W[side], 0.0, 0.122, 0.022, 0.026, TRIM, bars="cross",
               sill=SAND)
        window(B, W[side], -0.03, 0.03, 0.026, 0.032, TRIM, bars="sash",
               sill=SAND)
    window(B, W["back"], 0.04, 0.03, 0.028, 0.032, TRIM, bars="sash",
           sill=SAND)
    gable_roof(B, 0, 0, w, d, hw, rise, "roof:terracotta",
               ridge_mat="roof:tile-rust", barge=TRIM, gutter=ZINC)
    chimney(B, 0.072, 0.0, 0.12, 0.206, 0.03, 0.024, "brick:red")
    downpipe(B, w / 2 - 0.004, -d / 2 - 0.004, hw)
    downpipe(B, -w / 2 + 0.004, d / 2 + 0.004, hw)
    B.finish(r)
    return r


@asset
def house_b(name):
    """A narrow red-brick townhouse, gable to the street, three storeys,
    stone dressings, a slate roof and a fanlit door."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.125, 0.17, 0.158, 0.042
    B.body(K.body("walls", w, d, hw, rise, "y", mat="brick:red"))
    plinth(B, 0, 0, w, d, 0.01, SAND)
    band_course(B, 0, 0, w, d, 0.064, 0.004, SAND)
    band_course(B, 0, 0, w, d, 0.114, 0.004, SAND)
    W = walls(0, 0, w, d)
    f = W["front"]
    door(B, f, -0.03, 0.03, 0.054, "paint:navy", TRIM, arch="round",
         fanlight=True)
    window(B, f, 0.028, 0.018, 0.034, 0.038, TRIM, bars="sash", sill=SAND,
           lintel=SAND, flowers=FLOWERS["pink"])
    for u in (-0.03, 0.03):
        window(B, f, u, 0.074, 0.028, 0.034, TRIM, bars="sash", sill=SAND,
               lintel=SAND)
        window(B, f, u, 0.124, 0.026, 0.028, TRIM, bars="sash", sill=SAND,
               lintel=SAND)
    # Round window in the gable.
    window(B, f, 0.0, 0.168, 0.018, 0.018, TRIM, arch="round", bars=None,
           fb=0.003)
    for side in ("left", "right"):
        u = 0.04 if side == "left" else -0.04
        window(B, W[side], u, 0.074, 0.024, 0.032, TRIM, bars="sash",
               sill=SAND, lintel=SAND)
        window(B, W[side], u, 0.124, 0.024, 0.028, TRIM, bars="sash",
               sill=SAND, lintel=SAND)
        window(B, W[side], -u, 0.02, 0.024, 0.034, TRIM, bars="sash",
               sill=SAND, lintel=SAND)
    gable_roof(B, 0, 0, w, d, hw, rise, "slate:slate-blue", ridge="y",
               over=0.01, over_gable=0.006, ridge_mat="slate:slate-dark",
               barge=TRIM, gutter=ZINC)
    # Stone coping and kneelers on the street gable.
    chimney(B, 0.0, 0.062, 0.17, 0.206, 0.05, 0.022, "brick:red", pots=3)
    downpipe(B, w / 2 + 0.003, -d / 2 + 0.006, hw)
    B.finish(r)
    return r


@asset
def house_c(name):
    """A half-timbered house: a brick ground floor, a jettied upper storey
    of white plaster and dark oak, a steep terracotta roof."""
    r = root(name)
    B = Build(name)
    w, d, h1 = 0.17, 0.13, 0.068
    jet = 0.007
    w2, d2, hw, rise = w + 2 * jet, d + 2 * jet, 0.136, 0.064
    B.body(K.body("ground", w, d, h1, 0, mat="brick:rust"))
    B.body(K.body("upper", w2, d2, hw, rise, "x", mat="plaster:lime",
                  z0=h1))
    plinth(B, 0, 0, w, d, 0.009, "stone:granite")
    # The jetty's bressummer beam and joist ends.
    band_course(B, 0, 0, w2, d2, h1 + 0.002, 0.005, "wood:timber", out=0.001)
    W = walls(0, 0, w, d)
    U = walls(0, 0, w2, d2)
    f = W["front"]
    door(B, f, -0.045, 0.03, 0.052, "wood:oak", "wood:timber", step=SAND,
         panels=True)
    window(B, f, 0.03, 0.02, 0.056, 0.03, "wood:timber", bars="grid",
           sill="wood:timber", flowers=FLOWERS["yellow"])
    for side in ("left", "right"):
        window(B, W[side], 0.0, 0.02, 0.03, 0.03, "wood:timber",
               bars="cross", sill="wood:timber")
    # Timber frame on the upper storey.
    T_ = "wood:timber"
    uf = U["front"]
    z0, z1 = h1 + 0.0045, hw
    for u in (-w2 / 2 + 0.003, -0.03, 0.03, w2 / 2 - 0.003):
        B.add(uf.put(box("post", (0.0045, 0.0026, z1 - z0),
                         (u, -0.0012, (z0 + z1) / 2), T_)))
    B.add(uf.put(box("rail", (w2, 0.0026, 0.0045),
                     (0, -0.0012, z1 - 0.002), T_)))
    B.add(uf.put(box("rail", (w2, 0.0026, 0.004),
                     (0, -0.0012, h1 + 0.024), T_)))
    for (ua, ub) in ((-w2 / 2 + 0.005, -0.032), (w2 / 2 - 0.005, 0.032)):
        B.add(uf.put(beam("brace", (ua, -0.0012, z0 + 0.001),
                          (ub, -0.0012, h1 + 0.022), (0.0026, 0.004), T_,
                          up=Vector((0, -1, 0)))))
        B.add(uf.put(beam("brace", (ua, -0.0012, z1 - 0.003),
                          (ub, -0.0012, h1 + 0.027), (0.0026, 0.004), T_,
                          up=Vector((0, -1, 0)))))
    window(B, uf, 0.0, h1 + 0.03, 0.05, 0.03, T_, bars="grid", sill=T_,
           fb=0.0025, flowers=FLOWERS["red"])
    for u in (-0.053, 0.053):
        window(B, uf, u, h1 + 0.034, 0.02, 0.026, T_, bars="cross", fb=0.002)
    # Gable ends: posts, collar and king post.
    for side in ("left", "right"):
        g = U[side]
        for u in (-d2 / 2 + 0.003, d2 / 2 - 0.003, -0.03, 0.03):
            B.add(g.put(box("post", (0.0045, 0.0026, z1 - z0),
                            (u, -0.0012, (z0 + z1) / 2), T_)))
        B.add(g.put(box("rail", (d2, 0.0026, 0.0045),
                        (0, -0.0012, z1 - 0.002), T_)))
        B.add(g.put(box("king", (0.0045, 0.0026, rise - 0.006),
                        (0, -0.0012, hw + (rise - 0.006) / 2), T_)))
        for k in (-1, 1):
            B.add(g.put(beam("rafter", (k * d2 / 2, -0.0012, hw),
                             (0, -0.0012, hw + rise), (0.0026, 0.0045), T_,
                             up=Vector((0, -1, 0)))))
        window(B, g, 0.0, h1 + 0.03, 0.022, 0.026, T_, bars="cross",
               fb=0.002)
    gable_roof(B, 0, 0, w2, d2, hw, rise, "roof:tile-sun",
               ridge_mat="roof:tile-rust", barge="wood:timber", over=0.011,
               gutter=None)
    chimney(B, -0.045, 0.024, 0.15, 0.204, 0.026, 0.022, "brick:rust",
            pots=1)
    B.finish(r)
    return r


@asset
def house_d(name):
    """A corner shop: butter plaster, a green shopfront with a striped
    awning and fascia, slate roof, rooms above."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.2, 0.145, 0.132, 0.058
    B.body(K.body("walls", w, d, hw, rise, "x", mat="plaster:butter"))
    plinth(B, 0, 0, w, d, 0.008, "stone:granite")
    band_course(B, 0, 0, w, d, 0.071, 0.004, TRIM)
    band_course(B, 0, 0, w, d, hw - 0.003, 0.006, TRIM, out=0.003)
    W = walls(0, 0, w, d)
    f = W["front"]
    GRN = "paint:bottle"
    # Shopfront: pilasters, stall riser, big glazed window, glazed door.
    B.add(f.put(box("front", (0.17, 0.006, 0.066), (0.0, -0.002, 0.033),
                    GRN)))
    window(B, f, 0.025, 0.016, 0.098, 0.04, GRN, bars="vertical",
           glass=GLOW, recess=0.007, fb=0.0, sill=TRIM)
    door(B, f, -0.06, 0.03, 0.054, GRN, GRN, fanlight=True, step=SAND,
         panels=False, fb=0.0)
    B.add(f.put(box("doorglass", (0.018, 0.001, 0.022),
                    (-0.06, 0.0035, 0.032), GLASS)))
    for u in (-0.084, -0.038, 0.084):
        B.add(f.put(box("pilaster", (0.006, 0.009, 0.064),
                        (u, -0.004, 0.032), GRN)))
    # Fascia with gilt lettering.
    B.add(f.put(box("fascia", (0.176, 0.01, 0.012), (0, -0.006, 0.062),
                    "paint:sign", bevel=0.0008)))
    for i in range(9):
        B.add(f.put(box("letter", (0.008, 0.001, 0.0045),
                        (-0.05 + i * 0.0125, -0.0113, 0.0625),
                        "paint:gold")))
    awning(B, f, 0.025, 0.054, 0.104, 0.032, 0.014,
           ["paint:stripe", WHITE], n=9)
    for u in (-0.06, 0.0, 0.06):
        window(B, f, u, 0.084, 0.03, 0.034, TRIM, bars="sash", sill=TRIM,
               lintel=TRIM, flowers=FLOWERS["pink"] if u == 0 else None)
    for side in ("left", "right"):
        window(B, W[side], -0.02, 0.084, 0.026, 0.032, TRIM, bars="sash",
               sill=TRIM)
        window(B, W[side], 0.0, 0.142, 0.02, 0.024, TRIM, bars="cross",
               sill=TRIM)
    window(B, W["left"], 0.035, 0.02, 0.026, 0.032, TRIM, bars="sash",
           sill=TRIM)
    gable_roof(B, 0, 0, w, d, hw, rise, "slate:slate-grey",
               ridge_mat="slate:slate-dark", barge=TRIM, gutter=ZINC)
    chimney(B, -0.07, 0.0, 0.16, 0.205, 0.03, 0.024, "brick:red")
    chimney(B, 0.07, 0.0, 0.16, 0.205, 0.03, 0.024, "brick:red", pots=1)
    downpipe(B, w / 2 - 0.004, -d / 2 - 0.004, hw)
    # Crates of produce under the awning.
    crate(B, 0.07, -d / 2 - 0.014, 0.014, ang=6)
    B.add(ball("apples", 0.0062, (0.07, -d / 2 - 0.014, 0.0145),
               "paint:flower-red", seg=6, rings=3, scale=(1, 1, 0.55)))
    crate(B, 0.051, -d / 2 - 0.012, 0.012, ang=-8)
    B.add(ball("greens", 0.0054, (0.051, -d / 2 - 0.012, 0.0125),
               "foliage:leaf", seg=6, rings=3, scale=(1, 1, 0.6)))
    B.finish(r)
    return r


@asset
def house_e(name):
    """A buff-brick house with two white dormers in a steep slate roof,
    a columned porch and twin end chimneys."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.19, 0.14, 0.084, 0.094
    B.body(K.body("walls", w, d, hw, rise, "x", mat="brick:buff"))
    plinth(B, 0, 0, w, d, 0.01, "stone:granite")
    band_course(B, 0, 0, w, d, hw - 0.003, 0.005, TRIM, out=0.003)
    W = walls(0, 0, w, d)
    f = W["front"]
    door(B, f, 0.0, 0.03, 0.054, "paint:redpaint", TRIM, fanlight=True,
         step=None)
    # Porch: steps, two columns, a little pediment.
    B.add(f.put(box("pstep", (0.05, 0.022, 0.006), (0, -0.011, 0.0015),
                    SAND, bevel=0.0008)))
    for k in (-1, 1):
        B.add(f.put(cyl("col", 0.0025, 0.0025, 0.056,
                        (k * 0.02, -0.018, 0.0045), 8, WHITE, rings=1)))
    B.add(f.put(box("entab", (0.05, 0.024, 0.005), (0, -0.011, 0.063),
                    WHITE, bevel=0.0007)))
    pr = [(-0.027, 0.0655), (0.027, 0.0655), (0.0, 0.078)]
    B.add(f.put(prism_xz("pediment", pr, -0.024, 0.0, WHITE)))
    pr2 = [(-0.03, 0.0645), (0.0, 0.0805), (0.0, 0.0825), (-0.032, 0.0665)]
    B.add(f.put(prism_xz("proof", pr2, -0.026, 0.001, "slate:slate-blue")))
    B.add(f.put(prism_xz("proof", [(-x, z) for x, z in pr2][::-1], -0.026,
                         0.001, "slate:slate-blue")))
    for u in (-0.058, 0.058):
        window(B, f, u, 0.022, 0.034, 0.038, TRIM, bars="sash", sill=SAND,
               lintel=SAND, keystone=SAND)
    for side in ("left", "right"):
        window(B, W[side], 0.0, 0.106, 0.022, 0.03, TRIM, bars="sash",
               sill=SAND)
        window(B, W[side], 0.03, 0.024, 0.026, 0.034, TRIM, bars="sash",
               sill=SAND, lintel=SAND)
    # Dormers on the front slope.
    half = d / 2
    for u in (-0.05, 0.05):
        yf = -half + 0.026
        zr = K.roof_z(hw, rise, half, yf)
        dw, dh, drise = 0.042, zr + 0.038, 0.017
        dd = -yf
        B.body(K.body("dormer", dw, dd, dh, drise, "y",
                      centre=(u, yf + dd / 2), mat="plaster:lime",
                      z0=hw + 0.004, bevel=0.0, edge=0.06))
        dwl = Wall((u, yf, 0), (0, -1, 0))
        window(B, dwl, 0.0, zr + 0.009, 0.028, 0.026, TRIM, bars="cross",
               fb=0.003)
        gable_roof(B, u, yf + dd / 2 - 0.003, dw, dd + 0.006, dh, drise,
                   "slate:slate-blue", ridge="y", over=0.005,
                   over_gable=0.003, thick=0.004, barge=TRIM)
    gable_roof(B, 0, 0, w, d, hw, rise, "slate:slate-blue",
               ridge_mat="slate:slate-dark", barge=None, gutter=ZINC,
               over_gable=0.006)
    for x in (-w / 2 + 0.014, w / 2 - 0.014):
        chimney(B, x, 0.0, 0.15, 0.206, 0.03, 0.04, "brick:buff", pots=2)
    downpipe(B, -w / 2 - 0.004, -d / 2 + 0.004, hw)
    B.finish(r)
    return r


@asset
def house_f(name):
    """A thatched cottage: whitewashed walls on a stone footing, a deep
    rounded thatch with a patterned ridge, lattice windows, a rose by the
    door."""
    r = root(name)
    B = Build(name)
    w, d, hw, rise = 0.19, 0.13, 0.074, 0.084
    B.body(K.body("walls", w, d, hw, rise, "x", mat="plaster:lime"))
    plinth(B, 0, 0, w, d, 0.018, "stone:granite", out=0.004)
    W = walls(0, 0, w, d)
    f = W["front"]
    door(B, f, -0.02, 0.028, 0.05, "paint:blue", "wood:oak", step=SAND)
    for u in (-0.064, 0.036, 0.074):
        window(B, f, u, 0.026, 0.026 if u != 0.036 else 0.034, 0.028,
               "wood:oak", bars="cross", sill="wood:oak",
               flowers=FLOWERS["pink"] if u == 0.036 else None)
    for side in ("left", "right"):
        window(B, W[side], 0.0, 0.096, 0.02, 0.022, "wood:oak", bars="cross",
               sill="wood:oak")
        window(B, W[side], -0.03, 0.026, 0.024, 0.026, "wood:oak",
               bars="cross", sill="wood:oak")
    # Deep, soft thatch: thick, big overhang, rounded by a heavy bevel.
    th = "bark:thatch"
    prof = []
    over = 0.022
    a = math.atan2(rise, d / 2)
    for i in range(5):
        f_ = i / 4
        s = -d / 2 - over * math.cos(a) + (d / 2 + over * math.cos(a)) * f_
        z = hw - over * math.sin(a) + (rise + over * math.sin(a)) * f_
        z += 0.006 * math.sin(math.pi * f_)          # a soft belly
        prof.append((s, z))
    o = len(B.parts)
    rz = K.profile_roof(B, 0, 0, w, prof, th, thick=0.016, over_gable=0.016,
                        edge=0.055)
    roof = B.parts[o][0]
    roof.modifiers.clear()
    kit.add_bevel(roof, 0.006, 2, angle=30)
    # Eyebrow dormer: the thatch swells over an upper window.
    yf = -d / 2 - 0.001
    zt = hw + 0.016 / math.cos(a) + 0.003      # thatch surface at the wall
    ex, ew = 0.034, 0.05
    B.body(K.body("eyebrow", ew, 0.05, zt + 0.024, 0.012, "y",
                  centre=(ex, yf + 0.025), mat="plaster:lime", z0=hw,
                  bevel=0.001, edge=0.06))
    window(B, Wall((ex, yf, 0), (0, -1, 0)), 0.0, zt + 0.002, 0.03, 0.017,
           "wood:oak", bars="grid", fb=0.0025)
    o = len(B.parts)
    z1 = zt + 0.024
    eb = [(-0.036, z1 - 0.012), (-0.02, z1 + 0.006), (0.0, z1 + 0.012)]
    K.profile_roof(B, ex, yf + 0.016, 0.036, eb, th, thick=0.012,
                   ridge="y", over_gable=0.012, edge=0.05)
    B.parts[o][0].modifiers.clear()
    kit.add_bevel(B.parts[o][0], 0.005, 2, angle=30)
    # Ridge: a raised block with a scalloped lower edge on both slopes.
    L = w + 0.03
    B.add(gbox("ridge", (L, 0.026, 0.008), (0, 0, rz - 0.001),
               "bark:thatch-ridge", bevel=0.003, seg=1, edge=0.08))
    for k in (-1, 1):
        n = 6
        for i in range(n):
            x = -L / 2 + L * (i + 0.5) / n
            sb = ball("scallop", 1, (0, 0, 0), "bark:thatch-ridge", seg=5,
                      rings=3, scale=(L / n * 0.6, 0.007, 0.0035))
            tf(sb, T(x, k * 0.013, rz - 0.0045) @ rot("X", k * 38))
            B.add(sb)
    chimney(B, w / 2 - 0.022, 0.012, 0.12, 0.204, 0.03, 0.026, "brick:red",
            pots=1)
    # A climbing rose beside the door.
    for i, (dx, dz, s) in enumerate(((0.0, 0.012, 0.011), (0.004, 0.03, 0.01),
                                     (-0.002, 0.046, 0.009))):
        B.add(ball("rose", s, (-0.045 + dx, -d / 2 - 0.006, dz),
                   "foliage:leaf", seg=6, rings=3, scale=(1, 0.55, 1)))
    for (dx, dz) in ((0.004, 0.016), (-0.004, 0.034), (0.002, 0.05)):
        B.add(box("bloom", (0.003, 0.003, 0.003),
                  (-0.045 + dx, -d / 2 - 0.0115, dz), "paint:flower-red"))
    B.finish(r)
    return r


# ---------------------------------------------------------------- stations

@asset
def station(name):
    """A country station: a red-brick hall with arched windows and stone
    dressings, a slate roof with a clock gable over the porch, a chimney,
    and a canopied platform on the +X side with benches and lamps."""
    r = root(name)
    B = Build(name)
    cx, w, d, hw, rise = -0.055, 0.205, 0.17, 0.112, 0.06
    BR = "brick:red"
    B.body(K.body("hall", w, d, hw, rise, "x", centre=(cx, 0), mat=BR))
    plinth(B, cx, 0, w, d, 0.014, SAND)
    band_course(B, cx, 0, w, d, 0.05, 0.004, SAND)
    band_course(B, cx, 0, w, d, hw - 0.003, 0.006, SAND, out=0.003)
    # Entrance pavilion with its own gable towards the square.
    pw, pd, ph, prise = 0.078, 0.032, hw, 0.05
    py = -d / 2 - pd / 2 + 0.006
    B.body(K.body("pavilion", pw, pd + 0.012, ph, prise, "y",
                  centre=(cx, py), mat=BR))
    plinth(B, cx, py, pw, pd + 0.012, 0.014, SAND)
    band_course(B, cx, py, pw, pd + 0.012, 0.05, 0.004, SAND)
    band_course(B, cx, py, pw, pd + 0.012, hw - 0.003, 0.006, SAND, out=0.003)
    W = walls(cx, 0, w, d)
    P = walls(cx, py, pw, pd + 0.012)
    pf = P["front"]
    door(B, pf, 0.0, 0.034, 0.064, "paint:bottle", SAND, arch="round",
         fanlight=True, double=True, step=None)
    # Porch: two iron columns and a little glazed canopy over the door.
    B.add(pf.put(box("pstep", (0.06, 0.03, 0.006), (0, -0.012, 0.0015),
                     SAND, bevel=0.0008)))
    for k in (-1, 1):
        B.add(pf.put(cyl("pcol", 0.0022, 0.0022, 0.07,
                         (k * 0.026, -0.024, 0.0045), 8, "paint:bottle",
                         rings=1)))
    B.add(pf.put(beam("pcan", (-0.032, -0.001, 0.08), (-0.032, -0.03, 0.074),
                      (0.0016, 0.004), "paint:bottle")))
    B.add(pf.put(beam("pcan", (0.032, -0.001, 0.08), (0.032, -0.03, 0.074),
                      (0.0016, 0.004), "paint:bottle")))
    B.add(pf.put(K.extrude_x("pglass", [(-0.001, 0.0815), (-0.031, 0.0755),
                                        (-0.031, 0.0735), (-0.001, 0.0795)],
                             -0.034, 0.034, 2, SHED)))
    for k in (-1, 0, 1):
        B.add(pf.put(beam("pcanbar", (k * 0.033, -0.001, 0.0815),
                          (k * 0.033, -0.031, 0.0755), (0.0016, 0.0022),
                          "paint:bottle")))
    valance(B, pf.at(-0.034, -0.031, 0.0745), pf.at(0.034, -0.031, 0.0745),
            0.006, "paint:trim")
    window(B, pf, 0.0, 0.124, 0.016, 0.016, SAND, arch="round", bars=None,
           fb=0.003)
    # Planters either side of the porch.
    for k in (-1, 1):
        x, y = pf.at(k * 0.043, -0.008, 0)[:2]
        B.add(cyl("planter", 0.0055, 0.0065, 0.011, (x, y, 0), 8, "stone:sand"))
        B.add(ball("shrub", 0.0085, (x, y, 0.016), "foliage:leaf", seg=7,
                   rings=4))
        for i in range(3):
            a_ = i * 2.1 + (0.4 if k > 0 else 0)
            B.add(box("bloom", (0.0028, 0.0028, 0.0028),
                      (x + math.cos(a_) * 0.006, y + math.sin(a_) * 0.006,
                       0.02 + 0.002 * i), "paint:flower-red"))
    # Name board over the porch.
    B.add(pf.put(box("board", (0.06, 0.003, 0.009), (0, -0.0015, 0.095),
                     "paint:sign", bevel=0.0006)))
    B.add(pf.put(box("letters", (0.044, 0.001, 0.003), (0, -0.0035, 0.095),
                     "paint:clockface")))
    f = W["front"]
    for u in (-0.078, 0.078):
        window(B, f, u, 0.026, 0.028, 0.052, SAND, arch="round",
               bars="cross", sill=SAND, glass=GLOW if u < 0 else GLASS,
               fb=0.004, keystone=SAND)
    for side, us in (("left", (-0.045, 0.045)), ("right", (-0.05,))):
        for u in us:
            window(B, W[side], u, 0.026, 0.026, 0.05, SAND, arch="round",
                   bars="cross", sill=SAND, fb=0.004, keystone=SAND)
    door(B, W["right"], 0.035, 0.03, 0.058, "paint:bottle", SAND,
         arch="round", fanlight=True, step=None)
    for u in (-0.06, 0.06):
        window(B, W["back"], u, 0.026, 0.026, 0.05, SAND, arch="round",
               bars="cross", sill=SAND, fb=0.004)
    gable_roof(B, cx, 0, w, d, hw, rise, "slate:slate-blue",
               ridge_mat="slate:slate-dark", barge="paint:trim",
               gutter=ZINC, over=0.012)
    gable_roof(B, cx, py - 0.003, pw, pd + 0.02, ph, prise,
               "slate:slate-blue", ridge="y", over=0.009, over_gable=0.008,
               barge="paint:trim", ridge_mat="slate:slate-dark")
    # Finial on the clock gable.
    B.add(cyl("finial", 0.0022, 0.0008, 0.014,
              (cx, py - pd / 2 - 0.012, ph + prise + 0.004), 6, IRON))
    chimney(B, cx - 0.072, 0.022, 0.14, 0.205, 0.028, 0.026, BR, pots=2)
    # Clock turret on the ridge: louvred, four clock faces, a lead spire.
    tx, tw = cx + 0.045, 0.034
    rz = hw + rise
    B.add(gbox("turret", (tw, tw, 0.05), (tx, 0, rz + 0.012), "paint:trim",
               bevel=0.0008, seg=1, edge=0.06))
    B.add(box("tbase", (tw + 0.006, tw + 0.006, 0.005), (tx, 0, rz + 0.004),
              "paint:bottle", bevel=0.0008))
    B.add(box("tcorn", (tw + 0.007, tw + 0.007, 0.004), (tx, 0, rz + 0.0385),
              "paint:bottle", bevel=0.0008))
    for nrm in ((0, -1, 0), (1, 0, 0), (-1, 0, 0), (0, 1, 0)):
        wl = Wall((tx + nrm[0] * tw / 2, nrm[1] * tw / 2, 0), nrm)
        clock(B, wl, 0.0, rz + 0.022, 0.0115)
    spire = cyl("tspire", tw * 0.74, 0.0, 0.03, (tx, 0, rz + 0.0405), 4,
                "slate:slate-dark", rings=1)
    tf(spire, T(tx, 0) @ rot("Z", 45) @ T(-tx, 0))
    B.add(spire)
    B.add(cyl("tfin", 0.0012, 0.0004, 0.014, (tx, 0, rz + 0.069), 6, IRON))
    B.add(ball("tball", 0.0022, (tx, 0, rz + 0.071), BRASS, seg=6, rings=3))
    # Platform along +X: stone edge, flagged top.
    px0, px1 = cx + w / 2 - 0.004, 0.168
    pl_y = 0.165
    ptop = 0.03
    B.add(gbox("platform", (px1 - px0, 2 * pl_y, ptop + 0.003),
               ((px0 + px1) / 2, 0, (ptop - 0.003) / 2), "stone:flag",
               edge=0.05))
    B.add(gbox("coping", (0.01, 2 * pl_y, 0.004),
               (px1 - 0.005, 0, ptop + 0.0005), "paint:white", edge=0.08))
    # Canopy: posts along the platform edge, a lean-to roof, valance.
    cx0, cx1 = px0, px1 - 0.012
    zc0, zc1 = hw - 0.006, hw - 0.022
    for y in (-0.135, -0.045, 0.045, 0.135):
        B.add(cyl("post", 0.0022, 0.0022, zc1 - ptop - 0.002,
                  (cx1 - 0.004, y, ptop), 6, "paint:bottle", rings=1))
        B.add(cyl("pbase", 0.0034, 0.0034, 0.004, (cx1 - 0.004, y, ptop), 6,
                  "paint:bottle"))
        B.add(beam("bracket", (cx1 - 0.004, y, zc1 - 0.02),
                   (cx1 - 0.024, y, zc1 + (zc0 - zc1) * 0.25 - 0.003),
                   (0.0014, 0.0016), "paint:bottle"))
    B.add(beam("canopy", (cx0, -0.16, zc0 + 0.002),
               (cx1 + 0.006, -0.16, zc1 + 0.002), (0.004, 0.004),
               "paint:bottle", up=Vector((0, 0, 1))))
    roofc = K.extrude_x("canroof", [(cx0, zc0), (cx1 + 0.008, zc1 - 0.001),
                                    (cx1 + 0.008, zc1 + 0.004),
                                    (cx0, zc0 + 0.005)],
                        -0.168, 0.168, 10, "paint:canopy")
    # extrude_x runs along x; turn it to run along y.
    tf(roofc, rot("Z", -90))
    kit.add_bevel(roofc, 0.001, 1)
    B.add(roofc)
    B.add(box("cbeam", (0.004, 0.336, 0.005), (cx1 - 0.004, 0, zc1 - 0.003),
              "paint:bottle"))
    # Glazing ribs down the canopy.
    for i in range(12):
        y = -0.154 + i * 0.028
        B.add(beam("crib", (cx0, y, zc0 + 0.0055),
                   (cx1 + 0.008, y, zc1 + 0.0045), (0.0024, 0.0018),
                   "paint:bottle", up=Vector((0, 0, 1))))
    valance(B, (cx1 + 0.009, -0.168, zc1), (cx1 + 0.009, 0.168, zc1), 0.009,
            "paint:trim", teeth=24)
    for k in (-1, 1):
        valance(B, (cx0, k * 0.1685, zc0), (cx1 + 0.009, k * 0.1685, zc1),
                0.008, "paint:trim")
    # Benches, lamps, churns, a luggage cart.
    bench(B, cx1 - 0.03, -0.09, -90, L=0.042, z0=ptop)
    bench(B, cx1 - 0.03, 0.09, -90, L=0.042, z0=ptop)
    lamp_post(B, px1 - 0.012, -0.155, 0.055, z0=ptop)
    lamp_post(B, px1 - 0.012, 0.155, 0.055, z0=ptop)
    for (x, y) in ((cx0 + 0.012, 0.03), (cx0 + 0.02, 0.036)):
        churn(B, x, y, ptop)
    crate(B, cx0 + 0.016, -0.03, 0.013, ptop, ang=10)
    crate(B, cx0 + 0.016, -0.03, 0.01, ptop + 0.013, ang=-12)
    # Station board on two posts at the platform end.
    for k in (-1, 1):
        B.add(cyl("bpost", 0.0014, 0.0014, 0.04,
                  (px1 - 0.03 + k * 0.016, -0.15, ptop), 6, IRON))
    B.add(box("sboard", (0.04, 0.003, 0.012), (px1 - 0.03, -0.15, ptop +
                                               0.036), "paint:sign",
              bevel=0.0006))
    B.add(box("sletters", (0.03, 0.0035, 0.004), (px1 - 0.03, -0.15, ptop +
                                                  0.036),
              "paint:clockface"))
    B.finish(r)
    return r



@asset
def station_grand(name):
    """A grand terminus: twin glazed arched train sheds behind a brick
    screen with two great lunettes, a central clock tower, office wings
    and an iron-and-glass canopy along the front."""
    r = root(name)
    B = Build(name)
    BR = "brick:red"
    yf, yb = -0.15, 0.205          # shed front screen and back end
    vr, vx, vz = 0.066, 0.071, 0.122
    # Shed side walls with an arcade of tall arched windows.
    for k in (-1, 1):
        x = k * 0.138
        B.body(gbox("shedwall", (0.012, yb - yf, vz),
                    (x, (yf + yb) / 2, vz / 2 - 0.003), BR, edge=0.09))
        sw = Wall((x + k * 0.006, 0, 0), (k, 0, 0))
        for y in (0.15,):
            window(B, sw, k * y, 0.02, 0.026, 0.08, SAND, arch="round",
                   bars="cross", fb=0.003, sill=SAND, seg=6)
        band_course(B, x, (yf + yb) / 2, 0.012, yb - yf, vz - 0.002, 0.006,
                    SAND, out=0.003)
    # The two glazed vaults, ribbed in iron.
    for k in (-1, 1):
        cx = k * vx
        L = yb - yf + 0.004
        g = K.extrude_x("vault", arc_profile(vr, vr + 0.0025, 12), -L / 2,
                        L / 2, 4, SHED)
        along_y(g)
        tf(g, T(cx, (yf + yb) / 2, vz))
        B.add(g)
        for i in range(4):
            y = yf + 0.012 + i * (yb - yf - 0.024) / 3
            rb = K.extrude_x("rib", arc_profile(vr + 0.002, vr + 0.006, 8),
                             -0.0018, 0.0018, 1, IRON)
            along_y(rb)
            tf(rb, T(cx, y, vz))
            B.add(rb)
        # Ridge lantern vent along the crown.
        B.add(box("lantern", (0.016, L - 0.03, 0.008),
                  (cx, (yf + yb) / 2 + 0.01, vz + vr + 0.006), SHED))
        B.add(box("lanroof", (0.022, L - 0.026, 0.003),
                  (cx, (yf + yb) / 2 + 0.01, vz + vr + 0.0115), ZINC,
                  bevel=0.0008))
        # Glazed end screen at the back, with radiating bars.
        fan = [(math.cos(math.pi * i / 12) * vr, math.sin(math.pi * i / 12)
                * vr) for i in range(13)]
        es = K.pane("endglass", [(x, z) for x, z in fan], 0.0, SHED)
        tf(es, T(cx, yb - 0.002, vz) @ rot("Z", 180))
        B.add(es)
        for i in range(1, 6):
            a = math.pi * i / 6
            B.add(beam("ebar", (cx, yb - 0.003, vz),
                       (cx + math.cos(a) * vr, yb - 0.003,
                        vz + math.sin(a) * vr), (0.0018, 0.0018), IRON))
        B.add(box("etie", (2 * vr, 0.003, 0.004), (cx, yb - 0.003, vz), IRON))
    B.add(box("valley", (0.012, yb - yf, 0.006), (0, (yf + yb) / 2, vz + 0.002),
              ZINC))
    # Front screen: brick with two great arched windows and a coping.
    sh = 0.205
    B.body(gbox("screen", (0.288, 0.014, sh + 0.003), (0, yf, sh / 2 - 0.0015),
                BR, bevel=0.0012, edge=0.08))
    scr = Wall((0, yf - 0.007, 0), (0, -1, 0))
    for k in (-1, 1):
        window(B, scr, k * 0.078, 0.07, 0.084, 0.118, SAND, arch="round",
               bars="vertical", fb=0.007, glass=SHED, keystone=SAND)
    band_course(B, 0, yf, 0.288, 0.014, sh + 0.002, 0.006, SAND, out=0.003)
    band_course(B, 0, yf, 0.288, 0.014, 0.066, 0.005, SAND, out=0.002)
    for k in (-1, 1):
        B.add(box("pier", (0.016, 0.02, sh + 0.012),
                  (k * 0.136, yf - 0.002, (sh + 0.012) / 2 - 0.003), SAND,
                  bevel=0.001))
        B.add(box("piercap", (0.02, 0.024, 0.006),
                  (k * 0.136, yf - 0.002, sh + 0.012), SAND, bevel=0.0008))
    # Ground floor arcade under the canopy.
    for u in (-0.1, 0.1):
        door(B, scr, u, 0.03, 0.055, "paint:bottle", SAND, arch="round",
             fanlight=True, double=True, step=None, fb=0.004, panels=False,
             seg=6)
    # Clock tower.
    tw, ty = 0.072, yf - 0.012
    tz = 0.29
    B.body(gbox("tower", (tw, tw, tz + 0.003), (0, ty, tz / 2 - 0.0015), BR,
                bevel=0.0012, edge=0.08))
    for kx in (-1, 1):
        for ky in (-1, 1):
            B.add(gbox("quoin", (0.009, 0.009, tz),
                       (kx * (tw / 2 - 0.0035), ty + ky * (tw / 2 - 0.0035),
                        tz / 2), SAND, edge=0.07))
    tW = walls(0, ty, tw, tw)
    door(B, tW["front"], 0.0, 0.034, 0.066, "paint:bottle", SAND,
         arch="round", fanlight=True, double=True, step=SAND, fb=0.005)
    window(B, tW["front"], 0.0, 0.12, 0.024, 0.06, SAND, arch="round",
           bars="cross", fb=0.004, sill=SAND, seg=6)
    for side in ("left", "right"):
        window(B, tW[side], 0.0, 0.17, 0.02, 0.05, SAND, arch="round",
               bars="cross", fb=0.003, sill=SAND, seg=6)
    band_course(B, 0, ty, tw, tw, 0.232, 0.006, SAND, out=0.003)
    band_course(B, 0, ty, tw, tw, tz - 0.002, 0.008, SAND, out=0.005)
    for side in ("front", "left", "right"):
        clock(B, tW[side], 0.0, 0.26, 0.022, depth=0.005, seg=12,
              ticks=False)
    # Pyramid roof and finial.
    sp = cyl("tspire", tw * 0.76, 0.0, 0.05, (0, ty, tz + 0.002), 4,
             "slate:slate-dark", rings=2)
    tf(sp, T(0, ty) @ rot("Z", 45) @ T(0, -ty))
    B.add(sp)
    B.add(cyl("tfin", 0.002, 0.0005, 0.02, (0, ty, tz + 0.048), 6, IRON))
    B.add(ball("tball", 0.003, (0, ty, tz + 0.05), BRASS, seg=6, rings=3))
    # Office wings on both sides, two storeys, gable to the front.
    ww, wd, whw, wrise = 0.06, 0.29, 0.128, 0.036
    wy = -0.053
    for k in (-1, 1):
        wx = k * 0.171
        B.body(K.body("wing", ww, wd, whw, wrise, "y", centre=(wx, wy),
                      mat="plaster:cream", bevel=0.0, edge=0.07))
        plinth(B, wx, wy, ww, wd, 0.014, SAND)
        band_course(B, wx, wy, ww, wd, 0.066, 0.004, SAND)
        band_course(B, wx, wy, ww, wd, whw - 0.003, 0.006, SAND, out=0.003)
        Wg = walls(wx, wy, ww, wd)
        window(B, Wg["front"], 0.0, 0.022, 0.03, 0.036, TRIM, bars="sash",
               sill=SAND, lintel=SAND, glass=GLOW)
        window(B, Wg["front"], 0.0, 0.08, 0.03, 0.036, TRIM, bars="sash",
               sill=SAND, lintel=SAND)
        window(B, Wg["front"], 0.0, 0.138, 0.016, 0.016, TRIM, arch="round",
               bars=None, fb=0.003)
        outer = Wg["right" if k > 0 else "left"]
        for u in (-0.09, 0.0, 0.09):
            window(B, outer, u, 0.022, 0.028, 0.036, TRIM, bars=None,
                   sill=SAND, lintel=SAND, fb=0.0)
            window(B, outer, u, 0.08, 0.028, 0.036, TRIM, bars=None,
                   sill=SAND, lintel=SAND, fb=0.0)
        gable_roof(B, wx, wy, ww, wd, whw, wrise, "slate:slate-blue",
                   ridge="y", over=0.005, over_gable=0.008,
                   ridge_mat="slate:slate-dark", barge=TRIM, edge=0.075)
        chimney(B, wx, wy + 0.07, 0.15, 0.2, 0.024, 0.03, BR, pots=1)
    # Iron-and-glass canopy along the front.
    cz, cy0, cy1 = 0.064, yf - 0.007, -0.205
    can = K.extrude_x("canopy", [(cy0, cz + 0.006), (cy1, cz - 0.002),
                                 (cy1, cz + 0.001), (cy0, cz + 0.009)],
                      -0.13, 0.13, 6, SHED)
    B.add(can)
    for i in range(9):
        x = -0.128 + i * 0.032
        B.add(beam("cbar", (x, cy0, cz + 0.0095), (x, cy1, cz + 0.0015),
                   (0.0018, 0.0018), "paint:bottle", up=Vector((0, 0, 1))))
    valance(B, (-0.13, cy1 - 0.001, cz), (0.13, cy1 - 0.001, cz), 0.007,
            "paint:trim", teeth=20)
    for x in (-0.12, -0.04, 0.04, 0.12):
        if abs(x) < 0.05:
            continue
        B.add(cyl("ccol", 0.0024, 0.0024, cz, (x, cy1 + 0.004, 0), 6,
                  "paint:bottle", rings=1))
        B.add(cyl("cbase", 0.0036, 0.0036, 0.005, (x, cy1 + 0.004, 0), 6,
                  "paint:bottle"))
    B.add(box("cbeam", (0.26, 0.004, 0.006), (0, cy1 + 0.003, cz - 0.003),
              "paint:bottle"))
    # Forecourt paving with lamps and a bench.
    B.add(gbox("forecourt", (0.42, 0.06, 0.004), (0, -0.18, -0.0005),
               "cobble:setts", edge=0.08))
    for x in (-0.2, 0.2):
        lamp_post(B, x, -0.204, 0.07)
    B.finish(r)
    return r


# ---------------------------------------------------------------- farm

@asset
def farmhouse(name):
    """An L-shaped stone farmhouse with a terracotta roof, an ochre wing,
    teal shutters, a timber porch, chimneys and a yard bench."""
    r = root(name)
    B = Build(name)
    ST = "stone:sand"
    mw, md, mhw, mrise = 0.3, 0.14, 0.104, 0.07
    mx, my = 0.0, 0.08
    B.body(K.body("main", mw, md, mhw, mrise, "x", centre=(mx, my), mat=ST))
    ww, wd, whw, wrise = 0.134, 0.218, 0.096, 0.064
    wx, wy = -mw / 2 + ww / 2 - 0.004, -0.039
    B.body(K.body("wing", ww, wd, whw, wrise, "y", centre=(wx, wy),
                  mat="plaster:ochre"))
    plinth(B, mx, my, mw, md, 0.012, "stone:granite")
    plinth(B, wx, wy, ww, wd, 0.012, "stone:granite")
    M = walls(mx, my, mw, md)
    Wg = walls(wx, wy, ww, wd)
    SH = "paint:teal"
    # Wing: gable end to the yard with a door and loft window.
    door(B, Wg["front"], 0.0, 0.034, 0.058, "wood:oak", "wood:timber",
         double=True, step=SAND, fb=0.005)
    window(B, Wg["front"], 0.0, 0.11, 0.022, 0.024, "wood:timber",
           bars="cross", sill="wood:timber")
    for u in (-0.045, 0.045):
        window(B, Wg["left"], u, 0.03, 0.028, 0.032, TRIM, bars="sash",
               sill=SAND, shutters=SH)
    window(B, Wg["right"], -0.03, 0.03, 0.028, 0.032, TRIM, bars="sash",
           sill=SAND, shutters=SH, flowers=FLOWERS["red"])
    # Main front, right of the wing: door under the porch, windows.
    f = M["front"]
    door(B, f, 0.045, 0.03, 0.056, "paint:teal", TRIM, fanlight=True,
         step=SAND)
    for u in (-0.005, 0.1):
        window(B, f, u, 0.03, 0.03, 0.034, TRIM, bars="sash", sill=SAND,
               shutters=SH, flowers=FLOWERS["red"] if u > 0 else None)
    for u in (-0.005, 0.045, 0.1):
        window(B, f, u, 0.078, 0.026, 0.022, TRIM, bars="cross", sill=SAND,
               shutters=SH)
    window(B, M["right"], 0.0, 0.03, 0.028, 0.032, TRIM, bars="sash",
           sill=SAND, shutters=SH)
    window(B, M["right"], 0.0, 0.118, 0.02, 0.024, TRIM, bars="cross",
           sill=SAND)
    for u in (-0.08, 0.06):
        window(B, M["back"], u, 0.03, 0.028, 0.032, TRIM, bars="sash",
               sill=SAND)
    # Roofs.
    gable_roof(B, mx, my, mw, md, mhw, mrise, "roof:terracotta",
               ridge_mat="roof:tile-rust", barge=None, gutter=ZINC)
    gable_roof(B, wx, wy - 0.006, ww, wd + 0.012, whw, wrise,
               "roof:tile-sun", ridge="y", over_gable=0.01,
               ridge_mat="roof:tile-rust", gutter=ZINC)
    chimney(B, mw / 2 - 0.03, my + 0.004, 0.15, 0.218, 0.032, 0.028, ST,
            pots=2)
    chimney(B, wx, wy - 0.035, 0.13, 0.192, 0.026, 0.026, ST, pots=1)
    # Timber porch with a pantile lean-to roof.
    px0, px1 = -mw / 2 + ww, mw / 2 - 0.012
    py = my - md / 2
    pd = 0.04
    for x in (px0 + 0.006, (px0 + px1) / 2 + 0.01, px1 - 0.004):
        B.add(box("ppost", (0.005, 0.005, 0.054), (x, py - pd + 0.004, 0.027),
                  "wood:oak", bevel=0.0008))
        B.add(beam("pbrace", (x, py - pd + 0.004, 0.042),
                   (x, py - pd + 0.016, 0.054), (0.003, 0.003), "wood:oak"))
    B.add(box("pbeam", (px1 - px0, 0.006, 0.007),
              ((px0 + px1) / 2, py - pd + 0.004, 0.056), "wood:oak"))
    pr = K.extrude_x("proof", [(py + 0.002, 0.071), (py - pd - 0.01, 0.057),
                               (py - pd - 0.01, 0.063), (py + 0.002, 0.077)],
                     px0 - 0.004, px1 + 0.006, 5, "roof:terracotta")
    kit.add_bevel(pr, 0.0012, 1)
    B.add(pr)
    B.add(gbox("deck", (px1 - px0, pd + 0.004, 0.008),
               ((px0 + px1) / 2, py - pd / 2, 0.001), "wood:deck", edge=0.06))
    bench(B, 0.1, py - 0.014, 0, L=0.044, z0=0.005)
    # A vine climbing the porch post and pots by the door.
    for i, (x, z) in enumerate(((px1 - 0.004, 0.016), (px1 - 0.004, 0.034),
                                (px1 - 0.012, 0.05))):
        B.add(ball("vine", 0.009, (x, py - pd + 0.006, z), "foliage:leaf",
                   seg=6, rings=4, scale=(1, 0.8, 1.1)))
    for x in (0.02, 0.07):
        B.add(cyl("pot", 0.004, 0.005, 0.008, (x, py - pd - 0.006, 0.0), 6,
                  POT))
        B.add(ball("herb", 0.0055, (x, py - pd - 0.006, 0.011),
                   "foliage:leaf", seg=6, rings=3))
    barrel(B, wx + ww / 2 + 0.012, wy - 0.05, 0.0)
    crate(B, wx + ww / 2 + 0.012, wy - 0.072, 0.014, ang=12)
    B.finish(r)
    return r


@asset
def barn(name):
    """A red-painted timber barn: gambrel roof, white trim, big braced
    doors, a hayloft door with a hoist beam, a louvred cupola."""
    r = root(name)
    B = Build(name)
    WD = "wood:barn"
    WT = "paint:white"
    w, d, hw = 0.25, 0.34, 0.112
    knee, kz, ridge_z = 0.082, 0.19, 0.232
    half = w / 2

    def top(s):
        if s <= knee:
            return ridge_z - (ridge_z - kz) * s / knee
        return kz - (kz - hw) * (s - knee) / (half - knee)
    B.body(K.body_profile("walls", w, d, hw, top, breaks=(knee,), ridge="y",
                          mat=WD))
    plinth(B, 0, 0, w, d, 0.01, "stone:granite")
    W = walls(0, 0, w, d)
    f = W["front"]
    # Big double doors with white X braces and frame.
    dw, dh = 0.1, 0.094
    door(B, f, 0.0, dw, dh, WD, WT, double=True, panels=False, step=None,
         knob=None, fb=0.005, recess=0.005)
    for k in (-1, 1):
        cx = k * dw / 4
        for a_, b_ in (((cx - dw / 4 + 0.003, 0.004),
                        (cx + dw / 4 - 0.003, dh - 0.004)),
                       ((cx + dw / 4 - 0.003, 0.004),
                        (cx - dw / 4 + 0.003, dh - 0.004))):
            B.add(f.put(beam("xbrace", (a_[0], 0.0028, a_[1]),
                             (b_[0], 0.0028, b_[1]), (0.0018, 0.0042), WT,
                             up=Vector((0, -1, 0)))))
        B.add(f.put(box("dframe2", (dw / 2 - 0.004, 0.0018, 0.004),
                        (cx, 0.0028, dh / 2), WT)))
    # Sliding door track.
    B.add(f.put(box("track", (dw * 2.1, 0.004, 0.004), (0, -0.003, dh + 0.008),
                    IRON)))
    # Hayloft door and hoist.
    hl = Wall((0, -d / 2, 0), (0, -1, 0))
    window(B, hl, 0.0, 0.135, 0.042, 0.042, WT, bars=None, glass="wood:timber",
           fb=0.004, recess=0.004, sill=WT)
    for a_, b_ in (((-0.019, 0.137), (0.019, 0.175)),
                   ((0.019, 0.137), (-0.019, 0.175))):
        B.add(hl.put(beam("hbrace", (a_[0], 0.0, a_[1]), (b_[0], 0.0, b_[1]),
                          (0.0016, 0.0036), WT, up=Vector((0, -1, 0)))))
    B.add(box("hoist", (0.006, 0.05, 0.007), (0, -d / 2 - 0.016, 0.224),
              "wood:oak", bevel=0.0008))
    B.add(cyl("pulley", 0.004, 0.004, 0.003, (0, -d / 2 - 0.036, 0.218), 8,
              IRON, axis="x"))
    B.add(cyl("rope", 0.0008, 0.0008, 0.05, (0, -d / 2 - 0.04, 0.165), 4,
              "wood:thatch"))
    B.add(box("hook", (0.003, 0.003, 0.006), (0, -d / 2 - 0.04, 0.162), IRON))
    # Corner boards and trim.
    for kx in (-1, 1):
        for ky in (-1, 1):
            B.add(box("corner", (0.006, 0.006, hw),
                      (kx * (half - 0.002), ky * (d / 2 - 0.002), hw / 2),
                      WT))
    for side, us in (("left", (-0.11, -0.04, 0.04, 0.11)),
                     ("right", (-0.11, -0.04, 0.04, 0.11))):
        for u in us:
            window(B, W[side], u, 0.05, 0.026, 0.026, WT, bars="cross",
                   sill=WT, fb=0.003)
    door(B, W["right"], 0.0, 0.034, 0.06, WD, WT, panels=False, step=None,
         knob=None, fb=0.004)
    # Gambrel roof.
    over = 0.012
    s1, z1 = -half, hw
    s2, z2 = -knee, kz
    L1 = math.hypot(s2 - s1, z2 - z1)
    eave = (s1 - (s2 - s1) / L1 * over, z1 - (z2 - z1) / L1 * over)
    rz = K.profile_roof(B, 0, 0, d, [eave, (s2, z2), (0.0, ridge_z)],
                        "slate:slate-grey", ridge="y", over_gable=0.01,
                        thick=0.007, gutter=ZINC, barge=WT,
                        ridge_mat="slate:slate-dark")
    # Louvred cupola with a weathervane.
    cyz = rz - 0.004
    B.add(gbox("cupola", (0.03, 0.03, 0.026), (0, 0.04, cyz + 0.013), WT,
               bevel=0.0008, seg=1, edge=0.05))
    for nrm in ((0, -1, 0), (1, 0, 0), (-1, 0, 0), (0, 1, 0)):
        cw = Wall((nrm[0] * 0.015, 0.04 + nrm[1] * 0.015, 0), nrm)
        for i in range(4):
            B.add(cw.put(beam("louvre", (-0.009, -0.0005, cyz + 0.008 +
                                         i * 0.004),
                              (0.009, -0.0005, cyz + 0.008 + i * 0.004),
                              (0.0028, 0.0012), "paint:black")))
    cr = cyl("croof", 0.026, 0.0, 0.018, (0, 0.04, cyz + 0.026), 4,
             "slate:slate-dark", rings=1)
    tf(cr, T(0, 0.04) @ rot("Z", 45) @ T(0, -0.04))
    B.add(cr)
    B.add(cyl("vane", 0.0008, 0.0008, 0.022, (0, 0.04, cyz + 0.042), 4, IRON))
    B.add(beam("arrow", (-0.01, 0.04, cyz + 0.058), (0.012, 0.04, cyz + 0.058),
               (0.0012, 0.004), IRON))
    # A ramp to the doors.
    ramp = prism_xz("ramp", [(-0.056, 0.0), (0.056, 0.0), (0.056, 0.006),
                             (-0.056, 0.006)], -0.03, 0.0, None)
    for v in ramp.data.vertices:
        if v.co.y < -0.015 and v.co.z > 0.003:
            v.co.z = 0.0
    tf(ramp, T(0, -d / 2))
    kit.assign(ramp, "stone:flag")
    B.add(ramp)
    B.finish(r)
    return r


@asset
def silo(name):
    """A concrete stave silo with iron hoops, a galvanised dome, a ladder
    up the front and a chute tower beside it."""
    r = root(name)
    B = Build(name)
    R, H = 0.055, 0.3
    C = (0.0, 0.0)
    B.add(lathe("base", [(R + 0.008, -0.003), (R + 0.008, 0.014),
                         (R + 0.002, 0.016), (R * 0.5, 0.016)], (0, 0, 0), 20,
                "stone:granite"), uv=("cyl", C))
    B.add(cyl("staves", R, R, H - 0.014, (0, 0, 0.014), 24,
              "plaster:concrete", rings=8, cap=False), uv=("cyl", C))
    for i in range(9):
        z = 0.035 + i * 0.03
        B.add(K.ring("hoop", R + 0.001, 0.0011, z, C, 24, IRON, h=0.0028))
    dome = [(R + 0.004, H - 0.002), (R + 0.004, H + 0.002), (R * 0.9, H + 0.02),
            (R * 0.62, H + 0.04), (R * 0.28, H + 0.052), (0.0, H + 0.055)]
    B.add(lathe("dome", dome, (0, 0, 0), 24, ZINC), uv=("cyl", C))
    B.add(cyl("vent", 0.009, 0.009, 0.012, (0, 0, H + 0.052), 8, ZINC))
    B.add(cyl("ventcap", 0.013, 0.004, 0.008, (0, 0, H + 0.064), 8, ZINC))
    # Ladder on the front face with a safety cage.
    ly = -R - 0.007
    for k in (-1, 1):
        B.add(box("lrail", (0.002, 0.002, H + 0.02), (k * 0.008, ly,
                                                      (H + 0.02) / 2), IRON))
    for i in range(18):
        z = 0.02 + i * 0.017
        B.add(box("rung", (0.016, 0.0014, 0.0014), (0, ly, z), IRON))
    for z in (0.11, 0.17, 0.23, 0.29):
        cg = lathe("cage", [(0.014, z), (0.0155, z), (0.0155, z + 0.002),
                            (0.014, z + 0.002), (0.014, z)],
                   (0, ly - 0.004, 0), 10, IRON, close=False)
        B.add(cg)
    # Chute tower on the right with hatches.
    cx = R + 0.012
    B.add(gbox("chute", (0.022, 0.022, H - 0.02), (cx, 0.0, (H - 0.02) / 2),
               "wood:weathered", bevel=0.0008, seg=1, edge=0.06))
    for i in range(6):
        B.add(box("hatch", (0.0015, 0.016, 0.022),
                  (cx + 0.011, 0.0, 0.03 + i * 0.045), "paint:redpaint"))
    cr = cyl("chroof", 0.022, 0.0, 0.016, (cx, 0.0, H - 0.02), 4,
             "slate:slate-dark", rings=1)
    tf(cr, T(cx, 0) @ rot("Z", 45) @ T(-cx, 0))
    B.add(cr)
    B.add(beam("spout", (cx - 0.004, 0.0, H - 0.01), (0.012, -0.004, H + 0.03),
               (0.008, 0.008), ZINC))
    B.finish(r)
    return r


@asset
def windmill(name):
    """A whitewashed tower mill on a stone footing: a timber gallery, a
    boarded boat cap with a tail pole, and four lattice sails (`blades`,
    turning about local Y round the hub)."""
    r = root(name)
    B = Build(name)
    C = (0.0, 0.0)
    prof = [(0.078, -0.003), (0.078, 0.022), (0.072, 0.024)]
    B.add(lathe("footing", prof + [(0.05, 0.024)], (0, 0, 0), 12,
                "stone:granite"), uv=("cyl", C))
    tower = cyl("tower", 0.068, 0.046, 0.34, (0, 0, 0.02), 12,
                "plaster:lime", rings=6)
    B.body(tower)
    B.parts[-1] = (tower, ("cyl", C))
    kit.add_bevel(tower, 0.0012, 1, angle=25)

    def rad(z):
        return 0.068 + (0.046 - 0.068) * (z - 0.02) / 0.34
    # Door, gallery door and small windows spiralling up.
    door(B, Wall((0, -rad(0.03) + 0.0015, 0), (0, -1, 0)), 0.0, 0.026, 0.05,
         "paint:green", "wood:oak", step=SAND, fb=0.003)
    door(B, Wall((0, -rad(0.15) + 0.0015, 0), (0, -1, 0)), 0.0, 0.022, 0.042,
         "paint:green", "wood:oak", step=None, fb=0.003, knob=None)
    for (a, z) in ((40, 0.06), (-55, 0.22), (25, 0.28), (180, 0.2)):
        n = Vector((math.sin(math.radians(a)), -math.cos(math.radians(a)), 0))
        o = n * (rad(z + 0.012) - 0.0015)
        window(B, Wall(o, n), 0.0, z, 0.016, 0.022, "wood:oak", bars="cross",
               fb=0.0025, sill="wood:oak")
    # Gallery (the stage) at the door's height.
    gz = 0.145
    B.add(lathe("deck", [(0.094, gz - 0.006), (0.094, gz), (0.05, gz),
                         (0.05, gz - 0.006), (0.094, gz - 0.006)],
                (0, 0, 0), 16, "wood:deck", close=False))
    railing_ring(B, 0, 0, gz, 0.091, 0.017, 16, post="wood:oak")
    for i in range(8):
        a = math.tau * (i + 0.5) / 8
        B.add(beam("strut", (math.cos(a) * rad(gz - 0.06),
                             math.sin(a) * rad(gz - 0.06), gz - 0.06),
                   (math.cos(a) * 0.088, math.sin(a) * 0.088, gz - 0.006),
                   (0.003, 0.003), "wood:oak"))
    # Boat-shaped cap on a white curb.
    cz = 0.36
    B.add(K.ring("curb", 0.048, 0.004, cz + 0.002, C, 16, TRIM, h=0.008))
    cap = lathe("cap", [(0.052, cz + 0.004), (0.052, cz + 0.012),
                        (0.044, cz + 0.032), (0.028, cz + 0.05),
                        (0.0, cz + 0.058)], (0, 0, 0), 14, "wood:weathered")
    tf(cap, T(0, 0.004, cz) @ Matrix_scale((1.0, 1.3, 1.0)) @
       T(0, 0, -cz))
    B.add(cap)
    B.add(box("capridge", (0.006, 0.12, 0.006), (0, 0.004, cz + 0.057),
              "wood:timber", bevel=0.001))
    hub = Vector((0, -0.092, cz + 0.026))
    B.add(cyl("shaft", 0.0055, 0.0055, 0.04, (0, -0.074, hub.z), 8,
              "wood:timber", axis="y"))
    # Tail pole down to a cart wheel on the ground.
    B.add(beam("tail", (0, 0.06, cz + 0.012), (0, 0.15, 0.02),
               (0.005, 0.005), "wood:timber"))
    for k in (-1, 1):
        B.add(beam("tailbr", (k * 0.03, 0.05, cz + 0.008),
                   (0, 0.128, 0.09), (0.003, 0.003), "wood:timber"))
    B.add(cyl("tailwheel", 0.012, 0.012, 0.003, (0, 0.15, 0.012), 10,
              "wood:oak", axis="x"))
    B.finish(r)
    # The sails, a separate child turning round the hub.
    S = Build(name + "-blades")
    S.add(ball("hubcap", 0.009, (0, 0, 0), "wood:timber", seg=8, rings=4,
               scale=(1, 0.7, 1)))
    SAIL = "paint:sail"
    Rs = 0.23
    for i in range(4):
        a = math.radians(45 + 90 * i)
        d = Vector((math.cos(a), 0, math.sin(a)))
        side = Vector((math.cos(a + math.pi / 2), 0,
                       math.sin(a + math.pi / 2)))
        S.add(beam("stock", d * 0.004 + Vector((0, -0.006, 0)),
                   d * Rs + Vector((0, -0.006, 0)), (0.004, 0.0055),
                   "wood:timber", up=Vector((0, -1, 0))))
        r0, r1, sw = 0.045, Rs - 0.004, 0.044
        y = -0.009
        for t in (0.35, 1.0):
            p0 = d * r0 + side * sw * t + Vector((0, y, 0))
            p1 = d * r1 + side * sw * t + Vector((0, y, 0))
            S.add(beam("whip", p0, p1, (0.0018, 0.0022), "wood:oak",
                       up=Vector((0, -1, 0))))
        for j in range(11):
            rr = r0 + (r1 - r0) * j / 10
            S.add(beam("bar", d * rr + Vector((0, y, 0)),
                       d * rr + side * sw + Vector((0, y, 0)),
                       (0.0014, 0.0018), "wood:oak",
                       up=Vector((0, -1, 0))))
        # Canvas furled over the inner two-thirds.
        cv = box("canvas", ((r1 - r0) * 0.8, sw * 0.92, 0.0012),
                 (0, 0, 0), SAIL)
        m = Matrix_frame(d, side, Vector((0, -1, 0)),
                         d * (r0 + (r1 - r0) * 0.42) + side * sw * 0.5 +
                         Vector((0, y - 0.0018, 0)))
        S.add(tf(cv, m))
    bl = S.finish(r, name="blades")
    tf(bl, T(*hub))
    kit.set_pivot(bl, hub)
    return r


def Matrix_scale(s):
    from mathutils import Matrix
    return Matrix.Diagonal((*s, 1.0))


def Matrix_frame(x, y, z, o):
    from mathutils import Matrix
    return Matrix(((x.x, y.x, z.x, o.x), (x.y, y.y, z.y, o.y),
                   (x.z, y.z, z.z, o.z), (0, 0, 0, 1)))


@asset
def church(name):
    """A village church in honey sandstone: a slate nave with lancet
    windows and buttresses, a west tower with clock, belfry and an
    octagonal spire, a side porch and a few headstones."""
    r = root(name)
    B = Build(name)
    ST, TS = "stone:sand", "stone:granite"
    nw, nd, nhw, nrise, ny = 0.15, 0.27, 0.11, 0.075, 0.005
    B.body(K.body("nave", nw, nd, nhw, nrise, "y", centre=(0, ny), mat=ST,
                  edge=0.07))
    plinth(B, 0, ny, nw, nd, 0.012, TS)
    cw, cd, chw, crise, cy = 0.11, 0.075, 0.09, 0.055, 0.17
    B.body(K.body("chancel", cw, cd, chw, crise, "y", centre=(0, cy),
                  mat=ST))
    N = walls(0, ny, nw, nd)
    for side in ("left", "right"):
        k = 1 if side == "right" else -1
        for y in (-0.085, -0.025, 0.035, 0.095):
            window(B, N[side], k * (y - ny), 0.032, 0.022, 0.062, TS,
                   arch="pointed", bars="mullion", fb=0.003, sill=TS, seg=6)
        for y in (-0.055, 0.005, 0.065, 0.125):
            x = k * (nw / 2 + 0.005)
            B.add(box("buttress", (0.01, 0.012, 0.075), (x, y, 0.0365), TS))
            B.add(beam("bslope", (x - k * 0.005, y, 0.081),
                       (x + k * 0.006, y, 0.071), (0.012, 0.004), TS))
    window(B, walls(0, cy, cw, cd)["back"], 0.0, 0.03, 0.03, 0.06, TS,
           arch="pointed", bars="vertical", fb=0.004)
    gable_roof(B, 0, ny, nw, nd, nhw, nrise, "slate:slate-blue", ridge="y",
               over=0.01, over_gable=0.004, ridge_mat="slate:slate-dark",
               gutter=ZINC)
    gable_roof(B, 0, cy + 0.004, cw, cd, chw, crise, "slate:slate-blue",
               ridge="y", over=0.009, over_gable=0.006,
               ridge_mat="slate:slate-dark")
    B.add(beam("cross", (0, cy + cd / 2 + 0.006, chw + crise + 0.004),
               (0, cy + cd / 2 + 0.006, chw + crise + 0.024),
               (0.003, 0.003), TS))
    B.add(box("crossarm", (0.012, 0.003, 0.003),
              (0, cy + cd / 2 + 0.006, chw + crise + 0.017), TS))
    # Side porch on the left near the west end.
    pw_, pd_, ph, pr = 0.042, 0.048, 0.062, 0.03
    px, py = -nw / 2 - pw_ / 2 + 0.004, -0.05
    B.body(K.body("porch", pw_, pd_, ph, pr, "x", centre=(px, py), mat=ST))
    door(B, walls(px, py, pw_, pd_)["left"], 0.0, 0.026, 0.05, "wood:oak",
         TS, arch="pointed", step=TS, fb=0.004)
    gable_roof(B, px - 0.004, py, pw_ + 0.008, pd_, ph, pr,
               "slate:slate-blue", over=0.006, over_gable=0.004,
               ridge_mat="slate:slate-dark")
    # West tower.
    tw, ty, tz = 0.086, -0.165, 0.3
    B.body(gbox("tower", (tw, tw, tz + 0.003), (0, ty, tz / 2 - 0.0015), TS,
                bevel=0.0012, edge=0.07))
    for kx in (-1, 1):
        for ky in (-1, 1):
            x, y = kx * (tw / 2 - 0.006), ty + ky * (tw / 2 - 0.006)
            for (h, o) in ((0.14, 0.009), (0.22, 0.006)):
                B.add(box("tbut", (0.014, 0.014, h),
                          (x + kx * o * 0.5, y + ky * o * 0.5, h / 2 - 0.002),
                          TS))
    TW = walls(0, ty, tw, tw)
    door(B, TW["front"], 0.0, 0.034, 0.068, "wood:oak", ST, arch="pointed",
         double=True, step=TS, fb=0.006, panels=False)
    window(B, TW["front"], 0.0, 0.098, 0.024, 0.05, ST, arch="pointed",
           bars="vertical", fb=0.004, sill=ST)
    for side in ("front", "left", "right"):
        clock(B, TW[side], 0.0, 0.178, 0.017, depth=0.004, seg=12,
              rim="paint:gold", face="paint:navy", hands="paint:gold",
              ticks=False)
    for side in ("front", "left", "right", "back"):
        window(B, TW[side], 0.0, 0.214, 0.026, 0.05, ST, arch="pointed",
               bars="grid", fb=0.004, sill=ST, glass="paint:black", seg=6)
    band_course(B, 0, ty, tw, tw, 0.152, 0.005, ST, out=0.003)
    band_course(B, 0, ty, tw, tw, tz - 0.002, 0.008, ST, out=0.005)
    for kx in (-1, 1):
        for ky in (-1, 1):
            B.add(cyl("pinnacle", 0.006, 0.0, 0.028,
                      (kx * (tw / 2 - 0.002), ty + ky * (tw / 2 - 0.002),
                       tz + 0.002), 4, ST))
    sp = cyl("spire", 0.04, 0.0, 0.25, (0, ty, tz + 0.002), 8,
             "slate:slate-dark", rings=4)
    tf(sp, T(0, ty) @ rot("Z", 22.5) @ T(0, -ty))
    B.add(sp)
    B.add(ball("sball", 0.004, (0, ty, tz + 0.254), "paint:gold", seg=6,
               rings=4))
    B.add(box("vane", (0.0018, 0.0018, 0.03), (0, ty, tz + 0.27),
              "paint:gold"))
    B.add(box("vanearm", (0.014, 0.0018, 0.0018), (0, ty, tz + 0.278),
              "paint:gold"))
    # Path and headstones.
    B.add(gbox("path", (0.04, 0.04, 0.003), (0, ty - tw / 2 - 0.02, 0.0),
               "cobble:setts", edge=0.08))
    for (x, y, a) in ((0.05, -0.2, 4), (0.075, -0.19, -6), (0.1, -0.205, 2),
                      (-0.065, -0.2, -3), (-0.09, -0.19, 7)):
        g = box("stone", (0.014, 0.004, 0.017), (0, 0, 0.007), TS)
        B.add(tf(g, T(x, y) @ rot("Z", a) @ rot("X", a * 0.6)))
    B.finish(r)
    return r


# ---------------------------------------------------------------- town

def _shopfront(B, f, x, w, col, glow=True, awning_cols=None, door_u=None):
    """A painted shopfront across a ground floor with fascia."""
    B.add(f.put(box("front", (w - 0.012, 0.005, 0.062), (x, -0.0015, 0.031),
                    col)))
    du = door_u if door_u is not None else x - w / 2 + 0.03
    door(B, f, du, 0.028, 0.054, col, col, step=SAND, fb=0.0, panels=False,
         fanlight=True)
    wu = (x + w / 2 - 0.012 + du + 0.016) / 2
    ww = (x + w / 2 - 0.012) - (du + 0.016) - 0.008
    window(B, f, wu, 0.016, ww, 0.036, col, bars="vertical",
           glass=GLOW if glow else GLASS, fb=0.0, sill=TRIM, recess=0.006)
    B.add(f.put(box("fascia", (w - 0.008, 0.008, 0.011), (x, -0.004, 0.062),
                    "paint:sign")))
    if awning_cols:
        awning(B, f, wu, 0.055, ww + 0.01, 0.028, 0.012, awning_cols, n=5)


@asset
def townhouse_row(name):
    """A terrace of five city houses for the capital: a Dutch-gabled brick
    shop, a blue mansard house, a buff house with a bay and parapet, a
    rose café with an awning, and a cream corner shop under a hipped
    roof."""
    r = root(name)
    B = Build(name)
    d = 0.26
    yf = -d / 2
    g1, sh = 0.075, 0.066
    xs = [-0.36, -0.18, 0.0, 0.18, 0.36]
    w = 0.18

    def front(x):
        return Wall((x, yf, 0), (0, -1, 0))

    def sash(f, u, z, ww=0.03, hh=0.04, **kw):
        kw.setdefault("bars", "transom")
        kw.setdefault("sill", SAND)
        kw.setdefault("fb", 0.0)
        window(B, f, u, z, ww, hh, TRIM, **kw)
    # 1: brick, Dutch stepped gable, navy shopfront.
    x = xs[0]
    hw = g1 + 3 * sh
    B.body(K.body("h1", w, d, hw, 0.06, "y", centre=(x, 0),
                  mat="brick:plum", bevel=0.0, edge=0.09))
    steps = [(0.09, hw), (0.09, hw + 0.016), (0.068, hw + 0.016),
             (0.068, hw + 0.036), (0.046, hw + 0.036), (0.046, hw + 0.056),
             (0.024, hw + 0.056), (0.024, hw + 0.074)]
    poly = steps + [(-sx, z) for sx, z in reversed(steps)]
    poly = [(x + sx, z) for sx, z in poly]
    B.add(prism_xz("stepgable", poly, yf - 0.001, yf + 0.012, "brick:plum"))
    for sx, z in steps[1::2]:
        for k in (-1, 1):
            B.add(box("coping", (0.026, 0.016, 0.004),
                      (x + k * (sx - 0.013), yf + 0.005, z + 0.002), SAND))
    B.add(box("coping", (0.052, 0.016, 0.004), (x, yf + 0.005,
                                                 hw + 0.076), SAND))
    f = front(x)
    _shopfront(B, f, 0.0, w, "paint:navy")
    for i in range(3):
        for u in (-0.04, 0.04):
            sash(f, u, g1 + 0.012 + i * sh, lintel=SAND)
    sash(f, 0.0, hw + 0.012, 0.026, 0.03)
    gable_roof(B, x + 0.001, 0.006, w - 0.002, d - 0.012, hw, 0.06,
               "slate:slate-dark", ridge="y", over=0.0, over_gable=0.0,
               edge=0.08)
    # 2: blue plaster, mansard with dormers.
    x = xs[1]
    hw = g1 + 2 * sh
    half = d / 2

    def mansard(s, hw=hw):
        if s >= 0.112:
            return hw + 0.056 * (half - s) / (half - 0.112)
        return hw + 0.056 + 0.02 * (0.112 - s) / 0.112
    B.body(K.body_profile("h2", w, d, hw, mansard, breaks=(0.112,),
                          ridge="x", centre=(x, 0), mat="plaster:sky",
                          bevel=0.0, edge=0.09))
    band_course(B, x, 0, w, d, hw - 0.002, 0.006, TRIM, out=0.004)
    band_course(B, x, 0, w, d, g1 - 0.001, 0.004, TRIM, out=0.002)
    f = front(x)
    door(B, f, -0.05, 0.03, 0.056, "paint:maroon", TRIM, fanlight=True,
         step=SAND)
    for u in (0.0, 0.05):
        sash(f, u, 0.018, 0.03, 0.04)
    for i in range(2):
        for u in (-0.055, 0.0, 0.055):
            sash(f, u, g1 + 0.01 + i * sh, 0.03, 0.044 if i == 0 else 0.04)
            if i == 0:
                B.add(f.put(box("balconette", (0.036, 0.006, 0.0025),
                                (u, -0.004, g1 + 0.022), IRON)))
    K.profile_roof(B, x, 0, w, [(-half - 0.004, hw - 0.002),
                                (-0.112, hw + 0.056), (0.0, hw + 0.076)],
                   "slate:slate-blue", over_gable=0.0, thick=0.006,
                   edge=0.08)
    for u in (-0.045, 0.045):
        dz = hw + 0.012
        B.body(gbox("dormer", (0.032, 0.03, 0.036),
                    (x + u, -half + 0.012, dz + 0.018), "plaster:sky",
                    edge=0.06))
        window(B, Wall((x + u, -half - 0.003, 0), (0, -1, 0)), 0.0, dz + 0.004,
               0.022, 0.026, TRIM, bars="cross", fb=0.003)
        dr = K.extrude_x("droof", [(-0.003 - 0.016, dz + 0.034),
                                        (0.03 - 0.016, dz + 0.04),
                                        (0.03 - 0.016, dz + 0.044),
                                        (-0.004 - 0.016, dz + 0.039)],
                         x + u - 0.019, x + u + 0.019, 1, "slate:slate-blue")
        tf(dr, T(0, -half + 0.012 + 0.002))
        B.add(dr)
    # 3: buff brick, four storeys, parapet, a two-storey bay.
    x = xs[2]
    hw = g1 + 3 * sh
    B.body(K.body("h3", w, d, hw, 0, centre=(x, 0), mat="brick:buff",
                  bevel=0.0, edge=0.09))
    band_course(B, x, 0, w, d, hw - 0.004, 0.008, SAND, out=0.005)
    for (sx, sy, cx_, cy_) in ((w, 0.006, 0, -d / 2 + 0.003),
                               (w, 0.006, 0, d / 2 - 0.003),
                               (0.006, d, -w / 2 + 0.003, 0),
                               (0.006, d, w / 2 - 0.003, 0)):
        B.add(box("parapet", (sx, sy, 0.018), (x + cx_, cy_, hw + 0.009),
                  "brick:buff"))
    B.add(gbox("coping", (w + 0.004, 0.012, 0.004), (x, -d / 2 + 0.003,
                                                     hw + 0.02), SAND,
               edge=0.1))
    B.add(gbox("flat", (w - 0.012, d - 0.012, 0.004), (x, 0, hw + 0.001),
               "asphalt:roof", edge=0.09))
    B.add(box("hatch", (0.03, 0.03, 0.008), (x + 0.04, 0.05, hw + 0.006),
              ZINC, bevel=0.001))
    f = front(x)
    door(B, f, 0.045, 0.03, 0.058, "paint:bottle", SAND, arch="round",
         fanlight=True, step=SAND)
    sash(f, -0.035, 0.016, 0.04, 0.042, lintel=SAND)
    # Bay window over two floors.
    bx, bw, bd = x - 0.03, 0.074, 0.018
    B.body(gbox("bay", (bw, bd + 0.004, 2 * sh), (bx, yf - bd / 2 + 0.002,
                                                  g1 + sh), "brick:buff",
                edge=0.07))
    bf = Wall((bx, yf - bd, 0), (0, -1, 0))
    for i in range(2):
        sash(bf, 0.0, g1 + 0.012 + i * sh, 0.044, 0.04, lintel=SAND)
    B.add(box("baycap", (bw + 0.006, bd + 0.006, 0.006),
              (bx, yf - bd / 2, g1 + 2 * sh + 0.003), ZINC, bevel=0.001))
    for i in range(3):
        sash(f, 0.05, g1 + 0.012 + i * sh, 0.03, 0.04, lintel=SAND)
    sash(f, -0.03, g1 + 0.012 + 2 * sh, 0.03, 0.04, lintel=SAND)
    # 4: rose plaster café with a green awning, terracotta gable.
    x = xs[3]
    hw = g1 + 2 * sh
    B.body(K.body("h4", w, d, hw, 0.07, "x", centre=(x, 0),
                  mat="plaster:rose", bevel=0.0, edge=0.09))
    band_course(B, x, 0, w, d, g1 - 0.001, 0.004, TRIM, out=0.002)
    f = front(x)
    _shopfront(B, f, 0.0, w, "paint:bottle",
               awning_cols=["paint:stripe-green", WHITE])
    for i in range(2):
        for u in (-0.055, 0.0, 0.055):
            sash(f, u, g1 + 0.012 + i * sh,
                 flowers=FLOWERS["red"] if i == 0 else None)
    gable_roof(B, x, 0, w, d, hw, 0.07, "roof:terracotta", over=0.012,
               over_gable=0.0, ridge_mat="roof:tile-rust", edge=0.08)
    # 5: cream corner shop, quoins, hipped slate roof.
    x = xs[4]
    hw = g1 + 2 * sh
    B.body(K.body("h5", w, d, hw, 0, centre=(x, 0), mat="plaster:cream",
                  bevel=0.0, edge=0.09))
    band_course(B, x, 0, w, d, hw - 0.003, 0.006, TRIM, out=0.004)
    for k in (-1, 1):
        for i in range(4):
            z = 0.02 + i * 0.05
            B.add(box("quoin", (0.012 if i % 2 else 0.008, 0.004, 0.012),
                      (x + w / 2 - 0.004, yf - 0.001 + 0 * k, z), SAND))
            if k > 0:
                B.add(box("quoin", (0.004, 0.012 if i % 2 else 0.008, 0.012),
                          (x + w / 2 - 0.0018, yf + 0.006, z), SAND))
    f = front(x)
    _shopfront(B, f, -0.01, w - 0.02, "paint:redpaint",
               awning_cols=["paint:stripe", WHITE])
    for i in range(2):
        for u in (-0.055, 0.0, 0.05):
            sash(f, u, g1 + 0.012 + i * sh, shutters="paint:blue")
    hip_roof(B, x - 0.004, 0, w - 0.008, d, hw, 0.06, "slate:slate-grey",
             over=0.004, ridge_mat="slate:slate-dark")
    # Chimney stacks on the party walls.
    for (cx_, z0, z1) in ((-0.27, 0.27, 0.315), (-0.09, 0.27, 0.318),
                          (0.09, 0.26, 0.318), (0.27, 0.24, 0.3)):
        chimney(B, cx_, 0.07, z0, z1, 0.026, 0.05, "brick:red", pots=1,
                bevel_cap=False)
    B.finish(r)
    return r


@asset
def apartments(name):
    """A four-storey 1930s apartment block: brick ground floor, cream
    render above with white bands, iron balconies, a canopied entrance,
    and a flat roof with a stair house and a water tank."""
    r = root(name)
    B = Build(name)
    w, d = 0.42, 0.3
    g1, sh = 0.07, 0.066
    hw = g1 + 3 * sh
    B.body(gbox("ground", (w + 0.004, d + 0.004, g1 + 0.003),
                (0, 0, g1 / 2 - 0.0015), "brick:red", edge=0.07))
    B.body(gbox("upper", (w, d, hw - g1 + 0.002), (0, 0, (hw + g1) / 2),
                "plaster:cream", bevel=0.0012, edge=0.07))
    for i in range(3):
        band_course(B, 0, 0, w, d, g1 + i * sh, 0.004, WHITE, out=0.003)
    band_course(B, 0, 0, w, d, hw - 0.003, 0.006, WHITE, out=0.004)
    for (sx, sy, cx_, cy_) in ((w, 0.006, 0, -d / 2 + 0.003),
                               (w, 0.006, 0, d / 2 - 0.003),
                               (0.006, d, -w / 2 + 0.003, 0),
                               (0.006, d, w / 2 - 0.003, 0)):
        B.add(gbox("parapet", (sx, sy, 0.016), (cx_, cy_, hw + 0.008),
                   "plaster:cream", edge=0.12))
    for (sx, sy, cx_, cy_) in ((w + 0.004, 0.01, 0, -d / 2 + 0.003),
                               (w + 0.004, 0.01, 0, d / 2 - 0.003),
                               (0.01, d + 0.004, -w / 2 + 0.003, 0),
                               (0.01, d + 0.004, w / 2 - 0.003, 0)):
        B.add(box("coping", (sx, sy, 0.003), (cx_, cy_, hw + 0.0175),
                  "stone:flag"))
    B.add(gbox("flat", (w - 0.012, d - 0.012, 0.004), (0, 0, hw + 0.001),
               "stone:terrace", edge=0.1))
    # Roof garden: planters with shrubs, a bench, skylights, an aerial.
    for (px_, py_, L) in ((0.1, -0.12, 0.12), (-0.04, -0.12, 0.09)):
        B.add(box("planter", (L, 0.018, 0.012), (px_, py_, hw + 0.009),
                  "wood:oak"))
        B.add(ball("shrubs", 1, (px_, py_, hw + 0.016), "foliage:hedge",
                   seg=8, rings=4, scale=(L / 2 - 0.002, 0.008, 0.007)))
    for (px_, py_) in ((0.12, -0.12), (0.06, -0.12), (-0.06, -0.12)):
        B.add(box("bloom", (0.004, 0.004, 0.004), (px_, py_ - 0.006,
                                                  hw + 0.022),
                  "paint:flower-pink"))
    bench(B, 0.02, -0.08, 0, L=0.04, z0=hw + 0.003)
    for (sx_, sy_) in ((0.1, 0.06), (-0.04, 0.11)):
        B.add(box("skylight", (0.03, 0.022, 0.006), (sx_, sy_, hw + 0.006),
                  SHED))
        B.add(box("skyframe", (0.034, 0.026, 0.004), (sx_, sy_, hw + 0.004),
                  ZINC))
    B.add(cyl("aerial", 0.0008, 0.0008, 0.05, (0.15, 0.1, hw + 0.04), 4,
              IRON))
    for i in range(3):
        B.add(box("aerialbar", (0.024 - i * 0.005, 0.0012, 0.0012),
                  (0.15, 0.1, hw + 0.07 + i * 0.006), IRON))
    W = walls(0, 0, w + 0.004, d + 0.004)
    U = walls(0, 0, w, d)
    f, uf = W["front"], U["front"]
    bays = (-0.165, -0.085, 0.085, 0.165)
    for u in bays:
        window(B, f, u, 0.016, 0.036, 0.038, WHITE, bars="cross", sill=SAND,
               lintel=SAND)
        for i in range(3):
            window(B, uf, u, g1 + 0.014 + i * sh, 0.036, 0.04, WHITE,
                   bars="cross", sill=WHITE,
                   glass=GLOW if (i, u) in ((1, -0.085), (2, 0.165)) else
                   GLASS)
    for i in range(3):
        window(B, uf, 0.0, g1 + 0.032 + i * sh, 0.02, 0.05, WHITE,
               bars="grid", fb=0.003)
    # Entrance with a canopy and steps.
    door(B, f, 0.0, 0.042, 0.058, "paint:teal", WHITE, double=True,
         fanlight=True, step=None, fb=0.005)
    B.add(f.put(box("canopy", (0.07, 0.03, 0.005), (0, -0.015, 0.067),
                    WHITE, bevel=0.0012)))
    for i in range(2):
        B.add(f.put(box("stair", (0.06 - i * 0.01, 0.022 - i * 0.008, 0.005),
                        (0, -0.011 + i * 0.004, 0.0015 + i * 0.005),
                        "stone:flag", bevel=0.0006)))
    # Balconies on the outer bays of the top two floors.
    for k in (-1, 1):
        for i in (1, 2):
            z = g1 + i * sh
            cx_ = k * 0.125
            B.add(uf.put(box("bslab", (0.13, 0.026, 0.005),
                             (cx_, -0.013, z + 0.0005), "stone:flag",
                             bevel=0.0008)))
            B.add(uf.put(box("brail", (0.13, 0.002, 0.002),
                             (cx_, -0.025, z + 0.017), IRON)))
            for kk in (-1, 1):
                B.add(uf.put(box("bside", (0.002, 0.024, 0.002),
                                 (cx_ + kk * 0.064, -0.013, z + 0.017),
                                 IRON)))
            for j in range(9):
                B.add(uf.put(box("bbar", (0.0012, 0.0012, 0.014),
                                 (cx_ - 0.064 + j * 0.016, -0.025, z + 0.01),
                                 IRON)))
    for side in ("left", "right"):
        for u in (-0.06, 0.06):
            if (side == "left") == (u < 0):
                window(B, W[side], u, 0.016, 0.032, 0.038, WHITE,
                       bars="cross", sill=SAND, fb=0.0)
            for i in range(3):
                if (i + (u > 0)) % 2:
                    continue
                window(B, U[side], u, g1 + 0.014 + i * sh, 0.032, 0.04, WHITE,
                       bars="cross", sill=WHITE, fb=0.0)
    # Roof: stair house, water tank, chimneys, vents.
    B.add(gbox("stairhouse", (0.07, 0.06, 0.04), (0.0, 0.06, hw + 0.02),
               "plaster:cream", bevel=0.001, seg=1, edge=0.08))
    B.add(box("shroof", (0.078, 0.068, 0.004), (0.0, 0.06, hw + 0.042),
              "stone:flag", bevel=0.0008))
    B.add(box("shdoor", (0.02, 0.002, 0.03), (0.0, 0.029, hw + 0.016),
              "paint:teal"))
    tx, ty = -0.12, 0.07
    for kx in (-1, 1):
        for ky in (-1, 1):
            B.add(box("tleg", (0.003, 0.003, 0.03),
                      (tx + kx * 0.014, ty + ky * 0.014, hw + 0.015), IRON))
    B.add(cyl("tank", 0.022, 0.022, 0.034, (tx, ty, hw + 0.03), 12,
              "wood:oak", rings=2), uv=("cyl", (tx, ty)))
    for zz in (0.008, 0.026):
        B.add(K.ring("thoop", 0.0225, 0.0008, hw + 0.03 + zz, (tx, ty), 12,
                     IRON, h=0.002))
    B.add(cyl("troof", 0.025, 0.0, 0.016, (tx, ty, hw + 0.064), 12,
              "wood:timber"))
    for (cx_, cy_) in ((0.15, 0.1), (0.15, -0.06), (-0.17, -0.08)):
        chimney(B, cx_, cy_, hw, hw + 0.04, 0.03, 0.02, "brick:red", pots=2)
    B.finish(r)
    return r


@asset
def warehouse(name):
    """A harbour warehouse in rust brick: a tall gable with stacked loading
    doors and a hoist, arched cart doors, pilastered sides, skylights, and
    barrels and crates on the quay."""
    r = root(name)
    B = Build(name)
    BR = "brick:rust"
    w, d, hw, rise = 0.3, 0.37, 0.2, 0.075
    B.body(K.body("walls", w, d, hw, rise, "y", mat=BR, edge=0.06))
    plinth(B, 0, 0, w, d, 0.014, "stone:granite")
    band_course(B, 0, 0, w, d, 0.09, 0.005, SAND)
    W = walls(0, 0, w, d)
    f = W["front"]
    DG = "paint:bottle"
    door(B, f, 0.0, 0.07, 0.086, "wood:oak", SAND, arch="segment",
         double=True, panels=False, step=None, fb=0.007, knob=None)
    for i in range(6):
        B.add(f.put(box("plank", (0.0012, 0.0012, 0.07),
                        (-0.03 + i * 0.012, 0.0045, 0.036), "wood:timber")))
    for z in (0.1, 0.152):
        window(B, f, 0.0, z, 0.04, 0.042, SAND, bars="vertical",
               glass="paint:bottle", fb=0.004, sill=SAND, recess=0.004)
    for u in (-0.095, 0.095):
        for z in (0.026, 0.1, 0.152):
            window(B, f, u, z, 0.03, 0.036, SAND, arch="segment",
                   bars="grid", sill=SAND, fb=0.004)
    for k in (-1, 1):
        for z in range(14):
            B.add(box("quoin", (0.012 if z % 2 else 0.008, 0.004, 0.011),
                      (k * (w / 2 - 0.005), -d / 2 - 0.0015, 0.012 + z *
                       0.0137), SAND))
    # Sign board on the gable and the hoist above it.
    B.add(f.put(box("sign", (0.12, 0.004, 0.016), (0, -0.002, 0.212),
                    "paint:sign", bevel=0.0008)))
    for i in range(6):
        B.add(f.put(box("letter", (0.012, 0.001, 0.006),
                        (-0.042 + i * 0.0168, -0.0045, 0.212),
                        "paint:clockface")))
    B.add(box("hoist", (0.008, 0.06, 0.009), (0, -d / 2 - 0.012, 0.25),
              "wood:timber", bevel=0.001))
    B.add(cyl("pulley", 0.005, 0.005, 0.004, (0, -d / 2 - 0.036, 0.243), 8,
              IRON, axis="x"))
    B.add(cyl("rope", 0.0009, 0.0009, 0.09, (0, -d / 2 - 0.041, 0.155), 4,
              "wood:thatch"))
    crate(B, 0, -d / 2 - 0.041, 0.018, 0.137, ang=20)
    # Sides: pilasters and windows in bays.
    for side in ("left", "right"):
        sw = W[side]
        for u in (-0.15, -0.075, 0.0, 0.075, 0.15):
            B.add(sw.put(box("pilaster", (0.009, 0.004, hw), (u, -0.0015,
                                                              hw / 2), BR)))
        for u in (-0.112, -0.037, 0.037, 0.112):
            for z in (0.026, 0.1, 0.152):
                window(B, sw, u, z, 0.028, 0.036, SAND, arch="segment",
                       bars=None, sill=SAND, fb=0.0)
    gable_roof(B, 0, 0, w, d, hw, rise, "slate:slate-grey", ridge="y",
               over=0.012, over_gable=0.008, ridge_mat="slate:slate-dark",
               barge=SAND, gutter=ZINC)
    # Skylights on both slopes.
    a = math.atan2(rise, w / 2)
    for k in (-1, 1):
        for y in (-0.08, 0.08):
            s = 0.07
            z = hw + rise * (1 - s / (w / 2)) + 0.009
            sk = box("skylight", (0.03, 0.05, 0.004), (0, 0, 0), SHED)
            tf(sk, T(k * s, y, z) @ rot("Y", -k * math.degrees(a)))
            B.add(sk)
            fr = box("skyframe", (0.034, 0.054, 0.003), (0, 0, -0.0018), IRON)
            tf(fr, T(k * s, y, z) @ rot("Y", -k * math.degrees(a)))
            B.add(fr)
    for x in (-0.12, 0.12):
        downpipe(B, x * 1.24, -d / 2 - 0.004, hw)
    # Quay clutter.
    for (x, y) in ((-0.1, -0.2), (-0.085, -0.212), (-0.115, -0.214)):
        barrel(B, x, y)
    crate(B, 0.09, -0.205, 0.02, ang=8)
    crate(B, 0.112, -0.2, 0.016, ang=-14)
    crate(B, 0.095, -0.205, 0.014, 0.02, ang=30)
    lamp_post(B, 0.06, -0.21, 0.06)
    B.finish(r)
    return r


@asset
def lighthouse(name):
    """A red-and-white banded lighthouse on a granite footing with a
    corbelled gallery, a glazed lantern room round a `glow:lamp` light,
    a red dome, and a keeper's cottage at its foot."""
    r = root(name)
    B = Build(name)
    tx, ty = -0.04, 0.0
    C = (tx, ty)
    r0, r1, z0, z1 = 0.068, 0.048, 0.03, 0.45
    B.add(lathe("footing", [(0.102, -0.003), (0.102, 0.022), (0.094, 0.03),
                            (0.05, 0.03)], (tx, ty, 0), 8, "stone:granite"),
          uv=("cyl", C))

    def rad(z):
        return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    cuts = [z0, 0.09, 0.15, 0.21, 0.27, 0.33, 0.39, z1]
    for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
        mat = "plaster:lime" if i % 2 == 0 else "plaster:lh-red"
        sec = cyl("band", rad(a), rad(b), b - a, (tx, ty, a), 18, mat,
                  rings=2, cap=(i == len(cuts) - 2))
        B.body(sec)
        B.parts[-1] = (sec, ("cyl", C))
    door(B, Wall((tx, ty - rad(0.035) + 0.002, 0), (0, -1, 0)), 0.0, 0.026,
         0.05, "paint:lh-red", WHITE, arch="round", step=None, fb=0.004)
    for z in (0.14, 0.25, 0.35):
        window(B, Wall((tx, ty - rad(z + 0.012) + 0.0015, 0), (0, -1, 0)),
               0.0, z, 0.014, 0.022, WHITE, bars=None, fb=0.0025, sill=WHITE)
    # Gallery on corbels.
    gz = z1
    for i in range(10):
        a = math.tau * i / 10
        B.add(beam("corbel", (tx + math.cos(a) * (r1 - 0.002),
                              ty + math.sin(a) * (r1 - 0.002), gz - 0.022),
                   (tx + math.cos(a) * 0.07, ty + math.sin(a) * 0.07,
                    gz - 0.002), (0.006, 0.005), "stone:granite"))
    B.add(lathe("deck", [(0.076, gz - 0.002), (0.076, gz + 0.006),
                         (0.03, gz + 0.006)], (tx, ty, 0), 18,
                "stone:granite"), uv=("cyl", C))
    railing_ring(B, tx, ty, gz + 0.006, 0.073, 0.017, 16, post=IRON)
    # Lantern room.
    B.add(cyl("drum", 0.043, 0.043, 0.018, (tx, ty, gz + 0.006), 12, WHITE),
          uv=("cyl", C))
    lz0, lz1 = gz + 0.024, gz + 0.082
    B.add(cyl("lantern", 0.038, 0.038, lz1 - lz0, (tx, ty, lz0), 8, SHED,
              cap=False, rings=1))
    for i in range(8):
        a = math.tau * (i + 0.0) / 8
        B.add(box("mullion", (0.0025, 0.0025, lz1 - lz0),
                  (tx + math.cos(a) * 0.0385, ty + math.sin(a) * 0.0385,
                   (lz0 + lz1) / 2), IRON))
    B.add(cyl("lamp", 0.015, 0.015, 0.032, (tx, ty, lz0 + 0.012), 10, LAMP))
    B.add(ball("lens", 0.012, (tx, ty, lz0 + 0.044), LAMP, seg=10, rings=5))
    B.add(K.ring("lring", 0.039, 0.0018, lz1, C, 12, IRON, h=0.004))
    dome = [(0.046, lz1), (0.046, lz1 + 0.006), (0.036, lz1 + 0.024),
            (0.018, lz1 + 0.038), (0.0, lz1 + 0.042)]
    B.add(lathe("dome", dome, (tx, ty, 0), 14, "paint:lh-red"),
          uv=("cyl", C))
    B.add(ball("vent", 0.007, (tx, ty, lz1 + 0.048), "paint:black", seg=8,
               rings=4))
    B.add(cyl("rod", 0.001, 0.0006, 0.04, (tx, ty, lz1 + 0.052), 4, IRON))
    # Keeper's cottage.
    cw, cd, chw, crise = 0.11, 0.08, 0.062, 0.04
    cx_, cy_ = 0.075, 0.035
    B.body(K.body("cottage", cw, cd, chw, crise, "x", centre=(cx_, cy_),
                  mat="plaster:lime"))
    plinth(B, cx_, cy_, cw, cd, 0.01, "stone:granite")
    CW = walls(cx_, cy_, cw, cd)
    door(B, CW["front"], 0.02, 0.026, 0.048, "paint:navy", WHITE, step=SAND)
    window(B, CW["front"], -0.02, 0.022, 0.024, 0.026, WHITE, bars="cross",
           sill=WHITE, flowers=FLOWERS["white"])
    window(B, CW["right"], 0.0, 0.022, 0.024, 0.026, WHITE, bars="cross",
           sill=WHITE)
    gable_roof(B, cx_, cy_, cw, cd, chw, crise, "slate:slate-dark",
               ridge_mat="slate:slate-dark", barge=WHITE, gutter=None,
               over=0.009, over_gable=0.007)
    chimney(B, cx_ + 0.035, cy_, 0.09, 0.125, 0.02, 0.018, "brick:red",
            pots=1)
    B.finish(r)
    return r


# ---------------------------------------------------------------- tunnels

def _portal(name, opening, spring, rise, kind):
    """A dressed stone tunnel portal: outer face at y = 0, 0.08 deep, an
    elliptical arch with voussoirs and keystone, pilasters, a cornice and
    parapet, stepped wing walls, a black void and the route's floor."""
    r = root(name)
    B = Build(name)
    B.transfer = True
    STN = "stone:portal"
    DK = "stone:lining"
    W = opening / 2
    face = W + 0.085
    top = spring + rise + 0.06
    depth = 0.08
    B.body(gbox("face", (2 * face, depth, top + 0.003),
                (0, depth / 2, top / 2 - 0.0015), STN, bevel=0.0015,
                edge=0.05))
    n = 14

    def arch_pts(a, b, s, steps=n):
        pts = [(a, -0.01), (a, s)]
        for i in range(1, steps):
            t = math.pi * i / steps
            pts.append((math.cos(t) * a, s + math.sin(t) * b))
        pts += [(-a, s), (-a, -0.01)]
        return pts
    hole = arch_pts(W, rise, spring)
    cutter = prism_xz("cut", hole, -0.02, depth + 0.02, DK)
    B.cut(cutter)
    # The void at the back of the bore.
    B.add(K.pane("void", [(x, max(z, 0.0)) for x, z in hole],
                 depth - 0.004, VOID))
    # Voussoirs round the arch, the keystone proud of them.
    ring_w = 0.03
    for i in range(n - 1):
        t0 = math.pi * (i + 0.04) / (n - 1)
        t1 = math.pi * (i + 0.96) / (n - 1)
        mid = (t0 + t1) / 2
        key = abs(mid - math.pi / 2) < 0.12
        ow = ring_w + (0.012 if key else 0.0)
        quad = [(math.cos(t0) * W, spring + math.sin(t0) * rise),
                (math.cos(t0) * (W + ow), spring + math.sin(t0) * (rise + ow)),
                (math.cos(t1) * (W + ow), spring + math.sin(t1) * (rise + ow)),
                (math.cos(t1) * W, spring + math.sin(t1) * rise)]
        B.add(prism_xz("vouss", quad, -0.009 if key else -0.006, 0.004,
                       "stone:sand"))
    for k in (-1, 1):
        B.add(box("impost", (0.046, 0.01, 0.012),
                  (k * (W + 0.018), -0.003, spring - 0.004), "stone:sand",
                  bevel=0.001))
        B.add(gbox("pilaster", (0.032, 0.012, top - 0.012),
                   (k * (face - 0.024), -0.004, (top - 0.012) / 2 - 0.003),
                   "stone:sand", bevel=0.0012, edge=0.06))
    B.add(gbox("cornice", (2 * face + 0.02, 0.022, 0.01),
               (0, depth / 2 - 0.035 + 0.0, top - 0.008), "stone:sand",
               bevel=0.0015, edge=0.08))
    B.add(gbox("parapet", (2 * face, 0.02, 0.024),
               (0, 0.01, top + 0.009), STN, bevel=0.0012, edge=0.08))
    B.add(gbox("coping", (2 * face + 0.008, 0.026, 0.006),
               (0, 0.01, top + 0.023), "stone:sand", bevel=0.0012,
               edge=0.08))
    # Wing walls stepping down to the ground on both sides.
    wl = 0.19
    for k in (-1, 1):
        pts = [(face - 0.004, -0.003), (face + wl, -0.003),
               (face + wl, 0.05), (face - 0.004, top - 0.02)]
        pts = [(k * x, z) for x, z in pts]
        if k < 0:
            pts = list(reversed(pts))
        ww = prism_xz("wing", pts, 0.006, 0.07, STN)
        B.body(ww)
        a = Vector((k * (face - 0.004), 0.004, top - 0.017))
        b = Vector((k * (face + wl + 0.004), 0.004, 0.053))
        B.add(beam("wcope", a, b, (0.03, 0.007), "stone:sand",
                   up=Vector((0, 0, 1))))
        B.add(box("wend", (0.016, 0.07, 0.06), (k * (face + wl), 0.038,
                                                0.027), "stone:sand",
                  bevel=0.0012))
    # The route's floor through the opening.
    if kind == "road":
        B.add(gbox("asphalt", (0.3, depth + 0.004, 0.015),
                   (0, depth / 2 - 0.002, 0.0045), "asphalt:road",
                   edge=0.06))
        for k in (-1, 1):
            B.add(box("kerb", (0.025, depth + 0.004, 0.019),
                      (k * 0.1625, depth / 2 - 0.002, 0.0065), "stone:flag",
                      bevel=0.0008))
    else:
        bal = prism_xz("ballast", [(-0.12, -0.003), (0.12, -0.003),
                                   (0.1, 0.022), (-0.1, 0.022)], -0.002,
                       depth + 0.002, "ballast:grey")
        B.add(bal)
        for y in (0.012, 0.0445, 0.077):
            B.add(box("sleeper", (0.2, 0.03 if y < 0.07 else 0.006, 0.008),
                      (0, min(y, depth - 0.003), 0.026), "wood:timber"))
        for k in (-1, 1):
            B.add(box("rail", (0.006, depth + 0.002, 0.01),
                      (k * 0.045, depth / 2 - 0.001, 0.035), IRON))
    B.finish(r)
    return r


@asset
def tunnel_portal_road(name):
    return _portal(name, 0.34, 0.075, 0.115, "road")


@asset
def tunnel_portal_rail(name):
    return _portal(name, 0.26, 0.095, 0.12, "rail")


# ---------------------------------------------------------------- run

def tris(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def report(roots):
    kit.refresh()
    rows = []
    for r in roots:
        pts = []
        n = 0
        mats = set()
        for o in kit.descendants(r):
            if o.type == "MESH":
                pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
                n += tris(o)
                mats |= {m.name for m in o.data.materials}
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts),
                     min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts),
                     max(p.z for p in pts)))
        size = hi - lo
        kids = [k.name for k in r.children]
        rows.append((r.name, size, lo, hi, n, kids))
        print("ROOT %-20s size %.3f x %.3f x %.3f  z %.3f..%.3f  "
              "x %.3f..%.3f y %.3f..%.3f  tris %5d  kids %s" % (
                  r.name, size.x, size.y, size.z, lo.z, hi.z, lo.x, hi.x,
                  lo.y, hi.y, n, kids))
    allm = sorted({m.name for m in bpy.data.materials if ":" in m.name})
    print("MATERIALS", ", ".join(allm))
    return rows


def recentre(r):
    """Shift an asset so its footprint is centred on the root (portals keep
    their face on y = 0)."""
    if r.name.startswith("tunnel_portal"):
        return
    lo, hi = bounds(r)
    off = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, 0))
    if off.length < 0.002:
        return
    for o in r.children:
        if o.type == "MESH" and o.name != "blades":
            o.data.transform(T(*off))
        else:
            o.location += off
    kit.refresh()


def lay_out(roots, gap=1.4, per_row=6):
    pos = {}
    for i, r in enumerate(roots):
        pos[r.name] = Vector(((i % per_row) * gap, (i // per_row) * gap, 0))
    return pos


# ---------------------------------------------------------------- stage

def stage():
    scene = bpy.context.scene
    kit.gpu()
    scene.cycles.use_denoising = True
    scene.render.film_transparent = False
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    world = bpy.data.worlds.new("rota-preview")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.66, 0.82, 1)
    bg.inputs[1].default_value = 0.55
    sun = bpy.data.lights.new("rsun", "SUN")
    sun.energy = 4.2
    sun.angle = math.radians(3)
    sun.color = (1.0, 0.86, 0.68)
    s = bpy.data.objects.new("rsun", sun)
    # Late afternoon: low, from the front left.
    s.rotation_euler = Vector((-0.55, -0.75, 0.62)).to_track_quat(
        "Z", "Y").to_euler()
    scene.collection.objects.link(s)
    kit.tint("__meadow", "#8f9d63")
    kit.tint("__square", "#a9b47a")
    kit.tint("__edge", "#e9e2cc")
    floor = kit.box("__floor", (80, 80, 0.02), (0, 0, -0.0115),
                    mat="plain:__meadow", grid=False)
    kit.fill_ao([floor])
    return [s, floor]


def ref_square(at):
    sq = kit.box("__sq", (1.0, 1.0, 0.002), (at.x, at.y, -0.0005),
                 mat="plain:__square", grid=False)
    edges = []
    for k in (-1, 1):
        edges.append(kit.box("__e", (1.0, 0.008, 0.0025),
                             (at.x, at.y + k * 0.496, -0.0003),
                             mat="plain:__edge", grid=False))
        edges.append(kit.box("__e", (0.008, 1.0, 0.0025),
                             (at.x + k * 0.496, at.y, -0.0003),
                             mat="plain:__edge", grid=False))
    kit.fill_ao([sq] + edges)
    return [sq] + edges


def bounds(r):
    kit.refresh()
    pts = []
    for o in kit.descendants(r):
        if o.type == "MESH":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts),
                 min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts),
                 max(p.z for p in pts)))
    return lo, hi


def shot(path, centre, radius, elevation=55, azimuth=0, size=900, lens=80,
         samples=64, width=None):
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.render.resolution_x = width or size
    scene.render.resolution_y = size
    cam_data = bpy.data.cameras.new("pcam")
    cam_data.lens = lens
    cam_data.sensor_fit = "VERTICAL"
    cam = bpy.data.objects.new("pcam", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    dist = radius / math.tan(cam_data.angle_y / 2)
    cam.location = centre + Vector((math.sin(az) * math.cos(el) * -dist,
                                    -math.cos(az) * math.cos(el) * dist,
                                    math.sin(el) * dist))
    cam.rotation_euler = (centre - cam.location).to_track_quat(
        "-Z", "Y").to_euler()
    cam_data.clip_start = 0.01
    cam_data.clip_end = 200
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    print("PREVIEW", path)


def render_previews(path, roots):
    base = os.path.splitext(path)[0]
    K.preview_look()
    stage()
    # Line-up: houses and stations in front, scenery behind.
    order = [r for r in roots]
    x, y, row_h, rows = 0.0, 0.0, 0.0, []
    for r in order:
        lo, hi = bounds(r)
        wdt = hi.x - lo.x
        if x + wdt > 2.6 and x > 0:
            x, y = 0.0, y + row_h + 0.12
            row_h = 0.0
        r.location = Vector((x + wdt / 2 - (lo.x + hi.x) / 2 + r.location.x,
                             y - lo.y + r.location.y, 0))
        x += wdt + 0.1
        row_h = max(row_h, hi.y - lo.y)
    kit.refresh()
    lo = Vector((min(bounds(r)[0].x for r in roots),
                 min(bounds(r)[0].y for r in roots), 0))
    hi = Vector((max(bounds(r)[1].x for r in roots),
                 max(bounds(r)[1].y for r in roots), 0.1))
    centre = (lo + hi) / 2
    radius = max((hi.x - lo.x) / 3.2, (hi.y - lo.y) * 0.62) * 1.08
    shot(path, centre, radius, 55, 0, size=1000, width=1600, lens=60,
         samples=64)
    pos = lay_out(roots)
    for r in roots:
        r.location = pos[r.name]
    kit.refresh()
    # Close-ups: one asset at a time beside a 1 m square.
    for r in roots:
        for o in roots:
            for d_ in kit.descendants(o):
                d_.hide_render = o is not r
        sq = ref_square(r.location)
        lo, hi = bounds(r)
        c = (lo + hi) / 2
        rad = max((hi - lo).length * 0.62, 0.14)
        el = float(os.environ.get("ROTA_EL", 55))
        for az in (0, 30):
            shot("%s-%s-a%d.png" % (base, r.name, az), c, rad, el, az,
                 size=640, samples=48)
        if os.environ.get("ROTA_FAST"):
            for o in sq:
                bpy.data.objects.remove(o, do_unlink=True)
            continue
        # Game scale: the asset on its whole square.
        shot("%s-%s-game.png" % (base, r.name),
             Vector((r.location.x, r.location.y, 0.05)), 0.62, 55, 0,
             size=420, samples=32)
        for o in sq:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in roots:
        for d_ in kit.descendants(o):
            d_.hide_render = False


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
    # Bake each asset apart from the others.
    pos = lay_out(roots, gap=2.0)
    for r in roots:
        r.location = pos[r.name]
    kit.refresh()
    meshes = [o for r in roots for o in kit.descendants(r) if o.type == "MESH"]
    kit.bake_ao(meshes, samples=96, distance=0.06)
    for r in roots:
        r.location = (0, 0, 0)
    kit.refresh()
    report(roots)
    if out:
        kit.export(roots, out)
    if prev:
        render_previews(prev, roots)


main()
