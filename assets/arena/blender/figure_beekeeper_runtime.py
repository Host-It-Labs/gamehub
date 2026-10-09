"""Separate Beekeeper game-copy reduction; never alters the detailed source.

Run only after the master review gate. Normal builds append the frozen copy;
they do not remesh, sculpt or decimate it. All extra surface colour exports
through one active AO channel, and rigid attachments retain their bone frames.
"""
from pathlib import Path
import hashlib
import json
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
import kit

HERE = Path(__file__).resolve().parent
CACHE = HERE / "runtime" / "beekeeper-runtime-v2.blend"
R = "beekeeper"
FACE = {R+p for p in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth")}


def triangles(o):
    return sum(len(p.vertices)-2 for p in o.data.polygons)


def source_fingerprint():
    digest=hashlib.sha256()
    for name in ("figure_beekeeper_sculpt.py","figure_folk_kit.py","kit.py"):
        digest.update(name.encode());digest.update((HERE/name).read_bytes())
    return digest.hexdigest()


def recipe_fingerprint():
    digest=hashlib.sha256(source_fingerprint().encode())
    for name in ("figure_beekeeper_runtime.py","figure_beekeeper_grip.py"):
        digest.update(name.encode());digest.update((HERE/name).read_bytes())
    return digest.hexdigest()


def load_runtime(root_name=R):
    if root_name != R:raise ValueError("Beekeeper skeleton identity is fixed")
    if not CACHE.is_file():
        raise FileNotFoundError(f"Missing {CACHE}; run figure_beekeeper_review.py source/review gate first")
    metrics=HERE.parents[2]/"work/arena/2026-10-08-roster/beekeeper/runtime-metrics-v2.json"
    if not metrics.is_file():raise RuntimeError("Beekeeper runtime stage has not completed its render/metrics set")
    record=json.loads(metrics.read_text())
    if record.get("runtimeSHA256")!=hashlib.sha256(CACHE.read_bytes()).hexdigest():
        raise RuntimeError("Beekeeper runtime metrics do not match the frozen copy")
    with bpy.data.libraries.load(str(CACHE),link=False) as (source,loaded):
        loaded.objects=list(source.objects)
    for o in loaded.objects:
        if o:bpy.context.collection.objects.link(o)
    root=next(o for o in loaded.objects if o and o.name==R)
    assert len(kit.descendants(root))==len(loaded.objects),"Runtime cache must contain only this figure hierarchy"
    if root.get("sourceFingerprint")!=source_fingerprint():
        raise RuntimeError("Beekeeper frozen copy is stale for the reviewed source")
    if root.get("runtimeRecipeFingerprint")!=recipe_fingerprint():
        raise RuntimeError("Beekeeper frozen copy predates the current grip/reduction recipe")
    root["runtimeCopySource"]="runtime/"+CACHE.name
    kit.refresh()
    return root


def consolidate(root):
    groups={}
    for o in kit.descendants(root):
        if o.type=="MESH" and o.parent_type=="BONE" and o.name not in FACE:
            groups.setdefault((o.parent,o.parent_bone),[]).append(o)
    for (rig,bone),parts in groups.items():
        if len(parts)<2:continue
        joined=kit.join(parts,bone+"-rigid-surfaces")
        world=joined.matrix_world.copy()
        joined.parent=rig;joined.parent_type="BONE";joined.parent_bone=bone;joined.matrix_world=world


def budget(o):
    name=o.name
    if "sewn-blouse" in name:return 6300
    if "head-skin" in name:return 3800
    # The connected glove now contains its palm, thumb and four fingers.
    # Preserve their previous combined allowance; the generic 70-triangle
    # fallback would erase the new grip when a reviewed copy is built.
    if "glove-shell1" in name:return 2150
    if "glove-shell" in name:return 1950
    if "glove-palm" in name:return 900
    if name in FACE:
        return 140 if "eye" in name else 220 if "mouth" in name else 110
    if o.parent_type=="BONE":
        part=o.parent_bone.split(".",1)[-1]
        # Only the stitched lines remain rigid on the hands. The fingers
        # now share the 1,950-triangle continuous glove allowance above.
        return {"handL":100,"handR":100,"hair":1550,"hat":1700,
                "cape":650,"extra":1050,"weapon":1100,"extra2":100,
                "head":1000}.get(part,250)
    if "apron-skirt" in name:return 1800
    if "apron-bib" in name:return 700
    if "trouser" in name:return 650
    if "boot-foot" in name:return 400
    if "boot-shaft" in name:return 300
    if "boot-welt" in name:return 80
    if "boot-lace" in name:return 24
    if "hive-harness" in name:return 170
    if "harness-buckle" in name:return 70
    if "apron-strap" in name:return 160
    if "apron-waist-band" in name:return 240
    if "apron-pocket" in name:return 220
    if "pocket-stitch" in name:return 60
    if "collar" in name:return 130
    return 70


def reduce(o,target):
    """Master-derived smooth normals preserve broad clay planes after collapse."""
    if triangles(o)<=target:return
    source=o.data
    source.calc_loop_triangles()
    points=np.empty((len(source.vertices),3),dtype=np.float64)
    smooth=np.empty_like(points)
    faces=np.empty((len(source.loop_triangles),3),dtype=np.int32)
    source.vertices.foreach_get("co",points.ravel())
    source.vertices.foreach_get("normal",smooth.ravel())
    source.loop_triangles.foreach_get("vertices",faces.ravel())
    surface=BVHTree.FromPolygons(points.tolist(),faces.tolist(),all_triangles=True)
    mod=o.modifiers.new("Separate measured game copy","DECIMATE")
    mod.ratio=target/triangles(o);mod.use_collapse_triangulate=True
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active=o
    # Collapse the neutral source before its armature modifier; Blender then
    # propagates the authored bone weights instead of baking a deformation.
    while o.modifiers[0]!=mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    normals=np.empty((len(o.data.vertices),3),dtype=np.float32)
    for vertex in o.data.vertices:
        point,face_normal,face_index,_=surface.find_nearest(vertex.co)
        if point is None:
            normals[vertex.index]=vertex.normal
            continue
        a,b,c=faces[face_index]
        normal=barycentric_transform(point,Vector(points[a]),Vector(points[b]),Vector(points[c]),
                                     Vector(smooth[a]),Vector(smooth[b]),Vector(smooth[c]))
        normals[vertex.index]=normal.normalized() if normal.length>.00001 else face_normal
    cache=o.data.attributes.get("BeekeeperSourceNormals") or o.data.attributes.new(
        name="BeekeeperSourceNormals",type="FLOAT_VECTOR",domain="POINT")
    cache.data.foreach_set("vector",normals.ravel())
    for p in o.data.polygons:p.use_smooth=True
    o.data.normals_split_custom_set_from_vertices(normals.tolist())


def normalize_skin(o):
    """Retain four normalized influences after topology interpolation."""
    if not any(mod.type=="ARMATURE" for mod in o.modifiers):return
    groups={group.index:group for group in o.vertex_groups}
    for vertex in o.data.vertices:
        weights=sorted([(g.group,g.weight) for g in vertex.groups if g.weight>0],
                       key=lambda pair:pair[1],reverse=True)
        if not weights:raise RuntimeError(f"Unweighted {o.name} vertex {vertex.index}")
        keep=weights[:4];total=sum(weight for _,weight in keep)
        for index,_ in weights[4:]:groups[index].remove([vertex.index])
        for index,weight in keep:groups[index].add([vertex.index],weight/total,"REPLACE")


def prepare_copy(root):
    """The root accepted v2 with one correction in this independent copy."""
    for o in kit.descendants(root):
        if o.type=="ARMATURE":
            for bone in o.pose.bones:bone.rotation_mode="QUATERNION";bone.rotation_quaternion.identity()
    kit.refresh()
    from figure_beekeeper_grip import replace_right_grip
    from figure_beekeeper_sculpt import pigment
    replace_right_grip(root)
    pigment(root)
    kit.refresh()
    return root


def build_copy(root,prepared=False):
    # Consolidation changes only the independent copy loaded from disk.
    if not prepared:prepare_copy(root)
    kit.refresh();consolidate(root)
    for o in kit.descendants(root):
        if o.type=="MESH":
            reduce(o,budget(o));normalize_skin(o)
    kit.refresh()
    count=sum(triangles(o) for o in kit.descendants(root) if o.type=="MESH")
    # Root, 9 October: the brief says about 20-30k; 30,023 came out of v2.
    if not 20000<=count<=30500:
        raise RuntimeError(f"Beekeeper runtime is outside the reviewed 20-30k budget: {count}")
    root["runtimeTriangles"]=count
    root["runtimeCopyRequired"]=False
    root["runtimeVersion"]="v2"
    root["runtimeRecipeFingerprint"]=recipe_fingerprint()
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    # The source's shader colour is not the AO cache. Rebake this copy only,
    # then combine its retained pigment into one export channel.
    kit.fill_ao(meshes,1.0)
    original_gpu=kit.gpu
    def cpu():
        scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.device="CPU"
    try:
        kit.gpu=cpu
        kit.bake_ao(meshes,samples=32,distance=.10)
    finally:
        kit.gpu=original_gpu
    finish_ao(root)
    # This flag selects frozen authored AO, not a statement of visual
    # acceptance. The source/reduced-copy review remains a separate gate.
    root["arenaReviewedAO"]=True
    return root


def finish_ao(root):
    for o in kit.descendants(root):
        if o.type!="MESH":continue
        me=o.data;ao=me.color_attributes.get("AO");pig=me.attributes.get("BeekeeperPigment")
        if not ao or not pig:continue
        rgba=np.empty((len(me.loops),4),dtype=np.float32);ao.data.foreach_get("color",rgba.ravel())
        colors=np.empty((len(me.vertices),3),dtype=np.float32);pig.data.foreach_get("vector",colors.ravel())
        ix=np.array([l.vertex_index for l in me.loops])
        # Avoid excessively dark creases at miniature scale.
        rgba[:,:3]=np.maximum(.34,rgba[:,:3])*colors[ix]
        rgba[:,3]=1
        ao.data.foreach_set("color",rgba.ravel())
        for attr in list(me.color_attributes):
            if attr.name!="AO":me.color_attributes.remove(attr)
        me.color_attributes.active_color=ao;me.color_attributes.render_color_index=0


def save_cache(root,path=CACHE):
    path.parent.mkdir(parents=True,exist_ok=True)
    bpy.data.libraries.write(str(path),set(kit.descendants(root)),fake_user=False,compress=True)
    return path
