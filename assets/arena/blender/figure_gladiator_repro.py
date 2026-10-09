"""Keep two reviewed secondary reductions exact across Blender contexts.

Collapse can choose a different equivalent edge on a symmetric small fastener
or the 2mm fixed face anchor. This tiny tracked topology recipe records those
two V7 meshes. The continuous anatomy, garment, shield and other equipment are
still rebuilt from the detailed source. No ignored blend cache is required.
"""
import hashlib
import json
from pathlib import Path
import sys
import zlib

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit

RECIPE = Path(__file__).with_name("figure_gladiator_secondary_v7.json.zlib")
SECONDARY = {"gladiator.kneeR-gilt", "gladiator.head"}


def capture_reviewed(root, master_path):
    pieces = {}
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.data.name not in SECONDARY:
            continue
        mesh = obj.data
        pieces[mesh.name] = {
            "vertices": [list(vertex.co) for vertex in mesh.vertices],
            "faces": [list(face.vertices) for face in mesh.polygons],
            "smooth": [face.use_smooth for face in mesh.polygons],
            "materials": [material.name for material in mesh.materials],
            "uv": {layer.name: [list(value.uv) for value in layer.data]
                   for layer in mesh.uv_layers},
            "activeUV": mesh.uv_layers.active.name if mesh.uv_layers else None,
            "colors": {layer.name: {"type": layer.data_type,
                       "domain": layer.domain,
                       "values": [list(value.color) for value in layer.data]}
                       for layer in mesh.color_attributes},
            "activeColor": mesh.color_attributes.active_color.name
                           if mesh.color_attributes.active_color else None,
            "activeColorIndex": mesh.color_attributes.active_color_index,
            "renderColor": mesh.color_attributes.render_color_index,
            "customNormals": [list(value.vector) for value in mesh.corner_normals]
                             if mesh.has_custom_normals else None,
        }
    assert set(pieces) == SECONDARY, (set(pieces), SECONDARY)
    master = Path(master_path)
    data = {"reviewedVersion": "runtime-v7", "masterSHA256":
            hashlib.sha256(master.read_bytes()).hexdigest(), "pieces": pieces}
    RECIPE.write_bytes(zlib.compress(json.dumps(data, separators=(",", ":")).encode(), 9))
    print("GLADIATOR secondary reviewed recipe", RECIPE, RECIPE.stat().st_size,
          "bytes", flush=True)


def restore_reviewed(root):
    data = json.loads(zlib.decompress(RECIPE.read_bytes()))
    seen = set()
    for obj in kit.descendants(root):
        if obj.type != "MESH" or obj.data.name not in data["pieces"]:
            continue
        name = obj.data.name
        piece = data["pieces"][name]
        old = obj.data
        mesh = bpy.data.meshes.new(name + ".reviewed-reduction")
        mesh.from_pydata(piece["vertices"], [], piece["faces"])
        mesh.materials.clear()
        for material in piece["materials"]:
            mesh.materials.append(kit.material(material))
        for face, smooth in zip(mesh.polygons, piece["smooth"]):
            face.use_smooth = smooth
        for label, values in piece["uv"].items():
            layer = mesh.uv_layers.new(name=label)
            for value, coords in zip(layer.data, values):
                value.uv = coords
        if piece["activeUV"]:
            mesh.uv_layers.active = mesh.uv_layers[piece["activeUV"]]
        inactive_color = piece["renderColor"] == -1 and bool(piece["colors"])
        if inactive_color:
            # The reviewed exporter emitted white COLOR_0 when no colour was
            # active, with authored AO retained as COLOR_1. Fresh mesh RNA
            # clamps the inactive index to zero; make that white layer explicit
            # so future exports preserve the reviewed live material finish.
            white = mesh.color_attributes.new("ReviewedWhite", "BYTE_COLOR", "POINT")
            for value in white.data:
                value.color = (1, 1, 1, 1)
        for label, info in piece["colors"].items():
            layer = mesh.color_attributes.new(label, info["type"], info["domain"])
            for value, color in zip(layer.data, info["values"]):
                value.color = color
        if piece["activeColor"]:
            mesh.color_attributes.active_color = mesh.color_attributes[piece["activeColor"]]
        mesh.color_attributes.active_color_index = 0 if inactive_color else piece["activeColorIndex"]
        mesh.color_attributes.render_color_index = 0 if inactive_color else piece["renderColor"]
        if piece["customNormals"]:
            mesh.normals_split_custom_set(piece["customNormals"])
        obj.data = mesh
        if old.users == 0:
            bpy.data.meshes.remove(old)
        mesh.name = name
        seen.add(name)
    assert seen == SECONDARY, (seen, SECONDARY)
    root["reviewedSecondaryRecipe"] = "Gladiator runtime-v7: right-knee fasteners and fixed face anchor"
    return root


if __name__ == "__main__":
    master = sys.argv[sys.argv.index("--") + 1]
    bpy.ops.wm.open_mainfile(filepath=master)
    capture_reviewed(bpy.data.objects["gladiator"], master)
