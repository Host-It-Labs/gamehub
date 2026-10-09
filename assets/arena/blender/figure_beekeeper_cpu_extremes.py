"""Static anatomical-range diagnostics, not moving-cycle acceptance.

Uses the current Blender driver's anatomical angles, full held-smoker wrist
compensation and a recorded actual TroopView release. These static poses do
not imply genuine Blender or moving-cycle acceptance.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from figure_beekeeper_cpu_adapter import build, metrics, surfaces, rotation
import figure_beekeeper_cpu_raster as review


POSES={
    "arm-forward": {"armR":(2.08,0,0),"clavR":(.05,0,.04),"foreR":(.12,0,0)},
    "arm-out": {"armR":(.10,0,1.73),"clavR":(0,0,.08),"foreR":(.20,0,0)},
    "elbow-deep": {"armR":(.26,0,.14),"foreR":(2.12,0,0),"handR":(-.35,0,0)},
    "knee-deep": {"legR":(1.13,0,.07),"kneeR":(-2.10,0,0),"footR":(.55,0,0)},
    "knee-deep-dressed": {"legR":(1.13,0,.07),"kneeR":(-2.10,0,0),"footR":(.55,0,0),"skirtR":(1.13*.90,0,0)},
}


def hold_smoker(pose):
    """Inverse of the full common-axis chain, expressed as Three XYZ Euler."""
    held=np.eye(3)
    for part in ("torso","chest","clavR","armR","foreR"):
        held=held@rotation(*pose.get(part,(0,0,0)))
    coordinate=np.array([[1,0,0],[0,0,1],[0,-1,0]])
    matrix=coordinate@held.T@coordinate.T
    y=math.asin(float(np.clip(matrix[0,2],-1,1)))
    if abs(matrix[0,2])<.9999999:
        x=math.atan2(-matrix[1,2],matrix[2,2]);z=math.atan2(-matrix[0,1],matrix[0,0])
    else:x=math.atan2(matrix[2,1],matrix[1,1]);z=0
    pose["handR"]=(x,y,z)
    assert np.max(abs(held@rotation(x,y,z)-np.eye(3)))<1e-6
    return pose


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--out",required=True);parser.add_argument("--mode",default="runtime",choices=("source","runtime"));parser.add_argument("--size",type=int,default=640)
    parser.add_argument("--only",choices=(*POSES,"release-driver"),help="Render one supplemental pose without rebuilding the other evidence")
    parser.add_argument("--release-pose",default=str(Path(__file__).resolve().parents[3]/"work/arena/2026-10-08-roster/beekeeper/beekeeper-release-pose.json"));args=parser.parse_args()
    forms=build(args.mode);review.PALETTE=forms.palette;folder=Path(args.out);folder.mkdir(parents=True,exist_ok=True)
    release=json.loads(Path(args.release_pose).read_text());poses={name:dict(pose) for name,pose in POSES.items()}
    poses["release-driver"]=release["pose"]
    if args.only:poses={args.only:poses[args.only]}
    filenames=[]
    for name,pose in poses.items():
        if name in ("arm-forward","arm-out","elbow-deep"):hold_smoker(pose)
        items=surfaces(forms,pose);views=["three"]
        if name in ("arm-forward","elbow-deep","knee-deep-dressed"):views.append("side")
        if name=="arm-out":views.append("front")
        for view in views:
            filename=folder/f"cpu-extreme-{name}-{view}.ppm"
            review.write_ppm(filename,review.raster(items,view,True,args.size,span=1.75,center=(0,0,.68)))
            filenames.append(str(filename));print(str(filename),flush=True)
    result={**metrics(forms),"poses":poses,"files":filenames,"releasePose":args.release_pose,
            "releaseSource":release.get("source"),"releaseModel":release.get("diagnosticModel"),
            "releaseSampleTime":release.get("sampleTime"),"releaseSincePuff":release.get("sincePuff"),
            "releasePoseSHA256":hashlib.sha256(Path(args.release_pose).read_bytes()).hexdigest(),
            "heldSmokerCompensationChain":["torso","chest","clavR","armR","foreR"],
            "movingCycleAcceptance":False}
    (folder/"cpu-extremes-metrics.json").write_text(json.dumps(result,indent=2)+"\n")
