"""The Dino (card id `ogre`): a big soft rubber T-rex toy.

About 2.25 units tall at the head and 3.1 from nose to tail tip. The body is
held forward over two thick legs with three-toed feet, the heavy tail lifted
off the floor as a counterweight. Team rubber with a cream belly running from
the throat to under the tail, a row of soft back plates in the light team
tone, a big head with a hinged jaw (rounded teeth, a rosy mouth), glossy
yellow eyes and tiny two-clawed arms.

Every organic part is one closed subdivision cage (see dino_kit.py), and the
parts meet like a poseable toy's: the tail and the neck plug into round
sockets in the body, the thighs press against the flanks.

Parts (origins on their joints, no rest rotation):
  ogre.legL / legR   hip
  ogre.torso         hips; parent of head, arms and tail
    ogre.head        neck socket at the shoulders (the whole neck and head)
      ogre.jaw       hinge at the back of the mouth, resting a little open
    ogre.armL / armR shoulder
    ogre.tail        tail socket
"""

import dino_kit as dk
import kit
from dino_kit import X, Y, Z
from mathutils import Matrix, Vector
from troopkit import part

BODY = "rubber:team"
PLATE = "rubber:team3"
BELLY = "rubber:" + kit.tint("dino-belly", "#f1e3c0")
MOUTH = "rubber:" + kit.tint("dino-mouth", "#b23a48")
TOOTH = "rubber:" + kit.tint("dino-tooth", "#f7f2e3")
EYE = "plastic:" + kit.tint("dino-eye", "#f6c417")
PUPIL = "plain:black"
GLINT = "plain:white"

# Ring point angles (degrees from the right side, counter-clockwise).


def belly(half):
    """Body rings: the cream belly spans `half` degrees each side of the
    bottom, between points 5 and 7."""
    return [0, 45, 90, 135, 180, 270 - half, 270, 270 + half]


def throat(half):
    """Neck rings: the same belly line, between points 5 and 0 (the lip
    corners of the head rings)."""
    return [half - 90, 15, 58, 122, 165, 270 - half, 252, 288]


HEAD_ANG = throat(55)
LEG_ANG = [22.5 + 45 * i for i in range(8)]

# Where the joints are.
HIP = (0.0, -0.02, 1.05)
LEG_X = 0.36
SPLAY = 0.04
TAIL_SOCKET = Vector((0, -0.94, 1.235))
NECK_AXIS = Vector((0, 0.55, 0.83)).normalized()
NECK_UP = X.cross(NECK_AXIS).normalized()        # back of the neck
NECK_SOCKET = Vector((0, 0.56, 1.58))
HINGE = Vector((0, 0.74, 1.80))
JAW_OPEN = 0.2                                    # radians, at rest


def el(w, angles, ht_scale=1.0, power=2.0):
    return lambda h: dk.ellipse(w, h * ht_scale, h, angles, power)


def axis_ring(centre, h, w, angles=HEAD_ANG):
    return dk.ring(centre, NECK_UP, dk.ellipse(w, h, h, angles))


# ---------------------------------------------------------------- torso

def build_torso(t):
    rings = [dk.ring_tb(top, bot, el(w, belly(half)))
             for top, bot, w, half in (
        ((-0.76, 1.475), (-0.76, 0.995), 0.25, 50),     # tail socket floor
        ((-0.935, 1.505), (-0.935, 0.965), 0.27, 50),   # socket lip, inside
        ((-0.95, 1.52), (-0.95, 0.95), 0.285, 50),      # socket rim
        ((-0.86, 1.555), (-0.86, 0.93), 0.31, 50),
        ((-0.62, 1.63), (-0.62, 0.865), 0.355, 51),
        ((-0.36, 1.69), (-0.36, 0.785), 0.405, 53),
        ((-0.08, 1.71), (-0.07, 0.735), 0.435, 55),     # hips
        ((0.2, 1.665), (0.22, 0.765), 0.425, 57),       # belly
        ((0.32, 1.615), (0.6, 0.915), 0.375, 61),       # chest
    )]
    # The neck socket opens forward and up at the shoulders.
    for off, h, w in ((-0.07, 0.275, 0.275), (0.0, 0.258, 0.258),
                      (-0.02, 0.24, 0.24), (-0.22, 0.21, 0.21)):
        rings.append(axis_ring(NECK_SOCKET + NECK_AXIS * off, h, w,
                               belly(62)))
    last = len(rings) - 2

    def face(k, i):
        # Cream belly from the tail socket's lip to the neck socket's lip.
        if 1 <= k <= last - 1 and i in (5, 6):
            return 1
        return 0

    return dk.loft(f"{t}-body", rings, [BODY, BELLY], face,
                   start=("dome", Y * 0.07),
                   end=("dome", -NECK_AXIS * 0.07))


# ---------------------------------------------------------------- tail

def build_tail(t):
    rings = [dk.ring_tb(top, bot, el(w, belly(half)))
             for top, bot, w, half in (
        ((-0.78, 1.475), (-0.78, 0.995), 0.245, 50),   # inside the socket
        ((-0.935, 1.5), (-0.935, 0.97), 0.265, 50),
        ((-0.99, 1.52), (-0.99, 0.95), 0.28, 50),
        ((-1.2, 1.44), (-1.2, 0.93), 0.245, 48),
        ((-1.44, 1.3), (-1.43, 0.885), 0.185, 46),
        ((-1.65, 1.14), (-1.64, 0.845), 0.125, 44),
        ((-1.83, 1.01), (-1.82, 0.83), 0.07, 42),
    )]

    def face(k, i):
        return 1 if k >= 1 and i in (5, 6) else 0

    return dk.loft(f"{t}-tail", rings, [BODY, BELLY], face,
                   start=("dome", Y * 0.06), end=("dome", Vector((0, -0.07,
                                                                  0.005))))


# ---------------------------------------------------------------- head

def head_shape(w, lip=1.0, palate=0.84, brow=0.0):
    """A T-rex head section: a broad flat-topped skull, eye-level sides, the
    upper lip at the lowest corners and the palate tucked up between; `brow`
    pushes the top corners out into ridges over the eyes."""
    def fn(h):
        bx, by = w * (0.7 + brow), h * (0.98 + brow * 0.45)
        return [(w, -h * lip), (w * 0.99, h * 0.36), (bx, by), (-bx, by),
                (-w * 0.99, h * 0.36), (-w, -h * lip),
                (-w * 0.5, -h * palate), (w * 0.5, -h * palate)]
    return fn


def build_head(t):
    s = NECK_SOCKET
    rings = [
        axis_ring(s - NECK_AXIS * 0.2, 0.205, 0.205, throat(62)),  # socket
        axis_ring(s - NECK_AXIS * 0.02, 0.235, 0.235, throat(62)),  # lip
        axis_ring(s + NECK_AXIS * 0.045, 0.25, 0.25, throat(62)),  # collar
    ]
    rings += [dk.ring_tb(top, bot, shape) for top, bot, shape in (
        ((0.45, 1.97), (0.86, 1.62), el(0.23, throat(58))),    # neck
        ((0.55, 2.19), (0.92, 1.815), head_shape(0.275, 0.95)),  # cheeks
        ((0.94, 2.27), (0.96, 1.835), head_shape(0.25, brow=0.13)),  # eyes
        ((1.14, 2.175), (1.14, 1.845), head_shape(0.205)),
        ((1.29, 2.075), (1.29, 1.855), head_shape(0.162)),       # snout
    )]

    def face(k, i):
        if i in (5, 6, 7):
            if k <= 3:
                return 1          # cream throat
            return 2              # palate
        return 0

    return dk.loft(f"{t}-head", rings, [BODY, BELLY, MOUTH], face,
                   start=("dome", -NECK_AXIS * 0.06), end=("strip",),
                   end_mat=[0, 0, 2])


def jaw_shape(w):
    def fn(h):
        return [(w, -0.45 * h), (0.92 * w, 0.0), (0.4 * w, -0.035),
                (-0.4 * w, -0.035), (-0.92 * w, 0.0), (-w, -0.45 * h),
                (-0.55 * w, -h), (0.55 * w, -h)]
    return fn


def build_jaw(t):
    rings = [dk.ring(Vector((0, y, z)), Z, jaw_shape(w)(h))
             for y, z, w, h in ((0.66, 1.8, 0.18, 0.15),
                                (0.81, 1.83, 0.235, 0.205),
                                (1.01, 1.84, 0.218, 0.178),
                                (1.17, 1.845, 0.182, 0.14),
                                (1.28, 1.85, 0.14, 0.106))]

    def face(k, i):
        if i in (1, 2, 3):
            return 1              # mouth
        if i in (5, 6, 7):
            return 2              # cream underside
        return 0

    return dk.loft(f"{t}-jaw", rings, [BODY, MOUTH, BELLY], face,
                   start=("dome", Vector((0, -0.06, 0.0))), end=("strip",),
                   start_mat=0, end_mat=[1, 0, 2])


# ---------------------------------------------------------------- legs

def foot_shape(a):
    b = a / 3
    return lambda h: [(a, 0.35 * h), (b, h), (-b, h), (-a, 0.35 * h),
                      (-a, -h), (-b, -h), (b, -h), (a, -h)]


def build_leg(t, name, sx):
    xc = sx * LEG_X
    side = X * sx
    rings = [dk.ring_tb(f, k, shape, x=xc, side=side) for f, k, shape in (
        ((0.1, 1.42), (-0.18, 1.4), el(0.13, LEG_ANG)),
        ((0.27, 1.24), (-0.33, 1.22), el(0.225, LEG_ANG)),
        ((0.33, 0.97), (-0.36, 1.0), el(0.25, LEG_ANG)),        # thigh
        ((0.31, 0.66), (-0.15, 0.75), el(0.2, LEG_ANG)),        # knee
        ((0.21, 0.46), (-0.13, 0.5), el(0.172, LEG_ANG)),       # shin
        ((0.09, 0.28), (-0.19, 0.3), el(0.158, LEG_ANG)),       # ankle
        ((0.15, 0.2), (-0.17, 0.07), el(0.165, LEG_ANG)),       # heel
        ((0.17, 0.17), (0.17, -0.03), el(0.185, LEG_ANG, 1.0, 2.6)),
        ((0.33, 0.145), (0.33, -0.035), foot_shape(0.215)),     # toe base
    )]
    # Splay the lower leg out a little for a wide, planted stance.
    for r in rings:
        r["c"].x += sx * SPLAY * max(0.0, 1.0 - r["c"].z / 0.95)
    tips = []

    def toes(bm, vrings):
        base = vrings[-1]
        for idx, yaw, length in (([0, 1, 6, 7], -sx * 0.34, 0.15),
                                 ([1, 2, 5, 6], -sx * 0.06, 0.19),
                                 ([2, 3, 4, 5], sx * 0.36, 0.14)):
            quad = [base[i] for i in idx]
            c0 = sum((q.co for q in quad), Vector()) / 4
            rot = Matrix.Rotation(yaw, 3, "Z")
            d = rot @ Y
            hz = (max(q.co.z for q in quad) - min(q.co.z for q in quad)) / 2
            prev = quad
            for f, sw, sz in ((0.5, 0.95, 0.86), (1.0, 0.74, 0.64)):
                c = c0 + d * (length * f)
                c.z -= hz * (1 - sz)
                ring = [bm.verts.new(c + rot @ Vector(((q.co.x - c0.x) * sw,
                                                       0.0,
                                                       (q.co.z - c0.z) * sz)))
                        for q in quad]
                for i in range(4):
                    j = (i + 1) % 4
                    bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
                prev = ring
            bm.faces.new(prev)
            tips.append((c, d))

    leg = dk.loft(f"{t}-leg{name}", rings, [BODY],
                  start=("dome", Vector((0, -0.01, 0.07))), extra=toes)
    dk.smooth(leg, 2, None, after=dk.flatten_below(0.0))
    tree = dk.tree([leg])
    pieces = [leg]
    for k, (c, d) in enumerate(tips):
        loc, nrm = dk.hit(tree, c - d * 0.1, d)
        if loc is None:
            loc = c
        claw = dk.cone(f"{t}-claw{name}{k}", 0.036, 0.08, TOOTH,
                       segments=6, bend=-0.02)
        claw = dk.aim(claw, (d + Z * -0.2).normalized(),
                      loc - d * 0.03 + Z * 0.01)
        # Claw tips rest on the floor, never through it.
        dk.flatten_below(0.0)(claw)
        pieces.append(claw)
    dk.smooth(leg, 0, 950)
    return pieces


# ---------------------------------------------------------------- arms

def build_arm(t, name, sx, torso_tree):
    # Found on the right side and mirrored, so both arms match exactly.
    loc, nrm = dk.hit(torso_tree, (0.24, 2.0, 1.2), -Y)
    loc.x *= sx
    n = nrm.normalized()
    n.x *= sx
    s = loc - n * 0.02
    elbow = s + Vector((sx * 0.035, 0.06, -0.17))
    wrist = elbow + Vector((-sx * 0.01, 0.12, -0.02))
    hand = wrist + Vector((0, 0.06, -0.025))
    arm = dk.tube(f"{t}-arm{name}", [s - n * 0.08, s + n * 0.025, elbow,
                                     wrist, hand],
                  [0.075, 0.084, 0.062, 0.053, 0.058], BODY, n=6,
                  squash=[1, 1, 1, 1, 0.7])
    dk.smooth(arm, 2, 170)
    pieces = [arm]
    for k, dx in enumerate((-0.026, 0.026)):
        claw = dk.cone(f"{t}-finger{name}{k}", 0.024, 0.062, TOOTH,
                       segments=5, bend=-0.018)
        pieces.append(dk.aim(claw, (0, 0.55, -0.83),
                             hand + Vector((dx * sx, 0.036, -0.006))))
    return pieces, s + n * 0.025


# ---------------------------------------------------------------- details

def place_plates(t, tree, spots, along_fn):
    """Back plates standing on a surface: spots are (origin, direction,
    height)."""
    out = []
    for k, (origin, direction, h) in enumerate(spots):
        loc, nrm = dk.hit(tree, origin, direction)
        if loc is None:
            continue
        up = (nrm.normalized() - Vector(direction).normalized()).normalized()
        p = dk.plate(f"{t}-plate{k}", loc - up * 0.02, up, along_fn(loc),
                     h * 0.82, h, 0.044, PLATE)
        dk.smooth(p, 2, 76)
        out.append(p)
    return out


def eyes(t, tree):
    out = []
    r = 0.078
    for sx in (-1, 1):
        loc, nrm = dk.hit(tree, (sx * 1.0, 0.98, 2.11), (-sx, 0, 0))
        n = nrm.normalized()
        c = loc - n * r * 0.3
        look = (n + Y * 0.8 + Z * 0.12).normalized()
        # Only the part of each bead that shows is kept.
        ball = dk.cap(kit.sphere(f"{t}-eye{sx}", r, mat=EYE, segments=14,
                                 rings=8), -0.3 * r)
        out.append(dk.aim(ball, (n + look).normalized(), c))
        pupil = dk.cap(kit.sphere(f"{t}-pupil{sx}", r * 0.56,
                                  scale=(1, 1, 0.42), mat=PUPIL, segments=10,
                                  rings=6), 0.0)
        out.append(dk.aim(pupil, look, c + look * r * 0.8))
        up = (Z - look * Z.dot(look)).normalized()
        out.append(kit.sphere(f"{t}-glint{sx}", r * 0.17,
                              c + look * r * 0.99 + up * r * 0.32,
                              mat=GLINT, segments=6, rings=3))
    return out


def nostrils(t, tree):
    out = []
    for sx in (-1, 1):
        loc, nrm = dk.hit(tree, (sx * 0.068, 1.25, 3.0), -Z)
        if loc is None:
            continue
        n = nrm.normalized()
        o = kit.sphere(f"{t}-nostril{sx}", 0.024, scale=(1.0, 1.0, 0.38),
                       mat=PUPIL, segments=8, rings=4)
        # Long axis along the snout, tipped out a little.
        o.rotation_euler = (0, 0, sx * 0.5)
        o.scale = (0.8, 1.35, 1.0)
        dk.aim(o, n, loc - n * 0.004)
        out.append(o)
    return out


def teeth(t, tree, ys, z_side, down, mat=TOOTH):
    """Rounded teeth along a lip: for each (y, length) find the lip edge by
    casting in from the side at z_side, then the lip underside (down=True)
    or top (down=False) just inside it."""
    out = []
    for sx in (-1, 1):
        for k, (y, length) in enumerate(ys):
            side, _ = dk.hit(tree, (sx * 1.0, y, z_side), (-sx, 0, 0))
            if side is None:
                continue
            x = side.x - sx * 0.032
            if down:
                loc, _ = dk.hit(tree, (x, y, z_side - 0.5), Z)
            else:
                loc, _ = dk.hit(tree, (x, y, z_side + 0.5), -Z)
            if loc is None:
                continue
            d = Vector((sx * 0.12, 0.08, -1.0 if down else 1.0)).normalized()
            tooth = dk.cone(f"{t}-tooth{int(down)}{sx}{k}", length * 0.46,
                            length, mat, segments=5)
            out.append(dk.aim(tooth, d, loc - d * 0.018))
    return out


# ---------------------------------------------------------------- build

def build(root_name="ogre"):
    t = root_name
    root = kit.empty(t)

    # Legs.
    for name, sx in (("L", -1), ("R", 1)):
        part(t, f"leg{name}", build_leg(t, name, sx),
             (sx * LEG_X, HIP[1], HIP[2]), root)

    # Torso, with plates down the back.
    body = build_torso(t)
    dk.smooth(body)
    body_tree = dk.tree([body])
    plates = place_plates(t, body_tree, [
        ((0, 0.22, 3.0), -Z, 0.21),
        ((0, -0.03, 3.0), -Z, 0.28),
        ((0, -0.3, 3.0), -Z, 0.31),
        ((0, -0.57, 3.0), -Z, 0.29),
        ((0, -0.82, 3.0), -Z, 0.25),
    ], lambda p: Y)
    arms = [build_arm(t, name, sx, body_tree) for name, sx in (("L", -1),
                                                               ("R", 1))]
    dk.smooth(body, 0, 1320)
    torso = part(t, "torso", [body] + plates, HIP, root)

    # Tail, plugged into the socket at the back.
    tail = build_tail(t)
    dk.smooth(tail)
    tail_tree = dk.tree([tail])
    tail_plates = place_plates(t, tail_tree, [
        ((0, -1.07, 3.0), -Z, 0.21),
        ((0, -1.3, 3.0), -Z, 0.165),
        ((0, -1.51, 3.0), -Z, 0.125),
        ((0, -1.7, 3.0), -Z, 0.085),
    ], lambda p: Y)
    dk.smooth(tail, 0, 720)
    part(t, "tail", [tail] + tail_plates, TAIL_SOCKET, torso)

    # Arms.
    for (pieces, shoulder), name in zip(arms, ("L", "R")):
        part(t, f"arm{name}", pieces, shoulder, torso)

    # Head (neck and skull) with eyes, nostrils and upper teeth.
    head = build_head(t)
    dk.smooth(head)
    head_tree = dk.tree([head])
    head_pieces = [head] + eyes(t, head_tree)
    head_pieces += teeth(t, head_tree, [(0.92, 0.05), (1.02, 0.06),
                                        (1.11, 0.066), (1.2, 0.064)],
                         1.87, True)
    head_pieces += nostrils(t, head_tree)
    dk.smooth(head, 0, 1150)
    head_obj = part(t, "head", head_pieces, NECK_SOCKET, torso)

    # Jaw, hinged at the back of the mouth, resting a little open.
    jaw = build_jaw(t)
    dk.smooth(jaw)
    jaw_tree = dk.tree([jaw])
    jaw_pieces = [jaw] + teeth(t, jaw_tree, [(0.98, 0.045), (1.08, 0.05),
                                             (1.17, 0.052)], 1.8, False)
    dk.smooth(jaw, 0, 550)
    for o in jaw_pieces:
        dk.rotate_about(o, HINGE, -JAW_OPEN)
    part(t, "jaw", jaw_pieces, HINGE, head_obj)

    for o in kit.descendants(root):
        if o.type == "MESH":
            print(f"  {o.name}: {dk.tris(o)} triangles")
    return root
