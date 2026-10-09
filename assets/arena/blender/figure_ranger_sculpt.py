"""Cowboy's editable authored source, before the independent runtime copy.

The tailored frontier outfit and rifle preserve the original native rest
frames. A continuous sleeve skin replaces the old cut elbow and shoulder
balls; hand sculpts have separate curled digits and a connected thumb web.
"""
import json
import bisect
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import face_rig
import figure_ranger_kit as rk
import figure_ranger_tailoring as base

V = rk.V
R = 'ranger'
SKIN = 'skin:' + kit.tint('cowboy-skin', '#d6a083')
HAIR = 'hair:' + kit.tint('cowboy-hair', '#3a2c23')
LIPS = 'skin:' + kit.tint('cowboy-lip', '#ac7866')
INK = 'resin:' + kit.tint('cowboy-eye-shadow', '#3a2a22')
WHITE = 'resin:' + kit.tint('cowboy-eye-white', '#e4d7bd')
IRIS = 'resin:' + kit.tint('cowboy-iris', '#665438')
NAIL = 'skin:' + kit.tint('cowboy-nails', '#c9a38e')


_PROFILE_CACHE = {}


def cubic_table(rows, value):
    """Monotone cubic profile interpolation, retaining authored landmarks."""
    n = len(rows)
    if value <= rows[0][0]:
        return rows[0][1] if len(rows[0]) == 2 else tuple(rows[0][1:])
    if value >= rows[-1][0]:
        return rows[-1][1] if len(rows[0]) == 2 else tuple(rows[-1][1:])
    key=tuple(tuple(row) for row in rows)
    cached=_PROFILE_CACHE.get(key)
    if cached is None:
        xs=[row[0] for row in rows]
        slopes=[]
        for k in range(1,len(rows[0])):
            d=[(rows[i+1][k]-rows[i][k])/(xs[i+1]-xs[i]) for i in range(n-1)]
            col=[d[0]]
            for i in range(1,n-1):
                if d[i-1]*d[i]<=0:col.append(0.0)
                else:
                    h0,h1=xs[i]-xs[i-1],xs[i+1]-xs[i]
                    w1,w2=2*h1+h0,h1+2*h0
                    col.append((w1+w2)/(w1/d[i-1]+w2/d[i]))
            col.append(d[-1]);slopes.append(col)
        cached=(xs,slopes);_PROFILE_CACHE[key]=cached
    xs,slopes=cached
    j = bisect.bisect_right(xs,value)-1
    h = rows[j + 1][0] - rows[j][0]
    t = (value - rows[j][0]) / h
    out = []
    for k in range(1, len(rows[0])):
        a, b = rows[j][k], rows[j + 1][k]
        out.append((2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*h*slopes[k-1][j]+(-2*t**3+3*t*t)*b+(t**3-t*t)*h*slopes[k-1][j+1])
    return out[0] if len(out) == 1 else tuple(out)


def smooth_object(obj, levels=1, angle=70):
    kit.shade(obj, angle)
    if levels:
        mod = obj.modifiers.new('Editable authored subdivision', 'SUBSURF')
        mod.levels = mod.render_levels = levels
    return obj


def shaped_face_disp(ad, z):
    a = abs(ad)
    g = rk.gauss
    d = cubic_table(base.NOSE_H, z) * g(ad, 0, cubic_table(base.NOSE_S, z))
    d += .0065 * g(a, 13.5, 4.0) * g(z, 1.115, .0062)  # alar cartilages
    d -= .0027 * g(a, 14, 3) * g(z, 1.111, .0018)       # nostril pocket
    d -= .0090 * g(a, 28, 10) * g(z, 1.156, .011)        # orbital recess
    bz = 1.174 - .003 * g(a, 9, 8)
    d += .0065 * g(z, bz, .0085) * rk.smooth(54, 32, a) # frontal brow ridge
    d -= .0018 * g(ad, 0, 4) * g(z, 1.169, .009)         # glabella
    d += .0053 * g(a, 45, 13) * g(z, 1.139, .012)       # cheekbone plane
    d -= .0038 * g(a, 40, 12) * g(z, 1.107, .017)       # cheek hollow
    d -= .0021 * g(z, 1.0965, .0017) * g(ad, 0, 20)     # lip separation
    d += .0022 * g(z, 1.101, .0028) * g(ad, 0, 17)      # upper lip
    d += .0030 * g(z, 1.0903, .0035) * g(ad, 0, 15)     # lower lip
    d -= .0017 * g(z, 1.0825, .0027) * g(ad, 0, 20)     # labiomental fold
    d += .0070 * g(z, 1.068, .009) * g(ad, 0, 24)       # chin pad
    d -= .0015 * g(z, 1.064, .005) * g(ad, 0, 3)        # subtle cleft
    d += .0050 * g(a, 65, 12) * g(z, 1.070, .015)       # angle of jaw
    d -= .0028 * g(a, 62, 10) * g(z, 1.175, .015)       # temple
    # Nasolabial tissue and lower-eyelid trough; broad planes before relief.
    d -= .0012 * g(a, 21 + 170*(1.119-z), 3.2) * g(z, 1.109, .016)
    d -= .0010 * g(a, 31, 13) * g(z, 1.145, .0017)
    return d


def skull():
    angles = np.linspace(-180, 180, 193)[:-1]
    zs = np.linspace(1.013, 1.264, 134)
    mesh = rk.Mesh('ranger-authored-adult-face', SKIN)
    rows = [[mesh.v(base.face_point(float(a), float(z))) for a in angles] for z in zs]
    mesh.grid(rows, SKIN, closed=True)
    mesh.fan(rows[0], V(0, base.CY, 1.006), SKIN, flip=True)
    mesh.fan(rows[-1], V(0, base.CY-.005, 1.268), SKIN)
    return smooth_object(mesh.obj(recalc=True), 0)


def face_path(name, coords, radii, mat, n=12):
    points = [base.face_point(a,z) + base.face_normal(a,z) * lift for a,z,lift in coords]
    return rk.tube(name,points,radii,mat,n=n,caps=('dome','dome'))


def eyes():
    out=[]
    for side in (-1,1):
        ac=side*27
        # A true recessed lens bulges inside the orbital rim. A conforming
        # paint patch follows the socket hollow and reads almost closed.
        sq=.94 if side<0 else 1.0
        normal=base.face_normal(ac,base.EYE_Z)
        up=(V(0,0,1)-normal*normal.z).normalized()
        right=normal.cross(up).normalized()
        centre=base.face_point(ac,base.EYE_Z)+normal*.0043
        axes=rk.basis(right,normal,up,centre)
        def lens(label,at,scale,mat,segs=48,rings=24):
            o=rk.ball(f'ranger-{label}{side}',1,V(*at),mat,scale=scale,seg=segs,rings=rings)
            rk.transform([o],axes);return o
        out.append(lens('eye-white',(0,0,0),(.0131,.0045,.0060*sq),WHITE))
        out.append(lens('iris',(side*.0005,.00405,-.0002),(.0044,.0010,.00445*sq),IRIS,40,20))
        out.append(lens('pupil',(side*.0005,.00495,-.0002),(.0021,.0005,.0030*sq),INK,32,16))
        out.append(lens('catch',(-.0012,.00545,.0015),(.0008,.00022,.0008),WHITE,20,10))
        # Skin rims are sculpted, tapered at corners rather than an ink mask.
        for upper in (True,False):
            path=[]; radii=[]
            for t in np.linspace(-1,1,33):
                k=math.sqrt(max(0,1-t*t))
                z=(.0055*sq if upper else -.0053)*k+side*t*.0008
                path.append(centre+right*(float(t)*.0132)+up*z+normal*(.0029*k))
                radii.append(.0003+.0010*k)
            # The existing eye control closes vertically during a blink.
            # Give both lid rims its recognized eye-outline label so the
            # complete lens closes together instead of leaving an empty rim.
            out.append(rk.tube(f'ranger-eye-outline{side}',path,radii,SKIN,n=12,caps=('dome','dome')))
        coords=[]; radii=[]
        for t in np.linspace(0,1,35):
            a=side*(12+29*t)
            z=1.175 + (.0015 if side>0 else -.001) + .004*math.sin(t*math.pi)-.001*t
            coords.append((float(a),float(z),.0035))
            radii.append(.0008+.0022*math.sin(math.pi*t)**.6)
        out.append(face_path(f'ranger-brow{side}',coords,radii,HAIR))
        # Small nostril aperture, no painted black holes across the nose.
        out.append(base.paint_patch(f'nostril{side}',side*13.5,1.112,2.7,.0011,.0014,.0003,INK,segs=24,rings=4))
    # Calm mouth: one curved closed line and dimensional vermilion planes.
    coords=[]; radii=[]
    for a in np.linspace(-18,19,49):
        z=1.096 + .0003*(a/19)**2 + .0011*(a/19)
        coords.append((float(a),float(z),.0009)); radii.append(.00055)
    out.append(face_path('ranger-mouth',coords,radii,INK))
    for upper in (True,False):
        coords=[]; radii=[]
        for a in np.linspace(-15,15,35):
            z=(1.0995 if upper else 1.092)+(1-(a/15)**2)*(.0007 if upper else -.0005)
            coords.append((float(a),float(z),.00045)); radii.append(.0007*max(.15,1-(a/17)**2))
        out.append(face_path(f'ranger-lip-{upper}',coords,radii,LIPS))
    return out


def ears():
    out=[]
    for side in (-1,1):
        centre=base.face_point(side*90,1.143)+V(side*.004,-.007,0)
        # Authored outer pinna: narrow helix with a shallow recessed concha.
        mesh=rk.Mesh(f'ranger-ear-pinna-{side}',SKIN)
        rings=[]
        for t in np.linspace(0,1,19):
            ring=[]
            for a in np.linspace(0,math.tau,65)[:-1]:
                y=.020*math.cos(a)*(1-.13*math.sin(a))
                z=.029*math.sin(a)
                bulge=.006*math.exp(-((t-.80)/.12)**2)-.002*(1-t)**2
                ring.append(mesh.v(centre+V(side*(.001+bulge),y*t,z*t)))
            rings.append(ring)
        mesh.grid(rings,closed=True)
        obj=mesh.obj(recalc=True); out.append(smooth_object(obj,0))
        path=[]
        for a in np.linspace(-1.0,3.6,35):
            path.append(centre+V(side*.0075,.011*math.cos(a),.019*math.sin(a)))
        out.append(rk.tube(f'ranger-ear-antihelix-{side}',path,[.0019]*len(path),SKIN,n=10))
        tragus=centre+V(side*.009,.009,-.002)
        out.append(rk.ball(f'ranger-ear-tragus-{side}',1,tragus,SKIN,scale=(.003,.0035,.007),seg=24,rings=12))
    return out


def hair():
    out=[]
    # A coherent shaped hair mass carries sparse combed relief. Separate
    # uniform strands alone resemble cords, even at high resolution.
    mesh=rk.Mesh('ranger-shaped-hair-mass',HAIR)
    rows=[]
    for t in np.linspace(0,1,27):
        row=[]
        for ad in np.linspace(66,294,113):
            aa=float(ad if ad<=180 else ad-360)
            z=base.lerp(1.208,base.hairline(aa)-.002,t)
            a=aa+2.1*math.sin(t*math.pi)
            extra=.0017+.0020*math.sin(t*math.pi)+.0008*math.sin(a*.23+z*43)*math.sin(t*math.pi)
            row.append(mesh.v(base.face_point(a,z)+base.face_normal(a,z)*extra))
        rows.append(row)
    mesh.grid(rows);out.append(mesh.obj(outward=base.HC))
    for ad in np.linspace(69,291,19):
        aa=float(ad if ad<=180 else ad-360)
        low=base.hairline(aa)
        path=[]; radii=[]
        for t in np.linspace(0,1,14):
            a=aa+math.sin(t*math.pi)*3.5
            z=1.209*(1-t)+(low-.003)*t
            path.append(base.face_point(a,z)+base.face_normal(a,z)*(.0018+.0026*math.sin(t*math.pi)))
            radii.append((.0011+.0010*math.sin(t*math.pi),.0025*(1-.65*t)))
        out.append(rk.tube(f'ranger-combed-lock-{int(ad)}',path,radii,HAIR,n=10,up=(0,0,1),caps=(None,'dome')))
    return out


def head():
    pieces=[skull(),base.neck()]+eyes()+ears()+hair()
    rk.transform(pieces,Matrix.Translation(V(0,0,base.HEAD_DZ)))
    return pieces


def hand(name,c,xax,kax,chir):
    """Connected shaped palm, four separated curled digits and thumb web."""
    pieces=[]
    palm=[]
    for x,rz,ry,cy in [(-.056,.019,.014,.003),(-.048,.022,.018,.003),(-.036,.027,.020,.005),(-.025,.030,.018,.007),(-.014,.030,.015,.009),(-.006,.027,.011,.009)]:
        palm.append([V(x,cy+y,z) for z,y,_ in rk.sup(40,rz,ry,2.35)])
    pieces.append(rk.loft(name+'-palm',palm,SKIN,
                          start=V(-.058,.003,0),end=V(-.003,.009,0)))
    zs=[-.0235,-.0085,.007,.022]
    for j,z in enumerate(zs):
        scale=[.83,1,1,.91][j]
        path=[V(-.011,.010,z),V(.004,.021,z+.0005),V(.019,.020,z+.001),V(.027,.010,z+.001),V(.026,-.004,z+.0004),V(.018,-.014,z),V(.008,-.016,z)]
        # Smooth a coherent finger, with broad proximal knuckle and taper.
        sample=kit.smooth_path(path,32)
        radii=[]
        for t in np.linspace(0,1,len(sample)):
            r=(.0065*(1-.23*t)+.0009*math.exp(-((t-.31)/.09)**2)+.0004*math.exp(-((t-.65)/.08)**2))*scale
            radii.append((r*.98,r))
        pieces.append(rk.tube(name+f'-digit-{j}',sample,radii,SKIN,n=20,up=(0,0,1),caps=('dome','dome')))
    thumb=[V(-.041,-.010,.012),V(-.031,-.023,.021),V(-.017,-.029,.028),V(-.001,-.030,.030),V(.011,-.024,.026)]
    sample=kit.smooth_path(thumb,30)
    radii=[.012*(1-t)+.006*t for t in np.linspace(0,1,len(sample))]
    pieces.append(rk.tube(name+'-thumb',sample,radii,SKIN,n=24,up=(0,0,1),caps=('dome','dome')))
    # Web joins only the thenar/palm base, never adjacent finger tips.
    pieces.append(rk.ball(name+'-thenar',1,V(-.034,-.009,.012),SKIN,scale=(.019,.018,.016),seg=40,rings=24))
    for o in pieces: kit.apply(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces: o.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    bpy.ops.object.join(); palm_obj=pieces[0]; palm_obj.name=name+'-connected'
    mod=palm_obj.modifiers.new('Editable connected hand sculpt','REMESH'); mod.mode='VOXEL';mod.voxel_size=.00095;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=palm_obj.modifiers.new('Soft anatomical transitions','SMOOTH');mod.factor=.45;mod.iterations=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    kit.shade(palm_obj,80)
    # Sculpt tiny dorsal creases and knuckle planes into the coherent mesh.
    for vert in palm_obj.data.vertices:
        x,y,z=vert.co
        if x>.005:
            near=min(abs(z-zz) for zz in zs)
            crease=math.exp(-((x-.025)/.0025)**2)*math.exp(-(near/.006)**2)
            if y>.005: vert.co.y -= .0008*crease
    plates=[]
    for j,z in enumerate(zs):
        plate=rk.ball(name+f'-nail-{j}',1,V(.009,-.020,z),NAIL,scale=(.005,.0006,.0042),seg=24,rings=12)
        plates.append(plate)
    xax,kax=Vector(xax).normalized(),Vector(kax).normalized()
    zax=xax.cross(kax)*chir
    mat=rk.basis(xax,kax,zax,c)
    rk.transform([palm_obj]+plates,mat)
    return [palm_obj]+plates


def make_sleeve(side,s,e,w,sx):
    """One smooth cloth tube over a bent arm; fine transverse fold hierarchy."""
    arm=(e-s).normalized();fore=(w-e).normalized()
    end=base.lerp(e,w,.58)
    # Use a quadratic fillet round the inner elbow instead of a joint ball.
    # Enter beneath the sloping coat yoke. A top-cap above the coat would
    # read as a separate conical shoulder even when its elbow deforms well.
    ctrl=[s+V(-sx*.020,0,-.016),base.lerp(s,e,.25),e-arm*.036,
          e+fore*.035,base.lerp(e,end,.7),end]
    path=[Vector(point) for point in kit.smooth_path(ctrl,84)]
    rings=[]
    for j,p in enumerate(path):
        t=j/(len(path)-1)
        tangent=(path[min(len(path)-1,j+1)]-path[max(0,j-1)]).normalized()
        u,n=rk.frame_at(tangent,(0,1,0))
        elbow=(p-e).length
        rr=.046-.004*t + .006*math.exp(-((t-.21)/.16)**2)
        ring=[]
        for a in np.linspace(0,math.tau,65)[:-1]:
            d=u*math.cos(a)+n*math.sin(a)
            # Broad tension pleats at elbow, restrained sewn sleeve seam.
            inward=max(0,d.dot((arm-fore).normalized()))
            fold=.0029*math.exp(-(elbow/.07)**2)*math.sin(elbow*145+.7)*(.35+.65*inward)
            fold+=.0011*math.cos(5*a+5*t)*math.sin(math.pi*t)**2
            ring.append(p+d*(rr+fold))
        rings.append(ring)
    obj=rk.loft(f'ranger-sleeve-connected-{side}',rings,base.DUSTER,start='flat',end=None)
    kit.shade(obj,80)
    # Cuff and shirt remain rigid forearm components, overlap the sleeve.
    cuff=[rk.tube(f'ranger-rolled-cuff-{side}',[end-fore*.025,end-fore*.011,end+fore*.004],[.049,.052,.051],base.DUSTER,n=48,caps=(None,None))]
    cuff.append(rk.tube(f'ranger-shirtsleeve-{side}',[end-fore*.008,base.lerp(end,w,.5),w+fore*.004],[.038,.034,.031],base.TEAM,n=48,caps=('flat','flat')))
    cuff.append(rk.tube(f'ranger-shirtcuff-{side}',[w-fore*.021,w+fore*.004],[.033,.033],base.TEAM,n=48,caps=(None,None)))
    return obj,cuff


def make_armature(torso,arms):
    data=bpy.data.armatures.new('Cowboy continuous sleeve drivers')
    rig=bpy.data.objects.new('ranger.sleeve-skeleton',data);bpy.context.collection.objects.link(rig)
    kit.parent(rig,torso)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    inv=rig.matrix_world.inverted()
    stay=data.edit_bones.new('ranger-sleeve-stay')
    stay.head=inv@base.WAIST;stay.tail=stay.head+V(0,0,.07)
    for side,values in arms.items():
        s,e,w=values
        for part,pos in [('arm',s),('fore',e)]:
            bone=data.edit_bones.new(R+part+side)
            bone.head=inv@pos;bone.tail=bone.head+V(0,0,.07)
            bone.use_connect=False
        data.edit_bones[R+'fore'+side].parent=data.edit_bones[R+'arm'+side]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.show_in_front=True;rig['arenaCommonAxes']=True
    rig['anatomicalPivots']=json.dumps({p+s:list(v) for s,(sh,el,wr) in arms.items() for p,v in [('arm',sh),('fore',el)]})
    return rig


def bind_sleeve(obj,rig,side,s,e,w):
    # Exact bone geometry is world-authored. Weight by arc-side ownership
    # with a continuous blend only around elbow and shoulder, no torso leak.
    points=np.array([v.co[:] for v in obj.data.vertices])
    u=np.array((e-s).normalized()); f=np.array((w-e).normalized())
    rel=points-np.array(e)
    along=.5*(rel.dot(u)+rel.dot(f))
    t=np.clip((along+.040)/.080,0,1); t=t*t*(3-2*t)
    shoulder=(points-np.array(s)).dot(u)
    share=np.clip((shoulder-.005)/.055,0,1);share=share*share*(3-2*share)
    for bone,values in [(R+'arm'+side,(1-t)*share),
                        (R+'fore'+side,t*share),('ranger-sleeve-stay',1-share)]:
        group=obj.vertex_groups.new(name=bone)
        q=np.rint(values*10000).astype(int)
        order=np.argsort(q)
        for inds in np.split(order,np.flatnonzero(np.diff(q[order]))+1):
            if len(inds) and q[inds[0]]:group.add(inds.tolist(),float(q[inds[0]])/10000,'REPLACE')
    mod=obj.modifiers.new('Continuous elbow cloth deformation','ARMATURE');mod.object=rig
    mod.use_deform_preserve_volume=False
    kit.parent(obj,rig);rk.uv_box(obj)
    obj['continuousSleeve']=True


def bone_attach(obj,rig,bone):
    kit.refresh();before=obj.matrix_world.copy()
    obj.parent=rig;obj.parent_type='BONE';obj.parent_bone=bone
    obj.matrix_world=before;kit.refresh()


def continuous_trousers(side,sx,hip,knee,ankle):
    """Shaped wool leg over a continuously weighted knee, tucked into boot."""
    rows=[(.281,.047,.046),(.315,.052,.049),(.360,.053,.051),
          (.411,.055,.053),(.465,.059,.056),(.530,.064,.060),
          (.600,.067,.062),(.665,.071,.063)]
    rings=[]
    for z in np.linspace(rows[0][0],rows[-1][0],91):
        if z>=knee.z:
            centre=base.lerp(knee,hip,min(1,(z-knee.z)/(hip.z-knee.z)))
        else:
            centre=base.lerp(knee,ankle,(knee.z-z)/(knee.z-ankle.z))
        rx,ry=cubic_table(rows,float(z))
        ring=[]
        for a in np.linspace(0,math.tau,65)[:-1]:
            # Tailored knee fullness and crease, not a kneecap ball.
            front=max(0,math.cos(a))
            back=max(0,-math.cos(a))
            fold=.0018*math.exp(-((z-knee.z)/.055)**2)*math.sin((z-knee.z)*130+a*.8)*(back+.35*front)
            fold+=.0011*math.exp(-((z-.535)/.066)**2)*math.cos(4*a+z*17)
            ring.append(V(centre.x+(rx+fold)*math.sin(a),
                          centre.y+(ry+fold)*math.cos(a),float(z)))
        rings.append(ring)
    obj=rk.loft('ranger-trousers-connected-'+side,rings,base.CHAR,
                start='flat',end='flat')
    kit.shade(obj,80)
    return obj


def make_leg_rig(root,legs):
    data=bpy.data.armatures.new('Cowboy continuous trouser knee drivers')
    rig=bpy.data.objects.new('ranger.leg-skeleton',data)
    bpy.context.collection.objects.link(rig);kit.parent(rig,root)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for side,(hip,knee,ankle) in legs.items():
        for part,pos in [('leg',hip),('knee',knee),('foot',ankle)]:
            b=data.edit_bones.new(R+part+side);b.head=pos;b.tail=pos+V(0,0,.07);b.use_connect=False
        data.edit_bones[R+'knee'+side].parent=data.edit_bones[R+'leg'+side]
        data.edit_bones[R+'foot'+side].parent=data.edit_bones[R+'knee'+side]
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    rig['arenaCommonAxes']=True
    return rig


def bind_trousers(obj,rig,side,knee):
    z=np.array([v.co.z for v in obj.data.vertices])
    knee_share=np.clip((knee.z+.044-z)/.085,0,1)
    knee_share=knee_share*knee_share*(3-2*knee_share)
    for name,values in [(R+'leg'+side,1-knee_share),(R+'knee'+side,knee_share)]:
        group=obj.vertex_groups.new(name=name);q=np.rint(values*10000).astype(int);order=np.argsort(q)
        for inds in np.split(order,np.flatnonzero(np.diff(q[order]))+1):
            if len(inds) and q[inds[0]]:group.add(inds.tolist(),float(q[inds[0]])/10000,'REPLACE')
    mod=obj.modifiers.new('Continuous cloth knee deformation','ARMATURE');mod.object=rig
    mod.use_deform_preserve_volume=False;kit.parent(obj,rig);rk.uv_box(obj)
    obj['continuousTrouser']=True


def refine_tailoring(pieces):
    # Retain the authored construction, rather than generic inflated clothes.
    for obj in pieces:
        label=obj.name
        if any(k in label for k in ('coat','skirt','lapel','collar','lining','vest','shirt','shaft','stock','forend','brim','crown')):
            smooth_object(obj,1,80)
        elif 'button' in label:
            smooth_object(obj,1,65)
    return pieces


def rifle():
    pieces,lever=base.rifle_local()
    refine_tailoring(pieces)
    # Deliberate engineering detail: recessed screw disks and one loading
    # gate latch. No arbitrary ornament that interrupts the original hold.
    for side in (-1,1):
        for y,z in [(.029,.039),(.073,.025)]:
            disk=rk.ball(f'ranger-receiver-screw-{side}-{y}',1,V(side*.0177,y,z),base.STEEL,scale=(.0009,.0029,.0029),seg=28,rings=14)
            pieces.append(disk)
            pieces.append(rk.tube(f'ranger-screw-slot-{side}-{y}',[V(side*.0186,y-.0016,z),V(side*.0186,y+.0016,z)],[.0003,.0003],INK,n=6))
    return pieces,lever


def prepare_palette():
    base.SKIN,base.HAIR=SKIN,HAIR
    base.table=cubic_table
    base.face_disp=shaped_face_disp
    base.head=head
    # Overall cloth proportions remain fixed. Softer shoulders and natural
    # hem asymmetry come from profile interpolation and authored folds.


def material_finish():
    for name in [SKIN,HAIR,LIPS,NAIL,base.DUSTER,base.FELT,base.CHAR,base.LEATHER,base.DARK,base.WALNUT]:
        mat=kit.material(name);nodes,links=mat.node_tree.nodes,mat.node_tree.links
        bs=nodes.get('Principled BSDF')
        bs.inputs['Specular IOR Level'].default_value=.26
        if name in (SKIN,LIPS,NAIL):
            bs.inputs['Roughness'].default_value=.66 if name==SKIN else .59
            bs.inputs['Subsurface Weight'].default_value=.025
        elif name==HAIR:bs.inputs['Roughness'].default_value=.57
        elif name in (base.DUSTER,base.FELT,base.CHAR):
            bs.inputs['Roughness'].default_value=.86
            bs.inputs['Sheen Weight'].default_value=.11
        elif name==base.LEATHER:bs.inputs['Roughness'].default_value=.61
        elif name==base.WALNUT:bs.inputs['Roughness'].default_value=.58
        # Source microfinish is offline-only; runtime's supported families
        # supply restrained tiling relief rather than noise geometry.
        if name==SKIN:
            noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=220
            noise.inputs['Detail'].default_value=2
            bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.08;bump.inputs['Distance'].default_value=.00035
            links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])


def author_pigment(root):
    """Pigment cached as generic data; only AO is exported as COLOR_0."""
    kit.refresh()
    for obj in kit.descendants(root):
        if obj.type!='MESH':continue
        me=obj.data
        attr=me.attributes.get('RangerPigment') or me.attributes.new(name='RangerPigment',type='FLOAT_VECTOR',domain='CORNER')
        values=np.ones((len(me.loops),3),dtype=np.float32)
        for i,loop in enumerate(me.loops):
            vertex=me.vertices[loop.vertex_index]
            p=obj.matrix_world@vertex.co
            mat=me.materials[me.polygons[0].material_index].name if len(me.materials)==1 else None
            # Use material membership per loop on the joined head/torso.
            values[i]=(.99,.995,1.0)
        for poly in me.polygons:
            mat=me.materials[poly.material_index].name
            for li in poly.loop_indices:
                p=obj.matrix_world@me.vertices[me.loops[li].vertex_index].co
                x,y,z=p
                if mat==SKIN:
                    # Stubble and warm cheeks stay subordinate to face planes.
                    jaw=np.exp(-((z-1.074)/.033)**2)*max(0,min(1,(y-.02)/.06))
                    lip=np.exp(-((z-1.108)/.009)**2)*np.exp(-(x/.025)**2)
                    cheek=np.exp(-((abs(x)-.047)/.019)**2)*np.exp(-((z-1.14)/.018)**2)
                    values[li]=np.array([1-.19*jaw-.07*lip,1-.21*jaw-.065*cheek,1-.22*jaw-.06*cheek])
                elif mat==base.WALNUT:
                    # Restrained large woodgrain, stable at card/game scale.
                    local=base.rifle_frame().inverted()@p
                    k=.96+.04*math.sin(local.y*80+math.sin(local.z*160)*.7)
                    values[li]=(k,k,k)
                elif mat in (base.DUSTER,base.FELT):
                    shade=.985+.014*math.sin(x*37+z*20)*math.sin(y*33-z*27)
                    values[li]=(shade,shade,shade)
        attr.data.foreach_set('vector',values.reshape(-1))


def finish_ao(root):
    """Recombine the current bake with immutable pigment, never twice."""
    for obj in kit.descendants(root):
        if obj.type!='MESH':continue
        me=obj.data
        ao=me.color_attributes.get('AO')
        if not ao:
            kit.fill_ao([obj]);ao=me.color_attributes['AO']
        cache=me.attributes.get('RangerAO') or me.attributes.new(name='RangerAO',type='FLOAT_VECTOR',domain='CORNER')
        rgba=np.empty(len(ao.data)*4,dtype=np.float32);ao.data.foreach_get('color',rgba)
        cache.data.foreach_set('vector',rgba.reshape(-1,4)[:,:3].reshape(-1))
        pigment=me.attributes.get('RangerPigment')
        if pigment:
            rgb=np.empty(len(pigment.data)*3,dtype=np.float32);pigment.data.foreach_get('vector',rgb)
            rgba.reshape(-1,4)[:,:3]*=rgb.reshape(-1,3)
            ao.data.foreach_set('color',rgba)
        for layer in list(me.color_attributes):
            if layer.name!='AO':me.color_attributes.remove(layer)
        me.color_attributes.active_color=ao;me.color_attributes.render_color_index=0


def build_master():
    prepare_palette()
    root=kit.empty(R)
    print('RANGER_SOURCE_STAGE tailored lower body',flush=True)
    legs={};leg_data={}
    for side,sx,knee,ankle,out in [('L',-1,V(-.094,.022,.36),V(-.108,.03,.085),12),('R',1,V(.094,-.012,.36),V(.11,-.022,.085),9)]:
        hip=V(sx*base.HIP_X,0,base.HIP_Z)
        foot,shaft=base.boot(sx,ankle,knee,out)
        shin=base.part('knee'+side+'-surface',refine_tailoring(shaft),knee,root,angle=80)
        toe=base.part('foot'+side+'-surface',foot,ankle,root,angle=70)
        holster=base.part('holsterR',base.holster(),hip,root,angle=70) if sx>0 else None
        cloth=continuous_trousers(side,sx,hip,knee,ankle)
        legs[side]=(hip,knee,ankle);leg_data[side]=(shin,toe,holster,cloth)
    leg_rig=make_leg_rig(root,legs)
    for side,(hip,knee,ankle) in legs.items():
        shin,toe,holster,cloth=leg_data[side]
        bone_attach(shin,leg_rig,R+'knee'+side);bone_attach(toe,leg_rig,R+'foot'+side)
        if holster:bone_attach(holster,leg_rig,R+'leg'+side)
        bind_trousers(cloth,leg_rig,side,knee)
    print('RANGER_SOURCE_STAGE tailored duster and vest',flush=True)
    pieces=[base.shirt(),base.hips()]+base.vest()+base.kerchief()+base.coat_upper()+base.gun_belt()
    torso=base.part('torso',refine_tailoring(pieces),base.WAIST,root,angle=80)
    base.part('beard',refine_tailoring(base.kerchief_point()),base.KPOINT_PIVOT,torso,angle=80)
    tails=base.part('cape2',refine_tailoring(base.kerchief_tails()),base.KNOT,torso,angle=80);kit.drape(tails)
    for side,sx in [('L',-1),('R',1)]:
        half=base.part('skirt'+side,refine_tailoring(base.skirt(sx)),V(sx*base.HIP_X,0,base.HIP_Z),torso,angle=80)
        kit.drape(half,free=base.skirt_freedom(sx))
    print('RANGER_SOURCE_STAGE authored facial anatomy',flush=True)
    head_obj=face_rig.head(rk.part,R,head(),base.NECK,torso,angle=80)
    base.part('hat',refine_tailoring(base.hat_part()),base.HAT_PIVOT,head_obj,angle=80)
    arms={};data={}
    for side,sx,s,c,pole,chir in [('R',1,base.S_R,base.GRIP,base.S_R+V(.6,-.35,-.45),-1),('L',-1,base.S_L,base.rifle_point(0,base.LEFT_S,base.LEFT_Z),base.S_L+V(-.6,-.1,-.4),1)]:
        print('RANGER_SOURCE_STAGE connected sleeve and hand',side,flush=True)
        e,w,xax=base.arm_pose(s,c,pole);kax=base.D_REST.cross(xax) if chir>0 else xax.cross(base.D_REST)
        sleeve,cuff=make_sleeve(side,s,e,w,sx)
        hands=hand('ranger-hand'+side,c,xax,kax,chir)
        fore=base.part('fore'+side+'-surface',cuff+hands,e,torso,angle=80)
        arms[side]=(s,e,w);data[side]=(sleeve,fore)
    rig=make_armature(torso,arms)
    for side,(s,e,w) in arms.items():
        sleeve,fore=data[side];bind_sleeve(sleeve,rig,side,s,e,w)
        bone_attach(fore,rig,R+'fore'+side)
    gun,lever=rifle();rk.transform(gun,base.rifle_frame());rk.transform(lever,base.rifle_frame())
    weapon=base.part('weapon',gun,base.GRIP,data['R'][1],angle=65)
    base.part('extra2',lever,base.rifle_point(*base.LEVER_PIN),weapon,angle=65)
    material_finish()
    meshes=[o for o in kit.descendants(root) if o.type=='MESH']
    kit.fill_ao(meshes)
    author_pigment(root);finish_ao(root)
    root['masterBrief']='docs/concepts/2026-10-04-arena-three-characters/ranger/brief.md'
    root['unoptimized']=True
    root['skinContract']='continuous sleeve and trouser cloth; native common-axis shoulder/elbow and hip/knee bones; rigid cuff/hand/rifle and boot attachments'
    root['sourceScale']=1.0
    kit.refresh()
    return root
