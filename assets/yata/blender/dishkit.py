"""Shared Blender helpers for Yata's 3D dishes.

Each dish is modelled in code (one script per menu, e.g. tokyo.py) and
rendered as a still with Cycles: a transparent film, a shadow catcher under
the dish so its soft contact shadow lands in the alpha, and the same
orthographic three-quarter camera and lantern lighting for every dish, so the
renders sit together on the painted counter. Materials are procedural node
trees, never small baked images, so the renders stay crisp at any size.

Units: one unit is roughly 10 cm. A dish fits a 2.6 x 2.6 footprint centred on
the origin, standing on z = 0, its front facing -Y (towards the camera).
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

TAU = math.tau

# The camera looks down at the counter from the front, like a player leaning
# over the stall. Every dish uses the same view and scale.
CAM_ELEVATION = 50.0  # degrees above the counter
CAM_SCALE = 3.5  # orthographic width in units
CAM_TARGET = (0.0, 0.0, 0.32)
VIEW = "Standard"
EXPOSURE = -0.1
INK = 1.6  # outline weight multiplier


# ------------------------------------------------------------------ scene

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                  bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)


def gpu(scene):
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


def setup_render(size=1200, samples=128, outline=True):
    scene = bpy.context.scene
    gpu(scene)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    vs = scene.view_settings
    # Standard keeps the toon drawings' saturated colours; AgX greys them.
    vs.view_transform = VIEW
    vs.look = "None"
    vs.exposure = EXPOSURE
    scene.display_settings.display_device = "sRGB"
    if outline:
        scene.render.use_freestyle = True
        scene.render.line_thickness_mode = "ABSOLUTE"
        scene.render.line_thickness = 1.0
        fs = bpy.context.view_layer.freestyle_settings
        fs.crease_angle = math.radians(120)
        for ls in list(fs.linesets):
            fs.linesets.remove(ls)
        ls = fs.linesets.new("ink")
        ls.select_by_visibility = True
        ls.select_by_edge_types = True
        ls.select_by_collection = True
        ls.collection_negation = "EXCLUSIVE"
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = False
        ls.select_external_contour = True
        style = ls.linestyle
        style.color = (0.07, 0.05, 0.06)
        style.thickness = size / 420.0 * INK
        style.alpha = 0.9
        style.thickness_position = "INSIDE"
    return scene


def no_ink():
    """Objects in this collection never get a freestyle outline."""
    col = bpy.data.collections.get("no_ink")
    if not col:
        col = bpy.data.collections.new("no_ink")
        bpy.context.scene.collection.children.link(col)
        fs = bpy.context.view_layer.freestyle_settings
        for ls in fs.linesets:
            ls.collection = col
    return col


def move_to(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def camera(elevation=CAM_ELEVATION, scale=CAM_SCALE, target=CAM_TARGET):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = scale
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    e = math.radians(elevation)
    d = 20.0
    t = Vector(target)
    cam.location = t + Vector((0, -math.cos(e) * d, math.sin(e) * d))
    direction = t - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def area_light(name, loc, energy, color, size, target=(0, 0, 0.2)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    direction = Vector(target) - Vector(loc)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def lights():
    """The stall's lantern hangs above the far edge of the counter: a warm
    soft key from behind and above, a cool night fill from the street side
    and a warm rim that puts gloss on sauces and glazes."""
    area_light("key", (-1.4, 2.8, 8.5), 1500, (1.0, 0.86, 0.7), 2.6)
    area_light("fill", (3.5, -4.5, 3.0), 220, (0.78, 0.84, 1.0), 2.5)
    area_light("rim", (3.5, 3.0, 1.8), 260, (1.0, 0.62, 0.38), 1.6)
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.22, 0.2, 0.22, 1.0)
    bg.inputs["Strength"].default_value = 0.6
    bpy.context.scene.world = world


def shadow_catcher(size=12.0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    obj = to_object("counter", bm, None, smooth=False)
    obj.is_shadow_catcher = True
    move_to(obj, no_ink())
    return obj


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------- materials

class Nodes:
    """Tiny node-tree builder: n = Nodes(mat); n.add(type, **inputs)."""

    def __init__(self, mat):
        self.tree = mat.node_tree
        self.nodes = self.tree.nodes
        self.links = self.tree.links

    def add(self, kind, *, op=None, data=None, **inputs):
        node = self.nodes.new(kind)
        if op is not None:
            if hasattr(node, "operation"):
                node.operation = op
            elif hasattr(node, "blend_type"):
                node.blend_type = op
        if data:
            for k, v in data.items():
                setattr(node, k, v)
        for key, value in inputs.items():
            self.set(node, key.replace("_", " "), value)
        return node

    def set(self, node, key, value):
        sock = node.inputs[key] if not isinstance(key, int) else node.inputs[key]
        if hasattr(value, "links") or isinstance(value, bpy.types.NodeSocket):
            self.links.new(value, sock)
        elif isinstance(value, bpy.types.Node):
            self.links.new(value.outputs[0], sock)
        else:
            sock.default_value = value

    def link(self, out, inp):
        self.links.new(out, inp)


def rgb(hexcode):
    """sRGB hex to linear RGBA."""
    hexcode = hexcode.lstrip("#")
    c = [int(hexcode[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


def principled(name, color="#ffffff", rough=0.5, coat=0.0, coat_rough=0.08,
               sss=0.0, sss_radius=(0.3, 0.15, 0.08), sheen=0.0, spec=0.5,
               metal=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    n = Nodes(mat)
    if isinstance(color, str):
        bsdf.inputs["Base Color"].default_value = rgb(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_rough
    bsdf.inputs["Subsurface Weight"].default_value = sss
    bsdf.inputs["Subsurface Radius"].default_value = sss_radius
    bsdf.inputs["Subsurface Scale"].default_value = 0.05
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bsdf.inputs["Specular IOR Level"].default_value = spec
    return mat, n, bsdf


def ramp(n, factor, stops, interp="LINEAR"):
    """Colour ramp from (position, hex) stops; returns the node."""
    node = n.add("ShaderNodeValToRGB")
    cr = node.color_ramp
    cr.interpolation = interp
    while len(cr.elements) > 1:
        cr.elements.remove(cr.elements[-1])
    cr.elements[0].position = stops[0][0]
    cr.elements[0].color = rgb(stops[0][1]) if isinstance(stops[0][1], str) else stops[0][1]
    for pos, col in stops[1:]:
        el = cr.elements.new(pos)
        el.color = rgb(col) if isinstance(col, str) else col
    n.link(factor, node.inputs["Fac"])
    return node


def noise(n, scale=5.0, detail=4.0, rough=0.55, vector=None, dims="3D"):
    node = n.add("ShaderNodeTexNoise", Scale=scale, Detail=detail, Roughness=rough)
    node.noise_dimensions = dims
    if vector is not None:
        n.link(vector, node.inputs["Vector"])
    return node


def bump(n, bsdf, height, strength=0.3, distance=0.02):
    node = n.add("ShaderNodeBump", Strength=strength, Distance=distance)
    n.link(height, node.inputs["Height"])
    n.link(node.outputs["Normal"], bsdf.inputs["Normal"])
    if "Coat Normal" in bsdf.inputs:
        pass
    return node


def math_node(n, op, a, b=None, clamp=False):
    node = n.add("ShaderNodeMath", op=op)
    node.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            node.inputs[i].default_value = v
        else:
            n.link(v if isinstance(v, bpy.types.NodeSocket) else v.outputs[0], node.inputs[i])
    return node.outputs[0]


def attr(n, name):
    node = n.add("ShaderNodeAttribute")
    node.attribute_name = name
    return node


# ------------------------------------------------------------------ meshes

def to_object(name, bm, mat, smooth=True, subsurf=0, col=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    (col or bpy.context.scene.collection).objects.link(obj)
    if mat is not None:
        me.materials.append(mat)
    if subsurf:
        mod = obj.modifiers.new("subsurf", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    return obj


def grid_surface(fn, nu, nv, close_u=False, close_v=False, attrs=None):
    """Mesh from a parametric surface fn(u, v) -> (x, y, z), u and v in [0, 1].
    close_u wraps u around. attrs(u, v) -> {name: float} writes point
    attributes that shaders read with an Attribute node."""
    bm = bmesh.new()
    cols = nu if close_u else nu + 1
    rows = nv if close_v else nv + 1
    # Layers must exist before any vertex: adding one invalidates them.
    layers = {key: bm.verts.layers.float.new(key) for key in (attrs(0, 0) if attrs else {})}
    grid = []
    for j in range(rows):
        row = []
        for i in range(cols):
            u, v = i / nu, j / nv
            vert = bm.verts.new(fn(u, v))
            if attrs:
                for key, value in attrs(u, v).items():
                    vert[layers[key]] = value
            row.append(vert)
        grid.append(row)
    for j in range(nv if close_v else nv):
        for i in range(nu if close_u else nu):
            a = grid[j][i]
            b = grid[j][(i + 1) % cols]
            c = grid[(j + 1) % rows][(i + 1) % cols]
            d = grid[(j + 1) % rows][i]
            if len({a, b, c, d}) == 4:
                bm.faces.new((a, b, c, d))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return bm


def superellipse(theta, n=2.0, sx=1.0, sy=1.0):
    c, s = math.cos(theta), math.sin(theta)
    x = math.copysign(abs(c) ** (2.0 / n), c) * sx
    y = math.copysign(abs(s) ** (2.0 / n), s) * sy
    return x, y


def lathe(profile, segments=128, n=2.0, sx=1.0, sy=1.0, plan=None):
    """Revolve a (radius, height) profile, outside-in or inside-out, around a
    plan contour: a circle (n=2), a rounded square (n=4..8), stretched by
    sx/sy, or any plan(theta) -> (x, y). The profile's first and last points
    with radius 0 close the shape."""
    plan = plan or (lambda t: superellipse(t, n, sx, sy))
    pts = [plan(i / segments * TAU) for i in range(segments)]

    rmax = max(r for r, _ in profile) or 1.0
    last = len(profile) - 1

    def fn(u, v):
        r, z = profile[min(int(round(v * last)), last)]
        x, y = pts[int(round(u * segments)) % segments]
        return (x * r, y * r, z)

    def attrs(u, v):
        k = min(int(round(v * last)), last)
        # pr: radius along the profile (0 centre, 1 rim); pv: position along
        # the profile; pu: angle around.
        return {"pr": profile[k][0] / rmax, "pv": k / last, "pu": u}

    return grid_surface(fn, segments, last, close_u=True, attrs=attrs)


def smooth_profile(points, steps=6):
    """Catmull-Rom through (r, z) points for a softer lathe profile."""
    out = []
    p = [points[0]] + points + [points[-1]]
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t +
                       (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
                       (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                for k in range(2)))
    out.append(points[-1])
    return out


def sphere(radius=1.0, segments=48, rings=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    return bm


def deform(bm, fn):
    for v in bm.verts:
        v.co = Vector(fn(v.co.copy()))
    return bm


def transform(obj, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    obj.scale = scale
    return obj


def tube(name, points, radius, mat, resolution=12, bevel_res=6, taper=None,
         col=None, radii=None):
    """A round tube along a poly path (noodles, mayo, skewers)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = resolution
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
        if radii:
            bp.radius = radii[i]
    obj = bpy.data.objects.new(name, cu)
    (col or bpy.context.scene.collection).objects.link(obj)
    if mat is not None:
        cu.materials.append(mat)
    return obj


def cylinder_between(name, a, b, radius, mat, segments=24, cap=True):
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=segments,
                          radius1=radius, radius2=radius, depth=(b - a).length)
    obj = to_object(name, bm, mat)
    obj.location = (a + b) / 2
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def join(objs, name):
    """Apply modifiers and join meshes into one object."""
    ctx = bpy.context
    meshes = []
    for o in objs:
        if o.type == "CURVE":
            ctx.view_layer.objects.active = o
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.ops.object.convert(target="MESH")
        meshes.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    ctx.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    meshes[0].name = name
    return meshes[0]


def rng(seed):
    return random.Random(seed)


# ------------------------------------------------------------- raycasting

def bvh_of(objs):
    """World-space BVH of the given objects (modifiers applied), for laying
    garnish onto food."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for o in objs:
        eo = o.evaluated_get(dg)
        me = eo.to_mesh()
        off = len(verts)
        mw = o.matrix_world
        verts += [mw @ v.co for v in me.vertices]
        polys += [[off + i for i in p.vertices] for p in me.polygons]
        eo.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys)


def drop(bvh, x, y, top=10.0):
    """Where a ray straight down at (x, y) first meets the BVH: (loc, normal)
    or (None, None)."""
    loc, normal, _, _ = bvh.ray_cast(Vector((x, y, top)), Vector((0, 0, -1)))
    return loc, normal


def orient(obj, normal, spin=0.0):
    """Turn obj so its +Z follows normal, spun around it."""
    q = Vector(normal).to_track_quat("Z", "Y")
    obj.rotation_mode = "QUATERNION"
    from mathutils import Quaternion
    obj.rotation_quaternion = q @ Quaternion((0, 0, 1), spin)
