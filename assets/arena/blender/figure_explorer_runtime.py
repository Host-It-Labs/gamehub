"""Explorer-only reduction and neutral frozen-copy loader.

Source inspection precedes this operation. Preserve the master on disk,
the face colour stream, skin weights and sampled source normals.
"""
import hashlib
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
from figure_explorer_sculpt import BASE, select

SOURCE = Path(__file__).resolve().with_name("figure_explorer_sculpt.py")
COPY = Path(__file__).resolve().parent / "runtime/explorer-runtime-v2.blend"
FACE = {"explorer"+name for name in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth")}
TARGET = 28000


def triangles(obj):
    return sum(len(poly.vertices)-2 for poly in obj.data.polygons)


def source_hash():
    return hashlib.sha256(SOURCE.read_bytes()).hexdigest()


def current_fingerprints():
    project = SOURCE.parents[3]
    return {key:hashlib.sha256(file.read_bytes()).hexdigest() for key,file in (
        ("sculptSha256",SOURCE),("movesSha256",BASE/"moves-explorer-next.ts"),
        ("reachSha256",project/"components/game/arena/moves/reach.ts"))}


def fingerprints(version):
    current = current_fingerprints()
    record = json.loads((BASE/("review-poses-"+version+".json")).read_text())
    if any(record.get(key) != value for key,value in current.items()):
        raise RuntimeError("Explorer numerical review poses are stale; rerun probe-next.mjs "+version)
    return current


def validate_fingerprint(root):
    if root.get("sculptSHA256") != source_hash():
        raise RuntimeError("Explorer .blend is stale against its private sculpt; build/review the current source first")


def budget(name):
    if name == "explorer.parka-skin": return 10000
    if "adult-face" in name: return 2600
    if "ordered-fur-ruff" in name: return 2000
    if "ordered-fur-hem" in name: return 700
    if "combed-hair" in name: return 350
    if "mitten-folded-pad" in name: return 650
    if "mitten-thumb-web" in name: return 220
    if "fur-cuff" in name: return 450
    if "folded-trouser" in name: return 1000
    if "combed-mukluk-shaft" in name: return 650
    if "mukluk-toe-last" in name: return 500
    if "gabardine-hood" in name: return 850
    if "hood-lining" in name: return 280
    if "engineered-wood-stock" in name: return 230
    if "rifle-forewood" in name: return 250
    if "five-turn-ice-coil" in name: return 460
    if "blued-rifle-barrel" in name: return 140
    if "brass-receiver" in name: return 90
    if "goggle-machined-rim" in name: return 170
    if "goggle-lens" in name: return 84
    if name in FACE: return 180 if "eye" in name else 70 if "pupil" in name else 110
    if "patch-pocket" in name: return 210
    if "diagonal-chest-sling" in name: return 140
    if "fitted-leather-belt" in name: return 200
    if "front-storm-placket" in name: return 140
    if "eyelid" in name: return 60
    if "compressed-lip" in name: return 70
    if any(part in name for part in ("seam","dart","cord","tie","welt")): return 48
    if any(part in name for part in ("screw","hinge","stud","nostril")): return 24
    return 64


def allocate(meshes, limit=TARGET, review=False):
    if review:
        def cap(name):
            if "parka-skin" in name: return 120000
            if "adult-face" in name: return 18000
            if "ordered-fur-ruff" in name: return 7680
            if "combed-hair" in name: return 2000
            if "mitten-folded-pad" in name: return 2600
            if "thumb-web" in name: return 1400
            if "ordered-fur-hem" in name: return 5000
            if "folded-trouser" in name: return 5000
            return 1800
    else:
        cap = budget
    targets = {obj:min(triangles(obj),cap(obj.name)) for obj in meshes}
    protected = {obj for obj in meshes if obj.name in FACE or any(part in obj.name for part in
        ("parka-skin","adult-face","ordered-fur-ruff","combed-hair","mitten-folded-pad","thumb-web"))}
    fixed = sum(targets[obj] for obj in protected)
    flexible = sum(targets[obj] for obj in meshes if obj not in protected)
    if fixed >= limit: raise RuntimeError("Explorer protected anatomy exhausts the copy budget")
    if fixed+flexible > limit:
        factor = (limit-fixed)/flexible
        for obj in meshes:
            if obj not in protected: targets[obj] = max(min(8,targets[obj]),int(targets[obj]*factor))
    if sum(targets.values()) > limit: raise RuntimeError("Explorer component allocation exceeds its copy budget")
    return targets


def surface(data):
    # Preserve the exact source corner streams in packed buffers. The
    # detailed source remains intact; only snapshot storage is smaller.
    data.calc_loop_triangles()
    points = array("f",[0])*(len(data.vertices)*3)
    normals = array("f",[0])*(len(data.loops)*3)
    faces = array("i",[0])*(len(data.loop_triangles)*3)
    corners = array("i",[0])*len(faces)
    data.vertices.foreach_get("co",points)
    data.corner_normals.foreach_get("vector",normals)
    data.loop_triangles.foreach_get("vertices",faces)
    data.loop_triangles.foreach_get("loops",corners)
    pigment = data.color_attributes.get("AO")
    if not pigment or pigment.domain != "CORNER": raise RuntimeError("Explorer source CORNER pigment is absent")
    colours = array("f",[0])*(len(pigment.data)*4)
    pigment.data.foreach_get("color",colours)
    tree = BVHTree.FromPolygons([tuple(points[i:i+3]) for i in range(0,len(points),3)],
        [tuple(faces[i:i+3]) for i in range(0,len(faces),3)],all_triangles=True)
    size = sum(len(a)*a.itemsize for a in (points,normals,faces,corners,colours))
    return tree,points,normals,colours,faces,corners,size


def reduce(obj, target):
    before = triangles(obj)
    if before <= target: return {"name":obj.name,"source":before,"copy":before}
    tree,points,normals,colours,faces,corners,snapshot_bytes = surface(obj.data)
    groups = {group.name for group in obj.vertex_groups}
    select(obj)
    mod = obj.modifiers.new("Independent Explorer copy reduction", "DECIMATE")
    mod.decimate_type = "COLLAPSE"; mod.ratio = target/before
    mod.use_collapse_triangulate = True
    while obj.modifiers[0] != mod: bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    sampled = {}; sampled_colours = {}
    for vertex in obj.data.vertices:
        point,normal,index,_ = tree.find_nearest(vertex.co)
        a,b,c = (Vector(points[k*3:k*3+3]) for k in faces[index*3:index*3+3])
        source_corners = corners[index*3:index*3+3]
        ns = [Vector(normals[k*3:k*3+3]) for k in source_corners]
        cs = [Vector(colours[k*4:k*4+3]) for k in source_corners]
        n = barycentric_transform(point,a,b,c,*ns)
        colour = barycentric_transform(point,a,b,c,*cs)
        sampled[vertex.index] = tuple(n.normalized() if n.length > 1e-8 else normal)
        sampled_colours[vertex.index] = tuple(max(0,min(1,c)) for c in colour)+(1,)
    obj.data.normals_split_custom_set([sampled[loop.vertex_index] for loop in obj.data.loops])
    for attr in list(obj.data.color_attributes): obj.data.color_attributes.remove(attr)
    pigment = obj.data.color_attributes.new("AO","FLOAT_COLOR","CORNER")
    for loop in obj.data.loops: pigment.data[loop.index].color = sampled_colours[loop.vertex_index]
    obj.data.color_attributes.active_color = pigment; obj.data.color_attributes.render_color_index = 0
    if obj.get("continuousSkin"):
        if {group.name for group in obj.vertex_groups} != groups or not all(vertex.groups for vertex in obj.data.vertices):
            raise RuntimeError("Explorer reduction lost a skin group's deform ownership")
    return {"name":obj.name,"source":before,"copy":triangles(obj),
            "sampledSourceCornerNormals":True,"sampledSourceCornerPigment":True,
            "packedSourceBytes":snapshot_bytes}


def apply_topology(obj):
    select(obj)
    for mod in list(obj.modifiers):
        if mod.type == "ARMATURE": continue
        if mod.type == "SUBSURF": mod.render_levels = mod.levels
        while obj.modifiers[0] != mod: bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)


def join_with_streams(objects, name):
    """Native joining preserves deform groups and the single pigment stream.

    Restore sampled source normals only after an explicit corner-order check.
    This also refuses a join which silently drops or rewrites cheek pigment.
    """
    active = objects[0]; select(active)
    for obj in objects: obj.select_set(True)
    objects = [active]+[obj for obj in bpy.context.selected_editable_objects if obj != active]
    frame = active.matrix_world.copy(); inverse = frame.inverted()
    coordinates = []; normals = []; pigments = []
    for obj in objects:
        change = inverse@obj.matrix_world
        normal_frame = change.to_3x3().inverted().transposed()
        coordinates.extend(tuple(change@obj.data.vertices[loop.vertex_index].co) for loop in obj.data.loops)
        normals.extend(tuple((normal_frame@n.vector).normalized()) for n in obj.data.corner_normals)
        ao = obj.data.color_attributes.get("AO")
        if not ao or ao.domain != "CORNER": raise RuntimeError("Explorer join needs the one CORNER pigment stream")
        pigments.extend(tuple(entry.color) for entry in ao.data)
    bpy.ops.object.join(); obj = active; obj.name = name
    actual = np.array([tuple(obj.data.vertices[loop.vertex_index].co) for loop in obj.data.loops])
    if len(actual) != len(coordinates) or not np.allclose(actual,np.array(coordinates),atol=1e-6,rtol=0):
        raise RuntimeError("Explorer joining changed corner order; normals/colour cannot be restored safely")
    obj.data.normals_split_custom_set(normals)
    ao = obj.data.color_attributes.get("AO")
    if not ao or len(ao.data) != len(pigments): raise RuntimeError("Explorer joining dropped source pigment")
    for entry, colour in zip(ao.data,pigments): entry.color = colour
    if not obj.data.has_custom_normals: raise RuntimeError("Explorer source normals lost at consolidation")
    return obj


def consolidate(root):
    buckets = {}
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.name in FACE or len(obj.data.materials) != 1: continue
        if obj.get("continuousSkin"): key = ("skin",obj.parent,obj.data.materials[0])
        elif obj.parent_type == "BONE": key = ("rigid",obj.parent,obj.parent_bone,obj.data.materials[0])
        else: continue
        buckets.setdefault(key,[]).append(obj)
    for key, objects in buckets.items():
        if len(objects) < 2: continue
        material = key[-1]
        if key[0] == "skin":
            obj = join_with_streams(objects,"explorer.connected-"+material.name.split(":")[0])
            obj["continuousSkin"] = True
        else:
            bone = key[2]
            obj = join_with_streams(objects,"explorer."+bone.removeprefix("explorer.")+"-"+material.name.split(":")[0])
            world = obj.matrix_world.copy()
            obj.parent = key[1]; obj.parent_type = "BONE"; obj.parent_bone = bone; obj.matrix_world = world
    kit.refresh()


def bake_with_pigment(meshes):
    """AO bake replaces AO; multiply the saved authored pigment back in.

    Cheeks/nose are encoded in AO before reduction, so deleting other colour
    layers after a plain AO bake would erase them. Keep exactly COLOR_0.
    """
    saved = {}
    for obj in meshes:
        layer = obj.data.color_attributes.get("AO")
        if not layer or layer.domain != "CORNER": raise RuntimeError("Explorer pigment stream is absent before AO")
        saved[obj] = [tuple(entry.color) for entry in layer.data]
    kit.bake_ao(meshes,samples=32,distance=.18)
    for obj in meshes:
        layer = obj.data.color_attributes.get("AO")
        if not layer or len(layer.data) != len(saved[obj]): raise RuntimeError("Explorer AO bake changed pigment corner count")
        for entry,pigment in zip(layer.data,saved[obj]):
            occlusion = entry.color
            entry.color = tuple(occlusion[i]*pigment[i] for i in range(3))+(1,)
        for other in list(obj.data.color_attributes):
            if other != layer: obj.data.color_attributes.remove(other)
        obj.data.color_attributes.active_color = layer
        obj.data.color_attributes.render_color_index = 0
    return {"method":"saved source CORNER pigment multiplied by baked AO in COLOR_0",
            "meshes":len(meshes),"colouredCorners":sum(sum(min(p[:3])<.999 for p in saved[obj]) for obj in meshes)}


def reduce_reviewed_master(master, copy, version="v2", memory=None):
    current = fingerprints(version)
    stamp = BASE/("source-inspected-"+version+".json")
    if not stamp.is_file(): raise RuntimeError("Open the current real Explorer source renders and record source-inspected before reduction")
    approved = json.loads(stamp.read_text())
    if any(approved.get(key) != value for key,value in current.items()) or not approved.get("allowReduction"):
        raise RuntimeError("Explorer source inspection is stale or has not allowed a runtime copy")
    if approved.get("masterSHA256")!=hashlib.sha256(Path(master).read_bytes()).hexdigest():
        raise RuntimeError("Explorer master changed after the opened source inspection")
    index = json.loads((BASE/("source-"+version)/"render-index.json").read_text())
    if not index.get("complete") or any(index.get(key) != value for key,value in current.items()):
        raise RuntimeError("Explorer source render set is incomplete or stale")
    measurement = json.loads((BASE/("source-"+version)/"measurements.json").read_text())
    if not measurement.get("footprintWithinEightPercent"):
        raise RuntimeError("Explorer source dimensions exceed the eight percent native-scale tolerance")
    if not approved.get("inspectedRenders") or set(index["renders"])-set(approved["inspectedRenders"]):
        raise RuntimeError("Explorer source inspection does not cover every current render")
    bpy.ops.wm.open_mainfile(filepath=str(master))
    root = bpy.data.objects["explorer"]; validate_fingerprint(root)
    if not root.get("qualityMaster"): raise RuntimeError("Explorer runtime must come from its detailed master")
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    for obj in meshes: apply_topology(obj)
    if memory:memory("runtime-source-evaluated")
    targets = allocate(meshes)
    records=[]
    for obj,target in targets.items():
        records.append(dict(reduce(obj,target),allocation=target))
        if memory:memory("runtime-component-"+obj.name)
    consolidate(root)
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    colour = bake_with_pigment(meshes)
    if memory:memory("runtime-ao")
    total = sum(triangles(obj) for obj in meshes)
    if total > 30000: raise RuntimeError(f"Explorer runtime {total} exceeds30k; revise the allocation")
    root["qualityMaster"] = False; root["runtimeTriangles"] = total
    root["runtimeSource"] = str(Path(master).name)
    root["sourceInspection"] = stamp.name
    root["pigmentPreserved"] = True
    root["arenaReviewedAO"] = True # figures.py skips its generic pigment-erasing rebake.
    root["reviewMovesSHA256"] = current["movesSha256"]
    root["reviewReachSHA256"] = current["reachSha256"]
    keep = set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep: bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.preferences.filepaths.save_version = 0
    copy = Path(copy); copy.parent.mkdir(parents=True,exist_ok=True)
    if fingerprints(version) != current:
        raise RuntimeError("Explorer source/moves/reach changed while reducing; repeat the current inspection/reduction")
    bpy.ops.wm.save_as_mainfile(filepath=str(copy),compress=True)
    (BASE/("runtime-reduction-"+version+".json")).write_text(json.dumps({
        "source":str(master),"runtime":str(copy),**current,
        "triangles":total,"target":TARGET,"allocated":sum(targets.values()),
        "colour":colour,"components":records},indent=2)+"\n")
    return root


def load_reviewed_copy(root_name="explorer",path=None):
    if root_name != "explorer": raise ValueError("Explorer identity stays stable")
    copy=Path(path or os.environ.get("EXPLORER_RUNTIME_PATH",str(COPY)))
    if not copy.is_file(): raise RuntimeError("Root must install an inspected frozen Explorer runtime before switching its live collector")
    with bpy.data.libraries.load(str(copy),link=False) as (source,loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj and not obj.users_collection: bpy.context.scene.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj and obj.name == root_name)
    validate_fingerprint(root)
    if root.get("qualityMaster") or not root.get("pigmentPreserved") or not root.get("arenaReviewedAO"):
        raise RuntimeError("Explorer cache lacks its reviewed runtime/colour contract")
    rig = next(obj for obj in kit.descendants(root) if obj.type == "ARMATURE")
    assert len(rig.data.bones) == 23 and rig.get("arenaCommonAxes")
    assert all(abs(bone.matrix_basis[row][col]-(1 if row == col else 0)) < 1e-7
               for bone in rig.pose.bones for row in range(4) for col in range(4))
    assert all(name in bpy.data.objects for name in FACE)
    assert sum(triangles(obj) for obj in kit.descendants(root) if obj.type == "MESH") <= 30000
    kit.refresh(); return root
