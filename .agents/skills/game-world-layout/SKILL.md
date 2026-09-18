---
name: game-world-layout
description: Plan, generate and integrate full-screen illustrated game worlds in Gamehub, with aligned gameplay targets, stable floating hands, and landscape/portrait framing. Use for new illustrated boards or changes to their artwork, camera or responsive layout.
---

# Illustrated game worlds

Read `docs/DESIGN.md`. Preserve each game's identity and scoring rules; Observatory supplies layout lessons, not a universal art style. Use the imagegen skill and delegate image generation as required by AGENTS.md. Use the original user-approved style reference for fresh artwork, not only a progressively regenerated derivative. Built-in generation is the authorized workflow; do not request API credentials.

## Measure before writing the image brief

Start from approved camera geometry during an artwork refresh. A measured device-specific fit adjustment is preferable to shrinking every landmark for the worst-case viewport; do not change geometry without verifying both landmark visibility and source coverage. Read the live source/crop metadata, camera offsets and UI breakpoints; do not copy obsolete numbers from historical design notes.

Define three separate regions:

1. **Gameplay rectangle:** all placement targets, creature extents, rule labels and release/exploration access.
2. **Protected landmark region:** COMPLETE silhouettes of every important building, dome, lookout, roof, canopy and base. Protect the entire recognizable object, not just its platform or placement center. A roof is not disposable scenery merely because it has no hit target.
3. **Crop-safe surroundings:** continuous expendable trees, fields, paths, ground and distant scenery outside those regions. Only this material may be cut by the viewport. Do not put towers, flags, domes or other focal structures near source edges.

Derive the protected region from the intersection of visible source rectangles across supported desktop, tablet, short landscape phone and portrait cameras, including actual upward offsets and advanced view. Subtract floating control areas where they obscure landmarks. In portrait, distinguish the initially visible composition from areas intentionally reachable through horizontal exploration. Preserve all important vertical silhouettes. A source image looking complete is not evidence that the game's camera displays it complete.

For source W×H, logical crop (left,top,cw,ch) and displayed board (bx,by,bw,bh), require bw/cw = bh/ch. Let s=bw/cw. The full scene starts at (bx-left*s, by-top*s), size(W*s,H*s). A source point maps to (bx+(px-left)*s, by+(py-top)*s). Invert this transform to calculate each viewport's visible source rectangle. Validate the entire bounding box of each landmark, including its highest and lowest points.

If protected content does not fit, first quantify the mismatch. Choose a bounded camera fit for the affected device or redesign it lower, broader or farther inward. Do not overcorrect a small miss with a large global zoom-out. Do not solve an art-composition miss by widening the logical crop, shrinking the whole sanctuary into excessive scenery, moving only the image away from targets, or undoing an approved camera. For a new game without approved geometry, establish source/crop/camera jointly first.

## Generation brief

Include actual native dimensions requested and a proportional coordinate system. Specify gameplay and protected landmark rectangles in pixels AND percentages. State that every complete main structure must lie within the protected rectangle; no roof, flagpole, tower top or main base may protrude. Surroundings must cover all edges with no visible rectangular board rim.

Describe exact habitat and slot counts, spatial groupings, quiet label anchors, creature scale and a release clearing. Give habitats different silhouettes/materials/elevations: a timber lookout and a continuous dry rocky bed should be distinguishable without reading names. Avoid repeated identical platforms. No baked text, animals, cards or UI. Preserve original reference materials (for Observatory: tactile layered cut paper, fibers, matte edges and restrained colours), with focused playable areas.

Keep the useful board large enough in the source to retain native detail. Record sampling density `cropWidth / (displayedBoardWidth * devicePixelRatio)`. Upscaling does not recover detail. Built-in output may remain1536×1024 despite a larger request; verify metadata and report the actual result rather than blocking on API access.

## Inspect before integration

- Count every painted placement space after EVERY generation/edit; narrow edits can add or remove unintended slots.
- Measure real slot centers, label anchors and full landmark bounding boxes. Verify them against the brief and representative viewport transforms.
- Reject important silhouettes outside the protected area even when all slots fit. Also reject a correct source image whose runtime framing cuts main structures.
- Inspect contact-sheet crops at supported viewport geometries when practical. These are static art/camera checks, not browser or touch acceptance.
- Preserve versioned source, exact prompts, actual dimensions and coordinate provenance. Export full-scene WebP at native resolution and miniatures from the exact shared crop. Never stretch side regions, repeat the sanctuary, feather seams or paint a separately scaled background copy.

## Responsive camera and UI

One uniformly scaled source and one coordinate contract drive scene, targets and miniature crops. Canvas drawing-buffer resolution is distinct from native image resolution; retain adequate DPR, on-demand rendering, hidden-page suspension and cleanup.

The camera and stage must not depend on hand count, selected pieces, confirmation, waiting status or enabled extensions. Keep the same tray dimensions for full, partial and empty hands. Optional UI does not consume stage height. Advanced view is an intentional exception: opening the opponent column on desktop/tablet reduces the main board to its measured remaining width; disable normal desktop cover enlargement/upward offset there and verify opening/closing.

- **Desktop:** retain approved framing, leaving important lower labels clear of the actual hand dock. Artwork briefs must protect upper landmarks under this offset too.
- **Tablet:** use measured source coverage and full-landmark fit together. A modest closer view is appropriate when spare room exists; do not force every sub-1280px viewport into a small contain fit. Browser zoom can move a desktop into these same CSS dimensions.
- **Portrait:** all placement rows fit vertically; use horizontal-only exploration with enough clearance for outer standees and Release. Never require two-axis scrolling.
- **Short landscape phone:** leave the center full height for the board. Use side rails: navigation, players and actions left; goals, fixed two-column hand and passing right. This is the exception to the bottom-hand layout. Verify all targets and source-edge coverage without board scrolling. Compact visual controls must remain usable; check rail overlaps with goals, confirmation and all extension actions.

Normal desktop/tablet/portrait hand is a rounded floating bottom tray with a safe-area gap. Die and vertically stacked extension actions sit left at tray level; passing/table controls sit right. Confirmation stays near the hand without resizing the scene. Phone side trays likewise keep fixed geometry independent of count. Respect keyboard focus, reduced motion and mute. Paper standees sit directly on painted spaces without extra oval bases.

Navigation floats in separate compact islands: Games/back and content-sized title/rounds left, fullscreen and menu in one right-anchored group. Scores use the same safe-area top inset; put turn status below badges, not in a row above. Goals are distinct from player badges. Do not restore a full-width toolbar strip or bottom status bar.

Fullscreen needs a user gesture; orientation lock may be rejected. Keep a visible action, explain unsupported fullscreen honestly, preserve portrait fallback, and never force re-entry or fake orientation with CSS rotation.

## Acceptance

Test image/target alignment, slot capacities, uniform scale, protected landmark extents, edge coverage and portrait pan endpoints. Include representative568×320,667×375,844×390,932×430 phones,1133×744 tablet,1280×720 short desktop and the user's desktop dimensions, normal/advanced view, goals on/off and empty/full hands. Do not claim all-device coverage from one full-source thumbnail or slot-only tests.

Run repository tests, typecheck, lint and build. Browser/touch tools require the user's explicit authorization; automated geometry checks do not establish live control overlap or touch acceptance. Document unresolved cases clearly. This process reduces avoidable iterations but cannot guarantee exact image-generator output.

## Composition calibration, not subjective zoom

Record landmark-union width/source width, height/source height and bounding-box area/source area separately from the logical crop ratio. These measure useful content allocation, not actual painted pixel coverage. Record top/bottom dead space and typical native slot diameter too. Compare the rejected and accepted candidates numerically before the next prompt; specify an intermediate target and allowed tolerance rather than “make it smaller”. A correct slot count and safe bounding box are insufficient if the composition wastes native resolution on unused surroundings.

For the Observatory calibration, use `node --experimental-strip-types scripts/measure-observatory-framing.mjs` and `docs/concepts/2026-09-16/observatory-framing-calibration.md`. The script reports actual source ratios, per-device landmark extents and native sampling density. Its advanced-view fixtures assume a300px opponent column; runtime uses measured width. Preserve the source/crop contract while fitting the whole landmark union between header and dock on short desktops. Use the equations and measurement process for other games, not Observatory's absolute pixel coordinates as universal constants.

## Browser zoom and bounded closer framing

Treat browser zoom as changed CSS viewport dimensions, not an image-generation problem. A desktop can cross tablet/phone breakpoints at125–200% zoom. Re-evaluate on element resize, window resize and visualViewport resize; remove listeners on unmount. Test fractional dimensions too. Do not use physical device labels or DPR to infer the usable board rectangle.

For landscape bottom-dock layouts, derive a minimum scale for full-source coverage and a maximum scale for complete landmarks above the hand. Choose a modest preferred increase (current Observatory8%), then clamp to the feasible interval. Adjust source origin within BOTH coverage and landmark-clearance limits. Fixed top offsets plus a width-only cover calculation are insufficient. The short-phone side-rail and portrait exploration modes remain separate. Advanced view still fits the reduced play column rather than enlarging to cover the opponent panel.

For source size(W,H), horizontal source anchor cx, on-screen anchor Cx, protected vertical bounds(t,b), screen heightV, header clearanceT and lower clear edgeB: minimum cover scale is max(Cx/cx,(screenWidth-Cx)/(W-cx),T/t,V/H,(V-B)/(H-b)); maximum safe scale is(B-T)/(b-t). Source Y must lie between max(T-t*s,V-H*s) and min(0,B-b*s). Also verify horizontal landmark bounds. If the interval is empty, first reclaim genuinely spare header clearance within an explicit bound; otherwise report the incompatible extreme instead of stretching, repeating scenery or hiding playable content.

Record browser-zoom checks, tablet increments and the chosen camera scale separately from native image detail. Regenerate only for a measured composition/detail shortfall. A future art brief can allocate slightly more native area to play, but may not promise higher resolution or fix a CSS border problem through generation alone.
