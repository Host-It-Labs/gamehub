# Tribu — retro studio set: cover and play backdrops

Tribu (internal id `orin`) is a party-game umbrella about friends getting to
know each other; it will hold more games than Top Five and Dial, so this art is
general: no dials, no ranking cards. The previous covers were rejected (big
grinning foreground faces felt "cursed"; the plain sunburst felt like a stock
background). This round makes the **studio set** the hero: a warm, daylight
1970s TV game-show stage, moderately detailed.

Fresh text-only generations with the built-in image tool (Codex `$imagegen`),
no reference images, two variants per image (`-a`, `-b`), all six launched in
parallel. Not integrated: no variants JSON, `lib/`, `components/`, tests or
`box-covers.ts` were touched.

## Prompts

### 1. Cover (`public/art/box-tribu-v3-{a,b}.png`)

Use case: illustration-story. Create a fresh full-bleed square 2D illustrated board-game cover, largest native square size, PNG. Text verbatim: "Tribu", no other text, letters or numbers anywhere. Tribu is a sociable party game about a group of friends getting to know each other. Style: refined flat 2D illustration of a retro 1970s television game-show studio set in warm bright daylight studio lighting, confident dark-brown ink outlines (#2b1a12) on every shape, flat colour fills with gentle soft shading and a light print grain, crafted and specific like a mid-century editorial illustration, not clip-art, not a generic sunburst background. Strict warm palette: cream (#fff6e2), mustard (#f2b531), tomato red (#e5482e), teal (#1f9e94), orange (#f07a2a) and the dark-brown ink. Set details, moderately detailed but not extremely detailed: a curved stage with a few rounded steps, a glossy lacquered stage floor with soft warm reflections, rounded 1970s wall panels with stripes, a scalloped proscenium with warm tomato and orange curtains pulled back and tied, arches lined with round glowing warm marquee light bulbs, a few potted houseplants (monstera, palms, trailing plants) in rounded pots, a few round studio spotlights on metal rigs, and at the very edge a small tiered audience area of rounded seats. Explicitly bright and warm: not dark, not night, not purple, not indigo, not neon, no black background. Not cut paper, not kraft, not ink printmaking or risograph. Composition: a wide, centred, slightly elevated view of the whole studio set; the set itself is the hero. The curved stage sits in the lower half with its steps coming towards the viewer and the lacquered floor reflecting the lights; four or five contestant podiums in rounded 1970s shapes (pill and capsule forms, stripes in tomato, mustard, teal and orange, a glowing round bulb on each) stand in a gentle arc on the stage; the scalloped proscenium and pulled-back curtains frame the set at the sides and top; marquee-bulb arches rise behind the podiums; plants and spotlights on rigs at the sides; a sliver of tiered audience seating at one edge. People are optional: if included, only three or four small simple relaxed figures standing at the podiums in mid-distance, seen small, with no close-up faces and no big grins; nothing large in the foreground, the foreground is open lacquered floor and the bottom step. Title: above the stage, hanging as the set's own lit marquee sign, the word "Tribu" in chunky rounded 1970s display letters in the spirit of Cooper Black, cream letters with a thick dark-brown ink outline, a hard mustard offset shadow, and round glowing warm marquee bulbs studding the letters or the sign frame, perfectly spelled T-r-i-b-u, large and readable at 160px. Leave a clear band of set (curtain valance or wall) above the sign; the top of the title letters, including the dot of the i and the ascender of the b, starts no higher than 11% down from the top edge. All title letters and the sign completely within the central 84% of the canvas (8% margins minimum on every side). Artwork fills every edge to the border. No UI, no game screenshot, no dial, no wheel, no cards, no ranking boards, no scoreboards, no digits, no border, no frame, no external mat or gray padding, no physical box mockup, no additional lettering, logos or signage anywhere else. Original composition from this description alone.

### 2. Landscape backdrop 1536×1024 (`public/art/tribu-studio-landscape-{a,b}.png`)

Use case: illustration-background. Create a fresh 2D illustrated game background, landscape 1536x1024, PNG. A retro 1970s game-show studio for the party game Tribu, seen straight on from the audience at stage height. Composition: the central 70% of the width and the central 75% of the height must be calm and nearly empty: a wide open glossy lacquered stage floor in cream and pale mustard with soft blurred warm reflections in the lower middle, and above it a soft plain back wall of broad, very pale rounded cream panels with faint low-contrast stripes; no strong lines, no objects, no bulbs, no furniture, no high-contrast shapes anywhere in that central area. All the detail goes around the edges and along the top: the scalloped proscenium valance and a row of marquee bulbs across the top edge; warm tomato and orange curtains pulled back and tied at the far left and far right edges; one or two rounded 1970s contestant podiums partly visible at the extreme left and right edges; potted houseplants in the corners; round studio spotlights on metal rigs hanging along the top; the curved front edge of the stage with a few rounded steps running along the bottom edge. Style: refined flat 2D illustration of a retro 1970s television game-show studio set in warm bright daylight studio lighting, confident dark-brown ink outlines (#2b1a12) on every shape, flat colour fills with gentle soft shading and a light print grain, crafted and specific like a mid-century editorial illustration, not clip-art, not a generic sunburst background. Strict warm palette: cream (#fff6e2), mustard (#f2b531), tomato red (#e5482e), teal (#1f9e94), orange (#f07a2a) and the dark-brown ink. Set details, moderately detailed but not extremely detailed: a curved stage with a few rounded steps, a glossy lacquered stage floor with soft warm reflections, rounded 1970s wall panels with stripes, a scalloped proscenium with warm tomato and orange curtains pulled back and tied, arches lined with round glowing warm marquee light bulbs, a few potted houseplants (monstera, palms, trailing plants) in rounded pots, a few round studio spotlights on metal rigs, and at the very edge a small tiered audience area of rounded seats. Explicitly bright and warm: not dark, not night, not purple, not indigo, not neon, no black background. Not cut paper, not kraft, not ink printmaking or risograph. This is a background for a game's play screen, so the image must be slightly soft and airy with lowered contrast, a light warm haze over the whole scene, so dark-brown text and interface cards laid on top stay readable. No people, no figures, no text, no letters, no numbers, no signage lettering, no logos, no UI, no dial, no wheel, no cards, no border, no frame. Artwork fills every edge to the border. Original composition from this description alone.

### 3. Portrait backdrop 1024×1536 (`public/art/tribu-studio-portrait-{a,b}.png`)

Use case: illustration-background. Create a fresh 2D illustrated game background, portrait 1024x1536, PNG, composed for a phone screen. A retro 1970s game-show studio for the party game Tribu, seen straight on from the audience at stage height. Composition: a calm, nearly empty centre column: the central 80% of the width and the central 70% of the height hold only a soft plain back wall of broad, very pale rounded cream panels with faint low-contrast stripes flowing down into an open glossy lacquered stage floor in cream and pale mustard with soft blurred warm reflections; no strong lines, no objects, no bulbs, no furniture, no high-contrast shapes anywhere in that central area. The detail is concentrated in a band along the top edge and a band along the bottom edge, and stays thin at the sides: at the top, the scalloped proscenium valance with a row of warm marquee bulbs, round studio spotlights on a metal rig and the tied-back tops of tomato and orange curtains; along the left and right sides only a narrow sliver of curtain; at the bottom, the curved front edge of the stage with a few rounded steps, the tops of two rounded 1970s contestant podiums at the extreme bottom corners, and potted houseplants in the bottom corners. Style: refined flat 2D illustration of a retro 1970s television game-show studio set in warm bright daylight studio lighting, confident dark-brown ink outlines (#2b1a12) on every shape, flat colour fills with gentle soft shading and a light print grain, crafted and specific like a mid-century editorial illustration, not clip-art, not a generic sunburst background. Strict warm palette: cream (#fff6e2), mustard (#f2b531), tomato red (#e5482e), teal (#1f9e94), orange (#f07a2a) and the dark-brown ink. Set details, moderately detailed but not extremely detailed: a curved stage with a few rounded steps, a glossy lacquered stage floor with soft warm reflections, rounded 1970s wall panels with stripes, a scalloped proscenium with warm tomato and orange curtains pulled back and tied, arches lined with round glowing warm marquee light bulbs, a few potted houseplants (monstera, palms, trailing plants) in rounded pots, a few round studio spotlights on metal rigs, and at the very edge a small tiered audience area of rounded seats. Explicitly bright and warm: not dark, not night, not purple, not indigo, not neon, no black background. Not cut paper, not kraft, not ink printmaking or risograph. This is a background for a game's play screen, so the image must be slightly soft and airy with lowered contrast, a light warm haze over the whole scene, so dark-brown text and interface cards laid on top stay readable. No people, no figures, no text, no letters, no numbers, no signage lettering, no logos, no UI, no dial, no wheel, no cards, no border, no frame. Artwork fills every edge to the border. Original composition from this description alone.

## Attempts

One round, all six launched in parallel from the prompts above. Every image
passed first time, so no regenerations were made and there are no `-fail-N`
files.

| Image | Variant | Path | Size | Attempts | Result |
| --- | --- | --- | --- | --- | --- |
| Cover | A | `public/art/box-tribu-v3-a.png` | 1254×1254 | 1 | pass |
| Cover | B | `public/art/box-tribu-v3-b.png` | 1254×1254 | 1 | pass |
| Landscape | A | `public/art/tribu-studio-landscape-a.png` | 1536×1024 | 1 | pass |
| Landscape | B | `public/art/tribu-studio-landscape-b.png` | 1536×1024 | 1 | pass |
| Portrait | A | `public/art/tribu-studio-portrait-a.png` | 1024×1536 | 1 | pass |
| Portrait | B | `public/art/tribu-studio-portrait-b.png` | 1024×1536 | 1 | pass |

## Review: covers

Title margins measured on the full-resolution image with 8% guide lines
(1254 px side). Letter top is the top of the dot on the i and the ascender of
the b; the sign frame is the marquee-bulb border.

| Check | A | B |
| --- | --- | --- |
| Title spelling | "Tribu", correct | "Tribu", correct |
| Title style | cream Cooper-Black-style letters, dark outline, mustard offset, bulbs set inside every letter, on a teal oval sign with a bulb border | cream Cooper-Black-style letters, dark outline, mustard shadow, on a tomato cloud-shaped sign with a bulb border; plain letters |
| Readable at 160 px | yes (about 62% of width) | yes (about 55% of width) |
| Top margin | letters ~11.6%, sign frame ~9.4% | letters ~12.8%, sign frame ~11% |
| Left / right margin | sign ~15% / ~15% | sign ~19.5% / ~20% |
| Other text | none | none |
| People | four small contestants mid-distance at striped drum podiums, calm, no grins; a few tiny audience heads at the right edge | four small contestants mid-distance at rounded box podiums, relaxed, small smiles; three audience members seen from behind at the lower right in a curved tier |
| Set detail | scalloped valance, curtains, striped rounded panels, four marquee arches, steps, lacquered floor with reflections, plants, spotlights on stands, audience tier | valance, curtains, rainbow-stripe arches, one central marquee arch, hanging spotlight rig with trailing plants, steps, lacquered floor with a floor motif, plants, audience tier |
| Edge coverage / mat | full bleed, no border | full bleed, no border |
| Daylight, not dark / neon / purple | yes | yes |
| Deviations | foreground monstera leaves in both bottom corners (small, framing) | audience tier in the lower right is closer to the viewer than asked, but backs only, no faces |

## Review: backdrops

Calmness measured on greyscale: standard deviation and share of strong edges
(neighbour difference > 40) inside the UI area (landscape: central 70% × 75%;
portrait: central 80% × 70%) versus outside it.

| Image | Centre std | Centre strong edges | Outside std | Outside strong edges | Notes |
| --- | --- | --- | --- | --- | --- |
| Landscape A | 28.3 | 3.27% | 50.9 | 9.20% | calm back wall and floor; the UI box clips the top of the stage steps and the inner edge of the plants, which raises the centre numbers; lights read slightly cooler (two teal spotlight lenses) |
| Landscape B | 24.7 | 1.94% | 56.8 | 11.51% | calmest landscape: one large soft rounded wall panel and a bare floor; two curved stage-edge lines cross the lower part of the UI area; audience seat backs along the bottom |
| Portrait A | 18.2 | 0.85% | 57.4 | 8.73% | calmest overall; detail is top band (valance, bulbs, rig) and bottom corners (podium tops, plants); thin audience tiers and palms on the sides |
| Portrait B | 23.1 | 1.24% | 56.1 | 6.20% | curtains at the sides are a little wider than asked; bottom band with steps, podiums, plants and seat backs; teal ceiling above the valance |

All four: no people, no text or letters, no UI, full bleed, warm daylight.

## Recommendation

- **Cover: A** (`box-tribu-v3-a.png`). The bulb-studded letters on the teal
  oval make the strongest marquee and read best at thumbnail size. The four
  arches give the set a clear rhythm, and the people stay small. B is a good
  alternative with a softer, airier set, but its audience corner sits closer
  to the foreground.
- **Landscape: B** (`tribu-studio-landscape-b.png`). It has the quietest
  middle, and its single soft wall panel frames a UI block naturally. A has
  more set dressing but pushes steps and plants into the UI area.
- **Portrait: A** (`tribu-studio-portrait-a.png`). It has the calmest centre
  column with the detail kept to the top and bottom. B's curtains eat more of
  the side width.

Note that landscape B and portrait A are different renders, so the details
won't match exactly between orientations (A has a spotlight rig and side
audience tiers, B has a scalloped valance with hanging plants). If you want
the two orientations to match as a pair, choose landscape A with portrait A,
or landscape B with portrait B.

## Choice (23 September 2026)

William chose all three A variants. Cover A became `public/art/box-tribu-blind-v2.png`
(1024 WebP, 320/640 and spine in `public/art/optimized/`). The landscape A and portrait A
backdrops ship as `tribu-studio-landscape-1536/960.webp` and `tribu-studio-portrait-1024/640.webp`.
The B variants, the rejected v2 retro covers and the old night cover (`box-tribu-blind-v1*`)
were moved to `~/Documents/code/gamehub-art-archive/public/art/`.
