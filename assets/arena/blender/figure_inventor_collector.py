"""Run the real shared collector with only this private, gated frozen loader.

This is a process-local module substitution, not an edit to figures.py or to
any shipped asset. Export lands in the owner's work folder after root review.
"""
import importlib
import json
import os
from pathlib import Path
import runpy
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
R = Path(__file__).stem.split("_")[1]
gate = importlib.import_module("figure_" + R + "_gates")


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    version = gate.version_name(args[0] if args else gate.VERSION)
    guard = gate.start_memory_guard()
    try:
        gate.require_review("source", version)
        gate.require_review("runtime", version)
        os.environ[R.upper() + "_REVIEW_VERSION"] = version
        os.environ["ARENA_FIGURES"] = R
        loader = importlib.import_module("figure_" + R + "_loader")
        sys.modules["figure_" + R] = loader
        output = gate.owned(f"{R}-{version}.glb")
        sys.argv = [str(HERE / "figures.py"), "--", str(output)]
        runpy.run_path(str(HERE / "figures.py"), run_name="__main__")
        data = output.read_bytes()
        size = int.from_bytes(data[12:16], "little")
        doc = json.loads(data[20:20 + size])
        if doc.get("images") or doc.get("textures"):
            raise RuntimeError("Figure GLB must not contain textures")
        for mesh in doc.get("meshes", []):
            for primitive in mesh["primitives"]:
                if "COLOR_0" not in primitive["attributes"] or "COLOR_1" in primitive["attributes"]:
                    raise RuntimeError("Collector must export exactly one colour channel")
        builder = loader.reviewed_builder(version)
        gate.owned(f"collector-{version}.json").write_text(json.dumps({
            "figure": R, "version": version, "glbSHA256": gate.file_hash(output),
            "runtimeSHA256": gate.file_hash(gate.artifact("runtime", version)),
            "reviewedBuilder": str(builder.relative_to(gate.BASE)),
            "reviewedBuilderSHA256": gate.file_hash(builder),
            "textures": 0, "memory": gate.memory("collector-export"),
            **gate.fingerprints(),
        }, indent=2) + "\n")
        print("PRIVATE COLLECTOR EXPORT", output, flush=True)
    finally:
        guard.set()


if __name__ == "__main__":
    main()
