"""Private diagnostic adapter for the Beekeeper's actual analytic source.

Runs with Blender's standalone Python/NumPy, without starting Blender or Metal.
It evaluates the authored functions rather than substituting a new figure.
Explicit limitations: no voxel Boolean sewing, modifier validation, AO bake or
Blender subdivision. Those stages must be reviewed outside the blocked sandbox.
The dev GLB is diagnostic and is never a replacement for the frozen runtime.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys
import types

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


class Vector:
    def __init__(self, value=(0, 0, 0)):
        self.a = [float(x) for x in (value.a if isinstance(value, Vector) else value)]

    def __iter__(self): return iter(self.a)
    def __len__(self): return len(self.a)
    def __getitem__(self, i): return self.a[i]
    def __setitem__(self, i, v): self.a[i] = v
    def __add__(self, other): return Vector([a+b for a,b in zip(self.a,other)])
    def __radd__(self, other): return self if other == 0 else self + other
    def __sub__(self, other): return Vector([a-b for a,b in zip(self.a,other)])
    def __neg__(self): return Vector([-a for a in self.a])
    def __mul__(self, value): return Vector([a*value for a in self.a])
    def __rmul__(self, value): return self * value
    def __truediv__(self, value): return Vector([a/value for a in self.a])
    @property
    def x(self): return self.a[0]
    @x.setter
    def x(self, v): self.a[0] = v
    @property
    def y(self): return self.a[1]
    @y.setter
    def y(self, v): self.a[1] = v
    @property
    def z(self): return self.a[2]
    @z.setter
    def z(self, v): self.a[2] = v
    @property
    def length(self): return math.sqrt(sum(a*a for a in self.a))
    def normalized(self): return self/max(self.length, 1e-15)
    def normalize(self): self.a[:] = self.normalized().a
    def dot(self, other): return sum(a*b for a,b in zip(self.a,other))
    def cross(self, other):
        a,b,c=self.a;d,e,f=other;return Vector((b*f-c*e,c*d-a*f,a*e-b*d))
    def copy(self): return Vector(self.a)
    def orthogonal(self):
        axis=[0,0,0];axis[min(range(3),key=lambda i:abs(self.a[i]))]=1
        return self.cross(axis).normalized()


class Modifier:
    def __init__(self, name, kind): self.name, self.type = name, kind


class Modifiers:
    def new(self, name, kind): return Modifier(name, kind)


class Mesh:
    def __init__(self, name, mat=None):
        self.name, self.mat = name, mat
        self.points, self.faces = [], []
        self.weights, self.part, self.parent = None, None, None
        self.modifiers = Modifiers()
        self.props = {}

    @property
    def data(self):
        return types.SimpleNamespace(vertices=[types.SimpleNamespace(co=p) for p in self.points])

    def __setitem__(self, key, value): self.props[key] = value
    def __getitem__(self, key): return self.props[key]
    def v(self, p): self.points.append(Vector(p)); return len(self.points)-1
    def face(self, vertices, mat=None): self.faces.append((list(vertices), mat or self.mat))
    def grid(self, rows, mat=None, closed=False, flip=False):
        for j in range(len(rows)-1):
            a, b = rows[j], rows[j+1]
            for i in range(len(a) if closed else len(a)-1):
                k = (i+1) % len(a)
                vs = [a[i], a[k], b[k], b[i]]
                self.face(vs[::-1] if flip else vs, mat(i,j) if callable(mat) else mat)
    def obj(self, levels=0, recalc=False, outward=None, inward=None):
        # The source's fitted eye/lip patches have a centre followed by
        # five forty-point concentric rings. Preserve the same surface
        # samples while reducing only the private diagnostic copy.
        if MODE=="runtime" and len(self.points)==201 and len(self.faces)==200:
            ii=np.linspace(0,39,16,endpoint=False).round().astype(int)
            jj=(0,2,4);old=self.points;self.points=[old[0]]
            self.faces=[];rows=[]
            for j in jj:
                rows.append([self.v(old[1+j*40+i]) for i in ii])
            for i in range(len(ii)):self.face([0,rows[0][i],rows[0][(i+1)%len(ii)]])
            self.grid(rows,closed=True)
        if outward is not None or inward is not None:
            ref = np.asarray(list(outward if outward is not None else inward))
            pts = np.asarray([list(p) for p in self.points])
            score = sum(np.dot(pts[f].mean(axis=0)-ref,
                np.cross(pts[f[1]]-pts[f[0]],pts[f[2]]-pts[f[0]])) for f,_ in self.faces)
            if (score < 0) == (outward is not None): self.faces = [(f[::-1],m) for f,m in self.faces]
        REGISTRY.append(self)
        return self
    def triangles(self):
        return [(f[0], f[j], f[j+1], m) for f,m in self.faces for j in range(1,len(f)-1)]
    def normals(self):
        pts=np.asarray([list(p) for p in self.points]); normals=np.zeros_like(pts)
        ts=self.triangles()
        if ts:
            idx=np.asarray([t[:3] for t in ts]); area=np.cross(pts[idx[:,1]]-pts[idx[:,0]],pts[idx[:,2]]-pts[idx[:,0]])
            for i in range(3): np.add.at(normals,idx[:,i],area)
        return normals/np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)


REGISTRY=[]
HEX={}
MODE="runtime"


def smooth_path(points, samples=24):
    pts=[Vector(p) for p in points]; out=[]
    for i in range(len(pts)-1):
        p0=pts[max(0,i-1)];p1,p2=pts[i:i+2];p3=pts[min(len(pts)-1,i+2)]
        for j in range(samples):
            t=j/samples
            # Match real kit.smooth_path's tuple return contract. The
            # source must explicitly wrap these before doing vector maths.
            out.append(tuple(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3)))
    return out+[tuple(pts[-1])]


def target(name):
    if MODE=="source": return 16000 if any(x in name for x in ("adult-face","blouse-panel","sleeve-panel")) else 6500
    tests=[("adult-face",3400),("neck-source",500),("blouse-panel",2700),("sleeve-panel",1750),
           ("glove-palm",800),("glove-digit",130),("glove-thumb",190),("finger-seam",28),
           ("trouser",560),("boot-foot",280),("boot-shaft",260),("boot-welt",56),("boot-lace",12),
           ("apron-skirt",2500),("apron-bib",620),("apron-strap",150),("apron-waist",350),
           ("apron-pocket",300),("pocket-stitch",80),("swept-hair",1250),("braided-bun",440),
           ("bun-lock",60),("silver-sweep",48),("straw-hat",1500),("hat-band",140),("hat-edge",160),
           ("veil-warp",12),("veil-weft",18),("hive-blue-roof",20),("hive-roof-fascia",24),
           ("hive-nail",16),("hive-",40),("harness-buckle",40),("hive-harness",170),
           ("blouse-collar",140),("blouse-button",30),("smoker-can",320),("smoker-nozzle",480),
           ("nozzle-inner",48),("smoker-guard-ring",95),("smoker-guard",16),("smoker-bail",220),
           ("smoker-bellows",40),("ear-",210),("lid-",70),("nostril",32),("lip",64),
           ("eye",140),("iris",80),("pupil",50),("shine",24),("brow",64),("mouth",64)]
    return next((value for key,value in tests if key in name),80)


def sampled_indices(m,n,budget,closed):
    # Re-sample the analytic ring grid. Does not pretend to retopologize or
    # reproduce Blender's decimated normals; all sampled vertices are authored.
    ratio=min(1,math.sqrt(max(1,budget*(.80 if MODE=="runtime" else 1))/(2*max(1,m-1)*(n if closed else n-1))))
    mm=max(2,min(m,round(m*ratio))); nn=max(4,min(n,round(n*ratio)))
    return np.unique(np.linspace(0,m-1,mm).round().astype(int)),np.unique(np.linspace(0,n-1,nn,endpoint=True).round().astype(int))


def loft(name,rings,mat,bands=None,start=None,end=None,closed=True,levels=0,creases=(),recalc=True):
    jx,ix=sampled_indices(len(rings),len(rings[0]),target(name),closed)
    rings=[[Vector(rings[j][i]) for i in ix] for j in jx]
    mesh=Mesh(name,mat); vs=[[mesh.v(p) for p in row] for row in rings]
    def band(i,j):
        if callable(bands): return bands(int(ix[min(i,len(ix)-1)]),int(jx[min(j,len(jx)-1)])) if isinstance(j,int) else mat
        return bands.get(int(jx[min(j,len(jx)-1)]),mat) if bands and isinstance(j,int) else mat
    mesh.grid(vs,band,closed)
    for cap,ring,pts,last in ((start,vs[0],rings[0],False),(end,vs[-1],rings[-1],True)):
        if cap is None: continue
        if isinstance(cap,str) and cap=="flat": mesh.face(ring if last else ring[::-1],mat)
        else:
            center=sum(pts,Vector())/len(pts) if isinstance(cap,str) else Vector(cap)
            ci=mesh.v(center)
            for i in range(len(ring)):
                f=[ci,ring[i],ring[(i+1)%len(ring)]]
                mesh.face(f if last else f[::-1],mat)
    # Closed lofts are oriented using signed volume, mirroring bmesh recalc.
    if start is not None and end is not None:
        pts=np.asarray([list(p) for p in mesh.points]); volume=sum(np.dot(pts[a],np.cross(pts[b],pts[c])) for a,b,c,_ in mesh.triangles())
        if volume<0:mesh.faces=[(f[::-1],m) for f,m in mesh.faces]
    else:
        # Most open rings point outward from the ring's centreline.
        pts=np.asarray([list(p) for p in mesh.points]); center=pts.mean(axis=0)
        score=sum(np.dot(pts[f].mean(axis=0)-center,np.cross(pts[f[1]]-pts[f[0]],pts[f[2]]-pts[f[0]])) for f,_ in mesh.faces)
        if score<0:mesh.faces=[(f[::-1],m) for f,m in mesh.faces]
    return mesh.obj()


def frame_at(t,up):
    t=Vector(t).normalized();up=Vector(up);u=up-t*up.dot(t)
    if u.length<1e-6:u=t.orthogonal()
    u.normalize();return u,t.cross(u)


def rings_along(path,radii,n=8,up=(0,0,1),power=2,phase=0,flute=0):
    path=[Vector(p) for p in path];rings=[]
    for i,p in enumerate(path):
        u,v=frame_at(path[min(len(path)-1,i+1)]-path[max(0,i-1)],up)
        r=radii[i];rx,ry=(r,r) if not isinstance(r,(list,tuple)) else r
        rings.append([p+(u*(rx*math.copysign(abs(math.cos(phase+k/n*math.tau))**(2/power),math.cos(phase+k/n*math.tau)))+
                         v*(ry*math.copysign(abs(math.sin(phase+k/n*math.tau))**(2/power),math.sin(phase+k/n*math.tau))))*
                         (1-flute if flute and k%2 else 1) for k in range(n)])
    return rings


def tube(name,path,radii,mat,n=8,up=(0,0,1),power=2,caps=("dome","dome"),bands=None,phase=0,levels=0,flute=0):
    path=[Vector(p) for p in path];radii=list(radii)
    rings=rings_along(path,radii,n,up,power,phase,flute);s,e=caps
    if s=="dome":
        d=(path[0]-path[1]).normalized();r=radii[0];r=min(r) if isinstance(r,(list,tuple)) else r
        rings.insert(0,[path[0]+(p-path[0])*.6+d*r*.55 for p in rings[0]]);s=path[0]+d*r*.8
    if e=="dome":
        d=(path[-1]-path[-2]).normalized();r=radii[-1];r=min(r) if isinstance(r,(list,tuple)) else r
        rings.append([path[-1]+(p-path[-1])*.6+d*r*.55 for p in rings[-1]]);e=path[-1]+d*r*.8
    return loft(name,rings,mat,bands,s,e,levels=levels)


def ball(name,r,at,mat,scale=(1,1,1),seg=10,rings=None):
    out=[];s=np.asarray(scale);at=Vector(at)
    for phi in np.linspace(-math.pi/2+.0001,math.pi/2-.0001,rings or max(4,seg//2)):
        out.append([at+Vector(s*r*np.array([math.cos(phi)*math.sin(i/seg*math.tau),math.cos(phi)*math.cos(i/seg*math.tau),math.sin(phi)])) for i in range(seg)])
    return loft(name,out,mat,start=at+Vector((0,0,-r*scale[2])),end=at+Vector((0,0,r*scale[2])))


def rbox(name,size,at,mat,levels=2,crease=0,matrix=None):
    # Bounded rounded box is only a CPU stand-in for the source's Blender
    # crease/subdivision modifier. That modifier remains an external gate.
    mesh=Mesh(name,mat);sz=np.asarray(size);at=np.asarray(list(at));radius=min(sz)*.5*(1-crease)*.65
    half=sz*.5;inner=np.maximum(0,half-radius);n=2 if MODE=="runtime" else 4
    for axis in range(3):
        for sign in (-1,1):
            rows=[];other=[a for a in range(3) if a!=axis]
            for u in np.linspace(-1,1,n+1):
                row=[]
                for v in np.linspace(-1,1,n+1):
                    p=np.zeros(3);p[axis]=sign*half[axis];p[other[0]]=u*half[other[0]];p[other[1]]=v*half[other[1]]
                    nearest=np.clip(p,-inner,inner);d=p-nearest
                    p=nearest+d*radius/max(np.linalg.norm(d),1e-15)
                    row.append(mesh.v(p+at))
                rows.append(row)
            mesh.grid(rows,mat,flip=((axis==1)!=(sign>0)))
    return mesh.obj()


def sheet(name,fn,us,vs,mat,rim=0,inside=None,closed_u=False,back=False,rim_mat=None,rim_edges=("u0","u1","v0","v1")):
    jx,ix=sampled_indices(len(vs),len(us),target(name),closed_u)
    mesh=Mesh(name,mat);rows=[[mesh.v(fn(us[i],vs[j])) for i in ix] for j in jx]
    mesh.grid(rows,mat,closed_u)
    return mesh.obj(outward=inside)


def join(meshes,name):
    out=Mesh(name)
    for mesh in meshes:
        off=len(out.points);out.points.extend(mesh.points);out.faces.extend(([i+off for i in f],m) for f,m in mesh.faces)
        REGISTRY.remove(mesh)
    REGISTRY.append(out);return out


def install():
    sys.modules["bpy"]=types.ModuleType("bpy")
    sys.modules["bmesh"]=types.ModuleType("bmesh")
    mathutils=types.ModuleType("mathutils");mathutils.Vector=Vector;mathutils.Matrix=object
    sys.modules["mathutils"]=mathutils
    kit=types.ModuleType("kit")
    def tint(name,h):HEX[name]=h;return name
    kit.tint=tint;kit.smooth_path=smooth_path;kit.join=join
    kit.apply=lambda o:o;kit.apply_transform=lambda o:o;kit.assign=lambda o,m:None;kit.shade=lambda o,a:None
    kit.refresh=lambda:None;kit.empty=lambda name:{};kit.descendants=lambda root:REGISTRY
    sys.modules["kit"]=kit
    fk=types.ModuleType("figure_folk_kit")
    for name,fn in (("Mesh",Mesh),("loft",loft),("rings_along",rings_along),("tube",tube),("ball",ball),("rbox",rbox),("sheet",sheet)):
        setattr(fk,name,fn)
    sys.modules["figure_folk_kit"]=fk


def build(mode="runtime"):
    global MODE
    MODE=mode;REGISTRY.clear();HEX.clear();install()
    source_hash=hashlib.sha256((HERE/"figure_beekeeper_sculpt.py").read_bytes()).hexdigest()
    spec=importlib.util.spec_from_file_location("beekeeper_cpu_actual_source",HERE/"figure_beekeeper_sculpt.py")
    source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
    pivots={};parents={};faces={};face_axes={}
    def make_rig(root,grip,board):
        pivots.update({"torso":source.WAIST,"chest":source.CHEST,"head":source.NECK,
            "hair":Vector((0,-.028,1.240)),"hat":Vector((0,-.006,1.245)),"cape":Vector((0,-.016,1.238)),
            "extra":Vector((0,-.128,.915)),"weapon":grip,"extra2":board+Vector((0,0,-.052)),
            "skirtL":Vector((-.060,0,.686)),"skirtR":Vector((.060,0,.686))})
        parents.update({"chest":"torso","head":"chest","hair":"head","hat":"head","cape":"hat",
            "extra":"chest","weapon":"handR","extra2":"weapon","skirtL":"torso","skirtR":"torso"})
        for s,suf in ((-1,"L"),(1,"R")):
            for name,p,parent in [("clav",Vector((s*.030,-.004,.969)),"chest"),("arm",source.SH[s],"clav"+suf),
                ("fore",source.EL[s],"arm"+suf),("hand",source.WR[s],"fore"+suf),("leg",source.HIP[s],None),
                ("knee",source.KNEE[s],"leg"+suf),("foot",source.ANKLE[s],"knee"+suf)]:
                pivots[name+suf]=p;parents[name+suf]=parent
        for name in pivots:parents.setdefault(name,None)
        return {}
    def weights(mesh,rig,values):
        names=list(values);a=np.stack([np.asarray(values[name])+np.zeros(len(mesh.points)) for name in names],axis=1);a=np.clip(a,0,1)
        if len(names)>4:np.put_along_axis(a,np.argsort(a,axis=1)[:,:-4],0,axis=1)
        a/=np.maximum(a.sum(axis=1,keepdims=True),1e-12)
        mesh.weights=(names,a)
    def attach(mesh,rig,part):mesh.part=part;return mesh
    def attach_faces(features,rig):
        for name,mesh in features.items():
            pp=np.asarray([list(p) for p in mesh.points]);center=(pp.min(axis=0)+pp.max(axis=0))*.5
            node="beekeeper"+name;pivots[node]=Vector(center)
            parents[node]="beekeeper"+"eye"+name[-1] if name.startswith("pupil") else "head"
            mesh.part=node;faces[node]={"faceWidth":float(np.ptp(pp[:,0])),"faceHeight":float(np.ptp(pp[:,2]))}
            if name.startswith("pupil"):
                face_axes[node]=face_axes["beekeeper"+"eye"+name[-1]]
            else:
                normal=Vector((center[0]*3,1,0)).normalized();right=normal.cross(Vector((0,0,1))).normalized()
                face_axes[node]=np.stack((list(right),list(normal),(0,0,1)),axis=1)
    source.make_rig=make_rig;source.weights=weights;source.attach=attach;source.attach_faces=attach_faces
    source.union=lambda pieces,name,mat,voxel=.0023:join(pieces,name)
    source.pigment=lambda root:None
    source.build_master()
    return types.SimpleNamespace(meshes=list(REGISTRY),pivots=pivots,parents=parents,faces=faces,face_axes=face_axes,source_hash=source_hash,source_module=source,
        palette={mat:(mat,HEX.get(mat.split(":",1)[-1],"#2f66af" if mat.endswith(":team") else "#739ac6"),
        .78 if mat.startswith(("weave:","skin:","hair:","beech:")) else .40,
        .75 if mat.startswith(("gilt:","tin:")) else 0) for mesh in REGISTRY for _,mat in mesh.faces})


def rotation(rx=0,ry=0,rz=0):
    sx,cx=math.sin(rx),math.cos(rx);sy,cy=math.sin(ry),math.cos(ry);sz,cz=math.sin(rz),math.cos(rz)
    x=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]]);y=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]]);z=np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
    b=np.array([[1,0,0],[0,0,-1],[0,1,0]])
    return b@(x@y@z)@b.T


def surfaces(forms,pose=None):
    pose=pose or {};frames={}
    def frame(name):
        if name in frames:return frames[name]
        anchor=np.asarray(list(forms.pivots[name]));parent=forms.parents[name];r=rotation(*pose.get(name,(0,0,0)))
        if parent:
            pr,pt=frame(parent);position=pr@(anchor-np.asarray(list(forms.pivots[parent])))+pt;r=pr@r
        else:position=anchor
        frames[name]=r,position;return r,position
    for name in forms.pivots:frame(name)
    out=[]
    for mesh in forms.meshes:
        pts=np.asarray([list(p) for p in mesh.points]);ns=mesh.normals()
        if mesh.weights:
            names,a=mesh.weights;pp=np.zeros_like(pts);nn=np.zeros_like(ns)
            for i,name in enumerate(names):
                r,p=frames[name];pp+=((pts-np.asarray(list(forms.pivots[name])))@r.T+p)*a[:,i,None];nn+=(ns@r.T)*a[:,i,None]
            pts,ns=pp,nn
        elif mesh.part:
            r,p=frames[mesh.part];pts=(pts-np.asarray(list(forms.pivots[mesh.part])))@r.T+p;ns=ns@r.T
        out.append({"points":pts,"normals":ns,"faces":[(list(t[:3]),t[3]) for t in mesh.triangles()],"name":mesh.name})
    return out


def metrics(forms):
    points=np.vstack([np.asarray([list(p) for p in m.points]) for m in forms.meshes]);lo,hi=points.min(axis=0),points.max(axis=0)
    extrema={}
    for axis,name in enumerate(("x","y","z")):
        parts=[(m.name,np.asarray([list(p) for p in m.points])) for m in forms.meshes]
        low=min(parts,key=lambda p:p[1][:,axis].min());high=max(parts,key=lambda p:p[1][:,axis].max())
        extrema[name]={"minimumMesh":low[0],"maximumMesh":high[0]}
    return {"triangles":sum(len(m.triangles()) for m in forms.meshes),"meshes":len(forms.meshes),"sourceSHA256":forms.source_hash,"extrema":extrema,
        "min":lo.tolist(),"max":hi.tolist(),"blenderSize":(hi-lo).tolist(),"diagnosticCPUExport":True,
        "source":str(HERE/"figure_beekeeper_sculpt.py"),"limits":["No Blender voxel Boolean shoulder/neck sewing", "No actual Blender subdivision/modifier validation", "No baked AO or game lighting"]}


def export(forms,path):
    def yup(p):return [p[0],p[2],-p[1]]
    def linear(h):
        vals=[int(h[i:i+2],16)/255 for i in (1,3,5)]
        return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals]
    doc={"asset":{"version":"2.0","generator":"Private Beekeeper CPU analytic-source diagnostic"},"scene":0,"scenes":[{"nodes":[0]}],
        "nodes":[{"name":"beekeeper","children":[],"extras":{"diagnosticCPUExport":True,"sourceBooleanFusionPending":True,"reviewPendingExternalRenderer":True}}],
        "meshes":[],"materials":[],"accessors":[],"bufferViews":[],"skins":[]};binary=bytearray();nodes={}
    def attr(values,width,kind=5126,bounds=False,target=34962,typ=None):
        while len(binary)%4:binary.append(0)
        ar=np.asarray(values,dtype={5126:"<f4",5123:"<u2",5125:"<u4"}[kind]);raw=ar.tobytes();offset=len(binary);binary.extend(raw)
        view=len(doc["bufferViews"]);doc["bufferViews"].append({"buffer":0,"byteOffset":offset,"byteLength":len(raw),"target":target})
        accessor={"bufferView":view,"componentType":kind,"count":len(values),"type":typ or {1:"SCALAR",3:"VEC3",4:"VEC4",16:"MAT4"}[width]}
        if bounds:accessor.update(min=ar.min(axis=0).tolist(),max=ar.max(axis=0).tolist())
        index=len(doc["accessors"]);doc["accessors"].append(accessor);return index
    def node(name):
        if name in nodes:return nodes[name]
        parent=forms.parents[name];pi=node(parent) if parent else 0;p=np.asarray(list(forms.pivots[name]));par=np.asarray(list(forms.pivots[parent])) if parent else np.zeros(3)
        index=len(doc["nodes"]);nodes[name]=index
        axes=forms.face_axes.get(name,np.eye(3));parent_axes=forms.face_axes.get(parent,np.eye(3))
        translation=parent_axes.T@(p-par);r=parent_axes.T@axes;theta=math.atan2(r[1,0],r[0,0])
        doc["nodes"].append({"name":name if name.startswith("beekeeper") else "beekeeper."+name,"translation":yup(translation),
            "rotation":[0,math.sin(theta/2),0,math.cos(theta/2)],"children":[],"extras":forms.faces.get(name,{})})
        doc["nodes"][pi]["children"].append(index);return index
    for name in forms.pivots:node(name)
    joints=[name for name in forms.pivots if not name.startswith("beekeeper")];joint_ix={name:i for i,name in enumerate(joints)}
    ibm=[]
    for name in joints:
        matrix=np.eye(4);matrix[:3,3]=-np.asarray(yup(forms.pivots[name]));ibm.append(matrix.T.reshape(-1))
    doc["skins"].append({"name":"beekeeper-diagnostic-anatomical-skin","joints":[nodes[name] for name in joints],"inverseBindMatrices":attr(ibm,16,typ="MAT4")})
    mats={}
    for key,(name,h,rough,metal) in forms.palette.items():
        mats[key]=len(doc["materials"]);doc["materials"].append({"name":name,"pbrMetallicRoughness":{"baseColorFactor":linear(h)+[1],"roughnessFactor":rough,"metallicFactor":metal},"extras":{"hex":h}})
    for mesh in forms.meshes:
        pts=np.asarray([list(p) for p in mesh.points]);ns=mesh.normals();primitives=[]
        for material in dict.fromkeys(m for _,m in mesh.faces):
            indices=[list(t[:3]) for t in mesh.triangles() if t[3]==material]
            if not indices:continue
            used=np.unique(indices);remap={int(v):i for i,v in enumerate(used)};idx=[remap[v] for t in indices for v in t]
            local=pts[used]
            normal=ns[used]
            if not mesh.weights:
                axes=forms.face_axes.get(mesh.part,np.eye(3));local=(local-np.asarray(list(forms.pivots[mesh.part])))@axes;normal=normal@axes
            rgba=np.ones((len(used),4))
            if mesh.name=="beekeeper.head-skin":
                original=pts[used];rosy=np.exp(-((abs(original[:,0])-.061)/.022)**2)*np.exp(-((original[:,2]-1.129)/.017)**2)*(original[:,1]>.024)
                rgba[:,1]-=.16*rosy;rgba[:,2]-=.15*rosy
            attrs={"POSITION":attr([yup(p) for p in local],3,bounds=True),"NORMAL":attr([yup(n) for n in normal],3),"COLOR_0":attr(rgba,4)}
            if mesh.weights:
                names,a=mesh.weights;rank=np.argsort(a,axis=1)[:,-4:][:,::-1];ww=np.take_along_axis(a,rank,axis=1);jj=np.vectorize(lambda i:joint_ix[names[i]])(rank)
                while rank.shape[1]<4:jj=np.pad(jj,((0,0),(0,1)));ww=np.pad(ww,((0,0),(0,1)));rank=np.pad(rank,((0,0),(0,1)))
                attrs["JOINTS_0"]=attr(jj[used],4,5123);attrs["WEIGHTS_0"]=attr(ww[used],4)
            primitives.append({"attributes":attrs,"indices":attr(idx,1,5125,target=34963),"material":mats[material]})
        mi=len(doc["meshes"]);doc["meshes"].append({"name":mesh.name,"primitives":primitives});ni=len(doc["nodes"])
        record={"name":mesh.name,"mesh":mi}
        if mesh.weights:record["skin"]=0
        doc["nodes"].append(record);doc["nodes"][0 if mesh.weights else nodes[mesh.part]]["children"].append(ni)
    while len(binary)%4:binary.append(0)
    doc["buffers"]=[{"byteLength":len(binary)}];serialized=json.dumps(doc,separators=(",",":")).encode()
    while len(serialized)%4:serialized+=b" "
    glb=struct.pack("<III",0x46546C67,2,12+8+len(serialized)+8+len(binary))+struct.pack("<II",len(serialized),0x4E4F534A)+serialized+struct.pack("<II",len(binary),0x004E4942)+binary
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(glb)
    return {**metrics(forms),"path":str(path),"bytes":len(glb)}


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--mode",choices=("source","runtime"),default="runtime");parser.add_argument("--out");parser.add_argument("--metrics");args=parser.parse_args()
    forms=build(args.mode);result=export(forms,args.out) if args.out else metrics(forms)
    if args.metrics:Path(args.metrics).write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result))
