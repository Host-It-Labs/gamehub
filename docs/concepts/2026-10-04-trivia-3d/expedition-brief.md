# Expedition miniature — authored source brief

Date: 4 October 2026. Subject: Trivia's four-round Expedition.

Build one generous, readable journey, with no route forks, shops, currencies,
or secondary board to decode. Twelve progress steps run continuously from the
near-left meadow to a far-right brass trophy: three steps for each of Atlas,
Sizes, Years and Order. The sculpted world conveys that progression. No text
or interface is baked into the source.

The miniature sits on a warm walnut plinth with a routed edge and brass feet.
Its full landscape silhouette is approximately 12 × 6 world units. Carved
strata and a soft moss surface join four clear landmarks: a compass-and-globe
grove, a sinuous turquoise stream with a engineered timber footbridge, a
canvas camp beside a bronze time dial, and a rising stone trail to a trophy
beacon. Pine boughs, exposed roots, riverbank pebbles, tent seams, bridge
joinery and facets in snow-covered peaks provide secondary detail. Small
details cluster around the main forms; they do not obscure the path.

Materials have distinct finishes: satin timber with directional grain,
rough muted stone, rich moss, matte needle foliage, woven ochre canvas,
polished-but-worn brass and translucent turquoise water. Avoid a uniform
plastic finish. The path's pale inlaid surface stays legible against every
biome. The terrain, path and bridge are physically aligned; progress samples
return the exact ground or deck position rather than an unrelated curve.

The traveller is a crafted hiking-boot token with a stitched leather upper,
layered sole, lace eyelets, rolled cuff and enamel seat-colour compass badge.
It rests on a tiny brass footplate. It is deliberately a handsome tabletop
token, so no weak humanoid anatomy is introduced. Its feet remain grounded;
a brief low rocking step belongs to movement, with a quieter settled idle.

Motion is localized and slow: the tent's small pennant follows a restrained
wind wave; stream-current lines move continuously without random glitter;
the trophy's star catches a soft regular highlight. Nothing rotates the
whole world. Reduced motion freezes those details and settles the traveller.
The host integration owns the camera, lighting, renderer, progress tween and
seat spacing.

Review cameras must show the complete plinth and tree/peak/trophy silhouettes,
then inspect the bridge, tent, mountain snowline and token at close range.
Review a complete moving cycle at the intended game size and the smallest
portrait view. Source geometry and this brief are retained as the editable
master. Static geometry may be grouped by material only after its authored
forms are complete; dynamic pieces stay separate.

## Integration contract

- Y is up. X runs left to right; the start is near `(-5, 1.5)` in X/Z and the
  finish near `(5, -1.2)`. The visual centre is the origin in X/Z.
- `createTriviaExpedition({ runtime?: boolean })` returns `root`,
  `point(distance, lateral = 0)`, `surfaceAt(x, z)`, `normalAt(x, z)`,
  `update(time, reduced)` and `dispose()`. Distance clamps to `0…12`; lateral
  follows the trail's local normal. Both terrain and the arched bridge deck
  supply actual contact positions. No queue spacing is baked into progress.
- `createTriviaTraveller(colour, { runtime?: boolean })` returns `root`,
  `update(time, moving, reduced)` and `dispose()`. Integration places and
  turns the root. The toe points along local **−Z**; align it to travel with
  `atan2(dx, dz) + π`, and align up to the sampled surface normal.
- No lights, camera or renderer are created by either source factory.
- Review status and measurements are appended after implementation; a passed
  geometry check does not establish visual or motion acceptance.

## Source review and refinement

The author and parent agent opened the first desktop source screenshot. The
full plinth, engineered bridge and tensioned tent read, but the terrain was
too uniform and the side-mounted enamel badge hid the seat colours. The
source was then refined with sculpted grove contour, purposeful forest colour,
cut stone/soil/moss riverbanks, fourteen authored fern patches and a cut log
with growth rings. The globe's continents follow its spherical surface. A
raised carved time-dial pedestal improves the camp landmark's relief.

The refined desktop screenshot was opened again. Seat-colour woven cuffs and
an enamel contact-plate face now read from above while the detailed leather
boot remains intact. That source was retained before preparing an optional
runtime copy. Final contact work widened the bridge to **1.45** units, moved
the trophy dais off the finish point and sunk the slope-following milestone
inlays into the trail. Those last changes still require the parent's final
renderer comparison and motion review.

Source screenshots: `review/expedition-source-desktop.jpg` and
`review/expedition-refined-source-desktop.jpg`.

## Measured source and runtime copy

The default factories preserve all named source parts. A separately built
`runtime: true` copy submits static geometry by material while retaining every
authored triangle, terrain vertex colour and moving boundary. Pennant cloth,
river-current reflections, trophy star/highlight and boot/badge pivots remain
independent. Superseded geometry is disposed; disposal is idempotent.

| Asset | Source meshes | Runtime meshes | Triangles in both copies |
| --- | ---: | ---: | ---: |
| Expedition | 502 | 43 | 118,494 |
| Traveller | 58 | 13 | 31,166 |

The landscape bounds are **12.783 × 6.296** in X/Z, with Y from **−0.680 to
3.897**. The traveller is **0.604 × 0.793** in X/Z and **0.669** high. Source
and runtime bounds agree within floating-point tolerance; all vertex values
are finite. Sixteen animated Expedition boundaries and both traveller pivots
survive consolidation.

A raycast sweep at 0.02 distance intervals finds no trail obstruction higher
than 0.05 units; the largest positive contact mismatch is 0.0254 units.
Bridge pair centres at lateral ±0.32 sample the arched deck near Y **0.707**.
Three seconds of movement keep the boot's low sole edge at Y **0.039…0.042**
above its fixed plate; roll and pitch compensate their contact edges. Reduced
motion settles all hooks. Module TypeScript checking and scoped lint pass.

These are geometric and desktop-source observations. The parent's final
runtime screenshots, front/side/rear and close-up review, live motion cycles,
portrait framing, touch checks and physical mobile GPU performance remain
separate evidence. No user approval is claimed.

## Final traveller clearance pass

The parent opened the complete moving cycle in the actual renderer. Frame
`review/expedition-motion-frames/035.jpg` exposed a blue boot touching the
raised sundial in the positive lane. That frame was opened by the author
before the final correction.

The dial now stands at **(1.61, 2.30)** in X/Z, farther into the clearing.
Its carved pedestal, hour notches, rim and gnomon are unchanged. A sweep of
the complete authored boot geometry also caught the globe dais, a hard rock
under the forward purple boot, a bridge-approach pebble and the summit's
foothill/trophy edges. The globe and those stones move outside the corridor;
one pine moves into the far bank cluster to keep the globe clear. A second
small pine moves slightly back to clear the moving cuff. All detailed source
geometry and the dense moss/fern clusters remain.

The final start is **(−4.80, 1.03)**, inset enough to support both complete
lanes. The last path point bends forward to **(4.91, −0.62)**, so the trail
passes in front of the complete mountain rather than through its foothill.
The trophy dais sits 1.08 units forward of that point. The island and mountain
silhouettes, source triangle counts and complete bounds stay unchanged.

The contact audit uses the parent's actual pose: **0.8** uniform token scale,
lanes **±0.32**, toe heading plus π, and up aligned to the sampled surface.
It clips landmark, rock, tree and bridge triangles against a convex envelope
built from every authored token vertex. The moving envelope includes nine
phases across the rocking cycle plus a 0.0048 world-unit margin. The path sweep
covers **802** poses across both lanes. Bridge-cap overlaps from a coarse box
test disappear with the complete boot envelope, so the engineering is retained.
The final moving-envelope sweep finds no hard-prop, landmark or tree collision;
only the intentionally retained low moss/fern contacts remain.

A separate support sweep samples the centre, half-radius and full contact-plate
outline: **7,986** positions all find actual terrain or bridge deck underneath.
The `trivia-3d` suite passes **9/9** tests. Final renderer recapture remains
the parent's visual evidence; the geometry checks do not replace it. Low moss
and fern contact under the fixed plate is retained intentionally.
