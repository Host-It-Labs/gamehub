# Samurai review record

This records author observations and root review separately. It is not user acceptance.

## Preservation and integration contract

Original Samurai source, private modelling kit and motion file are retained under `work/arena/2026-10-04-three-characters/duelist/original`, with byte counts and SHA-256 evidence. Source V1 and its export are preserved; its failed colour-channel gate is recorded in `review/v1-build.log`.

V2 removes competing joined colour layers without changing anatomy. Its detailed source has 1,505,148 triangles and one native driver skeleton. Blender dimensions are `[.6754385, 1.2675471, 1.9290000]` (X width, Y depth, Z height), matching the original measured dimensions to rounding. The isolated GLB is 59,541,836 bytes. This is unrestricted source evidence, not the final budgeted game asset. Source and export use only the combined `AO` colour channel, which exports as `COLOR_0`.

## Portraits

The first fresh generated candidate is rejected and preserved: photographic skin, cropped crest and overly prominent banner. The second is preserved as `assets/arena/cards/card-duelist-v10-a.png`, with exact prompt and hashes under this concept's prompts and the work portraits folder. Author inspected its 90-pixel view: the cobalt silhouette, gold U crest, pale cords and separate fists remain readable. Root independently opened full source and 90-pixel view and passed the portrait for integration. Top margin is tight but the crest is uncut. Root review does not imply user acceptance.

## Motion checks

Four focused existing motion tests passed after adding real elbow frames and holding them at the Samurai's original fixed bent pose: Samurai deployment/crouch handoff, grounded walkers, finite deployment/walk/fighting/stopping/hit poses across all field troops, and stun/stride recovery. `motion-v1.log` records the run. These checks establish finite motion and pose ownership; they do not establish visual anatomy, material finish or fist contact in the new model. The root still needs actual moving renderer review.

## Source visual review

Author opened V2 front and side clay. The adult nose/jaw/lip planes, compact separated fingers, connected upper sleeves and native katana stance improve the source. Root independently opened V2 front and declined anatomy acceptance: dark collar/strap gaps require tucked cloth coverage, and the thighs still read as inflated smooth puffs. The front framing clips soles and touches the banner. Root requested full-silhouette margins, face/grip/extreme pose evidence, and Eevee clay views.

V3 is a contained refinement of that preserved master: deeper/sloped upper-robe sections fill the collar recesses; hakama thighs are narrower and gain deep box pleats with vertical tension, localized knee compression and tighter calf transition. Hard armour, face, hands, all bone positions, blade and global scale remain unchanged. The studio camera now fits vertical height and horizontal aspect correctly with 17 percent silhouette margin. Clay reviews use Eevee with the same neutral studio rig to avoid multi-minute CPU render frames. The author stopped only their positively identified V2 renderer (PID 53877) after its source, export, front and side were preserved.

Author opened V3 front, side, rear, quarter, face, both grips and overhead/cleave/coil. Root independently reviewed the complete clay set and accepted its primary forms: tighter hakama box pleats, covered/tucked collar, complete silhouette margins and adult face. Root withheld final source acceptance pending the black oval seen in raised-arm views, clean material details and actual motion.

The isolated V3 surface investigation found that oval outside the character hierarchy: the discarded original `duelist-robe` remained visible in the Blender scene. Its original dark shader and fixed position polluted pose renders, though the filtered export already excluded it. V4 explicitly deletes the obsolete construction mesh and asserts that every visible mesh belongs to the reviewed character. V3 and the isolated diagnostic views remain preserved.

V4 retains exact V3 hand and face geometry. Its forearm splints now fit the actual connected cloth surface by local ray intersections, leaving one millimetre of clearance beneath their three-millimetre metal thickness. Author inspected clay overhead, rear, material coil/overhead, quarter, face, both grip angles and game camera: the oval is gone, cloth remains continuous, and the plates show clean material edges. Both fists retain separate thumb webs and four finger grooves in contact with the shared hilt. The author still sees inherited visor/bowl overlap in the face detail; that remaining construction issue must be resolved before runtime reduction.

V4 remains an unrestricted 1,522,224-triangle master at exact native dimensions. Its evidence reports zero unattached scene meshes, one Samurai-local skeleton and only `COLOR_0` in the export.

At root's request, V5 replaces only the preserved visor's disconnected 66-vertex island. The new brow lip descends away from the bowl band rather than sloping upward into it. Author inspected the targeted face, both-hand frontal grip, overhead and coil evidence: the gold band is continuous and the projecting gold lip has a clear seam. Existing face, hand, cloth, armour, control objects, native bounds and source triangle count remain unchanged.

Root independently opened V5 corrected material face/whole/grips and overhead/coil evidence. Root then recorded 16 seconds of actual Arena walk, turn, cut and recovery, plus six seconds of deployment, and opened the complete sequential sheets. Root passed the source gate: full banner/crest margins, coherent armour clearance, continuous cloth, both fists on the hilt and knee/ankle stance. Root authorized a separate runtime copy under the original 19,140-triangle ceiling. This is technical/artistic review, not user acceptance.

## Separate runtime copy

The runtime allocation reserves geometry for the adult face, finger divisions, sleeve joins and hakama tension. It keeps the blade, tip and grip geometry unchanged. Curvature collapse operates on the undeformed mesh and retains its real armature; interpolated weights are normalized after reduction. Native scale stays one. The runtime helper is the default production build path; `DUELIST_MASTER=1` retains an unrestricted build, and the review helper always builds or loads a separate master. No shared manifest or bundle is written here.

Runtime V1 is preserved, including its complete same-camera review set and cost/weight report. Its exported count is 18,779 triangles (three degenerate triangles drop during GLB export), 83 expanded meshes/draws, 20 materials and 1,094,700 bytes. Its three real skins have normalized weights, all four named arm/forearm joints influence vertices, and an independently cloned skeleton deforms without changing the original. Root passed silhouette, cloth, grip and pose clearance against V5, but rejected large triangular blue/gold intrusions on the forehead band introduced by global collapse. The author also sees the same boundary distortion on the small neck collar.

Runtime V2 preserves every source lacquer/gold helmet face and the exact standing collar island. Their shared material edges and descending visor clearance bypass collapse; only surrounding organic head geometry and torso engineering reduce. All other accepted V1 allocations stay unchanged. This uses the spare original-budget headroom and preserves the detailed master.

Author opened matching V5/V2 material face, both-hand frontal grip, overhead and coil, plus V2 clay side/rear and the intended game camera. The continuous gold forehead band and visor match the master; the adult nose/jaw/lip planes remain readable. Separate finger divisions and thumb webs survive, both hands stay around the hilt, and the connected shoulder/leg garments keep pleat tension and knee/ankle coverage in the posed views. Runtime triangle facets are visible at close range; the source remains available for future refinements. Root's final game-copy moving/integration review is pending.

`runtime-v2-helmet-preservation.json` verifies all 1,656 protected lacquer/gold helmet triangles against the source GLB: triangle positions and material assignments are exactly equal. Another 108 source collar triangles bypass reduction. Default production builds use the reviewed runtime strategy; `DUELIST_MASTER=1` requests source explicitly.

| Measure | Detailed V5 | Runtime V2 |
| --- | ---: | ---: |
| Exported triangles | 1,522,224 | 19,079 |
| Measured original triangle ceiling | unrestricted source | 19,140 |
| Exported bytes | 60,572,524 | 1,111,924 |
| Expanded renderer meshes / single-pass draws | source review only | 83 |
| Materials | source review only | 20 |
| Deforming meshes | 3 | 3 |
| Runtime geometry buffer bytes | source review only | 1,010,394 |

Blender counts 19,082 runtime triangles; three degenerate faces drop during export. Runtime `COLOR_0` is the sole colour channel. All four named arm/forearm joints have nonzero influences: armL 542, armR 454, foreL 273 and foreR 252 exported vertices. Maximum normalized-weight error is `3.91e-8`. An independent skeleton clone moves a selected arm vertex by 0.1 while the original instance remains unchanged. `runtime-v2-costs.json` retains exact costs, SHA-256 and bounds.

Runtime native THREE dimensions are `[.67604136, 1.92900002, 1.26754727]`; height and depth match the original, width differs by 0.09 percent from curvature reduction, and root scale remains exactly one. Named joint positions, both grip centres, blade/tip geometry, action timings and gameplay clearance remain unchanged. The native bent elbow pose is deliberately maintained under the shared two-hand katana constraint. Physical mobile GPU/touch performance is not established by these local export checks; root owns integrated browser verification.
