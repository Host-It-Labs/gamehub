"""Named review poses for the Inventor, in three.js Euler terms per joint
(radians added to the rest pose, as moves write them; +x raises an arm or
leg forward). Used only by figure_inventor_review.py."""

POSES = {
    "rest": {},
    # The right arm lifted a little out and forward, to open the armpit.
    "pit": {"armR": (0.5, 0, 0.55)},
    # Arm raised forward to about 120 degrees, elbow soft.
    "reach": {"armR": (2.05, 0, 0), "clavR": (0, 0.12, 0.2), "foreR": (0.3, 0, 0),
              "armL": (1.0, 0, 0), "foreL": (1.2, 0, 0)},
    # Arms out to the side about 100 degrees.
    "out": {"armR": (0, 0, 1.6), "clavR": (0, 0, 0.22), "armL": (0, 0, -1.6),
            "clavL": (0, 0, -0.22)},
    # Deep elbow bends and a knee bend.
    "bend": {"armR": (0.6, 0, 0.1), "foreR": (2.3, 0, 0), "armL": (0.2, 0, -0.1),
             "foreL": (2.4, 0, 0), "legR": (1.2, 0, 0), "kneeR": (-2.0, 0, 0),
             "footR": (0.6, 0, 0), "skirtR": (0.7, 0, 0)},
    # The aim: both arms forward at the chest, the body leaning back.
    "aim": {"armR": (1.35, 0.25, 0.05), "foreR": (0.35, 0, 0), "armL": (1.25, -0.45, -0.15),
            "foreL": (0.75, 0, 0), "chest": (0.10, 0.15, 0), "torso": (0.05, 0.1, 0),
            "legL": (0.35, 0, -0.08), "kneeL": (-0.25, 0, 0), "legR": (-0.25, 0, 0.1),
            "skirtL": (0.25, 0, -0.05), "skirtR": (-0.15, 0, 0.08)},
    # A stride: legs and the coat's tails apart.
    "stride": {"legL": (0.55, 0, 0), "kneeL": (-0.35, 0, 0), "legR": (-0.45, 0, 0),
               "kneeR": (-0.55, 0, 0), "skirtL": (0.36, 0, 0), "skirtR": (-0.30, 0, 0),
               "armR": (-0.35, 0, 0), "armL": (0.4, 0, 0), "foreL": (0.4, 0, 0)},
}
