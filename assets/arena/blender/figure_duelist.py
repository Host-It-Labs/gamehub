"""The Samurai (card id `duelist`) as a collector's miniature: a grown-up
samurai in full armour, hand-painted resin with gloss-lacquered lames.

A kabuto with a ribbed bowl, a flared shikoro, a broad gilt kuwagata U and
a domed gold maedate; a stern face with a scowl and a great black
handlebar moustache, the helmet's cream chin cord knotted under it; a dō,
sode and kusazuri of stepped lacquered lames laced with raised cream
cords; a thick twisted rope belt knotted at the front left; kote with iron
splints and big fists on the hilt; charcoal hakama with folds, haidate,
suneate, tabi and straw waraji; a daishō scabbard on the left hip, the
katana drawn and held two-handed in chūdan, and a small team banner
(sashimono) on the back.

Part contract (figures.py / moves/duelist.ts): the root empty `duelist` at
the feet facing +y; `duelist.legL/R` pivot at the hips (articulation.py
splits knees and feet); `duelist.torso` at the waist carries the head, both
arms and the scabbards. Soft joints, all springing in the game:
`skirtL/R` (each side's front, side and back tassets, pivoting under the
belt), `tail` (the rope belt's two ends, from the knot), `cape` (the
banner's pole and flag, pivoting in its bracket; the flag ripples, see
kit.drape), `hat` (the shikoro, under the head), `beard` (the chin cord's
knot and ends), `sleeveL/R` (the sode, under the arms). `duelist.weapon`
is the katana, a child of armR with its pivot in the right fist. Both
shoulders sit on one line along x, so turning both arms by the same angle
about x keeps the left fist on the hilt through every blow.
"""

import math
import os

import kit
import face_rig
import figure_duelist_kit as dk
from figure_duelist_kit import V, lerp, clamp01, smooth, spow

# ------------------------------------------------------------- paints

TEAM = "lacquer:team"
TEAM2 = "lacquer:team2"
GOLD = "gilt:" + kit.tint("samurai-gold", "#c9a24a")
# The silk cords are painted cloth (the `drape` family): they share one
# pot with the banner's crest, the only cord that ripples (kit.drape is
# called on the banner alone; elsewhere the cords hold still).
CORD = "drape:" + kit.tint("samurai-cord", "#d8bf86")
FLAG = "drape:team"
IRON = "lacquer:" + kit.tint("samurai-iron", "#24252b")
STEEL = "gilt:" + kit.tint("samurai-steel", "#a9b1bb")
HAMON = "gilt:" + kit.tint("samurai-hamon", "#e4e8ee")
SKIN = "resin:" + kit.tint("samurai-skin", "#e2ab87")
WHISKER = "resin:" + kit.tint("samurai-whisker", "#9a9187")
EYE = "resin:" + kit.tint("samurai-eye", "#1b1613")
HAIR = EYE
HAKAMA = "weave:" + kit.tint("samurai-hakama", "#363b4b")
SLEEVE = "weave:" + kit.tint("samurai-sleeve", "#2f3342")
KOTE = "weave:team2"
OBI = "weave:" + kit.tint("samurai-obi", "#4a3326")
STRAW = "weave:" + kit.tint("samurai-straw", "#9c8052")
# A few paints share a pot to keep the material count (one batch each at
# runtime) low: tabi and hilt silk in the robe's slate, the scabbards in
# black iron, the hilt's ray skin in the cord cream.
TABI = SLEEVE
ITO = SLEEVE
SAYA = IRON
SAME = CORD

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.095, 0.60
WAIST = V(0, 0, 0.64)
NECK = V(0, 0.0, 1.035)
SH_X, SH_Z = 0.215, 1.0
UPPER, FORE = 0.235, 0.215
# The katana: tip up and forward, turned a little to the right so the
# blade reads from the high game camera. The left fist closes at the
# pommel, the right one just under the guard; both sit far enough from
# the shoulder line that the overhead lift clears the helmet.
YAW, EL = math.radians(30), math.radians(36)
D = V(math.sin(YAW) * math.cos(EL), math.cos(YAW) * math.cos(EL),
      math.sin(EL))
HAND_L = V(-0.005, 0.33, 0.735)
HAND_R = HAND_L + D * 0.084
# The weapon pivot: the heel of the right fist, next to the left one, so
# the katana's own small turns in the cut slide the hilt as little as
# possible in either fist.
GRIP = HAND_R - D * 0.04
BLADE = 0.67
ROLL = 38
HEAD_CY = 0.008                     # the head's centre line, a little forward


# ------------------------------------------------------------- lames

def lame_profile(bottoms, top, out0, step, lip=0.009, tuck=0.007,
                 slope=0.004):
    """Rings (z, offset, kind) of a hanging stack of lames, top down: each
    lame hangs in front of the one below it, so its bottom edge shows as a
    lip over a dark recess. Kinds name the band below each ring."""
    rings = [(top, out0 - slope, "face")]
    for k, zb in enumerate(bottoms):
        ob = out0 + step * k
        rings.append((zb + lip, ob - 0.001, "lip"))
        rings.append((zb, ob, "step" if k < len(bottoms) - 1 else "end"))
        if k < len(bottoms) - 1:
            rings.append((zb, ob - tuck, "face"))
    return rings


def lame_mat(kind, last_lip, is_last):
    if kind == "face":
        return TEAM
    if kind == "lip":
        return GOLD if is_last else TEAM
    return TEAM2


def cords_on(name, surf, us, lames, width, height=0.0028, mat=None,
             inside=None):
    """Raised cords (sugake lacing) crossing each lame at the columns
    `us`: `surf(u, z)` gives the surface point, `lames` is a list of
    (z_top, z_bottom) of each visible lame face; `inside(c)` a point
    behind the surface near c (default: the z axis)."""
    out = []
    mat = mat or CORD
    for k, (z0, z1) in enumerate(lames):
        for i, u in enumerate(us):
            q = [surf(u - width, z1), surf(u + width, z1),
                 surf(u + width, z0), surf(u - width, z0)]
            c = sum(q, V(0, 0, 0)) / 4
            n = (q[1] - q[0]).cross(q[3] - q[0])
            if n.length < 1e-9:
                continue
            n.normalize()
            behind = inside(c) if inside else V(0, 0, c.z)
            if n.dot(c - behind) < 0:
                n = -n
            out.append(dk.raised(f"{name}-{k}-{i}", q, n, height, mat,
                                 taper=0.35))
    return out


# ------------------------------------------------------------- the dō

DO = [(0.615, 0.152, 0.121, 0.000), (0.70, 0.146, 0.114, 0.000),
      (0.78, 0.156, 0.121, 0.004), (0.86, 0.173, 0.130, 0.008),
      (0.93, 0.184, 0.136, 0.010), (0.975, 0.178, 0.130, 0.008),
      (1.00, 0.160, 0.116, 0.004)]
DO_POW = 2.5


def do_sec(z):
    for a, b in zip(DO, DO[1:]):
        if z <= b[0]:
            t = clamp01((z - a[0]) / (b[0] - a[0]))
            return [lerp(a[i], b[i], t) for i in (1, 2, 3)]
    return list(DO[-1][1:])


def do_pt(a, z, off):
    rx, ry, cy = do_sec(z)
    e = 2.0 / DO_POW
    x = (rx + off) * spow(math.cos(a), e)
    y = cy + (ry + off) * spow(math.sin(a), e)
    # The chest swells a little at the front of the breastplate.
    if math.sin(a) > 0 and 0.83 < z < 0.99:
        y += 0.011 * math.sin(math.pi * (z - 0.83) / 0.16) * \
            math.sin(a) ** 3
    return V(x, y, z)


DO_LAMES = [(0.615, 0.673), (0.673, 0.731), (0.731, 0.789),
            (0.789, 0.846), (0.846, 0.903)]
MUNAITA = (0.903, 0.972)


def munaita_lift(a):
    """The breast and back plates rise over the chest and shoulder
    blades; the dō dips under the arms."""
    return 0.034 * abs(math.sin(a)) ** 2.2


def cuirass(t):
    """The dō: five horizontal lames under a breast plate, each lame's top
    edge standing proud of the one above it, laced with cream cords."""
    n = 24
    angs = [i / n * math.tau for i in range(n)]
    # (z, offset, band material above the ring, rises with the plate)
    rings = [(0.605, -0.012, TEAM2, 0)]
    for k, (zb, zt) in enumerate(DO_LAMES):
        rings.append((zb, 0.004 if k == 0 else -0.004, TEAM, 0))
        rings.append((zt - 0.007, 0.004, GOLD, 0))
        rings.append((zt, 0.0055, TEAM2, 0))
    rings.append((MUNAITA[0], -0.004, TEAM, 0))
    rings.append((MUNAITA[1] - 0.012, 0.004, GOLD, 1))
    rings.append((MUNAITA[1], 0.005, GOLD, 1))
    rings.append((MUNAITA[1] + 0.004, -0.006, TEAM2, 1))
    rings.append((MUNAITA[1] + 0.006, -0.03, TEAM2, 1))
    pts = [[do_pt(a, z + lift * munaita_lift(a), off) for a in angs]
           for z, off, _, lift in rings]
    mats = [m for _, _, m, _ in rings]
    shell = dk.loft(f"{t}-do", pts, TEAM, bands=lambda i: mats[i],
                    levels=0)

    # Sugake lacing: cords down each lame, front and back.
    cols = [math.radians(c) for c in (90 - 52, 90 - 22, 90 + 22, 90 + 52,
                                      270 - 52, 270 - 22, 270 + 22,
                                      270 + 52)]
    faces = [(zb + 0.004, zt - 0.009) for zb, zt in DO_LAMES]

    def surf(u, z):
        k = 0
        for kk, (zb, zt) in enumerate(DO_LAMES + [MUNAITA]):
            if zb <= z <= zt:
                k = kk
        zb, zt = (DO_LAMES + [MUNAITA])[k]
        off = lerp(-0.004 if k else 0.004, 0.004, clamp01((z - zb) /
                                                         (zt - zb - 0.008)))
        return do_pt(u, z, off)

    cords = cords_on(f"{t}-docord", surf, cols, faces,
                     math.radians(1.7), height=0.0028)
    return [shell] + cords


def upper_body(t):
    """The dark under-robe filling the shoulders above the dō, the
    shoulder straps (watagami) and the standing collar."""
    pieces = []
    rings = [
        dk.hring(0.95, 0.165, 0.118, 14, cy=0.006, power=2.4),
        dk.hring(0.985, 0.19, 0.118, 14, cy=0.004, power=2.6),
        dk.hring(1.018, 0.172, 0.1, 14, cy=0.0, power=2.4),
        dk.hring(1.042, 0.11, 0.078, 14, cy=0.0, power=2.2),
        dk.hring(1.06, 0.06, 0.056, 14, cy=0.0, power=2.0),
    ]
    pieces.append(dk.loft(f"{t}-robe", rings, SLEEVE, start="flat",
                          end="flat", levels=0))
    # Watagami: padded straps from the back plate over each shoulder.
    for sx in (-1, 1):
        path = [V(sx * 0.105, -0.13, 0.975), V(sx * 0.115, -0.09, 1.034),
                V(sx * 0.118, 0.0, 1.052), V(sx * 0.115, 0.085, 1.034),
                V(sx * 0.108, 0.125, 0.99)]
        pieces.append(dk.tube(f"{t}-watagami{sx}", path,
                              [(0.008, 0.026)] * len(path), TEAM2, n=6,
                              up=(0, 0, 1), levels=0, power=3.0,
                              caps=("flat", "flat")))

        # Kobire: a small gold-edged plate over the shoulder socket, clear
        # of the turning arm below and of the shikoro when the head turns.
        def kb(u, v, sx=sx):
            x = lerp(0.192, 0.264, u)
            y = lerp(-0.068, 0.072, v)
            z = 1.086 - 1.8 * (x - 0.19) ** 2 + 0.007 * math.sin(math.pi * v)
            return V(sx * x, y, z)

        pieces.append(dk.panel(f"{t}-kobire{sx}", kb, [0.0, 0.5, 1.0],
                               [0.0, 0.5, 1.0], TEAM2, 0.005,
                               inside=V(sx * 0.2, 0, 0.9), rim_mat=GOLD))
    # Eri-mawashi: a two-lame collar round the neck, gold edged.
    col = []
    for z, r, ry in ((0.995, 0.098, 0.088), (1.04, 0.083, 0.075),
                     (1.047, 0.082, 0.074), (1.05, 0.074, 0.066)):
        col.append(dk.hring(z, r, ry, 18, cy=-0.006))
    pieces.append(dk.loft(f"{t}-collar", col, TEAM2,
                          bands={1: GOLD, 2: GOLD}, levels=0))
    return pieces


def agemaki(t):
    """The great cord bow on the back plate."""
    at = do_pt(-math.pi / 2, 0.905, 0.012)
    pieces = [dk.ball(f"{t}-knot", 0.017, at, CORD, scale=(1, 0.7, 1),
                      seg=8, rings=5)]
    for sx in (-1, 1):
        loop = [at + V(sx * 0.012, 0, 0.004),
                at + V(sx * 0.042, -0.006, 0.03),
                at + V(sx * 0.07, -0.004, 0.024),
                at + V(sx * 0.066, -0.002, -0.004),
                at + V(sx * 0.03, -0.004, -0.008),
                at + V(sx * 0.01, 0, -0.002)]
        pieces.append(dk.tube(f"{t}-loop{sx}", loop,
                              [0.0075] * len(loop), CORD, n=5,
                              levels=0, up=(0, -1, 0),
                              caps=("pole", "pole")))
        tail = [at + V(sx * 0.006, 0.002, -0.01),
                at + V(sx * 0.022, -0.006, -0.06),
                at + V(sx * 0.03, -0.004, -0.11)]
        pieces.append(dk.tube(f"{t}-tail{sx}", tail, [0.008, 0.0075, 0.007],
                              CORD, n=5, levels=0, up=(0, -1, 0),
                              caps=("pole", "pole")))
        pieces.append(dk.ball(f"{t}-tassel{sx}", 0.012,
                              at + V(sx * 0.031, -0.004, -0.12), CORD,
                              scale=(1, 1, 1.5), seg=6, rings=4))
    return pieces


def kit_path(pts, samples):
    return [V(p) for p in kit.smooth_path(pts, samples)]


def obi(t):
    """The belt over the dō's hem, and the hakama's waist beneath it."""
    rings = []
    for z, off in ((0.598, -0.006), (0.603, 0.007), (0.628, 0.009),
                   (0.634, -0.004)):
        rings.append([do_pt(i / 24 * math.tau, 0.615, off)
                      for i in range(24)])
    belt = dk.loft(f"{t}-obi", rings, OBI, levels=0)
    hips = dk.loft(f"{t}-hips",
                   [dk.hring(z, rx, ry, 16, power=2.2)
                    for z, rx, ry in ((0.47, 0.12, 0.09),
                                      (0.53, 0.148, 0.112),
                                      (0.61, 0.15, 0.118))],
                   HAKAMA, start="pole", end="flat", levels=0)
    return [belt, hips]


def rope_ring(name, path, r, mat, n=6, strands=3, twist=1.1, depth=0.2):
    """A closed twisted rope through `path` (a loop of points)."""
    path = [V(p) for p in path]
    m = len(path)
    c = dk.Cage(name, mat)
    rings = []
    for i, p in enumerate(path):
        tang = path[(i + 1) % m] - path[i - 1]
        u, v = dk.frame_at(tang, (0, 0, 1))
        ring = []
        for k in range(n):
            a = k / n * math.tau
            rr = r * (1 + depth * math.cos(strands * a + i * twist))
            ring.append(p + u * math.cos(a) * rr + v * math.sin(a) * rr)
        rings.append(c.ring(ring))
    for i in range(m):
        c.bridge(rings[i], rings[(i + 1) % m])
    return c.obj(levels=0, recalc=True)


def rope_end(name, path, r, mat, n=6, twist=1.1, depth=0.2):
    """An open twisted rope end, from `path[0]` to a frayed tassel."""
    def wave(i, ang):
        return 1 + depth * math.cos(3 * ang + i * twist)
    pts = kit_path(path, 3)
    radii = [lerp(r, r * 0.85, i / (len(pts) - 1)) for i in range(len(pts))]
    return dk.tube(name, pts, radii, mat, n=n, levels=0,
                   caps=("pole", "dome"), wave=wave)


ROPE_Z = 0.62
KNOT_A = math.radians(112)


def rope_belt(t):
    """The thick twisted cream rope over the belt, as on the card, knotted
    at the front left. Its two ends hang from the knot on their own joint
    (`tail`); the knot stays with the belt."""
    path = [do_pt(i / 44 * math.tau, 0.615, 0.02) for i in range(44)]
    for p in path:
        p.z = ROPE_Z
    pieces = [rope_ring(f"{t}-rope", path, 0.0145, CORD)]
    knot = do_pt(KNOT_A, 0.615, 0.036)
    knot.z = ROPE_Z - 0.004
    pieces.append(dk.ball(f"{t}-ropeknot", 0.025, knot, CORD,
                          scale=(1.15, 0.75, 0.95), seg=12, rings=7))
    # Two fat loops of the bow either side of the knot.
    out = V(math.cos(KNOT_A), math.sin(KNOT_A), 0)
    across = V(-out.y, out.x, 0)
    for sx in (-1, 1):
        loop = [knot + across * sx * 0.016 + V(0, 0, 0.008),
                knot + across * sx * 0.04 + out * 0.004 + V(0, 0, 0.024),
                knot + across * sx * 0.06 + out * 0.002 + V(0, 0, 0.012),
                knot + across * sx * 0.056 + V(0, 0, -0.012),
                knot + across * sx * 0.03 - out * 0.002 + V(0, 0, -0.012),
                knot + across * sx * 0.012 + V(0, 0, -0.004)]
        pieces.append(dk.tube(f"{t}-ropeloop{sx}", kit_path(loop, 2),
                              [0.0105] * 11, CORD, n=6, levels=0,
                              caps=("pole", "pole")))
    return pieces, knot


def rope_ends(t, knot):
    """The rope's two ends, hanging down over the front left tassets."""
    pieces = []
    for k, (da, length) in enumerate(((-7, 0.17), (6, 0.13))):
        pts = []
        for j in range(4):
            f = j / 3
            z = lerp(knot.z - 0.012, knot.z - length, f)
            a = KNOT_A + math.radians(da * f)
            # Out over the lames, which step out as they fall.
            p = kusa_pt(a, z, 0.06 + 0.012 * f)
            pts.append(p)
        pts[0] = knot + V(0, 0, -0.01) + (pts[1] - knot) * 0.15
        pieces.append(rope_end(f"{t}-ropeend{k}", pts, 0.0118, CORD))
        tip = pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.012
        pieces.append(dk.ball(f"{t}-ropetassel{k}", 0.0135, tip, CORD,
                              scale=(1, 1, 1.5), seg=8, rings=5))
    return pieces


# ------------------------------------------------------------- banner

POLE = V(-0.085, -0.178, 0.0)
BANNER_TOP, BANNER_BOTTOM, BANNER_W = 1.86, 1.55, 0.15


def banner_mount(t):
    """The sashimono's holders on the back of the dō: a cup at the waist
    and a bracket at the shoulder blades."""
    pieces = [dk.loft(f"{t}-ukezutsu",
                      [dk.hring(z, r, r, 10, cx=POLE.x, cy=POLE.y)
                       for z, r in ((0.655, 0.013), (0.66, 0.016),
                                    (0.71, 0.016), (0.715, 0.013))],
                      IRON, bands={0: GOLD, 2: GOLD}, start="flat",
                      end="flat", levels=0)]
    back = do_pt(-math.pi / 2 - 0.45, 0.975, 0.0)
    pieces.append(dk.tube(f"{t}-gattari",
                          [V(back.x + 0.02, back.y + 0.012, 0.975),
                           V(POLE.x, POLE.y + 0.004, 0.975)],
                          [(0.008, 0.013)] * 2, TEAM2, n=6, levels=0,
                          caps=("flat", "flat"), up=(0, 0, 1)))
    pieces.append(dk.loft(f"{t}-gattari-ring",
                          [dk.hring(z, 0.015, 0.015, 10, cx=POLE.x,
                                    cy=POLE.y)
                           for z in (0.96, 0.99)],
                          GOLD, start="flat", end="flat", levels=0))
    return pieces


def banner(t):
    """The sashimono: a lacquered pole on the back carrying a narrow team
    flag with a cream crest, hung from a crossbar on the pole's left. Its
    own joint (`cape`, pivoting in the bracket) lets it whip and settle;
    the flag ripples (kit.drape on the part)."""
    pieces = [dk.tube(f"{t}-pole", [V(POLE.x, POLE.y, 0.70),
                                    V(POLE.x, POLE.y, BANNER_TOP + 0.03)],
                      [0.0085, 0.0075], IRON, n=8, levels=0,
                      caps=("flat", "flat"))]
    pieces.append(dk.ball(f"{t}-finial", 0.016,
                          V(POLE.x, POLE.y, BANNER_TOP + 0.045), GOLD,
                          scale=(1, 1, 1.5), seg=10, rings=6))
    x0 = POLE.x - 0.009
    pieces.append(dk.tube(f"{t}-crossbar",
                          [V(x0 + 0.004, POLE.y, BANNER_TOP + 0.006),
                           V(x0 - BANNER_W - 0.012, POLE.y,
                             BANNER_TOP + 0.006)],
                          [0.0058, 0.0052], IRON, n=6, levels=0,
                          caps=("flat", "dome")))

    def fl(u, v):
        return V(x0 - u * BANNER_W, POLE.y, lerp(BANNER_TOP, BANNER_BOTTOM, v))

    # Thickness grows forward (+y) from the back face at the pole's line.
    pieces.append(dk.panel(f"{t}-flag", fl, 8, 11, FLAG, 0.006,
                           inside=V(x0 - 0.08, POLE.y + 0.3, 1.5)))
    # The crest, a cream disc on each face, rippling with the flag.
    centre = fl(0.5, 0.45)
    ring = [(x, y) for x, y, _ in dk.sup(14, 0.036, 0.036)]
    for side, y0 in ((-1, POLE.y - 0.0003), (1, POLE.y + 0.0063)):
        disc = dk.slab(f"{t}-crest{side}", ring, 0.0016, CORD)
        dk.transform([disc], dk.basis(V(1, 0, 0), V(0, 0, 1),
                                      V(0, side, 0),
                                      V(centre.x, y0, centre.z)))
        pieces.append(disc)
    return pieces


def banner_free(co):
    """How free each point of the flag is: held along the pole and the
    crossbar, free at the far bottom corner."""
    x0 = POLE.x - 0.009
    across = clamp01((x0 - co.x) / BANNER_W)
    down = clamp01((BANNER_TOP - co.z) / (BANNER_TOP - BANNER_BOTTOM))
    return min(1.0, across ** 0.9 * (0.25 + 0.75 * down ** 0.7) * 1.15)


# ------------------------------------------------------------- tassets

KUSA_BOTTOMS = [0.566, 0.522, 0.478, 0.434]
KUSA_TOP = 0.612
KUSA_RX, KUSA_RY, KUSA_POW = 0.166, 0.136, 2.3


def kusa_pt(a, z, off):
    e = 2.0 / KUSA_POW
    return V((KUSA_RX + off) * spow(math.cos(a), e),
             (KUSA_RY + off) * spow(math.sin(a), e), z)


def tasset(t, name, a0, a1, cols=5, cord_us=None, bottoms=KUSA_BOTTOMS):
    """One kusazuri: five lames hanging from under the belt, each flaring
    out a little further, a gold hem and raised cords down the middle."""
    prof = lame_profile(bottoms, KUSA_TOP, 0.012, 0.0095)
    us = [lerp(a0, a1, i / cols) for i in range(cols + 1)]
    last = len(prof) - 2

    def fn(u, v):
        z, off, _ = prof[int(round(v))]
        # Rounded outer corners so each plate reads as a separate piece.
        edge = min(u - a0, a1 - u) / max(1e-6, (a1 - a0))
        off -= 0.004 * (1 - smooth(edge * 6))
        return kusa_pt(math.radians(u), z, off)

    def faces(i, j):
        kind = prof[j][2]
        if kind == "lip" and j == last:
            return GOLD
        return lame_mat(kind, False, False)

    plate = dk.panel(f"{t}-{name}", fn, us, list(range(len(prof))), TEAM,
                     0.005, faces=faces, inside=V(0, 0, 0.5),
                     rim_mat=GOLD)
    pieces = [plate]
    # Cords: one pair down the middle of each lame.
    if cord_us is None:
        mid = (a0 + a1) / 2
        cord_us = [mid - 2.4, mid + 2.4]
    faces_z = []
    for k, zb in enumerate(bottoms):
        top = KUSA_TOP if k == 0 else bottoms[k - 1]
        faces_z.append((top - 0.004, zb + 0.009))

    def surf(u, z):
        # Walk the profile to the offset at height z.
        best = prof[0][1]
        for (za, oa, _), (zb2, ob, _) in zip(prof, prof[1:]):
            if zb2 <= z <= za and za - zb2 > 1e-6:
                best = lerp(oa, ob, (za - z) / (za - zb2))
                break
        return kusa_pt(math.radians(u), z, best)

    pieces += cords_on(f"{t}-{name}-cord", surf, cord_us, faces_z, 1.15,
                       height=0.0026)
    return pieces


# ------------------------------------------------------------- legs

def leg(t, side, sx):
    hip = V(sx * HIP_X, 0, HIP_Z)
    # A low, wide stance: right foot forward, knees bent.
    if sx > 0:
        knee, ankle = V(0.132, 0.07, 0.345), V(0.152, 0.062, 0.09)
    else:
        knee, ankle = V(-0.13, -0.022, 0.35), V(-0.156, -0.075, 0.09)
    pieces = []

    def along(z):
        """The shin's centre line at height z."""
        return lerp(knee, ankle, clamp01((knee.z - z) / (knee.z - ankle.z)))

    # Hakama: a baggy divided skirt with deep folds, blousing over the
    # knee and gathered into the top of the shin guard.
    path = [lerp(hip, knee, 0.42), lerp(hip, knee, 0.72),
            knee + V(0, 0.006, 0.004), knee + V(sx * 0.004, 0.0, -0.03),
            knee + V(sx * 0.006, -0.002, -0.052)]
    radii = [0.1, 0.116, 0.118, 0.09, 0.06]
    amps = [0.06, 0.13, 0.14, 0.1, 0.0]
    turn = 0.9 if sx > 0 else 0.0

    def wave(i, ang):
        return 1 + amps[i] * math.cos(6 * ang + 0.5 * i + turn)

    pieces.append(dk.tube(f"{t}-hakama{side}", path, radii, HAKAMA, n=12,
                          levels=1, caps=(None, None), wave=wave))

    # Haidate: an apron of small iron plates over the front of the thigh,
    # peeking out under the tassets.
    hprof = lame_profile([0.41, 0.376], 0.46, 0.0, 0.005, lip=0.006,
                         tuck=0.005, slope=0.002)
    hlast = len(hprof) - 2

    def hd(u, v):
        z, off, _ = hprof[int(round(v))]
        c = lerp(hip, knee, clamp01((HIP_Z - z) / (HIP_Z - knee.z)))
        a = math.radians(u)
        r = 0.116 + off
        return V(c.x + math.sin(a) * r, c.y + math.cos(a) * r, z)

    pieces.append(dk.panel(f"{t}-haidate{side}", hd,
                           [-38, -13, 13, 38], list(range(len(hprof))),
                           TEAM2, 0.004,
                           faces=lambda i, j: GOLD if j == hlast else
                           (IRON if hprof[j][2] == "step" else None),
                           inside=lerp(hip, knee, 0.8), rim_mat=GOLD))

    # Suneate: three dark lacquered splints over the shin cloth, gold
    # edged, under a knee plate, tied top and bottom.
    pieces.append(dk.tube(f"{t}-shin{side}",
                          [knee + V(0, 0, -0.035), lerp(knee, ankle, 0.5),
                           ankle + V(0, 0, 0.012)],
                          [0.056, 0.05, 0.043], TABI, n=10, levels=0,
                          caps=(None, None)))
    for k, (a0, a1) in enumerate(((-66, -26), (-19, 19), (26, 66))):
        def sp(u, v, a0=a0, a1=a1):
            z = lerp(0.305, 0.114, v)
            c = along(z)
            a = math.radians(lerp(a0, a1, u))
            r = lerp(0.064, 0.055, v) + 0.005 * math.sin(v * math.pi)
            return V(c.x + math.sin(a) * r, c.y + math.cos(a) * r, z)

        pieces.append(dk.panel(f"{t}-splint{side}{k}", sp, [0.0, 0.5, 1.0],
                               [0.0, 0.07, 0.93, 1.0], TEAM2, 0.005,
                               faces=lambda i, j: GOLD if j in (0, 2)
                               else None,
                               inside=lerp(knee, ankle, 0.5), rim_mat=GOLD))

    def kp(u, v):
        z = lerp(0.352, 0.292, v)
        c = along(z)
        a = math.radians(u)
        r = 0.071 + 0.007 * math.sin(v * math.pi)
        return V(c.x + math.sin(a) * r, c.y + 0.004 + math.cos(a) * r, z)

    pieces.append(dk.panel(f"{t}-kneeplate{side}", kp,
                           [-56, -28, 0, 28, 56], [0.0, 0.14, 0.86, 1.0],
                           TEAM2, 0.005,
                           faces=lambda i, j: GOLD if j in (0, 2) else None,
                           inside=knee + V(0, -0.05, 0), rim_mat=GOLD))
    for z, r in ((0.3, 0.062), (0.12, 0.05)):
        c = along(z)
        pieces.append(dk.loft(f"{t}-tie{side}{z}",
                              [dk.hring(z + dz, r + dr, r + dr, 10,
                                        cx=c.x, cy=c.y)
                               for dz, dr in ((-0.006, 0.0), (0.0, 0.005),
                                              (0.006, 0.0))],
                              CORD, levels=0))

    # Tabi foot on a straw waraji, toes turned out a little.
    turn = math.radians(10 * sx + (0 if sx > 0 else -14))
    fwdv = V(math.sin(turn), math.cos(turn), 0)
    foot_c = V(ankle.x, ankle.y + 0.004, 0.0)
    rings = []
    for yy, rz, rw, zc in ((-0.072, 0.03, 0.036, 0.062),
                           (-0.058, 0.042, 0.046, 0.064),
                           (-0.025, 0.05, 0.05, 0.066),
                           (0.03, 0.043, 0.054, 0.052),
                           (0.085, 0.032, 0.05, 0.04),
                           (0.12, 0.021, 0.043, 0.035),
                           (0.138, 0.011, 0.028, 0.03)):
        ring = []
        for x, z, _ in dk.sup(10, rw, rz, 2.6, math.pi / 10):
            ring.append(V(x, yy, max(zc + z, 0.02)))
        rings.append(ring)
    foot = dk.loft(f"{t}-foot{side}", rings, TABI, start="pole",
                   end="pole", levels=0)
    sole_outline = [(x * (1.0 if y < 0 else 1.06), y)
                    for x, y, _ in dk.sup(14, 0.056, 0.115, 2.3)]
    sole = dk.slab(f"{t}-sole{side}", sole_outline, 0.02, STRAW)
    sole.location = (0, 0.035, 0)
    kit.apply_transform(sole)
    straps = []
    for k, (y0, y1) in enumerate(((0.1, 0.0), (0.05, -0.05))):
        pts = [V(-0.05, y1, 0.022), V(-0.03, lerp(y1, y0, 0.5), 0.07),
               V(0.0, y0, 0.083), V(0.03, lerp(y1, y0, 0.5), 0.07),
               V(0.05, y1, 0.022)]
        straps.append(dk.tube(f"{t}-strap{side}{k}", pts, [0.0055] * 5,
                              STRAW, n=4, levels=0, caps=("pole", "pole")))
    heel = dk.tube(f"{t}-heelcord{side}",
                   [V(-0.045, -0.035, 0.022), V(-0.03, -0.075, 0.05),
                    V(0.0, -0.085, 0.056), V(0.03, -0.075, 0.05),
                    V(0.045, -0.035, 0.022)],
                   [0.0045] * 5, STRAW, n=5, levels=0, caps=("pole", "pole"))
    rot = dk.basis(fwdv.cross(V(0, 0, 1)), fwdv, V(0, 0, 1), foot_c)
    dk.transform([foot, sole, heel] + straps, rot)
    pieces += [foot, sole, heel] + straps

    return pieces, hip


def kusazuri(t, side, sx):
    """One side's tassets, front, side and back: the `skirt` joint over
    that thigh, pivoting under the belt, so they trail the leg and swing
    against the body's moves instead of riding the thigh rigidly."""
    if sx > 0:
        pieces = tasset(t, f"kusaF{side}", 52, 88, cols=3)
        pieces += tasset(t, f"kusaB{side}", 272, 308, cols=3)
        pieces += tasset(t, f"kusaS{side}", -49, 49, cols=4,
                         cord_us=[-22, -17, 17, 22])
    else:
        pieces = tasset(t, f"kusaF{side}", 92, 128, cols=3)
        pieces += tasset(t, f"kusaB{side}", 232, 268, cols=3)
        pieces += tasset(t, f"kusaS{side}", 131, 229, cols=4,
                         cord_us=[158, 163, 197, 202])
    return pieces


# ------------------------------------------------------------- head

FACE = [  # z, half width, half depth (before the features)
    (1.058, 0.03, 0.03), (1.12, 0.076, 0.084), (1.16, 0.083, 0.09),
    (1.17, 0.085, 0.091), (1.178, 0.086, 0.092), (1.187, 0.087, 0.093),
    (1.197, 0.087, 0.093), (1.21, 0.087, 0.093), (1.24, 0.084, 0.089),
    (1.29, 0.045, 0.05)]


def face_warp(a, z):
    """Forward push of the face at angle a (0 = right, 90 = front)."""
    f = math.degrees(a) - 90.0
    while f > 180:
        f -= 360
    while f < -180:
        f += 360
    g = abs(f)
    push = 0.0
    # Brow ridge and a strong nose; eyes set deep under the brow.
    if g < 55:
        w = 1 - g / 55
        push += 0.009 * w * math.exp(-((z - 1.196) / 0.011) ** 2)
    if g < 16:
        w = 1 - g / 16
        push += 0.02 * w * clamp01((1.19 - z) / 0.05) * \
            math.exp(-((z - 1.148) / 0.022) ** 2)
    if 10 < g < 46:
        w = math.sin(math.pi * (g - 10) / 36)
        push -= 0.008 * w * math.exp(-((z - 1.177) / 0.011) ** 2)
    # Cheekbones.
    if 30 < g < 70:
        w = math.sin(math.pi * (g - 30) / 40)
        push += 0.004 * w * math.exp(-((z - 1.155) / 0.015) ** 2)
    return push


def face_pt(a, z, off=0.0):
    for (z0, x0, y0), (z1, x1, y1) in zip(FACE, FACE[1:]):
        if z <= z1:
            k = clamp01((z - z0) / (z1 - z0))
            rx, ry = lerp(x0, x1, k), lerp(y0, y1, k)
            break
    else:
        rx, ry = FACE[-1][1], FACE[-1][2]
    push = face_warp(a, z)
    r = V(math.cos(a) * (rx + off), math.sin(a) * (ry + off), 0)
    n = V(math.cos(a), math.sin(a), 0)
    return V(0, HEAD_CY, z) + r + n * push


def kabuto_visor(t):
    """The brow visor descends away from the gold bowl band with a clear lip."""
    def peak(u, v):
        a = math.radians(90 + u)
        r = lerp(0.136, 0.158, v)
        drop = 0.015 * v * v
        return V(math.cos(a) * r, HEAD_CY + math.sin(a) * r * 0.76,
                 1.228 - drop - 0.004 * (abs(u) / 75) ** 2)

    return dk.panel(f"{t}-peak", peak,
                    [-64 + i * 12.8 for i in range(11)],
                    [0.0, 0.8, 1.0], TEAM2, 0.006,
                    faces=lambda i, j: GOLD if j == 1 else None,
                    inside=V(0, HEAD_CY, 1.4), rim_mat=GOLD)


def head(t):
    """The head, the neck guard (`hat`, a soft joint under the head) and
    the chin cord's knot and ends (`beard`)."""
    pieces = []
    hat = []
    beard = []
    n = 20
    angs = [i / n * math.tau for i in range(n)]
    rings = [[face_pt(a, z) for a in angs] for z, _, _ in FACE]
    pieces.append(dk.loft(f"{t}-face", rings, SKIN, start="pole",
                          end="pole", levels=0))
    pieces.append(dk.tube(f"{t}-neck", [V(0, 0, 0.985), V(0, 0.004, 1.09)],
                          [0.052, 0.05], SLEEVE, n=12, levels=0,
                          caps=("flat", "flat")))
    # Open-faced kabuto: ivory eyes and a determined mouth on visible skin.
    # The old full menpo hid the nose, cheeks and expression from the camera.
    for sx in (-1, 1):
        a = math.radians(90 - sx * 27)
        at = face_pt(a, 1.177, 0.003)
        pieces.append(dk.ball(f"{t}-eye-white{sx}", 0.02, at,
                              "resin:" + kit.tint("samurai-eyewhite", "#fff4de"),
                              scale=(1.1, 0.55, 0.72), seg=12, rings=6))
        pieces.append(dk.ball(f"{t}-pupil{sx}", 0.0098,
                              at + V(-sx * 0.002, 0.009, 0.001), EYE,
                              scale=(0.9, 0.5, 1.0), seg=10, rings=6))
        # Heavy brows knitted into a scowl: low at the nose, high outside.
        brow = [face_pt(math.radians(90 - sx * g), z, 0.005)
                for g, z in ((5, 1.188), (17, 1.198), (31, 1.208),
                             (46, 1.212))]
        pieces.append(dk.tube(f"{t}-brow{sx}", brow,
                              [0.006, 0.0095, 0.009, 0.0045], HAIR, n=6,
                              levels=0, caps=("dome", "pole")))
        # The great moustache: from under the nose, out over the cheeks,
        # its ends swept up (the card's handlebar).
        must = [face_pt(math.radians(90 - sx * g), z, off)
                for g, z, off in ((1, 1.129, 0.013), (14, 1.123, 0.012),
                                  (30, 1.111, 0.011), (46, 1.104, 0.012),
                                  (59, 1.11, 0.016), (66, 1.127, 0.02))]
        pieces.append(dk.tube(f"{t}-moustache{sx}",
                              kit_path(must, 2),
                              [0.0125, 0.0135, 0.0135, 0.012, 0.0105, 0.009,
                               0.0075, 0.0062, 0.005, 0.004, 0.0032],
                              HAIR, n=7, levels=0, caps=("dome", "pole")))
        # The chin cord (shinobi-no-o) from inside the helmet down each
        # cheek to the knot under the chin.
        cord = [face_pt(math.radians(90 - sx * g), z, off)
                for g, z, off in ((74, 1.205, 0.002), (66, 1.16, 0.006),
                                  (52, 1.113, 0.007), (30, 1.078, 0.008))]
        cord.append(V(sx * 0.012, HEAD_CY + 0.074, 1.066))
        pieces.append(dk.tube(f"{t}-chincord{sx}", kit_path(cord, 2),
                              [0.0062] * 9, CORD, n=6, levels=0,
                              caps=("pole", "pole")))
    # A gritted, down-turned mouth under the moustache.
    mouth = [face_pt(math.radians(90 + a), z, 0.003)
             for a, z in ((-17, 1.084), (-8, 1.091), (0, 1.0925),
                           (8, 1.091), (17, 1.084))]
    pieces.append(dk.tube(f"{t}-mouth", mouth, [0.0045, 0.006, 0.0065,
                                                 0.006, 0.0045],
                          EYE, n=6, levels=0, caps=("pole", "pole")))
    # The chin cord's knot and its two short ends: `beard`, so they swing.
    knot = V(0, HEAD_CY + 0.078, 1.064)
    beard.append(dk.ball(f"{t}-chinknot", 0.0135, knot, CORD,
                         scale=(1.25, 0.8, 0.9), seg=10, rings=6))
    for sx in (-1, 1):
        end = [knot + V(sx * 0.006, 0.004, -0.004),
               knot + V(sx * 0.014, 0.014, -0.03),
               knot + V(sx * 0.019, 0.022, -0.06)]
        beard.append(dk.tube(f"{t}-chinend{sx}", end, [0.0062, 0.0058,
                                                        0.0052],
                             CORD, n=6, levels=0, caps=("pole", "pole")))
        beard.append(dk.ball(f"{t}-chintip{sx}", 0.0075,
                             knot + V(sx * 0.02, 0.023, -0.066), CORD,
                             scale=(1, 1, 1.4), seg=6, rings=4))
    # Yodare-kake: two small laced lames hanging under the mask.
    def yk(u, v):
        a = math.radians(90 + u)
        z = lerp(1.068, 1.0, v)
        r = lerp(0.079, 0.108, v)
        return V(math.cos(a) * r, HEAD_CY + 0.004 + math.sin(a) * r * 0.95, z)

    pieces.append(dk.panel(f"{t}-yodare", yk, [-62, -31, 0, 31, 62],
                           [0.0, 0.42, 0.5, 0.52, 0.9, 1.0], TEAM, 0.004,
                           faces=lambda i, j: GOLD if j == 4 else
                           (TEAM2 if j in (1, 2) else None),
                           inside=V(0, 0, 1.03), rim_mat=TEAM2))

    # Kabuto: a ribbed bowl with a gold band and finial.
    cy = HEAD_CY
    bowl = [(0.138, 1.214), (0.141, 1.226), (0.142, 1.244), (0.139, 1.268),
            (0.129, 1.292), (0.112, 1.315), (0.088, 1.333), (0.058, 1.345),
            (0.024, 1.35)]
    rings = []
    nb = 36
    for r, z in bowl:
        ring = []
        for i in range(nb):
            a = i / nb * math.tau
            k = 1.0 if (i % 2 == 0 or z < 1.236 or r < 0.03) else 0.962
            ring.append(V(math.cos(a) * r * k, cy + math.sin(a) * r * k * (0.80 if math.sin(a) > 0 else 1), z))
        rings.append(ring)
    pieces.append(dk.loft(f"{t}-bowl", rings, TEAM2,
                          bands={0: GOLD, 1: GOLD}, start="flat", end="flat",
                          levels=0))
    pieces.append(dk.loft(f"{t}-tehen",
                          [dk.hring(z, r, r, 10, cy=cy) for z, r in
                           ((1.345, 0.03), (1.354, 0.031), (1.358, 0.022),
                            (1.352, 0.014))],
                          GOLD, start="flat", end="flat", levels=0))

    # The visor (mabizashi) over the brow.
    pieces.append(kabuto_visor(t))

    # Shikoro: four lames flaring from under the bowl, close at the sides
    # (the raised arms pass there) and wide at the back.
    sk_bottoms = [1.178, 1.14, 1.103, 1.066]
    prof = lame_profile(sk_bottoms, 1.222, 0.0, 0.0, lip=0.008,
                        tuck=0.006)
    last = len(prof) - 2

    def shik_pt(a, z, off):
        back = max(0.0, -math.sin(a))
        flare = (1.222 - z) / (1.222 - sk_bottoms[-1]) * \
            (0.024 + 0.044 * back ** 1.3)
        r = 0.141 + off + flare
        return V(math.cos(a) * r, cy - 0.004 + math.sin(a) * r, z)

    def shik(u, v):
        z, off, _ = prof[int(round(v))]
        return shik_pt(math.radians(u), z, off)

    us = [lerp(28, 152 - 360, i / 10) for i in range(11)]
    hat.append(dk.panel(f"{t}-shikoro", shik, us, list(range(len(prof))),
                           TEAM, 0.005,
                           faces=lambda i, j: GOLD if (prof[j][2] == "lip"
                                                       and j == last)
                           else lame_mat(prof[j][2], False, False),
                           inside=V(0, cy, 1.15), rim_mat=TEAM2))
    # Cords down the shikoro.
    faces_z = []
    for k, zb in enumerate(sk_bottoms):
        top = 1.222 if k == 0 else sk_bottoms[k - 1]
        faces_z.append((top - 0.004, zb + 0.008))

    def ssurf(u, z):
        best = prof[0][1]
        for (za, oa, _), (zb2, ob, _) in zip(prof, prof[1:]):
            if zb2 <= z <= za and za - zb2 > 1e-6:
                best = lerp(oa, ob, (za - z) / (za - zb2))
                break
        return shik_pt(math.radians(u), z, best + 0.0005)

    hat += cords_on(f"{t}-shcord", ssurf,
                       [-20, -55, -90, -125, -160],
                       faces_z, 1.6, height=0.0024,
                       inside=lambda c: V(0, cy, c.z))

    # Fukigaeshi: the top lame turned back beside the face, gold edged,
    # each with a small gold crest.
    for sx in (-1, 1):
        a0 = math.radians(90 - sx * 62)
        base = V(math.cos(a0) * 0.141, cy + math.sin(a0) * 0.141, 0)
        outv = V(sx * 0.45, 1, 0).normalized()

        def fk(u, v, base=base, outv=outv):
            z = lerp(1.222, 1.16, v)
            w = lerp(0.034, 0.028, v)
            p = base + outv * (u * w)
            p.x -= sx * 0.004 * u
            return V(p.x, p.y, z - 0.004 * u)

        pieces.append(dk.panel(f"{t}-fuki{sx}", fk, [0.0, 0.7, 1.0],
                               [0.0, 0.85, 1.0], TEAM, 0.005,
                               faces=lambda i, j: GOLD if (i == 1 or j == 1)
                               else None,
                               inside=V(0, cy - 0.3, 1.19), rim_mat=GOLD))
        c = fk(0.38, 0.45)
        nrm = V(-sx * 1.0, 0.45, 0).normalized()
        nrm = V(0, 1, 0) - outv * outv.dot(V(0, 1, 0))
        m = dk.look(nrm, (0, 0, 1), c + nrm.normalized() * 0.0005)
        mon = [(x, y) for x, y, _ in dk.sup(8, 0.011, 0.011)]
        pieces.append(dk.slab(f"{t}-mon{sx}", mon, 0.003, GOLD, matrix=m))

    # Kuwagata: a broad gilt U standing from a holder above the visor,
    # opening wide so the raised fists pass between its arms, and a domed
    # gold disc (maedate) at its foot, as on the card.
    tilt = math.radians(8)
    up = V(0, math.sin(tilt), math.cos(tilt))
    fwdv = V(0, math.cos(tilt), -math.sin(tilt))
    # Seat the horn holder on the crown, clear of the elevated face sightline.
    origin = V(0, cy + 0.102, 1.28)
    hm = dk.basis(V(1, 0, 0), up, fwdv, origin)
    for sx in (-1, 1):
        centre = [(0.04, 0.016), (0.07, 0.036), (0.096, 0.07),
                  (0.114, 0.116), (0.126, 0.168), (0.137, 0.22),
                  (0.15, 0.262), (0.17, 0.293), (0.194, 0.31)]
        widths = [0.064, 0.066, 0.062, 0.056, 0.05, 0.043, 0.034, 0.022, 0.0]
        left, right = [], []
        for k, ((x, y), w) in enumerate(zip(centre, widths)):
            a = centre[max(0, k - 1)]
            b = centre[min(len(centre) - 1, k + 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]
            L = math.hypot(tx, ty)
            nx, ny = -ty / L, tx / L
            left.append((sx * (x + nx * w / 2), y + ny * w / 2))
            right.append((sx * (x - nx * w / 2), y - ny * w / 2))
        outline = right + list(reversed(left[:-1]))
        if sx < 0:
            outline = list(reversed(outline))
        pieces.append(dk.slab(f"{t}-horn{sx}", outline, 0.009, GOLD,
                              bevel=0.003, matrix=hm))
    holder = [(x, y) for x, y, _ in dk.sup(16, 0.07, 0.026, 3.2)]
    pieces.append(dk.slab(f"{t}-horndai", holder, 0.011, GOLD,
                          matrix=dk.basis(V(1, 0, 0), up, fwdv,
                                          origin + V(0, -0.009, 0.004))))
    disc = origin + up * 0.042 + fwdv * 0.012
    pieces.append(dk.ball(f"{t}-maedate", 0.031, disc, GOLD,
                          scale=(1, 0.42, 1), seg=16, rings=8))
    return pieces, hat, beard


# ------------------------------------------------------------- arms

def sode(t, sx):
    """A great shoulder guard: an iron top plate and five laced lames,
    hanging outside the upper arm and flaring as they fall."""
    bottoms = [1.034, 0.978, 0.922, 0.866, 0.81]
    prof = lame_profile(bottoms, 1.082, 0.0, 0.011, lip=0.01, tuck=0.008)
    last = len(prof) - 2
    x0 = sx * 0.258

    def pt(u, z, off):
        y = u * 0.112 - 0.004
        bulge = 0.032 * (1 - u * u)
        return V(x0 + sx * (bulge + off), y, z)

    def fn(u, v):
        z, off, _ = prof[int(round(v))]
        return pt(u, z, off)

    def faces(i, j):
        kind = prof[j][2]
        if j <= 1 and kind in ("face", "lip"):
            return IRON if kind == "face" else GOLD
        if kind == "lip" and j == last:
            return GOLD
        return lame_mat(kind, False, False)

    us = [-1, -0.6, -0.2, 0.2, 0.6, 1]
    plate = dk.panel(f"{t}-sode{sx}", fn, us, list(range(len(prof))), TEAM,
                     0.006, faces=faces,
                     inside=V(sx * 0.2, 0, 0.95), rim_mat=GOLD)
    faces_z = []
    for k, zb in enumerate(bottoms[1:], start=1):
        faces_z.append((bottoms[k - 1] - 0.004, zb + 0.009))

    def surf(u, z):
        best = prof[0][1]
        for (za, oa, _), (zb2, ob, _) in zip(prof, prof[1:]):
            if zb2 <= z <= za and za - zb2 > 1e-6:
                best = lerp(oa, ob, (za - z) / (za - zb2))
                break
        return pt(u, z, best + 0.0006)

    cords = cords_on(f"{t}-sodecord{sx}", surf, [-0.52, 0.0, 0.52],
                     faces_z, 0.035, height=0.0026,
                     inside=lambda c: V(sx * 0.2, 0, c.z))
    return [plate] + cords


def fist(t, name, hand, forearm, sx):
    """A big fist closed round the grip (axis D): the back of the hand
    under an iron tekko, four fingers curled round the hilt and the thumb
    over them."""
    kn = forearm - D * forearm.dot(D)
    kn.normalize()
    b = D.cross(kn)
    if b.z < 0:
        b = -b
    pieces = []
    m = dk.basis(b, kn, D, hand)
    # Back of the hand and palm (a rounded block over the grip).
    block = dk.cube_ball(f"{t}-{name}-palm", (0.036, 0.07, 0.078),
                         (0.016, -0.008, 0.0), SKIN, levels=1, crease=0.4)
    dk.transform([block], m)
    pieces.append(block)
    # Fingers: arcs round the grip from the knuckles, index at the guard.
    for k, (dz, r) in enumerate(((0.027, 0.0098), (0.009, 0.0104),
                                 (-0.009, 0.0102), (-0.026, 0.009))):
        pts = []
        for ang in (66, 14, -42, -98, -146):
            a = math.radians(ang)
            rr = 0.03 if ang > -120 else 0.027
            pts.append(hand + kn * (math.cos(a) * rr) + b * (math.sin(a) * rr)
                       + D * dz)
        pieces.append(dk.tube(f"{t}-{name}-f{k}", pts, [r] * len(pts), SKIN,
                              n=6, levels=0, caps=("pole", "dome")))
    # The thumb, from the heel of the hand over the index finger.
    th = [hand - kn * 0.03 + b * 0.02 + D * 0.03,
          hand - kn * 0.034 - b * 0.006 + D * 0.038,
          hand - kn * 0.012 - b * 0.03 + D * 0.034]
    pieces.append(dk.tube(f"{t}-{name}-thumb", th, [0.012, 0.011, 0.01],
                          SKIN, n=6, levels=0, caps=("dome", "dome")))
    # Tekko: an iron plate over the back of the hand, gold edged.
    tk = [(-0.03, -0.024), (0.012, -0.032), (0.028, -0.026), (0.032, 0.0),
          (0.028, 0.026), (0.012, 0.032), (-0.03, 0.024)]
    mt = dk.basis(kn, D, b, hand + b * 0.033 - kn * 0.012)
    pieces.append(dk.slab(f"{t}-{name}-tekko", tk, 0.006, IRON,
                          side_mat=GOLD, matrix=mt))
    return pieces, kn


def arm(t, side, sx, hand, pole):
    s = V(sx * SH_X, 0, SH_Z)
    e0 = dk.ik(s, hand, UPPER, FORE + 0.05, pole)
    fist_pieces, kn = fist(t, f"fist{side}", hand, hand - e0, sx)
    # Big cartoon fists that read on the hilt from the game camera.
    dk.scale_about(fist_pieces, hand, 1.13)
    w = hand - kn * 0.046
    e = dk.ik(s, w, UPPER, FORE, pole)
    pieces = list(fist_pieces)
    # Shoulder and upper sleeve: loose cloth with a few folds.
    pieces.append(dk.ball(f"{t}-shoulder{side}", 0.062, s, KOTE, seg=12,
                          rings=7))

    def wave(i, ang):
        return 1 + [0.0, 0.07, 0.06, 0.0][i] * math.cos(5 * ang + 1.3 * i)

    upper = [s, lerp(s, e, 0.4), lerp(s, e, 0.8), e]
    pieces.append(dk.tube(f"{t}-upper{side}", upper,
                          [0.06, 0.057, 0.051, 0.046], KOTE, n=10,
                          levels=1, caps=(None, "dome"), wave=wave))
    # Elbow cop.
    outward = ((e - s).normalized() - (w - e).normalized()).normalized()
    pieces.append(dk.ball(f"{t}-elbow{side}", 0.034,
                          e + outward * 0.03, IRON, scale=(1, 1, 1), seg=10,
                          rings=6))
    # Forearm: the kote's cloth with three iron splints and a gold cuff.
    fore = [e, lerp(e, w, 0.5), w]
    pieces.append(dk.tube(f"{t}-fore{side}", fore, [0.05, 0.048, 0.039],
                          KOTE, n=10, levels=0, caps=("dome", None)))
    fdir = (w - e).normalized()
    top = V(0, 0, 1) - fdir * fdir.z
    top = (top + V(sx * 0.6, 0, 0)).normalized()
    top = (top - fdir * top.dot(fdir)).normalized()
    across = fdir.cross(top)
    for k, ang in enumerate((-44, 0, 44)):
        a = math.radians(ang)
        nrm = top * math.cos(a) + across * math.sin(a)
        tang = top * -math.sin(a) + across * math.cos(a)

        def sp(u, v, nrm=nrm, tang=tang):
            c = lerp(e, w, lerp(0.16, 0.88, v))
            r = lerp(0.053, 0.043, v)
            wid = lerp(0.025, 0.02, v)
            return c + nrm * r + tang * (u - 0.5) * wid

        pieces.append(dk.panel(f"{t}-kote{side}{k}", sp, [0.0, 0.5, 1.0],
                               [0.0, 1.0], IRON, 0.004,
                               inside=lerp(e, w, 0.5), rim_mat=GOLD))
    pieces.append(dk.tube(f"{t}-cuff{side}", [w - fdir * 0.012,
                                               w + fdir * 0.004],
                          [0.046, 0.045], GOLD, n=12, levels=0,
                          caps=(None, None)))
    # The sode hang from the shoulder on their own joint (`sleeve`).
    return pieces, s, sode(t, sx)


# ------------------------------------------------------------- katana

def katana(t):
    """Built along +z from the guard with the edge along +x, then aimed
    down D with the edge underneath."""
    pieces = []
    w, th = 0.034, 0.0072
    sori = 0.026
    tip = BLADE + 0.022
    zs = [0.022, 0.12, 0.25, 0.38, 0.5, 0.58, 0.61, 0.635, 0.655, 0.668]
    rings = []
    for z in zs:
        k = (z - 0.022) / (tip - 0.022)
        bend = -sori * k * k
        ww = w * (1 - 0.22 * k)
        if z > 0.6:
            q = clamp01((z - 0.6) / (tip - 0.6))
            edge = ww * math.sqrt(max(0.0, 1 - q * q))
        else:
            edge = ww
        back = -ww * 0.45
        ring = [V(back + edge + bend, 0, z),                 # edge
                V(back + edge * 0.62 + bend, th * 0.72, z),  # hamon line
                V(back + edge * 0.34 + bend, th, z),         # shinogi
                V(back + 0.003 + bend, th * 0.62, z),
                V(back + bend, 0, z),                        # mune
                V(back + 0.003 + bend, -th * 0.62, z),
                V(back + edge * 0.34 + bend, -th, z),
                V(back + edge * 0.62 + bend, -th * 0.72, z)]
        rings.append(ring)
    tipv = V(-w * 0.78 * 0.45 - sori, 0, tip)

    c = dk.Cage(f"{t}-blade", STEEL)
    vr = [c.ring(r) for r in rings]
    for j in range(len(vr) - 1):
        a, b = vr[j], vr[j + 1]
        for i in range(8):
            k = (i + 1) % 8
            f = c.bm.faces.new((a[i], a[k], b[k], b[i]))
            f.material_index = c.m(HAMON if i in (0, 7) else STEEL)
    c.ngon(vr[0], STEEL, end=False)
    tv = c.bm.verts.new(tipv)
    for i in range(8):
        k = (i + 1) % 8
        f = c.bm.faces.new((vr[-1][i], vr[-1][k], tv))
        f.material_index = c.m(HAMON if i in (0, 7) else STEEL)
    pieces.append(c.obj(levels=0, recalc=True))
    # Collar (habaki), guard (tsuba) and spacers.
    pieces.append(dk.loft(f"{t}-habaki",
                          [dk.hring(z, 0.019, 0.0105, 10, cx=0.001,
                                    power=2.6)
                           for z in (0.004, 0.034)],
                          GOLD, start="flat", end="flat", levels=0))
    guard = [(x, y) for x, y, _ in dk.sup(20, 0.036, 0.033, 2.2)]
    pieces.append(dk.slab(f"{t}-tsuba", guard, 0.006, GOLD,
                          matrix=dk.basis(V(1, 0, 0), V(0, 1, 0),
                                          V(0, 0, 1), V(0, 0, -0.004))))
    # The hilt (tsuka): dark silk wrapped in diamonds over pale ray skin.
    nseg = 8
    hz = [-0.012 - i * 0.0195 for i in range(9)]
    cg = dk.Cage(f"{t}-tsuka", ITO)
    vr = []
    for j, z in enumerate(hz):
        phase = (j % 2) * math.pi / nseg
        taper = 1.0 - 0.06 * math.sin(math.pi * j / (len(hz) - 1))
        vr.append(cg.ring([V(x, y, z) for x, y, _ in
                           dk.sup(nseg, 0.0175 * taper, 0.0138 * taper, 2.0,
                                  phase)]))
    for j in range(len(vr) - 1):
        a, b = vr[j], vr[j + 1]
        for i in range(nseg):
            k = (i + 1) % nseg
            f = cg.bm.faces.new((b[i], b[k], a[k], a[i]))
            f.material_index = cg.m(SAME if (i + j) % 2 == 0 else ITO)
    cg.ngon(vr[0], ITO, end=True)
    cg.ngon(vr[-1], ITO, end=False)
    pieces.append(cg.obj(levels=0, recalc=True))
    pieces.append(dk.loft(f"{t}-fuchi",
                          [dk.hring(z, 0.0195, 0.0158, 12)
                           for z in (-0.004, -0.018)],
                          GOLD, start="flat", end="flat", levels=0))
    pieces.append(dk.loft(f"{t}-kashira",
                          [dk.hring(z, rx, rx * 0.8, 12, power=2.2)
                           for z, rx in ((hz[-1] + 0.004, 0.0195),
                                         (hz[-1] - 0.008, 0.02),
                                         (hz[-1] - 0.016, 0.017),
                                         (hz[-1] - 0.02, 0.009))],
                          GOLD, start="flat", end="pole", levels=0))
    return pieces


def scabbards(t):
    """The empty katana saya and the wakizashi through the belt on the
    left hip."""
    pieces = []

    def saya(name, p0, p1, length, r, mouth=True, hilt=None):
        d = (p1 - p0).normalized()
        path = [p0 + d * (length * k / 6) + V(0, 0, 0.012 * math.sin(
            math.pi * k / 6)) for k in range(7)]
        pieces.append(dk.tube(f"{t}-{name}", path, [r] * 7, SAYA, n=8,
                              up=(0, 0, 1), levels=0,
                              caps=("flat", "flat"),
                              bands={0: GOLD, 5: GOLD}))
        if hilt:
            L, tr = hilt
            hp = [p0 - d * 0.008, p0 - d * L]
            pieces.append(dk.tube(f"{t}-{name}-tsuka", hp,
                                  [(r * 1.0, r * 0.8)] * 2, ITO, n=8,
                                  levels=0, caps=("flat", "dome")))
            m = dk.look(d, (0, 0, 1), p0 - d * 0.004)
            g = [(x, y) for x, y, _ in dk.sup(14, tr, tr * 0.9, 2.2)]
            pieces.append(dk.slab(f"{t}-{name}-tsuba", g, 0.005, GOLD,
                                  matrix=m))
        else:
            # The empty mouth, a dark ring facing up and forward.
            m = dk.look(-d, (0, 0, 1), p0 - d * 0.002)
            ring = [(x, y) for x, y, _ in dk.sup(10, r * 0.8, r * 0.55)]
            pieces.append(dk.slab(f"{t}-{name}-mouth", ring, 0.002, EYE,
                                  matrix=m))

    saya("saya", V(-0.175, 0.17, 0.655), V(-0.27, -0.4, 0.43), 0.6, 0.0155)
    saya("waki", V(-0.19, 0.12, 0.64), V(-0.245, -0.25, 0.49), 0.4, 0.014,
         hilt=(0.11, 0.024))
    # The sageo cord knotted at the belt.
    pieces.append(dk.tube(f"{t}-sageo",
                          kit_path([V(-0.19, 0.13, 0.64),
                                    V(-0.205, 0.08, 0.6),
                                    V(-0.2, 0.03, 0.62),
                                    V(-0.19, 0.0, 0.63)], 2),
                          [0.004] * 7, CORD, n=5, levels=0,
                          caps=("pole", "pole")))
    return pieces


# ------------------------------------------------------------- build

def build_original(root_name="duelist"):
    t = root_name
    root = kit.empty(t)

    for side, sx in (("L", -1), ("R", 1)):
        pieces, hip = leg(t, side, sx)
        dk.part(t, f"leg{side}", pieces, hip, root)

    belt, knot = rope_belt(t)
    torso = cuirass(t) + upper_body(t) + agemaki(t) + obi(t) + belt
    torso += banner_mount(t) + scabbards(t)
    torso_obj = dk.part(t, "torso", torso, WAIST, root)
    for side, sx in (("L", -1), ("R", 1)):
        dk.part(t, f"skirt{side}", kusazuri(t, side, sx),
                V(sx * 0.085, 0, 0.62), torso_obj)
    dk.part(t, "tail", rope_ends(t, knot), knot, torso_obj)
    pivot = V(POLE.x, POLE.y, 0.975)
    flag = dk.part(t, "cape", banner(t), pivot, torso_obj)
    kit.drape(flag, free=lambda co: banner_free(co + pivot))

    face, hat, beard = head(t)
    head_obj = face_rig.head(dk.part, t, face, NECK, torso_obj)
    dk.part(t, "hat", hat, V(0, HEAD_CY, 1.225), head_obj)
    dk.part(t, "beard", beard, V(0, HEAD_CY + 0.078, 1.064), head_obj)

    arm_r, s_r, sode_r = arm(t, "R", 1, HAND_R, V(0.55, 0.0, 0.62))
    arm_r_obj = dk.part(t, "armR", arm_r, s_r, torso_obj)
    dk.part(t, "sleeveR", sode_r, V(0.255, -0.004, 1.08), arm_r_obj)
    # Edge down, rolled a little outward so the flat of the blade catches
    # the high game camera.
    edge = V(0, 0, -1) + D * D.z
    edge.normalize()
    flat = D.cross(edge)
    roll = math.radians(ROLL)
    edge = edge * math.cos(roll) + flat * math.sin(roll)
    m = dk.basis(edge, D.cross(edge), D, HAND_R + D * 0.047)
    blade = katana(t)
    dk.transform(blade, m)
    dk.part(t, "weapon", blade, GRIP, arm_r_obj)

    arm_l, s_l, sode_l = arm(t, "L", -1, HAND_L, V(-0.55, 0.0, 0.62))
    arm_l_obj = dk.part(t, "armL", arm_l, s_l, torso_obj)
    dk.part(t, "sleeveL", sode_l, V(-0.255, -0.004, 1.08), arm_l_obj)

    if os.environ.get("DUELIST_REPORT"):
        for o in kit.descendants(root):
            if o.type == "MESH":
                loc = o.matrix_world.translation
                print(f"DUELIST {o.name:16s} ({loc.x:.3f}, {loc.y:.3f}, "
                      f"{loc.z:.3f}) tris {dk.tris(o)} uv "
                      f"{len(o.data.uv_layers)}")
    pose = os.environ.get("DUELIST_POSE")
    if pose in POSES:
        dk.pose_root(root, t, POSES[pose])
    return root


# Poses in three.js Euler terms (x, y about the vertical, z), as troops.ts
# and moves/duelist.ts set them (a torso's x there is its negated bend),
# for checking clearances in Blender: DUELIST_POSE=jodan.
POSES = {
    # The top of the big cut's wind-up: the blade over the back.
    "jodan": {"armL": (2.3, 0, 0), "armR": (2.3, 0, 0), "weapon": (0.3, 0, 0),
              "torso": (0.16, -0.3, 0.05), "head": (0.08, 0.25, 0),
              "sleeveL": (-1.47, 0, -0.34), "sleeveR": (-1.47, 0, 0.34)},
    # The cut's follow-through, low in front.
    "cut": {"armL": (-0.4, 0, 0), "armR": (-0.4, 0, 0), "weapon": (0.3, 0, 0),
            "torso": (-0.36, 0.3, -0.2), "head": (-0.2, -0.25, 0),
            "skirtL": (0.3, 0, 0), "skirtR": (0.3, 0, 0)},
    # The level sweep's coil to the right.
    "coil": {"armL": (-0.15, 0, 0), "armR": (-0.15, 0, 0),
             "weapon": (-0.6, 0, 0), "torso": (0.0, -0.9, 0),
             "head": (0, 0.8, 0)},
}


def build(root_name="duelist"):
    """Quality-first Samurai source, or its independently reviewed runtime copy.

    The historical source remains above as build_original(). The bespoke
    sculpt retains native pivots and the shared two-hand katana contract.
    """
    import figure_duelist_sculpt as sculpt
    root = sculpt.build_master(root_name)
    if os.environ.get("DUELIST_MASTER") != "1":
        import figure_duelist_runtime as runtime
        root = runtime.reduce_runtime(root)
    return root


def finish_ao(root):
    import figure_duelist_sculpt as sculpt
    sculpt.finish_ao(root)
