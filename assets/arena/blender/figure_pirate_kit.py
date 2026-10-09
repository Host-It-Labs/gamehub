"""Shared constants for the sculpted Pirate (figure id `pirate`, 9 October 2026).

The Pirate is an Afro-Caribbean pirate woman of the golden age of sail
(card portrait assets/arena/cards/card-pirate-v7-b.png): black felt
tricorne over a cobalt bandana, one long braid, gold hoops, a high-collared
linen shirt with the sleeves rolled to the elbow, a long dark buttoned
waistcoat, a striped cobalt-and-cream sash with a flintlock, dark trousers,
tall black knee boots and a curved brass-hilted cutlass.

Blender +Y is forward, Z is up, metres. Anatomical landmarks live in
figure_pirate_body.py (pure numpy); this module adds the palette, rig
helpers and review poses. The previous blocky figure is preserved in
work/arena/2026-10-08-roster/pirate/before/.
"""
import math

import numpy as np
from mathutils import Quaternion, Vector

import kit
import figure_pirate_body as B

R = "pirate"
T = kit.tint


def V(*a):
    if len(a) == 1:
        return Vector(tuple(float(x) for x in a[0]))
    return Vector(a)


# ------------------------------------------------------------- palette
# Families are Arena's (materials.ts). team / team2 follow the side: the
# bandana and the sash's stripes are the bright team colour, the long
# waistcoat the dark one.

SKIN = "skin:" + T("pirate9-skin", "#6b3f2a")
LIP = "skin:" + T("pirate9-lip", "#4f2a25")
HAIR = "hair:" + T("pirate9-hair", "#17110f")
SHIRT = "weave:" + T("pirate9-linen", "#ece4d2")
TROUSERS = "weave:" + T("pirate9-trousers", "#3f3129")
BOOT = "hide:" + T("pirate9-boot", "#1d1817")
SOLE = "hide:" + T("pirate9-sole", "#33251d")
COAT = "weave:team2"
TEAM = "weave:team"
SASH_TEAM = "drape:team"
SASH_CREAM = "drape:" + T("pirate9-cream", "#e8dcc0")
BAND_CREAM = "weave:" + T("pirate9-cream", "#e8dcc0")
FELT = "felt:" + T("pirate9-felt", "#1b191e")
GOLD = "gilt:" + T("pirate9-gold", "#d9aa4c")
BRASS = "gilt:" + T("pirate9-brass", "#c4923e")
STEEL = "gilt:" + T("pirate9-steel", "#c9d1d8")
DARKSTEEL = "gilt:" + T("pirate9-gunmetal", "#5d6168")
GRIP = "hide:" + T("pirate9-grip", "#3a2418")
WOOD = "lacquer:" + T("pirate9-walnut", "#5a3320")
EYE = "resin:" + T("pirate9-eye", "#ebe3d6")
IRIS = "resin:" + T("pirate9-iris", "#3a2216")
PUPIL = "resin:" + T("pirate9-pupil", "#0d0909")
MOUTH = "resin:" + T("pirate9-mouth", "#3b1714")
TEETH = "resin:" + T("pirate9-teeth", "#efe8da")
TONGUE = "resin:" + T("pirate9-tongue", "#8a3a36")

GROUP_MATERIAL = {"skin": SKIN, "lip": LIP, "shirt": SHIRT, "trousers": TROUSERS,
                  "boot": BOOT, "sole": SOLE}

# ------------------------------------------------------------- landmarks

SIDES = B.SIDES
ANKLE = {s: V(B.ANKLE[s]) for s in (-1, 1)}
KNEE = {s: V(B.KNEE[s]) for s in (-1, 1)}
HIP = {s: V(B.HIP[s]) for s in (-1, 1)}
WAIST = V(B.WAIST)
CHEST = V(B.CHEST)
NECK = V(B.NECK)
CLAV = {s: V(B.CLAV[s]) for s in (-1, 1)}
SHOULDER = {s: V(B.SHOULDER[s]) for s in (-1, 1)}
ELBOW = {s: V(B.ELBOW[s]) for s in (-1, 1)}
WRIST = {s: V(B.WRIST[s]) for s in (-1, 1)}
FIST = V(B.FIST)
GRIP_DIR = V(B.GRIP_DIR)
HC = V(B.HC)

# Soft and prop joints.
HAT = V(0, -.012, 1.236)
BANDANA_KNOT = V(-.020, -.096, 1.172)
BRAID = [V(0, -.091, 1.098), V(0, -.105, .985), V(0, -.110, .875)]
SKIRT = {s: V(s * .085, .004, .714) for s in (-1, 1)}
SASH_KNOT = V(-.104, .036, .754)


def runtime_quat(rx, ry, rz):
    """A joint turned by the game, in Blender axes: three.js applies Euler
    XYZ in its y-up frame (three y = Blender z, three z = Blender -y)."""
    return (Quaternion((1, 0, 0), rx) @ Quaternion((0, 0, 1), ry) @
            Quaternion((0, 1, 0), -rz))


def pose_rig(rig, values):
    """Pose common-axis bones as the game would: {part: (x, y, z)}."""
    for b in rig.pose.bones:
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
    for name, angles in values.items():
        bone = rig.pose.bones.get(R + "." + name) or rig.pose.bones.get(R + name)
        if bone is None:
            continue
        frame = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = frame.inverted() @ runtime_quat(*angles) @ frame
    kit.refresh()


# Review poses in game terms (radians as the moves write them: arm x
# raises forward, arm z out (left negative), fore bends the elbow, knee
# negative bends the knee back).
POSES = {
    "neutral": {},
    "arm-forward-up": {"armR": (2.1, 0, 0.05), "foreR": (0.25, 0, 0),
                       "armL": (2.05, 0, -0.05), "foreL": (0.2, 0, 0)},
    "arm-out": {"armR": (0, 0, 1.75), "armL": (0, 0, -1.75)},
    "deep-bends": {"foreR": (2.4, 0, 0), "foreL": (2.4, 0, 0),
                   "armR": (0.5, 0, 0), "armL": (0.5, 0, 0),
                   "legL": (1.25, 0, 0), "kneeL": (-2.05, 0, 0),
                   "legR": (-0.35, 0, 0), "kneeR": (-0.6, 0, 0)},
    "slash-wind": {"armR": (0.75, -0.3, 1.45), "foreR": (1.5, 0, 0),
                   "weapon": (0.35, 0, 0), "torso": (0.04, -0.25, 0), "chest": (0, -0.2, 0),
                   "clavR": (0, 0.15, 0.2),
                   "head": (0.02, 0.3, 0), "armL": (0.45, 0, -0.45),
                   "foreL": (0.7, 0, 0)},
    "slash-cut": {"armR": (1.2, 0.35, -0.35), "foreR": (0.12, 0, 0),
                  "weapon": (-0.45, 0, 0), "torso": (-0.1, 0.25, 0), "chest": (-0.08, 0.2, 0),
                  "clavR": (0, -0.2, 0),
                  "head": (0.1, -0.3, 0), "armL": (-0.55, 0, -0.35),
                  "foreL": (0.5, 0, 0)},
    "walk": {"legL": (0.45, 0, 0), "kneeL": (-0.25, 0, 0),
             "legR": (-0.35, 0, 0), "kneeR": (-0.55, 0, 0),
             "armL": (-0.35, 0, -0.06), "armR": (0.3, 0, 0.06),
             "foreL": (0.25, 0, 0), "foreR": (0.45, 0, 0),
             "torso": (0, 0.1, 0), "skirtL": (0.3, 0, 0), "skirtR": (-0.2, 0, 0)},
}


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def np_coords(obj):
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def deg(x):
    return math.radians(x)
