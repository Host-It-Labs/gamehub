# Observatory paper v3

Fresh generation on 16 September 2026 with the built-in imagegen tool, delegated to the board artwork agent. The existing `public/art/observatory-diorama-v2.png` was visually inspected as material and geography context; no image was supplied to generation and this is not an edit of that image.

Source: `public/art/observatory-paper-v3.png`. Runtime WebP: `public/art/optimized/observatory-paper-v3.webp` (Sharp, quality 88, effort 6).

Generated cache source: `01a0aabd-feec-7543-92a9-44c6d4386e74/exec-b3b288f0-f181-47f9-85e5-df90eec4b5e6.png`.

## Visual inspection

The result has seventeen empty creature spaces, legible continuous geography, layered paper foliage, folded dome and fibrous pale floors. No text, symbols or creatures were painted. The generator moved some pad centers; final interaction coordinates must follow the image rather than the requested coordinates. Recommended centers in percent: courtyard (46,34), (58,34), (46,43), (58,43); roof (12,15), (24,15), (12,24), (24,24); roots (8,74), (20,73); trail (41,72), (51,78), (60,85); meadow (79,51), (87,63), (90,79); watchpost (87,19). Browser/touch rendering was not inspected.

## Exact generation prompt

```text
Use case: stylized-concept. Asset type: production illustrated landscape board background for Mora, 3:2 aspect ratio, 1536 by 1024.
Create an entirely fresh handcrafted paper diorama of wildlife reclaiming an inland observatory. Every single surface must look touchable and physically made from thick fibrous paper, torn deckled cardstock and folded layered cardboard: bark assembled from strips, tree foliage from overlapping cut leaves, stone terraces from thick cream paper, water as layered blue paper, observatory dome from curved folded paper segments. Rich dimensional craft photography aesthetic, distinctly coarse paper fibers visible throughout, soft directional afternoon light and deep contact shadows between paper layers. Beautiful restrained moss/sage/ochre/pale limestone palette, blue stream, no glossy or realistic stone textures. The paper trees are the style anchor, and all architecture, ground, water and plants share that same tactile papercraft material.
Bird's eye oblique view of a continuous immersive landscape that fills the frame, no surrounding table. A domed reclaimed observatory near top center, wooded slopes and terrace gardens, a hollow giant tree bottom left, a greenhouse trail across the bottom, three broad stepping islands in blue paper water down the right, and one elevated watchpost at upper right. Bold readable shapes, generous individual creature spaces, restrained detail. No creatures or pawns in the artwork.
CRITICAL composition: seventeen clear flat pale paper habitat spaces centered at these exact percentages of the full image (x from left, y from top), each approximately 10% image width and 8% image height with gentle natural oval shapes. Keep all these centers open and unobscured. Four terrace COURTYARD pads centered (46,37),(58,37),(46,47),(58,47). Four ROOF GARDEN pads upper left (12,18),(23,18),(12,27),(23,27). Two ROOT HOLLOW floors beneath the massive tree bottom left (9,71),(22,70). Three GREENHOUSE TRAIL pads bottom center (40,73),(51,76),(62,79). Three MEADOW stepping islands down right side (78,56),(85,67),(86,80). One WATCHPOST pad upper right (87,27).
Landscape joins these distinct areas organically with paths, steps, foliage and water; all slots look like actual places in the geography rather than UI panels or a grid. Separate the pads with shallow paper ridges, roots, foliage or gaps, keep each floor empty. Leave small quiet patches below each habitat group for later DOM labels. No words, no letters, no numbers, no symbols, no signs, no diagrams, no borders, no badges or interface. This is a new composition, not an edit.
```
