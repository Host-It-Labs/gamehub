"""Gunner: append the frozen source-derived copy after root runtime review.

Detailed editable sculpt: figure_gunner_sculpt.py. Source/runtime evidence,
copy hashes and root-signed review gates live in the owned roster folder.
Root installs identical accepted bytes under runtime/ before activating this
loader. Clean collector builds then need no ignored work files.
Normal collector builds do not sculpt, decimate, rebake or change the pose.
"""
from figure_gunner_runtime import load_reviewed_copy


def build(root_name="gunner"):
    return load_reviewed_copy(root_name)
