"""Jetpack: authored relaxed sculpt and separately reviewed frozen runtime.

The detailed source is built explicitly by figure_jetpack_review.py (source
stage). Ordinary collectors append a frozen reviewed copy and never sculpt
or decimate it during a multi-agent bundle build. The shared folk kit stays
untouched. See work/arena/2026-10-08-roster/jetpack/review.md for review status.
"""
import os
import re

import bpy
import kit

from figure_jetpack_runtime import finish_ao, load_runtime


def _clean_materials(root, existing):
    """Reuse canonical collector pots without changing another figure's finish."""
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
        if (material not in existing and material.users == 0 and
                re.search(r"\.\d{3}$", material.name)):
            bpy.data.materials.remove(material)


def build(root_name="jetpack"):
    if os.environ.get("ARENA_SOURCE_MASTER") == "1":
        from figure_jetpack_sculpt import build_master
        return build_master(root_name)
    existing = set(bpy.data.materials)
    root = load_runtime(root_name)
    _clean_materials(root, existing)
    kit.refresh()
    return root
