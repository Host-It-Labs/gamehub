# Codex review of Claude's half — findings and fixes (9 October 2026)

Read-only review by Codex (brief: `codex-review.md`). Every finding was fixed.

| # | Finding | Fix |
| --- | --- | --- |
| 1 | A `null` inside a saved shift made validation throw; recovery wiped the Workshop | `isMatch`, `isDinerConfig`, `isCampaignRun` never throw; the profile is read independently of the run (test: null table and station) |
| 2 | Refreshing an online shift restarted input numbering below the server's watermark, ignoring a minute of input | the client resumes numbering above the acknowledged step of the current round |
| 3 | After the host's Again, guests could stay stuck behind the previous results | results are kept per round (`resultsRound`), so a new round never inherits them |
| 4 | Changing nights online could rebuild the previous night's room | the session's round changes only once the new round's match is in hand, then notifies |
| 5 | A failed checkpoint left "saved" messages showing | the campaign tracks `persisted` from every checkpoint |
| 6 | A leftover full coffee pot blocked clearing tables | Use at the urn with a full pot puts it back (`stow`) (test) |
| 7 | Two waiters' simultaneous Out! on one mimic threw out a real guest | Out! targets are fixed before anyone acts; a vanished target is refused (test) |
| 8 | Overtime ended after its first boss with no way on | the last generated leg's boss clears the night; only the third counts as a night beaten (test) |
| 9 | The drive delay could reopen a run ended meanwhile | the timer is cancelled on End and unmount, and checks the saved run before opening |
| 10 | Output and bloom passes and lab materials were not freed; debug globals kept | every pass and material disposed; debug globals removed on unmount |
| 11 | The bot stalled behind an unwanted plate at the front of the pass | it takes the blocking plate off when a wanted one waits behind |
| 12 | Space on a focused button triggered Use | focused buttons keep Space and Enter |
| 13 | Busy level and atlas rewards were invisible to screen readers | included in each fork's accessible name |
| 14 | The jukebox had no target ring | the ring circles the jukebox |
| 15 | Pausing left effects ringing | pause silences the effects bus too |
| – | Duplicate table construction; duplicated lane spacing | one `newTable`; the counter uses the view's `stationLaneX` |
