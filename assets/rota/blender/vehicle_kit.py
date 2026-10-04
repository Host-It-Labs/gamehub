"""Shape helpers for Rota's vehicles (vehicles.py), on top of rkit / kit.

The bodies are lofts: a row of cross-section rings along +Y, each ring a
rounded profile (flat bottom, rounded corners, slanted sides, crowned top)
with the same vertex count, so every face knows which span (between two
sections) and which band of the ring (bottom, side segment k, top corner,
roof) it belongs to. A classifier turns those into materials, which is how
windows, door seams, liveries and waterline stripes land exactly on section
lines; windows are then inset into the shell so they sit behind a frame.
Wheels are spun around the X axis with a material per profile segment.
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

import rkit

kit = rkit.kit
TAU = math.tau


# ---------------------------------------------------------------- basics

def mesh(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for m in mats:
        me.materials.append(kit.material(m))
    return obj


def blk(name, size, loc=(0, 0, 0), mat="paint:team", bevel=0.0, seg=None,
        edge=0.06, rot=None):
    """A box with a few cuts per axis (for the AO bake) and a bevel."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    for ax in range(3):
        n = max(1, math.ceil(size[ax] / edge))
        for k in range(1, n):
            co = Vector((0, 0, 0))
            co[ax] = -size[ax] / 2 + size[ax] * k / n
            no = Vector((0, 0, 0))
            no[ax] = 1
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] +
                                   bm.faces[:], plane_co=co, plane_no=no)
    obj = mesh(name, bm, [mat])
    obj.location = loc
    if rot:
        obj.rotation_euler = rot
    if bevel:
        if seg is None:
            seg = 1 if max(size) < 0.05 else 2
        kit.add_bevel(obj, bevel, seg, angle=30)
    return obj


def cyl(name, r, depth, loc=(0, 0, 0), axis="Z", mat="metal:chassis",
        verts=16, r2=None, rings=1, bevel=0.0, seg=2, cap=True):
    """A cylinder (or cone, with r2) centred on `loc` along an axis."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=True, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2,
                          depth=depth)
    if rings > 1:
        edges = [e for e in bm.edges
                 if abs(e.verts[0].co.z - e.verts[1].co.z) > depth * 0.5]
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=rings - 1)
    rot = {"Z": Matrix.Identity(3),
           "X": Matrix.Rotation(math.pi / 2, 3, "Y"),
           "Y": Matrix.Rotation(-math.pi / 2, 3, "X")}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=rot)
    obj = mesh(name, bm, [mat])
    obj.location = loc
    if bevel:
        kit.add_bevel(obj, bevel, seg, angle=30)
    return obj


def ball(name, r, loc, mat, scale=(1, 1, 1), seg=12, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    obj = mesh(name, bm, [mat])
    obj.location = loc
    return obj


def rod(name, a, b, r, mat, seg=8):
    """A straight round bar from a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    obj = cyl(name, r, d.length, (a + b) / 2, "Z", mat, verts=seg)
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return obj


def tube(name, pts, r, mat, seg=8, cap=True):
    return kit.tube(name, pts, r, mat=mat, segments=seg, cap=cap)


def spin(name, profile, mats, loc=(0, 0, 0), segments=24, axis="X"):
    """Revolve [(radius, a, mat_index), ...] about the X axis (a along X).
    Each point's material index colours the band to the next point."""
    bm = bmesh.new()
    rings = []
    for r, a, _m in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((a, 0, 0))])
            continue
        ring = []
        for i in range(segments):
            t = i / segments * TAU
            ring.append(bm.verts.new((a, math.cos(t) * r, math.sin(t) * r)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        m = profile[k][2]
        for i in range(segments):
            j = (i + 1) % segments
            if len(A) == 1 and len(B) == 1:
                continue
            if len(A) == 1:
                f = bm.faces.new((A[0], B[j], B[i]))
            elif len(B) == 1:
                f = bm.faces.new((A[i], A[j], B[0]))
            else:
                f = bm.faces.new((A[i], A[j], B[j], B[i]))
            f.material_index = m
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if axis == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts,
                         matrix=Matrix.Rotation(math.pi / 2, 3, "Z"))
    elif axis == "Z":
        bmesh.ops.rotate(bm, verts=bm.verts,
                         matrix=Matrix.Rotation(-math.pi / 2, 3, "Y"))
    obj = mesh(name, bm, mats)
    obj.location = loc
    return obj


# ---------------------------------------------------------------- lofts

def ring(hw, z0, z1, rb=0.004, rt=0.006, tumble=0.0, crown=0.0, side=(),
         nb=2, nc=3, nr=4):
    """Right half of a rounded cross-section, from the bottom centre round
    to the top centre: points and a label per segment."""
    h = z1 - z0
    rb = max(1e-4, min(rb, hw * 0.95, h * 0.45))
    ht = hw - tumble
    rt = max(1e-4, min(rt, ht * 0.95, h * 0.45))
    pts = [(0.0, z0)]
    labels = []
    for k in range(1, nb + 1):
        pts.append(((hw - rb) * k / nb, z0))
        labels.append("b")
    for k in range(1, nc + 1):
        a = -math.pi / 2 + math.pi / 2 * k / nc
        pts.append((hw - rb + rb * math.cos(a), z0 + rb + rb * math.sin(a)))
        labels.append("bc")
    za, zb = z0 + rb, z1 - rt
    for k, z in enumerate(side):
        z = min(max(z, za + (zb - za) * 0.02 * (k + 1)),
                zb - (zb - za) * 0.02 * (len(side) - k))
        t = (z - za) / max(1e-6, zb - za)
        pts.append((hw + (ht - hw) * t, z))
        labels.append("s%d" % k)
    pts.append((ht, zb))
    labels.append("s%d" % len(side))
    for k in range(1, nc + 1):
        a = math.pi / 2 * k / nc
        pts.append((ht - rt + rt * math.cos(a), zb + rt * math.sin(a)))
        labels.append("tc%d" % (k - 1))
    xr = ht - rt
    for k in range(1, nr + 1):
        x = xr * (1 - k / nr)
        pts.append((x, z1 + crown * (1 - (x / xr) ** 2)))
        labels.append("r")
    return pts, labels


def lerp(a, b, t):
    return a + (b - a) * t


def _slope(keys, i, k):
    """Hermite tangent (d value / d y) at key i, flat at local extremes."""
    n = len(keys)
    v = keys[i][1][k]
    if i == 0 or i == n - 1:
        j0, j1 = max(0, i - 1), min(n - 1, i + 1)
        return (keys[j1][1][k] - keys[j0][1][k]) / max(
            1e-9, keys[j1][0] - keys[j0][0])
    a, c = keys[i - 1][1][k], keys[i + 1][1][k]
    if (v - a) * (c - v) <= 0:
        return 0.0
    return (c - a) / max(1e-9, keys[i + 1][0] - keys[i - 1][0])


def keyed(keys, y, smooth=False):
    """Interpolate a dict of numbers between (y, dict) keys: linearly, or
    with a smooth monotone-ish Hermite curve through the keys."""
    if y <= keys[0][0]:
        return dict(keys[0][1])
    for i, ((ya, a), (yb, b)) in enumerate(zip(keys, keys[1:])):
        if ya <= y <= yb:
            h = max(1e-9, yb - ya)
            t = (y - ya) / h
            out = {}
            for k in a:
                if not isinstance(a[k], float):
                    out[k] = a[k]
                elif not smooth:
                    out[k] = lerp(a[k], b[k], t)
                else:
                    m0, m1 = _slope(keys, i, k), _slope(keys, i + 1, k)
                    t2, t3 = t * t, t * t * t
                    out[k] = ((2 * t3 - 3 * t2 + 1) * a[k] +
                              (t3 - 2 * t2 + t) * h * m0 +
                              (-2 * t3 + 3 * t2) * b[k] +
                              (t3 - t2) * h * m1)
            return out
    return dict(keys[-1][1])


def stations(keys, ys=(), front=0.0, rear=0.0, n=3, bottom=0.4, ring_kw=None,
             side_fn=None, smooth=False):
    """Sections for a loft from keyed profiles: the key positions, the extra
    `ys`, and quarter-round ends of radius `front` / `rear` (the profile
    shrinks by the radius at the very end, the bottom by `bottom` of it)."""
    ring_kw = ring_kw or {}
    y0, y1 = keys[0][0], keys[-1][0]
    at = sorted(set([round(k[0], 6) for k in keys] +
                    [round(y, 6) for y in ys if y0 <= y <= y1]))
    out = []

    def shrink(p, d):
        p = dict(p)
        h = p["z1"] - p["z0"]
        p["hw"] -= d
        p["z1"] -= min(d, 0.55 * h)
        p["z0"] += min(d * bottom, 0.25 * h)
        if "tumble" in p:
            p["tumble"] = p["tumble"] * (1 - d / max(1e-6, p["hw"] + d))
        return p

    def add(y, d):
        p = keyed(keys, y, smooth)
        p["hw"] = max(p["hw"], 0.0015)
        if d:
            p = shrink(p, d)
        kw = dict(ring_kw)
        kw.update({k: v for k, v in p.items() if k in (
            "rb", "rt", "tumble", "crown", "side")})
        if side_fn:
            kw["side"] = side_fn(p)
        out.append((y, ring(p["hw"], p["z0"], p["z1"], **kw)))

    if rear:
        for k in range(n):
            a = math.pi / 2 * (1 - k / n)
            add(y0 + rear * (1 - math.sin(a)), rear * (1 - math.cos(a)))
    for y in at:
        if (rear and y < y0 + rear - 1e-6) or (front and y > y1 - front + 1e-6):
            continue
        add(y, 0)
    if front:
        for k in range(1, n + 1):
            a = math.pi / 2 * k / n
            add(y1 - front + front * math.sin(a), front * (1 - math.cos(a)))
    out.sort(key=lambda s: s[0])
    return out


def loft(name, secs, mats, classify=None, caps=True, poke=True):
    """Bridge a list of (y, (half_points, labels)) rings into a closed
    shell. classify(i, label, centre, normal) -> material index; i is the
    span index (between sections i and i+1), -1 for the rear cap and
    len-1 for the front cap; label is the ring band ("cap" on caps)."""
    bm = bmesh.new()
    rings = []
    labels = None
    for y, (half, lab) in secs:
        full = half + [(-x, z) for x, z in reversed(half[1:-1])]
        rings.append([bm.verts.new((x, y, z)) for x, z in full])
        labels = lab
    H = len(secs[0][1][0])
    N = 2 * H - 2
    seg_label = [labels[j] if j < H - 1 else labels[N - 1 - j]
                 for j in range(N)]
    meta = {}
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(N):
            k = (j + 1) % N
            f = bm.faces.new((a[j], a[k], b[k], b[j]))
            meta[f] = (i, seg_label[j])
    if caps:
        c0 = bm.faces.new(list(reversed(rings[0])))
        c1 = bm.faces.new(rings[-1])
        caps_f = [(c0, -1), (c1, len(rings) - 1)]
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f, i in caps_f:
            if poke:
                res = bmesh.ops.poke(bm, faces=[f])
                for g in res["faces"]:
                    meta[g] = (i, "cap")
            else:
                meta[f] = (i, "cap")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if classify:
        for f in bm.faces:
            i, lab = meta.get(f, (-1, "cap"))
            f.material_index = classify(i, lab, f.calc_center_median(),
                                        f.normal)
    return mesh(name, bm, mats)


def inset(obj, idx, frame, thick=0.0012, depth=0.0012):
    """Set every face region of material `idx` back into the shell behind a
    frame of material `frame`: a flat border, then a recess."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    faces = [f for f in bm.faces if f.material_index == idx]
    if faces:
        res = bmesh.ops.inset_region(bm, faces=faces, thickness=thick,
                                     depth=0, use_even_offset=True)
        for f in res["faces"]:
            f.material_index = frame
        res = bmesh.ops.inset_region(bm, faces=faces, thickness=thick * 0.15,
                                     depth=-depth, use_even_offset=True)
        for f in res["faces"]:
            f.material_index = frame
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def turn(obj, angle=math.pi / 2):
    """Rotate a mesh about Z through the origin (a loft along +Y becomes a
    loft along -X, its ring sides facing +-Y)."""
    obj.data.transform(Matrix.Rotation(angle, 4, "Z"))
    return obj


def lift(obj, v):
    obj.data.transform(Matrix.Translation(Vector(v)))
    return obj


def window(body, centre, size, out="y", depth=0.0014, round_=0.0012,
           frame="plastic:seal", glass="glass:dark"):
    """Cut a window recess into a flat face: `centre` on the surface, `size`
    (width, height) in that face, `out` the outward axis ("y", "-y", "x",
    "-x"). The recess floor is glass, its walls the frame material."""
    ax = out[-1]
    sign = -1 if out.startswith("-") else 1
    a, b = size
    dims = {"x": (depth * 2, a, b), "y": (a, depth * 2, b)}[ax]
    c = blk("win-cut", dims, centre, frame, edge=1)
    if round_:
        m = c.modifiers.new("round", "BEVEL")
        m.width = min(round_, a * 0.45, b * 0.45)
        m.segments = 2
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(30)
        m.affect = "EDGES"
        kit.apply(c)
    c.data.materials.append(kit.material(glass))
    i = {"x": 0, "y": 1}[ax]
    for p in c.data.polygons:
        n = p.normal[i] * sign
        if n < -0.9:
            p.material_index = 1
    cut(body, c)
    return body


def recolour(obj, fn):
    """Reassign face materials: fn(index, centre, normal) -> index."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for f in bm.faces:
        f.material_index = fn(f.material_index, f.calc_center_median(),
                              f.normal)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def cut(obj, cutter, mat=None):
    """Boolean difference; the cut walls take the cutter's material."""
    kit.apply(obj)
    if mat:
        kit.assign(cutter, mat)
    kit.apply(cutter)
    m = obj.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = cutter
    m.solver = "EXACT"
    m.material_mode = "TRANSFER"
    kit.refresh()
    kit.apply(obj)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return obj


def mirrored(objs):
    """Copies of objects mirrored across x = 0, in world space."""
    out = []
    kit.refresh()
    for o in objs:
        kit.apply(o)
        c = bpy.data.objects.new(o.name + "-m", o.data.copy())
        bpy.context.scene.collection.objects.link(c)
        c.matrix_world = o.matrix_world.copy()
        kit.apply_transform(c)
        c.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
        bm = bmesh.new()
        bm.from_mesh(c.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(c.data)
        bm.free()
        out.append(c)
    return out


def sym(objs):
    """objs plus their mirror images across x = 0."""
    objs = list(objs)
    return objs + mirrored(objs)


# ---------------------------------------------------------------- wheels

def road_wheel(name, r, w, loc, side, hub="chrome:steel", tyre="rubber:tyre",
               rim=None, whitewall=False, segments=18):
    """A toy road wheel about X: rounded rubber tyre, dished rim and a
    domed hub cap on the outer face (side +1 right, -1 left)."""
    s = 1 if side > 0 else -1
    h = w / 2
    mats = [tyre, hub, rim or hub, "paint:whitewall"]
    T, H, R, W = 0, 1, 2, 3
    wall = W if whitewall else T
    prof = [
        (0.0, -h * s, T), (r * 0.8, -h * s, T),
        (r * 0.96, -(h - w * 0.12) * s, T), (r, -(h - w * 0.3) * s, T),
        (r, (h - w * 0.3) * s, T), (r * 0.96, (h - w * 0.12) * s, wall),
        (r * 0.8, h * s, R), (r * 0.62, (h - w * 0.14) * s, H),
        (r * 0.42, (h + w * 0.0) * s, H), (r * 0.18, (h + w * 0.06) * s, H),
        (0.0, (h + w * 0.07) * s, H),
    ]
    obj = spin(name, prof, mats, loc, segments)
    kit.shade(obj, 50)
    obj["radius"] = r
    return obj


def rail_wheelset(name, r, loc, spokes=0, centre="paint:team2",
                  gauge=0.09, width=0.008, crank=None, segments=14):
    """Two flanged rail wheels on an axle, about X, at x = +-gauge/2.
    spokes > 0 gives a spoked driving wheel with a counterweight and
    (crank = radius) a crank pin on each outer face."""
    parts = []
    for s in (1, -1):
        x = s * gauge / 2
        h = width / 2
        ins, out = x - s * h, x + s * h
        prof = [
            (0.0, ins, 0), (r + 0.0028, ins, 0),
            (r + 0.0028, ins + s * 0.0012, 0), (r, ins + s * 0.002, 0),
            (r * 0.98, out, 3),
            (r * 0.8, out - s * 0.0012, 1 if spokes else 3),
            (r * 0.3, out - s * 0.0012, 2),
            (0.0, out + s * 0.0008, 2),
        ]
        mats = ["metal:steel", "metal:chassis", "chrome:steel", centre]
        parts.append(spin(name + "-w", prof, mats, (0, 0, 0), segments))
        if spokes:
            zx = out - s * 0.0012
            for k in range(spokes):
                a = k / spokes * TAU
                c = Vector((zx, math.cos(a) * r * 0.55, math.sin(a) * r * 0.55))
                sp = blk(name + "-sp", (0.0016, r * 0.56, r * 0.13), c,
                         centre, edge=1)
                sp.rotation_euler = (a, 0, 0)
                parts.append(sp)
            if crank:
                parts.append(cyl(name + "-pin", 0.0022, 0.004,
                                 (out + s * 0.0016, 0, crank), "X",
                                 "chrome:steel", verts=8))
    parts.append(cyl(name + "-axle", 0.003, gauge - width, (0, 0, 0), "X",
                     "metal:chassis", verts=8, cap=False))
    obj = kit.join(parts, name)
    obj.location = loc
    kit.shade(obj, 45)
    obj["radius"] = r
    return obj


# ---------------------------------------------------------------- finishing

def finish(root, parts, wheels=(), rest=()):
    """Join the body parts into "<root>-body", parent everything under the
    root, write UVs and shading."""
    if os.environ.get("VDEBUG"):
        kit.refresh()
        dg = bpy.context.evaluated_depsgraph_get()
        cost = {}
        for p in parts:
            me = p.evaluated_get(dg).data
            key = p.name.split(".")[0]
            cost[key] = cost.get(key, 0) + sum(len(f.vertices) - 2
                                               for f in me.polygons)
            if key.endswith("cab"):
                idx = [f.material_index for f in me.polygons]
                print("   cab mats", {m.name: idx.count(i) for i, m in
                                      enumerate(p.data.materials)})
        for w in list(wheels) + list(rest):
            me = w.evaluated_get(dg).data
            key = "W:" + w.name.split(".")[0]
            cost[key] = sum(len(f.vertices) - 2 for f in me.polygons)
        print("COST", root.name, sorted(cost.items(), key=lambda kv: -kv[1]))
    body = kit.join([p for p in parts if p], root.name + "-body")
    kit.shade(body, 38)
    kids = [body] + list(wheels) + list(rest)
    for k in kids:
        kit.uv_box(k)
        kit.parent(k, root)
    return root


def fit(root, length=None):
    """Centre a vehicle on its footprint in x and y and, given a length,
    scale it uniformly about its base so it is exactly that long."""
    lo, hi = bounds(root)
    c = (lo + hi) / 2
    k = length / (hi.y - lo.y) if length else 1.0
    for o in root.children:
        if o.type != "MESH":
            continue
        if k != 1.0:
            o.data.transform(Matrix.Scale(k, 4))
        o.location = Vector(((o.location.x - c.x) * k,
                             (o.location.y - c.y) * k, o.location.z * k))
        for key in ("radius", "crank"):
            if key in o:
                o[key] = o[key] * k
    kit.refresh()
    return k


def clean_names(path):
    """Blender keeps object names unique ("wheel_fl.003"); strip those
    suffixes from the GLB's node and mesh names so every vehicle's wheels
    are plainly wheel_fl, wheel_fr, ..."""
    import json
    import re
    import struct
    data = open(path, "rb").read()
    magic, ver, _ = struct.unpack("<III", data[:12])
    jlen, jtype = struct.unpack("<II", data[12:20])
    js = json.loads(data[20:20 + jlen])
    rest = data[20 + jlen:]
    for key in ("nodes", "meshes"):
        for n in js.get(key, []):
            if "name" in n:
                n["name"] = re.sub(r"\.\d{3}$", "", n["name"])
    out = json.dumps(js, separators=(",", ":")).encode()
    out += b" " * ((4 - len(out) % 4) % 4)
    total = 20 + len(out) + len(rest)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", magic, ver, total))
        f.write(struct.pack("<II", len(out), jtype))
        f.write(out)
        f.write(rest)


def tris(root):
    n = 0
    for o in kit.descendants(root):
        if o.type == "MESH":
            kit.refresh()
            dg = bpy.context.evaluated_depsgraph_get()
            me = o.evaluated_get(dg).data
            n += sum(len(p.vertices) - 2 for p in me.polygons)
    return n


def bounds(root):
    kit.refresh()
    inv = root.matrix_world.inverted()
    lo = Vector((1e9,) * 3)
    hi = -lo
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        for v in o.data.vertices:
            p = inv @ (o.matrix_world @ v.co)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi
