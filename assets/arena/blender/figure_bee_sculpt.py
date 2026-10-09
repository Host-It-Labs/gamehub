"""Detailed Bee artist master and the deliberately sampled game mesh.

Run the private review driver to save a separate master and frozen runtime
copy. This adapter does not edit any shared kit or other figure.
"""
import json
from pathlib import Path

import bmesh
import bpy
import kit
from figure_bee_forms import PALETTE, build_forms


def build_model(master=False, root_name="bee"):
    if root_name != "bee":
        raise ValueError("The Bee has an authored, named flight rig")
    forms = build_forms(master)
    root = kit.empty(root_name)
    root["nativeScale"] = 1.0
    root["sourceStage"] = "detailed-master" if master else "sampled-runtime"
    root["sourceBrief"] = "work/arena/2026-10-08-roster/bee/brief.md"
    root["sourceTriangles"] = forms.triangles
    root["rigKind"] = "rigid cuticle, insect wing hinges and abdominal curl"
    root["anatomicalPivots"] = json.dumps(forms.pivots)
    root["reviewPendingExternalRenderer"] = True

    materials = {}
    for key, (name, hex_color, roughness, metalness) in PALETTE.items():
        family, tint = name.split(":")
        if tint != "team":
            kit.tint(tint, hex_color)
        mat = kit.material(name)
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metalness
        materials[key] = mat

    controls = {}
    for part, pivot in forms.pivots.items():
        name = part if part.startswith("bee") else "bee."+part
        obj = kit.empty(name, pivot)
        parent = controls.get(forms.parents[part], root)
        kit.parent(obj, parent)
        obj["anatomicalPivot"] = list(pivot)
        if part.startswith("bee"):
            points = [v for mesh in forms.meshes if mesh.part == part
                      for v in mesh.vertices]
            obj["faceWidth"] = max(p[0] for p in points)-min(p[0] for p in points)
            obj["faceHeight"] = max(p[2] for p in points)-min(p[2] for p in points)
        controls[part] = obj

    for source in forms.meshes:
        data = bpy.data.meshes.new(source.name)
        data.from_pydata(source.vertices, [], source.faces)
        data.update()
        palette = list(dict.fromkeys(source.materials))
        for key in palette:
            data.materials.append(materials[key])
        for polygon, material in zip(data.polygons, source.materials):
            polygon.material_index = palette.index(material)
            polygon.use_smooth = True
        bm = bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new(source.name, data)
        bpy.context.collection.objects.link(obj)
        obj["authoredSurface"] = source.name
        kit.uv_box(obj, small=True)
        ao = data.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
        for value in ao.data:
            value.color = (1, 1, 1, 1)
        data.color_attributes.active_color = ao
        kit.parent(obj, controls[source.part])
    kit.refresh()
    return root


def build_master(root_name="bee"):
    return build_model(True, root_name)


def build_runtime_source(root_name="bee"):
    return build_model(False, root_name)


def save_asset(root, path):
    """Only this figure's data is written; review cameras do not leak in."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.data.libraries.write(str(path), set(kit.descendants(root)),
                             path_remap="RELATIVE", fake_user=True, compress=True)
    return path
