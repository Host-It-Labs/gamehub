"""Private serial Firefighter source/runtime review and export driver.

Blender --python figure_firefighter_review.py -- master|review|runtime|export v1
Full editable master is saved first. Source-sheet geometry is a temporary
evaluated/decimated render copy, never a replacement for that saved master.
"""
import gc
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import subprocess
import sys

import bpy
from mathutils import Quaternion, Vector

SOURCE = Path(__file__).resolve().parent
PROJECT = SOURCE.parents[2]
sys.path.insert(0,str(SOURCE))
import kit
import figure_folk_kit as geo
from figure_firefighter_sculpt import BASE, R, build_master, select

MEMORY_LOG = []
PROVENANCE_KEYS = ("sculptSha256","movesSha256","reachSha256")
EXTREMES = {
    "neutral":{},
    "arm-forward":{"armR":(2.10,0,0),"foreR":(.20,0,0)},
    "arm-side":{"armL":(.06,0,-1.75),"foreL":(.25,0,0)},
    "elbow-deep":{"armR":(.62,0,.12),"foreR":(2.05,0,0)},
    "knee-deep":{"legL":(1.05,0,0),"kneeL":(-2.10,0,0),"footL":(.62,0,0)},
}


def invalidate_index(label, version):
    out = BASE/(label+"-"+version)
    out.mkdir(parents=True,exist_ok=True)
    index = {"stage":label,"version":version,"complete":False,"status":"running",
             "inspected":False,"renderOnlyReduction":label=="source","renders":[]}
    (out/"render-index.json").write_text(json.dumps(index,indent=2)+"\n")
    return out,index


def memory(stage):
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak = raw if sys.platform == "darwin" else raw*1024
    try:
        current = int(subprocess.check_output(["ps","-o","rss=","-p",str(os.getpid())],text=True).strip())*1024
    except (OSError,ValueError,subprocess.SubprocessError):
        current = None
    record = {"stage":stage,"currentRssBytes":current,"peakRssBytes":peak}
    MEMORY_LOG.append(record)
    print("FIREFIGHTER_MEMORY",json.dumps(record),flush=True)
    limit = float(os.environ.get("FIREFIGHTER_MEMORY_LIMIT","8"))*1024**3
    if peak > limit:
        raise MemoryError(f"Firefighter review exceeded {limit/1024**3:.2f} GiB; stop and inspect private geometry/memory before another serial run")
    return record


def motion_record(version):
    path = BASE/("review-poses-"+version+".json")
    record = json.loads(path.read_text())
    for file,key in ((SOURCE/"figure_firefighter_sculpt.py","sculptSha256"),
                     (BASE/"moves-firefighter-next.ts","movesSha256"),
                     (PROJECT/"components/game/arena/moves/reach.ts","reachSha256")):
        if hashlib.sha256(file.read_bytes()).hexdigest() != record[key]:
            raise RuntimeError("Firefighter motion poses are stale; rerun node "+str(BASE/"probe-next.mjs"))
    return record


def motion_poses(version):
    return motion_record(version)["poses"]


def require_provenance(index, record, label):
    for key in PROVENANCE_KEYS:
        if index.get(key) != record[key]:
            raise RuntimeError(f"Firefighter {label} has stale {key}; re-render the current source/motion before continuing")


def complete_index(label, version):
    record = motion_record(version)
    out = BASE/(label+"-"+version)
    index = json.loads((out/"render-index.json").read_text())
    if index.get("complete") is not True or index.get("status") != "complete":
        raise RuntimeError(f"Firefighter {label} review is incomplete; finish and inspect its current renders first")
    if index.get("stage") != label or index.get("version") != version:
        raise RuntimeError(f"Firefighter {label} review index does not match the requested stage/version")
    require_provenance(index,record,label+" review index")
    if not index.get("renders") or any(not (out/name).is_file() for name in index["renders"]):
        raise RuntimeError(f"Firefighter {label} review index is missing its rendered evidence")
    measured = json.loads((out/"measurements.json").read_text())
    if not measured.get("withinEightPercent"):
        raise RuntimeError(f"Firefighter {label} dimensions exceed the eight percent native tolerance")
    return index


def validate_source(root):
    current = hashlib.sha256((SOURCE/"figure_firefighter_sculpt.py").read_bytes()).hexdigest()
    if root.get("sculptSha256") != current:
        raise RuntimeError("Firefighter master/runtime is stale; rebuild source and re-review before using this copy")


def pose(rig, values):
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion()
        bone.location = (0,0,0)
        bone.scale = (1,1,1)
    for name,angles in values.items():
        bone = rig.pose.bones[R+"."+name]
        frame = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = frame.inverted()@geo.runtime_quat(*angles[:3])@frame
    kit.refresh()


def geometry(root):
    dg = bpy.context.evaluated_depsgraph_get()
    result = []
    for obj in kit.descendants(root):
        if obj.type != "MESH":continue
        data = obj.evaluated_get(dg).data
        result.append({"name":obj.name,"vertices":len(data.vertices),
                       "triangles":sum(len(p.vertices)-2 for p in data.polygons)})
    return {"vertices":sum(o["vertices"] for o in result),
            "triangles":sum(o["triangles"] for o in result),"components":result}


def render_copy(root):
    # Apply source topology in memory only after the editable master has
    # been saved. No render-level surprise, displacement or denoiser buffer.
    from figure_firefighter_runtime import evaluate_geometry, reduce
    before = geometry(root)
    before_bounds = bounds(root)
    memory("before-review-evaluation")
    evaluate_geometry(root)
    memory("after-review-evaluation")
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    total = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
    cap = int(os.environ.get("FIREFIGHTER_REVIEW_TRIANGLES","260000"))
    small = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes
                if sum(len(p.vertices)-2 for p in o.data.polygons)<240)
    # Reserve half a percent for collapse rounding and retain small fittings.
    ratio = min(1,max(0,cap*.995-small)/max(1,total-small))
    records = []
    for obj in meshes:
        triangles = sum(len(p.vertices)-2 for p in obj.data.polygons)
        # Tiny fittings never dominate review memory; retain their contours.
        if triangles < 240 or ratio >= 1:continue
        # The transient review gets the same sampled source normals/colour
        # protection as the runtime. Raw decimation changes clay shading.
        records.append(reduce(obj,max(8,int(triangles*ratio))))
    for data in list(bpy.data.meshes):
        if data.users==0:bpy.data.meshes.remove(data)
    gc.collect()
    after = geometry(root)
    after_bounds = bounds(root)
    memory("after-review-only-reduction")
    drift = {key:after_bounds[key]/before_bounds[key]-1 for key in ("width","height","depth")}
    record = {"masterPreservedOnDisk":True,"renderOnly":True,"cap":cap,"before":before,"after":after,
              "beforeBounds":before_bounds,"afterBounds":after_bounds,"dimensionDrift":drift,"reductions":records}
    if after["triangles"] > cap:
        raise RuntimeError("Firefighter actual review triangles exceed the private cap")
    edge_drift = max(abs(after_bounds[edge][i]-before_bounds[edge][i])
                     for edge in ("min","max") for i in range(3))
    record["maximumEdgeDrift"] = edge_drift
    if edge_drift>.003:
        raise RuntimeError("Firefighter transient review lost native silhouette bounds; lower the reduction or inspect its components")
    print("FIREFIGHTER_REVIEW_GEOMETRY",json.dumps({"before":before["triangles"],"after":after["triangles"],"cap":cap}),flush=True)
    return record


def bounds(root):
    dg = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in kit.descendants(root):
        if obj.type != "MESH":continue
        ev = obj.evaluated_get(dg)
        points.extend(ev.matrix_world@Vector(c) for c in ev.bound_box)
    lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    record = {"min":list(lo),"max":list(hi),"width":hi.x-lo.x,"height":hi.z-lo.z,"depth":hi.y-lo.y}
    baseline = json.loads((BASE/"baseline.json").read_text())
    record["baselineRatios"] = {key:record[key]/baseline[key] for key in ("width","height","depth")}
    record["withinEightPercent"] = all(.92 <= value <= 1.08 for value in record["baselineRatios"].values())
    return record


def studio(root):
    scene = bpy.context.scene
    for obj in kit.descendants(root):
        for mod in obj.modifiers:
            if mod.type == "SUBSURF":mod.render_levels = mod.levels
        if obj.type == "MESH":
            for material in obj.data.materials:
                bsdf = material.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Transmission Weight"].default_value = 0
                    bsdf.inputs["Subsurface Weight"].default_value = 0
    scene.render.engine = "CYCLES"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 3
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 3
    scene.cycles.transmission_bounces = 0
    scene.render.use_persistent_data = False
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Firefighter neutral studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.16,.17,.19,1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .45
    for name,at,energy,size in (("key",(-2.3,2.8,3.7),110,2),
                               ("fill",(2.5,2.5,2.1),42,2.4),("rim",(.8,-2.5,3.1),85,2)):
        data = bpy.data.lights.new("firefighter-review-"+name,"AREA")
        obj = bpy.data.objects.new(data.name,data)
        scene.collection.objects.link(obj)
        obj.location = at
        data.energy,data.size = energy,size
        obj.rotation_euler = (Vector((0,0,.8))-obj.location).to_track_quat("-Z","Y").to_euler()
    floor = kit.box("firefighter-review-floor",(200,200,.01),(0,0,-.006),mat="plain:grey",grid=False)
    floor.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .95
    data = bpy.data.cameras.new("Firefighter honest review camera")
    camera = bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type = "ORTHO"
    data.clip_start,data.clip_end = .01,200
    clay = bpy.data.materials.new("firefighter-review-neutral-clay")
    clay.use_nodes = True
    bsdf = clay.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (.36,.38,.39,1)
    bsdf.inputs["Roughness"].default_value = .78
    bsdf.inputs["Specular IOR Level"].default_value = .22
    return scene,camera,clay


def review(root, label, version):
    out,index = invalidate_index(label,version)
    validate_source(root)
    stopped = motion_record(version)
    index.update({key:stopped[key] for key in PROVENANCE_KEYS})
    poses = {**EXTREMES,**stopped["poses"]}
    rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
    pose(rig,{})
    index_path = out/"render-index.json"
    measured = bounds(root)
    (out/"measurements.json").write_text(json.dumps(measured,indent=2)+"\n")
    if not measured["withinEightPercent"]:
        # Diagnose the actual source with images; its runtime step remains
        # blocked on these measurements, rather than globally resizing it.
        index["dimensionFailure"] = measured["baselineRatios"]
    source_geometry = geometry(root)
    render_geometry = render_copy(root) if label == "source" else {"renderOnly":False,"before":source_geometry,"after":source_geometry}
    (out/"geometry.json").write_text(json.dumps(render_geometry,indent=2)+"\n")
    scene,camera,clay = studio(root)
    slots = {o:list(o.data.materials) for o in kit.descendants(root) if o.type == "MESH"}
    def render(name,az,el,target=None,scale=1.62,colour=False,size=640):
        for obj,mats in slots.items():
            obj.data.materials.clear()
            for mat in mats:obj.data.materials.append(mat if colour else clay)
        at = Vector(target or (0,-.035,.70))
        az,el = math.radians(az),math.radians(el)
        camera.location = at+Vector((math.sin(az)*math.cos(el)*3,
            math.cos(az)*math.cos(el)*3,math.sin(el)*3))
        camera.rotation_euler = (at-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.ortho_scale = scale
        scene.cycles.samples = 24 if colour else 12
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.render.filepath = str(out/(name+".jpg"))
        memory("before-"+name)
        bpy.ops.render.render(write_still=True)
        memory(name)
        print("FIREFIGHTER_REVIEW",scene.render.filepath,flush=True)
        index["renders"].append(name+".jpg")
        index["memory"] = MEMORY_LOG
        index_path.write_text(json.dumps(index,indent=2)+"\n")
    for name,az,el in (("front",0,8),("side",90,8),("rear",180,8),("three",35,15),("game",35,55)):
        render("clay-"+name,az,el)
    render("clay-face",8,10,(0,.060,1.192),.38)
    render("clay-hand",58,12,(.265,.092,.481),.24)
    render("clay-nozzle",75,14,(.227,.294,.506),.70)
    render("clay-boots",30,12,(0,.036,.188),.57)
    for name in ("arm-forward","arm-side","elbow-deep","knee-deep","spray-wind","spray-pressure","spray-recovery","tool-inspect"):
        pose(rig,poses[name])
        render("clay-"+name,35 if name != "elbow-deep" else 90,12,(0,0,.80),1.94)
    pose(rig,{})
    render("material-three",35,16,colour=True)
    render("material-face",8,10,(0,.060,1.192),.38,colour=True)
    render("material-hand",58,12,(.265,.092,.481),.24,colour=True)
    render("material-nozzle",75,14,(.227,.294,.506),.70,colour=True)
    render("material-boots",30,12,(0,.036,.188),.57,colour=True)
    render("material-game",35,55,colour=True,size=320)
    render("material-small-game",35,55,colour=True,size=192)
    render("clay-small-phone",35,70,size=192)
    render("material-small-phone",35,70,colour=True,size=192)
    pose(rig,poses["spray-pressure"])
    render("material-spray-game",35,55,(0,.045,.70),1.62,colour=True,size=320)
    for obj,mats in slots.items():
        obj.data.materials.clear()
        for mat in mats:obj.data.materials.append(mat)
    pose(rig,{})
    memory("review-finished")
    # Concurrent source, draft or shared-solver edits during a long render
    # cannot turn older stopped poses into current completed evidence.
    validate_source(root)
    require_provenance(index,motion_record(version),label+" completed review")
    index["complete"],index["status"],index["memory"] = True,"complete",MEMORY_LOG
    index_path.write_text(json.dumps(index,indent=2)+"\n")


def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["master","v1"]
    action,version = args[0],args[1] if len(args)>1 else "v1"
    BASE.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    master = BASE/("firefighter-master-"+version+".blend")
    if action in ("master","review","runtime"):
        # Do this before hashes, environment gates, opening files or build
        # errors: an unsuccessful rerun cannot inherit a completed gallery.
        invalidate_index("runtime" if action=="runtime" else "source",version)
    if action == "master":
        motion_poses(version)
        kit.reset(seed=39)
        root = build_master()
        root["sculptSha256"] = hashlib.sha256((SOURCE/"figure_firefighter_sculpt.py").read_bytes()).hexdigest()
        root["editableMasterGeometry"] = json.dumps(geometry(root))
        memory("master-built")
        keep = set(kit.descendants(root))
        for obj in list(bpy.data.objects):
            if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
        memory("master-saved")
        review(root,"source",version)
    elif action == "review":
        bpy.ops.wm.open_mainfile(filepath=str(master))
        review(bpy.data.objects[R],"source",version)
    elif action == "runtime":
        if os.environ.get("FIREFIGHTER_SOURCE_REVIEWED") != "1":
            raise RuntimeError("Open and review the source first; root sets FIREFIGHTER_SOURCE_REVIEWED=1 for the separate runtime step")
        # A refreshed moves/reach pose record cannot make an older complete
        # source gallery eligible for reduction without new source images.
        complete_index("source",version)
        from figure_firefighter_runtime import reduce_reviewed_master
        root = reduce_reviewed_master(master,BASE/("firefighter-runtime-"+version+".blend"),memory)
        review(root,"runtime",version)
    elif action == "export":
        complete_index("runtime",version)
        bpy.ops.wm.open_mainfile(filepath=str(BASE/("firefighter-runtime-"+version+".blend")))
        root = bpy.data.objects[R]
        validate_source(root)
        kit.export([root],str(BASE/("firefighter-"+version+".glb")))
        memory("private-dev-export")
    else:
        raise ValueError("master, review, runtime or export required")


if __name__ == "__main__":main()
