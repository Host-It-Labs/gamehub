# Top Tier, Outfox the Fox and Hot Streak

Replaces Roka, Talo and Soma. Existing storage/lobby IDs `orin`, `vela`, `miro` stay stable; `rules: 3` rejects their retired saves. Nox, Mora and Yata are unchanged by this replacement.

## Reference research

- [Top Tier — Indie Boards & Cards, 2024 listing](https://www.boardgameoracle.com/boardgame/price/QLKp4gs4pX/top-tier). The product description confirms choosing a topic, ranking five contributed items in S/A/B/C/D, and others predicting the ranking. This implementation follows the requested variant: all topics and answers are supplied; everyone prepares concurrently; teams guess every player's list.
- [Outfox the Fox — The Family Gamers rules review](https://www.thefamilygamers.com/outfox-the-fox/). Top-five lists, a sixth fake answer, team guesses, confidence marker, and positional bluff scoring. This implementation deliberately uses personal preference lists rather than factual/survey lists, to match the request for simultaneous personal ranking. The sixth prepared answer is whichever the player leaves out. No invented survey results.
- [Hot Streak — CMYK](https://www.cmyk.games/products/hot-streak), [rules overview — Board Game Quest](https://www.boardgamequest.com/hot-streak-review/). The loop is inspect public deck → snake-draft bets → privately add cards → bury three cards → automatic chaotic race → payout, across three races. This is an original digital adaptation, not a claim of card-for-card fidelity: original characters/cards, explicit simplified ticket payouts, four lanes, bounded race duration and deterministic photo-finish ties. Full implemented rules are in the in-game help.

## Ranking games

116 hand-authored original topics, eight categories, six distinct answers per topic. Each player receives three different topics, without replacement across a match. No typing or runtime AI service is needed. Top Tier uses five answers, exactly one per tier. Outfox ranks five of six and leaves a decoy in Fox. Topics avoid national trivia, brands and celebrity knowledge; universal cultural neutrality is not presumed or claimed.

Two or four or six seats; alternating Sun/Moon teams. At two seats the players compete individually. Everyone chooses and locks privately. Each list is then guessed by both teams, excluding its owner. Team drafts are shared only with that team, excluding the owner; a rotating captain locks them. The owner receives no team drafts. Reveals happen atomically after every eligible team locks. Unlock is available only before resolution. Everyone acknowledges the reveal. Two rounds, every player targeted once per round. Ties are shared wins.

Top Tier: one point per exact tier, +2 for all five. Outfox: one per exact top-five position, +3 for an exact confidence row (including Fox). Owner's team gets 5/4/4/3/3 points for opposing-team decoy placement in positions 1–5; zero if caught. No bluff points from its own team's guess.

Solo bots are explicitly practice opponents. They use only the same redacted view a player receives, and do not claim to predict personal preferences. Human teams communicate out of band; their ordered draft is shared in the app. No chat service was added.

## Race

Server-owned 3.4-second start pause and 900ms card clock, independent of bot participation. Offline uses the same deterministic step engine. Late join/reconnect receives current positions, never the future deck or buried cards. Startup reschedules active tables. Three races, rotating first drafter, two tickets each in snake order. Secret card insertion resolves in seat order so submission timing does not affect the shuffled race. Chips are fictional score, never real money.

Race imagery uses the original comet/lemon/cloud/star atlas. Countdown, running bounce, lane movement, falls, reverse direction, crowd motion and finish confetti are CSS effects over authoritative positions. Reduced motion disables spatial animations. Muted cues do not start audio. Retired adventure ambience is no longer registered.

## Artwork

Fresh raster generation was delegated as required. Native PNG and optimized WebP siblings and exact prompts are retained here and under `public/art`. The atlas is genuinely transparent; four complete silhouettes fit their 2×2 cells. The stricter middle-70% padding request was not achieved. Covers are 1024×1536; requested central-80% margins were not achieved. Full-cover contain rendering preserves the supplied compositions; no claim of exact prompt geometry acceptance. Generated images were visually reviewed; browser-rendered screens were not.

## Validation

Focused engine and SQLite online tests cover complete games at every seat count, deterministic transitions, permutation validation, atomic simultaneous actions, privacy including spectators and list owners, team captain authority, confidence/bluff scoring, undo limits, ready acknowledgements, secret race hands/decks, snake draft, collisions, save migration and practice isolation. Further whole-project checks are recorded in the task result. Browser, touch and live production acceptance are separate and were not performed.

Final local checks: `npm run typecheck`, `npm run lint`, all 161 tests, and `npm run build` passed. The HTTP/SSE test runs with bots disabled and two human sessions, verifies redacted views, practice-to-match reset, automatic race clock, and equal positions on reconnect. Build and HTTP tests required normal local socket permission outside the filesystem sandbox. No browser/computer-use tools were used. No commit, push or deployment was performed.
