"""Arena Medic: editable, weighted adult character master.

The independent pre-rebuild sculpt is retained in figure_medic_forms.py and
work/arena/2026-10-04-vgm/before. Development builds preserve the detailed
source; the runtime copy is reduced only after neutral and moving review.
"""
from figure_medic_sculpt import build_master


def build(root_name="medic"):
    if root_name != "medic":
        raise ValueError("The field medic keeps the existing medic identity")
    return build_master()


def build_runtime(root_name="medic"):
    """Reconstruct the separate reviewed runtime from tracked Python."""
    from figure_medic_runtime import reduce_runtime
    return reduce_runtime(build(root_name))


def finish_ao(root):
    if root.get("unoptimized"):
        from figure_medic_sculpt import finish_ao as finish_source
        finish_source(root)
    else:
        from figure_medic_runtime import finish_ao as finish_runtime
        finish_runtime(root)
