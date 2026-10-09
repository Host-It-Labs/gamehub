"""Medic-only construction diagnostics; this never exports a runtime asset."""
from pathlib import Path
import sys
import bmesh
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import kit
import figure_medic_sculpt as s

BASE=HERE.parents[2]/"work/arena/2026-10-04-vgm/medic/review"
BASE.mkdir(parents=True,exist_ok=True)
scene=kit.reset(12)
s.f.BODY=s.TAILORED_BODY
scene.render.engine="CYCLES"
kit.gpu()
scene.render.engine=next(x for x in scene.render.bl_rna.properties["engine"].enum_items.keys() if "EEVEE" in x)
scene.render.resolution_x=scene.render.resolution_y=768
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new("Garment inspection background")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs[0].default_value=(.1,.1,.1,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value=.3
clay=bpy.data.materials.new("Construction clay")
clay.use_nodes=True
clay.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(.36,.37,.38,1)
scene.view_layers[0].material_override=clay

def aim(o,p):
    o.rotation_euler=(Vector(p)-o.location).to_track_quat("-Z","Y").to_euler()
for at,energy in (((-2,2,4),150),((2,2,3),55),((0,-3,4),100)):
    data=bpy.data.lights.new("Construction area","AREA")
    data.energy,data.size=energy,2
    light=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(light)
    light.location=at
    aim(light,(0,0,.8))
camera=bpy.data.objects.new("Construction camera",bpy.data.cameras.new("Construction camera"))
scene.collection.objects.link(camera)
scene.camera=camera
camera.data.type="ORTHO"
camera.data.ortho_scale=.62
camera.location=(.40,3,.93)
aim(camera,(0,0,.82))

def report(o,label):
    bm=bmesh.new()
    bm.from_mesh(o.data)
    print(label,len(bm.verts),len(bm.faces),"signed volume",bm.calc_volume(signed=True),
          "boundary",sum(e.is_boundary for e in bm.edges),flush=True)
    bm.free()

pieces=[s.shirt(),s.sleeve(-1)[0],s.sleeve(1)[0]]
for o in pieces:
    report(o,"RAW")
scene.render.filepath=str(BASE/"medic-construction-raw-shirt.png")
bpy.ops.render.render(write_still=True)
for o in pieces:
    bpy.data.objects.remove(o,do_unlink=True)
for o in list(bpy.data.objects):
    if o.type=="MESH":
        bpy.data.objects.remove(o,do_unlink=True)
pieces=s.sewn_uniform()
for o in pieces:
    report(o,"SEWN")
    for m in o.modifiers:
        m.show_viewport=True
scene.render.filepath=str(BASE/"medic-construction-sewn-shirt.png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/"medic-construction-shirt.blend"))
