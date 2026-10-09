"""Private Explorer source: tailored gabardine, polar fur and engineered rifle.

Editable master, never the ordinary collector. +Y forward, Z up. Relaxed
common-axis arm bones; only the sewn shoulder joins the parka trunk.
No Diver art imports and no shared helper edits.
"""
import json
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
R = "explorer"
BASE = Path(__file__).resolve().parents[3] / "work/arena/2026-10-08-roster/explorer"
kit.tint("team:explorer", "#2f63e0")
kit.tint("team2:explorer", "#203d94")
CLOTH, TROUSER = "weave:team:explorer", "weave:team2:explorer"
SKIN = "skin:" + kit.tint("explorer-wind-skin", "#d6a083")
HAIR = "hair:" + kit.tint("explorer-gold-hair", "#b8985d")
FUR = "felt:" + kit.tint("explorer-warm-fur", "#e8ddc6")
FUR_SHADE = "felt:" + kit.tint("explorer-fur-under", "#b9aa90")
LEATHER = "hide:" + kit.tint("explorer-chestnut-mitt", "#593b2e")
SEAM = "hide:" + kit.tint("explorer-stitch-leather", "#a77e56")
WOOD = "beech:" + kit.tint("explorer-honey-stock", "#8c512c")
WOOD_EDGE = "beech:" + kit.tint("explorer-worn-stock", "#bc8550")
BRASS = "gilt:" + kit.tint("explorer-aged-brass", "#ba913f")
BRASS_EDGE = "gilt:" + kit.tint("explorer-brass-edge", "#dfb662")
STEEL = "tin:" + kit.tint("explorer-blued-steel", "#3b4a58")
ICE = "glow:" + kit.tint("explorer-ice-coil", "#85d9f5")
LENS = "lacquer:" + kit.tint("explorer-goggle-blue", "#244969")
IVORY = "resin:" + kit.tint("explorer-eye-white", "#dddcd0")
IRIS = "resin:" + kit.tint("explorer-eye-blue", "#3f6a79")
DARK = "resin:" + kit.tint("explorer-set-mouth", "#513328")
LIP = "skin:" + kit.tint("explorer-wind-lips", "#a65d5b")
SOLE = "rubber:" + kit.tint("explorer-mukluk-sole", "#40342b")

WAIST = V(0, 0, .650)
CHEST = V(0, -.006, .831)
NECK = V(0, -.002, 1.008)
HC = V(0, -.006, 1.160)
SHOULDER = {s: V(s*.181, -.003, .957) for s in (-1, 1)}
ELBOW = {s: V(s*.227, .011, .735) for s in (-1, 1)}
WRIST = {s: V(s*.257, .061 if s < 0 else .123, .526) for s in (-1, 1)}
HIP = {s: V(s*.090, -.002, .605) for s in (-1, 1)}
KNEE = {s: V(s*.104, .019, .351) for s in (-1, 1)}
ANKLE = {s: V(s*.112, .009, .098) for s in (-1, 1)}
D = V(0, .894427191, .4472135955)
UP = V(0, -D.z, D.y)
GRIP = WRIST[1] - UP*.047 + V(-.055, 0, 0)
# The loose mitten's fingers follow the forearm; the loaded mitten curls
# under the stock, approximately perpendicular to the rifle axis.
FINGER_L = (WRIST[-1]-ELBOW[-1]).normalized()
FINGER_R = -UP
BODY = [(.405,.162,.146,.142),(.440,.170,.153,.147),
        (.500,.165,.149,.142),(.570,.155,.143,.133),
        (.628,.144,.131,.122),(.670,.145,.132,.123),
        (.745,.155,.137,.125),(.818,.171,.147,.135),
        (.879,.177,.149,.138),(.920,.179,.143,.134),
        (.958,.165,.123,.119),(.988,.116,.087,.092),
        (1.016,.058,.056,.059)]
HEAD = [(1.015,.031,.046,.052),(1.037,.048,.063,.063),
        (1.065,.062,.071,.071),(1.098,.075,.076,.078),
        (1.134,.094,.078,.084),(1.165,.103,.081,.093),
        (1.195,.101,.083,.094),(1.225,.102,.082,.095),
        (1.252,.096,.074,.083),(1.273,.075,.057,.064),
        (1.287,.019,.018,.023)]


def ss(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def g(x, centre, width):
    return math.exp(-((x-centre)/width)**2)


def profile(rows, z):
    if z <= rows[0][0]: return rows[0][1:]
    if z >= rows[-1][0]: return rows[-1][1:]
    for a, b in zip(rows, rows[1:]):
        if z <= b[0]:
            t = float(ss(a[0], b[0], z))
            return tuple(geo.lerp(a[j], b[j], t) for j in range(1, len(a)))


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def weld_contour(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    return obj


def closed_tube(name, path, radii, material, n=12, normal=(0, 1, 0)):
    """Cyclic frames use the loop's plane normal, and the seam is welded."""
    path = [Vector(p) for p in path]
    radii = list(radii)
    if (path[0]-path[-1]).length < 1e-7:
        path.pop(); radii.pop()
    rings = []
    for j, point in enumerate(path):
        u, v = geo.frame_at(path[(j+1)%len(path)]-path[j-1], normal)
        r = radii[j]
        rx, ry = r if isinstance(r, (tuple, list)) else (r, r)
        rings.append([point+u*(rx*math.cos(a))+v*(ry*math.sin(a))
                      for a in np.linspace(0, TAU, n, endpoint=False)])
    return weld_contour(geo.loft(name, rings+[rings[0]], material))


def body_point(a, z, extra=0):
    width, front, back = profile(BODY, z)
    sn, cs = math.sin(a), math.cos(a)
    ad = abs((math.degrees(a)+180)%360-180)
    power = 2.16
    x = geo.spow(sn, 2/power)*(width+extra)
    y = geo.spow(cs, 2/power)*((front if cs >= 0 else back)+extra)
    # Broad diagonal tension folds, hip darts and a dipped sternum seam.
    relief = .006*g(z,.861,.052)*g(ad,35,25)
    relief -= .008*g(z,.964,.024)*g(ad,0,12)
    for height, tilt, amount in ((.717,.023,.010),(.679,-.019,.008),(.521,.026,.009)):
        fold = height+tilt*math.sin(a*2+.55)
        relief += (amount*g(z,fold,.020)-amount*.62*g(z,fold-.020,.008))*g(ad,39,62)
    relief += .010*g(z,.454,.044)*math.sin(a*5+.25)
    relief -= .009*g(z,.595,.063)*g(ad,92,18)
    return V(x+sn*relief, y+cs*relief, z)


def parka_trunk():
    rings = [[body_point(a,z) for a in np.linspace(0,TAU,80,endpoint=False)]
             for z in np.linspace(BODY[0][0],BODY[-1][0],92)]
    return geo.loft("explorer.tailored-parka",rings,CLOTH,start="flat",end="pole")


def garment_wall(y, z, side=1):
    """Actual folded envelope, not the unrelieved section radius."""
    front = y >= 0
    low,high = (0,math.pi/2) if front else (math.pi/2,math.pi)
    edge = body_point(side*(low if front else high),z)
    if abs(y) > abs(edge.y): return 0
    for _ in range(26):
        mid = (low+high)/2
        if body_point(side*mid,z).y > y: low = mid
        else: high = mid
    return abs(body_point(side*(low+high)/2,z).x)


def sleeve(s):
    a, e, w = SHOULDER[s], ELBOW[s], WRIST[s]
    controls = [a-(e-a).normalized()*.045, a, geo.lerp(a,e,.65), e,
                geo.lerp(e,w,.28), w-(w-e).normalized()*.015]
    path = [Vector(p) for p in kit.smooth_path(controls,samples=13)]
    radii = []
    for j in range(len(path)):
        q = j/(len(path)-1)
        radius, depth = profile([(0,.028,.028),(.13,.068,.069),
            (.30,.065,.067),(.47,.055,.058),(.66,.054,.056),
            (.82,.046,.048),(1,.039,.041)],q)
        radii.append((radius,depth))
    rings = geo.rings_along(path,radii,n=56,up=(0,1,0))
    for j, row in enumerate(rings):
        q = j/(len(rings)-1)
        for i, point in enumerate(row):
            angle = i/56*TAU
            inner = .35+.65*max(0,math.cos(angle))**2
            relief = 0
            for fold, tilt, amount in ((.44,.035,.010),(.56,-.039,.014),(.70,.034,.009)):
                centre = fold+tilt*math.sin(angle*2+s*.4)
                relief += (amount*g(q,centre,.038)-amount*.65*g(q,centre+.037,.014))*inner
            point += (point-path[j]).normalized()*relief
            # No accidental arm/body web below the sewn shoulder. This is
            # authored space at native scale, before remesh, not a scale fix.
            wall = garment_wall(point.y,point.z,s)
            share = 1-float(ss(.900,.947,point.z))
            floor = wall+.014
            inward = s*point.x
            point.x = s*geo.lerp(inward,max(inward,floor),share)
    return geo.loft(f"explorer.sewn-sleeve-{s}",rings,CLOTH,start="pole",end="flat")


def fuse_parka(parts):
    for obj in parts: kit.apply(obj); kit.apply_transform(obj)
    fields = [BVHTree.FromPolygons([v.co[:] for v in obj.data.vertices],
                  [list(p.vertices) for p in obj.data.polygons]) for obj in parts]
    select(parts[0])
    for obj in parts: obj.select_set(True)
    bpy.ops.object.join()
    obj = parts[0]; obj.name = "explorer.parka-skin"
    mod = obj.modifiers.new("Sewn shoulder union only", "REMESH")
    mod.mode = "VOXEL"; mod.voxel_size = .0036; mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("Preserve tailored planes", "SMOOTH")
    mod.factor = .30; mod.iterations = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons: face.use_smooth = True
    obj["shoulderUnionOnly"] = True
    return obj, fields


def make_rig(root):
    data = bpy.data.armatures.new("Explorer common-axis anatomical rig")
    rig = bpy.data.objects.new("explorer.skeleton",data)
    bpy.context.collection.objects.link(rig); rig.parent = root
    positions = {"torso":WAIST,"chest":CHEST,"head":NECK,"weapon":GRIP,
                 "hat":HC,"hair":V(0,.086,1.235),
                 "skirtL":V(-.067,0,.648),"skirtR":V(.067,0,.648),
                 "extra":V(-.163,-.008,.665)}
    parents = {"chest":"torso","head":"chest","hat":"head","hair":"head",
               "weapon":"handR","skirtL":"torso","skirtR":"torso","extra":"torso"}
    for s, side in ((-1,"L"),(1,"R")):
        positions.update({"clav"+side:V(s*.052,-.003,.973),
            "arm"+side:SHOULDER[s],"fore"+side:ELBOW[s],"hand"+side:WRIST[s],
            "leg"+side:HIP[s],"knee"+side:KNEE[s],"foot"+side:ANKLE[s]})
        parents.update({"clav"+side:"chest","arm"+side:"clav"+side,
            "fore"+side:"arm"+side,"hand"+side:"fore"+side,
            "knee"+side:"leg"+side,"foot"+side:"knee"+side})
    select(rig); bpy.ops.object.mode_set(mode="EDIT")
    for name, point in positions.items():
        bone = data.edit_bones.new("explorer."+name)
        bone.head = point; bone.tail = point+V(0,0,.06); bone.use_connect = False
    for name, parent in parents.items():
        data.edit_bones["explorer."+name].parent = data.edit_bones["explorer."+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True; data.display_type = "WIRE"
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k:list(v) for k,v in positions.items()})
    return rig


def weights(obj, rig, values):
    geo.uv_box(obj)
    total = np.maximum(1e-8,np.sum(list(values.values()),axis=0))
    for name, raw in values.items():
        quant = np.rint(np.clip(raw/total,0,1)*10000).astype(int)
        indices = np.flatnonzero(quant > 0)
        if not len(indices): continue
        group = obj.vertex_groups.new(name="explorer."+name)
        indices = indices[np.argsort(quant[indices])]
        for batch in np.split(indices,np.flatnonzero(np.diff(quant[indices]))+1):
            if len(batch): group.add(batch.tolist(),float(quant[batch[0]])/10000,"REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Continuous Explorer skin", "ARMATURE")
    mod.object = rig; mod.use_deform_preserve_volume = False
    obj["continuousSkin"] = True


def segment_distance(points, a, b):
    delta = np.array(b-a)
    t = np.clip((points-np.array(a)).dot(delta)/delta.dot(delta),0,1)
    return np.linalg.norm(points-(np.array(a)+t[:,None]*delta),axis=1)


def weight_parka(obj, rig, fields):
    points = np.array([v.co[:] for v in obj.data.vertices]); x,y,z = points.T
    chest = ss(.750,.925,z)
    skirt = 1-ss(.527,.656,z)
    left = 1-ss(-.023,.023,x)
    values = {"torso":(1-chest)*(1-skirt),"chest":chest,
              "skirtL":skirt*left,"skirtR":skirt*(1-left)}
    distance = np.array([[tree.find_nearest(Vector(p))[3] for p in points] for tree in fields])
    for index, (s,side) in enumerate(((-1,"L"),(1,"R"))):
        a,e,w = SHOULDER[s],ELBOW[s],WRIST[s]
        along = (points-np.array(a)).dot(np.array(e-a))/(e-a).length_squared
        share = ss(-.0025,.004,np.min(np.delete(distance,index+1,axis=0),axis=0)-distance[index+1])*ss(-.14,.26,along)
        girdle = share*(1-ss(.10,.38,along))*.34
        fore = ss(-.018,.018,segment_distance(points,a,e)-segment_distance(points,e,w))
        for name in ("torso","chest","skirtL","skirtR"): values[name] *= 1-share
        values["clav"+side] = girdle
        values["arm"+side] = (share-girdle)*(1-fore)
        values["fore"+side] = (share-girdle)*fore
        upper = values["chest"]*ss(.070,.169,s*x)*ss(.917,1.008,z)*.28
        values["clav"+side] += upper; values["chest"] -= upper
    weights(obj,rig,values)
    sub = obj.modifiers.new("Editable gabardine source surface", "SUBSURF")
    sub.levels = sub.render_levels = 1
    select(obj)
    while obj.modifiers[0] != sub:
        bpy.ops.object.modifier_move_up(modifier=sub.name)


def attach(obj, rig, bone):
    kit.apply(obj); kit.apply_transform(obj); geo.uv_box(obj)
    world = obj.matrix_world.copy()
    obj.parent = rig; obj.parent_type = "BONE"; obj.parent_bone = "explorer."+bone
    obj.matrix_world = world
    for face in obj.data.polygons: face.use_smooth = True
    return obj


_PARKA_FIELD = None


def parka_field(parka):
    """One packed projection field shared by every raised seam and hem.

    V1 rebuilt a BVH, Vector list and per-vertex dict for every detail.
    Keep float32 arrays until tailoring ends; no dense voxel or added mesh.
    """
    global _PARKA_FIELD
    key = parka.as_pointer()
    if _PARKA_FIELD is not None and _PARKA_FIELD[0] == key:
        return _PARKA_FIELD[1:]
    data = parka.data; data.calc_loop_triangles()
    points = np.empty((len(data.vertices),3),dtype=np.float32)
    faces = np.empty((len(data.loop_triangles),3),dtype=np.int32)
    data.vertices.foreach_get("co",points.ravel())
    data.loop_triangles.foreach_get("vertices",faces.ravel())
    tree = BVHTree.FromPolygons(points.tolist(),faces.tolist(),all_triangles=True)
    names = {group.index:group.name.removeprefix("explorer.") for group in parka.vertex_groups}
    columns = {index:i for i,index in enumerate(names)}
    original = np.zeros((len(points),len(names)),dtype=np.float32)
    for vertex in data.vertices:
        for item in vertex.groups:
            original[vertex.index,columns[item.group]] = item.weight
    _PARKA_FIELD = (key,tree,points,faces,names,original)
    return _PARKA_FIELD[1:]


def follow_parka(obj, rig, parka):
    """Raised stitching and hem sample the garment's actual skin field."""
    tree,points,faces,names,original = parka_field(parka)
    values = {name:np.zeros(len(obj.data.vertices)) for name in names.values()}
    for i, vert in enumerate(obj.data.vertices):
        point,_,face,_ = tree.find_nearest(vert.co)
        a,b,c = faces[face]
        bary = barycentric_transform(point,Vector(points[a]),Vector(points[b]),Vector(points[c]),
                                     V(1,0,0),V(0,1,0),V(0,0,1))
        blend = sum(max(0,k)*original[corner] for corner,k in zip((a,b,c),bary))
        for name,value in zip(names.values(),blend): values[name][i] = float(value)
    weights(obj,rig,values)


def fur_contour(name, centre, rx, rz, width, depth, locks=32, n=160, ring=24, plane="XZ"):
    """Continuous swept fur; deliberate lock rhythm and combed fine ridges.

    Every secondary tip belongs to a connected base. Its plane normal is
    +Y throughout, so the crown and chin do not flip a sweep frame.
    """
    rows = []
    for theta in np.linspace(0,TAU,n,endpoint=False):
        if plane == "XY":
            point = centre+V(rx*math.cos(theta),rz*math.sin(theta),0)
            radial = V(math.cos(theta),math.sin(theta),0)
            tangent = V(-math.sin(theta),math.cos(theta),0)
            normal = V(0,0,1)
        else:
            point = centre+V(rx*math.cos(theta),0,rz*math.sin(theta))
            radial = V(math.cos(theta),0,math.sin(theta))
            tangent = V(-math.sin(theta),0,math.cos(theta))
            normal = V(0,1,0)
        row = []
        for angle in np.linspace(0,TAU,ring,endpoint=False):
            lock = (.5+.5*math.cos(theta*locks-angle*.7))**3
            fine = .0007*math.cos(theta*locks*3+angle*.8)
            flare = width*(1+.17*lock)+fine
            row.append(point+radial*(flare*math.cos(angle))+
                normal*(depth*(1+.12*lock)*math.sin(angle))+
                tangent*(.003*lock*math.cos(angle)))
        rows.append(row)
    obj = weld_contour(geo.loft(name,rows+[rows[0]],FUR))
    obj["furGrammar"] = "continuous ordered locks, welded contour, no detached balls"
    return obj


def mitten(s, rig):
    side = "R" if s > 0 else "L"
    wrist = WRIST[s]; f = FINGER_R if s > 0 else FINGER_L
    normal = V(-s,0,0)
    normal = (normal-f*normal.dot(f)).normalized()
    across = D if s > 0 else f.cross(normal).normalized()
    controls = [wrist-f*.006,wrist+f*.017,wrist+f*.071,
                wrist+f*.132+normal*.006,wrist+f*.128+normal*.075,
                wrist+f*.105+normal*.112,wrist+f*.077+normal*.114] if s > 0 else [
                    wrist-f*.006,wrist+f*.022,wrist+f*.055,wrist+f*.076+normal*.010]
    path = [Vector(p) for p in kit.smooth_path(controls,samples=10)]
    radii = []
    for j, point in enumerate(path):
        q = j/(len(path)-1)
        width, thickness = profile([(0,.027,.019),(.2,.041,.025),
            (.46,.045,.027),(.74,.043,.027),(1,.033,.021)],q)
        radii.append((width,thickness))
    # True cross-section frames follow the curling finger pad. A fixed
    # dorsal normal makes the underside rings cut straight through wood.
    rows = geo.rings_along(path,radii,n=40,up=across,power=2.7)
    attach(geo.loft("explorer.mitten-folded-pad-"+side,rows,LEATHER,
                   start="pole",end="pole"),rig,"hand"+side)
    thumb_controls = [wrist+across*.030-normal*.004-f*.022,
                      wrist+across*.049+normal*.018-f*.027,
                      wrist+across*.044+normal*.082-f*.018,
                      wrist+across*.030+normal*.112+f*.010] if s > 0 else [
                          wrist+across*.031+f*.014,
                          wrist+across*.052+normal*.003+f*.040,
                          wrist+across*.041+normal*.013+f*.062]
    thumb = [Vector(p) for p in kit.smooth_path(thumb_controls,samples=9)]
    attach(geo.tube("explorer.mitten-thumb-web-"+side,thumb,
        [(.016*(1-.25*j/(len(thumb)-1)),.013) for j in range(len(thumb))],
        LEATHER,n=24,up=across),rig,"hand"+side)
    # Sewn lines stay on the actual curling pad's dorsal rows. Fixed palm
    # offsets would run through the cavity or float clear of the new curve.
    edge = [rows[j][10]+(rows[j][10]-path[j]).normalized()*.0006
            for j in range(4,len(path)-3)]
    attach(geo.tube("explorer.mitten-dorsal-seam-"+side,edge,[.0017]*len(edge),SEAM,n=8),rig,"hand"+side)
    for q in (.34,.51,.69):
        j = int(q*(len(path)-1))
        seam = [rows[j][i]+(rows[j][i]-path[j]).normalized()*.00055
                for i in range(3,18)]
        attach(geo.tube(f"explorer.mitten-pad-dart-{side}-{q}",seam,[.0013]*len(seam),SEAM,n=6),rig,"hand"+side)
    # Fur cuffs follow the forearm, with the leather wrist inside them.
    axis = (wrist-ELBOW[s]).normalized()
    points = [wrist-axis*.052,wrist-axis*.038,wrist-axis*.014,wrist+axis*.002]
    cuff = geo.tube("explorer.fur-cuff-"+side,points,
        [(.047,.045),(.052,.048),(.048,.047),(.043,.043)],FUR,n=64,
        up=(1,0,0),caps=("flat","flat"))
    # Combed tapering rows carved into the closed cuff surface.
    for vert in cuff.data.vertices:
        delta = vert.co-wrist; along = delta.dot(axis)
        radial = delta-axis*along
        if radial.length:
            angle = math.atan2(radial.y,radial.x)
            vert.co += radial.normalized()*(.0032*(.5+.5*math.cos(angle*18+along*24))**3)
    attach(cuff,rig,"fore"+side)


def head_point(a, z):
    width, front, back = profile(HEAD,z)
    sn, cs = math.sin(a),math.cos(a)
    ad = abs((math.degrees(a)+180)%360-180)
    x = geo.spow(sn,.88)*width
    y = .020+geo.spow(cs,.89)*(front if cs >= 0 else back)
    if ad < 90:
        y += .010*g(z,1.208,.013)*g(ad,25,20)
        y -= .012*g(z,1.191,.012)*g(ad,29,15)
        y += .016*g(z,1.170,.039)*g(ad,0,8)
        y += .022*g(z,1.150,.012)*g(ad,0,11)
        y += .010*g(z,1.146,.011)*g(ad,16,6)
        y -= .005*g(z,1.139,.004)*g(ad,13,5)
        y += .020*g(z,1.166,.018)*g(ad,43,15)
        y -= .009*g(z,1.119,.022)*g(ad,47,15)
        y += .008*g(z,1.042,.013)*g(ad,0,24)
        y += .005*g(z,1.099,.004)*g(ad,0,20)
        y -= .003*g(z,1.227,.022)*g(ad,5,2.4)
    return V(x,y,z)


def lip_point(u,v,upper):
    a = u*24
    edge = 1.108-.002*abs(u)**1.7
    taper = max(0,1-u*u)**.70
    rise = (.0032+.0018*g(abs(u),.30,.19))*taper if upper else -.0055*taper
    z = edge+rise*v
    return head_point(math.radians(a),z)+V(0,.0025+.0037*(1-v)+.002*math.sin(math.pi*v)*taper,0)


def adult_face(rig):
    rows = [[head_point(a,z) for a in np.linspace(0,TAU,96,endpoint=False)]
            for z in np.linspace(HEAD[0][0],HEAD[-1][0],108)]
    attach(geo.loft("explorer.adult-face-planes",rows,SKIN,start="pole",end="pole"),rig,"head")
    attach(geo.tube("explorer.neck",[V(0,0,.978),NECK,V(0,.005,1.039)],
                   [(.044,.043),(.046,.043),(.039,.042)],SKIN,n=48),rig,"head")
    controls = {}
    for s,side in ((-1,"L"),(1,"R")):
        centre = head_point(math.radians(s*28),1.190)+V(0,.0035,0)
        controls["eye"+side] = geo.ball("explorer.eye-"+side,1,centre,IVORY,
            scale=(.023,.0055,.0063),seg=36,rings=18)
        controls["pupil"+side] = geo.ball("explorer.pupil-"+side,1,centre+V(-s*.0015,.006,0),IRIS,
            scale=(.0058,.0021,.0049),seg=26,rings=14)
        line = [head_point(math.radians(s*a),1.208+.010*(a-12)/35)+V(0,.0045,0)
                for a in np.linspace(12,47,28)]
        controls["brow"+side] = geo.tube("explorer.brow-"+side,line,[.0046]*len(line),HAIR,n=14)
        # Frost follows the combed brow's upper ridge, with short ordered breaks.
        brow_parts = [controls["brow"+side]]
        for start in (3,10,17):
            frost = [point+V(0,.0016,.0037) for point in line[start:start+5]]
            brow_parts.append(geo.tube(f"explorer.brow-frost-{side}-{start}",frost,[.0012]*len(frost),FUR,n=8))
        controls["brow"+side] = kit.join(brow_parts,"explorer.brow-"+side)
        for upper in (True,False):
            line = [centre+V(t*.023,.005,(.0010+.0026*(1-t*t)) if upper else -.0018-.0026*(1-t*t))
                    for t in np.linspace(-1,1,25)]
            attach(geo.tube(f"explorer.eyelid-{side}-{upper}",line,[.0021]*len(line),SKIN,n=10),rig,"head")
        at = head_point(math.radians(s*13),1.139)+V(0,.001,0)
        attach(geo.ball("explorer.nostril-"+side,1,at,DARK,
            scale=(.0030,.0018,.0016),seg=18,rings=10),rig,"head")
    mouth = [head_point(math.radians(a),1.108-.002*(abs(a)/24)**1.7)+V(0,.0065,0)
             for a in np.linspace(-26,26,32)]
    controls["mouth"] = geo.tube("explorer.closed-grimace",mouth,[.0010]*len(mouth),DARK,n=10)
    for upper in (True,False):
        # Pressed cupid bow and rounded lower lip taper into the corners.
        attach(geo.sheet("explorer.compressed-lip-"+str(upper),lambda u,v:lip_point(u,v,upper),
                         np.linspace(-1,1,40),np.linspace(0,1,10),LIP,rim=.0005,back=True),rig,"head")
    for name in ("eyeL","eyeR","browL","browR","mouth","pupilL","pupilR"):
        obj = controls[name]; kit.apply(obj); kit.apply_transform(obj)
        points = [v.co.copy() for v in obj.data.vertices]
        lo = V(*(min(p[k] for p in points) for k in range(3)))
        hi = V(*(max(p[k] for p in points) for k in range(3)))
        centre = (lo+hi)/2; size = hi-lo
        normal = V(centre.x*3,1,0).normalized()
        axes = Matrix((normal.cross(V(0,0,1)).normalized(),normal,V(0,0,1))).transposed()
        frame = Matrix.Translation(centre)@axes.to_4x4()
        obj.data.transform(frame.inverted()); obj.matrix_world = frame
        obj.name = "explorer"+name
        if name.startswith("pupil"): obj.parent = controls["eye"+name[-1]]
        else:
            obj.parent = rig; obj.parent_type = "BONE"; obj.parent_bone = "explorer.head"
        obj.matrix_world = frame
        obj["faceWidth"] = max(.003,size.x); obj["faceHeight"] = max(.002,size.z)


def swept_hair(rig):
    # Five deliberately flowing lock panels; smooth convex ridge, combed
    # secondary incisions, hidden solid return. No random strand cloud.
    for label,ac,width,high,low,bias in (("sweep-L",-26,33,1.251,1.232,-10),
        ("sweep-R",28,30,1.250,1.231,11),("temple-L",-78,12,1.226,1.124,-5),
        ("temple-R",78,12,1.229,1.128,5),("part",-3,15,1.260,1.239,-10)):
        def surface(u,v):
            a = ac+(u-.5)*width+bias*(1-v)
            z = geo.lerp(low,high,v)+.010*math.sin(math.pi*u)
            point = head_point(math.radians(a),z)
            normal = V(math.sin(math.radians(a)),math.cos(math.radians(a)),0)
            depth = .004+.011*math.sin(math.pi*u)**.75*math.sin(math.pi*v)**.45
            depth += .0012*math.cos(u*math.pi*12-v*1.5)*math.sin(math.pi*u)
            return point+normal*depth
        attach(geo.sheet("explorer.combed-hair-"+label,surface,np.linspace(0,1,42),
            np.linspace(0,1,36),HAIR,rim=.003,back=True,inside=HC),rig,"hair")


def hood(rig):
    c = V(0,-.014,1.155); th0 = math.radians(51)
    def point(th,ph,r=1):
        return c+V(math.sin(th)*math.cos(ph)*.172*r,
                    math.cos(th)*.149*r,math.sin(th)*math.sin(ph)*.153*r)
    for label,scale,material,inward in (("gabardine-hood",1,CLOTH,False),("hood-lining",.951,FUR_SHADE,True)):
        rows = [[point(th,ph,scale) for ph in np.linspace(0,TAU,88,endpoint=False)]
                for th in np.linspace(th0,math.pi-.004,51)]
        obj = geo.loft("explorer."+label,rows,material,end=point(math.pi,0,scale))
        if inward:
            bm = bmesh.new(); bm.from_mesh(obj.data)
            bmesh.ops.reverse_faces(bm,faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
        attach(obj,rig,"hat")
    centre = V(0,.084,1.154)
    attach(fur_contour("explorer.ordered-fur-ruff",centre,.135,.124,.029,.026,locks=36),rig,"hat")
    # Sewn crown seam and a narrow goggle strap lie on the cloth shell.
    line = [point(th,math.pi/2,1.007) for th in np.linspace(th0+.11,math.pi-.08,45)]
    attach(geo.tube("explorer.hood-crown-seam",line,[.0015]*len(line),TROUSER,n=8),rig,"hat")
    goggle_normal = V(0,.76,.65).normalized()
    for s in (-1,1):
        at = V(s*.054,.055,1.279)
        frame = geo.look(goggle_normal,V(0,0,1),at)
        outline = [(.035*math.cos(a),.027*math.sin(a)) for a in np.linspace(0,TAU,40,endpoint=False)]
        attach(geo.slab("explorer.goggle-lens-"+str(s),outline,.009,LENS,matrix=frame,bevel=.001),rig,"hat")
        orbit = [frame@V(.039*math.cos(a),.031*math.sin(a),.010) for a in np.linspace(0,TAU,64,endpoint=False)]
        attach(closed_tube("explorer.goggle-machined-rim-"+str(s),orbit,[.006]*len(orbit),BRASS_EDGE,n=14,normal=goggle_normal),rig,"hat")
        for k in (-1,1):
            at2 = frame@V(k*.038,0,.014)
            attach(geo.ball(f"explorer.goggle-hinge-{s}-{k}",.005,at2,BRASS,seg=12,rings=8),rig,"hat")
    attach(geo.tube("explorer.goggle-bridge",[V(-.019,.057,1.283),V(0,.070,1.290),V(.019,.057,1.283)],
                   [(.008,.006)]*3,BRASS,n=16),rig,"hat")
    strap = [point(th0+.50,ph,1.012) for ph in np.linspace(-.23,math.pi+.23,64)]
    attach(geo.tube("explorer.goggle-leather-strap",strap,[(.010,.004)]*len(strap),LEATHER,n=8,
                   up=(0,0,1),caps=("flat","flat")),rig,"hat")


def trousers_and_mukluks(rig):
    for s,side in ((-1,"L"),(1,"R")):
        a,k,w = HIP[s],KNEE[s],ANKLE[s]
        controls = [a+V(0,0,.033),geo.lerp(a,k,.6),k,geo.lerp(k,w,.36)]
        path = [Vector(p) for p in kit.smooth_path(controls,samples=16)]
        radii = [profile([(0,.068,.075),(.28,.070,.077),(.55,.065,.069),
                         (.75,.061,.064),(1,.053,.054)],j/(len(path)-1)) for j in range(len(path))]
        rows = geo.rings_along(path,radii,n=56,up=(0,1,0))
        for j,row in enumerate(rows):
            q = j/(len(rows)-1)
            for i,point in enumerate(row):
                angle = i/56*TAU
                for fold,tilt,amount in ((.55,.039,.009),(.69,-.042,.012),(.84,.036,.008)):
                    centre = fold+tilt*math.sin(angle*2+.3*s)
                    point += (point-path[j]).normalized()*(amount*g(q,centre,.043)-amount*.65*g(q,centre+.044,.016))
        obj = geo.loft("explorer.folded-trouser-"+side,rows,TROUSER,start="pole",end="flat")
        points = np.array([v.co[:] for v in obj.data.vertices]); knee = 1-ss(.320,.400,points[:,2])
        weights(obj,rig,{"leg"+side:1-knee,"knee"+side:knee})
        # A tapered fur shaft descends into a constructed leather last.
        zs = np.linspace(.085,.287,48)
        rows = []
        for z in zs:
            q = (z-.085)/.202
            rx,ry = profile([(0,.064,.064),(.27,.065,.066),(.66,.071,.068),(1,.073,.068)],q)
            rows.append([V(w.x+rx*math.cos(angle),w.y+ry*math.sin(angle),z)+
                V(math.cos(angle),math.sin(angle),0)*(.0035*(.5+.5*math.cos(angle*24+q*2.2))**3)
                for angle in np.linspace(0,TAU,80,endpoint=False)])
        obj = geo.loft("explorer.combed-mukluk-shaft-"+side,rows,FUR,start="flat",end="flat")
        points = np.array([v.co[:] for v in obj.data.vertices]); foot = 1-ss(.112,.194,points[:,2])
        weights(obj,rig,{"knee"+side:1-foot,"foot"+side:foot})
        # Rounded broad toe and a flattened heel/sole, not a fur cylinder.
        last_rows = []
        for y in np.linspace(-.074,.157,54):
            q = (y+.074)/.231
            width,height = profile([(0,.042,.041),(.18,.063,.053),(.47,.069,.059),(.78,.070,.050),(1,.027,.022)],q)
            last_rows.append([V(w.x+width*geo.spow(math.cos(angle),.74),w.y+y,
                max(.024,.049+height*geo.spow(math.sin(angle),.82)))
                for angle in np.linspace(0,TAU,48,endpoint=False)])
        attach(geo.loft("explorer.mukluk-toe-last-"+side,last_rows,FUR,start="pole",end="pole"),rig,"foot"+side)
        # Leather outsole exact Z=0. Its shaped plate protects native height.
        outline = [(-.048,-.077),(.048,-.077),(.067,-.022),(.071,.096),(.055,.149),
                   (.025,.164),(-.025,.164),(-.055,.149),(-.071,.096),(-.067,-.022)]
        frame = Matrix.Translation(V(w.x,w.y,0))
        attach(geo.slab("explorer.mukluk-leather-sole-"+side,outline,.024,SOLE,matrix=frame,bevel=.003),rig,"foot"+side)
        welt = [V(w.x+x,w.y+y,.030) for x,y in outline]
        attach(closed_tube("explorer.mukluk-welt-"+side,welt,[.0027]*len(welt),SEAM,n=8,normal=(0,0,1)),rig,"foot"+side)
        for z in (.197,.230):
            loop = [V(w.x+.074*math.cos(angle),w.y+.070*math.sin(angle),z+.004*math.sin(angle*2))
                    for angle in np.linspace(0,TAU,48,endpoint=False)]
            obj = closed_tube(f"explorer.mukluk-tie-{side}-{z}",loop,[.004]*len(loop),LEATHER,n=10,normal=(0,0,1))
            attach(obj,rig,"knee"+side)
        controls = [V(w.x-.032,w.y+.069,.237),V(w.x+.030,w.y+.071,.200),
                    V(w.x-.031,w.y+.073,.192),V(w.x+.011,w.y+.077,.148)]
        tie = [Vector(p) for p in kit.smooth_path(controls,samples=9)]
        attach(geo.tube("explorer.mukluk-front-tie-"+side,tie,[.0029]*len(tie),LEATHER,n=10),rig,"knee"+side)


def tailoring(rig, parka):
    # Leather belt is fitted to the waist contour; forged rectangular buckle.
    rows = [[body_point(a,z,.006) for a in np.linspace(0,TAU,80,endpoint=False)]
            for z in (.630,.635,.670,.675)]
    attach(geo.loft("explorer.fitted-leather-belt",rows,LEATHER),rig,"torso")
    buckle = body_point(0,.652,.028)
    frame = geo.look(V(0,1,0),V(0,0,1),buckle)
    loop = [frame@V(x,z,0) for x,z in ((-.027,-.021),(.027,-.021),(.027,.021),(-.027,.021))]
    attach(closed_tube("explorer.rectangular-buckle",loop,[.0045]*len(loop),BRASS_EDGE,n=12,normal=(0,1,0)),rig,"torso")
    attach(geo.tube("explorer.buckle-tongue",[buckle+V(-.023,.003,0),buckle+V(.017,.005,0)],
                   [.0026]*2,BRASS,n=10),rig,"torso")
    for s in (-1,1):
        # Raised pocket bag is a shallow shaped panel, its flap shares skin.
        def pocket(u,v):
            a = s*.54+geo.lerp(-.22,.22,u)
            z = geo.lerp(.526,.612,v)
            return body_point(a,z,.009+.010*math.sin(math.pi*u)*math.sin(math.pi*v))
        obj = geo.sheet("explorer.patch-pocket-"+str(s),pocket,np.linspace(0,1,28),
            np.linspace(0,1,26),CLOTH,rim=.003,back=True,inside=V(0,0,.565))
        follow_parka(obj,rig,parka)
        line = [pocket(u,.82)+V(0,.003,0) for u in np.linspace(0,1,28)]
        obj = geo.tube("explorer.pocket-flap-seam-"+str(s),line,[.0018]*len(line),TROUSER,n=8)
        follow_parka(obj,rig,parka)
        # Sleeve outer seam follows the skin instead of floating off the cuff.
        path = [geo.lerp(SHOULDER[s],ELBOW[s],q)+V(s*(.065-.018*q),0,0)
                for q in np.linspace(.14,.86,32)]
        obj = geo.tube("explorer.outer-sleeve-seam-"+str(s),path,[.0014]*len(path),TROUSER,n=8)
        follow_parka(obj,rig,parka)
    placket = [[body_point(a,z,.008) for a in (-.055,.055)] for z in np.linspace(.678,.969,54)]
    obj = geo.loft("explorer.front-storm-placket",placket,CLOTH,closed=False)
    follow_parka(obj,rig,parka)
    for z in (.737,.821,.904):
        point = body_point(0,z,.015)
        obj = geo.rbox("explorer.wood-toggle",(.038,.014,.013),point,WOOD_EDGE,levels=2,crease=.3)
        follow_parka(obj,rig,parka)
        for s in (-1,1):
            line = [point+V(s*.020,.002,.007),point+V(s*.028,.009,0),point+V(s*.020,.002,-.007)]
            obj = geo.tube("explorer.toggle-cord",line,[.0027]*len(line),LEATHER,n=10)
            follow_parka(obj,rig,parka)
    # One thick continuous hem, weighted with the two skirt halves.
    centre = V(0,0,.429)
    obj = fur_contour("explorer.ordered-fur-hem",centre,.173,.155,.017,.020,
                      locks=40,n=160,ring=20,plane="XY")
    follow_parka(obj,rig,parka)
    # Chest sling and a leather map pouch provide a measured expedition read.
    line = [body_point(geo.lerp(.70,-.56,t),geo.lerp(.956,.664,t),.016) for t in np.linspace(0,1,52)]
    obj = geo.tube("explorer.diagonal-chest-sling",line,[(.013,.0038)]*len(line),LEATHER,n=8,up=(0,1,0))
    follow_parka(obj,rig,parka)
    at = V(-.177,-.004,.597)
    attach(geo.rbox("explorer.map-pouch",(.058,.088,.109),at,LEATHER,levels=3,crease=.38),rig,"extra")
    attach(geo.rbox("explorer.map-pouch-flap",(.059,.088,.021),at+V(0,0,.045),SEAM,levels=2,crease=.4),rig,"extra")
    attach(geo.ball("explorer.pouch-stud",.006,at+V(-.030,0,.024),BRASS,seg=14,rings=8),rig,"extra")


def rifle(rig):
    side = D.cross(UP).normalized()
    frame = geo.basis(D,UP,side,GRIP-side*.028)
    outline = [(-.266,-.069),(-.266,.055),(-.203,.057),(-.106,.040),
               (-.036,.034),(.068,.024),(.315,.017),(.332,-.017),
               (.066,-.031),(.027,-.038),(-.041,-.034),(-.093,-.052),(-.189,-.064)]
    # geo.slab expects CCW in its authored (along, up) plane. Butt-bottom
    # to butt-top described the stock clockwise; reverse before extrusion.
    outline.reverse()
    assert sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(outline,outline[1:]+outline[:1])) > 0
    attach(geo.slab("explorer.engineered-wood-stock",outline,.056,WOOD,matrix=frame,bevel=.004),rig,"weapon")
    # Rounded wood fore-end and forged brass action sit at a clear seam.
    attach(geo.tube("explorer.rifle-forewood",[GRIP+D*.106,GRIP+D*.165,GRIP+D*.408],
                   [(.029,.024),(.033,.027),(.029,.022)],WOOD,n=32,up=UP,caps=("flat","flat")),rig,"weapon")
    attach(geo.tube("explorer.brass-receiver",[GRIP+D*.004+UP*.015,GRIP+D*.126+UP*.015],
                   [(.028,.024)]*2,BRASS,n=24,up=UP,caps=("flat","flat")),rig,"weapon")
    # V1's distal frost facets exceeded the native depth cap by 10.6 mm.
    # Trim only the remote muzzle by 20 mm; the grip, stock and coil stay put.
    start,tip = GRIP+D*.094+UP*.021,GRIP+D*.675+UP*.021
    attach(geo.tube("explorer.blued-rifle-barrel",[start,tip],[.017,.0155],STEEL,n=36,up=UP,
                   caps=("flat","flat")),rig,"weapon")
    for along in (.145,.389,.649):
        point = GRIP+D*along+UP*.017
        attach(geo.tube("explorer.machined-barrel-band",[point-D*.007,point+D*.007],
                       [.027]*2,BRASS,n=32,up=UP,caps=("flat","flat")),rig,"weapon")
        at = point+side*.025
        attach(geo.ball("explorer.band-screw",.0047,at,STEEL,scale=(.5,1,1),seg=16,rings=8),rig,"weapon")
    coil = []
    for j in range(176):
        t = j/175; angle = t*TAU*5
        centre = GRIP+D*geo.lerp(.413,.634,t)+UP*.021
        coil.append(centre+(side*math.cos(angle)+UP*math.sin(angle))*.023)
    attach(geo.tube("explorer.five-turn-ice-coil",coil,[.0048]*len(coil),ICE,n=12,up=D),rig,"weapon")
    # A deep muzzle socket with a readable icy inner throat, no transmission.
    loop = [tip+side*(.023*math.cos(a))+UP*(.023*math.sin(a)) for a in np.linspace(0,TAU,48,endpoint=False)]
    attach(closed_tube("explorer.frost-muzzle-rim",loop,[.005]*len(loop),BRASS_EDGE,n=14,normal=D),rig,"weapon")
    muzzle_frame = geo.look(D,UP,tip+D*.003)
    circle = [(.017*math.cos(a),.017*math.sin(a)) for a in np.linspace(0,TAU,24,endpoint=False)]
    attach(geo.slab("explorer.icy-muzzle-throat",circle,.004,ICE,matrix=muzzle_frame),rig,"weapon")
    for k in range(6):
        angle = k/6*TAU
        radial = side*math.cos(angle)+UP*math.sin(angle)
        at = tip+radial*.020
        frame2 = geo.basis(radial,D,radial.cross(D),at)
        attach(geo.slab("explorer.muzzle-frost-facet-"+str(k),[(0,-.003),(.010,.001),(.005,.024),(-.006,.011)],
                       .005,ICE,matrix=frame2,bevel=.0005),rig,"weapon")
    for along in (.059,.610):
        at = GRIP+D*along+UP*.046
        attach(geo.tube("explorer.rifle-sight",[at-UP*.012,at],[.004]*2,BRASS,n=10,up=side),rig,"weapon")
    # Bolt lever and a closed trigger guard have engineered loops.
    bolt = [GRIP+D*.078+side*.028+UP*.015,GRIP+D*.086+side*.057,
            GRIP+D*.052+side*.059-UP*.020]
    attach(geo.tube("explorer.bolt-lever",bolt,[.005]*3,STEEL,n=14,up=UP),rig,"weapon")
    attach(geo.ball("explorer.bolt-knob",.012,bolt[-1],STEEL,seg=24,rings=12),rig,"weapon")
    guard = [GRIP+D*(.033*math.cos(a)+.028)+UP*(.023*math.sin(a)-.049) for a in np.linspace(0,TAU,48,endpoint=False)]
    attach(closed_tube("explorer.trigger-guard",guard,[.0036]*len(guard),STEEL,n=10,normal=side),rig,"weapon")
    line = [GRIP-UP*.045,GRIP+D*.023-UP*.067,GRIP+D*.036-UP*.055]
    attach(geo.tube("explorer.rifle-trigger",line,[.0027]*3,BRASS,n=10,up=side),rig,"weapon")
    for along in (-.228,-.126):
        edge = [GRIP+D*along+UP*z+side*.029 for z in np.linspace(-.049,.037,24)]
        attach(geo.tube("explorer.stock-carved-edge",edge,[.0015]*len(edge),WOOD_EDGE,n=8),rig,"weapon")
    controls = [GRIP-D*.217-UP*.060,GRIP-D*.106-UP*.113,
                GRIP+D*.181-UP*.124,GRIP+D*.379-UP*.040]
    sling = [Vector(p) for p in kit.smooth_path(controls,samples=12)]
    attach(geo.tube("explorer.rifle-leather-sling",sling,[(.008,.0028)]*len(sling),LEATHER,n=8,up=side),rig,"weapon")


def finish(root):
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    kit.fill_ao(meshes,1)
    face = bpy.data.objects["explorer.adult-face-planes"]
    layer = face.data.color_attributes.get("AO")
    for entry,loop in zip(layer.data,face.data.loops):
        point = face.data.vertices[loop.vertex_index].co
        angle = abs(math.degrees(math.atan2(point.x,point.y-.020)))
        blush = .82*g(angle,40,22)*g(point.z,1.160,.027)+.26*g(angle,0,16)*g(point.z,1.149,.018)
        entry.color = (1,1-blush*.50,1-blush*.46,1)
    for name in (CLOTH,TROUSER,SKIN,HAIR,FUR,FUR_SHADE,LEATHER,WOOD,BRASS,STEEL):
        material = kit.material(name); nodes = material.node_tree.nodes; links = material.node_tree.links
        bsdf = nodes.get("Principled BSDF"); family = name.split(":")[0]
        bsdf.inputs["Specular IOR Level"].default_value = .24 if family in ("skin","weave","felt") else .42
        if family == "skin": bsdf.inputs["Subsurface Weight"].default_value = .035
        if family in ("weave","hide","beech"):
            noise = nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 350 if family == "weave" else 160
            bump = nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = .10
            bump.inputs["Distance"].default_value = .00032
            links.new(noise.outputs["Fac"],bump.inputs["Height"]); links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
    root["authorBrief"] = "work/arena/2026-10-08-roster/explorer/brief-v2.md"
    root["neutralStance"] = "hanging upper arms, softly bent elbows; one-hand diagonal rifle carry"
    root["qualityMaster"] = True


def build_master():
    global _PARKA_FIELD
    _PARKA_FIELD = None
    root = kit.empty("explorer"); rig = make_rig(root)
    parka,fields = fuse_parka([parka_trunk(),sleeve(-1),sleeve(1)])
    weight_parka(parka,rig,fields)
    adult_face(rig); swept_hair(rig); hood(rig)
    for s in (-1,1): mitten(s,rig)
    trousers_and_mukluks(rig)
    try:
        tailoring(rig,parka)
    finally:
        _PARKA_FIELD = None
    del fields
    rifle(rig); finish(root)
    kit.refresh()
    return root
