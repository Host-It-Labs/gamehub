"""Export a preserved Viking master in isolation; optionally bake real AO.

No shared manifest/bundle is touched.  The source is never reduced by this
script.  Intended for independent live-renderer review while stills finish.
"""
import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_viking_kit as vk

args = sys.argv[sys.argv.index("--")+1:]
master, out = map(lambda v: Path(v).resolve(), args[:2])
bpy.ops.wm.open_mainfile(filepath=str(master))
root = bpy.data.objects["viking"]
meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
if "--ao" in args:
    kit.bake_ao(meshes, samples=48, distance=.17)
kit.export([root], str(out))
report = {"sourceMaster": str(master), "glb": str(out),
          "triangles": sum(vk.tris(o) for o in meshes),
          "bytes": out.stat().st_size, "reduced": False,
          "jointNames": [o.name for o in kit.descendants(root)],
          "ao": "baked 48 samples" if "--ao" in args else "white anatomy review"}
(master.parent/(out.stem+"-export.json")).write_text(json.dumps(report, indent=2))
print("VIKING_SOURCE_EXPORT", json.dumps(report), flush=True)
