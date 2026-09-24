# Tribu — library cover, retro game show

Tribu (internal id `orin`) is being restyled from the dark purple night-party
look to a retro 1970s TV game show look that matches the in-game skin. Text-only
fresh generations with the built-in image tool (Codex `$imagegen`); no
reference images and no previous cover inspected. Two variants per round, `-a`
and `-b`, generated in parallel from the same prompt.

Not integrated: `lib/games/box-covers.ts`, `box-tribu-blind-v1*` and the
optimized outputs are unchanged.

## Accepted prompt (round 3, both variants)

Use case: illustration-story. Create a fresh full-bleed square 2D illustrated board-game cover, largest native square size, PNG. Text verbatim: "Tribu", no other text, letters or numbers anywhere. A sociable party game about how well a group of friends really knows each other: they rank five answers to a personal prompt and guess a hidden point on a spectrum dial. Style: retro 1970s television game show illustration in bright warm daylight studio lighting; warm cream studio backdrop (#fff6e2) with a soft mustard sunburst of broad rays radiating from behind the centre; chunky dark-brown ink outlines (#2b1a12) on every shape with hard flat offset shadows; flat fills in a strict palette of tomato red (#e5482e), mustard (#f2b531), teal (#1f9e94), orange (#f07a2a) and cream, with a little subtle print grain; cheerful, bold and sleek, not cluttered. Composition: a big half-circle game-show wheel dial rising from the lower-middle, its face a spectrum band sweeping teal to mustard to orange to tomato, a thick tomato rim studded with round glowing warm marquee light bulbs, and one single dark-brown needle pointing up and slightly right. Around and in front of the dial, four or five friends as simple stylised rounded cartoon characters with varied skin tones and hair, in the palette colours, lively and laughing, leaning together; one of them proudly holds up a fan of five ranked cards marked only with coloured stripes or dots, no numbers. Leave a clear open band of sunburst rays above the title, at least one tenth of the image height, with nothing touching the top edge; the top of the title letters, including the dot of the i and the ascender of the b, starts no higher than 11% down from the top edge. Make the title "Tribu" huge across the upper centre, sitting slightly lower than a typical poster title, in a chunky rounded 1970s display typeface in the spirit of Cooper Black, cream letters with a thick dark-brown ink outline and a hard solid mustard offset drop shadow, perfectly spelled T-r-i-b-u, readable at 160px. All title letters completely within the central 84% of the canvas (8% margins minimum). Artwork fills every edge to the border. Explicitly bright and warm: not dark, not night, not purple, not indigo, not neon, no black background. Not cut paper, not kraft, not ink printmaking or risograph. No UI, no game screenshot, no counters, no score boards with digits, no border, no frame, no external mat or gray padding, no physical box mockup, no additional lettering, logos or signage. Original composition from this description alone.

## Original prompt (rounds 1 and 2)

The round 3 prompt adds only the top-clearance sentence before the title
instruction and "sitting slightly lower than a typical poster title". Rounds 1
and 2 used:

Use case: illustration-story. Create a fresh full-bleed square 2D illustrated board-game cover, largest native square size, PNG. Text verbatim: "Tribu", no other text, letters or numbers anywhere. A sociable party game about how well a group of friends really knows each other: they rank five answers to a personal prompt and guess a hidden point on a spectrum dial. Style: retro 1970s television game show illustration in bright warm daylight studio lighting; warm cream studio backdrop (#fff6e2) with a soft mustard sunburst of broad rays radiating from behind the centre; chunky dark-brown ink outlines (#2b1a12) on every shape with hard flat offset shadows; flat fills in a strict palette of tomato red (#e5482e), mustard (#f2b531), teal (#1f9e94), orange (#f07a2a) and cream, with a little subtle print grain; cheerful, bold and sleek, not cluttered. Composition: a big half-circle game-show wheel dial rising from the lower-middle, its face a spectrum band sweeping teal to mustard to orange to tomato, a thick tomato rim studded with round glowing warm marquee light bulbs, and one single dark-brown needle pointing up and slightly right. Around and in front of the dial, four or five friends as simple stylised rounded cartoon characters with varied skin tones and hair, in the palette colours, lively and laughing, leaning together; one of them proudly holds up a fan of five ranked cards marked only with coloured stripes or dots, no numbers. Make the title "Tribu" huge across the upper centre, in a chunky rounded 1970s display typeface in the spirit of Cooper Black, cream letters with a thick dark-brown ink outline and a hard solid mustard offset drop shadow, perfectly spelled T-r-i-b-u, readable at 160px. All title letters completely within the central 84% of the canvas (8% margins minimum). Artwork fills every edge to the border. Explicitly bright and warm: not dark, not night, not purple, not indigo, not neon, no black background. Not cut paper, not kraft, not ink printmaking or risograph. No UI, no game screenshot, no counters, no score boards with digits, no border, no frame, no external mat or gray padding, no physical box mockup, no additional lettering, logos or signage. Original composition from this description alone.

## Attempts

Title bounds measured on the dark ink outline (sum RGB < 150), as a fraction of
the 1254 px side. Pass threshold: every edge at least 8% (title inside the
central 84%).

| Round | Variant | Path | Title top | Title left / right | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | A | `public/art/box-tribu-v2-a-fail-1.png` | 2.2% | ~14% / ~14% | fail: top margin |
| 1 | B | `public/art/box-tribu-v2-b-fail-1.png` | 1.8% | ~12% / ~13% | fail: top margin |
| 2 | A | `public/art/box-tribu-v2-a-fail-2.png` | 3.8% | 13.0% / 14.8% | fail: top margin |
| 2 | B | `public/art/box-tribu-v2-b-fail-2.png` | 1.0% | 13.0% / 14.0% | fail: top margin |
| 3 | A | `public/art/box-tribu-v2-a.png` | 13.1% | 11.2% / 13.2% | pass |
| 3 | B | `public/art/box-tribu-v2-b.png` | 15.7% | 21.9% / 23.4% | pass |

Two rounds with the same prompt put the title against the top edge, which
suggested the model tends to do this rather than a one-off miss, so round 3
added explicit top-clearance wording (a written change to the prompt, not an
edit of any image).

## Review of the passing pair

| Check | A (`box-tribu-v2-a.png`) | B (`box-tribu-v2-b.png`) |
| --- | --- | --- |
| Size / framing | 1254×1254 square | 1254×1254 square |
| Title spelling | "Tribu", correct | "Tribu", correct |
| Legible at 160 px | yes, large and bold | yes, but smaller (about 55% of width) |
| Title in central 84% | yes | yes, lots of room |
| Edge coverage | full bleed, no border or mat | full bleed, no border or mat |
| Extra text | none; cards carry dots and stripes only | none; cards carry dots and bars only |
| Style and palette | cream plus mustard sunburst, ink outlines, hard mustard title shadow, tomato marquee rim with bulbs | same |
| Dial | full spectrum half-wheel, single dark needle | spectrum half-wheel, single needle, partly hidden by the centre friend |
| Friends | five, one holding five ranked cards | five, one holding five ranked cards |
| Not dark / night / purple | yes | yes |
| Deviations | marquee arches and palm leaves at the sides (added by the model) | same props at the sides; lots of empty sunburst sky above the title |

## Recommendation

**A.** Its title is much bigger and reads best at thumbnail size. The dial is
fully visible and centred under the title, and the composition fills the square
evenly. B is also clean but its title is noticeably smaller, and the empty rays
above it leave the top third light.
