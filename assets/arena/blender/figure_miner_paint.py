"""The Miner's painted finish: a per-corner pigment layer multiplied into the
baked AO (the figure's single COLOR_0 channel; no textures in the GLB).

Pigment is a function of the material and the point on the figure (rest
pose, Blender axes, figure units), so the detailed master and the reduced
runtime copy are painted identically without resampling. It carries what
the card portrait shows of a working miner: warm cheeks, nose and ears, a
dark shadow of stubble on the jaw and upper lip, dust smudged on the cheeks
and forearms; denim worn paler on the thighs and knees and dusty at the
hems; a dusty shirt; scuffed boot toes; a worn hat brim.
"""

import math

import numpy as np

LAYER = "MinerPigment"


def g3(P, c, r):
    d = (P - np.array(c)) / np.array(r)
    return np.exp(-(d ** 2).sum(axis=1))


def noise(P, f, seed=0.0):
    """Cheap smooth value noise from a sum of sines (deterministic)."""
    x, y, z = P[:, 0] * f, P[:, 1] * f, P[:, 2] * f
    return (np.sin(x * 1.7 + y * 2.3 + seed) * np.cos(y * 1.3 - z * 2.9 + seed * 0.7)
            + 0.5 * np.sin(z * 3.1 + x * 0.9 - seed) * np.cos(x * 2.7 + z * 1.1)) / 1.5


def skin(P):
    x, y, z = P.T
    ax = np.abs(x)
    rgb = np.ones((len(P), 3)) * 0.93
    # Warmth: ears, cheeks, nose tip, knuckles, elbows.
    heat = np.clip(g3(np.c_[ax, y, z], (0.088, -0.014, 1.118), (0.022, 0.030, 0.040)) * 0.9
                   + g3(np.c_[ax, y, z], (0.054, 0.072, 1.100), (0.020, 0.020, 0.020)) * 0.8
                   + g3(P, (0, 0.135, 1.098), (0.020, 0.016, 0.018)) * 0.7
                   + g3(np.c_[ax, y, z], (0.262, 0.040, 0.470), (0.035, 0.040, 0.035)) * 0.5, 0, 1)
    rgb[:, 0] += 0.06 * heat
    rgb[:, 1] -= 0.04 * heat
    rgb[:, 2] -= 0.06 * heat
    # Stubble: the jaw, chin and round the mouth, below the cheekbones.
    jaw = (z < 1.090 - 0.25 * np.maximum(0, y - 0.05)) & (z > 0.990) & (y > -0.010) & (ax < 0.085)
    stubble = jaw * (1 - np.clip((z - 1.070) / 0.025, 0, 1) * (ax > 0.040)) * 0.30
    stubble *= 0.8 + 0.2 * noise(P, 900.0, 1.0)
    rgb *= (1 - stubble[:, None] * np.array([0.95, 0.90, 0.80]))
    # Dust smudged on the cheeks, the brow and the forearms.
    dust = np.clip(noise(P, 55.0, 3.0) * 0.8 + 0.2, 0, 1) ** 2
    dust *= np.clip(g3(np.c_[ax, y, z], (0.060, 0.060, 1.110), (0.030, 0.040, 0.030))
                    + g3(np.c_[ax, y, z], (0.262, 0.000, 0.600), (0.050, 0.060, 0.090)) * 0.8, 0, 1)
    rgb = rgb * (1 - 0.30 * dust[:, None]) + 0.30 * dust[:, None] * np.array([0.86, 0.74, 0.60])
    return rgb


def shirt(P):
    rgb = np.ones((len(P), 3)) * 0.97
    dust = np.clip(noise(P, 40.0, 5.0) * 0.7 + 0.15, 0, 1) ** 2
    dust *= 0.6 + 0.4 * np.clip((0.95 - P[:, 2]) / 0.25, 0, 1)
    return rgb * (1 - 0.35 * dust[:, None]) + 0.35 * dust[:, None] * np.array([0.95, 0.85, 0.70])


def denim(P):
    x, y, z = P.T
    ax = np.abs(x)
    rgb = np.ones((len(P), 3)) * 0.86
    # Worn paler on the thighs' fronts and the knees.
    wear = (g3(np.c_[ax, y, z], (0.096, 0.085, 0.420), (0.050, 0.050, 0.080))
            + g3(np.c_[ax, y, z], (0.098, 0.090, 0.300), (0.045, 0.045, 0.035)) * 0.9)
    wear = np.clip(wear * (0.75 + 0.25 * noise(P, 120.0, 2.0)), 0, 1)
    rgb += 0.14 * wear[:, None] * np.array([1.0, 1.0, 0.95])
    # Dust at the hems and over the seat.
    dust = np.clip((0.300 - z) / 0.15, 0, 1) + 0.5 * g3(P, (0, -0.10, 0.55), (0.15, 0.06, 0.10))
    dust = np.clip(dust * (0.7 + 0.3 * noise(P, 70.0, 4.0)), 0, 1)
    rgb = rgb * (1 - 0.35 * dust[:, None]) + 0.35 * dust[:, None] * np.array([0.80, 0.70, 0.56])
    return np.clip(rgb, 0, 1)


def boot(P):
    y, z = P[:, 1], P[:, 2]
    rgb = np.ones((len(P), 3)) * 0.86
    # The thick dark sole and heel under the leather upper.
    sole = z < 0.028
    rgb[sole] *= np.array([0.40, 0.40, 0.42])
    scuff = np.clip((y - 0.06) / 0.08, 0, 1) * np.clip((0.07 - z) / 0.05 + 0.5, 0, 1) * ~sole
    rgb += 0.12 * scuff[:, None]
    dust = np.clip(noise(P, 90.0, 6.0) * 0.6 + 0.2, 0, 1) * np.clip((0.10 - z) / 0.08, 0, 1)
    rgb = rgb * (1 - 0.4 * dust[:, None]) + 0.4 * dust[:, None] * np.array([0.82, 0.72, 0.58])
    return np.clip(rgb, 0, 1)


def hat(P):
    rgb = np.ones((len(P), 3)) * 0.92
    rim = np.clip((np.hypot(P[:, 0], P[:, 1] + 0.010) - 0.105) / 0.03, 0, 1)
    wear = np.clip(noise(P, 160.0, 7.0) * 0.5 + 0.5, 0, 1) * rim
    rgb += 0.08 * wear[:, None]
    dust = np.clip(noise(P, 60.0, 8.0) * 0.6, 0, 1)
    return rgb * (1 - 0.25 * dust[:, None]) + 0.25 * dust[:, None] * np.array([0.90, 0.80, 0.66])


def wood(P):
    rgb = np.ones((len(P), 3)) * 0.92
    grime = np.clip(noise(P, 140.0, 9.0) * 0.5 + 0.3, 0, 1)
    return rgb * (1 - 0.2 * grime[:, None])


PAINTS = {"skin": skin, "shirt": shirt, "denim": denim, "boot": boot, "hat": hat, "wood": wood}


def paint_kind(material_name):
    family, _, tint = material_name.partition(":")
    if family == "skin":
        return "skin"
    if tint == "team":
        return "shirt"
    if tint in ("miner-denim", "miner-stitch"):
        return "denim"
    if tint in ("miner-boot", "miner-sole"):
        return "boot"
    if tint in ("miner-hat", "miner-hatband"):
        return "hat"
    if family == "wood":
        return "wood"
    return None


def paint(obj, to_root):
    """Write the pigment layer (per corner, linear RGB) of one mesh object.
    to_root: a 4x4 numpy matrix taking the object's coordinates to the
    figure's rest frame."""
    me = obj.data
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    P = co.reshape(-1, 3) @ to_root[:3, :3].T + to_root[:3, 3]
    loops = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get("vertex_index", loops)
    starts = np.empty(len(me.polygons), dtype=np.int32)
    totals = np.empty(len(me.polygons), dtype=np.int32)
    mats = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("loop_start", starts)
    me.polygons.foreach_get("loop_total", totals)
    me.polygons.foreach_get("material_index", mats)
    corner_mat = np.repeat(mats, totals)
    rgba = np.ones((len(me.loops), 4), dtype=np.float32)
    for mi, m in enumerate(me.materials):
        kind = paint_kind(m.name) if m else None
        sel = np.flatnonzero(corner_mat == mi)
        if kind is None or not len(sel):
            continue
        rgba[sel, :3] = np.clip(PAINTS[kind](P[loops[sel]]), 0, 1)
    layer = me.color_attributes.get(LAYER) or me.color_attributes.new(LAYER, "FLOAT_COLOR", "CORNER")
    layer.data.foreach_set("color", rgba.reshape(-1))
    return layer


def combine(obj):
    """AO *= pigment; then keep the AO layer alone for export."""
    me = obj.data
    pig = me.color_attributes.get(LAYER)
    ao = me.color_attributes.get("AO")
    if pig is not None and ao is not None and len(pig.data) == len(ao.data):
        a = np.empty(len(ao.data) * 4, dtype=np.float32)
        p = np.empty(len(pig.data) * 4, dtype=np.float32)
        ao.data.foreach_get("color", a)
        pig.data.foreach_get("color", p)
        a = a.reshape(-1, 4)
        a[:, :3] *= p.reshape(-1, 4)[:, :3]
        ao.data.foreach_set("color", np.clip(a, 0, 1).reshape(-1))
    for layer in list(me.color_attributes):
        if layer.name != "AO":
            me.color_attributes.remove(layer)
    ao = me.color_attributes.get("AO")
    if ao is not None:
        me.color_attributes.active_color = ao
        me.color_attributes.render_color_index = 0
