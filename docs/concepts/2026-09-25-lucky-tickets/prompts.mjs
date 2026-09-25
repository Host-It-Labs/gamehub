// Exact prompts for the Lucky ticket books, symbol sheet and cover (25 Sept 2026).
const ticket = (shape, style, title, panel, extra = '') =>
  `Use case: game-asset. Create a fresh 2D illustration of ONE single scratch-off lottery-style paper ticket for a cosy video game, seen perfectly face-on, flat, parallel to the screen, no perspective, no tilt, no shadow on the ground, no hands, no coins, no table. Transparent background (alpha) around the ticket; if transparency is unavailable use a perfectly flat pure magenta #ff00ff background with nothing else on it. ${shape} ${style} Printed title verbatim: "${title}", perfectly spelled, in bold custom display lettering integrated into the design, readable at 120px wide; no other words, letters or numbers anywhere except that title. ${panel} The panel is completely empty: flat, evenly lit, a single solid colour, no texture, no grid lines, no symbols, no foil, no scratch marks, no numbers; the game draws its own scratch cells on top of it. ${extra} No currency signs, no dollar signs, no barcode, no fine print, no real brand, no watermark. Original design from this description alone.`;
const square =
  'Inside the ticket, a large empty square play panel with square corners';
export const PROMPTS = {
  'ticket-seven': [
    'portrait 1024x1536',
    ticket(
      'Shape: a classic tall rectangular ticket with softly rounded corners and a perforated tear-off stub strip across the very bottom, the ticket filling about 92% of the canvas height.',
      'Style: 1950s American diner and fairground print: glossy cherry red and cream enamel, chrome silver trim, gold starbursts, a big lucky red 7 emblem beside the title, halftone dots, cheerful and bright.',
      'Lucky Seven',
      `${square} in flat pale cream (#f6ecd4), centred horizontally, spanning about 76% of the ticket width, placed below the title band in the lower-middle of the ticket above the stub.`,
    ),
  ],
  'ticket-twins': [
    'portrait 1024x1536',
    ticket(
      'Shape: a tall ticket whose top edge is two identical side-by-side rounded arches, like twin windows, perfectly mirror-symmetric left to right, straight sides and a straight bottom edge with rounded corners, filling about 92% of the canvas height.',
      'Style: art deco night: deep violet and midnight indigo with polished silver linework, two mirrored crescent moons and small stars, fine fan and sunray patterns, elegant and calm.',
      'Twins',
      `A large empty play panel with square corners in flat pale lavender-grey (#e9e4f0), slightly wider than tall (about 5 wide by 4 tall), centred horizontally, spanning about 78% of the ticket width, in the lower-middle of the ticket below the title.`,
    ),
  ],
  'ticket-path': [
    'portrait 1024x1536',
    ticket(
      'Shape: a tall seed-packet style ticket whose entire outline is scalloped with small even rounded waves on all four sides, filling about 92% of the canvas height.',
      'Style: Victorian botanical engraving, hand-coloured: fresh leaf green, rose pink, cream and a little gold; climbing roses, clipped box hedges and a winding gravel path framing the panel.',
      'Garden',
      `${square} in flat pale cream (#f3eed8), centred horizontally, spanning about 76% of the ticket width, in the lower-middle of the ticket below the title.`,
    ),
  ],
  'ticket-ladder': [
    'portrait 1024x1536',
    ticket(
      'Shape: a tall narrow tower-shaped ticket, about 62% of the canvas width and 94% of its height, centred, with a rounded arch at the top and straight sides with small notches like ladder rungs along both edges.',
      'Style: Swiss modernist poster: bold flat colour bands running from cool teal at the bottom through yellow to hot orange-red at the top, crisp black geometric linework, a simple ladder motif, energetic and graphic.',
      'Ladder',
      'A large empty play panel with square corners in flat off-white (#f4f1ea), about 3 wide by 5 tall, centred horizontally, spanning about 74% of the ticket width, filling most of the ticket below the title.',
    ),
  ],
  'ticket-mine': [
    'portrait 1024x1536',
    ticket(
      'Shape: a tall octagonal plate with the four corners cut off diagonally, made to look like a riveted iron-banded wooden mine sign, filling about 92% of the canvas height.',
      'Style: Wild West woodcut: weathered pine planks, black iron bands with round rivets, lantern-lit amber highlights, sparkling rubies, emeralds and gold nuggets tucked in the corners, a crossed pickaxe emblem.',
      'Gold Mine',
      `${square} in flat pale parchment (#efe3c8), centred horizontally, spanning about 76% of the ticket width, in the lower-middle of the plate below the title.`,
    ),
  ],
  'ticket-sunmoon': [
    'square 1024x1024',
    ticket(
      'Shape: a perfectly circular medallion ticket filling about 94% of the canvas, with a thin ornamental rim; the title arches along the top of the rim.',
      'Style: celestial gold-leaf ornament: deep night blue on one half and warm saffron on the other, a radiant golden sun at the top left of the rim and a silver crescent moon at the top right, fine star-map linework, rich but clean.',
      'Sun & Moon',
      'A large empty square play panel with square corners in flat pale cream (#f5efdf), centred slightly below the middle of the circle, its corners touching just inside the rim, about 60% of the circle diameter wide.',
    ),
  ],
  'ticket-chart': [
    'landscape 1536x1024',
    ticket(
      'Shape: a wide sheet of antique parchment with deckled, softly torn edges all round, filling about 94% of the canvas width.',
      'Style: 18th-century nautical chart engraving: sepia and ink blue on aged parchment, a compass rose, rhumb lines, a small sailing ship and a sea serpent in the left margin, subtle watercolour washes.',
      'Sea Chart',
      'A large empty square play panel with square corners in flat pale sea blue (#e3eef0), on the right-hand side of the sheet, spanning about 78% of the sheet height, vertically centred; the title and the compass rose sit on the left third.',
    ),
  ],
  'ticket-crown': [
    'portrait 1024x1536',
    ticket(
      'Shape: a heraldic shield: flat top edge with two small points, straight sides, curving to a single point at the bottom, filling about 94% of the canvas height.',
      'Style: royal regalia: deep crimson velvet, gold filigree borders, cut rubies, sapphires and emeralds set into the frame, a jewelled crown above the title, luxurious and sparkling.',
      'Crown Jewels',
      `${square} in flat pale cream (#f4ebd9), centred horizontally, spanning about 72% of the shield width, in the middle of the shield below the title, well above the bottom point.`,
    ),
  ],
  symbols: [
    'square 1024x1024',
    'Use case: game-asset sprite sheet. Create a fresh sheet of exactly 16 separate glossy scratch-ticket prize symbols arranged in a strict 4 by 4 grid, each symbol centred in its own equal square cell with generous empty padding, none touching or overlapping, all the same visual size. Transparent background (alpha); if transparency is unavailable use a perfectly flat pure magenta #ff00ff background. Row 1: a bold lucky red numeral 7 with a gold outline; a pair of red cherries on a green stem; a golden bell; a green four-leaf clover. Row 2: a stack of three gold coins; a shining five-pointed gold star; a silver crescent moon; a golden smiling-free sun disc with rays (no face). Row 3: a blue cut diamond; a red cut ruby; a gold bar; a red stick of dynamite with a lit fuse. Row 4: a pink rose flower; a small wooden sailing ship; a jewelled gold crown; a golden horseshoe. Style: chunky, cheerful, polished enamel and metal with a bright highlight and a soft dark outline, like the prize symbols on a classic scratch card, readable at 40px. No text or letters apart from the numeral 7, no cell borders, no grid lines, no background shapes.',
  ],
  cover: [
    'square 1024x1024',
    'Use case: illustration-story. Create a fresh full-bleed square 2D illustrated board-game cover, largest native square size, PNG. Text verbatim: "Lucky", no other text, letters or numbers anywhere. A cosy shared game of scratch tickets for one to six friends: each ticket is a little puzzle to scratch (a hunt for a lucky seven, a garden path, a gold mine, a sea chart, crown jewels), coins pile up and a tiny tabletop factory prints more tickets. Style: warm storybook gouache painting of a cosy wooden games table at golden hour, deep teal (#1f4d4f) and polished copper (#b8733a), cream paper (#f6e3bb), cherry red and gold accents; gentle lamplight from the upper left, visible brush texture, tactile and inviting, not cluttered. Composition: in the lower two thirds a generous spread of five differently shaped paper scratch tickets on the table (a tall red ticket with a lucky seven emblem, a scalloped green garden ticket, an octagonal wooden mine plate, a torn parchment sea chart, a crimson shield with jewels), each with silver scratch-off foil; the front one is half scratched with silver foil curls lifting off, revealing a glowing red 7 and a gold star; a brass coin resting on it; small stacks of coins and sparkles of foil dust. In the background on the right, a charming miniature copper ticket press with a short conveyor belt at toy scale. Leave a clear open band of dark teal background above the title, at least one tenth of the image height, nothing touching the top edge; the top of the title letters starts no higher than 11% down from the top edge. Make the title "Lucky" huge across the upper centre, in a chunky rounded vintage display serif, burnished gold foil letters with a scratched metallic sheen, a thin cream outline and a cherry red drop shadow, perfectly spelled L-u-c-k-y, readable at 160px. All title letters within the central 84% of the canvas. Artwork fills every edge to the border. No real money, no casino, no slot machines, no playing cards, no dice, no people. Not cut paper, not risograph ink printmaking, not a retro TV game show, not neon. No UI, no game screenshot, no counters, no digits, no border, no frame, no mat, no physical box mockup, no additional lettering. Original composition from this description alone.',
  ],
  wide: [
    'landscape 1536x1024',
    'Use case: illustration-story. Create a fresh full-bleed landscape 2D illustrated board-game lid banner, PNG. Text verbatim: "Lucky", no other text, letters or numbers anywhere. The image will be cropped to its middle horizontal band (from 33% to 67% of the height, a 3:1 strip), so the title and every important subject must sit entirely inside that middle band; the top and bottom thirds hold only expendable background (table wood, soft wall, lamplight). A cosy shared game of scratch tickets that are little puzzles, with coins piling up and a tiny tabletop ticket press. Style: warm storybook gouache painting of a cosy wooden games table at golden hour, deep teal (#1f4d4f) and polished copper (#b8733a), cream paper (#f6e3bb), cherry red and gold accents; gentle lamplight from the upper left, visible brush texture. Composition inside the middle band: on the left, the title "Lucky" large, in a chunky rounded vintage display serif, burnished gold foil letters with a scratched metallic sheen, a thin cream outline and a cherry red drop shadow, perfectly spelled L-u-c-k-y, the letters filling most of the band height; on the right, a row of differently shaped scratch tickets laid flat (a tall red lucky seven ticket half scratched with silver foil curls revealing a red 7, a scalloped green garden ticket, an octagonal wooden gold mine plate, a crimson jewelled shield), a few gold coins and sparkles of foil dust, and a small copper ticket press at toy scale at the far right. Artwork fills every edge. No real money, no casino, no slot machines, no playing cards, no dice, no people. No UI, no border, no frame, no additional lettering. Original composition from this description alone.',
  ],
};
