# Relic arcade room scenery

Six original room plates generated on 2026-09-22 with the built-in ImageGen tool. Each plate was generated independently from its written prompt without image references. Landscape plates received one fresh text-only framing correction; the initial outputs are retained for provenance. Portrait plates are independently composed artwork, not crops of the landscape plates.

All plates share hand-painted gouache, inky contours, carved timber, aged brass, and the architecture of an overgrown manor. Their dark quiet centers intentionally contain no gameplay target, mechanism, text or interface. Runtime mechanisms belong above the scenery.

## Files and exports

- `sources/` contains original native PNGs and retained rejected initial landscape candidates.
- `arcade-*-v1-framing.prompt.txt` contains the exact final landscape prompts.
- `arcade-*-portrait-v1.prompt.txt` contains the exact portrait prompts.
- `arcade-{darts,forge,bells}-v1.prompt.txt` contains the original landscape prompts.
- Runtime assets are `public/art/relic/arcade-{darts,forge,bells}-v1.webp` and `public/art/relic/arcade-{darts,forge,bells}-portrait-v1.webp`.
- `provenance.json` maps every runtime asset to its PNG, exact prompt, generated original path, SHA-256 hashes, dimensions, and approximate visual geometry.

Exports use Sharp WebP quality 90 and effort 6 at native resolution. No cropping, resizing, recoloring, padding or painting was applied. Landscape is 1536 × 1024; portrait is 1024 × 1536.

## Geometry and visual review

The following bounds are approximate manual visual measurements in native source pixels, in `[x, y, width, height]` form. They are observations of the output rather than the desired prompt geometry. The complete central crown, frame and base are the protected landmark. Peripheral scenery may be trimmed. In the portrait bell room the two peripheral bells occupy approximately `[72, 172, 882, 285]` as a combined union; both are complete in the source.

| Room | Orientation | Central landmark | Quiet mechanism area |
| --- | --- | --- | --- |
| Darts | Landscape | `[348,150,838,672]` | `[472,351,592,342]` |
| Forge | Landscape | `[404,132,732,642]` | `[490,320,556,384]` |
| Bells | Landscape | `[426,91,686,752]` | `[505,319,538,398]` |
| Darts | Portrait | `[142,201,740,978]` | `[246,490,532,507]` |
| Forge | Portrait | `[144,188,733,931]` | `[270,447,480,503]` |
| Bells | Portrait | `[152,148,720,1008]` | `[262,491,500,540]` |

All final crowns and bases are complete; all plates are full bleed, with rich distinct room materials, readable low-contrast blank centers, and no baked game interface or text. The requested tighter protected regions were not achieved exactly. Fit using the actual bounds above. In particular, portrait Forge's quiet center is near y699 (45.5% of source height), so a large target centered at exactly 50% may overlap the frame base.

The initial landscape variants were rejected for crown and base placement too close to the source edges. The final outputs were visually inspected as artwork and their dimensions verified after encoding. Browser, responsive runtime composition and touch acceptance were not performed by this asset task.
