/**
 * Original Connections-style puzzles for Folio (server only). Each puzzle is
 * four groups of four; `level` is the colour difficulty: 1 yellow, 2 green,
 * 3 blue, 4 purple. Red herrings are deliberate but every puzzle has exactly
 * one way to split its sixteen words.
 */
export type GroupDef = { level: 1 | 2 | 3 | 4; name: string; words: string[] };
export type GroupsPuzzle = GroupDef[];

const g = (level: 1 | 2 | 3 | 4, name: string, words: string) => ({
  level,
  name,
  words: words.split(','),
});

/** Gentle: plain categories, no traps. */
export const GENTLE: GroupsPuzzle[] = [
  [
    g(1, 'Fruits', 'APPLE,BANANA,CHERRY,MANGO'),
    g(2, 'Shades of blue', 'NAVY,TEAL,COBALT,AZURE'),
    g(3, 'Kitchen utensils', 'WHISK,LADLE,SPATULA,TONGS'),
    g(4, '___BALL', 'FOOT,BASKET,SNOW,EYE'),
  ],
  [
    g(1, 'Planets', 'MARS,VENUS,SATURN,JUPITER'),
    g(2, 'Dog breeds', 'POODLE,BEAGLE,BOXER,HUSKY'),
    g(3, 'Card games', 'POKER,BRIDGE,SNAP,RUMMY'),
    g(4, '___FISH', 'GOLD,SWORD,STAR,CAT'),
  ],
  [
    g(1, 'Weather', 'RAIN,SNOW,HAIL,FOG'),
    g(2, 'Musical instruments', 'VIOLIN,FLUTE,TRUMPET,HARP'),
    g(3, 'Pasta', 'PENNE,FUSILLI,RAVIOLI,LASAGNE'),
    g(4, 'Palindromes', 'KAYAK,LEVEL,RADAR,CIVIC'),
  ],
  [
    g(1, 'Farm animals', 'COW,PIG,SHEEP,GOAT'),
    g(2, 'Furniture', 'SOFA,TABLE,DESK,WARDROBE'),
    g(3, 'Things with keys', 'PIANO,LAPTOP,LOCK,MAP'),
    g(4, '___CAKE', 'CUP,PAN,CHEESE,CARROT'),
  ],
  [
    g(1, 'Joints', 'ELBOW,KNEE,WRIST,ANKLE'),
    g(2, 'Colours of the rainbow', 'RED,ORANGE,YELLOW,VIOLET'),
    g(3, 'Sea creatures', 'SHARK,WHALE,OCTOPUS,DOLPHIN'),
    g(4, 'SUN___', 'FLOWER,GLASSES,BURN,RISE'),
  ],
  [
    g(1, 'Public transport', 'TRAIN,BUS,TRAM,FERRY'),
    g(2, 'Vegetables', 'CARROT,LEEK,ONION,CELERY'),
    g(3, 'Chess pieces', 'ROOK,PAWN,BISHOP,KNIGHT'),
    g(4, '___HOUSE', 'GREEN,LIGHT,TREE,WARE'),
  ],
  [
    g(1, 'Birds', 'ROBIN,EAGLE,OWL,SPARROW'),
    g(2, 'Sports', 'TENNIS,GOLF,RUGBY,HOCKEY'),
    g(3, 'Units of time', 'SECOND,MINUTE,HOUR,DECADE'),
    g(4, 'Hidden farm animals', 'SCATTER,BEARD,PIGMENT,CRATE'),
  ],
  [
    g(1, 'At the beach', 'SAND,SHELL,WAVE,TOWEL'),
    g(2, 'Hats', 'BERET,FEDORA,BEANIE,BOWLER'),
    g(3, 'Breakfast foods', 'TOAST,CEREAL,BACON,PORRIDGE'),
    g(4, 'Famous bears', 'PADDINGTON,BALOO,POOH,YOGI'),
  ],
];

/** Tricky: one or two words that plausibly fit a second group. */
export const TRICKY: GroupsPuzzle[] = [
  [
    g(1, 'Slang for money', 'BREAD,BUCKS,DOSH,MOOLAH'),
    g(2, 'Pastry', 'PUFF,FILO,CHOUX,SHORTCRUST'),
    g(3, "Magician's kit", 'WAND,CAPE,RABBIT,HAT'),
    g(4, 'Sound like deer words', 'DOUGH,HEART,DEAR,ROW'),
  ],
  [
    g(1, 'Parts of a shoe', 'SOLE,HEEL,LACE,TONGUE'),
    g(2, 'Fish', 'COD,PLAICE,CARP,PIKE'),
    g(3, 'Medieval weapons', 'MACE,LANCE,SWORD,FLAIL'),
    g(4, 'Things you cast', 'SPELL,VOTE,SHADOW,NET'),
  ],
  [
    g(1, 'Laundry steps', 'WASH,IRON,RINSE,DRY'),
    g(2, 'Poker moves', 'BLUFF,RAISE,CALL,FOLD'),
    g(3, 'Fabric patterns', 'CHECK,PLAID,TARTAN,STRIPE'),
    g(4, '___WORD', 'PASS,CROSS,KEY,BUZZ'),
  ],
  [
    g(1, 'Coffee orders', 'LATTE,FLAT WHITE,ESPRESSO,CORTADO'),
    g(2, 'Shades of brown', 'BEIGE,UMBER,TAUPE,MOCHA'),
    g(3, 'Trig functions', 'SINE,COSINE,TAN,SECANT'),
    g(4, 'BIG ___', 'BEN,APPLE,BANG,TOP'),
  ],
  [
    g(1, 'Trees', 'OAK,ASH,ELM,PINE'),
    g(2, 'In the fireplace', 'LOG,GRATE,EMBER,SOOT'),
    g(3, 'Record books', 'DIARY,JOURNAL,LEDGER,REGISTER'),
    g(4, '___ROCK', 'PUNK,BED,SHAM,HARD'),
  ],
  [
    g(1, 'Greetings', 'HI,HEY,HOWDY,HIYA'),
    g(2, 'Garden tools', 'RAKE,HOE,TROWEL,FORK'),
    g(3, 'Card suits', 'CLUB,SPADE,DIAMOND,HEART'),
    g(4, '___LINE', 'HEAD,DEAD,HEM,AIR'),
  ],
  [
    g(1, 'Cheeses', 'BRIE,FETA,GOUDA,EDAM'),
    g(2, 'Greek letters', 'ALPHA,BETA,DELTA,SIGMA'),
    g(3, 'Moons of Jupiter', 'IO,EUROPA,GANYMEDE,CALLISTO'),
    g(4, 'Hidden body parts', 'WARMTH,SHIPYARD,ELEGANT,HEARTY'),
  ],
  [
    g(1, 'Golf scores', 'PAR,BIRDIE,EAGLE,BOGEY'),
    g(2, 'Board games', 'CHESS,LUDO,GO,RISK'),
    g(3, 'Danger', 'PERIL,THREAT,MENACE,HAZARD'),
    g(4, '___WOOD', 'HOLLY,DRIFT,FIRE,PLY'),
  ],
];

/** Tough: chains of red herrings that only resolve together. */
export const TOUGH: GroupsPuzzle[] = [
  [
    g(1, 'Parts of a book', 'SPINE,COVER,INDEX,CHAPTER'),
    g(2, 'Sewing kit', 'THIMBLE,BOBBIN,SPOOL,THREAD'),
    g(3, 'Prickly things', 'THORN,BARB,QUILL,NEEDLE'),
    g(4, 'Things you crack', 'CODE,JOKE,SAFE,WHIP'),
  ],
  [
    g(1, 'Tiny amounts', 'DROP,HINT,SPECK,TRACE'),
    g(2, 'Punctuation', 'DASH,COLON,COMMA,PERIOD'),
    g(3, 'Steal', 'NICK,SWIPE,LIFT,PINCH'),
    g(4, 'Butterflies', 'PEACOCK,MONARCH,ADMIRAL,SKIPPER'),
  ],
  [
    g(1, 'Anagrams of STOP', 'POTS,TOPS,SPOT,OPTS'),
    g(2, 'Walk heavily', 'STOMP,TRUDGE,PLOD,TRAMP'),
    g(3, 'Mail', 'LETTER,PARCEL,POST,STAMP'),
    g(4, 'They have leaves', 'TABLE,BOOK,CABBAGE,TREE'),
  ],
  [
    g(1, 'Fictional detectives', 'POIROT,MARPLE,HOLMES,MORSE'),
    g(2, 'Pub words', 'PINT,ROUND,SNUG,TAB'),
    g(3, '___CODE', 'AREA,ZIP,DRESS,BAR'),
    g(4, 'Hidden numbers', 'OFTEN,BONE,CANINE,WEIGHT'),
  ],
  [
    g(1, 'Dog noises', 'WOOF,YAP,YELP,GROWL'),
    g(2, 'Parts of a tree', 'ROOT,BRANCH,LEAF,BARK'),
    g(3, 'Elephant things', 'TUSK,IVORY,HERD,TRUNK'),
    g(4, '___CASE', 'SUIT,BOOK,BRIEF,STAIR'),
  ],
  [
    g(1, 'Exercises', 'LUNGE,PLANK,SQUAT,CRUNCH'),
    g(2, 'Keyboard keys', 'ENTER,SPACE,ESCAPE,SHIFT'),
    g(3, 'Magic', 'CHARM,HEX,CURSE,JINX'),
    g(4, 'Stretches of time', 'STINT,TERM,STRETCH,SPELL'),
  ],
  [
    g(1, 'Playing cards', 'JACK,KING,QUEEN,JOKER'),
    g(2, 'Tennis terms', 'LOVE,DEUCE,ACE,LET'),
    g(3, '___LETTER', 'NEWS,CHAIN,COVER,RED'),
    g(4, 'Countries minus their last letter', 'CHIN,CUB,TOG,PER'),
  ],
  [
    g(1, 'Gemstones', 'EMERALD,SAPPHIRE,OPAL,TOPAZ'),
    g(2, 'Shades of red', 'CRIMSON,SCARLET,CHERRY,RUBY'),
    g(3, 'Leave stranded', 'MAROON,ABANDON,STRAND,DITCH'),
    g(4, '___ ISLAND', 'TREASURE,RHODE,EASTER,DESERT'),
  ],
];

/** Purple week: wordplay everywhere and several words that fit two groups. */
export const PURPLE_WEEK: GroupsPuzzle[] = [
  [
    g(1, 'Christmas things', 'BAUBLE,WREATH,CRACKER,STOCKING'),
    g(2, 'Join up', 'ENROL,SIGN UP,REGISTER,ENTER'),
    g(3, '___FISH', 'JELLY,CAT,SWORD,STAR'),
    g(4, 'Anagrams of LISTEN', 'SILENT,INLETS,TINSEL,ENLIST'),
  ],
  [
    g(1, 'Parts of the leg', 'SHIN,THIGH,KNEE,CALF'),
    g(2, 'Baby animals', 'FOAL,CUB,PUP,JOEY'),
    g(3, 'Tease', 'RIB,RAG,KID,JOSH'),
    g(4, 'Names that are also verbs', 'BOB,PAT,SUE,ROB'),
  ],
  [
    g(1, 'Swords', 'SABRE,RAPIER,CUTLASS,EPEE'),
    g(2, 'Parts of a theatre', 'STAGE,WINGS,STALLS,ORCHESTRA'),
    g(3, 'Things you draw', 'BATH,BREATH,CURTAIN,CROWD'),
    g(4, 'They have pits', 'PEACH,ARM,MINE,OLIVE'),
  ],
  [
    g(1, 'Dances', 'WALTZ,RUMBA,SAMBA,JIVE'),
    g(2, 'Dips', 'HUMMUS,AIOLI,SALSA,GUACAMOLE'),
    g(3, 'NATO alphabet', 'HOTEL,ECHO,KILO,TANGO'),
    g(4, 'Awards', 'OSCAR,TONY,EMMY,BAFTA'),
  ],
  [
    g(1, 'Trees', 'ASH,YEW,BIRCH,ROWAN'),
    g(2, 'Sad', 'LOW,GLUM,DOWN,BLUE'),
    g(3, '___BERRY', 'STRAW,GOOSE,BLACK,ELDER'),
    g(4, '___TOWN', 'CHINA,GHOST,BOOM,HOME'),
  ],
  [
    g(1, 'Hats', 'BERET,TRILBY,BOWLER,FEZ'),
    g(2, 'Car parts', 'BOOT,BONNET,CLUTCH,HORN'),
    g(3, 'Bags', 'TOTE,SATCHEL,HOLDALL,POUCH'),
    g(4, 'SHOE___', 'LACE,STRING,BOX,TREE'),
  ],
];
