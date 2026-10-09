# Arena

A real-time battle on a 3D field in a bright cartoon woodland
valley. **Versus**: one against one or two against two, against bots on
this device or with friends online. **Quest**: a roguelite run across three
regions, alone or with a friend (see Quest below).

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
back to your finger. Enemies that could hit this placement show an amber
exclamation mark above them; their ranges are not drawn. The server still
checks `canPlayAt`.

Standing towers have solid rounded-square bases (`towerFootprint` in
`engine.ts`), matching the largest drawn shell: half-width 1.8 for a king
and 1.314 for a small tower. Ground troops keep their body and planted feet
outside these bases on placement, walking, separation and pushes. Near stone,
rendered feet shorten their step through joint IK, preserving their heading
and pitch, while a contacting torso straightens or leans away. The path centre
stays fixed and free poses remain intact beside distant or destroyed towers. A blocked
path keeps a clear corner waypoint until it is reached, so a troop dropped
behind its own small tower goes round it to the bridge without reversing
along a flat wall. Low shots stop at the first standing facade and melee
cannot reach through a building; elevated arrows and lobbed bombs keep their
flight paths. Rubble is passable. Troops too wide to share a
bridge queue along the lane near it, and two Dinos meeting head-on (neither
can hit the other) pass through each other on a bridge and sidestep
elsewhere (`laneShove`).

The long Dino uses an oriented body hull against standing towers rather than
an enlarged circular padding. It combines a 1.3-tile body circle with a
0.85-tile capsule whose axis extends 2.35 tiles forward and 3.45 tiles behind
its centre. Placement, walking, pushes, routing and bounded turns use that
same hull. Its ordinary 0.8-tile separation and bridge radius stays intact.
The simulation carries an arithmetic `bodyDirection`; drawing converts that
heading to a yaw. This keeps the visible rear tail clear without folding it
up or distorting the sculpt.

## Team battles

Two players a side. Seats alternate sides: players 0 and 2 play side 0 (the
bottom), players 1 and 3 side 1. Each player has their own hand, deck order
and elixir; teammates may drop troops anywhere on their half. Towers have
1.7 times the hit points (king 8201, small towers 5188) and deal 1.25 times
the damage (136), since twice the troops attack them.

## Cards

A deck is eight of the twenty-four cards (`deck` in `cards.ts` is the starting
one; the deck phase keeps yours on this device): four in hand, the next shown,
the rest in order. A played card goes to the back of the line. Seven cards are troops
(each a figure from a different genre; the ids are older than the names) and
one is a spell. Deploying a troop takes one second, during which it is planted
and does not fight.

| Card    | Id      | Elixir | Troops | Hit points | Damage | Hit speed | Range | Speed | Targets        | Shot / notes            |
| ------- | ------- | ------ | ------ | ---------- | ------ | --------- | ----- | ----- | -------------- | ----------------------- |
| Cadets  | archers | 3      | 2      | 304        | 107    | 0.9 s     | 5     | 1.0   | air and ground | laser                   |
| Dino    | ogre    | 5      | 1      | 4091       | 254    | 1.5 s     | melee | 0.75  | towers only    |                         |
| Robots  | imps    | 2      | 3      | 202        | 120    | 1.1 s     | melee | 2.0   | ground         |                         |
| Samurai | duelist | 4      | 1      | 1361       | 720    | 1.6 s     | melee | 1.5   | ground         |                         |
| Cowboy  | ranger  | 4      | 1      | 721        | 200    | 1.0 s     | 6     | 1.0   | air and ground | bolt                    |
| Biplane | drake   | 4      | 1      | 1152       | 161    | 1.5 s     | 3.5   | 1.5   | air and ground | bomb; flies; splash 1.2 |
| Wizard  | mage    | 5      | 1      | 721        | 281    | 1.4 s     | 5.5   | 1.0   | air and ground | fire; splash 1.5        |

The eight added on 29 September 2026 (`tags` on each card tell the bot
what it is good at):

| Card      | Id        | Elixir | Hit points | Damage | Hit speed | Range | Speed | Targets        | Ability                                                                   |
| --------- | --------- | ------ | ---------- | ------ | --------- | ----- | ----- | -------------- | ------------------------------------------------------------------------- |
| Pirate    | pirate    | 3      | 690        | 150    | 0.9 s     | melee | 1.5   | ground         | leaps (6 tiles/s) at a troop within 3.5 tiles, first hit ×2; every 3 s    |
| Viking    | viking    | 4      | 1400       | 180    | 1.3 s     | melee | 1.0   | ground         | hits everything within 1.4 of himself; below half HP ×1.35 speed and pace |
| Gladiator | gladiator | 3      | 850        | 125    | 1.1 s     | melee | 1.0   | ground         | 650 shield; after 4 s without damage it recharges from empty in 5 s       |
| Medic     | medic     | 3      | 780        | 0      | —         | —     | 1.1   | —              | heals friends within 3 by 70 every second; follows the nearest friend     |
| Miner     | miner     | 3      | 1000       | 140    | 1.2 s     | melee | 1.5   | ground         | played anywhere off the water and towers; digs 2 s, then pops up          |
| Balloon   | balloon   | 5      | 1650       | 520    | 3.0 s     | over  | 0.9   | towers only    | flies; bomb splash 1; its crash deals 240 within 2                        |
| Inventor  | inventor  | 4      | 640        | 150    | 1.6 s     | 4.5   | 1.0   | air and ground | lightning jumps to 3 in all (2.5 apart), each stunned 0.5 s               |
| Gunner    | gunner    | 4      | 700        | 180    | 3.5 s     | 9.5   | 0.6   | ground         | shell splash 1.3; cannot hit anything within 3                            |

A stun stops a troop moving and attacking and restarts its wind-up. The
Medic's pulse and the Inventor's jumps never touch towers.

Shields are a second health resource on any troop with `UnitStats.shield`.
Each hit drains only the shield it has left; excess damage reaches health.
After four seconds without damage, it refills continuously from empty to
full in five seconds. A new hit restarts that wait. Recharge follows real
elapsed time, independent of haste, slow and stun, and scales with the
troop's maximum shield. Medic healing only restores health. Current capacity
and recharge delay are in online snapshots and checksums.

The eight added on 1 October 2026, three of them tanks so a deck without
the Dino still has a front line (`armour`, `taunt`, `knockback`, `tackle`,
`spawn`, `aura`, `follows`, `cone` and `slow` on `UnitStats`):

| Card        | Id          | Elixir | Hit points | Damage | Hit speed | Range | Speed | Targets        | Ability                                                                                          |
| ----------- | ----------- | ------ | ---------- | ------ | --------- | ----- | ----- | -------------- | ------------------------------------------------------------------------------------------------ |
| Diver       | diver       | 5      | 2400       | 190    | 1.4 s     | melee | 0.75  | ground         | tank; armour: every hit on him loses 45, but at least a quarter of it lands (spells, towers too) |
| Sumo        | sumo        | 6      | 4000       | 230    | 1.6 s     | melee | 0.6   | ground         | tank; landing stomp: enemies within 4.5 that can hit him fight only him for 3 s; slaps push 1    |
| Linebacker  | linebacker  | 3      | 1350       | 125    | 1.1 s     | melee | 1.6   | ground         | mini-tank; first hit on each new target tackles: pushed 1.5 and stunned 1 s                      |
| Beekeeper   | beekeeper   | 4      | 520        | 0      | —         | —     | 1.0   | —              | lets out 3 bees 1 s after landing, then every 4.5 s; follows the nearest friend                  |
| Drummer     | drummer     | 3      | 750        | 0      | —         | —     | 1.5   | —              | friends within 3.5 move and strike ×1.3 (auras do not add up); follows the nearest friend        |
| Firefighter | firefighter | 4      | 950        | 80     | 0.4 s     | 3     | 1.0   | ground         | water cone (half angle about 37°): hits all it can in it, pushes ground troops 0.18 each blow    |
| Jetpack     | jetpack     | 4      | 850        | 115    | 0.6 s     | 3     | 1.8   | air and ground | flies; laser                                                                                     |
| Explorer    | explorer    | 4      | 700        | 140    | 1.2 s     | 5     | 1.0   | air and ground | frost shot: the target moves and strikes at 60% for 1.5 s                                        |
| Bee         | bee         | —      | 90         | 40     | 0.8 s     | melee | 2.4   | air and ground | spawned only (`token`, never in a deck); flies; takes the Beekeeper's level                      |

Pushes (slaps, tackles, the water jet) only move troops lighter than mass 12,
so the Dino, the Diver and the Sumo stand, and never carry a ground troop
across the middle of the river. The Medic, the Drummer and the Beekeeper
never attack (`supports` in `engine.ts`): each follows the nearest friend
(bees and other supports aside) and otherwise waits outside the reach of
the tower ahead. A beat and a slow change both the steps and the countdown
to the next blow (`beat` and `slowFactor` on the unit). Quest keeps the
Sumo and the Drummer locked until bosses unlock them; every other new card
is in the starting pool. Ready-made decks Deep Sea, Dojo, Blitz and Frost
are built round them.

Balance is checked by bots: `node --experimental-strip-types
scripts/arena-balance.mjs --games=10000` plays seeded hard duels with
random playable decks (two troops that hit flyers, a tank or siege card)
and prints each card's win rate and plays. On 1 October 2026 every new card
won 45–56% of its decks; decks with a new tank and no Dino won 52%, with
the Dino 51%. The Samurai and the Cowboy (58%) and the Viking (43%) are
the outliers left.

Speeds are tiles per second. Troops attack the nearest enemy within sight
(about 5.5 tiles; the Dino's is 7.5, towers only) and otherwise walk to the
small tower on their lane, then the king once it falls. A troop's lane is
the side of the middle its card was dropped on (`lane` on the unit, set in
`deploy`), the same for every troop of the card: formations, shoves and
walking round a tower never change it. Only chasing an enemy troop more
than a tile over the middle moves a troop to the other lane. Ground troops
walking to a tower cross at their lane's bridge, chasing a troop at the
nearer one; flyers go straight. Shots home in on their target. The small towers' guards are
longbow archers and shoot arrows; the king fires a bronze cannon. While the
king sleeps its cannon is hidden under a round iron hatch in the middle of
its deck; when the king wakes it springs up through the hatch, about twice
its old size (`KING_CANNON` in `world.ts`). The king has no rear keep,
roof or chimney since 2 October 2026 (`KING_KEEP_PARTS`, dropped from the
model at load).

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

After a one-second ready moment, elixir starts at 7, refills one point every 2.8 s, caps at 10, and refills
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
elixir to spare it starts a push: a big tank at the back (the Dino, the
Balloon, the Diver, the Sumo), then support (the Medic, the Drummer, the
Beekeeper) or ranged help behind whatever reaches the bridge; the
Linebacker and the Samurai lead from the bridge. Frost counts as an
answer to tanks and fighters, the water jet to fighters and swarms, armour
to swarms, and each bee as half an elixir. Hard also punishes the other lane when you
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

## Boosts and decks per player

`createMatch(seed, difficulty, mode, options)` takes a deck and a `Boost`
per seat and the regulation length. A boost carries card levels (+10% hit
points and damage, or spell damage, a level above the first) and
multipliers for troops, spells, elixir and towers (tower fields are read
from the side's first seat); Quest charms and bosses are boosts.
`summon` puts one troop down with its owner's boost (deploy, tests, the
lab). Versus bots draw one of the ready-made decks in `decks.ts` by seed.

## Versus decks: the deck phase and the draft

The setup has no deck editor, only **Draft** (off by default, kept on the
device as `gamehub.arena.draft`; at a table it is the host's and travels as
`decks: 'pick' | 'draft'` in the launch). Every Versus battle, the first
and each Again, opens with a deck phase over the loading screen (or the
field), drawn by `deck-layer.tsx`:

- **Draft off** (`DeckPicker` in `deck-editor.tsx`): your last deck
  (`gamehub.arena.deck.v1`) is ready, every card sits below cheapest first,
  the ready-made decks are quick picks and the average elixir shows as a
  number. Tap a slot then a card, or a card then a slot, to swap. Ready
  counts once the battle has loaded too; solo the battle then starts.
  Online the room starts when every person is ready, or 30 s (`DECK_MS`)
  after everyone opened it (8 s at most to join), with the deck each one
  has; the others show as name badges with a dot.
- **Draft on**, the Split draft (`lib/games/arena/draft.ts`, pure and
  seeded): two rounds of four cards each, one per role (win condition:
  `tank`/`siege` tags or tower-only targets; air: hits air, itself or its
  spawn; splash: splash, swarm, spin, chain or three or more troops, never
  tower-only; spell or support: spells, `support`/`fighter`/`control` tags,
  anything else), filled scarcest role first. A lane (seats 0 and 1, 2 and 3) never sees a card twice, a round offers no card twice where the 24
  allow it, and the Meteor is in one offer of the match at most. You keep
  two (the second tap locks them), the other two go to the player across;
  after two rounds everyone holds eight different cards. Rounds last 12 s
  (a draining ring); the clock keeps your choice and fills it with the
  highest-rated cards (`rate`: worth per elixir, plus what the deck still
  lacks), and bots pick the same way at once. The cards fly (1.2 s), the
  final eight show (1.5 s), then the battle. In 2 v 2 your teammate's offer
  and live picks show under yours. Solo, a stall while the battle decodes
  holds the clock (`holdClock`). Online the room runs it
  (`POST /draft { round, picks }`, each viewer gets a redacted `DraftView`),
  and after the draft waits for every device to say it loaded
  (`POST /deck { loaded: true }`) or the 20 s start timeout.

## Quest

`lib/games/arena/quest.ts` holds the run as plain data and `questAct`
applies each choice (returning null when it is not allowed), with its own
dice, so the online room and every device agree. A run starts with three
hearts, no charm and a **draft** of its deck (1 October 2026): three rounds,
each three bundles of two cards from the reward pool, one bundle taken per
round, so six cards. Each round tries a shape that makes the pick hard (a
standout card, `TIER` 3, tied to a weak one against two solid pairs; a tank
or win condition with nothing for the air against two bundles that each
bring an air answer; the Meteor against two pairs of troops), shows cards
not offered yet while enough remain, and keeps an offer only if every
bundle still leads to a playable deck, so the last round completes it
whatever is taken. Playable: at least one win card (`isWinCard`: a tank or
siege troop, or a ground brawler of 1200 hit points or more) and one air
answer (`isAirAnswer`: a troop that hits flyers). Cards still locked never
appear. A run saved on the old charm pick loads into the draft
(`upgradeQuest`). Each region's map has five rows of up to three stops
(row 0 battles; a camp on the last row; a shop somewhere), each leading to
one or two on the next, then the boss.

The map is painted in (`quest-map.tsx`): the region's painting covers the
screen and every trail, marker and cloud is placed in its pixels (`ART`
holds each painting's open ground, the foot of its boss landmark and its
water), so the stops stand on the open ground in perspective and the boss
at its landmark. Trails are worn tracks with two lines of footprints; the
ways on from where you stand glow and step forward. Cleared stops carry
your blue flag, rows more than two ahead lie under drifting fog that rolls
back as you climb, and the party's token (your lead card's face) walks the
trail to the stop the host chooses before it opens. Cloud shadows, water
glints and twinkles move gently; reduced motion stills all of it. The
paintings are cut by `scripts/arena-splash.mjs` at their native size and a
sharpened 2x for high-density screens (`srcset`).

| Stop   | What happens                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Battle | 20 + 5 per crown gold; pick a new card, a new card, or an upgrade (or skip)                                                             |
| Elite  | a stronger foe (level +1, one bot level harder, +12% troop and +20% tower HP); 40 + 5/crown; a charm                                    |
| Camp   | rest (one heart) or train (one level)                                                                                                   |
| Shop   | three cards (45 + 5 × cost), a charm (110), an upgrade (50); remove a card (40)                                                         |
| Event  | one of eight strangers, a trade or leave                                                                                                |
| Boss   | level +1 on the region's, hard bots, towers +40/55/70% and +15% damage, king awake; 60 gold, a charm, a heart back, and a card unlocked |

Foes' card level is 1 + region (+1 from row 3). Battles run 120 s of
regulation. A lost battle costs a heart (a lost boss is fought again); a
draw is fought again. Decks hold five to eight cards; a new card into a full
deck asks which card it replaces. Five cards (Viking, Miner, Inventor,
Balloon, Gunner) join the reward pool one per boss beaten, kept on the
device (`quest-store.ts`); the run itself is saved after every choice.

Online, a table of one or two launches a Quest room: its people sit on the
blue side (seats 0 and 2), the room holds the run and waits on the map
(`status: 'map'`). The host's choices go to `POST /quest`; anyone else's
`{ suggest }` shows on the thing they point at. A battle stop starts a
battle as in Versus; when it ends the host's Continue (`/again`) hands the
result to the run.

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

Match version 7 includes the Dino's authoritative numeric heading in snapshots
and checksums, as well as shield capacity and recharge delay. Restored version
5 and 6 snapshots acquire missing fields without rescaling existing health or
shield points. Missing shield capacities use the saved owner's level and health
boosts, retaining any larger old shield pool; missing recharge timers start the
full quiet delay. A Dino without a numeric heading faces its side's direction
and recovers any now-illegal old placement. Zero-tick replay, finished snapshots
and between-tick poses have focused regression coverage. This is snapshot
migration, not mixed-version lockstep support.

## Screen

The top bar holds only a back button (left) and, at the right, the clock with
the crown counts and a small pause button that opens the shared game menu
(settings online, where the battle cannot pause). On phones (≤600 px) the
right holds only a square with the time: the crowns and the pause button
give way, and the menu's trigger lies unseen over the clock, so tapping the
time opens the menu. Tall screens look steeply down the field, at the
classic tower-battle angle, so troops coming at you read all the way up the
field: 70° with a 26° lens (`lensFor` in `lib/games/arena/layout.ts`). The
fit (`tallPoints` and `fitCamera`) keeps the field's side walls whole from
your king's back to the far end, level on both sides, with the far towers'
tops and your king, and centres them in the room between the top corners
and the hand; on phones the width limits it and the spare height splits
above and below. The far king's bar is held on screen over its roof.

Wide screens look **across** the field (2 October 2026): wherever the free
area is at least 1.3 times as wide as it is tall (`SIDE_FROM`), the camera
stands off the near side wall at 50° with a 30° lens, your king at the
left and the other king at the right, the lanes running across the screen.
Looking down the field there, it was a narrow strip with forest on both
sides; turned, it fills the width and the field is drawn about 1.4 times
larger (1.34 at 1180 × 820, 1.52 at 1280 × 720). The fit (`acrossPoints`) keeps both side walls end to end,
every tower's top and both kings; `fitCamera` solves it in a frame turned
a quarter (`toSolve`), so the same solver serves both looks. Beside a hand
that covers only the middle of the bottom, the near wall's ends may drop
below the hand's top edge (`isRim`, `Frame.dock`) while its middle stays
above it. The hover card then lies on its side in the meadow under the
field, right of the hand (`fieldBottom`, `.arena-peek.wide`). Free areas
between square and 1.3 blend from the steep look towards 42° with a 36°
lens. A player on side 1 sees the mirrored framing; their team is blue.

Troops are drawn larger than their footprint: about 2.4 times on wide
screens, 3.1 times on portrait phones and 2.6 on tall windows elsewhere
(`troopScale`, grown 15% on 2 October 2026), and their rings, shots,
strides and health bars grow with them (the bars through `--figure`).
Since 4 October 2026, tower shells are drawn at 0.85 of their native size
looking across the field and 0.9 on portrait screens looking down it
(`towerScale` in layout.ts). Their guards keep their previous readable size
independently (`towerGuardScale`); the camera fits each actual tower top.
The solid base is sized for the largest shell on every screen, while the
combat ranges keep their existing circles. Phones draw at their screen's
full density.

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
Selecting and dragging a hand card use the same stats preview. On narrow
screens its name, elixir and four key numbers sit in a compact floating
panel above the hand; on wide screens it uses the existing inspection band.
The panel does not resize the field or intercept the drag.

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

The troops of 1 October 2026 have no clips of their own yet (the ElevenLabs
credits ran out until 26 October): `BORROWED` in `sound.ts` maps each one's
deploy, attack and death to the nearest fitting clip, and the stomp, tackle,
bee release, frost hit and armour clank borrow clips too. The water jet and
the bees' stings skip the melee thud.

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
- Card portraits: `assets/arena/cards/card-<id>-v7-{a,b}.png` (1 October
  2026, all 24 cards), polished cartoon characters (bold chunky shapes, soft
  cel-like shading) caught in action, mid-attack, charging, casting, firing
  or bracing, eyes on their target and never posing or smiling for the
  viewer, big and centred in front of a simple painted backdrop of their
  era; the Meteor's trail rises from a cobalt tower. Each shows as many
  troops as the card deploys: two Cadets, three Robots, one of the others.
  The pick per card is in `CARD_ART` in `scripts/arena-assets.mjs`; prompts,
  attempts and contact sheets in docs/concepts/2026-10-01-arena-draft
  (`portraits.md`). The earlier sets are kept beside them: v5/v6 (the same
  cartoon look, posed), v4 (the game's clean 3D look) and v3 (detailed
  miniatures on bases).
  Library covers (1 October 2026): cartoon key art in the loading screen's
  style, `assets/arena/concepts/box-arena-square-v5-a.png` and
  `box-arena-wide-v5-a.png`, served as `box-arena-blind-v2` and
  `box-arena-wide-v2` (prompts in concepts/2026-10-01-arena-covers).
- Every troop is a `figure_<id>.py` file (each with a private `_kit.py`),
  animated by `components/game/arena/moves/<id>.ts` (contract in
  `moves/types.ts`: the shared walk runs first, then the troop's `pose`,
  and an optional `arrive` for its entrance; the first seven moved there
  from troops.ts on 3 October 2026). A joint a pose asks for is its own:
  the shared code then leaves it alone. Soft joints (`hat`, `beard`,
  `hair`, `neck`, `tail2`, `tail3`, `cape`, `cape2`, `antenna`, sleeves,
  wrists) rest unless a pose drives them, from the body's motion on the
  context (`accel`, `lateral`, `vertical`, `turn`), with per-joint
  `stiff` and `damping` on the troop's Moves; `idleFor` and per-troop
  `memo` time idle fidgets. Cloth painted with the `drape` family ripples
  and billows in the vertex shader (`addDrape` in wind.ts), more while the
  troop moves (sent as its batch colour's alpha above 1): `kit.drape(obj)`
  gives the drape faces a `Wave` UV set (0 at the seam, 1 at the hem). The
  shadow caster and the x-ray pass move the cloth the same way. Coat tails and
  kilts are `skirtL`/`skirtR` parts on the torso that trail the legs; elbows
  are `foreL`/`foreR`. `ARENA_FIGURES=a,b` limits a figures build to those
  ids; `/arena/lab?only=a,b&figures=/3d/arena/dev/<file>.glb` previews a
  build that has not shipped (public/3d/arena/dev is not tracked).
- The first seven troops were reworked on 3 October 2026 (brief in
  docs/concepts/2026-10-03-arena-flair): each has idle fidgets timed by
  `idleFor`, its own attack (`custom`), an entrance and a hit reaction, and
  soft parts. The Cadets' antenna and hinged visor; the Dino's big
  three-toed feet, elbows and a three-link tail (`tail`, `tail2`,
  `tail3`); the Robots' antenna, eyelids (`extra`), gauge needle
  (`extra2`) and snapping claws (`handL`/`handR`); the Samurai's tassets
  (`skirtL`/`skirtR`), shoulder plates (`sleeveL`/`sleeveR`), neck guard
  (`hat`) and a back banner (`cape`, drape); the Cowboy's elbows, hat,
  neckerchief (`beard`, `cape2`) and rippling coat tails; the Biplane's
  bigger pilot (`neck`, `head`, arms), scarf (`cape`, turned back by its
  rest pose so the ripple runs across it), ailerons (`wingL`/`wingR`),
  elevators (`tail`), rudder (`extra`), wheels and bomb; the Wizard's
  two-link cape (`cape`, `cape2`) under a capelet, robe skirt (`extra2`),
  hat tip, beard, elbows and flame (`extra`). Several figures cut their own
  knees, so `articulation.legs` leaves them alone. Walkers lean into turns
  (they leaned out before).
- The original eight figures (including the tower archer) have separate
  eyes, pupils, brows and mouth pieces, cut from their existing sculpts by
  `face_rig.py`. `faces.ts` gives each instance its own blink and glance,
  tightens its eyes when aiming or hit, and lifts the Dino's upper lids as
  it rears before a bite; its amber eyes are larger and brighter so the
  reaction reads on the field. Reduced motion holds idle faces still. Every
  feature resets before another instance uses the same render kit.
  Joint ownership uses names rather than a 32-bit mask: the later scarf,
  sleeve and wrist parts used to alias legs, knees, torso and head, leaving
  the Cowboy limping and the Samurai's gait blocked. The Cadets now breathe
  and gesture with their feet planted; their entrance has one landing,
  with no second hop or spin, and their walk has a small, steady bounce.
  The Cowboy's rifle clears the coat, lifts in front of his shoulder, then
  settles onto it; arm, forearm and rifle follow the same path on matched
  damped springs, lowering along it before the two-hand aim.
- The first 4 October Dino and Sumo rebuild was rejected by the user. Their
  replacements follow the mandatory high-fidelity-3d skill: detailed editable
  anatomy, materials and moving visual review precede runtime optimization.
  Dino has a horizontal forest/ochre body, deep skull, bent three-toed legs
  and a long tapering counterweight tail. Sumo has connected shoulders,
  elbows and hands, an adult face, weighted abdomen, combed topknot and close
  woven blue mawashi. Both use weighted skin and their own live facial
  controls; their fresh v9-b painted portraits match that anatomy. Other
  figure sources stay intact. Sources, exact prompts and review evidence are
  in [the quality rebuild brief](concepts/2026-10-04-arena-quality-rebuild/brief.md).
  Separate versioned neutral `.blend` copies retain the approved geometry,
  normals, weights, pigment and common-axis bone frames. The ordinary collector
  appends them and rebakes AO; it does not decimate the detailed source during
  each build. Dino uses 34,418 runtime triangles, Sumo 34,227. Their source
  masters retain 982,976 and 3,229,836 triangles for future authoring. The
  reviewed game bundle preserves the other twenty-three roots exactly.
- The roster round of 8–9 October 2026 (brief, ownership and integration
  log in [concepts/2026-10-08-arena-roster](concepts/2026-10-08-arena-roster/brief.md))
  rebuilds the remaining figures and adds shared motion pieces. Arms are
  posed by where the hand goes: `moves/reach.ts` solves shoulder, elbow
  hinge and wrist from the figure's rest bones (`c.rest`) given a wrist
  target, an elbow pole and a palm direction, splits the palm's roll
  between forearm and wrist and keeps Euler goals continuous between
  frames. Optional `chest` (upper spine) and `clavL`/`clavR` joints: the
  torso's bends are shared with the chest, and the clavicles shrug and
  bring the shoulder forward with the arm (`shoulderGirdle` in troops.ts)
  unless a pose claims them. A negative `lift` crouches on planted feet.
  The Sumo was the first on it: arms resting against his flanks, a low
  ready stance, palm-first tsuppari driven from the hips with a lighter
  follow-up slap, a waddle and shiko as his idle; `figure_sumo_girdle.py`
  adds the chest and clavicle bones and weights to his frozen runtime copy
  and lifts the baked occlusion on his inner thighs. Review tools:
  `scripts/arena-troop-review.mjs` films one troop in the stand-alone lab
  (`scripts/arena-lab`, port 3027) with close follow cameras and a stepped
  clock; `scripts/arena-merge-figures.mjs` replaces reviewed roots in the
  shipped bundle, checking every other root stays byte-identical.
- The other sixteen card troops and the spawned Bee use the same grounded
  gait, spring poses and facial rig. Each keeps its own entrance, idle,
  attack preparation and recovery; articulated elbows, wrists and secondary
  parts keep grips and equipment connected through those moves. Idle
  fidgets stop with reduced motion. A stun holds the interrupted pose and
  a dazed face until it expires; a push visibly skids and tips the recipient
  in the impulse direction, without pretending it walked the displacement.
- `status-state.ts` derives active effects from the current unit, including
  restored online snapshots. `status.ts` attaches small enamel medallions
  in one camera-facing row above each recipient: a star for stun, a
  snowflake for slow, an exclamation mark for taunt, double chevrons for
  the Drummer's haste, and a flame while the Viking's health rage is active.
  A cyan shield track and shield icon sit above the separate team-colour
  health track, including when the shield is empty or full. Projected
  clearance keeps the status row above both tracks at every camera distance.
  A reused unit ID refreshes shield visibility; a new battle clears the cached
  DOM bars so an online rematch cannot inherit the previous troop's team tint
  or shield track.
  Healing events name only allies whose health actually rose and
  give those allies a brief plus. Push events carry origin and destination
  for the recoil and dust trail. Symbols have distinct shapes and remain
  still under reduced motion; expired effects disappear immediately.
- The eight troops originally added on 1 October 2026 (diver, sumo, linebacker, beekeeper,
  drummer, firefighter, jetpack, explorer) and the Beekeeper's `bee` share
  one kit, `figure_folk_kit.py`: one palette of pots (so they share draw
  batches), her and his head sculpts, lighter painted eyes with a focused
  frown and a firm or gritted mouth (never a grin), shoes, limbs, grips and
  the knee split. Each is 8.3k–12.3k triangles (the bee 530); `<ID>_POSE`
  poses a preview. Sumo's later replacement uses its own connected sculpt
  and common-axis skin bones, with the 1.22 art scale baked into the source,
  and has its separate reviewed runtime geometry budget above.
  The Drummer's
  drum, the Beekeeper's hive and the Jetpack's flames are `extra`. The
  bees are ordinary flying figures (wings `wingL`/`wingR`), so they get
  rings, bars and the x-ray like any troop. Their abilities draw in
  `AbilityEffects` (`effects.ts`): the beat ring, the stomp's shock rings,
  the water jet (a streaked cone shader with droplets and mist), armour
  sparks, tackle bursts, knock-back dust, frost rings and flakes on slowed
  troops (with an icy batch tint, `TroopView.frost`), the Jetpack's exhaust
  and the Beekeeper's smoke; frost shots are glowing ice shards.
- The loading splash and the Quest region maps are paintings
  (`assets/arena/concepts/loading-*`, `quest-map-*`, prompts in
  concepts/2026-09-29-arena-quest); `node scripts/arena-splash.mjs` cuts the
  picks into `public/art/optimized/arena-loading-*` and `arena-quest-*`.
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
  on a spring except the legs, which a ground solver puts on feet planted
  in world space, timed by a distance-driven cycle and a per-troop gait
  profile from `lib/games/arena/gait.ts`; rigid figures use one BatchedMesh per
  material, while complete skinned figures use independent skeleton copies
  with direct draws, including their attachments),
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
