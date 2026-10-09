# Diner night-route balance — 9 October 2026

All requested code and tuning are implemented within the brief’s file allowlist. The main difficulty and progression targets are met in the measured bot cohorts. Full test acceptance remains blocked by five HTTP tests that cannot listen on localhost in this environment; the other 53 Diner tests and seven additional bot checks pass.

## Method and reproduction

The before and after comparison uses the same 80 seeds, **1001–1080**, and the same local fork/equipment policy. Initial arrival/patience tuning used seeds 1–40. The medal estimate and token floor were then calibrated against the 80-seed comparison, so it is not a blind holdout. A separate 40-seed check (3001–3040) is recorded in `validation.json`; the earlier newcomer shortfall set (2001–2040) is rechecked in `newcomer-regression.json`. All final results use the final constants. The final difficulty/token calibration used the comparison and earlier check data; these are seeded target checks, not a blind human-difficulty estimate. Baseline source files are preserved in `before/`; its engine/content/layout re-exports point to the unchanged shared sources, whose hashes are recorded. `before.json` and `after.json` contain every run, stop, wallet, token award, fork and equipment choice, plus source and simulator hashes.

```sh
node --experimental-strip-types scripts/diner/balance.mjs --source=docs/concepts/2026-10-08-diner-car/balance/before --seeds=80 --start=1001 --progression=12 --out=before.json
node --experimental-strip-types scripts/diner/balance.mjs --seeds=80 --start=1001 --audit=true --progression=12 --probes=40 --out=after.json
node --experimental-strip-types scripts/diner/balance.mjs --pause=36 --upgrades=coffee-urn:1,spare-tire:2 --seeds=80
```

The default invocation plays the three requested cohorts. `--pause` counts idle ticks after every action at 30 Hz: 20 ticks is about 0.67 seconds, 36 about 1.2 seconds. `--upgrades` accepts `none`, `full`, or explicit ranks. All shifts use the real engine until death or closing; the simulator calls the real drive, settlement, reward, Garage, Motel and Workshop functions. A run ends at death or the third boss, without overtime. Timeouts and refused settlements throw rather than being counted as wins.

The fork policy prefers gear/rare when healthy, Motel/life when at least two lives short, and an affordable Garage. It uses current fork cards, not future offers or shift RNG. Garage purchases keep a reserve for the next drive and buy a patch when hurt; a hurt Motel visit rests, otherwise it tunes. Equipment uses one fixed practical ranking: Safety net, Dash, third hand, Order pad, Warm plates and Welcome mat lead. Second wind moves to the front when two lives are missing. Lucky dice rerolls a weak offer. Twelve progression histories use seeds `1001 + player*1000 + runIndex`, start with an empty Workshop, bank real tokens, and buy useful ranks only between runs.

“Stop reached” counts the attempted drive, including death pushing the car. Rest stops count. Boss survival and mean losses below include those failed drives, with gas loss reported separately in the raw data. Every sharp run counted at stop 10 actually started The Critic.

## Bot changes

- Rank visible jobs by patience, distance and a small commitment bonus, so the waiter does not change direction every tick. Complete seating and washing first, batch two or three useful plates at the counter, and serve the urgent matching table.
- Cook parallel lanes and prepare one spare during quiet periods. Respect `mayStart` and the counter’s actual take-before-cook precedence, including burnt plates. Bank bills near closing.
- Use the pass to shelve a spare with full hands and retrieve its wanted FIFO plate later. Count held and shelved dishes when planning; never put/pick an unwanted plate in a loop.
- Fetch coffee for a party below 65% patience, pour for low parties, and refill a nearly empty pot when several low parties need it and the urn is close. Respect serving’s precedence over pouring.
- Play the jukebox for at least two low parties when it is ready. Dash only on a straight path longer than 2.9 floor units, respecting the cooldown and waiting for the dash to finish before pressing Use/Out.
- Spot mimics only through `oddOneOut` on outfits. No mimic flags, unrevealed orders, RNG or future arrivals are consulted. Keep `botInput` and `playShift` signatures and co-op claims.

## Before and after

| Cohort (80 runs each)           | Median stop before → after | Reach stop 10 before → after | Clear night before → after | Mean tokens before → after | Mean final wallet before → after |
| ------------------------------- | -------------------------- | ---------------------------- | -------------------------- | -------------------------- | -------------------------------- |
| Newcomer, pause 36, no Workshop | 10 → 5                     | 55.0% → 1.2%                 | 0.0% → 0.0%                | 51.33 → 87.69              | 452.26 → 120.35                  |
| Sharp, pause 20, no Workshop    | 11 → 10                    | 96.2% → 51.2%                | 1.2% → 0.0%                | 102.12 → 182.21            | 1193.22 → 590.50                 |
| Sharp, pause 20, full Workshop  | 15 → 15                    | 100.0% → 100.0%              | 42.5% → 70.0%              | 162.62 → 375.56            | 2559.96 → 1843.67                |

The newcomer median death is **stop 5** (target 4–6). **41/80 sharp runs reach stop 10**, and none clears the night; **56/80 full-Workshop runs clear** (70.0%, target at least half). The main newcomer sample earns at least **42 tokens**, enough for the cheapest upgrade (**25**). Across all 160 newcomer runs, including both additional sets, the minimum is **25**, with every run affording it. The Workshop costs **1000 → 6220 tokens**; twelve actual purchase histories take **8–9 → 19–25 runs**, with median **8 → 22**, approximately the requested 20–30 runs (one history finishes in 19).

The separate 3001–3040 check gives:

| Cohort   | Median stop | Reach stop 10 | Clear night | Minimum tokens |
| -------- | ----------- | ------------- | ----------- | -------------- |
| newcomer | 5           | 0.0%          | 0.0%        | 49             |
| sharp    | 10          | 62.5%         | 0.0%        | 80             |
| workshop | 15          | 97.5%         | 67.5%       | 187            |

Across the 120 main/check runs per cohort: **55%** of sharp players reach stop 10, and **69.2%** with the full Workshop clear the night. All three newcomer samples have median death at stop 5.

An intermediate 40-seed `bot-only.json` experiment kept the original numbers: the improved bot had a sharp median of 15 and a full-Workshop clear rate of 100%. Tuning then restored the intended early wall and late progression. That intermediate sample uses seeds 1–40 and should not be treated as a matched comparison with the 80-seed table.

### Distribution of final stops

| Final attempted stop | Newcomer runs | Sharp runs | Full-Workshop runs |
| -------------------- | ------------- | ---------- | ------------------ |
| 1                    | 0             | 0          | 0                  |
| 2                    | 0             | 0          | 0                  |
| 3                    | 3             | 0          | 0                  |
| 4                    | 8             | 0          | 0                  |
| 5                    | 50            | 5          | 0                  |
| 6                    | 9             | 6          | 0                  |
| 7                    | 7             | 13         | 0                  |
| 8                    | 1             | 2          | 0                  |
| 9                    | 1             | 13         | 0                  |
| 10                   | 1             | 39         | 7                  |
| 11                   | 0             | 1          | 3                  |
| 12                   | 0             | 0          | 5                  |
| 13                   | 0             | 0          | 0                  |
| 14                   | 0             | 0          | 2                  |
| 15                   | 0             | 1          | 63                 |

Stop 15 includes both victory and death at Midnight Feast; 56 of the full-Workshop runs are victories.

### Losses by stop

Each cell is mean shift lives lost / mean gas lives lost among runs that reached that stop. Rest stops have no shift loss; healing is not subtracted from losses. `n` differs as runs die.

| Stop | Newcomer           | Sharp              | Full Workshop      |
| ---- | ------------------ | ------------------ | ------------------ |
| 1    | 0.44 / 0.00 (n=80) | 0.09 / 0.00 (n=80) | 0.00 / 0.00 (n=80) |
| 2    | 0.33 / 0.06 (n=80) | 0.14 / 0.00 (n=80) | 0.00 / 0.00 (n=80) |
| 3    | 0.20 / 0.01 (n=80) | 0.00 / 0.00 (n=80) | 0.00 / 0.00 (n=80) |
| 4    | 0.84 / 0.16 (n=77) | 0.15 / 0.00 (n=80) | 0.00 / 0.00 (n=80) |
| 5    | 1.99 / 0.19 (n=69) | 1.44 / 0.00 (n=80) | 0.07 / 0.00 (n=80) |
| 6    | 1.37 / 0.11 (n=19) | 0.49 / 0.00 (n=75) | 0.01 / 0.00 (n=80) |
| 7    | 1.50 / 0.00 (n=10) | 0.71 / 0.00 (n=69) | 0.12 / 0.00 (n=80) |
| 8    | 0.67 / 0.00 (n=3)  | 0.27 / 0.00 (n=56) | 0.24 / 0.00 (n=80) |
| 9    | 2.50 / 0.00 (n=2)  | 1.37 / 0.00 (n=54) | 0.34 / 0.00 (n=80) |
| 10   | 1.00 / 0.00 (n=1)  | 2.90 / 0.00 (n=41) | 1.43 / 0.00 (n=80) |
| 11   | —                  | 2.50 / 0.00 (n=2)  | 0.60 / 0.00 (n=73) |
| 12   | —                  | 1.00 / 0.00 (n=1)  | 0.71 / 0.00 (n=70) |
| 13   | —                  | 0.00 / 0.00 (n=1)  | 0.11 / 0.00 (n=65) |
| 14   | —                  | 3.00 / 0.00 (n=1)  | 0.63 / 0.00 (n=65) |
| 15   | —                  | 3.00 / 0.00 (n=1)  | 1.67 / 0.03 (n=63) |

### Losses by place and boss

Natural route visits, excluding bosses from their place rows. Each cell is **mean shift lives lost; visits; survival**. These rows include found equipment and selection bias. Gas losses remain separate in the JSON.

| Place / boss | Newcomer         | Sharp             | Full Workshop     |
| ------------ | ---------------- | ----------------- | ----------------- |
| truckstop    | 0.34; 128; 96.1% | 0.11; 123; 100.0% | 0.13; 151; 100.0% |
| drivein      | 0.72; 138; 95.7% | 0.15; 132; 100.0% | 0.08; 166; 98.8%  |
| fairground   | 1.78; 9; 33.3%   | 1.36; 66; 69.7%   | 0.69; 140; 95.7%  |
| harbour      | 1.64; 11; 45.5%  | 0.78; 67; 88.1%   | 0.28; 115; 99.1%  |
| oldtown      | 1.08; 13; 53.8%  | 0.50; 78; 91.0%   | 0.14; 133; 99.2%  |
| moonmile     | No visits        | No visits         | 0.44; 41; 100.0%  |
| last-bus     | 1.99; 69; 27.5%  | 1.44; 80; 93.8%   | 0.07; 80; 100.0%  |
| critic       | 1.00; 1; 0.0%    | 2.90; 41; 4.9%    | 1.43; 80; 91.2%   |
| feast        | No visits        | 3.00; 1; 0.0%     | 1.67; 63; 88.9%   |

Every place and every boss has surviving visits and nonzero mean losses in the full-Workshop route sample. There are too few unupgraded late-leg place visits to estimate their survival rates well.

### Isolated survivability probes

Forty seeds per row and cohort, pause 20, full starting lives, **no found equipment**. Regular places are busy-3 at column 4 of their native leg; bosses use column 5. These diagnose gear dependence.

| Place / boss | Sharp, no Workshop: mean lost; survival | Full Workshop: mean lost; survival |
| ------------ | --------------------------------------- | ---------------------------------- |
| truckstop    | 0.50; 100.0%                            | 0.00; 100.0%                       |
| drivein      | 1.18; 100.0%                            | 0.00; 100.0%                       |
| fairground   | 4.00; 0.0%                              | 3.45; 85.0%                        |
| harbour      | 4.00; 0.0%                              | 2.95; 92.5%                        |
| oldtown      | 3.98; 2.5%                              | 2.23; 97.5%                        |
| moonmile     | 4.00; 0.0%                              | 5.78; 15.0%                        |
| last-bus     | 2.70; 82.5%                             | 0.62; 100.0%                       |
| critic       | 4.00; 0.0%                              | 5.35; 30.0%                        |
| feast        | 4.00; 0.0%                              | 5.90; 7.5%                         |

## Fuel and tools

Actual low-income newcomer runs require a push in **26/80 runs**; sharp runs in **0/80**, and full Workshop in **2/80**. The sharp final wallet drops from 1193 to 590 coins. Gas constrains weak takings, while strong income and found money gear leave a comfortable later wallet.

For a separate sensitivity check, `medalFreeLedger` replays each observed route with shift takings capped just below bronze and the actual gas and Garage bill. It is a **wallet-only counterfactual**, not another playable-run success rate: it does not model changed life losses, equipment choices or purchases in response to lower income.

| Cohort   | Leg-2 drives in ledger | Leg-2 insufficient-wallet drives | Mean leg-2 wallet after stop |
| -------- | ---------------------- | -------------------------------- | ---------------------------- |
| newcomer | 35                     | 5                                | 115.86                       |
| sharp    | 295                    | 61                               | 162.83                       |
| workshop | 400                    | 48                               | 204.74                       |

The full-Workshop audit records **1986 pot/refill actions, 5820 pours, 1164 songs, 32148 dashes, 4 pass deposits and 0 pass pickups**. All three main cohorts have **zero refused actions**. Retrieval is verified in a focused FIFO fixture even when the natural solo run has no pickup opportunity. The seven checks also cover hand capacity, coffee’s threshold, the jukebox, Dash/cooldown, pauses and hidden-state invariance.

## Final numeric constants

Let `s = leg*5 + col` count from zero, `busy = max(1, busy)`, and `over = max(0, leg-2)`.

| Constant                                              | Before                     | Final                         |
| ----------------------------------------------------- | -------------------------- | ----------------------------- |
| Arrival busy penalty                                  | 0.07                       | 0.09                          |
| Arrival low interval                                  | max(4.6, 13 − 0.6s) × pace | max(4.6, 12.5 − 0.84s) × pace |
| Queue patience                                        | max(24, 56 − 2s) × calm    | max(24, 48 − 1.8s) × calm     |
| Order patience                                        | max(16, 34 − 1.2s) × calm  | max(16, 30 − 1.2s) × calm     |
| Food patience                                         | max(28, 60 − 2s) × calm    | max(28, 52 − 2s) × calm       |
| Last Bus rush every / length / pace                   | 28s / 16s / 2.3            | 24s / 16s / 2.5               |
| Gas before rounding to 5                              | 25 + 9s + 6busy            | 35 + 13s + 8busy              |
| GEAR_PRICE common / uncommon / rare                   | 60 / 100 / 160             | 75 / 125 / 200                |
| Expected collectible coins per guest (medal estimate) | 13                         | 10                            |
| Survived-shift token base                             | 2                          | 20                            |

`pace = (1 − 0.09*(busy−1))*0.95^over`; the high arrival interval adds `max(2.2, 4−0.12s)` seconds. `calm = (1−0.05*(busy−1))*0.96^over`, before each place’s existing factors. The medal estimate uses **10 coins per expected guest**, with thresholds at 0.5 / 0.75 / 1 of that estimate, rounded to 5; party-size curves, place factors, other troubles and bosses are unchanged.

The first drive remains free; Last Bus / Critic / Feast gas is **110 / 175 / 240 coins**. Garage equipment still adds **15 coins per leg** to GEAR_PRICE. `patchPrice` remains **70 + 20\*leg**. Tokens are **(survived ? 20 + medals + (boss ? 10 : 0) : 0) + floor(coins/40)**; failed shifts retain only their coin-derived tokens. Shift lengths remain **100 / 110 / 120 seconds, +20 for bosses**. Lives remain **4, up to 6 with Spare tire**.

| Workshop upgrade | Final costs by rank |
| ---------------- | ------------------- |
| gas-can          | 25, 305             |
| spare-tire       | 155, 480            |
| coffee-urn       | 320                 |
| neon-sign        | 250, 575            |
| bigger-patio     | 410                 |
| twin-grill       | 480                 |
| roller-skates    | 560                 |
| heat-lamp-pass   | 480                 |
| jukebox          | 645                 |
| lucky-dice       | 410                 |
| road-atlas       | 320                 |
| chrome-tray      | 805                 |
| Total            | **6220**            |

## What still looks off

- **Late stops are gear dependent.** The bare car loses all 40 isolated probes at fairground, harbour, moonmile, critic, feast. Full Workshop without found gear clears 7.5% of Feast probes. Actual geared runs meet the target, but rare-gear luck affects the tail; human testing is still needed.
- **Early full-Workshop places become easy.** The isolated Truck stop and Drive-in probes lose no lives with all ranks. Later natural visits to those same places still lose lives, and Last Bus does too. Raising the first-leg floor further would make the unupgraded newcomer curve harsher.
- **Boss medals still need human calibration.** The final full-Workshop sample has 24/63 Feast attempts with zero medals, including 7 deaths. Lowering expected collectible takings from 13 to 10 improved the medal estimate, but service capacity still varies with equipment, jams and brownouts.
- **The pass is useful but infrequent.** Full-hand-only deposit and FIFO pickup limit a sharp solo waiter’s opportunities. The bot deposits real leftovers and can retrieve the front plate when wanted; retrieval is proved by a focused fixture. It contributes much less than coffee, the third hand or Dash.
- **Coffee can keep a hand occupied.** A partial pot cannot be put down, and table clearing requires completely empty hands. The bot spends remaining pours on valid low parties; the rule can still delay clearing. No engine rules were changed.
- **Fuel can become comfortable after money gear.** The no-medal ledger demonstrates leg-2 pressure, and actual weak earners push the car, but it is not proof that every medal-free human strategy will go broke. Later geared wallets remain generous.
- **Road atlas is not valued by this local policy.** Its cost is included in maxing the Workshop, but the simulator never uses look-ahead. Different human fork and purchase priorities will change the progression timing.
- **Unupgraded sharp clears are 0/80.** That meets a very low-clear interpretation of “few”, but does not establish a nonzero completion chance without permanent upgrades.
- `docs/diner.md` still describes the old token formula and balance numbers. It is outside the allowed files and was left unchanged; this report is the current measured reference.

## Verification and boundaries

- `node --experimental-strip-types --test tests/diner*.test.mjs`: **53/58 pass**. The five HTTP tests fail before assertions with **`listen EPERM: operation not permitted 127.0.0.1`** (one availability test and four online tests). A read-only rerun through the connected Node runtime gives the same result. This environment has no permitted escalation for local listening, so full green acceptance remains outstanding.
- Including `balance/bot-checks.test.mjs`: **60/65 pass**, with the same five listener failures; all seven new bot checks pass. The renderer disposal failure seen at the start disappeared through concurrent work; no components or tests outside this folder were edited here.
- Scoped strict TypeScript checking, oxlint, and `git diff --check` pass. Only the bot, simulator and added bot checks were formatted with `npx oxfmt`; numeric-only files retain their existing formatting.
- Two identical six-run experiments (seeds 20001–20002, all three cohorts) produce byte-identical JSON. `scope-check.json` confirms only **11 numeric literals in campaign.ts, 17 in campaign-content.ts and 3 in road.ts** changed, all in the permitted constants/functions. Engine, content and layout hashes match the starting snapshot.
- Scope classified as **small gameplay-rule/balance work**, with a CLI analysis tool. Browser QA was skipped by size. No visual, browser, touch, device-performance or human-playtest acceptance is claimed.

No git stash, checkout, reset, commit or push was run. Existing work outside the allowlist was preserved.
