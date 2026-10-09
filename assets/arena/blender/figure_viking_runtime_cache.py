"""Reconstruct the reviewed Viking runtime topology, normals and baked AO.

The procedural sculpt and separate reduction recipe remain editable in the
other Viking modules. This small data snapshot freezes the accepted reduction
and its genuine 64-sample AO bake, without loading an ignored .blend file or
rebaking differently when other figures already occupy the build scene.

The snapshot writer is an offline archival operation on the retained runtime
master. Normal builds only call restore(), which reads the tracked snapshot.
"""

import base64
import hashlib
import json
from pathlib import Path
from array import array
import sys
import zlib

import bpy
import kit

HERE = Path(__file__).resolve().parent
SNAPSHOT = HERE / "figure_viking_runtime_v4.json.zlib"


def packed(values, kind="f"):
    values = array(kind, values)
    if sys.byteorder != "little":
        values.byteswap()
    return base64.b64encode(values.tobytes()).decode("ascii")


def unpacked(value, kind="f"):
    out = array(kind)
    out.frombytes(base64.b64decode(value))
    if sys.byteorder != "little":
        out.byteswap()
    return out


def properties(obj):
    def plain(value):
        if hasattr(value, "to_dict"):
            return {k: plain(v) for k, v in value.to_dict().items()}
        if hasattr(value, "to_list"):
            return [plain(v) for v in value.to_list()]
        return value
    return {k: plain(v) for k, v in obj.items() if k != "_RNA_UI"}


def archive(master, accepted_glb, destination=SNAPSHOT):
    """Save exact mesh data from the held master; never write to that master."""
    master, accepted_glb = Path(master), Path(accepted_glb)
    bpy.ops.wm.open_mainfile(filepath=str(master))
    root = bpy.data.objects["viking"]
    nodes = []
    materials = {}
    for obj in kit.descendants(root):
        node = {
            "name": obj.name, "type": obj.type,
            "parent": obj.parent.name if obj.parent else None,
            "location": list(obj.location), "scale": list(obj.scale),
            "rotationMode": obj.rotation_mode,
            "rotationEuler": list(obj.rotation_euler),
            "rotationQuaternion": list(obj.rotation_quaternion),
            "properties": properties(obj),
        }
        if obj.type == "MESH":
            mesh = obj.data
            verts = [c for v in mesh.vertices for c in v.co]
            ao = mesh.color_attributes["AO"]
            uv = mesh.uv_layers.active
            node["mesh"] = {
                "name": mesh.name, "vertices": packed(verts),
                "faces": [list(p.vertices) for p in mesh.polygons],
                "materialIndices": [p.material_index for p in mesh.polygons],
                "smoothFaces": [p.use_smooth for p in mesh.polygons],
                "materials": [m.name for m in mesh.materials],
                "uvName": uv.name,
                "uv": packed(c for item in uv.data for c in item.uv),
                "AO": packed(c for item in ao.data for c in item.color_srgb),
                "AOType": ao.data_type, "AODomain": ao.domain,
                "edges": [list(e.vertices) for e in mesh.edges],
                "sharpEdges": [e.use_edge_sharp for e in mesh.edges],
                "encodedNormals": packed((c for item in mesh.attributes["custom_normal"].data
                                          for c in item.value), "h"),
            }
            for m in mesh.materials:
                bsdf = m.node_tree.nodes.get("Principled BSDF")
                materials[m.name] = {
                    "properties": properties(m),
                    "color": list(bsdf.inputs["Base Color"].default_value),
                    "roughness": bsdf.inputs["Roughness"].default_value,
                    "metallic": bsdf.inputs["Metallic"].default_value,
                    "specularIOR": bsdf.inputs["Specular IOR Level"].default_value,
                }
        nodes.append(node)
    payload = {
        "schema": "arena-viking-reviewed-runtime-1",
        "sourceVersion": "detailed-v8 / runtime-v4",
        "masterSHA256": hashlib.sha256(master.read_bytes()).hexdigest(),
        "acceptedGLBSHA256": hashlib.sha256(accepted_glb.read_bytes()).hexdigest(),
        "AO": {"samples": 64, "distance": .17, "ground": True},
        "materials": materials, "nodes": nodes,
    }
    destination = Path(destination)
    destination.write_bytes(zlib.compress(json.dumps(payload, separators=(",", ":")).encode(), 9))
    print("VIKING_RUNTIME_SNAPSHOT", destination, destination.stat().st_size, flush=True)


def restore(root_name="viking"):
    payload = json.loads(zlib.decompress(SNAPSHOT.read_bytes()))
    assert payload["schema"] == "arena-viking-reviewed-runtime-1"
    mats = {}
    for name, spec in payload["materials"].items():
        mat = kit.material(name)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        # Existing material families belong to the shared build. New Viking
        # names preserve the exact accepted preview properties and tint.
        if mat.users == 0:
            bsdf.inputs["Base Color"].default_value = spec["color"]
            bsdf.inputs["Roughness"].default_value = spec["roughness"]
            bsdf.inputs["Metallic"].default_value = spec["metallic"]
            bsdf.inputs["Specular IOR Level"].default_value = spec["specularIOR"]
            for key, value in spec["properties"].items():
                mat[key] = value
        mats[name] = mat
    objects = {}
    for spec in payload["nodes"]:
        name = spec["name"].replace("viking", root_name, 1)
        mesh_spec = spec.get("mesh")
        mesh = None
        if mesh_spec:
            mesh = bpy.data.meshes.new(mesh_spec["name"])
            vertices = unpacked(mesh_spec["vertices"])
            mesh.from_pydata([vertices[i:i+3] for i in range(0, len(vertices), 3)], mesh_spec["edges"], mesh_spec["faces"])
            for mat_name in mesh_spec["materials"]:
                mesh.materials.append(mats[mat_name])
            mesh.polygons.foreach_set("material_index", mesh_spec["materialIndices"])
            mesh.polygons.foreach_set("use_smooth", mesh_spec["smoothFaces"])
            mesh.edges.foreach_set("use_edge_sharp", mesh_spec["sharpEdges"])
            uv = mesh.uv_layers.new(name=mesh_spec["uvName"])
            uv.data.foreach_set("uv", unpacked(mesh_spec["uv"]))
            ao = mesh.color_attributes.new("AO", mesh_spec["AOType"], mesh_spec["AODomain"])
            ao.data.foreach_set("color_srgb", unpacked(mesh_spec["AO"]))
            mesh.color_attributes.active_color = ao
            mesh.color_attributes.render_color_index = list(mesh.color_attributes).index(ao)
            # Decoding and re-encoding normals introduces a second round of
            # Blender's INT16 quantization. Retain the actual authored values
            # and the matching split edges, so their normal spaces agree.
            normals = mesh.attributes.new("custom_normal", "INT16_2D", "CORNER")
            normals.data.foreach_set("value", unpacked(mesh_spec["encodedNormals"], "h"))
            mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.location, obj.scale = spec["location"], spec["scale"]
        obj.rotation_mode = spec["rotationMode"]
        obj.rotation_euler = spec["rotationEuler"]
        obj.rotation_quaternion = spec["rotationQuaternion"]
        for key, value in spec["properties"].items():
            obj[key] = value
        objects[spec["name"]] = obj
    for spec in payload["nodes"]:
        if spec["parent"]:
            objects[spec["name"]].parent = objects[spec["parent"]]
    root = objects["viking"]
    root["arenaReviewedRestPose"] = 1
    root["arenaReviewedAO"] = 1
    root["arenaAOSamples"] = payload["AO"]["samples"]
    root["arenaAODistance"] = payload["AO"]["distance"]
    root["runtimeSnapshotSHA256"] = hashlib.sha256(SNAPSHOT.read_bytes()).hexdigest()
    root["runtimeReviewedGLBSHA256"] = payload["acceptedGLBSHA256"]
    root["runtimeReviewedMasterSHA256"] = payload["masterSHA256"]
    kit.refresh()
    return root
