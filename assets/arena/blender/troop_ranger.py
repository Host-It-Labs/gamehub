"""The Cowboy: a classic painted plastic cowboy figure.

A wide-brimmed team hat, a team shirt under a brown vest with a brass
star, a yellow bandana, team-dark jeans with turn-ups, brown boots with
heels and spurs, and a long lever-action toy rifle with brass fittings held
low and ready in both hands (the right hand on the stock's wrist, the left
under the fore-end).

Built from subdivided quad cages (figures_a); see troops.py for the part
contract. Facing +y, feet on z = 0, about 1.35 tall to the hat's crown.
"""

import math

import bmesh
import kit
from figures_a import (S, decal, elbow, extrude_face, lathe_y, loft,
                       mat_index, place, raise_faces, rbox, rod, slab, slim,
                       stroke, tree)
from mathutils import Matrix, Vector
from troopkit import part

SKIN = "vinyl:" + kit.tint("ranger-skin", "#eebd95")
HAIR = "plastic:" + kit.tint("ranger-hair", "#4b2f1f")
VEST = "plastic:" + kit.tint("ranger-vest", "#7b4a2a")
BELT = "plastic:" + kit.tint("ranger-belt", "#4a2d1b")
BOOT = "plastic:" + kit.tint("ranger-boot", "#8a5431")
SOLE = "plastic:" + kit.tint("ranger-sole", "#3b2519")
BRASS = "chrome:" + kit.tint("ranger-brass", "#d7a443")
STEEL = "chrome:" + kit.tint("ranger-chrome", "#dfe3ea")
WOOD = "plastic:" + kit.tint("ranger-wood", "#a4652f")
GUN = "plastic:" + kit.tint("ranger-gun", "#33373e")
BANDANA = "plastic:" + kit.tint("ranger-bandana", "#f2c23a")
EYE = "plain:" + kit.tint("ranger-eye", "#fbfaf6")
IRIS = "plain:" + kit.tint("ranger-iris", "#2b221d")
MOUTH = "plain:" + kit.tint("ranger-mouth", "#8a3a33")
BROW = "plain:" + kit.tint("ranger-brow", "#4b2f1f")
SHIRT = "plastic:team"
HAT = "plastic:team"
JEANS = "vinyl:team2"

HIP = 0.6
HIP_X = 0.086
WAIST = 0.64
NECK = 0.99
SHOULDER = Vector((0.192, 0.0, 0.935))
UPPER, FORE = 0.215, 0.2       # arm bone lengths
SLIM = 0.7
RIFLE_SCALE = 1.1
PITCH = math.radians(18)       # the rifle points this far below level
YAW = math.radians(6)          # and this far in across the body


def leg(t, side, sx, foot):
    """A jeans leg from its hip ball joint down to a turned-up hem, and a
    brown cowboy boot with a pointed toe, a heel and a spur."""
    hip = Vector((sx * HIP_X, 0, HIP))
    foot = Vector(foot)
    hem = Vector((foot.x, foot.y - 0.012, 0.17))
    knee = hip.lerp(hem, 0.52) + Vector((0, 0.016, 0))

    def edit(bm, info):
        # The turn-up: the last band raised into a folded cuff.
        raise_faces(bm, info["bands"][-1], 0.006, inset=0.0, rim=0.003,
                    crease=0.8, cl=info["cl"])

    limb = loft(f"{t}-leg{side}", [
        S(hip + Vector((0, 0, 0.046)), 0.046),
        S(hip, 0.077),
        S(hip.lerp(knee, 0.3), 0.066, crease=0.8),     # ball-joint seam
        S(knee, 0.064),
        S(hem + Vector((0, 0, 0.03)), 0.074, crease=0.9),
        S(hem, 0.076, crease=0.9),
    ], JEANS, n=8, cap0=0.034, cap1=-0.02, edit=edit)
    f = foot

    def toe(bm, info):
        # Point the toe: pull the front vertex of the foot rings forward.
        for k, (r, pull) in enumerate(zip(info["rings"][:4],
                                          (0.03, 0.03, 0.028, 0.02))):
            v = max(r, key=lambda v: v.co.y)
            v.co.y += pull
            if k >= 2:
                v.co.z -= 0.004

    boot = loft(f"{t}-boot{side}", [
        S((f.x, f.y, 0.0), 0.057, 0.12, oy=0.035, crease=1.0, mat=SOLE),
        S((f.x, f.y, 0.02), 0.059, 0.123, oy=0.035, crease=1.0, mat=BOOT),
        S((f.x, f.y, 0.028), 0.055, 0.116, oy=0.035),
        S((f.x, f.y, 0.08), 0.055, 0.096, oy=0.024),
        S((f.x, f.y - 0.008, 0.14), 0.058, 0.066, oy=0.0),
        S((f.x, f.y - 0.012, 0.24), 0.062, 0.064),
    ], SOLE, n=8, axis=(0, 0, 1), cap0=0.0, cap1=0.0, edit=toe)
    heel = rbox(f"{t}-heel{side}", (0.1, 0.07, 0.046),
                (f.x, f.y - 0.06, 0.023), SOLE, bevel=0.008, segments=1)
    # Spur: a chrome star wheel on a short shank behind the heel.
    star = [(math.cos(a) * (0.024 if i % 2 == 0 else 0.011),
             math.sin(a) * (0.024 if i % 2 == 0 else 0.011))
            for i, a in enumerate(math.pi / 2 + k * math.pi / 5
                                  for k in range(10))]
    rowel = slab(f"{t}-rowel{side}", star, 0.007, STEEL, bevel=0.0,
                 plane="yz")
    place([rowel], at=(f.x, f.y - 0.128, 0.055))
    shank = rod(f"{t}-shank{side}", (f.x, f.y - 0.09, 0.06),
                (f.x, f.y - 0.124, 0.056), 0.006, STEEL, verts=6)
    strap = lathe_y(f"{t}-strap{side}", [
        (0.062, -0.012), (0.066, -0.009), (0.066, 0.009), (0.062, 0.012)],
        BELT, segments=8)
    place([strap], rot=Matrix.Rotation(math.pi / 2, 3, "X") @
          Matrix.Scale(1.0, 3), at=(f.x, f.y - 0.012, 0.075))
    for v in strap.data.vertices:          # squash the ring round the ankle
        v.co.y = (f.y - 0.012) + (v.co.y - (f.y - 0.012)) * 1.05
    pieces = [slim(limb, 0.62), slim(boot, 0.6), heel, rowel, shank, strap]
    return part(t, f"leg{side}", pieces, hip, None)


def fist(t, side, wrist, fwd, grip_axis, thumb_face, thumb_steps,
         size=(0.078, 0.047, 0.036)):
    """A skin-coloured mitten fist: wrist, palm and knuckles along `fwd`,
    wrapped round an object running along `grip_axis`, with a thumb."""
    w = Vector(wrist)
    f = Vector(fwd).normalized()
    g = Vector(grip_axis)
    g = (g - f * g.dot(f)).normalized()
    u = g.cross(f).normalized()
    length, width, thick = size
    secs = [
        S(w - f * 0.02, 0.036),
        S(w + f * 0.012, 0.036, 0.04),
        S(w + f * length * 0.55, thick, width),
        S(w + f * length, thick * 0.84, width * 0.86),
    ]

    def edit(bm, info):
        face = info["bands"][1][thumb_face]
        extrude_face(bm, face, thumb_steps(face))

    return slim(loft(f"{t}-hand{side}", secs, SKIN, n=8, ref=u, cap0=None,
                     cap1=thick * 0.9, edit=edit), SLIM)


def arm(t, side, sx, wrist, elbow_at, fwd, grip_axis, thumb_face,
        thumb_steps):
    """A team shirt sleeve from its shoulder ball joint, with a buttoned
    cuff, and the fist."""
    s = Vector((sx * SHOULDER.x, SHOULDER.y, SHOULDER.z))
    w, e = Vector(wrist), Vector(elbow_at)
    up = (e - s).normalized()
    fo = (w - e).normalized()
    sleeve = loft(f"{t}-arm{side}", [
        S(s - up * 0.044, 0.044),
        S(s, 0.066),
        S(s + up * 0.052, 0.055, crease=0.8),       # ball-joint seam
        S(e - up * 0.02, 0.054),
        S(e + fo * 0.03, 0.052),
        S(w - fo * 0.055, 0.049, crease=0.8),
        S(w - fo * 0.01, 0.051, crease=0.8),
    ], SHIRT, n=8, cap0=0.03, cap1=-0.01)
    hand = fist(t, side, w, fwd, grip_axis, thumb_face, thumb_steps)
    return [slim(sleeve, 0.6), hand]


def rifle(t):
    """A lever-action toy rifle in its own frame: the right hand's grip on
    the stock's wrist at the origin, the barrel along +y, top toward +z.
    The muzzle is at (0, 0.49, 0.015) * RIFLE_SCALE."""
    parts = []
    # Stock: a tapered wooden butt with a flat, creased butt plate.
    parts.append(slim(loft(f"{t}-stock", [
        S((0, -0.27, -0.024), 0.022, 0.052, sq=0.6, crease=0.9),
        S((0, -0.256, -0.024), 0.023, 0.052, sq=0.6),
        S((0, -0.12, -0.008), 0.019, 0.033, sq=0.7),
        S((0, -0.03, 0.0), 0.016, 0.022, sq=0.8),
    ], WOOD, n=8, axis=(0, 1, 0), ref=(1, 0, 0), cap0=0.0, cap1=None),
        SLIM))
    parts.append(rbox(f"{t}-buttplate", (0.046, 0.008, 0.104),
                      (0, -0.272, -0.024), BRASS, bevel=0.003, segments=1))
    # Brass receiver with a dark loading gate.
    parts.append(rbox(f"{t}-receiver", (0.036, 0.13, 0.058),
                      (0, 0.03, 0.004), BRASS, bevel=0.008, segments=2))
    parts.append(rbox(f"{t}-gate", (0.038, 0.04, 0.02), (0, 0.05, -0.004),
                      GUN, bevel=0.004, segments=1))
    # The lever: a brass loop under the wrist, the fingers through it.
    loop = kit.lathe(f"{t}-lever", [
        (0.034 + 0.0065 * math.cos(a), 0.0065 * math.sin(a))
        for a in (math.tau * i / 5 for i in range(6))], segments=10,
        mat=BRASS, close=False)
    loop.data.transform(Matrix.Scale(0.62, 4, (1, 0, 0)) @
                        Matrix.Scale(1.25, 4, (0, 1, 0)))
    place([loop], rot=Matrix.Rotation(math.pi / 2, 3, "Y"),
          at=(0, -0.012, -0.05))
    parts.append(loop)
    # Barrel and magazine tube, dark; a wooden fore-end under them.
    parts.append(lathe_y(f"{t}-barrel", [
        (0.0, 0.09), (0.017, 0.09), (0.017, 0.47), (0.019, 0.474),
        (0.019, 0.49), (0.0, 0.49)], GUN, segments=10))
    place([parts[-1]], at=(0, 0, 0.015))
    parts.append(lathe_y(f"{t}-magazine", [
        (0.0, 0.09), (0.0125, 0.09), (0.0125, 0.44), (0.0, 0.444)], GUN,
        segments=8))
    place([parts[-1]], at=(0, 0, -0.014))
    parts.append(slim(loft(f"{t}-forend", [
        S((0, 0.09, -0.006), 0.019, 0.022, sq=0.8),
        S((0, 0.3, -0.006), 0.018, 0.02, sq=0.8),
    ], WOOD, n=8, axis=(0, 1, 0), ref=(1, 0, 0), cap0=0.004, cap1=0.01),
        SLIM))
    # Brass barrel bands, front sight and rear sight.
    for k, y in enumerate((0.31, 0.43)):
        band = kit.lathe(f"{t}-band{k}", [
            (0.024, -0.007), (0.028, -0.005), (0.028, 0.005), (0.024, 0.007)],
            segments=8, mat=BRASS)
        band.data.transform(Matrix.Scale(1.0, 4) @
                            Matrix.Scale(1.25, 4, (0, 0, 1)))
        place([band], rot=Matrix.Rotation(-math.pi / 2, 3, "X"),
              at=(0, y, 0.002))
        parts.append(band)
    parts.append(rbox(f"{t}-sight", (0.007, 0.018, 0.02), (0, 0.472, 0.036),
                      BRASS, bevel=0.002, segments=1))
    parts.append(rbox(f"{t}-rearsight", (0.02, 0.012, 0.012),
                      (0, 0.16, 0.033), GUN, bevel=0.003, segments=1))
    for o in parts:
        o.data.transform(Matrix.Scale(RIFLE_SCALE, 4))
    return parts


def torso(t, root):
    """Jeans hips, a moulded brown belt with a brass buckle, a team shirt
    under a raised brown vest with a brass star, and a yellow bandana."""
    ring = [
        (0.555, 0.094, 0.078), (0.6, 0.142, 0.1), (0.64, 0.14, 0.098),
        (0.688, 0.142, 0.099), (0.79, 0.158, 0.106), (0.885, 0.172, 0.112),
        (0.95, 0.166, 0.102), (0.99, 0.08, 0.066)]
    secs = [S((0, 0, z), rx, ry) for z, rx, ry in ring]
    secs[0]["mat"] = JEANS
    secs[3]["mat"] = SHIRT

    def edit(bm, info):
        cl, b = info["cl"], info["bands"]
        raise_faces(bm, b[2], 0.012, inset=0.0, rim=0.003,
                    mi=mat_index(info, BELT), crease=0.7, cl=cl)
        # The vest: open down the front in a V, open at the armholes.
        vest = [b[3][s] for s in range(12) if s != 1]
        vest += [b[4][s] for s in range(12) if s != 1]
        vest += [b[5][s] for s in range(12) if s not in (0, 1, 2, 4, 10)]
        raise_faces(bm, vest, 0.009, inset=0.0, rim=0.003,
                    mi=mat_index(info, VEST), crease=0.8, cl=cl)

    body = slim(loft(f"{t}-body", secs, JEANS, n=12, axis=(0, 0, 1),
                     cap0=0.03, cap1=None, edit=edit), 0.6, sym=True)
    pieces = [body]
    bvh = tree([body])

    def on_body(x, z):
        loc, nrm, _, _ = bvh.ray_cast(Vector((x, 0.5, z)), Vector((0, -1, 0)))
        return loc, nrm

    loc, nrm = on_body(0.0, 0.664)
    buckle = loft(f"{t}-buckle", [
        S((0, -0.004, 0), 0.036, 0.026, sq=0.6),
        S((0, 0.009, 0), 0.033, 0.023, sq=0.6, crease=0.6)],
        BRASS, n=8, axis=(0, 1, 0), ref=(1, 0, 0), cap0=None, cap1=0.003,
        levels=0)
    place([buckle], rot=nrm.to_track_quat("Y", "Z"), at=loc)
    pieces.append(buckle)
    # A five-pointed brass star on the vest's left breast.
    star = [(math.cos(a) * (0.034 if i % 2 == 0 else 0.015),
             math.sin(a) * (0.034 if i % 2 == 0 else 0.015))
            for i, a in enumerate(math.pi / 2 + k * math.pi / 5
                                  for k in range(10))]
    badge = slab(f"{t}-star", star, 0.008, BRASS, bevel=0.0025, segments=1,
                 plane="xz")
    loc, nrm = on_body(-0.088, 0.855)
    place([badge], rot=nrm.to_track_quat("Y", "Z"), at=loc)
    pieces.append(badge)
    # Bandana: a rolled yellow neckerchief, its point hanging in front.
    pieces.append(kit.lathe(f"{t}-bandana", [
        (0.064, 0.962), (0.086, 0.966), (0.097, 0.984), (0.094, 1.004),
        (0.078, 1.018), (0.062, 1.02)], segments=12, mat=BANDANA,
        close=False))
    flap = slab(f"{t}-flap", [(-0.074, 0.0), (0.074, 0.0), (0.012, -0.094),
                              (-0.012, -0.094)], 0.012, BANDANA,
                bevel=0.005, segments=1, plane="xz")
    place([flap], rot=Matrix.Rotation(math.radians(-14), 3, "X"),
          at=(0, 0.094, 0.99))
    pieces.append(flap)
    pieces.append(slim(loft(f"{t}-knot", [
        S((0, 0.098, 0.975), 0.02, 0.016)], BANDANA, n=8, axis=(0, 1, 0),
        ref=(1, 0, 0), cap0=0.012, cap1=0.014), 1.0))
    return part(t, "torso", pieces, (0, 0, WAIST), root)


def head(t, torso_obj):
    """A friendly painted face with brown hair under a wide team hat."""
    ring = [
        (0.985, 0.05, 0.048, -0.01), (1.025, 0.057, 0.055, -0.004),
        (1.046, 0.084, 0.084, 0.012), (1.082, 0.1, 0.094, 0.013),
        (1.132, 0.106, 0.098, 0.008), (1.18, 0.1, 0.094, 0.0),
        (1.216, 0.075, 0.072, -0.004)]
    secs = [S((0, 0.0, z), rx, ry, oy=oy) for z, rx, ry, oy in ring]

    def edit(bm, info):
        b = info["bands"]
        nose = b[3][1]
        n = nose.normal.copy()
        extrude_face(bm, nose, [(n * 0.016 + Vector((0, 0, -0.004)), 0.62),
                                (n * 0.008, 0.72)])
        for s in (4, 10):
            ear = b[3][s]
            n = ear.normal.copy()
            extrude_face(bm, ear, [(n * 0.012, 0.72), (n * 0.004, 0.8)])
        hair = list(b[5]) + [b[4][s] for s in range(4, 11)] + \
            [b[3][s] for s in range(5, 10)]
        raise_faces(bm, hair, 0.008, inset=0.0, rim=0.003,
                    mi=mat_index(info, HAIR), crease=0.7, cl=info["cl"])

    face = slim(loft(f"{t}-face", secs, SKIN, n=12, axis=(0, 0, 1),
                     cap0=None, cap1=0.03, edit=edit), 0.55, sym=True)
    pieces = [face]
    fb = tree([face])
    for sx in (-1, 1):
        ex, ez = sx * 0.04, 1.138
        pieces.append(decal(f"{t}-eye{sx}", fb, (ex, 0.4, ez), 0.017, 0.021,
                            EYE, lift=0.0015, n=14))
        pieces.append(decal(f"{t}-iris{sx}", fb,
                            (ex + sx * 0.001, 0.4, ez - 0.003), 0.012, 0.015,
                            IRIS, lift=0.003, n=12))
        pieces.append(decal(f"{t}-glint{sx}", fb,
                            (ex + 0.004, 0.4, ez + 0.003), 0.004, 0.004, EYE,
                            lift=0.0045, n=8))
        pieces.append(stroke(f"{t}-brow{sx}", fb, [
            (sx * 0.02, 0.4, 1.166), (sx * 0.04, 0.4, 1.172),
            (sx * 0.06, 0.4, 1.168)], 0.009, BROW, lift=0.0015, taper=0.6))
    pieces.append(stroke(f"{t}-smile", fb, [
        (-0.034, 0.4, 1.074), (-0.017, 0.4, 1.064), (0.0, 0.4, 1.061),
        (0.017, 0.4, 1.064), (0.034, 0.4, 1.074)], 0.008, MOUTH,
        lift=0.0015))

    # The hat: a wide oval brim curled up at the sides, a pinched crown
    # with a crease down its top and a dark band, tipped back a little.
    z0 = 1.176

    # The brim is a surface of revolution: lathed at full resolution with a
    # rounded edge, then made oval and curled up at the sides.
    brim = kit.lathe(f"{t}-brim", [
        (0.1, z0 + 0.007), (0.238, z0 + 0.0065), (0.258, z0 + 0.0035),
        (0.258, z0 - 0.0035), (0.238, z0 - 0.0065), (0.1, z0 - 0.007)],
        segments=36, mat=HAT, close=False)
    for v in brim.data.vertices:
        v.co.y *= 1.1
        ax = abs(v.co.x)
        v.co.z += 1.7 * max(0.0, ax - 0.095) ** 2
        v.co.z -= 0.5 * max(0.0, abs(v.co.y) - 0.13) ** 2
    brim.data.shade_smooth()

    def crown_edit(bm, info):
        raise_faces(bm, info["bands"][0], 0.006, inset=0.0, rim=0.003,
                    mi=mat_index(info, BELT), crease=0.7, cl=info["cl"])
        top = z0 + 0.145
        for v in bm.verts:
            # A crease down the crown from front to back, and front pinches.
            if v.co.z > top - 0.03:
                v.co.z -= 0.024 * math.exp(-(v.co.x / 0.03) ** 2) * \
                    min(1.0, (v.co.z - (top - 0.03)) / 0.03)
            if v.co.z > z0 + 0.06 and v.co.y > 0.02:
                v.co.x *= 1 - 0.28 * min(1.0, v.co.y / 0.1) * \
                    min(1.0, (v.co.z - z0 - 0.06) / 0.06)

    crown = slim(loft(f"{t}-crown", [
        S((0, 0, z0 - 0.004), 0.113, 0.124),
        S((0, 0, z0 + 0.03), 0.111, 0.121, crease=0.5),
        S((0, 0, z0 + 0.1), 0.1, 0.112),
        S((0, 0, z0 + 0.155), 0.08, 0.094)],
        HAT, n=12, axis=(0, 0, 1), cap0=None, cap1=0.016, edit=crown_edit),
        0.75, sym=True)
    hat = [brim, crown]
    tilt = (Matrix.Translation((0, 0, z0)) @
            Matrix.Rotation(math.radians(11), 4, "X") @
            Matrix.Translation((0, 0, -z0)))
    for o in hat:
        o.data.transform(tilt)
    pieces += hat
    return part(t, "head", pieces, (0, 0, NECK), torso_obj)


def build(root_name="ranger"):
    t = root_name
    root = kit.empty(t)
    for side, sx, foot in (("L", -1, (-0.118, 0.035, 0)),
                           ("R", 1, (0.118, -0.03, 0))):
        kit.parent(leg(t, side, sx, foot), root)
    body = torso(t, root)
    head(t, body)

    # Right arm: the rifle carried one-handed at the hip, pointing forward
    # and down; the forearm rides along the top of the stock and the hand
    # wraps down round its wrist, the stock tucked under the elbow.
    d = Vector((-math.sin(YAW) * math.cos(PITCH), math.cos(YAW) *
                math.cos(PITCH), -math.sin(PITCH)))
    top = (Vector((0, 0, 1)) - d * d.z).normalized()
    side = d.cross(top).normalized()
    s_r = Vector((SHOULDER.x, SHOULDER.y, SHOULDER.z))
    e_r = s_r + Vector((0.13, -0.2, -1.0)).normalized() * UPPER
    fore = (d + Vector((0.07, 0.0, 0.06))).normalized()
    w_r = e_r + fore * FORE
    fwd_r = (-top + d * 0.35).normalized()
    grip = w_r + fwd_r * 0.046

    def thumb_r(face):
        n = face.normal.copy()
        return [(n * 0.012 + d * 0.006, 0.85), (d * 0.024 + n * 0.004, 0.8)]

    arm_r = arm(t, "R", 1, w_r, e_r, fwd_r, d, 2, thumb_r)
    right = part(t, "armR", arm_r, s_r, body)
    gun = rifle(t)
    frame = Matrix((side, d, top)).transposed()
    place(gun, rot=frame, at=grip)
    part(t, "weapon", gun, grip, right)

    # Left arm: thumb hooked in the belt beside the buckle, elbow out.
    s_l = Vector((-SHOULDER.x, SHOULDER.y, SHOULDER.z))
    fwd_l = Vector((0.2, 0.18, -1.0)).normalized()
    hand_l = Vector((-0.1, 0.118, 0.636))
    w_l = hand_l - fwd_l * 0.04
    e_l = elbow(s_l, w_l, UPPER, FORE, Vector((-1.0, -0.35, 0.1)))

    def thumb_l(face):
        n = face.normal.copy()
        return [(n * 0.01 + Vector((0, -0.004, 0.012)), 0.85),
                (Vector((0.004, -0.008, 0.018)), 0.8)]

    arm_l = arm(t, "L", -1, w_l, e_l, fwd_l, Vector((1, 0, 0)), 2, thumb_l)
    part(t, "armL", arm_l, s_l, body)
    return root
