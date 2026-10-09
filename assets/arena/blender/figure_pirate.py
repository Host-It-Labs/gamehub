"""The Pirate (figure id `pirate`, card "Pirate"), rebuilt 9 October 2026.

An Afro-Caribbean pirate woman of the golden age of sail (card portrait
assets/arena/cards/card-pirate-v7-b.png): black felt tricorne over a
cobalt bandana, one long braid, gold hoops, a high-collared linen shirt
with rolled sleeves, a long dark buttoned waistcoat, a striped
cobalt-and-cream sash with a flintlock, dark trousers, tall black boots
and a brass-hilted cutlass, shouting her battle cry.

The detailed editable master is a signed-distance sculpt with a connected
skin on common-axis bones (figure_pirate_sculpt.build_master, with
figure_pirate_body, figure_pirate_face and figure_pirate_dress). Normal
builds append the frozen, reviewed runtime copy
(runtime/pirate-runtime-vN.blend, made by figure_pirate_runtime.py);
ARENA_SOURCE_MASTER=1 builds the master instead. The blocky figure it
replaces is preserved in work/arena/2026-10-08-roster/pirate/before/.

Joints (bones named pirate<part>, all with the root's axes): torso (lumbar)
> chest > head > hat, hair (bandana tails), tail > tail2 > tail3 (braid);
chest > clavL/R > armL/R > foreL/R > handL/R, handR > weapon (cutlass);
torso > skirtL/R (waistcoat skirts), extra (sash tails); legL/R > kneeL/R
> footL/R. Face controls pirateeyeL/R > piratepupilL/R, piratebrowL/R,
piratemouth.
"""
import os

from figure_pirate_runtime import finish_ao, load_runtime  # noqa: F401 (figures.py calls finish_ao)


def build(root_name="pirate"):
    if os.environ.get("ARENA_SOURCE_MASTER") == "1":
        from figure_pirate_sculpt import build_master
        return build_master()
    return load_runtime(root_name)
