# Arena card portraits v7: in action (1 October 2026)

William's review of v5/v6: the portraits feel too smiley and posed, as if
the characters were posing for a photo. He wants every card in action
(mid-attack, charging, casting, firing, bracing), not smiling at the camera,
with the character still big and centred. v7 redoes all 24 cards: the 15
troops already in the game, the Meteor and the eight troops of the
1 October roster (brief.md). Same set look as v5/v6 (bold chunky cartoon
shapes, soft cel-like shading, a simple painted backdrop of the troop's era,
cobalt-blue team colour), one figure per card except the two Cadets and the
three Robots (`formation` in `lib/games/arena/cards.ts`).

What changed against the v6 paragraph, as instructions for new images: the
"very expressive face with a clear, lively expression" and "a little heroic
or funny" lines are replaced by an Action paragraph (a frame from a battle,
the body leaning into the move, a few simple action effects, never looking
at or smiling for the viewer, focused or straining faces); the framing
allows whatever crop shows the action best; the opaque-backdrop line from
v6 stays ("fully opaque ... no vignette"), since the v5 text kept coming
back semi-transparent for the women's cards.

Every prompt is sent as: the shared paragraph, a space, the subject
paragraph, a space, then "Fresh image from this text only; no input or
reference images." Both variants of a card use the same prompt; retries
repeat it unless a revised subject is recorded below. Generated with
`codex exec -m gpt-6-luna -c model_reasoning_effort="low"` (Codex CLI
0.157.1) and the built-in `$imagegen` tool through the wrapper in
`.claude/skills/artwork/SKILL.md`, one image per run, at most four runs at
once. Files: `assets/arena/cards/card-<id>-v7-{a,b}.png`.

## Shared paragraph

```text
Use case: the square portrait art on a playing card in the hand of a real-time battle game. Style: polished stylised cartoon character art, like the card portraits of a high-quality mobile strategy card game: bold, chunky, exaggerated cartoon proportions (big hands, broad shoulders, slightly large heads, sturdy simple shapes), big readable silhouettes and a strong, readable face. Clean hand-painted cartoon rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful colour. Not photoreal, not a glossy 3D render, not a detailed miniature, not a toy, not realistic anatomy, no photographic texture, no film grain, no fine micro detail, no clutter; also not childlike toddler art, not a baby or chibi mascot: confident, characterful and heroic. Action: the character is caught in the middle of the action described below, like a single frame from an animated battle scene: a dynamic pose with real weight and effort, the body leaning into the move, clothes, hair and gear swept by the motion, and a few bold, simple cartoon action effects (a swoosh arc, dust puffs, sparks, a muzzle flash) only where the action calls for them. The character is not posing for a picture and is not aware of the viewer: seen in a three-quarter view so the face reads, but never looking at the viewer or the camera; the eyes are locked on the target or the way ahead, just past the edge of the frame, and the face is focused, fierce, determined or straining with effort (narrowed eyes, knitted brows, gritted teeth or a battle shout), never a smile or a grin for the camera. The face stays large and readable at thumbnail size. Framing: the character is huge in the frame, centred, and fills it (about 85 to 90 percent of the frame height, head and upper body or the full figure fitted, whichever shows the action best), instantly readable when the card is shown only 90 pixels wide. Keep the top-left corner (about one fifth of the width and height) free of faces and signature items: a cost badge covers it. Background: a simple painterly cartoon backdrop of the character's own era (described below), a few big soft shapes and a smooth colour gradient, lower contrast toward the edges so the character pops; fully opaque, the painted backdrop covers every pixel up to all four edges, no transparency, no vignette. The team colour is a strong cobalt blue. Original design, not any existing game, film, brand or franchise. No text, no letters, no numbers, no writing on anything, no card frame, no border, no icon, no UI, no logo, no watermark, no display base. Square 1024x1024 PNG, highest quality.
```

## Subjects: the troops already in the game

- **archers** (Cadets, `card-archers-v7-{a,b}.png`):

  ```text
  Subject: exactly TWO 1960s retro space cadets in the middle of a firefight, both equally large and both fully visible, framed from the knees up; exactly two people, no third figure anywhere. The front one drops to one knee and fires a chunky chrome retro ray gun held out in both hands toward the viewer's right, a bright red laser bolt streaking from its glowing tip; the other stands just behind and beside, leaning forward and firing over the first one's shoulder, also toward the right, a second red bolt and a small flash at the muzzle. Each wears a chunky off-white pressure suit with bold cobalt-blue chest panels and arm stripes, a gold neck ring and a clear round glass bubble helmet showing a focused face, one eye squinting along the gun, mouth set hard; both look at the target off to the right, not at the viewer. Background: a grey lunar landing site with a retro rocket lander, a black starry sky and the blue Earth, painted simply, a few puffs of moon dust kicked up around their boots.
  ```

- **ogre** (Dino, `card-ogre-v7-{a,b}.png`):

  ```text
  Subject: ONE big cartoon tyrannosaurus rex charging forward, the only creature in the picture, framed from the chest up and turned three-quarters toward the viewer's right, head thrust low and forward mid-stride, huge jaw wide open in a thundering roar with big blunt cartoon teeth, eyes narrowed and locked on a target off to the right, never looking at the viewer; deep navy-blue hide with a darker back, a cream throat and belly, a row of chunky gold-edged armour plates down the neck and back, bright amber eyes under heavy angry brows, tiny two-clawed arms tucked in at the bottom of the frame, clods of earth and a big dust cloud thrown up behind it. Background: a Cretaceous jungle of big simple fern and palm shapes and a distant smoking volcano in warm haze.
  ```

- **imps** (Robots, `card-imps-v7-{a,b}.png`):

  ```text
  Subject: exactly THREE small 1950s enamelled tin wind-up robots rushing forward together toward the viewer's right, all three fully visible and about the same size, the middle one slightly in front, framed as full figures that fill the frame; exactly three robots, no fourth. They are in mid-dash: stubby legs pumping, bodies tilted forward, chrome pincer hands raised and snapping, little dust puffs at their feet and a few motion streaks behind them. Each has a boxy cobalt-blue enamelled tin body with bevelled edges, a cream chest panel with a dial and amber lamps, a square head with round glowing amber eyes narrowed into a determined, angry squint under a slanted brow plate, a chrome antenna, and a big chrome wind-up key sticking out of its back, spinning, clearly visible in silhouette. None of them looks at the viewer; all three are fixed on a target ahead to the right. Background: an atomic-age laboratory with a round porthole window showing a needle-tower skyline at dusk, painted simply.
  ```

- **duelist** (Samurai, `card-duelist-v7-{a,b}.png`):

  ```text
  Subject: ONE samurai warrior in the middle of a mighty sword stroke, the only figure in the picture, framed from the thighs up, lunging forward toward the viewer's right with his weight on the front leg, the katana sweeping down in both hands in a huge diagonal cut that leaves a bold white swoosh arc across the right half of the picture; chunky navy-blue lacquered armour plates laced with cream cords, a helmet with a big golden kuwagata crest of two tall curved horns, a fierce face with thick knitted eyebrows and a bold moustache, mouth open in a battle shout, eyes on the enemy to the right, not on the viewer; the cords and the skirt plates of the armour swing with the motion. Background: a Japanese castle courtyard with a white-walled keep, a pine tree and a stone lantern in late-afternoon light, a few pine needles and dust swirling in the wind of the cut, painted simply.
  ```

- **ranger** (Cowboy, `card-ranger-v7-{a,b}.png`):

  ```text
  Subject: ONE 1880s cowboy firing his rifle, the only figure in the picture, framed from the thighs up in a three-quarter view, the lever-action rifle with a brass receiver shouldered and aimed toward the viewer's right, his cheek pressed to the stock and one eye squinting along the barrel, the other screwed shut, a bright muzzle flash and a puff of white smoke at the end of the barrel; the whole rifle inside the frame. A wide-brimmed brown felt hat pulled low, a stubbled square jaw clenched, a long sand-coloured duster coat flapping open in the wind over a cobalt-blue shirt and cobalt neckerchief, a dark leather vest with a small plain gold star. He looks only at his target to the right, never at the viewer. Background: a frontier town street with wooden storefronts and red desert mesas at golden hour, a little dust blowing across, painted simply.
  ```

- **drake** (Biplane, `card-drake-v7-{a,b}.png`):

  ```text
  Subject: ONE 1917 First World War biplane in a steep diving attack, the only aircraft in the picture, banking hard and swooping down toward the viewer's lower right, big in the frame with its wing tips close to the edges and nothing cropped; chunky cartoon proportions with a round nose, cobalt-blue doped-linen wings with plain cream-and-cobalt ring roundels, wooden struts, a polished metal engine cowling and a spinning two-blade wooden propeller shown as a blurred disc, speed streaks along the wings, and two round black bombs just released from under the fuselage, falling. In the open cockpit ONE pilot leaning forward into the dive with a brown leather helmet, brass goggles, a white scarf whipping straight back in the wind, teeth gritted, eyes fixed down on the target below, not on the viewer. Background: a bright sky with big soft cartoon clouds over a distant grass airfield with canvas hangars.
  ```

- **mage** (Wizard, `card-mage-v7-{a,b}.png`):

  ```text
  Subject: ONE wizard hurling a fireball, the only figure in the picture, framed from the thighs up, leaning hard into the cast, his tall gnarled wooden staff thrust forward toward the viewer's right in both hands, a big blazing orange fireball bursting from the glowing orange crystal on its tip and flying away to the right with a trail of sparks and flame; a long white beard and the robe blown back by the blast, bushy eyebrows knitted in fierce concentration, mouth open shouting the spell, eyes on the fireball's target to the right, never on the viewer; a cobalt-blue robe with gold trim, a charcoal-grey mantle over his shoulders, a tall pointed cobalt hat with a gold band bent back by the wind. Background: a tower library with tall bookshelves, candles flickering in the gust and an arched window with stars, painted simply.
  ```

- **pirate** (`card-pirate-v7-{a,b}.png`):

  ```text
  Subject: ONE Afro-Caribbean pirate woman from the golden age of sail leaping into the attack, the only figure in the picture, framed from the knees up in mid-leap, her body stretched forward toward the viewer's right, a curved cutlass slashing forward and up in her right hand with a bold swoosh arc trailing the blade, away from the top-left corner, her left arm flung back for balance, a flintlock pistol tucked in her sash; a black tricorne hat worn over a cobalt-blue bandana, one long braid flying out behind her, a gold hoop earring, a fierce face shouting a battle cry, eyes locked on her foe to the right, not on the viewer; a white shirt with rolled sleeves, a striped cobalt-and-cream sash, a long dark waistcoat (a waistcoat, not a coat) flapping, dark trousers and tall black knee boots. Background: a Caribbean harbour with turquoise water, a few palm trees and a big galleon at anchor with furled sails, painted simply.
  ```

- **viking** (`card-viking-v7-{a,b}.png`):

  ```text
  Subject: ONE big, broad Norse viking warrior man in the middle of a huge spinning axe swing, the only figure in the picture, framed from the thighs up, his whole body twisting as the long two-handed bearded axe sweeps round at shoulder height in both hands, a bold circular swoosh arc following the axe head round to the right, the whole axe head inside the frame and away from the top-left corner; a plain round iron helmet with a nose guard and absolutely no horns, no wings and no crest on it; a huge braided ginger beard and the braids flying with the swing, bushy ginger eyebrows knitted, mouth wide in a roaring battle cry, eyes on the enemies around him, not on the viewer; fur-trimmed shoulders, a cobalt-blue tunic, a wide leather belt and cloth-wrapped legs, a little dust kicked up at his feet. Background: a Norwegian fjord with steep green cliffs and calm water, a dragon-prowed longship with a striped sail, painted simply.
  ```

- **gladiator** (`card-gladiator-v7-{a,b}.png`):

  ```text
  Subject: ONE North African Roman gladiator man bracing behind his shield as he takes a hit, the only figure in the picture, framed from the thighs up, crouched low and leaning his shoulder into a tall curved rectangular cobalt-blue shield with a round bronze boss, held out toward the viewer's right on his left arm, sparks and a small dust burst flying off the shield where a blow strikes it, his short straight sword drawn back low in his right hand ready to thrust; an open-faced crested bronze helmet with a tall cobalt-blue plume, his face clearly visible under the brim peering over the shield rim, teeth gritted and eyes narrowed on the attacker to the right, never on the viewer; a broad bare chest with a leather shoulder strap, a leather arm guard on his sword arm, a pleated kilt of leather strips, sandals with bronze greaves, his front foot digging into the sand. Background: a sunlit Roman arena with a golden sand floor and tiered stone arches under a warm sky, painted simply.
  ```

- **medic** (`card-medic-v7-{a,b}.png`):

  ```text
  Subject: ONE South Asian woman field medic from the 1940s rushing to help, the only figure in the picture, framed from the thighs up, running forward toward the viewer's right in mid-stride, one arm thrust out ahead holding a glowing green tonic flask toward wounded comrades off to the right, a stream of soft green healing sparkles pouring from it, away from the top-left corner; her face urgent and concentrated, brows drawn together, lips pressed tight, eyes fixed on the comrades she is reaching, not on the viewer; a cream cap and a cream armband, each marked with a plain GREEN cross (the cross is green, never red; there is no red cross anywhere in the picture); a khaki shirt, a khaki skirt worn over khaki trousers, a big brown leather satchel on a strap across her body bouncing with her stride. She carries no weapon. Background: a 1940s canvas field hospital tent in a green summer meadow, a few folding cots under the open tent flap, painted simply.
  ```

- **miner** (`card-miner-v7-{a,b}.png`):

  ```text
  Subject: ONE stocky Latino miner man from the early 1900s bursting up out of the ground in a spray of earth and rocks, the only figure in the picture, framed from the waist up as he erupts from a jagged hole in the ground at the bottom of the frame, swinging his pickaxe high over his right shoulder for a mighty blow toward the viewer's right, the pick head away from the top-left corner and inside the frame, clods of dirt and chunky rocks flying out all around him; a hard hat with a glowing brass headlamp, a big bushy black moustache, dusty cheeks, teeth gritted with effort, eyes fixed on the target to the right, not on the viewer; a dusty cobalt-blue shirt with rolled sleeves, denim dungarees with suspenders. Background: a rocky hillside with a timber-framed mine entrance, rails and a small ore cart, under a warm sky, painted simply.
  ```

- **balloon** (`card-balloon-v7-{a,b}.png`):

  ```text
  Subject: ONE hot-air balloon on a bombing run, the only aircraft in the picture, large in the frame and slightly right of centre so the top-left corner shows open sky; the round envelope has bold vertical stripes of cobalt blue and cream under rope netting, and below it hangs a wicker basket with sandbags tied round its rim and a small rack of round black bombs on its side; the basket and its passenger are big, taking about the lower third of the frame. In the basket ONE white-haired elderly aviatrix woman with round brass goggles and a long scarf streaming in the wind, leaning far out over the rim and heaving a big round black bomb with a fizzing lit fuse over the side with both hands, another bomb already falling below the basket; her face set in fierce concentration, tongue poking out with effort, eyes fixed down on the target below, not on the viewer. Background: open blue sky with big soft cartoon clouds above a patchwork countryside of green and golden fields and hedgerows far below.
  ```

- **inventor** (`card-inventor-v7-{a,b}.png`):

  ```text
  Subject: ONE young Black woman inventor in a 1950s retro-futurist style unleashing a lightning blast, the only figure in the picture, framed from the thighs up, braced with her feet wide and leaning back against the recoil, holding a copper zapper wand out toward the viewer's right in both gloved hands, a big jagged blue-white lightning bolt crackling from its tip and forking away to the right, away from the top-left corner; big brass goggles pushed up on her forehead, two round hair puffs, her face lit blue by the bolt, teeth gritted in effort and eyes narrowed on the target to the right, not on the viewer; a white lab coat whipped back by the blast, cobalt-blue gloves, and a backpack Tesla coil rising above her right shoulder with its ball on top sparking. Background: a crackling inventor's workshop with tall Tesla coils throwing little arcs, workbenches and copper pipes in a dim blue light, painted simply.
  ```

- **gunner** (`card-gunner-v7-{a,b}.png`):

  ```text
  Subject: ONE Napoleonic-era artilleryman with big bushy grey sideburns firing his cannon, the only figure in the picture, framed as a full figure together with his gun, the man and the cannon both large and fully inside the frame: a small bronze field cannon on two wooden spoked wheels fires toward the viewer's right with a big burst of orange flame and a rolling cloud of white smoke from its muzzle, the gun jolting back on its wheels; the man crouches beside it, leaning away from the blast, one hand pressing a smoking linstock to the touch-hole and the other arm thrown up against the shock, his face screwed up against the bang, teeth gritted, eyes on the shot's target to the right, not on the viewer; a tall black shako with a cobalt-blue plume, a short dark navy jacket (short, not a long coat) with cobalt-blue cuffs and gold epaulettes, white trousers and black gaiters. Background: the grassy earthen rampart of a star fort with angled stone bastion walls and drifting white powder smoke under a pale sky, painted simply.
  ```

- **meteor** (`card-meteor-v7-{a,b}.png`):

  ```text
  Subject: instead of a character, ONE huge flaming meteor in full flight: a chunky craggy dark rock with glowing orange lava cracks, wrapped in a big bold cartoon trail of fire, sparks and smoke, the rock large in the centre of the frame, the top-left corner kept clear. It was hurled from a squat stone castle tower with a cobalt-blue roof and a plain cobalt banner standing small at the lower left of the picture: the fiery trail curves up from the top of that tower in a high arc to the rock, which is now flying on toward the viewer's right, about to crash down. Far below on the right, small and simple, a valley at dusk with a river, lit orange by the meteor. Background: a deep violet and ember dusk sky.
  ```

## Subjects: the eight new troops (1 October roster)

- **diver** (`card-diver-v7-{a,b}.png`):

  ```text
  Subject: ONE big, heavy 1890s deep-sea diver man stomping forward into battle, the only figure in the picture, framed from the knees up, leaning into a slow, powerful stride toward the viewer's right and swinging a huge brass wrench overhead in his right hand for a crushing blow, the wrench head inside the frame and away from the top-left corner; a sharp yellow spark and a little dent flash bouncing off his armoured chest where a small arrow glances off it; a chunky polished brass diving helmet, big and round, with a large round front glass window through which his bearded face reads clearly, brows knitted and teeth gritted, eyes on the enemy to the right, never on the viewer, and small round side portholes and bolts round the brass collar; a thick canvas diving suit dyed cobalt blue, brass shoulder plates, heavy laced boots with chunky lead weights, a rubber air hose curling from the back of his helmet, a few water drops flying off him. Background: an 1890s harbour pier of wooden planks with an iron steamship, a diving barge with a hand-cranked air pump and coils of rope, painted simply.
  ```

- **sumo** (`card-sumo-v7-{a,b}.png`):

  ```text
  Subject: ONE huge Edo-era Japanese sumo wrestler man in the middle of a mighty open-handed slap, the only figure in the picture, framed from the thighs up, his enormous round body lunging forward toward the viewer's right in a deep low stance, one huge open palm thrusting out in a powerful slap with a bold shockwave ring and motion lines bursting from it, the other arm drawn back; a black hair topknot, a broad face with thick eyebrows knitted in fierce concentration, cheeks puffed, teeth gritted, eyes locked on the opponent to the right, never on the viewer; a thick cobalt-blue silk mawashi belt with a twisted rope at the waist, bare skin, the ground cracking and a ring of dust rising at his feet. Background: an Edo-period outdoor sumo ring of packed clay with a straw-bale edge, under a wooden shrine-style roof with hanging purple tassels, paper lanterns, a crowd suggested only as soft simple shapes, painted simply; no banners and no writing anywhere.
  ```

- **linebacker** (`card-linebacker-v7-{a,b}.png`):

  ```text
  Subject: ONE big, powerful red-haired, freckled 1950s American football player woman charging into a tackle, the only figure in the picture, framed from the knees up, driving forward low toward the viewer's right with her shoulder lowered and her arms spread wide to wrap up the ball carrier, legs pumping, turf and dust spraying from her cleats, speed lines behind her; a brown leather helmet of the 1950s with a single grey face bar, her face clearly visible inside it, brows knitted, teeth gritted in a fierce shout, eyes locked on the runner to the right, never on the viewer, a red ponytail streaming out behind; big rounded shoulder pads under a plain cobalt-blue jersey with two cream stripes on each sleeve and absolutely no number or lettering on it, tan canvas trousers with knee pads, high socks. Background: a 1950s small-town football field at dusk with a green turf, wooden bleachers, a goalpost and tall floodlights, painted simply; no scoreboard and no writing anywhere.
  ```

- **beekeeper** (`card-beekeeper-v7-{a,b}.png`):

  ```text
  Subject: ONE sturdy, rosy-cheeked 1920s countryside beekeeper woman sending her bees into the attack, the only figure in the picture, framed from the thighs up, striding forward toward the viewer's right and thrusting out a brass bee smoker with its little bellows in her right hand, puffing a big curl of white smoke, while a swarm of chunky round cartoon honeybees with striped yellow-and-black bodies and little wings streams out ahead of her toward the right, away from the top-left corner; on her back a white wooden hive box with a cobalt-blue roof, bees spilling out of it; a wide-brimmed straw hat with a fine light veil pinned back up onto the brim so her whole face is clear, a grey-streaked bun, a determined, commanding face, brows set and lips pressed, eyes on the target ahead of the swarm, not on the viewer; a cream long-sleeved blouse, a cobalt-blue apron dress, thick canvas gloves and sturdy boots. Background: a 1920s English countryside meadow full of wildflowers, a stone cottage with a thatched roof and a row of white hives, warm summer light, painted simply.
  ```

- **drummer** (`card-drummer-v7-{a,b}.png`):

  ```text
  Subject: ONE lanky young Napoleonic-era drummer man beating the advance as he marches, the only figure in the picture, framed from the thighs up, striding forward toward the viewer's right with his knee raised high, both drumsticks blurred mid-beat over a big snare drum slung at his hip on a white strap, rings of golden sound waves pulsing out of the drum; a tall black shako with a white pompom and a brass plate without any marking, a thin moustache, his face fierce and fired up, mouth open calling the beat, eyes fixed on the troops marching ahead to the right, not on the viewer; a short cobalt-blue tailcoat with red cuffs and collar, white crossbelts, white trousers and black gaiters; the drum has a brass shell, cobalt-blue hoops and white zigzag ropes. He carries no weapon. Background: a rolling green battlefield under a pale sky with distant columns of soldiers half hidden in drifting white powder smoke and a windmill on a hill, painted simply; no flags with writing.
  ```

- **firefighter** (`card-firefighter-v7-{a,b}.png`):

  ```text
  Subject: ONE big, broad 1930s fire brigade man blasting a jet of water, the only figure in the picture, framed from the thighs up, braced with his feet planted wide and leaning forward against the kick of a heavy canvas fire hose gripped in both hands at his hip, a brass nozzle firing a powerful wide cone of white-blue water toward the viewer's right, spray and droplets flying everywhere, the hose bucking and curling behind him; a polished brass fire helmet with a tall crest and a neck flap, a thick black moustache, his face set and straining, teeth gritted, eyes narrowed on the target of the jet to the right, never on the viewer; a double-breasted cobalt-blue tunic with brass buttons, a wide black leather belt with an axe holder, dark trousers and tall black boots. Background: a 1930s city street of red-brick buildings with smoke curling from an upper window and a vintage red fire engine with a brass bell and a ladder parked behind, painted simply.
  ```

- **jetpack** (`card-jetpack-v7-{a,b}.png`):

  ```text
  Subject: ONE young East Asian woman rocketeer from the 1960s space age flying through the air, the only figure in the picture, framed as a full figure in mid-flight, swooping forward and down toward the viewer's right, body angled like a diver, firing a chunky chrome ray blaster pistol held out ahead toward the right, a bright cyan energy bolt and a small flash at its muzzle; a twin-tank chrome jetpack on her back with two big cartoon flames and puffs of exhaust roaring out of its nozzles behind her, away from the top-left corner; a clear round glass bubble helmet over a short black bob, her face fierce and focused, brows knitted, mouth set, eyes locked on the target ahead, never on the viewer; a sleek cobalt-blue flight suit with white panels, a white belt with a round chrome buckle, white gloves and boots, a short white scarf whipping behind. Background: a 1960s retro space-age city of domes, boomerang-roofed buildings and a flying saucer-shaped tower under a teal and orange sunset sky with a crescent moon, painted simply.
  ```

- **explorer** (`card-explorer-v7-{a,b}.png`):

  ```text
  Subject: ONE tough 1910s polar explorer woman firing a frost shot, the only figure in the picture, framed from the thighs up, kneeling on one knee in the snow and aiming a long wooden ice rifle with brass fittings toward the viewer's right, her cheek to the stock and one eye squinting along the barrel, an icy pale-blue bolt bursting from the muzzle in a spray of glittering snowflakes and ice crystals; a big cobalt-blue fur-lined parka with a large hood ringed in thick white fur round her face, round brass snow goggles pushed up on the hood so her eyes show, wind-reddened cheeks, frosted eyebrows knitted, lips pressed tight in concentration, eyes on the target to the right, never on the viewer; thick mittens, fur boots, snow blowing past. Background: an Antarctic ice shelf with a small wooden expedition hut, a sledge, a three-masted ship frozen in the pack ice and a pale green aurora in a deep blue sky, painted simply.
  ```

## Revised subjects (retries)

Sent with the same shared paragraph; they replace the subject above for the
runs logged as retries.

- **pirate** (revised after the low necklines of attempt 1):

  ```text
  Subject: ONE Afro-Caribbean pirate woman from the golden age of sail leaping into the attack, the only figure in the picture, framed from the knees up in mid-leap, her body stretched forward toward the viewer's right, a curved cutlass slashing forward and up in her right hand with a bold swoosh arc trailing the blade, away from the top-left corner, her left arm flung back for balance, a flintlock pistol tucked in her sash; a black tricorne hat worn over a cobalt-blue bandana, one long braid flying out behind her, a gold hoop earring, a fierce face shouting a battle cry, eyes locked on her foe to the right, not on the viewer; a loose white long-sleeved shirt with a high, closed collar buttoned up to the throat and the sleeves rolled to the elbow, so no chest or cleavage shows at all, a striped cobalt-and-cream sash, a long dark buttoned waistcoat (a waistcoat, not a coat) flapping, dark trousers and tall black knee boots. Background: a Caribbean harbour with turquoise water, a few palm trees and a big galleon at anchor with furled sails, painted simply.
  ```

- **linebacker** (revised: the shoulder pads must read):

  ```text
  Subject: ONE big, powerful red-haired, freckled 1950s American football player woman charging into a tackle, the only figure in the picture, framed from the knees up, driving forward low toward the viewer's right with her shoulder lowered and her arms spread wide to wrap up the ball carrier, legs pumping, turf and dust spraying from her cleats, speed lines behind her; she wears huge, rounded 1950s football shoulder pads under her jersey that make her shoulders about twice as wide as her head is tall, a bold, boxy, armoured silhouette like a small tank, the jersey stretched tight over the domed pads; a brown leather helmet of the 1950s with a single grey face bar, her face clearly visible inside it, brows knitted, teeth gritted in a fierce shout, eyes locked on the runner to the right, never on the viewer, a red ponytail streaming out behind; a plain cobalt-blue jersey with two cream stripes on each sleeve and absolutely no number or lettering on it, tan canvas trousers with knee pads, high socks. Background: a 1950s small-town football field at dusk with a green turf, wooden bleachers, a goalpost and tall floodlights, painted simply; no scoreboard and no writing anywhere.
  ```

## Attempt log

One line per run: file, result.

Batch 1: the 48 first attempts, four runs at a time. After each run the
file is taken from the run's own `~/.codex/generated_images/<session>/`
folder (each held exactly one PNG unless noted).

- `card-archers-v7-a`: attempt 1 pass (two cadets, the front one kneeling, both firing right, gritted and squinting faces; opaque, 1254x1254).
- `card-archers-v7-b`: attempt 1 pass (same staging, larger front cadet).
- `card-ogre-v7-a`: attempt 1 pass (charging, roaring, dust and clods; the teeth sharper than asked).
- `card-ogre-v7-b`: attempt 1 pass (closer, more forward lean; Codex had copied the a image into b's path, replaced with b's own).
- `card-imps-v7-a`: attempt 1 pass (three robots dashing right, angry squints, pincers raised, keys spinning).
- `card-imps-v7-b`: attempt 1 pass (same, smoother motion streaks).
- `card-duelist-v7-a`: attempt 1 pass (lunging cut with a big swoosh, shouting; banners carry only a plain crest shape).
- `card-duelist-v7-b`: attempt 1 pass (same, the face a little larger).
- `card-ranger-v7-a`: attempt 1 pass (shouldered rifle, one eye shut, muzzle flash and smoke, duster flapping; a little more painterly-realistic than the rest).
- `card-ranger-v7-b`: attempt 1 pass (same, slightly closer).
- `card-drake-v7-a`: attempt 1 pass with a deviation (steep dive, two bombs falling, gritted pilot; the wing tips run off the edges).
- `card-drake-v7-b`: attempt 1 pass with the same deviation (wing tips cropped).
- `card-mage-v7-a`: attempt 1 pass (staff thrust forward, fireball bursting right, shouting the spell, beard and mantle blown back).
- `card-mage-v7-b`: attempt 1 pass (same, the face a little larger).
- `card-pirate-v7-a`: attempt 1 fail by review (in action, lunging slash and battle cry, but the shirt is open to a low neckline, too revealing for the set), kept as `card-pirate-v7-a-fail-1.png`.
- `card-pirate-v7-b`: attempt 1 fail by review (same low neckline), kept as `card-pirate-v7-b-fail-1.png`.
- `card-viking-v7-a`: attempt 1 pass (spinning swing, roar, braids flying, nose-guard helmet without horns).
- `card-viking-v7-b`: attempt 1 pass (same; the axe head larger).
- `card-gladiator-v7-a`: attempt 1 pass (crouched behind the cobalt shield as a blow sparks off it, sword drawn back, gritted teeth).
- `card-gladiator-v7-b`: attempt 1 pass (same, the face larger).
- `card-medic-v7-a`: attempt 1 pass (opaque; running, flask thrust out with green sparkles, urgent frown; green crosses on the cap and armband, none red; little cobalt in the picture).
- `card-medic-v7-b`: attempt 1 pass (opaque; same, green crosses also on the satchel, the flask and a tent flap).
- `card-miner-v7-a`: attempt 1 pass (erupting from the ground in a spray of rocks, pick raised, gritted teeth, headlamp lit).
- `card-miner-v7-b`: attempt 1 pass (same, the whole pick inside the frame).
- `card-balloon-v7-a`: attempt 1 pass (leaning out heaving a lit bomb, tongue out with effort, a second bomb falling; open sky top left).
- `card-balloon-v7-b`: attempt 1 pass (same, the face larger).
- `card-inventor-v7-a`: attempt 1 pass (opaque; braced, lightning blasting right, gritted teeth; the Tesla ball sits in the cost-badge corner).
- `card-inventor-v7-b`: attempt 1 pass (opaque; same, the Tesla ball just inside the corner; the board behind carries only diagrams).
- `card-gunner-v7-a`: attempt 1 pass (cannon firing right in flame and smoke, the gunner crouched with the smoking linstock, arm up against the blast, gritted teeth).
- `card-gunner-v7-b`: attempt 1 pass (same; the man larger, kegs at the lower left).
- `card-meteor-v7-a`: attempt 1 pass (the fiery trail curves up from a cobalt-roofed tower at the lower left to a huge lava-cracked rock, dusk valley and river at the lower right).
- `card-meteor-v7-b`: attempt 1 pass (same, the tower larger and the trail clearly leaving its top). The session made two images (the tool was called twice); the newer one is saved.
- `card-diver-v7-a`: attempt 1 pass with a deviation (stomping forward, brass wrench raised, an arrow sparking off the breastplate, bearded gritted face in the front window; the gloved fist and wrench handle reach into the cost-badge corner).
- `card-diver-v7-b`: attempt 1 pass with the same deviation (wrench fist in the corner; air pump and steamship behind).
- `card-sumo-v7-a`: attempt 1 pass (huge open-palm slap with a shockwave swirl, deep lunge, dust and cracked clay, cobalt mawashi; lanterns carry a plain crest shape, no writing).
- `card-sumo-v7-b`: attempt 1 pass (same, the face larger).
- `card-linebacker-v7-a`: attempt 1 pass (low tackle charge, arms spread, turf spraying, freckled gritted face, plain jersey with no number; the shoulder pads read only as bulky sleeves).
- `card-linebacker-v7-b`: attempt 1 pass (same staging, larger face). Both linebackers lack visible shoulder pads; see the revised subject below.
- `card-beekeeper-v7-a`: attempt 1 pass (striding, smoker puffing, a swarm of chunky bees streaming right, veil pinned up, stern face; the hive on her back reaches into the cost-badge corner).
- `card-beekeeper-v7-b`: attempt 1 pass (same; a little more hive in the corner).
- `card-drummer-v7-a`: attempt 1 pass (marching, sticks blurred mid-beat, golden sound rings, shouting the beat; marching columns and windmill behind).
- `card-drummer-v7-b`: attempt 1 pass (same, knee raised higher).
- `card-firefighter-v7-a`: attempt 1 pass (braced, hose bucking, a wide water cone blasting right, gritted moustached face, brass helmet; red fire engine and a burning window behind).
- `card-firefighter-v7-b`: attempt 1 pass (same, the face a little larger).
- `card-jetpack-v7-a`: attempt 1 pass (flying right on twin flames, firing a blaster, set fierce face in a bubble helmet; the flight suit hugs the figure). The session made two images (the tool was called twice); the newer one is saved, and Codex had copied another file into the path, replaced.
- `card-jetpack-v7-b`: attempt 1 pass (same, the face larger and calmer in line).
- `card-explorer-v7-a`: attempt 1 pass (kneeling, cheek to the stock, a frost bolt bursting in ice crystals, frosted brows; hut, sledge, frozen ship and aurora).
- `card-explorer-v7-b`: attempt 1 pass (same, one eye shut along the barrel).
- Batch 1 checks: all 48 files opaque (no alpha below 255), 1254x1254, 48 distinct SHA-256 hashes.

Retries (revised subjects, four runs):

- `card-pirate-v7-a`: retry 1 (revised subject), pass (opaque; lunging slash with a swoosh, battle cry, high buttoned collar, striped sash with flintlock, waistcoat, knee boots).
- `card-pirate-v7-b`: retry 1 (revised subject), pass (same, the face larger; Codex had copied another file into the path, replaced with its own).
- `card-linebacker-v7-a`: retry 1 (revised subject), pass with a deviation (charging tackle, gritted freckled face, plain jersey; the shoulders broader but the pads still read more as bulk than as pads).
- `card-linebacker-v7-b`: retry 1 (revised subject), pass with the same deviation (broadest, roundest shoulders of the four).
- Final checks: the 48 current v7 files are all opaque, 1254x1254, with 52 distinct SHA-256 hashes across them and the four `-fail-1` files; each run's session folder held one PNG except `card-meteor-v7-b` and `card-jetpack-v7-a` (two each, newer saved).

## Picks

Contact sheets: [portraits-v7-picks.png](portraits-v7-picks.png) (the 24
picks, in `CARD_ART` order) and
[portraits-v7-alternates.png](portraits-v7-alternates.png) (the other
variant of each).

| Card              | Pick | Alternate | Why                                                              |
| ----------------- | ---- | --------- | ---------------------------------------------------------------- |
| archers (Cadets)  | b    | a         | the rear cadet sits further from the cost-badge corner           |
| ogre (Dino)       | b    | a         | the head and jaw larger, more forward lean                       |
| imps (Robots)     | a    | b         | the three robots and their keys read most clearly                |
| duelist (Samurai) | a    | b         | the larger shouting face and the bigger cut                      |
| ranger (Cowboy)   | b    | a         | the face a little larger                                         |
| drake (Biplane)   | a    | b         | the bombs and the engine clearest; both crop the wing tips       |
| mage (Wizard)     | a    | b         | the fiercer face and fuller fireball                             |
| meteor            | b    | a         | the fiery trail clearly leaves the top of the cobalt tower       |
| pirate            | b    | a         | the face larger                                                  |
| viking            | a    | b         | the face larger, the whole swing readable                        |
| gladiator         | b    | a         | the face larger over the shield                                  |
| medic             | b    | a         | the green crosses larger and at the front                        |
| miner             | b    | a         | the whole pickaxe inside the frame                               |
| balloon           | b    | a         | the aviatrix's face larger                                       |
| inventor          | b    | a         | the Tesla ball less into the cost-badge corner                   |
| gunner            | a    | b         | the face larger, the cannon and blast whole                      |
| diver             | b    | a         | the whole wrench inside the frame                                |
| sumo              | b    | a         | the face larger                                                  |
| linebacker        | b    | a         | the broadest, most tank-like shoulders                           |
| beekeeper         | a    | b         | less of the hive in the cost-badge corner                        |
| drummer           | b    | a         | the whole shako inside the frame, the drum and beat rings larger |
| firefighter       | b    | a         | the face larger                                                  |
| jetpack           | a    | b         | the fiercer face                                                 |
| explorer          | a    | b         | both eyes readable along the rifle                               |

Built with `node scripts/arena-assets.mjs --only=cards` (480 px WebP, about
1.4 MB for all 24) under `/tmp/arena-assets.lock`; the card lines of the
Docker allowlist in `.dockerignore` were swapped for the new hashed files.
