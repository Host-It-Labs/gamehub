# Relic: lost-garden scenes and independent cover

Generated 22 September 2026 with the built-in image-generation tool by delegated artwork agent. No API fallback, external art references, or previous covers were used. Three fresh text-only generations produced landscape, portrait and cover; each scene received one targeted composition edit using only its own generated original. Exact generation and correction prompts are adjacent. Original and corrected PNGs are preserved, including rejected initial compositions. `export.mjs` documents deterministic WebP conversion and the existing library convention of a 64-pixel left-edge spine.

## Deliverables

- `public/art/relic/ruins-landscape-v1.webp`: native 1536×1024, from landscape source v2.
- `public/art/relic/ruins-portrait-v1.webp`: native 1024×1536, from portrait source v2.
- `public/art/optimized/box-relic-blind-v1.webp`: 1024×1024 export from native 1254×1254 independent cover source.
- `public/art/optimized/box-relic-blind-v1-spine.webp`: 64×1024 texture strip.

## Visual review and geometry

The background art depicts jade tiled arches, moss, ferns, apricot earth and flowers, with a single upper-left sunlight source. Flat central ground carries runtime excavation. Main arches and camp props are complete; there are no painted targets, grids, people or interface. Broken peripheral stone fragments are expendable scenery, not protected landmarks. No animation layers are claimed: these are static flattened plates. Runtime localized effects should preserve the plates and target geometry.

Manually inspected approximate conservative main-structure bounds in native pixels (includes main arch, adjacent whole columns where present, pot and tool crate):

| Scene | Left | Top | Right | Bottom | Margins L/T/R/B |
| --- | ---: | ---: | ---: | ---: | --- |
| Landscape v2 | 390 | 120 | 1190 | 414 | .254 / .117 / .225 / .596 |
| Portrait v2 | 231 | 245 | 784 | 556 | .226 / .160 / .234 / .638 |

Landscape v1 was rejected for a main arch near the top edge. The targeted correction improves its top margin to about 12%, but **does not pass the initial 20% landscape top-margin target**. The parent integration agent was informed and chose to finalize these assets with actual camera bounds taking precedence over the original quiet-ground y30% brief. Landscape camera implementation must keep the recorded silhouettes visible; this artwork is not evidence of blanket responsive acceptance. Portrait correction moves side props inward and makes space below the arch; it meets the skill's 14% top, 12% side and 30% bottom source margins. Recommended clear-ground starts are y41% landscape and y39% portrait, with the bottom 25% available for the action dock. Do not position an opaque runtime excavation overlay at y30% over the arch.

The cover is fully square and full bleed, with exactly **Relic** in integrated cream carved lettering. Review at native size and at 160×160 confirms correct spelling, strong title legibility, and distinct fossil, aqua crystal and ceramic-creature motifs. No duplicate title or box mockup. Thumbnail proof is `cover-thumbnail-160.png`.

These are source-image checks only. Browser camera coverage, small-screen overlays, touch interactions and fractional browser zoom were not tested by this artwork agent.
