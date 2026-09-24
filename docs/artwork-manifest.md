# Artwork generation manifest

Generated 2026-09-16 with the built-in image generation tool, delegated to the artwork agent. No CLI/API fallback, external image downloads, or SVG substitutions were used. Original tool outputs remain under the Codex generated-images directory. All production deliverables were copied into `public/art/`.

## Final assets

- Nox: `blackwake-cover-v1.png`, `blackwake-table-v1.png`.
- Elsewild: `elsewild-cover-v1.png`, `elsewild-observatory-v3.png`, `elsewild-lagoon-v3.png`.
- Nightshift: `nightshift-cover-v1.png`.
- Tokens: 24 separate generated PNGs, listed below. Each was requested with real transparent alpha. Preserve that alpha during optimization.

The v1 maps are rejected scale studies; v2 maps introduced unwanted background animals; v3 removes them and is the production map version. Do not use v1/v2 maps as fallback artwork.

## Inspection and layout guidance

Every image was visually inspected from the native generated-image result. The maps were regenerated after review found architecture too small compared with readable creature tokens. Final maps use cropped large structures and trunks at close courtyard scale. Final maps contain no baked-in creatures, labels, slots, or interface elements. Covers and table are intentionally darker than creature/food tokens; interface text and card ranks must be separate legible DOM elements.

Creature and food tokens have distinct silhouettes with limited print colors and rough ink. Images are original generated art, rather than actual handmade prints. Browser composites, mobile readability, and touch interaction are outside this asset inspection.

### Suggested habitat centers (percentage of source image)

| Zone | Observatory | Lagoon |
| --- | --- | --- |
| 0 | 23,31 | 27,24 |
| 1 | 76,29 | 71,28 |
| 2 | 33,47 | 30,49 |
| 3 | 82,58 | 77,46 |
| 4 | 36,78 | 35,69 |
| 6 | 73,74 | 80,77 |

Observatory zone 3 follows the greenhouse approach diagonally through approximately (78,54), (83,58), (87,63). The large quiet clearing is zone 6. Lagoon water occupies the central channel; animated water should be masked away from all land and the boardwalk. Creature display sizes should stay readable; never shrink them to compensate for architecture scale.

## Token identity mapping

| Filename | Public name | Subject |
| --- | --- | --- |
| elsewild-inland-0-v1.png | Rust Fox | a lean rust-red fox with angular ears and a long sweeping tail |
| elsewild-inland-1-v1.png | Dish Owl | a barn owl with a pale satellite-dish face and ochre wings |
| elsewild-inland-2-v1.png | Moss Beetle | a broad stag beetle with moss-green wing shells and bold mandibles |
| elsewild-inland-3-v1.png | Night Marten | a slender plum-charcoal pine marten with cream bib and arched back |
| elsewild-inland-4-v1.png | Glass Frog | a squat sage-green tree frog with long graphic toes |
| elsewild-inland-5-v1.png | Antenna Hare | an alert ochre hare with long asymmetric ears, mature natural proportions |
| elsewild-coast-0-v1.png | Signal Crab | a red-orange fiddler crab with one oversized angular claw |
| elsewild-coast-1-v1.png | Reef Gecko | a turquoise gecko with a strong curved tail and broad toes |
| elsewild-coast-2-v1.png | Mangrove Rail | a slim russet marsh bird with long legs and dark beak |
| elsewild-coast-3-v1.png | Lagoon Turtle | an olive-green turtle with broad geometric shell |
| elsewild-coast-4-v1.png | Relay Bat | a dark plum fruit bat with folded jagged wings and ochre chest |
| elsewild-coast-5-v1.png | Coral Moth | a coral and cream moth with broad simple triangular wings |
| nightshift-lane-0-v1.png | Char Dumplings | three asymmetrical charred dumplings on a tiny dark ceramic plate |
| nightshift-lane-1-v1.png | Midnight Noodles | a battered blue bowl of thick noodles with two bold scallion pieces |
| nightshift-lane-2-v1.png | Skewer Stack | two burnt-orange grilled vegetable skewers crossing |
| nightshift-lane-3-v1.png | Pickle Crunch | a small paper cone of chunky green pickles |
| nightshift-lane-4-v1.png | Black Sesame Bun | a dark charcoal sesame bun split with cream filling |
| nightshift-lane-5-v1.png | Moon Pudding | a small pale custard pudding with a rust caramel top |
| nightshift-alley-0-v1.png | Ember Bao | an open ochre bao bun with chunky red filling and one green leaf |
| nightshift-alley-1-v1.png | Radio Roti | two angular folded golden flatbreads with char marks |
| nightshift-alley-2-v1.png | Chilli Crunch | a tiny lilac bowl of red chilli crisp and chunky fried pieces |
| nightshift-alley-3-v1.png | Lime Rice | a mound of sage green herb rice with a bold lime wedge on a small dark plate |
| nightshift-alley-4-v1.png | Night Market Corn | one grilled corn cob with burnt orange seasoning and green husk |
| nightshift-alley-5-v1.png | Coconut Ice | a rough coconut half holding cream shaved ice and one red syrup streak |

## Exact prompt set and provenance

The initial lagoon v1 scale study used a flooded tropical research station in a 3:2 linocut aerial landscape with six open geographical habitats. Its source was `exec-c328cefa-4b30-43f8-9c07-9b4eef8fa912.png` in the same generation session. It is superseded and not production artwork.

### elsewild-observatory-v1

Use case: stylized-concept. Production game map background landscape 3:2. Abandoned inland observatory reclaimed by wild nature, handmade indie zine linocut screenprint with imperfect ink, muted ochre sage green charcoal dirty cream. Simple expressive shapes, restrained detail, mature natural-history and alternative gig-poster feel. Overhead oblique map: massive circular observatory ruin in upper center with an empty broad courtyard, winding dry ravine snakes horizontally across lower center, giant overgrown antenna structures establish large environment scale. Six generous empty creature habitats integrated into geography: upper left open moss field; upper right orchard terrace; center left two flat stone outcrops; center right small open greenhouse floor; lower left dry ravine path; bottom right single quiet crescent clearing. Six regions must use much of frame, unobstructed placement surfaces; decorations limited to their edges. No animals no letters no text no UI no panels no grids no slot markers. Completely different geography from a coastal map: mostly land, no lagoon. Paper grain and rough cut ink contour, atmospheric but low detail; no glossy computer rendering.

Source: exec-250249f0-e132-4b15-be32-664d198b91a4.png

### blackwake-cover-v1

Use case: stylized-concept. Production illustrated game asset. Square game cover artwork, no text. Nocturnal pirate-radio harbour: angular improvised skiffs, leaning radio mast, distant moon, torn signal flags and one cloaked crew silhouette. Ink blue, soot black, rusty coral, dirty cream. Strong central composition with readable silhouette, atmospheric maritime punk, no weapons. Handmade indie-zine linocut and risograph screenprint on coarse paper. Imperfect ink contours, simplified silhouettes, restrained palette, selective negative space, rough registration. Deliberately human uneven graphic drawing, not polished computer illustration, no glossy surfaces, no cute baby proportions, no gradients, no text, no logos, no watermarks.

Source: exec-87fefe05-78a3-45f2-9f5e-a1499875d645.png

### blackwake-table-v1

Use case: stylized-concept. Production illustrated game asset. Landscape 3:2 game board background, exact overhead view of a broad oval weathered harbour chart table filling 90% of frame, dark petrol green surface with sparse rough ink contour-map fragments at outer rim, subtle printed clockwise navigation marks but no letters/numbers. Very spacious calm empty middle for playing cards, no actual cards. Around perimeter hints of ropes, portable pirate radio, harbour darkness; objects tiny and only in far corners. Hand-cut oval shape and warm worn wood edge. Mature nocturnal pirate-radio salvage theme. Handmade indie-zine linocut and risograph screenprint on coarse paper. Imperfect ink contours, simplified silhouettes, restrained palette, selective negative space, rough registration. Deliberately human uneven graphic drawing, not polished computer illustration, no glossy surfaces, no cute baby proportions, no gradients, no text, no logos, no watermarks.

Source: exec-8ca612ba-d1b9-4783-b257-e48aa68aa5f7.png

### elsewild-cover-v1

Use case: stylized-concept. Production illustrated game asset. Square game cover artwork no text. Overgrown abandoned astronomical observatory looming behind three small strange natural wildlife silhouettes: fox, owl, beetle. Wild vegetation reclaiming old human science. Moss green, ochre, charcoal, dirty cream. One big broken telescope dome as graphic focal point, intriguing mature natural-history expedition zine, asymmetrical bold composition. Handmade indie-zine linocut and risograph screenprint on coarse paper. Imperfect ink contours, simplified silhouettes, restrained palette, selective negative space, rough registration. Deliberately human uneven graphic drawing, not polished computer illustration, no glossy surfaces, no cute baby proportions, no gradients, no text, no logos, no watermarks.

Source: exec-84c74312-bdca-445e-8658-8d72056eec39.png

### nightshift-cover-v1

Use case: stylized-concept. Production illustrated game asset. Square game cover artwork no text. Underground midnight street-food scene, improvised stalls beneath a railway arch, handwritten abstract sign shapes without actual letters, steam and lanterns, lone cook silhouette wearing apron and beanie, gig poster collage fragments. Charcoal, burnt orange, electric muted lilac, dirty cream. Bold angular perspective, warm expressive and mature alternative aesthetic, coarse two-color shapes not detailed realistic food. Handmade indie-zine linocut and risograph screenprint on coarse paper. Imperfect ink contours, simplified silhouettes, restrained palette, selective negative space, rough registration. Deliberately human uneven graphic drawing, not polished computer illustration, no glossy surfaces, no cute baby proportions, no gradients, no text, no logos, no watermarks.

Source: exec-52369489-d8c1-4824-970f-74ca78211920.png

### nightshift-alley-0-v1

Use case: stylized-concept. A single production game token: an open ochre bao bun with chunky red filling and one green leaf. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-77a773a9-9ffc-45ec-b1a7-4a66032d3efa.png

### nightshift-alley-1-v1

Use case: stylized-concept. A single production game token: two angular folded golden flatbreads with char marks. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-1b823e48-1b41-4b65-b386-405640018f33.png

### nightshift-alley-2-v1

Use case: stylized-concept. A single production game token: a tiny lilac bowl of red chilli crisp and chunky fried pieces. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-59d5583d-0b13-4afe-b853-20cad444b6c3.png

### nightshift-alley-3-v1

Use case: stylized-concept. A single production game token: a mound of sage green herb rice with a bold lime wedge on a small dark plate. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-5a9877cd-cef8-47a5-9afa-ddc29c674354.png

### nightshift-alley-4-v1

Use case: stylized-concept. A single production game token: one grilled corn cob with burnt orange seasoning and green husk. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-bbdae82b-ef07-4d70-ae1f-fd5ca288e6b9.png

### nightshift-alley-5-v1

Use case: stylized-concept. A single production game token: a rough coconut half holding cream shaved ice and one red syrup streak. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-3f9cd3c5-964d-4196-bc97-3e82197060cc.png

### nightshift-lane-0-v1

Use case: stylized-concept. A single production game token: three asymmetrical charred dumplings on a tiny dark ceramic plate. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-2710d36e-ea9b-4251-80ae-9a5cdea7acb8.png

### nightshift-lane-1-v1

Use case: stylized-concept. A single production game token: a battered blue bowl of thick noodles with two bold scallion pieces. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-75a7f20a-f881-45b8-a1e6-1c17e819a754.png

### nightshift-lane-2-v1

Use case: stylized-concept. A single production game token: two burnt-orange grilled vegetable skewers crossing. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-59ffaa94-3930-45ea-a07e-62b8c597bfa9.png

### nightshift-lane-3-v1

Use case: stylized-concept. A single production game token: a small paper cone of chunky green pickles. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-c43e09bf-fe08-414a-9c0b-e42c5e26b9fc.png

### nightshift-lane-4-v1

Use case: stylized-concept. A single production game token: a dark charcoal sesame bun split with cream filling. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-52de8df1-10ef-44cc-be6d-ebda652e9411.png

### nightshift-lane-5-v1

Use case: stylized-concept. A single production game token: a small pale custard pudding with a rust caramel top. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside object. Centered entire object occupying 80% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph illustration. Very simple imperfect chunky black contours and 3 flat ink colors, subtle coarse ink speckles ONLY inside subject. Strong readable silhouette at 64 pixels. Mature alternative street-food poster aesthetic. Deliberately rough human drawing not glossy not photorealistic not 3D not cute. No words no labels no frame no logo.

Source: exec-6e20dfea-bf61-4ff8-93d7-a20cb3d0fee3.png

### elsewild-inland-0-v1

Use case: stylized-concept. A single production game creature token: a lean rust-red fox with angular ears and a long sweeping tail. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-dbd4a7a6-1009-40bc-92de-3e6d2e4098a9.png

### elsewild-inland-1-v1

Use case: stylized-concept. A single production game creature token: a barn owl with a pale satellite-dish face and ochre wings. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-e31cd0e2-9e0f-4156-9200-32d8de567ede.png

### elsewild-inland-2-v1

Use case: stylized-concept. A single production game creature token: a broad stag beetle with moss-green wing shells and bold mandibles. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-ebf1d3d7-81f6-4af0-87e5-fc76145bfe9f.png

### elsewild-inland-3-v1

Use case: stylized-concept. A single production game creature token: a slender plum-charcoal pine marten with cream bib and arched back. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-10a8d277-bf7f-4715-9854-a93c7ee239b2.png

### elsewild-inland-4-v1

Use case: stylized-concept. A single production game creature token: a squat sage-green tree frog with long graphic toes. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-ccdcab89-f6b9-45f2-8ab9-d995b141be11.png

### elsewild-inland-5-v1

Use case: stylized-concept. A single production game creature token: an alert ochre hare with long asymmetric ears, mature natural proportions. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-cce99188-eec8-493b-aafc-40d72bfc0eea.png

### elsewild-coast-0-v1

Use case: stylized-concept. A single production game creature token: a red-orange fiddler crab with one oversized angular claw. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-cf33ad9c-ba38-4543-8f9d-f40e9e919535.png

### elsewild-coast-1-v1

Use case: stylized-concept. A single production game creature token: a turquoise gecko with a strong curved tail and broad toes. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-0f06845f-078a-4e33-8f7c-56cc8b25c760.png

### elsewild-coast-2-v1

Use case: stylized-concept. A single production game creature token: a slim russet marsh bird with long legs and dark beak. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-15231a54-1db8-413f-966c-a649423d59fa.png

### elsewild-coast-3-v1

Use case: stylized-concept. A single production game creature token: an olive-green turtle with broad geometric shell. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-c87dfb9c-3c5d-4bf7-951d-d79ea30beddd.png

### elsewild-coast-4-v1

Use case: stylized-concept. A single production game creature token: a dark plum fruit bat with folded jagged wings and ochre chest. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-de59b0c1-ba8c-45b5-ac5e-d4830a142c08.png

### elsewild-coast-5-v1

Use case: stylized-concept. A single production game creature token: a coral and cream moth with broad simple triangular wings. Entire animal in three-quarter view, natural mature proportions and lively believable pose. Transparent background with real alpha, no backdrop, no paper square, no checkerboard drawn, no ground, no shadow outside animal. Centered entire animal occupying 75% of square canvas with generous transparent margins. Handmade indie-zine linocut / risograph natural-history illustration. Very simple imperfect chunky charcoal contours and 3 flat muted ink colors, minimal coarse ink speckles ONLY inside animal. Strong readable silhouette at 64 pixels. Deliberately rough human drawing NOT glossy NOT photorealistic NOT 3D NOT cute baby animal. No words no labels no frame no logo.

Source: exec-4e4b222a-3225-4cfa-956c-1817150ca401.png

### elsewild-lagoon-v2

Use case: stylized-concept. Landscape 3:2 production board background. A flooded tropical research station, CLOSE oblique isometric view across one small courtyard and adjacent lagoon, NOT a distant aerial map or island. Cropped HUGE abandoned concrete pillars as tall as half the entire image at far edges, giant leaves as wide as 20% image width, thick palm trunks, partially visible massive building walls run offscreen. Water channel diagonally crosses the middle from upper middle to lower right. Six broad empty walkable regions made of sand, mud, slabs and one boardwalk across the near water: 4 creature spaces on upper-left sandy terrace, 4 on upper-right flat fern courtyard, 2 on middle-left stone shelf, 3 on middle-right wide curved boardwalk, 3 on lower-left mudflat, 1 on lower-right single landing. An animal drawn 9% of image width must look SMALL relative to architecture: doorway is 25% image height. Make land dominate and water at most one quarter. Flat areas calm and mostly untextured. NO miniature buildings or distant landscape. Dark petrol, moss, coral, cream. Handmade coarse linocut indie-zine art. Very simplified bold geometric ink shapes, sparse texture, uneven hand-cut contours, no fine foliage detail, no photorealism, no glossy 3D, no cute style. Mature abandoned-science setting reclaimed by nature. Continuous illustrated environment, not panels or a grid. No animals, people, labels, text, slots, circles or UI.

Source: exec-1dda09cd-ab56-429c-9e7e-de09e8da85e7.png

### elsewild-observatory-v2

Use case: stylized-concept. Landscape 3:2 production board background. Overgrown observatory garden, CLOSE oblique isometric view across one small abandoned courtyard, NOT distant aerial map. Massive cropped curved observatory wall spans upper edge with HUGE archway 30% image height and enormous partial dome going offscreen. Thick tree trunks at side edges and leaves 15% image width. Six large naturally separated low-detail walkable surfaces filling scene: upper-left moss field, upper-right orchard terrace, center-left paired slabs, center-right greenhouse floor with only giant cropped frame at edge, lower-left curving dry stream path, lower-right single quiet clearing. An animal 9% image width looks SMALL next to walls/trees. Ground dominates composition, no skyline, no miniature village. Mostly land with a diagonal winding dry stream, different geography from tropical lagoon. Muted ochre, sage, charcoal, cream. Handmade coarse linocut indie-zine art. Very simplified bold geometric ink shapes, sparse texture, uneven hand-cut contours, no fine foliage detail, no photorealism, no glossy 3D, no cute style. Mature abandoned-science setting reclaimed by nature. Continuous illustrated environment, not panels or a grid. No animals, people, labels, text, slots, circles or UI.

Source: exec-e6328c8f-3656-4bfd-aa74-42cb07b89327.png

### elsewild-lagoon-v3

Edit this board background only: remove every animal, bird or deer, replacing them seamlessly with the matching empty ground. Keep ALL architecture, vegetation, geography, camera, colors, dimensions, printmaking style and placement surfaces exactly unchanged. No animals anywhere. This is an empty game board awaiting separate creature tokens. Do not add anything else.

Source: exec-abf90a9e-fde0-4251-adc6-4b1d41944ccc.png

### elsewild-observatory-v3

Edit this board background only: remove every animal, bird or deer, replacing them seamlessly with the matching empty ground. Keep ALL architecture, vegetation, geography, camera, colors, dimensions, printmaking style and placement surfaces exactly unchanged. No animals anywhere. This is an empty game board awaiting separate creature tokens. Do not add anything else.

Source: exec-318a2b3e-24aa-4f0f-add3-490269437b80.png


- Library box fronts: `box-undertow-v2.png`, `box-wildgrove-v2.png`, `box-midnight-v2.png`; versioned source art with responsive WebP variants and preview entries. [Prompts and provenance](concepts/2026-09-16/box-v2.md).

## Mora paper worlds and creatures — 16 September 2026

Fresh built-in imagegen generations, delegated and visually inspected before integration:
- `observatory-paper-v3.png` → `optimized/observatory-paper-v3.webp`; [prompt](concepts/2026-09-16/observatory-paper-v3.md).
- `floodline-paper-v1.png` → `optimized/floodline-paper-v1.webp`; [prompt](concepts/2026-09-16/floodline-paper-v1.md).
- `mora-paper-{inland,coast}-atlas-v1.png` → twelve `optimized/mora-paper-{inland,coast}-{0..5}-v1.webp` sprites; [prompts and provenance](concepts/2026-09-16/mora-paper-creatures-v1.md).

Reproduce sprites with `node scripts/prepare-mora-paper-creatures.mjs`; the main artwork optimizer also calls this step. PNG alpha is preserved, with measured crops and 512px padded WebP output. Runtime maps, WebGL texture and loading list use the new world assets. Existing sources remain preserved.


### Observatory unified scene v1

- Source: `public/art/observatory-unified-v1.png` (1536 × 1024).
- Runtime: `public/art/optimized/observatory-unified-v1.webp`, built by `scripts/optimize-artwork.mjs`.
- One fresh generation includes the seventeen habitat spaces and their surrounding woodland. The central 80% supplies board geometry; the full image supplies the table scenery. Replaces the runtime board/surroundings composite.
- [Exact prompt and visual review](concepts/2026-09-16/observatory-unified-v1.md).

### Active Observatory paperland and creatures

- `public/art/observatory-paperland-v4.png` → `public/art/optimized/observatory-paperland-v4.webp` (1536 × 1024, quality 88). [Prompt and source geometry](concepts/2026-09-16/observatory-paperland-v4.md).
- `public/art/mora-paper-inland-atlas-v2.png` → six transparent `public/art/optimized/mora-paper-inland-{0..5}-v2.webp` sprites (512 × 512). [Prompt and extraction bounds](concepts/2026-09-16/mora-paper-creatures-v2.md).
- User's style reference: `docs/concepts/2026-09-16/observatory-paper-style-reference.png`.
- Rebuild through `scripts/optimize-artwork.mjs` and its existing creature-preparation step. Prior source versions remain for provenance; current runtime references use paperland v4 and inland creatures v2.


### Active tall Observatory source v5

- `public/art/observatory-paperland-tall-v5.png`: fresh1024 ×1536 portrait source.
- `public/art/optimized/observatory-paperland-tall-v5.webp`: complete scene, quality88.
- `public/art/optimized/observatory-paperland-tall-v5-board.webp`: exact780 ×520 gameplay crop for miniatures/placeholder, quality88.
- Dimensions, crop and paths live in `lib/games/observatory-art.json`, consumed by both runtime and `scripts/optimize-artwork.mjs`.
- [Prompt, inspection and integration](concepts/2026-09-16/observatory-paperland-tall-v5.md). The separately scaled CSS scenery copy is removed; creature assets remain unchanged.

### Observatory framing prototype v7

Active full source: `public/art/observatory-wide-v7.png` (1536 × 1024). Runtime `public/art/optimized/observatory-wide-v7.webp`; gameplay/miniature crop `public/art/optimized/observatory-wide-v7-board.webp` (384 × 256 at560,368). Fresh generated wide composition; source/crop metadata in `lib/games/observatory-art.json`. Native resolution is retained, WebP quality92. v6 is retained as an unselected dimensional candidate. v7 is a framing prototype, not final high-resolution art. Prompts and measured coordinates: [v7 provenance](concepts/2026-09-16/observatory-wide-v7.md).

### Active tighter Observatory v8

`public/art/observatory-wide-v8.png` (1536 ×1024), with quality92 WebP and528 ×352 miniature crop at510,300. Shared metadata and all seventeen positions updated. Native gameplay allocation is89% larger thanv7; no synthetic upscale. v7 retained.

### User-selected active v10

`public/art/observatory-detail-v10.png` (1536 ×1024), quality94 runtime WebP, and822 ×548 gameplay derivative at372,220. The user selected this candidate despite its differing generated composition. All17 coordinates are integrated; prior rejection notes are historical. Built-in source resolution is accepted; no API or artificial upscale.

### Active handmade-paper Observatory v14

`public/art/observatory-handmade-v14.png` (native1536×1024), full-scene quality94 WebP and exact822×548 board derivative at372,220. Fresh composition from the user's original handcrafted-paper reference, with bounded corrections to enforce17 slots. Replaces v10 in shared runtime metadata; existing framing retained and all habitat targets remeasured. [Prompts and inspection](concepts/2026-09-16/observatory-handmade-v14.md).

### Active protected-landmark paper v17

`public/art/observatory-handmade-v17.png`,1536×1024; full scene and exact822×548 crop exported as quality94 WebP. Replaces v14. Complete key structures are lowered into the measured central safe area. Source metadata includes six protected landmark bounds; all17 slots remeasured. [Prompts and review](concepts/2026-09-16/observatory-handmade-v17.md).

### Active balanced paper v18

`observatory-handmade-v18.png`, native1536×1024, quality94 fullscene and exact822×548 miniature WebPs. All17 targets remeasured; source/crop dimensions retained. Landmark bounding area26.81% versus22.11% in v17. [Generation provenance](concepts/2026-09-16/observatory-handmade-v18.md), [composition and camera calibration](concepts/2026-09-16/observatory-framing-calibration.md).

## Floodline Station three-round boards — 23 September 2026

- `mora-floodline-landscape-v5-b.png` and `mora-floodline-portrait-v5-b.png` → `optimized/mora-floodline-{landscape,portrait}-v5-b{,-board,-overview}.webp`; 23 spaces. Unused `-v5-a` candidates kept beside them. [Prompts and measurements](concepts/2026-09-23-floodline-three-rounds/README.md).

