# Relic cavern artwork

Built-in `image_gen` generation, 22 September 2026. Initial landscape and portrait were independent text-only generations; each then received one framing-only edit using its own initial generated image as the edit target. No earlier game art or external reference was used. Exact prompts and both initial and corrected source PNGs are preserved here.

## Delivered sources and exports

| Orientation | Final source | Runtime export | Native dimensions |
| --- | --- | --- | --- |
| Landscape | `sources/landscape-framing-edit.png` | `public/art/relic/cavern-landscape-v1.webp` | 1536 × 1024 |
| Portrait | `sources/portrait-framing-edit.png` | `public/art/relic/cavern-portrait-v1.webp` | 1024 × 1536 |

Native-size WebP export uses Sharp, quality 90, effort 6, no resizing. `provenance.json` records dimensions, output hashes and byte sizes.

## Visual inspection and geometry

Both source outputs and exported WebPs were visually inspected. Gouache-like irregular mineral facets, violet cave shelves, mint quartz, brass lamps, full-bleed rock, complete main silhouettes and an empty central mineral floor are present. No people, words, grid, painted targets or interface. There are zero painted gameplay slots: runtime tiles own their geometry.

Bounds below are conservative manual visual measurements, approximate to several pixels, in native source coordinates, as left/top/right/bottom. They are not automated segmentation results.

| Orientation | Main props and crystal union | Main union percentages | Wider conservative camera protection |
| --- | --- | --- | --- |
| Landscape | 332 / 184 / 1195 / 513 | x21.6–77.8%, y18.0–50.1% | 284 / 176 / 1204 / 522 |
| Portrait | 150 / 258 / 844 / 432 | x14.6–82.4%, y16.8–28.1% | 136 / 244 / 860 / 500 |

Main union margins: landscape left 21.6%, right 22.2%, top 18.0%, bottom 49.9%; portrait left 14.6%, right 17.6%, top 16.8%, bottom 71.9%. The wider landscape rectangle also protects a small quartz cluster beside the camp; the wider portrait rectangle includes the upper ledge under the objects. Other tiny crystals embedded around the cavern edges are expendable scenic detail.

The initially requested landmark region was not matched exactly: portrait objects extend slightly left and above its x18%/y20% boundaries, and landscape's top margin is below the shared skill's default 20%. These actual bounds must be used by runtime framing rather than claiming the prompt's target geometry was achieved. The parent integration agent accepted the corrected art and directed use of the actual measured bounds with the native dig board positioned below the landmarks.

The original landscape quiet-floor request x25–75%, y28–70% is interrupted by upper crystal/camp corners. Its lower central floor, approximately x29–75%, y50–70%, is clear. Portrait's corrected broad floor is approximately x15–85%, y34–65%, with incidental pebble texture. The runtime board may overlay scenery at its outer edges and must use its own independently readable dimensional tiles. Do not infer gameplay positions from the painting.

## Runtime handoff

Use one uniformly scaled full scene per orientation. Fit the actual protected rectangle and avoid putting the central board above the upper prop shelf. The lower quarter of both sources is dark low-focus rock suited to floating controls. Keep the scene camera independent of the tray, open shop, museum or selected tile count. Main lamp light comes from the upper left; runtime tile shadows should fall lower right. Optional localized quartz glow can be added behind interaction layers, but this delivery has no animation masks or animated layers.

No browser, touch or runtime camera acceptance was performed in this asset-only subtask. Sampling density depends on the integrating viewport and DPR; native source dimensions are retained so that calculation can be made against actual rendered geometry.
