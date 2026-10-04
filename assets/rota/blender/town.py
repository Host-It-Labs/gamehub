"""Rota's mill town: terraces, shops, pubs, civic buildings and the small
things of back yards and squares (docs/concepts/2026-10-03-rota-mill-town/
brief.md, the `town.py` list).

One grid square is 25 m = 1 Blender metre, the ground is z = 0, fronts face
-Y. Every asset is a root empty at its footprint centre with one joined mesh
under it. Terrace modules (terrace_a, terrace_b, terrace_tall, cottage,
shop, lockup) keep their party walls flush with x = ±w/2 so a row of them
reads as one terrace; each carries half a chimney stack on both party
walls, so two neighbours make one whole stack. The corner buildings are
party-walled on +X and +Y, with gables there that cover a terrace
neighbour's roof.

  Blender -b --factory-startup --python assets/rota/blender/town.py -- \
      assets/rota/build/town.glb docs/concepts/2026-10-03-rota-mill-town/previews/town.png

With a preview path it renders the line-up there, close-ups from the game
camera (elevation 55, azimuth 0 and 30) beside a one-square reference and a
car-sized box as town-<asset>-a0/a30.png, and a terrace row and a street
row as town-row-*.png. ROTA_ONLY=name,name builds a subset.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rkit  # noqa: E402

kit = rkit.kit
rkit.reset(seed=11)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import building_kit as K  # noqa: E402
from building_kit import (Build, Wall, walls, window, door, gable_roof,  # noqa
                          hip_roof, gbox, box, cyl, lathe, ball,
                          beam, prism_xz, extrude_x, mesh, tf, T, rot, clock,
                          awning, bench as kit_bench)

# ---------------------------------------------------------------- palette
# A grown-up Victorian palette: red-brown brick gone sooty, blue-grey
# slate, sandstone dressings, deep painted doors and cream frames.

TINTS = {
    # brick
    "millbrick": "#9b5440", "sootbrick": "#7f4636", "darkbrick": "#683b2f",
    "bluebrick": "#4d474a",
    # roofs
    "slate": "#5c6670", "slate-dark": "#4a525b", "lead": "#6d7477",
    "bandred": "#9a3b2f", "felt": "#3d3f41",
    # stone
    "sandstone": "#c8b48c", "sootstone": "#a6967a", "step": "#d9d1bd",
    "area": "#57524b", "flag": "#a19b8f",
    # paint
    "cream": "#e8dec4", "door-green": "#2e4a3a", "door-maroon": "#5e2629",
    "door-navy": "#283654", "door-black": "#25262a", "black": "#232427",
    "pot": "#a85b3d", "glazed": "#2f5a4b", "glazed-cream": "#d8cca8",
    "fascia": "#22392f", "fascia-maroon": "#4e2224", "gilt": "#c4a052",
    "awning-red": "#8e3030", "awning-cream": "#e4d9bc",
    "awning-green": "#355a45", "lamp-green": "#2c3b34",
    "clockface": "#f1ebdb", "linen": "#ece7da", "shirt": "#7d91aa",
    "louvre": "#3b3d3c", "sign": "#2a3a52",
    # metal, glass, glow
    "iron": "#34383d", "zinc": "#7e858b", "brass": "#b8954a",
    "dark": "#2a3442", "lamp": "#fff1c4", "bell": "#8a6a3a",
    # wood
    "plank": "#6b5540", "shed": "#7b6b57", "post": "#57483a",
    "cane": "#b39a68",
    # ground and growing things
    "soil": "#5b4634", "allot": "#71884a", "veg": "#557335",
    "veg-light": "#7d9a52", "bean": "#4d6b30",
}
for _n, _h in TINTS.items():
    kit.tint(_n, _h)

BRICK = "brick:millbrick"
SOOT = "brick:sootbrick"
DARKB = "brick:darkbrick"
BLUEB = "brick:bluebrick"
SLATE = "slate:slate"
SLATE_D = "slate:slate-dark"
LEAD = "metal:lead"
SAND = "stone:sandstone"
SOOTSTONE = "stone:sootstone"
STEP = "stone:step"
FRAME = "paint:cream"
GREEN = "paint:door-green"
MAROON = "paint:door-maroon"
NAVY = "paint:door-navy"
BLACKDOOR = "paint:door-black"
BLACK = "paint:black"
GUTTER = "paint:black"
POT = "paint:pot"
GLASS = "glass:dark"
LAMP = "glow:lamp"
IRON = "metal:iron"
GILT = "paint:gilt"
PLANK = "wood:plank"
kit.tint("lead", TINTS["lead"])

ASSETS = {}

# Listed footprints (w, d) and heights, checked by the report.
FOOT = {
    "terrace_a": (0.20, 0.26, 0.31), "terrace_b": (0.20, 0.26, 0.31),
    "terrace_tall": (0.20, 0.26, 0.42), "cottage": (0.20, 0.22, 0.20),
    "shop": (0.20, 0.26, 0.31), "lockup": (0.20, 0.20, 0.13),
    "corner_pub": (0.26, 0.26, 0.33), "corner_shop": (0.24, 0.24, 0.33),
    "town_hall": (0.50, 0.38, 0.72), "market_hall": (0.50, 0.34, 0.34),
    "chapel": (0.30, 0.40, 0.40), "bank": (0.26, 0.26, 0.32),
    "school": (0.46, 0.30, 0.34),
    "yard_wall": (0.20, 0.012, 0.045), "privy": (0.045, 0.045, 0.055),
    "washing_line": (0.18, 0.03, 0.06), "allotment": (0.40, 0.40, 0.06),
    "bandstand": (0.16, 0.16, 0.13), "bench": (0.04, 0.014, 0.025),
    "gas_lamp": (0.012, 0.012, 0.14),
}
BUDGET = {
    "terrace_a": 1200, "terrace_b": 1200, "terrace_tall": 1200,
    "cottage": 1200, "lockup": 1200, "shop": 2000, "corner_pub": 2000,
    "corner_shop": 2000, "town_hall": 4500, "market_hall": 4500,
    "chapel": 4500, "bank": 4500, "school": 4500,
}
STACKED = ("terrace_a", "terrace_b", "terrace_tall", "cottage", "shop",
           "lockup", "corner_pub", "corner_shop", "school")
CORNERS = ("corner_pub", "corner_shop")   # eaves may pass +X, +Y by 4 mm
TERRACES = ("terrace_a", "terrace_b", "terrace_tall", "cottage", "shop",
            "lockup")


def asset(fn):
    ASSETS[fn.__name__] = fn
    return fn


def root(name):
    return kit.empty(name)


# ---------------------------------------------------------------- helpers

def front(x, y, z=0.0):
    return Wall((x, y, z), (0, -1, 0))


def gutter_x(B, x0, x1, y, z, r=0.0028):
    B.add(cyl("gutter", r, r, x1 - x0, ((x0 + x1) / 2, y, z), 6, GUTTER,
              axis="x", rings=1))


def gutter_y(B, y0, y1, x, z, r=0.0028):
    B.add(cyl("gutter", r, r, y1 - y0, (x, (y0 + y1) / 2, z), 6, GUTTER,
              axis="y", rings=1))


def downpipe(B, x, y, z1, z0=-0.002):
    B.add(cyl("pipe", 0.0016, 0.0016, z1 - z0, (x, y, z0), 6, GUTTER,
              rings=1))


def half_stack(B, xw, side, y, z0, z1, hw=0.017, d=0.05, mat=BRICK,
               cap=SAND, pots=1, axis="x"):
    """Half a chimney stack against the party wall at x = xw (side +1: the
    wall is the asset's right side). The cap and pots stop flush with the
    wall, so the neighbour's half completes the stack. axis "y": the wall
    is y = xw instead, the stack centred on x = y."""
    if axis == "y":
        n0 = len(B.parts)
        half_stack(B, xw, side, -y, z0, z1, hw, d, mat, cap, pots)
        for o, _ in B.parts[n0:]:
            tf(o, rot("Z", 90))
        return
    xm = xw - side * hw / 2
    B.add(box("stack", (hw, d, z1 - z0), (xm, y, (z0 + z1) / 2), mat))
    cw = hw + 0.003
    B.add(box("scap", (cw, d + 0.006, 0.006), (xw - side * cw / 2, y,
                                                z1 - 0.003), cap))
    B.add(box("scap2", (hw, d + 0.002, 0.003), (xm, y, z1 + 0.0015), cap))
    for i in range(pots):
        py = y + (i - (pots - 1) / 2) * 0.016
        B.add(lathe("pot", [(0.0036, z1 + 0.002), (0.0029, z1 + 0.011),
                            (0.0038, z1 + 0.013)],
                    (xw - side * 0.0085, py, 0), 6, POT))


def stack(B, x, y, z0, z1, w, d, mat=BRICK, cap=SAND, pots=2, along="x"):
    """A whole chimney stack with a corbelled cap and pots."""
    B.add(box("stack", (w, d, z1 - z0), (x, y, (z0 + z1) / 2), mat))
    B.add(box("scap", (w + 0.006, d + 0.006, 0.006), (x, y, z1 - 0.003),
              cap))
    B.add(box("scap2", (w + 0.002, d + 0.002, 0.003), (x, y, z1 + 0.0015),
              cap))
    for i in range(pots):
        o = (i - (pots - 1) / 2) * (w if along == "x" else d) / pots
        px, py = (x + o, y) if along == "x" else (x, y + o)
        B.add(lathe("pot", [(0.0036, z1 + 0.002), (0.0029, z1 + 0.011),
                            (0.0038, z1 + 0.013)],
                    (px, py, 0), 6, POT))


def strip(B, wall, u0, u1, z, h, out, mat, name="strip", body=False):
    """A course across part of a wall face, `out` proud of it (a body when
    openings must cut through it)."""
    o = wall.put(box(name, (u1 - u0, out + 0.001, h),
                     ((u0 + u1) / 2, -out / 2 + 0.0005, z + h / 2), mat))
    if body:
        B.body(o)
    else:
        B.add(o)


def band_course(B, cx, cy, w, d, z, h, mat, out=0.002):
    """A string course or cornice round a block (a plain box: the kit's is
    gridded for AO, too heavy for long thin courses)."""
    B.add(box("course", (w + 2 * out, d + 2 * out, h), (cx, cy, z), mat))


def parapet(B, cx, cy, w, d, z0, h, mat, t=0.006):
    """A parapet round a flat roof: four walls standing on z0."""
    for sx, sy, ox, oy in ((w, t, 0, -(d - t) / 2), (w, t, 0, (d - t) / 2),
                           (t, d - 2 * t, -(w - t) / 2, 0),
                           (t, d - 2 * t, (w - t) / 2, 0)):
        B.add(box("parapet", (sx, sy, h), (cx + ox, cy + oy, z0 + h / 2),
                  mat))


def course(B, cx, cy, w, d, z, h, mat, out=0.002):
    """band_course as a body, so windows and doors cut through it."""
    band_course(B, cx, cy, w, d, z, h, mat, out)
    B.bodies.append(B.parts[-1][0])


def window(B, wall, u, z0, w, h, frame=FRAME, arch=None, bars="sash",
           sill=None, lintel=None, keystone=None, recess=0.005, glass=GLASS,
           fb=0.003, seg=6, **_):
    """A window in a carved reveal: glass at the back, the frame and
    glazing bars as flat faces just in front of it, a stone sill and
    lintel. Lighter than building_kit.window (no boxed frame or bars), as
    the terraces repeat by the hundred."""
    inner = K.outline(w, h, arch, seg)
    cpts = [(x + u, z0 + z) for x, z in inner]
    B.cut(wall.put(prism_xz("cut", cpts, -0.02, recess, None)))
    B.add(wall.put(K.pane("glass", cpts, recess - 0.0006, glass)))
    yb = recess - 0.0013
    if fb:
        O = [(x + u, z0 + z) for x, z in inner]
        I = [(x + u, z0 + fb + z) for x, z in
             K.outline(w - 2 * fb, h - 2 * fb, arch, seg)]
        n = len(O)
        verts = [(x, yb, z) for x, z in O] + [(x, yb, z) for x, z in I]
        faces = [[i, i + 1, n + i + 1, n + i] for i in range(n - 1)]
        faces.append([n - 1, 0, n, 2 * n - 1])
        B.add(wall.put(mesh("frame", verts, faces, frame, fix=False)))
    t = 0.0024
    spring = h - w / 2 if arch == "round" else (
        h - w * 0.75 if arch == "pointed" else h)
    rails, posts = [], []
    if bars in ("sash", "cross"):
        rails = [h * 0.52 if arch is None else spring]
        posts = [0.0]
    elif bars == "transom":
        rails = [h * 0.55 if arch is None else spring]
    elif bars == "grid":
        rails = [h / 3, 2 * h / 3] if arch is None else [spring * 0.5, spring]
        posts = [0.0]
    elif bars == "vertical":
        rails = [h * 0.78]
        posts = [-w / 6, w / 6]
    elif bars == "mullion":
        posts = [0.0]
    for zz in rails:
        q = [(u - w / 2, z0 + zz - t / 2), (u + w / 2, z0 + zz - t / 2),
             (u + w / 2, z0 + zz + t / 2), (u - w / 2, z0 + zz + t / 2)]
        B.add(wall.put(K.pane("bar", q, yb - 0.0002, frame)))
    for xx in posts:
        top = spring if arch else h
        q = [(u + xx - t / 2, z0), (u + xx + t / 2, z0),
             (u + xx + t / 2, z0 + top), (u + xx - t / 2, z0 + top)]
        B.add(wall.put(K.pane("bar", q, yb - 0.0001, frame)))
    if sill:
        B.add(wall.put(box("sill", (w + 0.008, 0.008, 0.0035),
                           (u, -0.002, z0 - 0.0016), sill)))
    if lintel:
        B.add(wall.put(box("lintel", (w + 0.008, 0.004, 0.007),
                           (u, -0.0008, z0 + h + 0.0035), lintel)))
    if keystone:
        B.add(wall.put(box("key", (0.007, 0.004, 0.01),
                           (u, -0.0012, z0 + h + 0.001), keystone)))


def sash(B, wall, u, z0, w, h, sill=SAND, lintel=SAND, bars="sash",
         frame=FRAME, fb=0.003, **kw):
    window(B, wall, u, z0, w, h, frame, bars=bars, sill=sill, lintel=lintel,
           fb=fb, **kw)


def plain_window(B, wall, u, z0, w, h, sill=SAND, frame=FRAME, bars="transom",
                 arch=None):
    """A cheap window for backs and sides: recess, glass, one bar, sill."""
    window(B, wall, u, z0, w, h, frame, bars=bars, sill=sill, fb=0.0025,
           arch=arch)


def plan_prism(name, pts, z0, z1, mat=None):
    """A plan polygon (x, y, counterclockwise) extruded from z0 to z1."""
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return mesh(name, verts, faces, mat)


def pediment(B, x, y, z, w, rise, depth, mat, cornice=None, out=0.004):
    """A triangular pediment facing -y on a wall at y, base at z."""
    B.add(prism_xz("pedi", [(x + w / 2, z), (x, z + rise), (x - w / 2, z)],
                   y - depth, y + 0.002, mat))
    if cornice:
        a = math.atan2(rise, w / 2)
        yc = y - depth / 2 - 0.001
        for k in (-1, 1):
            pa = Vector((x + k * (w / 2 + out), yc,
                         z - out * math.tan(a) + 0.002))
            pb = Vector((x, yc, z + rise + out + 0.001))
            B.add(beam("rake", pa, pb, (depth + 0.004, 0.004), cornice,
                       up=Vector((0, 0, 1))))
        B.add(box("pcorn", (w + 2 * out, depth + 0.004, 0.004),
                  (x, yc, z - 0.001), cornice))


def column(B, x, y, z0, z1, r, mat=SAND, base=True):
    B.add(cyl("col", r, r * 0.88, z1 - z0, (x, y, z0), 8, mat, rings=1))
    if base:
        B.add(box("cbase", (2.5 * r, 2.5 * r, 0.004), (x, y, z0 + 0.002),
                  mat))
    B.add(box("ccap", (2.6 * r, 2.6 * r, 0.004), (x, y, z1 - 0.002), mat))


def steps(B, x, y_front, w, n, rise, tread, mat=STEP, y_back=None):
    """A flight of n steps rising towards +y from y_front."""
    for i in range(n):
        y0 = y_front + i * tread
        y1 = y_back if y_back is not None else y_front + n * tread + 0.004
        h = (i + 1) * rise
        B.add(box("step", (w, y1 - y0, h + 0.002), (x, (y0 + y1) / 2,
                                                     h / 2 - 0.001), mat))


def lantern(B, x, y, z, s=0.008, frame=BLACK):
    """A small wall or post lantern, its glass glowing."""
    B.add(cyl("lglass", s * 0.42, s * 0.6, s * 1.1, (x, y, z), 4, LAMP))
    B.add(cyl("lcap", s * 0.72, 0.0006, s * 0.55, (x, y, z + s * 1.1), 4,
              frame))
    B.add(box("lbot", (s * 0.7, s * 0.7, s * 0.18), (x, y, z - s * 0.06),
              frame))


def wall_lamp(B, wall, u, z, reach=0.012):
    """A lantern on an iron bracket off a wall."""
    a = wall.at(u, 0.0, z)
    b = wall.at(u, -reach, z)
    B.add(beam("lbracket", a, b, (0.0014, 0.0016), BLACK,
               up=Vector((0, 0, 1))))
    lantern(B, b.x, b.y, z - 0.012, 0.009)


def railing(B, a, b, h, n, post=BLACK, top=True, mid=True):
    """Iron railings from a to b (x, y): n bars, a top rail."""
    a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
    verts, faces = [], []
    q = 0.0006
    for i in range(n):
        p = a + (b - a) * (i / (n - 1))
        k = len(verts)
        for z in (-0.001, h + 0.003):
            verts += [(p.x - q, p.y - q, z), (p.x + q, p.y - q, z),
                      (p.x + q, p.y + q, z), (p.x - q, p.y + q, z)]
        faces += [[k + j, k + (j + 1) % 4, k + 4 + (j + 1) % 4, k + 4 + j]
                  for j in range(4)]
    B.add(mesh("rbars", verts, faces, post))
    if top:
        B.add(beam("rtop", a + Vector((0, 0, h)), b + Vector((0, 0, h)),
                   (0.0018, 0.0018), post))
    if top and mid:
        B.add(beam("rmid", a + Vector((0, 0, h * 0.25)),
                   b + Vector((0, 0, h * 0.25)), (0.0012, 0.0012), post))


# ---------------------------------------------------------------- terraces

W = 0.20             # frontage
YF, YB = -0.112, 0.116   # front and back wall of a terrace module
CY = (YF + YB) / 2
HW, RISE = 0.22, 0.075   # eaves and rise to the ridge (2 storeys)


STACK_Y = 0.022      # party-wall stacks, in a 0.26-deep module's frame


def terrace_shell(B, hw=HW, rise=RISE, yf=YF, yb=YB, brick=BRICK, w=W,
                  stack_top=None, roof=SLATE, eaves_course=True, ys=STACK_Y,
                  gap=None):
    """Walls, slate roof flush with both party walls, gutters, half stacks
    on both party walls and the eaves course. `gap` (x0, x1) breaks the
    front gutter and course for a wall dormer; the roof is then a body."""
    d = yb - yf
    cy = (yf + yb) / 2
    B.body(K.body("walls", w, d, hw, rise, "x", centre=(0, cy), mat=brick,
                  bevel=0.0, edge=0.1))
    over = 0.007
    n0 = len(B.parts)
    a = gable_roof(B, 0, cy, w, d, hw, rise, roof, ridge="x", over=over,
                   over_gable=0.0, thick=0.006, ridge_mat=SLATE_D,
                   edge=0.1)
    B.parts[n0][0].modifiers.clear()      # no groove at the party walls
    if gap:
        B.bodies.append(B.parts[n0][0])
    ca, sa = math.cos(a), math.sin(a)
    ge = hw - over * sa - 0.002
    for k, yy in ((-1, yf), (1, yb)):
        yg = yy + k * (over * ca + 0.0022)
        if gap and k < 0:
            gutter_x(B, -w / 2, gap[0], yg, ge)
            gutter_x(B, gap[1], w / 2, yg, ge)
        else:
            gutter_x(B, -w / 2, w / 2, yg, ge)
    # Stacks on both party walls, a little behind the ridge.
    ridge_z = hw + rise
    z1 = stack_top or (ridge_z + 0.05)
    for side in (-1, 1):
        half_stack(B, side * w / 2, side, ys, ridge_z - 0.03, z1, mat=brick)
    if eaves_course and not gap:
        f = front(0, yf)
        strip(B, f, -w / 2, w / 2, hw - 0.009, 0.006, 0.0025, DARKB,
              "dentil")
    return d, cy


def terrace_back(B, hw, yb, leaf, upper=(0.13,), door_u=0.05, w=W,
                 pair=True):
    """The back: a plank door, a kitchen window and the upstairs ones.
    (The back wall's u runs along -x.)"""
    bk = Wall((0, yb, 0), (0, 1, 0))
    door(B, bk, door_u, 0.032, 0.082, leaf, FRAME, step=SAND, panels=False,
         fb=0.0025, knob=None)
    plain_window(B, bk, -0.035, 0.035, 0.04, 0.05)
    for z in upper:
        plain_window(B, bk, -0.035, z, 0.04, 0.05)
        if pair:
            plain_window(B, bk, door_u, z + 0.006, 0.032, 0.044)
    downpipe(B, -w / 2 + 0.004, yb + 0.003, hw - 0.004)


def front_door(B, f, u, leaf, h=0.098, w=0.036, z_lintel=True):
    door(B, f, u, w, h, leaf, FRAME, fanlight=True, step=STEP, recess=0.007,
         fb=0.003, knob=None, panels=False)
    # Two raised panels as flat faces on the leaf.
    for zc in (0.022, 0.06):
        for k in (-1, 1):
            q = [(u + k * 0.0085 - 0.0055, zc - 0.014),
                 (u + k * 0.0085 + 0.0055, zc - 0.014),
                 (u + k * 0.0085 + 0.0055, zc + 0.014),
                 (u + k * 0.0085 - 0.0055, zc + 0.014)]
            B.add(f.put(K.pane("panel", q, 0.0052, "paint:door-black")))
    if z_lintel:
        B.add(f.put(box("dlintel", (w + 0.014, 0.004, 0.008),
                        (u, -0.0012, h + 0.0034 + 0.004), SAND)))


def two_up(B, f, du, wu, z=0.13, h=0.058):
    """The two upstairs sashes, over the door and the window below."""
    sash(B, f, du, z, 0.036, h - 0.002)
    sash(B, f, wu, z, 0.048, h)


def canted_bay(B, f, bx, z1=0.1, base=0.066, proj=0.015, wmat=SAND):
    """A canted bay window on the ground floor, stone, with a slate top."""
    yf = f.o.y
    hb, hf = base / 2, base / 2 - proj
    yp = yf - proj
    pts = [(bx - hb, yf + 0.004), (bx - hb, yf), (bx - hf, yp), (bx + hf, yp),
           (bx + hb, yf), (bx + hb, yf + 0.004)]
    B.body(plan_prism("bay", pts, -0.003, z1, wmat))
    # Glass in each face.
    bf = Wall((bx, yp, 0), (0, -1, 0))
    sash(B, bf, 0.0, 0.03, 2 * hf - 0.006, 0.058, sill=None, lintel=None,
         fb=0.0025, bars="sash")
    for k in (-1, 1):
        mx = bx + k * (hb + hf) / 2
        my = (yf + yp) / 2
        sw = Wall((mx, my, 0), (k * 1, -1, 0))
        window(B, sw, 0.0, 0.03, 0.012, 0.058, FRAME, bars="transom",
               fb=0.002, recess=0.004)
    # Sill course and a slate top sloping back to the wall.
    o = 0.003
    B.add(plan_prism("baysill", [(bx - hb - 0.001, yf), (bx - hf - 0.001,
                                                         yp - o),
                                 (bx + hf + 0.001, yp - o),
                                 (bx + hb + 0.001, yf)][::-1], 0.024, 0.029,
                     SAND))
    cz, tz = z1, z1 + 0.018
    vb = [(bx - hb - o, yf + 0.001, cz), (bx - hf - o, yp - o, cz),
          (bx + hf + o, yp - o, cz), (bx + hb + o, yf + 0.001, cz),
          (bx + hb + o, yf + 0.001, tz), (bx - hb - o, yf + 0.001, tz)]
    faces = [[3, 2, 1, 0], [1, 2, 4, 5], [0, 1, 5], [2, 3, 4], [3, 0, 5, 4]]
    B.add(mesh("baytop", vb, faces, SLATE))
    B.add(plan_prism("baycorn2", [(bx - hb - o, yf), (bx - hf - o, yp - o),
                                  (bx + hf + o, yp - o),
                                  (bx + hb + o, yf)][::-1],
                     cz - 0.006, cz, SAND))


def terrace(name, door_side, bay=False, leaf=GREEN, back_leaf=BLACKDOOR):
    r = root(name)
    B = Build(name)
    terrace_shell(B)
    f = front(0, YF)
    du = door_side * 0.06
    wu = -door_side * 0.03
    front_door(B, f, du, leaf)
    if bay:
        canted_bay(B, f, wu)
    else:
        sash(B, f, wu, 0.03, 0.048, 0.066)
    two_up(B, f, du, wu)
    # A stone plinth course and a downpipe at the left party wall.
    strip(B, f, -W / 2, W / 2, -0.002, 0.012, 0.0022, SOOTSTONE, "plinth")
    downpipe(B, -W / 2 + 0.0035, YF - 0.0025, HW - 0.004)
    terrace_back(B, HW, YB, back_leaf, door_u=-door_side * 0.05)
    B.finish(r)
    return r


@asset
def terrace_a(name):
    """Two-up two-down: door on the left with a fanlight and a whitened
    step, a sash beside it, two sashes upstairs, stone sills and lintels,
    half stacks on both party walls."""
    return terrace(name, -1, leaf=GREEN)


@asset
def terrace_b(name):
    """As terrace_a, the door on the right and a canted stone bay."""
    return terrace(name, 1, bay=True, leaf=MAROON)


@asset
def terrace_tall(name):
    """A three-storey house with sandstone dressings: a raised door up
    three steps, a basement area behind railings, band courses."""
    r = root(name)
    B = Build(name)
    hw, rise = 0.33, 0.075
    yf, yb = -0.102, 0.12
    terrace_shell(B, hw, rise, yf, yb, brick=SOOT, eaves_course=False)
    f = front(0, yf)
    g = 0.03          # raised ground floor
    du, wu = -0.06, 0.03
    # Raised door with a stone surround up three steps.
    fd = front(0, yf, g)
    door(B, fd, du, 0.036, 0.094, NAVY, FRAME, fanlight=True, step=None,
         recess=0.007, fb=0.0, panels=False, knob=None)
    for k in (-1, 1):
        B.add(f.put(box("pilaster", (0.006, 0.004, 0.1),
                        (du + k * 0.024, -0.0015, g + 0.05), SAND)))
    B.add(f.put(box("dhead", (0.058, 0.007, 0.01),
                    (du, -0.003, g + 0.104), SAND)))
    steps(B, du, -0.13, 0.05, 3, g / 3, 0.0093, STEP, y_back=yf + 0.002)
    # Windows: ground (tall), first, second; basement below the area.
    sash(B, f, wu, g + 0.016, 0.05, 0.074, lintel=None)
    for z, h in ((0.14, 0.072), (0.245, 0.06)):
        sash(B, f, du, z, 0.038, h, lintel=None)
        sash(B, f, wu, z, 0.05, h, lintel=None)
    plain_window(B, f, wu, 0.004, 0.044, 0.02, sill=None)
    # Sandstone band courses at the floors and a cornice at the eaves.
    for z in (0.128, 0.233):
        strip(B, f, -W / 2, W / 2, z, 0.007, 0.0025, SAND, "band")
    strip(B, f, -W / 2, -0.032, -0.002, 0.03, 0.0025, SAND, "plinth")
    strip(B, f, -W / 2, W / 2, hw - 0.012, 0.01, 0.005, SAND, "cornice")
    # The basement area: dark flags, a coping and spear railings.
    B.add(box("area", (0.128, 0.024, 0.002), (0.034, yf - 0.012, 0.0),
              "stone:area"))
    B.add(box("acope", (0.128, 0.004, 0.006), (0.034, -0.126, 0.002),
              SAND))
    railing(B, (-0.031, -0.126), (0.097, -0.126), 0.03, 9, mid=False)
    downpipe(B, -W / 2 + 0.0035, yf - 0.0025, hw - 0.006)
    terrace_back(B, hw, yb, BLACKDOOR, upper=(0.135, 0.24), door_u=0.05,
                 pair=False)
    B.finish(r)
    return r


@asset
def cottage(name):
    """A low workers' cottage, one and a half storeys: the bedroom window
    in a gabled dormer breaking the eaves."""
    r = root(name)
    B = Build(name)
    hw, rise = 0.13, 0.058
    yf, yb = -0.098, 0.098
    w = W
    dx, dw, dd = 0.012, 0.06, 0.05
    dz0, dz1, dr = hw - 0.012, 0.172, 0.022
    ys = STACK_Y + (0.13 - 0.11)
    d, cy = terrace_shell(B, hw, rise, yf, yb, brick=SOOT, stack_top=0.235,
                          ys=ys, gap=(dx - dw / 2 - 0.004,
                                      dx + dw / 2 + 0.004))
    # Notch the roof and wall head where the dormer breaks the eaves.
    B.cut(box("notch", (dw - 0.001, dd + 0.03, 0.3),
              (dx, yf + dd / 2 - 0.016, dz0 + 0.15)))
    B.carve()
    f = front(0, yf)
    du, wu = -0.065, 0.012
    front_door(B, f, du, GREEN, h=0.09, w=0.034)
    sash(B, f, wu, 0.028, 0.05, 0.06)
    sash(B, f, 0.074, 0.032, 0.026, 0.05, bars="transom", lintel=SAND)
    strip(B, f, -w / 2, w / 2, -0.002, 0.012, 0.0022, SOOTSTONE, "plinth")
    # Dormer: brick cheeks rising from the wall, a small slate gable.
    B.body(K.body("dormer", dw, dd, dz1, dr, "y",
                  centre=(dx, yf + dd / 2), mat=SOOT, bevel=0.0, edge=0.07,
                  z0=dz0))
    sash(B, Wall((dx, yf, 0), (0, -1, 0)), 0.0, 0.118, 0.036, 0.044,
         lintel=None, sill=None)
    gable_roof(B, dx, yf + dd / 2 + 0.004, dw, dd + 0.008, dz1, dr, SLATE,
               ridge="y", over=0.005, over_gable=0.003, thick=0.005,
               ridge_mat=SLATE_D, barge=FRAME, edge=0.07)
    downpipe(B, -w / 2 + 0.0035, yf - 0.0025, hw - 0.004)
    bk = Wall((0, yb, 0), (0, 1, 0))
    door(B, bk, 0.06, 0.03, 0.08, BLACKDOOR, FRAME, step=SAND, panels=False,
         fb=0.0025, knob=None)
    plain_window(B, bk, -0.04, 0.035, 0.04, 0.045)
    B.finish(r)
    return r


@asset
def shop(name):
    """A terrace shop: a painted shopfront with pilasters, fascia and
    cornice, a big window, a recessed door and a striped awning."""
    r = root(name)
    B = Build(name)
    terrace_shell(B)
    f = front(0, YF)
    fc = "paint:fascia"
    # Shopfront frame.
    for k in (-1, 1):
        B.add(f.put(box("pilaster", (0.009, 0.007, 0.104),
                        (k * 0.0935, -0.0025, 0.051), fc)))
        B.add(f.put(box("console", (0.011, 0.01, 0.014),
                        (k * 0.0935, -0.004, 0.097), fc)))
    B.add(f.put(box("fascia", (0.178, 0.007, 0.016), (0, -0.0025, 0.096),
                    fc)))
    B.add(f.put(box("letters", (0.12, 0.0012, 0.006), (0.0, -0.0062, 0.096),
                    GILT)))
    B.add(f.put(box("cornice", (0.2, 0.011, 0.004), (0, -0.0045, 0.106),
                    fc)))
    B.add(f.put(box("stall", (0.11, 0.006, 0.024), (0.026, -0.002, 0.011),
                    fc)))
    window(B, f, 0.026, 0.024, 0.104, 0.06, fc, bars="vertical", fb=0.003,
           recess=0.006)
    door(B, f, -0.064, 0.032, 0.084, fc, fc, fanlight=True, step=STEP,
         recess=0.014, fb=0.0025, panels=False)
    awning(B, f, 0.0, 0.087, 0.176, 0.0165, 0.012,
           ["paint:awning-red", "paint:awning-cream"], n=9, flap=0.006)
    two_up(B, f, -0.06, 0.03)
    downpipe(B, -W / 2 + 0.0035, YF - 0.0025, HW - 0.004)
    terrace_back(B, HW, YB, BLACKDOOR, door_u=0.05)
    B.finish(r)
    return r


@asset
def lockup(name):
    """A single-storey brick workshop or stable: big plank doors under a
    segmental brick arch, a barred window, a roof light."""
    r = root(name)
    B = Build(name)
    hw, rise = 0.088, 0.034
    yf, yb = -0.089, 0.089
    w = W
    d = yb - yf
    B.body(K.body("walls", w, d, hw, rise, "x", centre=(0, 0), mat=SOOT,
                  bevel=0.0, edge=0.08))
    over = 0.006
    a = gable_roof(B, 0, 0, w, d, hw, rise, SLATE, over=over,
                   over_gable=0.0, thick=0.005, ridge_mat=SLATE_D, edge=0.08)
    ge = hw - over * math.sin(a) - 0.002
    for k, yy in ((-1, yf), (1, yb)):
        gutter_x(B, -w / 2, w / 2, yy + k * (over * math.cos(a) + 0.0022),
                 ge)
    f = front(0, yf)
    door(B, f, -0.03, 0.074, 0.074, PLANK, "paint:door-green",
         arch="segment", step=None, double=True, panels=False, knob=IRON,
         fb=0.0)
    # Brick arch over the doors and plank battens.
    B.add(f.put(K.band("arch", [(x - 0.03, z) for x, z in
                                K.outline(0.074, 0.074, "segment")][1:-1],
                       [(x - 0.03, z) for x, z in
                        K.offset_outline(0.074, 0.074, "segment", 0.006)][1:-1],
                       -0.002, 0.002, DARKB)))
    for z in (0.016, 0.05):
        B.add(f.put(box("batten", (0.072, 0.002, 0.004),
                        (-0.03, 0.004, z), "paint:door-green")))
    plain_window(B, f, 0.058, 0.03, 0.036, 0.032, bars="grid")
    B.add(f.put(box("wlintel", (0.044, 0.004, 0.006), (0.058, -0.001, 0.066),
                    SAND)))
    # A roof light on the back slope, a half stack each side.
    zl = K.roof_z(hw, rise, d / 2, 0.045) + 0.0045
    rl = box("rooflight", (0.04, 0.03, 0.002), (0.0, 0, 0), GLASS)
    tf(rl, T(0.04, 0.045, zl) @ rot("X", -math.degrees(a)))
    B.add(rl)
    for side in (-1, 1):
        half_stack(B, side * w / 2, side, STACK_Y + 0.03, hw + rise - 0.03,
                   hw + rise + 0.03, hw=0.014, d=0.036, mat=SOOT)
    downpipe(B, w / 2 - 0.0035, yf - 0.0025, hw - 0.004)
    B.finish(r)
    return r


# ---------------------------------------------------------------- corners

def corner_building(name, size, hw, rise, kind):
    """A corner building at the meeting of two streets: front on -Y, side
    on -X, the door on a chamfered corner at (-X, -Y), party walls flush
    with +X and +Y. Two crossing slate roofs give a gable to each street
    and a gable on each party wall that covers a terrace neighbour's roof.
    The street walls stand on the terraces' building line."""
    r = root(name)
    B = Build(name)
    pub = kind == "pub"
    half = size / 2
    x0 = -half + 0.018            # street walls (the terraces' front line)
    x1 = half                     # party walls
    w = x1 - x0
    c = (x0 + x1) / 2
    ch = 0.04 if pub else 0.036   # chamfer legs
    brick = BRICK if pub else SOOT
    B.body(gbox("walls", (w, w, hw + 0.003), (c, c, (hw - 0.003) / 2), brick,
                edge=0.13))
    # The four gables, thin walls under the two crossing roofs.
    tri = [(c + w / 2, hw - 0.001), (c, hw + rise), (c - w / 2, hw - 0.001)]
    t_ = 0.012
    B.body(prism_xz("gable", tri, x0, x0 + t_, brick))
    B.body(prism_xz("gable", tri, x1 - t_, x1, brick))
    B.body(extrude_x("gable", tri, x0, x0 + t_, 1, brick))
    B.body(extrude_x("gable", tri, x1 - t_, x1, 1, brick))
    over = 0.0008
    n0 = len(B.parts)
    a = gable_roof(B, c, c, w, w, hw, rise, SLATE, ridge="x", over=over,
                   over_gable=0.0, thick=0.006, ridge_mat=SLATE_D, edge=0.13)
    gable_roof(B, c, c, w, w, hw, rise, SLATE, ridge="y", over=over,
               over_gable=0.0, thick=0.006, ridge_mat=SLATE_D, edge=0.13)
    for o, _ in B.parts[n0:]:
        if o.name.startswith("roof"):
            o.modifiers.clear()
            B.bodies.append(o)
    # Chamfer the corner, walls and roof together.
    e = 0.05
    tri = [(x0 + ch + e, x0 - e), (x0 - e, x0 + ch + e), (x0 - e, x0 - e)]
    B.cut(plan_prism("chamfer", tri, -0.05, 0.6))
    B.carve()
    ca, sa = math.cos(a), math.sin(a)
    ge = hw - over * sa - 0.002
    gutter_x(B, x0 + ch, x1, x0 - over * ca - 0.0022, ge)
    gutter_y(B, x0 + ch, x1, x0 - over * ca - 0.0022, ge)
    fr = Wall((c, x0, 0), (0, -1, 0))     # u = x - c
    sd = Wall((x0, c, 0), (-1, 0, 0))     # u = c - y
    cm = Wall((x0 + ch / 2, x0 + ch / 2, 0), (-1, -1, 0))
    fl = ch * math.sqrt(2)
    ua = x0 + ch - c                      # fr's u at the chamfer
    ub = c - (x0 + ch)                    # sd's u at the chamfer
    ue = x1 - c                           # |u| at the party walls
    span = x1 - (x0 + ch)
    # Ground floor facing: glazed tiles (pub) or a painted shopfront.
    gtop = 0.1
    face = "paint:glazed" if pub else "paint:fascia"
    t = 0.003
    B.body(fr.put(box("tile", (span - 0.001, t, gtop + 0.002),
                      ((ua + ue) / 2 - 0.0005, -t / 2, gtop / 2 - 0.001),
                      face)))
    B.body(sd.put(box("tile", (span - 0.001, t, gtop + 0.002),
                      ((ub - ue) / 2 + 0.0005, -t / 2, gtop / 2 - 0.001),
                      face)))
    for k in (-1, 1):
        B.add(cm.put(box("tile", (0.009, t, gtop + 0.002),
                         (k * (fl / 2 - 0.0045), -t / 2, gtop / 2 - 0.001),
                         face)))
    # Fascia over the ground floor on both streets and the corner.
    fz, fh = gtop + 0.001, 0.016
    fasc = "paint:fascia-maroon" if pub else "paint:fascia"
    strip(B, fr, ua, ue - 0.002, fz, fh, 0.006, fasc, "fascia")
    strip(B, sd, -ue + 0.002, ub, fz, fh, 0.006, fasc, "fascia")
    strip(B, cm, -fl / 2 - 0.004, fl / 2 + 0.004, fz, fh, 0.006, fasc,
          "fascia")
    strip(B, fr, ua + 0.012, ue - 0.02, fz + 0.005, 0.006, 0.0068, GILT,
          "letters")
    strip(B, sd, -ue + 0.02, ub - 0.012, fz + 0.005, 0.006, 0.0068, GILT,
          "letters")
    for wall, u0, u1 in ((fr, ua - 0.004, ue - 0.002),
                         (sd, -ue + 0.002, ub + 0.004),
                         (cm, -fl / 2 - 0.006, fl / 2 + 0.006)):
        strip(B, wall, u0, u1, fz + fh, 0.004, 0.009, fasc, "cornice")
    # The corner door.
    door(B, cm, 0.0, 0.032, 0.09, MAROON if pub else GREEN, FRAME,
         fanlight=True, step=STEP, recess=0.008, fb=0.0025)
    sash(B, cm, 0.0, 0.142, 0.03, 0.058, lintel=SAND)
    # Windows along both streets, a gable window, coped gables.
    n_up = 3 if pub else 2
    for wall, u0, sgn, corner_k in ((fr, ua, 1, -1), (sd, ub, -1, 1)):
        for i in range(2):
            u = u0 + sgn * span * (i + 0.5) / 2
            if pub:
                window(B, wall, u, 0.022, 0.062, 0.064, "paint:fascia",
                       arch="segment", bars="transom", fb=0.003, sill=None,
                       recess=0.006)
            else:
                window(B, wall, u, 0.022, 0.07, 0.068, "paint:fascia",
                       bars="vertical", fb=0.003, sill=None, recess=0.006)
        for i in range(n_up):
            u = u0 + sgn * span * (i + 0.5) / n_up
            sash(B, wall, u, 0.142, 0.038, 0.058, lintel=SAND)
        window(B, wall, 0.0, hw + 0.012, 0.024, 0.032, FRAME, arch="round",
               bars=None, fb=0.003)
        top = wall.at(0.0, -0.002, hw + rise + 0.004)
        for k in (-1, 1):
            if k == corner_k:
                s_ = w / 2 - ch            # the gable meets the chamfer
                ue_ = k * s_
                ze = hw + rise * (1 - s_ / (w / 2))
            else:
                ue_ = k * (w / 2 - 0.002)
                ze = hw
            pa = wall.at(ue_, -0.002, ze - 0.004)
            B.add(beam("cope", pa, top, (0.01, 0.006), SAND,
                       up=Vector((0, 0, 1))))
            B.add(wall.put(box("kneeler", (0.012, 0.012, 0.012),
                               (ue_ - k * 0.004, 0.0, ze - 0.002), SAND)))
    if pub:
        # A sign hanging off the corner and lanterns either side.
        p = Vector((x0 + ch / 2, x0 + ch / 2, 0.218))
        q = p + Vector((-0.025, -0.025, 0))
        B.add(beam("sbracket", p, q, (0.0016, 0.002), BLACK,
                   up=Vector((0, 0, 1))))
        sc = p + Vector((-0.0163, -0.0163, -0.018))
        for nm, sz, m in (("sign", (0.026, 0.0024, 0.03), "paint:sign"),
                          ("signframe", (0.029, 0.0016, 0.033), GILT)):
            sg = box(nm, sz, (0, 0, 0), m)
            tf(sg, T(*sc) @ rot("Z", 45))
            B.add(sg)
        wall_lamp(B, fr, ua + 0.011, 0.097, reach=0.011)
        wall_lamp(B, sd, ub - 0.011, 0.097, reach=0.011)
    else:
        for wall, um in ((fr, ua + span / 2), (sd, ub - span / 2)):
            awning(B, wall, um, 0.098, span - 0.012, 0.0155, 0.01,
                   ["paint:awning-green", "paint:awning-cream"], n=5,
                   flap=0.005)
        strip(B, fr, ua, ue, -0.002, 0.008, 0.0035, SOOTSTONE, "plinth")
        strip(B, sd, -ue, ub, -0.002, 0.008, 0.0035, SOOTSTONE, "plinth")
    # Half stacks on both party walls, where a terrace neighbour's halves
    # stand (its stack line, measured from the shared building line).
    ys = -half + 0.13 + STACK_Y
    z0, z1 = hw + rise - 0.03, hw + rise + 0.05
    half_stack(B, x1, 1, ys, z0, z1, hw=0.02, mat=brick, pots=2)
    half_stack(B, x1, 1, ys, z0, z1, hw=0.02, mat=brick, pots=2, axis="y")
    downpipe(B, x1 - 0.004, x0 - 0.0025, hw - 0.004)
    downpipe(B, x0 - 0.0025, x1 - 0.004, hw - 0.004)
    B.finish(r)
    return r

@asset
def corner_pub(name):
    """A corner pub: green glazed tiles and big segmental windows on the
    ground floor, a fascia for its name, the door on the chamfered corner
    under a hanging sign, lanterns either side."""
    return corner_building(name, 0.26, 0.24, 0.075, "pub")


@asset
def corner_shop(name):
    """A corner shop: display windows under a fascia and green awnings on
    both streets, the door on the chamfered corner."""
    return corner_building(name, 0.24, 0.235, 0.075, "shop")


# ---------------------------------------------------------------- civic

@asset
def town_hall(name):
    """A sandstone town hall: two tall storeys, a giant-order portico on a
    podium up a flight of steps, a balustraded parapet, a hipped slate
    roof and a clock tower with a lead dome."""
    r = root(name)
    B = Build(name)
    w = 0.48
    yf, yb = -0.12, 0.17
    d = yb - yf
    cy = (yf + yb) / 2
    hw = 0.33
    stone = SAND
    B.body(K.body("walls", w, d, hw, 0, centre=(0, cy), mat=stone,
                  bevel=0.0, edge=0.16))
    # A darker rusticated ground storey, a plinth and a string course.
    B.body(gbox("ground", (w + 0.003, d + 0.003, 0.16), (0, cy, 0.077),
                SOOTSTONE, edge=0.16))
    band_course(B, 0, cy, w, d, 0.006, 0.016, SOOTSTONE, out=0.004)
    band_course(B, 0, cy, w, d, 0.158, 0.008, stone, out=0.004)
    # Cornice and parapet.
    band_course(B, 0, cy, w, d, hw - 0.006, 0.012, stone, out=0.007)
    band_course(B, 0, cy, w - 0.004, d - 0.004, hw + 0.012, 0.024, stone,
                out=0.0)
    band_course(B, 0, cy, w, d, hw + 0.026, 0.004, stone, out=0.003)
    hip_roof(B, 0, cy, w - 0.03, d - 0.03, hw + 0.012, 0.06, SLATE,
             over=0.0, thick=0.005, ridge_mat=SLATE_D)
    f = front(0, yf)
    # Windows: arched below, pedimented above, five bays each side.
    for u in (-0.21, -0.155, -0.1, 0.1, 0.155, 0.21):
        window(B, f, u, 0.04, 0.034, 0.09, FRAME, arch="round", bars="sash",
               sill=SAND, fb=0.003)
        window(B, f, u, 0.185, 0.034, 0.1, FRAME, bars="sash", sill=SAND,
               fb=0.003)
        B.add(f.put(box("cap", (0.046, 0.007, 0.006), (u, -0.003, 0.293),
                        stone)))
    for side in ("left", "right"):
        sw = walls(0, cy, w, d)[side]
        for u in (-0.09, 0.0, 0.09):
            plain_window(B, sw, u, 0.045, 0.034, 0.085, arch="round")
            plain_window(B, sw, u, 0.19, 0.034, 0.095)
    bk = walls(0, cy, w, d)["back"]
    for u in (-0.15, 0.0, 0.15):
        plain_window(B, bk, u, 0.19, 0.034, 0.095)
    # Portico: podium, steps, four columns, entablature and pediment.
    py0 = -0.168
    B.add(gbox("podium", (0.21, yf - py0 + 0.004, 0.034),
               (0, (py0 + yf) / 2 + 0.002, 0.015), SOOTSTONE, edge=0.1))
    steps(B, 0, -0.19, 0.17, 3, 0.011, 0.0075, STEP, y_back=py0 + 0.002)
    for x in (-0.075, -0.025, 0.025, 0.075):
        column(B, x, -0.152, 0.032, 0.268, 0.0085)
    B.add(box("entab", (0.2, 0.05, 0.026), (0, -0.143, 0.281), stone))
    B.add(box("entab2", (0.208, 0.054, 0.006), (0, -0.143, 0.297), stone))
    pediment(B, 0, -0.119, 0.3, 0.208, 0.05, 0.05, stone, cornice=stone)
    door(B, front(0, yf, 0.032), 0.0, 0.05, 0.11, MAROON, FRAME,
         arch="round", fanlight=True, step=None, double=True, fb=0.004,
         knob=None, panels=False)
    for u in (-0.05, 0.05):
        window(B, f, u, 0.185, 0.03, 0.09, FRAME, bars="sash", sill=SAND,
               fb=0.003)
    # Clock tower rising behind the portico.
    tx, ty, ts = 0.0, 0.0, 0.1
    tz0, tz1 = hw - 0.02, 0.56
    B.body(gbox("tower", (ts, ts, tz1 - tz0), (tx, ty, (tz0 + tz1) / 2),
                stone, edge=0.1))
    band_course(B, tx, ty, ts, ts, 0.43, 0.006, stone, out=0.004)
    band_course(B, tx, ty, ts, ts, tz1 - 0.006, 0.012, stone, out=0.006)
    tw = walls(tx, ty, ts, ts)
    for side in ("front", "left", "right"):
        clock(B, tw[side], 0.0, 0.5, 0.026, rim=GILT, hands=BLACK, seg=12,
              ticks=False)
    for side in ("front", "left", "right", "back"):
        window(B, tw[side], 0.0, 0.38, 0.028, 0.04, FRAME, arch="round",
               bars=None, fb=0.003)
    # Belfry: four corner piers, arched louvres, a lead dome, a finial.
    bz0, bz1 = tz1, 0.62
    bs = 0.082
    B.body(gbox("belfry", (bs, bs, bz1 - bz0), (tx, ty, (bz0 + bz1) / 2),
                stone, edge=0.1))
    bw = walls(tx, ty, bs, bs)
    for side in ("front", "left", "right", "back"):
        window(B, bw[side], 0.0, bz0 + 0.008, 0.034, 0.048, stone,
               arch="round", bars=None, fb=0.004, glass="paint:louvre")
    band_course(B, tx, ty, bs, bs, bz1, 0.008, stone, out=0.006)
    B.add(lathe("dome", [(0.05, bz1 + 0.004), (0.047, bz1 + 0.022),
                         (0.036, bz1 + 0.05), (0.02, bz1 + 0.066),
                         (0.006, bz1 + 0.074), (0.0, bz1 + 0.076)],
                (tx, ty, 0), 12, LEAD))
    B.add(lathe("finial", [(0.004, bz1 + 0.074), (0.006, bz1 + 0.084),
                           (0.0015, bz1 + 0.092), (0.001, 0.72),
                           (0.0, 0.72)], (tx, ty, 0), 6, GILT))
    # Lamps on the podium.
    for k in (-1, 1):
        B.add(cyl("lpost", 0.002, 0.002, 0.04, (k * 0.1, -0.162, 0.032), 6,
                  BLACK, rings=1))
        lantern(B, k * 0.1, -0.162, 0.072, 0.012)
    B.finish(r)
    return r


@asset
def market_hall(name):
    """A market hall: a brick front with a big arched entrance, stone
    dressings and a pedimented gable; behind it a long hall of brick
    walls under slate and a raised glass-and-iron lantern."""
    r = root(name)
    B = Build(name)
    w = 0.484
    # Front screen block.
    sy0, sy1 = -0.162, -0.107
    sh, sr = 0.24, 0.07
    B.body(K.body("screen", w, sy1 - sy0, sh, sr, "y",
                  centre=(0, (sy0 + sy1) / 2), mat=BRICK, bevel=0.0,
                  edge=0.09))
    f = front(0, sy0)
    # Stone pediment cornice and coping.
    a = math.atan2(sr, w / 2)
    for k in (-1, 1):
        pa = Vector((k * (w / 2 + 0.004), (sy0 + sy1) / 2, sh - 0.004))
        pb = Vector((0, (sy0 + sy1) / 2, sh + sr + 0.006))
        B.add(beam("rake", pa, pb, (sy1 - sy0 + 0.008, 0.007), SAND,
                   up=Vector((0, 0, 1))))
    B.add(box("cornice", (w + 0.008, sy1 - sy0 + 0.008, 0.008),
              (0, (sy0 + sy1) / 2, sh - 0.002), SAND))
    band_course(B, 0, (sy0 + sy1) / 2, w, sy1 - sy0, 0.006, 0.016, SAND,
                out=0.003)
    band_course(B, 0, (sy0 + sy1) / 2, w, sy1 - sy0, 0.17, 0.006, SAND,
                out=0.003)
    for k in (-1, 1):
        B.add(f.put(box("pier", (0.03, 0.008, sh - 0.004),
                        (k * (w / 2 - 0.015), -0.003, sh / 2), SAND)))
        B.add(ball("urn", 0.008, (k * (w / 2 - 0.006), (sy0 + sy1) / 2,
                                  sh + 0.012), SAND, seg=8, rings=4))
    B.add(ball("urn", 0.011, (0, (sy0 + sy1) / 2, sh + sr + 0.019), SAND,
               seg=8, rings=4))
    # The great arch with iron gates, two side arches, a round window.
    door(B, f, 0.0, 0.11, 0.16, "paint:lamp-green", SAND, arch="round",
         fanlight=True, step=None, double=True, panels=False, fb=0.008,
         knob=None, recess=0.012)
    for u in (-0.15, 0.15):
        window(B, f, u, 0.03, 0.06, 0.12, SAND, arch="round", bars="sash",
               sill=SAND, fb=0.006, keystone=SAND)
    window(B, f, 0.0, sh + 0.006, 0.036, 0.036, SAND, arch="round",
           bars="cross", fb=0.005)
    clock(B, f, 0.0, 0.2, 0.017, rim=SAND, hands=BLACK, seg=12, ticks=False)
    # The hall behind.
    hy0, hy1 = sy1 - 0.004, 0.163
    hw = 0.14
    hl = hy1 - hy0
    hc = (hy0 + hy1) / 2
    hwid = 0.47
    B.body(K.body("hall", hwid, hl, hw, 0, centre=(0, hc), mat=SOOT,
                  bevel=0.0, edge=0.09))
    band_course(B, 0, hc, hwid, hl, hw - 0.005, 0.01, SAND, out=0.004)
    for side in ("left", "right"):
        sw = walls(0, hc, hwid, hl)[side]
        for u in (-0.09, -0.03, 0.03, 0.09):
            plain_window(B, sw, u, 0.04, 0.036, 0.08, arch="round")
    bk = walls(0, hc, hwid, hl)["back"]
    for u in (-0.15, 0.15):
        plain_window(B, bk, u, 0.04, 0.04, 0.08, arch="round")
    door(B, bk, 0.0, 0.07, 0.1, "paint:lamp-green", SAND, arch="segment",
         step=None, double=True, panels=False, knob=None)
    # Roof: slate lower slopes, a glazed lantern on iron.
    sl = 0.16
    pts = [(-hwid / 2 - 0.006, hw - 0.004), (-sl / 2, 0.215), (0.0, 0.215)]
    # Gable infills at both ends of the hall.
    for y0, y1 in ((hy0, hy0 + 0.006), (hy1 - 0.006, hy1)):
        B.add(prism_xz("gend", [(hwid / 2, hw - 0.002), (sl / 2, 0.213),
                                (-sl / 2, 0.213), (-hwid / 2, hw - 0.002)],
                       y0, y1, SOOT))
        B.add(prism_xz("lend", [(sl / 2, 0.232), (0.0, 0.298),
                                (-sl / 2, 0.232)], y0 + 0.002, y1 - 0.002,
                       "glass:dark"))
    K.profile_roof(B, 0, hc, hl, pts, SLATE, ridge="y", over_gable=0.0,
                   thick=0.005, edge=0.09, gutter=GUTTER)
    lz0, lz1 = 0.21, 0.232
    B.add(gbox("clere", (sl, hl, lz1 - lz0), (0, hc, (lz0 + lz1) / 2),
               "glass:dark", edge=0.1))
    for i in range(7):
        y = hy0 + 0.006 + (hl - 0.012) * i / 6
        for k in (-1, 1):
            B.add(box("mullion", (0.003, 0.003, lz1 - lz0 + 0.002),
                      (k * (sl / 2 + 0.001), y, (lz0 + lz1) / 2), IRON))
    B.add(box("plate", (sl + 0.006, hl, 0.004), (0, hc, lz1 + 0.001), IRON))
    lr = [(-sl / 2 - 0.006, lz1 + 0.002), (0.0, 0.3)]
    K.profile_roof(B, 0, hc, hl, lr, "glass:dark", ridge="y",
                   over_gable=0.0, thick=0.003, edge=0.1, ridge_mat=IRON)
    for i in range(9):
        y = hy0 + 0.004 + (hl - 0.008) * i / 8
        for k in (-1, 1):
            pa = Vector((k * (sl / 2 + 0.006), y, lz1 + 0.006))
            pb = Vector((0, y, 0.3 + 0.004))
            B.add(beam("rib", pa, pb, (0.0028, 0.003), IRON,
                       up=Vector((0, 0, 1))))
    B.finish(r)
    return r


@asset
def chapel(name):
    """A Nonconformist chapel: a sandstone front with its gable to the
    street as a pediment, two tiers of round-arched windows, a columned
    porch up steps, brick sides."""
    r = root(name)
    B = Build(name)
    w = 0.28
    yf, yb = -0.168, 0.19
    d = yb - yf
    cy = (yf + yb) / 2
    hw, rise = 0.27, 0.09
    B.body(K.body("walls", w, d, hw, rise, "y", centre=(0, cy), mat=BRICK,
                  bevel=0.0, edge=0.15))
    B.body(K.body("front", w, 0.01, hw, rise, "y", centre=(0, yf + 0.004),
                  mat=SAND, bevel=0.0, edge=0.15, z0=-0.003))
    fy = yf - 0.001
    f = front(0, fy)
    gable_roof(B, 0, cy + 0.004, w, d - 0.008, hw, rise, SLATE, ridge="y",
               over=0.006, over_gable=0.0, thick=0.006, ridge_mat=SLATE_D,
               gutter=GUTTER, edge=0.09)
    # Pediment: a full cornice across at the eaves, raking cornices.
    a = math.atan2(rise, w / 2)
    for k in (-1, 1):
        pa = Vector((k * (w / 2 + 0.008), fy - 0.004, hw + 0.004))
        pb = Vector((0, fy - 0.004, hw + rise + 0.012))
        B.add(beam("rake", pa, pb, (0.02, 0.008), SAND,
                   up=Vector((0, 0, 1))))
    B.add(box("cornice", (w + 0.016, 0.02, 0.01), (0, fy + 0.006, hw), SAND))
    B.add(box("frieze", (w, 0.006, 0.02), (0, fy - 0.002, hw - 0.015),
              SAND))
    # Corner pilasters and the plinth.
    for k in (-1, 1):
        B.add(f.put(box("pilaster", (0.02, 0.008, hw - 0.02),
                        (k * (w / 2 - 0.01), -0.003, (hw - 0.02) / 2), SAND)))
    band_course(B, 0, cy, w, d, 0.008, 0.02, SOOTSTONE, out=0.003)
    band_course(B, 0, fy + 0.006, w, 0.012, 0.135, 0.006, SAND, out=0.004)
    # Date tablet in the pediment.
    B.add(f.put(cyl("tablet", 0.022, 0.022, 0.003, (0, -0.0015, hw + 0.035),
                    12, "stone:sootstone", axis="y")))
    # Windows: two arched below beside the porch, three above.
    for u in (-0.085, 0.085):
        window(B, f, u, 0.035, 0.04, 0.085, FRAME, arch="round", bars="sash",
               sill=SAND, fb=0.004, keystone=SAND)
    for u in (-0.085, 0.0, 0.085):
        window(B, f, u, 0.155, 0.04, 0.09, FRAME, arch="round", bars="sash",
               sill=SAND, fb=0.004, keystone=SAND)
    # Porch: two columns, an entablature and a small pediment.
    door(B, f, 0.0, 0.044, 0.1, GREEN, FRAME, arch="round", fanlight=True,
         step=None, double=True, fb=0.004)
    for k in (-1, 1):
        column(B, k * 0.034, fy - 0.022, 0.022, 0.112, 0.0055)
    B.add(box("pent", (0.09, 0.03, 0.012), (0, fy - 0.014, 0.118), SAND))
    pediment(B, 0, fy - 0.001, 0.124, 0.09, 0.022, 0.029, SAND)
    steps(B, 0, -0.2, 0.11, 3, 0.0073, 0.0075, STEP, y_back=fy + 0.002)
    # Side windows in two tiers, and a back with two windows.
    for side in ("left", "right"):
        sw = walls(0, cy, w, d)[side]
        for u in (-0.11, 0.0, 0.11):
            plain_window(B, sw, u, 0.04, 0.04, 0.075, arch="round")
            plain_window(B, sw, u, 0.16, 0.04, 0.08, arch="round")
    bk = walls(0, cy, w, d)["back"]
    for u in (-0.07, 0.07):
        plain_window(B, bk, u, 0.12, 0.04, 0.1, arch="round")
    # Finials.
    for x, z in ((-w / 2 - 0.002, hw + 0.012), (w / 2 + 0.002, hw + 0.012),
                 (0.0, hw + rise + 0.016)):
        B.add(lathe("finial", [(0.0, z), (0.0065, z + 0.004),
                               (0.004, z + 0.012), (0.0055, z + 0.016),
                               (0.0, 0.4 if x == 0 else z + 0.024)],
                    (min(max(x, -0.14), 0.14) * (0.96 if x else 1),
                     fy + 0.002, 0), 8, SAND))
    B.finish(r)
    return r


@asset
def bank(name):
    """A classical sandstone bank: a rusticated ground floor, two columns
    in the entrance, tall pedimented windows, a cornice, a balustraded
    parapet and a pediment over the centre."""
    r = root(name)
    B = Build(name)
    w = 0.24
    yf, yb = -0.11, 0.118
    d = yb - yf
    cy = (yf + yb) / 2
    hw = 0.26
    B.body(K.body("walls", w, d, hw, 0, centre=(0, cy), mat=SAND, bevel=0.0,
                  edge=0.16))
    f = front(0, yf)
    # A darker rusticated ground storey, plinth and string course.
    B.body(gbox("ground", (w + 0.003, d + 0.003, 0.124), (0, cy, 0.06),
                SOOTSTONE, edge=0.16))
    course(B, 0, cy, w, d, 0.006, 0.016, SOOTSTONE, out=0.004)
    band_course(B, 0, cy, w, d, 0.122, 0.01, SAND, out=0.005)
    # Quoins up the corners.
    for k in (-1, 1):
        for i in range(5):
            z = 0.14 + i * 0.022
            ww = 0.02 if i % 2 else 0.013
            B.add(f.put(box("quoin", (ww, 0.003, 0.016),
                            (k * (w / 2 - ww / 2), -0.0012, z + 0.008),
                            SOOTSTONE)))
    # Cornice, parapet with balusters, central pediment.
    band_course(B, 0, cy, w, d, hw - 0.006, 0.012, SAND, out=0.008)
    parapet(B, 0, cy, w - 0.004, d - 0.004, hw, 0.022, SAND)
    parapet(B, 0, cy, w + 0.006, d + 0.006, hw + 0.022, 0.005, SAND,
            t=0.012)
    for i in range(10):
        x = -0.1 + 0.2 * i / 9
        if abs(x) < 0.05:
            continue
        B.add(box("baluster", (0.006, 0.003, 0.014), (x, yf - 0.002,
                                                      hw + 0.01), SOOTSTONE))
    pediment(B, 0, yf + 0.004, hw + 0.025, 0.11, 0.03, 0.014, SAND,
             cornice=SAND)
    B.add(box("ptym", (0.11, 0.01, 0.02), (0, yf + 0.0, hw + 0.012), SAND))
    B.add(gbox("flat", (w - 0.01, d - 0.01, 0.004), (0, cy, hw + 0.002),
               "slate:slate-dark", edge=0.1))
    B.add(box("skylight", (0.06, 0.05, 0.02), (0, cy + 0.03, hw + 0.01),
              GLASS))
    # Entrance in antis: a recess, two columns, steps.
    B.cut(prism_xz("recess", [(0.04, -0.002), (0.04, 0.118), (-0.04, 0.118),
                              (-0.04, -0.002)], yf - 0.02, yf + 0.02))
    door(B, Wall((0, yf + 0.02, 0), (0, -1, 0)), 0.0, 0.04, 0.09, NAVY,
         FRAME, arch="round", fanlight=True, step=None, double=True,
         fb=0.003)
    for k in (-1, 1):
        column(B, k * 0.022, yf - 0.002 + 0.012, 0.012, 0.118, 0.0055)
    steps(B, 0, -0.13, 0.1, 2, 0.006, 0.008, STEP, y_back=yf + 0.02)
    # Ground windows (arched) and tall pedimented windows above.
    for u in (-0.08, 0.08):
        window(B, f, u, 0.03, 0.036, 0.075, FRAME, arch="round", bars="sash",
               sill=SAND, fb=0.003, keystone=SAND)
    for u in (-0.08, 0.0, 0.08):
        window(B, f, u, 0.15, 0.036, 0.08, FRAME, bars="sash", sill=SAND,
               fb=0.003)
        pediment(B, u, yf, 0.236, 0.05, 0.012, 0.006, SAND)
    for side in ("left", "right"):
        sw = walls(0, cy, w, d)[side]
        for u in (-0.06, 0.06):
            plain_window(B, sw, u, 0.03, 0.034, 0.072, arch="round")
            plain_window(B, sw, u, 0.15, 0.034, 0.078)
    bk = walls(0, cy, w, d)["back"]
    for u in (-0.06, 0.06):
        plain_window(B, bk, u, 0.15, 0.034, 0.078)
    door(B, bk, 0.0, 0.03, 0.08, BLACKDOOR, FRAME, step=SAND, panels=False,
         knob=None)
    B.finish(r)
    return r


@asset
def school(name):
    """A Board school: a red-brick range with two steep cross gables to
    the front, each lit by three tall windows, two entrance porches, tall
    stacks and a bell cote on the ridge."""
    r = root(name)
    B = Build(name)
    w = 0.44
    yf, yb = -0.1, 0.138
    d = yb - yf
    cy = (yf + yb) / 2
    hw, rise = 0.185, 0.09
    B.body(K.body("walls", w, d, hw, rise, "x", centre=(0, cy), mat=BRICK,
                  bevel=0.0, edge=0.15))
    gable_roof(B, 0, cy, w, d, hw, rise, SLATE, over=0.007,
               over_gable=0.006, thick=0.006, ridge_mat=SLATE_D,
               gutter=None, barge=None, edge=0.15)
    for k in (-1, 1):
        gutter_x(B, -w / 2 - 0.006, w / 2 + 0.006,
                 cy + k * (d / 2 + 0.0078), hw - 0.006)
    band_course(B, 0, cy, w, d, 0.008, 0.018, BLUEB, out=0.003)
    band_course(B, 0, cy, w, d, 0.1, 0.005, SAND, out=0.003)
    # Cross gables.
    gw, gy0 = 0.13, -0.14
    grise = 0.085
    for gx in (-0.14, 0.14):
        gl = (cy + 0.02) - gy0
        gc = gy0 + gl / 2
        B.body(K.body("wing", gw, gl, hw, grise, "y", centre=(gx, gc),
                      mat=BRICK, bevel=0.0, edge=0.15))
        gable_roof(B, gx, gc, gw, gl, hw, grise, SLATE, ridge="y",
                   over=0.006, over_gable=0.006, thick=0.006,
                   ridge_mat=SLATE_D, barge=SAND, edge=0.15)
        gf = Wall((gx, gy0, 0), (0, -1, 0))
        strip(B, gf, -gw / 2, gw / 2, 0.0, 0.016, 0.003, BLUEB, "plinth")
        strip(B, gf, -gw / 2, gw / 2, 0.1, 0.005, 0.003, SAND, "band")
        for u in (-0.032, 0.0, 0.032):
            hh = 0.15 if u == 0 else 0.13
            window(B, gf, u, 0.03, 0.024, hh, FRAME, arch="pointed",
                   bars="grid", sill=SAND, fb=0.003)
        window(B, gf, 0.0, hw + 0.03, 0.02, 0.036, FRAME, arch="round",
               bars=None, fb=0.003)
        for k in (-1, 1):
            B.add(gf.put(box("kneeler", (0.012, 0.012, 0.01),
                             (k * (gw / 2 - 0.004), 0.0, hw - 0.002), SAND)))
        # Finial at the apex.
        B.add(lathe("finial", [(0.0, hw + grise + 0.004), (0.004, hw + grise
                                                           + 0.008),
                               (0.0, hw + grise + 0.03)],
                    (gx, gy0 - 0.004, 0), 6, SAND))
    # Middle range: tall windows and two porches beside the wings.
    f = front(0, yf)
    for u in (-0.03, 0.03):
        window(B, f, u, 0.03, 0.03, 0.13, FRAME, bars="grid", sill=SAND,
               fb=0.003, lintel=SAND)
    for k in (-1, 1):
        px = k * 0.058
        B.body(K.body("porch", 0.036, 0.034, 0.075, 0.025, "y",
                      centre=(px, yf - 0.016), mat=BRICK, bevel=0.0,
                      edge=0.09))
        gable_roof(B, px, yf - 0.017, 0.036, 0.036, 0.075, 0.025, SLATE,
                   ridge="y", over=0.004, over_gable=0.003, thick=0.004,
                   edge=0.09)
        door(B, Wall((px, yf - 0.033, 0), (0, -1, 0)), 0.0, 0.022, 0.062,
             GREEN if k < 0 else MAROON, SAND, arch="pointed", step=STEP,
             fb=0.003, panels=False)
    # Back and ends.
    bk = walls(0, cy, w, d)["back"]
    for u in (-0.16, -0.08, 0.0, 0.08, 0.16):
        plain_window(B, bk, u, 0.03, 0.03, 0.12, bars="grid")
    for side in ("left", "right"):
        sw = walls(0, cy, w, d)[side]
        for u in (-0.04, 0.04):
            plain_window(B, sw, u, 0.03, 0.03, 0.12, bars="grid")
        plain_window(B, sw, 0.0, hw + 0.01, 0.026, 0.05, arch="round")
    # Tall stacks at the ends of the ridge.
    for k in (-1, 1):
        stack(B, k * 0.19, cy + 0.03, hw + 0.05, hw + rise + 0.06, 0.03,
              0.04, BRICK, SAND, pots=2)
    # Bell cote astride the ridge: a stone base, four piers, a bell, a
    # little slate spire.
    rz = hw + rise
    B.add(box("cotebase", (0.03, 0.03, 0.03), (0, cy, rz - 0.006), SAND))
    for kx in (-1, 1):
        for ky in (-1, 1):
            B.add(box("cotepost", (0.005, 0.005, 0.022),
                      (kx * 0.0125, cy + ky * 0.0125, rz + 0.019), SAND))
    B.add(lathe("bell", [(0.0, rz + 0.011), (0.0075, rz + 0.011),
                         (0.0055, rz + 0.018), (0.0035, rz + 0.026),
                         (0.0, rz + 0.028)], (0, cy, 0), 8, "metal:bell"))
    B.add(box("cotetop", (0.034, 0.034, 0.004), (0, cy, rz + 0.032), SAND))
    sp = cyl("spire", 0.025, 0.0008, 0.026, (0, 0, rz + 0.034), 4, SLATE_D)
    tf(sp, T(0, cy, 0) @ rot("Z", 45))
    B.add(sp)
    B.finish(r)
    return r


# ---------------------------------------------------------------- yards

@asset
def yard_wall(name):
    """A back-yard wall: brick with a rounded stone coping, flush ends so
    walls run on along X."""
    r = root(name)
    B = Build(name)
    L, t = 0.2, 0.009
    B.add(gbox("wall", (L, t, 0.042), (0, 0, 0.019), SOOT, edge=0.07))
    B.add(cyl("coping", 0.006, 0.006, L, (0, 0, 0.039), 6, SAND, axis="x"))
    B.finish(r)
    return r


@asset
def privy(name):
    """An outside privy: a brick box, a plank door to -Y, a lean-to slate
    roof falling to the back."""
    r = root(name)
    B = Build(name)
    s = 0.042
    B.body(extrude_x("walls", [(-s / 2, -0.002), (s / 2, -0.002),
                               (s / 2, 0.0435), (-s / 2, 0.0495)],
                     -s / 2, s / 2, 1, SOOT))
    f = front(0, -s / 2)
    door(B, f, 0.0, 0.022, 0.038, GREEN, GREEN, step=None, panels=False,
         fb=0.0, knob=None, recess=0.003)
    B.add(f.put(box("vent", (0.008, 0.001, 0.003), (0, 0.0024, 0.031),
                    BLACK)))
    roof = mesh("roof", [(-0.0225, -0.0225, 0.05), (0.0225, -0.0225, 0.05),
                         (0.0225, 0.0225, 0.042), (-0.0225, 0.0225, 0.042),
                         (-0.0225, -0.0225, 0.055), (0.0225, -0.0225, 0.055),
                         (0.0225, 0.0225, 0.047), (-0.0225, 0.0225, 0.047)],
                [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5],
                 [2, 3, 7, 6], [3, 0, 4, 7]], SLATE)
    B.add(roof)
    B.finish(r)
    return r


@asset
def washing_line(name):
    """A washing line between two posts along X, a prop in the middle,
    sheets and shirts pegged out."""
    r = root(name)
    B = Build(name)
    for k in (-1, 1):
        B.add(box("post", (0.004, 0.004, 0.062), (k * 0.088, 0, 0.029),
                  "wood:post"))
    B.add(beam("line", (-0.088, 0, 0.056), (0.088, 0, 0.056),
               (0.0007, 0.0007), "paint:linen"))
    B.add(beam("prop", (0.012, 0.012, -0.002), (0.01, 0.0, 0.062),
               (0.0018, 0.0018), "wood:cane"))
    hang = [(-0.06, 0.034, 0.03, "paint:linen"),
            (-0.022, 0.018, 0.022, "paint:shirt"),
            (0.035, 0.04, 0.032, "paint:linen"),
            (0.07, 0.014, 0.018, "paint:awning-red")]
    for x, ww, hh, m in hang:
        B.add(box("sheet", (ww, 0.0012, hh), (x, 0, 0.0555 - hh / 2), m))
    B.finish(r)
    return r


@asset
def allotment(name):
    """An allotment plot: soil beds in rows with crops, bean canes, a
    tiny shed, a water butt, grass paths."""
    r = root(name)
    B = Build(name)
    B.add(gbox("ground", (0.4, 0.4, 0.004), (0, 0, 0.0), "grass:allot",
               edge=0.2))
    rows = 6
    for side in (-1, 1):
        for i in range(rows):
            y = -0.17 + i * 0.056
            x = side * 0.095
            B.add(box("bed", (0.165, 0.04, 0.006), (x, y, 0.002),
                      "field:soil"))
            if side > 0 and i in (0, 1):
                continue
            crop = ("foliage:veg", "foliage:veg-light")[i % 2]
            for k in (-1, 1):
                B.add(box("crop", (0.15, 0.009, 0.007 + 0.003 * (i % 2)),
                          (x, y + k * 0.01, 0.008), crop))
    # Bean canes: two rows of leaning canes, leaves on them.
    for j in range(2):
        y = -0.17 + j * 0.056
        for i in range(5):
            x = 0.035 + i * 0.03
            for k in (-1, 1):
                B.add(beam("cane", (x, y + k * 0.012, 0.004),
                           (x, y, 0.052), (0.0012, 0.0012), "wood:cane"))
        B.add(box("beans", (0.13, 0.004, 0.028), (0.095, y, 0.034),
                  "foliage:bean"))
    # Shed, water butt.
    sx, sy = -0.15, 0.165
    B.add(box("shed", (0.06, 0.045, 0.04), (sx, sy, 0.019), "wood:shed"))
    roof = mesh("roof", [(sx - 0.034, sy - 0.026, 0.046),
                         (sx + 0.034, sy - 0.026, 0.046),
                         (sx + 0.034, sy + 0.026, 0.038),
                         (sx - 0.034, sy + 0.026, 0.038),
                         (sx - 0.034, sy - 0.026, 0.049),
                         (sx + 0.034, sy - 0.026, 0.049),
                         (sx + 0.034, sy + 0.026, 0.041),
                         (sx - 0.034, sy + 0.026, 0.041)],
                [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5],
                 [2, 3, 7, 6], [3, 0, 4, 7]], "roof:felt")
    B.add(roof)
    B.add(box("sdoor", (0.018, 0.002, 0.032), (sx + 0.014, sy - 0.0232,
                                               0.017), GREEN))
    B.add(box("swin", (0.014, 0.002, 0.01), (sx - 0.014, sy - 0.0232, 0.026),
              GLASS))
    B.add(cyl("butt", 0.009, 0.009, 0.022, (sx + 0.045, sy - 0.01, -0.001),
              8, "paint:lamp-green"))
    B.finish(r)
    return r


@asset
def bandstand(name):
    """A park bandstand: an octagonal stone base, iron columns with
    railings between, a red ogee roof and a finial."""
    r = root(name)
    B = Build(name)
    rr = 0.074
    B.add(cyl("base", rr + 0.004, rr + 0.004, 0.022, (0, 0, -0.002), 8,
              SOOTSTONE))
    B.add(cyl("basetop", rr + 0.006, rr + 0.006, 0.003, (0, 0, 0.019), 8,
              SAND))
    B.add(box("step", (0.03, 0.01, 0.012), (0, -rr + 0.0, 0.004), STEP))
    ir = "paint:lamp-green"
    for i in range(8):
        a = math.tau * i / 8
        B.add(cyl("post", 0.0018, 0.0018, 0.066, (math.cos(a) * (rr - 0.004),
                                                  math.sin(a) * (rr - 0.004),
                                                  0.022), 6, ir))
    B.add(K.ring("rail", rr - 0.004, 0.001, 0.038, (0, 0), 8, ir))
    B.add(K.ring("frieze", rr - 0.003, 0.002, 0.088, (0, 0), 8, ir,
                 h=0.008))
    B.add(lathe("roof", [(0.0, 0.09), (rr + 0.006, 0.09),
                         (rr + 0.006, 0.093), (rr - 0.01, 0.1),
                         (0.04, 0.108), (0.016, 0.118), (0.004, 0.124),
                         (0.0, 0.124)], (0, 0, 0), 8, "roof:bandred"))
    B.add(lathe("finial", [(0.0, 0.123), (0.003, 0.124), (0.0015, 0.129),
                           (0.0, 0.13)], (0, 0, 0), 6, GILT))
    B.finish(r)
    return r


@asset
def bench(name):
    """A park bench, its seat facing -Y."""
    r = root(name)
    B = Build(name)
    kit_bench(B, 0, -0.0008, 0.0, wood="wood:plank", iron=IRON, L=0.04)
    B.finish(r)
    return r


@asset
def gas_lamp(name):
    """A cast-iron gas lamp: a fluted column on a base, a ladder bar and a
    tapering glass lantern glowing warm."""
    r = root(name)
    B = Build(name)
    m = "paint:lamp-green"
    B.add(lathe("base", [(0.006, -0.002), (0.006, 0.006), (0.0045, 0.012),
                         (0.003, 0.016), (0.0, 0.016)], (0, 0, 0), 8, m))
    B.add(cyl("column", 0.0024, 0.0017, 0.098, (0, 0, 0.014), 8, m))
    B.add(cyl("collar", 0.0028, 0.0028, 0.004, (0, 0, 0.098), 8, m))
    B.add(box("ladder", (0.0118, 0.0016, 0.0016), (0, 0, 0.1), m))
    B.add(lathe("cradle", [(0.0017, 0.108), (0.004, 0.112), (0.0, 0.112)],
                (0, 0, 0), 6, m))
    g = cyl("lantern", 0.0046, 0.0068, 0.016, (0, 0, 0.112), 4, LAMP)
    tf(g, rot("Z", 45))
    B.add(g)
    cap = cyl("lcap", 0.0076, 0.001, 0.008, (0, 0, 0.128), 4, m)
    tf(cap, rot("Z", 45))
    B.add(cap)
    B.add(lathe("finial", [(0.0, 0.1355), (0.0012, 0.136), (0.0008, 0.14),
                           (0.0, 0.14)], (0, 0, 0), 6, m))
    for k in (-1, 1):
        for j in (-1, 1):
            B.add(box("astr", (0.0008, 0.0008, 0.016),
                      (k * 0.0049, j * 0.0049, 0.12), m))
    B.finish(r)
    return r


# ---------------------------------------------------------------- run

def tris(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bounds(r):
    kit.refresh()
    pts = []
    for o in kit.descendants(r):
        if o.type == "MESH":
            pts += [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts),
                 min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts),
                 max(p.z for p in pts)))
    return lo, hi


def report(roots):
    kit.refresh()
    total = 0
    for r in roots:
        n = sum(tris(o) for o in kit.descendants(r) if o.type == "MESH")
        total += n
        lo, hi = bounds(r)
        size = hi - lo
        warn = []
        fw, fd, fh = FOOT.get(r.name, (9, 9, 9))
        tol = 0.0041 if r.name in TERRACES + CORNERS else 0.001
        tly = 0.0041 if r.name in CORNERS else 0.001
        if size.x > fw + tol or lo.x < -fw / 2 - tol or hi.x > fw / 2 + tol:
            warn.append("X")
        if lo.y < -fd / 2 - tly or hi.y > fd / 2 + tly:
            warn.append("Y")
        if hi.z > fh + (0.07 if r.name in STACKED else 0.006):
            warn.append("Z")
        if n > BUDGET.get(r.name, 1200):
            warn.append("TRIS")
        print("ROOT %-14s size %.3f x %.3f x %.3f  x %.4f..%.4f "
              "y %.4f..%.4f z %.4f..%.4f  tris %5d %s" % (
                  r.name, size.x, size.y, size.z, lo.x, hi.x, lo.y, hi.y,
                  lo.z, hi.z, n, ("WARN " + ",".join(warn)) if warn else ""))
    print("TOTAL TRIS", total)
    allm = sorted({m.name for m in bpy.data.materials if ":" in m.name})
    print("MATERIALS", ", ".join(allm))


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
    bg.inputs[0].default_value = (0.55, 0.62, 0.74, 1)
    bg.inputs[1].default_value = 0.5
    sun = bpy.data.lights.new("rsun", "SUN")
    sun.energy = 4.0
    sun.angle = math.radians(3)
    sun.color = (1.0, 0.84, 0.64)
    s = bpy.data.objects.new("rsun", sun)
    s.rotation_euler = Vector((-0.55, -0.75, 0.55)).to_track_quat(
        "Z", "Y").to_euler()
    scene.collection.objects.link(s)
    kit.tint("__ground", "#8b8576")
    kit.tint("__square", "#a59f8f")
    kit.tint("__edge", "#e9e2cc")
    kit.tint("__car", "#c0392b")
    floor = kit.box("__floor", (80, 80, 0.02), (0, 0, -0.0115),
                    mat="plain:__ground", grid=False)
    kit.fill_ao([floor])
    return [s, floor]


def ref_square(at):
    sq = kit.box("__sq", (1.0, 1.0, 0.002), (at.x, at.y, -0.0005),
                 mat="plain:__square", grid=False)
    edges = []
    for k in (-1, 1):
        edges.append(kit.box("__e", (1.0, 0.006, 0.0025),
                             (at.x, at.y + k * 0.497, -0.0003),
                             mat="plain:__edge", grid=False))
        edges.append(kit.box("__e", (0.006, 1.0, 0.0025),
                             (at.x + k * 0.497, at.y, -0.0003),
                             mat="plain:__edge", grid=False))
    kit.fill_ao([sq] + edges)
    return [sq] + edges


def car_box(x, y):
    c = kit.box("__carbox", (0.16, 0.07, 0.06), (x, y, 0.03),
                mat="plain:__car", grid=False)
    kit.fill_ao([c])
    return c


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


def instance(r, loc, rotz=0.0):
    """A linked copy of an asset (shares its mesh data) for row previews."""
    e = bpy.data.objects.new(r.name + "-copy", None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.rotation_euler = (0, 0, math.radians(rotz))
    for k in r.children:
        if k.type == "MESH":
            c = bpy.data.objects.new(k.name + "-copy", k.data)
            bpy.context.scene.collection.objects.link(c)
            c.parent = e
            c.matrix_parent_inverse = k.matrix_parent_inverse.copy()
            c.location = k.location
    return e


def hide_all(objs, hidden):
    for o in objs:
        for d_ in kit.descendants(o):
            d_.hide_render = hidden


def render_rows(base, by_name):
    """A terrace of five alternating modules, and a mixed street."""
    made = []
    row = ["terrace_a", "terrace_b", "terrace_a", "terrace_b", "terrace_a"]
    if all(n in by_name for n in row):
        origin = Vector((0, -6.0, 0))
        for i, n in enumerate(row):
            made.append(instance(by_name[n], origin + Vector(((i - 2) * 0.2,
                                                              0, 0))))
        car = car_box(origin.x + 0.15, origin.y - 0.2)
        made.append(car)
        kit.refresh()
        c = origin + Vector((0, 0, 0.12))
        shot("%s-row-terrace-a0.png" % base, c, 0.42, 55, 0, size=700,
             width=1100, samples=16)
        shot("%s-row-terrace-a30.png" % base, c, 0.42, 55, 30, size=700,
             width=1100, samples=16)
        shot("%s-row-terrace-seam.png" % base,
             origin + Vector((0.1, 0.0, 0.25)), 0.12, 35, 20, size=700,
             samples=16)
    street = ["corner_pub", "terrace_a", "terrace_b", "shop", "terrace_tall",
              "cottage", "terrace_a", "lockup", "terrace_b"]
    if all(n in by_name for n in street):
        origin = Vector((0, -9.0, 0))
        widths = [FOOT[n][0] for n in street]
        x = -sum(widths) / 2
        for n, wd in zip(street, widths):
            dep = FOOT[n][1]
            made.append(instance(by_name[n], origin + Vector(
                (x + wd / 2, -0.13 + dep / 2, 0))))
            x += wd
        # The side street off the corner: two terraces turned to face -X.
        x0 = -sum(widths) / 2
        for j, n in enumerate(["terrace_b", "terrace_a"]):
            made.append(instance(by_name[n], origin + Vector(
                (x0 + 0.13, 0.13 + 0.1 + j * 0.2, 0)), rotz=-90))
        made.append(car_box(origin.x - 0.3, origin.y - 0.21))
        kit.refresh()
        c = origin + Vector((0, 0.1, 0.12))
        shot("%s-row-street-a0.png" % base, c, 0.62, 55, 0, size=700,
             width=1400, samples=16)
        shot("%s-row-street-a30.png" % base, c, 0.62, 55, 30, size=700,
             width=1400, samples=16)
    for o in made:
        for d_ in kit.descendants(o):
            bpy.data.objects.remove(d_, do_unlink=True)


def render_previews(path, roots):
    base = os.path.splitext(path)[0]
    K.preview_look()
    stage()
    # Line-up.
    x, y, row_h = 0.0, 0.0, 0.0
    for r in roots:
        lo, hi = bounds(r)
        wdt = hi.x - lo.x
        if x + wdt > 2.2 and x > 0:
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
    if not os.environ.get("ROTA_NOLINEUP"):
        shot(path, centre, radius, 55, 0, size=1000, width=1600, lens=60,
             samples=24)
    pos = lay_out(roots)
    for r in roots:
        r.location = pos[r.name]
    kit.refresh()
    by_name = {r.name: r for r in roots}
    hide_all(roots, True)
    render_rows(base, by_name)
    # Close-ups: one asset at a time beside a square and a car box.
    for r in roots:
        hide_all([r], False)
        sq = ref_square(r.location)
        lo, hi = bounds(r)
        car = car_box(hi.x + 0.1, lo.y - 0.05)
        kit.refresh()
        lo2 = Vector((min(lo.x, hi.x + 0.02), lo.y - 0.085, 0))
        hi2 = Vector((max(hi.x, hi.x + 0.18), hi.y, hi.z))
        c = (lo2 + hi2) / 2
        rad = max((hi2 - lo2).length * 0.55, 0.16)
        for az in (0, 30):
            shot("%s-%s-a%d.png" % (base, r.name, az), c, rad, 55, az,
                 size=560, samples=14)
        for o in sq + [car]:
            bpy.data.objects.remove(o, do_unlink=True)
        hide_all([r], True)
    hide_all(roots, False)


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
