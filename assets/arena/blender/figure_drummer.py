"""Drummer: normal builds append the accepted neutral runtime copy.

The detailed v4 master stays untouched. Root builds/reviews the work copy,
then installs identical frozen bytes under runtime/ for clean builds.
No sculpt, reduction, pose or pigment/AO rebake runs in build().
"""
import os
import re
from pathlib import Path

import bpy
import kit
from figure_drummer_runtime import load_reviewed_copy, require_review

R = "drummer"
HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
CANONICAL_COPY = HERE / "runtime/drummer-runtime-v4.blend"
REVIEWED_COPY = PROJECT / "work/arena/2026-10-08-roster/drummer/drummer-runtime-v4.blend"


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
    copy = Path(os.environ.get("DRUMMER_RUNTIME_PATH") or
                (CANONICAL_COPY if CANONICAL_COPY.is_file() else REVIEWED_COPY))
    if copy.resolve() == REVIEWED_COPY.resolve():
        require_review("runtime")
    existing = set(bpy.data.materials)
    root = load_reviewed_copy(root_name, path=copy)
    _clean_materials(root, existing)
    root["runtimeCopySource"] = str(copy.relative_to(PROJECT)) if copy.is_relative_to(PROJECT) else str(copy)
    root["b2RuntimeReviewPending"] = False
    root["runtimeReductionPendingVisualReview"] = False
    kit.refresh()
    return root
