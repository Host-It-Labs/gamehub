# Floodline: two sea-cave pads

Built-in imagegen precise-object-edit, 2026-09-20. Original sources retained. Source framing, every other landmark and the first two pads are unchanged pixel-for-pixel. Only an elliptical patch around the rightmost sea-cave pad is composited from the generated grey-rock replacement with a feathered edge. Runtime WebP is lossy, as previously; compare preservation on source PNGs.

Landscape source: `../mora-floodline-landscape-v2-a.png`; new source `../mora-floodline-landscape-v3-a-two-pads.png`, 1536×1024. Removed pad center (414,494). Portrait source: `../mora-floodline-portrait-v3-b.png`; new source `../mora-floodline-portrait-v4-b-two-pads.png`, 1024×1536. Removed pad center (803,980).

The `optimized/` counterparts retain the source basename and have `.webp`, `-board.webp`, and `-overview.webp` suffixes. Crop rectangles are recorded in `verification.json`, copied unchanged from each existing world contract. Contact sheet: left before, right after; landscape above portrait. Visually reviewed: both caves contain exactly two cream circles, and the removed circle is natural grey rock.

Reproduction: `node scripts/prepare-floodline-two-pads.mjs` (generated patch provenance paths are recorded in the script; retained generated patches also live beside this README).

## Exact prompts

Landscape:
> Use case: precise-object-edit. Edit target: attached closeup crop from illustrated paper-cut coastal board. Remove ONLY the large complete beige circular token/pad in the center and its shadow, replacing it seamlessly with continuous matching flat natural grey rock texture. It must no longer have any circle shape or outline. Preserve original framing, camera, grey rocky platform cracks, edge, surrounding plants and tiny partial beige pad at extreme left. Match the existing grainy handcrafted cut-paper illustration exactly; no added objects. Return same aspect ratio, the same image with only central beige pad erased into grey rock.

Portrait:
> Use case: precise-object-edit. Edit target: attached closeup crop from illustrated paper-cut coastal board. Remove ONLY the large beige circular token/pad in the center-left and its dark shadow, replacing it seamlessly with continuous matching flat natural grey rock texture. No circle shape or outline may remain. Preserve original framing, camera, grey rocky platform cracks, platform edge, surrounding plants. Match the existing grainy handcrafted cut-paper illustration exactly; no added objects. Return same aspect ratio, same image with only beige pad erased into grey rock.
