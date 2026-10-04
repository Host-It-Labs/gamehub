# Quiz: 3D Sizes, its own pick and splash, even scores (2 October 2026)

Design notes are in the 2 October 2026 Quiz section of [DESIGN.md](../DESIGN.md).

## Scoring model

A Monte Carlo model played the real content (74 Years events by era, every
legal Sizes pair, 121 Atlas places by tier, the 39 live Order sets with
their values) for a weak, an average and a strong player and a random
guesser. The error models are assumptions; nothing is calibrated on real play.

- **Years**: a small chance of the exact year, otherwise years off are
  log-normal (σ 0.8) with medians by era, old / modern / recent: 150/30/8
  (weak), 70/14/4 (average), 25/6/2 (strong).
- **Sizes**: the guess is the answer times a log-normal error; σ for the
  average player is 0.32 for animals, 0.38 objects, 0.46 landmarks, 0.56
  countries, scaled for weak and strong, a little wider for lopsided ratios.
- **Atlas**: km off log-normal by tier, easy / hard / photo medians
  700/1300/2800 (weak), 300/600/1400 (average), 120/250/600 (strong).
- **Order**: each value read with noise on its own scale (log for
  magnitudes, log of years ago for dates, degrees for coordinates), then
  sorted; average noise 0.5 in log.
- **Random**: a uniform year, a log-uniform size 0.2–8× the reference, a
  uniform point on the globe, a uniform order.

Mean points per prompt, weak / average / strong / random:

| Game | Before | After |
|---|---|---|
| Atlas | 30 / 49 / 69 / 1 | 31 / 50 / 71 / 1 |
| Sizes | 50 / 63 / 77 / 32 | 36 / 51 / 71 / 18 |
| Years | 39 / 56 / 76 / 5 | 28 / 49 / 72 / 4 |
| Order | 72 / 82 / 92 / 36 | 44 / 61 / 81 / 4 |

Order uses 100 / 50 / 20 / 0 by pairs the wrong way round, one step gentler
than the model's best fit (−50 a pair: 39 / 58 / 80 / 3), so a round of it
has more than three possible scores. Years by era for the average player,
old / modern / recent: 25/59/84 before, 33/49/66 after. With every game's
noise moved independently by up to ±30%, the gap between the most and least
generous game for the average player fell from 34 to 19 points; before, Order
was the most generous game in 99% of draws, after about half.

Known limits: sorting five things whose values are often twice apart stays
the easiest game (the model's average player sorts a set perfectly 40% of
the time); a blind Sizes guess still scores about 18 because targets are
always 0.2–8× the reference; Atlas ignores how big the country is.

## Checks

- Unit tests: `size`, `know-me-quiz`, `geography`, `sabi`, `quiz-content`
  pass with the new numbers and a new outline test; the full suite (833)
  passes.
- Browser, desktop 1024×768 and phone 375×812 (emulated), in an isolated
  copy on its own port: the opening pick, picking Sizes, the 3D table in the
  real layout (no page scroll), moving and overlaying pieces, orbiting, the
  tape, the knob, the wheel and arrow keys, all three comparison kinds,
  the 3D reveal with hover and tap focus, and the Years pin head. The pick
  and splash were checked separately at 1440×900, 768×1024 and 375×812 and
  under reduced motion. Real touch and pinch were not tried on a device;
  online play was not tried.
- The browser pane has no tab mute; page audio was silenced by script.
