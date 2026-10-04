# Yata: four menus in two places — 29 September 2026

## Behavior

- New-game menus read **Tokyo — Beginner · 2 rounds**, **Bangkok — Intermediate · 3 rounds**, **Mexico — Intermediate · 3 rounds** and **Puebla — Advanced · 4 rounds**. Internal ids: `beginner`, `intermediate`, `plaza`, `fiesta`.
- Tokyo and Bangkok keep their rules, values, supply, extensions and counter plate. Four dishes are renamed and redrawn with unchanged scoring: Sesame → Takoyaki, Pudding → Dango, Corn → Spring roll, Coconut (no umbrella).
- Mexico and Puebla play on the plaza plate (`yataWorldFor`), with six picks per round, six of each dish per round of supply, three order offers each round, and every dish featured once per round in Seasons. Their saves must carry `menuRounds` (3 or 4); unmarked Bangkok saves keep their two rounds.

## Balance

`node --experimental-strip-types scripts/yata-menus-balance.mjs 40` (medium bots, no extensions, 2/4/6 seats): about 39 points per player in Tokyo, 62 in Bangkok, 55 in Mexico and 66 in Puebla. Every Mexican dish earns 2–3.6 points per pick, except Tostada at two players (1.4). The first Flan and Salsa rules were replaced after this audit (8 and 5.7 per pick). These are bot figures, not human balance.

## Verification

- Full suite: **757 tests passed**. `tests/yata-menus.test.mjs` checks names, levels and rounds, dealing and conservation at 2/4/6 seats with and without all extensions, every rule example against the engine, save validation and that every dish image exists. `tests/table-worlds.test.mjs` runs every counter framing check on the plaza plates too.
- Lint passes on changed files; `npm run check:assets` passes (501 assets). The repo-wide typecheck still shows one error, in another session's `components/game/alto/alto-room.tsx`; none in the Yata files.
- Browser: headless Chrome with `--mute-audio`, against a dev server in a detached worktree synced from the working tree (ports 3041/3042). Checked:
  - the setup with four menu cards;
  - Mexico at 1440×900, 1024×768 (covered edge to edge), 768×1024 (tall plate) and 390×844 (mobile emulation, phone plate, no page scroll);
  - Puebla at 1440×900 with all three extensions (Round 1 / 4, order and season papers on the painted boards);
  - Bangkok at 1440×900 (unchanged counter, redrawn dishes).

  Physical touch, real devices, online play and a full match played by hand were not checked. Neither was human balance.
