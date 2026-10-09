"""Private Robots v1 master: engineered 1950s enamelled wind-up tins.

One canonical robot per asset, deployed three times by the existing card.
Hard chassis plates use rigid bone attachments; only small bellows deform.
The relaxed wrist chains are compatible with shared reach. The two lower
pincer jaws are offhand/weapon, children of handL/handR, not wrists themselves.
"""
import json
import math

import numpy as np
from mathutils import Matrix

import kit
import figure_imps_forms as f
from figure_imps_forms import V, TAU

R = "imps"
ENAMEL = "lacquer:" + kit.tint("team:imps", "#2c63cd")
ENAMEL_DARK = "lacquer:" + kit.tint("team2:imps", "#193971")
ENAMEL_LIGHT = "lacquer:" + kit.tint("team3:imps", "#789de8")
CREAM = "tin:" + kit.tint("imps-v1-cream", "#e7d6ad")
CHROME = "chrome:" + kit.tint("imps-v1-chrome", "#d7e0e9")
GUNMETAL = "tin:" + kit.tint("imps-v1-gunmetal", "#46505b")
BLACK = "resin:" + kit.tint("imps-v1-black", "#131a23")
AMBER = "glow:" + kit.tint("imps-v1-amber", "#ffb12e")
AMBER_DARK = "lacquer:" + kit.tint("imps-v1-lamp-rim", "#ad6623")
RED = "lacquer:" + kit.tint("imps-v1-dial-danger", "#b24732")

WAIST = V(0, 0, .280)
NECK = V(0, 0, .535)
SHOULDER = {s: V(s * .168, 0, .485) for s in (-1, 1)}
ELBOW = {s: V(s * .183, .010, .373) for s in (-1, 1)}
WRIST = {s: V(s * .188, .068, .260) for s in (-1, 1)}
HIP = {s: V(s * .072, 0, .235) for s in (-1, 1)}
KNEE = {s: V(s * .072, 0, .163) for s in (-1, 1)}
ANKLE = {s: V(s * .072, 0, .046) for s in (-1, 1)}
KEY = V(0, -.109, .425)
GAUGE = V(0, .111, .439)
EYES = {s: V(s * .043, .102, .643) for s in (-1, 1)}
ANTENNA = V(0, -.009, .729)


def claw_frame(s):
    down = (WRIST[s] - ELBOW[s]).normalized()
    across = V(1, 0, 0)
    up = across.cross(down).normalized()
    return down, up, across


def positions():
    points = {"torso": WAIST, "head": NECK, "antenna": ANTENNA,
              "extra": V(0, .095, .672), "extra2": GAUGE, "spin": KEY}
    parents = {"head": "torso", "antenna": "head", "extra": "head", "extra2": "torso", "spin": "torso"}
    for s, side in ((-1, "L"), (1, "R")):
        down, _, _ = claw_frame(s)
        points.update({"arm" + side: SHOULDER[s], "fore" + side: ELBOW[s], "hand" + side: WRIST[s],
                       "leg" + side: HIP[s], "knee" + side: KNEE[s], "foot" + side: ANKLE[s]})
        parents.update({"arm" + side: "torso", "fore" + side: "arm" + side, "hand" + side: "fore" + side,
                        "knee" + side: "leg" + side, "foot" + side: "knee" + side})
        jaw = "offhand" if side == "L" else "weapon"
        points[jaw] = WRIST[s] + down * .027
        parents[jaw] = "hand" + side
    return points, parents


def turned(name, centre, axis, rows, material, target=100, n=40):
    axis = V(axis).normalized(); u = axis.orthogonal().normalized(); v = axis.cross(u).normalized()
    rings = [[centre + axis * z + (u * math.cos(j / n * TAU) + v * math.sin(j / n * TAU)) * r
              for j in range(n)] for z, r in rows]
    return f.loft(name, rings, material, target)


def washer(name, centre, axis, radius, material, target=100):
    r, h = radius, .005
    return turned(name, centre, axis, [(-h, r * .55), (-h, r * .91), (-h * .4, r),
                    (h * .4, r), (h, r * .91), (h, r * .55), (-h, r * .55)], material, target)


def fastener(name, at, normal, rig, part, radius=.0032):
    normal = V(normal).normalized()
    obj = turned(name + "-head", at, normal, [(-.001, 0), (-.001, radius), (.0015, radius), (.0023, radius * .70), (.0023, 0)], CHROME, 16, n=16)
    f.attach(obj, rig, part)
    cross = normal.orthogonal().normalized()
    f.attach(f.tube(name + "-slot", [at + normal * .0024 - cross * radius * .60, at + normal * .0024 + cross * radius * .60],
                     [.0006] * 2, BLACK, 8, n=4, up=normal, caps=("flat", "flat")), rig, part)


def chassis(rig):
    # A tapered pressed shell with real planar sides and modest rolled edges.
    vertices = [(sx * rx, sy * ry, z) for z, rx, ry in ((.310, .123, .091), (.522, .147, .097))
                for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    obj = f.allocated(f.bevel(f.mesh("pressed-enamel-chassis", vertices, faces, ENAMEL, smooth=False), .010, 5), 600)
    f.attach(obj, rig, "torso")
    panel = f.box("cream-pressed-chest-panel", (.231, .012, .159), V(0, .103, .414), CREAM, 350, .006)
    f.attach(panel, rig, "torso")
    border = [V(x, .110, z) for x, z in ((-.112, .339), (.112, .339), (.112, .488), (-.112, .488))]
    f.attach(f.ring("panel-rolled-border", border, .0016, GUNMETAL, 110, up=(0, 1, 0), n=8), rig, "torso")
    for j, (x, z) in enumerate(((-.105, .348), (.105, .348), (-.105, .477), (.105, .477))):
        fastener("panel-screw-" + str(j), V(x, .110, z), (0, 1, 0), rig, "torso")
    f.attach(f.box("rear-service-hatch", (.160, .010, .131), V(0, -.102, .420), ENAMEL_DARK, 140, .006), rig, "torso")
    for s in (-1, 1):
        f.attach(f.box("lithographed-side-panel-" + str(s), (.007, .120, .114), V(s * .140, -.001, .427), ENAMEL_DARK, 90, .003), rig, "torso")
        for j in range(3):
            f.attach(f.box("side-vent-slot-" + str(s) + str(j), (.008, .069, .007), V(s * .145, -.006, .389 + j * .017), BLACK, 24, .001), rig, "torso")
        for j, z in enumerate((.377, .479)):
            fastener("side-screw-" + str(s) + str(j), V(s * .146, .050, z), (s, 0, 0), rig, "torso")
    # Small enamel chips are designed at vulnerable corners. No generated
    # noise, no all-over random scratches and no visual text/logos.
    for j, (x, z, w) in enumerate(((-.128, .507, .012), (.131, .496, .007), (-.119, .323, .009), (.124, .352, .006))):
        frame = Matrix.Translation(V(x, .098, z)) @ Matrix.Rotation(math.pi / 2, 4, "X")
        outline = [(-w / 2, -.002), (w / 2, -.001), (w * .2, .002), (-w * .3, .003)]
        f.attach(f.plate("edge-enamel-chip-" + str(j), outline, .0006, GUNMETAL, frame, 12, .0002), rig, "torso")
    # Flexible waist is the one small continuous skin that exports the rig.
    # The broad enamel plates are rigid, so they never bend like flesh.
    rows = [(z, .087 if j % 2 else .079) for j, z in enumerate(np.linspace(.242, .317, 13))]
    bellows = f.loft("connected-waist-bellows", [[V(math.sin(j / 32 * TAU) * r, math.cos(j / 32 * TAU) * r * .73, z)
                     for j in range(32)] for z, r in rows], GUNMETAL, 420, True, start="flat", end="flat")
    f.weighted(bellows, rig, {"torso": np.ones(len(bellows.data.vertices))})


def gauge(rig):
    c = GAUGE
    # Inset dial, cream face, raised chrome bezel and a pivoted dark needle.
    f.attach(f.ball("gauge-recess", c, (.072, .005, .044), BLACK, 180, seg=48, rings=24), rig, "torso")
    f.attach(f.ball("gauge-ivory-dial", c + V(0, .004, .001), (.065, .0025, .038), CREAM, 150, seg=48, rings=24), rig, "torso")
    path = [c + V(math.cos(a) * .070, .006, math.sin(a) * .043) for a in np.linspace(0, TAU, 64, endpoint=False)]
    f.attach(f.ring("gauge-rolled-chrome-bezel", path, .0026, CHROME, 160, up=(0, 1, 0)), rig, "torso")
    for j in range(9):
        a = .15 + j * (math.pi - .30) / 8
        at = c + V(math.cos(a) * .055, .007, math.sin(a) * .030)
        end = c + V(math.cos(a) * .049, .007, math.sin(a) * .024)
        f.attach(f.tube("dial-tick-" + str(j), [at, end], [.0009] * 2, RED if j < 2 else BLACK, 10, n=6, up=(0, 1, 0)), rig, "torso")
    f.attach(f.tube("gauge-moving-needle", [c + V(0, .010, 0), c + V(-.026, .010, .026)], [.0018, .0009], BLACK, 40, n=10, up=(0, 1, 0)), rig, "extra2")
    f.attach(f.ball("gauge-needle-hub", c + V(0, .011, 0), (.0045, .002, .0045), CHROME, 28), rig, "extra2")
    for j, x in enumerate((-.065, 0, .065)):
        at = V(x, .115, .365)
        f.attach(washer("amber-lamp-bezel-" + str(j), at, (0, 1, 0), .016, AMBER_DARK, 70), rig, "torso")
        f.attach(f.ball("amber-chest-lamp-" + str(j), at + V(0, .004, 0), (.0115, .006, .0115), AMBER, 90), rig, "torso")


def head(rig):
    f.attach(turned("nested-neck-socket", NECK + V(0, 0, -.014), (0, 0, 1),
                    [(-.015, .029), (-.012, .035), (.005, .035), (.009, .025)], GUNMETAL, 130), rig, "head")
    f.attach(f.box("bevelled-square-head", (.216, .176, .204), V(0, 0, .638), ENAMEL, 900, .012), rig, "head")
    f.attach(f.box("face-recess-panel", (.185, .006, .143), V(0, .089, .630), ENAMEL_DARK, 200, .007), rig, "head")
    for s, side in ((-1, "L"), (1, "R")):
        c = EYES[s]
        f.attach(washer("eye-chrome-socket-" + side, c, (0, 1, 0), .034, CHROME, 150), rig, "head")
        eye = f.face(f.ball("eye-form-" + side, c + V(0, .003, 0), (.027, .0065, .027), AMBER, 230, seg=48, rings=24), "eye" + side, rig)
        f.face(f.ball("pupil-form-" + side, c + V(-s * .002, .009, 0), (.008, .002, .0105), BLACK, 85, seg=28, rings=16), "pupil" + side, rig, eye)
        # Sloping lower inner tips give an angry, determined expression.
        x0, x1 = s * .013, s * .083
        path = [V(x0 + (x1 - x0) * t, .110, .662 + .019 * t) for t in np.linspace(0, 1, 18)]
        f.face(f.tube("brow-form-" + side, path, [(.005, .008)] * len(path), CHROME, 110, n=10, up=(0, 1, 0)), "brow" + side, rig)
        lid = f.box("eye-hinged-shutter-" + side, (.064, .006, .018), V(s * .043, .112, .673), ENAMEL, 80, .003)
        f.attach(lid, rig, "extra")
        f.attach(turned("head-side-earcap-" + side, V(s * .112, -.008, .639), (s, 0, 0),
                        [(-.003, .020), (0, .026), (.007, .026), (.010, .019)], CHROME, 140), rig, "head")
        fastener("earcap-screw-" + side, V(s * .125, -.008, .639), (s, 0, 0), rig, "head", .005)
    # Entire mouth grille is under a live centred frame; dark slots travel
    # with the control instead of remaining behind during a reaction.
    mouth = f.face(f.box("mouth-form", (.096, .009, .043), V(0, .098, .581), CHROME, 140, .003), "mouth", rig)
    for j in range(3):
        slot = f.box("mouth-grille-slot-" + str(j), (.077, .002, .005), V(0, .104, .569 + j * .011), BLACK, 24, .001)
        kit.apply_transform(slot); frame = mouth.matrix_world.copy(); slot.data.transform(frame.inverted())
        slot.parent = mouth; slot.matrix_world = frame
    # Two pressed seams, visible from rear and side.
    for s in (-1, 1):
        path = [V(s * .107, -.020, z) for z in np.linspace(.558, .720, 25)]
        f.attach(f.tube("head-panel-seam-" + str(s), path, [.0011] * len(path), GUNMETAL, 40, n=6, up=(0, 1, 0)), rig, "head")


def antenna(rig):
    c = ANTENNA
    f.attach(turned("antenna-seat", c, (0, 0, 1), [(-.004, .016), (.004, .016), (.011, .009)], CHROME, 110, n=32), rig, "head")
    path = [c + V(math.cos(t * TAU * 3) * .004, math.sin(t * TAU * 3) * .004, .009 + .019 * t)
            for t in np.linspace(0, 1, 60)]
    f.attach(f.tube("coiled-antenna-spring", path, [.0014] * len(path), GUNMETAL, 170, n=8, up=(1, 0, 0)), rig, "antenna")
    f.attach(f.tube("chrome-antenna-stem", [c + V(0, 0, .026), c + V(0, 0, .071)], [.0033, .0029], CHROME, 80, n=24, up=(1, 0, 0)), rig, "antenna")
    f.attach(f.ball("antenna-chrome-ball", c + V(0, 0, .079), (.011, .011, .011), CHROME, 130, seg=32, rings=20), rig, "antenna")


def key(rig):
    c = KEY
    f.attach(washer("key-fixed-bearing", c, (0, -1, 0), .020, GUNMETAL, 110), rig, "torso")
    f.attach(f.tube("key-shaft", [c + V(0, .005, 0), V(0, -.257, .425)], [.008] * 2, CHROME, 130, n=32, up=(1, 0, 0), caps=("flat", "flat")), rig, "spin")
    f.attach(washer("key-shaft-collar", V(0, -.243, .425), (0, -1, 0), .014, CHROME, 90), rig, "spin")
    # Pierced butterfly wings, constructed as sealed annular sheets rather
    # than booleaned blocks. Their actual holes survive runtime reduction.
    for s in (-1, 1):
        centre = V(0, -.260, .425 + s * .049)
        rings = []
        for y, rx, rz in ((-.007, .037, .048), (.007, .037, .048),
                          (.007, .022, .031), (-.007, .022, .031), (-.007, .037, .048)):
            rings.append([centre + V(math.sin(j / 56 * TAU) * rx, y, math.cos(j / 56 * TAU) * rz) for j in range(56)])
        obj = f.loft("pierced-windup-key-wing-" + str(s), rings, CHROME, 350)
        # Weld the duplicate closure ring before simplification.
        import bmesh
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
        f.attach(obj, rig, "spin")
    f.attach(f.box("key-butterfly-waist", (.035, .014, .030), V(0, -.260, .425), CHROME, 100, .004), rig, "spin")


def pincer(s, rig):
    side = "R" if s > 0 else "L"; down, up, across = claw_frame(s)
    base = WRIST[s] + down * .014; pin = WRIST[s] + down * .027
    # Thick hooked jaw, with an honest open channel between the paired jaws.
    outline = [(0, .006), (.019, .009), (.038, .020), (.060, .026),
               (.083, .016), (.100, .007), (.104, .017), (.089, .042),
               (.063, .058), (.035, .053), (.011, .034), (0, .022)]
    frame = Matrix(((down.x, up.x, across.x, base.x - across.x * .010),
                    (down.y, up.y, across.y, base.y - across.y * .010),
                    (down.z, up.z, across.z, base.z - across.z * .010), (0, 0, 0, 1)))
    f.attach(f.plate("fixed-chrome-pincer-" + side, outline, .020, CHROME, frame, 430, .0025), rig, "hand" + side)
    lower = [(x, -y) for x, y in reversed(outline)]
    f.attach(f.plate("moving-chrome-pincer-" + side, lower, .020, CHROME, frame, 430, .0025), rig, "offhand" if s < 0 else "weapon")
    f.attach(turned("pincer-nested-knuckle-" + side, pin, (1, 0, 0),
                    [(-.014, 0), (-.014, .018), (.014, .018), (.014, 0)], GUNMETAL, 100), rig, "hand" + side)
    f.attach(turned("pincer-hinge-pin-" + side, pin, (1, 0, 0),
                    [(-.019, 0), (-.019, .008), (.019, .008), (.019, 0)], CHROME, 60, n=24), rig, "hand" + side)


def arms(s, rig):
    side = "R" if s > 0 else "L"; a, e, w = SHOULDER[s], ELBOW[s], WRIST[s]
    f.attach(washer("shoulder-inner-washer-" + side, a, (s, 0, 0), .035, GUNMETAL, 100), rig, "torso")
    f.attach(turned("enamel-shoulder-drum-" + side, a, (s, 0, 0),
                    [(-.020, .027), (-.017, .043), (.024, .043), (.029, .037)], ENAMEL, 230), rig, "arm" + side)
    f.attach(washer("shoulder-chrome-cap-" + side, a + V(s * .030, 0, 0), (s, 0, 0), .025, CHROME, 110), rig, "arm" + side)
    fastener("shoulder-screw-" + side, a + V(s * .036, 0, 0), (s, 0, 0), rig, "arm" + side, .005)
    # Tailored box shells round their actual hinge axes and nest over the
    # moving cylinder, keeping the articulation connected at extremes.
    direction = (e - a).normalized()
    upper = f.box("upper-arm-enamel-shell-" + side, (.050, .057, .083), (a + e) / 2, ENAMEL, 260, .006)
    upper.rotation_euler = V(0, 0, 1).rotation_difference(-direction).to_euler()
    f.attach(upper, rig, "arm" + side)
    f.attach(turned("elbow-chrome-hinge-" + side, e, (1, 0, 0),
                    [(-.030, 0), (-.030, .024), (.030, .024), (.030, 0)], CHROME, 140), rig, "fore" + side)
    fore = f.box("forearm-enamel-shell-" + side, (.052, .057, .093), (e + w) / 2, ENAMEL, 260, .005)
    fore.rotation_euler = V(0, 0, 1).rotation_difference(-(w - e).normalized()).to_euler()
    f.attach(fore, rig, "fore" + side)
    f.attach(washer("wrist-nested-cuff-" + side, w, (w - e).normalized(), .033, CHROME, 130), rig, "fore" + side)
    pincer(s, rig)


def legs(s, rig):
    side = "R" if s > 0 else "L"; h, k, a = HIP[s], KNEE[s], ANKLE[s]
    f.attach(turned("hip-pivot-drum-" + side, h, (1, 0, 0),
                    [(-.029, 0), (-.029, .028), (.029, .028), (.029, 0)], GUNMETAL, 110), rig, "leg" + side)
    f.attach(f.box("enamel-thigh-shell-" + side, (.055, .068, .068), V(h.x, 0, .207), ENAMEL, 200, .006), rig, "leg" + side)
    f.attach(turned("knee-pin-" + side, k, (1, 0, 0),
                    [(-.033, 0), (-.033, .022), (.033, .022), (.033, 0)], CHROME, 130), rig, "knee" + side)
    f.attach(f.box("pressed-shin-shell-" + side, (.059, .065, .092), V(a.x, .007, .108), ENAMEL, 260, .005), rig, "knee" + side)
    f.attach(washer("ankle-socket-" + side, a, (0, 0, 1), .023, GUNMETAL, 90), rig, "foot" + side)
    f.attach(f.box("square-toe-chrome-shoe-" + side, (.090, .137, .041), V(a.x, .025, .029), CHROME, 260, .004), rig, "foot" + side)
    f.attach(f.box("shoe-dark-sole-" + side, (.092, .138, .009), V(a.x, .025, .0045), BLACK, 100, .001), rig, "foot" + side)
    for j in range(4):
        f.attach(f.box("toe-pressed-flute-" + side + str(j), (.074, .002, .002), V(a.x, .070 - j * .012, .050), GUNMETAL, 12, .0004), rig, "foot" + side)


def materials():
    for name, rough, metal in ((ENAMEL, .29, .25), (ENAMEL_DARK, .36, .22), (ENAMEL_LIGHT, .30, .20),
                              (CREAM, .43, .35), (CHROME, .16, 1), (GUNMETAL, .46, .63),
                              (BLACK, .74, 0), (AMBER_DARK, .31, .4), (RED, .42, .25)):
        bsdf = kit.material(name).node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Roughness"].default_value = rough; bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Subsurface Weight"].default_value = 0
    kit.material(AMBER).node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 2.3


def build_master(memory=None):
    root = kit.empty(R); root["unoptimized"] = True; root["relaxedBind"] = True
    root["sourceBrief"] = "work/arena/2026-10-08-roster/imps/brief-v1.md"
    root["deployedCopiesPerCard"] = 3; root["pincerJointContract"] = "handL/R wrists; offhand/weapon lower jaws"
    points, parents = positions(); rig = f.rig(root, points, parents)
    rig["anatomicalPivots"] = json.dumps({n: list(p) for n, p in points.items()})
    chassis(rig); gauge(rig); head(rig); antenna(rig); key(rig)
    if memory: memory("robot-chassis-face-key")
    for s in (-1, 1): arms(s, rig); legs(s, rig)
    materials(); f.finish(root); kit.refresh()
    if memory: memory("robot-engineered-master")
    return root
