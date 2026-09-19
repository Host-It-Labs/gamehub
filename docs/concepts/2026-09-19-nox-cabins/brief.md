# Nox cabin remake, round two: two cabins, flat play surface (19 September 2026)

Why a remake: the first cabin plates (`nox-cabin-*-v1`) are a rendered, rusty, cosy interior in three-quarter perspective. Flat cards dropped on a tilted painted table look pasted on; the empty chairs make the room read as abandoned; the oval table wastes a portrait phone; the portrait plate spends its top on a window wall and its bottom on bare planks. The rusty "used" look also reads as generic AI rendering. Constraints now live in `.agents/skills/game-world-layout/SKILL.md`, section "Flat pieces on a painted world".

Produced with the `imagegen-brief` skill (production mode). Paste the block below to the Codex agent. Outputs go to `public/art/`; the audit log goes to `README.md` in this folder.

````text
You are working inside the Gamehub repository (this repo). Generate 8 production ENVIRONMENT PLATES for the card game Nox with ChatGPT image generation and save them under public/art/. Newest image model, highest quality setting, native size: landscape 1536x1024, portrait 1024x1536. PNG, no watermark, no upscaling.

CONCURRENCY. At most THREE sub-agents alive at once. Run the numbered queue as a rolling queue: start 1-3; the moment one returns, start the next number; never four. One sub-agent = one generation: it generates, saves, measures, appends its exact prompt and measurements to docs/concepts/2026-09-19-nox-cabins/README.md, and exits. Report to me after every three completions.

READ FIRST, TEXT ONLY: docs/DESIGN.md (sections "Worlds" and "Artwork"); .agents/skills/game-world-layout/SKILL.md, sections "Flat pieces on a painted world", "Padding the generator can actually follow" and "Never let the generator look at earlier images". Do NOT open, view, attach or describe any image file at any point, including the earlier Nox plates and any file you generate. Style travels as words only. Fresh generations only: never edit, retouch, inpaint or "keep everything else" on an existing image; if a detail is wrong, regenerate from the prompt text.

WHAT A PLATE IS. The app draws every interactive thing itself: cards, player tags, the die, tokens, buttons, signs, text. A plate is the room the game is played in, with an EMPTY playing surface. Therefore: no playing cards, no dice, no tokens, no tags, no letters, numbers, maps with writing, logos or interface anywhere. No people, no hands, no seated figures, no chairs, no stools, no benches, no mugs or plates set out. The room is inhabited by its owner's belongings and its light, not by bodies.

THE PLAYING SURFACE (the most important instruction, copy into every prompt). "The camera looks STRAIGHT DOWN at the playing surface, like a map: the surface is a flat rectangle with softly rounded corners, drawn in pure plan view with no perspective, no converging lines and no tilt; it faces the viewer exactly. The surface is completely empty and evenly lit, a calm dark plane, so that game cards can be laid on it. Around the surface runs a continuous rim about one tenth as wide as the surface is tall: a plain band (table edge or cloth hem) with nothing standing on it; small player markers will sit on this rim at any position. Only OUTSIDE the rim does the room begin, and the room is drawn as a plan seen from above with objects in shallow oblique, like a dollhouse with the roof off. One single light source: a lantern hanging above the FAR (top) edge of the surface; everything is lit from the top of the picture and shadows fall toward the bottom of the picture." The app will add card shadows falling downward to match.

HARD RULE: the three Gamehub games must not resemble each other. Mora is cut paper and kraft card: no paper-craft, no cut cardstock here. Yata is cel-shaded toon 3D with thick clean outlines and flat saturated colour: none of that here. Nox is printmaking. Copy the exclusion sentence "Not paper-craft, not cut cardstock, not cel-shaded toon, not glossy 3D, not clay, not photoreal, no smooth digital gradients, no neon" into every prompt.

Two cabins, deliberately far apart in style. Both are dark, greedy and a little frightening: this is a pirate's lair full of loot, not a cosy fishing boat. Both replace the previous rusty rendered wood look with confident printmaking.

======================= CABIN A: THE GILT HOLD =======================

Style A (copy verbatim into both Cabin A prompts): "Hand-engraved copperplate and scratchboard illustration: dense parallel hatching and cross-hatching in soot-black ink on near-black paper, highlights scratched out in bone ivory, the drawing emerging from darkness the way a candle reveals a room. Chiaroscuro: most of the picture is deep shadow, a single warm lantern cone carves the centre out of it. Gold is drawn as flat planes of burnished ochre and antique gold leaf with scratched highlights, never as shiny gradients. Palette: soot black, bone ivory, antique gold, oxidised copper green, one accent of dried-blood red velvet. Ominous, opulent, silent. Not paper-craft, not cut cardstock, not cel-shaded toon, not glossy 3D, not clay, not photoreal, no smooth digital gradients, no neon."

Composition A (both orientations): the treasure hold of a pirate ship, seen straight down. The playing surface is the lid of an enormous iron-banded chest, or a slab of dark oilcloth stretched over it: a flat, empty, rounded rectangle of near-black cloth with a faint scratched compass rose so worn it is almost gone, and a thin band of riveted iron as its rim. Beyond the rim the loot begins and does not stop: drifts of coins spilling from split chests, goblets, chains, a crown, pearl strings, ingots, a candelabra, reliquaries, a cracked mirror, all piled against the curved ribs of the hull. Scary details in the dark corners, drawn small and half-hidden: a skull wearing a tricorn, a rusted manacle bolted to a rib, a rat's eyes catching the light, an open iron grating in the floor through which black seawater moves, a hanging hook. Overhead, hanging into the top of the picture, the lantern with a wide iron shade, its cone of light falling on the surface. Damp everywhere: wet sheen on the coins nearest the grating. No windows (we are below the waterline), no chairs, no people, no writing.

======================= CABIN B: THE POISON LANTERN =======================

Style B (copy verbatim into both Cabin B prompts): "Bold hand-pulled screenprint in five flat inks, like a 1960s pulp adventure paperback cover or a Polish film poster: large hard-edged colour planes, thick expressive brush-drawn contours, coarse misregistration where the inks overlap, deliberate halftone dots only in the shadows, no hatching, no rendered texture. Palette: tar black, poison green, sulphur yellow-gold, old bone, one hard blood red. Theatrical, graphic, sinister and a little gleeful, like a villain's lair. Not paper-craft, not cut cardstock, not cel-shaded toon, not glossy 3D, not clay, not photoreal, no smooth digital gradients, no neon."

Composition B (both orientations): the captain's cabin of a pirate ship, seen straight down. The playing surface is a great chart table covered in a flat plane of poison-green baize, empty, with a rim of black lacquered wood studded with brass nails. Beyond the rim, the cabin as a plan from above, drawn bold and flat: to the top, the stern wall as a black band with a row of small diamond-paned windows onto a sulphur-yellow moon over black water; a swinging lantern whose glass is a grinning skull shape hangs above the far edge of the table; along the sides, a rack of cutlasses and boarding axes, a globe, a parrot's empty cage with the door open, a wall of glass jars holding things better not examined, a barrel of gunpowder with a burnt fuse, a heap of stolen paintings; toward the bottom, a treasure chest thrown open with coins spilling as flat gold shapes, a coiled rope, a cat's silhouette watching from under the table edge. A noose-like rope loop hangs from a beam in one corner. Shadows are hard black shapes cast toward the bottom of the picture. No chairs, no people, no writing, no cards.

======================= FRAMING =======================

Landscape 1536x1024 (both cabins): the playing surface including its rim fills only the middle three fifths of the picture's width and a little under half of its height, sitting slightly above centre. Above it there is a band of room about one sixth of the picture tall (for Cabin A: hull ribs and the lantern; for Cabin B: the stern window wall); below it the room continues for about a third of the picture, where the app's hand shelf will sit, so nothing precious lies there, only floor, spilled coins and shadow; on each side about a fifth of the picture of loot or furniture. Comparison the model can check: the band of room below the surface is about three quarters as tall as the surface itself; the band above is about a third as tall as the surface. Nothing important touches the outer edges; the outer room will be cropped differently on every screen.
For measurement only: surface including rim inside x 300 to 1236 and y 165 to 655.

Portrait 1024x1536 (both cabins): the playing surface including its rim is a TALL rounded rectangle filling about four fifths of the picture's width and a little under half of its height, sitting high: above it only a thin band of room, about one seventh of the picture; below it the room continues for a little over a third of the picture for the hand shelf, again only floor, spilled coins and shadow; a narrow strip of loot or furniture on each side. Comparison: the band above the surface is about a quarter as tall as the surface; the band below is about three quarters as tall as the surface.
For measurement only: surface including rim inside x 110 to 914 and y 215 to 950.

======================= PROMPT ASSEMBLY =======================
Each item's prompt = "Use case: stylized-concept. Production game environment plate, [landscape 1536x1024 / portrait 1024x1536], full bleed, no interface, no text." + THE PLAYING SURFACE paragraph + the cabin's style paragraph + the cabin's composition paragraph + the orientation's framing paragraph + "No playing cards, dice, tokens, tags, people, hands, chairs, stools, letters, numbers, logos, watermark, frame, border or vignette. The picture continues edge to edge." Write the whole prompt out each time; never say "as above"; never refer to another image.

======================= ACCEPTANCE (the only pass/fail) =======================
After saving, measure the playing surface's outermost pixels INCLUDING its rim (ignore cast shadows and spilled coins) and compute four band fractions: top = topEdge/height, bottom = (height-bottomEdge)/height, left = leftEdge/width, right = (width-rightEdge)/width. Targets, tolerance ±4 percentage points on each side:
- Landscape: top 0.16, bottom 0.36, left 0.20, right 0.20.
- Portrait: top 0.14, bottom 0.38, left 0.11, right 0.11.
By-eye requirements, also mandatory: the surface is a flat face-on rectangle with no perspective and nothing on it; the rim is continuous and clear; light comes from the top of the picture; no chairs, people, text, cards or interface anywhere; actual size equals the requested size. Also record, for each image, whether the surface reads as tilted (fail) or flat (pass).

VERIFICATION LOOP. For each cabin and orientation, generate -a and -b first. If neither passes, generate ONE new attempt at a time from the same prompt text, as if for the first time, without opening any image; save failures as <name>-fail-1.png, -fail-2.png ... and keep them. Budget: 4 extra generations per cabin per orientation. Stop at the first pass; do not chase a second. Log every attempt in README.md with its exact prompt, actual size, the four fractions, the flat/tilted judgement and pass/fail.

======================= QUEUE (three at a time, rolling, this order) =======================
 1. public/art/nox-gilthold-landscape-v2-a.png
 2. public/art/nox-poisonlantern-landscape-v2-a.png
 3. public/art/nox-gilthold-portrait-v2-a.png
 4. public/art/nox-poisonlantern-portrait-v2-a.png
 5. public/art/nox-gilthold-landscape-v2-b.png
 6. public/art/nox-poisonlantern-landscape-v2-b.png
 7. public/art/nox-gilthold-portrait-v2-b.png
 8. public/art/nox-poisonlantern-portrait-v2-b.png
 9+. verification-loop attempts, in the order the failures occurred.

FINAL REPORT. One table: path, cabin, orientation, variant, actual size, top/bottom/left/right fractions, flat or tilted, pass/fail, attempts used, by-eye deviations. Change nothing else in the repo: no code edits, no files outside public/art/ and docs/concepts/2026-09-19-nox-cabins/README.md.
````

## Decision (19 September 2026, night)

The Gilt Hold (Cabin A) is chosen: more realistic, the hold full of treasure. Integrated plates: `nox-gilthold-landscape-v2-a.png` and `nox-gilthold-portrait-v2-a.png` (the passing ones). Poison Lantern is not selected.

## What changes in the app once a cabin is chosen

- Play box becomes a rectangle; seat anchors move onto the rim band per player count; the DOM oval and stool anchors go.
- Cards on the surface get a downward drop shadow and warm top light from `--world-*` variables, matching the lantern above the far edge; picked-up cards lift.
- Portrait plate framing puts the surface under the floating header with the hand shelf on the lower band; no window wall band.
