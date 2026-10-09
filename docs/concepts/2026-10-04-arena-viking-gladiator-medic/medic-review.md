# Medic source review record

The baseline shipped figure contains 16,408 triangles and 62 mesh nodes. That
is the runtime ceiling; detailed sources are intentionally larger and remain
editable. No source is accepted for reduction merely because contract tests pass.

V3 established the connected skin, anatomical joint hierarchy and stem grip.
Its four actual-export contract tests passed, but clay inspection showed raised
open sleeve caps, narrow boot soles, hollow eye rings and broad finger bands.

V4 has the full clay front/side/rear, game and 50/70-degree camera set, both
hands, equipment, material face/three-quarter, full heal and raised-elbow
close-up. Its soles and knee cloth are improved. Source inspection still rejects
the open shoulder transition, equal finger bands, carved facial shadows and
concentric eye presentation. The heal close-up also exposes upper-arm vertices
assigned to the forearm, which tears the sleeve when the elbow lifts.

V5 repairs the bent-arm ownership by segment proximity, constructs a sewn
shirt/sleeve union with continuous weights, and preserves a dense editable
uniform subdivision. It uses smoothly interpolated face profiles and softer
landmarks, a stable convex eye frame, tapered finger phalanges, a cap crown
that covers the swept hair and detailed sampled collar/tie/pocket panels.
These are review candidates, pending visual inspection and the actual Arena
walk/turn/heal/recovery/idle pass. Reduction and action-card generation remain
after that source acceptance.

V6 isolates a Blender boolean failure: its exact solver discards the shirt
and one sleeve even though all three operands are closed with positive volume.
The small construction probe confirms that the manifold solver retains the
complete sewn garment (combined volume 0.01713 versus the bad result's 0.00130).
V6 material face establishes the stable brown iris and convex white surface.

V7 retains the full 140,142-vertex uniform cage and 305,891-vertex anatomical
skin cage, both with their editable source subdivision restored. Its elbow
centerline is rounded before fusion and its grip has tapered, varied fingers
and a crossing thumb. Six actual-export contracts pass, including anatomical
parenting, normalized transitions, proximal arm ownership, complete tailoring,
full heal/recovery grip attachment and separate-source palette/budget handling.
These establish structural behavior, not source visual acceptance. Root's
actual Arena motion/material review remains the gate before a reduced copy.

Each version has an exact Python snapshot beside the editable master. Review
logs, images and evidence JSON live under `work/arena/2026-10-04-vgm/medic`.
The isolated GLBs use `/3d/arena/dev/vgm-medic-source-<version>.glb` and never
replace the shared production manifest during authoring.

V8/V9 establish the reviewed face/cap, adult female silhouette, green tonic,
satchel and full boot soles. Root rejects skin islands through the sleeves.
V10 contains these in neutral, but the raised material view reveals long
skin strips beside the underarm. V11 still fails that raised case.

The actual strip vertex at Blender `(0.1474, 0.0298, 0.7574)` carried about
47% torso weight despite being on the exposed upper arm below the cuff.
The new actual-GLB medial-arm test requires this surface to retain arm
ownership and prevents that particular regression without relaxing any
upright-tonic requirement. The September upright test now includes the
right wrist, which carries the entire tonic, and retains its `1e-10` limit.

V14 repairs the exposed arm and matches covered tissue to the garment.
Root passes its neutral forms and connected raised arm but rejects the
long stretched cloth fan below the underarm. The original whole-volume
union joined sleeve to shirt nearly as far as the cuff. V15 diagnostic
retains the same closed shirt and sleeve profiles separately and removes
that cloth fan; it exposes the equivalent overly long join in the original
arm/torso voxel fusion. V15 is work-only diagnostic evidence, not an
accepted or reduced source.

V16 rebuilds the full source with a short shoulder attachment and a covered
medial armpit clearance before anatomical fusion. Original body/arm surface
provenance establishes ownership; the shirt and closed sleeves retain
their separate sewn panels and short shoulder blend. Visible forearms,
hands, face, cap, torso exterior, skirt, trousers and equipment profiles
remain held. The anatomical voxel size stays `0.0017`, clothing `0.0020`,
and all editable source subdivisions are restored. Root independently
accepts V16's neutral, complete raised pose and underarm close-up: the
cloth fan, brown edge seam and skin ribbons are gone. Complete
actual-renderer motion review still gates any runtime reduction.

The proximal-arm regression samples the actual lateral tissue at the same
quarter-length arm anchor. The internal bone center now lies closer to
the separate chest surface, which correctly carries torso ownership.
The test retains its upper-arm `>0.55` and forearm `<0.08` limits; both
actual lateral samples carry upper-arm weight `1.0`. The exposed medial
arm regression remains unchanged. All 17 focused source and September
motion tests pass against the exact V16 export.

Actual Arena evidence is recorded from the private full-source fixture
under the real MaterialLibrary, light and troop driver. V16 has a 90-second
walk/turn/heal recording, a 35-second frontal complete-heal recording
(`mode=attack`, facing PI), and a 70-second idle recording. Raw videos,
pose/state traces and sequential sheets are under the Medic `motion`
folder. The initial walk fixture froze `sinceHit` while walking; it
therefore does not establish lowering after the final heal. The separate
60-second `medic-source-v16-recovery.webm` uses the corrected private
clock. It records the last heal ending at 38.40 seconds, then 161 walking
samples with `sinceHit` 1.00 through 3.78 and the arm fully lowering.
Production animation code is unchanged by that fixture correction.

Parent accepts the complete V16 moving source after independently opening
the frontal heal, corrected walk/stop recovery and full idle sheets plus
the earlier source cycle. The raised elbow/cuff stays sewn, the tonic
remains gripped and upright, recovery lowers and idle settles. Separate
runtime reduction is now authorized. Approved master SHA256 is
`6f6332851fb6356af7d381fb1c8c0c80eff05fdea8e6673abc92c76e92b1c4b2`;
approved source GLB SHA256 is
`92e79e17b9929268c01475a577040898d0f2e39caba0620cf59a23a59a56e96b`.
Those files are not overwritten by the runtime workflow.

Fresh painted portrait v1 is preserved with its prompt, but its tall
composition cuts off the tonic in a square crop. Root accepts the new
independent square v2, with the whole cork/vial, grip, cap, face and satchel
inside the card. Its exact bytes are copied to
`assets/arena/cards/card-medic-v8-a.png`, and exact prompt to
`portraits/medic-v8-a.txt`. Both generated sources and prompts remain in
`work/arena/2026-10-04-vgm/medic/card`. No image references or image edits
were used.
