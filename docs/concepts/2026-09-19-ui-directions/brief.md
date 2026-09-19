# UI direction brief — Nox and Yata, two directions each (19 September 2026)

Hand-off produced with the `imagegen-brief` skill (concept mockup mode). Paste the block below to the Codex agent. Results land in this folder.

````text
You are working inside the Gamehub repository (this repo). Your job is to generate 16 UI concept images with ChatGPT image generation and save them here. Use the newest image model, highest quality setting, largest native size (landscape 1536x1024, portrait 1024x1536). PNG, no watermark.

CONCURRENCY. You can keep at most THREE sub-agents alive at once. Run the numbered queue below as a rolling queue: start items 1-3; the moment one returns, start the next number; never four at once. One sub-agent = one image: it generates, saves the file, runs the self-check, appends its exact prompt and result to docs/concepts/2026-09-19-ui-directions/README.md, and exits. Report to me after every three completions. The queue is ordered by decision value (all landscapes first, then portraits), so keep the order.

READ FIRST, TEXT ONLY: docs/DESIGN.md (sections "Worlds", "Artwork", "Attention and confirmation"); docs/concepts/2026-09-16/README.md (earlier concept prompts, for how a full-screen mockup prompt is phrased); .agents/skills/game-world-layout/SKILL.md, sections "Distinct game UI and living scenery" and "Responsive camera and UI". Do NOT open, view, attach or describe any image file anywhere in the repo or elsewhere. Style travels as words only; reference images made every earlier run more generic.

WHAT THIS RUN IS. Concept mockups, not production boards: each image is one complete playable-looking screen of a digital board game ("use case: ui-mockup"), photographed straight on, no device frame, no browser chrome. Two games, two visual directions each, each direction shown once in landscape (desktop) and once in portrait (phone), two fresh variants (-a, -b) of every image. The user picks one direction per game afterwards.

HARD RULE FOR ALL 16: the three Gamehub games must not look like each other. Mora is a cut-paper and kraft-card diorama; nothing here may use cut paper, cardstock, folded paper or paper-craft. Nox is ink printmaking; the food game must not use ink, woodcut, risograph or paper grain. State the exclusion in every prompt as written below.

ALLOWED TEXT: only the game title (NOX or YATA) and the single word CONFIRM. Any other lettering the model adds is illustrative and must be noted in the README. Numbers, names and suit marks are rendered by the real app.

============ NOX (trick-taking, 5 suits: spades, hearts, clubs, diamonds and a storm suit; ranks 1-10) ============

Fixed elements the running game has and every Nox image must keep: (1) the CENTRAL TABLE: a broad oval weathered harbour chart table, dark petrol-green surface, sparse ink contour-map fragments at its rim, worn wood edge, seen exactly from above, filling roughly the central 45 percent of the width in landscape and the central 70 percent in portrait, with a calm empty middle where played cards land; (2) SEATS around the table anchored to the viewer at the bottom: three to five small crew positions, each a name tag and score, one marked as lead; (3) the player's HAND of cream printed playing cards at the bottom, tightly packed, big rank in the corner and suit pips, which the user likes and wants kept as compact as it is now; (4) a small clockwise mark in the table centre; (5) two small action pieces beside the hand: a shield token and an anchor token (Salvage), plus one carved die showing a suit; (6) CONFIRM beside the hand. Player tags and status live along the top edge.

Shared Nox style paragraph (copy verbatim into all 8 Nox prompts): "Handmade indie-zine linocut and risograph printmaking on coarse dark paper: imperfect ink contours, simplified expressive silhouettes, rough registration with a slight misprint offset, visible paper tooth, selective negative space. Restrained pigments: midnight navy, soot black, deep petrol green, warm ivory, small rust and a cold moon-white. Nocturnal, atmospheric and a little uneasy: deep shadows, one or two warm lantern pools, black water outside. Unsettling in mood, never gory or violent, no monsters, no faces in the dark, no weapons. Not paper-craft, not cut cardstock, not glossy 3D, not clay, not photoreal, no gradients, no neon."

Direction NOX-A "Below deck". The whole screen is the inside of the hold of an improvised salvage boat, looked straight down into: curved hull ribs and planking run up the left and right edges, coiled rope, crates and barrels as the crew's seats around the table, a battered portable pirate radio with a glowing dial, a swinging oil lantern casting the one warm pool onto the table, two round portholes at the top edge showing black water and a sliver of moon. Water seeps between planks in one corner. The hand sits on a plank shelf at the bottom that runs the full width; the shield and anchor are real objects hung on nails beside it; the die is a bone die on the table edge. Player tags at the top are tin name plates on rope. The mood is claustrophobic and quiet, like being far out at night with the engine off.

Direction NOX-B "Open deck". The whole screen is the deck of the same improvised boat at sea at night, seen from above: the oval chart table is lashed to the deck planks in the centre, the deck ends a little beyond the seats and then there is only black inked water with sparse white-ink wave marks on every side, a fog bank at the far top, one distant light on the horizon, a leaning mast with a radio antenna and torn signal flags entering from the top-right corner, a coil of rope and a lit hurricane lamp near the bottom. Cold blue-white moonlight instead of lantern warmth; the storm suit's lightning shows as one faint ink flash in the fog. The hand rests in a rope-and-canvas sling stretched across the bottom edge; shield and anchor are stencilled on canvas tabs; the die is a wooden die on the deck. Player tags at the top are chalk marks on a slate board. The mood is exposed and vast: too much dark water, not enough boat.

Nox portrait rule (both directions): the phone image must show a card presentation that needs NO horizontal scrolling. Draw exactly this: the cards are held like a real hand, overlapping in a tight fan or two staggered rows so that only each card's corner (rank and suit) shows, with one card lifted forward as the selection. The table above stays complete and centred; seats at the top and sides; CONFIRM directly under the fan.

============ YATA (set collection, drafting six dish kinds; pick one card, pass the rest) ============

Fixed elements every Yata image must keep: (1) the player's COLLECTION BOARD in the centre: six serving spots, one per dish kind, each holding a stack of the collected dishes with a small score marker; (2) the HAND at the bottom: six food cards face up, one lifted as the chosen pick, CONFIRM directly beside it; (3) two or three prominent STALL signs at the sides as pressable action pieces (available, selected, spent); (4) player tags and status along the top, one active. The dishes are: dumplings, a noodle bowl, skewers, a paper cone of pickles, a dark sesame bun, a small pudding. No faces on food, no mascots.

Both Yata directions must be playful, stylised, clearly three-dimensional and far from realism. The current box art (a cozy realistic-ish painted counter) is NOT the target. Exclusion clause to copy into all 8 Yata prompts: "Not ink, not woodcut, not risograph, not paper grain; not cut paper, not cardstock, not paper-craft; not photoreal; not the stop-motion clay look."

Direction YATA-A "Vinyl night market". Style paragraph (copy verbatim): "Glossy soft-3D designer-toy world, like oversized blind-box vinyl figures and inflatable shop signs: every object is rounded, slightly puffy, smooth matte-to-satin plastic with a single soft specular highlight, thick simple forms, no fine detail. Candy palette on a deep indigo night: bubblegum pink, tangerine, lime, butter cream, with small electric-cyan light accents. Even cheerful studio lighting plus a few coloured lamp glows. Chunky, huggable, toy-shop shelf feel; mature playful, not baby-cute." Screen: the collection board is a rounded glossy tray with six dish-shaped indentations; the hand cards are thick rounded tiles like toy packaging; stall signs are inflatable balloon letters-shaped signs WITHOUT letters, one lit; player tags are round vinyl badges; the surroundings are a puffy toy night-market: soft awnings, a puffy lantern string, a rounded food cart edge.

Direction YATA-B "Toon-shaded arcade". Style paragraph (copy verbatim): "Cel-shaded 3D like a modern animated arcade game: low-poly rounded forms with thick clean dark outlines, two-tone flat shading with hard shadow edges, bold saturated flat colours, stylised steam and sparkle shapes drawn as flat graphic marks. Palette: vermilion, cobalt, warm cream, charcoal, one acid-green accent. Punchy, graphic, energetic, readable from across a room." Screen: the collection board is an enamel counter seen in a low three-quarter view with six bold outlined serving plates; the hand cards are angular tickets with thick outlines; stall signs are big hinged signboards with a toon lightbulb, one switched on; player tags are outlined pennants; surroundings are a toon night street: a striped stall roof, a hanging lantern, a rail of tickets, a cobalt sky band.

Yata portrait rule (both directions): no horizontal scrolling. Collection board fills the upper middle as a 2x3 grid of serving spots; stall signs tuck into the left and right margins as tall tabs; the six hand cards sit in two rows of three at the bottom, one lifted; CONFIRM under them.

============ PROMPT ASSEMBLY ============
Each queue item's prompt = "Use case: ui-mockup. One [landscape 1536x1024 / portrait 1024x1536] complete playable screen of a digital board game titled [NOX/YATA]." + the game's shared style paragraph (Nox) or the direction's style paragraph (Yata) + the exclusion clause + the direction description + the fixed elements + the orientation rule + "Only the words NOX/YATA and CONFIRM may appear; no other letters, numbers or logos. No device frame, no browser chrome, no status bar, no rules text." Write the full prompt out; do not abbreviate with "as above".

============ QUEUE (run three at a time, rolling, in this order) ============
Save under docs/concepts/2026-09-19-ui-directions/.
 1. nox-belowdeck-landscape-v1-a.png
 2. nox-opendeck-landscape-v1-a.png
 3. yata-vinyl-landscape-v1-a.png
 4. yata-toon-landscape-v1-a.png
 5. nox-belowdeck-landscape-v1-b.png
 6. nox-opendeck-landscape-v1-b.png
 7. yata-vinyl-landscape-v1-b.png
 8. yata-toon-landscape-v1-b.png
 9. nox-belowdeck-portrait-v1-a.png
10. nox-opendeck-portrait-v1-a.png
11. yata-vinyl-portrait-v1-a.png
12. yata-toon-portrait-v1-a.png
13. nox-belowdeck-portrait-v1-b.png
14. nox-opendeck-portrait-v1-b.png
15. yata-vinyl-portrait-v1-b.png
16. yata-toon-portrait-v1-b.png

============ SELF-CHECK PER IMAGE (the sub-agent does this before exiting) ============
- Actual pixel size matches the request (report it if the tool returned something else; do not upscale).
- Nox: oval table present, centred, seen from above, empty middle; hand compact at the bottom; portrait shows a fanned hand with no scroll strip.
- Yata: six serving spots visible; six hand cards, one lifted; stall signs present; portrait uses the 2x3 / two-row layout.
- List every piece of baked text other than the title and CONFIRM.
- Append to README.md: filename, exact prompt, actual size, check results, invented elements.

============ FINAL REPORT ============
A table: file, direction, orientation, variant, size, checks passed, notes. Nothing else changes in the repo: no code edits, no files under public/art.
````
