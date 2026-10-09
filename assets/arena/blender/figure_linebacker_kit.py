"""B2 private construction helpers. Shared Arena helpers are read-only.

No Blender job is launched by this module. All coordinates are native world
units (+Y forward, Z up); all bone frames point +Z with zero roll.
"""
import json
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as geo

V = lambda *a: Vector(a[0] if len(a) == 1 else a)
TAU = math.tau


def g(x, c, r):
    return math.exp(-((x - c) / r) ** 2)


def soft(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def profile(rows, x):
    """Bounded monotone cubic interpolation, retaining anatomical planes."""
    if x <= rows[0][0]:
        return tuple(rows[0][1:])
    if x >= rows[-1][0]:
        return tuple(rows[-1][1:])
    for i, (a, b) in enumerate(zip(rows, rows[1:])):
        if x > b[0]:
            continue
        t, span = (x - a[0]) / (b[0] - a[0]), b[0] - a[0]
        p, n = rows[max(0, i - 1)], rows[min(len(rows) - 1, i + 2)]
        out = []
        for k in range(1, len(a)):
            slope = (b[k] - a[k]) / span
            m0 = (b[k] - p[k]) / (b[0] - p[0])
            m1 = (n[k] - a[k]) / (n[0] - a[0])
            m0 = math.copysign(min(abs(m0), abs(slope) * 2), slope) if m0 * slope > 0 else 0
            m1 = math.copysign(min(abs(m1), abs(slope) * 2), slope) if m1 * slope > 0 else 0
            out.append((2*t**3-3*t**2+1)*a[k] + (t**3-2*t**2+t)*m0*span +
                       (-2*t**3+3*t**2)*b[k] + (t**3-t**2)*m1*span)
        return tuple(out)


def curve(points, samples=8):
    # Real kit.smooth_path returns tuples, not mathutils Vectors.
    return [Vector(p) for p in kit.smooth_path(points, samples=samples)]


def tag(obj, budget, region):
    obj["runtimeTriangles"] = int(budget)
    obj["sourceRegion"] = region
    return obj


def join(parts, name, budget, region):
    return tag(kit.join(parts, name), budget, region)


def union(parts, name, material, voxel=.0023):
    """Fuse only the intended garment/tissue; never a whole giant voxel grid."""
    for obj in parts:
        kit.apply(obj)
        kit.apply_transform(obj)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
    obj = kit.join(parts, name)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mod = obj.modifiers.new("Private connected source", "REMESH")
    mod.mode, mod.voxel_size, mod.use_smooth_shade = "VOXEL", voxel, True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("Restrained transition relaxation", "SMOOTH")
    mod.factor, mod.iterations = .22, 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.assign(obj, material)
    kit.shade(obj, 68)
    return obj


def rig(root, positions, parents):
    data = bpy.data.armatures.new(root.name + " anatomical common axes")
    obj = bpy.data.objects.new(root.name + ".skeleton", data)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for name, point in positions.items():
        bone = data.edit_bones.new(root.name + "." + name)
        bone.head, bone.tail = point, point + V(0, 0, .06)
        bone.roll, bone.use_connect = 0, False
    for name, parent in parents.items():
        data.edit_bones[root.name + "." + name].parent = data.edit_bones[root.name + "." + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.show_in_front = True
    obj["arenaCommonAxes"] = True
    obj["anatomicalPivots"] = json.dumps({k: list(v) for k, v in positions.items()})
    return obj


def weight(obj, armature, values):
    kit.apply(obj)
    kit.apply_transform(obj)
    n = len(obj.data.vertices)
    names = list(values)
    raw = np.stack([np.asarray(values[k]) + np.zeros(n) for k in names], axis=1)
    raw = np.clip(raw, 0, 1)
    if len(names) > 4:
        rank = np.argsort(raw, axis=1)[:, :-4]
        np.put_along_axis(raw, rank, 0, axis=1)
    total = raw.sum(axis=1, keepdims=True)
    if np.any(total < 1e-8):
        raise ValueError(obj.name + " has unweighted vertices")
    raw /= total
    for i, name in enumerate(names):
        group = obj.vertex_groups.new(name=armature.parent.name + "." + name)
        quantized = np.rint(raw[:, i] * 1000000).astype(int)
        indices = np.flatnonzero(quantized > 0)
        indices = indices[np.argsort(quantized[indices])]
        for batch in np.split(indices, np.flatnonzero(np.diff(quantized[indices])) + 1):
            if len(batch):
                group.add(batch.tolist(), float(quantized[batch[0]]) / 1000000, "REPLACE")
    mod = obj.modifiers.new("Authored anatomical skin", "ARMATURE")
    mod.object, mod.use_deform_preserve_volume = armature, False
    obj.parent = armature
    obj["continuousSkin"] = True


def attach(obj, armature, part):
    kit.apply(obj)
    kit.apply_transform(obj)
    world = obj.matrix_world.copy()
    obj.parent, obj.parent_type, obj.parent_bone = armature, "BONE", armature.parent.name + "." + part
    obj.matrix_world = world
    return obj


def faces(features, armature):
    """Live blink/glance controls in centred surface frames, pupils under eyes."""
    nodes = {}
    for name in ("eyeL", "eyeR", "browL", "browR", "mouth", "pupilL", "pupilR"):
        obj = features[name]
        kit.apply(obj)
        kit.apply_transform(obj)
        p = np.array([v.co[:] for v in obj.data.vertices])
        lo, hi = p.min(axis=0), p.max(axis=0)
        centre, size = V((lo+hi)/2), hi-lo
        if name.startswith("pupil"):
            axes = nodes["eye" + name[-1]].matrix_world.to_3x3()
        else:
            normal, up = V(centre.x*3, 1, 0).normalized(), V(0, 0, 1)
            axes = Matrix((normal.cross(up).normalized(), normal, up)).transposed()
        frame = Matrix.Translation(centre) @ axes.to_4x4()
        obj.data.transform(frame.inverted())
        if name.startswith("pupil"):
            obj.parent = nodes["eye" + name[-1]]
        else:
            obj.parent, obj.parent_type, obj.parent_bone = armature, "BONE", armature.parent.name + ".head"
        obj.matrix_world = frame
        obj["faceWidth"], obj["faceHeight"] = max(.006, float(size[0])), max(.003, float(size[2]))
        nodes[name] = obj
        kit.refresh()


def color_cache(root, paint=None):
    """Only AO exports as COLOR_0; editable pigment remains a generic vector."""
    cache_name = root.name.capitalize() + "Pigment"
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        geo.uv_box(obj)
        mesh = obj.data
        for layer in list(mesh.color_attributes):
            mesh.color_attributes.remove(layer)
        points = np.array([tuple(obj.matrix_world @ v.co) for v in mesh.vertices])
        rgb = np.ones((len(mesh.vertices), 3), dtype=np.float32)
        if paint is not None:
            rgb = paint(obj, points, rgb)
        cache = mesh.attributes.get(cache_name) or mesh.attributes.new(name=cache_name, type="FLOAT_VECTOR", domain="POINT")
        cache.data.foreach_set("vector", np.asarray(rgb, dtype=np.float32).ravel())
        layer = mesh.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="CORNER")
        indices = np.array([loop.vertex_index for loop in mesh.loops])
        rgba = np.column_stack((rgb[indices], np.ones(len(mesh.loops))))
        layer.data.foreach_set("color", np.asarray(rgba, dtype=np.float32).ravel())
        mesh.color_attributes.active_color = layer
        mesh.color_attributes.render_color_index = 0


def finish_ao(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        layer = mesh.color_attributes.get("AO")
        if not layer:
            raise ValueError("Missing AO on " + obj.name)
        cache = mesh.attributes.get(root.name.capitalize() + "Pigment")
        rgba = np.empty((len(mesh.loops), 4), dtype=np.float32)
        layer.data.foreach_get("color", rgba.ravel())
        if cache:
            rgb = np.empty((len(mesh.vertices), 3), dtype=np.float32)
            cache.data.foreach_get("vector", rgb.ravel())
            indices = np.array([loop.vertex_index for loop in mesh.loops])
            rgba[:, :3] = np.clip(rgba[:, :3], .70, 1) * rgb[indices]
        rgba[:, 3] = 1
        layer.data.foreach_set("color", rgba.ravel())
        for other in list(mesh.color_attributes):
            if other != layer:
                mesh.color_attributes.remove(other)
        mesh.color_attributes.active_color = layer
        mesh.color_attributes.render_color_index = 0


def surface_finish(root):
    """Moderate source microstructure; runtime keeps its existing families."""
    materials={mat for obj in kit.descendants(root) if obj.type=="MESH" for mat in obj.data.materials if mat}
    for mat in materials:
        if mat.get("arenaB2Surface"):continue
        family=mat.name.split(":",1)[0];nodes,links=mat.node_tree.nodes,mat.node_tree.links
        bsdf=nodes.get("Principled BSDF")
        if family=="skin":
            bsdf.inputs["Roughness"].default_value=.65
            bsdf.inputs["Specular IOR Level"].default_value=.25
            bsdf.inputs["Subsurface Weight"].default_value=.045
            bsdf.inputs["Subsurface Radius"].default_value=(.008,.004,.002)
            bsdf.inputs["Coat Weight"].default_value=.025
        elif family in ("weave","felt"):
            bsdf.inputs["Roughness"].default_value=.87 if family=="weave" else .94
            bsdf.inputs["Sheen Weight"].default_value=.18 if family=="weave" else .28
        elif family=="hide":
            bsdf.inputs["Roughness"].default_value=.58
            bsdf.inputs["Coat Weight"].default_value=.045
            bsdf.inputs["Coat Roughness"].default_value=.65
        elif family=="beech":
            bsdf.inputs["Roughness"].default_value=.54
            bsdf.inputs["Coat Weight"].default_value=.055
        if family in ("skin","weave","felt","hide","beech"):
            noise=nodes.new("ShaderNodeTexNoise")
            noise.inputs["Scale"].default_value=230 if family=="skin" else 180
            noise.inputs["Detail"].default_value=2
            bump=nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value=.12 if family=="skin" else .16
            bump.inputs["Distance"].default_value=.00035 if family=="skin" else .00045
            links.new(noise.outputs["Fac"],bump.inputs["Height"])
            links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
        mat["arenaB2Surface"]=True


# B3 secondary forms: shared only by this figure's private source. No render
# budgets or generated Blender artifacts are evidence of visual quality.
def angular(q, centre, width):
    delta = (q - centre + math.pi) % TAU - math.pi
    return g(delta, 0, width)


def fold_relief(t, q, centre, slant, width, amount, phase=0):
    """One loaded cloth ridge and adjacent valley, rather than ring noise."""
    d = t - centre - slant * math.sin(q + phase)
    return amount * (g(d, 0, width) - .52 * g(d, width * 1.8, width))


def lidded_eye(prefix, face_point, face_normal, a, z, width, height,
               face_radius, sign, skin, white, iris, ink, crease, tilt=.0022):
    """Convex eyeball cap under broad flesh lids in the sculpt's socket.

    The white is a curved globe, not a painted disc. Iris and pupil follow
    its exact surface. The outer lid merges back into the head; the inner
    edge has thickness and an upper orbital crease. Existing live control
    names and pupil-under-eye parenting are retained by faces().
    """
    half_angle = width / face_radius
    def globe(u, v):
        span = math.sqrt(max(.00001, 1-u*u))
        zz = z + sign*tilt*u + height*v*span
        aa = a + half_angle*u
        convex = .0024 + .0050*(1-u*u)*(1-v*v)
        return face_point(aa, zz) + face_normal(aa, zz)*convex
    eye = geo.sheet(prefix+".globe", globe, np.linspace(-.998,.998,44),
                    np.linspace(-1,1,20), white, rim=.0012, back=True,
                    inside=V(0,0,z))
    def disk(name, rx, rz, material, lift, du=0, dz=0):
        rows=[]
        for r in np.linspace(.025,1,12):
            row=[]
            for q in np.linspace(0,TAU,40,endpoint=False):
                u=(du+rx*r*math.cos(q))/width
                span=math.sqrt(max(.00001,1-u*u))
                v=(dz+rz*r*math.sin(q)-sign*tilt*u)/(height*span)
                aa=a+half_angle*u
                zz=z+dz+rz*r*math.sin(q)
                row.append(globe(u,v)+face_normal(aa,zz)*lift)
            rows.append(row)
        return geo.loft(name,rows,material,start="pole")
    iris_r=min(.0060,height*.79)
    pupils=[disk(prefix+".iris",iris_r,iris_r,iris,.0005),
            disk(prefix+".pupil",iris_r*.51,iris_r*.78,ink,.0010),
            disk(prefix+".catchlight",.0011,.0011,white,.0014,-.0015,.0018)]
    fixed=[]
    for upper in (True,False):
        polarity=1 if upper else -1
        def lid(q,t,polarity=polarity):
            u=math.cos(q);span=math.sin(q)
            aa=a+half_angle*u*(1+.08*t)
            zz=z+sign*tilt*u+polarity*span*(height+(.0065 if polarity>0 else .0045)*t)
            roll=.0023+.0030*math.sin(math.pi*t)*span
            p=face_point(aa,zz)+face_normal(aa,zz)*roll
            return p
        fixed.append(geo.sheet(prefix+".lid-"+str(upper),lid,
                               np.linspace(.008,math.pi-.008,44),np.linspace(0,1,10),
                               skin,rim=.0011,back=True,inside=V(0,0,z)))
        if upper:
            # A small lash edge sits beneath the flesh, not a heavy dark rim.
            edge=[globe(math.cos(q),1)+face_normal(a+half_angle*math.cos(q),z)*.0002
                  for q in np.linspace(.12,math.pi-.12,40)]
            fixed.append(geo.tube(prefix+".upper-lash",edge,
                                   [.00065*math.sin(q)**.45 for q in np.linspace(.12,math.pi-.12,40)],
                                   ink,n=6))
            crease_pts=[lid(q,.87) for q in np.linspace(.25,math.pi-.25,34)]
            fixed.append(geo.tube(prefix+".orbital-fold",crease_pts,[.00065]*34,skin,n=6))
    return eye, pupils, fixed


def mouth_recess(a,z,centre,width,height,face_radius,depth):
    u=a/(width/face_radius);v=(z-centre)/height
    shape=(abs(u)**3+abs(v)**3)**(1/3)
    return depth*float(soft(1.06,.24,shape))


def shaped_mouth(prefix,face_point,face_normal,centre,width,height,
                 face_radius,lip,lining,tooth,gum,tongue,calling=True):
    """Rounded rectangular inner bowl, fleshy lip roll, teeth and tongue.

    The skull's matching recession supplies the cavity; the lining follows
    it. No full dark oval pasted on top of the face. All pieces are joined
    as the existing live mouth control so its expression stays coherent.
    """
    half_angle=width/face_radius
    def outline(q,r=1):
        u=math.copysign(abs(math.cos(q))**.72,math.cos(q))
        v=math.copysign(abs(math.sin(q))**.80,math.sin(q))
        aa=half_angle*u*r*(.90 if v<0 and calling else 1)
        zz=centre+height*v*r
        return aa,zz
    rows=[]
    for r in np.linspace(.02,1,20):
        row=[]
        for q in np.linspace(0,TAU,64,endpoint=False):
            aa,zz=outline(q,float(r))
            row.append(face_point(aa,zz)+face_normal(aa,zz)*.0008)
        rows.append(row)
    pieces=[geo.loft(prefix+".inner-bowl",rows,lining,start="pole")]
    def lip_roll(q,t):
        aa,zz=outline(q,1+t*.14)
        zz+=(.0022 if math.sin(q)>0 else -.0030)*t
        volume=.0017+.0034*math.sin(math.pi*t)**.75
        volume*=.75+.25*abs(math.sin(q))
        return face_point(aa,zz)+face_normal(aa,zz)*volume
    pieces.append(geo.sheet(prefix+".lip-roll",lip_roll,np.linspace(0,TAU,72,endpoint=False),
                            np.linspace(0,1,12),lip,rim=.0008,back=True,closed_u=True,
                            inside=V(0,0,centre)))
    def teeth(u,v):
        aa=half_angle*u*.84
        # A curved dental arch with an incisor/scalloped lower edge.
        zz=centre+height*((.32+.46*v) if calling else (-.63+1.25*v))
        zz+=.00032*math.cos(u*math.pi*6)*(1-v)
        return face_point(aa,zz)+face_normal(aa,zz)*(.0052 if calling else .0027)
    pieces.append(geo.sheet(prefix+".upper-teeth",teeth,np.linspace(-1,1,42),np.linspace(0,1,8),
                            tooth,rim=.0013,back=True,inside=V(0,0,centre)))
    if calling:
        gumline=[teeth(float(u),1)+V(0,-.0005,.0011) for u in np.linspace(-.98,.98,40)]
        pieces.append(geo.tube(prefix+".gum",gumline,[.0012]*40,gum,n=8))
        rows=[]
        for r in np.linspace(.03,1,12):
            row=[]
            for q in np.linspace(0,TAU,48,endpoint=False):
                aa=half_angle*.55*r*math.cos(q)
                zz=centre-height*.62+height*.23*r*math.sin(q)
                row.append(face_point(aa,zz)+face_normal(aa,zz)*(.0032+.0025*(1-r*r)))
            rows.append(row)
        pieces.append(geo.loft(prefix+".tongue",rows,tongue,start="pole"))
    return pieces
