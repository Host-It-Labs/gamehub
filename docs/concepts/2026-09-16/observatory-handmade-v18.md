# Observatory handmade v18

Built-in image generation, 2026-09-16. Original user paper-style reference and v17 composition used; no API or upscaling. Actual1536×1024.

First candidate overshot the intermediate target: sanctuary approx x170..1350,y145..790. Retained in generated_images; not integrated. The second pass requested a measured78% group reduction about(768,770). Final image measured approximately x325..1190,y242..730; full six-landmark union865×488 =26.84% of source area, compared with v17 x377..1197,y335..759 =22.1%. Top silhouette moves93px upward. This is less than specified31%area (brief arithmetic was erroneous:870×485/1536/1024 is26.83%, not31%). Native pad widths about48–57px; no assertion of increased native slot detail.

## Final measured placement centers (source pixels)

- Courtyard4: [714,450],[792,451],[711,481],[791,483]
- Roof garden4: [453,321],[509,321],[449,347],[508,348]
- Root hollows2: [459,595],[523,595]
- Glasshouse trail3: [702,646],[775,651],[851,654]
- Dry channel3: [978,478],[1032,527],[1101,602]
- Watchpost1: [1054,351]

Exactly17 pads visually counted. Release clearing near[336,641]. Label anchor candidates: roof[482,397],court[753,520],root[485,647],glasshouse[778,704],dry[1100,656],watch[1065,407]. Recheck labels against runtime target regions before integration.

## Complete landmark bounds (x,y,width,height; manually measured)

- roof-garden [362,242,231,231] includes flower arch, round building and base
- conservatory-courtyard [618,244,293,297] includes dome apex and courtyard base
- root-hollows [326,446,281,240] includes entire canopy/root perimeter
- glasshouse-trail [625,539,331,191] includes glasshouse, garden railing and base
- dry-channel [919,422,271,291] includes channel edges and lower rock margin
- watchpost [981,266,179,197] includes roof, timbers and descending stair

## First exact prompt

Use case: stylized-concept. Create a new seamless full-frame illustrated game world, 1536x1024 landscape 3:2, at maximum native detail. Image 1 is the ORIGINAL STYLE reference: tactile handcrafted 3D cut paper diorama, matte fibrous layered cardstock, cream architecture, visible paper edges, restrained moss/ochre/blush palette, warm diffuse light. Copy that physical paper material language, NOT any text, animals, cards or UI. Image 2 is a COMPOSITION reference whose sanctuary is too small: enlarge its useful sanctuary moderately by about 15 percent, especially upward, while preserving plenty of continuous landscape at all edges. This is a measured middle ground, NOT an extreme closeup and NOT a tiny sanctuary in a huge empty landscape.

Coordinate contract for 1536x1024: the COMPLETE primary sanctuary silhouettes should occupy approximately x350..1220, y275..760 (central 57% width and 47% height). Main dome apex near y275 (27% down), not y335 and not near the top of the image. Complete lookout roof near y340. All main roofs, bases, bridges connecting main buildings and root canopy inside this rectangle. All placement pads inside x402..1160,y340..715. Surrounding forest and farm scenery fills all edges; no tabletop border, no visible board rim, no empty meadow band above sanctuary. Let paper foliage mingle around the upper roofs naturally. Main structures medium large and legible; allocate sharp native detail to the sanctuary.

Exactly SIX habitats and SEVENTEEN pale cream oval placement pads, each roughly 60-70px wide:
1 upper-left low round cream rooftop flower garden with exactly4 pads in 2x2, centers approx (455,375),(540,375),(450,417),(540,417); full building and flower trellis x365..610,y305..530.
2 central courtyard before a broad LOW glass-domed conservatory, exactly4 pads in2x2 centered approx (728,505),(815,505),(728,550),(815,550). Complete dome and building x630..915,y275..610.
3 lower-left root hollow under a distinctive gnarled layered brown-paper canopy with exactly2 side-by-side pads approx (435,650),(525,650), full canopy/base x350..605,y520..730.
4 lower-center glasshouse trail, low rectangular greenhouse behind exactly3 side-by-side pads approx (680,700),(775,700),(870,700); full silhouette x620..950,y580..760.
5 right-hand DRY CHANNEL, one continuous pale stony dry river bed, not platforms or towers, with exactly3 pads along diagonal approx (1020,540),(1080,610),(1140,690); rocky habitat x945..1215,y490..750.
6 upper-right WATCHPOST, distinctive timber open-sided low roof lookout with railings and stair, exactly1 pad approx (1070,440). Complete hut roof/base x980..1175,y340..535. Its timber identity must differ obviously from dry rock channel below.

Keep all pad centers unmistakable and unobscured, no additional pad-like circles elsewhere. Quiet label room at each habitat front. Small unmarked winding-path release clearing to left at about330,680. Surroundings continuous paper forest left, quiet farm valley right, streams and paper rocks, no huge unnecessary distant landscape or sky. Crisp physical paper craft, shallow low architecture, all sanctuary in focus. No animals, people, text, numbers, UI, cards, logos, watermark. Do not reuse image2's excessive top safety gap.

## Correction exact prompt

Edit this full paper diorama image with one precise composition correction. The current sanctuary is too large and starts too high. Scale the ENTIRE sanctuary group (all six habitats and all seventeen pads together, including connecting stairs) down to exactly 78 percent of current linear size about the anchor (768,770) of this 1536x1024 canvas. Recompose naturally into continuous surrounding paper terrain; no seams. Result main silhouette bounding union should be approximately x310..1250,y280..780. Highest dome apex and flower arch should be y280, NOT y145 or y350. This is halfway between a tight closeup and an over-distant tiny sanctuary. Preserve the same 1536x1024 aspect and crisp handcrafted paper textures, improve edges freshly. EXACTLY17 pads: roofgarden4,courtyard4,root2,glasshouse3,drychannel3,watchpost1; no extra. Source pads should remain roughly55–65px wide. All primary complete roofs, rootcanopy, lookout stairs and bases visible within that union. Keep same relative placement and style and materials. Do not add empty meadow above: surround upper sanctuary with dense textured paper forest and nearby valley slopes. Preserve outer forest/farm topography across full frame. No UI/text/animals/boardrim. Deliver a clean new coherent full image.

