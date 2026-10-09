"""Diver-only component-aware reduction and frozen runtime-copy loader.

Run the reducer only after reviewing the detailed master. It preserves weighted
sewn canvas, samples source normals, retains gloves/face before small fasteners,
and writes no source or shared bundle. Neutral rig and faces stay editable.
"""
import json
import hashlib
import os
from array import array
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
from figure_diver_sculpt import BASE, select

# Only root installs an accepted frozen copy here. Reduction/review output
# stays private under BASE until that separate integration step.
COPY=Path(__file__).resolve().parent/"runtime/diver-runtime-v4.blend"
FACE={"diver"+p for p in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth")}
TARGET_TRIANGLES=28000


def triangles(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def budget(name):
    if name=="diver.suit-skin":return 11500
    if "adult-face" in name:return 2500
    if "glove-palm" in name:return 260
    if "glove-finger" in name:return 160
    if "glove-thumb" in name:return 210
    if "glove-crease" in name:return 16
    if "beard-sculpt" in name:return 1800
    if "moustache" in name:return 190
    if "helmet-shell" in name:return 1500
    if "helmet-lining" in name:return 450
    if "front-port-frame" in name:return 400
    if "machined-rim" in name:return 140
    if "bolted-corselet" in name:return 450
    if "deltoid-plate" in name:return 280
    if "lead-boot-last" in name:return 450
    if "brass-toe" in name:return 180
    if "air-hose" in name:return 400
    if "adjustable-wrench" in name:return 200
    if "wrench-fixed-jaw" in name or "wrench-sliding-jaw" in name:return 250
    if "wrench-adjuster" in name:return 120
    if "boot-lead" in name:return 100
    if "window-glint" in name:return 100
    if "lead-ingot" in name:return 36
    if "suspend" in name or "harness" in name:return 160
    if "leather-weight-belt" in name:return 240
    if name in FACE:return 220 if "eye" in name else 100 if "pupil" in name else 130
    if any(k in name for k in ("bolt","rivet","stud","eyelet")):return 24
    if any(k in name for k in ("lace","tooth","crease","thread","grille")):return 28
    if "gauntlet" in name:return 150
    if "cuff-rim" in name:return 160
    if "trouser-hem" in name:return 200
    if "hem-rolled-edge" in name:return 120
    if "compressed-lip" in name:return 120
    if "port-glass" in name:return 72
    if "port-rim" in name:return 150
    if "eyelid" in name:return 100
    return 84


def allocate(meshes):
    """Protect authored anatomy, then fit measured equipment into the total.

    Per-piece caps alone are insufficient: scores of fittings can silently
    put their sum above the figure limit. The master remains unchanged;
    these allocations are made only in its separate runtime copy.
    """
    targets={obj:min(triangles(obj),budget(obj.name)) for obj in meshes}
    protected={obj for obj in meshes if obj.name in FACE or any(part in obj.name
        for part in ("suit-skin","adult-face","glove-","beard-sculpt","moustache"))}
    fixed=sum(targets[obj] for obj in protected)
    flexible=sum(targets[obj] for obj in meshes if obj not in protected)
    if fixed>=TARGET_TRIANGLES:
        raise RuntimeError("Diver anatomy allocation alone exhausts the runtime budget")
    if fixed+flexible>TARGET_TRIANGLES:
        factor=(TARGET_TRIANGLES-fixed)/flexible
        for obj in meshes:
            if obj not in protected:
                targets[obj]=max(min(targets[obj],8),int(targets[obj]*factor))
    if sum(targets.values())>TARGET_TRIANGLES:
        raise RuntimeError("Diver equipment allocation cannot fit without losing its geometry")
    return targets


def surface(data):
    # Pack original vertex/corner data once. Per-triangle Python vectors
    # and RGBA tuples inflate the review's peak before any render begins.
    # Keep corner normals: averaging them per vertex loses machined edges.
    data.calc_loop_triangles()
    points=array("f",[0])* (len(data.vertices)*3)
    normals=array("f",[0])* (len(data.loops)*3)
    faces=array("i",[0])* (len(data.loop_triangles)*3)
    corners=array("i",[0])*len(faces)
    data.vertices.foreach_get("co",points)
    data.corner_normals.foreach_get("vector",normals)
    data.loop_triangles.foreach_get("vertices",faces)
    data.loop_triangles.foreach_get("loops",corners)
    tree=BVHTree.FromPolygons([tuple(points[i:i+3]) for i in range(0,len(points),3)],
        [tuple(faces[i:i+3]) for i in range(0,len(faces),3)],all_triangles=True)
    size=sum(len(values)*values.itemsize for values in (points,normals,faces,corners))
    return tree,points,normals,faces,corners,size


def reduce(obj,target):
    before=triangles(obj)
    if before<=target:return {"name":obj.name,"source":before,"runtime":before}
    ref=surface(obj.data)
    select(obj)
    mod=obj.modifiers.new("Separate source-preserving runtime reduction","DECIMATE")
    mod.decimate_type="COLLAPSE";mod.ratio=target/before
    mod.use_collapse_triangulate=True
    while obj.modifiers[0]!=mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    tree,points,normals,faces,corners,snapshot_bytes=ref
    sampled=[]
    for vertex in obj.data.vertices:
        p,normal,index,_=tree.find_nearest(vertex.co)
        a,b,c=(Vector(points[k*3:k*3+3]) for k in faces[index*3:index*3+3])
        ns=[Vector(normals[k*3:k*3+3]) for k in corners[index*3:index*3+3]]
        n=barycentric_transform(p,a,b,c,*ns)
        sampled.append(tuple(n.normalized() if n.length>1e-8 else normal))
    obj.data.normals_split_custom_set_from_vertices(sampled)
    return {"name":obj.name,"source":before,"runtime":triangles(obj),
            "packedSourceBytes":snapshot_bytes,"sampledSourceCornerNormals":True}


def joined_normals(objects,name,weighted=False):
    """Consolidate while preserving the reduced pieces' source normals.

    kit.join rebuilds meshes through bmesh, which drops custom split
    normals. Native skin joining must also keep the component finish.
    Restore only after verifying that the corner order really matches.
    """
    if not weighted:
        for obj in objects:
            kit.apply(obj);kit.apply_transform(obj)
    active=objects[0]
    if weighted:
        select(active)
        for piece in objects:piece.select_set(True)
        # Native join appends the active mesh first, then the context's
        # editable selection order, which can differ from descendant order.
        objects=[active]+[piece for piece in bpy.context.selected_editable_objects
                          if piece!=active]
    target_frame=active.matrix_world if weighted else Matrix.Identity(4)
    to_target=target_frame.inverted()
    coordinates=[];normals=[]
    for obj in objects:
        change=to_target@obj.matrix_world
        normal_frame=change.to_3x3().inverted().transposed()
        coordinates.extend(tuple(change@obj.data.vertices[loop.vertex_index].co)
                           for loop in obj.data.loops)
        normals.extend(tuple((normal_frame@normal.vector).normalized())
                       for normal in obj.data.corner_normals)
    if weighted:
        bpy.ops.object.join();obj=active;obj.name=name
    else:
        obj=kit.join(objects,name)
    if len(obj.data.loops)!=len(coordinates):
        raise RuntimeError("Diver consolidation changed the source-normal corner count")
    actual=np.array([tuple(obj.data.vertices[loop.vertex_index].co) for loop in obj.data.loops])
    if not np.allclose(actual,np.array(coordinates),atol=1e-6,rtol=0):
        raise RuntimeError("Diver consolidation reordered corners; source normals cannot be restored safely")
    obj.data.normals_split_custom_set(normals)
    if not obj.data.has_custom_normals:
        raise RuntimeError("Diver consolidation lost source normals")
    return obj


def consolidate(root):
    buckets={}
    skins={}
    for obj in kit.descendants(root):
        if obj.type!="MESH" or obj.name in FACE:continue
        if obj.get("continuousSkin"):
            if len(obj.data.materials)==1:
                skins.setdefault((obj.parent,obj.data.materials[0]),[]).append(obj)
            continue
        if obj.parent_type!="BONE" or len(obj.data.materials)!=1:continue
        key=(obj.parent,obj.parent_bone,obj.data.materials[0])
        buckets.setdefault(key,[]).append(obj)
    for (rig,bone,mat),objects in buckets.items():
        if len(objects)<2:continue
        obj=joined_normals(objects,"diver."+bone.removeprefix("diver.")+"-"+mat.name.split(":")[0])
        world=obj.matrix_world.copy()
        obj.parent=rig;obj.parent_type="BONE";obj.parent_bone=bone;obj.matrix_world=world
    for (rig,mat),objects in skins.items():
        if len(objects)<2:continue
        # Direct Blender join preserves deform groups; kit.join deliberately
        # evaluates modifiers and would freeze a weighted hose at rest.
        obj=joined_normals(objects,"diver.connected-"+mat.name.split(":")[0],weighted=True)
        obj["continuousSkin"]=True
    kit.refresh()


def finish_ao(root):
    # Bake actual geometry AO; combine only the active stream, so no second
    # colour channel can hide the intended shading in the glTF renderer.
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    for obj in meshes:
        for attr in list(obj.data.color_attributes):
            if attr.name!="AO":obj.data.color_attributes.remove(attr)
        ao=obj.data.color_attributes.get("AO")
        if ao:
            obj.data.color_attributes.active_color=ao
            obj.data.color_attributes.render_color_index=0
    root["arenaReviewedAO"]=True


def reduce_reviewed_master(master_path,copy_path=None,memory=None):
    copy_path=Path(copy_path or BASE/"diver-runtime-v4.blend")
    bpy.ops.wm.open_mainfile(filepath=str(master_path))
    root=bpy.data.objects["diver"]
    sculpt=Path(__file__).with_name("figure_diver_sculpt.py")
    if root.get("sourceSculptSha256")!=hashlib.sha256(sculpt.read_bytes()).hexdigest():
        raise RuntimeError("Diver master is stale; rebuild and review its matching source before reduction")
    # This deliberately works in a separate loaded copy; the .blend master
    # on disk is never saved after subdivision evaluation or reduction.
    records=[]
    meshes=[obj for obj in kit.descendants(root) if obj.type=="MESH"]
    for obj in meshes:
        select(obj)
        for mod in list(obj.modifiers):
            if mod.type!="ARMATURE":
                # Topology modifiers are evaluated before the retained skin.
                while obj.modifiers[0]!=mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
                bpy.ops.object.modifier_apply(modifier=mod.name)
    if memory:memory("runtime-source-evaluated")
    targets=allocate(meshes)
    for obj in meshes:
        record=reduce(obj,targets[obj])
        record["allocation"]=targets[obj]
        records.append(record)
        if memory:memory("runtime-component-"+obj.name)
    consolidate(root)
    root["unoptimized"]=False
    root["runtimeCopySource"]=str(copy_path.relative_to(BASE))
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    # The coordinating root can use its working GPU; CPU is an equivalent
    # bake path when Metal is unavailable, without modifying the shared kit.
    kit.bake_ao(meshes,samples=64,distance=.20)
    finish_ao(root)
    if memory:memory("runtime-ao")
    total=sum(triangles(o) for o in meshes)
    if total>30000:raise RuntimeError(f"Diver runtime {total} exceeds 30k; refine component allocation")
    keep=set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
    copy_path.parent.mkdir(exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(copy_path),compress=True)
    (BASE/"runtime-reduction.json").write_text(json.dumps({"source":str(master_path),
        "runtime":str(copy_path),"triangles":total,"target":TARGET_TRIANGLES,
        "allocated":sum(targets.values()),"components":records},indent=2)+"\n")
    return root


def load_reviewed_copy(root_name="diver",path=None):
    if root_name!="diver":raise ValueError("Diver keeps its stable named figure identity")
    copy_path=Path(path or os.environ.get("DIVER_RUNTIME_PATH",str(COPY)))
    if not copy_path.is_file():raise RuntimeError("Build/review the Diver runtime copy before switching the collector")
    with bpy.data.libraries.load(str(copy_path),link=False) as (source,loaded):
        loaded.objects=list(source.objects)
    for obj in loaded.objects:
        if obj:bpy.context.collection.objects.link(obj)
    root=next(obj for obj in loaded.objects if obj.name==root_name)
    assert len(kit.descendants(root))==len(loaded.objects)
    kit.refresh()
    if root.get("sourceSculptSha256")!=hashlib.sha256((Path(__file__).parent/"figure_diver_sculpt.py").read_bytes()).hexdigest():
        raise RuntimeError("Frozen Diver copy predates the current authored source")
    meshes=[obj for obj in kit.descendants(root) if obj.type=="MESH"]
    if sum(triangles(obj) for obj in meshes)>30000:raise RuntimeError("Frozen Diver copy exceeds 30k triangles")
    if not root.get("arenaReviewedAO") or any(len(obj.data.color_attributes)!=1 or obj.data.color_attributes[0].name!="AO" for obj in meshes):
        raise RuntimeError("Frozen Diver requires exactly one baked AO colour layer per mesh")
    return root
