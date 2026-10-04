# Arena textures v5: richer painted ground (29 September 2026)

William: "The game's too bright. Make it a little bit less bright. And work
on the textures so they look a bit better." The meadow read flat and
plasticky with tiny clover specks (`cartoon-v2/meadow`, washed to a third of
its strength over a flat green), the lanes were a flat terracotta and the
towers' sandstone almost blank. Fresh tiles for the four surfaces that fill
most of the screen: the meadow, the forest floor, the terracotta lanes and
the tower sandstone. Every other tile stays.

Saved as `assets/arena/textures/<name>-v5-{a,b}.png`, two variants each,
all eight launched at once with `codex exec` on the newest Luna
(`gpt-6-luna`, reasoning effort low), built-in `$imagegen`, one image per
run, fresh from text, no reference images. Each prompt is the shared style
paragraph, then the subject line, then the shared negatives, joined by
single spaces, exactly as handed to the image tool; both variants of a tile
use the same prompt, and retries repeat it unchanged.

What changed against the v4 and cartoon-v2 briefs, as instructions: medium
sized painted shapes that read at the game's camera distance (a tile covers
about three metres of ground, 150 to 250 screen pixels), a richer and
slightly deeper palette instead of sunny pale mid-tones, visible soft brush
strokes inside the shapes, and gentle low-frequency colour variation.

Shared style paragraph:

```text
Use case: a production texture for a real-time 3D tower-battle strategy game with a polished, stylised cartoon look, seen from a high camera. Style: premium hand-painted stylised game texture in the manner of a top mobile strategy game: medium-sized readable painted shapes with clean confident edges, visible soft painterly brush strokes inside each shape, gently rounded forms, a soft warm highlight on the top of each form and a richer, deeper tone of the same hue in the gaps between forms. Rich, saturated but tasteful colours with deep mid-tones, never pale, washed out or pastel. Gentle broad colour variation across the tile, two or three close hues drifting softly, but even overall brightness so it repeats cleanly. Crisp at native pixels, much less detail than a photograph: no fine noise, no grit, no speckle, no photographic texture, no micro-scratches, no dark grime. Not flat vector art, not pixel art, no black outlines, no cel-shading lines, no blur. Technical: one seamless tileable square texture. The left edge continues perfectly into the right edge and the top edge into the bottom edge, so the tile repeats without any visible seam. Even detail density over the whole square: no large single feature, no centre focus, no repeating grid of identical motifs. Flat even light from straight above and no strong directional shadows, because the game engine lights the surface; a flat orthographic view straight down from directly above. Format: one square PNG, largest native square size, highest quality. Fresh image from this text only; no input or reference images.
```

Shared negatives:

```text
Must not appear: no text, no letters, no numbers, no watermark, no logo, no border, no frame, no perspective, no horizon, no objects or props other than the surface described above, no people, no vignette, no darkened corners or edges, no lighting gradient, no shadow cast across the tile, no checkerboard, no square patches, no stripes.
```

- **grass** (`grass-v5-{a,b}.png`):

  ```text
  Subject, seen from directly above: a lush stylised meadow lawn painted as soft overlapping clumps of short grass, each clump a small fan of four to seven broad tapered blades about one fourteenth of the tile across, packed closely so no bare ground shows. Rich jade and emerald greens with a slightly deeper blue-green between the clumps and soft warm yellow-green light on the blade tips; a few clumps a little more golden and a few a little more teal, scattered irregularly for gentle variation. No flowers, no clover, no stones, no bare earth, no dark patches, no tiny single blades.
  ```

- **forest** (`forest-v5-{a,b}.png`):

  ```text
  Subject, seen from directly above: a stylised woodland floor of soft rounded moss cushions in deep moss green and olive, each cushion about one tenth of the tile across, with a scattering of simple fallen leaves painted as clean leaf shapes about one twelfth of the tile long in warm ochre, rust orange and olive gold, about twenty leaves spread irregularly over the whole tile, and a little warm brown earth showing between some cushions. No branches, no logs, no mushrooms, no stones, no flowers, no black soil.
  ```

- **path** (`path-v5-{a,b}.png`):

  ```text
  Subject, seen from directly above: a stylised packed earth garden path in warm terracotta and brick-red clay, painted in broad soft patches of slightly lighter peach-terracotta and slightly deeper rust, with a few gentle curved brush-stroke marks as if swept, and a light scattering of small smooth rounded pebbles in cream and warm grey, each about one fortieth of the tile across, about thirty over the whole tile. No grass, no puddles, no ruts, no cart tracks, no large stones, no paving slabs.
  ```

- **stone** (`stone-v5-{a,b}.png`):

  ```text
  Subject, face-on: a smooth continuous carved sandstone surface in warm peach, apricot and cream, painted with broad soft planes and gentle chiselled facets about one fifth of the tile across, soft cream highlights on the raised planes and a slightly deeper dusty coral in the shallow hollows between them, with a few soft painterly strokes following the carving. One continuous stone material, not a brick wall: no blocks, no mortar joints, no cracks, no holes, no moss.
  ```

## Attempt log

One line per generation, appended as each lands. Checks: the full image, a
3x3 tiling at game scale and the mean luminance.

| Image         | Attempt | Result | Notes                                                                                                                                                                                                                                                  |
| ------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grass-v5-a`  | 1       | pass   | dense fans of broad tapered blades (about one twenty-fifth of the tile, smaller than asked), jade to emerald with yellow-green tips; no visible wrap in a 2x2; RGBA; luminance 106. Luna printed no path; the file was taken from the run's own folder |
| `grass-v5-b`  | 1       | pass   | same subject, a little looser, with more teal and golden clumps for variation; no visible wrap; RGBA; luminance 108                                                                                                                                    |
| `forest-v5-a` | 1       | pass   | rounded moss cushions in moss and olive, warm earth between, many ochre, rust and gold leaves (more than twenty); no visible wrap; RGBA; luminance 87. Copied nothing; taken from the run folder                                                       |
| `forest-v5-b` | 1       | pass   | same, darker and more olive, less earth showing; no visible wrap; RGBA; luminance 80. Copied nothing; taken from the run folder                                                                                                                        |
| `path-v5-a`   | 1       | pass   | terracotta clay in soft lighter and deeper patches with swept strokes and small cream and grey pebbles, even; no visible wrap; RGBA; luminance 122                                                                                                     |
| `path-v5-b`   | 1       | pass   | same, larger and more contrasting light patches (blotchier at repeat); no visible wrap; RGBA; luminance 119. Copied nothing; taken from the run folder                                                                                                 |
| `stone-v5-a`  | 1       | pass   | carved apricot sandstone in broad diagonal faceted planes with deeper coral hollows, reads close to a rock face; no visible wrap; luminance 176                                                                                                        |
| `stone-v5-b`  | 1       | pass   | same, softer planes with more cream highlights; no visible wrap; luminance 176                                                                                                                                                                         |

Eight runs, each made exactly one image (one PNG in each session folder);
every saved file matches the PNG in its own run's folder byte for byte.
