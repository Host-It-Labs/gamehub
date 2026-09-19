# Observatory detail v9

Fresh built-in imagegen generation on2026-09-16 from approved v8 as material/layout reference. Asset: `public/art/observatory-detail-v9.png`. Requested native3072 ×2048, ideally4096 ×2730; **actual1536 ×1024**, verified with `sips -g pixelWidth -g pixelHeight`. No upscaling; do not claim4K or new native-resolution capability. The built-in tool exposes no explicit sizeparameter.

## Visual review and dimensional variance

All17 blankpads are present in sixgroups4/4/2/3/3/1. Layeredpaperedges are cleaner and sanctuary occupies more nativepixels thanv8. Outerwaste isreduced andtopskyremoved. Coherentforestleft/farmright. Some nearestforeground softness persists despite noDOF request.

Requestedlogicalcrop was636 ×424 at450,246. Generation overshot slightly: fullpadedges are approximatelyx439..1110,y230..670, and highestnurserycenters areat246. A **safe physical3:2 crop containing completepads is x432,y220,width690,height460**. Normalized x28.125%,y21.484375%,width44.921875%,height44.921875%. Crown extends above crop toy75. This safe crop doesnot satisfy the narrower41.4%target. Do not silentlyclaim itdoes. Parent may choose tighterlogicalmapping withillustration/interactionoverflow iflayoutpermits; imageitself mustremain onecontinuousscene.

## Source slot coordinates

Measured visuallyapproximately ±2px against full1536 ×1024. For safecrop convert `x=(pixelX-432)/690*100`, `y=(pixelY-220)/460*100`.

| Habitat | Source pixel centers | Source percent centers |
| --- | --- | --- |
| nursery | 526, 246; 591, 246; 514, 285; 586, 285 | 34.245, 24.023; 38.477, 24.023; 33.464, 27.832; 38.151, 27.832 |
| courtyard | 727, 369; 813, 369; 725, 418; 814, 418 | 47.331, 36.035; 52.930, 36.035; 47.201, 40.820; 52.995, 40.820 |
| grove | 477, 626; 558, 626 | 31.055, 61.133; 36.328, 61.133 |
| trail | 706, 629; 785, 648; 870, 647 | 45.964, 61.426; 51.107, 63.281; 56.641, 63.184 |
| terraces | 1028, 395; 1069, 500; 1069, 603 | 66.927, 38.574; 69.596, 48.828; 69.596, 58.887 |
| lookout | 1004, 285 | 65.365, 27.832 |

Suggestedsourcepixelgeometry (notbrowserverified):

| Habitat | Bounds x/y/width/height(px) | Label center x/y(px) |
| --- | --- | --- |
| Nursery | 475 /217 /153 /91 | 552 /219 |
| Courtyard | 680 /336 /179 /110 | 770 /340 |
| Grove | 435 /592 /164 /66 | 516 /596 |
| Trail | 661 /597 /253 /80 | 787 /600 |
| Terraces | 984 /360 /129 /275 | 1028 /365 |
| Lookout | 964 /254 /81 /51 | 1004 /257 |

No codechanges, browser or touchvalidation. Priorassets preserved.

## Exact prompt

```text
Generate a NEW SINGLE continuous landscape illustration, using supplied image only as approved papercraftstyle/geography reference. IMPORTANT request TRUE NATIVE HIGH RESOLUTION **3072 x 2048 pixels** (landscape3:2), ideally4096 x2730 ifsupported. Render intricate edges at native highresolution, do not resample a smallimage. Need crisp gameboard at desktopdisplay size. Exactaspectratio3:2.

Keep familiar beautiful cream observatory with foldedgreen dome, papercut trees and layeredcardstock cliffs. Sharpen/simplify material shapes: cleanbold cutpaperedges, broad readable leaves, restraineddecoration. No depthoffield,blur,bokeh,softforeground,noiseorhaze. Wholeimage tacksharp.

Measured framing: complete logicalgameplayrectangle occupies41.4% FULLIMAGEWIDTH and41.4% FULLIMAGEHEIGHT. CENTERED horizontally. Its left29.3%,right70.7%,top24%,bottom65.4%. At3072x2048 this logicalrectangle is approximately1272x848 atx900,y492. All seventeen padcenters AND theircomplete edges must lie inside thisrectangle, with usefulmarginforcreatures. Observatorydome crown near15% fullimageheight mayextendabovegameplayrectangle. Tighter composition thanreference: trimunuseddistantmountains/sky andexcessforeground,retain enough coherentforestleft/farmsright.

17blankpaleivoryovalpads in6linkedphysicalhabitats, relativearrangement followsreference:
1 upper-left nursery FOURpads2x2 centers around(36%,31%),(40%,31%),(36%,35%),(40%,35%).
2 central courtyard FOURpads2x2 centers around(47%,41%),(52%,41%),(47%,46%),(52%,46%).
3 lower-left hollowrootgrove TWOadjacentpads around(34%,57%),(39%,57%).
4 lowercentralgreenhousetrail THREEpads around(46%,59%),(51%,61%),(56%,60%).
5 right descendingterraces THREEpads around(63%,42%),(66%,50%),(66%,58%).
6 upperrightwatchpost ONEpad near(63%,32%).
Do not place pads onleft/rightcropboundary; safeedges mandatory. Exactly17 pads total noextras. Padslargeenoughforreadablecreatures, emptyunprinted. Strong domedobservatory behindcourtyard. Realstairs/paths/vegetation connectallspaces.

Outside logicalrectangle, realcontinuouspapercraftland: forest/treehousesleft, meadowfarmvalleyright, paperhills/canopyabove(no blue skyband), stream/paths/plantsbelow. Everyedgeillustrated withoutwastedemptyborder. Thickcardstock cutedges, foldedpaper trees, layeredivorycardboardarchitecturalstone, sage/moss/ochre/blush. Maintain handcraftedminiaturelook; no photorealism/microtinytrees.
NO creatures/animals/standees/cards/text/UI/symbols/logos/frames/vignette/fadededges/repeatedscenes. Singlecoherent freshsource. Primarygoals true3072x2048native sharpresolution and central41.4%logicalcrop containingall17pads withsafemargins.
```

Cache source: `/Users/williamguinaudie/.codex/generated_images/01a0aae0-5e47-76c3-b776-02292d8df58b/exec-97cca8d4-d210-403b-8518-e3ac36b98223.png`.

