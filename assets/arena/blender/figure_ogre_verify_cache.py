"""Byte-exact neutral source/cache anatomy audit, allowing only outer-parent change."""

import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_ogre

argv = sys.argv[sys.argv.index("--") + 1:]
candidate, out = (Path(value).resolve() for value in argv[:2])


def digest(values):
    return hashlib.sha256(np.asarray(values).tobytes()).hexdigest()


def fetch(data, key, n, dtype=np.float32):
    values = np.empty(n, dtype=dtype)
    data.foreach_get(key, values)
    return values


def snapshot(root):
    kit.refresh()
    result = {"meshes": {}, "bones": {}, "worldTransforms": {}}
    for obj in kit.descendants(root):
        result["worldTransforms"][obj.name] = np.asarray(obj.matrix_world).copy().tolist()
        if obj.type == "ARMATURE":
            for bone in obj.data.bones:
                result["bones"][bone.name] = {
                    "rest": np.asarray(bone.matrix_local).tolist(),
                    "parent": bone.parent.name if bone.parent else None,
                    "pose": np.asarray(obj.pose.bones[bone.name].matrix_basis).tolist(),
                }
        if obj.type != "MESH":
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        weights = [(v.index, obj.vertex_groups[g.group].name, float(g.weight))
                   for v in mesh.vertices for g in v.groups]
        polygon_sizes = [len(p.vertices) for p in mesh.polygons]
        record = {
            "positions": digest(fetch(mesh.vertices, "co", len(mesh.vertices) * 3)),
            "loopIndices": digest(fetch(mesh.loops, "vertex_index", len(mesh.loops), np.int32)),
            "triangleIndices": digest(fetch(mesh.loop_triangles, "vertices", len(mesh.loop_triangles) * 3, np.int32)),
            "customNormals": digest(fetch(mesh.corner_normals, "vector", len(mesh.loops) * 3)),
            "boneWeights": hashlib.sha256(json.dumps(weights).encode()).hexdigest(),
            "pigment": digest(fetch(mesh.attributes["DinoPigment"].data, "vector", len(mesh.loops) * 3)),
            "materialIndices": digest(fetch(mesh.polygons, "material_index", len(mesh.polygons), np.int32)),
            "materials": [m.name for m in mesh.materials],
            "vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles),
            "polygonSizes": digest(np.asarray(polygon_sizes, dtype=np.int32)),
        }
        result["meshes"][obj.name] = record
    return result


bpy.ops.wm.open_mainfile(filepath=str(candidate))
reviewed = snapshot(bpy.data.objects["ogre"])
kit.reset(seed=33)
root = figure_ogre.build()
children = list(root.children)
visual = kit.empty("ogre.visual")
visual.parent = root
kit.refresh()
for child in children:
    kit.parent(child, visual)
visual.scale = (.78,) * 3
loaded = snapshot(root)
assert reviewed["meshes"] == loaded["meshes"], "Reviewed mesh topology/weights/normals/pigment must be exact"
assert reviewed["bones"] == loaded["bones"], "Reviewed rest bones and neutral pose must be exact"
differences = {}
for name, expected in reviewed["worldTransforms"].items():
    error = float(np.max(np.abs(np.asarray(expected) - np.asarray(loaded["worldTransforms"][name]))))
    differences[name] = error
    assert error <= 1e-6, f"Duplicated scale or changed pivot: {name} {error}"
assert [o.name for o in kit.descendants(root)].count("ogre.visual") == 1
assert [o.name for o in kit.descendants(root)].count("ogre.art-scale") == 1
assert not [o for o in kit.descendants(root) if o.library]
report = {"reviewedNeutralSource": str(candidate),
          "canonicalCopy": "assets/arena/blender/runtime/dino-runtime-v1.blend",
          "meshPositionsIndicesWeightsNormalsPigmentMaterialsExact": True,
          "boneRestFramesAndNeutralPosesExact": True,
          "worldTransformMaximumError": max(differences.values()),
          "oneCollectorWrapper": .78, "oneInnerArtScale": .48,
          "externalLinkedObjects": False, "source": reviewed, "fromBuild": loaded,
          "aoLimit": "Neutral native data verified before the ordinary independent AO bake"}
out.write_text(json.dumps(report, indent=2))
print("DINO_CACHE_VERIFIED", json.dumps({k: v for k, v in report.items()
                                      if k not in ("source", "fromBuild")}), flush=True)
