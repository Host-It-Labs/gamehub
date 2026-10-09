"""Balloon-only facade for the private source-gated vehicle reducer."""
from figure_drake_runtime import reduce_master, finish_ao
from figure_drake_runtime import load_runtime as _load


def load_runtime(root_name="balloon",path=None,reviewed=True):
    if root_name!="balloon":raise ValueError("Preserve the stable Balloon identity")
    return _load(root_name,path,reviewed)
