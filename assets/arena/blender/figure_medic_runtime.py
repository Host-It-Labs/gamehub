"""Reproducible runtime reduction of a separate approved Medic master copy.

The detailed builder and V16 review master are immutable inputs. No ignored
blend cache is needed by build_runtime(): construction, surface projection,
normal transfer, consolidation and the final AO finish are all in Python.
"""
import json

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

import kit
import figure_medic_sculpt as sculpt
import figure_medic_kit as rk

# The first 16.4k reductions failed independent visual review. The parent
# explicitly released that inherited ceiling to preserve the approved forms.
# Keep a bounded review guard while measuring the smallest faithful copy.
MAX_TRIANGLES = 60000
MAX_MESHES = 62
BODY_BASE = 22000
BODY_FINAL = 24000
HAND_FRAMES = {s: sculpt.hand_frame(s).inverted() for s in (-1, 1)}
FACE_CONTROLS = {"medic" + p for p in (
    "eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")}


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def budget(name):
    exact = {
        "medic.sewn-uniform": 1800,
        "medic.sewn-sleeve-L": 600,
        "medic.sewn-sleeve-R": 600,
        "medic.swept-hair": 1000,
        "medic.low-bun": 600,
        "medic-cap": 1400,
        "medic-caprim": 256,
        "medic-capseam": 1024,
        "medic.tonic-vessel": 700,
        "medic.tonic-label": 240,
        "medic.tonic-stop": 188,
        "medic.folded-collar": 360,
        "medic.team-tie": 160,
        "medic.tie-knot": 160,
        "medic-bag": 768,
        "medic-bagflap": 528,
        "medic.satchel-closure": 256,
        "medic.satchel-closure-buckle": 256,
        "medic.satchel-gusset-pipe": 400,
        "medic-belt": 168,
        "medic-buckle": 96,
        "medic-strap": 384,
        "medic-hips": 32,
        "medic-innerskirt": 48,
        "mediceyeL": 320, "mediceyeR": 320,
        "medicpupilL": 240, "medicpupilR": 240,
        "medicbrowL": 48, "medicbrowR": 48,
        "medicmouth": 80,
    }
    if name in exact:
        return exact[name]
    rules = (
        ("medic.tailored-trousers-", 400),
        ("medic.pressed-skirt-", 1400),
        ("medic.skirt-hem-", 1176),
        ("medic.rolled-cuff-seam-", 160),
        ("medic.bun-sweep-", 160),
        ("medic.vessel-brass-ring-", 256),
        ("medic.nail-", 64), ("medic.thumb-nail-", 64),
        ("medic.lid-", 48), ("medic.lip-", 48),
        ("medic.nostril-", 24),
        ("medic.pocket-flap-", 160), ("medic.pocket-button-", 64),
        ("medic.satchel-stitch-", 8),
        ("medic-bagbuckle", 120),
        ("medic-collar", 128),
        ("medic-foot", 300), ("medic-heel", 96),
        ("medic-shaft", 220), ("medic-welt", 144),
        ("medic.full-boot-sole-", 256),
        ("medic-lace", 64),
    )
    return next((n for prefix, n in rules if name.startswith(prefix)), 64)


def source_surface(mesh, weighted=False):
    mesh.calc_loop_triangles()
    points = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
    faces = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    loops = np.empty_like(faces)
    mesh.vertices.foreach_get("co", points)
    mesh.loop_triangles.foreach_get("vertices", faces)
    mesh.loop_triangles.foreach_get("loops", loops)
    corners = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", corners)
    points, faces = points.reshape(-1, 3), faces.reshape(-1, 3)
    # Preserve split source normals. Vertex averages rounded thin crosses,
    # flat bands and panel rims despite retaining their original topology.
    normals = corners.reshape(-1, 3)[loops.reshape(-1, 3)]
    tree = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    influences = None
    if weighted:
        indices = np.full((len(mesh.vertices), 4), -1, dtype=np.int16)
        weights = np.zeros((len(mesh.vertices), 4), dtype=np.float32)
        for v in mesh.vertices:
            for slot, g in enumerate(sorted(v.groups, key=lambda g: g.weight, reverse=True)[:4]):
                indices[v.index, slot], weights[v.index, slot] = g.group, g.weight
        influences = indices, weights
    return tree, points, normals, faces, influences


def sample_normals(obj, surface):
    mesh = obj.data
    tree, points, normals, faces, influences = surface
    baked = np.empty((len(mesh.loops), 3), dtype=np.float32)
    organic = {}
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            if obj.get("continuousSkin") and vertex.index in organic:
                baked[loop_index] = organic[vertex.index]
                continue
            # Bias toward this face's interior at a hard edge, rather than
            # randomly projecting to the opposite wall of a thin appliqué.
            # Organic skin has one continuous normal at each vertex. A
            # separate face bias in narrow finger valleys can switch to a
            # neighbouring digit and create triangular shading cracks.
            at = vertex.co if obj.get("continuousSkin") else vertex.co.lerp(poly.center, .005)
            p, fn, i, _ = tree.find_nearest(at)
            a, b, c = faces[i]
            n = barycentric_transform(p, Vector(points[a]), Vector(points[b]), Vector(points[c]),
                                      Vector(normals[i, 0]), Vector(normals[i, 1]), Vector(normals[i, 2]))
            baked[loop_index] = n.normalized() if n.length > .00001 else fn
            if obj.get("continuousSkin"):
                organic[vertex.index] = baked[loop_index].copy()
    for v in mesh.vertices:
        p, fn, i, _ = tree.find_nearest(v.co)
        a, b, c = faces[i]
        if influences is not None:
            bary = barycentric_transform(p, Vector(points[a]), Vector(points[b]), Vector(points[c]),
                                         Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
            indices, weights = influences
            values = {}
            for source_vertex, fraction in zip((a, b, c), bary):
                for group, value in zip(indices[source_vertex], weights[source_vertex]):
                    if group >= 0 and value > 0:
                        values[int(group)] = values.get(int(group), 0) + float(value) * max(0, float(fraction))
            retained = sorted(values.items(), key=lambda item: item[1], reverse=True)[:4]
            total = sum(max(0, value) for _, value in retained)
            # Reconstruct ownership from the approved surface rather than
            # QEM's averaged torso/arm weights at nearby covered boundaries.
            for group in [g.group for g in v.groups]:
                obj.vertex_groups[group].remove([v.index])
            for group, value in retained:
                obj.vertex_groups[group].add([v.index], max(0, value) / max(total, 1e-10), "REPLACE")
    cache = mesh.attributes.get("MedicSourceNormals") or mesh.attributes.new(
        "MedicSourceNormals", "FLOAT_VECTOR", "CORNER")
    cache.data.foreach_set("vector", baked.reshape(-1))


def apply_source_normals(root):
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        cache = obj.data.attributes.get("MedicSourceNormals")
        if not cache:
            continue
        normals = np.empty(len(cache.data) * 3, dtype=np.float32)
        cache.data.foreach_get("vector", normals)
        for p in obj.data.polygons:
            p.use_smooth = True
        obj.data.normals_split_custom_set(normals.reshape(-1, 3).tolist())


def readable_region(p):
    face = 1.045 < p.z < 1.245 and (p.y > .032 or (abs(p.x) > .060 and p.y > -.05))
    hand = False
    for frame in HAND_FRAMES.values():
        q = frame @ p
        hand |= -.047 < q.x < .077 and abs(q.y) < .039 and abs(q.z) < .052
    return face, hand


def refine_face_and_grip(obj, surface):
    """Spend the remaining skin budget on source-projected face and digits."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    face_edges, hand_edges = [], []
    for e in bm.edges:
        p = (e.verts[0].co + e.verts[1].co) * .5
        face, hand = readable_region(p)
        if face:
            face_edges.append((e.calc_length(), e))
        elif hand:
            hand_edges.append((e.calc_length(), e))
    face_edges.sort(key=lambda x: x[0], reverse=True)
    hand_edges.sort(key=lambda x: x[0], reverse=True)
    count = max(0, (BODY_FINAL - triangles(obj)) // 2)
    face_count = min(len(face_edges), round(count * .35))
    chosen = [e for _, e in face_edges[:face_count]]
    chosen += [e for _, e in hand_edges[:count - len(chosen)]]
    if len(chosen) < count:
        chosen += [e for _, e in face_edges[face_count:face_count + count - len(chosen)]]
    bmesh.ops.subdivide_edges(bm, edges=chosen, cuts=1, use_grid_fill=True, smooth=0)
    for v in bm.verts:
        if any(readable_region(v.co)):
            p, _, _, d = surface[0].find_nearest(v.co)
            if d < .006:
                v.co = p
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    assert triangles(obj) <= BODY_FINAL


def structured_panels_and_piping(root):
    """Sample the exact authored panels instead of collapsing thin walls.

    Only this private runtime construction temporarily supplies lower sample
    lists to the private tailoring helpers. The source functions/parameters,
    approved master and detailed build() remain unchanged.
    """
    originals = {o.name: o for o in kit.descendants(root) if o.type == "MESH"}
    made = []
    sheet, tube, loft = rk.sheet, rk.tube, rk.loft
    f = sculpt.f
    palette = {key: getattr(f, key) for key in ("SKIN", "HAIR", "KHAKI", "CREAM", "CROSS",
                                               "LEATHER", "BRASS", "GLOW")}

    def sampled(values, count):
        return np.linspace(values[0], values[-1], count).tolist()

    def panel(name, fn, us, vs, *args, **kwargs):
        counts = ((41, 13) if "pressed-skirt" in name else
                  (13, 7) if "pocket-flap" in name else
                  (41, 9) if "folded-collar" in name else
                  (7, 13) if "team-tie" in name else
                  (13, 7) if "tonic-label" in name else None)
        obj = sheet(name, fn, sampled(us, counts[0]) if counts else us,
                    sampled(vs, counts[1]) if counts else vs, *args, **kwargs)
        if counts:
            obj["MedicStructuredTarget"] = name
        made.append(obj)
        return obj

    def piping(name, path, radii, *args, **kwargs):
        count = (49 if "skirt-hem" in name else
                 35 if "bun-sweep" in name or "gusset-pipe" in name else
                 33 if "vessel-brass-ring" in name else
                 24 if name.startswith("medic.lid-") else None)
        if count:
            indices = np.rint(np.linspace(0, len(path) - 1, count)).astype(int)
            path, radii = [path[i] for i in indices], [radii[i] for i in indices]
            kwargs["n"] = 6
        obj = tube(name, path, radii, *args, **kwargs)
        if count:
            obj["MedicStructuredTarget"] = name
        made.append(obj)
        return obj

    def vessel(name, rings, *args, **kwargs):
        if name == "medic.tonic-vessel":
            indices = np.rint(np.linspace(0, len(rings) - 1, 20)).astype(int)
            rings = [[p for i, p in enumerate(rings[j]) if i % 3 == 0] for j in indices]
        eye = name.startswith(("medic-eye-outline", "medic-eye-white"))
        if eye:
            indices = np.rint(np.linspace(0, len(rings) - 1, 4)).astype(int)
            rings = [rings[j] for j in indices]
        obj = loft(name, rings, *args, **kwargs)
        if name == "medic.tonic-vessel":
            obj["MedicStructuredTarget"] = name
        elif eye:
            obj["MedicEyeSide"] = "L" if name.endswith("-1") else "R"
        made.append(obj)
        return obj

    before = set(bpy.data.objects)
    try:
        f.SKIN, f.HAIR, f.KHAKI, f.CREAM, f.CROSS = sculpt.SKIN, sculpt.HAIR, sculpt.UNIFORM, sculpt.CREAM, sculpt.GREEN
        f.LEATHER, f.BRASS, f.GLOW = sculpt.LEATHER, sculpt.BRASS, sculpt.TONIC
        rk.sheet, rk.tube, rk.loft = panel, piping, vessel
        for side in (-1, 1):
            sculpt.skirt_half(side)
        sculpt.shirt_decorations()
        sculpt.hair()
        sculpt.satchel()
        sculpt.flask()
        sculpt.face_details()
    finally:
        rk.sheet, rk.tube, rk.loft = sheet, tube, loft
        for key, value in palette.items():
            setattr(f, key, value)
    for side in ("L", "R"):
        parts = [o for o in set(bpy.data.objects) - before if o.get("MedicEyeSide") == side]
        eye = kit.join(parts, "Medic structured eye " + side)
        target = originals["mediceye" + side]
        # Eye controls have centered mesh coordinates and their own blink
        # pivots. Preserve those exact controls while changing only topology.
        eye.data.transform(target.matrix_world.inverted() @ eye.matrix_world)
        eye.matrix_world = target.matrix_world.copy()
        eye["MedicStructuredTarget"] = target.name
    fields = {}
    for candidate in list(set(bpy.data.objects) - before):
        name = candidate.get("MedicStructuredTarget")
        if name in originals:
            obj = originals[name]
            for mod in obj.modifiers:
                mod.show_viewport = True
            kit.refresh()
            evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh()
            count = sum(len(p.vertices) - 2 for p in mesh.polygons)
            fields[obj] = (count, source_surface(mesh, weighted=bool(obj.vertex_groups)))
            evaluated.to_mesh_clear()
            mats = list(obj.data.materials)
            kit.shade(candidate, angle=48)
            obj.data = candidate.data.copy()
            if name not in FACE_CONTROLS:
                obj.data.materials.clear()
                for material in mats:
                    obj.data.materials.append(material)
            obj["runtimeStructured"] = True
        bpy.data.objects.remove(candidate, do_unlink=True)
    kit.refresh()
    return fields


def reduce_mesh(obj, target, anatomical=False, source_override=None):
    # Capture the actual subdivided neutral master, then collapse its dense
    # cage. Source normals retain authored smooth forms at the smaller count.
    for mod in obj.modifiers:
        mod.show_viewport = True
    kit.refresh()
    dg = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(dg)
    if source_override:
        source_count, surface = source_override
    else:
        mesh = evaluated.to_mesh()
        source_count = sum(len(p.vertices) - 2 for p in mesh.polygons)
        surface = source_surface(mesh, weighted=bool(obj.vertex_groups))
        evaluated.to_mesh_clear()
    for mod in list(obj.modifiers):
        if mod.type == "SUBSURF":
            obj.modifiers.remove(mod)
    before = triangles(obj)
    priority_name = None
    if before > target and not obj.get("runtimeStructured"):
        if anatomical:
            # The Blender collapse group is a reduction weight: smaller
            # positive values protect local anatomy, zero freezes it. Keep
            # it positive so the fixed global budget remains achievable.
            priority = obj.vertex_groups.new(name="MedicRetopologyPriority")
            priority_name = priority.name
            buckets = {1.0: [], .08: [], .005: [], .012: [], .25: [], .02: [], 0.0: []}
            medial = Vector((.1474, .0298, .7574))
            for v in obj.data.vertices:
                face, hand = readable_region(v.co)
                visible_arm = (abs(v.co.x) > .095 and .40 < v.co.z < 1.025
                               and sculpt.covered_skin_share(v.co) < .02)
                right = HAND_FRAMES[1] @ v.co
                right_hand = (-.047 < right.x < .077 and abs(right.y) < .039 and abs(right.z) < .052)
                crease = (right_hand and -.026 < right.x < .034
                          and min(abs(right.z - gap) for gap in (.0155, -.0015, -.018)) < .003)
                weight = (0.0 if crease else .005 if right_hand else .012 if hand else
                          .08 if face else .25 if visible_arm else 1.0)
                if (v.co - medial).length < .014:
                    weight = .02
                buckets[weight].append(v.index)
            for weight, indices in buckets.items():
                if indices:
                    priority.add(indices, weight, "REPLACE")
            print("MEDIC RETOPOLOGY PROTECTED CREASE", len(buckets[0.0]), "source cage vertices", flush=True)
        select(obj)
        mod = obj.modifiers.new("Separate runtime source reduction", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = target / before
        mod.use_collapse_triangulate = True
        if priority_name:
            mod.vertex_group = priority_name
            mod.vertex_group_factor = 1
        while obj.modifiers[0] != mod:
            bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if anatomical:
        refine_face_and_grip(obj, surface)
    sample_normals(obj, surface)
    if priority_name:
        priority = obj.vertex_groups.get(priority_name)
        if priority:
            obj.vertex_groups.remove(priority)
    # BMesh subdivision and collapse preserve deform groups. Normalize the
    # retained four influences explicitly for the Arena/glTF contract.
    for v in obj.data.vertices:
        groups = sorted(v.groups, key=lambda g: g.weight, reverse=True)
        if not groups:
            continue
        total = sum(g.weight for g in groups[:4])
        for g in groups[:4]:
            obj.vertex_groups[g.group].add([v.index], g.weight / max(total, 1e-10), "REPLACE")
        for g in groups[4:]:
            obj.vertex_groups[g.group].remove([v.index])
    return {"name": obj.name, "source": source_count, "runtime": triangles(obj),
            "structured": bool(obj.get("runtimeStructured"))}


def join_rigid_details(root):
    buckets = {}
    for o in kit.descendants(root):
        if o.type != "MESH" or o.name in FACE_CONTROLS or o.parent_type != "BONE":
            continue
        if len(o.data.materials) != 1:
            continue
        key = (o.parent, o.parent_bone, o.data.materials[0])
        buckets.setdefault(key, []).append(o)
    joined = []
    for (rig, bone, material), parts in buckets.items():
        if len(parts) < 2:
            continue
        # bpy join retains deform groups, UVs and cached source normals.
        select(parts[0])
        for o in parts[1:]:
            o.select_set(True)
        bpy.ops.object.join()
        o = bpy.context.object
        o.name = "medic.runtime-" + bone.removeprefix("medic") + "-" + material.name.split(":")[0]
        joined.append(o.name)
    kit.refresh()
    return joined


def join_weighted_clothing(root):
    buckets = {}
    for o in kit.descendants(root):
        if o.type != "MESH" or o.get("continuousSkin") or o.name in FACE_CONTROLS:
            continue
        armature = next((m.object for m in o.modifiers if m.type == "ARMATURE"), None)
        if not armature or len(o.data.materials) != 1:
            continue
        role = "tailoring" if o.get("weightedTailoring") else "legs"
        buckets.setdefault((armature, role, o.data.materials[0]), []).append(o)
    joined = []
    for (_, role, material), parts in buckets.items():
        if len(parts) < 2:
            continue
        select(parts[0])
        for o in parts[1:]:
            o.select_set(True)
        bpy.ops.object.join()
        o = bpy.context.object
        o.name = "medic.runtime-" + role + "-" + material.name.split(":")[0]
        if role == "tailoring":
            o["weightedTailoring"] = True
        joined.append(o.name)
    kit.refresh()
    return joined


def retain_one_color(root):
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        colors = o.data.color_attributes
        for layer in list(colors):
            if layer.name != "AO":
                colors.remove(layer)
        if not colors.get("AO"):
            # Structured replacement panels receive AO in the final bake.
            # Their empty color collection has no render index yet.
            continue
        colors.active_color = colors.get("AO")
        colors.render_color_index = 0


def reviewed_ao(root, bake=True):
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    if bake:
        scene = bpy.context.scene
        engine, seed = scene.render.engine, scene.cycles.seed
        # Builders run before the collector spaces their roots. Keep other
        # characters and review floors out of this reproducible local bake.
        others = [(o, o.hide_render) for o in bpy.data.objects
                  if o.type == "MESH" and o not in meshes]
        try:
            for o, _ in others:
                o.hide_render = True
            scene.render.engine, scene.cycles.seed = "CYCLES", 65
            kit.bake_ao(meshes, samples=128, distance=.22)
        finally:
            scene.render.engine, scene.cycles.seed = engine, seed
            for o, hidden in others:
                o.hide_render = hidden
        # The source was accepted with real light and restrained occlusion.
        # Thin emblems/piping bake dark when they nearly touch a garment;
        # prevent that bake artifact from changing the green/cream palette.
        for o in meshes:
            ao = o.data.color_attributes["AO"]
            values = np.empty(len(ao.data) * 4, dtype=np.float32)
            ao.data.foreach_get("color", values)
            values = values.reshape(-1, 4)
            for p in o.data.polygons:
                name = o.data.materials[p.material_index].name
                floor = (.98 if name == sculpt.GREEN else
                         .94 if name == sculpt.CREAM else
                         .93 if name.startswith("weave:") else
                         .90 if name.startswith("skin:") else
                         .96 if name.startswith("resin:") else
                         .84 if name.startswith("hide:") else .77)
                values[list(p.loop_indices), :3] = np.maximum(floor, values[list(p.loop_indices), :3])
            ao.data.foreach_set("color", values.reshape(-1))
        sculpt.finish_ao(root, pigment=True)
        for o in meshes:
            ao = o.data.color_attributes["AO"]
            cache = o.data.attributes.get("MedicReviewedAO") or o.data.attributes.new(
                "MedicReviewedAO", "FLOAT_VECTOR", "CORNER")
            rgba = np.empty(len(ao.data) * 4, dtype=np.float32)
            ao.data.foreach_get("color", rgba)
            cache.data.foreach_set("vector", rgba.reshape(-1, 4)[:, :3].reshape(-1))
    else:
        for o in meshes:
            cache = o.data.attributes.get("MedicReviewedAO")
            if not cache:
                continue
            rgb = np.empty(len(cache.data) * 3, dtype=np.float32)
            cache.data.foreach_get("vector", rgb)
            rgba = np.ones((len(cache.data), 4), dtype=np.float32)
            rgba[:, :3] = rgb.reshape(-1, 3)
            o.data.color_attributes["AO"].data.foreach_set("color", rgba.reshape(-1))
    retain_one_color(root)
    if not root.get("runtimeReviewedFinish"):
        apply_source_normals(root)
    root["arenaReviewedAO"] = 1
    root["aoContract"] = "reviewed isolated AO128 distance.22 seed65; bounded AO green.98/cream.94/cloth.93/skin.90; authored pigment; exact cached finish" + (
        "; held V10 six rigid geometries and every procedural corner normal/AO/UV" if root.get("runtimeReviewedFinish") else "")


def finish_ao(root):
    """Idempotent normal-pipeline finish; never tints the reviewed AO twice."""
    reviewed_ao(root, bake=not bool(root.get("arenaReviewedAO")))


def reduce_runtime(root):
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    skin = next(o for o in meshes if o.get("continuousSkin"))
    # Avoid reevaluating every other dense subdivision for each small part.
    for o in meshes:
        for mod in o.modifiers:
            mod.show_viewport = False
    reductions = [reduce_mesh(skin, BODY_BASE, anatomical=True)]
    print("MEDIC RUNTIME BODY", json.dumps(reductions[0]), flush=True)
    structured = structured_panels_and_piping(root)
    for o in meshes:
        if o != skin:
            reductions.append(reduce_mesh(o, budget(o.name), source_override=structured.get(o)))
    joined = join_weighted_clothing(root) + join_rigid_details(root)
    apply_source_normals(root)
    retain_one_color(root)
    meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
    count = sum(triangles(o) for o in meshes)
    assert count <= MAX_TRIANGLES, f"Medic runtime {count} exceeds review guard {MAX_TRIANGLES} triangles"
    assert len(meshes) <= MAX_MESHES, f"Medic runtime {len(meshes)} exceeds original {MAX_MESHES} meshes"
    assert all(name in bpy.data.objects for name in FACE_CONTROLS)
    root["unoptimized"] = False
    root["runtimeTriangles"] = count
    root["runtimeReviewGuard"] = MAX_TRIANGLES
    root["runtimeReduction"] = json.dumps({"perPart": reductions, "joined": joined})
    root["runtimeSource"] = "accepted V16 source; projected face/digits; transferred master normals"
    # Detailed source, continuous anatomy and clothing remain procedural.
    # Replay the six unstable rigid accessories, then restore the accepted
    # normal/UV/pigment/AO finish of every unchanged procedural surface.
    # A fresh bake must not overwrite an independently reviewed finish.
    from figure_medic_runtime_cache import restore_reviewed_components
    restore_reviewed_components(root)
    reviewed_ao(root, bake=False)
    assert sum(triangles(o) for o in meshes) == count
    print("MEDIC RUNTIME", json.dumps({"triangles": count, "meshNodes": len(meshes),
                                      "reductions": reductions, "joined": joined}), flush=True)
    kit.refresh()
    return root
