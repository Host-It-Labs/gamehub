"""Fresh anatomical modeling helpers for the quality-first Dino rebuild.

All operations preserve a high-resolution master. Runtime reduction is a
separate later operation after the primary form has been visually reviewed.
"""

import math

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_ogre_kit as fk

X, Y, Z = fk.X, fk.Y, fk.Z


def loft(name, rings, mat, level=3, start=(0, 0, 0), end=(0, 0, 0),
         creases=(), sculpt=None):
    obj = fk.loft(name, rings, [mat],
                  start=("dome", Vector(start)),
                  end=("dome", Vector(end)), creases=creases)
    fk.subdivide(obj, level)
    if sculpt:
        fk.displace(obj, sculpt)
    return obj


def sweep(name, points, widths, fronts, backs, mat, level=3, n=16,
          sculpt=None, power=2.0):
    """Author a changing anatomical cross-section, not a radius tube."""
    path = [Vector(p) for p in points]
    rings = []
    for i, centre in enumerate(path):
        tangent = (path[min(i + 1, len(path) - 1)] -
                   path[max(i - 1, 0)]).normalized()
        side = X - tangent * tangent.dot(X)
        side.normalize()
        up = side.cross(tangent).normalized()
        rings.append(fk.ring(centre, up,
                             fk.ellipse(widths[i], fronts[i], backs[i],
                                        [j * 360 / n for j in range(n)],
                                        power), side))
    obj = loft(name, rings, mat, level,
               start=(path[0] - path[1]).normalized() * widths[0] * 0.35,
               end=(path[-1] - path[-2]).normalized() * widths[-1] * 0.35,
               sculpt=sculpt)
    return obj


def ellipsoid(name, centre, axes, mat, segments=40, rings=24):
    obj = kit.sphere(name, 1, mat=mat, segments=segments, rings=rings)
    transform = Matrix.Identity(4)
    for i, axis in enumerate(axes):
        for j in range(3):
            transform[j][i] = axis[j]
    obj.data.transform(Matrix.Translation(Vector(centre)) @ transform)
    if transform.determinant() < 0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
    obj.data.update()
    return obj


def curve(name, points, radii, mat, n=12, level=2):
    return sweep(name, points, radii, radii, radii, mat, level=level, n=n)


def oral_recess(name, rows, mat, n=24):
    """An inward-facing open bowl: a recessed throat, never a solid plug."""
    verts, faces = [], []
    for y, z, width, top, bottom in rows:
        for k in range(n):
            a = math.tau * k / n
            height = top if math.sin(a) >= 0 else bottom
            verts.append((math.cos(a) * width, y, z + math.sin(a) * height))
    for row in range(len(rows) - 1):
        for k in range(n):
            j = (k + 1) % n
            faces.append((row * n + k, (row + 1) * n + k,
                          (row + 1) * n + j, row * n + j))
    back = len(verts)
    y, z, _, _, _ = rows[-1]
    verts.append((0, y - .033, z))
    for k in range(n):
        faces.append(((len(rows) - 1) * n + k, back,
                      (len(rows) - 1) * n + (k + 1) % n))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(kit.material(mat))
    fk.subdivide(obj, 2)
    kit.shade(obj, 75)
    return obj


def skin_union(name, pieces, mat, voxel=0.011, smooth=2):
    """Fuse the skin junctions of palms/toes before adding separate horn."""
    obj = kit.join(pieces, name)
    kit.apply_transform(obj)
    mod = obj.modifiers.new("continuous-skin", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    kit.apply(obj)
    if smooth:
        mod = obj.modifiers.new("skin-transition", "SMOOTH")
        mod.factor = 0.28
        mod.iterations = smooth
        kit.apply(obj)
    kit.assign(obj, mat)
    return obj


def subtract(obj, cutter, label):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new(label, "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    obj.data.update()
    return obj


def horn(name, base, direction, length, width, mat, bend=0.04, flat=0.8):
    """A tapered tooth/claw with a broad rooted shoulder and banana curve."""
    d = Vector(direction).normalized()
    bend_axis = Y - d * Y.dot(d)
    if bend_axis.length < 0.01:
        bend_axis = Z - d * Z.dot(d)
    bend_axis.normalize()
    points = [Vector(base) + d * length * t + bend_axis * bend * t * t
              for t in (0, 0.18, 0.42, 0.68, 0.88, 1)]
    radii = [width * k for k in (0.9, 1, 0.81, 0.55, 0.24, 0.014)]
    return sweep(name, points, radii,
                 [r * flat for r in radii], [r * flat for r in radii],
                 mat, level=2, n=12)


def clay_material():
    m = bpy.data.materials.get("Dino-neutral-clay")
    if m:
        return m
    m = bpy.data.materials.new("Dino-neutral-clay")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.36, 0.385, 0.40, 1)
    bsdf.inputs["Roughness"].default_value = 0.82
    return m


def clay_override(root):
    """Neutral geometry review: no hue, textures or speculative baked AO."""
    mat = clay_material()
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for polygon in obj.data.polygons:
            polygon.material_index = 0


def bounds(root):
    kit.refresh()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lows, highs = [], []
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            co = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
            mesh.vertices.foreach_get("co", co)
            M = np.asarray(evaluated.matrix_world)
            P = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
            if len(P):
                lows.append(np.min(P, axis=0))
                highs.append(np.max(P, axis=0))
        finally:
            evaluated.to_mesh_clear()
    return Vector(np.min(lows, axis=0)), Vector(np.max(highs, axis=0))


def review_render(root, path, elevation, azimuth, size=(1000, 1000),
                  focus=None, extent=None, samples=40, device="CPU"):
    """An orthographic, whole-silhouette review with consistent soft light."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.device = device
    if device == "GPU":
        kit.gpu()
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    world = scene.world or bpy.data.worlds.new("Dino-review-world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (
        0.20, 0.215, 0.23, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.7
    lo, hi = bounds(root)
    target = Vector(focus) if focus else (lo + hi) / 2
    cam_data = bpy.data.cameras.new("Dino-review-camera")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("Dino-review-camera", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    direction = Vector((math.sin(az) * math.cos(el),
                        math.cos(az) * math.cos(el), math.sin(el)))
    cam.location = target + direction * 12
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    frame = cam.rotation_euler.to_matrix().inverted()
    corners = [frame @ (Vector((x, y, z)) - target)
               for x in (lo.x, hi.x) for y in (lo.y, hi.y)
               for z in (lo.z, hi.z)]
    height = max(p.y for p in corners) - min(p.y for p in corners)
    width = max(p.x for p in corners) - min(p.x for p in corners)
    # Blender's orthographic scale spans the horizontal camera frame.
    cam_data.ortho_scale = extent or max(width, height * size[0] / size[1]) * 1.12
    lights = []
    for label, at, energy, area in (
            ("key", (-4, 4, 7), 700, 5.0),
            ("fill", (5, 3, 4), 360, 5.0),
            ("rim", (0, -5, 6), 600, 4.0)):
        data = bpy.data.lights.new("Dino-review-" + label, "AREA")
        data.energy, data.shape, data.size = energy, "DISK", area
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = target + Vector(at)
        obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()
        lights.append(obj)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, lo.z - .002))
    floor = bpy.context.object
    floor.name = "Dino-review-floor"
    mat = bpy.data.materials.new("Dino-review-floor")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (.22, .235, .25, 1)
    bsdf.inputs["Roughness"].default_value = 1
    floor.data.materials.clear()
    floor.data.materials.append(mat)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for obj in [cam, floor] + lights:
        bpy.data.objects.remove(obj, do_unlink=True)
    print("DINO_REVIEW", path, flush=True)
