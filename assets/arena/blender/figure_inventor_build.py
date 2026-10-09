"""Compatibility entry point for the serial, root-reviewed private stages.

Use -- master|source|runtime|runtime-review v3. Output is confined to the
Inventor's work folder; the old arbitrary-path reduction is archived.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from figure_inventor_stages import main

if __name__ == "__main__":
    main()
