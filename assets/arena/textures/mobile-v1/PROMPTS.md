# Mobile Arena turf v1

Built-in image_gen generation; no pre-existing artwork used as reference.

## Initial prompt

Use case: stylized-concept
Asset type: seamless square mobile 3D game turf albedo texture, at least 1024 x 1024 pixels, full bleed.
Primary request: Original high quality lush warm fresh green turf for a polished cartoon battle arena. Broad checker turf squares in two VERY similar greens, very low contrast, with softly rounded beveled boundaries and refined, broad surface shading. Exactly four by four large squares across the whole texture.
Composition/framing: Orthographic straight top-down flat material swatch, no perspective, entire image is turf. Seamlessly tileable on all four edges. Uniform neutral illumination, no global light gradient.
Color palette: Rich fresh spring grass green with warm yellow-green light areas, restrained subtle variations. Bright and welcoming while calm enough for small colorful troops to remain legible on top.
Materials/textures: Smooth stylized dense turf, premium hand-painted game texture. Almost no individual blades. Only a few tiny soft broad grass accents, no granular noise. Squares read as mown lawn patches, never stone tiles or raised blocks. Simplified large shapes, crisp high quality finish.
Constraints: No characters, towers, paths, objects, flowers, rocks, stones, dirt patches, borders, shadows from objects, text, logos, watermark, UI, or frame. Original artwork.

## Refinement prompt

Use case: precise-object-edit
Edit this original turf texture only: drastically simplify the surface marks and reduce checker contrast. Preserve the four-by-four checker layout, exact square framing, full bleed green surface and tileable structure. Remove all fine grass blades and tiny leaf shapes. Replace them with clean softly shaded velvety green turf, broad subtly mottled color with only four or five isolated stylized small tufts over the entire image. Two checker greens must be much closer in brightness, a quiet subtle lawn pattern. Premium hand-painted cartoon game material with smooth broad strokes. No borders, no objects, no text. Keep native resolution at least 1024 x 1024.

The refinement used only the freshly generated initial candidate. Selected source: grass-mobile-v1.png. Native 1254-square source retained. scripts/arena-textures.mjs builds the production albedo at native size (quality 90), gently corrects edge tones and derives restrained normal/roughness maps. The runtime uses the albedo with very low surface relief. Visually reviewed for square coverage, broad checker composition, green palette and lack of objects/text. Pixel-exact seamlessness is not asserted.
