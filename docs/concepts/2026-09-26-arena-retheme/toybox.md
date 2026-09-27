# Arena: Toybox art bible (26 September 2026)

William chose the Toybox direction (`arena-toybox-desktop-v1.png`): the battle
is fought by toys on a child's bedroom floor. This page is the shared brief
for the models, textures, card art and runtime. Stable ids stay; only names,
art and one card change.

## The fiction

- The field is a printed cloth **play mat** lying on warm oak floorboards. The
  river is a glossy blue plastic **water track** laid across it; the bridges
  are a natural wooden **toy train bridge** and a yellow plastic
  **construction-brick bridge**. Low wooden toy fences edge the mat.
- Towers are **wooden building blocks**: natural beech blocks with lacquered
  team-coloured pieces (cone roofs, rings, pennants). A fallen tower is a heap
  of toppled blocks.
- Every troop is a toy from a **different toy line and era**: space cadets,
  a rubber dinosaur, tin wind-up robots, a samurai action figure, a plastic
  cowboy, a tin biplane and a plastic wizard. The Meteor is a glowing space
  rock that falls on the mat.
- Beyond the mat: the bedroom (crayons, pencils, blocks, books, a spinning
  top, a ball, a toy train, a toy chest, the bed's edge, a rug, a window).
- Light: warm late-afternoon sun slanting in from a window at the upper left,
  a warm indoor bounce, crisp contact shadows, glossy highlights on plastic.
  Premium toy photography, not painted fantasy.

**Not like:** Clash Royale or any painted fantasy miniature (chunky
big-headed cartoon heroes, stone castles, gold crowns on a meadow); not
hand-painted brush textures; not cut paper (Mora), ink printmaking (Nox) or
cel-shaded toon (Yata).

## Scale

One unit is one tile, about 2.5 cm of real toy: the mat is 18 × 32 units
(about 45 × 80 cm). Troop models are built so a Cadet stands about **1.3
units** tall; the game draws troops 1.75 times larger (`TROOP_SCALE`). Real
room objects keep real proportions at 2.5 cm per unit: a crayon is about 4
units long and 0.36 thick, a wooden block 1.6 units, a picture book 10 × 13 ×
0.5, the bed about 20 units high.

## Surfaces (Blender material names `<family>:<tint>`)

| Family    | Use                                   | Look in game                          |
| --------- | ------------------------------------- | ------------------------------------- |
| `plastic` | injection-moulded figures and parts   | glossy, crisp highlights              |
| `vinyl`   | softer figure parts, suits            | satin                                 |
| `rubber`  | the dinosaur                          | satin with a fine pebbly grain        |
| `tin`     | wind-up robots, the biplane           | glossy painted tinplate               |
| `chrome`  | trim, blades, rivets, gun tips        | polished metal                        |
| `paint`   | lacquered painted wood                | glossy colour over faint wood grain   |
| `beech`   | natural toy wood                      | pale lacquered beech grain            |
| `felt`    | plush and felt                        | soft, matte                           |
| `cloth`   | fabric (bed, scarves)                 | woven                                 |
| `glow`    | lights, ray-gun tips, eyes, lava      | emissive                              |
| `plain`   | tiny painted details (eyes, pupils)   | flat paint                            |

Tints: `team` (main), `team2` (dark) and `team3` (light) follow the side at
runtime (blue for you, red for the other side). Any other tint is registered
in the script with `kit.tint("<id>-<name>", "#rrggbb")` (sRGB); its hex
travels in the GLB, so no runtime edit is needed. Prefix custom tint names
with the model id so two models never define the same name differently.

## Readability rules (every model)

- Build for the game camera: 55° down, a troop about 60–120 px tall on a
  phone. Silhouettes first: hats, helmets, weapons and tails are big and
  clear; weapons about 1.3 times real toy size.
- At least 40% of each troop's visible surface is team colour, so the side
  reads at a glance.
- Crisp, well-made toys: smooth subdivided forms for organic shapes, even
  bevels on every hard edge, no lumpy joined primitives, no razor CG edges,
  no floating or intersecting junk. Toy details sell it: ball joints at
  shoulders and hips on action figures, moulding seam lines, rivets and tabs
  on tin, screw heads, painted eyes (white, iris, tiny highlight).
- Figure proportions: heroic toy, not chibi: head about one fifth of the
  height, legs about 45%, chunky feet and mitten hands with a thumb.
- Budget: 2–6k triangles per troop (Robots about 1.5k each, three per card;
  Dino up to 8k).

## Part contract (see `assets/arena/blender/troops.py`)

Root empty named after the card id at the feet, facing +y; parts
`<id>.<part>` with origins on their joints: `legL`, `legR` (hip), `torso`
(waist), `head` (neck, child of torso), `armL`, `armR` (shoulder, children of
torso), `weapon` (child of armR, in the hand), `offhand` (child of armL),
`wingL`, `wingR`, `tail` (root), `jaw` (child of head, hinge), `spin` (turns
about the forward axis: propeller, wind-up key). Model the rest pose as a
relaxed, ready stance with the weapon in hand; the game animates everything
in code.

## The troops (ids stay)

1. **Cadets** (`archers`, two per card, about 1.25 units). Vinyl
   retro-future space cadets from a 1960s space toy line: a rounded team suit
   with a cream chest panel and three small coloured buttons, white chunky
   gloves and boots, a round white helmet with a big glossy smoked visor
   (opaque, dark and very glossy; a friendly face can show just below its
   rim), a short antenna with a red ball tip, a twin-tank backpack, and a
   bulbous retro ray gun in the right hand (finned body, chrome ring, glowing
   tip). They also stand guard on the small towers.
2. **Dino** (`ogre`, about 2.3 units, twice a Cadet). A big soft rubber
   T-rex toy: team-coloured body with a cream belly, a row of back plates in
   the light team tone, a big head with a hinged jaw (`jaw`) showing rounded
   teeth, yellow eyes, tiny arms, thick legs with three-toed feet, a heavy
   tail (`tail`). Body held forward, tail as counterweight.
3. **Robots** (`imps`, three per card, about 0.7 units). Tin wind-up robots
   from the 1950s: a boxy team-coloured tin body with a lithographed control
   panel (small raised dials and lights), a square head with round glowing
   eyes and an antenna, pincer claws, stubby legs with flat square feet,
   visible rivets and tabs, and a big wind-up key on the back (`spin`).
4. **Samurai** (`duelist`, about 1.35 units). A samurai action figure:
   lacquered team-coloured armour plates (chest, shoulder plates, skirt
   tassets) laced with cream cord, a helmet with a gold crescent crest, a
   dark face mask, and a long katana with a chrome blade and a wrapped hilt.
5. **Cowboy** (`ranger`, about 1.35 units). A classic plastic cowboy: a
   wide-brimmed hat, team-coloured shirt, brown vest, a bandana, jeans and
   boots, holding a long lever-action toy rifle with brass details.
6. **Biplane** (`drake`, wingspan about 1.7 units). A tin-toy biplane: two
   stacked team-coloured wings with cream circle markings (no letters), a
   round nose with a propeller (`spin`), a small pilot with goggles and a
   scarf in the open cockpit (`head` is the pilot's head), struts, wheels and
   a tail fin. Flies; drops small bombs that burst.
7. **Wizard** (`mage`, about 1.45 units). A plastic fantasy wizard: a tall
   pointed team-coloured hat with raised gold stars, a long team robe with
   gold trim and a belt, a long white beard, a staff topped by a glowing orb
   (`weapon`) and a free casting hand.
8. **Meteor** (spell, `meteor` in `towers.py`). A craggy dark space rock
   about 1.2 units across with glowing orange lava cracks.

## World pieces (`towers.py`, names kept)

- `king` (radius 2, about 5 tall): wooden block castle, four corner cylinder
  blocks with glossy team cone roofs, an arch-block gate, a team pennant, a
  flat top deck with `king-cannon` (a team plastic toy cannon on a turntable;
  child `king-cannon-barrel` pivots at its trunnions).
- `princess` (radius 1.5, about 4.3 tall): a turret of stacked blocks with a
  crenellated top; empty `princess-guard` on the top deck where a Cadet
  stands.
- `king-rubble`, `princess-rubble`: toppled blocks.
- `bridge` (wooden toy train bridge) and `bridge-b` (yellow construction-brick
  bridge): deck top at z = 0.42 + 0.28 (1 − (y / 1.95)²) over y ±1.95, width
  x ±1.2; the game sinks both by 0.3.
- `river`: the blue plastic water-track trough across the mat (x ±10.3,
  inner channel y ±1, rims about 0.2 high, rounded end caps).
- `wall`: one 2-unit toy fence segment, instanced round the mat.
- `meteor`: the spell's rock.
