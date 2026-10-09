"""The tower Guard: normal builds append the accepted neutral runtime copy.

The detailed master stays in figure_guard_sculpt.py and the owned work
folder. No sculpt, reduction, pose or pigment/AO rebake runs in build().
The root installs the identical frozen file under runtime/ for clean builds;
the existing reviewed work copy also supports the current working tree.
"""
import os
import re
import hashlib
import json
from pathlib import Path

import bpy
import kit

R = "guard"
HERE = Path(__file__).resolve().parent
CANONICAL_COPY = HERE / "runtime/guard-runtime-v2.blend"
REVIEWED_COPY = HERE.parents[2] / "work/arena/2026-10-08-roster/guard/guard-runtime-v2.blend"
FROZEN_SHA256 = "9077e9536bff0fa2f4a73a897a2c3ccdb4fc4c62aab70ace06a8f5d083fa3210"


def load_runtime(root_name, path):
    """Append the exact accepted copy without work-folder review dependencies."""
    if root_name != R:
        raise ValueError("Guard keeps its authored rig identity")
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != FROZEN_SHA256:
        raise RuntimeError("Install the accepted Guard runtime v2; this build never sculpts or reduces it")
    with bpy.data.libraries.load(str(path), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj and not obj.users_collection:
            bpy.context.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj and obj.name == R)
    objects = kit.descendants(root)
    if len(objects) != len([obj for obj in loaded.objects if obj]):
        raise RuntimeError("Guard cache includes unrelated objects")
    rigs = [obj for obj in objects if obj.type == "ARMATURE"]
    if len(rigs) != 1 or not root.get("arenaReviewedAO"):
        raise RuntimeError("Guard cache lost its rig or reviewed AO")
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in meshes) != 29011:
        raise RuntimeError("Guard cache differs from its accepted 29,011-triangle geometry")
    if any(len(obj.data.color_attributes) != 1 or obj.data.color_attributes[0].name != "AO" for obj in meshes):
        raise RuntimeError("Guard needs the single baked pigment/AO colour stream")
    poses = json.loads(root.get("poses", "{}"))
    if set(poses) != {"draw", "loose"} or root.get("arrowOrigin") != "nock":
        raise RuntimeError("Guard cache lost the TowerCrew draw/loose/nock contract")
    root["b2RuntimeReviewPending"] = False  # static runtime accepted; TowerCrew remains pending below
    return root


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
    copy = Path(os.environ.get("GUARD_RUNTIME_PATH") or
                (CANONICAL_COPY if CANONICAL_COPY.is_file() else REVIEWED_COPY))
    existing = set(bpy.data.materials)
    root = load_runtime(root_name, copy)
    _clean_materials(root, existing)
    root["runtimeCopySource"] = str(copy.relative_to(HERE.parents[2])) if copy.is_relative_to(HERE.parents[2]) else str(copy)
    root["towerStringIntegrationPending"] = True
    kit.refresh()
    return root
