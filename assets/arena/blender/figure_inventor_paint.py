"""The Inventor's painted finish: a per-corner pigment layer multiplied into
the baked AO (the figure's single COLOR_0 channel; no textures in the GLB).

Pigment is a function of the material and the point on the figure (rest
pose, Blender axes, figure units), so the detailed master and the reduced
runtime copy are painted identically. It carries what the portrait shows:
warm cheeks, nose and ears on deep brown skin, darker full lips; a clean
white cotton coat greyed a little at the cuffs and hem; the cobalt
coverall worn paler at the knees and dusty at the hems; gauntlets darker
at the fingertips; scuffed boot toes and dark soles; brass and copper
with darker tarnish; brown lights in the black curls.
"""

import numpy as np

LAYER = "InventorPigment"


def g3(P, c, r):
    d = (P - np.array(c)) / np.array(r)
    return np.exp(-(d ** 2).sum(axis=1))


def noise(P, f, seed=0.0):
    x, y, z = P[:, 0] * f, P[:, 1] * f, P[:, 2] * f
    return (np.sin(x * 1.7 + y * 2.3 + seed) * np.cos(y * 1.3 - z * 2.9 + seed * 0.7)
            + 0.5 * np.sin(z * 3.1 + x * 0.9 - seed) * np.cos(x * 2.7 + z * 1.1)) / 1.5


HEAD_K = 1.10
HEAD_PIVOT = np.array([0.0, -0.012, 1.008])


def skin(P):
    # The face's marks are placed in the unscaled head's frame.
    P = np.where(P[:, 2:3] > 0.985, HEAD_PIVOT + (P - HEAD_PIVOT) / HEAD_K, P)
    x, y, z = P.T
    ax = np.abs(x)
    A = np.c_[ax, y, z]
    rgb = np.ones((len(P), 3)) * 0.95
    heat = np.clip(g3(A, (0.073, -0.016, 1.120), (0.014, 0.020, 0.026)) * 0.8
                   + g3(A, (0.046, 0.066, 1.100), (0.018, 0.016, 0.016)) * 0.75
                   + g3(P, (0, 0.110, 1.095), (0.016, 0.012, 0.012)) * 0.6, 0, 1)
    rgb[:, 0] += 0.07 * heat
    rgb[:, 1] -= 0.03 * heat
    rgb[:, 2] -= 0.05 * heat
    # Full lips, a deeper rose-brown.
    lips = np.clip(g3(P, (0, 0.092, 1.0705), (0.020, 0.012, 0.0055)) * 1.3
                   + g3(P, (0, 0.091, 1.0585), (0.019, 0.012, 0.0065)) * 1.3, 0, 1)
    rgb *= 1 - lips[:, None] * np.array([0.22, 0.34, 0.32])
    # A soft sheen of highlight down the nose and on the cheekbones.
    lite = np.clip(g3(P, (0, 0.096, 1.118), (0.006, 0.010, 0.016)) + g3(A, (0.052, 0.064, 1.114),
                                                                        (0.012, 0.010, 0.008)), 0, 1)
    rgb += 0.05 * lite[:, None]
    # Darker under the brows and round the eyes (the liner's smudge).
    socket = np.clip(g3(A, (0.031, 0.082, 1.140), (0.018, 0.012, 0.006)) * 0.7, 0, 1)
    rgb *= 1 - 0.18 * socket[:, None]
    return np.clip(rgb, 0, 1)


def coat(P):
    x, y, z = P.T
    rgb = np.ones((len(P), 3)) * 0.97
    grime = np.clip(noise(P, 45.0, 2.0) * 0.6 + 0.2, 0, 1) ** 2
    grime *= 0.35 + 0.65 * np.clip((0.50 - z) / 0.08, 0, 1) + 0.5 * (np.abs(x) > 0.16)
    rgb = rgb * (1 - 0.18 * grime[:, None]) + 0.18 * grime[:, None] * np.array([0.88, 0.85, 0.80])
    # A scorch smudge of the work on the right cuff.
    scorch = g3(P, (0.205, 0.040, 0.560), (0.025, 0.025, 0.030)) * 0.0
    return np.clip(rgb - scorch[:, None] * 0.3, 0, 1)


def cover(P):
    x, y, z = P.T
    ax = np.abs(x)
    rgb = np.ones((len(P), 3)) * 0.92
    wear = (g3(np.c_[ax, y, z], (0.078, 0.070, 0.330), (0.040, 0.040, 0.035))
            + g3(np.c_[ax, y, z], (0.080, 0.066, 0.450), (0.045, 0.040, 0.070)) * 0.5)
    wear = np.clip(wear * (0.75 + 0.25 * noise(P, 120.0, 2.0)), 0, 1)
    rgb += 0.10 * wear[:, None]
    dust = np.clip((0.230 - z) / 0.10, 0, 1)
    dust = np.clip(dust * (0.7 + 0.3 * noise(P, 70.0, 4.0)), 0, 1)
    rgb = rgb * (1 - 0.25 * dust[:, None]) + 0.25 * dust[:, None] * np.array([0.80, 0.74, 0.64])
    return np.clip(rgb, 0, 1)


def glove(P):
    x, y, z = P.T
    rgb = np.ones((len(P), 3)) * 0.96
    tips = np.clip((0.525 - z) / 0.05, 0, 1) * (np.abs(x) > 0.15)
    rgb *= 1 - 0.12 * tips[:, None]
    return rgb


def boot(P):
    y, z = P[:, 1], P[:, 2]
    rgb = np.ones((len(P), 3)) * 0.90
    sole = z < 0.0225
    rgb[sole] *= np.array([0.55, 0.52, 0.50])
    scuff = np.clip((y - 0.05) / 0.07, 0, 1) * np.clip((0.06 - z) / 0.04 + 0.5, 0, 1) * ~sole
    rgb += 0.12 * scuff[:, None]
    return np.clip(rgb, 0, 1)


def hair(P):
    rgb = np.ones((len(P), 3)) * 0.92
    lite = np.clip(noise(P, 260.0, 5.0) * 0.6 + 0.1, 0, 1) * np.clip((P[:, 2] - 1.20) / 0.08, 0, 1)
    rgb = rgb + lite[:, None] * np.array([0.30, 0.18, 0.10])
    return np.clip(rgb, 0, 1.4)


def metal(P):
    rgb = np.ones((len(P), 3)) * 0.95
    tarnish = np.clip(noise(P, 210.0, 6.0) * 0.5 + 0.2, 0, 1)
    return rgb * (1 - 0.18 * tarnish[:, None])


def leather(P):
    rgb = np.ones((len(P), 3)) * 0.93
    wear = np.clip(noise(P, 150.0, 8.0) * 0.5 + 0.4, 0, 1)
    return np.clip(rgb + 0.08 * wear[:, None] - 0.04, 0, 1)


PAINTS = {"skin": skin, "coat": coat, "cover": cover, "glove": glove, "boot": boot, "hair": hair,
          "metal": metal, "leather": leather}


def paint_kind(material_name):
    family, _, tint = material_name.partition(":")
    if family == "skin":
        return "skin"
    if tint == "inventor-coat":
        return "coat"
    if family == "weave" and tint == "team":
        return "cover"
    if family == "rubber" and tint == "team":
        return "glove"
    if tint == "inventor-leather-dark" or (family == "hide" and tint == "inventor-leather"):
        return "leather"
    if family == "hair":
        return "hair"
    if family == "gilt":
        return "metal"
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
    totals = np.empty(len(me.polygons), dtype=np.int32)
    mats = np.empty(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("loop_total", totals)
    me.polygons.foreach_get("material_index", mats)
    corner_mat = np.repeat(mats, totals)
    rgba = np.ones((len(me.loops), 4), dtype=np.float32)
    boots = "boot" in obj.name or "sole" in obj.name or "heel" in obj.name
    for mi, m in enumerate(me.materials):
        kind = paint_kind(m.name) if m else None
        if boots and kind in ("leather",):
            kind = "boot"
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
