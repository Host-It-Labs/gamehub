# Cowboy: detailed source brief

This is a large visual rework of Arena character `ranger`, following the
mandatory high-fidelity-3d skill. Original source, movement and portrait are
byte-preserved under `work/arena/2026-10-04-three-characters/ranger/original`.
Unrelated in-progress assets and shared runtime files remain root-owned.

## Character and form

An original mature 1880s frontier rifleman with a calm confident expression,
a firm jaw, shaped cheekbones, a weathered brow, a credible projecting nose,
restrained stubble and recessed hazel eyes. Adult anatomical planes replace
the broad painted eye patches; no enlarged baby head or inflated arm masses.
The hat is a broad brown felt cattleman brim with a pressed crease, leather
band and small brass buckle. Keep the original recognizable dimensions and
rest pivots: feet at ground, facing +Y, Z-up in Blender, native crown near 1.36.

His coat is a substantial sand canvas duster: sloping shoulder seam, shaped
sleeve, soft inner-elbow tension, a rolled cuff, a turned-down collar, folded
lapels, top stitching, horn buttons, a left flap pocket, a buttoned rear
half-belt and a vented hem. Blue shirt and neckerchief, dark leather waistcoat,
a tiny brass star, charcoal trousers and worn brown riding boots give clear
material separation. The belt's cartridges, holster tie and spurs are credible
small fittings. Cloth is heavy and matte; leather is softly polished only at
contact edges.

## Hands and weapon

Each anatomically shaped hand has a coherent palm, thenar mass, thumb web,
four individually curled fingers and restrained fingernails. The right hand
grips the walnut wrist beside the lever; the left supports the fore-end.
Keep the existing rifle frame, named `weapon`/`extra2` pivots and muzzle.
Add clean machining, receiver screw heads and restrained walnut grain.
The rifle stays clear of coat and head during shoulder carry, staged lowering,
aimed shot, recoil and lever recovery; keep its two-hand aim geometrically.

## Deformation and finish

Build continuous sculpted cloth sleeves with smooth arm/forearm weights
instead of a spherical elbow and disconnected tubes. Keep named shoulder
and elbow bone drivers at the exact motion contract positions; attach the
hands, cuffs and rifle rigidly to the appropriate forearm. Continuous wool
trousers blend across the knee between native hip and knee bones. Shoulder cloth
blends into the upper coat with an overlap inside the seam. Boots keep
their hidden ankle socket and the long duster halves keep the existing
walk-following pivots. Inspect extreme arm poses and the full runtime cycle.

Skin uses the supported matte `skin` family, hair uses `hair`, felt/canvas
use `weave` and `drape`, leather `hide`, walnut `wood`, and hardware `gilt`.
Author subtle pigment and crease shadows as generic non-exporting data,
then combine with baked AO into the single active `COLOR_0` layer. Keep
secondary relief hierarchical; avoid uniform noisy texture or plastic gloss.

## Review and runtime copy

Save an editable master before any reduction. Render honest neutral clay
front, side, rear and three-quarter, face and hand close-ups, neutral material
views and intended game camera. Open every relevant render and record defects.
The parent independently reviews both source stills and live source motion
before optimization. A separate runtime copy targets the existing person
reduction target of 12,500 triangles if quality permits, with preserved
silhouette, face, fingers and rifle fittings. The measured original Ranger is
17,200 triangles, 61 meshes and 13 materials; never exceed that runtime
triangle baseline or weaken tests. Compare the copy in
the same cameras and full movement cycles. Fresh matching action-card art
uses a written brief only, no image references and no generated image edits.
