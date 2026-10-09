# Dino and Sumo: v9 card portraits

Fresh independent generations for the quality-first anatomical rebuild,
4 October 2026. Built-in image generation, from written briefs only;
no image references or image edits. Sources are preserved at
`assets/arena/cards/card-ogre-v9-a.png` and
`assets/arena/cards/card-sumo-v9-a.png`.
Root rejected the v9-a sources for photorealistic CGI styling. Their anatomy
and action were readable, but they did not match Arena's painted action-card
language. They remain preserved as rejected candidates.

## Dino v9-a: exact prompt

```text
Use case: stylized-concept
Asset type: square full-bleed Arena game card portrait, one original character, no text.
Scene/backdrop: prehistoric terrain with warm ochre earth, a few distant ferns and layered forest shapes. Keep the environment simple and softly out of focus so the character reads at thumbnail size.
Subject: a powerful forest-and-olive Tyrannosaurus charging into a bite. Its heavy ribcage is low and almost horizontal, balanced by a long tapering muscular countertail extending rearward in a shallow natural curve. A short strong neck carries a deep angular skull with a substantial muzzle, a clear jaw hinge, recessed amber eyes under shaped reptilian brows, small nostrils, ivory teeth and a dark mouth interior. Show two tiny arms, each with two distinct fingers, strong bent thighs, knees and hocks, and three weight-bearing clawed toes on each grounded foot. The animal's body, neck, skull, limbs and tail form one coherent anatomy.
Style/medium: polished dimensional illustrated collector miniature, mature sculpted forms, restrained painterly finish, convincing anatomy and tactile materials. The character belongs in the terrain rather than on a display base.
Composition/framing: square 1:1, one character filling the image in a dynamic three-quarter view. Capture the forward biting charge with a readable head and grounded powerful stance; retain the complete head, feet and long rear tail inside the image. Use depth and a gently diagonal silhouette to fit the long animal without a tiny subject. Keep the two-finger arms readable.
Lighting/mood: warm late-morning sunlight, cool soft bounce, clear cast shadows and restrained highlights that reveal the skull, ribcage, knees and tail volume.
Materials/palette: satin forest/olive hide, darker dorsal markings, warm ochre underside, subtle flattened reptile scales with a deliberate size hierarchy, distinct ivory teeth and dark horn claws; amber eyes remain a small strong focal detail.
Constraints: original design, complete connected silhouette, one head and one tail, readable charging action at small size. No text, letters, numbers, UI, frame, watermark, logos, plinth or card border.
Avoid: inflated capsule anatomy, giant spherical thigh masses, round shoulder pods, chicken-like upright torso or upright curled tail, short stub tail, dinosaur armor, extra limbs, extra fingers, fused toes, detached anatomy, exaggerated toy joints and busy background.
```

## Sumo v9-a: exact prompt

```text
Use case: stylized-concept
Asset type: square full-bleed Arena game card portrait, one original character, no text.
Scene/backdrop: a sunlit arena courtyard with warm stone paving and softly blurred timber-and-stone architecture. Keep the background simple so the athlete and his palm strike read at thumbnail size.
Subject: an original believable adult heavyweight sumo wrestler delivering a powerful open-palm strike from a stable low stance. His broad chest, clavicles, trapezius and sloping shoulders flow continuously into proportionate upper arms, elbows, tapering forearms and hands. A substantial weighted soft abdomen sits over a defined waist and strong bent legs with shaped thighs, knees and calves, both bare feet planted. The striking palm has exactly five anatomically distinct fingers including the thumb, with natural knuckles, wrist and elbow; the other arm remains clearly connected and supports his balance. His face has adult planes, a focused expression and a proportionate head. Black hair forms a credible folded topknot.
Clothing: close woven navy-blue mawashi with cloth tension, restrained layered folds, a back knot and pale cords at the front. Keep the garment visibly woven and fitted around the waist.
Style/medium: polished dimensional illustrated collector miniature, mature sculpted anatomy, restrained painterly finish and tactile skin, hair and cloth. He is an original athlete, not a likeness of any real person.
Composition/framing: square 1:1, one large character in a dynamic three-quarter view, focused face and open five-finger palm readable. Show his complete connected silhouette from topknot to grounded feet, with limited foreshortening so the palm, elbow, shoulders and stance remain coherent. Let the athlete fill the image without cropping his hands or feet.
Lighting/mood: warm late-morning sun, cool soft bounce, clear soft cast shadow; use highlights to reveal the shoulder transition, elbow bend, belly weight and woven fabric.
Constraints: believable human anatomy, exactly two arms and two legs, natural hands and feet, one character, readable striking action. No text, letters, numbers, UI, frame, watermark, logos, plinth or card border.
Avoid: inflated capsule limbs, detached shoulder caps, giant spherical thigh masses, disconnected joints, extra or fused fingers, oversized palm, baby face, superhero six-pack, a costume belt, plastic shiny skin and a busy background.
```

## Review record

Both original PNGs are 1254 × 1254, square and full bleed. The Dino
has a complete horizontal body and rear tail, readable recessed amber eye,
two small arms, a strong biting jaw and planted clawed feet. The Sumo
has a connected adult shoulder/arm silhouette, an open five-finger palm,
weighted abdomen, bent grounded legs, black topknot and navy woven mawashi.
Neither image has text, UI, frame or a display base. The rendered materials
lean toward realistic CGI; root review must assess their fit with Arena's
collector style before integration. The current source prompts were used
exactly as written above, with no references.

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| `card-ogre-v9-a.png` | 2,697,225 | `42f518650f6d9e9a2a8874ba0da5a4298a0bd2db03f0b28fdb695e0570346017` |
| `card-sumo-v9-a.png` | 2,169,004 | `81b762c0b8261d2b5550e773b04023530a1084d0a24bca50cc5061d3a3487f48` |

Default generation originals are also preserved under
`/Users/williamguinaudie/.codex/generated_images/01a1077a-42b6-7281-8b64-b4b6831d9f07/`:
Dino `exec-519c244e-f647-4683-ad50-e6fbe2ba36b5.png`,
Sumo `exec-75f7f52c-6b13-4f48-b6a1-dae58472f629.png`.
These portraits do not establish approval of the models, animation or final
runtime geometry. No portrait manifest has been changed.

## Dino v9-b: exact prompt

```text
Use case: stylized-concept
Asset type: square full-bleed illustrated Arena action card, one original character, no text.
Primary request: premium stylized illustrated 3D animation character art with bold shaped planes, hand-painted color masses and a strong readable action silhouette. The result must clearly look like a painted fantasy game illustration with dimensional sculpted forms.
Subject: an original powerful forest-and-olive tyrannosaur charging into a bite. Its low horizontal ribcage and short strong neck balance a long tapering rear countertail held in a shallow natural sweep. Give it a deep angular skull, recessed amber eyes beneath decisive reptilian brows, a substantial hinged jaw, ivory teeth and a dark recessed mouth. Show tiny two-finger arms, strong bent thighs flowing into knees and hocks, and three distinct clawed toes on each grounded foot. Maintain a complete connected body and balanced prehistoric anatomy, stylized through clear large shapes.
Style/medium: a polished illustrated collector character from an original stylized animated adventure. Paint the lit and shadow planes in broad deliberate color shapes; use soft cel-like light and subtle visible brush variation. Simplify the eyes, expression and scale pattern for a bold thumbnail. Tactile satin surfaces with understated flattened scales, shaped rather than densely textured. Warm ochre underside, olive and forest-green upper body, ivory teeth, dark claws. Mature confident character design, expressive and sculptural.
Scene/backdrop: warm prehistoric earth with a few broad fern silhouettes, softly painted distant jungle and small lifted dust shapes. Background detail stays quiet behind the action.
Composition/framing: square 1:1, one character filling the picture in a dynamic three-quarter charging view. Use mild foreshortening and a gently diagonal silhouette to retain the complete long tail, head and feet inside the square while keeping the face large and legible. The tail extends behind the low trunk as a counterweight. The biting action and two small arms must read at 90 pixels.
Lighting/mood: warm golden key light and cool soft painted shadows, crisp separation of major color planes, restrained highlights and soft cast shadow, lively cinematic action.
Constraints: one coherent original tyrannosaur, one head, one long tail, exactly two tiny arms and two hind legs. Square full bleed. No text, letters, numbers, UI, frame, border, logo, watermark, display base or plinth.
Avoid: photorealistic CGI, dinosaur documentary reconstruction, realistic photographic skin, pore-scale texture, dense microdetail, plastic toy gloss, inflated capsules, giant spherical thighs, shoulder balls, upright chicken-like trunk, upright curled tail, short stub tail, armor, detached joints, extra limbs or fused toes.
```

## Sumo v9-b: exact prompt

```text
Use case: stylized-concept
Asset type: square full-bleed illustrated Arena action card, one original character, no text.
Primary request: premium stylized illustrated 3D animation character art with bold shaped planes, hand-painted color masses and a strong readable action silhouette. The result must clearly look like a painted fantasy game illustration with dimensional sculpted forms.
Subject: an original adult heavyweight sumo wrestler delivering a decisive open-palm strike in a low stable stance. Broad chest, clavicles and sloping shoulders connect naturally to tapered upper arms, bent elbows, forearms and hands. His substantial weighted abdomen rests over a defined waist and strong bent legs with shaped thighs, knees and calves; both bare feet are planted. The striking palm has exactly five distinct fingers including its thumb with clear natural knuckles, wrist and elbow. The supporting arm remains visible and connected. Give him a simplified expressive adult face with focused eyes, broad brows, a shaped nose and a determined closed mouth, and black hair in a folded topknot.
Clothing: a close woven navy-blue mawashi with broad painted fold shapes, a fitted waist, credible back knot and pale cords at the front. Keep the cloth soft and substantial, with restrained woven detail.
Style/medium: a polished illustrated collector character from an original stylized animated adventure. Sculpt the anatomy with clear large forms and paint the light and shadow in broad deliberate color shapes. Use soft cel-like light, subtle brush variation and expressive face simplification. Smooth warm skin with understated tactile shading; shape and gesture carry the character. He is an original mature athlete rather than any real person's likeness.
Scene/backdrop: a warm arena courtyard with painted stone paving and softly simplified timber architecture. A little lifted dust and a single painted motion sweep emphasize the palm strike; the environment stays quiet behind him.
Composition/framing: square 1:1, one character filling the picture in a dynamic three-quarter view. Show the complete connected silhouette from topknot to grounded feet, including both hands. Keep the focused face and five-finger open palm large enough to read at 90 pixels, with controlled foreshortening so the shoulder, elbow and wrist remain coherent.
Lighting/mood: warm golden key light and cool soft painted shadows, clear separation of broad color planes, restrained highlights, soft cast shadow and lively cinematic action.
Constraints: one original adult wrestler, exactly two arms and two legs, natural five-finger hands, credible weighted belly and grounded stance. Square full bleed. No text, letters, numbers, UI, frame, border, logo, watermark, display base or plinth.
Avoid: photorealistic CGI, skin photography, realistic pores, body hair, documentary realism, plastic gloss, inflated capsule limbs, detached shoulder caps, giant thigh balls, six-pack superhero anatomy, baby face, oversized palm, disconnected joints, extra or fused fingers and busy background.
```

The v9-b candidates are fresh independent built-in generations from these
written briefs only, with no prior images or references supplied.

## v9-b review record

Both sources are 1254 × 1254 PNGs, square and full bleed, without text or UI.
The Dino has a complete rear tail and grounded charging silhouette, forest
and ochre painted masses, a recessed amber eye and a legible biting mouth.
The Sumo has a connected adult shoulder/arm silhouette, a distinct five-finger
palm, weighted belly, bent legs, folded topknot and a fitted navy mawashi.
Broad painted planes and simplified facial features bring both closer to
the existing v7 illustrated cards than the rejected photorealistic v9-a.

The 90-pixel comparison preview is preserved at
`work/arena/2026-10-04-contact/portraits-v9b-90px.png`. The complete silhouettes
give the faces less image area than v7's tight crops, while the bite and palm
action remain readable. The Dino's palette is intentionally forest/ochre
rather than the previous blue/gold. The parent reviewed and passed both full
sources and the 90-pixel comparison for style, anatomy and readable action.
The parent owns their final portrait mapping.

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| `card-ogre-v9-b.png` | 2,313,823 | `cf4cc316949baa27d8dc023d5078519515eddf2d4700f35ec37c2f6cb46d2c24` |
| `card-sumo-v9-b.png` | 2,174,694 | `8f3bdf73f4628e64ddf3e48cf64636357f880a0fe9940e1fa8c5a3a57f0cdf94` |

Default originals remain in the same generation directory listed above:
Dino `exec-51735a79-685a-411f-9270-b91f528f3548.png`,
Sumo `exec-3dbf2956-3726-415a-aecf-045aa5206312.png`.
