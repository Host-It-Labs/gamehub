"""Locate covered source vertices that emerge through the raised shirt."""
import json
import os
from pathlib import Path
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import figure_medic_sculpt as sculpt

BASE=HERE.parents[2]/"work/arena/2026-10-04-vgm/medic"
version=os.environ.get("MEDIC_DIAGNOSTIC_VERSION","v12")
bpy.ops.wm.open_mainfile(filepath=str(BASE/"master/medic-master-v9.blend"))
rig=bpy.data.objects["medic.skeleton"]
skin=bpy.data.objects["medic.skin"]
cloth=bpy.data.objects["medic.sewn-uniform"]
sculpt.repair_loaded_source_weights(bpy.data.objects["medic"])
cloth=bpy.data.objects["medic.sewn-uniform"]
for o in (skin,cloth):
    for mod in o.modifiers:
        if mod.type=="SUBSURF":
            mod.show_viewport=False

def pose(part,x=0,z=0):
    bone=rig.pose.bones["medic"+part]
    frame=bone.bone.matrix_local.to_quaternion()
    bone.rotation_mode="QUATERNION"
    bone.rotation_quaternion=frame.inverted()@(Quaternion((1,0,0),x)@Quaternion((0,1,0),-z))@frame

pose("armR",1.75,.14)
pose("foreR",-.9)
pose("handR",-.9,-.14)
pose("torso",.05)
pose("armL",.12,-.18)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
posed_cloth=cloth.evaluated_get(deps).to_mesh()
posed_cloth.calc_loop_triangles()
tree=BVHTree.FromPolygons([v.co[:] for v in posed_cloth.vertices],
                          [t.vertices[:] for t in posed_cloth.loop_triangles],all_triangles=True)
posed_skin=skin.evaluated_get(deps).to_mesh()
offenders=[]
for vertex in skin.data.vertices:
    p=vertex.co
    q=posed_skin.vertices[vertex.index].co
    screen=world_to_camera_view(bpy.context.scene,bpy.context.scene.camera,q)
    if not (.20<screen.x<.46 and .00<screen.y<.24):
        continue
    near,normal,face,distance=tree.find_nearest(q)
    signed=(q-near).dot(normal)
    if signed>.001:
        offenders.append({"vertex":vertex.index,"rest":list(p),"posed":list(q),
                          "coveredShare":sculpt.covered_skin_share(p),"screen":list(screen),
                          "distance":distance,"signed":signed,"garment":list(near),
                          "weights":{skin.vertex_groups[g.group].name:g.weight for g in vertex.groups}})
offenders.sort(key=lambda row:row["signed"],reverse=True)
report={"skinMatrix":list(map(list,skin.matrix_world)),"clothMatrix":list(map(list,cloth.matrix_world)),
        "skinModifierOrder":[m.type for m in skin.modifiers],
        "clothModifierOrder":[m.type for m in cloth.modifiers],
        "offenderCount":len(offenders),"largest":offenders[:32]}
(BASE/f"review/medic-{version}-fit-diagnostic.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
# Isolate the two sources without changing their materials or camera.
scene=bpy.context.scene
scene.render.filepath=str(BASE/f"review/medic-{version}-raised-fit.png")
bpy.ops.render.render(write_still=True)
skin.hide_render=True
scene.render.filepath=str(BASE/f"review/medic-{version}-raised-cloth-only.png")
bpy.ops.render.render(write_still=True)
skin.hide_render=False
cloth.hide_render=True
scene.render.filepath=str(BASE/f"review/medic-{version}-raised-skin-only.png")
bpy.ops.render.render(write_still=True)
