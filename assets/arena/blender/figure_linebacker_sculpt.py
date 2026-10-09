"""Private B3 Linebacker master. Never imported by the shipped loader yet.

An adult athlete, constructed shoulder pads, sewn cloth and deforming anatomy.
Moderate sampling and local voxel unions keep the editable source bounded.
"""
import json
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as geo
from figure_linebacker_kit import V, TAU, g, soft, profile, curve, tag, join, union, rig, weight, attach, faces, color_cache, finish_ao, surface_finish
from figure_linebacker_kit import angular, fold_relief, lidded_eye, mouth_recess, shaped_mouth

R = "linebacker"
SKIN = "skin:" + kit.tint("linebacker-b2-skin", "#e2a47f")
LIP = "skin:" + kit.tint("linebacker-b2-lip", "#ab5c50")
MOUTH = "resin:" + kit.tint("linebacker-b3-mouth", "#48261f")
HAIR = "hair:" + kit.tint("linebacker-b2-auburn", "#8b2d13")
HAIRLIGHT = "hair:" + kit.tint("linebacker-b2-lock", "#bb4a1a")
JERSEY, EDGE = "weave:team", "weave:team2"
CREAM = "weave:" + kit.tint("linebacker-b2-stripe", "#efdfbb")
CANVAS = "weave:" + kit.tint("linebacker-b2-canvas", "#baa073")
PAD = "hide:" + kit.tint("linebacker-b2-pad-underlay", "#544337")
LEATHER = "hide:" + kit.tint("linebacker-b2-helmet", "#744525")
WELT = "hide:" + kit.tint("linebacker-b2-helmet-welt", "#b58b51")
BOOT = "hide:" + kit.tint("linebacker-b2-cleat", "#242629")
STEEL = "tin:" + kit.tint("linebacker-b2-steel", "#aab3b9")
BRASS = "gilt:" + kit.tint("linebacker-b2-fastener", "#ad8451")
INK = "resin:" + kit.tint("linebacker-b2-ink", "#322322")
EYE = "resin:" + kit.tint("linebacker-b2-eye", "#f5e8d1")
IRIS = "resin:" + kit.tint("linebacker-b2-hazel", "#685c31")
NAIL = "skin:" + kit.tint("linebacker-b2-nail", "#e7ba9f")
SEAM = "weave:" + kit.tint("linebacker-b2-stitch", "#a4865e")

WAIST, CHEST, NECK, HEAD = V(0, 0, .653), V(0, -.004, .872), V(0, -.006, 1.029), V(0, -.006, 1.063)
SH = {s: V(s*.218, -.002, .958) for s in (-1, 1)}
EL = {s: V(s*.234, .003, .743) for s in (-1, 1)}
WR = {s: V(s*.240, .061, .537) for s in (-1, 1)}
HIP = {s: V(s*.095, -.005, .601) for s in (-1, 1)}
KNEE = {s: V(s*.106, .022, .350) for s in (-1, 1)}
ANKLE = {s: V(s*.113, .021, .087) for s in (-1, 1)}
# R6: a full rib barrel and broad lumbar wall, rather than a tapered jersey.
# Keep the pad/rig envelope; fill the lower ribs and waist inside that frame.
BODY = [(.601,.191,.140,.143),(.644,.216,.151,.156),(.704,.222,.159,.163),
        (.778,.228,.166,.172),(.836,.238,.170,.175),(.893,.240,.166,.168),
        (.939,.230,.151,.151),(.973,.198,.122,.127),(1.006,.108,.078,.079)]
FACE = [(1.050,.038,.042,.044),(1.068,.056,.054,.052),(1.090,.073,.063,.064),
        (1.119,.087,.072,.077),(1.152,.092,.075,.087),(1.183,.089,.066,.088),
        (1.213,.088,.066,.086),(1.246,.077,.061,.077),(1.275,.051,.041,.055),
        (1.289,.005,.005,.006)]


def body_point(a, z, lift=0):
    w, f, b = profile(BODY, z)
    sn, cs = math.sin(a), math.cos(a)
    x = math.copysign(abs(sn)**.84, sn)*(w+lift)
    y = math.copysign(abs(cs)**.84, cs)*((f if cs >= 0 else b)+lift)
    ad = abs((math.degrees(a)+180)%360-180)
    if ad < 90:
        y += .022*g(ad,29,25)*g(z,.880,.061)  # broad loaded pectorals
        y -= .005*g(ad,0,9)*g(z,.895,.061)    # sternum and clavicular hollow
        y -= .008*g(z,.811+.015*math.sin(a)**2,.010)*g(ad,30,34)
        y += .007*g(ad,59,17)*g(z,.821,.060)  # full lower ribs into the flank
    else:
        # Broad scapular shelves and two erector masses give the back structure.
        y -= .014*g(ad,145,25)*g(z,.900,.062)
        y -= .007*g(ad,163,11)*g(z,.790,.104)
        y += .004*g(ad,180,7)*g(z,.884,.082)
    x += math.copysign(.008*g(ad,80,18)*g(z,.808,.083),sn)
    # Three large loaded folds: under the chest, into the waist and at the side.
    y += cs*fold_relief(z,a,.730,.022,.010,.0058,.4)*g(ad,43,51)
    y += cs*fold_relief(z,a,.679,.011,.006,.0046,1.0)
    y += cs*fold_relief(z,a,.768,-.029,.009,.0042,-.5)*g(ad,68,19)
    return V(x,y,z)


def flank_x(y,z):
    # Solve the actual curved rib cage at this height, rather than clamp a
    # sleeve to a vertical x plane. Loaded cloth follows an anatomical side.
    front,back=body_point(0,z).y,body_point(math.pi,z).y
    if y>=front or y<=back:return 0.0
    lo,hi=0.0,math.pi
    for _ in range(16):
        mid=(lo+hi)*.5
        if body_point(mid,z).y>y:lo=mid
        else:hi=mid
    return abs(body_point((lo+hi)*.5,z).x)


def sleeve_rows(s):
    path=curve([SH[s]+V(-s*.035,0,.008),SH[s]+V(0,0,-.032),
                (SH[s]+EL[s])/2,EL[s]+V(0,0,.028)],18)
    radii=[profile([(0,.073,.085),(.15,.083,.093),(.40,.077,.086),
                    (.72,.067,.070),(1,.061,.061)],i/(len(path)-1)) for i in range(len(path))]
    rows=geo.rings_along(path,radii,n=48,up=(1,0,0))
    for j,row in enumerate(rows):
        t=j/(len(rows)-1)
        for i,p in enumerate(row):
            q=i/48*TAU;normal=(p-path[j]).normalized()
            relief=.006*g(t,.25,.21)*angular(q,s*.1,.85)
            relief+=fold_relief(t,q,.74,.065,.034,.0055,.6)
            relief+=fold_relief(t,q,.90,-.048,.030,.0040,-.4)
            point=p+normal*relief
            # Keep a free armpit below the deltoid. Smooth curved clearance
            # keeps the massive sleeve off the flank without a hard wedge.
            if .756<point.z<.938:
                share=float(soft(.938,.898,point.z))*float(soft(.756,.794,point.z))
                shortfall=flank_x(point.y,point.z)+.011-point.x*s
                push=.5*(shortfall+math.sqrt(shortfall*shortfall+.002**2))
                point.x+=s*push*share
            row[i]=point
    return path,rows


def jersey():
    rows=[[body_point(i/80*TAU,float(z)) for i in range(80)] for z in np.linspace(.601,1.006,76)]
    pieces=[geo.loft(R+".source-jersey",rows,JERSEY,start="pole",end="pole")]
    for sign in (-1,1):
        _,rows=sleeve_rows(sign)
        pieces.append(geo.loft(R+f".source-sleeve{sign}",rows,JERSEY,start="pole",end="flat"))
    return tag(union(pieces,R+".connected-jersey",JERSEY,.00235),5350,
               "barrel chest broad back loaded jersey and free anatomical sleeves")


_FLANK_GRID=None


def flank_boundaries(y,z):
    """Small numerical table of the actual rib cage for source skin weights.

    A maximum torso width mislabels the inside of a bulky sleeve as chest.
    Bilinear lookup uses its local depth as well; the free sleeve below the
    shoulder therefore follows its arm rather than stretching from the ribs.
    The table is under 130 KB and is built once, never a voxel allocation.
    """
    global _FLANK_GRID
    if _FLANK_GRID is None:
        zs=np.linspace(.601,1.006,136);ys=np.linspace(-.200,.205,116)
        _FLANK_GRID=np.array([[flank_x(float(y),float(z)) for y in ys] for z in zs])
    zi=np.clip((z-.601)/.405*135,0,134.99999)
    yi=np.clip((y+.200)/.405*115,0,114.99999)
    z0=np.floor(zi).astype(int);y0=np.floor(yi).astype(int)
    dz,dy=zi-z0,yi-y0
    a=_FLANK_GRID[z0,y0]*(1-dy)+_FLANK_GRID[z0,y0+1]*dy
    b=_FLANK_GRID[z0+1,y0]*(1-dy)+_FLANK_GRID[z0+1,y0+1]*dy
    return a*(1-dz)+b*dz


def weight_jersey(obj, armature):
    p=np.array([v.co[:] for v in obj.data.vertices]);x,y,z=p.T
    chest=soft(.770,.905,z)
    values={"torso":1-chest,"chest":chest}
    width=flank_boundaries(y,z)
    for s,suffix in ((-1,"L"),(1,"R")):
        deltoid=soft(.888,.965,z)
        arm=soft(width+.002-.016*deltoid,width+.008,x*s)*(1-soft(.975,1.020,z))
        arm*=soft(.736,.782,z)
        shoulder=soft(.88,.972,z)*soft(.066,.175,x*s)*(1-arm)
        for name in list(values):values[name]*=1-arm
        values["chest"]*=1-shoulder*.45
        values["clav"+suffix]=chest*shoulder*.45*(1-arm)
        fore=1-soft(EL[s].z-.027,EL[s].z+.043,z)
        values["arm"+suffix]=arm*(1-fore)
        values["fore"+suffix]=arm*fore
    weight(obj,armature,values)


def pad_surface(s,a,t,lower=False):
    # A broad overhanging shoulder cap, a separate lower leaf and a deep liner.
    # The outside edge stays inside the measured .63377 native width limit.
    theta=.055+1.68*t
    rx,ry,height=(.101,.113,.057) if lower else (.111,.127,.084)
    base=.936 if lower else .957
    return V(s*(.199+rx*math.sin(theta)*math.cos(a)),
             -.003+ry*math.sin(theta)*math.sin(a),
             base+height*math.cos(theta)-.007*math.sin(a))


def pads(s):
    pieces=[]
    for lower in (True,False):
        rows=[[pad_surface(s,a,float(t),lower) for a in np.linspace(0,TAU,80,endpoint=False)]
              for t in np.linspace(0,1,34)]
        pieces.append(geo.loft(R+f".pad-shell{s}-{lower}",rows,EDGE if lower else JERSEY,
                               start="pole",end="flat"))
        rim=rows[-1]
        pieces.append(geo.tube(R+f".pad-rolled-edge{s}-{lower}",rim+[rim[0]],
                               [.0030 if lower else .0050]*81,CREAM if lower else EDGE,n=10))
    liner=[]
    for z,rx,ry in [(.893,.085,.102),(.904,.100,.116),(.920,.102,.118),(.931,.093,.106)]:
        liner.append([V(s*.199+math.cos(a)*rx,-.003+math.sin(a)*ry,z)
                      for a in np.linspace(0,TAU,64,endpoint=False)])
    pieces.append(geo.loft(R+f".pad-recessed-liner{s}",liner,PAD,start="pole",end="pole"))
    for a in (.61,2.50):
        pts=[pad_surface(s,a,float(t))+V(0,0,.0020) for t in np.linspace(.05,.98,38)]
        pieces.append(geo.tube(R+f".pad-sewn-rib{s}-{a}",pts,[.0011]*38,EDGE,n=6))
    return join(pieces,R+f".constructed-pad{s}",1350,
                "deep layered shoulder caps thick rolled edge and recessed liner")


def jersey_details():
    pieces=[]
    # Open V neck; cream inset stays narrow so the collar reads as stitched cloth.
    pts=[body_point(a,1.000-.043*math.cos(a),.004) for a in np.linspace(-.92,.92,46)]
    pieces.append(geo.tube(R+".bound-v-collar",pts,[(.004,.006)]*len(pts),CREAM,n=8,up=(0,1,0)))
    for s in (-1,1):
        path,sleeve=sleeve_rows(s)
        for band in (.53,.69):
            height=SH[s].z+(EL[s].z-SH[s].z)*band
            centre=min(range(len(path)),key=lambda i:abs(path[i].z-height))
            indices=range(max(0,centre-2),min(len(path),centre+3))
            rows=[[p+(p-path[j]).normalized()*.0014 for p in sleeve[j]] for j in indices]
            pieces.append(geo.loft(R+f".cream-sleeve-stripe{s}-{band}",rows,CREAM))
        pts=[body_point(s*1.15,float(z),.002) for z in np.linspace(.66,.88,42)]
        pieces.append(geo.tube(R+f".jersey-side-seam{s}",pts,[.0009]*len(pts),EDGE,n=6))
    return join(pieces,R+".sewn-jersey-details",550,"two sleeve stripes collar and sparse seams")


def leg_surface(s):
    path=curve([HIP[s]+V(0,0,.035),(HIP[s]+KNEE[s])/2,KNEE[s],
                KNEE[s]+(ANKLE[s]-KNEE[s])*.09],22)
    rr=[]
    for i in range(len(path)):
        t=i/(len(path)-1)
        w,d=profile([(0,.096,.110),(.2,.105,.119),(.43,.098,.112),
                     (.68,.082,.088),(.84,.068,.074),(1,.057,.058)],t)
        rr.append((w,d))
    rows=geo.rings_along(path,rr,n=56,up=(1,0,0))
    for j,row in enumerate(rows):
        t=j/(len(rows)-1)
        for i,p in enumerate(row):
            a=i/56*TAU
            normal=(p-path[j]).normalized()
            # Vastus outer sweep and inner teardrop above a flattened patella.
            relief=.025*g(t,.37,.23)*max(0,normal.x*s)**3
            relief+=.012*g(t,.43,.24)*max(0,normal.y)**4
            relief+=.009*g(t,.76,.10)*max(0,-normal.x*s)**3
            relief+=.008*g(t,.82,.09)*max(0,normal.y)**5
            relief+=fold_relief(t,a,.16,.10,.035,.0075,.3)
            relief+=fold_relief(t,a,.77,-.065,.032,.0058,.9)
            relief+=fold_relief(t,a,.94,.035,.020,.0040,-.8)
            row[i]=p+normal*relief
    return geo.loft(R+f".source-pant-leg{s}",rows,CANVAS,start="pole",end="flat")


def trousers():
    rows=[]
    for z in np.linspace(.525,.678,38):
        w,f,b=profile([(.525,.104,.105,.104),(.565,.174,.132,.143),
                       (.609,.180,.141,.150),(.66,.177,.138,.143),(.678,.170,.130,.134)],float(z))
        rows.append([V(math.sin(a)*w,math.cos(a)*(f if math.cos(a)>0 else b),z)
                     for a in np.linspace(0,TAU,64,endpoint=False)])
    seat=geo.loft(R+".source-pants-seat",rows,CANVAS,start="pole",end="pole")
    return tag(union([seat,leg_surface(-1),leg_surface(1)],R+".connected-canvas-pants",CANVAS,.0021),4100,"broad seat quadriceps teardrops patella and loaded canvas folds")


def weight_pants(obj,armature):
    p=np.array([v.co[:] for v in obj.data.vertices]);x,y,z=p.T
    below=1-soft(.568,.656,z);side=soft(-.018,.018,x)
    values={"torso":1-below}
    for s,suffix in ((-1,"L"),(1,"R")):
        share=below*(side if s>0 else 1-side)
        knee=1-soft(KNEE[s].z-.041,KNEE[s].z+.053,z)
        values["leg"+suffix]=share*(1-knee);values["knee"+suffix]=share*knee
    weight(obj,armature,values)


def lower_leg(s):
    k,a=KNEE[s],ANKLE[s]
    path=[k+(a-k)*t for t in np.linspace(.025,1,44)]
    rr=[profile([(0,.060,.057),(.17,.073,.068),(.37,.075,.065),
                 (.62,.060,.049),(.83,.041,.036),(1,.035,.032)],i/43) for i in range(44)]
    rows=geo.rings_along(path,rr,n=56,up=(1,0,0))
    for j,row in enumerate(rows):
        t=j/43
        for i,p in enumerate(row):
            normal=(p-path[j]).normalized()
            # Two posterior calf heads, a narrow tibial front and Achilles taper.
            relief=.009*g(t,.27,.19)*max(0,-normal.y)**3
            relief+=.004*g(t,.39,.27)*max(0,normal.y)**7
            relief-=.004*g(t,.75,.18)*max(0,-normal.y)**3
            row[i]=p+normal*relief
    pieces=[geo.loft(R+f".ribbed-sock{s}",rows,CREAM,start="flat",end="flat")]
    for t in (.14,.24):
        centre=k+(a-k)*t;axis=(a-k).normalized()
        pts=[centre-axis*.006,centre+axis*.006]
        pieces.append(geo.tube(R+f".sock-blue-band{s}-{t}",pts,[(.076,.078)]*2,
                               JERSEY,n=56,up=(1,0,0),caps=("flat","flat")))
    # Broad stitched patella pad overlaps both thigh and sock at the knee.
    rows=[]
    for r in np.linspace(.025,1,24):
        rows.append([k+V(math.sin(q)*.053*r,.060+.011*(1-r*r),math.cos(q)*.060*r)
                     for q in np.linspace(0,TAU,56,endpoint=False)])
    kp=geo.loft(R+f".knee-pad{s}",rows,CANVAS,start="pole")
    rim=rows[-1]
    edge=geo.tube(R+f".knee-pad-welt{s}",rim+[rim[0]],[.0014]*57,SEAM,n=6)
    return join(pieces,R+f".sock{s}",480,"shaped gastrocnemius tibial front and sock bands"),           join([kp,edge],R+f".knee-pad{s}",350,"stitched patella pad")


def cleat(s):
    a=ANKLE[s];rows=[]
    for z,w,d,cy in [(0,.054,.101,.045),(.014,.054,.107,.047),(.029,.053,.107,.047),
                      (.048,.049,.102,.045),(.07,.038,.070,.03),(.097,.033,.04,.023)]:
        rows.append([V(a.x+math.copysign(abs(math.sin(q))**.75,math.sin(q))*w,
                       cy+math.copysign(abs(math.cos(q))**.73,math.cos(q))*d,z+.004)
                     for q in np.linspace(0,TAU,56,endpoint=False)])
    pieces=[geo.loft(R+f".cleat-upper{s}",rows,BOOT,start="flat",end="pole")]
    for i,(x,y) in enumerate([(-.03,.12),(.03,.12),(-.032,.07),(.032,.07),(-.022,-.027),(.022,-.027)]):
        pieces.append(kit.cylinder(R+f".cleat-stud{s}-{i}",.0065,.006,.011,(a.x+x,y,.0055),verts=10,mat=STEEL))
    for i in range(5):
        y=.059+i*.010;z=.059-i*.003
        pts=[V(a.x-.021,y-.002,z),V(a.x,y+.003,z+.004),V(a.x+.021,y-.002,z)]
        pieces.append(geo.tube(R+f".cleat-lace{s}-{i}",pts,[.0016]*3,CREAM,n=6))
    return join(pieces,R+f".laced-cleat{s}",700,"load-bearing heel sole toe leather and studs")


def hand_frame(s):
    down=(WR[s]-EL[s]).normalized();palm=V(-s,0,0)
    palm=(palm-down*palm.dot(down)).normalized()
    across=down.cross(palm).normalized()
    return down,palm,across


def arm_hand(s):
    sh,el,wr=SH[s],EL[s],WR[s]
    path=curve([sh+V(0,0,-.055),(sh+el)/2,el,(el+wr)/2,wr],20)
    rr=[]
    for i in range(len(path)):
        t=i/(len(path)-1)
        w,d=profile([(0,.069,.081),(.23,.076,.085),(.43,.060,.066),(.52,.050,.054),
                     (.65,.065,.065),(.81,.052,.049),(1,.034,.031)],t)
        rr.append((w,d))
    rows=geo.rings_along(path,rr,n=56,up=(1,0,0))
    for j,row in enumerate(rows):
        t=j/(len(rows)-1)
        for i,p in enumerate(row):
            q=i/56*TAU
            normal=(p-path[j]).normalized()
            # Biceps/triceps, olecranon, brachioradialis and ulnar wrist plane.
            relief=.013*g(t,.23,.17)*max(0,normal.y)**3
            relief+=.011*g(t,.27,.16)*max(0,-normal.y)**4
            relief+=.006*g(t,.49,.045)*max(0,-normal.y)**5
            relief-=.004*g(t,.51,.042)*max(0,normal.y)**4
            relief+=.008*g(t,.68,.12)*max(0,normal.x*s)**3
            relief+=.003*g(t,.91,.13)*max(0,-normal.y)**6
            point=p+normal*relief
            # The broader waist needs room beside the exposed forearm.
            # Shape its inner plane to the curved jersey; retain the outer
            # muscle mass and all joints within the accepted pad envelope.
            if normal.x*s<0 and .578<point.z<.790:
                share=float(soft(.790,.751,point.z))*float(soft(.578,.610,point.z))
                shortfall=flank_x(point.y,point.z)+.0065-point.x*s
                point.x+=s*.5*(shortfall+math.sqrt(shortfall*shortfall+.001**2))*share
            row[i]=point
    pieces=[geo.loft(R+f".source-arm-skin{s}",rows,SKIN,start="pole",end="pole")]
    down,palm,across=hand_frame(s);rows=[]
    for t in np.linspace(-.026,.066,42):
        w,d=profile([(-.026,.032,.028),(0,.033,.025),(.026,.044,.030),(.052,.043,.026),(.066,.035,.018)],float(t))
        row=[]
        for q in np.linspace(0,TAU,56,endpoint=False):
            side=math.sin(q);face=math.cos(q)
            thenar=.009*g(float(t),.027,.023)*max(0,-side)**4
            hypothenar=.0045*g(float(t),.039,.020)*max(0,side)**4
            knuckles=sum(.0024*g(w*side,(finger-1.5)*.019,.0065) for finger in range(4))
            dorsal=knuckles*g(float(t),.056,.007)*max(0,-face)**4
            row.append(wr+down*t+across*side*(w+.003*g(float(t),.054,.009))+
                       palm*face*(d+thenar+hypothenar+dorsal))
        rows.append(row)
    pieces.append(geo.loft(R+f".source-palm{s}",rows,SKIN,start="pole",end="pole"))
    nails=[]
    for finger in range(4):
        base=wr+down*.059+across*((finger-1.5)*.019)
        length=[.054,.064,.060,.047][finger]
        pts=curve([base-down*.009,base+down*.013,base+down*(length*.65)+palm*.006,
                   base+down*(length*.92)+palm*.019],9)
        rr=[(.0090*(1-.24*j/(len(pts)-1)),.0078*(1-.22*j/(len(pts)-1))) for j in range(len(pts))]
        pieces.append(geo.tube(R+f".source-digit{s}-{finger}",pts,rr,SKIN,n=20,up=across))
        n=geo.ball(R+f".nail{s}-{finger}",1,pts[-3]-palm*.0057,NAIL,
                   scale=(.004,.003,.006),seg=14,rings=8)
        nails.append(n)
    thumb=curve([wr+down*.012-across*.025,wr+down*.028-across*.046+palm*.008,
                 wr+down*.055-across*.044+palm*.019,wr+down*.066-across*.03+palm*.025],11)
    pieces.append(geo.tube(R+f".source-thumb{s}",thumb,
                           [(.011-.004*j/(len(thumb)-1),.009-.003*j/(len(thumb)-1)) for j in range(len(thumb))],
                           SKIN,n=24,up=across))
    nails.append(geo.ball(R+f".thumb-nail{s}",1,thumb[-3]-palm*.007,NAIL,scale=(.005,.003,.007),seg=14,rings=8))
    skin=tag(union(pieces,R+f".connected-arm-hand{s}",SKIN,.00135),2600,"shaped forearm palm thenar and five separate digits")
    return skin,join(nails,R+f".nails{s}",110,"five individual nails")


def face_point(a,z,lift=0):
    w,f,b=profile(FACE,z);sn,cs=math.sin(a),math.cos(a)
    x=math.copysign(abs(sn)**.89,sn)*(w+lift)
    y=-.006+math.copysign(abs(cs)**.90,cs)*((f if cs>=0 else b)+lift)
    ad=abs((math.degrees(a)+180)%360-180)
    if ad<90:
        y+=.009*g(z,1.209,.011)*g(ad,26,15)   # brow ridge
        y-=.006*g(z,1.189,.012)*g(ad,26,16)   # eye sockets
        y+=.017*g(z,1.18,.025)*g(ad,0,8)     # bridge
        y+=.024*g(z,1.162,.011)*g(ad,0,11)   # tip
        y+=.008*g(z,1.161,.008)*g(ad,14,6)   # alar wings
        y-=.006*g(z,1.153,.004)*g(ad,15,4)   # nostril groove
        y+=.008*g(z,1.158,.024)*g(ad,43,18)  # zygomatic plane
        y-=.003*g(z,1.127,.019)*g(ad,45,18)
        y+=.003*g(z,1.137,.005)*g(ad,0,24)
        y+=.005*g(z,1.121,.007)*g(ad,0,23)
        y-=.003*g(z,1.13,.004)*g(ad,0,25)
        y+=.009*g(z,1.085,.015)*g(ad,0,29)   # broad chin and set jaw
        y-=.0035*g(z,1.106,.005)*g(ad,0,31)  # labiomental fold
        y-=mouth_recess(a,z,1.132,.032,.0048,.09,.0045)
    return V(x,y,z)


def face_normal(a,z):
    normal=(face_point(a+.001,z)-face_point(a-.001,z)).cross(
        face_point(a,z+.0001)-face_point(a,z-.0001)).normalized()
    if normal.dot(face_point(a,z)-V(0,-.006,1.18))<0:normal=-normal
    return normal


def neck_point(a,z):
    """Wide nape, paired sternomastoids and a trapezius shelf into the pads."""
    w,d=profile([(.981,.102,.080),(1.009,.092,.080),(1.042,.077,.067),
                 (1.067,.068,.064),(1.113,.050,.052)],z)
    sn,cs=math.sin(a),math.cos(a)
    ad=abs((math.degrees(a)+180)%360-180)
    x=sn*w
    y=-.006+cs*d
    y+=.007*g(ad,43,17)*g(z,1.037,.041)
    y-=.008*g(ad,151,30)*g(z,1.009,.033)
    x+=math.copysign(.005*g(ad,78,20)*g(z,1.016,.026),sn)
    return V(x,y,z)


def head_skin():
    rows=[[face_point(i/128*TAU,float(z)) for i in range(128)] for z in np.linspace(1.05,1.289,112)]
    skull=geo.loft(R+".source-adult-face",rows,SKIN,start="pole",end="pole")
    rows=[]
    for z in np.linspace(.981,1.113,40):
        rows.append([neck_point(a,float(z)) for a in np.linspace(0,TAU,56,endpoint=False)])
    neck=geo.loft(R+".source-neck",rows,SKIN,start="pole",end="pole")
    return tag(union([skull,neck],R+".adult-face-neck",SKIN,.0012),3800,"adult face wide neck sternomastoids and trapezius shelf")


def patch(name,a,z,w,h,mat,lift=.002,slant=0):
    c=geo.Mesh(name,mat);rows=[]
    for r in (.03,.2,.4,.6,.8,1):
        rows.append([c.v(face_point(a+math.cos(q)*w*r/.09,z+math.sin(q)*h*r+slant*math.cos(q)*w*r)+
                        face_normal(a+math.cos(q)*w*r/.09,z+math.sin(q)*h*r)*
                        (lift+.0012*(1-r*r))) for q in np.linspace(0,TAU,40,endpoint=False)])
    c.fan(rows[0],face_point(a,z)+face_normal(a,z)*(lift+.0013),flip=True)
    c.grid(rows,closed=True)
    return c.obj(outward=V(0,-.006,1.18))


def features():
    controls={};fixed=[]
    for sign,suffix in ((-1,"L"),(1,"R")):
        a=sign*math.radians(27);z=1.19
        eye,pupils,lids=lidded_eye(R+suffix,face_point,face_normal,a,z,.023,.0077,
                                   .09,sign,SKIN,EYE,IRIS,INK,LIP)
        eye.name=R+"eye"+suffix
        controls["eye"+suffix]=tag(eye,200,"convex live eyeball inside sculpted lids")
        controls["pupil"+suffix]=join(pupils,R+"pupil"+suffix,140,"live iris pupil and catchlight")
        fixed+=lids
        pts=curve([face_point(a+sign*da,1.212+dz)+face_normal(a+sign*da,1.212+dz)*.003
                   for da,dz in [(-.23,-.008),(-.12,-.006),(.04,.004),(.22,.007)]],8)
        controls["brow"+suffix]=tag(geo.tube(R+"brow"+suffix,pts,[(.004,.0025)]*len(pts),HAIR,n=10),90,"knitted auburn brow")
        fixed.append(patch(R+f".nostril{sign}",sign*.19,1.154,.003,.0018,INK,.0008))
    mouth=shaped_mouth(R,face_point,face_normal,1.132,.032,.0048,.09,
                       LIP,MOUTH,EYE,LIP,LIP,calling=False)
    controls["mouth"]=join(mouth,R+"mouth",420,"clenched dental arch tense lip volume and jaw")
    return controls,join(fixed,R+".fixed-facial-details",680,"fleshy eyelids orbital folds and nostrils")


def helmet_surface(a,t):
    # A true oval dome closes at the crown; the previous tiny top ring made
    # a visible flat chimney. The leather now covers the entire front scalp.
    ad=abs((math.degrees(a)+180)%360-180)
    lower=profile([(0,1.229),(43,1.224),(76,1.183),(111,1.171),(180,1.192)],ad)[0]
    latitude=math.acos((lower-1.202)/.103)*(1-t)
    panel=.0014*math.cos(a*6)**2*math.sin(latitude)
    return V(math.sin(a)*(.105+panel)*math.sin(latitude),
             -.012+math.cos(a)*(.102+panel)*math.sin(latitude),
             1.202+.103*math.cos(latitude))


def ear_flap(s,u,v):
    # A rounded protective cheek/ear leaf, wide at the ear and inset at the
    # jaw attachment. It is leather over the skull, with no exposed hair fringe.
    x=s*(.094+.014*(1-u*u)*math.sin(math.pi*(v+1)/2))
    y=-.011+.041*u*(1-.12*max(0,-v))
    z=1.157+.055*v
    return V(x,y,z)


def helmet_hair():
    rows=[[helmet_surface(a,float(t)) for a in np.linspace(0,TAU,96,endpoint=False)]
          for t in np.linspace(0,.9999,56)]
    pieces=[geo.loft(R+".panelled-leather-helmet",rows,LEATHER,end=V(0,-.012,1.305))]
    rim=rows[0]
    pieces.append(geo.tube(R+".helmet-bound-rim",rim+[rim[0]],[.0036]*97,WELT,n=8))
    for a in (0,math.pi/3,-math.pi/3,math.pi):
        pts=[helmet_surface(a,float(t))+V(0,0,.001) for t in np.linspace(.015,.99,44)]
        pieces.append(geo.tube(R+f".helmet-panel-seam{a}",pts,[.0012]*44,WELT,n=6))
    for sign in (-1,1):
        rows=[]
        for r in np.linspace(.02,1,26):
            rows.append([ear_flap(sign,float(r)*math.copysign(abs(math.cos(q))**.75,math.cos(q)),
                                  float(r)*math.sin(q)) for q in np.linspace(0,TAU,64,endpoint=False)])
        flap=geo.loft(R+f".leather-ear-flap{sign}",rows,LEATHER,start="pole")
        pieces.append(flap)
        rim=rows[-1]
        pieces.append(geo.tube(R+f".ear-flap-bound-edge{sign}",rim+[rim[0]],[.0025]*65,WELT,n=8))
        for zz in (1.170,1.119):
            pieces.append(geo.ball(R+f".helmet-rivet{sign}-{zz}",.0036,V(sign*.103,.008,zz),STEEL,seg=14,rings=8))
        for yy,zz in ((-.016,1.169),(.003,1.157),(-.016,1.145)):
            pieces.append(geo.ball(R+f".ear-vent{sign}-{yy}-{zz}",1,V(sign*.109,yy,zz),INK,
                                   scale=(.0009,.0030,.0030),seg=12,rings=8))
    bar=curve([V(-.104,.029,1.126),V(-.096,.10,1.092),V(-.035,.146,1.084),
               V(.035,.146,1.084),V(.096,.10,1.092),V(.104,.029,1.126)],8)
    pieces.append(geo.tube(R+".single-steel-face-bar",bar,[.0056]*len(bar),STEEL,n=12))
    helmet=join(pieces,R+".stitched-leather-helmet",1500,"closed leather crown rounded ear flaps and one steel bar")
    # One hidden rear scalp cap, no locks across the helmet's front rim.
    def rear(a,t):
        z=1.147+.099*t
        return face_point(a,z,.008)
    tucked=tag(geo.sheet(R+".tucked-rear-hair",rear,np.linspace(1.42,TAU-1.42,64),
                         np.linspace(0,1,28),HAIR,rim=.002,back=True,inside=V(0,0,1.20)),
               220,"rear hair mass tucked beneath helmet")
    path=curve([V(0,-.088,1.214),V(-.010,-.123,1.202),V(-.014,-.146,1.158),
                V(.008,-.144,1.105),V(.014,-.129,1.049)],14)
    radii=[profile([(0,.019,.016),(.16,.030,.024),(.4,.032,.027),(.65,.027,.023),(1,.011,.010)],
                   i/(len(path)-1)) for i in range(len(path))]
    rows=geo.rings_along(path,radii,n=56,up=(1,0,0))
    for j,row in enumerate(rows):
        t=j/(len(rows)-1)
        for i,p in enumerate(row):
            q=i/56*TAU
            # Four large locks share a continuous mass; shallow grooves only.
            relief=.0030*math.cos(q*4-t*2.5)*math.sin(math.pi*t)**.5
            row[i]=p+(p-path[j]).normalized()*relief
    pony=geo.loft(R+".continuous-auburn-ponytail",rows,HAIR,start="pole",end="pole")
    binding=geo.tube(R+".ponytail-binding",[path[0]+V(0,-.005,0),path[0]+V(0,-.016,0)],
                     [(.021,.019)]*2,EDGE,n=32)
    return helmet,tucked,join([pony,binding],R+".groomed-ponytail",850,"single flowing hair mass four broad locks")




def make_rig(root):
    positions={"torso":WAIST,"chest":CHEST,"neck":NECK,"head":HEAD,
               "hat":V(0,-.006,1.227),"hair":V(0,-.086,1.215)}
    parents={"chest":"torso","neck":"chest","head":"neck","hat":"head","hair":"head"}
    for s,suffix in ((-1,"L"),(1,"R")):
        for stem,p,parent in [("clav",V(s*.043,-.004,.967),"chest"),("arm",SH[s],"clav"+suffix),
                               ("fore",EL[s],"arm"+suffix),("hand",WR[s],"fore"+suffix),
                               ("sleeve",V(s*.202,-.003,.946),"clav"+suffix),
                               ("leg",HIP[s],None),("knee",KNEE[s],"leg"+suffix),("foot",ANKLE[s],"knee"+suffix)]:
            positions[stem+suffix]=p
            if parent:parents[stem+suffix]=parent
    return rig(root,positions,parents)


def paint(obj,p,rgb):
    x,y,z=p.T
    if obj.name==R+".adult-face-neck":
        cheek=np.exp(-((abs(x)-.060)/.024)**2)*np.exp(-((z-1.153)/.022)**2)*(y>.02)
        rgb[:,1]-=.055*cheek;rgb[:,2]-=.064*cheek
        # Deterministic freckle pigment, no geometry noise or secondary colour set.
        rng=np.random.default_rng(19)
        for _ in range(32):
            cx=rng.uniform(.025,.079)*(-1 if rng.random()<.5 else 1)
            cz=rng.uniform(1.141,1.174);radius=rng.uniform(.0009,.0016)
            dot=np.exp(-((x-cx)/radius)**2-((z-cz)/radius)**2)*(y>.035)
            rgb-=dot[:,None]*np.array([.19,.23,.25])
    return rgb


def build_master(root_name=R):
    if root_name!=R:raise ValueError("Linebacker has a fixed anatomical rig")
    for name in (SKIN,LIP,MOUTH,HAIR,HAIRLIGHT,CREAM,CANVAS,PAD,LEATHER,WELT,BOOT,STEEL,BRASS,INK,EYE,IRIS,NAIL,SEAM):
        m=kit.material(name);bsdf=m.node_tree.nodes.get("Principled BSDF")
        if name.startswith("skin"):
            bsdf.inputs["Roughness"].default_value=.65;bsdf.inputs["Specular IOR Level"].default_value=.26
        if name.startswith("weave"):bsdf.inputs["Roughness"].default_value=.88
    root=kit.empty(R);armature=make_rig(root)
    shirt=jersey();weight_jersey(shirt,armature)
    details=jersey_details();weight_jersey(details,armature)
    pants=trousers();weight_pants(pants,armature)
    for s,suffix in ((-1,"L"),(1,"R")):
        attach(pads(s),armature,"sleeve"+suffix)
        skin,nails=arm_hand(s)
        z=np.array([v.co.z for v in skin.data.vertices])
        fore=1-soft(EL[s].z-.035,EL[s].z+.04,z);hand=1-soft(WR[s].z-.019,WR[s].z+.028,z)
        weight(skin,armature,{"arm"+suffix:1-fore,"fore"+suffix:fore*(1-hand),"hand"+suffix:fore*hand})
        attach(nails,armature,"hand"+suffix)
        sock,kp=lower_leg(s)
        weight(sock,armature,{"knee"+suffix:1.0})
        z=np.array([v.co.z for v in kp.data.vertices]);share=1-soft(KNEE[s].z-.022,KNEE[s].z+.035,z)
        weight(kp,armature,{"leg"+suffix:1-share,"knee"+suffix:share})
        attach(cleat(s),armature,"foot"+suffix)
        tape=geo.tube(R+f".wrist-tape{s}",[WR[s]+(EL[s]-WR[s]).normalized()*.024,WR[s]],[(.035,.031)]*2,
                      CREAM,n=40,up=(1,0,0),caps=("flat","flat"))
        attach(tag(tape,140,"wrist tape"),armature,"fore"+suffix)
    skull=head_skin();z=np.array([v.co.z for v in skull.data.vertices])
    neck=soft(1.009,1.05,z);head=soft(1.052,1.086,z)
    weight(skull,armature,{"chest":1-neck,"neck":neck*(1-head),"head":neck*head})
    controls,fixed=features();faces(controls,armature);attach(fixed,armature,"head")
    helmet,fringe,tail=helmet_hair()
    attach(helmet,armature,"hat");attach(fringe,armature,"head");attach(tail,armature,"hair")
    kit.refresh();surface_finish(root);color_cache(root,paint)
    root["sourceBrief"]="work/arena/2026-10-08-roster/linebacker/brief-v3.md"
    root["restPose"]="hanging arms, 14 degree soft elbow flexion, inward palms, open relaxed hands"
    root["runtimeCopyRequired"]=True;root["authorScale"]=1.0
    print("LINEBACKER R5 SOURCE V3 BUILT",flush=True)
    return root
