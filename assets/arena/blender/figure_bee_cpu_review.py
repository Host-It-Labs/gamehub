"""Honest software geometry/normal proxy; not Blender or game lighting.

Use Blender's bundled Python (NumPy) without starting the Blender process.
PPM output is converted to labeled JPG evidence by the system Pillow helper.
The CPU frame input is produced from the actual TroopView in review-runtime.mjs.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from figure_bee_forms import PALETTE, build_forms


VIEWS = {
    "front": ((0, 1, .14), (0, 0, .166), .49),
    "side": ((1, 0, .07), (0, 0, .166), .49),
    "rear": ((0, -1, .14), (0, 0, .166), .49),
    "three": ((1, 1, .56), (0, 0, .166), .49),
    "game": ((0, 1, math.tan(math.radians(55))), (0, 0, .166), .49),
    "face": ((.12, 1, .17), (0, .16, .204), .17),
    "feet": ((1, .45, .10), (0, .03, .11), .19),
}


def unit(v):
    v = np.asarray(v, dtype=float)
    return v/np.maximum(1e-12, np.linalg.norm(v, axis=-1, keepdims=True))


def rotation(rx=0, ry=0, rz=0):
    # Moves use Three axes. Convert to Blender axes explicitly so the
    # antenna and wing hinge checks do not silently use the wrong axis.
    sx, cx = math.sin(rx), math.cos(rx)
    sy, cy = math.sin(ry), math.cos(ry)
    sz, cz = math.sin(rz), math.cos(rz)
    x = np.array([[1,0,0], [0,cx,-sx], [0,sx,cx]])
    y = np.array([[cy,0,sy], [0,1,0], [-sy,0,cy]])
    z = np.array([[cz,-sz,0], [sz,cz,0], [0,0,1]])
    convert = np.array([[1,0,0], [0,0,-1], [0,1,0]])
    return convert @ (x @ y @ z) @ convert.T


def surfaces(master, pose):
    figure = build_forms(master)
    frames = {}
    for part, pivot in figure.pivots.items():
        parent = figure.parents[part]
        anchor = np.asarray(pivot, dtype=float)
        r = rotation(*pose.get(part, (0,0,0)))
        if parent:
            pr, pt = frames[parent]
            position = pr @ (anchor-np.asarray(figure.pivots[parent]))+pt
            r = pr @ r
        else:
            position = anchor
        frames[part] = r, position
    output = []
    for mesh in figure.meshes:
        r, pivot = frames[mesh.part]
        points = np.asarray(mesh.vertices)-np.asarray(figure.pivots[mesh.part])
        points = points @ r.T + pivot
        ns = np.asarray(mesh.normals()) @ r.T
        faces = []
        for polygon, mat in zip(mesh.faces, mesh.materials):
            for i in range(1, len(polygon)-1):
                faces.append(([polygon[0], polygon[i], polygon[i+1]], mat))
        output.append({"points": points, "normals": ns, "faces": faces})
    return output


def frame_surfaces(frame):
    output = []
    for mesh in frame["meshes"]:
        pts, ns = np.asarray(mesh["positions"]), np.asarray(mesh["normals"])
        key = next(key for key, value in PALETTE.items() if value[0] == mesh["material"])
        output.append({"points": pts, "normals": ns,
                       "faces": [(triangle, key) for triangle in mesh["triangles"]]})
    return output


def raster(items, view="three", clay=False, size=720, span=None, center=None):
    direction, default_center, default_span = VIEWS[view]
    forward = unit(direction)
    right = unit(np.cross(forward, np.array([0,0,1.])))
    up = unit(np.cross(right, forward))
    center = np.asarray(default_center if center is None else center)
    span = default_span if span is None else span
    basis = np.stack((right, -up, forward))
    rgb = np.zeros((size, size, 3), dtype=float)
    # Deliberately plain background, without a flattering environment or
    # fake occlusion. Honest normals/shape, not a simulated game screenshot.
    grad = np.linspace(.088, .065, size)[:, None, None]
    rgb[:] = grad
    depth = np.full((size,size), -1e9)
    lighting = [(unit((-.6, .9, 1.5)), .58),
                (unit((1.1, .4, .65)), .23),
                (unit((.2, -1, .8)), .12)]
    for mesh in items:
        world = np.asarray(mesh["points"])
        projected = (world-center) @ basis.T
        screen = projected[:, :2]*(size/span)+size*.5
        normals = unit(mesh["normals"])
        for triangle, key in mesh["faces"]:
            xy, z, ns = screen[triangle], projected[triangle,2], normals[triangle]
            nworld = np.cross(world[triangle[1]]-world[triangle[0]],
                              world[triangle[2]]-world[triangle[0]])
            if np.dot(nworld, forward) <= 1e-12:
                continue
            lo = np.maximum(0, np.floor(xy.min(axis=0)).astype(int))
            hi = np.minimum(size-1, np.ceil(xy.max(axis=0)).astype(int))
            if np.any(lo > hi):
                continue
            a,b,c = xy
            denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(denominator) < 1e-9:
                continue
            yy,xx = np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
            xx,yy = xx+.5,yy+.5
            w0 = ((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
            w1 = ((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
            w2 = 1-w0-w1
            zs = w0*z[0]+w1*z[1]+w2*z[2]
            region = depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
            mask = (w0 >= -1e-7) & (w1 >= -1e-7) & (w2 >= -1e-7) & (zs > region)
            if not np.any(mask):
                continue
            n = unit(w0[...,None]*ns[0]+w1[...,None]*ns[1]+w2[...,None]*ns[2])
            shade = np.full(mask.shape, .28)
            for light,power in lighting:
                shade += np.maximum(0, n @ light)*power
            color = np.array([.43,.45,.47]) if clay else np.array([
                int(PALETTE[key][1][j:j+2],16)/255 for j in (1,3,5)])**2.2
            rough = .85 if clay else PALETTE[key][2]
            half_vector = unit(lighting[0][0]+forward)
            specular = np.maximum(0, n @ half_vector)**(8+70*(1-rough)**2)
            shade_rgb = color*shade[...,None]+specular[...,None]*(.008 if clay else .024*(1-rough))
            target = rgb[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
            target[mask] = np.clip(shade_rgb[mask],0,1)
            region[mask] = zs[mask]
    return (np.clip(rgb,0,1)**(1/2.2)*255).astype(np.uint8)


def write_ppm(path, image):
    path = Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(f"P6\n{image.shape[1]} {image.shape[0]}\n255\n".encode()+image.tobytes())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--view", default="three", choices=VIEWS)
    parser.add_argument("--master", action="store_true")
    parser.add_argument("--clay", action="store_true")
    parser.add_argument("--pose", default="{}")
    parser.add_argument("--frames")
    parser.add_argument("--size", type=int, default=640)
    args = parser.parse_args()
    if args.frames:
        data = json.loads(Path(args.frames).read_text())
        for index,frame in enumerate(data["frames"]):
            write_ppm(Path(args.out)/f"{index:03d}.ppm",
                      raster(frame_surfaces(frame), args.view, args.clay, args.size,
                             span=.64, center=(0,.028,.154)))
    else:
        write_ppm(args.out, raster(surfaces(args.master,json.loads(args.pose)),
                                  args.view,args.clay,args.size))
