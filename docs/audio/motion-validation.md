# Motion and event feedback — 26 September 2026

This record covers Know Me, Quiz, Folio and Lucky. It describes source review
and automated checks; it does not claim browser, physical touch or listening
acceptance for these games.

## Coverage

| Surface | Motion trigger | Sound trigger |
| --- | --- | --- |
| Know Me / Quiz stage | Game, round, phase, active author or reveal step, match end | Phase/reveal transition; match reward |
| Party decisions | Topic insertion/change; lock state; player readiness; score and vote counts | Accepted topic/spectrum/vote selection; accepted ranking, dial, size, pin and lock changes |
| Atlas / Sizes | Changed clue or comparison; completed step; confirmation mode | Accepted pins/sizes and lock changes through the shared party state |
| Folio | Phase, route node or puzzle kind; picked route; remaining lives | Accepted shared puzzle changes, route selection, stage change, win or loss |
| Lucky | Selected tab; book unlock/level; upgrade rank/readiness; factory insertion/move; inspector selection; ticket count and lives | Ticket purchase; seal reveal; completion; upgrade/book/blueprint purchase; ordinary factory moves |

The existing party count-ups and staggered reveals, Folio puzzle-specific
flips/stamps/swaps, and Lucky foil/ticket/payout animations remain in use.

## State and accessibility checks

- New motion adds no React remount keys. Existing draft, focus, scroll, canvas
  and pointer state stays attached to the same elements.
- The Folio stage key excludes the puzzle view, typed drafts and server
  revision. Party stage keys exclude local inputs and answer coordinates.
  Lucky's stage key is its tab, excluding scratching and factory clock ticks.
- Individual markers use the value they display: score, readiness, tally,
  selected clue/topic, lock state, lives, upgrade rank or inspected machine.
  Unchanged polling snapshots do not restart these animations.
- Stage transitions only fade opacity; they do not move a board's interaction
  geometry. The shared controller cancels its running animations when reduced
  motion is enabled. Added CSS transitions only apply without reduced motion.
- Party sound signatures read the observed view and the viewer's own permitted
  answers; they never read the hidden Dial point, Sizes answer, opponent ranks
  or opponent pin coordinates. Online cues follow returned state, not the
  request being sent. Initial mount, rejected requests and unchanged polls are
  silent. Public table votes are audible when their tally changes.
- Folio sound compares authoritative public puzzle state. Local typing is
  silent; accepted shared moves are audible once, including teammates' moves.
- Party and Folio use `useGameSound`: muting or unmounting stops active sources
  and invalidates pending decoding. Lucky's mute handler directly calls
  `ScratchAudio.setMuted`, stopping both its continuous scratch and discrete
  sounds. Muted state updates do not queue effects for a later unmute.

Final review corrected two routing gaps: accepted party moves now use the
distinct move recording rather than the selection recording, and ordinary
factory edits no longer use the upgrade reward sound.

Lucky's completion cue now follows the mounted ticket's authoritative
unclaimed-to-claimed transition. It uses a reward only when payout exceeds
ticket cost, and a quiet movement sound otherwise. Reopening an already paid
ticket and repeated server snapshots stay silent. No authoritative sound is
derived from hidden cell contents or unconfirmed scratch prediction.

Local comparison-tab changes, text entry, camera movement and continuous
pointer movement do not each play an effect. They retain visual feedback;
sound follows a settled action. Lucky retains immediate local scratching and
seal feedback, while completion, purchase and upgrade sounds wait for the
authoritative result.

## Automated validation

- TypeScript and scoped lint passed for the changed components.
- 305 focused Folio, Lucky, party-set, Sizes and ranking tests passed. Two
  localhost HTTP tests first encountered sandbox `listen EPERM`; both passed
  when rerun with permission to bind locally.
- 18 shared audio/motion tests passed. These exercise cancellation, mute,
  stale decoding, hidden-tab behavior, alias cancellation, stable elements,
  changed-value replay, child-only insertions and live reduced-motion changes.
- Diff whitespace checks passed.

Browser interaction, physical touch feel and subjective sound balance remain
separate acceptance checks. No new background music was added to these games.
