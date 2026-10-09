"""Isolated detailed Dino export for source motion review, never production.

Load the preserved source master, bake genuine AO, run the same finishing hook
as figures.py, and nest the provisional .48 scale inside ogre.visual(.78).
No modifiers are decimated and no shared model bundle or manifest is written.
"""

import hashlib
import json
import os
import struct
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_ogre
import figure_ogre_anatomy as anatomy
import figure_ogre_surface as surface

argv = sys.argv[sys.argv.index("--") + 1:]
master, out = (Path(value).resolve() for value in argv[:2])
bpy.ops.wm.open_mainfile(filepath=str(master))
root = bpy.data.objects["ogre"]
visual = bpy.data.objects["ogre.visual"]
assert tuple(round(v, 5) for v in visual.scale) == (.78, .78, .78)
source_lo, source_hi = anatomy.bounds(root)
meshes = [obj for obj in kit.descendants(root)
          if obj.type == "MESH" and len(obj.data.polygons)]
surface.prepare_ao(root)


def pigment_stats():
    report = {}
    for obj in meshes:
        paint = obj.data.attributes.get("DinoPigment")
        if not paint:
            continue
        values = np.empty(len(obj.data.loops) * 3, dtype=np.float32)
        paint.data.foreach_get("vector", values)
        report[obj.name] = {
            "sha256": hashlib.sha256(values.tobytes()).hexdigest(),
            "meanRGB": np.mean(values.reshape(-1, 3), axis=0).tolist(),
        }
    return report


before_bake = pigment_stats()
kit.bake_ao(meshes, samples=64, distance=.22)
after_bake = pigment_stats()
assert before_bake == after_bake, "AO bake changed retained authored pigment"
figure_ogre.finish_ao(root)
assert all([attr.name for attr in obj.data.color_attributes] == ["AO"]
           for obj in meshes), "Only combined AO may export as COLOR_0"

children = list(visual.children)
art = kit.empty("ogre.art-scale")
# This new parent must initially inherit the wrapper, rather than preserving
# an identity world matrix and baking another .78 into every reparented child.
art.parent = visual
kit.refresh()
for child in children:
    kit.parent(child, art)
art.scale = (.48, .48, .48)
art["uniformGameplayScale"] = .48
root["temporaryDetailedMaster"] = True
root["reviewedSource"] = str(master)
root["sourceReviewOnly"] = "unoptimized source; final budget follows motion review"
kit.refresh()
lo, hi = anatomy.bounds(root)
assert max(abs((hi[i] - lo[i]) - (source_hi[i] - source_lo[i]) * .48)
           for i in range(3)) < 1e-5

# Blender's named driver contract and Three's sanitized Object3D names agree.
rig = bpy.data.objects["ogre.skeleton"]
rename = {bone.name: bone.name.replace("ogre.", "ogre", 1)
          for bone in rig.data.bones}
for bone in rig.data.bones:
    bone.name = rename[bone.name]
for obj in kit.descendants(root):
    if obj.parent_type == "BONE" and obj.parent_bone in rename:
        obj.parent_bone = rename[obj.parent_bone]
    if obj.type == "MESH":
        for group in obj.vertex_groups:
            if group.name in rename:
                group.name = rename[group.name]
kit.refresh()
kit.export([root], str(out))
blob = out.read_bytes()
length, kind = struct.unpack_from("<II", blob, 12)
assert kind == 0x4E4F534A
gltf = json.loads(blob[20:20 + length])
counts = []
for mesh in gltf.get("meshes", []):
    tris, vertices = 0, 0
    for primitive in mesh.get("primitives", []):
        index = primitive.get("indices")
        tris += gltf["accessors"][index]["count"] // 3 if index is not None else \
            gltf["accessors"][primitive["attributes"]["POSITION"]]["count"] // 3
        vertices += gltf["accessors"][primitive["attributes"]["POSITION"]]["count"]
    counts.append({"name": mesh.get("name"), "triangles": tris, "vertices": vertices})
report = {
    "stage": "temporary unoptimized detailed source for moving renderer review",
    "sourceMaster": str(master), "temporaryGLB": str(out),
    "bytes": len(blob), "sha256": hashlib.sha256(blob).hexdigest(),
    "skins": len(gltf.get("skins", [])),
    "triangles": sum(c["triangles"] for c in counts), "meshCounts": counts,
    "jointNames": [[gltf["nodes"][j].get("name") for j in skin["joints"]]
                   for skin in gltf.get("skins", [])],
    "innerScales": {"ogre.visual": .78, "ogre.art-scale": .48},
    "blenderBounds": {"min": list(lo), "max": list(hi)},
    "sourceBoundsBeforeGameplayScale": {"min": list(source_lo), "max": list(source_hi)},
    "ao": {"samples": 64, "distance": .22,
           "finishingHook": "figure_ogre.finish_ao"},
    "retainedPigmentAcrossBake": {"before": before_bake, "after": after_bake},
    "optimized": False,
}
Path(str(master).replace("-master.blend", "-isolated-export.json")).write_text(
    json.dumps(report, indent=2))
print("DINO_ISOLATED_EXPORT", json.dumps(report), flush=True)
assert report["skins"] == 1
assert "ogretorso" in report["jointNames"][0]
assert any("JOINTS_0" in p["attributes"] and "WEIGHTS_0" in p["attributes"]
           for mesh in gltf["meshes"] for p in mesh["primitives"])
