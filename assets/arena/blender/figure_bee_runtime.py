"""Frozen Bee runtime loader; never reduces a source during collection."""
from pathlib import Path

import bpy
import kit
from figure_bee_sculpt import build_runtime_source

RUNTIME = Path(__file__).resolve().parent / "runtime" / "bee-runtime-v2.blend"


def load_runtime(root_name="bee"):
    if root_name != "bee":
        raise ValueError("The Bee flight rig has named native-scale controls")
    if not RUNTIME.is_file():
        # An equivalent deliberate sample remains usable when the sandbox
        # cannot start Blender. Freeze it with figure_bee_review.py before
        # artistic acceptance by the external integrating root.
        root = build_runtime_source(root_name)
        root["runtimeCopyNotYetFrozen"] = True
        return root
    with bpy.data.libraries.load(str(RUNTIME), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    for obj in loaded.objects:
        if obj:
            bpy.context.collection.objects.link(obj)
    root = next(obj for obj in loaded.objects if obj and obj.name == root_name)
    assert len(kit.descendants(root)) == len(loaded.objects)
    root["runtimeCopySource"] = "runtime/"+RUNTIME.name
    kit.refresh()
    return root
