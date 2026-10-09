"""Beekeeper-only editable anatomical source; +Y forward, Z up.

The natural hanging stance is the bind pose. Common-axis bones, a locally
sewn shoulder, individual glove fingers and fitted costume replace the old
folk-kit toy. Shared kits are used only for mesh primitives and export helpers;
no other figure source is changed. Source is never decimated in this file.
"""
import json
import math
import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
import kit
import figure_folk_kit as fk

R = "beekeeper"
V = lambda *a: Vector(a[0] if len(a) == 1 else a)
TAU = math.tau
SKIN = "skin:" + kit.tint("beekeeper-adult-skin", "#dfac8c")
LIP = "skin:" + kit.tint("beekeeper-set-lips", "#a55b50")
CREAM = "weave:" + kit.tint("beekeeper-blouse", "#ede2c7")
CANVAS = "weave:" + kit.tint("beekeeper-canvas", "#bb9155")
SEAM = "weave:" + kit.tint("beekeeper-seams", "#cab991")
TEAM, EDGE = "weave:team", "weave:team2"
HAIR = "hair:" + kit.tint("beekeeper-hair-grey", "#74685e")
SILVER = "hair:" + kit.tint("beekeeper-grey-locks", "#c9c2b5")
STRAW = "beech:" + kit.tint("beekeeper-straw", "#c99f54")
HAT_STRAW = "weave:" + kit.tint("beekeeper-hat-straw", "#d4ac64")
VEIL = "drape:" + kit.tint("beekeeper-veil-net", "#e3decb")
WOOD = "paint:" + kit.tint("beekeeper-hive-white", "#e9e4d6")
FRAME = "beech:" + kit.tint("beekeeper-hive-frame", "#cdbb95")
LEATHER = "hide:" + kit.tint("beekeeper-harness", "#624332")
SOLE = "hide:" + kit.tint("beekeeper-sole", "#352a25")
BRASS = "gilt:" + kit.tint("beekeeper-smoker-brass", "#b68c45")
STEEL = "tin:" + kit.tint("beekeeper-smoker-steel", "#8d9396")
INK = "resin:" + kit.tint("beekeeper-shadow", "#352826")
EYE = "resin:" + kit.tint("beekeeper-eye-ivory", "#f0e2c9")
IRIS = "resin:" + kit.tint("beekeeper-iris-hazel", "#76512c")
WAIST, CHEST, NECK = V(0, 0, .655), V(0, -.003, .855), V(0, -.004, 1.031)
SH = {s: V(s * .164, -.005, .950) for s in (-1, 1)}
EL = {s: V(s * .190, .003, .724) for s in (-1, 1)}
WR = {-1: V(-.190, .052, .509), 1: V(.187, .055, .509)}
HIP = {s: V(s * .083, 0, .610) for s in (-1, 1)}
KNEE = {s: V(s * .091, .016, .360) for s in (-1, 1)}
ANKLE = {s: V(s * .100, .024, .088) for s in (-1, 1)}
BODY = [(.620,.129,.095,.102), (.660,.131,.096,.103),
        (.713,.132,.102,.094), (.771,.143,.114,.098),
        (.826,.149,.117,.100), (.872,.149,.113,.103),
        (.915,.148,.100,.099), (.946,.145,.086,.089),
        (.969,.130,.072,.072), (.992,.079,.045,.054),
        (1.008,.043,.038,.042)]
FACE = [(1.031,.024,.028,.034), (1.051,.050,.054,.056),
        (1.069,.066,.063,.064), (1.096,.082,.068,.074),
        (1.121,.091,.070,.081), (1.147,.091,.066,.082),
        (1.169,.088,.062,.082), (1.192,.087,.063,.082),
        (1.218,.080,.060,.075), (1.245,.057,.040,.053),
        (1.260,.010,.010,.011)]


def g(x, c, r):
    return math.exp(-((x-c)/r)**2)


def ss(a, b, x):
    u = np.clip((x-a)/(b-a), 0, 1)
    return u*u*(3-2*u)


def profile(rows, x):
    """Bounded monotone Hermite sections, avoiding ring bands and overshoot."""
    if x <= rows[0][0]:
        return tuple(rows[0][1:])
    if x >= rows[-1][0]:
        return tuple(rows[-1][1:])
    for i in range(len(rows)-1):
        a,b=rows[i:i+2]
        if x > b[0]:
            continue
        t=(x-a[0])/(b[0]-a[0]); span=b[0]-a[0]
        prev,nxt=rows[max(0,i-1)],rows[min(len(rows)-1,i+2)]
        out=[]
        for j in range(1,len(a)):
            slope=(b[j]-a[j])/span
            m0=(b[j]-prev[j])/(b[0]-prev[0])
            m1=(nxt[j]-a[j])/(nxt[0]-a[0])
            m0=math.copysign(min(abs(m0),2*abs(slope)),slope) if m0*slope>0 else 0
            m1=math.copysign(min(abs(m1),2*abs(slope)),slope) if m1*slope>0 else 0
            out.append((2*t**3-3*t*t+1)*a[j]+(t**3-2*t*t+t)*m0*span+
                       (-2*t**3+3*t*t)*b[j]+(t**3-t*t)*m1*span)
        return tuple(out)


def curve(points, samples=12):
    # kit.smooth_path returns plain tuples; the forms below do vector maths.
    return [Vector(p) for p in kit.smooth_path(points, samples=samples)]


def body_point(a,z,extra=0):
    w,f,b=profile(BODY,z); sn,cs=math.sin(a),math.cos(a)
    power=2.20
    x=math.copysign(abs(sn)**(2/power),sn)*(w+extra)
    y=math.copysign(abs(cs)**(2/power),cs)*((f if cs>=0 else b)+extra)
    ad=abs((math.degrees(a)+180)%360-180)
    # Folds originate in shoulder, apron waist and elbow tension, never
    # uniform decorative ripples. The outer deltoid belongs to the sleeve.
    fold=.0025*math.sin(a*9+z*31)*g(z,.72,.085)
    fold+=.0023*math.sin(a*7-z*25)*g(ad,67,22)*g(z,.86,.080)
    y+=fold*cs
    if ad<90:
        y+=.007*g(ad,30,23)*g(z,.832,.047)
        y-=.004*g(ad,0,9)*g(z,.925,.039)
        y+=.003*g(ad,37,23)*g(z,.956-.015*ad/70,.009)
    return V(x,y,z)


def blouse():
    rows=[[body_point(i/96*TAU,float(z)) for i in range(96)]
          for z in np.linspace(.620,1.008,94)]
    return fk.loft(R+".blouse-panel",rows,CREAM,start="pole",end="pole")


def sleeve(s):
    sh,el,wr=SH[s],EL[s],WR[s]
    # A gentle elbow centreline creates real inside compression rather
    # than intersecting rings at a hard path corner.
    # The first section starts inside the collarbone volume. The source
    # seam continues across the acromion into the deltoid, so sewing does
    # not leave an exposed diagonal cap beside the blouse neckline.
    # Finish the hidden shirt inside the upper gauntlet, before the sharp
    # articulated wrist. The glove starts 80mm above WR, so this retains
    # 45mm of overlap without forcing two fabric shells through the fold.
    sleeve_end=wr-(wr-el).normalized()*.035
    path=curve([V(s*.074,-.004,.975),sh+V(-s*.012,0,.003),sh+V(s*.010,0,-.035),
                (sh+el)*.5,el,(el+wr)*.5,sleeve_end],samples=22)
    total=sum((b-a).length for a,b in zip(path,path[1:])); d=0; radii=[]
    for i,p in enumerate(path):
        if i:d+=(p-path[i-1]).length
        t=d/total
        # The sleeve continues underneath the canvas gauntlet. Its hidden
        # wrist must stay inside the glove's 24-27mm section, including
        # the small fabric folds, instead of leaking a cream ring through it.
        width=profile([(0,.044),(.14,.051),(.29,.046),(.46,.039),
                       (.53,.041),(.65,.044),(.82,.038),(.94,.026),(1,.0205)],t)[0]
        radii.append((width,width*.96))
    rings=fk.rings_along(path,radii,n=64,up=(0,1,0))
    for j,row in enumerate(rings):
        t=j/(len(rings)-1)
        for i,p in enumerate(row):
            a=i/64*TAU; normal=(p-path[j]).normalized()
            # Sewn gathers spread out of the shoulder and are drawn back
            # into the cuff. Compressed inner-elbow folds stay local to the
            # bend rather than turning the sleeve into a corrugated tube.
            folds=.0035*math.sin(a*7+.6-t*4)*g(t,.20,.11)
            folds+=.0028*math.sin(a*8+t*5)*g(t,.86,.075)
            folds+=.0034*math.sin((t-.51)*82)*g(t,.53,.066)*max(0,normal.y)**2
            folds+=.0018*math.sin(a*3-t*12)*g(t,.62,.13)
            row[i]=p+normal*folds
            # Prevent a false long sewn web between the hanging sleeve
            # and torso. Only the upper deltoid is joined at the shoulder.
            if .770 < p.z < .899:
                boundary=profile(BODY,p.z)[0]+.007
                amount=float(ss(.900,.873,p.z))*float(ss(.759,.790,p.z))
                if row[i].x*s<boundary:
                    row[i].x=s*(row[i].x*s*(1-amount)+boundary*amount)
    return fk.loft(R+f".sleeve-panel-{s}",rings,CREAM,start="pole",end="pole")


def union(pieces,name,mat,voxel=.0023):
    """Sew touching volumes, retaining the authored short shoulder seam."""
    for o in pieces:
        kit.apply(o);kit.apply_transform(o)
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=bm.faces)
        bm.to_mesh(o.data);bm.free()
    o=kit.join(pieces,name)
    mod=o.modifiers.new("Connected tailored source","REMESH")
    mod.mode="VOXEL";mod.voxel_size=voxel;mod.use_smooth_shade=True
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new("Seam relaxation","SMOOTH");mod.factor=.23;mod.iterations=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.assign(o,mat);kit.shade(o,70)
    return o


def face_point(a,z,extra=0):
    w,f,b=profile(FACE,z);sn,cs=math.sin(a),math.cos(a)
    x=math.copysign(abs(sn)**.88,sn)*(w+extra)
    y=-.004+math.copysign(abs(cs)**.88,cs)*((f if cs>=0 else b)+extra)
    ad=abs((math.degrees(a)+180)%360-180)
    if ad<90:
        y+=.0045*g(z,1.175,.014)*g(ad,28,18) # soft supraorbital plane
        y-=.0034*g(z,1.157,.013)*g(ad,28,15) # shallow eye socket
        # Width follows the bridge into a rounded projecting tip. Two
        # lateral alae and the underside indentations replace the flat
        # angular wedge; they are part of the continuous head skin.
        y+=.019*g(z,1.150,.026)*g(x,0,.011)
        y+=.033*g(z,1.127,.011)*g(x,0,.014)
        y+=.012*g(z,1.124,.007)*g(abs(x),.015,.006)
        y-=.0055*g(z,1.119,.0030)*g(abs(x),.012,.0032)
        y+=.005*g(z,1.116,.005)*g(x,0,.0045) # columella
        y+=.016*g(z,1.133,.023)*g(abs(x),.053,.023) # full cheek apples
        y+=.005*g(z,1.111,.021)*g(abs(x),.044,.023) # soft lower cheek
        y-=.0020*g(z,1.108,.008)*g(abs(x),.029,.008) # nasolabial transition
        y+=.004*g(z,1.096,.011)*g(x,0,.025) # muzzle, under formed lips
        y+=.004*g(z,1.063,.017)*g(x,0,.029) # rounded chin
        y-=.002*g(z,1.110,.006)*g(x,0,.0045) # philtrum
    return V(x,y,z)


def face_normal(a,z):
    du=face_point(a+.001,z)-face_point(a-.001,z)
    dz=face_point(a,z+.0001)-face_point(a,z-.0001)
    normal=du.cross(dz).normalized()
    if normal.dot(face_point(a,z)-V(0,-.004,1.16))<0:normal=-normal
    return normal


def adult_head():
    rows=[[face_point(i/120*TAU,float(z)) for i in range(120)]
          for z in np.linspace(FACE[0][0],FACE[-1][0],100)]
    skull=fk.loft(R+".adult-face",rows,SKIN,start="pole",end="pole")
    neckrows=[[V(math.sin(i/64*TAU)*w,math.cos(i/64*TAU)*d-.004,z)
              for i in range(64)] for z,w,d in
             [(z,*profile([(.978,.040,.037),(1.011,.035,.033),
                            (1.052,.031,.034),(1.086,.035,.040)],float(z)))
              for z in np.linspace(.978,1.086,40)]]
    neck=fk.loft(R+".neck-source",neckrows,SKIN,start="pole",end="pole")
    head=union([skull,neck],R+".head-skin",SKIN,.0014)
    out=[head]
    for s in (-1,1):
        rows=[]
        for r in np.linspace(.001,1,22):
            row=[]
            for a in np.linspace(0,TAU,44,endpoint=False):
                helix=.008*g(float(r),.82,.13)*(1+.25*math.cos(a))
                anti=.003*g(float(r),.44,.14)
                row.append(V(s*(.085+helix+anti),-.017+math.sin(a)*.015*r,
                             1.144+math.cos(a)*.029*r))
            rows.append(row)
        out.append(fk.loft(R+f".ear-{s}",rows,SKIN,start="pole",end="pole"))
    return out


def patch(name,a,z,width,height,mat,lift=.0018,slant=0,bulge=.0017):
    """A fitted almond/oval surface, not a floating spherical eyeball."""
    mesh=fk.Mesh(name,mat); centre=mesh.v(face_point(a,z)+face_normal(a,z)*(lift+bulge))
    rows=[]
    for r in (.18,.38,.60,.80,1):
        row=[]
        for i in range(40):
            th=i/40*TAU; dx=math.cos(th)*width*r; dz=math.sin(th)*height*r
            aa=a+dx/max(.06,profile(FACE,z)[0]);zz=z+dz+slant*dx
            p=face_point(aa,zz)+face_normal(aa,zz)*(lift+bulge*(1-r*r))
            row.append(mesh.v(p))
        rows.append(row)
    for i in range(40):mesh.face([centre,rows[0][i],rows[0][(i+1)%40]])
    mesh.grid(rows,closed=True)
    return mesh.obj(outward=V(0,-.004,1.15))


def face_angle(x,z):
    w=profile(FACE,z)[0]
    return math.asin(math.copysign(min(.999,abs(x/w)**(1/.88)),x))


def eyelid(a,z,s,upper):
    """A fleshy lid strip rolling from the eye edge into its socket."""
    sign=1 if upper else -1
    def point(u,v):
        th=u*math.pi*sign
        dx=math.cos(th)*.0235
        dz=math.sin(th)*.0093+s*.025*dx
        aa=a+dx/max(.06,profile(FACE,z)[0])
        zz=z+dz+sign*.0044*v*math.sin(u*math.pi)**.6
        lift=.0034*(1-v)+.0021*math.sin(v*math.pi)*math.sin(u*math.pi)
        return face_point(aa,zz)+face_normal(aa,zz)*lift
    return fk.sheet(R+f".fleshy-lid-{s}-{upper}",point,
                    np.linspace(0,1,44),np.linspace(0,1,7),SKIN,
                    inside=V(0,-.004,1.16))


def lips():
    parts=[]
    def seam_z(x):return 1.096-.0017*(abs(x)/.0235)**1.5
    for upper in (True,False):
        def point(u,v,upper=upper):
            x=(u-.5)*.047;edge=max(0,1-(x/.0235)**2)
            if upper:
                height=(.0038+.0020*g(abs(x),.0058,.0033)-.0006*g(x,0,.0025))*edge
            else:height=-.0054*edge
            z=seam_z(x)+height*v
            a=face_angle(x,z)
            fullness=(.0012+.0034*math.sin(v*math.pi))*edge
            return face_point(a,z)+face_normal(a,z)*fullness
        parts.append(fk.sheet(R+f".formed-lip-{upper}",point,
                              np.linspace(0,1,48),np.linspace(0,1,9),LIP,
                              inside=V(0,-.004,1.09)))
    def seam(u,v):
        x=(u-.5)*.045
        edge=max(0,1-(x/.0225)**2)
        z=seam_z(x)+(v-.5)*.0010*edge
        a=face_angle(x,z)
        return face_point(a,z)+face_normal(a,z)*(.00145*edge)
    parts.append(fk.sheet(R+".tapered-mouth-seam",seam,
                          np.linspace(0,1,48),np.linspace(0,1,3),INK,
                          inside=V(0,-.004,1.09)))
    return kit.join(parts,R+"mouth")


def facial_features():
    features={};fixed=[]
    for s,suf in ((-1,"L"),(1,"R")):
        a=s*math.radians(27);z=1.157
        features["eye"+suf]=patch(R+"eye"+suf,a,z,.0235,.0093,EYE,.0015,
                                 slant=s*.025,bulge=.0032)
        features["pupil"+suf]=kit.join([
            patch(R+".iris"+suf,a+s*.012,z,.009,.0095,IRIS,.0040),
            patch(R+".pupil"+suf,a+s*.012,z,.0046,.0063,INK,.0050),
            patch(R+".shine"+suf,a-.027,z+.0038,.0018,.0018,EYE,.0060)],R+"pupil"+suf)
        # A broad soft arch with a slightly loaded inner brow reads as
        # determined and mature without the old sharp angry chevrons.
        points=[face_point(a+s*aa,1.174+dz)+face_normal(a+s*aa,1.174+dz)*.004
                for aa,dz in [(-.19,-.0015),(-.09,.0010),(.04,.0040),(.20,.0015)]]
        points=curve(points,8)
        features["brow"+suf]=fk.tube(R+"brow"+suf,points,
            [(.0031*(1-.48*i/(len(points)-1)),.0018) for i in range(len(points))],
            HAIR,n=10,caps=("dome","dome"))
        for upper in (True,False):
            fixed.append(eyelid(a,z,s,upper))
        # Nose holes sit on the underside of the alae, over twenty
        # millimetres above the closed lips. No black mouth-corner caps.
        fixed.append(patch(R+f".nostril{s}",face_angle(s*.012,1.119),
                           1.119,.0023,.00135,INK,.00035,bulge=0))
    features["mouth"]=lips()
    return features,fixed


def glove(s):
    """Thick canvas with a real thumb and finger gaps around the smoker bail."""
    wr,el=WR[s],EL[s]; down=(wr-el).normalized()
    palm=V(-s,0,0)
    palm=(palm-down*down.dot(palm)).normalized()
    out=down.cross(palm).normalized()
    knuckle=wr+down*.045
    sections=[(-.080,.038,.034),(-.058,.040,.035),(-.049,.039,.034),
              (-.014,.027,.026),(0,.025,.024),(.019,.032,.028),
              (.034,.034,.027),(.048,.029,.023)]
    rows=[]
    for t in np.linspace(-.080,.048,60):
        w,d=profile(sections,float(t));row=[]
        forward=profile([(-.08,0),(0,0),(.019,.010),(.034,.026),(.048,.034)],float(t))[0] if s>0 else 0
        for i in range(56):
            a=i/56*TAU
            relief=.0022*g(float(t),-.058,.006)+.0025*g(float(t),.034,.011)*abs(math.sin(a))**6
            thenar=.005*g(float(t),.019,.018)*max(0,-math.sin(a))**5*max(0,math.cos(a))**3
            cloth=.0009*math.sin(a*5+t*63)*g(float(t),.012,.020)
            row.append(wr+down*t+out*(forward+math.sin(a)*(w+relief))+
                       palm*math.cos(a)*(d+thenar+cloth))
        rows.append(row)
    canvas=[fk.loft(R+f".glove-palm{s}",rows,CANVAS,start="pole",end="pole")]
    stitching=[]
    for finger in range(4):
        width=(finger-1.5)*.018
        length=[.039,.044,.041,.034][finger]
        if s>0:
            # Four knuckles are staggered along the horizontal top bail.
            # Their pads curl around it; the short palm no longer hides
            # them inside a flat paddle in the side close-up.
            base=wr+down*.038+out*(.040+width)
            pts=curve([base-down*.007,base+down*.008,
                       base+down*.020+palm*.023,
                       base+down*.008+palm*.033],8)
        else:
            base=knuckle+out*width
            pts=curve([base-down*.010,base+down*.008,
                       base+down*(length*.67)+palm*.006,
                       base+down*(length*.92)+palm*.019],8)
        radius=.0075 if finger<3 else .0067
        rr=[(radius*(1-.24*j/(len(pts)-1))*(1+.12*g(j/(len(pts)-1),.40,.12)),
             radius*.84*(1-.19*j/(len(pts)-1))) for j in range(len(pts))]
        canvas.append(fk.tube(R+f".glove-digit{s}-{finger}",pts,rr,CANVAS,n=18,
                             up=out,caps=("dome","dome")))
        seam=[p-palm*radius*.88 for p in pts[2:-2]]
        stitching.append(fk.tube(R+f".glove-finger-seam{s}-{finger}",seam,[.00060]*len(seam),SEAM,n=6))
    if s>0:
        grip=wr+down*.060+V(-.018,.040,.001)
        thumb=[wr+down*.018-out*.011+palm*.008,
               wr+down*.029+out*.013+palm*.008,
               grip+V(.010,-.030,.021),grip+V(-.011,-.023,.013)]
    else:
        thumb=[wr+down*.017-out*.021,wr+down*.037-out*.038+palm*.007,
               wr+down*.055-out*.034+palm*.018,wr+down*.061-out*.019+palm*.027]
    pts=curve(thumb,8)
    canvas.append(fk.tube(R+f".glove-thumb{s}",pts,
                         [(.0115-.0038*i/(len(pts)-1),.010-.003*i/(len(pts)-1))
                          for i in range(len(pts))],CANVAS,n=18,up=out))
    shell=union(canvas,R+f".glove-shell{s}",CANVAS,.0014)
    return [shell]+stitching


def legs(s):
    h,k,a=HIP[s],KNEE[s],ANKLE[s]
    path=curve([h+V(0,0,.026),(h+k)/2,k,(k+a)/2,a],18)
    rr=[]
    for i,p in enumerate(path):
        t=i/(len(path)-1)
        r=profile([(0,.064),(.18,.066),(.43,.046),(.52,.045),
                   (.69,.050),(.83,.038),(1,.031)],t)[0]
        rr.append((r,r*.92))
    trousers=fk.tube(R+f".trouser{s}",path,rr,CREAM,n=48,up=(1,0,0))
    # Constructed boot contours: square toe, heel, instep and narrow ankle.
    contour=[]
    for z,w,length,cy in [(0,.050,.106,.040),(.010,.053,.108,.041),
                           (.025,.051,.105,.041),(.045,.049,.101,.040),
                           (.072,.041,.069,.024),(.093,.034,.041,.004)]:
        contour.append([V(a.x+math.copysign(abs(math.sin(i/64*TAU))**.69,math.sin(i/64*TAU))*w,
                          cy+math.copysign(abs(math.cos(i/64*TAU))**.74,math.cos(i/64*TAU))*length,z)
                        for i in range(64)])
    boot=fk.loft(R+f".boot-foot{s}",contour,LEATHER,start="flat",end="pole",
                 bands={0:SOLE,1:SOLE})
    shaft=fk.tube(R+f".boot-shaft{s}",[V(a.x,.004,z) for z in np.linspace(.065,.206,35)],
                  [(.035+.011*g(float(z),.167,.062),.037+.006*g(float(z),.160,.058))
                   for z in np.linspace(.065,.206,35)],LEATHER,n=48,up=(1,0,0),caps=(None,"flat"))
    pieces=[trousers,boot,shaft]
    # Small parallel stitched welt, laces cross the actual tongue.
    seam=[V(p.x,p.y,.028) for p in contour[2]]
    pieces.append(fk.tube(R+f".boot-welt{s}",seam+[seam[0]],[.0009]*65,SEAM,n=6))
    for i in range(5):
        z=.105+i*.016
        for flip in (-1,1):
            pts=[V(a.x-flip*.021,.043,z),V(a.x+flip*.021,.045,z+.010)]
            pieces.append(fk.tube(R+f".boot-lace{s}-{i}-{flip}",pts,[.0013]*2,SEAM,n=6))
    return pieces


def dress_point(a,z,extra=0):
    width,front,back=profile([(.246,.191,.163,.180),(.350,.184,.153,.169),
                              (.470,.183,.153,.167),(.580,.162,.131,.142),
                              (.659,.154,.110,.118),(.704,.143,.108,.113)],z)
    sn,cs=math.sin(a),math.cos(a)
    strength=float(ss(.690,.300,z))
    fold=(.0045*math.sin(a*11+.45)+.0025*math.sin(a*6-.3))*strength
    return V(sn*(width+extra+fold),cs*((front if cs>=0 else back)+extra+fold),
             z+.0024*math.sin(a*5)*float(ss(.285,.246,z)))


def apron():
    n,m=104,85
    rows=[[dress_point(i/n*TAU,float(z)) for i in range(n)]
          for z in np.linspace(.246,.703,m)]
    skirt=fk.loft(R+".apron-skirt",rows,TEAM,start=None,end=None)
    # Thickness and sewn hem follow the same authored structured folds.
    solid=skirt.modifiers.new("Sewn apron thickness","SOLIDIFY");solid.thickness=.0032
    kit.apply(skirt)
    bib=fk.sheet(R+".apron-bib",lambda u,v:body_point((u-.5)*1.45,.706+v*.209,.006),
                 np.linspace(0,1,42),np.linspace(0,1,42),TEAM,rim=.003,inside=V(0,0,.82))
    pieces=[skirt,bib]
    for s in (-1,1):
        points=[body_point(s*.55,.842,.010),body_point(s*.65,.920,.011),
                V(s*.095,-.010,.988),body_point(s*2.35,.924,.011)]
        path=curve(points,14)
        pieces.append(fk.tube(R+f".apron-strap{s}",path,[(.010,.003)]*len(path),TEAM,
                              n=8,up=(1,0,0),caps=("flat","flat")))
    beltrows=[[dress_point(i/96*TAU,z,.005) for i in range(96)] for z in (.672,.681,.696,.704)]
    pieces.append(fk.loft(R+".apron-waist-band",beltrows,EDGE))
    # One useful front pocket with a stitched rim, no unrelated decoration.
    pocket=fk.sheet(R+".apron-pocket",lambda u,v:dress_point((u-.5)*.72,.493+v*.105,.010),
                    np.linspace(0,1,20),np.linspace(0,1,20),TEAM,rim=.003,inside=V(0,0,.54))
    pieces.append(pocket)
    path=[dress_point((i/35-.5)*.72,.598,.011) for i in range(36)]
    pieces.append(fk.tube(R+".pocket-stitch",path,[.00085]*36,SEAM,n=6))
    return pieces


def hair_and_hat():
    pieces=[];rows=[]
    for t in np.linspace(0,.985,52):
        row=[]
        for i in range(96):
            a=i/96*TAU;ad=abs((math.degrees(a)+180)%360-180)
            hairline=profile([(0,1.216),(28,1.208),(55,1.181),(85,1.150),
                              (120,1.106),(180,1.097)],ad)[0]
            hairline+=.0026*math.sin(a*3+.45)*g(ad,40,36)
            z=hairline*(1-t)+1.260*t
            # Smooth gathered hair mass; broad swept locks below supply
            # the direction. No evenly striped short-cap relief.
            fullness=.006+.003*g(ad,70,42)*g(float(t),.32,.27)
            row.append(face_point(a,float(z))+face_normal(a,float(z))*fullness)
        rows.append(row)
    pieces.append((fk.loft(R+".swept-hair",rows,HAIR,end=V(0,-.005,1.265)),"hair"))
    # Wide overlapping locks travel around the temples into the rear bun.
    # Each is a shaped ribbon embedded in the cap, rather than a cylinder.
    for s in (-1,1):
        for k in range(4):
            controls=[]
            for a,z in [(s*(.12+k*.28),1.220+k*.005),
                        (s*(.62+k*.24),1.214-k*.006),
                        (s*(1.21+k*.18),1.184-k*.010),
                        (s*(1.85+k*.12),1.150-k*.007),
                        (s*(2.65+k*.08),1.147+k*.003)]:
                controls.append(face_point(a,z)+face_normal(a,z)*.009)
            path=curve(controls,10);lock=[];silver=[]
            for j,p in enumerate(path):
                t=j/(len(path)-1)
                normal=V(p.x,p.y+.004,(p.z-1.175)*.70).normalized()
                tangent=path[min(len(path)-1,j+1)]-path[max(0,j-1)]
                across=tangent.cross(normal).normalized()
                width=.0085*math.sin(math.pi*(.04+.92*t))**.35
                lock.append([p+across*(u*width)+normal*(.001+.0031*(1-u*u))
                             for u in np.linspace(-1,1,9)])
                silver.append(p+across*(width*.22)+normal*.0044)
            pieces.append((fk.loft(R+f".gathered-lock{s}-{k}",lock,HAIR,closed=False),"hair"))
            if k in (0,2,3):
                radii=[(.0010+.0011*math.sin(math.pi*j/(len(path)-1)),.0007)
                       for j in range(len(path))]
                pieces.append((fk.tube(R+f".silver-sweep{s}-{k}",silver,radii,SILVER,
                                       n=8,up=(0,0,1)),"hair"))
    bun=V(0,-.113,1.151)
    pieces.append((fk.ball(R+".gathered-bun",1,bun,HAIR,scale=(.048,.033,.044),seg=48,rings=30),"hair"))
    for k in range(6):
        path=[]
        for i in range(54):
            t=i/53;a=t*TAU*.78+k*TAU/6;rad=.041*(1-.66*t)
            x,z=math.cos(a)*rad*1.10,math.sin(a)*rad
            y=-.033*math.sqrt(max(0,1-(x/.051)**2-(z/.044)**2))
            path.append(bun+V(x,y-.0006,z))
        pieces.append((fk.tube(R+f".bun-lock{k}",path,[.0015]*len(path),
                               SILVER if k in (0,2,5) else HAIR,n=8),"hair"))
    # One softly domed straw crown flows into the wavy brim. The tiny
    # crossed relief is weave, not the old millimetre-high stacked discs.
    rows=[]
    hatprofile=[(0,.001,1.310),(.16,.064,1.307),(.24,.078,1.302),
                (.33,.083,1.292),(.50,.087,1.255),(.58,.101,1.247),(.82,.161,1.241),
                (1,.188,1.245)]
    for t in np.linspace(.005,1,60):
        rad,z=profile(hatprofile,float(t));row=[]
        for i in range(112):
            a=i/112*TAU
            front=max(0,math.cos(a))
            weave=.00017*math.sin(t*94+a*19)*math.sin(t*87-a*19)
            wave=.0042*math.sin(a*3+.35)*float(ss(.58,1,t))**2
            row.append(V(math.sin(a)*(rad+weave),math.cos(a)*(rad+weave)-.006,
                         z+front**3*.014*float(ss(.55,1,t))+wave))
        rows.append(row)
    hat=fk.loft(R+".woven-straw-hat",rows,HAT_STRAW,start="pole")
    mod=hat.modifiers.new("Constructed straw brim","SOLIDIFY");mod.thickness=.004
    kit.apply(hat);pieces.append((hat,"hat"))
    bandrows=[]
    for z in np.linspace(1.253,1.269,7):
        radius=profile([(1.253,.089),(1.269,.0865)],float(z))[0]
        bandrows.append([V(math.sin(i/96*TAU)*radius,math.cos(i/96*TAU)*radius-.006,z)
                         for i in range(96)])
    pieces.append((fk.loft(R+".single-ribbon-band",bandrows,LEATHER),"hat"))
    rim=rows[-1]
    pieces.append((fk.tube(R+".hat-edge-braid",rim+[rim[0]],[.0025]*(len(rim)+1),HAT_STRAW,n=8),"hat"))
    # Soft netting is gathered UP on the side/rear brim, leaving forehead,
    # eyes, cheeks and bun visible. No vertical wire-grid veil remains.
    roll=[]
    for a in np.linspace(math.radians(65),math.radians(295),78):
        rad=.112+.007*math.sin(a*3+.7)
        centre=V(math.sin(a)*rad,math.cos(a)*rad-.006,1.255+.0025*math.sin(a*2))
        outward=V(math.sin(a),math.cos(a),0)
        radius=.0105+.0025*math.sin(a*4+.3)**2
        roll.append([centre+outward*(math.cos(th)*radius)+V(0,0,math.sin(th)*radius*.76)+
                     outward*(.0013*math.sin(a*15+th*2))
                     for th in np.linspace(0,TAU,20,endpoint=False)])
    pieces.append((fk.loft(R+".veil-gathered-roll",roll,VEIL,start="pole",end="pole"),"cape"))
    def folded_veil(u,v):
        a=math.radians(78+204*u)
        rad=.106+v*.043
        z=1.249+.011*math.sin(v*math.pi)+.0028*math.sin(a*13+v*3)*math.sin(v*math.pi)
        return V(math.sin(a)*rad,math.cos(a)*rad-.006,z)
    pieces.append((fk.sheet(R+".veil-folded-on-brim",folded_veil,
                            np.linspace(0,1,70),np.linspace(0,1,18),VEIL,
                            rim=.0007,inside=V(0,-.006,1.23)),"cape"))
    for s in (-1,1):
        pin=V(s*.099,-.050,1.257)
        pieces.append((fk.ball(R+f".veil-pin{s}",.004,pin,BRASS,
                               scale=(1,.6,.6),seg=16,rings=8),"hat"))
    return pieces


def hive():
    pieces=[];y=-.210
    # Painted courses sit in a timber frame; the overhanging roof and
    # landing ledge have thickness and their own construction edges.
    for k in range(7):
        z=.758+k*.036
        pieces.append(fk.rbox(R+f".hive-course{k}",(.234,.180,.034),V(0,y,z),WOOD,
                              levels=1,crease=.92))
    for s in (-1,1):
        for face in (-1,1):
            pieces.append(fk.rbox(R+f".hive-frame-upright{s}-{face}",(.016,.014,.258),
                                  V(s*.112,y+face*.089,.866),FRAME,levels=2,crease=.83))
        for z in (.741,.986):
            pieces.append(fk.rbox(R+f".hive-side-frame{s}-{z}",(.014,.181,.014),
                                  V(s*.119,y,z),FRAME,levels=2,crease=.83))
        for z in (.801,.945):
            pieces.append(fk.rbox(R+f".hive-carry{s}-{z}",(.010,.070,.016),V(s*.124,y,z),LEATHER,levels=1,crease=.85))
    for z in (.739,.985):
        pieces.append(fk.rbox(R+f".hive-entry-frame{z}",(.229,.014,.014),
                              V(0,y-.092,z),FRAME,levels=2,crease=.85))
    roofrows=[[V(x,y+yy,z) for yy,z in [(-.107,.994),(-.107,1.008),
                (0,1.074),(.107,1.008),(.107,.994)]] for x in (-.142,.142)]
    pieces.append(fk.loft(R+".hive-blue-roof",roofrows,"paint:team2",start="flat",end="flat"))
    for x in (-.142,.142):
        path=[V(x,y-.108,1.010),V(x,y,1.075),V(x,y+.108,1.010)]
        pieces.append(fk.tube(R+f".hive-roof-fascia{x}",path,[.0035]*3,FRAME,n=8))
    for face in (-1,1):
        pieces.append(fk.rbox(R+f".hive-eave{face}",(.286,.009,.012),
                              V(0,y+face*.105,.995),"paint:team2",levels=2,crease=.84))
    pieces.append(fk.tube(R+".hive-roof-ridge",[V(-.143,y,1.075),V(.143,y,1.075)],
                          [.004]*2,"paint:team2",n=10))
    pieces.append(fk.rbox(R+".hive-entrance",(.135,.005,.015),V(0,y-.092,.758),INK,levels=1,crease=.90))
    pieces.append(fk.rbox(R+".hive-landing",(.211,.043,.011),V(0,y-.110,.750),WOOD,levels=2,crease=.85))
    for s in (-1,1):
        pieces.append(fk.rbox(R+f".hive-landing-bracket{s}",(.011,.024,.021),
                              V(s*.081,y-.100,.737),FRAME,levels=2,crease=.83))
    for s in (-1,1):
        for z in (.790,.942):
            for k in (-1,1):
                pieces.append(fk.ball(R+f".hive-nail{s}-{z}-{k}",.0020,
                                      V(s*.113,y+k*.094,z),STEEL,seg=8,rings=4))
    return pieces


def harness():
    out=[]
    for s in (-1,1):
        path=curve([body_point(s*.60,.722,.013),body_point(s*.65,.848,.012),
                    body_point(s*.74,.934,.012),V(s*.108,-.016,.985),
                    V(s*.104,-.119,.913),V(s*.104,-.135,.761)],15)
        out.append(fk.tube(R+f".hive-harness{s}",path,[(.012,.004)]*len(path),LEATHER,n=8,up=(1,0,0)))
        buckle=fk.rbox(R+f".harness-buckle{s}",(.029,.011,.032),body_point(s*.66,.797,.018),BRASS,levels=1,crease=.85)
        out.append(buckle)
    # Blouse collar lays down onto the neckline rather than floating above it.
    for s in (-1,1):
        def collar(u,v,s=s):
            a=s*(.12+u*.90);z=.965+.026*v-.017*u
            return body_point(a,z,.005+.009*(1-v))
        out.append(fk.sheet(R+f".blouse-collar{s}",collar,np.linspace(0,1,14),np.linspace(0,1,14),CREAM,rim=.002,inside=V(0,0,.97)))
    for z in (.903,.939,.969):
        out.append(fk.ball(R+f".blouse-button{z}",.0034,body_point(0,z,.009),SEAM,scale=(1,.35,1),seg=12,rings=6))
    return out


def smoker():
    """Bail grip, real perforated heat guard and independently moving bellows."""
    wr=WR[1];down=(wr-EL[1]).normalized()
    grip=wr+down*.060+V(-.018,.040,.001)
    c=grip+V(.018,.077,.006)
    pieces=[]
    path=[c+V(0,0,z) for z in (-.072,-.062,.040,.050)]
    pieces.append(fk.tube(R+".smoker-can",path,[.038,.041,.041,.038],BRASS,n=56,up=(1,0,0),caps=("flat","flat")))
    lid=[c+V(0,0,.045),c+V(0,.010,.078),c+V(0,.054,.106),c+V(0,.078,.119)]
    pieces.append(fk.tube(R+".smoker-nozzle",curve(lid,8),
        list(np.linspace(.042,.010,len(curve(lid,8)))),BRASS,n=40,up=(1,0,0),caps=(None,None)))
    end=lid[-1]
    pieces.append(fk.tube(R+".nozzle-inner",[end-V(0,.006,.003),end+V(0,.003,.001)],
                         [.0085,.0085],INK,n=24,up=(1,0,0),caps=("flat",None)))
    # The steel cage is actual open lattice; dark paint disks would look
    # like false holes at the close camera.
    for k in range(16):
        a=k/16*TAU
        path=[c+V(math.sin(a)*.046,math.cos(a)*.046,z) for z in (-.061,.036)]
        pieces.append(fk.tube(R+f".smoker-guard{k}",path,[.0017]*2,STEEL,n=8))
    for z in (-.060,-.013,.035):
        path=[c+V(math.sin(i/56*TAU)*.046,math.cos(i/56*TAU)*.046,z) for i in range(56)]
        pieces.append(fk.tube(R+f".smoker-guard-ring{z}",path+[path[0]],[.0022]*57,STEEL,n=8))
    # A carry bail passes through the curled digits, clear of the can.
    bail=[c+V(0,-.031,-.039),grip+V(0,-.027,-.013),
          grip+V(0,-.027,.012),grip+V(0,.027,.012),
          grip+V(0,.027,-.013),c+V(0,-.019,-.039)]
    pieces.append(fk.tube(R+".smoker-bail",curve(bail,8),[.0035]*len(curve(bail,8)),BRASS,n=10))
    b=c+V(0,-.076,0)
    pieces.append(fk.rbox(R+".smoker-bellows-fixed",(.058,.010,.108),b,LEATHER,levels=1,crease=.75))
    for k in range(6):
        yy=-.012-k*.0045
        pieces.append(fk.rbox(R+f".smoker-bellows-fold{k}",(.055+.002*(k%2),.006,.097-.005*(k%2)),
                              b+V(0,yy,0),LEATHER,levels=1,crease=.45))
    board=fk.rbox(R+".smoker-bellows-board",(.064,.008,.115),b+V(0,-.040,0),STRAW,levels=1,crease=.80)
    return pieces,board,grip,b+V(0,-.040,0)


def make_rig(root,grip,board):
    data=bpy.data.armatures.new(R+" authored anatomical frames")
    rig=bpy.data.objects.new(R+".skeleton",data);bpy.context.collection.objects.link(rig)
    rig.parent=root;bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode="EDIT")
    pos={"torso":WAIST,"chest":CHEST,"head":NECK,"hair":V(0,-.028,1.240),
         "hat":V(0,-.006,1.245),"cape":V(0,-.016,1.238),
         "extra":V(0,-.128,.915),"weapon":grip,"extra2":board+V(0,0,-.052),
         "skirtL":V(-.060,0,.686),"skirtR":V(.060,0,.686)}
    par={"chest":"torso","head":"chest","hair":"head","hat":"head", "cape":"hat",
         "extra":"chest","weapon":"handR","extra2":"weapon","skirtL":"torso","skirtR":"torso"}
    for s,suf in ((-1,"L"),(1,"R")):
        for name,p,parent in [("clav",V(s*.030,-.004,.969),"chest"),
                               ("arm",SH[s],"clav"+suf),("fore",EL[s],"arm"+suf),
                               ("hand",WR[s],"fore"+suf),("leg",HIP[s],None),
                               ("knee",KNEE[s],"leg"+suf),("foot",ANKLE[s],"knee"+suf)]:
            pos[name+suf]=p
            if parent:par[name+suf]=parent
    for name,p in pos.items():
        b=data.edit_bones.new(R+"."+name);b.head=p;b.tail=p+V(0,0,.065);b.use_connect=False
    for name,parent in par.items():data.edit_bones[R+"."+name].parent=data.edit_bones[R+"."+parent]
    bpy.ops.object.mode_set(mode="OBJECT");rig.show_in_front=True
    rig["arenaCommonAxes"]=True;rig["anatomicalPivots"]=json.dumps({k:list(v) for k,v in pos.items()})
    return rig


def weights(o,rig,values):
    """Normalized continuous weights, top four influences per vertex."""
    kit.apply(o);kit.apply_transform(o)
    names=list(values);a=np.stack([np.asarray(values[n])+np.zeros(len(o.data.vertices)) for n in names],axis=1)
    a=np.clip(a,0,1)
    if len(names)>4:
        rank=np.argsort(a,axis=1)[:,:-4];np.put_along_axis(a,rank,0,axis=1)
    a/=np.maximum(a.sum(axis=1,keepdims=True),1e-9)
    for j,name in enumerate(names):
        group=o.vertex_groups.new(name=R+"."+name)
        q=np.round(a[:,j]*10000).astype(int);ix=np.flatnonzero(q>0);ix=ix[np.argsort(q[ix])]
        for batch in np.split(ix,np.flatnonzero(np.diff(q[ix]))+1):
            if len(batch):group.add(batch.tolist(),float(q[batch[0]])/10000,"REPLACE")
    mod=o.modifiers.new("Connected anatomical skin","ARMATURE");mod.object=rig
    o.parent=rig;o["continuousSkin"]=True


def weight_cloth(o,rig,sleeves=True):
    p=np.array([v.co[:] for v in o.data.vertices]);x,y,z=p.T
    chest=ss(.760,.915,z)
    val={"torso":1-chest,"chest":chest}
    for s,suf in ((-1,"L"),(1,"R")):
        # The arm's complete distal ownership is selected outside the
        # actual tailored torso, not with a Z-only cutoff near the hips.
        width=np.interp(z,[r[0] for r in BODY],[r[1] for r in BODY])
        if sleeves:
            shoulder_own=ss(width+.004,width+.023,x*s)
            distal=1-ss(.867,.911,z)
            # The carved medial sleeve lies only 7mm outside the blouse.
            # It must travel wholly with the arm below the short shoulder
            # seam, not leave a chest-weighted fan down to the elbow.
            arm_own=ss(width+.001,width+.006,x*s)
            own=(shoulder_own*(1-distal)+arm_own*distal)*(z>.490)*(z<1.006)
        else:
            own=np.zeros(len(p))
        prox=ss(.890,.963,z)*ss(.090,.154,x*s)*(1-own)*chest
        val["clav"+suf]=prox*.45
        val["chest"]-=prox*.45
        for name in ("torso","chest","clav"+suf):val[name]*=1-own
        fore=1-ss(EL[s].z-.043,EL[s].z+.046,z)
        # Match the enclosing gauntlet's exact forearm-axis blend. A
        # different Z-only falloff shears sleeve and cuff apart whenever
        # the compensating wrist turns the palm toward the bellows.
        down=np.array((WR[s]-EL[s]).normalized())
        along=(p-np.array(WR[s])).dot(down)
        hand=ss(-.047,.010,along)
        val["arm"+suf]=own*(1-fore)
        val["fore"+suf]=own*fore*(1-hand)
        val["hand"+suf]=own*fore*hand
    weights(o,rig,val)


def attach(o,rig,part):
    kit.apply(o);kit.apply_transform(o);world=o.matrix_world.copy()
    o.parent=rig;o.parent_type="BONE";o.parent_bone=R+"."+part;o.matrix_world=world
    return o


def attach_faces(features,rig):
    nodes={}
    for name in ("eyeL","eyeR","browL","browR","mouth","pupilL","pupilR"):
        o=features[name];kit.apply(o);kit.apply_transform(o)
        pts=np.array([v.co[:] for v in o.data.vertices]);lo,hi=pts.min(axis=0),pts.max(axis=0)
        centre=V((lo+hi)/2);size=hi-lo
        if name.startswith("pupil"):
            axes=nodes["eye"+name[-1]].matrix_world.to_3x3()
        else:
            normal=V(centre.x*3,1,0).normalized();up=V(0,0,1);right=normal.cross(up).normalized()
            axes=Matrix((right,normal,up)).transposed()
        frame=Matrix.Translation(centre)@axes.to_4x4();o.data.transform(frame.inverted())
        if name.startswith("pupil"):o.parent=nodes["eye"+name[-1]]
        else:o.parent=rig;o.parent_type="BONE";o.parent_bone=R+".head"
        o.matrix_world=frame;o["faceWidth"]=max(.006,float(size[0]));o["faceHeight"]=max(.003,float(size[2]))
        nodes[name]=o;kit.refresh()


def pigment(root):
    """Single export colour stream, restrained rosy cheeks and warm cloth."""
    for o in kit.descendants(root):
        if o.type!="MESH":continue
        me=o.data
        for attr in list(me.color_attributes):me.color_attributes.remove(attr)
        color=me.color_attributes.new(name="AO",type="FLOAT_COLOR",domain="CORNER")
        rgba=np.ones((len(me.loops),4),dtype=np.float32)
        point_pigment=np.ones((len(me.vertices),3),dtype=np.float32)
        if o.name==R+".head-skin":
            pts=np.array([v.co[:] for v in me.vertices]);x,y,z=pts.T
            rosy=np.exp(-((abs(x)-.057)/.025)**2)*np.exp(-((z-1.130)/.021)**2)*(y>.024)
            ix=np.array([loop.vertex_index for loop in me.loops]);r=rosy[ix]
            rgba[:,1]-=.30*r;rgba[:,2]-=.26*r
            point_pigment[:,1]-=.30*rosy;point_pigment[:,2]-=.26*rosy
        elif o.name==R+".woven-straw-hat":
            pts=np.array([v.co[:] for v in me.vertices]);x,y,z=pts.T
            angle=np.arctan2(x,y+.006)
            weave=.035*(.5+.5*np.sin(angle*19+(z-1.24)*420)*
                         np.sin(angle*19-(z-1.24)*390))
            point_pigment-=weave[:,None]
            ix=np.array([loop.vertex_index for loop in me.loops])
            rgba[:,:3]=point_pigment[ix]
        old=me.attributes.get("BeekeeperPigment")
        if old:me.attributes.remove(old)
        pigment_cache=me.attributes.new(name="BeekeeperPigment",type="FLOAT_VECTOR",domain="POINT")
        pigment_cache.data.foreach_set("vector",point_pigment.ravel())
        color.data.foreach_set("color",rgba.ravel())
        me.color_attributes.active_color=color
        me.color_attributes.render_color_index=0


def build_master(root_name=R):
    if root_name!=R:raise ValueError("Beekeeper skeleton identity is fixed")
    root=kit.empty(R)
    smoke,board,grip,boardpos=smoker();rig=make_rig(root,grip,boardpos)
    uniform=union([blouse(),sleeve(-1),sleeve(1)],R+".sewn-blouse",CREAM)
    weight_cloth(uniform,rig)
    for o in harness():weight_cloth(o,rig,False)
    for o in apron():
        if "skirt" in o.name or "pocket" in o.name:
            xz=np.array([v.co[:] for v in o.data.vertices]);x,z=xz[:,0],xz[:,2]
            # Keep the blouse/hip cover on the torso. Only the lower skirt
            # follows the legs: rotating its upper back around a hip-like
            # pivot pulls the shell through the torso during a long stride.
            hem=1-ss(.550,.625,z);side=ss(-.018,.018,x)
            weights(o,rig,{"torso":1-hem,"skirtL":hem*(1-side),"skirtR":hem*side})
        else:weight_cloth(o,rig,False)
    for s,suf in ((-1,"L"),(1,"R")):
        for o in legs(s):
            kit.apply(o);kit.apply_transform(o)
            z=np.array([v.co.z for v in o.data.vertices]);knee=1-ss(.320,.407,z);foot=1-ss(.070,.113,z)
            weights(o,rig,{"leg"+suf:1-knee,"knee"+suf:knee*(1-foot),"foot"+suf:knee*foot})
        for o in glove(s):
            if "glove-shell" in o.name:
                kit.apply(o);kit.apply_transform(o)
                pts=np.array([v.co[:] for v in o.data.vertices])
                down=np.array((WR[s]-EL[s]).normalized())
                along=(pts-np.array(WR[s])).dot(down)
                hand=ss(-.047,.010,along)
                weights(o,rig,{"fore"+suf:1-hand,"hand"+suf:hand})
            else:
                # Digits, thumb and finger seams keep their exact bail grip.
                attach(o,rig,"hand"+suf)
    for o in adult_head():
        if "head-skin" in o.name:
            z=np.array([v.co.z for v in o.data.vertices]);head=ss(1.000,1.055,z)
            weights(o,rig,{"chest":1-head,"head":head})
        else:attach(o,rig,"head")
    features,fixed=facial_features();attach_faces(features,rig)
    for o in fixed:attach(o,rig,"head")
    for o,part in hair_and_hat():attach(o,rig,part)
    for o in hive():attach(o,rig,"extra")
    for o in smoke:attach(o,rig,"weapon")
    attach(board,rig,"extra2")
    pigment(root);kit.refresh()
    root["authorScale"]=1.0
    root["sourceBrief"]="work/arena/2026-10-08-roster/beekeeper/brief.md"
    root["restPose"]="relaxed hanging arms; elbows approximately 15 degrees"
    root["runtimeCopyRequired"]=True
    root["rigContract"]="common-axis torso/chest/clavL/clavR; separate face controls; no A-pose"
    return root
