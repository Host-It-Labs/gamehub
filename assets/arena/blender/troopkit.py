"""Shared building blocks for Arena's troops (see troops.py for the contract).

Every helper returns plain mesh objects in world space; `part()` joins pieces
into one jointed part, sets its origin on the joint and parents it.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from mathutils import Vector  # noqa: E402


def limb(name, pts, r0, r1, mat, samples=6, segments=14):
    path = kit.smooth_path(pts, samples)
    return kit.tube(name, path, 1.0, mat=mat, segments=segments,
                    taper=lambda t: r0 + (r1 - r0) * t)


def shell(name, profile, mat, segments=32, sy=1.0, location=(0, 0, 0),
          close=True):
    obj = kit.lathe(name, profile, segments=segments, mat=mat, close=close)
    obj.scale = (1, sy, 1)
    obj.location = location
    kit.apply_transform(obj)
    return obj


def ball(name, r, at, mat, scale=(1, 1, 1), seg=24):
    return kit.sphere(name, r, at, scale=scale, mat=mat, segments=seg,
                      rings=seg // 2)


def finish(objs, angle=50):
    for o in objs:
        kit.apply(o)
        kit.apply_transform(o)
        kit.uv_box(o, small=True)
    return objs


def part(troop, name, objs, pivot, par):
    """Join pieces into one jointed part with its origin at `pivot`."""
    finish(objs)
    obj = kit.join(objs, f"{troop}.{name}")
    kit.shade(obj, 55)
    kit.set_pivot(obj, pivot)
    kit.parent(obj, par)
    return obj


def eye(name, at, r=0.035, look=(0, 1, 0)):
    white = ball(name + "-white", r, at, "plain:white", seg=16)
    pupil = ball(name + "-pupil", r * 0.62,
                 Vector(at) + Vector(look) * r * 0.62, "plain:black", seg=12)
    glint = ball(name + "-glint", r * 0.2,
                 Vector(at) + Vector(look) * r * 1.05 + Vector((0.3, 0, 0.35)) * r,
                 "plain:white", seg=8)
    return [white, pupil, glint]


def sword(name, length=0.5, width=0.07):
    import bmesh
    bm = bmesh.new()
    # A diamond-section blade that tapers to a point.
    rings = [(0.0, width / 2, 0.012), (length * 0.85, width / 2 * 0.92, 0.01),
             (length, 0.0, 0.0)]
    prev = None
    for z, w, t in rings:
        ring = [bm.verts.new(v) for v in ((w, 0, z), (0, t, z), (-w, 0, z),
                                          (0, -t, z))]
        if prev:
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
        else:
            bm.faces.new(list(reversed(ring)))
        prev = ring
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    blade = kit._from_bmesh(name + "-blade", bm, "metal:steel")
    guard = kit.box(name + "-guard", (width * 2.6, 0.05, 0.035), (0, 0, -0.01),
                    mat="metal:gold", bevel=0.01)
    grip = kit.cylinder(name + "-grip", 0.018, 0.018, 0.12, (0, 0, -0.13),
                        verts=10, mat="leather:brown")
    pommel = ball(name + "-pommel", 0.028, (0, 0, -0.14), "metal:gold", seg=12)
    return [blade, guard, grip, pommel]
