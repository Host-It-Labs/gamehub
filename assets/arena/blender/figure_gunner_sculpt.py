"""Gunner v1: private editable veteran artilleryman, relaxed connected skin.

Build with figure_gunner_review.py; never selected by the live collector until
source and frozen runtime renders have been inspected and signed by the root.
Detailed shapes stay bounded; no whole-body level-3 subdivision is used.
"""
import json
import math
import os

import numpy as np
from mathutils import Matrix

import kit
import figure_gunner_forms as f
from figure_gunner_forms import V, TAU, gauss as g, profile, ss

R = "gunner"
SKIN = "skin:" + kit.tint("gunner-v1-skin", "#d99b78")
LIP = "skin:" + kit.tint("gunner-v1-lip", "#a76750")
NAIL = "skin:" + kit.tint("gunner-v1-nail", "#e0b496")
HAIR = "hair:" + kit.tint("gunner-v1-silver", "#aaa69e")
HAIR_DARK = "hair:" + kit.tint("gunner-v1-hair-shadow", "#686767")
IVORY = "resin:" + kit.tint("gunner-v1-eye", "#e5dbc8")
PUPIL = "resin:" + kit.tint("gunner-v1-iris", "#403629")
DARK = "resin:" + kit.tint("gunner-v1-shadow", "#30201c")
NAVY = "weave:" + kit.tint("team2:gunner", "#202e4e")
BLUE = "weave:" + kit.tint("team:gunner", "#285dd5")
WHITE = "weave:" + kit.tint("gunner-v1-ivory-cloth", "#e5decc")
BLACK = "hide:" + kit.tint("gunner-v1-leather", "#23252b")
FELT = "felt:" + kit.tint("gunner-v1-felt", "#202127")
SOLE = "resin:" + kit.tint("gunner-v1-sole", "#14171d")
GOLD = "gilt:" + kit.tint("gunner-v1-gold", "#d7ad59")
GOLD_DARK = "gilt:" + kit.tint("gunner-v1-gold-shadow", "#8a6832")

WAIST = V(0, 0, .664)
CHEST = V(0, -.006, .846)
NECK = V(0, -.003, 1.034)
HEAD = V(0, -.004, 1.079)
SHOULDER = {s: V(s * .193, 0, .979) for s in (-1, 1)}
ELBOW = {s: V(s * .230, .013, .742) for s in (-1, 1)}
WRIST = {s: V(s * .237, .065, .522) for s in (-1, 1)}
CLAV = {s: V(s * .047, -.004, 1.002) for s in (-1, 1)}
HIP = {s: V(s * .086, 0, .627) for s in (-1, 1)}
KNEE = {s: V(s * .100, .012, .354) for s in (-1, 1)}
ANKLE = {s: V(s * .104, .016, .091) for s in (-1, 1)}
AXLE = V(0, .600, .170)
TRUNNION = V(0, .600, .305)
WHEEL_R = .170
BAR = V(0, .350, .640)
BODY_ROWS = [(.578, .139, .114, .110), (.615, .146, .120, .111),
             (.672, .142, .127, .116), (.729, .157, .133, .119),
             (.810, .173, .134, .126), (.889, .171, .130, .122),
             (.941, .157, .112, .109), (.983, .114, .076, .080),
             (1.013, .061, .058, .054), (1.043, .060, .055, .053)]
HEAD_ROWS = [(1.047, .042, .050, .044), (1.069, .061, .066, .053),
             (1.095, .083, .077, .065), (1.137, .096, .080, .083),
             (1.179, .103, .081, .089), (1.214, .106, .079, .098),
             (1.248, .102, .082, .095), (1.276, .088, .074, .086),
             (1.296, .060, .056, .055), (1.309, .009, .008, .010)]


def positions():
    points = {"torso": WAIST, "chest": CHEST, "neck": NECK, "head": HEAD,
              "hat": V(0, -.011, 1.304), "hair": V(0, -.030, 1.259),
              "offhand": AXLE, "extra": TRUNNION, "wheels": AXLE,
              "weapon": V(.105, .462, .315)}
    parents = {"chest": "torso", "neck": "chest", "head": "neck", "hat": "head",
               "hair": "head", "extra": "offhand", "wheels": "offhand", "weapon": "offhand"}
    for s, side in ((-1, "L"), (1, "R")):
        points.update({"clav" + side: CLAV[s], "arm" + side: SHOULDER[s],
                       "fore" + side: ELBOW[s], "hand" + side: WRIST[s],
                       "leg" + side: HIP[s], "knee" + side: KNEE[s], "foot" + side: ANKLE[s]})
        parents.update({"clav" + side: "chest", "arm" + side: "clav" + side,
                        "fore" + side: "arm" + side, "hand" + side: "fore" + side,
                        "knee" + side: "leg" + side, "foot" + side: "knee" + side})
    return points, parents


def body_point(a, z, extra=0):
    rx, front, back = profile(BODY_ROWS, z)
    sn, cs = math.sin(a), math.cos(a)
    ad = abs((math.degrees(a) + 180) % 360 - 180)
    relief = .006 * g(z, .805, .067) * g(ad, 32, 23)
    relief -= .010 * g(z, .903, .055) * g(ad, 89, 16)
    # Cloth loads from the side seam towards the buttons and belt.
    for h, tilt, amount in ((.702, .025, .006), (.745, -.020, .004), (.602, .015, .004)):
        centre = h + tilt * math.sin(2 * a + .5)
        relief += (amount * g(z, centre, .013) - amount * .5 * g(z, centre - .016, .006)) * g(ad, 40, 48)
    return V(f.geo.spow(sn, 2 / 2.3) * (rx + extra) + sn * relief,
             f.geo.spow(cs, 2 / 2.3) * ((front if cs >= 0 else back) + extra) + cs * relief, z)


def jacket(rig):
    trunk = f.loft("coatee-primary", [[body_point(j / 64 * TAU, float(z)) for j in range(64)]
                    for z in np.linspace(.578, 1.043, 74)], NAVY, 6300, True, start="flat", end="flat")
    pieces = [trunk]
    for s in (-1, 1):
        a, e, w = SHOULDER[s], ELBOW[s], WRIST[s]
        guides = [a + V(-s * .062, 0, .007), a + V(s * .012, 0, -.034),
                  a + (e - a) * .62, e, e + (w - e) * .53, w + V(0, 0, .014)]
        path = f.smooth_path(guides, 12)
        radii = []
        for j in range(len(path)):
            t = j / (len(path) - 1)
            r = profile([(0, .068), (.15, .071), (.40, .058), (.53, .053),
                         (.65, .049), (.82, .044), (1, .034)], t)[0]
            radii.append((r, r * .94))
        sleeve = f.tube("sleeve-primary-" + str(s), path, radii, NAVY, 1000, n=40, up=(1, 0, 0), caps=("flat", "flat"))
        # Broad, directed elbow creases survive the source remesh.
        for v in sleeve.data.vertices:
            at = v.co
            d = (at - e).length
            if d < .085:
                v.co.y += .004 * g(d, .035, .014) - .003 * g(d, .050, .009)
        pieces.append(sleeve)
    obj = f.fuse(pieces, "connected-short-coatee", NAVY,
                 float(os.environ.get("GUNNER_MASTER_VOXEL", ".0036")), 6400)
    co = np.array([v.co[:] for v in obj.data.vertices]); x, _, z = co.T
    chest = ss(.737, .950, z)
    arm_shares = [ss(.118, .203, s * x) * ss(.505, .550, z) for s in (-1, 1)]
    shares = np.clip(sum(arm_shares), 0, 1)
    weights = {"torso": (1 - chest) * (1 - shares), "chest": chest * (1 - shares)}
    for s, side, share in zip((-1, 1), ("L", "R"), arm_shares):
        at = (co - np.array(SHOULDER[s])).dot(np.array(ELBOW[s] - SHOULDER[s])) / (ELBOW[s] - SHOULDER[s]).length_squared
        clav = (1 - ss(.04, .35, at)) * .38
        fore = 1 - ss(.713, .782, z)
        weights["clav" + side] = share * clav
        weights["arm" + side] = share * (1 - clav) * (1 - fore)
        weights["fore" + side] = share * (1 - clav) * fore
        shoulder = ss(.08, .16, s * x) * ss(.93, 1.03, z) * .30
        shoulder *= weights["chest"]
        weights["clav" + side] += shoulder
        weights["chest"] -= shoulder
    f.weighted(obj, rig, weights)
    return obj


def trousers(rig):
    hip = f.loft("trouser-seat-primary", [[V(math.sin(j / 56 * TAU) * rx, math.cos(j / 56 * TAU) * ry, z)
                  for j in range(56)] for z, rx, ry in ((.514, .140, .097), (.554, .147, .111), (.609, .143, .111), (.645, .136, .108))],
                 WHITE, 3000, True, start="flat", end="flat")
    parts = [hip]
    for s in (-1, 1):
        rings = []
        for z in np.linspace(.291, .611, 60):
            t = float(ss(.291, .611, z)); c = KNEE[s] + (HIP[s] - KNEE[s]) * t
            rx, ry = profile([(.291, .049, .046), (.345, .052, .051), (.440, .063, .060), (.531, .072, .075), (.611, .077, .078)], z)
            ring = []
            for j in range(40):
                a = j / 40 * TAU
                fold = (.008 * g(z, .386 + .019 * math.sin(a), .011) - .004 * g(z, .370 + .016 * math.sin(a), .006)) * max(0, math.cos(a))
                fold += .006 * g(z, .527 + .020 * math.cos(a), .015) * abs(math.sin(a))
                ring.append(V(c.x + math.sin(a) * (rx + fold), math.cos(a) * (ry + fold), z))
            rings.append(ring)
        parts.append(f.loft("trouser-leg-primary-" + str(s), rings, WHITE, 600, start="flat", end="flat"))
    obj = f.fuse(parts, "connected-ivory-trousers", WHITE, .0038, 3300)
    co = np.array([v.co[:] for v in obj.data.vertices]); x, _, z = co.T
    waist = ss(.551, .634, z) * .8; right = ss(-.025, .025, x)
    knee = 1 - ss(.320, .400, z)
    f.weighted(obj, rig, {"torso": waist, "legL": (1 - waist) * (1 - right) * (1 - knee),
                         "legR": (1 - waist) * right * (1 - knee),
                         "kneeL": (1 - waist) * (1 - right) * knee, "kneeR": (1 - waist) * right * knee})


def hand_frame(s):
    down = (WRIST[s] - ELBOW[s]).normalized()
    palm = (V(-s, 0, 0) - down * down.dot(V(-s, 0, 0))).normalized()
    across = down.cross(palm).normalized()
    if across.y < 0:
        across = -across
    return down, across, palm


def hands(s, rig):
    w = WRIST[s]; down, across, palm = hand_frame(s)
    pieces = [f.tube("wrist-primary-" + str(s), [w - down * .024, w + down * .027],
                    [(.026, .022), (.029, .020)], SKIN, 400, n=32, up=across, caps=("flat", "flat"))]
    rings = []
    for t in np.linspace(0, 1, 24):
        centre = w + down * (.017 + .060 * t)
        wide, thick = profile([(0, .025, .017), (.35, .033, .018), (.80, .033, .015), (1, .026, .012)], t)
        rings.append([centre + across * math.cos(j / 40 * TAU) * wide + palm * math.sin(j / 40 * TAU) * thick for j in range(40)])
    pieces.append(f.loft("palm-primary-" + str(s), rings, SKIN, 300, start="flat", end="pole"))
    finger_paths = []
    for k, (spread, length) in enumerate(((-.023, .041), (-.0075, .050), (.008, .049), (.023, .040))):
        base = w + down * .064 + across * spread
        guides = [base, base + down * length * .42 - palm * .003,
                  base + down * length * .82 + palm * .009,
                  base + down * length * .89 + palm * .026,
                  base + down * length * .63 + palm * .037]
        path = f.smooth_path(guides, 6); finger_paths.append(path)
        radii = [.0085 - .0020 * j / (len(path) - 1) + .0010 * g(j / (len(path) - 1), .45, .13) for j in range(len(path))]
        pieces.append(f.tube("finger-primary-" + str(s) + "-" + str(k), path, radii, SKIN, 160, n=14, up=across))
    thumb = f.smooth_path([w + down * .023 + across * .022 + palm * .004,
                          w + down * .040 + across * .040 + palm * .014,
                          w + down * .065 + across * .032 + palm * .039,
                          w + down * .074 + across * .010 + palm * .043], 8)
    pieces.append(f.tube("thumb-primary-" + str(s), thumb, [.012 - .004 * j / (len(thumb) - 1) for j in range(len(thumb))], SKIN, 240, n=18, up=across))
    obj = f.fuse(pieces, "connected-hand-" + str(s), SKIN, .0020, 1600)
    co = np.array([v.co[:] for v in obj.data.vertices]); along = (co - np.array(w)).dot(np.array(down))
    hand = ss(-.014, .023, along); side = "R" if s > 0 else "L"
    f.weighted(obj, rig, {"fore" + side: 1 - hand, "hand" + side: hand})
    for k, path in enumerate(finger_paths):
        nail = f.ball("finger-nail-" + str(s) + "-" + str(k), path[-3] - palm * .006,
                      (.004, .0018, .0055), NAIL, 28, seg=16, rings=8)
        # Rigid nail islands are expected; the finger/palm itself is welded.
        f.attach(nail, rig, "hand" + side)


def face_point(a, z):
    rx, front, back = profile(HEAD_ROWS, z); sn, cs = math.sin(a), math.cos(a)
    ad = abs((math.degrees(a) + 180) % 360 - 180)
    relief = .011 * g(z, 1.161, .024) * g(ad, 38, 18)  # cheekbone
    relief += .008 * g(z, 1.104, .020) * g(ad, 57, 16)  # masseter
    relief += .016 * g(z, 1.077, .016) * g(ad, 0, 22)   # adult chin
    relief -= .008 * g(z, 1.205, .015) * g(ad, 25, 12)  # eye socket
    relief += .011 * g(z, 1.232, .012) * g(ad, 20, 20)  # supraorbital plane
    relief += .036 * g(z, 1.181, .018) * g(ad, 0, 10)  # broad nose
    relief += .020 * g(z, 1.210, .025) * g(ad, 0, 7)   # nasal bridge
    relief += .011 * g(z, 1.173, .008) * g(ad, 12, 5)  # alar wings
    relief -= .004 * g(z, 1.146, .017) * g(ad, 27, 5)  # nasolabial fold
    return V(f.geo.spow(sn, 2 / 2.45) * rx + sn * relief * .3,
             f.geo.spow(cs, 2 / 2.45) * (front if cs >= 0 else back) - .004 + cs * relief, z)


def head(rig):
    skull = f.loft("adult-head-primary", [[face_point(j / 80 * TAU, float(z)) for j in range(80)]
                    for z in np.linspace(HEAD_ROWS[0][0], HEAD_ROWS[-1][0], 92)], SKIN, 3500, True, start="flat", end="pole")
    neck = f.tube("neck-primary", [V(0, -.004, 1.019), V(0, -.004, 1.094)],
                  [(.052, .049), (.056, .052)], SKIN, 400, n=40, up=(1, 0, 0), caps=("flat", "flat"))
    parts = [skull, neck]
    for s in (-1, 1):
        parts.append(f.ball("ear-primary-" + str(s), V(s * .107, -.005, 1.174), (.017, .012, .032), SKIN, 200, seg=32, rings=20))
    obj = f.fuse(parts, "connected-adult-face-neck", SKIN, .0024, 3500)
    co = np.array([v.co[:] for v in obj.data.vertices]); h = ss(1.046, 1.096, co[:, 2])
    f.weighted(obj, rig, {"neck": 1 - h, "head": h})
    for s, side in ((-1, "L"), (1, "R")):
        c = face_point(math.radians(s * 25), 1.206) + V(0, .003, 0)
        eye = f.face(f.ball("eye-form-" + side, c, (.022, .008, .010), IVORY, 200, seg=40, rings=20), "eye" + side, rig)
        f.face(f.ball("pupil-form-" + side, c + V(-s * .001, .007, -.0005), (.0058, .002, .0062), PUPIL, 90, seg=24, rings=12), "pupil" + side, rig, eye)
        for upper in (True, False):
            path = [c + V(t * .021, .003, (.005 + (1 - t * t) * .002 if upper else -.005 - (1 - t * t) * .001)) for t in np.linspace(-1, 1, 21)]
            f.attach(f.tube("eyelid-" + side + str(upper), path, [.0021] * len(path), SKIN, 70, n=8, up=(0, 1, 0)), rig, "head")
        brow = [face_point(math.radians(s * a), 1.226 + .016 * (a - 9) / 31) + V(0, .004, 0) for a in np.linspace(9, 40, 28)]
        f.face(f.tube("brow-form-" + side, brow, [.0055] * len(brow), HAIR_DARK, 130, n=12, up=(0, 1, 0)), "brow" + side, rig)
        # A single brow furrow and lower-eye crease give age without noise.
        path = [face_point(math.radians(s * a), 1.185 - .003 * math.sin(a / 40 * math.pi)) + V(0, .001, 0) for a in np.linspace(16, 39, 20)]
        f.attach(f.tube("weathered-eye-crease-" + side, path, [.0009] * len(path), LIP, 40, n=6, up=(0, 1, 0)), rig, "head")
        f.attach(f.ball("nostril-" + side, face_point(math.radians(s * 12), 1.173) + V(0, .001, 0), (.004, .002, .002), DARK, 30, seg=16, rings=8), rig, "head")
    # A compact, symmetric clench rather than a smile. Teeth are part of the
    # moving mouth control and cannot remain floating when it scales.
    mouth = [face_point(math.radians(a), 1.123 - .003 * (abs(a) / 25) ** 1.4) + V(0, .002, 0) for a in np.linspace(-25, 25, 34)]
    mouth_obj = f.face(f.tube("mouth-clench-form", mouth, [(.0039, .0021)] * len(mouth), DARK, 160, n=10, up=(0, 1, 0)), "mouth", rig)
    lip = [p + V(0, .0006, -.0048) for p in mouth[3:-3]]
    f.attach(f.tube("compressed-lower-lip", lip, [.0018] * len(lip), LIP, 70, n=8, up=(0, 1, 0)), rig, "head")
    teeth = f.tube("clenched-ivory-teeth", [p + V(0, .001, .0008) for p in mouth[6:-6]], [.0012] * len(mouth[6:-6]), IVORY, 50, n=8, up=(0, 1, 0))
    kit.apply_transform(teeth); frame = mouth_obj.matrix_world.copy(); teeth.data.transform(frame.inverted())
    teeth.parent = mouth_obj; teeth.matrix_world = frame


def sideburns(rig):
    for s in (-1, 1):
        rings = []
        for t in np.linspace(0, 1, 40):
            z = 1.111 + .145 * t
            width = profile([(0, .011), (.15, .024), (.48, .030), (.75, .022), (1, .015)], t)[0]
            c = face_point(math.radians(s * (61 + 15 * t)), z) + V(s * .003, .006, 0)
            ring = []
            for j in range(28):
                a = j / 28 * TAU
                lock = .0014 * math.cos(7 * a + t * 4) * math.sin(math.pi * t)
                ring.append(c + V(math.cos(a) * (width * .62 + lock), math.sin(a) * (width + lock), 0))
            rings.append(ring)
        f.attach(f.loft("carved-mutton-chop-" + str(s), rings, HAIR, 440, start="pole", end="pole"), rig, "head")
        for j in range(5):
            path = [face_point(math.radians(s * (60 + j * 4 + 10 * t)), 1.120 + .125 * t) + V(s * .005, .013, 0)
                    for t in np.linspace(0, 1, 22)]
            f.attach(f.tube("ordered-sideburn-lock-" + str(s) + "-" + str(j), path, [.0016] * len(path), HAIR_DARK, 45, n=6, up=(1, 0, 0)), rig, "head")
    # The portrait has heavy sideburns and an exposed, tense mouth: do not
    # hide the face behind the old moustache/beard mass.
    # Short silver hair covers the back and sides of the skull below the
    # shako: from the sideburns' tops at the temples, behind the ears and
    # down to the nape. Combed grooves run downwards; the lower edge thins
    # onto the skin. (The first build left a bare, ridged scalp behind.)
    hair = []
    for z in np.linspace(1.098, 1.300, 30):
        start = .95 + .85 * ss(1.215, 1.150, z) + .45 * ss(1.135, 1.098, z)
        edge = ss(1.098, 1.135, z)
        row = []
        for a in np.linspace(start, TAU - start, 72):
            out = V(math.sin(a), math.cos(a), 0)
            side = min(a - start, TAU - start - a)
            thick = (.0042 + .0011 * math.cos(a * 26)) * edge * ss(0, .18, side) + .0006
            row.append(face_point(a, z) + out * thick)
        hair.append(row)
    f.attach(f.loft("cropped-back-hair", hair, HAIR, 1100, closed=False), rig, "hair")


def boots(s, rig):
    side = "R" if s > 0 else "L"; c = ANKLE[s]
    rings = []
    for z in np.linspace(.023, .338, 65):
        rx, front, back = profile([(.023, .064, .137, .060), (.043, .066, .137, .059),
                    (.070, .064, .122, .058), (.109, .053, .076, .053),
                    (.162, .049, .052, .050), (.260, .054, .058, .052), (.338, .059, .063, .056)], z)
        rings.append([V(c.x + f.geo.spow(math.sin(j / 48 * TAU), 2 / 2.4) * rx,
                          c.y + f.geo.spow(math.cos(j / 48 * TAU), 2 / 2.4) * (front if math.cos(j / 48 * TAU) >= 0 else back), z) for j in range(48)])
    obj = f.loft("connected-gaiter-shoe-" + side, rings, BLACK, 950, True, start="flat", end="flat")
    z = np.array([v.co.z for v in obj.data.vertices]); foot = 1 - ss(.092, .164, z)
    f.weighted(obj, rig, {"knee" + side: 1 - foot, "foot" + side: foot})
    outline = [V(c.x + f.geo.spow(math.sin(j / 48 * TAU), 2 / 2.5) * .066,
                 c.y + f.geo.spow(math.cos(j / 48 * TAU), 2 / 2.5) * (.140 if math.cos(j / 48 * TAU) >= 0 else .062), 0) for j in range(48)]
    f.attach(f.loft("shaped-outsole-" + side, [[p + V(0, 0, z0) for p in outline] for z0 in (.002, .008, .018, .026)], SOLE, 200, start="flat", end="flat"), rig, "foot" + side)
    for j, z0 in enumerate((.157, .189, .221, .253, .285, .317)):
        f.attach(f.ball("gaiter-button-" + side + str(j), V(c.x + s * .054, c.y + .014, z0), (.0038, .004, .004), GOLD_DARK, 18, seg=12, rings=6), rig, "knee" + side)


def uniform(rig, coat):
    for s, side in ((-1, "L"), (1, "R")):
        w, e = WRIST[s], ELBOW[s]; axis = (w - e).normalized()
        cuff = f.tube("deep-blue-cuff-" + side, [w - axis * .075, w - axis * .007],
                      [(.039, .038), (.035, .033)], BLUE, 220, n=40, up=(1, 0, 0), caps=("flat", "flat"))
        f.transfer(cuff, rig, coat)
        f.transfer(f.ball("cuff-button-" + side, w - axis * .032 + V(s * .035, 0, 0), (.007, .004, .007), GOLD, 50), rig, coat)
        # Epaulettes are weighted to the actual shoulder girdle so they
        # rise with the sleeve rather than stay behind on the chest.
        top = f.ball("gold-epaulette-" + side, SHOULDER[s] + V(-s * .015, 0, .015), (.063, .061, .013), GOLD, 240, seg=40, rings=16)
        f.transfer(top, rig, coat)
        for j in range(9):
            a = -.95 + j * 1.9 / 8
            at = SHOULDER[s] + V(s * (.037 * math.cos(a)), .052 * math.sin(a), -.003)
            tip = at + V(s * .011, 0, -.047)
            f.transfer(f.tube("epaulette-fringe-" + side + str(j), [at, (at + tip) / 2, tip], [.0034, .003, .0025], GOLD, 30, n=8, up=(1, 0, 0)), rig, coat)
        for j, z0 in enumerate((.701, .765, .829, .893, .947)):
            f.transfer(f.ball("coatee-button-" + side + str(j), body_point(math.radians(s * 19), z0, .007), (.0075, .0048, .0075), GOLD, 36, seg=20, rings=10), rig, coat)
    collar = [[body_point(j / 64 * TAU, z, .003) for j in range(64)] for z in (1.000, 1.010, 1.041)]
    f.transfer(f.loft("blue-standing-collar", collar, BLUE, 240), rig, coat)
    hem = [body_point(j / 80 * TAU, .585, .001) for j in range(80)]
    f.transfer(f.ring("short-coatee-turned-hem", hem, .003, NAVY, 180), rig, coat)
    for s in (-1, 1):
        # Two cream cross-belts are ribbons on the chest surface, not rods.
        rows = []
        for t in np.linspace(0, 1, 36):
            z = .637 + .345 * t; angle = s * (-40 + 80 * t)
            rows.append([body_point(math.radians(angle + offset), z, .010) for offset in (-5, 5)])
        f.transfer(f.loft("cream-cross-belt-" + str(s), rows, WHITE, 170, closed=False), rig, coat)
    f.attach(f.box("cartridge-box", (.091, .062, .100), V(.144, -.048, .639), BLACK, 160, .006), rig, "torso")
    f.attach(f.box("cartridge-box-flap", (.098, .066, .019), V(.144, -.048, .690), BLACK, 70, .003), rig, "torso")
    f.attach(f.ball("cartridge-clasp", V(.178, -.010, .662), (.008, .003, .007), GOLD_DARK, 30), rig, "torso")


def shako(rig):
    c = V(0, -.011, 1.297)
    rows = [(0, .109, .100), (.017, .112, .102), (.149, .119, .106), (.190, .120, .107)]
    rings = [[c + V(math.sin(j / 64 * TAU) * rx, math.cos(j / 64 * TAU) * ry, z) for j in range(64)] for z, rx, ry in rows]
    f.attach(f.loft("black-felt-shako", rings, FELT, 800, start="flat", end="flat"), rig, "hat")
    f.attach(f.ring("shako-top-leather-roll", rings[-1], .0033, BLACK, 150), rig, "hat")
    f.attach(f.ring("shako-lower-band", rings[1], .0041, BLACK, 180), rig, "hat")
    peak = []
    for v in (0, .25, .75, 1):
        peak.append([c + V(math.sin(a) * (.112 + .012 * v), math.cos(a) * (.102 + .043 * v),
                            -.001 - .012 * v + .006 * abs(math.sin(a))) for a in np.linspace(-1.20, 1.20, 42)])
    obj = f.loft("short-curved-leather-peak", peak, BLACK, 240, closed=False)
    f.select(obj); mod = obj.modifiers.new("Leather peak thickness", "SOLIDIFY"); mod.thickness = .003
    import bpy
    bpy.ops.object.modifier_apply(modifier=mod.name)
    f.attach(obj, rig, "hat")
    frame = Matrix.Translation(V(0, .100, 1.384)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    f.attach(f.plate("shako-brass-lozenge", [(-.022, 0), (0, -.034), (.022, 0), (0, .034)], .004, GOLD, frame, 100), rig, "hat")
    cord = [c + V(math.sin(a) * .115, math.cos(a) * .108, .019 + .018 * math.sin(a) ** 2) for a in np.linspace(-1.55, 1.55, 60)]
    f.attach(f.tube("shako-braided-cord", cord, [.0028] * len(cord), GOLD_DARK, 150, n=10, up=(0, 0, 1)), rig, "hat")
    # Bounded feather plume fits the original 1.583 silhouette. The main
    # volume is tapered and combed, rather than a stack of spheres.
    path = f.smooth_path([V(0, .065, 1.467), V(0, .058, 1.500), V(-.010, .045, 1.538), V(-.019, .033, 1.578)], 10)
    radii = [profile([(0, .014), (.38, .023), (.70, .019), (1, .002)], j / (len(path) - 1))[0] for j in range(len(path))]
    plume = f.tube("carved-cobalt-plume", path, [(r, r * .64) for r in radii], BLUE, 450, n=28, up=(1, 0, 0))
    f.attach(plume, rig, "hat")
    for s in (-1, 1):
        for j in range(8):
            at = path[4 + j * 3]; end = at + V(s * (.015 - j * .001), -.008, .009)
            f.attach(f.tube("plume-ordered-barb-" + str(s) + str(j), [at, end], [.0025, .0008], BLUE, 22, n=8, up=(0, 1, 0)), rig, "hat")


def materials():
    specs = {SKIN: (.68, 0), LIP: (.74, 0), NAIL: (.53, 0), HAIR: (.66, 0), HAIR_DARK: (.70, 0),
             NAVY: (.89, 0), BLUE: (.87, 0), WHITE: (.92, 0), BLACK: (.56, 0), FELT: (.94, 0),
             GOLD: (.28, .80), GOLD_DARK: (.43, .72), IVORY: (.38, 0), PUPIL: (.47, 0)}
    for name, (roughness, metal) in specs.items():
        bsdf = kit.material(name).node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Subsurface Weight"].default_value = 0
        bsdf.inputs["Specular IOR Level"].default_value = .25
        if name in (NAVY, BLUE, WHITE, FELT):
            bsdf.inputs["Sheen Weight"].default_value = .18


def build_master(memory=None):
    root = kit.empty(R); root["unoptimized"] = True; root["relaxedBind"] = True
    root["sourceBrief"] = "work/arena/2026-10-08-roster/gunner/brief-v1.md"
    points, parents = positions(); rig = f.rig(root, points, parents)
    rig["anatomicalPivots"] = json.dumps({n: list(p) for n, p in points.items()})
    coat = jacket(rig)
    if memory: memory("connected-coatee")
    trousers(rig)
    for s in (-1, 1):
        hands(s, rig); boots(s, rig)
        if memory: memory("connected-hand-" + str(s))
    head(rig); sideburns(rig); uniform(rig, coat); shako(rig)
    if memory: memory("face-uniform")
    import figure_gunner_cannon as cannon
    cannon.build(rig)
    materials(); cannon.materials(); f.finish(root); kit.refresh()
    root["cannonWheelRadius"] = WHEEL_R
    root["cannonBar"] = list(BAR)
    return root
