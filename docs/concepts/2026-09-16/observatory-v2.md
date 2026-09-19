# Observatory habitat illustration v2

Generated 16 September 2026 with the built-in image-generation tool by a delegated image agent. Original output: `exec-78bc9219-b0ce-42ce-8343-b64d26a0fba6.png`. Production source: `public/art/observatory-diorama-v2.png` (1536 × 1024).

The user's `Codex Image 16 Sept 2026, 16_34_56.png` was visually inspected for paper-diorama direction. This is a fresh generation, not an edit of that reference. No UI, animals, text, cards or baked-in tokens are present. The scene fills the frame once. Its physical platforms were visually counted: 4 courtyard, 4 roof garden, 2 hollow-tree alcoves, 3 glasshouse landings, 3 stream islands, and 1 tower platform.

## Integration geometry

Coordinates are percentages of the complete uncropped image. Bounds use `[left, top, width, height]`; slots mark the middle of the empty floor where a creature standee base should sit. Preserve the 3:2 aspect ratio for geometry alignment.

| Zone | Place | Bounds | Slot centers | Suggested token width |
| --- | --- | --- | --- | --- |
| 0 | Courtyard | `[39, 32, 25, 22]` | `[46, 37], [58, 37], [46, 47], [58, 47]` | 7.2% |
| 1 | Roof garden | `[6, 13, 23, 20]` | `[12, 18], [23, 18], [12, 27], [23, 27]` | 7.2% |
| 2 | Hollow tree | `[3, 63, 25, 16]` | `[9, 71], [22, 70]` | 7.5% |
| 3 | Glasshouse trail | `[35, 69, 33, 17]` | `[40, 73], [51, 76], [62, 79]` | 7.2% |
| 4 | Stream | `[74, 51, 20, 35]` | `[78, 56], [85, 67], [86, 80]` | 7.2% |
| 6 | Tower | `[80, 22, 15, 14]` | `[87, 27]` | 7.8% |

These are visual image measurements; interactive creature alignment remains an integration check. The generated layout moved the courtyard and roof garden upward relative to v1; do not reuse v1 slot positions.

## Generation prompt

Use case: stylized-concept. Production game environment background, landscape 3:2, 1536x1024. Generate a NEW handcrafted paper-cut miniature world with abandoned observatory architecture, limestone terraces, layered cardstock botanical foliage, tactile cut paper edges, muted sage and ochre leaves, warm cream stone, beautiful directional afternoon light, dimensional shadows. Elevated near-isometric camera sees all empty horizontal habitat spaces clearly. Full bleed world fills every edge, no tabletop foreground, no room outside it, no UI, no cards, no tokens, no animals, no writing, no symbols, no frames. A domed ivy-covered observatory anchors upper center, surrounded by SIX DISTINCT natural habitats, with EXACTLY SEVENTEEN large, empty, physically bounded creature spaces total. The exact physical subdivisions are the highest priority: (1) upper left roof garden at 12-34 percent x, 19-38 percent y contains exactly FOUR roomy rounded limestone flower beds in a two-by-two arrangement, separated by deep planted channels; (2) central courtyard at 36-64 percent x, 42-61 percent y is exactly FOUR separate broad pale stone quarter terraces arranged 2x2, each separated by a narrow planted cut, not a blank plaza; (3) lower left hollow tree at 3-28 percent x, 61-82 percent y has exactly TWO wide side-by-side empty floor alcoves separated by a substantial tree root, openly visible; (4) bottom center glasshouse trail at 34-63 percent x, 69-91 percent y has exactly THREE large successive empty stone landings left-to-right, linked by narrow steps, raised at slightly different heights, fragments of glasshouse frame and vines flank the trail without obstructing landings; (5) lower right stream at 70-93 percent x, 65-90 percent y has exactly THREE generous dry pale islands zigzag down a shallow paper-blue creek, each separated from the others by clear water; (6) upper right watchtower at 76-96 percent x, 27-49 percent y has exactly ONE generous unobstructed circular terrace. Integrate the places into one organic breathtaking world, not a grid of panels. All sixteen? correction exactly SEVENTEEN spaces: 4+4+2+3+3+1. Each space around 8-10 percent image width, broad flat empty floor suitable for an animal standee. The habitats should be distinguishable by geography and construction, not labels. No other vacant round pads, no additional apparent playable slots. Dense cutpaper forest separates habitats. Gallery quality, playful physical paper diorama, assured art direction.

## Integration validation

The parent agent visually reviewed the generated source and aligned all seventeen placement coordinates. Responsive image derivatives were regenerated. Typecheck and lint passed; all 85 existing tests passed (the five HTTP tests required an unrestricted localhost listener after the sandbox blocked them). Production build passed with the existing large-chunk advisory. Browser/touch/visual interaction checks were not run. Creature art and player portraits remain unchanged at the user's request.
