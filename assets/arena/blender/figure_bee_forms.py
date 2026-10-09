"""Authored Bee surfaces, independent of Blender for CPU inspection.

The master and game sampling use the same silhouettes and pivots. Only the
master has cuticle grooves, thorax nap and fine vein relief. The low-density
copy is sampled deliberately; no figure-wide decimator reshapes the face.
All coordinates are Blender +Y forward, Z up, at the original native scale.
"""
from dataclasses import dataclass, field
import math


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, k):
    return tuple(x * k for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def normal(a):
    length = math.sqrt(dot(a, a))
    return mul(a, 1 / length) if length > 1e-12 else (0, 0, 1)


def lerp(a, b, t):
    return a * (1-t) + b * t


def catmull(points, samples):
    """A contained curved centerline, rather than straight capsule links."""
    result = []
    for index in range(len(points)-1):
        a, b, c, d = (points[max(0, index-1)], points[index],
                      points[index+1], points[min(len(points)-1, index+2)])
        for j in range(samples):
            t = j / samples
            result.append(tuple(.5 * (2*b[k] + (-a[k]+c[k])*t +
                (2*a[k]-5*b[k]+4*c[k]-d[k])*t*t +
                (-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(3)))
    result.append(points[-1])
    return result


PALETTE = {
    "gold": ("resin:bee-honey-v1", "#edb52d", .58, 0),
    "dark": ("resin:bee-coal-v1", "#342b23", .60, 0),
    "nap": ("hair:bee-nap-v1", "#ce9825", .78, 0),
    "eye": ("lacquer:bee-eye-v1", "#181a1b", .24, 0),
    "ivory": ("lacquer:bee-ivory-v1", "#fff2cb", .31, 0),
    "wing": ("lacquer:bee-wing-v1", "#e8eee8", .35, 0),
    "vein": ("resin:bee-vein-v1", "#c5b58b", .55, 0),
    "team": ("resin:team", "#376cdd", .58, 0),
}


@dataclass
class Mesh:
    name: str
    part: str
    vertices: list
    faces: list
    materials: list

    @property
    def triangles(self):
        return sum(len(f)-2 for f in self.faces)

    def normals(self):
        result = [(0, 0, 0) for _ in self.vertices]
        for face in self.faces:
            a, b, c = [self.vertices[index] for index in face[:3]]
            n = cross(sub(b, a), sub(c, a))
            for index in face:
                result[index] = add(result[index], n)
        return [normal(value) for value in result]


@dataclass
class Figure:
    master: bool
    meshes: list = field(default_factory=list)
    # Every control is a common-axis frame. The expressed head/eye shapes
    # are authored in rest, not produced by a hidden neutral A-pose.
    pivots: dict = field(default_factory=lambda: {
        "torso": (0, .043, .163),
        "head": (0, .091, .181),
        # Ventral waist hinge: a high belly-centre pivot curled the broad
        # cuticle into the thorax and buried the leg roots on a full sting.
        "tail": (0, .023, .140),
        "tail2": (0, -.154, .151),
        "wingL": (-.028, .051, .206),
        "wingR": (.028, .051, .206),
        "antenna": (0, .121, .221),
        "extra": (.038, .020, .145),
        "extra2": (-.038, .020, .145),
        "armL": (-.038, .069, .145),
        "armR": (.038, .069, .145),
        "beeeyeL": (-.028, .171, .200),
        "beeeyeR": (.028, .171, .200),
        "beepupilL": (-.027, .177, .199),
        "beepupilR": (.027, .177, .199),
        "beebrowL": (-.029, .176, .222),
        "beebrowR": (.029, .176, .222),
        "beemouth": (0, .193, .171),
    })
    parents: dict = field(default_factory=lambda: {
        "torso": None, "head": "torso", "tail": "torso",
        "tail2": "tail", "wingL": "torso", "wingR": "torso",
        "antenna": "head", "extra": "torso", "extra2": "torso",
        "armL": "torso", "armR": "torso",
        "beeeyeL": "head", "beeeyeR": "head",
        "beepupilL": "beeeyeL", "beepupilR": "beeeyeR",
        "beebrowL": "head", "beebrowR": "head", "beemouth": "head",
    })

    def mesh(self, name, part, verts, faces, material):
        mats = [material] * len(faces) if isinstance(material, str) else material
        result = Mesh(name, part, verts, faces, mats)
        self.meshes.append(result)
        return result

    @property
    def triangles(self):
        return sum(mesh.triangles for mesh in self.meshes)

    def bounds(self):
        points = [v for mesh in self.meshes for v in mesh.vertices]
        lo = tuple(min(v[k] for v in points) for k in range(3))
        hi = tuple(max(v[k] for v in points) for k in range(3))
        return {"min": lo, "max": hi, "dimensions": sub(hi, lo)}


def loft(figure, name, part, profile, sides, material, shape=None):
    """Longitudinal cuticle panels: y, half-width, half-height, z-center."""
    vertices, faces, mats = [], [], []
    for j, (y, rx, rz, center) in enumerate(profile):
        for i in range(sides):
            angle = i/sides*math.tau
            x, z = rx*math.cos(angle), rz*math.sin(angle)
            if shape:
                x, z = shape(x, z, y, angle, j)
            vertices.append((x, y, z+center))
    for j in range(len(profile)-1):
        for i in range(sides):
            a, b = j*sides+i, j*sides+(i+1) % sides
            faces.append((a, a+sides, b+sides, b))
            mats.append(material(j, i) if callable(material) else material)
    for bottom, j, sign in ((True, 0, -1), (False, len(profile)-1, 1)):
        y, _, _, z = profile[j]
        at = len(vertices)
        vertices.append((0, y, z))
        for i in range(sides):
            a, b = j*sides+i, j*sides+(i+1) % sides
            faces.append((at, a, b) if bottom else (at, b, a))
            mats.append(material(j if bottom else j-1, i) if callable(material)
                        else material)
    return figure.mesh(name, part, vertices, faces, mats)


def lens(figure, name, part, center, radii, material, sides, levels):
    """Purposeful oval eye/club lens with unique polar vertices."""
    vertices, faces = [add(center, (0, 0, -radii[2]))], []
    for j in range(1, levels):
        lat = -math.pi/2 + j/levels*math.pi
        for i in range(sides):
            a = i/sides*math.tau
            vertices.append(add(center, (radii[0]*math.cos(lat)*math.cos(a),
                radii[1]*math.cos(lat)*math.sin(a), radii[2]*math.sin(lat))))
    vertices.append(add(center, (0, 0, radii[2])))
    for i in range(sides):
        faces.append((0, 1+(i+1) % sides, 1+i))
    for j in range(levels-2):
        for i in range(sides):
            a, b = 1+j*sides+i, 1+j*sides+(i+1) % sides
            faces.append((a, b, b+sides, a+sides))
    top = len(vertices)-1
    start = 1+(levels-2)*sides
    for i in range(sides):
        faces.append((top, start+i, start+(i+1) % sides))
    return figure.mesh(name, part, vertices, faces, material)


def tube(figure, name, part, points, radii, material, sides):
    vertices, faces = [], []
    previous_u = None
    for j, point in enumerate(points):
        tangent = normal(sub(points[min(j+1, len(points)-1)],
                             points[max(0, j-1)]))
        # Parallel-transport the cross-section. Switching reference axes
        # partway down a curved knee/feeler created visible zigzag collars
        # even in the detailed master.
        if previous_u is None:
            reference = (0, 1, 0) if abs(tangent[2]) > .92 else (0, 0, 1)
            u = normal(cross(tangent, reference))
        else:
            u = normal(sub(previous_u, mul(tangent, dot(previous_u, tangent))))
        previous_u = u
        v = normal(cross(tangent, u))
        for i in range(sides):
            a = i/sides*math.tau
            vertices.append(add(point, add(mul(u, radii[j]*math.cos(a)),
                                            mul(v, radii[j]*math.sin(a)))))
    for j in range(len(points)-1):
        for i in range(sides):
            a, b = j*sides+i, j*sides+(i+1) % sides
            faces.append((a, b, b+sides, a+sides))
    for j in (0, len(points)-1):
        at = len(vertices)
        vertices.append(points[j])
        for i in range(sides):
            a, b = j*sides+i, j*sides+(i+1) % sides
            faces.append((at, b, a) if j == 0 else (at, a, b))
    return figure.mesh(name, part, vertices, faces, material)


def sample_profile(profile, samples):
    # Dense source sections interpolate the same authored profile without
    # altering longitudinal band borders in the lower-density sample.
    output, intervals = [], []
    for j in range(len(profile)-1):
        a, b, c, d = (profile[max(0,j-1)], profile[j], profile[j+1],
                       profile[min(len(profile)-1,j+2)])
        for k in range(samples):
            t = k/samples
            # Smooth source meridians keep the head and posterior rounded.
            # The runtime retains the named structural control sections.
            value = [lerp(b[0],c[0],t)]
            for axis in range(1,4):
                value.append(.5*(2*b[axis]+(-a[axis]+c[axis])*t+
                    (2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t*t+
                    (-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t*t*t))
            output.append(tuple(value))
            intervals.append(j)
    output.append(profile[-1])
    intervals.append(len(profile)-2)
    return output, intervals


def wing(figure, side):
    sx = -1 if side == "L" else 1
    part = "wing"+side
    detailed = figure.master
    # Convex ovoid membranes narrow into their hinge. The forewing sweeps
    # back; the shorter hindwing is a distinct lobe behind it.
    for suffix, length, width, ybase, count in (
            ("fore", .176, .060, .060, 64 if detailed else 12),
            ("hind", .121, .047, .022, 48 if detailed else 8)):
        verts, faces = [], []
        rootx, rootz = .028, .206
        for zside in (-1, 1):
            for i in range(count):
                a = i/count*math.tau
                u = (1+math.cos(a))*.5
                # Width is richest in the distal third and tapers toward
                # the wing root; the lower edge has a shallow organic scallop.
                x = rootx + length*u
                y = ybase + width*math.sin(a)*(.34+.66*u) - .051*u
                z = rootz + .012*u + zside*.00125
                verts.append((sx*x, y, z))
        centers = []
        for zside in (-1, 1):
            centers.append(len(verts))
            verts.append((sx*(rootx+length*.53), ybase-.051*.53,
                          rootz+.012*.53+zside*.00125))
        for i in range(count):
            j = (i+1) % count
            faces += [(centers[0], j, i),
                      (centers[1], count+i, count+j),
                      (i, j, count+j, count+i)]
        if sx < 0:
            faces = [tuple(reversed(face)) for face in faces]
        figure.mesh("bee-"+part+"-"+suffix, part, verts, faces, "wing")
        # Two restrained veins on each forewing, sampled as ridged strokes.
        # Main field-scale wing outline is protected, rather than vanishing
        # under alpha or a noisy embossed web.
        if suffix == "fore":
            for branch in (-1, 1):
                points = [(sx*(rootx+.007), ybase-.001, rootz+.0015),
                          (sx*(rootx+.075), ybase-.016+branch*.013, rootz+.007),
                          (sx*(rootx+.145), ybase-.035+branch*.014, rootz+.012)]
                points = catmull(points, 8) if detailed else points
                tube(figure, "bee-"+part+"-vein"+str(branch), part, points,
                     [.00075*(1-.6*j/(len(points)-1)) for j in range(len(points))],
                     "vein", 6 if detailed else 3)


def build_forms(master=False):
    figure = Figure(master)
    samples, sides = (10, 96) if master else (1, 16)
    abdomen = [(-.166, .005, .006, .151), (-.158, .017, .016, .153),
               (-.142, .047, .042, .152),
               (-.110, .069, .057, .153), (-.079, .081, .066, .153),
               (-.043, .083, .067, .157), (-.013, .073, .061, .162),
               (.010, .054, .045, .165), (.029, .035, .031, .165)]
    profile, intervals = sample_profile(abdomen, samples)
    def band(j, _i):
        return "dark" if intervals[j] in (2, 4, 6) else "gold"
    def cuticle(x, z, y, angle, _j):
        if not master:
            return x, z
        # Restrained physical grooves at segment ends; broad cuticle planes
        # remain smooth. No identical all-over pebble noise.
        groove = sum(.0011*math.exp(-((y-edge)/.0014)**2)
                     for edge in (-.142, -.110, -.079, -.043, -.013, .010))
        r = max(.006, math.hypot(x, z))
        return x*(1-groove/r), z*(1-groove/r)
    loft(figure, "bee-segmented-abdomen", "tail", profile, sides, band, cuticle)
    tube(figure, "bee-sting", "tail2",
         [(0, -.151, .151), (0, -.171, .146), (0, -.194, .140)],
         [.010, .0055, .0005], "dark", 12 if master else 5)

    thorax = [(-.008, .033, .039, .168), (.010, .048, .051, .168),
              (.045, .054, .053, .171), (.078, .045, .043, .173),
              (.095, .029, .030, .174)]
    profile, _ = sample_profile(thorax, 8 if master else 1)
    def nap(x, z, y, angle, _j):
        if not master:
            return x, z
        # Fine dorsal fur rhythm follows the neck-to-wing growth, diminishing
        # under the wings and avoiding a uniformly bumpy thorax.
        dorsal = max(0, math.sin(angle))**2
        amp = .0016*dorsal*math.sin(angle*29 + y*360)**2
        r = max(.01, math.hypot(x, z))
        return x*(1+amp/r), z*(1+amp/r)
    loft(figure, "bee-furred-thorax", "torso", profile,
         80 if master else 12, "nap", nap)

    # Cuticle mask: connected forehead, cheek flare and tapered jaw. The
    # flattening toward the face makes an oval shield, rather than a ball.
    head = [(.079, .024, .028, .183), (.094, .044, .041, .184),
            (.123, .058, .046, .185), (.151, .060, .043, .184),
            (.173, .046, .032, .179), (.185, .026, .022, .173),
            (.191, .008, .009, .159)]
    profile, _ = sample_profile(head, 9 if master else 1)
    def mask(x, z, y, angle, _j):
        # Broad cheek/brow landmarks distinguish the head from the round
        # thorax. The lower cheek flares before the pointed mandible mask.
        cheek = 1 + .045*math.exp(-((angle-5.65)/.35)**2)
        brow = .0015*max(0, math.sin(angle))*math.exp(-((y-.151)/.017)**2)
        return x*cheek, z+brow
    loft(figure, "bee-shaped-head-cuticle", "head", profile,
         96 if master else 16, "dark", mask)
    for sx, side in ((-1, "L"), (1, "R")):
        eye = figure.pivots["beeeye"+side]
        lens(figure, "bee-ivory-eye"+side, "beeeye"+side, eye,
             (.020, .0048, .021), "ivory", 40 if master else 10,
             24 if master else 4)
        pupil = figure.pivots["beepupil"+side]
        lens(figure, "bee-focused-pupil"+side, "beepupil"+side, pupil,
             (.010, .003, .012), "eye", 32 if master else 8,
             20 if master else 3)
        brow = [(sx*.012, .177, .218), (sx*.027, .179, .226),
                (sx*.047, .171, .226)]
        brow = catmull(brow, 10) if master else brow
        tube(figure, "bee-brow-rim"+side, "beebrow"+side, brow,
             [lerp(.0048, .0013, j/(len(brow)-1)) for j in range(len(brow))],
             "dark", 10 if master else 3)
        feeler = [(sx*.020, .118, .224), (sx*.028, .120, .247),
                  (sx*.039, .139, .260), (sx*.047, .151, .254)]
        feeler = catmull(feeler, 9) if master else feeler
        tube(figure, "bee-feeler-stalk"+side, "antenna", feeler,
             [lerp(.0032, .002, j/(len(feeler)-1)) for j in range(len(feeler))],
             "dark", 10 if master else 4)
        lens(figure, "bee-feeler-club"+side, "antenna", feeler[-1],
             (.0037, .006, .004), "dark", 20 if master else 5,
             12 if master else 3)

    mouth = [(-.013, .190, .168), (0, .195, .172), (.013, .190, .168)]
    tube(figure, "bee-closed-mouth", "beemouth",
         catmull(mouth, 8) if master else mouth,
         [.0018]* (17 if master else 3), "eye", 8 if master else 3)

    # The bees keep their natural yellow/black cuticle. The former raised
    # team-colour saddle read as a stray blue dot in the real Blender review.

    # Six legs have coxa, bent tibia and a tapered curved tarsus. Their tips
    # are part of the same slender profile: no capsule socket ornaments.
    for sx, side in ((-1, "L"), (1, "R")):
        # All six coxae belong to the thorax, including the hind pair.
        # Rear abdominal attachments looked fine at rest but floated when
        # the abdomen curled underneath for the sting.
        for index, y in enumerate((.070, .036, .004)):
            part = "arm"+side if index == 0 else ("extra2" if side == "L" else "extra")
            points = [(sx*.038, y, .145), (sx*.064, y-.010, .121),
                      (sx*.054, y-.014, .089), (sx*.064, y+.004, .078)]
            points = catmull(points, 8) if master else points
            radii = [lerp(.0062, .0017, j/(len(points)-1)) for j in range(len(points))]
            tube(figure, "bee-folded-leg"+side+str(index), part, points,
                 radii, "dark", 10 if master else 4)

    wing(figure, "L")
    wing(figure, "R")
    if not master:
        assert figure.triangles <= 1500, "A spawned swarm must stay cheap"
    return figure
