"""The Miner's runtime copy: reduction of the detailed master, and the frozen
neutral copy that ordinary builds load.

Normal builds append assets/arena/blender/runtime/miner-runtime-v<N>.blend
(load_reviewed_copy); they never repeat the sculpt or the reduction. The
detailed editable source is figure_miner_rig.build_master(); the reviewed
master .blend is kept in work/arena/2026-10-08-roster/miner/master/.

Reduction (reduce_runtime): a collapse of each mesh to a measured budget,
weighted so the face and the fists keep their detail; the skin's shading
is sampled from the master's surface (custom normals); the weighted
garments and boots join the skin as one skinned mesh; bone-attached pieces
are joined per bone and material; every mesh gets world-scale UVs (the
weave, hide and wood relief) and the painted pigment layer
(figure_miner_paint). Bone names lose their dot ("miner.head" ->
"minerhead"), as three.js names them anyway.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_miner_paint as paint

VERSION = 1
CANONICAL_CACHE = Path(__file__).resolve().parent / "runtime" / f"miner-runtime-v{VERSION}.blend"
FACE_CONTROLS = {"miner" + p for p in ("eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")}
SKIN_TRIANGLES = 15300
DETAIL_EDGES = 2200  # face and fist edges split after the uniform collapse
MAX_TRIANGLES = 30000
UV_TILE = {"weave": 0.26, "hide": 0.30, "wood": 0.60}


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ------------------------------------------------------------- loading

def load_reviewed_copy(root_name="miner"):
    """Append the frozen neutral copy; normal builds never reduce the master."""
    if not CANONICAL_CACHE.is_file():
        raise RuntimeError(f"Missing reviewed Miner runtime copy {CANONICAL_CACHE}")
    with bpy.data.libraries.load(str(CANONICAL_CACHE), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj and obj.name not in bpy.context.scene.objects:
            bpy.context.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj and obj.name == root_name)
    objects = kit.descendants(root)
    assert all(obj.library is None for obj in objects)
    assert len([obj for obj in objects if obj.type == "ARMATURE"]) == 1
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    # Shared materials ("weave:team", ...) already made by another figure in
    # this session come in renamed "<name>.001": use the session's own.
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            m = slot.material
            if m and "." in m.name.rsplit(":", 1)[-1]:
                base = m.name.rsplit(".", 1)[0]
                if base in bpy.data.materials:
                    slot.material = bpy.data.materials[base]
    root["runtimeCopySource"] = "runtime/" + CANONICAL_CACHE.name
    kit.refresh()
    return root


# ------------------------------------------------------------- reduction

def source_surface(mesh):
    mesh.calc_loop_triangles()
    points = np.empty(len(mesh.vertices) * 3)
    normals = np.empty_like(points)
    faces = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int64)
    mesh.vertices.foreach_get("co", points)
    mesh.vertices.foreach_get("normal", normals)
    mesh.loop_triangles.foreach_get("vertices", faces)
    points, normals, faces = points.reshape(-1, 3), normals.reshape(-1, 3), faces.reshape(-1, 3)
    tree = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    return tree, points, normals, faces


def sampled_normals(mesh, surface):
    tree, points, normals, faces = surface
    out = np.empty((len(mesh.vertices), 3), dtype=np.float32)
    for v in mesh.vertices:
        point, face_normal, index, _ = tree.find_nearest(v.co)
        a, b, c = faces[index]
        n = barycentric_transform(point, Vector(points[a]), Vector(points[b]), Vector(points[c]),
                                  Vector(normals[a]), Vector(normals[b]), Vector(normals[c]))
        out[v.index] = n.normalized() if n.length > 1e-5 else face_normal
    return out


def detail_group(obj, fn):
    """A vertex group that tells the collapse where to keep vertices."""
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    w = np.clip(fn(co.reshape(-1, 3)), 0, 1)
    group = obj.vertex_groups.new(name="runtime-detail")
    q = np.rint(w * 100).astype(int)
    for value in np.unique(q):
        idx = np.flatnonzero(q == value)
        group.add(idx.tolist(), value / 100, "REPLACE")
    return group


def detail_region(p):
    """Where the skin needs more samples than a uniform collapse keeps:
    the face's planes and the ears, and the fists' fingers and knuckles."""
    x, y, z = p
    face = 1.000 < z < 1.180 and y > -0.030 and abs(x) < 0.105
    fist = abs(x) > 0.185 and 0.395 < z < 0.560
    return face or fist


def refine(obj, surface, edge_budget, rounds=2):
    """Split the longest edges in the detail regions and project every
    vertex there back onto the master's surface (sumo runtime's method)."""
    tree = surface[0]
    added = 0
    for r in range(rounds):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        edges = [e for e in bm.edges if detail_region((e.verts[0].co + e.verts[1].co) * 0.5)]
        edges.sort(key=lambda e: e.calc_length(), reverse=True)
        chosen = edges[:edge_budget // rounds]
        before = len(bm.faces)
        bmesh.ops.subdivide_edges(bm, edges=chosen, cuts=1, use_grid_fill=True, smooth=0)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        for v in bm.verts:
            if detail_region(v.co):
                point, _, _, dist = tree.find_nearest(v.co)
                if point is not None and dist < 0.006:
                    v.co = point
        added += len(bm.faces) - before
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    return added


def isoline(bm, f, select):
    """Cut a mesh along the zero line of f: split every selected edge whose
    ends lie on both sides at the crossing (weights interpolated) and join
    the new points across each face."""
    vals = {v: f(v.co) for v in bm.verts}
    crossing = [e for e in bm.edges if select((e.verts[0].co + e.verts[1].co) * 0.5)
                and vals[e.verts[0]] * vals[e.verts[1]] < 0]
    made = []
    for e in crossing:
        a, b = e.verts
        t = vals[a] / (vals[a] - vals[b])
        if 1e-4 < t < 1 - 1e-4:
            _, v = bmesh.utils.edge_split(e, a, t)
            made.append(v)
    if made:
        bmesh.ops.connect_verts(bm, verts=made, check_degenerate=True)
    return len(made)


def crisp_regions(obj):
    """Cut the reduced skin exactly along the garments' edge planes (the
    neckline, the dungarees' waist, the rolled cuffs) and repaint it, so
    shirt, skin and denim meet on straight seams instead of the coarse
    triangles' jagged edges."""
    import figure_miner_dress as md
    import figure_miner_sculpt as ms
    bm = bmesh.new()
    bm.from_mesh(obj.data)

    def cut(select, co, no):
        faces = [f for f in bm.faces if select(f.calc_center_median())]
        if not faces:
            return
        edges = list({e for f in faces for e in f.edges})
        verts = list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=faces + edges + verts, dist=1e-6, plane_co=co, plane_no=no)
    isoline(bm, lambda co: md.neck_f(co.x, co.y, co.z),
            lambda c: 0.88 < c.z < 1.08 and math.hypot(c.x, c.y + 0.016) < 0.14)
    cut(lambda c: abs(c.z - md.WAIST_Z) < 0.04 and abs(c.x) < 0.215, Vector((0, 0, md.WAIST_Z)), Vector((0, 0, 1)))
    for side in (-1, 1):
        c0, ax = md.cuff_plane(side)
        cut(lambda c: (c - c0).length < 0.10 and c.x * side > 0.12, c0, ax)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    names = [g.name for g in obj.vertex_groups]
    deform = [n.split(".", 1)[1] for n in names]
    W = np.zeros((len(obj.data.vertices), len(names)))
    for v in obj.data.vertices:
        for ge in v.groups:
            W[v.index, ge.group] = ge.weight
    md.paint_regions(obj, W, deform)


def collapse(obj, target, group=None, factor=6.0):
    before = triangles(obj)
    if before <= target:
        return {"name": obj.name, "source": before, "runtime": before}
    select(obj)
    mod = obj.modifiers.new("Runtime collapse", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / before
    mod.use_collapse_triangulate = True
    group_name = group.name if group is not None else None
    if group_name:
        mod.vertex_group = group_name
        mod.vertex_group_factor = factor
    # Collapse the neutral source before its armature deformation; the
    # modifier carries the fine bone weights to the kept vertices.
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if group_name and group_name in obj.vertex_groups:
        obj.vertex_groups.remove(obj.vertex_groups[group_name])
    return {"name": obj.name, "source": before, "runtime": triangles(obj)}


def budget(name):
    """Triangles per bone-attached or garment piece, by what it is."""
    table = [("moustache", 2300), ("hair", 950), ("brow", 220), ("lid", 60), ("eyelet", 8), ("pupil", 60),
             ("eye", 120), ("iris", 60), ("button", 24),
             ("mouth", 90), ("teeth", 40), ("hat-crown", 700), ("hat-brim", 400), ("hat-band", 140),
             ("hat-comb", 100), ("lamp-body", 240), ("lamp-lens", 100), ("lamp-bracket", 70), ("lamp", 36),
             ("pick-haft", 220), ("pick-point", 200), ("pick-chisel", 200), ("pick-eye", 100), ("pick", 36),
             ("boot", 540), ("sole", 140), ("heel", 50), ("lace", 14), ("bow", 14),
             ("bib-pocket", 60), ("bib", 340), ("back-panel", 220), ("seat-pocket", 40), ("strap", 220),
             ("buckle-bar", 16), ("buckle", 56), ("stitch", 50), ("collar-band", 1100),
             ("collar-point", 70), ("placket", 36), ("waistband", 110),
             ("turnup", 220), ("cuff", 140)]
    for key, value in table:
        if key in name:
            return value
    return 120


def uv_box(obj):
    """Per-face planar UVs in texture repeats at the figures' small tile."""
    me = obj.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        tex = me.materials[f.material_index].name.split(":")[0] if me.materials else "plain"
        tile = UV_TILE.get(tex, kit.TILE_SMALL.get(tex, kit.TILE.get(tex, 1.0)))
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            c = loop.vert.co
            if ax == 2:
                u, v = c.x * (1 if n.z >= 0 else -1), c.y
            elif ax == 0:
                u, v = c.y * (1 if n.x >= 0 else -1), c.z
            else:
                u, v = -c.x * (1 if n.y >= 0 else -1), c.z
            loop[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()


def join_weighted(skin, others):
    """Join weighted meshes into the skin (vertex groups merge by name)."""
    if not others:
        return skin
    bpy.ops.object.select_all(action="DESELECT")
    for o in others + [skin]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = skin
    bpy.ops.object.join()
    return skin


def join_attached(root):
    """Join bone-attached pieces per (bone, material); face controls stay."""
    buckets = {}
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.name in FACE_CONTROLS or obj.parent_type != "BONE":
            continue
        if len(obj.data.materials) != 1:
            key = (obj.parent, obj.parent_bone, None)
        else:
            key = (obj.parent, obj.parent_bone, obj.data.materials[0].name)
        buckets.setdefault(key, []).append(obj)
    joined = []
    for (rig, bone, mat), pieces in buckets.items():
        if len(pieces) < 2:
            continue
        name = "miner." + bone.split(".")[-1] + "-" + (mat.split(":")[0] if mat else "parts")
        obj = kit.join(pieces, name)
        world = obj.matrix_world.copy()
        obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", bone
        obj.matrix_world = world
        joined.append(obj.name)
    kit.refresh()
    return joined


def normalize_names(root):
    rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
    rename = {b.name: b.name.replace("miner.", "miner", 1) for b in rig.data.bones}
    for bone in rig.data.bones:
        bone.name = rename[bone.name]
    for obj in kit.descendants(root):
        if obj.parent_type == "BONE" and obj.parent_bone in rename:
            obj.parent_bone = rename[obj.parent_bone]
        if obj.type == "MESH":
            for group in obj.vertex_groups:
                if group.name in rename:
                    group.name = rename[group.name]
            for mod in obj.modifiers:
                if mod.type == "ARMATURE":
                    mod.object = rig


def paint_all(root):
    kit.refresh()
    inv = np.array(root.matrix_world.inverted())
    for obj in kit.descendants(root):
        if obj.type == "MESH":
            paint.paint(obj, inv @ np.array(obj.matrix_world))
            ao = obj.data.color_attributes.get("AO") or obj.data.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
            ao.data.foreach_set("color", np.ones(len(ao.data) * 4, dtype=np.float32))
            obj.data.color_attributes.active_color = ao
            obj.data.color_attributes.render_color_index = list(obj.data.color_attributes).index(ao)


def reduce_runtime(root):
    """Reduce a freshly built detailed master in place."""
    kit.refresh()
    objects = kit.descendants(root)
    skin = next(o for o in objects if o.get("continuousSkin"))
    report = []
    surface = source_surface(skin.data)
    report.append(collapse(skin, SKIN_TRIANGLES - 2 * DETAIL_EDGES))
    report.append({"name": "skin-detail", "source": 0, "runtime": refine(skin, surface, DETAIL_EDGES)})
    import figure_miner_dress as md
    md.set_neckline(json.loads(root["neckline"]))
    crisp_regions(skin)
    normals = sampled_normals(skin.data, surface)
    del surface
    weighted = [o for o in objects if o.type == "MESH" and o is not skin and o.parent_type != "BONE"
                and any(m.type == "ARMATURE" for m in o.modifiers)]
    for obj in objects:
        if obj.type == "MESH" and obj is not skin:
            report.append(collapse(obj, budget(obj.name)))
    # Keep the skin's sampled normals through the join (as an attribute).
    attr = skin.data.attributes.new("miner-normal", "FLOAT_VECTOR", "POINT")
    attr.data.foreach_set("vector", normals.reshape(-1))
    for o in weighted:
        n = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get("normal", n)
        a = o.data.attributes.new("miner-normal", "FLOAT_VECTOR", "POINT")
        a.data.foreach_set("vector", n)
    skin = join_weighted(skin, weighted)
    skin.name = "miner.skin"
    joined = join_attached(root)
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        uv_box(obj)
        for face in obj.data.polygons:
            face.use_smooth = True
        a = obj.data.attributes.get("miner-normal")
        if a is not None:
            n = np.empty(len(a.data) * 3, dtype=np.float32)
            a.data.foreach_get("vector", n)
            obj.data.normals_split_custom_set_from_vertices(n.reshape(-1, 3).tolist())
            obj.data.attributes.remove(a)
        else:
            kit.shade(obj, 50)
    normalize_names(root)
    paint_all(root)
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    count = sum(triangles(o) for o in meshes)
    root["unoptimized"] = False
    root["runtimeTriangles"] = count
    root["runtimeReduction"] = json.dumps({"perPart": report, "joined": joined})
    groups = {}
    for r in report:
        key = r["name"].split(".")[-1].rstrip("-0123456789").split("-")[0].rstrip("0123456789LRTruealsF")
        groups[key] = groups.get(key, 0) + r["runtime"]
    print("MINER BUDGET", json.dumps(sorted(groups.items(), key=lambda kv: -kv[1])[:30]), flush=True)
    assert count < MAX_TRIANGLES, f"Miner runtime {count} exceeds {MAX_TRIANGLES}"
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    print("MINER RUNTIME", json.dumps({"triangles": count, "meshes": len(meshes),
                                       "skinTriangles": triangles(skin)}), flush=True)
    kit.refresh()
    return root


def finish_ao(root):
    """After the ordinary collector's AO bake: AO *= pigment, one layer."""
    for obj in kit.descendants(root):
        if obj.type == "MESH":
            paint.combine(obj)


def freeze(root, path):
    """Save only the Miner's hierarchy (neutral AO, pigment kept) to path."""
    keep = set(kit.descendants(root))
    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    for m in bpy.data.materials:
        if m.use_nodes:
            for node in list(m.node_tree.nodes):
                if node.type == "TEX_IMAGE":
                    m.node_tree.nodes.remove(node)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)
    for rig in [o for o in keep if o.type == "ARMATURE"]:
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 beside it
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    print("MINER FROZEN", path, path.stat().st_size, flush=True)
