# Lucky and Folio continuity — 26 September 2026

Tables reuse the library setup dialogs and saved-game picker. Continue seats the table in the existing run or desk without copying its state. Existing members remain; combined membership must fit three players. The server rejects inaccessible, finished/practice Folio runs and over-capacity attachments before adding members. Ordinary Folio invitation locking is unchanged.

Both game pages stay connected to their originating table. Menu → Table settings lets the creator return everyone to the lobby or close the table; the saved game survives. A later library visit drops an obsolete table association instead of forcing the player out of the save. Table launches are tracked by launch time so the same run can be resumed repeatedly.

Lucky has a three-player cap and Watch shows another player's current ticket, including server-confirmed scratches and payouts. Watching cannot scratch or buy on their behalf. Folio shows only its current section, difficulty and round; future-act tabs and the background scaling animation are removed. Keyboard draft behavior is unchanged. Long player names use shared badge fitting; resize callbacks are deferred outside ResizeObserver delivery to avoid a resize-loop warning.

Validation:

- Final full suite: 552 tests passed. HTTP regressions cover unchanged saved puzzle/ticket state, authorization, member expansion, three-player limits, atomic rejection, host return/close and repeat continuation.
- Final typecheck, lint, production build and diff whitespace check passed. Production asset allowlist check passed (270 assets).
- Browser: same Folio save URL opened from library and table Continue; table settings and host Back to lobby; reopening that save after leaving the table; three long player names; Watch received a simulated player's scratch without reload; Escape restored focus to Watch.
- Folio layout examined at 390×664, 390×844, 1133×744, 1536×730 and 932×430 CSS pixels. Phone and desktop document bounds matched the viewport and the background reported no animation/transform. Lucky Watch examined at desktop and 390×664 with three members and long names. Watch is an optional internally scrolling inspection.
- Physical touchscreen play, device fullscreen/orientation behavior, audio and human puzzle pacing were not tested. Short landscape desktop checks are not phone-landscape acceptance.

Concurrent audio edits caused transient missing-module overlays and a server restart during browser work. They were not changed by this task; the final typecheck, lint and build passed after those files became available.
