"""The Samurai (card id `duelist`): a samurai action figure in lacquered
team armour laced with cream cord, a kabuto with a gold crescent crest and a
dark face mask, and a long katana with a chrome blade and a wrapped hilt,
held two-handed in a ready stance.

Limbs, hands and face are subdivided cages; the armour lames, blade, crest
and fittings are crisp hard pieces (see figures_b.py). Both shoulders sit on
one line along x, so turning both arms by the same angle about x keeps the
left hand on the hilt through the whole overhead cleave.
"""

import math

import kit
import figures_b as fb
from figures_b import V, lerp, spow

TEAM = "plastic:team"
TEAM2 = "plastic:team2"
CORD = "plastic:" + kit.tint("duelist-cord", "#efe3c2")
GOLD = "plastic:" + kit.tint("duelist-gold", "#e7b03c")
LACQUER = "plastic:" + kit.tint("duelist-lacquer", "#25232d")
MASK = "plastic:" + kit.tint("duelist-mask", "#35313e")
HAIR = "plastic:" + kit.tint("duelist-hair", "#f3efe6")
SKIN = "vinyl:" + kit.tint("duelist-skin", "#f1c39d")
STEEL = "chrome:" + kit.tint("duelist-steel", "#e4e9ef")
STRAW = "plastic:" + kit.tint("duelist-straw", "#d7b271")
WHITE = "plain:white"
BLACK = "plain:black"

HIP_Z = 0.58
HIP_X = 0.095
WAIST = V(0, 0, 0.62)
SH_X, SH_Z = 0.215, 0.975
NECK = V(0, 0, 1.05)
UPPER, FORE = 0.2, 0.2
# The katana: the right fist closes under the guard, the left one below it,
# and the blade rises up and out to the right.
D = V(0.55, 0.3, 0.78).normalized()
HAND_R = V(0.06, 0.24, 0.77)
HAND_L = HAND_R - D * 0.104
BLADE = 0.72
POW = 2.4          # squareness of the armour's cross-section
CY = 0.014         # the head's centre line sits a little forward

# The cuirass (do): (z, half width, half depth). Narrow waist, broad chest.
DO = [(0.60, 0.15, 0.117), (0.66, 0.151, 0.118), (0.74, 0.162, 0.125),
      (0.82, 0.182, 0.135), (0.89, 0.2, 0.142), (0.945, 0.206, 0.142),
      (0.99, 0.195, 0.13), (1.03, 0.115, 0.085)]


def clamp01(t):
    return max(0.0, min(1.0, t))


def do_r(z):
    for (z0, x0, y0), (z1, x1, y1) in zip(DO, DO[1:]):
        if z <= z1:
            t = clamp01((z - z0) / (z1 - z0))
            return lerp(x0, x1, t), lerp(y0, y1, t)
    return DO[-1][1], DO[-1][2]


def sp(a, rx, ry, p=POW):
    e = 2.0 / p
    return rx * spow(math.cos(a), e), ry * spow(math.sin(a), e)


def adist(a, b):
    d = (a - b) % 360
    return min(d, 360 - d)


def columns(base_n, cords, half):
    """Angles (degrees) round a body: an even spread plus two edges per
    cord; returns the angles and which intervals are cords."""
    edges = []
    for c in cords:
        edges += [(c - half) % 360, (c + half) % 360]
    base = [i * 360 / base_n for i in range(base_n)]
    base = [b for b in base if all(adist(b, e) > half * 1.6 for e in edges)]
    angs = sorted(set(round(a, 5) for a in base + edges))
    cord = []
    for i, a in enumerate(angs):
        b = angs[(i + 1) % len(angs)]
        mid = (a + ((b - a) % 360) / 2) % 360
        cord.append(any(adist(mid, c) < half for c in cords))
    return angs, cord


def cuirass(t):
    """The do: three laced lames under a smooth chest plate with a gold
    rim, as one crisp hard-surface shell."""
    cords = [90 - 26, 90 + 26, 90 - 64, 90 + 64,
             270 - 26, 270 + 26, 270 - 64, 270 + 64]
    angs, is_cord = columns(12, cords, 3.4)
    # (z, offset out, kind of the band above this ring)
    rings = [(0.625, -0.016, "lame")]
    for zb, zt in ((0.635, 0.71), (0.71, 0.78), (0.78, 0.85)):
        rings += [(zb + 0.003, 0.019, "lame"), (zt - 0.002, 0.004, "lame")]
    rings += [(0.855, 0.018, "chest"), (0.93, 0.016, "chest"),
              (0.972, 0.009, "gold"), (0.99, 0.004, "chest"),
              (1.03, 0.0, "chest")]
    c = fb.Cage(f"{t}-do", TEAM)
    vrings = []
    for z, off, kind in rings:
        rx, ry = do_r(z)
        pts = []
        for k, a in enumerate(angs):
            lift = 0.0
            if kind == "lame" and (is_cord[k] or is_cord[k - 1]):
                lift = 0.0035
            x, y = sp(math.radians(a), rx + off + lift, ry + off + lift)
            # A gentle chest swell at the front of the breastplate.
            if 0.86 < z < 1.0 and y > 0:
                y += 0.012 * math.sin(math.pi * (z - 0.86) / 0.14) * \
                    max(0.0, math.sin(math.radians(a))) ** 2
            pts.append(V(x, y, z))
        vrings.append(c.ring(pts))
    n = len(angs)
    for r in range(len(vrings) - 1):
        kind = rings[r][2]
        a, b = vrings[r], vrings[r + 1]
        for i in range(n):
            j = (i + 1) % n
            f = c.bm.faces.new((a[i], a[j], b[j], b[i]))
            mat = TEAM
            if kind == "gold":
                mat = GOLD
            elif kind == "lame" and is_cord[i] and r > 0:
                mat = CORD
            f.material_index = c.m(mat)
    c.fan(vrings[0], V(0, 0, 0.62), TEAM2, end=False)
    c.fan(vrings[-1], V(0, 0, 1.04), TEAM2, end=True)
    return c.obj(levels=0)


def agemaki(t):
    """The cord bow on the back plate: two loops, a knot, two tails."""
    y0 = -do_r(0.9)[1] - 0.016
    at = V(0, y0, 0.9)
    pieces = [fb.ball(f"{t}-knot", 0.019, at, CORD, scale=(1, 0.7, 1),
                      seg=6, rings=5)]
    for sx in (-1, 1):
        loop = [at + V(sx * 0.012, 0, 0.004), at + V(sx * 0.045, -0.006, 0.03),
                at + V(sx * 0.075, -0.004, 0.022),
                at + V(sx * 0.07, -0.002, -0.006),
                at + V(sx * 0.03, -0.004, -0.008), at + V(sx * 0.01, 0, -0.002)]
        pieces.append(fb.tube(f"{t}-loop{sx}", loop, [0.0085] * len(loop),
                              CORD, n=5, levels=0, up=(0, -1, 0),
                              caps=("pole", "pole")))
        tail = [at + V(sx * 0.006, 0.002, -0.01),
                at + V(sx * 0.022, -0.004, -0.06),
                at + V(sx * 0.03, 0.0, -0.11)]
        pieces.append(fb.tube(f"{t}-tail{sx}", tail, [0.009, 0.0085, 0.008],
                              CORD, n=6, levels=0, up=(0, -1, 0),
                              caps=("pole", "pole")))
        pieces.append(fb.ball(f"{t}-tassel{sx}", 0.014,
                              at + V(sx * 0.031, 0.0, -0.118), CORD,
                              scale=(1, 1, 1.4), seg=6, rings=4))
    return pieces


def fb_smooth(pts, samples):
    return [V(p) for p in kit.smooth_path(pts, samples)]


def kusazuri(t, centre, span=27.0):
    """One skirt tasset: three flaring lames with a cream cord down the
    middle and a gold edge, hanging from under the cuirass."""
    half = 3.6
    us = [centre - span, centre - half, centre + half, centre + span]
    prof = [(0.655, 0.0), (0.592, 0.026), (0.588, 0.018), (0.524, 0.046),
            (0.52, 0.038), (0.46, 0.066), (0.452, 0.066)]
    rx0, ry0 = do_r(0.62)

    def fn(u, v):
        z, off = prof[int(round(v))]
        lift = 0.003 if abs(u - centre) < half + 0.01 else 0.0
        x, y = sp(math.radians(u), rx0 + off + lift, ry0 + off + lift)
        return V(x, y, z)

    def faces(i, j):
        if j == len(prof) - 2:
            return GOLD
        if i == 1:
            return CORD
        return None

    return fb.panel(f"{t}-kusazuri{int(centre)}", fn, us,
                    list(range(len(prof))), TEAM, 0.012, bevel=0.0,
                    faces=faces, inside=V(0, 0, 0.55))


def sode(t, sx):
    """A big laced shoulder plate hanging outside the upper arm."""
    s = V(sx * SH_X, 0, SH_Z)
    prof = [(0.072, 0.066), (0.048, 0.07), (0.044, 0.066), (-0.018, 0.08),
            (-0.022, 0.073), (-0.082, 0.088), (-0.086, 0.081),
            (-0.146, 0.097), (-0.153, 0.097)]
    us = [-0.095, -0.031, -0.021, 0.021, 0.031, 0.095]
    cord_cols = (1, 3)

    def fn(u, v):
        j = int(round(v))
        z, out = prof[j]
        i = us.index(u)
        lift = 0.003 if (i in (1, 2, 3, 4)) and 2 <= j < len(prof) - 1 \
            else 0.0
        if i in (2, 3):
            lift = 0.003 if 2 <= j < len(prof) - 1 else 0.0
        out = out - 1.3 * u * u + lift
        return V(s.x + sx * out, s.y + u - 0.01, s.z + z)

    def faces(i, j):
        if j == 0 or j == len(prof) - 2:
            return GOLD
        if i in cord_cols and j >= 2:
            return CORD
        return None

    return fb.panel(f"{t}-sode{sx}", fn, us, list(range(len(prof))), TEAM,
                    0.012, bevel=0.0, faces=faces, inside=s)


def fist(t, name, hand, kn, thumb_side):
    """A mitten fist closed round the grip (axis D), knuckles along kn."""
    x = kn.cross(D).normalized()
    m = fb.basis(x, kn, D, hand + kn * 0.006)
    block = fb.cube_ball(f"{t}-{name}", (0.068, 0.076, 0.084), (0, 0, 0),
                         SKIN, levels=2, crease=0.22)
    fb.transform([block], m)
    # The thumb wraps over the fingers on the side facing `thumb_side`.
    ts = thumb_side
    p0 = hand + x * ts * 0.026 - kn * 0.02 + D * 0.024
    p1 = hand + x * ts * 0.033 + kn * 0.012 + D * 0.03
    p2 = hand + x * ts * 0.016 + kn * 0.038 + D * 0.027
    thumb = fb.tube(f"{t}-{name}-thumb", [p0, p1, p2], [0.02, 0.019, 0.017],
                    SKIN, n=8, levels=0, caps=("dome", "dome"))
    return [block, thumb]


def arm(t, side, sx, hand, pole, thumb_side):
    s = V(sx * SH_X, 0, SH_Z)
    e0 = fb.ik(s, hand, UPPER, FORE + 0.04, pole)
    kn = hand - e0
    kn = (kn - D * kn.dot(D)).normalized()
    w = hand - kn * 0.036
    e = fb.ik(s, w, UPPER, FORE, pole)
    path = [s, lerp(s, e, 0.55), e, lerp(e, w, 0.78), w, w + kn * 0.022]
    limb = fb.tube(f"{t}-arm{side}", path,
                   [0.052, 0.054, 0.05, 0.055, 0.047, 0.04], TEAM2, n=6,
                   levels=1, caps=(None, "flat"),
                   bands={2: TEAM, 3: GOLD, 4: SKIN, "end": SKIN})
    ball = fb.ball(f"{t}-shoulder{side}", 0.062, s, TEAM2, seg=8, rings=6)
    pieces = [limb, ball, sode(t, sx)] + fist(t, f"fist{side}", hand, kn,
                                              thumb_side)
    return pieces, s


def leg(t, side, sx):
    hip = V(sx * HIP_X, 0, HIP_Z)
    knee = V(sx * 0.12, 0.014 + sx * 0.01, 0.31)
    ankle = V(sx * 0.136, -0.004 + sx * 0.016, 0.1)
    # Baggy hakama down to the shin guard, a ball joint hidden at the hip.
    thigh = fb.tube(f"{t}-leg{side}",
                    [hip + V(0, 0, 0.05), lerp(hip, knee, 0.5), knee,
                     lerp(knee, ankle, 0.5), ankle],
                    [0.08, 0.09, 0.072, 0.064, 0.055], TEAM2, n=6, levels=1,
                    caps=(None, None))

    # Shin guard: a plate over the front of the shin with a gold rim.
    def shin(u, v):
        z = lerp(0.3, 0.118, v)
        c = lerp(knee, ankle, clamp01((0.31 - z) / 0.21))
        r = lerp(0.078, 0.067, v) + 0.005 * math.sin(v * math.pi)
        a = math.radians(u)
        return V(c.x + math.sin(a) * r, c.y + math.cos(a) * r, z)

    guard = fb.panel(f"{t}-shin{side}", shin,
                     [-105, -75, -45, -15, 15, 45, 75, 105],
                     [0.0, 0.07, 0.55, 1.0], TEAM, 0.01, bevel=0.0,
                     faces=lambda i, j: GOLD if j == 0 else None,
                     inside=lerp(knee, ankle, 0.5))
    cop = fb.cube_ball(f"{t}-knee{side}", (0.088, 0.036, 0.074),
                       knee + V(0, 0.068, 0.016), TEAM, levels=1)

    # A chunky tabi foot on a straw sandal, toes turned out a little.
    fwd = V(sx * math.sin(math.radians(8)), math.cos(math.radians(8)), 0)
    foot_c = V(ankle.x, ankle.y + 0.004, 0.0)
    rings = []
    for yy, rz, rw, zc in ((-0.075, 0.038, 0.05, 0.06),
                           (-0.02, 0.054, 0.062, 0.062),
                           (0.055, 0.046, 0.064, 0.054),
                           (0.13, 0.03, 0.056, 0.047)):
        ring = []
        for x, z, _ in fb.sup(8, rw, rz, 2.6, math.pi / 8):
            ring.append(V(x, yy, max(zc + z, 0.026)))
        rings.append(ring)
    foot = fb.loft(f"{t}-foot{side}", rings, LACQUER, start="flat",
                   end="flat", levels=1)
    sole_outline = [(x, y) for x, y, _ in fb.sup(10, 0.068, 0.128, 2.4)]
    sole = fb.slab(f"{t}-sole{side}", sole_outline, 0.026, STRAW,
                   bevel=0.0)
    sole.location = (0, 0.03, 0)
    kit.apply_transform(sole)
    rot = fb.basis(fwd.cross(V(0, 0, 1)), fwd, V(0, 0, 1), foot_c)
    fb.transform([foot, sole], rot)
    return [thigh, guard, cop, foot, sole], hip


def face_at(prof, z):
    for (z0, x0, y0), (z1, x1, y1) in zip(prof, prof[1:]):
        if z <= z1:
            k = clamp01((z - z0) / (z1 - z0))
            return lerp(x0, x1, k), lerp(y0, y1, k)
    return prof[-1][1], prof[-1][2]


def head(t):
    pieces = []
    cy = CY
    # The face: the eyes show between the peak and the mask.
    face_prof = [(1.08, 0.066, 0.068), (1.115, 0.09, 0.098),
                 (1.16, 0.096, 0.106), (1.2, 0.094, 0.106),
                 (1.235, 0.084, 0.092), (1.262, 0.06, 0.066)]
    rings = [fb.hring(z, rx * 0.97, ry * 0.97, 10, cy=cy)
             for z, rx, ry in face_prof[2:]]
    pieces.append(fb.loft(f"{t}-face", rings, SKIN, start="pole",
                          end="pole", levels=0))
    pieces.append(fb.tube(f"{t}-neck", [V(0, 0, 0.99), V(0, 0, 1.09)],
                          [0.056, 0.056], TEAM2, n=10, levels=0,
                          caps=("pole", "pole")))
    for sx in (-1, 1):
        a = math.radians(sx * 24)
        rx, ry = face_at(face_prof, 1.19)
        at = V(math.sin(a) * rx * 0.97, cy + math.cos(a) * ry * 0.97, 1.19)
        n = V(math.sin(a) * 0.7, 1, 0)
        pieces += fb.eye(f"{t}-eye{sx}", at, n, (0, 0, 1), 0.0195,
                         squash=0.8, iris_scale=0.6, lid=(0.5, -sx * 0.45))

    # The face mask (menpo): dark lacquer from under the eyes to the chin,
    # with a crisp nose.
    def mask(u, v):
        z = lerp(1.17, 1.07, v)
        rx, ry = face_at(face_prof, z)
        a = math.radians(u)
        tuck = 0.012 - 0.022 * v ** 4
        p = V(math.sin(a) * (rx + tuck), cy + math.cos(a) * (ry + tuck), z)
        if u == 0 and v < 0.5:
            p.y += 0.024 * (1 - v * 1.6)
        return p

    pieces.append(fb.panel(f"{t}-mask", mask,
                           [-120, -80, -40, -14, 0, 14, 40, 80, 120],
                           [0.0, 0.3, 0.8, 1.0], MASK, 0.008,
                           bevel=0.0, inside=V(0, cy, 1.13)))
    # A fierce white moustache moulded on the mask.
    for sx in (-1, 1):
        pts = []
        for k, (a, z) in enumerate(((6, 1.139), (26, 1.132), (46, 1.116),
                                    (60, 1.094))):
            rx, ry = face_at(face_prof, z)
            aa = math.radians(sx * a)
            pts.append(V(math.sin(aa) * (rx + 0.018),
                         cy + math.cos(aa) * (ry + 0.018), z))
        pieces.append(fb.tube(f"{t}-moustache{sx}", pts,
                              [0.0085, 0.0095, 0.007, 0.0035], HAIR, n=6,
                              levels=0, caps=("pole", "pole")))
    # The bowl (kabuto): ten ribs, a gold band and a gold finial.
    bowl = [(0.138, 1.21), (0.142, 1.234), (0.136, 1.285),
            (0.105, 1.333), (0.052, 1.359), (0.0, 1.364)]
    rings = []
    for r, z in bowl:
        ring = []
        for i in range(20):
            a = i / 20 * math.tau
            k = 1.0 if i % 2 == 0 or z < 1.237 else 0.972
            ring.append(V(math.cos(a) * r * k, cy + math.sin(a) * r * k, z))
        rings.append(ring)
    pieces.append(fb.loft(f"{t}-bowl", rings, TEAM, bands={0: GOLD},
                          start="flat", end=None, levels=0))
    pieces.append(fb.loft(f"{t}-finial",
                          [fb.hring(1.358, 0.03, 0.03, 12, cy=cy),
                           fb.hring(1.374, 0.032, 0.032, 12, cy=cy),
                           fb.hring(1.382, 0.018, 0.018, 12, cy=cy)],
                          GOLD, start="flat", end="pole", levels=0))

    # The peak over the eyes, with a gold edge.
    def peak(u, v):
        a = math.radians(u)
        r = lerp(0.138, 0.176, v)
        return V(math.sin(a) * r, cy + math.cos(a) * r * 1.02,
                 lerp(1.228, 1.212, v))

    pieces.append(fb.panel(f"{t}-peak", peak,
                           [-80 + i * 20 for i in range(9)],
                           [0.0, 0.72, 1.0], TEAM, 0.01, bevel=0.0,
                           faces=lambda i, j: GOLD if j == 1 else None,
                           inside=V(0, cy, 1.4)))
    # The neck guard (shikoro): three flaring lames round the back.
    prof = [(1.224, 0.136), (1.178, 0.168), (1.174, 0.16), (1.128, 0.192),
            (1.124, 0.184), (1.08, 0.216), (1.073, 0.216)]
    us = [62 + i * (236 / 10) for i in range(11)]

    def shikoro(u, v):
        z, r = prof[int(round(v))]
        a = math.radians(u)
        return V(math.sin(a) * r, cy + math.cos(a) * r, z)

    pieces.append(fb.panel(f"{t}-shikoro", shikoro, us,
                           list(range(len(prof))), TEAM, 0.011, bevel=0.0,
                           faces=lambda i, j: GOLD if j == len(prof) - 2
                           else None, inside=V(0, cy, 1.15)))
    # Turn-backs (fukigaeshi): the top lames folded out beside the face,
    # gold edged, each with a gold crest disc.
    for sx in (-1, 1):
        a = math.radians(sx * 60)
        side = V(sx, 0.38, 0).normalized()

        def fuki(u, v, a=a, side=side):
            z = lerp(1.226, 1.12, v)
            r = lerp(0.137, 0.19, v)
            base = V(math.sin(a) * r, cy + math.cos(a) * r, z)
            return base + side * (u * lerp(0.07, 0.056, v))

        pieces.append(fb.panel(f"{t}-fuki{sx}", fuki, [0.0, 0.5, 0.82, 1.0],
                               [0.0, 0.5, 1.0], TEAM, 0.011, bevel=0.0,
                               faces=lambda i, j: GOLD if i == 2 else None,
                               inside=V(sx * 0.12, cy - 0.2, 1.17)))
        centre = fuki(0.45, 0.45)
        normal = V(0, 1, 0) - side * side.dot(V(0, 1, 0))
        m = fb.look(normal, (0, 0, 1), centre + normal.normalized() * 0.001)
        mon = [(x, y) for x, y, _ in fb.sup(8, 0.015, 0.015)]
        pieces.append(fb.slab(f"{t}-mon{sx}", mon, 0.004, GOLD, bevel=0.0,
                              matrix=m))
    # The gold crescent crest on its holder.
    tilt = math.radians(12)
    up = V(0, -math.sin(tilt), math.cos(tilt))
    back = V(0, -math.cos(tilt), -math.sin(tilt))
    origin = V(0, cy + 0.156, 1.248)
    m = fb.basis(V(1, 0, 0), up, back, origin)
    crest = fb.outline_crescent(0.37, 0.2, 0.05, n=14, lift=0.2)
    pieces.append(fb.slab(f"{t}-crest", crest, 0.016, GOLD, bevel=0.005,
                          matrix=m))
    holder = [(x, y + 0.004) for x, y, _ in fb.sup(10, 0.026, 0.02)]
    pieces.append(fb.slab(f"{t}-crestholder", holder, 0.024, GOLD,
                          bevel=0.0,
                          matrix=fb.basis(V(1, 0, 0), up, back,
                                          origin + V(0, 0.006, -0.012))))
    return pieces


def katana(t):
    """Built along +z from the right fist, edge along +x, then aimed."""
    pieces = []
    w, th = 0.052, 0.009
    sori = 0.035
    rings = []
    zs = [0.078, 0.2, 0.35, 0.5, 0.6, 0.66, 0.7, 0.73, 0.755, 0.77]
    tip = 0.078 + BLADE - 0.004
    for z in zs:
        k = (z - 0.078) / (tip - 0.078)
        bend = -sori * k * k
        ww = w * (1 - 0.14 * k)
        if z > 0.68:
            q = clamp01((z - 0.68) / (tip - 0.68))
            edge = ww * math.sqrt(max(0.0, 1 - q * q))
        else:
            edge = ww
        back = -ww * 0.5
        ring = [V(back + edge + bend, 0, z),
                V(back + edge * 0.53 + bend, th, z),
                V(back + 0.004 + bend, th * 0.75, z),
                V(back + bend, 0, z),
                V(back + 0.004 + bend, -th * 0.75, z),
                V(back + edge * 0.53 + bend, -th, z)]
        rings.append(ring)
    tipv = V(-w * 0.5 * 0.86 + 0.006 - sori, 0, tip)
    pieces.append(fb.loft(f"{t}-blade", rings, STEEL, start="flat", end=tipv,
                          levels=0))
    # Collar (habaki) and guard (tsuba).
    pieces.append(fb.loft(f"{t}-habaki",
                          [fb.hring(z, 0.03, 0.013, 10, cx=-0.001, power=2.6)
                           for z in (0.058, 0.09)],
                          GOLD, start="flat", end="flat", levels=0))
    guard = [(x, y) for x, y, _ in fb.sup(14, 0.054, 0.046, 3.0)]
    pieces.append(fb.slab(f"{t}-tsuba", guard, 0.013, GOLD, bevel=0.0,
                          matrix=fb.basis(V(1, 0, 0), V(0, 1, 0),
                                          V(0, 0, 1), V(0, 0, 0.045))))
    # The wrapped hilt (tsuka): cream diamonds between dark wraps.
    n = 8
    hz = [0.045 - i * 0.02625 for i in range(9)]
    c = fb.Cage(f"{t}-tsuka", LACQUER)
    vr = []
    for j, z in enumerate(hz):
        phase = (j % 2) * math.pi / n
        vr.append(c.ring([V(x, y, z) for x, y, _ in
                          fb.sup(n, 0.02, 0.016, 2.0, phase)]))
    for j in range(len(vr) - 1):
        a, b = vr[j], vr[j + 1]
        for i in range(n):
            k = (i + 1) % n
            f = c.bm.faces.new((b[i], b[k], a[k], a[i]))
            f.material_index = c.m(CORD if (i + j) % 2 == 0 else LACQUER)
    c.ngon(vr[-1], LACQUER, end=False)
    pieces.append(c.obj(levels=0, recalc=True))
    pieces.append(fb.loft(f"{t}-kashira",
                          [fb.hring(z, rx, rx * 0.8, 8, power=2.2)
                           for z, rx in ((-0.16, 0.022), (-0.172, 0.024),
                                         (-0.186, 0.021), (-0.19, 0.012))],
                          GOLD, start="flat", end="pole", levels=0))
    return pieces


def build(root_name="duelist"):
    t = root_name
    root = kit.empty(t)

    for side, sx in (("L", -1), ("R", 1)):
        pieces, hip = leg(t, side, sx)
        fb.part(t, f"leg{side}", pieces, hip, root)

    torso = [cuirass(t)] + agemaki(t)
    torso.append(fb.loft(f"{t}-hips",
                         [fb.hring(z, rx, ry, 12)
                          for z, rx, ry in ((0.47, 0.13, 0.1),
                                            (0.55, 0.146, 0.11),
                                            (0.63, 0.15, 0.116))],
                         TEAM2, start="pole", end="flat", levels=0))
    for centre in (0, 62, 118, 180, 270):
        torso.append(kusazuri(t, centre, span=45 if centre == 270 else 26))
    torso_obj = fb.part(t, "torso", torso, WAIST, root)

    fb.part(t, "head", head(t), NECK, torso_obj)

    arm_r, s_r = arm(t, "R", 1, HAND_R, V(0.45, -0.1, 0.72), -1)
    arm_r_obj = fb.part(t, "armR", arm_r, s_r, torso_obj)
    e = V(0, 0.6, -0.8)
    e = (e - D * e.dot(D)).normalized()
    m = fb.basis(e, D.cross(e), D, HAND_R)
    blade = katana(t)
    fb.transform(blade, m)
    fb.part(t, "weapon", blade, HAND_R, arm_r_obj)

    arm_l, s_l = arm(t, "L", -1, HAND_L, V(-0.4, -0.05, 0.7), 1)
    fb.part(t, "armL", arm_l, s_l, torso_obj)
    return root
