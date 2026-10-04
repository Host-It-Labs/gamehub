"""Split rigid leg sculpts into articulated thigh, shin and foot meshes.
Cuts retain material/UV data and are capped; pivots live on the original
limb, so the runtime's instanced meshes can animate true knee/ankle joints.
"""
import bpy
import bmesh
from collections import Counter
from mathutils import Vector
import kit


def clipped(source, z, below):
    mesh = source.data.copy()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    inverse = source.matrix_world.inverted()
    origin = inverse @ Vector((0, 0, z))
    normal = source.matrix_world.to_3x3().transposed() @ Vector((0, 0, 1))
    normal.normalize()
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                           dist=1e-6, plane_co=origin, plane_no=normal,
                           clear_outer=below, clear_inner=not below)
    rim = [e for e in bm.edges if e.is_boundary and all(
        abs((v.co-origin).dot(normal)) < 1e-5 for v in e.verts)]
    if rim:
        bmesh.ops.holes_fill(bm, edges=rim, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return mesh


def split_below(source, name, z):
    kit.refresh()
    upper = clipped(source, z, False)
    lower = clipped(source, z, True)
    child = bpy.data.objects.new(name, lower)
    bpy.context.scene.collection.objects.link(child)
    child.matrix_world = source.matrix_world.copy()
    # Keep the old mesh object/name as the hip joint, including boot-only
    # figures where its mesh becomes empty above the knee.
    source.data = upper
    position = source.matrix_world.translation
    rim = [child.matrix_world @ v.co for v in lower.vertices
           if abs((child.matrix_world @ v.co).z-z) < 1e-4]
    centre = Vector((position.x, position.y, z))
    if rim:
        # Centre the hinge in the sculpt's actual cross-section, not directly
        # below the hip (especially important for the Dino's forward knee).
        centre.x = sorted(p.x for p in rim)[len(rim)//2]
        centre.y = sorted(p.y for p in rim)[len(rim)//2]
    kit.set_pivot(child, centre)
    kit.parent(child, source)
    if rim:
        # A rounded joint fills the gap exposed when the cut ends bend apart.
        # Colour comes from the cut's surrounding faces, not a generic joint.
        materials=Counter()
        for face in upper.polygons:
            if abs((source.matrix_world @ face.center).z-z)<.04:
                materials[face.material_index]+=face.area
        index=materials.most_common(1)[0][0] if materials else 0
        rx=max(.012,sorted(abs(p.x-centre.x) for p in rim)[int((len(rim)-1)*.85)])
        ry=max(.012,sorted(abs(p.y-centre.y) for p in rim)[int((len(rim)-1)*.85)])
        joint=kit.sphere(name+'-socket',1,tuple(centre),scale=(rx,ry,min(rx,ry)),segments=20,rings=12)
        if source.data.materials:
            joint.data.materials.append(source.data.materials[index])
        kit.uv_box(joint, small=True)
        kit.shade(joint)
        kit.parent(joint,source)
    return child


def legs(root, figure):
    if figure == 'drake':
        return
    knee, ankle = {'ogre': (.63, .22), 'imps': (.19, .07)}.get(figure, (.36, .10))
    for side in ('L', 'R'):
        leg = next((o for o in kit.descendants(root)
                    if o.name == f'{figure}.leg{side}'), None)
        # Figures without legs (the Balloon), or that split their own
        # (a figure that already carries knee parts), are left alone.
        if leg is None or any(o.name == f'{figure}.knee{side}'
                              for o in kit.descendants(root)):
            continue
        kit.apply(leg)
        shin = split_below(leg, f'{figure}.knee{side}', knee)
        split_below(shin, f'{figure}.foot{side}', ankle)
