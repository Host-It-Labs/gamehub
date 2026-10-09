"""Private diagnostic picking colors for overlapping Beekeeper clothing.

The diagnostic union preserves separate authored blouse/sleeve components.
Color those components to distinguish a torso hem breakthrough from sleeves
and trousers, optionally using the parent's actual TroopView vertex snapshot.
This is software evidence, not Blender sewing or real-renderer acceptance.
"""
import argparse
import json
from pathlib import Path

import numpy as np

from figure_beekeeper_cpu_adapter import build, surfaces
import figure_beekeeper_cpu_raster as review


def blouse_components(mesh):
    parents=list(range(len(mesh.points)))

    def root(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]]
            i=parents[i]
        return i

    for face,_ in mesh.faces:
        for i in face[1:]:
            parents[root(i)]=root(face[0])
    groups={}
    for i in range(len(parents)):
        groups.setdefault(root(i),[]).append(i)
    labels={}
    for indices in groups.values():
        mean_x=np.mean([mesh.points[i].x for i in indices])
        key="body-hem" if abs(mean_x)<.06 else "left-sleeve" if mean_x<0 else "right-sleeve"
        for i in indices:labels[i]=key
    return labels


def frame_items(frame):
    items=[]
    for mesh in frame["meshes"]:
        points=np.asarray(mesh["positions"])
        indices=np.asarray(mesh["triangles"])
        normals=np.zeros_like(points)
        area=np.cross(points[indices[:,1]]-points[indices[:,0]],points[indices[:,2]]-points[indices[:,0]])
        for i in range(3):np.add.at(normals,indices[:,i],area)
        key=mesh["material"]
        review.PALETTE[key]=(key,mesh["hex"],mesh.get("roughness",.8),0)
        items.append({"name":mesh["name"],"points":points,"normals":review.unit(normals),
                      "faces":[(list(triangle),key) for triangle in indices]})
    return items


def containment(forms):
    """Rest vertex/ray clearance against this diagnostic's actual skirt faces.

    A positive clearance means the garment encloses the internal point along
    the horizontal ray through it. This measures sampled geometry, including
    triangulation chords; Boolean and thickening remain Blender-only gates.
    """
    skirt=next(mesh for mesh in forms.meshes if mesh.name.endswith(".apron-skirt"))
    shell=np.asarray([list(point) for point in skirt.points])
    triangles=np.asarray([triangle[:3] for triangle in skirt.triangles()])
    cache={}

    def sections(z):
        key=round(float(z),8)
        if key in cache:return cache[key]
        # Get the two plane-crossing edges of every intersecting triangle.
        selected=triangles[(shell[triangles,2].min(axis=1)<z)&(shell[triangles,2].max(axis=1)>z)]
        segs=[]
        for triangle in selected:
            p=shell[triangle];hits=[]
            for i,j in ((0,1),(1,2),(2,0)):
                if (p[i,2]<=z<p[j,2]) or (p[j,2]<=z<p[i,2]):
                    t=(z-p[i,2])/(p[j,2]-p[i,2]);hits.append(p[i,:2]+t*(p[j,:2]-p[i,:2]))
            if len(hits)==2:segs.append(hits)
        cache[key]=np.asarray(segs);return cache[key]

    def clearance(point):
        segments=sections(point[2])
        if len(segments)==0:return None
        direction=point[:2]/np.maximum(1e-12,np.linalg.norm(point[:2]))
        a=segments[:,0];delta=segments[:,1]-a
        cross=lambda p,q:p[...,0]*q[...,1]-p[...,1]*q[...,0]
        denominator=cross(delta,direction)
        t=-cross(a,direction)/np.where(abs(denominator)>1e-12,denominator,np.nan)
        radius=(a+t[:,None]*delta)@direction
        hits=radius[(t>=-1e-7)&(t<=1+1e-7)&(radius>0)]
        return float(hits.max()-np.linalg.norm(point[:2])) if len(hits) else None

    report={"sourceSHA256":forms.source_hash,"measurement":"Neutral CPU vertex/ray clearance against sampled apron triangles"}
    for mesh in forms.meshes:
        if "sewn-blouse" not in mesh.name and "trouser" not in mesh.name:continue
        labels=blouse_components(mesh) if "sewn-blouse" in mesh.name else None
        selected=[(i,np.asarray(list(point))) for i,point in enumerate(mesh.points)
                  if .250<point.z<.696 and (labels is None or labels[i]=="body-hem")]
        values=[(i,point,clearance(point)) for i,point in selected]
        values=[row for row in values if row[2] is not None]
        if not values:continue
        worst=min(values,key=lambda row:row[2])
        report[mesh.name]={"verticesMeasured":len(values),"verticesOutside":sum(row[2]<-1e-6 for row in values),
                           "minimumClearance":worst[2],"worstPoint":worst[1].tolist()}
    return report


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--frames")
    parser.add_argument("--frame",type=int,default=0)
    parser.add_argument("--mode",choices=("runtime","source"),default="runtime")
    parser.add_argument("--measure-only",action="store_true")
    parser.add_argument("--out",required=True)
    args=parser.parse_args()
    forms=build(args.mode)
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    if not args.frames:
        measurements=containment(forms)
        (out/"cpu-waist-containment.json").write_text(json.dumps(measurements,indent=2)+"\n")
        print(json.dumps(measurements),flush=True)
    if args.measure_only:raise SystemExit(0)
    review.PALETTE=dict(forms.palette)
    reference=next(mesh for mesh in forms.meshes if "sewn-blouse" in mesh.name)
    labels=blouse_components(reference)
    items=frame_items(json.loads(Path(args.frames).read_text())["frames"][args.frame]) if args.frames else surfaces(forms)
    review.PALETTE.update({"body-hem":("Torso blouse hem","#f0848f",.8,0),
                          "left-sleeve":("Left sleeve","#6adcca",.8,0),
                          "right-sleeve":("Right sleeve","#b5e261",.8,0),
                          "trousers":("Trousers","#f2a543",.8,0)})
    for item in items:
        if "sewn-blouse" in item["name"]:
            assert len(item["points"])==len(reference.points), "Snapshot topology must match the source diagnostic"
            item["faces"]=[(triangle,labels[triangle[0]]) for triangle,_ in item["faces"]]
        elif "trouser" in item["name"]:
            item["faces"]=[(triangle,"trousers") for triangle,_ in item["faces"]]
    for view in ("side","three","rear"):
        review.write_ppm(out/f"cpu-waist-{view}.ppm",review.raster(items,view,False,720,span=.48,center=(0,0,.615)))
    (out/"cpu-waist-key.json").write_text(json.dumps({"referenceSourceSHA256":forms.source_hash,
        "snapshotPath":args.frames,"frame":args.frame if args.frames else "neutral","colors":{"pink":"torso blouse hem",
        "cyan":"left sleeve","lime":"right sleeve","orange":"trousers"}},indent=2)+"\n")
