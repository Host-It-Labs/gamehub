# Floodline fresh mobile board candidates

Built-in image generation, 28 September 2026. No earlier board was opened or
used as a reference. The initial brief uses the accepted style paragraph and
current geometry expressed as relative positions. One narrowly scoped edit
was then applied to the new image.

Sources:

- `public/art/mora-phone-floodline-v5-a.png`: fresh generation,
  native 946 × 1663; exact prompt `floodline-prompt.txt`.
- `public/art/mora-phone-floodline-v5-b.png`: framing correction of that new
  candidate, native 946 × 1663; exact prompt
  `floodline-correction-prompt.txt`.

Both are natural contiguous coastal scenery with no former horizontal
label strips. Every version has exactly 23 pads, independently counted by
visual inspection and `scripts/measure-pads.mjs`: 5 pools, 5 beach,
3 mangroves, 4 pier, 4 cave, 2 lighthouse. Native pad widths are 54–59 px.
Version b preserves large pads and makes the lighthouse much lower.

Draft metadata: `floodline-v5-a-draft.json` and
`floodline-v5-b-draft.json`. Pad centres are measured by colour-connected
components; label anchors and complete landmark bounds are visually
measured against the generated source. These are integration drafts.
`floodline-build-draft.mjs` reproduces candidate a and its frame report;
candidate b was measured separately, including shifted compact label anchors.

Candidate b passes `coverReport` at all six enforced full-height phones and
all three reported short phones. Its token size on 390 × 844 is 28.42 CSS px
versus the current board's 29.52 px. No source extension, mirroring,
stretching, feathering or separate background layer was used.

**Acceptance limitation:** source-edge coverage does not prove full-landmark
visibility. The generator did not follow the requested 9–10% side margin:
candidate b's complete beach, pool and cliff extents reach x15..924 of 946.
At 390 × 844, the draft camera crops about 44 CSS px from the left pool
perimeter, 39 from the beach, 27 from the cave at right, and 14 from the
lighthouse islet. The pads and main building tops are visible, but the strict
complete-landmark requirement is not yet satisfied. Do not call this
production accepted solely from the passing source-cover report.

No runtime files changed. No browser or touch acceptance performed here.

## Additional authorized perimeter correction: candidate c

`public/art/mora-phone-floodline-v5-c.png` is a second targeted correction,
using candidate b as its only reference. Exact prompt:
`floodline-perimeter-prompt.txt`. The visible-source intersection over
the six enforced phone frames of candidate b is x103.71..852.25. The prompt
requested all connected habitat footprints within x116..838 without moving
or shrinking pads. Actual native output remains 946 × 1663.

The generator brought the footprint inward partly, retaining exactly 23
pads, but moved pad centres by about 10–27 native pixels and did not obey
the requested full footprint. Fresh measured metadata is in
`floodline-v5-c-draft.json`; `LOOSE=1 node scripts/measure-pads.mjs`
finds all 23 centres. Native pads are 52–57 px wide; tokenWidth56 gives
28.42 CSS px on 390 × 844 versus the current 29.52.

Every enforced full-height phone passes source coverage. The reported
390 × 664 and 375 × 667 short phones have gaps. With the draft 390 × 844
camera, connected landmark horizontal extents in CSS pixels are: pier
8..268; lighthouse251..380; beach−31..181; mangroves178..392;
pools−32..183; cave186..380. The lighthouse, complete arches, carriage,
main canopies and all pads are visible. The connected beach/pool outer
bases and some rightmost mangrove root tips still exceed the viewport.
Bounds exclude detached rocks, waves and unrelated seaweed; they include
actual connected bases. This limitation is handed to the main integrator;
candidate c is not independently declared to pass the strict full-landmark
rule.

## Final local trim: candidate d

`public/art/mora-phone-floodline-v5-d.png` uses candidate c as its reference
for a small edit of the two left island rims and rightmost mangrove tips.
Exact prompt: `floodline-local-trim-prompt.txt`. All 23 measured pad
centres stay within one native pixel of c. Native size, pad size, phone
coverage and the two reported short-phone gaps are unchanged.

Fresh geometry: `floodline-v5-d-draft.json`. The mangrove silhouette now
fits. Conservatively measured connected beach and pool left extents are
x80 and x101, respectively, rather than the requested x120. At 390 × 844
this leaves 17 and 6 CSS pixels of peripheral shore clipped under the
current camera nudge. Main structures, arches, canopies and all pads fit.
Connected shoreline was not silently reclassified as expendable scenery.
The main integrator owns the final framing/acceptance decision.

## Candidate e: complete landmark geometry passes

`public/art/mora-phone-floodline-v5-e.png` is a final local trim of d's
left beach and pool edges. Exact prompt: `floodline-flush-trim-prompt.txt`.
It removes the overhanging driftwood and excess left shore rather than
zooming out or extending the source. Fresh metadata:
`floodline-v5-e-draft.json`.

All 23 pads were counted visually and by the connected-component helper
`floodline-measure-pads.mjs`, which adjusts the existing measurement
script's colour threshold for this slightly darker generated image.
Most centres differ by at most one pixel from d. The first beach square
moved about 14 px right and the first pool square about 3 px right;
metadata records the new centres. Native source remains 946 × 1663 and
tokenWidth56 still produces 28.42 CSS px at390 × 844.

Actual connected beach footprint starts at x156, pools at x135. The complete
landmark union is x128..862, y168..1241. Every measured complete landmark
rectangle stays inside every one of the six enforced full-height phone
surfaces with the existing camera, and all six have edge-to-edge source
coverage. The two reported short-phone source gaps remain (390 × 664 and
375 × 667). These are static geometry checks; HUD overlap, live labels and
touch behavior still belong to the integrator's browser check.

## Candidate g: top structures clear the mobile HUD

The integrator's browser review found that candidate e's lighthouse roof and
pier semaphore were behind the player badges. Two local edits shorten those
structures without changing the camera: f shortens both, and g further
shortens only the lighthouse. Exact prompts:
`floodline-hud-height-prompt.txt` and
`floodline-lighthouse-final-prompt.txt`.

Final source: `public/art/mora-phone-floodline-v5-g.png`, 946 × 1663.
Fresh geometry: `floodline-v5-g-draft.json`. All 23 pads were counted
visually; the adjusted detector finds 22, with the remaining lower-left
beach square manually verified because the pale sand joins its colour
component. All pad centres were remeasured, with manual verification of
the beach cluster. The exact artwork, including repeated-edit changes in
paper contrast, is retained for the integrator's visual acceptance.

Measured lighthouse finial top: y231; semaphore top: y226. Conservative
protected bounds start at y222 and y224, respectively. The lighthouse bound
includes adjacent connected island rocks. Complete landmark union:
x128..862, y222..1241. Native margins: left13.53%, right8.88%, top13.35%,
bottom25.38%.

With the unchanged camera, all six enforced full-height phones have complete
measured landmarks inside their viewport, all protected tops at or below
the 100 CSS px HUD-clearance line, and edge-to-edge source coverage.
Token size remains 28.42 CSS px at390 × 844. The reported short-phone
coverage gaps are unchanged. Browser acceptance remains the integrator's.
