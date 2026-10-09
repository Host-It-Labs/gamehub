"""Pure data contract for the private Biplane/aviatrix authoring kit.

Usable without Blender. The human is seated in a vehicle, with hanging upper
arms and 14 degree elbow flexion; its small tucked legs have real skin and
bones but never enter Arena's ground gait. Geometry is authored in human
coordinates, then uniformly placed at the measured shipped scale.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
REVISION = "v1"


def human_config(figure):
    if figure == "drake":
        return {"id": figure, "scale": .32, "waist": [0, -.237, .440],
                "humanWaist": .68, "oldTorso": [0, 0, .42], "mount": "torso",
                "elderly": False, "jacket": "hide:aviator-leather",
                "headTop": 1.326, "runtimeTarget": 30800}
    if figure == "balloon":
        return {"id": figure, "scale": .62, "waist": [0, -.012, .17],
                "humanWaist": .68, "oldTorso": [0, 0, .64], "mount": "basket",
                "elderly": True, "jacket": "weave:team",
                "headTop": 1.326, "runtimeTarget": 30000}
    raise ValueError(figure)


def human_pivots():
    result = {"chest": [0, -.008, .855], "neck": [0, -.006, 1.018],
              "head": [0, -.006, 1.055], "hat": [0, -.008, 1.265],
              "hair": [0, -.079, 1.258], "cape": [0, -.048, 1.015],
              "cape2": [.035, -.29, 1.034]}
    for s, side in ((-1, "L"), (1, "R")):
        result.update({"clav"+side: [s*.040, -.006, .943],
                       "arm"+side: [s*.176, -.012, .950],
                       "fore"+side: [s*.197, -.005, .752],
                       "hand"+side: [s*.208, .037, .591],
                       "leg"+side: [s*.064, .003, .598],
                       "knee"+side: [s*.067, .123, .535],
                       "foot"+side: [s*.066, .154, .457]})
    return result


def place(config, point):
    return [config["waist"][i] + config["scale"]*(point[i]-(config["humanWaist"] if i == 2 else 0))
            for i in range(3)]


def contract(figure):
    cfg = human_config(figure)
    positions = {k: place(cfg, p) for k, p in human_pivots().items()}
    positions["torso"] = cfg["oldTorso"]
    parents = {"chest": cfg["mount"], "neck": "chest", "head": "neck",
               "hat": "head", "hair": "head", "cape": "neck", "cape2": "cape"}
    if figure == "drake":
        positions.update({"wingL": [-.540, -.01405, .63548255], "wingR": [.540, -.01405, .63548255],
                          "tail": [0, -.674, .41370040], "extra": [0, -.7418, .490],
                          "spin": [0, .550, .360], "wheels": [0, .165, .0764],
                          "weapon": [0, -.035, .1955]})
        parents.update({k: "torso" for k in ("wingL", "wingR", "tail", "extra", "spin", "wheels", "weapon")})
    else:
        positions["basket"] = [0, 0, .64]
        # The working bomb swings about a rack-side pivot. Both palms track
        # its centre through reach; its projectile marker stays on basket.
        positions["weapon"] = [0, 0, .215]
        parents.update({"basket": "torso", "weapon": "basket"})
    for side in ("L", "R"):
        parents.update({"clav"+side: "chest", "arm"+side: "clav"+side,
                        "fore"+side: "arm"+side, "hand"+side: "fore"+side,
                        "leg"+side: cfg["mount"], "knee"+side: "leg"+side,
                        "foot"+side: "knee"+side})
    # Three.js uses (x, Blender z, -Blender y). Common axes remove bind twists.
    rest = {}
    for name, point in positions.items():
        parent = positions.get(parents.get(name), [0, 0, 0])
        delta = [point[i]-parent[i] for i in range(3)]
        rest[name] = [delta[0], delta[2], -delta[1]]
    return {"id": figure, "revision": REVISION, "config": cfg,
            "positions": positions, "parents": parents, "rest": rest,
            "handRest": {"palm": [1, 0, 0]},
            "axes": "+Y forward, Z up in Blender; every bone points +Z, zero roll",
            "restPose": "Seated aviator: upper arms hang, elbows flex 14 degrees, palms in; tucked legs inside craft"}


if __name__ == "__main__":
    for figure in ("drake", "balloon"):
        folder = PROJECT / "work/arena/2026-10-08-roster" / figure
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "rig-contract-v1.json").write_text(json.dumps(contract(figure), indent=2)+"\n")
