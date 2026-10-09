"""Freeze the reviewed neutral runtime copy as a versioned artist asset.

Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_ogre_cache.py
  -- work/arena/2026-10-04-rebuild/dino/runtime-r2.blend
     assets/arena/blender/runtime/dino-runtime-v1.blend

The full procedural build_master(), source snapshots and reducer are retained.
This cache fixes reviewed collapse topology rather than recomputing a subtly
different neutral surface on each future build. It contains no baked scene AO.
"""

import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_ogre_runtime as runtime

argv = sys.argv[sys.argv.index("--") + 1:]
candidate, out = (Path(value).resolve() for value in argv[:2])
bpy.ops.wm.open_mainfile(filepath=str(candidate))
root = bpy.data.objects["ogre"]
assert root.get("dinoRuntimeTopology")
visual = bpy.data.objects["ogre.visual"]
art = bpy.data.objects["ogre.art-scale"]
assert tuple(round(s, 5) for s in visual.scale) == (.78,) * 3
assert tuple(round(s, 5) for s in art.scale) == (.48,) * 3
# The ordinary collector owns the .78 wrapper. Preserve the .48 inner artist
# root and all mesh/bone rest transforms, without baking another scale into it.
visual.scale = (1, 1, 1)
kit.refresh()
kit.parent(art, root)
bpy.data.objects.remove(visual, do_unlink=True)
kit.refresh()
assert art.parent == root
assert tuple(round(s, 5) for s in art.scale) == (.48,) * 3
objects = kit.descendants(root)
for obj in list(bpy.data.objects):
    if obj not in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
for obj in objects:
    assert obj.library is None
    if obj.type != "MESH":
        continue
    assert obj.data.attributes.get("DinoPigment")
    assert [c.name for c in obj.data.color_attributes] == ["AO"]
    values = np.empty(len(obj.data.loops) * 4, dtype=np.float32)
    obj.data.color_attributes["AO"].data.foreach_get("color", values)
    assert np.all(values == 1), "Canonical geometry must retain neutral AO for ordinary rebaking"
assert not [m for m in bpy.data.materials if m.library]
assert not [node for m in bpy.data.materials if m.use_nodes
            for node in m.node_tree.nodes if node.type == "TEX_IMAGE"]
root["canonicalRuntimeCopy"] = out.stem + ": reviewed neutral geometry; ordinary AO/finish follows"
root["detailedSource"] = "figure_ogre.build_master; preserved v11 source and master"
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
report = {"runtimeCache": str(out), "reviewedNeutralCandidate": str(candidate),
          "bytes": out.stat().st_size, "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
          "objects": len(objects), "meshes": len([o for o in objects if o.type == "MESH"]),
          "innerArtScale": .48, "collectorWrapper": "not stored; figures.py adds .78 once",
          "externalLibraries": False, "imageTextures": False, "addons": False}
print("DINO_CANONICAL_CACHE", json.dumps(report), flush=True)
Path(str(out).replace(".blend", "-provenance.json")).write_text(json.dumps(report, indent=2))
