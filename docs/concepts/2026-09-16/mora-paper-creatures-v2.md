# Simplified Observatory creatures v2

Generated 2026-09-16 with built-in image generation. Fresh atlas using the user's image as a style reference only.

- Source: `public/art/mora-paper-inland-atlas-v2.png`
- Reference: `/Users/williamguinaudie/Downloads/Codex Image 16 Sept 2026, 16_34_56.png`
- Generated source: `/Users/williamguinaudie/.codex/generated_images/01a0aaec-6172-7302-a4a9-2c306526ea59/exec-a38f08a4-e0c9-4211-85a9-f1d496e5c575.png`
- Dimensions: 1536 x 1024 RGBA PNG. Actual alpha verified: 926,220 fully transparent pixels; antialiased edges retained. Original generator alpha preserved.
- Visual inspection: six complete natural animal paper cutouts, cream cut edges, restrained printed marks. Inspected flattened onto dark sage as well as source. No bases, labels, scenery or background. Layout is approximate, not exact 512px cells: fox extends to x=533 and hare starts at y=509; crop using the bounds below rather than fixed cells.

Inclusive visible alpha bounds (alpha > 16), x0,y0,x1,y1:

| Creature | Bounds |
|---|---|
| Rust Fox | 43,53,533,478 |
| Dish Owl | 643,49,913,494 |
| Moss Beetle | 1099,53,1443,475 |
| Night Marten | 40,591,500,946 |
| Glass Frog | 597,624,966,949 |
| Antenna Hare | 1099,509,1433,975 |

The generator retains very faint alpha outside visible silhouettes; allow a small crop margin. No manual alpha removal was applied.

## Final prompt

```text
Use case: stylized-concept.
Asset type: ONE transparent game creature sprite atlas, 1536x1024 pixels, 3 columns by 2 rows of invisible 512x512 cells.
Input image: provided image is STYLE REFERENCE ONLY. Generate fresh creature artwork, not an edited screenshot. Closely match its calm handcrafted printed paper animal standees.
Primary request: six full-body woodland creatures, exactly one centered in each cell. Reading order top row: rust-orange red fox standing in side three-quarter profile with cream chest and bushy tail; tan and cream barn owl standing facing viewer with simple heart facial disk; dark olive ground beetle top-down with six complete legs and antennae. Bottom row: warm dark brown pine marten side three-quarter standing with long tail and cream throat; sage green tree frog side three-quarter crouched with visible limbs and toes; taupe brown hare sitting side three-quarter with long upright ears.
Style: restrained handcrafted cut-paper standee illustration with a thick warm cream cardstock cut edge around every animal. Animal itself made from just a few broad layers of matte colored cardstock and simple printed marks, subtle paper fiber. Natural, calm proportions; graphic species silhouettes readable at 60px. Flat or shallow paper relief, not polygonal sculpture. Less detail than the reference; no fine realistic fur, feathers or intricate texture. No oversized cartoon eyes.
Composition: each complete animal occupies about 65-75% of its cell, generous truly transparent margin on all sides, no overlap. Keep all ears, tails, legs, toes and antennae within the animal's cell. Similar visual weight across animals.
Background: actual transparent alpha everywhere outside the six cut-paper animal silhouettes. No opaque white or colored background. No floor or ground shadow.
Constraints: no text, labels, UI, frames, gridlines, cards, plants, leaves, scenery, bases, pedestals or extra objects. Precisely six animals. No photorealism, no detailed 3D mesh, no glossy rendering.
CRITICAL production sprite layout: completely clear fully transparent empty space between creatures, no soft glows or blurry halos. Each entire sprite including paper border must fit WITHIN 400x400 pixels centered in its own 512x512 cell. Never extend past cell edge. The fox and marten must be smaller to fit their wide tails. Alpha must be exactly zero on empty space, no background texture or shadow. Only the six animals, floating separately on transparency.
```

An earlier generated candidate was rejected for crowding. Its image was not integrated or copied into the project.


## Runtime delivery

`node scripts/prepare-mora-paper-creatures.mjs` extracts the measured bounds with six pixels of padding, preserves generated alpha, fits each sprite inside 460 × 460 and centers it on a transparent 512 × 512 canvas. Outputs: `public/art/optimized/mora-paper-inland-{0..5}-v2.webp`. Species indices and scoring identities are unchanged. Floodline continues to use its v1 coastal atlas. User style reference also retained as `docs/concepts/2026-09-16/observatory-paper-style-reference.png`.
