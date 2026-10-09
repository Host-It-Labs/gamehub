"""Isolated Cowboy high-resolution review/export; no shared asset writes.

Blender -b -t 4 --python figure_ranger_review.py -- <version> [view,view]
RANGER_REVIEW_LOAD=<blend> reloads a saved source without rebuilding.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import sys

import bpy
from mathutils import Quaternion, Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import kit
import figure_ranger_kit as rk
import figure_ranger_sculpt as sculpt
import figure_ranger_tailoring as base

PROJECT=HERE.parents[2]
OUT=PROJECT/'work/arena/2026-10-04-three-characters/ranger'
args=sys.argv[sys.argv.index('--')+1:]
version=args[0]
views_filter=set(args[1].split(',')) if len(args)>1 else None
if os.environ.get('RANGER_REVIEW_LOAD'):
    bpy.ops.wm.open_mainfile(filepath=os.environ['RANGER_REVIEW_LOAD']);root=bpy.data.objects['ranger']
else:
    kit.reset(seed=33);root=sculpt.build_master()
stage='runtime' if not root.get('unoptimized',True) else 'master'
if os.environ.get('RANGER_RUNTIME_COPY')=='1':
    # Parent approved V3 source stills and complete actual Arena motion.
    import figure_ranger_runtime as runtime
    stage='runtime';runtime.reduce_copy(root)
    bpy.context.scene.render.engine='CYCLES'
    bpy.context.scene.cycles.device='CPU'
    bpy.context.scene.render.threads_mode='FIXED'
    bpy.context.scene.render.threads=4
    kit.gpu=lambda: None
    kit.bake_ao([o for o in kit.descendants(root) if o.type=='MESH'],samples=128,distance=.22)
    sculpt.finish_ao(root)
# The source reflects figures.py's current slight readable head tilt.
head=bpy.data.objects['ranger.head'];head.rotation_euler.x=math.radians(5)
kit.refresh()
objects=kit.descendants(root)
meshes=[o for o in objects if o.type=='MESH']
rig=next(o for o in objects if o.type=='ARMATURE' and 'sleeve' in o.name)
rest={o.name:o.matrix_basis.copy() for o in objects}
rigs=[o for o in objects if o.type=='ARMATURE']
rest_bones={b.name:b.matrix_basis.copy() for r in rigs for b in r.pose.bones}
all_bones={b.name:b for r in rigs for b in r.pose.bones}
(OUT/'master').mkdir(parents=True,exist_ok=True)
(OUT/'review'/version).mkdir(parents=True,exist_ok=True)
# Fresh source saves are independent and retain every earlier version.
file_version=version.removeprefix(stage+'-')
master=OUT/'master'/f'ranger-{stage}-{file_version}.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(master))
for source in ['figure_ranger.py','figure_ranger_sculpt.py','figure_ranger_tailoring.py','figure_ranger_review.py','figure_ranger_runtime.py']:
    shutil.copyfile(HERE/source,OUT/'master'/f'{version}-{source}.txt')
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
evidence={'stage':'unoptimized editable source review' if stage=='master' else 'independent measured runtime copy','triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'bounds':{'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]},'master':str(master),'bones':[b.name for o in objects if o.type=='ARMATURE' for b in o.data.bones]}
print('RANGER_MASTER',json.dumps(evidence),flush=True)
if os.environ.get('RANGER_SKIP_EXPORT')!='1':
    # One colour channel; pigment stays in generic non-exporting attrs.
    assert all([a.name for a in o.data.color_attributes]==['AO'] for o in meshes)
    out=PROJECT/'public/3d/arena/dev'/f'three-ranger-{stage}-{file_version}.glb'
    kit.export([root],str(out))
    blob=out.read_bytes();length,kind=struct.unpack_from('<II',blob,12);gltf=json.loads(blob[20:20+length])
    evidence['export']={'path':str(out),'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'triangles':sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']),'skins':len(gltf.get('skins',[])),'materialCount':len(gltf.get('materials',[]))}

scene=bpy.context.scene
scene.render.engine=os.environ.get('RANGER_REVIEW_ENGINE','CYCLES');scene.cycles.samples=int(os.environ.get('RANGER_REVIEW_SAMPLES','32'));scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
world=bpy.data.worlds.new('Ranger honest neutral studio');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.17,.18,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
clay=bpy.data.materials.new('Ranger neutral grey clay');clay.use_nodes=True
bs=clay.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.31,.32,.33,1);bs.inputs['Roughness'].default_value=.82;bs.inputs['Specular IOR Level'].default_value=.2
floor=bpy.data.materials.new('Ranger neutral floor');floor.use_nodes=True
floor.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.10,.11,.12,1)
bpy.ops.mesh.primitive_plane_add(size=40,location=(0,0,-.008));plane=bpy.context.object;plane.name='Ranger review ground';plane.data.materials.append(floor)
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,pos,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;aim(o,(0,0,.7))
light('Ranger studio key',(-2.3,2.8,3.9),180,1.7)
light('Ranger studio fill',(2.4,2.0,2.3),65,2.7)
light('Ranger studio rim',(1.0,-2.8,3.5),130,2.2)
camdata=bpy.data.cameras.new('Ranger source review camera');cam=bpy.data.objects.new('Ranger source review camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.clip_start=.001
views=[
('clay-front',(0,4,.70),(0,0,.70),1.58,True),
('clay-side',(4,0,.70),(0,0,.70),1.58,True),
('clay-rear',(0,-4,.70),(0,0,.70),1.58,True),
('clay-three-quarter',(2.5,4,1.85),(0,0,.70),1.64,True),
('clay-face',(.28,4,1.34),(0,.025,1.157),.34,True),
('clay-hands',(.7,4,1.10),(-.01,.21,.765),.42,True),
('material-three-quarter',(2.5,4,1.85),(0,0,.70),1.64,False),
('material-face',(.28,4,1.34),(0,.025,1.157),.34,False),
('material-hands',(.7,4,1.10),(-.01,.21,.765),.42,False),
('material-game',(2.5,4,6.6),(0,0,.70),1.60,False),
('material-rifle',(-2.8,4,1.24),(-.03,.22,.75),.66,False),
('clay-rifle-side',(4,.2,1.00),(.04,.13,.76),.82,True),
]
def render(label,at,target,scale,clay_on):
    cam.location=at;aim(cam,target);camdata.ortho_scale=scale;scene.view_layers[0].material_override=clay if clay_on else None
    scene.render.filepath=str(OUT/'review'/version/f'ranger-{version}-{label}.png')
    bpy.ops.render.render(write_still=True)
    print('RANGER_RENDER',scene.render.filepath,flush=True)
for view in views:
    if not views_filter or view[0] in views_filter:render(*view)
# An unmistakable elbow range proof at each arm; all geometry remains joined.
if not views_filter or 'clay-bent-elbow' in views_filter:
    b=rig.pose.bones['rangerforeL'];frame=b.bone.matrix_local.to_quaternion();turn=rk.runtime_quat(.9,0,0)
    b.rotation_mode='QUATERNION';b.rotation_quaternion=frame.inverted()@turn@frame
    kit.refresh();render('clay-bent-elbow',(2.5,4,1.85),(0,0,.76),1.60,True)
    b.matrix_basis=rest_bones[b.name]
if not views_filter or 'clay-bent-knee' in views_filter:
    b=all_bones['rangerkneeL'];frame=b.bone.matrix_local.to_quaternion();turn=rk.runtime_quat(-.95,0,0)
    b.rotation_mode='QUATERNION';b.rotation_quaternion=frame.inverted()@turn@frame
    kit.refresh();render('clay-bent-knee',(3,4,1.05),(0,0,.50),1.12,True)
    b.matrix_basis=rest_bones[b.name]
if not views_filter or 'material-blink' in views_filter:
    for side in ('L','R'):
        eye=bpy.data.objects['ranger.eye'+side];eye.scale.z*=.04
    kit.refresh();render('material-blink',(.28,4,1.34),(0,.025,1.157),.34,False)
    for side in ('L','R'):bpy.data.objects['ranger.eye'+side].matrix_basis=rest['ranger.eye'+side]
(OUT/'review'/version/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
print('RANGER_REVIEW_DONE',json.dumps(evidence),flush=True)
