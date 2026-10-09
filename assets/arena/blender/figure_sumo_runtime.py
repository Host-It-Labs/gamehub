"""Frozen runtime source and artist reduction helpers for the connected Sumo.

Normal builds append the reviewed neutral .blend through load_reviewed_copy;
they never repeat procedural reduction. The detailed sculpt remains editable
in figure_sumo_sculpt.build_master(). The optional artist workflow retains
hands, facial planes, planted toes and bending joints, with sampled master
normals preserving the authored smooth transitions.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_folk_kit as fk
from figure_sumo_sculpt import HAIR, K, build_master, head_point, table


# The former 12.5k total lost rounded finger and facial form even after
# local redistribution. The larger copy retains that reviewed anatomy and
# the source's combed hair relief; the detailed master stays intact.
BODY_TRIANGLES = 24000
BODY_BASE_TRIANGLES = 22000
MAX_TRIANGLES = 36000
CANONICAL_CACHE = Path(__file__).resolve().parent / "runtime" / "sumo-runtime-v1.blend"
FACE_CONTROLS = {"sumo" + p for p in (
    "eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")}


def load_reviewed_copy(root_name="sumo"):
    """Append the frozen neutral copy; normal builds never reduce the master."""
    if root_name != "sumo":
        raise ValueError("The authored Sumo has a named skeleton")
    if not CANONICAL_CACHE.is_file():
        raise RuntimeError("Missing reviewed Sumo runtime copy; see sumo-runtime-v1-provenance.json")
    with bpy.data.libraries.load(str(CANONICAL_CACHE), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj:
            bpy.context.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj.name == root_name)
    objects = kit.descendants(root)
    assert len(objects) == len(loaded.objects), "The canonical file contains only the Sumo hierarchy"
    assert all(obj.library is None for obj in objects)
    assert root["authorScale"] == K
    assert len([obj for obj in objects if obj.type == "ARMATURE"]) == 1
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    root["runtimeCopySource"] = "runtime/" + CANONICAL_CACHE.name
    kit.refresh()
    return root


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def source_surface(mesh):
    mesh.calc_loop_triangles()
    points = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
    normals = np.empty_like(points)
    faces = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.vertices.foreach_get("co", points)
    mesh.vertices.foreach_get("normal", normals)
    mesh.loop_triangles.foreach_get("vertices", faces)
    points, normals, faces = points.reshape(-1, 3), normals.reshape(-1, 3), faces.reshape(-1, 3)
    tree = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    return tree, points, normals, faces


def sample_source_normals(mesh, surface):
    tree, points, normals, faces = surface
    baked = np.empty((len(mesh.vertices), 3), dtype=np.float32)
    for vertex in mesh.vertices:
        point, face_normal, face_index, _ = tree.find_nearest(vertex.co)
        a, b, c = faces[face_index]
        normal = barycentric_transform(point, Vector(points[a]), Vector(points[b]), Vector(points[c]),
                                       Vector(normals[a]), Vector(normals[b]), Vector(normals[c]))
        baked[vertex.index] = normal.normalized() if normal.length > .00001 else face_normal
    cache = mesh.attributes.get("SumoSourceNormals") or mesh.attributes.new(
        name="SumoSourceNormals", type="FLOAT_VECTOR", domain="POINT")
    cache.data.foreach_set("vector", baked.reshape(-1))


def apply_source_normals(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        cache = obj.data.attributes.get("SumoSourceNormals")
        if not cache:
            continue
        normals = np.empty(len(cache.data) * 3, dtype=np.float32)
        cache.data.foreach_get("vector", normals)
        for face in obj.data.polygons:
            face.use_smooth = True
        obj.data.normals_split_custom_set_from_vertices(normals.reshape(-1, 3).tolist())


def facial_region(point):
    x, y, z = point / K
    return 1.065 < z < 1.315 and y > .045


def hand_region(point):
    x, y, z = point / K
    return abs(x) > .40 and z < .62


def refine_readable_anatomy(obj, surface):
    """Reallocate vertices to projected facial planes and rounded digits."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    base_vertices = len(bm.verts)
    edge_budget = (BODY_TRIANGLES - triangles(obj)) // 2
    face_edges, hand_edges = [], []
    for edge in bm.edges:
        midpoint = (edge.verts[0].co + edge.verts[1].co) * .5
        z = midpoint.z / K
        length = edge.calc_length()
        if facial_region(midpoint):
            # Nose/alar, lip and chin planes receive finer surface samples.
            score = length * (1 + 4 * np.exp(-((z - 1.205) / .048) ** 2))
            face_edges.append((score, edge))
        elif hand_region(midpoint):
            score = length * (1.5 if z < .52 else 1)
            hand_edges.append((score, edge))
    face_edges.sort(key=lambda item: item[0], reverse=True)
    hand_edges.sort(key=lambda item: item[0], reverse=True)
    face_count = min(len(face_edges), round(edge_budget * .48))
    chosen = [edge for _, edge in face_edges[:face_count]]
    chosen += [edge for _, edge in hand_edges[:edge_budget - len(chosen)]]
    if len(chosen) < edge_budget:
        chosen += [edge for _, edge in face_edges[face_count:face_count + edge_budget - len(chosen)]]
    bmesh.ops.subdivide_edges(bm, edges=chosen, cuts=1, use_grid_fill=True, smooth=0)
    tree = surface[0]
    projected = 0
    for vertex in bm.verts:
        if facial_region(vertex.co) or hand_region(vertex.co):
            point, _, _, distance = tree.find_nearest(vertex.co)
            if distance < .006 * K:
                vertex.co = point
                projected += 1
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    new_vertices = len(bm.verts) - base_vertices
    assert all(edge.is_manifold for edge in bm.edges), "Local refinement must preserve the connected skin"
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    assert triangles(obj) <= BODY_TRIANGLES
    print("SUMO LOCAL ANATOMY", json.dumps({"newVertices": new_vertices,
          "faceEdges": face_count, "projectedVertices": projected,
          "bodyTriangles": triangles(obj)}), flush=True)


def reduce_mesh(obj, target, surface=None, refine=False):
    before = triangles(obj)
    if before <= target:
        return {"name": obj.name, "source": before, "runtime": before}
    if surface is None:
        surface = source_surface(obj.data)
    select(obj)
    mod = obj.modifiers.new("Reviewed source runtime topology", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / before
    mod.use_collapse_triangulate = True
    # Collapse the neutral source before its armature deformation. The
    # modifier propagates the original fine bone weights to new vertices.
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if refine:
        refine_readable_anatomy(obj, surface)
    sample_source_normals(obj.data, surface)
    return {"name": obj.name, "source": before, "runtime": triangles(obj)}


def resample_combed_hair(obj):
    """Keep structured samples of the 44 authored combed grooves.

    Unconstrained collapse removes this shallow relief before preserving
    its silhouette. Sample the same source profile and project every point
    back onto the reviewed subdivided surface instead of inventing ridges.
    """
    before = triangles(obj)
    surface = source_surface(obj.data)
    hairline = [(0, 1.271), (30, 1.270), (55, 1.249), (78, 1.202),
                (100, 1.205), (135, 1.163), (180, 1.146)]
    rows = []
    for t in np.linspace(0, 1, 20):
        row = []
        for i in range(144):
            a = i / 144 * math.tau
            ad = abs((math.degrees(a) + 180) % 360 - 180)
            z = table(hairline, ad)[0] * (1 - t) + 1.326 * t
            ridge = (.005 + .0012 * math.cos(a * 44 + t * 9)) * math.sin(math.pi * t) ** .35
            point = head_point(a, z, ridge)
            point.z += .003 * t
            row.append(point * K)
        rows.append(row)
    replacement = fk.loft("sumo.runtime-combed-hair", rows, HAIR,
                          end="pole", levels=0, recalc=True)
    distances = []
    for vertex in replacement.data.vertices:
        point, _, _, distance = surface[0].find_nearest(vertex.co)
        vertex.co = point
        distances.append(distance)
    replacement.data.materials.clear()
    replacement.data.materials.append(obj.data.materials[0])
    old_mesh = obj.data
    obj.data = replacement.data
    bpy.data.objects.remove(replacement, do_unlink=True)
    if old_mesh.users == 0:
        bpy.data.meshes.remove(old_mesh)
    sample_source_normals(obj.data, surface)
    return {"name": obj.name, "source": before, "runtime": triangles(obj),
            "angularSamples": 144, "longitudinalSamples": 20, "authoredGrooves": 44,
            "projectedDistanceMax": max(distances)}


def attachment_budget(name):
    if ".combed-hair" in name:
        return 5616
    if ".folded-topknot" in name:
        return 700
    if ".topknot-ridge" in name:
        return 36
    if ".topknot-binding" in name:
        return 48
    if ".mawashi-wrap" in name:
        return 180
    if ".crotch-strip" in name:
        return 128
    if ".rear-knot-fold" in name:
        return 150
    if ".knot-binding" in name:
        return 48
    if ".selvedge" in name:
        return 72
    if ".sagari-" in name:
        return 20
    if ".nail-" in name:
        return 128
    if ".eyelid-" in name:
        return 40
    if ".nostril-" in name:
        return 24
    return {"sumoeyeL": 96, "sumoeyeR": 96,
            "sumopupilL": 48, "sumopupilR": 48,
            "sumobrowL": 48, "sumobrowR": 48,
            "sumomouth": 80}.get(name, 96)


def consolidate_attachments(root):
    buckets = {}
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.name in FACE_CONTROLS:
            continue
        if obj.parent_type != "BONE" or len(obj.data.materials) != 1:
            continue
        key = (obj.parent, obj.parent_bone, obj.data.materials[0])
        buckets.setdefault(key, []).append(obj)
    joined = []
    for (rig, bone, mat), pieces in buckets.items():
        if len(pieces) < 2:
            continue
        obj = kit.join(pieces, "sumo." + bone.removeprefix("sumo.") + "-" + mat.name.split(":")[0])
        world = obj.matrix_world.copy()
        obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", bone
        obj.matrix_world = world
        joined.append(obj.name)
    kit.refresh()
    return joined


def normalize_driver_names(root):
    rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
    rename = {b.name: b.name.replace("sumo.", "sumo", 1) for b in rig.data.bones}
    for bone in rig.data.bones:
        bone.name = rename[bone.name]
    for obj in kit.descendants(root):
        if obj.parent_type == "BONE" and obj.parent_bone in rename:
            obj.parent_bone = rename[obj.parent_bone]
        if obj.type == "MESH":
            for group in obj.vertex_groups:
                if group.name in rename:
                    group.name = rename[group.name]


def retain_one_export_color(root):
    """Keep editable pigment separately; glTF must expose only combined AO."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        colors = obj.data.color_attributes
        pigment = colors.get("SkinPigment")
        if pigment:
            rgba = np.empty(len(pigment.data) * 4, dtype=np.float32)
            pigment.data.foreach_get("color", rgba)
            cache = obj.data.attributes.get("SumoPigmentCache") or obj.data.attributes.new(
                name="SumoPigmentCache", type="FLOAT_VECTOR", domain="POINT")
            cache.data.foreach_set("vector", rgba.reshape(-1, 4)[:, :3].reshape(-1))
        for layer in list(colors):
            if layer.name != "AO":
                colors.remove(layer)
        ao = colors.get("AO")
        if ao:
            colors.active_color = ao
            colors.render_color_index = 0


def finish_ao(root):
    # The frozen copy carries the reviewed tissue pigment as generic
    # vectors. Combine it with the ordinary collector's fresh AO without
    # resampling paint, exporting a white channel or changing the source.
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        cache = obj.data.attributes.get("SumoPigmentCache")
        ao = obj.data.color_attributes.get("AO")
        if cache and ao:
            pigment = np.empty(len(cache.data) * 3, dtype=np.float32)
            cache.data.foreach_get("vector", pigment)
            loops = np.empty(len(obj.data.loops), dtype=np.int32)
            obj.data.loops.foreach_get("vertex_index", loops)
            values = np.empty(len(ao.data) * 4, dtype=np.float32)
            ao.data.foreach_get("color", values)
            values = values.reshape(-1, 4)
            values[:, :3] *= pigment.reshape(-1, 3)[loops]
            ao.data.foreach_set("color", values.reshape(-1))
    retain_one_export_color(root)


def reduce_runtime(root):
    """Reduce a newly built or independently loaded neutral master copy."""
    skin = next(o for o in kit.descendants(root) if o.get("continuousSkin"))
    # The reviewed skin includes a subdivision surface. Its cage has tiny
    # voxel-level normal changes that are absent from the rendered master;
    # transferring those changes to a coarse mesh creates sharp shading
    # seams. Sample the actual neutral evaluated surface before reducing.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = skin.evaluated_get(depsgraph)
    evaluated_mesh = evaluated.to_mesh()
    surface = source_surface(evaluated_mesh)
    evaluated.to_mesh_clear()
    for mod in list(skin.modifiers):
        if mod.type == "SUBSURF":
            skin.modifiers.remove(mod)
    reductions = [reduce_mesh(skin, BODY_BASE_TRIANGLES, surface, refine=True)]
    del surface
    for obj in list(kit.descendants(root)):
        if obj.type != "MESH" or obj == skin:
            continue
        reductions.append(resample_combed_hair(obj) if ".combed-hair" in obj.name else
                          reduce_mesh(obj, attachment_budget(obj.name)))
    joined = consolidate_attachments(root)
    apply_source_normals(root)
    normalize_driver_names(root)
    retain_one_export_color(root)
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    count = sum(triangles(o) for o in meshes)
    root["unoptimized"] = False
    root["runtimeSource"] = "reviewed Sumo V5 master; projected face/digits and structured combed hair"
    root["runtimeTriangles"] = count
    root["runtimeReduction"] = json.dumps({"perPart": reductions, "joined": joined})
    assert count < MAX_TRIANGLES, f"Sumo runtime {count} exceeds reviewed {MAX_TRIANGLES} budget"
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    print("SUMO RUNTIME", json.dumps({"triangles": count, "meshNodes": len(meshes),
                                      "skinVertices": len(skin.data.vertices),
                                      "reductions": reductions, "joined": joined}))
    kit.refresh()
    return root


def build_runtime():
    return reduce_runtime(build_master())
