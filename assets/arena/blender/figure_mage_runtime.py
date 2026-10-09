"""Separate measured game copy of the reviewed Wizard master.

Source V5 remains unrestricted and editable. Collapse happens in the neutral
mesh before its armature, preserving the native sleeve/cape/felt weights and
material boundaries. Authored source normals retain smooth facial and fabric
planes. The planted silver shoe remains independently identifiable by the
Mage-only late terrain solver.
"""
import json
import os
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
from figure_mage_sculpt import attach, build_master, pigment, tailored_robe

MAX_TRIANGLES = 18548
REVIEWED_CACHE = Path(__file__).resolve().parent/'runtime'/'mage-runtime-v11.blend'
FACE_CONTROLS = {'mage'+p for p in ('eyeL','eyeR','pupilL','pupilR','browL','browR','mouth')}
BUDGETS = {
    'mage.boot-L-foot-1': 240,
    'mage.boot-L-shaft-1': 48,
    'mage.boot-L-welt-1': 48,
    'mage.boot-R-foot1': 240,
    'mage.boot-R-shaft1': 48,
    'mage.boot-R-welt1': 48,
    'mage-crown': 64,
    'mage-fireball': 120,
    'mage-spark0': 20,
    'mage-spark1': 20,
    'mage-spark2': 20,
    'mage-tongue0': 32,
    'mage-tongue1': 32,
    'mage-tongue2': 32,
    'mage-tongue3': 32,
    'mage-tongue4': 32,
    'mage-tongue5': 32,
    'mage-tongue6': 32,
    'mage.anatomical-casting-hand': 1400,
    'mage.casting-nail-0': 30,
    'mage.casting-nail-1': 30,
    'mage.casting-nail-2': 30,
    'mage.casting-nail-3': 30,
    'mage.articulated-grip-hand': 1700,
    'mage-claw0': 36,
    'mage-claw1': 36,
    'mage-claw2': 36,
    'mage-claw3': 36,
    'mage-collar.001': 90,
    'mage-crystal': 36,
    'mage-shoe': 80,
    'mage-stub0': 24,
    'mage-stub1': 24,
    'mage.natural-wood-staff': 380,
    'mage-bookcover': 48,
    'mage-bookpages': 48,
    'mage-bookstrap': 48,
    'mage-clasp': 48,
    'mage-corner1-1': 12,
    'mage-corner11': 12,
    'mage-corner-1-1': 12,
    'mage-corner-11': 12,
    'mage-pouch1-bag': 85,
    'mage-pouch1-flap': 24,
    'mage-pouch1-stud': 24,
    'mage-pouch2-bag': 85,
    'mage-pouch2-flap': 24,
    'mage-pouch2-stud': 24,
    'mage-tail': 40,
    'mage.tailored-skirt': 1250,
    'mage.beard-foundation': 80,
    'mage.moustache-1': 80,
    'mage.moustache--1': 80,
    'mage.separated-beard-lock-0': 135,
    'mage.separated-beard-lock-1': 135,
    'mage.separated-beard-lock-2': 135,
    'mage.separated-beard-lock-3': 135,
    'mage.separated-beard-lock-4': 135,
    'mage.separated-beard-lock-5': 135,
    'mage.separated-beard-lock-6': 135,
    'mage-beardshell': 80,
    'mage.cheek-chin-lock-1-0': 40,
    'mage.cheek-chin-lock-1-1': 40,
    'mage.cheek-chin-lock-1-2': 40,
    'mage.cheek-chin-lock--1-0': 40,
    'mage.cheek-chin-lock--1-1': 40,
    'mage.cheek-chin-lock--1-2': 40,
    'mage.ear-1': 60,
    'mage.ear--1': 60,
    'mage.eyelid-1-False': 36,
    'mage.eyelid-1-True': 36,
    'mage.eyelid--1-False': 36,
    'mage.eyelid--1-True': 36,
    'mage.nostril-1': 24,
    'mage.nostril--1': 24,
    'mage.silver-hair-0': 40,
    'mage.silver-hair-1': 40,
    'mage.silver-hair-2': 40,
    'mage.silver-hair-3': 40,
    'mage.silver-hair-4': 40,
    'mage.silver-hair-5': 40,
    'mage.silver-hair-6': 40,
    'mage.silver-hair-7': 40,
    'mage.silver-hair-8': 40,
    'mage.silver-hair-9': 40,
    'mage.silver-hair-10': 40,
    'mage.silver-hair-11': 40,
    'mage.silver-hair-12': 40,
    'mage.silver-hair-13': 40,
    'mage.silver-hair-14': 40,
    'mage.silver-hair-15': 40,
    'mage.silver-hair-16': 40,
    'mage.turned-felt-brim': 400,
    'mage.weathered-face': 1900,
    'magebrowL': 80,
    'magebrowR': 80,
    'magepupilL': 100,
    'mageeyeL': 160,
    'magepupilR': 100,
    'mageeyeR': 160,
    'magemouth': 16,
    'mage-belt': 120,
    'mage-boss1': 32,
    'mage-boss-1': 32,
    'mage-buckle': 64,
    'mage-capelet': 240,
    'mage-chain': 40,
    'mage-clasp1': 48,
    'mage-clasp-1': 48,
    'mage-collar': 90,
    'mage-pin': 48,
    'mage.tailored-bodice': 650,
    'mage.connected-sleeve-L': 900,
    'mage.connected-sleeve-R': 900,
    'mage.continuous-felt-cone': 600,
    'mage.continuous-travelling-cape': 900,
    'mage.hidden-leg-1': 80,
    'mage.hidden-leg--1': 80,
}

def triangles(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def select(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj


def source_surface(mesh):
    mesh.calc_loop_triangles()
    points=np.empty(len(mesh.vertices)*3,dtype=np.float64)
    normals=np.empty_like(points)
    faces=np.empty(len(mesh.loop_triangles)*3,dtype=np.int32)
    mesh.vertices.foreach_get('co',points)
    mesh.vertices.foreach_get('normal',normals)
    mesh.loop_triangles.foreach_get('vertices',faces)
    points,normals,faces=points.reshape(-1,3),normals.reshape(-1,3),faces.reshape(-1,3)
    tree=BVHTree.FromPolygons(points.tolist(),faces.tolist(),all_triangles=True)
    return tree,points,normals,faces


def sample_normals(mesh,surface):
    tree,points,normals,faces=surface
    baked=np.empty((len(mesh.vertices),3),dtype=np.float32)
    for vertex in mesh.vertices:
        point,face_normal,index,_=tree.find_nearest(vertex.co)
        a,b,c=faces[index]
        normal=barycentric_transform(point,Vector(points[a]),Vector(points[b]),Vector(points[c]),
                                     Vector(normals[a]),Vector(normals[b]),Vector(normals[c]))
        baked[vertex.index]=normal.normalized() if normal.length>.00001 else face_normal
    cache=mesh.attributes.get('MageSourceNormals') or mesh.attributes.new(
        name='MageSourceNormals',type='FLOAT_VECTOR',domain='POINT')
    cache.data.foreach_set('vector',baked.reshape(-1))


def material_priority(obj):
    """Protect authored lining/trim boundaries, without locking whole panels."""
    if len(obj.data.materials)<2:
        return None
    edges={}
    for polygon in obj.data.polygons:
        for edge in polygon.edge_keys:
            edges.setdefault(edge,set()).add(polygon.material_index)
    protected=set()
    for edge,mats in edges.items():
        if len(mats)>1:
            protected.update(edge)
    if not protected:
        return None
    group=obj.vertex_groups.new(name='Mage runtime material boundaries')
    # Exact seams are worth their geometry: soft preference allowed the thin
    # two-stripe hem to collapse into broad jagged gold polygons in V9.
    group.add(list(protected),1,'REPLACE')
    return group


def reduce_mesh(obj,target):
    before=triangles(obj)
    surface=source_surface(obj.data)
    if before>target:
        priority=material_priority(obj)
        priority_name=priority.name if priority else None
        select(obj)
        mod=obj.modifiers.new('Reviewed Wizard game topology','DECIMATE')
        mod.decimate_type='COLLAPSE'
        mod.ratio=target/before
        mod.use_collapse_triangulate=True
        if priority_name:
            mod.vertex_group=priority_name
            mod.invert_vertex_group=True
            mod.vertex_group_factor=.0002
        # Armature deformation stays editable and exports as a real skin.
        while obj.modifiers[0]!=mod:
            bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        if priority_name:
            retained=obj.vertex_groups.get(priority_name)
            if retained:
                obj.vertex_groups.remove(retained)
    sample_normals(obj.data,surface)
    return {'name':obj.name,'source':before,'runtime':triangles(obj)}


def structured_skirt(source):
    """Sample the exact approved robe formula with connected ordered rows."""
    before=triangles(source)
    surface=source_surface(source.data)
    skeleton=source.parent
    assert source.parent_type=='BONE' and source.parent_bone=='mageextra2'
    bpy.data.objects.remove(source,do_unlink=True)
    obj=tailored_robe(skirt=True,runtime=True)
    attach(obj,skeleton,'extra2')
    pigment(obj)
    sample_normals(obj.data,surface)
    return obj,{'name':obj.name,'source':before,'runtime':triangles(obj),
                'method':'regular exact source-formula cage; continuous trim rows'}


def consolidate(root):
    buckets={}
    for obj in kit.descendants(root):
        if obj.type!='MESH' or obj.name in FACE_CONTROLS or obj.name=='mage-shoe':
            continue
        if obj.parent_type!='BONE' or len(obj.data.materials)!=1:
            continue
        key=(obj.parent,obj.parent_bone,obj.data.materials[0])
        buckets.setdefault(key,[]).append(obj)
    joined=[]
    for (rig,bone,mat),pieces in buckets.items():
        if len(pieces)<2:
            continue
        obj=kit.join(pieces,'mage.'+bone.removeprefix('mage')+'-'+mat.name.split(':')[0])
        world=obj.matrix_world.copy()
        obj.parent,obj.parent_type,obj.parent_bone=rig,'BONE',bone
        obj.matrix_world=world
        joined.append(obj.name)
    kit.refresh()
    return joined


def finish_surfaces(root):
    for obj in kit.descendants(root):
        if obj.type!='MESH':
            continue
        cache=obj.data.attributes.get('MageSourceNormals')
        if cache:
            normals=np.empty(len(cache.data)*3,dtype=np.float32)
            cache.data.foreach_get('vector',normals)
            for polygon in obj.data.polygons:
                polygon.use_smooth=True
            obj.data.normals_split_custom_set_from_vertices(normals.reshape(-1,3).tolist())
        ao=obj.data.color_attributes.get('AO')
        for layer in list(obj.data.color_attributes):
            if layer!=ao:
                obj.data.color_attributes.remove(layer)
        if ao:
            obj.data.color_attributes.active_color=ao
            obj.data.color_attributes.render_color_index=0


def reduce_runtime(root):
    """Run only on an independent newly built or loaded neutral master copy."""
    meshes=[o for o in kit.descendants(root) if o.type=='MESH']
    before=sum(triangles(o) for o in meshes)
    reductions=[]
    for obj in meshes:
        if obj.name=='mage.tailored-skirt':
            _,measurement=structured_skirt(obj)
            reductions.append(measurement)
        else:
            reductions.append(reduce_mesh(obj,BUDGETS.get(obj.name,48)))
    joined=consolidate(root)
    finish_surfaces(root)
    meshes=[o for o in kit.descendants(root) if o.type=='MESH']
    count=sum(triangles(o) for o in meshes)
    print('MAGE_RUNTIME_MEASURED',json.dumps({'triangles':count,'perPart':reductions,'joined':joined}),flush=True)
    assert count<=MAX_TRIANGLES,f'Wizard runtime {count} exceeds original {MAX_TRIANGLES}'
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    assert 'mage-shoe' in bpy.data.objects
    root['qualityMaster']=False
    root['runtimeSource']='independent copy of reviewed Mage V5; authored pigment and sampled source normals'
    root['runtimeTriangles']=count
    root['runtimeReduction']=json.dumps({'sourceTriangles':before,'perPart':reductions,'joined':joined})
    print('MAGE_RUNTIME',json.dumps({'triangles':count,'meshNodes':len(meshes),
          'skinMeshes':sum(any(m.type=='ARMATURE' for m in o.modifiers) for o in meshes),
          'reductions':reductions,'joined':joined}),flush=True)
    kit.refresh()
    return root


def build_runtime():
    # Reproduce the exact independently reviewed game copy. Symmetric flame
    # and book-corner collapse ties can vary after a new Blender construction;
    # a neutral editable cache preserves approved geometry and source normals.
    if os.environ.get('MAGE_REBUILD_RUNTIME') == '1':
        return reduce_runtime(build_master())
    if not REVIEWED_CACHE.is_file():
        raise FileNotFoundError('The reviewed Wizard runtime cache is required; '
                                'MAGE_REBUILD_RUNTIME=1 explicitly regenerates a copy')
    with bpy.data.libraries.load(str(REVIEWED_CACHE),link=False) as (source,loaded):
        loaded.objects=[name for name in source.objects if name=='mage' or name.startswith('mage')]
    for obj in loaded.objects:
        if obj and not obj.users_collection:
            bpy.context.scene.collection.objects.link(obj)
    root=next(obj for obj in loaded.objects if obj and obj.name=='mage')
    assert not root['qualityMaster']
    skeleton=next(obj for obj in kit.descendants(root) if obj.type=='ARMATURE')
    assert skeleton.name=='mage.skeleton' and len(skeleton.data.bones)==21
    assert 'magehead' in skeleton.pose.bones
    # The cache is saved before studio poses. No authored review pose or head
    # tilt is carried into figures.py or the live animator a second time.
    assert all(abs(bone.matrix_basis[row][col]-(1 if row==col else 0))<1e-7
               for bone in skeleton.pose.bones for row in range(4) for col in range(4))
    assert sum(triangles(obj) for obj in kit.descendants(root) if obj.type=='MESH')==18431
    kit.refresh()
    return root
