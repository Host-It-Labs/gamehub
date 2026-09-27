# Dial, Sizes and Atlas — 27 September 2026

Scope: mobile Dial controls, Sizes reveal silhouettes, Atlas mobile detail and
polar geometry. Existing unrelated work and prior edits in these files were
preserved. The temporary local browser fixture was removed after checking.

## Changes

- Phone Dial arc is narrower and slightly higher. The bottom slider is at most
  280 px wide, with a 44 px touch area and clear separation from Lock. SVG drags
  track a single pointer, release capture and clear cancellation; positions below
  the hub do not change the value. SVG coordinates use the screen transform.
- Sizes shows the gold answer once. Player silhouettes overflow their reserved
  slots without a fade or a repeated gold silhouette. The mat clips overflow.
- Atlas uses a 1080 px minimum tile-detail sampling height, rounds detail up,
  and renders at up to 3× device pixel ratio. Canvas dimensions no longer feed
  back into layout. Mercator patches stop at their native latitude limit; fixed
  polar meshes sample the bundled global image. This stabilizes geometry but
  does not add higher-resolution source imagery at the poles.

## Automated checks

- Full suite: 616 tests passed, including the three new geometry/detail tests.
- Typecheck, production build, production assets and changed-file lint passed.
- Whole-repository lint has errors outside this task in
  `tests/play-experience.test.mjs`, `tests/placement-preview.test.mjs` and
  `tests/arena.test.mjs`.
- HTTP tests and build prerendering needed local socket access outside the
  restricted sandbox; both passed with that access.

## Browser evidence

Chrome, using the actual components in an isolated local fixture with six seats:

- At 390×664, an emulated touch set the Dial slider to 78. A touch in the gap
  above Lock followed by a touch on Lock committed 78 unchanged.
- Dial measured without page overflow at 390×664, 390×844, 768×1024, 1366×900,
  844×390 and 1093×720. On the short portrait phone, the slider ended at y554
  and Lock began at y600. The arc was 326 px wide; the slider was 280 px wide.
- Sizes reveal checked at phone and desktop dimensions with six guesses,
  including one at six times the answer. Exactly one gold answer remained;
  guess containers had visible overflow and no mask, while the outer mat hid
  overflow. The oversized silhouette remained solid at the mat edge.
- Atlas phone canvas at 390×844 / DPR 3: 1110×1688 drawing buffer for its
  370×563 CSS area. Detailed Esri requests returned HTTP 200. North and South
  poles checked with repeated keyboard rotation and zoom; no changing holes
  or wedges observed. A resize-loop warning found during breakpoint changes
  was corrected by decoupling the canvas from layout.

These are Chrome viewport and emulated-touch checks, not physical iOS/Android,
Safari, device GPU performance, or human multiplayer acceptance. Fractional
viewport sizing was checked; browser zoom itself was not exercised.
