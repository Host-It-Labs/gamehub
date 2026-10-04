# Observatory framing correction

`public/art/mora-phone-observatory-v5-b.png` is a built-in imagegen framing edit of the fresh v5-a source. Only the new image was used as reference; no previous-board image was opened. Exact correction prompt: `observatory-prompt-v2.txt`.

Native output is 996 × 1579. The generator created new surrounding woodland; no mirroring, stretching or deterministic extension was used. All six habitats remain; visual count and `LOOSE=1 node scripts/measure-pads.mjs` both confirm exactly 17 cream pads. All ground remains organic without blank horizontal labels, plaques, bars or connecting pathways.

Measured pad widths are 63–68 px. Geometry uses 71 px creature width so standees retain the current phone size; this is 7.6% larger than the typical painted pad but remains below the smallest 78 px center spacing. The draft preserves rule summaries, capacities, and internal zone identities.

The `observatory-geometry-v2.json` draft passes all six enforced portrait phone coverage cases. The full `paperWorldFrame` measurements and landmark transforms are in `observatory-framing-v2.json`.

| Viewport | Current creature | Candidate creature | Candidate coverage |
| --- | --- | --- | --- |
| 390 × 844 | 38.08 px | 37.95 px | yes |
| 390 × 664 | 28.29 px | 29.86 px | no, informational short-phone case, current also fails |
| 768 × 1024 | 54.86 px | 54.75 px | yes |

Complete conservative hand-measured landmark union is x=90..900, y=187..1250: 81.3% source width, 67.3% source height, 54.8% source area. Source margins are left 9.0%, right 9.6%, top 11.8%, bottom 20.8%. The generator did not attain the skill's stricter suggested margins; importantly the legacy current board also clips conservative outer landmark bounds on phones.

**Remaining integration review:** phone source cover still trims outer left habitat/root silhouettes (Hollow bounds start −43 px, current −20 px), while every pad and label stays inside the stage. The new dome starts at screen y=100 on 390 × 844, and y=32.7 on 768 × 1024, safely below the old candidate's negative top. The lower aqueduct base ends around y=668 on the phone. Please inspect actual runtime crop and hand overlap before accepting; automated source coverage is not full-silhouette, browser or touch acceptance. Animation masks and label anchors are hand estimates.

No runtime files or production references were changed by this subtask.
