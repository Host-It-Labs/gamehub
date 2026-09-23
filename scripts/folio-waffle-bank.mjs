// Builds lib/games/folio/waffle-data.ts: Folio's Waffle puzzles, generated
// offline. Regular waffles use Folio's common five-letter ANSWERS; Deluxe
// waffles use the hand-picked common seven-letter words below, each checked
// against the ENABLE list. Every scramble is proven to need exactly 10 swaps
// (20 for Deluxe) by the exact solver in kinds/waffle.ts.
//
//   node --experimental-strip-types scripts/folio-waffle-bank.mjs [enable1.txt]
import { readFileSync, writeFileSync } from 'node:fs';
import { rng, shuffle } from '../lib/games/folio/kind.ts';
import { ANSWERS, GUESSES } from '../lib/games/folio/words.ts';
import { isHole, minSwaps } from '../lib/games/folio/kinds/waffle.ts';

const ENABLE = process.argv[2] ?? process.env.ENABLE_WORDS;
const OUT = new URL('../lib/games/folio/waffle-data.ts', import.meta.url);
const REGULAR = 60;
const DELUXE_COUNT = 16;
// Starting greens per level for the 21-tile waffle: more greens, gentler.
const GREENS = [8, 6, 5];
const DELUXE_GREENS = 10;

const COMMON7 = `
ABILITY ABSENCE ACADEMY ACCOUNT ACHIEVE ACQUIRE ADDRESS ADVANCE AGAINST AIRLINE AIRPORT ALCOHOL
ALREADY ANCIENT ANOTHER ANXIETY ANYBODY ANYMORE APPLIED ARRANGE ARRIVAL ARTICLE ATTEMPT ATTRACT
AVERAGE BALANCE BALLOON BANDAGE BANKING BARGAIN BARRIER BATTERY BEARING BECAUSE BEDROOM BELIEVE
BENEATH BENEFIT BESIDES BETWEEN BICYCLE BILLION BIOLOGY BISCUIT BLANKET BLOSSOM BONFIRE BOUQUET
BROTHER BROUGHT BURNING CABBAGE CABINET CALLING CAMPING CAPABLE CAPITAL CAPTAIN CAPTURE CARAMEL
CARAVAN CAREFUL CARRIER CARTOON CEILING CENTRAL CENTURY CERTAIN CHAMBER CHANNEL CHAPTER CHARITY
CHEETAH CHICKEN CHIMNEY CITIZEN CLASSIC CLIMATE CLOSING CLOTHES COCONUT COLLECT COLLEGE COMBINE
COMFORT COMMAND COMMENT COMPACT COMPANY COMPARE COMPASS COMPETE COMPLEX CONCEPT CONCERN CONCERT
CONDUCT CONFIRM CONNECT CONSIST CONTACT CONTAIN CONTENT CONTEST CONTEXT CONTROL CONVERT COOKING
CORRECT COSTUME COTTAGE COUNCIL COUNTER COUNTRY COURAGE CRACKER CRYSTAL CULTURE CUPCAKE CURIOUS
CURRENT CUSHION CUSTARD CYCLING DANCING DEALING DECLINE DEFAULT DELIGHT DELIVER DENTIST DEPOSIT
DESERVE DESKTOP DESPITE DESSERT DESTROY DEVELOP DIAMOND DIGITAL DISPLAY DISTANT DIVERSE DOLPHIN
DOORWAY DRAWING DRESSED DRIVING DYNAMIC EARNING EARRING ECONOMY EDITION ELDERLY ELEMENT EMBRACE
EMOTION EMPEROR ENDLESS ENHANCE EPISODE EQUALLY EVENING EXACTLY EXAMPLE EXCITED EXHIBIT EXPENSE
EXPLAIN EXPLORE EXPRESS EXTREME FACTORY FAILURE FARMING FASHION FEATHER FEATURE FEELING FICTION
FIFTEEN FIGHTER FINANCE FINDING FISHING FITNESS FOREIGN FOREVER FORMULA FORTUNE FORWARD FREEDOM
FREEZER FURTHER GALLERY GARBAGE GATEWAY GENERAL GENUINE GESTURE GETTING GIRAFFE GLACIER GLITTER
GRAMMAR GRANITE GRAPHIC GRAVITY GREATER GROCERY HABITAT HAIRCUT HAMMOCK HAMSTER HANDFUL HANGING
HARMONY HARVEST HEADING HEALTHY HEARING HEATING HEAVILY HELPFUL HERSELF HIGHWAY HIMSELF HISTORY
HOLIDAY HOUSING HOWEVER HUNDRED HUNTING HUSBAND ILLEGAL ILLNESS IMAGINE IMPROVE INCLUDE INITIAL
INSIGHT INSPIRE INSTALL INSTANT INSTEAD INTENSE INVOLVE JACKETS JOURNAL JOURNEY JUSTICE KETCHUP
KITCHEN KNOWING LANDING LANTERN LARGELY LASTING LAUNDRY LEADING LEARNED LEATHER LECTURE LETTUCE
LIBERTY LIBRARY LICENSE LIMITED LOBSTER LOGICAL LOYALTY MACHINE MAILBOX MANAGER MANSION MARRIED
MASSIVE MAXIMUM MEANING MEASURE MEDICAL MEETING MENTION MERMAID MESSAGE MILLION MINERAL MINIMUM
MISSING MISSION MISTAKE MIXTURE MONITOR MONSTER MONTHLY MORNING MUSICAL MUSTARD MYSTERY NATURAL
NEITHER NERVOUS NETWORK NEUTRAL NOODLES NOTHING NOWHERE NUCLEAR NURSING OATMEAL OBVIOUS OCTOPUS
OFFICER ONGOING OPENING OPERATE OPINION ORCHARD ORGANIC OSTRICH OUTCOME OUTDOOR OUTLOOK OUTSIDE
OVERALL PACKAGE PAINTER PANCAKE PANTHER PARKING PARTIAL PARTNER PASSAGE PASSING PASSION PATIENT
PATTERN PAYMENT PEANUTS PELICAN PENALTY PENGUIN PENSION PERFECT PERHAPS PICTURE PILGRIM PIONEER
PLASTIC PLAYING PLEASED POPCORN POPULAR PORTION POTTERY POVERTY PRECISE PREDICT PREPARE PRESENT
PREVENT PRIMARY PRINTER PRIVACY PRIVATE PROBLEM PROCEED PROCESS PRODUCE PRODUCT PROFILE PROGRAM
PROJECT PROMISE PROMOTE PROTECT PROTEIN PROTEST PROVIDE PUBLISH PUDDING PUMPKIN PURPOSE PYRAMID
QUALIFY QUALITY QUARTER RABBITS RACCOON RAILWAY RAINBOW READING REALITY REALIZE RECEIPT RECEIVE
RECOVER REFLECT REGULAR RELATED RELEASE REMAINS REPLACE REQUEST REQUIRE RESERVE RESOLVE RESPECT
RESPOND RESTORE RETREAT REVENUE REVERSE ROOSTER ROUTINE RUNNING SANDALS SARDINE SATISFY SAUSAGE
SCIENCE SCOOTER SEASIDE SEATING SEAWEED SECTION SERIOUS SERVICE SESSION SETTING SEVERAL SHAMPOO
SHELTER SIMILAR SITTING SKATING SNOWMAN SOCIETY SOLDIER SOMEHOW SOMEONE SPEAKER SPECIAL SPINACH
STADIUM STATION STOMACH STORAGE STRANGE STRETCH STUDENT SUBJECT SUCCEED SUCCESS SUGGEST SUMMARY
SUNBURN SUNRISE SUPPORT SUPPOSE SUPREME SURFACE SURGEON SURGERY SURPLUS SURVIVE SUSPECT SWEATER
TEACHER TEENAGE TENSION THEATER THEATRE THERAPY THOUGHT THROUGH THUNDER TICKETS TOASTER TONIGHT
TOOLBOX TORNADO TOURISM TOURIST TOWARDS TRACTOR TRAFFIC TRAGEDY TRAILER TRAINER TROUBLE TRUMPET
TURNING TURTLES TYPICAL UNICORN UNIFORM UNKNOWN UNUSUAL UPGRADE UPRIGHT VAMPIRE VANILLA VARIETY
VARIOUS VEHICLE VENTURE VERSION VETERAN VICTORY VILLAGE VINTAGE VIOLENT VIRTUAL VISIBLE VISITOR
VOLCANO WAITING WALKING WALNUTS WARNING WARRIOR WEALTHY WEATHER WEDDING WEEKEND WELCOME
WELFARE WESTERN WHISPER WHISTLE WHOEVER WILLING WINDOWS WINNING WITHOUT WITNESS WIZARDS WORKING
WORKOUT WORRIED WRITING WRITTEN ALLOWED ANSWERS ARRIVED BRIDGES CARRIED CHANGED CHANGES CHARGED
CLEANED CLEARED CLOSELY COOKIES COUPLES COVERED CREATED CROSSED DANCERS DECIDED DRAGGED DREAMED
FILLING FINALLY FLOWERS FOLLOWS GRANTED GREATLY GREETED GUESSED HAPPENS HELPING HOLDING HONESTY
HOPEFUL LEADERS LETTERS LIGHTER MARKETS MATCHED MEMBERS MINUTES MOMENTS NEEDLES NUMBERS ORDERED
PAINTED PARENTS PLANETS PLANNED PLAYERS POCKETS PRESSED PRINTED QUICKLY RAISING REACHED RESTING
RETURNS ROLLING SEASONS SECONDS SELLING SENDING SERVING SETTLED SHADOWS SIGNALS SINGING SINGERS
SISTERS SKILLED SMILING SOUNDED SPIRITS STAMPED STARTED STAYING STORIES STREETS STRIPES STUDIED
TALKING TEACHES TESTING TOUCHED TRAINED TRAVELS TREATED WANTING WASHING WATCHED WINTERS WONDERS
WORKERS WRITERS ANIMALS BANANAS BASKETS BOTTLES BUTTONS CANDLES CARPETS CASTLES DOLLARS DRAGONS
GARDENS HORSES LADDERS MARBLES MEADOWS NAPKINS ORANGES PARROTS PEPPERS PICKLES PILLOWS PIRATES
POSTERS PUZZLES RAISINS SHOWERS TEAPOTS TOMATOES VIOLINS PARADES ORCHIDS LAPTOPS MAGNETS GADGETS
ARTISTS BEACHES BRUSHES CHEESES DINNERS DOCTORS EAGLES FARMERS GLASSES HEROES ISLANDS KITTENS
LEMONS MIRRORS OCEANS PENCILS PLATES RIVERS SAILORS SCARVES SPOONS TABLETS TIGERS TOWERS WAGONS
BEGGING BETTING BIDDING CUTTING DIGGING DRIPPING HITTING HUGGING JOGGING KIDDING NODDING
PLANTED POINTED PRAISED PRIZES REPLIED RETIRED SCORING SHARING SHINING SKIPPED SLIPPED SPARKED
SPOTTED STEPPED STOPPED STORING STUNNED SWIMMER TAPPING TRIPPED WEDDED WINNERS DESIGNS DETAILS
DEGREES EFFECTS EFFORTS EVENTS FACTORS FORESTS GROWING HEADSET INSECTS JOKES LESSONS LOCATED
MOTHERS NATIONS OBJECTS OPTIONS PATIENTS RECORDS RESULTS SCHOOLS SEVENTY SIXTEEN STATUES TARGETS
TEXTILE TOPICS UNITED VALLEYS VOLUMES WEIGHTS ACTRESS ADMIRED ADVISED AMAZING ANCHORS BAGGAGE
BATHTUB BELOVED BLESSED BORDERS BUILDER BURGERS CANDIES CARTONS CELLARS CHAPELS CHARTER
CLERKS CLOSETS COASTER COLLARS CORNERS CRAYONS DAMAGED DESERTS DRESSER EMERALD ENTRIES
FERRIES FINGERS GALAXY GLAMOUR HELMETS HERRING HOTELS JUGGLER LAWYERS LEGENDS
LIMITED LOCKERS MANGOES MEDALS MELODY MINERAL MUSEUMS NEAREST PALACES PEBBLES PICNICS
PLANNER POTATOES RADIANT RECIPES RELAXED ROCKETS SALADS SAMPLES SECRETS SHELVES SILENCE
SLEEPER SOLDIERS SPIDERS STATUES TENANTS TENNIS THREADS TOASTED TRADERS TREASURE
VESSELS WARMEST WESTERN
`
  .split(/\s+/)
  .filter((w) => w.length === 7);

function words7() {
  requireEnable();
  const enable = new Set(
    readFileSync(ENABLE, 'utf8')
      .split(/\s+/)
      .filter((w) => w.length === 7)
      .map((w) => w.toUpperCase()),
  );
  const missing = COMMON7.filter((w) => !enable.has(w));
  if (missing.length)
    console.warn('Not in ENABLE, skipped:', missing.join(' '));
  return [...new Set(COMMON7.filter((w) => enable.has(w)))];
}
function requireEnable() {
  if (!ENABLE) throw new Error('Pass the path to enable1.txt');
}

/**
 * Find waffles of the given size: rows 0,2,.. and columns 0,2,.. are words,
 * row i letter 2j equals column j letter 2i. No word repeats across the bank.
 */
function findGrids(list, size, count, random) {
  const k = (size + 1) / 2;
  const even = (w) => Array.from({ length: k }, (_, j) => w[2 * j]).join('');
  const byFirst = new Map(),
    byPattern = new Map(),
    prefixes = new Set();
  for (const w of list) {
    if (!byFirst.has(w[0])) byFirst.set(w[0], []);
    byFirst.get(w[0]).push(w);
    const p = even(w);
    if (!byPattern.has(p)) byPattern.set(p, []);
    byPattern.get(p).push(w);
    for (let n = 1; n <= k; n++) prefixes.add(p.slice(0, n));
  }
  const used = new Set();
  const grids = [];
  const deadline = Date.now() + 120_000;
  for (const first of shuffle(list, random)) {
    if (grids.length >= count || Date.now() > deadline) break;
    if (used.has(first)) continue;
    const cols = [];
    let found = null,
      steps = 0;
    const inGrid = (w) => w === first || cols.includes(w);
    const search = (j) => {
      if (found || ++steps > 200_000) return;
      if (j === k) {
        const rows = [first];
        for (let i = 1; i < k; i++) {
          const pattern = cols.map((c) => c[2 * i]).join('');
          const options = (byPattern.get(pattern) ?? []).filter(
            (w) => !used.has(w) && !inGrid(w) && !rows.includes(w),
          );
          if (!options.length) return;
          rows.push(options[Math.floor(random() * options.length)]);
        }
        found = { rows, cols: [...cols] };
        return;
      }
      for (const c of shuffle(byFirst.get(first[2 * j]) ?? [], random)) {
        if (used.has(c) || inGrid(c)) continue;
        cols.push(c);
        let ok = true;
        for (let i = 1; i < k && ok; i++)
          ok = prefixes.has(cols.map((w) => w[2 * i]).join(''));
        if (ok) search(j + 1);
        cols.pop();
        if (found) return;
      }
    };
    search(0);
    if (!found) continue;
    for (const w of [...found.rows, ...found.cols]) used.add(w);
    const cells = Array.from({ length: size * size }, () => '.');
    found.rows.forEach((w, i) =>
      w.split('').forEach((c, x) => (cells[2 * i * size + x] = c)),
    );
    found.cols.forEach((w, j) =>
      w.split('').forEach((c, y) => (cells[y * size + 2 * j] = c)),
    );
    grids.push(cells.join(''));
  }
  return grids;
}

/** Word cell lists (rows then columns) of a size×size waffle. */
function wordCells(size) {
  const out = [];
  for (let r = 0; r < size; r += 2)
    out.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c += 2)
    out.push(Array.from({ length: size }, (_, r) => r * size + c));
  return out;
}

/**
 * A Waffle-style scramble: `greens` tiles stay put, the rest are permuted in
 * m - par cycles so the board needs exactly `par` swaps (checked exactly,
 * since repeated letters can open shortcuts), and no moved tile lands on its
 * own letter.
 */
function scramble(grid, size, greens, par, random) {
  const solution = grid.split('').map((c) => (c === '.' ? '' : c));
  const tiles = solution.map((_, i) => i).filter((i) => !isHole(i, size));
  const words = wordCells(size);
  const m = tiles.length - greens,
    cycles = m - par;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const moved = shuffle(tiles, random).slice(0, m);
    const still = new Set(tiles.filter((t) => !moved.includes(t)));
    if (words.some((w) => w.every((i) => still.has(i)))) continue;
    // Split m tiles into `cycles` cycles of length >= 2.
    const lengths = Array.from({ length: cycles }, () => 2);
    for (let extra = m - 2 * cycles; extra > 0; extra--)
      lengths[Math.floor(random() * cycles)]++;
    const letters = [...solution];
    let at = 0;
    for (const n of lengths) {
      const cycle = moved.slice(at, at + n);
      at += n;
      cycle.forEach((p, t) => (letters[cycle[(t + 1) % n]] = solution[p]));
    }
    if (moved.some((p) => letters[p] === solution[p])) continue;
    if (minSwaps(letters, solution) !== par) continue;
    return letters.map((c) => c || '.').join('');
  }
  throw new Error(`No scramble for ${grid}`);
}

const random = rng(20260922);
// A few ANSWERS that are less everyday than the rest.
const RARE = new Set(
  'LORRY VIOLA TUNER OXIDE CUBIC ULTRA REMIX QUOTA KNEAD CIVIC'.split(' '),
);
const five = [...new Set(ANSWERS)].filter(
  (w) => GUESSES.has(w) && !RARE.has(w),
);
const regular = findGrids(five, 5, REGULAR, random);
console.log(`regular waffles: ${regular.length}`);
const waffles = regular.map((g) => [
  g,
  ...GREENS.map((greens) => scramble(g, 5, greens, 10, random)),
]);
const deluxeGrids = findGrids(words7(), 7, DELUXE_COUNT, random);
console.log(`deluxe waffles: ${deluxeGrids.length}`);
const deluxe = deluxeGrids.map((g) => [
  g,
  scramble(g, 7, DELUXE_GREENS, 20, random),
]);

const rows = (list) =>
  list.map((e) => `  [${e.map((s) => `'${s}'`).join(', ')}],`).join('\n');
writeFileSync(
  OUT,
  `// Generated by scripts/folio-waffle-bank.mjs; do not edit by hand.
// Each entry is the solution then its scrambles, one letter per cell of the
// square grid read row by row, '.' at the holes. Regular waffles carry one
// scramble per level (8, 6 and 5 starting greens); each needs exactly 10
// swaps. Deluxe waffles are 7×7 with one scramble needing exactly 20 swaps.
export const WAFFLES: string[][] = [
${rows(waffles)}
];
export const DELUXE: string[][] = [
${rows(deluxe)}
];
`,
);
