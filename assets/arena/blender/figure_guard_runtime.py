"""Private runtime reducer and frozen-copy loader, after source visual review.

Every output stays in the owned figure directory. Nothing switches the live
figure or motion, and a normal load never rebuilds or reduces the master.
"""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_guard_sculpt as sculpt

R = sculpt.R
HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
WORK = PROJECT / "work/arena/2026-10-08-roster/guard"
SOURCE = WORK / "guard-master-v2.blend"
RUNTIME = WORK / "guard-runtime-v2.blend"
FACE_NAMES = tuple(R+p for p in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth"))
SOURCE_CEILING = 750000


def file_hash(path):
    digest=hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk:=stream.read(1024*1024):digest.update(chunk)
    return digest.hexdigest()


def fingerprint():
    digest=hashlib.sha256()
    for path in (HERE/"figure_guard_sculpt.py",HERE/"figure_guard_forms.py",
                 WORK/"brief.md",WORK/"baseline-v1.json",WORK/"geometry-contract-v1.json",WORK/"poses-contract-v1.json",
                 HERE/"kit.py",HERE/"figure_folk_kit.py"):
        digest.update(path.name.encode());digest.update(path.read_bytes())
    return digest.hexdigest()


def require_review(stage):
    path=WORK/(stage+"-review-gate-v2.json")
    if not path.is_file():raise RuntimeError("Open the real "+stage+" renders and record findings in "+str(path))
    gate=json.loads(path.read_text())
    if gate.get("accepted") is not True or not gate.get("inspected") or not gate.get("observations"):
        raise RuntimeError("Real visual review is pending: "+str(path))
    if gate.get("sourceFingerprint")!=fingerprint():raise RuntimeError("Reviewed source changed; rebuild and inspect it")
    if gate.get("masterSHA256")!=file_hash(SOURCE):raise RuntimeError("Master changed since visual review")
    if stage=="runtime" and gate.get("runtimeSHA256")!=file_hash(RUNTIME):
        raise RuntimeError("Frozen runtime changed since visual review")
    for artifact in gate["inspected"]:
        p=WORK/artifact
        if not p.is_file() or not p.resolve().is_relative_to(WORK.resolve()):
            raise RuntimeError("Review evidence must exist in the owned folder: "+artifact)
    return gate


def triangles(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def metrics(root):
    kit.refresh();meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    deps=bpy.context.evaluated_depsgraph_get()
    points=[]
    for obj in meshes:
        ev=obj.evaluated_get(deps)
        co=np.empty(len(ev.data.vertices)*3,dtype=np.float64)
        ev.data.vertices.foreach_get("co",co);co=co.reshape((-1,3))
        matrix=np.asarray(ev.matrix_world,dtype=np.float64)
        world=co@matrix[:3,:3].T+matrix[:3,3]
        points.extend((world.min(axis=0),world.max(axis=0)))
    p=np.asarray(points);lo,hi=p.min(axis=0),p.max(axis=0);size=hi-lo
    baseline=np.array(json.loads((WORK/"baseline-v1.json").read_text())["blenderSize"])
    return {"triangles":sum(triangles(o) for o in meshes),"meshes":len(meshes),
            "min":lo.tolist(),"max":hi.tolist(),"blenderSize":size.tolist(),
            "baselineSize":baseline.tolist(),"sizeDeltaFraction":(size/baseline-1).tolist(),
            "sourceFingerprint":fingerprint(),
            "perMesh":{o.name:{"triangles":triangles(o),"target":o.get("runtimeTriangles"),
                               "region":o.get("sourceRegion")} for o in meshes}}


def validate(root):
    rigs=[o for o in kit.descendants(root) if o.type=="ARMATURE"]
    if len(rigs)!=1:raise ValueError("Exactly one anatomical armature required")
    rig=rigs[0]
    parents={"chest":"torso","neck":"chest","head":"neck","clavL":"chest","clavR":"chest",
             "armL":"clavL","armR":"clavR","foreL":"armL","foreR":"armR","handL":"foreL","handR":"foreR",
             "kneeL":"legL","kneeR":"legR","footL":"kneeL","footR":"kneeR",
             "offhand":"handL","weapon":"handR","arrow":"weapon","wingL":"offhand","wingR":"offhand","extra2":"offhand"}
    for name in ("torso","legL","legR",*parents):
        if not rig.data.bones.get(R+"."+name):raise ValueError("Missing joint "+name)
    for name,parent in parents.items():
        bone=rig.data.bones[R+"."+name]
        if not bone.parent or bone.parent.name!=R+"."+parent:raise ValueError("Incorrect parent "+name)
    for name,position in sculpt.POSITIONS.items():
        if (rig.data.bones[R+"."+name].head_local-Vector(position)).length>1e-6:
            raise ValueError("Authored pose geometry differs from bone pivot "+name)
    poses=json.loads(root.get("poses","{}"))
    if poses!=json.loads((WORK/"poses-contract-v1.json").read_text()):
        raise ValueError("TowerCrew clips differ from the audited reach output")
    if root.get("arrowOrigin")!="nock":raise ValueError("Arrow must pivot on its nock")
    for name,part in (("stringCentre","extra2"),("stringBrace","offhand")):
        marker=bpy.data.objects.get(R+"."+name)
        if not marker or marker.parent!=rig or marker.parent_bone!=R+"."+part:
            raise ValueError("Missing exported string contact marker "+name)
    for clip in ("draw","loose"):
        if clip not in poses:raise ValueError("Missing TowerCrew clip "+clip)
        for part,value in poses[clip].items():
            if not rig.data.bones.get(R+"."+part):raise ValueError("Pose targets unknown part "+part)
            if len(value)!=4 or not np.isfinite(value).all() or abs(sum(v*v for v in value)-1)>1e-6:
                raise ValueError("Blender [w,x,y,z] pose must be a unit quaternion "+part)
    reference=rig.data.bones[R+".torso"].matrix_local.to_3x3()
    for bone in rig.data.bones:
        frame=bone.matrix_local.to_3x3()
        if max(abs(frame[i][j]-reference[i][j]) for i in range(3) for j in range(3))>1e-6:
            raise ValueError("Bone frames differ: "+bone.name)
    for name in FACE_NAMES:
        obj=bpy.data.objects.get(name)
        if not obj or obj not in kit.descendants(root):raise ValueError("Missing face control "+name)
        if "pupil" in name and obj.parent.name!=name.replace("pupil","eye"):
            raise ValueError("Pupil must blink with its eye")
    for obj in kit.descendants(root):
        if obj.type!="MESH":continue
        if len(obj.data.color_attributes)!=1 or obj.data.color_attributes[0].name!="AO":
            raise ValueError("Exactly one export colour channel required: "+obj.name)
        if not obj.get("continuousSkin"):continue
        if not any(mod.type=="ARMATURE" for mod in obj.modifiers):raise ValueError("Skin lost its deformation modifier")
        for v in obj.data.vertices:
            nonzero=[g for g in v.groups if g.weight>1e-7]
            if len(nonzero)>4 or abs(sum(g.weight for g in nonzero)-1)>.0001:
                raise ValueError(f"{obj.name} vertex {v.index}: non-normalized four-bone skin")
    return rig


def normalize_weights(obj):
    if not obj.get("continuousSkin"):return
    groups={g.index:g for g in obj.vertex_groups};updates=[]
    for v in obj.data.vertices:
        values=sorted([(g.group,g.weight) for g in v.groups if g.weight>1e-7],key=lambda x:x[1],reverse=True)[:4]
        if not values:raise ValueError("Reduction lost an anatomical influence")
        total=sum(w for _,w in values)
        updates.append([(i,w/total) for i,w in values])
    indices=list(range(len(obj.data.vertices)))
    for group in groups.values():group.remove(indices)
    # Quantized batching keeps reduction memory and API calls modest.
    for group_index,group in groups.items():
        batches={}
        for index,values in enumerate(updates):
            for i,w in values:
                if i==group_index:batches.setdefault(round(w*1000000),[]).append(index)
        for value,vertices in batches.items():group.add(vertices,value/1000000,"REPLACE")


def reduce_mesh(obj):
    target=int(obj.get("runtimeTriangles",0));before=triangles(obj)
    if target<=0:raise ValueError("Missing artist allocation: "+obj.name)
    if before<=target:return normalize_weights(obj)
    mesh=obj.data;mesh.calc_loop_triangles()
    points=np.array([v.co[:] for v in mesh.vertices]);normals=np.array([v.normal[:] for v in mesh.vertices])
    faces=np.array([p.vertices[:] for p in mesh.loop_triangles],dtype=np.int32)
    tree=BVHTree.FromPolygons(points.tolist(),faces.tolist(),all_triangles=True)
    bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
    for _ in range(3):
        count=triangles(obj)
        if count<=target:break
        mod=obj.modifiers.new("Separate source-reviewed runtime copy","DECIMATE")
        mod.decimate_type,mod.ratio,mod.use_collapse_triangulate="COLLAPSE",max(.0001,target*.975/count),True
        # Reduce the neutral geometry BEFORE skinning, preserving the modifier.
        while obj.modifiers[0]!=mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    sampled=[]
    for v in obj.data.vertices:
        point,normal,index,_=tree.find_nearest(v.co)
        if point is None:raise ValueError("Normal projection failed")
        a,b,c=faces[index]
        n=barycentric_transform(point,Vector(points[a]),Vector(points[b]),Vector(points[c]),
                                Vector(normals[a]),Vector(normals[b]),Vector(normals[c]))
        sampled.append(tuple(n.normalized() if n.length>1e-8 else normal))
    for polygon in obj.data.polygons:polygon.use_smooth=True
    obj.data.normals_split_custom_set_from_vertices(sampled)
    obj["sourceTriangles"],obj["runtimeTarget"]=before,target
    normalize_weights(obj)


def reduce(root):
    require_review("source");validate(root)
    if root.get("b2SourceFingerprint")!=fingerprint():raise RuntimeError("Saved source is stale")
    for obj in kit.descendants(root):
        if obj.type=="MESH":reduce_mesh(obj)
    validate(root);info=metrics(root)
    if not 20000<=info["triangles"]<=30000:raise ValueError("Runtime outside 20–30k allocation: "+str(info["triangles"]))
    if max(abs(v) for v in info["sizeDeltaFraction"])>.08001:raise ValueError("Runtime native footprint exceeds 8%: "+json.dumps(info["sizeDeltaFraction"]))
    return info


def bake_ao(root):
    scene=bpy.context.scene;scene.render.engine="CYCLES"
    scene.cycles.device,scene.cycles.samples="CPU",32
    scene.render.bake.target="VERTEX_COLORS"
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        layer=obj.data.color_attributes["AO"];obj.data.color_attributes.active_color=layer
        obj.data.color_attributes.render_color_index=0;obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.bake(type="AO")
    for obj in meshes:kit.heal_ao(obj)
    sculpt.finish_ao(root);root["arenaReviewedAO"]=True


def freeze(root):
    validate(root);info=metrics(root)
    root["b2SourceFingerprint"]=fingerprint();root["b2RuntimeReviewPending"]=True
    root["runtimeCopySource"]=str(RUNTIME.relative_to(PROJECT))
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(RUNTIME),compress=True)
    info["runtimeSHA256"],info["masterSHA256"]=file_hash(RUNTIME),file_hash(SOURCE)
    (WORK/"runtime-metrics-v2.json").write_text(json.dumps(info,indent=2)+"\n")
    return info


def load_runtime(root_name=R,reviewed=True,path=None):
    if root_name!=R:raise ValueError("Cannot rename the authored rig")
    gate=require_review("runtime") if reviewed else None
    copy=Path(path or RUNTIME)
    if not copy.is_file():raise RuntimeError("Frozen runtime missing; use the staged review driver")
    if gate and file_hash(copy)!=gate["runtimeSHA256"]:
        raise RuntimeError("Installed Guard copy differs from the accepted frozen runtime")
    with bpy.data.libraries.load(str(copy),link=False) as (source,target):
        target.objects=[n for n in source.objects if n==R or n.startswith(R+".") or n in FACE_NAMES]
    for obj in target.objects:
        if obj is not None and not obj.users_collection:bpy.context.collection.objects.link(obj)
    root=next((o for o in target.objects if o and o.name==R),None)
    if not root:raise ValueError("Frozen file has no canonical root")
    if root.get("b2SourceFingerprint")!=fingerprint():
        raise RuntimeError("Frozen runtime is stale; rebuild from the current reviewed master")
    validate(root);root["b2RuntimeReviewPending"]=not reviewed
    return root
