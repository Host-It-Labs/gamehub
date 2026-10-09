"""The Firefighter: normal builds append the accepted neutral runtime copy.

The detailed master stays in figure_firefighter_sculpt.py and the owned work
folder. No sculpt, reduction, pose or pigment/AO rebake runs in build().
The root installs the identical frozen file under runtime/ for clean builds;
the existing reviewed work copy also supports the current working tree.
"""
import os
import re
from pathlib import Path

import bpy
import kit
from figure_firefighter_runtime import load_reviewed_copy

R = "firefighter"
HERE = Path(__file__).resolve().parent
CANONICAL_COPY = HERE / "runtime/firefighter-runtime-v1.blend"
REVIEWED_COPY = HERE.parents[2] / "work/arena/2026-10-08-roster/firefighter/firefighter-runtime-v1.blend"


def _clean_materials(root, existing):
    """Reuse session materials, stripping only Blender duplicate suffixes."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            base = re.sub(r"(?:\.\d{3})+$", "", material.name)
            if base == material.name:
                continue
            shared = bpy.data.materials.get(base)
            if shared is not None:
                slot.material = shared
            else:
                material.name = base
    for material in list(bpy.data.materials):
        if material not in existing and material.users == 0 and re.search(r"\.\d{3}$", material.name):
            bpy.data.materials.remove(material)


def build(root_name=R):
    copy = Path(os.environ.get("FIREFIGHTER_RUNTIME_PATH") or
                (CANONICAL_COPY if CANONICAL_COPY.is_file() else REVIEWED_COPY))
    existing = set(bpy.data.materials)
    root = load_reviewed_copy(root_name, path=copy)
    _clean_materials(root, existing)
    root["runtimeCopySource"] = str(copy.relative_to(HERE.parents[2])) if copy.is_relative_to(HERE.parents[2]) else str(copy)
    root["runtimeReductionPendingVisualReview"] = False
    kit.refresh()
    return root
