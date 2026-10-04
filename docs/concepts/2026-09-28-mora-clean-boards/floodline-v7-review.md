# Floodline taller mobile composition

Candidate a is a completely independent fresh built-in generation using
`floodline-v7-a-prompt.txt`; no references or image edits. Source:
`public/art/mora-phone-floodline-v7-a.png`, native946×1663.
All23pads were found by the unchanged `scripts/measure-pads.mjs` detector.
Draft measured geometry: `floodline-v7-a-draft.json`.

The written brief preserves v6-c's crisp paper style and narrow side
footprint, but changes the lower empty sea band from one third to one quarter
of source height and separates the habitat rows vertically.

Pre-generation simulation of v6 geometry with middle rows+60 and bottom
rows+120 native pixels preserves all six enforced phone source-cover gates
with unchanged token size. Candidate a's actual bottom pads are
y1035/1110/1127, meeting the requested extension. The top pads shifted from
y347 to296; the beach remained near its former height and mangroves moved
about20px. The resulting row gaps are larger and the bottom habitat bases
reach y1238.

Candidate a's top round pads are mildly foreshortened (about51×44px),
while bottom circles are about54×50–53px. All23pads are large, clear and
unobscured. No label paths or baked-in label plaques are present.

At390×844, all complete measured landmarks fit and source coverage passes.
The token remains28.42CSSpx. Lowest label centre moves to609CSSpx from
roughly553; its estimated bottom is633, leaving42px before controls675.
At360×780, corresponding centre/bottom are563/587, leaving24px before
controls611. All six normal phones pass full silhouettes and100px HUD
clearance. Two reported short-phone coverage fixtures have gaps.

**Tablet limitation before integration:**768×1024 has insufficient height to
retain source cover for the taller playbox; its conservative lighthouse
roof top lands at75CSSpx. At820×1180 it is94px, and at1024×1366 it is75px.
This is recorded honestly for the main agent's choice; the phone-priority
request does not itself prove tablet acceptance.

## Candidate b: rejected

`public/art/mora-phone-floodline-v7-b.png` is a second independent fresh
generation from `floodline-v7-b-prompt.txt`. Its23pads are crisp and nearly
round, and it restores tablet source coverage. However, its lateral connected
landmark footprint expanded to x104..879, wider than the412×915 phone's
available native visible width. Peripheral pier/beach/pool bases clip by
approximately4–14CSSpx. Its768×1024 lighthouse also starts around84CSSpx.

Measured draft is `floodline-v7-b-draft.json`. Candidate b is rejected,
with no optimized derivatives or runtime integration.

## Final choice: candidate a for phones

Candidate a is selected specifically for phones. The existing v6-c portrait
art and geometry remain unchanged for tablets. The main agent owns runtime
selection and preloading, using the same established phone-art distinction
as the other illustrated worlds.

New phone metadata: `lib/games/floodline-phone-art.json`. Gameplay crop is
left140, top253, width690, height975: the20px upward extension includes
the higher first row's standee bounds, and the lower edge at1228 includes
the last scoring labels. This export crop does not change source scale.
The complete overview is left99, top213, width757, height1035.

Native exports at WebP quality94, effort6:

- `public/art/optimized/mora-phone-floodline-v7-a.webp`:946×1663.
- `public/art/optimized/mora-phone-floodline-v7-a-board.webp`:690×975.
- `public/art/optimized/mora-phone-floodline-v7-a-overview.webp`:757×1035.

Reproduce with
`node --experimental-strip-types docs/concepts/2026-09-28-mora-clean-boards/floodline-v7-export.mjs --write`.
All six normal-phone source-cover, complete-landmark and100px HUD-clearance
checks pass. Source, full export and both crop dimensions were verified.
Creature/token scale is unchanged from v6-c. The two short-phone coverage
limits are documented above. No v6 tablet metadata or imagery was modified.
The main agent wired the shared 600 CSS px portrait-phone breakpoint into
board rendering, placement coordinates, the camera, miniatures and preloading.
The resize observer also watches the phone-art marker so switching across that
breakpoint remeasures the board. Production assets include both compositions.

All41 focused layout/world tests, typecheck, lint and production build pass.
The full suite reported651passes and8failures in the concurrently modified
audio subsystem, which this artwork task did not change. Browser checks were
blocked by repeated connection timeouts, including after resetting the session.
The previous v6 screenshots are not evidence for this v7 integration. Physical
touch remains untested.
