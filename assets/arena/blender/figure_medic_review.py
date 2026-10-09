"""Honest editable Medic review, export and versioned source snapshots.

Blender -b --factory-startup -t 2 --python .../figure_medic_review.py
Environment: MEDIC_VERSION=v1; MEDIC_REVIEW_SAMPLES=24;
MEDIC_REVIEW_FOCUS=front,face,hand to limit cameras while repairing.
"""
import json
import math
import os
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Quaternion, Vector

SOURCE=Path(__file__).resolve().parent
PROJECT=SOURCE.parents[2]
sys.path.insert(0,str(SOURCE))
import kit
import figure_medic_sculpt as sculpt

VERSION=os.environ.get("MEDIC_VERSION","v1")
BASE=PROJECT/"work/arena/2026-10-04-vgm/medic"
OUT=BASE/"review"
MASTER=BASE/"master"
OUT.mkdir(parents=True,exist_ok=True)
MASTER.mkdir(parents=True,exist_ok=True)
SNAP=MASTER/f"{VERSION}-source"
SNAP.mkdir(parents=True,exist_ok=True)
for name in ("kit.py","figure_medic.py","figure_medic_forms.py","figure_medic_sculpt.py","figure_medic_kit.py","figure_medic_review.py"):
    shutil.copy2(SOURCE/name,SNAP/name)
scene=kit.reset(65)
# Clay review is lit by actual studio shadows. Add the final pigment/AO
# layer for material acceptance after the anatomy is established.
os.environ.setdefault("MEDIC_SKIP_AO","1")
load_master=os.environ.get("MEDIC_LOAD_MASTER")
if load_master:
    bpy.ops.wm.open_mainfile(filepath=load_master)
    scene=bpy.context.scene
    root=bpy.data.objects["medic"]
    keep=set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj,do_unlink=True)
    if os.environ.get("MEDIC_SKIP_AO")!="1":
        sculpt.finish_ao(root)
    if os.environ.get("MEDIC_REPAIR_COVERED_SKIN")=="1":
        sculpt.repair_loaded_source_weights(root)
else:
    root=sculpt.build_master()
rig=bpy.data.objects["medic.skeleton"]
skin=bpy.data.objects["medic.skin"]
scene.render.engine="CYCLES"
scene.cycles.samples=int(os.environ.get("MEDIC_REVIEW_SAMPLES","24"))
scene.cycles.use_denoising=True
kit.gpu()
if os.environ.get("MEDIC_REVIEW_ENGINE","EEVEE")=="EEVEE":
    engines=scene.render.bl_rna.properties["engine"].enum_items.keys()
    scene.render.engine=next(name for name in engines if "EEVEE" in name)
scene.render.resolution_x=scene.render.resolution_y=1024
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.view_settings.view_transform="AgX"
scene.view_settings.look="AgX - Medium High Contrast"
scene.world=bpy.data.worlds.new("Medic neutral studio")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs[0].default_value=(.12,.12,.12,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value=.30

clay=bpy.data.materials.new("Honest neutral clay")
clay.use_nodes=True
bsdf=clay.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value=(.29,.30,.31,1)
bsdf.inputs["Roughness"].default_value=.78
bsdf.inputs["Specular IOR Level"].default_value=.22
floor=bpy.data.materials.new("Matte neutral floor")
floor.use_nodes=True
floor.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(.11,.115,.12,1)
floor.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.95
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006))
plane=bpy.context.object
plane.name="Medic review floor"
plane.data.materials.append(floor)

def aim(obj,center):
    obj.rotation_euler=(Vector(center)-obj.location).to_track_quat("-Z","Y").to_euler()

def area(name,at,energy,size):
    data=bpy.data.lights.new(name,"AREA")
    data.energy,data.size,data.shape=energy,size,"DISK"
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=at
    aim(obj,(0,0,.8))
area("Raking key",(-2.4,2.6,3.8),110,1.6)
area("Frontal fill",(2.8,2.4,2.2),35,2.8)
area("Rear separation",(1,-2.6,3.3),75,2.2)
area("Top softbox",(-.4,-.4,5.1),35,2)

camera_data=bpy.data.cameras.new("Medic honest review camera")
camera=bpy.data.objects.new("Medic honest review camera",camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type="ORTHO"
camera_data.clip_start=.01
camera_data.clip_end=200

def clear():
    for b in rig.pose.bones:
        b.rotation_mode="QUATERNION"
        b.rotation_quaternion=Quaternion()
        b.location=(0,0,0)
        b.scale=(1,1,1)
    bpy.context.view_layer.update()

def pose(part,x=0,y=0,z=0):
    b=rig.pose.bones["medic"+part]
    frame=b.bone.matrix_local.to_quaternion()
    world=Quaternion((1,0,0),x)@Quaternion((0,0,1),y)@Quaternion((0,1,0),-z)
    b.rotation_mode="QUATERNION"
    b.rotation_quaternion=frame.inverted()@world@frame
    bpy.context.view_layer.update()

def render(name,at,target,scale,clay_override=True):
    camera.location=at
    aim(camera,target)
    camera_data.ortho_scale=scale
    scene.view_layers[0].material_override=clay if clay_override else None
    scene.render.filepath=str(OUT/f"medic-master-{VERSION}-{name}.png")
    bpy.ops.render.render(write_still=True)
    return scene.render.filepath

clear()
master_path=MASTER/f"medic-master-{VERSION}.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(master_path))
out_glb=PROJECT/"public/3d/arena/dev"/f"vgm-medic-source-{VERSION}.glb"
if os.environ.get("MEDIC_EXPORT", "1")=="1":
    kit.export([root],str(out_glb))
print("MEDIC EARLY SOURCE READY",str(master_path),str(out_glb),flush=True)
views=[
    ("clay-front",(0,4.8,.69),(0,0,.66),1.40),
    ("clay-face",(.55,4.2,1.23),(0,.014,1.156),.36),
    ("clay-right-hand",(2.8,4.2,1.25),tuple(sculpt.HAND[1]+Vector((0,0,.025))),.23),
    ("clay-left-hand",(-2.8,4.2,.69),tuple(sculpt.HAND[-1]),.23),
    ("clay-side",(4.8,0,.69),(0,0,.66),1.40),
    ("clay-rear",(0,-4.8,.69),(0,0,.66),1.40),
    ("clay-game",(-1.65,3.6,6.485),(0,0,.66),1.40),
    ("clay-portrait70",(0,4,11.65),(0,0,.66),1.35),
    ("clay-landscape50",(4,0,5.43),(0,0,.66),1.40),
    ("clay-equipment",(4.5,2.0,.85),(.19,.06,.68),.59),
    ("material-three-quarter",(2.8,4.5,2.1),(0,0,.65),1.40,False),
    ("material-face",(.55,4.2,1.23),(0,.014,1.156),.36,False),
]
focus=os.environ.get("MEDIC_REVIEW_FOCUS","")
if focus:
    words=focus.split(",")
    views=[v for v in views if any(w in v[0] for w in words)]
files=[render(*v) for v in views]
# Full upper-arm and elbow excursions, no flattering rigid rest pose.
if not focus or "heal" in focus:
    pose("armR",1.75,0,.14)
    pose("foreR",-.9)
    pose("handR",-.90,0,-.14)
    pose("weapon",0)
    pose("head",.16)
    pose("torso",.05)
    pose("armL",.12,0,-.18)
    files.append(render("clay-heal",(2.2,4.8,1.8),(0,.06,.76),1.60))
    files.append(render("clay-heal-elbow",(3.7,2.8,1.6),(.18,.16,1.10),.52))
    files.append(render("material-heal",(2.2,4.8,1.8),(0,.06,.76),1.60,False))
    files.append(render("material-heal-elbow",(3.7,2.8,1.6),(.18,.16,1.10),.52,False))
clear()
scene.view_layers[0].material_override=None
bpy.ops.wm.save_as_mainfile(filepath=str(master_path))
evidence={"master":str(master_path),"standalone":str(out_glb),"sourceSnapshot":str(SNAP),
          "skinCageVertices":len(skin.data.vertices),"skinCageFaces":len(skin.data.polygons),
          "renderedViews":files,"bones":{b.name:list(b.head_local) for b in rig.data.bones},
          "materials":sorted({m.name for o in kit.descendants(root) if o.type=="MESH" for m in o.data.materials}),
          "unoptimized":True,"identity":"adult South Asian female field medic; cream uniform; green emblems; low bun"}
(MASTER/f"medic-master-{VERSION}-evidence.json").write_text(json.dumps(evidence,indent=2))
print("MEDIC REVIEW COMPLETE",json.dumps(evidence))
