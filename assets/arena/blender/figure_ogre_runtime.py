"""Targeted runtime copy of the independently reviewed v11 T-rex master.

The source sculpt is never reduced in place on disk. Runtime topology reserves
the most triangles for the continuous skull/limb/tail skin, keeps the authored
small scutes intact, and reduces each separate tooth/claw/lid independently.
Fine source normals and authored pigment survive without a repeat texture.
"""

import json
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

import kit
import figure_ogre_kit as fk
import figure_ogre_surface as surface


ART_SCALE = .48
SKIN_TRIANGLES = 23000
CANONICAL_CACHE = Path(__file__).resolve().parent / "runtime" / "dino-runtime-v1.blend"


def load_reviewed_copy(root_name="ogre"):
    """Append exactly the reviewed neutral mesh, rig and authored pigment."""
    assert root_name == "ogre"
    if not CANONICAL_CACHE.is_file():
        raise RuntimeError("Missing reviewed Dino runtime copy; see runtime/README.md")
    kit.tint("dino-painted-white", "#ffffff")
    with bpy.data.libraries.load(str(CANONICAL_CACHE), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj:
            bpy.context.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj.name == root_name)
    assert not any(obj.name == "ogre.visual" for obj in kit.descendants(root))
    art = next(obj for obj in root.children if obj.name == "ogre.art-scale")
    assert tuple(round(s, 5) for s in art.scale) == (.48,) * 3
    assert all(obj.library is None for obj in kit.descendants(root))
    root["runtimeCopySource"] = "runtime/" + CANONICAL_CACHE.name
    kit.refresh()
    return root


def select(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def protect_skin(obj):
    """A modest curvature priority for orbital, digital and bending regions."""
    P, _ = fk.arrays(obj)
    x, y, z = P.T
    face = np.clip((y - .52) / .32, 0, 1) * .6
    toe = np.clip((.35 - z) / .16, 0, 1) * .48
    knee = np.exp(-((z - .77) / .15) ** 2 - ((y - .17) / .18) ** 2) * .35
    hock = np.exp(-((z - .30) / .12) ** 2 - ((y + .15) / .17) ** 2) * .45
    arm = np.exp(-((z - 1.30) / .15) ** 2 - ((y - .67) / .17) ** 2) * .5
    priority = np.maximum.reduce([face, toe, knee, hock, arm,
                                  np.full(len(P), .025)])
    group = obj.vertex_groups.new(name="Dino runtime curvature priority")
    q = np.rint(priority * 100).astype(np.int32)
    for value in np.unique(q):
        group.add(np.flatnonzero(q == value).tolist(), float(value) / 100, "REPLACE")
    return group


def normalize_weights(obj):
    """Retain four actual bone influences; never export reduction masks."""
    indices = {g.index: g.name for g in obj.vertex_groups
               if g.name.startswith("ogre.")}
    if not indices:
        return
    buckets = {}
    for vertex in obj.data.vertices:
        influences = [(indices[g.group], g.weight) for g in vertex.groups
                      if g.group in indices and g.weight > 1e-7]
        influences.sort(key=lambda p: p[1], reverse=True)
        influences = influences[:4]
        total = sum(w for _, w in influences)
        assert total > 1e-6, f"Unweighted Dino vertex: {obj.name}:{vertex.index}"
        for name, value in influences:
            q = int(round(value / total * 1000000))
            buckets.setdefault((name, q), []).append(vertex.index)
    for name in indices.values():
        obj.vertex_groups[name].remove(list(range(len(obj.data.vertices))))
    for (name, q), vertices in buckets.items():
        obj.vertex_groups[name].add(vertices, q / 1000000, "REPLACE")


def reduce_mesh(obj, target, protect=False):
    """Collapse neutral geometry before its retained Armature modifier."""
    before = fk.tris(obj)
    if before <= target:
        return {"name": obj.name, "source": before, "runtime": before}
    started = time.monotonic()
    # Source normals contain authored scale relief and broad sculpt planes.
    dense = fk.Dense(obj)
    original, _ = fk.arrays(obj)
    extreme = original[np.concatenate((np.argmin(original, axis=0),
                                       np.argmax(original, axis=0)))]
    group = protect_skin(obj) if protect else None
    group_name = group.name if group else None
    select(obj)
    modifier = obj.modifiers.new("Dino reviewed runtime topology", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = target / before
    modifier.use_collapse_triangulate = True
    modifier.use_symmetry = False
    if group:
        modifier.vertex_group = group_name
        modifier.invert_vertex_group = True
        modifier.vertex_group_factor = .45
    while obj.modifiers[0] != modifier:
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    if group_name:
        retained = obj.vertex_groups.get(group_name)
        if retained:
            obj.vertex_groups.remove(retained)
    P, _ = fk.arrays(obj)
    # Reserve the exact approved native envelope. Six nearest terminal/source
    # extrema remain on the master surface, rather than globally stretching it.
    corrections = []
    for point in extreme:
        index = int(np.argmin(np.sum((P - point) ** 2, axis=1)))
        corrections.append(float(np.linalg.norm(P[index] - point)))
        P[index] = point
    fk.set_co(obj, P)
    kit.shade(obj, 75)
    desired = dense.normals(P)
    corners = np.empty(len(obj.data.loops), dtype=np.int32)
    obj.data.loops.foreach_get("vertex_index", corners)
    current = np.empty(len(obj.data.loops) * 3, dtype=np.float64)
    obj.data.corner_normals.foreach_get("vector", current)
    current = current.reshape(-1, 3)
    normals = desired[corners]
    sensible = np.sum(current * normals, axis=1) > .35
    current[sensible] = normals[sensible]
    obj.data.normals_split_custom_set(current.tolist())
    normalize_weights(obj)
    assert obj.data.attributes.get("DinoPigment"), f"Lost pigment on {obj.name}"
    report = {"name": obj.name, "source": before, "runtime": fk.tris(obj),
              "normalTransferFraction": float(np.mean(sensible)),
              "maximumExtremaCorrection": max(corrections),
              "seconds": time.monotonic() - started}
    print("DINO_REDUCE", json.dumps(report), flush=True)
    return report


def reduce_components(obj, target):
    """Protect small plates and reduce each tooth/lid independently."""
    name, before = obj.name, fk.tris(obj)
    select(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    pieces = list(bpy.context.selected_objects)
    # Preserve the actual object and its child eye/brow controls on rejoin.
    assert obj in pieces
    reports = []
    for piece in pieces:
        count = fk.tris(piece)
        used = {piece.data.materials[p.material_index].name
                for p in piece.data.polygons}
        if count <= 100:  # Embedded unequal angular scutes are already cheap.
            budget = count
        elif any(m.startswith("resin:dino-tooth") for m in used):
            budget = 104
        else:
            budget = target(count, used)
        reports.append(reduce_mesh(piece, budget))
    bpy.ops.object.select_all(action="DESELECT")
    for piece in pieces:
        piece.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    obj.name = name
    return {"name": name, "source": before, "runtime": fk.tris(obj),
            "components": reports}


def consolidate_dorsal(root):
    pieces = [obj for obj in kit.descendants(root)
              if obj.type == "MESH" and obj.name.startswith("ogre-dorsal-scute-")]
    if len(pieces) < 2:
        return
    obj = pieces[0]
    select(obj)
    for piece in pieces:
        piece.select_set(True)
    bpy.ops.object.join()
    obj.name = "ogre.torso-dorsal-scutes"


def rebuild_surface(root):
    """Resample source pigment in authoring rest space, then retain game size."""
    parents = [o for o in kit.descendants(root)
               if o.name in ("ogre.visual", "ogre.art-scale")]
    previous = [(o, o.scale.copy()) for o in parents]
    for parent in parents:
        parent.scale = (1, 1, 1)
    kit.refresh()
    surface.vertex_skin(root, {
        "hide": kit.TINTS["dino-forest-master"],
        "back": kit.TINTS["dino-dorsal-master"],
        "belly": kit.TINTS["dino-under-master"],
    })
    for parent, scale in previous:
        parent.scale = scale
    # All used families have no shader texture; per-face UVs just split vertices.
    for obj in kit.descendants(root):
        if obj.type == "MESH":
            for uv in list(obj.data.uv_layers):
                obj.data.uv_layers.remove(uv)
    kit.refresh()


def reduce(root, add_art_scale=True):
    """Reduce an editable source copy, leaving all bone pivots unchanged."""
    assert not root.get("dinoRuntimeTopology"), "Do not reduce the runtime twice"
    source_triangles = sum(fk.tris(o) for o in kit.descendants(root) if o.type == "MESH")
    reports = []
    meshes = [obj for obj in kit.descendants(root) if obj.type == "MESH"]
    for obj in meshes:
        if obj.get("continuousSkin"):
            reports.append(reduce_mesh(obj, SKIN_TRIANGLES, protect=True))
        elif obj.name == "ogre.head-fixed":
            reports.append(reduce_components(obj, lambda n, mats: 340))
        elif obj.name == "ogre.jaw-fixed":
            reports.append(reduce_components(obj, lambda n, mats: 1450 if n > 5000 else 240))
        elif obj.name.endswith("-claws"):
            reports.append(reduce_components(obj, lambda n, mats: 176))
        elif obj.name.startswith("ogre.brow"):
            reports.append(reduce_mesh(obj, 480))
        elif obj.name.startswith("ogre.eye"):
            reports.append(reduce_mesh(obj, 192))
        elif obj.name.startswith("ogre.pupil"):
            reports.append(reduce_components(obj, lambda n, mats: 128))
        elif obj.get("oralLining"):
            reports.append(reduce_mesh(obj, 400))
    consolidate_dorsal(root)
    # Collapse interpolates per-corner diffuse values independently, which can
    # leave flat coloured triangle islands on an otherwise continuous skin.
    # Re-evaluate the same authored analytic pigment at each new rest vertex.
    rebuild_surface(root)
    if add_art_scale:
        parent = next((o for o in root.children if o.name == "ogre.visual"), root)
        children = list(parent.children)
        art = kit.empty("ogre.art-scale")
        art.parent = parent
        kit.refresh()
        for child in children:
            kit.parent(child, art)
        art.scale = (ART_SCALE,) * 3
        art["uniformGameplayScale"] = ART_SCALE
    kit.refresh()
    runtime_triangles = sum(fk.tris(o) for o in kit.descendants(root) if o.type == "MESH")
    report = {"sourceTriangles": source_triangles, "runtimeTriangles": runtime_triangles,
              "skinTarget": SKIN_TRIANGLES, "innerArtScale": ART_SCALE,
              "meshReductions": reports,
              "method": "component budgets, transferred source normals, normalized four-bone weights"}
    root["dinoRuntimeTopology"] = json.dumps(report)
    return report


def smooth_export_corners(root):
    """One colour per vertex/material; keep actual lip/teeth colour borders."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        colour = mesh.color_attributes.get("AO")
        if not colour:
            continue
        vertex = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get("vertex_index", vertex)
        material = np.empty(len(mesh.loops), dtype=np.int32)
        for polygon in mesh.polygons:
            material[list(polygon.loop_indices)] = polygon.material_index
        key = vertex + material * len(mesh.vertices)
        values = np.empty(len(mesh.loops) * 4, dtype=np.float32)
        colour.data.foreach_get("color", values)
        values = values.reshape(-1, 4)
        sums = np.zeros((int(np.max(key)) + 1, 4), dtype=np.float64)
        counts = np.zeros(len(sums), dtype=np.int32)
        np.add.at(sums, key, values)
        np.add.at(counts, key, 1)
        averages = sums / np.maximum(counts, 1)[:, None]
        colour.data.foreach_set("color", averages[key].astype(np.float32).reshape(-1))
