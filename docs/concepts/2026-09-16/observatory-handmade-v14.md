# Handmade Observatory v14

Fresh original-reference regeneration with bounded geometry corrections,16 September2026. Final candidate source: `public/art/observatory-handmade-v14.png`. Actual native dimensions1536×1024 (verified); initial requested3072×2048 was not delivered. No artificial enlargement. Built-in generation only.

Visual inspection confirms17 blank spaces:4courtyard,4roof,2root,3glasshouse trail,3dry channel,1watchpost. Watchpost is elevated warm timber with a tall lookout; Dry channel is a continuous pale dry paper-rock streambed. Matte cut-cardstock foliage, cream folded architecture and soft layer shadows follow original user reference. Extreme foreground has shallow blur; gameplay area is focused.

## Geometry

Keep approved logical crop372,220,822,548. Manual native-pixel measurements (few pixels tolerance):

| Habitat | Source bounds x,y,w,h | Slot centers | Label anchor |
|---|---|---|---|
| Courtyard | 651,375,231,157 | 709,411;817,410;709,460;823,460 | 765,518 |
| Roof garden | 379,237,154,124 | 413,261;487,259;413,299;489,298 | 454,350 |
| Root hollows | 374,599,163,107 | 398,632;480,631 | 459,694 |
| Glasshouse trail | 679,665,313,93 | 729,699;832,698;937,698 | 834,750 |
| Dry channel | 1000,399,190,303 | 1040,427;1102,521;1158,613 | 1100,684 |
| Watchpost | 1065,258,122,105 | 1122,287 | 1127,345 |

Suggested token widths: courtyard60,roof52,root60,trail62,dry58,watch58 native pixels. Third Dry channel pad rim reaches about1196,2pixels past logical right edge; scene rendering continues beyond crop, its center is safely inside. Root first pad left rim also continues slightly beyond logical crop; portrait exploration padding remains needed. Highest dome landmark y102; watchpost flag top77 is scenery. Release clearing on left winding path around240,735; current source-relative Release near240,730 remains suitable.

## Iterations

- v11: new generation directly using user's original paper reference, exact17 but spread wider than brief.
- v12: compacted composition using v11 reference,18 spaces because an extra fourth Dry channel inset was generated.
- v13: removal request unexpectedly removed both lowest Dry channel insets,16 spaces.
- v14: surgical addition of one Dry channel inset restored17. Native output retained throughout; active map/metadata integration is separate.

## v12 exact corrective prompt

Recompose this handcrafted paper scene, keeping EXACT same exquisite paper material language and overall visual quality. All habitats must be MORE COMPACT and CENTRAL. This is geometry correction, not a change to style. Requested maximum native resolution3:2 landscape. Coordinates below are normalized to1536x1024.

The central playable crop is x372,y220,width822,height548. ALL17 cream blank placement insets must fit INSIDE x400..1160,y250..705. NO placement inset outside that rectangle. Entire source continues with quiet natural scenery to all edges. Preserve enough surrounding forest and valley to fill mobile/desktop screen without repeating artwork. Don't add UI, text, animals, card hand, frame or board edges.

Compared with reference scene:
- Move the entire roof garden RIGHT100px and DOWN70px. Its4 insets should center(465,280),(540,280),(465,322),(540,322).
- Keep dome central, top aroundy90, courtyard4 centers(705,410),(800,410),(705,455),(800,455).
- Move root hollow RIGHT100px and UP30px:2 spaces(435,585),(520,585).
- Watchpost LEFT220px and DOWN25px:1 space(1065,290). Timber lookout must remain distinct from stone architecture and dry channel.
- Dry channel LEFT150px and UP25px;3 spaces(1050,425),(1100,525),(1110,625). Continuous dry pale rocky riverbed with sparse reeds, not separate round towers.
- Glasshouse trail UP40px,3 spaces(700,660),(795,660),(890,660), behind these a small low paper greenhouse.

Exactly17 spaces:4 roof,4 courtyard,2root,3trail,3dry,1watch. Inset width60..70px native, not big raised discs. Keep clear blank ground below each group for later labels, all label anchors above y750. Habitat architecture may be smaller to achieve this. This is a COMPACT SANCTUARY OCCUPYING CENTRAL54%WIDTH AND54%HEIGHT, NOT SPREAD EDGE TO EDGE. Forest left, modest fields right, quiet margins with no extra gameplay pads. Scissors-cut fibrous cardboard layers, warm cream walls, dull moss greens, restrained ochre and dusty coral foliage. Match physical handmade diorama reference; focused sharp playable area, no digital gloss.

## v13 exact removal prompt

Edit this image with surgical precision. Preserve every single feature, composition, position, size, paper texture, lighting, architecture and overall1536x1024 landscape framing exactly. ONLY REMOVE the LOWEST/fourth cream circular placement pad in the dry rocky channel on the right at pixel(1220,720). Replace only that cream oval and rim with matching pale dry paper gravel, small irregular rocks and dry bed texture. Leave the three higher cream pads in that same channel unchanged at(1040,427),(1102,520),(1170,625). The channel must contain exactly3pads, not4. All other spaces unchanged:4rooftop,4courtyard,2root,3greenhouse,1woodlookout. Total17spaces. Do not move the board, zoom, recrop, add anything else, or change style.

## v14 exact addition prompt

Surgical edit: ADD EXACTLY ONE blank cream paper oval inset to the dry pale gravel riverbed at pixel center(1138,620) in this1536x1024 image. Oval size70px wide by40px tall. Match the existing two cream oval paper insets higher in the dry riverbed at1040,427 and1102,520. Leave those two intact. The result must have exactlyTHREE insets total in the dry channel, with this new third inset at1138,620. Change ONLY this small70x40area. Preserve all other pixels, all buildings, scenery, the other14spaces, framing, colors, paper textures, and sharpness. Do not add fourthchannelinset. Do not shift or zoom the scene. No UI text or creatures.

Original fresh-generation prompt and reference are recorded in `observatory-handmade-v11.md`.


## Integration

v14 is active through `lib/games/observatory-art.json`; `lib/games/trio/mora-map.ts` owns the final hit bounds and label anchors, slightly adjusted from the measurement suggestions above. Slot centers match the table. Full scene and miniature are exported at native dimensions with WebP quality94. Existing source/crop framing and UI positioning are retained.
