"""Rota's nature and small props for the model-railway layout.

Clump-foam trees on twisted armature trunks, foam bushes and hedges, flock
flowers and water-edge reeds, painted resin rocks, mountains with snow caps
and scree, a rock-fall pile, and the small railway and road props (buffer
stop, road barrier, fingerpost, semaphore signal, street lamp, round hay
bale, jetty, survey stake). See docs/concepts/2026-10-02-rota-3d/brief.md.

Every asset is a root empty at its footprint centre, base on z = 0, fronts
facing -Y, meshes as children. The organic pieces are built at a work scale
with Arena's forest kit and shrunk to size (nature_kit.py).

  Blender -b --factory-startup --python assets/rota/blender/nature.py -- \\
      assets/rota/build/nature.glb [preview.png] [only=a,b] [views=x,y]
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402

import nature_kit as nk  # noqa: E402

kit = nk.kit
fk = nk.fk
TAU = math.tau
UP = Vector((0, 0, 1))

nk.rkit.reset(seed=11)

# ---------------------------------------------------------------- palette
# Sage, olive and deep greens; warm resin greys; white snow.

T = nk.tint
OAK_A = ("foliage:" + T("oak", "#62804a"), "foliage:" + T("oak-tip", "#8ea561"))
OAK_B = ("foliage:" + T("olive", "#6f8550"),
         "foliage:" + T("olive-tip", "#9dac6c"))
OAK_C = ("foliage:" + T("holm", "#536f43"),
         "foliage:" + T("holm-tip", "#7f985e"))
BIRCH = ("foliage:" + T("birch", "#7f9852"),
         "foliage:" + T("birch-tip", "#a9b673"))
POPLAR = ("foliage:" + T("poplar", "#5b7845"),
          "foliage:" + T("poplar-tip", "#87a05f"))
PINE = ("foliage:" + T("pine", "#3f5d43"), "foliage:" + T("pine-tip", "#6f8a5c"))
SPRUCE = ("foliage:" + T("spruce", "#38533f"),
          "foliage:" + T("spruce-tip", "#64805a"))
BUSH_A = ("foliage:" + T("bush", "#5f7b46"),
          "foliage:" + T("bush-tip", "#8aa15f"))
BUSH_B = ("foliage:" + T("bramble", "#738a4f"),
          "foliage:" + T("bramble-tip", "#9eab6c"))
HEDGE = ("foliage:" + T("hedge", "#4f6c3e"),
         "foliage:" + T("hedge-tip", "#789557"))
MOSS = "foliage:" + T("moss", "#7c8a52")
MOSS_DRY = "foliage:" + T("moss-dry", "#9f9c66")
FOREST = "foliage:" + T("forest", "#4a6340")
BARK = "bark:" + T("bark", "#6f5b49")
BARK_PINE = "bark:" + T("bark-pine", "#76604b")
BARK_BIRCH = "bark:" + T("birch-bark", "#ebe7de")
BARK_MARK = "bark:" + T("birch-mark", "#3d3834")
CATTAIL = "bark:" + T("cattail", "#5f4532")
TUFT = "grass:" + T("tuft", "#93a061")
TUFT_DRY = "grass:" + T("tuft-dry", "#c2b47a")
TUFT_DEEP = "grass:" + T("tuft-deep", "#71834c")
REED = "grass:" + T("reed", "#7f9354")
REED_DRY = "grass:" + T("reed-dry", "#b9ab6e")
ALP = "grass:" + T("alp", "#8a9a5b")
HAY = "grass:" + T("hay", "#d3b56d")
ROCK = "rock:" + T("rock", "#a59d91")
ROCK_DK = "rock:" + T("rock-dark", "#8b8378")
CRAG = "rock:" + T("crag", "#9d958a")
CRAG_DK = "rock:" + T("crag-dark", "#827a70")
SCREE = "rock:" + T("scree", "#b2aa9c")
FRESH = "rock:" + T("fresh", "#bdb5a7")
DUST = "sand:" + T("dust", "#c9bda5")
SNOW = "plaster:" + T("snow", "#f6f5f1")
DRY_A = "stone:" + T("drystone", "#a69d8d")
DRY_B = "stone:" + T("drystone-dark", "#8a8276")
DRY_C = "stone:" + T("drystone-light", "#bdb39f")
DRY_D = "stone:" + T("drystone-lichen", "#9b9a83")
JETTY = "wood:" + T("jetty", "#8a735a")
JETTY_DK = "wood:" + T("jetty-dark", "#6f5d4b")
JETTY_LT = "wood:" + T("jetty-light", "#a08a6e")
PEG = "wood:" + T("peg", "#c4a57c")
POST = "wood:" + T("post", "#7b6752")
RED = "paint:" + T("red", "#b5302a")
WHITE = "paint:" + T("white", "#f1eee6")
BLACK = "paint:" + T("black", "#26272a")
LAMP_GREEN = "paint:" + T("lamp-green", "#2e3d35")
PETALS = ["foliage:" + T("petal-white", "#ece8dc"),
          "foliage:" + T("petal-yellow", "#e2bd4a"),
          "foliage:" + T("petal-pink", "#d48aa0"),
          "foliage:" + T("petal-violet", "#8f7fbf"),
          "foliage:" + T("petal-red", "#c4483c")]
IRON = "metal:" + T("iron", "#45484c")
STEEL = "metal:" + T("steel", "#9aa0a6")
CONCRETE = "stone:" + T("concrete", "#b9b4a8")
GLOW_LAMP = "glow:lamp"
GLOW_RED = "glow:" + T("signal-red", "#ff4a32")
GLOW_GREEN = "glow:" + T("signal-green", "#5dff9a")
GLOW_AMBER = "glow:" + T("warning", "#ffad3a")
T("lamp", "#ffd58a")

# Per-mesh rules applied after the bake: fk.light_ao(LIGHT[name]) and
# custom normals NORMALS[name]; foliage meshes also get fk.smooth_ao.
LIGHT, NORMALS, SOFT = {}, {}, set()


def finish(name, meshes, scale=1.0, light=None, normals=None, soft=()):
    """Shrink a work-scale build, hang its meshes on a root empty and
    register its after-bake rules (written for work-scale coordinates)."""
    if scale != 1.0:
        nk.shrink(meshes, scale)
    root = kit.empty(name)
    for m in meshes:
        kit.parent(m, root)
    for k, fn in (light or {}).items():
        LIGHT[k] = nk.scaled_rule(fn, scale)
    for k, fn in (normals or {}).items():
        NORMALS[k] = nk.scaled_rule(fn, scale)
    SOFT.update(soft)
    return root, meshes


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- crowns

def nearest_head(heads, co):
    best = None
    for c, (rx, ry, rz) in heads:
        d = Vector(((co.x - c.x) / rx, (co.y - c.y) / ry, (co.z - c.z) / rz))
        if best is None or d.length < best[0].length:
            best = (d, (rx, ry, rz))
    return best


def crown_normals(heads, mix=0.6):
    def fn(co, n):
        d, (rx, ry, rz) = nearest_head(heads, co)
        g = Vector((d.x / rx, d.y / ry, d.z / rz))
        if g.length < 1e-6:
            return n
        return Vector(n) * (1 - mix) + g.normalized() * mix
    return fn


def crown_light(heads):
    def rule(co, n):
        d, _ = nearest_head(heads, co)
        up = 0.5 + 0.5 * n.z
        h = max(0.0, min(1.0, (d.z + 1) / 2))
        out = max(0.0, min(1.0, (d.length - 0.55) / 0.45))
        return 0.45 * up + 0.3 * h + 0.25 * out
    return rule


def grass_normals(co, n):
    out = Vector((co.x, co.y, 0))
    if out.length > 1e-6:
        out.normalize()
    return Vector((0, 0, 1)) + out * 0.25


def dust_tips(b, colours, shells, seed, bias=0.8):
    main, tip = colours
    guide = crown_normals(shells, mix=1.0)
    off = Vector((seed * 1.7, 3.1, 0.4))

    def lit(centre, normal):
        g = Vector(guide(centre, normal)).normalized()
        return g.z + 0.25 * Vector(normal).z > \
            bias + 0.3 * noise.noise(centre * 0.8 + off)
    fk.tint_tips(b, [main], tip, lit)


# ---------------------------------------------------------------- trees
# Built at S = 16: a 0.3 m tree is a 4.8 m work tree, like Arena's.

S_TREE = 16


def trunk_path(h, lean, sink=0.12, step=0.4):
    n = max(4, round((h + sink) / step))
    return [Vector((lean[0] * (i / n) ** 2, lean[1] * (i / n) ** 2,
                    -sink + (h + sink) * i / n)) for i in range(n + 1)]


def point_on(path, s):
    lengths = [0.0]
    for p, q in zip(path, path[1:]):
        lengths.append(lengths[-1] + (q - p).length)
    target = s * lengths[-1]
    for i in range(len(path) - 1):
        if lengths[i + 1] >= target:
            t = (target - lengths[i]) / max(1e-6, lengths[i + 1] - lengths[i])
            return path[i].lerp(path[i + 1], t)
    return path[-1].copy()


def root_spurs(b, seed, r0, count, mat):
    rnd = random.Random(seed)
    ph = rnd.uniform(0, TAU)
    for k in range(count):
        a = ph + k / count * TAU + rnd.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        L = 0.45 * rnd.uniform(0.75, 1.2)
        pts = [d * r0 * 0.5 + Vector((0, 0, 0.3)),
               d * (r0 * 0.9 + L * 0.35) + Vector((0, 0, 0.06)),
               d * (r0 + L) + Vector((0, 0, -0.1))]
        fk.tube(b, pts, lambda t: r0 * 0.4 * (1 - 0.7 * t), 4, mat,
                seed=seed + k)


def broadleaf(name, seed, h, r0, r1, lean, heads, colours, bark=BARK,
              clump=0.5, flare=0.8, nroots=4, budget=1490, voxel=0.07,
              marks=False, sides=7):
    """A model-railway armature tree: a twisted trunk forking into limbs,
    and a crown of big foam clumps glued on the limb ends and over the
    crown's shell, fused into one lumpy surface (no hidden insides), dark
    beneath and dusted light on top."""
    with nk.work(S_TREE):
        rnd = random.Random(seed)
        wood = fk.Builder(name + "-trunk")
        leaves = fk.Builder(name + "-canopy")
        main, tip = colours
        path = trunk_path(h, lean)
        top = path[-1]
        stems = []
        for hi, head in enumerate(heads):
            c = Vector(head["c"])
            start = top if hi == 0 else top - Vector((0, 0, 0.3))
            stems.append([Vector(q) for q in fk.polyline([
                start, top.lerp(c, 0.5) + Vector(head.get("kink", (0, 0, 0))),
                c + Vector((0, 0, head["r"][2] * 0.3))], 2)])
        full = path + stems[0][1:]

        def length(pts):
            return sum((q - p).length for p, q in zip(pts, pts[1:]))
        total = length(full)
        sf = length(path) / total
        sr0 = heads[0].get("stem", r1 * 0.85)
        ph = rnd.uniform(0, TAU)

        def radius(t):
            if t <= sf:
                return lerp(r0, r1, (t / sf) ** 0.75)
            u = (t - sf) / (1 - sf)
            return lerp(r1, sr0, min(1.0, u * 3)) * (1 - 0.65 * u)

        def shape(t, a):
            z = t * total - 0.12
            return 1 + flare * math.exp(-max(z, 0) / 0.3) * (
                0.2 + 0.8 * max(0.0, math.cos(nroots * a + ph)) ** 2)
        # A twist in the bark, like a model-maker's twisted wire armature.
        fk.tube(wood, full, radius, sides, bark, shape=shape, noise_amp=0.08,
                seed=seed, twist=1.4)
        root_spurs(wood, seed, r0, nroots - 1, bark)
        clumps = []
        for hi, head in enumerate(heads):
            c = Vector(head["c"])
            rx, ry, rz = head["r"]
            stem = stems[hi]
            sr = head.get("stem", r1 * 0.85)
            if hi:
                fk.tube(wood, stem, lambda t, sr=sr: sr * (1 - 0.65 * t), 6,
                        bark, noise_amp=0.04, seed=seed + 10 + hi)
            n = head["limbs"]
            hph = rnd.uniform(0, TAU)
            for k in range(n):
                az = hph + k / n * TAU + rnd.uniform(-0.3, 0.3)
                start = point_on(stem, rnd.uniform(0.15, 0.55))
                el = rnd.uniform(-0.3, 0.2) + head.get("lift", 0)
                reach = rnd.uniform(0.55, 0.7)
                end = c + Vector((math.cos(az) * rx * reach,
                                  math.sin(az) * ry * reach, rz * el))
                mid = start.lerp(end, 0.5) + Vector((0, 0, 0.1 + 0.12 * rz))
                limb = fk.polyline([start, mid, end], 2)
                lr = sr * rnd.uniform(0.5, 0.62)
                fk.tube(wood, limb, lambda t, lr=lr: lr * (1 - 0.6 * t), 4,
                        bark, seed=seed + 40 + k)
                clumps.append((end, clump * rnd.uniform(1.15, 1.35)))
            count = head.get("shell", 10)
            lo = head.get("low", -0.45)
            for m in range(count):
                f = (m + 0.5) / count
                zf = lo + (1.0 - lo) * f ** 0.85
                a2 = m * 2.39996 + hph + rnd.uniform(-0.3, 0.3)
                ring = math.sqrt(max(0.0, 1 - zf * zf))
                far = rnd.uniform(0.74, 0.92)
                q = c + Vector((math.cos(a2) * ring * rx,
                                math.sin(a2) * ring * ry, zf * rz)) * 1.0
                q = c + (q - c) * far
                clumps.append((q, clump * rnd.uniform(1.0, 1.4)))
            for m in range(head.get("fill", 2)):
                a2 = rnd.uniform(0, TAU)
                q = c + Vector((math.cos(a2) * rx * 0.25,
                                math.sin(a2) * ry * 0.25,
                                rz * rnd.uniform(-0.1, 0.3)))
                clumps.append((q, min(rx, ry) * 0.55))
        lumps = []
        for i, (p, r) in enumerate(clumps):
            lumps.append((p, r, seed * 97 + i,
                          {"squash": rnd.uniform(0.76, 0.92), "under": 0.45,
                           "rough": 0.26,
                           "scale": (rnd.uniform(0.9, 1.15),
                                     rnd.uniform(0.9, 1.15), 1)}))
        bm = fk.fuse(lumps, budget - wood.tris(), voxel=voxel, smooth=2,
                     crumb=0.03, grain=2.6, seed=seed)
        leaves.merge(bm, main)
        bm.free()
        shells = [(Vector(hd["c"]), hd["r"]) for hd in heads]
        dust_tips(leaves, colours, shells, seed)
        if marks:
            off = Vector((seed, 2.0, 5.0))
            dark = wood.mat(BARK_MARK)
            for f in wood.bm.faces:
                c = f.calc_center_median()
                v = noise.noise(Vector((c.x * 2.5, c.y * 2.5, c.z * 7.0)) + off)
                if v > 0.28 or (c.z < 0.35 and v > -0.1):
                    f.material_index = dark
        trunk = wood.build(smooth=60)
        fk.drop_buried(trunk, z=-0.1)
        canopy = leaves.build(smooth=180)
    return finish(name, [trunk, canopy], S_TREE,
                  light={canopy.name: crown_light(shells)},
                  normals={canopy.name: crown_normals(shells)},
                  soft={canopy.name})


def oak_a():
    """The round meadow oak: a stout trunk forking into one full crown."""
    return broadleaf("oak_a", 3, h=1.45, r0=0.27, r1=0.19, lean=(0.08, 0.04),
                     heads=[{"c": (0.1, 0.04, 2.85), "r": (1.25, 1.2, 1.05),
                             "limbs": 5, "shell": 11, "fill": 2}],
                     colours=OAK_A, clump=0.5)


def oak_b():
    """A broad, low umbrella crown on a leaning trunk."""
    return broadleaf("oak_b", 7, h=1.15, r0=0.3, r1=0.2, lean=(-0.18, 0.06),
                     heads=[{"c": (-0.12, 0.04, 2.45), "r": (1.6, 1.35, 0.8),
                             "limbs": 6, "shell": 12, "fill": 3,
                             "lift": -0.05, "low": -0.4}],
                     colours=OAK_B, clump=0.52, nroots=5)


def oak_c():
    """A tall tree forking into two leaning stems, two crowns."""
    return broadleaf("oak_c", 11, h=1.75, r0=0.24, r1=0.17, lean=(0.2, -0.06),
                     heads=[{"c": (0.62, -0.18, 4.0), "r": (0.95, 0.9, 0.95),
                             "limbs": 3, "shell": 8, "fill": 1, "stem": 0.13},
                            {"c": (-0.55, 0.25, 3.1), "r": (0.9, 0.85, 0.8),
                             "limbs": 3, "shell": 7, "fill": 1, "stem": 0.12,
                             "kink": (-0.1, 0.1, -0.2)}],
                     colours=OAK_C, clump=0.44, nroots=4)


def birch():
    """A slender white birch: a pale, black-marked stem leaning a little,
    an open oval crown of lighter, smaller clumps."""
    return broadleaf("birch", 19, h=1.9, r0=0.15, r1=0.1, lean=(0.16, 0.05),
                     heads=[{"c": (0.16, 0.05, 3.4), "r": (1.0, 0.95, 1.3),
                             "limbs": 5, "shell": 14, "fill": 1, "stem": 0.07,
                             "lift": 0.1, "low": -0.7}],
                     colours=BIRCH, bark=BARK_BIRCH, clump=0.4, flare=0.4,
                     nroots=3, marks=True, voxel=0.06)


def poplar():
    """A Lombardy poplar: a tall, slim column of upswept clumps."""
    return broadleaf("poplar", 23, h=0.9, r0=0.2, r1=0.14, lean=(0.0, 0.0),
                     heads=[{"c": (0.0, 0.0, 3.55), "r": (0.78, 0.74, 2.6),
                             "limbs": 6, "shell": 16, "fill": 2, "stem": 0.1,
                             "lift": 0.45, "low": -0.75}],
                     colours=POPLAR, clump=0.4, flare=0.5, nroots=3,
                     voxel=0.065)


def conifer(name, seed, H, z0, R0, r0, colours, lean=(0.0, 0.0),
            spacing=0.42, most=6, budget=1490, bark=BARK_PINE):
    """A conifer of layered, drooping boughs around a straight stem, fewer
    and shorter towards a pointed leader, a dark heart inside."""
    with nk.work(S_TREE):
        rnd = random.Random(seed)
        main, tip = colours
        wood = fk.Builder(name + "-trunk")
        crown = fk.Builder(name + "-crown")

        def axis(z):
            return Vector((lean[0] * (z / H) ** 2, lean[1] * (z / H) ** 2, z))

        def radius_at(z):
            f = max(0.0, min(1.0, (H - z) / (H - z0)))
            return R0 * f ** 0.92
        zs = [-0.12 + (H * 0.9 + 0.12) * i / 8 for i in range(9)]
        ph = rnd.uniform(0, TAU)
        fk.tube(wood, [axis(z) for z in zs],
                lambda t: lerp(r0, 0.035, t ** 0.9), 6, bark,
                shape=lambda t, a: 1 + 0.8 * math.exp(-t * H / 0.25) * max(
                    0.0, math.cos(5 * a + ph)) ** 2,
                noise_amp=0.06, seed=seed)
        z = z0
        phase = rnd.uniform(0, TAU)
        level = 0
        while z < H - 0.6:
            f = (H - z) / (H - z0)
            R = radius_at(z) * rnd.uniform(0.88, 1.08) + 0.14
            n = max(3, min(most, round(3 + (most - 3) * f ** 0.8)))
            for i in range(n):
                az = phase + i / n * TAU + rnd.uniform(-0.28, 0.28)
                L = R * rnd.uniform(0.85, 1.06)
                root = axis(z + rnd.uniform(-0.05, 0.05)) + \
                    Vector((math.cos(az), math.sin(az), 0)) * r0 * 0.25
                fk.bough(crown, root, az, L, L * rnd.uniform(0.95, 1.15),
                         lerp(0.5, 0.22, f), lerp(0.45, 0.62, f),
                         seed * 131 + level * 11 + i, main,
                         stations=(0.0, 0.42, 0.8))
            phase += 2.39996
            level += 1
            z += spacing * 1.5 * rnd.uniform(0.95, 1.05) * lerp(0.7, 1.0, f)
        for i in range(3):
            az = phase + i / 3 * TAU
            fk.bough(crown, axis(H - 0.55), az, 0.32, 0.26, 0.55, 0.5,
                     seed * 7 + i, main, stations=(0.0, 0.5))
        fk.tube(crown, [axis(H - 0.7), axis(H - 0.25), axis(H)],
                lambda t: 0.13 * (1 - 0.8 * t), 5, main, cap="point",
                seed=seed + 3)
        fk.tube(crown, [axis(z0 + 0.1), axis(lerp(z0, H, 0.5)),
                        axis(H - 0.6)],
                lambda t: lerp(R0 * 0.32, 0.1, t), 6, main, seed=seed + 5)
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

        def cone(co, n, mix=0.5):
            a = axis(co.z)
            out = Vector((co.x - a.x, co.y - a.y, 0))
            if out.length < 1e-6:
                return n
            g = out.normalized() + Vector((0, 0, 0.55))
            return Vector(n) * (1 - mix) + g.normalized() * mix
        print(name, "trunk", wood.tris(), "crown", crown.tris())
        trunk = wood.build(smooth=60)
        fk.drop_buried(trunk, z=-0.1)
        crown_obj = crown.build(smooth=75)
    return finish(name, [trunk, crown_obj], S_TREE,
                  light={crown_obj.name: shade_rule},
                  normals={crown_obj.name: cone})


def pine_a():
    """A broad, full Scots-style pine of drooping layers."""
    return conifer("pine_a", 5, H=5.4, z0=0.7, R0=1.4, r0=0.19,
                   colours=PINE, spacing=0.6, most=7)


def pine_b():
    """A tall, narrow spruce with a slight lean."""
    return conifer("pine_b", 9, H=6.1, z0=0.6, R0=0.95, r0=0.16,
                   colours=SPRUCE, lean=(0.22, -0.08), spacing=0.4, most=5)


# ---------------------------------------------------------------- bushes

def mound(seed, rx, ry, h, count, r):
    rnd = random.Random(seed)
    out = [(r * 1.2, (0, 0, h * 0.55))]
    rings = ((0.78, 0.22, count // 2), (0.46, 0.5, count - 1 - count // 2 - 2),
             (0.18, 0.72, 2))
    for k, (reach, zf, n) in enumerate(rings):
        for i in range(n):
            a = i / n * TAU + rnd.uniform(-0.25, 0.25) + k * 0.7
            out.append((r * rnd.uniform(0.78, 1.0),
                        (math.cos(a) * rx * reach, math.sin(a) * ry * reach,
                         h * zf * rnd.uniform(0.9, 1.1))))
    return out


def foam_mass(name, seed, clumps, colours, target, voxel=0.06, shells=None):
    """Foam clumps fused into one surface (a bush, a hedge)."""
    rnd = random.Random(seed)
    b = fk.Builder(name)
    main, tip = colours
    lumps = []
    for i, (r, c) in enumerate(clumps):
        c = Vector(c)
        lumps.append((c, r * rnd.uniform(0.85, 1.15), seed * 17 + i,
                      {"squash": rnd.uniform(0.78, 0.94), "under": 0.5,
                       "rough": 0.32,
                       "scale": (rnd.uniform(0.9, 1.12),
                                 rnd.uniform(0.9, 1.12), 1)}))
    bm = fk.fuse(lumps, target, voxel=voxel, smooth=1, crumb=0.045,
                 grain=3.2, seed=seed)
    b.merge(bm, main)
    bm.free()
    if shells is None:
        top = max(c[1][2] for c in clumps)
        rx = max(abs(c[1][0]) + c[0] for c in clumps)
        ry = max(abs(c[1][1]) + c[0] for c in clumps)
        shells = [(Vector((0, 0, top * 0.35)), (rx, ry, top * 0.8))]
    dust_tips(b, colours, shells, seed, bias=0.78)
    return b, shells


def bush(name, seed, rx, ry, h, count, r, colours, target=700):
    with nk.work(S_TREE):
        clumps = mound(seed, rx, ry, h, count, r)
        for i, (rr, c) in enumerate(clumps):
            clumps[i] = (rr, (c[0], c[1], max(c[2], rr * 0.5 - 0.06)))
        b, shells = foam_mass(name + "-leaves", seed, clumps, colours, target,
                              voxel=0.05)
        obj = b.build(smooth=180)
        fk.drop_buried(obj, z=-0.08)
    return finish(name, [obj], S_TREE,
                  light={obj.name: crown_light(shells)},
                  normals={obj.name: crown_normals(shells, mix=0.45)},
                  soft={obj.name})


def bush_a():
    """A round shrub, 7 cm tall."""
    return bush("bush_a", 3, 0.55, 0.52, 0.85, 12, 0.34, BUSH_A)


def bush_b():
    """A low, spreading bramble, 5 cm tall."""
    return bush("bush_b", 8, 0.85, 0.55, 0.55, 13, 0.3, BUSH_B)


def hedge():
    """A clipped field hedge 1 m long: two rows of foam clumps, squared
    off at the ends so lengths butt together along a field edge."""
    with nk.work(S_TREE):
        rnd = random.Random(41)
        L, W, H = 16.0, 1.12, 1.12
        clumps = []
        x = -L / 2 - 0.3
        while x < L / 2 + 0.4:
            for y in (-0.14, 0.14):
                clumps.append((0.38 * rnd.uniform(0.9, 1.1),
                               (x + rnd.uniform(-0.1, 0.1),
                                y + rnd.uniform(-0.05, 0.05),
                                0.36 + rnd.uniform(-0.05, 0.05))))
            clumps.append((0.36 * rnd.uniform(0.9, 1.1),
                           (x + 0.22 + rnd.uniform(-0.1, 0.1),
                            rnd.uniform(-0.06, 0.06),
                            0.72 + rnd.uniform(-0.04, 0.04))))
            x += 0.5
        shells = [(Vector((0, 0, 0.45)), (L / 2 + 0.3, W / 2 + 0.05, 0.7))]
        b, _ = foam_mass("hedge-leaves", 41, clumps, HEDGE, 1450, voxel=0.07,
                         shells=shells)
        # Trim to 7 x 7 cm in section and square the ends so lengths butt
        # together.
        ymax = max(abs(v.co.y) for v in b.bm.verts)
        zmax = max(v.co.z for v in b.bm.verts)
        for v in b.bm.verts:
            v.co.x = max(-L / 2, min(L / 2, v.co.x))
            v.co.y *= (W / 2) / ymax
            if v.co.z > 0:
                v.co.z *= H / zmax
            v.co.z -= 0.05
        obj = b.build(smooth=180)
        fk.drop_buried(obj, z=-0.08)

        def light(co, n):
            up = 0.5 + 0.5 * n.z
            h = max(0.0, min(1.0, co.z / H))
            return 0.5 * up + 0.5 * h

        def normals(co, n):
            g = Vector((0, co.y / (W / 2), (co.z - 0.4) / 0.7))
            if g.length < 1e-6:
                return n
            return Vector(n) * 0.5 + g.normalized() * 0.5
    return finish("hedge", [obj], S_TREE, light={obj.name: light},
                  normals={obj.name: normals}, soft={obj.name})


# ---------------------------------------------------------------- ground cover

def blossom(b, at, radius, mat, seed):
    rnd = random.Random(seed)
    at = Vector(at)
    spin = rnd.uniform(0, TAU)
    ring = [b.vert(at + Vector((math.cos(spin + k / 4 * TAU) * radius,
                                math.sin(spin + k / 4 * TAU) * radius, 0)))
            for k in range(4)]
    top = b.vert(at + Vector((0, 0, radius * 0.6)))
    bot = b.vert(at - Vector((0, 0, radius * 0.4)))
    for k in range(4):
        j = (k + 1) % 4
        b.face([ring[k], ring[j], top], mat)
        b.face([ring[j], ring[k], bot], mat)


def flowers():
    """A clump of wild flowers: a foam cushion with grass blades and dots
    of white, yellow, pink and violet flock on top."""
    with nk.work(S_TREE):
        rnd = random.Random(5)
        b = fk.Builder("flowers-bloom")
        clumps = [(0.26, (0, 0, 0.05)), (0.22, (0.24, 0.08, 0.02)),
                  (0.2, (-0.2, 0.14, 0.02)), (0.18, (0.05, -0.2, 0.0))]
        lumps = [(Vector(c), r, 50 + i, {"squash": 0.7, "under": 0.3,
                                          "rough": 0.3})
                 for i, (r, c) in enumerate(clumps)]
        bm = fk.fuse(lumps, 260, voxel=0.035, smooth=2, crumb=0.02, grain=6)
        b.merge(bm, TUFT_DEEP)
        bm.free()
        tree = fk.bvh(b)
        fk.tuft(b, 6, 22, 0.42, [TUFT, TUFT_DEEP, TUFT_DRY], [3, 2, 1],
                width=0.03, root=0.22, sink=0.02, splay=(55, 85))
        weights = [3, 3, 2, 2, 1]
        placed = 0
        for i in range(160):
            if placed >= 44:
                break
            a = rnd.uniform(0, TAU)
            d = 0.36 * math.sqrt(rnd.random())
            x, y = math.cos(a) * d + 0.02, math.sin(a) * d
            hit = tree.ray_cast(Vector((x, y, 3)), Vector((0, 0, -1)))
            if hit[0] is None:
                continue
            r = rnd.random() * sum(weights)
            k = 0
            while r > weights[k] and k < len(weights) - 1:
                r -= weights[k]
                k += 1
            lift = rnd.uniform(0.02, 0.16)
            p = hit[0] + Vector((0, 0, lift))
            if lift > 0.05:
                fk.fibre(b, p - Vector((0, 0, lift + 0.03)), p, 0.02,
                         TUFT_DEEP)
            blossom(b, p, rnd.uniform(0.05, 0.065), PETALS[k], 70 + i)
            placed += 1
        obj = b.build(smooth=60)
        fk.drop_buried(obj, z=-0.04)
    return finish("flowers", [obj], S_TREE, normals={obj.name: grass_normals})


def reeds():
    """Water-edge reeds: a fan of tall blades, a few bent and dry, and
    brown bulrush heads on stiff stems."""
    with nk.work(S_TREE):
        rnd = random.Random(12)
        b = fk.Builder("reeds-blades")
        fk.tuft(b, 12, 70, 1.25, [REED, REED_DRY, TUFT_DEEP], [5, 2, 2],
                width=0.06, root=0.32, sink=0.06, splay=(66, 88))
        fk.tuft(b, 13, 26, 0.6, [REED, TUFT_DEEP], [2, 2], width=0.05,
                root=0.42, sink=0.04, splay=(45, 72))
        for i in range(7):
            a = rnd.uniform(0, TAU)
            d = rnd.uniform(0.0, 0.25)
            base = Vector((math.cos(a) * d, math.sin(a) * d, -0.06))
            hgt = rnd.uniform(1.15, 1.6)
            lean = Vector((math.cos(a), math.sin(a), 0)) * rnd.uniform(0.04,
                                                                       0.2)
            top = base + Vector((0, 0, hgt)) + lean
            fk.tube(b, [base, base.lerp(top, 0.5) + lean * 0.2, top],
                    lambda t: 0.018, 3, REED_DRY, seed=80 + i)
            hd = top - Vector((0, 0, 0.3)) + lean * 0.05
            fk.tube(b, [hd, hd.lerp(top, 0.5), top - Vector((0, 0, 0.02))],
                    lambda t: 0.055 * (1 - 0.35 * abs(2 * t - 1) ** 3), 6,
                    CATTAIL, cap="flat", seed=90 + i)
            fk.fibre(b, top - Vector((0, 0, 0.03)), top + Vector((0, 0, 0.14))
                     + lean * 0.05, 0.016, REED_DRY)
        obj = b.build(smooth=50)
        fk.drop_buried(obj, z=-0.04)
    return finish("reeds", [obj], S_TREE, normals={obj.name: grass_normals})


# ---------------------------------------------------------------- rocks
# Built at S = 10: Arena's rock numbers, a tenth of the size.

S_ROCK = 10


def rock(name, seed, blocks, moss=3, moss_r=0.12, skirt=3, sink=0.06,
         tufts=2):
    with nk.work(S_ROCK):
        b = fk.Builder(name + "-stone")
        xs, ys = [], []
        rnd = random.Random(seed)
        for i, (size, xy, yaw, tilt, kw) in enumerate(blocks):
            bm = fk.fracture(size, seed * 11 + i, **kw)
            fk.place(bm, fk.block_matrix((xy[0], xy[1], 0), yaw, tilt))
            low = min(v.co.z for v in bm.verts)
            bmesh.ops.translate(bm, vec=(0, 0, -sink - low), verts=bm.verts)
            b.merge(bm, ROCK if rnd.random() < 0.7 else ROCK_DK)
            bm.free()
            xs += [xy[0] - size[0] / 2, xy[0] + size[0] / 2]
            ys += [xy[1] - size[1] / 2, xy[1] + size[1] / 2]
        area = (min(xs), min(ys), max(xs), max(ys))
        tree = fk.bvh(b)
        if moss:
            fk.moss_on(b, tree, seed, moss, area, moss_r, MOSS, min_nz=0.5,
                       cluster=moss_r * 1.3, sub=2)
            fk.moss_on(b, tree, seed + 8, moss, area, moss_r * 0.5, MOSS_DRY,
                       min_nz=0.5, cluster=moss_r, sub=1)
        cx, cy = (area[0] + area[2]) / 2, (area[1] + area[3]) / 2
        reach = max(area[2] - area[0], area[3] - area[1])
        if skirt:
            fk.moss_skirt(b, tree, seed + 3, skirt, (cx, cy, 0), reach,
                          moss_r * 1.1, TUFT_DEEP, arc=(0.5, 3.6), sub=1)
        for k in range(tufts):
            a = rnd.uniform(0, TAU)
            start = Vector((cx, cy, 0.05)) + Vector((math.cos(a), math.sin(a),
                                                     0)) * reach
            hit = tree.ray_cast(start, Vector((cx, cy, 0.05)) - start)
            if hit[0] is None:
                continue
            sub = fk.Builder("__tuft")
            fk.tuft(sub, seed * 13 + k, 14, 0.16, [TUFT, TUFT_DRY], [2, 1],
                    width=0.022, root=0.05, sink=0.03)
            p = hit[0] + Vector((math.cos(a), math.sin(a), 0)) * 0.03
            p.z = 0
            b.merge(sub.bm, TUFT, Matrix.Translation(p), mats=sub.mats)
            sub.bm.free()
        obj = b.build(smooth=32)
        fk.drop_buried(obj, z=-0.04)
    return finish(name, [obj], S_ROCK)


def rock_a():
    """A small rounded boulder, 4 to 5 cm."""
    return rock("rock_a", 1, [
        ((0.55, 0.46, 0.4), (0, 0), 0.3, (0.05, -0.08),
         {"cuts": 8, "bevel": 0.02, "max_edge": 0.25}),
    ], moss=2, moss_r=0.09, skirt=2, tufts=1)


def rock_b():
    """A boulder with a fallen piece beside it, 8 cm."""
    return rock("rock_b", 2, [
        ((0.8, 0.7, 0.62), (-0.08, 0.0), 0.2, (0.06, 0.1),
         {"cuts": 9, "flat_top": 1, "max_edge": 0.3}),
        ((0.36, 0.38, 0.3), (0.42, -0.2), 1.1, (0.3, -0.2),
         {"cuts": 6, "bevel": 0.018, "max_edge": 0.3}),
    ], moss=3, moss_r=0.11, skirt=2)


def rock_c():
    """An outcrop of three leaning blocks, 12 cm."""
    return rock("rock_c", 3, [
        ((0.85, 0.7, 1.15), (0.0, 0.05), 0.4, (0.1, -0.16),
         {"cuts": 9, "max_edge": 0.35}),
        ((0.62, 0.55, 0.62), (0.52, -0.18), 1.3, (0.16, 0.2),
         {"cuts": 7, "bevel": 0.02, "max_edge": 0.35}),
        ((0.36, 0.3, 0.26), (-0.42, -0.3), 2.0, (0.2, 0.25),
         {"cuts": 6, "bevel": 0.018, "max_edge": 0.35}),
    ], moss=4, moss_r=0.12, skirt=3, tufts=2)


# ---------------------------------------------------------------- edges

def drystone(b, rnd, xa, xb, za, zb, depth, mat, fan=True):
    """One dry-laid stone through the wall: a pillowed, chamfered block
    whose faces bulge a little and whose corners are knocked off."""
    w, h = xb - xa, zb - za
    c = min(0.0045, 0.3 * min(w, h))
    pts = []
    for (x, z, dx, dz) in ((xa, za, 1, 1), (xb, za, -1, 1), (xb, zb, -1, -1),
                           (xa, zb, 1, -1)):
        k = c * rnd.uniform(0.6, 1.3)
        k2 = c * rnd.uniform(0.6, 1.3)
        if dx * dz > 0:
            pts += [(x, z + dz * k), (x + dx * k2, z)]
        else:
            pts += [(x + dx * k2, z), (x, z + dz * k)]
    # Wind the octagon counter-clockwise seen from -Y.
    pts = [pts[1], pts[2], pts[3], pts[4], pts[5], pts[6], pts[7], pts[0]]
    j = 0.0007

    def ring(y, s):
        cx, cz = (xa + xb) / 2, (za + zb) / 2
        out = []
        for x, z in pts:
            px = cx + (x - cx) * s + rnd.uniform(-j, j)
            pz = cz + (z - cz) * s + rnd.uniform(-j, j)
            out.append(b.vert((px, y + rnd.uniform(-0.0008, 0.0008), pz)))
        return out
    f0 = ring(-depth / 2 + rnd.uniform(-0.001, 0.0015), 0.97)
    f1 = ring(depth / 2 + rnd.uniform(-0.0015, 0.001), 0.97)
    faces = []
    n = len(pts)
    for i in range(n):
        k = (i + 1) % n
        faces.append(b.face([f0[i], f1[i], f1[k], f0[k]], mat))
    cx, cz = (xa + xb) / 2, (za + zb) / 2
    for ringv, y, sign in ((f0, -depth / 2, -1), (f1, depth / 2, 1)):
        if fan:
            mid = b.vert((cx + rnd.uniform(-j, j),
                          y + sign * rnd.uniform(0.001, 0.0022), cz))
            for i in range(n):
                k = (i + 1) % n
                faces.append(b.face([ringv[i], ringv[k], mid], mat))
        else:
            faces.append(b.face(list(ringv), mat))
    faces = [f for f in faces if f]
    bmesh.ops.recalc_face_normals(b.bm, faces=faces)
    for f in faces:
        b.planar(f)


def stone_wall():
    """A dry stone wall 1 m long: three battered courses of individual
    pillowed stones in warm greys, a coping of stones set on edge, moss on
    the top and grass at the foot."""
    rnd = random.Random(61)
    b = fk.Builder("stone_wall-stones")
    L = 1.0
    courses = [(-0.003, 0.0165, 0.05), (0.0172, 0.0305, 0.046),
               (0.0312, 0.0435, 0.042)]
    shades = [DRY_A, DRY_A, DRY_B, DRY_C, DRY_D]
    for ci, (z0, z1, depth) in enumerate(courses):
        x = -L / 2 - rnd.uniform(0.0, 0.03)
        while x < L / 2:
            ln = rnd.uniform(0.042, 0.078)
            xa, xb = max(x, -L / 2), min(x + ln, L / 2)
            if xb - xa > 0.008:
                drystone(b, rnd, xa + 0.0007, xb - 0.0007,
                         z0 + rnd.uniform(0, 0.0012),
                         z1 - rnd.uniform(0, 0.0012), depth,
                         rnd.choice(shades))
            x += ln
    # Coping: rough capstones laid across the top, each its own size and
    # tilt, with gaps between.
    x = -L / 2
    while x < L / 2 - 0.006:
        ln = rnd.uniform(0.018, 0.04)
        xa, xb = x + 0.0008, min(x + ln, L / 2) - 0.0008
        hgt = rnd.uniform(0.0105, 0.0165)
        sub = fk.Builder("__cope")
        drystone(sub, rnd, -(xb - xa) / 2, (xb - xa) / 2, 0, hgt,
                 0.038 + rnd.uniform(-0.004, 0.003), rnd.choice(shades))
        m = Matrix.Translation(((xa + xb) / 2, rnd.uniform(-0.0015, 0.0015),
                                0.0432 - rnd.uniform(0, 0.001))) @ \
            Matrix.Rotation(rnd.uniform(-0.1, 0.1), 4, "Y") @ \
            Matrix.Rotation(rnd.uniform(-0.12, 0.12), 4, "Z")
        b.merge(sub.bm, None, m, mats=sub.mats, uv="keep")
        sub.bm.free()
        x += ln
    tree = fk.bvh(b)
    fk.moss_on(b, tree, 61, 6, (-0.48, -0.015, 0.48, 0.015), 0.006, MOSS,
               min_nz=0.5, cluster=0.01, sub=1, flat=0.4, top=1.0)
    for k in range(9):
        x = -0.45 + k * 0.11 + rnd.uniform(-0.03, 0.03)
        side = rnd.choice((-1, 1))
        sub = fk.Builder("__tuft")
        fk.tuft(sub, 300 + k, 9, 0.012, [TUFT, TUFT_DRY, TUFT_DEEP],
                [3, 1, 2], width=0.0016, root=0.004, sink=0.002)
        b.merge(sub.bm, TUFT, Matrix.Translation((x, side * 0.021, 0)),
                mats=sub.mats)
        sub.bm.free()
    obj = b.build(smooth=35)
    return finish("stone_wall", [obj])


def fence():
    """A white post-and-rail fence 1 m long: four posts at a quarter metre
    (so lengths butt on at the same spacing), two rails through them, a
    tuft of grass at each foot."""
    rnd = random.Random(71)
    b = fk.Builder("fence-paint")
    for i, x in enumerate((-0.375, -0.125, 0.125, 0.375)):
        lean = (rnd.uniform(-0.025, 0.025), rnd.uniform(-0.025, 0.025), 0)
        nk.cube(b, (0.0055, 0.0055, 0.051), WHITE, at=(x, 0, 0.0225),
                rot=lean, bevel=0.0006, edge=0.012)
        # A weathered cap.
        nk.lathe(b, [(0.0042, 0.0), (0.0, 0.0028)], 4, WHITE,
                 at=(x + lean[1] * 0.025, -lean[0] * 0.025, 0.048),
                 rot=(lean[0], lean[1], math.pi / 4))
    for z in (0.0235, 0.04):
        nk.cube(b, (1.0, 0.0024, 0.0062), WHITE,
                at=(0, -0.0041, z + rnd.uniform(-0.0004, 0.0004)),
                bevel=0.0004)
    for i, x in enumerate((-0.375, -0.125, 0.125, 0.375)):
        sub = fk.Builder("__tuft")
        fk.tuft(sub, 400 + i, 10, 0.011, [TUFT, TUFT_DRY, TUFT_DEEP],
                [3, 1, 2], width=0.0014, root=0.004, sink=0.002)
        b.merge(sub.bm, TUFT, Matrix.Translation((x, 0.001, 0)),
                mats=sub.mats)
        sub.bm.free()
    obj = b.build(smooth=30)
    return finish("fence", [obj])


# ---------------------------------------------------------------- props

def tuft_at(b, seed, at, n=10, h=0.012, root=0.004):
    sub = fk.Builder("__tuft")
    fk.tuft(sub, seed, n, h, [TUFT, TUFT_DRY, TUFT_DEEP], [3, 1, 2],
            width=0.0015, root=root, sink=0.002)
    b.merge(sub.bm, TUFT, Matrix.Translation(Vector(at)), mats=sub.mats)
    sub.bm.free()


def buffer_stop():
    """A rail-built buffer stop: two uprights with raking back struts, a
    red timber beam 12 cm wide across the track with two sprung buffers
    facing the train (-Y), and a red stop lamp on top."""
    b = fk.Builder("buffer_stop-frame")
    for x in (-0.045, 0.045):
        nk.beam(b, (x, 0.004, -0.003), (x, 0.004, 0.05), 0.006, 0.006, IRON)
        nk.beam(b, (x, 0.068, -0.003), (x, 0.006, 0.046), 0.0055, 0.0055, IRON)
        nk.beam(b, (x, 0.07, 0.002), (x, -0.002, 0.002), 0.004, 0.006, IRON)
    # The beam: red-painted timber with white ends.
    nk.cube(b, (0.104, 0.013, 0.017), RED, at=(0, -0.0035, 0.0425),
            bevel=0.0012)
    for x in (-0.056, 0.056):
        nk.cube(b, (0.008, 0.0132, 0.0172), WHITE, at=(x, -0.0035, 0.0425),
                bevel=0.0012)
    # Buffers: a housing, a shank and a round head.
    for x in (-0.04, 0.04):
        r = Matrix.Rotation(math.pi / 2, 4, "X")
        nk.lathe(b, [(0.0042, 0), (0.0042, 0.006), (0.003, 0.0068)], 12,
                 IRON, at=(x, -0.01, 0.0425), rot=r, cap_bottom=True)
        nk.lathe(b, [(0.0022, 0.006), (0.0022, 0.013)], 10, STEEL,
                 at=(x, -0.01, 0.0425), rot=r)
        nk.lathe(b, [(0.0068, 0.0128), (0.0075, 0.0138), (0.0075, 0.0152),
                     (0.006, 0.0158), (0.0, 0.0159)], 16, STEEL,
                 at=(x, -0.01, 0.0425), rot=r, cap_bottom=True)
    # A stop lamp on a short stalk in the middle of the beam.
    nk.rod(b, (0, 0.0, 0.0505), (0, 0.0, 0.0525), 0.0012, IRON, segs=6)
    nk.cube(b, (0.0075, 0.0065, 0.006), BLACK, at=(0, 0.0, 0.0548),
            bevel=0.0008)
    nk.lathe(b, [(0.0, 0.0), (0.0024, 0.0), (0.0024, 0.0008),
                 (0.0018, 0.0014), (0.0, 0.0016)], 12, GLOW_RED,
             at=(0, -0.0032, 0.0548), rot=Matrix.Rotation(math.pi / 2, 4, "X"))
    nk.cube(b, (0.0085, 0.0075, 0.0012), BLACK, at=(0, 0.0, 0.0584))
    obj = b.build(smooth=30)
    return finish("buffer_stop", [obj])


def road_barrier():
    """A road-closed barrier 32 cm wide: two trestle legs, a board striped
    red and white on the slant, a little amber warning lamp on one end."""
    b = fk.Builder("road_barrier-paint")
    W, z0, z1 = 0.32, 0.03, 0.043
    x0, x1 = -W / 2, W / 2
    stripe = 0.026
    k = -3
    while x0 + k * stripe < x1 + 0.02:
        xa = x0 + k * stripe
        poly = [(xa, z0), (xa + stripe, z0), (xa + stripe + (z1 - z0), z1),
                (xa + (z1 - z0), z1)]
        poly = nk.clip_poly(poly, x0, x1, z0, z1)
        if len(poly) >= 3:
            nk.prism(b, poly, 0.0035, RED if k % 2 else WHITE, y0=-0.00175)
        k += 1
    for x in (-0.135, 0.135):
        for s in (-1, 1):
            nk.beam(b, (x, s * 0.022, -0.002), (x, s * 0.002, 0.046), 0.0042,
                    0.0042, WHITE)
        nk.cube(b, (0.006, 0.006, 0.004), RED, at=(x, 0, 0.046), bevel=0.0006)
        nk.beam(b, (x, -0.016, 0.012), (x, 0.016, 0.012), 0.0026, 0.0026,
                IRON)
    # Warning lamp: a black housing, an amber dome.
    x = 0.135
    nk.lathe(b, [(0.0, 0.048), (0.0034, 0.048), (0.0034, 0.0515),
                 (0.0, 0.0515)], 12, BLACK, at=(x, 0, 0))
    nk.lathe(b, [(0.0031, 0.0515), (0.0031, 0.0545), (0.0024, 0.0575),
                 (0.0, 0.0588)], 12, GLOW_AMBER, at=(x, 0, 0),
             cap_bottom=False)
    obj = b.build(smooth=30)
    return finish("road_barrier", [obj])


def signpost():
    """A white cast fingerpost 11 cm tall: a round post on a collar, three
    arrow fingers with black lettering, a black ball finial."""
    rnd = random.Random(81)
    b = fk.Builder("signpost-paint")
    nk.lathe(b, [(0.0048, -0.003), (0.0048, 0.004), (0.0036, 0.0065),
                 (0.0031, 0.009), (0.0028, 0.098), (0.0036, 0.099),
                 (0.0036, 0.1015), (0.0, 0.1018)], 12, WHITE)
    nk.lathe(b, [(0.0, 0.1015), (0.0026, 0.1015), (0.0034, 0.104),
                 (0.0036, 0.1065), (0.0026, 0.1093), (0.001, 0.1104),
                 (0.0012, 0.1112), (0.0, 0.1125)], 12, BLACK)
    fingers = ((0.09, 0.2, 1.0), (0.081, math.pi - 0.15, 0.85),
               (0.072, 0.75, 0.75))
    for z, ang, ln in fingers:
        L = 0.034 * ln
        poly = [(0.0026, -0.0034), (L - 0.005, -0.0034), (L, 0.0),
                (L - 0.005, 0.0034), (0.0026, 0.0034)]
        sub = fk.Builder("__finger")
        nk.prism(sub, poly, 0.0016, WHITE, y0=-0.0008)
        for side in (-1, 1):
            xs = 0.006
            while xs < L - 0.008:
                ww = rnd.uniform(0.0016, 0.0032)
                nk.cube(sub, (ww, 0.0003, 0.0021), BLACK,
                        at=(xs + ww / 2, side * 0.00085, 0.0))
                xs += ww + 0.0009
        m = Matrix.Translation((0, 0, z)) @ Matrix.Rotation(ang, 4, "Z")
        b.merge(sub.bm, None, m, mats=sub.mats, uv="keep")
        sub.bm.free()
    tuft_at(b, 82, (0.001, 0.0, 0), n=12, h=0.012, root=0.006)
    obj = b.build(smooth=35)
    return finish("signpost", [obj])


def rail_signal():
    """A semaphore stop signal 15.8 cm tall: a tapering white post on a
    concrete footing, a red arm with a white band, the spectacle with red
    and green glasses, a lamp case, a ladder up the back and a finial."""
    b = fk.Builder("rail_signal-parts")
    q = Matrix.Rotation(math.pi / 4, 4, "Z")
    nk.cube(b, (0.018, 0.018, 0.009), CONCRETE, at=(0, 0, 0.0015),
            bevel=0.0012)
    nk.lathe(b, [(0.0068, 0.006), (0.0049, 0.146), (0.0, 0.1462)], 4, WHITE,
             rot=q)
    nk.lathe(b, [(0.0, 0.146), (0.0042, 0.146), (0.0042, 0.1475),
                 (0.0018, 0.149), (0.0021, 0.152), (0.0, 0.158)], 8, BLACK)
    # The arm, pivoted on the front face, pointing left.
    zp, yp = 0.128, -0.0052
    arm = [(-0.003, zp - 0.0033), (-0.048, zp - 0.0033),
           (-0.048, zp + 0.0033), (-0.003, zp + 0.0033)]
    nk.prism(b, arm, 0.0012, RED, y0=yp - 0.0012)
    nk.prism(b, [(-0.042, zp - 0.0034), (-0.037, zp - 0.0034),
                 (-0.037, zp + 0.0034), (-0.042, zp + 0.0034)], 0.0003,
             WHITE, y0=yp - 0.0015)
    # Spectacle: a black frame beyond the pivot with two glasses.
    spec = [(-0.003, zp - 0.0115), (0.0095, zp - 0.0115),
            (0.0095, zp + 0.0025), (-0.003, zp + 0.0025)]
    nk.prism(b, spec, 0.0009, BLACK, y0=yp - 0.0022)
    r = Matrix.Rotation(math.pi / 2, 4, "X")
    for (x, z, mat) in ((0.0035, zp - 0.002, GLOW_RED),
                        (0.0035, zp - 0.008, GLOW_GREEN)):
        nk.lathe(b, [(0.0, 0.0), (0.0024, 0.0), (0.0024, 0.0007),
                     (0.0, 0.0009)], 12, mat, at=(x, yp - 0.0022, z), rot=r)
    nk.lathe(b, [(0.0, 0), (0.0018, 0), (0.0018, 0.0012), (0.0, 0.0013)], 8,
             STEEL, at=(-0.0005, yp - 0.0012, zp), rot=r)
    # Lamp case behind the spectacle, on a bracket.
    nk.cube(b, (0.0055, 0.0055, 0.0075), BLACK, at=(0.0035, -0.0003, zp - 0.005),
            bevel=0.0006)
    nk.lathe(b, [(0.0016, 0), (0.0012, 0.003), (0.0018, 0.0034),
                 (0.0, 0.0036)], 6, BLACK, at=(0.0035, -0.0003, zp - 0.0012))
    # The down rod and the balance lever at the foot.
    nk.rod(b, (-0.0025, yp - 0.0006, zp - 0.004), (-0.0025, yp - 0.0006, 0.018),
           0.00045, STEEL, segs=5)
    nk.beam(b, (-0.009, yp - 0.0012, 0.017), (0.006, yp - 0.0012, 0.019), 0.0012,
            0.0014, BLACK)
    nk.cube(b, (0.004, 0.003, 0.004), BLACK, at=(-0.009, yp - 0.0012, 0.0175),
            bevel=0.0004)
    # Ladder up the back.
    yl = 0.0072
    for x in (-0.0026, 0.0026):
        nk.beam(b, (x, yl, 0.006), (x, yl, 0.122), 0.0007, 0.0007, IRON)
    z = 0.012
    while z < 0.12:
        nk.beam(b, (-0.0026, yl, z), (0.0026, yl, z), 0.0006, 0.0006, IRON)
        z += 0.0075
    nk.beam(b, (0, 0.0045, 0.12), (0, yl, 0.121), 0.0008, 0.0008, IRON)
    tuft_at(b, 91, (0.009, -0.009, 0), n=8, h=0.01, root=0.004)
    obj = b.build(smooth=30)
    return finish("rail_signal", [obj])


def lamp():
    """A cast-iron street lamp 11.6 cm tall: a fluted base, a slim column
    with collars and a ladder bar, a square lantern whose glass is the
    `glow:lamp` light, a pyramid roof and a finial."""
    b = fk.Builder("lamp-iron")
    nk.lathe(b, [(0.0058, -0.003), (0.0058, 0.0035), (0.0047, 0.005),
                 (0.0047, 0.011), (0.0034, 0.0145), (0.0026, 0.019),
                 (0.0023, 0.086), (0.0, 0.0862)], 12, LAMP_GREEN)
    for z in (0.024, 0.085):
        nk.lathe(b, [(0.0026, z - 0.0012), (0.0034, z - 0.0006),
                     (0.0034, z + 0.0006), (0.0026, z + 0.0012)], 12,
                 LAMP_GREEN)
    nk.rod(b, (-0.0065, 0, 0.081), (0.0065, 0, 0.081), 0.0006, LAMP_GREEN,
           segs=6)
    for x in (-0.0068, 0.0068):
        nk.lathe(b, [(0.0, -0.0009), (0.0009, -0.0006), (0.0009, 0.0006),
                     (0.0, 0.0009)], 6, LAMP_GREEN, at=(x, 0, 0.081))
    q = Matrix.Rotation(math.pi / 4, 4, "Z")
    s2 = math.sqrt(2)
    nk.lathe(b, [(0.0, 0.0862), (0.0026 * s2, 0.0875), (0.0034 * s2, 0.0905),
                 (0.0034 * s2, 0.0918), (0.0, 0.0918)], 4, LAMP_GREEN, rot=q)
    nk.lathe(b, [(0.0031 * s2, 0.0918), (0.0049 * s2, 0.1035)], 4, GLOW_LAMP,
             rot=q)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        d0, d1 = 0.0032 * s2, 0.005 * s2
        nk.rod(b, (math.cos(a) * d0, math.sin(a) * d0, 0.0915),
               (math.cos(a) * d1, math.sin(a) * d1, 0.1038), 0.00045,
               LAMP_GREEN, segs=4)
    nk.lathe(b, [(0.0, 0.103), (0.0062 * s2, 0.1035), (0.0062 * s2, 0.1048),
                 (0.0016 * s2, 0.1115), (0.0, 0.1118)], 4, LAMP_GREEN, rot=q)
    nk.lathe(b, [(0.0, 0.1112), (0.0011, 0.1118), (0.0013, 0.1135),
                 (0.0, 0.1162)], 8, LAMP_GREEN)
    tuft_at(b, 95, (0.002, 0.003, 0), n=8, h=0.008, root=0.005)
    obj = b.build(smooth=35)
    return finish("lamp", [obj])


def hay_bale():
    """A round bale of hay 4 cm across, lying on its side along x, its
    rolled ends showing rings and a few loose straws."""
    rnd = random.Random(101)
    b = fk.Builder("hay_bale-hay")
    R, half = 0.0198, 0.018
    prof = [(0.0, -half + 0.0006)]
    rings = 6
    for i in range(1, rings + 1):
        r = R * 0.86 * i / rings
        prof.append((r, -half + (0.0004 if i % 2 else -0.0003)))
    prof += [(R * 0.94, -half + 0.0012), (R * 0.99, -half + 0.004),
             (R, -0.006), (R * 1.008, 0.0), (R, 0.006), (R * 0.99, half - 0.004),
             (R * 0.94, half - 0.0012)]
    for i in range(rings, 0, -1):
        r = R * 0.86 * i / rings
        prof.append((r, half - (0.0004 if i % 2 else -0.0003)))
    prof.append((0.0, half - 0.0006))
    off = Vector((3.1, 1.7, 0.4))

    def wobble(j, k, p):
        n = noise.noise(p * 260 + off)
        r = Vector((p.x, p.y, 0))
        if r.length > 1e-6:
            p = p + r.normalized() * n * 0.0006
        return p
    m = Matrix.Translation((0, 0, R - 0.0035)) @ \
        Matrix.Rotation(math.pi / 2, 4, "Y") @ Matrix.Scale(1.0, 4)
    nk.part(b, m, lambda t: fk.revolve(t, prof, 24, HAY, vert=wobble))
    # Sag: a bale settles flat where it sits.
    for v in b.bm.verts:
        v.co.z = max(v.co.z, -0.0022)
    for i in range(16):
        a = rnd.uniform(0, TAU)
        x = rnd.uniform(-half, half)
        p = Vector((x, math.cos(a) * R * 0.98, R - 0.0035 + math.sin(a) * R))
        if p.z < 0.004:
            continue
        d = Vector((rnd.uniform(-1, 1), math.cos(a), math.sin(a))).normalized()
        fk.fibre(b, p - d * 0.001, p + d * rnd.uniform(0.003, 0.006), 0.0007,
                 HAY)
    obj = b.build(smooth=60)
    return finish("hay_bale", [obj])


def pier():
    """A wooden jetty 1 m long along y and 34 cm wide: planks across the
    deck (top at z = 0.03) on two stringers, pile bents every quarter
    metre with cross bracing driven down to z = -0.08, mooring posts and a
    steel ladder at the far (+Y) end."""
    rnd = random.Random(111)
    b = fk.Builder("pier-timber")
    shades = [JETTY, JETTY, JETTY_LT, JETTY_DK]
    pitch = 1.0 / 35
    for i in range(35):
        y = -0.5 + pitch * (i + 0.5)
        w = pitch - 0.0028
        ln = 0.34 + rnd.uniform(-0.006, 0.004)
        nk.cube(b, (ln, w, 0.0045), rnd.choice(shades),
                at=(rnd.uniform(-0.003, 0.003), y,
                    0.03 - 0.00225 - rnd.uniform(0, 0.0005)),
                rot=(rnd.uniform(-0.01, 0.01), rnd.uniform(-0.005, 0.005),
                     rnd.uniform(-0.004, 0.004)), bevel=0.0006, edge=0.12)
    for x in (-0.125, 0.125):
        nk.cube(b, (0.011, 1.0, 0.0095), JETTY_DK, at=(x, 0, 0.0205),
                bevel=0.0008)
    for y in (-0.375, -0.125, 0.125, 0.375):
        nk.cube(b, (0.33, 0.011, 0.0095), JETTY_DK, at=(0, y, 0.011),
                bevel=0.0008)
        for x in (-0.158, 0.158):
            top = 0.0255
            nk.lathe(b, [(0.0082, -0.082), (0.0085, -0.02), (0.008, top - 0.001),
                         (0.006, top), (0.0, top + 0.0004)], 10, JETTY_DK,
                     at=(x + rnd.uniform(-0.001, 0.001), y, 0),
                     rot=(rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02),
                          rnd.uniform(0, 1)))
        for s in (-1, 1):
            nk.beam(b, (-0.152, y + 0.0095, 0.004 if s > 0 else -0.06),
                    (0.152, y + 0.0095, -0.06 if s > 0 else 0.004), 0.004,
                    0.0065, JETTY_DK, up=(0, 1, 0))
    # Mooring posts rising through the deck at the far corners.
    for x in (-0.16, 0.16):
        nk.lathe(b, [(0.0092, -0.082), (0.0092, 0.06), (0.0075, 0.064),
                     (0.0, 0.0648)], 10, JETTY_DK, at=(x, 0.488, 0),
                 rot=(0, 0, rnd.uniform(0, 1)))
        nk.lathe(b, [(0.0094, 0.0), (0.0097, 0.0035), (0.0094, 0.007)], 10,
                 IRON, at=(x, 0.488, 0.045))
    # A steel ladder down the +X side of the far end.
    for y in (0.43, 0.455):
        nk.beam(b, (0.174, y, 0.04), (0.174, y, -0.07), 0.0018, 0.0018, STEEL)
        nk.beam(b, (0.174, y, 0.04), (0.168, y, 0.04), 0.0016, 0.0016, STEEL)
    z = -0.06
    while z < 0.03:
        nk.beam(b, (0.174, 0.43, z), (0.174, 0.455, z), 0.0013, 0.0013, STEEL)
        z += 0.012
    # A coil of rope on the deck by the far post.
    for k in range(3):
        r = 0.006 + k * 0.0022
        pts = [Vector((0.13 + math.cos(a) * r, 0.46 + math.sin(a) * r,
                       0.0312 + k * 0.0004))
               for a in [i / 14 * TAU for i in range(15)]]
        fk.tube(b, pts, lambda t: 0.0011, 4, "wood:" + T("rope", "#c2ab7c"))
    obj = b.build(smooth=35)
    return finish("pier", [obj])


def stake():
    """A surveyor's wooden peg 5 cm tall, its top painted red, a scrap of
    red tape tied on and grass round its foot."""
    b = fk.Builder("stake-wood")
    nk.cube(b, (0.0052, 0.0052, 0.044), PEG, at=(0, 0, 0.018),
            rot=(0.03, -0.02, 0.3), bevel=0.0005, edge=0.01)
    nk.cube(b, (0.0056, 0.0056, 0.011), RED, at=(0.0003, -0.0002, 0.0445),
            rot=(0.03, -0.02, 0.3), bevel=0.0007, edge=0.01)
    tape = [(0.0, 0.041), (0.006, 0.039), (0.009, 0.031), (0.012, 0.026)]
    for (x0, z0), (x1, z1) in zip(tape, tape[1:]):
        v = [b.vert((x0 + 0.002, -0.0001, z0 + 0.0012)),
             b.vert((x1 + 0.002, 0.0006, z1 + 0.0012)),
             b.vert((x1 + 0.002, 0.0006, z1 - 0.0012)),
             b.vert((x0 + 0.002, -0.0001, z0 - 0.0012))]
        b.face(v, RED)
        b.face(list(reversed(v)), RED)
    tuft_at(b, 121, (0, 0, 0), n=12, h=0.011, root=0.005)
    obj = b.build(smooth=30)
    return finish("stake", [obj])


# ---------------------------------------------------------------- mountains

def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def ridged(v, octaves=3, lac=2.1):
    """Ridged multi-octave noise around 1.0: sharp crests, soft gullies."""
    r, amp, tot = 0.0, 1.0, 0.0
    v = Vector(v)
    for _ in range(octaves):
        r += amp * (1 - abs(noise.noise(v)))
        tot += amp
        v = v * lac
        amp *= 0.5
    return r / tot * 1.6


def grid_mesh(b, n, pos, mat):
    """An (n+1) x (n+1) grid of vertices at pos(u, v) (u, v in -1..1),
    joined into quads. Returns the vertex rows."""
    rows = []
    for j in range(n + 1):
        v = -1 + 2 * j / n
        rows.append([b.vert(pos(-1 + 2 * i / n, v)) for i in range(n + 1)])
    for j in range(n):
        for i in range(n):
            b.face([rows[j][i], rows[j][i + 1], rows[j + 1][i + 1],
                    rows[j + 1][i]], mat)
    return rows


def decimate(obj, target):
    n = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if n > target:
        mod = obj.modifiers.new("decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.use_collapse_triangulate = True
        mod.ratio = target / n
        kit.apply(obj)
    return obj


def paint_faces(obj, rule, mats):
    """Give each face the material rule(centre, normal) names."""
    me = obj.data
    me.materials.clear()
    for m in mats:
        me.materials.append(kit.material(m))
    for p in me.polygons:
        p.material_index = mats.index(rule(Vector(p.center), Vector(p.normal)))
    me.update()


def scree_stones(b, rnd, count, place, size=(0.008, 0.026), mats=(SCREE,)):
    """Small broken stones: place(rnd) returns a ground point or None."""
    made = 0
    for k in range(count * 6):
        if made >= count:
            break
        at = place(rnd)
        if at is None:
            continue
        s = rnd.uniform(*size)
        bm = fk.fracture((s * rnd.uniform(0.9, 1.4), s, s * rnd.uniform(0.55,
                                                                       0.9)),
                         rnd.randrange(1 << 20), cuts=4, bevel=0.0,
                         max_edge=1.0, wobble=0.01, lo=0.6, hi=0.85)
        fk.place(bm, fk.block_matrix(at, rnd.uniform(0, TAU),
                                     (rnd.uniform(-0.4, 0.4),
                                      rnd.uniform(-0.4, 0.4))))
        b.merge(bm, rnd.choice(mats))
        bm.free()
        made += 1


def hewn(size, seed, cuts=8, lo=0.62, hi=0.9, bevel=0.006, max_edge=0.09,
         wobble=0.01, avoid=(), flat_top=False):
    """fk.fracture with a say over the cuts: no plane may face any of the
    `avoid` directions (so a tunnel face stays whole and plumb), and a flat
    top can be asked for. Returns a bmesh centred on the origin."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    made = 0
    tries = 0
    while made < cuts and tries < cuts * 20:
        tries += 1
        n = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1) * 0.9))
        if made < 1 and flat_top:
            n = Vector((rnd.gauss(0, 0.2), rnd.gauss(0, 0.2), 1))
        n.normalize()
        if any(n.dot(Vector(a)) > 0.15 for a in avoid):
            continue
        support = abs(n.x) * hx + abs(n.y) * hy + abs(n.z) * hz
        k = rnd.uniform(lo, hi)
        if made < 1 and flat_top:
            k = rnd.uniform(0.88, 0.97)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6,
                                     plane_co=n * support * k, plane_no=n,
                                     clear_outer=True)
        edges = [e for e in res["geom_cut"]
                 if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        made += 1
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if bevel:
        sharp = [e for e in bm.edges if e.is_manifold and
                 e.calc_face_angle(0) > math.radians(28)]
        bmesh.ops.bevel(bm, geom=sharp, offset=bevel, offset_type="OFFSET",
                        segments=1, profile=0.5, affect="EDGES",
                        clamp_overlap=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY",
                          ngon_method="BEAUTY")
    for _ in range(2):
        long = [e for e in bm.edges if e.calc_length() > max_edge]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY",
                              ngon_method="BEAUTY")
    if wobble:
        off = fk.rvec(rnd)
        sz = max(size)
        for v in bm.verts:
            d = Vector(noise.noise_vector(v.co * (2.2 / sz) + off)) * wobble * sz
            for a in avoid:
                a = Vector(a)
                d -= a * d.dot(a)
            v.co += d
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def flatten_face(bm, axis, at):
    """Saw a block off flat at the plane axis . p = at, filling the cut."""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6,
                                 plane_co=Vector(axis) * at, plane_no=axis,
                                 clear_outer=True)
    edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces
                                         if len(f.verts) > 3])


SIDES = ((1, 0), (0, 1), (-1, 0), (0, -1))


def cut(bm, co, no, clear=True):
    """Bisect a bmesh by a plane; with `clear`, drop what lies beyond it
    and cap the hole (a sawn facet)."""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=co,
                                 plane_no=no, clear_outer=clear)
    if clear:
        edges = [e for e in res["geom_cut"]
                 if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)


def slope_plane(az, slope, through):
    a = math.radians(slope)
    n = Vector((math.cos(az) * math.sin(a), math.sin(az) * math.sin(a),
                math.cos(a)))
    return Vector(through), n


def plane_z(co, no, x, y):
    return co.z - (no.x * (x - co.x) + no.y * (y - co.y)) / no.z


def massif(name, seed, half, H, summits, strata=0.035,
           snow=0.82, dip=(0.12, -0.08), portals=False, slabs=18,
           slab_size=0.2, max_edge=0.1, slab_top=0.62):
    """A mountain cast like a painted resin rock. Each summit is a block
    sawn into a faceted pyramid by planes through its top (steep near the
    summit, gentler shoulders lower down); the summits union into a range.
    Tilted strata cuts paint it in bands of warm grey with a snowfield
    above `snow` x H; fractured slabs dip out of the slopes as ledges.
    With `portals`, the four side midpoints stay plumb, flat and at least
    0.25 m high at `half` (a straight tunnel crosses either axis)."""
    rnd = random.Random(seed)
    off = Vector((seed * 1.9, 0.4, 2.2))
    portal_pts = []
    if portals:
        for ax, ay in SIDES:
            for t in range(-4, 5):
                lat = t / 4 * 0.22
                portal_pts.append((ax * half - ay * lat, ay * half + ax * lat))
    b = fk.Builder(name + "-rock")
    for si, (sx, sy, sh, planes) in enumerate(summits):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        span = 2 * half + 0.2
        bmesh.ops.scale(bm, vec=(span, span, sh + 0.1), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(sx * 0.0, sy * 0.0, (sh + 0.1) / 2 - 0.05),
                            verts=bm.verts)
        for plane in planes:
            # Plane through a point d0 out from this summit at height z0
            # (absolute shoulders carry d0 < 0: measured from the centre);
            # ("abs", co, no) gives the plane outright.
            if plane[0] == "abs":
                co, no = Vector(plane[1]), Vector(plane[2]).normalized()
                cut(bm, co, no)
                continue
            az, slope, d0, z0 = plane
            if d0 >= 0:
                p = Vector((sx + math.cos(az) * d0, sy + math.sin(az) * d0, z0))
            else:
                p = Vector((math.cos(az) * -d0, math.sin(az) * -d0, z0))
            co, no = slope_plane(az, slope, p)
            cut(bm, co, no)
        for ax, ay in SIDES:
            cut(bm, Vector((ax * half, ay * half, 0)), Vector((ax, ay, 0)))
        cut(bm, Vector((0, 0, -0.012)), Vector((0, 0, -1)))
        b.merge(bm, CRAG)
        bm.free()
    # Ledges: fractured slabs dipping out of the slopes.
    slab_tag = b.bm.faces.layers.int.new("slab")
    tree = fk.bvh(b)
    made = 0
    for k in range(slabs * 30):
        if made >= slabs:
            break
        x, y = rnd.uniform(-half * 0.9, half * 0.9), rnd.uniform(-half * 0.9,
                                                                  half * 0.9)
        hit = tree.ray_cast(Vector((x, y, H * 3)), Vector((0, 0, -1)))
        if hit[0] is None or hit[0].z < H * 0.2 or hit[0].z > H * slab_top:
            continue
        if portals and max(abs(x), abs(y)) > half - 0.06:
            continue
        w = slab_size * rnd.uniform(0.7, 1.25)
        bm = hewn((w, w * rnd.uniform(0.55, 0.8), w * rnd.uniform(0.28, 0.4)),
                  seed * 37 + k, cuts=7, bevel=w * 0.03, max_edge=max_edge,
                  flat_top=True, lo=0.62, hi=0.88)
        nrm = hit[1]
        out = math.atan2(nrm.y, nrm.x)
        fk.place(bm, fk.block_matrix(hit[0] - nrm * w * 0.12, out +
                                     rnd.uniform(-0.5, 0.5),
                                     (dip[0] + rnd.uniform(-0.12, 0.12),
                                      dip[1] + rnd.uniform(-0.12, 0.12))))
        for ax, ay in SIDES:
            cut(bm, Vector((ax * half, ay * half, 0)), Vector((ax, ay, 0)))
        for f in b.merge(bm, CRAG):
            f[slab_tag] = 1
        bm.free()
        made += 1
    # Strata bands and the snowfield: cut through, painted per band.
    dn = Vector((dip[0], dip[1], 1)).normalized()
    geom = b.bm.verts[:] + b.bm.edges[:] + b.bm.faces[:]
    z = strata * 0.5
    while z < H * 1.1:
        res = bmesh.ops.bisect_plane(b.bm, geom=b.bm.verts[:] + b.bm.edges[:] +
                                     b.bm.faces[:], dist=1e-6,
                                     plane_co=(0, 0, z), plane_no=dn)
        z += strata * rnd.uniform(0.8, 1.25)
    sn = Vector((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), 1)).normalized()
    bmesh.ops.bisect_plane(b.bm, geom=b.bm.verts[:] + b.bm.edges[:] +
                           b.bm.faces[:], dist=1e-6, plane_co=(0, 0, H * snow),
                           plane_no=sn)
    bmesh.ops.triangulate(b.bm, faces=[f for f in b.bm.faces
                                       if len(f.verts) > 4])
    for _ in range(2):
        long = [e for e in b.bm.edges if e.calc_length() > max_edge * 1.5]
        if not long:
            break
        bmesh.ops.subdivide_edges(b.bm, edges=long, cuts=1,
                                  use_grid_fill=False)
        bmesh.ops.triangulate(b.bm, faces=[f for f in b.bm.faces
                                           if len(f.verts) > 3])
    shade = {}
    for f in b.bm.faces:
        f.normal_update()
        c = f.calc_center_median()
        above = (c - Vector((0, 0, H * snow))).dot(sn)
        if f[slab_tag]:
            above -= H * 0.08
        band = int(math.floor(c.dot(dn) / strata))
        if band not in shade:
            shade[band] = rnd.choice((CRAG, CRAG, CRAG_DK))
        if (above > 0 and f.normal.z > 0.5) or \
                (above > H * 0.05 and f.normal.z > 0.3) or \
                (above > -H * 0.03 and f.normal.z > 0.9):
            mat = SNOW
        else:
            mat = shade[band]
        f.material_index = b.mat(mat)
        b.planar(f)
    return b


def peak(name, seed, apex, horns, rot=0.0):
    """A craggy one-square mountain for a tunnel to cross on either axis:
    a faceted resin massif within 0.86 x 0.86 m whose side midpoints are
    plumb, flat rock faces at least 0.25 m high at 0.43 m from the centre
    (the game sets tunnel portals on them), rising in strata to a sharp,
    snow-capped summit; buttresses either side of each portal and scree
    heaped in the four corners, clear of the tunnel lines."""
    rnd = random.Random(seed)
    half = 0.43
    ax_, ay_, H = apex
    # Four buttresses carry the tunnel faces: broad, flat-topped spurs
    # with cliff flanks, rising gently towards the middle.
    summits = []
    for k in range(4):
        beta = k * math.pi / 2
        out = Vector((math.cos(beta), math.sin(beta), 0))
        side = Vector((-math.sin(beta), math.cos(beta), 0))
        # A hipped nose over the portal...
        planes = [slope_plane(beta + rnd.uniform(-0.15, 0.15),
                              rnd.uniform(46, 56),
                              out * half + Vector((0, 0, rnd.uniform(0.29,
                                                                     0.31))))]
        for sgn in (-1, 1):
            # ...a pitched back, its ridge rising towards the summit...
            planes.append(slope_plane(
                beta + sgn * math.radians(rnd.uniform(72, 80)),
                rnd.uniform(16, 22),
                out * half + side * sgn * 0.225 + Vector((0, 0, 0.258))))
            # ...and cliff flanks falling to the corners.
            planes.append(slope_plane(
                beta + sgn * math.pi / 2 + rnd.uniform(-0.1, 0.1),
                rnd.uniform(74, 80),
                out * half + side * sgn * rnd.uniform(0.25, 0.28)))
            planes.append(slope_plane(
                beta + sgn * math.radians(rnd.uniform(50, 62)),
                rnd.uniform(64, 72),
                out * half + side * sgn * rnd.uniform(0.27, 0.3)))
        # The inner end falls away into the heart.
        planes.append(slope_plane(beta + math.pi, rnd.uniform(38, 46),
                                  out * rnd.uniform(0.12, 0.18) +
                                  Vector((0, 0, 0.3))))
        # Keep this side's tunnel face whole: no plane may come lower than
        # 0.255 m over it.
        face_pts = [out * half + side * (t / 4 * 0.22) for t in range(-4, 5)]
        held = []
        for co, no in planes:
            low = min(plane_z(co, no, p.x, p.y) for p in face_pts)
            if low < 0.255:
                co = co + Vector((0, 0, 0.255 - low))
            held.append(("abs", co, no))
        summits.append((0, 0, 0.4, held))
    # The summit: a faceted pyramid rising out of the four spurs and
    # falling steeply into the corner couloirs.
    summits.append((ax_, ay_, H,
                    [(m / 9 * TAU + rnd.uniform(-0.18, 0.18), rnd.uniform(34, 44),
                      0.008, H - 0.004) for m in range(9)]))
    # Horns on its shoulders.
    for k, (hx, hy, hh) in enumerate(horns):
        n = 6
        summits.append((hx, hy, hh,
                        [(k * 1.3 + m / n * TAU + rnd.uniform(-0.25, 0.25),
                          rnd.uniform(50, 62), 0.012, hh - 0.006)
                         for m in range(n)]))
    b = massif(name, seed, half, H, summits, strata=0.032, snow=0.8,
               portals=True, slabs=8, slab_size=0.1, max_edge=0.1,
               slab_top=0.8)
    # Buttresses either side of each portal face, standing a little proud.
    for k, (ax, ay) in enumerate(SIDES):
        out = Vector((ax, ay, 0))
        side = Vector((-ay, ax, 0))
        for s in (-1, 1):
            h2 = rnd.uniform(0.09, 0.15)
            w = rnd.uniform(0.1, 0.13)
            bm = hewn((w, w * 0.9, h2), seed * 13 + k * 2 + (s > 0), cuts=8,
                      bevel=0.005, lo=0.62, hi=0.88, max_edge=0.07)
            c = out * (half - 0.02) + side * s * rnd.uniform(0.32, 0.35)
            fk.place(bm, fk.block_matrix((c.x, c.y, h2 / 2 - 0.025),
                                         rnd.uniform(0, TAU),
                                         (rnd.uniform(-0.1, 0.1),
                                          rnd.uniform(-0.1, 0.1))))
            faces = b.merge(bm, rnd.choice((CRAG, CRAG_DK)))
            bm.free()
    tree = fk.bvh(b)
    fk.moss_on(b, tree, seed, 12, (-0.4, -0.4, 0.4, 0.4), 0.03, ALP,
               min_nz=0.75, cluster=0.05, flat=0.35, sub=2, top=2.0)
    fk.moss_on(b, tree, seed + 3, 10, (-0.4, -0.4, 0.4, 0.4), 0.02, MOSS,
               min_nz=0.65, cluster=0.04, flat=0.35, sub=1, top=2.0)
    obj = b.build(smooth=30)
    me = obj.data
    names = [m.name for m in me.materials]
    if SNOW in names:
        si = names.index(SNOW)
        for p in me.polygons:
            if names[p.material_index] in (ALP, MOSS) and p.center.z > 0.32:
                p.material_index = si
    fk.drop_buried(obj, z=-0.008)
    for v in obj.data.vertices:
        v.co.x = max(-0.497, min(0.497, v.co.x))
        v.co.y = max(-0.497, min(0.497, v.co.y))
    # Scree heaped against the corners.
    sb = fk.Builder(name + "-scree")
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        for m in range(2):
            aa = a + rnd.uniform(-0.2, 0.2)
            r = rnd.uniform(0.46, 0.5)
            at = Vector((math.cos(aa) * r, math.sin(aa) * r, -0.004))
            fk.cushion(sb, at, (0, 0, 1), rnd.uniform(0.055, 0.075),
                       seed * 7 + k * 5 + m, SCREE, flat=0.55, sub=2, sink=0.3)

    def place(rnd):
        a = rnd.uniform(0, TAU)
        r = rnd.uniform(0.4, 0.64)
        x, y = math.cos(a) * r, math.sin(a) * r
        if max(abs(x), abs(y)) > 0.48 or min(abs(x), abs(y)) < 0.25:
            return None
        hit = tree.ray_cast(Vector((x, y, 1.0)), Vector((0, 0, -1)))
        z = hit[0].z if hit[0] is not None and hit[0].z < 0.1 else 0.0
        return (x, y, z)
    scree_stones(sb, rnd, 40, place, size=(0.012, 0.03),
                 mats=(SCREE, CRAG, CRAG_DK))
    scr = sb.build(smooth=30)
    fk.drop_buried(scr, z=-0.004)
    for v in scr.data.vertices:
        v.co.x = max(-0.497, min(0.497, v.co.x))
        v.co.y = max(-0.497, min(0.497, v.co.y))
    return finish(name, [obj, scr])


def peak_a():
    """One sharp summit north of centre, a lower horn to the south-west."""
    return peak("peak_a", 5, (0.05, 0.08, 0.42), [(-0.17, -0.1, 0.35)])


def peak_b():
    """Twin horns on an east-west ridge."""
    return peak("peak_b", 9, (-0.1, 0.05, 0.42), [(0.15, 0.1, 0.395),
                                                   (0.05, -0.17, 0.33)])


def mountain(name, seed, summits, H, trees=150):
    """A big background mountain on a 3 x 3 m footprint, in the same
    painted resin as the peaks: faceted summits unioned into a range,
    strata bands, snowfields, alpine turf on the low shoulders and a
    band of little conifers round its foot."""
    rnd = random.Random(seed)
    half = 1.47
    tops = []
    for sx, sy, sh in summits:
        mz = sh * 0.72
        body = []
        for k in range(4):
            beta = k * math.pi / 2 + rnd.uniform(-0.5, 0.5)
            for sgn in (-1, 1):
                body.append((beta + sgn * math.radians(rnd.uniform(30, 42)),
                             rnd.uniform(30, 38), 0.0, mz))
            body.append((beta + math.pi / 4, rnd.uniform(40, 48), 0.0,
                         mz - 0.05))
        tops.append((sx * 0.9, sy * 0.9, mz, body))
        tops.append((sx, sy, sh, [(k / 7 * TAU + rnd.uniform(-0.25, 0.25),
                                   rnd.uniform(50, 62), 0.03, sh - 0.015)
                                  for k in range(7)]))
    b = massif(name, seed, half, H, tops, strata=0.09, snow=0.62,
               slabs=26, slab_size=0.36, max_edge=0.28)
    obj = b.build(smooth=30)
    fk.drop_buried(obj, z=-0.01)
    me = obj.data
    names = [m.name for m in me.materials]
    for m in (ALP, FOREST):
        if m not in names:
            me.materials.append(kit.material(m))
            names.append(m)
    off = Vector((seed * 0.7, 2.0, 1.0))
    for p in me.polygons:
        c, n = Vector(p.center), Vector(p.normal)
        if names[p.material_index] == SNOW:
            continue
        w = noise.noise(c * 1.5 + off)
        if c.z < H * 0.16 + 0.05 * w and n.z > 0.45:
            p.material_index = names.index(FOREST)
        elif c.z < H * 0.3 and n.z > 0.9:
            p.material_index = names.index(ALP)
    kit.uv_box(obj)
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(obj, dg)
    fb = fk.Builder(name + "-forest")
    made = 0
    for k in range(trees * 40):
        if made >= trees:
            break
        x, y = rnd.uniform(-half, half), rnd.uniform(-half, half)
        hit = tree.ray_cast(Vector((x, y, 5)), Vector((0, 0, -1)))
        if hit[0] is None:
            # Round the foot, on the ground itself.
            d = max(abs(x), abs(y))
            if d > half - 0.05 or rnd.random() < 0.5:
                continue
            ground = Vector((x, y, 0.0))
            near = tree.find_nearest(ground)
            if near[0] is None or (near[0] - ground).length > 0.22:
                continue
            at = ground
        else:
            if hit[1].z < 0.55:
                continue
            mi = me.polygons[hit[2]].material_index
            if names[mi] != FOREST:
                continue
            at = hit[0]
        hgt = rnd.uniform(0.06, 0.11)
        r = hgt * rnd.uniform(0.26, 0.34)
        base = at - Vector((0, 0, 0.01))
        ring = [fb.vert(base + Vector((math.cos(a) * r, math.sin(a) * r,
                                       0.014)))
                for a in [rnd.uniform(0, 1) + i / 5 * TAU for i in range(5)]]
        tip = fb.vert(base + Vector((rnd.uniform(-0.005, 0.005),
                                     rnd.uniform(-0.005, 0.005), hgt)))
        mat = PINE[1] if rnd.random() < 0.35 else PINE[0]
        for i in range(5):
            fb.face([ring[i], ring[(i + 1) % 5], tip], mat)
        made += 1
    forest = fb.build(smooth=70)
    return finish(name, [obj, forest])


def mountain_a():
    """A tall alp: one sharp summit, a shoulder and two spurs."""
    return mountain("mountain_a", 3, [(0.12, 0.22, 1.55), (-0.62, -0.18, 1.1),
                                      (0.7, -0.5, 0.85), (0.35, 0.85, 0.95)],
                    H=1.55)


def mountain_b():
    """A long, twin-peaked ridge, lower and broader."""
    return mountain("mountain_b", 7, [(-0.48, 0.18, 1.3), (0.42, 0.05, 1.22),
                                      (0.05, -0.62, 0.8), (0.95, 0.72, 0.7)],
                    H=1.3)


def rubble():
    """A rock fall across a route: a heap of freshly broken stone in a
    0.8 m square, a skirt of dust and grit, a few big boulders."""
    S = 5
    with nk.work(S):
        rnd = random.Random(131)
        b = fk.Builder("rubble-stone")
        off = Vector((1.3, 4.1, 0.2))

        def h_at(x, y):
            r = math.hypot(x * 1.08, y * 0.95) / 1.7
            r *= 1 + 0.12 * noise.noise(Vector((x, y, 0)) * 0.9 + off)
            return 0.42 * max(0.0, 1 - r * r) ** 0.9
        # The dust skirt: a low, lumpy disc.
        dust = []
        for k in range(5):
            a = k / 5 * TAU + rnd.uniform(-0.3, 0.3)
            rr = rnd.uniform(0.7, 1.2)
            dust.append((Vector((math.cos(a) * rr, math.sin(a) * rr, -0.06)),
                         rnd.uniform(0.75, 0.95), 30 + k,
                         {"squash": 0.22, "under": 0.1, "rough": 0.2,
                          "sub": 2}))
        dust.append((Vector((0, 0, -0.05)), 1.4, 39,
                     {"squash": 0.24, "under": 0.1, "rough": 0.15}))
        bm = fk.fuse(dust, 500, voxel=0.06, smooth=2, crumb=0.02, grain=4)
        b.merge(bm, DUST)
        bm.free()
        boulders = [((0.62, 0.5, 0.48), (-0.3, 0.15), 0.3),
                    ((0.48, 0.42, 0.4), (0.55, -0.25), 1.2),
                    ((0.42, 0.4, 0.3), (-0.95, -0.6), 2.0),
                    ((0.36, 0.32, 0.3), (0.95, 0.8), 0.7)]
        for i, (size, (x, y), yaw) in enumerate(boulders):
            bm = fk.fracture(size, 140 + i, cuts=9, bevel=0.02, max_edge=1.0,
                             wobble=0.01)
            z = h_at(x, y) * 0.55
            fk.place(bm, fk.block_matrix((x, y, z), yaw,
                                         (rnd.uniform(-0.3, 0.3),
                                          rnd.uniform(-0.3, 0.3))))
            b.merge(bm, FRESH if i % 2 == 0 else ROCK)
            bm.free()
        made = 0
        for k in range(600):
            if made >= 85:
                break
            a = rnd.uniform(0, TAU)
            r = 1.9 * math.sqrt(rnd.random())
            x, y = math.cos(a) * r, math.sin(a) * r
            if max(abs(x), abs(y)) > 1.9:
                continue
            hz = h_at(x, y)
            s = rnd.uniform(0.06, 0.2) * (1.0 if hz > 0.05 else 0.7)
            bm = fk.fracture((s * rnd.uniform(1.0, 1.5), s,
                              s * rnd.uniform(0.5, 0.85)), 200 + k, cuts=5,
                             bevel=0.0, max_edge=1.0, wobble=0.012)
            fk.place(bm, fk.block_matrix((x, y, max(0.0, hz - s * 0.25)),
                                         rnd.uniform(0, TAU),
                                         (rnd.uniform(-0.6, 0.6),
                                          rnd.uniform(-0.6, 0.6))))
            b.merge(bm, rnd.choice((FRESH, FRESH, ROCK, ROCK_DK)))
            bm.free()
            made += 1
        obj = b.build(smooth=30)
        fk.drop_buried(obj, z=-0.03)
    return finish("rubble", [obj], S)


# ================================================================ build

ASSETS = [oak_a, oak_b, oak_c, pine_a, pine_b, birch, poplar,
          bush_a, bush_b, flowers, reeds, hedge, stone_wall, fence,
          rock_a, rock_b, rock_c, peak_a, peak_b, mountain_a, mountain_b,
          rubble, buffer_stop, road_barrier, signpost, rail_signal, lamp,
          hay_bale, pier, stake]
# Assets whose AO is baked apart, with their own reach and ground.
BIG = {"mountain_a", "mountain_b", "peak_a", "peak_b"}
NO_GROUND = {"pier"}


def clone(root, location, turn=0.0, scale=1.0):
    """A linked copy for a preview scene (never exported)."""
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


def main():
    argv = sys.argv
    rest = argv[argv.index("--") + 1:] if "--" in argv else []
    out = rest[0] if rest else None
    preview = rest[1] if len(rest) > 1 and rest[1].endswith(".png") else None
    opts = dict(a.split("=", 1) for a in rest if "=" in a)
    only = set(opts["only"].split(",")) if "only" in opts else None
    views = set(opts["views"].split(",")) if "views" in opts else None

    roots, meshes = [], []
    for i, build in enumerate(ASSETS):
        if only and build.__name__ not in only:
            continue
        root, objs = build()
        roots.append(root)
        meshes += objs
    by = {r.name: r for r in roots}
    # Spread the roots out for the bake so they never shade each other.
    spot = {}
    x = 0.0
    for r in roots:
        lo, hi = nk.bounds(r)
        w = hi.x - lo.x
        spot[r.name] = (x - lo.x + 0.3, 0.0 if r.name not in BIG else 10.0)
        x += w + 0.6
    for r in roots:
        r.location = (*spot[r.name], 0)
    kit.refresh()

    print("=" * 70)
    for r in roots:
        nk.report(r)
        if r.name.startswith("peak_"):
            portal_check(r)
    print("=" * 70)

    for m in meshes:
        if m.name in NORMALS and NORMALS[m.name]:
            fk.set_normals(m, NORMALS[m.name])
    small = [m for m in meshes if m.parent.name not in BIG | NO_GROUND]
    big = [m for m in meshes if m.parent.name in BIG]
    wet = [m for m in meshes if m.parent.name in NO_GROUND]
    if small:
        kit.bake_ao(small, samples=96, distance=0.035)
    if big:
        kit.bake_ao(big, samples=96, distance=0.2)
    if wet:
        water = kit.box("__water", (40, 40, 0.02), (0, 0, -0.03), grid=False)
        kit.bake_ao(wet, samples=96, distance=0.035, ground=False)
        bpy.data.objects.remove(water, do_unlink=True)
    for m in meshes:
        if m.name in SOFT:
            fk.smooth_ao(m, floor=0.3)
        if m.name in LIGHT and LIGHT[m.name]:
            fk.light_ao(m, LIGHT[m.name])

    for r in roots:
        r.location = (0, 0, 0)
    kit.refresh()
    if out:
        kit.export(roots, out)
    if preview:
        previews(preview, by, views)


def portal_check(root):
    """Cast rays at the four tunnel faces: where does rock start, over the
    portal opening (|lateral| <= 0.2, z 0.01 .. 0.24)?"""
    from mathutils.bvhtree import BVHTree
    kit.refresh()
    dg = bpy.context.evaluated_depsgraph_get()
    rock = next(o for o in root.children if o.name.endswith("-rock"))
    tree = BVHTree.FromObject(rock, dg)
    inv = rock.matrix_world.inverted()
    for ax, ay in SIDES:
        out = Vector((ax, ay, 0))
        side = Vector((-ay, ax, 0))
        ds = []
        for t in range(-10, 11):
            for zz in range(1, 13):
                p = root.matrix_world @ (out * 0.8 + side * (t / 10 * 0.2) +
                                         Vector((0, 0, zz * 0.02)))
                hit = tree.ray_cast(inv @ p, -out)
                if hit[0] is None:
                    ds.append(None)
                else:
                    ds.append(round(Vector(hit[0]).dot(out), 4))
        good = [d for d in ds if d is not None]
        print(f"  portal {root.name} side ({ax:+d},{ay:+d}): face at "
              f"{min(good):.4f}..{max(good):.4f} m from centre, "
              f"{ds.count(None)} misses of {len(ds)}")


def lineup(names, by, per_row=4, cell=1.0, gap=0.0):
    """Put roots in a row of 1 m squares, one per square, and return the
    reference squares under them."""
    marks = []
    names = [n for n in names if n in by]
    for i, n in enumerate(names):
        cx = (i % per_row) * cell
        cy = -(i // per_row) * cell
        by[n].location = (cx, cy, 0)
        marks.append(nk.ref_square("__ref-" + n, (cx, cy)))
    kit.refresh()
    return [by[n] for n in names], marks


def drop(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def park(by):
    for r in by.values():
        r.location = (0, 0, -100)
    kit.refresh()


def strip(name, at, length, width, mat, axis="y", z=0.012):
    """A road or track stand-in for previews (never exported)."""
    size = (width, length, 0.004) if axis == "y" else (length, width, 0.004)
    o = kit.box(name, size, (*at, z - 0.002), mat=mat, grid=False)
    kit.fill_ao([o])
    return o


def diorama(path, by):
    """The overview: a corner of a layout at the game's angle, with a
    road and a railway crossing it, a tunnel mountain, fields, a pond and
    a background alp (clones; never exported)."""
    park(by)
    rnd = random.Random(3)
    made, marks = [], []

    def put(name, x, y, turn=0.0, scale=1.0):
        if name in by:
            made.append(clone(by[name], (x, y), turn, scale))
    for i in range(5):
        for j in range(4):
            marks.append(nk.ref_square(f"__ref-{i}-{j}", (i, j)))
    # Road north-south through the tunnel at x = 1; rail east-west at y = 1.
    marks.append(strip("__road", (1, 1.5), 4.0, 0.3, "plain:preview-road",
                       "y", 0.012))
    marks.append(strip("__rail", (2.0, 1.0), 5.0, 0.24,
                       "plain:preview-ballast", "x", 0.022))
    for dy in (-0.045, 0.045):
        marks.append(strip("__rail-" + str(dy), (2.0, 1.0 + dy), 5.0, 0.008,
                           "metal:steel", "x", 0.04))
    water = kit.box("__pond", (1.6, 0.9, 0.002), (3.6, -0.05, 0.0005),
                    mat="plain:" + T("preview-water", "#3f7f86"), grid=False)
    kit.fill_ao([water])
    marks.append(water)
    put("peak_a", 1, 3)
    put("mountain_a", 2.4, 5.0)
    put("rubble", 0.0, 1.0, 0.3)
    put("buffer_stop", 4.3, 1.0, math.pi / 2)
    put("rail_signal", 3.3, 0.82)
    put("road_barrier", 1.0, 0.45)
    put("signpost", 1.22, 0.3)
    put("lamp", 0.8, 1.7)
    put("lamp", 0.8, 2.2)
    put("pier", 3.6, 0.35, math.pi / 2, 0.6)
    put("reeds", 2.9, -0.35)
    put("reeds", 3.05, 0.25, 1.0)
    put("reeds", 4.3, -0.4, 2.0)
    put("stake", 2.2, 0.62)
    put("stake", 2.45, 0.62)
    for k in range(4):
        put("hay_bale", 2.3 + k * 0.17, -0.1 + (k % 2) * 0.12, k * 0.5)
    put("hedge", 2.0, 0.5)
    put("hedge", 3.0, 0.5)
    put("fence", 2.0, -0.5)
    put("stone_wall", 2.5, 2.5, 0.0)
    put("stone_wall", 3.5, 2.5, 0.0)
    put("stone_wall", 4.0, 2.0, math.pi / 2)
    trees = ["oak_a", "oak_b", "oak_c", "birch", "poplar", "pine_a", "pine_b"]
    for k in range(16):
        x, y = rnd.uniform(2.6, 4.4), rnd.uniform(1.4, 2.4)
        put(rnd.choice(trees), x, y, rnd.uniform(0, TAU), rnd.uniform(0.85, 1.1))
    for k in range(10):
        x, y = rnd.uniform(-0.45, 0.45), rnd.uniform(1.6, 3.4)
        put(rnd.choice(["pine_a", "pine_b"]), x, y, rnd.uniform(0, TAU),
            rnd.uniform(0.85, 1.15))
    for k in range(5):
        put(rnd.choice(["poplar"]), 1.3, -0.35 + k * 0.2, 0, 1.0)
    for k in range(14):
        x, y = rnd.uniform(-0.45, 4.45), rnd.uniform(-0.45, 3.45)
        if abs(x - 1) < 0.25 or abs(y - 1) < 0.22:
            continue
        put(rnd.choice(["bush_a", "bush_b", "rock_a", "rock_b", "rock_c",
                        "flowers", "flowers"]), x, y, rnd.uniform(0, TAU))
    kit.refresh()
    if made:
        nk.shot(path, made, 55, 0, marks, size=1800, margin=0.95)
        nk.shot(path[:-4] + "-30.png", made, 55, 30, marks, size=1800,
                margin=0.95)
    drop(marks)
    for r in made:
        drop([k for k in r.children])
        bpy.data.objects.remove(r, do_unlink=True)


def previews(path, by, views):
    base = path[:-4]
    T("preview-road", "#3a3d42")
    T("preview-ballast", "#8d877c")
    if not views or "scene" in views:
        diorama(path, by)
    T("preview-road", "#3a3d42")
    T("preview-ballast", "#8d877c")

    def want(label):
        return not views or label in views

    def two(label, roots, marks, size=1400, margin=1.05):
        nk.shot(f"{base}-{label}.png", roots, 55, 0, marks, size=size,
                margin=margin)
        nk.shot(f"{base}-{label}-30.png", roots, 55, 30, marks, size=size,
                margin=margin)
    # Line-ups on 1 m squares from the game's camera.
    groups = {
        "trees": (["oak_a", "oak_b", "oak_c", "pine_a", "pine_b", "birch",
                   "poplar"], 4),
        "cover": (["bush_a", "bush_b", "flowers", "reeds", "hedge",
                   "stone_wall", "fence", "rock_a", "rock_b", "rock_c"], 5),
        "props": (["buffer_stop", "road_barrier", "signpost", "rail_signal",
                   "lamp", "hay_bale", "pier", "stake"], 4),
        "peaks": (["peak_a", "peak_b", "rubble"], 3),
    }
    for label, (names, per) in groups.items():
        if not want(label):
            continue
        park(by)
        roots, marks = lineup(names, by, per_row=per)
        if roots:
            two(label, roots, marks)
        drop(marks)
    if want("mountains"):
        park(by)
        names = [n for n in ("mountain_a", "mountain_b") if n in by]
        marks = []
        for i, n in enumerate(names):
            by[n].location = (i * 3.4, 0, 0)
            marks.append(nk.ref_square("__ref-" + n, (i * 3.4, 0), cells=3))
        kit.refresh()
        if names:
            two("mountains", [by[n] for n in names], marks)
        drop(marks)
    # Close-ups: one reference square behind, the assets in front.
    close = {
        "oak": {"oak_a": (-0.3, 0), "oak_b": (0, 0), "oak_c": (0.3, 0)},
        "conifer": {"pine_a": (-0.36, 0), "pine_b": (-0.12, 0),
                    "birch": (0.12, 0), "poplar": (0.36, 0)},
        "bush": {"bush_a": (-0.2, 0), "bush_b": (-0.06, 0),
                 "flowers": (0.06, 0), "reeds": (0.18, 0)},
        "rock": {"rock_a": (-0.18, 0), "rock_b": (-0.04, 0),
                 "rock_c": (0.14, 0)},
        "kit": {"buffer_stop": (-0.2, 0.09), "road_barrier": (0.06, 0.12),
                "signpost": (-0.24, -0.08), "rail_signal": (-0.1, -0.08),
                "lamp": (0.02, -0.08), "hay_bale": (0.12, -0.06),
                "stake": (0.2, -0.08)},
    }
    for label, spots in close.items():
        if not want(label):
            continue
        park(by)
        names = [n for n in spots if n in by]
        if not names:
            continue
        for n in names:
            by[n].location = (*spots[n], 0)
        kit.refresh()
        mark = nk.ref_square("__ref-close", (0, 0.35))
        two(label, [by[n] for n in names], [], size=1200, margin=1.1)
        drop([mark])
    if want("edges"):
        park(by)
        marks = []
        for i, n in enumerate(("hedge", "stone_wall", "fence")):
            if n in by:
                by[n].location = (0, -i * 0.12, 0)
        kit.refresh()
        roots = [by[n] for n in ("hedge", "stone_wall", "fence") if n in by]
        if roots:
            nk.shot(f"{base}-edges.png", roots, 55, 0, [], size=1600,
                    margin=0.62)
            nk.shot(f"{base}-edges-30.png", roots, 55, 30, [], size=1600,
                    margin=0.62)
    if want("pier") and "pier" in by:
        park(by)
        by["pier"].location = (0, 0, 0)
        kit.refresh()
        water = kit.box("__water", (1.2, 1.4, 0.004), (0, 0, -0.022),
                        mat="plain:" + T("preview-water", "#3f7f86"),
                        grid=False)
        kit.fill_ao([water])
        two("pier", [by["pier"]], [water], size=1200, margin=0.9)
        drop([water])
    if want("peak"):
        for n, axis in (("peak_a", "y"), ("peak_b", "x")):
            if n not in by:
                continue
            park(by)
            by[n].location = (0, 0, 0)
            kit.refresh()
            marks = [nk.ref_square("__ref-peak", (0, 0), cells=3)]
            if axis == "y":
                marks.append(strip("__road", (0, 0), 3.0, 0.3,
                                   "plain:preview-road", "y", 0.012))
            else:
                marks.append(strip("__rail", (0, 0), 3.0, 0.24,
                                   "plain:preview-ballast", "x", 0.022))
            two(n, [by[n]], marks, size=1300, margin=0.5)
            drop(marks)


main()
