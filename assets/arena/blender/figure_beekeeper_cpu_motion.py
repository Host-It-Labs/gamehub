"""Read-only software review of actual TroopView snapshot geometry.

The optional reconstructed modes use real recorded joint rotations and measure
the root transform against unchanged actual runtime trouser vertices. Extra
head node translation is absent from the angle record; these modes review
garments and wrists, not complete head motion or genuine Blender playback.
"""
import argparse
import json
from pathlib import Path

import numpy as np

from figure_beekeeper_cpu_adapter import build, surfaces
from figure_beekeeper_cpu_waist import frame_items, blouse_components
import figure_beekeeper_cpu_raster as review


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--frames",required=True)
    parser.add_argument("--indices",default="2,5,8,11,14")
    parser.add_argument("--views",default="three,rear,side")
    parser.add_argument("--source",action="store_true")
    parser.add_argument("--reconstruct",action="store_true",help="Evaluate the current sampled source at recorded joint angles")
    parser.add_argument("--pick",action="store_true")
    parser.add_argument("--parts")
    parser.add_argument("--close",action="store_true")
    parser.add_argument("--size",type=int,default=560)
    parser.add_argument("--out",required=True)
    args=parser.parse_args()
    data=json.loads(Path(args.frames).read_text())
    forms=build("runtime");review.PALETTE=dict(forms.palette)
    dense=build("source") if args.source else None
    if dense:review.PALETTE.update(dense.palette)
    report={"snapshot":args.frames,"referenceSourceSHA256":forms.source_hash,
            "geometryMode":"dense-source-reconstruction" if dense else "runtime-source-reconstruction" if args.reconstruct else "actual-snapshot", "frames":[]}
    folder=Path(args.out);folder.mkdir(parents=True,exist_ok=True)
    for index in map(int,args.indices.split(",")):
        frame=data["frames"][index]
        items=frame_items(frame)
        entry={"index":index,"cycleTime":frame.get("cycleTime",frame["time"])}
        if dense or args.reconstruct:
            approximate=surfaces(forms,frame["angles"])
            # The trousers are unchanged during garment corrections and
            # retain the recorded joint translations. Head bobbing adds a
            # separate node translation not present in the angle snapshot.
            # Fitting changed apron vertices would conceal the source edits.
            a=next(item for item in approximate if "trouser1" in item["name"])["points"]
            b=next(mesh for mesh in frame["meshes"] if "trouser1" in mesh["name"])["positions"]
            affine=np.linalg.lstsq(np.c_[a,np.ones(len(a))],np.asarray(b),rcond=None)[0]
            error=np.max(np.linalg.norm(np.c_[a,np.ones(len(a))]@affine-b,axis=1))
            entry["rootFitError"]=float(error)
            assert error<1e-5,"Actual snapshot differs from recorded joint/root transform"
            items=surfaces(dense or forms,frame["angles"])
            rotation=affine[:3]
            for item in items:
                item["points"]=np.c_[item["points"],np.ones(len(item["points"]))]@affine
                item["normals"]=review.unit(item["normals"]@np.linalg.inv(rotation).T)
        if args.pick:
            reference=dense or forms
            blouse=next(mesh for mesh in reference.meshes if "sewn-blouse" in mesh.name)
            labels=blouse_components(blouse)
            review.PALETTE.update({"body-hem":("Body","#f0848f",.8,0),"left-sleeve":("Left","#6adcca",.8,0),
                                  "right-sleeve":("Right","#b5e261",.8,0),"trousers":("Trousers","#f2a543",.8,0)})
            for item in items:
                if "sewn-blouse" in item["name"]:item["faces"]=[(triangle,labels[triangle[0]]) for triangle,_ in item["faces"]]
                elif "trouser" in item["name"]:item["faces"]=[(triangle,"trousers") for triangle,_ in item["faces"]]
        if args.parts:
            import re
            items=[item for item in items if re.search(args.parts,item["name"])]
        for view in args.views.split(","):
            center=(0,0,.615) if args.close else (0,0,.67)
            span=.48 if args.close else 1.60
            if args.parts:
                points=np.concatenate([item["points"] for item in items]);center=(points.min(axis=0)+points.max(axis=0))*.5;span=.42
            filename=folder/f"cpu-{'dense' if dense else 'reconstructed' if args.reconstruct else 'actual'}-{view}-{index:03d}.ppm"
            review.write_ppm(filename,review.raster(items,view,False,args.size,span=span,center=center))
        report["frames"].append(entry)
    (folder/"cpu-motion-reference.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report),flush=True)
