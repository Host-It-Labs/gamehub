"""The Beekeeper (figure id `beekeeper`) as a collector's miniature: a
1920s countryside beekeeper in hand-painted resin, who walks with a hive on
her back and lets out bees.

A wide cream hat with a dark veil hanging round the sides and back (her
face open at the front), a cream smock jacket with patch pockets, a long
team-colour skirt in two halves over brown boots, cream leather gauntlets;
a white wooden hive of two honey-coloured boxes under a gabled roof
strapped to her back, its entrance slot dark; in her right hand a tin
smoker with leather bellows and a spout.

Parts (figures.py has the contract), none with a rest rotation:

  beekeeper       root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: smock, skirt lining, straps
      skirtL/R    the skirt halves, hung from the waist to trail the legs
      head        pivot at the neck: hat and veil
      extra       the hive, pivot between the shoulder blades
      armR        the upper arm
        foreR     elbow, forearm and gauntlet
          weapon  the smoker, pivot in the fist
      armL        the whole left arm

BEEKEEPER_POSE=<name> turns the parts as the game would before the
previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, gauss, lerp, smooth
from mathutils import Matrix

R = "beekeeper"
T = kit.tint

SKIN = fk.SKINS["fair"]
HAIR = fk.HAIRS["blond"]
SMOCK = fk.CREAM
SKIRT = fk.TEAM
GLOVE = "hide:" + T("beekeeper-glove", "#e2cfa4")
VEIL = "weave:" + T("beekeeper-veil", "#626a5f")
HIVE = "lacquer:" + T("beekeeper-hive", "#e9b04a")
ROOF = fk.WHITE
TIN = fk.STEEL

HIP_X, HIP_Z = 0.082, 0.61
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.155, 0.952
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.018)
UPPER, FORE = 0.235, 0.21

BODY = [(0.6, 0.118, 0.094, 0.098), (0.66, 0.118, 0.09, 0.09),
        (0.72, 0.126, 0.094, 0.088), (0.79, 0.138, 0.106, 0.09),
        (0.85, 0.147, 0.11, 0.094), (0.9, 0.152, 0.102, 0.097),
        (0.935, 0.148, 0.093, 0.094), (0.96, 0.13, 0.08, 0.082),
        (0.985, 0.092, 0.064, 0.064), (1.006, 0.05, 0.047, 0.047)]
BODY_P = 2.3
SKIRT_ROWS = [(0.24, 0.2, 0.17, 0.18), (0.36, 0.188, 0.155, 0.165),
              (0.48, 0.17, 0.138, 0.146), (0.58, 0.152, 0.12, 0.126),
              (0.66, 0.128, 0.098, 0.1), (0.7, 0.124, 0.094, 0.094)]
HEM = 0.24


def body_point(a, z, extra=0.0):
    p = fk.ring_point(BODY, BODY_P, a, z, extra)
    ad = math.degrees(a)
    ad = ad - 360 if ad > 180 else ad
    p.y += 0.016 * gauss(z, 0.83, 0.04) * (gauss(ad, 24, 17) +
                                           gauss(ad, -24, 17))
    return p


def skirt_point(a, z, extra=0.0):
    fold = 0.007 * smooth(0.62, HEM, z) * math.sin(9 * a + 0.4)
    return fk.ring_point(SKIRT_ROWS, 2.2, a, z, extra + fold)


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-stocking{sx}", [hip + V(0, 0, 0.04), knee,
                                       V(ankle.x, ankle.y, 0.16)],
                 [0.06, 0.05, 0.042], fk.TEAM2, n=10)]
    P += fk.shoe(f"{R}-boot", sx, ankle, 9, fk.LEATHER, sole=fk.DARK)
    top = V(ankle.x, ankle.y, 0)
    P.append(fk.limb(f"{R}-shaft{sx}", [top + V(0, -0.005, 0.05),
                                        top + V(0, 0, 0.2)],
                     [0.046, 0.051], fk.LEATHER, n=12, caps=(None, "flat")))
    return P, hip


def skirt_half(sx):
    a0, a1 = (-10.0, 192.0) if sx > 0 else (-24.0, 186.0)
    zs = [0.7, 0.66, 0.6, 0.52, 0.44, 0.36, 0.3, HEM]
    us = [i / 16 for i in range(17)]
    lift = 0.004 if sx > 0 else 0.0

    def fn(u, v):
        z = zs[int(round(v))]
        return skirt_point(math.radians(lerp(a0, a1, u)) * sx, z, lift)
    return [fk.sheet(f"{R}-skirt{sx}", fn, us, list(range(len(zs))), SKIRT,
                     rim=0.005, back=True, inside=V(sx * 0.03, 0, 0.5))]


def inner_skirt():
    n = 24
    rings = [[skirt_point(i / n * math.tau, z, -0.008) for i in range(n)]
             for z in (0.7, 0.62, 0.54, 0.46)]
    return fk.loft(f"{R}-innerskirt", rings, SKIRT)


# ------------------------------------------------------------- torso

def smock():
    n = 22
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-smock", rings, SMOCK, start="pole", end="pole")]
    # The smock's skirt flares over the top of the skirt.
    rings = [[skirt_point(i / n * math.tau, z, 0.012) for i in range(n)]
             for z in (0.7, 0.64, 0.58)]
    P.append(fk.loft(f"{R}-peplum", rings, SMOCK))
    # Patch pockets and a tie belt.
    for sx in (-1, 1):
        def pocket(u, v, sx=sx):
            return skirt_point(math.radians(sx * lerp(18, 44, u)),
                               lerp(0.67, 0.6, v), 0.016)
        P.append(fk.sheet(f"{R}-pocket{sx}", pocket, [0, 0.5, 1],
                          [0, 0.5, 1], SMOCK, rim=0.004,
                          inside=V(0, 0, 0.62)))
    belt = [[body_point(i / n * math.tau, z, 0.005) for i in range(n)]
            for z in (0.69, 0.705, 0.72)]
    P.append(fk.loft(f"{R}-tie", belt, fk.TEAM2))
    # Hive straps over the shoulders.
    for sx in (-1, 1):
        pts = [body_point(math.radians(sx * 30), 0.78, 0.006),
               body_point(math.radians(sx * 38), 0.9, 0.006),
               V(sx * 0.1, -0.01, 0.99),
               body_point(math.radians(sx * 150), 0.92, 0.006)]
        pts = kit.smooth_path(pts, samples=3)
        P.append(fk.tube(f"{R}-strap{sx}", pts, [(0.004, 0.013)] * len(pts),
                         fk.LEATHER, n=4, up=V(0, 0, 1),
                         caps=("flat", "flat")))
    return P


def hive():
    """Two honey boxes under a gabled white roof, an entrance slot, hand
    holds, all strapped high on her back."""
    P = []
    c = V(0, -0.175, 0.9)
    for k, (z, h) in enumerate(((c.z - 0.1, 0.12), (c.z + 0.025, 0.12))):
        P.append(fk.rbox(f"{R}-box{k}", (0.24, 0.17, h - 0.008),
                         V(c.x, c.y, z), HIVE, levels=1, crease=0.85))
        P.append(fk.rbox(f"{R}-hold{k}", (0.07, 0.01, 0.022),
                         V(c.x, c.y - 0.088, z + 0.02), fk.DARK, levels=1,
                         crease=0.8))
    # The landing board and its dark entrance slot.
    P.append(fk.rbox(f"{R}-board", (0.2, 0.03, 0.012),
                     V(c.x, c.y - 0.095, c.z - 0.158), ROOF, levels=1,
                     crease=0.8))
    P.append(fk.rbox(f"{R}-slot", (0.13, 0.01, 0.018),
                     V(c.x, c.y - 0.086, c.z - 0.142), fk.DARK, levels=1,
                     crease=0.9))
    # The gabled roof: a prism along x.
    top = c.z + 0.088
    prof = [(-0.11, top), (-0.11, top + 0.014), (0.0, top + 0.075),
            (0.11, top + 0.014), (0.11, top)]
    rings = [[V(x, c.y + y, z) for y, z in prof] for x in (-0.15, 0.15)]
    P.append(fk.loft(f"{R}-roof", rings, ROOF, start="flat", end="flat"))
    return P


# ------------------------------------------------------------- head

H = fk.head_of(R, "f")


def hairline(a):
    return fk.table([(0, 1.21), (30, 1.204), (60, 1.17), (80, 1.15),
                     (100, 1.16), (130, 1.1), (180, 1.08)], abs(a))


def hat():
    """A wide cream hat and the veil round its brim, open at the front."""
    P = []
    n = 28
    c = V(0, H.cy - 0.005, 1.225)
    prof = [(0.17, -0.012), (0.175, 0.0), (0.12, 0.008), (0.085, 0.012),
            (0.082, 0.06), (0.07, 0.085), (0.0, 0.092)]
    rings = []
    for r, dz in prof:
        rings.append([c + V(math.sin(i / n * math.tau) * r,
                            math.cos(i / n * math.tau) * r * 1.02, dz)
                      for i in range(n)])
    P.append(fk.loft(f"{R}-hat", rings[:-1], SMOCK, end=rings[-1][0]))
    under = [[c + V(math.sin(i / n * math.tau) * r,
                    math.cos(i / n * math.tau) * r * 1.02, -0.016)
              for i in range(n)] for r in (0.168, 0.09)]
    P.append(fk.loft(f"{R}-hatunder", under, SMOCK))
    band = [[c + V(math.sin(i / n * math.tau) * 0.0855,
                   math.cos(i / n * math.tau) * 0.0855 * 1.02, dz)
             for i in range(n)] for dz in (0.012, 0.03)]
    P.append(fk.loft(f"{R}-hatband", band, fk.TEAM2))

    # The veil: from the brim down to the shoulders round the sides and
    # back, its front edge pinned back.
    def veil(u, v):
        a = math.radians(lerp(70, 290, u))
        r = lerp(0.158, 0.108, v) + 0.009 * math.sin(a * 8) * v
        z = lerp(1.212, 1.05 + 0.03 * max(0.0, math.cos(a)), v)
        return c + V(math.sin(a) * r, math.cos(a) * r * 1.02 - 0.01 * v,
                     z - c.z)
    P.append(fk.sheet(f"{R}-veil", veil, [i / 16 for i in range(17)],
                      [0, 0.25, 0.5, 0.75, 1], VEIL, rim=0.003, back=True,
                      inside=c + V(0, 0, -0.1)))
    return P


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P.append(fk.hair_shell(H, f"{R}-hair", HAIR, hairline, th=0.012))
    P += fk.eyes(H, frown=0.007)
    P += fk.mouth(H, kind="firm")
    P += H.ears(SKIN)
    P += hat()
    P.append(fk.neck(R, SKIN, r=0.04))
    return P


# ------------------------------------------------------------- arms

E_R = S_R + V(0.04, 0.03, -1).normalized() * UPPER
C_R = E_R + V(0.0, 0.85, 0.32).normalized() * (FORE + 0.04)
E_L = S_L + V(-0.06, 0.0, -1).normalized() * UPPER
C_L = E_L + V(-0.05, 0.35, -0.94).normalized() * (FORE + 0.04)


def arm_pieces(side, s, e, c):
    w = c - (c - e).normalized() * 0.04
    up = (e - s).normalized()
    upper = [fk.ball(f"{R}-shoulder{side}", 1.0, s + V(0, 0, -0.018), SMOCK,
                     scale=(0.05, 0.052, 0.045), seg=10, rings=6),
             fk.limb(f"{R}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5),
                                           e],
                     [0.049, 0.047, 0.043], SMOCK, n=12)]
    lower = [fk.ball(f"{R}-elbow{side}", 0.043, e, SMOCK, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.4)],
                     [0.042, 0.04], SMOCK, n=12),
             fk.limb(f"{R}-gauntlet{side}", [lerp(e, w, 0.35),
                                             w + (w - e).normalized() * 0.01],
                     [0.05, 0.036], GLOVE, n=12, caps=("flat", None))]
    return upper, lower


def arm_r():
    upper, lower = arm_pieces("R", S_R, E_R, C_R)
    lower += fk.hand(f"{R}-handR", C_R, C_R - E_R, V(0.1, 0.0, 1), -1, GLOVE,
                     scale=1.05)
    return upper, lower


def arm_l():
    upper, lower = arm_pieces("L", S_L, E_L, C_L)
    lower += fk.hand(f"{R}-handL", C_L, C_L - E_L, V(1, 0.2, 0), 1, GLOVE,
                     scale=1.05)
    return upper, lower


def smoker():
    """A tin smoker held up by its can: the can, a conical lid and spout
    pointing forward, leather bellows on its back side."""
    P = []
    c = C_R + V(0, 0.0, 0.07)
    P.append(fk.tube(f"{R}-can", [c - V(0, 0, 0.075), c + V(0, 0, 0.05)],
                     [0.042, 0.042], TIN, n=14, caps=("flat", None)))
    P.append(fk.tube(f"{R}-lid", [c + V(0, 0, 0.05), c + V(0, 0.01, 0.09),
                                  c + V(0, 0.04, 0.115)],
                     [0.044, 0.028, 0.012], TIN, n=14,
                     caps=(None, "flat")))
    P.append(fk.tube(f"{R}-cband", [c - V(0, 0, 0.03), c - V(0, 0, 0.015)],
                     [0.045, 0.045], fk.BRASS, n=14, caps=(None, None)))
    # Bellows on the back of the can.
    b = c + V(0.0, -0.075, -0.01)
    P.append(fk.rbox(f"{R}-bellows", (0.05, 0.045, 0.09), b, fk.LEATHER,
                     levels=2, crease=0.4))
    P.append(fk.rbox(f"{R}-board", (0.055, 0.008, 0.1), b + V(0, -0.026, 0),
                     fk.DARK, levels=1, crease=0.8))
    return P


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="beekeeper"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.088, 0.016, 0.36)
        ankle = V(sx * 0.097, 0.02, 0.085)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    torso = part("torso", smock() + [inner_skirt()], WAIST, root)
    part("skirtL", skirt_half(-1), V(0, 0, 0.66), torso)
    part("skirtR", skirt_half(1), V(0, 0, 0.66), torso)
    pieces = head()
    veil = fk.take_parts(pieces, f"{R}-veil")
    hat_parts = fk.take_parts(pieces, f"{R}-hat")
    head_obj = fk.face_head(R, pieces, NECK, torso)
    hat_obj = part("hat", hat_parts, V(0, H.cy - 0.005, 1.225), head_obj)
    part("cape", veil, V(0, H.cy - 0.005, 1.212), hat_obj)
    part("extra", hive(), V(0, -0.1, 0.9), torso)
    upper, lower = arm_r()
    hand = fk.take_parts(lower, f"{R}-handR-")
    a = part("armR", upper, S_R, torso)
    f = part("foreR", lower, E_R, a)
    h = part("handR", hand, C_R - (C_R - E_R).normalized() * 0.04, f)
    pieces = smoker()
    board = fk.take_parts(pieces, f"{R}-board")
    smoke = part("weapon", pieces, C_R, h, angle=40)
    part("extra2", board, C_R + V(0, -0.101, 0.01), smoke)
    upper, lower = arm_l()
    hand = fk.take_parts(lower, f"{R}-handL-")
    a = part("armL", upper, S_L, torso)
    f = part("foreL", lower, E_L, a)
    part("handL", hand, C_L - (C_L - E_L).normalized() * 0.04, f)
    return fk.finish(root, R, POSES)


POSES = {
    "puff": {"armR": (0.9, 0, 0.1), "foreR": (-0.5, 0, 0),
             "weapon": (-0.3, 0, 0), "armL": (0.9, 0, -0.3),
             "torso": (-0.06, 0.2, 0)},
    "walk": {"legL": (0.4, 0, 0), "kneeL": (-0.2, 0, 0),
             "legR": (-0.3, 0, 0), "skirtL": (0.26, 0, 0),
             "skirtR": (-0.2, 0, 0), "armL": (-0.3, 0, 0)},
}
