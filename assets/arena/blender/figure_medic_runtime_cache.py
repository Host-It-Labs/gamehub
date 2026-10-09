"""Held V10 corners for reproducible procedural runtime reconstruction.

The detailed master and continuous anatomical reduction remain procedural.
Six small nail/bun/lip/lining/tie groups retain their accepted geometry.
All other anatomy, tailoring and weights remain procedural; their matched
corners replay the accepted normals, pigment, AO and UV finish instead of
sampling a fresh bake. Builds never read a .blend. Run this file in Blender
only to extract the record from the immutable reviewed runtime.
"""
import hashlib
from itertools import product
import json
from pathlib import Path
import sys
import zlib

import bpy
import numpy as np

SOURCE = Path(__file__).resolve().parent
PROJECT = SOURCE.parents[2]
CACHE = SOURCE / "figure_medic_runtime_v10.json.zlib"
PARTS = {
    "medic.nail--1-0", "medic.nail-1-0", "medic.bun-sweep-0.002",
    "medic.lip-False", "medic-innerskirt", "medic.team-tie.002",
}


def array(collection, field, width, dtype=np.float32):
    values = np.empty(len(collection) * width, dtype=dtype)
    collection.foreach_get(field, values)
    return values.reshape(-1, width).tolist()


def surface_record(obj):
    mesh = obj.data
    return {
        "vertices": array(mesh.vertices, "co", 3),
        "faces": [list(p.vertices) for p in mesh.polygons],
        "materials": [m.name for m in mesh.materials],
        "materialIndices": [p.material_index for p in mesh.polygons],
        "normals": array(mesh.attributes["MedicSourceNormals"].data, "vector", 3),
        "ao": array(mesh.color_attributes["AO"].data, "color", 4),
        "uv": {layer.name: array(layer.data, "uv", 2) for layer in mesh.uv_layers},
        "uvActive": mesh.uv_layers.active_index,
        "uvRender": next((layer.name for layer in mesh.uv_layers if layer.active_render), ""),
    }


def face_key(material, points):
    """Match winding and material, independent of join/vertex/face order."""
    points = tuple(tuple(round(float(x), 6) for x in p) for p in points)
    start = min(range(len(points)), key=lambda i: points[i:] + points[:i])
    return (material, points[start:] + points[:start]), start


def restore_reviewed_finish(root, payload):
    objects = {o.name: o for o in root.children_recursive if o.type == "MESH"}
    for name, part in payload["finish"].items():
        obj = objects[name]
        mesh = obj.data
        records, nearby = {}, {}
        loop = 0
        for face, material_index in zip(part["faces"], part["materialIndices"]):
            key, start = face_key(part["materials"][material_index],
                                  [part["vertices"][i] for i in face])
            indices = [loop + (i + start) % len(face) for i in range(len(face))]
            records.setdefault(key, []).append(indices)
            points = np.asarray([part["vertices"][face[(i + start) % len(face)]]
                                 for i in range(len(face))], dtype=np.float64)
            cell = tuple(np.floor(points.mean(axis=0) * 10000).astype(int))
            nearby.setdefault((part["materials"][material_index], len(face), cell), []).append(
                (key, indices, points))
            loop += len(face)
        assert loop == len(mesh.loops), (name, "changed corner topology", loop, len(mesh.loops))
        assert len(part["faces"]) == len(mesh.polygons), (name, "changed polygon topology")
        normals = np.asarray(part["normals"], dtype=np.float32)
        ao = np.asarray(part["ao"], dtype=np.float32)
        source_uv = {k: np.asarray(v, dtype=np.float32) for k, v in part["uv"].items()}
        current_normals = np.asarray(array(mesh.attributes["MedicSourceNormals"].data,
                                           "vector", 3), dtype=np.float32)
        matched = np.empty(len(mesh.loops), dtype=np.int32)
        material_names = [m.name for m in mesh.materials]
        for polygon in mesh.polygons:
            key, start = face_key(material_names[polygon.material_index],
                                  [mesh.vertices[i].co for i in polygon.vertices])
            candidates = records.get(key)
            target = [polygon.loop_start + (i + start) % polygon.loop_total
                      for i in range(polygon.loop_total)]
            if not candidates:
                # Saved matrices can move a float by a few ulps across a
                # rounded-key boundary. Match the actual ordered corners
                # within1µm; never accept a changed panel or winding.
                points = np.asarray([mesh.vertices[mesh.loops[i].vertex_index].co
                                     for i in target], dtype=np.float64)
                cell = np.floor(points.mean(axis=0) * 10000).astype(int)
                matches = []
                for offset in product((-1, 0, 1), repeat=3):
                    near_cell = tuple(cell + np.asarray(offset))
                    for old_key, old_indices, old_points in nearby.get(
                        (material_names[polygon.material_index], len(target), near_cell), []):
                        if old_indices not in records[old_key]:
                            continue
                        for shift in range(len(target)):
                            distance = np.linalg.norm(points - np.roll(old_points, -shift, axis=0), axis=1)
                            if distance.max() <= 1e-6:
                                rotated = old_indices[shift:] + old_indices[:shift]
                                normal_error = float(np.sum((normals[rotated] - current_normals[target]) ** 2))
                                matches.append((float(distance.max()), normal_error, old_key,
                                                old_indices, rotated))
                assert matches, (name, "procedural face differs from reviewed V10", key)
                _, _, old_key, old_indices, rotated = min(matches, key=lambda m: m[:2])
                records[old_key].remove(old_indices)
                matched[target] = rotated
                continue
            # Coincident faces can carry different split normals. Preserve
            # the procedural face identity before replaying its finish.
            at = min(range(len(candidates)), key=lambda i: float(np.sum(
                (normals[candidates[i]] - current_normals[target]) ** 2)))
            matched[target] = candidates.pop(at)
        assert not any(records.values()), (name, "unmatched reviewed corners")
        materials = {m.name: m for m in mesh.materials}
        assert set(materials) == set(part["materials"]), (name, "changed materials")
        indices = [part["materials"].index(material_names[p.material_index])
                   for p in mesh.polygons]
        mesh.materials.clear()
        for material in part["materials"]:
            mesh.materials.append(materials[material])
        mesh.polygons.foreach_set("material_index", indices)
        for layer in list(mesh.uv_layers):
            mesh.uv_layers.remove(layer)
        for layer_name, values in source_uv.items():
            layer = mesh.uv_layers.new(name=layer_name)
            layer.data.foreach_set("uv", values[matched].reshape(-1))
            layer.active_render = layer_name == part["uvRender"]
        if mesh.uv_layers:
            mesh.uv_layers.active_index = part["uvActive"]
        color = mesh.color_attributes.get("AO") or mesh.color_attributes.new(
            "AO", "BYTE_COLOR", "CORNER")
        color.data.foreach_set("color", ao[matched].reshape(-1))
        mesh.color_attributes.active_color = color
        mesh.color_attributes.render_color_index = 0
        # These surfaces already have the reviewed procedural projection.
        # Keep the native encoded split normals intact: decoding/re-encoding
        # a saved custom normal can quantize it again. The collector proof
        # checks the actual exported normal vectors against held V10.
        attr = mesh.attributes.get("MedicReviewedAO") or mesh.attributes.new(
            "MedicReviewedAO", "FLOAT_VECTOR", "CORNER")
        attr.data.foreach_set("vector", ao[matched, :3].reshape(-1))
    root["runtimeReviewedFinish"] = len(payload["finish"]) + len(payload["components"])
    root["arenaReviewedAO"] = 1


def restore_reviewed_components(root):
    payload = json.loads(zlib.decompress(CACHE.read_bytes()))
    objects = {o.data.name: o for o in root.children_recursive if o.type == "MESH"}
    for name, part in payload["components"].items():
        obj = objects[name]
        assert not obj.vertex_groups, "Only the six rigid accessories use held data"
        original = obj.data
        materials = list(original.materials)
        assert [m.name for m in materials] == part["materials"], name
        mesh = bpy.data.meshes.new(name + " held V10")
        mesh.from_pydata(part["vertices"], [], part["faces"])
        mesh.update()
        for material in materials:
            mesh.materials.append(material)
        mesh.polygons.foreach_set("material_index", part["materialIndices"])
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        sharp = {tuple(sorted(edge)) for edge in part["sharpEdges"]}
        for edge in mesh.edges:
            edge.use_edge_sharp = tuple(sorted(edge.vertices)) in sharp
        for layer_name, values in part["uv"].items():
            layer = mesh.uv_layers.new(name=layer_name)
            layer.data.foreach_set("uv", np.asarray(values, dtype=np.float32).reshape(-1))
            layer.active_render = layer_name == part["uvRender"]
        if mesh.uv_layers:
            mesh.uv_layers.active_index = part["uvActive"]
        ao = mesh.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        rgba = np.asarray(part["ao"], dtype=np.float32)
        ao.data.foreach_set("color", rgba.reshape(-1))
        mesh.color_attributes.active_color = ao
        mesh.color_attributes.render_color_index = 0
        for attr_name, values in (("MedicSourceNormals", part["normals"]),
                                  ("MedicReviewedAO", rgba[:, :3])):
            attr = mesh.attributes.new(attr_name, "FLOAT_VECTOR", "CORNER")
            attr.data.foreach_set("vector", np.asarray(values, dtype=np.float32).reshape(-1))
        mesh.normals_split_custom_set(part["normals"])
        obj.data = mesh
        bpy.data.meshes.remove(original)
        mesh.name = name
    root["runtimeReviewedComponents"] = ";".join(sorted(payload["components"]))
    restore_reviewed_finish(root, payload)
    root["runtimeReviewedCacheSHA256"] = hashlib.sha256(CACHE.read_bytes()).hexdigest()
    return root


def generate_cache():
    sys.path.insert(0, str(SOURCE))
    import kit
    master = PROJECT / "work/arena/2026-10-04-vgm/medic/runtime/v10/medic-runtime-v10.blend"
    glb = PROJECT / "public/3d/arena/dev/vgm-medic-runtime-v10.glb"
    expected = "0b54af3f77d1ebc89d45a3a20a1dff95067595a54a894c7d845c18fd466de2d5"
    assert hashlib.sha256(glb.read_bytes()).hexdigest() == expected
    master_hash = hashlib.sha256(master.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(master))
    root = bpy.data.objects["medic"]
    components, finish = {}, {}
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        if obj.data.name not in PARTS:
            finish[obj.name] = surface_record(obj)
            continue
        assert not obj.vertex_groups, obj.name
        mesh = obj.data
        components[mesh.name] = {**surface_record(obj),
            "object": obj.name,
            "sharpEdges": [list(edge.vertices) for edge in mesh.edges if edge.use_edge_sharp],
        }
    assert set(components) == PARTS, (set(components), PARTS)
    payload = {"version": 10, "format": 2, "reviewedGLBSHA256": expected,
               "reviewedBlendSHA256": master_hash, "components": components, "finish": finish}
    CACHE.write_bytes(zlib.compress(json.dumps(payload, separators=(",", ":")).encode(), 9))
    assert hashlib.sha256(master.read_bytes()).hexdigest() == master_hash
    assert hashlib.sha256(glb.read_bytes()).hexdigest() == expected
    evidence = {"cache": str(CACHE), "bytes": CACHE.stat().st_size,
                "sha256": hashlib.sha256(CACHE.read_bytes()).hexdigest(),
                "reviewedBlendSHA256": master_hash, "reviewedGLBSHA256": expected,
                "components": {name: {"object": p["object"], "vertices": len(p["vertices"]),
                                      "faces": len(p["faces"])} for name, p in components.items()},
                "proceduralSurfaceGroups": len(finish),
                "approvedRuntimeUnchanged": True}
    (PROJECT / "work/arena/2026-10-04-vgm/medic/runtime/v10/cache-generation.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print("MEDIC HELD COMPONENT CACHE", json.dumps(evidence), flush=True)
    restore_reviewed_components(root)
    kit.export([root], str(PROJECT / "public/3d/arena/dev/vgm-medic-cache-probe.glb"))


if __name__ == "__main__":
    generate_cache()
