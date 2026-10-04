"""The Robots card (id `imps`) as a collector's miniature: one 1950s
atomic-age wind-up tin robot per model, three per card.

A boxy enamelled tin torso in the team colour, broad at the shoulders,
with bevelled edges, rows of rivets and folded tabs down its side seams;
a cream control panel in a chrome frame on the chest, with two dials, a
toggle and three amber lamps; a chrome waist band over dark tin hips; a
square head under a heavy lid, with a chrome visor slot holding two round
glowing amber eyes, a mouth grille, ear bolts and a chrome antenna; hinged
tin arms on shoulder drums, ending in chrome pincers; short legs on
gunmetal bellows and chrome knee hinges, on flat square chrome feet; a big
chrome wind-up key on its back.

Part contract (figures.py / troops.py): the root empty `imps` at the feet
facing +y; `imps.legL/R` pivot at the hip drums (the bellows thigh), with
`kneeL/R` on the chrome knee hinge (shin and ankle band) and `footL/R` on
the ankle (the flat chrome foot); built here, so articulation.py leaves
them alone. `imps.torso` at the waist carries the head (neck), both arms
(shoulder drums), the key and the gauge needle (`extra2`, pivot on the
gauge's hub, turning about the chest's normal). The head carries the
springy antenna (`antenna`, pivot at its base) and the angry eyelids
(`extra`, both lids on one hinge along x through the eyes: a turn about x
drops them for a blink). Each arm carries its forearm (`foreL/R` on the
elbow hinge) and the claw's lower jaw (`handL/R`, hinged about x on
the claw's pin; the upper jaw is fixed to the forearm). `imps.spin` is the
wind-up key, its pivot on the axle, which runs along Blender y out of the
back, so a turn about the troop's forward axis spins it (three.js local z,
as the game drives it). IMPS_POSE=attack poses the figure (right jab, legs
apart, key a quarter turn) before the previews, to check clearances.

3 October 2026: lithographed side panels, a single big gauge as on the
card, angry hooded eyes with pupils, a 10% larger head, a larger key,
chunky C claws that open and snap, a coiled antenna with a big ball, and
larger feet.
"""

import math
import os

import kit
import face_rig
import figure_imps_kit as ik
from mathutils import Matrix
from figure_imps_kit import V, X, Y, Z

R = "imps"
T = kit.tint

# ------------------------------------------------------------- paints

TEAM = "lacquer:team"
TEAM2 = "lacquer:team2"
CHROME = "gilt:" + T("robot-chrome", "#d3d8df")
GUN = "gilt:" + T("robot-gunmetal", "#4a4e57")
CREAM = "lacquer:" + T("robot-cream", "#e3d3a6")
INK = "resin:" + T("robot-ink", "#17181c")
AMBER = "glow:" + T("robot-amber", "#ff7f11")

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.072, 0.235
WAIST = V(0, 0, 0.28)
SH_X, SH_Z = 0.168, 0.482
NECK = V(0, 0, 0.53)

# The chest: a box from z CH0 to CH1, CHW x CHD at the bottom, broadening
# toward the shoulders.
CH0, CH1 = 0.312, 0.522
CHW, CHD = 0.245, 0.18
TAPER_X, TAPER_Y = 1.2, 1.06
BEV = 0.02


def cf(z):
    return (z - CH0) / (CH1 - CH0)


def half_w(z):
    return CHW / 2 * (1 + (TAPER_X - 1) * cf(z))


def half_d(z):
    return CHD / 2 * (1 + (TAPER_Y - 1) * cf(z))


# Face normals of the chest's tilted sides.
NF = V(0, 1, -CHD / 2 * (TAPER_Y - 1) / (CH1 - CH0)).normalized()
NB = V(0, -1, NF.z)
NS = V(1, 0, -CHW / 2 * (TAPER_X - 1) / (CH1 - CH0)).normalized()


def front(x, z, lift=0.0):
    return V(x, half_d(z), z) + NF * lift


def back(x, z, lift=0.0):
    return V(x, -half_d(z), z) + NB * lift


def side(sx, y, z, lift=0.0):
    n = V(sx * NS.x, 0, NS.z)
    return V(sx * half_w(z), y, z) + n * lift


KEY_Z = 0.425
HATCH = 0.006
KEY = V(0, -half_d(KEY_Z) - HATCH, KEY_Z)
RIV = 0.0052
KEY_SCALE = 1.3


# ------------------------------------------------------------- legs

KNEE_Z, ANKLE_Z = 0.163, 0.046


def leg(sx):
    """Three pieces: the bellows thigh, the shin from the knee hinge to the
    ankle band, and the flat foot."""
    x = sx * HIP_X
    t = f"{R}-leg{sx}"
    thigh = [
        ik.disc(f"{t}-hip", 0.03, 0.058, (x, 0, HIP_Z), X, CHROME,
                segments=12, chamfer=0.006, both=True),
        # Gunmetal bellows over the thigh.
        ik.sq_lathe(f"{t}-bellows",
                    [(0.222, 0.026, 0.028), (0.214, 0.034, 0.036),
                     (0.205, 0.026, 0.028), (0.196, 0.034, 0.036),
                     (0.187, 0.026, 0.028), (0.178, 0.034, 0.036),
                     (0.169, 0.027, 0.029)],
                    GUN, n=12, power=3.0, cx=x),
    ]
    shin = [
        ik.disc(f"{t}-knee", 0.022, 0.088, (x, 0, KNEE_Z), X, CHROME,
                segments=12, chamfer=0.004, both=True),
        ik.block(f"{t}-kneeplate", (0.05, 0.016, 0.04), (x, 0.043, 0.156),
                 TEAM, bevel=0.006, seg=1),
        ik.rivet(f"{t}-kneeriv", (x, 0.051, 0.156), Y, 0.0055, CHROME),
    ]
    for k in (-1, 1):
        shin.append(ik.rivet(f"{t}-kneebolt{k}",
                             (x + k * 0.044, 0, KNEE_Z), X * k, 0.0075,
                             CHROME))
    # The shin: a boxy tin boot flaring toward the foot, its top rounded
    # under the knee hinge so it can swing.
    z0, h = 0.05, 0.104
    shin.append(ik.block(f"{t}-shin", (0.084, 0.092, h), (x, 0, z0 + h / 2),
                         TEAM, bevel=0.014, seg=2, taper=(0.86, 0.88),
                         cuts=1))

    # Its front face leans back as it rises.
    def shin_front(dx, z, lift=0.0):
        f = (z - z0) / h
        return V(x + dx, 0.046 * (1 - 0.12 * f) + lift, z)
    for k, z in enumerate((0.08, 0.091, 0.102)):
        shin.append(ik.obox(f"{t}-vent{k}", shin_front(0, z, 0.0006), X,
                            V(0, 1, -0.05), (0.04, 0.0042, 0.003), INK))
    for dx, z in ((-0.026, 0.064), (0.026, 0.064), (-0.024, 0.126),
                  (0.024, 0.126)):
        shin.append(ik.rivet(f"{t}-shinriv", shin_front(dx, z), Y, 0.0045,
                             CHROME))
    # A lithographed stripe round the boot's top (printed, not a part).
    shin.append(ik.obox(f"{t}-litho", shin_front(0, 0.138, 0.0005), X,
                        V(0, 1, -0.05), (0.066, 0.006, 0.0016), TEAM2))
    for k in (-1, 1):
        shin.append(ik.obox(f"{t}-lithoside{k}",
                            V(x + k * 0.0402, 0, 0.098), Y,
                            V(k, 0, 0.058), (0.056, 0.046, 0.0016), TEAM2))
    # A chrome ankle band.
    shin.append(ik.sq_lathe(f"{t}-ankle",
                            [(0.036, 0.044, 0.05), (0.04, 0.047, 0.053),
                             (0.052, 0.047, 0.053), (0.056, 0.044, 0.05)],
                            CHROME, n=12, power=4.0, cx=x))
    # A big flat square chrome foot on a dark tread sole.
    fy = 0.024
    foot = [
        ik.block(f"{t}-foot", (0.112, 0.168, 0.032), (x, fy, 0.026), CHROME,
                 bevel=0.011, seg=2),
        ik.block(f"{t}-sole", (0.108, 0.164, 0.012), (x, fy, 0.006), INK,
                 bevel=0.003, seg=1),
        # The ankle socket the band turns in.
        ik.disc(f"{t}-socket", 0.036, 0.014, (x, 0, 0.044), Z, GUN,
                segments=12, chamfer=0.003),
    ]
    # Tread ribs along the sole's toe.
    for k, dx in enumerate((-0.036, -0.012, 0.012, 0.036)):
        foot.append(ik.obox(f"{t}-tread{k}", (x + dx, fy + 0.0825, 0.007),
                            X, Y, (0.014, 0.008, 0.003), GUN))
    for dx in (-0.032, 0.032):
        foot.append(ik.rivet(f"{t}-toe", (x + dx, fy + 0.066, 0.042), Z,
                             0.005, CHROME))
        foot.append(ik.rivet(f"{t}-heel", (x + dx, fy - 0.062, 0.042), Z,
                             0.005, CHROME))
    return thigh, shin, foot


# ------------------------------------------------------------- torso

def torso():
    t = f"{R}-torso"
    out = [
        ik.block(f"{t}-hips", (0.19, 0.14, 0.05), (0, 0, 0.262), TEAM2,
                 bevel=0.012, seg=2),
        ik.rivet(f"{t}-hipriv0", (-0.03, 0.07, 0.262), Y, RIV, CHROME),
        ik.rivet(f"{t}-hipriv1", (0.03, 0.07, 0.262), Y, RIV, CHROME),
        # The chrome waist band, grooved in two.
        ik.sq_lathe(f"{t}-waist",
                    [(0.281, 0.128, 0.094), (0.286, 0.134, 0.1),
                     (0.297, 0.134, 0.1), (0.2995, 0.129, 0.095),
                     (0.3025, 0.129, 0.095), (0.305, 0.134, 0.1),
                     (0.314, 0.134, 0.1), (0.318, 0.127, 0.093)],
                    CHROME, n=16, power=4.5),
        ik.block(f"{t}-chest", (CHW, CHD, CH1 - CH0),
                 (0, 0, (CH0 + CH1) / 2), TEAM, bevel=BEV, seg=2,
                 taper=(TAPER_X, TAPER_Y), cuts=2),
        # The neck collar the head turns in.
        ik.turned(f"{t}-collar", [(0.048, -0.004), (0.048, 0.007),
                                  (0.04, 0.014), (0.033, 0.014)],
                  (0, 0, CH1), Z, CHROME, segments=14, close=False),
    ]
    out += panel(t)
    # Rivets framing the chest front.
    zt, zb = 0.503, 0.33
    wt = half_w(zt) - 0.033
    wb = half_w(zb) - 0.03
    out += ik.rivet_row(f"{t}-rt", front(-wt, zt), front(wt, zt), 7, NF, RIV,
                        CHROME)
    out += ik.rivet_row(f"{t}-rb", front(-wb, zb), front(wb, zb), 6, NF, RIV,
                        CHROME)
    for sx in (-1, 1):
        for k, z in enumerate((0.36, 0.392, 0.424, 0.456)):
            out.append(ik.rivet(f"{t}-rs{sx}{k}",
                                front(sx * (half_w(z) - 0.03), z), NF, RIV,
                                CHROME))
    # The side seams where the front and back halves meet: a flange held
    # by folded tabs.
    for sx in (-1, 1):
        n = V(sx * NS.x, 0, NS.z)
        u = V(sx * CHW / 2 * (TAPER_X - 1) / (CH1 - CH0), 0, 1).normalized()
        zm = 0.418
        out.append(ik.obox(f"{t}-flange{sx}", side(sx, 0, zm, 0.002), u, n,
                           (0.17, 0.009, 0.006), TEAM2))
        for k, z in enumerate((0.352, 0.418, 0.484)):
            out.append(ik.obox(f"{t}-tab{sx}{k}", side(sx, 0, z, 0.004), u,
                               n, (0.018, 0.022, 0.006), CHROME))
        for k, z in enumerate((0.34, 0.5)):
            for sy in (-1, 1):
                out.append(ik.rivet(f"{t}-sr{sx}{k}{sy}",
                                    side(sx, sy * 0.05, z), n, RIV, CHROME))
    # The top seam from the collar to each shoulder, with a folded tab.
    for sx in (-1, 1):
        out.append(ik.block(f"{t}-topseam{sx}", (0.052, 0.009, 0.005),
                            (sx * 0.083, 0, CH1 + 0.001), TEAM2, bevel=0))
        out.append(ik.block(f"{t}-toptab{sx}", (0.016, 0.022, 0.007),
                            (sx * 0.09, 0, CH1 + 0.002), CHROME,
                            bevel=0))
    out += back_plate(t)
    out += litho(t)
    return out


GAUGE = 0.034
GAUGE_Z = 0.43 + 0.002


def gauge_at(lift=0.0):
    return front(0, GAUGE_Z, 0.005 + lift)


def panel(t):
    """The cream control panel in its chrome frame: one big half-moon
    gauge (its needle is the `extra2` part) over three amber lamps."""
    out = []
    zc, w, h = 0.43, 0.15, 0.104
    out.append(ik.block(f"{t}-creamback", (w, 0.004, h), (0, 0, 0), CREAM,
                        bevel=0))
    out[-1].location = front(0, zc, 0.0005)
    kit.apply_transform(out[-1])
    out.append(ik.sheet(f"{t}-cream", front(0, zc, 0.0035), X, NF,
                        w - 0.004, h - 0.004, 4, 3, CREAM))
    fw = 0.008
    for k, (dx, dz, sw, sh) in enumerate((
            (0, h / 2, w + fw * 2, fw), (0, -h / 2, w + fw * 2, fw),
            (-w / 2, 0, fw, h), (w / 2, 0, fw, h))):
        out.append(ik.obox(f"{t}-frame{k}",
                           front(dx, zc + dz, 0.003), X, NF,
                           (sw, sh, 0.009), CHROME, bevel=0.0022, seg=1))
    for k, (sx, sz) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        out.append(ik.rivet(f"{t}-pr{k}",
                            front(sx * (w / 2), zc + sz * (h / 2), 0.0075),
                            NF, 0.0036, CHROME))
    # The gauge: a half-moon dial in a chrome bezel, a dark face band
    # with ticks, its hub at the bottom of the arc.
    up = NF.cross(X) * -1
    n = 14
    arc = [(GAUGE * math.cos(math.pi * i / n),
            GAUGE * math.sin(math.pi * i / n)) for i in range(n + 1)]
    inner = [(0.8 * x, 0.8 * y) for x, y in reversed(arc)]
    rim = [(x * 1.16, y * 1.16) for x, y in arc]
    rim_in = list(reversed(arc))
    out.append(ik.plate(f"{t}-gaugeface",
                        [(GAUGE, -0.004)] + arc + [(-GAUGE, -0.004)], 0.003,
                        CREAM, matrix=ik.basis(X, up, NF, gauge_at(-0.002))))
    out.append(ik.plate(f"{t}-gaugeband", arc + inner, 0.0036, INK,
                        matrix=ik.basis(X, up, NF, gauge_at(-0.0012))))
    out.append(ik.plate(f"{t}-gaugerim", rim + rim_in, 0.007, CHROME,
                        matrix=ik.basis(X, up, NF, gauge_at(-0.001)),
                        bevel=0.0015, seg=1))
    out.append(ik.obox(f"{t}-gaugebase", gauge_at(-0.001) - up * 0.004,
                       X, NF, (GAUGE * 2.32, 0.006, 0.007), CHROME,
                       bevel=0.0015, seg=1))
    for k in range(7):
        a = math.pi * (0.12 + 0.76 * k / 6)
        d = X * math.cos(a) + up * math.sin(a)
        out.append(ik.obox(f"{t}-tick{k}", gauge_at(0.0008) + d * 0.023,
                           d, NF, (0.007 if k % 3 == 0 else 0.0045, 0.0018,
                                   0.0012), INK))
    for k, dx in enumerate((-0.042, 0.0, 0.042)):
        at = front(dx, zc - 0.032, 0.005)
        out.append(ik.turned(f"{t}-lampring{k}", [(0.0105, 0.0042),
                                                  (0.0134, 0.0036),
                                                  (0.0134, -0.001)],
                             at, NF, CHROME, segments=12, close=False))
        out.append(ik.dome(f"{t}-lamp{k}", 0.0106, 0.0088, at + NF * 0.002,
                           NF, AMBER, segments=12, rings=3))
    return out


def needle():
    """The gauge's needle on its hub (the `extra2` part)."""
    t = f"{R}-needle"
    at = gauge_at(0.0024)
    up = NF.cross(X) * -1
    return [
        ik.obox(f"{t}-needle", at + up * 0.012, up, NF,
                (0.026, 0.0032, 0.0016), INK),
        ik.disc(f"{t}-hub", 0.0042, 0.003, at, NF, CHROME, segments=8),
    ]


def litho(t):
    """Printed panel lines on the chest's sides and back corners, as on a
    lithographed tin toy: a darker inset frame."""
    out = []
    for sx in (-1, 1):
        n = V(sx * NS.x, 0, NS.z)
        u = V(sx * CHW / 2 * (TAPER_X - 1) / (CH1 - CH0), 0, 1).normalized()
        for k, (dy, dz, a, b) in enumerate((
                (0, 0.505, 0.006, 0.13), (0, 0.33, 0.006, 0.13),
                (-0.062, 0.418, 0.15, 0.006), (0.062, 0.418, 0.15, 0.006))):
            out.append(ik.obox(f"{t}-litho{sx}{k}", side(sx, dy, dz, 0.0006),
                               u, n, (a, b, 0.0016), TEAM2))
    return out


def back_plate(t):
    """The back: a riveted hatch with the key's washer at its centre, and
    louvres above it."""
    out = []
    zc, w, h = KEY_Z, 0.16, 0.13
    out.append(ik.obox(f"{t}-hatch", back(0, zc, HATCH / 2 - 0.001), X, NB,
                       (w, h, HATCH + 0.002), TEAM2, bevel=0.003, seg=1))
    for k, (dx, dz) in enumerate(((-1, -1), (0, -1), (1, -1), (-1, 0),
                                  (1, 0), (-1, 1), (0, 1), (1, 1))):
        out.append(ik.rivet(f"{t}-hr{k}",
                            back(dx * (w / 2 - 0.012),
                                 zc + dz * (h / 2 - 0.012), HATCH),
                            NB, RIV, CHROME))
    out.append(ik.disc(f"{t}-washer", 0.022, 0.008, KEY + NB * 0.002, NB,
                       CHROME, segments=14, chamfer=0.003))
    for k, z in enumerate((0.502, 0.51)):
        out.append(ik.obox(f"{t}-louvre{k}", back(0, z, 0.0008), X, NB,
                           (0.11, 0.0045, 0.003), INK))
    return out


# ------------------------------------------------------------- head

HEAD_Z0, HEAD_Z1 = 0.545, 0.668
HEAD_W, HEAD_D, HEAD_Y = 0.158, 0.142, 0.004
FACE = HEAD_Y + HEAD_D / 2
# The head is sculpted at these numbers, then grown about the neck.
HEAD_SCALE = 1.1
# The visor slot and the eyes in it.
VZ, VW, VH = 0.626, 0.12, 0.036
EYE_X, EYE_R = 0.031, 0.0135
EYE_AT = V(0, FACE + 0.003, VZ)
# The antenna's foot on the lid.
ANT_TOP, ANT_Y = HEAD_Z1 + 0.01, HEAD_Y - 0.02


def grown(p):
    """A point of the head as sculpted, where the grown head has it."""
    return NECK + (V(p) - NECK) * HEAD_SCALE


def grow(objs):
    m = (Matrix.Translation(NECK) @ Matrix.Scale(HEAD_SCALE, 4) @
         Matrix.Translation(-NECK))
    return ik.transform(objs, m)


def head():
    t = f"{R}-head"
    zc = (HEAD_Z0 + HEAD_Z1) / 2
    out = [
        ik.turned(f"{t}-neck", [(0.029, -0.02), (0.033, -0.004),
                                (0.033, 0.005), (0.029, 0.02)],
                  NECK, Z, GUN, segments=10, close=False),
        ik.block(f"{t}-skull", (HEAD_W, HEAD_D, HEAD_Z1 - HEAD_Z0),
                 (0, HEAD_Y, zc), TEAM, bevel=0.016, seg=2, cuts=1),
        # A heavy lid over the skull: the stern brow line.
        ik.block(f"{t}-lid", (HEAD_W + 0.012, HEAD_D + 0.012, 0.014),
                 (0, HEAD_Y, HEAD_Z1 + 0.003), TEAM, bevel=0.005, seg=1),
        ik.block(f"{t}-lidseam", (HEAD_W + 0.004, HEAD_D + 0.004, 0.004),
                 (0, HEAD_Y, HEAD_Z1 - 0.0055), TEAM2, bevel=0),
    ]
    # The visor slot: a dark recess in a chrome frame, its top bar heavy.
    vz, vw, vh = VZ, VW, VH
    out.append(ik.block(f"{t}-slot", (vw, 0.008, vh), (0, FACE, vz), INK,
                        bevel=0))
    out.append(ik.block(f"{t}-brow", (vw + 0.02, 0.018, 0.013),
                        (0, FACE + 0.002, vz + vh / 2 + 0.0055), CHROME,
                        bevel=0.003, seg=1))
    out.append(ik.block(f"{t}-sill", (vw + 0.014, 0.012, 0.007),
                        (0, FACE + 0.001, vz - vh / 2 - 0.002), CHROME,
                        bevel=0.0022, seg=1))
    for sx in (-1, 1):
        out.append(ik.block(f"{t}-jamb{sx}", (0.008, 0.012, vh + 0.004),
                            (sx * (vw / 2 + 0.003), FACE + 0.001, vz),
                            CHROME, bevel=0.0022, seg=1))
    # Two big round amber eyes in chrome bezels, each with a dark pupil
    # glancing in toward the nose; the lids (`extra`) hood them.
    for sx in (-1, 1):
        at = V(sx * EYE_X, FACE + 0.003, vz)
        out.append(ik.turned(f"{t}-bezel{sx}", [(EYE_R + 0.0002, 0.0045),
                                                (EYE_R + 0.0036, 0.004),
                                                (EYE_R + 0.0036, -0.001)],
                             at, Y, CHROME, segments=14, close=False))
        out.append(ik.dome(f"{t}-eye{sx}", EYE_R, 0.0072, at + Y * 0.001, Y,
                           AMBER, segments=14, rings=3))
        pd = V(-sx * 0.0035, 0.0, -0.002)
        out.append(ik.dome(f"{t}-pupil{sx}", 0.0052, 0.0016,
                           at + Y * 0.0068 + pd, V(-sx * 0.25, 1, -0.15),
                           INK, segments=10, rings=1))
    # The mouth grille: chrome bars across a dark slot in a chrome rim.
    mz = 0.577
    out.append(ik.block(f"{t}-mouthrim", (0.088, 0.008, 0.032),
                        (0, FACE, mz), CHROME, bevel=0.0025, seg=1))
    out.append(ik.block(f"{t}-mouth", (0.076, 0.004, 0.022),
                        (0, FACE + 0.003, mz), INK, bevel=0))
    for k in range(3):
        z = mz - 0.0072 + k * 0.0072
        out.append(ik.rod(f"{t}-bar{k}", (-0.038, FACE + 0.005, z),
                          (0.038, FACE + 0.005, z), 0.0026, CHROME,
                          segments=6, cap=False))
    for sx in (-1, 1):
        for k, z in enumerate((0.566, 0.588)):
            out.append(ik.rivet(f"{t}-cheek{sx}{k}", (sx * 0.062, FACE, z),
                                Y, 0.0042, CHROME))
    # Ear bolts: a chrome boss, a hex nut and a stubby pin.
    for sx in (-1, 1):
        n = X * sx
        at = V(sx * HEAD_W / 2, HEAD_Y, 0.612)
        out.append(ik.disc(f"{t}-ear{sx}", 0.026, 0.012, at + n * 0.004, n,
                           CHROME, segments=12, chamfer=0.004))
        out.append(ik.disc(f"{t}-nut{sx}", 0.013, 0.01, at + n * 0.014, n,
                           CHROME, segments=6, chamfer=0.002))
        out.append(ik.turned(f"{t}-pin{sx}", [(0.006, 0.0), (0.005, 0.01),
                                              (0.0, 0.013)],
                             at + n * 0.019, n, CHROME, segments=8,
                             close=False))
        for k, dy in enumerate((-0.045, 0.045)):
            out.append(ik.rivet(f"{t}-sr{sx}{k}",
                                at + V(0, dy, -0.036), n, 0.0042, CHROME))
    # The antenna's boss (the antenna itself is its own part).
    out.append(ik.disc(f"{t}-antbase", 0.017, 0.009,
                       (0, ANT_Y, ANT_TOP + 0.002), Z, CHROME, segments=12,
                       chamfer=0.003))
    # Rivets at the corners of the lid, round the antenna.
    for k, (dx, dy) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        out.append(ik.rivet(f"{t}-lr{k}",
                            (dx * (HEAD_W / 2 - 0.008),
                             HEAD_Y + dy * (HEAD_D / 2 - 0.008),
                             HEAD_Z1 + 0.01), Z, 0.0048, CHROME))
    # Rivets on the back of the head.
    for k, (dx, z) in enumerate(((-0.05, 0.575), (0.05, 0.575),
                                 (-0.05, 0.64), (0.05, 0.64))):
        out.append(ik.rivet(f"{t}-br{k}", (dx, HEAD_Y - HEAD_D / 2, z), -Y,
                            0.0045, CHROME))
    for k, z in enumerate((0.598, 0.607, 0.616)):
        out.append(ik.block(f"{t}-grille{k}", (0.06, 0.004, 0.0042),
                            (0, HEAD_Y - HEAD_D / 2 - 0.0005, z), INK,
                            bevel=0))
    return grow(out)


def antenna():
    """A springy chrome antenna: a coil on the boss, the mast, a ring and a
    big ball tip (pivot at the coil's foot)."""
    t = f"{R}-antenna"
    z0 = ANT_TOP + 0.006
    turns, n = 3.5, 30
    coil = []
    for i in range(n + 1):
        a = i / n * turns * math.tau
        coil.append(V(0.0072 * math.cos(a), ANT_Y + 0.0072 * math.sin(a),
                      z0 + 0.024 * i / n))
    out = [
        ik.sq_tube(f"{t}-coil", coil, [(0.0022, 0.0022)] * len(coil), CHROME,
                   n=5, power=2.0, up=Z),
        ik.rod(f"{t}-core", (0, ANT_Y, z0 - 0.002), (0, ANT_Y, z0 + 0.028),
               0.0034, GUN, segments=6, cap=False),
        ik.rod(f"{t}-mast", (0, ANT_Y, z0 + 0.022), (0, ANT_Y, z0 + 0.088),
               0.0042, CHROME, segments=8, cap=False),
        ik.disc(f"{t}-ring", 0.009, 0.004, (0, ANT_Y, z0 + 0.056), Z, CHROME,
                segments=10),
    ]
    ball = kit.sphere(f"{t}-tip", 0.0145, (0, ANT_Y, z0 + 0.098),
                      mat=CHROME, segments=12, rings=7)
    kit.apply_transform(ball)
    out.append(ball)
    return grow(out)


def lids():
    """The angry eyelids, one part on a hinge along x through the eyes:
    tin shells curved about that hinge, hooding the top of each eye with a
    slant down toward the nose. At rest the part sits as built; turning it
    about x drops both lids over the eyes (a blink). Most of each shell is
    tucked inside the head behind the brow."""
    t = f"{R}-lids"
    out = []
    r0, r1 = EYE_R + 0.0052, EYE_R + 0.0074
    span = math.radians(175)
    na, nx = 10, 6
    w = EYE_R + 0.005
    for sx in (-1, 1):
        rings = []
        for i in range(nx + 1):
            f = i / nx * 2 - 1          # -1 outer .. +1 inner (by the nose)
            x = sx * EYE_X - sx * f * w
            lo = math.radians(40 - 32 * f)
            ring = []
            arcs = [lo + span * j / na for j in range(na + 1)]
            for a in arcs:
                ring.append(V(x, EYE_AT.y + r1 * math.cos(a),
                              EYE_AT.z + r1 * math.sin(a)))
            for a in reversed(arcs):
                ring.append(V(x, EYE_AT.y + r0 * math.cos(a),
                              EYE_AT.z + r0 * math.sin(a)))
            rings.append(ring)
        out.append(ik.loft(f"{t}{sx}", rings, TEAM, start="flat",
                           end="flat"))
    return grow(out)


# ------------------------------------------------------------- arms

FORE = V(0, 0.75, -0.66).normalized()
# Across the forearm, in its swing plane (forward and up at rest): the
# claw's jaws open along it.
UPV = V(0, -FORE.z, FORE.y)
ELBOW_Z = 0.372
CLAW = 0.108


def arm(sx):
    """Three pieces: the upper arm on its shoulder drum, the forearm from
    the elbow hinge with the claw's upper jaw, and the lower jaw."""
    t = f"{R}-arm{sx}"
    n = X * sx
    s = V(sx * SH_X, 0, SH_Z)
    upper = [
        ik.disc(f"{t}-washer", 0.033, 0.01, V(sx * 0.147, 0, SH_Z), n,
                CHROME, segments=16),
        # The shoulder drum the arm hinges on.
        ik.turned(f"{t}-drum", [(0.04, 0.0), (0.046, 0.006), (0.046, 0.044),
                                (0.041, 0.05)],
                  V(sx * 0.151, 0, SH_Z), n, TEAM, segments=18),
        ik.disc(f"{t}-hubcap", 0.024, 0.006, V(sx * 0.203, 0, SH_Z), n,
                CHROME, segments=14, chamfer=0.002),
        ik.rivet(f"{t}-bolt", V(sx * 0.206, 0, SH_Z), n, 0.0085, CHROME),
    ]
    for k in range(6):
        a = k / 6 * math.tau + math.pi / 6
        upper.append(ik.rivet(f"{t}-dr{k}",
                              V(sx * 0.201, 0.034 * math.cos(a),
                                SH_Z + 0.034 * math.sin(a)), n, 0.004,
                              CHROME))
    # Upper arm, elbow hinge, forearm flaring to a chrome cuff.
    e = V(sx * 0.183, 0.0, ELBOW_Z)
    upper.append(ik.sq_tube(f"{t}-upper", [V(sx * 0.18, 0, 0.462),
                                           e + Z * 0.004],
                            [(0.03, 0.031), (0.028, 0.029)], TEAM, n=10,
                            power=3.2, up=Y))
    upper.append(ik.obox(f"{t}-litho", V(sx * 0.18, 0.0295, 0.418), Z, Y,
                         (0.07, 0.03, 0.0016), TEAM2))
    fore = [
        ik.disc(f"{t}-elbow", 0.024, 0.064, e, X, CHROME, segments=14,
                chamfer=0.004, both=True),
        ik.rivet(f"{t}-elbolt", e + n * 0.032, n, 0.0078, CHROME),
    ]
    w = e + FORE * 0.112
    up = FORE.cross(X).normalized() * -1
    fore.append(ik.sq_tube(f"{t}-fore", [e + FORE * 0.004, e + FORE * 0.05,
                                         w - FORE * 0.004],
                           [(0.028, 0.028), (0.031, 0.031), (0.035, 0.035)],
                           TEAM, n=10, power=3.2, up=up))
    for k, f in enumerate((0.05, 0.085)):
        p = e + FORE * f
        fore.append(ik.rivet(f"{t}-fr{k}",
                             p + n * (0.0295 + (f - 0.05) * 0.06), n, 0.004,
                             CHROME))
    fore.append(ik.sq_tube(f"{t}-cuff", [w - FORE * 0.008, w + FORE * 0.006],
                           [(0.039, 0.039), (0.037, 0.037)], CHROME, n=12,
                           power=3.2, up=up))
    fore.append(ik.sq_tube(f"{t}-wrist", [w + FORE * 0.005,
                                          w + FORE * 0.022],
                           [(0.025, 0.025), (0.023, 0.023)], GUN, n=10,
                           power=2.6, up=up))
    base = w + FORE * 0.024
    pin = base + FORE * 0.012
    jaw_top, jaw_low, knuckle = pincer(t, base, pin)
    fore += jaw_top + knuckle
    return upper, fore, jaw_low, s, e, pin


# A chunky C claw's jaw, the upper one: (along the claw, across it) in
# claw lengths, counter-clockwise, from the root along the inner edge to
# the hooked tip and back along the outer edge.
JAW = [(0.0, 0.1), (0.12, 0.16), (0.28, 0.24), (0.46, 0.28), (0.64, 0.26),
       (0.79, 0.18), (0.88, 0.1), (0.95, 0.055), (1.0, 0.11), (0.97, 0.22),
       (0.88, 0.36), (0.74, 0.47), (0.56, 0.53), (0.36, 0.52), (0.18, 0.45),
       (0.05, 0.36), (0.0, 0.3)]


def smooth(pts, keep=(), rounds=2):
    """Chaikin-round a closed outline, holding the corners in `keep`
    (indices into the original) sharp."""
    pts = [(p, i in keep) for i, p in enumerate(pts)]
    for _ in range(rounds):
        out = []
        for i, (p, sharp) in enumerate(pts):
            q, _ = pts[(i + 1) % len(pts)]
            if sharp:
                out.append((p, True))
            else:
                o, _ = pts[i - 1]
                out.append(((0.75 * p[0] + 0.25 * o[0],
                             0.75 * p[1] + 0.25 * o[1]), False))
                out.append(((0.75 * p[0] + 0.25 * q[0],
                             0.75 * p[1] + 0.25 * q[1]), False))
        pts = out
    return [p for p, _ in pts]


def pincer(t, base, pin):
    """Two chunky chrome jaws in the forearm's swing plane, curled into a
    C that opens forward: the upper one fixed to the forearm, the lower
    one hinged on the pin (about x). A knuckle drum on the pin closes the
    root between them."""
    m = ik.basis(FORE, UPV, X, base)
    top = [(a * CLAW, b * CLAW) for a, b in smooth(JAW, keep=(0, 7, 8))]
    low = [(a, -b) for a, b in reversed(top)]
    jaw_top = [ik.plate(f"{t}-jaw0", top, 0.02, CHROME, matrix=m,
                        bevel=0.003, seg=1)]
    jaw_low = [ik.plate(f"{t}-jaw1", low, 0.02, CHROME, matrix=m,
                        bevel=0.003, seg=1)]
    knuckle = [
        ik.disc(f"{t}-knuckle", 0.017, 0.028, pin, X, GUN, segments=12,
                chamfer=0.003, both=True),
        ik.disc(f"{t}-pin", 0.008, 0.032, pin, X, CHROME, segments=8),
    ]
    return jaw_top, jaw_low, knuckle


# ------------------------------------------------------------- the key

def key():
    """A big chrome wind-up key: a shaft out of the back along -y, a
    collar, and a die-cut butterfly bow in the plane of the shaft."""
    t = f"{R}-key"
    out = [
        ik.rod(f"{t}-shaft", KEY + Y * 0.004, KEY - Y * 0.058, 0.0075, CHROME,
               segments=10, cap=False),
        ik.disc(f"{t}-collar", 0.0135, 0.008, KEY - Y * 0.016, Y, CHROME,
                segments=10, chamfer=0.002, both=True),
        ik.disc(f"{t}-shoulder", 0.012, 0.012, KEY - Y * 0.056, -Y, CHROME,
                segments=10, chamfer=0.003),
    ]
    s = 0.056
    outline = [(x * s, y * s) for x, y in ik.cassini(1.0, 1.1, 28)]
    holes = [list(reversed(ik.circle(sx * 1.02 * s, 0, 0.32 * s, 10)))
             for sx in (-1, 1)]
    # Long axis up (z), flat across x, its waist on the shaft's end.
    waist = 0.458 * s
    m = ik.basis(Z, -Y, X, KEY - Y * (0.06 + waist))
    out.append(ik.plate(f"{t}-bow", outline, 0.013, CHROME, holes=holes,
                        matrix=m, bevel=0.0035, seg=1))
    # Larger than the sculpt, as on the card: the key reads from afar.
    k = KEY_SCALE
    return ik.transform(out, Matrix.Translation(KEY) @ Matrix.Scale(k, 4) @
                        Matrix.Translation(-KEY))


# ------------------------------------------------------------- build

def build(root_name=R):
    if os.environ.get("IMPS_TEAM") == "red":
        # Preview the far side's paint (the game tints team at runtime).
        kit.tint("team", "#d8382c")
        kit.tint("team2", "#8e1f1a")
        kit.HEX.pop("team", None)
        kit.HEX.pop("team2", None)
    root = kit.empty(root_name)
    for side_, sx in (("L", -1), ("R", 1)):
        thigh, shin, foot = leg(sx)
        x = sx * HIP_X
        hip = ik.part(root_name, f"leg{side_}", thigh, (x, 0, HIP_Z), root)
        knee = ik.part(root_name, f"knee{side_}", shin, (x, 0, KNEE_Z), hip)
        ik.part(root_name, f"foot{side_}", foot, (x, 0, ANKLE_Z), knee)
    body = ik.part(root_name, "torso", torso(), WAIST, root)
    head_ = face_rig.head(ik.part, root_name, head(), NECK, body)
    ik.part(root_name, "antenna", antenna(), grown((0, ANT_Y, ANT_TOP + 0.006)),
            head_)
    ik.part(root_name, "extra", lids(), grown(EYE_AT), head_)
    for side_, sx in (("L", -1), ("R", 1)):
        upper, fore, jaw, s, e, pin = arm(sx)
        a = ik.part(root_name, f"arm{side_}", upper, s, body)
        f = ik.part(root_name, f"fore{side_}", fore, e, a)
        ik.part(root_name, f"hand{side_}", jaw, pin, f)
    ik.part(root_name, "spin", key(), KEY, body)
    ik.part(root_name, "extra2", needle(), gauge_at(0.0024), body)
    if os.environ.get("IMPS_POSE") == "attack":
        pose(root)
    return root


def pose(root):
    """The jab at full stretch: right arm thrust, left arm up, legs apart,
    the body twisting behind the jab, the key a quarter turn round."""
    want = {"armR": (1.5, 0, 0), "foreR": (-0.5, 0, 0), "handR": (-0.6, 0, 0),
            "armL": (0.7, 0, 0), "foreL": (0.9, 0, 0), "legL": (0.55, 0, 0),
            "kneeL": (-0.6, 0, 0), "legR": (-0.35, 0, 0),
            "spin": (0, math.pi / 2, 0), "torso": (0, 0, -0.35),
            "extra": (-0.5, 0, 0), "antenna": (0.3, 0, 0.2),
            "extra2": (0, 0.8, 0)}
    for o in kit.descendants(root):
        k = o.name.split(".", 1)[-1]
        if k in want:
            o.rotation_euler = want[k]
    kit.refresh()
