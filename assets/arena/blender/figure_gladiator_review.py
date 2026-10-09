"""Honest studio review and standalone source export of the Gladiator.

Run with PYTHONDONTWRITEBYTECODE=1; GLADIATOR_REVIEW_VERSION selects an
immutable review generation. The master stays editable and unoptimized.
"""
import json
import math
import os
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Quaternion, Vector

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit
import figure_gladiator as model
from figure_gladiator_sculpt import export_review

VERSION = os.environ.get("GLADIATOR_REVIEW_VERSION", "before")
OUT = PROJECT / "work/arena/2026-10-04-vgm/gladiator" / VERSION
OUT.mkdir(parents=True, exist_ok=True)
MASTER_INPUT=os.environ.get("GLADIATOR_REVIEW_MASTER")
GLB_INPUT=os.environ.get("GLADIATOR_REVIEW_GLB")
sourcefiles=[]
sourcepath=Path(MASTER_INPUT).parent if MASTER_INPUT else Path(__file__).resolve().parent
for pattern in ("figure_gladiator.py", "figure_gladiator_kit.py", "figure_gladiator_*py",
                "figure_gladiator_*.json.zlib"):
    for path in sourcepath.glob(pattern):
        if path.name not in sourcefiles:
            shutil.copy2(path,OUT/path.name)
            sourcefiles.append(path.name)
shutil.copy2(Path(__file__).resolve(),OUT/"used-review.py")
shutil.copy2(PROJECT/"components/game/arena/moves/gladiator.ts",OUT/"gladiator.moves.ts")
if GLB_INPUT:
    scene=kit.reset(41)
    bpy.ops.import_scene.gltf(filepath=GLB_INPUT)
    root=bpy.data.objects["gladiator"]
    print("GLADIATOR exact exported source imported",GLB_INPUT,flush=True)
elif MASTER_INPUT:
    bpy.ops.wm.open_mainfile(filepath=MASTER_INPUT)
    root=bpy.data.objects["gladiator"]
    sourceobjects=set(kit.descendants(root))
    for o in list(bpy.data.objects):
        if o not in sourceobjects:bpy.data.objects.remove(o,do_unlink=True)
    scene=bpy.context.scene
else:
    scene = kit.reset(41)
    root = model.build_runtime() if os.environ.get("GLADIATOR_REVIEW_RUNTIME") else model.build()
kit.refresh()

scene.render.engine = "CYCLES"
scene.cycles.samples = int(os.environ.get("GLADIATOR_REVIEW_SAMPLES", "24"))
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 3
if os.environ.get("GLADIATOR_REVIEW_CPU"):
    scene.cycles.device="CPU"
else:
    kit.gpu()
scene.render.resolution_x = scene.render.resolution_y = int(os.environ.get("GLADIATOR_REVIEW_SIZE", "1000"))
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world = bpy.data.worlds.new("Gladiator neutral studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.12, .13, .14, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .32

def material(name, colour, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*colour, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = .22
    return m

clay = material("Gladiator neutral clay", (.31,.32,.33), .8)
floor = material("Gladiator neutral floor", (.10,.11,.12), .94)
bpy.ops.mesh.primitive_plane_add(size=100, location=(0,0,-.007))
plane = bpy.context.object
plane.name = "Gladiator review floor"
plane.data.materials.append(floor)

def aim(o, target):
    o.rotation_euler = (Vector(target)-o.location).to_track_quat("-Z", "Y").to_euler()

def light(name, at, power, size):
    d = bpy.data.lights.new(name, "AREA")
    d.energy, d.size, d.shape = power, size, "DISK"
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = at
    aim(o, (0,0,.75))
    return o

light("Gladiator neutral key", (-2.4,3.2,4.4), 180, 2.0)
light("Gladiator neutral fill", (3.1,2.7,2.3), 55, 2.6)
light("Gladiator rear softbox", (1.2,-3.1,3.2), 110, 2.2)
cd = bpy.data.cameras.new("Gladiator honest review camera")
camera = bpy.data.objects.new(cd.name,cd)
scene.collection.objects.link(camera)
scene.camera = camera
cd.type, cd.clip_start, cd.clip_end = "ORTHO", .01, 200

def render(name, at, target, scale, override=True):
    shield_grip=name in ("clay-shield-grip","clay-shield-palm")
    grip_fill=None
    if shield_grip:
        # Bring the shield away from the chest in its actual guard pose,
        # so the camera sees the fist and rear handle without hiding skin.
        pose(model.POSES["guard"])
        bone=rig.pose.bones.get("gladiator.shield") or rig.pose.bones.get("gladiatorshield")
        target=rig.matrix_world @ bone.head
        at=target+Vector((-.45,-.30,1.0) if name=="clay-shield-palm" else (-2.8,-1.0,.9))
        scale=.29 if name=="clay-shield-palm" else .43
        grip_fill=light("Gladiator honest grip fill",target+Vector((-.8,-.3,.7)),35,1.0)
        aim(grip_fill,target)
    camera.location = at
    aim(camera,target)
    cd.ortho_scale = scale
    scene.view_layers[0].material_override = clay if override else None
    scene.render.filepath = str(OUT / (name+".png"))
    bpy.ops.render.render(write_still=True)
    if shield_grip:
        bpy.data.objects.remove(grip_fill,do_unlink=True)
        clear_pose()
    return scene.render.filepath

rig = next((o for o in kit.descendants(root) if o.type=="ARMATURE"),None)
def clear_pose():
    if rig:
        for b in rig.pose.bones:
            b.rotation_mode="QUATERNION"
            b.rotation_quaternion=Quaternion()
            b.location=(0,0,0)
    else:
        for o in kit.descendants(root):
            if "." in o.name:
                o.rotation_euler=(0,0,0)
    kit.refresh()

def pose(values):
    clear_pose()
    if rig:
        import figure_gladiator_kit as gk
        for name, angles in values.items():
            bone = rig.pose.bones.get("gladiator."+name) or rig.pose.bones.get("gladiator"+name)
            if not bone:
                continue
            frame=bone.bone.matrix_local.to_quaternion()
            bone.rotation_quaternion=frame.inverted() @ gk.runtime_quat(*angles) @ frame
    else:
        import figure_gladiator_kit as gk
        gk.pose_root(root,"gladiator",values)
    kit.refresh()

master=str(OUT/("gladiator-export-review.blend" if GLB_INPUT else "gladiator-master.blend"))
bpy.ops.wm.save_as_mainfile(filepath=master)
if os.environ.get("GLADIATOR_SOURCE_EXPORT"):
    suffix="" if os.environ.get("GLADIATOR_REVIEW_RUNTIME") else "-source"
    path=PROJECT / f"public/3d/arena/dev/vgm-gladiator-{VERSION}{suffix}.glb"
    export_review(root,str(path))
if os.environ.get("GLADIATOR_REVIEW_BUILD_ONLY"):
    info={"master":master,"sources":sourcefiles,"views":[],
          "sourceMasterInput":MASTER_INPUT,"sourceGLBInput":GLB_INPUT,
          "sourceTriangles":sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in kit.descendants(root) if o.type=="MESH"),
          "materials":sorted({m.name for o in kit.descendants(root) if o.type=="MESH" for m in o.data.materials}),
          "bones":{b.name:{"pivot":list(b.head_local),"parent":b.parent.name if b.parent else None} for b in rig.data.bones} if rig else {}}
    (OUT/"evidence.json").write_text(json.dumps(info,indent=2))
    print("GLADIATOR SOURCE READY",json.dumps(info),flush=True)
    raise SystemExit(0)
# Rendering can build costly OpenSubdiv limit tables for every viewpoint.
# Cache its exact evaluated full-resolution surface once for presentation,
# retaining all vertex weights and the editable master data. No reduction.
cache=None
if os.environ.get("GLADIATOR_REVIEW_CACHE"):
    skin=bpy.data.objects["gladiator.skin"]
    subdivision=next(m for m in skin.modifiers if m.type=="SUBSURF")
    armature=next(m for m in skin.modifiers if m.type=="ARMATURE")
    original=skin.data
    armature.show_viewport=False
    kit.refresh()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    evaluated=skin.evaluated_get(depsgraph)
    baked=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
    skin.data=baked
    subdivision.show_viewport=subdivision.show_render=False
    armature.show_viewport=True
    cache=(skin,original,baked,subdivision)
    kit.refresh()
    print("GLADIATOR exact full-resolution review cache",len(baked.vertices),"vertices",flush=True)
views=[
    ("clay-front",(0,4.8,.72),(0,.02,.72),1.57),
    ("clay-side",(4.8,0,.72),(0,.02,.72),1.57),
    ("clay-rear",(0,-4.8,.72),(0,.02,.72),1.57),
    ("clay-three-quarter",(2.8,4.5,2.8),(0,.02,.72),1.59),
    ("clay-game",(-1.4,3.2,5.75),(0,.02,.70),1.52),
    ("clay-face-chest",(.65,4.4,1.45),(0,.012,1.09),.72),
    ("clay-shield-grip",(-2.2,-3.4,1.05),(-.13,.15,.74),.84),
    ("clay-shield-palm",(-.65,-.10,1.8),(-.13,.15,.74),.29),
    ("clay-sword-grip",(3.4,2.2,.88),(.22,.10,.72),.62),
    ("material-three-quarter",(2.8,4.5,2.8),(0,.02,.72),1.59,False),
    ("material-face",(.25,4.2,1.28),(0,.012,1.17),.44,False),
    ("material-game",(-1.4,3.2,5.75),(0,.02,.70),1.52,False),
]
focus=os.environ.get("GLADIATOR_REVIEW_FOCUS")
if focus:
    names=set(focus.split(","))
    views=[v for v in views if v[0] in names]
files=[render(*view) for view in views]
pose_focus=os.environ.get("GLADIATOR_REVIEW_POSES")
if not focus or pose_focus:
    for name,values in model.POSES.items():
        if pose_focus and name not in pose_focus.split(","):
            continue
        pose(values)
        files.append(render("pose-"+name,(2.8,4.5,2.8),(0,.02,.72),1.60,False))
        if name in ("thrust","wind","down"):
            files.append(render("pose-"+name+"-side",(4.8,0,.72),(0,.02,.72),1.60,False))
        if name=="thrust" and os.environ.get("GLADIATOR_REVIEW_WAIST"):
            files.append(render("pose-thrust-waist",(3,-3,.9),(0,-.012,.615),.53,False))
clear_pose()
scene.view_layers[0].material_override=None
if cache:
    skin,original,baked,subdivision=cache
    skin.data=original
    subdivision.show_viewport=subdivision.show_render=True
    bpy.data.meshes.remove(baked)
    kit.refresh()
bpy.ops.wm.save_as_mainfile(filepath=master)
info={"master":master,"sources":sourcefiles,"views":files,
      "sourceMasterInput":MASTER_INPUT,"sourceGLBInput":GLB_INPUT,
      "exactFullResolutionReviewCache":bool(cache) or bool(GLB_INPUT),
      "sourceTriangles":sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in kit.descendants(root) if o.type=="MESH"),
      "materials":sorted({m.name for o in kit.descendants(root) if o.type=="MESH" for m in o.data.materials}),
      "bones":{b.name:list(b.head_local) for b in rig.data.bones} if rig else {}}
(OUT/"evidence.json").write_text(json.dumps(info,indent=2))
print("GLADIATOR REVIEW COMPLETE",json.dumps(info))
