"""Medic-only detailed adult sculpt, tailored surfaces and anatomical rig.

Build the neutral editable source first. Skin is fused across neck, torso,
shoulders, elbows, wrists and palms, then continuously weighted to named
Arena joints. Cloth is constructed from shaped panels with tension folds;
equipment, cap, bun and expression controls remain separately editable.
No runtime reduction happens in this file.
"""
import json
import math
import os
import re

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.geometry import barycentric_transform
from mathutils.bvhtree import BVHTree

import kit
import figure_medic_forms as f
import figure_medic_kit as rk
from figure_medic_kit import V, gauss, lerp, smooth

R = "medic"
SKIN = "skin:" + kit.tint("medic-skin-master", "#b67f59")
HAIR = "hair:" + kit.tint("medic-hair-master", "#28201d")
UNIFORM = "weave:" + kit.tint("medic-uniform-master", "#d3c5a4")
SEAM = "weave:" + kit.tint("medic-uniform-shadow", "#b0a386")
CREAM = "weave:" + kit.tint("medic-cap-master", "#eee6d4")
GREEN = "resin:" + kit.tint("medic-green-master", "#208854")
LEATHER = "hide:" + kit.tint("medic-leather-master", "#69402c")
LEATHER_LIGHT = "hide:" + kit.tint("medic-leather-edge", "#8e6041")
BRASS = "gilt:" + kit.tint("medic-brass-master", "#b39968")
LIP = "skin:" + kit.tint("medic-lip-master", "#965c50")
NAIL = "skin:" + kit.tint("medic-nail-master", "#cb9c7d")
WHITE = "resin:" + kit.tint("medic-eye-ivory", "#eadccb")
INK = "hair:" + kit.tint("medic-eye-ink", "#28221f")
IRIS = "resin:" + kit.tint("medic-eye-brown", "#67452c")
TONIC = "glow:" + kit.tint("medic-tonic-master", "#36bb62")

HEAD_FACTOR = .89
HEAD_BASE = V(0, 0, 1.018)
HIP = {-1: V(-.082, 0, .61), 1: V(.082, 0, .61)}
KNEE = {-1: V(-.088, .018, .36), 1: V(.088, .012, .36)}
ANKLE = {-1: V(-.096, .026, .10), 1: V(.098, .018, .10)}
SHOULDER = {-1: f.S_L, 1: f.S_R}
ELBOW = {-1: f.E_L, 1: f.E_R}
HAND = {-1: f.C_L, 1: f.C_R}
WRIST = {s: HAND[s] - (HAND[s] - ELBOW[s]).normalized() * .043 for s in (-1, 1)}
TAILORED_BODY = [
    (.600,.112,.088,.094),(.640,.114,.087,.089),(.680,.116,.086,.084),
    (.730,.124,.092,.084),(.790,.136,.104,.088),(.845,.145,.108,.092),
    (.890,.150,.100,.095),(.925,.151,.090,.088),(.952,.151,.079,.080),
    (.968,.143,.069,.068),(.982,.110,.054,.056),(.996,.055,.044,.045),
    (1.004,.044,.040,.043),
]
_garment_fields=None
_skin_fields=None


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def head_transform(p):
    q = HEAD_BASE + (Vector(p) - HEAD_BASE) * HEAD_FACTOR
    q.x *= .97
    return q


def mesh_transform(objects, fn):
    for o in objects:
        kit.apply_transform(o)
        for v in o.data.vertices:
            v.co = fn(v.co)
    return objects


def spline(rows, x):
    """Monotone cubic profile: no piecewise-linear bands on broad forms."""
    if x <= rows[0][0]:
        return tuple(rows[0][1:])
    if x >= rows[-1][0]:
        return tuple(rows[-1][1:])
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        if a[0] <= x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            out = []
            for c in range(1, len(a)):
                before, after = rows[max(0, i - 1)], rows[min(len(rows) - 1, i + 2)]
                m0 = (b[c] - before[c]) / (b[0] - before[0])
                m1 = (after[c] - a[c]) / (after[0] - a[0])
                sec = (b[c] - a[c]) / (b[0] - a[0])
                if abs(sec) < 1e-9:
                    m0 = m1 = 0
                else:
                    m0 = math.copysign(min(abs(m0), abs(sec) * 2), sec) if m0 * sec > 0 else 0
                    m1 = math.copysign(min(abs(m1), abs(sec) * 2), sec) if m1 * sec > 0 else 0
                span = b[0] - a[0]
                out.append((2*t**3 - 3*t*t + 1)*a[c] + (t**3 - 2*t*t + t)*m0*span +
                           (-2*t**3 + 3*t*t)*b[c] + (t**3 - t*t)*m1*span)
            return tuple(out)


def shirt_point(a, z, extra=0):
    width, front, back = spline(f.BODY, z)
    c, s = math.cos(a), math.sin(a)
    x = width * rk.spow(s, 2 / 2.22)
    y = (front if c >= 0 else back) * rk.spow(c, 2 / 2.22)
    # The cloth follows the sternum, shoulder blades and a modest bust.
    ad = (math.degrees(a) + 180) % 360 - 180
    y += .012 * gauss(z, .837, .053) * (gauss(ad, 27, 19) + gauss(ad, -27, 19))
    y -= .004 * gauss(ad, 0, 12) * gauss(z, .85, .080)
    frontness = max(0, c) ** 2
    # Folds originate at the waist, pocket corners and loaded satchel strap.
    fold = .0035 * math.sin(a * 7 + z * 24) * gauss(z, .724, .040)
    fold += .0028 * math.sin(a * 5 - z * 31) * gauss(z, .800, .025) * frontness
    fold += .0035 * gauss(abs(ad), 53, 10) * gauss(z, .88, .07)
    fold -= .0027 * gauss(ad, -19 - (z - .80) * 200, 5) * gauss(z, .86, .085)
    n = V(x / max(.001, width**2), y / max(.001, (front if c >= 0 else back)**2), 0).normalized()
    return V(x, y, z) + n * (fold + extra)


def shirt():
    zs = np.linspace(.60, 1.004, 96)
    rings = [[shirt_point(i / 112 * math.tau, float(z)) for i in range(112)] for z in zs]
    return rk.loft("medic.uniform-shirt", rings, UNIFORM, start=V(0,0,.592), end=V(0,0,1.011))


def body_skin():
    zs = np.linspace(.56, .991, 60)
    rings = [[shirt_point(i / 80 * math.tau, max(.60, float(z)), -.010) +
              V(0, 0, float(z) - max(.60, float(z))) for i in range(80)] for z in zs]
    return rk.loft("medic.under-uniform-body", rings, SKIN, start=V(0,0,.55), end=V(0,0,1.015))


def face_point(ad, z):
    # Smooth authored profiles preserve the facial planes without table
    # bands or pinched trenches round the mouth, brow and nose.
    profile_z=f.jaw_z(z)
    width=spline(f.FACE_W,profile_z)[0]
    width*=1-.055*gauss(z,1.070,.031)
    front=spline(f.FACE_D,profile_z)[0]
    back=spline(f.BACK_D,profile_z)[0]
    a=math.radians(ad)
    x=width*rk.spow(math.sin(a),2/2.42)
    depth=front if math.cos(a)>=0 else back
    y=depth*rk.spow(math.cos(a),2/2.42)
    n=V(rk.spow(x/width,1.42)/width if x else 0,
        rk.spow(y/depth,1.42)/depth if y else 0,0).normalized()
    nasal=spline(f.NOSE_H,z)[0]*gauss(ad,0,spline(f.NOSE_S,z)[0])
    d=nasal
    d+=.0022*gauss(abs(ad),11,6.2)*gauss(z,1.114,.0085)
    d-=.0043*gauss(abs(ad),27,12.5)*gauss(z,1.157,.012)
    d+=.0021*gauss(z,1.176,.0105)*smooth(54,30,abs(ad))
    d+=.0044*gauss(abs(ad),43,17)*gauss(z,1.136,.020)
    d+=.0028*gauss(abs(ad),34,16)*gauss(z,1.108,.020)
    d-=.0007*gauss(z,1.096,.0045)*gauss(ad,0,19)
    d+=.0016*gauss(z,1.102,.0065)*gauss(ad,0,16)
    d+=.0022*gauss(z,1.088,.0068)*gauss(ad,0,15)
    d+=.0032*gauss(z,1.066,.017)*gauss(ad,0,20)
    return V(x,f.CY+y,z)+n*d


def face_n(ad, z):
    du = face_point(ad + .10, z) - face_point(ad - .10, z)
    dv = face_point(ad, z + .0002) - face_point(ad, z - .0002)
    n = du.cross(dv).normalized()
    if (face_point(ad, z) - f.HC).dot(n) < 0:
        n = -n
    return n


def skull():
    n = 180
    zs = np.linspace(1.018, 1.265, 135)
    rings = [[face_point(i / n * 360 - 180, float(z)) for i in range(n)] for z in zs]
    o = rk.loft("medic.face-anatomy", rings, SKIN, start=V(0,.008,1.016), end=V(0,f.CY,1.268))
    return mesh_transform([o], head_transform)[0]


def skin_neck():
    profile = [(0.972,.038,.037), (1.004,.036,.033), (1.035,.032,.034),
               (1.066,.029,.035), (1.082,.032,.038)]
    rings = [[V(x, y + .004, z) for x, y, _ in rk.sup(72, *spline(profile, float(z)))]
             for z in np.linspace(.972, 1.082, 44)]
    return rk.loft("medic.neck-anatomy", rings, SKIN, start=V(0,0,.970), end=V(0,.004,1.085))


def arm(s):
    a, e, w = SHOULDER[s], ELBOW[s], WRIST[s]
    path, radius = [], []
    for t in np.linspace(0, .84, 58):
        p = lerp(a, e, float(t))
        # Authored deltoid, upper-arm taper and bony elbow landmarks.
        r = .030 + .009 * gauss(float(t), .18, .29) + .004 * gauss(float(t), .51, .23)
        p.y += .004 * math.sin(float(t) * math.pi)
        path.append(p)
        radius.append((r, r * (.98 + .10 * gauss(float(t), .88, .16))))
    # A rounded elbow centerline keeps successive cross-sections from
    # intersecting on the inside of the rest bend. The former sharp corner
    # survived remeshing as a genuine cavity under the raised forearm.
    before=lerp(a,e,.84)
    after=lerp(e,w,.18)
    for t in np.linspace(.035,1,32):
        t=float(t)
        p=before*(1-t)**2+e*(2*t*(1-t))+after*t*t
        path.append(p)
        r=lerp(radius[-1][0],.032,t)
        radius.append((r,r*.94))
    for t in np.linspace(.198, 1, 55):
        p = lerp(e, w, float(t))
        r = .021 + .011 * (1 - float(t)) + .005 * gauss(float(t), .28, .22)
        path.append(p)
        radius.append((r, r * .90))
    rings = rk.rings_along(path, radius, n=64, up=(0,1,0))
    # Hanging arms can touch the torso without being anatomically joined
    # all the way down the chest. Retain the real deltoid attachment and
    # carve the hidden medial armpit clearance before fusing the skin.
    # The visible arm below the rolled cuff is unchanged.
    for j,ring in enumerate(rings[:58]):
        t=float(j/57*.84)
        clearance=smooth(.16,.27,t)*(1-smooth(.56,.69,t))
        for p in ring:
            body_width=spline(TAILORED_BODY,float(p.z))[0]
            boundary=body_width-.003
            if p.x*s<boundary:
                p.x=s*lerp(p.x*s,boundary,clearance)
    return rk.loft(f"medic.arm-anatomy-{s}", rings, SKIN,
                   start=a - (e-a).normalized()*.008, end=w+(w-e).normalized()*.014)


def sleeve(s):
    a, e = SHOULDER[s], ELBOW[s]
    direction = (e - a).normalized()
    path, radii = [], []
    for t in np.linspace(0, .69, 64):
        p = lerp(a, e, float(t))
        # Follow the actual deltoid axis. Pulling this first section inward
        # leaves the anatomical shoulder outside the sleeve even when the
        # garment volumes are correctly sewn together.
        r = .042 + .009 * gauss(float(t), .12, .24) - .004 * float(t)
        cuff = .008 * smooth(.57,.62,float(t)) * (1 - smooth(.67,.69,float(t)))
        path.append(p)
        radii.append((r + cuff, r + cuff))
    rings = rk.rings_along(path, radii, n=88, up=(0,1,0))
    for j, ring in enumerate(rings):
        t = j / (len(rings)-1)
        for i, p in enumerate(ring):
            angle = i/len(ring)*math.tau
            n = (p-path[j]).normalized()
            fold = .0028 * math.sin(angle*7+t*10) * gauss(t,.73,.16)
            fold += .0021 * math.sin(angle*4-t*14) * gauss(t,.30,.19)
            ring[i] = p+n*fold
    o = rk.loft(f"medic.gathered-sleeve-{s}", rings, UNIFORM,
                start=V(s*.100,0,.976), end=path[-1])
    c = lerp(a,e,.665)
    u,v = rk.frame_at(direction, V(0,1,0))
    seam = [c+(u*math.cos(i/88*math.tau)+v*math.sin(i/88*math.tau))*.047 for i in range(88)]
    return [o, rk.tube(f"medic.rolled-cuff-seam-{s}", seam+[seam[0]], [.0009]*89,
                       SEAM,n=6,caps=(None,None))]


def sewn_uniform():
    # The sleeve overlaps the shirt along the hanging arm. Unioning all
    # those closed volumes accidentally sews the cuff to the chest. Keep
    # authored closed panels and their short actual shoulder attachment;
    # this preserves the neutral exterior without a long deforming bridge.
    panels=[shirt()]
    panels[0].name="medic.sewn-uniform"
    panels[0]["sewnPanel"]="shirt"
    seams=[]
    for s,suffix in ((-1,"L"),(1,"R")):
        panel,edge=sleeve(s)
        panel.name="medic.sewn-sleeve-"+suffix
        panel["sewnPanel"]=suffix
        edge["sewnPanel"]=suffix
        panels.append(panel)
        seams.append(edge)
    for o in panels:
        kit.apply_transform(o)
        bm=bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        if bm.calc_volume(signed=True)<0:
            bmesh.ops.reverse_faces(bm,faces=bm.faces)
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()
        mod=o.modifiers.new("Detailed sewn panel cage","REMESH")
        mod.mode="VOXEL"
        mod.voxel_size=.0020
        mod.use_smooth_shade=True
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new("Cloth seam relaxation","SMOOTH")
        mod.factor,mod.iterations=.22,2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        sub=o.modifiers.new("Editable uniform weave subdivision","SUBSURF")
        sub.levels=sub.render_levels=1
        sub.use_limit_surface=False
        sub.show_viewport=False
    return panels+seams


def surface_tree(o):
    o.data.calc_loop_triangles()
    return BVHTree.FromPolygons([v.co[:] for v in o.data.vertices],
                               [p.vertices[:] for p in o.data.loop_triangles],all_triangles=True)


def garment_surface_fields():
    """Reconstruct the separate sewn panels' provenance for saved sources."""
    global _garment_fields
    if _garment_fields is not None:
        return _garment_fields
    f.BODY=TAILORED_BODY
    pieces=[shirt()]
    for s in (-1,1):
        panel,edge=sleeve(s)
        pieces.append(panel)
        bpy.data.objects.remove(edge,do_unlink=True)
    _garment_fields=[surface_tree(panel) for panel in pieces]
    for panel in pieces:
        bpy.data.objects.remove(panel,do_unlink=True)
    return _garment_fields


def trousers(s):
    rings=[]
    profile=[(.194,.050,.052),(.235,.047,.049),(.285,.050,.055),
             (.345,.046,.049),(.389,.053,.053),(.477,.059,.062),
             (.563,.062,.061),(.651,.064,.060)]
    for z in np.linspace(.194,.651,92):
        z=float(z)
        rx,ry=spline(profile,z)
        if z < KNEE[s].z:
            center=lerp(ANKLE[s],KNEE[s],(z-ANKLE[s].z)/(KNEE[s].z-ANKLE[s].z))
        else:
            center=lerp(KNEE[s],HIP[s],(z-KNEE[s].z)/(HIP[s].z-KNEE[s].z))
        ring=[]
        for x,y,a in rk.sup(72,rx,ry,power=2.18):
            # Cloth tension rises above the patella and gathers at the boot.
            folds=.0026*math.sin(a*6+z*51)*gauss(z,.232,.030)
            folds+=.0023*math.sin(a*4-z*41)*gauss(z,.395,.022)*max(0,math.sin(a))
            radial=V(x,y,0).normalized()
            ring.append(V(center.x+x,center.y+y,z)+radial*folds)
        rings.append(ring)
    return [rk.loft(f"medic.tailored-trousers-{s}",rings,f.TEAM,start=None,end=V(s*.082,0,.658))]


def boot_soles(s):
    rings=[]
    for z,k in ((.000,.94),(.002,1),(.017,1),(.023,.96)):
        ring=[]
        for x,y,a in rk.sup(96,.047,.105,power=2.8):
            taper=.91+.09*smooth(-.08,.035,y)
            ring.append(V(x*k*taper,y*k+.035,z))
        rings.append(ring)
    sole=rk.loft(f"medic.full-boot-sole-{s}",rings,HAIR,start="flat",end="flat")
    place=Matrix.Translation(V(ANKLE[s].x,ANKLE[s].y,0))@Matrix.Rotation(math.radians(-s*(11 if s<0 else 8)),4,"Z")
    rk.transform([sole],place)
    return [sole]


def hand_frame(s):
    c = HAND[s]
    x = (c-ELBOW[s]).normalized()
    if s > 0:
        x = (x-V(0,0,1)*x.z).normalized()
        y = x.cross(V(0,0,1))
        z = x.cross(y)*-1
    else:
        y = V(0,1,0).cross(x).normalized()
        z = x.cross(y)
    return rk.basis(x,y,z,c)


def hand(s):
    """Authored metacarpal fan, fingers, thenar pad and separate nails."""
    pieces, nails = [], []
    rows = [(-.056,.016,.019),(-.045,.021,.025),(-.030,.023,.032),
            (-.014,.022,.034),(.001,.019,.034),(.010,.015,.032)]
    rings = [[V(x,y,z) for y,z,_ in rk.sup(48,*spline(rows,float(x)),power=2.7)]
             for x in np.linspace(-.056,.010,39)]
    pieces.append(rk.loft(f"medic.palm-{s}", rings, SKIN,start=V(-.058,0,0),end=V(.016,0,0)))
    for k, (height, length) in enumerate(((.024,.055),(.007,.064),(-.010,.058),(-.026,.045))):
        if s > 0:
            wrap=length/.064
            finger = [V(-.014,.016,height), V(.004,.025,height), V(.022,.022,height),
                      V(.026,.006,height-.001),V(.013,-.020*wrap,height-.002),
                      V(.005+(length-.055)*.55,-.021*wrap,height-.003)]
        else:
            finger = [V(.000,.008,height),V(.020,.010,height),V(length*.70,.005,height-.002),
                      V(length,-.004,height-.003),V(length+.004,-.006,height-.004)]
        path = [V(p) for p in kit.smooth_path(finger,samples=5)]
        profile = [(0,.0083),(.22,.0089),(.43,.0071),(.57,.0080),(.77,.0063),(1,.0055)]
        radii = [(spline(profile,i/(len(path)-1))[0]*.91,spline(profile,i/(len(path)-1))[0])
                 for i in range(len(path))]
        pieces.append(rk.tube(f"medic.finger-{s}-{k}", path,radii,SKIN,n=28,up=(0,0,1)))
        # Nail plane sits on the distal phalanx, not floating over a mitt.
        tip=path[-4]
        at=tip+V(-.001,.0057 if s<0 else -.0057,0)
        nail=rk.ball(f"medic.nail-{s}-{k}",1,at,NAIL,scale=(.0047,.0007,.0036),seg=28,rings=16)
        nails.append(nail)
    if s > 0:
        thumb=[V(-.037,-.008,.025),V(-.024,-.025,.038),V(.004,-.024,.033),V(.024,-.009,.020)]
    else:
        thumb=[V(-.033,-.011,.030),V(-.015,-.016,.041),V(.002,-.017,.044),V(.018,-.014,.035)]
    path=kit.smooth_path(thumb,samples=8)
    pieces.append(rk.tube(f"medic.thumb-{s}",path,[lerp(.011,.0072,i/(len(path)-1)) for i in range(len(path))],
                          SKIN,n=28,up=(0,0,1)))
    tangent=(V(path[-1])-V(path[-5])).normalized()
    normal=V(0,-1,0)-tangent*tangent.dot(V(0,-1,0))
    normal.normalize()
    thumb_nail=rk.ball(f"medic.thumb-nail-{s}",1,V(0,0,0),NAIL,
                       scale=(.0046,.0007,.0037),seg=28,rings=16)
    rk.transform([thumb_nail],rk.basis(tangent,normal,tangent.cross(normal),V(path[-4])+normal*.0065))
    nails.append(thumb_nail)
    pieces.append(rk.ball(f"medic.thenar-{s}",1,V(-.029,-.008,.018),SKIN,
                          scale=(.023,.016,.024),seg=40,rings=26))
    rk.transform(pieces+nails,hand_frame(s))
    return pieces,nails


def ear(s):
    # A shaped outer helix, hollow concha and tragus are part of the skin.
    at=f.face_point(s*90,1.143)+V(s*.004,-.008,0)
    out=[rk.ball(f"medic.ear-base-{s}",1,at,SKIN,scale=(.008,.016,.022),seg=40,rings=28)]
    path=[at+V(s*(.006+.0015*math.sin(i/64*math.tau)),
                .014*math.cos(i/64*math.tau),.023*math.sin(i/64*math.tau)) for i in range(65)]
    out.append(rk.tube(f"medic.ear-helix-{s}",path,[.0027]*65,SKIN,n=12,caps=(None,None)))
    out.append(rk.ball(f"medic.ear-tragus-{s}",.004,at+V(s*.009,.009,-.002),SKIN,seg=24,rings=16))
    return mesh_transform(out,head_transform)


def face_details():
    out=[]
    for s in (-1,1):
        ac=s*27
        center=face_point(ac,1.157)
        normal=face_n(ac,1.157)
        right=V(1,0,0)-normal*normal.x
        right.normalize()
        up=right.cross(normal).normalized()
        # All layers share one convex ocular surface. Projecting every iris
        # vertex independently on a recessed socket distorts round pupils.
        def ocular(x,y,lift):
            ymax=.0068*max(0,1-(x/.0172)**2)**.70
            y=max(-ymax,min(ymax,y))
            bulge=.0038*max(0,1-(x/.0180)**2-(y/.0092)**2)
            return center+right*x+up*(y+s*x*.065)+normal*(.0042+bulge+lift)
        def patch(label,width,height,lift,mat,dx=0,dy=0,almond=False):
            rings=[]
            for k in range(1,13):
                r=k/12
                ring=[]
                for i in range(64):
                    t=i/64*math.tau
                    y=math.sin(t)*height*r
                    if almond:
                        y*=abs(math.sin(t))**.40
                    ring.append(ocular(dx+math.cos(t)*width*r,dy+y,lift))
                rings.append(ring)
            o=rk.loft(f"medic-{label}{s}",rings,mat,start=ocular(dx,dy,lift),end=None)
            # An open nested eye sheet cannot infer its outward side from
            # connectivity; explicitly face it away from the skull centre.
            outward=sum(p.normal.dot(p.center-f.HC) for p in o.data.polygons)
            if outward < 0:
                o.data.flip_normals()
            return mesh_transform([o],head_transform)[0]
        out.append(patch("eye-outline",.0172,.0068,0,SKIN,almond=True))
        out.append(patch("eye-white",.0158,.0059,.00035,WHITE,almond=True))
        out.append(patch("iris",.0061,.0061,.00070,IRIS,dy=.00035))
        out.append(patch("pupil",.0030,.0030,.00105,INK,dy=.00035))
        out.append(patch("catchlight",.0012,.0013,.0014,WHITE,dx=-.0018,dy=.0025))
        # Soft upper and lower lids, with a distinct tear corner.
        for upper in (True,False):
            path=[]
            for t in np.linspace(0,math.pi,35):
                x=math.cos(float(t))*.0168
                y=(1 if upper else -1)*math.sin(float(t))**1.4*.0067
                path.append(ocular(x,y,.0004))
            lid=rk.tube(f"medic.lid-{s}-{upper}",path,[.0010]*len(path),SKIN,n=12)
            out += mesh_transform([lid],head_transform)
        brow=[]
        for t in np.linspace(-1,1,26):
            ad=ac+float(t)*12
            z=1.180+.004*(1-float(t)**2)+float(t)*s*.001
            brow.append(face_point(ad,z)+face_n(ad,z)*.0027)
        o=rk.tube(f"medic-expression-brow{s}",brow,[.0026*(1-.6*abs(i/(len(brow)-1)*2-1)) for i in range(len(brow))],
                  HAIR,n=10)
        out+=mesh_transform([o],head_transform)
        nostril=face_point(s*8,1.115)+face_n(s*8,1.115)*.0005
        o=rk.ball(f"medic.nostril-{s}",1,nostril,LIP,scale=(.0017,.00025,.0009),seg=24,rings=16)
        out+=mesh_transform([o],head_transform)
    line=[]
    for ad in np.linspace(-15,15,35):
        z=1.0954+.0012*(float(ad)/15)**2
        line.append(face_point(float(ad),z)+face_n(float(ad),z)*.0015)
    o=rk.tube("medic-mouth",line,[.00095]*len(line),LIP,n=8)
    out+=mesh_transform([o],head_transform)
    for upper in (True,False):
        line=[]
        for ad in np.linspace(-14,14,32):
            t=float(ad)/14
            z=1.0954+(1 if upper else -1)*.0024*(1-t*t)+.0012*t*t
            line.append(face_point(float(ad),z)+face_n(float(ad),z)*.0012)
        o=rk.tube(f"medic.lip-{upper}",line,[.0015*(1-.5*abs(i/(len(line)-1)*2-1)) for i in range(len(line))],LIP,n=10)
        out+=mesh_transform([o],head_transform)
    return out


def hair():
    # Shaped swept hair follows the scalp; fine ridges flow into the low bun.
    n,m=144,66
    rings=[]
    for j in range(m):
        t=j/(m-1)*.98
        ring=[]
        for i in range(n):
            a=i/n*360-180
            z=lerp(f.hairline(a),1.265,t)
            ridge=.0012*math.cos(math.radians(a)*38+t*7)*smooth(0,.18,t)*(1-smooth(.89,1,t))
            thickness=.002+.008*smooth(0,.30,t)+ridge
            thickness-=.003*gauss(a,-38,4)*smooth(.10,.45,t)
            ring.append(face_point(a,z)+face_n(a,z)*thickness)
        rings.append(ring)
    out=[rk.loft("medic.swept-hair",rings,HAIR,start=None,end=V(0,f.CY,1.272))]
    b=V(0,f.CY-.113,1.104)
    out.append(rk.ball("medic.low-bun",1,b,HAIR,scale=(.045,.032,.036),seg=80,rings=52))
    for coil in range(6):
        path=[]
        for i in range(100):
            t=i/99
            a=t*math.tau*1.35+coil*math.pi/3
            rr=lerp(.037,.010,t)
            x,z=math.cos(a)*rr*1.05,math.sin(a)*rr*.94
            k=max(0,1-(x/.046)**2-(z/.037)**2)
            path.append(b+V(x,-.032*math.sqrt(k)-.0006,z))
        out.append(rk.tube(f"medic.bun-sweep-{coil}",path,[.0014]*len(path),HAIR,n=10))
    return mesh_transform(out,head_transform)


def cap():
    # Existing construction, with a flatter practical crown and fine piping.
    out=f.cap()
    def fitted(p):
        ad=math.atan2(p.x,p.y-f.CY)
        z0=1.199+.007*math.cos(ad)
        p=V(p)
        p.z=z0+(p.z-z0)*.87
        return head_transform(p)
    mesh_transform(out,fitted)
    for o in out:
        if len(o.data.polygons)>32:
            mod=o.modifiers.new("Editable cap tailoring","SUBSURF")
            mod.levels=mod.render_levels=2
    return out


def skirt_half(s):
    n,m=98,58
    a0,a1=(-10,192) if s>0 else (-24,186)
    us=[i/n for i in range(n+1)]
    vs=[i/m for i in range(m+1)]
    def surface(u,v):
        z=lerp(.686,.437,v)
        a=math.radians(lerp(a0,a1,u))*s
        p=f.skirt_point(a,z,.003 if s>0 else 0)
        p+=V(math.sin(a),math.cos(a),0)*(.0015*math.sin(a*12+v*3)*smooth(.2,.8,v))
        return p
    o=rk.sheet(f"medic.pressed-skirt-{s}",surface,us,vs,UNIFORM,rim=.0035,back=True,inside=V(s*.03,0,.56))
    path=[surface(u,.955)+V(math.sin(math.radians(lerp(a0,a1,u))*s),math.cos(math.radians(lerp(a0,a1,u))*s),0)*.0008 for u in us]
    return [o,rk.tube(f"medic.skirt-hem-{s}",path,[.00075]*len(path),SEAM,n=6,caps=(None,None))]


def shirt_decorations():
    out=[]
    def collar_surface(u,v):
        a=math.radians(lerp(22,338,u))
        s,c=math.sin(a),math.cos(a)
        front=max(0,c)**3
        inner=V(.048*s,.045*c,.996)
        outer=V((.098+.016*front)*s,(.084+.026*front)*c,.964-.044*front)
        # A smoothly rolled fold follows the neck and shoulder drape.
        return lerp(inner,outer,v)+V(0,0,.009*math.sin(v*math.pi))
    out.append(rk.sheet("medic.folded-collar",collar_surface,
                        [i/96 for i in range(97)],[i/24 for i in range(25)],UNIFORM,
                        rim=.003,inside=V(0,0,.9)))
    knot=V(0,shirt_point(0,.975).y+.009,.976)
    out.append(rk.ball("medic.tie-knot",1,knot,f.TEAM2,scale=(.011,.008,.013),seg=48,rings=28))
    def blade(u,v):
        z=lerp(.965,.846,v)
        width=lerp(.0105,.0175,v)*(1-.92*smooth(.88,1,v)*abs(u))
        z-=.012*smooth(.85,1,v)*(1-abs(u))
        return shirt_point(math.atan2(u*width,.1),z,.007)
    out.append(rk.sheet("medic.team-tie",blade,[i/16 for i in range(-16,17)],
                        [i/48 for i in range(49)],f.TEAM2,rim=.0022,inside=V(0,0,.9)))
    for s in (-1,1):
        def flap(u,v,s=s):
            a=math.radians(s*lerp(14,40,u))
            z=lerp(.892,.872,v)-.006*math.sin(math.pi*u)*v
            return shirt_point(a,z,.004+.002*v)
        out.append(rk.sheet(f"medic.pocket-flap-{s}",flap,[i/32 for i in range(33)],
                            [i/18 for i in range(19)],UNIFORM,rim=.0025,inside=V(0,0,.88)))
        out.append(rk.ball(f"medic.pocket-button-{s}",1,
                           shirt_point(math.radians(s*27),.874,.0075),BRASS,
                           scale=(.0045,.0025,.0045),seg=32,rings=18))
    out+=f.placket()+f.epaulettes()
    return out


def satchel():
    out=f.satchel()
    for o in out:
        if "bag" in o.name and "cross" not in o.name:
            mod=o.modifiers.new("Editable leather panel refinement","SUBSURF")
            mod.levels=mod.render_levels=1
    # Gusset piping and deliberate stitching follow actual flap construction.
    c=V(.215,0,.595)
    edge=[]
    for i in range(68):
        a=i/68*math.tau
        edge.append(c+V(.034,math.cos(a)*.065,math.sin(a)*.056))
    out.append(rk.tube("medic.satchel-gusset-pipe",edge+[edge[0]],[.0015]*69,LEATHER_LIGHT,n=8,caps=(None,None)))
    for side in (-1,1):
        for z in np.linspace(.552,.641,18):
            out.append(rk.tube(f"medic.satchel-stitch-{side}-{z:.3f}",
                              [V(.251,side*.064,float(z)),V(.2512,side*.064,float(z)+.0022)],
                              [.00055,.00055],CREAM,n=5))
    # Buckled flap strap and small brass hardware distinguish a field kit.
    out.append(rk.rbox("medic.satchel-closure",(.007,.017,.055),V(.254,0,.57),LEATHER,levels=3,crease=.45))
    buckle=[V(.259,y,.57+z) for y,z,_ in rk.sup(32,.014,.017,power=3.4)]
    out.append(rk.tube("medic.satchel-closure-buckle",buckle+[buckle[0]],[.0016]*33,BRASS,n=8,caps=(None,None)))
    return out


def flask():
    # The retained iconic round green tonic has a real grip stem and casing.
    c=HAND[1]
    b=c+V(0,0,.074)
    profile=[(-.033,.013),(.025,.014),(.044,.027),(.061,.043),(.081,.045),
             (.100,.036),(.112,.021),(.119,.014),(.143,.013)]
    rings=[]
    for z in np.linspace(-.033,.143,110):
        radius=spline(profile,float(z))[0]
        rings.append([c+V(radius*math.sin(i/96*math.tau),radius*math.cos(i/96*math.tau),float(z)) for i in range(96)])
    out=[rk.loft("medic.tonic-vessel",rings,TONIC,start=c+V(0,0,-.034),end=c+V(0,0,.144))]
    for k,z in enumerate((-.020,.030,.130)):
        ring=[c+V(math.cos(i/64*math.tau)*(.018 if k<2 else .016),math.sin(i/64*math.tau)*(.018 if k<2 else .016),z)
              for i in range(64)]
        out.append(rk.tube(f"medic.vessel-brass-ring-{k}",ring+[ring[0]],[.0022]*65,BRASS,n=10,caps=(None,None)))
    out.append(rk.tube("medic.tonic-stop",[c+V(0,0,.141),c+V(0,0,.159)],[.0137,.0145],LEATHER,n=48,
                       caps=("flat","flat")))
    # Curved cream label sits on the bulb rather than across its silhouette.
    def label(u,v):
        a=lerp(-.44,.44,u)
        z=lerp(.060,.092,v)
        rad=spline(profile,z)[0]+.0009
        return c+V(math.sin(a)*rad,math.cos(a)*rad,z)
    out.append(rk.sheet("medic.tonic-label",label,[i/28 for i in range(29)],[i/20 for i in range(21)],CREAM,
                        rim=.0008,inside=b))
    def emblem(u,v):
        return label((u+.021)/.042,(v+.016)/.032)
    outline=f.cross_outline(.012,.0072)
    out.append(rk.decal("medic.tonic-label-green",emblem,outline,.001, GREEN,depth=.0005,eps=.0001,ref=b))
    return out


def make_rig(root):
    data=bpy.data.armatures.new("Medic anatomical frames")
    rig=bpy.data.objects.new("medic.skeleton",data)
    bpy.context.collection.objects.link(rig)
    rig.parent=root
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    positions={"torso":f.WAIST,"head":f.NECK,"hair":head_transform(V(0,f.CY-.1,1.11)),
               "hat":head_transform(V(0,0,1.21)),"skirtL":V(0,0,.645),"skirtR":V(0,0,.645),"weapon":HAND[1]}
    parents={"head":"torso","hair":"head","hat":"head","skirtL":"torso","skirtR":"torso","weapon":"handR"}
    for s,suffix in ((-1,"L"),(1,"R")):
        for name,pos,parent in (("leg",HIP[s],None),("knee",KNEE[s],"leg"+suffix),("foot",ANKLE[s],"knee"+suffix),
                                ("arm",SHOULDER[s],"torso"),("fore",ELBOW[s],"arm"+suffix),("hand",WRIST[s],"fore"+suffix)):
            positions[name+suffix]=pos
            if parent:
                parents[name+suffix]=parent
    for name,pos in positions.items():
        b=data.edit_bones.new("medic"+name)
        b.head,b.tail=pos,pos+V(0,0,.065)
        b.use_connect=False
    for name,parent in parents.items():
        data.edit_bones["medic"+name].parent=data.edit_bones["medic"+parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front=True
    data.display_type="WIRE"
    rig["arenaCommonAxes"]=True
    rig["anatomicalPivots"]=json.dumps({k:list(v) for k,v in positions.items()})
    return rig


def segment_distance(p,a,b):
    av,bv=np.array(a),np.array(b)
    d=bv-av
    t=np.clip((p-av).dot(d)/d.dot(d),0,1)
    return np.linalg.norm(p-(av+t[:,None]*d),axis=1)


def add_weights(o,rig,weights):
    total=np.maximum(1e-8,np.sum(list(weights.values()),axis=0))
    for name,raw in weights.items():
        q=np.rint(np.clip(raw/total,0,1)*10000).astype(int)
        indices=np.flatnonzero(q>0)
        if not len(indices):
            continue
        group=o.vertex_groups.new(name="medic"+name)
        indices=indices[np.argsort(q[indices])]
        cuts=np.flatnonzero(np.diff(q[indices]))+1
        for batch in np.split(indices,cuts):
            if len(batch):
                group.add(batch.tolist(),float(q[batch[0]])/10000,"REPLACE")
    mod=o.modifiers.new("Continuous linear anatomical weights","ARMATURE")
    mod.object=rig
    mod.use_deform_preserve_volume=False
    # Build attachments against the neutral cage; repeatedly reevaluating
    # the entire detailed skin after each sew/stitch is unnecessary.
    mod.show_viewport=False
    o.parent=rig


def weight_body(o,rig):
    p=np.array([v.co[:] for v in o.data.vertices])
    x,y,z=p.T
    weights={"torso":1-ss(1.014,1.075,z),"head":ss(1.014,1.075,z)}
    body_width=np.interp(z,[r[0] for r in f.BODY],[r[1] for r in f.BODY])
    tailoring="sewn-uniform" in o.name or "rolled-cuff" in o.name or "sewn-sleeve" in o.name
    panel_distances=None
    if tailoring and not o.get("sewnPanel"):
        panel_distances=[np.array([tree.find_nearest(Vector(v))[3] for v in p])
                         for tree in garment_surface_fields()]
    skin_distances=None
    if o.name.startswith("medic.skin") and _skin_fields is not None:
        skin_distances=[np.array([tree.find_nearest(Vector(v))[3] for v in p])
                        for tree in _skin_fields]
    for s,suffix in ((-1,"L"),(1,"R")):
        # Ownership follows the bent arm's actual path, not height alone.
        dist=np.minimum(segment_distance(p,SHOULDER[s],ELBOW[s]),segment_distance(p,ELBOW[s],HAND[s]))
        tip=HAND[s]+(HAND[s]-ELBOW[s]).normalized()*.095
        dist=np.minimum(dist,segment_distance(p,HAND[s],tip))
        region=(x*s>.105)&(z>.40)&(z<1.026)&(dist<.085)
        front_depth=np.interp(z,[r[0] for r in f.BODY],[r[2] for r in f.BODY])
        outside=np.maximum(ss(body_width-.014,body_width+.027,x*s),ss(front_depth+.011,front_depth+.061,y))
        lateral_share=np.maximum(ss(.107,.178,x*s),ss(front_depth+.028,front_depth+.083,y))
        share=lateral_share*region*np.maximum(outside,ss(.882,.935,z)*(1-ss(.986,1.026,z)))
        upper_axis=np.array(ELBOW[s]-SHOULDER[s])
        upper_t=(p-np.array(SHOULDER[s])).dot(upper_axis)/upper_axis.dot(upper_axis)
        outside_body=np.maximum(ss(body_width-.004,body_width+.004,x*s),
                                ss(front_depth+.008,front_depth+.027,y))
        # Distal upper arm, elbow and forearm belong to the limb across
        # their complete cross-section. A lateral-only share gives the
        # exposed medial arm almost half torso weight, pulling it into
        # long chest ribbons during the overhead healing gesture.
        limb_share=ss(.49,.65,upper_t)*outside_body*region
        share=np.maximum(share,limb_share)
        if skin_distances is not None:
            arm_distance=skin_distances[1 if s<0 else 2]
            anatomy_share=ss(-.002,.003,skin_distances[0]-arm_distance)
            share=anatomy_share*ss(-.12,.21,upper_t)*region
        sewn_part=o.get("sewnPanel")
        if sewn_part=="shirt":
            share=ss(.914,.969,z)*ss(.105,.169,x*s)*ss(-.12,.21,upper_t)*region
        elif sewn_part:
            share=ss(-.12,.21,upper_t) if sewn_part==suffix else np.zeros(len(p))
        elif tailoring:
            # The fused garment is still a shirt sewn to two sleeves.
            # Preserve those surfaces' provenance rather than treating a
            # nearby torso silhouette as the medial arm. That broad
            # distance field inverted the underarm sheet on a full raise.
            sleeve_distance=panel_distances[1 if s<0 else 2]
            panel_share=ss(-.003,.003,panel_distances[0]-sleeve_distance)
            share=panel_share*ss(-.12,.21,upper_t)*region
        # A bent arm can put both shoulder and wrist above the elbow.
        # Segment proximity gives the correct side of that bend; a height
        # or forearm projection alone puts the upper sleeve on the forearm.
        e,w=ELBOW[s],WRIST[s]
        axis=np.array((w-e).normalized())
        upper_distance=segment_distance(p,SHOULDER[s],e)
        fore_distance=segment_distance(p,e,HAND[s]+(HAND[s]-e).normalized()*.095)
        fore=ss(-.019,.019,upper_distance-fore_distance)
        hand_proj=(p-np.array(w)).dot(axis)
        hand_share=ss(-.021,.022,hand_proj)
        weights["arm"+suffix]=share*(1-fore)
        weights["fore"+suffix]=share*fore*(1-hand_share)
        weights["hand"+suffix]=share*fore*hand_share
        weights["torso"]*=1-share
        weights["head"]*=1-share
    add_weights(o,rig,weights)
    o["continuousSkin"]=True


def weight_leg(o,rig,s):
    p=np.array([v.co[:] for v in o.data.vertices])
    z=p[:,2]
    knee=1-ss(.329,.393,z)
    foot=1-ss(.087,.152,z)
    pelvis=ss(.555,.638,z)
    suffix="L" if s<0 else "R"
    add_weights(o,rig,{"torso":pelvis,"leg"+suffix:(1-pelvis)*(1-knee),
                       "knee"+suffix:(1-pelvis)*knee*(1-foot),"foot"+suffix:(1-pelvis)*knee*foot})


def covered_skin_share(p):
    coverage=0
    if .597<p.z<1.004:
        width,front,back=spline(TAILORED_BODY,float(p.z))
        if abs(p.x)<width+.007 and -back-.007<p.y<front+.025:
            coverage=1-smooth(.990,1.004,p.z)
    for s in (-1,1):
        a,e=SHOULDER[s],ELBOW[s]
        direction=e-a
        t=(p-a).dot(direction)/direction.length_squared
        center=lerp(a,e,max(0,min(1,t)))
        if -.30<t<.69 and (p-center).length<.095:
            coverage=max(coverage,1-smooth(.55,.69,t))
    return coverage


def contain_covered_arm_skin(skin,uniform):
    """Fit hidden torso and upper-arm tissue within its sewn garment.

    The arm and shirt are authored independently. Their fused shoulder and
    gathering can differ by millimetres; hidden tissue must not emerge as
    skin islands through cloth. The entire covered armpit must share the
    cloth's blend field: a lateral fade leaves medial shoulder vertices
    pulling through the shirt during the raised-arm pose. Face, visible
    neck, forearms and hands retain their authored surfaces. The margin
    fades before each full cuff opening and above the shirt's neck line.
    """
    fields={}
    for cloth in uniform:
        if "rolled-cuff" in cloth.name:
            continue
        cloth.data.calc_loop_triangles()
        points=[v.co[:] for v in cloth.data.vertices]
        faces=[p.vertices[:] for p in cloth.data.loop_triangles]
        tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
        fields[cloth.get("sewnPanel","shirt")]=(cloth,points,faces,tree,
                                                 {g.index:g.name for g in cloth.vertex_groups})
    adjusted=0
    fitted=[]
    for vertex in skin.data.vertices:
        p=vertex.co
        coverage=covered_skin_share(p)
        if coverage<.001:
            continue
        original={skin.vertex_groups[g.group].name:g.weight for g in vertex.groups}
        arm_shares={side:sum(original.get("medic"+part+side,0) for part in ("arm","fore","hand"))
                    for side in ("L","R")}
        side=max(arm_shares,key=arm_shares.get)
        panel=side if arm_shares[side]>.47 and side in fields else "shirt"
        cloth,points,faces,tree,group_names=fields[panel]
        nearest,normal,face_index,distance=tree.find_nearest(p)
        if nearest is None:
            continue
        signed=(p-nearest).dot(normal)
        clearance=.007*coverage
        # Bind all completely covered vertices to the corresponding cloth
        # surface, including deeply buried tissue. Matching weights alone
        # leaves different rest offsets rotating through the tightly folded
        # underarm when its blended skinning matrix changes orientation.
        if coverage>=.999 or signed>-clearance:
            vertex.co=nearest-normal*clearance
            adjusted+=1
        tri=faces[face_index]
        bary=barycentric_transform(nearest,Vector(points[tri[0]]),Vector(points[tri[1]]),Vector(points[tri[2]]),
                                   V(1,0,0),V(0,1,0),V(0,0,1))
        garment_weights={}
        for index,factor in zip(tri,bary):
            for member in cloth.data.vertices[index].groups:
                name=group_names[member.group]
                garment_weights[name]=garment_weights.get(name,0)+member.weight*factor
        weights={skin.vertex_groups[g.group].name:g.weight*(1-coverage) for g in vertex.groups}
        for name,value in garment_weights.items():
            weights[name]=weights.get(name,0)+value*coverage
        total=sum(weights.values())
        fitted.append((vertex.index,{name:max(0,value)/total for name,value in weights.items()}))
    # Corresponding hidden tissue and cloth use the same blend field. An
    # independently recomputed shoulder blend can turn a small rest margin
    # into centimetres of separation on the overhead healing pose.
    ids=[index for index,_ in fitted]
    for group in skin.vertex_groups:
        group.remove(ids)
    names={name for _,weights in fitted for name in weights}
    for name in names:
        group=skin.vertex_groups.get(name) or skin.vertex_groups.new(name=name)
        values=np.rint(np.array([weights.get(name,0) for _,weights in fitted])*10000).astype(int)
        indices=np.flatnonzero(values>0)
        indices=indices[np.argsort(values[indices])]
        cuts=np.flatnonzero(np.diff(values[indices]))+1
        for batch in np.split(indices,cuts):
            if len(batch):
                group.add([ids[i] for i in batch],float(values[batch[0]])/10000,"REPLACE")
    skin.data.update()
    print("MEDIC HIDDEN UPPER ARM CONTAINMENT",adjusted,"skin cage vertices",flush=True)


def repair_loaded_source_weights(root):
    """Apply the current reproducible weight contract to a saved source."""
    f.BODY=TAILORED_BODY
    rig=bpy.data.objects["medic.skeleton"]
    skin=bpy.data.objects["medic.skin"]
    if os.environ.get("MEDIC_REPAIR_SEWN_PANELS")=="1":
        for o in list(kit.descendants(root)):
            if o.type=="MESH" and o.get("weightedTailoring"):
                bpy.data.objects.remove(o,do_unlink=True)
        for o in sewn_uniform():
            rk.uv_box(o)
            weight_body(o,rig)
            o["continuousSkin"]=False
            o["weightedTailoring"]=True
    uniform=[]
    for o in kit.descendants(root):
        if o==skin or (o.type=="MESH" and o.get("weightedTailoring")):
            for mod in list(o.modifiers):
                if mod.type=="ARMATURE":
                    o.modifiers.remove(mod)
            o.vertex_groups.clear()
            weight_body(o,rig)
            if o!=skin:
                o["continuousSkin"]=False
                uniform.append(o)
    contain_covered_arm_skin(skin,uniform)
    for o in [skin]+uniform:
        for mod in o.modifiers:
            if mod.type in ("ARMATURE","SUBSURF"):
                mod.show_viewport=True
    materials()
    finish_ao(root,pigment=False)


def attach(o,rig,part):
    kit.apply(o)
    kit.apply_transform(o)
    world=o.matrix_world.copy()
    o.parent,o.parent_type,o.parent_bone=rig,"BONE","medic"+part
    o.matrix_world=world
    return o


def fuse_skin(pieces):
    for o in pieces:
        kit.apply(o)
    o=kit.join(pieces,"medic.skin")
    kit.apply_transform(o)
    mod=o.modifiers.new("Continuous authored anatomical surface","REMESH")
    mod.mode="VOXEL"
    mod.voxel_size=.0017
    mod.use_smooth_shade=True
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new("Soft anatomical junctions","SMOOTH")
    mod.factor,mod.iterations=.38,3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # The skin has an actual grip channel around the vertical tonic stem;
    # a solid palm would otherwise bury equipment inside the fingers.
    c=HAND[1]
    cutter=rk.tube("Medic grip channel construction cutter",[c+V(0,0,-.095),c+V(0,0,.095)],
                   [.0151,.0151],SKIN,n=96,caps=("flat","flat"))
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new("Tonic stem grip channel","BOOLEAN")
    mod.operation="DIFFERENCE"
    mod.solver="EXACT"
    mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    o.data.materials.clear()
    o.data.materials.append(kit.material(SKIN))
    for poly in o.data.polygons:
        poly.use_smooth=True
    sub=o.modifiers.new("Editable skin micro subdivision","SUBSURF")
    sub.levels=sub.render_levels=1
    # Evaluate the uniform authored subdivision, not an adaptive limit
    # surface stencil table for this already dense voxel cage.
    sub.use_limit_surface=False
    sub.show_viewport=False
    return o


def attach_faces(pieces,rig):
    groups,fixed={},[]
    for o in pieces:
        key=None
        match=re.fullmatch(r"medic-(.*?)(-?1)(?:\.\d{3})?",o.name)
        if match:
            label,s=match.groups()
            suffix="L" if s=="-1" else "R"
            if label in ("eye-outline","eye-white"):
                key="eye"+suffix
            elif label in ("iris","pupil","catchlight"):
                key="pupil"+suffix
            elif "brow" in label:
                key="brow"+suffix
        if o.name=="medic-mouth":
            key="mouth"
        (groups.setdefault(key,[]) if key else fixed).append(o)
    for o in fixed:
        attach(o,rig,"head")
    nodes={}
    for key in ("eyeL","eyeR","browL","browR","mouth","pupilL","pupilR"):
        if not groups.get(key):
            continue
        o=kit.join(groups[key],"medic"+key)
        kit.apply_transform(o)
        pts=[v.co.copy() for v in o.data.vertices]
        lo=V(*(min(p[i] for p in pts) for i in range(3)))
        hi=V(*(max(p[i] for p in pts) for i in range(3)))
        center,size=(lo+hi)/2,hi-lo
        if key.startswith("pupil"):
            axes=nodes["eye"+key[-1]].matrix_world.to_3x3()
        else:
            normal=V(center.x*3,1,0).normalized()
            up=V(0,0,1)
            right=normal.cross(up).normalized()
            axes=Matrix((right,normal,up)).transposed()
        frame=Matrix.Translation(center)@axes.to_4x4()
        o.data.transform(frame.inverted())
        o.matrix_world=frame
        if key.startswith("pupil"):
            o.parent=nodes["eye"+key[-1]]
        else:
            o.parent,o.parent_type,o.parent_bone=rig,"BONE","medichead"
        o.matrix_world=frame
        o["faceWidth"],o["faceHeight"]=max(.005,size.x),max(.002,size.z)
        nodes[key]=o
        kit.refresh()


def refine(objects,levels=1):
    for o in objects:
        mod=o.modifiers.new("Editable tailored source subdivision","SUBSURF")
        mod.levels=mod.render_levels=levels
    return objects


def materials():
    for name in (SKIN,HAIR,UNIFORM,SEAM,CREAM,LEATHER,LEATHER_LIGHT,BRASS,LIP,NAIL,WHITE,INK,IRIS,TONIC,GREEN):
        mat=kit.material(name)
        mat["masterCharacter"]="medic"
        bsdf=mat.node_tree.nodes.get("Principled BSDF")
        if name.startswith("skin"):
            bsdf.inputs["Roughness"].default_value=.66
            bsdf.inputs["Specular IOR Level"].default_value=.28
        elif name.startswith("hair"):
            bsdf.inputs["Roughness"].default_value=.54
        elif name.startswith("weave"):
            bsdf.inputs["Roughness"].default_value=.90


def finish_ao(root,pigment=True):
    # Separate inspectable pigment cached as generic vectors; export carries
    # one stable AO colour layer, combined with measured broad skin variation.
    for o in kit.descendants(root):
        if o.type!="MESH":
            continue
        if not o.data.color_attributes.get("AO"):
            layer=o.data.color_attributes.new("AO","BYTE_COLOR","CORNER")
            layer.data.foreach_set("color",np.ones(len(layer.data)*4,dtype=np.float32))
            o.data.color_attributes.active_color=layer
        if not pigment or not o.get("continuousSkin"):
            continue
        cache=o.data.attributes.get("MedicPigmentCache") or o.data.attributes.new(
            name="MedicPigmentCache",type="FLOAT_VECTOR",domain="POINT")
        p=np.empty(len(o.data.vertices)*3,dtype=np.float32)
        o.data.vertices.foreach_get("co",p)
        x,y,z=p.reshape(-1,3).T
        cheek=np.exp(-((np.abs(x)-.041)/.022)**2)*np.exp(-((z-1.122)/.020)**2)*ss(.0,.08,y)
        nose=np.exp(-(x/.017)**2)*np.exp(-((z-1.126)/.018)**2)*ss(.08,.11,y)
        finger=.035*(np.exp(-((z-HAND[1].z)/.041)**2)+np.exp(-((z-HAND[-1].z)/.045)**2))
        variation=.014*np.sin(x*19+z*5)*np.cos(y*21)
        values=np.column_stack((1+variation,.97+variation-cheek*.026-nose*.022-finger,.94+variation-cheek*.022))
        cache.data.foreach_set("vector",values.astype(np.float32).reshape(-1))
        layer=o.data.color_attributes.get("AO")
        rgba=np.empty(len(layer.data)*4,dtype=np.float32)
        layer.data.foreach_get("color",rgba)
        rgba=rgba.reshape(-1,4)
        indices=np.empty(len(o.data.loops),dtype=np.int32)
        o.data.loops.foreach_get("vertex_index",indices)
        # Prevent the underlying uniform from blackening exposed wrists.
        rgba[:,:3]=np.maximum(.77,rgba[:,0])[:,None]*values[indices]
        rgba[:,3]=1
        layer.data.foreach_set("color",rgba.reshape(-1))


def build_master():
    global _skin_fields
    # Set construction palette on the independent legacy tailoring helpers.
    f.SKIN,f.HAIR,f.KHAKI,f.CREAM,f.CROSS=SKIN,HAIR,UNIFORM,CREAM,GREEN
    f.LEATHER,f.BRASS,f.GLOW=LEATHER,BRASS,TONIC
    f.BODY=TAILORED_BODY
    f.body_point=shirt_point
    root=kit.empty("medic")
    rig=make_rig(root)
    print("MEDIC SOURCE: anatomical cages",flush=True)
    body=body_skin()
    skinpieces=[body,skin_neck(),skull()]
    arm_sources=[]
    nails=[]
    for s in (-1,1):
        hp,npieces=hand(s)
        anatomical_arm=arm(s)
        arm_sources.append(anatomical_arm)
        skinpieces += [anatomical_arm] + hp + ear(s)
        nails += [(o,s) for o in npieces]
    _skin_fields=[surface_tree(o) for o in [body]+arm_sources]
    skin=fuse_skin(skinpieces)
    print("MEDIC SOURCE: fused skin",len(skin.data.vertices),flush=True)
    weight_body(skin,rig)
    print("MEDIC SOURCE: skin weights",flush=True)
    uniform=sewn_uniform()
    for o in uniform:
        rk.uv_box(o)
        weight_body(o,rig)
        o["continuousSkin"]=False
        o["weightedTailoring"]=True
    contain_covered_arm_skin(skin,uniform)
    for s in (-1,1):
        pieces=trousers(s)
        pieces+=f.boot(s,V(ANKLE[s].x,ANKLE[s].y,.085),KNEE[s],11 if s<0 else 8)
        pieces+=boot_soles(s)
        for o in refine(pieces):
            kit.apply(o)
            kit.apply_transform(o)
            rk.uv_box(o)
            weight_leg(o,rig,s)
    print("MEDIC SOURCE: weighted clothing",flush=True)
    decorations=f.belt()+shirt_decorations()+satchel()
    decorations+=[f.hips(),f.inner_skirt()]
    for o in decorations:
        rk.uv_box(o)
        attach(o,rig,"torso")
    for s,suffix in ((-1,"L"),(1,"R")):
        for o in skirt_half(s):
            rk.uv_box(o)
            attach(o,rig,"skirt"+suffix)
    for o in f.armband(SHOULDER[-1],ELBOW[-1]):
        attach(o,rig,"armL")
    for o in hair():
        attach(o,rig,"hair" if "bun" in o.name else "head")
    for o in cap():
        attach(o,rig,"hat")
    attach_faces(face_details(),rig)
    for o,s in nails:
        attach(o,rig,"handL" if s<0 else "handR")
    for o in flask():
        rk.uv_box(o)
        attach(o,rig,"weapon")
    for o in kit.descendants(root):
        if o.type=="MESH":
            kit.shade(o,angle=48)
    materials()
    finish_ao(root,pigment=os.environ.get("MEDIC_SKIP_AO")!="1")
    print("MEDIC SOURCE: material finish",flush=True)
    for o in kit.descendants(root):
        if o.type=="MESH":
            for mod in o.modifiers:
                mod.show_viewport=True
    root["masterBrief"]="docs/concepts/2026-10-04-arena-viking-gladiator-medic/medic-source.md"
    root["unoptimized"]=True
    root["skinContract"]="continuous neck shoulders elbows palms; named Arena bones; linear weights"
    print("MEDIC MASTER",len(skin.data.vertices),"skin cage vertices",len(skin.data.polygons),"skin cage faces",flush=True)
    kit.refresh()
    return root
