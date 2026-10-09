"""Compare a fresh canonical append to the exact reviewed neutral geometry.

Blender -b --factory-startup -t 2 --python assets/arena/blender/figure_sumo_verify_cache.py
  -- work/arena/2026-10-04-rebuild/sumo/master/sumo-runtime-v9.blend
     work/arena/2026-10-04-rebuild/sumo/master/runtime-cache-verification.json
"""
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_sumo_runtime as runtime


def array_hash(collection, prop, width, dtype=np.float32):
    values = np.empty(len(collection) * width, dtype=dtype)
    collection.foreach_get(prop, values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def snapshot(root):
    objects, meshes, bones = {}, {}, {}
    for obj in kit.descendants(root):
        objects[obj.name] = {"type": obj.type, "parent": obj.parent.name if obj.parent else None,
                             "parentType": obj.parent_type, "parentBone": obj.parent_bone,
                             "basis": [list(row) for row in obj.matrix_basis],
                             "world": [list(row) for row in obj.matrix_world],
                             "parentInverse": [list(row) for row in obj.matrix_parent_inverse]}
        if obj.type == "ARMATURE":
            for bone in obj.data.bones:
                pose = obj.pose.bones[bone.name]
                bones[bone.name] = {"parent": bone.parent.name if bone.parent else None,
                                    "rest": [list(row) for row in bone.matrix_local],
                                    "head": list(bone.head_local), "tail": list(bone.tail_local),
                                    "pose": [list(row) for row in pose.matrix_basis]}
        if obj.type != "MESH":
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        weights = [[(obj.vertex_groups[g.group].name, g.weight) for g in v.groups]
                   for v in mesh.vertices]
        attrs = {a.name: array_hash(a.data, "vector", 3)
                 for a in mesh.attributes if a.name in ("SumoPigmentCache", "SumoSourceNormals")}
        meshes[obj.name] = {"positions": array_hash(mesh.vertices, "co", 3),
                           "loops": array_hash(mesh.loops, "vertex_index", 1, np.int32),
                           "indices": array_hash(mesh.loop_triangles, "vertices", 3, np.int32),
                           "customNormals": array_hash(mesh.corner_normals, "vector", 3),
                           "weights": hashlib.sha256(json.dumps(weights).encode()).hexdigest(),
                           "attributes": attrs, "materials": [m.name for m in mesh.materials],
                           "triangles": len(mesh.loop_triangles), "vertices": len(mesh.vertices),
                           "modifiers": [(m.type, m.object.name if m.type == "ARMATURE" else None)
                                         for m in obj.modifiers]}
    return {"objects": objects, "meshes": meshes, "bones": bones,
            "authorScale": root["authorScale"]}


argv = sys.argv[sys.argv.index("--") + 1:]
candidate = Path(argv[0]).resolve()
out = Path(argv[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(candidate))
expected = snapshot(bpy.data.objects["sumo"])
bpy.ops.wm.read_factory_settings(use_empty=True)
root = runtime.load_reviewed_copy()
actual = snapshot(root)
assert actual == expected, "Canonical append must retain exact reviewed native data before ordinary AO"
white_layers = []
for obj in kit.descendants(root):
    if obj.type != "MESH":
        continue
    assert [c.name for c in obj.data.color_attributes] == ["AO"]
    ao = obj.data.color_attributes["AO"]
    values = np.empty(len(ao.data) * 4, dtype=np.float32)
    ao.data.foreach_get("color", values)
    assert np.all(values == 1), "Canonical source must not carry a previous AO bake"
    white_layers.append(obj.name)
report = {"reviewedCandidate": str(candidate), "canonicalCopy": str(runtime.CANONICAL_CACHE),
          "canonicalSHA256": hashlib.sha256(runtime.CANONICAL_CACHE.read_bytes()).hexdigest(),
          "exactEqualityBeforeAO": True, "nativeFields": ["positions", "loops", "indices", "customNormals",
          "weights", "pigment", "materials", "modifiers", "boneRestFrames", "objectTransforms"],
          "meshes": len(actual["meshes"]), "bones": len(actual["bones"]),
          "triangles": sum(m["triangles"] for m in actual["meshes"].values()),
          "authorScale": actual["authorScale"], "neutralWhiteAO": white_layers,
          "nativeData": actual}
out.write_text(json.dumps(report, indent=2))
print("SUMO CANONICAL EQUALITY", json.dumps({k: v for k, v in report.items() if k != "nativeData"}), flush=True)
