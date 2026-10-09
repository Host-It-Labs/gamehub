"""drake: append the independently reviewed neutral frozen runtime.

Install this entry point only after root signs the runtime gate and the
ordinary collector export passes. The detailed master remains separate.
No sculpt, reduction, pose or AO rebake occurs in normal roster builds.
"""
from figure_drake_runtime import load_runtime, finish_ao


def build(root_name="drake"):
    return load_runtime(root_name)
