"""Private B3 Drummer: tailored Napoleonic musician, source before reduction."""
import json
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as geo
from figure_drummer_kit import angular, fold_relief, lidded_eye, mouth_recess, shaped_mouth
from figure_drummer_kit import V, TAU, g, soft, profile, curve, tag, join, union, rig, weight, attach, faces, color_cache, finish_ao, surface_finish

R="drummer"
SKIN="skin:"+kit.tint("drummer-b2-skin","#dfac85")
LIP="skin:"+kit.tint("drummer-b2-lip","#a66751")
MOUTH="resin:"+kit.tint("drummer-b3-mouth","#422019")
GUM="skin:"+kit.tint("drummer-b3-gum","#a46358")
TONGUE="skin:"+kit.tint("drummer-b3-tongue","#bd7667")
HAIR="hair:"+kit.tint("drummer-b2-hair","#523022")
HAIRLIGHT="hair:"+kit.tint("drummer-b2-lock","#7d4b2d")
COAT,EDGE="weave:team","weave:team2"
RED="weave:"+kit.tint("drummer-b2-red-facing","#bd3e35")
WHITE="weave:"+kit.tint("drummer-b2-white","#efe8d6")
STITCH="weave:"+kit.tint("drummer-b2-seam","#c5bda6")
BLACK="hide:"+kit.tint("drummer-b2-gaiter","#26292e")
FELT="felt:"+kit.tint("drummer-b2-shako","#24242b")
WOOD="beech:"+kit.tint("drummer-b2-stick","#bd8a4f")
BRASS="gilt:"+kit.tint("drummer-b2-brass","#c09c56")
DARKBRASS="tin:"+kit.tint("drummer-b2-aged-brass","#8d733f")
INK="resin:"+kit.tint("drummer-b2-ink","#352321")
EYE="resin:"+kit.tint("drummer-b2-eye","#f4e7cc")
IRIS="resin:"+kit.tint("drummer-b2-iris","#695334")
HEADMAT="weave:"+kit.tint("drummer-b2-drumhead","#e5d7b4")

WAIST,CHEST,NECK,HEAD=V(0,0,.693),V(0,-.004,.889),V(0,-.004,1.047),V(0,-.004,1.075)
SH={s:V(s*.190,-.005,1.003) for s in (-1,1)}
EL={s:V(s*.210,.001,.777) for s in (-1,1)}
WR={s:V(s*.218,.054,.558) for s in (-1,1)}
HIP={s:V(s*.087,-.006,.641) for s in (-1,1)}
KNEE={s:V(s*.096,.017,.387) for s in (-1,1)}
ANKLE={s:V(s*.105,.020,.086) for s in (-1,1)}
DRUM_C=V(-.055,.235,.658)
DRUM_AX=V(.08,.17,1).normalized()
DRUM_R,DRUM_H=.132,.169
DRUM_TOP=DRUM_C+DRUM_AX*(DRUM_H*.48)
HOOK=V(-.105,.124,.725)
TIP_LENGTH,BUTT_LENGTH=.162,.057
BODY=[(.629,.113,.084,.093),(.677,.133,.099,.101),(.741,.120,.089,.09),
      (.818,.131,.100,.092),(.889,.149,.112,.103),(.95,.158,.106,.104),
      (1.003,.150,.086,.086),(1.032,.073,.047,.05),(1.063,.035,.032,.037)]
FACE=[(1.063,.027,.033,.041),(1.084,.047,.049,.054),(1.11,.060,.056,.066),
      (1.137,.077,.060,.079),(1.168,.083,.061,.084),(1.198,.082,.059,.083),
      (1.229,.08,.058,.077),(1.259,.067,.05,.065),(1.282,.039,.025,.036),(1.291,.004,.004,.004)]


def body_point(a,z,lift=0):
    w,f,b=profile(BODY,z);sn,cs=math.sin(a),math.cos(a)
    x=math.copysign(abs(sn)**.87,sn)*(w+lift)
    y=math.copysign(abs(cs)**.86,cs)*((f if cs>0 else b)+lift)
    ad=abs((math.degrees(a)+180)%360-180)
    if ad<90:
        y+=.011*g(ad,30,22)*g(z,.901,.047)
        y-=.003*g(ad,0,9)*g(z,.90,.085)
        y-=.004*g(z,.844,.010)*g(ad,37,32)  # tailored lower pectoral edge
        y+=.004*g(ad,64,16)*g(z,.794,.046)
    else:
        y-=.007*g(ad,146,18)*g(z,.921,.038)
        y+=.003*g(ad,180,8)*g(z,.89,.09)
    y+=cs*fold_relief(z,a,.731,.019,.008,.0045,.4)*g(ad,47,45)
    y+=cs*fold_relief(z,a,.807,-.020,.011,.0036,-.7)*g(ad,65,17)
    return V(x,y,z)


def coat_hem(a):
    # High cutaway front, lower rear skirt seam; no blue cylindrical pelvis.
    return .657+.046*max(0,math.cos(a))**6


def coat():
    rows=[[body_point(a,coat_hem(a)+(1.063-coat_hem(a))*float(t))
           for a in np.linspace(0,TAU,80,endpoint=False)] for t in np.linspace(0,1,80)]
    pieces=[geo.loft(R+".source-coat",rows,COAT,start="flat",end="pole")]
    for sign in (-1,1):
        # Rounded sleeve head begins with a small crown ring. A broad flat
        # cap and medial x clamp were the two causes of v1's shoulder wedges.
        path=curve([SH[sign]+V(-sign*.025,0,.024),SH[sign]+V(.002*sign,0,-.030),
                    (SH[sign]+EL[sign])/2,EL[sign],(EL[sign]+WR[sign])/2,
                    WR[sign]+V(0,0,.019)],20)
        radii=[profile([(0,.007,.008),(.12,.055,.057),(.28,.050,.050),
                        (.49,.038,.036),(.60,.046,.038),(.82,.034,.030),(1,.028,.027)],
                       i/(len(path)-1)) for i in range(len(path))]
        rows=geo.rings_along(path,radii,n=56,up=(1,0,0))
        for j,row in enumerate(rows):
            t=j/(len(rows)-1)
            for i,p in enumerate(row):
                q=i/56*TAU;normal=(p-path[j]).normalized()
                relief=.0040*g(t,.25,.16)*max(0,normal.y)**3  # biceps under wool
                relief+=.0035*g(t,.29,.15)*max(0,-normal.y)**4
                relief+=.0042*g(t,.51,.042)*max(0,-normal.y)**5  # elbow point
                relief+=.0048*g(t,.67,.13)*max(0,normal.x*sign)**4
                relief+=fold_relief(t,q,.49,.055,.025,.0060,.4)*max(0,normal.y)**2
                relief+=fold_relief(t,q,.60,-.043,.026,.0045,-.4)
                relief+=fold_relief(t,q,.90,.036,.025,.0045,.2)
                row[i]=p+normal*relief
        pieces.append(geo.loft(R+f".source-sleeve{sign}",rows,COAT,start="pole",end="flat"))
    return tag(union(pieces,R+".connected-tailored-coat",COAT,.00225),5900,
               "cutaway tailored torso rounded sleeve heads elbow points and cloth tension")


def weight_coat(obj,armature,sleeves=True):
    p=np.array([v.co[:] for v in obj.data.vertices]);x,y,z=p.T
    chest=soft(.786,.92,z);values={"torso":1-chest,"chest":chest}
    width=np.interp(z,[r[0] for r in BODY],[r[1] for r in BODY])
    for s,suffix in ((-1,"L"),(1,"R")):
        deltoid=soft(.936,1.006,z)
        arm=soft(width-.018*deltoid,width+.012+.012*deltoid,x*s)*soft(.50,.57,z)*(1-soft(1.013,1.075,z)) if sleeves else np.zeros(len(z))
        for name in list(values):values[name]*=1-arm
        shoulder=soft(.934,1.015,z)*soft(.060,.155,x*s)*(1-arm)
        values["chest"]*=1-shoulder*.4;values["clav"+suffix]=chest*shoulder*.4*(1-arm)
        fore=1-soft(EL[s].z-.040,EL[s].z+.045,z)
        wrist=1-soft(WR[s].z-.017,WR[s].z+.033,z)
        values["arm"+suffix]=arm*(1-fore)
        values["fore"+suffix]=arm*fore*(1-wrist);values["hand"+suffix]=arm*fore*wrist
    weight(obj,armature,values)


def coat_details():
    pieces=[]
    # Two actual broad crossbelts sewn over the chest, not cylinders at the shoulders.
    for s in (-1,1):
        def strap(u,v,s=s):
            z=.69+.318*v;a=s*(-.77+1.47*v)+(u-.5)*.26
            return body_point(a,z,.009)
        pieces.append(geo.sheet(R+f".white-crossbelt{s}",strap,np.linspace(0,1,10),np.linspace(0,1,54),WHITE,
                                rim=.0025,back=True,inside=V(0,0,.85)))
        for z in (.761,.810,.856,.90,.941):
            pieces.append(geo.ball(R+f".coat-button{s}-{z}",.0055,body_point(s*.26,z,.004),BRASS,
                                   scale=(1,.45,1),seg=14,rings=8))
    # Short standing red collar with open front and cream bound edges.
    rows=[[V(math.sin(a)*.044,-.004+math.cos(a)*.041,z) for a in np.linspace(.24,TAU-.24,80)] for z in (1.025,1.041,1.079)]
    pieces.append(geo.loft(R+".red-standing-collar",rows,RED,closed=False))
    for idx in (0,-1):
        pts=[row[idx] for row in rows]
        pieces.append(geo.tube(R+".collar-edge"+str(idx),pts,[.0013]*3,WHITE,n=6))
    waist=[[body_point(a,z,.005) for a in np.linspace(0,TAU,64,endpoint=False)] for z in (.68,.69,.711)]
    pieces.append(geo.loft(R+".white-waist-belt",waist,WHITE))
    # Square brass clasp and strap hook; no emblem or lettering.
    pieces.append(geo.rbox(R+".belt-clasp",(.042,.008,.035),body_point(0,.702,.017),BRASS,levels=1,crease=.8))
    pieces.append(geo.rbox(R+".strap-clasp",(.029,.009,.028),body_point(-.32,.767,.019),BRASS,levels=1,crease=.8))
    seam=[body_point(a,.716,.0025) for a in np.linspace(0,TAU,81)]
    pieces.append(geo.tube(R+".coat-waist-seam",seam,[.0013]*81,EDGE,n=6))
    back=[body_point(math.pi,float(z),.0022) for z in np.linspace(.716,.988,44)]
    pieces.append(geo.tube(R+".coat-back-seam",back,[.0010]*44,EDGE,n=6))
    return join(pieces,R+".tailored-crossbelts-collar",950,"crossbelts red collar waist and back seams buttons and belt")


def cuff(s):
    down=(WR[s]-EL[s]).normalized()
    path=[WR[s]-down*t for t in (.005,.011,.046,.055)]
    pieces=[geo.tube(R+f".red-cuff{s}",path,[(.031,.029),(.033,.031),(.036,.032),(.033,.030)],RED,n=48,up=(1,0,0),caps=("flat","flat"))]
    for t in (.018,.042):
        p=WR[s]-down*t+V(s*.033,0,0)
        pieces.append(geo.ball(R+f".cuff-button{s}-{t}",.0048,p,BRASS,seg=12,rings=6))
    return join(pieces,R+f".sewn-red-cuff{s}",240,"turned red cuff and two brass buttons")


def tail_surface(s,u,v):
    x=s*(.016+.126*u)*(1-.17*v)
    z=.711-.240*v+.027*math.sin(u*math.pi)*v
    # Broad drape folds stay within the already almost-full native depth.
    y=-.102-.004*math.sin(math.pi*v)+.0055*math.sin(u*TAU+.4)*math.sin(math.pi*v)
    return V(x,y,z)


def tails(s):
    tail=lambda u,v:tail_surface(s,u,v)
    pieces=[geo.sheet(R+f".coat-tail{s}",tail,np.linspace(0,1,28),np.linspace(0,1,42),COAT,
                      rim=.0035,back=True,rim_mat=RED,inside=V(0,0,.61))]
    # A triangular red turned-back corner exposes the lining, distinct from
    # the outer blue leaf. It is sewn to the same skirt bone as that leaf.
    def turnback(u,v):
        vv=.65+.35*v
        uu=.62+(.36*u)*(1-v*.72)
        p=tail(uu,vv)+V(0,-.002,0)
        p.y-=.0015*math.sin(math.pi*v)
        return p
    pieces.append(geo.sheet(R+f".tail-red-turnback{s}",turnback,np.linspace(0,1,15),
                            np.linspace(0,1,22),RED,rim=.0015,back=True,inside=V(0,0,.61)))
    pts=[tail(u,1) for u in np.linspace(0,1,32)]
    pieces.append(geo.tube(R+f".coat-tail-binding{s}",pts,[.0013]*32,RED,n=6))
    return join(pieces,R+f".weighted-short-tail{s}",600,"cut split tail broad folds and red lining turnback")


def trousers():
    seat=[]
    for z in np.linspace(.58,.705,34):
        w,f,b=profile([(.58,.075,.065,.08),(.622,.125,.09,.104),(.67,.128,.09,.09),(.705,.117,.08,.082)],float(z))
        seat.append([V(math.sin(a)*w,math.cos(a)*(f if math.cos(a)>0 else b),z) for a in np.linspace(0,TAU,64,endpoint=False)])
    pieces=[geo.loft(R+".source-trouser-seat",seat,WHITE,start="pole",end="pole")]
    for s in (-1,1):
        path=curve([HIP[s]+V(0,0,.035),(HIP[s]+KNEE[s])/2,KNEE[s],KNEE[s]+(ANKLE[s]-KNEE[s])*.16],24)
        rr=[profile([(0,.067,.072),(.18,.074,.077),(.44,.066,.071),(.68,.052,.058),
                     (.82,.045,.048),(1,.040,.038)],i/(len(path)-1)) for i in range(len(path))]
        rows=geo.rings_along(path,rr,n=56,up=(1,0,0))
        for j,row in enumerate(rows):
            t=j/(len(rows)-1)
            for i,p in enumerate(row):
                q=i/56*TAU
                normal=(p-path[j]).normalized()
                relief=.011*g(t,.38,.20)*max(0,normal.x*s)**3
                relief+=.0075*g(t,.73,.085)*max(0,-normal.x*s)**4
                relief+=.006*g(t,.40,.22)*max(0,normal.y)**4
                relief+=.009*g(t,.84,.082)*max(0,normal.y)**5  # patella
                relief+=fold_relief(t,q,.14,.065,.029,.0050,.4)
                relief+=fold_relief(t,q,.78,-.060,.028,.0048,-.7)
                relief+=fold_relief(t,q,.96,.035,.023,.0038,.2)
                row[i]=p+normal*relief
        pieces.append(geo.loft(R+f".source-trouser-leg{s}",rows,WHITE,start="pole",end="flat"))
    return tag(union(pieces,R+".connected-white-trousers",WHITE,.00215),4000,"slim quadriceps patella forms and tension folds in white trousers")


def weight_trousers(obj,armature):
    p=np.array([v.co[:] for v in obj.data.vertices]);x,y,z=p.T
    below=1-soft(.607,.699,z);side=soft(-.016,.016,x);values={"torso":1-below}
    for s,suffix in ((-1,"L"),(1,"R")):
        share=below*(side if s>0 else 1-side);knee=1-soft(KNEE[s].z-.032,KNEE[s].z+.046,z)
        values["leg"+suffix]=share*(1-knee);values["knee"+suffix]=share*knee
    weight(obj,armature,values)


def gaiter_rows(s):
    k,a=KNEE[s],ANKLE[s]
    path=[k+(a-k)*t for t in np.linspace(.1,1,42)]
    radii=[profile([(0,.040,.042),(.18,.053,.052),(.35,.054,.055),
                    (.58,.041,.043),(.82,.030,.033),(1,.026,.029)],i/41) for i in range(42)]
    rows=geo.rings_along(path,radii,n=56,up=(1,0,0))
    for j,row in enumerate(rows):
        t=j/41
        for i,p in enumerate(row):
            normal=(p-path[j]).normalized()
            relief=.009*g(t,.28,.18)*max(0,-normal.y)**4
            relief+=.003*g(t,.25,.16)*abs(normal.x)**3*max(0,-normal.y)
            relief+=.003*g(t,.40,.29)*max(0,normal.y)**7
            relief-=.003*g(t,.79,.12)*max(0,-normal.y)**4
            row[i]=p+normal*relief
    return rows


def gaiter_shoe(s):
    a=ANKLE[s]
    rows=gaiter_rows(s)
    pieces=[geo.loft(R+f".gaiter-source{s}",rows,BLACK,start="flat",end="flat")]
    for t in np.linspace(.18,.88,6):
        row=rows[round(float(t)*41)]
        p=max(row,key=lambda point:s*point.x)+V(s*.0014,0,0)
        pieces.append(geo.ball(R+f".gaiter-button{s}-{t}",.0034,p,BLACK,seg=10,rings=5))
    seam=[max(row,key=lambda point:s*point.x)+V(s*.0008,0,0) for row in rows[2:-2]]
    pieces.append(geo.tube(R+f".gaiter-side-seam{s}",seam,[.0009]*38,BLACK,n=6))
    gaiter=join(pieces,R+f".buttoned-gaiter{s}",520,"fitted calf heads tibial front gaiter seams and buttons")
    rows=[]
    for z,w,d,cy in [(0,.044,.105,.05),(.013,.045,.106,.051),(.032,.043,.104,.051),(.052,.041,.086,.04),(.085,.028,.036,.022)]:
        rows.append([V(a.x+math.copysign(abs(math.sin(q))**.76,math.sin(q))*w,
                       cy+math.copysign(abs(math.cos(q))**.76,math.cos(q))*d,z)
                     for q in np.linspace(0,TAU,64,endpoint=False)])
    pieces=[geo.loft(R+f".shoe-upper{s}",rows,BLACK,start="flat",end="pole")]
    pieces.append(geo.rbox(R+f".shoe-heel{s}",(.054,.044,.022),V(a.x,-.022,.016),BLACK,levels=1,crease=.6))
    seam=[p+V(0,0,.002) for p in rows[1]]
    pieces.append(geo.tube(R+f".shoe-welt{s}",seam+[seam[0]],[.0010]*65,STITCH,n=6))
    return gaiter,join(pieces,R+f".constructed-shoe{s}",600,"heel sole and shaped instep")


def hand_frame(s):
    down=(WR[s]-EL[s]).normalized();palm=V(-s,0,0)
    palm=(palm-down*palm.dot(down)).normalized();across=down.cross(palm).normalized()
    return down,palm,across


def grip(s):
    down,palm,across=hand_frame(s)
    return WR[s]+down*.046


def stick_axis(s):
    # Natural rest: stick points diagonally down/out, never through the drum.
    return V(s*.56,.22,-.80).normalized()


def hand(s):
    down,palm,across=hand_frame(s);wr=WR[s];c=grip(s);axis=stick_axis(s)
    rows=[]
    for t in np.linspace(-.024,.052,40):
        w,d=profile([(-.024,.026,.024),(0,.023,.020),(.02,.032,.025),(.042,.033,.024),(.052,.026,.018)],float(t))
        rows.append([wr+down*t+across*math.sin(q)*w+palm*math.cos(q)*(d+.004*g(float(t),.019,.018)) for q in np.linspace(0,TAU,48,endpoint=False)])
    pieces=[geo.loft(R+f".source-gripping-palm{s}",rows,SKIN,start="pole",end="pole")]
    # Four fingers wrap individually around the rod at spaced longitudinal positions.
    radial=palm-axis*palm.dot(axis);radial.normalize();around=axis.cross(radial).normalized()
    for finger in range(4):
        offset=(finger-1.5)*.014
        pts=[]
        for q in np.linspace(-1.9,2.7,35):
            radius=.012+.002*g(float(q),-.6,.5)
            pts.append(c+axis*offset+radial*math.cos(q)*radius+around*math.sin(q)*radius)
        pieces.append(geo.tube(R+f".source-hooked-digit{s}-{finger}",pts,
                               [(.0067*(1-.12*i/34),.0058) for i in range(35)],SKIN,n=18,up=axis))
        # Connect the proximal phalanx into its knuckle, retaining the web.
        base=wr+down*.028+across*((finger-1.5)*.015)
        bridge=curve([base,base+down*.018,pts[0]],7)
        pieces.append(geo.tube(R+f".source-knuckle{s}-{finger}",bridge,[.0080]*len(bridge),SKIN,n=18,up=across))
    thumb=curve([wr+down*.013-across*.025,wr+down*.03-across*.04+palm*.009,
                 c+radial*.017+axis*.026,c+radial*.007+axis*.035],10)
    pieces.append(geo.tube(R+f".source-thumb{s}",thumb,[.009*(1-.25*i/(len(thumb)-1)) for i in range(len(thumb))],SKIN,n=22,up=across))
    return tag(union(pieces,R+f".anatomical-gripping-hand{s}",SKIN,.00110),1700,"palm five distinct fingers and thumb around stick")


def stick(s):
    c,axis=grip(s),stick_axis(s)
    path=[c+axis*t for t in (-BUTT_LENGTH,-.045,0,.118,.145,.154,TIP_LENGTH)]
    radii=[.0035,.0045,.0045,.0032,.0023,.0035,.0024]
    # Keep its 432 triangles intact: the draft solves contact from this
    # exact bead surface, so reduction must not change its support radius.
    return tag(geo.tube(R+f".turned-wood-stick{s}",path,radii,WOOD,n=24,up=(0,1,0)),450,"fixed wooden stick and protected contact bead")


def face_point(a,z,lift=0):
    w,f,b=profile(FACE,z);sn,cs=math.sin(a),math.cos(a)
    x=math.copysign(abs(sn)**.84,sn)*(w+lift)
    y=-.004+math.copysign(abs(cs)**.89,cs)*((f if cs>=0 else b)+lift)
    ad=abs((math.degrees(a)+180)%360-180)
    if ad<90:
        y+=.010*g(z,1.217,.011)*g(ad,27,16);y-=.0065*g(z,1.199,.012)*g(ad,28,15)
        y+=.018*g(z,1.187,.03)*g(ad,0,7);y+=.025*g(z,1.166,.012)*g(ad,0,11)
        y+=.007*g(z,1.164,.008)*g(ad,15,6);y-=.005*g(z,1.157,.004)*g(ad,16,4)
        y+=.009*g(z,1.165,.023)*g(ad,43,16);y-=.004*g(z,1.132,.018)*g(ad,43,15)
        y+=.004*g(z,1.14,.005)*g(ad,0,26);y+=.004*g(z,1.122,.007)*g(ad,0,23)
        y+=.009*g(z,1.087,.015)*g(ad,0,28)
        y-=.003*g(z,1.108,.006)*g(ad,0,28)
        # The matching mouth bowl is formed in the skull before its lining.
        y-=mouth_recess(a,z,1.130,.028,.015,.083,.0135)
    return V(x,y,z)


def face_normal(a,z):
    n=(face_point(a+.001,z)-face_point(a-.001,z)).cross(face_point(a,z+.0001)-face_point(a,z-.0001)).normalized()
    if n.dot(face_point(a,z)-V(0,0,1.18))<0:n=-n
    return n


def head_skin():
    rows=[[face_point(a,float(z)) for a in np.linspace(0,TAU,128,endpoint=False)] for z in np.linspace(1.063,1.291,104)]
    skull=geo.loft(R+".source-angular-face",rows,SKIN,start="pole",end="pole")
    rows=[[V(math.sin(a)*w,-.004+math.cos(a)*d,z) for a in np.linspace(0,TAU,56,endpoint=False)]
          for z,w,d in [(float(z),*profile([(1.015,.038,.035),(1.06,.029,.029),(1.10,.034,.038)],float(z))) for z in np.linspace(1.015,1.10,32)]]
    neck=geo.loft(R+".source-neck",rows,SKIN,start="pole",end="pole")
    return tag(union([skull,neck],R+".adult-head-neck",SKIN,.0012),3600,"orbital nose angular jaw cheek and neck")


def patch(name,a,z,w,h,mat,lift=.002,slant=0):
    rows=[]
    for r in (.03,.2,.4,.6,.8,1):
        rows.append([face_point(a+math.cos(q)*w*r/.083,z+math.sin(q)*h*r+slant*math.cos(q)*w*r)+
                     face_normal(a+math.cos(q)*w*r/.083,z+math.sin(q)*h*r)*
                     (lift+.0012*(1-r*r)) for q in np.linspace(0,TAU,40,endpoint=False)])
    return geo.loft(name,rows,mat,start="pole")


def features():
    controls={};fixed=[]
    for sign,suffix in ((-1,"L"),(1,"R")):
        a=sign*.49;z=1.20
        eye,pupils,lids=lidded_eye(R+suffix,face_point,face_normal,a,z,.022,.0076,
                                   .083,sign,SKIN,EYE,IRIS,INK,LIP)
        eye.name=R+"eye"+suffix
        controls["eye"+suffix]=tag(eye,200,"convex live eyeball under fleshy lids")
        controls["pupil"+suffix]=join(pupils,R+"pupil"+suffix,140,"live iris pupil and catchlight")
        fixed+=lids
        pts=curve([face_point(a+sign*da,1.222+dz)+face_normal(a+sign*da,1.222+dz)*.0032
                   for da,dz in [(-.21,-.008),(-.07,-.004),(.08,.006),(.25,.007)]],9)
        controls["brow"+suffix]=tag(geo.tube(R+"brow"+suffix,pts,[(.0038,.0024)]*len(pts),HAIR,n=10),80,"focused brow")
        fixed.append(patch(R+f".nostril{sign}",sign*.19,1.158,.0028,.0018,INK,.0009))
        pts=curve([face_point(sign*aa,1.151+dz)+face_normal(sign*aa,1.151+dz)*.0038
                   for aa,dz in [(.01,0),(.11,-.0005),(.25,-.003),(.38,-.001),(.42,.004)]],9)
        fixed.append(geo.tube(R+f".fine-curled-moustache{sign}",pts,
                              [(.0030*(1-.55*i/(len(pts)-1)),.0020) for i in range(len(pts))],HAIR,n=10))
    mouth=shaped_mouth(R,face_point,face_normal,1.130,.028,.015,.083,
                       LIP,MOUTH,EYE,GUM,TONGUE,calling=True)
    controls["mouth"]=join(mouth,R+"mouth",650,"recessed calling mouth dental arch gum tongue and lip volume")
    return controls,join(fixed,R+".face-details",850,"fleshy lids orbital folds moustache and nostrils")


def hair():
    # One connected swept shell; three broad waves are carved into the mass.
    # The shako covers the top. No separate strips hang over the forehead.
    rows=[]
    for t in np.linspace(0,1,54):
        row=[]
        for a in np.linspace(0,TAU,104,endpoint=False):
            ad=abs((math.degrees(a)+180)%360-180)
            lo=profile([(0,1.258),(42,1.251),(74,1.202),(110,1.135),(180,1.129)],ad)[0]
            z=lo*(1-t)+1.291*t
            lift=.010+.004*math.cos(a*3-t*1.9)*math.sin(math.pi*t)**.45
            p=face_point(a,min(z,1.286),lift);p.z=z+.004*t
            row.append(p)
        rows.append(row)
    shell=geo.loft(R+".sculpted-hair-shell",rows,HAIR,end="pole")
    locks=[shell]
    for sign in (-1,1):
        # A large swept temporal lock merges into the shell, ending behind
        # the cheek. A second rear wave gives a readable cut below the hat.
        for centre in (1.16,2.45):
            path=curve([face_point(sign*(centre-.34),1.250,.010),
                        face_point(sign*centre,1.224,.013),
                        face_point(sign*(centre+.22),1.178,.014),
                        face_point(sign*(centre+.16),1.146,.009)],12)
            radii=[profile([(0,.013,.009),(.25,.018,.011),(.65,.016,.010),(1,.0025,.002)],
                           i/(len(path)-1)) for i in range(len(path))]
            locks.append(geo.tube(R+f".broad-hair-wave{sign}-{centre}",path,radii,HAIR,n=28))
    return tag(union(locks,R+".swept-brown-hair",HAIR,.0018),750,
               "continuous swept hair with broad temple and nape locks")


def shako():
    rows=[]
    for z in np.linspace(1.25,1.396,44):
        w,d=profile([(1.25,.084,.086),(1.264,.086,.087),(1.33,.096,.096),(1.38,.106,.102),(1.396,.106,.102)],float(z))
        rows.append([V(math.sin(a)*w,-.008+math.cos(a)*d,z) for a in np.linspace(0,TAU,96,endpoint=False)])
    pieces=[geo.loft(R+".black-wool-shako",rows,FELT,end="flat")]
    for z in (1.256,1.391):
        w,d=profile([(1.25,.085,.087),(1.396,.107,.104)],z)
        ring=[V(math.sin(a)*w,-.008+math.cos(a)*d,z) for a in np.linspace(0,TAU,72,endpoint=False)]
        pieces.append(geo.tube(R+f".shako-leather-band{z}",ring+[ring[0]],[.0034]*73,BLACK,n=8))
    def peak(u,v):
        a=-1.07+2.14*u;r=.083+.053*v
        return V(math.sin(a)*r,-.008+math.cos(a)*r,1.252-.019*v)
    pieces.append(geo.sheet(R+".shako-leather-peak",peak,np.linspace(0,1,40),np.linspace(0,1,10),BLACK,
                            rim=.004,back=True,inside=V(0,0,1.32)))
    plate=[(-.026,-.018),(0,-.039),(.026,-.018),(.028,.019),(0,.035),(-.028,.019)]
    m=geo.basis((1,0,0),(0,0,1),(0,-1,0),V(0,.092,1.331))
    pieces.append(geo.slab(R+".unmarked-brass-shako-plate",plate,.004,BRASS,matrix=m,bevel=.001))
    for z in (1.294,1.316):
        pts=[V(math.sin(a)*.098,-.008+math.cos(a)*.106,z-.027*math.cos(a)) for a in np.linspace(-1.27,1.27,58)]
        pieces.append(geo.tube(R+f".shako-cord{z}",pts,[.0028]*58,WHITE,n=8))
    hat=join(pieces,R+".constructed-black-shako",1250,"felt leather peak two cords blank brass plate")
    centre=V(0,.047,1.423);rows=[]
    for theta in np.linspace(.025,math.pi-.025,36):
        row=[]
        for a in np.linspace(0,TAU,72,endpoint=False):
            radius=.0265*(1+.032*math.sin(a*17+theta*5))
            row.append(centre+V(math.sin(theta)*math.cos(a),math.sin(theta)*math.sin(a),math.cos(theta))*radius)
        rows.append(row)
    pom=tag(geo.loft(R+".wool-pompom",rows,WHITE,start="pole",end="pole"),350,"soft white pompom")
    return hat,pom


def drum():
    axis=DRUM_AX;u=(V(1,0,0)-axis*axis.x).normalized();v=axis.cross(u)
    def ring(h,r):return [DRUM_C+axis*h+(u*math.cos(a)+v*math.sin(a))*r for a in np.linspace(0,TAU,96,endpoint=False)]
    rows=[ring(h,DRUM_R-.003) for h in np.linspace(-DRUM_H*.42,DRUM_H*.42,16)]
    pieces=[geo.loft(R+".brass-drum-shell",rows,BRASS)]
    for sign in (-1,1):
        pieces.append(geo.loft(R+f".drum-blue-hoop{sign}",[ring(sign*DRUM_H*.41,DRUM_R+.001),
                            ring(sign*DRUM_H*.48,DRUM_R+.009),ring(sign*DRUM_H*.52,DRUM_R+.008),
                            ring(sign*DRUM_H*.52,DRUM_R-.002)],COAT))
        pieces.append(geo.loft(R+f".drum-head{sign}",[ring(sign*DRUM_H*.48,DRUM_R-.003)],HEADMAT,end="pole"))
    # Twelve paired white tension ropes, each with a carved leather tensioner.
    for i in range(12):
        a=i/12*TAU;b=(i+.5)/12*TAU
        p0=DRUM_C+axis*DRUM_H*.45+(u*math.cos(a)+v*math.sin(a))*(DRUM_R+.006)
        p1=DRUM_C-axis*DRUM_H*.45+(u*math.cos(b)+v*math.sin(b))*(DRUM_R+.006)
        p2=DRUM_C+axis*DRUM_H*.45+(u*math.cos(a+TAU/12)+v*math.sin(a+TAU/12))*(DRUM_R+.006)
        pieces.append(geo.tube(R+f".white-tension-rope{i}",[p0,p1,p2],[.0027]*3,WHITE,n=8))
        tension=(p0+p1)/2
        pieces.append(geo.ball(R+f".rope-tensioner{i}",1,tension,WHITE,scale=(.008,.005,.008),seg=14,rings=8))
    pieces.append(geo.ball(R+".drum-strap-hook",.008,HOOK,BRASS,seg=20,rings=10))
    return join(pieces,R+".rope-tension-brass-drum",1850,"brass shell batter plane blue hoops zigzag white tension ropes")


def make_rig(root):
    positions={"torso":WAIST,"chest":CHEST,"neck":NECK,"head":HEAD,"hair":V(0,-.015,1.20),
               "hat":V(0,-.008,1.26),"antenna":V(0,.047,1.403),"extra":HOOK,
               "weapon":grip(1),"offhand":grip(-1)}
    parents={"chest":"torso","neck":"chest","head":"neck","hair":"head","hat":"head","antenna":"hat",
             "extra":"chest","weapon":"handR","offhand":"handL"}
    for s,suffix in ((-1,"L"),(1,"R")):
        for stem,p,parent in [("clav",V(s*.032,-.004,1.006),"chest"),("arm",SH[s],"clav"+suffix),
                               ("fore",EL[s],"arm"+suffix),("hand",WR[s],"fore"+suffix),
                               ("skirt",V(s*.069,-.104,.703),"torso"),
                               ("leg",HIP[s],None),("knee",KNEE[s],"leg"+suffix),("foot",ANKLE[s],"knee"+suffix)]:
            positions[stem+suffix]=p
            if parent:parents[stem+suffix]=parent
    return rig(root,positions,parents)


def paint(obj,p,rgb):
    if obj.name==R+".adult-head-neck":
        x,y,z=p.T;warm=np.exp(-((abs(x)-.053)/.024)**2-((z-1.168)/.023)**2)*(y>.02)
        rgb[:,1]-=.04*warm;rgb[:,2]-=.055*warm
    return rgb


def build_master(root_name=R):
    if root_name!=R:raise ValueError("Drummer has a fixed anatomical rig")
    for name in (SKIN,LIP,MOUTH,GUM,TONGUE,HAIR,HAIRLIGHT,RED,WHITE,STITCH,BLACK,FELT,WOOD,BRASS,DARKBRASS,INK,EYE,IRIS,HEADMAT):
        bsdf=kit.material(name).node_tree.nodes.get("Principled BSDF")
        if name.startswith("skin"):bsdf.inputs["Roughness"].default_value=.66
        if name.startswith("weave"):bsdf.inputs["Roughness"].default_value=.89
    root=kit.empty(R);armature=make_rig(root)
    uniform=coat();weight_coat(uniform,armature)
    details=coat_details();weight_coat(details,armature,False)
    pants=trousers();weight_trousers(pants,armature)
    for s,suffix in ((-1,"L"),(1,"R")):
        attach(cuff(s),armature,"fore"+suffix);attach(tails(s),armature,"skirt"+suffix)
        skin=hand(s);down,_,_=hand_frame(s)
        t=np.array([(v.co-WR[s]).dot(down) for v in skin.data.vertices]);share=soft(-.025,.012,t)
        weight(skin,armature,{"fore"+suffix:1-share,"hand"+suffix:share})
        attach(stick(s),armature,"weapon" if s>0 else "offhand")
        gaiter,shoe=gaiter_shoe(s);z=np.array([v.co.z for v in gaiter.data.vertices]);foot=1-soft(.07,.11,z)
        weight(gaiter,armature,{"knee"+suffix:1-foot,"foot"+suffix:foot});attach(shoe,armature,"foot"+suffix)
    skull=head_skin();z=np.array([v.co.z for v in skull.data.vertices]);neck=soft(1.023,1.06,z);head=soft(1.071,1.103,z)
    weight(skull,armature,{"chest":1-neck,"neck":neck*(1-head),"head":neck*head})
    controls,fixed=features();faces(controls,armature);attach(fixed,armature,"head")
    attach(hair(),armature,"hair");hat,pom=shako();attach(hat,armature,"hat");attach(pom,armature,"antenna")
    attach(drum(),armature,"extra")
    kit.refresh();surface_finish(root);color_cache(root,paint)
    root["sourceBrief"]="work/arena/2026-10-08-roster/drummer/brief-v3.md"
    root["restPose"]="hanging arms, soft elbow flexion, inward palms, sticks diagonally down/out"
    root["drumContactContract"]=json.dumps({"centre":list(DRUM_C),"axis":list(DRUM_AX),"head":list(DRUM_TOP),
                                            "radius":DRUM_R-.003,"hook":list(HOOK),"gripToTip":TIP_LENGTH})
    root["runtimeCopyRequired"],root["authorScale"]=True,1.0
    print("DRUMMER R5 SOURCE V3 BUILT",flush=True)
    return root
