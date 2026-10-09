"""Jetpack-only measured reduction and frozen runtime loading.

The author records inspected source/runtime evidence before advancing these
stages. This is an artistic review gate, not a request for user permission.
Missing or stale evidence never silently rebuilds a blockout for production.
"""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
from figure_jetpack_sculpt import R, finish_ao

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
WORK = PROJECT / "work/arena/2026-10-08-roster/jetpack"
REVISION = "v3"
RUNTIME = HERE / f"runtime/jetpack-runtime-{REVISION}.blend"
RUNTIME_METRICS = WORK / f"runtime-metrics-{REVISION}.json"
SOURCE = WORK / "jetpack-master-v1.blend"
BASELINE = np.array([.5119243860244751, .6693907454609871, 1.3924950764721347])


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def source_fingerprint():
    paths = [HERE / "figure_jetpack_sculpt.py", WORK / "brief.md",
             HERE / "kit.py", HERE / "figure_folk_kit.py"]
    h = hashlib.sha256()
    for path in paths:
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()


def recipe_fingerprint():
    h = hashlib.sha256(source_fingerprint().encode())
    h.update(Path(__file__).name.encode())
    h.update(Path(__file__).read_bytes())
    return h.hexdigest()


def review_path(stage):
    # Keep the existing source-gate filename; runtime evidence is versioned
    # separately so a historical copy can never accept the new reduction.
    revision = "v1" if stage == "source" else REVISION
    return WORK / f"{stage}-review-gate-{revision}.json"


def require_review(stage, fingerprint=None):
    path = review_path(stage)
    if not path.exists():
        raise RuntimeError(f"Jetpack {stage} visual review is pending: inspect the JPGs, "
                           f"then record the findings in {path}. No automatic acceptance.")
    gate = json.loads(path.read_text())
    if gate.get("accepted") is not True or not gate.get("inspected") or not gate.get("observations"):
        raise RuntimeError(f"Jetpack {stage} gate requires inspected evidence and concrete findings")
    if fingerprint and gate.get("sourceFingerprint") != fingerprint:
        raise RuntimeError(f"Jetpack {stage} evidence is stale for the current private sculpt")
    for artifact in gate["inspected"]:
        if not (WORK / artifact).is_file():
            raise RuntimeError(f"Jetpack review artifact is missing: {artifact}")
    if stage == "source" and gate.get("sourceMasterSHA256") != file_hash(SOURCE):
        raise RuntimeError("Jetpack detailed master changed after its source acceptance")
    return gate


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def metrics(root):
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    p = np.array([v[:] for v in points])
    lo, hi = p.min(axis=0), p.max(axis=0)
    size = hi - lo
    return {"triangles": sum(triangles(o) for o in meshes), "meshes": len(meshes),
            "min": lo.tolist(), "max": hi.tolist(), "blenderSize": size.tolist(),
            "baselineSize": BASELINE.tolist(),
            "sizeDeltaFraction": (size / BASELINE - 1).tolist(),
            "perMesh": {o.name: {"triangles": triangles(o),
                                   "target": o.get("runtimeTriangles"),
                                   "region": o.get("sourceRegion")} for o in meshes}}


def validate_rig(root):
    rig = next((o for o in kit.descendants(root) if o.type == "ARMATURE"), None)
    if not rig:
        raise ValueError("Jetpack must retain its authored connected skin rig")
    required = ["torso", "chest", "neck", "head", "clavL", "clavR", "armL", "armR",
                "foreL", "foreR", "handL", "handR", "legL", "legR", "kneeL", "kneeR",
                "footL", "footR", "hair", "hat", "extra", "weapon", "cape", "cape2"]
    for part in required:
        if not rig.data.bones.get(R + "." + part):
            raise ValueError("Missing Jetpack bone " + part)
    parents = {"chest": "torso", "neck": "chest", "head": "neck",
               "clavL": "chest", "clavR": "chest", "armL": "clavL", "armR": "clavR",
               "foreL": "armL", "foreR": "armR", "handL": "foreL", "handR": "foreR",
               "kneeL": "legL", "kneeR": "legR", "footL": "kneeL", "footR": "kneeR",
               "weapon": "handR", "extra": "chest", "hair": "head",
               "hat": "head", "cape": "neck", "cape2": "cape"}
    for part, parent in parents.items():
        bone = rig.data.bones[R + "." + part]
        if not bone.parent or bone.parent.name != R + "." + parent:
            raise ValueError("Incorrect anatomical parent: " + part)
    reference = rig.data.bones[R + ".torso"].matrix_local.to_3x3()
    for bone in rig.data.bones:
        frame = bone.matrix_local.to_3x3()
        if max(abs(frame[i][j] - reference[i][j]) for i in range(3) for j in range(3)) > 1e-6:
            raise ValueError("Jetpack bone axes differ: " + bone.name)
    for obj in kit.descendants(root):
        if obj.type != "MESH" or not obj.get("continuousSkin"):
            continue
        for vertex in obj.data.vertices:
            if len([g for g in vertex.groups if g.weight > 1e-7]) > 4:
                raise ValueError(f"{obj.name} vertex {vertex.index}: exceeds four runtime influences")
            total = sum(g.weight for g in vertex.groups)
            if abs(total - 1) > .00015:
                raise ValueError(f"{obj.name} vertex {vertex.index}: weight sum {total}")
    return rig


def normalize_runtime_weights(obj):
    """Collapse can blend extra groups; freeze four normalized influences."""
    if not obj.get("continuousSkin"):
        return
    group_map = {group.index: group for group in obj.vertex_groups}
    updates = []
    for vertex in obj.data.vertices:
        influences = sorted([(g.group, g.weight) for g in vertex.groups if g.weight > 1e-7],
                            key=lambda item: item[1], reverse=True)[:4]
        if not influences:
            raise ValueError(f"{obj.name} vertex {vertex.index}: no retained skin weights")
        total = sum(weight for _, weight in influences)
        updates.append((vertex.index, [(index, weight / total) for index, weight in influences]))
    indices = list(range(len(obj.data.vertices)))
    for group in group_map.values():
        group.remove(indices)
    for vertex_index, influences in updates:
        for group_index, weight in influences:
            group_map[group_index].add([vertex_index], weight, "REPLACE")


def reduce_mesh(obj):
    target = int(obj.get("runtimeTriangles", 0))
    count = triangles(obj)
    if target <= 0:
        raise ValueError("No artist-defined runtime allocation for " + obj.name)
    if count <= target:
        normalize_runtime_weights(obj)
        return
    # Keep the source's surface normals. This transfers shading only, not
    # a visual pass; any lost face/finger form still needs a source repair.
    source = obj.data
    source.calc_loop_triangles()
    points = np.empty((len(source.vertices), 3), dtype=np.float64)
    smooth = np.empty_like(points)
    faces = np.empty((len(source.loop_triangles), 3), dtype=np.int32)
    source.vertices.foreach_get("co", points.ravel())
    source.vertices.foreach_get("normal", smooth.ravel())
    source.loop_triangles.foreach_get("vertices", faces.ravel())
    surface = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for attempt in range(3):
        count = triangles(obj)
        if count <= target:
            break
        modifier = obj.modifiers.new("Separate measured runtime copy", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = max(.0001, target * .975 / count)
        modifier.use_collapse_triangulate = True
        # Collapse bind-space topology before the live armature; do not bake
        # deformation into the copy or lose interpolated source weights.
        while obj.modifiers[0] != modifier:
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if triangles(obj) > target:
        raise ValueError(f"Jetpack reduction missed {obj.name}'s allocation: {triangles(obj)} > {target}")
    # Interpolate smooth master normals, rather than copying BVH face normals
    # (which would turn the accepted face and bob into faceted surfaces).
    normals = np.empty((len(obj.data.vertices), 3), dtype=np.float32)
    for vertex in obj.data.vertices:
        point, face_normal, face_index, _ = surface.find_nearest(vertex.co)
        if point is None:
            normals[vertex.index] = vertex.normal
            continue
        a, b, c = faces[face_index]
        normal = barycentric_transform(point, Vector(points[a]), Vector(points[b]), Vector(points[c]),
                                       Vector(smooth[a]), Vector(smooth[b]), Vector(smooth[c]))
        normals[vertex.index] = normal.normalized() if normal.length > 1e-6 else face_normal
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if len(normals):
        obj.data.normals_split_custom_set_from_vertices(normals.tolist())
    obj["runtimeReductionFrom"] = int(obj.get("sourceTriangles", count))
    obj["runtimeTarget"] = target
    normalize_runtime_weights(obj)


def reduce_runtime(root):
    require_review("source", source_fingerprint())
    validate_rig(root)
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        obj["sourceTriangles"] = triangles(obj)
        reduce_mesh(obj)
    kit.refresh()
    validate_rig(root)
    result = metrics(root)
    if not 20000 <= result["triangles"] <= 30500:
        raise ValueError(f"Jetpack runtime {result['triangles']} triangles outside 20–30.5k allocation")
    if max(abs(d) for d in result["sizeDeltaFraction"]) > .08001:
        raise ValueError("Jetpack native footprint exceeds the 8% brief: " + json.dumps(result["sizeDeltaFraction"]))
    return result


def bake_neutral_ao(root):
    """Private CPU AO recipe; no mutation of kit.gpu or shared materials."""
    meshes = [o for o in kit.descendants(root) if o.type == "MESH" and not o.get("clearHelmet")]
    glass = [o for o in kit.descendants(root) if o.type == "MESH" and o.get("clearHelmet")]
    for obj in glass:
        obj.hide_render = True
    scene = bpy.context.scene
    scene.render.threads_mode, scene.render.threads = "FIXED", 3
    scene.render.engine = "CYCLES"
    scene.cycles.device, scene.cycles.samples = "CPU", 48
    scene.render.bake.target = "VERTEX_COLORS"
    world = scene.world or bpy.data.worlds.new("Jetpack AO World")
    scene.world = world
    if hasattr(world, "light_settings"):
        world.light_settings.distance = .20
    for obj in meshes:
        layer = obj.data.color_attributes.get("AO")
        if layer is not None:
            obj.data.color_attributes.active_color = layer
            obj.data.color_attributes.render_color_index = list(obj.data.color_attributes).index(layer)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type="AO")
    for obj in meshes:
        kit.heal_ao(obj)
    for obj in glass:
        obj.hide_render = False
    finish_ao(root)
    root["arenaReviewedAO"] = True
    root["jetpackAORecipe"] = "48 samples CPU, glass excluded, combined pigment in single COLOR_0"


def freeze_candidate(root):
    result = metrics(root)
    root["jetpackSourceFingerprint"] = source_fingerprint()
    root["jetpackRuntimeTriangles"] = result["triangles"]
    root["jetpackRuntimeReviewPending"] = True
    root["runtimeCopyRequired"] = False
    root["runtimeVersion"] = REVISION
    root["runtimeRecipeFingerprint"] = recipe_fingerprint()
    RUNTIME.parent.mkdir(parents=True, exist_ok=True)
    # One detailed master and one runtime file; suppress .blend1 duplicates.
    bpy.context.preferences.filepaths.save_version = 0
    # Store only this neutral hierarchy and its dependencies, never the
    # review scene, other figures, cameras or lights. The master stays intact.
    bpy.data.libraries.write(str(RUNTIME), set(kit.descendants(root)),
                             fake_user=False, compress=True)
    result["runtimeSHA256"] = file_hash(RUNTIME)
    result["sourceFingerprint"] = source_fingerprint()
    result["runtimeRecipeFingerprint"] = recipe_fingerprint()
    result["runtimeRevision"] = REVISION
    result["sourceMasterSHA256"] = file_hash(SOURCE)
    result["sourceAccepted"] = True
    # The driver writes this record only after the matched JPG set completes.
    # An interrupted bake/render cannot pass as a completed runtime stage.
    return result


def load_runtime(root_name=R, reviewed=False):
    if root_name != R:
        raise ValueError("Jetpack's authored skeleton cannot be renamed")
    if not RUNTIME.exists():
        raise RuntimeError("Jetpack frozen runtime does not exist. Run the private source/review driver; "
                           "normal builds never reduce the source automatically.")
    if not RUNTIME_METRICS.is_file():
        raise RuntimeError("Jetpack runtime render/metrics stage has not completed")
    record = json.loads(RUNTIME_METRICS.read_text())
    runtime_hash = file_hash(RUNTIME)
    if record.get("runtimeStageComplete") is not True:
        raise RuntimeError("Jetpack frozen copy is missing its completed runtime stage")
    if record.get("sourceAccepted") is not True:
        raise RuntimeError("Jetpack frozen copy does not record an accepted source")
    if record.get("runtimeSHA256") != runtime_hash:
        raise RuntimeError("Jetpack runtime metrics do not match the frozen copy")
    if record.get("sourceFingerprint") != source_fingerprint():
        raise RuntimeError("Jetpack frozen copy is stale for the reviewed source")
    if record.get("runtimeRecipeFingerprint") != recipe_fingerprint():
        raise RuntimeError("Jetpack frozen copy predates the current reduction/AO recipe")
    if reviewed:
        gate = require_review("runtime", source_fingerprint())
        if gate.get("runtimeSHA256") != runtime_hash:
            raise RuntimeError("Jetpack runtime changed since the recorded moving/material review")
    with bpy.data.libraries.load(str(RUNTIME), link=False) as (source, target):
        target.objects = list(source.objects)
    for obj in target.objects:
        if obj is not None and not obj.users_collection:
            bpy.context.collection.objects.link(obj)
    root = next((o for o in target.objects if o and o.name == R), None)
    if not root:
        raise ValueError("Frozen Jetpack runtime has no canonical root")
    if set(kit.descendants(root)) != {obj for obj in target.objects if obj is not None}:
        raise ValueError("Jetpack frozen copy contains objects outside its hierarchy")
    if (root.get("jetpackSourceFingerprint") != record["sourceFingerprint"] or
            root.get("runtimeRecipeFingerprint") != record["runtimeRecipeFingerprint"]):
        raise RuntimeError("Jetpack frozen hierarchy does not match its recorded provenance")
    validate_rig(root)
    root["runtimeCopySource"] = "runtime/" + RUNTIME.name
    root["jetpackRuntimeReviewPending"] = not reviewed
    kit.refresh()
    return root
