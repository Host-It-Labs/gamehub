"""Private Firefighter runtime reducer and frozen-copy loader.

No live collector switch. The root first opens source renders and authorizes
this separate reduction, then compares runtime renders in the same cameras.
Master on disk is never saved after these mutations.
"""
import json
import os
from array import array
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
from figure_firefighter_sculpt import BASE, R, select

FACE = {R+part for part in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth")}
TARGET_TRIANGLES = 28000


def triangles(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def budget(name):
    if "continuous-tailored-tunic" in name:return 9000
    if "authored-adult-face" in name:return 2600
    if "adult-arm-hand" in name:return 900
    if "tailored-trouser" in name:return 950
    if "tall-boot-shaped-last" in name:return 900
    if "individual-grip-finger" in name:return 210
    if "gripping-thumb" in name:return 240
    if "helmet-engineered-dome" in name:return 900
    if "helmet-long-neck-brim" in name:return 700
    if "helmet-comb-crest" in name:return 500
    if "working-hollow-nozzle" in name:return 850
    if "nozzle-machined-ring" in name:return 100
    if "nozzle-textured-grip" in name:return 100
    if "weighted-canvas-hose" in name:return 750
    if "swept-moustache" in name:return 250
    if "clean-rolled-cuff" in name:return 180
    if "boot-outsole" in name:return 160
    if "tunic-turned-hem" in name:return 200
    if "standing-collar" in name:return 180
    if "ear-helix" in name:return 100
    if "sculpted-ear" in name:return 150
    if name in FACE:return 230 if "eye" in name else 90 if "pupil" in name else 120
    if "adult-eyelid" in name:return 95
    if "neck-anatomy" in name:return 160
    if "leather-waist-belt" in name:return 160
    if any(k in name for k in ("seam","overlap","chinstrap","spine")):return 90
    if any(k in name for k in ("finger-crease","thread","weave","moustache-lock")):return 20
    if any(k in name for k in ("rivet","button","ray","hole")):return 32
    return 65


def allocate(meshes):
    targets = {obj:min(triangles(obj),budget(obj.name)) for obj in meshes}
    protected = {obj for obj in meshes if obj.name in FACE or any(part in obj.name for part in
        ("continuous-tailored-tunic","authored-adult-face","adult-arm-hand",
         "tailored-trouser","tall-boot-shaped-last","individual-grip-finger","gripping-thumb"))}
    fixed = sum(targets[obj] for obj in protected)
    flexible = sum(targets[obj] for obj in meshes if obj not in protected)
    if fixed >= TARGET_TRIANGLES:
        raise RuntimeError("Firefighter anatomical allocation exceeds its private runtime budget")
    if fixed+flexible > TARGET_TRIANGLES:
        factor = (TARGET_TRIANGLES-fixed)/flexible
        for obj in meshes:
            if obj not in protected:
                targets[obj] = max(min(8,targets[obj]),int(targets[obj]*factor))
    if sum(targets.values()) > TARGET_TRIANGLES:
        raise RuntimeError("Firefighter component allocations cannot fit the measured total")
    return targets


def surface(data):
    # Store each source corner once; do not duplicate its vectors/colours
    # into three Python objects for each evaluated triangle.
    data.calc_loop_triangles()
    points = array("f",[0])*(len(data.vertices)*3)
    normals = array("f",[0])*(len(data.loops)*3)
    faces = array("i",[0])*(len(data.loop_triangles)*3)
    corners = array("i",[0])*len(faces)
    data.vertices.foreach_get("co",points)
    data.corner_normals.foreach_get("vector",normals)
    data.loop_triangles.foreach_get("vertices",faces)
    data.loop_triangles.foreach_get("loops",corners)
    colours = {}
    for attr in data.color_attributes:
        if attr.domain in ("CORNER","POINT"):
            values = array("f",[0])*(len(attr.data)*4)
            attr.data.foreach_get("color",values)
            colours[attr.name] = {"values":values,"indices":corners if attr.domain=="CORNER" else faces}
    tree = BVHTree.FromPolygons([tuple(points[i:i+3]) for i in range(0,len(points),3)],
        [tuple(faces[i:i+3]) for i in range(0,len(faces),3)],all_triangles=True)
    size = sum(len(a)*a.itemsize for a in (points,normals,faces,corners))
    size += sum(len(c["values"])*c["values"].itemsize for c in colours.values())
    return tree,points,faces,corners,normals,colours,size


def reduce(obj, target):
    before = triangles(obj)
    if before <= target:
        return {"name":obj.name,"source":before,"runtime":before}
    tree,points,faces,corners,normals,colours,snapshot_bytes = surface(obj.data)
    select(obj)
    mod = obj.modifiers.new("Separate source-preserving Firefighter reduction","DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target/before
    mod.use_collapse_triangulate = True
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    sampled = []
    sampled_colours = {name:[] for name in colours}
    for vertex in obj.data.vertices:
        p,normal,index,_ = tree.find_nearest(vertex.co)
        a,b,c = (Vector(points[k*3:k*3+3]) for k in faces[index*3:index*3+3])
        ns = [Vector(normals[k*3:k*3+3]) for k in corners[index*3:index*3+3]]
        n = barycentric_transform(p,a,b,c,*ns)
        sampled.append(tuple(n.normalized() if n.length>1e-8 else normal))
        bary = barycentric_transform(p,a,b,c,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
        for name,source in colours.items():
            values = [source["values"][k*4:k*4+4] for k in source["indices"][index*3:index*3+3]]
            sampled_colours[name].append(tuple(sum(float(bary[k])*values[k][channel] for k in range(3)) for channel in range(4)))
    obj.data.normals_split_custom_set_from_vertices(sampled)
    for name,values in sampled_colours.items():
        attr = obj.data.color_attributes.get(name)
        if attr and attr.domain != "CORNER":
            obj.data.color_attributes.remove(attr)
            attr = None
        attr = attr or obj.data.color_attributes.new(name=name,type="FLOAT_COLOR",domain="CORNER")
        attr.data.foreach_set("color",np.array([values[loop.vertex_index] for loop in obj.data.loops],dtype=np.float32).ravel())
        obj.data.color_attributes.active_color = attr
    if obj.get("continuousSkin"):
        for vertex in obj.data.vertices:
            if not vertex.groups or sum(g.weight for g in vertex.groups) < .98:
                raise RuntimeError("Firefighter reducer dropped a skin vertex's deformation weights")
    return {"name":obj.name,"source":before,"runtime":triangles(obj),
            "sampledColourStreams":list(colours),"packedSourceBytes":snapshot_bytes}


def joined_normals(objects, name, weighted=False):
    # bmesh joins discard split normals. Preserve their exact corner order
    # around both the native weighted join and the ordinary rigid join.
    if not weighted:
        for obj in objects:
            kit.apply(obj)
            kit.apply_transform(obj)
    active = objects[0]
    if weighted:
        select(active)
        for obj in objects:obj.select_set(True)
        objects = [active]+[o for o in bpy.context.selected_editable_objects if o != active]
    to_target = (active.matrix_world if weighted else Matrix.Identity(4)).inverted()
    points,normals = [],[]
    for obj in objects:
        frame = to_target@obj.matrix_world
        normal_frame = frame.to_3x3().inverted().transposed()
        points.extend(tuple(frame@obj.data.vertices[loop.vertex_index].co) for loop in obj.data.loops)
        normals.extend(tuple((normal_frame@n.vector).normalized()) for n in obj.data.corner_normals)
    if weighted:
        bpy.ops.object.join()
        obj = active
        obj.name = name
    else:
        obj = kit.join(objects,name)
    actual = np.array([tuple(obj.data.vertices[loop.vertex_index].co) for loop in obj.data.loops])
    if len(actual) != len(points) or not np.allclose(actual,np.array(points),atol=1e-6,rtol=0):
        raise RuntimeError("Firefighter consolidation reordered corners; cannot preserve the source normals safely")
    obj.data.normals_split_custom_set(normals)
    if not obj.data.has_custom_normals:
        raise RuntimeError("Firefighter consolidation lost source normals")
    return obj


def consolidate(root):
    rigid,skins = {},{}
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.name in FACE or len(obj.data.materials) != 1:
            continue
        mat = obj.data.materials[0]
        if obj.get("continuousSkin"):
            skins.setdefault((obj.parent,mat),[]).append(obj)
        elif obj.parent_type == "BONE":
            rigid.setdefault((obj.parent,obj.parent_bone,mat),[]).append(obj)
    for (rig,bone,mat),objects in rigid.items():
        if len(objects)<2:continue
        obj = joined_normals(objects,R+"."+bone.removeprefix(R+".")+"-"+mat.name.split(":")[0])
        world = obj.matrix_world.copy()
        obj.parent,obj.parent_type,obj.parent_bone = rig,"BONE",bone
        obj.matrix_world = world
    for (rig,mat),objects in skins.items():
        if len(objects)<2:continue
        obj = joined_normals(objects,R+".connected-"+mat.name.split(":")[0],weighted=True)
        obj["continuousSkin"] = True
    kit.refresh()


def finish_ao(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":continue
        for attr in list(obj.data.color_attributes):
            if attr.name != "AO":obj.data.color_attributes.remove(attr)
        attr = obj.data.color_attributes.get("AO")
        if attr:
            obj.data.color_attributes.active_color = attr
            obj.data.color_attributes.render_color_index = 0
    root["arenaReviewedAO"] = True


def evaluate_geometry(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":continue
        select(obj)
        for mod in list(obj.modifiers):
            if mod.type == "ARMATURE":continue
            if mod.type == "SUBSURF":mod.render_levels = mod.levels
            while obj.modifiers[0] != mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)


def reduce_reviewed_master(master_path, copy_path=None, memory=None):
    copy_path = Path(copy_path or BASE/"firefighter-runtime-v1.blend")
    bpy.ops.wm.open_mainfile(filepath=str(master_path))
    root = bpy.data.objects[R]
    import hashlib
    sculpt = Path(__file__).with_name("figure_firefighter_sculpt.py")
    if root.get("sculptSha256") != hashlib.sha256(sculpt.read_bytes()).hexdigest():
        raise RuntimeError("Firefighter master is stale; rebuild the source before reduction")
    evaluate_geometry(root)
    if memory:memory("runtime-source-evaluated")
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    targets = allocate(meshes)
    records = []
    for obj in meshes:
        record = reduce(obj,targets[obj])
        record["allocation"] = targets[obj]
        records.append(record)
    if memory:memory("runtime-components-reduced")
    consolidate(root)
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    kit.bake_ao(meshes,samples=32,distance=.15)
    finish_ao(root)
    if memory:memory("runtime-ao")
    total = sum(triangles(o) for o in meshes)
    if total > 30000:
        raise RuntimeError(f"Firefighter runtime {total} exceeds 30k; refine the component allocation")
    root["unoptimized"] = False
    root["runtimeCopySource"] = str(master_path)
    root["runtimeReductionPendingVisualReview"] = True
    import hashlib
    root["runtimeReducerSha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    keep = set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep:bpy.data.objects.remove(obj,do_unlink=True)
    copy_path.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(copy_path),compress=True)
    (BASE/"runtime-reduction.json").write_text(json.dumps({"source":str(master_path),
        "runtime":str(copy_path),"triangles":total,"target":TARGET_TRIANGLES,
        "allocated":sum(targets.values()),"components":records},indent=2)+"\n")
    return root


def load_reviewed_copy(root_name=R, path=None):
    if root_name != R:raise ValueError("Firefighter retains its stable figure id")
    canonical = Path(__file__).resolve().parent/"runtime/firefighter-runtime-v1.blend"
    copy = Path(path or os.environ.get("FIREFIGHTER_RUNTIME_PATH",str(canonical)))
    if not copy.is_file():raise RuntimeError("Firefighter frozen copy must be built and visually reviewed before switching the collector")
    with bpy.data.libraries.load(str(copy),link=False) as (source,loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj:bpy.context.collection.objects.link(obj)
    root = next(o for o in loaded.objects if o and o.name == root_name)
    if len(kit.descendants(root)) != len([o for o in loaded.objects if o]):
        raise RuntimeError("Firefighter copy includes unrelated scene objects")
    import hashlib
    if root.get("sculptSha256") != hashlib.sha256(Path(__file__).with_name("figure_firefighter_sculpt.py").read_bytes()).hexdigest():
        raise RuntimeError("Firefighter frozen copy is stale against its private sculpt")
    if root.get("runtimeReducerSha256") != hashlib.sha256(Path(__file__).read_bytes()).hexdigest():
        raise RuntimeError("Firefighter frozen copy predates the current finger allocation/reducer")
    if root.get("unoptimized") or not root.get("arenaReviewedAO"):
        raise RuntimeError("Firefighter frozen copy lacks the reduced runtime/AO contract")
    if sum(triangles(o) for o in kit.descendants(root) if o.type=="MESH")>30000:
        raise RuntimeError("Firefighter frozen copy exceeds 30k triangles")
    for obj in kit.descendants(root):
        if obj.type=="MESH" and (len(obj.data.color_attributes)!=1 or obj.data.color_attributes[0].name!="AO"):
            raise RuntimeError("Firefighter frozen copy needs exactly one baked AO colour layer per mesh")
    kit.refresh()
    return root
