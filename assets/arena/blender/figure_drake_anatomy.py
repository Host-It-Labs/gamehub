"""Private sculpting, human construction and common-axis attachment tools.

Read the mandatory high-fidelity-3d skill before using this module. Both
aviators have authored adult face planes, a fused neck/skull, a continuous
tailored jacket and sleeves, and fused five-digit gloves with a real thenar
transition. Shapes are authored at human scale before native placement, so
small pilots do not lose sculpt sampling. No shared file is changed.
"""
import math
import json

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_folk_kit as geo
from figure_drake_contract import human_config, human_pivots, contract

V = lambda *a: Vector(a[0] if len(a) == 1 else a)
TAU = math.tau


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def gauss(x, c, r):
    return math.exp(-((x-c)/r)**2)


def curve(points, samples=8):
    # kit.smooth_path returns tuples. Convert before Vector arithmetic.
    return [Vector(p) for p in kit.smooth_path(points, samples=samples)]


def profile(rows, x):
    if x <= rows[0][0]: return tuple(rows[0][1:])
    if x >= rows[-1][0]: return tuple(rows[-1][1:])
    for i, (a, b) in enumerate(zip(rows, rows[1:])):
        if x > b[0]: continue
        t, h = (x-a[0])/(b[0]-a[0]), b[0]-a[0]
        p, n = rows[max(0, i-1)], rows[min(len(rows)-1, i+2)]
        out = []
        for k in range(1, len(a)):
            slope = (b[k]-a[k])/h
            m0, m1 = (b[k]-p[k])/(b[0]-p[0]), (n[k]-a[k])/(n[0]-a[0])
            m0 = math.copysign(min(abs(m0), 2*abs(slope)), slope) if slope*m0 > 0 else 0
            m1 = math.copysign(min(abs(m1), 2*abs(slope)), slope) if slope*m1 > 0 else 0
            out.append((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*h*m0+
                       (-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*m1)
        return tuple(out)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def tag(obj, triangles, region, human=False):
    obj["runtimeTriangles"] = triangles
    obj["sourceRegion"] = region
    obj["humanComponent"] = human
    return obj


def fuse(parts, name, material, voxel, memory=None):
    if memory: memory("before-union-"+name)
    for obj in parts:
        kit.apply(obj); kit.apply_transform(obj)
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if bm.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(obj.data); bm.free()
    obj = kit.join(parts, name)
    select(obj)
    mod = obj.modifiers.new("Private connected sculpt volume", "REMESH")
    mod.mode, mod.voxel_size, mod.use_smooth_shade = "VOXEL", voxel, True
    mod.use_remove_disconnected = False
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("Restrained tissue transitions", "SMOOTH")
    mod.factor, mod.iterations = .25, 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.assign(obj, material)
    for polygon in obj.data.polygons: polygon.use_smooth = True
    if memory: memory("after-union-"+name)
    return obj


def make_rig(root, record):
    data = bpy.data.armatures.new(root.name+" private common-axis rig")
    rig = bpy.data.objects.new(root.name+".skeleton", data)
    bpy.context.collection.objects.link(rig); rig.parent = root
    select(rig); bpy.ops.object.mode_set(mode="EDIT")
    for name, point in record["positions"].items():
        bone = data.edit_bones.new(root.name+"."+name)
        bone.head, bone.tail = Vector(point), Vector(point)+V(0, 0, .04)
        bone.roll, bone.use_connect = 0, False
    for name, parent in record["parents"].items():
        data.edit_bones[root.name+"."+name].parent = data.edit_bones[root.name+"."+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps(record["positions"])
    rig["humanMount"] = record["config"]["mount"]
    return rig


def attach(obj, rig, bone):
    kit.apply(obj); kit.apply_transform(obj)
    geo.uv_box(obj)
    world = obj.matrix_world.copy()
    obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", rig.parent.name+"."+bone
    obj.matrix_world = world
    kit.refresh()
    return obj


def weights(obj, rig, values):
    names = list(values)
    raw = np.array([values[name] for name in names], dtype=np.float64).T
    # Retain at most four normalized influences. No unweighted fingers or
    # duplicate pigment channel can be hidden by a successful GLB export.
    order = np.argsort(raw, axis=1)[:, -4:]
    keep = np.zeros_like(raw)
    np.put_along_axis(keep, order, np.take_along_axis(raw, order, axis=1), axis=1)
    total = keep.sum(axis=1)
    if np.any(total < 1e-8): raise ValueError("Unweighted private skin")
    keep /= total[:, None]
    for k, name in enumerate(names):
        quant = np.rint(keep[:, k]*1000000).astype(np.int32)
        indices = np.flatnonzero(quant > 0)
        if not len(indices): continue
        group = obj.vertex_groups.new(name=rig.parent.name+"."+name)
        indices = indices[np.argsort(quant[indices])]
        for batch in np.split(indices, np.flatnonzero(np.diff(quant[indices]))+1):
            if len(batch): group.add(batch.tolist(), float(quant[batch[0]])/1000000, "REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Connected anatomical deformation", "ARMATURE")
    mod.object = rig; mod.use_deform_preserve_volume = False
    obj["continuousSkin"] = True
    geo.uv_box(obj)
    return obj


def surface_tree(obj):
    obj.data.calc_loop_triangles()
    return BVHTree.FromPolygons([v.co.copy() for v in obj.data.vertices],
        [tuple(p.vertices) for p in obj.data.loop_triangles], all_triangles=True)


class Human:
    def __init__(self, figure, rig, memory=None):
        self.r = figure; self.rig = rig; self.cfg = human_config(figure)
        self.memory = memory; self.pivots = {k: Vector(v) for k, v in human_pivots().items()}
        self.matrix = (Matrix.Translation(Vector(self.cfg["waist"])) @
                       Matrix.Scale(self.cfg["scale"], 4) @
                       Matrix.Translation(V(0, 0, -self.cfg["humanWaist"])))
        self.inverse = self.matrix.inverted(); self.elderly = self.cfg["elderly"]
        prefix = figure+"-aviator-"
        self.skin = "skin:"+kit.tint(prefix+"skin", "#e7ac87" if not self.elderly else "#edbb99")
        self.lip = "skin:"+kit.tint(prefix+"lip", "#bc7d67")
        self.jacket = "weave:team" if self.elderly else "hide:"+kit.tint("aviator-leather", "#70402b")
        self.glove = "hide:"+kit.tint(prefix+"glove", "#603c27")
        self.cream = "weave:"+kit.tint(prefix+"linen", "#f3e7cf")
        self.silk = "drape:"+kit.tint(prefix+"linen", "#f3e7cf")
        self.hair = "hair:"+kit.tint(prefix+"hair", "#ede7df" if self.elderly else "#443028")
        self.ink = "resin:"+kit.tint(prefix+"ink", "#22232a")
        self.eye = "resin:"+kit.tint(prefix+"eye", "#f2e9d7")
        self.iris = "resin:"+kit.tint(prefix+"iris", "#68513b")
        self.brass = "gilt:"+kit.tint(prefix+"brass", "#c49c52")
        self.lens = "lacquer:"+kit.tint(prefix+"lens", "#385269")

    def point(self, p): return self.matrix @ Vector(p)

    def put(self, obj, bone=None, budget=100, region="human detail"):
        kit.apply(obj); kit.apply_transform(obj)
        obj.data.transform(self.matrix)
        tag(obj, budget, region, True)
        if bone: attach(obj, self.rig, bone)
        return obj

    def trunk_point(self, a, z):
        w, f, b = profile([(.535,.095,.079,.073),(.64,.115,.09,.087),
                           (.75,.131,.106,.089),(.855,.141,.107,.096),
                           (.94,.145,.09,.092),(.975,.115,.076,.075),
                           (1.022,.043,.043,.042)], z)
        sn, cs = math.sin(a), math.cos(a)
        ad = abs((math.degrees(a)+180)%360-180)
        relief = -.013*gauss(ad,90,15)*gauss(z,.851,.072)
        relief += .005*gauss(ad,33,21)*gauss(z,.878,.068)
        for h, slope, height in ((.73,.022,.006),(.665,-.027,.008),(.83,-.012,.004)):
            at = h+slope*math.sin(2*a+.4)
            relief += (height*gauss(z,at,.016)-height*.45*gauss(z,at-.018,.008))*gauss(ad,44,53)
        return V(sn*(w+relief), cs*((f if cs>=0 else b)+relief), z)

    def jacket_sleeve(self, s):
        side = "L" if s<0 else "R"
        a, e, w = (self.pivots[name+side] for name in ("arm", "fore", "hand"))
        path = curve([a+V(-s*.043,0,.018), a, a.lerp(e,.42)+V(s*.012,.002,0),
                      e, e.lerp(w,.45), w+V(0,0,.015)], 10)
        rows = []
        for j, p in enumerate(path):
            t = j/(len(path)-1)
            radius = profile([(0,.060),(.15,.062),(.33,.052),(.58,.043),(.78,.040),(1,.033)], t)[0]
            d = (path[min(j+1,len(path)-1)]-path[max(0,j-1)]).normalized()
            u = (V(1,0,0)-d*d.x).normalized(); v = d.cross(u)
            row = []
            for k in range(40):
                aa = k/40*TAU
                fold = .006*gauss(t,.60+.033*math.sin(aa),.035)-.003*gauss(t,.55,.026)
                fold += .004*gauss(t,.82-.024*math.cos(aa),.045)*(.55+.45*math.sin(aa))
                row.append(p+u*math.cos(aa)*(radius+fold)+v*math.sin(aa)*(radius*.91+fold))
            rows.append(row)
        return geo.loft(self.r+".sleeve-source-"+side, rows, self.jacket, start="flat", end="flat")

    def jacket_skin(self):
        rows = [[self.trunk_point(a, float(z)) for a in np.linspace(0,TAU,72,endpoint=False)]
                for z in np.linspace(.535,1.022,80)]
        trunk = geo.loft(self.r+".jacket-primary",rows,self.jacket,start="flat",end="flat")
        parts = [trunk, self.jacket_sleeve(-1), self.jacket_sleeve(1)]
        fields = [surface_tree(obj) for obj in parts]
        obj = fuse(parts,self.r+".connected-jacket",self.jacket,.0033,self.memory)
        P = np.array([v.co[:] for v in obj.data.vertices]); x, _, z = P.T
        chest = smooth(.695,.90,z)
        values = {self.cfg["mount"]:1-chest, "chest":chest}
        distances = np.array([[tree.find_nearest(Vector(p))[3] for p in P] for tree in fields])
        for i, (s, side) in enumerate(((-1,"L"),(1,"R"))):
            a, e, w = [np.array(self.pivots[n+side]) for n in ("arm","fore","hand")]
            along = (P-a)@(e-a)/np.dot(e-a,e-a)
            other = np.min(np.delete(distances,i+1,axis=0),axis=0)
            share = smooth(-.003,.006,other-distances[i+1])*smooth(-.10,.24,along)
            clav = share*(1-smooth(.06,.36,along))*.34
            fore = smooth(.84,1.08,along)
            values["clav"+side] = clav
            values["arm"+side] = (share-clav)*(1-fore)
            values["fore"+side] = (share-clav)*fore
            values[self.cfg["mount"]] *= 1-share; values["chest"] *= 1-share
            shoulder = smooth(.055,.14,s*x)*smooth(.915,.977,z)*.34*values["chest"]
            values["clav"+side] += shoulder; values["chest"] -= shoulder
        self.put(obj,budget=5100,region="continuous tailored chest, shoulders, elbows and long sleeves")
        weights(obj,self.rig,values)
        return obj

    def follow(self, obj, skin, budget=100, region="weighted jacket trim"):
        self.put(obj,budget=budget,region=region)
        data = skin.data; data.calc_loop_triangles()
        points = [v.co.copy() for v in data.vertices]
        faces = [tuple(p.vertices) for p in data.loop_triangles]
        tree = BVHTree.FromPolygons(points,faces,all_triangles=True)
        groups = {g.index:g.name.split(".",1)[1] for g in skin.vertex_groups}
        values = {name:np.zeros(len(obj.data.vertices)) for name in groups.values()}
        source = [{groups[g.group]:g.weight for g in v.groups} for v in data.vertices]
        for index, vertex in enumerate(obj.data.vertices):
            p,_,face,_ = tree.find_nearest(vertex.co); a,b,c = faces[face]
            bary = barycentric_transform(p,points[a],points[b],points[c],V(1,0,0),V(0,1,0),V(0,0,1))
            for k,factor in zip((a,b,c),bary):
                for name,value in source[k].items(): values[name][index] += max(0,factor)*value
        weights(obj,self.rig,values)
        return obj

    def hands(self):
        for s, side in ((-1,"L"),(1,"R")):
            wrist = self.pivots["hand"+side]
            down = (wrist-self.pivots["fore"+side]).normalized()
            palm = V(-s,0,0); palm = (palm-down*down.dot(palm)).normalized()
            across = down.cross(palm).normalized()
            # Mirror digit order as well as the palm: both radial thumbs
            # face forward in the hanging rest, rather than cloning a hand.
            def point(a,b,c): return wrist+across*(a*-s)+down*b+palm*c
            path = [point(0,t,0) for t in (-.022,0,.018,.038,.056)]
            glove = geo.tube(self.r+".palm-source-"+side,path,
                             [(.022,.023),(.024,.023),(.029,.018),(.033,.017),(.028,.015)],
                             self.glove,n=40,up=tuple(across),caps=("flat","dome"))
            parts = [glove]
            parts.append(geo.ball(self.r+".thenar-source-"+side,1,point(-.019,.029,.010),self.glove,
                                  scale=(.012,.017,.023),seg=32,rings=18))
            for k,(offset,length) in enumerate(((-.023,.051),(-.008,.060),(.008,.055),(.022,.044))):
                guides = [point(offset,.049,-.002),point(offset,.066,-.001),
                          point(offset,.049+length*.67,.004),point(offset,.049+length,.013)]
                path = curve(guides,7)
                radii = [(.0094*(1-.44*j/(len(path)-1)),.0086*(1-.48*j/(len(path)-1)))
                         for j in range(len(path))]
                parts.append(geo.tube(self.r+f".digit-source-{side}-{k}",path,radii,self.glove,n=16,
                                      up=tuple(palm),caps=("flat","dome")))
            thumb = curve([point(-.021,.022,.009),point(-.036,.038,.016),
                           point(-.034,.052,.029),point(-.020,.059,.036)],8)
            parts.append(geo.tube(self.r+".thumb-source-"+side,thumb,
                                  [(.012*(1-.45*j/(len(thumb)-1)),.010*(1-.4*j/(len(thumb)-1)))
                                   for j in range(len(thumb))],self.glove,n=20,up=tuple(palm)))
            glove = fuse(parts,self.r+".connected-five-digit-glove-"+side,self.glove,.0017,self.memory)
            P = np.array([v.co[:] for v in glove.data.vertices])
            along = (P-np.array(wrist))@np.array(down)
            hand = smooth(-.014,.016,along)
            self.put(glove,budget=1600,region="wrist, thenar, open palm and five curved separated digits")
            weights(glove,self.rig,{"fore"+side:1-hand,"hand"+side:hand})
            # The gauntlet's edge is carved into the sleeve; separate rim rings
            # and ink knuckle lines read as floating spikes and bands (9 Oct).

    def face_point(self, a, z, lift=0):
        rows = [(1.016,.035,.035,.038),(1.047,.044,.046,.044),(1.071,.064,.059,.058),
                (1.11,.088,.063,.075),(1.16,.101,.071,.085),(1.21,.100,.073,.087),
                (1.26,.092,.070,.080),(1.30,.065,.048,.055),(1.326,.007,.009,.010)]
        w,f,b = profile(rows,z); sn,cs = math.sin(a),math.cos(a)
        ad = abs((math.degrees(a)+180)%360-180)
        x = math.copysign(abs(sn)**.88,sn)*w
        y = -.006+math.copysign(abs(cs)**.88,cs)*(f if cs>=0 else b)
        if ad < 95:
            y += .010*gauss(z,1.185,.027)*gauss(ad,39,18) # zygoma
            y -= .008*gauss(z,1.210,.013)*gauss(ad,27,15) # socket
            y += .009*gauss(z,1.235,.013)*gauss(ad,23,18) # brow plane
            y += .025*gauss(z,1.191,.035)*gauss(x,0,.011) # bridge
            y += .032*gauss(z,1.171,.014)*gauss(x,0,.017) # nose tip
            y += .012*gauss(z,1.165,.008)*gauss(abs(x),.017,.006)
            y -= .004*gauss(z,1.158,.004)*gauss(abs(x),.013,.004)
            y += .009*gauss(z,1.084,.014)*gauss(x,0,.029) # chin
            y += .004*gauss(z,1.129,.014)*gauss(x,0,.029)
            if self.elderly:
                y += .011*gauss(z,1.155,.024)*gauss(abs(x),.055,.022) # cheek apples
                y -= .005*gauss(z,1.137,.023)*gauss(abs(x),.031,.005) # nasolabial
                y -= .003*gauss(z,1.199-.04*abs(x),.002)*gauss(ad,40,11)
                for h in (1.252,1.267):
                    y -= .0018*gauss(z,h+.012*(abs(x)/.07)**2,.0018)*gauss(ad,0,34)
            else:
                y += .008*gauss(z,1.112,.025)*gauss(ad,55,16) # masseter
        normal = V(sn,cs,0)
        return V(x,y,z)+normal*lift

    def face_normal(self,a,z):
        da = self.face_point(a+.001,z)-self.face_point(a-.001,z)
        dz = self.face_point(a,z+.0001)-self.face_point(a,z-.0001)
        n = da.cross(dz).normalized()
        if n.dot(self.face_point(a,z)-V(0,-.006,1.17)) < 0: n = -n
        return n

    def head_skin(self):
        rows = [[self.face_point(a,float(z)) for a in np.linspace(0,TAU,112,endpoint=False)]
                for z in np.linspace(1.016,1.326,110)]
        skull = geo.loft(self.r+".head-primary",rows,self.skin,start="pole",end="pole")
        neck = geo.tube(self.r+".neck-primary",[V(0,-.006,.976),V(0,-.006,1.06)],
                        [(.043,.041),(.046,.046)],self.skin,n=56,up=(1,0,0),caps=("flat","flat"))
        parts = [skull,neck]
        for s in (-1,1):
            parts.append(geo.ball(self.r+f".ear-primary-{s}",1,V(s*.099,-.008,1.184),self.skin,
                                  scale=(.017,.019,.034),seg=36,rings=22))
        head = fuse(parts,self.r+".connected-adult-head-neck",self.skin,.0018,self.memory)
        P = np.array([v.co[:] for v in head.data.vertices]); z = P[:,2]
        head_share = smooth(1.032,1.080,z)
        self.put(head,budget=3600,region="adult skull, eyelid sockets, cheekbones, nose, chin, ears and connected neck")
        weights(head,self.rig,{"neck":1-head_share,"head":head_share})
        for s in (-1,1):
            path = [V(s*.112,-.006+math.cos(a)*.009,1.183+math.sin(a)*.025)
                    for a in np.linspace(-math.pi*.60,math.pi*.78,30)]
            self.put(geo.tube(self.r+f".ear-helix-{s}",path,[.0024]*30,self.lip,n=9,up=(1,0,0)),
                     "head",90,"ear helix and antihelix")
        return head

    def patch(self,name,a,z,width,height,material,lift=.002,bulge=.002,slant=0):
        builder = geo.Mesh(name,material)
        center = builder.v(self.face_point(a,z)+self.face_normal(a,z)*(lift+bulge))
        rows = []
        for r in (.2,.4,.6,.8,1):
            row = []
            for i in range(40):
                aa = i/40*TAU; dx = math.cos(aa)*width*r
                zz = z+math.sin(aa)*height*r+slant*dx
                angle = a+dx/.10
                row.append(builder.v(self.face_point(angle,zz)+self.face_normal(angle,zz)*(lift+bulge*(1-r*r))))
            rows.append(row)
        for i in range(40): builder.face((center,rows[0][i],rows[0][(i+1)%40]))
        builder.grid(rows,closed=True)
        return builder.obj(outward=V(0,-.006,1.18))

    def face_control(self,obj,name,parent=None,a=0,z=1.2,budget=150):
        self.put(obj,budget=budget,region="live centred face control "+name)
        points = [v.co.copy() for v in obj.data.vertices]
        lo = V(*(min(p[k] for p in points) for k in range(3)))
        hi = V(*(max(p[k] for p in points) for k in range(3)))
        center,size = (lo+hi)/2,hi-lo
        normal = self.face_normal(a,z)
        up = V(0,0,1); right = normal.cross(up).normalized(); up = right.cross(normal).normalized()
        axes = parent.matrix_world.to_3x3() if parent else Matrix((right,normal,up)).transposed()
        frame = Matrix.Translation(center)@axes.to_4x4()
        obj.data.transform(frame.inverted()); obj.name = self.r+name
        geo.uv_box(obj)
        if parent: obj.parent = parent
        else: obj.parent,obj.parent_type,obj.parent_bone = self.rig,"BONE",self.r+".head"
        obj.matrix_world = frame
        obj["faceWidth"],obj["faceHeight"] = size.x,size.z
        return obj

    def face(self):
        for s,side in ((-1,"L"),(1,"R")):
            a,z = s*math.radians(25),1.209
            eye = self.face_control(self.patch(self.r+".eye-form-"+side,a,z,.022,.0085,self.eye,
                                                slant=s*.035),"eye"+side,a=a,z=z,budget=220)
            pupil = kit.join([self.patch(self.r+".iris-form-"+side,a-s*.016,z-.0005,.0075,.0075,self.iris,.004),
                              self.patch(self.r+".pupil-form-"+side,a-s*.016,z-.0005,.0038,.0055,self.ink,.005),
                              self.patch(self.r+".eye-glint-"+side,a-.025,z+.0027,.0016,.0016,self.eye,.006)],
                             self.r+".pupil-form-"+side)
            self.face_control(pupil,"pupil"+side,eye,a,z,120)
            brow = [self.face_point(s*math.radians(angle),1.226+.013*(angle-9)/33)+
                    self.face_normal(s*math.radians(angle),1.23)*.004
                    for angle in np.linspace(9,42,32)]
            self.face_control(geo.tube(self.r+".brow-form-"+side,brow,
                                      [(.0045*(1-.4*j/31),.0025) for j in range(32)],self.hair,n=10,up=(0,1,0)),
                              "brow"+side,a=a,z=1.236,budget=160)
            for upper in (True,False):
                path = []
                for t in np.linspace(-1,1,30):
                    aa=a+t*.22; zz=z+(.008 if upper else -.008)*math.sqrt(max(0,1-t*t))+s*.001*t
                    path.append(self.face_point(aa,zz)+self.face_normal(aa,zz)*.0032)
                self.put(geo.tube(self.r+f".rolled-lid-{side}-{upper}",path,[.002]*30,self.skin,n=8,up=(0,1,0)),
                         "head",100,"fleshy rolled eyelid")
            self.put(self.patch(self.r+".nostril-"+side,s*.13,1.158,.0029,.0016,self.ink,.0005,0),
                     "head",40,"nose underside")
        # Mouth is one live control, with tapered dark aperture, lips and
        # restrained teeth or effort tongue; no smile to the camera.
        parts = [self.patch(self.r+".mouth-aperture",0,1.129,.022,.0034,self.ink,.0015,.001)]
        if not self.elderly:
            parts.append(self.patch(self.r+".gritted-teeth",0,1.1305,.017,.0022,self.eye,.003,.0003))
        for upper in (True,False):
            path = [self.face_point(float(a),1.129+(1 if upper else -1)*.008*(1-(float(a)/.29)**2))+
                    self.face_normal(float(a),1.13)*.003 for a in np.linspace(-.29,.29,44)]
            # Lips keep their own colour on the head; joined into the live
            # control they took the aperture's ink and read as black lips.
            self.put(geo.tube(self.r+f".formed-lip-{upper}",path,[.0017]*44,self.lip,n=8,up=(0,1,0)),
                     "head",120,"formed lip")
        self.face_control(kit.join(parts,self.r+".mouth-form"),"mouth",z=1.129,budget=300)
        self.rig["faceContract"] = self.r+"eyeL/R -> pupilL/R; browL/R; mouth; surface-centred axes"

    def tailoring(self,jacket):
        for side in ("L","R"):
            s = -1 if side=="L" else 1
            line = [self.trunk_point(s*.42,float(z))+V(0,.002,0) for z in np.linspace(.63,.96,46)]
            obj = geo.tube(self.r+".harness-strap-"+side,line,[(.010,.0027)]*46,self.glove,n=8,up=(1,0,0))
            self.follow(obj,jacket,160,"tensioned shoulder harness")
        seam = [self.trunk_point(0,float(z))+V(0,.002,0) for z in np.linspace(.57,.974,58)]
        self.follow(geo.tube(self.r+".jacket-front-seam",seam,[.0018]*58,self.glove,n=8,up=(1,0,0)),
                    jacket,140,"tailored front opening")
        for z in (.76,.835,.914):
            at = self.trunk_point(.08,z)+V(0,.004,0)
            self.follow(geo.ball(self.r+".jacket-button-"+str(z),.0048,at,self.brass,
                                  scale=(1,.40,1),seg=14,rings=8),jacket,40,"brass fastening")
        # Collar uses a compact continuous roll, with restrained shearling
        # ridges built into the surface instead of a necklace of spheres.
        rows = []
        for t in np.linspace(0,TAU,100,endpoint=False):
            p = V(math.sin(t)*.064,math.cos(t)*.057-.004,1.006+.009*math.cos(t))
            outward = V(math.sin(t),math.cos(t),0)
            rows.append([p+outward*math.cos(a)*(.012+.0015*math.cos(t*30))+V(0,0,math.sin(a)*.013)
                         for a in np.linspace(0,TAU,18,endpoint=False)])
        rows.append(rows[0])
        self.put(geo.loft(self.r+".shearling-collar",rows,self.cream),"neck",650,"rolled connected shearling collar")

    def headwear(self):
        if self.elderly:
            # Connected swept white hair cap with carved comb channels and
            # broad locks. Tips share a substantial base; no ball hairdo.
            def hair_point(a,t):
                z = 1.25+t*.084
                p = self.face_point(a,z)
                p += V(math.sin(a),math.cos(a),0)*(.008+.002*math.cos(a*22+t*4))
                return p
            rows = [[hair_point(a,float(t)) for a in np.linspace(0,TAU,96,endpoint=False)]
                    for t in np.linspace(0,.94,28)]
            pieces = [geo.loft(self.r+".swept-hair-cap",rows,self.hair,start=None,end="pole")]
            for i in range(0):
                a=-1.35+i*.30
                path=curve([self.face_point(a,1.263)+V(0,.005,.018),
                            self.face_point(a+.20,1.245)+V(0,.012,.008),
                            self.face_point(a+.42,1.227)+V(0,.008,0)],8)
                pieces.append(geo.tube(self.r+f".white-fringe-{i}",path,
                    [(.012*(1-.72*j/(len(path)-1)),.0055*(1-.7*j/(len(path)-1))) for j in range(len(path))],
                    self.hair,n=12,up=(0,1,0)))
            self.put(kit.join(pieces,self.r+".swept-white-hair"),"head",1200,"swept cap and nine broad combed locks")
            rows=[]
            for t in np.linspace(.02,.98,35):
                z=1.242+float(t)*.09
                radius=.046*math.sin(math.pi*float(t))**.65
                rows.append([V(math.cos(a)*radius,-.098+math.sin(a)*radius*.79,z)+
                             V(math.cos(a),math.sin(a),0)*(.0019*math.cos(a*17+t*4))
                             for a in np.linspace(0,TAU,64,endpoint=False)])
            self.put(geo.loft(self.r+".combed-bun",rows,self.hair,start="pole",end="pole"),
                     "hair",750,"pinned bun with carved directional strands")
        else:
            rows=[]
            for t in np.linspace(0,.98,42):
                row=[]
                for a in np.linspace(0,TAU,88,endpoint=False):
                    base=1.251-.074*(1-math.cos(a))*.5
                    z=base+(1.336-base)*float(t)
                    p=self.face_point(a,min(z,1.326))
                    p+=V(math.sin(a),math.cos(a),0)*(.009+.0008*math.cos(a*16))
                    row.append(p+V(0,0,max(0,z-1.326)))
                rows.append(row)
            self.put(geo.loft(self.r+".stitched-leather-flight-cap",rows,self.glove,end="pole"),
                     "hat",1000,"fitted leather helmet with brow band and lower nape")
            for s in (-1,1):
                at=V(s*.108,-.009,1.185)
                self.put(geo.ball(self.r+f".leather-ear-cover-{s}",1,at,self.glove,
                                 scale=(.019,.023,.037),seg=36,rings=20),"hat",250,"soft padded ear flap")
                path=[V(s*.106,.010,1.163),V(s*.072,.056,1.071),V(s*.031,.041,1.053)]
                self.put(geo.tube(self.r+f".chinstrap-{s}",curve(path,12),[(.005,.002)]*25,
                                  self.glove,n=8,up=(1,0,0)),"head",100,"chin strap follows jaw")
        for s in (-1,1):
            at=V(s*.046,.074,1.274)
            path=[at+V(math.cos(a)*.033,0,math.sin(a)*.029) for a in np.linspace(0,TAU,65)]
            self.put(geo.tube(self.r+f".goggle-brass-frame-{s}",path,[(.0038,.004)]*65,
                              self.brass,n=10,up=(0,1,0),caps=(None,None)),"hat",360,"round machined brass goggles")
            lens=geo.ball(self.r+f".goggle-lens-{s}",1,at,self.lens,scale=(.029,.004,.025),seg=40,rings=20)
            self.put(lens,"hat",170,"blue grey inset optical glass")
        self.put(geo.tube(self.r+".goggle-bridge",[V(-.014,.075,1.274),V(.014,.075,1.274)],
                          [.0035,.0035],self.brass,n=10,up=(0,1,0)),"hat",40,"goggle bridge")

    def scarf(self):
        for index,(length,width,dy) in enumerate(((.51,.071,0),(.37,.055,.018))):
            def fn(u,t,index=index,length=length,width=width,dy=dy):
                x=(u-.5)*width*(1-.28*t)+.035*t**1.4
                y=-.049-length*t
                z=1.015+.035*math.sin(t*math.pi)+.016*math.sin(t*9+index)+.012*math.sin(u*math.pi*2+t*8)*t
                return V(x,y,z+dy)
            obj=geo.sheet(self.r+f".silk-scarf-{index}",fn,np.linspace(0,1,12),np.linspace(0,1,52),self.silk,
                          rim=.0013,back=True,inside=V(0,-.30,1.00))
            self.put(obj,"cape" if index==0 else "cape2",430,"streaming silk with rolled edges")
            kit.drape(obj,free=lambda co: max(0,min(1,(-float((self.inverse@co).y)-.049)/length)))

    def seated_legs(self):
        for s,side in ((-1,"L"),(1,"R")):
            hip,knee,foot = [self.pivots[n+side] for n in ("leg","knee","foot")]
            path = curve([hip+V(0,0,.035),hip,knee,foot],12)
            obj=geo.tube(self.r+".tucked-breeches-"+side,path,
                          [(.043*(1-.28*j/(len(path)-1)),.041*(1-.35*j/(len(path)-1)))
                           for j in range(len(path))],self.glove,n=28,up=(1,0,0))
            P=np.array([v.co[:] for v in obj.data.vertices])
            along=np.clip((P-np.array(hip))@np.array(knee-hip)/(knee-hip).length_squared,0,2)
            knee_share=smooth(.82,1.18,along)
            self.put(obj,budget=480,region="tucked seated thighs, knee and shin inside cockpit")
            weights(obj,self.rig,{"leg"+side:1-knee_share,"knee"+side:knee_share})
            self.put(geo.ball(self.r+".seated-boot-"+side,1,foot+V(0,.016,-.009),self.glove,
                             scale=(.031,.048,.025),seg=28,rings=18),"foot"+side,160,"hidden fitted leather shoe")

    def build(self):
        jacket=self.jacket_skin()
        self.hands(); self.head_skin(); self.face(); self.tailoring(jacket)
        self.headwear(); self.scarf(); self.seated_legs()
        return jacket


def runtime_quat(rx,ry,rz):
    return Quaternion((1,0,0),rx)@Quaternion((0,0,1),ry)@Quaternion((0,1,0),-rz)


def reset_pose(root,values=None):
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    for bone in rig.pose.bones:
        bone.rotation_mode="QUATERNION";bone.location=(0,0,0);bone.scale=(1,1,1)
        value=(values or {}).get(bone.name.split(".",1)[1],(0,0,0))
        frame=bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion=frame.inverted()@runtime_quat(*value[:3])@frame
        if len(value)>3:bone.location=frame.inverted()@V(0,0,value[3])
    kit.refresh()
