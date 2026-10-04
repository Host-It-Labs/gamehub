# Open source, peer-to-peer play and verified leaderboards

Recorded: **29 September 2026**.

Status: **Planning only.** This records the discussion with the project owner.
No license, networking, recovery or leaderboard implementation has been changed.
The preferred direction is peer-to-peer play with as little shared infrastructure
as practical. Protocols, providers and access policies remain to be selected.

## What the owner wants

- Make Gamehub fully open source and keep the official game free to play.
- Make it “for the people, run by the people.” The owner should not have to fund
  all live-game hosting as usage grows.
- Let people contribute infrastructure without requiring the owner to personally
  investigate and approve every stranger who wants to run a server.
- Prefer players hosting games on their own devices. Avoid requiring a fleet of
  community servers if direct connections can cover the need.
- Support the website and future Google Play and Apple App Store apps.
- Protect hidden cards and fair dealing, including against a dishonest host.
- Have trustworthy official leaderboards and investigate ways to detect farming
  and bots. The owner accepts that outside help, such as AI advice, cannot be
  reliably ruled out.
- Keep explanations to the owner simple, with concrete examples and little jargon.

Tables are primarily live sessions. Some games may be long, but a long-term table
hosting service is not the objective. The owner is considering omitting centrally
stored match backups; this is an open retention/recovery choice, not a decision to
delete existing saves or persistence.

## Current implementation to start from

Checked against the working tree on the recorded date. HEAD was
`44d6c3a490355383527c22975ee5bb1d112cfbf5` on `main`; the checkout also contained
ongoing game/art/audio changes. Reinspect it before implementation.

| Area | Current behavior and useful entry points |
| --- | --- |
| License | [LICENSE](../../LICENSE) and [package.json](../../package.json) use PolyForm Noncommercial 1.0.0. This is source-available with commercial restrictions. |
| Hosting | [Dockerfile](../../Dockerfile) and [compose.yaml](../../compose.yaml) run the frontend/backend together in one Node application, with local SQLite. Current self-hosting guidance specifies one replica. |
| Online tables | [server/index.ts](../../server/index.ts), [server/tables.ts](../../server/tables.ts) and [server/database.ts](../../server/database.ts) provide authoritative online games, persisted table state and SSE updates. The server currently handles moves, shuffling, dice and bots. |
| Authentication | [server/auth.ts](../../server/auth.ts) uses server-side accounts and cookie sessions. [lib/online/client.ts](../../lib/online/client.ts) assumes same-origin requests. This is not a ready-made identity system for arbitrary peers or community hosts. |
| Arena | [server/arena.ts](../../server/arena.ts) advances battles at 30 Hz. [lib/games/arena/net.ts](../../lib/games/arena/net.ts) supports deterministic client simulation, replay, checksums and snapshots. Rooms currently live in memory, so a server restart ends running battles. |
| Other games | Start with [lib/games/trio](../../lib/games/trio), [lib/games/standalone](../../lib/games/standalone), [server/folio.ts](../../server/folio.ts) and [server/expeditions.ts](../../server/expeditions.ts). Inventory each game's private information, randomness, timers and persistent progress. |

Arena's existing FNV checksum detects simulation drift. It is not a cryptographic
signature or proof that a host acted honestly. Existing replay support is a useful
starting point, not an implemented anti-cheat system.

### Arena: real-time play and modified clients

The owner specifically asked whether real-time Arena can remain peer-to-peer while
preventing a modified website/app from changing the opponent's battle. The
assessment below records feasibility and limits, not a chosen implementation.

Arena is a promising candidate because devices already simulate the same battle
from the same card-play inputs. Moving transport/coordination to peers is feasible
in principle. Actual latency, phone performance and network acceptance remain
unmeasured for such a design.

A proposed protection is for each honest device to authenticate incoming moves,
check them against the agreed rules and starting conditions, and calculate damage,
elixir and troop behavior itself. A modified client changing its own troop damage
or granting itself elixir should then affect only its own local view; the opponent
would reject invented state or illegal moves. Signatures identify a sender but do
not make their commands legal. Rules versions and starting conditions need binding
to the match; a peer's version string alone is not proof of its running code.

Today's protocol still trusts the central server's tick sequence and snapshots.
[components/game/arena/online.ts](../../components/game/arena/online.ts) adopts a
server snapshot when reconnecting or recovering from drift. An untrusted host's
snapshot cannot become authoritative merely because two devices disagree. A
peer-to-peer protocol needs authenticated, agreed inputs/checkpoints and explicit
dispute handling; replacing SSE with WebRTC alone would not provide this security.

Timing is the difficult real-time boundary. A hosting player could withhold or
delay an opponent's input, favor their own input order, or stop sending data. Signed
moves and deterministic simulation do not guarantee prompt, fair delivery. Explore
agreed input scheduling, bounded delay and possibly a neutral service for input
ordering/time. Input commitments may help with reacting after seeing another
player's choice, but add exchanges/latency. These are candidates to benchmark, not
promises of seamless play. With two disagreeing players, a bare mismatch or
accusation does not establish who cheated; do not automatically award a ranked win
to the accuser. Ranked verification after the match cannot undo a ruined live game.

There is also an existing information exposure to review: `snapshotFor()` in
`server/arena.ts` uses the full `Match` snapshot, including all players' hands and
deck queues. A modified client can inspect that data even if the UI does not show
it. If opponent hands/order are intended to be secret, preventing inspection
requires a different disclosure/dealing design; moving to peer-to-peer does not
fix it. Inventory randomness and other private state as well.

Peer checks can reject forged gameplay, but cannot force a hostile player to stay
connected or cooperate. A trusted neutral referee provides stronger live timing
authority at a shared-service cost. Whether Arena ranked play needs such a referee,
and whether it runs the simulation or only coordinates authenticated inputs,
remains open. Neither arrangement promises to eliminate bots, collusion or outside
help. No Arena game code was changed as part of this investigation.

## Licensing and mobile distribution

The open-source goal is agreed; the replacement license is **not selected**.
Apache-2.0 was suggested as one possible option, not adopted. A fully open-source
license must allow commercial use. Keeping the official service free is a separate
product policy; it does not prevent others from charging for their own offerings.

Before relicensing, establish the rights to release the code, artwork, music,
sounds and other bundled content. Third-party licenses still apply.
[docs/ORIGINALITY.md](../ORIGINALITY.md) is an entry point, but its asset descriptions
are older than the current art/audio work and are not a complete clearance audit.

Community hosting and peer-to-peer networking appear compatible with mobile app
distribution in principle. This is a policy assessment, not guaranteed store
approval. The proposed official client would obtain game data from peers/relays;
unknown volunteers would not supply executable client code. Privacy, security,
user-content moderation and app-update requirements still apply. Recheck the
stores' current rules when building the apps.

## How the networking discussion evolved

The first option discussed was a directory that assigns each new table to a
community server, with everyone in that table connecting to the same server.
“Automatic placement” meant choosing that server for players without asking them
to choose one. “Approved servers” meant operators trusted enough for that default
assignment pool.

The owner does not want personal vetting of arbitrary operators to be the basis of
the network. A server running today's full authoritative backend can inspect
hidden hands, manipulate state/results, collect connection information or stop a
game. Open-source code does not prove that a remote operator is running that code.
Backups address outages; they do not make a dishonest referee trustworthy.

The discussion therefore moved toward **player-hosted games**, with direct
connections where possible and a limited role for any shared servers. A chosen
player's device could coordinate a table, in the host arrangement the owner
compared to older multiplayer games. This is the preferred direction to explore,
not a completed choice of protocol or authority model for every game.

### Connections and the remaining server roles

Direct connections can fail because of restrictive routers, shared-address mobile
networks or workplace/hotel firewalls. Being behind a router does not automatically
mean failure; the actual network behavior matters.

- An **introduction service** helps peers exchange the information needed to
  connect. This is usually called signaling and is separate from live-game traffic.
- **STUN** helps devices discover usable network addresses.
- A **relay** carries traffic when a direct connection fails. TURN is the normal
  WebRTC fallback. Removing every relay means accepting that some players cannot
  connect, even when both can browse websites normally.
- The introduction service could share infrastructure with accounts and the
  official leaderboard. Peer-to-peer play does not automatically eliminate website
  hosting, artwork/audio delivery or persistent-service costs.

WebRTC was discussed as a candidate. No library, signaling implementation, TURN
provider, operator or relay budget has been selected. Relays could be operated by
the owner, volunteers or a provider. The desire to avoid community servers does
not settle whether a small fallback relay is acceptable.

### If volunteers contribute relays or storage

Treat them as untrusted delivery/storage infrastructure. Their enrollment could
be automatic after compatibility, availability and capacity checks. Those checks
test usefulness; they do not prove operator honesty.

The proposed safeguards are end-to-end encrypted messages, authenticated player
identities/moves and encrypted recovery data whose keys stay off volunteer nodes.
Peer identities must be authenticated independently of an untrusted relay so it
cannot substitute its own keys. Sending a main account password or unrestricted
account session to a volunteer is not acceptable.

A volunteer can still delay, censor or drop messages, disappear, or observe IP
addresses and traffic patterns. Encryption protects message contents, not complete
anonymity or availability. Relay failover, quotas and abuse resistance still need
design. A malicious directory or many nodes controlled by one operator must also
be considered. No fully decentralized discovery/governance model was selected.

## Hidden cards, shuffling and fairness

Transport encryption alone does not stop the hosting player from inspecting a
complete deck or other players' hands stored on their device.

Two approaches were explained:

1. **Trust a chosen player as referee.** This is simpler for friends but does not
   meet the stronger goal of protecting secrets from a dishonest host.
2. **Cryptographic dealing.** Players jointly shuffle protected cards and reveal
   only the cards each player is entitled to see. Such protocols exist, but the
   exact scheme, library and security assumptions remain open.

The owner expressed interest in making the stronger approach safe. Do not describe
it as implemented or solved by adding encryption/signatures to today's backend.
Use established, reviewed cryptographic tools; assess collusion, aborts, selective
reveals, randomness, key loss and recovery for the actual player counts and games.
Encryption shared with every player must not give every player access to private
hands. Trivia answers, hidden simultaneous choices and game-specific secrets need
their own analysis too.

Authenticating a move proves who signed it. Checking public rules proves only what
can be checked from public information. Neither alone proves fair private dealing,
honest timing, or that a human selected the move.

## Recovery and backups

Three levels were discussed; none is a final retention policy:

| Option | Benefit | Remaining failure |
| --- | --- | --- |
| Live state on players' devices | Minimal server storage; other connected players may retain recent state. | Losing all copies or required keys loses the game. Host migration must be designed, especially around secrets. |
| Recent encrypted checkpoints on independent nodes | Can recover after a device/host failure if state and keys remain available. | Checkpoints may be stale or unavailable; extra holders do not prevent dishonest gameplay. |
| A live replica/referee | Potentially faster recovery and less lost progress. | More compute, bandwidth and coordination; any node with plaintext secrets becomes trusted. |

A possible design keeps an authenticated move record and occasional checkpoints.
After failure, clients locate a consistent checkpoint and resume or replay later
moves. Do not restore an arbitrary host's forged checkpoint. Restoring a relay is
different from selecting a new referee, preserving fair dealing and recovering
private keys. Real-time Arena may need to pause during migration; seamless recovery
has not been promised.

Frequent asynchronous copies allow some loss of recent progress. Waiting for an
independent durable copy before acknowledging a move reduces that risk but adds
latency and failure dependencies. The acceptable tradeoff is still open.

Optional match backups can expire after the session. Omitting them does not remove
the need to protect persistent accounts, official leaderboard data or other saved
progress. Do not remove current persistence merely because this future plan aims
to avoid long-lived tables.

## Official leaderboard verification

The goal is to avoid trusting a host's submitted score. The candidate flow is:

1. Before ranked play starts, the service issues a unique match ID and binds the
   participants, game/rules version and permitted starting conditions to it.
2. Players authenticate their own moves and produce a complete agreed game record.
3. The verifier checks the setup, dealing/randomness evidence, move legality,
   sequence and completion, then calculates the result itself.
4. The service accepts the match only once and updates the leaderboard.

This is a proposal to investigate, not a finished ranked protocol. Signatures and
replay alone cannot prove that a real human match occurred: several controlled
accounts can agree to a fabricated or farmed legal history. Trusted timing,
randomness evidence and private-information verification are game-dependent.
Real-time games require special care with timestamps and host scheduling.

### Official apps, browsers and custom builds

The owner suggested requiring a verified app/version to submit ranked results.
Apple **App Attest** and Google **Play Integrity** can provide evidence of legitimate
app installations and help bind requests to a server challenge. A client-provided
version string or ordinary file hash is not equivalent evidence.

The earlier statement about browsers/custom builds means: they do not offer the
same Apple/Google store-backed proof. It does **not** mean they cannot play, and the
owner has not decided to exclude them from official rankings. Decide the policy
explicitly; do not silently make the open-source website or community builds
casual-only. Browser authentication or signed moves do not by themselves prove an
unmodified browser runtime.

App integrity is an additional signal, not proof of fair play or an infallible
device guarantee. A genuine app can still be used for collusion, farming, automation
or outside advice. Result verification remains necessary with or without app
attestation. Handle supported versions, provider outages, unsupported devices and
replay protection when choosing an attestation policy.

### Farming, bots and outside help

The owner wants to investigate detection of farming and bots. Possible signals
include repeated reciprocal wins between the same accounts, implausible volumes or
timings, suspicious account groups and consistently automated behavior. These are
candidate investigations, not chosen thresholds or an automatic ban policy.

Keep legal-result verification separate from behavioral risk detection. Shared
networks, regular friend groups and skilled players can produce innocent patterns;
define false-positive handling and proportionate responses. A signature does not
prove that different keys belong to different people. Do not promise to detect
off-device AI advice or all other outside help; that limitation is accepted.

## Costs discussed and what is still unknown

The owner asked about **1,000, 10,000, 100,000 and 1,000,000 users**. “Users” was not
settled as registered users, monthly active users or concurrent players. These are
very different capacity questions. No load testing or total-cost estimate was
completed in this discussion.

One arithmetic illustration used monthly active users, an average of 1% online,
four players per table, and one object-storage checkpoint upload per active table
per minute. It used a 30-day month and R2 Standard's then-current free allowance of
one million write operations/month, followed by $4.50 per billed million writes.

| Monthly active users | Average concurrent players | Checkpoint uploads/month | Approximate monthly write charge |
| ---: | ---: | ---: | ---: |
| 1,000 | 10 | 108,000 | $0 |
| 10,000 | 100 | 1,080,000 | $4.50 |
| 100,000 | 1,000 | 10,800,000 | $45 |
| 1,000,000 | 10,000 | 108,000,000 | $481.50 |

Formula: `(monthly users × 0.01 ÷ 4) × 43,200` uploads. Paid writes are rounded to
the next million after the free allowance. This is **write operations only**:
storage size/retention, downloads, checkpoint generation, verification, signaling,
accounts, relay traffic, artwork/audio, operations and any paid game hosting are
additional. These assumptions are illustrative, not measured Gamehub behavior.
Replication to more destinations may multiply writes. Player-local recovery or
donated storage could eliminate this particular paid-storage component.

Other storage and small VPS providers were examined, but no provider or tier was
selected. Do not treat historical prices or the example above as a total bill or
a promise that volunteers will supply enough capacity. Contributions distribute
costs; they do not make the network's compute and bandwidth costs disappear.

## Where a future agent should continue

1. Confirm the unresolved choices with the owner in plain language: license and
   sharing obligations; whether a paid relay fallback is acceptable; tolerated
   loss/recovery time; ranked eligibility for web/custom clients; and expected
   concurrent usage. Existing goals above do not need to be asked again.
2. Inventory each game for public/private state, randomness, deterministic replay,
   timing, bots, device suspension and saved progress. Separate the hosting player,
   game referee, table admin and match leader; changing networking must not change
   the existing host/admin pacing contracts in [DESIGN.md](../DESIGN.md).
3. Compare player-hosted play, distributed validation and a hybrid design with
   explicit threat assumptions. Evaluate a reviewed hidden-card protocol before
   promising private, fair play without a trusted referee.
4. Prototype a bounded game/transport and a result verifier when implementation is
   requested. Preserve current server-hosted play and saves while proving the new
   path; this planning record is not a migration or release instruction.
5. Validate forged/replayed commands and scores, altered starting conditions,
   tampered checkpoints, host/relay loss and abusive traffic. Test actual phones,
   browsers and restrictive networks, including suspending the hosting app. Static
   tests do not establish network/mobile acceptance.
6. Measure traffic, relay usage, replay CPU, checkpoints and asset delivery. Produce
   separate budgets for shared services, donated infrastructure and paid fallback
   capacity at the four requested scales, with concurrency and retention stated.

Read the repository's [AGENTS.md](../../AGENTS.md) and current design contracts
before changing behavior. Update this record as choices are made and link to any
implementation, tests or benchmarks that actually demonstrate them.

## References reviewed during the discussion

These explain candidate approaches and current policies; they do not establish
that Gamehub has implemented them. Recheck live documentation before relying on
pricing, store policy or API details.

- [Open Source Definition](https://opensource.org/osd): commercial-use restrictions
  are incompatible with the definition.
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0): one discussed
  replacement-license option.
- [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections) and
  [TURN relays](https://webrtc.org/getting-started/turn-server): discovery, signaling
  and relay fallback.
- [Epic's networking overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview?application_version=4.27):
  player-hosted versus dedicated authority and the live host's fairness advantage.
- [IETF MLS protocol overview](https://www.rfc-editor.org/rfc/rfc9420.html#section-3):
  authenticated encrypted messages over an untrusted delivery service. This is a
  messaging reference, not a hidden-card dealing protocol.
- [A Fast Mental Poker Protocol](https://eprint.iacr.org/2009/439): an example of
  research on protected card dealing, not a selected Gamehub implementation.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  and [Google device/network policy](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en):
  app behavior, security and executable-code update restrictions.
- [Google user-data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en):
  privacy and data handling duties.
- [Apple App Attest validation](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server)
  and [DeviceCheck limits](https://developer.apple.com/documentation/devicecheck):
  app/request integrity signals and their limits.
- [Google Play Integrity overview](https://developer.android.com/google/play/integrity/overview)
  and [verdicts](https://developer.android.com/google/play/integrity/verdicts):
  recognized app/device evidence.
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/),
  [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing) and
  [Hetzner's June 2026 price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/):
  pricing sources consulted; no hosting purchase or provider selection was made.
