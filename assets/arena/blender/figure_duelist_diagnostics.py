"""Samurai source-only surface/material inspection; no shared assets change."""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
sys.dont_write_bytecode=True
import kit
import figure_duelist as d
import figure_duelist_review as review

args=sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=str(Path(args[0]).resolve()))
root=bpy.data.objects["duelist"]
rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
report=[]
for obj in kit.descendants(root):
    if obj.type!="MESH":
        continue
    slots=[m.name if m else None for m in obj.data.materials]
    indices=np.empty(len(obj.data.polygons),dtype=np.int32)
    obj.data.polygons.foreach_get("material_index",indices)
    report.append({"name":obj.name,"slots":slots,"indices":{str(i):int(np.sum(indices==i)) for i in np.unique(indices)},
                   "invalidIndices":int(np.sum(indices>=len(slots))),"modifiers":[[m.name,m.type] for m in obj.modifiers]})
base=Path(args[1]).resolve()
base.parent.mkdir(parents=True,exist_ok=True)
Path(str(base)+"-materials.json").write_text(json.dumps(report,indent=2)+"\n")
review.clay_materials(root)
review.pose(rig,d.POSES["jodan"])
for label,names in (("sode",["duelist.sleeveL-shell","duelist.sleeveR-shell"]),
                    ("robe",["duelist.continuous-underrobe"]),
                    ("torso",["duelist.torso-shell"]),
                    ("fore",["duelist.foreL-shell","duelist.foreR-shell"])):
    for obj in kit.descendants(root):
        if obj.type=="MESH":
            obj.hide_render=obj.name not in names
    review.render(root,str(base)+"-"+label+".png",10,-35,(900,900),(.10,.08,1.10),.57)
print("DUELIST_SURFACE_DIAGNOSTICS",str(base),flush=True)
