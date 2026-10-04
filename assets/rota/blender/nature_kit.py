"""Helpers for Rota's nature and small props (nature.py).

Arena's forest kit (assets/arena/blender/forest_kit.py) holds the clump-foam
crowns, layered pine boughs and fractured rocks; its numbers were tuned for
Arena's metre-sized props. Rota's trees are a sixteenth of that, so the
organic pieces are built at a *work scale* (`with work(16):` multiplies the
kit's texture densities and AO grid by 16), then shrunk to their true size
with `shrink()`: UVs keep the right density, and every noise frequency and
threshold of the forest kit behaves as it does for Arena.

Engineered props (fences, barriers, signals) are built at true size with
the small part helpers below, each part made in its own local frame and
merged into one Builder with its UVs kept.
"""

import math
import random
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector

import rkit

kit = rkit.kit
import forest_kit as fk  # noqa: E402  (on the path rkit set up)

TAU = math.tau

# Foliage UVs at rkit.TILE's density, not Arena's finer foam grain.
fk.DEFAULT_SCALES["foliage"] = 1.0


def tint(name, hex_colour):
    return kit.tint(name, hex_colour)


# ---------------------------------------------------------------- scale

_SCALE = [1.0]


@contextmanager
def work(scale):
    """Build at `scale` times the true size (see the module docstring)."""
    saved = dict(kit.TILE)
    edge = kit.AO_EDGE
    for k in kit.TILE:
        kit.TILE[k] = saved[k] * scale
    kit.AO_EDGE = edge * scale
    _SCALE[0] = scale
    try:
        yield scale
    finally:
        kit.TILE.clear()
        kit.TILE.update(saved)
        kit.AO_EDGE = edge
        _SCALE[0] = 1.0


def shrink(objs, scale):
    """Scale meshes built at a work scale down to their true size."""
    m = Matrix.Scale(1 / scale, 4)
    for o in objs:
        if o.type == "MESH":
            o.data.transform(m)
            o.data.update()


def scaled_rule(fn, scale):
    """A light or normal rule written for work-scale coordinates."""
    if fn is None:
        return None
    return lambda co, n: fn(Vector(co) * scale, n)


# ---------------------------------------------------------------- parts

def part(b, matrix, build):
    """Build a part in its own frame (build(tmp) fills a fresh Builder),
    then merge it into b moved by `matrix`, keeping its UVs."""
    tmp = fk.Builder("__part")
    tmp.uv_scales = dict(b.uv_scales)
    build(tmp)
    faces = b.merge(tmp.bm, None, matrix, mats=tmp.mats, uv="keep")
    tmp.bm.free()
    return faces


def cube_bm(size, bevel=0.0, segments=1, edge=None):
    """A box bmesh centred on the origin, chamfered, with its long edges
    cut so baked AO has vertices to live on."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel,
                        offset_type="OFFSET", segments=segments, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    edge = edge or kit.AO_EDGE
    for _ in range(3):
        long = [e for e in bm.edges if e.calc_length() > edge * 1.01]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    return bm


def cube(b, size, mat, at=(0, 0, 0), rot=None, bevel=0.0, segments=1,
         edge=None):
    """A chamfered box merged into b, centred at `at` (rot: a 3x3 or 4x4
    matrix, or a (rx, ry, rz) Euler in radians)."""
    bm = cube_bm(size, bevel, segments, edge)
    m = Matrix.Translation(Vector(at)) @ _rot4(rot)
    tmp = fk.Builder("__cube")
    tmp.uv_scales = dict(b.uv_scales)
    tmp.merge(bm, mat)
    bm.free()
    faces = b.merge(tmp.bm, None, m, mats=tmp.mats, uv="keep")
    tmp.bm.free()
    return faces


def _rot4(rot):
    if rot is None:
        return Matrix.Identity(4)
    if isinstance(rot, Matrix):
        return rot.to_4x4()
    from mathutils import Euler
    return Euler(rot, "XYZ").to_matrix().to_4x4()


def lathe(b, profile, segs, mat, at=(0, 0, 0), rot=None, cap_bottom=False,
          cap_top=False, u_reps=None, vert=None):
    """fk.revolve in a local frame (profile: (radius, z) pairs about z)."""
    m = Matrix.Translation(Vector(at)) @ _rot4(rot)
    return part(b, m, lambda t: fk.revolve(
        t, profile, segs, mat, u_reps=u_reps, vert=vert,
        cap_bottom=cap_bottom, cap_top=cap_top))


def rod(b, p0, p1, radius, mat, segs=8, cap=True, r1=None):
    """A straight round rod between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
    r1 = radius if r1 is None else r1
    rings = max(1, math.ceil(L / kit.AO_EDGE))
    prof = [(radius + (r1 - radius) * i / rings, L * i / rings)
            for i in range(rings + 1)]
    return lathe(b, prof, segs, mat, at=p0, rot=rot, cap_bottom=cap,
                 cap_top=cap)


def beam(b, p0, p1, w, h, mat, up=(0, 0, 1), bevel=0.0):
    """A square-section beam (w across, h along `up`) between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    x = d.normalized()
    u = Vector(up)
    u = (u - x * u.dot(x)).normalized()
    y = u.cross(x)
    m = Matrix((x, y, u)).transposed()
    return cube(b, (d.length, w, h), mat, at=(p0 + p1) / 2, rot=m,
                bevel=bevel)


def prism(b, poly, depth, mat, y0=0.0):
    """A flat plate: a 2D polygon in the XZ plane (x, z) extruded along Y
    from y0 to y0 + depth (a sign board, a stripe, a finger)."""
    n = len(poly)
    front = [b.vert((x, y0, z)) for x, z in poly]
    back = [b.vert((x, y0 + depth, z)) for x, z in poly]
    faces = [b.face(list(reversed(front)), mat), b.face(back, mat)]
    for i in range(n):
        j = (i + 1) % n
        faces.append(b.face([front[i], front[j], back[j], back[i]], mat))
    faces = [f for f in faces if f]
    bmesh.ops.recalc_face_normals(b.bm, faces=faces)
    for f in faces:
        b.planar(f)
    return faces


def clip_poly(poly, x0, x1, z0, z1):
    """Sutherland-Hodgman: clip a 2D polygon to a rectangle."""
    def clip(pts, inside, cut):
        out = []
        for i in range(len(pts)):
            a, c = pts[i - 1], pts[i]
            if inside(c):
                if not inside(a):
                    out.append(cut(a, c))
                out.append(c)
            elif inside(a):
                out.append(cut(a, c))
        return out

    def at_x(xv):
        return lambda a, c: (xv, a[1] + (c[1] - a[1]) * (xv - a[0]) /
                             (c[0] - a[0]))

    def at_z(zv):
        return lambda a, c: (a[0] + (c[0] - a[0]) * (zv - a[1]) /
                             (c[1] - a[1]), zv)
    pts = list(poly)
    for inside, cut in ((lambda p: p[0] >= x0, at_x(x0)),
                        (lambda p: p[0] <= x1, at_x(x1)),
                        (lambda p: p[1] >= z0, at_z(z0)),
                        (lambda p: p[1] <= z1, at_z(z1))):
        if not pts:
            break
        pts = clip(pts, inside, cut)
    return pts


# ---------------------------------------------------------------- checks

def bounds(root):
    kit.refresh()
    inv = root.matrix_world.inverted()
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in kit.descendants(root):
        if o.type == "MESH":
            for v in o.data.vertices:
                p = inv @ (o.matrix_world @ v.co)
                lo = Vector(map(min, lo, p))
                hi = Vector(map(max, hi, p))
    return lo, hi


def report(root):
    n = fk.tri_count(root)
    lo, hi = bounds(root)
    s = hi - lo
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print(f"ROOT {root.name}: {n} tris  size {s.x:.3f} x {s.y:.3f} x "
          f"{s.z:.3f}  x {lo.x:.3f}..{hi.x:.3f} y {lo.y:.3f}..{hi.y:.3f} "
          f"z {lo.z:.3f}..{hi.z:.3f}  {mats}")
    return n, lo, hi, mats


# ---------------------------------------------------------------- previews

def ref_square(name, at=(0, 0), size=1.0, cells=1):
    """A grid of 1 m reference squares: a meadow tile with a thin white
    outline, as the game's board would show it (never exported)."""
    b = fk.Builder(name)
    x0, y0 = at
    w = 0.008
    for i in range(cells):
        for j in range(cells):
            cx, cy = x0 + (i - (cells - 1) / 2) * size, \
                y0 + (j - (cells - 1) / 2) * size
            cube(b, (size - w, size - w, 0.004), "grass:preview-meadow",
                 at=(cx, cy, -0.003), edge=0.25)
            for k in range(4):
                a = k * math.pi / 2
                dx, dy = math.cos(a) * size / 2, math.sin(a) * size / 2
                L = size + w
                sz = (w, L, 0.002) if k % 2 == 0 else (L, w, 0.002)
                cube(b, sz, "plain:preview-line", at=(cx + dx, cy + dy, -0.0005),
                     edge=0.25)
    obj = b.build(smooth=10)
    kit.fill_ao([obj])
    return obj


tint("preview-meadow", "#8f9c62")
tint("preview-line", "#f2efe6")


def shot(path, roots, elevation=55, azimuth=0, markers=(), size=1100,
         margin=1.05, samples=64):
    """kit.preview on just these roots (and markers), everything else
    hidden from the render."""
    scene = bpy.context.scene
    shown = set(markers)
    for r in roots:
        shown.update(kit.descendants(r))
    hidden = []
    for o in scene.objects:
        if o.type == "MESH" and o not in shown and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    scene.view_settings.view_transform = "AgX"
    game_look()
    lo_z = min((o.matrix_world @ Vector(c)).z for o in shown
               if o.type == "MESH" for c in o.bound_box)
    floor = kit.box("__shot-floor", (80, 80, 0.0004), (0, 0, lo_z - 0.0005),
                    mat="plain:" + tint("preview-floor", "#b9b5ab"),
                    grid=False)
    kit.fill_ao([floor])
    kit.preview(path, list(roots) + list(markers), size=size,
                elevation=elevation, azimuth=azimuth, margin=margin,
                samples=samples)
    bpy.data.objects.remove(floor, do_unlink=True)
    for o in hidden:
        o.hide_render = False


# How the game paints a tile over a tint (components/game/arena/
# materials.ts): the tile is washed out, divided by its own mean and mixed
# in at a strength, so the Blender tint carries the colour. Previews only.
LOOK = {"foliage": (0.7, 0.5), "bark": (0.8, 0.55), "rock": (0.7, 0.45),
        "stone": (0.5, 0.45), "wood": (0.65, 0.5), "grass": (0.6, 0.45),
        "sand": (0.6, 0.4), "plaster": (0.6, 0.35), "metal": (0.6, 0.4)}
_LOOKED = set()


def _mean(img):
    import numpy as np
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(-1, 4)[:, :3].mean(axis=0)


def game_look():
    means = {}
    for m in bpy.data.materials:
        if m.name in _LOOKED or not m.node_tree:
            continue
        _LOOKED.add(m.name)
        family = m.name.partition(":")[0]
        nt = m.node_tree
        tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
        if not tex or not tex.image:
            continue
        mul = next(l.to_node for l in nt.links
                   if l.from_node == tex and l.to_node.type == "MIX")
        desat, strength = LOOK.get(family, (0.6, 0.4))
        img = tex.image
        if img.name not in means:
            means[img.name] = _mean(img)
        mean = means[img.name]
        grey = float(mean.mean())
        mean = [c * (1 - desat) + grey * desat for c in mean]
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Saturation"].default_value = 1 - desat
        div = nt.nodes.new("ShaderNodeMix")
        div.data_type = "RGBA"
        div.blend_type = "MULTIPLY"
        div.inputs["Factor"].default_value = 1
        div.inputs[7].default_value = (*[1 / max(c, 1e-3) for c in mean], 1)
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MIX"
        mix.inputs["Factor"].default_value = strength
        mix.inputs[6].default_value = (1, 1, 1, 1)
        nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])
        nt.links.new(hsv.outputs["Color"], div.inputs[6])
        nt.links.new(div.outputs[2], mix.inputs[7])
        nt.links.new(mix.outputs[2], mul.inputs[6])
