---
name: artwork
description: Generate Gamehub artwork and UI concept mockups directly with OpenAI image generation, verify them, and put the candidates in front of the user in the running game. Use whenever the user wants new board, box, creature, texture or interface-direction images, or wants to compare candidates that already landed in public/art. Always fresh generations, never edits of existing images; two variants per requested image, generated in parallel; results are saved into the repo, self-checked, and shown in the real table before any integration.
---

# Gamehub artwork: generate, verify, compare

This skill does the whole loop itself: write the prompts, generate the images, verify them, regenerate what fails, then show the survivors in the running game. Nothing is handed off to another harness and nothing is pasted by the user.

## How images are generated

One image per Codex invocation, from the project directory:

```bash
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write '$imagegen Generate this image using the built-in image generation tool. Save the final image to the exact absolute path: <ABSOLUTE_OUTPUT_PATH>. Prompt: <PROMPT>' < /dev/null
```

Always close stdin (`< /dev/null`): a background run otherwise can hang for good after "Reading additional input from stdin..." (25 September 2026).

Resolve `codex` from `PATH`; the nvm path is only a fallback for shells that do not have it. If neither resolves, tell the user instead of guessing another path.

Since 25 September 2026 the configured default model (`gpt-6-sol`) is refused for this ChatGPT account ("not supported when using Codex with a ChatGPT account"); pass `-m gpt-6-astra` after `exec`. Codex needs network access, so run it outside the command sandbox.

- Run generations **in parallel** — there is no three-at-a-time cap. Launch them as background Bash calls and collect the results as they land. A dozen at once is fine; the practical limit is the user's Codex allowance and patience, not the harness. Each generation can take several minutes.
- Still **one image per invocation**: never ask a single call for two variants or two orientations.
- Order matters only for reporting: tell the user what is running, and report each image as it lands rather than waiting for the whole set.
- If Codex reports that built-in image generation is unavailable, say so and stop; never fall back to the separately billed Images API.

## Rules baked into every prompt

- **Fresh generations only.** Never edit, retouch, inpaint or "keep everything else the same" on an existing image — every edit pass degrades the whole picture. If one detail is wrong, regenerate the whole image from scratch with that detail described in the prompt text. This applies to the retry loop too: a retry is a new generation from the same prompt text, never a revision of the failed attempt.
- **No reference images.** Do not open, view, attach or describe any existing image while writing prompts; every time that happened the results came out more generic. Style is carried by words only — the style paragraph plus the accepted prompt text in the repo, read as text. Reading a generated image is allowed **only** in the verification step, after it exists.
- **Two variants per requested image**, labelled `-a` and `-b`, one generation each, both launched at the same time.
- **Flat pieces.** Every board or plate prompt repeats the constraint from `.agents/skills/game-world-layout/SKILL.md`, section "Flat pieces on a painted world": the play surface is a plane parallel to the screen in true plan view, one named light direction, no seats or people, a rectangular play area shaped by the orientation.
- **Newest image model, highest quality, largest native size.** PNG, no watermark.
- **Save into the repo**, never overwriting an existing file. Production boards go under `public/art/` with the variant label in the filename. Concept mockups go under `docs/concepts/<date>-<topic>/` next to a `README.md` recording the exact prompt of every image, written incrementally so an interrupted run loses nothing.

## Read first (text only)

`docs/DESIGN.md`; the accepted prompt documents for the run (for Mora boards `docs/concepts/mora-paper-world-v1/prompts-v5.md`); `.agents/skills/game-world-layout/SKILL.md`, sections on style, padding and the default safe area.

Each prompt is self-contained: full style paragraph copied in verbatim, composition, padding as fractions and comparisons (top first), exact counts and shapes, what must not appear (text, interface, rim), and what changed versus the last accepted version stated as instructions for a new image — never as "like the previous one but".

## Verification loop

- For boards the **safe area is the only pass/fail criterion**: measure the sanctuary's outermost pixels (buildings, terraces and pads, not stray foliage) and compute the top, bottom, left and right band fractions against the brief's targets within a stated tolerance (default ±4 percentage points).
- The pad count is **informational**. `LOOSE=1 node scripts/measure-pads.mjs <png> /tmp/check.png` regularly finds 13–15 of 17 because shaded pads fall outside its cream threshold; report the number and move on. Regenerate for pads only when a whole group is visibly missing or a place has the wrong number, never because the detector under-counts.
- A failing image is **not** fixed. Regenerate from the same prompt text as if for the first time, verify again, and repeat within the budget (default 4 extra generations per orientation). The loop stops at the first pass; it does not chase a second. Failed attempts stay on disk with a `-fail-N` suffix for the user to see, and are never opened again or used as input. Log every attempt with its measurements in the README.
- Retries for different images are independent — launch them in parallel too.
- Finish with a table: variant, path, pass/fail on the safe area, measured band fractions, detector pad count (informational), attempts, and any deviation from the brief.

## Concept mockup mode (UI directions, not production boards)

When the user wants to *imagine* how a game could look rather than produce a board to integrate:

- The deliverable is a **complete playable-looking screen**, one image per direction per orientation, "use case: ui-mockup". Landscape 1536×1024 for desktop, portrait 1024×1536 for phone, as separate fresh prompts.
- Name the **fixed elements** that must appear where the running game has them (for Nox since 19 September 2026: a flat, face-on rectangular play surface with a calm rim for seat tags, no chairs or seats, the hand at the bottom). Everything else may be reinvented. Allowed baked text is the game title and one confirm word; any other text is illustrative only and the README must say so.
- Give each direction **one style paragraph first**, then the layout, then the negatives. Include a "not like" clause naming the materials of the other two Gamehub games (cut paper and kraft for Mora, ink printmaking and risograph for Nox, whatever the food game currently is). Differentiation between games is a hard requirement, not taste.
- Ask the portrait prompt to **propose a card presentation that needs no horizontal scrolling** and to draw it, since that is the open problem on phones.
- Self-check here is visual and structural, not pad counting: actual pixel size, no baked text beyond the allowed words, the named fixed elements present, and whether the cards read at a glance. Record in the README which elements the model invented.

## Then: show the candidates in the running game

Once passing candidates exist, put them in front of the user in the real table, at both orientations, with the real UI around them. This is **not** integration: do not measure pads, labels, landmarks, crops or animation masks, do not write or edit metadata under `lib/games/`, and do not touch tests. Pads and rings will not line up on candidates with a new layout; that is expected and irrelevant at this stage.

1. **Register the candidates as image-only variants** in `lib/games/observatory-variants.json`: one entry per candidate with `id`, `orientation`, `label`, `source` and the three optimized paths. Never remove the currently accepted entry.
2. **Generate the optimized files** with `node scripts/optimize-paper-worlds.mjs`. It writes the full scene plus the board and overview crops for every registered variant using the accepted geometry's crop boxes. Wrong crops on new layouts are fine for a look.
3. **Make sure the switcher is mounted.** `components/game/art-variant-switcher.tsx` is a floating control listing the registered variants for the current orientation and remembering the pick in the browser. It is rendered by `solo.tsx` and `match.tsx` for the Observatory. If it was removed after a previous round, add the `<ArtVariantSwitcher/>` line back.
4. **Tell the user** which labels appear in the switcher and remind them the pads won't align on new layouts.

## When the user picks one

Only then integrate: measure the chosen image with `scripts/measure-pads.mjs` (`LOOSE=1` for greyer cream) and by eye from crops, write its geometry into the JSON files under `lib/games/`, rerun `node scripts/optimize-paper-worlds.mjs`, and accept only when `tests/observatory-layout.test.mjs` and `tests/artwork.test.mjs` pass. Remove the losing variants from the registry and the switcher line from the tables. For concept mockups the user picks a direction per game; the next run turns the chosen direction into production boards and UI pieces.
