"""Fresh Sumo sculpt and separately reviewed runtime artist source.

Rejected rigid sources are preserved under work/arena/2026-10-04-rebuild/sumo.
Normal builds append the frozen neutral runtime copy, add the upper spine and
shoulder girdle (figure_sumo_girdle.py, 9 October 2026), then the ordinary
collector bakes AO and combines its retained tissue pigment. build_master()
retains the detailed editable anatomy and connected named skin skeleton.
"""
from figure_sumo_sculpt import build_master
from figure_sumo_girdle import add_girdle, lift_inner_thigh_ao
from figure_sumo_runtime import finish_ao as combine_pigment, load_reviewed_copy


def build(root_name="sumo"):
    return add_girdle(load_reviewed_copy(root_name))


def finish_ao(root):
    lift_inner_thigh_ao(root)
    combine_pigment(root)
