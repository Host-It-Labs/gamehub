"""CPU-only diagnostic GLB writer for the Bee's authored surface sample.

This is not the shipping collector. It makes inspection possible when the
sandbox cannot start Blender/Metal. No textures, private material tints,
real part pivots and one COLOR_0 channel use the normal figure contract.
Run with system Python; the normal external export still uses figures.py.
"""
import argparse
import json
import math
from pathlib import Path
import struct

from figure_bee_forms import PALETTE, build_forms, sub


def linear(hex_color):
    srgb = [int(hex_color[i:i+2], 16)/255 for i in (1, 3, 5)]
    return [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb]


def yup(v):
    return (v[0], v[2], -v[1])


def export(path, master=False):
    forms = build_forms(master)
    model = {"asset": {"version": "2.0", "generator": "Bee private CPU diagnostic writer"},
             "scenes": [{"nodes": [0]}], "scene": 0, "nodes": [],
             "meshes": [], "materials": [], "accessors": [], "bufferViews": []}
    binary = bytearray()
    model["nodes"].append({"name": "bee", "children": [], "extras": {
        "nativeScale": 1, "sourceStage": "detailed-master" if master else "sampled-runtime",
        "diagnosticCPUExport": True, "sourceTriangles": forms.triangles,
        "reviewPendingExternalRenderer": True}})
    nodes = {}
    for part, pivot in forms.pivots.items():
        parent = forms.parents[part]
        parent_pos = forms.pivots[parent] if parent else (0, 0, 0)
        record = {"name": part if part.startswith("bee") else "bee."+part,
                  "translation": yup(sub(pivot, parent_pos)), "children": [],
                  "extras": {"anatomicalPivot": list(pivot)}}
        if part == "head":
            # Ordinary collection adds this five-degree head tilt to Bee.
            half = math.radians(5)/2
            record["rotation"] = [math.sin(half), 0, 0, math.cos(half)]
        if part.startswith("bee"):
            points = [p for mesh in forms.meshes if mesh.part == part for p in mesh.vertices]
            record["extras"].update({
                "faceWidth": max(p[0] for p in points)-min(p[0] for p in points),
                "faceHeight": max(p[2] for p in points)-min(p[2] for p in points)})
        nodes[part] = len(model["nodes"])
        model["nodes"].append(record)
        model["nodes"][nodes[parent] if parent else 0]["children"].append(nodes[part])
    material_ids = {}
    for key, (name, hex_color, roughness, metalness) in PALETTE.items():
        material_ids[key] = len(model["materials"])
        model["materials"].append({"name": name,
            "pbrMetallicRoughness": {"baseColorFactor": linear(hex_color)+[1],
                                    "roughnessFactor": roughness,
                                    "metallicFactor": metalness},
            "extras": {"hex": hex_color}})

    def attribute(values, width, kind="FLOAT", minimum=False, indices=False):
        while len(binary) % 4:
            binary.append(0)
        byte_offset = len(binary)
        flat = [v for row in values for v in row] if width > 1 else values
        component = 5126 if kind == "FLOAT" else 5123
        fmt = "f" if kind == "FLOAT" else "H"
        data = struct.pack("<"+fmt*len(flat), *flat)
        binary.extend(data)
        view = len(model["bufferViews"])
        model["bufferViews"].append({"buffer": 0, "byteOffset": byte_offset,
                                      "byteLength": len(data),
                                      "target": 34963 if indices else 34962})
        accessor = {"bufferView": view, "componentType": component,
                    "count": len(values), "type": {1: "SCALAR", 3: "VEC3", 4: "VEC4"}[width]}
        if minimum:
            accessor["min"] = [min(row[k] for row in values) for k in range(width)]
            accessor["max"] = [max(row[k] for row in values) for k in range(width)]
        index = len(model["accessors"])
        model["accessors"].append(accessor)
        return index

    for part, pivot in forms.pivots.items():
        sources = [mesh for mesh in forms.meshes if mesh.part == part]
        if not sources:
            continue
        primitives = []
        for material in PALETTE:
            vertices, normals, triangles = [], [], []
            for mesh in sources:
                if material not in mesh.materials:
                    continue
                ns = mesh.normals()
                remap = {}
                for face, mat in zip(mesh.faces, mesh.materials):
                    if mat != material:
                        continue
                    local = []
                    for index in face:
                        if index not in remap:
                            remap[index] = len(vertices)
                            vertices.append(yup(sub(mesh.vertices[index], pivot)))
                            normals.append(yup(ns[index]))
                        local.append(remap[index])
                    for j in range(1, len(local)-1):
                        triangles += [local[0], local[j], local[j+1]]
            if not triangles:
                continue
            primitives.append({"attributes": {
                "POSITION": attribute(vertices, 3, minimum=True),
                "NORMAL": attribute(normals, 3),
                "COLOR_0": attribute([(1, 1, 1, 1)]*len(vertices), 4)},
                "indices": attribute(triangles, 1, "UNSIGNED_SHORT", indices=True),
                "material": material_ids[material], "mode": 4})
        index = len(model["meshes"])
        model["meshes"].append({"name": "bee-"+part+"-surface", "primitives": primitives})
        mesh_node = len(model["nodes"])
        model["nodes"].append({"name": "bee-"+part+"-surface", "mesh": index})
        model["nodes"][nodes[part]]["children"].append(mesh_node)
    while len(binary) % 4:
        binary.append(0)
    model["buffers"] = [{"byteLength": len(binary)}]
    serialized = json.dumps(model, separators=(",", ":")).encode()
    while len(serialized) % 4:
        serialized += b" "
    glb = (struct.pack("<III", 0x46546C67, 2, 12+8+len(serialized)+8+len(binary))+
           struct.pack("<II", len(serialized), 0x4E4F534A)+serialized+
           struct.pack("<II", len(binary), 0x004E4942)+binary)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(glb)
    print(json.dumps({"path": str(path), "triangles": forms.triangles,
                      "bytes": len(glb), "bounds": forms.bounds(),
                      "diagnosticCPUExport": True}))
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--master", action="store_true")
    args = parser.parse_args()
    export(args.path, args.master)
