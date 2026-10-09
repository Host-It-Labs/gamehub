"""Private editable Firefighter sculpt, not selected by the live collector.

Authored adult face, sewn tunic, rolled sleeves, separate grip fingers,
engineered comb helmet and a working brass nozzle. All anatomical bones use
root-axis frames. Master is saved before render-only geometry is reduced.
"""
import gc
import json
import math
import os
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_folk_kit as geo

R = "firefighter"
BASE = Path(__file__).resolve().parents[3] / "work/arena/2026-10-08-roster/firefighter"
V = geo.V
TAU = math.tau
SKIN = "skin:" + kit.tint("firefighter-warm-skin", "#ce916b")
LIP = "skin:" + kit.tint("firefighter-lip", "#9f634d")
HAIR = "hair:" + kit.tint("firefighter-black-hair", "#251e1d")
EYE = "resin:" + kit.tint("firefighter-eye", "#e8d8c2")
PUPIL = "resin:" + kit.tint("firefighter-pupil", "#30251d")
SHADOW = "resin:" + kit.tint("firefighter-shadow", "#3c2520")
NAIL = "skin:" + kit.tint("firefighter-nail", "#dab091")
# The third field scopes the source material, while the runtime still sees
# family=weave, tint=team. tint() performs the needed sRGB-to-linear conversion.
TUNIC = "weave:" + kit.tint("team:firefighter", "#2f63e0")
TROUSER = "weave:" + kit.tint("team2:firefighter", "#182c63")
EDGE = "weave:" + kit.tint("team3:firefighter", "#537ddb")
BRASS = "gilt:" + kit.tint("firefighter-brass", "#c79b45")
GOLD = "gilt:" + kit.tint("firefighter-polished-brass", "#edc36a")
PATINA = "gilt:" + kit.tint("firefighter-brass-seam", "#7a5a30")
BOOT = "hide:" + kit.tint("firefighter-black-boot", "#1c232b")
LEATHER = "hide:" + kit.tint("firefighter-belt", "#302823")
SOLE = "resin:" + kit.tint("firefighter-sole", "#11171d")
HOSE = "weave:" + kit.tint("firefighter-canvas-hose", "#b8a27d")
WOOD = "beech:" + kit.tint("firefighter-axe-handle", "#ab693d")
STEEL = "tin:" + kit.tint("firefighter-axe-steel", "#84909b")
RED = "lacquer:" + kit.tint("firefighter-badge-red", "#a73126")

WAIST = V(0, 0, .660)
CHEST = V(0, -.002, .869)
NECK = V(0, -.005, 1.042)
SHOULDER = {s: V(s*.207, -.003, .992) for s in (-1, 1)}
ELBOW = {s: V(s*.261, .010, .742) for s in (-1, 1)}
WRIST = {s: V(s*.271, .076, .518) for s in (-1, 1)}
HIP = {s: V(s*.096, -.003, .621) for s in (-1, 1)}
KNEE = {s: V(s*.109, .018, .354) for s in (-1, 1)}
ANKLE = {s: V(s*.111, .016, .091) for s in (-1, 1)}
CLAV = {s: V(s*.053, -.003, 1.013) for s in (-1, 1)}
NOZZLE_AXIS = V(0, .960, .280).normalized()
GRIP = {s: WRIST[s] + V(-s*.044, .032, -.048) for s in (-1, 1)}
BODY = [(.545,.157,.122,.114),(.565,.170,.130,.120),
        (.628,.150,.128,.113),(.675,.144,.124,.112),
        (.727,.160,.132,.122),(.795,.171,.139,.127),
        (.868,.175,.144,.133),(.928,.173,.135,.128),
        (.966,.154,.112,.108),(.999,.117,.083,.082),
        (1.034,.064,.058,.057),(1.057,.061,.054,.054)]
HEAD = [(1.059,.042,.055,.049),(1.075,.063,.075,.056),
        (1.098,.084,.077,.069),(1.135,.092,.080,.081),
        (1.173,.104,.081,.090),(1.207,.105,.079,.096),
        (1.239,.104,.086,.099),(1.270,.096,.079,.091),
        (1.291,.070,.063,.065),(1.306,.010,.008,.010)]


def ss(lo, hi, value):
    t = np.clip((value-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)


def g(value, centre, width):
    return math.exp(-((value-centre)/width)**2)


def profile(rows, value):
    if value <= rows[0][0]:
        return rows[0][1:]
    if value >= rows[-1][0]:
        return rows[-1][1:]
    for a, b in zip(rows, rows[1:]):
        if value <= b[0]:
            t = float(ss(a[0], b[0], value))
            return tuple(geo.lerp(a[k], b[k], t) for k in range(1, len(a)))


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh(name, vertices, faces, material, smooth=True):
    data = bpy.data.meshes.new(R+"."+name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(kit.material(material))
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    return obj


def bevel(obj, width=.002, segments=3):
    select(obj)
    mod = obj.modifiers.new("Machined edge radius", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def body_point(a, z, extra=0):
    width, front, back = profile(BODY, z)
    sn, cs = math.sin(a), math.cos(a)
    ad = abs((math.degrees(a)+180)%360-180)
    x = geo.spow(sn, 2/2.2)*(width+extra)
    y = geo.spow(cs, 2/2.2)*((front if cs >= 0 else back)+extra)
    # Tailored chest has an inset underarm and a separate broad breast plane.
    relief = .004*g(z,.876,.065)*g(ad,34,22)
    relief -= .010*g(z,.888,.074)*g(ad,90,16)
    relief -= .005*g(z,.989,.011)*g(ad,0,16)
    # Three purposeful, uneven oblique folds over the waist and belt.
    for h, tilt, amount in ((.739,.021,.010),(.696,-.013,.006),(.590,.028,.008)):
        at = h+tilt*math.sin(a*2+.3)
        relief += (amount*g(z,at,.013)-amount*.5*g(z,at-.016,.006))*g(ad,40,49)
    relief += .003*g(z,.948-.012*min(ad,90)/90,.007)*g(ad,55,24)
    return V(x+sn*relief, y+cs*relief, z)


def torso():
    rings = [[body_point(i/80*TAU, float(z)) for i in range(80)]
             for z in np.linspace(.545,1.057,96)]
    return geo.loft(R+".tailored-torso", rings, TUNIC, start="flat", end="flat")


def sleeve(s):
    a, e, w = SHOULDER[s], ELBOW[s], WRIST[s]
    # Join only the upper shoulder. The upper-arm outer curve clears the
    # torso before the sleeve reaches the middle of the humerus.
    guides = [a+V(-s*.053,0,.005), a+V(s*.001,0,-.026),
              a+V(s*.043,.004,-.120), e, e+(w-e)*.105]
    path = [Vector(p) for p in kit.smooth_path(guides,samples=18)]
    rings = []
    for j, centre in enumerate(path):
        t = j/(len(path)-1)
        tangent = (path[min(j+1,len(path)-1)]-path[max(j-1,0)]).normalized()
        across = V(s,0,0)-tangent*tangent.dot(V(s,0,0))
        across.normalize()
        front = tangent.cross(across).normalized()
        if front.y < 0:
            front = -front
        radius = profile([(0,.071),(.16,.073),(.4,.066),(.68,.058),(.86,.052),(1,.048)],t)[0]
        ring = []
        for k in range(48):
            a0 = k/48*TAU
            # Two broad elbow folds and the shoulder's sleeve-head fullness.
            at = .76+.035*math.sin(a0)
            fold = .007*g(t,at,.048)-.004*g(t,at-.075,.025)
            fold += .005*g(t,.94-.02*math.cos(a0),.033)
            fold += .003*g(t,.28,.12)*max(0,math.cos(a0))
            rx = radius+fold
            ry = radius*.95+fold*.8
            ring.append(centre+across*math.cos(a0)*rx+front*math.sin(a0)*ry)
        rings.append(ring)
    return geo.loft(R+f".tailored-sleeve-{s}", rings, TUNIC, start="flat",end="flat")


def source_field(obj):
    obj.data.calc_loop_triangles()
    return BVHTree.FromPolygons([v.co.copy() for v in obj.data.vertices],
        [tuple(t.vertices) for t in obj.data.loop_triangles],all_triangles=True)


def fuse(parts, name, voxel):
    for obj in parts:
        kit.apply(obj)
        kit.apply_transform(obj)
    select(parts[0])
    for obj in parts:
        obj.select_set(True)
    bpy.ops.object.join()
    obj = parts[0]
    obj.name = R+"."+name
    mod = obj.modifiers.new("Editable continuous sewn primary surface", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    mod.use_remove_disconnected = False
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("Small primary-surface blending", "SMOOTH")
    mod.factor, mod.iterations = .34, 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def make_rig(root):
    data = bpy.data.armatures.new("Firefighter common-axis anatomical rig")
    rig = bpy.data.objects.new(R+".skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    positions = {"torso":WAIST,"chest":CHEST,"head":NECK,
                 "hat":V(0,-.020,1.228),"weapon":GRIP[1],
                 "cape":GRIP[1]-NOZZLE_AXIS*.092,"cape2":V(.213,-.068,.279)}
    parents = {"chest":"torso","head":"chest","hat":"head",
               "weapon":"handR","cape":"weapon","cape2":"torso"}
    for s, side in ((-1,"L"),(1,"R")):
        positions.update({"clav"+side:CLAV[s],"arm"+side:SHOULDER[s],
            "fore"+side:ELBOW[s],"hand"+side:WRIST[s],"leg"+side:HIP[s],
            "knee"+side:KNEE[s],"foot"+side:ANKLE[s]})
        parents.update({"clav"+side:"chest","arm"+side:"clav"+side,
            "fore"+side:"arm"+side,"hand"+side:"fore"+side,
            "knee"+side:"leg"+side,"foot"+side:"knee"+side})
    select(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, point in positions.items():
        bone = data.edit_bones.new(R+"."+name)
        bone.head, bone.tail = point, point+V(0,0,.060)
        bone.use_connect = False
    for name, parent in parents.items():
        data.edit_bones[R+"."+name].parent = data.edit_bones[R+"."+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    data.display_type = "WIRE"
    rig.show_in_front = True
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k:list(v) for k,v in positions.items()})
    return rig


def add_weights(obj, rig, weights):
    geo.uv_box(obj)
    total = np.maximum(1e-9,np.sum(list(weights.values()),axis=0))
    for name, raw in weights.items():
        quant = np.rint(np.clip(raw/total,0,1)*10000).astype(int)
        indices = np.flatnonzero(quant>0)
        if not len(indices):
            continue
        group = obj.vertex_groups.new(name=R+"."+name)
        indices = indices[np.argsort(quant[indices])]
        for batch in np.split(indices,np.flatnonzero(np.diff(quant[indices]))+1):
            if len(batch):
                group.add(batch.tolist(),float(quant[batch[0]])/10000,"REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Connected anatomical deformation", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False
    obj["continuousSkin"] = True


def weight_tunic(obj, rig, fields):
    points = np.array([v.co[:] for v in obj.data.vertices])
    x, _, z = points.T
    chest = ss(.750,.945,z)
    weights = {"torso":1-chest,"chest":chest}
    d = np.array([[tree.find_nearest(Vector(p))[3] for p in points] for tree in fields])
    for index,(s,side) in enumerate(((-1,"L"),(1,"R"))):
        a,e,w = SHOULDER[s],ELBOW[s],WRIST[s]
        along = (points-np.array(a)).dot(np.array(e-a))/(e-a).length_squared
        other = np.min(np.delete(d,index+1,axis=0),axis=0)
        share = ss(-.003,.004,other-d[index+1])*ss(-.13,.21,along)
        clav = share*(1-ss(.01,.35,along))*.35
        hinge = ss(.84,1.08,along)
        weights["clav"+side] = clav
        weights["arm"+side] = (share-clav)*(1-hinge)
        weights["fore"+side] = (share-clav)*hinge
        weights["torso"] *= 1-share
        weights["chest"] *= 1-share
    for s,side in ((-1,"L"),(1,"R")):
        share = ss(.067,.168,s*x)*ss(.934,1.030,z)*.30
        available = weights["chest"]*share
        weights["clav"+side] += available
        weights["chest"] -= available
    add_weights(obj,rig,weights)
    mod = obj.modifiers.new("Editable fine sewn surface", "SUBSURF")
    mod.levels = mod.render_levels = 1
    select(obj)
    # Saved master, render review and reduced runtime use the same order:
    # smooth the neutral source first, then deform it at the joints.
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    obj["panelProvenance"] = "torso,L proximal sleeve,R proximal sleeve"


def follow_skin(obj, rig, skin):
    data = skin.data
    data.calc_loop_triangles()
    points = [v.co.copy() for v in data.vertices]
    faces = [tuple(t.vertices) for t in data.loop_triangles]
    tree = BVHTree.FromPolygons(points,faces,all_triangles=True)
    names = {group.index:group.name.removeprefix(R+".") for group in skin.vertex_groups}
    source = [{names[g0.group]:g0.weight for g0 in v.groups} for v in data.vertices]
    weights = {name:np.zeros(len(obj.data.vertices)) for name in names.values()}
    for j, vertex in enumerate(obj.data.vertices):
        p,_,face,_ = tree.find_nearest(vertex.co)
        a,b,c = faces[face]
        bary = barycentric_transform(p,points[a],points[b],points[c],V(1,0,0),V(0,1,0),V(0,0,1))
        for corner,factor in zip((a,b,c),bary):
            for name,weight in source[corner].items():
                weights[name][j] += max(0,factor)*weight
    add_weights(obj,rig,weights)


def attach(obj, rig, bone):
    kit.apply(obj)
    kit.apply_transform(obj)
    geo.uv_box(obj)
    world = obj.matrix_world.copy()
    obj.parent, obj.parent_type, obj.parent_bone = rig,"BONE",R+"."+bone
    obj.matrix_world = world
    return obj


def trouser(s, rig):
    rings = []
    for z in np.linspace(.332,.670,76):
        t = float(ss(.332,.670,z))
        centre = V(geo.lerp(KNEE[s].x,HIP[s].x,t),
                   geo.lerp(KNEE[s].y,HIP[s].y,t),z)
        rx,ry = profile([(.332,.046,.050),(.369,.051,.054),(.410,.061,.058),
                         (.500,.070,.066),(.588,.076,.076),(.670,.080,.076)],z)
        ring = []
        for j in range(48):
            a = j/48*TAU
            # Big knee tension folds are unequal and directed at the bent
            # crease rather than continuous ribbing round the whole leg.
            front = max(0,math.cos(a))
            fold = (.008*g(z,.421+.018*math.sin(a),.011)
                    -.005*g(z,.404+.012*math.sin(a),.005))*front
            fold += .006*g(z,.370-.014*math.sin(a),.010)*(1-front*.65)
            fold += .005*g(z,.548+.028*math.cos(a),.018)*g(abs(math.sin(a)),.7,.5)
            ring.append(centre+V(s*math.sin(a)*(rx+fold),math.cos(a)*(ry+fold),0))
        rings.append(ring)
    obj = geo.loft(R+f".tailored-trouser-{s}",rings,TROUSER,start="flat",end="flat")
    points = np.array([v.co[:] for v in obj.data.vertices])
    knee = 1-ss(.339,.421,points[:,2])
    side = "R" if s>0 else "L"
    add_weights(obj,rig,{"leg"+side:1-knee,"knee"+side:knee})
    return obj


def cuff(s, rig, tunic):
    a = ELBOW[s]+(WRIST[s]-ELBOW[s])*.057
    axis = (WRIST[s]-ELBOW[s]).normalized()
    cross = V(1,0,0)-axis*axis.x
    cross.normalize()
    front = axis.cross(cross)
    # Construct a genuinely thick rolled cuff with a sealed cyclic section.
    rings = []
    for t,r in ((-.019,.050),(-.012,.055),(.004,.056),(.018,.051),(.013,.046),(-.018,.045)):
        rings.append([a+axis*t+(cross*math.cos(j/48*TAU)+front*math.sin(j/48*TAU))*r
                      for j in range(48)])
    rings.append(rings[0])
    obj = geo.loft(R+f".clean-rolled-cuff-{s}",rings,TUNIC)
    # Repeating the first ring closes the shape visually but leaves two
    # boundaries. Weld the seam before skinning or decimation can open it.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    follow_skin(obj,rig,tunic)
    return obj


def arm_surface(s):
    e,w = ELBOW[s],WRIST[s]
    axis = (w-e).normalized()
    across = V(s,0,0)-axis*axis.dot(V(s,0,0))
    across.normalize()
    front = axis.cross(across)
    rings = []
    for t in np.linspace(-.08,1.03,58):
        centre = e+(w-e)*t
        rx,ry = profile([(-.08,.047,.044),(.14,.046,.044),(.37,.044,.040),
                         (.67,.035,.032),(.94,.030,.026),(1.03,.031,.025)],t)
        ring = []
        for j in range(48):
            a = j/48*TAU
            # Pronator mass and planar ulna side distinguish an adult arm.
            volume = .005*g(t,.26,.21)*max(0,math.sin(a))
            volume -= .002*g(t,.81,.19)*g(abs(math.cos(a)),1,.18)
            ring.append(centre+across*math.cos(a)*(rx+volume)
                        +front*math.sin(a)*(ry+volume*.6))
        rings.append(ring)
    fore_rings = rings
    c = GRIP[s]
    down = V(0,NOZZLE_AXIS.z,-NOZZLE_AXIS.y)
    rings = []
    for t in np.linspace(0,1,24):
        centre = c+V(s*.055,0,0)+down*(-.036+t*.070)
        wide,thick = profile([(0,.024,.013),(.21,.036,.018),(.72,.035,.019),(1,.030,.012)],t)
        rings.append([centre+NOZZLE_AXIS*math.sin(j/40*TAU)*wide
                      +V(s,0,0)*math.cos(j/40*TAU)*thick for j in range(40)])
    return fore_rings,rings


def arm_skin(s, rig):
    e,w = ELBOW[s],WRIST[s]
    axis = (w-e).normalized()
    fore_rings,palm_rings = arm_surface(s)
    fore = geo.loft(R+f".forearm-{s}",fore_rings,SKIN,start="flat",end="flat")
    palm = geo.loft(R+f".anatomical-palm-{s}",palm_rings,SKIN,start="pole",end="pole")
    obj = fuse([fore,palm],f".adult-arm-hand-{s}".lstrip("."),.0026)
    points = np.array([v.co[:] for v in obj.data.vertices])
    along = (points-np.array(w)).dot(np.array(axis))
    hand = ss(-.026,.024,along)
    side = "R" if s>0 else "L"
    add_weights(obj,rig,{"fore"+side:1-hand,"hand"+side:hand})
    return obj


def thumb_path(s):
    c,d = GRIP[s],NOZZLE_AXIS
    q = V(0,d.z,-d.y)
    # A thumb pad has thickness: its centreline cannot follow the grip's
    # radius. Keep the pad's inner surface outside the true nozzle profile.
    clearance = 1.12
    guides = [c+d*.045+(V(s*.044,0,0)-q*.032)*clearance,
              c+d*.061+(V(s*.018,0,0)-q*.046)*clearance,
              c+d*.052+(V(-s*.019,0,0)-q*.039)*clearance,
              c+d*.026+(V(-s*.038,0,0)-q*.016)*clearance]
    path = [Vector(p) for p in kit.smooth_path(guides,samples=9)]
    radii = [profile([(0,.015),(.40,.016),(1,.010)],j/(len(path)-1))[0]
             for j in range(len(path))]
    return path,radii


def fingers(s, rig):
    c, d = GRIP[s],NOZZLE_AXIS
    q = V(0,d.z,-d.y)
    side = "R" if s>0 else "L"
    for finger,(along,radius,stop) in enumerate(((-.031,.049,2.7),(-.010,.052,2.9),(.011,.052,2.9),(.031,.048,2.65))):
        path = []
        for t in np.linspace(0,1,30):
            angle = -.64+t*(stop+.64)
            # Flatten the outer knuckle plane while retaining finger pads
            # completely outside the nozzle's .032 grip radius.
            r = radius-.003*float(ss(.72,1,t))
            path.append(c+d*along+V(s*math.cos(angle)*r,0,0)+q*math.sin(angle)*r)
        radii = [.0090+.0017*g(j/(len(path)-1),.46,.26) for j in range(len(path))]
        obj = geo.tube(R+f".individual-grip-finger-{s}-{finger}",path,radii,SKIN,n=16,
                       up=d,caps=("dome","dome"))
        attach(obj,rig,"hand"+side)
        end = path[-3]
        nail = geo.ball(R+f".grip-nail-{s}-{finger}",1,end+q*.006,NAIL,
                        scale=(.006,.003,.007),seg=20,rings=10)
        attach(nail,rig,"hand"+side)
        # One crease at each major joint, not uniform random surface noise.
        for j in (10,19):
            at = path[j]
            normal = (at-c-d*along).normalized()
            tangent = d.cross(normal).normalized()
            crease = [at+normal*.0095+tangent*t for t in np.linspace(-.005,.005,7)]
            obj = geo.tube(R+f".finger-crease-{s}-{finger}-{j}",crease,[.0008]*7,LIP,n=6,up=d)
            attach(obj,rig,"hand"+side)
    path,radii = thumb_path(s)
    attach(geo.tube(R+f".gripping-thumb-{s}",path,radii,SKIN,n=18,up=d),rig,"hand"+side)


def head_point(a,z):
    rx,front,back = profile(HEAD,z)
    sa,ca = math.sin(a),math.cos(a)
    ad = abs((math.degrees(a)+180)%360-180)
    x = geo.spow(sa,2/2.45)*rx
    y = geo.spow(ca,2/2.45)*(front if ca>=0 else back)-.006
    # Planar adult cheek, firm masseter and strong compressed chin.
    relief = .009*g(z,1.168,.025)*g(ad,38,20)
    relief += .010*g(z,1.106,.027)*g(ad,57,16)
    relief += .012*g(z,1.077,.015)*g(ad,0,23)
    relief -= .008*g(z,1.200,.013)*g(ad,25,15)
    relief += .010*g(z,1.225,.012)*g(ad,20,18)
    relief -= .003*g(z,1.257,.025)*g(ad,3,4)
    # Nose bridge, bulb and paired alar volumes are part of the skull.
    relief += .034*g(z,1.180,.020)*g(ad,0,10)
    relief += .019*g(z,1.206,.029)*g(ad,0,7)
    relief += .010*g(z,1.172,.007)*g(ad,12,5)
    relief += .004*g(z,1.130,.012)*g(ad,0,24)
    relief -= .004*g(z,1.148,.018)*g(ad,29,5)
    return V(x+sa*relief*.35,y+ca*relief,z)


def head(rig):
    rings = [[head_point(j/96*TAU,float(z)) for j in range(96)]
             for z in np.linspace(HEAD[0][0],HEAD[-1][0],108)]
    attach(geo.loft(R+".authored-adult-face",rings,SKIN,start="flat",end="pole"),rig,"head")
    neck = geo.tube(R+".neck-anatomy",[V(0,-.006,1.010),V(0,-.006,1.080)],
                    [(.051,.048),(.052,.049)],SKIN,n=48,up=(1,0,0),caps=("flat","flat"))
    attach(neck,rig,"head")
    for s in (-1,1):
        centre = V(s*.106,-.002,1.173)
        rings = []
        for t in np.linspace(0,1,26):
            z = 1.139+t*.062
            radius = .015*math.sin(math.pi*t)**.55+.003
            rings.append([V(s*(.108+math.cos(j/32*TAU)*radius*.65),
                            -.004+math.sin(j/32*TAU)*radius,z) for j in range(32)])
        attach(geo.loft(R+f".sculpted-ear-{s}",rings,SKIN,start="pole",end="pole"),rig,"head")
        path = [centre+V(s*.011,math.cos(a)*.009,math.sin(a)*.024)
                for a in np.linspace(-math.pi*.55,math.pi*.85,30)]
        attach(geo.tube(R+f".ear-helix-{s}",path,[.0035]*len(path),LIP,n=10,up=(1,0,0)),rig,"head")
        for z,a0 in ((1.171,10),(1.173,15)):
            at = head_point(math.radians(s*a0),z)+V(0,.001,0)
            attach(geo.ball(R+f".nostril-{s}-{a0}",1,at,SHADOW,
                           scale=(.0035,.0018,.002),seg=24,rings=12),rig,"head")


def face_node(obj, name, rig, parent=None):
    kit.apply(obj)
    kit.apply_transform(obj)
    geo.uv_box(obj)
    obj.name = R+name
    points = [v.co.copy() for v in obj.data.vertices]
    lo = V(*(min(p[k] for p in points) for k in range(3)))
    hi = V(*(max(p[k] for p in points) for k in range(3)))
    centre,size = (lo+hi)/2,hi-lo
    normal = V(centre.x*2.2,1,0).normalized()
    up = V(0,0,1)
    right = normal.cross(up).normalized()
    axes = parent.matrix_world.to_3x3() if parent else Matrix((right,normal,up)).transposed()
    frame = Matrix.Translation(centre)@axes.to_4x4()
    obj.data.transform(frame.inverted())
    if parent:
        obj.parent = parent
    else:
        obj.parent,obj.parent_type,obj.parent_bone = rig,"BONE",R+".head"
    obj.matrix_world = frame
    obj["faceWidth"],obj["faceHeight"] = max(.006,size.x),max(.003,size.z)
    return obj


def face_controls(rig):
    for s,side in ((-1,"L"),(1,"R")):
        at = head_point(math.radians(s*25),1.205)+V(0,.004,0)
        eye = geo.ball(R+f".eye-form-{s}",1,at,EYE,scale=(.020,.007,.0082),seg=40,rings=20)
        eye = face_node(eye,"eye"+side,rig)
        pupil = geo.ball(R+f".pupil-form-{s}",1,at+V(-s*.001,.0065,-.001),PUPIL,
                         scale=(.0051,.0018,.0055),seg=28,rings=14)
        face_node(pupil,"pupil"+side,rig,eye)
        for upper in (False,True):
            path = [at+V(t*.019,.0035,(.0036+(1-t*t)*.002 if upper else -.0035-(1-t*t)*.0015))
                    for t in np.linspace(-1,1,25)]
            attach(geo.tube(R+f".adult-eyelid-{s}-{upper}",path,[.0021]*len(path),SKIN,n=10,up=(0,1,0)),rig,"head")
        # Lower inner brows and raise the outer ends for intent eyes. The
        # previous descending line lifted the inner brow into a worried look.
        path = [head_point(math.radians(s*a),1.222+.014*(a-10)/31)+V(0,.003,0)
                for a in np.linspace(10,41,30)]
        face_node(geo.tube(R+f".brow-form-{s}",path,[.0048]*len(path),HAIR,n=12,up=(0,1,0)),"brow"+side,rig)
    mouth = [head_point(math.radians(a),1.123-.003*(abs(a)/26)**1.3)+V(0,.0012,0)
             for a in np.linspace(-26,26,48)]
    face_node(geo.tube(R+".set-closed-grimace",mouth,[.0017]*len(mouth),SHADOW,n=8,up=(0,1,0)),"mouth",rig)
    lip = [p+V(0,.0007,-.0038) for p in mouth[6:-6]]
    attach(geo.tube(R+".compressed-lower-lip",lip,[.0015]*len(lip),LIP,n=8,up=(0,1,0)),rig,"head")
    rig["faceContract"] = "firefightereyeL/R -> firefighterpupilL/R; firefighterbrowL/R; firefightermouth; centred frames"


def moustache(rig):
    for s in (-1,1):
        path = [head_point(math.radians(s*a),z)+V(0,.009,0)
                for a,z in ((1,1.153),(10,1.151),(22,1.145),(34,1.139),(42,1.142),(47,1.151))]
        path = [Vector(p) for p in kit.smooth_path(path,samples=9)]
        radii = [profile([(0,.010),(.20,.016),(.56,.016),(.80,.009),(1,.0025)],j/(len(path)-1))[0]
                 for j in range(len(path))]
        attach(geo.tube(R+f".swept-moustache-{s}",path,[(r,r*.66) for r in radii],HAIR,n=20,
                       up=(0,1,0)),rig,"head")
        for strand in range(7):
            offset = (strand-3)*.0022
            at = [p+V(0,.007+g(j/(len(path)-1),.5,.35)*.002,offset)
                  for j,p in enumerate(path[2:-2])]
            attach(geo.tube(R+f".moustache-lock-{s}-{strand}",at,[.0010]*len(at),HAIR,n=6,up=(0,1,0)),rig,"head")
        sideburn = [head_point(math.radians(s*a),z)+V(0,.0015,0)
                    for a,z in ((80,1.246),(77,1.222),(77,1.194))]
        attach(geo.tube(R+f".sideburn-{s}",sideburn,[(.007,.0028)]*3,HAIR,n=12,up=(0,1,0)),rig,"head")


def seal_ring(name, path, radius, material, up, n=12):
    # Cyclic tubes need a constant normal to their plane. A default Z-up
    # frame flips whenever the path tangent is near Z.
    path = list(path)
    wrapped = [path[-1]]+path+[path[0],path[1]]
    rings = geo.rings_along(wrapped,[radius]*len(wrapped),n,up=up)[1:-2]
    rings.append(rings[0])
    obj = geo.loft(R+"."+name,rings,material)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-6)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def helmet(rig):
    c = V(0,-.020,1.228)
    rings = []
    for t in np.linspace(0,math.pi/2,32):
        r = math.cos(t)
        rings.append([c+V(math.sin(j/80*TAU)*.116*r,
                          math.cos(j/80*TAU)*(.125 if math.cos(j/80*TAU)>=0 else .122)*r,
                          .104*math.sin(t)) for j in range(80)])
    attach(geo.loft(R+".helmet-engineered-dome",rings,BRASS,end="pole"),rig,"hat")
    # A short visor and a long neck guard are part of one shaped sheet.
    def brim(a,v):
        back = max(0,-math.cos(a))
        reach = .032+.090*back**1.4
        rx = .116+reach*v
        ry = .125+reach*v
        return c+V(math.sin(a)*rx,math.cos(a)*ry,
                    -.002-(.006+.061*back)*v+.004*math.sin(a)**2*v)
    rings = [[brim(j/80*TAU,v) for j in range(80)] for v in (0,.10,.40,.72,1)]
    obj = geo.loft(R+".helmet-long-neck-brim",rings,BRASS)
    select(obj)
    mod = obj.modifiers.new("Brass sheet thickness","SOLIDIFY")
    mod.thickness = .0038
    mod.offset = 0
    bpy.ops.object.modifier_apply(modifier=mod.name)
    attach(bevel(obj,.0018,2),rig,"hat")
    attach(seal_ring("helmet-rolled-brim-edge",[brim(j/96*TAU,1) for j in range(96)],.0035,GOLD,(0,0,1)),rig,"hat")
    attach(seal_ring("helmet-lower-reinforcing-band",[c+V(math.sin(j/96*TAU)*.117,
                       math.cos(j/96*TAU)*.126,.008) for j in range(96)],.003,GOLD,(0,0,1)),rig,"hat")
    # Comb is an extruded engineered plate with a raised central ridge.
    profile0 = [(.095,.035),(.110,.082),(.076,.139),(.021,.161),
                (-.030,.151),(-.086,.098),(-.107,.035),(-.095,.028),
                (-.048,.077),(0,.108),(.053,.082),(.081,.030)]
    verts = [c+V(x,y,z) for x in (-.012,.012) for y,z in profile0]
    n = len(profile0)
    faces = [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    attach(bevel(mesh("helmet-comb-crest",verts,faces,BRASS),.003,3),rig,"hat")
    outer = [c+V(0,y,z+.001) for y,z in profile0[:7]]
    attach(geo.tube(R+".helmet-crest-spine",outer,[.006]*len(outer),GOLD,n=14,up=(1,0,0)),rig,"hat")
    for y in (-.057,-.025,.014,.048,.076):
        top = profile([(-.057,.128),(-.025,.150),(.014,.160),(.048,.151),(.076,.138)],y)[0]
        for s in (-1,1):
            path = [c+V(s*.014,y,z) for z in np.linspace(.094,top-.008,14)]
            attach(geo.tube(R+f".crest-pressed-rib-{s}-{y}",path,[.0019]*len(path),GOLD,n=8,up=(1,0,0)),rig,"hat")
    # Badge shield, small central medallion and eight radial rays.
    outline = [(-.030,0),(-.035,.048),(-.026,.067),(0,.079),(.026,.067),(.035,.048),(.030,0),(0,-.008)]
    verts = [V(x,.111+thick,1.239+z) for thick in (0,.005) for x,z in outline]
    n = len(outline)
    faces = [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    attach(bevel(mesh("helmet-front-brigade-badge",verts,faces,PATINA),.002,2),rig,"hat")
    centre = V(0,.119,1.281)
    attach(geo.ball(R+".helmet-badge-medallion",1,centre,RED,
                    scale=(.014,.003,.014),seg=36,rings=18),rig,"hat")
    for j in range(12):
        a = j/12*TAU
        at = centre+V(math.sin(a)*.019,.002,math.cos(a)*.019)
        attach(geo.tube(R+f".helmet-badge-ray-{j}",[at,at+V(math.sin(a)*.007,0,math.cos(a)*.007)],
                        [.002]*2,GOLD,n=8,up=(0,1,0)),rig,"hat")
    for s in (-1,1):
        for j in range(4):
            a = s*(.38+j*.47)
            at = c+V(math.sin(a)*.117,math.cos(a)*.126,.010)
            attach(geo.ball(R+f".helmet-rivet-{s}-{j}",.0038,at,GOLD,seg=16,rings=8),rig,"hat")
        strap = [head_point(math.radians(s*a),z)+V(0,.003,0)
                 for a,z in ((79,1.228),(74,1.176),(45,1.081),(0,1.056))]
        path = [Vector(p) for p in kit.smooth_path(strap,samples=8)]
        attach(geo.tube(R+f".helmet-chinstrap-{s}",path,[(.0038,.0022)]*len(path),LEATHER,n=10,up=(0,1,0)),rig,"head")


def boots(s, rig):
    side = "R" if s>0 else "L"
    centre = ANKLE[s]
    rings = []
    for z in np.linspace(.031,.386,78):
        rx,rf,rb = profile([(.031,.078,.157,.063),(.047,.078,.158,.062),
             (.066,.075,.150,.060),(.095,.066,.122,.061),(.132,.055,.076,.057),
             (.181,.052,.058,.055),(.258,.056,.060,.056),(.336,.061,.064,.061),
             (.374,.064,.067,.064),(.386,.064,.067,.064)],z)
        ring = []
        for j in range(64):
            a = j/64*TAU
            sa,ca = math.sin(a),math.cos(a)
            wrinkle = (.0035*g(z,.137,.012)-.0025*g(z,.152,.006))*max(0,ca)
            ring.append(V(centre.x+geo.spow(sa,2/2.35)*(rx+wrinkle),
                          centre.y+geo.spow(ca,2/2.35)*((rf if ca>=0 else rb)+wrinkle),z))
        rings.append(ring)
    obj = geo.loft(R+f".tall-boot-shaped-last-{s}",rings,BOOT,start="flat",end="flat")
    points = np.array([v.co[:] for v in obj.data.vertices])
    foot = 1-ss(.103,.198,points[:,2])
    add_weights(obj,rig,{"knee"+side:1-foot,"foot"+side:foot})
    # Real outsole profile and heel; no enormous flat plate under the foot.
    outline = []
    for j in range(64):
        a = j/64*TAU
        outline.append(V(centre.x+geo.spow(math.sin(a),2/2.5)*.079,
                         centre.y+geo.spow(math.cos(a),2/2.5)*(.160 if math.cos(a)>=0 else .065),0))
    rings = [[p+V(0,0,z) for p in outline] for z in (.005,.010,.021,.031)]
    attach(geo.loft(R+f".boot-outsole-{s}",rings,SOLE,start="flat",end="flat"),rig,"foot"+side)
    attach(geo.rbox(R+f".boot-heel-{s}",(.135,.064,.018),centre+V(0,-.024,-.084),SOLE,levels=2,crease=.65),rig,"foot"+side)
    rim = [V(centre.x+math.sin(j/64*TAU)*.064,centre.y+math.cos(j/64*TAU)*.067,.382) for j in range(64)]
    attach(seal_ring(f"boot-clean-top-rim-{s}",rim,.005,BOOT,(0,0,1)),rig,"knee"+side)
    for a in (-math.pi/2,math.pi/2):
        path = [V(centre.x+math.sin(a)*.064,centre.y+math.cos(a)*.067,z) for z in np.linspace(.290,.375,20)]
        attach(geo.tube(R+f".boot-pulltab-{s}-{a}",path,[.004]*len(path),LEATHER,n=8,up=(1,0,0)),rig,"knee"+side)


def dress(rig, tunic):
    # Thick fitted collar, with a split front rather than an inflatable ring.
    for s in (-1,1):
        angles = np.linspace(s*.14,s*math.pi,55)
        rings = [[body_point(float(a),z,.003)+V(0,0,.005) for a in angles] for z in (.997,1.012,1.036)]
        obj = geo.loft(R+f".standing-collar-{s}",rings,TUNIC,closed=False)
        select(obj)
        mod = obj.modifiers.new("Tailored collar thickness","SOLIDIFY")
        mod.thickness = .004
        bpy.ops.object.modifier_apply(modifier=mod.name)
        follow_skin(obj,rig,tunic)
    for s in (-1,1):
        for k,z in enumerate((.952,.893,.833,.773)):
            at = body_point(math.radians(s*26),z,.010)
            obj = geo.ball(R+f".tunic-brass-button-{s}-{k}",1,at,GOLD,
                           scale=(.0105,.006,.0105),seg=24,rings=12)
            follow_skin(obj,rig,tunic)
        edge = [body_point(math.radians(s*58),float(z),.0025) for z in np.linspace(.585,.947,60)]
        obj = geo.tube(R+f".tailored-princess-seam-{s}",edge,[.0014]*len(edge),TROUSER,n=8,up=(0,1,0))
        follow_skin(obj,rig,tunic)
    # The overlap has its own raised edge and turned hem.
    edge = [body_point(math.radians(-17),float(z),.005) for z in np.linspace(.565,.968,74)]
    follow_skin(geo.tube(R+".double-breasted-overlap",edge,[.0022]*len(edge),TUNIC,n=10,up=(0,1,0)),rig,tunic)
    hem = [body_point(j/96*TAU,.550,.0015) for j in range(96)]
    follow_skin(seal_ring("tunic-turned-hem",hem,.0035,TUNIC,(0,0,1)),rig,tunic)
    belt = [[body_point(j/72*TAU,z,.008) for j in range(72)] for z in (.642,.651,.690,.700)]
    attach(geo.loft(R+".leather-waist-belt",belt,LEATHER),rig,"torso")
    # Buckle is a frame, leaving the belt visibly passing through its centre.
    centre = V(0,.140,.671)
    for axis,offset,span in (("x",-.026,.066),("x",.026,.066),("z",-.033,.052),("z",.033,.052)):
        if axis=="x":
            a,b = centre+V(offset,0,-span/2),centre+V(offset,0,span/2)
        else:
            a,b = centre+V(-span/2,0,offset),centre+V(span/2,0,offset)
        attach(geo.tube(R+f".belt-buckle-{axis}-{offset}",[a,b],[.004]*2,GOLD,n=12,up=(0,1,0)),rig,"torso")
    attach(geo.tube(R+".belt-buckle-tongue",[centre+V(-.022,.003,0),centre+V(.011,.003,0)],
                    [.0028]*2,GOLD,n=10,up=(0,1,0)),rig,"torso")
    for j in range(4):
        at = body_point(math.radians(18+j*8),.671,.013)
        attach(geo.ball(R+f".belt-punch-hole-{j}",1,at,SOLE,scale=(.002,.001,.002),seg=12,rings=6),rig,"torso")
    # Proper rescue axe, in a shaped leather frog on the left hip.
    c = V(-.184,.051,.641)
    attach(geo.rbox(R+".axe-leather-frog",(.029,.050,.066),c,LEATHER,levels=2,crease=.45),rig,"torso")
    attach(geo.tube(R+".axe-wood-handle",[c+V(0,0,-.145),c+V(.005,0,.064)],
                    [(.012,.009),(.010,.008)],WOOD,n=20,up=(1,0,0)),rig,"torso")
    outline = [(-.007,-.023),(-.035,-.041),(-.040,.040),(-.007,.024),(.012,.015),(.042,.030),(.027,.004),(.011,-.009)]
    outline.reverse()  # geo.slab requires a counterclockwise local XY outline.
    frame = Matrix.Translation(c+V(0,.008,.055))@Matrix.Rotation(math.pi/2,4,"X")
    attach(bevel(geo.slab(R+".forged-rescue-axe-head",outline,.014,STEEL,matrix=frame),.002,2),rig,"torso")


def nozzle(rig):
    c,d = GRIP[1],NOZZLE_AXIS
    # Hollow open bell, substantial silhouette and separate coupling/grips.
    profile0 = [(-.104,.040),(-.088,.047),(-.050,.043),(-.039,.035),
                 (.014,.034),(.077,.032),(.128,.033),(.159,.038),
                 (.178,.036),(.294,.031),(.371,.022),(.404,.026),
                 (.427,.047),(.443,.052),(.452,.051),(.451,.044),
                 (.432,.039),(.407,.019),(.370,.016)]
    rings = [[c+d*t+(V(1,0,0)*math.cos(j/64*TAU)+V(0,d.z,-d.y)*math.sin(j/64*TAU))*r
              for j in range(64)] for t,r in profile0]
    attach(geo.loft(R+".working-hollow-nozzle",rings,BRASS),rig,"weapon")
    for j,(t,r,width) in enumerate(((-.079,.050,.012),(-.043,.037,.005),(.099,.037,.006),(.175,.040,.008),(.398,.030,.006),(.447,.054,.005))):
        attach(geo.tube(R+f".nozzle-machined-ring-{j}",[c+d*(t-width),c+d*(t+width)],
                        [r,r],GOLD,n=48,up=(1,0,0),caps=("flat","flat")),rig,"weapon")
    for k,t in enumerate((0,.195)):
        attach(geo.tube(R+f".nozzle-textured-grip-{k}",[c+d*(t-.038),c+d*(t+.038)],
                        [.033,.033],LEATHER,n=48,up=(1,0,0),caps=("flat","flat")),rig,"weapon")
        for j in range(8):
            at = t-.034+j*.0096
            path = [c+d*at+(V(1,0,0)*math.cos(a)+V(0,d.z,-d.y)*math.sin(a))*.0334
                    for a in np.linspace(0,TAU,64,endpoint=False)]
            attach(seal_ring(f"nozzle-grip-thread-{k}-{j}",path,.0008,HOSE,d),rig,"weapon")
    for j in range(6):
        a = j/6*TAU
        at = c-d*.082+(V(1,0,0)*math.cos(a)+V(0,d.z,-d.y)*math.sin(a))*.052
        attach(geo.rbox(R+f".nozzle-coupling-lug-{j}",(.014,.016,.012),at,GOLD,levels=1,crease=.7),rig,"weapon")
    # A cast shutoff bow adds a readable engineering detail above the pipe.
    q = V(0,-d.z,d.y)
    path = [c+d*.081+q*.034,c+d*.104+q*.063,c+d*.142+q*.063,c+d*.163+q*.036]
    path = [Vector(p) for p in kit.smooth_path(path,samples=7)]
    attach(geo.tube(R+".nozzle-shutoff-bow",path,[.005]*len(path),PATINA,n=14,up=(1,0,0)),rig,"weapon")
    attach(geo.tube(R+".nozzle-dark-throat",[c+d*.375,c+d*.385],[.015,.015],SOLE,n=32,up=(1,0,0)),rig,"weapon")


def hose(rig):
    c,d = GRIP[1],NOZZLE_AXIS
    guides = [c-d*.104,c-d*.138+V(.005,0,-.023),V(.249,.017,.399),V(.222,-.048,.288),
              V(.218,-.110,.131),V(.182,-.207,.041),V(.110,-.352,.034),
              V(.018,-.469,.034),V(-.022,-.569,.034)]
    path = [Vector(p) for p in kit.smooth_path(guides,samples=12)]
    obj = geo.tube(R+".weighted-canvas-hose",path,[.032]*len(path),HOSE,n=32,up=(1,0,0),caps=(None,"flat"))
    points = np.array([v.co[:] for v in obj.data.vertices])
    samples = np.array([p[:] for p in path])
    nearest = np.argmin(np.sum((points[:,None,:]-samples[None,:,:])**2,axis=2),axis=1)
    arc = np.concatenate(([0],np.cumsum(np.linalg.norm(np.diff(samples,axis=0),axis=1))))[nearest]
    mouth = 1-ss(.015,.340,arc)
    middle = np.minimum(1-mouth,ss(.190,.390,arc)*(1-ss(.540,.860,arc)))
    add_weights(obj,rig,{"cape":mouth,"cape2":middle,"torso":1-mouth-middle})
    # The coupling end follows the nozzle; the trailing canvas is anchored
    # to the body's lower frame, so raising the pipe cannot lift the whole
    # hose half a metre off the field. Surface bands share its real weights.
    rings = geo.rings_along(path,[.0326]*len(path),24,up=(1,0,0))
    for j in range(4,len(path)-3,6):
        band = seal_ring(f"hose-weave-{j}",rings[j],.0008,HOSE,(path[j+1]-path[j-1]).normalized(),n=6)
        follow_skin(band,rig,obj)


def surface_finish(root):
    specs = {SKIN:(.68,0),LIP:(.72,0),NAIL:(.58,0),HAIR:(.56,0),
             TUNIC:(.87,0),TROUSER:(.90,0),EDGE:(.87,0),BRASS:(.31,.78),
             GOLD:(.23,.86),PATINA:(.46,.65),BOOT:(.66,0),LEATHER:(.75,0),HOSE:(.90,0)}
    for name,(rough,metal) in specs.items():
        mat = kit.material(name)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Transmission Weight"].default_value = 0
        bsdf.inputs["Subsurface Weight"].default_value = 0
        bsdf.inputs["Specular IOR Level"].default_value = .25
        if name in (TUNIC,TROUSER,EDGE,HOSE):
            bsdf.inputs["Sheen Weight"].default_value = .23
            noise = mat.node_tree.nodes.new("ShaderNodeTexNoise")
            noise.inputs["Scale"].default_value = 210
            noise.inputs["Detail"].default_value = 1
            bump = mat.node_tree.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = .10
            bump.inputs["Distance"].default_value = .00020
            mat.node_tree.links.new(noise.outputs["Fac"],bump.inputs["Height"])
            mat.node_tree.links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        attr = obj.data.color_attributes.get("AO") or obj.data.color_attributes.new(name="AO",type="FLOAT_COLOR",domain="CORNER")
        attr.data.foreach_set("color",np.ones(len(attr.data)*4,dtype=np.float32))
        obj.data.color_attributes.active_color = attr
        obj.data.color_attributes.render_color_index = 0


def build_master():
    root = kit.empty(R)
    root["unoptimized"] = True
    root["sourceBrief"] = "work/arena/2026-10-08-roster/firefighter/brief.md"
    root["relaxedBind"] = True
    rig = make_rig(root)
    parts = [torso(),sleeve(-1),sleeve(1)]
    fields = [source_field(obj) for obj in parts]
    tunic = fuse(parts,"continuous-tailored-tunic",float(os.environ.get("FIREFIGHTER_MASTER_VOXEL",".0040")))
    weight_tunic(tunic,rig,fields)
    del fields
    gc.collect()
    for s in (-1,1):
        trouser(s,rig)
        cuff(s,rig,tunic)
        arm_skin(s,rig)
        fingers(s,rig)
        boots(s,rig)
    head(rig)
    face_controls(rig)
    moustache(rig)
    helmet(rig)
    dress(rig,tunic)
    nozzle(rig)
    hose(rig)
    surface_finish(root)
    kit.refresh()
    return root
