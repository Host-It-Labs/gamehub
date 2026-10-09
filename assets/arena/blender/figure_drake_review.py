"""Serial private Blender master/review/runtime/collector-export stages.

Blender -b --factory-startup -t 3 --python this.py -- --figure drake --stage source
The source is saved before any review pose/light changes. Source and runtime
reviews use identical real Cycles CPU cameras. No sandbox workaround or shared
asset writes. Root signs gates after opening the required evidence in work/.
"""
import argparse
import gc
import importlib
import json
import math
import os
from pathlib import Path
import resource
import runpy
import struct
import subprocess
import sys
import types

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import kit
from figure_drake_anatomy import reset_pose, runtime_quat
from figure_drake_contract import contract
from figure_drake_runtime import (work,digest,source_fingerprint,recipe_fingerprint,motion_fingerprint,code_fingerprint,
                                 require_review,validate_fingerprint,metrics,validate,reduce_master,load_runtime,clean_materials)

MEMORY=[]


def memory(stage):
    limit=float(os.environ.get("ARENA_AVIATOR_MEMORY_GIB","8"))
    if not 0<limit<=8:raise ValueError("Private memory guard must be positive and no more than 8 GiB")
    raw=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak=raw if sys.platform=="darwin" else raw*1024
    try:current=int(subprocess.check_output(["ps","-o","rss=","-p",str(os.getpid())],text=True).strip())*1024
    except (OSError,ValueError,subprocess.SubprocessError):current=None
    row={"stage":stage,"currentRSSBytes":current,"peakRSSBytes":peak,"limitGiB":limit}
    MEMORY.append(row);print("AVIATOR_MEMORY",json.dumps(row),flush=True)
    if peak>limit*1024**3:raise MemoryError("Stop this serial build: 8 GiB guard exceeded at "+stage)
    return row


def fixture(figure):
    path=work(figure)/"review-poses-v1.json"
    data=json.loads(path.read_text())
    if data.get("motionFingerprint")!=motion_fingerprint(figure):
        raise RuntimeError("Stopped motion fixture is stale; rerun drake/probe-next.mjs "+figure)
    return data


def only_root(root):
    keep=set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
    for data in list(bpy.data.meshes):
        if data.users==0:bpy.data.meshes.remove(data)
    gc.collect()


def studio():
    scene=bpy.context.scene
    scene.render.engine="CYCLES";scene.cycles.device="CPU"
    scene.render.threads_mode="FIXED";scene.render.threads=3
    scene.cycles.samples=16;scene.cycles.use_denoising=False
    scene.cycles.use_adaptive_sampling=False;scene.cycles.max_bounces=4
    scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=2;scene.cycles.transmission_bounces=0
    scene.render.use_persistent_data=False;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="JPEG";scene.render.image_settings.quality=90
    scene.render.film_transparent=False;scene.view_settings.view_transform="AgX"
    scene.world=bpy.data.worlds.new("Aviator neutral review world");scene.world.use_nodes=True
    background=scene.world.node_tree.nodes["Background"]
    background.inputs[0].default_value=(.17,.18,.20,1);background.inputs[1].default_value=.45
    for name,at,power,size in (("key",(-2.5,3,4),160,2.8),("fill",(2.8,2.8,2.5),65,3),
                               ("rim",(.8,-3,3.5),110,2.6)):
        data=bpy.data.lights.new("__aviator-review-"+name,"AREA");obj=bpy.data.objects.new(data.name,data)
        scene.collection.objects.link(obj);obj.location=at;data.energy,data.size=power,size
        obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat("-Z","Y").to_euler()
    camera_data=bpy.data.cameras.new("__aviator-review-camera");camera_data.type="ORTHO"
    camera_data.clip_start,camera_data.clip_end=.001,100
    camera=bpy.data.objects.new(camera_data.name,camera_data);scene.collection.objects.link(camera);scene.camera=camera
    clay=bpy.data.materials.new("__aviator-review-clay");clay.use_nodes=True
    bsdf=clay.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value=(.43,.44,.44,1);bsdf.inputs["Roughness"].default_value=.78
    bsdf.inputs["Specular IOR Level"].default_value=.23
    return scene,camera,clay


def set_pose(root,data=None):
    reset_pose(root,(data or {}).get("turns",{}))
    body=(data or {}).get("body",{})
    root.rotation_mode="QUATERNION"
    root.rotation_quaternion=runtime_quat(body.get("lean",0),body.get("yawKick",0),body.get("roll",0))
    root.location=(0,body.get("lunge",0),body.get("lift",0))
    kit.refresh()


def review(root,stage):
    figure=root.name;base=work(figure);out=base/(stage+"-v1");out.mkdir(parents=True,exist_ok=True)
    index={"id":figure,"stage":stage,"revision":"v1","complete":False,"renders":[],"requiredRenders":[],
           "sourceFingerprint":source_fingerprint(figure),"recipeFingerprint":recipe_fingerprint(figure),
           "motionFingerprint":motion_fingerprint(figure),"inspected":False,
           "poseEvidenceKind":"Real Blender render of stopped shared-reach goals; moving renderer review still required"}
    index_path=out/"render-index.json"
    def write():index["memory"]=MEMORY;index_path.write_text(json.dumps(index,indent=2)+"\n")
    write() # Failed reruns cannot inherit a complete gallery.
    validate_fingerprint(root);validate(root,runtime=stage=="runtime");only_root(root);set_pose(root)
    info=metrics(root);index["withinEightPercent"]=info["withinEightPercent"]
    (out/"geometry.json").write_text(json.dumps(info,indent=2)+"\n")
    if info["triangles"]>750000:raise ValueError("Master exceeds private 750k source ceiling; resample locally before rendering")
    poses=fixture(figure)["poses"]
    scene,camera,clay=studio()
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    slots={o:list(o.data.materials) for o in meshes}
    cfg=contract(figure)["config"];scale=cfg["scale"]
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    def bone_point(name,offset=(0,0,0)):
        return rig.matrix_world@rig.pose.bones[figure+"."+name].head+root.rotation_quaternion@Vector(offset)
    def render(name,az=32,el=12,colour=False,size=640,focus=None,span=None,human=False,required=True):
        visibility={o:o.hide_render for o in meshes}
        for obj,mats in slots.items():
            obj.data.materials.clear()
            for mat in mats:obj.data.materials.append(mat if colour else clay)
            if human and not obj.get("humanComponent"):obj.hide_render=True
        # Include the complete current silhouette in whole-craft/extreme views.
        data=metrics(root);lo,hi=Vector(data["min"]),Vector(data["max"])
        at=Vector(focus) if focus is not None else (lo+hi)/2
        az,el=math.radians(az),math.radians(el)
        direction=Vector((math.sin(az)*math.cos(el),math.cos(az)*math.cos(el),math.sin(el)))
        camera.location=at+direction*4
        camera.rotation_euler=(at-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.ortho_scale=span or (hi-lo).length*1.10
        scene.render.resolution_x=scene.render.resolution_y=size
        scene.cycles.samples=24 if colour else 12
        destination=out/(name+".jpg");scene.render.filepath=str(destination)
        memory("before-render-"+name);bpy.ops.render.render(write_still=True);memory("after-render-"+name)
        relative=str(destination.relative_to(base));index["renders"].append(relative)
        if required:index["requiredRenders"].append(relative)
        write()
        for obj,mats in slots.items():
            obj.hide_render=visibility[obj];obj.data.materials.clear()
            for mat in mats:obj.data.materials.append(mat)
    for name,az,el in (("front",0,8),("side",90,8),("rear",180,8),("three",32,14),("game",32,55)):
        render("clay-"+name,az,el)
    for colour in (False,True):
        prefix="material" if colour else "clay"
        render(prefix+"-face",14,10,colour,focus=bone_point("head",(0,.013*scale,.132*scale)),span=.39*scale,human=True)
        render(prefix+"-face-side",82,10,colour,focus=bone_point("head",(0,0,.132*scale)),span=.39*scale,human=True)
        for side,az in (("L",-62),("R",62)):
            render(prefix+"-hand-"+side,az,12,colour,focus=bone_point("hand"+side,(0,.012*scale,-.050*scale)),
                   span=.21*scale,human=True)
    # Isolated seated rest shows the relaxed hanging shoulders that the
    # fuselage/basket would otherwise obscure. Craft is hidden only here.
    render("clay-human-rest",32,12,focus=bone_point("chest",(0,0,.040*scale)),span=.96*scale,human=True)
    ranges={"arm-forward":{"armR":[2.10,0,0],"foreR":[.20,0,0]},
            "arm-out":{"armL":[.06,0,-1.75],"foreL":[.20,0,0]},
            "elbow-deep":{"armR":[.42,0,.06],"foreR":[2.20,0,0]},
            "knee-deep":{"legL":[1.05,0,0],"kneeL":[-2.10,0,0],"footL":[.55,0,0]}}
    for name,turns in ranges.items():
        set_pose(root,{"turns":turns})
        render("clay-"+name,70 if name=="elbow-deep" else 32,12,
               focus=bone_point("chest",(0,0,.045*scale)),span=1.10*scale,human=True)
    for name in ("idle-rest","idle-fidget","attack-anticipation","attack-hit","attack-follow","attack-recovery","hit-reaction","deploy"):
        set_pose(root,poses[name]);render("clay-"+name)
        if name in ("idle-rest","idle-fidget","attack-hit","attack-anticipation"):
            render("material-"+name+"-hands",42,18,True,focus=bone_point("chest",(0,.105*scale,-.055*scale)),
                   span=.69*scale)
    set_pose(root)
    render("material-three",32,14,True)
    render("material-game",32,55,True,size=320)
    render("material-small-game",32,55,True,size=192)
    render("material-small-phone",32,70,True,size=192)
    set_pose(root,poses["attack-hit"]);render("material-attack-game",32,55,True,size=320)
    set_pose(root)
    # Restore every slot and neutral bone before hashing the completed index.
    validate_fingerprint(root);fixture(figure)
    if index["sourceFingerprint"]!=source_fingerprint(figure) or index["recipeFingerprint"]!=recipe_fingerprint(figure):
        raise RuntimeError("Recipe/source changed during review; repeat current evidence")
    index["complete"]=True;write()
    template={"accepted":False,"reviewer":"root","sourceFingerprint":source_fingerprint(figure),
              "modelCodeFingerprint":code_fingerprint(figure),
              "recipeFingerprint":recipe_fingerprint(figure),"masterSHA256":digest(base/(figure+"-master-v1.blend")),
              "renderIndexSHA256":digest(index_path),"inspected":[],"observations":[],
              "requiredRenders":index["requiredRenders"]}
    if stage=="runtime":template["runtimeSHA256"]=digest(base/(figure+"-runtime-v1.blend"))
    (base/(stage+"-review-gate-v1.template.json")).write_text(json.dumps(template,indent=2)+"\n")
    print("AVIATOR_REVIEW_COMPLETE",figure,stage,len(index["renders"]),flush=True)


def audit_export(figure,file):
    raw=file.read_bytes()
    if raw[:4]!=b"glTF":raise ValueError("Collector output is not GLB")
    length=struct.unpack_from("<I",raw,12)[0];data=json.loads(raw[20:20+length])
    roots=[n for n in data["nodes"] if n.get("name")==figure]
    if len(roots)!=1 or not data.get("skins"):raise ValueError("Collector lost root or skin")
    if data.get("images") or data.get("textures"):raise ValueError("Figure GLB must not embed textures")
    names={node.get("name") for node in data["nodes"]}
    for suffix in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth"):
        if figure+suffix not in names:raise ValueError("Collector lost facial control "+suffix)
    triangles=0
    for mesh in data["meshes"]:
        for primitive in mesh["primitives"]:
            attrs=primitive["attributes"]
            if "COLOR_0" not in attrs or any(name.startswith("COLOR_") and name!="COLOR_0" for name in attrs):
                raise ValueError("Export requires single active AO/pigment COLOR_0")
            index=data["accessors"][primitive.get("indices",attrs["POSITION"])]
            triangles+=index["count"]//3
    if not 20000<=triangles<=32000:raise ValueError("Export changed whole-vehicle triangle budget")
    import re
    if any(re.search(r"\.\d{3}$",m.get("name","")) for m in data.get("materials",[])):
        raise ValueError("Collector created duplicate material suffixes")
    (work(figure)/"collector-audit-v1.json").write_text(json.dumps({"file":file.name,"sha256":digest(file),
        "triangles":triangles,"skins":len(data["skins"]),"faceControlsPresent":True,
        "textures":0,"colour":"single active COLOR_0","rootOnly":figure,"artisticAcceptance":False},indent=2)+"\n")


def collector_export(figure):
    require_review(figure,"runtime")
    # Import override is process-local. The ordinary collector runs unchanged
    # and the shipped figure_<id>.py stays usable until the root installs it.
    module=types.ModuleType("figure_"+figure)
    module.build=lambda root_name=figure:load_runtime(root_name,path=work(root_name)/(root_name+"-runtime-v1.blend"))
    sys.modules[module.__name__]=module
    os.environ["ARENA_FIGURES"]=figure
    output=work(figure)/(figure+"-v1.glb")
    sys.argv=[str(HERE/"figures.py"),"--",str(output)]
    runpy.run_path(str(HERE/"figures.py"),run_name="__main__")
    audit_export(figure,output);memory("ordinary-collector-export")


def main(default="drake"):
    parser=argparse.ArgumentParser()
    parser.add_argument("--figure",choices=("drake","balloon"),default=default)
    parser.add_argument("--stage",choices=("source","source-review","runtime","runtime-review","export"),default="source")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    figure=args.figure;base=work(figure);base.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    if args.stage=="export":collector_export(figure);return
    fixture(figure);memory("entry")
    if args.stage in ("source","source-review","runtime","runtime-review"):
        label="source" if args.stage.startswith("source") else "runtime"
        out=base/(label+"-v1");out.mkdir(parents=True,exist_ok=True)
        (out/"render-index.json").write_text(json.dumps({"complete":False,"stage":label,"status":"starting"})+"\n")
    master=base/(figure+"-master-v1.blend")
    if args.stage=="source":
        kit.reset(seed=71);kit.TINTS["team3"]=(.28,.45,1)
        sculpt=importlib.import_module("figure_"+figure+"_sculpt")
        root=sculpt.build_master(memory);clean_materials(root);validate(root)
        root["sourceFingerprint"]=source_fingerprint(figure)
        root["modelCodeFingerprint"]=code_fingerprint(figure)
        root["nativeBaselineSize"]=json.loads((base/"baseline-v1.json").read_text())["blenderSize"]
        only_root(root);reset_pose(root)
        root.rotation_mode="QUATERNION";root.rotation_quaternion=(1,0,0,0);root.location=(0,0,0)
        memory("master-built");info=metrics(root)
        if info["triangles"]>750000:raise ValueError("Private master source ceiling exceeded")
        (base/"source-metrics-v1.json").write_text(json.dumps(info,indent=2)+"\n")
        bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True);memory("master-saved")
        review(root,"source")
    elif args.stage=="source-review":
        bpy.ops.wm.open_mainfile(filepath=str(master));review(bpy.data.objects[figure],"source")
    elif args.stage=="runtime":
        root=reduce_master(figure,memory);review(root,"runtime")
    else:
        bpy.ops.wm.open_mainfile(filepath=str(base/(figure+"-runtime-v1.blend")))
        review(bpy.data.objects[figure],"runtime")


if __name__=="__main__":main()
