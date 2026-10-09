"""Identical source/runtime cameras, illumination, pigment and extreme poses.

The provisional runtime inner size is reset only for these source comparisons,
so reducing an asset cannot conceal lost anatomy by making it appear smaller.
Runtime exports and actual Arena retain the reviewed .48 inner art factor.
"""

import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_ogre
import figure_ogre_anatomy as anatomy
import figure_ogre_surface as surface
import figure_ogre_skin as skinning
import figure_ogre_runtime as runtime

argv = sys.argv[sys.argv.index("--") + 1:]
model, base = (Path(value).resolve() for value in argv[:2])
bpy.ops.wm.open_mainfile(filepath=str(model))
root = bpy.data.objects["ogre"]
art = bpy.data.objects.get("ogre.art-scale")
if art:
    art.scale = (1, 1, 1)
kit.refresh()
figure_ogre.finish_ao(root)
if root.get("dinoRuntimeTopology"):
    runtime.smooth_export_corners(root)
surface.honest_preview_materials(root)
scene = bpy.context.scene
scene.render.threads_mode = "FIXED"
scene.render.threads = 3
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 2
scene.cycles.transmission_bounces = 0
base.parent.mkdir(parents=True, exist_ok=True)
views = {
    "side": (5, 90, (1300, 850), {}),
    "three-quarter": (12, -35, (1100, 950), {}),
    "face": (12, -48, (1000, 850), {"focus": (0, .96, 1.42), "extent": 1.3}),
}
requested = set(argv[2].split(",")) if len(argv) > 2 else None
evidence = {"model": str(model), "displayArtScaleForEqualComparison": 1,
            "sourceAndRuntimeCamerasIdentical": True, "views": {},
            "colour": "authored pigment with neutral AO; same linear palette and lighting"}
for name, (el, az, size, extra) in views.items():
    if requested and name not in requested:
        continue
    anatomy.review_render(root, str(base) + "-" + name + ".png",
                          el, az, size, samples=20, device="GPU", **extra)
    evidence["views"][name] = {"elevation": el, "azimuth": az,
                               "size": list(size), **extra}
objects = kit.descendants(root)
rest = {obj.name: obj.matrix_basis.copy() for obj in objects}
rest_bones = {bone.name: bone.matrix_basis.copy() for obj in objects
              if obj.type == "ARMATURE" for bone in obj.pose.bones}
poses = {
    "loaded-step": {"legL": (.47, 0, 0), "kneeL": (-.68, 0, 0),
                    "footL": (.19, 0, 0), "legR": (-.16, 0, 0),
                    "kneeR": (-.16, 0, 0), "footR": (.08, 0, 0),
                    "torso": (-.035, 0, -.025), "head": (.035, .07, 0),
                    "tail": (.025, -.14, 0), "tail2": (.035, -.11, 0),
                    "tail3": (.045, -.08, 0)},
    "roar": {"head": (.32, .10, 0), "jaw": (-.65, 0, 0),
             "torso": (-.07, 0, 0), "armL": (.38, 0, 0),
             "armR": (.38, 0, 0), "foreL": (.62, 0, 0),
             "foreR": (.62, 0, 0), "tail": (-.045, .12, 0),
             "tail2": (-.04, .10, 0), "tail3": (-.035, .08, 0)},
}
for name, pose in poses.items():
    if requested and name not in requested:
        continue
    for obj in objects:
        obj.matrix_basis = rest[obj.name]
        if obj.type == "ARMATURE":
            for bone in obj.pose.bones:
                bone.matrix_basis = rest_bones[bone.name]
    skinning.apply_pose(root, pose)
    extra = {"focus": (0, .95, 1.57), "extent": 1.5} if name == "roar" else {}
    anatomy.review_render(root, str(base) + "-" + name + ".png",
                          7, 90, (1300, 850), samples=20, device="GPU", **extra)
    lo, hi = anatomy.bounds(root)
    evidence["views"][name] = {"pose": pose, "elevation": 7, "azimuth": 90,
                               "min": list(lo), "max": list(hi), **extra}
Path(str(base) + "-evidence.json").write_text(json.dumps(evidence, indent=2))
print("DINO_COMPARISONS", json.dumps(evidence), flush=True)
