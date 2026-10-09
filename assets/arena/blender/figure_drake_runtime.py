"""Private source-gated runtime reducer, validation and frozen loaders.

Shared by the two owned vehicle figures. No source is reduced in normal builds.
Root signs evidence inside the figure's own folder; stale recipe/pose hashes,
missing JPGs, oversized geometry and non-neutral frozen rigs fail explicitly.
"""
import gc
import hashlib
import json
import re
from array import array
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
from figure_drake_anatomy import select, reset_pose
from figure_drake_contract import contract

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[2]
REVISION="v1"
FACE_PARTS=("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth")


def work(figure):
    if figure not in ("drake","balloon"):raise ValueError(figure)
    return PROJECT/"work/arena/2026-10-08-roster"/figure


def digest(path):
    value=hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk:=stream.read(1024*1024):value.update(chunk)
    return value.hexdigest()


def code_dependencies(figure):
    names=["figure_drake_anatomy.py","figure_drake_contract.py","figure_drake_sculpt.py",
           "figure_drake_airframe.py","figure_drake_kit.py","figure_folk_kit.py","kit.py"]
    if figure=="balloon":names += ["figure_balloon_sculpt.py","figure_balloon_craft.py",
                                    "figure_balloon_kit.py","face_paint.py"]
    return [HERE/name for name in names]


def dependencies(figure):
    return code_dependencies(figure)+[work(figure)/"brief-v1.md",work(figure)/"baseline-v1.json",
                                     work(figure)/"rig-contract-v1.json"]


def code_fingerprint(figure):
    # Canonical frozen builds remain reproducible without ignored work files.
    # The root's signed sidecar seals the actual render/source/recipe hashes.
    value=hashlib.sha256()
    for path in code_dependencies(figure)+[HERE/"figure_drake_runtime.py",HERE/"figure_drake_review.py"]:
        value.update(path.name.encode());value.update(path.read_bytes())
    return value.hexdigest()


def source_fingerprint(figure):
    value=hashlib.sha256()
    for path in dependencies(figure):
        value.update(str(path.relative_to(PROJECT)).encode());value.update(path.read_bytes())
    return value.hexdigest()


def recipe_fingerprint(figure):
    value=hashlib.sha256(source_fingerprint(figure).encode())
    for path in (HERE/"figure_drake_runtime.py",HERE/"figure_drake_review.py"):
        value.update(path.name.encode());value.update(path.read_bytes())
    return value.hexdigest()


def motion_fingerprint(figure):
    value=hashlib.sha256()
    for path in (work(figure)/("moves-"+figure+"-next.ts"),
                 PROJECT/"components/game/arena/moves/reach.ts",work(figure)/"rig-contract-v1.json"):
        value.update(path.name.encode());value.update(path.read_bytes())
    return value.hexdigest()


def validate_fingerprint(root):
    if root.get("sourceFingerprint")!=source_fingerprint(root.name):
        raise RuntimeError("Detailed source changed; rebuild/review the current "+root.name)


def require_review(figure,stage):
    base=work(figure);gallery=base/(stage+"-v1")
    index=json.loads((gallery/"render-index.json").read_text())
    gate_path=base/(stage+"-review-gate-v1.json")
    if not gate_path.is_file():raise RuntimeError("Root must inspect/sign "+str(gate_path))
    gate=json.loads(gate_path.read_text())
    if gate.get("accepted") is not True or gate.get("reviewer")!="root" or not gate.get("observations"):
        raise RuntimeError("Independent root visual acceptance is pending: "+str(gate_path))
    if index.get("complete") is not True or index.get("sourceFingerprint")!=source_fingerprint(figure):
        raise RuntimeError("Render gallery is incomplete or stale")
    if index.get("motionFingerprint")!=motion_fingerprint(figure):raise RuntimeError("Motion/reach evidence is stale")
    if gate.get("renderIndexSHA256")!=digest(gallery/"render-index.json"):
        raise RuntimeError("Gate does not sign this completed gallery")
    master=base/(figure+"-master-v1.blend")
    if gate.get("masterSHA256")!=digest(master):raise RuntimeError("Reviewed master changed")
    if gate.get("sourceFingerprint")!=source_fingerprint(figure):raise RuntimeError("Root gate signs older source")
    if gate.get("recipeFingerprint")!=recipe_fingerprint(figure):raise RuntimeError("Root gate signs older review/reducer recipe")
    if gate.get("modelCodeFingerprint")!=code_fingerprint(figure):raise RuntimeError("Root gate signs older sculpt/reducer code")
    if stage=="runtime" and gate.get("runtimeSHA256")!=digest(base/(figure+"-runtime-v1.blend")):
        raise RuntimeError("Reviewed frozen copy changed")
    required=index.get("requiredRenders",[])
    inspected=gate.get("inspected",[])
    if not required or any(name not in inspected for name in required):
        raise RuntimeError("Root must inspect required clay, material, face, hand and extreme views")
    for relative in inspected:
        path=base/relative
        if not path.resolve().is_relative_to(base.resolve()) or not path.is_file() or path.suffix.lower()!=".jpg":
            raise RuntimeError("Real JPG evidence must be inside the figure's folder: "+str(relative))
    if not index.get("withinEightPercent"):raise RuntimeError("Native size gate failed")
    return gate


def triangles(obj):return sum(len(p.vertices)-2 for p in obj.data.polygons)


def metrics(root):
    kit.refresh();deps=bpy.context.evaluated_depsgraph_get();lo=np.full(3,np.inf);hi=np.full(3,-np.inf)
    parts=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH":continue
        evaluated=obj.evaluated_get(deps);data=evaluated.data
        if not data.vertices:continue
        points=np.empty(len(data.vertices)*3,dtype=np.float64)
        data.vertices.foreach_get("co",points);points=points.reshape((-1,3))
        matrix=np.asarray(evaluated.matrix_world,dtype=np.float64)
        points=points@matrix[:3,:3].T+matrix[:3,3]
        lo=np.minimum(lo,points.min(axis=0));hi=np.maximum(hi,points.max(axis=0))
        parts.append({"name":obj.name,"triangles":sum(len(p.vertices)-2 for p in data.polygons),
                      "vertices":len(data.vertices),"allocation":obj.get("runtimeTriangles"),
                      "region":obj.get("sourceRegion"),"human":bool(obj.get("humanComponent"))})
    saved=root.get("nativeBaselineSize")
    baseline=np.array(list(saved) if saved is not None else
                      json.loads((work(root.name)/"baseline-v1.json").read_text())["blenderSize"])
    size=hi-lo;delta=size/baseline-1
    return {"min":lo.tolist(),"max":hi.tolist(),"blenderSize":size.tolist(),"baselineSize":baseline.tolist(),
            "sizeDeltaFraction":delta.tolist(),"withinEightPercent":bool(np.all(np.abs(delta)<=.08001)),
            "triangles":sum(p["triangles"] for p in parts),"humanTriangles":sum(p["triangles"] for p in parts if p["human"]),
            "meshNodes":len(parts),"materialDraws":sum(len(o.data.materials) for o in kit.descendants(root) if o.type=="MESH"),
            "components":parts,"globalRescaleApplied":False}


def validate(root,runtime=False):
    descendants=kit.descendants(root);rigs=[o for o in descendants if o.type=="ARMATURE"]
    if len(rigs)!=1:raise ValueError("Exactly one common-axis vehicle/human rig required")
    rig=rigs[0];record=contract(root.name);r=root.name
    for name,parent in record["parents"].items():
        bone=rig.data.bones.get(r+"."+name)
        if not bone or not bone.parent or bone.parent.name!=r+"."+parent:raise ValueError("Incorrect parent of "+name)
    frame=rig.data.bones[r+".torso"].matrix_local.to_3x3()
    for bone in rig.data.bones:
        other=bone.matrix_local.to_3x3()
        if max(abs(frame[i][j]-other[i][j]) for i in range(3) for j in range(3))>1e-6:
            raise ValueError("Non-common bone frame: "+bone.name)
    for suffix in FACE_PARTS:
        obj=next((o for o in descendants if o.name==r+suffix),None)
        if not obj:raise ValueError("Missing live face "+suffix)
        if suffix.startswith("pupil") and (not obj.parent or obj.parent.name!=r+"eye"+suffix[-1]):
            raise ValueError("Pupil must blink with its eye")
    if not any(o.name==r+".bomb" for o in descendants):raise ValueError("Projectile marker missing")
    for obj in descendants:
        if obj.type!="MESH":continue
        if not obj.data.uv_layers:raise ValueError("Missing runtime UV coordinates: "+obj.name)
        if obj.get("continuousSkin"):
            if not any(m.type=="ARMATURE" and m.object==rig for m in obj.modifiers):raise ValueError("Skin lost anatomical deformation")
            for vertex in obj.data.vertices:
                weights=[g.weight for g in vertex.groups if g.weight>1e-7]
                if len(weights)>4 or abs(sum(weights)-1)>2e-5:raise ValueError("Invalid skin weights: "+obj.name)
        if runtime and (len(obj.data.color_attributes)!=1 or obj.data.color_attributes[0].name!="AO"):
            raise ValueError("Exactly one active AO/pigment colour channel required")
        if any(m and re.search(r"\.\d{3}$",m.name) for m in obj.data.materials):raise ValueError("Dirty material names")
        if any(m and ":" not in m.name for m in obj.data.materials):raise ValueError("Material lacks Arena family:tint")
    return rig


def normalize_weights(obj):
    if not obj.get("continuousSkin"):return
    groups={g.index:g for g in obj.vertex_groups};batches={i:{} for i in groups}
    for v in obj.data.vertices:
        values=sorted([(g.group,g.weight) for g in v.groups if g.weight>1e-7],key=lambda pair:pair[1],reverse=True)[:4]
        total=sum(w for _,w in values)
        if total<1e-8:raise ValueError("Reduction erased an anatomical influence")
        for i,w in values:batches[i].setdefault(round(w/total*1000000),[]).append(v.index)
    indices=list(range(len(obj.data.vertices)))
    for i,group in groups.items():
        group.remove(indices)
        for quant,vertices in batches[i].items():group.add(vertices,quant/1000000,"REPLACE")


def reduce_mesh(obj,target):
    before=triangles(obj)
    if before<=target:normalize_weights(obj);return {"name":obj.name,"source":before,"runtime":before}
    data=obj.data;data.calc_loop_triangles()
    points=array("f",[0])*(len(data.vertices)*3);faces=array("i",[0])*(len(data.loop_triangles)*3)
    corners=array("i",[0])*len(faces);normals=array("f",[0])*(len(data.loops)*3)
    data.vertices.foreach_get("co",points);data.loop_triangles.foreach_get("vertices",faces)
    data.loop_triangles.foreach_get("loops",corners);data.corner_normals.foreach_get("vector",normals)
    colours={}
    for attr in data.color_attributes:
        values=array("f",[0])*(len(attr.data)*4);attr.data.foreach_get("color",values)
        colours[attr.name]=(values,attr.domain,attr.data_type)
    tree=BVHTree.FromPolygons([tuple(points[k:k+3]) for k in range(0,len(points),3)],
                            [tuple(faces[k:k+3]) for k in range(0,len(faces),3)],all_triangles=True)
    select(obj)
    for _ in range(3):
        count=triangles(obj)
        if count<=target:break
        mod=obj.modifiers.new("Separate reviewed runtime reduction","DECIMATE")
        mod.decimate_type="COLLAPSE";mod.ratio=max(.0001,target*.98/count);mod.use_collapse_triangulate=True
        while obj.modifiers[0]!=mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    sampled=[];colour_values={name:[] for name in colours}
    for loop in obj.data.loops:
        vertex=obj.data.vertices[loop.vertex_index]
        p,n,index,_=tree.find_nearest(vertex.co)
        if p is None:raise ValueError("Source surface sampling failed")
        a,b,c=[Vector(points[k*3:k*3+3]) for k in faces[index*3:index*3+3]]
        bary=barycentric_transform(p,a,b,c,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
        source_loops=corners[index*3:index*3+3]
        normal=sum((Vector(normals[k*3:k*3+3])*float(v) for k,v in zip(source_loops,bary)),Vector())
        sampled.append(tuple(normal.normalized() if normal.length>1e-8 else n))
        for name,(values,domain,_) in colours.items():
            source_indices=source_loops if domain=="CORNER" else faces[index*3:index*3+3]
            colour=sum((np.array(values[k*4:k*4+4])*float(v) for k,v in zip(source_indices,bary)),np.zeros(4))
            colour_values[name].extend(np.clip(colour,0,1).tolist())
    obj.data.normals_split_custom_set(sampled)
    for name,values in colour_values.items():
        old=obj.data.color_attributes.get(name)
        if old:obj.data.color_attributes.remove(old)
        obj.data.color_attributes.new(name,"FLOAT_COLOR","CORNER").data.foreach_set("color",values)
    normalize_weights(obj)
    obj["sourceTriangles"]=before
    del tree,points,faces,corners,normals,colours;gc.collect()
    return {"name":obj.name,"source":before,"runtime":triangles(obj),"sourceCornerNormalsProjected":True}


def clean_materials(root):
    for obj in kit.descendants(root):
        if obj.type!="MESH":continue
        for slot in obj.material_slots:
            mat=slot.material
            if not mat:continue
            base=re.sub(r"(?:\.\d{3})+$","",mat.name)
            if mat.name!=base:
                shared=bpy.data.materials.get(base)
                if shared:slot.material=shared
                else:mat.name=base


def consolidate(root):
    """Batch equal finishes without freezing skins or losing source normals.

    Vehicle subassemblies are already joined in the detailed source. These
    small human trims can share a mesh only with the same parent/bone,
    material, deform mode and UV schema. Face controls remain independent.
    """
    buckets={};records=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH" or obj.name in {root.name+p for p in FACE_PARTS}:continue
        if len(obj.data.materials)!=1 or len(obj.data.uv_layers)!=1:continue
        weighted=bool(obj.get("continuousSkin"))
        if not weighted and obj.parent_type!="BONE":continue
        key=(obj.parent,obj.parent_type,obj.parent_bone,obj.data.materials[0],weighted,
             bool(obj.get("humanComponent")))
        buckets.setdefault(key,[]).append(obj)
    for (parent,parent_type,bone,material,weighted,human),pieces in buckets.items():
        if len(pieces)<2:continue
        active=pieces[0];select(active)
        for piece in pieces:piece.select_set(True)
        ordered=[active]+[obj for obj in bpy.context.selected_editable_objects if obj!=active]
        to_target=active.matrix_world.inverted();coordinates=[];normals=[]
        names=[o.name for o in ordered]
        budgets=sum(int(o.get("runtimeTriangles",triangles(o))) for o in ordered)
        regions="; ".join(o.get("sourceRegion",o.name) for o in ordered)
        for obj in ordered:
            change=to_target@obj.matrix_world
            normal_frame=change.to_3x3().inverted().transposed()
            coordinates.extend(tuple(change@obj.data.vertices[loop.vertex_index].co) for loop in obj.data.loops)
            normals.extend(tuple((normal_frame@normal.vector).normalized()) for normal in obj.data.corner_normals)
        bpy.ops.object.join()
        if len(active.data.loops)!=len(coordinates):raise RuntimeError("Native batching changed corner count")
        actual=np.array([tuple(active.data.vertices[loop.vertex_index].co) for loop in active.data.loops])
        if not np.allclose(actual,np.array(coordinates),atol=1e-6,rtol=0):
            raise RuntimeError("Native batching reordered corners; cannot safely restore source normals")
        active.data.normals_split_custom_set(normals)
        active["runtimeTriangles"]=budgets;active["sourceRegion"]=regions
        active["humanComponent"]=human;active["continuousSkin"]=weighted
        # Keep the active name: face/skin AO policies must stay readable.
        records.append({"name":active.name,"components":names,"sourceCornerNormalsPreserved":True})
        normalize_weights(active)
    kit.refresh();return records


def bake_ao(root,memory):
    scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.device="CPU"
    scene.render.threads_mode="FIXED";scene.render.threads=3
    scene.cycles.samples=32;scene.cycles.use_denoising=False
    scene.render.use_persistent_data=False;scene.render.bake.target="VERTEX_COLORS"
    if not scene.world:scene.world=bpy.data.worlds.new(root.name+" AO world")
    scene.world.light_settings.distance=.16 if root.name=="drake" else .22
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.data.color_attributes.active_color=obj.data.color_attributes["AO"]
        obj.data.color_attributes.render_color_index=list(obj.data.color_attributes).index(obj.data.color_attributes["AO"])
        obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    memory("before-private-cpu-ao");bpy.ops.object.bake(type="AO");memory("after-private-cpu-ao")
    for obj in meshes:
        kit.heal_ao(obj)
        ao,pigment=obj.data.color_attributes["AO"],obj.data.color_attributes["Pigment"]
        values=np.empty(len(ao.data)*4,dtype=np.float32);paint=np.empty_like(values)
        ao.data.foreach_get("color",values);pigment.data.foreach_get("color",paint)
        values=values.reshape((-1,4));paint=paint.reshape((-1,4))
        # Keep skin from turning muddy where collars meet the connected neck.
        minimum=.58 if "head-neck" in obj.name else .34
        values[:,:3]=np.clip(values[:,:3],minimum,1)*paint[:,:3];values[:,3]=1
        ao.data.foreach_set("color",values.ravel())
        for attr in list(obj.data.color_attributes):
            if attr.name!="AO":obj.data.color_attributes.remove(attr)
        obj.data.color_attributes.active_color=ao;obj.data.color_attributes.render_color_index=0
    root["arenaReviewedAO"]=True


def reduce_master(figure,memory):
    require_review(figure,"source")
    base=work(figure);master=base/(figure+"-master-v1.blend")
    bpy.ops.wm.open_mainfile(filepath=str(master));root=bpy.data.objects[figure]
    validate_fingerprint(root);reset_pose(root);validate(root)
    original=metrics(root)
    if not original["withinEightPercent"]:raise ValueError("Fix source dimensions before reduction")
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    targets={obj:min(triangles(obj),int(obj["runtimeTriangles"])) for obj in meshes}
    ceiling=contract(figure)["config"]["runtimeTarget"]
    protected={obj for obj in meshes if obj.get("continuousSkin") or obj.name in {figure+p for p in FACE_PARTS}}
    fixed=sum(targets[o] for o in protected);flexible=sum(targets[o] for o in meshes if o not in protected)
    if fixed>=ceiling:raise ValueError("Anatomical allocation exhausts whole-vehicle budget")
    if fixed+flexible>ceiling:
        factor=(ceiling-fixed)/max(1,flexible)
        for obj in meshes:
            if obj not in protected:targets[obj]=max(8,int(targets[obj]*factor))
    records=[]
    for obj,target in targets.items():
        memory("before-reduce-"+obj.name);records.append(reduce_mesh(obj,target));memory("after-reduce-"+obj.name)
    clean_materials(root);batches=consolidate(root);bake_ao(root,memory);validate(root,runtime=True)
    result=metrics(root)
    if not 20000<=result["triangles"]<=32000:raise ValueError("Whole vehicle runtime is outside 20-32k: "+str(result["triangles"]))
    if not result["withinEightPercent"]:raise ValueError("Runtime native size exceeds eight percent")
    if max(abs(result["blenderSize"][i]/original["blenderSize"][i]-1) for i in range(3))>.012:
        raise ValueError("Runtime silhouette drift exceeds 1.2 percent; protect source landmarks")
    root["unoptimized"]=False;root["recipeFingerprint"]=recipe_fingerprint(figure)
    root["runtimeReviewPending"]=True
    keep=set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
    # A frozen copy contains the neutral model only, never cameras/pose sheets.
    reset_pose(root);destination=base/(figure+"-runtime-v1.blend")
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(destination),compress=True)
    result.update({"reductions":records,"batches":batches,"masterSHA256":digest(master),"runtimeSHA256":digest(destination),
                   "sourceFingerprint":source_fingerprint(figure),"recipeFingerprint":recipe_fingerprint(figure),
                   "runtimeAccepted":False})
    (base/"runtime-metrics-v1.json").write_text(json.dumps(result,indent=2)+"\n")
    memory("frozen-runtime-saved");return root


def load_runtime(figure="drake",path=None,reviewed=True):
    local=work(figure)/(figure+"-runtime-v1.blend")
    canonical=HERE/"runtime"/(figure+"-runtime-v1.blend")
    file=Path(path or (canonical if canonical.is_file() else local))
    if not file.is_file():raise RuntimeError("Frozen runtime does not exist; follow root-next.md")
    portable=file.resolve()!=local.resolve()
    gate=None
    if reviewed:
        if portable:
            gate=json.loads(file.with_suffix(".review.json").read_text())
            if gate.get("accepted") is not True or gate.get("reviewer")!="root" or not gate.get("observations") or not gate.get("inspected"):
                raise RuntimeError("Canonical copy has no independent root acceptance seal")
            if gate.get("runtimeSHA256")!=digest(file) or gate.get("modelCodeFingerprint")!=code_fingerprint(figure):
                raise RuntimeError("Canonical frozen bytes/source changed since root review")
        else:gate=require_review(figure,"runtime")
    with bpy.data.libraries.load(str(file),link=False) as (source,loaded):loaded.objects=list(source.objects)
    objects=[o for o in loaded.objects if o is not None]
    for obj in objects:
        if not obj.users_collection:bpy.context.collection.objects.link(obj)
    root=next((o for o in objects if o.name==figure),None)
    if root is None or set(kit.descendants(root))!=set(objects):raise ValueError("Frozen file must contain only the complete owned figure")
    clean_materials(root);rig=validate(root,runtime=True)
    if portable:
        if not reviewed:raise RuntimeError("Portable runtime copies require the root's signed sidecar")
        if root.get("sourceFingerprint")!=gate.get("sourceFingerprint") or root.get("recipeFingerprint")!=gate.get("recipeFingerprint"):
            raise RuntimeError("Canonical seal does not describe this frozen source/recipe")
        if root.get("modelCodeFingerprint")!=code_fingerprint(figure):raise RuntimeError("Canonical sculpt/reducer code is stale")
    else:
        validate_fingerprint(root)
        if root.get("recipeFingerprint")!=recipe_fingerprint(figure):raise RuntimeError("Frozen reducer recipe is stale")
    for bone in rig.pose.bones:
        if max(abs(bone.matrix_basis[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4))>1e-6:
            raise ValueError("Frozen bone has a non-neutral pose: "+bone.name)
    info=metrics(root)
    if not info["withinEightPercent"] or not 20000<=info["triangles"]<=32000 or not root.get("arenaReviewedAO"):
        raise ValueError("Frozen geometry/size/AO gate failed")
    root["runtimeReviewPending"]=not reviewed
    kit.refresh();return root


def finish_ao(root):
    # The collector recognizes arenaReviewedAO and preserves this single
    # authored stream. This hook is deliberately idempotent.
    validate(root,runtime=True)
