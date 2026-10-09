"""The Inventor's runtime copy: reduction of the detailed master, and the
frozen neutral copy that ordinary builds load.

Use figure_inventor_stages.py -- runtime v3 after the root signs its source
gallery. The private collector emits a normal loader for the accepted
canonical frozen copy. Detailed master and runtime files stay in the owned
work/arena/2026-10-08-roster/inventor/ folder until root integration.

Reduction (reduce_runtime) follows the Miner's (figure_miner_runtime.py):
a collapse of each mesh to a measured budget, the face and fists refined
and projected back onto the master, the skin cut exactly along its paint
boundaries (neckline, the coat's opening, its waist, the sleeve and glove
edges) and repainted, the master's shading sampled onto the skin, the
weighted garments, skirt and boots kept as separate layered shells,
bone-attached pieces joined per bone and material, world-scale UVs
and the painted pigment layer (figure_inventor_paint). Bone names lose
their dot ("inventor.head" -> "inventorhead").
"""
import json
import math
import re
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_inventor_paint as paint

VERSION = 1
CANONICAL_CACHE = Path(__file__).resolve().parent / "runtime" / f"inventor-runtime-v{VERSION}.blend"
FACE_CONTROLS = {"inventor" + p for p in ("eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")}
SKIN_TRIANGLES = 13600
DETAIL_EDGES = 2200
MAX_TRIANGLES = 30500
UV_TILE = {"weave": 0.24, "hide": 0.30, "rubber": 0.30}


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ------------------------------------------------------------- loading

def load_reviewed_copy(root_name="inventor", path=None):
    """Append the frozen neutral copy; normal builds never reduce the master."""
    path = Path(path) if path else CANONICAL_CACHE
    if not path.is_file():
        raise RuntimeError(f"Missing reviewed Inventor runtime copy {path}")
    with bpy.data.libraries.load(str(path), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj and obj.name not in bpy.context.scene.objects:
            bpy.context.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj and obj.name == root_name)
    objects = kit.descendants(root)
    assert all(obj.library is None for obj in objects)
    assert len([obj for obj in objects if obj.type == "ARMATURE"]) == 1
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            m = slot.material
            if m and "." in m.name.rsplit(":", 1)[-1]:
                base = m.name.rsplit(".", 1)[0]
                if base in bpy.data.materials:
                    slot.material = bpy.data.materials[base]
    root["runtimeCopySource"] = "runtime/" + path.name
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


def detail_region(p):
    """Where the skin needs more samples than a uniform collapse keeps: the
    face and ears, and the gloved fists."""
    x, y, z = p
    face = 1.020 < z < 1.195 and y > -0.035 and abs(x) < 0.098
    fist = abs(x) > 0.165 and 0.405 < z < 0.560
    return face or fist


def refine(obj, surface, edge_budget, rounds=2):
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
    """Cut the reduced skin exactly along its paint boundaries and repaint
    it, so coat, coverall, skin and glove meet on clean seams."""
    import figure_inventor_dress as md
    import figure_inventor_sculpt as ms
    bm = bmesh.new()
    bm.from_mesh(obj.data)

    def cut(select, co, no):
        faces = [f for f in bm.faces if select(f.calc_center_median())]
        if not faces:
            return
        edges = list({e for f in faces for e in f.edges})
        verts = list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=faces + edges + verts, dist=1e-6, plane_co=co, plane_no=no)
    near_neck = lambda c: 0.90 < c.z < 1.06 and math.hypot(c.x, c.y + 0.016) < 0.11
    isoline(bm, lambda co: co.z - ms.neckline_z(co.x, co.y), near_neck)
    # The coat's opening: |x| = x_open(z) on the front, above its waist.
    for side in (-1, 1):
        isoline(bm, lambda co, s=side: s * co.x - (ms.x_open(co.z) - 0.0015),
                lambda c, s=side: ms.COAT_Z - 0.01 < c.z < 0.99 and c.y > -0.01 and 0.0 < s * c.x < 0.10)
    cut(lambda c: abs(c.z - ms.COAT_Z) < 0.03 and abs(c.x) < 0.11 and c.y > -0.02,
        Vector((0, 0, ms.COAT_Z)), Vector((0, 0, 1)))
    for side in (-1, 1):
        for c0, ax in (md.sleeve_plane(side), md.glove_plane(side)):
            cut(lambda c, c0=c0, s=side: (c - c0).length < 0.07 and c.x * s > 0.11, c0, ax)
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


def collapse(obj, target):
    before = triangles(obj)
    if before <= target:
        return {"name": obj.name, "source": before, "runtime": before}
    select(obj)
    mod = obj.modifiers.new("Runtime collapse", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target / before
    mod.use_collapse_triangulate = True
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return {"name": obj.name, "source": before, "runtime": triangles(obj)}


def budget(name):
    table = [("puff", 920), ("hair-cap", 780), ("curl", 40), ("tie", 80), ("brow", 160), ("lid-fold", 50),
             ("lid", 60), ("lash", 40), ("pupil", 90), ("eyelet", 8), ("eye", 120), ("mouth", 36),
             ("goggle-lens", 64), ("goggle-cup", 120), ("goggle-bezel", 64), ("goggle-gasket", 56),
             ("goggle-rivet", 8), ("goggle-strap", 120), ("goggle", 40),
             ("skirt-pocket", 60), ("skirt", 960), ("coat-button", 18), ("belt-button", 18),
             ("half-belt", 90), ("buckle", 30), ("belt", 120), ("placket", 50), ("cover-button", 16),
             ("cargo-snap", 12), ("cargo-flap", 50), ("cargo", 70), ("strap-buckle", 20), ("strap", 120),
             ("harness-ring", 36), ("harness", 90),
             ("boot", 460), ("sole", 90), ("heel", 36), ("eyelet", 6), ("lace", 10),
             ("pack-case", 220), ("pack-edge", 24), ("pack-corner", 20), ("pack-rivet", 6), ("pack-band", 110),
             ("pack-cable", 120), ("gauge-bezel", 80), ("gauge-dial", 30), ("gauge-tick", 6), ("gauge-needle", 10),
             ("gauge-glass", 40), ("valve-window", 20), ("valve-socket", 24), ("valve-bar", 8), ("valve", 30),
             ("lever-pivot", 24), ("lever-knob", 30), ("lever", 20),
             ("coil-foot", 90), ("coil-winding", 460), ("coil-band", 50), ("insulator", 60), ("coil-core", 30),
             ("coil-toroid", 180), ("coil-ball", 240), ("spark", 30),
             ("jar-glass", 80), ("jar-foil", 44), ("jar-lid", 44), ("jar-rod", 16), ("jar-knob", 30),
             ("jar-wire", 50),
             ("wand-grip", 160), ("wand-butt", 40), ("wand-receiver", 120), ("wand-dial", 30), ("wand-knob", 30),
             ("wand-trigger", 24), ("wand-guard", 40), ("wand-barrel", 70), ("wand-coil", 190),
             ("wand-ring", 40), ("wand-fore-collar", 30), ("wand-fore", 70), ("wand-bell", 120),
             ("wand-lens", 40), ("wand-prong", 30), ("wand-hose", 110), ("wand-coupling", 40)]
    for key, value in table:
        if key in name:
            return value
    return 100


def uv_box(obj):
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
    if not others:
        return skin
    bpy.ops.object.select_all(action="DESELECT")
    for o in others + [skin]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = skin
    bpy.ops.object.join()
    return skin


def join_attached(root):
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
        label = mat.split(":")[0] + "-" + mat.split(":")[-1].replace("inventor-", "") if mat else "parts"
        name = "inventor." + bone.split(".")[-1] + "-" + label
        obj = kit.join(pieces, name)
        world = obj.matrix_world.copy()
        obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", bone
        obj.matrix_world = world
        joined.append(obj.name)
    kit.refresh()
    return joined


def normalize_names(root):
    rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
    rename = {b.name: b.name.replace("inventor.", "inventor", 1) for b in rig.data.bones}
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
    """Reduce a freshly built (or loaded) detailed master in place."""
    kit.refresh()
    objects = kit.descendants(root)
    skin = next(o for o in objects if o.get("continuousSkin"))
    report = []
    surface = source_surface(skin.data)
    report.append(collapse(skin, SKIN_TRIANGLES - 2 * DETAIL_EDGES))
    report.append({"name": "skin-detail", "source": 0, "runtime": refine(skin, surface, DETAIL_EDGES)})
    crisp_regions(skin)
    normals = sampled_normals(skin.data, surface)
    del surface
    weighted = [o for o in objects if o.type == "MESH" and o is not skin and o.parent_type != "BONE"
                and any(m.type == "ARMATURE" for m in o.modifiers)]
    for obj in objects:
        if obj.type == "MESH" and obj is not skin:
            report.append(collapse(obj, budget(obj.name)))
    attr = skin.data.attributes.new("inventor-normal", "FLOAT_VECTOR", "POINT")
    attr.data.foreach_set("vector", normals.reshape(-1))
    for o in weighted:
        n = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get("normal", n)
        a = o.data.attributes.new("inventor-normal", "FLOAT_VECTOR", "POINT")
        a.data.foreach_set("vector", n)
    # Keep the connected body distinct from the open coat and boot shells.
    # Joining their disconnected surfaces obscures topology diagnostics and
    # does not make them a continuous anatomical skin.
    skin.name = "inventor.skin"
    joined = join_attached(root)
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        uv_box(obj)
        for face in obj.data.polygons:
            face.use_smooth = True
        a = obj.data.attributes.get("inventor-normal")
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
        key = r["name"].split(".")[-1].rstrip("-0123456789").split("-")[0]
        groups[key] = groups.get(key, 0) + r["runtime"]
    print("INVENTOR BUDGET", json.dumps(sorted(groups.items(), key=lambda kv: -kv[1])[:40]), flush=True)
    assert 20000 <= count <= MAX_TRIANGLES, f"Inventor runtime {count} is outside 20,000–{MAX_TRIANGLES}"
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    print("INVENTOR RUNTIME", json.dumps({"triangles": count, "meshes": len(meshes),
                                          "skinTriangles": triangles(skin)}), flush=True)
    kit.refresh()
    return root


def finish_ao(root):
    """After the ordinary collector's AO bake: AO *= pigment, one layer."""
    for obj in kit.descendants(root):
        if obj.type == "MESH":
            paint.combine(obj)


def freeze(root, path):
    """Save only the Inventor's hierarchy (neutral AO, pigment kept)."""
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
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    print("INVENTOR FROZEN", path, path.stat().st_size, flush=True)


def clean_materials(root):
    """Reuse a collector's shared materials; strip only duplicate suffixes."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            base = re.sub(r"(?:\.\d{3})+$", "", material.name)
            if base != material.name:
                existing = bpy.data.materials.get(base)
                if existing is not None:
                    slot.material = existing
                else:
                    material.name = base


def finalize_copy(root):
    """Freeze the actual authored pigment/AO recipe, four skin influences."""
    from figure_inventor_gates import memory
    for obj in kit.descendants(root):
        if obj.type != "MESH" or not any(m.type == "ARMATURE" for m in obj.modifiers):
            continue
        groups = {g.index: g for g in obj.vertex_groups}
        for vertex in obj.data.vertices:
            influences = sorted(((g.group, g.weight) for g in vertex.groups if g.weight > 0),
                                key=lambda pair: pair[1], reverse=True)
            if not influences:
                raise RuntimeError(f"Unweighted {obj.name} vertex {vertex.index}")
            total = sum(w for _, w in influences[:4])
            for index, _ in influences[4:]:
                groups[index].remove([vertex.index])
            for index, weight in influences[:4]:
                groups[index].add([vertex.index], weight / total, "REPLACE")
    clean_materials(root)
    meshes = [o for o in kit.descendants(root) if o.type == "MESH" and len(o.data.polygons)]
    # The stage owns its own CPU bake; the collector will preserve these
    # exact colours rather than rebake the cache beneath a review gate.
    old_gpu = kit.gpu
    def cpu():
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.use_denoising = False
        scene.render.threads_mode = "FIXED"
        scene.render.threads = 3
        scene.render.use_persistent_data = False
    try:
        kit.gpu = cpu
        memory("before-runtime-ao")
        kit.bake_ao(meshes, samples=32, distance=.14)
        finish_ao(root)
        memory("after-runtime-ao")
    finally:
        kit.gpu = old_gpu
    for obj in meshes:
        me = obj.data
        for attr in list(me.color_attributes):
            if attr.name != "AO":
                me.color_attributes.remove(attr)
        me.color_attributes.active_color = me.color_attributes["AO"]
        me.color_attributes.render_color_index = 0
    root["arenaReviewedAO"] = True  # Frozen recipe; visual acceptance is a separate root gate.
    return root


def save_runtime(root, path):
    freeze(root, path)
