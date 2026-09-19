# Queue 01 — Direction A shelf wall, landscape

## Output

- **Filename:** `library-shelf-landscape-v1-a.png`
- **Generation mode:** built-in image generation, fresh generation with no input or reference images
- **Requested quality:** highest quality
- **Attempts:** 1
- **Final result:** PASS

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop Gamehub library concept mockup
Primary request: Create a fresh, polished landscape UI concept showing a scalable games library with 3–4 long shelves and 7–9 physical game boxes per shelf, at least 18–30 visible games total. The library must feel browsable and exciting for hundreds of games while showing richer game information, social presence, and a lighter obvious Play action.

Style. A warm walnut and linen games room seen straight on. Physical shaped game boxes, each a different size and material (kraft, cloth-bound, lacquered tin, screen-printed card), standing and lying on long wooden shelves. Soft daylight from one side, gentle contact shadows, no glossy plastic. Interface elements are printed paper labels and brass shelf tags.

Layout. Top: a thin filter rail of shelf tags (Everyone, Quick, Co-op, Heavy, Friends playing, New). Below: 3–4 shelves each holding 7–9 boxes, one shelf labelled by mood or genre. One box on the second shelf is pulled forward and tilted toward the viewer, with a paper card unfolding beside it showing its stats as icon chips, three avatars playing now, a friend's leaderboard rank, and one Play button. A small bookmark ribbon sticks out of two other boxes to mark unfinished games. Bottom right: a subtle "and 212 more" shelf edge continuing off frame.

Shared library requirements: Show at least 18 visible games. Every game should communicate at a glance play time, player count, mode (competitive, co-op or teams), weight (light, medium or heavy), and one or two genre cues, primarily through tiny icon-plus-value chips rather than prose. Show small round illustrated-face or initial avatars on at least three games to indicate who is playing now, plus discreet social signals such as friends played this week, live table count, leaderboard rank or streak. Each game has one clear light Play control; the featured pulled-forward game must have exactly one Play control. There must be no Resume button anywhere. Mark unfinished games only with discreet bookmark ribbons or a small in-progress dot. Keep the overall library warm and neutral: cream, kraft, walnut, linen, soft charcoal; no promotional heading and no tagline. Make each neighbouring box distinct in silhouette, material, and colour family.

Names and worlds: Use the public names Nox, Mora, Yata. Fill the remaining shelves with these invented games and visually suggest their worlds: Kaldo (mountain rail race), Pemba (spice-market bidding), Orin (lighthouse keepers, co-op), Mavi (tide-pool collecting), Tolu (drum circle rhythm bluffing), Nima (paper-lantern festival), Rako (desert caravan trading), Vela (kite-racing teams), Imbi (mushroom forest draft), Sato (tea-house tile laying), Lumo (firefly night, co-op), Bora (storm-chasing boats), Tiko (street-cat territories), Anoa (river ferry logistics), Zuri (bead-weaving patterns), Pelo (snow-hare sledding), Odu (clay-kiln set collection), Miro (canal-city bluffing), Kena (bee-meadow engine), Suvi (northern-lights memory), Jalo (fish-market auction), Tavi (moth-and-moon co-op).

Text: Allowed baked text is limited to game titles, the word "Play", and short stat values such as numbers, "2–5", "20 min", and "Co-op". Prefer icons over words for stats. Other requested labels such as filters, shelf mood, social indicators, leaderboard and "and 212 more" may be visually illustrative, tiny, abstracted, or partially legible rather than additional prominent readable copy. No promotional heading or tagline.

Composition/framing: straight-on desktop interface view, landscape 3:2, native 1536x1024. The shelves, full boxes, featured tilted box, unfolding stats card, avatars, bookmark ribbons, Play control, and continuation edge must all fit fully inside the frame. Dense but legible, clear hierarchy, credible production UI concept.
Lighting/mood: soft daylight from one side, welcoming quiet games-room atmosphere, gentle contact shadows.
Color palette: warm cream, kraft, walnut, linen and soft charcoal as the shared environment; varied restrained colour families for individual boxes.
Materials/textures: physical walnut shelves, linen backdrop, kraft paper, cloth binding, lacquered tin, screen-printed card, printed paper labels and brass shelf tags; tactile and matte.
Constraints: fresh generation only; no input or reference images; at least 18 visible games; stat icon chips on at least the featured game; avatars on at least three games; exactly one Play control on the featured game; no Resume button; no separate resume action; discreet unfinished markers only; no watermark; PNG; highest quality; native 1536x1024.
Avoid: No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark room. No glossy plastic. No bright white SaaS dashboard. No streaming-service interface. No photos for avatars. No promotional heading, no tagline, no watermark, no horizontal carousel crop, no illegible wall of paragraphs.
```

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| PNG and actual pixel size | PASS | PNG decoded as 1536 × 1024, RGB, non-interlaced. |
| Landscape composition | PASS | Straight-on 3:2 desktop shelf wall with four shelf rows fully framed. |
| At least 18 visible games | PASS | 29 visible game boxes, including the pulled-forward featured box. |
| Featured-game stat chips | PASS | Featured Mora card shows time, players, competitive mode, weight or genre icons, avatars, a rank marker and social activity. |
| Avatars on at least three games | PASS | Illustrated round avatars appear on Nox, Yata, Tavi, Pemba, Jalo, Orin, Kena, Tolu and the featured Mora card. |
| Exactly one Play control on featured game | PASS | One light `Play` button appears on the unfolded Mora card; no second Play control is visible on the featured game. |
| No Resume button | PASS | No `Resume` control or separate resume action is visible. |
| Discreet unfinished markers | PASS | Two red bookmark ribbons appear on Sato and Nima. |
| Direction A materials and mood | PASS | Warm walnut shelving, linen wall, matte tactile boxes, brass-like tags, soft daylight and contact shadows are present; the scene is neither neon nor dark. |
| Scale and continuation | PASS | Four dense shelf rows, filter rail, and an `and 212 more` shelf-edge tag communicate a larger catalogue. |
| Text policy | PASS WITH ILLUSTRATIVE TEXT | Game titles, `Play`, and compact stat values dominate. The requested filter labels, shelf labels, `Competitive`, `4 friends played this week`, `#3`, and `and 212 more` are additional illustrative interface text. No promotional heading or tagline appears. |
| Watermark | PASS | No watermark is visible. |
| Portrait horizontal-scroll rule | NOT APPLICABLE | This is a landscape queue item. |

## Invented elements and deviations

- The model added a houseplant, globe, cat figurine, books, ceramics, rug, chair edge, and small grid/search controls to make the room feel inhabited.
- Shelf labels read `Adventure`, `Strategy`, and `Quick & Party`; these are illustrative mood/genre labels.
- Several lower-row covers repeat visual worlds already represented by named boxes: a snow hare, paper-lantern gate, storm boat, moth, and northern lights. These repeated boxes are untitled rather than introducing new game names.
- The featured Mora box uses a warm architectural city cover. It is pulled forward and tilted, with the stats card unfolded beside it as required.
- Most boxes are conventional upright rectangular packages; their cover materials, palette, proportions, and a few orientations vary, but silhouette variation is subtler than requested.
- Compact stat strips appear on nearly all named boxes. Genre or mode is often conveyed as an icon rather than readable text, matching the icon-first intent.

## Attempts

1. **PASS** — saved as `library-shelf-landscape-v1-a.png`; no regeneration was required.
