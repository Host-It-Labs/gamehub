"""The Biplane card (id `drake`): a tin-toy biplane, wingspan 1.7 m, about
1.4 m long.

Two stacked team-coloured tin wings with rounded tips and cream roundels,
cream struts and a few chrome rigging wires, a slab-sided tin fuselage with
a folded seam along its back, a round cream cowling with a dark engine face,
a chrome propeller on a spinner (`spin`, turning about +y through the prop
shaft), an open leather-rimmed cockpit with a little pilot in a leather cap,
goggles and a white scarf (`head` is the pilot's head), fixed wheels, a tail
fin, and a small bomb slung under the belly.

The whole plane is the `torso` part, its pivot on the centre of mass; the
root sits on the ground below it, the wheels touching the ground. The game
lifts flyers into the air and banks the torso. An empty `drake.bomb` (child
of the torso) marks where bombs drop from.
"""

import math
import os

import bmesh
import kit
from mathutils import Matrix, Vector
from tin_kit import (CHROME, X, Y, Z, block, centroid, disc, dome, loft,
                     oval_tube, part, plate, rod, superellipse, turned)

TIN = "tin:team"
DARK = "tin:team2"
CREAM = "tin:" + kit.tint("drake-cream", "#f3e3bd")
INK = "tin:" + kit.tint("drake-ink", "#24272e")
BOMB = "tin:" + kit.tint("drake-bomb", "#3d434c")
TYRE = "plastic:" + kit.tint("drake-tyre", "#26262a")
LEATHER = "plastic:" + kit.tint("drake-leather", "#7b4a2c")
SKIN = "plastic:" + kit.tint("drake-skin", "#f3c39f")
LENS = "plastic:" + kit.tint("drake-lens", "#ffbe4d")
GLASS = "plastic:" + kit.tint("drake-glass", "#cfe7f7")
SCARF = "cloth:" + kit.tint("drake-scarf", "#f8f4ea")

# Fuselage stations: (y, width, height, centre z, squareness).
BODY = [(0.47, 0.232, 0.232, 0.36, 2.0), (0.40, 0.246, 0.246, 0.36, 2.2),
        (0.24, 0.256, 0.256, 0.361, 2.5), (0.06, 0.254, 0.254, 0.364, 2.6),
        (-0.12, 0.242, 0.244, 0.37, 2.6), (-0.28, 0.214, 0.222, 0.378, 2.5),
        (-0.44, 0.17, 0.184, 0.389, 2.4), (-0.58, 0.116, 0.134, 0.399, 2.3),
        (-0.68, 0.066, 0.086, 0.406, 2.2), (-0.73, 0.03, 0.046, 0.41, 2.0)]
NOSE = Vector((0, 0, 0.36))           # the cowling and prop axis (z)
PROP_Y = 0.585
PILOT = 1.2                            # the pilot is a size up, to read
COCKPIT = Vector((0, -0.19, 0.0))
UPPER = dict(span=1.7, chord=0.34, lead=0.285, z=0.625, thick=0.036,
             dihedral=0.0, notch=(0.13, 0.05))
LOWER = dict(span=1.5, chord=0.3, lead=0.245, z=0.257, thick=0.032,
             dihedral=math.radians(3), notch=None)
WHEEL = dict(x=0.205, y=0.2, r=0.08)
# The centre of mass in the build coordinates; the plane is moved back by
# its y so the root (the ground point below the pivot) sits under it.
COM = Vector((0, 0.035, 0.42))


def station(y):
    """The fuselage section at `y`, interpolated."""
    for s0, s1 in zip(BODY, BODY[1:]):
        if s1[0] <= y <= s0[0]:
            f = (y - s0[0]) / (s1[0] - s0[0])
            return [a + (b - a) * f for a, b in zip(s0, s1)]
    return list(BODY[0] if y > BODY[0][0] else BODY[-1])


def top_z(y, x=0.0):
    """The height of the fuselage's upper surface at (x, y)."""
    _, w, h, zc, n = station(y)
    a, b = w / 2, h / 2
    k = max(0.0, 1 - abs(x / a) ** n) if a else 0.0
    return zc + b * k ** (1 / n)


# ---------------------------------------------------------------- fuselage


def fuselage(t):
    rings = []
    for y, w, h, zc, n in BODY:
        rings.append([(x, y, zc + z) for x, z in
                      superellipse(w / 2, h / 2, n, 20, math.pi / 20)])
    out = [loft(f"{t}-fuselage", rings, TIN)]
    # The folded seam where the two tin halves meet along the back, from
    # the windscreen to the fin, with folded tabs on it.
    ys = [-0.1 - k * 0.07 for k in range(7)]
    seam = [(0, y, top_z(y) + 0.002) for y in ys]
    out.append(oval_tube(f"{t}-seam", seam, [0.012] * 7, [0.01] * 7, DARK,
                         segments=4))
    for k, y in enumerate((-0.33, -0.46)):
        tab = block(f"{t}-tab{k}", (0.026, 0.02, 0.01),
                    (0, y, top_z(y) + 0.006), CHROME, bevel=0)
        out.append(tab)
    # Round cream cowling with a rolled lip round a dark engine face.
    prof = [(0.128, 0.39), (0.142, 0.415), (0.149, 0.46), (0.148, 0.51),
            (0.141, 0.545), (0.126, 0.556), (0.11, 0.551), (0.104, 0.538)]
    out.append(turned(f"{t}-cowl", [(r, y) for r, y in prof],
                      NOSE, Y, CREAM, segments=22, close=False))
    out.append(turned(f"{t}-engine", [(0.106, 0.0), (0.106, 0.012),
                                      (0.0, 0.012)], NOSE + Y * 0.525, Y,
                      INK, segments=16, close=False))
    for k in range(7):
        a = k / 7 * math.tau + 0.2
        at = NOSE + Y * 0.54 + Vector((math.cos(a), 0, math.sin(a))) * 0.072
        out.append(dome(f"{t}-cyl{k}", 0.019, 0.014, at, Y, CHROME,
                        segments=7, rings=2))
    # Stubby exhaust pipes behind the cowling.
    for sx in (-1, 1):
        a = Vector((sx * 0.112, 0.38, 0.3))
        out.append(turned(f"{t}-exhaust{sx}", [(0.017, 0.0), (0.017, 0.06),
                                               (0.019, 0.07), (0.013, 0.07)],
                          a, Vector((sx * 0.35, -1, -0.25)), CHROME,
                          segments=8, close=False))
    # Cream roundels printed on the fuselage sides, following its curve.
    for sx in (-1, 1):
        out += side_roundel(t, sx, -0.36, 0.045)
    return out


def side_x(y, z):
    """The half width of the fuselage surface at (y, z)."""
    _, w, h, zc, n = station(y)
    a, b = w / 2, h / 2
    k = max(0.0, 1 - min(1.0, abs((z - zc) / b)) ** n)
    return a * k ** (1 / n)


def decal(name, sx, y0, z0, r, lift, mat, segments=16):
    """A round printed disc on the fuselage side: a fan lying `lift` off the
    surface, with a short skirt that tucks its rim into the tin."""
    bm = bmesh.new()

    def at(y, z, off):
        return (sx * (side_x(y, z) + off), y, z)

    rims = []
    for off in (lift, lift - 0.006):
        ring = []
        for i in range(segments):
            a = i / segments * math.tau
            y, z = y0 + r * math.cos(a), z0 + r * math.sin(a)
            ring.append(bm.verts.new(at(y, z, off)))
        rims.append(ring)
    mid = bm.verts.new(at(y0, z0, lift))
    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new((mid, rims[0][i], rims[0][j]))
        bm.faces.new((rims[0][j], rims[0][i], rims[1][i], rims[1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    if sum(f.normal.x for f in bm.faces) * sx < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return kit._from_bmesh(name, bm, mat)


def side_roundel(t, sx, y, r):
    _, w, h, zc, n = station(y)
    return [decal(f"{t}-roundelside{sx}", sx, y, zc, r, 0.003, CREAM),
            decal(f"{t}-dotside{sx}", sx, y, zc, r * 0.4, 0.0048, DARK,
                  segments=10)]


def roundel(t, key, at, normal, r):
    """A cream circle with a dark team dot, lying on a surface."""
    at, normal = Vector(at), Vector(normal)
    return [
        turned(f"{t}-roundel{key}", [(r, -0.002), (r, 0.003), (0.0, 0.003)],
               at, normal, CREAM, segments=16, close=False),
        turned(f"{t}-dot{key}", [(r * 0.4, 0.002), (r * 0.4, 0.0045),
                                 (0.0, 0.0045)],
               at, normal, DARK, segments=10, close=False),
    ]


# ---------------------------------------------------------------- wings


FOIL = [(0.0, 0.0), (0.035, 0.42), (0.11, 0.5), (0.72, 0.5), (1.0, 0.14),
        (1.0, -0.14), (0.72, -0.5), (0.11, -0.5), (0.035, -0.42)]


def wing(name, span, chord, lead, z, thick, dihedral, notch, mat=TIN,
         step=0.12):
    """A flat tin wing along x: a rounded leading edge, a thin trailing
    edge, round tips and (optionally) a notch in the trailing edge over the
    cockpit."""
    half = span / 2
    r = chord / 2
    x0 = half - r
    xs = set()
    n = max(1, round(x0 / step))
    for i in range(-n, n + 1):
        xs.add(round(x0 * i / n, 5))
    if notch:
        for f in (0.35, 0.7):
            xs.add(round(notch[0] * f, 5))
            xs.add(round(-notch[0] * f, 5))
    for deg in (24, 46, 64, 78, 88):
        a = math.radians(deg)
        xs.add(round(x0 + r * math.sin(a), 5))
        xs.add(round(-(x0 + r * math.sin(a)), 5))
    rings = []
    for x in sorted(xs):
        ax = abs(x)
        if ax > x0:
            h = math.sqrt(max(0.0, r * r - (ax - x0) ** 2))
        else:
            h = r
        front = lead - (r - h)
        c = 2 * h
        if notch and ax < notch[0]:
            c -= notch[1] * math.sqrt(1 - (ax / notch[0]) ** 2)
        th = thick * max(0.45, math.sqrt(h / r))
        zc = z + math.tan(dihedral) * ax
        rings.append([(x, front - u * c, zc + v * th / 2) for u, v in FOIL])
    return loft(name, rings, mat)


def wing_top(spec, x, u):
    """A point on the flat top of a wing at span x, chord fraction u."""
    return Vector((x, spec["lead"] - u * spec["chord"],
                   spec["z"] + math.tan(spec["dihedral"]) * abs(x)
                   + spec["thick"] / 2))


def wings(t):
    out = [wing(f"{t}-upper", **UPPER), wing(f"{t}-lower", **LOWER)]
    for sx in (-1, 1):
        out += roundel(t, f"up{sx}", wing_top(UPPER, sx * 0.56, 0.45), Z,
                       0.088)
        # The printed hinge line of the aileron.
        out.append(block(f"{t}-aileron{sx}", (0.3, 0.008, 0.004),
                         wing_top(UPPER, sx * 0.53, 0.76), DARK, bevel=0))
    # Interplane struts near the tips, leaning out to the wider top wing.
    for sx in (-1, 1):
        for u in (0.18, 0.78):
            lo = wing_top(LOWER, sx * 0.6, u)
            hi = wing_top(UPPER, sx * 0.63, u) - Z * UPPER["thick"]
            out.append(oval_tube(f"{t}-strut{sx}{u}", [lo - Z * 0.01,
                                                       hi + Z * 0.01],
                                 [0.03, 0.03], [0.014, 0.014], CREAM,
                                 up=Y, segments=8))
    # Cabane struts from the fuselage's shoulders to the top wing.
    for sx in (-1, 1):
        for u in (0.2, 0.72):
            y = UPPER["lead"] - u * UPPER["chord"]
            lo = Vector((sx * 0.07, y, top_z(y, 0.07) - 0.01))
            hi = Vector((sx * 0.12, y, UPPER["z"] - UPPER["thick"] / 2
                         + 0.005))
            out.append(oval_tube(f"{t}-cabane{sx}{u}", [lo, hi],
                                 [0.024, 0.024], [0.012, 0.012], CREAM,
                                 up=Y, segments=6))
    # Rigging wires: flying wires up from the fuselage to the outer struts,
    # landing wires down from the top wing's root.
    for sx in (-1, 1):
        y = 0.1
        out.append(rod(f"{t}-flying{sx}",
                       (sx * 0.11, y, top_z(y, 0.11) - 0.17),
                       (sx * 0.61, y, UPPER["z"] - UPPER["thick"] / 2),
                       0.0045, segments=6))
        out.append(rod(f"{t}-landing{sx}",
                       (sx * 0.13, y, UPPER["z"] - UPPER["thick"] / 2),
                       (sx * 0.58, y, wing_top(LOWER, 0.58, 0.5).z),
                       0.0045, segments=6))
    return out


# ---------------------------------------------------------------- tail


def tail(t):
    out = [wing(f"{t}-stab", span=0.54, chord=0.17, lead=-0.5, z=0.405,
                thick=0.022, dihedral=0.0, notch=None, step=0.2)]
    fin = [(-0.44, 0.40), (-0.47, 0.45), (-0.52, 0.51), (-0.58, 0.575),
           (-0.63, 0.617), (-0.67, 0.636), (-0.7, 0.634), (-0.722, 0.617),
           (-0.735, 0.585), (-0.74, 0.54), (-0.74, 0.44), (-0.73, 0.40)]
    out.append(plate(f"{t}-fin", fin, 0.024, TIN, axis=X, up=Z, bevel=0.007,
                     seg=1))
    for sx in (-1, 1):
        out += roundel(t, f"fin{sx}", (sx * 0.0125, -0.645, 0.545), X * sx,
                       0.045)
    # A little tail skid.
    out.append(oval_tube(f"{t}-skid", [(0, -0.6, 0.35), (0, -0.645, 0.3),
                                       (0, -0.68, 0.29)],
                         [0.014, 0.012, 0.01], [0.022, 0.018, 0.014], DARK,
                         up=X, segments=6))
    return out


# ---------------------------------------------------------------- gear


def gear(t):
    x, y, r = WHEEL["x"], WHEEL["y"], WHEEL["r"]
    out = [rod(f"{t}-axle", (-x, y, r), (x, y, r), 0.009, segments=8)]
    for sx in (-1, 1):
        c = Vector((sx * x, y, r))
        tyre = [(0.05, -0.021), (0.066, -0.024), (0.077, -0.015),
                (0.08, 0.0), (0.077, 0.015), (0.066, 0.024), (0.05, 0.021)]
        tyre = [(a * r / 0.08, b) for a, b in tyre]
        out.append(turned(f"{t}-tyre{sx}", tyre, c, X, TYRE, segments=16,
                          close=False))
        out.append(dome(f"{t}-hub{sx}", 0.052, 0.016, c + X * sx * 0.018,
                        X * sx, CHROME, segments=14, rings=2))
        out.append(turned(f"{t}-hubin{sx}", [(0.052, 0.0), (0.0, 0.0)],
                          c - X * sx * 0.019, -X * sx, CHROME, segments=12,
                          close=False))
        # A V of struts from the belly down to the axle end.
        foot = c - X * sx * 0.03 + Z * 0.006
        for dy in (0.1, -0.08):
            top = Vector((sx * 0.08, y + dy, LOWER["z"]))
            out.append(oval_tube(f"{t}-leg{sx}{dy}", [top, foot],
                                 [0.024, 0.02], [0.012, 0.011], CREAM,
                                 up=Y, segments=6))
    return out


# ---------------------------------------------------------------- bomb


BOMB_AT = Vector((0, 0.0, 0.18))


def bomb(t):
    c = BOMB_AT
    prof = [(0.0, 0.085), (0.017, 0.078), (0.029, 0.06), (0.034, 0.035),
            (0.034, 0.0), (0.028, -0.035), (0.016, -0.06), (0.008, -0.072),
            (0.0, -0.074)]
    out = [turned(f"{t}-bomb", [(r, y) for r, y in prof], c, Y, BOMB,
                  segments=10, close=False),
           turned(f"{t}-bombband", [(0.0348, 0.034), (0.0348, 0.05)],
                  c, Y, CREAM, segments=10, close=False)]
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        d = Vector((math.cos(a), 0, math.sin(a)))
        fin = plate(f"{t}-bombfin{k}", [(0, 0), (0.03, 0), (0.03, 0.03),
                                        (0.0, 0.012)], 0.004, BOMB,
                    axis=d.cross(Y), up=d, at=c - Y * 0.045)
        out.append(fin)
    # The rack it hangs from, under the lower wing.
    out.append(block(f"{t}-rack", (0.02, 0.1, 0.05),
                     c + Vector((0, 0.0, 0.055)), DARK, bevel=0.004, seg=1))
    return out


# ---------------------------------------------------------------- cockpit


def cockpit(t):
    c = COCKPIT
    rim_z = top_z(c.y)
    at = Vector((0, c.y, rim_z))
    out = [
        turned(f"{t}-coaming", [(0.07, -0.05), (0.07, -0.004), (0.077, 0.009),
                                (0.09, 0.012), (0.097, -0.05)], at, Z, LEATHER,
               segments=16, close=False),
        disc(f"{t}-well", 0.071, 0.01, at - Z * 0.012, Z, INK, segments=14),
    ]
    screen = block(f"{t}-screen", (0.11, 0.006, 0.05),
                   (0, c.y + 0.1, rim_z + 0.03), GLASS, bevel=0.003, seg=1)
    screen.rotation_euler = (math.radians(-28), 0, 0)
    out.append(screen)
    out.append(block(f"{t}-screenframe", (0.116, 0.012, 0.01),
                     (0, c.y + 0.112, rim_z + 0.006), CHROME, bevel=0.003,
                     seg=1))
    # The pilot's shoulders in a leather jacket, and his white scarf: a
    # wrap round the neck and a tail streaming back over the fuselage.
    k = PILOT
    out.append(kit.sphere(f"{t}-jacket", 1.0, (0, c.y - 0.005, rim_z + 0.0),
                          scale=(0.068 * k, 0.055 * k, 0.058 * k),
                          mat=LEATHER, segments=12, rings=6))
    neck = Vector((0, c.y, rim_z + 0.05 * k))
    out.append(turned(f"{t}-wrap", [(0.03 * k, -0.018 * k),
                                    (0.037 * k, -0.008 * k),
                                    (0.037 * k, 0.006 * k),
                                    (0.03 * k, 0.014 * k)],
                      neck, Z, SCARF, segments=12, close=False))
    tail = [neck + Vector((0.026 * k, -0.018 * k, -0.006)),
            neck + Vector((0.046, -0.075, 0.012)),
            neck + Vector((0.058, -0.135, -0.008)),
            neck + Vector((0.074, -0.195, 0.018)),
            neck + Vector((0.088, -0.25, 0.004))]
    out.append(oval_tube(f"{t}-scarftail", tail, [0.04, 0.04, 0.036, 0.03,
                                                  0.02],
                         [0.022, 0.019, 0.016, 0.014, 0.01], SCARF, up=Z,
                         segments=6))
    return out, neck


def pilot_head(t, neck):
    """The pilot's head (built at unit size, then grown by PILOT about the
    neck)."""
    out = _head(t, neck)
    for o in out:
        kit.apply_transform(o)
        o.data.transform(Matrix.Translation(neck) @ Matrix.Scale(PILOT, 4)
                         @ Matrix.Translation(-neck))
    return out


def _head(t, neck):
    c = neck + Vector((0, 0.004, 0.052))
    out = [
        kit.sphere(f"{t}-face", 0.05, c, mat=SKIN, segments=14, rings=8),
        kit.sphere(f"{t}-nose", 0.011, c + Vector((0, 0.05, -0.008)),
                   mat=SKIN, segments=8, rings=4),
        turned(f"{t}-neckp", [(0.024, -0.035), (0.024, 0.0)], c, Z, SKIN,
               segments=10, close=False),
    ]
    # The leather flying cap: a dome tilted back over the crown, ear flaps.
    cap_axis = Vector((0, -0.45, 1)).normalized()
    out.append(dome(f"{t}-cap", 0.055, 0.057, c - cap_axis * 0.006, cap_axis,
                    LEATHER, segments=16, rings=4))
    for sx in (-1, 1):
        out.append(disc(f"{t}-flap{sx}", 0.02, 0.012,
                        c + Vector((sx * 0.048, -0.006, -0.018)), X * sx,
                        LEATHER, segments=10, chamfer=0.004))
    # Goggles over the eyes on a strap round the cap's rim.
    out.append(turned(f"{t}-strap", [(0.0565, 0.0), (0.0565, 0.011)],
                      c - cap_axis * 0.006, cap_axis, INK, segments=16,
                      close=False))
    for sx in (-1, 1):
        at = c + Vector((sx * 0.021, 0.043, 0.012))
        d = Vector((sx * 0.35, 1, 0.1)).normalized()
        out.append(turned(f"{t}-goggle{sx}", [(0.012, 0.009), (0.019, 0.008),
                                              (0.02, 0.0), (0.02, -0.006)],
                          at, d, CHROME, segments=12, close=False))
        out.append(dome(f"{t}-lens{sx}", 0.013, 0.006, at + d * 0.004, d, LENS,
                        segments=12, rings=2))
    return out


# ---------------------------------------------------------------- propeller


def propeller(t):
    hub = Vector((0, PROP_Y, NOSE.z))
    out = [
        rod(f"{t}-shaft", hub - Y * 0.06, hub, 0.012, segments=8),
        turned(f"{t}-spinner", [(0.046, -0.02), (0.047, 0.004),
                                (0.042, 0.028), (0.03, 0.052),
                                (0.0, 0.072)],
               hub, Y, CHROME, segments=16, close=False),
    ]
    foil = [(-0.5, 0.0), (-0.3, 0.5), (0.3, 0.5), (0.5, 0.0), (0.3, -0.5),
            (-0.3, -0.5)]
    blade = [(0.03, 0.036, 0.014, 42), (0.07, 0.05, 0.012, 36),
             (0.12, 0.062, 0.01, 29), (0.17, 0.064, 0.009, 24),
             (0.215, 0.058, 0.008, 20), (0.248, 0.044, 0.007, 17),
             (0.266, 0.028, 0.006, 16), (0.274, 0.01, 0.005, 16)]
    for k in range(2):
        a = math.radians(30 + 180 * k)
        er = Vector((math.cos(a), 0, math.sin(a)))
        et = Y.cross(er)
        rings = []
        for rr, ch, th, pitch in blade:
            p = math.radians(pitch)
            chord = et * math.cos(p) + Y * math.sin(p)
            thick = -et * math.sin(p) + Y * math.cos(p)
            centre = hub + er * rr + Y * 0.004
            rings.append([centre + chord * u * ch + thick * v * th
                          for u, v in foil])
        out.append(loft(f"{t}-blade{k}", rings, CHROME))
    return out, hub


def build(root_name="drake"):
    t = root_name
    root = kit.empty(t)
    shift = Vector((0, -COM.y, 0))

    def moved(objs):
        for o in objs:
            kit.apply(o)
            kit.apply_transform(o)
            o.data.transform(Matrix.Translation(shift))
        return objs

    body, neck = cockpit(t)
    pieces = fuselage(t) + wings(t) + tail(t) + gear(t) + bomb(t) + body
    if os.environ.get("TIN_DEBUG"):
        print("DRAKE centroid", tuple(round(v, 3) for v in centroid(pieces)))
    plane = part(t, "torso", moved(pieces), COM + shift, root)
    part(t, "head", moved(pilot_head(t, neck)), neck + shift, plane)
    blades, hub = propeller(t)
    part(t, "spin", moved(blades), hub + shift, plane)
    drop = kit.empty(f"{t}.bomb", BOMB_AT + shift)
    kit.parent(drop, plane)
    return root
