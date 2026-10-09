"""The Pirate's face controls (9 October 2026): eyes, irises, brows and the
open shouting mouth's teeth and tongue, as separate meshes that the
master attaches to the head in centred surface frames (faces.ts blinks,
squints and moves them).

- eyeL/R: the visible eyeball (a lens filling the lid aperture). Its
  vertical squash in its own frame is a blink: the fixed lids and the
  socket floor of the head sculpt stay.
- pupilL/R: iris, pupil and a catchlight conforming to the eyeball
  (children of their eye).
- browL/R: thick, tapered brows pinched down towards the nose.
- mouth: the dark mouth interior, upper and lower teeth and the tongue,
  sitting inside the sculpted lips; its vertical scale opens the shout.
"""
import math

import bmesh
import bpy
import numpy as np

import kit
import figure_pirate_body as B
import figure_pirate_kit as pk


def mesh(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(map(int, f)) for f in faces])
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(kit.material(material))
    me.shade_smooth()
    return obj


def grid_faces(rows, cols, closed=False):
    faces = []
    cc = cols if closed else cols - 1
    for i in range(rows - 1):
        for j in range(cc):
            a = i * cols + j
            b = i * cols + (j + 1) % cols
            faces.append((a, b, b + cols, a + cols))
    return faces


def ellipsoid_mesh(name, centre, radii, R, material, seg=40, rings=20):
    verts, faces = [], []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg):
            ph = math.tau * j / seg
            local = np.array([math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph),
                              math.cos(th)]) * radii
            verts.append(np.asarray(centre) + R @ local)
    faces = grid_faces(rings + 1, seg, closed=True)
    obj = mesh(name, verts, faces, material)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.shade_smooth()
    return obj


def eye_disc(name, s, radius, lift, material, offset=(0.0, 0.0), rings=10, seg=40):
    """A disc conforming to the eyeball's front (a lens of the eye's own
    radii grown by `lift`), centred at `offset` (x outward, z up)."""
    R = B.eye_frame(s)
    rx, ry, rz = (r + lift for r in B.EYE_RADII)
    verts = [None]
    pts = []
    ox, oz = offset
    for i in range(rings + 1):
        rho = radius * i / rings
        for j in range(seg if i else 1):
            th = math.tau * j / seg
            x, z = ox + rho * math.cos(th), oz + rho * math.sin(th)
            y = ry * math.sqrt(max(0.0, 1 - (x / rx) ** 2 - (z / rz) ** 2))
            pts.append(B.EYE[s] + R @ np.array([x, y, z]))
    faces = [(0, 1 + (j + 1) % seg, 1 + j) for j in range(seg)]
    for i in range(1, rings):
        a0 = 1 + (i - 1) * seg
        a1 = 1 + i * seg
        for j in range(seg):
            faces.append((a0 + j, a0 + (j + 1) % seg, a1 + (j + 1) % seg, a1 + j))
    del verts
    return mesh(name, pts, faces, material)


def eyes():
    out = []
    for s in (-1, 1):
        R = B.eye_frame(s)
        ball = ellipsoid_mesh(f"pirate-eye-{s}", B.EYE[s], np.array(B.EYE_RADII), R, pk.EYE)
        # The gaze converges a touch on the foe ahead (x is outward).
        look = (-.0011, -.0006)
        iris = eye_disc(f"pirate-iris-{s}", s, .0068, .00030, pk.IRIS, look)
        pupil = eye_disc(f"pirate-pupil-{s}", s, .0032, .00055, pk.PUPIL, look)
        glint = eye_disc(f"pirate-glint-{s}", s, .0011, .00075, pk.EYE,
                         (look[0] - .0022, look[1] + .0020), rings=3, seg=16)
        out += [ball, iris, pupil, glint]
    return out


def surface_point(sc, p, direction, reach=.02):
    """Bisect along `direction` from p for the sculpt's zero level."""
    p, direction = np.asarray(p, float), np.asarray(direction, float)
    a, b = p - direction * reach, p + direction * reach
    fa = sc.at(a[None])[0]
    for _ in range(40):
        m = (a + b) / 2
        fm = sc.at(m[None])[0]
        if (fm < 0) == (fa < 0):
            a, fa = m, fm
        else:
            b = m
    return (a + b) / 2


def brows(sc):
    """Thick brows hugging the brow ridge, low and pinched at the nose,
    rising to the outer corner: a glare."""
    out = []
    for s in (-1, 1):
        n = 18
        ts = np.linspace(0, 1, n)
        xs = s * (.0095 + .0445 * ts)
        zs = 1.1770 + .0130 * ts - .0030 * (ts - .5) ** 2
        origins = np.stack([xs * .4, np.full(n, .02), zs], 1)
        dirs = np.stack([xs * .6, np.full(n, .075), np.zeros(n)], 1)
        dirs /= np.linalg.norm(dirs, axis=1)[:, None]
        surf = B.project(sc, origins, dirs, reach=.09)
        nrm = B.gradient(sc, surf)
        pts = surf + nrm * .0007
        widths = .0046 - .0026 * ts ** 1.4
        depths = .0015 - .0005 * ts
        verts, seg = [], 12
        for i in range(n):
            tan = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
            tan /= np.linalg.norm(tan)
            nn = nrm[i] - tan * (nrm[i] @ tan)
            nn /= np.linalg.norm(nn)
            up = np.cross(tan, nn)
            if up[2] < 0:
                up = -up
            for j in range(seg):
                ang = math.tau * j / seg
                verts.append(pts[i] + up * math.cos(ang) * widths[i] + nn * math.sin(ang) * depths[i])
        faces = grid_faces(n, seg, closed=True)
        base = len(verts)
        verts += [pts[0], pts[-1]]
        faces += [(base, (j + 1) % seg, j) for j in range(seg)]
        last = (n - 1) * seg
        faces += [(base + 1, last + j, last + (j + 1) % seg) for j in range(seg)]
        obj = mesh(f"pirate-brow-{s}", verts, faces, pk.HAIR)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
        out.append(obj)
    return out


def mouth_parts():
    """Interior, teeth and tongue inside the sculpted lips."""
    M = B.MOUTH
    parts = [ellipsoid_mesh("pirate-mouth-interior", M - np.array([0, .0115, .0015]),
                            np.array([.0215, .0060, .0140]), np.eye(3), pk.MOUTH, seg=32, rings=16)]

    def band(name, x_half, z_of, y_back, thick, material, rows=4, cols=24):
        verts = []
        xs = np.linspace(-x_half, x_half, cols)
        for i in range(rows):
            v = i / (rows - 1)
            for x in xs:
                z0, z1 = z_of(x)
                z = z0 + (z1 - z0) * v
                y = M[1] + B.face_y(x) * 1.25 - y_back
                verts.append((x, y, z))
        front = len(verts)
        for i in range(rows):
            v = i / (rows - 1)
            for x in xs:
                z0, z1 = z_of(x)
                z = z0 + (z1 - z0) * v
                y = M[1] + B.face_y(x) * 1.25 - y_back - thick
                verts.append((x, y, z))
        faces = [tuple(reversed(f)) for f in grid_faces(rows, cols)]
        faces += [tuple(fi + front for fi in f) for f in grid_faces(rows, cols)]
        # Close the rim.
        ring = list(range(cols)) + [i * cols + cols - 1 for i in range(1, rows)] + \
            [(rows - 1) * cols + j for j in range(cols - 2, -1, -1)] + \
            [i * cols for i in range(rows - 2, 0, -1)]
        for a, b in zip(ring, ring[1:] + ring[:1]):
            faces.append((a, b, b + front, a + front))
        obj = mesh(name, verts, faces, material)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def upper(x):
        u, _ = B.mouth_edges(x)
        return u - .0048 + .0012 * (abs(x) / .014) ** 2, u + .0020
    parts.append(band("pirate-teeth-upper", .0142, upper, .0030, .0030, pk.TEETH))

    def lower(x):
        _, lo = B.mouth_edges(x)
        return lo - .0020, lo + .0026 - .0008 * (abs(x) / .011) ** 2
    parts.append(band("pirate-teeth-lower", .0112, lower, .0040, .0028, pk.TEETH))
    _, lo0 = B.mouth_edges(0.0)
    parts.append(ellipsoid_mesh("pirate-tongue", np.array([0, M[1] - .0085, lo0 + .0006]),
                                np.array([.0115, .0070, .0036]), np.eye(3), pk.TONGUE,
                                seg=28, rings=14))
    return parts


def controls(sc=None):
    """All face control meshes in world space, named for attach_faces."""
    sc = sc or B.head_only()
    return eyes() + brows(sc) + mouth_parts()
