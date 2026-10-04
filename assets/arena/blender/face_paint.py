"""Readable facial paint on the original adult sculpts, not enlarged heads.
Raised, surface-following paint survives the runtime's material batching and
AO bake. Ivory sclera, dark pupils, a catchlight and shaped brows remain
separate colour regions even at battle distance.
"""
import math
import kit
import bmesh
from mathutils import Vector

WHITE = 'resin:' + kit.tint('face-ivory', '#fff4de')
INK = 'resin:' + kit.tint('face-ink', '#242c39')


def eyes(k, name, point, centre, z=1.1565, expression='focused'):
    """Broad readable colour shapes on the existing skull, with distinct brows."""
    out = []
    for side in (-1, 1):
        ac = side * 27
        curious = expression == 'curious'
        confident = expression == 'confident'
        lift_eye = 0.002 if curious and side == -1 else 0
        slope = side * (-0.002 if curious else 0.003)
        def patch(label, width, height, lift, material, dz=0, da=0):
            # Subdivide the paint across the socket. A single triangulated
            # outline bridges the concave eye and hides the white underneath.
            bm = bmesh.new()
            def vertex(radius, t):
                u = ac + da + math.cos(t) * width * radius
                v = z + lift_eye + dz + math.sin(t) * height * radius + math.cos(t) * slope * radius
                p = Vector(point(u, v))
                du = Vector(point(u+.001, v))-Vector(point(u-.001, v))
                dv = Vector(point(u, v+.0001))-Vector(point(u, v-.0001))
                normal = du.cross(dv).normalized()
                if (p-Vector(centre)).dot(normal) < 0:
                    normal = -normal
                return bm.verts.new(p + normal*lift)
            middle=vertex(0,0)
            previous=None
            for ring in range(1,7):
                current=[vertex(ring/6, i/24*math.tau) for i in range(24)]
                for i in range(24):
                    j=(i+1)%24
                    if previous:
                        bm.faces.new((previous[i],previous[j],current[j],current[i]))
                    else:
                        bm.faces.new((middle,current[i],current[j]))
                previous=current
            bm.normal_update()
            for face in bm.faces:
                if face.normal.dot(face.calc_center_median()-Vector(centre)) < 0:
                    face.normal_flip()
            obj=kit._from_bmesh(f'{name}-{label}{side}',bm,material)
            kit.shade(obj)
            return obj
        out.append(patch('eye-outline', 15.0, 0.0142, 0.003, INK))
        out.append(patch('eye-white', 13.4, 0.0121, 0.004, WHITE))
        iris = 'resin:' + kit.tint('face-iris', '#725032')
        out.append(patch('iris', 6.6, 0.0102, 0.005, iris, dz=0.0015))
        out.append(patch('pupil', 3.8, 0.0083, 0.0058, INK, dz=0.0015))
        out.append(patch('catchlight', 1.9, 0.0028, 0.0065, WHITE,
                         dz=0.005, da=-2.0))
        # Outer ends rise for determination; one raised brow gives curiosity.
        raise_brow = 0.006 if (curious or confident) and side == -1 else 0
        brow = [(ac - 15, z + 0.020 - slope + raise_brow),
                (ac, z + 0.025 + raise_brow),
                (ac + 15, z + 0.020 + slope + raise_brow),
                (ac + 15, z + 0.025 + slope + raise_brow),
                (ac, z + 0.032 + raise_brow),
                (ac - 15, z + 0.025 - slope + raise_brow)]
        out.append(k.decal(f'{name}-expression-brow{side}', point, brow,
                           0.0045, INK, depth=0.001, eps=0.05, ref=centre))
    return out


def mouth(k, name, point, centre, z=1.0965, expression='confident'):
    """A clear curved mouth with a small ivory tooth plane, not a tiny crease."""
    smile = expression != 'focused'
    outline = [(-25, z + 0.006), (-13, z - 0.001), (0, z - 0.003),
               (13, z + 0.001), (25, z + (0.012 if smile else 0.006)),
               (15, z - 0.006), (0, z - 0.011), (-14, z - 0.007)]
    teeth = [(-18, z + 0.001), (0, z - 0.002), (18, z + 0.004),
             (11, z - 0.003), (0, z - 0.005), (-11, z - 0.003)]
    return [k.decal(f'{name}-mouth', point, outline, 0.0035, INK,
                    depth=0.0005, eps=0.05, ref=centre),
            k.decal(f'{name}-teeth', point, teeth, 0.0045, WHITE,
                    depth=0.0005, eps=0.05, ref=centre)]
