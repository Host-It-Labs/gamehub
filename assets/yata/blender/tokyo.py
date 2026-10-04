"""Yata's Tokyo menu as 3D dishes, rendered for the night-market counter.

Kinds follow lib/games/trio/engine.ts: 0 Gyoza, 1 Ramen, 2 Yakitori,
3 Pickles, 4 Takoyaki, 5 Dango. Each dish matches its toon drawing in
public/art/yata-dishes-v3 / v4: the same vessel, colours and arrangement.

Render headless (all dishes, or a comma list of kinds):
  Blender -b --factory-startup --python assets/yata/blender/tokyo.py -- \
      --out assets/yata/renders/tokyo [--kinds 0,5] [--size 1200] [--samples 160]

Then `node scripts/yata-dish-renders.mjs` trims them into
public/art/optimized/yata-dish3d-tokyo-<kind>-v1.webp.
"""

import argparse
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector, noise as mnoise  # noqa: E402

import dishkit as K  # noqa: E402

TAU = math.tau

# ------------------------------------------------------------------ glazes


def glaze(name, body="#f7f3ea", band=None, band_from=0.86, band_to=1.01,
          line=None, rough=0.12):
    """Glazed ceramic: a body colour, an optional rim band (by profile
    radius) and a thin inner line, with a soft glossy coat."""
    mat, n, bsdf = K.principled(name, body, rough=rough, coat=0.6, coat_rough=0.05, spec=0.5)
    if band:
        pr = K.attr(n, "pr").outputs["Fac"]
        lo = K.math_node(n, "GREATER_THAN", pr, band_from)
        hi = K.math_node(n, "LESS_THAN", pr, band_to)
        m = K.math_node(n, "MULTIPLY", lo, hi)
        if line:
            l_lo = K.math_node(n, "GREATER_THAN", pr, line[0])
            l_hi = K.math_node(n, "LESS_THAN", pr, line[1])
            m = K.math_node(n, "MAXIMUM", m, K.math_node(n, "MULTIPLY", l_lo, l_hi))
        mix = n.add("ShaderNodeMix", data={"data_type": "RGBA"})
        mix.inputs["Factor"].default_value = 0.0
        n.link(m, mix.inputs["Factor"])
        mix.inputs["A"].default_value = K.rgb(body)
        mix.inputs["B"].default_value = K.rgb(band)
        n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    # Faint glaze ripple so large flat surfaces catch light unevenly.
    nz = K.noise(n, scale=2.5, detail=2.0)
    K.bump(n, bsdf, nz.outputs["Fac"], strength=0.04, distance=0.05)
    return mat


def plate_profile(radius=1.1, floor=0.1, rim_h=0.2, lip=0.03, foot=0.72):
    """A shallow plate, top surface from the centre out over the rim, then
    the underside back in to the foot ring."""
    r = radius
    pts = [
        (0.0, floor), (r * 0.55, floor), (r * 0.78, floor + 0.008),
        (r * 0.88, floor + 0.03), (r * 0.95, rim_h - 0.03), (r * 0.99, rim_h),
        (r * 1.0, rim_h - lip * 0.6), (r * 0.98, rim_h - lip * 1.6),
        (r * 0.9, floor * 0.75), (r * foot, 0.035), (r * foot - 0.02, 0.0),
        (r * foot - 0.07, 0.0), (r * foot - 0.08, 0.03), (0.0, 0.03),
    ]
    return K.smooth_profile(pts, steps=5)


def bamboo():
    mat, n, bsdf = K.principled("bamboo", "#e5c78f", rough=0.55)
    coord = n.add("ShaderNodeTexCoord")
    wave = n.add("ShaderNodeTexWave", Scale=14.0, Distortion=3.0, Detail=3.0)
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    n.link(coord.outputs["Object"], wave.inputs["Vector"])
    c = K.ramp(n, wave.outputs["Fac"], [(0.0, "#d9b475"), (0.6, "#ecd29d"), (1.0, "#e2bf84")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


# ------------------------------------------------------------------- dango


def mochi(name, color, shade):
    mat, n, bsdf = K.principled(name, color, rough=0.38, sss=0.3, coat=0.25,
                                coat_rough=0.25, sss_radius=(0.5, 0.35, 0.3), sheen=0.15)
    nz = K.noise(n, scale=18.0, detail=3.0)
    c = K.ramp(n, nz.outputs["Fac"], [(0.35, shade), (0.65, color)])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    K.bump(n, bsdf, nz.outputs["Fac"], strength=0.08, distance=0.02)
    return mat


def dango_ball(name, mat, centre, r, seed):
    bm = K.sphere(r, 48, 24)

    def squash(co):
        n = mnoise.noise(co * 3.0 + Vector((seed, seed * 2, 0)))
        co = co * (1 + 0.025 * n)
        co.z *= 0.88
        return co

    K.deform(bm, squash)
    obj = K.to_object(name, bm, mat, subsurf=1)
    obj.location = centre
    return obj


def skewer(name, a, b, radius=0.024, point=True):
    """A bamboo skewer from handle a to tip b."""
    a, b = Vector(a), Vector(b)
    obj = K.cylinder_between(name, a, b, radius, bamboo(), segments=16)
    bev = obj.modifiers.new("bevel", "BEVEL")
    bev.width = radius * 0.4
    bev.segments = 2
    return obj


def build_dango():
    plate = K.lathe(plate_profile(1.12, floor=0.09, rim_h=0.19), segments=160, n=6.0)
    obj = K.to_object("plate", plate, glaze("plate-blue-rim", "#efe9de", "#2a57c8", 0.9, 1.01))
    obj.rotation_euler.z = math.radians(-20)
    pink = mochi("pink", "#f27aa6", "#e8689a")
    white = mochi("white", "#fbf3e4", "#eee2cc")
    green = mochi("green", "#86bd35", "#76ab2b")
    r = 0.29
    floor = 0.09
    # Skewers run towards the diner, handles at the front right.
    angle = math.radians(-70)
    d = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-d.y, d.x, 0))
    for s, off in enumerate((-0.5, 0.0, 0.5)):
        base = side * off + d * -0.22
        z = floor + r * 0.88
        for b, mat in enumerate((pink, white, green)):
            c = base + d * ((b - 1) * r * 1.7)
            c.z = z
            dango_ball(f"dango{s}{b}", mat, c, r, s * 3 + b)
        handle = base + d * (r * 1.7 + r + 0.42)
        tip = base + d * -(r * 1.7 + r * 0.6)
        handle.z = floor + 0.05
        tip.z = z
        skewer(f"skewer{s}", handle, tip)


# ------------------------------------------------------------------- gyoza


BROWN_FACE = 0.85


def dough():
    """Pale dumpling skin, browned and crisp towards the pan-fried base."""
    mat, n, bsdf = K.principled("dough", "#efd9a8", rough=0.4, sss=0.2,
                                coat=0.35, coat_rough=0.2, sss_radius=(0.4, 0.3, 0.2))
    s = K.attr(n, "gs").outputs["Fac"]
    gc = K.attr(n, "gc").outputs["Fac"]
    nz = K.noise(n, scale=16.0, detail=6.0, rough=0.65)
    wobble = K.math_node(n, "MULTIPLY", K.math_node(n, "SUBTRACT", nz.outputs["Fac"], 0.5), 0.9)
    # Fried on one face as well as the base, so the tilted side shows the crisp.
    face = K.math_node(n, "MULTIPLY", K.math_node(n, "MAXIMUM", gc, 0.0), BROWN_FACE)
    crust = K.math_node(n, "SUBTRACT", K.math_node(n, "ADD", s, wobble), face)
    c = K.ramp(n, crust, [(0.0, "#7f3a10"), (0.14, "#b8641f"), (0.3, "#dc9a46"),
                          (0.5, "#edc985"), (0.7, "#f3e3bd")])
    fine = K.noise(n, scale=60.0, detail=2.0)
    mix = n.add("ShaderNodeMix", data={"data_type": "RGBA", "blend_type": "MULTIPLY"})
    mix.inputs["Factor"].default_value = 0.12
    n.link(c.outputs["Color"], mix.inputs["A"])
    n.link(fine.outputs["Color"], mix.inputs["B"])
    n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    K.bump(n, bsdf, nz.outputs["Fac"], strength=0.12, distance=0.03)
    return mat


def gyoza(name, mat, L=0.58, W=0.21, H=0.36, bend=0.22, pleats=8, seed=0):
    """A pan-fried dumpling standing on its flat base: a crescent with a
    pleated crest along the top."""

    def section(u, v):
        t = 2 * v - 1
        env = max(1 - t * t, 0.0)
        w = W * env ** 0.55
        h = H * env ** 0.42
        a = u * TAU
        ca, sa = math.cos(a), math.sin(a)
        if sa >= 0:
            y = w * ca * (1 - 0.35 * sa ** 3)
            z = h * sa
        else:
            y = w * ca
            z = h * sa * 0.12
        crest = math.exp(-((ca / 0.24) ** 2)) * (1 if sa > 0 else 0)
        phase = (t + 1) * pleats * math.pi
        z += crest * env ** 0.5 * (0.08 + 0.05 * math.sin(phase))
        y += crest * env ** 0.6 * 0.06 * math.cos(phase)
        y += bend * t * t - bend * 0.5
        x = L * t
        return (x, y, z + h * 0.12)

    def attrs(u, v):
        # gs: up the side (-1 base, 1 crest); gc: across (which face).
        return {"gs": math.sin(u * TAU), "gc": math.cos(u * TAU)}

    bm = K.grid_surface(section, 48, 40, close_u=True, attrs=attrs)
    return K.to_object(name, bm, mat, subsurf=1)


def scallion():
    mat, n, bsdf = K.principled("scallion", "#5cc226", rough=0.35, sss=0.1, coat=0.3)
    return mat


def scallion_bits(bvh, count, centre, spread, seed, rings=False, slivers=False):
    """Little green onion pieces dropped onto the food."""
    rnd = K.rng(seed)
    mat = scallion()
    inner = K.principled("scallion-in", "#c9e886", rough=0.4, sss=0.2)[0]
    out = []
    for i in range(count):
        x = centre[0] + rnd.uniform(-spread[0], spread[0])
        y = centre[1] + rnd.uniform(-spread[1], spread[1])
        loc, normal = K.drop(bvh, x, y)
        if loc is None:
            continue
        r = rnd.uniform(0.028, 0.04) if not rings else rnd.uniform(0.05, 0.065)
        if slivers:
            r = rnd.uniform(0.032, 0.042)
        bm = bmesh.new()
        if rings:
            bmesh.ops.create_cone(bm, cap_ends=False, segments=20, radius1=r, radius2=r, depth=0.025)
            # Thicken into a tube.
            obj = K.to_object(f"ring{i}", bm, mat)
            sol = obj.modifiers.new("solid", "SOLIDIFY")
            sol.thickness = r * 0.35
            sol.material_offset = 1
            obj.data.materials.append(inner)
        else:
            bmesh.ops.create_cone(bm, cap_ends=False, segments=12, radius1=r, radius2=r, depth=0.012)
            obj = K.to_object(f"bit{i}", bm, mat)
            sol = obj.modifiers.new("solid", "SOLIDIFY")
            sol.thickness = r * 0.4
            sol.material_offset = 1
            obj.data.materials.append(inner)
        obj.location = loc + normal * 0.012
        K.orient(obj, normal.lerp(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.6)), 0.2),
                 rnd.uniform(0, TAU))
        out.append(obj)
    return out


def build_gyoza():
    prof = plate_profile(0.98, floor=0.08, rim_h=0.17)
    obj = K.to_object("plate", K.lathe(prof, 160, sx=1.28, sy=0.86),
                      glaze("plate-gyoza", "#f7f4ee", "#2a57c8", 0.9, 1.01, line=(0.78, 0.8)))
    obj.rotation_euler.z = math.radians(-18)
    mat = dough()
    row = Vector((math.cos(math.radians(-18)), math.sin(math.radians(-18)), 0))
    dumplings = []
    for i in range(5):
        g = gyoza(f"gyoza{i}", mat, seed=i, L=0.5 + 0.03 * ((i * 7) % 3))
        pos = row * ((i - 2) * 0.35)
        g.location = (pos.x, pos.y + 0.03 * ((i % 2) - 0.5), 0.12)
        # Crescents turned to the diner, each leaning onto its neighbour.
        # The fried face (+y) turns to the diner, pleats at the back.
        g.rotation_euler = (math.radians(52), 0, math.radians(222 + 6 * ((i % 3) - 1)))
        dumplings.append(g)
    bvh = K.bvh_of(dumplings)
    scallion_bits(bvh, 22, (0, 0), (0.95, 0.5), 4, slivers=True)


# ------------------------------------------------------------------- ramen


def bowl_outside():
    mat, n, bsdf = K.principled("bowl-blue", "#1f4fc4", rough=0.3, coat=0.35, coat_rough=0.12)
    pu = K.attr(n, "pu").outputs["Fac"]
    pv = K.attr(n, "pv").outputs["Fac"]
    # Two white waves running round the lower half of the bowl.
    wave = K.math_node(n, "SINE", K.math_node(n, "MULTIPLY", pu, TAU * 9))
    crest = K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", wave, 0.045), 0.7)
    d = K.math_node(n, "ABSOLUTE", K.math_node(n, "SUBTRACT", pv, crest))
    line1 = K.math_node(n, "LESS_THAN", d, 0.035)
    crest2 = K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", wave, -0.045), 0.56)
    d2 = K.math_node(n, "ABSOLUTE", K.math_node(n, "SUBTRACT", pv, crest2))
    line2 = K.math_node(n, "LESS_THAN", d2, 0.028)
    foot = K.math_node(n, "LESS_THAN", pv, 0.1)
    rim = K.math_node(n, "GREATER_THAN", pv, 0.93)
    white = K.math_node(n, "MAXIMUM", K.math_node(n, "MAXIMUM", line1, line2),
                        K.math_node(n, "MAXIMUM", foot, rim))
    mix = n.add("ShaderNodeMix", data={"data_type": "RGBA"})
    n.link(white, mix.inputs["Factor"])
    mix.inputs["A"].default_value = K.rgb("#1f4fc4")
    mix.inputs["B"].default_value = K.rgb("#f6f1e6")
    n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def broth():
    mat, n, bsdf = K.principled("broth", "#c4762a", rough=0.12, coat=0.6, coat_rough=0.08, spec=0.5)
    coord = n.add("ShaderNodeTexCoord")
    vor = n.add("ShaderNodeTexVoronoi", Scale=9.0)
    n.link(coord.outputs["Object"], vor.inputs["Vector"])
    dots = K.math_node(n, "LESS_THAN", vor.outputs["Distance"], 0.13)
    sep = n.add("ShaderNodeSeparateXYZ")
    n.link(coord.outputs["Object"], sep.inputs["Vector"])
    rr = K.math_node(n, "SQRT", K.math_node(n, "ADD",
                     K.math_node(n, "MULTIPLY", sep.outputs["X"], sep.outputs["X"]),
                     K.math_node(n, "MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])))
    base = K.ramp(n, rr, [(0.0, "#c2722a"), (0.7, "#a9581b"), (1.0, "#7f3d10")])
    mix = n.add("ShaderNodeMix", data={"data_type": "RGBA"})
    n.link(dots, mix.inputs["Factor"])
    n.link(base.outputs["Color"], mix.inputs["A"])
    mix.inputs["B"].default_value = K.rgb("#f0b553")
    n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def noodle_mat():
    mat, n, bsdf = K.principled("noodle", "#f2cd63", rough=0.25, sss=0.25, coat=0.6,
                                coat_rough=0.1, sss_radius=(0.4, 0.3, 0.1))
    return mat


def half_egg(name, loc, rot):
    white = K.principled("egg-white", "#fbf6ec", rough=0.18, sss=0.4, coat=0.6,
                         sss_radius=(0.5, 0.45, 0.4))[0]
    yolk_mat, n, bsdf = K.principled("yolk", "#f29a1c", rough=0.15, sss=0.3, coat=0.8)
    coord = n.add("ShaderNodeTexCoord")
    sep = n.add("ShaderNodeSeparateXYZ")
    n.link(coord.outputs["Object"], sep.inputs["Vector"])
    rr = K.math_node(n, "SQRT", K.math_node(n, "ADD",
                     K.math_node(n, "MULTIPLY", sep.outputs["X"], sep.outputs["X"]),
                     K.math_node(n, "MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])))
    c = K.ramp(n, rr, [(0.0, "#e97a0c"), (0.06, "#f39a1a"), (0.12, "#f8b743")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    bm = K.sphere(1.0, 64, 32)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                           plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_outer=True)
    edges = [e for e in bm.edges if e.is_boundary]
    bmesh.ops.edgeloop_fill(bm, edges=edges)
    K.deform(bm, lambda c: Vector((c.x * 0.34, c.y * 0.25, c.z * 0.2)))
    egg = K.to_object(name, bm, white, subsurf=1)
    egg.location = loc
    egg.rotation_euler = [math.radians(a) for a in rot]
    ybm = K.sphere(1.0, 48, 24)
    K.deform(ybm, lambda c: Vector((c.x * 0.16, c.y * 0.14, c.z * 0.06)))
    yolk = K.to_object(name + "-yolk", ybm, yolk_mat, subsurf=1)
    yolk.parent = egg
    yolk.location = (0.015, 0, 0.0)
    return egg


def naruto(name, loc, rot):
    mat, n, bsdf = K.principled("naruto", "#fbf7f2", rough=0.3, sss=0.3, coat=0.3)
    coord = n.add("ShaderNodeTexCoord")
    sep = n.add("ShaderNodeSeparateXYZ")
    n.link(coord.outputs["Object"], sep.inputs["Vector"])
    ang = n.add("ShaderNodeMath", op="ARCTAN2")
    n.link(sep.outputs["Y"], ang.inputs[0])
    n.link(sep.outputs["X"], ang.inputs[1])
    rr = K.math_node(n, "SQRT", K.math_node(n, "ADD",
                     K.math_node(n, "MULTIPLY", sep.outputs["X"], sep.outputs["X"]),
                     K.math_node(n, "MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])))
    spiral = K.math_node(n, "FRACT", K.math_node(n, "ADD",
                         K.math_node(n, "DIVIDE", ang.outputs[0], TAU),
                         K.math_node(n, "DIVIDE", rr, 0.065)))
    band = K.math_node(n, "LESS_THAN", spiral, 0.32)
    inside = K.math_node(n, "LESS_THAN", rr, 0.175)
    pink = K.math_node(n, "MULTIPLY", band, inside)
    mix = n.add("ShaderNodeMix", data={"data_type": "RGBA"})
    n.link(pink, mix.inputs["Factor"])
    mix.inputs["A"].default_value = K.rgb("#fbf7f2")
    mix.inputs["B"].default_value = K.rgb("#f0628a")
    n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    r0 = 0.22

    def plan(t):
        r = 1 + 0.07 * math.cos(t * 14)
        return (math.cos(t) * r, math.sin(t) * r)

    prof = [(0.0, 0.045), (r0 * 0.96, 0.045), (r0, 0.035), (r0, 0.01), (r0 * 0.96, 0.0), (0.0, 0.0)]
    obj = K.to_object(name, K.lathe(prof, 140, plan=plan), mat)
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    return obj


def nori(name, loc, rot):
    mat, n, bsdf = K.principled("nori", "#1c2a1f", rough=0.45, sheen=0.4)
    nz = K.noise(n, scale=40.0, detail=6.0)
    c = K.ramp(n, nz.outputs["Fac"], [(0.3, "#14201a"), (0.7, "#2c3f2d")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    K.bump(n, bsdf, nz.outputs["Fac"], strength=0.3, distance=0.01)

    def fn(u, v):
        x = (u - 0.5) * 0.62
        z = v * 0.78
        y = 0.04 * math.sin(u * math.pi) + 0.02 * mnoise.noise(Vector((u * 3, v * 3, 1)))
        return (x, y, z)

    obj = K.to_object(name, K.grid_surface(fn, 24, 24), mat)
    sol = obj.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.012
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    return obj


def build_ramen():
    rim_r, rim_z = 1.12, 0.92
    outer = K.smooth_profile([(0.0, 0.0), (0.52, 0.0), (0.56, 0.06), (0.62, 0.1),
                              (0.85, 0.24), (1.02, 0.5), (1.1, 0.78), (rim_r, rim_z)], 5)
    # pv runs 0 at the foot to 1 at the rim: drop the closing centre point.
    K.to_object("bowl-out", K.lathe(outer[1:], 160), bowl_outside())
    inner = K.smooth_profile([(rim_r, rim_z), (rim_r - 0.05, rim_z - 0.02), (1.0, 0.6),
                              (0.82, 0.32), (0.5, 0.17), (0.0, 0.15)], 5)
    K.to_object("bowl-in", K.lathe(inner, 160), glaze("bowl-in", "#ede5d6", rough=0.3))
    level = 0.74
    disc = K.lathe([(0.0, level), (1.06, level)], 160)
    K.to_object("broth", disc, broth())
    # Noodles: crinkled strands heaped in the middle, dipping under the broth.
    rnd = K.rng(11)
    nmat = noodle_mat()
    noodles = []
    for i in range(16):
        # Strands flow left to right in soft waves, heaped at the front.
        cy = -0.55 + i * 0.045 + rnd.uniform(-0.02, 0.02)
        length = rnd.uniform(0.9, 1.25)
        cx = rnd.uniform(-0.12, 0.08)
        tilt = rnd.uniform(-0.35, 0.35)
        pts = []
        steps = 22
        for k in range(steps + 1):
            s = (k / steps - 0.5) * length
            wave = 0.06 * math.sin(k * 1.05 + i * 0.9)
            x = cx + s
            y = cy + s * tilt + wave
            heap = max(0.0, 1 - ((x + 0.02) ** 2 / 0.36 + (y + 0.25) ** 2 / 0.22))
            z = level + 0.012 + 0.11 * heap + 0.025 * math.cos(k * 1.05 + i * 0.9)
            if x * x + y * y > 0.92 ** 2:
                z = level - 0.05
            pts.append((x, y, z))
        noodles.append(K.tube(f"noodle{i}", pts, 0.042, nmat, resolution=6, bevel_res=4))
    half_egg("egg", (-0.5, 0.18, level + 0.15), (34, -10, -30))
    naruto("naruto", (0.56, -0.02, level + 0.1), (-22, 12, 20))
    nori("nori", (0.12, 0.6, level - 0.16), (-8, 0, 6))
    # Spring onion rings in a heap at the centre.
    bvh = K.bvh_of([o for o in bpy.data.objects if o.name.startswith(("noodle", "broth"))])
    scallion_bits(bvh, 18, (0.02, 0.0), (0.2, 0.16), 7, rings=True)


# ---------------------------------------------------------------- yakitori


def slate():
    mat, n, bsdf = K.principled("slate", "#2b2d33", rough=0.55, coat=0.2)
    nz = K.noise(n, scale=6.0, detail=8.0, rough=0.7)
    c = K.ramp(n, nz.outputs["Fac"], [(0.3, "#24262b"), (0.7, "#3a3d44")])
    pr = K.attr(n, "pr").outputs["Fac"]
    edge = K.math_node(n, "GREATER_THAN", pr, 0.93)
    mix = n.add("ShaderNodeMix", data={"data_type": "RGBA"})
    n.link(edge, mix.inputs["Factor"])
    n.link(c.outputs["Color"], mix.inputs["A"])
    mix.inputs["B"].default_value = K.rgb("#474a52")
    n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    K.bump(n, bsdf, nz.outputs["Fac"], strength=0.15, distance=0.02)
    return mat


def tare_chicken():
    mat, n, bsdf = K.principled("chicken", "#8a3e14", rough=0.35, coat=0.6,
                                coat_rough=0.1, sss=0.05)
    nz = K.noise(n, scale=7.0, detail=6.0, rough=0.65)
    c = K.ramp(n, nz.outputs["Fac"], [(0.3, "#2e1205"), (0.42, "#5e260b"),
                                      (0.56, "#8f4314"), (0.72, "#b9692a")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    K.bump(n, bsdf, nz.outputs["Fac"], strength=0.35, distance=0.03)
    return mat


def leek():
    """Spring onion: pale green-white, browned where it touched the grill."""
    mat, n, bsdf = K.principled("leek", "#cfe39a", rough=0.3, sss=0.3, coat=0.5)
    nz = K.noise(n, scale=6.0, detail=4.0)
    c = K.ramp(n, nz.outputs["Fac"], [(0.3, "#e8f2c4"), (0.5, "#bcd977"), (0.66, "#8fbf45"),
                                      (0.74, "#7a6a2a"), (0.8, "#3e2a10")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def chunk(name, mat, centre, size, d, seed):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)

    def lump(c):
        c = c.normalized() * 0.5 * 0.55 + c * 0.45
        nz = mnoise.noise(c * 2.6 + Vector((seed, seed, seed)))
        c = c * (1 + 0.16 * nz)
        return Vector((c.x * size[0], c.y * size[1], c.z * size[2]))

    K.deform(bm, lump)
    obj = K.to_object(name, bm, mat, subsurf=2)
    obj.location = centre
    obj.rotation_euler = (math.radians(seed * 13 % 20 - 10), 0, math.atan2(d.y, d.x) + math.radians(seed * 37 % 30 - 15))
    return obj


def build_yakitori():
    prof = K.smooth_profile([(0.0, 0.07), (0.88, 0.07), (0.95, 0.09), (1.0, 0.075),
                             (1.0, 0.02), (0.96, 0.0), (0.0, 0.0)], 4)
    obj = K.to_object("plate", K.lathe(prof, 160, n=10.0, sx=1.25, sy=0.78), slate())
    obj.rotation_euler.z = math.radians(-24)
    angle = math.radians(180 + 32)
    d = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-d.y, d.x, 0))
    cm, lm = tare_chicken(), leek()
    for s, off in enumerate((-0.44, 0.0, 0.44)):
        base = side * off + d * 0.18
        z = 0.07 + 0.13
        pieces = ["c", "l", "c", "l", "c"]
        step = 0.25
        for i, kind in enumerate(pieces):
            c = base + d * ((i - 2) * step)
            c.z = z
            if kind == "c":
                chunk(f"chicken{s}{i}", cm, c, (0.3, 0.27, 0.22), d, s * 5 + i)
            else:
                lk = K.cylinder_between(f"leek{s}{i}", c - d * 0.08, c + d * 0.08, 0.1, lm, segments=32)
                bev = lk.modifiers.new("bevel", "BEVEL")
                bev.width = 0.012
                bev.segments = 3
                lk.data.materials[0] = lm
        handle = base + d * (2 * step + 0.15 + 0.5)
        tip = base - d * (2 * step + 0.17)
        handle.z = 0.09
        tip.z = z
        skewer(f"skewer{s}", handle, tip)


# ----------------------------------------------------------------- pickles


def takuan():
    mat, n, bsdf = K.principled("takuan", "#f7cf2c", rough=0.25, sss=0.4, coat=0.5,
                                sss_radius=(0.5, 0.4, 0.1))
    coord = n.add("ShaderNodeTexCoord")
    sep = n.add("ShaderNodeSeparateXYZ")
    n.link(coord.outputs["Object"], sep.inputs["Vector"])
    rr = K.math_node(n, "SQRT", K.math_node(n, "ADD",
                     K.math_node(n, "MULTIPLY", sep.outputs["X"], sep.outputs["X"]),
                     K.math_node(n, "MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])))
    c = K.ramp(n, rr, [(0.0, "#fbe06a"), (0.22, "#f6cc2c"), (0.29, "#e9b417")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def cucumber():
    mat, n, bsdf = K.principled("cucumber", "#cfe7a0", rough=0.22, sss=0.35, coat=0.6)
    coord = n.add("ShaderNodeTexCoord")
    sep = n.add("ShaderNodeSeparateXYZ")
    n.link(coord.outputs["Object"], sep.inputs["Vector"])
    rr = K.math_node(n, "SQRT", K.math_node(n, "ADD",
                     K.math_node(n, "MULTIPLY", sep.outputs["X"], sep.outputs["X"]),
                     K.math_node(n, "MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])))
    vor = n.add("ShaderNodeTexVoronoi", Scale=34.0)
    n.link(coord.outputs["Object"], vor.inputs["Vector"])
    seeds = K.math_node(n, "MULTIPLY",
                        K.math_node(n, "LESS_THAN", vor.outputs["Distance"], 0.28),
                        K.math_node(n, "MULTIPLY", K.math_node(n, "GREATER_THAN", rr, 0.05),
                                    K.math_node(n, "LESS_THAN", rr, 0.1)))
    c = K.ramp(n, rr, [(0.0, "#e3f1bd"), (0.1, "#cfe59a"), (0.135, "#a7cc68"),
                       (0.15, "#3f8424"), (0.17, "#2c6a1a")])
    mix = n.add("ShaderNodeMix", data={"data_type": "RGBA"})
    n.link(seeds, mix.inputs["Factor"])
    n.link(c.outputs["Color"], mix.inputs["A"])
    mix.inputs["B"].default_value = K.rgb("#f2f8dc")
    n.link(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def gari():
    mat, n, bsdf = K.principled("gari", "#f47fa2", rough=0.25, sss=0.15, coat=0.5,
                                sss_radius=(0.6, 0.3, 0.3))
    nz = K.noise(n, scale=20.0, detail=3.0)
    c = K.ramp(n, nz.outputs["Fac"], [(0.3, "#ef6f95"), (0.7, "#f8a6bd")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def slice_disc(name, mat, r, thick, loc, rot, half=False, wobble=0.0, seed=0, seg=64):
    prof = [(0.0, thick), (r * 0.97, thick), (r, thick * 0.6), (r, thick * 0.3), (r * 0.97, 0.0), (0.0, 0.0)]
    bm = K.lathe(prof, seg)
    if half:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                               plane_co=(0, 0, 0), plane_no=(0, 1, 0), clear_inner=True)
        edges = [e for e in bm.edges if e.is_boundary]
        bmesh.ops.edgeloop_fill(bm, edges=edges)
    if wobble:
        K.deform(bm, lambda c: c + Vector((0, 0, wobble * mnoise.noise(c * 6 + Vector((seed, 0, 0))))))
    obj = K.to_object(name, bm, mat)
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    return obj


def build_pickles():
    outer = K.smooth_profile([(0.0, 0.0), (0.62, 0.0), (0.66, 0.05), (0.72, 0.07),
                              (0.86, 0.13), (0.96, 0.3), (1.0, 0.38)], 4)
    inner = K.smooth_profile([(1.0, 0.38), (0.95, 0.38), (0.88, 0.28), (0.78, 0.18), (0.0, 0.16)], 4)
    mat = glaze("bowl-green", "#7fbf2f", rough=0.35)
    for name, prof in (("bowl-out", outer), ("bowl-in", inner)):
        obj = K.to_object(name, K.lathe(prof, 160, n=7.0), mat)
        obj.rotation_euler.z = math.radians(-16)
        obj.scale = (0.9, 0.9, 1.0)
    floor = 0.16
    tk, cu, gm = takuan(), cucumber(), gari()
    # Yellow takuan half-moons fanned at the back left.
    for i in range(5):
        slice_disc(f"takuan{i}", tk, 0.34, 0.09,
                   (-0.4 + i * 0.06, 0.4 - i * 0.12, floor + 0.07 + i * 0.045),
                   (34 - i * 3, -6, 150 + i * 9), half=True)
    # Cucumber rounds overlapping along the front.
    for i, (x, y) in enumerate(((-0.42, -0.3), (-0.14, -0.42), (0.16, -0.44), (0.44, -0.34))):
        slice_disc(f"cucumber{i}", cu, 0.2, 0.08, (x, y, floor + 0.06 + 0.04 * (i % 2)),
                   (-30 + i * 4, 10 - i * 7, i * 40))
    # Pink pickled ginger heaped at the back right.
    rnd = K.rng(3)
    for i in range(34):
        a = rnd.uniform(0, TAU)
        rr = rnd.uniform(0, 0.28) * (1 - i / 50)
        x = 0.3 + math.cos(a) * rr
        y = 0.2 + math.sin(a) * rr
        z = floor + 0.04 + i * 0.014
        slice_disc(f"gari{i}", gm, rnd.uniform(0.13, 0.19), 0.012, (x, y, z),
                   (rnd.uniform(-40, 40), rnd.uniform(-40, 40), rnd.uniform(0, 360)),
                   wobble=0.06, seed=i, seg=48)


# ---------------------------------------------------------------- takoyaki


def boat_wood():
    mat, n, bsdf = K.principled("funa", "#e8c890", rough=0.6)
    coord = n.add("ShaderNodeTexCoord")
    wave = n.add("ShaderNodeTexWave", Scale=3.0, Distortion=2.5, Detail=2.0, Detail_Scale=1.0)
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    n.link(coord.outputs["Object"], wave.inputs["Vector"])
    c = K.ramp(n, wave.outputs["Fac"], [(0.0, "#e0bd82"), (0.5, "#efd5a4"), (1.0, "#e6c690")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    K.bump(n, bsdf, wave.outputs["Fac"], strength=0.08, distance=0.01)
    return mat


def takoyaki_mat():
    """Golden batter under brown takoyaki sauce that pools on the tops."""
    mat, n, bsdf = K.principled("takoyaki", "#c27532", rough=0.2, coat=0.9, coat_rough=0.05, sss=0.1)
    geo = n.add("ShaderNodeNewGeometry")
    sep = n.add("ShaderNodeSeparateXYZ")
    n.link(geo.outputs["Normal"], sep.inputs["Vector"])
    nz = K.noise(n, scale=8.0, detail=5.0)
    sauce = K.math_node(n, "ADD", sep.outputs["Z"], K.math_node(n, "MULTIPLY",
                        K.math_node(n, "SUBTRACT", nz.outputs["Fac"], 0.5), 0.8))
    c = K.ramp(n, sauce, [(-0.2, "#b5682a"), (0.25, "#d08c40"), (0.5, "#b9692c"),
                          (0.62, "#6e2f10"), (1.0, "#56230b")])
    n.link(c.outputs["Color"], bsdf.inputs["Base Color"])
    rough = K.ramp(n, sauce, [(0.5, (0.55, 0.55, 0.55, 1)), (0.64, (0.12, 0.12, 0.12, 1))])
    n.link(rough.outputs["Color"], bsdf.inputs["Roughness"])
    fine = K.noise(n, scale=30.0, detail=4.0)
    K.bump(n, bsdf, fine.outputs["Fac"], strength=0.2, distance=0.02)
    return mat


def build_takoyaki():
    def plan(t):
        c, s = math.cos(t), math.sin(t)
        # A boat: long, with pointed bow and stern.
        return (c * 1.22, s * 0.74 * (1 - 0.25 * c * c))

    outer = [(0.0, 0.0), (0.84, 0.0), (0.88, 0.03), (1.0, 0.3), (1.02, 0.31)]
    inner = [(1.02, 0.31), (0.99, 0.31), (0.88, 0.05), (0.84, 0.035), (0.0, 0.035)]
    wood = boat_wood()
    for name, prof in (("boat-out", outer), ("boat-in", inner)):
        obj = K.to_object(name, K.lathe(prof, 160, plan=plan), wood, smooth=False)
        obj.rotation_euler.z = math.radians(-24)
    mat = takoyaki_mat()
    r = 0.28
    rot = math.radians(-24)
    balls = []
    for i in range(6):
        col, row = i % 3, i // 3
        x = (col - 1) * r * 2.02 + (row - 0.5) * 0.08
        y = (row - 0.5) * r * 2.0
        x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        bm = K.sphere(r, 48, 24)
        K.deform(bm, lambda c, i=i: c * (1 + 0.06 * mnoise.noise(c * 7 + Vector((i, i, i)))) * Vector((1, 1, 0.92)))
        b = K.to_object(f"ball{i}", bm, mat, subsurf=1)
        b.location = (x, y, 0.035 + r * 0.9)
        balls.append(b)
    bvh = K.bvh_of(balls)
    # Mayonnaise zigzags across each row.
    mayo = K.principled("mayo", "#fbf2d8", rough=0.18, sss=0.3, coat=0.6)[0]
    for row in range(2):
        pts = []
        for k in range(29):
            t = k / 28
            along = (t - 0.5) * r * 2.02 * 3.0
            across = (row - 0.5) * r * 2.0 + 0.13 * math.sin(t * math.pi * 9)
            x = along * math.cos(rot) - across * math.sin(rot)
            y = along * math.sin(rot) + across * math.cos(rot)
            loc, normal = K.drop(bvh, x, y)
            if loc is not None:
                pts.append(tuple(loc + normal * 0.012))
        K.tube(f"mayo{row}", pts, 0.022, mayo, resolution=6, bevel_res=3)
    # Bonito flakes: thin curled shavings on top.
    bonito, bn, bb = K.principled("bonito", "#e7b49a", rough=0.5, sss=0.4, sss_radius=(0.5, 0.3, 0.2))
    streak = K.noise(bn, scale=30.0, detail=2.0)
    bc = K.ramp(bn, streak.outputs["Fac"], [(0.35, "#c98a72"), (0.55, "#efc2a8"), (0.7, "#f6d6c0")])
    bn.link(bc.outputs["Color"], bb.inputs["Base Color"])
    rnd = K.rng(5)
    for i in range(34):
        x = rnd.uniform(-0.75, 0.75)
        y = rnd.uniform(-0.4, 0.4)
        x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        loc, normal = K.drop(bvh, x, y)
        if loc is None or normal.z < 0.5:
            continue
        w, h = rnd.uniform(0.1, 0.15), rnd.uniform(0.06, 0.1)
        curl = rnd.uniform(0.03, 0.06)

        def fn(u, v, w=w, h=h, curl=curl):
            return ((u - 0.5) * w, (v - 0.5) * h, curl * ((u - 0.5) * 2) ** 2)

        f = K.to_object(f"flake{i}", K.grid_surface(fn, 6, 4), bonito)
        f.location = loc + normal * 0.02
        K.orient(f, normal, rnd.uniform(0, TAU))
    # Aonori: green flecks.
    nori_mat = K.principled("aonori", "#2f6b1a", rough=0.6)[0]
    for i in range(160):
        x = rnd.uniform(-0.8, 0.8)
        y = rnd.uniform(-0.45, 0.45)
        x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        loc, normal = K.drop(bvh, x, y)
        if loc is None or normal.z < 0.35:
            continue
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, segments=5, radius=rnd.uniform(0.008, 0.014))
        fl = K.to_object(f"nori{i}", bm, nori_mat, smooth=False)
        fl.location = loc + normal * 0.004
        K.orient(fl, normal, rnd.uniform(0, TAU))
        K.move_to(fl, K.no_ink())
    # A toothpick stuck in the right-hand ball.
    end = balls[2].location
    skewer("pick", end + Vector((0.32, 0.2, 0.55)), end + Vector((0.02, 0.0, 0.05)), radius=0.016)


# ------------------------------------------------------------------ driver

BUILDERS = {0: build_gyoza, 1: build_ramen, 2: build_yakitori, 3: build_pickles, 4: build_takoyaki, 5: build_dango}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "renders", "tokyo"))
    ap.add_argument("--kinds", default=",".join(str(k) for k in BUILDERS))
    ap.add_argument("--size", type=int, default=1200)
    ap.add_argument("--samples", type=int, default=160)
    ap.add_argument("--no-ink", action="store_true")
    args = ap.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)
    for kind in [int(k) for k in args.kinds.split(",")]:
        K.reset()
        K.setup_render(args.size, args.samples, outline=not args.no_ink)
        K.camera()
        K.lights()
        K.shadow_catcher()
        BUILDERS[kind]()
        K.render(os.path.join(os.path.abspath(args.out), f"tokyo-{kind}.png"))


if __name__ == "__main__":
    main()
