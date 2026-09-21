# Atlas current turn structure (21 September 2026)

Two rounds, medium then hard, each with Places, Photos and Three facts.
Everyone places and locks all three private pins before discussion begins.
Each team then gets one 60-second turn to choose its three team pins in any
order. One captain confirms the set before the other team takes its turn.
The other team starts round two. Captains stay fixed within a round; there
is no requirement for every player to become captain. Missing choices at
the deadline use that captain's frozen pins, preserving choices already made.

No answers reveal until both teams confirm. Reveal Places, Photos and Three
facts in sequence, with everyone acknowledging each result. Individual play
skips team discussion. Scoring and the six-destination photo pool are unchanged.
Rules marker 9 resets prior Atlas matches to setup because their team choices
contain only one pin. This does not affect My Top Five saves.

## Scoring

Each destination awards one point for the closest pin and one bonus point
within 100 km. Metre-rounded equal closest distances share the point. After
two rounds, total distance breaks a points tie; exact remaining ties share
victory. Private placement, practice and result acknowledgement are untimed.

## Content and attribution

`lib/games/party/geo-places.json` contains 23 curated destinations: 11 medium
and 12 hard, across Africa, Asia, Europe, North America, South America and
Oceania. Six distinct destinations are drawn per match. Every destination has
three factual clues and a locally stored Wikimedia Commons photograph; the
photo round never depends on a live image service. Difficulty is editorial,
not yet calibrated by player testing. Current photo subjects are towns and
city landmarks, not a separate natural-landmark pool.

`photo-provenance.json` preserves acquisition metadata, original description,
author, source URL and licence for every image. The runtime catalog normalizes
plain-text author names and supplies spoiler-free image descriptions. Credits
are available after reveal, and an enlargement dialog preserves the complete
photo without cropping. Images are Wikimedia-generated resized JPEGs; no
image-generation tools were used. Photos were visually checked in a contact
sheet for relevant, distinct location imagery. Original copyright and licence
terms remain with their respective authors.

The interactive satellite globe supports pointer placement, drag-to-rotate,
zoom controls and keyboard controls through its projection. The map has loading, retry and image-error states.

## Verification

See `../verification/2026-09-21-release-preparation.md` for the current checks and
remaining browser, touch and human-play acceptance.
