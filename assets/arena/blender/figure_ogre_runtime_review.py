"""Create and inspect an isolated runtime candidate from the preserved master."""

import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import articulation
import figure_ogre
import figure_ogre_anatomy as anatomy
import figure_ogre_surface as surface
import figure_ogre_runtime as runtime
import figure_ogre_skin as skinning

argv = sys.argv[sys.argv.index("--") + 1:]
master, base = (Path(value).resolve() for value in argv[:2])
from_build = "--from-build" in argv
if from_build:
    kit.reset(seed=33)
    root = figure_ogre.build()
    articulation.legs(root, "ogre")
    children = list(root.children)
    visual = kit.empty("ogre.visual")
    visual.parent = root
    kit.refresh()
    for child in children:
        kit.parent(child, visual)
    visual.scale = (.78,) * 3
    kit.refresh()
else:
    bpy.ops.wm.open_mainfile(filepath=str(master))
    root = bpy.data.objects["ogre"]
source_lo, source_hi = anatomy.bounds(root)
reused = "--reuse-runtime" in argv or from_build
if reused:
    report = json.loads(root["dinoRuntimeTopology"])
    if not from_build:
        runtime.rebuild_surface(root)
    source_lo /= runtime.ART_SCALE
    source_hi /= runtime.ART_SCALE
else:
    report = runtime.reduce(root)
lo, hi = anatomy.bounds(root)
assert max(abs(lo[i] - source_lo[i] * runtime.ART_SCALE) for i in range(3)) < 2e-6
assert max(abs(hi[i] - source_hi[i] * runtime.ART_SCALE) for i in range(3)) < 2e-6
report.update({"sourceMaster": str(master),
               "runtimeBlend": str(base) + ".blend",
               "normalBuildReproduced": from_build,
               "blenderBounds": {"min": list(lo), "max": list(hi)},
               "sourceBounds": {"min": list(source_lo), "max": list(source_hi)},
               "reviewStatus": "candidate; comparisons and moving renderer review pending"})
base.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(base) + ".blend")
for name in ("figure_ogre_runtime.py", "figure_ogre_runtime_review.py"):
    shutil.copyfile(HERE / name, str(base) + "-" + name + ".txt")
Path(str(base) + "-evidence.json").write_text(json.dumps(report, indent=2))
print("DINO_RUNTIME_CANDIDATE", json.dumps(report), flush=True)
if "--skip-renders" in argv:
    sys.exit(0)

surface.prepare_ao(root)
meshes = [o for o in kit.descendants(root) if o.type == "MESH" and o.data.polygons]
kit.bake_ao(meshes, samples=64, distance=.22)
figure_ogre.finish_ao(root)
runtime.smooth_export_corners(root)
assert all([attr.name for attr in obj.data.color_attributes] == ["AO"]
           for obj in meshes)
surface.honest_preview_materials(root)
bpy.ops.wm.save_as_mainfile(filepath=str(base) + "-finished.blend")

rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
rename = {bone.name: bone.name.replace("ogre.", "ogre", 1) for bone in rig.data.bones}
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
out = base.parent / (base.name + ".glb")
kit.export([root], str(out))
blob = out.read_bytes()
length, kind = struct.unpack_from("<II", blob, 12)
gltf = json.loads(blob[20:20 + length])
primitives = [p for m in gltf["meshes"] for p in m["primitives"]]
report.update({"glb": str(out), "bytes": len(blob),
               "sha256": hashlib.sha256(blob).hexdigest(),
               "exportTriangles": sum(gltf["accessors"][p["indices"]]["count"] // 3
                                      for p in primitives),
               "exportVertices": sum(gltf["accessors"][p["attributes"]["POSITION"]]["count"]
                                     for p in primitives),
               "materialDraws": len(primitives), "meshes": len(gltf["meshes"]),
               "materials": len(gltf["materials"]), "skins": len(gltf["skins"]),
               "colorChannels": sorted({key for p in primitives for key in p["attributes"]
                                        if key.startswith("COLOR")})})
assert report["exportTriangles"] == report["runtimeTriangles"]
assert report["colorChannels"] == ["COLOR_0"]
Path(str(base) + "-evidence.json").write_text(json.dumps(report, indent=2))
print("DINO_RUNTIME_EXPORT", json.dumps(report), flush=True)
