"""Detailed, editable Wizard-only source with continuous garment deformation.

Native game pivots are preserved. Common-axis bones drive the actual sleeve,
hat and cape topology; independent face controls preserve blink/look/expression.
This is the unrestricted master, never the runtime reduction.
"""
import json
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_mage as g
import figure_mage_kit as mk
import figure_mage_surface as surface
from figure_mage_kit import V, gauss, lerp, smooth, spow

BASE_FACE_POINT = g.face_point
SKIN = 'skin:' + kit.tint('mage-aged-skin', '#d8a785')
HAIR = 'hair:' + kit.tint('mage-silver-hair', '#c7c5bd')
EYEW = 'skin:' + kit.tint('mage-eye-ivory', '#efe6cf')
INK = 'skin:' + kit.tint('mage-eye-ink', '#28313b')
IRIS = 'skin:' + kit.tint('mage-eye-grey', '#76898e')
LIP = 'skin:' + kit.tint('mage-mouth-shadow', '#795347')
NAIL = 'skin:' + kit.tint('mage-nail', '#d5b79d')
g.SKIN, g.BEARD = SKIN, HAIR
g.GOLD = 'gilt:' + kit.tint('mage-old-gold', '#ad904b')
g.SILVER = 'gilt:' + kit.tint('mage-old-silver', '#a2a8af')
g.MANTLE = 'weave:' + kit.tint('mage-charcoal', '#42464e')
g.CAPE = 'drape:' + kit.tint('mage-charcoal', '#42464e')
g.LEATHER = 'leather:' + kit.tint('mage-worn-leather', '#513b2e')
g.WOOD = 'wood:' + kit.tint('mage-knotted-wood', '#594735')
g.FIRE = 'glow:' + kit.tint('mage-amber', '#e9a144')
surface.matched_team_names(g)


def ss(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def activate(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def subdivide(o, levels=1):
    activate(o)
    m = o.modifiers.new('Editable authored subdivision', 'SUBSURF')
    m.levels = m.render_levels = levels
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def face_point(ad, z):
    p = BASE_FACE_POINT(ad, z)
    a = abs(ad)
    front = max(0, math.cos(math.radians(ad)))
    # A cheek shelf follows the zygomatic arch; a softer hollow lies below.
    delta = .0028*gauss(a,47,14)*gauss(z,1.026,.009)
    delta -= .0018*gauss(a,40,10)*gauss(z,.996,.013)
    delta += .0019*gauss(a,16,6)*gauss(z,1.005,.005)
    # Two quiet, nonuniform forehead furrows, and radial outer-eye folds.
    furrow = 1.085 + .0016*math.cos(math.radians(ad*4))
    delta -= .0009*gauss(z,furrow,.0012)*smooth(60,20,a)
    delta -= .00065*gauss(z,1.101+.001*math.sin(math.radians(ad*5)),.0015)*smooth(50,18,a)
    for dz, slope in ((.005,.012),(-.003,-.01),(-.010,-.017)):
        delta -= .00075*gauss(a,47,11)*gauss(z,1.041+dz+slope*(a-38)/20,.0012)
    # A nasolabial fold descends from each nostril rather than random pores.
    delta -= .0015*gauss(a,20+(1.006-z)*270,3.7)*gauss(z,.996,.012)
    n = V(p.x*1.5,p.y-g.CY,0).normalized()
    return p+n*delta*front


def face_normal(ad,z):
    du = face_point(ad+.2,z)-face_point(ad-.2,z)
    dz = face_point(ad,z+.0002)-face_point(ad,z-.0002)
    n = du.cross(dz).normalized()
    if (face_point(ad,z)-g.HC).dot(n)<0:
        n = -n
    return n


def head_skin():
    c = mk.Mesh('mage.weathered-face',SKIN)
    angles = [i*2 for i in range(-90,91)]
    heights = [.892+i*(1.15-.892)/130 for i in range(131)]
    rows = [[c.v(face_point(a,z)) for a in angles] for z in heights]
    c.grid(rows,SKIN)
    c.fan(rows[0],V(0,.004,.887),SKIN,flip=True)
    c.fan(rows[-1],V(0,0,1.16),SKIN)
    return c.obj(recalc=True,outward=g.HC)


def eye_patch(label,side,width,height,lift,mat,dz=0,da=0):
    c = mk.Mesh(f'mage-{label}{side}',mat)
    ac,zc = side*27+da,1.044+dz
    rows = []
    for j in range(1,7):
        q = j/6
        row = []
        for i in range(32):
            ang = i/32*math.tau
            ad = ac+width*math.cos(ang)*q
            z = zc+height*math.sin(ang)*q+side*.0018*math.cos(ang)*q
            row.append(c.v(face_point(ad,z)+face_normal(ad,z)*lift))
        rows.append(row)
    c.grid(rows,mat,closed=True)
    c.fan(rows[0],face_point(ac,zc)+face_normal(ac,zc)*lift,mat)
    return c.obj(recalc=True,outward=g.HC)


def eyes():
    out = []
    for s in (-1,1):
        out += [eye_patch('eye-outline',s,14,.0105,.0030,INK),
                eye_patch('eye-white',s,12.4,.0087,.0039,EYEW),
                eye_patch('iris',s,5.8,.0076,.0048,IRIS),
                eye_patch('pupil',s,3.4,.0061,.0056,INK),
                eye_patch('catchlight',s,1.5,.0018,.0062,EYEW,dz=.003,da=-1.5)]
        # Separate lips surrounding the expressive eye plates remain fixed.
        for upper in (False,True):
            path = []
            for k in range(21):
                t = k/20
                ad = s*27+(-13.2+26.4*t)
                z = 1.044+side_slope(s,t)+(1 if upper else -1)*.0098*math.sin(math.pi*t)
                path.append(face_point(ad,z)+face_normal(ad,z)*.0040)
            o = mk.tube(f'mage.eyelid-{s}-{upper}',path,[.0016]*len(path),SKIN,n=8,up=(0,1,0))
            out.append(o)
    return out


def side_slope(s,t):
    return s*.0018*(2*t-1)


def hair_lock(name,path,widths,depths,mat=HAIR,ridges=5):
    pts = [V(p) for p in kit.smooth_path(path,4)]
    radii = []
    for k in range(len(pts)):
        t = k/(len(pts)-1)*(len(widths)-1)
        i = min(len(widths)-2,int(t))
        # The tube's up axis is the front-facing depth; its second cross
        # axis spans the lock. Flat broad locks replace the accidental thin
        # deep cords in the preserved first source.
        radii.append((lerp(depths[i],depths[i+1],t-i),lerp(widths[i],widths[i+1],t-i)))
    rings = mk.rings_along(pts,radii,n=20,up=(0,1,0))
    for j,ring in enumerate(rings):
        for k,p in enumerate(ring):
            a = k/20*math.tau
            # Furrows run along deliberate locks, strongest at the visible front.
            n = (p-pts[j]).normalized()
            relief = .00065*math.cos(ridges*a+j*.12)*math.sin(math.pi*j/(len(rings)-1))
            ring[k] += n*relief
    return mk.loft(name,rings,mat,start='pole',end='pole')


def brows():
    out = []
    for s in (-1,1):
        path = []
        for ad,z in ((5,1.060),(13,1.062),(24,1.065),(35,1.068),(47,1.073),(55,1.078)):
            path.append(face_point(s*ad,z)+face_normal(s*ad,z)*.0060)
        out.append(hair_lock(f'mage-brow{s}',path,[.0024,.0042,.005,.0049,.004,.0013],
                             [.0018,.0028,.0033,.0033,.0027,.0010],ridges=4))
    return out


def ears():
    out = []
    for s in (-1,1):
        at = V(s*.072,.011,1.027)
        c = mk.Mesh(f'mage.ear-{s}',SKIN)
        rows = []
        for j in range(13):
            t = j/12
            row = []
            for k in range(40):
                a = k/40*math.tau
                yy = .012*math.cos(a)*t
                zz = .023*math.sin(a)*t
                # Recessed concha, swollen helix at the perimeter, soft lobe.
                xx = .003+.006*math.exp(-((t-.88)/.13)**2)-.002*math.exp(-((t-.35)/.25)**2)
                xx += .002*max(0,-math.sin(a))*t*t
                row.append(c.v(at+V(s*xx,yy,zz)))
            rows.append(row)
        c.grid(rows,SKIN,closed=True)
        ear = c.obj(recalc=True,outward=V(0,.01,1.027))
        out.append(ear)
    return out


def face_details():
    out = []
    # The mouth remains independently readable under the moustache.
    outline = [(-18,.984),(0,.981),(18,.984),(14,.980),(0,.978),(-14,.980)]
    out.append(mk.decal('mage-mouth',face_point,outline,.0023,LIP,depth=.0004,eps=.05,ref=g.HC))
    for s in (-1,1):
        pts = [face_point(s*a,z)+face_normal(s*a,z)*.0018 for a,z in ((8,1.000),(12,.9988),(16,.9997))]
        out.append(mk.tube(f'mage.nostril-{s}',pts,[.0014,.0018,.0008],LIP,n=8,up=(0,1,0)))
    return out


def back_hair():
    out = []
    for i in range(17):
        a = math.radians(87+i*186/16)
        back = max(0,-math.cos(a))
        zbot = .978-.105*back-.014*(i%3==1)
        path = []
        for j in range(7):
            t=j/6
            th=a+.035*math.sin(t*math.pi*1.5+i*.7)
            radx=.077+.013*t+.004*math.sin(t*math.pi+i*.6)
            rady=.086+.025*t
            path.append(V(radx*math.sin(th),.006+rady*math.cos(th),lerp(1.115,zbot,t)))
        widths=[.008,.011,.013,.013,.012,.008,.0014]
        depths=[.005,.008,.009,.01,.009,.006,.001]
        out.append(hair_lock(f'mage.silver-hair-{i}',path,widths,depths))
    return out


def beard():
    out=[]
    # Recessed foundation preserves the silhouette beneath separated locks.
    foundation = g.beard_mass()
    foundation.name='mage.beard-foundation'
    subdivide(foundation,2)
    out.append(foundation)
    specs=[(-.062,.694,-.007,.016),(-.042,.667,.009,.020),(-.021,.647,-.008,.023),
           (0,.632,.008,.023),(.025,.654,-.007,.024),(.046,.676,.009,.020),(.065,.704,-.007,.015)]
    for i,(x,zb,drift,width) in enumerate(specs):
        outer=abs(x)/.0675
        path=[V(x*.74,.100+.010*(1-outer),.963-.016*outer),
              V(x,.143+.011*(1-outer),.902),
              V(x*.95+drift,.168+.014*(1-outer),.831),
              V(x*.70+.008-drift*.5,.180+.010*(1-outer),.767),
              V(x*.52+.016+drift,.185,.709),
              V(x*.31+.021+drift*.2,.176,zb)]
        out.append(hair_lock(f'mage.separated-beard-lock-{i}',path,
                             [width*.65,width*.93,width,width*.86,width*.56,.0012],
                             [.003,.005,.006,.0063,.0042,.001],ridges=4))
    for s in (-1,1):
        path=[face_point(s*ad,z)+face_normal(s*ad,z)*lift for ad,z,lift in
              ((2,.989,.0045),(11,.987,.007),(20,.982,.009),(28,.974,.011))]
        path += [V(s*.050,.122,.939),V(s*.057,.143,.908)]
        out.append(hair_lock(f'mage.moustache-{s}',path,[.0045,.0078,.011,.011,.008,.0013],
                             [.0027,.0038,.0045,.0048,.004,.001],ridges=3))
    return out


def cheek_locks():
    out=[]
    for s in (-1,1):
        for i in range(3):
            a=80-i*13
            path=[face_point(s*a,1.040-i*.008)+face_normal(s*a,1.040-i*.008)*.0025,
                  face_point(s*(a-8),1.014-i*.010)+face_normal(s*(a-8),1.014-i*.010)*.005,
                  face_point(s*(a-16),.987-i*.008)+face_normal(s*(a-16),.987-i*.008)*.008,
                  V(s*(.064-i*.009),.098+i*.012,.958-i*.011)]
            out.append(hair_lock(f'mage.cheek-chin-lock-{s}-{i}',path,[.004,.007,.009,.003],
                                 [.002,.0035,.004,.0015],ridges=3))
    return out


def hat():
    n=64
    rings=[]
    hs=[i*g.HAT_L/100 for i in range(101)]
    for h in hs:
        c,th=g.hat_spine(h)
        tang=g.hat_dir(th)
        up=tang.cross(V(1,0,0)).normalized()
        side=up.cross(tang).normalized()
        rk=g.hat_prof_at(h)
        ring=[]
        for i in range(n):
            a=i/n*math.tau
            ca,sa=math.cos(a),math.sin(a)
            r=rk*(1+.042*math.sin(3*a+h*11+.6)*smooth(.04,.14,h))
            r*=1+.026*math.sin(5*a-h*17)*smooth(.1,.25,h)
            pinch=gauss(h,g.HAT_BEND,.022)
            r*=1-.23*pinch*max(0,-sa)**1.5+.09*pinch*max(0,sa)**2
            # One squeezed felt crease at the true bend, not split cones.
            r -= .018*gauss(h,.273+.007*sa,.009)*max(0,-sa)
            ring.append(g.hat_matrix()@(c+side*ca*g.HAT_RX*r+up*sa*g.HAT_RY*r))
        rings.append(ring)
    cone=mk.loft('mage.continuous-felt-cone',rings,g.TEAM,start='flat',
                  end=g.hat_matrix()@(g.hat_spine(g.HAT_L)[0]+g.hat_dir(g.hat_spine(g.HAT_L)[1])*.008),
                  bands=lambda i,j: g.GOLD if isinstance(j,int) and .002<hs[j]<.025 else g.TEAM)
    cone['weightHat']=True
    brim=g.hat_brim()[0]
    brim.name='mage.turned-felt-brim'
    subdivide(brim,2)
    return [cone,brim]


def robe_sec(z):
    # A tailored chest under the mantle: slope into the shoulders, with
    # flatter front/back planes. The flared skirt retains its native width.
    torso=[(.584,.139,.110,.096),(.610,.133,.103,.092),(.647,.137,.104,.092),
           (.699,.149,.113,.096),(.742,.157,.119,.100),(.795,.160,.113,.100),
           (.842,.148,.097,.089),(.875,.122,.080,.083),(.905,.065,.050,.055)]
    rows=[r for r in reversed(g.ROBE) if r[0]<.584]+torso
    return tuple(g.crom([r[i] for r in rows],
                       np.interp(z,[r[0] for r in rows],range(len(rows)))) for i in (1,2,3))


def robe_point(ad,z,off=0,band=None):
    a=math.radians(ad)
    rx,ryf,ryb=robe_sec(z)
    f=g.robe_fold(a,z)
    f-=.006*gauss(z,.632,.020)
    # Belt tension draws cloth diagonally; long skirt folds remain primary.
    f += .0028*math.sin(8*a+(z-.62)*60)*gauss(z,.615,.033)
    f += .0020*math.cos(4*a+(z-.74)*26)*gauss(z,.741,.071)
    front=max(0,math.cos(a))**2
    pull=gauss(abs(ad),52,25)*front
    # Folds travel diagonally from belt and armhole attachment points.
    f-=.0045*gauss(z,.682+.078*abs(math.sin(a)),.011)*pull
    f-=.0030*gauss(z,.773-.085*abs(math.sin(a)),.009)*pull
    f+=.0038*math.sin(6*a+z*31+.4)*gauss(z,.66,.067)*front
    if band is not None:
        f=g.robe_fold(0,z)+band
    e=2/g.ROBE_P
    return V((rx+f+off)*spow(math.sin(a),e),
             ((ryf if math.cos(a)>=0 else ryb)+f+off)*spow(math.cos(a),e),z)


def tailored_robe(skirt=False, runtime=False):
    heights=([.027+i*(.618-.027)/110 for i in range(111)] if skirt else
             [.584+i*(.905-.584)/65 for i in range(66)])
    heights.sort(reverse=True)
    if runtime:
        assert skirt, 'The reviewed bodice uses sampled source reduction'
        # Keep source rows at every trim transition. The other regular rows
        # preserve the ordered drape; collapsing only free faces between
        # hard-locked trim edges made concave petal shapes in rejected V10.
        keep=set(range(0,len(heights),8))|{len(heights)-1}
        def stripe(z):
            return 2 if z<.047 else 1 if .047<z<.065 or .096<z<.105 else 0
        for j in range(len(heights)-1):
            if stripe(heights[j])!=stripe(heights[j+1]):
                keep.update((j,j+1))
        heights=[z for j,z in enumerate(heights) if j in keep]
    segments=23 if runtime else 60
    reg=[11+i*(169/segments) for i in range(segments+1)]
    cols=[-a for a in reversed(reg)]+['-3','-2','-1','0','1','2','3']+reg
    c=mk.Mesh('mage.tailored-skirt' if skirt else 'mage.tailored-bodice',g.TEAM)
    rows=[]
    for z in heights:
        row=[]
        for col in cols:
            special=isinstance(col,str)
            ad=g.band_angle(int(col),z) if special else col
            p=robe_point(ad,z,band=g.FRONT[abs(int(col))][1] if special else None)
            if skirt:
                a=math.radians(ad)
                # The front hem exposes the boot shafts as well as their toes.
                lift=.105*max(0,math.cos(a))**3-.007*g.fold_wave(a)
                p.z+=lift*smooth(.19,.05,z)
            row.append(c.v(p))
        rows.append(row)
    def bands(i,j):
        z=heights[j]
        if skirt and z<.047:
            return g.TEAM2
        if skirt and .047<z<.065:
            return g.GOLD
        if skirt and .096<z<.105:
            return g.GOLD
        if i<len(cols)-1 and isinstance(cols[i],str) and isinstance(cols[i+1],str):
            return g.TEAM2 if max(abs(int(cols[i])),abs(int(cols[i+1])))<=1 else g.GOLD
        return g.TEAM
    c.grid(rows,bands,closed=True)
    if not skirt:
        c.fan(rows[0],V(0,0,.912),g.TEAM,flip=True)
    # A turned-in rolled hem, with open garment interior above the boots.
    if skirt:
        last=rows[-1]
        inner=[c.v(V(v.co.x*.96,v.co.y*.96,v.co.z+.010)) for v in last]
        c.grid([last,inner],g.TEAM2,closed=True)
    return c.obj(recalc=True,outward=V(0,0,.62 if not skirt else .30))


def sleeve(s,e,w,suffix):
    # Smoothly round the rest elbow, then skin that same continuous surface.
    anchor=[s-(e-s).normalized()*.014,s,lerp(s,e,.48),e,lerp(e,w,.30),lerp(e,w,.64),w+(w-e).normalized()*.009]
    n,steps=64,96
    rows=[]
    centres=[]
    ts=[]
    for j in range(steps+1):
        t=j/steps
        c=g.crom(anchor,t*(len(anchor)-1))
        tangent=(g.crom(anchor,min(len(anchor)-1,t*(len(anchor)-1)+.012))-g.crom(anchor,max(0,t*(len(anchor)-1)-.012))).normalized()
        down=V(0,0,-1)-tangent*tangent.dot(V(0,0,-1))
        if down.length<.01:
            down=V(0,-1,0)-tangent*tangent.dot(V(0,-1,0))
        down.normalize()
        side=tangent.cross(down).normalized()
        r=.043+.031*smooth(.54,.99,t)**1.7
        r+=.003*gauss(t,.23,.12)
        sg=.029*smooth(.49,1,t)**1.5
        ring=[]
        for i in range(n):
            a=i/n*math.tau
            ca,sa=math.cos(a),math.sin(a)
            # Narrow compression channels cross the inside elbow; tensile
            # sleeve ridges run towards the long bell, with unequal spacing.
            fold=.0058*math.sin(5*a+.5)*smooth(.30,.85,t)
            fold+=.0032*math.sin(8*a+t*9)*smooth(.55,.95,t)
            inside=((s-e).normalized()+(w-e).normalized()).normalized()
            inward=(down*ca+side*sa).dot(inside)
            inner=max(0,inward)**3
            fold-=inner*(.0045*gauss(t,.43,.021)+.005*gauss(t,.49,.023)+.0035*gauss(t,.55,.022))
            outer=max(0,-inward)**3
            fold+=outer*.005*gauss(t,.49,.12)
            rad=r+fold
            reach=tangent*(.013*ca*smooth(.86,1,t))
            ring.append(c+down*(ca*rad*(1+.22*max(0,ca)*t*t)+sg)+side*sa*rad+reach)
        rows.append(ring)
        centres.append(c)
        ts.extend([t]*n)
    c=mk.Mesh(f'mage.connected-sleeve-{suffix}',g.TEAM)
    grid=[[c.v(p) for p in row] for row in rows]
    c.grid(grid,lambda i,j: g.GOLD if j>=steps-3 else g.TEAM,closed=True)
    c.fan(grid[0],centres[0],g.TEAM,flip=True)
    inner=[c.v(centres[-1]+(p-centres[-1])*.88-(w-e).normalized()*.028) for p in rows[-1]]
    c.grid([grid[-1],inner],g.TEAM2,closed=True)
    o=c.obj(recalc=True)
    # Rest path ownership survives decimation as real bone weights.
    assign_weights(o,{'torso':lambda p: np.zeros(len(p)),
                      'arm'+suffix:lambda p: np.ones(len(p))})
    points=np.array([v.co[:] for v in o.data.vertices])
    nearest=np.argmin(np.sum((points[:,None,:]-np.array([x[:] for x in centres])[None,:,:])**2,axis=2),axis=1)/steps
    shoulder=1-ss(.04,.18,nearest)
    fore=ss(.41,.61,nearest)
    set_weights(o,{'torso':shoulder,'arm'+suffix:(1-shoulder)*(1-fore),'fore'+suffix:(1-shoulder)*fore})
    o['continuousGarment']='shoulder and elbow sleeve, no rigid cuts'
    return o


def fuse(objects,name,voxel=.0009):
    for o in objects:
        kit.apply(o)
        kit.apply_transform(o)
    o=kit.join(objects,name)
    activate(o)
    mod=o.modifiers.new('Continuous palm and separate fingers','REMESH')
    mod.mode='VOXEL'
    mod.voxel_size=voxel
    mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Fine skin transition','SMOOTH')
    mod.factor=.35
    mod.iterations=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.clear()
    o.data.materials.append(kit.material(SKIN))
    for p in o.data.polygons:
        p.use_smooth=True
    return o


def grip(e,w):
    xax=g.FIST_R-w
    xax=(xax-g.STAFF_D*xax.dot(g.STAFF_D)).normalized()
    kax=xax.cross(g.STAFF_D).normalized()
    zax=g.STAFF_D
    m=mk.basis(xax,kax,zax,g.FIST_R)
    rings=[]
    for x,hy,hz,cy in ((-.059,.017,.022,0),(-.048,.020,.029,.002),(-.034,.022,.034,.005),(-.024,.017,.032,.007),(-.019,.012,.027,.009)):
        rings.append([V(x,cy+y,z) for y,z,_ in mk.sup(28,hy,hz,2.45)])
    pieces=[mk.loft('mage.grip-palm',rings,SKIN,start='flat',end='pole')]
    for i,(z,r) in enumerate(((.025,.0073),(.009,.0077),(-.008,.0075),(-.024,.0066))):
        path=[V(-.032,.021,z),V(-.013,.030,z+.001),V(.008,.027,z),V(.022,.012,z-.001),V(.022,-.007,z-.001),V(.009,-.023,z)]
        widths=[r*.98,r*1.12,r*1.06,r*.99,r*.92,r*.78]
        p=mk.tube(f'mage.grip-finger-{i}',[V(q) for q in kit.smooth_path(path,3)],
                  [float(np.interp(k,range(len(widths)),widths)) for k in np.linspace(0,len(widths)-1,len(kit.smooth_path(path,3)))],
                  SKIN,n=16,up=(0,0,1))
        pieces.append(p)
    thumb=[V(-.043,-.016,.012),V(-.032,-.023,.032),V(-.014,-.027,.040),V(.005,-.020,.041),V(.013,-.010,.035)]
    pieces.append(mk.tube('mage.grip-thumb',[V(q) for q in kit.smooth_path(thumb,3)],
                          list(np.interp(np.linspace(0,4,len(kit.smooth_path(thumb,3))),range(5),[.011,.010,.009,.008,.0065])),SKIN,n=18,up=(0,0,1)))
    o=fuse(pieces,'mage.articulated-grip-hand')
    mk.transform([o],m)
    return [o]


CASTING_FINGERS = ((-.019,.050,.0067,-.14),(-.0064,.057,.0071,-.03),
                   (.0073,.053,.0067,.06),(.0205,.043,.0059,.20))


def casting_finger_path(xx,length,splay):
    return [V(xx,.014,.004),V(xx+splay*.009,.037,.006),
            V(xx+splay*.025,.037+length*.35,.013),
            V(xx+splay*.04,.037+length*.58,.027)]


def casting_nails():
    """Thin tapered plates sit on the dorsal side of curled distal fingers."""
    e,w,f,u,s=g.hand_frame()
    m=mk.basis(s,f,u,w+f*.039+u*.004)
    out=[]
    outline=((0,-.006),(.002,-.0057),(.0033,-.0035),(.0031,0),
             (.0027,.0032),(.0014,.0042),(0,.0044),(-.0014,.0042),
             (-.0027,.0032),(-.0031,0),(-.0033,-.0035),(-.002,-.0057))
    for i,(xx,length,r,splay) in enumerate(CASTING_FINGERS):
        path=casting_finger_path(xx,length,splay)
        along=(path[-1]-path[-2]).normalized()
        across=V(1,0,0)
        across=(across-along*across.dot(along)).normalized()
        dorsal=along.cross(across).normalized()
        centre=path[-1]-along*.0045+dorsal*r*.71
        c=mk.Mesh(f'mage.casting-nail-{i}',NAIL)
        rows=[]
        for scale,depth in ((1,-.0002),(1,.00003),(.55,.00032)):
            rows.append([c.v(centre+across*x*(r/.0067)*scale+
                             along*y*scale+dorsal*depth) for x,y in outline])
        c.grid(rows,NAIL,closed=True)
        c.fan(rows[0],centre-dorsal*.0002,NAIL,flip=True)
        c.fan(rows[-1],centre+dorsal*.00045,NAIL)
        out.append(c.obj(recalc=True))
    mk.transform(out,m)
    return out


def refine_casting_nails(root):
    """Apply only the requested nail correction to an exact saved master."""
    skeleton=next(o for o in kit.descendants(root) if o.type=='ARMATURE')
    for o in list(kit.descendants(root)):
        if o.type=='MESH' and o.name.startswith('mage.casting-nail-'):
            bpy.data.objects.remove(o,do_unlink=True)
    for o in casting_nails():
        attach(o,skeleton,'offhand')
        pigment(o)
    surface.configure(root)
    kit.refresh()


def casting_hand():
    e,w,f,u,s=g.hand_frame()
    p=w+f*.039+u*.004
    m=mk.basis(s,f,u,p)
    rows=[]
    for yy,ww,th in ((-.039,.015,.010),(-.027,.023,.012),(-.012,.029,.012),(.007,.027,.010),(.025,.024,.008)):
        ring=[]
        for k in range(28):
            a=k/28*math.tau
            xx=ww*spow(math.cos(a),.88)
            zz=th*math.sin(a)
            if zz>0:
                zz-=.004*gauss(xx,0,.014)*gauss(yy,0,.024)
                zz+=.002*gauss(xx,-.016,.009)
            ring.append(V(xx,yy,zz))
        rows.append(ring)
    pieces=[mk.loft('mage.cupped-palm',rows,SKIN,start='flat',end='pole')]
    for i,(xx,length,r,splay) in enumerate(CASTING_FINGERS):
        path=casting_finger_path(xx,length,splay)
        sm=[V(q) for q in kit.smooth_path(path,4)]
        radii=np.interp(np.linspace(0,3,len(sm)),range(4),[r*1.08,r,r*.89,r*.71]).tolist()
        pieces.append(mk.tube(f'mage.casting-finger-{i}',sm,radii,SKIN,n=18,up=(0,0,1)))
    thumb=[V(-.020,-.012,.001),V(-.038,-.002,.005),V(-.048,.017,.013),V(-.049,.033,.027)]
    sm=[V(q) for q in kit.smooth_path(thumb,4)]
    pieces.append(mk.tube('mage.casting-thumb',sm,np.interp(np.linspace(0,3,len(sm)),range(4),[.011,.010,.0085,.0067]).tolist(),SKIN,n=18))
    hand=fuse(pieces,'mage.anatomical-casting-hand')
    mk.transform([hand],m)
    return [hand]+casting_nails(),p,u,f,s


def cape():
    us=[i/100 for i in range(101)]
    vs=[g.CAPE_TOP_V+i*(8-g.CAPE_TOP_V)/100 for i in range(101)]
    o=mk.sheet('mage.continuous-travelling-cape',lambda u,v:g.cape_point(u,v)[0],us,vs,g.CAPE,
                rim=.006,inside=V(0,0,.6),back=True)
    p=np.array([v.co[:] for v in o.data.vertices])
    z=p[:,2]
    z2=g.cape2_pivot().z
    lower=1-ss(z2-.050,z2+.050,z)
    set_weights(o,{'cape':1-lower,'cape2':lower})
    o['continuousGarment']='upper/lower mantle with blended hinge'
    return o


def staff():
    pieces=g.staff()
    for o in pieces:
        if o.name=='mage-shaft':
            subdivide(o,2)
            # At the grip the shaft stays exactly within the closed fingers.
            length=(g.STAFF_T-g.STAFF_B).length
            centre_t=(g.FIST_R-g.STAFF_B).dot(g.STAFF_D)/length
            wob=V(0,0,0)
            # Preserve the original wood centreline away from the grip.
            for v in o.data.vertices:
                t=(v.co-g.STAFF_B).dot(g.STAFF_D)/length
                scale=gauss(t,centre_t,.055)
                d=v.co-g.staff_at(v.co.z)
                v.co-=d*.10*scale
            o.name='mage.natural-wood-staff'
        elif 'claw' in o.name:
            subdivide(o,1)
        elif 'crystal' not in o.name:
            subdivide(o,1)
    return pieces


def legs(s):
    hip=V(s*g.HIP_X,0,g.HIP_Z)
    # Exact pivots measured from the current exported Wizard, including the
    # inherited articulation's boot-section ankle median.
    knee=V(s*.085,0,.36)
    ankle=V(s*.098,.09008774,.10)
    path=[hip+V(0,0,.035),hip,lerp(hip,knee,.6),knee,lerp(knee,ankle,.55),ankle]
    points=[V(p) for p in kit.smooth_path(path,3)]
    radii=np.interp(np.linspace(0,5,len(points)),range(6),[.034,.036,.034,.033,.029,.027]).tolist()
    o=mk.tube(f'mage.hidden-leg-{s}',points,radii,g.TEAM2,n=28,up=(0,1,0),caps=('flat','flat'))
    p=np.array([v.co[:] for v in o.data.vertices])
    k=1-ss(.312,.395,p[:,2])
    suffix='R' if s==1 else 'L'
    set_weights(o,{'leg'+suffix:1-k,'knee'+suffix:k})
    boots=g.boot(s)
    for b in boots:
        if 'foot' in b.name:
            subdivide(b,2)
        elif 'shaft' in b.name:
            subdivide(b,2)
        else:
            subdivide(b,1)
        b.name=f'mage.boot-{suffix}-{b.name.removeprefix("mage-")}'
    return o,boots,knee,ankle


def set_weights(o,weights):
    o.vertex_groups.clear()
    total=np.maximum(1e-9,np.sum(list(weights.values()),axis=0))
    for name,raw in weights.items():
        group=o.vertex_groups.new(name='mage'+name)
        q=np.rint(np.clip(raw/total,0,1)*10000).astype(int)
        ids=np.flatnonzero(q)
        ids=ids[np.argsort(q[ids])]
        cuts=np.flatnonzero(np.diff(q[ids]))+1
        for batch in np.split(ids,cuts):
            if len(batch):
                group.add(batch.tolist(),float(q[batch[0]])/10000,'REPLACE')


def assign_weights(o,functions):
    p=np.array([v.co[:] for v in o.data.vertices])
    set_weights(o,{name:fn(p) for name,fn in functions.items()})


def rig(root,positions,parents):
    data=bpy.data.armatures.new('Wizard native common-axis frames')
    o=bpy.data.objects.new('mage.skeleton',data)
    bpy.context.scene.collection.objects.link(o)
    o.parent=root
    activate(o)
    bpy.ops.object.mode_set(mode='EDIT')
    for name,p in positions.items():
        bone=data.edit_bones.new('mage'+name)
        bone.head=p
        bone.tail=p+V(0,0,.045)
        bone.use_connect=False
    for name,parent in parents.items():
        data.edit_bones['mage'+name].parent=data.edit_bones['mage'+parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    o.show_in_front=True
    data.display_type='WIRE'
    o['arenaCommonAxes']=True
    o['anatomicalPivots']=json.dumps({k:list(p) for k,p in positions.items()})
    return o


def attach(o,skeleton,bone):
    kit.apply(o)
    kit.apply_transform(o)
    mk.uv_box(o)
    for p in o.data.polygons:
        p.use_smooth=True
    kit.refresh()
    before=o.matrix_world.copy()
    o.parent,o.parent_type,o.parent_bone=skeleton,'BONE','mage'+bone
    o.matrix_world=before
    return o


def skin(o,skeleton):
    mk.uv_box(o)
    for p in o.data.polygons:
        p.use_smooth=True
    mod=o.modifiers.new('Connected Wizard linear garment','ARMATURE')
    mod.object=skeleton
    mod.use_deform_preserve_volume=False
    o.parent=skeleton
    return o


def attach_faces(pieces,skeleton):
    groups,fixed={},[]
    for o in pieces:
        key=None
        for s,suffix in ((-1,'L'),(1,'R')):
            if o.name in (f'mage-eye-outline{s}',f'mage-eye-white{s}'):
                key='eye'+suffix
            if o.name in (f'mage-iris{s}',f'mage-pupil{s}',f'mage-catchlight{s}'):
                key='pupil'+suffix
            if o.name==f'mage-brow{s}':
                key='brow'+suffix
        if o.name=='mage-mouth':
            key='mouth'
        (groups.setdefault(key,[]) if key else fixed).append(o)
    for o in fixed:
        attach(o,skeleton,'head')
    nodes={}
    for key in ('eyeL','eyeR','browL','browR','mouth','pupilL','pupilR'):
        objs=groups.get(key)
        if not objs:
            continue
        for o in objs:
            kit.apply(o)
        o=kit.join(objs,'mage'+key)
        mk.uv_box(o)
        bounds=[v.co.copy() for v in o.data.vertices]
        lo=V(tuple(min(p[i] for p in bounds) for i in range(3)))
        hi=V(tuple(max(p[i] for p in bounds) for i in range(3)))
        centre=(lo+hi)/2
        kit.set_pivot(o,centre)
        if key.startswith('pupil'):
            axes=nodes['eye'+key[-1]].matrix_world.to_3x3()
        else:
            normal=V(centre.x*3,1,0).normalized()
            up=V(0,0,1)
            right=normal.cross(up).normalized()
            axes=Matrix((right,normal,up)).transposed()
        kit.refresh()
        before=o.matrix_world.copy()
        after=Matrix.Translation(centre)@axes.to_4x4()
        o.data.transform(after.inverted()@before)
        o.matrix_world=after
        if key.startswith('pupil'):
            kit.parent(o,nodes['eye'+key[-1]])
        else:
            before=o.matrix_world.copy()
            o.parent,o.parent_type,o.parent_bone=skeleton,'BONE','magehead'
            o.matrix_world=before
        o['faceWidth']=(hi-lo).x
        o['faceHeight']=(hi-lo).z
        nodes[key]=o


def pigment(o):
    n=len(o.data.vertices)
    p=np.array([v.co[:] for v in o.data.vertices])
    x,y,z=p.T
    name=o.name
    shade=np.ones(n)
    warm=np.zeros(n)
    if any(m.name.startswith('hair:') for m in o.data.materials):
        shade=.88+.08*np.sin(z*13+x*17)+.04*np.cos(y*38)
    elif any(m.name.startswith('weave:') or m.name.startswith('drape:') for m in o.data.materials):
        shade=.94+.04*np.sin(x*11+z*7)+.02*np.cos(y*15-z*11)
    elif o.name=='mage.weathered-face':
        warm=.035*np.exp(-((np.abs(x)-.05)/.025)**2-((z-1.016)/.028)**2)
        shade=.99-.06*np.exp(-((z-1.043)/.022)**2)*np.minimum(1,np.abs(x)/.045)
    elif 'hand' in name:
        shade=.97+.025*np.cos(x*16+z*18)
    rgb=np.column_stack((shade+warm,shade-warm*.4,shade-warm*.5))
    cache=o.data.attributes.new(name='MagePigmentCache',type='FLOAT_VECTOR',domain='POINT')
    cache.data.foreach_set('vector',rgb.astype(np.float32).reshape(-1))
    # The shared AO bake/heal contract is CORNER. The pigment cache is POINT
    # and does not export; map it to corners only for the active colour.
    loopids=np.array([loop.vertex_index for loop in o.data.loops],dtype=np.int32)
    rgb_loop=rgb[loopids]
    rgba=np.column_stack((rgb_loop,np.ones(len(loopids)))).astype(np.float32)
    col=o.data.color_attributes.get('AO') or o.data.color_attributes.new(name='AO',type='FLOAT_COLOR',domain='CORNER')
    col.data.foreach_set('color',rgba.reshape(-1))
    o.data.color_attributes.active_color=col
    o.data.color_attributes.render_color_index=0


def finish_ao(root):
    """Only the combined pigment/AO layer exports as COLOR_0."""
    for o in kit.descendants(root):
        if o.type!='MESH':
            continue
        cache=o.data.attributes.get('MagePigmentCache')
        ao=o.data.color_attributes.get('AO')
        if not cache or not ao:
            continue
        raw=np.empty(len(cache.data)*3,dtype=np.float32)
        cache.data.foreach_get('vector',raw)
        raw=raw.reshape(-1,3)
        col=np.empty(len(ao.data)*4,dtype=np.float32)
        ao.data.foreach_get('color',col)
        col=col.reshape(-1,4)
        # Keep occlusion readable, subordinate to the painted materials.
        if ao.domain=='CORNER':
            raw=raw[np.array([loop.vertex_index for loop in o.data.loops],dtype=np.int32)]
        col[:,:3]=raw*(.35+.65*np.clip(col[:,:3],0,1))
        col[:,3]=1
        ao.data.foreach_set('color',col.reshape(-1))
        for layer in list(o.data.color_attributes):
            if layer!=ao:
                o.data.color_attributes.remove(layer)
        o.data.color_attributes.active_color=ao
        o.data.color_attributes.render_color_index=0


def build_master():
    print('MAGE_STAGE anatomical casting hand',flush=True)
    root=kit.empty('mage')
    eR,wR=g.arm_joints(g.S_R,g.FIST_R,g.POLE_R,g.WRIST_FIST)
    eL,wL,f,u,s=g.hand_frame()
    hand,p,u,f,s=casting_hand()
    print('MAGE_STAGE original common-axis rig and legs',flush=True)
    positions={'torso':g.WAIST,'head':g.NECK,'extra2':g.SKIRT_PIVOT,
               'cape':g.CAPE_PIVOT,'cape2':g.cape2_pivot(),'hat':g.hat_pivot(),
               'beard':g.BEARD_PIVOT,'armR':g.S_R,'foreR':eR,'weapon':g.FIST_R,'handR':g.FIST_R,
               'armL':g.S_L,'foreL':eL,'offhand':wL,'extra':g.flame_centre(p,u,f)}
    parents={'head':'torso','extra2':'torso','cape':'torso','cape2':'cape',
             'hat':'head','beard':'head','armR':'torso','foreR':'armR','weapon':'foreR','handR':'foreR',
             'armL':'torso','foreL':'armL','offhand':'foreL','extra':'offhand'}
    leg_sources=[]
    for sign,suffix in ((-1,'L'),(1,'R')):
        pant,boot,knee,ankle=legs(sign)
        positions.update({'leg'+suffix:V(sign*g.HIP_X,0,g.HIP_Z),'knee'+suffix:knee,'foot'+suffix:ankle})
        parents.update({'knee'+suffix:'leg'+suffix,'foot'+suffix:'knee'+suffix})
        leg_sources.append((pant,boot,suffix))
    skeleton=rig(root,positions,parents)
    for pant,boots,suffix in leg_sources:
        skin(pant,skeleton)
        for boot in boots:
            attach(boot,skeleton,'foot'+suffix)
    print('MAGE_STAGE tailored robe and mantle',flush=True)
    for o in [tailored_robe(),g.collar()]+g.clasps()+g.belt():
        if o.name!='mage.tailored-bodice':
            subdivide(o,1)
        attach(o,skeleton,'torso')
    capelet=g.capelet()
    subdivide(capelet,2)
    attach(capelet,skeleton,'torso')
    kit.drape(capelet,free=lambda c: .5*smooth(.84,.7,c.z))
    for o in [tailored_robe(True)]+g.belt_tail()+g.pouch('mage-pouch1',52,.583,(.03,.058,.03),flap_mat=g.LEATHER)+g.pouch('mage-pouch2',118,.583,(.026,.050,.026),flap_mat=g.LEATHER)+g.book():
        if o.name!='mage.tailored-skirt':
            subdivide(o,1)
        attach(o,skeleton,'extra2')
    cloth=cape()
    skin(cloth,skeleton)
    kit.drape(cloth,free=lambda c: smooth(.74,.25,c.z))
    print('MAGE_STAGE continuous sleeves and gripping hand',flush=True)
    for suffix,shoulder,elbow,wrist in (('R',g.S_R,eR,wR),('L',g.S_L,eL,wL)):
        skin(sleeve(shoulder,elbow,wrist,suffix),skeleton)
    for o in grip(eR,wR):
        attach(o,skeleton,'handR')
    for o in hand:
        attach(o,skeleton,'offhand')
    for o in staff():
        attach(o,skeleton,'weapon')
    for o in g.flame(p,u,f,s):
        if 'spark' not in o.name:
            subdivide(o,1)
        attach(o,skeleton,'extra')
    print('MAGE_STAGE weathered face and silver locks',flush=True)
    face=[head_skin()]+eyes()+brows()+ears()+face_details()+back_hair()+cheek_locks()
    shell=g.beard_shell()
    subdivide(shell,2)
    face.append(shell)
    attach_faces(face,skeleton)
    for o in beard():
        attach(o,skeleton,'beard')
    for o in hat():
        if o.get('weightHat'):
            p=np.array([v.co[:] for v in o.data.vertices])
            # Uniform common-axis head/hat blend closes the bent-felt seam.
            inv=g.hat_matrix().inverted()
            z=np.array([(inv@V(v)).z for v in p])
            h=ss(.16,.235,z)
            set_weights(o,{'head':1-h,'hat':h})
            skin(o,skeleton)
        else:
            attach(o,skeleton,'head')
    print('MAGE_STAGE pigment and active corner colour',flush=True)
    for o in kit.descendants(root):
        if o.type=='MESH':
            pigment(o)
    root['sourceBrief']='docs/concepts/2026-10-04-arena-three-characters/mage/brief.md'
    root['qualityMaster']=True
    root['skinContract']='continuous linear sleeves/cape/felt with native common-axis bones and expressive face controls'
    root['nativeScale']=1.0
    surface.configure(root)
    kit.refresh()
    print('MAGE_MASTER',json.dumps({'triangles':sum(mk.tris(o) for o in kit.descendants(root) if o.type=='MESH'),
                                    'joints':{k:list(v) for k,v in positions.items()}}))
    return root
