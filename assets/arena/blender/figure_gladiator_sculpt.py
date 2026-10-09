"""Detailed, editable Gladiator anatomy with a continuous deforming skin.

All skin is authored in world metres, +Y forward and Z up. The skeleton
uses common world axes so Arena's named joint rotations need no retargeting.
Shield/sword, leather construction and bronze plates remain separate pieces.
The source has no decimation; a separate reviewed export is reduced later.
"""
import json
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_gladiator_kit as gk

V = gk.V
TAU = math.tau


def soft(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def interpolate(rows, x):
    """Bounded cubic interpolation: never overshoots anatomical widths."""
    if x <= rows[0][0]:
        return rows[0][1:]
    for a,b in zip(rows,rows[1:]):
        if x<=b[0]:
            t=float(soft(a[0],b[0],x))
            return tuple(a[i]+(b[i]-a[i])*t for i in range(1,len(a)))
    return rows[-1][1:]


BODY=[(.56,.115,.083,.092),(.64,.132,.092,.101),
      (.70,.130,.091,.093),(.77,.142,.100,.094),
      (.84,.162,.108,.101),(.91,.178,.112,.108),
      (.957,.172,.102,.104),(.984,.143,.084,.085),
      (1.014,.074,.059,.059),(1.051,.045,.049,.049)]


def body_point(a,z):
    rx,front,back=interpolate(BODY,z)
    s,c=math.sin(a),math.cos(a)
    x=rx*gk.spow(s,2/2.25)
    y=(front if c>=0 else back)*gk.spow(c,2/2.25)
    ad=abs(math.degrees(a))
    ad=min(ad,360-ad)
    g=gk.gauss
    # Broad pectoral planes, a restrained lower border and centre groove.
    d=.017*g(ad,34,21)*g(z,.894,.041)
    d-=.0045*g(ad,0,5.5)*g(z,.885,.065)
    d-=.003*g(ad,29,23)*g(z,.846,.008)
    # Clavicles slope toward the acromion, rather than ball shoulders.
    collar=.968-.026*(min(ad,90)/90)**.70
    d+=.0062*g(ad,43,31)*g(z,collar,.007)
    d-=.003*g(ad,27,30)*g(z,collar-.016,.010)
    # Abdominal wall and obliques: connected flank, quiet segmentation.
    for level in (.72,.768,.812):
        d+=.0035*g(ad,15,9)*g(z,level,.017)
    d-=.0025*g(ad,0,3.5)*g(z,.772,.065)
    d+=.0045*g(ad,70,14)*g(z,.762,.080)
    # Posterior scapulae/lats and lumbar groove.
    d+=.010*g(ad,146,17)*g(z,.904,.043)
    d+=.0045*g(ad,121,18)*g(z,.838,.071)
    d-=.005*g(ad,180,5)*g(z,.85,.116)
    return V(x,y,z)+V(s,c,0)*d


def torso(eq):
    rings=[[body_point(i/96*TAU,z) for i in range(96)]
           for z in np.linspace(BODY[0][0],BODY[-1][0],110)]
    return gk.loft("gladiator.anatomical-torso",rings,eq.SKIN,
                   start="pole",end="pole")


def waist_lining(eq):
    """Thin inner leather apron covers the hip behind the moving panels.

    Its upper edge tucks into the torso belt; its lower edge stays inside
    the separately swinging skirt. A belt-to-panel overlap alone opens
    over the rear hip during the thrust and cannot cover that seam.
    """
    def panel(u,v):
        a,z=u*TAU,.55+.09*v
        p=eq.kilt_point(a,z,-.021)
        pad=.012*(1-float(soft(.60,.66,z)))*abs(math.sin(a))**.85
        p.x+=math.copysign(pad,p.x)
        return p
    return gk.sheet("gladiator-waist-lining",panel,
                    [i/48 for i in range(48)],[i/8 for i in range(9)],
                    eq.LEATHER,rim=.0025,closed_u=True,back=True,
                    inside=V(0,0,.595))


def section_limb(name, a,b, rows,mat, upper=True,side=1):
    axis=(b-a).normalized()
    front=(V(0,1,0)-axis*axis.dot(V(0,1,0))).normalized()
    across=axis.cross(front).normalized()
    rings=[]
    for t in np.linspace(-.11,1.08,60):
        r,depth=interpolate(rows,max(0,min(1,t)))
        # A rigid end cap at full deltoid radius makes an exposed diagonal
        # ridge above the shoulder. Round both terminal sections into
        # overlapping tissue, so the source remains anatomical in clay.
        cap=math.sqrt(max(.03,1-(min(0,t)/.12)**2)) if t<0 else \
            math.sqrt(max(.05,1-(max(0,t-1)/.10)**2))
        r*=cap;depth*=cap
        centre=a+(b-a)*t
        ring=[]
        for k in range(56):
            q=k/56*TAU
            cs,sn=math.cos(q),math.sin(q)
            # Biceps has a front plane, triceps has a long posterior sweep.
            if upper:
                relief=.007*gk.gauss(t,.47,.22)*max(0,cs)**4
                relief+=.004*gk.gauss(t,.54,.32)*max(0,-cs)**3
                relief-=.002*gk.gauss(t,.91,.10)*max(0,cs)**4
            else:
                relief=.004*gk.gauss(t,.25,.24)*max(0,-cs)**3
                relief+=.0025*gk.gauss(t,.57,.33)*abs(sn)**6
                relief-=.0015*gk.gauss(t,.85,.13)*max(0,cs)**2
            ring.append(centre+front*(depth*cs+relief*cs)+across*(r*sn+relief*sn))
        rings.append(ring)
    return gk.loft(name,rings,mat,start="pole",end="pole")


def arms(eq, sides):
    out=[]
    for sx,side,s,e,w,c,xax,rod in sides:
        # Deltoid insertion blends across the lateral chest, not a sphere
        # sitting on the end of a chest tube.
        rows=[(0,.064,.062),(.13,.068,.066),(.32,.061,.058),
              (.56,.053,.050),(.78,.044,.041),(1,.036,.035)]
        out.append(section_limb("gladiator.upper-skin"+side,s,e,rows,eq.SKIN,True,sx))
        rows=[(0,.035,.035),(.12,.041,.039),(.32,.041,.037),
              (.55,.034,.032),(.78,.028,.026),(1,.025,.024)]
        out.append(section_limb("gladiator.fore-skin"+side,e,w,rows,eq.SKIN,False,sx))
        # Palm follows the forearm into the grip, with four independently
        # authored hooked fingers and a thumb opposed over the index.
        out+=closed_hand(eq,side,c,xax,rod,sx==1)
    return out


def closed_hand(eq,side,c,xax,rod,right):
    x=Vector(xax).normalized()
    r=Vector(rod).normalized()
    x=(x-r*x.dot(r)).normalized()
    y=x.cross(r) if right else r.cross(x)
    z=x.cross(y)*(-1 if right else 1)
    frame=gk.basis(x,y,z,c)
    # Wrist heel -> metacarpals. The grip runs through the open central
    # channel; the finger pads curl round it, never along the blade.
    rings=[]
    for u in np.linspace(-.054,-.010,26):
        t=(u+.054)/.044
        w=.022+.013*math.sin(min(1,t)*math.pi*.63)
        d=.020+.006*math.sin(t*math.pi)
        rings.append([V(u,.002+math.cos(a)*d,math.sin(a)*w)
                      for a in np.linspace(0,TAU,40,endpoint=False)])
    out=[gk.loft("gladiator.palm"+side,rings,eq.SKIN,start="pole",end="pole")]
    for k,(level,width) in enumerate(((-.026,.009),(-.009,.0095),(.009,.0095),(.026,.0085))):
        # Down from a raised knuckle, then the middle joint and distal pad.
        path=[V(-.007,.019,level),V(.011,.017,level),V(.022,.004,level),
              V(.019,-.013,level),V(.002,-.018,level),V(-.008,-.012,level)]
        dense=[];rad=[]
        for i in range(len(path)-1):
            for j in range(5):
                t=j/5
                dense.append(path[i].lerp(path[i+1],t))
                rad.append(width*(1-.16*(i+t)/(len(path)-1)))
        dense.append(path[-1]);rad.append(width*.72)
        out.append(gk.tube(f"gladiator.finger{side}{k}",dense,rad,eq.SKIN,n=22,
                           up=(0,0,1),caps=("dome","dome")))
    thumb=[V(-.033,-.017,.017),V(-.018,-.024,.034),V(.004,-.021,.039),V(.016,-.014,.024)]
    dense=[];rad=[]
    for i in range(len(thumb)-1):
        for j in range(7):
            t=j/7
            dense.append(thumb[i].lerp(thumb[i+1],t))
            rad.append(.0115-.003*(i+t)/(len(thumb)-1))
    dense.append(thumb[-1]);rad.append(.008)
    out.append(gk.tube("gladiator.thumb"+side,dense,rad,eq.SKIN,n=22,caps=("dome","dome")))
    gk.transform(out,frame)
    return out


def legs(eq):
    out=[]
    pivots={}
    gear=[]
    for side,sx,knee,ankle,toe in (("L",-1,V(-.102,.03,.36),V(-.116,.04,.085),12),
                                   ("R",1,V(.1,-.02,.36),V(.114,-.03,.085),14)):
        hip=V(sx*eq.HIP_X,0,eq.HIP_Z)
        pivots.update({"leg"+side:hip,"knee"+side:knee,"foot"+side:ankle})
        rows=[(0,.063,.063),(.18,.071,.074),(.43,.067,.069),
              (.69,.058,.059),(.90,.048,.047),(1,.043,.042)]
        out.append(section_limb("gladiator.thigh-skin"+side,hip,knee,rows,eq.SKIN,True,sx))
        rows=[(0,.042,.042),(.22,.050,.052),(.47,.046,.050),(.72,.034,.037),(1,.026,.030)]
        out.append(section_limb("gladiator.calf-skin"+side,knee,ankle,rows,eq.SKIN,False,sx))
        # Patella is a shallow crest in the continuous skin, not a separate
        # toy ball; voxel blending preserves a single knee volume.
        out.append(gk.ball("gladiator.patella"+side,1,knee+V(0,.025,0),eq.SKIN,
                            scale=(.030,.027,.035),seg=40,rings=28))
        # Retain construction of greaves/straps/sole, replace the low-res
        # underlying skin and author a shaped foot with metatarsal arch.
        pieces,_=eq.leg(sx,knee,ankle,toe)
        skinparts=[o for o in pieces if any(m.name==eq.SKIN for m in o.data.materials)]
        pieces=[o for o in pieces if o not in skinparts]
        for o in skinparts:
            bpy.data.objects.remove(o,do_unlink=True)
        for o in pieces:
            bone="foot"+side if "sole" in o.name or "sstrap" in o.name or "lace" in o.name else "knee"+side
            gear.append((o,bone))
        foot=[]
        profile=[(-.065,.024,.008,.066),(-.047,.036,.007,.079),(-.015,.038,.009,.083),
                 (.025,.041,.009,.065),(.071,.044,.009,.044),(.108,.039,.009,.031),(.126,.025,.011,.024)]
        for y in np.linspace(profile[0][0],profile[-1][0],48):
            rx,base,top=interpolate(profile,y)
            ring=[]
            for a in np.linspace(0,TAU,56,endpoint=False):
                x=rx*math.sin(a)
                zz=(base+top)/2+(top-base)/2*math.cos(a)
                # Medial arch pulls the underside up behind the forefoot.
                zz+=.006*gk.gauss(y,.018,.035)*max(0,-math.cos(a))*(.5+.5*sx*math.sin(a))
                ring.append(V(x,y,zz))
            foot.append(ring)
        footobj=gk.loft("gladiator.foot-skin"+side,foot,eq.SKIN,start="pole",end="pole")
        toes=[footobj]
        for k,(x,y,rr) in enumerate(((-.028,.129,.012),(-.011,.136,.0105),(.006,.134,.0095),(.021,.129,.0088),(.033,.120,.0078))):
            toes.append(gk.ball(f"gladiator.toe-skin{side}{k}",rr,V(-sx*x,y,.0205),eq.SKIN,
                                scale=(1,1.45,.8),seg=32,rings=22))
        place=Matrix.Translation(V(ankle.x,ankle.y,0))@Matrix.Rotation(math.radians(-sx*toe),4,"Z")
        gk.transform(toes,place)
        out+=toes
    return out,pivots,gear


def fuse(parts,mat):
    for o in parts:
        kit.apply(o);kit.apply_transform(o)
    o=kit.join(parts,"gladiator.skin")
    mod=o.modifiers.new("Connected authored anatomical surface","REMESH")
    mod.mode="VOXEL"
    mod.voxel_size=float(os.environ.get("GLADIATOR_MASTER_VOXEL",".0026"))
    mod.use_smooth_shade=True
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new("Soft anatomical transitions","SMOOTH")
    mod.factor,mod.iterations=.55,4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.clear();o.data.materials.append(kit.material(mat))
    for p in o.data.polygons:p.use_smooth=True
    sub=o.modifiers.new("Editable high-resolution sculpt surface","SUBSURF")
    sub.levels=sub.render_levels=1
    # Equipment assembly must not reevaluate a quarter-million-vertex
    # subdivision after each attachment. Restore it before review/export.
    sub.show_viewport=False
    return o


def skeleton(eq,root,sides,legpivots):
    data=bpy.data.armatures.new("Gladiator common-axis anatomical rig")
    rig=bpy.data.objects.new("gladiator.skeleton",data)
    bpy.context.collection.objects.link(rig);rig.parent=root
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode="EDIT")
    pos={"torso":eq.WAIST,"head":eq.NECK,"hair":V(0,eq.CY-.004,1.278),
         "skirtL":V(-eq.HIP_X,0,.655),"skirtR":V(eq.HIP_X,0,.655),
         "shield":eq.LEFT,"weapon":eq.GRIP}
    par={"head":"torso","hair":"head","skirtL":"torso","skirtR":"torso",
         "shield":"handL","weapon":"handR"}
    pos.update(legpivots)
    for sx,side,s,e,w,c,xax,rod in sides:
        pos.update({"arm"+side:s,"fore"+side:e,"hand"+side:w})
        par.update({"arm"+side:"torso","fore"+side:"arm"+side,"hand"+side:"fore"+side,
                    "knee"+side:"leg"+side,"foot"+side:"knee"+side})
    for name,p in pos.items():
        b=data.edit_bones.new("gladiator."+name)
        b.head=p;b.tail=p+V(0,0,.065);b.use_connect=False
    for name,parent in par.items():data.edit_bones["gladiator."+name].parent=data.edit_bones["gladiator."+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front=True;data.display_type="WIRE"
    rig["arenaCommonAxes"]=True
    rig["anatomicalPivots"]=json.dumps({k:list(v) for k,v in pos.items()})
    return rig,pos


def distance(p,a,b):
    a,b=np.array(a),np.array(b)
    d=b-a;t=np.clip((p-a).dot(d)/d.dot(d),0,1)
    return np.linalg.norm(p-(a+t[:,None]*d),axis=1),t


def weight_skin(o,rig,eq,sides,pos):
    p=np.array([v.co[:] for v in o.data.vertices]);x,y,z=p.T
    weights={name:np.zeros(len(p)) for name in pos}
    head=soft(1.015,1.085,z)
    weights["head"],weights["torso"]=head,1-head
    for sx,side,s,e,w,c,xax,rod in sides:
        # Keep the pelvis covered by the rigid belt on the torso. The hip
        # skin transitions below its lower edge, inside the leather skirt,
        # instead of poking through the belt during a forward thrust.
        leg=(1-soft(.535,.60,z))*(sx*x>0)
        knee=1-soft(.335,.399,z)
        foot=1-soft(.084,.126,z)
        weights["leg"+side]=leg*(1-knee)
        weights["knee"+side]=leg*knee*(1-foot)
        weights["foot"+side]=leg*knee*foot
        weights["torso"]*=1-leg
        du,tu=distance(p,s,e);df,tf=distance(p,e,w);dh,th=distance(p,w,c)
        radius=np.interp(z,[row[0] for row in BODY],[row[1] for row in BODY])
        front=np.interp(z,[row[0] for row in BODY],[row[2] for row in BODY])
        frontal=soft(front+.020,front+.045,y)
        outside=np.maximum(soft(radius+.001,radius+.028,sx*x),frontal)
        # The shoulder bridge deforms progressively across the acromion.
        shoulder=soft(.87,.932,z)*(1-soft(1.009,1.06,z))
        nearest=np.minimum.reduce([du,df,dh])
        region=(sx*x>.050)&(z>.56)&(z<1.07)&(nearest<.095)
        share=np.maximum(soft(.140,.215,sx*x),frontal)*region*np.maximum(outside,shoulder)
        # Geodesic-like projected section distance separates the forearm
        # from nearby torso/hip at the resting bent elbow.
        # A bent forearm can point back up the upper arm's axis. Compare
        # actual segment proximity rather than classifying by that axis,
        # which would incorrectly leave a bent wrist on the upper arm.
        fore=soft(-.025,.025,du-df)
        hand_along=(p-np.array(w)).dot(np.array(xax))
        hand=soft(-.022,.014,hand_along)
        # Both palms are forward of their wrists. Let the distal fist
        # fully leave the torso even where its x position is inside the
        # shoulder; all pads around the grip must follow the same wrist.
        share=np.maximum(share,soft(.004,.018,hand_along)*region)
        weights["arm"+side]=share*(1-fore)
        weights["fore"+side]=share*fore*(1-hand)
        weights["hand"+side]=share*fore*hand
        for name in ("torso","head","leg"+side,"knee"+side,"foot"+side):weights[name]*=1-share
    total=np.maximum(1e-6,np.sum(list(weights.values()),axis=0))
    for name,raw in weights.items():
        if not raw.any():continue
        group=o.vertex_groups.new(name="gladiator."+name)
        q=np.rint(np.clip(raw/total,0,1)*10000).astype(int)
        indices=np.flatnonzero(q>0);indices=indices[np.argsort(q[indices])]
        for batch in np.split(indices,np.flatnonzero(np.diff(q[indices]))+1):
            if len(batch):group.add(batch.tolist(),float(q[batch[0]])/10000,"REPLACE")
    mod=o.modifiers.new("Continuous linear skin deformation","ARMATURE")
    mod.object=rig;mod.use_deform_preserve_volume=False
    mod.show_viewport=False
    o.parent=rig;o["continuousSkin"]=True


def attach(o,rig,bone):
    kit.apply(o);kit.apply_transform(o)
    gk.uv_box(o)
    kit.shade(o,48)
    world=o.matrix_world.copy()
    o.parent,o.parent_type,o.parent_bone=rig,"BONE","gladiator."+bone
    o.matrix_world=world
    return o


def attach_garment(o,rig,sx=None):
    """Keep the waistband attached while the lower leather/cloth swings.

    Rigid panels rotating as a whole can send their upper corners through
    the torso belt. The short flexible section below the waistband shares
    the torso and existing skirt joints; studs remain on the rigid hem.
    """
    kit.apply(o);kit.apply_transform(o)
    gk.uv_box(o);kit.shade(o,48)
    p=np.array([v.co[:] for v in o.data.vertices])
    upper=soft(.55,.603,p[:,2])
    groups={"torso":upper}
    if sx is None:
        groups["skirtL"]=(1-upper)*(p[:,0]<0)
        groups["skirtR"]=(1-upper)*(p[:,0]>=0)
    else:
        groups["skirtL" if sx<0 else "skirtR"]=1-upper
    for name,raw in groups.items():
        group=o.vertex_groups.new(name="gladiator."+name)
        q=np.rint(raw*10000).astype(int)
        indices=np.flatnonzero(q>0);indices=indices[np.argsort(q[indices])]
        for batch in np.split(indices,np.flatnonzero(np.diff(q[indices]))+1):
            if len(batch):group.add(batch.tolist(),float(q[batch[0]])/10000,"REPLACE")
    mod=o.modifiers.new("Flexible garment waist and existing skirt joints","ARMATURE")
    mod.object=rig;mod.use_deform_preserve_volume=False
    o.parent=rig;o["garmentLining"]=True
    return o


def material_finish(root):
    """Stable broad pigments are vertex data, so export matches studio.

    Skin is matte and warmer over chest, elbows, nose and knuckles. Metal
    is restrained bronze with rubbed edges; hide retains dyed separation.
    Fine roughness details are preview-only, clearly named and editable.
    """
    for o in kit.descendants(root):
        if o.type!="MESH":continue
        me=o.data
        attr=me.color_attributes.get("AO") or me.color_attributes.new("AO","FLOAT_COLOR","POINT")
        me.color_attributes.active_color=attr
        me.color_attributes.render_color_index=list(me.color_attributes).index(attr)
        coords=np.empty(len(me.vertices)*3,dtype=np.float32)
        me.vertices.foreach_get("co",coords)
        x,y,z=coords.reshape(-1,3).T
        warm=.033*np.exp(-((z-.892)/.065)**2)*np.maximum(0,y)*6
        warm+=.043*np.exp(-((z-1.127)/.026)**2)*np.exp(-(x/.043)**2)
        var=.012*np.sin(x*16+z*10)*np.cos(y*21-z*7)
        pigments=np.stack((1+var,1-warm+var*.5,1-warm*.7+var*.4,np.ones(len(z))),axis=1)
        if attr.domain=="POINT":
            attr.data.foreach_set("color",pigments.reshape(-1))
        else:
            indices=np.empty(len(me.loops),dtype=np.int32)
            me.loops.foreach_get("vertex_index",indices)
            attr.data.foreach_set("color",pigments[indices].reshape(-1))
        for m in me.materials:
            family=m.name.split(":")[0]
            bs=m.node_tree.nodes.get("Principled BSDF")
            if family=="skin":
                bs.inputs["Roughness"].default_value=.64
                bs.inputs["Specular IOR Level"].default_value=.25
                bs.inputs["Subsurface Weight"].default_value=.065
                bs.inputs["Subsurface Radius"].default_value=(.10,.04,.025)
            elif family=="gilt":
                bs.inputs["Roughness"].default_value=.35
                bs.inputs["Metallic"].default_value=.78
            elif family=="hide":bs.inputs["Roughness"].default_value=.73
            elif family=="weave":bs.inputs["Roughness"].default_value=.88
            elif family=="hair":bs.inputs["Roughness"].default_value=.86


def export_review(root,path):
    """Normalize only the named runtime drivers on export, then restore.

    The editable master uses period-separated sculpt names. Arena drivers
    use `gladiatorarmR` etc.; preserve that actual raw GLB contract rather
    than relying on GLTFLoader's node name sanitizing side effect.
    """
    rig=bpy.data.objects["gladiator.skeleton"]
    rename={b.name:b.name.replace("gladiator.","gladiator",1) for b in rig.data.bones}
    attachments={o:o.parent_bone for o in kit.descendants(root) if o.parent_type=="BONE"}
    groups={o:[g.name for g in o.vertex_groups] for o in kit.descendants(root) if o.type=="MESH"}
    try:
        for b in rig.data.bones:b.name=rename[b.name]
        for o,name in attachments.items():o.parent_bone=rename.get(name,name)
        for o,names in groups.items():
            for g,name in zip(o.vertex_groups,names):g.name=rename.get(name,name)
        kit.refresh();kit.export([root],path)
    finally:
        inverse={v:k for k,v in rename.items()}
        for b in rig.data.bones:b.name=inverse.get(b.name,b.name)
        for o,name in attachments.items():o.parent_bone=name
        for o,names in groups.items():
            for g,name in zip(o.vertex_groups,names):g.name=name
        kit.refresh()


def build_master(eq,evaluate_viewport=True):
    root=kit.empty("gladiator")
    print("GLADIATOR source: authored primary forms",flush=True)
    # Use finer private equipment topology without moving other figures.
    gk.MASTER_DETAIL=True
    skin=[torso(eq),eq.skull(),eq.neck()]
    legparts,legpivots,gear=legs(eq);skin+=legparts
    sides=[]
    for sx,side,s,c,rod,pole in ((1,"R",eq.S_R,eq.GRIP,eq.BLADE,eq.S_R+V(.35,-.8,-.3)),
                                 (-1,"L",eq.S_L,eq.LEFT,eq.LEFT_ROD,eq.S_L+V(-.6,-.25,-.5))):
        e,w,xax=eq.arm_pose(s,c,rod,pole)
        sides.append((sx,side,s,e,w,c,xax,rod))
    skin+=arms(eq,sides)
    print("GLADIATOR source: continuous sculpt fusion",flush=True)
    body=fuse(skin,eq.SKIN)
    rig,pos=skeleton(eq,root,sides,legpivots)
    weight_skin(body,rig,eq,sides,pos)
    print("GLADIATOR source: weighted anatomical rig",flush=True)
    for o,bone in gear:attach(o,rig,bone)
    for o in eq.belt()+eq.strap():attach(o,rig,"torso")
    attach_garment(waist_lining(eq),rig)
    for side,sx in (("L",-1),("R",1)):
        for o in eq.kilt(sx):
            if "-under" in o.name or "-strip" in o.name:attach_garment(o,rig,sx)
            else:attach(o,rig,"skirt"+side)
    for o in eq.beard()+eq.helmet():attach(o,rig,"head")
    for o in eq.plume():attach(o,rig,"hair")
    # Keep the existing blink/gaze controls: run its facial grouping against
    # an attachment helper, with a tiny fixed neck mesh as the head root.
    def facial_part(rid,name,pieces,pivot,parent,**kwargs):
        if not pieces:
            return rig
        obj=gk.part(rid,name,pieces,pivot,None,**kwargs)
        if name=="head":
            obj.name="gladiator.face-fixed"
            return attach(obj,rig,"head")
        if getattr(parent,"name","")=="gladiator.face-fixed":attach(obj,rig,"head")
        else:kit.parent(obj,parent)
        return obj
    import face_rig
    fixed=gk.ball("gladiator-facial-anchor",.002,V(0,-.01,1.08),eq.SKIN,seg=12,rings=8)
    face_rig.head(facial_part,"gladiator",[fixed]+eq.face(),eq.NECK,rig,angle=62)
    for sx,side,s,e,w,c,xax,rod in sides:
        for o in eq.upper_arm(side,s,e,sx):
            # Bare anatomy is the continuous sculpt. Right-arm leather and
            # bronze construction remains a distinct guard over it.
            if any(m.name==eq.SKIN for m in o.data.materials):bpy.data.objects.remove(o,do_unlink=True)
            else:attach(o,rig,"arm"+side)
        for o in eq.forearm(side,e,w,c,xax,rod,sx==1):
            if any(m.name==eq.SKIN for m in o.data.materials):bpy.data.objects.remove(o,do_unlink=True)
            else:attach(o,rig,"fore"+side)
    sword=eq.gladius();gk.transform(sword,eq.gladius_frame(sides[0][6]))
    for o in sword:attach(o,rig,"weapon")
    for o in eq.scutum():attach(o,rig,"shield")
    print("GLADIATOR source: equipment construction complete",flush=True)
    material_finish(root)
    for mod in body.modifiers:
        mod.show_viewport=evaluate_viewport
    root["unoptimized"]=True
    root["masterBrief"]="docs/concepts/2026-10-04-arena-viking-gladiator-medic/brief.md"
    root["skinContract"]="continuous linear skin; common axes; named bone attachments"
    root["jointPivots"]=json.dumps({k:list(v) for k,v in pos.items()})
    print("GLADIATOR MASTER",len(body.data.vertices),"editable skin vertices",len(body.data.polygons),"faces")
    kit.refresh()
    return root
