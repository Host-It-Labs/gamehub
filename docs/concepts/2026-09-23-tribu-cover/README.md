# Tribu — library cover

Tribu merges My Top Five and Dial into one party game about how well a group
knows each other. Text-only fresh generations with the built-in image tool; no
reference images and no previous cover inspected. Two variants from the same
prompt, `-a` and `-b`.

## Exact prompt (both variants)

Use case: illustration-story. Create a fresh full-bleed square 2D illustrated board-game cover, largest native square size, PNG. Text verbatim: "Tribu", no other text, letters or numbers anywhere. A sociable party game about how well a group of friends really knows each other: they rank favourites and read each other's clues on a spectrum dial. Style: sleek, bold and electric night-party graphic illustration; deep midnight indigo and aubergine background with a soft grain, glowing gradients of hot coral, tangerine, magenta and electric cyan, crisp flat geometric shapes with a few luminous highlights, confident modern poster energy, not cluttered. Composition: a large glowing half-circle spectrum dial sweeping from cyan on the left to coral on the right, with one bright needle, rising behind a lively ring of five or six stylised friends shown as simple abstract rounded silhouettes in different vivid colours leaning together, laughing, one holding up a small stack of five ranked ribbon cards. Make the title "Tribu" a huge chunky rounded custom display typeface in warm cream with a subtle coral glow, integrated across the centre in front of the dial, readable at 160px. All title letters completely within the central 84% of the canvas (8% margins minimum). Artwork fills every edge. Not cut paper, not kraft, not ink printmaking or risograph, not a radio tuner. No UI, no game screenshot, no counters, no border, no external mat or gray padding, no physical box mockup, no additional lettering. Original composition from this description alone.

## Review and choice

| Variant | Path | Title | Margins | Notes |
| --- | --- | --- | --- | --- |
| A | `public/art/box-tribu-v1-a.png` | "Tribu" spelled right | inside 84% | busier crowd, cards fan |
| B | `public/art/box-tribu-v1-b.png` | "Tribu" spelled right | inside 84% | clearer dial and needle, calmer composition |

Both 1254×1254, full-bleed, no extra lettering, no UI. **B chosen** and copied to
`public/art/box-tribu-blind-v1.png`; the 1024 WebP, 320/640 variants, spine and
preview came from the `scripts/optimize-box-covers.mjs` recipe. The previous
My Top Five cover (`box-my-top-five-blind-v1*`) was moved to
`~/Documents/code/gamehub-art-archive/public/art/`.
