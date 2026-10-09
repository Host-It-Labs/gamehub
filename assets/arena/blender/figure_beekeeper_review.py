"""Scoped source/reduction/review driver, no shared or shipped asset writes.

Source: Blender -b --factory-startup -t 3 --python this.py -- --stage source
After source inspection: ... -- --stage runtime --accept-source
Fresh source never silently replaces a reviewed runtime. JPEG review evidence,
one detailed master and one frozen copy respect this round's disk limit.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import kit
import figure_folk_kit as fk
from figure_beekeeper_sculpt import build_master, R

ROOT=HERE.parents[2]
WORK=ROOT/"work/arena/2026-10-08-roster/beekeeper"
MASTER=WORK/"beekeeper-master-v1.blend"
REVISION="v2"
SOURCE_GATE=WORK/f"source-review-gate-{REVISION}.json"


def source_fingerprint():
    digest=hashlib.sha256()
    for name in ("figure_beekeeper_sculpt.py","figure_folk_kit.py","kit.py"):
        digest.update(name.encode());digest.update((HERE/name).read_bytes())
    return digest.hexdigest()


def reset_pose(root,pose=None):
    for o in kit.descendants(root):
        if o.type=="ARMATURE":
            for b in o.pose.bones:
                b.rotation_mode="QUATERNION"
                value=(pose or {}).get(b.name.split(".",1)[1],(0,0,0))
                q=value if hasattr(value,"to_euler") else fk.runtime_quat(*value)
                # A bone that points +Z still has Blender's local +Y
                # longitudinal frame. Conjugate the root-axis pose into
                # that bind frame; the old driver rotated the real arms
                # around the wrong axes while CPU views looked plausible.
                rest=b.bone.matrix_local.to_quaternion()
                b.rotation_quaternion=rest.inverted()@q@rest
    kit.refresh()


def hold_smoker(pose):
    """Keep the whole closed grip upright in static range checks too."""
    held=fk.runtime_quat(*pose.get("torso",(0,0,0)))
    for name in ("chest","clavR","armR","foreR"):
        held=held@fk.runtime_quat(*pose.get(name,(0,0,0)))
    pose["handR"]=held.inverted()
    return pose


def bounds(root):
    dg=bpy.context.evaluated_depsgraph_get();pts=[]
    for o in kit.descendants(root):
        if o.type=="MESH":
            e=o.evaluated_get(dg)
            pts.extend(e.matrix_world@v.co for v in e.data.vertices)
    lo=Vector([min(p[j] for p in pts) for j in range(3)])
    hi=Vector([max(p[j] for p in pts) for j in range(3)])
    return lo,hi


def studio(resolution=960,samples=24):
    scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.device="CPU"
    scene.cycles.samples=samples;scene.cycles.use_denoising=True
    scene.render.image_settings.file_format="JPEG";scene.render.image_settings.quality=92
    scene.render.resolution_x=scene.render.resolution_y=resolution
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform="AgX"
    world=bpy.data.worlds.new("Beekeeper neutral review world");world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=(.32,.35,.40,1)
    world.node_tree.nodes["Background"].inputs[1].default_value=.35;scene.world=world
    for name,pos,power,size in [("key",(-2,3,4),220,3),("fill",(2,2,2),95,2),
                                ("rim",(.4,-3,3),160,2)]:
        data=bpy.data.lights.new("__bk-"+name,"AREA");data.energy=power;data.shape="DISK";data.size=size
        o=bpy.data.objects.new(data.name,data);scene.collection.objects.link(o);o.location=pos
        o.rotation_euler=(Vector((0,0,.70))-o.location).to_track_quat("-Z","Y").to_euler()
    mat=bpy.data.materials.new("__bk-clay");mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(.45,.43,.40,1);bsdf.inputs["Roughness"].default_value=.76
    return mat


def render(root,path,az=0,el=6,clay=None,focus=None,span=None):
    reset=[(o,o.hide_render) for o in bpy.context.scene.objects if o.name.startswith("__bk-")]
    lo,hi=bounds(root);centre=(lo+hi)/2
    if focus:centre=Vector(focus)
    el,az=math.radians(el),math.radians(az)
    direction=Vector((math.sin(az)*math.cos(el),math.cos(az)*math.cos(el),math.sin(el)))
    data=bpy.data.cameras.new("__bk-review-camera");data.type="ORTHO"
    data.ortho_scale=span or max(hi.z-lo.z,(hi-lo).length*.68)*1.14
    cam=bpy.data.objects.new(data.name,data);bpy.context.scene.collection.objects.link(cam)
    cam.location=centre+direction*5;cam.rotation_euler=(centre-cam.location).to_track_quat("-Z","Y").to_euler()
    scene=bpy.context.scene;scene.camera=cam
    scene.view_layers[0].material_override=clay
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    scene.view_layers[0].material_override=None;bpy.data.objects.remove(cam,do_unlink=True)


def review(root,prefix,clay=None,resolution=960,samples=24):
    if clay is None:clay=studio(resolution,samples)
    paths=[]
    for name,az,el in [("front",0,5),("side",90,5),("rear",180,5),
                       ("three",32,9),("game",24,55)]:
        path=WORK/f"{prefix}-clay-{name}.jpg";render(root,path,az,el,clay);paths.append(str(path.relative_to(ROOT)))
    for name,focus,span,az in [("face",(0,.02,1.160),.36,18),
                              ("face-side",(0,.02,1.160),.31,85),
                              ("glove",(.190,.090,.478),.24,65),
                              ("glove-front",(.190,.090,.478),.22,5),
                              ("glove-left",(-.190,.054,.478),.23,-55),
                              ("hair-rear",(0,-.095,1.192),.32,160)]:
        path=WORK/f"{prefix}-clay-{name}.jpg";render(root,path,az,9,clay,focus,span);paths.append(str(path.relative_to(ROOT)))
    poses={
        "arm-forward":{"clavR":(.05,0,.04),"armR":(2.08,0,0),"foreR":(.12,0,0)},
        "arm-out":{"clavR":(0,0,.08),"armR":(.10,0,1.73),"foreR":(.20,0,0)},
        "elbow-deep":{"armR":(.26,0,.14),"foreR":(2.12,0,0),"handR":(-.35,0,0)},
        "knee-deep":{"legR":(1.13,0,.07),"kneeR":(-2.10,0,0),"footR":(.55,0,0)},
        # Retain the uncoupled garment stress pose above, then evaluate
        # the same 120-degree knee with the motion's 90% thigh-following
        # skirt. A resting skirt over a raised thigh is not the live pose.
        "knee-deep-dressed":{"legR":(1.13,0,.07),"kneeR":(-2.10,0,0),
                             "footR":(.55,0,0),"skirtR":(1.13*.90,0,0)},
        "release":{"torso":(-.035,.025,0),"chest":(-.030,.040,0),
                   "armR":(.69,0,.03),"foreR":(.43,0,0),"handR":(-1.12,0,0),
                   "armL":(1.03,-.18,-.45),"foreL":(1.03,0,0),"handL":(-.42,.38,0)},
    }
    # Use the current parked animator's shared-reach numerical goals.
    # This static fixture checks source geometry under those goals; it is
    # not a sampled renderer frame or proof of the live spring contact.
    release=WORK/"beekeeper-release-pose.json"
    if not release.is_file():raise FileNotFoundError("Current shared-reach release fixture is missing: "+str(release))
    fixture=json.loads(release.read_text())
    current=hashlib.sha256((HERE/"figure_beekeeper_sculpt.py").read_bytes()).hexdigest()
    if fixture.get("sourceRigSHA256")!=current:
        raise RuntimeError("Release fixture is stale for this source; regenerate c2-motion-check.mjs first")
    poses["release"]=fixture["pose"]
    for name,pose in poses.items():
        if name in ("arm-forward","arm-out","elbow-deep"):hold_smoker(pose)
        reset_pose(root,pose)
        path=WORK/f"{prefix}-clay-{name}.jpg";render(root,path,45,8,clay);paths.append(str(path.relative_to(ROOT)))
        if name in ("arm-forward","elbow-deep"):
            path=WORK/f"{prefix}-clay-{name}-side.jpg";render(root,path,90,5,clay);paths.append(str(path.relative_to(ROOT)))
        if name=="release":
            for suffix,az,focus,span in [("side",90,None,None),
                                        ("grips",25,(.07,.32,.78),.36)]:
                path=WORK/f"{prefix}-clay-release-{suffix}.jpg"
                render(root,path,az,8,clay,focus,span);paths.append(str(path.relative_to(ROOT)))
    reset_pose(root)
    for name,az,focus,span in [("three",32,None,None),("face",18,(0,.02,1.160),.36),
                                ("face-side",85,(0,.02,1.160),.31),
                                ("glove",65,(.190,.090,.478),.24),
                                ("glove-front",5,(.190,.090,.478),.22),
                                ("glove-left",-55,(-.190,.054,.478),.23),
                                ("hair-rear",160,(0,-.095,1.192),.32),
                                ("hat",32,(0,-.006,1.265),.44),
                                ("hive",150,(0,-.17,.91),.46)]:
        path=WORK/f"{prefix}-material-{name}.jpg";render(root,path,az,9,None,focus,span);paths.append(str(path.relative_to(ROOT)))
    if prefix.startswith("runtime-"):
        paths.extend(review_grip(root,prefix,clay))
    reset_pose(root)
    return paths


def review_grip(root,prefix,clay):
    """Show the actual plate edge, which the straight front can obscures."""
    paths=[];reset_pose(root)
    for name,az,material in [("clay-glove-edge",90,clay),
                             ("material-glove-edge",90,None),
                             ("material-glove-rear",135,None),
                             ("material-glove-top",70,None)]:
        path=WORK/f"{prefix}-{name}.jpg"
        render(root,path,az,26 if name.endswith("top") else 9,material,
               (.210,.090,.488),.18)
        paths.append(str(path.relative_to(ROOT)))
    fixture=json.loads((WORK/"beekeeper-release-pose.json").read_text())
    reset_pose(root,fixture["pose"])
    path=WORK/f"{prefix}-material-release-grips.jpg"
    render(root,path,25,8,None,(.07,.32,.78),.36)
    paths.append(str(path.relative_to(ROOT)));reset_pose(root)
    return paths


def report(root,paths,stage,grip_paths=None,cache=None):
    lo,hi=bounds(root)
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons)
             for o in kit.descendants(root) if o.type=="MESH")
    info={"stage":stage,"revision":REVISION,"sourceFingerprint":source_fingerprint(),
          "blenderSize":list(hi-lo),"min":list(lo),"max":list(hi),
          "triangles":tris,"renders":paths,
          "motionFixture":"beekeeper-release-pose.json",
          "motionFixtureKind":"static shared-reach goals, not renderer spring frames",
          "inspectionStatus":"Awaiting author and independent root visual inspection"}
    if stage=="runtime":
        meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
        skin=[o for o in meshes if any(m.type=="ARMATURE" for m in o.modifiers)]
        errors=[];influences=[]
        for o in meshes:
            colors=list(o.data.color_attributes)
            if len(colors)!=1 or colors[0].name!="AO":
                raise RuntimeError("Runtime must export exactly one AO/pigment color: "+o.name)
        for o in skin:
            for vertex in o.data.vertices:
                weights=[g.weight for g in vertex.groups if g.weight>0]
                errors.append(abs(sum(weights)-1));influences.append(len(weights))
        if max(errors,default=0)>2e-5 or max(influences,default=0)>4:
            raise RuntimeError("Runtime skin weights must be normalized with at most four influences")
        baseline=(.43771781,.57369242,1.31647232)
        delta=[float(v)/old-1 for v,old in zip(hi-lo,baseline)]
        if any(abs(d)>.08 for d in delta):
            raise RuntimeError("Runtime exceeds the native size contract: "+str(delta))
        info.update({"gripMasterRenders":grip_paths or [],
                     "runtimeCopy":str(cache.relative_to(ROOT)),
                     "runtimeSHA256":hashlib.sha256(cache.read_bytes()).hexdigest(),
                     "runtimeRecipeFingerprint":root.get("runtimeRecipeFingerprint"),
                     "runtimeGripRepair":root.get("runtimeGripRepair"),
                     "meshCount":len(meshes),"skinMeshCount":len(skin),
                     "maxWeightSumError":max(errors,default=0),
                     "maxSkinInfluences":max(influences,default=0),
                     "exportColor":"One active AO/pigment COLOR_0 per mesh",
                     "baseline":"Measured figures-678b3116.glb, not a fresh export",
                     "sizeDeltaFraction":delta,
                     "devGLB":"public/3d/arena/dev/beekeeper-v2.glb",
                     "devExport":"Next: ordinary figures.py collector; not exported by this stage",
                     "runtimeAccepted":False})
    (WORK/f"{stage}-metrics-{REVISION}.json").write_text(json.dumps(info,indent=2)+"\n")
    if stage=="source":
        SOURCE_GATE.write_text(json.dumps({"accepted":False,
            "sourceFingerprint":info["sourceFingerprint"],"inspected":[],"observations":[],
            "requiredRenders":paths,
            "reason":"New real Blender source renders need Codex C2 and root inspection"},indent=2)+"\n")
    print(json.dumps(info,indent=2))


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--stage",choices=["source","runtime"],default="source")
    parser.add_argument("--accept-source",action="store_true");parser.add_argument("--reuse",action="store_true")
    parser.add_argument("--resolution",type=int,default=960)
    parser.add_argument("--samples",type=int,default=24)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    WORK.mkdir(parents=True,exist_ok=True);bpy.context.preferences.filepaths.save_version=0
    if args.stage=="source":
        if args.reuse and MASTER.is_file():
            bpy.ops.wm.open_mainfile(filepath=str(MASTER));root=bpy.data.objects[R]
            if root.get("sourceFingerprint")!=source_fingerprint():
                raise RuntimeError("Master is stale; rebuild source without --reuse")
        else:
            kit.reset(seed=83);root=build_master()
            root["sourceFingerprint"]=source_fingerprint();root["sourceRevision"]=REVISION
            reset_pose(root);bpy.ops.wm.save_as_mainfile(filepath=str(MASTER),compress=True)
        paths=review(root,"source-"+REVISION,resolution=args.resolution,samples=args.samples);report(root,paths,"source")
    else:
        if not args.accept_source:raise RuntimeError("Inspect the source renders before using --accept-source")
        if not SOURCE_GATE.is_file():raise RuntimeError("Source review gate is missing; render source first")
        gate=json.loads(SOURCE_GATE.read_text())
        if not gate.get("accepted") or gate.get("sourceFingerprint")!=source_fingerprint():
            raise RuntimeError("Current source must pass real-render inspection before runtime reduction")
        if not gate.get("inspected") or not gate.get("observations"):
            raise RuntimeError("Source gate requires actual inspected images and concrete observations")
        if not MASTER.is_file():raise FileNotFoundError(MASTER)
        bpy.ops.wm.open_mainfile(filepath=str(MASTER));root=bpy.data.objects[R]
        if root.get("sourceFingerprint")!=source_fingerprint():raise RuntimeError("Reviewed master is stale")
        from figure_beekeeper_runtime import prepare_copy,build_copy,save_cache
        # The accepted master remains untouched on disk. Review the local
        # repaired grip at full detail before its separate runtime reduction.
        root=prepare_copy(root)
        clay=studio(args.resolution,args.samples)
        grip_paths=review_grip(root,"runtime-grip-master-"+REVISION,clay)
        root=build_copy(root,prepared=True);cache=save_cache(root)
        paths=review(root,"runtime-"+REVISION,clay=clay)
        report(root,paths,"runtime",grip_paths,cache)


if __name__=="__main__":main()
