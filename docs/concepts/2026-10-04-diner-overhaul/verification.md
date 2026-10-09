# Diner overhaul verification, 4 October 2026

This is a large game, artwork and interaction change. The checkout also contains
concurrent Arena, Alto, Trivia and audio work. This task preserves those changes.
Diner remains behind its existing development availability gate.

## Automated checks

- All **44 focused Diner tests pass**: the existing game, campaign mechanics and
  progression, atomic saves, visual geometry and framing, online room behavior,
  snapshot packing, and availability gates.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- `npm run check:assets` finds **591 production assets, 128.73 MiB**, with every
  file present and the Docker allowlist verified.
- The scoped `git diff --check` passes.
- The full repository test run finishes **1,055 / 1,057 passing**. Its two
  failures are the concurrent Arena foot/tower animation regressions in
  `tests/arena-animation.test.mjs`: “fast feet stay outside a rounded tower
  corner while travelling along it” and “the Dino and Sumo regressions catch
  free strides entering stone and leave distant or broken towers alone.”
  No unrelated Arena files were changed to resolve them.

Local listener access was required for the online tests and build prerendering.
Their sandbox-only `EPERM` results were superseded by successful runs with that
access. Final logs are under `/private/tmp/diner-*-final.log` on the test host.

## Browser and touch checks

The live development game was checked in Chrome and the Codex browser. Canvas
bounds equal the viewport and document height equals viewport height at
390 × 664, 390 × 844, 768 × 1024, 1,067 × 600, 1,133 × 744 and 1,280 × 720.
The 1,067 and 1,133 cases test dimensions reached around responsive/zoom
breakpoints; these are viewport overrides, not a claim of testing the browser's
native zoom control. Camera tests also cover fractional 1,123.4 × 659.5 bounds.

The largest free-play room was reviewed with every food machine, wash/bin,
five booths, six guests and two parties. A temporary React layout fixture also
checked four waiters, all five booths and four long names. It wrote no save:
the row contracts to seat numbers on the phone, expands to complete names on
desktop, and keeps other waiters' numbered markers separate. The fixture was
removed after inspection.

Native Chrome touch-event emulation checked dragging and releasing the lower
left joystick, then using a second finger on Use while the first held the
stick. The waiter took the prepared burger, the grill became idle, and releasing
the fingers reset movement to zero. Walking advances by 0.14 units per 30 Hz
tick, preserving the **4.2 units/second** baseline. Native Space also cooked and
took a fresh burger. Phone controls measured 98 × 84 pixels for Use and
62 × 64 for Out. These checks use emulation, not physical mobile hardware.

A coarse-pointer 844 × 390 landscape phone shows the shared portrait screen.
Reduced-motion emulation initializes both the room animation and effects in
their reduced mode. All device, viewport and media overrides were restored;
temporary tabs were closed, and no temporary simulation freeze remains.

Menu pause, rules, leaving, campaign choice screens, workshop purchases and
reload/Continue were checked through the rendered UI. A genuine simulated
shift reached the win screen, banked rewards once, opened three gear choices
and continued to the next route. Later genuine service reached a boss victory
and a loss; Workshop applied its real price and prerequisite unlock. Active
run reloads retained timer, coins and carried food. No synthetic persistent
campaign save was installed.

## Art and balance

Both new covers were checked at source size, thumbnail size, wide setup crop
and short setup-lid crop. Exact prompts, originals, exports and review evidence
are in [artwork/README.md](artwork/README.md). The setup screenshot also verifies
the new artwork in the actual application.

[Campaign validation](campaign-validation.md) records thirty complete actual
service simulations, all six boss conditions, equipment interactions and
overtime. They establish achievability and deterministic progression; human
difficulty across a full campaign still needs player feedback.

## Review images

- [Cover and setup](review/setup-desktop.png)
- [Busy free-play room, desktop](review/full-moon-1133x744.png)
- [Busy free-play room, tablet](review/full-moon-768x1024.png)
- [Busy free-play room, short portrait](review/full-moon-390x664.png)
- [Four waiters and complete names](review/four-waiters-1280x720.png)
- [Four waiters, portrait badges](review/four-waiters-390x844.png)
- [Campaign equipment choices](review/equipment-390x664.png)
- [Landscape phone guidance](review/rotate-phone-844x390.png)

No PR, merge, release, CI or production deployment was requested or performed.
