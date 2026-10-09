"""The Cadets' runtime copy (9 October 2026): reduction of the detailed
master, its own occlusion bake, and the frozen copy that normal builds load.

Use figure_archers_stages.py -- runtime v4 after root source review. The
private collector emits the installable normal loader only after both
root review gates. Work copies stay inside the Cadets' owned folder;
root alone installs the accepted canonical runtime. No direct reduction
command bypasses this staged recipe.

The connected suit is collapsed with the gloves and boots protected, each
head and attachment to its own budget; the master's smooth normals are
sampled onto the reduced surfaces; attachments are joined per bone and
material; the face controls stay separate (faces.ts drives them).

Occlusion is baked here, not by the collector: the two heads share one
place inside the glass (only one is shown per Cadet) and the glass must not
darken the face, so each look is baked on its own with the bubble hidden,
and kept as the `CadetAO` layer. finish_ao() (called by figures.py after its
own bake) writes CadetAO x painted pigment into the exported colour.
"""
import json
import os
import re
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import kit  # noqa: E402

R = "archers"
RUNTIME = HERE / "runtime" / "archers-runtime-v1.blend"
FACE = {R + p for p in ("eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")}
MAX_TRIANGLES = 18000


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def np_coords(obj):
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def surface_of(mesh):
    mesh.calc_loop_triangles()
    pts = np.empty(len(mesh.vertices) * 3)
    nrm = np.empty_like(pts)
    tri = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.vertices.foreach_get("co", pts)
    mesh.vertices.foreach_get("normal", nrm)
    mesh.loop_triangles.foreach_get("vertices", tri)
    pts, nrm, tri = pts.reshape(-1, 3), nrm.reshape(-1, 3), tri.reshape(-1, 3)
    return BVHTree.FromPolygons(pts.tolist(), tri.tolist(), all_triangles=True), pts, nrm, tri


def sample_normals(obj, surface):
    tree, pts, nrm, tri = surface
    out = np.empty((len(obj.data.vertices), 3), dtype=np.float32)
    for v in obj.data.vertices:
        p, fn, fi, _ = tree.find_nearest(v.co)
        if fi is None:
            out[v.index] = v.normal
            continue
        a, b, c = tri[fi]
        n = barycentric_transform(p, Vector(pts[a]), Vector(pts[b]), Vector(pts[c]),
                                  Vector(nrm[a]), Vector(nrm[b]), Vector(nrm[c]))
        out[v.index] = n.normalized() if n.length > 1e-6 else fn
    layer = obj.data.attributes.get("CadetSourceNormals") or obj.data.attributes.new(
        "CadetSourceNormals", "FLOAT_VECTOR", "POINT")
    layer.data.foreach_set("vector", out.reshape(-1))


def apply_normals(obj):
    layer = obj.data.attributes.get("CadetSourceNormals")
    if not layer:
        return
    n = np.empty(len(layer.data) * 3, dtype=np.float32)
    layer.data.foreach_get("vector", n)
    for f in obj.data.polygons:
        f.use_smooth = True
    obj.data.normals_split_custom_set_from_vertices(n.reshape(-1, 3).tolist())


def protect_group(obj, kind):
    """Decimation weights (low = decimated less): on the suit the gloves,
    the gun hand and the boots' soles; on a head the eyes, nose, mouth and
    the hairline."""
    kit.refresh()
    co = np_coords(obj)
    mw = np.array(obj.matrix_world)
    co = co @ mw[:3, :3].T + mw[:3, 3]
    x, y, z = co.T
    w = np.ones(len(co))
    if kind == "suit":
        hands = (z < .56) & (z > .38) & (np.abs(x) > .17)
        w[hands] = .16
        boots = z < .04
        w[boots] = .5
        chest = (z > .62) & (z < .98) & (y > .04)
        w[chest] = np.minimum(w[chest], .7)
    else:
        face = (z > 1.04) & (z < 1.17) & (y > .035)
        w[face] = .10
        ears = (np.abs(x) > .060) & (z > 1.09) & (z < 1.15) & (y < .01) & (y > -.03)
        w[ears] = .3
    g = obj.vertex_groups.get("decimate") or obj.vertex_groups.new(name="decimate")
    for value in np.unique(w):
        g.add(np.flatnonzero(w == value).tolist(), float(value), "REPLACE")
    return g


def decimate(obj, target, protect=None):
    before = triangles(obj)
    if before <= target:
        return before, before
    select(obj)
    surface = surface_of(obj.data)
    mod = obj.modifiers.new("runtime reduction", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.use_collapse_triangulate = True
    if protect:
        g = protect_group(obj, protect)
        mod.vertex_group = g.name
        mod.vertex_group_factor = 1.0
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    mod.ratio = target / before
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if triangles(obj) > target * 1.06:
        mod = obj.modifiers.new("runtime trim", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.use_collapse_triangulate = True
        while obj.modifiers[0] != mod:
            bpy.ops.object.modifier_move_up(modifier=mod.name)
        mod.ratio = target / triangles(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if obj.vertex_groups.get("decimate"):
        obj.vertex_groups.remove(obj.vertex_groups["decimate"])
    sample_normals(obj, surface)
    return before, triangles(obj)


BUDGETS = [("archers.skin", 8000), ("cadet-head-", 1700), ("cadet-gun", 1350),
           ("cadet-ring", 600), ("cadet-dam", 320), ("cadet-bubble", 1000),
           ("cadet-chest-unit", 450), ("cadet-pack", 600), ("cadet-hoses", 300),
           ("cadet-antenna", 120), ("cadet-buckle", 180), ("cadet-pouches", 260),
           ("archerseye", 150), ("archerspupil", 150), ("archersbrow", 90), ("archersmouth", 70)]


def budget(name):
    for prefix, n in BUDGETS:
        if name.startswith(prefix):
            return n
    return 200


def consolidate(root):
    """Join rigid attachments per bone and material set (fewer parts); the
    looks and face controls stay apart."""
    buckets = {}
    for o in kit.descendants(root):
        if o.type != "MESH" or o.name in FACE or o.parent_type != "BONE":
            continue
        if any(m and m.name.startswith("glass") for m in o.data.materials):
            continue
        key = (o.parent, o.parent_bone, tuple(sorted(m.name for m in o.data.materials)))
        buckets.setdefault(key, []).append(o)
    joined = []
    for (rig, bone, _), objs in buckets.items():
        if len(objs) < 2:
            continue
        name = "cadet-" + bone.removeprefix(R) + "-" + str(len(joined))
        o = kit.join(objs, name)
        world = o.matrix_world.copy()
        o.parent, o.parent_type, o.parent_bone = rig, "BONE", bone
        o.matrix_world = world
        joined.append(o.name)
    kit.refresh()
    return joined


def world_coords(o):
    co = np_coords(o)
    mw = np.array(o.matrix_world)
    return co @ mw[:3, :3].T + mw[:3, 3]


def paint_pigment(root):
    """Painted variation multiplied into the baked occlusion: dark lash
    lines round the eye openings (the eyes read at game scale), warmth on
    cheeks, nose and ears, a little lunar dust on the boots and knees.
    Kept as a vector layer so the frozen copy carries it to every build."""
    import figure_archers_head as H
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        co = world_coords(o).astype(np.float32)
        pig = np.ones((len(co), 3), dtype=np.float32)
        x, y, z = co.T
        if o.name.startswith("cadet-head-"):
            for s in (-1, 1):
                Rm = H.eye_frame(s)
                q = (co - H.EYE[s]) @ Rm
                ap = H.almond(s)(co)
                near = (np.abs(q[:, 0]) < .021) & (q[:, 1] > -.004) & (np.abs(q[:, 2]) < .017)
                upper = np.exp(-(np.maximum(ap, 0) / .0021) ** 2) * (q[:, 2] > -.001) * near
                lower = np.exp(-(np.maximum(ap, 0) / .0013) ** 2) * (q[:, 2] <= -.001) * near
                dark = np.clip(upper * .78 + lower * .32, 0, .82)
                pig *= (1 - dark)[:, None]
                cheek = np.exp(-((x - s * .042) / .016) ** 2 - ((z - 1.098) / .014) ** 2) * (y > .03)
                pig *= np.stack([1 + .05 * cheek, 1 - .05 * cheek, 1 - .06 * cheek], 1)
            nose = np.exp(-(x / .012) ** 2 - ((z - 1.104) / .011) ** 2) * (y > .078)
            ears = np.exp(-((np.abs(x) - .067) / .011) ** 2 - ((z - 1.122) / .022) ** 2) * (y < .01) * (y > -.032)
            warm = np.clip(nose * .7 + ears * .6, 0, 1)
            pig *= np.stack([1 + .03 * warm, 1 - .04 * warm, 1 - .05 * warm], 1)
            if o.name.endswith("A"):
                # A faint shaved shadow along his jaw and upper lip.
                jaw = np.exp(-((z - 1.052) / .022) ** 2) * (y > .0) * (np.abs(x) < .055)
                lip = np.exp(-(x / .016) ** 2 - ((z - 1.083) / .006) ** 2) * (y > .06)
                shade = np.clip(jaw * .06 + lip * .05, 0, .1)
                pig *= np.stack([1 - shade * 1.1, 1 - shade, 1 - shade * .9], 1)
        elif o.name == R + ".skin":
            dust = np.clip(1 - z / .16, 0, 1) ** 1.5 * .12 + np.exp(-((z - .318) / .05) ** 2) * (y > .02) * .05
            pig *= np.stack([1 - dust, 1 - dust * 1.02, 1 - dust * 1.06], 1)
        else:
            continue
        layer = o.data.attributes.get("CadetPigment") or o.data.attributes.new(
            "CadetPigment", "FLOAT_VECTOR", "POINT")
        layer.data.foreach_set("vector", np.clip(pig, 0, 1.2).reshape(-1))


def bake_own_ao(root):
    """Occlusion per look, the glass hidden; stored as `CadetAO` (corner)."""
    glass = [o for o in kit.descendants(root) if o.type == "MESH"
             and any(m and m.name.startswith("glass") for m in o.data.materials)]
    looks = {k: bpy.data.objects.get(f"{R}.look{k}") for k in ("A", "B")}
    meshes = [o for o in kit.descendants(root) if o.type == "MESH" and len(o.data.polygons)]
    for g in glass:
        g.hide_render = True
    for k, holder in looks.items():
        other = looks["B" if k == "A" else "A"]
        holder.scale = (1, 1, 1)
        other.scale = (1, 1, 1)
        for o in kit.descendants(other):
            o.hide_render = True
        for o in kit.descendants(holder):
            o.hide_render = False
        kit.refresh()
        own = set(kit.descendants(holder))
        if k == "A":
            targets = [o for o in meshes if o not in glass and o not in set(kit.descendants(other))]
        else:
            targets = [o for o in meshes if o in own]
        # The saved recipe uses CPU Cycles in a fresh, guarded process.
        # Avoid kit.gpu(): Metal initialization is not part of this build.
        original_gpu = kit.gpu
        def cpu():
            scene = bpy.context.scene
            scene.render.engine = "CYCLES"
            scene.cycles.device = "CPU"
            scene.render.threads_mode = "FIXED"
            scene.render.threads = 3
            scene.cycles.use_denoising = False
            scene.render.use_persistent_data = False
        kit.gpu = cpu
        try:
            from figure_archers_gates import memory
            memory("ao-" + k + "-before")
            kit.bake_ao(targets, samples=32, distance=0.22)
            memory("ao-" + k + "-after")
        finally:
            kit.gpu = original_gpu
        for o in targets:
            ao = o.data.color_attributes.get("AO")
            v = np.empty(len(ao.data) * 4, dtype=np.float32)
            ao.data.foreach_get("color", v)
            layer = o.data.attributes.get("CadetAO") or o.data.attributes.new("CadetAO", "FLOAT", "CORNER")
            layer.data.foreach_set("value", v.reshape(-1, 4)[:, 0].copy())
    for o in kit.descendants(root):
        o.hide_render = False
    for g in glass:
        layer = g.data.attributes.get("CadetAO") or g.data.attributes.new("CadetAO", "FLOAT", "CORNER")
        layer.data.foreach_set("value", np.ones(len(g.data.loops), dtype=np.float32))
    looks["B"].scale = (0, 0, 0)
    kit.refresh()


def finish_ao(root):
    """After the collector's bake: our own per-look occlusion x painted
    pigment, as the exported colour (COLOR_0)."""
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        own = o.data.attributes.get("CadetAO")
        ao = o.data.color_attributes.get("AO") or o.data.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        n = len(o.data.loops)
        a = np.ones(n, dtype=np.float32)
        if own:
            own.data.foreach_get("value", a)
        rgb = np.repeat(a[:, None], 3, axis=1)
        pig = o.data.attributes.get("CadetPigment")
        if pig:
            p = np.empty(len(pig.data) * 3, dtype=np.float32)
            pig.data.foreach_get("vector", p)
            loops = np.empty(n, dtype=np.int32)
            o.data.loops.foreach_get("vertex_index", loops)
            rgb = rgb * p.reshape(-1, 3)[loops]
        v = np.ones((n, 4), dtype=np.float32)
        v[:, :3] = np.clip(rgb, 0, 1)
        ao.data.foreach_set("color", v.reshape(-1))
        o.data.color_attributes.active_color = ao
        o.data.color_attributes.render_color_index = list(o.data.color_attributes).index(ao)


def runtime_bubble(root):
    """Replace the master's bubble with one at runtime density (a sphere
    should not be decimated: its outline would facet)."""
    import figure_archers_gear as G
    import figure_archers_rig as rg
    old = next((o for o in kit.descendants(root) if o.name.startswith("cadet-bubble")), None)
    if old is None:
        return
    rig, bone = old.parent, old.parent_bone
    bpy.data.objects.remove(old, do_unlink=True)
    new = G.bubble(seg=32, rings=16)
    # Attach from its authored world frame once. Parenting before capturing
    # that frame applied the chest translation twice to the replacement.
    rg.bone_attach(new, rig, bone.removeprefix(R))


def reduce_runtime(root):
    runtime_bubble(root)
    report = []
    for o in list(kit.descendants(root)):
        if o.type != "MESH":
            continue
        for mod in list(o.modifiers):
            if mod.type in ("SUBSURF",):
                o.modifiers.remove(mod)
        kind = "suit" if o.name == R + ".skin" else ("head" if o.name.startswith("cadet-head-") else None)
        before, after = decimate(o, budget(o.name), protect=kind)
        report.append((o.name, before, after))
    joined = consolidate(root)
    paint_pigment(root)
    for o in kit.descendants(root):
        if o.type == "MESH":
            apply_normals(o)
            if not o.data.uv_layers:
                kit.uv_box(o, small=True)
    for o in kit.descendants(root):
        if o.type == "MESH" and o.data.validate(clean_customdata=False):
            print("CADET RUNTIME repaired mesh", o.name, flush=True)
    bake_own_ao(root)
    total = sum(triangles(o) for o in kit.descendants(root) if o.type == "MESH")
    root["unoptimized"] = False
    root["runtimeTriangles"] = total
    root["runtimeReduction"] = json.dumps({"parts": report, "joined": joined})
    print("CADET RUNTIME", json.dumps({"triangles": total, "parts": len(report)}), flush=True)
    for name, b, a in sorted(report, key=lambda r: -r[2])[:24]:
        print(f"  {name:32s} {b:8d} -> {a:6d}", flush=True)
    assert total <= MAX_TRIANGLES, f"archers runtime {total} over {MAX_TRIANGLES}"
    assert all(n in bpy.data.objects for n in FACE)
    return root


def save_runtime(root, path):
    objs = set(kit.descendants(root))
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    for obj in list(bpy.data.objects):
        if obj not in objs:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in objs:
        obj.hide_render = False
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    print("CADET RUNTIME SAVED", path, flush=True)


def finalize_copy(root):
    """Four normalized influences; one exported pigment/AO colour channel."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        if any(mod.type == "ARMATURE" for mod in obj.modifiers):
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
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            base = re.sub(r"(?:\.\d{3})+$", "", material.name)
            if base != material.name:
                shared = bpy.data.materials.get(base)
                if shared is not None:
                    slot.material = shared
                else:
                    material.name = base
    finish_ao(root)
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        me = obj.data
        for attr in list(me.color_attributes):
            if attr.name != "AO":
                me.color_attributes.remove(attr)
        me.color_attributes.active_color = me.color_attributes["AO"]
        me.color_attributes.render_color_index = 0
    root["arenaReviewedAO"] = True
    root["cadetLooks"] = json.dumps({"default": "A", "male": "archers.lookA", "female": "archers.lookB"})
    return root


def load_runtime(root_name="archers", path=None):
    """Append the frozen neutral copy. Shared material names that already
    exist in the build (another figure's `weave:team`) are reused."""
    path = Path(path or os.environ.get("CADET_RUNTIME", RUNTIME))
    if not path.is_file():
        raise RuntimeError(f"Missing Cadets runtime copy {path}")
    existing = set(bpy.data.materials.keys())
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        dst.objects = list(src.objects)
    for o in dst.objects:
        if o:
            bpy.context.scene.collection.objects.link(o)
    root = next(o for o in dst.objects if o and o.name == root_name)
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m:
                continue
            base = re.sub(r"\.\d{3}$", "", m.name)
            if base != m.name:
                if base in existing:
                    slot.material = bpy.data.materials[base]
                else:
                    m.name = base
    for m in list(bpy.data.materials):
        if m.users == 0 and re.search(r"\.\d{3}$", m.name):
            bpy.data.materials.remove(m)
    root["runtimeCopySource"] = "runtime/" + path.name
    kit.refresh()
    return root


if __name__ == "__main__":
    raise SystemExit("Use figure_archers_stages.py -- runtime v4 after root source review")
