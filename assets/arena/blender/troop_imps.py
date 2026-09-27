"""The Robots card (id `imps`): one tin wind-up robot per model, three per
card.

A 1950s tinplate wind-up robot about 0.7 m tall: a boxy team-coloured tin
body with bevelled edges and a lithographed cream control panel (two dials
and three lamps), rivets and folded tabs on its seam, a chrome waist band,
a square head with round glowing eyes, a mouth grille, ear bolts and an
antenna, hinged tin arms ending in chrome pincers, stubby legs on flat
square feet, and a big chrome wind-up key on its back (`spin`, turning about
+y through the key's axle).
"""

import math

import kit
from mathutils import Vector
from tin_kit import (CHROME, X, Y, Z, block, cassini, circle, disc, dome,
                     oval_tube, part, plate, rivet, rod, turned)

TIN = "tin:team"
DARK = "tin:team2"
PANEL = "tin:" + kit.tint("imps-cream", "#fbe7b4")
INK = "tin:" + kit.tint("imps-ink", "#23262e")
EYE = "glow:" + kit.tint("imps-eye", "#ffb81c")
LAMP_R = "glow:" + kit.tint("imps-red", "#ff3b2e")
LAMP_A = "glow:" + kit.tint("imps-amber", "#ffa21f")
LAMP_G = "glow:" + kit.tint("imps-green", "#4fee74")

# Body box: z 0.2 to 0.45, x +-0.145, y +-0.1.
BODY_Z0, BODY_Z1 = 0.2, 0.45
BODY_W, BODY_D = 0.29, 0.2
FRONT = BODY_D / 2
HIP = (0.068, 0.0, 0.19)
SHOULDER = (0.145, 0.0, 0.395)
NECK = (0.0, 0.0, 0.45)
KEY = (0.0, -FRONT, 0.33)
HEAD_Z0, HEAD_Z1 = 0.48, 0.63
HEAD_W, HEAD_D = 0.22, 0.17
HEAD_Y = 0.005


def leg(t, sx):
    x = sx * HIP[0]
    return [
        block(f"{t}-foot{sx}", (0.118, 0.165, 0.045), (x, 0.02, 0.0225), DARK,
              bevel=0.013, seg=1),
        # Stubby legs flaring a little toward the feet, with a chrome band
        # low on the shin.
        block(f"{t}-shin{sx}", (0.086, 0.094, 0.165), (x, 0.0, 0.12), TIN,
              bevel=0.013, seg=1, taper=(0.88, 0.9)),
        block(f"{t}-knee{sx}", (0.087, 0.095, 0.012), (x, 0.0, 0.1), CHROME,
              bevel=0),
    ]


def torso(t):
    zc = (BODY_Z0 + BODY_Z1) / 2
    out = [
        block(f"{t}-body", (BODY_W, BODY_D, BODY_Z1 - BODY_Z0), (0, 0, zc),
              TIN, bevel=0.024, seg=1),
        block(f"{t}-waist", (BODY_W + 0.014, BODY_D + 0.014, 0.03),
              (0, 0, BODY_Z0 + 0.004), CHROME, bevel=0.009, seg=1),
        # The neck collar the head turns in.
        turned(f"{t}-collar", [(0.066, -0.004), (0.066, 0.01), (0.056, 0.02),
                               (0.0, 0.02)], (0, 0, BODY_Z1), Z, CHROME,
               segments=8, close=False),
    ]
    # The lithographed control panel: cream plate, two dials, three lamps.
    py = FRONT + 0.004
    pz = 0.335
    out.append(block(f"{t}-panel", (0.19, 0.014, 0.135), (0, py, pz), PANEL,
                     bevel=0.005, seg=1))
    face = py + 0.007
    for k, dx in enumerate((-0.048, 0.048)):
        at = Vector((dx, face, pz + 0.028))
        out.append(turned(f"{t}-dial{k}", [(0.019, 0.008), (0.029, 0.006),
                                           (0.029, -0.002)], at, Y, CHROME,
                          segments=10, close=False))
        out.append(turned(f"{t}-dialface{k}", [(0.02, 0.0045), (0.0, 0.0045)],
                          at, Y, INK, segments=10, close=False))
        needle = block(f"{t}-needle{k}", (0.004, 0.003, 0.021),
                       at + Vector((0, 0.006, 0.004)), PANEL, bevel=0)
        needle.rotation_euler = (0, math.radians(35 if k else -30), 0)
        out.append(needle)
    for k, (dx, mat) in enumerate(((-0.05, LAMP_R), (0.0, LAMP_A),
                                   (0.05, LAMP_G))):
        at = Vector((dx, face - 0.002, pz - 0.034))
        out.append(dome(f"{t}-lamp{k}", 0.014, 0.011, at, Y, mat, segments=8,
                        rings=2))
    for sxz in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        out.append(rivet(f"{t}-prv{sxz}",
                         (sxz[0] * 0.083, face, pz + sxz[1] * 0.056), Y,
                         0.0065))
    # The seam where the two tin halves meet over the shoulders, held by
    # folded tabs.
    out.append(block(f"{t}-seam", (BODY_W - 0.036, 0.012, 0.008),
                     (0, 0, BODY_Z1 + 0.002), DARK, bevel=0))
    for sx in (-1, 1):
        out.append(block(f"{t}-tab{sx}", (0.022, 0.026, 0.012),
                         (sx * 0.1, 0, BODY_Z1 + 0.004), CHROME, bevel=0))
    # A battery hatch and the key's washer on the back.
    out.append(block(f"{t}-hatch", (0.15, 0.008, 0.14),
                     (0, -FRONT - 0.002, 0.325), DARK, bevel=0))
    return out


def head(t):
    zc = (HEAD_Z0 + HEAD_Z1) / 2
    front = HEAD_Y + HEAD_D / 2
    out = [
        turned(f"{t}-neck", [(0.04, -0.03), (0.04, 0.02)],
               (0, 0, HEAD_Z0 - 0.01), Z, CHROME, segments=10, close=False),
        block(f"{t}-skull", (HEAD_W, HEAD_D, HEAD_Z1 - HEAD_Z0),
              (0, HEAD_Y, zc), TIN, bevel=0.024, seg=1),
    ]
    # Round glowing eyes in chrome bezels.
    for sx in (-1, 1):
        at = Vector((sx * 0.052, front, zc + 0.02))
        out.append(turned(f"{t}-eyering{sx}", [(0.026, 0.011), (0.036, 0.008),
                                               (0.036, -0.002)], at, Y,
                          CHROME, segments=14, close=False))
        out.append(dome(f"{t}-eye{sx}", 0.027, 0.013, at + Y * 0.003, Y, EYE,
                        segments=14, rings=2))
    # Mouth grille: chrome bars over a dark slot.
    mz = zc - 0.04
    out.append(block(f"{t}-mouth", (0.106, 0.008, 0.036), (0, front, mz), INK,
                     bevel=0))
    for k in range(3):
        z = mz - 0.0105 + k * 0.0105
        out.append(rod(f"{t}-bar{k}", (-0.05, front + 0.004, z),
                       (0.05, front + 0.004, z), 0.0036, segments=6,
                       cap=False))
    # Ear bolts.
    for sx in (-1, 1):
        at = Vector((sx * (HEAD_W / 2 + 0.006), HEAD_Y, zc + 0.006))
        out.append(disc(f"{t}-ear{sx}", 0.038, 0.016, at, X * sx, CHROME,
                        segments=14))
        out.append(turned(f"{t}-earpin{sx}", [(0.013, 0), (0.0, 0.026)],
                          at + X * sx * 0.007, X * sx, CHROME, segments=8,
                          close=False))
    # Antenna with a glowing tip.
    top = HEAD_Z1
    out.append(disc(f"{t}-antbase", 0.024, 0.012, (0, HEAD_Y, top + 0.003),
                    Z, CHROME, segments=8))
    out.append(rod(f"{t}-antenna", (0, HEAD_Y, top), (0, HEAD_Y, top + 0.07),
                   0.0085, segments=6, cap=False))
    out.append(kit.sphere(f"{t}-anttip", 0.022, (0, HEAD_Y, top + 0.087),
                          mat=LAMP_R, segments=12, rings=6))
    return out


def arm(t, sx):
    s = Vector((sx * SHOULDER[0], SHOULDER[1], SHOULDER[2]))
    top = s + X * sx * 0.036
    elbow = Vector((sx * 0.2, 0.005, 0.29))
    wrist = Vector((sx * 0.205, 0.1, 0.268))
    fore = (wrist - elbow).length
    out = [
        # A domed tin shoulder cap over the joint, on a chrome washer.
        disc(f"{t}-shoulder{sx}", 0.047, 0.012, s + X * sx * 0.006, X * sx,
             CHROME, segments=12),
        turned(f"{t}-shcap{sx}", [(0.04, 0.0), (0.041, 0.016), (0.03, 0.031),
                                  (0.0, 0.035)], s + X * sx * 0.012, X * sx,
               TIN, segments=10, close=False),
        turned(f"{t}-upper{sx}", [(0.031, 0), (0.031, (elbow - top).length)],
               top, elbow - top, TIN, segments=8, close=False),
        turned(f"{t}-fore{sx}", [(0.03, 0), (0.037, fore - 0.006),
                                 (0.031, fore)],
               elbow, wrist - elbow, TIN, segments=8, close=False),
        disc(f"{t}-elbow{sx}", 0.036, 0.074, elbow, X, CHROME, segments=12),
    ]
    # A chrome palm and a pincer that opens sideways.
    d = (wrist - elbow).normalized()
    flat = Vector((d.x, d.y, 0)).normalized()
    side = Z.cross(flat)
    palm = wrist + d * 0.012
    out.append(block(f"{t}-palm{sx}", (0.074, 0.036, 0.046), palm, CHROME,
                     bevel=0.009, seg=1))
    # Pincers a size up from the real toy's, so they read as weapons.
    base = palm + flat * 0.012
    k = 1.25
    for j, sgn in enumerate((-1, 1)):
        pts = [base + (flat * u + side * sgn * v) * k
               for u, v in ((0.0, 0.021), (0.03, 0.037), (0.06, 0.028),
                            (0.078, 0.004))]
        out.append(oval_tube(f"{t}-jaw{sx}{j}", pts,
                             [w * k for w in (0.02, 0.019, 0.014, 0.008)],
                             [h * k for h in (0.028, 0.027, 0.023, 0.014)],
                             CHROME, segments=6))
    return out, s


def key(t):
    k = Vector(KEY)
    out = [
        rod(f"{t}-axle", k, k - Y * 0.064, 0.011, segments=8, cap=False),
        disc(f"{t}-hub", 0.022, 0.022, k - Y * 0.05, -Y, CHROME, segments=10),
    ]
    # The bow: a die-cut chrome butterfly with two round holes.
    s = 0.08
    outline = [(x * s, y * s) for x, y in cassini(1.0, 1.1, 22)]
    holes = [list(reversed(circle(sx * 1.02 * s, 0, 0.3 * s, 8)))
             for sx in (-1, 1)]
    out.append(plate(f"{t}-bow", outline, 0.017, CHROME, holes=holes,
                     at=k - Y * 0.076, axis=-Y, up=Z, bevel=0.005, seg=1,
                     rim_only=True))
    return out


def build(root_name="imps"):
    t = root_name
    root = kit.empty(t)
    for side, sx in (("L", -1), ("R", 1)):
        part(t, f"leg{side}", leg(t, sx), (sx * HIP[0], HIP[1], HIP[2]), root)
    body = part(t, "torso", torso(t), (0, 0, 0.2), root)
    part(t, "head", head(t), NECK, body)
    for side, sx in (("L", -1), ("R", 1)):
        pieces, pivot = arm(t, sx)
        part(t, f"arm{side}", pieces, pivot, body)
    part(t, "spin", key(t), KEY, body)
    return root
