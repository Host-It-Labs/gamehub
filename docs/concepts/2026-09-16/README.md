# Gamehub style concepts — 16 September 2026

Generated with the built-in imagegen tool, delegated to the style_concepts agent. AI-generated concept art, not handmade production photography. All seven outputs were visually inspected.

Mora and Yata are provisional name proposals only. Mockup text, numbers, scoring symbols, habitat names, card counts, player portraits and fictional navigation are non-authoritative. Follow engine rules and code-render actual labels. The five interface concepts are static illustrations, not implemented screens or working animations.

## Deliverables and inspection

- [Library](library-v1.png): warm neutral shell, distinct tactile boxes, pale Play buttons. Three launch stills communicate lift/open/play, but switch game identities between frames; not one continuous animation. Incidental packaging slogans and fictional navigation are illustrative.
- [Nature A — paper observatory](mora-paper-v1.png): raised habitat ledges, central dome and physical animal standees. User approved this direction; preserve scene scale and central building.
- [Nature B — painted expedition case](mora-gouache-v1.png): flowing tropical landscape and gouache surface; alternative only. Contains extra generated slogans, fictional habitat labels and slot counts.
- [Food A — cel counter](yata-arcade-v1.png): strongly graphic counter, top portraits and large stall signs. Generated repeated scoring rows and stall abilities are illustrative only.
- [Food B — miniature courtyard](yata-clay-v1.png): physical clay/ceramic components, awnings and warm lighting. Darker than requested palette, plus a decorative hand and incidental text; still useful as a distinct visual option, not final UI specification.
- [Box texture atlas](box-front-textures-v1.png): production source; 1536 × 1024, three equal 512px-wide front-facing panels, left Blackwake ink, middle nature paper, right food cel. No typography or box perspective. Crop thirds without changing artwork.
- [Clean observatory environment](../../../public/art/observatory-diorama-v1.png): production source; 1536 × 1024, faithful paper diorama without UI, pawns or text. Three physical path beds remain. Approximate percentage target centers: roof garden (20,26), courtyard (49,49), hollow (11,69), path (40/49/57,78), stream bank (79,76), watchpost (85,35). Main implementation owns exact target mapping and mechanical capacity.

## References and provenance

Library reference: public/art/blackwake-cover-v1.png, inspected before generation, style reference for Blackwake only.
Clean environment reference: mora-paper-v1.png, inspected before generation, preserve architecture/materiality and remove UI.
Other outputs were generated from text with no reference image.
Original generated outputs retained under /Users/williamguinaudie/.codex/generated_images/01a0aa87-9219-7d01-a76c-e789c7882297/.
Initial batch interrupted after both nature outputs; recovered those original files. Food concepts generated again after interruption.

## Exact final prompts

### library-v1.png

```text
Use case: ui-mockup. Create one landscape high-fidelity conceptual game-library screen, warm neutral cream/oat background, no hero headline or tagline, tiny Gamehub wordmark and sparse navigation. Main scene three tactile physical board-game boxes on a pale oak ledge/table, inviting generous spacing. First box BLACKWAKE uses the reference only for its existing imperfect ink nocturnal harbour pirate-radio art: navy, charcoal, warm paper, rust. Second box MORA is botanical sculptural cut-paper sage/ochre reclaimed observatory. Third box YATA is energetic vermilion/cobalt cel-illustrated street food. Give each box different silhouette and visual world; not uniform flat dashboard cards. Small pale warm coral Play buttons below each box with dark legible type, not dark blocks. Lower quarter is three small launch-animation storyboard stills: box lifts, lid opens, board unfolds into immersive playable tabletop. Label only 'Lift', 'Open', 'Play'. This is one concept presentation image, no browser frame or device mockup. Handmade credible materiality, mature playful design, sophisticated restrained neutral shell. Exact game titles BLACKWAKE, MORA, YATA; the latter two are conceptual proposed names. Avoid hero marketing copy, black page backgrounds, generic SaaS cards, glossy over-rendered game art.
```

### mora-paper-v1.png

```text
Use case: ui-mockup. One landscape high-fidelity concept image of a complete playable digital board game, not a moodboard or physical product photograph. Large immersive board occupies central 70%, sparse three player name/score tokens along top with one active player clearly highlighted. Fan of illustrated drafting cards bottom, prominent pale confirmation button directly beside hand. No bottom status strip, no rules paragraphs, no dashboard grids. Preserve conceptual habitat placement or food drafting mechanics; any tiny labels/slot counts are illustrative only. Mature handmade expressiveness, simple readable shapes, no over-detailed AI fantasy gloss. Game title MORA (proposed name). Nature habitat-placement game as a tactile layered cut-paper botanical diorama, sage green, warm ochre, muted coral and off-white. The board is an abandoned inland observatory reclaimed by foliage, architecture cropped large enough for small readable animal standees. Distinct asymmetrical clearings, roof garden, root hollows, winding path with three card spaces, dry channel and watchpost, naturally embedded in landscape. Tiny fox/owl/beetle/marten/frog/hare paper pieces; six creature cards in hand. Real paper edges, soft cast shadows, simplified elegant leaf forms, varied heights. Quiet storybook theatre without childish proportions. White botanical cutout UI tabs, organic embossed tokens, not distressed ink/zine. Roam and Migration are two small tangible action tokens next to hand. Title and Confirm only prominent text.
```

### mora-gouache-v1.png

```text
Use case: ui-mockup. One landscape high-fidelity concept image of a complete playable digital board game, not a moodboard or physical product photograph. Large immersive board occupies central 70%, sparse three player name/score tokens along top with one active player clearly highlighted. Fan of illustrated drafting cards bottom, prominent pale confirmation button directly beside hand. No bottom status strip, no rules paragraphs, no dashboard grids. Preserve conceptual habitat placement or food drafting mechanics; any tiny labels/slot counts are illustrative only. Mature handmade expressiveness, simple readable shapes, no over-detailed AI fantasy gloss. Game title MORA (proposed name). Alternative nature habitat-placement game with expressive gouache adventure/natural-history field-case presentation. Tropical flooded research station painted in loose broad confident brushstrokes: vivid ultramarine water ribbons, jade mangroves, warm apricot sunlit concrete, dusty lilac shadow, antique ivory. An open expedition field case frames a richly painted unfolded landscape map, with large cropped station structures and seven organically distinct habitat areas; small animal tokens crab/gecko/rail/turtle/bat/moth placed within habitats, winding tidal path visibly three spaces. Painted water dominates, convincing animal/environment scale. Hand of creature specimen cards bottom, top players written on small taped field labels. Roam and Migration as two field-kit action buttons next to hand. Bold flowing painted shapes with visible brush ends, adventurous and unusual, neither paper diorama nor woodcut print nor generic cozy game. No 3D gloss. Title and Confirm only prominent text.
```

### box-front-textures-v1.png

```text
Use case: stylized-concept. Production texture atlas, landscape 3:2 image split into exactly THREE equal-width vertical rectangular panels edge-to-edge with crisp straight boundaries at one-third and two-thirds width. Each panel is front-on orthographic full-bleed boardgame box FRONT artwork, NO perspective, NO box depth, NO cast shadow, NO typography, NO letters, NO labels, no margins. Left panel: nocturnal pirate-radio salvage harbour, bold imperfect ink printmaking navy charcoal rust cream, improvised boat and moon. Middle panel: botanical tactile cut-paper sculptural observatory, central domed observatory building with sage ivy and ochre flowers, cream paper ground, soft relief local self-shadow only, elegantly simplified. Right panel: bold flat cel-animated late-night food counter and lively handmade stall signs WITHOUT ANY TEXT, vermilion cobalt cream, expressive simplified dishes, thick graphic contours. All three styles must be strongly distinct; mature playful not glossy AI fantasy. Panels must each be usable alone as front-facing box texture. Equal panel widths and complete compositions.
```

### yata-arcade-v1.png

```text
Use case: ui-mockup. Landscape complete playable digital food card-drafting boardgame concept title YATA (proposed name), bold cel-animation arcade food-counter energy. Vermilion cobalt warm cream. Large enamel food counter board occupies central70%, dishes in scoring sets, bottom six-card drafting hand, prominent pale Confirm button directly beside hand. Three player portraits/names/scores top, active player highlighted. Large Specialty Stall sign buttons at sides show available, selected, exhausted, tiny customer order ticket. Simplified dumpling/noodle/skewer/pickle/bun/pudding illustrations, thick contours, angular gig-poster typography, flat expressive steam accents. Mature playful tangible tabletop, no kawaii faces on food, no distressed woodcut, no photorealism, no neon gloom. Sparse chrome, no dashboard panels, no status strip, no rules prose. Preserve draft/placement mechanics; tiny icon/count details illustrative. Title and Confirm only prominent text.
```

### yata-clay-v1.png

```text
Use case: ui-mockup. Landscape complete playable digital food card-drafting boardgame concept title YATA (proposed name). Handbuilt stop-motion miniature late-night food stalls, matte fingerprint clay, handmade ceramic dishes, stitched small awnings, dusty plum pistachio mint peach buttercream. Central70% compact winding counter courtyard board with three miniature stalls and ceramic food tiles, elegant imperfect sculptural forms. Bao/roti/chilli crunch/rice/corn/coconut ice as simple dish silhouettes without faces. Bottom six food drafting cards as thick ceramic-edged printed tiles, prominent peach ceramic Confirm button beside hand. Three player clay portrait medallions/scores top, one active. Three obvious pressable stall signs at side available/selected/exhausted, tiny order ticket. Soft practical evening lamp light, felt shadows. Mature playful not baby cute, sparse chrome no dashboard or status strip or rules prose. Entirely distinct from flat cel art/woodcut. Title and Confirm only prominent text. Preserve drafting and scoring sets, no invented game mechanics.
```

### ../../../public/art/observatory-diorama-v1.png

```text
Use case: precise-object-edit. Use the provided observatory game concept as visual reference; create a clean environment asset faithful to the SAME tactile handmade paper diorama style, composition, central architecture, vegetation and materiality. Landscape 3:2 full bleed. ONLY the environment, filling the entire image edge to edge. Central glass-domed abandoned observatory, circular roof garden upper-left, wide circular courtyard centrally below dome, root hollow lower-left, broad three-part dry garden path foreground-center, stream-bank right-middle, raised watchpost upper-right. Six broad unobstructed habitat ledges remain readable for separately rendered game pawns. Retain close architectural scale, detailed layered paper foliage, sage ochre cream coral, physical miniature craft lighting. Remove ALL UI, text, labels, cards, animal pawns, portraits, counters, numbers, placement circles, leaf markers, buttons, table edge, human hands. The architecture and natural ledges alone indicate habitats; do not add drawn slot outlines. Dome and garden upper half, dry path foreground. Match the reference more than inventing a new scene.
```


