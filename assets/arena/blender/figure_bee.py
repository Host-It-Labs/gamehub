"""Portrait-matched honeybee: shaped cuticle, six legs and four thin wings.

The editable detailed master is private to this figure. Normal collection
loads its separately frozen runtime copy, under 1,500 triangles. Until the
external Blender review can run, the equivalent fast sampled source builds
without touching the shared folk kit. Review and blockers live in the Bee
folder for the 8 October roster pass.
"""
from figure_bee_sculpt import build_master
from figure_bee_runtime import load_runtime


def build(root_name="bee"):
    return load_runtime(root_name)
