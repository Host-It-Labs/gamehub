"""Fresh modeled Tokyo servings with the existing tickets' cartoon language.

Every visible part is mesh or a swept curve. No image textures, old render
inputs, photographic noise, bump maps, gloss, or subsurface materials.
The original card art is an observation source for the written model brief.

Blender -b --factory-startup --python assets/yata/blender/tokyo_toon.py -- \
    --out assets/yata/renders/tokyo-toon-v2 --kinds 1 --size 720 --samples 48

When running the source outside its production folder, pass --kit-dir.
"""

import argparse
import hashlib
import json
import math
import os
import re
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(HERE, "..", "renders", "tokyo-toon-v2"))
ap.add_argument("--kinds", default="0,1,2,3,4,5")
ap.add_argument("--size", type=int, default=1200)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--kit-dir", default=HERE)
ap.add_argument("--save-blend", action="store_true")
ARGS = ap.parse_args(argv)
sys.path.insert(0, ARGS.kit_dir)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import dishkit as K  # noqa: E402

TAU = math.tau
KEY = Vector((-0.65, -0.50, 0.72)).normalized()


def cel(name, palette, mask=None, alternate=None):
    """Camera-visible normal-directed bands, isolated from indirect lighting.

    An optional procedural mask selects a second equally cel-shaded palette.
    The only patterns are the dishes' large graphic decorations.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    n = K.Nodes(mat)
    geo = n.add("ShaderNodeNewGeometry")
    dot = n.add("ShaderNodeVectorMath", op="DOT_PRODUCT")
    n.link(geo.outputs["Normal"], dot.inputs[0])
    dot.inputs[1].default_value = KEY
    fac = K.math_node(n, "MULTIPLY_ADD", dot.outputs["Value"], 0.5)
    # MULTIPLY_ADD needs its third input set independently.
    fac.node.inputs[2].default_value = 0.5
    positions = (0.0, 0.48, 0.80, 0.95)[:len(palette)]
    colors = K.ramp(n, fac, list(zip(positions, palette)), interp="CONSTANT")
    color = colors.outputs["Color"]
    if mask and alternate:
        ac = K.ramp(n, fac, list(zip(positions, alternate)), interp="CONSTANT")
        mix = n.add("ShaderNodeMixRGB")
        n.link(mask(n), mix.inputs[0])
        n.link(color, mix.inputs[1])
        n.link(ac.outputs["Color"], mix.inputs[2])
        color = mix.outputs["Color"]
    emission = n.add("ShaderNodeEmission", Strength=1.0)
    n.link(color, emission.inputs["Color"])
    out = n.add("ShaderNodeOutputMaterial")
    # Emission is visible only to the camera. The same real mesh remains
    # opaque to shadow rays, and its dark diffuse closure avoids emitting
    # light onto the catcher or generating a full-frame ambient alpha haze.
    paths = n.add("ShaderNodeLightPath")
    physical = n.add("ShaderNodeBsdfDiffuse", Color=(0.06, 0.06, 0.06, 1), Roughness=1.0)
    blend = n.add("ShaderNodeMixShader")
    n.link(paths.outputs["Is Camera Ray"], blend.inputs[0])
    n.link(physical.outputs[0], blend.inputs[1])
    n.link(emission.outputs[0], blend.inputs[2])
    n.link(blend.outputs[0], out.inputs["Surface"])
    return mat


def flat(name, color):
    return cel(name, (color, color, color))


def inkless(obj):
    K.move_to(obj, K.no_ink())
    return obj


def ellipsoid(name, loc, scale, mat, segments=32, rings=16, smooth=True):
    bm = K.sphere(1, segments, rings)
    K.deform(bm, lambda v: Vector((v.x * scale[0], v.y * scale[1], v.z * scale[2])))
    obj = K.to_object(name, bm, mat, smooth=smooth)
    obj.location = loc
    return obj


def box(name, loc, scale, mat, bevel=0.04):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    K.deform(bm, lambda v: Vector((v.x * scale[0], v.y * scale[1], v.z * scale[2])))
    obj = K.to_object(name, bm, mat, smooth=False)
    obj.location = loc
    if bevel:
        mod = obj.modifiers.new("round corners", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def polygon(name, points, mat, thickness=0):
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in points]
    bm.faces.new(verts)
    obj = K.to_object(name, bm, mat, smooth=False)
    if thickness:
        mod = obj.modifiers.new("paper thickness", "SOLIDIFY")
        mod.thickness = thickness
    return obj


def skewer(name, a, b, radius=0.032):
    mat = cel("bamboo", ("#9f773c", "#e1ba72", "#f8d98e"))
    return K.cylinder_between(name, a, b, radius, mat, segments=12)


def setup():
    K.reset()
    scene = K.setup_render(ARGS.size, ARGS.samples)
    scene.view_settings.exposure = 0
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 1
    scene.cycles.glossy_bounces = 1
    scene.cycles.use_denoising = True
    fs = bpy.context.view_layer.freestyle_settings
    for ls in fs.linesets:
        ls.select_silhouette = True
        ls.select_external_contour = True
        ls.select_border = True
        ls.select_crease = False
        ls.linestyle.color = K.rgb("#242b2a")[:3]
        ls.linestyle.thickness = ARGS.size / 720 * 4.3
        ls.linestyle.alpha = 1
        ls.linestyle.thickness_position = "CENTER"
    # Camera-visible cel surfaces stay independent of physical glare. A
    # bounded modeled contact-shadow plane is added after each vessel.
    K.area_light("large soft lamp", (-3, -2, 8), 850, (1, 1, 1), 5.0)
    world = bpy.data.worlds.new("quiet neutral world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    scene.world = world
    K.camera(elevation=47, scale=3.1, target=(0, 0, 0.48))


def contact_shadow(kind):
    """A short soft ellipse modeled under the vessel, with bounded alpha.

    Cycles' shadow catcher interpreted the emissive cel scene as broad
    ambient occlusion and returned high alpha at the image's far edges.
    This analytic mesh gives a clean contact shadow without post-processing
    an image, and is fully transparent at and outside its own perimeter.
    """
    profiles = {0: (1.45, 0.84, 36), 1: (1.27, 1.09, 0),
                2: (1.19, 0.83, -48), 3: (1.18, 1.10, 22),
                4: (1.48, 0.82, 30), 5: (1.35, 1.28, 36)}
    sx, sy, angle = profiles[kind]
    mat = bpy.data.materials.new("bounded soft contact shadow")
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    n = K.Nodes(mat)
    radius = K.attr(n, "pr").outputs["Fac"]
    falloff = n.add("ShaderNodeMapRange", data={"interpolation_type": "SMOOTHSTEP"},
                    From_Min=0.30, From_Max=1.0, To_Min=0.52, To_Max=0.0)
    n.link(radius, falloff.inputs["Value"])
    transparent = n.add("ShaderNodeBsdfTransparent", Color=(1, 1, 1, 1))
    black = n.add("ShaderNodeEmission", Color=(0.018, 0.014, 0.010, 1), Strength=1)
    mix = n.add("ShaderNodeMixShader")
    n.link(falloff.outputs["Result"], mix.inputs[0])
    n.link(transparent.outputs[0], mix.inputs[1])
    n.link(black.outputs[0], mix.inputs[2])
    output = n.add("ShaderNodeOutputMaterial")
    n.link(mix.outputs[0], output.inputs["Surface"])
    # Several concentric rings ensure smooth radial interpolation through
    # the falloff, while their shader alpha is exactly zero at the boundary.
    profile = [(i / 16, -0.018) for i in range(17)]
    obj = K.to_object("modeled bounded contact shadow", K.lathe(profile, 96, sx=sx, sy=sy), mat)
    obj.rotation_euler.z = math.radians(angle)
    obj.visible_shadow = False
    inkless(obj)


def blue_wave(n):
    """Broad curling cream crests around the middle of the blue bowl."""
    u = K.attr(n, "pu").outputs["Fac"]
    geo = n.add("ShaderNodeNewGeometry")
    xyz = n.add("ShaderNodeSeparateXYZ")
    n.link(geo.outputs["Position"], xyz.inputs["Vector"])
    v = xyz.outputs["Z"]
    # Keep large gestures readable on the counter: three repeated wave
    # crests, each a sweeping ribbon with a hooked curling tip.
    phase = K.math_node(n, "FRACT", K.math_node(n, "MULTIPLY", u, 6))
    wave = K.math_node(n, "SINE", K.math_node(n, "MULTIPLY", phase, TAU))
    crest = K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", wave, 0.11), 0.72)
    width = K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", K.math_node(n, "SUBTRACT", 1, phase), 0.042), 0.042)
    a = K.math_node(n, "LESS_THAN", K.math_node(n, "ABSOLUTE", K.math_node(n, "SUBTRACT", v, crest)), width)
    # Rounded negative space cuts into the crest to form a graphic curl.
    dx = K.math_node(n, "DIVIDE", K.math_node(n, "SUBTRACT", phase, 0.22), 0.12)
    dz = K.math_node(n, "DIVIDE", K.math_node(n, "SUBTRACT", v, 0.77), 0.065)
    rr = K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", dx, dx), K.math_node(n, "MULTIPLY", dz, dz))
    cut = K.math_node(n, "LESS_THAN", rr, 1)
    return K.math_node(n, "MULTIPLY", a, K.math_node(n, "SUBTRACT", 1, cut))


def half_egg(loc, rot):
    white = cel("egg cream", ("#be9962", "#f0dba6", "#fff1ca"))
    yolk = cel("large orange yolk", ("#df810f", "#ffab08", "#ffc027"))
    bm = K.sphere(1, 48, 24)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                           plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_outer=True)
    bmesh.ops.edgeloop_fill(bm, edges=[e for e in bm.edges if e.is_boundary])
    K.deform(bm, lambda v: Vector((v.x * 0.43, v.y * 0.35, v.z * 0.20)))
    egg = K.to_object("one large half egg", bm, white)
    egg.location = loc
    egg.rotation_euler = [math.radians(a) for a in rot]
    y = ellipsoid("large yolk cut face", (0, 0, 0), (0.245, 0.22, 0.023), yolk, 40, 16)
    y.parent = egg
    y.location = (-0.025, -0.025, 0.023)
    # A flat graphic gleam, shaped in 3D rather than a specular spot.
    gleam = ellipsoid("yolk graphic shine", (0, 0, 0), (0.09, 0.033, 0.004), flat("yolk shine", "#ffe06c"))
    gleam.parent = egg
    gleam.location = (-0.10, 0.07, 0.049)
    gleam.rotation_euler.z = math.radians(-25)
    inkless(gleam)


def fishcake(loc, rot):
    cream = cel("fishcake cream", ("#b49c77", "#f0dfbd", "#fff4d7"))
    pink = cel("fishcake pink spiral", ("#d94e79", "#f37ca0", "#fca6ba"))

    def plan(t):
        r = 1 + 0.07 * math.cos(12 * t)
        return math.cos(t) * r, math.sin(t) * r

    prof = [(0, 0.085), (0.29, 0.085), (0.315, 0.065), (0.32, 0.015), (0.29, 0), (0, 0)]
    cake = K.to_object("large scalloped fishcake", K.lathe(prof, 96, plan=plan), cream)
    cake.location = loc
    cake.rotation_euler = [math.radians(a) for a in rot]
    points = []
    for i in range(65):
        a = i / 64 * TAU * 1.55
        r = 0.018 + i / 64 * 0.185
        points.append((r * math.cos(a), r * math.sin(a), 0.088))
    spiral = K.tube("fishcake spiral", points, 0.024, pink, resolution=4, bevel_res=2)
    spiral.parent = cake
    inkless(spiral)


def nori():
    mat = cel("nori sheet", ("#1f3019", "#314716", "#4c6625"))
    sheet = polygon("big back nori rectangle", [(-0.43, 0, 0), (0.43, 0, 0), (0.43, 0, 0.88), (-0.43, 0, 0.88)], mat, 0.024)
    sheet.location = (0.16, 0.53, 0.77)
    sheet.rotation_euler = (math.radians(-8), math.radians(8), math.radians(-10))
    patches = [
        [(-0.35, -0.018, 0.71), (-0.08, -0.018, 0.83), (-0.15, -0.018, 0.63), (-0.40, -0.018, 0.53)],
        [(0.15, -0.019, 0.36), (0.38, -0.019, 0.51), (0.35, -0.019, 0.67), (0.20, -0.019, 0.54), (0.05, -0.019, 0.58)],
        [(-0.34, -0.02, 0.23), (-0.24, -0.02, 0.43), (-0.12, -0.02, 0.45), (-0.17, -0.02, 0.27)],
    ]
    for i, pts in enumerate(patches):
        patch = polygon(f"nori large angular patch {i}", pts, flat("nori light patch", "#718238"))
        patch.parent = sheet
        inkless(patch)


def scallion_ring(name, loc, radius=0.11, rot=(0, 0, 0)):
    green = cel("bright scallion", ("#346b15", "#70b624", "#aae240"))
    # The open centre exposes broth/noodles. Wide cut walls read at play size.
    profile = [(radius * 0.56, 0), (radius, 0), (radius, 0.065), (radius * 0.56, 0.065), (radius * 0.56, 0)]
    ring = K.to_object(name, K.lathe(profile, 24), green)
    ring.location = loc
    ring.rotation_euler = [math.radians(a) for a in rot]
    return ring


def build_ramen():
    blue = cel("royal blue wave bowl", ("#103279", "#075ad9", "#1989fa"), blue_wave,
               ("#b9a56b", "#eee2b5", "#fff2cb"))
    cream = cel("bowl inside cream", ("#b89557", "#ead9af", "#fff0c5"))
    outer = K.smooth_profile([(0.0, 0.0), (0.63, 0), (0.68, 0.065), (0.82, 0.12),
                              (0.97, 0.32), (1.08, 0.62), (1.12, 0.9), (1.13, 0.95)], 5)
    K.to_object("blue bowl", K.lathe(outer[1:], 128), blue)
    inner = K.smooth_profile([(1.13, 0.95), (1.08, 0.95), (1.025, 0.79), (0.85, 0.40), (0, 0.2)], 4)
    K.to_object("cream inner rim", K.lathe(inner, 128), cream)
    # Raised blue outer lip reads as the illustrated thick bowl rim.
    rim = [(1.105, 0.93), (1.145, 0.94), (1.145, 0.96), (1.105, 0.966), (1.105, 0.93)]
    K.to_object("blue thick lip", K.lathe(rim, 128), cel("blue rim", ("#103279", "#0969ef", "#229bff")))
    level = 0.835
    K.to_object("brown broth only in gaps", K.lathe([(0, level), (1.055, level)], 96),
                cel("broth", ("#9a4e10", "#c57b12", "#d99525")))
    noodle = cel("thick golden cartoon noodles", ("#aa6615", "#e7a229", "#ffe18c"))
    # A full serving: packed wavy strands cover almost the whole liquid disc.
    # Ends curl into the bowl instead of a little isolated noodle island.
    for i in range(14):
        y0 = -0.845 + i * 0.13
        halfwidth = math.sqrt(max(0.96 ** 2 - y0 ** 2, 0.05))
        pts = []
        for j in range(33):
            t = j / 32
            x = -halfwidth + 2 * halfwidth * t
            y = y0 + 0.067 * math.sin(t * TAU * 2.15 + i * 0.16)
            heap = max(0, 1 - (x * x + y * y) / 0.92)
            end_dip = math.sin(math.pi * t) ** 0.25
            z = level - 0.025 + end_dip * 0.05 + heap * 0.08 + 0.017 * math.sin(t * TAU * 2 + i * 0.2)
            pts.append((x, y, z))
        K.tube(f"full serving noodle {i:02}", pts, 0.063, noodle, resolution=5, bevel_res=4)
    # A few long curls lie above the densely filled base. Their rounded
    # cross-sections stay distinct; they never intersect their neighbours.
    for i in range(3):
        pts = [(-0.84, -0.55 + i * 0.15, 0.81), (-0.75, -0.57 + i * 0.15, 0.935),
               (-0.52, -0.64 + i * 0.15, 1.0), (-0.28, -0.53 + i * 0.15, 1.055),
               (-0.02, -0.51 + i * 0.15, 1.07), (0.20, -0.62 + i * 0.15, 1.025),
               (0.45, -0.64 + i * 0.15, 1.0), (0.72, -0.52 + i * 0.15, 0.945),
               (0.83, -0.49 + i * 0.15, 0.82)]
        K.tube(f"big front noodle curl {i}", pts, 0.065, noodle, resolution=8, bevel_res=4,
               radii=[0.4, 1, 1, 1, 1, 1, 1, 1, 0.4])
    nori()
    half_egg((-0.47, 0.02, 1.07), (37, -8, -28))
    fishcake((0.62, -0.02, 1.02), (-13, 16, 16))
    positions = [(-0.13, 0.15, 1.05, 0.12), (0.10, 0.15, 1.08, 0.13),
                 (0.02, -0.08, 1.07, 0.13), (0.24, -0.10, 1.045, 0.10),
                 (-0.18, -0.12, 1.045, 0.10), (-0.04, -0.31, 1.015, 0.105),
                 (-0.31, -0.48, 0.96, 0.11), (0.26, 0.34, 1.035, 0.105)]
    for i, (x, y, z, r) in enumerate(positions):
        scallion_ring(f"large scallion ring {i}", (x, y, z), r, (i * 7 % 25 - 10, i * 11 % 20 - 10, i * 35))


def rim_mask(n):
    return K.math_node(n, "GREATER_THAN", K.attr(n, "pr").outputs["Fac"], 0.9)


def plate(name, radius=1.0, sx=1, sy=1, n=2, angle=0):
    cream = ("#a89d83", "#eadfbc", "#fff4dc")
    blue = ("#16306a", "#175acd", "#5b9dff")
    mat = cel(name + " cream blue rim", cream, rim_mask, blue)
    profile = K.smooth_profile([(0, 0.105), (radius * 0.70, 0.105), (radius * 0.83, 0.125),
                                (radius * 0.93, 0.20), (radius, 0.22), (radius, 0.15),
                                (radius * 0.85, 0.04), (radius * 0.68, 0), (0, 0)], 3)
    obj = K.to_object(name, K.lathe(profile, 96, n=n, sx=sx, sy=sy), mat)
    obj.rotation_euler.z = math.radians(angle)
    return obj


def dumpling(name, seed=0):
    # Large browned side and a clear cream pleated ridge. Brown patches are
    # a few broad intentional graphic shapes rather than procedural speckle.
    def fried(n):
        side = K.attr(n, "gc").outputs["Fac"]
        height = K.attr(n, "gs").outputs["Fac"]
        along = K.attr(n, "gv").outputs["Fac"]
        lo = K.math_node(n, "GREATER_THAN", side, 0.04)
        wav = K.math_node(n, "ADD", K.math_node(n, "MULTIPLY",
            K.math_node(n, "SINE", K.math_node(n, "MULTIPLY", along, TAU * 3)), 0.03), 0.93)
        below = K.math_node(n, "LESS_THAN", height, wav)
        return K.math_node(n, "MULTIPLY", K.math_node(n, "MULTIPLY", lo, below), K.math_node(n, "GREATER_THAN", height, 0.12))

    mat = cel("dumpling skin and golden pan face", ("#bba166", "#efcf90", "#fff0c3"), fried,
              ("#844813", "#b66a1c", "#df9a37"))
    n = K.Nodes(mat)
    gc = K.attr(n, "gc").outputs["Fac"]
    gs = K.attr(n, "gs").outputs["Fac"]
    gv = K.attr(n, "gv").outputs["Fac"]
    length_wave = K.math_node(n, "SINE", K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", gv, TAU * 5), seed * 0.7))
    height_wave = K.math_node(n, "SINE", K.math_node(n, "ADD", K.math_node(n, "MULTIPLY", gs, TAU * 3), seed * 0.37))
    islands = K.math_node(n, "GREATER_THAN", K.math_node(n, "ADD", length_wave, height_wave), 0.3)
    islands = K.math_node(n, "MULTIPLY", islands, K.math_node(n, "GREATER_THAN", gc, 0.48))
    islands = K.math_node(n, "MULTIPLY", islands, K.math_node(n, "LESS_THAN", gs, 0.83))
    islands = K.math_node(n, "MULTIPLY", islands, K.math_node(n, "GREATER_THAN", gs, 0.2))
    color_ramp = next(node for node in mat.node_tree.nodes if node.bl_idname == "ShaderNodeValToRGB")
    shade = K.ramp(n, color_ramp.inputs["Fac"].links[0].from_socket,
                   [(0, "#63330e"), (0.48, "#985515"), (0.80, "#b96a19")], interp="CONSTANT")
    em = next(node for node in mat.node_tree.nodes if node.bl_idname == "ShaderNodeEmission")
    previous = em.inputs["Color"].links[0].from_socket
    mix = n.add("ShaderNodeMixRGB")
    n.link(islands, mix.inputs[0])
    n.link(previous, mix.inputs[1])
    n.link(shade.outputs["Color"], mix.inputs[2])
    n.link(mix.outputs["Color"], em.inputs["Color"])

    def shape(u, v):
        t = 2 * v - 1
        env = max(1 - t * t, 0)
        a = u * TAU
        ca, sa = math.cos(a), math.sin(a)
        w = 0.285 * env ** 0.50
        h = 0.42 * env ** 0.44
        y = w * ca * (1 - 0.35 * max(sa, 0) ** 3)
        z = h * sa if sa >= 0 else h * sa * 0.12
        crest = math.exp(-((ca / 0.26) ** 2)) * (1 if sa > 0 else 0)
        phase = (t + 1) * 6 * math.pi
        z += crest * env ** 0.5 * (0.055 + 0.022 * math.sin(phase))
        y += crest * env ** 0.5 * 0.025 * math.cos(phase)
        y += 0.30 * t * t - 0.15
        return 0.47 * t, y, z + h * 0.12

    bm = K.grid_surface(shape, 40, 36, close_u=True,
                        attrs=lambda u, v: {"gs": math.sin(u * TAU), "gc": math.cos(u * TAU), "gv": v})
    return K.to_object(name, bm, mat, subsurf=1)


def build_gyoza():
    plate("oval white plate", 1.02, sx=1.37, sy=0.72, angle=36)
    row = Vector((math.cos(math.radians(36)), math.sin(math.radians(36)), 0))
    gyozas = []
    for i in range(5):
        g = dumpling(f"crescent gyoza {i}", seed=i)
        p = row * ((i - 2) * 0.42)
        g.location = (p.x, p.y, 0.16)
        g.rotation_euler = (math.radians(24), 0, math.radians(105))
        gyozas.append(g)
    bpy.context.view_layer.update()
    bvh = K.bvh_of(gyozas)
    for i, (x, y) in enumerate([(-0.65, -0.42), (-0.34, -0.18), (0.07, 0.10), (0.43, 0.30), (0.70, 0.48)]):
        loc, normal = K.drop(bvh, x, y)
        if loc:
            scallion_ring(f"gyoza large scallion {i}", loc + Vector((0, 0, 0.025)), 0.048, (15, -10, i * 35))
    green = cel("gyoza scallion cut", ("#2b611b", "#66b922", "#a5db49"))
    for i, (x, y) in enumerate([(-0.74, -0.02), (-0.2, -0.55), (0.28, -0.22), (0.72, 0.15)]):
        piece = box(f"plate chunky green garnish {i}", (x, y, 0.16), (0.07, 0.07, 0.05), green, bevel=0.01)
        piece.rotation_euler.z = math.radians(i * 37)


def chicken_chunk(name, loc, d, seed):
    chicken = cel("chicken caramel", ("#552309", "#90410e", "#bc651b", "#ea9b38"))
    # A large lobed bite of chicken: overlapping lobes are joined into one
    # continuous rounded mesh so the charcoal silhouette stays legible.
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    def shape(v):
        v = v.normalized() * 0.28 + v * 0.48
        wobble = 1 + 0.085 * math.sin(v.x * 7 + seed) * math.cos(v.y * 8)
        return Vector((v.x * 0.40, v.y * 0.37, v.z * 0.34)) * wobble
    K.deform(bm, shape)
    obj = K.to_object(name, bm, chicken, subsurf=1)
    obj.location = loc
    obj.rotation_euler.z = math.atan2(d.y, d.x)
    # Two wide dark grill stripes following the upper volume, not flecks.
    char = flat("wide chicken grill mark", "#703615")
    for i in range(2):
        pts = [(-0.10 + i * 0.13, -0.12, 0.11), (-0.10 + i * 0.13, -0.04, 0.155),
               (-0.10 + i * 0.13, 0.08, 0.14), (-0.10 + i * 0.13, 0.13, 0.10)]
        line = K.tube(f"{name} broad grill stripe {i}", pts, 0.017, char, resolution=4, bevel_res=2)
        line.parent = obj
        inkless(line)
    shine = ellipsoid(name + " graphic shine", (0, 0, 0), (0.089, 0.060, 0.012), flat("chicken gleam", "#ffe5a5"))
    shine.parent = obj
    shine.location = (-0.035, -0.055, 0.169)
    inkless(shine)
    return obj


def build_yakitori():
    angle = math.radians(-48)
    d = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-d.y, d.x, 0))
    slate = cel("clean charcoal tray", ("#252631", "#3a3b47", "#61606a"))
    tray = box("compact dark rectangular tray", (0, 0, 0.04), (2.12, 1.27, 0.10), slate, bevel=0.075)
    tray.rotation_euler.z = angle
    # A narrow lighter inset line establishes the tray's raised rim.
    rim = cel("charcoal tray lighter raised rim", ("#42414a", "#65616b", "#959080"))
    for off in (-0.58, 0.58):
        a, b = d * -0.99 + side * off, d * 0.99 + side * off
        a.z = b.z = 0.10
        K.tube("tray long rim", [a, b], 0.019, rim, resolution=2, bevel_res=2)
    for end in (-0.99, 0.99):
        a, b = d * end + side * -0.58, d * end + side * 0.58
        a.z = b.z = 0.1
        K.tube("tray end rim", [a, b], 0.019, rim, resolution=2, bevel_res=2)
    leek = cel("vivid lime leek", ("#587b1d", "#abd844", "#e0f184"))
    leek_end = cel("leek cut pale core", ("#89a839", "#d4ed77", "#f2f5bc"))
    for row, off in enumerate((-0.39, 0, 0.39)):
        base = side * off + d * -0.12
        for i in range(5):
            p = base + d * ((i - 2) * 0.31)
            p.z = 0.25
            if i % 2 == 0:
                chicken_chunk(f"chicken row {row} bite {i // 2}", p, d, row * 3 + i)
            else:
                obj = K.cylinder_between(f"lime leek row {row} section {i}", p - d * 0.105, p + d * 0.105, 0.145, leek, 16)
                mod = obj.modifiers.new("leek bevel", "BEVEL")
                mod.width, mod.segments = 0.018, 2
                end = K.cylinder_between("leek ivory cut face", p + d * 0.105, p + d * 0.11, 0.112, leek_end, 16)
                inkless(end)
        a = base + d * 1.37
        b = base - d * 0.88
        a.z = b.z = 0.23
        skewer(f"yakitori handle row {row}", a, b, 0.032)


def slice_disc(name, loc, radius, thick, mat, rot=(0, 0, 0), half=False, segments=32):
    prof = [(0, thick), (radius * 0.92, thick), (radius, thick * 0.75),
            (radius, thick * 0.18), (radius * 0.93, 0), (0, 0)]
    bm = K.lathe(prof, segments)
    if half:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                               plane_co=(0, 0, 0), plane_no=(0, 1, 0), clear_inner=True)
        bmesh.ops.edgeloop_fill(bm, edges=[e for e in bm.edges if e.is_boundary])
    obj = K.to_object(name, bm, mat)
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    return obj


def build_pickles():
    lime = cel("lime green pickle bowl", ("#456a0c", "#8bbd20", "#c3e544"))
    profile = [(0, 0.03), (0.72, 0.03), (0.87, 0.12), (1, 0.42), (1, 0.47),
               (0.935, 0.47), (0.81, 0.19), (0, 0.18)]
    bowl = K.to_object("square lime tray", K.lathe(profile, 64, n=8, sx=0.96, sy=0.93), lime)
    bowl.rotation_euler.z = math.radians(22)
    yellow = cel("yellow takuan half moons", ("#ca9812", "#f1c827", "#ffe76c"))
    for i in range(4):
        slice_disc(f"thick yellow half moon {i}", (-0.49 + i * 0.075, 0.34 - i * 0.15, 0.30 + i * 0.060),
                   0.41, 0.13, yellow, rot=(48 - i * 3, -8, -12 + i * 3), half=True)
    skin = cel("cucumber dark green skin", ("#2b4f12", "#4a8a20", "#7eb847"))
    flesh = cel("cucumber pale cut face", ("#86af40", "#bfd97a", "#e1eba8"))
    seeds = flat("cucumber readable cream seeds", "#f7f2bc")
    positions = [(-0.48, -0.28, 0.26, -20), (-0.08, -0.42, 0.28, -8),
                 (0.30, -0.45, 0.27, -22), (0.02, -0.13, 0.42, -12)]
    for i, (x, y, z, tilt) in enumerate(positions):
        disc = slice_disc(f"large cucumber round {i}", (x, y, z), 0.235, 0.115, skin, rot=(tilt, i * 6 - 8, i * 47))
        face = slice_disc(f"cucumber cut flesh {i}", (0, 0, 0), 0.189, 0.015, flesh, segments=24)
        face.parent = disc
        face.location = (0, 0, 0.111)
        inkless(face)
        for j in range(3):
            a = j / 3 * TAU
            seed = ellipsoid(f"cucumber {i} large seed {j}", (0, 0, 0), (0.03, 0.063, 0.006), seeds, 12, 8)
            seed.parent = disc
            seed.location = (math.cos(a) * 0.075, math.sin(a) * 0.075, 0.13)
            seed.rotation_euler.z = a - math.pi / 2
            inkless(seed)
    ginger = [cel("ginger pink", ("#c44967", "#ef7f95", "#ffb5bf")),
              cel("ginger coral", ("#cf5769", "#f995a1", "#ffc7cb"))]
    # Folded broad polygon petals make the pink pile faceted and readable.
    rnd = K.rng(83)
    for i in range(10):
        a = i / 10 * TAU
        centre = Vector((0.37 + math.cos(a) * 0.20, 0.22 + math.sin(a) * 0.22, 0.36 + (i % 3) * 0.11))
        pts = [(-0.16, -0.12, 0), (0.06, -0.15, 0.035), (0.19, -0.04, 0.06),
               (0.14, 0.16, 0), (-0.06, 0.19, 0.045), (-0.18, 0.06, 0.08)]
        # The central raised ridge splits a petal into broad angular faces.
        bm = bmesh.new()
        verts = [bm.verts.new(p) for p in pts]
        centre_v = bm.verts.new((0, 0, 0.15))
        for j in range(len(verts)):
            bm.faces.new((verts[j], verts[(j + 1) % len(verts)], centre_v))
        obj = K.to_object(f"folded angular ginger {i}", bm, ginger[i % 2], smooth=False)
        obj.location = centre
        obj.rotation_euler = (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.4, 0.4), a)
        mod = obj.modifiers.new("ginger thickness", "SOLIDIFY")
        mod.thickness = 0.018


def build_takoyaki():
    angle = math.radians(30)
    c, s = math.cos(angle), math.sin(angle)
    def rotate(x, y, z):
        return Vector((x * c - y * s, x * s + y * c, z))
    gold = cel("gold angular paper boat", ("#b58a42", "#eac77c", "#ffe2a0"))
    # A real polygonal folded paper boat, with pointed ends and thick lip.
    plan = [(-1.30, 0), (-0.91, -0.68), (0.87, -0.68), (1.30, 0), (0.91, 0.68), (-0.87, 0.68)]
    profile = [(0, 0.04), (0.82, 0.04), (1.0, 0.30), (1.02, 0.33), (0.96, 0.34), (0.78, 0.065), (0, 0.065)]
    def boat_plan(t):
        f = t / TAU * len(plan)
        i = int(f) % len(plan)
        j = (i + 1) % len(plan)
        u = f - int(f)
        return plan[i][0] * (1 - u) + plan[j][0] * u, plan[i][1] * (1 - u) + plan[j][1] * u
    boat = K.to_object("folded six sided paper boat", K.lathe(profile, 48, plan=boat_plan), gold, smooth=False)
    boat.rotation_euler.z = angle
    batter = cel("gold brown takoyaki", ("#995015", "#d48920", "#f6b345"))
    sauce = cel("brown takoyaki sauce cap", ("#562408", "#89420f", "#b96517", "#de8a29"))
    balls = []
    radius = 0.325
    for row in range(2):
        for col in range(3):
            pos = rotate((col - 1) * 0.61, (row - 0.5) * 0.61, 0.065 + radius * 0.88)
            ball = ellipsoid(f"takoyaki row {row} ball {col}", pos, (radius, radius, radius * 0.92), batter, 32, 16)
            balls.append(ball)
            # Slightly lopsided separate sauce cap covers the upper half.
            def cap(u, v, col=col, row=row):
                a = u * TAU
                edge = 1.42 + 0.17 * math.sin(3 * a + col + row)
                phi = v * edge
                r = radius * 1.012
                return (r * math.sin(phi) * math.cos(a), r * math.sin(phi) * math.sin(a), r * math.cos(phi) * 0.92)
            cap_obj = K.to_object(f"takoyaki chunky sauce cap {row}{col}", K.grid_surface(cap, 40, 14, close_u=True), sauce)
            cap_obj.location = pos
            inkless(cap_obj)
            # A broad smooth hand-drawn style glaze highlight on the curved
            # upper front, with geometry following the sphere's volume.
            shine = ellipsoid(f"takoyaki broad sauce highlight {row}{col}", (0, 0, 0),
                              (0.063, 0.094, 0.012), flat("takoyaki ivory graphic shine", "#ffe3a2"))
            shine.location = pos + Vector((-0.10, -0.14, 0.24))
            shine.rotation_euler = (math.radians(29), math.radians(-20), math.radians(-24))
            inkless(shine)
    bpy.context.view_layer.update()
    bvh = K.bvh_of(balls)
    ivory = cel("ivory mayo", ("#cfbb7d", "#f7e6b3", "#fff7d2"))
    # Thick, separated zigzags across each of the six balls.
    for i, ball in enumerate(balls):
        pts = []
        for j in range(13):
            t = j / 12
            x = ball.location.x + (t - 0.5) * 0.49
            y = ball.location.y + 0.105 * math.sin(t * math.pi * 3.0)
            loc, normal = K.drop(bvh, x, y)
            if loc is not None:
                pts.append(tuple(loc + normal * 0.026))
        K.tube(f"takoyaki thick mayo zigzag {i}", pts, 0.035, ivory, resolution=5, bevel_res=3)
    green = cel("takoyaki large green herbs", ("#365f17", "#66a72a", "#98ce3d"))
    pink = cel("takoyaki pink bonito", ("#bd7362", "#ebad96", "#ffd3ba"))
    rnd = K.rng(48)
    for i, ball in enumerate(balls):
        for j in range(5):
            x = ball.location.x + rnd.uniform(-0.13, 0.13)
            y = ball.location.y + rnd.uniform(-0.13, 0.13)
            loc, normal = K.drop(bvh, x, y)
            if loc is None:
                continue
            obj = box(f"takoyaki large herb {i}{j}", loc + normal * 0.052, (0.05, 0.045, 0.032), green, bevel=0.008)
            K.orient(obj, normal, rnd.uniform(0, TAU))
        for j in range(2):
            x = ball.location.x + (-0.06 if j == 0 else 0.075)
            y = ball.location.y + 0.04
            loc, normal = K.drop(bvh, x, y)
            if loc is None:
                continue
            pts = [(-0.055, -0.055, 0), (0.065, -0.035, 0.025), (0.04, 0.06, 0.018), (-0.015, 0.09, 0.06)]
            flake = polygon(f"takoyaki broad pink bonito {i}{j}", pts, pink, 0.012)
            flake.location = loc + normal * 0.04
            K.orient(flake, normal, i * 0.8 + j * 0.5)
    p = balls[5].location
    skewer("takoyaki toothpick", p + Vector((0.18, 0.18, 0.77)), p + Vector((0, 0, 0.1)), 0.025)


def build_dango():
    angle = math.radians(-54)
    d = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-d.y, d.x, 0))
    plate("square white dango tray", 1.04, sx=1.05, sy=0.98, n=8, angle=36)
    mats = [cel("cartoon pink dango", ("#bc476f", "#ed80a0", "#ffb8ce")),
            cel("cartoon cream dango", ("#b9a374", "#f2e7c5", "#fff6dd")),
            cel("cartoon green dango", ("#52791c", "#8fbd2e", "#c8e663"))]
    for row, off in enumerate((-0.55, 0, 0.55)):
        base = side * off - d * 0.12
        for i, mat in enumerate(mats):
            pos = base + d * ((i - 1) * 0.52)
            pos.z = 0.39
            # Rounded cubes give the lightly faceted, chunky card silhouette.
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1)
            bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
            K.deform(bm, lambda v: (v.normalized() * 0.25 + v * 0.42) * Vector((0.64, 0.64, 0.59)))
            obj = K.to_object(f"dango skewer {row} ball {i}", bm, mat, smooth=True, subsurf=1)
            obj.location = pos
            obj.rotation_euler.z = angle + 0.2
            # One large rectangular glint, modeled just off the upper face.
            shine = box(f"dango {row}{i} broad shine", pos + Vector((-0.07, -0.07, 0.284)), (0.11, 0.10, 0.008),
                        flat("dango graphic shine", ("#ffcede", "#fff9e9", "#ddef98")[i]), bevel=0.012)
            shine.rotation_euler = (math.radians(20), math.radians(-20), angle)
            inkless(shine)
        a = base + d * 1.24
        b = base - d * 0.83
        a.z = b.z = 0.31
        skewer(f"dango front right handle {row}", a, b, 0.031)


BUILDERS = {0: build_gyoza, 1: build_ramen, 2: build_yakitori, 3: build_pickles, 4: build_takoyaki, 5: build_dango}

INVENTORY = {
    0: {"name": "Gyoza", "servings": 5, "vessel": "diagonal cream oval plate with cobalt blue rim", "features": ["five crescent dumplings", "cream pleats", "large golden browned faces", "large sparse green garnish"]},
    1: {"name": "Ramen", "servings": 1, "vessel": "deep royal-blue bowl with broad cream waves", "features": ["seventeen thick noodle paths covering the surface", "one large half egg", "one large pink spiral fishcake", "one large nori rectangle", "eight large open scallion rings", "brown broth only in narrow gaps"]},
    2: {"name": "Yakitori", "servings": 3, "vessel": "compact charcoal rectangular tray", "features": ["three lower-right-facing bamboo skewers", "three large chicken bites on every skewer", "two lime leek sections on every skewer", "broad grill marks"]},
    3: {"name": "Pickles", "servings": 1, "vessel": "lime green square tray", "features": ["four chunky yellow half moons left/back", "four cucumber rounds with three modeled cream seeds each", "ten broad folded faceted pink ginger petals right"]},
    4: {"name": "Takoyaki", "servings": 6, "vessel": "golden angular folded paper boat", "features": ["six balls in two dense rows", "six brown sauce caps", "six thick ivory mayo zigzags", "thirty sparse large green herbs", "twelve large pink bonito flakes", "one modeled toothpick"]},
    5: {"name": "Dango", "servings": 3, "vessel": "white square tray with cobalt blue rim", "features": ["three lower-right-facing bamboo skewers", "one pink then cream then green chunky ball on every skewer", "nine broad modeled graphic highlights"]},
}


def audit(kind):
    nodes = sorted({node.bl_idname for mat in bpy.data.materials if mat.node_tree for node in mat.node_tree.nodes})
    forbidden = [node_type for node_type in nodes if node_type in {"ShaderNodeTexImage", "ShaderNodeTexNoise", "ShaderNodeTexWhiteNoise", "ShaderNodeTexVoronoi", "ShaderNodeBump", "ShaderNodeBsdfPrincipled"}]
    if forbidden:
        raise RuntimeError(f"Toon material audit failed: {forbidden}")
    with open(__file__, "rb") as source:
        recipe_hash = hashlib.sha256(source.read()).hexdigest()
    patterns = {
        0: {"dumplings": (r"crescent gyoza \d", 5)},
        1: {"noodle_paths": (r"(?:full serving noodle \d+|big front noodle curl \d)", 17),
            "half_eggs": (r"one large half egg", 1), "fishcakes": (r"large scalloped fishcake", 1),
            "nori_sheets": (r"big back nori rectangle", 1), "scallion_rings": (r"large scallion ring \d", 8)},
        2: {"skewers": (r"yakitori handle row \d", 3), "chicken_bites": (r"chicken row \d bite \d", 9),
            "leeks": (r"lime leek row \d section \d", 6)},
        3: {"yellow_half_moons": (r"thick yellow half moon \d", 4), "cucumber_rounds": (r"large cucumber round \d", 4),
            "cucumber_seeds": (r"cucumber \d large seed \d", 12), "ginger_petals": (r"folded angular ginger \d+", 10)},
        4: {"balls": (r"takoyaki row \d ball \d", 6), "mayo_zigzags": (r"takoyaki thick mayo zigzag \d", 6)},
        5: {"skewers": (r"dango front right handle \d", 3), "balls": (r"dango skewer \d ball \d", 9)},
    }
    measured = {label: sum(bool(re.fullmatch(pattern, obj.name)) for obj in bpy.data.objects)
                for label, (pattern, expected) in patterns[kind].items()}
    for label, (pattern, expected) in patterns[kind].items():
        if measured[label] != expected:
            raise RuntimeError(f"Dish inventory audit failed: {label}={measured[label]}, expected {expected}")
    result = {
        "kind": kind, "semantic_inventory": INVENTORY[kind],
        "measured_object_inventory": measured, "object_inventory_audit_passed": True,
        "source_recipe_sha256": recipe_hash, "blender_version": bpy.app.version_string,
        "material_node_types": nodes, "material_audit_passed": not forbidden,
        "model_counts": {"mesh_objects": sum(o.type == "MESH" for o in bpy.data.objects),
                         "curve_objects": sum(o.type == "CURVE" for o in bpy.data.objects)},
        "textures_used": [], "source_image_inputs": [],
        "camera": {"projection": "orthographic", "elevation_degrees": 47, "scale": 3.1},
        "contact_shadow": {"method": "modeled analytic ellipse", "alpha_at_boundary": 0,
                           "cycles_shadow_catcher": False, "image_postprocessing": False},
        "render": {"size": ARGS.size, "samples": ARGS.samples, "engine": "Cycles", "film_transparent": True,
                   "outline_px": ARGS.size / 720 * 4.3, "cel_band_thresholds": [0.0, 0.48, 0.80]},
    }
    with open(os.path.join(ARGS.out, f"tokyo-{kind}.json"), "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")


def main():
    os.makedirs(ARGS.out, exist_ok=True)
    for kind in [int(k) for k in ARGS.kinds.split(",")]:
        setup()
        BUILDERS[kind]()
        contact_shadow(kind)
        audit(kind)
        if ARGS.save_blend:
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.abspath(ARGS.out), f"tokyo-{kind}.blend"))
        K.render(os.path.join(os.path.abspath(ARGS.out), f"tokyo-{kind}.png"))


if __name__ == "__main__":
    main()
