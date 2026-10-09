"""Diver-only authored source: sewn canvas, adult face and constructed brass.

The editable master is built here; the ordinary collector loads a separately
reviewed runtime .blend. Nothing in the shared folk kit is changed. +Y faces
forward, Z is up, and all runtime joints have common-axis rest frames. The
neutral pose has hanging upper arms and fifteen-degree elbow flexion.
"""
import json
import hashlib
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_folk_kit as geo

V = geo.V
TAU = math.tau
R = "diver"
BASE = Path(__file__).resolve().parents[3] / "work/arena/2026-10-08-roster/diver"
SKIN = "skin:" + kit.tint("diver-adult-skin", "#c68c68")
HAIR = "hair:" + kit.tint("diver-beard-brown", "#493323")
BRASS = "gilt:" + kit.tint("diver-brushed-brass", "#c39745")
EDGE = "gilt:" + kit.tint("diver-brass-edge", "#e4b963")
PATINA = "gilt:" + kit.tint("diver-recess-brass", "#6d633b")
LEAD = "tin:" + kit.tint("diver-weight-lead", "#545e68")
RUBBER = "rubber:" + kit.tint("diver-rubber", "#27282b")
LEATHER = "hide:" + kit.tint("diver-belt-leather", "#4e3828")
LINING = "felt:" + kit.tint("diver-port-lining", "#242b30")
GLASS = "lacquer:" + kit.tint("diver-sideglass", "#204e64")
WHITE = "resin:" + kit.tint("diver-eye-ivory", "#e6ddc4")
IRIS = "resin:" + kit.tint("diver-eye-umber", "#463925")
MOUTH = "resin:" + kit.tint("diver-mouth-depth", "#402625")
TEETH = "resin:" + kit.tint("diver-teeth-ivory", "#dcd3bb")
# Scope preview colours to this figure. Arena reads the first two colon
# fields, so team colours still follow the side in the actual renderer.
kit.tint("team:diver", "#2f63e0")
kit.tint("team2:diver", "#1c3a94")
CLOTH, PATCH = "weave:team:diver", "weave:team2:diver"

WAIST = V(0, 0, .60)
CHEST = V(0, -.006, .855)
NECK = V(0, -.003, 1.071)
HC = V(0, -.004, 1.218)
HELMET_RADIUS = .181
SHOULDER = {s: V(s*.215, -.004, .996) for s in (-1, 1)}
ELBOW = {s: V(s*.255, .012, .750) for s in (-1, 1)}
WRIST = {s: V(s*.266, .073, .523) for s in (-1, 1)}
HAND = {s: WRIST[s] + (WRIST[s]-ELBOW[s]).normalized()*.060 for s in (-1, 1)}
HIP = {s: V(s*.109, -.005, .581) for s in (-1, 1)}
KNEE = {s: V(s*.126, .028, .350) for s in (-1, 1)}
ANKLE = {s: V(s*.133, .012, .105) for s in (-1, 1)}
ROD = V(0, .28, .96).normalized()
WRENCH_ROLL = math.radians(-40)
# The laden hand closes round the steeply carried shaft. Its knuckle row
# stays perpendicular to that shaft; the free hand still hangs loosely.
# This is authored hand shape, not a rest rotation on a common-axis bone.
HAND[1] = WRIST[1] + V(0, ROD.z, -ROD.y)*.060
BODY = [(.505,.163,.139,.132),(.554,.187,.155,.150),
        (.608,.192,.164,.158),(.682,.203,.173,.163),
        (.760,.216,.178,.166),(.848,.222,.184,.169),
        (.919,.222,.182,.168),(.961,.205,.162,.153),
        (.995,.179,.135,.139),(1.028,.120,.099,.104),
        (1.064,.070,.067,.070),(1.080,.068,.066,.066)]
HEAD = [(1.083,.057,.060,.066),(1.098,.080,.080,.077),
        (1.128,.107,.085,.090),(1.166,.119,.090,.101),
        (1.198,.118,.092,.108),(1.240,.114,.094,.110),
        (1.268,.119,.090,.106),(1.295,.110,.080,.095),
        (1.326,.084,.060,.067),(1.345,.019,.017,.020)]


def ss(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def g(x, centre, width):
    return math.exp(-((x-centre)/width)**2)


def profile(rows, z):
    """Bounded C1 section interpolation, with no straight section ledges."""
    if z <= rows[0][0]:
        return rows[0][1:]
    if z >= rows[-1][0]:
        return rows[-1][1:]
    for a, b in zip(rows, rows[1:]):
        if z <= b[0]:
            t = float(ss(a[0], b[0], z))
            return tuple(geo.lerp(a[j], b[j], t) for j in range(1, len(a)))


def mesh(name, vertices, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(kit.material(material))
    for f in data.polygons:
        f.use_smooth = True
    return obj


def body_point(a, z, extra=0):
    width, front, back = profile(BODY, z)
    sn, cs = math.sin(a), math.cos(a)
    ad = abs((math.degrees(a)+180)%360-180)
    power = 2.15 + .10*float(ss(.78,.94,z))
    x = geo.spow(sn, 2/power)*(width+extra)
    y = geo.spow(cs, 2/power)*((front if cs>=0 else back)+extra)
    # Cloth tension is broad at the chest and tighter at the weighted belt.
    relief = .0050*g(z,.888,.073)*g(ad,35,24)
    relief -= .006*g(z,.979,.020)*g(ad,0,11)
    # Padding spills over the heavy belt. Three unequal, oblique folds
    # have a broad rolled lip and a tighter trough, not a repeated ripple.
    for height,tilt,amount in ((.673,.018,.011),(.705,-.025,.008),(.565,.014,.007)):
        fold=height+tilt*math.sin(a*2+.4)
        relief += (amount*g(z,fold,.016)-amount*.62*g(z,fold-.018,.006))*g(ad,38,55)
    relief += .009*g(z,.657,.027)*math.sin(a*6+.3)
    relief -= .012*g(z,.865,.071)*g(ad,90,22)
    relief += .003*g(z,.963-.022*min(ad,90)/90,.009)*g(ad,40,35)
    return V(x+sn*relief, y+cs*relief, z)


def trunk():
    rings = [[body_point(i/96*TAU,z) for i in range(96)]
             for z in np.linspace(BODY[0][0],BODY[-1][0],112)]
    return geo.loft("diver.canvas-torso",rings,CLOTH,start="pole",end="pole")


def torso_side(s,y,z):
    """Actual sewn torso envelope, including the oblique belt folds."""
    low,high=0,math.pi/2
    for _ in range(22):
        a=(low+high)/2
        p=body_point(s*a if y>=0 else s*(math.pi-a),z)
        if abs(p.y)>abs(y):low=a
        else:high=a
    return abs(p.x)


def canvas_arm(s):
    """Continuous shoulder-elbow-wrist section; no ball/capsule assembly."""
    a,e,w = SHOULDER[s],ELBOW[s],WRIST[s]
    path = []
    sections = []
    for t in np.linspace(-.14,.84,50):
        at = a+(e-a)*float(t)
        radius = profile([(0,.086,.083),(.22,.085,.082),(.5,.076,.072),
                          (.78,.068,.064),(1,.064,.061)],max(0,float(t)))
        if t<0:
            k=math.sqrt(max(.04,1-(float(t)/.155)**2))
            radius=tuple(r*k for r in radius)
        path.append(at);sections.append(radius)
    before,after = a+(e-a)*.84,e+(w-e)*.19
    for t in np.linspace(.035,1,23):
        t=float(t)
        path.append(before*(1-t)**2+e*2*t*(1-t)+after*t*t)
        sections.append((.064,.061))
    for t in np.linspace(.215,1,43):
        t=float(t)
        path.append(e+(w-e)*t)
        r = .048+.011*(1-t)+.010*g(t,.32,.23)
        sections.append((r,r*.96))
    rings=geo.rings_along(path,sections,n=64,up=(0,1,0))
    for j,ring in enumerate(rings):
        q=j/(len(rings)-1)
        for k,p in enumerate(ring):
            a_=k/64*TAU
            # Folds gather at the elbow and rubber cuff; long outer seam.
            inward=.35+.65*max(0,math.cos(a_))**2
            d=0
            for fold,tilt,amount in ((.43,.044,.014),(.54,-.038,.012),(.66,.031,.010)):
                at=fold+tilt*math.sin(a_*2+.6)
                d+=(amount*g(q,at,.037)-amount*.64*g(q,at+.039,.015))*inward
            d+=.0045*g(q,.89,.10)*math.sin(a_*3-q*34)
            radial=(p-path[j]).normalized()
            p+=radial*d
            # Below the shoulder seam the inner sleeve must clear the
            # actual torso envelope. V2 fused it almost to the elbow,
            # producing a long stretched web in a sideways arm raise.
            free=1-float(ss(.904,.958,p.z))
            limit=torso_side(s,p.y,p.z)+.012 if free>0 else 0
            x=s*p.x
            # C1 soft floor, confined to the hidden inward-facing side.
            delta=x-limit
            floor=limit+(0 if delta<=-.003 else delta if delta>=.003
                         else (delta+.003)**2/.012)
            p.x=s*geo.lerp(x,floor,free)
    return geo.loft(f"diver.canvas-sleeve-{s}",rings,CLOTH,
                    start=a-(e-a).normalized()*.049,
                    end=w+(w-e).normalized()*.006)


def canvas_leg(s):
    a,k,f=HIP[s],KNEE[s],ANKLE[s]
    path=[];radii=[]
    for t in np.linspace(-.16,.79,100):
        t=float(t)
        p=geo.lerp(a,k,min(1,t*2)) if t<.5 else geo.lerp(k,f,(t-.5)*2)
        width,depth=profile([(0,.092,.099),(.15,.096,.102),(.35,.087,.090),
                             (.5,.079,.085),(.67,.080,.080),
                             (.86,.068,.069),(1.03,.059,.057)],max(0,t))
        # Tuck a closed end into the boot shaft instead of running a
        # remeshed trouser tube down inside the instep and its eyelets.
        tuck=1-float(ss(.212,.255,p.z))
        width=geo.lerp(width,.049,tuck);depth=geo.lerp(depth,.048,tuck)
        path.append(p);radii.append((width,depth))
    rings=geo.rings_along(path,radii,n=64,up=(0,1,0))
    for j,row in enumerate(rings):
        t=j/(len(rings)-1)
        for i,p in enumerate(row):
            a_=i/64*TAU
            d=.004*g(t,.24,.12)*math.sin(3*a_-t*12)
            for fold,tilt,amount in ((.39,.045,.013),(.51,-.035,.016),(.63,.039,.012)):
                at=fold+tilt*math.sin(a_*2+s*.7)
                front=.40+.60*max(0,math.cos(a_))**2
                d+=(amount*g(t,at,.039)-amount*.66*g(t,at+.038,.014))*front
            d*=float(ss(.224,.270,p.z))
            p+=(p-path[j]).normalized()*d
    return geo.loft(f"diver.canvas-trouser-{s}",rings,CLOTH,start="pole",end="flat")


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj


def source_tree(obj):
    return BVHTree.FromPolygons([v.co[:] for v in obj.data.vertices],
                               [list(p.vertices) for p in obj.data.polygons])


def fuse_canvas(parts):
    """Union only genuine seams; distal hanging sleeves clear the flanks."""
    for obj in parts:
        kit.apply(obj);kit.apply_transform(obj)
    fields=[source_tree(obj) for obj in parts]
    select(parts[0])
    for obj in parts:
        obj.select_set(True)
    bpy.ops.object.join()
    obj=parts[0];obj.name="diver.suit-skin"
    mod=obj.modifiers.new("Sewn local canvas junctions","REMESH")
    # The 36 GB Mac must run one build at a time. Keep one modest source
    # subdivision and a bounded local union, rather than a dense sculpt grid.
    mod.mode="VOXEL";mod.voxel_size=.0042;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new("Canvas seam continuity","SMOOTH")
    mod.factor=.48;mod.iterations=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.clear();obj.data.materials.append(kit.material(CLOTH))
    for face in obj.data.polygons:
        face.use_smooth=True
    return obj,fields


def distance(points,a,b):
    axis=np.array(b-a);t=np.clip((points-np.array(a)).dot(axis)/axis.dot(axis),0,1)
    return np.linalg.norm(points-(np.array(a)+t[:,None]*axis),axis=1)


def make_rig(root):
    data=bpy.data.armatures.new("Diver anatomical common-axis rig")
    rig=bpy.data.objects.new("diver.skeleton",data)
    bpy.context.collection.objects.link(rig);rig.parent=root
    positions={"torso":WAIST,"chest":CHEST,"head":NECK,
               "beard":V(0,.085,1.167),"weapon":HAND[1],
               "cape":V(0,-.174,1.270),"cape2":V(.087,-.277,1.104)}
    parents={"chest":"torso","head":"chest","beard":"head",
             "weapon":"handR","cape":"head","cape2":"cape"}
    for s,side in ((-1,"L"),(1,"R")):
        positions.update({"clav"+side:V(s*.053,-.004,1.014),
                          "arm"+side:SHOULDER[s],"fore"+side:ELBOW[s],
                          "hand"+side:WRIST[s],"leg"+side:HIP[s],
                          "knee"+side:KNEE[s],"foot"+side:ANKLE[s],
                          "sleeve"+side:SHOULDER[s]})
        parents.update({"clav"+side:"chest","arm"+side:"clav"+side,
                        "fore"+side:"arm"+side,"hand"+side:"fore"+side,
                        "knee"+side:"leg"+side,"foot"+side:"knee"+side,
                        "sleeve"+side:"clav"+side})
    select(rig);bpy.ops.object.mode_set(mode="EDIT")
    for name,p in positions.items():
        b=data.edit_bones.new("diver."+name)
        b.head=p;b.tail=p+V(0,0,.06);b.use_connect=False
    for name,parent in parents.items():
        data.edit_bones["diver."+name].parent=data.edit_bones["diver."+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    data.display_type="WIRE";rig.show_in_front=True
    rig["arenaCommonAxes"]=True
    rig["anatomicalPivots"]=json.dumps({k:list(v) for k,v in positions.items()})
    return rig


def add_weights(obj,rig,weights):
    # Weighted garments need the same world-scale surface coordinates as
    # rigid attachments; the live weave/hide families sample their relief
    # through TEXCOORD_0. Volume remesh does not retain those coordinates.
    geo.uv_box(obj)
    total=np.maximum(1e-8,np.sum(list(weights.values()),axis=0))
    for name,raw in weights.items():
        quant=np.rint(np.clip(raw/total,0,1)*10000).astype(int)
        indices=np.flatnonzero(quant>0)
        if not len(indices):
            continue
        group=obj.vertex_groups.new(name="diver."+name)
        indices=indices[np.argsort(quant[indices])]
        for batch in np.split(indices,np.flatnonzero(np.diff(quant[indices]))+1):
            if len(batch):
                group.add(batch.tolist(),float(quant[batch[0]])/10000,"REPLACE")
    obj.parent=rig
    mod=obj.modifiers.new("Continuous anatomical skin","ARMATURE")
    mod.object=rig;mod.use_deform_preserve_volume=False
    obj["continuousSkin"]=True


def weight_canvas(obj,rig,fields):
    points=np.array([v.co[:] for v in obj.data.vertices])
    x,y,z=points.T
    chest=ss(.73,.93,z)
    weights={"torso":1-chest,"chest":chest}
    # Keep provenance of sewn panels, rather than guessing ownership from x.
    # Hanging sleeve interiors must not retain torso weights after a raise.
    d=np.array([[tree.find_nearest(Vector(p))[3] for p in points] for tree in fields])
    for index,(s,side) in enumerate(((-1,"L"),(1,"R"))):
        a,e,w=SHOULDER[s],ELBOW[s],WRIST[s]
        limb=d[index+1]
        other=np.min(np.delete(d,index+1,axis=0),axis=0)
        along=(points-np.array(a)).dot(np.array(e-a))/(e-a).length_squared
        share=ss(-.0025,.0035,other-limb)*ss(-.17,.27,along)
        shoulder=share*(1-ss(.06,.39,along))*.36
        fore=ss(-.019,.019,distance(points,a,e)-distance(points,e,w))
        hand=ss(-.018,.014,(points-np.array(w)).dot(np.array((w-e).normalized())))
        weights["clav"+side]=shoulder
        weights["arm"+side]=(share-shoulder)*(1-fore)
        weights["fore"+side]=(share-shoulder)*fore*(1-hand)
        weights["hand"+side]=(share-shoulder)*fore*hand
        weights["torso"]*=1-share;weights["chest"]*=1-share
        leg=d[index+3]
        other=np.min(np.delete(d,index+3,axis=0),axis=0)
        share=ss(-.0025,.0035,other-leg)*(1-ss(.535,.635,z))
        knee=1-ss(.310,.393,z)
        foot=1-ss(.123,.205,z)
        weights["leg"+side]=share*(1-knee)
        weights["knee"+side]=share*knee*(1-foot)
        weights["foot"+side]=share*knee*foot
        weights["torso"]*=1-share;weights["chest"]*=1-share
    # Upper-chest/trapezius cloth progressively follows the shoulder girdle.
    for s,side in ((-1,"L"),(1,"R")):
        share=ss(.068,.184,s*x)*ss(.931,1.026,z)*.27
        available=weights["chest"]*share
        weights["clav"+side]+=available;weights["chest"]-=available
    add_weights(obj,rig,weights)
    sub=obj.modifiers.new("Editable high resolution canvas","SUBSURF")
    sub.levels=sub.render_levels=1
    # The master, transient review and runtime use the same deformation
    # convention: refine the weighted rest surface before the armature.
    select(obj)
    while obj.modifiers[0]!=sub:bpy.ops.object.modifier_move_up(modifier=sub.name)
    obj["panelProvenance"]="torso,L sleeve,R sleeve,L trouser,R trouser"


def follow_canvas(obj,rig,canvas):
    """Sample all underlying panel weights, including the shoulder girdle.

    Merely attaching a raised sleeve seam to arm/fore leaves it behind the
    canvas's clavicle share. Use the actual sewn mesh's barycentric field.
    """
    data=canvas.data;data.calc_loop_triangles()
    points=[vertex.co.copy() for vertex in data.vertices]
    faces=[tuple(face.vertices) for face in data.loop_triangles]
    tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
    names={group.index:group.name.removeprefix("diver.") for group in canvas.vertex_groups}
    source=[{names[group.group]:group.weight for group in vertex.groups}
            for vertex in data.vertices]
    weights={name:np.zeros(len(obj.data.vertices)) for name in names.values()}
    for index,vertex in enumerate(obj.data.vertices):
        at,_,face,_=tree.find_nearest(vertex.co)
        a,b,c=faces[face]
        bary=barycentric_transform(at,points[a],points[b],points[c],
                                   V(1,0,0),V(0,1,0),V(0,0,1))
        for corner,k in zip((a,b,c),bary):
            for name,value in source[corner].items():
                weights[name][index]+=max(0,k)*value
    add_weights(obj,rig,weights)
    obj["skinFieldSource"]=canvas.name


def attach(obj,rig,bone):
    kit.apply(obj);kit.apply_transform(obj)
    geo.uv_box(obj)
    world=obj.matrix_world.copy()
    obj.parent=rig;obj.parent_type="BONE";obj.parent_bone="diver."+bone
    obj.matrix_world=world
    for poly in obj.data.polygons:
        poly.use_smooth=True
    return obj


def band(name,a,b,radius,material,n=48):
    return geo.tube("diver."+name,[a,b],[radius,radius],material,n=n,
                    up=(1,0,0),caps=("flat","flat"))


def closed_tube(name,path,radii,material,n=12,up=(0,0,1)):
    """Periodic sweep with one stable plane normal and a welded seam.

    The folk tube's default up flips on a circular XZ path when the
    tangent reaches Z. Use cyclic tangents and the ring's plane normal.
    """
    path=[Vector(p) for p in path];radii=list(radii)
    if (path[0]-path[-1]).length<1e-7:
        path.pop();radii.pop()
    rings=[]
    for j,p in enumerate(path):
        u,v=geo.frame_at(path[(j+1)%len(path)]-path[j-1],up)
        r=radii[j]
        rx,ry=r if isinstance(r,(tuple,list)) else (r,r)
        rings.append([p+u*(rx*math.cos(a))+v*(ry*math.sin(a))
                      for a in np.linspace(0,TAU,n,endpoint=False)])
    obj=geo.loft(name,rings+[rings[0]],material)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    return obj


def gloves(s):
    """Four hooked articulated fingers, a thumb web and a constructed gauntlet."""
    w,c=WRIST[s],HAND[s]
    f=(c-w).normalized()
    rod=ROD if s>0 else V(0,.968,.250).normalized()
    normal=V(-s,0,0)
    # A low-volume metacarpal cage, tapered at the wrist and knuckle row.
    rows=[]
    for t in np.linspace(0,1,28):
        t=float(t);at=w+f*(.012+.060*t)
        width,depth=profile([(0,.035,.025),(.4,.040,.033),(.78,.042,.034),(1,.036,.032)],t)
        rows.append([at+rod*(width*geo.spow(math.sin(a),.72))+
                     normal*(depth*geo.spow(math.cos(a),.78))
                     for a in np.linspace(0,TAU,40,endpoint=False)])
    pieces=[geo.loft(f"diver.glove-palm-{s}",rows,RUBBER,start="pole",end="pole")]
    for i,spread in enumerate((-.030,-.010,.010,.028)):
        knuckle=c+rod*spread+f*.008
        length=(.050,.055,.052,.043)[i]
        if s>0:
            # Knuckle starts on the dorsal side. The pad curls onto the
            # palmar side around the shaft, rather than bending backwards
            # away from an inward-facing palm.
            controls=[knuckle-normal*.012,
                      knuckle+f*(length*.62)-normal*.010,
                      knuckle+f*length+normal*.015,
                      knuckle+f*(length*.67)+normal*.064,
                      knuckle+f*.021+normal*.083,
                      knuckle+f*.006+normal*.084]
        else:
            # The unladen glove hangs loosely with a small finger curl.
            controls=[knuckle-normal*.005,
                      knuckle+f*(length*.54)+normal*.003,
                      knuckle+f*length+normal*.008,
                      knuckle+f*(length*.99)+normal*.018]
        path=[Vector(p) for p in kit.smooth_path(controls,samples=6)]
        radii=[(.0105*(.94+.13*math.sin(j/(len(path)-1)*math.pi)),.0090)
               for j in range(len(path))]
        finger=geo.tube(f"diver.glove-finger-{s}-{i}",path,radii,RUBBER,n=16,
                        up=rod,caps=("dome","dome"))
        pieces.append(finger)
        # Two shallow crease seams on the top of each glove finger.
        for k in (.23,.48):
            at=path[int(k*(len(path)-1))]
            seam=[at+rod*.007,at+normal*.003,at-rod*.007]
            pieces.append(geo.tube(f"diver.glove-crease-{s}-{i}-{k}",seam,
                                   [.0013]*3,LEATHER,n=6))
    thumb=[w+rod*.031+normal*.012+f*.020,
           c+rod*.046+normal*.027+f*.003,
           c+rod*.023+normal*.047+f*.035,
           c-rod*.001+normal*.047+f*.038] if s>0 else [
               w+rod*.031+normal*.012+f*.020,
               c+rod*.050+normal*.012+f*.030,
               c+rod*.036+normal*.020+f*.045]
    path=kit.smooth_path(thumb,samples=7)
    pieces.append(geo.tube(f"diver.glove-thumb-{s}",path,
                           [(.014,.012)]*len(path),RUBBER,n=18))
    # Hand union is local; discrete long fingers keep real visible separation.
    palm=pieces[0]
    return pieces,palm


def head_point(a,z):
    width,front,back=profile(HEAD,z)
    sn,cs=math.sin(a),math.cos(a)
    ad=abs((math.degrees(a)+180)%360-180)
    x=geo.spow(sn,.80)*width
    # Put the face behind the clear convex front window. V1 projected
    # beyond the helmet and gave most of the aperture to a blank forehead.
    y=.022+geo.spow(cs,.84)*(front if cs>=0 else back)
    if ad<90:
        y+=.014*g(z,1.260,.015)*g(ad,25,20)  # heavy knitted brow ridge
        y-=.010*g(z,1.243,.011)*g(ad,27,15)  # real eye socket
        y+=.027*g(z,1.219,.039)*g(ad,0,10)   # nose bridge
        y+=.030*g(z,1.204,.014)*g(ad,0,13)   # blunt shaped tip
        y+=.011*g(z,1.204,.013)*g(ad,17,7)   # alar wings
        y-=.007*g(z,1.192,.005)*g(ad,14,5)   # nostril recess
        y+=.015*g(z,1.214,.025)*g(ad,42,17)  # cheek plane
        y-=.008*g(z,1.178,.019)*g(ad,39,17)  # set jaw above beard
        y+=.010*g(z,1.115,.017)*g(ad,0,28)   # adult chin
        y+=.007*g(z,1.154,.005)*g(ad,0,25)   # tense lower lip
        y-=.004*g(z,1.278,.017)*g(ad,5,2.4)  # pair of glabellar creases
    return V(x,y,z)


def skull():
    rings=[[head_point(i/96*TAU,z) for i in range(96)]
           for z in np.linspace(HEAD[0][0],HEAD[-1][0],110)]
    return geo.loft("diver.adult-face-planes",rings,SKIN,start="pole",end="pole")


def face_controls(rig):
    controls={}
    for s,side in ((-1,"L"),(1,"R")):
        centre=head_point(math.radians(s*27),1.242)+V(0,.004,0)
        eye=geo.ball("diver.eye-"+side,1,centre,WHITE,
                     scale=(.024,.007,.0085),seg=40,rings=20)
        pupil=geo.ball("diver.pupil-"+side,1,centre+V(-s*.002,.007,-.0005),IRIS,
                       scale=(.007,.002,.0068),seg=28,rings=14)
        # Inner ends down, outer ends up: a determined frown, not V1's
        # worried raised inner brows. Enlarge these features for the game.
        path=[head_point(math.radians(s*a),1.255+.019*(a-10)/36)+V(0,.005,0)
              for a in np.linspace(10,46,28)]
        brow=geo.tube("diver.brow-"+side,path,
                      [(.0072,.0060)]*len(path),HAIR,n=16)
        controls["eye"+side]=eye;controls["pupil"+side]=pupil
        controls["brow"+side]=brow
        for upper in (False,True):
            path=[centre+V(t*.024,.004,
                          (.002+(1-t*t)*.003) if upper else -.003-(1-t*t)*.0025)
                  for t in np.linspace(-1,1,24)]
            attach(geo.tube(f"diver.eyelid-{side}-{upper}",path,
                             [.0023]*len(path),SKIN,n=10),rig,"head")
        nostril=head_point(math.radians(s*14),1.193)+V(0,.001,0)
        attach(geo.ball(f"diver.nostril-{s}",1,nostril,MOUTH,
                        scale=(.0038,.0017,.0016),seg=20,rings=12),rig,"head")
    # A compressed closed grimace: the previous continuous ivory strip
    # read as a mouth guard. The jaw stays set under the moustache.
    path=[head_point(math.radians(a),1.163-.004*(abs(a)/27)**1.3)+V(0,.020,0)
          for a in np.linspace(-29,29,35)]
    controls["mouth"]=geo.tube("diver.mouth",path,
                               [(.0026,.0034)]*len(path),MOUTH,n=16)
    for upper in (True,False):
        path=[head_point(math.radians(a),1.163-.004*(abs(a)/27)**1.3
                         +(.0040 if upper else -.0047))+V(0,.019,0)
              for a in np.linspace(-27,27,35)]
        radii=[(.0025,.0030*(.55+.45*math.sin(j/(len(path)-1)*math.pi)))
               for j in range(len(path))]
        attach(geo.tube("diver.compressed-lip-"+str(upper),path,radii,SKIN,n=12),rig,"head")
    for name in ("eyeL","eyeR","browL","browR","mouth","pupilL","pupilR"):
        obj=controls[name];kit.apply(obj);kit.apply_transform(obj)
        pts=[v.co.copy() for v in obj.data.vertices]
        lo=V(*(min(p[k] for p in pts) for k in range(3)))
        hi=V(*(max(p[k] for p in pts) for k in range(3)))
        centre=(lo+hi)/2;size=hi-lo
        normal=V(centre.x*3,1,0).normalized()
        axes=Matrix((normal.cross(V(0,0,1)).normalized(),normal,V(0,0,1))).transposed()
        frame=Matrix.Translation(centre)@axes.to_4x4()
        obj.data.transform(frame.inverted());obj.matrix_world=frame
        obj.name="diver"+name
        if name.startswith("pupil"):
            obj.parent=controls["eye"+name[-1]]
        else:
            obj.parent=rig;obj.parent_type="BONE";obj.parent_bone="diver.head"
        obj.matrix_world=frame
        obj["faceWidth"]=max(.003,size.x);obj["faceHeight"]=max(.002,size.z)
    rig["faceContract"]="centred eyes with child pupils, brows and mouth"


def beard(rig):
    # A connected beard mass with thirteen tapered locks and secondary
    # incisions. Leave the mouth clear instead of hiding it behind a bib.
    def surface(u,v):
        ad=geo.lerp(-71,71,u)
        low=1.077+.065*(abs(ad)/71)**1.7
        high=1.149+.062*(abs(ad)/71)**1.1
        z=geo.lerp(low,high,v)
        at=head_point(math.radians(ad),max(HEAD[0][0],z))
        normal=V(math.sin(math.radians(ad)),math.cos(math.radians(ad)),0)
        flow=ad+.065*ad*math.sin(math.pi*v)
        lock=(.5+.5*math.cos(math.radians(flow)*13))**2.1
        depth=.010+(.012+.014*lock)*math.sin(math.pi*v)**.55
        depth+=.0014*math.cos(math.radians(flow)*48+v*2.5)*math.sin(math.pi*v)
        return at+normal*depth
    obj=geo.sheet("diver.beard-sculpt",surface,np.linspace(0,1,112),
                   np.linspace(0,1,64),HAIR,rim=.003,back=True,inside=HC)
    attach(obj,rig,"beard")
    for s in (-1,1):
        controls=[head_point(math.radians(s*a),1.184-.016*(a/33)**1.2)+V(0,.014,0)
                  for a in np.linspace(3,34,32)]
        radii=[(.010*(1-.43*j/(len(controls)-1)),.008) for j in range(len(controls))]
        attach(geo.tube("diver.moustache-"+str(s),controls,radii,HAIR,n=18),rig,"head")


def helmet(rig):
    n,m=96,58
    th0=math.radians(53)
    def point(th,ph,r):
        return HC+V(math.sin(th)*math.cos(ph)*r,math.cos(th)*r,
                    math.sin(th)*math.sin(ph)*r)
    for label,r,mat,inside in (("helmet-shell",HELMET_RADIUS,BRASS,False),
                               ("helmet-lining",HELMET_RADIUS-.007,LINING,True)):
        rings=[[point(th,ph,r) for ph in np.linspace(0,TAU,n,endpoint=False)]
               for th in np.linspace(th0,math.pi-.003,m)]
        obj=geo.loft("diver."+label,rings,mat,end=point(math.pi,0,r))
        if inside:
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
        attach(obj,rig,"head")
    port=[point(th0,ph,HELMET_RADIUS+.001) for ph in np.linspace(0,TAU,97)]
    attach(closed_tube("diver.front-port-frame",port,[.013]*len(port),EDGE,n=16,
                       up=(0,1,0)),rig,"head")
    outer=[point(th0+.067,ph,HELMET_RADIUS+.004) for ph in np.linspace(0,TAU,97)]
    attach(closed_tube("diver.port-machined-rim",outer,[.0042]*len(outer),PATINA,n=10,
                       up=(0,1,0)),rig,"head")
    # Optically clear glass needs only its thin edge reflections at this
    # scale. Arena replaces GLB materials by families (no transmission),
    # so a filled pane would turn opaque. These two curved edge glints
    # preserve the unobscured face in both Blender and the real renderer.
    glint="lacquer:"+kit.tint("diver-clear-window-edge","#abc9ce")
    for i,(start,end) in enumerate(((math.radians(50),math.radians(127)),
                                   (math.radians(226),math.radians(266)))):
        path=[point(th0-.046,ph,HELMET_RADIUS+.003) for ph in np.linspace(start,end,40)]
        radii=[.0008+.0009*math.sin(j/(len(path)-1)*math.pi) for j in range(len(path))]
        attach(geo.tube("diver.window-glint-"+str(i),path,radii,glint,n=8,up=(0,1,0)),rig,"head")
    for k in range(12):
        at=point(th0+.095,(k+.5)/12*TAU,HELMET_RADIUS+.010)
        attach(geo.ball(f"diver.port-bolt-{k}",.0085,at,EDGE,
                        scale=(1,.6,1),seg=12,rings=8),rig,"head")
    for s in (-1,1):
        axis=V(s,.10,.07).normalized();centre=HC+axis*(HELMET_RADIUS-.004)
        frame=geo.look(axis,V(0,0,1),centre)
        polygon=[(.043*math.cos(a),.043*math.sin(a)) for a in np.linspace(0,TAU,40,endpoint=False)]
        attach(geo.slab(f"diver.side-port-glass-{s}",polygon,.010,GLASS,matrix=frame),rig,"head")
        circular=[centre+frame.to_3x3()@V(.047*math.cos(a),.047*math.sin(a),.013)
                  for a in np.linspace(0,TAU,49)]
        attach(closed_tube(f"diver.side-port-rim-{s}",circular,[.007]*len(circular),EDGE,
                           n=12,up=axis),rig,"head")
        for offset in (-.018,0,.018):
            extent=math.sqrt(.039**2-offset**2)
            path=[centre+frame.to_3x3()@V(offset,-extent,.021),
                  centre+frame.to_3x3()@V(offset,extent,.021)]
            attach(geo.tube(f"diver.side-port-grille-{s}-{offset}",path,[.0035]*2,BRASS,n=10),rig,"head")
    collar=[V(.134*math.sin(a),-.005+.119*math.cos(a),1.078)
            for a in np.linspace(0,TAU,97)]
    attach(closed_tube("diver.helmet-threaded-collar",collar,[.011]*len(collar),EDGE,n=16),rig,"chest")
    attach(band("crown-valve",HC+V(0,-.030,.169),HC+V(0,-.030,.182),(.029,.029),EDGE),rig,"head")


def equipment(rig,canvas):
    # Shaped brass corselet follows the chest and slopes over the trapezius.
    rows=[]
    for z in np.linspace(.889,1.078,46):
        rows.append([body_point(a,min(1.066,float(z)),.008)+V(0,0,max(0,float(z)-1.066))
                     for a in np.linspace(0,TAU,96,endpoint=False)])
    attach(geo.loft("diver.bolted-corselet",rows,BRASS),rig,"chest")
    for z in (.889,1.071):
        path=[body_point(a,z,.012) for a in np.linspace(0,TAU,97)]
        attach(closed_tube("diver.corselet-rolled-rim",path,[.006]*len(path),EDGE,n=12),rig,"chest")
    for k in range(16):
        a=(k+.5)/16*TAU
        at=body_point(a,.904,.023)
        attach(geo.ball(f"diver.corselet-stud-{k}",.0074,at,EDGE,seg=12,rings=8),rig,"chest")
    for s,side in ((-1,"L"),(1,"R")):
        # Convex plate follows the deltoid and keeps a rolled edge.
        centre=SHOULDER[s]+V(s*.006,0,-.012)
        def plate(u,v):
            a=geo.lerp(-1.12,1.12,u);b=geo.lerp(-1.04,1.04,v)
            return centre+V(s*.089*math.cos(a)*math.cos(b),
                             .086*math.sin(a),.083*math.sin(b))
        obj=geo.sheet("diver.deltoid-plate-"+side,plate,np.linspace(0,1,42),
                       np.linspace(0,1,36),BRASS,rim=.005,back=True,inside=centre)
        attach(obj,rig,"sleeve"+side)
        for u in (.12,.88):
            for v in (.18,.80):
                attach(geo.ball(f"diver.shoulder-rivet-{side}-{u}-{v}",.006,
                                plate(u,v)+V(s*.007,0,0),EDGE,seg=12,rings=8),rig,"sleeve"+side)
        a,e,w=SHOULDER[s],ELBOW[s],WRIST[s]
        axis=(w-e).normalized()
        attach(band("rubber-gauntlet-"+side,w-axis*.044,w+axis*.008,(.047,.044),RUBBER),rig,"fore"+side)
        attach(band("brass-cuff-rim-"+side,w-axis*.041,w-axis*.028,(.050,.047),BRASS),rig,"fore"+side)
        seam=[geo.lerp(a,e,t)+V(s*(.086-.027*t),-.005,0) for t in np.linspace(.27,.85,28)]
        obj=geo.tube("diver.sleeve-seam-"+side,seam,[.0014]*len(seam),PATCH,n=8)
        follow_canvas(obj,rig,canvas)
    belt=[[body_point(a,z,.009) for a in np.linspace(0,TAU,96,endpoint=False)]
          for z in (.599,.605,.653,.659)]
    attach(geo.loft("diver.leather-weight-belt",belt,LEATHER),rig,"torso")
    # Lead ingots are discrete flat blocks, not a melted solid belt.
    for i in range(10):
        a=(i+.5)/10*TAU;at=body_point(a,.635,.025)
        frame=Matrix.Rotation(-a,4,"Z");frame.translation=at
        attach(geo.slab(f"diver.lead-ingot-{i}",[(-.030,-.033),(.030,-.033),(.030,.033),(-.030,.033)],
                        .025,LEAD,matrix=geo.look(V(math.sin(a),math.cos(a),0),V(0,0,1),at),bevel=.003),rig,"torso")
    buckle=body_point(0,.631,.057)
    outline=[(-.029,-.025),(.029,-.025),(.029,.025),(-.029,.025),(-.029,-.025)]
    frame=geo.look(V(0,1,0),V(0,0,1),buckle)
    path=[frame@V(x,z,0) for x,z in outline]
    attach(closed_tube("diver.belt-buckle-frame",path,[.005]*len(path),EDGE,n=12,
                       up=(0,1,0)),rig,"torso")
    for s in (-1,1):
        # Two leather suspenders are weighted with the underlying sewn shell.
        for front in (-1,1):
            rows=[]
            for z in np.linspace(.652,1.027,60):
                a=s*.50 if front>0 else math.pi-s*.50
                rows.append([body_point(a+da,z,.012) for da in (-.042,.042)])
            obj=geo.loft(f"diver.harness-{s}-{front}",rows,LEATHER,closed=False)
            p=np.array([v.co[:] for v in obj.data.vertices]);ch=ss(.73,.93,p[:,2])
            add_weights(obj,rig,{"torso":1-ch,"chest":ch})
    # Hose keeps its helmet union and bends smoothly through a two-link skin.
    controls=[V(0,-.178,1.270),V(.047,-.223,1.304),V(.099,-.247,1.242),
              V(.108,-.240,1.120),V(.078,-.203,.995),V(.076,-.157,.908)]
    path=kit.smooth_path(controls,samples=9)
    obj=geo.tube("diver.air-hose",path,[.017]*len(path),RUBBER,n=24)
    weight_hose(obj,rig)
    for j in range(3,len(path)-2,4):
        axis=Vector(path[j+1])-Vector(path[j-1]);axis.normalize()
        obj=band("hose-corrugation-"+str(j),Vector(path[j])-axis*.0015,
                 Vector(path[j])+axis*.0015,(.0185,.0185),RUBBER,n=20)
        # Every rib uses the same continuous field as the rubber tube.
        # A rigid lower rib on cape2 would leave the chest-anchored hose
        # when the helmet glances sideways.
        weight_hose(obj,rig)
    for at in (controls[0],controls[-1]):
        attach(geo.ball("diver.air-union",1,at,EDGE,scale=(.026,.016,.026),seg=32,rings=16),rig,
               "head" if at.z>1.1 else "chest")


def weight_hose(obj,rig):
    p=np.array([v.co[:] for v in obj.data.vertices]);z=p[:,2]
    lower=1-ss(1.087,1.219,z);anchor=1-ss(.944,1.031,z)
    crown=ss(1.273,1.306,z)
    add_weights(obj,rig,{"head":crown*(1-anchor),
                        "cape":(1-lower)*(1-crown)*(1-anchor),
                        "cape2":lower*(1-crown)*(1-anchor),"chest":anchor})


def boots(rig):
    # The full last is retained in one modest loft. Separate lead heel and
    # front plates add mass without turning the foot into a rounded ball.
    sections=[(.004,.093,.157,.075),(.026,.096,.158,.077),
              (.045,.091,.153,.074),(.066,.087,.148,.070),
              (.089,.080,.136,.066),(.112,.070,.112,.062),
              (.138,.064,.078,.059),(.166,.062,.063,.057),
              (.200,.062,.062,.057),(.229,.064,.063,.057)]
    for s,side in ((-1,"L"),(1,"R")):
        centre=ANKLE[s]
        def front(z):
            return centre.y+profile(sections,z)[1]
        outlines=[[V(centre.x+rx*geo.spow(math.sin(a),.65),
                       centre.y+(f if math.cos(a)>0 else back)*geo.spow(math.cos(a),.65),z)
                   for a in np.linspace(0,TAU,56,endpoint=False)]
                  for z,rx,f,back in sections]
        obj=geo.loft("diver.lead-boot-last-"+side,outlines,LEATHER,start="flat",end="flat",
                     bands={0:LEAD,1:LEAD})
        attach(obj,rig,"foot"+side)
        # A shaped tongue and laces follow the sloping instep. V1's fixed
        # depth put the low rows inside the boot and made a small ladder.
        rows=[[V(centre.x+dx,front(z)+.002,z) for dx in (-.029,.029)]
              for z in np.linspace(.091,.219,24)]
        attach(geo.loft("diver.boot-tongue-"+side,rows,LINING,closed=False),rig,"foot"+side)
        for j,z in enumerate(np.linspace(.095,.214,7)):
            for sx in (-1,1):
                at=V(centre.x+sx*.037,front(z)+.002,z)
                loop=[at+V(.0046*math.cos(a),.001,.0046*math.sin(a))
                      for a in np.linspace(0,TAU,17)]
                attach(closed_tube(f"diver.boot-eyelet-{side}-{j}-{sx}",loop,[.0015]*len(loop),EDGE,
                                   n=6,up=(0,1,0)),rig,"foot"+side)
            if j<6:
                for sx in (-1,1):
                    next_z=z+.0198
                    a=V(centre.x+sx*.035,front(z)+.008,z)
                    b=V(centre.x-sx*.035,front(next_z)+.008,next_z)
                    mid=(a+b)/2+V(0,.004,.001*sx)
                    attach(geo.tube(f"diver.boot-lace-{side}-{j}-{sx}",[a,mid,b],
                                    [.0024]*3,LEATHER,n=8),rig,"foot"+side)
        # Toe and heel blocks have visible thickness and strap fasteners.
        for label,at,normal,width,height,depth in (
            ("front",V(centre.x,centre.y+.153,.058),V(0,1,.12),.147,.049,.014),
            ("back",V(centre.x,centre.y-.077,.070),V(0,-1,.06),.136,.068,.017)):
            frame=geo.look(normal,V(0,0,1),at)
            outline=[(-width/2,-height/2),(width/2,-height/2),
                     (width/2,height/2),(-width/2,height/2)]
            attach(geo.slab(f"diver.boot-lead-{label}-{side}",outline,depth,LEAD,
                            matrix=frame,bevel=.003),rig,"foot"+side)
            for sx in (-1,1):
                pin=frame@V(sx*width*.34,height*.16,depth+.001)
                attach(geo.ball(f"diver.boot-plate-rivet-{label}-{side}-{sx}",.004,
                                pin,BRASS,seg=12,rings=8),rig,"foot"+side)
        for sx in (-1,1):
            at=V(centre.x+sx*.063,centre.y,.203)
            attach(geo.slab(f"diver.boot-ankle-weight-{side}-{sx}",
                            [(-.030,-.024),(.030,-.024),(.030,.024),(-.030,.024)],
                            .009,LEAD,matrix=geo.look(V(sx,0,0),V(0,0,1),at),bevel=.002),rig,"foot"+side)
        ring=[V(centre.x+.065*math.cos(a),centre.y+.064*math.sin(a),.224)
              for a in np.linspace(0,TAU,49)]
        attach(closed_tube("diver.boot-top-rim-"+side,ring,[.004]*len(ring),LEATHER,n=10),rig,"foot"+side)


def trouser_hems(rig,canvas):
    # The clean turned canvas edge is separate from the volume union.
    # Its lower wall meets the boot shaft, while the closed source trouser
    # end tucks inside. The skin field carries it with the real calf/ankle.
    for s,side in ((-1,"L"),(1,"R")):
        rows=[]
        for z in np.linspace(.231,.268,18):
            t=(KNEE[s].z-float(z))/(KNEE[s].z-ANKLE[s].z)
            at=geo.lerp(KNEE[s],ANKLE[s],t);at.z=float(z)
            rx,ry=profile([(.231,.067,.066),(.238,.074,.071),
                           (.248,.075,.071),(.268,.078,.076)],float(z))
            rows.append([at+V(rx*math.cos(a),ry*math.sin(a),0)
                         for a in np.linspace(0,TAU,64,endpoint=False)])
        obj=geo.loft("diver.turned-trouser-hem-"+side,rows,CLOTH,start="flat",end="flat")
        follow_canvas(obj,rig,canvas)
        path=rows[3]
        obj=closed_tube("diver.hem-rolled-edge-"+side,path,[.003]*len(path),CLOTH,n=12)
        follow_canvas(obj,rig,canvas)


def wrench_point(grip,x,along,depth):
    # The grasping core stays untwisted inside the same closed glove.
    # Above the fingers the forging turns its broad face toward the high
    # game camera; V2 was almost exactly edge-on (normal dot view .019).
    roll=WRENCH_ROLL*float(ss(.095,.22,along))
    across=V(math.cos(roll),ROD.z*math.sin(roll),-ROD.y*math.sin(roll))
    normal=across.cross(ROD).normalized()
    return grip+across*x+ROD*along+normal*depth


def wrench(rig):
    """Large forged adjustable brass wrench: fixed jaw, slide and worm screw.

    Keep V3's enlarged head, but carry it below the helmet. The glove holds
    the balance point: extend the lower shaft and lower the intact jaws
    by 32 cm, without changing the hand, arm or weapon rest frame.
    """
    grip=HAND[1]+V(-.054,0,-.006)
    axis=ROD
    # Numeric grip envelope retained for the dependency-free finger probe.
    handle=[(-.019,-.4336),(.019,-.4336),(.020,.080),(.036,.140),
            (.049,.170),(.059,.250),(.055,.2918),(-.055,.2918),
            (-.059,.250),(-.049,.170),(-.036,.140),(-.020,.080)]
    sections=[(-.4336,.019,.017),(0,.0195,.017),(.080,.020,.017),
              (.140,.036,.021),(.170,.049,.0238),(.250,.059,.0238),
              (.2918,.055,.0238)]
    rows=[]
    for along in np.linspace(-.4336,.2918,112):
        width,depth=profile(sections,float(along))
        rows.append([wrench_point(grip,width*geo.spow(math.cos(a),.40),float(along),
                                 -depth*geo.spow(math.sin(a),.40))
                     for a in np.linspace(0,TAU,24,endpoint=False)])
    attach(geo.loft("diver.adjustable-wrench-handle",rows,BRASS,start="flat",end="flat"),rig,"weapon")

    def slab(name,outline,depth,material,bevel,offset=0):
        obj=geo.slab("diver."+name,outline,depth,material,bevel=bevel)
        for vertex in obj.data.vertices:
            x,along,z=vertex.co
            vertex.co=wrench_point(grip,x,along,z-depth/2+offset)
        obj.data.update()
        return attach(obj,rig,"weapon")

    fixed=[(-.0476,.2330),(.0770,.2330),(.1106,.2736),(.1106,.4234),
           (.0812,.4738),(.0252,.4836),(.0252,.4248),(.0672,.4164),
           (.0630,.3114),(-.0476,.3114)]
    sliding=[(-.1022,.3142),(-.0518,.3142),(-.0518,.3772),
             (-.0252,.4010),(-.0252,.4472),(-.1064,.4304)]
    slab("wrench-fixed-jaw",fixed,.0644,BRASS,.0056)
    slab("wrench-sliding-jaw",sliding,.0588,EDGE,.0042)
    # Recessed shank panel leaves a thick forged edge on either side.
    rows=[]
    for along in np.linspace(.112,.203,30):
        width,depth=profile(sections,float(along))
        rows.append([wrench_point(grip,x*width*.56,float(along),depth+.0004)
                     for x in (-1,1)])
    attach(geo.loft("diver.wrench-shank-inset",rows,PATINA,closed=False),rig,"weapon")
    # Worm shaft: larger than V1, with ordered diagonal knurl lines and
    # contrasting recessed grooves so it survives the actual game camera.
    across=V(math.cos(WRENCH_ROLL),ROD.z*math.sin(WRENCH_ROLL),-ROD.y*math.sin(WRENCH_ROLL))
    normal=across.cross(axis).normalized()
    roller=grip+axis*.3016-across*.021
    attach(geo.tube("diver.wrench-adjuster",[roller-across*.0448,roller+across*.0448],
                    [.028]*2,BRASS,n=28,up=axis,caps=("flat","flat")),rig,"weapon")
    for k in range(9):
        at=roller+across*geo.lerp(-.0392,.0392,k/8)
        loop=[at+axis*(.02856*math.cos(a))+normal*(.02856*math.sin(a))
              for a in np.linspace(0,TAU,25)]
        attach(closed_tube(f"diver.wrench-roller-thread-{k}",loop,[.00154]*len(loop),PATINA,
                           n=6,up=across),rig,"weapon")
    for k in range(12):
        a=k/12*TAU
        line=[roller+across*dx+axis*(.0294*math.cos(a+dx*5))+
              normal*(.0294*math.sin(a+dx*5)) for dx in np.linspace(-.0406,.0406,8)]
        attach(geo.tube(f"diver.wrench-adjuster-knurl-{k}",line,[.00168]*len(line),EDGE,n=6),rig,"weapon")
    for x in (-.0266,.0280):
        for k in range(5):
            at=grip+axis*(.4136+k*.0098)+across*x
            attach(geo.tube(f"diver.wrench-jaw-tooth-{x}-{k}",
                            [at-normal*.0308,at+normal*.0308],[.0028]*2,PATINA,n=8),rig,"weapon")


def surface_finish(root):
    # Export families supply runtime fine relief; master uses restrained
    # scale-aware procedural roughness to inspect canvas/rubber/metal contrast.
    for name in (SKIN,HAIR,BRASS,EDGE,PATINA,LEAD,RUBBER,LEATHER,CLOTH,PATCH):
        mat=kit.material(name);nodes=mat.node_tree.nodes;links=mat.node_tree.links
        bsdf=nodes.get("Principled BSDF")
        family=name.split(":")[0]
        bsdf.inputs["Specular IOR Level"].default_value=.25 if family in ("skin","weave") else .42
        if family=="skin":
            bsdf.inputs["Subsurface Weight"].default_value=.03
        if family in ("weave","hide","rubber"):
            noise=nodes.new("ShaderNodeTexNoise");noise.inputs["Scale"].default_value=320 if family=="weave" else 180
            bump=nodes.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.16
            bump.inputs["Distance"].default_value=.00038
            links.new(noise.outputs["Fac"],bump.inputs["Height"])
            links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
    meshes=[o for o in kit.descendants(root) if o.type=="MESH"]
    kit.fill_ao(meshes,1)
    root["authorBrief"]="work/arena/2026-10-08-roster/diver/brief-v4.md"
    root["neutralStance"]="hanging arms, inward palms, fifteen degree elbow flexion"


def build_master():
    root=kit.empty("diver")
    rig=make_rig(root)
    suit,fields=fuse_canvas([trunk(),canvas_arm(-1),canvas_arm(1),canvas_leg(-1),canvas_leg(1)])
    weight_canvas(suit,rig,fields)
    attach(skull(),rig,"head")
    face_controls(rig);beard(rig)
    for s,side in ((-1,"L"),(1,"R")):
        pieces,_=gloves(s)
        for obj in pieces:
            attach(obj,rig,"hand"+side)
    helmet(rig);equipment(rig,suit);boots(rig);trouser_hems(rig,suit);wrench(rig)
    surface_finish(root)
    root["unoptimized"]=True
    root["sourceSculptSha256"]=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    kit.refresh()
    return root
