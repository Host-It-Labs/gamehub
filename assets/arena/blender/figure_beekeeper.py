"""Beekeeper entry point: append the separately reviewed frozen game copy.

Detailed editable source lives in figure_beekeeper_sculpt.py. The review driver
first saves/renders that master, then creates a runtime copy only after its
explicit source acceptance gate. Normal roster builds never resculpt or reduce.
The previous folk-kit figure is retained in the owned work folder for provenance.
"""
from figure_beekeeper_runtime import load_runtime, finish_ao
from figure_beekeeper_sculpt import build_master


def build(root_name="beekeeper"):
    return load_runtime(root_name)
