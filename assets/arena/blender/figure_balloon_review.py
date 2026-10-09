"""Balloon entry for the owned serial Blender review stages."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from figure_drake_review import main

if __name__=="__main__":main("balloon")
