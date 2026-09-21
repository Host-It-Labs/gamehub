---
name: game-world-layout
description: Plan, generate and integrate full-screen illustrated game worlds in Gamehub, with aligned gameplay targets, stable floating hands, and landscape/portrait framing. Use for every new Gamehub game and changes to game navigation or responsive layout, as well as illustrated boards, artwork and cameras.
---

# Illustrated game worlds

Read `docs/DESIGN.md`. Preserve each game's identity and scoring rules; Observatory supplies layout lessons, not a universal art style. Use the imagegen skill and delegate image generation as required by AGENTS.md. Use the original user-approved style reference for fresh artwork, not only a progressively regenerated derivative. Built-in generation is the authorized workflow; do not request API credentials.

## All games: navigation and one-screen play

Apply this contract to every Gamehub game, including non-illustrated party games, solo/online, practice and live play. Read the global navigation and viewport rule at the top of `docs/DESIGN.md` before changing layout.

- Left: back/return and game name only. Right: Menu, Others directly underneath, time/advance-time and fullscreen controls. Keep these positions in all orientations; side rails do not reverse navigation. Reuse `components/game/game-navigation.tsx` for party/world screens and the shared trio toolbar for Nox/Mora/Yata. Keep player badges clear of both islands.
- Strongly avoid whole-page scrolling during gameplay. Fit choices, board, hand and confirmation in the available viewport using responsive columns/side rails, compact spacing and removal of duplicated headings. Keep text legible and controls usable. Do not use overflow clipping to hide a failed fit.
- Long rules, history, comparisons and optional inspections belong in explicit overlays with internal scrolling and restored focus. Local scrolling is an accessibility/extreme-size fallback, not proof of a normal viewport fit.
- Preserve prepared choices across option switches. Refreshing choices from an active view stays in that view.
- Check long content, maximum players, selection/refresh/lock/reveal states, portrait, short landscape, tablet and browser zoom. Report static/layout reasoning separately from actual browser and touch checks.

## Measure before writing the image brief

Start from approved camera geometry during an artwork refresh. A measured device-specific fit adjustment is preferable to shrinking every landmark for the worst-case viewport; do not change geometry without verifying both landmark visibility and source coverage. Read the live source/crop metadata, camera offsets and UI breakpoints; do not copy obsolete numbers from historical design notes.

Define three separate regions:

1. **Gameplay rectangle:** all placement targets, creature extents, rule labels and release/exploration access.
2. **Protected landmark region:** COMPLETE silhouettes of every important building, dome, lookout, roof, canopy and base. Protect the entire recognizable object, not just its platform or placement center. A roof is not disposable scenery merely because it has no hit target.
3. **Crop-safe surroundings:** continuous expendable trees, fields, paths, ground and distant scenery outside those regions. Only this material may be cut by the viewport. Do not put towers, flags, domes or other focal structures near source edges.

Derive the protected region from the intersection of visible source rectangles across supported desktop, tablet, short landscape phone and portrait cameras, including actual upward offsets and advanced view. Subtract floating control areas where they obscure landmarks. In portrait, protect the complete tall composition within the initially visible board area; board scrolling is not an acceptance fallback. Preserve all important vertical silhouettes. A source image looking complete is not evidence that the game's camera displays it complete.

For source W×H, logical crop (left,top,cw,ch) and displayed board (bx,by,bw,bh), require bw/cw = bh/ch. Let s=bw/cw. The full scene starts at (bx-left*s, by-top*s), size(W*s,H*s). A source point maps to (bx+(px-left)*s, by+(py-top)*s). Invert this transform to calculate each viewport's visible source rectangle. Validate the entire bounding box of each landmark, including its highest and lowest points.

If protected content does not fit, first quantify the mismatch. Choose a bounded camera fit for the affected device or redesign it lower, broader or farther inward. Do not overcorrect a small miss with a large global zoom-out. Do not solve an art-composition miss by widening the logical crop, shrinking the whole sanctuary into excessive scenery, moving only the image away from targets, or undoing an approved camera. For a new game without approved geometry, establish source/crop/camera jointly first.

## Flat pieces on a painted world (hard constraint)

Everything the player touches is a flat 2D element drawn by the app: cards, tiles, tags, dice faces, buttons. There are no modelled 3D pieces and there will not be any: the image models we use cannot produce consistent 3D assets at scale. Design every world for that reality instead of for a miniature diorama.

- **The play surface is a plane parallel to the screen.** Draw the area where pieces land (table top, chart, cloth, counter, floor spread) in true plan view: no perspective convergence, no receding lines, no tilt inside that area. A flat card dropped onto a tilted, perspectival table reads as a sticker pasted over a photo. The surroundings may show depth (walls receding, objects drawn in shallow oblique like a dollhouse plan), but the surface the pieces sit on must be flat and face-on.
- **Fake the depth on the pieces, not in the plate.** Depth belongs to what the app draws: drop shadows with a fixed offset, a slight lift on pick-up, paper edge, a warm tint from the lantern. The brief must therefore state ONE light source and its direction (for example "a single lantern above the far edge; light falls toward the viewer") so CSS shadows and glows on cards match the painting. Mora's standees and their shadows are the reference: the painted pad is flat, the piece carries the depth.
- **2.5D is welcome, real 3D only when trivial.** Layered parallax, CSS-transformed cards (rotateX under 12 degrees), a die that tumbles as a flat sprite sequence, glows, particles, breathing lantern pools, water shimmer masks: all fine. A "3D element" is acceptable only if it is a simple primitive the app can draw itself (a coin, a token disc, a plank shelf); never plan for modelled props.
- **Camera before style.** Choose the camera so the constraint holds: straight-down plan view of the play surface, or a near-plan view with the surroundings tilting away at the edges only. Do not ask for "seen from a chair" or three-quarter interiors when pieces must lie on the table.
- **No seated people, and no furniture that implies missing people.** Player count is 2 to 6 and the app places each player's tag on a rim anchor. Chairs, stools, place settings and mugs set out for a crowd make the room read as abandoned; painted people make the count wrong. Give the play surface a continuous, calm rim band (table edge, cloth hem, pushed-back clutter) on which a tag looks natural at any of the anchor positions, and let the world feel inhabited through the owner's belongings, light and sound rather than through seats.
- **A round table is the wrong shape.** It wastes a portrait phone: the play area is a rectangle whose proportions follow the orientation (wide in landscape, tall in portrait), with the hand dock directly below it. Round-table framing was rejected for Nox on 19 September 2026.

## Distinct game UI and living scenery

Every game's hand tray, die, extension actions, habitat indicators, player badges and goal UI must be bespoke to its world in material, silhouette, typography and interaction presentation—not palette variants of one universal skin. Within a game, assign different physical roles: tray/container, carved die, action token, habitat sign, player identity tag and goal object must be distinguishable without reading. Preserve shared accessibility, rules components and state semantics.

Define a concrete visual restriction language before artwork generation. Die faces depict actual placement shapes and environmental materials (for example circular versus square pads, stone paving or timber). Never add cryptic symbols, invented emblems or glyph rows below habitat names. Show recognizable objects, supported by short plain labels and accessible descriptions; colour alone is insufficient. Never alter existing group membership to accommodate art. State-dependent restrictions also need explicit recognizable icons and brief accessible descriptions. Test all die outcomes against rule predicates in both content sets.

Plan both landscape and dedicated portrait boards for inexpensive programmatic animation from the outset. Identify water masks, foliage pivots, layer ordering, quiet occlusion edges and static fallback in the generation brief and coordinate metadata. Keep animated scenery separate from hit targets and readable labels; do not wobble the whole illustration. Use subtle localized motion, pause when hidden/off-screen, clean up resources, and respect reduced motion. Sound is a separate later addition unless requested. Record actual layer/mask implementation rather than calling a flat image animation-ready without evidence.

## Generation brief

### Padding the generator can actually follow

Image generators do not measure pixel coordinates. Briefs that place the sanctuary at "x340..1200, y230..775" produced compositions with almost no woodland on one or more sides (landscape: too little on every side; portrait: none above the dome). Write the padding so a model can see it:

- **Say it as a fraction of the picture, then as a comparison it can check visually.** "The sanctuary fills only the middle 55% of the width and the middle 50% of the height. The band of forest around it is, on every side, at least as wide as the largest terrace." A comparison against an object in the scene survives far better than a number.
- **Name every side separately, and name the top first.** The top edge is the side most often left bare because the dome and lookout naturally rise. Write "above the dome there is as much forest as there is below the lowest path" and "the dome roof sits at about one quarter of the image height, never near the top edge".
- **Describe the padding as content, not as empty space.** "Dense continuous cut-paper forest with several complete tree crowns, rocks and side paths that lead nowhere" gives the model something to draw; "leave 230 px of margin" gives it nothing.
- **Explain why, in one clause.** "This outer forest will be cropped differently on every screen" makes the model treat it as expendable and keep focal objects out of it.
- **Give a negative for the failure you saw last time.** "Do not let any building, pad, flag, tower top or pond touch the outer band."
- **Put the sanctuary rule in the same sentence as the size rule.** The model trades one for the other otherwise: "the sanctuary is small in the frame, but everything inside it is large and clear: pads are the biggest objects".

Keep the pixel rectangles too, but as a secondary line for our own measurement, after the visual description. Ask for the intended output size explicitly and check the actual size afterwards.

### Keep the style paragraph first, and never shrink the buildings

Observed on 19 September 2026: v3 and v4 briefs led with framing rules and said "buildings are small folded markers, never larger than the pad group" and "pads are the biggest objects". The results were flatter, duller and less alive than v2, whose prompt led with materials, palette (moss, sage, olive, ochre, autumn accents), flowers, depth and buildings with presence. Put the style paragraph first, name v2 as the look to match, ask for large readable pads *and* full-scale buildings, and keep framing rules after the style.

### Default safe area for Mora boards (accepted 19 September 2026 from v5-a)

Measured on the accepted v5-a boards. Brief future boards, for any game, at these fractions, stated in the prompt as comparisons the model can see:

- **Landscape 1536×1024:** the sanctuary (every building, terrace and pad, outermost pixels) spans about **85% of the width and 61% of the height**, sitting slightly high: forest bands about 7–8% each side, 9% above, 30% below. The lower band is the widest because the UI dock lives there.
- **Portrait 1024×1536:** the sanctuary spans about **61% of the width and 57% of the height**: forest bands about 19% each side, 16% above, 27% below.

Never describe these as pixel rectangles; say "the sanctuary fills the middle 85 percent of the width" and "below it there is about three times as much forest as above it".

### Never let the generator look at earlier images

Every run that opened previous images as references (v3, v4, the first v6 attempt) came back more generic than the run before. Style must travel as text: the style paragraph and the accepted prompt. Say in every brief that the agent must not open any image file.

### Generate orientations as separate fresh prompts

Observed on 19 September 2026: running the landscape and portrait v2 prompts as two independent generations produced closer building, material and palette consistency than asking the landscape thread for a portrait "of this exact same world". A follow-up in the same thread drifts toward that thread's last image and its quirks. Prefer one carefully shared style paragraph copied verbatim into each orientation's prompt, generated separately; use in-thread follow-ups only for framing corrections of the same image.

### Correction pass

When a generation misses the padding, do not regenerate from scratch. In the same thread, ask for an edit that only changes framing: "Pull the camera back so the whole sanctuary occupies only the central [55%] of the width and [50%] of the height, filling the new space on every side, especially above, with continuous forest in the same style. Keep every building, pad and path exactly as they are; do not add or remove any pad." Then count pads again.

### Accept only with measured margins

Before integrating, measure the landmark union and report, per side, `margin / source size`: top, bottom, left, right. Targets for the current framing: landscape at least 0.20 on every side; portrait at least 0.14 top, 0.30 bottom, 0.12 each side. Reject a source that misses any side even if the sanctuary itself is beautiful; the runtime will otherwise show a soft-copy margin on the affected devices.


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

The camera and stage must not depend on hand count, selected pieces, confirmation, waiting status or enabled extensions. Keep the same tray dimensions for full, partial and empty hands. Optional UI does not consume stage height. Advanced view must not resize or shift the live board. When enabled, selecting a player opens a full-screen, scrollable all-player board inspection, with your own seat marked in the table order but no duplicate of your board. Show passing direction and who passes to whom. Every opponent must retain all public goal/achievement progress and remaining extension uses, including zero/spent counts; use shared data calculations and never expose private hands or pending choices. Use adaptive columns and large boards for small player counts, a prominent close X, keyboard dismissal and restored focus.

- **Desktop:** retain approved framing, leaving important lower labels clear of the actual hand dock. Artwork briefs must protect upper landmarks under this offset too.
- **Tablet:** use measured source coverage and full-landmark fit together. A modest closer view is appropriate when spare room exists; do not force every sub-1280px viewport into a small contain fit. Browser zoom can move a desktop into these same CSS dimensions.
- **Portrait:** design a dedicated tall composition, not a crop of the landscape board. The band above the play surface must be thin (under about 14% of the height) because the floating navigation covers it and a tall far wall reads as wasted space; put the play surface high and the hand dock band below it. Give it its own measured source, habitat coordinates, labels and complete-landmark bounds while preserving all rule identities and capacities. Every playable area, creature and Release must fit one screen without horizontal or vertical board scrolling. Reserve fixed header/dock clearances before generation; never shrink a wide board into illegible targets.
- **Short landscape phone:** leave the center full height for the board. Use side rails: back/name left; Menu, Others and time controls right. Place players, goals, hand and game actions in the remaining side-rail space without moving navigation. This is the exception to the bottom-hand layout. Verify all targets and source-edge coverage without board scrolling. Compact visual controls must remain usable; check rail overlaps with goals, confirmation and all extension actions.

Normal desktop/tablet/portrait hand is a rounded floating bottom tray with a safe-area gap. Die and extension actions sit beside the tray; allow sufficient horizontal width instead of a vertical scrollbar; passing/table controls sit right. Confirmation stays near the hand without resizing the scene. Phone side trays likewise keep fixed geometry independent of count. Respect keyboard focus, reduced motion and mute. Paper standees sit directly on painted spaces without extra oval bases.

Navigation floats in separate compact islands: back and game name left, time/advance-time, fullscreen and Menu/Others in a right-anchored group. Reserve separate navigation and score areas on narrow screens so they cannot overlap. Use one shared nonverbal animated player-status component across games: distinguish deciding, committed and waiting by shape as well as motion, with an additional die-roller indicator. Keep accessible names and a reduced-motion static state. Ensure score ink contrasts with its actual tag background. Goals are distinct from player badges. Do not restore a full-width toolbar strip or bottom status bar.

Fullscreen needs a user gesture; orientation lock may be rejected. Keep a visible action, explain unsupported fullscreen honestly, preserve portrait fallback, and never force re-entry or fake orientation with CSS rotation.

## Acceptance

Test image/target alignment, slot capacities, uniform scale, protected landmark extents, edge coverage and complete portrait visibility without board scrolling. Include representative568×320,667×375,844×390,932×430 phones,1133×744 tablet,1280×720 short desktop and the user's desktop dimensions, normal/advanced view, goals on/off and empty/full hands. Do not claim all-device coverage from one full-source thumbnail or slot-only tests.

Run repository tests, typecheck, lint and build. Browser/touch tools require the user's explicit authorization; automated geometry checks do not establish live control overlap or touch acceptance. Document unresolved cases clearly. This process reduces avoidable iterations but cannot guarantee exact image-generator output.

## Composition calibration, not subjective zoom

Record landmark-union width/source width, height/source height and bounding-box area/source area separately from the logical crop ratio. These measure useful content allocation, not actual painted pixel coverage. Record top/bottom dead space and typical native slot diameter too. Compare the rejected and accepted candidates numerically before the next prompt; specify an intermediate target and allowed tolerance rather than “make it smaller”. A correct slot count and safe bounding box are insufficient if the composition wastes native resolution on unused surroundings.

For the Observatory calibration, use `node --experimental-strip-types scripts/measure-observatory-framing.mjs` and `docs/concepts/2026-09-16/observatory-framing-calibration.md`. The script reports actual source ratios, per-device landmark extents and native sampling density. Its advanced-view fixtures assume a300px opponent column; runtime uses measured width. Preserve the source/crop contract while fitting the whole landmark union between header and dock on short desktops. Use the equations and measurement process for other games, not Observatory's absolute pixel coordinates as universal constants.

## Browser zoom and bounded closer framing

Treat browser zoom as changed CSS viewport dimensions, not an image-generation problem. A desktop can cross tablet/phone breakpoints at125–200% zoom. Re-evaluate on element resize, window resize and visualViewport resize; remove listeners on unmount. Test fractional dimensions too. Do not use physical device labels or DPR to infer the usable board rectangle.

For landscape bottom-dock layouts, derive a minimum scale for full-source coverage and a maximum scale for complete landmarks above the hand. Choose a modest preferred increase (current Observatory8%), then clamp to the feasible interval. Adjust source origin within BOTH coverage and landmark-clearance limits. Fixed top offsets plus a width-only cover calculation are insufficient. The short-phone side-rail and dedicated portrait compositions remain separate. Advanced inspection is an overlay and never changes the live camera.

For source size(W,H), horizontal source anchor cx, on-screen anchor Cx, protected vertical bounds(t,b), screen heightV, header clearanceT and lower clear edgeB: minimum cover scale is max(Cx/cx,(screenWidth-Cx)/(W-cx),T/t,V/H,(V-B)/(H-b)); maximum safe scale is(B-T)/(b-t). Source Y must lie between max(T-t*s,V-H*s) and min(0,B-b*s). Also verify horizontal landmark bounds. If the interval is empty, first reclaim genuinely spare header clearance within an explicit bound; otherwise report the incompatible extreme instead of stretching, repeating scenery or hiding playable content.

Record browser-zoom checks, tablet increments and the chosen camera scale separately from native image detail. Regenerate only for a measured composition/detail shortfall. A future art brief can allocate slightly more native area to play, but may not promise higher resolution or fix a CSS border problem through generation alone.
