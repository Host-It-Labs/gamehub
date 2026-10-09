"""Freeze an independently reviewed runtime copy with neutral AO.

Blender -b --factory-startup -t 2 --python assets/arena/blender/figure_sumo_cache.py
  -- work/arena/2026-10-04-rebuild/sumo/master/sumo-runtime-v9.blend
     assets/arena/blender/runtime/sumo-runtime-v1.blend

This preserves the exact reviewed topology, normals, paint and named rig.
The ordinary collector owns the fresh occlusion bake; the full V5 source
and procedural build_master() remain separately editable.
"""
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
from figure_sumo_runtime import FACE_CONTROLS, triangles

argv = sys.argv[sys.argv.index("--") + 1:]
candidate, out = (Path(value).resolve() for value in argv[:2])
bpy.ops.wm.open_mainfile(filepath=str(candidate))
root = bpy.data.objects["sumo"]
assert root.get("neutralSurfacePreservedFromV7")
assert root.get("shoulderOwnershipRepair")
assert root["authorScale"] == 1.22
objects = kit.descendants(root)
rig = next(o for o in objects if o.type == "ARMATURE")
for bone in rig.pose.bones:
    assert max(abs(v) for row in (bone.matrix_basis - Matrix.Identity(4)) for v in row) < 1e-6
assert len(rig.data.bones) == 16
assert all(name in bpy.data.objects for name in FACE_CONTROLS)
for obj in list(bpy.data.objects):
    if obj not in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
for obj in objects:
    assert obj.library is None
    if obj.type != "MESH":
        continue
    assert [c.name for c in obj.data.color_attributes] == ["AO"]
    ao = obj.data.color_attributes["AO"]
    ao.data.foreach_set("color", np.ones(len(ao.data) * 4, dtype=np.float32))
    obj.data.color_attributes.active_color = ao
    obj.data.color_attributes.render_color_index = 0
    if any(m.name.startswith("skin:") for m in obj.data.materials):
        assert obj.data.attributes.get("SumoPigmentCache")
assert not [o for o in objects if o.library]
materials = {m for o in objects if o.type == "MESH" for m in o.data.materials}
assert not [m for m in materials if m.library]
assert not [node for m in materials if m.use_nodes
            for node in m.node_tree.nodes if node.type == "TEX_IMAGE"]
count = sum(triangles(o) for o in objects if o.type == "MESH")
assert count == 34227
root["canonicalRuntimeCopy"] = out.stem + ": reviewed neutral geometry; ordinary AO/finish follows"
root["detailedSource"] = "figure_sumo.build_master; V5 neutral anatomy and V6 local shoulder ownership"
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
report = {"runtimeCache": str(out), "reviewedCandidate": str(candidate),
          "candidateSHA256": hashlib.sha256(candidate.read_bytes()).hexdigest(),
          "bytes": out.stat().st_size, "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
          "objects": len(objects), "meshes": len([o for o in objects if o.type == "MESH"]),
          "triangles": count, "authorScale": 1.22, "bones": len(rig.data.bones),
          "faceControls": len(FACE_CONTROLS), "neutralAO": True,
          "editablePigment": "SumoPigmentCache POINT FLOAT_VECTOR",
          "neutralSurfacePreservedFromV7": json.loads(root["neutralSurfacePreservedFromV7"]),
          "shoulderOwnershipRepair": json.loads(root["shoulderOwnershipRepair"]),
          "externalLibraries": False, "imageTextures": False, "addons": False,
          "master": "work/arena/2026-10-04-rebuild/sumo/master/sumo-master-v6.blend",
          "sourceReview": "V5 neutral anatomy; V8 finish; V6-source/V9-runtime localized guard repair"}
print("SUMO_CANONICAL_CACHE", json.dumps(report), flush=True)
Path(str(out).replace(".blend", "-provenance.json")).write_text(json.dumps(report, indent=2))
