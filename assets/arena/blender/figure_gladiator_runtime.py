"""Separately reduce a visually reviewed Gladiator source.

The editable master is never replaced. This reproducible helper keeps the
continuous skin/weights, samples source normals and consolidates attachments
only after source anatomy, materials and complete Arena motion were reviewed.
"""
import json

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit

MAX_TRIANGLES=19160
MAX_PRIMITIVES=72
SKIN_TRIANGLES=9400
FACE_CONTROLS={"gladiator."+p for p in ("eyeL","eyeR","pupilL","pupilR","browL","browR","mouth")}


def triangles(o):
    return sum(len(p.vertices)-2 for p in o.data.polygons)


def select(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True);bpy.context.view_layer.objects.active=o


def surface(me,split_normals=False):
    me.calc_loop_triangles()
    coords=np.empty(len(me.vertices)*3,dtype=np.float64)
    normals=np.empty((len(me.loops) if split_normals else len(me.vertices))*3,dtype=np.float64)
    faces=np.empty(len(me.loop_triangles)*3,dtype=np.int32)
    me.vertices.foreach_get("co",coords)
    if split_normals:me.corner_normals.foreach_get("vector",normals)
    else:me.vertices.foreach_get("normal",normals)
    me.loop_triangles.foreach_get("vertices",faces)
    coords,normals,faces=coords.reshape(-1,3),normals.reshape(-1,3),faces.reshape(-1,3)
    tree=BVHTree.FromPolygons(coords.tolist(),faces.tolist(),all_triangles=True)
    loops=None
    if split_normals:
        loops=np.empty(len(me.loop_triangles)*3,dtype=np.int32)
        me.loop_triangles.foreach_get("loops",loops)
        loops=loops.reshape(-1,3)
    return tree,coords,normals,faces,loops


def source_normals(me,source):
    tree,coords,normals,faces,loops=source
    result=np.empty((len(me.vertices),3),dtype=np.float32)
    for vertex in me.vertices:
        point,normal,index,_=tree.find_nearest(vertex.co)
        a,b,c=faces[index]
        na,nb,nc=loops[index] if loops is not None else (a,b,c)
        n=barycentric_transform(point,Vector(coords[a]),Vector(coords[b]),Vector(coords[c]),
                                Vector(normals[na]),Vector(normals[nb]),Vector(normals[nc]))
        result[vertex.index]=n.normalized() if n.length>1e-7 else normal
    cache=me.attributes.get("GladiatorSourceNormals") or me.attributes.new(
        "GladiatorSourceNormals","FLOAT_VECTOR","POINT")
    cache.data.foreach_set("vector",result.reshape(-1))
    for p in me.polygons:p.use_smooth=True
    me.normals_split_custom_set_from_vertices(result.tolist())


def reduce_mesh(o,target,normal_bake=False,split_normals=False):
    before=triangles(o)
    if before<=target:return {"name":o.name,"source":before,"runtime":before}
    ref=surface(o.data,split_normals) if normal_bake else None
    select(o)
    mod=o.modifiers.new("Separate reviewed runtime topology","DECIMATE")
    mod.decimate_type="COLLAPSE";mod.ratio=target/before
    mod.use_collapse_triangulate=True
    while o.modifiers[0]!=mod:bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if ref:source_normals(o.data,ref)
    return {"name":o.name,"source":before,"runtime":triangles(o)}


def budget(name):
    # Budget is allocated to shape and motion, not equally to every stud.
    # Match small fasteners before broad shield/strap names: a shield rivet
    # should not inherit the curved shield shell's topology allowance.
    if "shield-strap-rivet" in name:return 12
    if any(stem in name for stem in ("rivet","stud")):return 20
    if name.endswith("-boss"):return 192
    if "boss" in name:return 40
    if "shield-strap" in name:return 120
    if "sstrap" in name:return 56
    if "gstrap" in name:return 48
    if "laminate-seam" in name:return 44
    if "sband" in name:return 64
    if "waist-lining" in name:return 220
    if "shield" in name:return 220
    if "srim" in name:return 260
    if "bowl" in name:return 440
    if "brim" in name:return 300
    if "cheek" in name:return 170
    if "beard" in name:return 310
    if "moustache" in name:return 84
    if "plume" in name:return 500
    if "greave" in name:return 270
    if "gridge" in name:return 48
    if "upperR" in name:return 190
    if "forearmR" in name:return 160
    if "deltoidR" in name:return 130
    if "pauldron" in name:return 180
    if "elbowR" in name:return 120
    if "under" in name:return 170
    if "strip" in name:return 54
    if "strap" in name:return 80
    if "sole" in name:return 92
    if "lace" in name:return 56
    if "blade" in name:return 240
    if name in FACE_CONTROLS:
        return 140 if "eye" in name else 72 if "pupil" in name else 60
    if "belt" in name:return 220
    if "plate" in name:return 54
    if "grip" in name:return 110
    if "guard" in name:return 120
    if "pommel" in name:return 64
    if "ridge" in name:return 110
    if "band" in name:return 80
    return 76


def consolidate(root):
    buckets={}
    for o in kit.descendants(root):
        if o.type!="MESH" or o.name in FACE_CONTROLS or o.get("continuousSkin"):continue
        if o.parent_type!="BONE" or len(o.data.materials)!=1:continue
        key=(o.parent,o.parent_bone,o.data.materials[0])
        buckets.setdefault(key,[]).append(o)
    joined=[]
    for (rig,bone,mat),pieces in buckets.items():
        if len(pieces)<2:continue
        o=kit.join(pieces,"gladiator."+bone.removeprefix("gladiator.")+"-"+mat.name.split(":")[0])
        world=o.matrix_world.copy()
        o.parent,o.parent_type,o.parent_bone=rig,"BONE",bone
        o.matrix_world=world;joined.append(o.name)
    garments=[o for o in kit.descendants(root) if o.type=="MESH" and o.get("garmentLining")]
    if len(garments)>1:
        # Blender's mesh join retains deform groups and their weights. The
        # general kit join applies modifiers, which would freeze this waist.
        lining=next(o for o in garments if "waist-lining" in o.name)
        select(lining)
        for o in garments:o.select_set(True)
        bpy.ops.object.join()
        lining.name="gladiator.garment"
        lining["garmentLining"]=True
        assert {g.name for g in lining.vertex_groups}=={
            "gladiator.torso","gladiator.skirtL","gladiator.skirtR"}
        joined.append(lining.name)
    return joined


def reduce_runtime(root):
    skin=next(o for o in kit.descendants(root) if o.get("continuousSkin"))
    for mod in list(skin.modifiers):
        if mod.type=="SUBSURF":skin.modifiers.remove(mod)
    report=[reduce_mesh(skin,SKIN_TRIANGLES,True)]
    for o in list(kit.descendants(root)):
        if o.type=="MESH" and o!=skin:
            bowed_shield=o.name=="gladiator-shield" or "sband" in o.name
            report.append(reduce_mesh(o,budget(o.name),normal_bake=bowed_shield,
                                      split_normals=bowed_shield))
    joined=consolidate(root)
    # Join can discard custom corner normals; restore the stored authored
    # skin normals after all topology operations are complete.
    for o in kit.descendants(root):
        if o.type!="MESH":continue
        cache=o.data.attributes.get("GladiatorSourceNormals")
        if not cache:continue
        values=np.empty(len(cache.data)*3,dtype=np.float32)
        cache.data.foreach_get("vector",values)
        o.data.normals_split_custom_set_from_vertices(values.reshape(-1,3).tolist())
    from figure_gladiator_shield_normals import restore_bow
    restore_bow(root)
    # Preserve the reviewed solutions for two tiny symmetric reductions.
    # Their tracked recipe avoids context-dependent collapse edge choices;
    # all continuous anatomy and primary equipment still build from source.
    from figure_gladiator_repro import restore_reviewed
    restore_reviewed(root)
    count=sum(triangles(o) for o in kit.descendants(root) if o.type=="MESH")
    primitives=sum(len({p.material_index for p in o.data.polygons})
                   for o in kit.descendants(root) if o.type=="MESH")
    root["unoptimized"]=False
    root["runtimeSource"]="Reviewed Gladiator continuous anatomical source"
    # The source's authored POINT colour channel has already passed the
    # material review. Global AO baking must not overwrite that pigment.
    root["arenaReviewedAO"]=1
    root["runtimeTriangles"]=count
    root["runtimePrimitives"]=primitives
    root["runtimeReduction"]=json.dumps({"parts":report,"joined":joined})
    print("GLADIATOR REDUCTION",count,"triangles",json.dumps(report),flush=True)
    assert count<=MAX_TRIANGLES,f"Gladiator runtime {count} exceeds measured prior cost {MAX_TRIANGLES}"
    assert primitives<=MAX_PRIMITIVES,f"Gladiator runtime {primitives} material draws exceed prior cost {MAX_PRIMITIVES}"
    for mod in skin.modifiers:mod.show_viewport=True
    kit.refresh()
    return root


def build_runtime():
    # Imported only after the independent source review has been recorded.
    import figure_gladiator as model
    from figure_gladiator_sculpt import build_master
    root=reduce_runtime(build_master(model,evaluate_viewport=False))
    # Return the exact raw driver names needed by the ordinary global
    # exporter. The detailed editable master keeps its dotted bone names.
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    rename={b.name:b.name.replace("gladiator.","gladiator",1) for b in rig.data.bones}
    for b in rig.data.bones:b.name=rename[b.name]
    for o in kit.descendants(root):
        if o.parent_type=="BONE":o.parent_bone=rename.get(o.parent_bone,o.parent_bone)
        if o.type=="MESH":
            for group in o.vertex_groups:group.name=rename.get(group.name,group.name)
    kit.refresh()
    return root
