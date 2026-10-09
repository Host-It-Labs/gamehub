"""Explorer-only serial source/runtime review driver; no live asset switch.

Blender --python figure_explorer_review.py -- master|review|runtime|export v2
Save detailed source BEFORE temporary bounded review geometry. Real images
must be opened before a separate runtime reduction is allowed.
"""
import gc
import json
import math
import os
from pathlib import Path
import resource
import subprocess
import sys
import time

import bpy
from mathutils import Quaternion, Vector

SOURCE = Path(__file__).resolve().parent
PROJECT = SOURCE.parents[2]
sys.path.insert(0,str(SOURCE))
import kit
import figure_folk_kit as geo
from figure_explorer_sculpt import BASE, build_master
from figure_explorer_runtime import apply_topology, allocate, reduce, source_hash, validate_fingerprint, current_fingerprints, fingerprints

EXTREMES = {
    "arm-forward":{"armR":(2.10,0,0),"foreR":(.15,0,0)},
    "arm-side":{"armL":(.04,0,-1.75),"foreL":(.20,0,0)},
    "elbow-deep":{"armR":(.58,0,.12),"foreR":(2.17,0,0)},
    "knee-deep":{"legL":(1.05,0,0),"kneeL":(-2.10,0,0),"footL":(.65,0,0)},
}


def memory(stage):
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak = raw if sys.platform == "darwin" else raw*1024
    current = None
    try: current = int(subprocess.check_output(["ps","-o","rss=","-p",str(os.getpid())],text=True).strip())*1024
    except (OSError,ValueError,subprocess.SubprocessError): pass
    print("EXPLORER_MEMORY",stage,"peak",round(peak/1024**3,3),"GiB current",
          round(current/1024**3,3) if current is not None else "unknown","GiB",flush=True)
    limit = float(os.environ.get("EXPLORER_MEMORY_LIMIT","8"))
    if not 0<limit<=8:raise ValueError("Explorer memory limit must be at most 8 GiB")
    if peak > limit*1024**3: raise MemoryError(f"Explorer {stage} exceeds{limit} GiB; inspect geometry/memory logs before retrying")
    return {"peakBytes":peak,"currentBytes":current}


def motion_poses(version):
    record = json.loads((BASE/("review-poses-"+version+".json")).read_text())
    fingerprints(version)
    return record["poses"]


def pose(rig, values):
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"; bone.rotation_quaternion = Quaternion()
        bone.location = (0,0,0); bone.scale = (1,1,1)
    for name, angles in values.items():
        bone = rig.pose.bones["explorer."+name]
        frame = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = frame.inverted()@geo.runtime_quat(*angles[:3])@frame
    kit.refresh()


def geometry(root, evaluated=False):
    dg = bpy.context.evaluated_depsgraph_get() if evaluated else None
    rows = []
    for obj in kit.descendants(root):
        if obj.type != "MESH": continue
        data = obj.evaluated_get(dg).data if evaluated else obj.data
        rows.append({"name":obj.name,"vertices":len(data.vertices),
            "triangles":sum(len(poly.vertices)-2 for poly in data.polygons)})
    return {"meshNodes":len(rows),"vertices":sum(r["vertices"] for r in rows),
            "triangles":sum(r["triangles"] for r in rows),"components":rows}


def bounds(root):
    dg = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in kit.descendants(root):
        if obj.type == "MESH":
            ev = obj.evaluated_get(dg)
            points.extend(ev.matrix_world@Vector(corner) for corner in ev.bound_box)
    lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    return lo,hi


def prepare_transient(root, label):
    raw = geometry(root); full = geometry(root,evaluated=True)
    memory("evaluated-master")
    if label == "source":
        meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
        for obj in meshes: apply_topology(obj)
        targets = allocate(meshes,limit=200000,review=True)
        for obj,target in targets.items(): reduce(obj,target)
        for data in list(bpy.data.meshes):
            if data.users==0:bpy.data.meshes.remove(data)
        kit.refresh(); gc.collect(); memory("transient-review-copy")
    after = geometry(root,evaluated=True)
    if label == "source" and after["triangles"] > 200256: raise RuntimeError("Explorer transient review exceeds200k")
    print("EXPLORER_GEOMETRY",json.dumps({"raw":raw["triangles"],"evaluatedMaster":full["triangles"],
                                        "renderCopy":after["triangles"]}),flush=True)
    return {"raw":raw,"evaluatedMaster":full,"renderCopy":after,"transientOnly":label == "source"}


def studio():
    scene = bpy.context.scene
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            if mod.type == "SUBSURF": mod.render_levels = mod.levels
    scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"
    scene.render.threads_mode = "FIXED"; scene.render.threads = 3
    scene.cycles.samples = 12; scene.cycles.use_denoising = False
    scene.render.use_persistent_data = False
    scene.cycles.max_bounces = 4; scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2; scene.cycles.transmission_bounces = 0
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.quality = 88
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Explorer neutral studio"); scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.16,.17,.19,1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .42
    for name,at,energy,size in (("key",(-2.3,2.7,3.7),110,2),
                              ("fill",(2.6,2.2,2.0),42,2.4),("rim",(.8,-2.5,3.1),85,2)):
        data = bpy.data.lights.new("explorer-review-"+name,"AREA")
        obj = bpy.data.objects.new(data.name,data); scene.collection.objects.link(obj)
        obj.location = at; data.energy = energy; data.size = size
        obj.rotation_euler = (Vector((0,0,.75))-obj.location).to_track_quat("-Z","Y").to_euler()
    floor = kit.box("explorer-review-floor",(200,200,.01),(0,0,-.006),mat="plain:grey",grid=False)
    floor.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .95
    data = bpy.data.cameras.new("Explorer source review camera")
    camera = bpy.data.objects.new(data.name,data); scene.collection.objects.link(camera)
    scene.camera = camera; data.type = "ORTHO"; data.clip_start = .01; data.clip_end = 200
    clay = bpy.data.materials.new("explorer-neutral-review-clay"); clay.use_nodes = True
    bsdf = clay.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (.36,.38,.39,1)
    bsdf.inputs["Roughness"].default_value = .78; bsdf.inputs["Specular IOR Level"].default_value = .22
    return scene,camera,clay


def review(root, label, version):
    validate_fingerprint(root)
    poses = {**EXTREMES,**motion_poses(version)}
    provenance = fingerprints(version)
    rig = next(obj for obj in kit.descendants(root) if obj.type == "ARMATURE")
    pose(rig,{})
    out = BASE/(label+"-"+version); out.mkdir(parents=True,exist_ok=True)
    index_path = out/"render-index.json"
    index = {"stage":label,"version":version,**provenance,"complete":False,
        "status":"running","inspected":False,"startedEpoch":time.time(),"renders":[]}
    def write_index(): index_path.write_text(json.dumps(index,indent=2)+"\n")
    write_index() # A failed rerun cannot inherit an old complete index.
    lo,hi = bounds(root)
    baseline = json.loads((BASE/"baseline.json").read_text())
    measurement = {"min":list(lo),"max":list(hi),"width":hi.x-lo.x,"depth":hi.y-lo.y,"height":hi.z-lo.z}
    measurement["baselineDelta"] = {key:measurement[key]/baseline[key]-1 for key in ("width","height","depth")}
    measurement["footprintWithinEightPercent"] = all(abs(v) <= .08 for v in measurement["baselineDelta"].values())
    measurement["globalRescaleApplied"] = False
    (out/"measurements.json").write_text(json.dumps(measurement,indent=2)+"\n")
    record = prepare_transient(root,label)
    copylo,copyhi = bounds(root)
    record["fullMasterBounds"] = {"min":list(lo),"max":list(hi)}
    record["reviewCopyBounds"] = {"min":list(copylo),"max":list(copyhi)}
    if max(abs(new[i]-old[i]) for new,old in ((copylo,lo),(copyhi,hi)) for i in range(3)) > .003:
        raise RuntimeError("Explorer transient reduction moves silhouette bounds over3 mm")
    (out/"geometry.json").write_text(json.dumps(record,indent=2)+"\n")
    if not measurement["footprintWithinEightPercent"]:
        index["dimensionFailure"] = measurement["baselineDelta"]
        write_index()
        # Still provide real source images to diagnose the local proportion;
        # the reducer refuses this candidate until corrected/reviewed.
    scene,camera,clay = studio()
    slots = {obj:list(obj.data.materials) for obj in kit.descendants(root) if obj.type == "MESH"}
    def render(name,az,el,target=(0,.075,.68),scale=1.55,colour=False,size=640):
        for obj,mats in slots.items():
            obj.data.materials.clear()
            for mat in mats: obj.data.materials.append(mat if colour else clay)
        at = Vector(target); az = math.radians(az); el = math.radians(el)
        camera.location = at+Vector((math.sin(az)*math.cos(el)*3,math.cos(az)*math.cos(el)*3,math.sin(el)*3))
        camera.rotation_euler = (at-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.ortho_scale = scale
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.cycles.samples = 24 if colour else 12
        memory(name+"-before")
        destination = out/(name+".jpg")
        # Only this run's successful images enter the index.
        scene.render.filepath = str(destination); bpy.ops.render.render(write_still=True)
        index["renders"].append(destination.name); index["memory"] = memory(name)
        write_index(); gc.collect()
        print("EXPLORER_REVIEW",destination,flush=True)
    for name,az,el in (("front",0,8),("game",35,55),("phone",35,70),
                       ("side",90,8),("rear",180,8),("three",35,15)):
        render("clay-"+name,az,el)
    render("clay-face",8,10,(0,.075,1.167),.39)
    render("clay-mitten",70,12,(.235,.074,.503),.26)
    render("clay-rifle",35,35,(.219,.285,.690),1.05)
    render("clay-boots",30,12,(0,.033,.160),.46)
    for name in ("arm-forward","arm-side","elbow-deep","knee-deep","rifle-raise",
                 "shot-windup","shot-impact","shot-recovery","horizon-scan"):
        pose(rig,poses[name]); render("clay-"+name,35 if name != "elbow-deep" else 90,12,
                                    target=(0,.11,.77),scale=1.85)
    pose(rig,{})
    if fingerprints(version) != provenance:
        raise RuntimeError("Explorer sculpt/motion/reach changed during the render run; rerun current review")
    render("material-three",35,15,colour=True)
    render("material-face",8,10,(0,.075,1.167),.39,colour=True)
    render("material-mitten",70,12,(.235,.074,.503),.26,colour=True)
    render("material-rifle",35,35,(.219,.285,.690),1.05,colour=True)
    render("material-boots",30,12,(0,.033,.160),.46,colour=True)
    render("material-game",35,55,colour=True,size=480)
    render("material-phone",35,70,colour=True,size=480)
    render("material-small-game",35,55,colour=True,size=192)
    render("material-small-phone",35,70,colour=True,size=192)
    for name in ("shot-windup","shot-impact","shot-recovery"):
        pose(rig,poses[name]); render("material-"+name,35,35,target=(0,.12,.77),scale=1.85,colour=True,size=480)
    for obj,mats in slots.items():
        obj.data.materials.clear()
        for mat in mats: obj.data.materials.append(mat)
    pose(rig,{})
    if fingerprints(version) != provenance:
        raise RuntimeError("Explorer sculpt/motion/reach changed during the material render run; rerun current review")
    index.update({"complete":True,"status":"complete","finishedEpoch":time.time(),
        "reviewGeometryOnly":label == "source","masterUntouched":True,
        "renderSettings":{"engine":"CYCLES","device":"CPU","threads":3,"clayPixels":640,
            "claySamples":12,"materialSamples":24,"denoiser":False,"persistentData":False,
            "transmissionBounces":0,"maxBounces":4},"memory":memory("review-finished")})
    write_index()


def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["master","v2"]
    action = args[0]; version = args[1] if len(args) > 1 else "v2"
    BASE.mkdir(parents=True,exist_ok=True); bpy.context.preferences.filepaths.save_version = 0
    if action in ("master","review","runtime"):
        label = "runtime" if action == "runtime" else "source"
        out = BASE/(label+"-"+version); out.mkdir(parents=True,exist_ok=True)
        # Invalidate BEFORE stale motion hashes, loading or building can fail.
        (out/"render-index.json").write_text(json.dumps({"stage":label,"version":version,
            "complete":False,"status":"preparing","renders":[],**current_fingerprints(),
            "startedEpoch":time.time()},indent=2)+"\n")
    if action == "master":
        provenance = fingerprints(version)
        motion_poses(version)
        kit.reset(seed=45); root = build_master()
        if fingerprints(version) != provenance:
            raise RuntimeError("Explorer source/motion/reach changed while building; rerun current master")
        root["sculptSHA256"] = provenance["sculptSha256"]; root["sourceVersion"] = version
        memory("master-built")
        keep = set(kit.descendants(root))
        for obj in list(bpy.data.objects):
            if obj not in keep: bpy.data.objects.remove(obj,do_unlink=True)
        # Source rig/topology order and colours are saved before simplification.
        bpy.ops.wm.save_as_mainfile(filepath=str(BASE/("explorer-master-"+version+".blend")),compress=True)
        review(root,"source",version)
    elif action == "review":
        bpy.ops.wm.open_mainfile(filepath=str(BASE/("explorer-master-"+version+".blend")))
        review(bpy.data.objects["explorer"],"source",version)
    elif action == "runtime":
        from figure_explorer_runtime import reduce_reviewed_master
        root = reduce_reviewed_master(BASE/("explorer-master-"+version+".blend"),
                                     BASE/("explorer-runtime-"+version+".blend"),version,memory=memory)
        memory("runtime-reduced"); review(root,"runtime",version)
    elif action == "export":
        bpy.ops.wm.open_mainfile(filepath=str(BASE/("explorer-runtime-"+version+".blend")))
        root = bpy.data.objects["explorer"]; validate_fingerprint(root)
        index = json.loads((BASE/("runtime-"+version)/"render-index.json").read_text())
        current = fingerprints(version)
        if not index.get("complete") or any(index.get(key) != value for key,value in current.items()):
            raise RuntimeError("Explorer export requires its current complete runtime review")
        if root.get("reviewMovesSHA256") != current["movesSha256"] or root.get("reviewReachSHA256") != current["reachSha256"]:
            raise RuntimeError("Explorer cached runtime predates its current motion inspection")
        kit.export([root],str(BASE/("explorer-"+version+".glb"))); memory("private-dev-export")
    else: raise ValueError("master, review, runtime or export required")


if __name__ == "__main__": main()
