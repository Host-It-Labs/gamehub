"""Verify the normal Medic builder without reading any .blend cache."""
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np

SOURCE = Path(__file__).resolve().parent
PROJECT = SOURCE.parents[2]
sys.path.insert(0, str(SOURCE))
import kit
import figure_medic

OUT = PROJECT / "work/arena/2026-10-04-vgm/medic/runtime/rebuild"
OUT.mkdir(parents=True, exist_ok=True)
kit.reset(65)
root = figure_medic.build_runtime()
meshes = [o for o in kit.descendants(root) if o.type == "MESH"]


def finish_hash():
    result = hashlib.sha256()
    for o in sorted(meshes, key=lambda obj: obj.name):
        ao = np.empty(len(o.data.color_attributes["AO"].data) * 4, dtype=np.float32)
        o.data.color_attributes["AO"].data.foreach_get("color", ao)
        normals = np.empty(len(o.data.attributes["MedicSourceNormals"].data) * 3, dtype=np.float32)
        o.data.attributes["MedicSourceNormals"].data.foreach_get("vector", normals)
        result.update(o.name.encode())
        result.update(ao.tobytes())
        result.update(normals.tobytes())
    return result.hexdigest()


before = finish_hash()
figure_medic.finish_ao(root)
figure_medic.finish_ao(root)
assert finish_hash() == before, "Normal collector finish must preserve reviewed AO/normals exactly"
output = PROJECT / "public/3d/arena/dev/vgm-medic-runtime-rebuild.glb"
kit.export([root], str(output))
evidence = {
    "entrypoint": "figure_medic.build_runtime()", "blendCacheRead": False,
    "runtime": str(output), "triangles": root["runtimeTriangles"],
    "meshNodes": len(meshes), "finishIdempotent": True,
    "aoAndNormalsHash": before, "arenaReviewedAO": root["arenaReviewedAO"],
    "aoContract": root["aoContract"],
}
(OUT / "evidence.json").write_text(json.dumps(evidence, indent=2))
print("MEDIC TRACKED PYTHON REBUILD", json.dumps(evidence), flush=True)
