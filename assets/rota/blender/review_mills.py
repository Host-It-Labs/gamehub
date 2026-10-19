"""Honest structural review of the mill master, independent of runtime.
Blender -b assets/rota/build/mills-master.blend --python \
    assets/rota/blender/review_mills.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import building_kit as K
import works_kit as W

kit = W.kit
OUT = "docs/concepts/2026-10-17-rota-rework/previews"
roots = [bpy.data.objects[name] for name in
         ("mill_big", "mill_small", "mill_site", "chimney")]
for material in bpy.data.materials:
    if ":" in material.name and material.get("hex"):
        kit.tint(material.name.partition(":")[2], material["hex"])
K.preview_look()
W.stage()
for root in roots:
    root.location = (0, 0, 0)

for root in roots:
    for other in roots:
        for obj in kit.descendants(other):
            obj.hide_render = other is not root
    kit.refresh()
    lo, hi = W.bounds(root)
    centre = (lo + hi) / 2
    radius = max((hi - lo).length * 0.58, 0.22)
    for suffix, elevation, azimuth in (("rear", 35, 150),
                                       ("phone", 76, 0)):
        W.shot(os.path.join(OUT, root.name + "-" + suffix + ".png"),
               centre, radius, elevation, azimuth, size=600, samples=24)

# Neutral clay exposes roof/wall construction without hiding in brick pattern.
clay = bpy.data.materials.new("review-clay")
clay.diffuse_color = (0.52, 0.52, 0.52, 1)
clay.use_nodes = True
bsdf = clay.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.52, 0.52, 0.52, 1)
bsdf.inputs["Roughness"].default_value = 0.85
for root in roots[:2]:
    for other in roots:
        for obj in kit.descendants(other):
            obj.hide_render = other is not root
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        obj.data.materials.clear()
        obj.data.materials.append(clay)
        for polygon in obj.data.polygons:
            polygon.material_index = 0
    lo, hi = W.bounds(root)
    W.shot(os.path.join(OUT, root.name + "-clay.png"), (lo + hi) / 2,
           max((hi - lo).length * 0.58, 0.22), 24, 30, size=600, samples=24)
