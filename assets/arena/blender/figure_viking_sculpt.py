"""Authored Viking source forms, independent of every other Arena figure.

The dense surface is the editable master.  Runtime reduction is a separate
review-script operation, never a lower-quality branch of this sculpt.  Rings
follow anatomical/garment landmarks; locks use flowing tapered cross-sections
with combed grooves rather than rows of spheres.  All dimensions stay in the
original 1.36m miniature and two-hand grip coordinate system.
"""

import math
import os
from types import SimpleNamespace

import bpy
import kit
import figure_viking_kit as vk
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from figure_viking_kit import V, lerp, gauss, smooth, spow

F = None
HAIR_LIGHT = "hair:" + kit.tint("viking-copper-light", "#c77335")
HAIR_DARK = "hair:" + kit.tint("viking-copper-shadow", "#78381d")
FUR_LIGHT = "hair:" + kit.tint("viking-fur-tip", "#b5b2a7")
SEAM = "weave:" + kit.tint("viking-stitch", "#bdac8a")
NAIL = "skin:" + kit.tint("viking-nail", "#e5b397")


def configure(values):
    global F
    F = SimpleNamespace(**values)


def curve_table(rows, x):
    """Monotone Catmull-style interpolation, bounded to each landmark span."""
    if x <= rows[0][0]:
        return rows[0][1:]
    if x >= rows[-1][0]:
        return rows[-1][1:]
    for k, (a, b) in enumerate(zip(rows, rows[1:])):
        if x > b[0]:
            continue
        t = (x - a[0]) / (b[0] - a[0])
        before, after = rows[max(0, k - 1)], rows[min(len(rows) - 1, k + 2)]
        vals = []
        for j in range(1, len(a)):
            m0 = (b[j] - before[j]) / (b[0] - before[0]) * (b[0] - a[0])
            m1 = (after[j] - a[j]) / (after[0] - a[0]) * (b[0] - a[0])
            v = ((2*t**3 - 3*t*t + 1)*a[j] + (t**3 - 2*t*t + t)*m0 +
                 (-2*t**3 + 3*t*t)*b[j] + (t**3 - t*t)*m1)
            vals.append(max(min(a[j], b[j]), min(max(a[j], b[j]), v)))
        return tuple(vals)


def body(a, z, extra=0):
    w, front, back = curve_table(F.BODY, z)
    e = 2 / F.BODY_P
    s, c = math.sin(a), math.cos(a)
    # The costal arch and scapula remain readable through wool, with a
    # compressed waist above the belt and separate pectoral planes.
    x = (w + extra) * spow(s, e)
    y = ((front if c >= 0 else back) + extra) * spow(c, e)
    normal = V(s, c, 0)
    chest = .007*gauss(z, .88, .068)*gauss(abs(s), .48, .24)
    back_planes = .006*gauss(z, .916, .048)*gauss(abs(s), .44, .23)
    return V(x, y, z) + normal * (chest if c > 0 else back_planes)


def garment_folds(a, z):
    # Broad drape from each axilla, tension gathering above the belt,
    # softer vertical hanging creases.  No uniform corrugated tube.
    side = abs(math.sin(a))
    gathering = gauss(z, .681, .03)
    pull = gauss(side, .82, .16) * gauss(z, .826, .105)
    diagonal = 0
    if math.cos(a) > 0:
        angle = abs(a)
        # Broad tension folds run from the axilla down and inward to the
        # cinched waist. Negative valleys are paired with softer fold lips.
        track = lerp(math.radians(26), math.radians(68),
                     smooth(.685, .952, z))
        for off, amount in ((-.18, .0048), (0, .0065), (.18, .0041)):
            q = angle-track-off
            diagonal += (-amount*gauss(q, 0, .033) +
                         amount*.8*gauss(q, .063, .052))*gauss(z, .83, .139)
    else:
        diagonal = -.0035*gauss(abs(math.sin(a)), .82, .16)*gauss(z, .86, .12)
    return (.0036*math.sin(a*9 + .5)*gathering + diagonal +
            .0034*math.sin((z-.72)*67 + side*9)*pull +
            .0015*math.sin(a*7+.8)*smooth(.77, .68, z))


def tunic():
    rings = []
    n = 224
    for j in range(109):
        z = lerp(.49, 1.045, j/108)
        ring = []
        for i in range(n):
            a = i/n*math.tau
            ring.append(body(a, z, garment_folds(a, z) -
                             .008*smooth(.6, .56, z)))
        rings.append(ring)
    out = [vk.loft("viking-tunic-sculpt", rings, F.TEAM,
                   start=V(0, 0, .482), end=V(0, 0, 1.05))]
    collar = [[body(i/96*math.tau, z, off) for i in range(96)]
              for z, off in ((1.003, 0), (1.007, .003), (1.018, .005),
                             (1.031, .004), (1.035, -.002))]
    out.append(vk.loft("viking-woven-neck-edge", collar, F.TRIM))
    # Woven neck construction with one tiny visible running stitch.
    for k in range(36):
        a = k/36*math.tau
        pts = [body(a + d, 1.012, .0056) for d in (-.012, .012)]
        out.append(vk.tube(f"viking-neck-stitch{k}", pts, [.0009]*2,
                           SEAM, n=4, caps=("dome", "dome")))
    # A restrained stitched side seam makes the garment's construction
    # explicit and ties its waist tension to the shoulder/axillary line.
    for sx in (-1, 1):
        pts = [body(sx*math.radians(89), lerp(.674, .972, j/45), .0017)
               for j in range(46)]
        out.append(vk.tube(f"viking-tunic-side-seam{sx}", pts, [.0013]*46,
                           F.TEAM, n=6, caps=("dome", "dome")))
    return out


class SculptedHead(vk.Head):
    """Weathered adult facial planes, a broad jaw and compressed eye sockets."""

    def point(self, ad, z):
        w, = curve_table(F.FACE_W, z)
        front, = curve_table(F.FACE_D, z)
        back, = curve_table(F.BACK_D, z)
        a = math.radians(ad)
        e = 2/self.power
        s, c = math.sin(a), math.cos(a)
        x, y = w*spow(s, e), (front if c >= 0 else back)*spow(c, e)
        dd = front if c >= 0 else back
        n = V(spow(x/w, self.power-1)/w if x else 0,
              spow(y/dd, self.power-1)/dd if y else 0, 0).normalized()
        d = F.face_disp(ad, z)
        aa = abs(ad)
        # Cheekbone ridge, nasolabial compression, forehead crease and
        # crow's feet are asymmetric and tied to the expression.
        d += .0038*gauss(aa, 46, 10)*gauss(z, 1.145, .008)
        d -= .0015*gauss(aa, 19+(1.13-z)*320, 2.8)*gauss(z, 1.12, .021)
        d -= .0009*gauss(z, 1.189+.0015*math.cos(a*5), .0016)*gauss(ad, 0, 48)
        d -= .0008*gauss(aa, 46, 8)*gauss(z, 1.157-.0002*(aa-39), .0017)
        d += .0018*gauss(aa, 14, 4)*gauss(z, 1.113, .004)
        return V(x, self.cy+y, z) + n*d

    def skull(self, skin, hair, hairline=None, top=1.268):
        cols = [i/128*360-180 for i in range(128)]
        zs = [lerp(1.0, 1.264, j/105) for j in range(106)]
        mesh = vk.Mesh("viking-weathered-skull", skin)
        rings = [[mesh.v(self.point(a, z)) for a in cols] for z in zs]
        def paint(i, j):
            a = cols[i]+360/256
            a = a-360 if a > 180 else a
            return hair if hairline and (zs[j]+zs[j+1])/2 > hairline(a) else skin
        mesh.grid(rings, paint, closed=True)
        mesh.fan(rings[0], V(0, .012, .994), skin, flip=True)
        mesh.fan(rings[-1], V(0, .005, top), hair)
        return mesh.obj(recalc=True)

    def ears(self, skin, z=1.142):
        out = []
        for sx in (-1, 1):
            p = self.point(sx*90, z) + V(sx*.004, -.008, 0)
            # Conchal bowl, helical rim and tragus with adult proportions.
            ear = vk.ball(f"viking-ear-base{sx}", 1, p, skin,
                          scale=(.010, .017, .026), seg=28, rings=16)
            out.append(ear)
            curve = []
            for k in range(34):
                a = lerp(-.65, 4.45, k/33)
                curve.append(p + V(sx*(.0085+.002*math.cos(a)),
                                   math.sin(a)*.014, math.cos(a)*.022))
            out.append(vk.tube(f"viking-ear-helix{sx}", curve, [.0022]*34,
                               skin, n=8, caps=("dome", "dome")))
            out.append(vk.ball(f"viking-ear-tragus{sx}", .003,
                               p+V(sx*.010, .011, -.005), skin,
                               scale=(1, 1, 1.8), seg=16, rings=8))
        return out


def bezier(points, t):
    arr = [Vector(p) for p in points]
    while len(arr) > 1:
        arr = [lerp(a, b, t) for a, b in zip(arr, arr[1:])]
    return arr[0]


def lock_path(name, path, width, mat, normal=(0, 1, 0), depth=.45, n=12,
              rooted=False):
    """A flowing closed lock whose centre follows an authored surface."""
    rings = []
    for k, p in enumerate(path):
        t = k/(len(path)-1)
        tangent = path[min(len(path)-1, k+1)]-path[max(0, k-1)]
        out, side = vk.frame_at(tangent, normal)
        w = width*(.55+.48*math.sin(t*math.pi*.9))*(1-t**4)+.0006
        if rooted:
            w *= .15+.85*smooth(0, .12, t)
        ring = []
        for j in range(n):
            a = j/n*math.tau
            # Channels follow the flow of hair, strongest on its visible face.
            ridge = 1 + .11*math.cos(a*5+t*.6)*max(0, math.cos(a))
            ring.append(p+side*(math.sin(a)*w)+out*(math.cos(a)*w*depth*ridge))
        rings.append(ring)
    return vk.loft(name, rings, mat, start="pole", end="pole")


def lock(name, controls, width, mat, normal=(0, 1, 0), depth=.45, n=12):
    """A single broad flowing lock with combed relief, closed tapered tips."""
    return lock_path(name, [bezier(controls, k/18) for k in range(19)],
                     width, mat, normal=normal, depth=depth, n=n)


def union_hair(objs, name):
    """Author coherent hair volumes while retaining the sculpt guides."""
    if os.environ.get("VIKING_ARCHIVE"):
        archive = bpy.data.collections.get("Viking beard sculpt guides")
        if archive is None:
            archive = bpy.data.collections.new("Viking beard sculpt guides")
            bpy.context.scene.collection.children.link(archive)
            archive.hide_render = True
            archive.hide_viewport = True
        for ob in objs:
            guide = ob.copy()
            guide.data = ob.data.copy()
            guide.name = ob.name+".guide"
            archive.objects.link(guide)
    ob = kit.join(objs, name)
    faces = [tuple(p.vertices) for p in ob.data.polygons]
    original_materials = [p.material_index for p in ob.data.polygons]
    tree = BVHTree.FromPolygons([v.co.copy() for v in ob.data.vertices], faces)
    remesh = ob.modifiers.new("Continuous authored jaw and locks", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = .0008
    remesh.use_smooth_shade = True
    kit.apply(ob)
    finish = ob.modifiers.new("Soft hair-root transitions", "SMOOTH")
    finish.factor, finish.iterations = .4, 2
    kit.apply(ob)
    for poly in ob.data.polygons:
        point = sum((ob.data.vertices[i].co for i in poly.vertices), V(0, 0, 0))/len(poly.vertices)
        _, _, index, _ = tree.find_nearest(point)
        poly.material_index = original_materials[index] if index is not None else 0
    return ob


def beard():
    out, cheek, hanging = [], [], []
    cols = [lerp(-82, 82, i/64) for i in range(65)]
    def grow(a, z):
        return (.006+.01*smooth(1.13, 1.025, z)+
                .0009*math.sin(math.radians(a)*31+z*56))
    def cheek_surface(a, t):
        z = lerp(1.019, vk.table(F.BEARD_TOP, abs(a)), t)
        return F.HEAD.point(a, z)+F.HEAD.normal(a, z)*grow(a, z)
    cheek.append(vk.sheet("viking-beard-cheek-root", cheek_surface, cols,
                           [j/30 for j in range(31)], F.GINGER,
                           rim=.008, back=True, inside=F.HC))
    # The mass sits directly beneath the chin. Its rear edge returns to
    # the throat, while the front projects only slightly beyond the nose.
    # Relief locks sit *on* this surface rather than getting buried in it.
    prof = [( .891, .097, .021, .019), (.919, .101, .047, .032),
            (.958, .095, .071, .047), (.994, .079, .079, .048),
            (1.034, .058, .070, .045), (1.055, .043, .064, .048),
            (1.077, .030, .058, .049)]
    rings = []
    for k in range(65):
        z = lerp(.891, 1.077, k/64)
        cy, rx, ry = curve_table(prof, z)
        rings.append([V(rx*math.sin(a)*(1+.027*math.sin(a*13+z*29)),
                        cy+ry*math.cos(a)*(1+.035*math.sin(a*17+z*11)), z)
                      for a in (i/80*math.tau for i in range(80))])
    hanging.append(vk.loft("viking-beard-mass", rings, F.GINGER,
                           start=V(0, .097, .885), end="pole"))
    # Interleaved authored locks follow the jaw down into a broad cleft beard.
    for k in range(23):
        a = lerp(-76, 76, k/22)
        z0 = vk.table(F.BEARD_TOP, abs(a))-.005
        flank = abs(math.sin(math.radians(a)))
        z1 = .877 + .063*flank**1.7 + .016*math.sin(k*1.8)**2
        path = []
        for j in range(37):
            t = j/36
            z = lerp(z0, z1, t)
            aa = math.radians(a + 3.2*math.sin(t*math.pi)*math.sin(k*1.2))
            cy, rx, ry = curve_table(prof, z)
            mass = V(rx*math.sin(aa), cy+ry*math.cos(aa), z)
            skin = F.HEAD.point(math.degrees(aa), max(1.0, z))
            skin += F.HEAD.normal(math.degrees(aa), max(1.0, z))*.010
            skin.z = z
            p = lerp(skin, mass, smooth(1.060, 1.019, z))
            p += V(math.sin(aa), math.cos(aa), 0)*(.002+.005*math.sin(t*math.pi))
            if z < .901:
                p.y -= (.901-z)*.25
            path.append(p)
        width = .0095+.0035*math.cos(k*.7)**2
        material = HAIR_LIGHT if k%7 == 2 else F.GINGER
        high = [p for p in path if p.z >= 1.025]
        low = [p for p in path if p.z <= 1.060]
        if len(high) > 1:
            cheek.append(lock_path(f"viking-beard-cheek-flow{k}", high,
                                    width, material, depth=.85, n=16, rooted=True))
        if len(low) > 1:
            hanging.append(lock_path(f"viking-beard-flow{k}", low,
                                      width, material, depth=.85, n=16, rooted=True))
    # Shorter rounded locks wrap each jaw flank into the long front mass.
    for sx in (-1, 1):
        for k in range(7):
            ad = sx*(37+k*6)
            z = vk.table(F.BEARD_TOP, abs(ad))-.008
            p = F.HEAD.point(ad, z)+F.HEAD.normal(ad, z)*.009
            jaw = F.HEAD.point(ad, 1.053)+F.HEAD.normal(ad, 1.053)*.018
            controls = [p, jaw, V(sx*.078, .075+k*.002, 1.004),
                        V(sx*(.065-k*.001), .105+k*.002, .971-k*.003)]
            cheek.append(lock(f"viking-beard-cheek-jaw{sx}-{k}", controls,
                              .0125, F.GINGER if k%3 else HAIR_LIGHT,
                              normal=(sx*.5, 1, .12), depth=.85, n=16))
    out += [union_hair(cheek, "viking-beard-cheek-connected"),
            union_hair(hanging, "viking-beard-continuous-locks")]
    # Three continuous interwoven strands per braid, genuinely crossing.
    for sx in (-1, 1):
        for strand in range(3):
            path, rs = [], []
            for k in range(65):
                t = k/64
                a = t*math.tau*3.4+strand*math.tau/3
                path.append(V(sx*(.037+t*.009)+math.sin(a)*.0075,
                              .142+.036*smooth(0, .52, t)+math.cos(a)*.0065,
                              .929-.149*t))
                rs.append((.0057*(1-.24*t), .0046*(1-.15*t)))
            out.append(vk.tube(f"viking-braid-strand{sx}-{strand}", path,
                               rs, F.GINGER if strand != 1 else HAIR_LIGHT,
                               n=10, up=(0, 1, 0), caps=("dome", "dome")))
        bead = V(sx*.046, .178, .791)
        ring = [[bead+V(math.sin(a)*r, math.cos(a)*r, z)
                 for a in (i/24*math.tau for i in range(24))]
                for z, r in ((-.012, .014), (-.009, .017), (.009, .017), (.012, .014))]
        out.append(vk.loft(f"viking-braid-band{sx}", ring, F.BRONZE))
        for k in range(5):
            p = bead+V((k-2)*.004, .003, -.016)
            out.append(lock(f"viking-braid-end{sx}-{k}",
                            [p, p+V(sx*.004, .001, -.016),
                             p+V(sx*.004, .005, -.041-(k%2)*.005)],
                            .0045, F.GINGER, depth=.6, n=8))
    for sx in (-1, 1):
        for k in range(5):
            pts = [F.HEAD.point(sx*a, z-k*.002)+F.HEAD.normal(sx*a, z)*off
                   for a, z, off in ((2, 1.104, .007), (10, 1.101, .011),
                                      (23, 1.084, .013), (33, 1.064, .013))]
            out.append(lock(f"viking-stache-flow{sx}-{k}", pts,
                            .0037, HAIR_LIGHT if k == 0 else F.GINGER,
                            depth=.62, n=8))
    return out


def nape():
    out = []
    for k in range(19):
        a = lerp(107, 253, k/18)
        p = F.HEAD.point(a, 1.175)+F.HEAD.normal(a, 1.175)*.004
        end = F.HEAD.point(a, 1.063)+F.HEAD.normal(a, 1.063)*.012-V(0, 0, .017*(k%3))
        mid = lerp(p, end, .5)+F.HEAD.normal(a, 1.1)*.022
        out.append(lock(f"viking-nape-lock{k}", [p, mid, end], .009,
                        F.GINGER if k%4 else HAIR_LIGHT,
                        normal=F.HEAD.normal(a, 1.12), depth=.42))
    return out


def fur():
    # A pelt's connected backing drapes over trapezius and deltoids.  Its
    # outer edge is scalloped with pointed fibres, rather than a lumpy torus.
    def pt(a, t):
        front = max(0, math.cos(a))
        side = abs(math.sin(a))
        rx = lerp(.09, .247, t)
        ry = lerp(.075, .163, t)
        z = 1.055 - .09*t + .018*side*t - .025*front*t
        z += .011*math.sin(min(1, t)*math.pi)
        z -= .009*math.sin(a*13+.3)**2*t**5
        return V(math.sin(a)*rx, math.cos(a)*ry, z)
    mantle = vk.Mesh("viking-fur-padded-mantle", F.FUR)
    top, underside = [], []
    for j in range(17):
        t = j/16
        thick = .006+.022*math.sin(t*math.pi)**.7
        points = [pt(lerp(math.radians(40), math.radians(320), i/100), t)
                  for i in range(101)]
        top.append([mantle.v(p) for p in points])
        underside.append([mantle.v(p-V(0, 0, thick)) for p in points])
    mantle.grid(top, F.FUR)
    mantle.grid(underside, F.FUR, flip=True)
    mantle.grid([underside[0], top[0]], F.FUR)
    mantle.grid([top[-1], underside[-1]], F.FUR)
    for j in range(16):
        for i in (0, 100):
            mantle.face((top[j][i], top[j+1][i], underside[j+1][i], underside[j][i]))
    out = [mantle.obj(recalc=True)]
    for row in range(4):
        count = 47-row*4
        for k in range(count):
            a = lerp(math.radians(42), math.radians(318), (k+.5*(row%2))/(count-1))
            t0 = .11+row*.215
            p = pt(a, t0)+V(0, 0, .008)
            mid = pt(a+.022*math.sin(k), t0+.12)+V(0, 0, .013)
            end = pt(a+.032*math.sin(k*.7), min(1.1, t0+.30+.05*math.sin(k*1.71))) - V(0, 0, .009)
            out.append(lock(f"viking-pelt-lock{row}-{k}", [p, mid, end],
                            .0043+.0019*math.sin(k*1.8)**2,
                            FUR_LIGHT if (k+row)%7 == 0 else F.FUR,
                            normal=(0, 0, 1), depth=1.16, n=12))
            if k%3 == 1:
                out.append(lock(f"viking-pelt-split-tip{row}-{k}",
                                [mid, lerp(mid, end, .5)+V(.003, 0, .003),
                                 end+V(.004*math.cos(a), -.004*math.sin(a), -.006)],
                                .0026, F.FUR, normal=(0, 0, 1), depth=.9, n=8))
    return out


def sleeve(side, s, e, w, sx):
    up, fo = (e-s).normalized(), (w-e).normalized()
    cuff = lerp(e, w, .25)
    path, rs = [], []
    for k in range(33):
        t = k/32
        if t < .76:
            tt = t/.76
            p = lerp(s + V(-sx*.028, 0, .007), e, tt)
            p += V(-sx*.009, .006, .006)*math.sin(tt*math.pi)
        else:
            p = lerp(e, cuff, (t-.76)/.24)
        # Convex deltoid to upper-arm taper, folded sleeve at the elbow.
        r, = curve_table([(0, .040), (.09, .056), (.22, .064), (.42, .063),
                          (.65, .058), (.79, .059), (1, .057)], t)
        path.append(p)
        rs.append((r, r*.94))
    arm = vk.tube(f"viking-sleeve-sculpt{side}", path, rs, F.TEAM, n=40,
                  up=(0, 1, 0), caps=("dome", None))
    # Compression creases radiate from the bent inner elbow.
    for v in arm.data.vertices:
        d = (v.co-e).length
        axis = v.co-e-fo*(v.co-e).dot(fo)
        if axis.length and d < .097:
            a = math.atan2(axis.dot(V(0, 1, 0)), axis.dot(V(sx, 0, 0)))
            v.co += axis.normalized()*.0034*math.sin(d*137+a*.65)*gauss(d, .055, .036)
    kit.add_subsurf(arm, 1)
    kit.apply(arm)
    upper = [arm]
    cuff_path = [cuff-fo*.022, cuff-fo*.018, cuff+fo*.004, cuff+fo*.007]
    upper.append(vk.tube(f"viking-cuff-edge{side}", cuff_path,
                         [.059, .061, .061, .058], F.TRIM, n=40,
                         caps=(None, None)))
    lower_path, lower_rs = [], []
    for k in range(25):
        t = k/24
        p = lerp(e-fo*.018, w+fo*.012, t)
        r = vk.table([(0, .049), (.22, .053), (.46, .052),
                      (.73, .043), (1, .032)], t)
        lower_path.append(p)
        lower_rs.append((r, r*.9))
    lower = [vk.tube(f"viking-forearm-sculpt{side}", lower_path, lower_rs,
                     F.SKIN, n=40, up=(0, 1, 0), caps=("dome", None))]
    b0 = lerp(cuff, w, .37)
    bracer = vk.tube(f"viking-bracer-panel{side}",
                     [b0, lerp(b0, w, .42), w+fo*.006],
                     [(.053, .050), (.046, .043), (.0345, .032)],
                     F.LEATHER, n=32, up=(0, 1, 0),
                     caps=(None, None))
    lower.append(bracer)
    # Bound leather edges and actual crossed lacings over the bracer seam.
    for t in (.06, .91):
        c = lerp(b0, w, t)
        r = lerp(.054, .035, t)
        lower.append(vk.tube(f"viking-bracer-edge{side}-{t}", [c-fo*.004, c+fo*.004],
                             [(r, r*.93), (r, r*.93)], F.LEATHER,
                             n=32, up=(0, 1, 0)))
    seam_axis, seam_side = vk.frame_at(fo, V(sx, .4, 0))
    for k in range(5):
        t = .12+k*.14
        c = lerp(b0, w, t)
        r = lerp(.053, .035, t)
        for sign in (-1, 1):
            pts = [c+seam_axis*r+seam_side*.011*sign,
                   c+fo*.018+seam_axis*(r-.001)-seam_side*.011*sign]
            lower.append(vk.tube(f"viking-bracer-lace{side}-{k}-{sign}", pts,
                                 [.0018]*2, SEAM, n=5, caps=("dome", "dome")))
    return upper, lower


def gripping_hand(side, c, xax, kax, chir):
    """Palm plus four bent fingers around the *actual* 39mm axe shaft.

    Local z follows the pole; x faces the curled fingertips and local y is
    the back of the knuckles.  The central bore is left empty.  Finger pads
    contact the shaft at radius .0205 without a solid fist swallowing it.
    """
    out, nails = [], []
    # Palm has a wedge shaped metacarpal fan and fleshy thenar eminence.
    rings = []
    for z, k in ((-.037, .74), (-.031, .92), (-.012, 1), (.013, 1.06), (.032, .96), (.039, .73)):
        pts = []
        for i in range(32):
            a = i/32*math.tau
            pts.append(V(-.039+math.cos(a)*.017*k,
                         .003+math.sin(a)*.027*k, z))
        rings.append(pts)
    out.append(vk.loft(f"viking-hand-palm{side}", rings, F.SKIN,
                       start="pole", end="pole"))
    for finger in range(4):
        z = -.026+finger*.017
        # Proximal, intermediate and distal phalanges make a C round the
        # haft, with a flattened finger pad tangent to the shaft at the tip.
        pts = [V(-.03, .019, z), V(-.018, .027, z), V(.001, .029, z),
               V(.021, .019, z), V(.028, -.001, z), V(.016, -.023, z)]
        path = [bezier(pts, t/36) for t in range(37)]
        radii = [vk.table([(0, .0096), (.23, .0101), (.48, .0082),
                          (.70, .0088), (1, .0069)], t/36) for t in range(37)]
        for p, radius in zip(path, radii):
            radial = math.hypot(p.x, p.y)
            contact = .0205 + radius
            if radial < contact:
                p.x, p.y = p.x*contact/radial, p.y*contact/radial
        out.append(vk.tube(f"viking-hand-finger{side}-{finger}", path, radii,
                           F.SKIN, n=16, up=(0, 0, 1), caps=("dome", "dome")))
        # A shallow rounded nail follows its distal phalanx; no square
        # plate is pasted onto the end of a straight finger tube.
        at = path[-5]
        normal = V(at.x, at.y, 0).normalized()
        tangent = (path[-1]-path[-9]).normalized()
        long = (tangent-normal*tangent.dot(normal)).normalized()
        matrix = vk.basis(V(0, 0, 1), normal, long, at+normal*.0082)
        nail = vk.ball(f"viking-hand-nail{side}-{finger}", 1, V(0, 0, 0),
                       NAIL, scale=(.0053, .0009, .0061), seg=24, rings=12)
        vk.transform([nail], matrix)
        nails.append(nail)
    thumb_pts = [V(-.034, -.015, .006), V(-.031, -.025, .019),
                 V(-.008, -.032, .035), V(.015, -.017, .042)]
    path = [bezier(thumb_pts, t/24) for t in range(25)]
    for k, p in enumerate(path):
        radial = math.hypot(p.x, p.y)
        contact = .0205+lerp(.012, .0078, k/24)
        if radial < contact:
            p.x, p.y = p.x*contact/radial, p.y*contact/radial
    out.append(vk.tube(f"viking-hand-thumb{side}", path,
                       [lerp(.012, .0078, t/24) for t in range(25)], F.SKIN,
                       n=14, up=(0, 0, 1), caps=("dome", "dome")))
    # Thenar pad and the thumb web blend into the palm instead of leaving
    # the thumb as an isolated torus crossing four ring-like fingers.
    out.append(vk.ball(f"viking-hand-thenar{side}", 1,
                       V(-.041, -.018, .020), F.SKIN,
                       scale=(.011, .017, .020), seg=28, rings=16))
    out.append(vk.ball(f"viking-hand-thumb-web{side}", 1,
                       V(-.033, -.023, .020), F.SKIN,
                       scale=(.014, .011, .017), seg=28, rings=16))
    out.append(vk.tube(f"viking-hand-wrist{side}",
                       [V(-.058, .001, -.003), V(-.043, .001, 0), V(-.028, .001, .001)],
                       [(.023, .028), (.024, .028), (.020, .028)], F.SKIN,
                       n=24, up=(0, 1, 0), caps=("flat", None)))
    # Join the metacarpals, finger roots, thumb web and wrist into an
    # actual continuous anatomical surface. Guides remain editable in the
    # source master; remeshing only authors the source, never reduces it.
    if os.environ.get("VIKING_ARCHIVE"):
        archive = bpy.data.collections.get("Viking hand sculpt guides")
        if archive is None:
            archive = bpy.data.collections.new("Viking hand sculpt guides")
            bpy.context.scene.collection.children.link(archive)
            archive.hide_render = True
            archive.hide_viewport = True
        for ob in out:
            guide = ob.copy()
            guide.data = ob.data.copy()
            guide.name = ob.name+".guide"
            guide["jointPart"] = "hand"+side
            archive.objects.link(guide)
    skin = kit.join(out, f"viking-continuous-grip{side}")
    remesh = skin.modifiers.new("Authored continuous palm and thumb web", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = .00085
    remesh.use_smooth_shade = True
    kit.apply(skin)
    finish = skin.modifiers.new("Soft anatomical transitions", "SMOOTH")
    finish.factor, finish.iterations = .55, 3
    kit.apply(skin)
    # The haft remains a physical empty bore after the union and finish.
    # Only vertices along the four finger pads may contact its surface.
    for v in skin.data.vertices:
        radial = math.hypot(v.co.x, v.co.y)
        if radial < .0206:
            v.co.x *= .0206/max(radial, .0001)
            v.co.y *= .0206/max(radial, .0001)
    out = [skin]+nails
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    vk.transform(out, vk.basis(xax, kax, xax.cross(kax)*chir, c))
    return out


def legs(sx):
    hip = V(sx*F.HIP_X, 0, F.HIP_Z)
    knee = V(sx*.112, .012, .36)
    ankle = V(sx*.122, -.004, .09)
    # Broad thigh and calf shapes support a grounded adult warrior.  The
    # trouser cuff overlaps a rounded wrapped knee throughout the full gait.
    rings = []
    for k in range(38):
        t = k/37
        p = lerp(hip+V(0, 0, .015), knee-V(0, 0, .026), t)
        r = vk.table([(0, .061), (.19, .083), (.42, .087), (.68, .081),
                      (.9, .077), (1, .07)], t)
        ring = []
        for i in range(56):
            a = i/56*math.tau
            fold = .0028*math.sin(a*7+t*5)*smooth(.6, 1, t)
            fold += .003*math.sin(t*39+a)*gauss(t, .86, .18)
            ring.append(p+V(math.sin(a)*(r+fold), math.cos(a)*(r*.97+fold), 0))
        rings.append(ring)
    thigh = [vk.loft(f"viking-trouser-shaped{sx}", rings, F.TROUSER,
                     start="pole", end="pole")]
    # Knee overlap is shaped by the cuff and bands; it is not a visible
    # generic spherical hinge.  Closely spaced rings keep the wrap edges.
    rings = []
    for k in range(81):
        t = k/80
        z = lerp(.078, .397, t)
        c = lerp(ankle, knee, (z-ankle.z)/(knee.z-ankle.z))
        r = vk.table([(.078, .041), (.13, .048), (.21, .061),
                      (.285, .068), (.36, .062), (.397, .037)], z)
        rings.append([c+V(math.sin(a)*(r+.0021*math.cos(z*math.tau/.028+a*.18)),
                          math.cos(a)*(r*.93+.0021*math.cos(z*math.tau/.028+a*.18)), z-c.z)
                      for a in (i/48*math.tau for i in range(48))])
    shin = [vk.loft(f"viking-calf-wrap-shaped{sx}", rings, F.WRAP,
                    start="pole", end="pole")]
    for hand in (-1, 1):
        pts = []
        for k in range(121):
            t = k/120
            z = lerp(.116, .357, t)
            c = lerp(ankle, knee, (z-ankle.z)/(knee.z-ankle.z))
            r = vk.table([(.078, .041), (.13, .048), (.21, .061),
                          (.285, .068), (.36, .062)], z)+.004
            a = hand*t*math.tau*2.5 + (0 if hand > 0 else math.pi)
            pts.append(V(c.x+math.sin(a)*r, c.y+math.cos(a)*r*.94, z))
        shin.append(vk.tube(f"viking-wrap-binding{sx}-{hand}", pts, [.0024]*121,
                            F.DARK, n=6, caps=("dome", "dome")))
    foot = F.shoe(sx, ankle, 11 if sx < 0 else 8)
    # Original authored boot profile is subdivided, preserving soles and
    # toe shape.  Long instep seams remain legible at the same game scale.
    for ob in foot:
        if "shoe" in ob.name or "cuff" in ob.name:
            kit.add_subsurf(ob, 2)
            kit.apply(ob)
    return thigh, shin, foot, hip, knee, ankle


def axe():
    out = []
    # Authored ash haft: a soft oval cross-section and shallow longitudinal
    # grain, no generic low-sided pole.  Shaft passes through a hollow eye.
    rings = []
    for k in range(81):
        t = k/80
        y = lerp(-.087, F.HEAD_AT+.055, t)
        r = .0193+.0012*math.sin(t*math.pi)
        rings.append([V(math.cos(a)*(r+.00035*math.sin(a*7+y*5)), y,
                        math.sin(a)*(r*.91+.00032*math.sin(a*7+y*5)))
                      for a in (i/40*math.tau for i in range(40))])
    out.append(vk.loft("viking-axe-ash-grain", rings, F.WOOD,
                       start="pole", end="pole"))
    for k in range(7):
        path = []
        for j in range(20):
            y = lerp(.036+k*.027, .06+k*.027, j/19)
            a = j/19*math.tau
            path.append(V(math.sin(a)*.023, y, math.cos(a)*.021))
        out.append(vk.tube(f"viking-axe-grip-binding{k}", path,
                           [(.0027, .006)]*20, F.LEATHER, n=6,
                           caps=("dome", "dome")))
    out.append(vk.tube("viking-axe-butt-cap", [V(0, -.096, 0), V(0, -.063, 0)],
                       [.0235, .022], F.BRONZE, n=32, caps=("dome", "flat")))
    h = F.HEAD_AT
    # The forged socket's thick eye encloses the wood but has no end caps.
    rings = []
    for y, k in ((h-.056, .91), (h-.05, 1), (h-.025, 1.12),
                  (h+.025, 1.12), (h+.05, 1), (h+.056, .91)):
        ring = []
        for i in range(48):
            a = i/48*math.tau
            x, z = .028*math.cos(a), .025*math.sin(a)
            x -= .014*max(0, -math.cos(a))**4
            ring.append(V(x+.004, y, z)*1 if k == 1 else V((x+.004)*k, y, z*k))
        rings.append(ring)
    inner = [[V(math.cos(a)*.0205, y, math.sin(a)*.0192)
              for a in (i/48*math.tau for i in range(48))]
             for y in (h+.056, h-.056)]
    out.append(vk.loft("viking-axe-hollow-eye", rings+inner+[rings[0]], F.IRON))
    rings = []
    for j in range(73):
        w = lerp(.08, -.205, j/72)
        if w > .03:
            u0 = .03+((w-.03)/.05)**.45*.18
        elif w < -.03:
            u0 = .03+.095*((-.03-w)/.175)**2
        else:
            u0 = .03
        t = (.08-w)/.285
        u1 = .235+.02*math.sin(math.pi*t*.8)-.12*smooth(.45, 1, t)**1.3
        u1 = max(u0+.012, u1)
        # Very small chips confined to the working edge, not a saw tooth.
        u1 -= .0012*gauss(w, -.035, .006)+.001*gauss(w, -.109, .004)
        ub = max(lerp(u0, u1, .62), u1-.024)
        thick = .013 if -.03 <= w <= .03 else .01
        pts = [(u0, thick), (lerp(u0, u1, .18), .010),
               (lerp(u0, u1, .4), .0082), (ub, .0053),
               (lerp(ub, u1, .6), .0024), (u1, .00035),
               (u1, -.00035), (lerp(ub, u1, .6), -.0024),
               (ub, -.0053), (lerp(u0, u1, .4), -.0082),
               (lerp(u0, u1, .18), -.010), (u0, -thick), (u0-.004, 0)]
        rings.append([V(u, h+w, z) for u, z in pts])
    out.append(vk.loft("viking-axe-forged-bearded-blade", rings, F.IRON,
                       bands=lambda i, j: F.EDGE if 3 <= i <= 7 else None,
                       start="pole", end="pole"))
    for dy in (-.028, .028):
        for sign in (-1, 1):
            out.append(vk.ball(f"viking-axe-eye-rivet{dy}-{sign}", .0046,
                               V(.004, h+dy, sign*.028), F.BRONZE,
                               scale=(1, 1, .6), seg=20, rings=10))
    # Fine fullering follows the blade's neck into its face.
    for sign in (-1, 1):
        pts = [V(.042, h-.025, sign*.012), V(.085, h-.04, sign*.0093),
               V(.131, h-.067, sign*.0079)]
        out.append(vk.tube(f"viking-axe-fuller{sign}", pts,
                           [.0014, .0012, .0007], F.IRON, n=6,
                           caps=("dome", "dome")))
    return out


def prepare_materials():
    """Distinct source microfinish; encoded family names survive export."""
    for mat in bpy.data.materials:
        bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
        if not bsdf:
            continue
        family = mat.name.split(":")[0]
        if family in ("skin", "hair", "weave", "hide"):
            bsdf.inputs["Roughness"].default_value = {
                "skin": .69, "hair": .7, "weave": .91, "hide": .65}[family]
            bsdf.inputs["Specular IOR Level"].default_value = .25
        if family == "gilt":
            bsdf.inputs["Roughness"].default_value = .39
            bsdf.inputs["Metallic"].default_value = .78
        # Exact runtime base finish also travels as documented metadata.
        mat["vikingSourceRoughness"] = bsdf.inputs["Roughness"].default_value
        mat["authoredGeometryDetail"] = True


def skirt(sx):
    """Heavy wool skirt panels with broad vertical drape and a bound hem."""
    def point(u, v):
        a = math.radians(lerp(4, 176, u))*sx
        z = lerp(.586, .43, v)-.012*max(0, -math.cos(a))*v
        p = F.ring_point([(.58, .15, .124, .114)]*2, F.BODY_P, a, .58,
                         .006+.004*sx)
        k = V(p.x*(1+.5*v**.9), p.y*(1+.38*v**.9), 0)
        fold = (.0065*math.sin(9*a+1.3)+.0017*math.sin(17*a+.6))*v
        fold += .0018*math.sin(v*9+a*6)*v
        angle = abs(a)
        # The thigh presses into the cloth while the belt pins its upper
        # edge. Broad diagonal valleys and adjacent rounded folds carry
        # that tension across the whole panel, including its front plane.
        track = .27+.20*v
        fold += (-.012*gauss(angle, track, .070) +
                 .010*gauss(angle, track+.12, .11))*math.sin(v*math.pi)
        fold += .015*gauss(angle, .65, .22)*gauss(v, .58, .31)
        fold += .0055*math.sin(angle*7+v*9)*gauss(v, .20, .15)
        z -= .004*math.cos(angle*10+.5)*v*v
        k += V(math.sin(a), math.cos(a), 0)*fold
        return V(k.x, k.y, z)
    return [vk.sheet(f"viking-skirt-drape{sx}", point,
                     [i/44 for i in range(45)], [j/28 for j in range(29)],
                     lambda i, j: F.TRIM if j >= 25 else F.TEAM,
                     rim=.005, back=True, rim_mat=F.TEAM,
                     inside=V(sx*.05, 0, .5))]
