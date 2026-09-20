# Talo production artwork

## Relic token

Exact prompt:

Use case: game-asset. Generate one fresh transparent-background gameplay token for Talo. A single chunky golden temple relic shaped as a faceted sun disk, with a rich lapis-blue circular center. Tactile painterly graphic sandstone-temple bas-relief style, warm matte gold with strong readable broad facets and a slight dimensional raised rim, true overhead view. The round sun silhouette has eight broad short geometric rays integrated into its rim. Center the single object occupying80% of a square1024x1024 canvas. Extremely clear recognizable silhouette at40 pixels. Restrained highlights from upper left. Transparent alpha background is mandatory, not a checkerboard painted into the image. No words, no lettering, no scenery, no ground plane, no cast shadow beyond the object silhouette, no UI, no additional objects.

Built-in imagegen fresh text-only generation. Source: /Users/williamguinaudie/.codex/generated_images/01a0beec-82cc-7070-b6c6-763351f85be0/exec-7c0ecdc6-3683-46ff-86d4-18e5611c633f.png. Output: public/art/talo-relic-token-v1.png. Visually reviewed single eight-ray golden sun disk with lapis center and transparent background. Native size deviates from requested1024: actual1254x1254; preserved native output without resizing. Actual silhouette occupies about98% rather than80%; no clipping, text or scenery. PNG alpha verified from decoded pixel data. Fine edge speckle is visible at native magnification; test small-size rendering during integration.


## Framing correction prompts

Landscape edit of attempt1:

Edit only framing of this landscape illustration. Keep exactly the same nine-room temple, all wall details, colors, open corridors and overhead camera. Compress ONLY the temple's vertical proportions moderately so its complete outer walls extend from20% to80% image height instead of11% to86%. Its middle room centers should be y50%, upper y30%, lower y70%. Keep its main room centers x28%,50%,72%. Shorten entrance walkways so all architecture including carpets fits between15% and85% image width. Extend quiet sand above to a full20% height and quiet paving below to a full20% height. No new objects, no text, no tokens. Output1536x1024 landscape. Keep all nine rooms and all12 orthogonal corridors.

Portrait edit of attempt1:

Edit only framing of this portrait illustration. Keep exactly the same nine-room3x3 temple with12 open corridors and all stone style and details. Fit the COMPLETE temple INCLUDING both entrance carpets inside middle76% image width (left12%,right88%). Shorten the entrance protrusions substantially, and slightly narrow room widths if necessary. Move the top outer wall down from15% to20% image height; keep bottom outer wall at78%. Upper room centers should be30% height, middle49%, lower68%. Side room centers26% and74% width, middle50%. Top20% quiet desert sand, bottom22% quiet pale paving. Keep all nine spacious floors clear and level. No text, tokens, relics, objects or UI. Output1024x1536 portrait.

## Outputs and inspection

- Final landscape: public/art/talo-world-landscape-v1.png, 1536x1024. Cache source exec-29f1f5f1-7622-4368-9492-5c1172e97ca6.png.
- Final portrait: public/art/talo-world-portrait-v1.png, 1024x1536. Cache source exec-598a3528-8e44-441b-861b-1f91ddfb7aac.png.
- Generation cache directory: /Users/williamguinaudie/.codex/generated_images/01a0beec-82cc-7070-b6c6-763351f85be0.
- First attempts preserved beside this document as talo-production-landscape-attempt1.png and talo-production-portrait-attempt1.png. Initial landscape made main temple too tall; initial portrait entrances touched source edges.
- Visual review: both finals contain exactly nine rooms, twelve open orthogonal corridors, spacious bare floors, true overhead camera, no baked game pieces, relics or text. Decorative geometric trim remains on walls and rugs.
- Approximate manually read landscape room centers: x28,50,72%; y31,47,64%. Clear floor centers in pixels about (430,316),(768,316),(1106,316); rows y316,485,656. Main wall bounds x15..85%, y19.5..76%; complete entrance rugs extend x6.5..93.5%. These outer entrances miss requested protected bounds. Runtime must fit measured complete landmarks, not requested geometry.
- Approximate manually read portrait room centers: x26,50,74%; y28.5,45.5,62.5%. Main wall bounds x9..91%, y17.5..73%; complete entrance rugs x4..96%. Room floor row centers y440,700,960px. These differ from requested y30,49,68%; runtime must align to measured actual art. Keep lower dock in quiet bottom27%.
- Margins include main architecture and entrance rugs, exclude expendable surrounding ruins and cast shadows: landscape L6.5%,R6.5%,T19.5%,B24%; portrait L4%,R4%,T17.5%,B27%. These sources do not meet original strict protected rectangle. They are documented integration candidates, not proof of all-device framing acceptance.
- No browser, touch or integration validation performed by the artwork agent.


Built-in imagegen; independent fresh text-only generations. No reference images.

## Landscape exact prompt

Use case: illustration-story. Asset: production illustrated game background plate, no UI.
Style: exceptional graphic painterly sandstone bas-relief illustration for Talo, a rival treasure expedition through a shifting temple. Ochre and cream sunlit carved stone, lapis and vermilion woven entrance accents, confident mature shapes, tactile matte materials, readable architecture. A single sun at upper left casts short shadows toward lower right. True vertically overhead architectural plan, screen-parallel room floors, no isometric tilt or perspective convergence.
Subject: exactly nine spacious open rectangular room floors in a regular THREE COLUMNS BY THREE ROWS temple. All nine rooms are equal functional size, each with a huge unobstructed pale stone center for later digital pieces. Thin chunky sandstone walls separate rooms. Small simple EMPTY stone corridors at each shared orthogonal wall center connect neighbors. No closed gates; the app adds gates later. Left entrance opens into middle-left room; right entrance opens into middle-right room. A small lapis woven detail lies outside left entrance, vermilion woven detail outside right entrance. All other floor space empty, subtle floor joints only; absolutely no central pedestal, statues, tokens, relics, crown, treasure, characters or lettering. Nine rooms should be immediately countable.
Scenery: expendable desert sand and low ruined wall fragments on outer sides, continuous to every image edge, no outer frame. Top band quiet sand with sparse low rubble. Bottom band quiet level cream sandstone paving reserved for a later floating action dock; no painted dock. No major architecture outside protected main temple.
Hard negatives: NO TEXT, lettering, glyphs, symbols, hieroglyphs, slogan, UI, buttons, action tray, player pieces, game tokens, gems, relics or people. No reference image; generate completely fresh.
Composition: landscape 1536x1024. Main temple complete silhouette fills middle 70% width and 60% height: left15%, right85%, top20%, bottom80% (x230..1306 y205..819 pixels). Above it a continuous quiet sand band fills one fifth of image; below it one fifth quiet paving; each side fifteen percent sand and sparse expendable ruins. Every main outer wall and entrance stays in these bounds. Nine room centers x28%,50%,72% crossed with y30%,50%,70% (x430,768,1106 and y307,512,717 pixels). Room width about20% source, room height about18%; align all centers carefully. Make the temple broad and flat with exactly3x3 connected rooms, not a tall square.

## Portrait exact prompt

Use case: illustration-story. Asset: production illustrated game background plate, no UI.
Style: exceptional graphic painterly sandstone bas-relief illustration for Talo, a rival treasure expedition through a shifting temple. Ochre and cream sunlit carved stone, lapis and vermilion woven entrance accents, confident mature shapes, tactile matte materials, readable architecture. A single sun at upper left casts short shadows toward lower right. True vertically overhead architectural plan, screen-parallel room floors, no isometric tilt or perspective convergence.
Subject: exactly nine spacious open rectangular room floors in a regular THREE COLUMNS BY THREE ROWS temple. All nine rooms are equal functional size, each with a huge unobstructed pale stone center for later digital pieces. Thin chunky sandstone walls separate rooms. Small simple EMPTY stone corridors at each shared orthogonal wall center connect neighbors. No closed gates; the app adds gates later. Left entrance opens into middle-left room; right entrance opens into middle-right room. A small lapis woven detail lies outside left entrance, vermilion woven detail outside right entrance. All other floor space empty, subtle floor joints only; absolutely no central pedestal, statues, tokens, relics, crown, treasure, characters or lettering. Nine rooms should be immediately countable.
Scenery: expendable desert sand and low ruined wall fragments on outer sides, continuous to every image edge, no outer frame. Top band quiet sand with sparse low rubble. Bottom band quiet level cream sandstone paving reserved for a later floating action dock; no painted dock. No major architecture outside protected main temple.
Hard negatives: NO TEXT, lettering, glyphs, symbols, hieroglyphs, slogan, UI, buttons, action tray, player pieces, game tokens, gems, relics or people. No reference image; generate completely fresh.
Composition: portrait 1024x1536. Main temple complete silhouette fills middle76% width and58% height: left12%,right88%,top20%,bottom78% (x123..901 y307..1198 pixels). Above it a continuous quiet sand band fills one fifth image; below it over one fifth quiet paving; each side twelve percent sand and sparse expendable ruins. Every main outer wall and entrance stays in these bounds. Nine room centers x26%,50%,74% crossed with y30%,49%,68% (x266,512,758 and y461,753,1044 pixels). Room width about22% source, room height about17%; align all centers carefully. Make a dedicated tall architectural plan with exactly3x3 connected rooms.
