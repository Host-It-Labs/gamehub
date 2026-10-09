"""Measured runtime copy of the independently reviewed Cowboy source.

The detailed master is never reduced in place. Material-specific curvature
reduction protects the authored face and connected digits without spending
their topology on hidden nails, flat linings, or uniform cloth sections.
Native pivots, vertex groups, armatures and rigid attachments stay intact.
"""
import json
import math

import bmesh
import bpy
from mathutils import Vector

import kit
import figure_ranger_sculpt as sculpt
import figure_ranger_tailoring as base


def triangles(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def material_targets(name):
    """First reviewed-copy allocation; source values are deliberately free."""
    if name=='ranger.head':
        return {sculpt.SKIN:2600,sculpt.HAIR:230,sculpt.LIPS:65,sculpt.INK:36}
    if name=='ranger.torso':
        return {base.TEAM:270,base.CHAR:80,base.DARK:300,base.BRASS:400,
                base.DUSTER:1050,base.LEATHER:100}
    if name=='ranger.hat':
        return {base.FELT:750,base.DARK:200,base.BRASS:36}
    if 'fore' in name and name.endswith('-surface'):
        return {base.DUSTER:128,base.TEAM:300,sculpt.SKIN:1000,sculpt.NAIL:64}
    if 'eyeL' in name or 'eyeR' in name:
        return {sculpt.WHITE:120,sculpt.SKIN:100}
    if 'pupilL' in name or 'pupilR' in name:
        return {sculpt.IRIS:60,sculpt.INK:45,sculpt.WHITE:16}
    if 'knee' in name and name.endswith('-surface'):
        return {base.LEATHER:350,base.DARK:60,base.STEEL:60,base.BRASS:32}
    if 'foot' in name and name.endswith('-surface'):
        return {base.LEATHER:200,base.DARK:72,base.STEEL:80,base.BRASS:40}
    if name=='ranger.weapon':
        return {base.STEEL:300,base.BRASS:140,base.WALNUT:550,sculpt.INK:80}
    return None


def object_target(obj):
    name=obj.name
    if 'sleeve-connected-' in name:return 800
    if 'trousers-connected-' in name:return 550
    if name=='ranger.skirtL':return 700
    if name=='ranger.skirtR':return 500
    if name=='ranger.beard':return 130
    if name=='ranger.cape2':return 240
    if name=='ranger.holsterR':return 300
    if name.startswith('ranger.brow'):return 60
    if name=='ranger.mouth':return 60
    # The lever's fulcrum and the original muzzle are meaningful geometry.
    return triangles(obj)


def collapse(obj,target):
    count=triangles(obj)
    if count<=target:return count
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Reviewed separate runtime curvature reduction','DECIMATE')
    mod.decimate_type='COLLAPSE';mod.ratio=max(.0001,target/count)
    mod.use_collapse_triangulate=True
    # Deformation stays live. Reduce base topology before the Armature,
    # rather than evaluating/baking a skinned mesh into a rigid result.
    while obj.modifiers.find(mod.name)>0:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.shade(obj,75 if 'weapon' not in obj.name else 55)
    return triangles(obj)


def material_copy(obj,index):
    """An independent material component, including all deform/UV data."""
    piece=obj.copy();piece.data=obj.data.copy()
    piece.name=obj.name+'-runtime-material-'+str(index)
    bpy.context.collection.objects.link(piece)
    bm=bmesh.new();bm.from_mesh(piece.data)
    rejected=[f for f in bm.faces if f.material_index!=index]
    bmesh.ops.delete(bm,geom=rejected,context='FACES')
    unused=[v for v in bm.verts if not v.link_faces]
    if unused:bmesh.ops.delete(bm,geom=unused,context='VERTS')
    for f in bm.faces:f.material_index=0
    bm.to_mesh(piece.data);bm.free();piece.data.update()
    material=obj.data.materials[index]
    piece.data.materials.clear();piece.data.materials.append(material)
    return piece


def reduce_materials(obj,targets):
    # Keep the original joint object, transforms, named children and groups.
    # Only replace its mesh datablock with the separately reduced components.
    used=sorted({p.material_index for p in obj.data.polygons})
    pieces=[]
    for index in used:
        name=obj.data.materials[index].name
        piece=material_copy(obj,index)
        if obj.name=='ranger.head' and name==sculpt.SKIN:
            reduce_face_islands(piece)
        else:collapse(piece,targets.get(name,triangles(piece)))
        pieces.append(piece)
    bpy.ops.object.select_all(action='DESELECT')
    for piece in pieces:piece.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    if len(pieces)>1:bpy.ops.object.join()
    joined=pieces[0];old=obj.data;obj.data=joined.data
    bpy.data.objects.remove(joined,do_unlink=True)
    if old.users==0:bpy.data.meshes.remove(old)
    return triangles(obj)


def reduce_face_islands(obj):
    """Spend facial topology on the broad skull, rather than tiny ear relief."""
    me=obj.data;neighbours=[[] for v in me.vertices]
    for edge in me.edges:
        a,b=edge.vertices;neighbours[a].append(b);neighbours[b].append(a)
    seen=set();islands=[]
    for vertex in me.vertices:
        if vertex.index in seen:continue
        stack=[vertex.index];seen.add(vertex.index);ids=set()
        while stack:
            i=stack.pop();ids.add(i)
            for j in neighbours[i]:
                if j not in seen:seen.add(j);stack.append(j)
        islands.append(ids)
    pieces=[]
    for ids in islands:
        piece=obj.copy();piece.data=me.copy();bpy.context.collection.objects.link(piece)
        bm=bmesh.new();bm.from_mesh(piece.data);bm.verts.ensure_lookup_table()
        rejected=[f for f in bm.faces if f.verts[0].index not in ids]
        bmesh.ops.delete(bm,geom=rejected,context='FACES')
        unused=[v for v in bm.verts if not v.link_faces]
        if unused:bmesh.ops.delete(bm,geom=unused,context='VERTS')
        bm.to_mesh(piece.data);bm.free();piece.data.update()
        n=triangles(piece)
        if n>20000:
            # A curvature collapse leaves enormous faces across the chin and
            # forehead, even with correct source normals. Sample the same
            # authored source profile in a regular facial cage instead.
            retopologize_skull(piece)
        else:
            target=140 if n>2000 else 75 if n>600 else 60
            collapse(piece,min(n,target))
        pieces.append(piece)
    bpy.ops.object.select_all(action='DESELECT')
    for piece in pieces:piece.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    if len(pieces)>1:bpy.ops.object.join()
    joined=pieces[0];old=obj.data;obj.data=joined.data
    bpy.data.objects.remove(joined,do_unlink=True)
    if old.users==0:bpy.data.meshes.remove(old)


def retopologize_skull(obj):
    """Keep deliberate loops across the reviewed chin, lips and brow planes."""
    sculpt.prepare_palette()
    angles=[-180,-160,-140,-120,-100,-85]+list(range(-70,71,5))+[85,100,120,140,160]
    zs=[1.013,1.050,1.057,1.063,1.068,1.073,1.078,
        1.0825,1.0865,1.0903,1.0945,1.096,1.0995,1.101,1.110,1.115,
        1.123,1.133,1.144,1.155,1.167,1.177,1.205,1.264]
    mesh=sculpt.rk.Mesh('ranger-runtime-authored-face-cage',sculpt.SKIN)
    offset=Vector((0,0,base.HEAD_DZ))-base.NECK
    rows=[[mesh.v(base.face_point(a,z)+offset) for a in angles] for z in zs]
    mesh.grid(rows,sculpt.SKIN,closed=True)
    mesh.fan(rows[0],Vector((0,base.CY,1.006))+offset,sculpt.SKIN,flip=True)
    mesh.fan(rows[-1],Vector((0,base.CY-.005,1.268))+offset,sculpt.SKIN)
    cage=mesh.obj(recalc=True);old=obj.data;obj.data=cage.data
    bpy.data.objects.remove(cage,do_unlink=True)
    if old.users==0:bpy.data.meshes.remove(old)
    kit.shade(obj,180)
    sculpt.rk.uv_box(obj)


def source_normals(obj,source,material):
    """Bake the approved sculpt's smooth normals onto the reduced topology."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Approved sculpt surface normals','DATA_TRANSFER')
    mod.object=source;mod.use_loop_data=True
    mod.data_types_loops={'CUSTOM_NORMAL'}
    mod.loop_mapping='POLYINTERP_NEAREST'
    mod.mix_mode='REPLACE';mod.mix_factor=1.0
    mask=obj.vertex_groups.new(name='__approved-source-normal-mask')
    ids={v for p in obj.data.polygons if obj.data.materials[p.material_index].name==material for v in p.vertices}
    mask.add(sorted(ids),1,'REPLACE');mask_name=mask.name;mod.vertex_group=mask_name
    while obj.modifiers.find(mod.name)>0:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    current=obj.vertex_groups.get(mask_name)
    if current:obj.vertex_groups.remove(current)


def reduce_copy(root):
    """Operate only on the loaded/constructed copy, never the saved master."""
    report=[]
    for obj in kit.descendants(root):
        if obj.type!='MESH':continue
        normal_material=sculpt.SKIN if obj.name=='ranger.head' else base.FELT if obj.name=='ranger.hat' else None
        source=None
        if normal_material:
            index=next(i for i,m in enumerate(obj.data.materials) if m.name==normal_material)
            source=material_copy(obj,index)
            source.name='__Cowboy approved normal source';source.hide_render=True
        before=triangles(obj);targets=material_targets(obj.name)
        after=reduce_materials(obj,targets) if targets else collapse(obj,object_target(obj))
        if source:
            source_normals(obj,source,normal_material)
            old=source.data;bpy.data.objects.remove(source,do_unlink=True)
            if old.users==0:bpy.data.meshes.remove(old)
        report.append({'part':obj.name,'sourceTriangles':before,'runtimeTriangles':after})
    # Attribute topology changed. Re-author pigment on the resulting surfaces;
    # it remains generic data until a fresh AO bake is combined by finish_ao.
    sculpt.author_pigment(root)
    kit.fill_ao([o for o in kit.descendants(root) if o.type=='MESH'])
    sculpt.finish_ao(root)
    total=sum(r['runtimeTriangles'] for r in report)
    print('RANGER_RUNTIME_ALLOCATION',json.dumps({'triangles':total,'parts':report}),flush=True)
    assert total<=17200, f'Cowboy copy exceeds measured original ceiling: {total}'
    root['unoptimized']=False;root['runtimeTriangles']=total
    root['reviewedSource']='ranger-master-v3; parent source stills and actual Arena motion'
    root['runtimeReduction']=json.dumps(report)
    print('RANGER_RUNTIME_REDUCTION',json.dumps({'triangles':total,'parts':report}),flush=True)
    return report


def build_runtime():
    root=sculpt.build_master()
    # The accepted V5 copy was reduced from its saved five-degree head pose.
    # Pigment samples world positions; reproduce that pose during reduction,
    # then return the neutral source frame for figures.py's usual tilt.
    head=next(o for o in kit.descendants(root) if o.name=='ranger.head')
    rest=head.rotation_euler.copy()
    try:
        head.rotation_euler.x=math.radians(5)
        kit.refresh()
        reduce_copy(root)
    finally:
        head.rotation_euler=rest
        kit.refresh()
    return root
