"""The Pirate's detailed editable master (9 October 2026).

build_master() evaluates the signed-distance body (figure_pirate_body.py),
polygonises it, assigns materials, builds the common-axis rig, weights the
connected skin, and dresses and arms her (figure_pirate_dress.py). The body
polygonisation is cached by the hash of its sources
(work/arena/2026-10-08-roster/pirate/cache/). The master keeps the full
voxel resolution (PIRATE_VOXEL, metres); the runtime copy is reduced
separately (figure_pirate_runtime.py).
"""
import hashlib
import os
import time
from pathlib import Path

import bpy
import numpy as np

import kit
import figure_pirate_sdf as S
import figure_pirate_body as B
import figure_pirate_kit as pk
from figure_pirate_kit import R

HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[2] / "work" / "arena" / "2026-10-08-roster" / "pirate" / "cache"
T0 = time.time()


def log(msg):
    print(f"PIRATE [{time.time() - T0:7.1f}s] {msg}", flush=True)


def source_hash(*names, extra=""):
    h = hashlib.sha1(extra.encode())
    for n in names:
        h.update((HERE / n).read_bytes())
    return h.hexdigest()[:12]


def body_arrays(h=None):
    h = h or float(os.environ.get("PIRATE_VOXEL", ".0016"))
    key = source_hash("figure_pirate_body.py", "figure_pirate_sdf.py", extra=f"{h:.5f}")
    path = CACHE / f"body-{key}.npz"
    if path.exists():
        log(f"body from cache {path.name}")
        return dict(np.load(path))
    CACHE.mkdir(parents=True, exist_ok=True)
    arrays = B.build_arrays(h, log)
    np.savez_compressed(path, **arrays)
    for old in CACHE.glob("body-*.npz"):
        if old != path:
            old.unlink()
    return arrays


def body_object():
    a = body_arrays()
    obj = S.mesh_from_arrays(R + ".skin", a["points"], a["quads"], a["tris"])
    me = obj.data
    names = []
    for g in B.GROUPS:
        m = pk.GROUP_MATERIAL[g]
        if m not in names:
            names.append(m)
    for m in names:
        me.materials.append(kit.material(m))
    groups = a["groups"].copy()
    # The torso below the sash is trousers, the arms' and legs' own.
    centres = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("center", centres)
    centres = centres.reshape(-1, 3)
    shirt, trousers = B.GROUPS.index("shirt"), B.GROUPS.index("trousers")
    low = (groups == shirt) & (centres[:, 2] < .728) & (np.abs(centres[:, 0]) < .19)
    groups[low] = trousers
    # The band collar: below its top plane the neck's surface is linen,
    # above it skin (nearest-surface labels flicker in the blend between).
    skin = B.GROUPS.index("skin")
    x, y, z = centres.T
    neck = (np.hypot(x, (y + .012)) < .056) & (z > .99) & (z < 1.07)
    below = (z - 1.045) - .08 * (y + .010) < 0
    groups[neck & below & (groups == skin)] = shirt
    groups[neck & ~below & (groups == shirt)] = skin
    index = np.array([names.index(pk.GROUP_MATERIAL[g]) for g in B.GROUPS])[groups]
    me.polygons.foreach_set("material_index", index.astype(np.int32))
    part = me.attributes.new("pirate_part", "INT8", "POINT")
    part.data.foreach_set("value", a["parts"].astype(np.int8))
    me.update()
    log(f"body: {len(me.vertices)} vertices, {len(me.polygons)} faces")
    return obj


def build_head_only():
    """The head region at a finer voxel with its face controls, for face
    review (not cached)."""
    h = float(os.environ.get("PIRATE_HEAD_VOXEL", ".0009"))
    a = B.build_arrays(h, log, region="head")
    root = kit.empty(R)
    obj = S.mesh_from_arrays(R + ".head-skin", a["points"], a["quads"], a["tris"])
    me = obj.data
    names = []
    for g in B.GROUPS:
        m = pk.GROUP_MATERIAL[g]
        if m not in names:
            names.append(m)
    for m in names:
        me.materials.append(kit.material(m))
    index = np.array([names.index(pk.GROUP_MATERIAL[g]) for g in B.GROUPS])[a["groups"]]
    me.polygons.foreach_set("material_index", index.astype(np.int32))
    obj.parent = root
    import figure_pirate_face as face
    for o in face.controls():
        o.parent = root
    extra = os.environ.get("PIRATE_HEAD_EXTRA")
    if extra:
        import figure_pirate_dress as dress
        for o in dress.head_wear():
            o.parent = root
    kit.fill_ao([o for o in kit.descendants(root) if o.type == "MESH"])
    return root


def build_body_only():
    root = kit.empty(R)
    obj = body_object()
    obj.parent = root
    kit.fill_ao([obj])
    return root


def build_master():
    import figure_pirate_dress as dress
    return dress.assemble(body_object, log)
