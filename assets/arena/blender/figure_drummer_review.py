"""Staged private Blender driver; never writes live figures or shared files.

source: build, save master, render fixed clay/material/extreme-pose views.
runtime: open visually reviewed master, reduce a copy, save and render it.
source-review/runtime-review: reopen the saved copy for focused views.
export-candidate: write only an unshipped dev GLB in the owned work folder.
"""
import argparse
import json
import os
import math
import resource
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion, Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import kit
import figure_folk_kit as geo
import figure_drummer_sculpt as sculpt
import figure_drummer_runtime as runtime

R=sculpt.R;WORK=runtime.WORK


def memory(stage):
    raw=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak=raw if sys.platform=="darwin" else raw*1024
    limit=float(os.environ.get("DRUMMER_MEMORY_LIMIT","8"))
    print("R6 MEMORY",R,stage,round(peak/1024**3,3),"GiB peak",flush=True)
    if not 0<limit<=8:raise ValueError("R6 memory limit must be at most 8 GiB")
    if peak>limit*1024**3:raise MemoryError(R+" exceeds its "+str(limit)+" GiB guard at "+stage)
    return peak


def set_pose(root,armature,values=None,body=None):
    root.rotation_mode="QUATERNION";root.rotation_quaternion=Quaternion();root.location=(0,0,0)
    for bone in armature.pose.bones:
        bone.rotation_mode="QUATERNION";bone.rotation_quaternion=Quaternion()
        bone.location=(0,0,0);bone.scale=(1,1,1)
    for name,angles in (values or {}).items():
        bone=armature.pose.bones.get(R+"."+name)
        if not bone:raise ValueError("Unknown review bone "+name)
        frame=bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion=frame.inverted()@geo.runtime_quat(*angles[:3])@frame
    if body:
        root.rotation_quaternion=geo.runtime_quat(-body.get("lean",0),body.get("yawKick",0),body.get("roll",0))
        root.location=(0,body.get("lunge",0),body.get("lift",0))
    kit.refresh()
    if body and body.get("lift",0)<0:
        # The runtime's ground solver bends planted legs during a crouch.
        # Static review must do that too, rather than sink straight feet
        # through the studio floor and misrepresent the authored attack.
        for s,suffix in ((-1,"L"),(1,"R")):
            if (values or {}).get("leg"+suffix):continue
            hip=root.matrix_world@sculpt.HIP[s]
            ankle=sculpt.ANKLE[s]
            upper=sculpt.KNEE[s]-sculpt.HIP[s]
            lower=sculpt.ANKLE[s]-sculpt.KNEE[s]
            knee=geo.ik(hip,ankle,upper.length,lower.length,hip+Vector((0,.6,-.1)))
            inverse=root.matrix_world.to_quaternion().inverted()
            u=inverse@(knee-hip);f=inverse@(ankle-knee)
            qa=geo.frame_quat(upper,lower,u,f)
            qk=lower.rotation_difference(qa.inverted()@f)
            qf=(root.matrix_world.to_quaternion()@qa@qk).inverted()
            for part,q in (("leg",qa),("knee",qk),("foot",qf)):
                bone=armature.pose.bones[R+"."+part+suffix]
                frame=bone.bone.matrix_local.to_quaternion()
                bone.rotation_quaternion=frame.inverted()@q@frame
        kit.refresh()


def studio(args):
    scene=bpy.context.scene;scene.render.engine="CYCLES"
    scene.cycles.device,scene.cycles.samples="CPU",args.samples
    scene.cycles.use_denoising=True
    scene.render.resolution_x=scene.render.resolution_y=args.resolution
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="JPEG";scene.render.image_settings.color_mode="RGB"
    scene.render.image_settings.quality=89;scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX"
    world=bpy.data.worlds.new("__"+R+"-review-world");scene.world=world;world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=(.19,.21,.24,1)
    world.node_tree.nodes["Background"].inputs[1].default_value=.42
    clay=bpy.data.materials.new("__"+R+"-neutral-clay");clay.use_nodes=True
    bsdf=clay.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(.45,.47,.49,1)
    bsdf.inputs["Roughness"].default_value=.80;bsdf.inputs["Specular IOR Level"].default_value=.22
    def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    for name,at,energy,size in (("key",(-2.5,3.1,4.1),145,2.3),("fill",(2.6,2.3,2.4),62,2.5),("rim",(.6,-2.7,3.3),110,2.0)):
        data=bpy.data.lights.new("__"+R+"-review-"+name,"AREA");data.energy,data.size=energy,size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=at;aim(obj,(0,0,.78))
    floor=kit.box("__"+R+"-review-floor",(40,40,.012),(0,0,-.018),grid=False)
    fm=bpy.data.materials.new("__"+R+"-floor-mat");fm.use_nodes=True
    fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(.14,.16,.18,1)
    fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.95
    floor.data.materials.append(fm)
    data=bpy.data.cameras.new("__"+R+"-review-camera");data.type="ORTHO";data.clip_start,data.clip_end=.01,100
    camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);scene.camera=camera
    return scene,camera,clay,aim


def views():
    # Camera definitions are identical for source and runtime. No fitting an
    # oversized figure down to hide a footprint error or cropping the prop.
    return [
        ("clay-front",0,8,(0,.035,.72),1.73,{},True),
        ("clay-side",90,8,(0,.035,.72),1.73,{},True),
        ("clay-rear",180,8,(0,.035,.72),1.73,{},True),
        ("clay-three",35,14,(0,.035,.72),1.75,{},True),
        ("clay-game55",35,55,(0,.035,.72),1.75,{},True),
        ("clay-face",5,6,(0,.045,1.185),.35,{},True),
        ("clay-handL",-70,12,(-.22,.065,.515),.25,{},True),
        ("clay-handR",70,12,(.22,.065,.515),.25,{},True),
        ("clay-drum",5,65,tuple(sculpt.DRUM_C),.60,{},True),
        ("clay-shako",25,10,(0,0,1.35),.42,{},True),
        ("clay-forward120",35,14,(0,.15,.84),1.90,{"clavR":(.12,.10,.13),"armR":(1.96,0,0),"foreR":(.14,0,0)},True),
        ("clay-out100",0,10,(0,0,.80),1.88,{"clavR":(0,0,.15),"armR":(0,0,1.595),"foreR":(.14,0,0)},True),
        ("clay-elbow140",80,12,(0,.05,.80),1.8,{"armR":(.60,0,.10),"foreR":(2.20,0,0)},True),
        ("clay-knee120",90,10,(0,0,.65),1.70,{"legR":(.8,0,0),"kneeR":(-2.09,0,0),"footR":(.30,0,0)},True),
        ("clay-coat",125,13,(0,-.012,.780),.79,{},True),
        ("clay-leg",25,8,(.095,.020,.392),.68,{},True),
        ("material-coat",125,13,(0,-.012,.780),.79,{},False),
        ("material-three",35,14,(0,.035,.72),1.75,{},False),
        ("material-face",5,6,(0,.045,1.185),.35,{},False),
        ("clay-mouth-front",0,3,(0,.050,1.132),.126,{},True),
        ("material-mouth-front",0,3,(0,.050,1.132),.126,{},False),
        ("material-mouth-left",-35,3,(0,.050,1.132),.126,{},False),
        ("material-mouth-right",35,3,(0,.050,1.132),.126,{},False),
        ("material-game55",35,55,(0,.035,.72),1.75,{},False),
        ("material-drum",5,65,tuple(sculpt.DRUM_C),.60,{},False),
    ]


def main():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--stage",choices=("source","runtime","source-review","runtime-review","export-candidate"),required=True)
    parser.add_argument("--only",default="");parser.add_argument("--resolution",type=int,default=768)
    parser.add_argument("--samples",type=int,default=20)
    args=parser.parse_args(argv)
    if not 128<=args.resolution<=1200 or not 1<=args.samples<=64:raise ValueError("Use a moderate review resolution and samples")
    WORK.mkdir(parents=True,exist_ok=True);bpy.context.preferences.filepaths.save_version=0
    if args.stage=="source":
        kit.reset(seed=19);root=sculpt.build_master();root["b2SourceFingerprint"]=runtime.fingerprint()
        memory("source-built");runtime.validate(root);info=runtime.metrics(root)
        # Root, 9 October: report the real count; the root sets the review
        # ceiling from measured memory (ARENA_SOURCE_CEILING).
        print(f"{root.name.upper()} SOURCE TRIANGLES", info["triangles"], flush=True)
        if info["triangles"]>int(os.environ.get("ARENA_SOURCE_CEILING", runtime.SOURCE_CEILING)):raise ValueError("Master exceeds bounded source allocation")
        # Save the editable neutral master before adding any studio objects.
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(runtime.SOURCE),compress=True)
        info["masterSHA256"]=runtime.file_hash(runtime.SOURCE)
        info["sourceCeiling"]=int(os.environ.get("ARENA_SOURCE_CEILING", runtime.SOURCE_CEILING))
        info["visualAcceptance"]=False
        (WORK/"source-metrics-v4.json").write_text(json.dumps(info,indent=2)+"\n")
        prefix="source-v4"
    elif args.stage=="runtime":
        runtime.require_review("source");bpy.ops.wm.open_mainfile(filepath=str(runtime.SOURCE))
        root=bpy.data.objects[R];memory("runtime-master-loaded")
        runtime.reduce(root,memory=memory);runtime.bake_ao(root);runtime.freeze(root)
        memory("runtime-frozen");prefix="runtime-v4"
    elif args.stage=="source-review":
        bpy.ops.wm.open_mainfile(filepath=str(runtime.SOURCE));root=bpy.data.objects[R]
        if root.get("b2SourceFingerprint")!=runtime.fingerprint():raise RuntimeError("Saved source is stale")
        prefix="source-v4"
    else:
        kit.reset(seed=19);root=runtime.load_runtime(reviewed=False);prefix="runtime-v4"
    if args.stage=="export-candidate":
        path=WORK/(R+"-candidate-v4.glb");kit.export([root],str(path))
        info=runtime.metrics(root);info.update(path=path.name,sha256=runtime.file_hash(path),visualAcceptance=False)
        (WORK/"dev-export-v4.json").write_text(json.dumps(info,indent=2)+"\n")
        print("R6 V4 DEV CANDIDATE",path,flush=True);return
    armature=runtime.validate(root);scene,camera,clay,aim=studio(args)
    records=[];selected=set(args.only.split(",")) if args.only else None
    items=views()
    samples_path=WORK/"review-poses-v4.json"
    if samples_path.is_file():
        for name,item in json.loads(samples_path.read_text()).items():
            items.append(("clay-"+name,35,14,(0,.06,.73),1.83,item["joints"],True,item.get("body")))
            if "contact" in name:
                items.append(("clay-"+name+"-close",5,65,(-.055,.235,.78),.65,item["joints"],True,item.get("body")))
    else:
        raise RuntimeError("Generate owned review-poses-v4.json using the motion audit before the Blender review")
    valid={item[0] for item in items}
    if selected and selected-valid:raise ValueError("Unknown views "+str(selected-valid))
    for item in items:
        name,azimuth,elevation,target,scale,pose,clay_view=item[:7]
        if selected and name not in selected:continue
        body=item[7] if len(item)>7 else None
        set_pose(root,armature,pose,body)
        scene.view_layers[0].material_override=clay if clay_view else None
        az,el=math.radians(azimuth),math.radians(elevation)
        camera.location=Vector(target)+Vector((math.sin(az)*math.cos(el)*3,
                                              math.cos(az)*math.cos(el)*3,math.sin(el)*3))
        camera.data.ortho_scale=scale;aim(camera,target)
        path=WORK/(prefix+"-"+name+".jpg");scene.render.filepath=str(path)
        memory(name+"-before");bpy.ops.render.render(write_still=True);memory(name+"-after")
        records.append({"file":path.name,"clay":clay_view,"camera":list(camera.location),"target":target,
                        "orthoScale":scale,"joints":pose,"body":body,"inspected":False})
        print("R6 V4 REVIEW",path,flush=True)
    set_pose(root,armature);scene.view_layers[0].material_override=None
    # Merge focused rerenders into the original evidence index.
    index=WORK/(prefix+"-review-views.json")
    identity={"sourceFingerprint":runtime.fingerprint(),"masterSHA256":runtime.file_hash(runtime.SOURCE)}
    if prefix.startswith("runtime"):identity["runtimeSHA256"]=runtime.file_hash(runtime.RUNTIME)
    previous=json.loads(index.read_text()) if index.is_file() else {}
    same_copy=all(previous.get(k)==v for k,v in identity.items())
    prior=previous.get("views",[]) if selected and same_copy else []
    merged={v["file"]:v for v in prior+records}
    info={"stage":args.stage,**identity,
          "views":list(merged.values()),"inspectionPending":True,
          "notEvidenceOf":["real game moving cycles","physical touch","device GPU performance","visual acceptance"]}
    index.write_text(json.dumps(info,indent=2)+"\n")
    stage="source" if prefix.startswith("source") else "runtime"
    gate_path=WORK/(stage+"-review-gate-v4.json")
    previous_gate=json.loads(gate_path.read_text()) if gate_path.is_file() else {}
    if not previous_gate or any(previous_gate.get(k)!=v for k,v in identity.items()):
        template={"accepted":False,**identity,
                  "inspected":[],"observations":[],"remaining":["Open required views; repair anatomy grips coat skin weights and drum contact defects"]}
        # A rebuild requires new observations. Keep one prior record for
        # context, without carrying its acceptance onto the new copy.
        if previous_gate:template["previousReview"]={k:v for k,v in previous_gate.items() if k!="previousReview"}
        gate_path.write_text(json.dumps(template,indent=2)+"\n")
    print("R6 V4 REVIEW GATE",gate_path,flush=True)


if __name__=="__main__":main()
