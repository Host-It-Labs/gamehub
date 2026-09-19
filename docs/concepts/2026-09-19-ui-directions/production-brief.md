# Production environment plates — Nox cabin and Yata night market (19 September 2026)

Produced with the `imagegen-brief` skill (production mode). Paste the block below to the Codex agent. Outputs go to `public/art/`; the audit log goes to `production-README.md` in this folder.

````text
You are working inside the Gamehub repository (this repo). Generate 8 production ENVIRONMENT PLATES with ChatGPT image generation and save them under public/art/. Newest image model, highest quality setting, native size: landscape 1536x1024, portrait 1024x1536. PNG, no watermark, no upscaling.

CONCURRENCY. At most THREE sub-agents alive at once. Run the numbered queue as a rolling queue: start 1-3; the moment one returns, start the next number; never four. One sub-agent = one generation: it generates, saves, measures, appends its exact prompt and measurements to docs/concepts/2026-09-19-ui-directions/production-README.md, and exits. Report to me after every three completions.

READ FIRST, TEXT ONLY: docs/DESIGN.md (sections "Worlds", "Artwork"); docs/concepts/2026-09-19-ui-directions/README.md, only the "Decisions" section and the two "Exact prompt" paragraphs for nox-belowdeck-landscape-v1-a.png and yata-toon-landscape-v1-b.png (these carry the approved style in words); .agents/skills/game-world-layout/SKILL.md, sections "Padding the generator can actually follow" and "Never let the generator look at earlier images". Do NOT open, view, attach or describe any image file at any point, including the concept PNGs and any file you generate. Style travels as words only.

WHAT A PLATE IS. The app draws every interactive thing itself: cards, dishes, player tags, dice, tokens, buttons, signs, text. A plate is the empty room the game is played in. Therefore: no cards, no dishes or food, no dice, no tokens, no tags, no signs with content, no letters, numbers, logos or interface anywhere. Fresh generations only; never edit, retouch or "keep everything else" on an existing image.

HARD RULE: the three Gamehub games must not resemble each other. Mora is cut paper and kraft card: no paper-craft here. Nox is ink printmaking: the Yata plates use none of it. Copy the exclusion sentences below into every prompt.

======================= NOX: THE CAPTAIN'S CABIN =======================

Nox style paragraph (copy verbatim into all Nox prompts): "Handmade linocut and screenprint illustration on dark paper: imperfect ink contours, simplified expressive silhouettes, slight misregistration, selective negative space. Fine, subtle paper tooth only, much less speckle and grain than a risograph poster; surfaces read as painted ink planes, not noise. Restrained pigments: midnight navy, soot black, deep petrol green, warm ivory, small rust, a cold moon-white. Nocturnal, atmospheric and a little uneasy: deep shadows, one warm lantern pool, black water outside the windows. Unsettling in mood, never gory or violent, no monsters, no faces, no weapons. Not paper-craft, not cut cardstock, not glossy 3D, not clay, not photoreal, no gradients, no neon."

Nox composition (both orientations): the captain's cabin of an improvised salvage boat, seen exactly from above. In the centre an oval chart table: dark petrol-green worn surface, sparse ivory ink contour-map fragments near its rim, a small clockwise arrow mark at its centre, a worn wooden edge. The table is EMPTY: no cups, charts, cards, lantern, dice or objects on it. Around the table an unobstructed ring of plain seating: a continuous bench or five simple stools on bare planks, nothing standing on the seats or between them and the table; this ring is where the app will place each player's tag, so it must be calm and evenly lit. Beyond the ring, and only there, sensible cabin furniture: against the far wall a row of three or four small stern windows with black sea, a low horizon and one distant moon or ship light; a captain's desk with rolled charts on one side; a narrow bunk on the other; one hanging oil lantern casting the single warm pool onto the table; a small battered radio with a glowing dial; a coat on a hook. No barrels, crates, rope coils or buckets heaped around the table; no water leaks; no clutter. The cabin walls and floor continue edge to edge; no board rim, frame, vignette or border.

Nox landscape 1536x1024 framing (the most important instruction): the table fills only the middle half of the picture's width and a little under half of its height, sitting slightly above centre. Above the table there is a seating band and then the window wall; below it a seating band and then a wide quiet band of dark planks, about a quarter of the picture, where the app's hand dock will sit; left and right a seating band and then the desk or bunk. Comparison the model can check: the plank band below the seating ring is about as tall as the table itself is tall. Nothing important touches the outer edges; the outer cabin will be cropped differently on every screen.
For measurement only: table including its rim inside x 385 to 1150 and y 205 to 665.

Nox portrait 1024x1536 framing: the table fills about seventy percent of the width and a little over a third of the height, sitting in the upper middle. Above it a seating band, then the window wall near the top; below it a seating band and then a deep quiet plank band, about thirty percent of the picture, for the hand; a narrow seating band and cabin wall on each side. Comparison: the plank band below is about as tall as the table.
For measurement only: table including its rim inside x 150 to 875 and y 330 to 900.

======================= YATA: THE TOON NIGHT MARKET =======================

Yata style paragraph (copy verbatim into all Yata prompts): "Cel-shaded 3D like a modern animated arcade game: low-poly rounded forms with thick clean dark outlines, two-tone flat shading with hard shadow edges, bold saturated flat colours, stylised steam and sparkle shapes drawn as flat graphic marks. Palette: vermilion, cobalt, warm cream, charcoal, one acid-green accent. Punchy, graphic, energetic, readable from across a room. Not ink, not woodcut, not risograph, not paper grain; not cut paper, not cardstock, not paper-craft; not photoreal; not the stop-motion clay look."

Yata composition (both orientations): a night-market food stall seen from the customer's side in a low three-quarter view. In the centre a big red enamel oval counter with a thick dark outline and a cream rim; the counter top is EMPTY: no plates, dishes, markers, steam or objects on it. Behind the counter a toon night street: a cobalt sky band, a string of red lanterns, lit windows, a small bridge over water with light reflections, a striped stall roof at the top corners. Left and right of the counter, one tall wooden sign post each, carrying two or three BLANK hinged signboards with a toon lightbulb above each: plain cream boards with an outline, nothing drawn on them; the app draws the stall signs onto these boards. In front of the counter a dark wooden ledge running the full width where the app's hand cards will sit; on the ledge only a chopstick pot at one far end and a lantern at the other. No food anywhere, no tickets, no cards, no pennants, no letters.

Yata landscape 1536x1024 framing: the counter fills about half of the picture's width and a little under half of its height, centred slightly above the middle. Above it the street and sky take about a fifth of the picture; below it the wooden ledge takes a bit over a quarter; the sign posts stand in the outer fifth on each side. Comparison: the ledge is about as tall as the counter.
For measurement only: counter including its rim inside x 400 to 1135 and y 250 to 690.

Yata portrait 1024x1536 framing: the counter is a rounded rectangle, wide enough to hold a 2x3 grid of plates, filling about eighty percent of the width and forty percent of the height, sitting in the upper middle; the street and sky above take about a sixth of the picture; the ledge below takes about a third; the sign posts hug the left and right edges as tall narrow posts. Comparison: the ledge is nearly as tall as the counter.
For measurement only: counter including its rim inside x 100 to 925 and y 250 to 880.

======================= PROMPT ASSEMBLY =======================
Each item's prompt = "Use case: stylized-concept. Production game environment plate, [landscape 1536x1024 / portrait 1024x1536], full bleed, no interface, no text." + the game's style paragraph + the game's composition paragraph + the orientation's framing paragraph + "No cards, dishes, food, dice, tokens, tags, letters, numbers, logos, watermark, frame, border or vignette. The picture continues edge to edge." Write the whole prompt out each time; never say "as above"; never refer to another image.

======================= ACCEPTANCE (the only pass/fail) =======================
After saving, measure the table's or counter's outermost pixels INCLUDING its wooden or cream rim (ignore its shadow) and compute four band fractions: top = topEdge/height, bottom = (height-bottomEdge)/height, left = leftEdge/width, right = (width-rightEdge)/width. Targets, tolerance ±4 percentage points on each side:
- Nox landscape: top 0.20, bottom 0.35, left 0.25, right 0.25.
- Nox portrait: top 0.21, bottom 0.41, left 0.15, right 0.15.
- Yata landscape: top 0.24, bottom 0.33, left 0.26, right 0.26.
- Yata portrait: top 0.16, bottom 0.43, left 0.10, right 0.10.
By-eye requirements, also mandatory: table or counter empty; seating ring clear (Nox); signboards blank (Yata); no text, cards, food, dice or interface anywhere; actual size equals the requested size.

VERIFICATION LOOP. For each game and orientation, generate -a and -b first. If neither passes, generate ONE new attempt at a time from the same prompt text, as if for the first time, without opening any image; save failures as <name>-fail-1.png, -fail-2.png ... and keep them. Budget: 4 extra generations per game per orientation. Stop at the first pass; do not chase a second. Log every attempt in production-README.md with its exact prompt, actual size, the four fractions and pass/fail.

======================= QUEUE (three at a time, rolling, this order) =======================
 1. public/art/nox-cabin-landscape-v1-a.png
 2. public/art/yata-market-landscape-v1-a.png
 3. public/art/nox-cabin-landscape-v1-b.png
 4. public/art/yata-market-landscape-v1-b.png
 5. public/art/nox-cabin-portrait-v1-a.png
 6. public/art/yata-market-portrait-v1-a.png
 7. public/art/nox-cabin-portrait-v1-b.png
 8. public/art/yata-market-portrait-v1-b.png
 9+. verification-loop attempts, in the order the failures occurred.

FINAL REPORT. One table: path, game, orientation, variant, actual size, top/bottom/left/right fractions, pass/fail, attempts used, by-eye deviations. Change nothing else in the repo: no code edits, no files outside public/art/ and production-README.md.
````
