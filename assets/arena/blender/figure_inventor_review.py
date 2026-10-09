"""Staged review entry point. See the owned root-next.md for exact commands.

-- master vN saves the detailed source; -- source vN renders its gallery;
-- runtime vN requires root source acceptance; -- runtime-review vN renders
that frozen copy. No step signs visual acceptance for the root.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from figure_inventor_stages import main

if __name__ == "__main__":
    main()
