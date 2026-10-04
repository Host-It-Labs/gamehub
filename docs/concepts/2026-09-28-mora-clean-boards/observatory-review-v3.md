# Observatory final local silhouette correction

Final candidate: `public/art/mora-phone-observatory-v5-c.png`, native **997 × 1578**. Built-in imagegen edit of the newly generated v5-b only. Exact prompt: `observatory-prompt-v3.txt`.

The left garden wall, outer hollow tree/root and glasshouse ribs are tucked inward; the aqueduct's right end is slightly narrower. Camera, composition and all 17 pads are preserved to within one native pixel at measured cream centroids. A recount found all seventeen pads and no extra pad components. No baked horizontal label strips or connecting paths appear.

Draft runtime metadata: `observatory-geometry-v3.json`. The complete **main structures** are measured separately from expendable ferns, detached ground stones and the loose foreground planter. Main landmark union: x=176..884, y=187..1248, width708, height1061. Union/source ratios: width71.0%, height67.2%, area47.7%. Margins: left17.7%, right11.3%, top11.9%, bottom20.9%. Dome, roofs, hollow arch, supporting masonry/decks and aqueduct arches are included. Painted pad widths63–69px; creature width71px preserves current displayed scale.

## Camera finding

The existing `frameScene` landmark-origin interval in `lib/games/mora-world.ts` is reversed. It uses `[size - markEnd * scale, -markStart * scale]`, which rejects feasible full-landmark placement. The correct containment interval is `[-markStart * scale, size - markEnd * scale]`. This subtask did not modify runtime code.

`observatory-framing-v3.json` records unchanged-camera results; `observatory-framing-v3-corrected-interval.json` simulates only that interval correction without editing runtime files. With the corrected interval, all six enforced portrait phones and768×1024 cover the full source surface **and contain every complete main landmark rectangle**. All pad and label geometry remains in the safe stage. The390×664 short-phone informational case contains every landmark but retains the pre-existing source-coverage limitation.

Creature size at390×844 is37.97px versus current38.08px. At768×1024 it is54.69px versus current54.86px. These are geometry checks, not browser/touch validation. Parent integration still needs to inspect label placement, animation masks and live HUD/hand overlap.
