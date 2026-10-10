# Arena card portraits v14: one cartoon set (10 October 2026)

William's review of v13: the portraits look like real people, with realistic
colouring. The Cowboy (ranger v10-b) is the best of the set because it is more
stylised and a little cartoony. v14 regenerates every card except the Cowboy
(the Samurai too) and both library covers in one cartoon look, a notch more
cartoony than the Cowboy and in the same world as the game's 3D figures:
sturdy chunky shapes, simplified expressive faces (ivory eyes, dark pupils,
bold brows, clear mouth shapes), matte surfaces and saturated but not garish
stylised colour, never photographic skin or lighting.

Text only, as the artwork skill requires: one shared style paragraph (`LOOK`
in `build-prompts.mjs`), then each card's written subject (the v7 subjects of
`docs/concepts/2026-10-01-arena-draft/portraits.md`, with the revised pirate
and linebacker; the written v13 subjects of the figures rebuilt on 4 October,
toned to the cartoon look; a new written Samurai subject from its figure and
v10 brief). No image was attached, opened or described while writing them.
The card framing contract is unchanged from v13 (square, subject 85–90% of
the height, top-left fifth free for the cost badge, full-bleed opaque
backdrop), so integration is a path swap.

Generation: `gen.sh <prompt> <png> <log>`, the artwork skill's command (newest
Luna, low reasoning, one image per run, accepted only if the run's own session
folder holds exactly one PNG with the same hash). Two variants per image
(`-a`, `-b`), all launched in parallel by `run-all.sh` (it skips images already on disk). Exact prompts: `prompts/<id>.txt`
(written by `node build-prompts.mjs`); logs in `logs/`.

Files: cards `assets/arena/cards/card-<id>-v14-{a,b}.png`; covers
`assets/arena/concepts/box-arena-square-v6-{a,b}.png` and
`box-arena-wide-v6-{a,b}.png`.

## Attempts and picks

Recorded as they land.

First batch (50 runs at once): 39 passed. Ten runs failed on network errors
("workspace routing discovery timed out", no image made) and one
(beekeeper-b) called the image tool twice, so its copy is kept as
`card-beekeeper-v14-b-fail-1.png` and not used; their logs are
`logs/<id>-<v>-fail-1.log`. All eleven were relaunched from the same prompt
text. The retry batch passed except diver-b, which again called the image
tool twice and copied neither (log `logs/diver-b-fail-2.log`)
and was relaunched; its third attempt did the same (log `logs/diver-b-fail-3.log`,
no copy), and the fourth passed.

| image | pick | why |
| --- | --- | --- |
| balloon | b | larger face and bomb, top-left open sky (a: good, smaller face) |
| miner | a | whole pick head inside the frame (b: the pick tip touches the top edge) |
| mage | b | bigger, fiercer face; crystal just below the badge corner (a: crystal inside it) |
| sumo | b | top-left clear (a: a lantern in the badge corner) |
| viking | a | clean swoosh, smaller background banner (b: banner motif reads like a letter) |
| gunner | a | full figure and gun, plume clear of the badge corner |
| pirate | a | whole leaping figure and full blade arc |
| drummer | b | larger face and drum |
| firefighter | b | larger face, both hands on the nozzle |
| medic | b | larger face, flask and sparkles whole |
| explorer | b | larger face in the hood, frost burst whole |
| duelist (Samurai) | a | whole U crest inside the frame (b: crest touches the top edge) |
| inventor | b | face clear, top-left clear (a: hair puff in the badge corner) |
| archers (Cadets) | a | exactly two cadets, both faces clear of the badge corner (b: the rear helmet touches it) |
| ogre (Dino) | b | bigger head and jaw, reads best at 90 px (a: smaller in the frame) |
| imps (Robots) | b | exactly three, the middle one larger and in front |
| drake (Biplane) | b | pilot face and falling bombs clear; only plain wing in the badge corner (a: a roundel there) |
| meteor | b | the cobalt tower and its banner read clearly under the trail |
| gladiator | b | larger face, whole shield, sparks where the blow lands |
| beekeeper | b (second b run) | larger face, swarm and smoker clear |
| linebacker | a | both hands and both legs whole (b: broader pads but a hand cut by the right edge) |
| diver | a | both variants put the raised fist and wrench handle in the badge corner (the brief keeps only the wrench head out of it); a has the bigger splash and stride |
| jetpack | b | bigger figure, flames clear of the badge corner |
| cover square | a | biggest title and four big characters, reads at thumbnail size (b: busier, extra soldiers) |
| cover wide | b | came out 2048×768; in the 3:1 cut both towers, flags, every character and the title are whole (a: the blue tower roof is cut by the lid's top edge) |


Ten accepted runs had Codex copy the wrong PNG to the output path (a picture
from another parallel run, sometimes another agent's cover, since it looked
for the newest file instead of its own `output_hint`). The wrapper caught each
one by hash and replaced it with the run's own single PNG, so every v14 file
is the image of its own prompt; the wrong copies were removed. Every accepted
run's session folder holds exactly one PNG.

## Integration

`CARD_ART` in `scripts/arena-assets.mjs` points every card but the Cowboy
(`ranger: 'v10-b'`, unchanged) at its v14 pick; the covers are built from
`box-arena-square-v6-a.png` and `box-arena-wide-v6-b.png` and served as
`box-arena-blind-v3*` and `box-arena-wide-v3*` (`arena: 3` in
`lib/games/box-covers.ts`). `node scripts/arena-assets.mjs --only=cards` and
`--only=covers` wrote `public/3d/arena/cards/*.webp`,
`lib/games/arena/assets.json` and the cover previews in
`lib/artwork-previews.json`; `node scripts/production-assets.mjs --write`
refreshed the Docker allowlist.

The Cowboy (v10-b) is the most realistic card left in the set: a painted
semi-realistic face with stubble and more photographic colour beside the
cartoon faces of v14. It reads as the same family at hand size, but it is
the odd one out at full size.
