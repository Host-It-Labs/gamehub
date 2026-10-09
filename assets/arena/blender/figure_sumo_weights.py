"""Reviewed local shoulder ownership on the fixed neutral Sumo surface.

The former hard appendage cutoff made a hanging armpit sheet at a full
inward guard. A small geodesic control surface carries the smoothly edited
ownership field to either the detailed master or the runtime copy. It changes
only shoulder/armpit weights, without moving vertices, pivots or distal joints.
"""
from pathlib import Path

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

FIELD = Path(__file__).resolve().parent / "runtime" / "sumo-shoulder-weights-v1.npz"


def shoulder_zone(points):
    x = np.abs(points[:, 0]) / 1.22
    z = points[:, 2] / 1.22
    def smooth(lo, hi, value):
        t = np.clip((value - lo) / (hi - lo), 0, 1)
        return t * t * (3 - 2 * t)
    return smooth(.735, .785, z) * (1 - smooth(1.00, 1.055, z)) * \
        smooth(.19, .23, x) * (1 - smooth(.365, .42, x))


def repair_shoulder_weights(obj):
    if not FIELD.is_file():
        raise RuntimeError("Missing authored Sumo shoulder ownership field")
    field = np.load(FIELD)
    points, faces, shares = field["points"], field["triangles"], field["armShare"]
    tree = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    coords = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
    obj.data.vertices.foreach_get("co", coords)
    coords = coords.reshape(-1, 3)
    zone = shoulder_zone(coords)
    active = np.flatnonzero(zone > 1e-6)
    prefix = "sumo." if obj.vertex_groups.get("sumo.torso") else "sumo"
    group_ids = {g.name: g.index for g in obj.vertex_groups}
    buckets = {}
    changed = 0
    maximum = 0
    for index in active:
        vertex = obj.data.vertices[int(index)]
        existing = {g.group: g.weight for g in vertex.groups}
        side = "L" if coords[index, 0] < 0 else "R"
        names = [prefix + stem + side for stem in ("arm", "fore")] + [prefix + "torso"]
        old = [existing.get(group_ids[name], 0) for name in names]
        old_share = old[0] + old[1]
        untouched = sum(w for g, w in existing.items() if g not in [group_ids[name] for name in names])
        available = max(0, 1 - untouched)
        point, _, face_index, distance = tree.find_nearest(Vector(coords[index]))
        assert distance < .008, "Shoulder field must stay on the authored neutral surface"
        a, b, c = faces[face_index]
        share = barycentric_transform(point, Vector(points[a]), Vector(points[b]), Vector(points[c]),
                                      Vector((shares[a], 0, 0)), Vector((shares[b], 0, 0)),
                                      Vector((shares[c], 0, 0))).x
        share = min(available, max(0, share))
        fore = share * old[1] / old_share if old_share > 1e-7 else 0
        new = [share - fore, fore, available - share]
        difference = max(abs(a - b) for a, b in zip(old, new))
        if difference < 1e-7:
            continue
        maximum = max(maximum, difference)
        changed += 1
        for name, value in zip(names, new):
            q = int(round(value * 1000000))
            buckets.setdefault((name, q), []).append(int(index))
    for (name, q), indices in buckets.items():
        group = obj.vertex_groups[name]
        if q:
            group.add(indices, q / 1000000, "REPLACE")
        else:
            group.remove(indices)
    obj["shoulderOwnershipField"] = FIELD.name
    return {"field": FIELD.name, "changedVertices": changed,
            "maximumWeightChange": maximum, "neutralPositionsChanged": False,
            "handFootWeightsChanged": False, "boneFramesChanged": False}
