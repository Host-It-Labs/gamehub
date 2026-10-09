"""Private Diver master/runtime review driver; never changes shared assets.

Blender --python figure_diver_review.py -- master|runtime|review [version]
`master` builds and saves the detailed source and its honest review set.
`runtime` is deliberately a separate operation, after source visual review.
"""
import json
import hashlib
import gc
import math
import os
from pathlib import Path
import resource
import subprocess
import sys

import bpy
from mathutils import Quaternion, Vector

SOURCE=Path(__file__).resolve().parent
PROJECT=SOURCE.parents[2]
sys.path.insert(0,str(SOURCE))
import kit
import figure_folk_kit as geo
from figure_diver_sculpt import BASE, build_master

POSES={
    "neutral":{},
    "arm-forward":{"armR":(2.10,0,0),"foreR":(.20,0,0)},
    "arm-side":{"armL":(.06,0,-1.75),"foreL":(.25,0,0)},
    "elbow-deep":{"armR":(.62,0,.20),"foreR":(2.15,0,0)},
    "knee-deep":{"legL":(1.05,0,0),"kneeL":(-2.10,0,0),"footL":(.62,0,0)},
}


def memory(stage):
    # macOS reports ru_maxrss in bytes, Linux in KiB. This measures this
    # Blender process, not the other owners' jobs. Root still runs serially.
    raw=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak=raw if sys.platform=="darwin" else raw*1024
    current=None
    try:
        current=int(subprocess.check_output(["ps","-o","rss=","-p",str(os.getpid())],
                                            text=True).strip())*1024
    except (OSError,ValueError,subprocess.SubprocessError):
        pass
    print("DIVER_MEMORY",stage,round(peak/1024**3,3),"GiB peak",
          round(current/1024**3,3) if current is not None else "unknown",
          "GiB current",flush=True)
    # R6 authorization: at most 8 GiB per job, at most two jobs on the Mac.
    limit=float(os.environ.get("DIVER_MEMORY_LIMIT","8"))
    if not 0<limit<=8:raise ValueError("Diver memory limit must be at most 8 GiB")
    if peak>limit*1024**3:
        raise MemoryError(f"Diver review exceeded {limit} GiB; inspect the stage diagnostics before another run")
    return peak


def motion_record(version):
    path=BASE/("review-poses-"+version+".json")
    record=json.loads(path.read_text())
    for file,key in ((SOURCE/"figure_diver_sculpt.py","sculptSha256"),
                    (BASE/"moves-diver-next.ts","movesSha256"),
                     (PROJECT/"components/game/arena/moves/reach.ts","reachSha256")):
        if hashlib.sha256(file.read_bytes()).hexdigest()!=record[key]:
            raise RuntimeError("Motion review targets are stale; rerun node "+str(BASE/"probe-next.mjs"))
    return record


def motion_poses(version):
    return motion_record(version)["poses"]


def source_inspection(version):
    path=BASE/("source-inspected-"+version+".json")
    if not path.is_file():raise RuntimeError("Record the opened Diver source inspection before reduction")
    approved=json.loads(path.read_text())
    current=motion_record(version)
    if not approved.get("allowReduction") or any(approved.get(key)!=current[key]
            for key in ("sculptSha256","movesSha256","reachSha256")):
        raise RuntimeError("Diver source acceptance is absent or stale")
    master=BASE/("diver-master-"+version+".blend")
    if approved.get("masterSHA256")!=hashlib.sha256(master.read_bytes()).hexdigest():
        raise RuntimeError("Diver master changed after source inspection")
    index=json.loads((BASE/("source-"+version)/"render-index.json").read_text())
    if not index.get("complete") or not index.get("renders") or set(index["renders"])-set(approved.get("inspectedRenders",[])):
        raise RuntimeError("Diver source inspection must cover its complete current gallery")
    return approved


def native_footprint_accepted(measured,version):
    if measured.get("footprintWithinEightPercent"):return True
    # The root explicitly accepted v4's smaller tool footprint. Preserve the
    # measured -8.7% depth rather than enlarge the approved source to fit the
    # old prop envelope. No enlarged dimension or different source is allowed.
    approved=source_inspection(version)
    exception=approved.get("nativeDepthException",{})
    depth=exception.get("acceptedDepth")
    source=json.loads((BASE/("source-"+version)/"measurements.json").read_text())
    delta=measured.get("baselineDelta",{})
    return (version=="v4" and exception.get("acceptedByRoot") is True
            and depth==source.get("depth") and isinstance(depth,(int,float)) and depth>0
            and abs(delta.get("width",1))<=.08 and abs(delta.get("height",1))<=.08
            and delta.get("depth",1)<0 and abs(measured["depth"]/depth-1)<=.01)


def validate_review_index(label,version):
    path=BASE/(label+"-"+version)/"render-index.json"
    if not path.is_file():
        raise RuntimeError("Complete the current Diver "+label+" render review first")
    index=json.loads(path.read_text())
    record=motion_record(version)
    expected={"sourceSculptSha256":record["sculptSha256"],
              "movesSha256":record["movesSha256"],
              "reachSha256":record["reachSha256"]}
    if (not index.get("complete") or index.get("stage")!=label or index.get("version")!=version
            or any(index.get(key)!=value for key,value in expected.items())):
        raise RuntimeError("Diver "+label+" images are incomplete or stale against the sculpt/moves/reach; rerender and inspect the matching set")
    out=path.parent
    if not index.get("renders") or any(not (out/name).is_file() for name in index["renders"]):
        raise RuntimeError("Diver "+label+" gallery is missing its indexed images")
    measured=json.loads((out/"measurements.json").read_text())
    if not native_footprint_accepted(measured,version):
        raise RuntimeError("Diver "+label+" differs from its accepted native footprint")
    if label=="source":
        geometry_record=json.loads((out/"geometry.json").read_text())
        if geometry_record["rawMasterSuitTopology"]["connectedComponents"]!=1:
            raise RuntimeError("Diver master suit has detached islands; repair the original before runtime reduction")


def validate_source(root):
    expected=hashlib.sha256((SOURCE/"figure_diver_sculpt.py").read_bytes()).hexdigest()
    if root.get("sourceSculptSha256")!=expected:
        raise RuntimeError("Loaded Diver master/runtime is stale; rebuild the matching source before review or export")


def pose(rig,values):
    for bone in rig.pose.bones:
        bone.rotation_mode="QUATERNION"
        bone.rotation_quaternion=Quaternion()
        bone.location=(0,0,0);bone.scale=(1,1,1)
    for name,angles in values.items():
        bone=rig.pose.bones["diver."+name]
        frame=bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion=frame.inverted()@geo.runtime_quat(*angles[:3])@frame
    kit.refresh()


def bounds(root):
    dg=bpy.context.evaluated_depsgraph_get()
    pts=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH":continue
        ev=obj.evaluated_get(dg)
        pts.extend(ev.matrix_world@Vector(c) for c in ev.bound_box)
    lo=Vector(tuple(min(p[k] for p in pts) for k in range(3)))
    hi=Vector(tuple(max(p[k] for p in pts) for k in range(3)))
    return lo,hi


def geometry(root,evaluated=False):
    dg=bpy.context.evaluated_depsgraph_get() if evaluated else None
    rows=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH":continue
        data=obj.evaluated_get(dg).data if evaluated else obj.data
        rows.append({"name":obj.name,"vertices":len(data.vertices),
                     "polygons":len(data.polygons),
                     "triangles":sum(len(p.vertices)-2 for p in data.polygons)})
    return {"meshes":len(rows),"vertices":sum(r["vertices"] for r in rows),
            "triangles":sum(r["triangles"] for r in rows),"components":rows}


def suit_topology(root):
    """Record raw master islands before a temporary copy can lose fragments."""
    obj=next(o for o in kit.descendants(root) if o.type=="MESH" and "suit-skin" in o.name)
    data=obj.data
    parent=list(range(len(data.vertices)))
    size=[1]*len(parent)
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]
            i=parent[i]
        return i
    for edge in data.edges:
        a,b=(find(i) for i in edge.vertices)
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            parent[b]=a;size[a]+=size[b]
    islands={}
    for vertex in data.vertices:
        key=find(vertex.index)
        point=tuple(vertex.co)
        if key not in islands:
            islands[key]={"vertices":0,"min":list(point),"max":list(point)}
        row=islands[key];row["vertices"]+=1
        for k in range(3):
            row["min"][k]=min(row["min"][k],point[k])
            row["max"][k]=max(row["max"][k],point[k])
    rows=sorted(islands.values(),key=lambda row:row["vertices"],reverse=True)
    return {"name":obj.name,"checkedBeforeReduction":True,
            "connectedComponents":len(rows),"largestIslands":rows[:20],
            "truncated":len(rows)>20}


def prepare_review_copy(root,label,version):
    """Bound only the transient render geometry, after the master is saved.

    This is not the 28k runtime reduction and never saves a blend. Retain
    source weights, sampled normals, face controls and all material parts.
    """
    raw=geometry(root);full=geometry(root,evaluated=True)
    topology=suit_topology(root) if label=="source" else None
    if topology:print("DIVER_SUIT_TOPOLOGY",json.dumps(topology),flush=True)
    memory("review-evaluated")
    if label=="source":
        from figure_diver_sculpt import select
        from figure_diver_runtime import reduce,triangles
        meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
        for obj in meshes:
            select(obj)
            for mod in list(obj.modifiers):
                if mod.type=="ARMATURE":continue
                if mod.type=="SUBSURF":mod.render_levels=mod.levels
                while obj.modifiers[0]!=mod:
                    bpy.ops.object.modifier_move_up(modifier=mod.name)
                bpy.ops.object.modifier_apply(modifier=mod.name)
        def cap(obj):
            if "suit-skin" in obj.name:return 120000
            if "adult-face" in obj.name:return 18000
            if "beard-sculpt" in obj.name:return 12000
            if "helmet-shell" in obj.name:return 12000
            if "helmet-lining" in obj.name:return 4000
            if "bolted-corselet" in obj.name:return 6000
            if "glove-finger" in obj.name:return 700
            if "glove-palm" in obj.name:return 1600
            if "glove-thumb" in obj.name:return 850
            return 1600
        targets={o:min(triangles(o),cap(o)) for o in meshes}
        fixed=next(o for o in meshes if "suit-skin" in o.name)
        spare=200000-targets[fixed]
        flexible=sum(t for o,t in targets.items() if o!=fixed)
        if flexible>spare:
            for obj in targets:
                if obj!=fixed:targets[obj]=max(8,int(targets[obj]*spare/flexible))
        for obj,target in targets.items():reduce(obj,target)
        # Applied modifiers/joined panels may leave unused source meshes
        # in bpy.data. Free only those, after the full master is on disk.
        # Materials remain live for the later material review.
        for data in list(bpy.data.meshes):
            if data.users==0:bpy.data.meshes.remove(data)
        gc.collect()
        kit.refresh();memory("review-copy-prepared")
    after=geometry(root,evaluated=True)
    print("DIVER_GEOMETRY",json.dumps({"raw":raw["triangles"],
          "evaluated":full["triangles"],"review":after["triangles"]}),flush=True)
    if label=="source" and after["triangles"]>200256:
        raise RuntimeError("Transient Diver review copy exceeds its 200k cap")
    record={"stage":label,"version":version,"transientOnly":label=="source",
            "raw":raw,"evaluatedMaster":full,"renderCopy":after}
    if topology:record["rawMasterSuitTopology"]=topology
    return record


def studio():
    scene=bpy.context.scene
    # Keep the root's 9 October fix: a new subdivision modifier defaults
    # to rendering one level above its viewport level. Render exactly the
    # geometry the review measures; the v2 clay peak still needs the
    # separate transient-copy and buffer controls below.
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            if mod.type=="SUBSURF":
                mod.render_levels=mod.levels
    scene.render.engine="CYCLES"
    scene.render.threads_mode="FIXED";scene.render.threads=3
    scene.cycles.device="CPU";scene.cycles.samples=12
    # Denoiser and high-res multi-view buffers are unnecessary for clay
    # inspection. A fresh process logs their removal separately from the
    # source-preserving transient geometry cap.
    scene.cycles.use_denoising=False
    scene.render.use_persistent_data=False
    scene.cycles.max_bounces=4
    scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=2
    scene.cycles.transmission_bounces=0;scene.cycles.transparent_max_bounces=0
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="JPEG"
    scene.render.image_settings.quality=88
    scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX"
    scene.world=bpy.data.worlds.new("Diver neutral studio")
    scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value=(.16,.17,.19,1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value=.42
    for name,at,energy,size in (("key",(-2.3,2.8,3.7),110,2),
                                 ("fill",(2.5,2.5,2.1),42,2.4),
                                 ("rim",(.8,-2.5,3.1),85,2)):
        data=bpy.data.lights.new("diver-review-"+name,"AREA")
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj)
        obj.location=at;data.energy=energy;data.size=size
        obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat("-Z","Y").to_euler()
    floor=kit.box("diver-review-floor",(200,200,.01),(0,0,-.006),mat="plain:grey",grid=False)
    floor.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.95
    data=bpy.data.cameras.new("Diver honest review camera")
    camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera)
    scene.camera=camera;data.type="ORTHO";data.clip_start=.01;data.clip_end=200
    clay=bpy.data.materials.new("diver-review-neutral-clay");clay.use_nodes=True
    bsdf=clay.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(.36,.38,.39,1)
    bsdf.inputs["Roughness"].default_value=.78
    bsdf.inputs["Specular IOR Level"].default_value=.22
    return scene,camera,clay


def review(root,label,version):
    out=BASE/(label+"-"+version);out.mkdir(parents=True,exist_ok=True)
    # A failed rerun must not leave an old completed index beside mixed
    # images. Only JPGs rendered in this invocation are indexed below.
    index_path=out/"render-index.json"
    rendered=[]
    index={"stage":label,"version":version,"state":"running","complete":False,
           "inspected":False,"renders":rendered,
           "sourceSculptSha256":root.get("sourceSculptSha256")}
    index_path.write_text(json.dumps(index,indent=2)+"\n")
    validate_source(root)
    motion=motion_record(version)
    index.update({"movesSha256":motion["movesSha256"],
                  "reachSha256":motion["reachSha256"]})
    index_path.write_text(json.dumps(index,indent=2)+"\n")
    poses={**POSES,**motion["poses"]}
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    pose(rig,{})
    lo,hi=bounds(root)
    measurements={"min":list(lo),"max":list(hi),"width":hi.x-lo.x,
                  "height":hi.z-lo.z,"depth":hi.y-lo.y}
    (out/"measurements.json").write_text(json.dumps(measurements,indent=2)+"\n")
    baseline=json.loads((BASE/"baseline.json").read_text())["figures"]["diver"]
    measurements["baselineDelta"]={key:measurements[key]/baseline[key]-1
                                  for key in ("width","depth","height")}
    measurements["footprintWithinEightPercent"]=all(abs(v)<=.08
                                  for v in measurements["baselineDelta"].values())
    (out/"measurements.json").write_text(json.dumps(measurements,indent=2)+"\n")
    record=prepare_review_copy(root,label,version)
    copylo,copyhi=bounds(root)
    record["fullMasterBounds"]={"min":list(lo),"max":list(hi)}
    record["reviewCopyBounds"]={"min":list(copylo),"max":list(copyhi)}
    if max(abs(new[i]-old[i]) for new,old in ((copylo,lo),(copyhi,hi)) for i in range(3))>.003:
        raise RuntimeError("Transient review reduction changes silhouette bounds by over 3mm")
    (out/"geometry.json").write_text(json.dumps(record,indent=2)+"\n")
    scene,camera,clay=studio()
    material_slots={o:list(o.data.materials) for o in kit.descendants(root) if o.type=="MESH"}
    def render(name,az,el,target=None,scale=None,colour=False,size=640):
        for obj,mats in material_slots.items():
            obj.data.materials.clear()
            for mat in mats:obj.data.materials.append(mat if colour else clay)
        at=Vector(target or (0,0,.70))
        az,el=math.radians(az),math.radians(el)
        camera.location=at+Vector((math.sin(az)*math.cos(el)*3,
                                  math.cos(az)*math.cos(el)*3,math.sin(el)*3))
        camera.rotation_euler=(at-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.ortho_scale=scale or 1.59
        scene.render.resolution_x=scene.render.resolution_y=size
        scene.cycles.samples=24 if colour else 12
        memory(name+"-before")
        scene.render.filepath=str(out/(name+".jpg"))
        bpy.ops.render.render(write_still=True)
        memory(name)
        rendered.append(name+".jpg")
        index_path.write_text(json.dumps(index,indent=2)+"\n")
        print("DIVER_REVIEW",scene.render.filepath,flush=True)
    for name,az,el in (("front",0,8),("side",90,8),("rear",180,8),
                        ("three",35,15),("game",35,55),("phone-game",35,70)):
        render("clay-"+name,az,el)
    render("clay-face",8,10,(0,.070,1.213),.43)
    render("clay-glove",68,12,(.266,.111,.488),.255)
    render("clay-wrench",35,55,(.22,.28,.83),1.06)
    render("clay-boots",30,12,(0,.045,.135),.55)
    for name in ("arm-forward","arm-side","elbow-deep","knee-deep",
                 "attack-coil","attack-impact","attack-through","tool-inspect"):
        pose(rig,poses[name]);render("clay-"+name,35 if name!="elbow-deep" else 90,12,
                                  target=(0,0,.79),scale=1.97)
    pose(rig,{})
    render("material-three",35,16,colour=True)
    render("material-face",8,10,(0,.070,1.213),.43,colour=True)
    render("material-wrench",35,55,(.22,.28,.83),1.06,colour=True)
    render("material-boots",30,12,(0,.045,.135),.55,colour=True)
    render("material-game",35,55,colour=True,size=480)
    render("material-small-game",35,55,colour=True,size=192)
    render("material-phone-game",35,70,colour=True,size=192)
    for obj,mats in material_slots.items():
        obj.data.materials.clear()
        for mat in mats:obj.data.materials.append(mat)
    pose(rig,{})
    validate_source(root)
    current=motion_record(version)
    if any(current[key]!=motion[key] for key in ("sculptSha256","movesSha256","reachSha256")):
        raise RuntimeError("Diver sculpt/moves/reach changed during this render run; rerender the frozen set")
    index_path.write_text(json.dumps({"stage":label,"version":version,
        "state":"complete","complete":True,"sourceSculptSha256":root.get("sourceSculptSha256"),
        "movesSha256":motion["movesSha256"],"reachSha256":motion["reachSha256"],
        "inspected":False,"peakRssBytes":memory("review-finished"),
        "reviewGeometryOnly":label=="source","masterUntouched":True,
        "renderSettings":{"engine":"CYCLES","device":"CPU","claySize":640,
            "claySamples":12,"materialSamples":24,"denoising":False,
            "persistentData":False,"maxBounces":4},
        "renders":rendered},indent=2)+"\n")


def main():
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["master","v4"]
    action=args[0];version=args[1] if len(args)>1 else "v4"
    BASE.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    if action in ("master","review","runtime"):
        label="runtime" if action=="runtime" else "source"
        out=BASE/(label+"-"+version)
        out.mkdir(parents=True,exist_ok=True)
        (out/"render-index.json").write_text(json.dumps({
            "stage":label,"version":version,"state":"preparing",
            "complete":False,"inspected":False,"renders":[]},indent=2)+"\n")
    if action=="master":
        motion_poses(version)
        kit.reset(seed=33);root=build_master()
        memory("master-built")
        keep=set(kit.descendants(root))
        for obj in list(bpy.data.objects):
            if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(BASE/("diver-master-"+version+".blend")),compress=True)
        review(root,"source",version)
    elif action=="runtime":
        from figure_diver_runtime import reduce_reviewed_master
        if os.environ.get("DIVER_SOURCE_REVIEWED")!="1":
            raise RuntimeError("Open and review the real Diver source first; root sets DIVER_SOURCE_REVIEWED=1 for the separate runtime step")
        validate_review_index("source",version)
        source_inspection(version)
        root=reduce_reviewed_master(BASE/("diver-master-"+version+".blend"),
                                   BASE/("diver-runtime-"+version+".blend"),memory=memory)
        memory("runtime-reduced")
        review(root,"runtime",version)
    elif action=="review":
        bpy.ops.wm.open_mainfile(filepath=str(BASE/("diver-master-"+version+".blend")))
        review(bpy.data.objects["diver"],"source",version)
    elif action=="export":
        validate_review_index("runtime",version)
        bpy.ops.wm.open_mainfile(filepath=str(BASE/("diver-runtime-"+version+".blend")))
        root=bpy.data.objects["diver"]
        validate_source(root)
        kit.export([root],str(BASE/("diver-"+version+".glb")))
        memory("dev-export")
    else:
        raise ValueError("master, runtime, review or export required")


if __name__=="__main__":main()
