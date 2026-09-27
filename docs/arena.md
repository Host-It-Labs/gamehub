# Arena

A real-time battle on a 3D field, a collector's diorama of a medieval
valley: one against one or two against two, against bots on this device or
with friends online.

Design decisions live in the Arena sections of [DESIGN.md](DESIGN.md); this
page is the reference for the rules, the numbers and the build.

## Field

18 tiles across, 32 long. Tile (x, y) has y = 0 behind your king and y = 32
behind the bot's. The river covers y 15 to 17; bridges are two tiles wide,
centred on x = 3.5 and x = 14.5. Towers (your side; the bot's mirror across
the river):

| Tower        | Centre                  | Radius | Hit points | Damage | Hit speed | Range |
| ------------ | ----------------------- | ------ | ---------- | ------ | --------- | ----- |
| King         | (9, 3)                  | 2      | 4824       | 109    | 1.0 s     | 7     |
| Left / right | (3.5, 6.5), (14.5, 6.5) | 1.5    | 3052       | 109    | 0.8 s     | 7.5   |

The king does not shoot until it is hit or one of its towers falls. You may
drop troops on your half (y ≤ 14.5), never on a standing tower. When one of
the other side's small towers falls, its side of the field opens up to y 21.5.
A card let go anywhere else is not lost: it goes to the nearest legal spot on
the half-tile grid (`nearestLegal` in `engine.ts`; a spell is only held on
the field), and the ghost shows that spot while you drag, with a faint line
back to your finger. The server still checks `canPlayAt`.

Ground troops walk round towers in their way (`skirt` in `engine.ts`): a step
that would enter a standing tower turns along its edge towards the goal
(dead ahead, towards the middle of the field), so a troop dropped behind its
own small tower goes round it to the bridge. Troops too wide to share a
bridge queue along the lane near it, and two Dinos meeting head-on (neither
can hit the other) pass through each other on a bridge and sidestep
elsewhere (`laneShove`).

## Team battles

Two players a side. Seats alternate sides: players 0 and 2 play side 0 (the
bottom), players 1 and 3 side 1. Each player has their own hand, deck order
and elixir; teammates may drop troops anywhere on their half. Towers have
1.7 times the hit points (king 8201, small towers 5188) and deal 1.25 times
the damage (136), since twice the troops attack them.

## Cards

Everyone holds the same eight cards: four in hand, the next shown, the rest in
order. A played card goes to the back of the line. Seven cards are troops
(each a figure from a different genre; the ids are older than the names) and
one is a spell. Deploying a troop takes one second, during which it is planted
and does not fight.

| Card    | Id      | Elixir | Troops | Hit points | Damage | Hit speed | Range | Speed | Targets        | Shot / notes            |
| ------- | ------- | ------ | ------ | ---------- | ------ | --------- | ----- | ----- | -------------- | ----------------------- |
| Cadets  | archers | 3      | 2      | 304        | 107    | 0.9 s     | 5     | 1.0   | air and ground | laser                   |
| Dino    | ogre    | 5      | 1      | 4091       | 254    | 1.5 s     | melee | 0.75  | towers only    |                         |
| Robots  | imps    | 2      | 3      | 202        | 120    | 1.1 s     | melee | 2.0   | ground         |                         |
| Samurai | duelist | 4      | 1      | 1361       | 720    | 1.6 s     | melee | 1.5   | ground         |                         |
| Cowboy  | ranger  | 4      | 1      | 721        | 217    | 1.0 s     | 6     | 1.0   | air and ground | bolt                    |
| Biplane | drake   | 4      | 1      | 1152       | 161    | 1.5 s     | 3.5   | 1.5   | air and ground | bomb; flies; splash 1.2 |
| Wizard  | mage    | 5      | 1      | 721        | 281    | 1.4 s     | 5.5   | 1.0   | air and ground | fire; splash 1.5        |

Speeds are tiles per second. Troops attack the nearest enemy within sight
(about 5.5 tiles; the Dino's is 7.5, towers only) and otherwise walk to the
small tower on their lane, then the king once it falls. A troop's lane is
the side of the middle its card was dropped on (`lane` on the unit, set in
`deploy`), the same for every troop of the card: formations, shoves and
walking round a tower never change it. Only chasing an enemy troop more
than a tile over the middle moves a troop to the other lane. Ground troops
walking to a tower cross at their lane's bridge, chasing a troop at the
nearer one; flyers go straight. Shots home in on their target. The small towers' guards are
longbow archers and shoot arrows; the king fires a bronze cannon.

**The Meteor** (id `meteor`, 4 elixir) is a spell: it may be cast anywhere on
the field (x 0.5–17.5, y 0.5–31.5), on either half and on towers. It falls
for 1.0 s (it crashes on the 30th step after the cast) and then hits every
troop of the other side whose edge is inside a 2.5-tile circle, ground and
air, deploying ones too, for 600, and every tower of the other side inside it
for 190 (not raised in team battles). Troops lighter than mass 10 (everyone
but the Dino) are pushed 0.6 tiles straight away from the centre, never
across the river. It wakes a sleeping king like any damage. The Knight it
replaced (26 September 2026) is gone.

## Elixir and time

Elixir starts at 5, refills one point every 2.8 s, caps at 10, and refills
twice as fast in the last minute of the three and 2.5× as fast throughout overtime. At full
time more crowns wins. Level crowns start one minute of overtime in which the
next tower to fall wins. After that the side whose weakest standing tower has
fewer hit points loses; equal is a draw. The king falling ends the match at
once with three crowns.

## Bot

`lib/games/arena/bot.ts` plays any seat with that seat's hand and elixir. It
only decides (`botStep` returns the card and spot; the caller plays it) and
keeps its own dice, so online the server can run it and relay its cards. Each
decision it looks for enemy troops in reach of its half, subtracts the elixir
worth of its own troops already fighting them, and leaves small leaks inside
tower range to the towers. Otherwise it answers with the card that best
counters the threat (air, swarm, tank, fighter or ranged), preferring cheap
answers, placed so the fight happens inside tower range (against a tank the
Samurai first, then Robots; against the Samurai, Robots or the Biplane). With
elixir to spare it starts a push: the Dino at the back, then ranged support
behind whatever reaches the bridge. Hard also punishes the other lane when you
have just spent big.

The Meteor is considered first at each decision: the bot predicts where each
enemy troop will be when the rock lands, rates spots on single troops, pairs,
cluster centres and spots slid over to clip a tower by the elixir they would
destroy (finishing a tower at 190 hit points or less is worth 10, the king
50; hitting a sleeping king counts against), needs a single troop to be worth
half an elixir more than a group, and ignores what a rock of its own side is
already falling on.

| Level  | Decides every | Reacts after | Attacks at | Good counters | Meteor considered | Meteor worth needed | Meteor aim                     |
| ------ | ------------- | ------------ | ---------- | ------------- | ----------------- | ------------------- | ------------------------------ |
| Easy   | 1.4 s         | 2.2 s        | 10 elixir  | 35%           | 35%               | 5                   | where troops are now, ±2 tiles |
| Medium | 0.6 s         | 1.0 s        | 8.5        | 80%           | 60%               | 4.2                 | straight-line lead, ±0.5       |
| Hard   | 0.25 s        | 0.4 s        | 8.5        | always        | always            | 4.2, keeps 3 elixir | full lead, exact               |

## Online

A table's host launches a room (`server/arena.ts`, contract in
`lib/games/arena/room.ts`); the table's people are seated by the sides chosen
in the setup box and bots take the other seats. The room waits until every
person has the room open (at most 20 s), then starts its clock.

Play runs in lockstep (`lib/games/arena/net.ts`). The server steps the match
30 times a second; each step it plays the cards that arrived since the last
one, runs the bots and streams `{h: tick, c: cards, k: checksum}` (a checksum
every 30 ticks and on the last one). Every device replays the same ticks with
the same cards about 2.5 ticks behind the newest, easing its playback speed to
hold that gap, and compares checksums; a device that drifted fetches a
snapshot. The engine avoids `Math.hypot` and trigonometry in anything that
decides the battle, so every browser computes identical numbers. A card is
checked on the device, sent, checked again by the server and played at the
start of the next tick; until it comes back it shows as a pulsing ring on the
field and a dimmed card. A person away for five seconds is covered by a bot
until they return. The host starts the next battle; rooms nobody has open for
ten minutes are removed. Rooms live in memory, so a server restart ends
running battles.

## Screen

The top bar holds only a back button (left) and, at the right, the clock with
the crown counts and a small pause button that opens the shared game menu
(settings online, where the battle cannot pause). On phones (≤600 px) the
right holds only a square with the time: the crowns and the pause button
give way, and the menu's trigger lies unseen over the clock, so tapping the
time opens the menu. Every screen looks steeply down, at the classic
tower-battle angle, so troops coming at you read all the way up the field:
tall screens at 70° with a 26° lens, wide ones at 50° with a 36° lens
(`lensFor` in `lib/games/arena/layout.ts`). The fit (`tallPoints` and
`fitCamera`) keeps the field's side walls whole from your king's back to
the far end, level on both sides, with the far towers' tops and your king,
and centres them in the room between the top corners and the hand; on
phones the width limits it and the spare height splits above and below.
Beside a hand that covers only the middle of the bottom (wide screens) the
near wall ends may drop below the hand's top edge (`isRim`, `Frame.dock`),
so the field grows. The far king's bar is held on screen over its roof. A
player on side 1 sees the mirrored framing; their team is blue.

Troops are drawn larger than their footprint: 1.75 times on wide screens,
2.3 times on portrait phones and 1.95 on tall windows elsewhere
(`troopScale`), and their rings, shots, strides and health bars grow with
them (the bars through `--figure`). The towers keep their size, since their
footprint is the rules'. Phones draw at their screen's full density.

A troop or the placement ghost hidden behind a tower, a keep, a bridge or
scenery shows through as a soft silhouette in its team's colour as you see
it (blue for yours, red for the other side's). After the main render
(`drawXray` in `view.ts`) the troop batches are drawn twice more on their own
camera layer: once into the stencil where they are seen, then flat and
translucent with an inverted depth test where they are not, once per pixel.
Each instance carries a batch colour, white in the main pass and its team's
silhouette colour in the x-ray pass. The tower guards never show through.

While a card is dragged the hand tray fades to a quarter, so the field
beneath it (behind your king) can take the card; back over the cards
themselves the tray returns, and letting go there cancels.

While a troop card is held, everything of the other side that would shoot
it where it would land (awake towers, and troops that can hit it: never a
ground-only troop against a flyer, never the Dino) shows its reach as a red
dashed ring on the ground (`threatsAt` in `engine.ts`, `ThreatRings` in
`effects.ts`). The reach is its range plus the dropped troop's radius, so a
spot inside the ring is a spot in range.

The elixir bar is ten beads; the loop sets each bead's fill directly every
frame, so it visibly refills on every browser.

## Sound

`components/game/arena/sound.ts` plays Arena's own clips, generated with
ElevenLabs (list and levels in `lib/games/arena/audio.json`, prompts in
`assets/arena/audio/README.md`): a whoosh and thump as any card lands (as
it is sent, online), each troop's cue as it arrives, its attack on each
swing or shot, its fall, the towers' arrows and cannon, stone hits, a tower
collapsing (and a crown chime when it was theirs), the king waking, the
Meteor's fall and crash, a horn at the start and at overtime, a tick
through the last ten seconds and a sting at the end. Clips pan by where
they happen across the screen, vary a little in pitch, and each has at
most three voices. Music loops (`music-battle`, then `music-final` in the
last minute and overtime) play at the Ambient sound level in place of the
woodland ambience. The original orchestral theme runs near 96 BPM, then
crossfades to a pitch-preserved 144 BPM version at one minute remaining and
keeps that pace through overtime. The tracks are normalized to -20 LUFS;
major effects briefly duck the music, with reserved voices for important cues
and a safety compressor on the combined mix. Pause, mute, backgrounding and
leaving silence the appropriate buses and cancel delayed effects.

## Art and build

The art direction is Collector's Diorama (26 September 2026, night): a
master model-maker's miniature landscape on a graphite plinth in a studio
void, Medieval on both sides for now. The brief is
[diorama.md](concepts/2026-09-26-arena-retheme/diorama.md); prompts are in
that folder's README. Earlier art is archived outside the repo in
`gamehub-art-archive/arena-v1-medieval-2026-09-26/` (the first Arena) and
`gamehub-art-archive/arena-toybox-wip-2026-09-26/` (the abandoned Toybox
board).

- Textures: `assets/arena/textures/*-v4-{a,b}.png` (27 September 2026:
  bright hand-painted cartoon tiles with big simple shapes and soft painted
  shading, after William found the v3 diorama tiles too dark and too
  realistic) for grass, cobble, dirt, pebbles, forest, stone, slate, wood,
  rock, bark and foliage; cloth, leather and metal stay from v1. The pick
  per tile, its relief, roughness, seam fix (`ramp` for the crisp cartoon
  shapes, `none` where the edge is a joint) and colour `tone` (greens pulled
  from lime to a fresh green, cobble and stone a tenth darker) are in
  `scripts/arena-textures.mjs`, which processes them into seamless
  2048/1024 albedo tiles plus 1024 normal and AO/roughness/metal maps.
  Prompts and picks are in the retheme README; the v3 sources stay beside
  them. Refresh the manifest with `node scripts/arena-assets.mjs --textures
  --only=none` (the game reads `assets.json`, not `textures.json`).
- Materials: Blender materials are named `<tile or family>:<tint>`. Tiles
  dress most surfaces; the families (`plastic`, `vinyl`, `rubber`, `tin`,
  `chrome`, `paint`, `beech`, `felt`) in `materials.ts` are kept for the
  figures. Tints `team`, `team2`, `team3` follow the side; any other tint is
  registered in the script with `kit.tint(name, "#rrggbb")` and travels in
  the GLB as the material's `hex` extra.
- Models: `assets/arena/blender/` — `kit.py` (shared helpers, world-scale UVs,
  baked vertex AO, GLB export), `towers.py` with `masonry.py` (keeps,
  watchtowers, rubble, both bridges, the river embankments, the wall and the
  Meteor's rock, laid stone by stone so each stone covers one course of the
  tile), `props.py` with `forest_kit.py` (trees, rocks, cliffs, bushes,
  tufts, flowers and camp dressing), `troops.py` with one `troop_<id>.py`
  per troop (the Toybox figures, not built into the game), and `figures.py`
  with one `figure_<id>.py` per collector figure (the tower guard `guard`,
  then the troops one by one; a troop takes its figure from `figures.glb`
  when one is built and its older model otherwise). Parts are named
  `<id>.<part>` with origins on their joints; three.js drops the dot
  (`archersarmR`). The guard's root carries its draw and loose poses as a
  `poses` extra (part → Blender quaternion), which `TowerCrew` blends. The
  figures use the miniature families `resin`, `lacquer`, `gilt`, `hide` and
  `weave` (`materials.ts`).
- Card portraits: `assets/arena/cards/card-<id>-v5-{a,b}.png`, polished
  cartoon characters (bold chunky shapes, expressive faces, soft cel-like
  shading) filling the card in front of a simple painted backdrop of their
  era (a lunar landing, a Cretaceous jungle, an atomic-age lab, a castle
  courtyard, a frontier town, a 1917 airfield, a tower library, a dusk
  valley for the Meteor). Each shows as many troops as the card deploys: two
  Cadets, three Robots, one of the others. The pick per card is in
  `CARD_ART` in `scripts/arena-assets.mjs`. The v4 set (the game's clean 3D
  look) and v3 set (detailed miniatures on bases) are kept beside them.
  Library covers:
  `assets/arena/concepts/box-arena-square-v4-a.png` and
  `box-arena-wide-v4-b.png`, served under the old `v1` names.
- `node scripts/arena-assets.mjs [--textures] [--only=towers,troops,props,cards,covers]`
  runs Blender headless, writes hashed files to `public/3d/arena/` and the
  manifest `lib/games/arena/assets.json`; `scripts/production-assets.mjs`
  ships what the manifest lists.
- Scenery: `world.ts` scatters about 250 trees in groves (height and a
  second noise pick pine or oak; trees over 50 m from the desktop camera use
  the `-far` models, about 1.2k triangles instead of 2.9k), hedges along the
  walls, rock clusters, deadwood at the woods' edge, paddock fences and camp
  clutter, all seeded. It keeps the field, the stream, torches, camps and the
  viewer's own end clear (`nearBand`), and phones (`props` 0.55) also stop
  it beyond |x| 16.5, which their camera never sees.
- Runtime: `components/game/arena/` — `assets.ts` (download with progress,
  Cache Storage), `load.ts`, `materials.ts`, `terrain.ts` (the valley on its
  slab, the plinth and the water), `world.ts` (sky, haze, reflections and
  light; bridges, walls, embankments; the forest scatter and camp dressing,
  merged and culled), `troops.ts` (animation: a pose per frame, every joint
  on a spring; every troop part drawn through one BatchedMesh per material),
  `effects.ts` (shots, the falling Meteor and its ring, scorches,
  particles, the drop zone and the placement ghost), `view.ts`, `session.ts`
  (solo battles) and `online.ts` (lockstep client), `pacer.ts` (the quality
  ladder), `sound.ts`, `arena-game.tsx` (loop, input,
  HUD), `arena-box.tsx` (setup, solo and at tables), `arena-room.tsx` (the
  `/arena/<token>` page).
- Quality (`quality.ts`, `pacer.ts`): every device starts at its best.
  Desktops draw at up to 2× with 2048 tiles; phones at their screen's full
  density (up to 3×) with the same 4096 shadow map, the 1024 tiles (at
  phone size their texels still outnumber the screen's pixels) and 0.75 of
  the props. The pacer then fits the device: a 120 Hz screen that cannot
  keep up settles on a steady 60, and if frames still slip it steps down a
  ladder, least visible first: shadows every other frame (the battle steps
  30 times a second anyway), 85% and 72% resolution, a 2048 shadow map,
  then 60%, 50% and 40% (never below about 1.2×). It climbs back after four
  calm seconds; a rung that slipped straight after a climb waits 20 s
  before it is tried again, twice as long each time, so the picture never
  hunts. The first windows are half a second, so a device finds its level
  within a few seconds. On a phone frame about half the triangles are the
  shadow pass, so the first step saves the most. The ground's grid is fine
  over the field and coarse in the far valley.
