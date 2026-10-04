"""Building helpers for Rota's painted resin buildings (buildings.py).

Every helper writes its geometry straight into world-space mesh data (the
object stays at the identity), so parts can be built on a wall frame and
joined without bookkeeping. A `Build` collects the parts of one asset, the
cutters that carve window and door recesses out of its wall bodies, and
finishes into one joined, UV-mapped mesh under the asset's root empty.

Walls carry `Wall` frames: local x runs along the wall (left to right seen
from outside), local y points into the wall, z is up, and the frame's
origin sits on the wall surface at z = 0.
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

import rkit

kit = rkit.kit
Z = Vector((0, 0, 1))
EDGE = 0.035          # AO grid spacing on flat faces (rkit.AO_EDGE)


# ---------------------------------------------------------------- meshes

def mesh(name, verts, faces, mat=None, fix=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        kit.assign(obj, mat)
    if fix:
        _fix_normals(obj)
    return obj


def pane(name, pts, y, mat=None):
    """One flat face facing -y (an outline listed counterclockwise as
    seen from the front)."""
    return mesh(name, [(x, y, z) for x, z in pts], [list(range(len(pts)))],
                mat, fix=False)


def _fix_normals(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


def tf(obj, m):
    """Apply a matrix to an object's mesh data."""
    obj.data.transform(m)
    obj.data.update()
    return obj


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def T(x, y=0.0, z=0.0):
    return Matrix.Translation(Vector((x, y, z)))


def gbox(name, size, centre=(0, 0, 0), mat=None, edge=EDGE, bevel=0.0,
         seg=2, grid=True):
    """A box gridded per axis so baked AO has vertices on every face."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if grid and edge:
        for ax in range(3):
            s = size[ax]
            n = max(1, math.ceil(s / edge - 0.15))
            for i in range(1, n):
                co = Vector((0, 0, 0))
                co[ax] = -s / 2 + s * i / n
                no = Vector((0, 0, 0))
                no[ax] = 1
                geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
                bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co,
                                       plane_no=no)
    bmesh.ops.translate(bm, vec=Vector(centre), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        kit.assign(obj, mat)
    if bevel:
        kit.add_bevel(obj, bevel, seg)
    return obj


def box(name, size, centre=(0, 0, 0), mat=None, bevel=0.0, seg=1):
    """A plain 12-triangle box for small parts."""
    return gbox(name, size, centre, mat, edge=0, bevel=bevel, seg=seg,
                grid=False)


def body(name, w, d, hw, rise=0.0, ridge="x", centre=(0, 0), mat=None,
         bevel=0.0015, edge=0.045, z0=-0.003):
    """A wall mass: a gridded box whose top is pushed into a gable when
    `rise` is set (ridge along x or y). Base slightly below the ground."""
    H = hw + (rise if rise else 0.0) - z0
    o = gbox(name, (w, d, H), (0, 0, z0 + H / 2), mat, edge=edge)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for cut_z in (hw,):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cut_z),
                               plane_no=(0, 0, 1))
    if rise:
        ax = 1 if ridge == "x" else 0
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        no = [0, 0, 0]
        no[ax] = 1
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=no)
        half = (d if ridge == "x" else w) / 2
        top = hw + rise
        for v in bm.verts:
            if v.co.z > hw + 1e-6:
                f = (v.co.z - hw) / (top - hw)
                r = rise * (1 - abs(v.co[ax]) / half)
                v.co.z = hw + f * r
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.translate(bm, vec=Vector((centre[0], centre[1], 0)),
                        verts=bm.verts)
    bm.to_mesh(o.data)
    bm.free()
    if bevel:
        kit.add_bevel(o, bevel, 2)
    return o


def prism_xz(name, pts, y0, y1, mat=None):
    """A polygon in the x-z plane extruded from y0 to y1."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return mesh(name, verts, faces, mat)


def extrude_x(name, prof, x0, x1, nx=1, mat=None, cap=True):
    """A profile of (y, z) points extruded along x in nx slices."""
    n = len(prof)
    verts, faces = [], []
    for s in range(nx + 1):
        x = x0 + (x1 - x0) * s / nx
        verts += [(x, y, z) for y, z in prof]
    for s in range(nx):
        a, b = s * n, (s + 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([a + i, a + j, b + j, b + i])
    if cap:
        faces.append(list(range(n))[::-1])
        faces.append(list(range(nx * n, nx * n + n)))
    return mesh(name, verts, faces, mat)


def band(name, inner, outer, y0, y1, mat=None):
    """A frame strip between two open (x, z) polylines, y0 to y1 deep."""
    n = len(inner)
    pts = list(inner) + list(outer)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    m = 2 * n
    faces = []
    for i in range(n - 1):
        a, b = i, i + 1
        oa, ob = n + i, n + i + 1
        faces.append([a, b, ob, oa])                     # front
        faces.append([m + a, m + oa, m + ob, m + b])     # back
        faces.append([a, m + a, m + b, b])               # inner side
        faces.append([oa, ob, m + ob, m + oa])           # outer side
    for a, oa in ((0, n), (n - 1, 2 * n - 1)):
        faces.append([a, oa, m + oa, m + a])             # ends
    return mesh(name, verts, faces, mat)


def cyl(name, r1, r2, depth, centre=(0, 0, 0), verts=12, mat=None,
        axis="z", cap=True, rings=None):
    """A cylinder or cone, its base centred at `centre` (axis z), or lying
    along x or y with its middle at `centre`."""
    o = kit.cylinder(name, r1, r2, depth, (0, 0, 0), verts=verts, mat=mat,
                     cap=cap, rings=rings)
    if axis == "z":
        tf(o, T(*centre))
    else:
        m = T(0, 0, -depth / 2)
        m = (rot("Y", 90) if axis == "x" else rot("X", -90)) @ m
        tf(o, T(*centre) @ m)
    return o


def lathe(name, prof, centre=(0, 0, 0), segments=16, mat=None, close=True):
    o = kit.lathe(name, prof, (0, 0, 0), segments=segments, mat=mat,
                  close=close)
    tf(o, T(*centre))
    return o


def ball(name, r, centre, mat=None, seg=8, rings=5, scale=(1, 1, 1)):
    o = kit.sphere(name, r, (0, 0, 0), scale=scale, mat=mat, segments=seg,
                   rings=rings)
    tf(o, T(*centre))
    return o


def beam(name, a, b, size, mat=None, up=None):
    """A square-section bar from a to b (a timber, a strut, a rafter)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    o = box(name, (L, size[0], size[1]), (L / 2, 0, 0), mat)
    x = d.normalized()
    up = Vector(up) if up else (Z if abs(x.z) < 0.95 else Vector((0, 1, 0)))
    y = up.cross(x).normalized()
    z = x.cross(y)
    m = Matrix((
        (x.x, y.x, z.x, a.x),
        (x.y, y.y, z.y, a.y),
        (x.z, y.z, z.z, a.z),
        (0, 0, 0, 1),
    ))
    return tf(o, m)


# ---------------------------------------------------------------- walls

class Wall:
    """A wall face: origin on the surface, outward normal."""

    def __init__(self, origin, normal):
        n = Vector(normal).normalized()
        t = (-n).cross(Z).normalized()
        o = Vector(origin)
        self.n = n
        self.t = t
        self.o = o
        self.m = Matrix((
            (t.x, -n.x, 0, o.x),
            (t.y, -n.y, 0, o.y),
            (t.z, -n.z, 1, o.z),
            (0, 0, 0, 1),
        ))

    def put(self, obj):
        return tf(obj, self.m)

    def at(self, u, y, z):
        return self.m @ Vector((u, y, z))


def walls(cx, cy, w, d):
    """The four walls of a w × d block centred on (cx, cy)."""
    return {
        "front": Wall((cx, cy - d / 2, 0), (0, -1, 0)),
        "back": Wall((cx, cy + d / 2, 0), (0, 1, 0)),
        "left": Wall((cx - w / 2, cy, 0), (-1, 0, 0)),
        "right": Wall((cx + w / 2, cy, 0), (1, 0, 0)),
    }


def outline(w, h, arch=None, n=8):
    """The open outline of an opening from its bottom right, up over the
    top and down to its bottom left. arch: None, "round" or "segment"."""
    hw = w / 2
    if arch == "round":
        hs = h - hw
        pts = [(hw, 0), (hw, hs)]
        for i in range(1, n):
            a = math.pi * i / n
            pts.append((math.cos(a) * hw, hs + math.sin(a) * hw))
        pts += [(-hw, hs), (-hw, 0)]
        return pts
    if arch == "pointed":
        rise = w * 0.75
        hs = h - rise
        cxr = (hw * hw - rise * rise) / (2 * hw)
        R = hw - cxr
        a1 = math.atan2(rise, -cxr)
        m = n // 2
        right = [(cxr + R * math.cos(a1 * i / m), hs + R * math.sin(a1 * i / m))
                 for i in range(1, m)]
        pts = [(hw, 0), (hw, hs)] + right + [(0.0, hs + rise)]
        pts += [(-x, z) for x, z in reversed(right)]
        pts += [(-hw, hs), (-hw, 0)]
        return pts
    if arch == "segment":
        rise = w * 0.18
        hs = h - rise
        R = (hw * hw + rise * rise) / (2 * rise)
        cz = hs + rise - R
        a0 = math.asin(hw / R)
        pts = [(hw, 0), (hw, hs)]
        for i in range(1, n // 2):
            a = -a0 + 2 * a0 * i / (n // 2)
            pts.append((R * math.sin(-a), cz + R * math.cos(a)))
        pts += [(-hw, hs), (-hw, 0)]
        return pts
    return [(hw, 0), (hw, h), (-hw, h), (-hw, 0)]


def offset_outline(w, h, arch, b, n=8):
    """The outline grown by b at the sides and top (same point count)."""
    if arch == "pointed":
        pts = outline(w + 2 * b, h + b * 1.6, "pointed", n)
        hs_in = h - w * 0.75
        pts[1] = (pts[1][0], hs_in)
        pts[-2] = (pts[-2][0], hs_in)
        return pts
    if arch == "round":
        pts = outline(w + 2 * b, h + b, "round", n)
        # Keep the springing level with the inner outline's.
        hs_in = h - w / 2
        pts[1] = (pts[1][0], hs_in)
        pts[-2] = (pts[-2][0], hs_in)
        return pts
    return outline(w + 2 * b, h + b, arch, n)


# ---------------------------------------------------------------- build

class Build:
    """The parts of one asset."""

    def __init__(self, name):
        self.name = name
        self.parts = []      # (obj, uv mode)
        self.bodies = []     # wall masses the cutters carve
        self.cutters = []
        self.transfer = False   # recess faces take the cutters' material

    def add(self, obj, uv="planar"):
        self.parts.append((obj, uv))
        return obj

    def body(self, obj):
        self.bodies.append(obj)
        return self.add(obj)

    def cut(self, obj):
        self.cutters.append(obj)
        return obj

    def carve(self):
        if not self.cutters:
            return
        coll = bpy.data.collections.new(self.name + "-cutters")
        bpy.context.scene.collection.children.link(coll)
        for c in self.cutters:
            for uc in list(c.users_collection):
                uc.objects.unlink(c)
            coll.objects.link(c)
        for b in self.bodies:
            mod = b.modifiers.new("cut", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.operand_type = "COLLECTION"
            mod.collection = coll
            mod.solver = "EXACT"
            try:
                mod.material_mode = "TRANSFER" if self.transfer else "INDEX"
            except Exception:
                pass
            kit.apply(b)
            me = b.data
            mats = list(me.materials)
            for p in me.polygons:
                if p.material_index >= len(mats) or \
                        mats[p.material_index] is None:
                    p.material_index = 0
            for i in reversed(range(len(mats))):
                if mats[i] is None:
                    me.materials.pop(index=i)
        for c in self.cutters:
            bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.collections.remove(coll)
        self.cutters = []

    def finish(self, root, name=None, angle=34):
        """Carve, UV and join every part into one mesh under `root`."""
        self.carve()
        objs = []
        for o, uv in self.parts:
            kit.apply(o)
            if uv == "planar":
                uv_planar(o)
            elif isinstance(uv, tuple) and uv[0] == "cyl":
                uv_cyl(o, uv[1])
            elif uv == "keep":
                pass
            objs.append(o)
        for o in objs:
            if not len(o.data.materials) or None in list(o.data.materials):
                print("NO-MATERIAL", self.name, o.name,
                      list(o.data.materials))
            if not o.data.uv_layers:
                kit._fresh_uvs(o.data)
        if os.environ.get("ROTA_TRIS"):
            tally = {}
            for o in objs:
                o.data.calc_loop_triangles()
                k = o.name.split(".")[0]
                tally[k] = tally.get(k, 0) + len(o.data.loop_triangles)
            print("TALLY", self.name, sorted(tally.items(),
                                             key=lambda kv: -kv[1]))
        joined = kit.join(objs, name or (self.name + "-mesh"))
        kit.shade(joined, angle)
        kit.parent(joined, root)
        self.parts = []
        self.bodies = []
        return joined


def uv_cyl(obj, centre=(0, 0)):
    """kit.uv_cylinder about a vertical axis through `centre`."""
    tf(obj, T(-centre[0], -centre[1], 0))
    kit.uv_cylinder(obj)
    tf(obj, T(centre[0], centre[1], 0))
    return obj


def uv_planar(obj):
    """Per-face planar UVs in texture repeats at Rota's densities. Like
    kit.uv_box, but sloped faces map along their own eave line, so roof
    courses run level on every slope whichever way the ridge points."""
    me = obj.data
    kit._fresh_uvs(me)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        fam = me.materials[f.material_index].name.split(":")[0] \
            if me.materials else "plain"
        tile = kit.TILE.get(fam, 1.0)
        n = f.normal
        if abs(n.z) > 0.985 or n.length < 0.5:
            for loop in f.loops:
                c = loop.vert.co
                s = 1 if n.z >= 0 else -1
                loop[uv].uv = (c.x * s / tile, c.y / tile)
            continue
        t = Vector((-n.y, n.x, 0)).normalized()     # along the eave
        b = n.cross(t).normalized()                 # up the slope
        if b.z < 0:
            b = -b
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = (c.dot(t) / tile, c.dot(b) / tile)
    bm.to_mesh(me)
    bm.free()
    return obj


# ---------------------------------------------------------------- pieces

GLASS = "glass:dark"


def window(B, wall, u, z0, w, h, frame, arch=None, bars="cross",
           sill=None, shutters=None, flowers=None, lintel=None,
           recess=0.005, glass=GLASS, fb=0.0035, lite=False, keystone=None,
           seg=None):
    """A window set into a wall: carved recess, glass at its back,
    glazing bars, a frame proud of the wall, a sill, and optional
    shutters, flower box, lintel and keystone."""
    n = seg or (8 if arch in ("round", "pointed") else 6)
    inner = outline(w, h, arch, n)
    closed = inner + []
    # Cutter (a little deeper than the recess, from outside the wall).
    cpts = [(x, z0 + z) for x, z in closed]
    B.cut(wall.put(prism_xz("cut", cpts, -0.02, recess, None)))
    # Glass at the back of the recess.
    gpts = [(x, z0 + z) for x, z in closed]
    g = wall.put(pane("glass", gpts, recess - 0.0006, glass))
    B.add(g)
    # Glazing bars.
    bt = 0.0022 if not lite else 0.0026
    yb = recess - 0.0022
    top = z0 + h
    if bars in ("cross", "sash", "grid"):
        B.add(wall.put(box("bar", (bt, 0.0014, h - 0.001),
                           (u, yb, z0 + h / 2), frame)))
        zs = [z0 + h * (0.55 if bars == "sash" else 0.5)]
        if arch == "round":
            zs = [z0 + h - w / 2]
        if arch == "pointed":
            zs = [z0 + h - w * 0.75]
        if bars == "grid":
            zs = [z0 + h / 3, z0 + 2 * h / 3]
        for zz in zs:
            B.add(wall.put(box("bar", (w, 0.0014, bt), (u, yb, zz), frame)))
    elif bars == "transom":
        B.add(wall.put(box("bar", (w, 0.0014, bt), (u, yb, z0 + h * 0.55),
                           frame)))
    elif bars == "mullion":
        B.add(wall.put(box("bar", (bt, 0.0014, h - 0.001),
                           (u, yb, z0 + h / 2), frame)))
    elif bars == "vertical":
        for k in (-1, 1):
            B.add(wall.put(box("bar", (bt, 0.0014, h - 0.001),
                               (u + k * w / 6, yb, z0 + h / 2), frame)))
        B.add(wall.put(box("bar", (w, 0.0014, bt),
                           (u, yb, z0 + h * 0.78), frame)))
    # Frame band, proud of the wall face and lining the reveal.
    if fb:
        outer = offset_outline(w, h, arch, fb, n)
        fr = band("frame", [(x + u, z0 + z) for x, z in inner],
                  [(x + u, z0 + z) for x, z in outer],
                  -0.0018, recess - 0.0025, frame)
        B.add(wall.put(fr))
    # Move the glass and cutter to u (they were built at x = 0).
    for o in (g, B.cutters[-1]):
        tf(o, wall.m @ T(u) @ wall.m.inverted())
    if sill:
        sw = w + 2 * fb + 0.006
        B.add(wall.put(box("sill", (sw, 0.008, 0.0035),
                           (u, -0.002, z0 - 0.0016), sill)))
    if lintel:
        lw = w + 2 * fb + 0.006
        B.add(wall.put(box("lintel", (lw, 0.004, 0.006),
                           (u, -0.0005, top + fb + 0.003), lintel)))
    if keystone:
        B.add(wall.put(box("key", (0.007, 0.004, 0.009),
                           (u, -0.0012, top + fb - 0.001), keystone)))
    if shutters:
        sw = w / 2 + 0.002
        for k in (-1, 1):
            x = u + k * (w / 2 + fb + sw / 2 + 0.0005)
            B.add(wall.put(box("shutter", (sw, 0.0024, h),
                               (x, -0.0012, z0 + h / 2), shutters)))
    if flowers:
        box_mat, leaf, bloom = flowers
        fw = w + 0.006
        B.add(wall.put(box("fbox", (fw, 0.009, 0.007),
                           (u, -0.0065, z0 - 0.0075), box_mat)))
        B.add(wall.put(ball("leaves", 1, (0, 0, 0), leaf, seg=6, rings=3,
                            scale=(fw / 2, 0.0055, 0.0045))))
        tf(B.parts[-1][0], wall.m @ T(u, -0.0065, z0 - 0.003) @
           wall.m.inverted())
        for i in range(3):
            x = u - fw / 2 + fw * (i + 0.5) / 3
            B.add(wall.put(box("bloom", (0.0028, 0.0028, 0.0028),
                               (x, -0.0095 + 0.002 * (i % 2),
                                z0 - 0.0005 + 0.001 * (i % 2)), bloom)))
    return g


def door(B, wall, u, w, h, leaf, frame, arch=None, step="stone:sand",
         recess=0.006, glass=GLASS, fanlight=False, double=False,
         panels=True, knob="metal:brass", fb=0.004, seg=None):
    """A door in a recess, with panels, a frame, a step and a knob."""
    n = seg or (8 if arch in ("round", "pointed") else 6)
    z0 = 0.0
    inner = outline(w, h, arch, n)
    pts = [(x + u, z) for x, z in inner]
    B.cut(wall.put(prism_xz("cut", [(x, z - 0.004) if z == 0 else (x, z)
                                    for x, z in pts], -0.02, recess, None)))
    B.add(wall.put(prism_xz("leaf", pts, recess - 0.0015, recess + 0.001,
                            leaf)))
    hs = h - (w / 2 if arch == "round" else 0)
    if fanlight:
        fh = 0.010 if arch != "round" else w / 2
        zt = hs if arch == "round" else h - fh
        if arch == "round":
            fp = [(x + u, z) for x, z in inner[1:-1]]
        else:
            fp = [(u + w / 2, zt), (u + w / 2, h), (u - w / 2, h),
                  (u - w / 2, zt)]
        B.add(wall.put(prism_xz("fan", fp, recess - 0.0025,
                                recess - 0.001, glass)))
        B.add(wall.put(box("transom", (w, 0.003, 0.002),
                           (u, recess - 0.0025, zt), frame)))
        hs = zt
    if panels:
        cols = [u - w / 4, u + w / 4] if (double or w > 0.03) else [u]
        pw = (w / len(cols)) - 0.007
        for cx in cols:
            for (za, zb) in ((0.006, hs * 0.42), (hs * 0.5, hs - 0.006)):
                B.add(wall.put(box("panel", (pw, 0.0012, zb - za),
                                   (cx, recess - 0.002, (za + zb) / 2),
                                   leaf)))
    if double:
        B.add(wall.put(box("split", (0.0012, 0.002, hs),
                           (u, recess - 0.0018, hs / 2), frame)))
    if fb:
        outer = offset_outline(w, h, arch, fb, n)
        B.add(wall.put(band("dframe", pts,
                            [(x + u, z) for x, z in outer],
                            -0.002, recess - 0.001, frame)))
    if step:
        B.add(wall.put(box("step", (w + 2 * fb + 0.008, 0.012, 0.007),
                           (u, -0.005, 0.0005), step)))
    if knob:
        kx = u + (w / 2 - 0.005) * (-1 if double else 1)
        if double:
            kx = u - 0.003
        B.add(wall.put(box("knob", (0.0025, 0.003, 0.0025),
                           (kx, recess - 0.0035, hs * 0.48), knob)))


def gable_roof(B, cx, cy, w, d, hw, rise, mat, ridge="x", over=0.012,
               over_gable=0.010, thick=0.007, ridge_mat=None, barge=None,
               gutter=None, edge=0.045):
    """A pitched roof with a proper mitred ridge, eave and verge overhangs,
    ridge tiles, barge boards and gutters. Returns the slope angle."""
    half = d / 2 if ridge == "x" else w / 2
    length = w if ridge == "x" else d
    a = math.atan2(rise, half)
    ca, sa = math.cos(a), math.sin(a)
    # Profile in (s, z) with s across the ridge; underside follows the body.
    ns = max(2, math.ceil((half + over) / edge))
    p_under, p_top = [], []
    for i in range(ns + 1):
        f = i / ns
        s = -half - over * ca + (half + over * ca) * f
        z = hw - over * sa + (rise + over * sa) * f
        p_under.append((s, z))
        p_top.append((s - thick * sa, z + thick * ca))
    ridge_top = (0.0, hw + rise + thick / ca)
    p_top[-1] = ridge_top
    left_top = p_top
    left_under = p_under
    right_top = [(-s, z) for s, z in reversed(left_top)][1:]
    right_under = [(-s, z) for s, z in reversed(left_under)][1:]
    prof = left_under[:1] + left_top + right_top + right_under[-1:] + \
        list(reversed(right_under[:-1])) + list(reversed(left_under[1:]))
    # remove duplicate ridge-bottom vertex
    clean = []
    for p in prof:
        if not clean or (abs(p[0] - clean[-1][0]) > 1e-7 or
                         abs(p[1] - clean[-1][1]) > 1e-7):
            clean.append(p)
    if abs(clean[0][0] - clean[-1][0]) < 1e-7 and \
            abs(clean[0][1] - clean[-1][1]) < 1e-7:
        clean.pop()
    L = length + 2 * over_gable
    nx = max(1, math.ceil(L / edge))
    o = extrude_x("roof", clean, -L / 2, L / 2, nx, mat)
    if ridge == "y":
        tf(o, rot("Z", 90))
    tf(o, T(cx, cy))
    kit.add_bevel(o, 0.0012, 1, angle=50)
    B.add(o)
    rz = ridge_top[1]
    if ridge_mat:
        rc = cyl("ridge", 0.0042, 0.0042, L + 0.002, (0, 0, 0), 8, ridge_mat,
                 axis="x", rings=max(1, nx // 2))
        tf(rc, T(0, 0, rz - 0.0012))
        if ridge == "y":
            tf(rc, rot("Z", 90))
        tf(rc, T(cx, cy))
        B.add(rc)
    if barge:
        for side in (-1, 1):
            xg = side * (L / 2 + 0.0006)
            for k in (-1, 1):
                pa = Vector((xg, k * (half + over * ca * 0.9),
                             hw - over * sa * 0.9 - 0.002))
                pb = Vector((xg, 0, hw + rise + thick / ca - 0.0015))
                bb = beam("barge", pa, pb, (0.0022, 0.009), barge,
                          up=Vector((0, 0, 1)))
                if ridge == "y":
                    tf(bb, rot("Z", 90))
                tf(bb, T(cx, cy))
                B.add(bb)
    if gutter:
        for k in (-1, 1):
            s = k * (half + over * ca + 0.002)
            g = cyl("gutter", 0.0032, 0.0032, L - 0.004, (0, 0, 0), 6, gutter,
                    axis="x", rings=min(3, nx))
            tf(g, T(0, s, hw - over * sa - 0.0015))
            if ridge == "y":
                tf(g, rot("Z", 90))
            tf(g, T(cx, cy))
            B.add(g)
    return a


def roof_z(hw, rise, half, s):
    """Height of a gable roof's surface at distance s from the ridge."""
    return hw + rise * (1 - abs(s) / half)


def hip_roof(B, cx, cy, w, d, hw, rise, mat, over=0.012, thick=0.007,
             ridge_mat=None, gutter=None):
    """A hipped roof (ridge along x) with thickness."""
    hw_x = w / 2 + over
    hd = d / 2 + over
    a = math.atan2(rise, d / 2)
    drop = over * math.tan(a)
    ze = hw - drop
    rz = hw + rise
    rl = max(0.0, w / 2 - d / 2)
    top = [(-hw_x, -hd, ze), (hw_x, -hd, ze), (hw_x, hd, ze), (-hw_x, hd, ze),
           (-rl, 0, rz), (rl, 0, rz)]
    faces = [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]]
    o = mesh("hip", top, faces, mat)
    # Solidify upward, then densify for AO.
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = 1
    kit.apply(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges
                                         if e.calc_length() > 0.04],
                              cuts=3, use_grid_fill=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    tf(o, T(cx, cy))
    B.add(o)
    if ridge_mat and rl > 0:
        rc = cyl("ridge", 0.0042, 0.0042, 2 * rl + 0.004, (cx, cy, rz +
                                                            thick - 0.001),
                 8, ridge_mat, axis="x", rings=2)
        B.add(rc)
    if gutter:
        for k in (-1, 1):
            B.add(cyl("gutter", 0.003, 0.003, 2 * hw_x - 0.004,
                      (cx, cy + k * (hd + 0.002), ze - 0.0015), 8, gutter,
                      axis="x", rings=4))
            B.add(cyl("gutter", 0.003, 0.003, 2 * hd - 0.004,
                      (cx + k * (hw_x + 0.002), cy, ze - 0.0015), 8, gutter,
                      axis="y", rings=4))


def chimney(B, x, y, z0, z1, w, d, mat, cap="stone:sand", pots=2,
            pot_mat="paint:pot", bevel_cap=True):
    """A chimney stack from inside the roof up to z1, a corbelled cap and
    clay pots."""
    B.add(gbox("chimney", (w, d, z1 - z0), (x, y, (z0 + z1) / 2), mat,
               bevel=0.0008, seg=1, edge=0.05))
    B.add(box("ccap", (w + 0.005, d + 0.005, 0.005), (x, y, z1 - 0.0045),
              cap, bevel=0.0008 if bevel_cap else 0.0))
    B.add(box("ccap2", (w + 0.002, d + 0.002, 0.003), (x, y, z1 + 0.0015),
              cap))
    for i in range(pots):
        px = x + (i - (pots - 1) / 2) * (w / max(1, pots))
        B.add(lathe("pot", [(0.0034, z1 + 0.002), (0.0029, z1 + 0.009),
                            (0.0037, z1 + 0.011), (0.0024, z1 + 0.011)],
                    (px, y, 0), 6, pot_mat))


def downpipe(B, x, y, z1, mat="metal:zinc"):
    B.add(cyl("pipe", 0.0018, 0.0018, z1, (x, y, 0), 6, mat, rings=1))


def plinth(B, cx, cy, w, d, h, mat, out=0.003):
    """A stone base course standing proud of the walls."""
    B.add(gbox("plinth", (w + 2 * out, d + 2 * out, h + 0.003),
               (cx, cy, (h - 0.003) / 2), mat, edge=0.08))


def band_course(B, cx, cy, w, d, z, h, mat, out=0.002):
    """A string course or cornice running round a block."""
    B.add(gbox("course", (w + 2 * out, d + 2 * out, h), (cx, cy, z), mat,
               edge=0.1))


# ---------------------------------------------------------------- preview

# Average colour of each tiled family's tile (sRGB), for preview shading
# while Rota's own tiles are missing. Tints already carry the colour.
PATTERN = {
    # family: (kind, rows per tile, bricks per row, joint, joint shade)
    "brick": ("brick", 16, 5, 0.12, "mortar"),
    "roof": ("brick", 10, 7, 0.10, 0.55),
    "slate": ("brick", 12, 8, 0.08, 0.55),
    "stone": ("brick", 8, 3.5, 0.08, 0.62),
    "wood": ("planks", 8, 0.4, 0.07, 0.55),
    "cobble": ("cobble", 9, 0, 0, 0.55),
    "plaster": ("noise", 0, 0, 0, 0),
    "bark": ("planks", 30, 0.4, 0.25, 0.7),
    "asphalt": ("noise", 0, 0, 0, 0),
    "ballast": ("cobble", 30, 0, 0, 0.6),
    "foliage": ("noise", 0, 0, 0, 0),
}


def _lin(hexcol):
    h = hexcol.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
                 for x in c)


def _own_tile(family):
    path = os.path.join(rkit.TEX, family + ".png")
    if not os.path.isfile(path):
        return None, None
    img = bpy.data.images.load(path, check_existing=True)
    px = img.pixels[:]
    step = max(4, (len(px) // 4 // 4096)) * 4
    s = [0.0, 0.0, 0.0]
    n = 0
    for i in range(0, len(px), step):
        s[0] += px[i]
        s[1] += px[i + 1]
        s[2] += px[i + 2]
        n += 1
    return img, tuple(max(1e-3, c / n) for c in s)


def preview_look(strength=0.55):
    """Rewire every material for previews: the tint carries the colour
    (as in the game, where the tile is divided by its own average and adds
    light and shade around the tint), times a tile pattern, times AO."""
    for m in bpy.data.materials:
        if ":" not in m.name or m.name.startswith("__"):
            continue
        fam, _, tint = m.name.partition(":")
        colour = kit.TINTS.get(tint, (0.8, 0.8, 0.8))
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
                nt.nodes.remove(nd)
        bsdf = nt.nodes.get("Principled BSDF")
        L = nt.links
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "UVMap"
        rgb = nt.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = (*colour, 1)
        ao = nt.nodes.new("ShaderNodeVertexColor")
        ao.layer_name = "AO"
        aomul = nt.nodes.new("ShaderNodeMix")
        aomul.data_type = "RGBA"
        aomul.blend_type = "MULTIPLY"
        aomul.inputs["Factor"].default_value = 1
        L.new(ao.outputs["Color"], aomul.inputs[7])
        base = rgb.outputs[0]
        img, mean = _own_tile(fam) if fam in PATTERN else (None, None)
        if img:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            L.new(uvn.outputs[0], tex.inputs[0])
            div = nt.nodes.new("ShaderNodeMix")
            div.data_type = "RGBA"
            div.blend_type = "DIVIDE"
            div.inputs["Factor"].default_value = 1
            L.new(tex.outputs[0], div.inputs[6])
            div.inputs[7].default_value = (*mean, 1)
            lerp = nt.nodes.new("ShaderNodeMix")
            lerp.data_type = "RGBA"
            lerp.inputs["Factor"].default_value = strength
            lerp.inputs[6].default_value = (1, 1, 1, 1)
            L.new(div.outputs[2], lerp.inputs[7])
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1
            L.new(rgb.outputs[0], mul.inputs[6])
            L.new(lerp.outputs[2], mul.inputs[7])
            base = mul.outputs[2]
        elif fam in PATTERN:
            kind, rows, per, joint, shade_ = PATTERN[fam]
            c = Vector(colour)
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1
            if kind in ("brick", "planks"):
                br = nt.nodes.new("ShaderNodeTexBrick")
                vec = uvn.outputs[0]
                if kind == "planks":
                    mp = nt.nodes.new("ShaderNodeMapping")
                    mp.inputs["Rotation"].default_value = (0, 0, math.pi / 2)
                    L.new(uvn.outputs[0], mp.inputs[0])
                    vec = mp.outputs[0]
                L.new(vec, br.inputs["Vector"])
                br.inputs["Scale"].default_value = 1.0
                br.inputs["Row Height"].default_value = 1.0 / rows
                br.inputs["Brick Width"].default_value = 1.0 / per \
                    if kind == "brick" else 3.0
                br.inputs["Mortar Size"].default_value = joint / rows
                br.inputs["Mortar Smooth"].default_value = 0.3
                br.inputs["Bias"].default_value = 0.0
                br.inputs["Color1"].default_value = (1.06, 1.06, 1.06, 1)
                br.inputs["Color2"].default_value = (0.88, 0.88, 0.88, 1)
                if shade_ == "mortar":
                    mc = Vector(_lin("#d9cdb4"))
                    br.inputs["Mortar"].default_value = (
                        *(mc[i] / max(1e-3, c[i]) for i in range(3)), 1)
                else:
                    br.inputs["Mortar"].default_value = (shade_, shade_,
                                                         shade_, 1)
                L.new(br.outputs["Color"], mul.inputs[7])
            elif kind == "cobble":
                vo = nt.nodes.new("ShaderNodeTexVoronoi")
                vo.feature = "DISTANCE_TO_EDGE"
                vo.inputs["Scale"].default_value = rows
                L.new(uvn.outputs[0], vo.inputs["Vector"])
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.inputs[1].default_value = 0.0
                mr.inputs[2].default_value = 0.12
                mr.inputs[3].default_value = shade_
                mr.inputs[4].default_value = 1.08
                L.new(vo.outputs["Distance"], mr.inputs[0])
                L.new(mr.outputs[0], mul.inputs[7])
            else:
                nz = nt.nodes.new("ShaderNodeTexNoise")
                nz.inputs["Scale"].default_value = 6.0
                L.new(uvn.outputs[0], nz.inputs["Vector"])
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.inputs[3].default_value = 0.93
                mr.inputs[4].default_value = 1.06
                L.new(nz.outputs["Fac"], mr.inputs[0])
                L.new(mr.outputs[0], mul.inputs[7])
            L.new(rgb.outputs[0], mul.inputs[6])
            base = mul.outputs[2]
        L.new(base, aomul.inputs[6])
        L.new(aomul.outputs[2], bsdf.inputs["Base Color"])
        rough, metal = kit.FAMILY.get(fam, (0.8, 0.0))
        if fam == "metal":
            rough, metal = 0.45, 0.7
        if fam in PATTERN:
            rough = 0.85
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        if fam == "glow":
            bsdf.inputs["Emission Color"].default_value = (*colour, 1)
            bsdf.inputs["Emission Strength"].default_value = 2.5
        if fam == "glass":
            bsdf.inputs["Specular IOR Level"].default_value = 0.8


# ---------------------------------------------------------------- profiles

def body_profile(name, w, d, hw, top, breaks=(), ridge="x", centre=(0, 0),
                 mat=None, bevel=0.0015, edge=0.045, z0=-0.003):
    """A wall mass whose top follows top(s) above hw, s measured across the
    ridge (a gambrel, a mansard). `breaks` lists the s values of kinks."""
    half = (d if ridge == "x" else w) / 2
    ax = 1 if ridge == "x" else 0
    H = max(top(s) for s in [i / 50 * half for i in range(51)] + [0.0])
    o = gbox(name, (w, d, H - z0), (0, 0, z0 + (H - z0) / 2), mat, edge=edge)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, hw),
                           plane_no=(0, 0, 1))
    for sb in list(breaks) + [0.0]:
        for sg in (-1, 1):
            co = [0, 0, 0]
            co[ax] = sg * sb
            no = [0, 0, 0]
            no[ax] = 1
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    for v in bm.verts:
        if v.co.z > hw + 1e-6:
            f = (v.co.z - hw) / (H - hw)
            v.co.z = hw + f * (top(abs(v.co[ax])) - hw)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.translate(bm, vec=Vector((centre[0], centre[1], 0)),
                        verts=bm.verts)
    bm.to_mesh(o.data)
    bm.free()
    if bevel:
        kit.add_bevel(o, bevel, 2)
    return o


def profile_roof(B, cx, cy, length, pts, mat, thick=0.007, ridge="x",
                 over_gable=0.008, edge=0.045, ridge_mat=None, gutter=None,
                 barge=None):
    """A roof over a symmetric profile: pts are the underside's (s, z) from
    the left eave to the ridge (s = 0)."""
    dense = [pts[0]]
    for (s0, z0), (s1, z1) in zip(pts, pts[1:]):
        n = max(1, math.ceil(math.hypot(s1 - s0, z1 - z0) / edge))
        for i in range(1, n + 1):
            dense.append((s0 + (s1 - s0) * i / n, z0 + (z1 - z0) * i / n))
    segs = []
    for (s0, z0), (s1, z1) in zip(dense, dense[1:]):
        L = math.hypot(s1 - s0, z1 - z0)
        segs.append(((-(z1 - z0) / L), (s1 - s0) / L))
    top = []
    for i, (s, z) in enumerate(dense):
        ns = [segs[j] for j in (i - 1, i) if 0 <= j < len(segs)]
        nx = sum(n[0] for n in ns) / len(ns)
        nz = sum(n[1] for n in ns) / len(ns)
        ln = math.hypot(nx, nz)
        nx, nz = nx / ln, nz / ln
        k = thick / max(0.35, (nx * ns[0][0] + nz * ns[0][1]))
        top.append((s + nx * k, z + nz * k))
    ridge_top = (0.0, dense[-1][1] + thick / max(0.35, segs[-1][1]))
    top[-1] = ridge_top
    under_l = dense
    under_r = [(-s, z) for s, z in reversed(dense[:-1])]
    top_r = [(-s, z) for s, z in top[:-1]]
    top_l = list(reversed(top))
    prof = under_l + under_r + top_r + top_l
    clean = []
    for p in prof:
        if not clean or math.dist(p, clean[-1]) > 1e-7:
            clean.append(p)
    if math.dist(clean[0], clean[-1]) < 1e-7:
        clean.pop()
    L = length + 2 * over_gable
    nx = max(1, math.ceil(L / edge))
    o = extrude_x("roof", clean, -L / 2, L / 2, nx, mat)
    if ridge == "y":
        tf(o, rot("Z", 90))
    tf(o, T(cx, cy))
    kit.add_bevel(o, 0.0012, 1, angle=50)
    B.add(o)
    if ridge_mat:
        rc = cyl("ridge", 0.0042, 0.0042, L + 0.002, (0, 0, 0), 8, ridge_mat,
                 axis="x", rings=max(1, nx // 2))
        tf(rc, T(0, 0, ridge_top[1] - 0.0012))
        if ridge == "y":
            tf(rc, rot("Z", 90))
        tf(rc, T(cx, cy))
        B.add(rc)
    if gutter:
        for k in (-1, 1):
            s0, z0 = dense[0]
            g = cyl("gutter", 0.0032, 0.0032, L - 0.004, (0, 0, 0), 6,
                    gutter, axis="x", rings=min(3, nx))
            tf(g, T(0, k * (-s0 + 0.002), z0 - 0.0015))
            if ridge == "y":
                tf(g, rot("Z", 90))
            tf(g, T(cx, cy))
            B.add(g)
    if barge:
        for side in (-1, 1):
            xg = side * (L / 2 + 0.0006)
            for k in (-1, 1):
                for (s0, z0), (s1, z1) in zip(pts, pts[1:]):
                    pa = Vector((xg, k * s0, z0 + thick * 0.5))
                    pb = Vector((xg, k * s1, z1 + thick * 0.5))
                    bb = beam("barge", pa, pb, (0.0022, 0.008), barge,
                              up=Vector((0, 0, 1)))
                    if ridge == "y":
                        tf(bb, rot("Z", 90))
                    tf(bb, T(cx, cy))
                    B.add(bb)
    return ridge_top[1]


# ---------------------------------------------------------------- props

def clock(B, wall, u, z, r, face="paint:clockface", rim="metal:brass",
          hands="paint:black", depth=0.004, seg=16, ticks=True):
    """A clock face standing proud of a wall."""
    B.add(wall.put(cyl("crim", r + 0.003, r + 0.003, depth, (u, -depth / 2,
                                                              z), seg, rim,
                       axis="y", rings=1)))
    B.add(wall.put(cyl("cface", r, r, 0.0012, (u, -depth - 0.0004, z), seg,
                       face, axis="y", rings=1)))
    y = -depth - 0.0012
    B.add(wall.put(box("hand", (0.0016, 0.0008, r * 0.8),
                       (u, y, z + r * 0.36), hands)))
    B.add(wall.put(beam("hand", (u, y, z), (u + r * 0.55, y, z - r * 0.25),
                        (0.0008, 0.0018), hands, up=Vector((0, -1, 0)))))
    for i in range(4 if ticks else 0):
        a = i * math.pi / 2
        B.add(wall.put(box("tick", (0.0014, 0.0006, 0.0014),
                           (u + math.cos(a) * r * 0.82, y,
                            z + math.sin(a) * r * 0.82), hands)))


def bench(B, x, y, ang=0.0, wood="wood:oak", iron="metal:iron", L=0.04,
          z0=0.0):
    parts = [
        box("seat", (L, 0.011, 0.002), (0, 0, 0.012), wood),
        box("back", (L, 0.002, 0.009), (0, 0.006, 0.019), wood),
    ]
    for k in (-1, 1):
        parts.append(box("leg", (0.002, 0.012, 0.012),
                         (k * (L / 2 - 0.004), 0.0005, 0.006), iron))
        parts.append(box("arm", (0.002, 0.003, 0.016),
                         (k * (L / 2 - 0.004), 0.0062, 0.015), iron))
    m = T(x, y, z0) @ rot("Z", ang)
    for p in parts:
        B.add(tf(p, m))


def lamp_post(B, x, y, h=0.07, mat="metal:iron", glow="glow:lamp", z0=0.0):
    B.add(cyl("lbase", 0.0035, 0.0028, 0.008, (x, y, z0), 6, mat))
    B.add(cyl("lpost", 0.0014, 0.0014, h, (x, y, z0), 6, mat, rings=1))
    B.add(box("lglass", (0.006, 0.006, 0.008), (x, y, z0 + h + 0.004), glow))
    B.add(cyl("lcap", 0.0055, 0.001, 0.005, (x, y, z0 + h + 0.008), 6, mat))


def churn(B, x, y, z0=0.0, mat="metal:zinc"):
    B.add(lathe("churn", [(0.0035, z0), (0.0038, z0 + 0.008),
                          (0.0022, z0 + 0.011), (0.0022, z0 + 0.0135),
                          (0.0, z0 + 0.0135)], (x, y, 0), 7, mat))


def crate(B, x, y, s=0.016, z0=0.0, mat="wood:oak", ang=0.0):
    o = box("crate", (s, s, s), (0, 0, s / 2), mat)
    B.add(tf(o, T(x, y, z0) @ rot("Z", ang)))


def barrel(B, x, y, z0=0.0, r=0.0075, h=0.019, mat="wood:oak",
           hoop="metal:iron"):
    B.add(lathe("barrel", [(r * 0.85, z0), (r, z0 + h * 0.5),
                           (r * 0.85, z0 + h), (0.0, z0 + h)],
                (x, y, 0), 8, mat))
    for zz in (0.22, 0.78):
        B.add(cyl("hoop", r * 0.97, r * 0.97, 0.0016,
                  (x, y, z0 + h * zz - 0.0008), 8, hoop, cap=False))


def awning(B, wall, u, z, w, depth, drop, cols, n=7, flap=0.007,
           arm="metal:iron"):
    """A striped shop awning sloping out from a wall."""
    sw = w / n
    for i in range(n):
        x = u - w / 2 + sw * (i + 0.5)
        mat = cols[i % len(cols)]
        B.add(wall.put(beam("awn", (x, -0.001, z), (x, -depth, z - drop),
                            (sw, 0.0016), mat, up=Vector((0, 0, 1)))))
        B.add(wall.put(box("flap", (sw, 0.0012, flap),
                           (x, -depth - 0.0004, z - drop - flap / 2 + 0.001),
                           mat)))
    for k in (-1, 1):
        B.add(wall.put(beam("arm", (u + k * (w / 2 - 0.004), -0.001,
                                    z - drop - 0.012),
                            (u + k * (w / 2 - 0.004), -depth + 0.002,
                             z - drop + 0.001), (0.0012, 0.0012), arm)))


def valance(B, pts_a, pts_b, h, mat, teeth=None, t=0.0015):
    """A canopy's saw-tooth wooden edge from a to b, h tall."""
    a, b = Vector(pts_a), Vector(pts_b)
    L = (b - a).length
    n = teeth or max(3, round(L / 0.008))
    poly = [(0, 0), (L, 0)]
    for i in range(n, 0, -1):
        x1 = L * i / n
        xm = L * (i - 0.5) / n
        poly.append((x1, -h))
        poly.append((xm, -h * 0.55))
    poly.append((0, -h))
    o = prism_xz("valance", poly, -t / 2, t / 2, mat)
    d = (b - a).normalized()
    y = Z.cross(d).normalized()
    m = Matrix(((d.x, y.x, 0, a.x), (d.y, y.y, 0, a.y), (d.z, y.z, 1, a.z),
                (0, 0, 0, 1)))
    B.add(tf(o, m))


def arc_profile(r0, r1, n=12, a0=0.0, a1=math.pi):
    """An annulus sector in (y, z): outer arc then inner arc back."""
    outer = [(math.cos(a0 + (a1 - a0) * i / n) * r1,
              math.sin(a0 + (a1 - a0) * i / n) * r1) for i in range(n + 1)]
    inner = [(math.cos(a0 + (a1 - a0) * i / n) * r0,
              math.sin(a0 + (a1 - a0) * i / n) * r0)
             for i in range(n, -1, -1)]
    return outer + inner


def along_y(o):
    """Turn a part built along x (extrude_x) to run along y."""
    return tf(o, rot("Z", 90))


def railing_ring(B, cx, cy, z, r, h, n, post="metal:iron", rail=None):
    """Posts round a circle with a rail on top (a lighthouse gallery)."""
    for i in range(n):
        a = math.tau * i / n
        B.add(box("rpost", (0.0016, 0.0016, h),
                  (cx + math.cos(a) * r, cy + math.sin(a) * r, z + h / 2),
                  post))
    B.add(ring("rrail", r, 0.0012, z + h, (cx, cy), max(12, n),
               rail or post))


def ring(name, r, t, z, centre=(0, 0), segments=16, mat=None, h=None):
    """A thin hoop of square section (t wide, h tall) at height z."""
    h = h or 2 * t
    prof = [(r - t, z - h / 2), (r + t, z - h / 2), (r + t, z + h / 2),
            (r - t, z + h / 2), (r - t, z - h / 2)]
    return lathe(name, prof, (centre[0], centre[1], 0), segments, mat,
                 close=False)
