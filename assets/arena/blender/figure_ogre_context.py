"""Dino-only clay context against the existing actual princess shell.

Open a saved Dino clay master, then run this script with a review prefix.
This is a review scene: no bundle, manifest or source asset is overwritten.
"""

import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import kit
import figure_ogre_anatomy as anatomy

REPO = os.path.abspath(os.path.join(HERE, "../../.."))
base = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
root = bpy.data.objects["ogre"]
children = list(root.children)
candidate = kit.empty("ogre.art-scale-candidate")
kit.parent(candidate, root)
for child in children:
    kit.parent(child, candidate)
candidate.scale = (.48, .48, .48)
# Current largest portrait figureDimensions: horizontal ×1.12, height unchanged.
root.scale = (3.495632, 3.495632, 3.1211)
kit.refresh()
lo, hi = anatomy.bounds(root)

manifest = json.load(open(os.path.join(REPO, "lib/games/arena/assets.json")))
tower_path = os.path.join(REPO, "public", manifest["models"]["cartoon_towers"]["path"].lstrip("/"))
existing = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=tower_path)
imported = set(bpy.data.objects) - existing
tower = next(obj for obj in imported if obj.name == "princess")
keep = set(kit.descendants(tower))
for obj in imported - keep:
    bpy.data.objects.remove(obj, do_unlink=True)
tower.scale = (.9, .9, .9)
tower.location = (3.25, 1.2, 0)
anatomy.clay_override(tower)
context = kit.empty("Dino-game-scale-context")
kit.parent(root, context)
kit.parent(tower, context)

grid_mat = bpy.data.materials.new("context-unit-grid")
grid_mat.use_nodes = True
bsdf = grid_mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (.115, .13, .14, 1)
bsdf.inputs["Roughness"].default_value = 1
verts, faces = [], []
for i in range(-6, 7):
    for axis in (0, 1):
        k = len(verts)
        if axis == 0:
            verts += [(i - .006, -6, .002), (i + .006, -6, .002),
                      (i + .006, 6, .002), (i - .006, 6, .002)]
        else:
            verts += [(-6, i - .006, .002), (6, i - .006, .002),
                      (6, i + .006, .002), (-6, i + .006, .002)]
        faces.append((k, k + 1, k + 2, k + 3))
mesh = bpy.data.meshes.new("one-tile-grid")
mesh.from_pydata(verts, [], faces)
grid = bpy.data.objects.new("one-tile-grid", mesh)
bpy.context.scene.collection.objects.link(grid)
mesh.materials.append(grid_mat)

evidence = {
    "candidateUniformArtScale": .48,
    "artScaleBelowRoot": True,
    "preservedInnerScale": .78,
    "figureDimensionsBlenderXYZ": list(root.scale),
    "worldTileBounds": {"min": list(lo), "max": list(hi)},
    "widthLengthHeightTiles": list(hi - lo),
    "referenceTower": tower_path,
    "referenceTowerScale": .9,
    "gridSpacingTiles": 1,
    "fieldWidthDepthTiles": [18, 32],
    "cameraSource": "lib/games/arena/layout.ts lensFor: tall70, across50, transition42",
    "cameras": {},
}
for label, el, az, size in (
        ("portrait70-front", 70, 0, (1000, 1100)),
        ("landscape50-across", 50, 90, (1350, 950)),
        ("transition42-front", 42, 0, (1350, 950))):
    evidence["cameras"][label] = {
        "degreesAboveHorizontal": el, "azimuthFromFront": az,
        "projection": "orthographic scale comparison, runtime lens is perspective",
    }
    anatomy.review_render(context, base + "-" + label + ".png", el, az,
                          size, samples=32)
with open(base + "-evidence.json", "w") as handle:
    json.dump(evidence, handle, indent=2)
bpy.data.objects.remove(grid, do_unlink=True)
print("DINO_CONTEXT", json.dumps(evidence), flush=True)
