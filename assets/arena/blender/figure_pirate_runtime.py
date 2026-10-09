"""The Pirate's runtime copy (9 October 2026): reduction of the detailed
master and the frozen copy that normal builds load.

Normal builds (figure_pirate.build) append runtime/pirate-runtime-vN.blend
and never sculpt or decimate. To make a new runtime copy from a reviewed
master .blend:

  Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_pirate_runtime.py -- \
      <master.blend> assets/arena/blender/runtime/pirate-runtime-vN.blend

The connected skin is collapsed with the face and hands protected, every
attachment to its own budget; the master's smooth normals are sampled onto
the reduced surfaces; attachments are joined per bone and material; the
face controls stay separate (faces.ts drives them).
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
import figure_pirate_kit as pk  # noqa: E402

RUNTIME = HERE / "runtime" / "pirate-runtime-v1.blend"
FACE = {pk.R + p for p in ("eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")}
BODY_TRIANGLES = 12000
MAX_TRIANGLES = 30000


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


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
    layer = obj.data.attributes.get("PirateSourceNormals") or obj.data.attributes.new(
        "PirateSourceNormals", "FLOAT_VECTOR", "POINT")
    layer.data.foreach_set("vector", out.reshape(-1))


def apply_normals(obj):
    layer = obj.data.attributes.get("PirateSourceNormals")
    if not layer:
        return
    n = np.empty(len(layer.data) * 3, dtype=np.float32)
    layer.data.foreach_get("vector", n)
    for f in obj.data.polygons:
        f.use_smooth = True
    obj.data.normals_split_custom_set_from_vertices(n.reshape(-1, 3).tolist())


def protect_group(obj):
    """Decimation weights: the face, the hands and the boots' outline keep
    more of their vertices (low weight = decimated less)."""
    co = pk.np_coords(obj)
    to_root = np.array(obj.matrix_world)
    co = co @ to_root[:3, :3].T + to_root[:3, 3]
    x, y, z = co.T
    face = (z > 1.05) & (z < 1.20) & (y > .03)
    ear = (z > 1.12) & (z < 1.18) & (np.abs(x) > .06) & (y > -.03) & (y < .01)
    hands = (z < .60) & (np.abs(x) > .16) & (z > .40)
    w = np.ones(len(co))
    w[face | ear] = .12
    w[hands] = .22
    g = obj.vertex_groups.get("decimate") or obj.vertex_groups.new(name="decimate")
    for value in np.unique(w):
        g.add(np.flatnonzero(w == value).tolist(), float(value), "REPLACE")
    return g


def decimate(obj, target, protect=False):
    before = triangles(obj)
    if before <= target:
        return before, before
    select(obj)
    surface = surface_of(obj.data)
    mod = obj.modifiers.new("runtime reduction", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.use_collapse_triangulate = True
    if protect:
        g = protect_group(obj)
        mod.vertex_group = g.name
        mod.vertex_group_factor = 1.0
    # Reduce the neutral source before any armature deformation.
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    mod.ratio = target / before
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if triangles(obj) > target * 1.08:
        # Protected regions keep more; trim the rest to the budget.
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


def budget(name):
    rules = [("pirate.skin", BODY_TRIANGLES), ("pirate-waistcoat", 2300), ("pirate-skirt", 1000),
             ("pirate-sash-tails", 760), ("pirate-sash-knot", 220), ("pirate-sash", 2800),
             ("pirate-hat-crown", 480), ("pirate-hat-brim", 900), ("pirate-hat-trim", 300),
             ("pirate-bandana-hem", 260), ("pirate-bandana-tail", 160), ("pirate-bandana", 700),
             ("pirate-knot", 120), ("pirate-hair-gather", 140), ("pirate-hair", 700),
             ("pirate-lock", 60), ("pirate-braid", 420), ("pirate-hoop", 110),
             ("pirate-pistol", 600), ("pirate-cutlass", 950), ("pirate-coat-button", 36),
             ("pirate-shirt-button", 36), ("pirate-collar-button", 36),
             ("pirateeye", 220), ("piratepupil", 120), ("piratebrow", 130), ("piratemouth", 420)]
    for prefix, n in rules:
        if name.startswith(prefix):
            return n
    return 200


def consolidate(root):
    """Join rigid attachments per bone and material set (fewer parts)."""
    buckets = {}
    for o in kit.descendants(root):
        if o.type != "MESH" or o.name in FACE or o.parent_type != "BONE":
            continue
        if any(m and m.name.startswith("drape") for m in o.data.materials):
            key = (o.parent, o.parent_bone, "drape")
        else:
            key = (o.parent, o.parent_bone, tuple(sorted(m.name for m in o.data.materials)))
        buckets.setdefault(key, []).append(o)
    joined = []
    for (rig, bone, _), objs in buckets.items():
        if len(objs) < 2:
            continue
        name = objs[0].name.split("-")[0] + "-" + bone.removeprefix(pk.R) + "-" + str(len(joined))
        o = kit.join(objs, name)
        world = o.matrix_world.copy()
        o.parent, o.parent_type, o.parent_bone = rig, "BONE", bone
        o.matrix_world = world
        joined.append(o.name)
    kit.refresh()
    return joined


def paint_pigment(root):
    """Painted variation multiplied into the baked AO (finish_ao): dark
    lash lines round the eye openings (the eyes read at game scale),
    warmth on the cheekbones, nose and ears. Kept as a generic vector
    layer so the frozen copy carries it to every build."""
    import figure_pirate_body as B
    skin = bpy.data.objects.get("pirate.skin")
    if skin is None:
        return
    co = pk.np_coords(skin).astype(np.float32)
    pig = np.ones((len(co), 3), dtype=np.float32)
    x, y, z = co.T
    for s in (-1, 1):
        R = B.eye_frame(s)
        q = (co - B.EYE[s]) @ R
        ap = B.almond(s)(co)
        near = (np.abs(q[:, 0]) < .020) & (q[:, 1] > -.004) & (np.abs(q[:, 2]) < .016)
        upper = np.exp(-(np.maximum(ap, 0) / .0019) ** 2) * (q[:, 2] > -.001) * near
        lower = np.exp(-(np.maximum(ap, 0) / .0013) ** 2) * (q[:, 2] <= -.001) * near
        dark = np.clip(upper * .72 + lower * .35, 0, .8)
        pig *= (1 - dark)[:, None]
        cheek = np.exp(-((x - s * .046) / .018) ** 2 - ((z - 1.140) / .016) ** 2) * (y > .03)
        pig *= np.stack([1 + .04 * cheek, 1 - .05 * cheek, 1 - .06 * cheek], 1)
    nose = np.exp(-(x / .014) ** 2 - ((z - 1.133) / .012) ** 2) * (y > .085)
    ears = np.exp(-((np.abs(x) - .073) / .012) ** 2 - ((z - 1.152) / .025) ** 2) * (y < .01) * (y > -.035)
    warm = np.clip(nose * .8 + ears * .6, 0, 1)
    pig *= np.stack([1 + .03 * warm, 1 - .04 * warm, 1 - .05 * warm], 1)
    layer = skin.data.attributes.get("PiratePigment") or skin.data.attributes.new(
        "PiratePigment", "FLOAT_VECTOR", "POINT")
    layer.data.foreach_set("vector", np.clip(pig, 0, 1.2).reshape(-1))


def finish_ao(root):
    """After the collector's AO bake: AO x painted pigment, as COLOR_0."""
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        pig = o.data.attributes.get("PiratePigment")
        ao = o.data.color_attributes.get("AO")
        if not (pig and ao):
            continue
        p = np.empty(len(pig.data) * 3, dtype=np.float32)
        pig.data.foreach_get("vector", p)
        p = p.reshape(-1, 3)
        loops = np.empty(len(o.data.loops), dtype=np.int32)
        o.data.loops.foreach_get("vertex_index", loops)
        v = np.empty(len(ao.data) * 4, dtype=np.float32)
        ao.data.foreach_get("color", v)
        v = v.reshape(-1, 4)
        v[:, :3] = np.clip(v[:, :3] * p[loops], 0, 1)
        ao.data.foreach_set("color", v.reshape(-1))
        o.data.color_attributes.active_color = ao
        o.data.color_attributes.render_color_index = list(o.data.color_attributes).index(ao)


def reduce_runtime(root):
    report = []
    for o in list(kit.descendants(root)):
        if o.type != "MESH":
            continue
        for mod in list(o.modifiers):
            if mod.type in ("SUBSURF",):
                o.modifiers.remove(mod)
        before, after = decimate(o, budget(o.name), protect=o.name == "pirate.skin")
        report.append((o.name, before, after))
    joined = consolidate(root)
    paint_pigment(root)
    for o in kit.descendants(root):
        if o.type == "MESH":
            apply_normals(o)
            # World-scale UVs carry the cloth and leather relief tiles; the
            # drape cloth keeps its `Wave` set second.
            if not o.data.uv_layers:
                kit.uv_box(o, small=True)
    for o in kit.descendants(root):
        if o.type == "MESH" and o.data.validate(clean_customdata=False):
            print("PIRATE RUNTIME repaired mesh", o.name, flush=True)
    total = sum(triangles(o) for o in kit.descendants(root) if o.type == "MESH")
    root["unoptimized"] = False
    root["runtimeTriangles"] = total
    root["runtimeReduction"] = json.dumps({"parts": report, "joined": joined})
    print("PIRATE RUNTIME", json.dumps({"triangles": total, "parts": len(report)}), flush=True)
    for name, b, a in sorted(report, key=lambda r: -r[2])[:20]:
        print(f"  {name:32s} {b:8d} -> {a:6d}", flush=True)
    assert total <= MAX_TRIANGLES, f"pirate runtime {total} over {MAX_TRIANGLES}"
    assert all(n in bpy.data.objects for n in FACE)
    return root


def save_runtime(root, path):
    objs = set(kit.descendants(root))
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.data.libraries.write(str(path), objs, compress=True)
    print("PIRATE RUNTIME SAVED", path, flush=True)


def load_runtime(root_name="pirate", path=None):
    """Append the frozen neutral copy. Shared material names that already
    exist in the build (another figure's `weave:team`) are reused."""
    path = Path(path or os.environ.get("PIRATE_RUNTIME", RUNTIME))
    if not path.is_file():
        raise RuntimeError(f"Missing Pirate runtime copy {path}")
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
    argv = sys.argv[sys.argv.index("--") + 1:]
    master, out = argv[0], argv[1]
    bpy.ops.wm.open_mainfile(filepath=str(Path(master).resolve()))
    root = bpy.data.objects[pk.R]
    for o in list(bpy.data.objects):
        if o not in set(kit.descendants(root)):
            bpy.data.objects.remove(o, do_unlink=True)
    reduce_runtime(root)
    save_runtime(root, out)
