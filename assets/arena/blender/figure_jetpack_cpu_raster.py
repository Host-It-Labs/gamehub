"""Private CPU review of actual Jetpack analytic forms.

Software raster adapted privately from the Bee diagnostic. It does not validate
Blender fusion, AO or the game renderer. Every evidence image is labeled CPU.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from figure_jetpack_cpu_adapter import build, metrics, surfaces

PALETTE={}


VIEWS = {
    "front": ((0, 1, .13), (0,0,.70), 1.58),
    "side": ((1,0,.13), (0,0,.70), 1.58),
    "rear": ((0,-1,.13), (0,0,.70), 1.58),
    "three": ((1,1,.38), (0,0,.70), 1.62),
    "game": ((.50,1,math.tan(math.radians(55))*math.sqrt(1.25)), (0,0,.70),1.53),
    "face": ((.10,1,.10), (0,.020,1.187),.34),
    "handL": ((-1,1,.35),(-.215,.064,.504),.23),
    "handR": ((1,1,.35),(.207,.075,.508),.28),
    "handR-back": ((1,-1,.35),(.207,.075,.508),.28),
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
    for mesh in sorted(items, key=lambda m: "clear-bubble-shell" in m.get("name", "")):
        # GLTFLoader strips periods from authored node names.
        is_glass = "clear-bubble-shell" in mesh.get("name", "")
        if is_glass and clay: continue
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
            if is_glass:
                target[mask] = target[mask]*.87 + np.clip(shade_rgb[mask],0,1)*.13
            else:
                target[mask] = np.clip(shade_rgb[mask],0,1)
                region[mask] = zs[mask]
    return (np.clip(rgb,0,1)**(1/2.2)*255).astype(np.uint8)


def write_ppm(path, image):
    path = Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(f"P6\n{image.shape[1]} {image.shape[0]}\n255\n".encode()+image.tobytes())


def frame_surfaces(frame):
    return [{"name": mesh["name"], "points": np.asarray(mesh["positions"]),
             "normals": np.asarray(mesh["normals"]),
             "faces": [(np.asarray(face), mesh["material"]) for face in mesh["triangles"]]}
            for mesh in frame["meshes"]]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--view", default="three", choices=VIEWS)
    parser.add_argument("--mode", default="runtime", choices=("source","runtime"))
    parser.add_argument("--clay", action="store_true")
    parser.add_argument("--pose", default="{}")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--motion-folder", help="Actual TroopView CPU frame files to inspect")
    parser.add_argument("--extremes", action="store_true", help="Diagnostic common-axis joint extremes")
    parser.add_argument("--size", type=int, default=640)
    args = parser.parse_args()
    forms=build(args.mode);PALETTE=forms.palette;items=surfaces(forms,json.loads(args.pose))
    if args.extremes:
        out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
        poses={
            "forward120": {"clavR":(.15,.13,.10),"armR":(1.944,0,0),"foreR":(.12,0,0)},
            "out100": {"clavR":(0,0,.16),"armR":(0,0,1.585),"foreR":(.13,0,0)},
            "elbow140": {"armR":(.90,0,.13),"foreR":(2.21,0,0),"handR":(.12,0,0)},
            "knee120": {"legR":(.73,0,0),"kneeR":(-2.094,0,0),"footR":(.30,0,0)},
        }
        for name,pose in poses.items():
            filename=out/f"cpu-clay-{name}.ppm"
            write_ppm(filename,raster(surfaces(forms,pose),"three",True,args.size,span=1.9))
            print(str(filename),flush=True)
        (out/"cpu-extreme-poses.json").write_text(json.dumps(poses,indent=2)+"\n")
    elif args.motion_folder:
        out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
        records=[]
        for mode in ("idle","walk","attack","deploy","hit"):
            data=json.loads((Path(args.motion_folder)/f"cpu-{mode}-frames.json").read_text())
            available=data["frames"]
            if mode == "idle":
                chosen=[available[i] for i in (0,4,7,10)]
            elif mode == "attack":
                # Keep both pre-shot anticipation and the engine's .30/.90
                # second impacts, rather than uniformly skipping the hits.
                chosen=[available[i] for i in (0,1,2,3,4,8,9)]
            else:
                chosen=[available[i] for i in sorted(set(np.linspace(0,len(available)-1,6).astype(int)))]
            for number,frame in enumerate(chosen):
                posed=frame_surfaces(frame)
                for view in (("front","side") if mode == "attack" else ("three",)):
                    filename=out/f"cpu-{mode}-{number:02d}-{view}.ppm"
                    write_ppm(filename,raster(posed,view,False,args.size))
                    records.append({"file":filename.with_suffix(".jpg").name,"mode":mode,
                                    "cycleTime":frame["cycleTime"],"sinceHit":frame["since"],
                                    "angles":frame["angles"],"body":frame["body"]})
                    print(str(filename),flush=True)
        (out/"cpu-motion-view-records.json").write_text(json.dumps(records,indent=2)+"\n")
    elif args.all:
        out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
        for view in VIEWS:
            clay=True
            filename=out/f"cpu-{args.mode}-{'clay' if clay else 'material'}-{view}.ppm"
            write_ppm(filename,raster(items,view,clay,args.size));print(str(filename),flush=True)
        filename=out/f"cpu-{args.mode}-material-three.ppm"
        write_ppm(filename,raster(items,"three",False,args.size));print(str(filename),flush=True)
        (out/f"cpu-{args.mode}-metrics.json").write_text(json.dumps(metrics(forms),indent=2)+"\n")
    else:
        write_ppm(args.out,raster(items,args.view,args.clay,args.size))
