# Folio background plates (22 September 2026)

Generated with the built-in image generation tool from the written prompts in
`prompt-landscape.txt` and `prompt-portrait.txt` only; no reference images were
supplied. Two variants per orientation, each a fresh generation.

| Variant | Size | Checked | Used |
| --- | --- | --- | --- |
| `bg-landscape-a.png` | 1536 × 1024 | no text, quiet centre, newsprint/crossword mountain faces | yes |
| `bg-landscape-b.png` | 1536 × 1024 | no text, quiet centre, lighter faces | no |
| `bg-portrait-a.png` | 1024 × 1536 | no text, quiet centre, crossword faces | yes |
| `bg-portrait-b.png` | 1024 × 1536 | no text, clouds top-left, darker foreground | no |

The A variants echo the box cover's newsprint mountains most closely. Exports:
`node docs/concepts/2026-09-22-folio/background/export.mjs` from the repository
root writes `public/art/folio/folio-bg-landscape-{1536,960}.webp` and
`folio-bg-portrait-1024.webp`.
