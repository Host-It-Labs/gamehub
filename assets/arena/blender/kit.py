"""Shared Blender helpers for Arena's models.

Every model is code: build scripts in this folder import this kit, create their
objects in metres (one arena tile is one metre), and export GLB files that the
game dresses at runtime with the high-resolution tiling textures from
public/3d/arena/tex. Materials are named "<texture>:<tint>" (for example
"stone:warm", "cloth:team", "metal:steel"); UVs are written in texture repeats
at a fixed real-world density per texture, so every surface keeps the same
crisp detail whatever its size. Ambient occlusion is baked into a vertex colour
layer called "AO".

Run a build script headless:
  Blender -b --factory-startup --python assets/arena/blender/<script>.py -- <out.glb>
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TEX = os.path.join(ROOT, "assets", "arena", "textures")

# Metres covered by one repeat of each texture. Troops use the finer "small"
# densities so their cloth and steel read at their size.
TILE = {
    "stone": 2.0,
    "roof": 1.1,
    "wood": 1.4,
    "metal": 0.9,
    "cloth": 0.7,
    "leather": 0.8,
    "rock": 2.4,
    "foliage": 1.6,
    "bark": 1.2,
    "path": 3.0,
    "pebbles": 2.0,
    "dirt": 3.0,
    "grass": 3.0,
    "forest": 3.0,
    "plain": 1.0,
}
TILE_SMALL = {"metal": 0.22, "cloth": 0.3, "leather": 0.3, "wood": 0.6,
              # The collector figures' relief families (figures.py).
              "weave": 0.26, "hide": 0.3}
TILE.update({"weave": 0.5, "hide": 0.6})

# Preview colours (linear-ish sRGB) so Blender renders resemble the game.
TINTS = {
    "team": (0.16, 0.34, 0.86),
    "team2": (0.10, 0.20, 0.55),
    "warm": (1.0, 0.97, 0.92),
    "cool": (0.86, 0.9, 1.0),
    "steel": (0.9, 0.92, 0.96),
    "dark": (0.35, 0.38, 0.46),
    "gold": (1.0, 0.76, 0.36),
    "brass": (0.95, 0.72, 0.4),
    "iron": (0.42, 0.42, 0.45),
    "brown": (0.72, 0.5, 0.32),
    "tan": (0.95, 0.82, 0.62),
    "cream": (0.96, 0.92, 0.82),
    "honey": (1.0, 0.9, 0.75),
    "peach": (1.0, 0.78, 0.64),
    "ogre": (0.56, 0.66, 0.46),
    "imp": (0.52, 0.66, 0.26),
    "drake": (0.95, 0.42, 0.16),
    "belly": (1.0, 0.86, 0.6),
    "white": (0.96, 0.96, 0.94),
    "black": (0.03, 0.03, 0.04),
    "fire": (1.0, 0.55, 0.12),
    "green": (0.55, 0.75, 0.35),
    "grey": (0.7, 0.7, 0.7),
    "red": (0.8, 0.15, 0.12),
}


# Toybox tints: sRGB hex colours registered by model scripts with tint().
# Each material stores its hex in a custom property that the GLB carries to
# the game (material.userData.hex), so a new tint needs no runtime edit.
HEX = {}


def tint(name, hex_colour):
    """Register a tint "<name>" as an sRGB hex colour ("#rrggbb")."""
    h = hex_colour.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                for c in srgb)
    HEX[name] = "#" + h.lower()
    TINTS[name] = lin
    return name


# Surface families of the toy world (see docs/arena.md, Toybox): preview
# roughness and metalness; the game gives each family its own look.
FAMILY = {
    "plastic": (0.26, 0.0),   # glossy injection-moulded plastic
    "vinyl": (0.45, 0.0),     # satin vinyl figures
    "rubber": (0.58, 0.0),    # soft rubber animals, pebbly
    "tin": (0.28, 0.5),       # lithographed tinplate toys
    "chrome": (0.1, 1.0),     # polished metal trim
    "paint": (0.34, 0.0),     # lacquered painted wood
    "beech": (0.5, 0.0),      # natural toy wood
    "felt": (0.95, 0.0),      # felt and plush
    # Collector's miniatures (the diorama figures, figures.py).
    "resin": (0.58, 0.0),     # hand-painted resin, matte satin
    "skin": (0.64, 0.0),      # sculpted skin; authored relief, no leather tile
    "reptile": (0.76, 0.0),   # matte scales sculpted into the anatomical source
    "hair": (0.48, 0.0),      # authored hair ridges with a restrained highlight
    "lacquer": (0.28, 0.0),   # gloss-varnished lacquer plates
    "gilt": (0.32, 0.85),     # metallic paint: steel, brass, gold leaf
    "hide": (0.55, 0.0),      # sculpted skin with fine scales
    "weave": (0.85, 0.0),     # painted cloth with a fine weave
    # Cloth that ripples in the game (capes, robes, sashes); needs drape().
    "drape": (0.85, 0.0),
}


def out_path():
    argv = sys.argv
    if "--" in argv and len(argv) > argv.index("--") + 1:
        return argv[argv.index("--") + 1]
    return None


def reset(seed=7):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(seed)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


# ---------------------------------------------------------------- materials

_images = {}


# The chosen source of each texture (matches scripts/arena-textures.mjs).
CHOSEN = {
    "grass": "grass-v1-b", "path": "path-v1-a", "stone": "stone-v1-b",
    "roof": "roof-v1-b", "wood": "wood-v1-a", "pebbles": "pebbles-v1-b",
    "rock": "rock-v1-b", "forest": "forest-v1-b", "foliage": "foliage-v1-b",
    "bark": "bark-v1-a", "cloth": "cloth-v1-a", "metal": "metal-v1-b",
    "leather": "leather-v1-b", "dirt": "dirt-v1-b",
}


def _image(texture):
    if texture in _images:
        return _images[texture]
    img = None
    path = os.path.join(TEX, CHOSEN.get(texture, "") + ".png")
    if texture in CHOSEN and os.path.exists(path):
        img = bpy.data.images.load(path)
    _images[texture] = img
    return img


def material(name):
    """Get or create the material "<texture>:<tint>" with a preview setup."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    texture, _, tint = name.partition(":")
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    colour = TINTS.get(tint, (0.8, 0.8, 0.8))
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    bsdf.inputs["Roughness"].default_value = 0.4 if texture == "metal" else 0.8
    if texture == "metal":
        bsdf.inputs["Metallic"].default_value = 0.8
    if texture in FAMILY:
        rough, metal = FAMILY[texture]
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    if tint in HEX:
        m["hex"] = HEX[tint]
    if texture in ("fire", "glow"):
        bsdf.inputs["Emission Color"].default_value = (*colour, 1)
        bsdf.inputs["Emission Strength"].default_value = 4
    img = _image(texture)
    ao = nt.nodes.new("ShaderNodeVertexColor")
    ao.layer_name = "AO"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1
    tint_rgb = nt.nodes.new("ShaderNodeRGB")
    tint_rgb.outputs[0].default_value = (*colour, 1)
    if img:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1
        nt.links.new(tex.outputs["Color"], mul.inputs[6])
        nt.links.new(tint_rgb.outputs[0], mul.inputs[7])
        nt.links.new(mul.outputs[2], mix.inputs[6])
    else:
        nt.links.new(tint_rgb.outputs[0], mix.inputs[6])
    nt.links.new(ao.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return m


def assign(obj, name):
    obj.data.materials.clear()
    obj.data.materials.append(material(name))
    return obj


# ---------------------------------------------------------------- objects

def _from_bmesh(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        assign(obj, mat)
    return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


# Longest edge allowed on flat faces, so baked AO has vertices to live on.
AO_EDGE = 0.3


def box(name, size, location=(0, 0, 0), mat=None, bevel=0.0, segments=2,
        grid=True):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    cuts = max(0, math.ceil(max(size) / AO_EDGE) - 1) if grid else 0
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts,
                                  use_grid_fill=True)
    obj = _from_bmesh(name, bm, mat)
    obj.location = location
    if bevel:
        add_bevel(obj, bevel, segments)
    return obj


def cylinder(name, r1, r2, depth, location=(0, 0, 0), verts=32, mat=None,
             cap=True, rings=None):
    """A cylinder or cone standing on its base at `location`."""
    bm = bmesh.new()
    # Triangle-fan caps put a vertex in the middle, so baked AO has a sample
    # away from the rim.
    bmesh.ops.create_cone(
        bm, cap_ends=cap, cap_tris=True, segments=verts,
        radius1=r1, radius2=r2, depth=depth,
    )
    bmesh.ops.translate(bm, vec=Vector((0, 0, depth / 2)), verts=bm.verts)
    if rings is None:
        rings = max(1, math.ceil(depth / AO_EDGE))
    if rings > 1:
        edges = [e for e in bm.edges
                 if abs(e.verts[0].co.z - e.verts[1].co.z) > depth * 0.5]
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=rings - 1,
                                  use_grid_fill=False)
    obj = _from_bmesh(name, bm, mat)
    obj.location = location
    return obj


def sphere(name, radius, location=(0, 0, 0), scale=(1, 1, 1), mat=None,
           segments=32, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings,
                              radius=radius)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    obj = _from_bmesh(name, bm, mat)
    obj.location = location
    return obj


def lathe(name, profile, location=(0, 0, 0), segments=32, mat=None,
          close=True):
    """Spin a list of (radius, z) points around the z axis."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segments):
            a = i / segments * math.tau
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    # Close the ends that do not meet the axis.
    if close and profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if close and profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _from_bmesh(name, bm, mat)
    obj.location = location
    return obj


def tube(name, points, radius, mat=None, segments=12, taper=None, cap=True):
    """A round tube through a list of points (a strap, a staff, a bow)."""
    curve = bpy.data.curves.new(name + "-curve", "CURVE")
    curve.dimensions = "3D"
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
        if taper:
            p.radius = taper(points.index(co) / max(1, len(points) - 1))
    curve.bevel_depth = radius
    curve.bevel_resolution = max(2, segments // 4)
    curve.use_fill_caps = cap
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    mesh_obj = to_mesh(obj)
    if mat:
        assign(mesh_obj, mat)
    return mesh_obj


def smooth_path(points, samples=24):
    """Catmull-Rom through control points, for curvy tubes."""
    pts = [Vector(p) for p in points]
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[min(len(pts) - 1, i + 2)]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t +
                                    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                                    (-p0 + 3 * p1 - 3 * p2 + p3) * t3)))
    out.append(tuple(pts[-1]))
    return out


def to_mesh(obj):
    """Replace an object (curve or modified mesh) by a plain mesh."""
    refresh()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    new = bpy.data.objects.new(obj.name, me)
    new.matrix_world = obj.matrix_world
    bpy.context.scene.collection.objects.link(new)
    name = obj.name
    parent = obj.parent
    kids = list(obj.children)
    bpy.data.objects.remove(obj, do_unlink=True)
    new.name = name
    if parent:
        mw = new.matrix_world.copy()
        new.parent = parent
        new.matrix_world = mw
    for k in kids:
        mw = k.matrix_world.copy()
        k.parent = new
        k.matrix_world = mw
    return new


def add_bevel(obj, width, segments=2, angle=35):
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    return mod


def add_subsurf(obj, levels=2):
    mod = obj.modifiers.new("subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return mod


def apply(obj):
    """Apply every modifier of a mesh object in place."""
    if obj.type != "MESH" or not obj.modifiers:
        return obj
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


def refresh():
    """Recompute world matrices after locations were set in Python."""
    bpy.context.view_layer.update()


def apply_transform(obj):
    """Bake location, rotation and scale into the mesh (keeps children)."""
    refresh()
    mw = obj.matrix_world.copy()
    if obj.type == "MESH":
        obj.data.transform(mw)
    for k in obj.children:
        k.matrix_parent_inverse = Matrix.Identity(4)
    kids = [(k, k.matrix_world.copy()) for k in obj.children]
    obj.matrix_world = Matrix.Identity(4)
    for k, m in kids:
        k.matrix_world = m
    return obj


def join(objs, name):
    refresh()
    objs = [apply(o) for o in objs]
    for o in objs:
        apply_transform(o)
    bm = bmesh.new()
    mats = []
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        offset = len(mats)
        for m in o.data.materials:
            mats.append(m)
        for f in tmp.faces:
            f.material_index += offset
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    obj = _from_bmesh(name, bm)
    # Merge duplicate materials.
    unique = []
    for m in mats:
        if m not in unique:
            unique.append(m)
    for m in unique:
        obj.data.materials.append(m)
    remap = [unique.index(m) for m in mats]
    for p in obj.data.polygons:
        if remap:
            p.material_index = remap[p.material_index]
    return obj


def set_pivot(obj, point):
    """Move an object's origin to a world point without moving its mesh."""
    refresh()
    point = Vector(point)
    local = obj.matrix_world.inverted() @ point
    obj.data.transform(Matrix.Translation(-local))
    kids = [(k, k.matrix_world.copy()) for k in obj.children]
    obj.matrix_world = obj.matrix_world @ Matrix.Translation(local)
    for k, m in kids:
        k.matrix_world = m
    return obj


def parent(child, par):
    refresh()
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_world = mw
    return child


def shade(obj, angle=40):
    """Smooth shading with sharp edges above `angle` degrees."""
    me = obj.data
    me.shade_smooth()
    try:
        me.set_sharp_from_angle(angle=math.radians(angle))
    except Exception:
        pass
    return obj


def jitter(obj, amount, seed=None):
    """Nudge vertices for a hand-made look."""
    rnd = random.Random(seed)
    for v in obj.data.vertices:
        v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1),
                        rnd.uniform(-1, 1))) * amount
    return obj


# ---------------------------------------------------------------- UVs

def _tile_for(obj, texture, small):
    table = dict(TILE)
    if small:
        table.update(TILE_SMALL)
    return table.get(texture, 1.0)


def _fresh_uvs(me):
    """One UV layer called "UVMap". Meshes built from bmesh get "Float2"
    and curves "UVMap"; mixed names would split a joined part's UVs."""
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="UVMap")


def drape(obj, top=None, bottom=None, phase=0.0, free=None):
    """Make the "drape:<tint>" faces of a mesh ripple in the game (wind.ts,
    addDrape):
    a second UV layer "Wave" holds how free each point is (x: 0 at the
    seam, 1 at the hem) and a phase (y, 0..1). By default freedom runs
    down the object's own z, from `top` (the highest point) to `bottom`
    (the lowest); `free(co)` (object-space co -> 0..1) replaces that.
    The game moves the cloth along the part's -y (behind the figure, for
    an unrotated part) and runs waves down its z and across its x, so give
    the cloth enough vertices to bend (about 10 rows from seam to hem).
    Call it after the mesh's last UV pass (which removes extra layers)
    and after any join; check the exported part still has two UV sets."""
    me = obj.data
    # Only faces painted with a drape material move; on a part that joins
    # cloth and other pieces everything else stays put (the game moves
    # every point that has freedom, in the x-ray pass too).
    cloth = {i for i, m in enumerate(me.materials)
             if m and m.name.startswith("drape")}
    polys = [p for p in me.polygons if p.material_index in cloth]
    zs = [me.vertices[v].co.z for p in polys for v in p.vertices]
    if not zs:
        print(f"drape: {obj.name} has no drape faces")
        return obj
    hi = max(zs) if top is None else top
    lo = min(zs) if bottom is None else bottom
    span = max(1e-6, hi - lo)
    layer = me.uv_layers.get("Wave") or me.uv_layers.new(name="Wave")
    for loop in me.loops:
        layer.data[loop.index].uv = (0.0, phase)
    for p in polys:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            f = free(co) if free else (hi - co.z) / span
            layer.data[li].uv = (min(1.0, max(0.0, f)), phase)
    # The colour map stays first: the glTF exporter writes TEXCOORD_0 from
    # the active layer.
    me.uv_layers.active = me.uv_layers[0]
    return obj


def uv_box(obj, small=False):
    """Per-face planar projection along the dominant axis, in texture
    repeats at the texture's real-world density (object space)."""
    me = obj.data
    _fresh_uvs(me)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        texture = me.materials[f.material_index].name.split(":")[0] \
            if me.materials else "plain"
        tile = _tile_for(obj, texture, small)
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            c = loop.vert.co
            if ax == 2:
                u, v = c.x * (1 if n.z >= 0 else -1), c.y
            elif ax == 0:
                u, v = c.y * (1 if n.x >= 0 else -1), c.z
            else:
                u, v = -c.x * (1 if n.y >= 0 else -1), c.z
            loop[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()
    return obj


def uv_cylinder(obj, small=False, cap_threshold=0.75):
    """Wrap around the object's z axis so bricks and shingles run in rings.
    The circumference holds a whole number of texture repeats."""
    me = obj.data
    _fresh_uvs(me)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        texture = me.materials[f.material_index].name.split(":")[0] \
            if me.materials else "plain"
        tile = _tile_for(obj, texture, small)
        if abs(f.normal.z) > cap_threshold:
            for loop in f.loops:
                c = loop.vert.co
                loop[uv].uv = (c.x / tile, c.y / tile)
            continue
        centre = f.calc_center_median()
        a0 = math.atan2(centre.y, centre.x)
        r = max(0.05, math.hypot(centre.x, centre.y))
        repeats = max(1, round(math.tau * r / tile))
        for loop in f.loops:
            c = loop.vert.co
            a = math.atan2(c.y, c.x)
            while a - a0 > math.pi:
                a -= math.tau
            while a - a0 < -math.pi:
                a += math.tau
            loop[uv].uv = (a / math.tau * repeats, c.z / tile)
    bm.to_mesh(me)
    bm.free()
    return obj


# ---------------------------------------------------------------- baking

def gpu():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as exc:  # pragma: no cover - CPU fallback
        print("GPU unavailable:", exc)


def bake_ao(objs, samples=64, distance=0.6, ground=True):
    """Bake ambient occlusion into each mesh's "AO" colour layer. A ground
    plane darkens the feet of standing objects, then goes away."""
    scene = bpy.context.scene
    gpu()
    scene.cycles.samples = samples
    scene.render.bake.target = "VERTEX_COLORS"
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.light_settings.distance = distance
    plane = None
    if ground:
        plane = box("__ground", (200, 200, 0.02), (0, 0, -0.01), grid=False)
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        me = o.data
        attr = me.color_attributes.get("AO") or me.color_attributes.new(
            "AO", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = \
            list(me.color_attributes).index(attr)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type="AO")
    if plane:
        bpy.data.objects.remove(plane, do_unlink=True)
    for o in meshes:
        heal_ao(o)


def heal_ao(obj, hidden=0.06, rounds=24):
    """Vertices buried inside another part bake black and bleed that black
    across every face they touch. Refill them from visible neighbours."""
    me = obj.data
    attr = me.color_attributes.get("AO")
    if not attr:
        return
    n = len(me.vertices)
    total = [0.0] * n
    count = [0] * n
    for loop in me.loops:
        total[loop.vertex_index] += attr.data[loop.index].color[0]
        count[loop.vertex_index] += 1
    value = [total[i] / count[i] if count[i] else 1.0 for i in range(n)]
    known = [v > hidden for v in value]
    neighbours = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        neighbours[a].append(b)
        neighbours[b].append(a)
    for _ in range(rounds):
        changed = False
        for i in range(n):
            if known[i]:
                continue
            vals = [value[j] for j in neighbours[i] if known[j]]
            if vals:
                value[i] = sum(vals) / len(vals)
                known[i] = True
                changed = True
        if not changed:
            break
    # A patch with no visible neighbour at all gets a mid value, not black.
    for i in range(n):
        if not known[i]:
            value[i] = 0.8
    for loop in me.loops:
        v = value[loop.vertex_index]
        c = attr.data[loop.index].color
        # Keep per-corner detail where the corner itself was visible.
        own = c[0] if c[0] > hidden else v
        attr.data[loop.index].color = (own, own, own, 1)


def fill_ao(objs, value=1.0):
    """A plain white AO layer, for objects that skip the bake."""
    for o in objs:
        if o.type != "MESH":
            continue
        me = o.data
        attr = me.color_attributes.get("AO") or me.color_attributes.new(
            "AO", "BYTE_COLOR", "CORNER")
        for d in attr.data:
            d.color = (value, value, value, 1)
        me.color_attributes.active_color = attr


# ---------------------------------------------------------------- export

def descendants(obj):
    out = [obj]
    for k in obj.children:
        out.extend(descendants(k))
    return out


def export(roots, path):
    """Export the given root objects and their children to a GLB."""
    bpy.ops.object.select_all(action="DESELECT")
    for r in roots:
        for o in descendants(r):
            o.select_set(True)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_vertex_color="ACTIVE",
        export_materials="EXPORT",
        export_extras=True,
        export_image_format="NONE",
        export_animations=False,
    )
    print("EXPORTED", path)


def preview(path, roots, size=900, elevation=35, azimuth=30, margin=1.25,
            samples=48):
    """A quick studio render for checking shapes."""
    scene = bpy.context.scene
    gpu()
    scene.cycles.samples = samples
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (
        0.62, 0.7, 0.8, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.7
    pts = []
    for r in roots:
        for o in descendants(r):
            if o.type == "MESH":
                pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts),
                 min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts),
                 max(p.z for p in pts)))
    centre = (lo + hi) / 2
    radius = (hi - lo).length / 2 * margin
    cam_data = bpy.data.cameras.new("preview")
    cam_data.lens = 70
    cam = bpy.data.objects.new("preview-cam", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    dist = radius / math.tan(cam_data.angle / 2)
    cam.location = centre + Vector((math.sin(az) * math.cos(el) * -dist,
                                    -math.cos(az) * math.cos(el) * dist,
                                    math.sin(el) * dist))
    direction = centre - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 4
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(10),
                          math.radians(-35))
    scene.collection.objects.link(sun)
    floor = box("__floor", (60, 60, 0.02), (centre.x, centre.y, lo.z - 0.011),
                mat="plain:grey", grid=False)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (cam, sun, floor):
        bpy.data.objects.remove(o, do_unlink=True)
    print("PREVIEW", path)
