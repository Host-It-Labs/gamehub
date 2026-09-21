# Atlas square cover

Recomposed the existing code-native `public/art/atlas-cover.svg` as
`public/art/optimized/atlas-cover-v2.svg`. Retains its geographic paths, globe,
navy chart palette and amber route; removes the external cream mat and baked-in
title/taglines. The app supplies the title once. Background chart marks extend
to all four edges of the square. This is thematic cartography, not a gameplay
screenshot. No image generation was used for this vector adaptation.

The original file remains intact. Rendered with Sharp and visually inspected
at 640px. Existing Nox, Mora and Yata covers were also inspected in square crops;
main subjects remain legible. Browser/compositor and touch checks were not run.
