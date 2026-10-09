# Arena quality rebuild: verification

This is a large Arena change. The review below is the root agent's technical
and visual review, not user acceptance. Concurrent character and other-game
work was preserved. No commit, pull request or release was made.

## Quality workflow

The installed
[high-fidelity-3d skill](/Users/williamguinaudie/.codex/skills/high-fidelity-3d/SKILL.md)
requires a detailed editable source, convincing primary forms, authored
materials and complete moving review before runtime reduction. Both the global
and Gamehub agent rules make it mandatory for the root and delegated 3D agents.

Dino's detailed master has 982,976 triangles; Sumo's has 3,229,836. These are
preserved separately from the 34,418- and 34,227-triangle runtime copies.
Polygon counts support the provenance record; they do not establish quality.
The [review record](review.md) describes the opened source, reduction failures,
anatomy, material and motion checks.

The normal Blender builder loads versioned neutral runtime sources, then runs
the ordinary collector and AO bake. The canonical copies preserve reviewed
geometry, custom normals, weights, material assignment and rest frames; fresh
AO is checked separately in Arena's renderer. Source caches and provenance are
under `assets/arena/blender/runtime/`; detailed masters and moving evidence are
under `work/arena/2026-10-04-rebuild/`.

## Integrated assets

The manifest selects `figures-88d2b5e6.glb`, 22,457,240 bytes, SHA256
`88d2b5e6a6748aaffe868a365a23a8ba3b61255ec171c29cadedf7a5bfc71224`.
The merge replaced only Dino and Sumo in the latest concurrent
`figures-b97920cb.glb`. All other twenty-three roots preserve their transforms,
materials, raw geometry/index/colour/morph data, skin joint order and inverse
bind matrices. Four posed comparisons match all 48,424 checked Dino and 61,664
checked Sumo skin vertices exactly. The merge also passes an existing-skin
index-renumbering fixture.

The canonical exports are `dino-runtime-v1.glb` (1,067,032 bytes, SHA256
`2813f66a050f07b1c270458526dc8ebd606d55e7a4fc3be487c5c40f22af9a5c`)
and `sumo-runtime-canonical-v1.glb` (1,288,984 bytes, SHA256
`d095475d3b3f3d258339359b98957472aac77142fbbbad03107520988f948e94`).
Fresh written-brief portraits use `ogre-d8e58a63.webp` and
`sumo-7843d27d.webp`; original sources, rejected candidates and exact prompts
are retained in the [portrait record](portraits.md).

Sumo's old 12,500-triangle budget visibly lost face, fingers and hair. Only his
independently reviewed replacement now has a 40,000 ceiling. The unchanged
figures retain their existing limits. Runtime measurements must accompany
this tradeoff; physical mobile GPU performance remains unmeasured.

Dino's two intended source factors, .78 and .48, occur once each. His native
height is .815, against Sumo's 1.696, and his body is about three times as long.
At the maximum portrait scale he spans 6.457 tiles. Removing the .48 factor
would produce a 13.45-tile silhouette. This measured low, long presentation
is a root-reviewed art choice, not accidental double scaling or user approval.

## Gameplay and interaction

Towers use a smaller rendered footprint and lower platforms. Ground movement,
deployment, turning and pushes respect rounded building hulls; Dino additionally
uses an oriented body/tail envelope. Low projectile simulation and the final
offset rendered meshes stay outside standing buildings. Lobbed and airborne
shots keep their appropriate above-building paths. Legacy snapshots recover
ground shots already inside standing friendly towers.

Shields are a generic pool with overflow damage to health, a four-second quiet
delay and a five-second refill. A cyan track and shield icon sit above health,
including while empty. Gladiator costs three elixir and has 850 health, 650
shield, 125 damage and a 1.1-second attack interval. Reused online unit IDs
refresh shield visibility; a new round clears old bars and team tints.

Status effects use a compact enamel glyph row with camera-facing presentation,
stable separation and reduced-motion handling. Holding or dragging a card shows
that card's same statistics preview, taking priority over a different selected
card. The compact phone preview contains four statistics without refitting the
camera.

## Browser evidence

The actual `ArenaGame`, current canonical figures and ordinary Arena lighting
were checked at 390×844, short portrait 390×664, tablet 768×1024, desktop
1280×720 and four-seat landscape 1133×744. Document scroll dimensions equal
each viewport. Navigation, hand, selected-card statistics, towers and health,
shield and status indicators fit. Four team colours and the weighted x-ray
silhouettes behind real tower/scenery geometry were also inspected; the low
x-ray camera is a deliberate extra view, not normal viewport acceptance.

Native browser click, field drag, cancellation and Enter selection were checked.
Dino's drag preview replaced selected Sumo's statistics, followed the pointer
onto the field and deployed on release; cancellation kept the prior selection.
Raw CDP mouse dispatch lost pointer capture in the automation, so acceptance
uses native `tab.drag` instead. Physical touch, device orientation/fullscreen
permissions, true browser zoom and mobile GPU performance were not checked.

Full eight-second Dino walk, bite and deployment cycles were inspected during
source/reduction review, with the ordinary AO export's bite checked again.
Sumo's final forward-elbow walk/turn, alternating strike/recovery and landing
cycles were recorded in the actual renderer. The front strike additionally has
a twenty-frame-per-second detail sheet. Recoil source/runtime clay front/side
and material views were opened as paired anatomy evidence.

A further eight-second recording runs the actual engine while Dino and Sumo
approach and strike standing enemy towers. Both begin outside their building
envelopes; tower health falls during the visible attacks. Sumo's approach,
guard and alternating hands are visible. The camera hides part of Dino behind
the stone, so that recording alone cannot establish his full clearance; the
separate exact contact audit supplies that check. Heavy concurrent checks
limited the engine advance to 7.1 seconds during this recording, so it is motion
evidence rather than a frame-rate measurement. The close
[character renders](characters-in-arena.jpg) use separately fitted cameras.

After the raised crest was added to Sumo's guard clearance check, a further
23-second recording followed the actual hasted king-to-princess passing
fixture. It advanced 691 simulation ticks and showed the complete approach,
guarded turn and release into free walking. The opened ten-second detail sheet
retains the surrounding tower geometry; some arm detail is occluded from that
camera, so exact closed-mesh checks remain the contact gate.

## Balance simulation

After the final engine route fix, 500 seeded hard-bot duels completed with no
draws; 440 reached overtime. Decks containing Dino won 52.5% of 337 appearances,
Sumo 58.1% of 313 and Gladiator 42.8% of 311. This is a deck-membership smoke
measurement confounded by the other cards and bot policy, not a causal estimate
of an individual card's strength or human balance acceptance. No further stat
changes were made merely from these percentages.

## Final checks

Type checking, global lint, scoped formatting, production asset validation and
the production build pass. Asset validation found 597 production assets,
129.98 MiB, all present with the Docker allowlist verified. Scoped whitespace
checks also pass.

The final 32-file Arena run finishes with 276 tests: 266 pass and 10 fail.
All failures are in the concurrent Gladiator, Medic and Viking rebuild tests:
one expects a connected Gladiator skin, eight expect the new Medic skin,
joint/palette/AO contracts, and one expects Viking's new `foreL` joint. An
independent Three-loaded comparison establishes that those three figures are
exactly the same as the preserved concurrent merge base, including names,
hierarchy, local/world transforms, geometry, attributes and materials. Their
unfinished source and tests were preserved. This is not an all-green Arena run.
The Dino/Sumo, hybrid renderer, movement, shield, bar, status, projectile,
card-preview and online checks pass. Online success/elixir fixtures now choose
legal positions for their dynamically drawn cards, so Dino's full body cannot
turn an intended success into a placement rejection.

The renderer is frozen at SHA256
`f41390a11eb38f39ba12d19ebf459e9852475dfc368d9fef54297db85183a512`;
the engine is
`1465a47646a7d0d86a4acc1ccf3d89a539c1ce0308364bbb2fe6b6f47df6f82c`.
The final strict contact matrix and native runtime timing are recorded below
after their independent checks complete. No further heavy root jobs run during
the timing check.

## Exact Dino contact

The corrected-route audit contains sixteen natural 30 Hz engine/60 Hz
interpolated movement cases. Every case has zero contained figure vertices,
figure edge interiors and reverse tower crossings against the closed shipped
tower triangles. The deliberately illegal rear-drop negative control still
finds 295 contained vertices, 982 edge penetrations and 402 reverse crossings,
with a deepest gap of −1.277122 tiles. That illegal pose is not an accepted
deployment.

The audit uses renderer hash `dfac1a4682ded25df01bec90dbf0d7d4c19ccc688fa790ccfbb96b3feb479ad1`
and the final engine/Dino export. The reviewer confirmed that later renderer
changes only affect Sumo's guarded arms: both arm methods return immediately
for other characters, and the added corner/heraldry data is consumed only by
that check. Shared stone-shell data and Dino's feet, torso, head and tail
solvers are unchanged. The merged skin comparison connects the exact tested
isolated Dino to the shipped bundle. Current Dino animation and oriented
building tests also pass.
