"""Named review poses for the Miner, in three.js Euler terms per joint
(radians added to the rest pose, as moves/miner.ts writes them; +x raises
an arm or leg forward). Used only by figure_miner_review.py."""

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
             "footR": (0.6, 0, 0)},
    # Both arms overhead.
    "overhead": {"armR": (2.9, 0, 0.25), "armL": (2.9, 0, -0.25), "clavR": (0, 0.05, 0.3),
                 "clavL": (0, -0.05, -0.3), "foreR": (0.8, 0, 0), "foreL": (0.8, 0, 0),
                 "chest": (-0.12, 0, 0)},
    # The strike's extreme: chest bent forward, both arms driven down in
    # front, elbows nearly straight.
    "strike": {"armR": (1.1, 0, 0.05), "armL": (1.0, 0, -0.25), "foreR": (0.2, 0, 0), "foreL": (0.35, 0, 0),
               "chest": (-0.35, 0, 0), "torso": (-0.25, 0, 0), "head": (0.25, 0, 0),
               "legL": (0.5, 0, 0), "kneeL": (-0.6, 0, 0)},
    # Wound up: the pick high behind the right shoulder.
    "wind": {"armR": (2.5, 0.3, 0.55), "foreR": (1.9, 0, 0), "armL": (2.2, 0.2, 0.2), "foreL": (1.5, 0, 0),
             "chest": (0.15, -0.35, 0), "torso": (0.05, -0.2, 0), "clavR": (0, 0.05, 0.25),
             "clavL": (0, -0.12, -0.1)},
}
