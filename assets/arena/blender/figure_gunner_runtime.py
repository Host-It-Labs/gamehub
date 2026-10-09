"""Private Gunner runtime copy, gated by actual source/runtime evidence.

Builds/reductions/GLBs stay inside the owned work folder. A normal collector
load appends frozen geometry, preserving normals, weights and baked AO. This
module does not change figure_gunner.py or install anything under runtime/.
"""
import gc
import hashlib
import json
import re
from array import array
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_gunner_forms as f

R = "gunner"
HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
WORK = PROJECT / "work/arena/2026-10-08-roster/gunner"
MASTER = WORK / "gunner-master-v1.blend"
COPY = WORK / "gunner-runtime-v1.blend"
TARGET = 29000
MINIMUM, MAXIMUM = 20000, 30500
SOURCE_CEILING = 500000
SOURCE_FILES = ("figure_gunner_sculpt.py", "figure_gunner_forms.py", "figure_gunner_cannon.py")
FACE_NAMES = tuple(R + p for p in ("eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth"))


def file_hash(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def fingerprint():
    digest = hashlib.sha256()
    for path in [*(HERE / name for name in SOURCE_FILES), HERE / "kit.py", HERE / "figure_folk_kit.py",
                 WORK / "brief-v1.md", WORK / "baseline-v1.json"]:
        digest.update(path.name.encode()); digest.update(path.read_bytes())
    return digest.hexdigest()


def require_review(stage):
    path = WORK / (stage + "-review-gate-v1.json")
    if not path.is_file():
        raise RuntimeError("Root must inspect actual JPGs and sign " + str(path))
    gate = json.loads(path.read_text())
    if gate.get("accepted") is not True or gate.get("reviewer") != "root" or not gate.get("observations"):
        raise RuntimeError("Root visual review remains pending: " + str(path))
    if gate.get("sourceFingerprint") != fingerprint() or gate.get("masterSHA256") != file_hash(MASTER):
        raise RuntimeError("Source changed since its visual review")
    if stage == "runtime" and (gate.get("runtimeSHA256") != file_hash(COPY) or
                               gate.get("reducerSHA256") != file_hash(Path(__file__))):
        raise RuntimeError("Frozen runtime/reduction changed since visual review")
    index_path = WORK / (stage + "-v1-review-views.json")
    index = json.loads(index_path.read_text())
    if gate.get("motionSHA256") != file_hash(WORK / "moves-gunner-next.ts") or index.get("motionSHA256") != gate.get("motionSHA256"):
        raise RuntimeError("Motion changed since its posed visual review")
    required = set(index["required"])
    if not required or not required.issubset(set(gate.get("inspected", []))):
        raise RuntimeError("Root must inspect the complete required review set")
    indexed = {item["file"]: item for item in index["views"]}
    for name in gate["inspected"]:
        artifact = WORK / name
        if (not artifact.resolve().is_relative_to(WORK.resolve()) or not artifact.is_file() or
                artifact.suffix.lower() != ".jpg" or name not in indexed):
            raise RuntimeError("Evidence must be a real indexed JPG in this figure's folder: " + name)
        if gate.get("evidenceHashes", {}).get(name) != file_hash(artifact):
            raise RuntimeError("Review JPG changed or lacks a signed hash: " + name)
    return gate


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def metrics(root, baseline_override=None):
    kit.refresh(); deps = bpy.context.evaluated_depsgraph_get(); points = []; rows = []
    for obj in kit.descendants(root):
        if obj.type != "MESH": continue
        ev = obj.evaluated_get(deps); data = ev.data
        co = np.empty(len(data.vertices) * 3, dtype=np.float64)
        data.vertices.foreach_get("co", co); co = co.reshape((-1, 3))
        matrix = np.asarray(ev.matrix_world, dtype=np.float64)
        p = co @ matrix[:3, :3].T + matrix[:3, 3]
        points.extend((p.min(axis=0), p.max(axis=0)))
        rows.append({"name": obj.name, "triangles": sum(len(p.vertices) - 2 for p in data.polygons),
                     "target": obj.get("runtimeTriangles"), "connected": bool(obj.get("continuousSkin"))})
    lo, hi = np.min(points, axis=0), np.max(points, axis=0); size = hi - lo
    baseline = np.array(baseline_override if baseline_override is not None else
                        json.loads((WORK / "baseline-v1.json").read_text())["blenderSize"])
    return {"id": R, "triangles": sum(item["triangles"] for item in rows), "meshNodes": len(rows),
            "min": lo.tolist(), "max": hi.tolist(), "blenderSize": size.tolist(),
            "baselineSize": baseline.tolist(), "sizeDeltaFraction": (size / baseline - 1).tolist(),
            "sourceFingerprint": root.get("sourceFingerprint") or fingerprint(), "perMesh": rows, "visualAcceptance": False}


def validate(root, frozen=False):
    all_objects = set(kit.descendants(root)); rigs = [o for o in all_objects if o.type == "ARMATURE"]
    if len(rigs) != 1: raise ValueError("One complete authored rig required")
    rig = rigs[0]
    from figure_gunner_sculpt import positions
    positions0, parents = positions()
    for name in positions0:
        bone = rig.data.bones.get(R + "." + name)
        if not bone: raise ValueError("Missing authored bone " + name)
        expected = R + "." + parents[name] if name in parents else None
        if (bone.parent.name if bone.parent else None) != expected:
            raise ValueError("Incorrect bone parent: " + name)
        reference = rig.data.bones[R + ".torso"].matrix_local.to_3x3()
        if max(abs(bone.matrix_local[i][j] - reference[i][j]) for i in range(3) for j in range(3)) > 1e-6:
            raise ValueError("Bone frames must share root axes: " + name)
    for name in FACE_NAMES:
        obj = bpy.data.objects.get(name)
        if not obj or obj not in all_objects: raise ValueError("Missing face control " + name)
        if "pupil" in name and obj.parent.name != name.replace("pupil", "eye"):
            raise ValueError("Pupil must remain under its eye")
    for obj in all_objects:
        if obj.type != "MESH": continue
        if len(obj.data.color_attributes) != 1 or obj.data.color_attributes[0].name != "AO":
            raise ValueError("Exactly one export colour channel required: " + obj.name)
        if not obj.get("continuousSkin"): continue
        if not any(mod.type == "ARMATURE" for mod in obj.modifiers):
            raise ValueError("Connected skin lost its deformation modifier")
        for v in obj.data.vertices:
            weights = [g.weight for g in v.groups if g.weight > 1e-7]
            if len(weights) > 4 or abs(sum(weights) - 1) > .0001:
                raise ValueError(f"{obj.name}: invalid normalized skin at vertex {v.index}")
    if frozen:
        for owner in (root, *rig.pose.bones):
            matrix = owner.matrix_basis
            if max(abs(matrix[i][j] - (1 if i == j else 0)) for i in range(4) for j in range(4)) > 1e-6:
                raise ValueError("Frozen copy must contain neutral transforms")
    return rig


def normalize(obj):
    if not obj.get("continuousSkin"): return
    weights = {g.name.removeprefix(R + "."): np.zeros(len(obj.data.vertices)) for g in obj.vertex_groups}
    names = {g.index: g.name.removeprefix(R + ".") for g in obj.vertex_groups}
    for v in obj.data.vertices:
        for g in v.groups: weights[names[g.group]][v.index] = g.weight
    # Rebuild only the data, leaving the existing armature modifier intact.
    armature = next(mod.object for mod in obj.modifiers if mod.type == "ARMATURE")
    for mod in list(obj.modifiers):
        if mod.type == "ARMATURE": obj.modifiers.remove(mod)
    obj.vertex_groups.clear()
    # Transform is already in the rig's neutral world coordinates.
    obj.parent = None; obj.matrix_world = Matrix.Identity(4)
    f.weighted(obj, armature, weights)


def apply_topology(obj):
    f.select(obj)
    for mod in list(obj.modifiers):
        if mod.type == "ARMATURE": continue
        while obj.modifiers[0] != mod:
            bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)


def allocation(meshes):
    # 20-30.5k person budget includes the entire cannon. Protect faces,
    # connected hands and tailored silhouettes before tiny hardware.
    targets = {o: min(triangles(o), int(o.get("runtimeTriangles", 0))) for o in meshes}
    if any(v <= 0 for v in targets.values()): raise ValueError("Every surface needs an artist allocation")
    protected = {o for o in meshes if o.get("protectAnatomy") or o.name in FACE_NAMES}
    fixed = sum(targets[o] for o in protected)
    flexible = sum(targets[o] for o in meshes if o not in protected)
    if fixed >= TARGET: raise ValueError("Anatomy alone exceeds the runtime allocation")
    if fixed + flexible > TARGET:
        factor = (TARGET - fixed) / flexible
        for o in meshes:
            if o not in protected: targets[o] = max(8, int(targets[o] * factor))
    if sum(targets.values()) > TARGET: raise ValueError("Allocation cannot fit without erasing hardware")
    if sum(targets.values()) < MINIMUM: raise ValueError("Source allocations need more silhouette/detail before reduction")
    return targets


def reduce_surface(obj, target):
    before = triangles(obj)
    if before <= target:
        normalize(obj); return {"name": obj.name, "source": before, "runtime": before}
    data = obj.data; data.calc_loop_triangles()
    points = array("f", [0]) * (len(data.vertices) * 3)
    normals = array("f", [0]) * (len(data.loops) * 3)
    faces = array("i", [0]) * (len(data.loop_triangles) * 3)
    corners = array("i", [0]) * len(faces)
    data.vertices.foreach_get("co", points); data.corner_normals.foreach_get("vector", normals)
    data.loop_triangles.foreach_get("vertices", faces); data.loop_triangles.foreach_get("loops", corners)
    tree = BVHTree.FromPolygons([tuple(points[k:k + 3]) for k in range(0, len(points), 3)],
                                [tuple(faces[k:k + 3]) for k in range(0, len(faces), 3)], all_triangles=True)
    f.select(obj)
    for _ in range(3):
        count = triangles(obj)
        if count <= target: break
        mod = obj.modifiers.new("Separate reviewed-master reduction", "DECIMATE")
        mod.decimate_type, mod.ratio, mod.use_collapse_triangulate = "COLLAPSE", max(.0001, target * .990 / count), True
        while obj.modifiers[0] != mod: bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Source CORNER normals retain both soft anatomy and hard machined planes.
    sampled = []
    for loop in obj.data.loops:
        vertex = obj.data.vertices[loop.vertex_index]
        point, normal, index, _ = tree.find_nearest(vertex.co)
        if point is None: raise ValueError("Source normal projection failed")
        a, b, c = (Vector(points[k * 3:k * 3 + 3]) for k in faces[index * 3:index * 3 + 3])
        ns = [Vector(normals[k * 3:k * 3 + 3]) for k in corners[index * 3:index * 3 + 3]]
        n = barycentric_transform(point, a, b, c, *ns)
        sampled.append(tuple(n.normalized() if n.length > 1e-8 else normal))
    obj.data.normals_split_custom_set(sampled); normalize(obj)
    del tree, points, normals, faces, corners, sampled; gc.collect()
    return {"name": obj.name, "source": before, "allocation": target, "runtime": triangles(obj)}


def consolidate(root):
    """Native joining preserves skin; restore corner normals after joining."""
    groups = {}
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.name in FACE_NAMES or obj.parent and obj.parent.name in FACE_NAMES:
            continue
        key = (obj.parent, obj.parent_type, obj.parent_bone, bool(obj.get("continuousSkin")))
        groups.setdefault(key, []).append(obj)
    for (parent, kind, bone, skin), parts in groups.items():
        if len(parts) < 2: continue
        expected = sum(len(o.data.loops) for o in parts)
        # Carry each part's corner normals through the join as a corner
        # attribute: join does not keep the parts' order, and re-applying a
        # flat list scrambled about half the normals (9 October).
        for obj in parts:
            values = np.empty(len(obj.data.loops) * 3, dtype=np.float32)
            obj.data.corner_normals.foreach_get("vector", values)
            attr = obj.data.attributes.new("sourceCornerNormal", "FLOAT_VECTOR", "CORNER")
            attr.data.foreach_set("vector", values)
        f.select(parts[0])
        for obj in parts: obj.select_set(True)
        world = parts[0].matrix_world.copy()
        bpy.ops.object.join(); joined = parts[0]
        if len(joined.data.loops) != expected: raise ValueError("Join changed source corner order")
        attr = joined.data.attributes["sourceCornerNormal"]
        values = np.empty(len(joined.data.loops) * 3, dtype=np.float32)
        attr.data.foreach_get("vector", values); joined.data.attributes.remove(attr)
        joined.data.normals_split_custom_set(values.reshape(-1, 3).tolist())
        joined.name = R + "." + ("connected-surfaces" if skin else bone.removeprefix(R + ".") + "-surfaces")
        joined.parent, joined.parent_type, joined.parent_bone = parent, kind, bone
        joined.matrix_world = world; joined["continuousSkin"] = skin
    kit.refresh()


def clean_materials(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH": continue
        for slot in obj.material_slots:
            mat = slot.material
            if not mat: continue
            base = re.sub(r"(?:\.\d{3})+$", "", mat.name)
            if base != mat.name:
                shared = bpy.data.materials.get(base)
                if shared: slot.material = shared
                else: mat.name = base
        for attr in list(obj.data.color_attributes):
            if attr.name != "AO": obj.data.color_attributes.remove(attr)
        obj.data.color_attributes.active_color = obj.data.color_attributes["AO"]
        obj.data.color_attributes.render_color_index = 0


def bake(root):
    # Do not call kit.bake_ao(), which selects Metal. Root's serial build
    # uses CPU explicitly and the same bounded three threads as review.
    scene = bpy.context.scene; scene.render.engine = "CYCLES"
    scene.cycles.device, scene.cycles.samples = "CPU", 24
    scene.render.bake.target = "VERTEX_COLORS"
    world = scene.world or bpy.data.worlds.new(R + " AO world"); scene.world = world
    world.light_settings.distance = .15
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.data.color_attributes.active_color = obj.data.color_attributes["AO"]
        obj.data.color_attributes.render_color_index = 0; obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type="AO")
    for obj in meshes:
        kit.heal_ao(obj)
        attr = obj.data.color_attributes["AO"]
        # Gentle miniatures AO: buried cloth/metal must not smear black onto
        # the face. AO is the only exported pigment channel.
        values = np.empty(len(attr.data) * 4, dtype=np.float32)
        attr.data.foreach_get("color", values); values = values.reshape((-1, 4))
        values[:, :3] = .30 + .70 * np.clip(values[:, :3], 0, 1); values[:, 3] = 1
        attr.data.foreach_set("color", values.ravel())
    clean_materials(root); root["arenaReviewedAO"] = True


def reduce_master(memory):
    require_review("source"); bpy.ops.wm.open_mainfile(filepath=str(MASTER)); root = bpy.data.objects[R]
    if root.get("sourceFingerprint") != fingerprint(): raise RuntimeError("Master is stale")
    validate(root); memory("master-opened")
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    for obj in meshes: apply_topology(obj)
    targets = allocation(meshes); records = []
    for obj in meshes:
        memory("reduce-" + obj.name + "-before")
        records.append(reduce_surface(obj, targets[obj])); memory("reduce-surface-after")
    consolidate(root); bake(root); memory("baked-runtime"); validate(root, frozen=True)
    info = metrics(root)
    if not MINIMUM <= info["triangles"] <= MAXIMUM: raise ValueError("Frozen runtime outside triangle allocation")
    if max(abs(v) for v in info["sizeDeltaFraction"]) > .08001:
        raise ValueError("Frozen native dimensions differ by more than 8%: " + str(info["sizeDeltaFraction"]))
    root["unoptimized"] = False; root["runtimeReductionPendingVisualReview"] = True
    root["reducerSHA256"] = file_hash(Path(__file__)); root["runtimeCopySource"] = str(COPY.relative_to(PROJECT))
    root["runtimeSourceFileSHA256"] = json.dumps({name: file_hash(HERE / name) for name in (*SOURCE_FILES, "kit.py", "figure_folk_kit.py")})
    root["runtimeBaselineSize"] = info["baselineSize"]
    keep = set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep: bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(COPY), compress=True)
    info.update(runtimeSHA256=file_hash(COPY), masterSHA256=file_hash(MASTER), reducerSHA256=file_hash(Path(__file__)), components=records)
    (WORK / "runtime-metrics-v1.json").write_text(json.dumps(info, indent=2) + "\n")
    return root


def append_copy(path, root_name=R):
    if root_name != R: raise ValueError("Authored rig id is stable")
    if not Path(path).is_file(): raise RuntimeError("Frozen runtime missing; see root-next.md")
    with bpy.data.libraries.load(str(path), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    objects = [o for o in loaded.objects if o is not None]
    for obj in objects:
        if not obj.users_collection: bpy.context.collection.objects.link(obj)
    root = next((o for o in objects if o.name == R), None)
    if root is None or set(kit.descendants(root)) != set(objects):
        raise ValueError("Frozen file must contain exactly this figure hierarchy")
    clean_materials(root); validate(root, frozen=True)
    if not root.get("arenaReviewedAO"): raise ValueError("Frozen copy lacks baked AO")
    return root


def check_frozen_cost(root, baseline_override=None):
    info = metrics(root, baseline_override)
    if not MINIMUM <= info["triangles"] <= MAXIMUM: raise ValueError("Frozen triangle count is outside budget")
    if max(abs(v) for v in info["sizeDeltaFraction"]) > .08001: raise ValueError("Frozen footprint is outside 8%")
    kit.refresh()


def load_frozen(root_name=R, reviewed=True):
    """Private work copy: candidates bypass only the pending runtime gate."""
    if reviewed: require_review("runtime")
    root = append_copy(COPY, root_name)
    if root.get("sourceFingerprint") != fingerprint() or root.get("reducerSHA256") != file_hash(Path(__file__)):
        raise RuntimeError("Frozen source/reducer fingerprints are stale")
    check_frozen_cost(root)
    return root


def load_reviewed_copy(root_name=R):
    """Root installs identical accepted bytes here; clean builds need no work.

    This is deliberately separate from candidate loading. The root-only
    activation stage requires matching installed bytes and the runtime gate.
    Source/reducer hashes travel inside the blend; no sculpt or AO bake runs.
    """
    path = HERE / ("runtime/" + R + "-runtime-v1.blend")
    root = append_copy(path, root_name)
    hashes = json.loads(root.get("runtimeSourceFileSHA256", "{}"))
    for name in (*SOURCE_FILES, "kit.py", "figure_folk_kit.py"):
        if hashes.get(name) != file_hash(HERE / name): raise RuntimeError("Installed frozen source is stale: " + name)
    if root.get("reducerSHA256") != file_hash(Path(__file__)):
        raise RuntimeError("Installed frozen reducer is stale")
    baseline = root.get("runtimeBaselineSize")
    if baseline is None or len(baseline) != 3: raise RuntimeError("Frozen baseline dimensions are missing")
    check_frozen_cost(root, list(baseline))
    root["runtimeReductionPendingVisualReview"] = False
    root["runtimeCopySource"] = str(path.relative_to(PROJECT))
    return root
