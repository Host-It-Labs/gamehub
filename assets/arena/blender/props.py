"""Arena's scenery props for the Collector's Diorama board (Medieval half):
armature oaks with clump-foam crowns, pines with layered boughs, fractured
mossy rocks and small cliffs, dense bushes, static-grass tufts and tiny
flowers, and the medieval camp dressing (stump, log, barrel, crate, torch,
banner post, cart, hay bales, well, fence, tent).
See docs/concepts/2026-09-26-arena-retheme/diorama.md.

Every prop is an empty at its footprint origin with its base on z=0 and its
meshes as children; the game scatters, turns and scales copies with
instancing. Parts that meet the ground sink a few centimetres below z=0 so
uneven terrain never shows a gap. Materials are the kit's "<tile>:<tint>";
the prop tints are registered with kit.tint() (sRGB hex, carried to the game
in each material's extras), a grown-up palette of moss, olive, weathered
oak and warm stone greys.

  Blender -b --factory-startup --python assets/arena/blender/props.py \\
      -- out.glb [preview.png] [quick] [views=trees,oak,...]

The preview is an orthographic line-up in a graphite studio (a key light
from the upper left, a cool rim from behind). Beside it: close-ups of each
family next to a 1.3 m knight-sized marker, a small forest group seen from
the game's height (45 degrees, 40 degree lens), and the new medieval pieces.
"quick" skips everything but the line-up; "views=" renders only the named
close-ups (trees, rocks, props, cover, medieval, oak, pine, bush, game).
"""

import math
import os
import random
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import forest_kit as fk  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402

TAU = math.tau

kit.reset(seed=31)


# ---------------------------------------------------------------- palette

def tint(name, hex_colour):
    return kit.tint("prop-" + name, hex_colour)


# Foliage: a main clump colour and a lighter, warmer dusting on the tips.
OAK = ("foliage:" + tint("oak", "#53a684"),
       "foliage:" + tint("oak-tip", "#96cc96"))
OLIVE = ("foliage:" + tint("olive", "#77b883"),
         "foliage:" + tint("olive-tip", "#b9d995"))
HOLM = ("foliage:" + tint("holm", "#4b937e"),
        "foliage:" + tint("holm-tip", "#8ac6a0"))
PINE = ("foliage:" + tint("pine", "#438a80"),
        "foliage:" + tint("pine-tip", "#81b99b"))
FIR = ("foliage:" + tint("fir", "#377b77"),
       "foliage:" + tint("fir-tip", "#76b9a0"))
BUSH = ("foliage:" + tint("bush", "#65a781"),
        "foliage:" + tint("bush-tip", "#a6ce93"))
BRAMBLE = ("foliage:" + tint("bramble", "#83ab78"),
           "foliage:" + tint("bramble-tip", "#c3d397"))
MOSS = "foliage:" + tint("moss", "#868b59")
MOSS_DRY = "foliage:" + tint("moss-dry", "#a09967")
BARK = "bark:" + tint("bark", "#b08059")
BARK_PINE = "bark:" + tint("bark-pine", "#a97955")
ROCK = "rock:" + tint("rock", "#b2b0c2")
CRAG = "rock:" + tint("crag", "#9499af")
TUFT = "grass:" + tint("tuft", "#c4c587")
TUFT_DRY = "grass:" + tint("tuft-dry", "#e8d49a")
TUFT_DEEP = "grass:" + tint("tuft-deep", "#a3ad78")
OAKWOOD = "wood:" + tint("oakwood", "#8e7e6c")
TIMBER = "wood:" + tint("timber", "#a38d73")
SAWN = "wood:" + tint("sawn", "#d9c7a6")
FUNGUS = "wood:" + tint("fungus", "#d6c3a0")
GILT = "cloth:" + tint("gilt", "#c9a55e")
CANVAS = "cloth:" + tint("canvas", "#d7ccb4")
SHADE = "cloth:" + tint("shade", "#5a5047")
ROPE = "cloth:" + tint("rope", "#a8966f")
SACK = "cloth:" + tint("sack", "#b6a585")
HAY = "cloth:" + tint("hay", "#d9bf7c")
STRAW = "plain:" + tint("straw", "#c9b173")
PETAL_WHITE = "plain:" + tint("petal-white", "#e7e2d2")
PETAL_YELLOW = "plain:" + tint("petal-yellow", "#d6b44f")
PETAL_PINK = "plain:" + tint("petal-pink", "#c58ea2")
PETAL_VIOLET = "plain:" + tint("petal-violet", "#8f7db4")
WATER = "plain:" + tint("water", "#1f2a2c")
EMBER = "glow:" + tint("ember", "#ff7a2e")
STONE = "stone:warm"
TEAM = "cloth:team"
IRON = "metal:iron"
BRASS = "metal:brass"
FIRE = "fire:fire"

BUDGET = {"tree-": 3000, "bush": 1200, "rock": 800, "cliff": 6000,
          "tufts": 300, "flowers": 300}
SMALL_BUDGET = 1500


# Per-mesh light rules applied to the baked AO (see forest_kit.light_ao)
# and custom shading normals (forest_kit.set_normals).
LIGHT = {}
NORMALS = {}


def nearest_head(heads, co):
    best = None
    for c, (rx, ry, rz) in heads:
        d = Vector(((co.x - c.x) / rx, (co.y - c.y) / ry, (co.z - c.z) / rz))
        if best is None or d.length < best[0].length:
            best = (d, (rx, ry, rz))
    return best


def crown_normals(heads, mix=0.6):
    """Normals bent towards the crown's ellipsoid: soft, volumetric light
    across the foam, the lumps still showing through."""
    def fn(co, n):
        d, (rx, ry, rz) = nearest_head(heads, co)
        g = Vector((d.x / rx, d.y / ry, d.z / rz))
        if g.length < 1e-6:
            return n
        return Vector(n) * (1 - mix) + g.normalized() * mix
    return fn


def grass_normals(co, n):
    """Static grass shades like the ground, leaning out a little."""
    out = Vector((co.x, co.y, 0))
    if out.length > 1e-6:
        out.normalize()
    return Vector((0, 0, 1)) + out * 0.25


def crown_light(heads):
    """Shade a crown: undersides and the inner layers deep, the outer tops
    sunlit (the model-maker's dark base coat under a light dusting)."""
    def rule(co, n):
        best = None
        for c, (rx, ry, rz) in heads:
            d = Vector(((co.x - c.x) / rx, (co.y - c.y) / ry,
                        (co.z - c.z) / rz))
            if best is None or d.length < best[0].length:
                best = (d, c, rz)
        d, c, rz = best
        up = 0.5 + 0.5 * n.z
        h = max(0.0, min(1.0, (d.z + 1) / 2))
        out = max(0.0, min(1.0, (d.length - 0.55) / 0.45))
        return 0.45 * up + 0.3 * h + 0.25 * out
    return rule


def finish(root, meshes):
    for m in meshes:
        kit.parent(m, root)
    return root, meshes


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- oaks

def trunk_path(h, lean, sink=0.16, step=0.36):
    n = max(4, round((h + sink) / step))
    return [Vector((lean[0] * (i / n) ** 2, lean[1] * (i / n) ** 2,
                    -sink + (h + sink) * i / n)) for i in range(n + 1)]


def root_spurs(b, seed, r0, count, mat, reach=0.55, sides=5):
    """Root spurs diving from the trunk's foot into the ground."""
    rnd = random.Random(seed)
    ph = rnd.uniform(0, TAU)
    for k in range(count):
        a = ph + k / count * TAU + rnd.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        L = reach * rnd.uniform(0.75, 1.2)
        pts = [d * r0 * 0.55 + Vector((0, 0, 0.34)),
               d * (r0 * 0.95 + L * 0.35) + Vector((0, 0, 0.08)),
               d * (r0 + L) + Vector((0, 0, -0.1))]
        fk.tube(b, pts, lambda t: r0 * 0.42 * (1 - 0.7 * t), sides, mat,
                seed=seed + k)


def point_on(path, s):
    """A point a fraction s along a polyline."""
    lengths = [0.0]
    for p, q in zip(path, path[1:]):
        lengths.append(lengths[-1] + (q - p).length)
    target = s * lengths[-1]
    for i in range(len(path) - 1):
        if lengths[i + 1] >= target:
            t = (target - lengths[i]) / max(1e-6, lengths[i + 1] - lengths[i])
            return path[i].lerp(path[i + 1], t)
    return path[-1].copy()


def oak(name, seed, h, r0, r1, lean, heads, colours, clump=0.46, flare=0.9,
        nroots=5):
    """An armature tree: a trunk forking into heads; each head's stem sends
    limbs out into the crown, twigs run from the limb ends to the crown's
    shell, and a clump of foam foliage sits on every twig end (bigger ones
    on the limb ends, a few filling the heart), so the crown has real depth,
    gaps showing the branches, and a soft, lumpy silhouette."""
    rnd = random.Random(seed)
    wood = fk.Builder(name + "-trunk")
    leaves = fk.Builder(name + "-canopy")
    main, tip = colours
    leaves.uv_scales = {main: 0.2, tip: 0.2}
    ph = rnd.uniform(0, TAU)
    path = trunk_path(h, lean)
    top = path[-1]
    stems = []
    for hi, head in enumerate(heads):
        c = Vector(head["c"])
        start = top if hi == 0 else top - Vector((0, 0, 0.35))
        stems.append([Vector(q) for q in fk.polyline([
            start, top.lerp(c, 0.5) + Vector(head.get("kink", (0, 0, 0))),
            c + Vector((0, 0, head["r"][2] * 0.35))], 3)])

    def length(pts):
        return sum((q - p).length for p, q in zip(pts, pts[1:]))
    # The trunk runs on into the first head's stem as one tube (no collar);
    # other heads fork out of it.
    full = path + stems[0][1:]
    total = length(full)
    sf = length(path) / total
    sr0 = heads[0].get("stem", r1 * 0.9)

    def radius(t):
        if t <= sf:
            return lerp(r0, r1, (t / sf) ** 0.75)
        u = (t - sf) / (1 - sf)
        return lerp(r1, sr0, min(1.0, u * 3)) * (1 - 0.65 * u)

    def shape(t, a):
        z = t * total - 0.16
        return 1 + flare * math.exp(-max(z, 0) / 0.32) * (
            0.2 + 0.8 * max(0.0, math.cos(nroots * a + ph)) ** 2)
    fk.tube(wood, full, radius, 10, BARK, shape=shape, noise_amp=0.08,
            seed=seed)
    root_spurs(wood, seed, r0, nroots - 1, BARK)
    clumps = []
    for hi, head in enumerate(heads):
        c = Vector(head["c"])
        rx, ry, rz = head["r"]
        stem = stems[hi]
        sr = head.get("stem", r1 * 0.9)
        if hi:
            fk.tube(wood, stem, lambda t, sr=sr: sr * (1 - 0.65 * t), 8, BARK,
                    noise_amp=0.04, seed=seed + 10 + hi, v0=h / 1.2)
        n = head["limbs"]
        hph = rnd.uniform(0, TAU)
        ends = []
        for k in range(n):
            az = hph + k / n * TAU + rnd.uniform(-0.3, 0.3)
            start = point_on(stem, rnd.uniform(0.2, 0.6))
            el = rnd.uniform(-0.35, 0.25) + head.get("lift", 0)
            reach = rnd.uniform(0.5, 0.62)
            end = c + Vector((math.cos(az) * rx * reach,
                              math.sin(az) * ry * reach, rz * el))
            mid = start.lerp(end, 0.5) + Vector((0, 0, 0.12 + 0.15 * rz))
            limb = fk.polyline([start, mid, end], 2)
            lr = sr * rnd.uniform(0.52, 0.64)
            fk.tube(wood, limb, lambda t, lr=lr: lr * (1 - 0.6 * t), 6, BARK,
                    seed=seed + 40 + k)
            ends.append((end, lr))
            clumps.append((end, clump * rnd.uniform(1.1, 1.3), "limb", c))
        # The shell: clumps spread evenly (a Fibonacci spiral) over the
        # crown from well below its middle to its top, each on a twig from
        # the nearest limb end.
        count = max(5, round(head.get("shell", 16) * 0.45))
        lo, hi_ = head.get("low", -0.5), 1.0
        for m in range(count):
            f = (m + 0.5) / count
            zf = lo + (hi_ - lo) * f ** 0.85
            a2 = m * 2.39996 + hph + rnd.uniform(-0.25, 0.25)
            ring = math.sqrt(max(0.0, 1 - zf * zf))
            far = rnd.uniform(0.8, 0.97)
            q = c + Vector((math.cos(a2) * ring * rx, math.sin(a2) * ring * ry,
                            zf * rz)) * far
            end, lr = min(ends, key=lambda e: (e[0] - q).length)
            if zf < -0.2:
                fk.tube(wood, [end, end.lerp(q, 0.5) + Vector((0, 0, 0.08)),
                               end.lerp(q, 0.85)],
                        lambda t, lr=lr: lr * 0.42 * (1 - 0.55 * t), 4, BARK,
                        seed=seed + 80 + m)
            clumps.append((q, clump * rnd.uniform(1.1, 1.45), "twig", c))
        for m in range(head.get("fill", 2)):
            a2 = rnd.uniform(0, TAU)
            q = c + Vector((math.cos(a2) * rx * 0.25, math.sin(a2) * ry * 0.25,
                            rz * rnd.uniform(-0.1, 0.3)))
            clumps.append((q, min(rx, ry) * 0.52, "fill", c))
    lumps = []
    for i, (p, r, kind, hc) in enumerate(clumps):
        if kind == "fill":
            lumps.append((p, r, seed * 97 + i, {"rough": 0.12, "squash": 0.8}))
            continue
        sq = rnd.uniform(0.74, 0.9)
        lumps.append((p, r, seed * 97 + i,
                      {"squash": sq, "under": 0.45,
                       "scale": (rnd.uniform(0.9, 1.15),
                                 rnd.uniform(0.9, 1.15), 1)}))
    budget = 2990 - wood.tris()
    bm = fk.fuse(lumps, budget, voxel=0.05, smooth=4, crumb=0.002,
                 grain=3.2, seed=seed)
    leaves.merge(bm, main)
    bm.free()
    shells = [(Vector(hd["c"]), hd["r"]) for hd in heads]
    guide = crown_normals(shells, mix=1.0)
    off = Vector((seed * 1.7, 3.1, 0.4))

    def lit(centre, normal):
        g = Vector(guide(centre, normal)).normalized()
        return g.z + 0.25 * Vector(normal).z > \
            0.62 + 0.3 * noise.noise(centre * 0.8 + off)
    fk.tint_tips(leaves, [main], tip, lit)
    LIGHT[name + "-canopy"] = crown_light(shells)
    NORMALS[name + "-canopy"] = crown_normals(shells)
    trunk_obj = wood.build(smooth=60)
    fk.drop_buried(trunk_obj)
    canopy = leaves.build(smooth=180)
    return finish(kit.empty(name), [trunk_obj, canopy])


def oak_1():
    """The classic round oak: a sturdy trunk forking low into one full
    crown."""
    return oak("tree-oak-1", 3, h=1.55, r0=0.29, r1=0.2, lean=(0.08, 0.04),
               heads=[{"c": (0.12, 0.05, 3.05), "r": (1.8, 1.7, 1.45),
                       "limbs": 5, "shell": 22, "fill": 2}],
               colours=OAK, clump=0.42)


def oak_2():
    """A broad, low umbrella crown on a leaning trunk."""
    return oak("tree-oak-2", 7, h=1.25, r0=0.32, r1=0.21, lean=(-0.2, 0.08),
               heads=[{"c": (-0.15, 0.05, 2.75), "r": (2.3, 1.95, 1.05),
                       "limbs": 6, "shell": 22, "fill": 3, "lift": -0.05,
                       "low": -0.45}],
               colours=OLIVE, clump=0.44, flare=0.9, nroots=6)


def oak_3():
    """A tall tree whose trunk forks into two leaning stems, each carrying
    its own crown: an irregular, two-headed silhouette."""
    return oak("tree-oak-3", 11, h=1.9, r0=0.26, r1=0.18, lean=(0.25, -0.08),
               heads=[{"c": (0.95, -0.25, 4.1), "r": (1.25, 1.15, 1.1),
                       "limbs": 3, "shell": 12, "fill": 1, "stem": 0.14},
                      {"c": (-0.75, 0.35, 3.25), "r": (1.1, 1.05, 0.95),
                       "limbs": 3, "shell": 10, "fill": 1, "stem": 0.13,
                       "kink": (-0.1, 0.1, -0.2)}],
               colours=HOLM, clump=0.4, nroots=4)


# ---------------------------------------------------------------- pines

def pine(name, seed, H, z0, R0, r0, colours, lean=(0.0, 0.0), spacing=0.42,
         bark=BARK_PINE, most=7):
    """A conifer of layered boughs: whorls of drooping, serrated pads around
    a straight trunk, fewer and shorter towards a pointed leader, with the
    trunk and the dark inner boughs showing between the layers."""
    rnd = random.Random(seed)
    main, tip = colours
    wood = fk.Builder(name + "-trunk")
    crown = fk.Builder(name + "-crown")
    crown.uv_scales = {main: 0.2, tip: 0.2}

    def axis(z):
        return Vector((lean[0] * (z / H) ** 2, lean[1] * (z / H) ** 2, z))

    def radius_at(z):
        f = max(0.0, min(1.0, (H - z) / (H - z0)))
        return R0 * f ** 0.92
    zs = [-0.14 + (H * 0.94 + 0.14) * i / 12 for i in range(13)]
    ph = rnd.uniform(0, TAU)
    fk.tube(wood, [axis(z) for z in zs],
            lambda t: lerp(r0, 0.035, t ** 0.9), 7, bark,
            shape=lambda t, a: 1 + 0.9 * math.exp(-t * H / 0.25) * max(
                0.0, math.cos(5 * a + ph)) ** 2,
            noise_amp=0.06, seed=seed)
    z = z0
    phase = rnd.uniform(0, TAU)
    level = 0
    while z < H - 0.55:
        f = (H - z) / (H - z0)
        R = radius_at(z) * rnd.uniform(0.88, 1.08) + 0.14
        n = max(3, min(most, round(3 + (most - 3) * f ** 0.8)))
        for i in range(n):
            az = phase + i / n * TAU + rnd.uniform(-0.28, 0.28)
            L = R * rnd.uniform(0.82, 1.06)
            rise = lerp(0.5, 0.22, f)
            droop = lerp(0.45, 0.62, f)
            root = axis(z + rnd.uniform(-0.05, 0.05)) + \
                Vector((math.cos(az), math.sin(az), 0)) * r0 * 0.25
            fk.bough(crown, root, az, L, L * rnd.uniform(0.9, 1.1), rise,
                     droop, seed * 131 + level * 11 + i, main)
        phase += 2.39996
        level += 1
        z += spacing * 1.5 * rnd.uniform(0.95, 1.05) * lerp(0.7, 1.0, f)
    # The leader: a last small whorl and a pointed tip.
    for i in range(3):
        az = phase + i / 3 * TAU
        fk.bough(crown, axis(H - 0.5), az, 0.3, 0.24, 0.55, 0.5,
                 seed * 7 + i, main)
    fk.tube(crown, [axis(H - 0.62), axis(H - 0.2), axis(H)],
            lambda t: 0.12 * (1 - 0.8 * t), 5, main, cap="point",
            seed=seed + 3)
    # A dark heart so the layers read as dense, not see-through.
    fk.tube(crown, [axis(z0 + 0.1), axis(lerp(z0, H, 0.5)),
                    axis(H - 0.6)],
            lambda t: lerp(R0 * 0.3, 0.1, t), 6, main, seed=seed + 5)
    off = Vector((seed * 2.3, 1.7, 0.2))

    def lit(c, n):
        a = axis(c.z)
        r = math.hypot(c.x - a.x, c.y - a.y)
        return n.z > 0.15 and r > (0.55 + 0.2 * noise.noise(c * 1.8 + off)) \
            * (radius_at(c.z) + 0.14)
    fk.tint_tips(crown, [main], tip, lit)

    def shade_rule(co, n):
        a = axis(co.z)
        r = math.hypot(co.x - a.x, co.y - a.y)
        out = r / (radius_at(co.z) + 0.14)
        return 0.5 * (0.5 + 0.5 * n.z) + 0.5 * max(0.0, min(1.0, out))
    LIGHT[name + "-crown"] = shade_rule

    def cone(co, n, mix=0.5):
        a = axis(co.z)
        out = Vector((co.x - a.x, co.y - a.y, 0))
        if out.length < 1e-6:
            return n
        g = out.normalized() + Vector((0, 0, 0.55))
        return Vector(n) * (1 - mix) + g.normalized() * mix
    NORMALS[name + "-crown"] = cone
    trunk_obj = wood.build(smooth=60)
    fk.drop_buried(trunk_obj)
    crown_obj = crown.build(smooth=75)
    return finish(kit.empty(name), [trunk_obj, crown_obj])


def pine_1():
    """A broad, full pine."""
    return pine("tree-pine-1", 5, H=6.4, z0=0.9, R0=1.5, r0=0.22,
                colours=PINE, spacing=0.47, most=7)


def pine_2():
    """A tall, slender fir with a slight lean."""
    return pine("tree-pine-2", 9, H=5.8, z0=0.72, R0=1.08, r0=0.18,
                colours=FIR, lean=(0.28, -0.1), spacing=0.41, most=6)


# ---------------------------------------------------------------- bushes

def bush(name, seed, clumps, colours):
    """A dense bush of clump foliage: separate foam clumps glued into a
    dome, the way model-makers build them, each clump smooth-shaded with
    a fine foam grain, dark in the middle and dusted light on top."""
    rnd = random.Random(seed)
    b = fk.Builder(name + "-leaves")
    main, tip = colours
    b.uv_scales = {main: 0.2, tip: 0.2}
    for i, (r, c) in enumerate(clumps):
        c = Vector(c)
        c.z = max(c.z, r * 0.5 - 0.05)
        fk.foam(b, c, r * rnd.uniform(0.88, 1.12), seed * 17 + i, main,
                sub=3, rough=0.08, crumb=0.002, squash=rnd.uniform(0.78, 0.94),
                under=0.5, scale=(rnd.uniform(0.9, 1.12),
                                  rnd.uniform(0.9, 1.12), 1))
    top = max(c[1][2] for c in clumps)
    rx = max(abs(c[1][0]) + c[0] for c in clumps)
    ry = max(abs(c[1][1]) + c[0] for c in clumps)
    shells = [(Vector((0, 0, top * 0.35)), (rx, ry, top * 0.8))]
    guide = crown_normals(shells, mix=1.0)
    off = Vector((seed * 1.3, 0.7, 2.0))

    def lit(c, n):
        g = Vector(guide(c, n)).normalized()
        return g.z + 0.35 * n.z > 0.62 + 0.3 * noise.noise(c * 1.5 + off)
    fk.tint_tips(b, [main], tip, lit)
    LIGHT[name + "-leaves"] = crown_light(shells)
    NORMALS[name + "-leaves"] = crown_normals(shells, mix=0.45)
    obj = b.build(smooth=180)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def mound(seed, rx, ry, h, count, r):
    """Clump centres heaped into a dome: a ring at the foot, a ring above
    it, a crown on top."""
    rnd = random.Random(seed)
    out = [(r * 1.2, (0, 0, h * 0.6))]
    rings = ((0.78, 0.22, count // 2), (0.46, 0.5, count - 1 - count // 2 - 2),
             (0.18, 0.72, 2))
    for k, (reach, zf, n) in enumerate(rings):
        for i in range(n):
            a = i / n * TAU + rnd.uniform(-0.25, 0.25) + k * 0.7
            out.append((r * rnd.uniform(0.78, 1.0),
                        (math.cos(a) * rx * reach, math.sin(a) * ry * reach,
                         h * zf * rnd.uniform(0.9, 1.1))))
    return out


def bush_1():
    return bush("bush-1", 3, mound(3, 0.6, 0.56, 1.0, 14, 0.3), BUSH)


def bush_2():
    return bush("bush-2", 8, mound(8, 0.82, 0.5, 0.78, 14, 0.28), BRAMBLE)


# ---------------------------------------------------------------- rocks

def grass_bits(b, tree, seed, count, area, height=0.2, fibres=12,
               min_nz=0.7):
    """A few static-grass tufts on ledges and tops."""
    rnd = random.Random(seed)
    placed = 0
    for _ in range(count * 20):
        if placed >= count:
            break
        x, y = rnd.uniform(area[0], area[2]), rnd.uniform(area[1], area[3])
        hit = tree.ray_cast(Vector((x, y, 20)), Vector((0, 0, -1)))
        if hit[0] is None or hit[1].z < min_nz:
            continue
        sub = fk.Builder("__tuft")
        fk.tuft(sub, seed * 13 + placed, fibres, height * rnd.uniform(0.7, 1.2),
                [TUFT, TUFT_DRY], [2, 1], width=0.018, root=0.04, sink=0.04)
        b.merge(sub.bm, TUFT, Matrix.Translation(hit[0]),
                mats=sub.mats)
        sub.bm.free()
        placed += 1


def rock(name, seed, blocks, moss=4, moss_r=0.14, tufts=0, sink=0.08,
         skirt=4):
    """Fractured blocks: each `blocks` entry is (size, (x, y), yaw, tilt,
    options for fk.fracture). Blocks stand on the ground, sunk a little."""
    b = fk.Builder(name + "-stone")
    xs, ys = [], []
    for i, (size, xy, yaw, tilt, kw) in enumerate(blocks):
        bm = fk.fracture(size, seed * 11 + i, **kw)
        zs = [v.co.z for v in bm.verts]
        lift = -min(zs) - sink
        fk.place(bm, fk.block_matrix((xy[0], xy[1], lift), yaw, tilt))
        # Re-seat after the tilt so the lowest point is `sink` underground.
        low = min(v.co.z for v in bm.verts)
        bmesh.ops.translate(bm, vec=(0, 0, -sink - low), verts=bm.verts)
        b.merge(bm, ROCK)
        bm.free()
        xs += [xy[0] - size[0] / 2, xy[0] + size[0] / 2]
        ys += [xy[1] - size[1] / 2, xy[1] + size[1] / 2]
    area = (min(xs), min(ys), max(xs), max(ys))
    tree = fk.bvh(b)
    if moss:
        fk.moss_on(b, tree, seed, moss, area, moss_r, MOSS, min_nz=0.45,
                   cluster=moss_r * 1.3)
        fk.moss_on(b, tree, seed + 7, moss, area, moss_r * 0.55, MOSS,
                   min_nz=0.35, cluster=moss_r, sub=1)
        fk.moss_on(b, tree, seed + 8, moss, area, moss_r * 0.5, MOSS_DRY,
                   min_nz=0.5, cluster=moss_r, sub=1)
    if skirt:
        cx, cy = (area[0] + area[2]) / 2, (area[1] + area[3]) / 2
        reach = max(area[2] - area[0], area[3] - area[1])
        fk.moss_skirt(b, tree, seed + 3, skirt, (cx, cy, 0), reach,
                      moss_r * 1.1, MOSS, arc=(0.5, 3.6))
        fk.moss_skirt(b, tree, seed + 4, skirt, (cx, cy, 0), reach,
                      moss_r * 0.6, MOSS_DRY, sub=1)
    if tufts:
        grass_bits(b, tree, seed + 5, tufts, area)
    obj = b.build(smooth=32)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def rock_1():
    return rock("rock-1", 1, [
        ((0.84, 0.66, 0.58), (0, 0), 0.3, (0.05, -0.08),
         {"cuts": 8, "bevel": 0.02}),
    ], moss=4, moss_r=0.13, skirt=3)


def rock_2():
    return rock("rock-2", 2, [
        ((0.95, 0.9, 0.95), (-0.1, 0.0), 0.2, (0.06, 0.1),
         {"cuts": 9, "flat_top": 1}),
        ((0.5, 0.55, 0.5), (0.45, -0.22), 1.1, (0.3, -0.2),
         {"cuts": 6, "bevel": 0.018}),
    ], moss=4, moss_r=0.15, skirt=2)


def rock_3():
    return rock("rock-3", 3, [
        ((0.95, 0.7, 1.45), (0.0, 0.0), 0.4, (0.1, -0.16),
         {"cuts": 9, "max_edge": 0.55}),
        ((0.55, 0.45, 0.4), (0.5, 0.3), 2.0, (0.2, 0.25),
         {"cuts": 6, "bevel": 0.018, "max_edge": 1.0}),
    ], moss=3, moss_r=0.15, tufts=1, skirt=2)


def rock_4():
    return rock("rock-4", 4, [
        ((1.6, 1.3, 1.9), (0.0, 0.0), 0.3, (0.06, 0.08),
         {"cuts": 9, "flat_top": 1, "max_edge": 1.1, "bevel": 0.03}),
        ((0.95, 0.8, 1.2), (0.95, 0.25), 0.9, (0.16, -0.12),
         {"cuts": 7, "max_edge": 1.1}),
        ((0.7, 0.6, 0.5), (0.95, -0.6), 1.9, (0.2, 0.3),
         {"cuts": 5, "bevel": 0.02, "max_edge": 1.1}),
    ], moss=4, moss_r=0.19, tufts=1, skirt=2)


# ---------------------------------------------------------------- cliffs

def cliff(name, seed, tiers, fallen, moss=22, tufts=6, dip=(0.05, -0.03)):
    """A small crag of stacked, fractured strata. Each tier is a ring of
    blocks around an elliptical footprint with a core block for its ledge;
    the next tier stands on it, set back, so the front opens into mossy
    ledges. tiers: (z0, z1, cx, cy, rx, ry, blocks)."""
    rnd = random.Random(seed)
    b = fk.Builder(name + "-stone")
    xs, ys = [], []
    for ti, (z0, z1, cx, cy, rx, ry, nb) in enumerate(tiers):
        base = -0.14 if ti == 0 else z0 - 0.12
        h = z1 - base
        core = fk.fracture((rx * 1.75, ry * 1.75, h * 1.12), seed * 7 + ti,
                           cuts=5, flat_top=1, max_edge=1.2, bevel=0.03,
                           lo=0.75, hi=0.95)
        fk.place(core, fk.block_matrix((cx, cy, base + h * 0.56),
                                       rnd.uniform(-0.3, 0.3), dip))
        b.merge(core, CRAG)
        core.free()
        for k in range(nb):
            a = k / nb * TAU + rnd.uniform(-0.22, 0.22)
            px, py = cx + math.cos(a) * rx * 0.86, cy + math.sin(a) * ry * 0.86
            normal = math.atan2(math.sin(a) / ry, math.cos(a) / rx)
            width = TAU * math.sqrt((rx * rx + ry * ry) / 2) / nb * \
                rnd.uniform(1.05, 1.4)
            depth = rnd.uniform(0.55, 0.85) * min(rx, ry)
            bh = h * rnd.uniform(0.72, 1.06)
            bm = fk.fracture((width, depth, bh), seed * 101 + ti * 17 + k,
                             cuts=rnd.choice((6, 7, 8)), max_edge=0.8,
                             bevel=0.028, lo=0.6, hi=0.88,
                             flat_top=1 if rnd.random() < 0.6 else 0)
            tilt = (dip[0] + rnd.uniform(-0.06, 0.06),
                    dip[1] + rnd.uniform(-0.06, 0.06))
            fk.place(bm, fk.block_matrix((px, py, base + bh / 2),
                                         normal - math.pi / 2, tilt))
            b.merge(bm, CRAG)
            bm.free()
            xs += [px - width / 2, px + width / 2]
            ys += [py - width / 2, py + width / 2]
    for i, (size, xy, yaw) in enumerate(fallen):
        bm = fk.fracture(size, seed * 53 + i, cuts=7, bevel=0.022)
        low = min(v.co.z for v in bm.verts)
        fk.place(bm, fk.block_matrix((xy[0], xy[1], -low - 0.07), yaw,
                                     (rnd.uniform(-0.2, 0.2),
                                      rnd.uniform(-0.2, 0.2))))
        b.merge(bm, CRAG)
        bm.free()
    area = (min(xs), min(ys), max(xs), max(ys))
    tree = fk.bvh(b)
    fk.moss_on(b, tree, seed, moss, area, 0.22, MOSS, min_nz=0.55,
               cluster=0.3, flat=0.34)
    fk.moss_on(b, tree, seed + 1, moss // 3, area, 0.17, MOSS_DRY,
               min_nz=0.65, cluster=0.2, flat=0.3)
    fk.moss_on(b, tree, seed + 4, moss, area, 0.11, MOSS, min_nz=0.45,
               cluster=0.2, sub=1)
    cx, cy = (area[0] + area[2]) / 2, (area[1] + area[3]) / 2
    fk.moss_skirt(b, tree, seed + 2, 7, (cx, cy, 0), 4.0, 0.22, MOSS,
                  arc=(-2.6, 0.4))
    grass_bits(b, tree, seed + 9, tufts, area, height=0.24, fibres=14)
    # Cliff faces read as crags: the rock tile drawn a little larger.
    b.replan([f for f in b.bm.faces if b.mats[f.material_index] == CRAG],
             scale=1.5)
    obj = b.build(smooth=30)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def cliff_1():
    """A tall three-step outcrop whose walls rise sheer at the back and open
    into mossy ledges at the front."""
    return cliff("cliff-1", 3, [
        (0.0, 1.35, 0.0, 0.0, 2.0, 1.25, 9),
        (1.35, 2.35, -0.25, 0.3, 1.25, 0.8, 7),
        (2.35, 3.15, -0.45, 0.42, 0.72, 0.5, 5),
    ], [((1.0, 0.9, 0.75), (1.9, -1.25), 0.5),
        ((0.62, 0.55, 0.45), (-2.1, -0.85), 1.2),
        ((0.4, 0.36, 0.3), (1.15, -1.55), 2.1)])


def cliff_2():
    """A long low outcrop that rises into a crag at one end."""
    return cliff("cliff-2", 7, [
        (0.0, 0.95, 0.0, 0.0, 1.8, 1.1, 8),
        (0.95, 2.15, -0.75, 0.15, 0.85, 0.7, 6),
    ], [((0.95, 0.75, 0.95), (1.55, -0.8), 0.3),
        ((0.5, 0.45, 0.38), (0.7, -1.25), 2.0)], moss=18, tufts=5,
        dip=(-0.04, 0.06))


# ---------------------------------------------------------------- ground cover

def tufts():
    """A static-grass tuft: about ninety fibres in three shades."""
    b = fk.Builder("tufts-grass")
    fk.tuft(b, 4, 90, 0.3, [TUFT, TUFT_DRY, TUFT_DEEP], [4, 4, 2],
            width=0.02, root=0.07, sink=0.03)
    obj = b.build(smooth=60)
    NORMALS[obj.name] = grass_normals
    return finish(kit.empty("tufts"), [obj])


def blossom(b, at, radius, mat, seed):
    """One tiny flower: a little three-sided bipyramid, a dot of colour
    (six triangles)."""
    rnd = random.Random(seed)
    at = Vector(at)
    spin = rnd.uniform(0, TAU)
    ring = [b.vert(at + Vector((math.cos(spin + k / 3 * TAU) * radius,
                                math.sin(spin + k / 3 * TAU) * radius, 0)))
            for k in range(3)]
    top = b.vert(at + Vector((0, 0, radius * 0.7)))
    bot = b.vert(at - Vector((0, 0, radius * 0.5)))
    for k in range(3):
        j = (k + 1) % 3
        b.face([ring[k], ring[j], top], mat)
        b.face([ring[j], ring[k], bot], mat)


def flowers_prop(name, seed, petals, weights):
    """Tiny wild flowers in a short tuft: umbels of little dots on fine
    stems standing above the grass, the way model-makers scatter flower
    flock on a tuft."""
    rnd = random.Random(seed)
    b = fk.Builder(name + "-bloom")
    fk.tuft(b, seed, 30, 0.19, [TUFT, TUFT_DEEP], [3, 2], width=0.018,
            root=0.07, sink=0.03)
    for i in range(10):
        a = rnd.uniform(0, TAU)
        d = rnd.uniform(0.02, 0.12)
        base = Vector((math.cos(a) * d * 0.4, math.sin(a) * d * 0.4, -0.03))
        top = Vector((math.cos(a) * d, math.sin(a) * d,
                      rnd.uniform(0.2, 0.3)))
        fk.fibre(b, base, top, 0.01, TUFT_DEEP)
        r = rnd.random() * sum(weights)
        k = 0
        while r > weights[k] and k < len(weights) - 1:
            r -= weights[k]
            k += 1
        for m in range(rnd.choice((2, 3, 3))):
            q = top + Vector((rnd.uniform(-0.025, 0.025),
                              rnd.uniform(-0.025, 0.025),
                              rnd.uniform(-0.012, 0.012)))
            blossom(b, q, rnd.uniform(0.016, 0.022), petals[k],
                    seed * 19 + i * 3 + m)
    obj = b.build(smooth=50)
    NORMALS[obj.name] = grass_normals
    return finish(kit.empty(name), [obj])


def flowers_1():
    return flowers_prop("flowers-1", 3, [PETAL_WHITE, PETAL_YELLOW], [3, 2])


def flowers_2():
    return flowers_prop("flowers-2", 8, [PETAL_PINK, PETAL_VIOLET], [2, 3])


# ---------------------------------------------------------------- timber

def ring_uvs(b, faces, centre_of, spacing=0.045):
    """Map the plank tile onto a saw cut so its plank seams become growth
    rings: u runs out from the heart, v swings with the angle (never
    reaching the nail rows at the tile's edges)."""
    for f in faces:
        for loop in f.loops:
            x, y = centre_of(loop.vert.co)
            r = math.hypot(x, y)
            th = math.atan2(y, x)
            loop[b.uv].uv = (r / spacing * 0.2, 0.5 + 0.36 * math.cos(th))


def stump():
    """A sawn oak stump: buttress roots, a sloping cut showing its rings, a
    split at the back, moss at its foot and a bracket fungus."""
    name = "stump"
    rnd = random.Random(2)
    b = fk.Builder(name + "-wood")
    ph = 0.6
    H = 0.5
    path = [Vector((0, 0, -0.12 + (H + 0.12) * i / 5)) for i in range(6)]

    def shape(t, a):
        z = -0.12 + (H + 0.12) * t
        return 1 + 0.85 * math.exp(-max(z, 0) / 0.16) * max(
            0.0, math.cos(5 * a + ph)) ** 2
    rings = fk.tube(b, path, lambda t: 0.3 - 0.03 * t, 16, BARK, shape=shape,
                    noise_amp=0.1, seed=2)
    top = rings[-1]
    # The cut slopes and the back splits up in a splintered lip.
    for v in top:
        v.co.z += 0.07 * v.co.x / 0.3
    centre = b.vert((0, 0, H + 0.005))
    inner = []
    for v in top:
        p = v.co.copy()
        p.x *= 0.86
        p.y *= 0.86
        p.z += 0.004
        inner.append(b.vert(p))
    for v in inner:
        v.co.z = H + 0.07 * v.co.x / 0.3 + 0.004
    cut = []
    n = len(top)
    for j in range(n):
        jj = (j + 1) % n
        cut.append(b.face([top[j], top[jj], inner[jj], inner[j]], BARK))
        cut.append(b.face([inner[j], inner[jj], centre], SAWN))
    ring_uvs(b, [f for f in cut if f and b.mats[f.material_index] == SAWN],
             lambda c: (c.x, c.y))
    for f in cut:
        if f and b.mats[f.material_index] == BARK:
            b.planar(f)
    # Splinters standing at the back of the cut.
    for k in range(4):
        a = math.pi + rnd.uniform(-0.6, 0.6)
        r = rnd.uniform(0.12, 0.24)
        base = Vector((math.cos(a) * r, math.sin(a) * r, H - 0.03 +
                       0.07 * math.cos(a) * r / 0.3))
        fk.fibre(b, base, base + Vector((rnd.uniform(-0.03, 0.03),
                                         rnd.uniform(-0.03, 0.03),
                                         rnd.uniform(0.08, 0.16))),
                 rnd.uniform(0.04, 0.06), SAWN)
    root_spurs(b, 2, 0.3, 5, BARK, reach=0.4)
    # A bracket fungus: two flattened half-discs on the shady side.
    for k, (z, r) in enumerate(((0.22, 0.09), (0.3, 0.065))):
        a = 1.9 + k * 0.35
        at = Vector((math.cos(a) * 0.31, math.sin(a) * 0.31, z))
        fk.cushion(b, at, Vector((math.cos(a), math.sin(a), 0.25)), r,
                   20 + k, FUNGUS, flat=0.3, sub=2, sink=0.1)
    tree = fk.bvh(b)
    fk.moss_on(b, tree, 5, 4, (-0.55, -0.55, 0.55, 0.55), 0.1, MOSS,
               min_nz=0.4, cluster=0.12)
    obj = b.build(smooth=50)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def log():
    """A fallen log along x: bark, a sawn end with rings, a broken end,
    two branch stubs and moss along its back."""
    name = "log"
    rnd = random.Random(6)
    b = fk.Builder(name + "-log")
    L = 2.0
    pts = [Vector((-L / 2 + L * i / 9, 0,
                   0.19 - 0.035 * (1 - ((-1 + 2 * i / 9)) ** 2)))
           for i in range(10)]
    rings = fk.tube(b, pts, lambda t: 0.25 - 0.05 * t, 14, BARK,
                    noise_amp=0.12, seed=6)
    # The sawn end at -x, with a bark rim and rings.
    first = rings[0]
    c0 = b.vert(pts[0] + Vector((-0.012, 0, 0)))
    inner = [b.vert(pts[0] + (v.co - pts[0]) * 0.86 + Vector((-0.008, 0, 0)))
             for v in first]
    n = len(first)
    end_faces = []
    for j in range(n):
        jj = (j + 1) % n
        b.face([first[jj], first[j], inner[j], inner[jj]], BARK)
        end_faces.append(b.face([inner[jj], inner[j], c0], SAWN))
    ring_uvs(b, [f for f in end_faces if f],
             lambda c: (c.y - pts[0].y, c.z - pts[0].z), 0.04)
    # The broken end at +x: a jagged cone of splinters.
    last = rings[-1]
    tipc = pts[-1]
    jag = [b.vert(tipc + (v.co - tipc) * 0.55 +
                  Vector((rnd.uniform(0.02, 0.14), 0, 0))) for v in last]
    point = b.vert(tipc + Vector((0.2, 0.02, 0.03)))
    for j in range(n):
        jj = (j + 1) % n
        b.face([last[j], last[jj], jag[jj], jag[j]], SAWN)
        b.face([jag[j], jag[jj], point], SAWN)
    for k, (x, a, ln) in enumerate(((0.35, 1.2, 0.34), (-0.45, -1.6, 0.22))):
        d = Vector((0.35, math.cos(a), math.sin(a) + 0.4)).normalized()
        base = Vector((x, 0, 0.19))
        fk.tube(b, [base, base + d * (0.2 + ln * 0.5), base + d * (0.2 + ln)],
                lambda t: 0.07 * (1 - 0.35 * t), 6, BARK, cap="flat",
                seed=60 + k)
    tree = fk.bvh(b)
    fk.moss_on(b, tree, 6, 7, (-0.95, -0.2, 0.9, 0.2), 0.12, MOSS,
               min_nz=0.55, cluster=0.2)
    obj = b.build(smooth=50)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def barrel():
    """An oak barrel: twelve staves with grooves between them, four iron
    hoops and a recessed head of planks."""
    name = "barrel"
    b = fk.Builder(name + "-body")
    rnd = random.Random(12)
    staves = 12
    segs = staves * 2
    prof = [(0.285, -0.02), (0.31, 0.1), (0.338, 0.25), (0.35, 0.43),
            (0.338, 0.61), (0.31, 0.76), (0.285, 0.88)]
    bumps = [rnd.uniform(-0.005, 0.005) for _ in range(staves)]

    def r_at(z):
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
            if z0 <= z <= z1:
                return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        return prof[-1][0]

    def stave(j, k, p):
        a = math.atan2(p.y, p.x)
        r = math.hypot(p.x, p.y)
        r += -0.006 if j % 2 == 0 else bumps[j // 2]
        return Vector((math.cos(a) * r, math.sin(a) * r, p.z))
    # 2.4 repeats of the five-plank tile put one plank on each stave.
    fk.revolve(b, prof, segs, OAKWOOD, u_reps=staves / 5, vert=stave,
               seam=-TAU / segs / 2)
    # The chime (the staves' top edge) and the recessed head.
    top = [(0.285, 0.88), (0.268, 0.885), (0.262, 0.83)]
    fk.revolve(b, top, segs, OAKWOOD, u_reps=staves / 5,
               seam=-TAU / segs / 2)
    head = [b.vert((math.cos(j / 12 * TAU) * 0.262,
                    math.sin(j / 12 * TAU) * 0.262, 0.83)) for j in range(12)]
    b.face(head, TIMBER)
    for i, (z0, z1) in enumerate(((0.06, 0.13), (0.26, 0.32), (0.54, 0.6),
                                  (0.73, 0.8))):
        band = [(r_at(z0) + 0.002, z0), (r_at(z0) + 0.011, z0 + 0.008),
                (r_at(z1) + 0.011, z1 - 0.008), (r_at(z1) + 0.002, z1)]
        fk.revolve(b, band, segs, IRON)
    # The bung, on one stave.
    fk.tube(b, [Vector((0.345, 0, 0.43)), Vector((0.37, 0, 0.43))],
            lambda t: 0.028, 6, TIMBER, cap="flat")
    obj = b.build(smooth=40)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def crate():
    """A nailed crate: corner battens, three boards a side with gaps,
    diagonal braces and iron corner plates."""
    name = "crate"
    b = fk.Builder(name + "-body")
    rnd = random.Random(14)
    s = 0.76
    h = s / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            fk.box(b, (0.09, 0.09, s), OAKWOOD,
                   Matrix.Translation((sx * (h - 0.045), sy * (h - 0.045),
                                       s / 2)), bevel=0.01)
    board = (s - 0.02) / 3
    for side in range(4):
        rot = Matrix.Rotation(side * math.pi / 2, 4, "Z")
        for k in range(3):
            z = 0.01 + board * (k + 0.5)
            m = rot @ Matrix.Translation((0, h - 0.025, z)) @ \
                Matrix.Rotation(rnd.uniform(-0.01, 0.01), 4, "Y")
            fk.box(b, (s - 0.19, 0.03, board - 0.014),
                   TIMBER if (side + k) % 2 else OAKWOOD, m, bevel=0.006)
        diag = math.hypot(s - 0.19, s - 0.1) * 0.94
        ang = math.atan2(s - 0.1, s - 0.19) * (1 if side % 2 else -1)
        m = rot @ Matrix.Translation((0, h - 0.004, s / 2)) @ \
            Matrix.Rotation(ang, 4, "Y")
        fk.box(b, (diag, 0.024, 0.075), OAKWOOD, m, bevel=0.006)
    for k in range(3):
        y = -h + 0.045 + (s - 0.09) * (k + 0.5) / 3
        fk.box(b, (s - 0.03, (s - 0.09) / 3 - 0.012, 0.03), TIMBER,
               Matrix.Translation((0, y, s - 0.012)), bevel=0.006)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z in (0.045, s - 0.045):
                # An L of two thin plates wrapped round the corner post.
                fk.box(b, (0.13, 0.012, 0.08), IRON, Matrix.Translation((
                    sx * (h - 0.065), sy * (h + 0.004), z)))
                fk.box(b, (0.012, 0.13, 0.08), IRON, Matrix.Translation((
                    sx * (h + 0.004), sy * (h - 0.065), z)))
    obj = b.build(smooth=40)
    return finish(kit.empty(name), [obj])


def stones(b, seed, count, radius, spread, mat=ROCK):
    """Small fractured footing stones in a ring around a post."""
    rnd = random.Random(seed)
    for i in range(count):
        a = i / count * TAU + rnd.uniform(-0.4, 0.4)
        s = radius * rnd.uniform(0.8, 1.2)
        bm = fk.fracture((s * 1.4, s * 1.1, s * 0.9), seed * 3 + i, cuts=5,
                         bevel=0.01, max_edge=1.0, wobble=0.008)
        low = min(v.co.z for v in bm.verts)
        fk.place(bm, fk.block_matrix((math.cos(a) * spread,
                                      math.sin(a) * spread, -low - 0.05), a,
                                     (rnd.uniform(-0.3, 0.3), 0.2)))
        b.merge(bm, mat)
        bm.free()


def torch():
    """A field torch: a hewn post bound with iron, an iron cresset of
    curled straps holding glowing coals, and the flame above."""
    name = "torch"
    b = fk.Builder(name + "-body")
    rnd = random.Random(21)
    fk.tube(b, [Vector((0, 0, -0.12)), Vector((0.005, 0, 0.7)),
                Vector((0, 0.004, 1.46))],
            lambda t: 0.075 - 0.018 * t, 8, OAKWOOD, noise_amp=0.05, seed=3)
    for z in (0.95, 1.33):
        fk.revolve(b, [(0.069, z), (0.078, z + 0.01), (0.078, z + 0.045),
                       (0.069, z + 0.055)], 8, IRON)
    # The cresset: a cup, a ring and six curled straps.
    fk.revolve(b, [(0.05, 1.4), (0.1, 1.44), (0.16, 1.5), (0.17, 1.52),
                   (0.12, 1.5), (0.0, 1.49)], 10, IRON)
    for i in range(6):
        a = i / 6 * TAU
        pts = [Vector((math.cos(a) * r, math.sin(a) * r, z)) for r, z in
               ((0.15, 1.5), (0.2, 1.58), (0.23, 1.68), (0.23, 1.77),
                (0.2, 1.8))]
        fk.tube(b, pts, lambda t: 0.011, 4, IRON)
    fk.tube(b, [Vector((math.cos(a) * 0.228, math.sin(a) * 0.228, 1.7))
                for a in [k / 12 * TAU for k in range(13)]],
            lambda t: 0.01, 4, IRON)
    # Glowing coals heaped in the cup.
    for i in range(5):
        a = i / 5 * TAU + rnd.uniform(-0.3, 0.3)
        fk.foam(b, (math.cos(a) * 0.08, math.sin(a) * 0.08, 1.53), 0.065,
                40 + i, EMBER, sub=1, rough=0.3, crumb=0.15, squash=0.7)
    stones(b, 5, 4, 0.13, 0.13)
    tree = fk.bvh(b)
    fk.moss_on(b, tree, 8, 3, (-0.3, -0.3, 0.3, 0.3), 0.07, MOSS, min_nz=0.5)
    body = b.build(smooth=45)
    fk.drop_buried(body)
    # The flame: three licking tongues twisting up out of the cresset.
    fb = fk.Builder(name + "-fire")
    prof = [(0.0, 1.5), (0.13, 1.55), (0.18, 1.63), (0.17, 1.72),
            (0.13, 1.83), (0.08, 1.95), (0.035, 2.06), (0.0, 2.14)]

    def lick(j, k, p):
        z = p.z
        t = max(0.0, (z - 1.5) / 0.64)
        a = math.atan2(p.y, p.x)
        r = math.hypot(p.x, p.y)
        tongue = max(0.0, math.cos(3 * (a - t * 1.5))) ** 1.5
        r *= 1 + 0.7 * tongue * t - 0.25 * (1 - tongue) * t
        a += t * 1.3
        return Vector((math.cos(a) * r, math.sin(a) * r,
                       z + 0.16 * tongue * t * t))
    fk.revolve(fb, prof, 15, FIRE, vert=lick)
    bmesh.ops.remove_doubles(fb.bm, verts=fb.bm.verts, dist=1e-4)
    flame = fb.build(smooth=80)
    root = kit.empty(name)
    finish(root, [body, flame])
    kit.empty("torch-flame", (0, 0, 1.75), root)
    return root, [body, flame]


# ---------------------------------------------------------------- heraldry

def cloth_y(x, z, width, length, sway=1.0):
    u = x / width + 0.5
    v = -z / length
    return sway * (0.05 * math.sin(v * math.pi * 1.4 + u * 1.5) * v +
                   0.022 * math.sin(u * 6.0))


def banner(b, width, length, origin, field=TEAM, trim=GILT, emblem=True,
           thick=0.022, tail=0.22):
    """A hanging swallowtail banner pinned along its top edge at `origin`:
    a team field with a gilt border and a gilt crown on both faces."""
    ox, oy, oz = origin
    cols = [0, 0.07, 0.22, 0.38, 0.5, 0.62, 0.78, 0.93, 1.0]
    rows = [0, 0.05, 0.16, 0.3, 0.44, 0.58, 0.72, 0.84, 0.93, 1.0]

    def pos(u, v, side):
        x = (u - 0.5) * width
        z = -v * length
        if v > 0.9:
            # The swallowtail: the bottom band follows a V cut.
            z += length * tail * (1 - abs(u - 0.5) * 2) * (v - 0.9) / 0.1 \
                if v < 1 else length * tail * (1 - abs(u - 0.5) * 2)
        y = cloth_y(x, z, width, length) + side * thick / 2
        return Vector((ox + x, oy + y, oz + z))
    grids = {}
    cloth = []
    for side in (1, -1):
        grids[side] = [[b.vert(pos(u, v, side)) for u in cols] for v in rows]
    for side in (1, -1):
        g = grids[side]
        for j in range(len(rows) - 1):
            for i in range(len(cols) - 1):
                border = i in (0, len(cols) - 2) or j in (0, len(rows) - 2)
                quad = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]]
                cloth.append(b.face(quad, trim if border else field))
    # Close the edges.
    f, k = grids[1], grids[-1]
    last_r, last_c = len(rows) - 1, len(cols) - 1
    edges = ([(f[0][i], f[0][i + 1], k[0][i + 1], k[0][i])
              for i in range(last_c)] +
             [(f[last_r][i + 1], f[last_r][i], k[last_r][i], k[last_r][i + 1])
              for i in range(last_c)] +
             [(f[j + 1][0], f[j][0], k[j][0], k[j + 1][0])
              for j in range(last_r)] +
             [(f[j][last_c], f[j + 1][last_c], k[j + 1][last_c],
               k[j][last_c]) for j in range(last_r)])
    for q in edges:
        cloth.append(b.face(list(q), trim))
    bmesh.ops.recalc_face_normals(b.bm, faces=[f for f in cloth if f])
    if emblem:
        # A crown: a band with three points, on both faces.
        pts = [(-0.5, 0.0), (0.5, 0.0), (0.5, 0.55), (0.62, 1.0),
               (0.28, 0.62), (0.0, 1.12), (-0.28, 0.62), (-0.62, 1.0),
               (-0.5, 0.55)]
        s = width * 0.3
        cz = -length * 0.56
        for side in (1, -1):
            vs = []
            for px, pz in pts:
                x, z = px * s, cz + pz * s
                y = cloth_y(x, z, width, length) + side * (thick / 2 + 0.004)
                vs.append(b.vert((ox + x, oy + y, oz + z)))
            if side == 1:
                vs.reverse()
            fa = b.face(vs, trim)
            if fa:
                bmesh.ops.triangulate(b.bm, faces=[fa], ngon_method="EAR_CLIP")


def banner_post():
    """A tall dark-oak banner pole with a braced arm, brass finial and caps,
    footing stones, and a team banner with gilt trim and crown."""
    name = "banner-post"
    b = fk.Builder(name + "-pole")
    fk.tube(b, [Vector((0, 0, -0.12)), Vector((0, 0, 1.3)),
                Vector((0, 0, 2.5))], lambda t: 0.055 - 0.012 * t, 8,
            OAKWOOD, noise_amp=0.03, seed=4)
    fk.tube(b, [Vector((-0.04, 0, 2.14)), Vector((0.86, 0, 2.14))],
            lambda t: 0.032, 6, OAKWOOD)
    fk.tube(b, [Vector((0.02, 0, 1.74)), Vector((0.36, 0, 2.12))],
            lambda t: 0.02, 5, OAKWOOD)
    # Brass: the end cap, a collar and the finial (ball and spear point).
    fk.foam(b, (0.88, 0, 2.14), 0.045, 1, BRASS, sub=2, rough=0, crumb=0,
            squash=1)
    fk.revolve(b, [(0.05, 2.2), (0.06, 2.21), (0.06, 2.27), (0.05, 2.28)], 8,
               BRASS)
    fk.revolve(b, [(0.046, 2.49), (0.07, 2.53), (0.075, 2.58), (0.05, 2.63),
                   (0.03, 2.66), (0.045, 2.7), (0.0, 2.86)], 8, BRASS)
    for x in (0.12, 0.47, 0.8):
        fk.revolve(b, [(0.04, 2.125), (0.04, 2.155)], 6, BRASS,
                   vert=lambda j, k, p, x=x: Vector((p.x + x, p.y * 0.9,
                                                     p.z)))
    stones(b, 9, 5, 0.14, 0.15)
    tree = fk.bvh(b)
    fk.moss_on(b, tree, 9, 3, (-0.35, -0.35, 0.35, 0.35), 0.08, MOSS,
               min_nz=0.5)
    pole = b.build(smooth=45)
    fk.drop_buried(pole)
    fb = fk.Builder(name + "-flag")
    banner(fb, 0.62, 1.1, (0.47, 0.0, 2.11))
    flag = fb.build(smooth=50)
    return finish(kit.empty(name), [pole, flag])


# ---------------------------------------------------------------- new pieces

def fence_wood():
    """A split-rail fence panel along x (2.3 m), three hewn posts, two
    rails, a tuft at each foot: instanced end to end along the field."""
    name = "fence-wood"
    rnd = random.Random(33)
    b = fk.Builder(name + "-timber")
    posts = (-1.1, 0.0, 1.1)
    for i, x in enumerate(posts):
        hgt = rnd.uniform(0.98, 1.08)
        fk.tube(b, [Vector((x, 0, -0.12)), Vector((x + rnd.uniform(-0.02, 0.02),
                                                  0, hgt * 0.6)),
                    Vector((x + rnd.uniform(-0.03, 0.03), 0, hgt))],
                lambda t: 0.065, 5, OAKWOOD, cap="point", noise_amp=0.12,
                seed=33 + i, twist=0.3)
    for k, z in enumerate((0.42, 0.78)):
        sag = rnd.uniform(0.01, 0.04)
        pts = [Vector((-1.2 + 2.4 * i / 6, 0.075 * (1 if k else -1),
                       z - sag * math.sin(math.pi * i / 6) +
                       rnd.uniform(-0.01, 0.01))) for i in range(7)]
        fk.tube(b, pts, lambda t: 0.045, 4, TIMBER, cap="flat",
                noise_amp=0.15, seed=50 + k, twist=0.5)
    for i, x in enumerate(posts):
        sub = fk.Builder("__tuft")
        fk.tuft(sub, 70 + i, 16, 0.22, [TUFT, TUFT_DRY], [3, 2], width=0.02,
                root=0.08, sink=0.03)
        b.merge(sub.bm, TUFT, Matrix.Translation((x, 0.02, 0)),
                mats=sub.mats)
        sub.bm.free()
    obj = b.build(smooth=40)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def bale(b, size, matrix, seed):
    """A tied bale of hay: a puffy rounded block, loose straws, two twine
    bands."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3,
                              use_grid_fill=True)
    off = fk.rvec(rnd)
    sx, sy, sz = size
    for v in bm.verts:
        d = v.co * 2
        p = 6.0
        n = (abs(d.x) ** p + abs(d.y) ** p + abs(d.z) ** p) ** (1 / p)
        d = d / max(n, 1e-6)
        q = Vector((d.x * sx / 2, d.y * sy / 2, d.z * sz / 2))
        q *= 1 + 0.035 * noise.noise(q * 5 + off)
        v.co = q + Vector((0, 0, sz / 2 - 0.03))
    faces = b.merge(bm, HAY, matrix)
    bm.free()
    for f in faces:
        b.planar(f, 1.8)
    # Loose straws poking out of the sides.
    for _ in range(26):
        u = Vector((rnd.uniform(-0.5, 0.5) * sx, rnd.choice((-1, 1)) * sy / 2
                    * 0.98, rnd.uniform(0.1, 0.9) * sz))
        if rnd.random() < 0.4:
            u = Vector((rnd.choice((-1, 1)) * sx / 2 * 0.98,
                        rnd.uniform(-0.5, 0.5) * sy, rnd.uniform(0.1, 0.9)
                        * sz))
        out = Vector((u.x / sx, u.y / sy, 0)).normalized()
        tip = u + out * rnd.uniform(0.05, 0.12) + Vector((
            rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05),
            rnd.uniform(-0.04, 0.06)))
        fk.fibre(b, matrix @ (u - out * 0.02), matrix @ tip, 0.012, STRAW)
    for x in (-sx * 0.27, sx * 0.27):
        loop = []
        for k in range(13):
            a = k / 12 * TAU
            loop.append(matrix @ Vector((
                x, math.cos(a) * sy / 2 * 1.015,
                sz / 2 - 0.03 + math.sin(a) * sz / 2 * 1.02)))
        fk.tube(b, loop, lambda t: 0.012, 4, ROPE)


def haybale():
    """Two bales of hay, one leaning on the other."""
    name = "haybale"
    b = fk.Builder(name + "-hay")
    bale(b, (1.05, 0.58, 0.5), Matrix.Rotation(0.05, 4, "Z"), 41)
    bale(b, (1.0, 0.56, 0.48),
         Matrix.Translation((0.3, 0.52, -0.02)) @
         Matrix.Rotation(0.55, 4, "Z") @ Matrix.Rotation(0.06, 4, "X"), 42)
    obj = b.build(smooth=45)
    fk.drop_buried(obj)
    return finish(kit.empty(name), [obj])


def well():
    """A village well: a round wall of coursed stone with a coping, dark
    water, two posts and a little plank roof over a windlass and bucket."""
    name = "well"
    b = fk.Builder(name + "-stone")
    rnd = random.Random(51)

    def rough(j, k, p):
        if 1 <= k <= 4:
            r = math.hypot(p.x, p.y)
            a = math.atan2(p.y, p.x)
            r += 0.012 * noise.noise(Vector((a * 3, p.z * 6, 1.3)))
            return Vector((math.cos(a) * r, math.sin(a) * r, p.z))
        return p
    fk.revolve(b, [(0.74, -0.1), (0.76, 0.05), (0.75, 0.35), (0.74, 0.6),
                   (0.8, 0.62), (0.81, 0.72), (0.77, 0.75), (0.56, 0.75),
                   (0.54, 0.7), (0.52, 0.2)], 24, STONE, u_reps=4,
               vert=rough)
    water = [b.vert((math.cos(j / 16 * TAU) * 0.53,
                     math.sin(j / 16 * TAU) * 0.53, 0.3)) for j in range(16)]
    b.face(water, WATER)
    # Moss on the coping.
    tree = fk.bvh(b)
    fk.moss_on(b, tree, 51, 5, (-0.8, -0.8, 0.8, 0.8), 0.08, MOSS,
               min_nz=0.7, cluster=0.15)
    stone = b.build(smooth=35)
    fk.drop_buried(stone)
    w = fk.Builder(name + "-timber")
    for x in (-0.72, 0.72):
        fk.box(w, (0.1, 0.1, 1.95), OAKWOOD,
               Matrix.Translation((x, 0, 0.9)), bevel=0.01)
    # Windlass with a crank, the rope and the bucket.
    fk.tube(w, [Vector((-0.68, 0, 1.4)), Vector((0.68, 0, 1.4))],
            lambda t: 0.055, 8, TIMBER, cap="flat")
    fk.tube(w, [Vector((0.77, 0, 1.4)), Vector((0.84, 0, 1.4)),
                Vector((0.84, 0, 1.24)), Vector((0.95, 0, 1.24))],
            lambda t: 0.014, 4, IRON)
    fk.revolve(w, [(0.062, -0.12), (0.062, 0.12)], 10, ROPE,
               vert=lambda j, k, p: Vector((p.z, p.y, -p.x + 1.4)))
    fk.tube(w, [Vector((0.0, -0.06, 1.38)), Vector((0.0, -0.06, 0.95))],
            lambda t: 0.01, 4, ROPE)
    fk.revolve(w, [(0.0, 0.62), (0.11, 0.62), (0.13, 0.82), (0.115, 0.82),
                   (0.1, 0.66)], 10, TIMBER,
               vert=lambda j, k, p: p + Vector((0.0, -0.06, 0.13)))
    fk.revolve(w, [(0.125, 0.9), (0.135, 0.92), (0.135, 0.94)], 10, IRON,
               vert=lambda j, k, p: p + Vector((0.0, -0.06, 0.0)))
    fk.tube(w, [Vector((-0.13, -0.06, 0.95)), Vector((0, -0.06, 1.1)),
                Vector((0.13, -0.06, 0.95))], lambda t: 0.007, 4, IRON)
    # The roof: a ridge beam and two sloping plank panels.
    fk.box(w, (1.7, 0.08, 0.08), OAKWOOD,
           Matrix.Translation((0, 0, 2.3)), bevel=0.01)
    for s in (-1, 1):
        m = Matrix.Translation((0, s * 0.36, 2.1)) @ \
            Matrix.Rotation(s * 0.62, 4, "X")
        for k in range(4):
            fk.box(w, (1.85, 0.2, 0.035), TIMBER if k % 2 else OAKWOOD,
                   m @ Matrix.Translation((rnd.uniform(-0.02, 0.02),
                                           (k - 1.5) * 0.205, 0)),
                   bevel=0.006)
    timber = w.build(smooth=40)
    fk.drop_buried(timber)
    return finish(kit.empty(name), [stone, timber])


def wheel(b, centre, radius, seed, spokes=8, width=0.08):
    """A cart wheel standing in the xz plane: rim, hub, spokes."""
    c = Vector(centre)
    rot = Matrix.Rotation(math.pi / 2, 4, "X")
    m = Matrix.Translation(c) @ rot
    fk.revolve(b, [(radius - 0.06, -width / 2), (radius, -width / 2),
                   (radius, width / 2), (radius - 0.06, width / 2),
                   (radius - 0.06, -width / 2)], 16, TIMBER,
               vert=lambda j, k, p: m @ p)
    fk.revolve(b, [(0.0, -0.1), (0.07, -0.1), (0.09, -0.05), (0.09, 0.05),
                   (0.07, 0.1), (0.0, 0.1)], 8, OAKWOOD,
               vert=lambda j, k, p: m @ p)
    fk.revolve(b, [(0.093, -0.035), (0.093, 0.035)], 8, IRON,
               vert=lambda j, k, p: m @ p)
    fk.revolve(b, [(radius + 0.004, -width / 2 - 0.004),
                   (radius + 0.012, -width / 2 + 0.01),
                   (radius + 0.012, width / 2 - 0.01),
                   (radius + 0.004, width / 2 + 0.004)], 16, IRON,
               vert=lambda j, k, p: m @ p)
    for k in range(spokes):
        a = k / spokes * TAU + seed
        d = Vector((math.cos(a), 0, math.sin(a)))
        fk.tube(b, [c + d * 0.08, c + d * (radius - 0.05)],
                lambda t: 0.022 - 0.006 * t, 3, OAKWOOD)


def cart():
    """A two-wheeled hand cart tipped forward onto its shafts, carrying two
    sacks: its bed runs along x, the wheels at its middle."""
    name = "cart"
    b = fk.Builder(name + "-wood")
    R = 0.5
    wy = 0.52
    for s in (-1, 1):
        wheel(b, (0.0, s * wy, R - 0.03), R, 0.2 * s)
    fk.tube(b, [Vector((0, -wy - 0.08, R - 0.03)),
                Vector((0, wy + 0.08, R - 0.03))], lambda t: 0.035, 6, IRON)
    # The body pivots on the axle until the shafts touch the ground.
    pitch = math.atan2(R + 0.12, 2.0)
    pivot = Matrix.Translation((0, 0, R - 0.03)) @ \
        Matrix.Rotation(pitch, 4, "Y") @ Matrix.Translation((0, 0, 0.12))
    for k in range(4):
        y = -0.36 + 0.24 * k
        fk.box(b, (1.5, 0.22, 0.05), TIMBER if k % 2 else OAKWOOD,
               pivot @ Matrix.Translation((-0.1, y, 0.0)))
    for s in (-1, 1):
        for k, z in enumerate((0.1, 0.27)):
            fk.box(b, (1.5, 0.035, 0.12), OAKWOOD,
                   pivot @ Matrix.Translation((-0.1, s * 0.47, z + 0.03)),
                   bevel=0.006)
        for x in (-0.8, -0.3, 0.25, 0.62):
            fk.box(b, (0.05, 0.05, 0.4), OAKWOOD,
                   pivot @ Matrix.Translation((x, s * 0.5, 0.17)),
                   bevel=0.006)
        fk.tube(b, [pivot @ Vector((-0.6, s * 0.3, -0.06)),
                    pivot @ Vector((0.7, s * 0.3, -0.06)),
                    pivot @ Vector((2.05, s * 0.26, -0.06))],
                lambda t: 0.04 - 0.012 * t, 5, OAKWOOD, cap="flat")
    fk.box(b, (0.05, 0.98, 0.3), TIMBER,
           pivot @ Matrix.Translation((-0.84, 0, 0.17)), bevel=0.006)
    wood = b.build(smooth=40)
    fk.drop_buried(wood)
    s = fk.Builder(name + "-load")
    for k, (x, y, r) in enumerate(((-0.4, -0.12, 0.26), (0.05, 0.16, 0.24))):
        at = pivot @ Vector((x, y, 0.2))
        fk.foam(s, at, r, 70 + k, SACK, sub=1, rough=0.12, crumb=0.04,
                squash=0.62, under=0.35, scale=(1.3, 0.9, 1.0))
    load = s.build(smooth=60)
    return finish(kit.empty(name), [wood, load])


def tent():
    """A round medieval pavilion: canvas walls and a conical roof on one
    pole, a scalloped team valance, an open door, a team pennant and guy
    ropes to pegs."""
    name = "tent"
    b = fk.Builder(name + "-canvas")
    Rw, Rr = 1.2, 1.38
    segs = 20
    door = -math.pi / 2

    def sag(j, k, p):
        a = math.atan2(p.y, p.x)
        r = math.hypot(p.x, p.y)
        r *= 1 - 0.018 * (0.5 + 0.5 * math.cos(segs / 2 * a))
        return Vector((math.cos(a) * r, math.sin(a) * r, p.z))
    rings = fk.revolve(b, [(Rw * 1.03, -0.06), (Rw, 0.6), (Rw * 0.99, 1.38)],
                       segs, CANVAS, vert=sag, seam=door - TAU / segs * 1.5)
    # The door: three bays of the wall open onto the dark inside.
    for f in list(b.bm.faces):
        c = f.calc_center_median()
        a = math.atan2(c.y, c.x)
        if abs((a - door + math.pi) % TAU - math.pi) < 0.34 and c.z < 1.2:
            f.material_index = b.mat(SHADE)
    fk.revolve(b, [(Rr, 1.36), (Rr * 0.72, 1.75), (0.3, 2.35),
                   (0.06, 2.62)], segs, CANVAS, vert=sag,
               seam=door - TAU / segs * 1.5)
    # Tied-back door flaps.
    for s in (-1, 1):
        a = door + s * 0.36
        base = Vector((math.cos(a) * (Rw + 0.02), math.sin(a) * (Rw + 0.02),
                       0))
        side = Vector((-math.sin(a), math.cos(a), 0)) * s
        outward = Vector((math.cos(a), math.sin(a), 0))
        corners = [base + Vector((0, 0, 1.3)),
                   base + side * 0.28 + Vector((0, 0, 0.05)),
                   base + side * 0.1 + Vector((0, 0, 0.05)) + outward * 0.06]
        for lift, order in ((0.006, (0, 1, 2)), (-0.006, (0, 2, 1))):
            vs = [b.vert(corners[i] + outward * lift) for i in order]
            f = b.face(vs, CANVAS)
            if f:
                f.normal_update()
                if f.normal.dot(outward) * lift < 0:
                    f.normal_flip()
    del rings
    canvas = b.build(smooth=35)
    fk.drop_buried(canvas)
    t = fk.Builder(name + "-team")
    # The valance: a scalloped band hanging from the roof's edge.
    tile = fk.tile_of(TEAM)
    outer, inner = [], []
    for j in range(segs * 2 + 1):
        a = j / (segs * 2) * TAU
        scallop = 0.08 + 0.1 * abs(math.sin(a * segs / 2))
        for lst, r in ((outer, Rr + 0.012), (inner, Rr - 0.01)):
            lst.append((t.vert((math.cos(a) * r, math.sin(a) * r, 1.37)),
                        t.vert((math.cos(a) * r, math.sin(a) * r,
                                1.37 - 0.12 - scallop))))
    for j in range(segs * 2):
        u0, u1 = j / (segs * 2) * TAU * Rr / tile, \
            (j + 1) / (segs * 2) * TAU * Rr / tile
        (a0, b0), (a1, b1) = outer[j], outer[j + 1]
        t.face([b0, b1, a1, a0], TEAM, [(u0, 0), (u1, 0), (u1, 0.5),
                                         (u0, 0.5)])
        (a0, b0), (a1, b1) = inner[j], inner[j + 1]
        t.face([a0, a1, b1, b0], TEAM, [(u0, 0.5), (u1, 0.5), (u1, 0),
                                         (u0, 0)])
    banner(t, 0.36, 0.5, (0.2, 0.0, 3.08), emblem=False, thick=0.016,
           tail=0.3)
    team = t.build(smooth=40)
    p = fk.Builder(name + "-pole")
    fk.tube(p, [Vector((0, 0, 2.55)), Vector((0, 0, 3.1))],
            lambda t: 0.035, 6, OAKWOOD)
    fk.tube(p, [Vector((0, 0, 3.08)), Vector((0.4, 0, 3.08))],
            lambda t: 0.014, 4, OAKWOOD)
    fk.foam(p, (0, 0, 3.16), 0.055, 3, BRASS, sub=2, rough=0, crumb=0,
            squash=1)
    for k in range(6):
        a = k / 6 * TAU + 0.26
        top = Vector((math.cos(a) * (Rr - 0.02), math.sin(a) * (Rr - 0.02),
                      1.36))
        peg = Vector((math.cos(a) * 2.05, math.sin(a) * 2.05, 0.04))
        fk.tube(p, [top, top.lerp(peg, 0.5) - Vector((0, 0, 0.04)), peg],
                lambda t: 0.008, 3, ROPE)
        fk.tube(p, [peg - Vector((0, 0, 0.1)), peg + Vector((0, 0, 0.07))],
                lambda t: 0.018, 4, OAKWOOD, cap="flat")
    pole = p.build(smooth=40)
    fk.drop_buried(pole)
    return finish(kit.empty(name), [canvas, team, pole])


# ---------------------------------------------------------------- studio

_LINEAR = set()
# Preview-only floor tint (never exported): the plinth's mossy turf.
kit.TINTS["preview-turf"] = (0.56, 0.5, 0.36)


def linearise_tints():
    """The game reads tints as sRGB; Blender's RGB nodes take linear values.
    Convert them (once per material) so stills match the game's colours, and
    tame the flame, which the game lights on its own. Tints registered with
    kit.tint() are already linear."""
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    for m in bpy.data.materials:
        if m.name in _LINEAR or not m.node_tree or ":" not in m.name:
            continue
        _LINEAR.add(m.name)
        name = m.name.partition(":")[2]
        tint_rgb = kit.TINTS.get(name, (0.8, 0.8, 0.8))
        rgb = (*(tint_rgb if name in kit.HEX else (lin(c) for c in tint_rgb)),
               1)
        for node in m.node_tree.nodes:
            if node.type == "RGB":
                node.outputs[0].default_value = rgb
            if node.type == "BSDF_PRINCIPLED":
                if m.name.startswith(("fire", "glow")):
                    node.inputs["Emission Color"].default_value = rgb
                    node.inputs["Emission Strength"].default_value = 2.0
                if m.name.startswith("plain:water"):
                    node.inputs["Roughness"].default_value = 0.08


def graphite_world(scene):
    """A graphite void to the camera, a soft grey studio light to the
    scene."""
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    lit = nt.nodes.new("ShaderNodeBackground")
    lit.inputs[0].default_value = (0.62, 0.64, 0.68, 1)
    lit.inputs[1].default_value = 0.8
    void = nt.nodes.new("ShaderNodeBackground")
    void.inputs[0].default_value = (0.03, 0.03, 0.033, 1)
    void.inputs[1].default_value = 1.0
    path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(path.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(lit.outputs[0], mix.inputs[1])
    nt.links.new(void.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])


def sun(name, direction, energy, colour, angle):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    data.color = colour
    data.angle = math.radians(angle)
    obj = bpy.data.objects.new(name, data)
    obj.rotation_euler = Vector(direction).normalized().to_track_quat(
        "Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(obj)
    return obj


def studio(path, roots, width=1600, elevation=32, azimuth=-20, margin=1.08,
           samples=64, markers=(), lens=None, floor="grass:preview-turf"):
    """A preview framed tightly on `roots` (and markers): orthographic, or
    perspective with `lens` degrees of field of view. Everything else is
    hidden from the render. Graphite studio, key light from the upper left
    of the frame, a cool rim light from behind."""
    scene = bpy.context.scene
    kit.gpu()
    kit.refresh()
    scene.cycles.samples = samples
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    graphite_world(scene)
    shown = set()
    for r in roots:
        shown.update(kit.descendants(r))
    shown.update(markers)
    hidden = []
    for o in scene.objects:
        if o.type == "MESH" and o not in shown and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    pts = []
    for o in shown:
        if o.type == "MESH":
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    el, az = math.radians(elevation), math.radians(azimuth)
    back = Vector((-math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el),
                   math.sin(el)))
    rot = (-back).to_track_quat("-Z", "Y").to_matrix()
    inv = rot.transposed()
    local = [inv @ p for p in pts]
    xs, ys = [q.x for q in local], [q.y for q in local]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    depth = sum(q.z for q in local) / len(local)
    target = rot @ Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2,
                           depth))
    aspect = max(0.35, min(1.6, h / max(w, 1e-3)))
    scene.render.resolution_x = width
    scene.render.resolution_y = int(width * aspect)
    cam_data = bpy.data.cameras.new("studio")
    cam_data.clip_end = 1000
    span = (max(h, w * aspect) if aspect >= 1 else max(w, h / aspect)) * margin
    cam = bpy.data.objects.new("studio-cam", cam_data)
    scene.collection.objects.link(cam)
    if lens:
        cam_data.type = "PERSP"
        cam_data.sensor_fit = "AUTO"
        cam_data.angle = math.radians(lens)
        dist = span / 2 / math.tan(cam_data.angle / 2) + \
            (max(q.z for q in local) - depth)
        cam.location = target + back * dist
    else:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = span
        cam.location = target + back * 200
    cam.rotation_euler = rot.to_euler()
    scene.camera = cam
    # Key from the frame's upper left, rim from behind, both turned with
    # the camera.
    right = rot @ Vector((1, 0, 0))
    fwd = Vector((-back.x, -back.y, 0)).normalized()
    key = sun("studio-key", -right * 0.9 - fwd * 0.55 + Vector((0, 0, 1.25)),
              4.6, (1.0, 0.96, 0.9), 11)
    rim = sun("studio-rim", fwd * 1.0 + right * 0.3 + Vector((0, 0, 0.55)),
              1.6, (0.78, 0.86, 1.0), 6)
    cx = sum(p.x for p in pts) / len(pts)
    cy = sum(p.y for p in pts) / len(pts)
    ground = kit.box("__floor", (400, 400, 0.02), (cx, cy, -0.012),
                     mat=floor, grid=False)
    kit.uv_box(ground)
    kit.fill_ao([ground])
    linearise_tints()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (cam, key, rim, ground):
        bpy.data.objects.remove(o, do_unlink=True)
    for o in hidden:
        o.hide_render = False
    print("PREVIEW", path)


def knight_marker(location):
    """A 1.3 m knight-sized stand-in for scale checks (never exported)."""
    x, y = location
    body = kit.cylinder("__knight-body", 0.24, 0.2, 0.8, (x, y, 0), verts=16,
                        mat="plain:team")
    head = kit.sphere("__knight-head", 0.26, (x, y, 1.04), mat="plain:steel",
                      segments=16, rings=10)
    kit.fill_ao([body, head])
    return [body, head]


def clone(root, location, turn=0.0, scale=1.0):
    """A linked copy of a prop for a preview scene (never exported)."""
    new = kit.empty("__" + root.name)
    for k in root.children:
        if k.type != "MESH":
            continue
        c = k.copy()
        bpy.context.scene.collection.objects.link(c)
        c.parent = new
        c.matrix_parent_inverse = k.matrix_parent_inverse.copy()
        c.matrix_basis = k.matrix_basis.copy()
    new.location = (*location, 0)
    new.rotation_euler = (0, 0, turn)
    new.scale = (scale, scale, scale)
    return new


def forest_group(by):
    """A corner of the board: a cobbled edge, then pines and oaks with
    bushes, rocks, tufts and flowers, a stump and a log, a torch and a
    banner post, seen at the game's height."""
    rnd = random.Random(5)
    group = []
    edge = kit.box("__cobble", (14, 1.6, 0.04), (0, -1.9, 0.0),
                   mat="stone:cool", grid=False)
    kit.uv_box(edge)
    kit.fill_ao([edge])
    spots = [
        ("tree-pine-1", (-4.6, 3.8), 1.0), ("tree-pine-2", (-2.6, 5.2), 1.1),
        ("tree-oak-1", (0.3, 4.4), 1.0), ("tree-pine-1", (3.3, 5.6), 0.9),
        ("tree-oak-3", (5.2, 3.6), 1.0), ("tree-oak-2", (-6.2, 6.8), 1.0),
        ("tree-pine-2", (1.9, 7.6), 1.2), ("tree-oak-1", (-1.2, 8.2), 1.1),
        ("bush-1", (-2.3, 2.0), 1.1), ("bush-2", (1.9, 2.2), 1.0),
        ("bush-1", (4.1, 1.5), 0.9), ("bush-2", (-5.4, 1.6), 1.2),
        ("rock-4", (-0.9, 1.7), 0.8), ("rock-2", (3.1, 0.6), 0.9),
        ("rock-1", (-3.9, 0.7), 1.0), ("rock-3", (6.2, 1.2), 0.9),
        ("stump", (-1.2, 0.3), 1.0), ("log", (1.0, 0.8), 1.0),
        ("torch", (-5.8, -0.3), 1.0), ("banner-post", (5.4, -0.4), 1.0),
        ("barrel", (-6.6, -0.1), 1.0), ("crate", (-6.8, 0.8), 1.0),
    ]
    for name, (x, y), s in spots:
        group.append(clone(by[name], (x, y), rnd.uniform(0, TAU), s))
    for i in range(46):
        x, y = rnd.uniform(-7, 7), rnd.uniform(-0.8, 3.5)
        name = "tufts" if rnd.random() < 0.72 else rnd.choice(
            ("flowers-1", "flowers-2"))
        group.append(clone(by[name], (x, y), rnd.uniform(0, TAU),
                           rnd.uniform(0.8, 1.4)))
    marker = knight_marker((-3.0, -1.4))
    return group, [edge] + marker


# ---------------------------------------------------------------- build

LAYOUT = [
    (oak_1, (0, 0)), (oak_2, (6.5, 0)), (oak_3, (12.5, 0)),
    (pine_1, (17.5, 0)), (pine_2, (22, 0)),
    (cliff_1, (0, -7)), (cliff_2, (6, -7)), (rock_4, (10.5, -7)),
    (rock_3, (13.5, -7)), (rock_2, (16, -7)), (rock_1, (18, -7)),
    (bush_1, (20, -7)), (bush_2, (22.3, -7)),
    (tufts, (0, -11)), (flowers_1, (0.9, -11)), (flowers_2, (1.8, -11)),
    (stump, (3.2, -11)), (log, (5.6, -11)), (barrel, (8.2, -11)),
    (crate, (9.6, -11)), (torch, (11.1, -11)), (banner_post, (12.6, -11)),
    (fence_wood, (15.6, -11)), (haybale, (18.6, -11)), (well, (21.2, -11)),
    (cart, (2.0, -15)), (tent, (7.0, -15)),
]

roots, meshes, offsets = [], [], []
for build, offset in LAYOUT:
    root, objs = build()
    roots.append(root)
    meshes += objs
    offsets.append(offset)
    root.location = (*offset, 0)

# Far versions of the trees, for the back and sides of the valley where a
# tree covers a few dozen pixels: the same tree with its meshes collapsed to
# about 40% of the triangles, before the normals and AO are made, so
# they shade and darken exactly like the near ones.
FAR_RATIO = {"-trunk": 0.3, "-canopy": 0.42, "-crown": 0.42}
for root, offset in list(zip(roots, offsets)):
    if not root.name.startswith("tree-"):
        continue
    copy = kit.empty(root.name + "-far", location=(*offset, 0))
    parts = []
    kit.refresh()
    for o in kit.descendants(root)[1:]:
        if o.type != "MESH":
            continue
        part = o.name[len(root.name):]
        dup = o.copy()
        dup.data = o.data.copy()
        bpy.context.scene.collection.objects.link(dup)
        dup.name = copy.name + part
        dup.data.name = dup.name
        mod = dup.modifiers.new("far", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.use_collapse_triangulate = True
        mod.ratio = FAR_RATIO.get(part, 0.4)
        kit.apply(dup)
        if o.name in NORMALS:
            NORMALS[dup.name] = NORMALS[o.name]
        if o.name in LIGHT:
            LIGHT[dup.name] = LIGHT[o.name]
        parts.append(dup)
    finish(copy, parts)
    copy.location = (offset[0], offset[1] + 7.5, 0)
    roots.append(copy)
    meshes += parts
    offsets.append((offset[0], offset[1] + 7.5))

kit.refresh()
over = []
for r in roots:
    n = fk.tri_count(r)
    budget = next((b for k, b in BUDGET.items() if r.name.startswith(k)),
                  SMALL_BUDGET)
    flag = "" if n <= budget else f"  OVER BUDGET ({budget})"
    if flag:
        over.append(r.name)
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in kit.descendants(r):
        if o.type == "MESH":
            for c in o.bound_box:
                p = r.matrix_world.inverted() @ (o.matrix_world @ Vector(c))
                lo = Vector(map(min, lo, p))
                hi = Vector(map(max, hi, p))
    kids = sorted(o.name for o in kit.descendants(r)[1:])
    size = hi - lo
    print(f"PROP {r.name}: {n} triangles{flag}  size "
          f"{size.x:.2f} x {size.y:.2f} x {size.z:.2f}  x {lo.x:.2f}..{hi.x:.2f}"
          f" y {lo.y:.2f}..{hi.y:.2f} z {lo.z:.2f}..{hi.z:.2f}  {kids}")
if over:
    print("OVER BUDGET:", ", ".join(over))

for m in meshes:
    if m.name in NORMALS:
        fk.set_normals(m, NORMALS[m.name])
kit.bake_ao(meshes, samples=96, distance=0.5)
for m in meshes:
    if m.name.endswith(("-canopy", "-crown", "-leaves", "-load")):
        fk.smooth_ao(m, floor=0.3)
    if m.name in LIGHT:
        fk.light_ao(m, LIGHT[m.name])
    elif m.name in ("tufts-grass", "flowers-1-bloom", "flowers-2-bloom"):
        fk.height_ao(m, 0.3, lo=0.6, hi=1.0)

for r in roots:
    r.location = (0, 0, 0)
out = kit.out_path()
argv = sys.argv
rest = argv[argv.index("--") + 1:] if "--" in argv else []
if out:
    kit.export(roots, out)
if len(rest) > 1:
    preview = rest[1]
    quick = "quick" in rest[2:]
    for r, offset in zip(roots, offsets):
        r.location = (*offset, 0)
    kit.refresh()
    studio(preview, roots, width=1800, elevation=34, azimuth=-18)
    if not quick:
        base = preview[:-4] if preview.endswith(".png") else preview
        by = {r.name: r for r in roots}
        groups = {
            "trees": (["tree-oak-1", "tree-oak-2", "tree-oak-3", "tree-pine-1",
                       "tree-pine-2"], (2.8, -1.8), 20, -12),
            "rocks": (["cliff-1", "cliff-2", "rock-4", "rock-3", "rock-2",
                       "rock-1", "bush-1", "bush-2"], (3.1, -9.0), 30, -10),
            "props": (["stump", "log", "barrel", "crate", "torch",
                       "banner-post"], (7.0, -11.9), 24, -8),
            "cover": (["tufts", "flowers-1", "flowers-2"], None, 30, -8),
            "medieval": (["fence-wood", "haybale", "well", "cart", "tent"],
                         (13.5, -13.0), 34, -10),
            "far": (["tree-oak-1", "tree-oak-1-far", "tree-oak-2",
                     "tree-oak-2-far", "tree-pine-1", "tree-pine-1-far"],
                    None, 30, -12),
            "oak": (["tree-oak-1"], None, 30, -20),
            "pine": (["tree-pine-1"], None, 30, -20),
            "bush": (["bush-1", "bush-2", "rock-2"], None, 38, -15),
        }
        views = next((a[6:].split(",") for a in rest[2:]
                      if a.startswith("views=")), None)
        for label, (names, spot, el, az) in groups.items():
            if views and label not in views:
                continue
            marker = knight_marker(spot) if spot else []
            studio(f"{base}-{label}.png", [by[n] for n in names],
                   width=1600, elevation=el, azimuth=az, markers=marker)
            for m in marker:
                bpy.data.objects.remove(m, do_unlink=True)
        # The game's view of a forest corner, away from the line-up.
        if views and "game" not in views:
            sys.exit(0)
        for r in roots:
            r.location = (0, 0, -500)
        kit.refresh()
        group, extra = forest_group(by)
        studio(f"{base}-game.png", group, width=1800, elevation=45,
               azimuth=0, lens=40, markers=extra, margin=1.02)
