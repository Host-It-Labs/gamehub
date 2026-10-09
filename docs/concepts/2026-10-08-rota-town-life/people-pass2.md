# Rota residents: visibility pass 2

8 October 2026. Reviewed Claude's `work/rota-life/review1/p1-final-9000.png`,
`p1-phone-10000.png`, `b1.png` and `b3.png` before editing. At the fixed
desktop and steep phone cameras, the first-pass dark coats disappear against
the pavement and terrace shadows; residents do not read as town life.

Preserve the authored fitted coats, heads/caps/scarves, connected articulated
limbs, planted stride, dog and handle-contact pram. The user's second-pass
instruction explicitly supersedes the original strict true-scale appearance:
draw the complete residents and their companions at **1.3 times** the authored
reference size, with ordinary head/shoulder proportions intact. Crossing
reservations and queue spacing must include the enlarged footprints.

Use cream macs, light grey and blue-grey wool, muted sage and warm brown coats,
with restrained brick-red and olive headscarves. Keep charcoal shoes and
trousers for separation. Add one bounded, instanced soft contact-shadow batch
at each visible resident's feet, never a large black token-shaped plate.

The unchanged phone camera places the ring at 1.387 units and the inner house
fronts at 0.695 units beyond the site, mostly outside its left/right frame.
Retain those walks and add four short residential frontage paths **0.20 units
outside the site**, in the clear space between the hoarding and the inward-facing
terraces. Seed the first eight residents over these paths at every quality tier;
keep the rest distributed across the existing ring and side lanes.

Each new path receives narrow sandstone flags, 0.055 units wide, with 0.04-wide
branches to its actual doors, merged into one static mesh. Validate the whole
door approach through the clear front space; stop paths before all physical
exit-road paving and rail corridors. These paths are separate from the
back-to-back yards and their washing lines. Every flag remains outside the
playing squares and the hoarding, with the contact shadows above its top.
No camera, projection, tap-target, rendering-server, external asset or UI changes.

Claude will render the enlarged/lightened residents again. Existing screenshots
establish the first-pass visibility failure; logic/geometry tests cannot establish
the revised artistic acceptance or phone GPU cost.

Final safety review: unprotected frontage paths and their door approaches keep
0.10 units beyond the complete exit paving/rail width, covering the enlarged
pram's 0.0897-unit turning envelope. Outer side walks use the same 0.10 margin
at unprotected back-lane junctions. Explicit protected crossing spans and the
resident movement/admission behavior are unchanged.

Source checks: nine focused tests pass, including enlarged safety envelopes,
planted feet and handle contact on ramps, reduced motion, representation at
10/18/28 residents, scarf/skin separation, soft fog-aware contacts and off-board
flag bounds. A close-exit/outer-junction regression verifies the whole companion
turn at open ends and doors, plus the new flag/door-branch exit clearance.
A CPU-only actual Ground/scenery probe after the margin change finds four near
paths and eight near residents across those four paths on every map, with no
flag vertices in the playing site or exit corridors. The least near-path
endpoint clearance from a physical exit edge is 0.135 units, greater than the
whole pram envelope. Dense whole-path/door-approach samples leave at least
0.0453 units beyond that envelope; near-path lamp centres leave at least
0.515 units beyond physical exit edges. No actual-map open endpoint breaches
the companion envelope.
The contact batch adds one draw; static flags add one draw, with no new per-frame
arrays, objects or matrices. The next Claude renders remain the visual review.
