"""The Cowboy: reviewed runtime copy and preserved detailed source.

Native scale, tailored duster, rifle hold and named pivots are retained. See
figure_ranger_sculpt.py for the editable anatomical and cloth source, and
figure_ranger_runtime.py for its independent measured reduction.
"""
import os
from figure_ranger_sculpt import build_master, finish_ao
from figure_ranger_runtime import build_runtime


def build(root_name='ranger'):
    assert root_name == 'ranger'
    if (os.environ.get('ARENA_SOURCE_MASTER') == '1' or
            os.environ.get('RANGER_MASTER') == '1'):
        return build_master()
    return build_runtime()
