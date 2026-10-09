"""Samurai-only authored anatomy, continuous cloth and native joint frames.

Editable source first; figure_duelist_runtime reduces an independently copied
reviewed master. +Y faces forward and Z is up. No uniform scale is introduced.
Arm pivots and both grip centres match the historical katana exactly.
"""
import json
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import kit
import face_rig
import figure_duelist_kit as dk

V = dk.V
TAU = math.tau
SKIN = "skin:" + kit.tint("samurai-skin-sculpt", "#d5a080")
HAIR = "hair:" + kit.tint("samurai-hair-sculpt", "#282326")
NAIL = "skin:" + kit.tint("samurai-nail-sculpt", "#dcb49b")
SHADOW = "resin:" + kit.tint("samurai-face-shadow", "#62463e")
EYE = "resin:" + kit.tint("samurai-ivory-sculpt", "#e9dfc9")
IRIS = "resin:" + kit.tint("samurai-iris-sculpt", "#372b23")
CLOTH = "weave:" + kit.tint("samurai-underrobe-sculpt", "#34404b")
TROUSER = "weave:" + kit.tint("samurai-hakama-sculpt", "#343740")

FACE = [
    (1.051, .025, .037, .029), (1.066, .041, .062, .043),
    (1.084, .061, .078, .058), (1.108, .072, .084, .071),
    (1.134, .078, .082, .079), (1.159, .081, .080, .085),
    (1.182, .079, .080, .088), (1.203, .081, .083, .089),
    (1.229, .082, .086, .087), (1.254, .073, .083, .078),
    (1.278, .053, .065, .058), (1.295, .018, .024, .020)]


def g(value, centre, radius):
    return math.exp(-((value - centre) / radius) ** 2)


def ss(lo, hi, values):
    t = np.clip((values - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def table(rows, value):
    """Bounded Hermite sections keep anatomy smooth across control rows."""
    if value <= rows[0][0]:
        return rows[0][1:]
    if value >= rows[-1][0]:
        return rows[-1][1:]
    for i, (a, b) in enumerate(zip(rows, rows[1:])):
        if value > b[0]:
            continue
        prev, nxt = rows[max(0, i - 1)], rows[min(len(rows) - 1, i + 2)]
        t = (value - a[0]) / (b[0] - a[0])
        result = []
        for c in range(1, len(a)):
            ma = (b[c] - prev[c]) / (b[0] - prev[0])
            mb = (nxt[c] - a[c]) / (nxt[0] - a[0])
            v = ((2*t**3-3*t*t+1)*a[c] + (t**3-2*t*t+t)*ma*(b[0]-a[0])
                 +(-2*t**3+3*t*t)*b[c]+(t**3-t*t)*mb*(b[0]-a[0]))
            result.append(max(min(a[c], b[c]), min(max(a[c], b[c]), v)))
        return result


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def white_colors(obj):
    colors = obj.data.color_attributes
    for layer in list(colors):
        colors.remove(layer)
    layer = colors.new(name="AO", type="FLOAT_COLOR", domain="CORNER")
    rgba = np.ones(len(layer.data) * 4, dtype=np.float32)
    layer.data.foreach_set("color", rgba)
    colors.active_color = layer
    colors.render_color_index = 0


def fuse(parts, name, mat, voxel, iterations=2):
    """Unify connected authored shells, retaining meaningful sculpt relief."""
    for obj in parts:
        kit.apply(obj)
        kit.apply_transform(obj)
    obj = kit.join(parts, name)
    select(obj)
    mod = obj.modifiers.new("Authored connected surface", "REMESH")
    mod.mode = "VOXEL"
    mod.voxel_size = voxel
    mod.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if iterations:
        mod = obj.modifiers.new("Soft tissue transitions", "SMOOTH")
        mod.factor, mod.iterations = .45, iterations
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.clear()
    obj.data.materials.append(kit.material(mat))
    for face in obj.data.polygons:
        face.use_smooth = True
    dk.uv_fine(obj)
    white_colors(obj)
    return obj


def face_point(angle, z, offset=0):
    """Adult cheek, orbital, nasal and lip planes within one skin surface."""
    width, front, back = table(FACE, z)
    sin, cos = math.sin(angle), math.cos(angle)
    # angle 0 is forward, unlike the historical armour's angular frames.
    x = math.copysign(abs(sin) ** .91, sin) * (width + offset)
    y = .008 + math.copysign(abs(cos) ** .96, cos) * ((front if cos >= 0 else back) + offset)
    ad = abs((math.degrees(angle) + 180) % 360 - 180)
    if cos > 0:
        # Recess the eyes into a brow/cheek structure, not a round muzzle.
        y -= .0075*g(ad, 25, 13)*g(z, 1.180, .012)
        y += .0072*g(ad, 27, 15)*g(z, 1.202, .015)
        y += .0044*g(ad, 47, 16)*g(z, 1.158, .012)
        y -= .0032*g(ad, 53, 17)*g(z, 1.123, .021)
        # Broad nasal bridge tapers into the tip and alar wings.
        y += .009*g(ad, 0, 11)*g(z, 1.178, .026)
        y += .027*g(ad, 0, 13)*g(z, 1.150, .013)
        y += .009*g(ad, 15, 6)*g(z, 1.144, .007)
        y -= .003*g(ad, 19, 6)*g(z, 1.132, .012)
        # Philtrum, slightly raised lip edges, recessed closed mouth.
        y += .0026*g(ad, 5, 4)*g(z, 1.125, .010)
        mouth = 1.109 - .003*(ad/30)**1.5
        y += .0035*g(ad, 0, 23)*g(z, mouth+.004, .003)
        y += .0032*g(ad, 0, 21)*g(z, mouth-.004, .004)
        y -= .0025*g(ad, 0, 25)*g(z, mouth, .0018)
        # A distinct chin and shallow crease below the lower lip.
        y += .007*g(ad, 0, 29)*g(z, 1.080, .010)
        y -= .002*g(ad, 0, 24)*g(z, 1.095, .004)
    return V(x, y, z)


def face_sculpt(t):
    zs = sorted(set([row[0] for row in FACE] + list(np.linspace(FACE[0][0], FACE[-1][0], 108))))
    rings = [[face_point(i/112*TAU, z) for i in range(112)] for z in zs]
    skin = dk.loft(t+"-adult-cranium", rings, SKIN, start="pole", end="pole", levels=0)
    # Small ears are modeled as a recessed cup and authored helix rim.
    ears = []
    for s in (-1, 1):
        centre = V(s*.079, -.009, 1.163)
        rows = []
        for j in range(17):
            r = j/16
            row = []
            for k in range(48):
                a = k/48*TAU
                row.append(centre + V(s*(.003+.006*g(r,.78,.17)),
                                      math.sin(a)*.017*r,
                                      math.cos(a)*.029*r))
            rows.append(row)
        ears.append(dk.loft(t+f"-ear{s}", rows, SKIN, start="pole", end="flat", levels=0))
    cranium = fuse([skin]+ears, t+".adult-face-sculpt", SKIN, .0013, 1)
    cranium["authoredLandmarks"] = "jaw,chin,cheek,orbital socket,brow,nose bridge,alar wings,lips,ear helix"
    pieces = [cranium]
    for s in (-1, 1):
        angle = math.radians(s*25)
        centre = face_point(angle, 1.181, .0032)
        eye = dk.ball(t+f"-eye-white{s}", .015, centre, EYE,
                      scale=(1.14,.38,.64), seg=32, rings=20)
        pieces.append(eye)
        pieces.append(dk.ball(t+f"-pupil{s}", .0065,
                              centre+V(-s*.0007,.0061,.0005), IRIS,
                              scale=(.89,.36,1), seg=24,rings=16))
        pieces.append(dk.ball(t+f"-catch{s}", .0017,
                              centre+V(-.0018,.008,.0031), EYE,
                              scale=(1,.45,1),seg=12,rings=8))
        # Lids remain on the head skin, while the ivory eye keeps its blink.
        for top in (False, True):
            path=[]
            for j in range(25):
                u=j/24
                a=math.radians(s*(13+25*u))
                z=1.181 + ((.0065 if top else -.0055)*math.sin(u*math.pi)) + .001*(u-.5)
                path.append(face_point(a,z,.004))
            pieces.append(dk.tube(t+f"-lid{'upper' if top else 'lower'}{s}",path,
                                 [.0018 if top else .0013]*len(path),SKIN,n=12,levels=0))
        brow = [face_point(math.radians(s*(9+j*1.5)),
                            1.199+.008*math.sin(j/21*math.pi*.8), .003) for j in range(22)]
        radii = [.0012+.0035*math.sin((j+.8)/23*math.pi)**.6 for j in range(22)]
        pieces.append(dk.tube(t+f"-brow{s}",brow,radii,HAIR,n=12,levels=0))
        # Restrained, groomed moustache; does not cover the cheek or mouth.
        path=[face_point(math.radians(s*(3+j*1.5)),1.130-.004*math.sin(j/20*math.pi),.0045)
              for j in range(21)]
        radii=[.001+.0037*math.sin((j+2)/25*math.pi)**.7 for j in range(21)]
        pieces.append(dk.tube(t+f"-groomed-moustache{s}",path,radii,HAIR,n=12,levels=0))
        nostril=[face_point(math.radians(s*(9+j*1.2)),1.141-.002*math.sin(j/8*math.pi),.0007)
                  for j in range(9)]
        pieces.append(dk.tube(t+f"-nostril{s}",nostril,[.0011]*9,SHADOW,n=10,levels=0))
    path=[face_point(math.radians(a),1.109-.003*(abs(a)/30)**1.5,.0007)
          for a in np.linspace(-26,26,29)]
    pieces.append(dk.tube(t+"-mouth",path,[.0011]*len(path),SHADOW,n=12,levels=0))
    # Fine short chin hair is anchored on the lower facial plane.
    path=[face_point(math.radians(a),1.079+.003*abs(a)/12,.001) for a in np.linspace(-12,12,17)]
    pieces.append(dk.tube(t+"-chin-hair",path,[.0018]*17,HAIR,n=10,levels=0))
    return pieces


def closed_hand(d, side, s, hand, elbow):
    """Coherent palm/thenar volume with individually separated curled fingers."""
    kn=hand-elbow
    kn-=d.D*kn.dot(d.D)
    kn.normalize()
    b=d.D.cross(kn)
    if b.z<0:
        b=-b
    # Flattened dorsal/metacarpal silhouette, with a compact heel.
    rows=[(-.037,.009,.021,.018),(-.029,.013,.028,.018),
          (-.015,.015,.031,.018),(.002,.014,.031,.020),
          (.023,.014,.029,.022),(.034,.009,.019,.021)]
    rings=[]
    for z in np.linspace(rows[0][0],rows[-1][0],34):
        thick,width,offset=table(rows,z)
        row=[]
        for j in range(36):
            a=j/36*TAU
            x=offset+thick*math.copysign(abs(math.cos(a))**.82,math.cos(a))
            y=-.005+width*math.copysign(abs(math.sin(a))**.86,math.sin(a))
            x+=.0015*g(z,.018,.015)*max(0,math.cos(a))**2
            row.append(hand+b*x+kn*y+d.D*z)
        rings.append(row)
    palm=dk.loft(d.__name__+f"-palm{side}",rings,SKIN,start="pole",end="pole",levels=0)
    fingers=[]
    for k,(z,r) in enumerate(((.026,.0076),(.009,.0080),(-.009,.0078),(-.025,.0071))):
        path=[];radi=[]
        for j in range(30):
            a=math.radians(69-222*j/29)
            rr=.0248+.0023*math.sin(j/29*math.pi)
            path.append(hand+kn*(math.cos(a)*rr)+b*(math.sin(a)*rr)+d.D*z)
            radi.append(r*(.84+.16*math.sin(j/29*math.pi)))
        finger=dk.tube(f"duelist-curled-finger{side}{k}",path,radi,SKIN,n=18,
                       levels=0,caps=("dome","dome"))
        fingers.append(finger)
    path=[hand-kn*.027+b*.020+d.D*.022,
          hand-kn*.030+b*.014+d.D*.034,
          hand-kn*.027-b*.002+d.D*.037,
          hand-kn*.014-b*.019+d.D*.032]
    pts=[V(p) for p in kit.smooth_path(path,9)]
    thumb=dk.tube(f"duelist-thumb{side}",pts,
                  [(.0085-.002*i/(len(pts)-1)) for i in range(len(pts))],SKIN,
                  n=18,levels=0)
    # Fuse palm/roots/thumb; preserve the four finger grooves instead of
    # voxel-bridging adjacent fingertips into an undifferentiated mitten.
    body=fuse([palm,thumb]+fingers,f"duelist.hand-sculpt{side}",SKIN,.0007,1)
    body["handContract"]="thumb web,thenar heel,metacarpal plane,four curled finger pads; exact native grip centre"
    return [body,hand_plate(d,side,hand,kn)],kn


def hand_plate(d,side,hand,kn):
    """Retain the native dorsal plate separately from editable hand anatomy."""
    b=d.D.cross(kn)
    if b.z<0:
        b=-b
    # Tekko plate remains slightly above the dorsal hand, restrained gold edge.
    plate=[(-.026,-.021),(.008,-.026),(.023,-.020),(.026,0),(.023,.024),(.008,.027),(-.026,.021)]
    matrix=dk.basis(kn,d.D,b,hand+b*.037-kn*.007)
    tekko=dk.slab(f"duelist-tekko{side}",plate,.0035,d.IRON,side_mat=d.GOLD,
                  bevel=.0012,segments=3,matrix=matrix)
    return tekko


def arm_points(d,s,hand,pole):
    shoulder=V(s*d.SH_X,0,d.SH_Z)
    provisional=dk.ik(shoulder,hand,d.UPPER,d.FORE+.05,pole)
    kn=hand-provisional
    kn-=d.D*kn.dot(d.D)
    kn.normalize()
    wrist=hand-kn*.043
    elbow=dk.ik(shoulder,wrist,d.UPPER,d.FORE,pole)
    return shoulder,elbow,wrist


def robe(d,t,arms):
    """Sloping shoulders flow into tapered sleeves; elbows are shaped bends."""
    rows=[(.845,.156,.116),(.920,.163,.119),(.967,.185,.123),
          (.992,.195,.120),(1.012,.174,.114),(1.033,.128,.099),
          (1.054,.085,.079),(1.076,.061,.063)]
    rings=[dk.hring(z,*table(rows,z),72,power=2.3) for z in np.linspace(.845,1.076,66)]
    pieces=[dk.loft(t+"-shoulder-robe-cage",rings,CLOTH,start="flat",end="flat",levels=0)]
    for side,(s,shoulder,elbow,wrist,hand) in arms.items():
        controls=[V(s*.159,0,1.007),shoulder,dk.lerp(shoulder,elbow,.55),elbow,
                  dk.lerp(elbow,wrist,.47),wrist]
        smooth_path=[V(p) for p in kit.smooth_path(controls,10)]
        rings=[]
        distances=[0]
        for a,b in zip(smooth_path,smooth_path[1:]):
            distances.append(distances[-1]+(b-a).length)
        for j,p in enumerate(smooth_path):
            u=distances[j]/distances[-1]
            radial=table([(0,.059,.055),(.15,.057,.052),(.36,.055,.048),
                          (.57,.047,.044),(.72,.051,.044),(1,.033,.029)],u)
            tang=smooth_path[min(len(smooth_path)-1,j+1)]-smooth_path[max(0,j-1)]
            n1,n2=dk.frame_at(tang,(0,0,1))
            row=[]
            for k in range(48):
                a=k/48*TAU
                # Longitudinal cloth tension and restrained elbow compression.
                fold=.0028*math.sin(5*a+.3)*math.sin(math.pi*u)**.7
                fold+=.0025*g(u,.57,.11)*math.cos(3*a+u*28)
                rr0,rr1=radial
                # Outer triceps/forearm planes differ from the inner crease.
                rr0+=.0028*g(u,.38,.17)*max(0,math.cos(a))**2
                row.append(p+n1*(math.cos(a)*(rr0+fold))+n2*(math.sin(a)*(rr1+fold)))
            rings.append(row)
        pieces.append(dk.loft(t+f"-sleeve-cage{side}",rings,CLOTH,start="flat",end="flat",levels=0))
    skin=fuse(pieces,t+".continuous-underrobe",CLOTH,.0020,2)
    skin["continuousSkin"]=True
    skin["authoredLandmarks"]="sloped shoulder,armpit,elbow compression,triceps plane,forearm taper,wrist cuff"
    return skin


def arm_iron(d,t,side,s,shoulder,elbow,wrist,cloth=None):
    pieces=[]
    surface=BVHTree.FromObject(cloth,bpy.context.evaluated_depsgraph_get()) if cloth is not None else None
    outward=((elbow-shoulder).normalized()-(wrist-elbow).normalized()).normalized()
    # An ellipsoidal cop is deliberately shallow, not an exposed ball socket.
    pieces.append(dk.ball(t+f"-elbowcop{side}",.032,elbow+outward*.033,
                          d.IRON,scale=(1,.70,.54),seg=24,rings=16))
    fd=(wrist-elbow).normalized()
    top=V(s*.5,0,1)
    top=(top-fd*top.dot(fd)).normalized()
    across=fd.cross(top)
    for k,a0 in enumerate((-42,0,42)):
        a=math.radians(a0)
        normal=top*math.cos(a)+across*math.sin(a)
        tan=top*-math.sin(a)+across*math.cos(a)
        def panel(u,v,normal=normal,tan=tan):
            centre=dk.lerp(elbow,wrist,.17+.71*v)
            origin=centre+tan*(u-.5)*(.023-.006*v)
            if surface:
                hit,_,_,distance=surface.ray_cast(origin,normal,.12)
                if hit is not None and distance>.005:
                    # Source garment is connected and bends between its
                    # authored controls. Fit each plate sample to that actual
                    # surface, leaving 1 mm beneath the 3 mm metal thickness.
                    return hit+normal*.004
            return origin+normal*(.059-.013*v)
        pieces.append(dk.panel(t+f"-forearm-splint{side}{k}",panel,[0,.1,.5,.9,1],
                               [0,.05,.4,.9,1],d.IRON,.003,
                               inside=dk.lerp(elbow,wrist,.6),rim_mat=d.GOLD))
    pieces.append(dk.tube(t+f"-wristcuff{side}",[wrist-fd*.008,wrist+fd*.006],
                          [(.034,.032)]*2,d.TEAM2,n=36,levels=0,caps=(None,None),
                          bands={0:d.GOLD}))
    return pieces


def lower_cloth(d,t,side,s):
    hip=V(s*d.HIP_X,0,d.HIP_Z)
    knee=V(.132,.070,.345) if s>0 else V(-.130,-.022,.350)
    ankle=V(.152,.062,.090) if s>0 else V(-.156,-.075,.090)
    rows=[]
    for j in range(90):
        z=.094+(.609-.094)*j/89
        if z>=knee.z:
            centre=dk.lerp(knee,hip,dk.clamp01((z-knee.z)/(hip.z-knee.z)))
        else:
            centre=dk.lerp(ankle,knee,dk.clamp01((z-ankle.z)/(knee.z-ankle.z)))
        rx,ry=table([(.094,.038,.037),(.150,.043,.042),(.235,.052,.047),
                     (.298,.048,.046),(.334,.060,.054),(.380,.083,.069),
                     (.452,.091,.072),(.540,.087,.072),(.609,.079,.068)],z)
        ring=[]
        for k in range(64):
            a=k/64*TAU
            # Six asymmetric broad hakama pleats, fading into calf tension.
            cloth=dk.smooth((z-.300)/.100)
            amp=(.008+.008*g(z,.445,.115))*cloth
            # Deep box pleats: broad near-planar fold faces and narrow
            # inward channels. Lines follow hip-to-knee tension instead
            # of swelling uniformly into an inflated thigh capsule.
            phase=.34*s+.24*(z-.44)/.17
            primary=math.cos(6*a+phase)
            box=math.copysign(abs(primary)**.32,primary)
            fold=amp*(.80*box+.20*math.cos(9*a+.5))
            fold+=.003*g(z,.347,.025)*math.cos(10*a+z*40)
            # The knee front and inner compressed fold avoid a tube rhythm.
            fold+=.0035*g(z,knee.z,.034)*max(0,math.sin(a))**3
            fold-=.0028*g(z,.319,.022)*max(0,-math.sin(a))**3
            ring.append(V(centre.x+math.cos(a)*(rx+fold),
                          centre.y+math.sin(a)*(ry+fold),z))
        rows.append(ring)
    trouser=dk.loft(t+f"-hakama-cage{side}",rows,TROUSER,start="flat",end="flat",levels=0)
    turn=math.radians(10*s+(0 if s>0 else -14))
    fwd=V(math.sin(turn),math.cos(turn),0)
    right=fwd.cross(V(0,0,1))
    origin=V(ankle.x,ankle.y+.004,0)
    sections=[(-.075,.025,.027,.059),(-.058,.038,.041,.062),
              (-.025,.044,.048,.064),(.030,.039,.051,.052),
              (.084,.029,.048,.041),(.119,.018,.041,.033),(.143,.003,.014,.029)]
    footrings=[]
    for y in np.linspace(sections[0][0],sections[-1][0],50):
        rz,rw,cz=table(sections,y)
        ring=[]
        for j in range(48):
            a=j/48*TAU
            xx=rw*math.cos(a)
            zz=max(.020,cz+rz*math.sin(a))
            # Split-toe tension is sculpted into the tabi dorsal cloth.
            zz-=.0035*g(y,.106,.034)*g(xx,s*.017,.005)*max(0,math.sin(a))
            ring.append(origin+right*xx+fwd*y+V(0,0,zz))
        footrings.append(ring)
    foot=dk.loft(t+f"-tabi-cage{side}",footrings,TROUSER,start="flat",end="flat",levels=0)
    garment=fuse([trouser,foot],t+f".continuous-hakama{side}",TROUSER,.0019,2)
    garment["continuousSkin"]=True
    garment["authoredLandmarks"]="lengthwise pleats,knee compression,calf taper,ankle continuity,split-toe tabi"
    return garment,hip,knee,ankle


def skeleton(t,root,d):
    data=bpy.data.armatures.new("Samurai native anatomical joint frames")
    rig=bpy.data.objects.new(t+".skeleton",data)
    bpy.context.collection.objects.link(rig)
    rig.parent=root
    select(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    positions={"torso":d.WAIST,"head":d.NECK,"tail":d.do_pt(d.KNOT_A,.615,.036),
               "cape":V(d.POLE.x,d.POLE.y,.975),"hat":V(0,d.HEAD_CY,1.225),
               "beard":V(0,d.HEAD_CY+.078,1.064),"weapon":d.GRIP}
    positions["tail"].z=d.ROPE_Z-.004
    parents={"head":"torso","tail":"torso","cape":"torso", "hat":"head",
             "beard":"head","weapon":"foreR"}
    for s,side in ((-1,"L"),(1,"R")):
        # Precisely the existing gait solver's section pivots.
        py=-.021 if s<0 else .066
        ay=-.073 if s<0 else .062
        for part,pos,parent in (("leg",V(s*.095,0,.60),None),
                                 ("knee",V(s*(.129 if s<0 else .132),py,.36),"leg"+side),
                                 ("foot",V(s*(.154 if s<0 else .152),ay,.10),"knee"+side),
                                 ("arm",V(s*.215,0,1),"torso"),
                                 ("fore",arm_points(d,s,d.HAND_L if s<0 else d.HAND_R,V(s*.55,0,.62))[1],"arm"+side),
                                 ("sleeve",V(s*.255,-.004,1.08),"arm"+side),
                                 ("skirt",V(s*.085,0,.62),"torso")):
            positions[part+side]=pos
            if parent:
                parents[part+side]=parent
    for name,pos in positions.items():
        bone=data.edit_bones.new(t+name)
        bone.head,bone.tail=pos,pos+V(0,0,.07)
        bone.use_connect=False
    for name,parent in parents.items():
        data.edit_bones[t+name].parent=data.edit_bones[t+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front=True
    data.display_type="WIRE"
    rig["arenaCommonAxes"]=True
    rig["anatomicalPivots"]=json.dumps({k:list(v) for k,v in positions.items()})
    return rig


def attach(obj,rig,part):
    kit.refresh()
    world=obj.matrix_world.copy()
    obj.parent, obj.parent_type, obj.parent_bone=rig,"BONE",rig.parent.name+part
    obj.matrix_world=world
    return obj


def part(d,t,rig,name,objects):
    obj=dk.part(t,name+"-shell",objects,(0,0,0),rig.parent)
    attach(obj,rig,name)
    return obj


def add_weights(obj,rig,weights):
    total=np.maximum(.000001,np.sum(list(weights.values()),axis=0))
    for name,values in weights.items():
        group=obj.vertex_groups.new(name=rig.parent.name+name)
        q=np.rint(np.clip(values/total,0,1)*10000).astype(int)
        order=np.flatnonzero(q>0)
        order=order[np.argsort(q[order])]
        cuts=np.flatnonzero(np.diff(q[order]))+1
        for batch in np.split(order,cuts):
            if len(batch):
                group.add(batch.tolist(),float(q[batch[0]])/10000,"REPLACE")
    mod=obj.modifiers.new("Connected cloth skin", "ARMATURE")
    mod.object=rig
    mod.use_deform_preserve_volume=False
    obj.parent=rig
    obj["skinContract"]="linear glTF deformation; normalized local native driver weights"


def segment_distance(points,a,b):
    av,bv=np.array(a),np.array(b)
    direction=bv-av
    t=np.clip((points-av).dot(direction)/direction.dot(direction),0,1)
    return np.linalg.norm(points-(av+t[:,None]*direction),axis=1)


def weight_robe(obj,rig,arms):
    p=np.array([v.co[:] for v in obj.data.vertices])
    x,y,z=p.T
    weights={"torso":np.ones(len(p)),"armL":np.zeros(len(p)),"armR":np.zeros(len(p)),
             "foreL":np.zeros(len(p)),"foreR":np.zeros(len(p))}
    distances=[]
    for side,(s,shoulder,elbow,wrist,hand) in arms.items():
        distances.append(np.minimum(segment_distance(p,shoulder,elbow),segment_distance(p,elbow,wrist)))
    left,right=distances
    for i,(side,(s,shoulder,elbow,wrist,hand)) in enumerate(arms.items()):
        near=(left<right) if side=="L" else (right<=left)
        # Shoulders mix over a short tissue band. The torso and flank are
        # excluded even when a posed elbow passes near them.
        outward=ss(.158,.237,x*s)
        ahead=ss(.120,.164,y)*(1-ss(.941,.986,z))
        share=np.maximum(outward,ahead)*near*(distances[i]<.084)
        along=(p-np.array(elbow)).dot(np.array((wrist-elbow).normalized()))
        fore=ss(-.035,.055,along)
        weights["arm"+side]=share*(1-fore)
        weights["fore"+side]=share*fore
        weights["torso"]-=share
    add_weights(obj,rig,weights)
    obj["weightRegions"]="bounded shoulders; distal sleeve ownership by nearest authored path"


def weight_leg(obj,rig,side):
    p=np.array([v.co[:] for v in obj.data.vertices])
    x,y,z=p.T
    knee=1-ss(.310,.408,z)
    foot=1-ss(.074,.140,z)
    add_weights(obj,rig,{"leg"+side:1-knee,"knee"+side:knee*(1-foot),"foot"+side:knee*foot})


def fine_materials(root):
    """Honest studio families: same roughness and coat as the Arena renderer."""
    settings={"skin":(.64,0,.025),"hair":(.48,0,.05),"resin":(.58,0,.08),
              "weave":(.85,0,0),"drape":(.78,0,0),"lacquer":(.28,0,.45),"gilt":(.32,.85,0)}
    for obj in kit.descendants(root):
        if obj.type!="MESH":
            continue
        for mat in obj.data.materials:
            family=mat.name.split(":")[0]
            if family not in settings:
                continue
            bsdf=next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
            rough,metal,coat=settings[family]
            bsdf.inputs["Roughness"].default_value=rough
            bsdf.inputs["Metallic"].default_value=metal
            bsdf.inputs["Coat Weight"].default_value=coat
            bsdf.inputs["Coat Roughness"].default_value=.65 if family=="skin" else .18


def finish_ao(root):
    """Only combined pigment/AO is an exported colour; caches are generic."""
    for obj in kit.descendants(root):
        if obj.type!="MESH":
            continue
        colors=obj.data.color_attributes
        ao=colors.get("AO")
        if ao is None:
            white_colors(obj)
            ao=colors.get("AO")
        loops=obj.data.loops
        rgba=np.empty(len(ao.data)*4,dtype=np.float32)
        ao.data.foreach_get("color",rgba)
        # Broad restrained cheek/knuckle warmth stays within coherent skin.
        if any(m.name==SKIN for m in obj.data.materials):
            coords=np.array([obj.matrix_world@v.co for v in obj.data.vertices])
            corner=np.array([l.vertex_index for l in loops])
            xyz=coords[corner]
            warm=np.exp(-((np.abs(xyz[:,0])-.055)/.025)**2-((xyz[:,2]-1.151)/.023)**2)
            pigment=np.ones((len(loops),3),dtype=np.float32)
            pigment[:,1]-=.028*warm
            pigment[:,2]-=.037*warm
            rgba.reshape(-1,4)[:,:3]*=pigment
        ao.data.foreach_set("color",rgba)
        for layer in list(colors):
            if layer.name!="AO":
                colors.remove(layer)
        colors.active_color=ao
        colors.render_color_index=0


def build_master(t="duelist"):
    import figure_duelist as d
    root=kit.empty(t)
    rig=skeleton(t,root,d)
    arms={}
    handparts={}
    for side,s,hand,pole in (("L",-1,d.HAND_L,V(-.55,0,.62)),("R",1,d.HAND_R,V(.55,0,.62))):
        shoulder,elbow,wrist=arm_points(d,s,hand,pole)
        arms[side]=(s,shoulder,elbow,wrist,hand)
        hp,kn=closed_hand(d,side,s,hand,elbow)
        handparts[side]=hp
    underrobe=robe(d,t,arms)
    weight_robe(underrobe,rig,arms)
    # Keep deliberate old lamellar engineering, replacing only its soft forms.
    belt,knot=d.rope_belt(t)
    upper=[]
    for obj in d.upper_body(t):
        if "-robe" in obj.name:
            bpy.data.objects.remove(obj,do_unlink=True)
        else:
            upper.append(obj)
    torso=d.cuirass(t)+upper+d.agemaki(t)+d.obi(t)+belt+d.banner_mount(t)+d.scabbards(t)
    part(d,t,rig,"torso",torso)
    for side,s in (("L",-1),("R",1)):
        lower,hip,knee,ankle=lower_cloth(d,t,side,s)
        weight_leg(lower,rig,side)
        old,_=d.leg(t,side,s)
        legparts=[];kneeparts=[];footparts=[]
        for obj in old:
            label=obj.name.removeprefix(t+"-")
            if label.startswith(("hakama","shin","foot")):
                bpy.data.objects.remove(obj,do_unlink=True)
            elif label.startswith("haidate"):
                legparts.append(obj)
            elif label.startswith(("sole","strap","heelcord")):
                footparts.append(obj)
            else:
                kneeparts.append(obj)
        part(d,t,rig,"leg"+side,legparts)
        part(d,t,rig,"knee"+side,kneeparts)
        part(d,t,rig,"foot"+side,footparts)
        part(d,t,rig,"skirt"+side,d.kusazuri(t,side,s))
        s,shoulder,elbow,wrist,hand=arms[side]
        part(d,t,rig,"fore"+side,arm_iron(d,t,side,s,shoulder,elbow,wrist,underrobe)+handparts[side])
        part(d,t,rig,"sleeve"+side,d.sode(t,s))
    part(d,t,rig,"tail",d.rope_ends(t,knot))
    flag=part(d,t,rig,"cape",d.banner(t))
    # Match original drape coordinates relative to the native banner pivot.
    kit.drape(flag,free=lambda co:d.banner_free(co))
    legacy,hat,beard=d.head(t)
    keep=[]
    for obj in legacy:
        label=obj.name.removeprefix(t+"-")
        if label.startswith(("face","neck","eye-white","pupil","brow","moustache","mouth")):
            bpy.data.objects.remove(obj,do_unlink=True)
        else:
            keep.append(obj)
    face=face_rig.head(dk.part,t,face_sculpt(t)+keep,d.NECK,root)
    face.name=t+".adult-head-shell"
    attach(face,rig,"head")
    part(d,t,rig,"hat",hat)
    part(d,t,rig,"beard",beard)
    edge=V(0,0,-1)+d.D*d.D.z
    edge.normalize()
    flat=d.D.cross(edge)
    roll=math.radians(d.ROLL)
    edge=edge*math.cos(roll)+flat*math.sin(roll)
    matrix=dk.basis(edge,d.D.cross(edge),d.D,d.HAND_R+d.D*.047)
    sword=d.katana(t)
    dk.transform(sword,matrix)
    part(d,t,rig,"weapon",sword)
    for obj in kit.descendants(root):
        if obj.type=="MESH" and not obj.data.color_attributes:
            white_colors(obj)
    finish_ao(root)
    fine_materials(root)
    rig.pose.bones[t+"head"].rotation_mode="QUATERNION"
    rig.pose.bones[t+"head"].rotation_quaternion=dk.runtime_quat(math.radians(5),0,0)
    root["unoptimized"]=True
    root["nativeScale"]=1.0
    root["sourceVersion"]="Samurai V5 adult anatomy, descending visor, fitted plate clearance and tensioned box-pleat cloth"
    root["gripCentres"]=json.dumps({"L":list(d.HAND_L),"R":list(d.HAND_R),"axis":list(d.D),"pivot":list(d.GRIP)})
    root["skinContract"]="native driver skeleton; deforming shoulder robe and knee/ankle garments; hard lames articulate separately"
    kit.refresh()
    return root
