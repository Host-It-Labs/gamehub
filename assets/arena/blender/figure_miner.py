"""The Miner (card "Miner"): a stocky early-1900s miner in a hard hat with a
brass lamp, a dusty cobalt shirt and denim dungarees, swinging a pickaxe.

Rebuilt 8-9 October 2026 (docs/concepts/2026-10-08-arena-roster/brief.md):
one connected sculpted skin with common-axis bones (torso, chest, head,
hat, clavicles, arms, elbows, wrists, legs, knees, feet and the pick's
`weapon` joint in the right fist) and live face controls (minereyeL/R,
minerpupilL/R, minerbrowL/R, minermouth). The old toy's sources are kept in
work/arena/2026-10-08-roster/miner/ (figure-miner-before.py and its kit).

Normal builds append the frozen, reviewed runtime copy
(assets/arena/blender/runtime/miner-runtime-v<N>.blend); the ordinary
collector then bakes AO and finish_ao() multiplies in the painted pigment.
build_master() rebuilds the detailed editable source;
figure_miner_build.py makes a new master and runtime copy.
"""
from figure_miner_rig import build_master  # noqa: F401
from figure_miner_runtime import finish_ao, load_reviewed_copy  # noqa: F401


def build(root_name="miner"):
    return load_reviewed_copy(root_name)
