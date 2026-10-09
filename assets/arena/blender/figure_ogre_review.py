"""Dino-only high-resolution source review; never writes a shared bundle.

Blender -b --factory-startup --python assets/arena/blender/figure_ogre_review.py
  -- work/arena/2026-10-04-rebuild/dino/v1
"""

import json
import os
import shutil
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import kit
import articulation
import figure_ogre
import figure_ogre_anatomy as anatomy
import figure_ogre_surface as surface

argv = sys.argv[sys.argv.index("--") + 1:]
base = os.path.abspath(argv[0])
os.makedirs(os.path.dirname(base), exist_ok=True)
kit.reset(seed=33)
root = figure_ogre.build_master()
articulation.legs(root, "ogre")
children = list(root.children)
visual = kit.empty("ogre.visual")
kit.parent(visual, root)
for child in children:
    kit.parent(child, visual)
visual.scale = (.78, .78, .78)
kit.refresh()

lo, hi = anatomy.bounds(root)
tris = sum(sum(len(p.vertices) - 2 for p in obj.data.polygons)
           for obj in kit.descendants(root) if obj.type == "MESH")
evidence = {
    "stage": "high-resolution primary and secondary anatomy clay review",
    "optimized": False,
    "innerScale": .78,
    "bounds": {"min": list(lo), "max": list(hi)},
    "triangles": tris,
    "joints": sorted(obj.name for obj in kit.descendants(root)),
    "bones": sorted(bone.name for obj in kit.descendants(root)
                    if obj.type == "ARMATURE" for bone in obj.data.bones),
    "master": base + "-master.blend",
    "source": os.path.join(HERE, "figure_ogre.py"),
    "helper": os.path.join(HERE, "figure_ogre_anatomy.py"),
}
with open(base + "-evidence.json", "w") as handle:
    json.dump(evidence, handle, indent=2)
for source in ("figure_ogre.py", "figure_ogre_anatomy.py", "figure_ogre_surface.py",
               "figure_ogre_skin.py", "figure_ogre_review.py"):
    shutil.copyfile(os.path.join(HERE, source), base + "-" + source + ".txt")
bpy.ops.wm.save_as_mainfile(filepath=base + "-master.blend")
print("DINO_MASTER", json.dumps(evidence), flush=True)

if "--materials" in argv:
    figure_ogre.finish_ao(root)
    surface.honest_preview_materials(root)
    bpy.ops.wm.save_as_mainfile(filepath=base + "-material-review.blend")
    if "--skip-renders" in argv:
        print("DINO_REVIEW_SOURCE_SAVED", base, flush=True)
        sys.exit(0)
    for label, el, az, size in (
            ("side", 5, 90, (1400, 850)),
            ("three-quarter", 12, -35, (1250, 1000)),
            ("face", 12, -48, (1100, 900))):
        extra = {"focus": (0, .96, 1.42), "extent": 1.3} if label == "face" else {}
        anatomy.review_render(root, base + "-material-" + label + ".png",
                              el, az, size, samples=48, **extra)

anatomy.clay_override(root)
bpy.ops.wm.save_as_mainfile(filepath=base + "-clay.blend")
views = (
    ("side", 0, 90, (1400, 850)),
    ("front", 0, 0, (1050, 1050)),
    ("rear", 0, 180, (1050, 1050)),
    ("three-quarter", 12, -35, (1250, 1000)),
    ("game-55-front", 55, 0, (900, 900)),
    ("game-55-side", 55, 65, (1050, 900)),
    ("portrait-70", 70, 180, (800, 900)),
    ("landscape-50", 50, 90, (1200, 800)),
)
requested = set(argv[1].split(",")) if len(argv) > 1 else None
for label, el, az, size in views:
    if requested and label not in requested:
        continue
    anatomy.review_render(root, base + "-clay-" + label + ".png",
                          el, az, size, samples=40)
    evidence.setdefault("cameras", {})[label] = {
        "degreesAboveHorizontal": el, "azimuthFromFront": az,
        "size": list(size), "projection": "orthographic source form review",
    }
with open(base + "-evidence.json", "w") as handle:
    json.dump(evidence, handle, indent=2)
print("DINO_REVIEW_DONE", base, flush=True)
