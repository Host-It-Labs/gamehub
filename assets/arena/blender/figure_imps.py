"""Robots: append the frozen copy after the root's runtime visual review.

One canonical clockwork robot is deployed three times by the existing card.
Detailed source and staged review live in figure_imps_sculpt/review.py.
"""
from figure_imps_runtime import load_reviewed_copy


def build(root_name="imps"):
    return load_reviewed_copy(root_name)
