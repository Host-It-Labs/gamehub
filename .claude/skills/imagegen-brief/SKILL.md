---
name: imagegen-brief
description: Print a hand-off prompt for a Codex agent working inside this repository that generates Gamehub artwork or UI concept mockups with ChatGPT image generation. Use whenever the user wants a prompt for new board, box, creature, texture or interface-direction images. Always fresh generations, never edits of existing images; always two variants per requested image; at most three sub-agents alive at once, fed from a prioritised rolling queue on the newest image model at highest quality; results are saved into the repo and self-checked.
---

# Image-generation hand-off brief

Print one fenced block the user pastes to the Codex agent. That agent works **inside this same repository**, so refer to files by path and say where to save output.

## Rules baked into every brief

- **Flat pieces.** Every brief for a board or plate repeats the constraint from `.agents/skills/game-world-layout/SKILL.md`, section "Flat pieces on a painted world": the play surface is a plane parallel to the screen in true plan view, one named light direction, no seats or people, a rectangular play area shaped by the orientation.

- **Fresh generations only.** Never ask the image model to edit, retouch, inpaint or "keep everything else the same" on an existing image. Each edit pass degrades the whole picture. If one detail is wrong, regenerate the whole image with the detail described in the prompt.
- **Two variants first, then a verify-and-regenerate loop.** Label them `-a` and `-b`, one generation each. Each finished image is verified mechanically (see "Verification loop"). If neither passes, the loop produces **one** replacement at a time, a **new generation from scratch, from the same prompt text**, until one passing image exists or the iteration budget (default 4 extra generations per orientation) is spent. The loop stops at the first pass; it does not chase a second. Failed attempts stay on disk with a `-fail-N` suffix for the user to see; they are never opened again or used as input. The user picks among the passing ones.
- **Newest image model, highest quality, largest native size.** Say it explicitly.
- **No reference images, ever.** The agent must not open, view, attach or describe any existing image before generating; every time it did, the results came out more generic. Style is carried by words only: the style paragraph and the accepted prompt text in the repo. Framing rules and previous prompts live in the repo and are read as text.
- **Save into the repo**, never overwriting existing files. Production boards go under `public/art/` with the variant label in the filename. Concept mockups go under `docs/concepts/<date>-<topic>/` next to a `README.md` that records the exact prompt of every image.
- **Self-check with repo tooling** before returning: for boards, the safe-area band measurements decide (see "Verification loop"); the pad detector count is reported but never fails an image on its own; then a short table of variant, path, band fractions, pad count and any deviation from the brief. For concept mockups the check is: actual pixel size, no baked text other than the allowed words, and the fixed elements the brief names are present (see "Concept mockup mode").

## Verification loop

Every brief states the acceptance measurements and the loop explicitly:

- For boards the **safe area is the pass/fail criterion**: the sub-agent measures the sanctuary's outermost pixels (buildings, terraces and pads, not stray foliage) and computes the top, bottom, left and right band fractions, comparing them with the brief's targets within a stated tolerance (default ±4 percentage points). Only that decides.
- The pad count is **informational**. `LOOSE=1 node scripts/measure-pads.mjs <png> /tmp/check.png` regularly finds 13–15 of 17 because shaded pads fall outside its cream threshold; the sub-agent reports the number and moves on. It regenerates for pads only when it can see by eye that a whole group is missing or a place has the wrong number of pads, never because the detector under-counts.
- A failing image is **not** fixed: the sub-agent regenerates from the prompt text as if for the first time, still without opening any image, saves the new attempt, verifies again, and repeats within the budget. Each attempt is logged in the README with its measurements.
- The final table lists, per variant: path, pass/fail on the safe area, measured band fractions, detector pad count (informational) and the number of attempts.

## Concurrency: three sub-agents at a time

The ChatGPT agent can keep **at most three sub-agents alive at once**. Every brief must therefore lay the work out as a **numbered queue** and say how to run it:

- One generation per sub-agent; a sub-agent generates its image, saves it, runs the self-check, appends its prompt and result to the README, and exits. No sub-agent does two images.
- Keep exactly three running. **As soon as one returns, start the next item in the queue** (a rolling queue, not fixed batches that wait for the slowest of three). Never start a fourth.
- **Order the queue by decision value.** Put the images the user must see to make the next decision first (for example every landscape direction before any portrait; both directions of one game before the second variant of anything) so that early results are already useful if the run is interrupted.
- Put the `-a` and `-b` variants of the same image in **different** positions of the queue when possible, so a wave shows the user distinct images rather than two takes on one.
- Report progress after every three completions, and write the README incrementally so an interrupted run loses nothing.
- Never run orientations or games as follow-ups in the same thread: every queue item is a fresh, independent prompt with its own full style paragraph copied in verbatim.

## Structure of the block

1. Role and delegation: inside the Gamehub repo; the queue and the three-at-a-time rule; newest model, highest quality; return every variant.
2. Read first (text only): `docs/DESIGN.md`; the accepted prompt documents relevant to the run (for Mora boards `docs/concepts/mora-paper-world-v1/prompts-v5.md`); `.agents/skills/game-world-layout/SKILL.md`, sections on style, padding, the default safe area and never looking at earlier images. State explicitly: do not open any image file at any point.
3. The brief for this run: composition, padding as fractions and comparisons (top first), exact counts and shapes, what must not appear (text, interface, rim), and what changed versus the last accepted version, stated as instructions for a new image.
4. Acceptance measurements: the band fractions with tolerance (the only pass/fail), plus the expected pad layout for a by-eye sanity check.
5. The queue: numbered, one line each, with output path, in priority order.
6. Output: native size, PNG, no watermark.
7. The verification loop, its iteration budget, and the final table.

## Concept mockup mode (UI directions, not production boards)

When the user wants to *imagine* how a game could look rather than produce a board to integrate, the brief changes in these ways:

- The deliverable is a **complete playable-looking screen**, one image per direction per orientation, "use case: ui-mockup". Landscape 1536×1024 for desktop, portrait 1024×1536 for phone. Both orientations are separate fresh prompts.
- Name the **fixed elements** that must appear where the running game has them (for Nox since 19 September 2026: a flat, face-on rectangular play surface with a calm rim for seat tags, no chairs or seats, the hand at the bottom). Everything else may be reinvented. Allowed baked text is the game title and one confirm word; any other text is illustrative only and the README must say so.
- Give each direction **one style paragraph first**, then the layout, then the negatives. Include a "not like" clause that names the materials of the other two Gamehub games, so directions stay far apart (cut paper and kraft for Mora, ink printmaking and risograph for Nox, whatever the food game currently is). Differentiation between games is a hard requirement, not taste.
- Ask the portrait prompt to **propose a card presentation that needs no horizontal scrolling** and to draw it, since that is the open problem on phones.
- Self-check is visual and structural, not pad counting: size, allowed text, presence of the fixed elements, and whether the cards read at a glance. Record in the README which elements the model invented.

## After the images come back

For production boards the integrating agent measures pads and landmarks into the JSON under `lib/games/`, runs `node scripts/optimize-paper-worlds.mjs`, and accepts only when `tests/observatory-layout.test.mjs` and `tests/artwork.test.mjs` pass. For concept mockups the user picks a direction per game; the next brief turns the chosen direction into production boards and UI pieces.
