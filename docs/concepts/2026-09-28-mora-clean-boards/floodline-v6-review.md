# Floodline fresh portrait replacement

The user rejected the repeated-edit softness of v5-g and requires independent
fresh generations unless explicitly requesting image edits. Every v6 candidate
was generated from its written prompt with the built-in image generator, with
no reference image, no edit call and no image postprocessing beyond native-size
WebP export and exact gameplay/overview cropping.

| Candidate | Exact prompt | Result |
| --- | --- | --- |
| v6-a | `floodline-v6-a-prompt.txt` | Crisp, 23 pads; rejected because island bases spread too far sideways and lighthouse was too tall. |
| v6-b | `floodline-v6-b-prompt.txt` | Crisp, 23 pads; rejected because circles were foreshortened (about53×38 px). |
| v6-c | `floodline-v6-c-prompt.txt` | Selected: crisp paper shapes, 23 measured pads, circular pads56–58×55–56 px, complete silhouettes fit. |

All PNG sources remain versioned under `public/art/mora-phone-floodline-v6-*.png`.
The selected source's actual native size is946×1663, despite the larger native
size requested in the prompt. It was never upscaled, mirrored, stretched,
extended, retouched or sharpened.

## Integration and reproducibility

- Runtime metadata: `lib/games/floodline-portrait-art.json`.
- Measured snapshot: `floodline-v6-c-draft.json`.
- Reproduction/export: `node --experimental-strip-types docs/concepts/2026-09-28-mora-clean-boards/floodline-v6-build.mjs --write`.
- Native source: `public/art/mora-phone-floodline-v6-c.png`.
- Native full-scene export: `public/art/optimized/mora-phone-floodline-v6-c.webp`.
- Exact690×949 gameplay crop: `public/art/optimized/mora-phone-floodline-v6-c-board.webp`.
- Exact762×863 overview crop: `public/art/optimized/mora-phone-floodline-v6-c-overview.webp`.

All WebPs use quality94, effort6; no resize. Gameplay crop remains exactly
left140, top273, width690, height949, matching the previous runtime contract.
The overview includes the new full measured landmarks.

Pad centres come from `LOOSE=1 node scripts/measure-pads.mjs`, visually
cross-checked: pools5, beach5, mangroves3, pier4, cave4, lighthouse2.
Habitat identities, scoring summaries, slots per habitat and tokenWidth56
are unchanged. Label anchors and water mask correspond to the new scenery.
No moving-foliage layer was added.

Complete landmark union: x94..836, y281..1124. Native side margins are
left9.94%, right11.63%, top16.90%, bottom32.41%. Union allocation is
78.44% of source width and50.69% of source height. Conservative bounds
include connected island bases and canopy/root tips, excluding detached
rocks and foam in open water.

## Verification

The existing camera is unchanged. All six enforced full-height phones and
all three reported short phones cover edge to edge. Complete measured
landmarks fit all enforced phones and portrait tablets768×1024,
820×1180,1024×1366, with protected tops below the100CSS-pixel HUD boundary.
The token size is28.42CSSpx at390×844, unchanged from v5-g.

Eight focused source/crop/landmark tests pass:
`node --experimental-strip-types --test --test-name-pattern='complete landmarks|backing textures|crop|coverage' tests/observatory-layout.test.mjs`.

The main agent also reviewed the actual fresh board in site-muted Chrome at
390×844, 768×1024 and 390×664. Release was shifted to (480,835) to clear the
middle-row cards; the live JSON, measured snapshot and reproduction script all
include this adjustment. Physical touch and real-device Safari remain untested.
The full suite passed 650 tests, and the post-integration layout/world suite
passed 38 tests. Typecheck, lint, assets and production build passed.
