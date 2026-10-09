"""Private, bounded modelling and skin helpers for the Robots rebuild.

All authored surfaces use +Y forward/Z up; bone frames all point +Z.
kit.smooth_path returns tuples: smooth_path() explicitly restores Vectors.
No Blender launch, runtime installation or shared-file mutation happens here.
"""
import gc
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_folk_kit as geo

R = "imps"
V = geo.V
TAU = math.tau


def ss(lo, hi, x):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def gauss(x, c, width):
    return math.exp(-((x - c) / width) ** 2)


def profile(rows, x):
    if x <= rows[0][0]:
        return rows[0][1:]
    for a, b in zip(rows, rows[1:]):
        if x <= b[0]:
            t = float(ss(a[0], b[0], x))
            return tuple(p + (q - p) * t for p, q in zip(a[1:], b[1:]))
    return rows[-1][1:]


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def allocated(obj, target, protected=False):
    obj["runtimeTriangles"] = int(target)
    obj["protectAnatomy"] = bool(protected)
    return obj


def mesh(name, points, faces, material, smooth=True):
    data = bpy.data.meshes.new(R + "." + name)
    data.from_pydata(points, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(kit.material(material))
    for p in data.polygons:
        p.use_smooth = smooth
    return obj


def loft(name, rings, material, target, protected=False, **options):
    return allocated(geo.loft(R + "." + name, rings, material, **options), target, protected)


def tube(name, points, radii, material, target=80, n=16, up=(0, 0, 1), caps=("dome", "dome")):
    return allocated(geo.tube(R + "." + name, points, radii, material, n=n, up=up, caps=caps), target)


def ball(name, point, scale, material, target=70, seg=24, rings=12):
    return allocated(geo.ball(R + "." + name, 1, point, material, scale=scale, seg=seg, rings=rings), target)


def smooth_path(points, samples=8):
    return [Vector(p) for p in kit.smooth_path(points, samples=samples)]


def bevel(obj, width=.002, segments=3):
    select(obj)
    mod = obj.modifiers.new("Authored edge radius", "BEVEL")
    mod.width, mod.segments, mod.limit_method = width, segments, "ANGLE"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    mod = obj.modifiers.new("Flat planes beside radiused edges", "WEIGHTED_NORMAL")
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def box(name, size, centre, material, target=80, radius=.002):
    obj = kit.box(R + "." + name, size, centre, mat=material, grid=False)
    return allocated(bevel(obj, radius), target)


def plate(name, outline, thick, material, frame, target=100, radius=.0015):
    obj = geo.slab(R + "." + name, outline, thick, material, matrix=frame)
    return allocated(bevel(obj, radius), target)


def ring(name, points, radius, material, target=120, up=(0, 0, 1), n=10):
    path = list(points)
    wrapped = [path[-1]] + path + [path[0], path[1]]
    rings = geo.rings_along(wrapped, [radius] * len(wrapped), n, up=up)[1:-2]
    rings.append(rings[0])
    obj = loft(name, rings, material, target)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def fuse(parts, name, material, voxel=.0035, target=1000):
    for obj in parts:
        kit.apply(obj)
        kit.apply_transform(obj)
    select(parts[0])
    for obj in parts:
        obj.select_set(True)
    bpy.ops.object.join()
    obj = parts[0]
    obj.name = R + "." + name
    # Voxel resolution is intentionally moderate: geometry grows with the
    # actual surface area, without a whole-scene SDF grid or level-3 subdiv.
    if not .0018 <= voxel <= .006:
        raise ValueError("Bounded source voxel is 0.0018..0.006")
    mod = obj.modifiers.new("Connected authored source", "REMESH")
    mod.mode, mod.voxel_size = "VOXEL", voxel
    mod.use_smooth_shade, mod.use_remove_disconnected = True, False
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("Blend anatomical transitions", "SMOOTH")
    mod.factor, mod.iterations = .28, 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.assign(obj, material)
    allocated(obj, target, True)
    obj["continuousSkin"] = True
    for p in obj.data.polygons:
        p.use_smooth = True
    gc.collect()
    return obj


def rig(root, positions, parents):
    data = bpy.data.armatures.new(R + " common-axis rig")
    obj = bpy.data.objects.new(R + ".skeleton", data)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    select(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, point in positions.items():
        bone = data.edit_bones.new(R + "." + name)
        bone.head, bone.tail = point, Vector(point) + V(0, 0, .06)
        bone.use_connect = False
    for name, parent in parents.items():
        data.edit_bones[R + "." + name].parent = data.edit_bones[R + "." + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.show_in_front = True
    data.display_type = "WIRE"
    obj["arenaCommonAxes"] = True
    return obj


def attach(obj, armature, part):
    kit.apply(obj)
    kit.apply_transform(obj)
    geo.uv_box(obj)
    world = obj.matrix_world.copy()
    obj.parent, obj.parent_type, obj.parent_bone = armature, "BONE", R + "." + part
    obj.matrix_world = world
    return obj


def weighted(obj, armature, weights):
    """Top-four normalized influences, batched rather than per-vertex API calls."""
    kit.apply_transform(obj)
    geo.uv_box(obj)
    names = list(weights)
    raw = np.maximum(0, np.array([np.broadcast_to(weights[n], (len(obj.data.vertices),)) for n in names]))
    indices = np.argsort(raw, axis=0)[-4:]
    keep = np.zeros_like(raw, dtype=bool)
    np.put_along_axis(keep, indices, True, axis=0)
    raw *= keep
    total = raw.sum(axis=0)
    if np.any(total < 1e-8):
        raise ValueError("Unweighted source vertex: " + obj.name)
    raw /= total
    quantized = np.rint(raw * 1000000).astype(np.int32)
    # Correct rounding on the largest weight, keeping each sum exactly one.
    correction = 1000000 - quantized.sum(axis=0)
    quantized[np.argmax(raw, axis=0), np.arange(len(total))] += correction
    for n, values in zip(names, quantized):
        group = obj.vertex_groups.new(name=R + "." + n)
        ids = np.flatnonzero(values > 0)
        ids = ids[np.argsort(values[ids])]
        for batch in np.split(ids, np.flatnonzero(np.diff(values[ids])) + 1):
            if len(batch):
                group.add(batch.tolist(), float(values[batch[0]]) / 1000000, "REPLACE")
    obj.parent = armature
    mod = obj.modifiers.new("Continuous anatomical skin", "ARMATURE")
    mod.object, mod.use_deform_preserve_volume = armature, False
    obj["continuousSkin"] = True
    return obj


def transfer(obj, armature, skin):
    """Sewn trim inherits the exact cloth weights under its surface."""
    kit.apply(obj)
    kit.apply_transform(obj)
    data = skin.data
    data.calc_loop_triangles()
    points = [v.co.copy() for v in data.vertices]
    faces = [tuple(t.vertices) for t in data.loop_triangles]
    tree = BVHTree.FromPolygons(points, faces, all_triangles=True)
    names = {g.index: g.name.removeprefix(R + ".") for g in skin.vertex_groups}
    source = [{names[g.group]: g.weight for g in v.groups} for v in data.vertices]
    weights = {n: np.zeros(len(obj.data.vertices)) for n in names.values()}
    for j, v in enumerate(obj.data.vertices):
        point, _, face, _ = tree.find_nearest(v.co)
        a, b, c = faces[face]
        bary = barycentric_transform(point, points[a], points[b], points[c], V(1, 0, 0), V(0, 1, 0), V(0, 0, 1))
        for corner, amount in zip((a, b, c), bary):
            for n, w in source[corner].items():
                weights[n][j] += max(0, amount) * w
    return weighted(obj, armature, weights)


def face(obj, name, armature, parent=None):
    kit.apply(obj)
    kit.apply_transform(obj)
    geo.uv_box(obj)
    obj.name = R + name
    pts = np.array([v.co[:] for v in obj.data.vertices])
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    centre = V((lo + hi) / 2)
    normal = V(centre.x * 2.2, 1, 0).normalized()
    axes = parent.matrix_world.to_3x3() if parent else Matrix((normal.cross(V(0, 0, 1)), normal, V(0, 0, 1))).transposed()
    frame = Matrix.Translation(centre) @ axes.to_4x4()
    obj.data.transform(frame.inverted())
    if parent:
        obj.parent = parent
    else:
        obj.parent, obj.parent_type, obj.parent_bone = armature, "BONE", R + ".head"
    obj.matrix_world = frame
    obj["faceWidth"], obj["faceHeight"] = max(.006, float(hi[0] - lo[0])), max(.003, float(hi[2] - lo[2]))
    obj["protectAnatomy"] = True
    return obj


def finish(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        geo.uv_box(obj)
        for old in list(obj.data.color_attributes):
            if old.name != "AO":
                obj.data.color_attributes.remove(old)
        attr = obj.data.color_attributes.get("AO") or obj.data.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="CORNER")
        attr.data.foreach_set("color", np.ones(len(attr.data) * 4, dtype=np.float32))
        obj.data.color_attributes.active_color = attr
        obj.data.color_attributes.render_color_index = 0
