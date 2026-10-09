"""Review renders for the passenger models (docs/concepts/2026-10-08-rota-
passengers/models.md), from the exported GLBs, drawn roughly the way the
game draws them: flat tint colours in three hard light tones (shade, mid,
light) with the baked AO softened to 38%, dark ink outlines (Freestyle),
the game's sun from the north-west, its 26 degree lens and 49 degree
pitch looking north (Blender +Y), so an unrotated model shows its -Y face.

  Blender -b --factory-startup --python docs/concepts/2026-10-08-rota-passengers/review.py -- \\
      assets/rota/build/vehicles.glb assets/rota/build/works.glb \\
      docs/concepts/2026-10-08-rota-passengers/renders [shot,shot,...]

Shots: faces-hall, faces-grand (each building turned so every face meets
the camera), scene-small, scene-grand (a station with platforms on its -Y
side and steps on its +X side, a two-car DMU at the platform, a car-sized
box at the steps, person-sized boxes), close-small, close-grand (the same,
nearer and lower), game-small, game-grand (the scene at game scale), and
dmu-pair (the coupled DMU on track).
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
VEH, WORKS, OUT = ARGS[:3]
SHOTS = ARGS[3].split(",") if len(ARGS) > 3 else None
os.makedirs(OUT, exist_ok=True)

LIVERY = ("#2d5fa8", "#1b3766")       # seat 0: main and dark
GLASS = {"shed": "#9fb5bd"}
GLASS_DEFAULT = "#5e7682"
PUSH = {"grass": (1.05, 0.04), "foliage": (1.1, 0.05), "slate": (1.0, 0.06),
        "stone": (1.0, 0.06), "rock": (1.0, 0.06), "metal": (0.9, 0.12),
        "chrome": (0.7, 0.2)}


def srgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
                 for x in c)


def cartoon(hexcol, family):
    """The game's colour push (materials.ts cartoon): saturation and a
    lift towards white, nothing darker than a floor."""
    import colorsys
    r, g, b = srgb(hexcol)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    sat, lift = PUSH.get(family, (1.0, 0.04))
    s = min(0.9, s * sat)
    l = l + (1 - l) * lift
    l = max(l, 0.1 if family in ("rubber", "plain") else 0.16)
    return lin(colorsys.hls_to_rgb(h, l, s))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = 1.1
    ls = sc.view_layers[0].freestyle_settings.linesets
    if not ls:
        sc.view_layers[0].freestyle_settings.linesets.new("ink")
    lset = sc.view_layers[0].freestyle_settings.linesets[0]
    lset.select_by_visibility = True
    lset.select_silhouette = True
    lset.select_border = True
    lset.select_crease = True
    sc.view_layers[0].freestyle_settings.crease_angle = math.radians(128)
    if lset.linestyle is None:
        lset.linestyle = bpy.data.linestyles.new("ink")
    lset.linestyle.color = (0.09, 0.08, 0.08)
    lset.linestyle.thickness = 1.1
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (
        *lin(srgb("#c9c2b4")), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.2
    sun.color = lin(srgb("#ffdcaa"))
    sun.angle = math.radians(1.5)
    o = bpy.data.objects.new("sun", sun)
    # The game's sun sits at (-0.95, 0.95, -0.45) in three.js (x east,
    # y up, z south): north-west and 42 degrees up.
    d = Vector((-0.95, 0.45, 0.95)).normalized()
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    sc.collection.objects.link(o)
    try:
        sc.eevee.use_shadows = True
    except AttributeError:
        pass
    return sc


def toon(name, colour, emit=None, flat=False, ao=True):
    """A three-tone toon material: diffuse light through a constant ramp
    (96, 178, 255) times the colour, AO softened to 38%."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links
    col = nt.nodes.new("ShaderNodeRGB")
    col.outputs[0].default_value = (*colour, 1)
    base = col.outputs[0]
    if ao:
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "AO"
        soft = nt.nodes.new("ShaderNodeMix")
        soft.data_type = "RGBA"
        soft.inputs["Factor"].default_value = 0.38
        soft.inputs[6].default_value = (1, 1, 1, 1)
        L.new(attr.outputs["Color"], soft.inputs[7])
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1
        L.new(col.outputs[0], mul.inputs[6])
        L.new(soft.outputs[2], mul.inputs[7])
        base = mul.outputs[2]
    em = nt.nodes.new("ShaderNodeEmission")
    if flat:
        L.new(base, em.inputs["Color"])
        em.inputs["Strength"].default_value = 1.0
        L.new(em.outputs[0], out.inputs[0])
        return m
    dif = nt.nodes.new("ShaderNodeBsdfDiffuse")
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    L.new(dif.outputs[0], s2r.inputs[0])
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    L.new(s2r.outputs[0], bw.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    e = ramp.color_ramp.elements
    e[0].position = 0.0
    e[0].color = (0.376, 0.376, 0.376, 1)
    e[1].position = 0.35
    e[1].color = (0.698, 0.698, 0.698, 1)
    e3 = e.new(0.75)
    e3.color = (1, 1, 1, 1)
    L.new(bw.outputs[0], ramp.inputs[0])
    mul2 = nt.nodes.new("ShaderNodeMix")
    mul2.data_type = "RGBA"
    mul2.blend_type = "MULTIPLY"
    mul2.inputs["Factor"].default_value = 1
    L.new(base, mul2.inputs[6])
    L.new(ramp.outputs[0], mul2.inputs[7])
    L.new(mul2.outputs[2], em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    if emit:
        add = nt.nodes.new("ShaderNodeMix")
        add.data_type = "RGBA"
        add.blend_type = "ADD"
        add.inputs["Factor"].default_value = 1
        L.new(mul2.outputs[2], add.inputs[6])
        add.inputs[7].default_value = (*emit, 1)
        L.new(add.outputs[2], em.inputs["Color"])
    L.new(em.outputs[0], out.inputs[0])
    return m


_cache = {}


def dressed(mat):
    """The game's look for an imported "family:tint" material."""
    name = mat.name.split(".")[0]
    if name in _cache:
        return _cache[name]
    fam, _, tint = name.partition(":")
    hexcol = mat.get("hex")
    if tint == "team":
        m = toon(name, lin(srgb(LIVERY[0])))
    elif tint == "team2":
        m = toon(name, lin(srgb(LIVERY[1])))
    elif fam == "glass":
        m = toon(name, lin(srgb(GLASS.get(tint, GLASS_DEFAULT))),
                 emit=tuple(c * 0.25 for c in lin(srgb("#34505e"))))
    elif fam == "plain" and tint == "void":
        m = toon(name, lin(srgb("#1d2a24")), flat=True, ao=False)
    elif fam == "glow":
        m = toon(name, lin(srgb(hexcol or "#fff1c2")), flat=True, ao=False)
    else:
        m = toon(name, cartoon(hexcol or "#cccccc", fam))
    _cache[name] = m
    return m


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = {o.name.split(".")[0]: o for o in new if o.parent is None}
    for o in new:
        if o.type == "MESH":
            for i, m in enumerate(o.data.materials):
                if m:
                    o.data.materials[i] = dressed(m)
    for o in new:
        o.hide_render = True
        o.hide_viewport = True
    return roots


def instance(src, loc=(0, 0, 0), rz=0.0, name=None, rot_kids=None):
    """A linked copy of an imported root and its children."""
    def copy(o, parent):
        c = bpy.data.objects.new(o.name + "-i", o.data)
        bpy.context.scene.collection.objects.link(c)
        c.matrix_local = o.matrix_local.copy() if parent else Matrix()
        c.parent = parent
        if rot_kids and o.name.split(".")[0] in rot_kids:
            c.matrix_local = c.matrix_local @ Matrix.Rotation(
                rot_kids[o.name.split(".")[0]], 4, "Z")
        for k in o.children:
            copy(k, c)
        return c
    top = copy(src, None)
    # glTF import gives the root a Y-up correction; keep its rotation.
    top.matrix_world = Matrix.Translation(Vector(loc)) @ \
        Matrix.Rotation(rz, 4, "Z") @ src.matrix_world
    return top


def block(name, size, loc, hexcol, fam="plain"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(toon(name, cartoon(hexcol, fam), ao=False))
    return o


def ground(x0, x1, y0, y1):
    block("ground", (x1 - x0, y1 - y0, 0.02), ((x0 + x1) / 2, (y0 + y1) / 2,
                                               -0.01), "#8f8a79")
    # Square edges, faint.
    for k in range(int(x0) - 1, int(x1) + 2):
        x = k + 0.5
        if x0 < x < x1:
            block("gx", (0.004, y1 - y0, 0.001), (x, (y0 + y1) / 2, 0.0005),
                  "#a39c88")
    for k in range(int(y0) - 1, int(y1) + 2):
        y = k + 0.5
        if y0 < y < y1:
            block("gy", (x1 - x0, 0.004, 0.001), ((x0 + x1) / 2, y, 0.0005),
                  "#a39c88")


def track_y(x, y0, y1):
    """The game's track profile along Y: ballast, sleepers, rails."""
    L, yc = y1 - y0, (y0 + y1) / 2
    block("ballast", (0.2, L, 0.018), (x, yc, 0.009), "#776d63", "ballast")
    y = y0 + 0.02
    while y < y1 - 0.01:
        block("sleeper", (0.17, 0.024, 0.006), (x, y, 0.021), "#4d3c30",
              "wood")
        y += 0.06
    for s in (-1, 1):
        block("rail", (0.006, L, 0.014), (x + s * 0.045, yc, 0.031),
              "#c9ced6", "metal")


def street_x(y, x0, x1):
    """A street along X: setts, kerbs and flagged pavements."""
    L, xc = x1 - x0, (x0 + x1) / 2
    block("setts", (L, 0.3, 0.012), (xc, y, 0.006), "#77726b", "cobble")
    for s in (-1, 1):
        block("pave", (L, 0.05, 0.022), (xc, y + s * 0.175, 0.011),
              "#a9a191", "stone")
        block("kerb", (L, 0.006, 0.0225), (xc, y + s * 0.153, 0.011),
              "#c9c0ad", "stone")


def person(x, y, z, hexcol="#7d91aa"):
    block("person", (0.02, 0.016, 0.052), (x, y, z + 0.026), hexcol)
    block("head", (0.013, 0.013, 0.02), (x, y, z + 0.062), "#e2c3a3")


def camera(target, dist, pitch=49.0, yaw=0.0, fov=26.0, w=1600, h=1000):
    sc = bpy.context.scene
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    cd = bpy.data.cameras.new("cam")
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(fov)
    cd.clip_start = 0.02
    cd.clip_end = 200
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    p, yw = math.radians(pitch), math.radians(yaw)
    d = Vector((math.sin(yw) * math.cos(p), math.cos(yw) * math.cos(p),
                -math.sin(p)))
    cam.location = Vector(target) - d * dist
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def scene_station(lib, half, hall, plats, steps, close=False, game=False,
                  tag=""):
    ground(-1.6, 1.6, -1.6, 1.0)
    instance(lib[hall])
    instance(lib[plats])                         # rail on -Y
    instance(lib[steps], rz=math.pi / 2)         # road on +X
    track_y(0.0, -1.6, -half)
    street_x(0.0, half + 0.06, 1.6)
    # A two-car DMU, its front 0.018 from the bank face; doors open on
    # the -X side of the leading car.
    front = -half - 0.018
    c1 = front - 0.17
    open_ = {"door_l0": -math.radians(78), "door_l1": math.radians(78)}
    instance(lib["dmu_car"], (0, c1, 0), rot_kids=open_)
    instance(lib["dmu_car"], (0, c1 - 0.34, 0), rz=math.pi)
    # A car at the steps, people on the platforms, bank and steps.
    block("car", (0.15, 0.065, 0.06), (half + 0.06 + 0.09, 0.075, 0.042),
          "#c43a2f")
    for (x, y, z, col) in ((-0.13, -half - 0.12, 0.056, "#7d91aa"),
                           (-0.11, -half - 0.09, 0.056, "#9a6b4f"),
                           (0.14, -half - 0.2, 0.056, "#55705a"),
                           (0.0, -half + 0.03, 0.056, "#8a7aa3"),
                           (half - 0.02, 0.05, 0.056, "#a3584c"),
                           (half + 0.035, 0.11, 0.03, "#5f6f8a")):
        person(x, y, z, col)
    if game:
        camera((0.0, -0.2, 0.0), 6.5, 49, 0, 26, 1600, 1000)
    elif close:
        camera((-0.04, -0.2, 0.07), 1.45, 28, -32, 26, 1600, 1000)
    else:
        camera((0.05, -0.12, 0.05), 2.5, 49, 0, 26, 1600, 1100)


def faces(lib, name, half):
    ground(-0.8, 0.8, -0.8, 0.8)
    o = instance(lib[name])
    for k in range(4):
        o.matrix_world = Matrix.Rotation(-math.pi / 2 * k, 4, "Z") @ \
            lib[name].matrix_world
        camera((0.0, 0.0, 0.1), 2.1 + half * 2, 49, 0, 26, 1000, 900)
        render(os.path.join(OUT, f"{name}-face{k}.png"))


def main():
    shots = SHOTS or ["faces-hall", "faces-grand", "scene-small",
                      "scene-grand", "close-small", "close-grand",
                      "game-small", "game-grand", "dmu-pair"]
    for shot in shots:
        reset()
        _cache.clear()
        lib = {}
        lib.update(load(VEH))
        lib.update(load(WORKS))
        if shot == "faces-hall":
            faces(lib, "station_hall", 0.2)
            continue
        if shot == "faces-grand":
            faces(lib, "station_grand", 0.25)
            continue
        if shot == "dmu-pair":
            ground(-1, 1, -1, 1)
            track_y(0, -0.9, 0.9)
            instance(lib["dmu_car"], (0, 0.17, 0))
            instance(lib["dmu_car"], (0, -0.17, 0), rz=math.pi)
            camera((0, 0, 0.08), 2.2, 30, -35, 26, 1600, 900)
            render(os.path.join(OUT, "dmu-pair.png"))
            continue
        kind, size = shot.split("-")
        small = size == "small"
        half = 0.2 if small else 0.25
        sfx = "" if small else "_grand"
        scene_station(lib, half, "station_hall" if small else "station_grand",
                      "station_platforms" + sfx, "station_steps" + sfx,
                      close=kind == "close", game=kind == "game")
        render(os.path.join(OUT, f"{shot}.png"))


main()
