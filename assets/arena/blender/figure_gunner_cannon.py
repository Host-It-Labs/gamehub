"""Gunner-only engineered field cannon; one root with its artilleryman.

Geometry is authored separately from the cloth. offhand carries the carriage;
extra pivots at the trunnions, wheels at the axle. The fixed original wheel
radius/push-bar coordinates match the motion draft and baseline footprint.
"""
import math

import numpy as np
from mathutils import Matrix

import kit
import figure_gunner_forms as f
from figure_gunner_forms import V, TAU
from figure_gunner_sculpt import AXLE, TRUNNION, BAR, WHEEL_R

WOOD = "beech:" + kit.tint("gunner-v1-oak", "#765032")
WOOD_LIGHT = "beech:" + kit.tint("gunner-v1-oak-edge", "#98704b")
WOOD_DARK = "beech:" + kit.tint("gunner-v1-oak-grain", "#523826")
BRONZE = "gilt:" + kit.tint("gunner-v1-bronze", "#b48445")
BRONZE_LIGHT = "gilt:" + kit.tint("gunner-v1-bronze-edge", "#d3a568")
PATINA = "gilt:" + kit.tint("gunner-v1-bronze-seam", "#725831")
IRON = "tin:" + kit.tint("gunner-v1-iron", "#464c52")
IRON_EDGE = "tin:" + kit.tint("gunner-v1-iron-edge", "#7c858c")
BORE = "resin:" + kit.tint("gunner-v1-bore", "#111419")
WICK = "weave:" + kit.tint("gunner-v1-linstock-wick", "#baa887")


def turned(name, centre, axis, rows, mat, target, n=56):
    axis = V(axis).normalized()
    cross = axis.orthogonal().normalized()
    other = axis.cross(cross).normalized()
    rings = [[centre + axis * t + (cross * math.cos(j / n * TAU) + other * math.sin(j / n * TAU)) * r
              for j in range(n)] for t, r in rows]
    return f.loft(name, rings, mat, target)


def wheel(s, rig):
    c = AXLE + V(s * .215, 0, 0); r = WHEEL_R
    # A sealed iron tyre profile, rounded only on the metal edges.
    tyre = [(-.018, r - .014), (-.018, r - .003), (-.012, r),
            (.012, r), (.018, r - .003), (.018, r - .014), (-.018, r - .014)]
    f.attach(turned("iron-tyre-" + str(s), c, (1, 0, 0), tyre, IRON, 420, n=64), rig, "wheels")
    felloe = [(-.016, r - .041), (-.016, r - .014), (.016, r - .014),
              (.016, r - .041), (-.016, r - .041)]
    f.attach(turned("wood-felloe-" + str(s), c, (1, 0, 0), felloe, WOOD, 320, n=64), rig, "wheels")
    hub = [(-.046, 0), (-.046, .024), (-.030, .035), (.023, .036),
           (.042, .027), (.050, .017), (.050, 0)]
    f.attach(turned("dished-wheel-hub-" + str(s), c, (s, 0, 0), hub, WOOD, 200, n=40), rig, "wheels")
    f.attach(turned("wheel-hub-iron-cap-" + str(s), c, (s, 0, 0),
                    [(.041, 0), (.041, .020), (.055, .020), (.064, .012), (.064, 0)], IRON_EDGE, 110, n=32), rig, "wheels")
    for j in range(12):
        a = j / 12 * TAU + .13; d = V(0, math.cos(a), math.sin(a))
        start = c + d * .028 - V(s * .004, 0, 0)
        end = c + d * (r - .035) + V(s * .004, 0, 0)
        # Rectangular spokes have a wider shoulder at the mortise and a
        # narrow neck at the felloe; they are dished, not radial noodles.
        p = [start, start + (end - start) * .16, start + (end - start) * .72, end]
        f.attach(f.tube("tapered-spoke-" + str(s) + str(j), p,
                         [(.010, .008), (.011, .008), (.008, .006), (.008, .006)], WOOD, 32, n=4, up=(1, 0, 0), caps=("flat", "flat")), rig, "wheels")
        seam = [c + d * (r - .041), c + d * (r - .015)]
        for outward in (-1, 1):
            path = [at + V(outward * .0165, 0, 0) for at in seam]
            f.attach(f.tube("felloe-joint-" + str(s) + str(j) + str(outward), path, [.0009] * 2, WOOD_DARK, 12, n=6, up=(1, 0, 0)), rig, "wheels")


def carriage(rig):
    outline = [(.365, .160), (.406, .134), (.534, .124), (.685, .143),
               (.733, .191), (.730, .292), (.665, .332), (.541, .332),
               (.446, .289), (.383, .237)]
    for s in (-1, 1):
        c = V(s * .102, 0, 0)
        frame = Matrix(((0, 0, 1, c.x - .018), (1, 0, 0, 0),
                        (0, 1, 0, 0), (0, 0, 0, 1)))
        cheek = f.plate("timber-carriage-cheek-" + str(s), outline, .036, WOOD, frame, 300, .004)
        f.attach(cheek, rig, "offhand")
        # Forged capsquare over the actual bearing and transverse straps.
        f.attach(f.box("capsquare-" + str(s), (.047, .058, .012), V(c.x, .600, .337), IRON, 70, .002), rig, "offhand")
        for j, (y, z) in enumerate(((.442, .230), (.688, .240))):
            f.attach(f.box("iron-carriage-strap-" + str(s) + str(j), (.040, .013, .117), V(c.x, y, z), IRON, 60, .0015), rig, "offhand")
            for height in (-.041, .041):
                f.attach(f.ball("strap-bolt-" + str(s) + str(j) + str(height), V(c.x + s * .021, y, z + height), (.0038, .0048, .0048), IRON_EDGE, 18, seg=12, rings=6), rig, "offhand")
        rail = f.smooth_path([V(c.x, .450, .261), V(s * .135, .400, .431),
                              V(s * .166, .359, .625), V(s * .173, .350, .643)], 7)
        f.attach(f.tube("shaped-push-rail-" + str(s), rail, [(.016, .018)] * len(rail), WOOD, 180, n=12, up=(1, 0, 0), caps=("flat", "flat")), rig, "offhand")
        for j in range(2):
            path = [V(c.x + s * .0188, y, .198 + j * .031 + .002 * math.sin(y * 19)) for y in np.linspace(.402, .700, 34)]
            f.attach(f.tube("longitudinal-oak-grain-" + str(s) + str(j), path, [.0007] * len(path), WOOD_DARK, 35, n=6, up=(1, 0, 0)), rig, "offhand")
    f.attach(f.tube("oak-axletree", [AXLE + V(-.206, 0, 0), AXLE + V(.206, 0, 0)],
                     [(.028, .030)] * 2, WOOD, 100, n=12, up=(0, 0, 1), caps=("flat", "flat")), rig, "offhand")
    f.attach(f.tube("iron-axle", [AXLE + V(-.274, 0, 0), AXLE + V(.274, 0, 0)],
                     [.012] * 2, IRON, 60, n=16, up=(0, 0, 1), caps=("flat", "flat")), rig, "offhand")
    f.attach(f.box("carriage-bed", (.171, .211, .029), V(0, .510, .207), WOOD, 90, .003), rig, "offhand")
    f.attach(f.box("rear-transom", (.170, .051, .049), V(0, .420, .196), WOOD, 75, .003), rig, "offhand")
    f.attach(f.tube("continuous-push-bar", [BAR + V(-.197, 0, 0), BAR + V(.197, 0, 0)],
                     [.016] * 2, WOOD_LIGHT, 120, n=32, up=(0, 0, 1)), rig, "offhand")
    for s in (-1, 1):
        f.attach(f.tube("push-bar-ferrule-" + str(s), [BAR + V(s * .181, 0, 0), BAR + V(s * .201, 0, 0)],
                         [.0185] * 2, IRON, 65, n=24, up=(0, 0, 1), caps=("flat", "flat")), rig, "offhand")
    for j, (x, y, z) in enumerate(((-.038, .435, .255), (.038, .435, .255), (0, .435, .309))):
        f.attach(f.ball("round-shot-" + str(j), V(x, y, z), (.034, .034, .034), IRON, 130, seg=32, rings=20), rig, "offhand")
    # A real, separate firing tool, safely cradled beside the gun. It never
    # intersects a supposed closed hand or becomes another figure root.
    a, b = V(.125, .440, .370), V(.125, .670, .345)
    f.attach(f.tube("stowed-linstock", [a, b], [.0065, .005], WOOD_DARK, 80, n=18, up=(1, 0, 0)), rig, "weapon")
    fork = [b + V(-.010, .002, -.004), b + V(0, .014, .015), b + V(.010, .002, -.004)]
    f.attach(f.tube("linstock-forged-fork", fork, [.0025] * 3, IRON, 45, n=12, up=(1, 0, 0)), rig, "weapon")
    f.attach(f.tube("linstock-slow-match", [b + V(-.009, .003, .003), b + V(0, .014, .010), b + V(.014, .018, -.003)],
                     [.003] * 3, WICK, 35, n=10, up=(1, 0, 0)), rig, "weapon")


def barrel(rig):
    # Closed outer wall into an actual inner bore, not a dark disk on a cap.
    rows = [(-.264, 0), (-.263, .013), (-.251, .021), (-.239, .017),
            (-.227, .017), (-.222, .034), (-.213, .058), (-.193, .072),
            (-.172, .075), (-.167, .080), (-.153, .080), (-.148, .074),
            (-.061, .071), (-.057, .076), (-.041, .076), (-.036, .068),
            (.100, .062), (.104, .067), (.117, .067), (.122, .058),
            (.251, .050), (.276, .056), (.300, .066), (.315, .068),
            (.325, .064), (.327, .039), (.319, .035), (.265, .034),
            (.191, .033), (.190, 0)]
    f.attach(turned("hollow-bronze-barrel", TRUNNION, (0, 1, 0), rows, BRONZE, 1700, n=80), rig, "extra")
    for j, (y, radius) in enumerate(((-.159, .0804), (-.049, .0764), (.109, .0674), (.315, .0683))):
        path = [TRUNNION + V(math.cos(a) * radius, y, math.sin(a) * radius) for a in np.linspace(0, TAU, 64, endpoint=False)]
        f.attach(f.ring("cast-bronze-highlight-" + str(j), path, .0012, BRONZE_LIGHT, 90, up=(0, 1, 0), n=8), rig, "extra")
    f.attach(f.tube("working-trunnions", [TRUNNION + V(-.117, 0, 0), TRUNNION + V(.117, 0, 0)],
                     [.021] * 2, BRONZE, 130, n=32, up=(0, 0, 1), caps=("flat", "flat")), rig, "extra")
    f.attach(f.ball("touch-hole-boss", TRUNNION + V(0, -.176, .077), (.013, .012, .005), PATINA, 70, seg=24, rings=12), rig, "extra")
    f.attach(f.ball("touch-hole", TRUNNION + V(0, -.176, .081), (.0035, .0035, .001), BORE, 25, seg=16, rings=8), rig, "extra")
    # Dark throat remains well inside the real bronze lip, not coplanar.
    f.attach(turned("bore-inner-shadow", TRUNNION, (0, 1, 0), [(.191, .032), (.207, .032)], BORE, 90, n=48), rig, "extra")


def build(rig):
    carriage(rig); barrel(rig)
    for s in (-1, 1):
        wheel(s, rig)


def materials():
    for name, roughness, metal in ((WOOD, .77, 0), (WOOD_LIGHT, .72, 0), (WOOD_DARK, .86, 0),
                                 (BRONZE, .34, .79), (BRONZE_LIGHT, .27, .85), (PATINA, .48, .69),
                                 (IRON, .44, .61), (IRON_EDGE, .35, .68), (BORE, .96, 0), (WICK, .93, 0)):
        bsdf = kit.material(name).node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metal
