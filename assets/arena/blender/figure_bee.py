"""The bee (figure id `bee`): the Beekeeper's swarm, a spawned flyer with
no card. A round cartoon bumblebee in hand-painted resin, kept tiny and
cheap (a few hundred triangles) since a swarm puts many on the field: a
yellow body with dark bands and one team band, a dark head with two
antennae, a stinger, and two pale wings.

Parts (figures.py has the contract), none with a rest rotation:

  bee             root under the body, facing +y
    torso         pivot at the body's centre
      wingL/R     pivots on the wing roots (turn about y to beat)
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V

R = "bee"
T = kit.tint

YELLOW = "resin:" + T("bee-yellow", "#ffd23c")
DARK = fk.DARK
WING = "lacquer:" + T("bee-wing", "#e6f4fb")
C = V(0, 0, 0.16)


def body():
    P = []
    # The abdomen in bands: yellow, dark, team, dark, yellow tip.
    prof = [(-0.15, 0.0), (-0.135, 0.045), (-0.11, 0.07), (-0.07, 0.085),
            (-0.03, 0.088), (0.01, 0.082), (0.04, 0.07)]
    bands = {1: DARK, 3: fk.TEAM, 4: DARK}
    rings = [[C + V(math.cos(i / 10 * math.tau) * r * 1.05, y,
                    math.sin(i / 10 * math.tau) * r) for i in range(10)]
             for y, r in prof[1:]]
    P.append(fk.loft(f"{R}-abdomen", rings, YELLOW,
                     bands=lambda i, j: bands.get(j),
                     start=C + V(0, -0.155, 0), end=C + V(0, 0.05, 0)))
    P.append(fk.tube(f"{R}-sting", [C + V(0, -0.15, 0), C + V(0, -0.19,
                                                              -0.01)],
                     [0.012, 0.002], DARK, n=5, caps=(None, None)))
    # The fuzzy thorax and the dark head.
    P.append(fk.ball(f"{R}-thorax", 0.068, C + V(0, 0.07, 0.005), YELLOW,
                     seg=10, rings=6))
    head = C + V(0, 0.14, 0.0)
    P.append(fk.ball(f"{R}-head", 0.05, head, DARK, seg=10, rings=6))
    for sx in (-1, 1):
        P.append(fk.ball(f"{R}-eye{sx}", 0.016, head + V(sx * 0.028, 0.034,
                                                          0.012),
                         fk.IVORY, seg=6, rings=4))
        eye = head + V(sx * 0.028, 0.047, 0.013)
        P.append(fk.ball(f"{R}-pupil{sx}", 0.008, eye, DARK,
                         scale=(1, 0.5, 1), seg=6, rings=4))
        P.append(fk.ball(f"{R}-glint{sx}", 0.003, eye + V(-0.002, 0.004, 0.003),
                         fk.IVORY, seg=5, rings=3))
        P.append(fk.tube(f"{R}-antenna{sx}", [head + V(sx * 0.015, 0.02,
                                                       0.04),
                                              head + V(sx * 0.03, 0.05,
                                                       0.09)],
                         [0.005, 0.004], DARK, n=4, caps=(None, "dome")))
    return P


def wing(sx):
    root = C + V(sx * 0.03, 0.06, 0.06)
    outline = [(math.cos(i / 12 * math.tau) * 0.09,
                math.sin(i / 12 * math.tau) * 0.05) for i in range(12)]
    m = fk.basis(V(sx, 0, 0.0), V(0, 1, 0), V(0, 0, sx),
                 root + V(sx * 0.085, -0.02, 0.02))
    w = fk.slab(f"{R}-wing{sx}", outline, 0.006, WING, matrix=m)
    return [w], root


def part(name, pieces, pivot, par, angle=40):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="bee"):
    assert root_name == R
    root = kit.empty(R)
    pieces = body()
    sting = fk.take_parts(pieces, f"{R}-sting")
    antenna = fk.take_parts(pieces, f"{R}-antenna")
    head = fk.take_parts(pieces, f"{R}-head", f"{R}-eye", f"{R}-pupil",
                          f"{R}-glint")
    torso = part("torso", pieces, C, root)
    head_obj = fk.face_head(R, head, C + V(0, 0.09, 0), torso)
    part("antenna", antenna, C + V(0, 0.16, 0.04), head_obj)
    part("tail", sting, C + V(0, -0.15, 0), torso)
    for side, sx in (("L", -1), ("R", 1)):
        pieces, at = wing(sx)
        part(f"wing{side}", pieces, at, torso)
    fk.report(root, R)
    return root
