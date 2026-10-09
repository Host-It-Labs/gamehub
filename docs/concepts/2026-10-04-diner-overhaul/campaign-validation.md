# Diner campaign: design and validation

The solo campaign has **18 shifts across six districts**, with a boss every third shift. Non-boss shifts last 150 seconds in Roadside and 165 elsewhere; bosses last 180. One complete campaign is 50 minutes 30 seconds of active play, before route and equipment choices. Every shift has two seeded branches that alter real rules; each win offers three equipment or supply choices. Free play and online co-op keep their existing three-night rules.

Progress introduces pie in Midtown, fries in Fairground, demanding guests, machine jams, brownouts, outfit mimics, rush waves and floor spills. The final boss combines them. Normal walking remains **4.2 units/second** and uses the existing Space/Use controls; equipment changes only goo's slow effect.

| District | Boss | Additional win requirement |
| --- | --- | --- |
| Roadside | Last Bus | Serve at least 6 guests |
| Midtown | Broken Down | Repair at least 2 jams |
| Fairground | The Critic | Serve at least 4 demanding guests |
| Docks | Blackout | Keep 2 stars and burn at most 2 plates |
| Old Town | Copycat Crew | Catch at least 3 mimics |
| Moon Mile | Midnight Feast | Serve at least 12 guests and keep 2 stars |

Revenue also matters. The first-cycle boss targets are 106, 123, 140, 157, 174 and 191 coins. `shiftGoal` and `campaignShiftWon` use these engine requirements, so a medal alone cannot win a boss.

There are **30 pieces of equipment**, plus **three repeatable supplies** lasting one shift. All affect the simulation: timers, queues, orders, cooking, dirty dishes, cash collection, mimics, tips, service chains or hazards. Supplies remain visible in `Match.config.supplies` after their pending inventory is consumed. Auto Restock starts another batch only when outstanding orders exceed the matching fresh plates already carried; it does not endlessly cook unwanted food. This avoids making the Blackout boss an unfair trap for players who picked automation.

The permanent workshop has **13 nodes and 28 ranks**, costing 2,365 tokens in total. Prerequisites, costs and maximum ranks are enforced. Purchases apply to future runs; each run holds its starting upgrade snapshot. Each completed shift banks rewards once, and failure banks its takings at one token per 15 coins. Already banked tokens stay earned. Finishing shift 18 offers a clean finish or overtime: another seeded circuit with higher revenue goals, quicker arrivals, less patience and earlier threats.

The campaign's local save uses one `gamehub.diner.campaign.v2` envelope for wallet and run. Checkpoints retain guest paths, waiter trails, RNG, carry, repairs, timers and supply effects. Settlement checks run/stage/branch identity and rejects repeated results and regressive checkpoints. Free-play medals use their separate v1 key. A malformed active match cannot erase an otherwise validated workshop profile. Quota or blocked-storage failures return `persisted: false`; that session continues in memory without claiming a durable save.

## Evidence

The focused tests cover deterministic resume, real repairs while carrying food, power timing, rush arrivals, demanding guests, chain rewards, automatic chores, burn recovery, shields, mimics, all boss conditions, 18-stage progression, overtime, exhausted equipment pools, workshop transactions, stale result isolation, malformed data and storage failures. A regression plays a complete campaign through actual movement and service, using 1.2 seconds of hesitation after every action. Campaign metadata also survives online snapshot packing; the campaign itself remains solo.

The balance runner samples seeds 11, 22, 33, 44, 55, 66, 77, 88, 99 and 111, choosing sensible branches and equipment:

| Profile | Hesitation per action | Full campaigns completed | Banked tokens per campaign |
| --- | --- | --- | --- |
| Fresh workshop | 0.67 seconds | 10 / 10 | 1,025–1,208 |
| Fresh workshop | 1.2 seconds | 10 / 10 | 792–992 |
| All workshop ranks | 1.2 seconds | 10 / 10 | 897–1,120 |

The fresh 1.2-second runs finish Midnight Feast with 3–5 stars and 15–22 guests served, against a requirement of 2 stars and 12 served. Initial goals are intentionally welcoming; late shifts demand managing several mechanics together. The bots know ideal routing and detect mimics from outfit majority without visual hesitation. These traces establish achievability and catch unfair interactions; **they do not establish human difficulty, visual readability, touch usability or browser acceptance**.

Raw results are preserved in [fresh / 0.67s](balance/diner-balance-fresh-20.json), [fresh / 1.2s](balance/diner-balance-fresh-36.json) and [full workshop / 1.2s](balance/diner-balance-veteran-36.json). Reproduce them with:

```sh
node --experimental-strip-types docs/concepts/2026-10-04-diner-overhaul/balance/runner.mjs 20
node --experimental-strip-types docs/concepts/2026-10-04-diner-overhaul/balance/runner.mjs 36
node --experimental-strip-types docs/concepts/2026-10-04-diner-overhaul/balance/runner.mjs 36 --veteran
node --experimental-strip-types --test tests/diner.test.mjs tests/diner-campaign.test.mjs tests/diner-campaign-store.test.mjs
```
