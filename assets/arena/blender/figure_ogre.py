"""Quality-first Tyrannosaurus master, rebuilt from anatomy on 4 October 2026.

This source intentionally retains its detailed surfaces. Runtime optimization
is a separate, visually reviewed copy; no sculpt operation decimates here.
The long rear tail and forward skull supersede the rejected compact shape.
Brief, rejected evidence and editable masters live in
work/arena/2026-10-04-rebuild/dino/.
"""

import math
import os

import numpy as np
from mathutils import Matrix, Vector

import kit
import face_rig
import figure_ogre_kit as fk
import figure_folk_kit as hk
import figure_ogre_anatomy as anatomy
import figure_ogre_surface as surface
import figure_ogre_skin as skinning
from figure_ogre_kit import X, Y, Z

R = "ogre"
HIDE = "reptile:" + kit.tint("dino-forest-master", "#425840")
BACK = "reptile:" + kit.tint("dino-dorsal-master", "#29382a")
SCUTE = "reptile:" + kit.tint("dino-scutes-master", "#59694a")
BELLY = "reptile:" + kit.tint("dino-under-master", "#b8a982")
MOUTH = "vinyl:" + kit.tint("dino-mouth-master", "#512e2a")
TONGUE = "vinyl:" + kit.tint("dino-tongue-master", "#975c51")
TOOTH = "resin:" + kit.tint("dino-tooth-master", "#e2d9bc")
CLAW = "resin:" + kit.tint("dino-claw-master", "#34372a")
EYE = "lacquer:" + kit.tint("dino-amber-master", "#bc8128")
PUPIL = "lacquer:" + kit.tint("dino-pupil-master", "#161d13")

HIP = Vector((0, -.36, 1.34))
NS = Vector((0, .48, 1.51))
TS = Vector((0, -.81, 1.49))
HINGE = Vector((0, .78, 1.73))
JAW_OPEN = .030
ANGLES = [i * 22.5 for i in range(16)]
SKULL_ANGLES = [0, 30, 55, 90, 125, 150, 180, 205, 225, 250, 270, 290, 315, 335]


def part(name, pieces, pivot, parent, dense=None):
    return fk.part(R, name, pieces, pivot, parent, angle=70, dense=dense)


def body_rings():
    # Pelvic base, long ribcage, shoulder and low neck all share one surface.
    # The deep abdomen hangs between the hips and pectorals; the spine stays low.
    rows = [(-1.04, 1.495, .225, .20, .185),
            (-.86, 1.505, .305, .275, .275),
            (-.59, 1.50, .41, .33, .34),
            (-.32, 1.47, .44, .34, .37),
            (-.06, 1.45, .41, .33, .35),
            (.19, 1.46, .36, .29, .31),
            (.37, 1.49, .29, .28, .28),
            (.43, 1.51, .262, .27, .26)]
    return [fk.ring((0, y, z), Z,
                     fk.ellipse(w, top, bottom, SKULL_ANGLES, 2.4))
            for y, z, w, top, bottom in rows]


def body_sculpt(P, N):
    # Pelvic/caudofemoral mass, scapular ridge and pectoral transition.
    # Broad positive and negative forms avoid a featureless inflated barrel.
    return (fk.bump2(P, (.33, -.62, 1.49), (.12, .23, .26), .038) +
            fk.bump2(P, (.30, .13, 1.68), (.08, .27, .12), .032) +
            fk.bump2(P, (.28, .37, 1.36), (.09, .15, .14), .027) +
            fk.bump2(P, (.34, .12, 1.35), (.11, .16, .14), -.016) +
            fk.bump2(P, (0, -.17, 1.16), (.27, .36, .12), -.012))


def body_paint(P):
    out = np.zeros(len(P), dtype=int)
    belly_line = 1.29 + np.abs(P[:, 1] + .08) * .13
    out[P[:, 2] < belly_line] = 1
    dorsal_line = 1.635 + np.abs(P[:, 0]) * .41 + \
        np.sin(P[:, 1] * 8.1 + np.sin(P[:, 0] * 9.7)) * .018
    out[(P[:, 2] > dorsal_line) & (np.abs(P[:, 0]) < .31)] = 2
    return out


def leg(side, root, continuous=False):
    sx = 1 if side == "R" else -1
    hip = Vector((sx * .32, -.36, 1.34))
    knee = Vector((sx * .345, .18, .76))
    ankle = Vector((sx * .305, -.15, .29))
    path = [(sx * .29, -.48, 1.62), tuple(hip),
            (sx * .345, -.18, 1.16), (sx * .355, .055, .94), tuple(knee),
            (sx * .335, .075, .62), (sx * .31, -.12, .47),
            (sx * .305, -.18, .36), tuple(ankle)]
    limb = anatomy.sweep(f"{R}-limb{side}", path,
                         [.17, .206, .221, .194, .131, .105, .113, .083, .070],
                         [.21, .24, .225, .18, .146, .11, .115, .08, .066],
                         [.23, .255, .24, .20, .135, .132, .135, .082, .073],
                         HIDE, level=3, n=20, power=2.25)
    # The complete leg/metatarsal/digital skin is fused before the rig cuts.
    skin = [limb, anatomy.sweep(f"{R}-tarsus{side}",
                                [ankle + Z * .07, ankle,
                                 (ankle.x, -.055, .155), (ankle.x, .07, .097)],
                                [.074, .077, .096, .111],
                                [.077, .075, .082, .065],
                                [.080, .077, .072, .055],
                                HIDE, level=3, n=16)]
    claws = []
    for k, dx in enumerate((-.081, 0, .081)):
        yaw = (-.13, 0, .13)[k]
        d = Vector((math.sin(yaw), math.cos(yaw), 0))
        base = Vector((ankle.x + dx, .045, .08))
        length = (.32, .40, .30)[k]
        points = [base - d * .038, base,
                  base + d * (length * .29) + Z * .011,
                  base + d * (length * .53) + Z * .003,
                  base + d * (length * .76) - Z * .005,
                  base + d * length - Z * .012]
        skin.append(anatomy.sweep(f"{R}-digit{side}{k}", points,
                                  [.038, .050, .051, .045, .038, .027],
                                  [.038, .051, .055, .046, .038, .025],
                                  [.031, .038, .041, .039, .032, .022],
                                  HIDE, level=3, n=14))
        claws.append(anatomy.horn(f"{R}-claw{side}{k}", points[-1],
                                  d - Z * .2, .112 if k == 1 else .092,
                                  .03 if k == 1 else .025, CLAW,
                                  bend=-.028, flat=.70))
    shape = anatomy.skin_union(f"{R}-complete-leg{side}", skin, HIDE,
                                voxel=.006, smooth=2)

    def sculpt(P, N):
        Q = P.copy()
        Q[:, 0] = np.abs(Q[:, 0])
        # Distinct quadriceps belly, iliotibial division, tibial tendon and hock.
        return (fk.bump(Q, (.46, -.05, 1.17), (.13, .22, .26), .025) +
                fk.groove(Q, (.445, -.25, 1.38), (.47, .09, .91), .038, -.017) +
                fk.groove(Q, (.48, -.22, 1.37), (.515, .12, .955), .041, -.012) +
                fk.bump(Q, (.34, .11, .88), (.095, .09, .11), .018) +
                fk.bump(Q, (.33, -.014, .555), (.087, .066, .155), .018) +
                fk.groove(Q, (.41, .009, .67), (.39, -.115, .405), .028, -.010) +
                fk.bump(Q, (.325, -.23, .38), (.083, .07, .068), .016) +
                fk.groove(Q, (.365, -.1, .29), (.38, .09, .11), .018, -.006) +
                (surface.scale_relief(P, N, .040, .0015) if not continuous else 0))

    fk.displace(shape, sculpt)
    fk.flatten_below(shape, .016)
    for claw in claws:
        fk.flatten_below(claw, .008)
    if continuous:
        return shape, claws
    dense = fk.Dense(shape)
    axis = Vector((0, .17, -1)).normalized()
    calf, _ = fk.cut(shape, knee, axis, f"{R}-shin{side}", reach=.25,
                     beyond=lambda P: P[:, 2] < knee.z)
    foot, _ = fk.cut(calf, ankle, -Z, f"{R}-pes{side}")
    # Hidden internal joint coverage, never an external round kneepad.
    socket = anatomy.ellipsoid(f"{R}-internal-knee{side}", knee - Y * .042,
                                (X * .084, Y * .072, Z * .075), HIDE)
    thigh = part(f"leg{side}", [shape, socket], hip, root, dense)
    shin = part(f"knee{side}", [calf], knee, thigh, dense)
    part(f"foot{side}", [foot] + claws, ankle, shin, dense)


def tail_rings():
    # Rearward muscular counterweight, with a long taper and gentle distal sweep.
    centres = [(0, -.81, 1.49), (0, -1.00, 1.48),
               (.006, -1.24, 1.46), (.012, -1.52, 1.425),
               (.026, -1.84, 1.39), (.045, -2.16, 1.355),
               (.067, -2.48, 1.33), (.087, -2.77, 1.325),
               (.105, -3.01, 1.345)]
    widths = [.255, .232, .181, .145, .108, .074, .046, .025, .004]
    heights = [.252, .211, .162, .128, .097, .069, .044, .022, .004]
    rings = []
    for k, centre in enumerate(centres):
        tangent = Vector(centres[min(k + 1, len(centres) - 1)]) - \
            Vector(centres[max(k - 1, 0)])
        # Use dorsal +Z despite the rearward path direction.
        up = (-X.cross(tangent.normalized())).normalized()
        rings.append(fk.ring(centre, up,
                             fk.ellipse(widths[k], heights[k], heights[k] * .93,
                                        SKULL_ANGLES, 2.1)))
    return rings


def tail(torso, shape, dense):
    rings = tail_rings()
    def paint(P):
        ys = [-3.01, -2.77, -2.48, -2.16, -1.84, -1.52, -1.24, -1.0, -.81]
        centres = [1.345, 1.325, 1.33, 1.355, 1.39, 1.425, 1.46, 1.48, 1.49]
        heights = [.004, .022, .044, .069, .097, .128, .162, .211, .27]
        z = np.interp(P[:, 1], ys, centres)
        h = np.interp(P[:, 1], ys, heights)
        out = np.zeros(len(P), dtype=int)
        out[P[:, 2] > z + h * .60] = 1
        out[P[:, 2] < z - h * .40] = 2
        return out
    fk.paint(shape, [HIDE, BACK, BELLY], paint)
    spine = fk.Spine(rings)
    links, pivots, source = [[shape]], [TS], shape
    for k, distance in enumerate((.80, 1.58)):
        centre, _, _, tangent = spine.at(distance)
        child, rim = fk.cut(source, centre, tangent, f"{R}-tail-cut{k}",
                            spine, distance, reach=.30)
        socket = fk.joint_ball(f"{R}-tail-overlap{k}", rim, centre, tangent,
                               Z, HIDE, q=.80, shrink=.75,
                               segments=36, rings=20)
        if socket:
            links[-1].append(socket)
        links.append([child])
        pivots.append(centre)
        source = child
    parent = torso
    for k, (pieces, pivot) in enumerate(zip(links, pivots)):
        parent = part("tail" if k == 0 else f"tail{k + 1}", pieces,
                      pivot, parent, dense)


def arm(side, torso, continuous=False):
    sx = 1 if side == "R" else -1
    shoulder = Vector((sx * .265, .39, 1.48))
    elbow = Vector((sx * .32, .57, 1.235))
    wrist = Vector((sx * .29, .735, 1.27))
    skin = [anatomy.sweep(f"{R}-brachium-radius{side}",
                          [shoulder - Y * .027 + Z * .028, shoulder,
                           shoulder.lerp(elbow, .38),
                           shoulder.lerp(elbow, .75), elbow,
                           elbow.lerp(wrist, .43), wrist,
                           wrist + Y * .035 - Z * .01],
                          [.069, .077, .073, .055, .047, .041, .031, .036],
                          [.076, .084, .078, .054, .046, .037, .028, .031],
                          [.078, .084, .072, .047, .045, .040, .030, .032],
                          HIDE, level=3, n=16, power=2.35)]
    claws = []
    for k, dx in enumerate((-.026, .026)):
        base = wrist + Vector((dx, .028, -.005))
        tip = base + Vector((dx * .34, .087 if k else .069, -.037))
        skin.append(anatomy.sweep(f"{R}-finger{side}{k}",
                                  [base, base.lerp(tip, .48) + Z * .009, tip],
                                  [.021, .024, .016], [.021, .024, .017],
                                  [.020, .022, .015], HIDE, level=3, n=12))
        claws.append(anatomy.horn(f"{R}-talon{side}{k}", tip,
                                  (0, .38, -.85), .066, .017, CLAW,
                                  bend=.022, flat=.75))
    shape = anatomy.skin_union(f"{R}-complete-arm{side}", skin, HIDE,
                                voxel=.004, smooth=2)

    def sculpt(P, N):
        Q = P.copy()
        Q[:, 0] = np.abs(Q[:, 0])
        return (fk.bump(Q, (.29, .465, 1.38), (.073, .075, .13), .008) +
                fk.bump(Q, (.33, .55, 1.24), (.042, .047, .04), .008) +
                fk.groove(Q, (.32, .60, 1.295), (.30, .71, 1.295), .011, -.003) +
                (surface.scale_relief(P, N, .027, .0012) if not continuous else 0))

    fk.displace(shape, sculpt)
    if continuous:
        return shape, claws
    dense = fk.Dense(shape)
    fore, _ = fk.cut(shape, elbow, (wrist - shoulder).normalized(),
                     f"{R}-fore-cut{side}", reach=.08,
                     beyond=lambda P: P[:, 1] > elbow.y)
    up = part(f"arm{side}", [shape], shoulder, torso, dense)
    part(f"fore{side}", [fore] + claws, elbow, up, dense)


def skull_ring(y, top, width, cheek, lip, roof):
    # Planar roof, temporal walls, shaped cheek and inset palate/lip rim.
    pts = [(width, cheek), (width * .94, top - .12),
           (width * .62, top - .027), (0, top - .024),
           (-width * .62, top - .027), (-width * .94, top - .12),
           (-width, cheek), (-width * .965, lip + .016),
           (-width * .79, lip), (-width * .51, roof),
           (0, roof + .006), (width * .51, roof),
           (width * .79, lip), (width * .965, lip + .016)]
    return fk.ring((0, y, 0), Z, pts)


def head_rings():
    rings = [fk.ring((0, .48, 1.55), Z,
                     fk.ellipse(.249, .242, .245, SKULL_ANGLES, 2.1)),
             fk.ring((0, .57, 1.63), Z,
                     fk.ellipse(.242, .245, .23, SKULL_ANGLES, 2.15)),
             fk.ring((0, .70, 1.79), Z,
                     fk.ellipse(.263, .252, .16, SKULL_ANGLES, 2.25))]
    rings += [skull_ring(*row) for row in (
        (.80, 2.16, .305, 1.90, 1.685, 1.745),
        (.96, 2.225, .342, 1.95, 1.70, 1.775),
        (1.12, 2.215, .333, 1.965, 1.71, 1.785),
        (1.34, 2.16, .304, 1.965, 1.726, 1.80),
        (1.56, 2.105, .283, 1.947, 1.74, 1.811),
        (1.76, 2.06, .254, 1.933, 1.757, 1.82),
        (1.87, 2.005, .218, 1.923, 1.77, 1.823),
        (1.91, 1.948, .18, 1.905, 1.787, 1.835))]
    return rings


def skull_sculpt(P, N):
    Q = P.copy()
    Q[:, 0] = np.abs(Q[:, 0])

    def plane(c, r, amplitude):
        # Broad restrained cranial plates, with firmer edges than ball bumps.
        d = (Q - np.asarray(c)) / np.asarray(r)
        return amplitude * np.exp(-np.sum(d ** 4, axis=1))

    return (fk.bump(Q, (.318, .985, 2.035), (.10, .12, .088), -.044) +
            plane((.279, .960, 2.119), (.105, .163, .065), .038) +
            plane((.304, .846, 1.894), (.112, .097, .119), .032) +
            fk.bump(Q, (.286, .827, 2.001), (.075, .082, .073), -.029) +
            plane((.293, 1.235, 1.982), (.058, .175, .105), -.026) +
            plane((.293, 1.050, 1.822), (.105, .189, .056), .022) +
            fk.groove(Q, (.277, 1.132, 2.099), (.239, 1.60, 2.003), .027, -.011) +
            fk.bump(Q, (.110, 1.435, 2.101), (.054, .30, .051), .009))


def face(skull):
    tree = fk.tree([skull])
    features = []
    for sx in (-1, 1):
        hit, normal = fk.hit(tree, (sx * 1, .985, 2.025), (-sx, 0, 0))
        if hit is None:
            raise RuntimeError("Missing anatomical eye surface")
        normal.normalize()
        up = (Z - normal * normal.dot(Z)).normalized()
        side = normal.cross(up).normalized()
        # Cut a real orbital hollow so the small eye sits within the skull.
        cutter = anatomy.ellipsoid(f"{R}-orbital-cutter{sx}", hit + normal * .012,
                                    (side * .093, up * .063, normal * .079), HIDE)
        anatomy.subtract(skull, cutter, "orbital-hollow")
        centre = hit - normal * .034
        features.append(anatomy.ellipsoid(f"{R}-eye{sx}", centre,
                                          (side * .076, up * .052,
                                           normal * .052), EYE))
        features.append(anatomy.ellipsoid(f"{R}-iris{sx}",
                                          centre + normal * .046,
                                          (side * .048, up * .043,
                                           normal * .012), EYE))
        features.append(anatomy.ellipsoid(f"{R}-pupil{sx}",
                                          centre + normal * .057,
                                          (side * .014, up * .032,
                                           normal * .0065), PUPIL))
        # Almond-like lids return into the cheek instead of glued brow balls.
        upper_points = [hit + side * v + up * h + normal * d for v, h, d in
                        ((-.086, .003, .000), (-.060, .031, .012),
                         (-.025, .050, .012), (.024, .047, .007),
                         (.060, .026, .006), (.086, .001, -.005))]
        lower_points = [hit + side * v + up * h + normal * d for v, h, d in
                        ((-.083, -.005, -.001), (-.050, -.038, .002),
                         (0, -.046, .004), (.049, -.034, .001),
                         (.084, -.002, -.004))]
        features.append(anatomy.curve(f"{R}-lid{sx}", upper_points,
                                      [.008, .014, .020, .020, .014, .008],
                                      HIDE, n=14, level=3))
        features.append(anatomy.curve(f"{R}-lower-lid{sx}", lower_points,
                                      [.008, .010, .011, .010, .008],
                                      HIDE, n=12, level=3))
        nostril, no = fk.hit(tree, (sx * 1, 1.735, 1.936), (-sx, 0, 0))
        if nostril is not None:
            no.normalize()
            tangent = (Y - no * no.dot(Y)).normalized()
            upright = no.cross(tangent).normalized()
            cutter = anatomy.ellipsoid(f"{R}-nostril-cutter{sx}",
                                        nostril + no * .014,
                                        (tangent * .034, upright * .023,
                                         no * .052), HIDE)
            anatomy.subtract(skull, cutter, "nostril-hollow")
    # Varied banana teeth are rooted behind the lip rather than equal needles.
    for sx in (-1, 1):
        for k, (y, width, z, length) in enumerate((
                (1.01, .278, 1.732, .073), (1.135, .275, 1.741, .103),
                (1.27, .257, 1.753, .105), (1.405, .242, 1.765, .098),
                (1.54, .227, 1.777, .084), (1.665, .208, 1.788, .070),
                (1.773, .177, 1.806, .053))):
            features.append(anatomy.horn(f"{R}-tooth{sx}{k}",
                                         (sx * width, y, z), (sx * .02, .05, -1),
                                         length, length * .275, TOOTH,
                                         bend=-length * .13, flat=.72))
        for k, (x, y, length) in enumerate(((.055, 1.882, .037),
                                           (.11, 1.869, .044))):
            features.append(anatomy.horn(f"{R}-premaxillary{sx}{k}",
                                         (sx * x, y, 1.814), (sx * .08, .05, -1),
                                         length, length * .27, TOOTH,
                                         bend=-.005, flat=.78))
    return features


def mandible_ring(y, width, z, upper, lower):
    # External ramus and dentary are angular bone-bearing forms; the central
    # mouth floor sits lower between them rather than a round solid paddle.
    pts = [(width, .012), (width * .93, upper * .65),
           (width * .72, upper), (0, upper * .55),
           (-width * .72, upper), (-width * .93, upper * .65),
           (-width, .012), (-width * .94, -lower * .48),
           (-width * .69, -lower * .85), (-width * .34, -lower),
           (0, -lower * .96), (width * .34, -lower),
           (width * .69, -lower * .85), (width * .94, -lower * .48)]
    return fk.ring((0, y, z), Z, pts)


def mandible_sculpt(P, N):
    Q = P.copy()
    Q[:, 0] = np.abs(Q[:, 0])
    return (fk.bump(Q, (.251, .89, 1.617), (.075, .114, .12), .024) +
            fk.groove(Q, (.277, 1.04, 1.644), (.218, 1.60, 1.715), .021, -.008) +
            fk.bump(Q, (.17, 1.76, 1.65), (.058, .13, .05), .006))


def head(torso, skull, dense, rig=None):
    features = face(skull)
    features += surface.facial_scutes(skull, SCUTE)

    def paint(P):
        out = np.zeros(len(P), dtype=int)
        out[(P[:, 2] < 1.57) & (P[:, 1] < .85)] = 1
        out[(P[:, 2] < 1.80) & (P[:, 1] > .87) &
            (np.abs(P[:, 0]) < .19)] = 2
        out[(P[:, 2] > 2.14) & (P[:, 1] < 1.27)] = 3
        return out

    fk.paint(skull, [HIDE, BELLY, MOUTH, BACK], paint)
    # A recessed lining has real interior depth. The palate follows the head,
    # while its lower mucosa opens with the jaw; no hanging solid backing ball.
    oral = anatomy.oral_recess(f"{R}.throat", [
        (.975, 1.666, .223, .112, .131),
        (.890, 1.676, .203, .108, .106),
        (.810, 1.686, .173, .108, .085),
        (.735, 1.700, .103, .082, .060),
    ], MOUTH)
    if rig:
        def face_part(troop, name, pieces, pivot, parent, **kwargs):
            obj = fk.part(troop, "head-fixed" if name == "head" else name,
                          pieces, pivot, parent, **kwargs)
            if name == "head":
                skinning.bone_attach(obj, rig, "head")
            return obj
        skinning.weight_oral(oral, rig)
        head_obj = face_rig.head(face_part, R, features,
                                 NS, torso, angle=70)
    else:
        head_obj = face_rig.head(fk.part, R, [skull, oral] + features,
                                 NS, torso, angle=70, dense=dense)
    rings = []
    for y, width, z, upper, lower in (
            (.77, .205, 1.59, .15, .13), (.89, .276, 1.582, .135, .11),
            (1.08, .284, 1.606, .095, .09), (1.31, .26, 1.635, .078, .081),
            (1.55, .236, 1.663, .071, .073), (1.75, .20, 1.696, .059, .060),
            (1.86, .169, 1.724, .05, .05)):
        rings.append(mandible_ring(y, width, z, upper, lower))
    jaw = anatomy.loft(f"{R}-mandible", rings, HIDE, level=3,
                        start=(0, -.035, -.022), end=(0, .025, .002),
                        creases=[(0, 6, 2, .26), (0, 6, 4, .26),
                                 (0, 6, 8, .18), (0, 6, 12, .18)],
                        sculpt=mandible_sculpt)
    fk.displace(jaw, lambda P, N: surface.scale_relief(P, N, .038, .0012))

    def jaw_paint(P):
        out = np.zeros(len(P), dtype=int)
        out[P[:, 2] < 1.555 + (P[:, 1] - .77) * .13] = 1
        out[(P[:, 2] > 1.70) & (np.abs(P[:, 0]) < .17)] = 2
        return out

    fk.paint(jaw, [HIDE, BELLY, MOUTH], jaw_paint)
    pieces = [jaw, anatomy.ellipsoid(f"{R}-tongue", (0, 1.29, 1.719),
                                      (X * .147, Y * .34, Z * .023), TONGUE)]
    for sx in (-1, 1):
        for k, (y, width, length) in enumerate((
                (1.105, .257, .062), (1.265, .24, .076), (1.423, .219, .069),
                (1.575, .20, .059), (1.723, .166, .045))):
            pieces.append(anatomy.horn(f"{R}-lower-tooth{sx}{k}",
                                        (sx * width, y, 1.685 + (y - 1.10) * .145),
                                        (sx * .02, .05, 1), length,
                                        length * .27, TOOTH, bend=-length * .11,
                                        flat=.72))
    rotation = Matrix.Translation(HINGE) @ Matrix.Rotation(-JAW_OPEN, 4, "X") @ \
        Matrix.Translation(-HINGE)
    hk.transform(pieces, rotation)
    jaw_obj = part("jaw-fixed" if rig else "jaw", pieces, HINGE, head_obj)
    if rig:
        skinning.bone_attach(jaw_obj, rig, "jaw")


def build_master(root_name="ogre", apply_pose=True):
    assert root_name == R
    root = kit.empty(R)
    # Author one continuous skin from tail tip through pelvis, neck and skull.
    # A connected weighted skin preserves these anatomical transitions through
    # motion, rather than opening the original rigid section cuts.
    caudal = list(reversed(tail_rings()[2:]))
    cervical = head_rings()
    rings = caudal + body_rings() + cervical
    skull_start = len(caudal) + len(body_rings()) + 3
    body = anatomy.loft(f"{R}-axial-sculpt", rings, HIDE, level=3,
                         start=(0, -.012, .003), end=(0, .027, -.020),
                         creases=[(skull_start, len(rings) - 1, i, strength)
                                  for i, strength in ((7, .38), (8, .48),
                                                       (12, .48), (13, .38))],
                         sculpt=lambda P, N: body_sculpt(P, N) + skull_sculpt(P, N))
    def axial_relief(P, N):
        face_weight = np.clip((P[:, 1] - .55) / .23, 0, 1)
        return surface.scale_relief(P, N, .050, .0018) * (1 - face_weight) + \
            surface.scale_relief(P, N, .045, .0038) * face_weight
    pieces, attachments = [body], []
    for side in ("L", "R"):
        limb, claws = leg(side, root, continuous=True)
        pieces.append(limb)
        attachments.append((claws, "foot" + side))
        limb, claws = arm(side, root, continuous=True)
        pieces.append(limb)
        attachments.append((claws, "fore" + side))
    body = anatomy.skin_union("ogre.skin", pieces, HIDE, voxel=.006, smooth=2)
    fk.displace(body, axial_relief)
    spine = fk.Spine(tail_rings())
    rig = skinning.make_rig(root, HIP, NS,
                            [TS] + [spine.at(distance)[0] for distance in (.80, 1.58)],
                            HINGE)
    head(root, body, None, rig=rig)
    skinning.weight_skin(body, rig)
    for claws, bone in attachments:
        obj = kit.join(claws, "ogre." + bone + "-claws")
        skinning.bone_attach(obj, rig, bone)
    for scute in surface.dorsal_scutes(body, BACK):
        skinning.bone_attach(scute, rig, "torso")
    surface.vertex_skin(root, {
        "hide": kit.TINTS[HIDE.partition(":")[2]],
        "back": kit.TINTS[BACK.partition(":")[2]],
        "belly": kit.TINTS[BELLY.partition(":")[2]],
    })
    pose = os.environ.get("OGRE_POSE")
    if apply_pose and pose in POSES:
        skinning.apply_pose(root, POSES[pose])
    hk.report(root, R)
    root["skinContract"] = "continuous anatomical skin and common named joint frames"
    return root


def build(root_name="ogre"):
    """Load the separately reviewed runtime topology; retain the full sculpt."""
    import figure_ogre_runtime as runtime
    root = runtime.load_reviewed_copy(root_name)
    pose = os.environ.get("OGRE_POSE")
    if pose in POSES:
        skinning.apply_pose(root, POSES[pose])
    return root


def finish_ao(root):
    surface.finish_ao(root)
    if root.get("dinoRuntimeTopology"):
        import figure_ogre_runtime as runtime
        runtime.smooth_export_corners(root)


POSES = {
    "bite": {"head": (.20, 0, 0), "jaw": (-.55, 0, 0),
             "torso": (-.12, 0, 0), "armL": (.25, 0, 0), "armR": (.25, 0, 0)},
    "walk": {"legL": (.25, 0, 0), "kneeL": (-.30, 0, 0),
             "legR": (-.18, 0, 0), "head": (-.025, .04, 0),
             "tail": (0, -.09, 0), "tail2": (0, -.06, 0)},
    "roar": {"head": (.32, 0, 0), "jaw": (-.65, 0, 0),
             "torso": (-.07, 0, 0), "armL": (.4, 0, 0), "armR": (.4, 0, 0)},
}
