"""The Knight: sturdy sword and board, full helm with a T visor and a plume."""

import math

import bmesh
import kit
from mathutils import Vector
from troopkit import ball, limb, part, shell, sword


def build(root_name="knight"):
    t = root_name
    root = kit.empty(t)
    # Legs and boots.
    for side, sx in (("L", -1), ("R", 1)):
        leg = limb(f"{t}-leg{side}", [(sx * 0.1, 0, 0.4), (sx * 0.11, 0.0, 0.14)],
                   0.075, 0.068, "metal:dark")
        boot = shell(f"{t}-boot{side}", [(0.0, 0.0), (0.085, 0.0), (0.09, 0.05),
                                         (0.08, 0.16), (0.07, 0.2), (0.0, 0.2)],
                     "leather:brown", segments=20, sy=1.35,
                     location=(sx * 0.11, 0.025, 0))
        part(t, f"leg{side}", [leg, boot], (sx * 0.1, 0, 0.4), root)
    torso_parts = [
        # Mail body.
        shell(f"{t}-body", [(0.0, 0.34), (0.17, 0.35), (0.2, 0.42), (0.215, 0.54),
                            (0.2, 0.66), (0.15, 0.73), (0.07, 0.77), (0.0, 0.78)],
              "metal:steel", sy=0.84),
        # Belt and buckle.
        shell(f"{t}-belt", [(0.212, 0.4), (0.225, 0.42), (0.225, 0.47),
                            (0.212, 0.49)], "leather:brown", sy=0.86, close=False),
        kit.box(f"{t}-buckle", (0.07, 0.03, 0.06), (0, 0.2, 0.445),
                mat="metal:gold", bevel=0.01),
    ]
    # Tabard: front and back panels of a flared shell.
    tabard = shell(f"{t}-tabard", [(0.205, 0.7), (0.222, 0.58), (0.235, 0.46),
                                   (0.255, 0.33), (0.265, 0.27)],
                   "cloth:team", sy=0.9, close=False)
    bm = bmesh.new()
    bm.from_mesh(tabard.data)
    kill = [f for f in bm.faces if abs(f.calc_center_median().x) > 0.13]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(tabard.data)
    bm.free()
    sol = tabard.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.018
    torso_parts.append(tabard)
    trim = kit.box(f"{t}-trim", (0.24, 0.03, 0.025), (0, 0.235, 0.29),
                   mat="metal:gold", bevel=0.008)
    torso_parts.append(trim)
    # Pauldrons.
    for sx in (-1, 1):
        p = shell(f"{t}-pauldron{sx}", [(0.0, 0.1), (0.07, 0.095), (0.11, 0.06),
                                        (0.125, 0.0), (0.12, -0.02)],
                  "metal:steel", segments=24, sy=1.0, close=False)
        sol = p.modifiers.new("solid", "SOLIDIFY")
        sol.thickness = 0.02
        p.location = (sx * 0.2, 0, 0.66)
        p.rotation_euler = (0, sx * 0.35, 0)
        torso_parts.append(p)
    torso = part(t, "torso", torso_parts, (0, 0, 0.4), root)
    # Helmet head with a T visor and a plume.
    head_parts = [
        shell(f"{t}-helm", [(0.0, 1.18), (0.1, 1.17), (0.19, 1.12), (0.245, 1.02),
                            (0.255, 0.92), (0.245, 0.82), (0.21, 0.75),
                            (0.14, 0.73), (0.0, 0.73)], "metal:steel", sy=0.96),
        kit.box(f"{t}-crest", (0.035, 0.44, 0.05), (0, -0.01, 1.165),
                mat="metal:gold", bevel=0.012),
        kit.box(f"{t}-slitH", (0.28, 0.1, 0.045), (0, 0.215, 0.95),
                mat="plain:black", bevel=0.01),
        kit.box(f"{t}-slitV", (0.05, 0.1, 0.15), (0, 0.225, 0.86),
                mat="plain:black", bevel=0.01),
        kit.box(f"{t}-browband", (0.4, 0.06, 0.03), (0, 0.19, 1.0),
                mat="metal:gold", bevel=0.01),
    ]
    plume = limb(f"{t}-plume", [(0, 0.02, 1.16), (0, -0.06, 1.3), (0, -0.2, 1.33),
                               (0, -0.3, 1.24)], 0.05, 0.02, "cloth:team")
    head_parts.append(plume)
    part(t, "head", head_parts, (0, 0, 0.74), torso)
    # Sword arm.
    arm_r = [limb(f"{t}-armR-limb", [(0.21, 0, 0.64), (0.29, 0.02, 0.52),
                                    (0.29, 0.12, 0.45)], 0.06, 0.05,
                  "metal:steel"),
             ball(f"{t}-gloveR", 0.058, (0.29, 0.14, 0.44), "leather:brown")]
    arm = part(t, "armR", arm_r, (0.21, 0, 0.64), torso)
    blade = sword(f"{t}-sword", 0.5, 0.075)
    for b in blade:
        b.location = Vector(b.location) + Vector((0.29, 0.14, 0.44))
    weapon = part(t, "weapon", blade, (0.29, 0.14, 0.44), arm)
    weapon.rotation_euler = (math.radians(-35), 0, 0)
    # Shield arm.
    arm_l = [limb(f"{t}-armL-limb", [(-0.21, 0, 0.64), (-0.29, 0.03, 0.52),
                                    (-0.27, 0.12, 0.46)], 0.06, 0.05,
                  "metal:steel"),
             ball(f"{t}-gloveL", 0.058, (-0.27, 0.14, 0.45), "leather:brown")]
    arm = part(t, "armL", arm_l, (-0.21, 0, 0.64), torso)
    shield = [
        shell(f"{t}-shield-face", [(0.0, 0.05), (0.12, 0.046), (0.2, 0.034),
                                   (0.235, 0.02), (0.235, 0.0), (0.0, 0.0)],
              "wood:brown", segments=32),
        shell(f"{t}-shield-rim", [(0.225, 0.0), (0.25, 0.012), (0.25, 0.03),
                                  (0.225, 0.04)], "metal:steel", segments=32,
              close=False),
        ball(f"{t}-shield-boss", 0.07, (0, 0, 0.045), "metal:steel",
             scale=(1, 1, 0.6)),
        shell(f"{t}-shield-band", [(0.13, 0.043), (0.16, 0.041), (0.16, 0.046),
                                   (0.13, 0.049)], "cloth:team", segments=32,
              close=False),
    ]
    for s in shield:
        s.rotation_euler = (-math.pi / 2, 0, 0)
        kit.apply_transform(s)
        s.location = (-0.31, 0.2, 0.47)
        s.rotation_euler = (0, 0, math.radians(-25))
    part(t, "offhand", shield, (-0.27, 0.14, 0.45), arm)
    return root
