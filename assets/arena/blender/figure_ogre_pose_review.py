"""Pose the preserved Dino source to expose rig seams before optimization."""

import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import kit
import figure_folk_kit as hk
import figure_ogre_anatomy as anatomy
import figure_ogre_skin as skinning

base = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
root = bpy.data.objects["ogre"]
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
    "turn": {"head": (-.045, -.28, .035), "jaw": (-.11, 0, 0),
             "torso": (0, .05, -.035), "tail": (.035, .22, 0),
             "tail2": (.045, .15, 0), "tail3": (.06, .09, 0)},
    "bite": {"head": (.20, 0, 0), "jaw": (-.55, 0, 0),
             "torso": (-.12, 0, 0), "armL": (.25, 0, 0),
             "armR": (.25, 0, 0), "foreL": (.30, 0, 0),
             "foreR": (.30, 0, 0), "tail": (-.03, .08, 0),
             "tail2": (-.025, .06, 0)},
}
evidence = {"stage": "static source joint-range inspection; not grounded runtime locomotion",
            "angles": "three.js Euler XYZ radians converted by figure_folk_kit.runtime_quat",
            "poses": {}}
for label, pose in poses.items():
    for obj in objects:
        obj.matrix_basis = rest[obj.name]
        if obj.type == "ARMATURE":
            for bone in obj.pose.bones:
                bone.matrix_basis = rest_bones[bone.name]
    skinning.apply_pose(root, pose)
    lo, hi = anatomy.bounds(root)
    evidence["poses"][label] = {"rotation": pose, "min": list(lo), "max": list(hi)}
    anatomy.review_render(root, base + "-" + label + "-three-quarter.png",
                          12, -35, (1100, 900), samples=32)
    if label in ("loaded-step", "roar"):
        anatomy.review_render(root, base + "-" + label + "-side.png",
                              5, 90, (1300, 800), samples=32)
with open(base + "-evidence.json", "w") as handle:
    json.dump(evidence, handle, indent=2)
print("DINO_SOURCE_POSES", json.dumps(evidence), flush=True)
