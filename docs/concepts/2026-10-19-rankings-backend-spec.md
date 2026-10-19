# Rankings backend spec (Codex recommendation, 19 October 2026)

As built (19 October 2026), differing from the spec below: rankings are keyed by player id (guest or account) instead of a principals table, public once the id has an account; a v8 migration rebuilds `tables` without its owner foreign key; guests are created by POST /api/guest before a rated launch; a guest login moves runs and solo rooms (and their command receipts) to the account and removes rated rooms settled by a clash. One unfinished rated (Elo) game or Rota town alone per game; Puzzles and Lucky keep several runs. GET /api/solo/ranked lists only table and Rota rated runs. /api/leaderboards/me lists only boards with a record, [] without a session. Entries always carry a string userId (an opaque id for a guest's private line). /api/leaderboards/result supports /table/, /rota/, /folio/ and /expedition/, 404 when not rated, 409 while unfinished, and adds runValue.

# 1. Verdict

**Recommendation:** keep automatic server recording, guest play, and one view per game or score category. Change the identity and result model before implementation.

- **Do not use a higher K for the first games.** Guests can create fresh identities, and the branch does not verify email addresses. A provisional boost makes identity resets move ratings faster. Use a fixed K of 32; the simulation below shows it still moves a 100 point difference in roughly 16–27 matches.
- **Keep one rating per game, but don’t treat every setup as equally calibrated.** Seat count normalization handles the number of opponents; it does not compensate for Hard AI being stronger or weaker under different extensions. Keep one public rating, and store a server-side opponent-strength offset per ruleset when calibrated. Start at 0 only as an explicit assumption.
- **Make “forfeit” scope precise.** For Nox, Mora, Yata, and multiplayer Rota, treat an abandoned or replaced match as last place against every bot. For Rota solo, Puzzles, and Lucky, an unfinished run has no score to count: mark it abandoned and exclude it.
- **Add Lucky and Puzzles to the result and abandon URL contract.** The proposed URL list omits Lucky’s `/expedition/<token>` desk. Also make result fields metric-neutral: `before`/`after` describe the rating or best record; add `runValue` so the result can show the latest run’s score even when it did not set a record.
- **Use a stable principal identity.** Do not create fake rows in `users` for guests. Make table ownership and leaderboard data point to a principal that can represent either a guest or an account.

The checkout is heavily dirty, including the account and leaderboard files in scope and unrelated Rota/Alto work. I left it untouched. Current v7 makes leaderboard runs and records reference `users`; table ownership also references `users`. Ranked launch rejects guests; Folio and Lucky start leaderboard runs only when `who.userId` exists. Guest signup keeps the guest ID, while login to an existing account replaces the session identity without merging guest results. These are visible in [server/database.ts:102](/Users/williamguinaudie/Documents/code/gamehub/server/database.ts:102), [server/index.ts:404](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts:404), [server/folio.ts:281](/Users/williamguinaudie/Documents/code/gamehub/server/folio.ts:281), [server/expeditions.ts:190](/Users/williamguinaudie/Documents/code/gamehub/server/expeditions.ts:190), and [server/index.ts:713](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts:713).

# 2. Schema

Use `leaderboard_principals` as the canonical owner for rankings and private rated rooms. Keep `Identity.id` as the actor ID used by game seats; add `Identity.principalId` for ownership and results. `guest_principals` maps each guest actor to a principal. A guest signing up promotes its existing principal; logging into an existing account moves that guest mapping to the account principal.

Replace the v7 `leaderboard_boards`, `leaderboard_runs`, and `leaderboard_records` definitions. Rebuild `tables` because its current `owner` FK points to `users`; rebuild `commands` with it so the table token FK remains valid. Preserve users, guests, sessions, commands, and existing tables. Keep `account_recovery`.

The following is the schema for a v6-to-v7 migration. Principal IDs use `u:<user id>` and `g:<guest id>`.

```sql
CREATE TABLE leaderboard_principals (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE guest_principals (
  guest_id TEXT PRIMARY KEY REFERENCES guests(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX guest_principals_principal
  ON guest_principals(principal_id);

INSERT INTO leaderboard_principals (id, user_id, name, created_at)
SELECT 'u:' || id, id, name, 0 FROM users;

INSERT INTO leaderboard_principals (id, user_id, name, created_at)
SELECT 'g:' || g.id, NULL, g.name, 0
FROM guests AS g
LEFT JOIN users AS u ON u.id = g.id
WHERE u.id IS NULL;

INSERT INTO guest_principals (guest_id, principal_id, created_at)
SELECT g.id,
       CASE WHEN u.id IS NULL THEN 'g:' || g.id ELSE 'u:' || u.id END,
       0
FROM guests AS g
LEFT JOIN users AS u ON u.id = g.id;

CREATE TABLE tables_v7 (
  token TEXT PRIMARY KEY,
  owner TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  state TEXT NOT NULL
);

CREATE TABLE commands_v7 (
  table_token TEXT NOT NULL
    REFERENCES tables_v7(token) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  request_id TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY(table_token, actor, request_id)
);

INSERT INTO tables_v7 (token, owner, state)
SELECT token, 'u:' || owner, state FROM tables;

INSERT INTO commands_v7 (table_token, actor, request_id, body)
SELECT table_token, actor, request_id, body FROM commands;

DROP TABLE commands;
DROP TABLE tables;
ALTER TABLE tables_v7 RENAME TO tables;
ALTER TABLE commands_v7 RENAME TO commands;
CREATE INDEX tables_owner ON tables(owner);

CREATE TABLE account_recovery (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE leaderboard_boards (
  key TEXT PRIMARY KEY,
  game_id TEXT NOT NULL
    CHECK(game_id IN ('undertow','wildgrove','midnight','rota','folio','relic')),
  view_key TEXT NOT NULL,
  label TEXT NOT NULL,
  metric TEXT NOT NULL
    CHECK(metric IN ('rating','score','puzzles','progress')),
  unit TEXT NOT NULL,
  UNIQUE(game_id, view_key)
);

CREATE TABLE leaderboard_runs (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  board_key TEXT NOT NULL REFERENCES leaderboard_boards(key),
  room_kind TEXT NOT NULL
    CHECK(room_kind IN ('table','rota','folio','expedition')),
  room_token TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK(status IN ('active','finished','forfeit','abandoned','disqualified')),
  counted INTEGER NOT NULL DEFAULT 0 CHECK(counted IN (0,1)),
  value INTEGER,
  won INTEGER NOT NULL DEFAULT 0 CHECK(won IN (0,1)),
  outcome_json TEXT,
  rating_before INTEGER,
  rating_after INTEGER,
  rating_delta INTEGER,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE UNIQUE INDEX leaderboard_runs_one_active_game
  ON leaderboard_runs(principal_id, game_id)
  WHERE status = 'active';

CREATE INDEX leaderboard_runs_room
  ON leaderboard_runs(principal_id, room_kind, room_token, finished_at DESC);

CREATE INDEX leaderboard_runs_history
  ON leaderboard_runs(principal_id, game_id, finished_at, id);

CREATE TABLE leaderboard_ratings (
  principal_id TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL
    CHECK(game_id IN ('undertow','wildgrove','midnight','rota')),
  rating INTEGER NOT NULL DEFAULT 1000,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(principal_id, game_id)
);

CREATE INDEX leaderboard_ratings_public
  ON leaderboard_ratings(game_id, rating DESC, updated_at);

CREATE TABLE leaderboard_stats (
  board_key TEXT NOT NULL REFERENCES leaderboard_boards(key) ON DELETE CASCADE,
  principal_id TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  games INTEGER NOT NULL DEFAULT 0 CHECK(games >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK(wins >= 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK(streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK(best_streak >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(board_key, principal_id),
  CHECK(wins <= games),
  CHECK(streak <= games),
  CHECK(best_streak <= games)
);

CREATE TABLE leaderboard_records (
  board_key TEXT NOT NULL REFERENCES leaderboard_boards(key) ON DELETE CASCADE,
  principal_id TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(board_key, principal_id)
);

CREATE INDEX leaderboard_records_value
  ON leaderboard_records(board_key, value DESC, updated_at);

CREATE TABLE leaderboard_launches (
  principal_id TEXT NOT NULL
    REFERENCES leaderboard_principals(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  room_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(principal_id, request_id)
);

CREATE INDEX leaderboard_launches_age
  ON leaderboard_launches(created_at);
```

Seed 11 views from `lib/games/leaderboards.ts`: one rating view for each of Nox, Mora, and Yata; Rota rating plus one score view per current map; three Puzzles difficulty views; and one Lucky progress view.

**Migration caveat:** the rewritten v7 migration will run for production v6 databases. If local databases already have the branch’s old v7 layout, do not silently open them as the new schema. Add a one-time compatibility migration from that unreleased v7 layout, or require a deliberate local database reset.

# 3. Rating

Use final placement, not raw point differences. For each AI seat `i`, set `Sᵢ` to `1` if the player placed above it, `0.5` for a tie, and `0` if below. Nox’s low-score-wins direction and Rota’s loose-end tiebreak must come from the server’s game outcome logic; Rota currently resolves placement using `total * 1000 + errors` in [lib/games/rota/engine.ts:466](/Users/williamguinaudie/Documents/code/gamehub/lib/games/rota/engine.ts:466).

With player rating `R`, AI rating `1000`, and `m = n - 1` AI seats:

```text
E = 1 / (1 + 10^((1000 - R) / 400))
delta = round((32 / sqrt(m)) * sum(Sᵢ - E))
R' = R + delta
```

Use **K = 32 from the first match**, ties score 0.5, and **no rating floor**. Do not boost new accounts: a fixed K makes guest-to-account replay deterministic and avoids rewarding fresh identities. Count forfeits as a played rating loss; AI failures are disqualified and do not alter rating or stats, preserving the current server-AI-failure rule in [server/leaderboards.ts:256](/Users/williamguinaudie/Documents/code/gamehub/server/leaderboards.ts:256).

I ran a seeded inline Node Monte Carlo simulation, without writing files. Assumptions: per-opponent expected score is 0.35, 0.50, or 0.65; ties occur 10% of the time, so the respective win/tie/loss probabilities are 30/10/60%, 45/10/45%, and 60/10/30%. Comparisons were sampled independently. The table shows expected first-match drift from rating 1000 and simulated games to move 100 points.

| Total seats n | Initial drift at 0.35 / 0.50 / 0.65 | Equilibrium for 0.35 / 0.50 / 0.65 | Median / mean matches to move 100 points |
|---:|---:|---:|---:|
| 2 | −4.8 / 0 / +4.8 | 892.5 / 1000 / 1107.5 | 27 / 33 |
| 3 | −6.8 / 0 / +6.8 | 892.5 / 1000 / 1107.5 | 22 / 26 |
| 4 | −8.3 / 0 / +8.3 | 892.5 / 1000 / 1107.5 | 19 / 22.5 |
| 5 | −9.6 / 0 / +9.6 | 892.5 / 1000 / 1107.5 | 17 / 20 |
| 6 | −10.7 / 0 / +10.7 | 892.5 / 1000 / 1107.5 | 16 / 18.5 |

Equilibrium follows `1000 + 400 * log10(p / (1-p))`. These are **per-opponent placement scores**, not outright match win rates. Real placement comparisons are correlated, so actual volatility may differ from the simulation. A per-ruleset AI offset, if introduced, changes `1000` in the expectation calculation but does not create more public boards.

# 4. Guest ownership approach

Use a principal row for each account or unlinked guest, plus `guest_principals` mappings. An account can own multiple guest aliases after login merge. Keep sessions’ existing `user_id` and `guest_id` columns; when logging a guest into an existing account, issue a session containing both the account ID and the guest actor ID. `identity()` should resolve the canonical principal through the guest mapping, set `userId` from that principal, and retain the guest actor as `Identity.id` for the current room. Add `Identity.principalId` for leaderboard and ownership checks.

Change the SQL `tables.owner` column to reference `leaderboard_principals`. Keep `StoredTable.owner` as the actor ID used by game logic; use the SQL owner principal for ownership, listing, and deletion. Add `ownerPrincipalId` to ranked Rota room state. Folio and Lucky have no SQL owner FK today; their leaderboard runs should use principal IDs, and their room managers should authorize a guest actor alias through the owning principal.

This is cleaner than provisional user rows: current account/profile/session code treats `users` as authenticated accounts, and public boards join user records for names. An arbitrary string owner without an FK would make cleanup and account deletion unreliable. Current `Tables.create()` explicitly requires a user, while Rota stores its owner in room state; both need principal-aware ownership [server/tables.ts:389](/Users/williamguinaudie/Documents/code/gamehub/server/tables.ts:389), [server/rota.ts:161](/Users/williamguinaudie/Documents/code/gamehub/server/rota.ts:161).

# 5. Guest → signup and guest → login behaviour

**Signup from the current guest:** create the user, promote that guest’s principal by setting `user_id`, preserve the guest mapping, and immediately publish its eligible records. Revoke old guest sessions for that actor before linking so a stale guest cookie does not silently become an account session; then issue the new account cookie while retaining the current actor ID. The current signup already reuses `who.id` and preserves guest-owned Puzzles access, so this extends the existing behavior [server/index.ts:721](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts:721), [tests/accounts.test.mjs:50](/Users/williamguinaudie/Documents/code/gamehub/tests/accounts.test.mjs:50).

**Login to an existing account from a guest:** merge the guest principal’s eligible run history into the account principal in one `BEGIN IMMEDIATE` transaction.

1. Replay counted rating runs from both principals sorted by `finished_at`, then run ID. Recompute every rating snapshot, stats row, and best record; do not average two ratings.
2. Move guest aliases and completed run ownership to the account principal. Repeated merges become no-ops because the guest mapping already points to that account.
3. If only the guest has an active run for a game, move that run’s principal ownership and room owner principal to the account. Keep the guest actor ID so its current session can continue; room managers must also resolve the owner actor for other account sessions.
4. If both principals have an active run for the same game, retain the account’s run. Settle the guest match as a last-place forfeit, or abandon a non-Elo score/progress run, then close its private room.
5. Revoke guest sessions before remapping guest aliases; issue one new account session carrying the current guest actor alias. This avoids elevating stale guest cookies. Serialize concurrent merges with `BEGIN IMMEDIATE`; the second request sees the completed mapping and does not replay records twice.
6. On account deletion, remove every guest alias linked to the principal, along with its guest sessions and principal-owned results. Preserve the existing shared-game anonymization behavior.

# 6. Endpoints

Use JSON errors with a stable code while preserving the current string `error` for compatibility:

```json
{ "error": "Human-readable message.", "code": "REQUEST_ID_REUSED" }
```

Add a `code` to `HttpError`; the current handler only emits a message in [server/index.ts:972](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts:972).

`Entry` should be:

```ts
type Entry = {
  rank: number;
  userId: string | null; // null for a guest's private personal entry
  name: string;
  value: number;
  games: number;
  wins: number;
  streak: number;
  bestStreak: number;
  updatedAt: number;
};
```

| Endpoint | Auth | Request and response | Errors |
|---|---|---|---|
| `POST /api/solo/ranked` | Optional; create guest session if absent | Request is launch settings plus required `requestId` and optional `name`. Return `201 {url}`; return `200 {url}` for an identical retry. | `400 INVALID_LAUNCH` / `INVALID_NAME` / `INVALID_REQUEST_ID`; `409 REQUEST_ID_REUSED`; `429 RATE_LIMITED`; `500 INTERNAL`. |
| `GET /api/solo/ranked` | Optional; no session returns `[]` | `[{gameId,url,label,round,rounds,startedAt}]`; allow `round` and `rounds` to be `null` for dynamic progress. Include table, Rota, Folio, and Lucky runs. | `500 INTERNAL`. |
| `POST /api/solo/ranked/abandon` | Guest or account session | `{url}` → `{abandoned:true}`. Owner-only and idempotent. Support `/table/`, `/rota/`, `/folio/`, and `/expedition/` URLs. | `400 INVALID_URL`; `401 AUTH_REQUIRED`; `404 NOT_RATED` (also for another owner); `409 RUN_ALREADY_FINISHED`; `429 RATE_LIMITED`. |
| `GET /api/leaderboards` | Public; optional session for `personal` | Without `game`, preserve the catalog response. With `?game=<id>&view=<key>` return `{game,views:[{key,label,metric,unit}],selectedView,entries,personal,total}`. `entries` is the public top 50; `personal` is the caller’s entry plus `public:boolean`, or `null`. | `400 INVALID_GAME` / `INVALID_VIEW`; `500 INTERNAL`. |
| `GET /api/leaderboards/me` | Guest or account session | Return one row per view: `[{gameId,view,label,metric,unit,value,rank,total,games,wins,streak,bestStreak,public}]`. Rating views default to value `1000`; other views default to `0`. `rank` can be `null` without a record. | `401 AUTH_REQUIRED`; `500 INTERNAL`. |
| `GET /api/leaderboards/result?url=...` | Guest or account session | Latest finished run for that room: `{gameId,view,metric,unit,before,after,delta,runValue,rank,previousRank,total,public,streak,bestStreak,newBest,counted,reason?}`. For rating, `delta=after-before`; for best-score views, `before`/`after` are prior/new best and `runValue` is this run’s score. Include `/expedition/<token>` for Lucky. | `400 INVALID_URL`; `401 AUTH_REQUIRED`; `404 NOT_RATED` / `NO_RESULT`; `409 RUN_NOT_FINISHED`; `500 INTERNAL`. |
| `POST /api/auth/signup` | Optional guest session | Existing `{name,email,password}`; response remains `{ok:true,recoveryCode}` with account cookie. Guest principal is promoted. | Preserve current `400`, `409 ACCOUNT_EXISTS`, and rate-limit behavior. |
| `POST /api/auth/login` | Optional guest session | Existing `{email,password}`; `{ok:true}` with account cookie. Merge guest records and retain the guest actor alias. | Preserve `400`, `401 INVALID_CREDENTIALS`, and rate-limit behavior. |

For the ranked launch request, keep trio seats within the game’s supported range and require Hard AI. Rota multiplayer requires Hard AI; **Rota with one seat must not require `difficulty:"hard"`** because there is no bot. Update `RankedSoloLaunch` accordingly. The client should launch every qualifying Hard match automatically; there is no Casual/Ranked request field.

For every account and guest run creation path, accept optional `name` and `requestId`; if no session exists, create a guest named `Guest` when no name was supplied. The existing Folio and Expedition routes currently require a name to create a guest session [server/index.ts:503](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts:503), [server/index.ts:527](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts:527).

# 7. Rota solo / Puzzles / Lucky boards

- **Rota multiplayer:** one `rating` view for the game across seats, maps, and extensions. Only multiplayer Hard-AI runs update it. Seat count affects the number of pairwise comparisons, not the view.
- **Rota solo:** one score view per current map: Meadow, Harbour, and Ridge. Do not split by extension. Raw Rota totals include direct extension bonuses: Rivers adds river points, Towns adds points, and Plans adds plan bonuses [lib/games/rota/score.ts:283](/Users/williamguinaudie/Documents/code/gamehub/lib/games/rota/score.ts:283), [lib/games/rota/score.ts:315](/Users/williamguinaudie/Documents/code/gamehub/lib/games/rota/score.ts:315). To keep one board per map, rank a normalized core score: `exits + road + rail + centre + errors + tunnels`; omit the direct `river`, `towns`, and `plans` components. Keep the actual displayed total in `runValue`/room results and store the extension settings for audit. This still assumes indirect effects of extensions on placement do not dominate score differences. The current new-map list is exactly Meadow, Harbour, and Ridge [lib/games/rota/maps.ts:8](/Users/williamguinaudie/Documents/code/gamehub/lib/games/rota/maps.ts:8).
- **Puzzles:** exactly three views, keyed by the run’s starting difficulty. On completion, record `game.path.filter(step => step.won).length`. Count only new solo non-practice runs; increment `wins` when the whole run is a victory. A failed finished run has zero or more puzzles solved and resets its view’s win streak.
- **Lucky:** one progress view. Record the maximum sum of `max(0, bookLevel(book) - 1)` across unlocked books for one eligible solo desk. A guest desk is eligible. If a second player joins or development assistance is used, disqualify the desk and remove its contribution. The current calculation already uses this sum and disqualifies shared/dev desks [server/leaderboards.ts:312](/Users/williamguinaudie/Documents/code/gamehub/server/leaderboards.ts:312).

Stats are scoped to the selected view. Rating views count multiplayer rated matches; each Rota score view counts runs on that map; Puzzles stats are per starting difficulty. Lucky and Rota score views have `wins/streak/bestStreak = 0`, since those views have no win/loss outcome.

# 8. Code changes file by file

- [server/database.ts](/Users/williamguinaudie/Documents/code/gamehub/server/database.ts): rewrite v7 as above; seed the 11 views; rebuild `tables` and `commands`; preserve account, guest, session, and room data.
- [server/auth.ts](/Users/williamguinaudie/Documents/code/gamehub/server/auth.ts): add `principalId` to `Identity`; resolve guest aliases and account names; allow a session to carry both account identity and guest actor identity; change `newSession()` to use named columns.
- [server/accounts.ts](/Users/williamguinaudie/Documents/code/gamehub/server/accounts.ts): promote guest principal on signup; add transactional guest-to-account merge/replay; delete linked guest aliases and results on account deletion.
- [server/leaderboards.ts](/Users/williamguinaudie/Documents/code/gamehub/server/leaderboards.ts): replace division keys with view keys; implement Elo and game-scoped stats; write outcome vectors and snapshots once; add guest-private personal rows, merge replay, result lookup, and cross-setup active-run replacement.
- [server/index.ts](/Users/williamguinaudie/Documents/code/gamehub/server/index.ts): change ranked launch to allow/create guests; use principal ownership; implement `/api/leaderboards/me` and `/api/leaderboards/result`; expand abandon; add stable error codes; ensure ranked start, prior forfeit, room creation, and idempotency record are atomic.
- [server/tables.ts](/Users/williamguinaudie/Documents/code/gamehub/server/tables.ts): permit private ranked-table creation for a guest; store principal ownership in SQL while retaining actor IDs in game state; update `Tables.create`, `save`, `transfer`, and ranked access checks. `save()` already calls `observeTable()` [server/tables.ts:323](/Users/williamguinaudie/Documents/code/gamehub/server/tables.ts:323).
- [server/rota.ts](/Users/williamguinaudie/Documents/code/gamehub/server/rota.ts): persist `ownerPrincipalId`; support guest solo launch, account aliases, ranked result lookup, and cross-setup replacement.
- [server/folio.ts](/Users/williamguinaudie/Documents/code/gamehub/server/folio.ts): enroll every new solo non-practice run, including guests; enforce one active Puzzles run per principal; add run-creation idempotency.
- [server/expeditions.ts](/Users/williamguinaudie/Documents/code/gamehub/server/expeditions.ts): enroll eligible guest solo desks; enforce one active Lucky desk; retain existing shared/dev disqualification.
- [lib/games/leaderboards.ts](/Users/williamguinaudie/Documents/code/gamehub/lib/games/leaderboards.ts): define `rating | score | puzzles | progress`, view catalog, and response types. Remove current `streak` metric as a board metric.
- [lib/online/ranked-solo.ts](/Users/williamguinaudie/Documents/code/gamehub/lib/online/ranked-solo.ts): contract only: remove mode choice from launch payload, make `requestId` required, support optional guest name, and allow one-seat Rota without Hard difficulty. Leave UI components to Claude.
- [lib/online/types.ts](/Users/williamguinaudie/Documents/code/gamehub/lib/online/types.ts): preserve `rankedSolo:true` on all rated server rooms.
- [docs/DESIGN.md](/Users/williamguinaudie/Documents/code/gamehub/docs/DESIGN.md): replace the 17 October section with the automatic guest-inclusive policy, single rating views, forfeit rules, and new board definitions.
- [tests/leaderboards.test.mjs](/Users/williamguinaudie/Documents/code/gamehub/tests/leaderboards.test.mjs), [tests/accounts.test.mjs](/Users/williamguinaudie/Documents/code/gamehub/tests/accounts.test.mjs), and [tests/ranked-http.test.mjs](/Users/williamguinaudie/Documents/code/gamehub/tests/ranked-http.test.mjs): replace account-only expectations and add the cases in section 10.

# 9. Anti-abuse limits

- Enforce one active run per principal and game with the partial unique index. There are at most six active rated games per identity; starting another setup for the same game settles or abandons the prior run first.
- Require a 16–80 character `requestId`; same ID and same normalized payload returns the existing room; same ID with different settings returns `409 REQUEST_ID_REUSED`. Keep launch receipts for 30 days, capped at 100 per principal.
- Rate-limit launch to 12/minute per principal, plus a per-IP ceiling; rate-limit guest creation to the existing 30 per 15 minutes per IP or lower. Apply the same controls to Folio/Lucky auto-enrollment.
- Never accept client scores or outcomes. Require a server-created run, valid terminal engine state, expected seats, server-generated seed, and server-computed placement. Preserve AI-failure disqualification. Use legal move/round completion as the integrity floor; do not add a wall-clock minimum that can reject legitimate fast play.
- Guest results stay private until linked to an account, so creating guest IDs alone cannot improve the public standings. Rate-limit signup and alias merges as well. **Limitation:** because signup does not verify email today, no backend rate limit can fully stop someone creating multiple public accounts; immediate publication on signup accepts that residual risk.

# 10. Test plan

**`tests/leaderboards.test.mjs`**

- Replace division-key tests with the exact 11-view catalog and verify extensions/seats do not create extra views.
- Test Elo math at 2, 3, and 6 total seats: win, loss, tie, mixed placement, rating above/below 1000, one rounded delta per match, no floor, and K=32 from match one.
- Test low-score Nox outcome ordering and Rota’s total-plus-loose-end ordering; test bot failure disqualification leaves rating and stats unchanged.
- Test Nox/Mora/Yata and multiplayer Rota all update one rating per game across different setups.
- Test cross-setup replacement forfeits the previous active Elo match once; retrying launch does not forfeit again.
- Test Rota solo writes a normalized best score to the correct map only, with extensions sharing that view; do not include direct Rivers/Towns/Plans bonus fields.
- Test Puzzles records solved nodes on the starting-difficulty view, excludes practice/shared runs, and increments wins only on a full victory.
- Test Lucky guest solo progress, max-per-desk comparison, shared/dev disqualification, and no residual record after disqualification.
- Test games/wins/current streak/best streak per view, including ties, losses, forfeits, and non-win metrics.
- Test hidden guest records, provisional would-be rank against public rows, public account ranking, shared tie rank, top 50, and total count.
- Test guest-run merge replay is chronological and repeat merge is idempotent; test conflicting active runs and room ownership transfer.
- Rewrite the v6 migration test to preserve existing users, guest sessions, tables, and commands while creating the new principal/schema and reopening successfully.

**`tests/accounts.test.mjs`**

- Launch a rated game without a session and without a name; verify a `Guest` cookie, provisional rating, and hidden public entry.
- Signup from that guest; verify the same principal/results become public immediately and the account name is shown.
- Login to an existing account from a guest; verify completed history replays with the account’s prior history, guest aliases resolve to the account, and the current actor can resume a non-conflicting active room.
- Test same-game active conflict: account run remains active; guest Elo match becomes one forfeit, and guest score/progress run is abandoned.
- Test concurrent guest-to-account logins and repeat merge; assert only one replay and no duplicate rating updates.
- Test revocation of old guest sessions during signup/login and ensure an old guest cookie cannot act as the account.
- Test account deletion removes leaderboard rows, launch receipts, guest aliases, and guest sessions linked to the account while preserving shared-game anonymization.
- Test stable API error codes and guest creation/launch rate limits.

No repository files were edited and no test suites were run; the requested rating simulation was run inline with Node. The current behavior references above come from the inspected dirty checkout.
