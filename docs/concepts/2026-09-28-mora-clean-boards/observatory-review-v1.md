# Observatory clean mobile board

- Fresh built-in image generation, no reference images used or opened.
- Exact request: `observatory-prompt-v1.txt`.
- Source: `public/art/mora-phone-observatory-v5-a.png` (996 × 1580 native PNG; requested 1200 × 1904). No extension, stretching, mirroring or retouching.
- Visually inspected: six correct habitats, exactly seventeen cream pads, no extra horizontal label strips, plaques or pathways. Ground in front of and between places is continuous organic moss and earth. The aqueduct alone remains a horizontal structure because its gameplay identity requires it.
- Count independently confirmed with `LOOSE=1 node scripts/measure-pads.mjs`: seventeen components; square pads 75–83 px wide, round pads 76–86 px wide. Nominal token width 79 px. Centers in the draft geometry are measured cream-region centroids.
- Complete main landmark bounds are conservatively hand measured from the new image. Union: x=28..954, y=40..1267; width/source 0.930, height/source 0.777, area/source 0.722. Margins left 2.8%, right 4.2%, top 2.5%, bottom 19.8%. This is wider and taller than the current accepted source; artwork generation did not honor all framing fractions.
- `observatory-geometry-v1.json` is a DRAFT for runtime camera assessment. Label anchors, crop and animation polygons are hand estimates and must be reviewed in integration. The camera may need to fit complete silhouettes; do not call this accepted from the pad count alone. It may lose some of the user-approved creature scale if fitted to all conservative bounds.
- No browser, touch, geometry acceptance, runtime reference or production output change was performed by this art subtask.
