"""Clay sculpting helpers for the 8 October 2026 Miner (figure id `miner`).

The Miner is sculpted as clay volumes: finely tessellated lofts, tubes and
ellipsoids are joined into signed-distance grids (OpenVDB through Blender's
SDF grid nodes), their concave meetings rounded by an SDF fillet, then
meshed. That gives authored transitions (deltoid into chest, nose into
cheek, forearm into fist) instead of intersecting primitives. Garment
details that must keep crisp edges (bib, straps, cuffs, collar, boots) are
separate shells snapped onto that surface and skinned from it.

Nothing here is shared with other figures; figure_folk_kit.py supplies the
generic loft/tube/ball builders, unchanged.
"""

import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import kit
import figure_folk_kit as fk

V = fk.V
TAU = math.tau


def g(x, c, r):
    return math.exp(-((x - c) / r) ** 2)


def ss(lo, hi, x):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ssf(lo, hi, x):
    t = max(0.0, min(1.0, (x - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


def table(rows, x):
    """Bounded cubic (Hermite) interpolation through (x, values...) rows:
    smooth sections without the overshoot that bulges a limb."""
    if x <= rows[0][0]:
        return tuple(rows[0][1:])
    if x >= rows[-1][0]:
        return tuple(rows[-1][1:])
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        if x > b[0]:
            continue
        u = (x - a[0]) / (b[0] - a[0])
        p = rows[max(0, i - 1)]
        f = rows[min(len(rows) - 1, i + 2)]
        out = []
        for j in range(1, len(a)):
            ma = (b[j] - p[j]) / max(1e-9, b[0] - p[0])
            mb = (f[j] - a[j]) / max(1e-9, f[0] - a[0])
            h = b[0] - a[0]
            v = ((2 * u ** 3 - 3 * u ** 2 + 1) * a[j] + (u ** 3 - 2 * u ** 2 + u) * ma * h
                 + (-2 * u ** 3 + 3 * u ** 2) * b[j] + (u ** 3 - u ** 2) * mb * h)
            out.append(max(min(a[j], b[j]), min(max(a[j], b[j]), v)))
        return tuple(out)


def path_at(points, t):
    """Catmull-Rom point at arc-length fraction t of the control polygon."""
    pts = [Vector(p) for p in points]
    d = [0.0]
    for a, b in zip(pts, pts[1:]):
        d.append(d[-1] + (b - a).length)
    target = max(0.0, min(1.0, t)) * d[-1]
    i = next((j for j in range(len(pts) - 1) if target <= d[j + 1]), len(pts) - 2)
    f = (target - d[i]) / max(1e-9, d[i + 1] - d[i])
    a, b, c, e = [pts[max(0, min(len(pts) - 1, j))] for j in (i - 1, i, i + 1, i + 2)]
    return 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - e) * f * f
                  + (-a + 3 * b - 3 * c + e) * f ** 3)


def smooth_points(points, n):
    return [path_at(points, t) for t in np.linspace(0, 1, n)]


# ------------------------------------------------------------- primitives

def ellipsoid(name, centre, radii, mat="resin:clay", axes=None, seg=64, rings=32):
    """An ellipsoid with optional axes (columns x, y, z)."""
    o = fk.ball(name, 1.0, (0, 0, 0), mat, scale=(1, 1, 1), seg=seg, rings=rings)
    m = Matrix.Identity(3) if axes is None else Matrix(axes).transposed()
    for v in o.data.vertices:
        p = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]))
        v.co = m @ p + Vector(centre)
    o.data.update()
    return o


def limb(name, points, sections, mat="resin:clay", u_hint=(1, 0, 0), detail=None,
         rows=72, around=48, caps=("pole", "pole"), power=2.0):
    """A loft along a smooth path. sections: (t, width, front, back) where
    width is along u (the hint projected off the axis) and front/back along
    v = axis x u's positive/negative side. detail(t, a) adds radius."""
    rings = []
    hint = Vector(u_hint)
    for t in np.linspace(0, 1, rows):
        p = path_at(points, t)
        ax = (path_at(points, min(1, t + 1e-3)) - path_at(points, max(0, t - 1e-3))).normalized()
        u = (hint - ax * hint.dot(ax))
        if u.length < 1e-6:
            u = ax.orthogonal()
        u.normalize()
        v = ax.cross(u).normalized()
        w, f, b = table(sections, t)
        ring = []
        e = 2.0 / power
        for i in range(around):
            a = i / around * TAU
            s, c = math.sin(a), math.cos(a)
            d = detail(t, a) if detail else 0.0
            ring.append(p + u * fk.spow(s, e) * (w + d * 0.7) + v * fk.spow(c, e) * ((f if c >= 0 else b) + d))
        rings.append(ring)
    return fk.loft(name, rings, mat, start=caps[0], end=caps[1], recalc=True)


def tube(name, points, radii, mat="resin:clay", n=24, samples=None, up=(0, 0, 1), caps=("dome", "dome")):
    pts = [Vector(p) for p in points]
    if samples:
        pts = smooth_points(pts, samples)
        if not isinstance(radii, (list, tuple)) or len(radii) != len(pts):
            rr = radii if isinstance(radii, (list, tuple)) else [radii]
            radii = [rr[min(len(rr) - 1, int(round(i / (len(pts) - 1) * (len(rr) - 1))))] if len(rr) > 1 else rr[0]
                     for i in range(len(pts))]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(pts)
    return fk.tube(name, pts, radii, mat, n=n, up=up, caps=caps)


def tapered(name, points, r0, r1, mat="resin:clay", n=24, samples=24, up=(0, 0, 1), profile=None,
            caps=("dome", "dome"), flat=1.0):
    pts = smooth_points(points, samples)
    radii = []
    for i in range(samples):
        t = i / (samples - 1)
        k = profile(t) if profile else 1.0
        r = (r0 + (r1 - r0) * t) * k
        radii.append((r, r * flat))
    return fk.tube(name, pts, radii, mat, n=n, up=up, caps=caps)


def join(objs, name):
    objs = [o for o in objs if o]
    for o in objs:
        kit.apply(o)
    out = kit.join(objs, name) if len(objs) > 1 else objs[0]
    out.name = name
    return out


# ------------------------------------------------------------- SDF clay

def _sdf_tree(voxel, band, fillet, mean_w, mean_it, offset):
    key = f"miner-sdf-{voxel}-{band}-{fillet}-{mean_w}-{mean_it}-{offset}"
    tree = bpy.data.node_groups.get(key)
    if tree:
        return tree
    tree = bpy.data.node_groups.new(key, "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = tree.nodes, tree.links
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    m2s = N.new("GeometryNodeMeshToSDFGrid")
    m2s.inputs["Voxel Size"].default_value = voxel
    m2s.inputs["Band Width"].default_value = band
    L.new(gi.outputs[0], m2s.inputs["Mesh"])
    out = m2s.outputs[0]
    if fillet:
        f = N.new("GeometryNodeSDFGridFillet")
        f.inputs["Iterations"].default_value = fillet
        L.new(out, f.inputs["Grid"])
        out = f.outputs[0]
    if mean_it:
        m = N.new("GeometryNodeSDFGridMean")
        m.inputs["Width"].default_value = mean_w
        m.inputs["Iterations"].default_value = mean_it
        L.new(out, m.inputs["Grid"])
        out = m.outputs[0]
    if offset:
        o = N.new("GeometryNodeSDFGridOffset")
        o.inputs["Distance"].default_value = offset
        L.new(out, o.inputs["Grid"])
        out = o.outputs[0]
    g2m = N.new("GeometryNodeGridToMesh")
    g2m.inputs["Threshold"].default_value = 0.0
    g2m.inputs["Adaptivity"].default_value = 0.0
    L.new(out, g2m.inputs["Grid"])
    L.new(g2m.outputs[0], go.inputs[0])
    return tree


def sdf(objs, name, voxel=0.0016, fillet=0, mean=(1, 0), offset=0.0, band=3, mat="resin:clay"):
    """Clay union of closed meshes: SDF grid, concave fillet, mean smoothing,
    an optional offset (cloth thickness), then a fresh mesh."""
    o = join(objs, name)
    mod = o.modifiers.new("SDF clay", "NODES")
    mod.node_group = _sdf_tree(voxel, band, fillet, mean[0], mean[1], offset)
    kit.refresh()
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.clear()
    o.data.materials.append(kit.material(mat))
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def relax(o, factor=0.5, iterations=2, group=None):
    mod = o.modifiers.new("relax", "SMOOTH")
    mod.factor, mod.iterations = factor, iterations
    if group:
        mod.vertex_group = group
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)


def decimate(o, ratio):
    mod = o.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ------------------------------------------------------------- surface tools

class Surface:
    """Nearest-point and ray queries on a mesh in world space."""

    def __init__(self, o):
        kit.refresh()
        me = o.data
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        mw = np.array(o.matrix_world)
        self.P = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
        self.points = self.P.tolist()
        me.calc_loop_triangles()
        tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
        me.loop_triangles.foreach_get("vertices", tri)
        self.T = tri.reshape(-1, 3)
        self.tris = self.T.tolist()
        self.tree = BVHTree.FromPolygons(self.points, self.tris, all_triangles=True)
        self.obj = o

    def subset(self, keep):
        """A surface over only the triangles whose corners are all kept
        (keep: a boolean per vertex)."""
        out = Surface.__new__(Surface)
        out.P, out.points, out.obj = self.P, self.points, self.obj
        mask = keep[self.T].all(axis=1)
        out.T = self.T[mask]
        out.tris = out.T.tolist()
        out.tree = BVHTree.FromPolygons(self.points, out.tris, all_triangles=True)
        return out

    def nearest(self, p):
        loc, nrm, idx, dist = self.tree.find_nearest(Vector(p))
        return loc, nrm, idx

    def snap(self, p, lift=0.0):
        loc, nrm, _ = self.nearest(p)
        return loc + nrm * lift, nrm

    def ray(self, origin, direction, lift=0.0):
        loc, nrm, idx, dist = self.tree.ray_cast(Vector(origin), Vector(direction).normalized())
        if loc is None:
            return None, None
        return loc + nrm * lift, nrm


def strip(name, surf, points, width, lift, thick, mat, samples=40, across=9, round_edge=True,
          width_fn=None, curl=0.0):
    """A strap or band lying on a surface: the centreline is snapped, the
    cross-section spans the surface tangent across it, then it is given a
    thickness with softened edges."""
    centre = smooth_points(points, samples)
    snapped = [surf.snap(p) for p in centre]
    rows_out, rows_in = [], []
    for i, (p, n) in enumerate(snapped):
        a = snapped[max(0, i - 1)][0]
        b = snapped[min(len(snapped) - 1, i + 1)][0]
        tdir = (b - a).normalized()
        side = n.cross(tdir).normalized()
        w = width * (width_fn(i / (samples - 1)) if width_fn else 1.0)
        top, bot = [], []
        for j in range(across):
            s = (j / (across - 1)) * 2 - 1
            q, qn = surf.snap(p + side * s * w * 0.5)
            edge = 1 - abs(s) ** 6 if round_edge else 1.0
            top.append(q + qn * (lift + thick * (0.35 + 0.65 * edge)) + qn * curl * s * s)
            bot.append(q + qn * (lift * 0.4))
        rows_out.append(top)
        rows_in.append(bot)
    c = fk.Mesh(name, mat)
    vo = [[c.v(p) for p in r] for r in rows_out]
    vi = [[c.v(p) for p in r] for r in rows_in]
    c.grid(vo, mat)
    c.grid(vi, mat, flip=True)
    # side walls and end caps
    for r_o, r_i in ((vo, vi),):
        for j in range(len(r_o) - 1):
            for k in (0, -1):
                a, b, cc, d = r_o[j][k], r_o[j + 1][k], r_i[j + 1][k], r_i[j][k]
                c.face((a, b, cc, d) if k == -1 else (d, cc, b, a), mat)
        for jj, flip in ((0, True), (-1, False)):
            ring = r_o[jj] + r_i[jj][::-1]
            c.face(ring[::-1] if flip else ring, mat)
    o = c.obj(recalc=True)
    return o


def panel(name, surf, outline, direction, lift, thick, mat, res=0.004, bevel=0.6):
    """A flat garment panel projected onto the surface along `direction`
    (rays from far outside). `outline` is a closed polygon of points on a
    plane facing -direction; it is gridded, projected, lifted and given a
    rounded thickness."""
    d = Vector(direction).normalized()
    # 2D frame on the projection plane
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, 1, 0))
    ux = up.cross(d).normalized()
    uy = d.cross(ux).normalized()
    pts = [Vector(p) for p in outline]
    o2 = sum(pts, Vector()) / len(pts)
    uv = [((p - o2).dot(ux), (p - o2).dot(uy)) for p in pts]
    bm = bmesh.new()
    ring = [bm.verts.new((u, v, 0)) for u, v in uv]
    f = bm.faces.new(ring)
    # subdivide by a grid fill: triangulate then subdivide edges until fine
    bmesh.ops.triangulate(bm, faces=[f])
    for _ in range(8):
        long = [e for e in bm.edges if e.calc_length() > res]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.beautify_fill(bm, faces=bm.faces[:], edges=bm.edges[:])
    boundary = {v for e in bm.edges if e.is_boundary for v in e.verts}
    # distance from boundary for the rounded edge
    bverts = [v.co.copy() for v in boundary]
    top = {}
    for v in list(bm.verts):
        u, w = v.co.x, v.co.y
        origin = o2 + ux * u + uy * w - d * 1.0
        hit, n = surf.ray(origin, d)
        if hit is None:
            hit, n = surf.snap(o2 + ux * u + uy * w)
        edge = min((Vector((u, w, 0)) - b).length for b in bverts) if bverts else 1
        k = min(1.0, edge / max(1e-6, thick * 1.5)) ** bevel
        top[v] = (hit, n, k)
    for v, (hit, n, k) in top.items():
        v.co = hit + n * (lift + thick * (0.3 + 0.7 * k))
    # back face
    back = {}
    for v, (hit, n, k) in top.items():
        back[v] = bm.verts.new(hit + n * lift * 0.3)
    faces = list(bm.faces)
    for fc in faces:
        bm.faces.new([back[v] for v in reversed(fc.verts)])
    for e in [e for e in bm.edges if e.is_boundary and e.verts[0] in top]:
        fc = e.link_faces[0]
        loop = next(lp for lp in fc.loops if lp.edge == e)
        p, q = loop.vert, loop.link_loop_next.vert
        bm.faces.new((q, p, back[p], back[q]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = kit._from_bmesh(name, bm, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ------------------------------------------------------------- skin weights

def copy_weights(target, source_surface, source_weights, names):
    """Give `target` the barycentric weights of the nearest source surface
    point, so a garment shell moves with the body beneath it.
    source_weights: (n_vertices, n_bones) array for source_surface.obj."""
    s = source_surface
    tri = s.T
    P = s.P
    mw = target.matrix_world
    out = np.zeros((len(target.data.vertices), len(names)))
    for v in target.data.vertices:
        p = mw @ v.co
        loc, nrm, idx = s.nearest(p)
        a, b, c = tri[idx]
        A, B, C = Vector(P[a]), Vector(P[b]), Vector(P[c])
        # barycentric of loc in ABC
        v0, v1, v2 = B - A, C - A, loc - A
        d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
        d20, d21 = v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-14:
            w = (1 / 3, 1 / 3, 1 / 3)
        else:
            vb = (d11 * d20 - d01 * d21) / den
            wb = (d00 * d21 - d01 * d20) / den
            w = (1 - vb - wb, vb, wb)
        w = np.clip(np.array(w), 0, 1)
        w = w / max(1e-9, w.sum())
        out[v.index] = w[0] * source_weights[a] + w[1] * source_weights[b] + w[2] * source_weights[c]
    return out


def write_weights(o, weights, names, rig, prefix):
    total = np.maximum(1e-9, weights.sum(axis=1))
    weights = weights / total[:, None]
    # Four influences at most (glTF); keep the strongest and renormalise.
    if weights.shape[1] > 4:
        order = np.argsort(-weights, axis=1)
        mask = np.zeros_like(weights, dtype=bool)
        rows = np.arange(len(weights))[:, None]
        mask[rows, order[:, :4]] = True
        weights = np.where(mask, weights, 0)
        weights = weights / np.maximum(1e-9, weights.sum(axis=1))[:, None]
    o.vertex_groups.clear()
    for j, name in enumerate(names):
        q = np.rint(np.clip(weights[:, j], 0, 1) * 10000).astype(int)
        idx = np.flatnonzero(q > 0)
        if not len(idx):
            continue
        grp = o.vertex_groups.new(name=prefix + name)
        idx = idx[np.argsort(q[idx])]
        cuts = np.flatnonzero(np.diff(q[idx])) + 1
        for batch in np.split(idx, cuts):
            if len(batch):
                grp.add(batch.tolist(), float(q[batch[0]]) / 10000, "REPLACE")
    mod = o.modifiers.new("Miner skin", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False
    world = o.matrix_world.copy()
    o.parent = rig
    o.matrix_world = world


def bone_attach(o, rig, bone):
    kit.apply(o)
    world = o.matrix_world.copy()
    o.parent, o.parent_type, o.parent_bone = rig, "BONE", bone
    o.matrix_world = world
    return o


# ------------------------------------------------------------- poses

def pose_bones(rig, pose, prefix):
    """Set three.js Euler XYZ turns (radians, as moves/miner.ts writes them)
    on common-axis bones. A +Z bone's local axes are three.js's axes, and
    three's XYZ order is Blender's ZYX mode."""
    for pb in rig.pose.bones:
        pb.rotation_mode = "ZYX"
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    for part, rot in pose.items():
        pb = rig.pose.bones.get(prefix + part)
        if pb is None:
            continue
        pb.rotation_euler = tuple(rot[:3])
    kit.refresh()


# ------------------------------------------------------------- review renders

CLAY = "resin:review-clay"


def review_scene(size=(1000, 1000), engine="BLENDER_EEVEE", samples=32):
    sc = bpy.context.scene
    sc.render.engine = engine
    if engine == "CYCLES":
        kit.gpu()
        sc.cycles.samples = samples
    else:
        try:
            sc.eevee.taa_render_samples = samples
        except Exception:
            pass
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.58, 0.62, 1)
    bg.inputs[1].default_value = 0.55
    for name in ("key", "fill", "rim"):
        o = bpy.data.objects.get("review-" + name)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    def light(name, rot, energy, kind="SUN", angle=10):
        d = bpy.data.lights.new("review-" + name, kind)
        d.energy = energy
        if kind == "SUN":
            d.angle = math.radians(angle)
        o = bpy.data.objects.new("review-" + name, d)
        o.rotation_euler = rot
        sc.collection.objects.link(o)
        return o
    light("key", (math.radians(50), math.radians(8), math.radians(-35)), 3.2)
    light("fill", (math.radians(65), math.radians(-10), math.radians(140)), 0.9)
    light("rim", (math.radians(110), 0, math.radians(180)), 1.4)
    if not bpy.data.objects.get("review-floor"):
        fl = kit.box("review-floor", (8, 8, 0.02), (0, 0, -0.01), mat="plain:review-floor", grid=False)
        fl.name = "review-floor"


def camera(name, target, distance, elevation, azimuth, lens=85, ortho=None):
    """azimuth 0 looks at the figure's front (camera on +Y), 90 from its
    left (camera on -X... figure's right side visible), 180 from behind."""
    cam = bpy.data.objects.get(name)
    if cam is None:
        cam = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        bpy.context.scene.collection.objects.link(cam)
    cam.data.lens = lens
    if ortho:
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = "PERSP"
    el, az = math.radians(elevation), math.radians(azimuth)
    t = Vector(target)
    off = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))) * distance
    cam.location = t + off
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def clay_material():
    clay = bpy.data.materials.get("review-clay-neutral")
    if clay is None:
        clay = bpy.data.materials.new("review-clay-neutral")
        clay.use_nodes = True
        bsdf = clay.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (0.60, 0.585, 0.56, 1)
        bsdf.inputs["Roughness"].default_value = 0.55
    return clay


def clay_override(on, objects):
    """Swap every material for one neutral clay (kept per object)."""
    clay = clay_material()
    for o in objects:
        if o.type != "MESH":
            continue
        if on:
            if "review-mats" not in o:
                o["review-mats"] = [m.name if m else "" for m in o.data.materials]
            for i in range(len(o.data.materials)):
                o.data.materials[i] = clay
            if not len(o.data.materials):
                o.data.materials.append(clay)
        elif "review-mats" in o:
            for i, n in enumerate(o["review-mats"]):
                if n and i < len(o.data.materials):
                    o.data.materials[i] = bpy.data.materials[n]
