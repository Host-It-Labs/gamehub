"""Private CPU review of actual Beekeeper analytic forms.

Software raster adapted privately from the Bee diagnostic. It does not validate
Blender fusion, AO or the game renderer. Every evidence image is labeled CPU.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from figure_beekeeper_cpu_adapter import build, metrics, surfaces

PALETTE={}


VIEWS = {
    "front": ((0, 1, .06), (0, 0, .658), 1.50),
    "side": ((1, 0, .04), (0, 0, .658), 1.50),
    "rear": ((0, -1, .06), (0, 0, .658), 1.50),
    "three": ((.6, 1, .42), (0, 0, .658), 1.55),
    "game": ((0, 1, math.tan(math.radians(55))), (0, 0, .658), 1.55),
    "face": ((.17, 1, .10), (0, .008, 1.15), .39),
    "glove": ((1, .45, .14), (.200, .080, .495), .29),
    "left": ((1, .65, .20), (-.190, .075, .492), .28),
    "grip": ((-1, .65, .18), (.178, .108, .470), .31),
    "hive": ((.55, -1, .14), (0, -.21, .88), .48),
}


def unit(v):
    v = np.asarray(v, dtype=float)
    return v/np.maximum(1e-12, np.linalg.norm(v, axis=-1, keepdims=True))


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
        if np.any(screen.max(axis=0)<0) or np.any(screen.min(axis=0)>size):
            continue
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
    parser.add_argument("--mode", default="runtime", choices=("source","runtime"))
    parser.add_argument("--clay", action="store_true")
    parser.add_argument("--pose", default="{}")
    parser.add_argument("--pose-file", help="Static angles from a recorded actual driver pose")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--views",default="front,side,face,glove,three,rear,game,hive")
    parser.add_argument("--parts",help="Optional regex for an explicitly isolated anatomy close-up")
    parser.add_argument("--focus",help="Frame this mesh regex while keeping full-scene occlusion")
    parser.add_argument("--span",type=float)
    parser.add_argument("--size", type=int, default=640)
    args = parser.parse_args()
    pose=json.loads(Path(args.pose_file).read_text())["pose"] if args.pose_file else json.loads(args.pose)
    forms=build(args.mode);PALETTE=forms.palette;items=surfaces(forms,pose)
    center=None
    if args.focus:
        import re
        points=np.concatenate([item["points"] for item in items if re.search(args.focus,item["name"])])
        center=(points.min(axis=0)+points.max(axis=0))*.5
    if args.parts:
        import re
        items=[item for item in items if re.search(args.parts,item["name"])]
    if args.all:
        out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
        for view in args.views.split(","):
            clay=view not in ("hive",)
            filename=out/f"cpu-{args.mode}-{'clay' if clay else 'material'}-{view}.ppm"
            write_ppm(filename,raster(items,view,clay,args.size));print(str(filename),flush=True)
        filename=out/f"cpu-{args.mode}-material-three.ppm"
        write_ppm(filename,raster(items,"three",False,args.size));print(str(filename),flush=True)
        (out/f"cpu-{args.mode}-metrics.json").write_text(json.dumps(metrics(forms),indent=2)+"\n")
    else:
        write_ppm(args.out,raster(items,args.view,args.clay,args.size,args.span,center))
