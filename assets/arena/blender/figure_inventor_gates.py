"""Private roster review provenance and process guards (no Blender imports).

The root records acceptance in this figure's own folder after opening the
actual images. Templates deliberately carry accepted=False. A successful
build, an old image or an environment variable never signs a review.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import resource
import subprocess
import sys
import threading

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
R = Path(__file__).stem.split("_")[1]
BASE = PROJECT / "work/arena/2026-10-08-roster" / R
VERSION = {"inventor": "v3", "archers": "v4"}[R]
SOURCE_FILES = {
    "inventor": ("figure_inventor_sculpt.py", "figure_inventor_rig.py",
                 "figure_inventor_dress.py", "figure_inventor_gear.py",
                 "figure_inventor_mesh.py", "figure_inventor_paint.py",
                 "figure_miner_clay.py", "figure_miner_sdf.py"),
    "archers": ("figure_archers_body.py", "figure_archers_head.py",
                "figure_archers_gear.py", "figure_archers_sdf.py",
                "figure_archers_rig.py"),
}[R]


def version_name(version):
    if not re.fullmatch(r"v[1-9][0-9]*", version):
        raise ValueError("Version must be v followed by a positive integer")
    return version


def owned(name):
    path = BASE / name
    if not path.resolve().is_relative_to(BASE.resolve()):
        raise ValueError("Artifact must stay inside " + str(BASE))
    return path


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def fingerprint(paths):
    h = hashlib.sha256()
    for path in paths:
        path = Path(path)
        h.update(str(path.relative_to(PROJECT)).encode())
        h.update(bytes.fromhex(file_hash(path)))
    return h.hexdigest()


def fingerprints():
    return {
        "sourceFingerprint": fingerprint([
            *(HERE / name for name in SOURCE_FILES), HERE / "kit.py",
            HERE / "figure_folk_kit.py", BASE / "brief-next.md", BASE / "baseline.json",
        ]),
        "recipeFingerprint": fingerprint([
            HERE / ("figure_" + R + "_runtime.py"),
            HERE / ("figure_" + R + "_review.py"),
            HERE / ("figure_" + R + "_stages.py"),
            HERE / ("figure_" + R + "_gates.py"),
            HERE / ("figure_" + R + "_collector.py"),
            HERE / ("figure_" + R + "_loader.py"),
            BASE / "probe-next.mjs", BASE / "landmarks-next.py",
        ]),
        "movesSHA256": file_hash(BASE / ("moves-" + R + "-next.ts")),
        "reachSHA256": file_hash(PROJECT / "components/game/arena/moves/reach.ts"),
    }


def artifact(stage, version=VERSION):
    version_name(version)
    return owned(f"{R}-{stage}-{version}.blend")


def read_gallery(stage, version=VERSION):
    version_name(version)
    index_path = owned(f"{stage}-{version}/render-index.json")
    index = json.loads(index_path.read_text())
    expected = fingerprints()
    if (not index.get("complete") or index.get("stage") != stage
            or index.get("version") != version
            or any(index.get(k) != v for k, v in expected.items())):
        raise RuntimeError(f"{R} {stage} gallery is incomplete or stale; rerender it")
    if not index.get("renders"):
        raise RuntimeError("Gallery contains no rendered images")
    for name, digest in index["renders"].items():
        if not name.endswith(".jpg") or file_hash(owned(name)) != digest:
            raise RuntimeError("Review image is missing or changed: " + name)
    if index.get("masterSHA256") != file_hash(artifact("master", version)):
        raise RuntimeError("The master changed after the review renders")
    if stage == "runtime" and index.get("runtimeSHA256") != file_hash(artifact("runtime", version)):
        raise RuntimeError("The runtime changed after the review renders")
    return index_path, index


def require_review(stage, version=VERSION):
    """Validate a root-signed record, complete gallery and identical blends."""
    if stage not in ("source", "runtime"):
        raise ValueError("Source or runtime review required")
    index_path, index = read_gallery(stage, version)
    path = owned(f"{stage}-review-gate-{version}.json")
    if not path.is_file():
        raise RuntimeError("Root must open the images and sign " + str(path))
    gate = json.loads(path.read_text())
    if (gate.get("accepted") is not True or gate.get("reviewedBy") != "root"
            or not gate.get("observations")):
        raise RuntimeError("Root visual acceptance is pending: " + str(path))
    for key, value in fingerprints().items():
        if gate.get(key) != value:
            raise RuntimeError("Review gate is stale: " + key)
    if gate.get("renderIndexSHA256") != file_hash(index_path):
        raise RuntimeError("The rendered gallery changed since root inspection")
    if gate.get("masterSHA256") != file_hash(artifact("master", version)):
        raise RuntimeError("The master changed since root inspection")
    if stage == "runtime" and gate.get("runtimeSHA256") != file_hash(artifact("runtime", version)):
        raise RuntimeError("The runtime changed since root inspection")
    inspected = gate.get("inspected", [])
    if not isinstance(inspected, list) or set(index["renders"]) - set(inspected):
        raise RuntimeError("The root must inspect every image in the current gallery")
    for name in inspected:
        if not owned(name).is_file():
            raise RuntimeError("Missing owned-folder review evidence: " + name)
    # Differences caused by a carried tool must be measured and explicitly
    # accepted by the root, never concealed by shrinking the whole person.
    for key, delta in index["measurements"]["baselineDelta"].items():
        if abs(delta) <= .08:
            continue
        exception = gate.get("dimensionExceptions", {}).get(key, {})
        accepted = exception.get("acceptedDimension")
        actual = index["measurements"][key]
        if (not isinstance(accepted, (int, float)) or not math.isfinite(accepted)
                or abs(accepted - actual) > 1e-6 or not exception.get("reason")):
            raise RuntimeError(f"{R} {key} differs from shipped native size by {delta:.1%}; root must review the measured exception")
    if index["geometry"]["skinConnectedComponents"] != 1:
        raise RuntimeError("The original connected skin has detached islands")
    return gate


def gate_template(stage, version=VERSION):
    index_path, index = read_gallery(stage, version)
    result = {"accepted": False, "reviewedBy": "root", "observations": "",
              "inspected": sorted(index["renders"]),
              "renderIndexSHA256": file_hash(index_path),
              "masterSHA256": file_hash(artifact("master", version)),
              "dimensionExceptions": {}, **fingerprints()}
    if stage == "runtime":
        result["runtimeSHA256"] = file_hash(artifact("runtime", version))
    path = owned(f"{stage}-review-gate-{version}.template.json")
    path.write_text(json.dumps(result, indent=2) + "\n")
    return path


def rss():
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak = raw if sys.platform == "darwin" else raw * 1024
    try:
        current = int(subprocess.check_output(
            ["ps", "-o", "rss=", "-p", str(os.getpid())], text=True,
            timeout=5).strip()) * 1024
    except (OSError, ValueError, subprocess.SubprocessError):
        current = peak
    return {"peakBytes": peak, "currentBytes": current}


def memory(stage):
    limit = float(os.environ.get(R.upper() + "_MEMORY_GIB", "8"))
    if not 0 < limit <= 8:
        raise ValueError("Memory guard must be positive and at most 8 GiB")
    measured = rss()
    print(R.upper() + "_MEMORY", stage, json.dumps(measured), flush=True)
    if max(measured.values()) > limit * 1024 ** 3:
        raise MemoryError(f"{R} {stage} exceeded {limit} GiB")
    return measured


def start_memory_guard():
    """Exit only this build process if a native operation crosses its cap."""
    limit = float(os.environ.get(R.upper() + "_MEMORY_GIB", "8"))
    if not 0 < limit <= 8:
        raise ValueError("Memory guard must be positive and at most 8 GiB")
    stopped = threading.Event()

    def watch():
        while not stopped.wait(2):
            measured = rss()
            if max(measured.values()) > limit * 1024 ** 3:
                print(R.upper() + "_MEMORY_ABORT", json.dumps(measured), flush=True)
                os._exit(91)

    threading.Thread(target=watch, name=R + "-own-process-memory", daemon=True).start()
    return stopped
